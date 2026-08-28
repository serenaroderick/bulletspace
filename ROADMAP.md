# Roadmap

Development plan for BulletSpace, built solo. Each phase ships something
usable. See [PITCH.md](PITCH.md) for the product vision this roadmap
implements.

## Phase 0: Core Library

**Goal:** solid foundation. Pure TypeScript, no UI.

- [x] pnpm monorepo with `packages/core`, `apps/web`
- [x] TypeScript types for journals, entries, canvas elements
- [x] TypeScript types for modules and data adapters (`AdapterDefinition`,
      `ModuleDefinition`, `DataPayload` — see
      [`packages/core/src/modules.ts`](packages/core/src/modules.ts))
- [x] `NetworkGatekeeper` with tri-state logic
- [x] `DatabaseAdapter` interface + `IndexedDBAdapter` + `InMemoryAdapter`
- [x] Module/adapter JSON schema designed — `merge` module type reserved
      (join semantics deliberately unresolved until Phase 2), per-adapter
      `defaultTtlSeconds` for cache freshness, `version` field on both
      (no `migrations` mechanism yet — premature before a real schema
      change exists to inform its shape)
- [x] Trusted Creator policy documented (see below — free, it's a doc, not code)
- [x] Unit tests (Vitest)
- [x] `guardedFetch` established as the only path for outbound network calls
      (design rule now; gets enforced against real adapter code starting Phase 1)

**Success criteria:** `pnpm test` passes. Schema validates. No UI yet.

*(Status: done — see [`packages/core`](packages/core), 27 passing tests.)*

## Phase 1: Web MVP

**Goal:** a working journal. Hardcoded modules proving the schema.

- [x] Vite + React setup
- [x] Canvas component with dot-grid (pan/zoom via React-Konva, `canvasConfig`
      persisted per entry)
- [x] Markdown editor with `[[link]]` support (edit/preview, backlinks panel,
      click-to-navigate, creates a stub entry if the target doesn't exist)
- [x] SQLite (IndexedDB) CRUD wired to the UI
- [x] Tri-state toggle in UI
- [x] 2-3 hardcoded modules (habit streak grid, mood line chart) — no editor UI
- [x] First live adapter: **weather** (`authType: 'api_key'`), supporting
      both OpenWeatherMap and Weatherstack — live-verified end to end via
      Weatherstack (real 200 response, correctly parsed and rendered,
      gated behind Connected/AI mode by the network toggle). OpenWeatherMap
      code path is written and matches their documented response shape but
      unverified live — the test key returned 401 both times we checked,
      consistent with their documented "new keys take up to ~2 hours to
      activate," not a code problem.
- [x] Basic import/export (JSON) — full round-trip verified (export → delete
      all → import → data restored)

**First live adapter — how we actually got here:** Spotify (`pkce`) was the
original plan since it's the one provider with genuinely CORS-enabled,
secretless PKCE from a pure browser — but the Spotify account being
developed against is gated behind Premium for Web API access, blocking live
verification today (code is not written; revisit once Premium is active).
GitHub (`device_flow`) was tried next, and its code is complete in
[`apps/web/src/adapters/github.ts`](apps/web/src/adapters/github.ts) and
[`GithubModule.tsx`](apps/web/src/components/modules/GithubModule.tsx) — but
**GitHub's device-flow token endpoints don't send CORS headers at all**,
confirmed by live testing (`net::ERR_FAILED` before the request even reaches
GitHub). That's not a secret-in-browser problem like Google's — it's that
the endpoint refuses direct browser `fetch()` full stop. The fix isn't the
Phase 5 backend relay; it's Tauri's native HTTP client once Phase 3 exists,
which isn't subject to browser CORS at all (see Phase 3 note below). The
component is intentionally left out of the shipped dashboard for now so we
don't ship a button that always errors. OpenWeatherMap (`api_key`, no OAuth
at all) has neither problem and is what's actually live today.

**Success criteria:** you can journal daily. Modules render live data.
Gatekeeper works. The weather adapter proves a real `guardedFetch`-routed
network call end to end, verified live against the real API.

## Phase 1.5: Polish

**Goal:** stability and feedback.

- [x] Bug fixes — first pass done via a self-directed code + live-browser
      audit (before any real daily-use feedback came in): fixed silent data
      loss (closing an entry or clicking a wikilink mid-edit discarded
      changes with no warning — now confirms, and also warns on tab
      close/refresh), no delete confirmation, mood value not clamped to
      1-10 (and the native HTML `min`/`max` on that field was silently
      **blocking form submission entirely** on out-of-range input — worse
      than the bug it was meant to prevent), a horizontal-overflow bug
      (single long unbroken strings didn't wrap) and a related one
      (`MoodLineChart`'s SVG had a fixed pixel width that didn't shrink on
      mobile), and an unvalidated import path that could crash on
      malformed JSON. Keyboard navigation/focus order/accessibility
      audited and found already solid, no changes needed there.
- [ ] UX improvements based on daily use — pending actual usage
- [ ] Community testing (friends, early adopters)

## Phase 2: Query Engine

**Goal:** one unified pipeline (fetch → merge/join → filter → formula →
sort/group → output) replacing the separate "Reactive Data Engine" and
"YAML Query Block" concepts — not built twice.

- [x] `merge` module type implemented — join semantics resolved: inner or
      left join, day/week/month/exact granularity (day is the default,
      matching the shape every adapter built so far actually produces —
      one reading per day). Simplification: only the first row per join
      key per source is used; this is not a full relational join engine.
      See [`packages/core/src/queryEngine.ts`](packages/core/src/queryEngine.ts).
      One real gap this surfaced: the join key field name must match
      *exactly* across every source's raw row (`row[joinOn]`, no semantic
      inference) — `weatherAdapterDefinition` originally used `recorded_at`
      while `journalAdapterDefinition` used `date`, which silently
      produced zero merged rows until caught by live testing. Fixed by
      standardizing on `date` as the join-key convention; documented in
      both adapter files.
- [x] The rest of the unified pipeline: `filter`/`formula`/`sort`/`group`
      transformations, all tested. Filter/formula expressions are
      deliberately minimal (`"field > value"`, `"target = a + b"`) and
      **not** `eval()`/`new Function()` — no arbitrary code, matching the
      declarative-Modules trust tier from PITCH.md. `group` sums every
      numeric field per group key; there's no per-field aggregation
      function in the schema yet, so this is a documented default rather
      than a richer aggregation DSL that isn't needed yet.
- [x] SQLite-backed cache for adapter data (stale-while-revalidate, keyed
      off each adapter's `defaultTtlSeconds`) — `DatabaseAdapter` gained
      `getCachedAdapterData`/`setCachedAdapterData`, backed by a new
      IndexedDB object store (`IndexedDBAdapter` bumped to schema v2, with
      an upgrade path that doesn't disturb existing stores). SWR fetch
      helper in `apps/web/src/lib/adapterCache.ts`: returns cached data
      immediately (fresh or stale), and if stale, revalidates in the
      background and updates the UI when that resolves.
- [x] Offline banner — `useOnlineStatus()` hook + a banner shown in the
      Weather module when offline, naming the cached-from time.
- [x] First real `merge` module: **Mood vs. Weather**, wired end to end
      through the query engine — a `journal` pseudo-adapter wraps local
      entries (mood/energy/focus) as a query-engine data source, joined
      against the cached weather payload on `date`. Verified live: created
      a mood-8 entry, connected weather, got a real correlated row
      (`2026-08-21, mood 8, 14°C`) with zero console errors.
- [x] Charts (bar, scatter) — reusable SVG components
      ([`BarChart.tsx`](apps/web/src/components/charts/BarChart.tsx),
      [`ScatterChart.tsx`](apps/web/src/components/charts/ScatterChart.tsx)),
      hand-rolled rather than pulling in Chart.js — keeps bundle size down
      and matches the pattern the Phase 1 line chart already established.
      Chart.js remains a reasonable swap-in later if richer chart types are
      needed. Both driven by a generic `ModuleOutputRenderer` that
      dispatches on `ModuleOutput.type`/`config.chartType`, so a
      `ModuleDefinition`'s declared output actually determines what
      renders — not a per-module hardcoded choice.
- [x] Reactive tables (Airtable-like) — the same `ModuleOutputRenderer`'s
      table branch. "Reactive" specifically means: clicking a column header
      re-sorts using the query engine's own `applyTransformation` sort
      transformation, not a bespoke client-side sort, so the displayed
      order is always something the pipeline itself could produce. No
      inline cell editing yet — everything rendered this way is
      adapter/computed data, not raw user-owned rows, so there's nothing
      to edit in place yet.
- [x] Mood vs. Weather gained a Chart/Table toggle rendering the *same*
      merged payload through both `ModuleOutputRenderer` branches —
      verified live: scatter view showed a point, switching to table
      showed all 7 fields (`date`, `mood.rating`, `mood.energy`,
      `mood.focus`, `weather.temperature_c`, `weather.condition`,
      `weather.humidity`) with working sortable headers (▲/▼ toggle
      confirmed), switching back to chart still worked, zero console
      errors.
- [x] More hardcoded modules — substituted **workout log / sleep log**
      for **Energy/Focus chart** and **Tag Frequency**: `Entry` has no
      dedicated workout/sleep fields, and inventing them ad hoc would be
      exactly the kind of schema hack the module/adapter system exists to
      avoid needing later. Energy/Focus reuses fields already on `Entry`
      (parallel to the Phase 1 mood chart); Tag Frequency is a bar chart
      of tag usage built on the new `BarChart` component. Neither had a
      way to produce real data before this pass — the entry form only had
      title/content/mood — so energy/focus/tags inputs were added to the
      create form too (`clampRating`/`parseTags` helpers, tested).

Grows the template count without building a Template Library *system* yet.

**Success criteria:** 10+ hardcoded modules you actually use daily,
including at least one `merge` module (e.g. mood vs. weather) — **done**
for the merge module. Dashboard is at 6 modules now (habit streak, mood
chart, energy/focus chart, tag frequency, mood-vs-weather merge, weather),
still short of 10 total.

## Phase 3: Desktop Port

**Goal:** native performance and file system access.

- [x] Tauri setup — `apps/desktop` wraps the existing `apps/web` frontend
      unmodified (`devUrl`/`frontendDist` point at it, nothing duplicated).
      Verified live: real native window, dev mode hot-reloads correctly.
- [x] File system adapter (replaces IndexedDB) — `FileSystemAdapter` in
      `apps/web/src/lib/fileSystemAdapter.ts`, backed by
      `@tauri-apps/plugin-store` (a single JSON file, collections emulated
      via key prefixes, same shape `IndexedDBAdapter` exposes).
      `lib/db.ts` picks the adapter at runtime via a `window.__TAURI_INTERNALS__`
      check — zero call-site changes needed anywhere else in the app.
      Verified live by reading the actual file on disk
      (`~/Library/Application Support/space.bulletspace.app/bulletspace.json`
      on macOS — Tauri's standard app-data location, not
      `~/Documents/BulletSpace/` as originally guessed; Application Support
      is the OS-conventional place for app-managed data a user isn't meant
      to browse directly) — a real journal entry was sitting in it exactly
      as created through the UI.
- [x] **Bug found via that live inspection, not code review**: React 18
      StrictMode's dev-mode double-invoke fired the "find or create the
      default journal" effect twice before either write landed, racing two
      empty `listJournals()` reads into two `createJournal()` calls —
      confirmed by two "My Journal" rows with identical timestamps sitting
      in the real file. This bug has existed since Phase 1; IndexedDB's
      opaque storage just never surfaced it as directly. Fixed by
      memoizing the whole find-or-create sequence behind a single shared
      promise (`lib/journal.ts`), so concurrent callers all await the same
      in-flight result instead of each racing their own check. 3 new
      tests, including one that fires two concurrent calls the way
      StrictMode does and asserts only one journal gets created.
- [x] Route adapter network calls through Tauri's Rust-side HTTP client
      (`tauri-plugin-http` + `@tauri-apps/plugin-http`) instead of the
      webview's `fetch()`. `NetworkGatekeeper` now takes an injectable
      fetch implementation (defaults to the global `fetch`, looked up
      lazily per call so runtime monkey-patching — real usage or test
      stubs — still works); the desktop build injects Tauri's fetch.
      HTTP permission scope is explicitly allowlisted per domain in
      `capabilities/default.json` (GitHub, weather providers, Spotify,
      Google) rather than a wildcard — matches the app's own
      privacy-first, least-privilege ethos.
      **Verified live and it unblocked the GitHub adapter exactly as
      predicted**: the CORS error is gone (confirmed — the request now
      reaches GitHub and gets a real HTTP response, not a browser-level
      rejection). What surfaced instead was `device_flow_disabled` —
      unrelated to this fix, just the "Enable Device Flow" checkbox on
      the GitHub OAuth App not being (or no longer being) checked.
      GithubModule is now shown only when `isTauri()` — still genuinely
      broken on web, so it stays hidden there.
- [x] Native menus and shortcuts — File menu (New Entry/Export JSON/Import
      JSON with Cmd/Ctrl+N/E/I), standard macOS Edit menu (cut/copy/paste/
      undo/redo/select-all — needed for those to work correctly in custom
      text areas), and the standard app menu (About/Hide/Quit). Rust emits
      named events on menu/accelerator activation; the frontend listens
      via `@tauri-apps/api/event` only when `isTauri()`. Verified live,
      including catching two real bugs along the way:
      - Testing confusion from a **stale release build** running
        alongside a fresh dev instance — clicking a menu item worked
        (fresh instance) while the keyboard shortcut appeared not to
        (actually landed on the stale instance). Not a code bug; resolved
        by killing all instances and testing against exactly one. Worth
        remembering: always confirm you're testing against the process
        you think you are before concluding something's broken.
      - **A real bug**: Export used the browser `<a download>` + blob-URL
        trick, which doesn't reliably produce a save dialog inside
        Tauri's webview (WKWebView) — confirmed live, the click did
        nothing visible. Fixed with the proper native equivalent
        (`tauri-plugin-dialog`'s save picker + `tauri-plugin-fs`'s
        `writeTextFile`) on desktop, while web keeps the original
        browser-native approach unchanged (still verified working, no
        regression). `apps/web/src/lib/exportFile.ts` picks the right
        path per platform.
- [x] Google Calendar adapter (`authType: 'oauth_loopback'`) — **verified
      live end to end**: connect → browser opens Google's consent screen →
      grant access → redirects back → real calendar events render in the
      module. This is the one adapter that needed genuinely new native
      capability, not just routing: a generic `oauth_loopback_flow` Tauri
      command (`apps/desktop/src-tauri/src/oauth_loopback.rs`) binds an
      ephemeral localhost port, opens the system browser via the `open`
      crate, waits (5 min timeout) for the single redirect, parses its
      query string, and returns it — reusable by any future
      `oauth_loopback` adapter, not Google-specific; all provider logic
      (scopes, PKCE, token exchange, field mapping) stays in TypeScript,
      same as every other adapter. This is also the first real use of the
      PKCE helper built back in Phase 1 for Spotify, which never got used
      there since that account needed Premium — nice to see it land
      somewhere.
      Two setup-only snags hit along the way, neither a code problem:
      Google's `access_denied` (OAuth consent screen in "Testing" mode
      requires explicitly adding your own account under Test Users) and
      the browser needing to actually complete sign-in before the
      loopback listener receives anything.
- [ ] Build for Windows/macOS/Linux — realistically this environment can
      only build and verify macOS/arm64; Windows/Linux need either those
      OSes or a cross-compilation setup, not attempted here

**Success criteria:** desktop app runs, saves locally via the OS-standard
app-data directory — **done** on macOS. GitHub adapter going live here,
backend-free — **done**, pending only the Device Flow checkbox on the
GitHub App itself (a one-time setup step, not a code gap). Google Calendar
adapter going live here, backend-free — **done**, fully verified live.

## Phase 4: Manual Sharing

**Goal:** test whether people actually want to share modules — without
building a marketplace UI.

- [x] Export/import module + adapter JSON, copy-paste level — but not
      quite "module + adapter" as literally written. Only the **Module**
      (declarative JSON) travels as real content; **Adapters** are
      executable code, a higher trust tier per PITCH.md, so only their
      identifying metadata (id/name/version) comes along as a manifest —
      no adapter code is ever transmitted. `packages/core/src/moduleShare.ts`
      (`serializeModuleShare`/`parseModuleShare`/`checkRequiredAdapters`,
      7 tests) defines the format; `apps/web/src/adapters/registry.ts` is
      what import validates the manifest against (what this *build* has
      the code for, not what the user has connected/authenticated).
      **Verified live, and genuinely proves the point** — not just JSON
      round-tripping: clicked Share on the real Mood vs. Weather module,
      pasted the resulting JSON as plain text, clicked Import, and got a
      real rendered scatter chart with actual data (17°C, mood 6),
      reconstructed entirely from that pasted text via a generic runner
      (`apps/web/src/lib/runModule.ts` + the existing `ModuleOutputRenderer`)
      that re-executes the query engine against whatever's locally
      available — completely independent of the original component's own
      state. Survived a page reload (new `moduleDefinitions` DB
      collection, IndexedDB bumped to schema v3) and removed cleanly.
      Only one shareable module exists today (Mood vs. Weather) since it's
      the only one actually built on `ModuleDefinition` — the rest
      (habit streak, mood chart, etc.) are hardcoded React components by
      design, not data-driven, so there's nothing to serialize yet.
- [x] Secretless adapters only, first-party (`pkce`, `oauth_loopback`,
      `device_flow`, `api_key`) — already true, no `oauth_client_secret`
      adapters exist.
- [x] No editor, no browse UI — this is the cheap test. Sharing is
      literally copy-paste text (clipboard on export, a textarea on
      import); no module-building UI, no server-side listing.

**Success criteria:** you and a few trusted creators manually share 5-10
modules with each other. If this works, Phase 5+ is justified. If it
doesn't, stop here rather than building a marketplace nobody uses. The
mechanism is proven; whether people actually *want* to do this is now a
real-world question, not a code one.

## Phase 5: Optional Backend — Auth, Sync, OAuth Relay

**Goal:** introduce a backend, but only as an opt-in, open-source,
self-hostable *add-on* — never a requirement. Local Purist mode never
touches it; the gatekeeper enforces that as a hard technical guarantee, not
a policy promise. Phases 1-4 shipped a fully backend-free app; this is the
first phase that adds one, and only for the two modes that already involve
leaving the device (Connected, AI).

The backend is stateless and ephemeral — it never stores user data except
client-side-encrypted sync blobs it can't read. Users get three tiers of
trust: use a public hosted instance (convenient), self-host their own
(maximum privacy), or skip it entirely (Local Purist, always available).
Same model as Obsidian Sync or Anytype's optional sync layer.

- [x] Accounts (email/password) — `apps/web/src/lib/pocketbase.ts` wraps
      the `pocketbase` JS SDK; every request (auth, CRUD, the SDK's own
      token auto-refresh) is routed through the same `NetworkGatekeeper`
      every adapter fetch goes through, via `pb.beforeSend` injecting
      `gatekeeper.guardedFetch` as the request's `fetch`. `AccountPanel.tsx`
      is the sign-up/sign-in/sign-out UI, gated behind Online/AI mode.
      Verified live end-to-end via Playwright against a running dev
      server + local PocketBase instance: sign-up creates a real
      PocketBase record (confirmed via direct API query), session
      persists across a page reload, sign-out then sign-in with the same
      credentials works. Separately verified Local mode blocks the call
      at the network layer, not just in the UI — a direct `signIn()` call
      while in Local mode is caught by the gatekeeper (visible in its
      request log as `allowed: false`) before any fetch goes out.
      **Note:** originally scoped as a separate Auth.js integration, but
      Auth.js expects a Node server of its own, which a pure Vite SPA
      doesn't have. Google/GitHub OAuth2 (PocketBase ships this built-in)
      is deferred, not abandoned — email/password proved the wiring end
      to end without needing OAuth app registrations first.
- [x] PocketBase setup, local and deployed — `apps/backend/` (see its
      README): schema-as-code migrations for `sync_blobs`, per-user
      access rules (`owner = @request.auth.id`). Deployed to Railway
      (`Dockerfile` + a persistent volume for `pb_data`, since this is a
      stateful Go binary, not something that fits Cloudflare
      Workers/Vercel's serverless model — that original wording was
      inherited from when Supabase was still on the table). Live at
      https://bulletspace-backend-production.up.railway.app. Full
      access-control suite re-verified against the deployed instance via
      curl, not just locally: own create/read succeed, cross-user reads
      404, owner-impersonation on create rejected (400), unauthenticated
      blocked. A signed-out user can now point their client at any
      instance via a "Server" field in `AccountPanel`
      (`getServerUrl`/`setServerUrl`) — the literal "self-host for max
      privacy, or use a public hosted instance" trust tier from this
      phase's own goal, not locked to whatever URL was baked in at build
      time. Verified live against the deployed Railway instance from the
      real running app, not just curl. The build-time *default* is
      deliberately left pointing at local dev, not the public instance —
      defaulting every build of this app to one developer's personal
      Railway billing, with no rate-limiting yet in place, is a real
      product decision to make deliberately later, not something that
      should fall out of a settings feature.
- [x] Client-side encryption layer (password-based) for sync —
      `packages/core/src/encryption.ts`: PBKDF2 (250k iterations) + AES-GCM
      via Web Crypto, no external deps. `sync_blobs.encryptedPayload` only
      ever holds this output (salt/iv/ciphertext), so the backend is
      structurally incapable of reading plaintext. 6 tests covering
      round-trip, wrong password, tampered ciphertext, randomness, empty
      string, and unicode.
- [x] Encrypted sync across devices — `apps/web/src/lib/sync.ts`
      (`pushJournal`/`pullJournal`) reuses the existing JSON-export shape
      (`serializeJournalExport`/`parseJournalExport`, same as manual
      Import/Export) as the plaintext, encrypts it with a user-entered
      sync passphrase before it ever leaves the device, and stores/reads
      it via `sync_blobs`. `SyncPanel.tsx` is the push/pull UI, nested
      under `AccountPanel` once signed in. A pulled journal's entries are
      remapped onto the local journal id rather than treated as a second
      journal — same convention the manual JSON import already uses,
      since each device generates its own random journal id on first run
      (there's no stable cross-device journal id to match against yet).
      **The sync passphrase is deliberately separate from the account
      password** — it's never sent to the server, purely a local
      encryption key. Flagging this as a UX tradeoff, not a settled
      decision: it's an extra secret to remember versus deriving the key
      from the account password Bitwarden/Standard-Notes-style.
      Verified live via Playwright with two isolated browser contexts
      (separate localStorage/IndexedDB, same account) standing in for two
      devices: push from "device A", wrong-passphrase pull on "device B"
      correctly rejected (decryption failure surfaced to the UI), correct
      passphrase pulls device A's entry onto device B. Caught and fixed a
      real bug in the process — `sync_blobs` was missing `created`/
      `updated` autodate fields (PocketBase only adds those to its own
      built-in collections, not custom ones), which broke sorting for
      "most recent blob"; fixed via an additive migration
      (`2_sync_blobs_timestamps.js`) rather than editing migration 1, to
      avoid wiping the already-running local dev database.
- [ ] OAuth relay for `oauth_client_secret` adapters — providers with no
      secretless path at all, on any platform. (By this point, PKCE and
      `api_key` adapters have worked since Phase 1, and `oauth_loopback` /
      `device_flow` adapters since Phase 3's Desktop + native HTTP client —
      this relay is for whatever's genuinely left over, e.g. a provider
      that only supports confidential-client OAuth everywhere.)
- [ ] AI proxy (optional; bring-your-own-key still works without this)
- [ ] Marketplace API backing Phase 6

**Success criteria:** sync works via the public instance or a self-hosted
one. Any remaining confidential-secret adapters can now authenticate
securely via the relay. Local Purist mode, verified by the gatekeeper,
still makes zero network calls.

## Phase 5.5: Theme & Asset Foundation

**Goal:** make themes and visual assets a real, installable concept in the
app.

- [ ] Theme schema defined — `packages/core/src/types.ts` gains
      `ThemeDefinition` (colors, fonts, spacing, corner radii, line
      thicknesses, grid style, canvas background — color/gradient/texture)
      and `AssetDefinition` (a pack of stickers/icons/fonts, as file
      references or data URLs)
- [ ] Theme switcher UI — a dropdown or sidebar listing installed themes;
      selecting one applies its CSS variables and canvas rendering
      properties (grid color, background, etc.) immediately
- [ ] Sticker picker UI — a panel of stickers from installed asset packs;
      clicking one adds it to the canvas at a default position (center of
      the current viewport) with basic properties (size, opacity, rotation)
- [ ] Manual theme sharing — Phase 4's export/import mechanism extended to
      themes and asset packs: exportable as JSON, importable via the same
      copy-paste/file-upload interface and validation patterns
- [ ] Theme persistence — the selected theme is saved to
      localStorage/IndexedDB and reloaded on startup
- [ ] Asset registry — installed themes and asset packs are tracked in a
      registry, and the UI reflects the active theme across modules (chart
      colors, fonts, etc. all update)

**Success criteria:** installing a theme changes the whole app's look —
colors, fonts, grid, canvas background — with no reload. A theme or asset
pack can be exported and re-imported through the same mechanism Phase 4
already proved for modules.

## Phase 5.6: Grid & Parallax Enhancements

**Goal:** improve the canvas atmosphere with multiple grid styles and
parallax depth.

- [ ] Grid styles — dot (current default), lined, graph (squared),
      isometric (30° angled), hexagonal, circular (concentric rings), and
      blank (no grid)
- [ ] Grid configuration — spacing, color, and opacity configurable via a
      settings panel (or the Phase 5.5 theme system)
- [ ] Canvas background — solid color (picker), gradient (linear/radial,
      configurable stops), texture (repeatable pattern, e.g. paper grain),
      or a user-uploaded image
- [ ] Parallax layers — the grid moves at 1x with the canvas; the
      background moves at a configurable speed (default 0.3x), creating
      depth when panning
- [ ] Parallax toggle — users can enable/disable parallax in settings
- [ ] Photo layer — a distinct layer behind the grid (z-index 3) where
      photos can be placed with a configurable parallax speed (default 0.7x)
- [ ] Infinite background — procedurally generated or tileable, with no
      seams even when panning indefinitely

**Success criteria:** panning the canvas visibly shows depth (grid and
background moving at different speeds) with no seams no matter how far you
pan, and every listed grid style is selectable and applies immediately.

## Phase 6.1: Figma-Style UI Shell

**Goal:** replace the current UI with a Figma/Adobe-like interface.

- [ ] Floating left toolbar with icons for: Select (default click/drag
      mode), Add Module (opens the module palette), Add Image, Add Sticker
      (opens the Phase 5.5 sticker picker), Add Text, Draw (optional,
      freehand — only if built), Asset Store (opens the Phase 6.4 panel),
      Account Settings (profile, sync, passphrase)
- [ ] Toolbar interaction — clicking an icon opens its panel or triggers
      its action; the toolbar itself is collapsible
- [ ] Top-right state toggle — the existing Local/Connected/AI tri-state
      toggle moves from its current location to the top-right corner,
      restyled to match the Figma aesthetic
- [ ] Collapsible right panel showing one of: Properties (Phase 6.3),
      Layers (Phase 6.5), or Asset Store (Phase 6.4)
- [ ] Zoom controls — in/out buttons plus a zoom percentage indicator in
      the top bar or toolbar
- [ ] Consistent styling — the new shell uses the active theme's colors
      and fonts (Phase 5.5)

**Success criteria:** the dashboard looks and behaves like a Figma-style
canvas app — a floating toolbar drives every add/select action, the
tri-state toggle lives top-right, and the collapsible right panel is ready
to host Properties/Layers/Asset Store content from later phases.

## Phase 6.2: Draggable, Overlapping Modules

**Goal:** modules are no longer grid-locked; they can be placed anywhere,
resized, and layered.

- [ ] Drag anywhere — click-and-hold anywhere on a module (not just its
      header) to drag it; it follows the cursor smoothly
- [ ] Position persistence — each module's x/y is saved to the database
      (IndexedDB/file system) and restored on reload
- [ ] Z-index stacking — clicking a module brings it to front; stacking
      order persists across reloads
- [ ] Resize handles on each module's corners and edges; the new size
      persists
- [ ] Rotation handle (e.g. a small circle above the module) for free
      rotation; rotation persists
- [ ] Snap to grid — dragging snaps to grid lines at a configurable
      spacing; toggleable on/off
- [ ] Multi-select — shift+click selects multiple modules, which can then
      be moved, resized, rotated, or deleted together
- [ ] Grouping — Cmd+G groups selected modules into a single unit,
      Cmd+Shift+G ungroups; groups move/resize/layer as one
- [ ] Context menu — right-clicking a module or group offers Bring to
      Front, Send to Back, Duplicate, Delete, Group/Ungroup

**Success criteria:** modules can be freely dragged, resized, rotated,
layered, grouped, and reordered via context menu, with every property
surviving a reload.

## Phase 6.3: Module Properties Panel

**Goal:** let users configure module data and appearance via a panel.

- [ ] Property panel UI — selecting a module shows its configuration in
      the right panel
- [ ] Data sources — dropdowns list and let users change which adapters a
      module uses
- [ ] Field mapping — for merge modules, map fields (e.g. `m.date = w.day`)
      via dropdowns
- [ ] Filters — add, edit, and remove filter conditions (date ranges,
      numeric thresholds, keyword search)
- [ ] Formulas — add computed fields via a simple expression editor with
      syntax highlighting and validation. **This authors the same minimal
      declarative expression language Phase 2's query engine already
      defines** (`"target = a + b"`-style, no `eval()`/`new Function()`) —
      a friendlier editor for it, not a new arbitrary-code capability; the
      declarative-Modules trust tier from PITCH.md still holds.
- [ ] Chart type — switch between line, bar, scatter, table, and other
      supported visualizations
- [ ] Visual overrides — override the active theme's colors, fonts, and
      spacing for the selected module
- [ ] Live preview — changes apply immediately on canvas, no "Apply" button
- [ ] Validation — invalid configurations (e.g. missing required fields)
      are clearly flagged with error messages

**Success criteria:** selecting a module surfaces a full config panel —
adapters, field mapping, filters, formulas, chart type, visual overrides —
and every change reflects on canvas immediately, with invalid configs
clearly flagged rather than failing silently.

## Phase 6.4: Asset Store Panel

**Goal:** users can browse, search, and install modules, themes, stickers,
and fonts.

**Depends on Phase 5's still-open "Marketplace API backing Phase 6" item**
— this entire phase needs a real backend to list, search, and install
assets against, and that API has no concrete scope defined yet. This
phase can't meaningfully start until that's built. Modules stay open to
community submissions per the Trusted Creator Model below; Adapters remain
curated/first-party until Phase 6.7's sandboxing is proven out.

- [ ] Asset Store panel opens from the toolbar, displaying available assets
- [ ] Categories — assets grouped by type: Modules, Themes, Stickers,
      Fonts, Backgrounds, Filters
- [ ] Browse — scroll through assets; each shows name, description,
      author, rating, and an install button
- [ ] Search by keyword
- [ ] Filter by category, rating, and popularity
- [ ] One-click install — downloads the asset via the marketplace API and
      makes it available in the app
- [ ] Installed indicator — installed assets show a badge/checkmark;
      users can uninstall
- [ ] Asset details — clicking an asset opens description, screenshots,
      version history, and reviews

**Success criteria:** a user can search the asset store, install a
theme/sticker pack/module with one click, see it marked installed, and
uninstall it — backed by a real marketplace API, not a hardcoded list.

## Phase 6.5: Collage & Layer Management

**Goal:** add photo collage support and a layer panel for managing all
canvas elements.

- [ ] Photo upload via the "Add Image" toolbar button; appears on canvas
      at a default size/position
- [ ] Photo manipulation — drag, resize, rotate, and adjust opacity (slider)
- [ ] Photo filters — sepia, vintage, blur, grayscale
- [ ] Sticker integration — Phase 5.5 stickers addable via the sticker
      picker and manipulable like photos
- [ ] Layer panel — a right-panel tab listing every canvas item (modules,
      photos, stickers, text boxes, groups) with name, type, and thumbnail
- [ ] Layer reordering — drag items in the layer panel to reorder z-index;
      canvas updates immediately
- [ ] Layer controls per item — Lock (prevent movement/selection), Hide
      (toggle visibility), Delete
- [ ] Selection sync — selecting a layer item selects its canvas element
      and vice versa

**Success criteria:** every element on the canvas — modules, photos,
stickers, text — shows up in the layer panel with working
lock/hide/delete/reorder, and selecting either the canvas element or its
layer entry highlights the other.

## Phase 6.6: Undo/Redo

**Goal:** users can undo and redo canvas actions.

- [ ] History tracking for every canvas state change: position, add,
      delete, resize, rotate, config changes (Phase 6.3), layer
      reordering, lock/hide toggles
- [ ] Undo (Cmd+Z) reverts the last action; history stack holds at least
      100 actions
- [ ] Redo (Cmd+Shift+Z) reapplies an undone action
- [ ] Action grouping — rapid-succession actions (e.g. dragging a module)
      are debounced into a single undo step
- [ ] State restoration — undo/redo correctly restores positions,
      z-index, configs, and layer settings
- [ ] UI feedback — the toolbar shows available undo/redo count, or grays
      out when none are available

**Success criteria:** Cmd+Z/Cmd+Shift+Z correctly walks backward/forward
through at least 100 grouped actions across every kind of canvas mutation,
with the toolbar accurately reflecting what's available.

## Phase 6.7: Trusted Creator & Sandboxing

**Goal:** enable community contributions with safety.

**Also depends on Phase 5's still-open Marketplace API item** — "approved
creators are flagged in the marketplace backend" needs that backend to
exist first. See the Trusted Creator Model below, which this phase makes
concrete.

- [ ] Trusted Creator Program — a documented application/review process,
      described in PITCH.md and this roadmap
- [ ] Creator application UI — a form for submitting a portfolio of
      self-built work
- [ ] Review workflow — an admin interface (or manual process) for
      reviewing applications; approved creators are flagged in the
      marketplace backend
- [ ] Gated React import — trusted creators can upload React components
      as part of module submissions, sandboxed in an iframe with `sandbox`
      attributes set (no `allow-same-origin`)
- [ ] Automated schema validation — every submitted module, even from
      trusted creators, is validated against the module schema before
      publishing
- [ ] Lightweight review queue — new publishes from trusted creators get a
      quick human check before going live

**Success criteria:** a creator can apply, get reviewed, and publish a
React-based module that runs sandboxed in a locked-down iframe, with every
publish — from any creator — still passing automated schema validation
before going live.

---

## The Trusted Creator Model (policy, not software)

**Policy:** only approved creators may publish executable content — React
components, or YAML/JSON configs above a defined complexity threshold — to
the public marketplace. Everyone, approved or not, can use the Visual Editor
and the (hidden-by-default) JSON/YAML editor to build modules for their own
use, and can share module configs peer-to-peer (a gist link, a copy-pasted
JSON blob) without needing approval. The gate applies specifically to
*publishing to the marketplace*, not to authoring.

**Approval flow:** a creator applies with a portfolio of self-built modules;
an initial review gates their first publish; subsequent publishes from an
approved creator still pass automated schema validation plus a lightweight
review queue.

**Why it works:** Adapters execute code and hold OAuth secrets — a higher
trust tier than declarative Modules — so they stay curated/first-party
regardless of creator status until Phase 6.7's sandboxing work is proven
out.
Gating *code-bearing* marketplace publishes solves the quality and security
problem (arbitrary published code is what Figma/Canva/Shopify gate too) at
the cost of a documentation paragraph today, not engineering time. The
approval workflow and sandboxed React import are the only pieces of this
policy that cost engineering time, and both are scoped concretely in
Phase 6.7 (iframe `sandbox` attributes, no `allow-same-origin`, automated
schema validation ahead of a lightweight human review queue).

## Summary

| Phase | Focus | Backend required? | Key deliverables |
|---|---|---|---|
| 0 | Core library | No | Types, gatekeeper, DB adapters, schema |
| 1 | Web MVP | No | Canvas, Markdown, SQLite, hardcoded modules, weather adapter |
| 1.5 | Polish | No | Bug fixes, UX |
| 2 | Query engine | No | Unified pipeline, merge joins, cache, 10+ modules |
| 3 | Desktop | No | Tauri, file system, native HTTP client unblocks GitHub/Google |
| 4 | Manual sharing | No | Export/import JSON (cheap demand test) |
| 5 | Optional backend | Yes (opt-in, self-hostable) | Accounts, encrypted sync, deployed PocketBase — OAuth relay/AI proxy/marketplace API still open |
| 5.5 | Theme & asset foundation | No | Theme/asset schema, theme switcher, sticker picker, manual theme sharing |
| 5.6 | Grid & parallax | No | 7 grid styles, configurable backgrounds, parallax layers |
| 6.1 | Figma-style UI shell | No | Floating toolbar, top-right state toggle, collapsible right panel, zoom controls |
| 6.2 | Draggable modules | No | Free placement, resize, rotate, multi-select, grouping, context menu |
| 6.3 | Module properties panel | No | Data source/field mapping/filters/formulas/chart type UI, live preview |
| 6.4 | Asset store panel | Yes (marketplace API) | Browse/search/install modules, themes, stickers, fonts |
| 6.5 | Collage & layer management | No | Photo upload/manipulation/filters, layer panel, selection sync |
| 6.6 | Undo/redo | No | 100-deep grouped history, Cmd+Z/Cmd+Shift+Z |
| 6.7 | Trusted creator & sandboxing | Yes (marketplace backend) | Application/review flow, sandboxed iframe React import, schema validation |
