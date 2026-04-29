---
phase: 94-v1-11-2-tester-driven-fixer
plan: "09"
subsystem: explain-decision-action-footer
tags: [explain-decision, action-footer, ui-system, canonical-glyph-vocabulary, qa-handoff-fix-8, 4-zone-rule, canon-part-3, canon-part-7, navigation-engine, decision-trace, render-trace, tdd]

# Dependency graph
requires:
  - phase: 91-navigation-engine
    provides: Plan 91-05 shipped scripts/explain-decision-command.cjs renderTrace + advisory emitters covering 9 trace fields (header + 8 brain_md_* fields + 5 structural fields + chosen_rationale + closing `---` separator); Plan 94-09 appends a tail Action Footer without modifying any of those fields
  - phase: skills/ui-system
    provides: 4-zone output anatomy (Header / Body / Signals / Footer); Section 1 Zone 4 declares "Action Footer NEVER omitted"; 2-3 grounded /mos:* commands per footer
  - phase: 94-v1-11-2-tester-driven-fixer
    provides: 94-08 u2717-cross-mark-replacement (parallel polish item -- closed canonical-vocabulary drift on commands/admin.md + commands/help.md); 94-09 closes the third of three QA handoff Section 3 P1 polish fixes (FIX-5 / FIX-7 / FIX-8)
provides:
  - "scripts/explain-decision-command.cjs new helper actionFooter() (pure function; 8 lines body) returning the canonical 5-line footer block (blank separator + 3 /mos:* command lines + trailing blank) per QA handoff Section 3 FIX-8 verbatim suggestion"
  - "actionFooter() wired into all six exit paths in main() (happy-path post-traces; empty-traces advisory; absent-trace advisory; malformed-trace advisory; no-active-room advisory; defense-in-depth catch). Every output now ends with a navigable next step per the 4-zone rule"
  - "actionFooter exported via module.exports so downstream test fixtures + future tooling can introspect the footer text without spawning the script"
  - "lib/memory/explain-decision-footer.test.cjs (NEW; 316 lines; BSL 1.1; 4 fixture tests T1-T4) covering footer presence + content + non-regression of 9 pre-94-09 markers + graceful empty-path render"
  - "lib/memory/run-feynman-tests.cjs registration with Canon Part 3 + Canon Part 7 traceability comment (19 lines added)"
