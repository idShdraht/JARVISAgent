import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import semver from 'semver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.resolve(__dirname, "../../package/package.json");

if (!fs.existsSync(pkgPath)) {
    console.error("FATAL: Cannot resolve required package/package.json file for version sync.");
    process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const upstreamVer = pkg.version;
const buildNum = process.env.GITHUB_RUN_NUMBER || 'local';

// Monotonic Synthetic Versioning Format
pkg.version = `${upstreamVer}-jarvis.${buildNum}`;
console.log(`Synthesizing release candidate version: ${pkg.version}`);

// Strict Semver Gatekeeper Enforcement
try {
    const published = execSync('npm view jarvis-agent version', { stdio: 'pipe' }).toString().trim();
    if (published) {
        if (semver.lte(pkg.version, published)) {
            console.error(`FATAL: Structural deployment abort!`);
            console.error(`New synthesized version (${pkg.version}) <= published registry version (${published}).`);
            console.error(`Backwards timeline or colliding deployments are strictly forbidden.`);
            process.exit(1);
        }
        console.log(`Version ${pkg.version} cleanly supersedes published ${published}.`);
    }
} catch (e) {
    if (e.message.includes("404") || e.message.includes("is not in the npm registry")) {
        console.log(`Initial package deployment detected for jarvis-agent. Passing semver checks.`);
    } else {
        console.error("WARNING: Failed to query NPM registry for version gatekeeping. If CI environment, investigate manually.");
        console.error(e.message);
    }
}

// Ensure entrypoints and names correctly reflect jarvis
pkg.name = "jarvis-agent";
if (pkg.bin && pkg.bin.openclaw) {
    pkg.bin.jarvis = pkg.bin.openclaw;
    delete pkg.bin.openclaw;
} else {
    pkg.bin = { "jarvis": "./dist/cli.js" };
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log(`Wrote frozen package.json map yielding deterministic boundaries.`);
