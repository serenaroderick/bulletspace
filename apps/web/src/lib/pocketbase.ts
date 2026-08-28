import PocketBase, { type RecordModel } from "pocketbase";
import { gatekeeper } from "./gatekeeper";

const SERVER_URL_STORAGE_KEY = "bulletspace.pocketbase.serverUrl";
const DEFAULT_SERVER_URL = import.meta.env.VITE_POCKETBASE_URL ?? "http://127.0.0.1:8090";

function loadServerUrl(): string {
  return localStorage.getItem(SERVER_URL_STORAGE_KEY) ?? DEFAULT_SERVER_URL;
}

export const pb = new PocketBase(loadServerUrl());

export function getServerUrl(): string {
  return pb.baseURL;
}

/**
 * Lets a signed-out user point the client at any PocketBase instance --
 * a self-hosted one, or a public one someone else runs -- rather than
 * being locked to whatever VITE_POCKETBASE_URL was baked in at build
 * time. This is the "self-host for max privacy" tier from Phase 5's own
 * three-tier trust model in ROADMAP.md, not just a convenience setting.
 * Clears the current session: an auth token from one server is
 * meaningless (and potentially misleading) against a different one.
 */
export function setServerUrl(url: string): void {
  pb.authStore.clear();
  pb.baseURL = url;
  localStorage.setItem(SERVER_URL_STORAGE_KEY, url);
}

// Route every PocketBase request -- auth, CRUD, the SDK's own token
// auto-refresh -- through the same NetworkGatekeeper every adapter fetch
// goes through (see lib/gatekeeper.ts). This makes account sign-in/sync a
// first-class citizen of the tri-state toggle: Local Purist blocks it
// exactly like it blocks a weather adapter fetch, not via a separate
// ad-hoc check here.
pb.beforeSend = (url, options) => ({
  url,
  options: {
    ...options,
    fetch: (input: RequestInfo | URL, init?: RequestInit) => gatekeeper.guardedFetch(String(input), init),
  },
});

export interface AuthUser {
  id: string;
  email: string;
}

function toAuthUser(record: RecordModel): AuthUser {
  return { id: record.id, email: record.email as string };
}

export function getCurrentUser(): AuthUser | null {
  return pb.authStore.isValid && pb.authStore.record ? toAuthUser(pb.authStore.record) : null;
}

export function onAuthChange(callback: (user: AuthUser | null) => void): () => void {
  return pb.authStore.onChange((_token, record) => callback(record ? toAuthUser(record) : null), true);
}

export async function signUp(email: string, password: string): Promise<AuthUser> {
  await pb.collection("users").create({ email, password, passwordConfirm: password });
  return signIn(email, password);
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const { record } = await pb.collection("users").authWithPassword(email, password);
  return toAuthUser(record);
}

export function signOut(): void {
  pb.authStore.clear();
}
