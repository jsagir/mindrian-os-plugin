---
phase: quick-260714-jjm
plan: 01
type: execute
wave: 1
depends_on: []
subsystem: eureka
tags: [eureka, entity-extract, silent-swallow, observability, T-218-VD-5, david-session, silent-skip-false-success]
files_modified:
  - scripts/eureka-command.cjs
  - tests/test-218-eureka-auto-extract.cjs
  - tests/run-all-218.sh
  - .planning/debug/interns-round-eureka-david-session-2026-07-14.md
autonomous: true

must_haves:
  truths:
    - "A THROWN entity-extraction pre-step failure during eureka run is visible as an extraction_error field in the eureka status.json AND as a one-line stderr note, while ranking still proceeds and the exit code is unchanged (degrade-never-throw contract intact)"
    - "A NON-ZERO return code from ENTITY_EXTRACT.main (entity-extract's internally-caught failure path, the likelier David-session mechanism) surfaces the real error message that entity-extract already wrote to its own status.json into the eureka status.json"
    - "A clean run writes NO extraction_error field - the field is additive and absent on success (no false positives)"
    - "The reproduction test proves the pre-fix shape verbatim: injected extraction failure yields exit 0, state done, zero surfaced error - the exact David-session false-success shape - and the same legs go green after the fix"
    - "The incident addendum records both outcomes: silent-throw is a confirmed-plausible mechanism, and the fix is live with commit hashes"
  artifacts:
    - path: "scripts/eureka-command.cjs"
      provides: "maybeExtractFirst returns a failure detail (or null); cmdRun threads extraction_error additively into all three writeStatus payloads"
      contains: "extraction_error"
    - path: "tests/test-218-eureka-auto-extract.cjs"
      provides: "Legs 5/6/7 - throw surface, exit-1 surface, clean-run control - via a monkey-patched ENTITY_EXTRACT.main"
      contains: "extraction_error"
    - path: "tests/run-all-218.sh"
      provides: "The auto-extract test wired as a leg (it is currently in NO aggregator)"
      contains: "test-218-eureka-auto-extract"
    - path: ".planning/debug/interns-round-eureka-david-session-2026-07-14.md"
      provides: "Outcome addendum: mechanism confirmed plausible, fix live, Resolution commits filled, status stays investigating"
      contains: "extraction_error"
  key_links:
    - from: "scripts/eureka-command.cjs::maybeExtractFirst"
      to: ".mindrian/eureka/status.json"
      via: "return value threaded through cmdRun into every writeStatus payload (running/done/failed)"
      pattern: "extraction_error"
    - from: "scripts/eureka-command.cjs::maybeExtractFirst"
      to: ".mindrian/entity-extract/status.json"
      via: "entityExtractStatusPath read on a non-zero ENTITY_EXTRACT.main return code"
      pattern: "entityExtractStatusPath"
    - from: "tests/run-all-218.sh"
      to: "tests/test-218-eureka-auto-extract.cjs"
      via: "run leg after the T-218-VD-4 extend-to-artifacts leg"
      pattern: "test-218-eureka-auto-extract"
---

<objective>
Fix the silent error-swallow in scripts/eureka-command.cjs::maybeExtractFirst (lines 177-187) so an entity-extraction pre-step failure is VISIBLE (eureka status.json field + one stderr line) without changing the degrade-never-throw fallback contract, then prove via a reproduction test whether a silent extraction failure is a plausible mechanism for the David-session "0 nodes, 0 typed edges / false success" incident, and close the loop in the incident addendum.

Purpose: this is the deliberately narrow, cheap diagnostic-and-fix path chosen INSTEAD of committing to SEED-034's full graph-derivation harness or SEED-058's reasoning-mode fallback before knowing whether either is what this incident actually needs. It is also the fourth confirmed instance of today's silent-skip-false-success pattern (rethinking-mindrianos room, research/2026-07-14-academy-tester-qa-silent-skip-false-success/).

Output: surfaced-failure fix in eureka-command.cjs, 3 new reproduction test legs (8/8 total) wired into run-all-218.sh, updated incident addendum with the verdict and commit hashes, room research entry cross-referenced.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/debug/interns-round-eureka-david-session-2026-07-14.md
@scripts/eureka-command.cjs
@scripts/entity-extract.cjs
@tests/test-218-eureka-auto-extract.cjs
@tests/run-all-218.sh
@tests/run-all-216.sh
</context>

<interface_contracts>
Facts the executor needs, verified against HEAD this planning session - do not re-derive:

1. TWO silent failure paths exist, not one. (a) A throw escaping ENTITY_EXTRACT.main is bare-caught and discarded at eureka-command.cjs lines 184-186. (b) entity-extract.cjs's own cmdRun (lines 700-710) catches ALL its internal errors, writes state 'failed' plus the real error message to ROOM/.mindrian/entity-extract/status.json, and RETURNS 1 without throwing - and maybeExtractFirst never checks the return code. Path (b) is the LIKELIER production mechanism (openRoomDb failure, extraction crash - all land there). Both must be surfaced.

