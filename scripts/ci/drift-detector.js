import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Initializing Upstream Drift Detection Guard...");

// ── Exit codes ──────────────────────────────────────────────
// 0 = pass (no drift)
// 1 = drift detected (structural change in upstream)
// 2 = precondition failure (missing files/paths)

const packageDir = path.resolve(__dirname, "../../package");
const tsConfigPath = path.resolve(packageDir, "tsconfig.json");
const openClawTarget = path.resolve(packageDir, "src/commands/onboard-types.ts");

// ── Precondition: package directory must exist ──────────────
if (!fs.existsSync(packageDir)) {
    console.error("PRECONDITION: ./package/ directory does not exist.");
    console.error("This is expected if upstream fetch has not run yet.");
    console.error("Run scripts/build/fetch-upstream.sh first.");
    process.exit(2);
}

if (!fs.existsSync(tsConfigPath)) {
    console.error("PRECONDITION: tsconfig.json not found in ./package/.");
    console.error("The upstream source structure may have changed fundamentally.");
    process.exit(2);
}

if (!fs.existsSync(openClawTarget)) {
    console.error("DRIFT DETECTED: CLI flow file onboard-types.ts was moved or renamed by upstream.");
    console.error(`Expected at: ${openClawTarget}`);
    process.exit(1);
}

// ── AST analysis (dynamic import to handle missing ts-morph gracefully) ──
let Project, SyntaxKind;
try {
    const tsMorph = await import('ts-morph');
    Project = tsMorph.Project;
    SyntaxKind = tsMorph.SyntaxKind;
} catch (e) {
    console.error("PRECONDITION: ts-morph not installed. Run npm ci first.");
    process.exit(2);
}

const project = new Project({ tsConfigFilePath: tsConfigPath });
const onboardFile = project.getSourceFileOrThrow(openClawTarget);

let foundQuickstart = false;
let foundAcceptRisk = false;

// Structurally search types natively to avoid token ambiguity
onboardFile.getTypeAliases().forEach(alias => {
    if (alias.getName() === "OnboardOptions") {
        const typeText = alias.getTypeNode().getText();

        if (typeText.includes('flow?:') && typeText.includes('"quickstart"')) {
            foundQuickstart = true;
        }
        if (typeText.includes('acceptRisk?: boolean')) {
            foundAcceptRisk = true;
        }
    }
});

// Fallback mechanical string scan
const fileText = onboardFile.getText();
if (!foundQuickstart && fileText.includes('flow?:') && fileText.includes('"quickstart"')) { foundQuickstart = true; }
if (!foundAcceptRisk && fileText.includes('acceptRisk?:')) { foundAcceptRisk = true; }

if (!foundQuickstart) {
    console.error("DRIFT DETECTED: 'quickstart' flow no longer exists natively in OnboardOptions.");
    process.exit(1);
}

if (!foundAcceptRisk) {
    console.error("DRIFT DETECTED: 'acceptRisk' boolean argument structurally missing from OnboardOptions.");
    process.exit(1);
}

console.log("Static Type Drift Assertions Passed. CLI behavior anchored.");
process.exit(0);
