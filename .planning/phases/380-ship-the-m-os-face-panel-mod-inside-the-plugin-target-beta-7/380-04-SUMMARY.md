---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 04
subsystem: ui-mod-egress
tags: [mos-face, canon-part-8, egress, sanitize, proposals, canary-tests]
requires: [380-02]
provides:
  - ui/mos-face/hooks/proposals.ts (two flags, one place for a veto)
  - ui/mos-face/hooks/advice.ts (HANDLE_QUERIES, stripNames S1 S2 S3, COMMON_STARTS, wordsTexts, wordsStartOn)
  - ui/mos-face/tests/support.ts and tests/egress.test.ts (17 added tests)
  - tests/test-380-egress.cjs (static gate, 29 checks)
affects: [380-05, 380-10, 380-11]
key-files:
  created:
    - ui/mos-face/hooks/proposals.ts
    - ui/mos-face/tests/support.ts
    - ui/mos-face/tests/egress.test.ts
    - tests/test-380-egress.cjs
  modified:
    - ui/mos-face/hooks/advice.ts
    - ui/mos-face/hooks/register.tsx
    - ui/mos-face/panel.test.tsx
    - ui/mos-face/types/index.d.ts
    - ui/mos-face/README.md
requirements-completed: [MOD380-03]
completed: 2026-10-23
---

# Phase 380 Plan 04: The Theo ask egress rule (D-03) - Summary

The panel now sends the person's words on one call only: the guarded shim brain_ask. The search call sends a framework name or a problem type from a closed list. Names typed in prose are stripped. The texts tell the truth. Canary tests and a static gate pin all of it.

Code tree: `/home/jsagi/dev/MindrianOS-Plugin-release`, branch `main`. Nothing was pushed. No branch was created or switched. `git rev-list --count origin/main..main` is 14 after this plan (11 earlier plus the 3 below).

## Commits (release tree)

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 3cb6b1927 | test(380-04): RED canary tests for every outbound call of the panel (D-03) |
| 2 | 415e10a98 | fix(380-04): search sends handles only, names stripped, excerpt only through the guarded shim (D-03) |
| 3 | 7e8ea9207 | test(380-04): static egress gate and README egress section (D-03) |

## Root cause (PROVEN by reading the source before the patch)

Four causes, each in `hooks/advice.ts` or `hooks/register.tsx` as adopted:

1. `searchChapters(words)` called `searchTerms(words)` and sent up to 8 words of the cleaned excerpt as the query of `mcp__theo__search`. That is a raw-server call the egress guard never sees, and the 2026-10-21 ruling names only brain_ask.
2. `sanitize` removed code, links, mail, paths and key-like strings. It had no rule for a name. A venture name typed in prose passed untouched.
3. `askTheo` looped over both tools with the one question that held the excerpt. A denied or failed shim sent the excerpt to the raw server, again around the guard (CLAUDE.md THEO-04).
4. The command texts were fixed strings. `/mos-advice` said "never your words" while the excerpt was on by default. `/mos-words` did not say that the setting lives in process memory (the `wordsOn` atom) and dies with the session.

## What changed

- `HANDLE_QUERIES` (framework names of the rules, the fallback framework, the four problem types). `searchChapters($, handle, skip)` takes the handle, queries its framework name and returns an empty list when the name is not a member. `searchTerms` and its stop list are gone. The search now runs on every ask, with the excerpt on or off, because it sends handles only.
- `stripNames` with S1 (known names: room slug and its parts of 3 letters or more, workspace folder, session folder base name), S2 (capitalized word that does not start a sentence, all-caps word of 2 letters or more, allow-list kept) and S3 (sentence start: common word, cue word of any RULES entry, or framework word kept; else removed). A run collapses to one "(a name)". `sanitize(text, max, known)` and `wordsFor(matched, messages, known)` use it. `register.tsx` builds the known list from the bound slug, the snapshot room slug, the workspace atom and the base name of `$.session.cwd()`.
- `askTheo(..., proposals = PROPOSALS)`: shim first, raw second. With P1 on, the raw question holds handles only. `Advice.sent` holds the excerpt when a call that carried it was made and not denied (a call that failed after it left does not erase it).
- `hooks/proposals.ts`: `shimOnlyExcerpt` (P1) and `envSwitch` (P2), both `true`, with the veto recipe in the header comment.
- `wordsStartOn` and `wordsTexts`: `MOS_FACE_WORDS` off, 0 or false (any case, trimmed) at session start sets `wordsOn` false when P2 is on; it never turns it on at start. Texts say what is sent now and that the setting lasts until the session ends; with P2 on they name `MOS_FACE_WORDS`.
- Panel line: after an ask with no excerpt sent it says "Theo was sent only a framework name and a problem type this time" instead of promising an excerpt.
- README: section `## Egress`.

