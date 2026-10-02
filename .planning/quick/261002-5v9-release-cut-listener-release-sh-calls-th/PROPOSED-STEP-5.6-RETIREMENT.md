# Proposal: retire release.sh Step 5.6 (the theo-resync dispatch)

Status: PROPOSAL ONLY. Nothing here has been applied. Filed by quick 261002-5v9 (2026-10-02) for a navigator ruling.

## The measured fact

Step 5.6 of `scripts/release.sh` fires a GitHub `repository_dispatch` at `jsagir/theo` with event `theo-resync` after every cut. Nothing on the Theo side receives it.

- Theo's workflows are `ci.yml`, `theo-liveness.yml` and `theo-seam-audit.yml` (`/home/jsagi/Theo/.github/workflows/`, listed 2026-10-02). None of them handles `repository_dispatch` or names `theo-resync` (a grep for both across all three returns nothing).
- Theo's own contract says the same thing in plain words: `docs/RELEASE-SYNC-CONTRACT.md` section 2 states that no Theo workflow listens for `theo-resync` and that removing it loses nothing.

So every cut today sends a message no one reads. The step that actually re-syncs Theo is now Step 0.55 (this quick's release-cut listener), which calls Theo's `release_sync.py` bridge before the stamp gates.

## Recommendation

Retire Step 5.6, `scripts/release-lib/theo-notify-gate.sh` and the `--no-theo-notify` flag, and rewrite RULE 5 place 8's leading half so it names Step 0.55's bridge call instead of the dispatch. Do it in its own `/gsd-quick` after the navigator rules, not inside this quick, because place 8 is a ruled contract (Phase 349 rulings, the WD-349 ledger in `docs/THEO-NOTIFY-CONTRACT.md`), and a quick should not overturn a ruling on its own say-so.

## What that retirement touches

- `scripts/release.sh`: the Step 5.6 block, its dry-run listing line (and the `--no-theo-notify` listing line), the `NO_THEO_NOTIFY` flag var, case arm and `USAGE_BLOCK` entry, and the preamble source of `theo-notify-gate.sh`.
- `scripts/release-lib/theo-notify-gate.sh` (deleted).
- `docs/THEO-NOTIFY-CONTRACT.md` (marked superseded, with a pointer to the Theo release-sync contract).
- `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 place 8 (leading half rewritten; the place count stays nine) and the listener paragraph's closing sentence.
- `.claude/includes/release-process.md`, the "Telling Theo" section.
- `tests/test-349-*.cjs` (theo-notify-gate, payload-boundary, release-wiring, dry-run-never-sends, docs-lockstep, contract-doc) and `tests/run-all-349.sh`.
- `scripts/doctor.cjs` `expectedSteps` (drop `'Step 5.6'`; `test-349-dry-run-never-sends.cjs` asserts that member today).
- `tests/fixtures/310-release-step-block-hashes.txt` and `tests/run-all-310.sh` (one block removed, header count 34 to 33).

## A second note: ROADMAP Phase 366.1 overlaps this quick

ROADMAP.md parks Phase 366.1 (INSERTED), "Version-cut listener", described as closing "the Theo-side receiver loop" and adding the website leg. This quick delivered that same capability by a different mechanism: a direct bridge call at Step 0.55 with no Theo-side receiver, plus the website leg at Step 9.6c. So 366.1 can be closed as delivered, or rescoped to whatever is still wanted (for example, the retirement above). That is a navigator call; this quick does not edit ROADMAP.md.
