#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  J.A.R.V.I.S — Instagram Auto-Responder
//  Developed by Balaraman
//  Features: Login + session restore, 2FA/challenge handler,
//  realtime DM with polling fallback, comment keyword monitor,
//  keyword trigger management, Aiven MySQL cloud sync
// ═══════════════════════════════════════════════════════════════

import { IgApiClient } from 'instagram-private-api';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import { setTimeout as sleep } from 'timers/promises';

// ─── Paths ────────────────────────────────────────────────────
const HOME = process.env.HOME || '/root';
const JARVIS_DIR = path.join(HOME, '.jarvis');
const SESSION_FILE = path.join(JARVIS_DIR, 'ig_session.json');
const CREDS_FILE = path.join(JARVIS_DIR, 'ig_creds.enc');
const TRIGGERS_FILE = path.join(JARVIS_DIR, 'ig_triggers.json');
const LOG_FILE = path.join(JARVIS_DIR, 'ig.log');
const KEY_FILE = path.join(JARVIS_DIR, '.dkey');

// ─── Aiven MySQL ──────────────────────────────────────────────
const DB_CFG = {
  host: process.env.JARVIS_DB_HOST || '',
  port: Number(process.env.JARVIS_DB_PORT) || 3306,
  user: process.env.JARVIS_DB_USER || '',
  password: process.env.JARVIS_DB_PASS || '',
  database: process.env.JARVIS_DB_NAME || '',
  ssl: { rejectUnauthorized: false },
  connectTimeout: 10000,
};

// ─── Colours ──────────────────────────────────────────────────
const C = {
  rst: '\x1b[0m', b: '\x1b[1m', d: '\x1b[2m',
  cy: '\x1b[38;5;51m', bl: '\x1b[38;5;27m',
  gd: '\x1b[38;5;220m', gr: '\x1b[38;5;48m',
  re: '\x1b[38;5;203m', mg: '\x1b[38;5;213m',
  wh: '\x1b[38;5;231m',
};

// ─── Logger ───────────────────────────────────────────────────
const ts = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const log = (msg, lvl = 'INFO') => {
  const line = `[${ts()}] [${lvl}] ${msg}`;
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch { }
  if (lvl === 'SILENT') return;
  const col = lvl === 'OK' ? C.gr : lvl === 'WARN' ? C.gd : lvl === 'ERR' ? C.re : C.cy;
  console.log(`  ${col}${C.b}◆${C.rst} ${C.wh}${msg}${C.rst}`);
};

// ─── UI Helpers ───────────────────────────────────────────────
const bar = () => console.log(`  ${C.bl}${C.b}${'━'.repeat(58)}${C.rst}`);
const hdr = (t) => { bar(); console.log(`  ${C.gd}${C.b}  ⟫  ${t}${C.rst}`); bar(); console.log(); };
const ok = (m) => console.log(`  ${C.gr}${C.b}✔${C.rst} ${m}`);
const warn = (m) => console.log(`  ${C.gd}${C.b}⚠${C.rst} ${m}`);
const err = (m) => console.log(`  ${C.re}${C.b}✘${C.rst} ${m}`);

const ask = (q) => new Promise(res => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(`  ${C.gd}${C.b}?${C.rst} ${q} `, a => { rl.close(); res(a.trim()); });
});

const askHidden = (q) => new Promise(res => {
  process.stdout.write(`  ${C.gd}${C.b}?${C.rst} ${q} `);
  let pass = '';
  const handler = (buf) => {
    const ch = buf.toString();
    if (ch === '\r' || ch === '\n' || ch === '\u0004') {
      process.stdin.setRawMode(false);
      process.stdin.removeListener('data', handler);
      process.stdout.write('\n');
      res(pass);
    } else if (ch === '\x7f' || ch === '\x08') {
      if (pass.length > 0) { pass = pass.slice(0, -1); process.stdout.write('\b \b'); }
    } else {
      pass += ch;
      process.stdout.write('*');
    }
  };
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', handler);
});

// ─── Encryption ───────────────────────────────────────────────
const deviceKey = () => {
  if (!fs.existsSync(KEY_FILE)) {
    fs.mkdirSync(JARVIS_DIR, { recursive: true });
    fs.writeFileSync(KEY_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  return Buffer.from(fs.readFileSync(KEY_FILE, 'utf8').trim(), 'hex');
};

const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(deviceKey(), 'jarvis-ig', 32);
  const c = crypto.createCipheriv('aes-256-cbc', key, iv);
  return iv.toString('hex') + ':' + c.update(text, 'utf8', 'hex') + c.final('hex');
};

const decrypt = (enc) => {
  const [ivH, data] = enc.split(':');
  const key = crypto.scryptSync(deviceKey(), 'jarvis-ig', 32);
  const d = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivH, 'hex'));
  return d.update(data, 'hex', 'utf8') + d.final('utf8');
};