2. Write-ordering constraint: cmdRun writes state 'running' via writeStatus AT LINE ~280, AFTER the maybeExtractFirst call at line 271, and writeStatus (line 95-98) overwrites the whole status.json. A direct status write inside maybeExtractFirst would be clobbered. The failure detail MUST be returned from maybeExtractFirst and threaded by cmdRun into all three subsequent writeStatus payloads (running / done / failed).

3. Why status.json and not just stderr: cmdStart (line ~347) spawns the run subcommand detached with stdio 'ignore' - on the /mos:eureka background path, status.json is the ONLY visible trail.

4. Monkey-patch seam for the test: eureka-command.cjs holds ENTITY_EXTRACT as the shared module.exports object (line 63) and calls ENTITY_EXTRACT.main(...) as a property lookup at call time (line 183). An in-process test that does require of ../scripts/entity-extract.cjs and reassigns its .main property intercepts the call. entity-extract.cjs exports main (verified). Restore the real main in a finally block.

5. entityExtractStatusPath(roomDir) already exists in eureka-command.cjs (lines 110-112) resolving to ROOM/.mindrian/entity-extract/status.json - reuse it for the path-(b) read, do not duplicate the path literal.

6. tests/test-218-eureka-auto-extract.cjs currently has 5 legs (1, 2, 3, 3b, 4), prints "passed + '/5 legs PASSED'" at line 149, uses mkTempRoom + seedAnchor fixtures and awaits dispatcher.main([roomDir, 'run', '--offline']) in-process. It is wired into NO aggregator (grep-confirmed across tests/run-all-*.sh and lib/memory/run-feynman-tests.cjs).

7. The eureka status.json lives at ROOM/.mindrian/eureka/status.json (statusPath, line 72). The additive-observability-keys precedent to mirror: entity-extract.cjs cmdRun's tier-2 keys block (lines 690-696, quick-task 260714-hzx).
</interface_contracts>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED reproduction legs, then GREEN surfacing fix in maybeExtractFirst/cmdRun</name>
  <files>tests/test-218-eureka-auto-extract.cjs, scripts/eureka-command.cjs</files>
  <behavior>
    - Leg 5 (throw path): with ENTITY_EXTRACT.main stubbed to throw Error('injected extraction failure') and a fresh never-extracted fixture room, await dispatcher.main([room, 'run', '--offline']) returns 0, and ROOM/.mindrian/eureka/status.json has state 'done' AND an extraction_error field containing 'injected extraction failure'. Also assert one stderr line mentioning the pre-step failure was written (wrap process.stderr.write during the call, restore after).
    - Leg 6 (caught exit-1 path, the likely David mechanism): with the stub writing a state 'failed' status.json containing error 'injected db open failure' to ROOM/.mindrian/entity-extract/status.json (mirroring entity-extract.cjs cmdRun lines 700-710) and RETURNING 1 without throwing, the eureka status.json extraction_error contains 'injected db open failure' - proving the caller now reads the diagnostic trail entity-extract already writes.
    - Leg 7 (control): with the REAL main restored and a fresh room, a clean run's eureka status.json has NO extraction_error key at all (assert the key is absent, not merely falsy).
  </behavior>
  <action>
    RED first. Extend tests/test-218-eureka-auto-extract.cjs with legs 5, 6, 7 per the behavior block. Implementation notes: require ../scripts/entity-extract.cjs at test top, save realMain, reassign the exports .main property for legs 5-6 (interface_contracts item 4), restore realMain before leg 7 AND in the outer finally. Each leg uses its own mkTempRoom + seedAnchor fixture room (never-extracted, so needsExtraction is true and the pre-step fires). For leg 5, the load-bearing assertion is the extraction_error field; if the thin single-anchor room makes the runner exit non-zero, accept state 'failed' but still require extraction_error present - annotate that in the assertion message. Update the summary print from '/5 legs' to '/8 legs' and keep the passed counter consistent. No em-dashes anywhere.

    Run node tests/test-218-eureka-auto-extract.cjs against current HEAD: legs 5 and 6 MUST FAIL (pre-fix, the run exits 0 with state 'done' and NO extraction_error - total silence). CAPTURE that RED output verbatim (the status.json contents showing done-with-no-trace): it is the reproduction evidence Task 3's addendum cites as proof the silent-failure mechanism produces exactly the David-session false-success shape. Commit: test(quick-260714-jjm): add RED reproduction legs for the silent extraction-failure swallow.

    GREEN second. Edit scripts/eureka-command.cjs only (scope rule: do NOT touch entity-extract.cjs, entity-extractor.cjs, entity-classifier.cjs, or portfolio-dimensions.cjs - those are correct per quick task 260714-hzx; a git diff gate in verify enforces this).

    In maybeExtractFirst: return null on skip or success. Capture the awaited numeric return code from ENTITY_EXTRACT.main. On a throw, build a one-line detail string like 'entity extraction threw: ' plus the first line of the error message. On a non-zero code, read entityExtractStatusPath(roomDir) (reuse the existing helper, interface_contracts item 5) and build 'entity extraction exited ' plus the code plus ': ' plus that status file's error field when present, else a pointer to the status path. In both failure branches, write exactly ONE stderr line, e.g. 'eureka: entity-extraction pre-step failed (' + detail + '); ranking proceeds on existing graph data', then RETURN the detail string. Never throw, never block ranking, never alter exit codes - only the silence changes (T-218-10 degrade-never-throw contract stays intact).

    In cmdRun: capture const extractionError = await maybeExtractFirst(roomDir, opts) at line ~271, and when non-null add extraction_error: extractionError to ALL THREE subsequent writeStatus payloads (running at ~280, done at ~291, failed at ~301 and ~314) so the field survives every overwrite (interface_contracts item 2). When null, the key must be ABSENT (conditional spread or post-assignment), matching the additive-keys precedent (item 7). Update the stale comment prose at lines ~45-52, ~101-108, and ~175-176 so 'best-effort / swallows every error' now reads 'best-effort but SURFACED: failures land in status.json as extraction_error plus one stderr line'. No em-dashes.

    Run the test again: 8/8 GREEN. Commit: fix(quick-260714-jjm): surface entity-extraction pre-step failures into eureka status.json and stderr.
  </action>
  <verify>
    <automated>node tests/test-218-eureka-auto-extract.cjs 2>&1 | grep -q "8/8 legs PASSED" && node -c scripts/eureka-command.cjs && node -c tests/test-218-eureka-auto-extract.cjs && git diff --exit-code scripts/entity-extract.cjs lib/core/eureka/entity-extractor.cjs lib/core/eureka/entity-classifier.cjs lib/core/eureka/portfolio-dimensions.cjs && [ "$(grep -c extraction_error scripts/eureka-command.cjs)" -ge 4 ]</automated>
  </verify>
  <done>Legs 5 and 6 were observed RED against pre-fix HEAD (run exits 0, state done, no extraction_error - the David shape) with the output captured for Task 3; after the fix all 8 legs pass; both failure paths (throw AND caught exit-1) surface into eureka status.json plus one stderr line; the control leg proves the field is absent on clean runs; the four extraction-logic files are byte-unchanged; two atomic commits (test RED, fix GREEN) exist.</done>
