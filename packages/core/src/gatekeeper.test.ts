import { describe, expect, it } from "vitest";
import { NetworkBlockedError, NetworkGatekeeper } from "./gatekeeper.js";

describe("NetworkGatekeeper", () => {
  it("defaults to local state and blocks everything", () => {
    const gatekeeper = new NetworkGatekeeper();
    expect(gatekeeper.getState()).toBe("local");
    expect(gatekeeper.isAllowed("standard")).toBe(false);
    expect(gatekeeper.isAllowed("ai")).toBe(false);
  });

  it("connected state allows standard requests but blocks ai requests", () => {
    const gatekeeper = new NetworkGatekeeper();
    gatekeeper.setState("connected");
    expect(gatekeeper.isAllowed("standard")).toBe(true);
    expect(gatekeeper.isAllowed("ai")).toBe(false);
  });

  it("ai state allows everything", () => {
    const gatekeeper = new NetworkGatekeeper();
    gatekeeper.setState("ai");
    expect(gatekeeper.isAllowed("standard")).toBe(true);
    expect(gatekeeper.isAllowed("ai")).toBe(true);
  });

  it("guardedFetch throws NetworkBlockedError when disallowed", async () => {
    const gatekeeper = new NetworkGatekeeper();
    await expect(gatekeeper.guardedFetch("https://example.com")).rejects.toBeInstanceOf(
      NetworkBlockedError,
    );
  });

  it("logs every request attempt, allowed or not", async () => {
    const gatekeeper = new NetworkGatekeeper();

    await expect(gatekeeper.guardedFetch("https://blocked.example.com")).rejects.toThrow();

    gatekeeper.setState("ai");
    global.fetch = async () => new Response("ok");
    await gatekeeper.guardedFetch("https://allowed.example.com", undefined, "ai");

    const log = gatekeeper.getLog();
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ url: "https://blocked.example.com", allowed: false });
    expect(log[1]).toMatchObject({ url: "https://allowed.example.com", allowed: true });
  });

  it("clearLog empties the request log", async () => {
    const gatekeeper = new NetworkGatekeeper();
    await expect(gatekeeper.guardedFetch("https://blocked.example.com")).rejects.toThrow();
    expect(gatekeeper.getLog()).toHaveLength(1);

    gatekeeper.clearLog();
    expect(gatekeeper.getLog()).toHaveLength(0);
  });
});
