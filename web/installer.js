// ═══════════════════════════════════════════════════════
//  JARVIS Web Portal — Platform Installer + Onboard Bridge
//  Developed by Balaraman
//  Spawns installer/onboard process with full stdin/stdout pipe
//  Streams output to SSE, detects prompts, accepts UI input
// ═══════════════════════════════════════════════════════
'use strict';
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

// ─── Per-user SSE client registry ─────────────────────
const sseClients = new Map(); // userId → Set<res>

const addSSEClient = (userId, res) => {
    if (!sseClients.has(userId)) sseClients.set(userId, new Set());
    sseClients.get(userId).add(res);
};

const removeSSEClient = (userId, res) => {
    sseClients.get(userId)?.delete(res);
};

const sendSSE = (userId, type, data) => {
    const msg = `data: ${JSON.stringify({ type, data })}\n\n`;
    sseClients.get(userId)?.forEach(res => {
        try { res.write(msg); } catch { }
    });
};

// ─── Per-user active process registry ─────────────────
// { proc, platform, buffer }
const activeProcs = new Map(); // userId → process

const killProc = (userId) => {
    const p = activeProcs.get(userId);
    if (p) {
        try { p.kill('SIGTERM'); } catch { }
        activeProcs.delete(userId);
    }
};

// ─── Root JARVIS dir (parent of web/) ─────────────────
const JARVIS_ROOT = path.resolve(__dirname, '..');

// ─── Platform detection ────────────────────────────────
const getPlatform = () => {
    const p = os.platform();
    if (p === 'win32') return 'windows';
    if (p === 'darwin') return 'mac';
    return 'linux';
};

// ─── Strip ANSI color codes ────────────────────────────
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[mGKHF]/g, '').replace(/\r/g, '');

// ═══════════════════════════════════════════════════════
//  PROMPT DETECTION ENGINE
//  Reads stdout line by line and decides what SSE event
//  to send: log | prompt | choice | error | done
// ═══════════════════════════════════════════════════════

// Known error keywords that mean "user needs to fix something"
const ERROR_KEYWORDS = [
    'invalid', 'incorrect', 'wrong', 'unauthorized', 'failed', 'error',
    'not found', 'cannot', 'denied', 'expired', 'bad request', 'rejected',
];

// Prompt endings — when a line ends with one of these and no \n follows
// within 200ms, we consider it a prompt waiting for input
const PROMPT_ENDINGS = ['?', ':', '>', '→', '=>', '...'];

// Known multichoice patterns
// e.g. "1. Google    2. OpenAI   3. Qwen"
// or lines like "  [1] Google"
const CHOICE_REGEX = /^\s*(?:\[?\s*(\d+)\s*\]?[.):\s]+)(.+)/;

// Patterns that indicate the onboard is DONE
const DONE_PATTERNS = [
    'successfully', 'setup complete', 'onboarding complete', 'all done',
    'jarvis is ready', 'you\'re all set', 'configuration saved',
];

const classifyLine = (raw) => {
    const line = raw.trim();
    if (!line) return { type: 'log', text: '' };

    const lower = line.toLowerCase();

    if (DONE_PATTERNS.some(p => lower.includes(p)))
        return { type: 'done', text: line };

    if (ERROR_KEYWORDS.some(k => lower.includes(k)))
        return { type: 'error_line', text: line };

    if (CHOICE_REGEX.test(line))
        return { type: 'choice_item', text: line };

    return { type: 'log', text: line };
};

// Accumulate choice items into a single "choice" event
const parseChoiceBlock = (lines) => {
    const choices = [];
    for (const l of lines) {
        const m = l.match(CHOICE_REGEX);
        if (m) choices.push({ num: m[1], label: m[2].trim() });
        else if (l.trim()) break; // non-choice line ends block
    }
    return choices;
};

// ═══════════════════════════════════════════════════════
//  ONBOARDING PROCESS MANAGER
// ═══════════════════════════════════════════════════════

