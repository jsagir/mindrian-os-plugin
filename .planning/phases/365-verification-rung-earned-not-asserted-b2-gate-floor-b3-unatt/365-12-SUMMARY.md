---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 12
subsystem: verification-renderers
tags: [b5, renderers, room-home, graph-export, part-8, standing-words]
requires: [365-04]
provides:
  - room home facts (claim rows) carry standing and standing_words; new held_claims list on room home
  - graph export claim rows carry verification_standing and verification_words
  - findUnsupportedClaims rows carry standing and standing_words (research preflight evidence_gaps inherit them)
  - presentation graph node detail panel shows a "Checked against" row
  - tests/test-365-b5-renders.cjs (B0..B10)
affects: [365-15, 365.1]
requirements: [V365-16]
key-files:
  created:
    - tests/test-365-b5-renders.cjs
  modified:
    - lib/core/navigation/room-home.cjs
    - lib/core/navigation/graph-export.cjs
    - lib/core/navigation/insights.cjs
    - lib/core/navigation/verification-signals.cjs
    - lib/graph/graph-detail-panel.js
    - tests/test-graph-export-part8-leak.cjs
decisions:
  - "Standing is computed in graph-export.cjs with the DatabaseSync handle lazygraph-ops openGraph already returns (it has prepare()), by calling the one claimStanding; nothing is recomputed in the browser"
  - "A held claim on room home is {id, text, standing, standing_words, moves_when}; text is read from properties.text (where claim nodes keep it) because the existing safeShape summary reads summary, claim or title and would be empty"
  - "Only type claim rows get standing fields on room home and graph export; assumption, decision, opportunity and every non-claim graph row keep their exact prior keys"
metrics:
  tasks: 3
  files: 7
  commits: 3
---

# Phase 365 Plan 12: Standing Words on the Remaining Claim Renderers Summary

Room home, graph export, unsupported-claim findings, research preflight gaps and the presentation graph node panel now name a claim's standing in words from the one shared map (STANDING_WORDS), a claim held at needs_evidence is visible on room home with the move that would release it, and the Brain packet projection is byte-for-byte unchanged.

PLAN_BASE = `38eb05e605fe9d7909f89d1e6d516e18b67f6ada`. Pre-flight `bash tests/run-all-365.sh` was PASSED=54 FAILED=0 SKIPPED=1 KNOWN=8 before the first edit.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `5a01aeba8` | feat(365-12): room home and graph export name each claim's standing; held claims shown |
| 2 | `025f4f9b4` | feat(365-12): unsupported findings and preflight gaps name the standing; Brain packet unchanged |
| 3 | `df90f795c` | feat(365-12): presentation graph node detail names a claim's standing |

Each used `git add <exact paths>` then `git commit --only -- <exact paths>`; all three pass `git merge-base --is-ancestor <sha> HEAD`. STATE.md and ROADMAP.md untouched; no `state.*` writer, `roadmap.update-plan-progress` or `query commit` ran. The peer's `353-FLEET-REPORT.json` diff and the Phase 366 hunks were left alone.

## Re-run renderer enumeration (grep at execution time)

`grep -rln "review_status" lib scripts --include=*.cjs` returned 80 files; the rest are node writers, migrations, gates and tests. Files that render a claim to a person, classified:

| Renderer | File | Disposition |
|----------|------|-------------|
| claim view, list, portrait | verification.cjs, scripts/claim-checks.cjs | follow-on: 365-15 (not this plan) |
| gate card, meeting card | gate.cjs, tool-router.cjs | follow-on: 365-08 (not this plan) |
| room home facts + held claims | navigation/room-home.cjs (via room-context.cjs) | DONE here (Task 1) |
| graph export claim rows | navigation/graph-export.cjs (consumed by generate-presentation.cjs and scripts/build-graph-from-sqlite.cjs) | DONE here (Task 1) |
| unsupported-claim findings | navigation/insights.cjs findUnsupportedClaims | DONE here (Task 2) |
| research preflight evidence_gaps | navigation/research-preflight.cjs | carried by composition: it concatenates findUnsupportedClaims rows, so claim gaps now hold standing_words with no edit to the file (B6) |
| presentation graph node detail | lib/graph/graph-detail-panel.js (data from canvas-graph.js hoveredNode.data) | DONE here (Task 3) |
| generate-presentation.cjs | scripts/generate-presentation.cjs | no change: collectGraphExport hands getGraphExport's node data to ROOM_DATA untouched (no field whitelist); B9 proves it end to end |
| dashboard.html | templates/presentation/dashboard.html | no node detail on the dashboard (its mini graph passes `{}` options, no GraphDetailPanel, no onNodeClick), no change; B10 fails loudly if one is added without the row |
| scripts/generate-export.cjs queryLazyGraph | scripts/generate-export.cjs | no claim rows (it selects edges plus endpoint titles only), no change |
| scripts/build-graph-from-sqlite.cjs | reads the getGraphExport payload | inherits the two fields; no edit |
| leverage-scan.cjs, graph-integrity-counts.cjs, claim-counter-metric.cjs, room-delta-facts.cjs, section-gate.cjs | counts and scans over type=claim | counts only, no per-claim line rendered to a person; no change |
| close-loop-writer.cjs, huji-intake.cjs, check-pending-*.cjs, eureka-portfolio-report.cjs and the other writers | writers or reports not listing claim standing | no change |

