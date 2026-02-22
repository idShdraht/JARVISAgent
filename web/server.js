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

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
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

// Set password (first login after Google OAuth)
app.post('/api/set-password', ensureAuth, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 6)
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        const hash = await hashPassword(password);
        await db.setPassword(req.user.id, hash);
        // Reload user in session
        req.user.password_hash = hash;
        await db.logSession(req.user.id, 'set_password', 'Password created', 'web');
        res.json({ ok: true });
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
