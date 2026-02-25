// ═══════════════════════════════════════════════════════
//  JARVIS Web Portal — Frontend SPA
//  Developed by Balaraman
// ═══════════════════════════════════════════════════════
'use strict';

// ─── Screen router ────────────────────────────────────
const screens = ['login', 'set-password', 'dashboard'];
let currentUser = null;

const showScreen = (name) => {
    screens.forEach(s => {
        document.getElementById(`screen-${s}`)?.classList.toggle('active', s === name);
    });
};

const showAlert = (id, msg, type = 'error') => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = `alert alert-${type} show`;
    setTimeout(() => el.classList.remove('show'), 5000);
};

// ─── URL param screen detection ────────────────────────
const getURLScreen = () => new URLSearchParams(location.search).get('screen');

// ─── Init: fetch current user ─────────────────────────
const init = async () => {
    // Handle URL params from OAuth redirect
    const urlScreen = getURLScreen();
    const urlError = new URLSearchParams(location.search).get('error');
    if (urlError) {
        showScreen('login');
        showAlert('login-alert', 'Google sign-in failed. Please try again.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/me');
        if (!res.ok) { showScreen('login'); return; }
        currentUser = await res.json();

        if (!currentUser.hasPassword) {
            showScreen('set-password');
        } else if (urlScreen === 'dashboard' || !urlScreen) {
            showScreen('dashboard');
            populateDashboard();
        } else {
            showScreen(urlScreen);
            if (urlScreen === 'dashboard') populateDashboard();
        }
    } catch {
        showScreen('login');
    }
};

// ─── Populate dashboard ────────────────────────────────
const populateDashboard = () => {
    if (!currentUser) return;
    document.getElementById('dash-name').textContent = currentUser.displayName?.split(' ')[0] || 'User';
    document.getElementById('dash-email').textContent = currentUser.email || '';
    const av = document.getElementById('dash-avatar');
    if (currentUser.avatar) {
        av.outerHTML = `<img src="${currentUser.avatar}" class="avatar" alt="avatar" id="dash-avatar" onerror="this.style.display='none'">`;
    } else {
        av.textContent = (currentUser.displayName || 'J')[0].toUpperCase();
    }

    // Auto-detect platform and pre-select
    fetch('/api/platform').then(r => r.json()).then(({ platform }) => {
        const map = { windows: 'windows', linux: 'linux', darwin: 'linux' };
        const detected = map[platform] || 'linux';

        // Highly visible highlighting for the detected platform
        const card = document.getElementById(`card-${detected}`);
        if (card) {
            card.style.borderColor = 'var(--cy2)';
            card.style.boxShadow = '0 0 20px rgba(0, 243, 255, 0.2)';
        }

        // AUTO-PILOT: If setup is not done, jump straight to the guide after a short delay
        if (!currentUser.setupDone) {
            setTimeout(() => {
                if (detected === 'windows') window.startPCGuide();
                else startAndroidGuide();
            }, 1000);
        }
    });
};

// ─── Login form ────────────────────────────────────────
document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass }),
        });
        const data = await res.json();

        if (!res.ok) {
            showAlert('login-alert', data.error || 'Invalid credentials', 'error');
            return;
        }

        currentUser = await fetch('/api/me').then(r => r.json());
        if (!currentUser.hasPassword) {
            showScreen('set-password');
        } else {
            showScreen('dashboard');
            populateDashboard();
        }
    } catch {
        showAlert('login-alert', 'Network error — is the server running?', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
});

// ─── Set password form ─────────────────────────────────
document.getElementById('form-set-password')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = document.getElementById('sp-pass').value;
    const confirm = document.getElementById('sp-confirm').value;
    const btn = document.getElementById('btn-sp');

    if (pass !== confirm) {
        showAlert('sp-alert', 'Passwords do not match', 'error');
        return;
    }
    if (pass.length < 6) {
        showAlert('sp-alert', 'Password must be at least 6 characters', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
        const res = await fetch('/api/set-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass }),
        });
        const data = await res.json();
        if (!res.ok) { showAlert('sp-alert', data.error, 'error'); return; }

        currentUser = await fetch('/api/me').then(r => r.json());
        showScreen('dashboard');
        populateDashboard();
    } catch {
        showAlert('sp-alert', 'Network error', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Set Password & Continue →';
    }
});

// ─── Logout ────────────────────────────────────────────
window.logout = async () => {
    // Both /auth/logout and /api/logout work, but /auth/logout is the standard passport route
    await fetch('/auth/logout', { method: 'POST' });
    currentUser = null;
    showScreen('login');
};

// ─── Platform selection ────────────────────────────────
let selectedPlatform = null;