const buildOnboardCommand = (platform) => {
    switch (platform) {
        case 'linux':
        case 'mac':
            // Inside proot Ubuntu: run openclaw onboard
            return {
                cmd: 'bash',
                args: ['-c', 'source ~/.jarvis_env 2>/dev/null; openclaw onboard 2>&1'],
                shell: false,
            };
        case 'windows':
            // On Windows: openclaw may be available via npm global
            return {
                cmd: 'cmd.exe',
                args: ['/c', 'openclaw onboard'],
                shell: false,
            };
        default:
            return null;
    }
};

const runOnboard = (userId, platform) => {
    // Kill any existing onboard for this user
    killProc(userId);

    const cfg = buildOnboardCommand(platform || getPlatform());
    if (!cfg) {
        sendSSE(userId, 'onboard_error', 'Cannot determine how to run onboarding on this platform.');
        return;
    }

    sendSSE(userId, 'onboard_start', 'Starting JARVIS onboarding wizard...');

    const proc = spawn(cfg.cmd, cfg.args, {
        cwd: JARVIS_ROOT,
        env: { ...process.env, JARVIS_HEADLESS: '1', TERM: 'xterm-256color', FORCE_COLOR: '0' },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
    });

    activeProcs.set(userId, proc);

    // Buffers for collecting choice items
    let choiceBuffer = [];
    let choiceTimeout = null;
    let promptTimeout = null;
    let rawBuffer = '';

    // Flush accumulated choice items as a single choice event
    const flushChoices = () => {
        if (choiceBuffer.length >= 2) {
            sendSSE(userId, 'choice', { options: choiceBuffer });
        } else if (choiceBuffer.length === 1) {
            // Single item — just log it
            sendSSE(userId, 'onboard_line', choiceBuffer[0].label);
        }
        choiceBuffer = [];
    };

    // Process a single cleaned line
    const handleLine = (line) => {
        if (!line) return;
        const { type, text } = classifyLine(line);

        if (type === 'choice_item') {
            const m = line.match(CHOICE_REGEX);
            choiceBuffer.push({ num: m[1], label: m[2].trim() });
            clearTimeout(choiceTimeout);
            choiceTimeout = setTimeout(flushChoices, 150);
            return;
        }

        // Flush pending choices if we hit a non-choice line
        if (choiceBuffer.length) { flushChoices(); }

        switch (type) {
            case 'done':
                sendSSE(userId, 'onboard_line', text);
                sendSSE(userId, 'onboard_done', text);
                break;
            case 'error_line':
                sendSSE(userId, 'onboard_line', text);
                sendSSE(userId, 'onboard_error_line', text);
                break;
            default:
                sendSSE(userId, 'onboard_line', text);
        }
    };

    // Handle stdout — both line-by-line and partial prompt detection
    proc.stdout.on('data', (chunk) => {
        rawBuffer += chunk.toString();

        // Split on newlines, keep partial last piece
        const parts = rawBuffer.split('\n');
        rawBuffer = parts.pop(); // incomplete last line stays in buffer

        parts.forEach(p => handleLine(stripAnsi(p)));

        // If rawBuffer has content and looks like a prompt, emit it after 250ms silence
        const partial = stripAnsi(rawBuffer).trim();
        clearTimeout(promptTimeout);
        if (partial && PROMPT_ENDINGS.some(e => partial.endsWith(e))) {
            promptTimeout = setTimeout(() => {
                if (rawBuffer.trim()) {
                    // Could be a choice block header — check
                    if (choiceBuffer.length) flushChoices();
                    sendSSE(userId, 'onboard_prompt', partial);
                    rawBuffer = '';
                }
            }, 280);
        }
    });

    proc.stderr.on('data', (chunk) => {
        const text = stripAnsi(chunk.toString()).trim();
        text.split('\n').filter(Boolean).forEach(l => {
            sendSSE(userId, 'onboard_line', l);
        });
    });

    proc.on('close', (code) => {
        clearTimeout(choiceTimeout);
        clearTimeout(promptTimeout);
        if (choiceBuffer.length) flushChoices();
        activeProcs.delete(userId);

        if (code === 0) {
            sendSSE(userId, 'onboard_done', '✔ JARVIS setup complete! You\'re ready to go.');
        } else {
            sendSSE(userId, 'onboard_failed', `Process exited with code ${code}. You can start again.`);
        }
    });

    proc.on('error', (e) => {
        sendSSE(userId, 'onboard_failed', 'Could not start onboarding: ' + e.message);
        activeProcs.delete(userId);
    });
};

