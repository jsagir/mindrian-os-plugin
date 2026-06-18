---
phase: 163
plan: 06
subsystem: trending-to-absurd Wave-6 VERIFY -- the adversarial structured verdict + the finalized run-all-163.sh phase gate
status: complete
tags: [trending-to-absurd, visionary-innovation-companion, harness-as-code, adversarial-verdict, structured-verdict, part-8-leak-scan, frozen-edge-set, part-9-proposed-not-confirmed, exclusive-ownership, icm-layer-0, phase-gate, wave-6-verify, part-4, part-6, part-8, part-9, part-10, D-163-01, D-163-03, D-163-05, D-163-06]
requires:
  - lib/core/navigation/edges.cjs (ALLOWED_EDGE_TYPES frozen Set -- the verdict CHECK 2 floor + the four domain edges)
  - lib/core/navigation/typed-domain.cjs (writeDomainNode + linkDomainToRelated + DOMAIN_EDGE_SUBSET -- CHECK 2 no-leak + CHECK 3 Part 9)
  - lib/core/trending-to-absurd/orchestrator.cjs (registerTrendArtifacts -- the Wave-4 filing pass CHECK 1 + CHECK 5 drive)
  - lib/core/trending-to-absurd/stage7-roadmap.cjs (generateStage7Roadmap -- CHECK 1 + CHECK 3 + CHECK 5 drive)
  - tests/test-typed-domain.cjs (the in-memory migrated-nodes freshDb schema idiom reused verbatim)
  - tests/run-all-156.sh (the BRAIN_WRITE + RAW_FETCH sweep regexes mirrored)
  - tests/test-futures-part8-leak.cjs (the FW-11 adversarial floor mirrored)
provides:
  - tests/test-trending-to-absurd-verdict.cjs (the five-check adversarial structured verdict -- {passed, findings[]})
  - tests/test-trending-to-absurd-part8-leak.cjs (the Part 8 leak scan over all Phase-163 surfaces)
  - tests/run-all-163.sh (the finalized single PASS/FAIL phase gate -- 9 suites + connector + Part-8 sweep + frozen-edge assertion + em-dash sweep)
  - lib/core/trending-to-absurd/stage7-roadmap.cjs (the seed-folder ROOM.md fix the verdict forced)
affects:
  - the v1.14.0 Visionary Innovation Companion phase -- now proven by instrumentation to honor the canon
  - the harness-as-code 9-property mandate -- the adversarial structured verdict property is now realized for Phase 163
tech-stack:
  added: []
  patterns:
    - "harness-as-code property 6 (adversarial structured verdict): the verdict assumes every surface is hostile until proven compliant and returns {passed, findings[]} over five checks, never a vibe"
    - "Part 7 reuse: the freshDb in-memory migrated-nodes schema idiom from test-typed-domain.cjs; the run-all-156.sh BRAIN_WRITE + RAW_FETCH regexes; the FW-11 futures leak-floor structure; the registerTrendArtifacts + generateStage7Roadmap filing passes driven live (not re-implemented)"
    - "delegation-not-duplication: verdict CHECK 4 (Part 8 leak) execFileSyncs the dedicated leak-scan suite rather than re-inlining the scan"
    - "comment-filtered grep gates (grep -v style): the run-all-163.sh RAW_FETCH + external-http sweeps filter // and * comment lines so a doc comment naming fetch( as prose never self-invalidates the count; never a bare unfiltered == 0 gate"
    - "frozen-set discipline: CHECK 2 + the bash assertion assert a FLOOR (membership of every prior additive type + the four domain edges) and Set-frozen, NEVER .size, so additive extensions cannot regress baseline"
    - "ICM Layer 0 everywhere (CLAUDE.md decision 15): the verdict walks every TTA-owned folder and asserts a ROOM.md; the Stage 7 fix gives the intermediate seed folder its own identity file"
key-files:
  created:
    - tests/test-trending-to-absurd-verdict.cjs
    - tests/test-trending-to-absurd-part8-leak.cjs
  modified:
    - tests/run-all-163.sh
    - lib/core/trending-to-absurd/stage7-roadmap.cjs
