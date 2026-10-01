# Stage 02: browser read copy

Last updated: 2026-10-02

## Inputs
| Source | File/Location | Scope | Why |
| :--- | :--- | :--- | :--- |
| Stage 01 (Layer 4) | `/pull/*`, `/stream` | all | the data |
| Canon v3 (Layer 3) | `../../_config/canon-v3-tokens.css`, `~/dev/mindrian-website/docs/DESIGN-CANON.md` | tokens, shapes, motion | the only styling law |

## Process
1. `src/app.js`: RxDB (Dexie storage), `replicateRxCollection` pull-only, `pull.stream$` from SSE, RESYNC on every hello, reconcile against `/ids` on a server epoch change.
2. `src/index.html`: one read view; sections as regions, entries as tiles, a recent-changes ledger.
3. `node build.cjs` bundles to `output/`.

## Outputs
| Artifact | Location | Format |
| :--- | :--- | :--- |
| Page | `output/index.html`, `output/app.js` (built, git-ignored) | HTML, IIFE bundle |
