---
seed: 172
status: dormant
source: Phase 400.3.1 EGM review (2026-11-26)
---

# SEED-172: run the ledger-coupled test arms at release time, cap part 6, add a ledger-path seam

## Problem

Each release rebuilds `data/section-command-ledger.json` (release.sh Step 2.3, Jev-scored, candidate order not deterministic). Three test arms depend on its content: `tests/test-353-ruling-doc.cjs` L2 band, `tests/test-vi3-icm-walk.cjs` I8c (tagged) and I7 (CONTEXT bytes at test time). No gate runs them: `scripts/release.sh` runs `tests/run-all-366.sh` only. The vi3 I8c arm was red from the beta.66 rebuild (`d88810a78`) to Phase 400.3.1, unseen.

## Proposal

1. Run the ledger-coupled arms right after Step 2.3, so a rebuild that moves a pin shows at the cut, with the cut's own commit to cite.
2. Cap part 6 ("Commands that write here") of the generated CONTEXT.md, as part 2 is capped at 3 (`lib/core/room-skeleton-scaffold.cjs:404-417`). The region is 661 chars-over-4 tokens against the owner's 500 target.
3. Add a ledger-path seam to `lib/core/feyminto/command-sources.cjs` (it reads the ledger through a local `readJson`, so a require-cache override cannot reach it; room a in vi3 is also born in a child process). `lib/core/feyminto/next-move.cjs` already has a `doc` test seam to copy.

Product changes (2, 3) need an owner ruling.
