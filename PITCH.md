# BulletSpace

**A visual journal that grows into a platform for building, sharing, and
remixing personal data dashboards — starting with a bullet journal, evolving
into a community-driven marketplace of life-tracking modules.**

## Core Philosophy

- **User-first, always.** No dark patterns, no data scraping, no lock-in.
- **Radical transparency.** The tri-state network toggle is visible and
  physical. The user controls every outbound request.
- **Local-first, cloud-optional.** Data lives on the user's device by
  default. Accounts and sync are opt-in.
- **Extensible by design, not by default.** The core is lightweight.
  Advanced features are optional.
- **Open by default.** MIT license. Community contributions welcome.

## The Tri-State Gatekeeper

A single, visible toggle in the app's header controls all network activity.

| State | Icon | Network access | What works | What's blocked |
|---|---|---|---|---|
| Local Purist | 🔒 | Zero outbound requests | Canvas, Markdown, local SQLite | All APIs, AI, web embeds |
| Connected Citizen | 🌐 | Allowed (non-AI) | API calls (weather, RSS, web clipper) | All AI endpoints |
| AI Enhanced | 🧠 | Allowed (full) | Everything + AI reflections/forecasts | Nothing — user opted in |

A live-log window (Connected/AI states) shows every outbound request, its
payload, and its destination.

**Implementation note:** the gatekeeper only has teeth if every network call
— including calls made by Data Adapters (below) — routes through
`NetworkGatekeeper.guardedFetch` rather than a raw `fetch`. This is a design
rule, not just a class: it's the difference between the toggle being real and
the toggle being decorative. See [`packages/core/src/gatekeeper.ts`](packages/core/src/gatekeeper.ts).

## The Optional Backend (Phase 5+)

Local Purist mode is backend-free — a hard guarantee enforced by the
gatekeeper, not a policy promise. No network calls, no OAuth relays, no
servers; all data in local SQLite.

Some adapters need more than Local Purist mode can offer without leaving the
device — specifically, providers whose OAuth requires a confidential
`client_secret` with no public-client alternative anywhere. Rather than
compromise (e.g. embedding a secret in the browser bundle) or block those
providers forever, Phase 5 adds a backend — but only as an **opt-in,
open-source, self-hostable** add-on that Connected/AI modes may use:

```
┌─────────────────────────────────────────────────────────────┐
│                    LOCAL PURIST MODE                         │
│  No backend calls. All data in local SQLite. No OAuth.        │
└─────────────────────────────────────────────────────────────┘
                              │ user toggles to Connected/AI
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              OPTIONAL BACKEND (self-hostable)                │
│  OAuth relay · encrypted sync · AI proxy · marketplace API    │
│  Stateless — never stores user data except client-encrypted   │
│  sync blobs it can't read                                     │
└─────────────────────────────────────────────────────────────┘
```

