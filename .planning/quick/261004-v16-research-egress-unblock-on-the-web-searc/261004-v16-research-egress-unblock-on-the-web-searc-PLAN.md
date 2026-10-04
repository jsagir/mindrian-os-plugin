---
phase: quick
plan: 261004-v16
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/core/research-planner/families.cjs
  - lib/core/research-planner/planner.cjs
  - lib/core/research-planner/grants.cjs
  - lib/core/research-planner/quick.cjs
  - lib/core/research-planner/plan.cjs
  - tests/test-v16-web-slot-prose.cjs
  - tests/test-seed104-grant-family-loop.cjs
autonomous: true
planner: orchestrator-authored (navigator budget ruling 2026-10-04; hyper-critical fix, gsd-planner skipped)
must_haves:
  truths:
    - "On the web search lines a slot may carry a room phrase or a room question (prose-shaped, sentence boundaries allowed, markdown markers stripped, up to 200 chars) and the composed query is sent as written"
    - "A theo corpus leaf and any canon-name slot keep the strict composableTerm rule: prose there is still refused with term_not_composed (Canon Part 8 is about the Brain)"
    - "The grant card and the plan carry the exact strings that will leave, so the navigator approves the run once; grant writers accept web-line phrases"
    - "No audit fence, egress-policy line or Part 8 Theo test changes; bash tests/run-all-363.sh and bash tests/run-all-366.sh are green"
---

# Quick 261004-v16: research egress unblock on the web search lines (SEED-115 surgical step)

## Why

Navigator ruling 2026-10-04 (verbatim in SEED-115 and ROADMAP Phase 369.2): blocking room information
from search queries was wrong; MindrianOS must fully be able to search online. The bolt is
`lib/core/research-planner/families.cjs`: `composableTerm()` (line ~273) returns null for anything
`proseShaped()` (line ~253: markdown marks, underscores, lead markers, sentence boundaries) and
`SLOT_RULES.term_max_chars` is 80 (line ~49). Its header reads Canon Part 8 as covering the web
lines. Callers that refuse on it: `planner.cjs` ~580-582 (`fail('term_not_composed')`), `grants.cjs`
~114-120 `termsComposable`, ~192, ~266, ~403, `quick.cjs` ~564 `proseTermIn` -> `refused('term_not_composed')`,
`ambient.cjs` ~599 (reads the reason). `plan.cjs` ~521 says "never derived from room text ... (Canon
Part 8, D-10)". Pinned by `tests/test-seed104-grant-family-loop.cjs` S1, S2 (and the S7-S9 "stale prose
plan" legs).

## Design (decided; do not widen)

- Add `composableQuery(v)` in families.cjs beside `composableTerm`: trims, `stripMarkdown`, collapses
  whitespace, allows sentence boundaries and question marks, cap 200 chars (`SLOT_RULES.query_max_chars`),
  min as today; returns null only for empty, over-cap, or control characters. It is the rule for slots
  whose destination is a web search line (Tavily, WebSearch fallback). `composableTerm` is unchanged
  and stays the rule for `theo` corpus leaves and canon-name slots.
- Route by destination at the call sites: `composeFamily` / `composeForLeaf` pick the rule from the
  leaf corpus or the family's provider line (read how a leaf names its corpus: 'theo' vs the rest;
  366-15 D-09 says theo leaves carry canon-name slots). `quick.cjs proseTermIn` and `planner.cjs` ~580
  apply the web rule to web-destined terms and the strict rule to theo-destined ones. `grants.cjs`
  `termsComposable` accepts web-line phrases (grants hold terms for the web families); the theo compose
  path still refuses prose at compose time, so nothing prose reaches Theo.
- The composed string goes to the grant card / plan exactly as it will be sent (read what the card
  shows today; if it shows only family ids, add the composed strings to the card payload, no other
  card change). The audit ledger records the composed string as it already does for every query.
- Rewrite the families.cjs header and the `plan.cjs` ~521 comment: Part 8 governs the Brain (Theo);
  the web lines are governed by the run's grant. No egress-policy.json change. No Theo test change.

## Shared-tree rules

Main tree /home/jsagi/dev/MindrianOS-Plugin, `export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH`.
Nobody else is executing right now, but still: `git status --short -- <file>` before each edit, commit
per task with `git add <paths>` (`-f` under .planning/) then `git commit --only -m "<msg>" -- <paths>`;
never `git add .`/`-A`, `commit -a`, `stash`, `reset`, `--no-verify`; never kill a mindrian-mcp-server
or shell you did not start; no `npm install` at the root; no STATE.md or ROADMAP.md writes; hyphens only
(`/usr/bin/grep -P '[\x{2013}\x{2014}]'`). Be economical: the navigator is on a tight token budget.

