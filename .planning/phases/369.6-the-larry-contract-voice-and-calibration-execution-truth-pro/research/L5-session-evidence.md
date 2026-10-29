# L5: Empirical erosion of Larry's voice in real sessions

Date: 2026-10-29. Lens L5. All claims marked PROVEN (command or script output), UNVERIFIED, or PENDING-HUMAN.

## Question

Do Larry's countable voice markers appear in real assistant replies, and do their rates fall over time or across plugin versions?

Short answer: the data cannot show a clean erosion of the conversational voice. Almost all measured replies come from the owner's orchestration and development sessions, not from navigator conversations. Within that population, two things changed with a clear date: the glyph format (move word to "Larry | MindrianOS" label at beta.69) and reply length (fewer replies inside the 3 to 8 sentence default after beta.51). The reframe move, the signature openers and the closing question were never frequent in any period, so no drop can be located for them.

## Method

Script: `/tmp/claude-1000/-home-jsagi/6d4d4493-e601-4c21-a9a1-fa163d7d6498/scratchpad/l5_scan.py` (scanner, writes rows.json) and `/tmp/claude-1000/-home-jsagi/6d4d4493-e601-4c21-a9a1-fa163d7d6498/scratchpad/l5_agg.py` (tables). Both are read-only on the transcripts. Run: `python3 -I l5_scan.py rows.json; python3 -I l5_agg.py`.

Population (PROVEN, script output):
- 2190 JSONL files under `/home/jsagi/.claude/projects/`. File mtimes: 24 in 2026-04, 175 in 2026-09, 1991 in 2026-10.
- A session counts as "plugin active" only if a SessionStart hook attachment carries `[MindrianOS v<version>] You are Larry`. This gave 101 sessions and 2550 turns. The version string is the hook stamp, not necessarily the installed cache version. Sessions earlier than 2026-09-28 gave no stamp, so none are in the data.
- A turn is one real user prompt (tool results, meta and command messages excluded) plus all main-thread assistant text until the next real prompt. Sidechain (subagent) text and `<synthetic>` messages are excluded.
- Group date is the first timestamp in the file.

Markers (rate = share of turns):
1. glyph: first text block starts with one of the five De Stijl squares.
2. label: first 80 characters contain "Larry | MindrianOS". The rule in the injected text for this label starts at beta.69 (older stamp text used a move word such as "*building*"), so a 0% before beta.69 is by design, not erosion.
3. len_ok: sentences in the last text block between 3 and 8. Code blocks, table rows and short fragments are not counted as sentences. Median sentences is also given.
4. reframe: regex for "You're thinking about this as", "But what if it's", "That's not a problem, that's a category", "You've given me a solution. What's the problem?". This regex over-matches; see Limits.
5. closeq: last text block ends in a question mark (a closing question). Next steps without a question mark are not counted, so this is a lower bound.
6. fwdump: 3 or more framework names (list of 28 names, for example Six Hats, TRIZ, JTBD, Minto) in one turn, and the user prompt names none and does not say "framework".
7. opener: any of the four signature openers anywhere in the turn.
8. forbidden: "great question", "Absolutely!", "I'd be happy to help".
9. emdash: the character U+2014 anywhere in the turn.
10. pausedash: the Larry pause " -- " anywhere in the turn. Confound: the De Stijl header line "-- Theo -- Phase 15 --" also matches, so this marker is inflated.

## Results table

Rates in percent. Turns include tool turns. S = sessions, N = turns.

