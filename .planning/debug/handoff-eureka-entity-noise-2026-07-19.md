---
kind: rca
slug: handoff-eureka-entity-noise-2026-07-19
status: open
created: 2026-07-19
origin_machine: Windows (C:\Users\PC) - NOT the dev workspace
target_machine: dev workspace (/home/jsagi/dev/MindrianOS-Plugin/)
resume_with: /gsd-debug handoff-eureka-entity-noise-2026-07-19
canon_parts: [7, 9, 11]
related: SEED-070, docs/RCA-TEMPLATE.md
---

# Handoff: eureka entity-extraction noise + two infra blockers

## READ THIS FIRST: provenance warning

This report was produced on a **Windows machine that is not the dev workspace**.
CLAUDE.md names `/home/jsagi/dev/MindrianOS-Plugin/` as THE ONLY DEV WORKSPACE.
The machine that produced these findings has two MindrianOS trees, neither of
which is authoritative:

| Tree | Path | Status |
|------|------|--------|
| Install cache | `~/.claude/plugins/mindrian-os` | v1.15.3-beta.28, **missing `lib/core/eureka/` entirely** |
| Clone | `C:\Users\PC\Projects\mindrian-os-plugin-clone` | branch `seeds/host-runtime-research-2026-07-18`, 6 commits AHEAD of origin/main, UNPUSHED |

**Every code-level claim below is therefore PROVISIONAL and must be re-verified
against the dev workspace before any fix is planned.** The file paths, line
numbers, and quoted snippets came from the clone, which may itself be a stale
mirror. Treat this document as a set of leads, not a set of confirmed defects.

## BLOCKER 0: unpushed work on the origin machine

The clone is ahead of `origin/main` by 6 commits, all on a non-main branch:

```
0e0234b4 seeds: SEED-070 live eureka run 2026-07-19 + the stale-bytes lesson
2b813ec7 seeds: SEED-069 open core, where the boundary is a NETWORK boundary
25a93124 seeds: SEED-068 host matrix -- Tier 0 passes universally; tier model inverted
0a3651f3 seeds: SEED-068 be infrastructure, not an application
6921ab14 seeds: SEED-067 scope correction -- BYO-sub is forbidden by Anthropic
2a21125d seeds: SEED-062..067 host-runtime research
```

Uncommitted on top: `room/STATE.md`, `room/decisions/ROOM.md`,
`room/product-evolution/ROOM.md`.

**The dev machine cannot see any of this.** Push the branch (or cherry-pick
SEED-070, which is directly relevant) before working the items below, or the
dev machine will re-derive lessons already recorded.

Note SEED-070 already captured a related conclusion from an earlier run the
same day: *"Not too few entries - too few worlds. Never evaluate eureka on a
single-project room."* That lesson stands and is not superseded by this report.

## What was attempted

Requested: test the eureka engine on a relevant room. Selected
`nv-diamond-meg` (NV-center magnetometry, ~20 artifacts across
problem-definition, competitive-analysis, market-analysis, solution-design)
over `mindrian-os-self` (4 entries).

## BLOCKER 1: room_bind does not propagate

`room_bind` reports success, every downstream read resolves elsewhere.

```
room_bind({room:'nv-diamond-meg', sessionId:'69627f0d-...'})
  -> {ok:true, bound:true, primary:'nv-diamond-meg', source:'explicit'}

room_state_bound()
  -> room_dir: C:\Users\PC\MindrianRooms\mindrian-os-self        WRONG

intelligence eureka-run (context:'nv-diamond-meg')
  -> wrote C:\Users\PC\MindrianRooms\mindrian-os-self\.mindrian\eureka\   WRONG
```

Two sub-findings:
- The bind never reaches the eureka room resolver; it falls back to the active room.
- `context` on the `intelligence` tool is not a room selector. If callers are
  expected to steer rooms with it, that is undocumented; if not, it silently
  accepts and ignores a room name, which reads as success.

**Consequence: the requested test never ran.** Everything below describes a
run against the wrong, near-empty room.

## BLOCKER 2: installed plugin has no eureka code

