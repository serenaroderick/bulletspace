# apps/backend

Phase 5's optional backend: [PocketBase](https://pocketbase.io) (a single
Go binary, embedded SQLite). Local Purist mode never touches this
regardless; only Connected/AI mode features (sync) do.

Deployed publicly on Railway: **https://bulletspace-backend-production.up.railway.app**
Dashboard: same host + `/_/`. Nothing in `apps/web` points at it by
default yet (`VITE_POCKETBASE_URL` still falls back to local dev) — the
production instance exists and is schema-verified, but no build has been
pointed at it as the default target yet.

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

## Deploying (Railway)

`Dockerfile` downloads the matching PocketBase Linux binary and bakes in
`pb_migrations/`; `pb_data/` lives on a persistent Railway volume mounted
at `/pb/pb_data` (not in the image, so it survives redeploys).

```bash
railway login             # personal account, not work
railway link              # or `railway init` for a fresh project
railway up
```

The volume has to be attached once via the Railway dashboard (Service →
Volumes → New Volume → mount path `/pb/pb_data`) — the `railway volume add`
CLI command reliably panics (`Option::unwrap()` on a `None` value,
`volume.rs:836`, CLI v5.45.2), so this is a manual one-time step, not
something scripted here. A public domain is a one-liner: `railway domain`.

First boot has no superuser yet, same as local — grab the one-time install
link from `railway logs` (it prints the same `#/pbinstal/<token>` fragment
as local dev, just swap in the Railway domain) and set a real production
password through it. Don't reuse the local dev superuser's disposable
credentials for this.

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
  verified live against both the local instance and the deployed Railway
  instance (not just read from the schema): a user can create/read their
  own rows, cross-user reads return 404 (not 403, so existence isn't
  leaked), impersonating another user's `owner` on create is rejected
  (400), and unauthenticated requests are blocked. `created`/`updated`
  autodate fields (`2_sync_blobs_timestamps.js`) support sorting to the
  most recently pushed blob per owner.

## What's not here yet

- `apps/web` doesn't point at the production URL by default — only local
  dev. Pointing a real build at it (env var, or a settings UI) hasn't
  been done.
- Google/GitHub OAuth2 for accounts — PocketBase supports this natively,
  deferred until a provider app is registered.
- OAuth relay for `oauth_client_secret` adapters — separate concern, not
  yet built, and nothing in the adapter lineup needs it yet (everything
  built so far found a secretless path).

Sign-up/sign-in and encrypted push/pull sync are both wired up and
verified live — see `apps/web/src/lib/pocketbase.ts`, `sync.ts`, and
`components/{AccountPanel,SyncPanel}.tsx`.