| Version | Dates | S | N | glyph | label | len_ok | median sent | reframe | closeq | fwdump | opener | forbidden | emdash | pausedash |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| beta.49 | 09-28 | 1 | 30 | 40.0 | 0.0 | 23.3 | 13 | 0.0 | 0.0 | 0.0 | 6.7 | 0.0 | 0.0 | 13.3 |
| beta.51 | 09-29 to 10-01 | 21 | 331 | 49.5 | 0.0 | 36.0 | 7 | 0.3 | 2.1 | 3.0 | 0.6 | 0.0 | 0.0 | 35.3 |
| beta.53 | 10-01 to 10-04 | 15 | 229 | 67.7 | 0.0 | 32.8 | 9 | 0.4 | 3.9 | 2.6 | 5.2 | 0.0 | 0.4 | 49.8 |
| beta.57 | 10-05 | 6 | 150 | 78.0 | 0.0 | 22.7 | 8 | 0.0 | 8.7 | 0.7 | 0.7 | 0.0 | 0.0 | 10.0 |
| beta.59 | 10-05 to 10-18 | 23 | 985 | 71.5 | 0.0 | 21.7 | 15 | 0.4 | 15.4 | 5.6 | 2.5 | 0.0 | 1.0 | 12.0 |
| beta.69 | 10-18 to 10-23 | 18 | 423 | 71.2 | 70.9 | 17.3 | 18 | 0.0 | 13.9 | 1.2 | 2.8 | 0.0 | 0.2 | 6.9 |
| beta.73 | 10-23 to 10-24 | 4 | 119 | 89.1 | 89.1 | 11.8 | 21 | 0.0 | 7.6 | 0.0 | 0.8 | 0.0 | 0.0 | 4.2 |
| beta.75 | 10-24 to 10-29 | 13 | 283 | 72.4 | 72.4 | 20.1 | 19 | 0.4 | 11.7 | 2.1 | 3.2 | 0.0 | 0.0 | 8.5 |

Month view (PROVEN): 2026-09 has 15 sessions, 174 turns, glyph 43.7, len_ok 31.6, closeq 1.7. 2026-10 has 86 sessions, 2376 turns, glyph 71.0, len_ok 22.6, closeq 11.7. Months are too coarse; only two exist.

Pure-chat turns only (turns with zero tool calls; 513 turns):

| Version | S | N | glyph | len_ok | median sent | closeq | pausedash |
|---|---|---|---|---|---|---|---|
| beta.51 | 13 | 53 | 47.2 | 49.1 | 4 | 1.9 | 9.4 |
| beta.53 | 15 | 35 | 82.9 | 45.7 | 7 | 5.7 | 17.1 |
| beta.57 | 6 | 54 | 68.5 | 22.2 | 4 | 9.3 | 3.7 |
| beta.59 | 21 | 227 | 79.3 | 27.8 | 13 | 19.4 | 6.6 |
| beta.69 | 13 | 78 | 92.3 | 25.6 | 15 | 11.5 | 0.0 |
| beta.73 | 4 | 21 | 95.2 | 33.3 | 19 | 9.5 | 0.0 |
| beta.75 | 12 | 38 | 97.4 | 39.5 | 11 | 18.4 | 0.0 |

Raw counts across all 2550 turns (PROVEN): forbidden phrases 0; em dash 12 turns (11 of them in beta.53 and beta.59 on 10-02 to 10-12, 1 in beta.69); reframe regex hits 7; signature openers 64.

## Where each marker dropped

- glyph: no drop. It rose from 40 to 50 percent (beta.49, beta.51) to about 70 to 89 percent (beta.57 on). Turns without a glyph are mostly short status or tool-narration replies in the orchestration session.
- label "Larry | MindrianOS": starts at beta.69 (70.9). Not a drop. The earlier format used a move word, so the label cannot be compared before beta.69.
- len_ok (3 to 8 sentences): first drop is beta.57 (36.0 and 32.8 down to 22.7), then a low of 11.8 at beta.73. Median sentences rose from 7 (beta.51) to 15 to 21 (beta.59 to beta.73). Pure-chat turns show the same direction (49.1 at beta.51, 22.2 at beta.57, 25.6 at beta.69), but beta.75 rebounds to 39.5 on 38 turns.
- reframe: never present. 7 regex hits in 2550 turns (0.3 percent). By hand I judged 1 of the 7 as a true reframe ("You've given me a solution. What's the problem?", beta.59, 10-12). The other 6 are false matches or unrelated text (UNVERIFIED for two that I did not read in full). No drop can be named because there was no earlier peak.
- closeq (closing question): no drop. It rose from 2 to 4 percent (beta.51, beta.53) to 15.4 at beta.59, then eased to 7.6 to 13.9. The easing from beta.59 to beta.73 (15.4 to 7.6) is the only decline, on a small beta.73 base (119 turns, 4 sessions).
- fwdump: low throughout (0 to 5.6). Peak at beta.59 (5.6). Not an erosion marker.
- opener: peak at beta.53 (5.2 percent) and beta.49 (6.7, 2 turns). Back to 0.8 to 3.2 later. Weak signal; the beta.59 openers include two from a fresh-room onboarding session.
- forbidden phrases: zero in every period, so the guard holds.
- emdash: 0 to 1.0 percent. It peaks at beta.59 (1.0, around 10-06). Not rising.
- pausedash: 49.8 percent at beta.53 falls to 10.0 at beta.57 and 4.2 to 8.5 later. This is the only large drop, but the marker is dominated by the "-- header --" line of the owner's output style, not by the Larry pause. Treat as a style-format change, not voice erosion.

