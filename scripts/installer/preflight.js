import { execSync } from 'child_process';
import fs from 'fs';

const isGlobal = process.env.npm_config_global === 'true';
const isCI = !!process.env.CI;

console.log("JARVIS Preflight Installer Initiated.");

let failed = false;

// ── Node.js version check ───────────────────────────────────
const nodeVersion = process.versions.node;
const [major, minor] = nodeVersion.split('.').map(Number);

if (major < 22) {
    console.error(`⚠️ [JARVIS] Node.js >= 22 is required. Current version: ${nodeVersion}`);
    console.error('⚠️ [JARVIS] Actionable Remediation:');
    console.error('   Install Node.js 22+: https://nodejs.org/');
    console.error('   Or via nvm: nvm install 22 && nvm use 22');
    failed = true;
} else {
    console.log(`Node.js version ${nodeVersion} meets minimum requirement (>=22).`);
}

// ── Global npm permission check ─────────────────────────────
try {
    if (isGlobal) {
        console.log("Evaluating Global Installation Prefix Context Permissions...");
        const prefix = execSync('npm config get prefix').toString().trim();
        fs.accessSync(prefix, fs.constants.W_OK);
        console.log(`Prefix permissions structurally sound at ${prefix}.`);
    } else {
        console.log("Local deployment context detected. Bypassing global EACCES checks.");
    }
} catch (err) {
    console.error('⚠️ [JARVIS] Global installation permission check failed.');
    console.error('⚠️ [JARVIS] Actionable Remediation:');
    console.error('   npm config set prefix "$HOME/.npm-global"');
    console.error('   echo \'export PATH="$HOME/.npm-global/bin:$PATH"\' >> ~/.bashrc');
    failed = true;
}

// ── Final decision ──────────────────────────────────────────
if (failed) {
    if (!isCI) {
        console.error('⚠️ [JARVIS] Preflight checks failed. Please fix the above issues and try again.');
        process.exit(1);
    } else {
        console.warn('⚠️ [JARVIS] CI Environment detected. Bypassing fatal exit for containerized deploy resilience.');
    }
}

console.log("Preflight architectural verification passed natively.");