decisions:
  - "DELEGATED the verdict's Part 8 check (CHECK 4) to the dedicated leak-scan suite via execFileSync rather than re-inlining the scan -- one scan implementation, two consumers (the verdict + the run-all gate)"
  - "SCOPED the verdict's ROOM.md/nesting check (CHECK 1) to the TTA-OWNED subtree (folders carrying the trending-to-absurd seed prefix) -- the harness owns its subtree (T-163-10), NOT the opportunity-bank/ root (a room-scaffold concern given its ROOM.md at room creation, not by this harness). Asserting the bank root would test the room scaffolder, not the Phase-163 surface."
  - "FIXED (deviation Rule 2) the Stage 7 generator to write a ROOM.md on the intermediate seed folder its recursive mkdir creates -- the adversarial verdict CHECK 1 caught this as a real ICM Layer 0 gap (CLAUDE.md decision 15: EVERY directory gets a ROOM.md, no exceptions)"
  - "EXCEPTED the .mindrian/ room.db substrate from the exclusive-ownership walk (CHECK 5) -- the registrar's SQL local-mind is not an opportunity-bank/ escape; the Wave-4 orchestrator test carves it out identically"
metrics:
  duration: ~1 session
  completed: 2026-06-18
  tasks: 2
  files: 4
---

# Phase 163 Plan 06: Adversarial Structured Verdict + Finalized Phase Gate Summary

WAVE 6 VERIFY landed: the harness-as-code property 6 (an adversarial verify that
returns a STRUCTURED VERDICT, not a vibe) is now realized for Phase 163, plus the
finalized `tests/run-all-163.sh` that is the single PASS/FAIL phase gate. The
verdict proved by instrumentation that the foundation (Waves 1-3) and the surfaces
(Waves 4-5) honor the constitution: ROOM.md/nesting holds, the frozen edge set is
intact (the four domain edges present + the full prior FLOOR preserved + no
non-domain edge leaked into the domain writers), no Part 8 egress, Part 9
proposed-not-confirmed holds, and exclusive ownership is enforced. The adversarial
verdict also EARNED ITS KEEP: it caught a real ICM Layer 0 gap in shipped Wave-5
code and forced the fix.

## What shipped

### Task 1 (commit c430cfba) -- the five-check verdict + the Part 8 leak scan

- `tests/test-trending-to-absurd-verdict.cjs` (new): returns a structured
  `{ passed, findings[] }` over FIVE checks, each pushing a `{ check, passed,
  detail }` into findings[]; the suite exits non-zero and prints the findings if
  ANY check fails (a real defect surfaces as a FINDING, never silently passes):
  1. **room_md_nesting** -- drives a real TTA filing pass (`registerTrendArtifacts`)
     plus a `generateStage7Roadmap` over a tmp room, then asserts every TTA-owned
     folder under opportunity-bank/ carries a ROOM.md (ICM Layer 0) and every
     artifact .md sits in its own named folder (CLAUDE.md decisions 15 + 16).
  2. **frozen_edge_set** -- asserts the four domain edges (DECOMPOSED_INTO /
     PART_OF / TAGGED_WITH / RELATED_TO) are members of ALLOWED_EDGE_TYPES, the
     full prior FLOOR (21 prior additive types through the Phase 150.8 trio) is
     preserved, the Set is frozen, and `linkDomainToRelated` REJECTS a non-domain
     edge (INFORMS -- a legal frozen type but not a domain edge -- and a made-up
     type), with only the one DECOMPOSED_INTO edge landing in the edges table.
     Never asserts `.size`.
  3. **part9_proposed_not_confirmed** -- a truth-claim domain (taxonomy absent)
     lands review_status 'proposed'; the taxonomy carve-out (taxonomy:true) is the
     only path to system-confirmed; a Stage 7 venture-truth step stays proposed
     in-object AND on-disk; nothing is auto-confirmed.
  4. **part8_leak** -- delegates to the leak-scan suite via execFileSync (asserts
     it exits zero).
  5. **exclusive_ownership** -- drives the orchestrator + Stage 7, walks the WHOLE
     room tree, and asserts ZERO file lands outside room/opportunity-bank/ (the
     .mindrian/ room.db substrate excepted, identical to the Wave-4 carve-out).
