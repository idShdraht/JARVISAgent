// ═══════════════════════════════════════════════════════
//  JARVIS Web Portal — Database Helper
//  Developed by Balaraman
//  Supports Aiven MySQL (cloud) and local-only fallback
// ═══════════════════════════════════════════════════════
'use strict';
require('dotenv').config({ quiet: true });

// ─── Detect if DB credentials look valid ─────────────
const hasDB = !!(
    process.env.DB_HOST &&
    process.env.DB_HOST !== 'your-aiven-host.aivencloud.com' &&
    process.env.DB_USER &&
    process.env.DB_USER !== 'your-db-user'
);

let pool = null;

if (hasDB) {
    const mysql = require('mysql2/promise');
    pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false },
        waitForConnections: true,
        connectionLimit: 5,
        connectTimeout: 15000,
    });
}

// ─── In-memory store (local-only mode) ───────────────
// Simple Map: email → user object
const LOCAL_USERS = new Map();
let LOCAL_ID = 1;

const localUpsert = ({ googleId, email, displayName, avatarUrl }) => {
    for (const [, u] of LOCAL_USERS) {
        if (u.google_id === googleId || u.email === email) {
            u.display_name = displayName;
            u.avatar_url = avatarUrl;
            return u;
        }
    }
    const user = {
        id: LOCAL_ID++, google_id: googleId, email,
        display_name: displayName, avatar_url: avatarUrl,
        password_hash: null, platform: 'unknown', setup_done: 0,
    };
    LOCAL_USERS.set(email, user);
    return user;
};

const localFindByEmail = (email) => LOCAL_USERS.get(email) || null;
const localFindById = (id) => [...LOCAL_USERS.values()].find(u => u.id === id) || null;
const localFindByGId = (gid) => [...LOCAL_USERS.values()].find(u => u.google_id === gid) || null;

