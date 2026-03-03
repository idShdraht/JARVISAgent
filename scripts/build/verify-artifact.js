import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tgzArg = process.argv[2];
const packageDir = path.resolve(__dirname, '../../package');

// ── Determine verification source ──────────────────────────
let verifyDir = packageDir;

if (tgzArg && fs.existsSync(path.resolve(tgzArg))) {
    // Extract tarball to temp directory for verification
    const tmpDir = path.resolve(__dirname, '../../.artifact-verify-tmp');
    if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });

    console.log(`Extracting tarball ${tgzArg} for verification...`);
    execSync(`tar -xzf "${path.resolve(tgzArg)}" -C "${tmpDir}"`, { stdio: 'inherit' });

    // npm pack creates package/ inside the tarball
    const extracted = path.join(tmpDir, 'package');
    if (fs.existsSync(extracted)) {
        verifyDir = extracted;
    } else {
        verifyDir = tmpDir;
    }
}

console.log(`Verifying built NPM artifact integrity at ${verifyDir}...`);

// ── Verify expected core files exist ────────────────────────
// The upstream build produces: dist/index.js, dist/entry.js, dist/warning-filter.js
// CLI entry is jarvis.mjs at package root (not dist/cli.js)
const expectedFiles = [
    'dist/index.js',
    'dist/entry.js',
    'jarvis.mjs',
    'package.json',
];

let failed = false;

for (const file of expectedFiles) {
    const filePath = path.join(verifyDir, file);
    if (!fs.existsSync(filePath)) {
        console.error(`FATAL: Mandatory deployment artifact missing: ${file}`);
        failed = true;
    } else {
        console.log(`  ✓ ${file}`);
    }
}

// ── Optional files — warn if missing but don't fail ─────────
const optionalFiles = ['README.md', 'LICENSE', 'dist/warning-filter.js'];
for (const file of optionalFiles) {
    const filePath = path.join(verifyDir, file);
    if (fs.existsSync(filePath)) {
        console.log(`  ✓ ${file} (optional)`);
    } else {
        console.warn(`  ⚠ ${file} missing (optional)`);
    }
}

// ── Verify package.json structural integrity ────────────────
const pkgJsonPath = path.join(verifyDir, 'package.json');
if (fs.existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

    // Version can be raw upstream (1.2.3) or synthesized (1.2.3-jarvis.N)
    const versionPattern = /^\d+\.\d+\.\d+(-jarvis\.\w+)?$/;
    if (!versionPattern.test(pkg.version)) {
        console.error(`FATAL: package.json version "${pkg.version}" does not match expected pattern.`);
        failed = true;
    } else {
        console.log(`  ✓ version: ${pkg.version}`);
    }

    // Name should be jarvis-agent after sync-version transforms it
    if (pkg.name && pkg.name === 'jarvis-agent') {
        console.log(`  ✓ name: ${pkg.name}`);
    } else {
        // Might not be renamed yet if sync-version didn't run — warn only
        console.warn(`  ⚠ name: ${pkg.name} (expected jarvis-agent)`);
    }

    // Verify bin entry points to a file that exists
    if (pkg.bin) {
        const binEntries = typeof pkg.bin === 'string' ? { default: pkg.bin } : pkg.bin;
        for (const [cmd, binPath] of Object.entries(binEntries)) {
            const resolvedBin = path.join(verifyDir, binPath);
            if (fs.existsSync(resolvedBin)) {
                console.log(`  ✓ bin.${cmd}: ${binPath}`);
            } else {
                console.error(`FATAL: bin.${cmd} points to "${binPath}" which does not exist.`);
                failed = true;
            }
        }
    }
}

// ── Verify no test footprints leaked into distribution ──────
const testFootprints = ['tests', '__tests__'];
for (const footprint of testFootprints) {
    const footPath = path.join(verifyDir, footprint);
    if (fs.existsSync(footPath)) {
        console.error(`FATAL: Test footprint leaked into distribution layer: ${footprint}`);
        failed = true;
    }
}

// ── Cleanup temp directory ──────────────────────────────────
const tmpDir = path.resolve(__dirname, '../../.artifact-verify-tmp');
if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
}

if (failed) {
    console.error(`\nArtifact structural integrity validation failed!`);
    process.exit(1);
}

console.log("Artifact footprint cleanly verified.");
process.exit(0);