<task type="auto" id="1" tdd="true">
  <name>RED: web-line phrases compose and leave; theo slots still refuse prose</name>
  <files>tests/test-v16-web-slot-prose.cjs</files>
  <action>
Write tests/test-v16-web-slot-prose.cjs (same harness style as tests/test-seed104-grant-family-loop.cjs):
W1 composableQuery accepts "How do hospitals in Israel procure imaging equipment?" (a question) and
"MOTJ cold chain losses in Tel Aviv 2025" (a phrase), strips a leading "- " list marker and emphasis,
caps at 200 chars, rejects empty and control characters. W2 composeFamily / composeForLeaf for a web
destination composes a query that CONTAINS the phrase verbatim (whitespace collapsed) and does not
return term_not_composed. W3 composeForLeaf for a theo corpus leaf with a prose slot still returns
term_not_composed. W4 grants.writeGrant and extendTerms accept a web-line phrase. W5 quick run_quick on
a plan whose only slot is a room question does not refuse with term_not_composed (use the existing
fixture room and fake fetch the 363 tests use; it may stop later for a different, honest reason, assert
only that the reason is not term_not_composed). W6 dash guard on the touched files. Run it: it must be
RED on W1-W5 (record PASS/FAIL). Commit the test alone.
  </action>
  <verify>node tests/test-v16-web-slot-prose.cjs exits 1 with W1-W5 failing, W6 passing</verify>
  <done>RED committed</done>
</task>

<task type="auto" id="2" tdd="true">
  <name>GREEN: composableQuery, destination routing, grant writers, card strings, Part 8 wording</name>
  <files>lib/core/research-planner/families.cjs, lib/core/research-planner/planner.cjs, lib/core/research-planner/grants.cjs, lib/core/research-planner/quick.cjs, lib/core/research-planner/plan.cjs</files>
  <action>
Implement the design above, smallest diff that turns W1-W5 green: composableQuery + SLOT_RULES.query_max_chars,
destination-aware checks at composeFamily/composeForLeaf, planner.cjs ~580, quick.cjs proseTermIn,
grants.cjs termsComposable (and ~403 pair check), the card/plan carrying the composed strings if it does
not already, the two comment rewrites. Keep every audit fence call. Do not touch egress-policy.cjs,
audit-ledger.cjs, canon-release.cjs, part8-egress-guard.cjs or any lib/mcp file. Run test-v16 (green),
then tests/test-seed104-grant-family-loop.cjs and record which legs now fail (S1 prose refusal, S2 grant
refusal, any S7-S9 prose leg).
  </action>
  <verify>node tests/test-v16-web-slot-prose.cjs -> all PASS; the seed104 red legs are only the ones that asserted the old refusal</verify>
  <done>GREEN committed</done>
</task>

<task type="auto" id="3">
  <name>Move the seed104 pins; full 363 and 366 aggregators; SUMMARY</name>
  <files>tests/test-seed104-grant-family-loop.cjs, .planning/quick/261004-v16-research-egress-unblock-on-the-web-searc/261004-v16-research-egress-unblock-on-the-web-searc-SUMMARY.md</files>
  <action>
In test-seed104-grant-family-loop.cjs change ONLY the legs that asserted the old refusal: S1 now asserts
the web destination composes the phrase and the theo destination refuses it; S2 asserts the grant
writers accept a web phrase and still refuse an empty or over-cap value; the stale-prose-plan legs
(S7-S9) assert the plan is accepted or re-planned, whichever the new behaviour is, with a dated comment
naming SEED-115 and the 2026-10-04 ruling. Then run `bash tests/run-all-363.sh` and
`bash tests/run-all-366.sh` once each and record the aggregator lines; if a leg outside these files is
red, record it with its first FAIL line and STOP (do not fix it). Write the SUMMARY (frontmatter, the
measured lines, before/after of each moved assertion, the three commit shas, open items for Phase
369.2: query composition from room questions, retiring the per-term grant loop on web lines, the
fixture-room measurement) and commit it with `git add -f` + `git commit --only`.
  </action>
  <verify>run-all-363 and run-all-366 report 0 failed; SUMMARY committed</verify>
  <done>Hand back the aggregator lines, the commit shas and any STOP</done>
</task>
