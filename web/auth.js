// ═══════════════════════════════════════════════════════
//  JARVIS Web Portal — Google OAuth + Auth Helpers
//  Developed by Balaraman
// ═══════════════════════════════════════════════════════
'use strict';
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const db = require('./db');
require('dotenv').config();

const SALT = 12;

// ─── Passport serialization ────────────────────────────
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try { done(null, await db.findUserById(id)); }
    catch (e) { done(e); }
});

// ─── Google Strategy ───────────────────────────────────
passport.use(new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/callback',
    },
    async (_at, _rt, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value || '';
            const avatarUrl = profile.photos?.[0]?.value || '';
            const user = await db.upsertGoogleUser({
                googleId: profile.id,
                email,
                displayName: profile.displayName,
                avatarUrl,
            });
            done(null, user);
        } catch (e) {
            done(e);
        }
    }
));

const ensureAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

module.exports = { passport, ensureAuth };
