---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 07
subsystem: decision-advisor
tags: [cynefin, labels-only, validator, fingerprint, relay, refuse-never-strip]

requires:
  - phase: 400-05
    provides: CAUSE_EFFECT_DOMAINS and MOVE_TYPES in lib/core/problem-axes.cjs
  - phase: 399-04
    provides: labels-only.cjs validator and adapter.cjs renderer
provides:
  - context.cause_effect_domain (5-value closed set) in the labels-only validator
  - DOMAIN_TEMPLATES fits_domain_v1 and move_type_v1, MOVE_TYPE_GLOSSES, templateSpec in adapter.cjs
  - catalog.domains, catalog.moveTypes, catalog.templates with 5 ids
  - catalogFingerprint(catalog, opts) in labels-only.cjs (sha256, 64 hex)
  - tests/fixtures/400/render-399-sample.json (frozen 399 renders and provider bodies)
affects: [400-12, 400-14]

tech-stack:
  added: []
  patterns:
    - "A frozen render fixture written before the edit proves the old renders stay byte-identical"
    - "One shared fingerprint function lets two ends of a wire detect a catalog skew"

key-files:
  created:
    - tests/test-400-labels-only-domain.cjs
    - tests/fixtures/400/render-399-sample.json
  modified:
    - lib/core/decision-advisor/labels-only.cjs
    - lib/core/decision-advisor/adapter.cjs
    - tests/run-all-400.sh

key-decisions:
  - "A non-string cause_effect_domain is refused free_text_outside_label_set, the same reason definition_level uses."
  - "fits_domain_v1 without a context domain is refused unknown_template; no new refusal reason was added."
  - "catalogFingerprint also hashes MOVE_TYPE_GLOSSES and the none option, because both are wording that reaches the provider."

requirements-completed: [CY-06, RL-03]

duration: 4min
completed: 2026-11-24
---

# Phase 400 Plan 07: Cynefin closed sets in the labels-only validator and the catalog fingerprint Summary

The one labels-only validator now accepts a 5-value cause_effect_domain and 2 Cynefin templates (fits_domain_v1, move_type_v1 with 5 fixed move glosses). It refuses every other value and never strips. catalogFingerprint gives the client and the relay one sha256 over the canonical catalog.

## Performance

- **Duration:** about 4 min
- **Started:** 2026-11-24T10:21:56Z
- **Completed:** 2026-11-24T10:26:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- context.cause_effect_domain is checked against catalog.domains. 'Complex', 'wicked', '', 'confused', 3 and null are refused with free_text_outside_label_set. The rendered context puts " Cause and effect domain: <id>." after the level part and before the wicked part.
- DOMAIN_TEMPLATES is a separate frozen map, so QUESTION_TEMPLATES keeps exactly its 3 ids (the test-399-adapter pin). templateSpec looks up QUESTION_TEMPLATES first, then DOMAIN_TEMPLATES, else null (own properties only).
- move_type_v1 renders a choice with options keyed by MOVE_TYPES in order. A caller options key is refused unknown_key. A provider body with one changed gloss is refused body_not_render_of_validated_request.
- The 399 sample request and a request with all 3 old templates and every old context key render, and build both provider bodies, byte-identically to the fixture frozen before the edit.
- catalogFingerprint(catalog, opts): node:crypto sha256 over v 1, sorted job pairs, sorted command pairs, definition levels, domains, move types, sorted template specs (canonical key order) from both maps, move glosses and the none option. It is cached for the default catalog. opts.templates and opts.moveTypeGlosses are test seams.

## Task Commits

1. **Task 1: Domain and move closed sets (CY-06)** - RED `24b0ca079` (test), GREEN `66abaece4` (feat)
2. **Task 2: The shared catalog fingerprint (RL-03)** - RED `37d2a880c` (test), GREEN `6a45915c1` (feat)

## Files Created/Modified

- `lib/core/decision-advisor/labels-only.cjs` - cause_effect_domain context key, catalog.domains and catalog.moveTypes, templates from both maps, needs_domain check, catalogFingerprint, node:crypto require, the Phase 400 header line
- `lib/core/decision-advisor/adapter.cjs` - DOMAIN_TEMPLATES, MOVE_TYPE_GLOSSES, templateSpec, the domain part of renderContext, the move_options branch of renderQuestion
- `tests/test-400-labels-only-domain.cjs` - legs V1 to V6 and P1 to P4 (30 checks); --write-fixture used once before the code edit
- `tests/fixtures/400/render-399-sample.json` - frozen renders and Gemini and Jev bodies of 2 old-template requests
- `tests/run-all-400.sh` - runs the new test after test-400-capability-cynefin-labels.cjs

## Decisions Made

- A non-string domain value gets free_text_outside_label_set, the reason definition_level uses for the same case.
- providers/jev.cjs and providers/gemini.cjs are unchanged. Both build choice criteria from the rendered options and both parsers read non-command option ids (leg V4 proves it for both).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The fingerprint also covers the move glosses and the none option**
- **Found during:** Task 2
- **Issue:** The planned fingerprint document did not include MOVE_TYPE_GLOSSES or NONE_OPTION_GLOSS. Both strings reach the provider, so a gloss skew between the client and the relay would not show in the fingerprint.
- **Fix:** Added move_type_glosses and none_option fields to the hashed document; leg P2 has a gloss-change case through the opts.moveTypeGlosses seam.
- **Files modified:** lib/core/decision-advisor/labels-only.cjs, tests/test-400-labels-only-domain.cjs
- **Commit:** 6a45915c1

**2. [Process] RED commits split per task**
- Legs V1 to V6 and P1 to P4 were written together, then the P legs were held back until Task 2 so that each task has its own RED and GREEN commits.

---

**Total deviations:** 1 auto-fixed (Rule 2), 1 process note
**Impact on plan:** Additive. The fingerprint value is not pinned anywhere yet; plans 12 and 14 call the function, not a literal.

## Issues Encountered

None.

## Verification

- `node tests/test-400-labels-only-domain.cjs`: 30 passed, 0 failed
- `node tests/test-399-adapter.cjs`, `node tests/test-399-advisor-fence.cjs`, `node tests/test-399-transport-capture.cjs`: exit 0
- `node -e '...catalogFingerprint()...'` 64-hex check: exit 0
- `bash tests/run-all-400.sh`: exit 0 (includes run-all-399)
- `bash tests/run-all-399.sh`: exit 0
- `node scripts/build-skill-mirrors.cjs --check`: OK
- No U+2013 or U+2014 in the changed files

## TDD Gate Compliance

- Task 1: test `24b0ca079` then feat `66abaece4` (V2 failed before the edit with unknown_key).
- Task 2: test `37d2a880c` then feat `6a45915c1` (P1 failed before the edit).

## Next Phase Readiness

- Plan 12 (decision relay) and plan 14 (transport) can send catalogFingerprint() in the x-mindrian-catalog header and compare it on the other end.
- No registry was regenerated, so scripts/build-harness-manifest.cjs did not need a run.

## Self-Check: PASSED

- FOUND: lib/core/decision-advisor/labels-only.cjs, lib/core/decision-advisor/adapter.cjs, tests/test-400-labels-only-domain.cjs, tests/fixtures/400/render-399-sample.json, tests/run-all-400.sh
- FOUND commits: 24b0ca079, 66abaece4, 37d2a880c, 6a45915c1

---
*Phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-*
*Completed: 2026-11-24*