// ─── Init ─────────────────────────────────────────────
const init = async () => {
    if (!pool) throw new Error('No DB credentials configured');
    await pool.execute(`
    CREATE TABLE IF NOT EXISTS jarvis_users (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      google_id    VARCHAR(255) UNIQUE,
      email        VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT,
      display_name VARCHAR(255),
      avatar_url   TEXT,
      platform     VARCHAR(50) DEFAULT 'unknown',
      setup_done   TINYINT DEFAULT 0,
      pairing_code VARCHAR(20) DEFAULT NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
    // Add pairing_code column if upgrading from older schema
    await pool.execute(`ALTER TABLE jarvis_users ADD COLUMN IF NOT EXISTS pairing_code VARCHAR(20) DEFAULT NULL`);
    await pool.execute(`
    CREATE TABLE IF NOT EXISTS jarvis_sessions (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL,
      event      VARCHAR(100),
      detail     TEXT,
      platform   VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES jarvis_users(id) ON DELETE CASCADE
    )
  `);
    await pool.execute(`
    CREATE TABLE IF NOT EXISTS jarvis_channels (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      user_id      INT NOT NULL,
      channel_id   VARCHAR(50) NOT NULL,
      token        TEXT,
      status       VARCHAR(20) DEFAULT 'linked',
      linked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_channel (user_id, channel_id),
      FOREIGN KEY (user_id) REFERENCES jarvis_users(id) ON DELETE CASCADE
    )
  `);
    console.log('[JARVIS-DB] Tables ready');
};

// ─── Query helper ──────────────────────────────────────
const query = async (sql, vals = []) => {
    if (!pool) return []; // silent no-op in local mode
    const [rows] = await pool.execute(sql, vals);
    return rows;
};

// ─── User lookups ─────────────────────────────────────
const findUserByGoogleId = async (googleId) => {
    if (!pool) return localFindByGId(googleId);
    const r = await query('SELECT * FROM jarvis_users WHERE google_id = ? LIMIT 1', [googleId]);
    return r[0] || null;
};

const findUserByEmail = async (email) => {
    if (!pool) return localFindByEmail(email);
    const r = await query('SELECT * FROM jarvis_users WHERE email = ? LIMIT 1', [email]);
    return r[0] || null;
};

const findUserById = async (id) => {
    if (!pool) return localFindById(id);
    const r = await query('SELECT * FROM jarvis_users WHERE id = ? LIMIT 1', [id]);
    return r[0] || null;
};

// ─── Upsert Google user ────────────────────────────────
const upsertGoogleUser = async ({ googleId, email, displayName, avatarUrl }) => {
    if (!pool) return localUpsert({ googleId, email, displayName, avatarUrl });
    await pool.execute(
        `INSERT INTO jarvis_users (google_id, email, display_name, avatar_url)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       email        = VALUES(email),
       display_name = VALUES(display_name),
       avatar_url   = VALUES(avatar_url)`,
        [googleId, email, displayName, avatarUrl]
    );
    return findUserByGoogleId(googleId);
};

// ─── Set password ──────────────────────────────────────
const setPassword = async (userId, hash) => {
    if (!pool) {
        const u = localFindById(userId);
        if (u) u.password_hash = hash;
        return;
    }
    await query('UPDATE jarvis_users SET password_hash = ? WHERE id = ?', [hash, userId]);
};

// ─── Mark setup done ───────────────────────────────────
const markSetupDone = async (userId, platform) => {
    if (!pool) {
        const u = localFindById(userId);
        if (u) { u.setup_done = 1; u.platform = platform; }
        return;
    }
    await query('UPDATE jarvis_users SET setup_done = 1, platform = ? WHERE id = ?', [platform, userId]);
};

// ─── Session log (silent no-op if no DB) ──────────────
const logSession = (userId, event, detail, platform) => {
    if (!pool) return Promise.resolve();
    return query(
        'INSERT INTO jarvis_sessions (user_id, event, detail, platform) VALUES (?,?,?,?)',
        [userId, event, detail, platform]
    ).catch(() => { });
};

// ─── Channel persistence ──────────────────────────────
// In-memory fallback for local mode
const LOCAL_CHANNELS = new Map(); // `${userId}:${channelId}` → {token, status}

const saveChannel = async (userId, channelId, token, status = 'linked') => {
    const key = `${userId}:${channelId}`;
    if (!pool) { LOCAL_CHANNELS.set(key, { token, status, linked_at: new Date() }); return; }
    await query(
        `INSERT INTO jarvis_channels (user_id, channel_id, token, status)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE token = VALUES(token), status = VALUES(status), linked_at = NOW()`,
        [userId, channelId, token || null, status]
    );
};

const getChannels = async (userId) => {
    if (!pool) {
        const result = [];
        for (const [key, val] of LOCAL_CHANNELS) {
            if (key.startsWith(`${userId}:`)) {
                result.push({ channel_id: key.split(':')[1], ...val });
            }
        }
        return result;
    }
    return query('SELECT channel_id, status, linked_at FROM jarvis_channels WHERE user_id = ?', [userId]);
};

const deleteChannel = async (userId, channelId) => {
    const key = `${userId}:${channelId}`;
    if (!pool) { LOCAL_CHANNELS.delete(key); return; }
    await query('DELETE FROM jarvis_channels WHERE user_id = ? AND channel_id = ?', [userId, channelId]);
};

// ─── Save / load pairing code ──────────────────────────
const savePairingCode = async (userId, code) => {
    if (!pool) {
        const u = localFindById(userId);
        if (u) u.pairing_code = code;
        return;
    }
    await query('UPDATE jarvis_users SET pairing_code = ? WHERE id = ?', [code, userId]);
};

const loadPairingCode = async (userId) => {
    if (!pool) {
        const u = localFindById(userId);
        return u?.pairing_code || null;
    }
    const r = await query('SELECT pairing_code FROM jarvis_users WHERE id = ? LIMIT 1', [userId]);
    return r[0]?.pairing_code || null;
};

module.exports = {
    init, query, findUserByGoogleId, findUserByEmail, findUserById,
    upsertGoogleUser, setPassword, markSetupDone, logSession,
    savePairingCode, loadPairingCode,
    saveChannel, getChannels, deleteChannel,
    isLocalMode: () => !pool,
};
