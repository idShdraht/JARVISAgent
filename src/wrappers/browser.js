import { execFile } from 'child_process';
import os from 'os';
import { systemLog } from './logger.js';

function openDashboard(urlInput) {
    let safeUrl;
    try {
        safeUrl = new URL(urlInput).toString();
    } catch {
        systemLog('ERROR', `Invalid URL syntax provided to browser spawner: ${urlInput}`);
        return;
    }

    let bin, args;
    if (!!process.env.PREFIX && process.env.PREFIX.includes('com.termux')) {
        bin = 'termux-open-url'; args = [safeUrl];
    } else if (os.platform() === 'win32') {
        bin = 'cmd.exe'; args = ['/c', 'start', '""', safeUrl];
    } else if (os.platform() === 'darwin') {
        bin = 'open'; args = [safeUrl];
    } else {
        bin = 'xdg-open'; args = [safeUrl];
    }

    systemLog('INFO', `Dispatching URL mechanically via execFile: ${bin} ${args.join(' ')}`);

    const child = execFile(bin, args, { windowsHide: true }, (err) => {
        if (err) {
            systemLog('WARN', `Could not auto-launch browser explicitly. Visit manually: ${safeUrl}`);
        }
    });

    child.unref();
}

export { openDashboard };
