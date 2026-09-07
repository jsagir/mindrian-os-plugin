---
phase: 298
kind: spec
status: locked
locked_by: navigator, 2026-09-07 (design review approved; D9)
source_of_truth: docs/superpowers/specs/2026-09-07-harness-manifest-v2-design.md
design_review: https://claude.ai/code/artifact/5398b3c4-b1d7-4c95-8fb0-05da01271992
decisions: .planning/research/2026-09-07-larry-rework-decisions.md (D1-D9)
absorbs: Phase 297 (SEED-031/042 regulation policy) per D7
---

# Phase 298 SPEC (locked requirements digest)

This file locks WHAT Phase 298 delivers. The full design (architecture, tree, schema, runner
semantics, ownership, slices, tests) is the source of truth at
`docs/superpowers/specs/2026-09-07-harness-manifest-v2-design.md`; do not duplicate it here.
Discussion and planning decide HOW, never WHETHER.

## Goal

Extend the locked Phase 167 harness manifest (v1, a 3-map digest plus 4 runtime surfaces) to
v2, add one idempotent policy runner, and make the Larry persona its first declared consumer,
so the harness MindrianOS already runs is declared, machine-enforced and re-runnable
(SEED-032), with the regulation policy of Phase 297 folded in as the manifest's declared
routing policy (D7).

## Requirements

1. Manifest v2 adds exactly three top-level keys to `data/harness-manifest.json`: `policies`
   (a digest of `data/harness-policies/`: path, sha256, count), `larry_surfaces` (the three
   speaking surfaces as `{role, path, digest}`), `fixture_ref`. `maps` stays exactly three.
   Generated, byte-stable JSON from the CJS generator; no YAML, no TypeScript, no new deps.
2. `data/harness-policies/` holds one hand-authored JSON file per policy, validated by a closed
   `_schema.json` (keys: id, kind, runner, args, rung, evidence_log, promotion_rule, owner,
   pinned_by, applies_to, notes). Every existing `scripts/check-*.cjs` gate and every doctor
   module becomes reachable from one policy entry, migrated in the four slices the spec names.
3. Every policy carries an enforcement rung `declared | logged | blocking` and moves up one
   rung only by a human edit made after reading its evidence log against a `promotion_rule`
   decided beforehand (D8). The runner never promotes.
4. `scripts/run-harness.cjs` executes policies by tier (`--check --tier`) and decides room
   convergence (`--room <dir>`) from Layer 0 alone (ROOM.md per section, STATE.md `computed:`
   vs on-disk counts, empty derive queue, zero `proposed` truth-claim nodes via
   `navigation.cjs`). It writes only `<room>/.mindrian/harness-run.json`, never repairs a room,
   never calls a model (SEED-062). A second run on the committed converged-room fixture is a
   no-op: zero writes, empty `git status --porcelain`, identical report.
5. `gate-graph-derive-health` (SEED-037 4d) is built in this phase as a check script, declared
   at rung `logged`; the runner refuses `converged: true` while it is a ghost or the derive
   queue is non-empty.
6. Larry's three surfaces (`agents/larry-extended.md`, `skills/larry-personality/SKILL.md`,
   `lib/mcp/runtime-instructions.cjs`) are declared in `larry_surfaces`; a `contract-parity-larry`
   policy makes `--check` fail when any surface drops a core-contract phrase or the Desktop wire
   exceeds its 1,950-byte served budget. The nine frozen-phrase tests and the byte-frozen
   BOUNDARIES paragraph stay intact.
7. The persona states, and `memory-write-policy.json` declares, the operating policy D3/D4/D5:
   Larry operates components by context and intent (ICM Layer 1 Routing); Belief/Progress/
   Experience channels mapped to `context_assemble` / `graph_write`+`claim_write` /
   `graph_query`+`graph_reason` / `memory_event`; `memory_event` silent on every substantive
   turn; claims land only as `proposed` after an F.8 governance basket that fires when two or
   more candidate writes exist; toggled-off candidates write `NOT_REMEMBERED_BECAUSE`;
   `context_assemble` at turn start; never narrated (Part 12).
8. Rung 2 for voice rules: `lib/hmi/turn-text.cjs` lifts the transcript reader out of
   `check-card-fire.cjs` (card-fire repointed to it); `scripts/check-voice-style.cjs` is a
   log-only Stop hook (U+2014/U+2013 scan plus `detectVoiceMark`) writing through
   `lib/hmi/voice-style-log.cjs` under `MINDRIAN_HOME`, always `continue: true`.
9. `scripts/doctor.cjs --acceptance` gains one `harness-policies` point (shape of
   `worktree-hygiene`) that spawns the runner `--check`; wired only after slice 1 is green.
10. `lib/core/recipe-maps.cjs` tolerates the new keys and exposes `policies`; `command-registry.json`
    and the sync payload Theo reads are unchanged (T-side brief, 0bc3304b).
11. Tests: `test-298-policies-schema`, `test-298-runner-idempotent`, `test-298-derive-health`,
    `test-298-voice-log`, `test-298-contract-parity`; existing 167/201/235, the nine
    frozen-phrase tests, `no-instructions.test.cjs`, `test-doctor-acceptance-self-coverage`,
    `check-hook-schema-compatibility` stay green.

## Boundaries (out of scope)

No orchestration framework or engine; no RL; no merge or retirement of the three recipe maps;
no change to the Brain wire or to `command-registry.json`; no rewrite of Larry's voice; no room
repair (SEED-037 4c is separate); no regeneration of dist mirrors as a side effect.

## Acceptance

The four truths in the spec's Goal section, verified live: `--check` fails on a dropped phrase,
a stale count, or a busted byte budget; every gate is reachable from a policy entry; the
runner is a no-op on the fixture; a fresh Larry passes the four beta.27 behavioral tests on
the CLI and on Desktop/Cowork and shows a governance basket for a two-candidate write.
