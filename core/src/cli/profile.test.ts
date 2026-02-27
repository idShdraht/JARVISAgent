import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "jarvis",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "jarvis", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "jarvis", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "jarvis", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "jarvis", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "jarvis", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "jarvis", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "jarvis", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "jarvis", "--profile", "work", "--dev", "status"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".jarvis-dev");
    expect(env.JARVIS_PROFILE).toBe("dev");
    expect(env.JARVIS_STATE_DIR).toBe(expectedStateDir);
    expect(env.JARVIS_CONFIG_PATH).toBe(path.join(expectedStateDir, "jarvis.json"));
    expect(env.JARVIS_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      JARVIS_STATE_DIR: "/custom",
      JARVIS_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.JARVIS_STATE_DIR).toBe("/custom");
    expect(env.JARVIS_GATEWAY_PORT).toBe("19099");
    expect(env.JARVIS_CONFIG_PATH).toBe(path.join("/custom", "jarvis.json"));
  });

  it("uses JARVIS_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      JARVIS_HOME: "/srv/jarvis-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/jarvis-home");
    expect(env.JARVIS_STATE_DIR).toBe(path.join(resolvedHome, ".jarvis-work"));
    expect(env.JARVIS_CONFIG_PATH).toBe(
      path.join(resolvedHome, ".jarvis-work", "jarvis.json"),
    );
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "jarvis doctor --fix",
      env: {},
      expected: "jarvis doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "jarvis doctor --fix",
      env: { JARVIS_PROFILE: "default" },
      expected: "jarvis doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "jarvis doctor --fix",
      env: { JARVIS_PROFILE: "Default" },
      expected: "jarvis doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "jarvis doctor --fix",
      env: { JARVIS_PROFILE: "bad profile" },
      expected: "jarvis doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "jarvis --profile work doctor --fix",
      env: { JARVIS_PROFILE: "work" },
      expected: "jarvis --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "jarvis --dev doctor",
      env: { JARVIS_PROFILE: "dev" },
      expected: "jarvis --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("jarvis doctor --fix", { JARVIS_PROFILE: "work" })).toBe(
      "jarvis --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("jarvis doctor --fix", { JARVIS_PROFILE: "  jbjarvis  " })).toBe(
      "jarvis --profile jbjarvis doctor --fix",
    );
  });

  it("handles command with no args after jarvis", () => {
    expect(formatCliCommand("jarvis", { JARVIS_PROFILE: "test" })).toBe(
      "jarvis --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm jarvis doctor", { JARVIS_PROFILE: "work" })).toBe(
      "pnpm jarvis --profile work doctor",
    );
  });
});
