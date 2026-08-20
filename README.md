# BulletSpace

A privacy-first, local-first visual journal that combines freeform bullet
journaling with live data tables and charts. Every network request is gated
behind a visible tri-state toggle: **Local** (nothing leaves the device),
**Connected** (non-AI network access, e.g. RSS/exchange rates), or **AI
Enhanced** (full network access, opt-in).

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

## Current scope (v1)

- Infinite dot-grid canvas *(not yet built — UI is Phase 1)*
- Markdown notes with `[[backlinks]]` *(Phase 1)*
- Local SQLite/IndexedDB storage — adapter interface is done, UI wiring is
  Phase 1
- Tri-state network gatekeeper — enforces only BulletSpace's own network
  calls for now; extension sandboxing is a later phase

Explicitly out of scope until later phases: charts/reactive tables (Phase 2),
desktop packaging (Phase 3), accounts/sync (Phase 4), and the extension
system (Phase 5).

## License

MIT — see [LICENSE](LICENSE).
