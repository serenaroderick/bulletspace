export type NetworkState = "local" | "connected" | "ai";

export type RequestClassification = "standard" | "ai";

export interface NetworkRequestLogEntry {
  timestamp: number;
  url: string;
  method: string;
  classification: RequestClassification;
  allowed: boolean;
}

export class NetworkBlockedError extends Error {
  constructor(
    public readonly url: string,
    public readonly state: NetworkState,
    public readonly classification: RequestClassification,
  ) {
    super(`Blocked ${classification} request to "${url}" while network state is "${state}"`);
    this.name = "NetworkBlockedError";
  }
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * v1 scope: enforces the tri-state toggle against BulletSpace's own network
 * calls (via guardedFetch). Extensions are not sandboxed yet, so gatekeeper
 * enforcement does not extend to third-party code until Phase 5.
 *
 * The fetch implementation is injectable: on desktop, the web frontend
 * passes in Tauri's Rust-backed fetch (@tauri-apps/plugin-http) instead of
 * the webview's own fetch, since a native HTTP request isn't subject to
 * browser CORS at all -- this is what unblocks adapters like GitHub's
 * device flow, whose token endpoints refuse direct browser fetch() calls.
 * Defaults to the global fetch for the web build.
 */
export class NetworkGatekeeper {
  private state: NetworkState = "local";
  private log: NetworkRequestLogEntry[] = [];

  // Not resolved at construction time -- looking up the global `fetch`
  // lazily (in guardedFetch) rather than capturing it here means code that
  // reassigns `globalThis.fetch` after construction (real usage, or a
  // test stub) is still respected.
  constructor(private readonly fetchImpl?: FetchLike) {}

  getState(): NetworkState {
    return this.state;
  }

  setState(state: NetworkState): void {
    this.state = state;
  }

  isAllowed(classification: RequestClassification = "standard"): boolean {
    if (this.state === "local") return false;
    if (this.state === "connected") return classification === "standard";
    return true;
  }

  async guardedFetch(
    url: string,
    init?: RequestInit,
    classification: RequestClassification = "standard",
  ): Promise<Response> {
    const allowed = this.isAllowed(classification);
    this.log.push({
      timestamp: Date.now(),
      url,
      method: init?.method ?? "GET",
      classification,
      allowed,
    });

    if (!allowed) {
      throw new NetworkBlockedError(url, this.state, classification);
    }

    return (this.fetchImpl ?? fetch)(url, init);
  }

  getLog(): readonly NetworkRequestLogEntry[] {
    return this.log;
  }

  clearLog(): void {
    this.log = [];
  }
}
