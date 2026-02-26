'use strict';

const CHANNELS = [
    {
        id: 'whatsapp', name: 'WhatsApp', icon: '💬', cmd: 'openclaw channels login --channel whatsapp',
        desc: 'Link your WhatsApp number — JARVIS replies to your DMs',
        setupType: 'qr', docs: 'https://docs.openclaw.ai/channels/whatsapp'
    },
    {
        id: 'telegram', name: 'Telegram', icon: '✈️', cmd: 'openclaw channels login --channel telegram',
        desc: 'Connect a Telegram bot — anyone can message your JARVIS bot',
        setupType: 'token', tokenLabel: 'Bot Token from @BotFather', tokenKey: 'TELEGRAM_BOT_TOKEN',
        docs: 'https://docs.openclaw.ai/channels/telegram'
    },
    {
        id: 'slack', name: 'Slack', icon: '💼', cmd: 'openclaw channels login --channel slack',
        desc: 'Bring JARVIS into your Slack workspace',
        setupType: 'token', tokenLabel: 'Slack Bot Token (xoxb-...)', tokenKey: 'SLACK_BOT_TOKEN',
        docs: 'https://docs.openclaw.ai/channels/slack'
    },
    {
        id: 'discord', name: 'Discord', icon: '🎮', cmd: 'openclaw channels login --channel discord',
        desc: 'Run JARVIS as a Discord bot on your server',
        setupType: 'token', tokenLabel: 'Discord Bot Token', tokenKey: 'DISCORD_BOT_TOKEN',
        docs: 'https://docs.openclaw.ai/channels/discord'
    },
    {
        id: 'signal', name: 'Signal', icon: '🔒', cmd: 'openclaw channels login --channel signal',
        desc: 'Private and encrypted — JARVIS via Signal',
        setupType: 'info', info: 'Requires signal-cli to be installed on the device. Run: openclaw channels login --channel signal',
        docs: 'https://docs.openclaw.ai/channels/signal'
    },
    {
        id: 'webchat', name: 'WebChat', icon: '🌐', cmd: null,
        desc: 'Built-in chat at localhost:18789 — active when gateway is running',
        setupType: 'builtin', docs: 'https://docs.openclaw.ai/web/webchat'
    },
];

const SKILLS = [
    { id: 'github', name: 'GitHub', icon: '🐙', desc: 'Repos, PRs, issues' },
    { id: 'browser-automation', name: 'Browser', icon: '🖥️', desc: 'Web scraping & control' },
    { id: 'automation-workflows', name: 'Automation', icon: '⚙️', desc: 'Workflow builder' },
    { id: 'memory', name: 'Memory', icon: '🧠', desc: 'Long-term recall' },
    { id: 'file-manager', name: 'Files', icon: '📁', desc: 'File system access' },
    { id: 'agentmail', name: 'AgentMail', icon: '📧', desc: 'Email for agents' },
    { id: 'slack', name: 'Slack Skills', icon: '💼', desc: 'Slack operations' },
    { id: 'linear', name: 'Linear', icon: '📋', desc: 'Project management' },
];

let currentChannel = null;
let sseConn = null;

// ─── Render Channels ───────────────────────────────────
const renderChannels = () => {
    const grid = document.getElementById('channels-grid');
    grid.innerHTML = CHANNELS.map(ch => `
        <div class="channel-card" id="card-${ch.id}">
            <div class="channel-top">
                <div class="channel-info">
                    <div class="channel-logo">${ch.icon}</div>
                    <div>
                        <div class="channel-name">${ch.name}</div>
                        <div class="channel-desc">${ch.desc}</div>
                    </div>
                </div>
                <span class="badge badge-na" id="badge-${ch.id}">Off</span>
            </div>
            <div class="channel-actions">
                ${getActionButtons(ch)}
            </div>
        </div>
    `).join('');

    // Skills
    const sg = document.getElementById('skills-grid');
    sg.innerHTML = SKILLS.map(s => `
        <div class="skill-card">
            <div class="skill-icon">${s.icon}</div>
            <div>
                <div style="font-weight:600">${s.name}</div>
                <div class="skill-status">✔ Installed</div>
                <div style="font-size:11px;color:var(--dim)">${s.desc}</div>
            </div>
        </div>
    `).join('');
};

const getActionButtons = (ch) => {
    if (ch.setupType === 'builtin') {
        return `<span class="badge badge-online">Always Active</span>
                <a href="/control.html" class="btn btn-outline">Open Chat</a>`;
    }
    if (ch.setupType === 'qr') {
        return `<button class="btn btn-primary" onclick="linkWhatsApp()">📱 Link via QR</button>`;
    }
    if (ch.setupType === 'token') {
        return `<button class="btn btn-primary" onclick="openTokenModal('${ch.id}')">🔗 Link</button>
                <a href="${ch.docs}" target="_blank" class="btn btn-outline">Docs ↗</a>`;
    }
    if (ch.setupType === 'info') {
        return `<button class="btn btn-outline" onclick="showInfo('${ch.id}')">How to setup</button>`;
    }
    return '';
};

