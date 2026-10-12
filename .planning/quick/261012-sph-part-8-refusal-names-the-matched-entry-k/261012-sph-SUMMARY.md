---
quick: 261012-sph
status: complete
type: execute
canon_parts: [8, 12]
commits:
  red: d2fbe07e4
  green_1: c0b947538
  green_2: 8e3d55455
pre_sha: 3677f2a9eb8edc4037f49f7a78d8be0647289ae9
---

# Quick 261012-sph: the Part 8 refusal names the matched entry kind and size

Status: complete. Pre-flight found quick 261012-sbz (3fea3e954, c8e59445d) and 261012-sc0 (da09144cf to 3677f2a9e) in the log. The 9 plan files were clean.

## Commits

All three commits end with the trailer line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` after a blank line. Each used `git commit --only -m ... -- <paths>`. Nothing under .planning/ was staged. PLAN.md and SUMMARY.md are not committed.

| Step | Sha | Files |
|------|-----|-------|
| RED | d2fbe07e4 | tests/test-3692-theo-verdict.cjs |
| GREEN 1 | c0b947538 | lib/core/part8-room-lexicon.cjs, lib/core/part8-egress-guard.cjs, lib/core/brain-client.cjs, scripts/part8-egress-guard-hook.cjs |
| GREEN 2 | 8e3d55455 | lib/core/refusal-messaging.cjs, scripts/mindrian-brain-mcp-client.cjs, lib/core/feyminto/theo-ask.cjs, CHANGELOG.md |

## New fields and types

| Field | Type | Where | Rule |
|-------|------|-------|------|
| matched_kind | string, one of room_term, claim, person, venture_name, room_name, room_file | verdict, sentinel, refusal, theo-ask record, not-asked result | closed list `_LEXICON_MATCH_KINDS` in brain-client; parity with lexicon KINDS pinned by V8b |
| matched_token_count | integer 1 to 300 | same | word count of the entry; for a claim, the count of content words the string carries |
| matched_count | integer 1 to 5 | same, when known | entries the string hits, counted up to THEO_MATCH_COUNT_CAP = 5 |

A refusal that is not a lexicon match keeps its old keys and old text. The verdict, sentinel and refusal objects carry no entry text, no token and no index.

## Copy deck as shipped

- C1 one name entry: `The question matched one {label}, {n} word(s) long, so it was not sent to Theo. Reword without that phrase.`
- C2 one claim: `The question shares {n} word(s) with one claim recorded in this room, so it was not sent to Theo. Reword it with fewer of those words.`
- C3 several: `The question matched {c} entries from this room (the first: {first}), so it was not sent to Theo. Reword without those phrases.` {c} is the integer, or `5 or more` at the cap.
- H1 hook stderr: `Canon Part 8: blocked ({class}, {token_class}). ` + C. H0 (old text) for every other block.
- R1 reason: `The Brain boundary refused {tool} (class: {eclass}). ` + C + ` This is a constitutional refusal, not an outage. Otherwise rephrase in generic methodology terms, or continue without the Brain for this turn.`
- RC1 render: 3 lines (old line 1, C, old line 2).

## Verified sentences (PROVEN, produced by the shipped code)

- room_file hit, 2 words: `The question matched one room artifact title, 2 words long, so it was not sent to Theo. Reword without that phrase.`
- room_term hit, 1 word: `The question matched one term this room uses, 1 word long, so it was not sent to Theo. Reword without that phrase.`
- claim hit (3 shared words): `The question shares 3 words with one claim recorded in this room, so it was not sent to Theo. Reword it with fewer of those words.`
- 3-entry multi-hit: `The question matched 3 entries from this room (the first: a term this room uses, 2 words long), so it was not sent to Theo. Reword without those phrases.`
- hook stderr for one lexicon block: `Canon Part 8: blocked (room_content, room_term). The question matched one term this room uses, 2 words long, so it was not sent to Theo. Reword without that phrase.`
- refusalResponse next_moves on that match: `["reword_without_matched_phrase","rephrase_generically","continue_without"]`.

## Verify results

- RED (261012-sph-red.txt): `PASS: 19 FAIL: 7`, exit 1. The 7 failures are V8a to V8g. 0 older legs failed. V5 text identical to the pre-sha (checked by slicing the leg from `git show <pre-sha>`).
- GREEN 1 (261012-sph-green1.txt): `PASS: 23 FAIL: 3` (V8e, V8f, V8g), as the plan expects. Neighbour suites exit 0: part8-egress-guard.test, part8-egress-guard-hook.test, test-3692-lexicon-generic-entries, test-246, test-245, test-260906-fda, test-260917-dgf.
- GREEN 2 (261012-sph-green2.txt): `PASS: 26 FAIL: 0`, exit 0. The 11 listed suites exit 0 (test-257-refusal-egress-kind, refusal-messaging.test, test-250-refusal-shapes, test-257-envelope-passthrough, test-257-shim-honest-refusal, test-36925-theo-ask, test-36925-theo-wiring, test-36925-theo-face, part8-egress-guard.test, part8-egress-guard-hook.test, test-3692-lexicon-generic-entries).
- Lexicon diff against the pre-sha: 3 insertions, 3 deletions, only the doc line and the 2 return lines. The S1 rule and `_genericTokenSet` are untouched.
- Dash count 0 in all 9 edited files.
- Canary no-echo: V8g swept 16 canary tokens over verdicts, sentinels, hook stderr, refusals, rendered copy and theo-ask results. No echo was found.

## Runner totals (bash tests/run-all-3692.sh)

| Run | Line | `>>> ` status |
|-----|------|---------------|
| before (3677f2a9e) | `Phase 369.2: PASSED=71 FAILED=1` | 1 line FAILED: `Theo verdict, the egress guard speaks to Theo (369.2-01)` |
| after (8e3d55455) | `Phase 369.2: PASSED=72 FAILED=0` | all PASSED |

The only `>>> ` diff is that one line, FAILED to PASSED. Cause of the baseline failure: leg V6 (hook p95 budget) measured 507 ms against 400 ms during the run. The same file run alone 3 times before any edit gave `PASS: 19 FAIL: 0` with p95 205, 204, 159 ms. The failure was a load timing flake, not a code defect (PROVEN by the 3 reruns; the cause of the load itself is ASSUMED). The after run has no failure.

## Gate

`node tests/test-3692-guard-survey-gate.cjs` exit 0, `GATE: PASS`. Both known leaks stay open: `DELTA known_leaks.GAP1 baseline=status=open measured=allowed_in=7 OK` and the same for GAP2. `--stamp` was not run. The baseline JSON is untouched. The new verdict keys did not enter the gate comparison.

## Decisions and facts

- D-NM: ADDED. NEXT_MOVES is a frozen closed map. Tests pin it with includes checks only. 0 tests pin the egress_blocked list. 0 code reads a handle by name. Shape F MAX_K 3 holds with 3 moves. The new pin is V8e (deepStrictEqual on both lists). The third move applies only to a refusal that carries a validated lexicon match.
- Scope note: scripts/mindrian-brain-mcp-client.cjs changed (outside the navigator list). `honestRefusal` now forwards the 3 fields, and the `brain_ask` branch calls `honestRefusal(raw, 'brain_ask')`. Before, that branch dropped token_class and every matched field. The function signature line is byte-identical. test-257-shim-honest-refusal still passes.
- Under the current guard the 4 theo-ask handle reads never reach the lexicon (the callTool belt returns `{ error, tool, egress_class }` only on that path). The theo-ask fields appear only when a sentinel carries them. V8f proves the plumbing with an injected callTool.
- Block-path cost of the lazy brain-client require in the hook: measured block median 239 ms against allow median 186 ms (7 spawns each), so about 53 ms extra, inside the 2000 ms hook budget. The allow path is unchanged.
- A failed require in the hook falls back to the old text and still exits 2 (read in the code; the failure path itself was not run).

## Deviations from plan

None in scope. The plan said P0 = 19 PASS lines in the baseline; the baseline file had 18 PASS plus the V6 timing failure (see above). No code was changed because of it.

## Dirty files not touched

At the end, `git status --short` for tracked files shows nothing modified. Untracked files under .planning/debug/ and the quick folder 261012-c6n were not touched.

## Self-Check: PASSED

- Shas d2fbe07e4, c0b947538, 8e3d55455 are ancestors of HEAD.
- `git status --short -- lib tests scripts CHANGELOG.md` is empty.
