import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const artifactPath = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../../package');

console.log(`Verifying built NPM artifact integrity at ${artifactPath}...`);

// Verify expected structure manifestation
const expectedFiles = [
    'dist/cli.js',
    'dist/jarvis.mjs',
    'package.json',
    'README.md'
];

let failed = false;

for (const file of expectedFiles) {
    const filePath = path.join(artifactPath, file);
    if (!fs.existsSync(filePath)) {
        console.error(`FATAL: Mandatory deployment artifact missing: ${file}`);
        failed = true;
    }
}

// Verify no test footprints exist
const testFootprints = ['tests', '__tests__', 'src/commands/test.ts'];
for (const footprint of testFootprints) {
    const footPath = path.join(artifactPath, footprint);
    if (fs.existsSync(footPath)) {
        console.error(`FATAL: Test footprint leaked into distribution layer: ${footprint}`);
        failed = true;
    }
}

if (failed) {
    console.error(`\nArtifact structural integrity validation failed! The build is intrinsically corrupted.`);
    process.exit(1);
}

console.log("Artifact footprint cleanly verified.");