</task>

<task type="auto">
  <name>Task 2: Wire the auto-extract test into run-all-218.sh and run the regression sweep</name>
  <files>tests/run-all-218.sh</files>
  <action>
    tests/test-218-eureka-auto-extract.cjs is currently in NO aggregator (interface_contracts item 6) - an existing wiring gap this task closes while adding the new coverage. In tests/run-all-218.sh, add a run leg immediately after the 'T-218-VD-4 extend-to-artifacts' leg: label it 'T-218-VD-5 auto-extract pre-step + extraction-error surfacing' invoking node tests/test-218-eureka-auto-extract.cjs. Add a 2-4 line comment above it naming the David-session incident (.planning/debug/interns-round-eureka-david-session-2026-07-14.md) and that the surfacing legs pin the fourth confirmed instance of the silent-skip-false-success pattern. The test is offline-safe under the aggregator's eureka-offline-preload (it requires the preload itself at line 19). No em-dashes.

    Regression sweep, all three required: bash tests/run-all-218.sh (new leg present, FAIL=0); bash tests/run-all-216.sh (FAIL=0 - its leg 2 e2e test-216-eureka-command.cjs exercises the edited dispatcher run path end to end, proving no regression); bash -n tests/run-all-218.sh exits 0.

    Commit: test(quick-260714-jjm): wire eureka auto-extract test into the 218 aggregator.
  </action>
  <verify>
    <automated>bash -n tests/run-all-218.sh && grep -q "test-218-eureka-auto-extract" tests/run-all-218.sh && bash tests/run-all-218.sh 2>&1 | tail -3 | grep -q "FAIL=0" && bash tests/run-all-216.sh 2>&1 | tail -3 | grep -q "FAIL=0"</automated>
  </verify>
  <done>run-all-218.sh contains the new T-218-VD-5 leg and reports FAIL=0; run-all-216.sh reports FAIL=0 (dispatcher e2e unregressed); bash -n clean; one atomic wiring commit exists.</done>
</task>

