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
        // Some tarballs extract directly
        verifyDir = tmpDir;
    }
}

console.log(`Verifying built NPM artifact integrity at ${verifyDir}...`);

// ── Verify expected files exist ─────────────────────────────
const expectedFiles = [
    'dist/cli.js',
    'dist/jarvis.mjs',
    'package.json',
    'README.md'
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

// ── Verify package.json version matches synthetic pattern ───
const pkgJsonPath = path.join(verifyDir, 'package.json');
if (fs.existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const versionPattern = /^\d+\.\d+\.\d+(-jarvis\.\d+)?$/;
    if (!versionPattern.test(pkg.version)) {
        console.error(`FATAL: package.json version "${pkg.version}" does not match expected synthetic version pattern.`);
        failed = true;
    } else {
        console.log(`  ✓ version: ${pkg.version}`);
    }

    if (pkg.name !== 'jarvis-agent') {
        console.error(`FATAL: package.json name is "${pkg.name}", expected "jarvis-agent".`);
        failed = true;
    } else {
        console.log(`  ✓ name: ${pkg.name}`);
    }
}

// ── Verify no test footprints leaked into distribution ──────
const testFootprints = ['tests', '__tests__', 'src/commands/test.ts'];
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
    console.error(`\nArtifact structural integrity validation failed! Build is corrupted.`);
    process.exit(1);
}

console.log("Artifact footprint cleanly verified.");
process.exit(0);
