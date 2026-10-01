---
status: investigating
kind: rca
trigger: "census-guard test failure: tests/run-all-246.sh test-246-census-guard.cjs FAILED"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-10-01T00:00:00Z
updated: 2026-10-01T12:00:00Z
---

## Current Focus

hypothesis: CONFIRMED. Commit 8f87980e5 (354-06, D-354-EGR) made classify() step 3 require a closed NATURAL-LANGUAGE vocabulary proof for every free-form string, and the `cypher` key rides that path, so no census Cypher string can classify allow any more. The guard did not regress in the security sense; tests/test-246-census-guard.cjs (and claim (c) of tests/test-245-brain-envelope-shape.cjs) are stale against that intentional change. The 354-06 commit updated four sibling tests and missed these two.
test: delta over commits (guard at 8f87980e5^ vs 8f87980e5, same test file), plus a hook-disposition probe across three Brain tool scopes.
expecting: test passes at 8f87980e5^ and fails at 8f87980e5 (observed: yes, 15 of 15 queries).
next_action: HUMAN POLICY DECISION needed before any edit (see Required Code Changes, Decision D-1). Recommended: Option A (re-pin the two stale tests, guard untouched). No repo file other than this debug file has been modified.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: read with `node lib/core/repo-version.cjs` (not material to this defect)
- Reported by: GSD session manager, `bash tests/run-all-246.sh` PASS=2 FAIL=1
- Date first observed: 2026-10-01
- Related debug sessions: none
- Source-of-Truth Preamble:
  - CODE claims read against: working tree on branch main at HEAD e6a589579, plus `git archive` snapshots of 8f87980e5^ and 8f87980e5 in the session scratchpad for the delta runs. The working tree shows no uncommitted change to lib/core/part8-egress-guard.cjs, scripts/build-brain-census.cjs, scripts/part8-egress-guard-hook.cjs or lib/core/brain-client.cjs.
  - WIRE claims probe against: none. Every probe is offline (local classify() and local hook subprocess with PART8_FORCE_BRAIN_AVAILABLE=1, cwd outside any room). No Brain wire was touched.
  - Date of audit: 2026-10-01
  - Re-verification rule: all source claims below were read from the current tree, not an install cache.

## Problem Statement

`tests/test-246-census-guard.cjs` asserts every `CENSUS_QUERIES` Cypher string classifies `allow` under `lib/core/part8-egress-guard.cjs`; since 8f87980e5 every one classifies `ambiguous` / `freeform_unproven`, so the 246 runner is red (PASS=2 FAIL=1). The live census is unaffected.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

