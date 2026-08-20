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

/**
 * v1 scope: enforces the tri-state toggle against BulletSpace's own network
 * calls (via guardedFetch). Extensions are not sandboxed yet, so gatekeeper
 * enforcement does not extend to third-party code until Phase 5.
 */
export class NetworkGatekeeper {
  private state: NetworkState = "local";
  private log: NetworkRequestLogEntry[] = [];

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

    return fetch(url, init);
  }

  getLog(): readonly NetworkRequestLogEntry[] {
    return this.log;
  }

  clearLog(): void {
    this.log = [];
  }
}
