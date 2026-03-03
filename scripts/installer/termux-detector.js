import { execSync } from 'child_process';

const isTermux = !!process.env.PREFIX && process.env.PREFIX.includes('com.termux');
if (isTermux) {
    console.log("Termux context implicitly detected. Verifying mechanical architecture compatibilities...");
    const archRaw = execSync('uname -m').toString().trim();
    const isArm64 = archRaw === 'aarch64' || archRaw === 'armv8l' || archRaw === 'arm64';
    if (!isArm64) {
        console.error(`[JARVIS] FATAL: ARM64 architecture explicitly required due to native downstream builds. Evaluated context returned: ${archRaw}.`);
        process.exit(1);
    }
    console.log("Termux architecture structurally validated.");
} else {
    console.log("Standard POSIX/NT install context. Skipping Termux invariants.");
}
