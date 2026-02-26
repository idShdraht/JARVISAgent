'use strict';

let currentUser = null;
let deviceCode = null;
let currentGroupEl = null;
let thinkingEl = null;

// ─── Init ──────────────────────────────────────────────
const init = async () => {
    addSys('Authenticating with JARVIS portal...');

    let me;
    try {
        const res = await fetch('/api/me');
        if (!res.ok) {
            addSys('Session expired. Redirecting...');
            setTimeout(() => { window.location.href = '/'; }, 1500);
            return;
        }
        me = await res.json();
    } catch (e) {
        addSys('Network error: ' + e.message);
        return;
    }

    currentUser = me;

    // Load pairing code — from DB if needed
    let data = { linked: false };
    try {
        const r = await fetch(`/api/android/poll/check?t=${Date.now()}`);
        data = await r.json();
    } catch { }

    if (data.linked) {
        deviceCode = data.code;
        setStatus('connecting', 'Linked', 'Checking if device is online...');
        connectSSE();
        checkDeviceStatus();
        setInterval(checkDeviceStatus, 5000);
    } else {
        setStatus('offline', 'No Device', 'Complete setup first');
        addSys('No active device link found. Return to the Dashboard to complete Android setup.');
    }
};

// ─── Status ────────────────────────────────────────────
const setStatus = (state, text, sub) => {
    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('status-text');
    const sub2 = document.getElementById('status-sub');
    dot.className = 'dot ' + state;
    txt.textContent = text;
    if (sub2) sub2.textContent = sub || '';
};

const checkDeviceStatus = async () => {
    if (!deviceCode) return;
    try {
        const res = await fetch(`/api/android/poll/${deviceCode}?ui=true&t=${Date.now()}`);
        const s = await res.json();
        if (s.deviceLinked && (Date.now() - s.lastActive < 30000)) {
            setStatus('online', 'Online', 'Device is responding');
        } else {
            setStatus('connecting', 'Away', 'Device may be sleeping');
        }
    } catch { }
};

// ─── SSE from server ───────────────────────────────────
let es = null;

const connectSSE = () => {
    if (es) return;
    es = new EventSource('/api/setup/sse');

    es.onmessage = (e) => {
        try {
            const { type, data } = JSON.parse(e.data);
            if (type === 'remote_log') {
                const clean = data.replace(/\x1b\[[0-9;]*[mGKHF]/g, '').trim();
                // Skip installation noise
                if (!clean || clean.startsWith('debconf:') || clean.startsWith('dpkg:') ||
                    clean.match(/^(Get|Hit|Ign|Fetched|Reading|Building|Preparing|Unpacking|Setting)\s/i)) return;
                hideThinking();
                appendJarvis(clean);
            }
            if (type === 'remote_linked') {
                setStatus('online', 'Online', 'Device connected');
                checkDeviceStatus();
            }
            if (type === 'remote_prompt') {
                hideThinking();
                appendJarvis('❓ ' + data);
            }
        } catch { }
    };

    es.onerror = () => {
        es.close(); es = null;
        setTimeout(connectSSE, 3000);
    };
};

// ─── Messaging ─────────────────────────────────────────
const addSys = (text) => {
    const el = document.createElement('div');
    el.className = 'sys-msg';
    el.textContent = text;
    document.getElementById('messages').appendChild(el);
    scrollBottom();
};

const appendUser = (text) => {
    currentGroupEl = null; // reset so next jarvis reply starts fresh
    const group = document.createElement('div');
    group.className = 'msg-group user';
    group.innerHTML = `<div class="bubble">${escHtml(text)}</div>`;
    document.getElementById('messages').appendChild(group);
    scrollBottom();
};

const appendJarvis = (text) => {
    // Merge consecutive jarvis lines into one bubble (up to 2000 chars)
    if (currentGroupEl && currentGroupEl.dataset.type === 'jarvis') {
        const bubble = currentGroupEl.querySelector('.bubble');
        if (bubble && bubble.textContent.length < 2000 && !text.includes('───')) {
            bubble.textContent += '\n' + text;
            scrollBottom();
            return;
        }
    }
    const group = document.createElement('div');
    group.className = 'msg-group jarvis';
    group.dataset.type = 'jarvis';
    group.innerHTML = `<div class="msg-sender">JARVIS</div><div class="bubble">${escHtml(text)}</div>`;
    document.getElementById('messages').appendChild(group);
    currentGroupEl = group;
    scrollBottom();
};

const showThinking = () => {
    if (thinkingEl) return;
    thinkingEl = document.createElement('div');
    thinkingEl.className = 'msg-group jarvis';
    thinkingEl.innerHTML = `<div class="msg-sender">JARVIS</div><div class="thinking"><span></span><span></span><span></span></div>`;
    document.getElementById('messages').appendChild(thinkingEl);
    scrollBottom();
};

const hideThinking = () => {
    if (thinkingEl) { thinkingEl.remove(); thinkingEl = null; }
};

const scrollBottom = () => {
    const m = document.getElementById('messages');
    m.scrollTop = m.scrollHeight;
};

const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ─── Send ──────────────────────────────────────────────
window.sendMessage = async () => {
    const ta = document.getElementById('chat-input');
    const text = ta.value.trim();
    if (!text) return;

    ta.value = '';
    ta.style.height = '24px';
    appendUser(text);
    showThinking();

    try {
        const res = await fetch('/api/android/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: text })
        });
        const d = await res.json();
        if (!d.ok) {
            hideThinking();
            addSys('Command not delivered — no device linked.');
        }
    } catch {
        hideThinking();
        addSys('Network error — failed to send command.');
    }
};

window.handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window.sendMessage();
    }
};

window.autoResize = (el) => {
    el.style.height = '24px';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
};

window.wakeJarvis = async () => {
    addSys('Sending wake signal to device...');
    showThinking();
    try {
        await fetch('/api/android/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'proot-distro login ubuntu -- jarvis' })
        });
    } catch {
        hideThinking();
        addSys('Wake signal failed.');
    }
};

window.newSession = () => {
    const msgs = document.getElementById('messages');
    msgs.innerHTML = '';
    currentGroupEl = null;
    thinkingEl = null;
    addSys('New session started.');
};

init();
