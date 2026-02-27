import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("jarvis", 16)).toBe("jarvis");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("jarvis-status-output", 10)).toBe("jarvis-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
