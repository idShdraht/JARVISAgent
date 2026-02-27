// ═══════════════════════════════════════════════════════
//  JARVIS Web Portal — Express Server
//  Developed by Balaraman
// ═══════════════════════════════════════════════════════
'use strict';
require('dotenv').config({ quiet: true }); // silent if .env missing
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db');
const { passport, ensureAuth, ensureHasPassword,
    hashPassword, checkPassword } = require('./auth');
const { addSSEClient, removeSSEClient,
    runInstaller, getPlatform, ensureWindowsScript,
    runOnboard, sendOnboardInput, stopOnboard } = require('./installer');
const { saveChannel, getChannels, deleteChannel } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve bootstrap script with dynamic portal URL injection
app.get('/jarvis.sh', (req, res) => {
    const fs = require('fs');
    const scriptPath = path.resolve(__dirname, '..', 'jarvis.sh');

    if (!fs.existsSync(scriptPath)) {
        return res.status(404).send('Script not found');
    }

    let script = fs.readFileSync(scriptPath, 'utf8');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const portalUrl = `${protocol}://${host}`;

    // Inject the URL directly into the script placeholder
    script = script.replace('{{PORTAL_URL}}', portalUrl);

    res.set('Content-Type', 'text/x-sh');
    res.send(script);
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'jarvis-by-balaraman-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(passport.initialize());
app.use(passport.session());

// ─── Auth Routes ───────────────────────────────────────
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/callback',
    passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
    (req, res) => {
        // After Google login — if no password yet, go to set-password screen
        if (!req.user.password_hash) {
            return res.redirect('/?screen=set-password');
        }
        res.redirect('/?screen=dashboard');
    }
);

app.post('/auth/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        res.json({ ok: true });
    });
});

// ─── User API ──────────────────────────────────────────
// Get current user info
app.get('/api/me', ensureAuth, (req, res) => {
    const { id, email, display_name, avatar_url, setup_done, platform } = req.user;
    res.json({
        id, email, displayName: display_name, avatar: avatar_url,
        setupDone: !!setup_done, platform,
        hasPassword: !!req.user.password_hash
    });
});

// Check system status (DB mode, etc.)
app.get('/api/status', (req, res) => {
    res.json({
        ok: true,
        dbMode: db.isLocalMode() ? 'local' : 'cloud',
        version: '1.2.0-autonomous'
    });
});

