import sqlite3 from 'sqlite3';
import mysql from 'mysql2/promise';
import axios from 'axios';
import { promisify } from 'util';

/**
 * Offline Resilience & State Sync Module
 * Caches messages in local SQLite and syncs to Aiven MySQL cloud.
 */
export class DatabaseBuffer {
    constructor() {
        this.sqlite = new sqlite3.Database(process.env.DB_PATH || './jarvis_local.db');
        this.initLocalDb();
    }

    initLocalDb() {
        this.sqlite.run(`
            CREATE TABLE IF NOT EXISTS message_buffer (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT,
                senderId TEXT,
                message TEXT,
                timestamp INTEGER,
                synced BOOLEAN DEFAULT 0
            )
        `);
    }

    async queueLocally(msg) {
        return new Promise((resolve, reject) => {
            this.sqlite.run(
                `INSERT INTO message_buffer (platform, senderId, message, timestamp) VALUES (?, ?, ?, ?)`,
                [msg.platform, msg.senderId, msg.message, msg.timestamp],
                (err) => err ? reject(err) : resolve()
            );
        });
    }

    async syncToCloud() {
        // 1. Check Internet Connectivity (Render Heartbeat)
        try {
            await axios.get(process.env.PORTAL_URL + '/api/health');
        } catch (e) {
            console.log('[JARVIS] Local mode active (Offline).');
            return;
        }

        // 2. Fetch Unsynced messages
        const dbAll = promisify(this.sqlite.all).bind(this.sqlite);
        const rows = await dbAll(`SELECT * FROM message_buffer WHERE synced = 0`);

        if (rows.length === 0) return;

        // 3. Connect to Aiven MySQL (White-labeled as JARVIS Memory Bank)
        const cloudDb = await mysql.createConnection(process.env.DATABASE_URL);

        console.log(`[JARVIS SYNC] Pushing ${rows.length} messages to cloud memory...`);

        for (const row of rows) {
            await cloudDb.execute(
                `INSERT INTO message_logs (platform, sender_id, content, created_at) VALUES (?, ?, ?, FROM_UNIXTIME(?/1000))`,
                [row.platform, row.senderId, row.message, row.timestamp]
            );

            // Mark as synced locally
            this.sqlite.run(`UPDATE message_buffer SET synced = 1 WHERE id = ?`, [row.id]);
        }

        await cloudDb.end();
        console.log('[JARVIS SYNC] Synchronization complete.');
    }
}