// ─── Database ─────────────────────────────────────────────────
let DB = null;

const connectDB = async () => {
  try {
    DB = await mysql.createConnection(DB_CFG);
    log('Aiven MySQL connected', 'OK');
    return true;
  } catch (e) {
    warn(`Cloud DB offline (${e.message.slice(0, 50)}). Running local-only.`);
    DB = null;
    return false;
  }
};

const initDB = async () => {
  if (!DB) return;
  const tables = [
    `CREATE TABLE IF NOT EXISTS jarvis_credentials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      platform VARCHAR(50) NOT NULL,
      username VARCHAR(255) NOT NULL,
      enc_pass TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk (platform, username)
    )`,
    `CREATE TABLE IF NOT EXISTS jarvis_triggers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      platform VARCHAR(50) NOT NULL DEFAULT 'instagram',
      trigger_type ENUM('dm','comment') NOT NULL,
      keyword VARCHAR(255) NOT NULL,
      response TEXT NOT NULL,
      active TINYINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS jarvis_ig_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(50),
      sender VARCHAR(255),
      matched_kw VARCHAR(255),
      response_sent TEXT,
      raw_text TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  for (const sql of tables) {
    try { await DB.execute(sql); } catch (e) { warn('DB table: ' + e.message); }
  }
  ok('Cloud DB schema initialised');
};

const dbExec = async (sql, vals = []) => {
  if (!DB) return null;
  try { const [r] = await DB.execute(sql, vals); return r; }
  catch (e) { log('DB error: ' + e.message, 'WARN'); return null; }
};

const syncCreds = async (username, enc) =>
  dbExec(
    `INSERT INTO jarvis_credentials (platform,username,enc_pass) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE enc_pass=VALUES(enc_pass)`,
    ['instagram', username, enc]
  );

const syncTrigger = async (type, kw, resp) =>
  dbExec(
    `INSERT IGNORE INTO jarvis_triggers (platform,trigger_type,keyword,response)
     VALUES ('instagram',?,?,?)`,
    [type, kw, resp]
  );

const logEvent = async (type, sender, kw, resp, raw) =>
  dbExec(
    `INSERT INTO jarvis_ig_log (event_type,sender,matched_kw,response_sent,raw_text)
     VALUES (?,?,?,?,?)`,
    [type, sender, kw, resp, raw?.slice(0, 500)]
  );

// ─── Credentials I/O ──────────────────────────────────────────
const saveCreds = async (user, pass) => {
  fs.mkdirSync(JARVIS_DIR, { recursive: true });
  const enc = encrypt(pass);
  fs.writeFileSync(CREDS_FILE, JSON.stringify({ username: user, enc }), { mode: 0o600 });
  await syncCreds(user, enc);
  ok(`Credentials saved (encrypted) ✦ synced to cloud DB`);
};

const loadCreds = () => {
  if (!fs.existsSync(CREDS_FILE)) return null;
  try {
    const { username, enc } = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
    return { username, password: decrypt(enc) };
  } catch { return null; }
};

// ─── Triggers I/O ─────────────────────────────────────────────
const defaultTriggers = () => ({ dm: [], comment: [] });

const loadTriggers = () => {
  if (!fs.existsSync(TRIGGERS_FILE)) return defaultTriggers();
  try { return JSON.parse(fs.readFileSync(TRIGGERS_FILE, 'utf8')); }
  catch { return defaultTriggers(); }
};

const saveTriggers = (t) =>
  fs.writeFileSync(TRIGGERS_FILE, JSON.stringify(t, null, 2));

const matchKeyword = (text, list) =>
  list.find(t => t.active !== false &&
    text.toLowerCase().includes(t.keyword.toLowerCase())) || null;

// ─── Instagram Login + Session ────────────────────────────────
const loginIG = async (ig, username, password) => {
  ig.state.generateDevice(username);

  // Try restoring session first
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      await ig.state.deserialize(saved);
      // Verify session is still valid
      await ig.account.currentUser();
      ok(`Session restored for @${username}`);
      return true;
    } catch {
      log('Saved session expired — logging in fresh', 'WARN');
      fs.unlinkSync(SESSION_FILE);
    }
  }

  // Fresh login
  try {
    await ig.simulate.preLoginFlow();
    await ig.account.login(username, password);
    await ig.simulate.postLoginFlow();
    const session = await ig.state.serialize();
    delete session.constants; // don't persist constants
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session), { mode: 0o600 });
    ok(`Logged in as @${username}`);
    return true;
  } catch (e) {
    if (e.name === 'IgCheckpointError') {
      warn('Instagram needs verification (checkpoint). Handling...');
      return await handleChallenge(ig, username, password);
    }
    if (e.name === 'IgLoginTwoFactorRequiredError') {
      return await handle2FA(ig, e.response.body.two_factor_info, username, password);
    }
    err('Login failed: ' + e.message);
    return false;
  }
};

const handleChallenge = async (ig, username, password) => {
  try {
    await ig.challenge.auto(true); // request email/SMS verification
    console.log(`\n  ${C.gd}${C.b}Instagram sent a verification code to your email/phone.${C.rst}`);
    const code = await ask('Enter the 6-digit code:');
    await ig.challenge.sendSecurityCode(code);
    const session = await ig.state.serialize();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session), { mode: 0o600 });
    ok('Challenge passed — session saved');
    return true;
  } catch (e) {
    err('Challenge failed: ' + e.message);
    err('Try: delete ~/.jarvis/ig_session.json and run again');
    return false;
  }
};

const handle2FA = async (ig, twoFactorInfo, username, password) => {
  console.log(`\n  ${C.gd}${C.b}Two-factor authentication required.${C.rst}`);
  const method = twoFactorInfo.totp_two_factor_on ? 'Authenticator App' : 'SMS';
  console.log(`  Method: ${C.cy}${method}${C.rst}\n`);
  const code = await ask(`Enter your 2FA code (${method}):`);
  try {
    const verif = twoFactorInfo.two_factor_identifier;
    await ig.account.twoFactorLogin({
      username, verificationCode: code,
      twoFactorIdentifier: verif,
      verificationMethod: twoFactorInfo.totp_two_factor_on ? '0' : '1',
      trustThisDevice: '1',
    });
    const session = await ig.state.serialize();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session), { mode: 0o600 });
    ok('2FA verified — session saved');
    return true;
  } catch (e) {
    err('2FA failed: ' + e.message);
    return false;
  }
};

// ─── DM Monitor (polling — most reliable) ────────────────────
const startDMMonitor = (ig, getTrigs, intervalMs = 15_000) => {
  const seenMsgIds = new Set();
  let myUserId;

  const pollDMs = async () => {
    try {
      if (!myUserId) {
        const me = await ig.account.currentUser();
        myUserId = me.pk;
      }

      const inbox = ig.feed.directInbox();
      const threads = await inbox.items();

      for (const thread of threads) {
        const items = thread.items || [];
        for (const item of items) {
          if (!item.item_id || seenMsgIds.has(item.item_id)) continue;
          if (item.user_id === myUserId) continue; // skip own messages
          if (item.item_type !== 'text') { seenMsgIds.add(item.item_id); continue; }

          seenMsgIds.add(item.item_id);
          const text = item.text || '';
          const trigs = getTrigs();
          const match = matchKeyword(text, trigs.dm);
          if (!match) continue;

          const sender = thread.users?.[0]?.username || String(item.user_id);
          log(`DM match "${match.keyword}" from @${sender}`, 'OK');

          try {
            await sleep(jitter(1500, 3000));
            const t = ig.entity.directThread([String(item.user_id)]);
            await t.broadcastText(match.response);
            ok(`↳ Replied to @${sender}: "${match.response.slice(0, 50)}..."`);
            await logEvent('dm', sender, match.keyword, match.response, text);
          } catch (re) {
            log('DM reply error: ' + re.message, 'WARN');
          }
        }
      }
    } catch (e) {
      if (e.name === 'IgLoginRequiredError') {
        warn('Session expired — restarting in 60s');
        await sleep(60_000);
      } else {
        log('DM poll error: ' + e.message, 'WARN');
      }
    }
    setTimeout(pollDMs, intervalMs);
  };

  pollDMs();
  ok(`DM monitor active (polling every ${intervalMs / 1000}s)`);
};

// ─── Comment Monitor (polling) ────────────────────────────────
const startCommentMonitor = (ig, getTrigs, intervalMs = 30_000) => {
  const seenCommentIds = new Set();
  let myUserId;

  const pollComments = async () => {
    try {
      if (!myUserId) {
        const me = await ig.account.currentUser();
        myUserId = me.pk;
      }

      const feed = ig.feed.user(myUserId);
      const posts = await feed.items();

      for (const post of posts.slice(0, 8)) {
        const commentFeed = ig.feed.mediaComments(post.id);
        let items;
        try { items = await commentFeed.items(); }
        catch { continue; }

        for (const c of items) {
          if (seenCommentIds.has(c.pk)) continue;
          if (c.user_id === myUserId) { seenCommentIds.add(c.pk); continue; }
          seenCommentIds.add(c.pk);

          const text = c.text || '';
          const trigs = getTrigs();
          const match = matchKeyword(text, trigs.comment);
          if (!match) continue;

          const uname = c.user?.username || String(c.user_id);
          log(`Comment match "${match.keyword}" from @${uname} on post ${post.id}`, 'OK');

          try {
            await sleep(jitter(2000, 4000));
            await ig.media.comment({
              mediaId: post.id,
              text: `@${uname} ${match.response}`,
            });
            ok(`↳ Replied to comment by @${uname}`);
            await logEvent('comment', uname, match.keyword, match.response, text);
          } catch (re) {
            log('Comment reply error: ' + re.message, 'WARN');
          }
          await sleep(3000); // per-comment rate guard
        }
      }
    } catch (e) {
      log('Comment poll error: ' + e.message, 'WARN');
    }
    setTimeout(pollComments, intervalMs);
  };

  pollComments();
  ok(`Comment monitor active (polling every ${intervalMs / 1000}s)`);
};

// ─── Helpers ──────────────────────────────────────────────────
const jitter = (min, max) => min + Math.floor(Math.random() * (max - min));

// ─── Trigger Manager CLI ──────────────────────────────────────
const manageTriggers = async () => {
  while (true) {
    const trigs = loadTriggers();
    hdr('JARVIS-IG · Trigger Manager');

    const printList = (list, type) => {
      if (list.length === 0) {
        console.log(`  ${C.d}  No ${type} triggers yet.${C.rst}`);
        return;
      }
      list.forEach((t, i) => {
        const st = t.active === false ? `${C.re}[off]${C.rst}` : `${C.gr}[on] ${C.rst}`;
        console.log(`  ${st} ${C.gd}[${i}]${C.rst} "${C.cy}${t.keyword}${C.rst}" → "${t.response}"`);
      });
    };

    console.log(`${C.b}  DM Triggers:${C.rst}`);
    printList(trigs.dm, 'DM');
    console.log(`\n${C.b}  Comment Triggers:${C.rst}`);
    printList(trigs.comment, 'comment');
    console.log();
    console.log(`  ${C.bl}[1]${C.rst} Add DM trigger`);
    console.log(`  ${C.bl}[2]${C.rst} Add Comment trigger`);
    console.log(`  ${C.bl}[3]${C.rst} Remove a trigger`);
    console.log(`  ${C.bl}[4]${C.rst} Toggle trigger on/off`);
    console.log(`  ${C.bl}[5]${C.rst} Done / Start monitoring`);
    console.log();

    const ch = await ask('Choice:');

    if (ch === '1' || ch === '2') {
      const type = ch === '1' ? 'dm' : 'comment';
      const kw = await ask(`Keyword to match in ${type.toUpperCase()} (case-insensitive):`);
      const resp = await ask('Auto-response to send:');
      if (kw && resp) {
        trigs[type].push({ keyword: kw, response: resp, active: true });
        saveTriggers(trigs);
        await syncTrigger(type, kw, resp);
        ok(`Trigger saved: "${kw}" → "${resp.slice(0, 50)}"`);
      }
    } else if (ch === '3') {
      const type = await ask('Remove from [dm] or [comment]?');
      if (trigs[type]) {
        const idx = parseInt(await ask('Enter trigger index to remove:'));
        if (!isNaN(idx) && trigs[type][idx]) {
          const removed = trigs[type].splice(idx, 1)[0];
          saveTriggers(trigs);
          ok(`Removed: "${removed.keyword}"`);
        }
      }
    } else if (ch === '4') {
      const type = await ask('Toggle in [dm] or [comment]?');
      if (trigs[type]) {
        const idx = parseInt(await ask('Enter trigger index to toggle:'));
        if (!isNaN(idx) && trigs[type][idx]) {
          trigs[type][idx].active = !trigs[type][idx].active;
          saveTriggers(trigs);
          ok(`Trigger ${trigs[type][idx].active ? 'enabled' : 'disabled'}`);
        }
      }
    } else if (ch === '5') {
      break;
    }
  }
};

// ─── Status Dashboard ─────────────────────────────────────────
const showStatus = (username) => {
  const trigs = loadTriggers();
  console.clear();
  console.log(`${C.cy}${C.b}`);
  console.log('  ╔══════════════════════════════════════════════════════════╗');
  console.log('  ║   J.A.R.V.I.S  ─  Instagram  ─  LIVE                   ║');
  console.log(`  ║${C.gd}   Developed by Balaraman${C.cy}                                 ║`);
  console.log('  ╚══════════════════════════════════════════════════════════╝');
  console.log(C.rst);
  console.log(`  ${C.gr}${C.b}● ONLINE${C.rst}  logged in as ${C.cy}@${username}${C.rst}`);
  console.log(`  ${C.b}DM triggers:${C.rst}      ${C.gd}${trigs.dm.filter(t => t.active !== false).length}${C.rst} active`);
  console.log(`  ${C.b}Comment triggers:${C.rst} ${C.gd}${trigs.comment.filter(t => t.active !== false).length}${C.rst} active`);
  console.log(`  ${C.b}Cloud DB:${C.rst}         ${DB ? `${C.gr}connected${C.rst}` : `${C.gd}local only${C.rst}`}`);
  console.log(`  ${C.b}Logs:${C.rst}             ${LOG_FILE}`);
  console.log();
  console.log(`  ${C.d}Press Ctrl+C to stop JARVIS-IG${C.rst}`);
  console.log(`  ${C.bl}${'─'.repeat(58)}${C.rst}`);
};

// ─── Main ─────────────────────────────────────────────────────
(async () => {
  console.clear();
  console.log(`${C.cy}${C.b}`);
  console.log('  ╔══════════════════════════════════════════════════════════╗');
  console.log('  ║                                                          ║');
  console.log('  ║     J.A.R.V.I.S  ─  Instagram Integration               ║');
  console.log(`  ║${C.gd}     Developed by Balaraman${C.cy}                               ║`);
  console.log('  ║                                                          ║');
  console.log('  ╚══════════════════════════════════════════════════════════╝');
  console.log(C.rst + '\n');

  fs.mkdirSync(JARVIS_DIR, { recursive: true });

  // DB connect (non-blocking)
  await connectDB();
  await initDB();

  // Credentials
  let creds = loadCreds();
  const ig = new IgApiClient();

  if (!creds) {
    hdr('Instagram Login');
    console.log(`  ${C.d}Your password is encrypted (AES-256) on this device`);
    console.log(`  and backed up to your private Aiven MySQL cloud DB.${C.rst}\n`);
    const username = await ask('Instagram username:');
    const password = await askHidden('Instagram password:');
    creds = { username, password };
    await saveCreds(username, password);
  } else {
    log(`Using saved credentials for @${creds.username}`);
  }

  // Login
  hdr('Authenticating with Instagram');
  const loggedIn = await loginIG(ig, creds.username, creds.password);
  if (!loggedIn) {
    err('Could not log in. Delete ~/.jarvis/ig_creds.enc to reset.');
    process.exit(1);
  }

  // Menu
  console.log('\n');
  console.log(`  ${C.bl}[1]${C.rst} Manage keyword triggers then start monitoring`);
  console.log(`  ${C.bl}[2]${C.rst} Start monitoring immediately (use existing triggers)`);
  console.log(`  ${C.bl}[3]${C.rst} Only manage triggers (don't start monitoring)`);
  console.log();
  const choice = await ask('What do you want to do?');

  if (choice === '1' || choice === '3') {
    await manageTriggers();
  }

  if (choice === '1' || choice === '2') {
    const getTrigs = () => loadTriggers(); // always reads fresh from disk
    startDMMonitor(ig, getTrigs);
    startCommentMonitor(ig, getTrigs);
    showStatus(creds.username);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log(`\n\n  ${C.gd}${C.b}[ JARVIS-IG ]${C.rst} Shutting down...`);
    if (DB) { try { await DB.end(); } catch { } }
    process.exit(0);
  });

  // Keep alive — log heartbeat every 5 min silently
  setInterval(() => log(`heartbeat · @${creds.username}`, 'SILENT'), 300_000);
})();
