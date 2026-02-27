'use strict';

const CHANNELS = [
    {
        id: 'whatsapp', name: 'WhatsApp', icon: '💬',
        desc: 'Link your WhatsApp number — JARVIS replies to your DMs',
        setupType: 'qr', docs: 'https://docs.openclaw.ai/channels/whatsapp'
    },
    {
        id: 'telegram', name: 'Telegram', icon: '✈️',
        desc: 'Connect a Telegram bot — anyone can message your JARVIS bot',
        setupType: 'token', tokenLabel: 'Bot Token from @BotFather',
        docs: 'https://docs.openclaw.ai/channels/telegram'
    },
    {
        id: 'slack', name: 'Slack', icon: '💼',
        desc: 'Bring JARVIS into your Slack workspace',
        setupType: 'token', tokenLabel: 'Slack Bot Token (xoxb-...)',
        docs: 'https://docs.openclaw.ai/channels/slack'
    },
    {
        id: 'discord', name: 'Discord', icon: '🎮',
        desc: 'Run JARVIS as a Discord bot on your server',
        setupType: 'token', tokenLabel: 'Discord Bot Token',
        docs: 'https://docs.openclaw.ai/channels/discord'
    },
    {
        id: 'signal', name: 'Signal', icon: '🔒',
        desc: 'Private and encrypted — JARVIS via Signal',
        setupType: 'info', info: 'Requires signal-cli on the device. Run: openclaw channels login --channel signal',
        docs: 'https://docs.openclaw.ai/channels/signal'
    },
    {
        id: 'webchat', name: 'WebChat', icon: '🌐',
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
// channelId → 'linked' | 'offline'
let channelStatus = {};

// ─── Load real statuses from DB ───────────────────────
const loadChannelStatus = async () => {
    try {
        const res = await fetch('/api/channels/list');
        const d = await res.json();
        if (d.ok) channelStatus = d.channels || {};
    } catch { }
    renderChannels();
};

// ─── Check gateway status ─────────────────────────────
const checkGateway = async () => {
    const el = document.getElementById('gateway-status');
    if (!el) return;
    try {
        const res = await fetch('/api/gateway/status');
        const d = await res.json();
        if (d.online) {
            el.className = 'gateway-badge gateway-online';
            el.textContent = '⚡ Gateway: Online';
        } else {
            el.className = 'gateway-badge gateway-offline';
            el.textContent = '⭘ Gateway: Offline';
        }
    } catch {
        el.className = 'gateway-badge gateway-offline';
        el.textContent = '⭘ Gateway: Unreachable';
    }
};

// ─── Render Channels ───────────────────────────────────
const renderChannels = () => {
    const grid = document.getElementById('channels-grid');
    grid.innerHTML = CHANNELS.map(ch => {
        const status = channelStatus[ch.id]; // 'linked' or undefined
        const isLinked = status === 'linked';
        const cardClass = isLinked ? 'channel-card linked' : 'channel-card';
        const badgeClass = isLinked ? 'badge badge-online' : 'badge badge-na';
        const badgeText = isLinked ? 'Online' : 'Off';
        return `
        <div class="${cardClass}" id="card-${ch.id}">
            <div class="channel-top">
                <div class="channel-info">
                    <div class="channel-logo">${ch.icon}</div>
                    <div>
                        <div class="channel-name">${ch.name}</div>
                        <div class="channel-desc">${ch.desc}</div>
                    </div>
                </div>
                <span class="badge ${badgeClass}" id="badge-${ch.id}">${badgeText}</span>
            </div>
            <div class="channel-actions" id="actions-${ch.id}">
                ${getActionButtons(ch, isLinked)}
            </div>
        </div>
    `}).join('');

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

const getActionButtons = (ch, isLinked) => {
    if (ch.setupType === 'builtin') {
        return `<span class="badge badge-online">Always Active</span>
                <a href="/control.html" class="btn btn-outline">Open Chat</a>`;
    }
    const unlinkBtn = isLinked
        ? `<button class="btn btn-danger" onclick="unlinkChannel('${ch.id}')">🔌 Unlink</button>`
        : '';
    if (ch.setupType === 'qr') {
        return isLinked
            ? `<button class="btn btn-outline" onclick="linkWhatsApp()">🔄 Re-link QR</button>${unlinkBtn}`
            : `<button class="btn btn-primary" onclick="linkWhatsApp()">📱 Link via QR</button>`;
    }
    if (ch.setupType === 'token') {
        return isLinked
            ? `<button class="btn btn-outline" onclick="openTokenModal('${ch.id}')">✏️ Update Token</button>${unlinkBtn}`
            : `<button class="btn btn-primary" onclick="openTokenModal('${ch.id}')">🔗 Link</button>
               <a href="${ch.docs}" target="_blank" class="btn btn-outline">Docs ↗</a>`;
    }
    if (ch.setupType === 'info') {
        return `<button class="btn btn-outline" onclick="showInfo('${ch.id}')">How to setup</button>`;
    }
    return '';
};

// ─── Update a single channel's card state ──────────────
const setChannelLinked = (channelId, linked) => {
    channelStatus[channelId] = linked ? 'linked' : undefined;
    if (!linked) delete channelStatus[channelId];

    const badge = document.getElementById(`badge-${channelId}`);
    const card = document.getElementById(`card-${channelId}`);
    const actions = document.getElementById(`actions-${channelId}`);
    const ch = CHANNELS.find(c => c.id === channelId);
    if (!badge || !card || !ch) return;

    if (linked) {
        badge.className = 'badge badge-online';
        badge.textContent = 'Online';
        card.classList.add('linked');
    } else {
        badge.className = 'badge badge-na';
        badge.textContent = 'Off';
        card.classList.remove('linked');
    }
    if (actions) actions.innerHTML = getActionButtons(ch, linked);
};

// ─── Unlink a channel ─────────────────────────────────
window.unlinkChannel = async (channelId) => {
    if (!confirm(`Unlink ${channelId}? JARVIS will no longer respond on that channel.`)) return;
    try {
        await fetch('/api/channels/unlink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId })
        });
        setChannelLinked(channelId, false);
    } catch (e) {
        alert('Error: ' + e.message);
    }
};

// ─── WhatsApp QR Flow ──────────────────────────────────
window.linkWhatsApp = async () => {
    document.getElementById('qr-modal').classList.add('open');
    document.getElementById('qr-area').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--dim)">⏳ Sending command to device...</div>`;
    document.getElementById('qr-log').textContent = 'Requesting QR from device...';

    // Tell server to save whatsapp as linked in DB (optimistic)
    await fetch('/api/channels/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: 'whatsapp', token: null })
    });

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

    // Strip ANSI codes helper
    const stripAnsi = s => s.replace(/\x1b\[[0-9;]*[mGKHF]/g, '').trim();

    // Listen for QR code via SSE
    if (sseConn) sseConn.close();
    sseConn = new EventSource('/api/setup/sse');
    sseConn.onmessage = (e) => {
        try {
            const { type, data } = JSON.parse(e.data);
            if (type !== 'remote_log') return;
            const clean = stripAnsi(data);
            const log = document.getElementById('qr-log');
            log.textContent += '\n' + clean;
            log.scrollTop = log.scrollHeight;

            // Detect QR string — WhatsApp outputs several known patterns
            const qrMatch = clean.match(/scan QR: ([\w\-/+=%.:]+)/i)
                || clean.match(/qr:([\w\d+/=@,]+)/i)
                || clean.match(/(2@[A-Za-z0-9+/=,]{20,})/);
            if (qrMatch) renderQR(qrMatch[1]);

            if (clean.includes('WhatsApp connected') || clean.includes('Connection established') || clean.includes('session established')) {
                setChannelLinked('whatsapp', true);
                document.getElementById('qr-area').innerHTML = '<div style="font-size:40px;margin:30px 0">✅</div><div style="color:var(--gr);font-weight:700">WhatsApp Connected!</div>';
            }
        } catch { }
    };
};

const renderQR = (data) => {
    const area = document.getElementById('qr-area');
    area.innerHTML = '<div id="qrbox"></div>';
    try {
        new QRCode(document.getElementById('qrbox'), {
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
    document.getElementById('modal-desc').textContent = currentChannel.tokenLabel || 'Enter token:';
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

    try {
        // Save to DB + push command to device
        const res = await fetch('/api/channels/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId: currentChannel.id, token })
        });
        const d = await res.json();
        if (d.ok) {
            setChannelLinked(currentChannel.id, true);
        } else {
            alert('Error: ' + (d.error || 'Failed to link'));
        }
    } catch (e) {
        alert('Network error: ' + e.message);
    }

    btn.disabled = false; btn.textContent = 'Connect';
    closeModal();
};

window.showInfo = (channelId) => {
    const ch = CHANNELS.find(c => c.id === channelId);
    if (ch) alert(ch.info);
};

// ─── Boot ──────────────────────────────────────────────
loadChannelStatus();
checkGateway();
// Refresh gateway status every 10 seconds
setInterval(checkGateway, 10000);