```
~/.claude/plugins/mindrian-os/lib/core/eureka/           MISSING
~/.claude/plugins/mindrian-os/scripts/entity-extract.cjs MISSING

Projects/mindrian-os-plugin-clone/lib/core/eureka/       EXISTS
Projects/mindrian-os-plugin-clone/scripts/entity-extract.cjs EXISTS
```

The `mos:*` MCP tools on this machine are running bytes that do not contain the
engine being debugged. This is the same stale-bytes class SEED-070 already
flagged. **Whether this reproduces on the dev machine is UNKNOWN and is the
first thing to check.**

## Run result (wrong room, 4 entries)

| Signal | Value |
|--------|-------|
| Runtime | 0.9s, live local embedding spine, sqlite-vec |
| Graph nodes loaded | 751 |
| Typed edges (CONVERGES) | 3 |
| Cohort techs | 15 |
| Pairs scored | 50 |
| Scaffold pairs excluded | 55 |
| Top composite | 0.453 |
| Banked | **0 of 25** (critic resolved all as `general_shallow`) |
| Tail quadrant | INSUFFICIENT STRUCTURE (15 techs vs MIN_COHORT 30) |

**What worked, and should not be regressed:** the engine refused to bank
anything, printed the honest degenerate tail verdict instead of dressing up
noise, stamped `strategic_fit 0.25` weak-dim on all 25, and the provenance
table told the truth about its own substrate. The honest-degrade contract
(SEED-058/059) held.

**What failed:** rank 1 through 5 are scaffolding paired with junk entities.

```
rank 1 | memory_artifact:_root:ROOM x entity:entity-extract:1fb55d: CSFs    | 0.453
rank 2 | memory_artifact:_root:ROOM x entity:entity-extract:b3a83a63: Windows | 0.453
```

## Lead A: tier-1 extractor is a greedy Title-Case regex

`lib/core/eureka/entity-extractor.cjs:143` (clone):

```js
const PROPER_RUN = /\b([A-Z][A-Za-z0-9&.\-]*(?:[ \t]+[A-Z][A-Za-z0-9&.\-]*){0,2})\b/g;
```

Every match on a body-prose line becomes a candidate. Type defaults to
`'company'` when no heading lean applies. Defenses are three hand-curated Sets
(`STOPWORDS` function words only, `FRAMEWORK_TERMS`, `NOISE_TERMS`) plus
`FILENAME_RX` and `METADATA_FIELD_RX`. Cap `DEFAULT_MAX_PER_ARTIFACT = 25`.

- "Windows" passes every filter as a one-token Title-Case run.
- "CSFs" passes because `[A-Z][A-Za-z0-9]*` cannot distinguish an acronym from
  a company name. The stoplist knows `tam/sam/som/kpi/roi/mvp/poc`, not `CSF`.

Input is body prose of `.md` files (NOT file paths, NOT frontmatter).
`collectArtifacts()` in `scripts/entity-extract.cjs:236-303` sweeps every `.md`
in every non-dot section directory. "Windows" most plausibly came from prose
like "on Windows" in an ops note.

## Lead B: the fail-open path, and why the obvious fix is WRONG

`lib/core/eureka/entity-classifier.cjs` has two distinct failure paths. An
earlier draft of this analysis proposed flipping both to fail-closed. **That
was wrong and is retracted here.**

Fail-open at `_fallback()` is a **documented, threat-modeled contract**, not an
oversight. File header line 38-41:

> DEGRADE-TO-PASSTHROUGH CONTRACT: with no resolvable key, no available
> transport, a non-2xx response, a timeout, an unparseable body, or any other
> failure, this module returns the fallback [...] so the caller writes exactly
> today's behavior. It NEVER throws.

Line 69 carries a threat id: `fail-open to today's behavior (threat T-T2-01)`.

Reversing it would break **Decision 8 (Tier 0 fully functional; graceful
degradation everywhere)**: no API key would mean zero entities, which means no
eureka substrate at all.

The corrected reading:

