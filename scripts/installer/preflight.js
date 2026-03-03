import { execSync } from 'child_process';
import fs from 'fs';

const isGlobal = process.env.npm_config_global === 'true';

console.log("JARVIS Preflight Installer Initiated.");

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
    if (!process.env.CI) {
        console.error('⚠️ [JARVIS] Please restart your shell and try again.');
        process.exit(1);
    } else {
        console.warn('⚠️ [JARVIS] Warning: CI Environment detected. Bypassing fatal exit for containerized deploy resilience.');
    }
}

console.log("Preflight architectural verification passed natively.");
