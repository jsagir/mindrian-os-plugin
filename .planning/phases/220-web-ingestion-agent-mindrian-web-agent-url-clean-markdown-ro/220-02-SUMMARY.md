---
phase: 220-web-ingestion-agent-mindrian-web-agent-url-clean-markdown-ro
plan: 02
subsystem: url-ingest
tags: [req-1, req-4, req-5, ingest-pipeline, d-03-sidecar, d-04-supersedes, d-08-cache-purity, d-10-manual-fence, d-11-nesting, d-19-envelope, content-hash-idempotency, adversarial-fixtures, offline-tests]

# Dependency graph
requires:
  - phase: 220-01
    provides: adapterTavilyExtract behind fetchCorpus({source:'tavily-extract'}) + the typed legacy extract envelope + run-all-220.sh file-gated harness slots
  - phase: 219-02
    provides: runExtraction opts.paths scoped-incremental seam + MINDRIAN_FORCE_FTS_ABSENT probe seam + buildFixtureRoom
  - phase: 219-05
    provides: research-filing.cjs (fileResearchArtifact / runPostFilingExtraction) + the D-19 research_mode substrate on source-lens-driver.cjs
  - phase: 131-01
    provides: SUPERSEDES + DERIVED_FROM in the closed ALLOWED_EDGE_TYPES vocabulary (edges.cjs)
provides:
  - "ingestUrl(roomDir, url, opts) in lib/core/url-ingest.cjs: URL -> D-03 sidecar-filed, D-11-nested, graph-visible artifact with scoped extraction, content-hash idempotency + SUPERSEDES versioning, and the D-19 envelope on every return (Plans 03/04/05 consume verbatim)"
  - "outcome enum {filed, no_op, superseded, provider_unavailable, size_exceeded, blocked, error}; ok:true ONLY for the first three (a failed fetch is never ok:true+empty)"
  - "D-03 sidecar frontmatter on every filed artifact: artifact_id, kind research-source, title, source_type (URL-metadata derivation, never adapter name), original_url, captured_at, content_sha256, content_format, normalization_version, access_basis, review_status proposed, engine_mode, ingest_origin, derived_from"
  - "D-11 nesting: research/<dated-slug>/<dated-slug>.md + <dated-slug>.raw.md (verbatim, immutable) inside the same artifact folder; filing through fileResearchArtifact only"
  - "ledger side-channel <roomDir>/.mindrian/url-ingest-ledger.json (schema_version 1; SENS dedup + crawl change-detection consumer; atomic write-temp-rename; rebuilt from room.db ground truth when lost)"
  - "MAX_INGEST_BYTES (1_500_000) const + LEDGER_RELPATH export"
  - "research-filing.cjs ADDITIVE params.slug override + params.frontmatterExtra scalar passthrough (existing callers byte-unaffected)"
