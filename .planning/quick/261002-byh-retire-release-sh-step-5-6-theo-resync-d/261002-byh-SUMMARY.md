---
quick_id: 261002-byh
status: complete
date: 2026-10-02
commits: [00b433917, 60e966a79, c3dcfc442]
navigator_ruling: 2026-10-02 (AskUserQuestion) APPROVED retiring Step 5.6
---

# Quick 261002-byh: retire release.sh Step 5.6 (theo-resync dispatch)

## What changed

The root cause: Step 5.6 fired a GitHub `repository_dispatch` (event `theo-resync`) at
jsagir/theo after every cut, and no Theo workflow received it. Theo's own
RELEASE-SYNC-CONTRACT.md section 2 says so. Step 0.55 (quick 261002-5v9) is the leg that
actually re-syncs Theo, so the dispatch was a message nobody read.

- 00b433917, the retirement:
  - `scripts/release.sh`: removed the Step 5.6 block, the preamble guard and source of
    `theo-notify-gate.sh`, `NO_THEO_NOTIFY`, the `--no-theo-notify` case arm and its USAGE_BLOCK
    entry, and the dry-run listing. `--no-theo-notify` now hits the unknown-arg arm (exit 1).
  - `scripts/release-lib/theo-notify-gate.sh` deleted, along with its two unit suites
    (`test-349-theo-notify-gate.cjs` and `test-349-payload-boundary.cjs`).
  - `scripts/doctor.cjs` expectedSteps: `'Step 5.6'` out, `'Step 0.55'` in.
  - RULE 5 place 8 in `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`: the leading half is now Step 0.55
    (`release-cut-listener.cjs`, `release_sync.py`, `--no-cut-listener`). The text records that
    Step 5.6 was retired, and the place count stays at nine. Place 9 and the listener paragraph
    were re-worded to match.
  - `docs/THEO-NOTIFY-CONTRACT.md`: frontmatter `status: superseded` plus `superseded_by`, and a
    SUPERSEDED banner. The history body is kept verbatim.
  - `.claude/includes/release-process.md`: the "Telling Theo" section now describes Step 0.55.
  - Tests:
    - The 349 release-wiring test is now a retirement tripwire.
    - The dry-run test now asserts no Step 5.6 line, Step 0.55 in expectedSteps, and the retired
      flag rejected. Its read-only proof is scoped to release-owned files (the WR-06 pattern).
    - The docs-lockstep and contract-doc tests are re-pinned.
    - The listener wiring test asserts that no Step 5.6 block exists.
    - The 310 fixture was regenerated (header count 34 -> 33, exit-1 floor 61 -> 59). Only the
      Step 0 and Step 1 hashes moved, plus the deleted Step 5.6 block.
- 60e966a79 (coordinator add-on, its own commit): `scripts/release-cut-listener.cjs` SURFACES now
  mirrors website checklist ac84cee.
  - Six deleted count pages are dropped.
  - `src/lib/truth-claims.ts` `const RELEASE` is added as a version surface, checked like
    FALLBACK_VERSION.
  - The unit fixture and expectations are updated.
- c3dcfc442: the dry-run test's "no Step 5.6" check now matches listing and header lines. The
  dry-run echoes recent commit subjects, and the retirement commit's own subject names Step 5.6.

Leg 7 of run-all-310 (the DRY_RUN unbound-variable trio) is green now. The cause: its driver
slices from `# --- Step 5.5` to `# --- Step 9.8`, so it swallowed the Step 5.6 block, which reads
`$DRY_RUN` under `set -u`. With the block gone, that cannot happen.

## Verification

All runs used HOME=$(mktemp -d).

- run-all-349: PASS=14 FAIL=0.
- run-all-310: PASS=11 FAIL=0 SKIP=1. Leg 9 is the shared-tree diff check: it SKIPs on a clean
  scoped tree and fails only while another session holds uncommitted scripts/ or tests/ files.
- run-all-366: green.
- `bash scripts/release.sh patch --dry-run`: exit 0. It lists Step 0.55 and prints no Step 5.6
  line. `--no-theo-notify` gives "unknown arg" and exit 1.
- The doctor `release-dry-run-output` point passes.
- Website leg, read-only, against `/home/jsagi/dev/mindrian-website/website` at 2.0.0-beta.55:
  RAN-OK, exit 0. 7 ok, 2 review, 0 drift, 0 GONE, 0 UNMIRRORED, 0 banned, 2 allowed (JHU Press).
- Pre-existing and out of scope:
  - The run-all-341 step-block tripwire: the 341 fixture has been stale since Phases 343 and 366
    and quick 5v9. It found 34 headers at baseline 6c8283986 and finds 33 now.
  - The run-all-341 version-of-record leg: doctor --acceptance --pre-tag under a temp HOME fails
    install-state, session-start-active-version and deployment-surfaces. These are ENV GAPs.

## Follow-ups

1. Theo side (left untouched): `~/Theo/docs/RELEASE-SYNC-CONTRACT.md` section 2 (lines 49-52) is a
   four-line paragraph, not a one-line note. It still says Step 5.6 "sends today" and "can be
   removed". Edit it in a Theo session to "was retired by plugin quick 261002-byh".
2. The 341 step-block fixture (`tests/fixtures/341-release-step-block-hashes.txt`) needs its own
   rebaseline (pre-existing drift).
3. Historical docs still mention Step 5.6 as history: OPEN-HANDOFFS, the Phase 349 close-out,
   reviews and the ROADMAP Phase 349 text. They are intentionally not rewritten.

## STATE.md quick-table row (to apply later, not written here)

| 261002-byh | Retire release.sh Step 5.6 theo-resync dispatch (navigator ruling 2026-10-02): theo-notify-gate.sh + --no-theo-notify removed, RULE 5 place 8 names Step 0.55, THEO-NOTIFY-CONTRACT superseded; listener SURFACES mirror website ac84cee | 2026-10-02 | 00b433917 | Complete (Theo-side contract note is a follow-up) | [261002-byh-retire-release-sh-step-5-6-theo-resync-d](./quick/261002-byh-retire-release-sh-step-5-6-theo-resync-d/) |
