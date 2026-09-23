# Phase 357: Gate-triad replay harness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
**Mode:** `--auto`. The navigator's /goal was "run e2e all those that don't need waiting". Every area was
auto-selected with its recommended option. Chain auto-advance to execute was deliberately NOT engaged, because
execution waits for Phase 354.
**Areas discussed:** Fixture format, Dogfood extraction, Runtime fix shape, Jev labeler, Harness surfaces, Prose shrink anchoring

---

## Fixture format
| Option | Description | Selected |
|--------|-------------|----------|
| Adapter over the 238 file + new per-source files | Existing tests keep importing the 238 file; no drift | ✓ |
| Copy the 238 entries into a new corpus | One file, but a duplicate that drifts | |
**[auto]** Selected the adapter (reuse before build, Canon Part 7).

## Dogfood extraction
| Option | Description | Selected |
|--------|-------------|----------|
| Local extractor from transcripts + intercept log, sanitize, navigator ratifies | Part 8 clean; one human checkpoint | ✓ |
| Hand-author dogfood-shaped synthetic cases | No transcripts, but not real dogfood | |
**[auto]** The navigator ruled "local labels only" at spec round 2.

## Runtime fix shape
| Option | Description | Selected |
|--------|-------------|----------|
| `'harness'` source class from isMeta / leading envelope tag (root-caused) | Deterministic, structural, fixes the anchor case | ✓ |
| Primary arm + 0 labels -> pass | Would create new misses (the primary arm exists to catch a silent model) | |
| Retune relevance token overlap | Semantic guessing again; no named failing entry yet | |
**[auto]** The root cause was verified in the session transcript: the record before the block was
`isMeta: true` `<agent-message>`.

## Jev labeler
| Option | Description | Selected |
|--------|-------------|----------|
| Shared client, own `card_fire_replay` profile, 3 independent Nouls, 0.80/0.20 bands | Matches 356 D-06..D-09 | ✓ |
| Single Choice question over verdicts | Mixes Choice and Noul semantics; 355-BRIEF warns against it | |

## Harness surfaces
| Option | Description | Selected |
|--------|-------------|----------|
| `--surface cli|mcp|both`, temp MINDRIAN_HOME, fetch stubbed | Tri-Polar parity plus hermetic runs | ✓ |
| CLI only | Leaves Desktop/Cowork unverified | |

## Prose shrink anchoring
| Option | Description | Selected |
|--------|-------------|----------|
| Anchor on section headers; leave Post-Gate Handoff untouched | Survives 356's line shifts; honors jsagi-a7's constraint | ✓ |
| Line ranges | Brittle while 356 is editing the same file | |

## Claude's Discretion
- Script module layout, fixture ids, the test file split.

## Deferred Ideas
- The room-bind picker firing on harness turns (same class, different hook)
- intent-classifier minting unrelated F.1 reaches
- The other 13 Larry judgments
- Prose forks with 0 labels (known miss)
