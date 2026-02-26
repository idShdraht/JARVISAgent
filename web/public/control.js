'use strict';

let currentUser = null;
let deviceCode = null;

const init = async () => {
    try {
        const res = await fetch('/api/me');
        if (!res.ok) { window.location.href = '/?screen=login'; return; }
        currentUser = await res.json();
        if (!currentUser.setupDone) { window.location.href = '/'; return; }

        document.getElementById('device-email').textContent = currentUser.email;

        // Fetch pairing code
        const check = await fetch(`/api/android/poll/check?t=${Date.now()}`);
        const data = await check.json();

        // Always enable input so user can send even if device is sleeping
        document.getElementById('chat-input').disabled = false;
        document.getElementById('chat-send-btn').disabled = false;

        if (data.linked) {
            deviceCode = data.code;
            document.getElementById('device-code').textContent = deviceCode;

            // Connect to SSE for logs
            connectSSE();

            // Check if device is alive
            checkDeviceStatus();
            setInterval(checkDeviceStatus, 5000);
        } else {
            addMsg('No active device link found. Please return to the Dashboard to set up or link your device.', 'sys');
            document.getElementById('conn-status').className = 'status-badge offline';
            document.getElementById('conn-text').textContent = 'NO LINK';
            document.querySelector('.status-indicator').classList.remove('pulse');
        }
    } catch {
        window.location.href = '/?screen=login';
    }
};

const checkDeviceStatus = async () => {
    if (!deviceCode) return;
    try {
        const res = await fetch(`/api/android/poll/${deviceCode}?ui=true&t=${Date.now()}`);
        const status = await res.json();
        const badge = document.getElementById('conn-status');
        const text = document.getElementById('conn-text');
        const ind = badge.querySelector('.status-indicator');

        if (status.deviceLinked && (Date.now() - status.lastActive < 30000)) {
            badge.className = 'status-badge';
            text.textContent = 'ONLINE';
            ind.classList.remove('pulse');
            document.getElementById('chat-input').disabled = false;
            document.getElementById('chat-send-btn').disabled = false;
        } else {
            badge.className = 'status-badge offline';
            text.textContent = 'AWAY / SLEEPING';
            ind.classList.add('pulse');
            // Allow input anyway in case it wakes up
            document.getElementById('chat-input').disabled = false;
            document.getElementById('chat-send-btn').disabled = false;
        }
    } catch (e) {
        console.error(e);
    }
};

let eventSource = null;

const connectSSE = () => {
    if (eventSource) return;
    eventSource = new EventSource('/api/setup/sse');

    eventSource.onmessage = (e) => {
        try {
            const { type, data } = JSON.parse(e.data);
            if (type === 'remote_log') {
                if (data.includes('debconf:') || data.includes('dpkg:') || data.trim() === '') return;

                // Animate stripping ANSI colors and checking for prompts
                const clean = data.replace(/\x1b\[[0-9;]*[mGKHF]/g, '').trim();
                if (clean) addMsg(clean, 'jarvis');
            }
            if (type === 'remote_linked') {
                checkDeviceStatus();
            }
        } catch { }
    };

    eventSource.onerror = () => {
        eventSource.close();
        eventSource = null;
        setTimeout(connectSSE, 3000);
    };
};

const addMsg = (text, sender) => {
    const chat = document.getElementById('chat-messages');

    // Attempt continuous stream merging for JARVIS responses
    const lastMsg = chat.lastElementChild;

    if (sender === 'jarvis' && lastMsg && lastMsg.classList.contains('msg-jarvis')) {
        // Prevent huge unbroken blocks, split if > 1000 chars
        if (lastMsg.textContent.length < 1500 && !lastMsg.textContent.includes('─')) {
            lastMsg.textContent += '\n' + text;
            chat.scrollTop = chat.scrollHeight;
            return;
        }
    }

    const msg = document.createElement('div');
    msg.className = `msg msg-${sender}`;
    msg.textContent = text;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
};

window.sendCommand = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    addMsg(text, 'user');

    try {
        await fetch('/api/android/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: text })
        });
    } catch {
        addMsg('Failed to transmit command. Bridge may be down.', 'sys');
    }
};

window.wakeJarvis = async () => {
    addMsg('Transmitting wake signal to target device...', 'sys');
    try {
        await fetch('/api/android/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Wake up OpenClaw via proot-distro login ubuntu -- jarvis
            body: JSON.stringify({ command: 'proot-distro login ubuntu -- jarvis' })
        });
    } catch {
        addMsg('Wake transmission failed.', 'sys');
    }
};

init();