// Set password (first login after Google OAuth)
app.post('/api/set-password', ensureAuth, async (req, res) => {
    try {
        // SECURITY: Don't allow overwriting an existing password
        if (req.user.password_hash) {
            return res.status(400).json({ error: 'Password already set. Use shift + refresh if you need to reset.' });
        }

        const { password } = req.body;
        if (!password || password.length < 6)
            return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const hash = await hashPassword(password);
        await db.setPassword(req.user.id, hash);

        // Reload user from DB to ensure session is perfectly in sync
        const updatedUser = await db.findUserById(req.user.id);
        req.login(updatedUser, (err) => {
            if (err) return res.status(500).json({ error: 'Session refresh failed' });
            db.logSession(req.user.id, 'set_password', 'Password created', 'web');
            res.json({ ok: true });
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Email/password login (alternative to Google)
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
        const user = await db.findUserByEmail(email);
        if (!user || !user.password_hash)
            return res.status(401).json({ error: 'No account found. Please sign in with Google first.' });
        const ok = await checkPassword(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Wrong password. Try again.' });
        req.login(user, err => {
            if (err) return res.status(500).json({ error: 'Login session error: ' + err.message });
            res.json({ ok: true, needsPassword: false });
        });
    } catch (e) {
        console.error('[JARVIS] Login error:', e.message);
        res.status(500).json({ error: 'Login failed: ' + e.message });
    }
});

// ─── Setup API ─────────────────────────────────────────
// Trigger setup for "this PC" or "android"
app.post('/api/setup/run', ensureAuth, ensureHasPassword, async (req, res) => {
    const { targetPlatform } = req.body;
    const userId = req.user.id;
    ensureWindowsScript();
    // Non-blocking — installer writes to SSE
    setTimeout(() => runInstaller(userId, targetPlatform), 100);
    await db.logSession(userId, 'setup_started', `platform:${targetPlatform}`, targetPlatform);
    res.json({ ok: true, message: 'Setup started — watch the progress below.' });
});

// Mark setup complete (called by frontend after done SSE event)
app.post('/api/setup/done', ensureAuth, async (req, res) => {
    const { platform } = req.body;
    await db.markSetupDone(req.user.id, platform);
    await db.logSession(req.user.id, 'setup_done', 'Installation finished', platform);
    req.user.setup_done = 1;
    res.json({ ok: true });
});

// ─── Onboarding routes ──────────────────────────────────
// Start interactive onboard (openclaw onboard)
app.post('/api/onboard/start', ensureAuth, (req, res) => {
    const { platform } = req.body;
    // Non-blocking — process writes to SSE
    setTimeout(() => runOnboard(req.user.id, platform), 50);
    res.json({ ok: true, message: 'Onboarding started' });
});

// User typed an answer — pipe to stdin
app.post('/api/onboard/input', ensureAuth, (req, res) => {
    const { text } = req.body;
    if (typeof text === 'undefined') return res.status(400).json({ error: 'Missing text' });
    const result = sendOnboardInput(req.user.id, text);
    res.json(result);
});

// Kill + reset onboarding
app.post('/api/onboard/stop', ensureAuth, (req, res) => {
    stopOnboard(req.user.id);
    res.json({ ok: true });
});

// ─── Remote Android Bridge ─────────────────────────────
app.post('/api/android/link', ensureAuth, async (req, res) => {
    const { deviceName } = req.body;
    const { addRemoteSession, getCodeForUser } = require('./installer');

    // 1. Check in-memory first (fastest path)
    let pairingCode = getCodeForUser(req.user.id);

    // 2. If not in memory, try to restore from DB (survives redeploys)
    if (!pairingCode) {
        pairingCode = await db.loadPairingCode(req.user.id);
        if (pairingCode) {
            // Rebuild in-memory session from DB so Termux doesn't need to re-pair
            console.log(`[JARVIS] Restored pairing code ${pairingCode} from DB for user ${req.user.id}`);
            const { remoteSessions, userToCode } = require('./installer');
            if (!remoteSessions.has(pairingCode)) {
                remoteSessions.set(pairingCode, { userId: req.user.id, deviceName: deviceName || 'Android Device', queue: [], lastActive: Date.now(), deviceLinked: false });
                userToCode.set(req.user.id, pairingCode);
            }
        }
    }

    // 3. Generate a fresh code only if none exists
    if (!pairingCode) {
        pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
        await addRemoteSession(req.user.id, pairingCode, deviceName || 'Android Device');
    }

    res.json({ ok: true, pairingCode });
});


// Worker (Termux) calls this to get pending commands
app.get('/api/android/poll/:code', async (req, res) => {
    const { code } = req.params;

    // UI can call /api/android/poll/check to see if a link exists for the current user
    if (code === 'check' && req.isAuthenticated()) {
        const { userToCode, remoteSessions } = require('./installer');
        let activeCode = userToCode.get(req.user.id);

        // Restore from DB if not in memory (server just restarted)
        if (!activeCode) {
            activeCode = await db.loadPairingCode(req.user.id);
            if (activeCode && !remoteSessions.has(activeCode)) {
                const { addRemoteSession } = require('./installer');
                // Don't await — just fire and forget to rebuild in memory
                addRemoteSession(req.user.id, activeCode, 'Android Device').catch(() => { });
            }
        }
        return res.json({ linked: !!activeCode, code: activeCode });
    }

    const { getPendingCommand, getSessionStatus } = require('./installer');

    // If request has a query param 'ui=true', it's a browser status check, not a device poll
    if (req.query.ui === 'true') {
        const status = getSessionStatus(code);
        // Restore from DB if session not in memory yet
        if (!status.exists) {
            const session = await getPendingCommand(code); // triggers DB restore as side effect
        }
        return res.json({ type: 'status', ...getSessionStatus(code) });
    }

    // ✅ CRITICAL: await the now-async getPendingCommand
    const cmd = await getPendingCommand(code);
    res.json(cmd || { type: 'idle' });
});


// Worker posts results/logs back
app.post('/api/android/report/:code', (req, res) => {
    const { code } = req.params;
    const { log, type, data } = req.body;
    const { handleRemoteReport } = require('./installer');
    handleRemoteReport(code, { log, type, data });
    res.json({ ok: true });
});

// UI calls this to send a command to the linked device
app.post('/api/android/command', ensureAuth, (req, res) => {
    const { command, args } = req.body;
    const { pushRemoteCommand } = require('./installer');
    console.log(`[JARVIS] Incoming remote command request for user ${req.user.id}`);
    const ok = pushRemoteCommand(req.user.id, { command, args });
    res.json({ ok });
});

// ─── SSE — real-time install progress ─────────────────
app.get('/api/setup/sse', ensureAuth, (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('data: {"type":"connected","data":"JARVIS SSE connected"}\n\n');

    const userId = req.user.id;
    addSSEClient(userId, res);

    // Heartbeat
    const hb = setInterval(() => {
        try { res.write(': ping\n\n'); } catch { clearInterval(hb); }
    }, 20_000);

    req.on('close', () => {
        clearInterval(hb);
        removeSSEClient(userId, res);
    });
});

// ─── Platform detect ───────────────────────────────────
app.get('/api/platform', (req, res) => {
    res.json({ platform: getPlatform() });
});

// ─── APK Proxy — Bypasses CORS/Redirects for UI-only download ─────
app.get('/api/proxy/termux', (req, res) => {
    const https = require('https');
    const url = 'https://github.com/termux/termux-app/releases/download/v0.118.1/termux-app_v0.118.1+github-debug_arm64-v8a.apk';

    function proxyRequest(targetUrl) {
        https.get(targetUrl, (githubRes) => {
            if (githubRes.statusCode >= 300 && githubRes.statusCode < 400 && githubRes.headers.location) {
                return proxyRequest(githubRes.headers.location);
            }
            res.set('Content-Length', githubRes.headers['content-length']);
            res.set('Content-Type', 'application/vnd.android.package-archive');
            githubRes.pipe(res);
        }).on('error', (err) => {
            console.error('Proxy Download Error:', err);
            res.status(500).send('Proxy error');
        });
    }

    proxyRequest(url);
});

// ─── Channels API ─────────────────────────────────

// GET /api/channels/list — return merged list: static config + DB status
app.get('/api/channels/list', ensureAuth, async (req, res) => {
    try {
        const rows = await getChannels(req.user.id);
        // Build a map of channelId -> status for fast lookup
        const statusMap = {};
        rows.forEach(r => { statusMap[r.channel_id] = r.status; });
        res.json({ ok: true, channels: statusMap });
    } catch (e) {
        console.error('[JARVIS] channels/list error:', e.message);
        res.json({ ok: true, channels: {} }); // graceful fallback
    }
});

// POST /api/channels/link — save token to DB and push config command to device
app.post('/api/channels/link', ensureAuth, async (req, res) => {
    const { channelId, token } = req.body;
    if (!channelId) return res.status(400).json({ error: 'channelId required' });

    try {
        // Save to DB
        await saveChannel(req.user.id, channelId, token || null, 'linked');

        // Push config command to linked Android device (best-effort)
        if (token) {
            const { pushRemoteCommand } = require('./installer');
            const configCmd = `proot-distro login ubuntu -- bash -c "openclaw config set channels.${channelId}.token '${token.replace(/'/g, "'\\''")}' 2>/dev/null; nohup openclaw gateway --port 18789 > /tmp/jarvis_gateway.log 2>&1 &"`;
            pushRemoteCommand(req.user.id, { command: configCmd });
        }

        res.json({ ok: true });
    } catch (e) {
        console.error('[JARVIS] channels/link error:', e.message);
        res.status(500).json({ error: 'Failed to link channel' });
    }
});

// POST /api/channels/unlink — remove channel from DB and push removal command
app.post('/api/channels/unlink', ensureAuth, async (req, res) => {
    const { channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'channelId required' });

    try {
        await deleteChannel(req.user.id, channelId);

        // Tell device to stop this channel
        const { pushRemoteCommand } = require('./installer');
        const stopCmd = `proot-distro login ubuntu -- bash -c "openclaw config unset channels.${channelId} 2>/dev/null || true"`;
        pushRemoteCommand(req.user.id, { command: stopCmd });

        res.json({ ok: true });
    } catch (e) {
        console.error('[JARVIS] channels/unlink error:', e.message);
        res.status(500).json({ error: 'Failed to unlink channel' });
    }
});

// GET /api/gateway/status — check if the linked device is actively polling
app.get('/api/gateway/status', ensureAuth, (req, res) => {
    const { userToCode, remoteSessions } = require('./installer');
    const code = userToCode.get(req.user.id);
    if (!code) return res.json({ online: false, reason: 'no_device' });
    const session = remoteSessions.get(code);
    if (!session) return res.json({ online: false, reason: 'no_session' });
    const age = Date.now() - (session.lastActive || 0);
    const online = session.deviceLinked && age < 30000;
    res.json({ online, lastActive: session.lastActive, age });
});

// ─── SPA fallback ──────────────────────────────────────
app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// ─── Start ─────────────────────────────────────────────
(async () => {
    // DB is optional — UI still serves without it (shows warning)
    try { await db.init(); }
    catch (e) {
        console.warn('[JARVIS] DB unavailable (check .env credentials):', e.message.slice(0, 80));
        console.warn('[JARVIS] Running in local-only mode.\n');
    }
    app.listen(PORT, () => {
        console.log(`\n  ╔══════════════════════════════════════════════╗`);
        console.log(`  ║  JARVIS Web Portal                           ║`);
        console.log(`  ║  Developed by Balaraman                      ║`);
        console.log(`  ║  http://localhost:${PORT}                          ║`);
        console.log(`  ╚══════════════════════════════════════════════╝\n`);
    });
})();
