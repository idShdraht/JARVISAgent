import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#jarvis",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#jarvis",
      rawTarget: "#jarvis",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "jarvis-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "jarvis-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "jarvis-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "jarvis-bot",
      rawTarget: "jarvis-bot",
    });
  });
});
