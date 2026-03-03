import fs from 'fs';
import path from 'path';
import os from 'os';

const logDir = path.join(os.homedir(), '.jarvis');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logStream = fs.createWriteStream(path.join(logDir, 'install-debug.log'), { flags: 'a' });

function systemLog(level, msg, ctx = {}) {
    // Produce structured lines
    const lineObj = { time: new Date().toISOString(), level, msg, ...ctx };
    const line = JSON.stringify(lineObj) + '\n';

    // Always persist to local logstream
    logStream.write(line);

    // Formalized explicit console outputting for visibility and testing
    // Warn/Fatal output to stderr automatically. If JARVIS_DEBUG=1 everything amplifies.
    if (process.env.JARVIS_DEBUG === '1' || process.argv.includes('--debug') || level === 'ERROR' || level === 'FATAL' || level === 'WARN') {
        const stream = (level === 'FATAL' || level === 'ERROR' || level === 'WARN') ? process.stderr : process.stdout;
        stream.write(`[JARVIS ${level}] ${msg}\n`);
    }

    if (level === 'FATAL') {
        process.exit(1);
    }
}

export { systemLog };
