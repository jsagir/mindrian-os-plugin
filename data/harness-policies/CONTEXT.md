# data/harness-policies/ - Layer 2 Contract

Phase 298 (SEED-032, Harness-as-Code). This directory declares which policies exist and at
what enforcement rung. It is a Layer 2 Contract in the ICM sense: a rung is a statement about
enforcement, not a runtime decision, and it must be diffable in one line.

## Reads

Nothing. This directory is read BY its consumers; it never reads anything itself.

## Does

Declares policies. One JSON file per gate, voice rule, memory-write policy, or contract-parity
set, each validated against `_schema.json`'s closed vocabulary. A policy file states its `id`,
`kind`, `runner` (or an honest `null` ghost), `args`, `rung` (`declared | logged | blocking`),
`evidence_log`, a `promotion_rule` decided before any log is read, `owner`, `pinned_by`,
`applies_to`, and `notes` explaining the rung choice.

## Writes

Nothing. A policy file is hand-authored and hand-edited; nothing in this directory is
generated, and nothing here writes to disk. `scripts/build-harness-manifest.cjs` digests the
directory into `data/harness-manifest.json`'s `policies` key, but the digest is a fingerprint,
never a copy of contents, and it lives outside this directory.

## Human check

A rung change (declared -> logged, logged -> blocking, or a demotion the other way) is a
one-line human edit to one policy file's `rung` key, made after reading
`evaluatePromotion(policy, lines)`'s verdict against the policy's own `promotion_rule`, and
reviewed like any other diff. No script edits `rung`. No script edits `promotion_rule` either;
that value is decided once, at authoring time, specifically so the counting rule cannot be
loosened after the fact to make a verdict pass.

## Change-impact table

Every consumer below must be re-run when a policy file (or `_schema.json`) changes, because
each one either validates against, digests, or spawns from this directory.

| Consumer | What it does with this directory |
|---|---|
| `scripts/build-harness-manifest.cjs --check` | Validates every policy file against `_schema.json` before digesting; an invalid file fails `--check` naming the file and the failing key. Also runs the `contract-*` policies inline (pure file reads: every phrase present in each named surface, the byte budget within limit). |
| The pre-commit drift guard (`scripts/hooks/pre-commit-room-minto-guard.sh` and its byte-identical twin `scripts/hooks/pre-commit`) | Fires `build-harness-manifest.cjs --check` when a staged path matches its trigger regex, so a policy edit that goes stale in the manifest is caught before commit. |
| `scripts/run-harness.cjs` | Loads every policy file, executes each one at its declared rung (`declared` = report only, `logged` = spawn and append evidence, never fail; `blocking` = spawn and fail the tier on non-zero exit), and reports a ghost for any policy whose `runner` is `null` or whose named file is missing. |
| The `harness-policies` doctor acceptance point (`scripts/doctor.cjs`, wired after slice 1 is green) | Spawns `scripts/run-harness.cjs --check --json` and treats a non-zero exit as a release-blocking finding. |

## Migration slices

This phase (298) lands slice 1 only: `gate-worktree-hygiene`, `gate-shape-declaration`,
`gate-tool-honesty`, `gate-card-fire`, `gate-graph-derive-health`, the four voice policies,
`memory-write-policy`, and `contract-parity-larry` - eleven files. Slice 2 (the remaining
`check-*.cjs` gates `verify-release` already runs), slice 3 (the 21 doctor modules, each as a
`gate-*` policy), and slice 4 (the remaining gates plus the promotion review) are explicitly
out of scope here and land in later phases, per the migration order in the design doc
(`docs/superpowers/specs/2026-09-07-harness-manifest-v2-design.md` section 12).
