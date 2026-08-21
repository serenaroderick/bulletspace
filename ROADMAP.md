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
- [ ] Charts (bar, scatter) beyond the existing hardcoded line chart
- [ ] Reactive tables (Airtable-like), built on the same pipeline
- [ ] More hardcoded modules (workout log, sleep log, etc.)

Grows the template count without building a Template Library *system* yet.

**Success criteria:** 10+ hardcoded modules you actually use daily,
including at least one `merge` module (e.g. mood vs. weather) — **done**
for the merge module; still short of 10 total modules.

## Phase 3: Desktop Port (4-6 weeks)

**Goal:** native performance and file system access.

- [ ] Tauri setup
- [ ] File system adapter (replaces IndexedDB)
- [ ] Native menus and shortcuts
- [ ] Build for Windows/macOS/Linux
- [ ] Google Calendar adapter (`authType: 'oauth_loopback'`) — only viable
      here, not on web, since it needs a local loopback listener for the
      redirect
- [ ] Route adapter network calls through Tauri's Rust-side HTTP client
      instead of the webview's `fetch()` — this is also what unblocks the
      GitHub `device_flow` adapter (code already written in Phase 1, blocked
      purely by browser CORS, not by needing a secret): a native HTTP
      request isn't subject to CORS at all, so this fixes both adapters at
      once without needing the Phase 5 backend

**Success criteria:** desktop app runs, saves to `~/Documents/BulletSpace/`.
GitHub and Google Calendar adapters both go live here, backend-free.

## Phase 4: Manual Sharing (4-6 weeks)

**Goal:** test whether people actually want to share modules — without
building a marketplace UI.

- [ ] Export/import module + adapter JSON (copy-paste or paste-a-gist-URL level)
- [ ] Secretless adapters only, first-party (`pkce`, `oauth_loopback`,
      `device_flow` — the latter two require Desktop from Phase 3, per the
      CORS finding above — and `api_key`, which has worked since Phase 1) —
      no `oauth_client_secret` adapters yet
- [ ] No editor, no browse UI — this is the cheap test

**Success criteria:** you and a few trusted creators manually share 5-10
modules with each other. If this works, Phase 5+ is justified. If it
doesn't, stop here rather than building a marketplace nobody uses.

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
