# BulletSpace

A privacy-first, local-first visual journal that grows into a platform for
building, sharing, and remixing personal data dashboards. Every network
request is gated behind a visible tri-state toggle: **Local** (nothing
leaves the device), **Connected** (non-AI network access, e.g. RSS/exchange
rates), or **AI Enhanced** (full network access, opt-in).

See [PITCH.md](PITCH.md) for the full product vision and architecture, and
[ROADMAP.md](ROADMAP.md) for the phased build plan with success criteria per
phase.

This repo is currently in **Phase 0**: a pure TypeScript core with no UI yet.
It defines the data model, the `NetworkGatekeeper`, and a storage-adapter
interface with two implementations (in-memory, IndexedDB), all covered by
unit tests. The web app (Phase 1) hasn't been started — see
[`apps/web`](apps/web/README.md).

## Requirements

- Node.js 18+
- [pnpm](https://pnpm.io) (the setup script will install it if missing)

## Getting started

```bash
./setup.sh
```

This installs dependencies, type-checks every package, and runs the test
suite. Re-run it any time to verify the repo is in a good state.

If you'd rather run the steps yourself:

```bash
pnpm install
pnpm typecheck
pnpm test
```

## Project layout

```
packages/
  core/           @bulletspace/core — types, NetworkGatekeeper, DatabaseAdapter
                  (InMemoryAdapter, IndexedDBAdapter)
apps/
  web/            Phase 1 — not started
```

## Useful commands

| Command | What it does |
| --- | --- |
| `pnpm test` | Run all unit tests (Vitest) across every package |
| `pnpm typecheck` | Type-check every package with `tsc --noEmit` |
| `pnpm build` | Compile every package to `dist/` |
| `pnpm --filter @bulletspace/core test -- --watch` | Watch mode for just the core package |

## Current scope

See [ROADMAP.md](ROADMAP.md) for the authoritative, up-to-date phase
breakdown and checklists. Short version: Phase 0 (this core library) is
mostly done; everything else — canvas, Markdown UI, charts, desktop,
sync, and the module marketplace — is intentionally not started yet.

## License

MIT — see [LICENSE](LICENSE).
