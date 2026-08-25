import type { AdapterDefinition, DataPayload } from "@bulletspace/core";
import { gatekeeper } from "../lib/gatekeeper";
import { generateCodeChallenge, generateCodeVerifier } from "../lib/pkce";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const TOKEN_STORAGE_KEY = "bulletspace.googleCalendar.tokens";

export const googleCalendarAdapterDefinition: AdapterDefinition = {
  id: "google-calendar-v1",
  name: "Google Calendar",
  version: "1.0.0",
  authType: "oauth_loopback",
  defaultTtlSeconds: 15 * 60,
  fields: [
    { id: "date", name: "Date", type: "date", description: "" },
    { id: "summary", name: "Event", type: "string", description: "" },
    { id: "duration_minutes", name: "Duration (min)", type: "number", description: "" },
  ],
};

function clientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!id) throw new Error("VITE_GOOGLE_CLIENT_ID is not configured.");
  return id;
}

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function loadTokens(): StoredTokens | null {
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as StoredTokens) : null;
}

function saveTokens(tokens: StoredTokens): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

export function isGoogleCalendarConnected(): boolean {
  return loadTokens() !== null;
}

export function disconnectGoogleCalendar(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

interface LoopbackAuthResult {
  redirectUri: string;
  query: Record<string, string>;
}

/**
 * Runs the loopback OAuth round trip via the Rust command (only Rust can
 * bind the TCP listener the redirect needs) then exchanges the resulting
 * code for tokens ourselves -- no secret required, since a "Desktop app"
 * Google OAuth client is a genuine public client. PKCE guards against
 * interception since the redirect touches a local port any process could
 * theoretically probe.
 */
export async function connectGoogleCalendar(): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateCodeVerifier();

  const result = await invoke<LoopbackAuthResult>("oauth_loopback_flow", {
    authUrlBase: AUTHORIZE_URL,
    params: {
      client_id: clientId(),
      response_type: "code",
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent",
      state,
    },
  });

  if (result.query.error) {
    throw new Error(result.query.error_description ?? result.query.error);
  }
  if (result.query.state !== state) {
    throw new Error("OAuth state mismatch -- possible interception, aborting.");
  }
  const code = result.query.code;
  if (!code) throw new Error("No authorization code returned.");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: result.redirectUri,
    client_id: clientId(),
    code_verifier: verifier,
  });

  const response = await gatekeeper.guardedFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const json = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  saveTokens({
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? "",
    expiresAt: Date.now() + json.expires_in * 1000,
  });
}

async function refreshAccessToken(refreshToken: string): Promise<StoredTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId(),
  });

  const response = await gatekeeper.guardedFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`);

  const json = (await response.json()) as { access_token: string; expires_in: number };
  const tokens: StoredTokens = {
    accessToken: json.access_token,
    refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  saveTokens(tokens);
  return tokens;
}

async function getValidAccessToken(): Promise<string> {
  let tokens = loadTokens();
  if (!tokens) throw new Error("Google Calendar is not connected.");
  if (tokens.expiresAt < Date.now() + 60_000) {
    if (!tokens.refreshToken) {
      throw new Error("No refresh token available -- disconnect and reconnect Google Calendar.");
    }
    tokens = await refreshAccessToken(tokens.refreshToken);
  }
  return tokens.accessToken;
}

export async function fetchCalendarEvents(): Promise<DataPayload> {
  const accessToken = await getValidAccessToken();

  const now = Date.now();
  const timeMin = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  const url = `${EVENTS_URL}?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

  const response = await gatekeeper.guardedFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Calendar request failed: ${response.status}`);

  const json = (await response.json()) as {
    items: Array<{
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };

  const rows = json.items.map((item) => {
    const startStr = item.start?.dateTime ?? item.start?.date ?? new Date().toISOString();
    const endStr = item.end?.dateTime ?? item.end?.date ?? startStr;
    const start = new Date(startStr);
    const end = new Date(endStr);
    return {
      date: start.toISOString(),
      summary: item.summary ?? "(no title)",
      duration_minutes: Math.round((end.getTime() - start.getTime()) / 60_000),
    };
  });

  return {
    fields: googleCalendarAdapterDefinition.fields,
    rows,
    _cachedAt: new Date().toISOString(),
    _source: googleCalendarAdapterDefinition.id,
  };
}