// ─── WhatsApp QR Flow ──────────────────────────────────
window.linkWhatsApp = async () => {
    document.getElementById('qr-modal').classList.add('open');
    document.getElementById('qr-area').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--dim)">⏳ Sending command to device...</div>`;
    document.getElementById('qr-log').textContent = 'Requesting QR from device...';

    // Send command to device via bridge
    try {
        const r = await fetch('/api/android/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'proot-distro login ubuntu -- openclaw channels login --channel whatsapp' })
        });
        const d = await r.json();
        if (!d.ok) {
            document.getElementById('qr-log').textContent = '❌ No device linked. Complete Android setup first.';
            return;
        }
    } catch (e) {
        document.getElementById('qr-log').textContent = '❌ Error: ' + e.message;
        return;
    }

    // Listen for QR code via SSE
    if (!sseConn) sseConn = new EventSource('/api/setup/sse');
    sseConn.onmessage = (e) => {
        try {
            const { type, data } = JSON.parse(e.data);
            if (type !== 'remote_log') return;
            const log = document.getElementById('qr-log');
            log.textContent += '\n' + data;
            log.scrollTop = log.scrollHeight;

            // Detect QR string (WhatsApp outputs a multi-line QR URL or a special marker)
            const qrMatch = data.match(/scan QR: ([\w\-/+=%.:]+)/i) ||
                data.match(/Scan this QR[\s\S]*(2@[\w\d+/=]+)/i) ||
                data.match(/qr:([\w\d+/=@,]+)/i) ||
                data.match(/(2@[A-Za-z0-9+/=,]{20,})/);
            if (qrMatch) {
                renderQR(qrMatch[1]);
            }
            // If WhatsApp session is established
            if (data.includes('WhatsApp connected') || data.includes('session established') || data.includes('Connection established')) {
                document.getElementById('badge-whatsapp').className = 'badge badge-online';
                document.getElementById('badge-whatsapp').textContent = 'Online';
                document.getElementById('card-whatsapp').classList.add('linked');
                document.getElementById('qr-area').innerHTML = '<div style="font-size:40px;margin:30px 0">✅</div><div style="color:var(--gr);font-weight:700">WhatsApp Connected!</div>';
            }
        } catch { }
    };
};

const renderQR = (data) => {
    const area = document.getElementById('qr-area');
    area.innerHTML = '<canvas id="qrcanvas"></canvas>';
    try {
        new QRCode(document.getElementById('qrcanvas'), {
            text: data, width: 200, height: 200,
            colorDark: '#000000', colorLight: '#ffffff',
        });
        area.innerHTML += '<div class="qr-hint">Open WhatsApp → Linked Devices → Link a Device → Scan</div>';
    } catch {
        area.innerHTML = `<div style="font-size:11px;font-family:monospace;word-break:break-all;color:var(--cy)">${data}</div>`;
    }
};

window.closeQrModal = () => {
    document.getElementById('qr-modal').classList.remove('open');
    if (sseConn) { sseConn.close(); sseConn = null; }
};

// ─── Token Modal ───────────────────────────────────────
window.openTokenModal = (channelId) => {
    currentChannel = CHANNELS.find(c => c.id === channelId);
    document.getElementById('modal-title').textContent = `Link ${currentChannel.name}`;
    document.getElementById('modal-desc').textContent = currentChannel.tokenLabel;
    document.getElementById('modal-token').value = '';
    document.getElementById('modal-token').placeholder = `Paste ${currentChannel.name} token here...`;
    document.getElementById('token-modal').classList.add('open');
};

window.closeModal = () => {
    document.getElementById('token-modal').classList.remove('open');
    currentChannel = null;
};

window.submitToken = async () => {
    const token = document.getElementById('modal-token').value.trim();
    if (!token || !currentChannel) return;

    const btn = document.getElementById('modal-submit');
    btn.disabled = true; btn.textContent = 'Connecting...';

    // Send the token as a config command to the device
    const configCmd = `proot-distro login ubuntu -- bash -c "openclaw config set channels.${currentChannel.id}.token ${token} && openclaw gateway --port 18789 &"`;
    try {
        await fetch('/api/android/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: configCmd })
        });
        document.getElementById(`badge-${currentChannel.id}`).className = 'badge badge-online';
        document.getElementById(`badge-${currentChannel.id}`).textContent = 'Online';
        document.getElementById(`card-${currentChannel.id}`).classList.add('linked');
    } catch { }

    btn.disabled = false; btn.textContent = 'Connect';
    closeModal();
};

window.showInfo = (channelId) => {
    const ch = CHANNELS.find(c => c.id === channelId);
    if (ch) alert(ch.info);
};

renderChannels();
