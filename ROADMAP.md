# Roadmap

Realistic timelines for a solo dev working nights/weekends. Each phase ships
something usable; nothing expensive gets built until an earlier, cheaper
phase has proven demand for it. See [PITCH.md](PITCH.md) for the product
vision this roadmap implements.

## Phase 0: Core Library (2-3 weeks)

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

## Phase 1: Web MVP (12-16 weeks)

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

## Phase 1.5: Polish (4 weeks)

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

## Phase 2: Query Engine (8-10 weeks)

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

## Phase 3: Desktop Port (4-6 weeks)

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

## Phase 4: Manual Sharing (4-6 weeks)

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

## Phase 5: Optional Backend — Auth, Sync, OAuth Relay (10-12 weeks)

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

- [ ] Auth.js integration (Google, GitHub) for accounts (separate from the
      adapter OAuth below)
- [ ] Supabase/PocketBase setup, deployable to Cloudflare Workers/Vercel or
      self-hosted
- [ ] Client-side encryption layer (password-based) for sync
- [ ] Encrypted sync across devices
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

## Phase 6: The Expensive Stuff (12+ weeks, ongoing)

**Goal:** the platform layer. Only build this once Phase 4 has proven demand.

- [ ] Visual Editor (drag, drop, configure modules)
- [ ] Template Library UI (browse, search, filter)
- [ ] Marketplace v1 (install, rate, review) — Modules open to community
      submissions per the trust-tier split below; Adapters remain
      curated/first-party until sandboxing is proven out
- [ ] Trusted Creator Program (application, review, publishing workflow)
- [ ] Gated, sandboxed React import for trusted creators only

**Success criteria:** a community-driven module ecosystem. Non-technical
users can build and share modules without touching code.

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
regardless of creator status until Phase 6's sandboxing work is proven out.
Gating *code-bearing* marketplace publishes solves the quality and security
problem (arbitrary published code is what Figma/Canva/Shopify gate too) at
the cost of a documentation paragraph today, not engineering time. The
approval workflow and sandboxed React import are the only pieces of this
policy that cost engineering time, and both are deferred to Phase 6.

## Summary

| Phase | Focus | Backend required? | Timeline | Key deliverables |
|---|---|---|---|---|
| 0 | Core library | No | 2-3wk | Types, gatekeeper, DB adapters, schema |
| 1 | Web MVP | No | 12-16wk | Canvas, Markdown, SQLite, hardcoded modules, weather adapter |
| 1.5 | Polish | No | 4wk | Bug fixes, UX |
| 2 | Query engine | No | 8-10wk | Unified pipeline, merge joins, cache, 10+ modules |
| 3 | Desktop | No | 4-6wk | Tauri, file system, native HTTP client unblocks GitHub/Google |
| 4 | Manual sharing | No | 4-6wk | Export/import JSON (cheap demand test) |
| 5 | Optional backend | Yes (opt-in, self-hostable) | 10-12wk | OAuth relay, encrypted sync, AI proxy |
| 6 | Platform | Yes (same backend) | 12+wk | Visual editor, marketplace, trusted creators |

**Total to a usable v1** (through Phase 3): ~30-39 weeks of nights/weekends.
**Total to a validated sharing model** (through Phase 4): add 4-6 weeks.
**Total to a platform** (Phase 6): ~1 year+, and only if Phase 4 proves
people actually want it.