// ─── Pipe user's answer into the running process stdin ─
const sendOnboardInput = (userId, text) => {
    const proc = activeProcs.get(userId);
    if (!proc || proc.killed) {
        return { ok: false, error: 'No active onboarding process — please start again.' };
    }
    try {
        proc.stdin.write(text + '\n');
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
};

// ─── Kill onboarding (for restart) ────────────────────
const stopOnboard = (userId) => {
    killProc(userId);
};

// ═══════════════════════════════════════════════════════
//  INSTALLER (non-interactive — for jarvis.sh)
// ═══════════════════════════════════════════════════════
const buildInstallerCommand = (platform) => {
    const jarvisSh = path.join(JARVIS_ROOT, 'jarvis.sh');
    switch (platform) {
        case 'windows': {
            const ps1 = path.join(JARVIS_ROOT, 'web', 'jarvis_windows_setup.ps1');
            return { cmd: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], shell: false };
        }
        case 'mac':
        case 'linux':
            return { cmd: 'bash', args: [jarvisSh], shell: false };
        default:
            return null;
    }
};

const runInstaller = (userId, targetPlatform) => {
    const platform = targetPlatform || getPlatform();
    const cmdConfig = buildInstallerCommand(platform);

    if (!cmdConfig) {
        sendSSE(userId, 'error', `Unsupported platform: ${platform}`);
        return;
    }

    sendSSE(userId, 'start', `Starting JARVIS setup for ${platform}...`);

    const proc = spawn(cmdConfig.cmd, cmdConfig.args, {
        cwd: JARVIS_ROOT,
        env: { ...process.env, JARVIS_HEADLESS: '1', TERM: 'xterm-256color' },
        shell: platform === 'windows',
        windowsHide: true,
    });

    proc.stdout?.on('data', (d) => {
        stripAnsi(d.toString()).trim().split('\n').filter(Boolean)
            .forEach(l => sendSSE(userId, 'log', l));
    });

    proc.stderr?.on('data', (d) => {
        stripAnsi(d.toString()).trim().split('\n').filter(Boolean)
            .forEach(l => sendSSE(userId, 'log', '[info] ' + l));
    });

    proc.on('close', (code) => {
        if (code === 0) sendSSE(userId, 'done', '✔ JARVIS installation complete!');
        else sendSSE(userId, 'error', `Setup exited with code ${code}.`);
    });

    proc.on('error', (e) => sendSSE(userId, 'error', 'Could not start installer: ' + e.message));
};

// ─── Windows bootstrap PS1 ─────────────────────────────
const ensureWindowsScript = () => {
    const dest = path.join(__dirname, 'jarvis_windows_setup.ps1');
    if (fs.existsSync(dest)) return;
    const root = JARVIS_ROOT.replace(/\\/g, '/');
    const script = [
        '# JARVIS Windows Setup — Developed by Balaraman',
        'Write-Host "[ JARVIS ] Starting Windows installer..." -ForegroundColor Cyan',
        '',
        'if (-not (Get-Command node -ErrorAction SilentlyContinue)) {',
        '  winget install -e --id OpenJS.NodeJS.LTS --silent',
        '}',
        '$wsl = Get-Command wsl -ErrorAction SilentlyContinue',
        'if ($wsl) {',
        '  wsl bash "' + root + '/jarvis.sh"',
        '} else {',
        '  npm install -g openclaw@latest 2>&1',
        '  Write-Host "Done! Run: openclaw onboard" -ForegroundColor Green',
        '}',
    ].join('\n');
    fs.writeFileSync(dest, script);
};

