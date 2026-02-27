import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it.each([
    {
      name: "help flag",
      argv: ["node", "jarvis", "--help"],
      expected: true,
    },
    {
      name: "version flag",
      argv: ["node", "jarvis", "-V"],
      expected: true,
    },
    {
      name: "normal command",
      argv: ["node", "jarvis", "status"],
      expected: false,
    },
    {
      name: "root -v alias",
      argv: ["node", "jarvis", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "jarvis", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with log-level",
      argv: ["node", "jarvis", "--log-level", "debug", "-v"],
      expected: true,
    },
    {
      name: "subcommand -v should not be treated as version",
      argv: ["node", "jarvis", "acp", "-v"],
      expected: false,
    },
    {
      name: "root -v alias with equals profile",
      argv: ["node", "jarvis", "--profile=work", "-v"],
      expected: true,
    },
    {
      name: "subcommand path after global root flags should not be treated as version",
      argv: ["node", "jarvis", "--dev", "skills", "list", "-v"],
      expected: false,
    },
  ])("detects help/version flags: $name", ({ argv, expected }) => {
    expect(hasHelpOrVersion(argv)).toBe(expected);
  });

  it.each([
    {
      name: "single command with trailing flag",
      argv: ["node", "jarvis", "status", "--json"],
      expected: ["status"],
    },
    {
      name: "two-part command",
      argv: ["node", "jarvis", "agents", "list"],
      expected: ["agents", "list"],
    },
    {
      name: "terminator cuts parsing",
      argv: ["node", "jarvis", "status", "--", "ignored"],
      expected: ["status"],
    },
  ])("extracts command path: $name", ({ argv, expected }) => {
    expect(getCommandPath(argv, 2)).toEqual(expected);
  });

  it.each([
    {
      name: "returns first command token",
      argv: ["node", "jarvis", "agents", "list"],
      expected: "agents",
    },
    {
      name: "returns null when no command exists",
      argv: ["node", "jarvis"],
      expected: null,
    },
  ])("returns primary command: $name", ({ argv, expected }) => {
    expect(getPrimaryCommand(argv)).toBe(expected);
  });

  it.each([
    {
      name: "detects flag before terminator",
      argv: ["node", "jarvis", "status", "--json"],
      flag: "--json",
      expected: true,
    },
    {
      name: "ignores flag after terminator",
      argv: ["node", "jarvis", "--", "--json"],
      flag: "--json",
      expected: false,
    },
  ])("parses boolean flags: $name", ({ argv, flag, expected }) => {
    expect(hasFlag(argv, flag)).toBe(expected);
  });

  it.each([
    {
      name: "value in next token",
      argv: ["node", "jarvis", "status", "--timeout", "5000"],
      expected: "5000",
    },
    {
      name: "value in equals form",
      argv: ["node", "jarvis", "status", "--timeout=2500"],
      expected: "2500",
    },
    {
      name: "missing value",
      argv: ["node", "jarvis", "status", "--timeout"],
      expected: null,
    },
    {
      name: "next token is another flag",
      argv: ["node", "jarvis", "status", "--timeout", "--json"],
      expected: null,
    },
    {
      name: "flag appears after terminator",
      argv: ["node", "jarvis", "--", "--timeout=99"],
      expected: undefined,
    },
  ])("extracts flag values: $name", ({ argv, expected }) => {
    expect(getFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "jarvis", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "jarvis", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "jarvis", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it.each([
    {
      name: "missing flag",
      argv: ["node", "jarvis", "status"],
      expected: undefined,
    },
    {
      name: "missing value",
      argv: ["node", "jarvis", "status", "--timeout"],
      expected: null,
    },
    {
      name: "valid positive integer",
      argv: ["node", "jarvis", "status", "--timeout", "5000"],
      expected: 5000,
    },
    {
      name: "invalid integer",
      argv: ["node", "jarvis", "status", "--timeout", "nope"],
      expected: undefined,
    },
  ])("parses positive integer flag values: $name", ({ argv, expected }) => {
    expect(getPositiveIntFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("builds parse argv from raw args", () => {
    const cases = [
      {
        rawArgs: ["node", "jarvis", "status"],
        expected: ["node", "jarvis", "status"],
      },
      {
        rawArgs: ["node-22", "jarvis", "status"],
        expected: ["node-22", "jarvis", "status"],
      },
      {
        rawArgs: ["node-22.2.0.exe", "jarvis", "status"],
        expected: ["node-22.2.0.exe", "jarvis", "status"],
      },
      {
        rawArgs: ["node-22.2", "jarvis", "status"],
        expected: ["node-22.2", "jarvis", "status"],
      },
      {
        rawArgs: ["node-22.2.exe", "jarvis", "status"],
        expected: ["node-22.2.exe", "jarvis", "status"],
      },
      {
        rawArgs: ["/usr/bin/node-22.2.0", "jarvis", "status"],
        expected: ["/usr/bin/node-22.2.0", "jarvis", "status"],
      },
      {
        rawArgs: ["node24", "jarvis", "status"],
        expected: ["node24", "jarvis", "status"],
      },
      {
        rawArgs: ["/usr/bin/node24", "jarvis", "status"],
        expected: ["/usr/bin/node24", "jarvis", "status"],
      },
      {
        rawArgs: ["node24.exe", "jarvis", "status"],
        expected: ["node24.exe", "jarvis", "status"],
      },
      {
        rawArgs: ["nodejs", "jarvis", "status"],
        expected: ["nodejs", "jarvis", "status"],
      },
      {
        rawArgs: ["node-dev", "jarvis", "status"],
        expected: ["node", "jarvis", "node-dev", "jarvis", "status"],
      },
      {
        rawArgs: ["jarvis", "status"],
        expected: ["node", "jarvis", "status"],
      },
      {
        rawArgs: ["bun", "src/entry.ts", "status"],
        expected: ["bun", "src/entry.ts", "status"],
      },
    ] as const;

    for (const testCase of cases) {
      const parsed = buildParseArgv({
        programName: "jarvis",
        rawArgs: [...testCase.rawArgs],
      });
      expect(parsed).toEqual([...testCase.expected]);
    }
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "jarvis",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "jarvis", "status"]);
  });

  it("decides when to migrate state", () => {
    const nonMutatingArgv = [
      ["node", "jarvis", "status"],
      ["node", "jarvis", "health"],
      ["node", "jarvis", "sessions"],
      ["node", "jarvis", "config", "get", "update"],
      ["node", "jarvis", "config", "unset", "update"],
      ["node", "jarvis", "models", "list"],
      ["node", "jarvis", "models", "status"],
      ["node", "jarvis", "memory", "status"],
      ["node", "jarvis", "agent", "--message", "hi"],
    ] as const;
    const mutatingArgv = [
      ["node", "jarvis", "agents", "list"],
      ["node", "jarvis", "message", "send"],
    ] as const;

    for (const argv of nonMutatingArgv) {
      expect(shouldMigrateState([...argv])).toBe(false);
    }
    for (const argv of mutatingArgv) {
      expect(shouldMigrateState([...argv])).toBe(true);
    }
  });

  it.each([
    { path: ["status"], expected: false },
    { path: ["config", "get"], expected: false },
    { path: ["models", "status"], expected: false },
    { path: ["agents", "list"], expected: true },
  ])("reuses command path for migrate state decisions: $path", ({ path, expected }) => {
    expect(shouldMigrateStateFromPath(path)).toBe(expected);
  });
});