window.selectPlatform = (platform) => {
    selectedPlatform = platform;
    ['android', 'windows', 'linux'].forEach(p =>
        document.getElementById(`card-${p}`)?.classList.toggle('selected', p === platform)
    );
    document.getElementById('setup-area').style.display = 'block';
    document.getElementById('guide-android').style.display = 'none';
    document.getElementById('guide-pc').style.display = 'none';

    if (platform === 'android') {
        document.getElementById('guide-android').style.display = 'block';
        startAndroidGuide();
    } else {
        document.getElementById('guide-pc').style.display = 'block';
        const titles = { windows: '🖥️ Windows PC Setup', linux: '🐧 Linux / Mac Setup' };
        document.getElementById('pc-title').textContent = titles[platform] || 'PC Setup';
    }

    document.getElementById('setup-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const TERMUX_PROXY_URL = '/api/proxy/termux';
let termuxDownloaded = false;

window.autoNextAndroid = () => {
    // Instant progress — no more dummy delays
    if (androidStep === 0) nextAndroidStep();
};

window.startAndroidDownload = () => {
    // Hidden / Deprecated in favor of Play Store logic
};

window.linkAndroidDevice = async () => {
    const codeDisplay = document.getElementById('pairing-code-display');
    const status = document.getElementById('link-status');

    // Mission Status Update
    document.getElementById('mission-state').textContent = 'PAIRING...';

    const res = await fetch('/api/android/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName: 'Android Mobile' })
    });

    const data = await res.json();
    if (data.ok) {
        // MUST connect to SSE to receive the 'remote_linked' event push!
        connectSSE('android');

        if (codeDisplay) {
            codeDisplay.textContent = data.pairingCode;
            codeDisplay.classList.add('pulse-gold');
        }

        // Update the copy-paste command
        const cmd = document.getElementById('link-cmd');
        if (cmd) {
            const host = window.location.origin;
            // Add a timestamp as a cache-buster
            const fullCmd = `export PORTAL_URL="${host}"; curl -fsSL ${host}/jarvis.sh?v=${Date.now()} | bash -s -- --bridge --code=${data.pairingCode}`;
            cmd.textContent = fullCmd;

            addTermLine(`[ JARVIS ] Generated pairing command for session ${data.pairingCode}`, 'sys');
            addTermLine(`[ JARVIS ] Awaiting connection from Android device...`, 'info');

            // AUTO-CLIPBOARD: Zero manual action required
            navigator.clipboard.writeText(fullCmd).then(() => {
                showAlert('dash-alert', '📋 Command Auto-Copied! Paste in Termux.', 'success');
            });
        }

        // Start polling for link confirmation to auto-advance
        if (pairingPoller) clearInterval(pairingPoller);
        pairingPoller = setInterval(async () => {
            // Add ui=true to distinguish browser check from device poll + cache buster
            const check = await fetch(`/api/android/poll/${data.pairingCode}?ui=true&t=${Date.now()}`);
            const state = await check.json();

            // Check if device is TRULY linked
            if (state.deviceLinked) {
                console.log('[JARVIS] Device link confirmed via polling intercept.');

                // Show the hidden status badge
                const statusEl = document.getElementById('remote-active-status');
                if (statusEl) statusEl.style.display = 'block';

                // ENABLE THE BUTTON (Fallback)
                const btnNext = document.getElementById('btn-android-next');
                if (btnNext) {
                    btnNext.disabled = false;
                    btnNext.style.opacity = '1';
                    btnNext.style.background = 'var(--gr)';
                    btnNext.style.cursor = 'pointer';
                    btnNext.innerHTML = '⚡ LINKED! CONTINUE →';
                }

                // AUTO-ADVANCE: Jump straight to the mission logs
                if (androidStep === 1) {
                    addTermLine('[ JARVIS ] Neural link synchronized. Advancing...', 'hd');
                    setTimeout(() => nextAndroidStep(), 1500);
                }
                clearInterval(pairingPoller);
            }
        }, 1500); // Faster polling (1.5s) for instant response
    }
};

window.launchTermux = () => {
    const cmd = document.getElementById('link-cmd')?.textContent?.trim();
    if (!cmd || cmd.includes('GENERATING')) return;

    // Termux Intent URI pattern
    const intent = `intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;component=com.termux/.TermuxActivity;end`;

    // Copy to clipboard first
    navigator.clipboard.writeText(cmd).then(() => {
        showAlert('dash-alert', '📋 Command Auto-Copied! Opening Termux...', 'success');
        // Slight delay to allow alert to be seen
        setTimeout(() => {
            window.location.href = intent;
        }, 600);
    });
};

window.runRemoteSetup = async () => {
    const btn = document.getElementById('btn-remote-setup');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> AUTO-EXECUTING...';
    }

    // Combined One-Shot Installation Script (Optimized for Bridge)
    const oneShot = `pkg update -y && pkg upgrade -y && pkg install proot-distro -y && proot-distro install ubuntu && proot-distro login ubuntu -- bash -c "apt update -y && apt upgrade -y && apt install -y curl git build-essential ca-certificates && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs && npm install -g openclaw@latest && echo \\"const os = require('os'); os.networkInterfaces = () => ({});\\" > /root/hijack.js && echo 'export NODE_OPTIONS=\\"--require /root/hijack.js\\"' >> ~/.bashrc && source ~/.bashrc && openclaw onboard"`;

    // Start background mission with cache buster
    try {
        const res = await fetch(`/api/android/command?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: oneShot })
        });
        const d = await res.json();
        if (!d.ok) {
            addAndroidTermLine('⚠ CRITICAL: Bridge link lost. Please return to Step 2 and re-link.', 'err');
            return;
        }
    } catch (e) {
        addAndroidTermLine('⚠ Connection error: ' + e.message, 'err');
        return;
    }

    // Advance to Mission Control Step if not already there
    if (androidStep === 1) nextAndroidStep();
    addAndroidTermLine('[ MISSION CONTROL ] One-Shot Engine Deployment Initiated...', 'sys');
    addAndroidTermLine('[ JARVIS ] Provisioning Ubuntu subsystem & dependencies...', 'info');
};

window.submitAndroidAnswer = async () => {
    const input = document.getElementById('android-answer');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    // Don't hide input area yet, as multiple questions might come
    // document.getElementById('android-input-area').style.display = 'none';

    addAndroidTermLine('⟫ ' + text, 'hd');

    // Send back to remote device
    await fetch('/api/android/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: text })
    });
};

window.submitAndroidChoice = async (num, label) => {
    addAndroidTermLine('⟫ ' + label, 'hd');
    document.getElementById('android-choices').style.display = 'none';

    // Send back to remote device
    await fetch('/api/android/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: num })
    });
};

// ─── Android Guide ─────────────────────────────────────
let pairingPoller = null;

const ANDROID_STEPS = [
    {
        title: 'Step 1 — Install Termux',
        content: `
      <p style="margin-bottom:16px">Install Termux on your Android device to power JARVIS.</p>
      
      <div style="display:flex;justify-content:center;margin-bottom:16px">
        <a href="https://play.google.com/store/apps/details?id=com.termux" target="_blank" class="btn btn-gold" style="text-decoration:none;display:flex;flex-direction:column;align-items:center;padding:16px 40px;width:auto" onclick="autoNextAndroid()">
            <span style="font-size:24px;margin-bottom:8px">🏪</span>
            <span style="font-size:13px;font-weight:bold">Install from Play Store</span>
        </a>
      </div>

      <div class="alert alert-info show" style="margin-top:16px;font-size:12px">
        <span>💡 <strong>Tip</strong>: Click the button to open Play Store. Once installed, JARVIS will automatically move to the next step.</span>
      </div>
    `,
        action: 'Next →',
    },
    {
        title: 'Step 2 — Pair & Deploy',
        content: `
      <p style="margin-bottom:16px">Pairing code generated. Open Termux and <strong>Paste</strong> the command below.</p>
      
      <div id="link-area" style="text-align:center;margin-bottom:20px">
          <div id="link-status" style="background:rgba(255,255,255,0.02);padding:24px;border-radius:12px;border:1px dashed var(--cy)">
              <div style="font-size:11px;color:var(--dim);margin-bottom:12px;letter-spacing:1px">DEVICE PAIRING CODE</div>
              <div id="pairing-code-display" style="font-size:42px;font-weight:bold;letter-spacing:8px;color:var(--cy);margin-bottom:20px;text-shadow:0 0 20px rgba(0,229,255,0.3)">------</div>
              
              <div style="margin-bottom:16px;background:#000;padding:12px;border-radius:8px;border:1px solid rgba(0,229,255,0.2)">
                <div style="text-align:left;font-size:10px;color:var(--dim);margin-bottom:8px">COPY THIS COMMAND:</div>
                <code id="link-cmd" style="display:block;color:var(--cy);font-family:monospace;word-break:break-all;font-size:11px;line-height:1.4">--- GENERATING ---</code>
              </div>

              <div style="margin-top:20px;display:flex;flex-direction:column;gap:10px">
                <button class="btn btn-gold btn-block" id="btn-launch-termux" onclick="launchTermux()" style="margin:0;padding:14px">
                  ⚡ AUTO-LAUNCH TERMUX
                </button>
                <div style="font-size:9px;color:var(--dim)">Copies command & Opens Termux app</div>
              </div>
              
              <div id="remote-active-status" style="display:none;color:var(--gr);font-size:12px;font-weight:600;animation:pulse 2s infinite;margin-top:12px">
                ⚡ LINK ESTABLISHED — INITIALIZING ENGINE...
              </div>
          </div>
      </div>
      <p style="font-size:12px;color:var(--dim);text-align:center">
        Paste the command in Termux and press <b>Enter</b>.<br>
        JARVIS will automatically move to the next step once linked.
      </p>
    `,
        action: 'Awaiting Termux Link...',
        disabled: true, // Disable manual skip
        onEnter: () => {
            linkAndroidDevice();
        }
    },
    {
        title: 'Step 3 — Mission Control',
        content: `
      <p style="margin-bottom:16px">The JARVIS engine is deploying via One-Shot Installer. Follow the logs below.</p>
      
      <!-- Terminal is now visible in the main UI wrapper -->

      <div id="android-input-area" style="display:none;background:rgba(0,243,255,0.05);padding:12px;border-radius:8px;border:1px solid var(--cy2);margin-top:10px">
        <div style="font-size:11px;color:var(--cy);margin-bottom:8px">SYSTEM PROMPT: <span id="android-prompt-text">---</span></div>
        <div style="display:flex;gap:8px">
          <input type="text" id="android-answer" placeholder="Type answer..." style="flex:1;background:#000;border:1px solid var(--cy2);color:#fff;padding:8px;border-radius:4px" />
          <button class="btn btn-primary" style="width:auto;padding:0 15px" onclick="submitAndroidAnswer()">SEND</button>
        </div>
      </div>

      <p style="margin-top:20px;font-size:12px;color:var(--dim)">
        ⚡ DO NOT CLOSE THIS PAGE. Deployment takes 2-5 minutes depending on your internet.
      </p>
    `,
        action: 'Finish Deployment →',
        disabled: true, // LOCKED until deployment finishes
        onEnter: () => {
            document.getElementById('android-terminal').parentElement.style.display = 'block';
            runRemoteSetup();
        }
    },
    {
        title: '✅ JARVIS is Ready!',
        content: `
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:60px;margin-bottom:16px">🤖</div>
        <h2 style="font-size:22px;margin-bottom:12px">Setup Complete!</h2>
        <p style="color:var(--dim);margin-bottom:24px">
          JARVIS is now active in your Termux Ubuntu environment.
        </p>
        <code style="background:#020b14;padding:12px 24px;border-radius:8px;font-size:14px;color:var(--cy);display:inline-block;border:1px solid var(--cy)">
          jarvis
        </code>
      </div>
    `,
        action: null,
        onEnter: () => {
            // Hide terminal on success? Or keep it? The user likes it, so keep it.
        }
    },
];

let androidStep = 0;

window.nextAndroidStep = () => {
    androidStep++;
    renderAndroidStep();
};

const renderAndroidStep = () => {
    const step = ANDROID_STEPS[androidStep];
    if (!step) return;

    // Mission Status Update
    const missionBar = document.getElementById('mission-status');
    const missionState = document.getElementById('mission-state');
    if (missionBar && missionState) {
        missionBar.style.display = 'flex';
        missionState.textContent = step.title.split('—')[1]?.trim() || step.title;
        if (androidStep === 3) {
            document.getElementById('mission-blink').classList.remove('pulse-gold');
            document.getElementById('mission-blink').style.background = 'var(--gr)';
            missionState.textContent = 'MISSION COMPLETE';
        }
    }

    // Reset wizard UI
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`astep-${i}`);
        if (el) {
            el.classList.toggle('active', i === androidStep + 1);
            el.classList.toggle('completed', i < androidStep + 1);
        }
    }

    const content = document.getElementById('android-step-content');
    content.innerHTML = `
    <h3 style="margin-bottom:12px">${step.title}</h3>
    ${step.content}
    ${step.action ? `
      <div style="margin-top:24px;display:flex;justify-content:flex-end">
        <button class="btn btn-primary" id="btn-android-next" ${step.disabled ? 'disabled style="opacity:0.6;background:var(--dim);cursor:not-allowed"' : ''} onclick="nextAndroidStep()">
          ${step.action}
        </button>
      </div>
    ` : ''}
  `;

    // Trigger auto-steps if any
    if (step.onEnter) step.onEnter();

    // Mark setup done if we reached the end
    if (androidStep === 3) markSetupDone('android');
};

window.startAndroidGuide = () => {
    selectedPlatform = 'android';
    // If we're already linked (e.g. page reload), we can potentially skip or show status
    // For now, reset to 0 but if we find linking in progress we could jump
    androidStep = 0;
    renderAndroidStep();

    // Check if a link already exists
    fetch('/api/android/poll/check').then(r => r.json()).then(data => {
        // Only jump if a code exists AND it's truly linked to a device
        if (data.linked && androidStep < 2) {
            // Final verification that device is actually active using the ui flag
            fetch(`/api/android/poll/${data.code}?ui=true`).then(r => r.json()).then(status => {
                if (status.deviceLinked) {
                    console.log('[JARVIS] Device linked. Jumping to mission control.');
                    androidStep = 2; // Jump to Mission Control
                    renderAndroidStep();
                }
            });
        }
    }).catch(() => { });
};

window.copyCmd = () => {
    const cmd = document.getElementById('link-cmd')?.textContent?.trim() ||
        document.getElementById('install-cmd')?.textContent?.trim();
    if (cmd) {
        navigator.clipboard.writeText(cmd).then(() => {
            showAlert('dash-alert', '📋 Command copied! Paste it in Termux.', 'success');
        });
    }
};

// ─── PC Installer ──────────────────────────────────────
let sseConnected = false;

window.runPCInstall = async () => {
    const btn = document.getElementById('btn-install-pc');
    const terminal = document.getElementById('terminal');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;margin:0"></span> Orchestrating...';

    // Scroll to terminal
    terminal.scrollIntoView({ behavior: 'smooth', block: 'center' });

    addTermLine('[ JARVIS ] Booting Installation Engine...', 'sys');
    addTermLine('[ JARVIS ] Establishing Secure Bridge...', 'sys');

    // Open SSE connection first
    if (!sseConnected) {
        connectSSE();
        sseConnected = true;
    }

    try {
        const res = await fetch('/api/setup/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetPlatform: selectedPlatform }),
        });
        const data = await res.json();

        if (!res.ok) {
            addTermLine('ERROR: ' + (data.error || 'Bridge Deployment Failed'), 'err');
            btn.disabled = false;
            btn.textContent = '⚡ Retry Installation';
            document.getElementById('install-status').style.display = 'none';
        } else {
            addTermLine('[ JARVIS ] Local setup sequence initiated.', 'sys');
            addTermLine('[ JARVIS ] Streaming live logs from node process...', 'info');
            document.getElementById('btn-install-pc').style.display = 'none';
            document.getElementById('btn-auth-only').style.display = 'none';
            document.getElementById('install-status').style.display = 'flex';
            document.getElementById('install-status-text').textContent = 'BOOTING ENGINE...';
        }
    } catch (e) {
        addTermLine('CRITICAL ERROR: ' + e.message, 'err');
        btn.disabled = false;
        btn.textContent = '⚡ Retry Installation';
    }
};

// ─── Terminal Helper ───────────────────────────────────
const addTermLine = (text, cls = 'ok') => {
    const container = document.getElementById('terminal-lines');
    const term = document.getElementById('terminal');
    if (!container) return; // Silent fail if container doesn't exist
    const cursor = container.querySelector('.cursor');
    cursor?.remove();

    const line = document.createElement('div');
    line.className = `t-line t-${cls}`;
    const icons = { ok: '✔ ', err: '✘ ', hd: '⟫ ', sys: '◆ ', info: '' };
    line.textContent = (icons[cls] || '') + text;
    container.appendChild(line);

    // Update status badge if STEP is detected
    if (text.includes('STEP')) {
        const stepMatch = text.match(/STEP (\d+)/i);
        const statusText = document.getElementById('install-status-text');
        if (statusText) {
            statusText.textContent = `PHASE ${stepMatch ? stepMatch[1] : '...'} · ${text.split('·')[1] || 'PROCESSING'} `;
        }
    }

    const cur = document.createElement('span');
    cur.className = 'cursor';
    container.appendChild(cur);
    term.scrollTop = term.scrollHeight;
};

// ─── Android Terminal Helper ───────────────────────────
const addAndroidTermLine = (text, cls = 'ok') => {
    const container = document.getElementById('android-terminal-lines');
    const term = document.getElementById('android-terminal');
    if (!container) return;

    const line = document.createElement('div');
    line.className = `t-line t-${cls}`;
    const icons = { ok: '✔ ', err: '✘ ', hd: '⟫ ', sys: '◆ ', info: '' };
    line.textContent = (icons[cls] || '') + text;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
};

// ─── Mark setup done ───────────────────────────────────
const markSetupDone = async (platform) => {
    try {
        await fetch('/api/setup/done', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform }),
        });
        if (currentUser) currentUser.setupDone = true;
    } catch { }
};

// ═══════════════════════════════════════════════════════
//  ONBOARDING WIZARD
// ═══════════════════════════════════════════════════════

// AI provider icon mapping
const AI_ICONS = {
    google: '🌐', openai: '🧠', gpt: '🧠', 'gpt-4': '🧠',
    qwen: '🐉', anthropic: '🧩', claude: '🧩',
    gemini: '♊', ollama: '🦙', mistral: '🌪️', azure: '☁️',
    groq: '⚡', cohere: '🔮', together: '🤝',
    quickstart: '🚀', manual: '⚙️', skip: '⏭️', yes: '✔', no: '✖',
    whatsapp: '💬', telegram: '✈️', discord: '🎮',
    slack: '💼', 'google chat': '💬', line: '📱',
    gmail: '📧', calendar: '📅', drive: '📁',
    daemon: '⚙️', background: '⚙️',
};

const getChoiceIcon = (label) => {
    const l = label.toLowerCase();
    for (const [key, icon] of Object.entries(AI_ICONS)) {
        if (l.includes(key)) return icon;
    }
    return '◉';
};

// Detect if a prompt is asking for a secret (API key / password / token)
const isSecretPrompt = (text) => {
    const l = text.toLowerCase();
    return ['key', 'token', 'secret', 'password', 'pass', 'credential'].some(k => l.includes(k));
};

// ─── Onboard terminal output ───────────────────────────
const addOnboardLine = (text, cls = 'ok') => {
    const lines = document.getElementById('onboard-lines');
    const term = document.getElementById('onboard-terminal');
    const line = document.createElement('div');
    line.className = `t-line t-${cls}`;
    line.textContent = text;
    lines.appendChild(line);
    term.scrollTop = term.scrollHeight;
};

// ─── Show prompt input ─────────────────────────────────
const showPrompt = (question) => {
    hideChoices();
    const box = document.getElementById('onboard-prompt-box');
    const qEl = document.getElementById('onboard-question');
    const input = document.getElementById('onboard-answer');

    qEl.textContent = question;
    box.classList.add('visible');

    // If it's a secret, mask the input
    if (isSecretPrompt(question)) {
        input.type = 'password';
        input.placeholder = 'Paste your API key / token here...';
        input.className = 'secret';
    } else {
        input.type = 'text';
        input.placeholder = 'Type your answer here...';
        input.className = '';
    }

    input.value = '';
    setTimeout(() => input.focus(), 100);
};

const hidePrompt = () => {
    document.getElementById('onboard-prompt-box').classList.remove('visible');
};

// ─── Show choice cards ─────────────────────────────────
let pendingChoiceQuestion = '';

const showChoices = (options, question) => {
    hidePrompt();
    document.getElementById('choice-question-label').textContent = question || 'Choose an option:';
    const grid = document.getElementById('choice-grid');
    grid.innerHTML = '';

    options.forEach(({ num, label }) => {
        const card = document.createElement('div');
        card.className = 'choice-card';
        card.id = `choice-${num}`;
        card.innerHTML = `
            <div class="choice-num">Option ${num}</div>
            <div class="choice-icon">${getChoiceIcon(label)}</div>
            <div class="choice-label">${label}</div>
        `;
        card.onclick = () => selectChoice(num, label, card);
        grid.appendChild(card);
    });

    document.getElementById('onboard-choices').classList.add('visible');
};

const hideChoices = () => {
    document.getElementById('onboard-choices').classList.remove('visible');
};

const selectChoice = async (num, label, cardEl) => {
    if (piping) return;

    // Visual feedback
    document.querySelectorAll('.choice-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');

    hideChoices();
    hidePrompt();

    // ─── Simulated Typing Effect ───
    const terminalLines = document.getElementById('onboard-lines');
    const inputLine = document.createElement('div');
    inputLine.className = 't-line t-sys';
    inputLine.innerHTML = `<span style="opacity:0.6">▶ </span><span class="typing-text"></span><span class="cursor" style="height:12px;width:6px"></span>`;
    terminalLines.appendChild(inputLine);

    const typingSpan = inputLine.querySelector('.typing-text');
    const textToType = label; // We show the label but send the number

    for (let i = 0; i <= textToType.length; i++) {
        typingSpan.textContent = textToType.slice(0, i);
        await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
    }
    inputLine.querySelector('.cursor').remove();
    // ──────────────────────────────

    // Send the number to the process stdin
    piping = true;
    try {
        const res = await fetch('/api/onboard/input', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: num }),
        });
        const d = await res.json();
        if (!d.ok) showOnboardError(d.error || 'Automation Bridge Interrupted');
    } catch (e) {
        showOnboardError('Network link lost: ' + e.message);
    } finally {
        piping = false;
    }
};

let piping = false;

// ─── Submit text answer ────────────────────────────────
window.submitOnboardAnswer = async () => {
    const input = document.getElementById('onboard-answer');
    const text = input.value.trim();
    if (!text || piping) { input.focus(); return; }

    const btn = document.getElementById('btn-onboard-submit');
    btn.disabled = true;

    // ─── Simulated Typing Effect ───
    const terminalLines = document.getElementById('onboard-lines');
    const inputLine = document.createElement('div');
    inputLine.className = 't-line t-sys';

    // Mask secrets in terminal
    const isSecret = isSecretPrompt(document.getElementById('onboard-question').textContent || '');
    const displayText = isSecret ? '••••••••' : text;

    inputLine.innerHTML = `<span style="opacity:0.6">▶ </span><span class="typing-text"></span><span class="cursor" style="height:12px;width:6px"></span>`;
    terminalLines.appendChild(inputLine);

    const typingSpan = inputLine.querySelector('.typing-text');
    for (let i = 0; i <= displayText.length; i++) {
        typingSpan.textContent = displayText.slice(0, i);
        // Type faster for manual text
        await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
    }
    inputLine.querySelector('.cursor').remove();
    // ──────────────────────────────

    hidePrompt();
    hideChoices();

    piping = true;
    try {
        const res = await fetch('/api/onboard/input', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (!data.ok) showOnboardError(data.error || 'Automation bridge pipe broken');
    } catch (e) {
        showOnboardError('Network link lost: ' + e.message);
    } finally {
        piping = false;
        btn.disabled = false;
        input.value = '';
    }
};

const showOnboardError = (msg) => {
    document.getElementById('onboard-error-msg').textContent = msg;
    document.getElementById('onboard-error-banner').classList.add('visible');
};

window.hideOnboardError = () => {
    document.getElementById('onboard-error-banner').classList.remove('visible');
};

window.restartOnboarding = async () => {
    try { await fetch('/api/onboard/stop', { method: 'POST' }); } catch { }
    document.getElementById('onboard-lines').innerHTML = '<div class="t-line t-sys">◆ Restarting wizard...</div>';
    document.getElementById('onboard-error-banner').classList.remove('visible');
    document.getElementById('onboard-success').classList.remove('visible');
    hidePrompt();
    hideChoices();
    setTimeout(() => startOnboarding(), 300);
};

// ─── SSE connection ────────────────────────────────────
let globalSSE = null;
let lastChoiceOptions = [];
let lastOnboardLogLine = ''; // for context when a prompt arrives

const connectSSE = (mode = 'setup') => {
    if (globalSSE) { try { globalSSE.close(); } catch { } }
    globalSSE = new EventSource('/api/setup/sse');

    globalSSE.onmessage = (e) => {
        let payload;
        try { payload = JSON.parse(e.data); } catch { return; }
        const { type, data } = payload;

        switch (type) {
            // ── Installer events (during jarvis.sh) ──
            case 'log': addTermLine(data, 'ok'); break;
            case 'error': addTermLine(data, 'err'); break;
            case 'start': addTermLine(data, 'hd'); break;
            case 'done':
                addTermLine(data, 'ok');
                addTermLine('[ JARVIS ] System Installed Successfully.', 'hd');
                addTermLine('[ JARVIS ] Auto-transitioning to Setup Wizard in 3s...', 'sys');

                document.getElementById('install-done-banner').style.display = 'block';
                document.getElementById('btn-install-pc').style.display = 'none';
                markSetupDone(selectedPlatform);

                // One-click automation: Auto-start wizard
                setTimeout(() => startOnboarding(), 3000);
                globalSSE.close();
                globalSSE = null;
                break;

            // ── Onboarding events ──
            case 'onboard_start':
                addOnboardLine('◆ ' + data, 'sys');
                break;

            case 'onboard_line':
                addOnboardLine(data, 'ok');
                lastOnboardLogLine = data;
                break;

            case 'remote_linked': {
                const status = document.getElementById('remote-active-status');
                if (status) status.style.display = 'block';
                addTermLine(`[BRIDGE] Remote device linked: ${data.deviceName} `, 'sys');

                // ENABLE THE BUTTON (Fallback)
                const btnNext = document.getElementById('btn-android-next');
                if (btnNext) {
                    btnNext.disabled = false;
                    btnNext.style.opacity = '1';
                    btnNext.style.background = 'var(--gr)';
                    btnNext.style.cursor = 'pointer';
                    btnNext.innerHTML = '⚡ LINKED! CONTINUE →';
                }

                // AUTO-ADVANCE: Instant transition to Step 3
                if (androidStep === 1) {
                    addTermLine('[ JARVIS ] Neural link synchronized. Advancing...', 'hd');
                    setTimeout(() => nextAndroidStep(), 800);
                }
                break;
            }
            case 'remote_log':
                // addTermLine(`[REMOTE] ${data} `, 'info');
                // Also add to Android terminal if active
                if (androidStep === 2) {
                    addAndroidTermLine(data, 'info');

                    // COMPLETION SIGNAL: If we see this, enable the Finish button
                    if (data.includes('MISSION SEQUENCE COMPLETE') || data.includes('SETUP COMPLETE')) {
                        console.log('[JARVIS] Mission complete signal received.');
                        const btnNext = document.getElementById('btn-android-next');
                        if (btnNext) {
                            btnNext.disabled = false;
                            btnNext.style.opacity = '1';
                            btnNext.style.background = 'var(--gr)';
                            btnNext.style.cursor = 'pointer';
                            btnNext.innerHTML = '✅ DEPLOYMENT COMPLETE →';
                        }
                        addAndroidTermLine('[ JARVIS ] System is now fully mission-capable.', 'ok');
                    }
                }
                break;
            case 'remote_prompt':
                // Show prompt in Android UI
                if (androidStep === 2) {
                    const area = document.getElementById('android-input-area');
                    const text = document.getElementById('android-prompt-text');
                    const input = document.getElementById('android-answer');
                    const choiceArea = document.getElementById('android-choices');
                    if (area && text && input) {
                        // If choices were just shown (and not yet used), the prompt accompanies them
                        area.style.display = 'block';
                        text.textContent = data;
                        setTimeout(() => input.focus(), 100);

                        // If we have a prompt and choices, update the choice label
                        if (choiceArea && choiceArea.style.display === 'block') {
                            const lbl = document.getElementById('android-choice-label');
                            if (lbl) lbl.textContent = data.toUpperCase();
                        }
                    }
                }
                break;

            case 'remote_choice': {
                const { options } = data;
                if (androidStep === 2) {
                    const choiceArea = document.getElementById('android-choices');
                    const grid = document.getElementById('android-choice-grid');
                    if (choiceArea && grid) {
                        grid.innerHTML = '';
                        options.forEach(opt => {
                            const card = document.createElement('div');
                            card.className = 'choice-card';
                            card.innerHTML = `
                                <div class="choice-num">Option ${opt.num}</div>
                                <div class="choice-icon">${getChoiceIcon(opt.label)}</div>
                                <div class="choice-label">${opt.label}</div>
                            `;
                            card.onclick = () => submitAndroidChoice(opt.num, opt.label);
                            grid.appendChild(card);
                        });
                        choiceArea.style.display = 'block';
                        // Keep input area visible too just in case
                        document.getElementById('android-input-area').style.display = 'block';
                    }
                }
                break;
            }

            case 'onboard_error_line':
                addOnboardLine('⚠ ' + data, 'warn');
                showOnboardError(data);
                break;

            case 'choice': {
                const { options } = data;
                lastChoiceOptions = options;
                const q = lastOnboardLogLine || 'Choose an option:';
                showChoices(options, q);
                break;
            }

            case 'onboard_prompt': {
                const promptText = data;
                lastOnboardLogLine = promptText;
                if (lastChoiceOptions.length) {
                    showChoices(lastChoiceOptions, promptText);
                    lastChoiceOptions = [];
                } else {
                    showPrompt(promptText);
                }
                break;
            }

            case 'onboard_done':
                addOnboardLine('✔ ' + data, 'ok');
                hidePrompt();
                hideChoices();
                document.getElementById('onboard-success').classList.add('visible');
                markSetupDone(selectedPlatform);
                break;

            case 'onboard_failed':
            case 'onboard_error':
                addOnboardLine('✘ ' + (data.message || data), 'err');
                hidePrompt();
                hideChoices();
                showOnboardError(data.message || data);
                break;
        }
    };

    globalSSE.onerror = () => {
        if (mode === 'setup') addTermLine('[info] Synchronizing with installer...', 'info');
    };
};

// ─── Start onboarding ──────────────────────────────────
window.startOnboarding = async () => {
    // Show the onboard guide
    document.getElementById('guide-pc').style.display = 'none';
    document.getElementById('guide-android').style.display = 'none';
    document.getElementById('guide-onboard').style.display = 'block';

    // Reset state
    document.getElementById('onboard-lines').innerHTML = '<div class="t-line t-sys">◆ Starting JARVIS Setup Wizard...</div>';
    document.getElementById('onboard-error-banner').classList.remove('visible');
    document.getElementById('onboard-success').classList.remove('visible');
    hidePrompt();
    hideChoices();
    lastChoiceOptions = [];
    lastOnboardLogLine = '';

    // Connect SSE first
    connectSSE('onboard');

    // Trigger the process
    try {
        const res = await fetch('/api/onboard/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: selectedPlatform }),
        });
        const data = await res.json();
        if (!data.ok) showOnboardError(data.error || 'Could not start wizard');
    } catch (e) {
        showOnboardError('Network error: ' + e.message);
    }

    document.getElementById('guide-onboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ─── Patch: hide onboard guide when selecting platform ─
const _origSelectPlatform = window.selectPlatform;
window.selectPlatform = (platform) => {
    document.getElementById('guide-onboard').style.display = 'none';
    _origSelectPlatform(platform);
};

// ─── Boot ─────────────────────────────────────────────
init();

