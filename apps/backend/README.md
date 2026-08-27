# apps/backend

Phase 5's optional backend: [PocketBase](https://pocketbase.io) (a single
Go binary, embedded SQLite). This is **local dev only** right now — nothing
here is deployed anywhere. Local Purist mode never touches this regardless;
only Connected/AI mode features (sync) will, once they're built.

## Running locally

```bash
brew install pocketbase   # once
cd apps/backend
pocketbase serve --http=127.0.0.1:8090
```

First run prompts you to create a superuser (admin) account — either via
the printed one-time setup link, or directly:

```bash
pocketbase superuser upsert you@example.com yourpassword
```

Dashboard: http://127.0.0.1:8090/_/
REST API: http://127.0.0.1:8090/api/

`pb_migrations/` (committed, defines schema as code) applies automatically
on startup. `pb_data/` (gitignored — the actual SQLite database and any
local file storage) is created next to this README on first run; delete it
any time to reset to a clean local instance.

## Schema

- **`users`** — PocketBase's built-in auth collection. Nothing custom
  needed for basic account sign-up/sign-in.
- **`sync_blobs`** — one row per (owner, journal). `encryptedPayload` is
  the client's `encryptWithPassword()` output (`packages/core/src/encryption.ts`)
  — salt/iv/ciphertext, opaque to the server without the user's password.
  This is what makes the "stateless, can't read your data" claim in
  PITCH.md literal rather than aspirational: the schema itself never
  stores plaintext.
  Access rules restrict every operation to `owner = @request.auth.id` —
  verified live (not just read from the schema): a user can create/read
  their own rows, cross-user reads return 404 (not 403, so existence
  isn't leaked), impersonating another user's `owner` on create is
  rejected (400), and unauthenticated requests are blocked.

## What's not here yet

- Nothing is deployed publicly. Phase 5 is being built local-first per
  ROADMAP.md's own philosophy — same as every other phase.
- Sign-up/sign-in (email/password) is wired up in `apps/web` — see
  `src/lib/pocketbase.ts` and `src/components/AccountPanel.tsx` — but
  nothing reads or writes `sync_blobs` yet. No sync client.
- Google/GitHub OAuth2 for accounts — PocketBase supports this natively,
  deferred until a provider app is registered.
- OAuth relay for `oauth_client_secret` adapters — separate concern,
  not yet built.
