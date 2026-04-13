---
phase: "80"
plan: "06"
subsystem: vault-import
tags: [import, branding, frontmatter, callouts, smoke-test, usability-check]
tech_stack:
  added: []
  patterns: [cjs, node-assert, gray-matter, child_process-execFileSync, idempotent-writes]
key_files:
  created:
    - lib/import/branding.cjs
    - lib/import/branding.test.cjs
    - lib/import/smoke-test.cjs
    - lib/import/smoke-test.test.cjs
  modified:
    - lib/import/enricher.cjs
    - lib/import/integration.test.cjs
    - scripts/vault-import.cjs
requirements:
  - IMPORT-10
  - IMPORT-11
decisions:
  - "Phase 76 scripts/vault-footer-injector.cjs exports reusable functions (buildFooter, hasExistingFooter, appendFooter, processFile) but its per-room CLI API does not accept per-import context. Plan 80-06 reimplements the thin per-file footer pathway and reuses the same FOOTER_MARKER string ('> MindrianOS |') so the two idempotency checks are mutually compatible."
  - "De Stijl callout syntax is Obsidian-style '> [!author]' / '> [!attendees]' / '> [!date]' / '> [!tags]' with a '<!-- destijl-callout -->' marker comment for idempotency. The marker is detected by scripts/generate-hub.cjs .callout / .callout-blue / .callout-teal / .callout-red CSS classes during hub rendering."
  - "FOOTER_BRAND uses '[MOS]' bracket token instead of the box-glyph used by Phase 76 so the source file stays plain ASCII and is trivially greppable."
  - "Smoke test first run against tiny-vault used the compute-state fallback (method=compute-state) because bin/mindrian-tools.cjs is still blocked by the lazygraph-ops better-sqlite3 issue per PRECONDITIONS.md. The fallback produced passed=true with 4 populated canonical sections on tiny-vault."
metrics:
  completed: "2026-04-13"
  duration: "~25 min"
  tasks: 2
  files_created: 4
  files_modified: 3
  tests_added: 14
---

# Phase 80 Plan 06: Branding + Post-Import Smoke Test Summary

## Objective

Ship the Wave 3 branding + post-import smoke test for the Obsidian-to-data-room pipeline. Every routed artifact gets a MindrianOS branded footer, De Stijl canonical frontmatter, and Obsidian-style callout blocks promoted from known source fields (IMPORT-10). After Stage 04 enrich completes, scripts/vault-import.cjs runs a deterministic /mos: usability smoke test (runMosSmokeTest) and writes results into IMPORT-REPORT.md under ## /mos: Usability Check (IMPORT-11).

## What Was Built

### Task 1 -- IMPORT-10 branding injection

**lib/import/branding.cjs** -- exports injectBrandedFooter, normalizeFrontmatter, promoteCalloutFields, and applyBranding (the orchestrator wrapper). Each function is fully idempotent on a second run.

- `injectBrandedFooter(artifactPath, importContext)` -- appends a footer `> [MOS] MindrianOS | imported <iso> | from <vault> | import_id: <id>` after a horizontal rule. Uses FOOTER_MARKER `> MindrianOS |` (identical to scripts/vault-footer-injector.cjs from Phase 76) so the two paths are mutually idempotent.
- `normalizeFrontmatter(artifactPath, classification, importContext)` -- rewrites frontmatter to the canonical De Stijl shape: `title, section, status: imported, imported_from, imported_at, import_id, source_wikilinks, tags`. All non-canonical source fields (author, custom_field, etc.) are moved under `_source_frontmatter` and survive re-runs via a previously-preserved merge.
- `promoteCalloutFields(artifactPath)` -- reads `_source_frontmatter.{author,attendees,date,tags}` and prepends Obsidian-style callout blocks `> [!author] Jane Doe` / `> [!attendees] A, B` / `> [!date] 2026-01-15` / `> [!tags] a, b` after a `<!-- destijl-callout -->` marker comment. Dates parsed by gray-matter as Date objects are formatted as YYYY-MM-DD. Idempotent via marker detection.
- `applyBranding(artifactPath, classification, importContext)` -- wraps the three functions in the documented order (normalize -> promote -> footer) so all writes happen to an artifact whose frontmatter is already canonical.

**lib/import/enricher.cjs** -- hooked applyBranding into `enrichRoom` as step 7 (the LAST per-artifact write, after wikilink injection). Wrapped in try/catch so a single-file branding failure pushes a `branding_failed` warning onto manifest.warnings instead of aborting the enrich stage. `stats.branded` is tracked and flushed to `manifest.stage_states.enrich.branded`.

**lib/import/branding.test.cjs** -- 6 tests, all green:
1. injectBrandedFooter appends + is idempotent
2. normalizeFrontmatter enforces canonical shape (custom fields preserved)
3. promoteCalloutFields produces callout blocks + is idempotent
4. applyBranding second run is byte-identical to first
5. enrichRoom hook end-to-end (real enricher + real filesystem)
6. No em-dashes in branding.cjs or branding.test.cjs

### Task 2 -- IMPORT-11 /mos: usability smoke test

**lib/import/smoke-test.cjs** -- exports `runMosSmokeTest(roomPath, importContext)` which returns `{ passed, sectionCounts, warnings, method }`. Never throws.

