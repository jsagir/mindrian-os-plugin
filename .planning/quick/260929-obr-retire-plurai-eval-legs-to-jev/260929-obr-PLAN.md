---
phase: quick-260929-obr-retire-plurai-eval-legs-to-jev
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/helpers/jev-gold-card-leg.cjs
  - tests/test-211-jev-leg-contract.cjs
  - tests/test-211-judge-gate.cjs
  - tests/test-211-jev-judge-leg.cjs
  - tests/test-212-plurai-leg.cjs
  - tests/test-212-jev-leg.cjs
  - tests/run-all-211.sh
  - tests/run-all-212.sh
  - evals/plurai/211-baseline.json
  - evals/plurai/212-baseline.json
  - lab/eval/report-from-transcript.cjs
  - tests/test-eval-report-from-transcript.cjs
  - tests/run-all-192.sh
  - tests/run-all-203.sh
  - evals/plurai/README.md
  - docs/PLURAI-USAGE-AND-QA-REPORT.md
  - lab/plurai-suite/suite-manifest.cjs
autonomous: true
requirements: [QUICK-260929-obr]

must_haves:
  truths:
    - "No .cjs/.js/.sh file in the repo can make a network call to Plurai: git grep for run.plurai.ai, PLURAI_API_KEY and PLURAI_RUN_BASE across *.cjs *.js *.sh returns nothing"
    - "Running bash tests/run-all-211.sh twice and bash tests/run-all-212.sh once leaves git status --porcelain -- evals/plurai/ empty (no test rewrites a tracked baseline)"
    - "With a Jev key, the 211 live leg sends the two synthetic gold-card pairings to Jev through the usefulness_judge profile + makeUsefulnessCeiling guard and passes (transferable -> useful|already_known, unrelated -> not_useful|none)"
    - "Without a Jev key the live Jev legs exit 77 and run-all-211/212 print SKIPPED (ENV GAP), never PASSED"
    - "lab/eval/report-from-transcript.cjs never fetches; its three network judges report SKIPPED with a named plurai-retired reason, and the deterministic voice-signature still scores"
    - "run-all-192.sh and run-all-203.sh report the retired live-judge leg as an explicit, counted SKIPPED line with a reason"
    - "evals/plurai/README.md and docs/PLURAI-USAGE-AND-QA-REPORT.md state plurai is retired (2026-09-29, HTTP 404) and Jev is the live judge; CSVs and offline gates are unchanged and part8-egress-guard.test + agentshield-scanner.test still pass"
  artifacts:
    - path: "tests/helpers/jev-gold-card-leg.cjs"
      provides: "Shared Jev gold-card judge leg (usefulness_judge over synthetic pairs), exit contract 0/1/77, zero file writes"
      exports: ["PAIR_IDS", "CONNECTION_CHOICES", "NO_CONNECTION_CHOICES", "buildGoldPairs", "buildBody", "buildGuard", "runGoldCardJevLeg", "main"]
    - path: "tests/test-211-jev-leg-contract.cjs"
      provides: "Offline contract test for the helper (stubbed fetch, net guard, baseline bytes unchanged)"
    - path: "tests/test-211-jev-judge-leg.cjs"
      provides: "Live key-gated 211 Jev leg (both pairs)"
    - path: "tests/test-212-jev-leg.cjs"
      provides: "Live key-gated optional 212 Jev leg (transferable pair), git-mv'd from test-212-plurai-leg.cjs"
    - path: "evals/plurai/README.md"
      provides: "Retirement statement: CSVs are vendor-neutral golden fixtures, live judge is Jev"
      contains: "Jev"
  key_links:
    - from: "tests/helpers/jev-gold-card-leg.cjs"
      to: "scripts/jev-devtime-client.cjs + scripts/jev-question-ceilings.cjs"
      via: "jev(body, { guard: makeUsefulnessCeiling(pairMap), key })"
      pattern: "makeUsefulnessCeiling"
    - from: "tests/run-all-211.sh"
      to: "tests/test-211-jev-judge-leg.cjs"
      via: "run_if leg, run() maps exit 77 to SKIPPED (ENV GAP)"
      pattern: "-eq 77"
    - from: "tests/run-all-212.sh"
      to: "tests/test-212-jev-leg.cjs"
      via: "run_if leg, run() maps exit 77 to SKIPPED (ENV GAP)"
      pattern: "test-212-jev-leg"
---

<objective>
Retire every LIVE Plurai network call in MindrianOS-Plugin evals and route live eval judging through Jev (TypeSafe). Navigator directive 2026-09-29: "evals using jev not plurai". The hosted Plurai endpoint is dead (HTTP 404 on POST /ioa/v1/cross-topic-connection/1.0.0), and the 211 leg rewrites the tracked evals/plurai/211-baseline.json "date" on every run.