## RED list (commit 3cb6b1927)

The tests need `hooks/proposals.ts` and new exports, so in the committed RED state the file does not load: `(fail) the file did not load`, with 37 originals passing. The claude engine also refuses a dynamic `import()` in a test support file, so the first idea (load the module inside each test) was dropped for a static import.

To read the per-test RED, I ran the same tests once against the old advice and register code with a throwaway stub `hooks/proposals.ts` (removed, never committed): 40 pass, 11 fail. Failing: E1, E2, E5, E6, E6b, E6c, E7, E8, E8b, E10, E10b. Passing in RED: E3 (the off path already worked), E4 (assistant text and room names never travelled), E9 (the scan itself). E3, E4 and E9 are regression guards that hold before and after.

## GREEN run (PROVEN)

| Command | Result |
|---------|--------|
| `claude plugin test .` in `ui/mos-face` | 51 pass, 0 fail (34 original, 3 raster pins, 14 new in egress.test.ts: E1 to E4, E5, E6, E6b, E6c, E7, E8, E8b, E9, E10, E10b) |
| `node tests/test-380-engine-tests.cjs` | 51 pass, equals the 51 `test(` declarations on disk; panel.test.tsx declares 34 |
| `node ui/mos-face/scripts/typecheck.cjs` | exit 0 |
| `node tests/test-380-typecheck.cjs`, `node tests/test-380-wall.cjs` | pass (7 passed, 0 failed for the wall) |
| `node tests/test-380-egress.cjs` | 29 passed, 0 failed |
| `bash tests/run-all-380.sh` | `PASSED=6 FAILED=0 SKIPPED=7 KNOWN=0` |
| `LC_ALL=C /usr/bin/grep -P '\xE2\x80[\x93\x94]'` over hooks, tests, panel.test.tsx, README, types, the new test | no hit |

Added test count: 17 (the "17 added" printed by the wrapper counts the 3 raster pins plus 14 egress tests).

### Both values of each flag (PROVEN, run on the working tree, then restored)

| shimOnlyExcerpt | envSwitch | result |
|---|---|---|
| false | true | 51 pass, 0 fail |
| true | false | 51 pass, 0 fail |
| false | false | 51 pass, 0 fail |
| true | true (committed) | 51 pass, 0 fail |

A veto is therefore one flag flipped; no test edit is needed. The dist rebuild step depends on `scripts/build-mos-face.cjs`, which plan 05 adds (UNVERIFIED here).

### Mutation arms (PROVEN)

| Mutation | Tests that failed |
|---|---|
| stripNames bypassed in sanitize | the cleaned-words panel test, E2, E8, E8b |
| raw fallback always carries the excerpt | E5, E10 |
| search query adds the matched words | E1 |
| MOS_FACE_WORDS read removed from session start | E6, E6b, E6c |
| a `words` parameter added to searchChapters | N2 of the static gate |
| (RED run, above) | E1, E2, E5 to E8b, E10, E10b |

## Edits to the 34 original tests (all in panel.test.tsx, count stays 34)

1. Import line: `searchTerms` removed (the function is deleted by D-03), `HANDLE_QUERIES` added.
2. Test "words become search terms, and chapters become commands not yet shown" is now "handles become chapter picks, and chapters become commands not yet shown". The two `searchTerms` assertions are replaced by two `HANDLE_QUERIES` membership assertions and one non-membership assertion. The `chaptersToPicks` assertions are unchanged. Reason: D-03 removes the words-to-search path.
3. Test "the words that travel are cleaned" gains one block of name cases through `sanitize` with a known slug. No existing assertion changed. Reason: D-03 asks for the name gap to be closed and tested.

The tests "every second turn the panel asks Theo ..." and "Words: shared can be switched off ..." needed no edit and pass as they were.

## The stripping rule, as built (decision D-03 left it to planning)

S1, S2 and S3 as in the plan objective, plus two choices recorded here:

- A part of a slug or folder name that is a plain function word (the, and) is not added to the known list. Reason: stripping "the" from every sentence leaks nothing and wrecks the excerpt.
- COMMON_STARTS leaves out the words that are also given names (will, may). "Will this work" loses its first word. That costs a little fit and never leaks.

## Residual risk (stated, tested, not hidden)

