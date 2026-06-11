# RESEARCH: Human-Gate Harvest outcome + Tester Round 2 protocol (2026-06-11)

GSD research input. Consumed by: milestone scoping (v1.13.1 closeout / v1.14.0), /gsd-plan-phase for any verification-closure phase, and the Part 10 ratification decision.

Provenance: v1.13.1 drift audit (.planning/v1.13.1-DRIFT-AUDIT.md) + harvest sweep over the venture room tester evidence (room-side detail: product-evolution/audits/2026-06-11-human-gate-harvest.md, reachable via the repo .umbilical -> room mindrianOS). Testers are pseudonymized here per the no-real-names repo rule; full mapping lives room-side.

## Source-of-Truth Preamble

- CODE claims read against: dev workspace ~/dev/MindrianOS-Plugin @ v1.13.1-beta.15
- EVIDENCE claims read against: room tester artifacts dated 2026-05-20 .. 2026-06-08 (builds beta.17 / beta.34 / June-7-era)
- Date: 2026-06-11
- Re-verification rule: all tester evidence is version-tagged; evidence from build X never closes a gate whose contract shipped after X.

## Finding 1: no human_needed gate closes on existing evidence

20 gates across 8 phases (88, 114, 115, 116, 118, 123, 126, 150.5): 5 PARTIAL, 13 NO-MATCH, 2 STALE-GATE. Root blocker is VERSION INCONGRUENCE: all live human sessions predate the surfaces the gates verify (first-touch 114/115/116 fixes and the 150.5 dial contract shipped after the last tester session). The cohort experienced the disease, never the cure.

## Finding 2: two gates verify a retired surface (re-scope, do not verify)

126-H1 (Step 9.6 minisite lockstep live run) and 126-H3 (minisite browser check) verify the install minisite RETIRED 2026-06-09 (single canonical surface = mindrian-os.com; release.sh NO_MINISITE defaults 1). Action: amend Phase 126 VERIFICATION to mark both items superseded, citing the retirement decision; replace with a mindrian-os.com live-poll check if a live release run is ever staged.

## Finding 3: new HIGH install-lifecycle bug from remote tester evidence

Silent plugin disable after `claude plugin update` collided with a Claude Code self-upgrade (2.1.163 -> 2.1.168, 2026-06-07); no self-correction, no user signal. Filed: .planning/debug/plugin-silent-disable-after-cc-self-upgrade.md (install-cache failure family, candidate case 7). Any tester-round machine must be checked for this state BEFORE the round.

## Finding 4: Part 10 baseline tally exists for the first time

Thinking-partner sentiment across 6 testers (pre-cure builds): 2 clear YES (one hands-on, one secondhand demo), 1 MIXED (operator-dependence concern), 1 NO (cold-start orientation failure at beta.17), 2 no statement. Threshold is 4/5. No Hooked re-score artifact has ever been produced (gate needs >= 55 composite; Phase 114's sub-gate needs >= 38). The tally is a BASELINE, not a verdict: the NO and the MIXED were recorded against builds that predate the phases built to fix exactly those complaints.

## Tester Round 2 protocol (the live leg, redesigned)

Cohort (pseudonymized; identities room-side):
- T1: researcher, CLI, negative first-touch at beta.17 -- the key re-dose subject
- T2: faculty power-user, CLI, 2h+ live sessions at beta.34
- T3: returning operator, CLI, built 2 rooms unaided at beta.34
- T4: Windows candidate, never installed -- doubles as the 123-H1 fresh-install gate
- T5: remote tester, CLI, Brain key active, hit the silent-disable bug
- (T6: pointer-only tester; include if reachable)

Pre-round checklist (every machine):
1. Verify plugin enabled + current build (the Finding-3 check); record exact version in every observation artifact.
2. Issue missing Brain API keys (two cohort members were never issued keys -- a repeated friction theme).
3. Confirm room-side filing path: one artifact per session under sub-rooms/feedback/testers/<tester>/ with build version in frontmatter.

Round design (validation week, 5 working days):
- Day 1-2, CLI re-dose (T1 mandatory, T3, T5): cold-start first touch on CURRENT build. 15-minute silent observation per the 114-H4 protocol; score against tests/fixtures/114-larry-voice-rubric.md (6 BASH + 4 HUMAN). T1's session is the decisive A/B against his beta.17 baseline.
- Day 2, Windows fresh install (T4): marketplace install on a real Windows box -> closes 123-H1; capture install-state.json topology.
- Day 3, surfaces nobody has ever tested: one Desktop session + one Cowork session (any cohort member; zero evidence exists for either surface). Covers 114-H2/H3 + the 116-H2 cross-surface F.1 smoke.
- Day 3-4, the reward arm with LIVE KEYS (T2 or T3): VERCEL_TOKEN + MINDRIAN_BRAIN_KEY + TAVILY_API_KEY; paste a venture sentence; observe the auto-fired MVA brief end-to-end (sentence -> option click < 60s; real Vercel deploy = 118-H1/H2). Observe a dial card render keyed on the trailer (150.5-H1) and any tension resurface at next session start (116-H1).
- Day 4, async round: the 115-H1 vivid-memory email to the named 5-tester cohort (template exists in Phase 115 artifacts); 4-of-5 bar.
- Day 5, scoring: compute the Hooked re-score (skill: hooked-model; composite >= 55 for Part 10, >= 38 for 114-H4) + the thinking-partner tally (>= 4/5). File a single round-2 synthesis artifact room-side; cite per-gate evidence into each phase VERIFICATION.md dev-side.

Instruments: 114 voice rubric (exists), 115 email template (exists), hooked-model skill scorecard (exists), 15-min silent-observation script (write 1-pager before round), per-session evidence frontmatter (build, surface, gate IDs touched).

Exit criteria: every gate gets a verdict (closed-with-citation / failed / formally de-scoped). No gate stays human_needed after the round -- that status expires with the round.

## Quick wins independent of the round

- Phase 88 closer: scripted two-session defer->reference test + quiet-env timing run; plan at .planning/phases/88-feynman-minto-memory-layer/88-HUMAN-GATE-CLOSER.md.
- Re-scope 126-H1/H3 (Finding 2) -- doc edit, no humans needed.
- Session-binding observation (filed in passing): registry.active silently reverts to the session birth room between turns (Phase 128.1 binding re-asserts per prompt), so /mos:rooms switch does not survive the next turn mid-session. Candidate UX bug or undocumented by-design; needs a decision.