Purpose: stop a dead vendor from making network calls, stop test runs from dirtying tracked files, and give the gold-card judge a working live judge (Jev) that reports SKIPPED (exit 77), never PASSED, when no key exists.
Output: one shared Jev gold-card leg helper + its offline contract test, rewired 211/212 legs and harnesses, an offline-only report-from-transcript, counted SKIPPED lines in run-all-192/203, retirement docs.

Locked scope (orchestrator): replace a live Plurai judge with Jev where the Jev equivalent is straightforward, otherwise retire the leg with an explicit SKIPPED + reason. KEEP the offline deterministic gates (lib/core/*-gate.cjs, scripts/189-plurai-gate-check.cjs, scripts/198-plurai-gate-check.cjs) and the golden CSVs in evals/plurai/*.csv. Do NOT rename evals/plurai/. OUT of scope: porting all 13 golden suites to Jev live judging (record as a follow-on in the SUMMARY only).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.claude/skills/spike-findings-MindrianOS-Plugin/SKILL.md
@evals/plurai/README.md
@tests/test-211-judge-gate.cjs
@tests/test-212-plurai-leg.cjs
@scripts/judge-355-usefulness.cjs (lines 213-285 only: runJudge body construction, status handling, parseJevResponse use)

## Classification of every `git grep -n -i plurai -- ':!.planning'` hit (done at plan time; record this table in the SUMMARY)

| Class | Files | Action |
|-------|-------|--------|
| LIVE-CALL + baseline writer | tests/test-211-judge-gate.cjs (Test B, writes evals/plurai/211-baseline.json every run), tests/test-212-plurai-leg.cjs (writes evals/plurai/212-baseline.json every run) | Replace with Jev (Tasks 1-2) |
| LIVE-CALL (tool) | lab/eval/report-from-transcript.cjs (callJudge POSTs to run.plurai.ai for 4 judges over scrubbed tester transcripts) | Retire network judges (Task 3). Jev port NOT allowed: the Jev egress ruling (spike skill Requirements) permits structure only, zero user text; tester transcripts are user text even when scrubbed |
| DEFERRED echo legs (uncounted) | tests/run-all-192.sh (192-04), tests/run-all-203.sh (203-04) | Explicit counted SKIPPED + reason (Task 3) |
| OFFLINE-GATE (keep) | scripts/189-plurai-gate-check.cjs, scripts/198-plurai-gate-check.cjs, lib/core/{card-fire,ignite-branch,ralph-loop,rs-corpus-quality,statusline-liveness,synthetic-expert-construction,synthetic-expert-behavior}-gate.cjs, lib/core/part8-egress-guard(.test).cjs, lib/core/security/agentshield-scanner.test.cjs (read the CSVs), tests/test-200..209 gate tests, tests/test-statusline-liveness-gate.cjs, run-all-196/198/200/201/202/209 labels | Untouched |
| DECLARATION (never fired, `live_mutation_fired: false`) | lab/plurai-suite/{judges,suite-manifest,golden-loader}.cjs, tests/test-205-plurai-suite.cjs | One header comment in suite-manifest.cjs (Task 3), otherwise untouched |
| COMMENT | lib/core/cross-room-aggregator.cjs, lib/core/eureka/entity-classifier.cjs, lab/eval/voice-mark-hybrid.cjs, scripts/eureka-critic-run.cjs, scripts/eureka-portfolio-report.cjs, scripts/eureka-room-report.cjs, run-all-215/218 | Untouched |
| HISTORICAL DATA/DOC | evals/plurai/{189..209}-baseline.json, evals/eureka/211-room-report.md, evals/eureka/212-calibration-report.md, CHANGELOG.md, docs/2026-09-24-HANDOFF-*.md, docs/reviews/phase-354-close-out.md, .gitignore | Untouched (211/212 baselines get a retirement stamp in Task 2) |

## Jev interfaces the executor uses (already exist, do not modify)

- scripts/jev-devtime-client.cjs exports { DEFAULT_ENDPOINT, loadKey, makeEgressGuard, jev, pool, EGRESS_PROFILES }. loadKey(opts) reads opts.env (default process.env) TYPESAFE_API_KEY, else ~/.secrets/typesafe.env (opts.secretsPath overrides; os.homedir() honors HOME), returns null when absent. jev(body, { guard, key, fetchImpl, sleepImpl, timeoutMs, honorRetryAfter }) refuses without a guard, calls guard(body) first, resolves fetchImpl at call time (default globalThis.fetch), retries a thrown fetch 3 times then returns { status: 0 }, retries 429/529, and returns { status, ms, json, text }. It calls r.text() and r.headers.get('retry-after'), so a stub response needs status, text() and headers.get(). Dev-time only: never require it from lib/ or hooks/ (tests/ and tests/helpers/ are fine).
- scripts/jev-question-ceilings.cjs exports PINNED_MODEL ('jev-1.13.0'), USEFULNESS_QUESTIONS (frozen question id `usefulness`, choice criteria useful / not_useful / already_known / none) and makeUsefulnessCeiling(pairMap), where pairMap is a Map of pair_id -> { a_excerpt, b_excerpt, direction_phrase }. The ceiling composes EGRESS_PROFILES.usefulness_judge (state keys exactly a_excerpt, b_excerpt, direction_phrase, verification; a_excerpt/b_excerpt max 2400 chars, direction_phrase max 80, verification max 16) with a closure requiring verification in {strong, indirect, unverified}, the excerpts + direction_phrase byte-equal to some pairMap entry, and questions deep-equal USEFULNESS_QUESTIONS. Any violation throws.
- scripts/jev-response-schema.cjs exports parseJevResponse(res, { usefulness: [4 options] }) which never throws and returns { ok: true, model, answers, usage } or { ok: false, reason } (non-200, schema miss, choice outside criteria, probability keys differ, probabilities not summing to 1 within 0.02, model other than jev-1.13.0). A valid 200 json is { model: 'jev-1.13.0', answers: { usefulness: { type: 'choice', choice, probabilities: {useful, not_useful, already_known, none}, confidence } }, usage: { input_tokens, output_tokens } }.
- lib/core/direction-convention.cjs exports DIRECTION_MEANING; DIRECTION_MEANING.structural_transfer === 'same meaning in different words'.
- tests/helpers/hygiene-355.cjs exports scrubVendorKey() and installNetGuard() -> { attempts(), restore() } (replaces globalThis.fetch with a thrower).
- Gold cards (synthetic by construction, no real names, enforced by tests/test-211-case-cards.cjs) are read with gray-matter from evals/eureka/cases/<stem>.md frontmatter fields hypothesis_in and destination. Measured at plan time: archimedes-darkmatter 187/343 chars, davinci-salient 209/188, lovelace-lean 188/271, none carries a K/M/B figure. Do NOT use nichefoods-null: its figure trips the Part 8 egress guard (see the Test A3 comment in tests/test-211-judge-gate.cjs).

## Harness exit-code house pattern (copy from tests/run-all-354.sh lines 28-41)

run() runs "$@", captures status=$?, then: 0 -> ">>> $label: PASSED" PASS+1; 77 -> ">>> $label: SKIPPED (ENV GAP)" SKIP+1; anything else -> ">>> $label: FAILED" FAIL+1. All four harnesses touched here use `set -uo pipefail` (no -e), so the status capture is safe.

## Concurrency rules (a Phase 363 executor shares this working tree RIGHT NOW)

- Touch NO file under .planning/phases/363-*, tests/run-all-363.sh, or tests/*363*. Do NOT write .planning/STATE.md (the orchestrator records this quick task later).
- Stage and commit ONLY this plan's own paths: `git add <explicit paths>` then `git commit --only <explicit paths> -m ...`. Never `git add -A`, never `git add .`, never `gsd-tools query commit` (it sweeps the whole index). For the rename, list both the old and new path.
- After each commit run `git merge-base --is-ancestor <sha> HEAD` and confirm success (a peer reset has orphaned commits before). Never revert or stage a diff you do not own; if `git status` shows unrelated modified files, leave them alone.
- evals/plurai/211-baseline.json is already dirty (pure date noise from the live writer). Restore it with `git checkout -- evals/plurai/211-baseline.json` ONLY AFTER Task 2 removes the writer (same for 212-baseline.json if the before-count run dirties it).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Shared Jev gold-card leg helper + offline contract test (capture before-counts first)</name>
  <files>tests/helpers/jev-gold-card-leg.cjs, tests/test-211-jev-leg-contract.cjs</files>
  <behavior>
    - C1 no key (key resolved via loadKey with env {} and a nonexistent secretsPath): runGoldCardJevLeg returns code 77, fetch stub called 0 times, one line starting "SKIPPED (ENV GAP)" naming TYPESAFE_API_KEY and ~/.secrets/typesafe.env
    - C2 stub answers useful for the darkmatter pair and not_useful for the davinci/lovelace pair: code 0, exactly 2 fetch calls, every sent body has model jev-1.13.0, state.verification 'unverified', state.direction_phrase 'same meaning in different words', questions deep-equal USEFULNESS_QUESTIONS
    - C3 transferable answered already_known: code 0 (both useful and already_known mean a real connection)
    - C4 transferable answered not_useful: code 1, a line names the pair, the choice and the confidence
    - C5 unrelated answered useful: code 1
    - C6 fetch throws every attempt (sleepImpl no-op): code 77 with reason vendor unreachable
    - C7 HTTP 503: code 77; HTTP 401: code 77 with reason key rejected
    - C8 HTTP 400: code 1 (malformed payload is our own defect, per judge-355 precedent)
    - C9 HTTP 404: code 1 (a vanished endpoint must be LOUD; the Plurai 404 was silently deferred for weeks)
    - C10 200 with model jev-1.14.0: code 1 (model drift via parseJevResponse)
    - C11 buildGuard(pairMap) throws when called on a body whose a_excerpt differs by one character from the gold-card text
    - C12 with key 'sk-test-SECRET-123', no returned line contains that string
    - C13 sha256 of every evals/plurai/*.json is identical before and after all cases; installNetGuard().attempts() === 0 at the end
  </behavior>
  <action>
Step 0 (before any edit): capture pre-existing counts into .planning/quick/260929-obr-retire-plurai-eval-legs-to-jev/before-counts.txt (gitignored, not committed) by running each of these and appending its final summary line plus exit code: bash tests/run-all-211.sh, bash tests/run-all-212.sh, bash tests/run-all-192.sh, bash tests/run-all-203.sh, node tests/test-eval-report-from-transcript.cjs, node tests/test-205-plurai-suite.cjs, node lib/core/part8-egress-guard.test.cjs, node lib/core/security/agentshield-scanner.test.cjs. These runs make the old live Plurai calls (status quo) and may re-dirty 211-baseline.json and dirty 212-baseline.json with date noise; that is expected and is cleaned up in Task 2. If a count differs later because of Phase 363 peer work (for example run-all-192's born-wired gate), classify it as not-ours in the SUMMARY rather than fixing it.

RED: write tests/test-211-jev-leg-contract.cjs first, covering behaviors C1-C13 above. It requires tests/helpers/hygiene-355.cjs FIRST and calls scrubVendorKey() and installNetGuard() before requiring any repo module, then passes a stub fetchImpl (recording url, headers and parsed body per call, returning { status, text: async () => JSON string, headers: { get: () => null } }) and a no-op sleepImpl into runGoldCardJevLeg. Map stub answers by matching the sent state.a_excerpt against the darkmatter vs davinci gold-card text. Build valid 200 bodies with all four probability keys summing to 1. Use a tiny ok()/PASS/FAIL accumulator like test-211-judge-gate.cjs; print "Phase 211 jev-leg contract: PASS=n FAIL=m" and exit 0 only when FAIL is 0. Run it and confirm it fails because the helper does not exist yet.

GREEN: create tests/helpers/jev-gold-card-leg.cjs (CJS, 'use strict', BSL header, no em-dashes). It replaces the dead Plurai cross-topic-connection judge with Jev's usefulness_judge seat, reusing the 355 judge machinery (Part 7 reuse, no hand-rolled REST client). Requirements:
- PAIR_IDS frozen ['transferable_darkmatter', 'unrelated_davinci_lovelace']. buildGoldPairs(pairIds) reads the gold cards with gray-matter and returns a Map pair_id -> { a_excerpt, b_excerpt, direction_phrase, expect }: transferable_darkmatter = archimedes-darkmatter hypothesis_in vs archimedes-darkmatter destination, expect 'connection'; unrelated_davinci_lovelace = davinci-salient hypothesis_in vs lovelace-lean destination, expect 'no_connection' (not nichefoods, see context). direction_phrase is DIRECTION_MEANING.structural_transfer for both (the claimed transfer being judged). Throw on an unknown pair id.
- CONNECTION_CHOICES frozen ['useful', 'already_known']; NO_CONNECTION_CHOICES frozen ['not_useful', 'none']. This maps the retired Plurai ladder: Hedged|Confident -> connection set, No Connection -> no-connection set.
- buildBody(pair) returns { model: Q.PINNED_MODEL, state: { a_excerpt, b_excerpt, direction_phrase, verification: 'unverified' }, questions: Q.USEFULNESS_QUESTIONS }. verification is 'unverified' because gold cards carry no verification stamp and the ceiling accepts only the three stamp tier words.
- buildGuard(pairMap) returns Q.makeUsefulnessCeiling over a Map of exactly the requested pairs' { a_excerpt, b_excerpt, direction_phrase }.
- runGoldCardJevLeg({ pairIds, key, env, secretsPath, fetchImpl, sleepImpl }) resolves the key as opts.key when the property is present, else loadKey({ env, secretsPath }). No key -> { code: 77, lines: ['SKIPPED (ENV GAP): no TYPESAFE_API_KEY (env or ~/.secrets/typesafe.env); the Jev gold-card judge did not run and is never reported as PASSED'] } with zero fetch calls. Otherwise judge each pair sequentially with jev(body, { guard, key, fetchImpl, sleepImpl, timeoutMs: 15000, honorRetryAfter: true }). Per-pair outcome: status 0 -> SKIP 'vendor unreachable'; 401 or 403 -> SKIP 'key rejected (HTTP n)'; 429, 529 or any 5xx -> SKIP 'vendor unavailable (HTTP n)'; 400 or 422 -> FAIL 'malformed payload (our defect)'; any other non-200 (including 404) -> FAIL 'unexpected HTTP n (endpoint contract changed)'; 200 -> parseJevResponse(res, { usefulness: ['useful','not_useful','already_known','none'] }), !ok -> FAIL with parsed.reason; then FAIL when an expect 'connection' choice is outside CONNECTION_CHOICES or an expect 'no_connection' choice is outside NO_CONNECTION_CHOICES, else PASS. Each outcome pushes a line "ok   <pair_id>: <choice> (confidence x.xx)" or "FAIL <pair_id>: ..." or "SKIP <pair_id>: ...". Aggregate code: any FAIL -> 1, else any SKIP -> 77, else 0. Return { code, lines, results }.
- main(pairIds) prints a one-line banner (which pairs, "live Jev usefulness_judge, synthetic gold-card text only, Part 8"), runs the leg with default opts, prints every line and a final "Jev gold-card leg: PASS=a FAIL=b SKIP=c (exit code)" line, and resolves to the code. It never prints the key.
- The module writes NO file of any kind (no fs write/append/rename calls) and contains no Plurai reference on a non-comment line. It must stay out of lib/ and hooks/ (tests/test-353-tripwires.cjs bans the vendor there).
Run the contract test until green.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-211-jev-leg-contract.cjs && test "$(grep -v -E '^\s*(//|\*|/\*)' tests/helpers/jev-gold-card-leg.cjs | grep -c -i -E 'writeFileSync|appendFileSync|renameSync|writeJsonAtomic|plurai')" = 0 && ! grep -n $'\xe2\x80\x94' tests/helpers/jev-gold-card-leg.cjs tests/test-211-jev-leg-contract.cjs</automated>
  </verify>
  <done>before-counts.txt exists with 8 captured summary lines; the contract test prints FAIL=0 with all 13 behaviors covered and zero global fetch attempts; the helper has no file-write calls and no Plurai reference outside comments; both files committed via explicit-path git commit --only, sha confirmed ancestor of HEAD.</done>
</task>

<task type="auto">
  <name>Task 2: Rewire the 211/212 legs to Jev, add exit-77 handling to their harnesses, retire-stamp and restore the baselines</name>
  <files>tests/test-211-judge-gate.cjs, tests/test-211-jev-judge-leg.cjs, tests/test-212-plurai-leg.cjs, tests/test-212-jev-leg.cjs, tests/run-all-211.sh, tests/run-all-212.sh, evals/plurai/211-baseline.json, evals/plurai/212-baseline.json</files>
  <action>
1. tests/test-211-judge-gate.cjs: delete Test B, resolvePluraiKey, writeDeferredBaseline, BASELINE_PATH and the require of lab/eval/report-from-transcript.cjs, so the file is the offline directional contract only (Tests A1-A3 unchanged, zero network, writes nothing). Rewrite the header block: Test B moved to tests/test-211-jev-judge-leg.cjs; the live judge is now Jev (usefulness_judge) because Plurai was retired 2026-09-29 (hosted endpoint HTTP 404). Keep the Part 8 paragraph (synthetic gold-card text only, never the room database).
2. Create tests/test-211-jev-judge-leg.cjs: thin live leg. Header states: live, key-gated; Jev replaces the retired Plurai cross-topic-connection judge; only synthetic gold-card text egresses (Part 8 + spike-skill IP egress ruling); exit 0 PASS, 1 FAIL, 77 SKIPPED (ENV GAP) when no key or vendor unreachable, never PASSED; writes no baseline. Body: require the helper and exit with the code from main(['transferable_darkmatter', 'unrelated_davinci_lovelace']), catching a rejection as exit 1 with the error message printed.
3. Run `git mv tests/test-212-plurai-leg.cjs tests/test-212-jev-leg.cjs`, then rewrite it as the same thin shape with main(['transferable_darkmatter']). Keep its header's navigator Q3 lock semantics (the local two-stage critic is the core Grounding Guard; this is a separately gated calibration signal) and replace every Plurai statement with the Jev one plus the retirement note.
4. tests/run-all-211.sh and tests/run-all-212.sh: replace run() with the tests/run-all-354.sh exit-77 pattern (PASSED / SKIPPED (ENV GAP) / FAILED). In run-all-211 relabel leg (5) to "211-05 judge gate (offline directional contract)", then add two run_if legs right after it: "211 Jev gold-card leg contract (offline, stubbed)" -> node tests/test-211-jev-leg-contract.cjs, and "211 Jev gold-card judge (live, key-gated; 77 = ENV GAP)" -> node tests/test-211-jev-judge-leg.cjs. In run-all-212 replace the optional Plurai leg with "212-04 optional Jev gold-card leg (live, key-gated; 77 = ENV GAP)" -> node tests/test-212-jev-leg.cjs. Update both header comment blocks: the EGRESS RULE paragraph now says the live judge is Jev over synthetic gold-card text only, Plurai retired 2026-09-29, no leg writes a baseline file. Hyphens only.
5. Only now that no writer remains: run `git checkout -- evals/plurai/211-baseline.json evals/plurai/212-baseline.json` (drops the date noise). Then make one deliberate edit to each JSON (keep every existing key and value, 2-space indent, trailing newline): set "status" to "retired" (211 has no status key yet, add it; 212 has "baseline_deferred", change it), and add "retired_on": "2026-09-29", "retired_reason": "Plurai hosted judge retired: POST /ioa/v1/cross-topic-connection/1.0.0 returns HTTP 404; navigator directive: evals using jev not plurai", and "superseded_by": the leg path (tests/test-211-jev-judge-leg.cjs or tests/test-212-jev-leg.cjs) plus " (Jev usefulness_judge, live, key-gated, exit 77 without a key, writes no baseline)". Validate both with node -e JSON.parse.
6. Commit with explicit paths (both rename paths, the new files, the two harnesses, the two JSONs) via git add + git commit --only, then confirm the sha is an ancestor of HEAD. After the commit run bash tests/run-all-211.sh twice and bash tests/run-all-212.sh once; `git status --porcelain -- evals/plurai/` must print nothing.
If the live Jev leg returns a genuine choice mismatch (code 1 with a 200 response), do NOT widen CONNECTION_CHOICES/NO_CONNECTION_CHOICES or drop an assertion to make it pass: stop, record the observed choice + probabilities, and return a checkpoint to the orchestrator classifying it as a NEW FAILURE.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-211-judge-gate.cjs && (env -u TYPESAFE_API_KEY HOME="$(mktemp -d)" node tests/test-211-jev-judge-leg.cjs; test $? -eq 77) && (env -u TYPESAFE_API_KEY HOME="$(mktemp -d)" node tests/test-212-jev-leg.cjs; test $? -eq 77) && bash tests/run-all-211.sh && bash tests/run-all-211.sh && bash tests/run-all-212.sh && test -z "$(git status --porcelain -- evals/plurai/)" && grep -q -- '-eq 77' tests/run-all-211.sh && grep -q -- '-eq 77' tests/run-all-212.sh && test ! -e tests/test-212-plurai-leg.cjs && ! grep -n $'\xe2\x80\x94' tests/test-211-judge-gate.cjs tests/test-211-jev-judge-leg.cjs tests/test-212-jev-leg.cjs tests/run-all-211.sh tests/run-all-212.sh</automated>
  </verify>
  <done>test-211-judge-gate is offline-only (PASS=3, SKIP=0); both live legs exit 77 with no key and PASS or SKIPPED (ENV GAP) with the real key, never a silent PASS; run-all-211 and run-all-212 end with FAIL=0; evals/plurai/ is clean after two 211 runs and one 212 run; the 211/212 baselines carry the retirement stamp with all original fields intact; commit sha is an ancestor of HEAD.</done>
</task>

<task type="auto">
  <name>Task 3: Retire report-from-transcript's Plurai judges, count the 192/203 retired legs as SKIPPED, and write the retirement docs</name>
  <files>lab/eval/report-from-transcript.cjs, tests/test-eval-report-from-transcript.cjs, tests/run-all-192.sh, tests/run-all-203.sh, evals/plurai/README.md, docs/PLURAI-USAGE-AND-QA-REPORT.md, lab/plurai-suite/suite-manifest.cjs</files>
  <action>
1. lab/eval/report-from-transcript.cjs (retire, do not port: the Jev egress ruling in the spike skill allows structure only and zero user text, and tester transcripts are user text even after scrubbing). Delete RUN_BASE, VERSION, endpointUrl, buildRequestBody, parseJudgeResponse, callJudge and loadApiKey (including the PLURAI_API_KEY / ~/.config/evals/credentials.json read). Add and export a frozen string PLURAI_RETIRED_REASON = "plurai retired 2026-09-29 (hosted judge endpoint HTTP 404); live judging moved to Jev, transcript judges not ported (Jev takes structure only, never transcript text)". scoreTurn always runs the voice hybrid with llmJudge undefined (keeping the deterministic/hybrid pre-label, never inventing Wrong-Color) and always sets elevation, progress and reachgate to { label: 'SKIPPED', reason: PLURAI_RETIRED_REASON, skipped: true, retired: true }. scoreTranscript always reports offline: true and never touches fetch even if apiKey/fetchImpl are passed. main() no longer loads a key; accept --offline as a no-op for backward compatibility; when --offline is absent write one stderr NOTE line containing "retired". Update the usage text (only the deterministic voice-signature is scored; the Plurai judges are retired), the formatReport offline banner (name the retirement), and the file header WHAT/WHY block (the four slugs listed as the retired Plurai judges). Keep JUDGES (aggregate and formatReport use its titles/labels), the Part 8 scrub choke point, and every other export. Remove the deleted names from module.exports and add PLURAI_RETIRED_REASON.
2. tests/test-eval-report-from-transcript.cjs: remove the buildRequestBody/parseJudgeResponse and endpointUrl tests. Replace the "online mode with stubbed judges" and "endpoint error" tests with: (a) retired mode: scoreTranscript with apiKey 'test-key' AND a counting fetchImpl makes ZERO fetch calls, every turn's elevation/progress/reachgate label is SKIPPED with reason === mod.PLURAI_RETIRED_REASON, turn 2 voice is still Missing (deterministic), scrubStats.emails is 1, aggregate + summaryLine + formatReport render without throwing; (b) module surface: callJudge, endpointUrl, buildRequestBody and parseJudgeResponse are undefined on the module, and the source file (read with fs) has no non-comment line containing run.plurai.ai or PLURAI_API_KEY. Keep the parse, scrub, meta, offline and Part 8 advisory tests. Update its header (ZERO network by construction, Plurai judges retired).
3. tests/run-all-192.sh and tests/run-all-203.sh: replace each DEFERRED echo block (192-04 and 203-04) with an unconditional counted leg: echo the "--- ... live judge ---" label, then ">>> <label>: SKIPPED (RETIRED 2026-09-29: hosted Plurai judge retired, endpoint HTTP 404; live judging moved to Jev; porting this golden CSV to a Jev live judge is a recorded follow-on). <existing hold-the-line clause>", and increment SKIP. Rewrite the comment block above each to match. Leave every other leg and label untouched.
4. evals/plurai/README.md: add a top retirement banner under the H1 and rewrite the framing. State: (a) the CSVs are vendor-neutral hand-labeled golden fixtures kept as regression fixtures for the offline deterministic gates (name part8-egress-guard.test.cjs, agentshield-scanner.test.cjs, the lib/core/*-gate.cjs parity gates, scripts/189-plurai-gate-check.cjs and scripts/198-plurai-gate-check.cjs, which make no network call); (b) the live judge is Jev (TypeSafe) via scripts/jev-devtime-client.cjs, with the gold-card leg at tests/test-211-jev-judge-leg.cjs, exit 77 when no key; (c) Plurai is retired 2026-09-29 because the hosted endpoint returns HTTP 404 and the navigator directive is "evals using jev not plurai"; the directory keeps its name to avoid churn; (d) the deferred_note text in the per-phase *-baseline.json files that says to re-run a hosted Plurai baseline is historical. Replace the "Judge model ... fable" section with a "Live judge: Jev" section (drop the fable/start_evaluator instructions). Retitle the CSV format section (originally the Plurai AI-Judge format, kept as the house fixture format) and the table's last column header to "Judge prompt (vendor-neutral)"; leave the row cells verbatim and add one line under the table saying per-row "Judge model" and "paste into Plurai" wording is historical. In "The strategic one" add that the Plurai SLM route for SEED-019 is retired and that the Part 8 egress guard is explicitly NOT a Jev seat (spike skill context), so the local deterministic guard stays the runtime boundary. Keep the Canon Part 8 section, adjusting "a third party" wording to cover Jev (synthetic text only, structure only). Add a Provenance line for this retirement.
5. docs/PLURAI-USAGE-AND-QA-REPORT.md: insert directly under the H1 a blockquote banner: RETIRED 2026-09-29, superseded by Jev (TypeSafe); the hosted Plurai judge endpoint returns HTTP 404 on POST /ioa/v1/cross-topic-connection/1.0.0 and MindrianOS evals no longer call Plurai (navigator directive "evals using jev not plurai"); kept as a historical snapshot; current contract in evals/plurai/README.md. Do not edit the rest of the document and add no personal names.
6. lab/plurai-suite/suite-manifest.cjs: add one comment line to the header noting the hosted Plurai suite is retired (2026-09-29, superseded by Jev) and this manifest stays a never-fired declaration (live_mutation_fired: false). Comment only; no code change.
7. Commit with explicit paths via git add + git commit --only, confirm the sha is an ancestor of HEAD. Then compare every harness and test from before-counts.txt against its after run and record both in the SUMMARY (run-all-192 and run-all-203 SKIP rise by exactly 1 each, FAIL unchanged).
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-eval-report-from-transcript.cjs && node tests/test-205-plurai-suite.cjs && node lib/core/part8-egress-guard.test.cjs && node lib/core/security/agentshield-scanner.test.cjs && bash tests/run-all-192.sh && bash tests/run-all-203.sh && node lab/eval/report-from-transcript.cjs --help | grep -q -i retired && test -z "$(git grep -n -i -E 'run\.plurai\.ai|PLURAI_API_KEY|PLURAI_RUN_BASE' -- '*.cjs' '*.js' '*.sh')" && grep -q 'Jev' evals/plurai/README.md && grep -q -i 'RETIRED' docs/PLURAI-USAGE-AND-QA-REPORT.md && ! grep -n $'\xe2\x80\x94' lab/eval/report-from-transcript.cjs tests/test-eval-report-from-transcript.cjs tests/run-all-192.sh tests/run-all-203.sh evals/plurai/README.md lab/plurai-suite/suite-manifest.cjs</automated>
  </verify>
  <done>report-from-transcript makes zero fetch calls in every mode and reports the three network judges as SKIPPED with the retirement reason; its test and test-205 pass; run-all-192/203 end FAIL=0 with the retired leg counted as SKIPPED; the Plurai network grep gate over *.cjs *.js *.sh is empty; README and QA report carry the retirement statement; both guard tests still pass; no em-dashes in touched files (docs/PLURAI-USAGE-AND-QA-REPORT.md is checked only for the new banner, its pre-existing body is untouched).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test process -> api.typesafe.ai | Synthetic gold-card text and the TYPESAFE_API_KEY cross to the Jev vendor |
| test process -> tracked repo files | A test run must not mutate tracked baselines |
| lab tool -> network | report-from-transcript previously sent scrubbed tester transcripts to run.plurai.ai |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-obr-01 | Information disclosure | tests/helpers/jev-gold-card-leg.cjs egress | mitigate | Every call goes through jev() with makeUsefulnessCeiling: exact state keys, length caps, excerpts byte-equal to the gold-card pairMap, frozen question; only synthetic cards (no real names per test-211-case-cards, no K/M/B figure, nichefoods excluded). Contract test C11 proves a tampered excerpt is refused |
| T-obr-02 | Information disclosure | TYPESAFE_API_KEY handling | mitigate | Key only via loadKey (env or ~/.secrets/typesafe.env), never printed or returned in lines; contract test C12 asserts the key string never appears in output |
| T-obr-03 | Tampering | evals/plurai/*-baseline.json | mitigate | Helper and legs contain no file-write call (grep gate); contract test C13 compares sha256 before/after; git status gate after two run-all-211 runs |
| T-obr-04 | Repudiation (false success) | live Jev legs in run-all-211/212 | mitigate | No key or vendor gap exits 77 and the harness prints SKIPPED (ENV GAP), never PASSED; a 404 or schema/model drift FAILs loudly instead of silently deferring |
| T-obr-05 | Information disclosure | lab/eval/report-from-transcript.cjs | mitigate | Network client deleted; test asserts zero fetch with apiKey + fetchImpl supplied and no run.plurai.ai / PLURAI_API_KEY on non-comment lines; transcripts are not ported to Jev (structure-only ruling) |
| T-obr-06 | Denial of service | live leg latency on run-all-211 | accept | Two to three calls per run, 15 s timeout per call, bounded client retries; spike-measured p95 up to 1.2 s |
</threat_model>

<verification>
- node tests/test-211-jev-leg-contract.cjs, node tests/test-211-judge-gate.cjs, node tests/test-eval-report-from-transcript.cjs, node tests/test-205-plurai-suite.cjs all exit 0.
- bash tests/run-all-211.sh (twice), bash tests/run-all-212.sh, bash tests/run-all-192.sh, bash tests/run-all-203.sh each end FAIL=0; before/after counts recorded, differences explained (192/203 SKIP +1 each; 211 gains the contract leg + live leg; 212 swaps its optional leg).
- node lib/core/part8-egress-guard.test.cjs and node lib/core/security/agentshield-scanner.test.cjs pass.
- git status --porcelain -- evals/plurai/ is empty after the harness runs.
- git grep for run.plurai.ai, PLURAI_API_KEY, PLURAI_RUN_BASE across *.cjs *.js *.sh is empty.
- No em-dash byte sequence in any file this plan created or edited (new text only for the QA report).
- No file under .planning/phases/363-*, tests/run-all-363.sh, tests/*363*, or .planning/STATE.md was touched; every commit sha is an ancestor of HEAD.
</verification>

<success_criteria>
- Zero live Plurai network paths remain in executable code.
- The gold-card judge runs live on Jev with a key and is honestly SKIPPED (exit 77) without one.
- No test run rewrites a tracked baseline; the pre-existing 211-baseline.json date noise is gone.
- Offline gates and golden CSVs unchanged and green; evals/plurai/ not renamed.
- README and QA report state the retirement and name Jev as the live judge.
</success_criteria>

<output>
Create `.planning/quick/260929-obr-retire-plurai-eval-legs-to-jev/260929-obr-SUMMARY.md` when done. Include: the classification table from the context section (final state per file), the before/after count table from before-counts.txt, the live Jev leg result on this machine (choices + confidence, or SKIPPED reason), commit shas, and a Follow-ons section with: (1) port the 13 golden CSV suites in evals/plurai/ to Jev live judging (phase-sized, out of scope here); (2) report-from-transcript's three transcript judges (elevation, progress, reach-gate) have no Jev path under the structure-only egress ruling and would need a structure-only redesign. Do NOT write .planning/STATE.md; the orchestrator records this quick task after 363-01 finishes.
</output>
