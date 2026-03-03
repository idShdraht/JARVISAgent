import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { systemLog } from './logger.js';

async function logConsent(cliArgs) {
    const logDir = path.join(os.homedir(), '.jarvis');
    const consentLog = path.join(logDir, 'consent_log.jsonl');
    const entry = {
        timestamp: new Date().toISOString(),
        action: 'risk_accepted',
        args: cliArgs
    };
    try {
        await fs.mkdir(logDir, { recursive: true });

        // Ensure log rotation policy (5MB rotation limit) maintaining 0600 bounds
        const stats = await fs.stat(consentLog).catch(() => ({ size: 0 }));
        if (stats.size > 5 * 1024 * 1024) {
            systemLog('INFO', `Rotating large consent log past threshold limit.`);
            await fs.rename(consentLog, path.join(logDir, 'consent_log.1.jsonl'));
        }

        // Atomic JSONL Appending structurally mapping to security auditing expectations
        await fs.appendFile(consentLog, JSON.stringify(entry) + '\n', { mode: 0o600 });
        systemLog('INFO', `Append-only native security audit log appended cleanly.`);
    } catch (err) {
        systemLog('WARN', `Security audit logging to ~ degraded due to fs exception. Context: ${err.message}`);
    }
}

export { logConsent };