// ═══════════════════════════════════════════════════════
//  REMOTE ANDROID BRIDGE (MASTER/WORKER)
// ═══════════════════════════════════════════════════════
const remoteSessions = new Map(); // pairingCode -> { userId, deviceName, queue: [], lastActive: Date }
const userToCode = new Map();     // userId -> pairingCode

const addRemoteSession = (userId, code, deviceName) => {
    remoteSessions.set(code, { userId, deviceName, queue: [], lastActive: Date.now(), deviceLinked: false });
    userToCode.set(userId, code);
    // DO NOT send remote_linked SSE yet! 
    // We wait until the real device actually polls.
};

const getPendingCommand = (code) => {
    const session = remoteSessions.get(code);
    if (!session) return null;

    // This is called by the actual DEVICE
    session.lastActive = Date.now();

    // If this is the FIRST time the device polls, send the SSE event to the UI
    if (!session.deviceLinked) {
        session.deviceLinked = true;
        sendSSE(session.userId, 'remote_linked', { code, deviceName: session.deviceName });
    }

    const next = session.queue.shift();
    if (next) {
        console.log(`[JARVIS] Dispatching remote command to ${code} (Base64 encoded)`);
        return next;
    }

    return { type: 'idle' };
};

const getSessionStatus = (code) => {
    const session = remoteSessions.get(code);
    if (!session) return { exists: false };
    return {
        exists: true,
        deviceLinked: !!session.deviceLinked,
        lastActive: session.lastActive
    };
};

const pushRemoteCommand = (userId, payload) => {
    const code = userToCode.get(userId);
    const session = remoteSessions.get(code);
    if (!session) return false;

    // Ensure type is 'command'
    if (!payload.type) payload.type = 'command';

    // BASE64 ENCODE the command to avoid escaping issues in shell-based JSON parsing (sed)
    if (payload.command) {
        payload.b64 = Buffer.from(payload.command).toString('base64');
        delete payload.command; // Remove original to save bandwidth
    }

    session.queue.push(payload);
    console.log(`[JARVIS] Command queued for user ${userId} (session ${code})`);
    return true;
};

const handleRemoteReport = (code, report) => {
    const session = remoteSessions.get(code);
    if (!session) return;
    session.lastActive = Date.now();
    const { userId } = session;

    // REDUNDANT LINK DETECTION: 
    if (!session.deviceLinked) {
        session.deviceLinked = true;
        sendSSE(userId, 'remote_linked', { code, deviceName: session.deviceName });
        console.log(`[JARVIS] Remote device ${code} linked via report redundancy.`);
    }

    if (report.log) {
        process.stdout.write(`[RELOG:${code}] ${report.log.slice(0, 60)}...\r`);
        sendSSE(userId, 'remote_log', report.log);

        // AUTO-DETECT CHOICES from remote logs
        // This makes the Android bridge as smart as the local installer
        const line = stripAnsi(report.log).trim();
        if (CHOICE_REGEX.test(line)) {
            // Accumulate if needed, but for now just send individual choice items
            // Actually, the frontend choice logic expects the whole array.
            // Let's use a session-level buffer for choices.
            if (!session.choiceBuffer) session.choiceBuffer = [];
            const m = line.match(CHOICE_REGEX);
            session.choiceBuffer.push({ num: m[1], label: m[2].trim() });

            clearTimeout(session.choiceTimeout);
            session.choiceTimeout = setTimeout(() => {
                if (session.choiceBuffer.length >= 2) {
                    sendSSE(userId, 'remote_choice', { options: session.choiceBuffer });
                }
                session.choiceBuffer = [];
            }, 300);
        }
    }

    if (report.type && report.type !== 'log') {
        sendSSE(userId, 'remote_' + report.type, report.data);
    }
};

module.exports = {
    addSSEClient, removeSSEClient, sendSSE,
    runInstaller, getPlatform, ensureWindowsScript,
    runOnboard, sendOnboardInput, stopOnboard,
    addRemoteSession, getPendingCommand, pushRemoteCommand, handleRemoteReport
};