- expected: every fixed census query in scripts/build-brain-census.cjs (including `MATCH (f:Framework) RETURN count(f)`) is classified `allow` by lib/core/part8-egress-guard.cjs, so test-246-census-guard.cjs passes.
- actual: the guard classifies `MATCH (f:Framework) RETURN count(f)` as `ambiguous`; test-246-census-guard.cjs throws at its ok() assertion (line 28, called from main line 47). run-all-246.sh: PASS=2 FAIL=1.
- errors: assertion failure in tests/test-246-census-guard.cjs:28 (ok) <- :47 (main) <- :65.
- timeline: observed 2026-10-01. Unknown when it started. Neither scripts/build-brain-census.cjs nor lib/core/part8-egress-guard.cjs was changed by today's README/census quick tasks (dde3ae9fb, 699ace33a touched docs only). Check git log of the guard and the test for the regressing commit.
- reproduction: `bash tests/run-all-246.sh` (or `node tests/test-246-census-guard.cjs`) in /home/jsagi/dev/MindrianOS-Plugin. Offline, no network.
- note: the live census run (scripts/build-brain-census.cjs --lane-a/--lane-b) still succeeded today, so the runtime path may not consult the classifier the same way the test does.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork all share one classifier; the verdict label is identical on all three. Live disposition differs only by Brain tool scope (see Evidence E6).
- Affected commands: none at runtime. scripts/build-brain-census.cjs POSTs through its own brainCall() fetch and never calls classify().
- Affected users: test suite only, plus one narrow live path: a model-issued `brain_query` with introspection Cypher through a DIRECT connector scope `mcp__pws-brain-mcp__brain_query` (not registered by this plugin's .mcp.json, which registers only `mindrian-os` and `mindrian-brain`).
- Version range: first bad = 8f87980e5 (2026-09-23); last good = 8f87980e5^ (b3b669aa6 lineage).
- Severity: medium (red regression fence, no data exposure, no live census breakage).
- Blast radius: tests/test-245-brain-envelope-shape.cjs claim (c) fails for the same cause (E7). Two OTHER reds in run-all-245 have different causes (E8) and are out of scope here.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: the census script or its query list changed and diverged from the guard (lead from the session manager, aef768cf2).
  evidence: `git log` shows aef768cf2 (2026-09-11) is the last commit to scripts/build-brain-census.cjs and it predates the break. The test passes 15 of 15 (59 assertions) against the guard at 8f87980e5^ with the CURRENT census list. Query list is not the cause.
  timestamp: 2026-10-01T12:00:00Z
- hypothesis: aef768cf2 / 361-02 / 361-09 / 354-10 / 260906-fda (the other guard-touching commits named in the lead) broke it.
  evidence: the delta run isolates the break to 8f87980e5 alone: pass at 8f87980e5^, fail at 8f87980e5, identical test and census files in both snapshots. 98b6f7bb9, 68111c594, a8ef4df8e come later and only add known-shape arms in step 3b (unreached for these payloads).
  timestamp: 2026-10-01T12:00:00Z
- hypothesis: the guard misclassifies a pure generic count query because of a bug (wrong regex, load failure of data/*.json).
  evidence: `_TYPED_QUESTION_DATA_LOADED` is true (COMMAND_SLUG_SET and CANONICAL_PHRASES non-empty). The ambiguous verdict is the designed outcome of `_proveTypedQuestion`: tokens `match`, `f`, `return`, `as`, `frameworks`-adjacent Cypher syntax are not in QUESTION_FUNCTION_WORDS / METHODOLOGY_TOKEN_SET / COMMAND_SLUG_SET. No defect in the proof, it is working as written.
  timestamp: 2026-10-01T12:00:00Z
- hypothesis: the live census run succeeds because classify() allows it at runtime.
  evidence: wrong premise. scripts/build-brain-census.cjs brainCall() (line 309) is a direct fetch POST to BRAIN_URL/mcp. It does not require the guard at all. The census never depended on this verdict.
  timestamp: 2026-10-01T12:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-10-01T12:00:00Z
  id: E1
  checked: `node tests/test-246-census-guard.cjs` and a per-query classify() dump over `builder.CENSUS_QUERIES` (toolName mcp__plugin_mos_mindrian-brain__brain_query).
  found: all 15 entries (13 ids; C4 expands to 3 sub-queries) classify `{verdict:ambiguous, class:freeform_unproven, reason:"methodology vocabulary present but free-form tokens unproven"}`. The first assertion to throw is C1, `MATCH (f:Framework) RETURN count(f) AS frameworks` (the exact string carries `AS frameworks`; the Symptoms text abbreviates it).
  implication: the failure is total (15 of 15), not specific to the count query. Every Cypher string is affected.
- timestamp: 2026-10-01T12:00:00Z
  id: E2
  checked: delta debugging with `git archive` snapshots of 8f87980e5^ and 8f87980e5 (lib, data, scripts, the two tests, node_modules symlinked), same test file and same census list in both.
  found: at 8f87980e5^ test-246 PASSES ("59 assertions over 15 census queries") and test-245-brain-envelope-shape CLAIM (c) passes. At 8f87980e5 both FAIL with the freeform_unproven verdict. Pre-break verdict was `{allow, move_set, "generic methodology vocabulary handle"}` (step 3 keyword-presence allow).
  implication: regressing commit is 8f87980e5 "feat(354-06): closed-vocabulary typed-question proof in classify()" (2026-09-23). Single-commit isolation.
- timestamp: 2026-10-01T12:00:00Z
  id: E3
  checked: lib/core/part8-egress-guard.cjs lines 102 (FREEFORM_KEYS includes 'cypher'), 612-728 (_proveTypedQuestion), 777-830 (classify step 3), and the 8f87980e5 commit message.
  found: classify() step 3 runs for any tool `_isFreeFormTool` recognizes, brain_query included, extracting the `cypher` string. It now allows only when `_proveTypedQuestion(str)` proves every token is function-word / methodology token / canonical framework phrase / command slug / 1-2 digit number. Cypher syntax can never satisfy that. The commit message states the intent ("generic now means structurally proven, not merely keyword-present"), records the SAME effect on Cypher as intended (test-239 LEG 4: the template-laundering canary `MATCH (f:Framework) WHERE x="<canary>"` now ambiguous, "a strict security improvement, not a regression"), and updated test-245-egress-contentless, test-260906-fda, test-339 and test-239 to the new contract.
  implication: the verdict change is an INTENTIONAL guard change (D-354-EGR). The two tests asserting the old allow for Cypher (test-246, test-245-brain-envelope-shape claim c) were not in the commit's file list: stale expectations, not a guard regression.
- timestamp: 2026-10-01T12:00:00Z
  id: E4
  checked: classify() on a census-shaped Cypher vs a laundering Cypher, same toolName.
  found: `MATCH (f:Framework) WHERE f.name = 'CANARY7F3A2B' RETURN f` -> `ambiguous / freeform_unproven`, byte-identical verdict to every census string. Only a CONTENT-SET hit (e.g. an email literal) yields `block`. `scanForContent` reports `hit:false` for all 15 census strings.
  implication: at class level the guard CANNOT tell a content-free census query from a laundered one. Restoring `allow` therefore cannot be done by vocabulary or keyword rules without reopening the exact laundering 354-06 closed. The only sound way to restore allow is an exact byte-match allowlist (a known-shape arm), which is a guard widening and a policy call.
- timestamp: 2026-10-01T12:00:00Z
  id: E5
  checked: scripts/build-brain-census.cjs lines 255-350 (brainCall) and 905-1090 (Lane B runners); header comment lines 22-25 and 1013-1019.
  found: the census POSTs each Cypher through `brainCall()`, a direct `fetch` to `getBrainUrl() + '/mcp'`. No require of part8-egress-guard anywhere in the script. The only link to the guard is the comment "tests/test-246-census-guard.cjs proves every string classifies allow".
  implication: explains why the live --lane-a/--lane-b run still succeeds today: runtime is independent of classify(). Also means the test's old "allow" pin protected a property the census runtime never used; its real value was as a vocabulary-regression tripwire for the model-issued path.
- timestamp: 2026-10-01T12:00:00Z
  id: E6
  checked: lib/core/brain-client.cjs query() (line 920) and callTool() belt (line 607), `_typedFreeformGate` (line 1078, ask/search/smartSearch only), scripts/part8-egress-guard-hook.cjs ambiguous branch (line 272); plus a hook subprocess probe (PART8_FORCE_BRAIN_AVAILABLE=1, cwd outside any room) of census-shaped and introspection Cypher across three scopes, before (8f87980e5^) and after (8f87980e5).
  found: (a) brain-client query() blocks ONLY on verdict `block`; its own comment says ambiguous Cypher "is EXPECTED policy here ... deliberately NOT blocked". callTool's belt discloses-and-proceeds on ambiguous. `_typedFreeformGate` does not cover brain_query. (b) Hook exit codes, pre -> post: `mcp__plugin_mos_mindrian-brain__brain_query` 0 -> 0, `mcp__mindrian-brain__brain_query` 0 -> 0, `mcp__pws-brain-mcp__brain_query` 0 -> 2 (Shape F.1 "this may leak freeform_unproven" gate). Shim-backed scopes pass because 354-06 added freeform_unproven to SHIM_BACKED_AMBIGUOUS_ALLOW_CLASSES; the direct connector is not shim-backed (260917-ild).
  implication: on every scope this plugin registers, behavior is unchanged. The only live behavior change is on the user-registered direct connector scope, where introspection Cypher that quick 260807-h5s deliberately unblocked is now gated again. That is the genuine policy residual (Decision D-1).
- timestamp: 2026-10-01T12:00:00Z
  id: E7
  checked: `bash tests/run-all-245.sh` (PASS=16 FAIL=3).
  found: test-245-brain-envelope-shape.cjs fails at CLAIM (c) line 365 ("a content-free label census must classify as allow") with the identical `ambiguous / freeform_unproven` verdict, for `MATCH (n) RETURN labels(n) AS labels, count(*) AS c`. Passes at 8f87980e5^.
  implication: same root cause, same stale-expectation class, second file. A fix scoped to test-246 alone leaves run-all-245 red on this claim.
- timestamp: 2026-10-01T12:00:00Z
  id: E8
  checked: the other two run-all-245 reds, test-245-egress-contentless.cjs and test-245-tiebreak-deterministic.cjs.
  found: DIFFERENT causes. (1) egress-contentless fixture `{question:'lean startup methodology'}` expects ambiguous/freeform_unproven but now gets allow/typed_question, because data/framework-names.json was regenerated by f55f004f6 (data(355-08), 2026-09-24) and now contains canonical phrase `lean startup`, so every token is closed-vocabulary. (2) tiebreak-deterministic throws "FIXTURE DRIFT: SENS-08 is no longer a SENS_PRIORITY member", unrelated to Part 8.
  implication: out of scope for this session. Flagged so they are not mistaken for this defect. (1) is itself a test-fixture-drift finding worth its own quick task: the fixture should use a phrase that is not a canonical framework name.

## Technical Root Cause

- Site: lib/core/part8-egress-guard.cjs:777-830 function `classify` (step 3) calling `_proveTypedQuestion` (lines 686-715), introduced by 8f87980e5.
- Cause: step 3 treats the `cypher` argument of brain_query as a free-form natural-language string and allows only a string whose every token is in a closed natural-language vocabulary. A Cypher statement always contains tokens outside it (MATCH, RETURN, variable names), so it is never "proven", and `METHODOLOGY_VOCAB.test` then yields `freeform_unproven`. Before 8f87980e5 the same step allowed on bare keyword presence (`Framework`, `count`, `labels`), which is the laundering hole 354-06 closed.
- Why it surfaces now: 354-06 (2026-09-23) updated four sibling tests but not tests/test-246-census-guard.cjs or tests/test-245-brain-envelope-shape.cjs claim (c); the 246 and 245 runners were not part of its verify chain (it ran test-239 and test-257). The first full 246 run after that date surfaces it.
- Classification: STALE TEST EXPECTATION against an INTENTIONAL guard change. NOT a guard regression. Not an environment gap.
- Canon Part 8 stance: nothing here loosens the boundary. The default-deny CONTENT-SET scan (step 1) is untouched and still reports no hit for all 15 census strings. No room or user bytes are involved: every CENSUS_QUERIES string is a static literal with no interpolation.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Decision D-1 (HUMAN, blocks everything below): the two recorded decisions conflict for model-issued introspection Cypher on a DIRECT connector scope.
  - 260807-h5s (2026-08-07): content-free graph introspection must classify allow so it is never gated.
  - D-354-EGR (354-06, 2026-09-23): "generic" means structurally proven; free-form Cypher is only a bounded residual, plan 354-06 line 53 said brain_query "stays on its current path". Enforcement did stay (query() and callTool still proceed on ambiguous), but the CLASSIFICATION changed as a side effect of the shared step 3.
  - Option A (RECOMMENDED, no guard change): accept ambiguous/freeform_unproven for Cypher. Re-pin test-246 and test-245-brain-envelope-shape claim (c) to the post-354-06 contract. Live behavior on both plugin-registered scopes is unchanged (E6). The direct-connector scope keeps its Shape F.1 gate, which is the fail-closed posture 260917-ild chose for a route with no local code in its path.
  - Option B (guard widening, NOT recommended without explicit approval): add an exact byte-match known-shape arm in `_proveKnownToolShape` for brain_query allowing only the CENSUS_QUERIES literals and the h5s introspection literals. Restores allow, but adds a Part 8 allow surface, couples the guard to the census list, and any edit to a census string silently re-gates. Must go through separate Part 8 review (RCA-TEMPLATE gate 1).
  - Option C: retire the allow pin without replacement. Rejected: loses the vocabulary-regression tripwire.
- Change 1 (Option A):
  - Location: tests/test-246-census-guard.cjs, whole body (one `main()` loop)
  - Current behavior: asserts `verdict === 'allow'` and `class !== 'freeform_unmatched'` per census query.
  - Required behavior: per query assert (1) `guard.scanForContent({cypher}).hit === false`, (2) classify verdict is not `block`, (3) class is not `freeform_unmatched` (kept, explicit), (4) verdict is `ambiguous` with class `freeform_unproven` (pins the documented D-354-EGR contract so a future widen or narrow forces a conscious review), (5) the PreToolUse hook on the shim-backed plugin scope exits 0 (live disposition), and once after the loop (6) a negative control: Cypher with an embedded email literal classifies `block`, so the test can fail. Update the header comment to cite 8f87980e5 and state that the census builder never calls classify().
  - Short-term patch: the above, about 60 changed lines in one file. A working prototype was run from the session scratchpad against the live guard: PASS, 105 assertions over 15 census queries, zero em-dashes. The same file run against the 8f87980e5^ guard FAILS at check (4) (verdict was allow/move_set), proving the pin can detect a change in either direction.
  - Long-term fix: none needed on the guard side under Option A.
- Change 2 (Option A):
  - Location: tests/test-245-brain-envelope-shape.cjs, `claimC()` lines 361-392 (the label-census and `CALL db.schema.nodeTypeProperties()` assertions at 361-382)
  - Current behavior: asserts `allow` for `MATCH (n) RETURN labels(n) AS labels, count(*) AS c` and for `CALL db.schema.nodeTypeProperties()`.
  - Required behavior: assert verdict is not `block`, class is not `freeform_unmatched`, and (matching Change 1) ambiguous/freeform_unproven; keep the brain_search recognizer assertions and the `lean startup methodology` assertion exactly as they are (that last one is the separate E8 drift, do not touch it here). `CALL db.schema.nodeTypeProperties()` was checked empirically: it also classifies ambiguous/freeform_unproven today.
  - Short-term patch: edit only lines 361-382.
- Change 3 (comment hygiene, no behavior):
  - Location: scripts/build-brain-census.cjs lines 22-25 and 1013-1019
  - Current behavior: comments say the test "proves every string classifies allow" and "pins all 13 query ids as Part 8 allow-classified".
  - Required behavior: reword to "proves every string is content-free at the Part 8 boundary (no CONTENT-SET hit, never block); the census itself POSTs via brainCall() and never consults classify()". Comment-only; skip if the human prefers a zero-touch census script.

## Tests to Add or Update

- Test 1:
  - Type: unit + hook subprocess
  - Location: tests/test-246-census-guard.cjs
  - Given: the 15 CENSUS_QUERIES strings and the shim-backed plugin tool name
  - When: scanForContent, classify, and the PreToolUse hook run on each
  - Then: no CONTENT-SET hit, never block, never freeform_unmatched, exactly ambiguous/freeform_unproven, hook exit 0; negative control (embedded email literal) blocks
  - Runner registration: already globbed by tests/run-all-246.sh (tests/test-246-*), no edit
- Test 2:
  - Type: unit
  - Location: tests/test-245-brain-envelope-shape.cjs claimC()
  - Given: the label census and schema introspection Cypher
  - When: classify runs with the plugin-scoped brain_query name
  - Then: same re-pinned contract as Test 1
  - Runner registration: already globbed by tests/run-all-245.sh
- Not in scope: test-245-egress-contentless (lean startup fixture drift, E8) and test-245-tiebreak-deterministic (SENS-08 drift, E8).

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- Canon Part 8 gate: no Brain wire touched, no user bytes reach the Brain (all probes offline, all census strings static literals). Under Option B this gate becomes live and requires separate review.
- Tri-Polar gate: classifier is surface-agnostic. Verified by construction for CLI, Desktop and Cowork (shim-backed plugin scope and project scope both exit 0 in E6). Direct-connector scope behavior is the Decision D-1 residual.
- Cross-platform: tests use only node assert, child_process.spawnSync with process.execPath and os.tmpdir(); no shell, no paths. Linux-verified, expected identical on Windows and Mac but not run there.
- Release lockstep: test-only change under Option A, no version bump needed. CHANGELOG entry optional (Fixed: re-pin two Part 8 census tests to D-354-EGR contract).
- Reuse before build (Canon Part 7): no new surface added; edits extend two existing tests.
- Process note: the 354-06 verify chain missed the 246 and 245 runners. Suggest the phase 354 verifier or a quick task add `bash tests/run-all-245.sh` and `bash tests/run-all-246.sh` to the Part 8 guard-edit checklist, since both pin classify() verdicts.
- knowledge-base.md: on resolve, add the summary block (slug census-guard-framework-count-ambiguous, patterns: freeform_unproven, ambiguous, census, cypher, classify, 354-06, test-246).
- E8 follow-ups (separate quick tasks): lean startup fixture drift after f55f004f6; SENS-08 FIXTURE DRIFT in test-245-tiebreak-deterministic.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Commit 8f87980e5 (354-06, D-354-EGR) intentionally narrowed classify() step 3 so a free-form string is allowed only if every token is closed natural-language vocabulary; the `cypher` key rides that path, so every census Cypher string now classifies ambiguous/freeform_unproven instead of allow/move_set. tests/test-246-census-guard.cjs (and claim (c) of tests/test-245-brain-envelope-shape.cjs) were not updated by that commit and are stale. The census script never calls classify() (direct fetch), which is why the live run still works.
fix: PENDING human decision D-1. Recommended Option A (re-pin the two tests, guard untouched). No repo file other than this debug file has been modified.
verification: delta run: test-246 PASS at 8f87980e5^, FAIL at 8f87980e5 (15 of 15). Prototype re-pinned test-246 (scratchpad only, not applied): PASS 105 assertions on the current guard, FAIL on the 8f87980e5^ guard. Hook probe E6 shows exit codes unchanged on both plugin-registered scopes.
files_changed: []
commits: []
