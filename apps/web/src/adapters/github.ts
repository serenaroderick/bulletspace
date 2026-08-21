import type { AdapterDefinition, DataPayload } from "@bulletspace/core";
import { gatekeeper } from "../lib/gatekeeper";

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";
const SCOPE = "read:user";

const TOKEN_STORAGE_KEY = "bulletspace.github.token";

export const githubAdapterDefinition: AdapterDefinition = {
  id: "github-v1",
  name: "GitHub Activity",
  version: "1.0.0",
  authType: "device_flow",
  defaultTtlSeconds: 60 * 60,
  fields: [
    { id: "occurred_at", name: "Occurred At", type: "date", description: "When the event happened" },
    { id: "type", name: "Event Type", type: "string", description: "e.g. PushEvent, CreateEvent" },
    { id: "repo_name", name: "Repository", type: "string", description: "" },
  ],
};

function clientId(): string {
  const id = import.meta.env.VITE_GITHUB_CLIENT_ID;
  if (!id) throw new Error("VITE_GITHUB_CLIENT_ID is not configured.");
  return id;
}

export function isGithubConnected(): boolean {
  return localStorage.getItem(TOKEN_STORAGE_KEY) !== null;
}

export function disconnectGithub(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export interface DeviceAuthStart {
  userCode: string;
  verificationUri: string;
  deviceCode: string;
  interval: number;
  expiresAt: number;
}

export async function startGithubDeviceAuth(): Promise<DeviceAuthStart> {
  const response = await gatekeeper.guardedFetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId(), scope: SCOPE }).toString(),
  });

  if (!response.ok) throw new Error(`Failed to start device auth: ${response.status}`);

  const json = (await response.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };

  return {
    userCode: json.user_code,
    verificationUri: json.verification_uri,
    deviceCode: json.device_code,
    interval: json.interval,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

export type PollResult =
  | { status: "authorized" }
  | { status: "pending" }
  | { status: "error"; error: string };

export async function pollGithubDeviceAuth(deviceCode: string): Promise<PollResult> {
  const response = await gatekeeper.guardedFetch(TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }).toString(),
  });

  const json = (await response.json()) as { access_token?: string; error?: string };

  if (json.access_token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, json.access_token);
    return { status: "authorized" };
  }

  if (json.error === "authorization_pending" || json.error === "slow_down") {
    return { status: "pending" };
  }

  return { status: "error", error: json.error ?? "Unknown error" };
}

export async function fetchGithubActivity(): Promise<DataPayload> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) throw new Error("GitHub is not connected.");

  const userResponse = await gatekeeper.guardedFetch(USER_URL, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!userResponse.ok) throw new Error(`GitHub user lookup failed: ${userResponse.status}`);
  const user = (await userResponse.json()) as { login: string };

  const eventsResponse = await gatekeeper.guardedFetch(
    `https://api.github.com/users/${user.login}/events?per_page=30`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } },
  );
  if (!eventsResponse.ok) throw new Error(`GitHub events request failed: ${eventsResponse.status}`);

  const events = (await eventsResponse.json()) as Array<{
    created_at: string;
    type: string;
    repo: { name: string };
  }>;

  const rows = events.map((event) => ({
    occurred_at: event.created_at,
    type: event.type,
    repo_name: event.repo.name,
  }));

  return {
    fields: githubAdapterDefinition.fields,
    rows,
    _cachedAt: new Date().toISOString(),
    _source: githubAdapterDefinition.id,
  };
}
