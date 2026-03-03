import fs from 'fs';
import path from 'path';

const logFilePath = process.argv[2] ? path.resolve(process.argv[2]) : null;

if (!logFilePath || !fs.existsSync(logFilePath)) {
    console.error(`FATAL: Port extraction target missing: ${logFilePath}`);
    process.exit(1);
}

const logContent = fs.readFileSync(logFilePath, 'utf8');

// Searching for typical explicit logging format from OpenClaw/JARVIS Gateway layer
const portMatch = logContent.match(/Gateway bound natively on port: (\d+)/i) || logContent.match(/listening on port.*?(\d+)/i);

if (portMatch && portMatch[1]) {
    process.stdout.write(portMatch[1]);
} else {
    console.error(`FATAL: Gateway failed to bind reliably or logger format underwent undocumented drift.`);
    process.exit(1);
}
