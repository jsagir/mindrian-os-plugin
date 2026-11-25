---
phase: 399-decision-model-advisor-keyed-on-the-job-to-be-done-one-job-v
plan: 04
subsystem: decision-advisor-adapter
tags: [adapter, labels-only, gemini, jev, fence, egress, pure-library]
requires: [399-01, 399-03]
provides:
  - lib/core/decision-advisor/labels-only.cjs (buildLabelCatalog, validateNeutralRequest, validateProviderBody, REFUSAL_REASONS)
  - lib/core/decision-advisor/adapter.cjs (QUESTION_TYPES, QUESTION_TEMPLATES, NONE_OPTION_ID, PROVIDERS, renderContext, renderRequest, chunkRequest, askDecisionModel)
  - lib/core/decision-advisor/providers/gemini.cjs and providers/jev.cjs (pure body builders and parsers)
  - tests/fixtures/399/jev-response-shape.json and gemini-response-shape.json
  - tests/test-399-adapter.cjs (V1-V7, P1-P5), tests/test-399-advisor-fence.cjs (FN1-FN3)
affects: [399-05, 399-06]
tech-stack:
  added: []
  patterns: [refuse-never-strip closed label validator, render-equality body check, dependency-injected transport, lazy provider getters]
key-files:
  created:
    - lib/core/decision-advisor/labels-only.cjs
    - lib/core/decision-advisor/adapter.cjs
    - lib/core/decision-advisor/ROOM.md
    - lib/core/decision-advisor/providers/gemini.cjs
    - lib/core/decision-advisor/providers/jev.cjs
    - tests/fixtures/399/jev-response-shape.json
    - tests/fixtures/399/gemini-response-shape.json
    - tests/test-399-adapter.cjs
    - tests/test-399-advisor-fence.cjs
  modified:
    - tests/run-all-399.sh
decisions:
  - "A body is accepted only when it deep-equals the provider render of a request that passed the validator (validateProviderBody). askDecisionModel checks this for every chunk before the transport runs."
  - "Requests carry labels by reference: subject is a command name, options are command names (array) or a name-to-gloss map whose glosses must equal registry teaching text. job_summary is optional and, when present, must equal the vocabulary summary."
  - "Only commands that have a non-empty teaching string enter the catalog (113 of 113 today)."
  - "context.wicked is allowed as a boolean and renders ' Wicked problem: yes.' only when true. This wording is new fixed text, not part of the recorded run."
  - "Test seams: validateProviderBody takes an optional 5th argument (providers map) and askDecisionModel takes opts.providers and opts.model. Defaults are the real PROVIDERS."
  - "Missing required fields for a template (no subject, empty or missing options, duplicate options) give unknown_command; a key not allowed for the template gives unknown_key; a template and type mismatch gives unknown_type. No new refusal reason was added."
metrics:
  tasks: 2
  completed: 2026-11-24
---

# Phase 399 Plan 04: Provider-neutral decision adapter and labels-only validator Summary

One provider-neutral decision interface (yes_no, choice, score) with a refuse-never-strip labels-only validator, a Gemini shape and a Jev-compatible shape as pure body builders and parsers, and a fence test that keeps network, vendor hosts and keys out of lib/core/decision-advisor/.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Labels-only validator and the neutral adapter (D-03, D-04, I-04, I-11) | aa4019e62 |
| 2 | Gemini and Jev provider shapes, fixtures, no-network fence (D-04, I-04) | 72ace20b1 |

## What was built

