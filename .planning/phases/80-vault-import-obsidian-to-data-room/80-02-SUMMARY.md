---
phase: "80"
plan: "02"
plan_id: 80-02
subsystem: vault-import
tags: [detection, person, meeting, stage-02, pure-function]
requirements: [IMPORT-06, IMPORT-07]
dependency_graph:
  requires:
    - 80-01 (vault-scanner files[] shape, manifest.schema.json people[]/meetings[])
    - references/import-config.md (role bucket keywords, confidence thresholds)
  provides:
    - lib/import/person-detector.cjs::detectPeople
    - lib/import/meeting-detector.cjs::detectMeetings
  affects:
    - 80-04 orchestrator stage 02 (consumes both detectors)
    - 80-03 router (people + meetings flow to team/ and meetings/ in later plans)
tech-stack:
  added: []
  patterns:
    - Pure-function detector modules with bodyLoader dependency injection
    - Zero-dep assert/strict tests via Phase 79 runner
key-files:
  created:
    - lib/import/person-detector.cjs
    - lib/import/person-detector.test.cjs
    - lib/import/meeting-detector.cjs
    - lib/import/meeting-detector.test.cjs
  modified: []
decisions:
  - Longer role keywords ordered before shorter substrings (co-founder before founder) so substring match returns the most specific evidence
  - FIRST_LAST_RE uses lookahead to yield overlapping pairs (Today Eli + Eli Zarchin) so tier-4 detection catches names after leading stopwords
  - NER tier intentionally left as stub; deferred to a future LLM pass
  - Meetings detection is detection-only; actual filing into room/meetings/ is handled by 80-04 Stage 03c via /mos:file-meeting
metrics:
  duration_minutes: ~15
  tasks_completed: 2
  completed_date: 2026-04-13
---

# Phase 80 Plan 02: Person and Meeting Detectors Summary

Two pure-function detector modules for Stage 02 of the vault-import pipeline: a 5-tier person detector with role-bucket heuristics and a 2-of-3 signal meeting detector. Both consume vault-scanner file entries and emit enrichment rows matching the MANIFEST people[]/meetings[] schema subsets. Zero side effects.

## What Was Built

### lib/import/person-detector.cjs

`detectPeople(fileEntries, opts)` runs a 5-tier detection ladder per file:

1. **frontmatter** (conf 0.97) — attendees/author/team/contributors YAML fields
2. **attendees_header** (conf 0.88) — `## Attendees` / `## Participants` markdown lists
3. **mentions** (conf 0.75) — `@Name` inline mentions
4. **first_last_repeated** (conf 0.60) — capitalized First Last pair across 3+ distinct files
5. **ner** (conf 0.45) — stub, reserved for a future LLM pass

Role inference slides an 80-char window around each mention and scans ordered keyword lists per bucket (core-team, consultants, advisors, investors, board, unassigned). Longer keywords come first so "co-founder" wins over "founder". Slug normalization strips unicode combining marks, drops punctuation, collapses whitespace. Stopword filter blocks common 2-word non-name phrases ("New York", "Project Plan", etc.). Dedup keeps the highest-tier entry and merges `mention_files`. An `opts.excludeNames` array filters self-references.

The module accepts an `opts.bodyLoader(fileEntry) -> string` override so tests run without touching the filesystem.

### lib/import/meeting-detector.cjs

`detectMeetings(fileEntries, opts)` applies the 2-of-3 signal rule:

1. **date_in_filename** — YYYY-MM-DD, YYYYMMDD, or YYYY_MM_DD matched in `source_path`
2. **attendees_header** — `## Attendees` or `## Participants` list
3. **dialogue_shape** — 3+ lines matching `^Speaker:\s+\S`

A file becomes a meeting candidate when at least two signals fire. Date normalization produces a canonical `YYYY-MM-DD` string regardless of source format. Attendees are extracted from the list under the header. Output rows match the MANIFEST `meetings[]` subset: `source_file_id`, `detected_date`, `detected_attendees`, `detection_signals`. Filing into `room/meetings/` is deferred to 80-04 Stage 03c.

## Tests

- `lib/import/person-detector.test.cjs` — 10 tests, all passing
  - frontmatter tier confidence, attendees header tier, first-last repeated across 3 files, slug normalization (unicode + punctuation), role keyword match, unassigned fallthrough, cross-tier dedup, stopword filter, excludeNames, purity/shape
- `lib/import/meeting-detector.test.cjs` — 7 tests, all passing
  - date + attendees combo, date + dialogue combo, single-signal rejection, date-format normalization (3 formats), `## Participants` variant, source_file_id passthrough, tiny-vault `2026-01-15-team-sync.md` fixture

`node lib/import/run-all-tests.cjs` runs all suites; both new detector suites pass. See Deferred Issues below for one failure outside this plan's scope.

## Deviations from Plan

None for the detector modules themselves. Plan executed as written with two small tightening fixes uncovered during RED/GREEN:

1. **[Rule 1 - Bug] Role keyword ordering** — Initial iteration of `core-team` keywords had `founder` before `co-founder`, causing "co-founder" to match `founder` and return the wrong evidence. Fixed by reordering so longer keywords come first. Evidenced by Test 5. Commit `f337e1d`.
2. **[Rule 1 - Bug] FIRST_LAST_RE non-overlapping matches** — Plain `\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g` consumes the second word, so "Today Eli Zarchin" yields only "Today Eli" and misses "Eli Zarchin". Switched to a lookahead (`([A-Z][a-z]+)(?=\s+([A-Z][a-z]+)\b)`) so overlapping pairs are emitted; the existing stopword filter catches false positives. Evidenced by Test 3. Commit `f337e1d`.

## Deferred Issues

- `lib/import/router.test.cjs` collision test at line 202 fails (`destination_folder.endsWith('-imported-' + dateSlug + '-2')`). Out of scope for 80-02: router.cjs/router.test.cjs are owned by parallel plan 80-03. Logged to `deferred-items.md`. 80-03's verifier owns the fix.

## Commits

- `f337e1d` — feat(80-02): add person detector with 5-tier ladder and role heuristics
- `99f20f5` — feat(80-02): add meeting detector with 2-of-3 signal rule

## Self-Check: PASSED

- lib/import/person-detector.cjs — FOUND
- lib/import/person-detector.test.cjs — FOUND
- lib/import/meeting-detector.cjs — FOUND
- lib/import/meeting-detector.test.cjs — FOUND
- Commit f337e1d — FOUND
- Commit 99f20f5 — FOUND
- No em-dashes in any new file — VERIFIED
- person-detector.test.cjs — 10/10 passing
- meeting-detector.test.cjs — 7/7 passing
