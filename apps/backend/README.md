# apps/backend

Phase 5's optional backend: [PocketBase](https://pocketbase.io) (a single
Go binary, embedded SQLite). Local Purist mode never touches this
regardless; only Connected/AI mode features (sync) do.

Deployed publicly on Railway: **https://bulletspace-backend-production.up.railway.app**
Dashboard: same host + `/_/`. `apps/web` still *defaults* to local dev
(`VITE_POCKETBASE_URL`'s fallback is unchanged) — but a signed-out user
can now point their client at any instance, including this one, via the
"Server" field in `AccountPanel` (`getServerUrl`/`setServerUrl` in
`lib/pocketbase.ts`, persisted to localStorage). Verified live: pointed a
real running dev build at the production URL and signed up against it
through the actual UI, not just curl.
**Deliberately not changed:** the build-time default. Making the public
Railway instance the out-of-the-box default for anyone who builds this
app would put their traffic on this project's own billing account with
no rate-limiting in place yet — that's a real product decision, not
something to fall out of a settings feature.

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

- No rate limiting or abuse protection on the public instance yet — fine
  for one developer's own testing, not fine as a real shared default.
- Google/GitHub OAuth2 for accounts — PocketBase supports this natively,
  deferred until a provider app is registered.
- OAuth relay for `oauth_client_secret` adapters — separate concern, not
  yet built, and nothing in the adapter lineup needs it yet (everything
  built so far found a secretless path).

Sign-up/sign-in and encrypted push/pull sync are both wired up and
verified live — see `apps/web/src/lib/pocketbase.ts`, `sync.ts`, and
`components/{AccountPanel,SyncPanel}.tsx`.
