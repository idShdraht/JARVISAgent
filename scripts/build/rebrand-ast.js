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

let replacementCount = 0;

try {
    const { Project, SyntaxKind } = await import('ts-morph');
    const project = new Project({ tsConfigFilePath: tsConfigPath });

    console.log("Analyzing AST for rebranding drift injections...");

    // Only process command/UI-facing source files for speed
    const sourceFiles = project.getSourceFiles();
    console.log(`Processing ${sourceFiles.length} source files...`);

    for (const file of sourceFiles) {
        try {
            // Transform string literals safely
            file.getDescendantsOfKind(SyntaxKind.StringLiteral).forEach(node => {
                const val = node.getLiteralValue();
                if (val === "OpenClaw" || val === "Open-Claw") {
                    node.replaceWithText('"JARVIS"');
                    replacementCount++;
                }
            });
        } catch (e) {
            // Skip files that can't be parsed (e.g., .d.ts from node_modules)
            console.warn(`  Skipped file: ${file.getFilePath()} (${e.message})`);
        }
    }

    console.log(`Rebranded ${replacementCount} string literals via AST transformation.`);
    project.saveSync();
    console.log("Successfully mutated upstream payload source natively.");
} catch (e) {
    console.error(`AST rebranding failed: ${e.message}`);
    console.log("Falling back to sed-style string replacement...");

    // Fallback: simple find-and-replace in key files
    const packageDir = path.resolve(__dirname, "../../package");
    const targetExtensions = ['.ts', '.js', '.json', '.mjs'];
    const targetDirs = ['src/commands', 'src/cli', 'src/gateway'];

    function replaceInFile(filePath) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            const original = content;
            content = content.replace(/OpenClaw/g, 'JARVIS');
            content = content.replace(/Open-Claw/g, 'JARVIS');
            if (content !== original) {
                fs.writeFileSync(filePath, content);
                replacementCount++;
            }
        } catch { /* skip binary/unreadable files */ }
    }

    function walkDir(dir) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                walkDir(fullPath);
            } else if (entry.isFile() && targetExtensions.some(ext => entry.name.endsWith(ext))) {
                replaceInFile(fullPath);
            }
        }
    }

    for (const subDir of targetDirs) {
        walkDir(path.join(packageDir, subDir));
    }
    // Also rebrand root package.json
    replaceInFile(path.join(packageDir, 'package.json'));

    console.log(`Fallback rebranding touched ${replacementCount} files.`);
}
