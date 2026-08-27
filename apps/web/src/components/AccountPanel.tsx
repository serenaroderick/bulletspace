import type { Entry, Journal, NetworkState } from "@bulletspace/core";
import { type FormEvent, useEffect, useState } from "react";
import { type AuthUser, getCurrentUser, onAuthChange, signIn, signOut, signUp } from "../lib/pocketbase";
import type { PulledJournal } from "../lib/sync";
import { SyncPanel } from "./SyncPanel";

interface AccountPanelProps {
  networkState: NetworkState;
  journal: Journal;
  entries: Entry[];
  onPulled: (pulled: PulledJournal) => Promise<void>;
}

export function AccountPanel({ networkState, journal, entries, onPulled }: AccountPanelProps) {
  const [user, setUser] = useState<AuthUser | null>(getCurrentUser());
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => onAuthChange(setUser), []);

  const canUseNetwork = networkState !== "local";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      setEmail("");
      setPassword("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div className="account-panel">
        <span title={user.email}>{user.email}</span>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
        <SyncPanel journal={journal} entries={entries} onPulled={onPulled} />
      </div>
    );
  }

  if (!canUseNetwork) {
    return (
      <div className="account-panel">
        <span className="empty">Switch to Online mode to sign in.</span>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="account-panel">
        <button type="button" onClick={() => setOpen(true)}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="account-panel">
      <form className="account-form" onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          aria-label="Email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          aria-label="Password"
          minLength={8}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        <button type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Have an account?" : "Need an account?"}
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </form>
      {error && <p className="import-error">{error}</p>}
    </div>
  );
}
