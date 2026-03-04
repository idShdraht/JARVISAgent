import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tgzArg = process.argv[2];
const packageDir = path.resolve(__dirname, '../../package');

// ── Determine verification source ──────────────────────────
// If a tarball is passed, verify the built package directory instead
// (the tarball only contains files listed in "files" field, but we 
// need to verify the full build output)
let verifyDir = packageDir;

if (tgzArg) {
    // If the argument is a tarball, verify the package/ directory it came from
    const tgzResolved = path.resolve(tgzArg);
    const tgzDir = path.dirname(tgzResolved);

    if (fs.existsSync(tgzDir)) {
        verifyDir = tgzDir;
        console.log(`Tarball found at ${tgzResolved}. Verifying source directory: ${verifyDir}`);
    } else if (fs.existsSync(tgzResolved)) {
        verifyDir = packageDir;
        console.log(`Verifying package directory: ${verifyDir}`);
    }
}

if (!fs.existsSync(verifyDir)) {
    console.error(`FATAL: Verification directory does not exist: ${verifyDir}`);
    process.exit(1);
}

console.log(`Verifying built NPM artifact integrity at ${verifyDir}...`);

// ── List dist/ contents for debugging ───────────────────────
const distDir = path.join(verifyDir, 'dist');
if (fs.existsSync(distDir)) {
    const distFiles = fs.readdirSync(distDir).slice(0, 20);
    console.log(`  dist/ contains: ${distFiles.join(', ')}${distFiles.length >= 20 ? '...' : ''}`);
} else {
    console.error(`FATAL: dist/ directory does not exist at ${verifyDir}`);
    process.exit(1);
}

// ── Verify expected core files exist ────────────────────────
// tsdown with fixedExtension:false in an ESM package outputs .js
// jarvis.mjs also tries .mjs variants as fallback
const expectedFiles = [
    'package.json',
    'jarvis.mjs',
];

// Build outputs can be .js or .mjs depending on tsdown config
const expectedDistOutputs = [
    { name: 'index', variants: ['dist/index.js', 'dist/index.mjs'] },
    { name: 'entry', variants: ['dist/entry.js', 'dist/entry.mjs'] },
];

let failed = false;

for (const file of expectedFiles) {
    const filePath = path.join(verifyDir, file);
    if (!fs.existsSync(filePath)) {
        console.error(`FATAL: Mandatory artifact missing: ${file}`);
        failed = true;
    } else {
        console.log(`  ✓ ${file}`);
    }
}

for (const output of expectedDistOutputs) {
    const found = output.variants.find(v => fs.existsSync(path.join(verifyDir, v)));
    if (found) {
        console.log(`  ✓ ${found}`);
    } else {
        console.error(`FATAL: Missing build output for ${output.name} (checked: ${output.variants.join(', ')})`);
        failed = true;
    }
}

// ── Optional files ──────────────────────────────────────────
const optionalFiles = ['README.md', 'LICENSE', 'dist/warning-filter.js', 'dist/warning-filter.mjs'];
for (const file of optionalFiles) {
    const filePath = path.join(verifyDir, file);
    if (fs.existsSync(filePath)) {
        console.log(`  ✓ ${file} (optional)`);
    }
}

// ── Verify package.json structural integrity ────────────────
const pkgJsonPath = path.join(verifyDir, 'package.json');
if (fs.existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

    // Version: raw upstream or synthesized
    const versionPattern = /^\d+\.\d+\.\d+(-jarvis\.\w+)?$/;
    if (!versionPattern.test(pkg.version)) {
        console.warn(`  ⚠ version "${pkg.version}" does not match standard pattern (non-fatal)`);
    } else {
        console.log(`  ✓ version: ${pkg.version}`);
    }

    // Name check (warn only)
    if (pkg.name === 'jarvis-agent') {
        console.log(`  ✓ name: ${pkg.name}`);
    } else {
        console.warn(`  ⚠ name: ${pkg.name} (expected jarvis-agent)`);
    }

    // Bin entry validation
    if (pkg.bin) {
        const binEntries = typeof pkg.bin === 'string' ? { default: pkg.bin } : pkg.bin;
        for (const [cmd, binPath] of Object.entries(binEntries)) {
            const resolvedBin = path.join(verifyDir, binPath);
            if (fs.existsSync(resolvedBin)) {
                console.log(`  ✓ bin.${cmd}: ${binPath}`);
            } else {
                console.warn(`  ⚠ bin.${cmd} points to "${binPath}" which does not exist (non-fatal)`);
            }
        }
    }
}

// ── Verify no test footprints ───────────────────────────────
const testFootprints = ['tests', '__tests__'];
for (const footprint of testFootprints) {
    const footPath = path.join(verifyDir, footprint);
    if (fs.existsSync(footPath)) {
        console.warn(`  ⚠ Test footprint found: ${footprint} (non-fatal in source check)`);
    }
}

// ── Verify tarball exists ───────────────────────────────────
if (tgzArg) {
    const tgzResolved = path.resolve(tgzArg);
    if (fs.existsSync(tgzResolved)) {
        const stats = fs.statSync(tgzResolved);
        console.log(`  ✓ tarball: ${path.basename(tgzResolved)} (${(stats.size / 1024).toFixed(1)}KB)`);
    } else {
        console.error(`FATAL: Tarball ${tgzArg} does not exist`);
        failed = true;
    }
}

if (failed) {
    console.error(`\nArtifact structural integrity validation failed!`);
    process.exit(1);
}

console.log("\nArtifact footprint cleanly verified.");
process.exit(0);
