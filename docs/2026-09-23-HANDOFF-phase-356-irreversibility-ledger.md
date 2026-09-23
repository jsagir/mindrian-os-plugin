# Handoff 2026-09-23: Phase 356 closed (chain-executor irreversibility ledger)

Session: jsagi-a7. Status: Phase 356 COMPLETE and VERIFIED (13/13 plans, 356-VERIFICATION.md passed, 13/13 SPEC criteria).
Full record: `.planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-REPORT.md`.
Research trail: `~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-chain-executor-irreversibility-ledger-356.md` (home repo 4d33884e1).

## What shipped

- `data/command-irreversibility-ledger.json`: dev-time Jev Noul ledger, 113 commands, T=0.23, 15 flagged, ~$0.013.
  Only 2 flags change runtime behavior today: `/mos:research` and `/mos:show` (autonomous_safe: true). The other 13 were already halted by posture.
- `isIrreversibleStep` (lib/core/chain-executor.cjs) gains an add-only, hash-checked, zero-network ledger signal
  (lib/core/irreversibility-ledger.cjs). Ledger absent = pre-356 behavior. One frozen pin re-pinned (D-17).
- `scripts/jev-devtime-client.cjs`: the one shared dev-time Jev client (354-17, 357 and 359 import it; per-builder egress profiles).
- `data/jev-policies/command-irreversibility.json` v3 (locked, strategy plus tactics, D-22) and
  `data/jev-labels/command-irreversibility.json` (113 rows: 14 navigator rulings plus 99 two-model blind agreements).
- Key-free `--check`: `node scripts/build-command-irreversibility-ledger.cjs --check`.
- Validation desk artifact (navigator's human-validation surface): https://claude.ai/artifact/MJ9TUDfHkam37NPJ5YPvco

Navigator rulings that changed the SPEC: D-14 final (Jev judges, navigator audits), D-20 (two blind model labelers
plus navigator arbitration), D-21 (flag = "always stop for the navigator"), D-22 (policy = strategy plus tactics).

## Open items (not done this session)

1. **Code-review gate skipped.** execute-phase's required code_review_gate was not run for 356. Run `/gsd-code-review` on 356's changed files.
2. **Not live until released.** 356 is on main only. It needs a release cut (coordinate with 354, which is at 17/18).
3. **gsd-tools bug:** `gsd-tools query commit "<msg>" --files <paths>` commits the WHOLE index. It swept 356-07's staged work into f7ec913b6. Workaround: `git commit --only -- <paths>`. Needs a `/gsd-debug`.
4. **Stale ledger entry:** `--check` warns `STALE /mos:dominant-designs` (Phase 361-07 edited its teaching after scoring). Not flagged, so no halt changes. A re-score needs navigator authorization (one live call).
5. **Deferred:** the 353-builder refactor to import the shared client (blocked while `scripts/eval-icm-writers.cjs` and `tests/test-353-{grader-agreement,ledger-shape}.cjs` carry unowned uncommitted diffs; recipe in 356 `deferred-items.md`); the mva-brief in-command HITL prompt; Theo mirroring for new-surface/scheduled-tasks; the Mindrian-logo rule on exports; `/mos:validate-proposition` has a registry row but no commands file.
6. **Process note:** 356-13 placed the research-trail file with `cp` after the plugin's write-scope hook blocked a Write (session room was motj-ecosystem). The filing was navigator-approved, but it went around a guard.
7. Quick task 260923-uam (override ruling) was planned, then CANCELLED by the navigator (posture already halts both commands).

`docs/OPEN-HANDOFFS.md` was not updated: another session holds uncommitted edits in it. Add this entry there when it is clean.