| Path | Line | Meaning | Correct behavior |
|------|------|---------|------------------|
| `_fallback()` | 112 | No key / no transport. **Model never ran.** | Fail OPEN. Correct as written. Do not touch. |
| `_coerceLabels()` | 127 | Model ran, returned an unusable value for this term. | Fail open here is the actual defect. |

Line 127: `labels[n] = (v && VALID_LABELS.has(v)) ? v : 'what';`

The model was asked, answered, and its answer was garbage - and that is
promoted to a confirmed entity. That is not graceful degradation.

## Proposed direction (NOT a plan, needs verification first)

A provenance split rather than a contract reversal:

1. Leave `_fallback()` fail-open. Tier 0 guarantee preserved.
2. Tighten `_coerceLabels()` so an unrecognized model response drops the term
   instead of defaulting it to `what`.
3. Stamp entities born from `source:'fallback'` with a distinct `evidenceTier`,
   and have `lib/core/eureka/room-native-substrate.cjs` exclude them from
   pairing. The exclusion machinery already exists: the run above dropped 55
   scaffold pairs and 0 container pairs.

Net effect: Tier 0 keeps writing nodes; eureka stops treating unverified regex
hits as opportunity candidates.

## OPEN QUESTIONS (blocking - do not skip)

1. **What is threat T-T2-01?** Referenced at `entity-classifier.cjs:69` and
   :119. The threat doc was never located. If fail-open was chosen to prevent
   an adversarial document from suppressing extraction by inducing classifier
   failure, then any tightening is a DoS surface and needs a different design.
2. **Which tests assert the passthrough contract?** Almost certainly some leg
   of `tests/run-all-*.sh` asserts "no key -> all `what`, source `fallback`".
   Find it before editing.
3. **What was `classifier_source` on the observed run?** Check `status.json`.
   This decides the whole question:
   - `fallback` -> the gate never ran; the provenance split is sufficient.
   - `model` -> tier-1 regex noise survived a REAL model pass, and the
     extractor itself needs replacing.
4. Does BLOCKER 2 (missing `lib/core/eureka/` in the install cache) reproduce
   on the dev machine, or is it an artifact of this Windows install?

## Tool evaluation (licensing cleared, adoption NOT recommended yet)

Raised during the session. Both are license-clean for commercial use; neither
addresses the defect above, and both are Python boundaries in a Node engine.

| Tool | Layer | License | Verdict |
|------|-------|---------|---------|
| [LangExtract](https://github.com/google/langextract) | extraction (would replace PROPER_RUN) | Apache 2.0, express patent grant. Obligations: ship LICENSE + NOTICE, state changes. Caveat: Google states it is "not an officially supported Google product" | Defer until open question 3 is answered |
| [MarkItDown](https://github.com/microsoft/markitdown) | ingestion (PDF/DOCX/PPTX -> md) | MIT. Preserve copyright notice | Genuinely wanted for `nv-diamond-meg` (arXiv papers, spec sheets, decks), but amplifies noise until the gate is fixed. Sequence matters |

On nested ICM specifically: LangExtract handles attribute-nested extraction via
few-shot `extraction_classes`. But ICM Layers 0-4 are the on-disk corpus
organization, not a structure inside the prose. You would not extract the ICM
hierarchy; you would extract differently per layer, using the layer as a schema
selector. That is dispatch design, buildable around any extractor including the
current one. It is not a reason to adopt a library.

## Suggested first moves on the dev machine

1. Push or cherry-pick the 6 unpushed seed commits (BLOCKER 0).
2. Confirm or refute BLOCKER 2 on the dev tree.
3. Answer open question 3 (`classifier_source` in `status.json`) - this is the
   cheapest measurement and it decides the fix.
4. Read T-T2-01 and the passthrough tests (open questions 1 and 2).
5. Only then open a GSD session for the provenance split.

Separately and independently: BLOCKER 1 (room_bind) is its own defect and
should get its own slug. It is not caused by, and does not depend on, anything
in the extraction pipeline.

## Verification gates this work must clear

Per CLAUDE.md before any fix is called done: Canon Part 8 Brain-boundary,
Tri-Polar three-surface (CLI + Desktop + Cowork), cross-platform, release
lockstep, no em-dashes, reuse-before-build.