<task type="auto">
  <name>Task 3: Close the incident-addendum loop and composite to the rethinking-mindrianos room</name>
  <files>.planning/debug/interns-round-eureka-david-session-2026-07-14.md</files>
  <action>
    Append a dated second addendum section to the incident file answering the two outcome questions this quick task exists to answer.

    (1) Is a silent extraction failure a plausible mechanism for the David-session shape? YES, confirmed by the Task 1 RED run: quote the captured pre-fix evidence verbatim - with an injected extraction failure (BOTH the throw path and the likelier internally-caught exit-1 path), eureka run completed with exit 0, status.json state 'done', and ZERO trace of the failure anywhere on the eureka surface - exactly the observed false-success shape. State the claim boundary explicitly: this proves PLAUSIBILITY of the mechanism, not that David's room actually hit it; the 'Not yet verified, still open' item stands (david-innovation-studio is unreachable from this machine; the closing check remains reading that room's .mindrian/entity-extract/status.json state field when the Desktop/Cowork surface is next reachable).

    (2) Is the fix live? YES: cite the Task 1 fix commit, the Task 1 test commit, and the Task 2 wiring commit by hash. A future incident of this shape now shows extraction_error in ROOM/.mindrian/eureka/status.json plus a one-line stderr note on the foreground path.

    Also: update the frontmatter updated timestamp; fill the Resolution block's files_changed and commits lists; KEEP status investigating and do NOT move the file to resolved/ (the David-room ground truth is still unconfirmed - only the mechanism question and the fix are closed).

    Dev-research compositing (CLAUDE.md rule + task instruction 5): this outcome refines the SEED-034/SEED-058 scope understanding - it narrows the David-incident proximate-cause hypothesis to the now-fixed swallow, WITHOUT invalidating SEED-034's general post-write thesis for other graph consumers or SEED-058's independent cold-machine justification. Append a short cross-referenced note recording instance #4 (eureka maybeExtractFirst) as FIXED-with-test-coverage, commits cited, to the room research entry at ~/MindrianRooms/rethinking-mindrianos/research/2026-07-14-academy-tester-qa-silent-skip-false-success/ (and update its mirror under the mindrianOS research source-of-record location if one exists for this entry). If the entry directory does not exist on this machine, record that fact in the SUMMARY instead of failing - do not create a new entry from scratch.

    Commit (the .planning path is gitignored, so force-add): git add -f .planning/debug/interns-round-eureka-david-session-2026-07-14.md, then commit as docs(quick-260714-jjm): close the David-session addendum loop - silent-failure mechanism confirmed plausible, fix live. Room files live outside this repo; commit them in the room's own repo only if it is one.
  </action>
  <verify>
    <automated>grep -q "extraction_error" .planning/debug/interns-round-eureka-david-session-2026-07-14.md && grep -qE "commits:" .planning/debug/interns-round-eureka-david-session-2026-07-14.md && git log --oneline -5 | grep -q "quick-260714-jjm"</automated>
  </verify>
  <done>The incident file carries a second addendum answering both outcome questions with the RED-run evidence and live commit hashes; Resolution files_changed/commits filled; status stays investigating; the room research entry (if reachable) cross-references instance #4 as fixed; the docs commit exists via git add -f.</done>
</task>

</tasks>

<verification>
- node tests/test-218-eureka-auto-extract.cjs prints 8/8 legs PASSED.
- bash tests/run-all-218.sh includes the T-218-VD-5 leg and ends FAIL=0; bash tests/run-all-216.sh ends FAIL=0.
- git diff --exit-code scripts/entity-extract.cjs lib/core/eureka/entity-extractor.cjs lib/core/eureka/entity-classifier.cjs lib/core/eureka/portfolio-dimensions.cjs (scope rule 3: extraction logic byte-unchanged).
- grep -c extraction_error scripts/eureka-command.cjs is at least 4 (the return seam plus three writeStatus payloads).
- No em-dashes in any touched file.
- The incident addendum answers both outcome questions and cites commit hashes.
</verification>

<success_criteria>
- A silent entity-extraction pre-step failure (throw OR caught exit-1) is impossible to miss: extraction_error in the eureka status.json plus one stderr line, with ranking, fallback behavior, and exit codes unchanged on the happy path (degrade-never-throw intact).
- The reproduction test proved the pre-fix David-session shape RED and the surfaced shape GREEN, and is wired into run-all-218.sh so it can never silently regress (it was previously in NO aggregator).
- The incident file records the verdict (mechanism plausible, fix live) while honestly keeping the David-room ground truth open.
- Atomic commits: test RED, fix GREEN, wiring, docs.
</success_criteria>

<output>
Create .planning/quick/260714-jjm-fix-the-silent-error-swallow-in-scripts-/260714-jjm-SUMMARY.md when done.
</output>
