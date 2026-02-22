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
        // Don't auto-select, just highlight
        document.getElementById(`card-${detected}`)?.style.setProperty('border-color', 'var(--cy2)');
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
    await fetch('/api/logout', { method: 'POST' });
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

// ─── Android Guide ─────────────────────────────────────
const ANDROID_STEPS = [
    {
        title: 'Step 1 — Install Termux',
        content: `
      <p style="margin-bottom:16px">Termux is a free terminal app for Android. Download it from the official source:</p>
      <a class="btn btn-gold" style="display:inline-flex;margin-bottom:16px" href="https://f-droid.org/en/packages/com.termux/" target="_blank">
        📥 Download Termux from F-Droid
      </a>
      <div class="alert alert-info show" style="margin:0">
        ⚠ Do <strong>not</strong> install Termux from the Play Store — it's outdated. Use F-Droid only.
      </div>
    `,
        action: 'Next →',
    },
    {
        title: 'Step 2 — Copy the JARVIS Install Command',
        content: `
      <p style="margin-bottom:16px">Open Termux and paste this one-line command (tap to copy):</p>
      <div style="display:flex;gap:10px;align-items:stretch">
        <code id="install-cmd" style="flex:1;background:#020b14;border:1px solid rgba(0,229,255,0.2);border-radius:8px;padding:14px;font-size:12px;font-family:monospace;color:#00e5ff;word-break:break-all;display:block;">
pkg update -y && pkg install -y curl git && curl -fsSL https://raw.githubusercontent.com/GITHUB_USER/JARVIS/main/jarvis.sh | bash
        </code>
        <button class="btn btn-outline" style="width:auto;padding:0 16px" onclick="copyCmd()">📋 Copy</button>
      </div>
      <p style="margin-top:16px;font-size:13px;color:var(--dim)">
        Or scan this QR code with your Android to open the command:
      </p>
      <div id="qr-container"></div>
    `,
        action: 'I pasted the command →',
    },
    {
        title: 'Step 3 — Watch JARVIS Install',
        content: `
      <p style="margin-bottom:16px">The installer will run automatically in Termux. It will:</p>
      <div class="chips">
        <span class="chip">✔ Install Ubuntu</span>
        <span class="chip">✔ Install Node.js</span>
        <span class="chip">✔ Install JARVIS AI</span>
        <span class="chip">✔ Install Instagram Bot</span>
        <span class="chip">✔ Set up WhatsApp, Telegram</span>
      </div>
      <p style="margin-top:20px;font-size:13px;color:var(--dim)">
        The installer takes about 5–10 minutes. When it's done, you'll see the JARVIS banner.
      </p>
      <div class="alert alert-info show" style="margin-top:16px">
        💡 After install, type <strong>jarvis onboard</strong> in Termux to connect WhatsApp, Telegram, and other platforms.
      </div>
    `,
        action: 'Done! →',
    },
    {
        title: '✅ JARVIS is Ready on Your Android!',
        content: `
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:60px;margin-bottom:16px">🤖</div>
        <h2 style="font-size:22px;margin-bottom:12px">Setup Complete!</h2>
        <p style="color:var(--dim);margin-bottom:24px">
          JARVIS is now installed on your Android. Open Termux anytime and type:
        </p>
        <code style="background:#020b14;padding:12px 24px;border-radius:8px;font-size:14px;color:var(--cy);display:inline-block">
          jarvis
        </code>
        <div class="chips" style="justify-content:center;margin-top:20px">
          <span class="chip">📱 Android ✔</span>
          <span class="chip">🤖 JARVIS AI ✔</span>
          <span class="chip">📸 Instagram Bot ✔</span>
        </div>
      </div>
    `,
        action: null,
    },
];

let androidStep = 0;
const startAndroidGuide = () => { androidStep = 0; renderAndroidStep(); };

const renderAndroidStep = () => {
    const step = ANDROID_STEPS[androidStep];
    const content = document.getElementById('android-step-content');
    const steps = ['astep-1', 'astep-2', 'astep-3', 'astep-4'];

    steps.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('done', i < androidStep);
        el.classList.toggle('active', i === androidStep);
    });

    content.innerHTML = `
    <h2 style="margin-bottom:16px">${step.title}</h2>
    ${step.content}
    ${step.action
            ? `<button class="btn btn-primary btn-block" style="margin-top:24px" onclick="nextAndroidStep()">${step.action}</button>`
            : ''}
  `;

    // Generate QR if step 2
    if (androidStep === 1) {
        const container = document.getElementById('qr-container');
        if (container && window.QRCode) {
            container.innerHTML = '';
            new QRCode(container, {
                text: document.getElementById('install-cmd')?.textContent?.trim(),
                width: 160, height: 160,
                colorDark: '#000', colorLight: '#fff',
            });
        }
    }
};

window.nextAndroidStep = () => {
    if (androidStep < ANDROID_STEPS.length - 1) {
        androidStep++;
        renderAndroidStep();
        if (androidStep === 3) markSetupDone('android');
    }
};

window.copyCmd = () => {
    const cmd = document.getElementById('install-cmd')?.textContent?.trim();
    navigator.clipboard.writeText(cmd).then(() => {
        showAlert('dash-alert', '📋 Command copied! Paste it in Termux.', 'success');
    });
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
            statusText.textContent = `PHASE ${stepMatch ? stepMatch[1] : '...'} · ${text.split('·')[1] || 'PROCESSING'}`;
        }
    }

    const cur = document.createElement('span');
    cur.className = 'cursor';
    container.appendChild(cur);
    term.scrollTop = term.scrollHeight;
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
    // This makes it feel like the UI is "auto-pasting" into the terminal
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

