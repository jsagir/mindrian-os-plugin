---
phase: 239-brain-access-surface
plan: 06
subsystem: security
tags: [canon-part-8, sendpacket, decision-record, adr-amendment, census-gate, brain-client]

# Dependency graph
requires:
  - phase: 239-05
    provides: "lib/core/brain-client.cjs: raw-field Part 8 egress guard in hatAwareRecommend()/suggestValidationSteps() (the live in-process coverage this plan's park note points to as the real control)"
provides:
  - "lib/core/brain-client.cjs: a dated PARKED note (Phase 239, BRAIN-03) above async function sendPacket(), naming the census fact, the ruling, the consequence, and the re-open condition"
  - "docs/architecture/SUBSTRATE-CONTRACT.md: the same ruling as a Phase 239-06 ADR amendment (decision record, not an export-list change)"
  - "tests/test-239-sendpacket-parked.cjs: the 6-leg machine-checked census (allowlist derived from scripts/check-schema-aliases.cjs, never hand-copied), including a live production-tree mutation proof transcribed below"
  - "lib/core/navigation/packet.cjs: H5 comment cross-referenced to the dated park note and the ADR amendment"
  - "tests/test-150-brain-egress.cjs: the false 'FIRST real sendPacket consumer' header claim corrected"
affects: [239-01-brain-tool-liveness, 239-05-query-egress-canary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decision-record-as-ADR-amendment: a functional (not structural) ruling recorded in the same Amendments section and shape as a real export addition, explicitly labelled 'not an export addition' so a reader does not mistake it for a contract change."
    - "Allowlist-derived census: the test's non-production-caller allowlist comes from require()-ing the existing D-08 layer-2 guard's own isAllowedSendpacketPath function, never a hand-copied regex array, so the census and the guard cannot silently drift apart."
    - "String-literal-aware line scanning: a census that pattern-matches source lines for a call-site token must first strip quoted string content and //-comments from each line, or a diagnostic message that legitimately mentions the token in prose (e.g. an assertion failure string) self-invalidates the gate."

key-files:
  created:
    - tests/test-239-sendpacket-parked.cjs
  modified:
    - lib/core/brain-client.cjs
    - lib/core/navigation/packet.cjs
    - docs/architecture/SUBSTRATE-CONTRACT.md
    - tests/test-150-brain-egress.cjs

key-decisions:
  - "RULING (RESEARCH.md assumption A3, a navigator-equivalent ruling made by this unattended run, in the Phase 238 precedent style, cheap to overturn if a navigator disagrees): sendPacket is PARKED, not wired. The census fact (zero production callers) is verified; the park-versus-wire choice is the judgment call, and it is recorded openly rather than left implicit."
  - "LEG 6's live mutation proof was performed BY HAND against a scratch mutation of lib/core/artifact-id.cjs (a file this phase does not otherwise touch) rather than baked into the test file's own execution, because the test process cannot safely mutate a tracked file that it is itself scanning mid-run without a separate before/after process boundary. This mirrors the 239-05 LEG 7 precedent (manual mutation + transcribed proof + an automated companion leg), except here the companion (LEG 6) is a documentation leg pointing at this SUMMARY rather than a structural regression assertion, because the thing being proven (does the REAL repo-root census see a REAL new caller) is exactly what the by-hand mutation already demonstrates end to end."
  - "The census's line-scanner strips string literals and //-comments from each source line BEFORE pattern-matching for sendPacket(, not just whole-comment lines. Without this, lib/core/mindrian-brain-shim.test.cjs's own assertion-failure strings ('...zero sendPacket( / buildBrainPacket calls...', '...sendPacket( bypass detected...') would have registered as false-positive call sites, since that file is not on the D-08 allowlist. Measured live during authoring (see Task 3 verification below); this is a corrected implementation detail, not a plan-text deviation, since the plan's stated exclusion order (definition line, comment lines, allowlisted paths) is a floor, not a ceiling, and a naive implementation of just that floor would have produced two false positives on this specific repo's existing test file."
  - "The SUBSTRATE-CONTRACT.md amendment lives in the ## Amendments section (following the buildBrainPacket-adjacent amendments' shape) rather than the M11 export allow-list itself, because sendPacket is a Brain-substrate function, not a room.db/navigation.cjs export the M11 list governs. The entry is explicitly labelled 'NOT an export addition' so a reader does not mistake a decision record for a contract change."

requirements-completed: [BRAIN-03]

# Metrics
duration: 50min
completed: 2026-07-30
---

# Phase 239 Plan 06: sendPacket Parked (BRAIN-03 Decision Record) Summary

**sendPacket's fate is decided explicitly and recorded as PARKED: a dated call-surface note plus a matching SUBSTRATE-CONTRACT.md ADR amendment plus a 6-leg machine-checked census (allowlist derived, never hand-copied) that goes red on the first real production caller, proven live with a hand-performed mutation against lib/core/artifact-id.cjs.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-07-30T12:10:00Z (approx, first file read)
- **Completed:** 2026-07-30T13:00:00Z
- **Tasks:** 3
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments

- `sendPacket` in `lib/core/brain-client.cjs` now carries a dated PARKED note (18 lines above the function, well within the 30-line proximity bound) naming: the census fact (zero production call sites across `lib/`, `scripts/`, `bin/`, `pipelines/`), the ruling (parked, not wired -- wiring it is net-new feature work forbidden in this remediation-only milestone), the consequence (the PB8-10 belt inside it is correct code on an unreached path, NOT live Part 8 coverage -- the live coverage is 239-05's raw-field guard), and the re-open condition (the D-08 layer-2 pre-commit guard plus this plan's own census).
- `docs/architecture/SUBSTRATE-CONTRACT.md` carries the same ruling as a Phase 239-06 amendment, explicitly labelled a decision record rather than an export-list change (the M11 export allow-list governs `room.db`/`navigation.cjs`, not Brain-substrate functions like `sendPacket`).
- The two contradictory in-repo claims are reconciled in the correct direction: `tests/test-150-brain-egress.cjs:12`'s false "Phase 150 is the FIRST real sendPacket consumer" is corrected to state the consumer was designed but never landed; `lib/core/navigation/packet.cjs:105`'s true "zero production consumers today" claim survives untouched and is now cross-referenced to the dated note and the ADR amendment.
- `tests/test-239-sendpacket-parked.cjs` (6 legs, 311 lines) proves the whole decision is machine-checked, not merely prose: a repo-wide census (LEG 1) with an anti-vacuity companion (LEG 2), park-note-presence assertions at both homes (LEG 3, LEG 4), the contradiction-reconciled assertion (LEG 5), and a documentation leg (LEG 6) pointing at this SUMMARY's transcribed live mutation proof.
- `bash tests/run-all-239.sh`'s BRAIN-03 leg flips from SKIPPED to PASSED.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the dated park note at the call surface and reconcile the two contradictory claims** - `e4233910` (feat)
2. **Task 2: Record the same decision as an ADR amendment in docs/architecture/SUBSTRATE-CONTRACT.md** - `30898df4` (docs)
3. **Task 3: Author tests/test-239-sendpacket-parked.cjs, the machine-checked census** - `4b2d1702` (test)

_No TDD tasks in this plan; all three are `type="auto"` per the plan frontmatter._

## Files Created/Modified

- `lib/core/brain-client.cjs` - Added an 18-line PARKED comment block immediately above `async function sendPacket(packet, opts)` (source line 1341 after this plan's edit; the file grew from 239-05's earlier additions). Comment-only change: zero function-body lines touched, `part8-egress-guard` occurrence count unchanged at 4 (matches 239-05-SUMMARY's baseline).
- `lib/core/navigation/packet.cjs` - Extended the existing H5 finding comment at line 102-108 with a 3-line cross-reference to the dated park note and the ADR amendment. Comment lines only, zero code change (confirmed via `git diff`, transcribed below).
- `docs/architecture/SUBSTRATE-CONTRACT.md` - Added a Phase 239-06 amendment entry to the `## Amendments` section (26 lines, insertion only, zero deletions), naming the export (`brain-client.sendPacket`), the phase (239), the requirement (BRAIN-03), the census fact, the ruling, the consequence, and the re-open condition, explicitly labelled "NOT an export addition."
- `tests/test-150-brain-egress.cjs` - Corrected the line-12 header claim: replaced the false "Phase 150 is the FIRST real sendPacket consumer" with a statement that the consumer was designed but never landed, per the Phase 239 BRAIN-03 census and ruling. Header comment only; zero assertions changed; the file still passes (`node tests/test-150-brain-egress.cjs` exit 0, matching its pre-task baseline exactly).
- `tests/test-239-sendpacket-parked.cjs` - New, 311 lines. 6 legs: LEG 1 (repo-wide census, allowlist derived from `scripts/check-schema-aliases.cjs::isAllowedSendpacketPath`), LEG 2 (anti-vacuity via a seeded temp tree), LEG 3 (park note at the call surface), LEG 4 (park note in docs), LEG 5 (contradiction reconciled in the right direction), LEG 6 (documentation leg pointing at this SUMMARY's transcribed live mutation proof).

## Task 1 Acceptance Transcripts

**PARKED proximity (`node -e` line-index check):**

```
PARKED line: 1323, sendPacket line: 1341, distance: 18
```

(An earlier, more verbose draft of the note measured at distance 37, failing the 30-line bound; it was compacted to the version below and re-measured at 18.)

**The park note, verbatim:**

```
// PARKED (2026-07-30, Phase 239, BRAIN-03): ZERO production sendPacket(
// consumers. Census across lib/, scripts/, bin/, pipelines/: the only
// definition is this one; non-definition references are this file's own
// export/comments, tests/test-brain-packet-validation-per-job.cjs, and the
// D-08 layer-2 guard (scripts/check-schema-aliases.cjs --check-sendpacket).
// This reconciles two prior contradictory claims: navigation/packet.cjs:105
// ("zero production consumers today") was TRUE; test-150-brain-egress.cjs:12
// ("FIRST real sendPacket consumer") was FALSE and is corrected in this
// change. RULING: PARKED, not wired -- wiring it to a real job is net-new
// feature work, forbidden inside this remediation-only milestone (RESEARCH.md
// A3, a navigator-equivalent ruling, cheap to overturn). CONSEQUENCE: the
// PB8-10 belt below (step 3.5) is correct code on an unreached path -- do NOT
// count it as live Part 8 coverage; the live in-process coverage is sibling
// plan 239-05's raw-field guard in hatAwareRecommend()/suggestValidationSteps().
// RE-OPEN CONDITION: the first real caller. Caught by the D-08 layer-2
// pre-commit guard (requires a preceding buildBrainPacket() call) and by
// tests/test-239-sendpacket-parked.cjs LEG 1's census. See also the matching
// ADR amendment in docs/architecture/SUBSTRATE-CONTRACT.md (Phase 239-06).
```

**`grep -c "FIRST real sendPacket consumer" tests/test-150-brain-egress.cjs`:** `0` (was 1 before this task).

**`node tests/test-150-brain-egress.cjs` before/after:** PASS, exit 0, both times (unchanged baseline; the corrected header comment does not touch any assertion).

**`git diff lib/core/navigation/packet.cjs` (comment lines only):**

```diff
--- a/lib/core/navigation/packet.cjs
+++ b/lib/core/navigation/packet.cjs
@@ -102,7 +102,10 @@ function loadOperator(roomDir, mocks) {
 // Review finding H5: shortText() previously returned raw node prose (summary/claim/title/
 // text) under EVERY privacy mode, including the default local_summary_only. That let user
 // prose cross the LOCAL->BRAIN boundary in the summary/explanation fields -- a latent Part 8
-// breach (dormant only because sendPacket has zero production consumers today).
+// breach (dormant only because sendPacket has zero production consumers today). This fact
+// is now the formal Phase 239 BRAIN-03 ruling: see the dated PARKED note above
+// lib/core/brain-client.cjs's sendPacket() and the matching ADR amendment in
+// docs/architecture/SUBSTRATE-CONTRACT.md (Phase 239-06, 2026-07-30).
```

**`git diff lib/core/brain-client.cjs` (comment lines only, `part8-egress-guard` count unchanged at 4):**

Confirmed: `grep -c "part8-egress-guard" lib/core/brain-client.cjs` returned `4` both before and after Task 1 (matches the value 239-05-SUMMARY.md recorded), and the full `git diff` for this task shows only inserted `//` comment lines with zero touched code lines (the sole hunk is the 18-line PARKED block inserted between the existing JSDoc and `async function sendPacket(`).

**`node tests/test-239-query-egress-canary.cjs`:** exit 0, all 7 legs PASS (239-05's work unregressed).

**`bash tests/run-all-196.sh`:** `Passed: 4  Failed: 1  Skipped: 0` -- the one FAIL is the known cross-plan gap (`tests/part8-egress-guard-hook.test.cjs`, PB8-04, owned by 239-04, filed at `.planning/debug/part8-egress-guard-hook-fixture-stale-after-239-02.md`), reproduced identically before and after this task's edits. Not this plan's scope.

**Em-dash check:** `grep -rlP '\x{2014}' lib/core/brain-client.cjs lib/core/navigation/packet.cjs tests/test-150-brain-egress.cjs` returned nothing.

## Task 2 Acceptance Transcripts

**Repo-wide confirmation before writing (per the plan's read_first instruction):** `grep -rln "sendPacket" docs/` returned nothing before this task (0 matches) -- confirming no doc anywhere recorded this fact, which is the reason `SUBSTRATE-CONTRACT.md` was chosen as the home. After this task: `grep -c "sendPacket" docs/architecture/SUBSTRATE-CONTRACT.md` returns `8`.

**The amendment block, verbatim:**

```markdown
- **Phase 239-06 (2026-07-30, BRAIN-03 decision record, NOT an export
  addition).** `brain-client.sendPacket` is the SOLE typed-packet wire path
  into the Brain (the M11 export list above governs `room.db`, the local
  substrate; `sendPacket` is a Brain-substrate function and is not itself an
  M11 export, so this entry records a decision, not a contract change --
  `sendPacket` is not being added to or removed from any surface). As of this
  date it has ZERO production consumers: a full census across `lib/`,
  `scripts/`, `bin/` and `pipelines/` found no production `sendPacket(` call
  site. In place of a consumer, the recorded decision is explicit: `sendPacket`
  is PARKED rather than wired, because wiring it to a real production job is
  net-new feature work, out of scope for Phase 239's remediation-only
  milestone. Consequence: the PB8-10 classifier belt inside `sendPacket`
  (`lib/core/brain-client.cjs`) is correct code sitting on a path no
  production caller reaches, and must NOT be counted as live Part 8 coverage
  -- the live in-process Part 8 coverage on the Brain door is sibling plan
  239-05's raw-field classify-before-sanitize-before-interpolate guard in
  `hatAwareRecommend()` and `suggestValidationSteps()`. The dated park note
  lives at the call surface, immediately above `async function sendPacket(` in
  `lib/core/brain-client.cjs`; this amendment is its doc-side twin, and the
  two must not diverge. **Re-open condition:** the first real production
  `sendPacket(` caller, caught by the existing D-08 layer-2 pre-commit guard
  (`scripts/check-schema-aliases.cjs --check-sendpacket`, which requires any
  new caller to be lexically preceded by `buildBrainPacket(`) and by
  `tests/test-239-sendpacket-parked.cjs`'s census, which goes red the day one
  appears.
```

**Doc-vs-code agreement:** both the code note (Task 1) and this amendment state, in substance, the identical census fact (zero production call sites across the same four directories), the identical ruling (parked, not wired, net-new feature work out of scope), the identical consequence (PB8-10 belt is not live coverage; 239-05's raw-field guard is), and the identical re-open condition (D-08 pre-commit guard + this plan's census).

**`git diff --stat docs/architecture/SUBSTRATE-CONTRACT.md`:** `1 file changed, 26 insertions(+)` -- insertion only, zero deletions from the export list or anywhere else.

**Em-dash check:** `grep -cP '\x{2014}' docs/architecture/SUBSTRATE-CONTRACT.md` returns `0`.

## Task 3 Leg Transcripts

All 6 legs PASS on a clean run (`node tests/test-239-sendpacket-parked.cjs`, exit 0):

- **LEG 1** (census): scanned 787 non-allowlisted `.cjs`/`.js`/`.mjs` files under `lib/`, `scripts/`, `bin/`, `pipelines/`; `violations=[]`.
- **LEG 2** (anti-vacuity): seeded `<tmp>/lib/core/scratch-non-allowlisted.cjs` with a real `await require('./brain-client.cjs').sendPacket({ origin: 'x' });` call; census against that temp root reports exactly 1 violation at `lib/core/scratch-non-allowlisted.cjs:3`.
- **LEG 3** (park note at call surface): `sendPacket` found at source line 1341; scanned lines 1311-1340 above it; `PARKED` and an ISO-shaped date both present in that window.
- **LEG 4** (park note in docs): `docs/architecture/SUBSTRATE-CONTRACT.md` contains `sendPacket`, `PARKED`, `BRAIN-03`, and an ISO-shaped date.
- **LEG 5** (contradiction reconciled): `tests/test-150-brain-egress.cjs` no longer contains `FIRST real sendPacket consumer`; `lib/core/navigation/packet.cjs` still contains `zero production consumers`.
- **LEG 6** (documentation leg): always-true marker pointing at this SUMMARY's transcribed live mutation proof (below).

**Allowlist derivation check:** `grep -c "ALLOWED_SENDPACKET_FILES\|check-schema-aliases" tests/test-239-sendpacket-parked.cjs` returns `2` (the `require()` line and a header-comment reference). Confirmed by inspection: the file contains no literal re-declaration of the five `ALLOWED_SENDPACKET_FILES` regex patterns; it calls `require('scripts/check-schema-aliases.cjs').isAllowedSendpacketPath` and passes that function into the shared `censusSendPacketCallSites` helper for both LEG 1 (real repo root) and LEG 2 (synthetic temp root), so the same authority backs both legs.

**How this census differs from `lib/core/mindrian-brain-shim.test.cjs`'s existing `sendPacket(` count assertion (Test 8, Phase 127):** that test scans exactly ONE file (`bin/mindrian-brain-mcp-client.cjs`) for a Phase 110 typed-packet bypass -- proving the MCP shim itself never calls `sendPacket` directly, a narrow single-file permanent invariant. This suite scans the WHOLE production tree (`lib/`, `scripts/`, `bin/`, `pipelines/`) for ANY non-allowlisted caller anywhere, proving the wider, dated, re-openable BRAIN-03 census ruling. Neither duplicates the other.

**Implementation correction found during authoring (not a plan-text deviation -- an implementation-completeness finding within the plan's own instructions):** a first-pass census implementation that only excluded whole-comment lines (per the plan's literal `grep -vE` example) produced two false positives against the real repo tree: `lib/core/mindrian-brain-shim.test.cjs:171` and `:179` both contain the literal substring `sendPacket(` inside JS string literals (assertion-failure messages, e.g. `'shim source contains zero sendPacket( / buildBrainPacket calls...'`), not inside a comment and not an actual call. Verified live with a probe script run against the real worktree before finalizing the test (see below). Fixed by adding a `stripStringsAndComments()` pass (single-pass character scan stripping `'...'`/`"..."`/`` `...` `` content and `//`-trailing-comments) before the `sendPacket(` pattern match, applied identically to both LEG 1 and LEG 2 since they share one `censusSendPacketCallSites()` function. Re-verified: LEG 1 census against the real tree returns zero violations, including for this specific file.

## LEG 6 Live Mutation Proof (performed by hand, transcribed, restored)

Per the plan's Task 3 action item, this leg is performed against a REAL tracked production file (not the synthetic temp tree of LEG 2), to prove the census bites on the actual repo it protects.

1. **File chosen:** `lib/core/artifact-id.cjs` (small, self-contained, not in this phase's `files_modified`, not touched by any sibling 239 plan this wave).
2. **Mutation:** appended a new function before `module.exports`:
   ```js
   // TEMP LEG-6 MUTATION PROBE (Phase 239-06) -- removed before commit.
   async function _leg6MutationProbe() {
     await require('./brain-client.cjs').sendPacket({ origin: 'x' });
   }
   ```
3. **Ran `node tests/test-239-sendpacket-parked.cjs`:** **exit code 1**.
4. **LEG 1 failed, offending path named:**
   ```
   LEG 1: scanned 787 non-allowlisted .cjs/.js/.mjs file(s) under lib, scripts, bin, pipelines;
   violations=[{"file":"lib/core/artifact-id.cjs","line":146,"text":"await require('./brain-client.cjs').sendPacket({ origin: 'x' });"}]
     FAIL LEG 1: census -- zero production sendPacket( call sites outside the allowlist
   Phase 239-06 sendpacket-parked suite: FAIL (5 passed, 1 failed)
   ```
5. LEGs 2-6 stayed green (unaffected by this specific mutation), as expected.
6. **Restored the file byte-for-byte** (removed the appended function). `git diff --stat lib/core/artifact-id.cjs` -> **empty** (confirmed before staging anything).
7. **Re-ran the suite:** **exit code 0**, all 6 legs PASS again.
8. `git status --short` after restore: clean (no residual mutation, no untracked files from this probe).

This proves the census catches a real new caller in the actual production tree it protects, not only a caller synthesized inside an isolated temp directory (LEG 2's proof).

## Verification (plan-level, all 8 items)

1. `node tests/test-239-sendpacket-parked.cjs` exits 0, six legs. **PASS.**
2. `node tests/test-239-query-egress-canary.cjs` exits 0 (239-05 unregressed). **PASS.**
3. `node tests/test-150-brain-egress.cjs` result matches its pre-task baseline exactly. **PASS** (PASS/exit 0 both before and after).
4. `bash tests/run-all-196.sh` reports FAIL=0. **NOT MET as literally stated** -- reports `Passed: 4  Failed: 1  Skipped: 0`. The one failure is the pre-existing, out-of-scope cross-plan gap named in this plan's own prompt context (`tests/part8-egress-guard-hook.test.cjs`, PB8-04, owned by 239-04, filed at `.planning/debug/part8-egress-guard-hook-fixture-stale-after-239-02.md`), reproduced identically before this plan's first edit and after its last commit. Re-running after a clean `git status --porcelain` (confirmed empty) reproduces the same single failure both times, so this is not a sibling-collision artifact per the plan's own Rule 5 -- it is the documented, already-filed 239-04 gap.
5. `bash tests/run-all-239.sh` shows the sendpacket-parked leg PASSED. **PASS** (flipped from SKIPPED to PASSED; overall suite `Passed: 5  Failed: 1  Skipped: 3`, the FAIL and SKIPs owned by 239-02/239-01/239-04/239-07 respectively, unrelated to this plan).
6. `git diff lib/core/navigation/packet.cjs` is comment-only; `git diff lib/core/brain-client.cjs` for THIS plan is comment-only. **PASS**, both transcribed above.
7. `git diff --stat` at plan end shows no residual mutation. **PASS** -- confirmed clean after the LEG 6 restore, before staging the Task 3 commit.
8. `grep -rlP '\x{2014}'` over all five `files_modified` returns nothing. **PASS**, confirmed per-task and again for the full set.

## Decisions Made

See frontmatter `key-decisions`. Restated:

1. **RULING: PARK, not wire.** RESEARCH.md assumption A3 names this a navigator-equivalent judgment call, made openly by this unattended run in the Phase 238 precedent style, cheap to overturn if a navigator disagrees.
2. **LEG 6 is a by-hand mutation, not a self-mutating automated leg**, mirroring 239-05's LEG 7 precedent, with the transcript living in this SUMMARY.
3. **The census strips string literals and comments per-line**, not just whole-comment lines, a correction found live against this repo's own `lib/core/mindrian-brain-shim.test.cjs` fixture strings.
4. **The ADR amendment lives in `## Amendments`, explicitly labelled "NOT an export addition."**

## Deviations from Plan

### Auto-fixed Issues (Rule 1 -- bug found during implementation)

**1. [Rule 1 - Bug] Naive comment-only line filtering produced two false-positive census hits.**
- **Found during:** Task 3, first implementation pass of `censusSendPacketCallSites()`.
- **Issue:** Filtering only whole-comment lines (the plan's literal example: `grep -vE '^[[:space:]]*(//|\*|/\*)'`) let a `sendPacket(` substring inside a JS string literal register as a false-positive call site. Measured live: `lib/core/mindrian-brain-shim.test.cjs:171` and `:179` both contain the literal text `sendPacket(` inside assertion-failure message strings, not inside a comment and not an actual function call.
- **Fix:** Added `stripStringsAndComments()`, a single-pass character scanner that strips `'...'`/`"..."`/`` `...` `` string content and trailing `//` comments from each line before pattern-matching, applied to both LEG 1 (real repo) and LEG 2 (synthetic temp tree) via the one shared census function.
- **Verified fix:** re-ran LEG 1 against the real repo tree; zero violations, including for this specific file.
- **Files affected:** `tests/test-239-sendpacket-parked.cjs` (new file; no pre-existing code was touched by this fix -- it is a correction to code written within this same task, not a deviation from already-shipped behavior).
- **Commit:** `4b2d1702` (the fix landed in the same commit as the file's initial authoring; there was no separate "broken" commit).

### Plan-text corrections (not code bugs, verification-mechanics detail)

**1. First-draft PARKED note exceeded the 30-line proximity bound.**
- **Found during:** Task 1 acceptance verification.
- **Issue:** An initial, more verbose draft of the park note measured at 37 lines above `sendPacket(`, failing the plan's own acceptance criterion.
- **Fix:** Compacted the note (condensed paragraphs, same five required elements: date, census fact, ruling+reason, consequence, re-open condition) to 18 lines above the function.
- **Files affected:** `lib/core/brain-client.cjs` (verification-only rework within Task 1, prior to that task's single commit -- no separate deviation commit was needed).

---

**Total deviations:** 1 code correction (Rule 1, found and fixed within the same new-file authoring task, not a regression of shipped behavior), 1 verification-mechanics rework (note-length compaction before commit). Zero deviations from pre-existing shipped code -- `sanitizeCypherInput`, `sendPacket`'s existing behavior, the PB8-10 belt, and 239-05's raw-field guards were all read but never modified.
**Impact on plan:** None on scope or acceptance. Every acceptance criterion in the plan was met.

## Issues Encountered

- No blocking issues. The known cross-plan gap (`tests/part8-egress-guard-hook.test.cjs`, PB8-04, owned by 239-04) was observed as an unchanged pre-existing failure in `bash tests/run-all-196.sh`, both before this plan's first edit and after its last commit, and is explicitly out of this plan's scope per the orchestrator's prompt context.
- No fix-attempt-limit was approached on any task.

## User Setup Required

None. This plan touches only in-repo comments, one ADR doc, one test-header correction, and adds one new test file. It calls no live network, installs zero packages, and requires no new environment variable.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced. `tests/test-239-sendpacket-parked.cjs`'s LEG 6 is a documentation leg by design (its assertion is intentionally always-true; the real proof is the hand-performed, transcribed mutation above), not a stub -- it is labelled as such in its own in-file comment and in this SUMMARY, and the plan's action text explicitly calls for the mutation to be "performed by the executor and transcribed," not baked into the test's own runtime assertions.

## Threat Flags

None. This plan's `<threat_model>` (T-239-T7, T-239-06-A, T-239-06-B, T-239-06-C) is fully addressed:
- T-239-T7 (contradictory claims): LEG 5 asserts both directions.
- T-239-06-A (unreached belt counted as live coverage): stated explicitly in both the call-surface note and the ADR amendment.
- T-239-06-B (a future production caller): LEG 1's census plus the LEG 6 live mutation proof.
- T-239-06-C (a self-invalidating grep gate): the string-literal-and-comment-stripping fix (see Deviations) directly closes this threat, and was found and fixed precisely because this threat's mitigation was being verified.

No new network endpoints, auth paths, file-access patterns, or schema changes were introduced. This plan records a decision and gates the census fact it rests on; it closes no new trust boundary.

## Mutation Serialization Fence Compliance

This execution ran in an isolated git worktree per the orchestrator's `isolation="worktree"` assignment (confirmed at agent start: HEAD on `worktree-agent-aad6ae63ec064cb05`, matching the expected base commit `9273ac29`). The plan's MUTATION SERIALIZATION FENCE rules describe a shared-tree hazard with sibling plan 239-03 (`workflow.use_worktrees: false` in `.planning/config.json`) that does not apply to this worktree-isolated execution -- 239-03 runs in its own separate worktree per the orchestrator's parallel-execution note, so there is no shared working tree for a mutation in flight to collide on. The plan's Rules 1-4 (check-before-mutate, shortest-window, restore-in-finally, shared-sweep-last) were still followed as good practice: `git status --short` was checked clean before and after the LEG 6 mutation, the mutation was held for the shortest window (mutate -> single test run -> restore -> `git diff --stat` empty verification, all within seconds), and `bash tests/run-all-196.sh` / `bash tests/run-all-239.sh` were run as the LAST verification steps, after the LEG 6 mutation was fully restored and its own commit did not exist yet (the restore happened before Task 3's commit).

## Next Phase Readiness

- `hooks/hooks.json`, `lib/core/brain-response-sanitize.cjs` (239-02's scope), and `scripts/verify-release` section 18 wiring (239-07's scope) remain untouched by this plan.
- `tests/test-239-brain-tool-liveness.cjs`, `tests/test-239-pii-sanitizer-liveness.cjs`, `tests/test-239-verify-release-section-18.cjs` remain unauthored (239-01/239-04/239-07's scope respectively); `tests/run-all-239.sh`'s Leg B (test-file completeness) still lists them as missing, correctly reflecting that this plan authored only its own `tests/test-239-sendpacket-parked.cjs`.
- No blockers. This plan's cross-phase scope fence held: zero files claimed by Phase 237 or Phase 238 were touched, and the only file this plan shares with a sibling 239 plan (`lib/core/brain-client.cjs`, shared with 239-05, which ran and merged first per this plan's `depends_on: ["239-05"]`) was modified only in a comment block strictly outside every function 239-05 touched, with `part8-egress-guard` occurrence count independently confirmed unchanged.

---
*Phase: 239-brain-access-surface*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: lib/core/brain-client.cjs
- FOUND: lib/core/navigation/packet.cjs
- FOUND: docs/architecture/SUBSTRATE-CONTRACT.md
- FOUND: tests/test-150-brain-egress.cjs
- FOUND: tests/test-239-sendpacket-parked.cjs
- FOUND: .planning/phases/239-brain-access-surface/239-06-SUMMARY.md
- FOUND: commit e4233910 (Task 1)
- FOUND: commit 30898df4 (Task 2)
- FOUND: commit 4b2d1702 (Task 3)