affects: [220-03 url sensor, 220-04 crawl loop, 220-05 verification, 221 joint release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "opts._fetchCorpus injectable test seam (the source-lens-driver precedent) so every ingest test is hermetic and zero-network"
    - "typed-honesty envelope on EVERY return rung: outcome + research_mode + providers bag; ok:true never coexists with an empty result"
    - "ground-truth-over-fast-path dedup: room.db memory_artifact rows + filed frontmatter (original_url + content_sha256) are authoritative; the ledger is rebuilt on the way through"
    - "symlink refusal BEFORE collision suffixing: a planted symlink at the target folder returns typed 'error', never sidesteps to a -2 suffix"

key-files:
  created:
    - lib/core/url-ingest.cjs
    - tests/test-220-ingest-e2e.cjs
    - tests/test-220-idempotency.cjs
    - tests/test-220-ingest-safety.cjs
  modified:
    - lib/core/eureka/research-filing.cjs
    - lib/core/opportunity-ops.cjs
    - .planning/phases/220-web-ingestion-agent-mindrian-web-agent-url-clean-markdown-ro/deferred-items.md

key-decisions:
  - "ok:true maps ONLY to {filed, no_op, superseded}; every refusal (provider_unavailable, size_exceeded, blocked, error) is ok:false with a typed reason"
  - "non-ok fetch statuses collapse to outcome 'provider_unavailable' EXCEPT size_exceeded (its own typed refusal); the providers bag preserves the true adapter status either way"
  - "supplied content with no contentSource defaults to 'webfetch' (rung 2); contentSource 'tavily-extract' + supplied content composes research_mode 'normal' (rung-1 bytes, surface pre-fetched)"
  - "slug stem base-caps at 60 so the same-day -N collision suffix stays inside the 64 whitelist cap; empty-fallback 'web-ingest'"
  - "D-04 ground truth reads the FILED frontmatter (original_url + content_sha256) off room.db artifact rows instead of node props: writeMemoryArtifactNode has a CLOSED props contract (section/kind/path/hash/anchors) that this plan does not extend"
  - "extraction failure after a successful filing degrades to envelope.extraction.ok:false -- the filed artifact stands, never rolled back (degrade-never-throw)"

requirements-completed: [REQ-1, REQ-4, REQ-5]

# Metrics
duration: 40min
completed: 2026-07-13
---

# Phase 220 Plan 02: URL Ingestion Pipeline (ingestUrl) Summary

**The REQ-1 spine ships: ingestUrl(roomDir, url, opts) turns any URL into a D-03 sidecar-filed, D-11-nested, graph-visible research artifact through the 219 filing/extraction seams, with content-hash idempotency + append-only SUPERSEDES versioning (D-04), the D-19 provider-status envelope on every rung, a code-enforced D-10 cadence-manual fence, and adversarially-pinned inbound safety (injection-inert, oversize-refused, path-contained, cache-pure)**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-13T04:58:29Z
- **Completed:** 2026-07-13T05:38:00Z (approx)
- **Tasks:** 3/3
- **Files:** 7 (4 created, 3 modified)

## Verify-Landed Precondition Gate (Task 1, PASSED)

All three 219-owned seams verified landed before any code was written (consume, never re-implement):

- (a) `grep -n "opts.paths" scripts/entity-extract.cjs` -> lines 45/47 (contract doc), 329/331 (`collectArtifacts(db, roomDir, options.paths)`): the 219-02 scoped signature is live
- (b) `node -e "require('./lib/core/eureka/research-filing.cjs')"` -> `fileResearchArtifact` + `runPostFilingExtraction` both exported: the 219-05 filing surface is live
- (c) `grep -n "research_mode" lib/lens-engine/source-lens-driver.cjs` -> lines 36/41/95/486/495 incl. `composeResearchMode(providers)`: the 219-05 D-19 substrate is live

## Task Commits

1. **Task 1 RED** - `02ae297e` (test): failing ingestUrl e2e contract suite (5 behavior groups + 4 source gates)
2. **Task 1 GREEN** - `0384ecb2` (feat): the pipeline core + research-filing additive params + parseFrontmatter fix; 18/18
3. **Task 2 RED** - `9cee8e34` (test): failing idempotency + SUPERSEDES suite (4 behavior groups)
4. **Task 2 GREEN** - `99f7f4e3` (feat): D-04 branches wired onto resolvePriorArtifact; 9/9 + e2e still 18/18
5. **Task 3** - `0a7e63da` (test): REQ-5 adversarial fixtures + D-08 cache purity guard; 10/10

## What Shipped

### Task 1 - the ingestUrl pipeline core
- `lib/core/url-ingest.cjs` (flat lib/core home per the plan's module-home resolution): validate http(s) URL -> D-10 fence -> acquire content (opts.content or `(opts._fetchCorpus || fetchCorpus)({source:'tavily-extract', query:url})`, the Plan 01 legacy envelope consumed verbatim) -> D-02 byte bound (MAX_INGEST_BYTES 1_500_000, typed `size_exceeded`) -> sha256 -> path-safe dated slug ([a-z0-9-] whitelist, 60-cap stem, containment assertion, symlink refusal) -> D-03 sidecar filing THROUGH `fileResearchArtifact` -> raw capture (`<slug>.raw.md`, verbatim bytes, the ONE permitted direct write, atomic tmp+rename) -> `runPostFilingExtraction` scoped to exactly the new artifact path -> atomic ledger -> envelope. Inbound content is DATA end to end (never eval'd, never prompt-spliced, stored verbatim); titles are control-char-flattened and length-capped before touching frontmatter or slugs. Zero requires of research-cache (D-08), insight-sensors, or any lib/hmi module.
- engine_mode stamping: `llm_manual` -> `llm_manual_baseline` frontmatter + `providers.llm_manual: used`; all other paths `engine`. `origin 'cadence' + contentSource 'llm_manual'` -> typed `blocked` BEFORE anything fetches or files (D-10 hard fence, code-enforced + test-pinned).
- research_mode mapping documented in the module header: rung-1 success -> `normal`; webfetch/llm_manual supplied content -> `web_degraded_local_fallback`; nothing produced content -> `insufficient_evidence` with outcome `provider_unavailable`.

### Task 2 - idempotency + SUPERSEDES + ledger
- `resolvePriorArtifact`: room.db memory_artifact scan (read-only SELECT) + filed-frontmatter match on `original_url`, newest by `captured_at`; same `content_sha256` -> typed `no_op` (no re-file, no re-extract, ledger timestamp refresh); changed sha -> NEW version (same-day `-2` suffix slug rule) + exactly one `SUPERSEDES` edge new -> prior via `navigation.writeEdge` with `{reason:'content_change', prior_sha256, new_sha256}` (edges.cjs:154 vocabulary, zero extension) + outcome `superseded` with `artifact.superseded_node_id` set. History append-only: prior file bytes sha-asserted untouched, prior node intact.
- Ledger contract test-pinned: schema walk, atomic (no .tmp residue), points at the NEWEST node, and rebuilt from room.db ground truth when deleted (test G4).

### Task 3 - REQ-5 inbound half + D-08 guard
- `tests/test-220-ingest-safety.cjs`: (1) injection-as-data -- ignore-previous text, fake tool-call JSON block, embedded `<system>` tag all file INERT and byte-verbatim (sha equality), `review_status: proposed`; comment-filtered greps prove zero eval/new Function/child_process/template-splice of content; (2) oversize -> `size_exceeded`, zero files, zero nodes; (3) path-escape -- `../../etc/passwd`, `a/b\c`, 300-char unicode, empty title all land inside `research/` with `^[a-z0-9-]{1,64}$` stems (containment asserted via path.resolve); a planted symlink at the exact predicted target folder is refused typed `error` with zero write-through; (4) D-08 dual-marker scan -- planted room prose + planted web body both absent from `.mindrian/research-cache` after a full ingest, plus the structural zero-require gate. No harness edits needed (the Plan 01 file-gated slots carried all three legs).

## Test Evidence

- `node tests/test-220-ingest-e2e.cjs`: **18/18 PASS** (incl. the MINDRIAN_FORCE_FTS_ABSENT degrade leg and the D-03 full-key frontmatter round-trip through the room's parser)
- `node tests/test-220-idempotency.cjs`: **9/9 PASS**
- `node tests/test-220-ingest-safety.cjs`: **10/10 PASS**
- `bash tests/run-all-220.sh`: all five 220 legs **PASS** (Plan 01's two + this plan's three, SKIP -> PASS flip confirmed), both constitutional gates PASS, **219 no-regression PASS (11/11)**, **218 no-regression PASS (13/13)**; the single FAIL is the chained 216 harness on two PRE-EXISTING legs (deferred items 2 + 4 -- the --strict shape gate and the 219-owned help-coverage gap; neither 220-owned)
- `bash tests/run-all-219.sh` standalone: **PASS=11 FAIL=0 SKIP=0** (all landed 219 legs green post-extension of research-filing.cjs)
- `node scripts/doctor.cjs --acceptance`: **14/15** -- the single FAIL (`verify-release-clean-tree`) is tracked-file drift owned by concurrent sibling sessions (221 executor + eureka session), zero overlap with this diff (same situation 219-05 recorded)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] parseFrontmatter could not parse the spec-locked `content_sha256` key**
- **Found during:** Task 1 (acceptance requires D-03 keys to round-trip through the room's frontmatter parser)
- **Issue:** `lib/core/opportunity-ops.cjs parseFrontmatter` key regexes used `[a-z_]+` -- any digit-bearing key (the D-03 external-review-pinned `content_sha256`) was silently dropped
- **Fix:** all three key regexes broadened to `[a-z_][a-z0-9_]*` (top-level, nested list item, nested field). Strictly additive parse widening: every previously-parsed key parses identically; previously-ignored digit-bearing keys now parse
- **Files modified:** lib/core/opportunity-ops.cjs
- **Verification:** e2e G1c green; 219 suites (explore-chain 16/16, research-contract 8/8, full run-all-219 11/11) green
- **Commit:** 0384ecb2

**2. [Plan-anticipated additive seam] research-filing.cjs params.slug + params.frontmatterExtra**
- **Found during:** Task 1 (the plan's verify-first clause: "only if its landed contract lacks one")
- **Issue:** the landed `fileResearchArtifact` derives its slug from topicHandles and carries no extra-key passthrough -- it cannot carry the D-03 sidecar keys nor the caller-owned collision-suffixed slug
- **Fix:** ADDITIVE `params.slug` (validated `^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,64}$` override, fallback = shipped derivation) + `params.frontmatterExtra` (scalar-only keys, shipped-key collision guard, control chars in string values flattened -- the frontmatter-injection fence). Existing callers byte-unaffected (219 suites re-green)
- **Files modified:** lib/core/eureka/research-filing.cjs
- **Commit:** 0384ecb2

**3. [Rule 3 - plan-vs-reality] D-04 ground truth reads filed frontmatter, not node props**
- **Found during:** Task 2 design
- **Issue:** the plan wording assumed "the newest memory_artifact node whose original_url property matches", but `writeMemoryArtifactNode` enforces a CLOSED props contract (section/kind/path/hash/anchors) -- `original_url` never lands on the node, and extending navigation's closed contract is not this plan's to do
- **Fix:** `resolvePriorArtifact` scans room.db memory_artifact rows (read-only SELECT, the entity-extract db-handle discipline) and matches `original_url` + `content_sha256` from each artifact's FILED frontmatter. Intent fully preserved: room.db + on-disk artifacts are the ground truth, the ledger is a fast path (test G4 pins ledger-loss recovery)
- **Files modified:** lib/core/url-ingest.cjs
- **Commit:** 99f7f4e3

**4. [Rule 1 - test bug] e2e G1g scoped-extraction assertion snapshot-diffed**
- **Found during:** Task 1 GREEN
- **Issue:** the RED test asserted ALL DESCRIBES edges target the new artifact, but buildFixtureRoom pre-seeds DESCRIBES edges (entity -> hub)
- **Fix:** the assertion now diffs against a pre-ingest (source,target) snapshot: every NEW DESCRIBES edge must target the new artifact only -- the same scoped-extraction proof, correctly baselined
- **Files modified:** tests/test-220-ingest-e2e.cjs
- **Commit:** 0384ecb2

### Process Incidents (recovered, zero loss)

**5. Write-tool control bytes in two regex character classes**
- Two edits (the research-filing frontmatterExtra sanitizer and url-ingest sanitizeTitle) embedded literal control bytes (U+0000/U+001F) inside `[...-...]` classes, turning both files binary per `file(1)`. Root cause: raw control characters in the tool payload instead of `\u` escapes. Fixed via byte-safe node rewrite scripts to `/[ -]+/g`; both files verified `JavaScript source, ASCII text` before commit.

**6. Task 3 commit initially swept 4 concurrent-session staged files (shared index)**
- A sibling session staged files between my `git add` and `git commit`; commit `54df0367` picked up `.planning/debug/219-live-checkpoint-two-structural-gaps.md`, `lib/core/eureka/opportunity-harvest.cjs`, `tests/helpers/fixture-room-219.cjs`, `tests/test-219-harvest-sensor.cjs`. Recovered immediately and non-destructively: `git reset --soft HEAD~1` + `git commit --only <my two paths>` -> `0a7e63da` carries exactly my files; the sibling's four files were restored to the staged index byte-identical. No history rewrite of anything published, no foreign content lost.

---

**Total deviations:** 4 auto-fixed (1 shared-parser Rule 3, 1 plan-authorized additive seam, 1 plan-vs-reality ground-truth path, 1 test-baseline fix) + 2 process incidents (both fully recovered)
**Impact on plan:** none of the four changes alter the interfaces contract; Plans 03/04/05 consume the envelope exactly as specified.

## Threat Register Compliance (plan threat model)

- T-220-06 (injection as instructions): mitigated -- byte-verbatim filing, review_status proposed, zero eval/exec/prompt-splice (grep-gated + behavioral fixture)
- T-220-07 (path traversal / symlink escape): mitigated -- whitelist slug + containment assertion + lstat symlink refusal before any write; filing through existing ops only
- T-220-08 (oversize DoS): mitigated -- MAX_INGEST_BYTES typed refusal; adapter transport already caps at 5MB
- T-220-09 (cache leakage): mitigated -- zero research-cache require (structural) + dual-marker behavioral scan
- T-220-10 (failed fetch masquerading as success): mitigated -- typed outcome + research_mode on every rung; ok:true never with empty results
- T-220-11 (history overwrite on re-ingest): mitigated -- content-hash no_op + append-only SUPERSEDES; prior bytes sha-asserted untouched
- T-220-12 (manual rung entering cadence): mitigated -- typed `blocked` code fence + engine_mode/providers stamping
- T-220-SC (package installs): zero installs (package.json untouched)

## Known Stubs

None. Every rung of the pipeline is live and test-consumed: fetch (stubbed only in tests via the sanctioned `_fetchCorpus` seam; the product path rides the shipped fetchCorpus chokepoint), filing, raw capture, extraction, versioning, and ledger all execute end-to-end in the suites. `source_published_at` is deliberately omitted in v1 (the Plan 01 envelope carries no publish-date field) -- documented in the module, not a stub.

## Threat Flags

None -- no new security surface beyond the plan's modeled trust boundaries (untrusted web bytes -> room fs/db, ingest -> public cache, ledger -> sensor/crawl consumers), each with its register mitigation implemented and test-pinned.

## Next Plan Readiness

- Plan 03 (URL sensor + /mos:research URL mode) consumes `ingestUrl` + `LEDGER_RELPATH` for SENS dedup; the envelope contract is frozen as specified
- Plan 04 (crawl loop) consumes the ledger's `content_sha256` for change detection and the `origin: 'cadence'` provenance stamp; the D-10 fence is already code-enforced for it
- Deferred items 2 (pre-220 --strict shape declarations) and 4 (help-groups.json missing the 219 surfaces) remain for their owners; both cascade only into the 216 chained regression leg

---
*Phase: 220-web-ingestion-agent-mindrian-web-agent-url-clean-markdown-ro*
*Completed: 2026-07-13*

## Self-Check: PASSED

All 7 claimed files verified on disk; all 5 plan commits (02ae297e, 0384ecb2, 9cee8e34, 99f7f4e3, 0a7e63da) verified in git log; zero file deletions across the plan's commit range; final runs green (e2e 18/18, idempotency 9/9, safety 10/10, run-all-219 11/11).