- `labels-only.cjs`: closed catalog (20 jobs with summaries, 113 commands with teaching text, 3 definition levels, 3 templates). `validateNeutralRequest` first scans every node (depth cap 8, node cap 200000, finite numbers only, iterative so a circular input cannot overflow), then checks closed key sets and exact membership of every string leaf. It never throws.
- `adapter.cjs`: fixed templates serves_job_v1 (the recorded wording), next_command_v1 and fit_score_v1; `renderRequest` throws on an invalid request, so an invalid request has no render; `chunkRequest` keeps ids and order; `askDecisionModel` validates, chunks to the provider limit, re-checks each body against its render, calls the injected transport once per chunk, merges answers and usage. Transport failure gives `{ ok: false, reason: 'transport_error' }` with no message text. No export is named `decide`.
- Providers: Gemini body `{ model: 'gemini-decision-1', input, questions }`, 1000 questions per request, declares it sorts options, PATH null and PATH_CONFIRMED false. Jev body `{ model: 'jev-latest' | 'kev-latest', state, questions }`, 20 per request, does not sort, PATH `/v1/systemone`. Parsers never throw, drop unknown ids and unknown option keys, and mark an answer `missing: true` for a missing answer or any probability outside [0, 1]. Gemini usage is read from `total_input_tokens` or `totalInputTokens`.
- Fence: FN1 scans every file in the folder (comments and ROOM.md included) for vendor host, `generativelanguage`, `_API_KEY`, `fetch(`, network and brain-client requires, scripts/ requires, and env reads outside the MINDRIAN_DECISION_ADVISOR prefix. FN2 checks 1316 lib and hooks files for the 5 dev script names on non-comment lines. FN3 writes a scratch file with a key read, confirms the scan catches it, and removes it in a finally block.

## Deviations from Plan

### Stated by the plan

- Providers sit in lib only as pure shapes; the transport is plan 05 (dev-time script). No change from the plan text.

### Execution choices

**1. [Task order] V7 uses stub providers in the Task 1 commit.** V7 needs a provider, and the real providers land in Task 2. Task 1 passes `opts.providers` (a stub map) to test the ask path; Task 2 adds P5 over the real providers. The default code path is unchanged.

**2. [TDD] RED was proven for Task 1 only.** `node tests/test-399-adapter.cjs` failed with module-not-found before any code existed. For Task 2 the provider modules were written before the P legs, so no RED run exists for P1-P5. All 35 legs pass now.

**3. [Wording of V2] Lookalike command names give `unknown_command`, not `free_text_outside_label_set`.** The plan lists both. A lookalike in a command slot (subject, last_command, options) is outside the registry, so V3 applies. A lookalike in a text slot (job_summary, definition_level, a gloss) gives `free_text_outside_label_set`. The tests pin both.

**4. [Plan statement not matched] build-connector-registry --check** exits 0 with no GAP lines in this tree (as in 399-02 and 399-03).

No auto-fixes (Rules 1 to 3) were needed.

## Verification

- `node tests/test-399-adapter.cjs`: 35 passed, 0 failed.
- `node tests/test-399-advisor-fence.cjs`: 9 passed, 0 failed.
- `bash tests/run-all-399.sh`: 6 tests, all PASSED.
- `grep -cE "require\(['\"]node:(http|https|net|tls)['\"]\)|\bfetch\(" ...adapter.cjs ...labels-only.cjs`: 0 and 0.
- `grep -rc 'api.typesafe.ai' lib/core/decision-advisor/ | grep -v ':0' | wc -l`: 0.
- Base exit codes before and after: test-353-tripwires 0 and 0, test-355-part8-egress 0 and 0, test-356-tripwires 0 and 0, test-359-devonly-tripwire 0 and 0.
- `node scripts/build-connector-registry.cjs --check`: exit 0.
- No em or en dashes in the new files.
- Pre-commit hooks ran on both commits and passed.

## Risks and open items

- The Gemini REST path and REST JSON field casing are ASSUMED, not confirmed. PATH stays null and PATH_CONFIRMED false. Plan 05 must confirm both from vendor documentation or keep the live send refused. The gemini fixture is marked "REST JSON casing ASSUMED".
- Parsers accept score probability keys as level index ("0", "1", "2") or level label. The Gemini score probability key form is unverified.
- Gemini output token count is not read (reported as 0) because the recorded runs expose only total_input_tokens.
- The fence regex for `process.env` and requires is textual. A dynamic require built from a variable would pass; the plan did not ask for more.
- The MINDRIAN_DECISION_ADVISOR env prefix is allowed by FN1 now but no code reads it yet (plan 06).

## Known Stubs

None. The Task 1 test stubs are test-only.

## Threat Flags

None. The folder adds no endpoint, auth path or file access; the closed validator and the fence reduce egress surface.

## Self-Check: PASSED

- Files found: all 9 created files and tests/run-all-399.sh.
- Commits found: aa4019e62, 72ace20b1.