- A lowercase name in the middle of a sentence that equals no known name passes. E8 records this: `we compete with zorbo` keeps `zorbo`.
- A name in a script without capital letters (Hebrew, for example) passes S2 and S3, because case cannot be read. Only S1 catches it when it equals a known name. This is an addition to the plan's wording and is in the README.
- The excerpt is shown in full and `/mos-words` or `MOS_FACE_WORDS=off` turns it off.

## Guard table (informational, printed by tests/test-380-egress.cjs N5; the guard is `lib/core/part8-egress-guard.cjs` `classify({ question }, { toolName })`)

| Sample | Tool | Verdict | Class |
|---|---|---|---|
| handles only | shim | allow | generic_question |
| handles only, Wicked | shim | allow | generic_question |
| excerpt with names stripped | shim | allow | generic_question |
| excerpt with a canary name | shim | block | room_content ("a proper name no methodology handle matches") |
| excerpt with a canary mail | shim | block | content_set (mail pattern) |
| handles only | raw theo | allow | generic_question |

Reading: the guard agrees with the stripping rule. A name that survives sanitize would be blocked on the shim path, if the guard sees a plugin-made call. UNVERIFIED: whether the guard sees a call that a plugin module makes. It is recorded, not assumed.

Also from N4 (`claude plugin validate --json`): the module declares `$.tool.call`, `$.http.fetch` and `$.process.run` (the process call is the python3 graph probe, removed by plan 05), and reads the environment names HOME, MOS_FACE_WORDS and NO_COLOR.

## Deviations from Plan

**1. [Rule 3 - Blocking] The engine refuses a dynamic import in a test helper**
- Found during: Task 1 first run (`the file did not load`, "a dynamic import()").
- Fix: `loadProposals` removed; `egress.test.ts` imports `PROPOSALS` statically. Effect: the RED commit shows one file-load failure instead of per-test failures, so the per-test RED list above comes from the stub run.

**2. [Rule 1 - Bug] An em-dash literal in the first RED commit**
- Found during: the dash fence after the first commit. The write tool turned an escape into the character.
- Fix: the dash check now uses `String.fromCharCode(8212)` and `(8211)`. The commit was my own, unpushed; amended with `--only` (3cb6b1927 is the amended id). The fence is clean on all touched files.

**3. [Rule 3 - Blocking] askTheo needs a clock**
- E10 calls `askTheo` directly. The test `$` has no `clock` noun. E10 passes a small adapter with `clock.now` and `tool.call`.

**4. [Scope note] N1 of the static gate scans only files that make a tool call**
- `register.tsx` holds `mcp__` strings that only label calls the session already made (classification). It has no `$.tool.call` site. The gate asserts exactly 3 call sites (2 in advice.ts, 1 in source.ts) and scans those files.

**5. [Own error, no harm] A mutation run reverted my uncommitted register.tsx**
- I ran `git checkout -- hooks/register.tsx` to undo a one-line mutation. That also discarded my unstaged edits of the same file. I re-applied them from the same script and re-ran everything above after that. All results above are from after the re-apply.

## Notice: the release tree is a linked worktree

`/home/jsagi/dev/MindrianOS-Plugin-release` is a linked worktree of the branch tree, checked out on `main`. The generic worktree-agent branch rule in the executor profile does not fit here. I followed the caller's order and committed on `main` with `git commit --only`, like plans 01 to 03. HEAD never left `main`. I did not touch the `.pyc` file.

## Known Stubs

None.

## Threat flags

None new. The new local read of `$.session.cwd()` in `knownNames` stays on the machine and only feeds the strip list.

## Threat register status

| Threat | Status |
|---|---|
| T-380-11 search carries words | mitigated: HANDLE_QUERIES, E1, N2 |
| T-380-12 venture name in prose | mitigated for known and capitalized names and sentence starts: E2, E8, E8b; residual risk recorded |
| T-380-13 fallback around the guard | mitigated with P1 on: E5, E10 |
| T-380-14 assistant text or room reaches a call | mitigated: E4 (scan of tool, http and process calls) |
| T-380-15 text says never your words | mitigated: E7 |
| T-380-16 opt-out silently resets | mitigated: texts say so, P2 makes it last, E6 |

## UNVERIFIED

- The effect of the egress guard on a call that the panel makes (needs a live session).
- The dist rebuild step of a veto (script arrives in plan 05).
- Any visual check of the changed panel line. The text is asserted in E5; no screenshot was taken here (plan 10 owns the screenshots).
- A live Theo call. None was made, by order.

## Self-Check: PASSED

- Files exist: proposals.ts, support.ts, egress.test.ts, test-380-egress.cjs, this SUMMARY.
- Commits 3cb6b1927, 415e10a98 and 7e8ea9207 are on `main` of the release tree (`git log --oneline -4` read after the last commit).