- `tests/test-trending-to-absurd-part8-leak.cjs` (new): a boundary scan over ALL
  Phase-163 surfaces (typed-domain, get-domains-for-trends, domain-hierarchy, the
  trending-to-absurd/*.cjs harness, the command, the skill) for the forbidden
  tokens -- mcp__brain_(write|store|upsert|ingest), writeBrain/sendToBrain/
  ingestToBrain, a raw fetch( egress in lib code, and a hardcoded external http(s)
  endpoint (github.com excepted). The egress regexes apply to lib code only and
  skip comment lines (the `grep -v '^#'` spirit); every finding is collected and
  the suite exits non-zero with the finding list.
- `lib/core/trending-to-absurd/stage7-roadmap.cjs` (modified, Rule 2 fix):
  `generateStage7Roadmap` now writes a ROOM.md on the intermediate seed folder
  (opportunity-bank/trending-to-absurd-<seed>/) its recursive mkdir implicitly
  creates -- the ICM Layer 0 gap CHECK 1 caught.

### Task 2 (commit a2817910) -- finalize run-all-163.sh as the single phase gate

- `tests/run-all-163.sh` (modified): the complete aggregator, mirroring
  run-all-156.sh end to end:
  - CJS_SUITES now lists all 9 Phase-163 suites in dependency order (the Wave-6
    verdict + leak suites appended).
  - the per-suite loop runs to completion (a missing file gates to a FAIL line,
    never a crash).
  - a Part-8 grep sweep block over every Phase-163 lib + command + skill surface
    (the same BRAIN_WRITE + RAW_FETCH + external-http regexes as run-all-156.sh,
    comment-filtered).
  - a frozen-edge-set assertion (the four domain edges present in edges.cjs; no
    non-domain edge leaked into typed-domain.cjs's DOMAIN_EDGE_SUBSET -- the
    subset block is extracted and every uppercase edge token other than the four
    legal ones is a breach).
  - the em-dash sweep extended to the two new Wave-6 suites (the U+2014 codepoint
    escape so the runner carries no literal em-dash).
  - final tally + exit 1 on any failure; `set -uo pipefail`; bash only; no emoji.

## Verification

- `node tests/test-trending-to-absurd-verdict.cjs` -> PASS (5/5 checks; the
  structured VERDICT line prints `{"passed":true, ...}`).
- `node tests/test-trending-to-absurd-part8-leak.cjs` -> PASS (zero forbidden
  tokens across 8 Phase-163 surfaces).
- Plan Task 1 gate: `node ...verdict.cjs && node ...part8-leak.cjs && echo
  VERDICT_OK` -> VERDICT_OK.
- **`bash tests/run-all-163.sh` -> 13/13 PASS, 0 FAILED, ~1s.** The exact tally:
  9 CJS suites (test-edges-domain-taxonomy-floor, test-typed-domain,
  test-lens-domain-family, test-get-domains-for-trends,
  test-trending-to-absurd-orchestrator, test-trending-to-absurd-stage7,
  test-trending-to-absurd-variance, test-trending-to-absurd-verdict,
  test-trending-to-absurd-part8-leak) + connector-block validation + Part-8 grep
  sweep + frozen-edge-set assertion + em-dash sweep = 13 total, all PASSED.
- Adversarial negative-path confirmed non-vacuous: the leak regexes catch a
  planted mcp__brain_write call and a raw fetch( egress, and correctly EXEMPT the
  sanctioned corpus.fetchCorpus chokepoint.
- `node scripts/build-command-registry.cjs --check` -> command-registry: OK.
- `node scripts/build-connector-registry.cjs --check` -> connector-registry: OK
  (the 8-command opt-in nudge is the pre-existing, unrelated warning carried from
  Wave 5, not a failure).
- No em-dashes in any new/modified file (verified directly + by the gate's own
  em-dash sweep).

## FINDING (real defect, caught + fixed, not silently passed)

**FINDING-163-06-01 [ICM Layer 0 gap -- Stage 7 seed folder missing ROOM.md].**
On its first adversarial run, the verdict CHECK 1 (room_md_nesting) FAILED: the
shipped Wave-5 `generateStage7Roadmap` created `opportunity-bank/
trending-to-absurd-<seed>/stage7-roadmap/` via a single recursive `mkdirSync`,
which implicitly creates the intermediate seed folder
`opportunity-bank/trending-to-absurd-<seed>/` but wrote ROOM.md ONLY to the
stage7-roadmap folder and the artifact folder -- leaving the seed folder it owns
as a ROOM.md-less directory. This violates CLAUDE.md decision 15 (every directory
in the Data Room gets a ROOM.md, no exceptions). Fixed inline (deviation Rule 2)
by writing a ROOM.md identity file on the seed folder. The verdict then passed
5/5. This is precisely the harness-as-code value proposition: the adversarial
verify proved by instrumentation that a constitution claim did NOT hold, and the
gap was closed before the phase declared green.

(The opportunity-bank/ ROOT also lacks a ROOM.md in the verdict's tmp rooms, but
that is OUT OF SCOPE: the TTA harness does not own/create the bank root -- in a
real scaffolded room the bank carries its ROOM.md from room-creation time. CHECK 1
is scoped to the TTA-owned subtree so it tests the Phase-163 surface, not the room
scaffolder.)

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] Stage 7 seed-folder ROOM.md.**
- **Found during:** Task 1, the verdict's first adversarial run (CHECK 1).
- **Issue:** the Stage 7 generator left the intermediate seed folder without a
  ROOM.md (ICM Layer 0 / CLAUDE.md decision 15 violation).
- **Fix:** `generateStage7Roadmap` now writes a ROOM.md on the seed folder it
  creates (idempotent overwrite, equivalent identity body).
- **Files modified:** lib/core/trending-to-absurd/stage7-roadmap.cjs.
- **Commit:** c430cfba (bundled with the verdict suite that surfaced it -- the
  test and the fix it forced belong together).

No other deviations. No architectural changes (Rule 4) arose. No package installs.

## Authentication Gates

None.

## Known Stubs

None. The verdict drives the real Wave-4 registrar and the real Stage 7 generator
over live tmp rooms, the real frozen ALLOWED_EDGE_TYPES Set, and the real
linkDomainToRelated / writeDomainNode chokepoints; CHECK 4 delegates to the real
leak-scan suite. No mocked data sources, no placeholder content.

## Threat surface scan / compliance

- **T-163-16 (frozen-edge-set drift):** verdict CHECK 2 + the run-all-163.sh
  frozen-edge-set assertion assert the four domain edges present, the full FLOOR
  preserved, the Set frozen, and no non-domain edge leaked into the domain writers.
- **T-163-17 (any Phase-163 egress path):** verdict CHECK 4 + the dedicated
  leak-scan suite + the run-all-163.sh Part-8 grep sweep find zero
  Brain-write / raw-fetch / external-http tokens across every lib + command +
  skill surface.
- **T-163-18 (truth-claim auto-confirm):** verdict CHECK 3 asserts truth-claim
  domain + Stage 7 venture-truth steps stay proposed; only the taxonomy carve-out
  reaches system-confirmed.
- **T-163-19 (exclusive ownership escape):** verdict CHECK 5 walks the room tree
  and flags any write outside opportunity-bank/ (the .mindrian room.db excepted).
- **T-163-SC (npm/pip/cargo installs):** zero new packages (pure bash +
  node:test/assert/sqlite). No install task.
- **Part 6 (Product-as-Venture / dog-fooding):** the adversarial verify is the
  plugin honoring its own canon -- it caught and fixed a canon violation
  (decision 15) in its own shipped code.
- **No em-dashes** anywhere (CLAUDE.md HARD RULE); the gate's own em-dash sweep is
  green.

## Self-Check: PASSED

- FOUND: tests/test-trending-to-absurd-verdict.cjs
- FOUND: tests/test-trending-to-absurd-part8-leak.cjs
- FOUND (modified): tests/run-all-163.sh (both new suites registered + Part-8 sweep + frozen-edge assertion)
- FOUND (modified): lib/core/trending-to-absurd/stage7-roadmap.cjs (seed-folder ROOM.md fix)
- FOUND commit: c430cfba (Task 1 -- verdict + leak suites + stage7 fix)
- FOUND commit: a2817910 (Task 2 -- run-all-163.sh finalized)
- GATE: bash tests/run-all-163.sh -> 13/13 PASS
