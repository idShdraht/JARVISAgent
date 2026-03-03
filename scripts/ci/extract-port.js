import fs from 'fs';
import path from 'path';

const logFilePath = process.argv[2] ? path.resolve(process.argv[2]) : null;

if (!logFilePath || !fs.existsSync(logFilePath)) {
    console.error(`FATAL: Port extraction target missing: ${logFilePath}`);
    process.exit(1);
}

const logContent = fs.readFileSync(logFilePath, 'utf8');

// Match multiple gateway log patterns including ephemeral fallback
const portPatterns = [
    /Gateway bound natively on port: (\d+)/i,
    /listening on port.*?(\d+)/i,
    /gateway.*?port[:\s]+(\d+)/i,
    /bound to (?:ephemeral )?port (\d+)/i,
    /EADDRINUSE.*?fallback.*?port[:\s]+(\d+)/i,
    /http:\/\/(?:localhost|0\.0\.0\.0|127\.0\.0\.1):(\d+)/i,
];

let foundPort = null;
for (const pattern of portPatterns) {
    const match = logContent.match(pattern);
    if (match && match[1]) {
        foundPort = match[1];
        break;
    }
}

if (foundPort) {
    process.stdout.write(foundPort);
} else {
    console.error(`FATAL: Gateway failed to bind reliably or log format underwent undocumented drift.`);
    console.error(`Log content:\n${logContent.substring(0, 500)}`);
    process.exit(1);
}
