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

**Known open questions in this design** (not yet resolved, tracked here
rather than solved prematurely):

- One adapter per module for v1 — cross-source correlation (e.g. mood vs.
  Spotify minutes) needs a join/merge model that doesn't exist yet.
- OAuth in a backend-less app: v1 adapters are PKCE or API-key only.
  Adapters needing a confidential secret wait for Phase 5 (Auth & Sync),
  which stands up a backend anyway and can double as an OAuth relay.
- The original "Reactive Data Engine" (Excel-style formulas) and the
  YAML "Query Block" concept overlap — these should be merged into one
  engine before Phase 2, not built twice.
- No caching/offline story yet for adapter-sourced data.
- No versioning story yet for adapter/module schemas shared on the
  marketplace.

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