Three trust tiers, user's choice: use a public hosted instance
(convenient, but trust required), self-host your own (maximum privacy, no
trust required), or skip it entirely (Local Purist, always available, no
backend exists in that mode regardless of what's deployed elsewhere). Same
model as Obsidian Sync or Anytype's optional sync layer.

## The Module Ecosystem

| Layer | What it does | Example |
|---|---|---|
| Core | Manual journaling + habit tracker + calendar | Your daily log |
| Modules | Reusable dashboard components | Mood tracker, Spotify chart, workout log |
| Data Adapters | Connect external APIs and return a generic data shape | Spotify → `{ fields, rows }` |
| Marketplace *(eventual)* | One-click install library | Search "mood" → pick a tracker |
| Creator Tools *(eventual)* | Build modules without code | Visual editor, YAML, AI, React |

**Modules are declarative** (JSON/YAML config, safe to run untrusted).
**Adapters are executable code** with access to OAuth secrets and the
network — a different, higher trust tier. The marketplace treats them
accordingly (see Trusted Creator Model in [ROADMAP.md](ROADMAP.md)).

### The Module Creation Spectrum (eventual)

| Method | Customizability | User-friendliness | Who it's for |
|---|---|---|---|
| Visual Editor | 50% | 50% | Everyone — drag, drop, configure |
| JSON/YAML + preview | 75% | 25% | Technical users who want control |
| AI-Assisted | 40% | 60% | Describe it → AI builds it → tweak it |
| React code (trusted only) | 100% | 0% | Approved creators, sandboxed |

All four methods produce the same artifact — a module config that can be
exported as JSON and shared, regardless of how it was built.

### Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                      DATA ADAPTERS                          │
│  Spotify │ Google Calendar │ GitHub │ Apple Health │ Custom  │
│     ↓           ↓              ↓            ↓            ↓  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              GENERIC DATA SHAPE                      │    │
│  │       { fields: ['date', 'mood'], rows: [...] }      │    │
│  └─────────────────────────────────────────────────────┘    │
│                      ↓  ↓  ↓                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│  │  MODULE  │ │  MODULE  │ │  MODULE  │                     │
│  │  Chart   │ │  Table   │ │  Kanban  │                     │
│  └──────────┘ └──────────┘ └──────────┘                     │
│                      ↓                                       │
│               THE CANVAS (your journal)                      │
└─────────────────────────────────────────────────────────────┘
```

**Design gaps and their resolutions** (schema-level decisions made now;
implementation deferred to the phase noted):

- **Cross-source correlation** (e.g. mood vs. Spotify minutes) — `Module`
  gets a first-class `type: 'merge'` alongside `'single'`, with multiple
  `sources` and a `joinOn` key. The exact join semantics (inner vs. left,
  date-truncation granularity) are deliberately left unspecified until
  Phase 2 — reserving the schema slot now avoids a breaking change later
  without forcing a decision we can't make well yet. See
  [`packages/core/src/modules.ts`](packages/core/src/modules.ts).
- **OAuth in a backend-less app** — adapters declare an explicit
  `authType`, and support varies by provider in ways worth being precise
  about:
  - `pkce` (e.g. Spotify): standards-compliant, secretless, and Spotify's
    token endpoint is explicitly CORS-enabled for this — genuinely works
    from a pure web context. Code isn't written yet; the account being
    developed against needs Premium for Web API access, which blocked live
    verification, so this is deferred until that's active rather than
    shipped unverified.
  - `oauth_loopback` (e.g. Google): secretless only when registered as a
    "Desktop app" OAuth client using a loopback redirect — a "Web
    application" client type still requires a confidential secret at the
    token endpoint even with PKCE, per Google's own docs. This only works
    from **Tauri desktop (Phase 3)**, not the web app — and putting the
    secret in the browser bundle instead is a real anti-pattern the moment
    this app is ever deployed publicly, so it's not a shortcut worth taking
    even for local-only use now.
  - `device_flow` (e.g. GitHub): the OAuth mechanics are secretless, but
    **GitHub's device-flow token endpoints don't send CORS headers at
    all** — confirmed by live testing, `fetch()` fails before the request
    even reaches GitHub. This is a harder blocker than Google's, and a
    different one: it's not about a secret, browsers just can't call these
    endpoints directly, full stop. The fix is Tauri's native HTTP client
    (Phase 3), which isn't subject to browser CORS — not the Phase 5 relay.
    Adapter code is written ([`github.ts`](apps/web/src/adapters/github.ts))
    but not wired into the shipped UI until Phase 3.
  - `api_key` (e.g. OpenWeatherMap): no OAuth at all, no CORS issue, no
    secret-exposure concern — just an API key pasted into settings. This
    ended up being Phase 1's actual first live adapter, once both `pkce`
    and `device_flow` hit real-world blockers the schema didn't predict.
  - `oauth_client_secret`: needs the Phase 5 backend relay regardless of UI
    platform — see "The Optional Backend" above.
  - The gatekeeper enforces this too: an adapter needing network access
    that Local Purist mode blocks should surface as "this adapter requires
    Connected or AI mode," not a silent failure.
- **Reactive Data Engine vs. YAML Query Blocks** — merged into one
  pipeline: fetch → merge/join → filter → formula → sort/group → output.
  Modules carry an ordered `transformations` array (filter/formula/sort/
  group) that applies regardless of whether the module is `single` or
  `merge` — there is no separate "formula module" type, since that would
  just be a `single` module with a formula transformation. Schema now,
  full pipeline implementation in Phase 2 (renamed "Query Engine").
- **Caching/offline for adapter data** — stale-while-revalidate: each
  `AdapterDefinition` declares its own `defaultTtlSeconds` (an
  append-only history like Spotify's tolerates a much longer TTL than a
  mutable calendar, so this is adapter-level, not one global constant),
  and every `DataPayload` carries `_cachedAt`/`_source` metadata.
  Implementation (SQLite-backed cache, offline banner) lands in Phase 2.
- **Versioning for shared adapter/module schemas** — both
  `AdapterDefinition` and `ModuleDefinition` carry a `version: string`
  field starting now. A `migrations` mechanism is deliberately **not**
  added yet — its shape can't be designed correctly before a real schema
  change happens to inform it. That's a Phase 5 addition, once the
  marketplace exists and compatibility actually matters.

## Tech Stack

| Layer | Technology |
|---|---|
| Core language | TypeScript |
| UI framework | React |
| State management | Zustand |
| Canvas engine | React-Konva |
| Markdown | react-markdown + remark/rehype |
| Database | SQLite (`idb` for web, `better-sqlite3` for desktop) |
| Data viz | Chart.js (hardcoded modules, Phase 2) |
| Desktop | Tauri (Rust + webview) |
| Web | Vite + IndexedDB |
| Testing | Vitest |
| Package manager | pnpm |
| License | MIT |

## Inspiration Map

| Feature | Inspiration |
|---|---|
| Dot-grid canvas + drag-drop | Concepts, Figma, Notion |
| Markdown with backlinks | Obsidian, Logseq |
| Live charts + drag-to-filter | Tableau, Sigma |
| Reactive tables + formulas | Excel, Airtable, Coda |
| Extensions system | VSCode, Obsidian |
| Privacy toggle | Brave, Arc |
| Local-first + sync | Anytype |
| Visual aesthetic | Linear, Arc, Apple HIG |
| Marketplace + trusted creators | Shopify, Figma, Canva |

## Monetization

No subscriptions, no data selling, no ads. GitHub Sponsors / one-time
desktop purchase / extension marketplace revenue share (once the
marketplace exists — see [ROADMAP.md](ROADMAP.md)).

---

See [ROADMAP.md](ROADMAP.md) for the phased build plan, success criteria per
phase, and the Trusted Creator model.
