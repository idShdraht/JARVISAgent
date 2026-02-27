import { vi } from "vitest";
import { installChromeUserDataDirHooks } from "./chrome-user-data-dir.test-harness.js";

const chromeUserDataDir = { dir: "/tmp/jarvis" };
installChromeUserDataDirHooks(chromeUserDataDir);

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: vi.fn(async () => true),
  isChromeReachable: vi.fn(async () => true),
  launchJARVISChrome: vi.fn(async () => {
    throw new Error("unexpected launch");
  }),
  resolveJARVISUserDataDir: vi.fn(() => chromeUserDataDir.dir),
  stopJARVISChrome: vi.fn(async () => {}),
}));