## Examples

Each quote is one short sentence from a real assistant reply. No room content.

1. Before, glyph with move word (beta.51, 2026-09-30): "🟦 *building*" opened a reply that started "There's one block to paste."
2. After, label format (beta.75, 2026-10-26): "🟦 **Larry | MindrianOS**" opened a reply that began "I'm Larry, MindrianOS's PWS thinking partner, powered by Claude."
3. Reply length before (beta.51, 2026-10-01, pure chat, 2 sentences): "It isn't the quick task, so I'm still waiting on its summary." (glyph only, no label.)
4. Reply length after (beta.73, 2026-10-23, 30 sentences in the last block): "I'm reading 'optionl' as operational, meaning a user who isn't you can install it and run it." (opening sentence of a long reply.)
5. Reframe, the single clear hit (beta.59, 2026-10-12): "You've given me a solution. What's the problem?"
6. Signature opener in a fresh-room chat (beta.59): "Hi. Very simply -- what's the decision or problem on your desk right now?"
7. Closing question after the label change (beta.75, 2026-10-26): "Which wall is the hard one for you: space, time, or how much of the map you can honestly claim is measured?"

## Limits

- Sample bias (PROVEN): 2541 of 2550 turns (99.6 percent) come from four working directories: the home orchestration session, the plugin repo, mos-platform and the website repo. Only 9 turns in 4 sessions come from other folders (a fresh-room test, a tmp chat). The data describes a Larry-flavored dev orchestrator, not a navigator talking to Larry. Of those 9 turns, 7 have the glyph, 2 have 3 to 8 sentences and 0 have a reframe.
- Sample size per group: beta.49 has 1 session and 30 turns, beta.57 has 6 sessions, beta.73 has 4 sessions and 119 turns. These are too small to conclude anything. Only beta.51, beta.59, beta.69 and beta.75 (13 to 23 sessions) support rough comparisons, and even those are dominated by one long-running owner session per period.
- Time span is 2026-09-28 to 2026-10-29. Nothing before that carries the stamp, so the question "since Larry was last handled as a phase" cannot be tested: no baseline from the era when Larry was a phase exists in these files (UNVERIFIED whether older files exist elsewhere).
- Version is the hook stamp. Some sessions may run a newer cached plugin than the stamp (the beta.59 stamp covers 10-05 to 10-18, and the cache folder lists beta.69, 73 and 75). Group edges are therefore soft.
- Native-host replies are by design not Larry-labeled, and the installed text says no label in code, JSON, artifacts or protocol output. Status reports for the owner (executor progress, commit lists) naturally have no reframe or question. Low reframe and opener rates may reflect task mix, not drift.
- Regexes are crude. Reframe over-matches; closeq misses next-step closings without a question mark; sentence counting is approximate for lists; framework dumping uses a fixed name list; the Stop-hook echo of a Larry line in the current session was not counted as a reply.
- Pre-existing instructions in the owner's profile (terse, Feynman style, no em dashes) also push replies toward short plain text and could mask or imitate Larry markers. This cannot be separated with these data.
- Not measured: whether the glyph matches the move (challenge versus building), tone, warmth, or whether the user found it Larry-like. That needs a human panel or the other lenses.

STATUS: DONE
