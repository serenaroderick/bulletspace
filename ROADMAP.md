# Roadmap

Realistic timelines for a solo dev working nights/weekends. Each phase ships
something usable; nothing expensive gets built until an earlier, cheaper
phase has proven demand for it. See [PITCH.md](PITCH.md) for the product
vision this roadmap implements.

## Phase 0: Core Library (2-3 weeks)

**Goal:** solid foundation. Pure TypeScript, no UI.

- [x] pnpm monorepo with `packages/core`, `apps/web`
- [x] TypeScript types for journals, entries, canvas elements
- [ ] TypeScript types for modules and data adapters
- [x] `NetworkGatekeeper` with tri-state logic
- [x] `DatabaseAdapter` interface + `IndexedDBAdapter` + `InMemoryAdapter`
- [ ] Module/adapter JSON schema designed
- [x] Trusted Creator policy documented (see below — free, it's a doc, not code)
- [x] Unit tests (Vitest)
- [x] `guardedFetch` established as the only path for outbound network calls
      (design rule now; gets enforced against real adapter code starting Phase 4)

**Success criteria:** `pnpm test` passes. Schema validates. No UI yet.

*(Status: mostly done — see [`packages/core`](packages/core). Module/adapter
types are the remaining Phase 0 item.)*

## Phase 1: Web MVP (12-16 weeks)

**Goal:** a working journal. Hardcoded modules proving the schema.

- [ ] Vite + React setup
- [ ] Canvas component with dot-grid
- [ ] Markdown editor with `[[link]]` support
- [ ] SQLite (IndexedDB) CRUD wired to the UI
- [ ] Tri-state toggle in UI
- [ ] 2-3 hardcoded modules (habit tracker, line chart) — no editor UI
- [ ] Basic import/export (JSON)

**Success criteria:** you can journal daily. Modules render hardcoded data.
Gatekeeper works.

## Phase 1.5: Polish (4 weeks)

**Goal:** stability and feedback.

- [ ] Bug fixes
- [ ] UX improvements based on daily use
- [ ] Community testing (friends, early adopters)

## Phase 2: Data & Viz (8-10 weeks)

**Goal:** more modules, still hardcoded.

- [ ] Charts (bar, line, scatter)
- [ ] Reactive tables (Airtable-like) — merge with the "Query Block" concept
      from PITCH.md rather than building two engines
- [ ] More hardcoded modules (mood tracker, workout log, sleep log, etc.)

Grows the template count without building a Template Library *system* yet.

**Success criteria:** 10+ hardcoded modules you actually use daily.

## Phase 3: Desktop Port (4-6 weeks)

**Goal:** native performance and file system access.

- [ ] Tauri setup
- [ ] File system adapter (replaces IndexedDB)
- [ ] Native menus and shortcuts
- [ ] Build for Windows/macOS/Linux

**Success criteria:** desktop app runs, saves to `~/Documents/BulletSpace/`.

## Phase 4: Manual Sharing (4-6 weeks)

**Goal:** test whether people actually want to share modules — without
building a marketplace UI.

- [ ] Export/import module + adapter JSON (copy-paste or paste-a-gist-URL level)
- [ ] PKCE/API-key adapters only, first-party (no OAuth-with-secret adapters yet)
- [ ] No editor, no browse UI — this is the cheap test

**Success criteria:** you and a few trusted creators manually share 5-10
modules with each other. If this works, Phase 5+ is justified. If it
doesn't, stop here rather than building a marketplace nobody uses.

## Phase 5: Auth & Sync (10-12 weeks)

**Goal:** now there's a backend — use it to close the OAuth gap.

- [ ] Auth.js integration (Google, GitHub)
- [ ] Supabase/PocketBase setup
- [ ] Client-side encryption layer (password-based)
- [ ] Encrypted sync across devices
- [ ] OAuth relay for adapters that need a confidential secret (Spotify,
      Google Calendar) — the backend built for accounts doubles as this

**Success criteria:** sync works. OAuth adapters can now handle
Spotify/Google Calendar securely.

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

| Phase | Focus | Timeline | Key deliverables |
|---|---|---|---|
| 0 | Core library | 2-3wk | Types, gatekeeper, DB adapters, schema |
| 1 | Web MVP | 12-16wk | Canvas, Markdown, SQLite, 2-3 modules |
| 1.5 | Polish | 4wk | Bug fixes, UX |
| 2 | Data & viz | 8-10wk | Charts, tables, 10+ modules |
| 3 | Desktop | 4-6wk | Tauri, file system |
| 4 | Manual sharing | 4-6wk | Export/import JSON (cheap demand test) |
| 5 | Auth & sync | 10-12wk | OAuth relay, encrypted sync |
| 6 | Platform | 12+wk | Visual editor, marketplace, trusted creators |

**Total to a usable v1** (through Phase 3): ~30-39 weeks of nights/weekends.
**Total to a validated sharing model** (through Phase 4): add 4-6 weeks.
**Total to a platform** (Phase 6): ~1 year+, and only if Phase 4 proves
people actually want it.