affects:
  - 94-10 v1.11.2-release-gate (closes QA handoff Section 3 FIX-8 in the release narrative; one of three P1 polish items bundled into v1.11.2)
  - skills/ui-system 4-zone Action Footer rule (one fewer command violating "NEVER omitted"; the discipline holds tighter)
  - All future /mos:explain-decision users (now get a navigable next step after every audit; the audit surface is no longer a terminal dead-end)
  - lib/memory/explain-decision-command.test.cjs (Tests 1-12 Tests 1-4 marker assertions remain byte-stable; the footer is appended AT THE END after the last trace's closing `---`, not interleaved within renderTrace body)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tail-append additive rendering. When an existing render function emits a fixed prefix (header + body + separator), and a downstream rule (skills/ui-system/SKILL.md 4-zone Zone 4) requires a footer, the cheapest fix is a tail append AFTER the existing closing separator. This preserves byte-identity of the prefix output (Plan 91-05 Tests 1-12 assertions remain valid) and satisfies the new contract additively. No rewrite of renderTrace body required."
    - "Multi-exit-path footer wiring. main() has six exit paths (happy / empty-traces / absent / malformed / no-room / catch). Per the 4-zone rule (NEVER omitted), the footer must render on every exit. The pattern: extract footer to a pure-function helper (actionFooter()), call process.stdout.write(actionFooter()) immediately before each process.exit(0), so the footer is the last thing the user sees regardless of which path was taken."
    - "Pure-function helper exported for testability. actionFooter() takes no arguments, has no I/O, returns a string literal. module.exports.actionFooter exposes it so tests can introspect the footer text without spawning the script. Pattern parallel to renderTrace + classifyTier already exported by Plan 91-05."

key-files:
  created:
    - lib/memory/explain-decision-footer.test.cjs (316 lines; 4 fixture tests T1-T4; BSL 1.1; zero npm deps)
    - .planning/phases/94-v1-11-2-tester-driven-fixer/94-09-explain-decision-action-footer-SUMMARY.md (this file)
  modified:
    - scripts/explain-decision-command.cjs (+40 lines: 18-line actionFooter() helper + 7 footer-write call-sites (5 main-flow advisory paths + 1 happy path + 1 defense-in-depth catch) + 1 module.exports addition)
    - lib/memory/run-feynman-tests.cjs (+19 lines: TEST_FILES registration with Canon Part 3 + 7 traceability comment)

key-decisions:
  - "Footer text matches QA handoff Section 3 FIX-8 verbatim suggestion, modulo whitespace adjustment. The handoff suggested 'Next:  /mos:status      see room health / /mos:act         run a methodology / /mos:suggest-next  let the engine pick'. Implementation aligned the description column to a single tab-stop (3-space gap after the longest command /mos:suggest-next + 3-space description gap) for clean column alignment. The 3 commands + 3 descriptions are byte-identical to the handoff's recommendation; only the inter-column whitespace was normalized."
  - "Footer wired into ALL six exit paths in main(), not just the happy path. The plan's <action> Step 2 prescribed appending after the existing closing `---` of renderTrace(). Implementation honored that for the happy path AND extended to the five advisory exit paths (empty-traces / absent / malformed / no-room / defense-in-depth catch). Reason: the 4-zone rule from skills/ui-system/SKILL.md says 'Action Footer NEVER omitted' -- the rule applies to every output of the command, not just the happy path. Footer-on-advisory satisfies T4 of the test suite (graceful empty path) AND keeps the surface uniform across all user-visible code paths. T1+T2 cover the happy path; T4 covers the empty-traces advisory."
  - "actionFooter() is a pure-function helper, not inlined. Plan's <action> Step 2 showed an output += pattern. Implementation extracted to a named function so (a) the same footer renders identically across the 6 exit paths, (b) tests can introspect via module.exports without spawning the script, (c) future verb-vocabulary changes touch one location. The helper is 8 body lines + 10 lines of in-source documentation citing the canon parts."
  - "Footer NOT wired into the --help printHelp() path. printHelp prints command usage when the user explicitly asks for help (--help / -h flag); the help text itself describes the navigation surface. Adding a Next: footer to a help screen would be redundant and visually noisy. The 4-zone rule applies to command output; --help is a meta-surface for command discovery, not a command output. Correct scoping interpretation."
  - "renderTrace() body byte-identical to pre-94-09. The plan's must_haves declared 'existing renderTrace output BEFORE the footer is byte-identical (no regression on the 9 trace fields tested by lib/memory/explain-decision-command.test.cjs)'. The footer is appended at the END of main() AFTER the renderTrace() loop completes; renderTrace() itself is unchanged. Plan 91-05 Tests 1-12 (14/14) all pass post-94-09."
  - "T3 (non-regression byte-identical prefix) verified via marker preservation, not byte-identity. Per the plan's Step 4 fallback ('mark this test xpending if no fixture available; T3 may collapse to T1+T2'). Implementation kept T3 as a real assertion, but verified via 25 ordered markers (header / Turn / Tier Mode / 8 brain_md_* fields / 5 structural fields / Chosen rationale / closing `---` ordering) instead of comparing against a captured baseline string. This is more robust against incidental whitespace drift while still catching genuine prefix regression."

patterns-established:
  - "Pattern: 4-zone Action Footer compliance via tail append. When an existing /mos:* command violates the 'NEVER omitted' rule, the fix is a 5-line append (blank + 3 command lines + blank) AFTER the existing terminal output, NOT a rewrite of the render function. Existing tests remain byte-stable; new test suite covers the footer additively. Future commands found in violation should follow this pattern: 8-line helper + footer-write at every exit path + 4-test fixture (presence + content + non-regression + advisory-path)."
  - "Pattern: Six-exit-path uniform-footer wiring. CLI commands with multiple exit paths (happy / advisory / catch) should render the action footer at every path, not just happy. The footer is a property of the command's output contract, not of any specific code path. Helper extraction (actionFooter()) makes this trivially DRY: 6 call sites, 1 footer definition."
  - "Pattern: Verb-mapping documented inline. The footer's 3 commands map to Canon Part 3 10-verb vocabulary (status -> Synthesize, act -> Run Methodology, suggest-next -> Free-Text / Spawn Sub-Agent). Documenting the mapping in the helper's source comment makes future canon-drift detection trivial: a verb is removed from canon, the helper's mapping comment is the canonical anchor for tracing the dependency."

requirements-completed: []

# Metrics
duration: 14min
completed: 2026-04-29
---

# Phase 94 Plan 09: /mos:explain-decision Action Footer Summary

**`/mos:explain-decision` rendered output now ends with a Next: action footer offering 3 canonical /mos:* commands (status / act / suggest-next), satisfying the skills/ui-system/SKILL.md 4-zone Action Footer rule (Section 1 Zone 4 "NEVER omitted") that pre-94-09 was violated. Per QA handoff Section 3 FIX-8: the audit surface no longer terminates in a `---` separator with no navigation cue; every output path (happy + 5 advisory paths) now ends with a navigable next step. Tail-append additive fix: renderTrace() body is byte-identical to pre-94-09 (Plan 91-05 14/14 tests preserved); the footer is appended AT THE END of main() after the last trace's closing `---`. RED 4/4 -> GREEN 4/4 in ~14 minutes; +40 production lines / +335 test+registration lines / 0 production lines deleted.**

## Performance

- **Duration:** ~14 minutes (plan estimated 15-minute fix; matched)
- **Started:** 2026-04-29 11:51 UTC (commit 68a73e5 RED)
- **Completed:** 2026-04-29 12:00 UTC (commit 026adf1 GREEN)
- **Tasks:** 3 (RED + GREEN + SUMMARY)
- **Commits:** 2 atomic prior to SUMMARY (RED 68a73e5; GREEN 026adf1) + 1 docs commit (this file)
- **Files created:** 2 (1 test fixture + this SUMMARY)
- **Files modified:** 2 (scripts/explain-decision-command.cjs + lib/memory/run-feynman-tests.cjs)
- **Total diff:** +375 / -0 lines across 4 files (40 production + 316 test + 19 registration)

## QA handoff Section 3 FIX-8 closure

QA handoff evidence (pre-94-09):

```
$ node scripts/explain-decision-command.cjs | tail -5
## Chosen rationale
because

---
```

The output terminated with `---` and no Next: footer. Lawrence + the
QA harness flagged this as a 4-zone rule violation (skills/ui-system/
SKILL.md Section 1 Zone 4: "Action Footer (NEVER omitted)").

Post-94-09:

```
$ node scripts/explain-decision-command.cjs | tail -5


Next:  /mos:status         see room health
       /mos:act            run a methodology
       /mos:suggest-next   let the engine pick
```

Last 5 lines now contain the literal 'Next:' substring + 3 canonical
/mos:* command references. The QA handoff Section 3 FIX-8 acceptance
gate is satisfied:

```
$ node scripts/explain-decision-command.cjs | tail -5 | grep -qE "Next:" && echo OK
OK

$ node scripts/explain-decision-command.cjs | tail -5 | grep -c "/mos:"
3
```

## Files modified (1 production + 1 test infra + 1 runner registration)

```
scripts/explain-decision-command.cjs        +40 lines  +18-line actionFooter() helper
                                                       +7 footer-write call-sites
                                                       (5 advisory + 1 happy + 1 catch)
                                                       +1 module.exports addition
lib/memory/explain-decision-footer.test.cjs +316 lines NEW (4 fixture tests T1-T4; BSL 1.1)
lib/memory/run-feynman-tests.cjs            +19 lines  TEST_FILES registration with
                                                       Canon Part 3 + 7 traceability comment
```

Total diff: ~375 lines across 3 files. Production: 1 helper function
(actionFooter, 8 body lines + 10 doc comment lines) + 6 call-sites
across 6 exit paths. Test infra: 1 new fixture file (316 lines, 4 tests)
+ 1 runner registration block (19 lines).

## Action Footer specification (verbatim from script)

```js
function actionFooter() {
  return [
    '',
    'Next:  /mos:status         see room health',
    '       /mos:act            run a methodology',
    '       /mos:suggest-next   let the engine pick',
    '',
  ].join('\n');
}
```

The 5-line block (blank separator + 3 command lines + trailing blank)
is appended via `process.stdout.write(actionFooter())` at all seven
exit paths (six in main() + one defense-in-depth catch):

| Exit path                      | Trigger                                | Footer wired |
| ------------------------------ | -------------------------------------- | ------------ |
| 1. happy path (renderTrace)    | traces array non-empty                 | yes          |
| 2. empty-traces advisory       | traces array empty (T4 fixture)        | yes          |
| 3. absent-trace advisory       | session file missing                   | yes          |
| 4. malformed-trace advisory    | session file present but unparseable   | yes          |
| 5. no-active-room advisory     | registry.json missing or no `active`   | yes          |
| 6. defense-in-depth catch      | unhandled exception in main()          | yes          |
| --help (printHelp)             | user explicit help request             | NO (scoped)  |

Footer NOT wired into --help because that surface is a meta-help
screen describing command usage; the help text IS the navigation cue.
The 4-zone rule applies to command output, not to command discovery
surfaces.

## Test count + Feynman baseline delta

```
explain-decision-footer: 4/4 tests passed
  T1 footer presence: last 5 lines of stdout contain literal 'Next:'  PASS
  T2 footer content: at least 2 /mos: command refs in footer          PASS
  T3 non-regression: 25 existing renderTrace markers preserved        PASS
                     (Tier Mode / BRAIN.md signal / Five-Signal
                     Triangulation / Chosen rationale / closing `---`
                     ordering invariant); `---` MUST precede `Next:`
  T4 graceful empty path: footer renders on empty-traces advisory     PASS

Feynman runner: baseline +1 fixture file
  Pre-94-09 baseline:  106 fixtures (per Plan 94-06 SUMMARY)
  Post-94-09 baseline: 107 fixtures (Plan 94-09 adds explain-decision-
  footer.test.cjs)

Direct regression check (related fixtures):
  lib/memory/explain-decision-command.test.cjs  14/14 PASS (Plan 91-05)
  lib/memory/offer-presenter.test.cjs           17/17 PASS (Plan 91-04)
  lib/memory/decision-capture.test.cjs          14/14 PASS (Plan 91-02)
```

## End-to-end smoke evidence

```
$ node lib/memory/explain-decision-footer.test.cjs
ok  T1 footer presence: last 5 lines of stdout contain literal Next:
ok  T2 footer content: at least 2 /mos: command refs in footer
ok  T3 non-regression: existing renderTrace markers preserved before footer
ok  T4 graceful empty path: footer renders when no decisions yet

explain-decision-footer: 4/4 passed

$ node lib/memory/explain-decision-command.test.cjs
... (14 ok lines)
14/14 passed

$ node scripts/explain-decision-command.cjs | tail -5
       /mos:act            run a methodology
       /mos:suggest-next   let the engine pick

$ # production smoke: empty-path advisory + footer
$ MINDRIAN_ROOMS_HOME=$TMP MINDRIAN_ROOMS_ROOT=$TMP CLAUDE_SESSION_ID=empty-sid \
    node scripts/explain-decision-command.cjs
No decisions recorded for this session.
  Session: empty-sid

Next:  /mos:status         see room health
       /mos:act            run a methodology
       /mos:suggest-next   let the engine pick
```

Static verification gates:

```
$ grep -c "Next:" scripts/explain-decision-command.cjs
2

$ grep -c "/mos:status" scripts/explain-decision-command.cjs
2

$ grep -c "/mos:act" scripts/explain-decision-command.cjs
2

$ grep -c "/mos:suggest-next" scripts/explain-decision-command.cjs
2

(2 each: 1 in the inline doc comment, 1 in the actionFooter() helper string)

$ grep -cP "[\x{2014}]" scripts/explain-decision-command.cjs \
                       lib/memory/explain-decision-footer.test.cjs \
                       lib/memory/run-feynman-tests.cjs
0 across all 3 files

$ node --check scripts/explain-decision-command.cjs && echo OK
OK
```

## Canon traceability

**Canon Part 3 (Tri-Context Decision Gate, 10-verb canonical vocabulary
preserved).** Plan 94-09 introduces NO new verbs. The 3 footer commands
map cleanly into the existing 10-verb vocabulary:

| Footer command         | Canon Part 3 verb              | Why                                                                   |
| ---------------------- | ------------------------------ | --------------------------------------------------------------------- |
| /mos:status            | Synthesize                     | room-health snapshot (Shape A Mondrian Board summary)                 |
| /mos:act               | Run Methodology                | invoke a /mos:* methodology chain                                     |
| /mos:suggest-next      | Free-Text / Spawn Sub-Agent    | engine-driven recommendation; navigator picks from grounded options   |

The closed-vocabulary boundary (lib/core/skill-activation-router.cjs
validateVerb) is unchanged. The footer is a tail navigation cue that
points at existing verbs; it does not add a new dispatch surface.

**Canon Part 7 (Reuse Before Build).** Plan 94-09 extends the existing
scripts/explain-decision-command.cjs by composition: an 8-line pure-
function helper (actionFooter) is defined alongside the existing
renderTrace + classifyTier helpers and called from each exit path in
main(). renderTrace itself is byte-identical to pre-94-09. The 9 trace
fields covered by Plan 91-05's 14 fixture tests are unchanged. The
justification bar for net-new capability is met: the footer satisfies
a hard rule from skills/ui-system/SKILL.md (Section 1 Zone 4 "NEVER
omitted") that the existing renderer cannot satisfy without a tail
append. No new module; no new test framework; no new dependency.

**skills/ui-system/SKILL.md (4-zone Action Footer rule).** Section 1
Zone 4 declares: "Action Footer -- NEVER omitted. 2-3 grounded
/mos: commands." Plan 94-09 lands the footer for /mos:explain-decision
with exactly 3 grounded commands. The rule's "grounded" requirement
is satisfied because the 3 verbs are real, registered commands shipped
in the plugin (commands/status.md, commands/act.md, commands/suggest-
next.md); they are not invented placeholders. Footer also honors the
density rule: 5 lines (blank separator + 3 commands + blank), within
the >30-lines-compact-header / <10-lines-no-padding budget per Section
1 last paragraph.

## Plan deviations (locked-in)

1. **[Rule 2 - Missing critical functionality] Footer wired into ALL six exit paths, not just the happy path.** The plan's <action> Step 2 prescribed appending after the existing closing `---` of renderTrace(). Implementation honored that for the happy path AND extended to the five advisory exit paths (empty-traces / absent / malformed / no-room / defense-in-depth catch). Reason: the 4-zone rule from skills/ui-system/SKILL.md says 'Action Footer NEVER omitted' -- the rule applies to every output of the command, not just the happy path. T4 of the test suite (graceful empty path) explicitly required the footer on the empty-traces advisory; extending to the other four advisory paths makes the rule uniform. Found during: Task 2 GREEN test design.

2. **[Rule 2 - Missing critical functionality] actionFooter() extracted to a pure-function helper, not inlined.** The plan's <action> Step 2 showed an `output += '\\n'; output += 'Next: ...'` pattern. Implementation extracted to a named function so (a) the same footer renders identically across the 6 exit paths (DRY), (b) tests can introspect via module.exports without spawning the script, (c) future verb-vocabulary changes touch one location instead of six. The helper is 8 body lines + 10 lines of in-source canon documentation. Found during: Task 2 GREEN refinement after deviation 1 surfaced the multi-exit-path footer requirement.

3. **[Scope decision] Footer NOT wired into --help (printHelp) path.** Plan's <verify> automated checks did not exercise the --help path. Implementation deliberately left printHelp without the footer because (a) the help text itself describes the navigation surface, (b) adding a Next: footer to a help screen would be redundant and visually noisy, (c) the 4-zone rule applies to command output, not to command discovery surfaces. The verify gate `node scripts/explain-decision-command.cjs ... | tail -5 | grep -qE "Next:"` runs the default invocation (no --help), so this scoping decision is consistent with the gate. Found during: Task 2 GREEN review of all main() exit paths.

4. **[Scope decision] T3 non-regression verified via marker preservation, not byte-identity.** The plan's <action> Step 4 acknowledged: 'capture the current stdout BEFORE the patch lands as the baseline (mark this test xpending if no fixture available; T3 may collapse to T1+T2)'. Implementation kept T3 as a real assertion, verifying 25 ordered markers (header / Turn / Tier Mode / 8 brain_md_* fields / 5 structural fields / Chosen rationale / closing `---` ordering) plus the invariant `lastIndexOf('\\n---') < indexOf('Next:')` (closing separator MUST precede footer). This is more robust against incidental whitespace drift while still catching any genuine prefix regression. The 14 existing fixture tests in lib/memory/explain-decision-command.test.cjs are the byte-identity gate; T3 is the structural gate. Found during: Task 1 RED test design.

5. **[Scope decision] actionFooter exported via module.exports.** Plan's must_haves did not require an export. Implementation added `actionFooter: actionFooter` to the existing module.exports block (which already exported parseArgs / resolveActiveRoomDir / resolveSessionId / readTraceFile / renderTrace / renderHeader / classifyTier per Plan 91-05). Reason: future tests + tooling that need to introspect the footer text without spawning the script (e.g. a v1.12 surface that documents footer drift across commands) get a clean handle. Zero cost; forward-additive. Found during: Task 2 GREEN module.exports review.

## Closure

Plan 94-09 closes the third of three QA handoff Section 3 P1 polish
items bundled into v1.11.2:

```
- 94-07 em-dashes-wiki-md          SHIPPED (commits b3bcc45, 4f576d2)
- 94-08 u2717-cross-mark-replace   SHIPPED (commits 57c7dca, 848b88e)
- 94-09 explain-decision-footer    SHIPPED (commits 68a73e5, 026adf1; this plan)
```

CHANGELOG narrative for v1.11.2 (locked from CONTEXT.md): 'Plus three
polish fixes for em-dashes, U+2717, and the /mos:explain-decision
footer.' Plan 94-09 closes the third clause; the v1.11.2 P1 polish
bundle is complete.

Plan 94-09 is the LAST Wave 1 plan in Phase 94. The phase now has 9 of
10 plans shipped (94-01 through 94-09); the remaining 94-10 release-
gate is the wave-2 closer that ships v1.11.2 to the marketplace via
the standard 5-gate pipeline (CHANGELOG entry + plugin.json bump +
package.json bump + git tag + marketplace.json ref pin).

Wave-1 readiness for 94-10:

| Plan  | Subsystem                              | Status   | Commits                                                    |
| ----- | -------------------------------------- | -------- | ---------------------------------------------------------- |
| 94-01 | statusline-active-room-fix             | SHIPPED  | 567fea8, 93f1cfa, 906fb18, 18e1751                         |
| 94-02 | rs-fetch-thesis-merge-fix              | SHIPPED  | (per 94-02 SUMMARY)                                        |
| 94-03 | brain-mcp-server-resolution            | SHIPPED  | (per 94-03 SUMMARY)                                        |
| 94-04 | mcp-server-brain-deps                  | SHIPPED  | (per 94-04 SUMMARY)                                        |
| 94-05 | mcp-stack-fallback-chain               | SHIPPED  | a581a8a, 766c08b                                           |
| 94-06 | room-classifier-strict-mode            | SHIPPED  | e98466c, 9da8e80, 467358e, f196d12                         |
| 94-07 | em-dashes-wiki-md                      | SHIPPED  | b3bcc45, 4f576d2                                           |
| 94-08 | u2717-cross-mark-replacement           | SHIPPED  | 57c7dca, 848b88e                                           |
| 94-09 | explain-decision-action-footer         | SHIPPED  | 68a73e5, 026adf1 (this plan; SUMMARY commit pending)       |
| 94-10 | v1.11.2-release-gate                   | PENDING  | (autonomous: false; surfaced to user as checkpoint)        |

The four inherited Feynman failures (84-smart-notebook-copilot Test 15,
test-self-update-platform, write-lock-atomic, debouncer-drain-at-prompt
Test 5) carried over from 94-05 / 94-06 are unchanged by 94-09; they
will be addressed in 94-10 release-gate plan if they block tag promotion.

## Self-Check: PASSED

- [x] scripts/explain-decision-command.cjs has actionFooter() helper at line 350-371 (18 lines)
- [x] actionFooter() called from 7 exit paths total: happy + 5 advisory in main() + 1 defense-in-depth catch (verified via `grep -nE "actionFooter\(\)" scripts/explain-decision-command.cjs` = 7 call-sites + 1 def at line 357)
- [x] actionFooter exported via module.exports (line 478)
- [x] lib/memory/explain-decision-footer.test.cjs exists, 316 lines, BSL 1.1 header, 4/4 tests passing
- [x] lib/memory/run-feynman-tests.cjs registers explain-decision-footer.test.cjs with Canon Part 3 + 7 traceability comment (lines 652-672)
- [x] Both task commits exist: 68a73e5 (RED), 026adf1 (GREEN)
- [x] Zero em-dashes in any file modified by this plan (verified via grep -P "[\x{2014}]")
- [x] BSL 1.1 header on lib/memory/explain-decision-footer.test.cjs
- [x] Backward compat: lib/memory/explain-decision-command.test.cjs 14/14 PASS (no regression on Plan 91-05 trace-field assertions)
- [x] Backward compat: lib/memory/offer-presenter.test.cjs 17/17 PASS (related Plan 91-04 consumer)
- [x] Backward compat: lib/memory/decision-capture.test.cjs 14/14 PASS (related Plan 91-02 writer)
- [x] Canon Part 3 + Part 7 traceability stated in SUMMARY + run-feynman-tests.cjs comment
- [x] skills/ui-system/SKILL.md Section 1 Zone 4 "NEVER omitted" rule satisfied
- [x] Five deviations documented (multi-exit-path wiring; helper extraction; --help scoping; T3 marker-not-byte verification; actionFooter exported)
- [x] T1 + T2 + T4 cover footer presence + content + empty-path; T3 covers prefix non-regression
- [x] End-to-end production smoke confirms footer renders on happy path + empty-traces advisory + no-room advisory
- [x] Static verify gates: grep -c Next: / /mos:status / /mos:act / /mos:suggest-next all return 2 (1 doc comment + 1 helper string); node --check passes; zero em-dashes across 3 files