No claim renderer outside the research's list was found that needed an additive field.

## Behavior shipped

- Room home (`getRoomHomeView`): claim-type rows in `confirmedFacts` gain `standing` and `standing_words` (`STANDING_WORDS[standing].label`); every existing key stays. New `held_claims`: claims at `needs_evidence`, each `{id, text, standing, standing_words, moves_when}` (moves_when from the same map); an empty list when none. A held claim was neither a confirmed fact nor a risky assumption (that set is assumption-typed), so it used to vanish.
- Graph export: claim-type node rows gain `verification_standing` and `verification_words`; non-claim rows keep their exact 7 keys; golden-room node, edge and excluded counts unchanged. The Part 8 whitelist grows by exactly these two keys, claim rows only.
- `findUnsupportedClaims` rows gain `standing` and `standing_words`; `renderExplanation` call and string untouched; `packet.cjs` untouched (`git diff 38eb05e60 -- lib/core/navigation/packet.cjs` is empty).
- Panel: after the Status row, `Checked against: <span>words</span>` through `esc()`, only when `verification_words` is a non-empty string; no score, percent, badge or color.

## Test results

| Run | HEAD | Result |
|-----|------|--------|
| `node tests/test-365-b5-renders.cjs` | `df90f795c4a7db047aeb56312c2aab976ea352d6` | PASS B0..B10 (B9 ran, did not skip) |
| test-232-room-home, test-graph-export, test-graph-export-golden-room, test-graph-export-part8-leak | `5a01aeba8` and later | all exit 0 |
| test-navigation-insights, test-reverse-salient-agent, test-348-contradictions-floor, test-navigation-packet-part8-leak, test-brain-packet-part8-invariant-per-job, test-brain-packet-validation-per-job, test-navigation-acceptance, test-348-caller-matrix, test-room-home-vs-brain-derivation-regression, test-365-signals | `025f4f9b4` and later | all exit 0 |
| `bash tests/run-all-365.sh` | `df90f795c4a7db047aeb56312c2aab976ea352d6` | exit 0, `PASSED=55 FAILED=0 SKIPPED=1 KNOWN=8` (54 to 55: +1 new test) |

Out-of-scope reds seen while checking room-home neighbors, not caused by this plan: `test-129.5-truth-machine` (fs-instrument leak of `~/.mindrian/persona-override.json`, an environment read) and `test-131-substrate` (edge and event type net-new delta counts). Neither touches room-home or graph-export logic; not fixed.

## Deviations from Plan

**1. [Rule 1 - Bug] verification-signals.cjs wrote the model_only label as a second literal.** 365-11's signal 1 message spelled `recorded as checked only by asking a model` inline (and in a header comment), which is exactly what D-19 and the B4 one-map scan forbid. Changed the code to read `verification.STANDING_WORDS.model_only.label` (output byte-identical, test-365-signals still passes) and reworded the comment. File not in the plan's list; committed with Task 1.

**2. [Rule 3 - Blocking] tests/test-graph-export-part8-leak.cjs pinned the exact 7-key whitelist for every node.** The structural leg failed once claim rows legitimately carried two more keys. Updated it to allow `verification_standing` and `verification_words` on claim-type rows only (all other rows still exactly the 7). Committed with Task 1.

**3. [Scope note] research-preflight.cjs and scripts/generate-presentation.cjs and templates/presentation/dashboard.html were not edited.** The plan listed them as conditional. Preflight inherits the fields by composition (B6 asserts it); the presentation script has no field whitelist (B9); the dashboard has no node detail (B10). Each is recorded above rather than touched.

**4. [Scope note] held_claims text.** The plan says "text as room-home already shapes it"; the existing shaper reads `summary`/`claim`/`title`, which claim nodes do not carry (their sentence is `properties.text`), so a held claim would have shown empty text. `held_claims` falls back to `properties.text` (cut at 120 chars like the existing shaper). Facts rows keep the old shaper untouched.

## Known Stubs

None.

## Threat Flags

None new. T-365-06: packet.cjs untouched, B7 pins the five projection keys and asserts no standing label, `standing_words` or `verification_words` appears anywhere in the serialized packet. T-365-23: B4 scans lib, scripts and commands and finds the four labels only in verification.cjs. T-365-11: commit --only on exact paths, ancestor checks passed.

## Hand-offs

- **Wording ratification:** the panel row reads `Checked against: <verification_words>`, and `verification_words` is the full provisional label, so a model_only claim reads "Checked against: recorded as checked only by asking a model". Awkward but per the plan; when the paper author ratifies the ladder, change `STANDING_WORDS` in verification.cjs only (and consider a short `checked_against` phrase for this row, which already exists in the map, via a one-line field swap in graph-export.cjs).
- **365-15:** claim view, list and portrait remain; `held_claims` shape (`id, text, standing, standing_words, moves_when`) is the vocabulary to reuse.
- **365-08:** gate card unchanged here.
- **365.1:** only the body of `claimStanding` changes; every surface in this plan reads it, so nothing here needs touching.

## Self-Check: PASSED

- FOUND: tests/test-365-b5-renders.cjs, the four modified lib files, lib/graph/graph-detail-panel.js
- FOUND commits: 5a01aeba8, 025f4f9b4, df90f795c (all ancestors of HEAD)
- `grep -nP '[\x{2013}\x{2014}]'` over every file this plan touched: no hits
