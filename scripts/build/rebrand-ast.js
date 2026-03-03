import { Project, SyntaxKind } from 'ts-morph';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure we run this against the extracted upstream directory
const tsConfigPath = path.resolve(__dirname, "../../package/tsconfig.json");

if (!fs.existsSync(tsConfigPath)) {
    console.error(`FATAL: Cannot find tsconfig.json at ${tsConfigPath}`);
    process.exit(1);
}

const project = new Project({ tsConfigFilePath: tsConfigPath });

console.log("Analyzing AST for rebranding drift injections...");

let replacementCount = 0;

project.getSourceFiles().forEach(file => {
    // Transform string literals safely, ignoring binary/legit URLs due to AST scoping
    file.getDescendantsOfKind(SyntaxKind.StringLiteral).forEach(node => {
        const val = node.getLiteralValue();
        if (val === "OpenClaw" || val === "Open-Claw") {
            node.replaceWithText('"JARVIS"');
            replacementCount++;
        }
    });
});

console.log(`Rebranded ${replacementCount} string literals via AST transformation.`);
project.saveSync();
console.log("Successfully mutated upstream payload source natively.");