- Preferred path: `node bin/mindrian-tools.cjs room state` (only attempted if PRECONDITIONS.md does NOT flag `lazygraph-ops still broken` AND `forceFallback` is not set)
- Fallback path: `bash scripts/compute-state <roomPath>` -- parses the `## Sections` markdown table for `| section | entries |` rows
- Filesystem walk: `team/` count is computed directly from disk (not via compute-state) so team-only rooms are detectable
- Pass criterion: at least one canonical section from `[problem-definition, solution-design, business-model, market-analysis, competitive-analysis, financial-model, legal-ip, team-execution]` has a count > 0. Team-only rooms pass with a warning.

**scripts/vault-import.cjs** -- wired smoke test between Stage 04 enrich and the final IMPORT-REPORT.md write. Result is:
1. Stored on `manifest.smoke_test` and flushed to MANIFEST.json
2. Injected into the report via a new `smokeTestResult` option to `writeImportReport`, which replaces the Plan 80-05 `## /mos: Usability Check` placeholder with the full rendered section (method, passed, populated sections, section counts, warnings)
3. Loud stderr warning when `passed=false` but no auto-rollback (user decides)

**lib/import/integration.test.cjs** -- added Test 7: runs full vault-import on tiny-vault, reads IMPORT-REPORT.md, asserts:
- `## /mos: Usability Check` heading present
- Placeholder text from 80-05 is GONE
- `method:` and `passed:` lines present
- At least one problem-definition artifact has both `MindrianOS` footer AND `status: imported` frontmatter (end-to-end branding proof)

**lib/import/smoke-test.test.cjs** -- 7 tests, all green:
1. Happy path (populated problem-definition passes)
2. Empty room returns passed=false + warning
3. Team count via filesystem walk
4. forceFallback reaches compute-state
5. renderSmokeTestSection emits required heading
6. parseSectionCounts handles compute-state table fragment
7. No em-dashes

## Requirements Fulfilled

| Requirement | Status | Evidence |
|-------------|--------|----------|
| IMPORT-10 | Complete | lib/import/branding.cjs + enricher hook + 6 unit tests + integration Test 7 proves end-to-end footer + canonical frontmatter on real artifact |
| IMPORT-11 | Complete | lib/import/smoke-test.cjs + vault-import wiring + 7 unit tests + integration Test 7 proves /mos: Usability Check section populated in report |

## Verification

- `node lib/import/branding.test.cjs` -> 6/6 pass
- `node lib/import/smoke-test.test.cjs` -> 7/7 pass
- `node lib/import/integration.test.cjs` -> 7/7 pass (including new Test 7)
- `node lib/import/run-all-tests.cjs` -> **12/12 test files pass**
- End-to-end: `node scripts/vault-import.cjs --path lib/import/test-fixtures/tiny-vault --room $TMP --yes`
  - Report contains populated `## /mos: Usability Check` section with `method: compute-state`, `passed: true`, 4 populated canonical sections (business-model, inbox, problem-definition, team=6)
  - problem-definition/onboarding-pain/onboarding-pain.md has canonical frontmatter (`status: imported`, `imported_from: notes/onboarding.md`, `import_id`), `<!-- destijl-callout -->` marker with `> [!tags] activation, dror` callout, and MindrianOS footer at file tail
- Zero em-dashes in all new/modified files verified via `! grep -P "\xe2\x80\x94"`

## Deviations from Plan

**None.** The plan was followed exactly as written. Two minor implementation adjustments that stayed within spec:

1. `formatCalloutValue` was extended to handle gray-matter's automatic Date object parsing (`date: 2026-01-15` parses to a Date). Dates are formatted as `YYYY-MM-DD` via `toISOString().slice(0, 10)`. This is a correctness fix, not a deviation -- the plan's test expected `> [!date] 2026-01-15` which would have failed with a raw Date.toString().
2. Footer placement uses `> [MOS] MindrianOS |` (bracket token) instead of the box glyph Phase 76 uses in its FOOTER_BRAND constant. This is intentional and documented in the module header: plain ASCII footer is greppable across platforms while still matching the `FOOTER_MARKER` regex that both modules share.

## Commits

- `7aad0eb` feat(80-06): branding injection for imported artifacts (IMPORT-10)
- `4ab08c9` feat(80-06): post-import /mos: usability smoke test (IMPORT-11)

## Self-Check: PASSED

- lib/import/branding.cjs: FOUND (201 lines)
- lib/import/branding.test.cjs: FOUND (6/6 green)
- lib/import/smoke-test.cjs: FOUND (197 lines)
- lib/import/smoke-test.test.cjs: FOUND (7/7 green)
- lib/import/enricher.cjs: MODIFIED (branding hook wired, stats.branded tracked)
- lib/import/integration.test.cjs: MODIFIED (Test 7 added, 7/7 green)
- scripts/vault-import.cjs: MODIFIED (smoke test wired between enrich and report)
- Commit 7aad0eb: FOUND
- Commit 4ab08c9: FOUND
- 12/12 test files pass
- End-to-end vault-import on tiny-vault produces populated /mos: Usability Check + canonical branded artifacts
- Zero em-dashes in all touched files
- IMPORT-10 + IMPORT-11 both addressed
