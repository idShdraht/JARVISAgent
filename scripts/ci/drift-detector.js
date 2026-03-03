import { Project, SyntaxKind } from 'ts-morph';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Initializing Upstream Drift Detection Guard...");

const tsConfigPath = path.resolve(__dirname, "../../package/tsconfig.json");
const openClawTarget = path.resolve(__dirname, "../../package/src/commands/onboard-types.ts");

if (!fs.existsSync(openClawTarget)) {
    console.error("FATAL: CLI Flow file onboard-types.ts was moved or renamed by upstream. Breaking structural drift detected!");
    process.exit(1);
}

const project = new Project({ tsConfigFilePath: tsConfigPath });
const onboardFile = project.getSourceFileOrThrow(openClawTarget);

let foundQuickstart = false;
let foundAcceptRisk = false;

// We structurally search types natively to avoid token ambiguity
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
    console.error("FATAL: DRIFT DETECTED: 'quickstart' flow no longer exists natively in OnboardOptions.");
    process.exit(1);
}

if (!foundAcceptRisk) {
    console.error("FATAL: DRIFT DETECTED: 'acceptRisk' boolean argument structurally missing natively from OnboardOptions.");
    process.exit(1);
}

console.log("Static Type Drift Assertions Passed. CLI behavior anchored.");
