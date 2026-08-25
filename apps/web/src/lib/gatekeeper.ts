import { NetworkGatekeeper } from "@bulletspace/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { isTauri } from "./platform";

// On desktop, route every guardedFetch call through Tauri's Rust-backed
// fetch instead of the webview's own fetch -- a native HTTP request isn't
// subject to browser CORS at all, which is what unblocks adapters like
// GitHub's device flow (blocked on web purely by CORS, not by needing a
// secret). See packages/core/src/gatekeeper.ts for the injectable fetch.
export const gatekeeper = new NetworkGatekeeper(isTauri() ? tauriFetch : undefined);
