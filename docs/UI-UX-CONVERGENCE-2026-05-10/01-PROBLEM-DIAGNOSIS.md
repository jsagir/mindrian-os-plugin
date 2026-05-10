---
methodology: diagnose
created: 2026-05-10
venture_stage: Design
topic: MindrianOS UI/UX system + install/distribution stack
brain_mode: mode-a confirmed (produced Tier 0 while Aura was paused; re-run against the live Brain 2026-05-10 -- classification "Ill-defined x Complex/Wicked" has direct graph support, including a literal "Ill-Defined + Wicked" node; see 00b)
---

# Problem Diagnosis -- MindrianOS UI/UX

## Problem description (the user's words, paraphrased)

The UI/UX system has 13 self-contradictions; the install fails four ways from one unaddressed root; the queued v1.14.0 (wiki) and v1.10.8 (smart-notebook) work would pile *more* UI onto an unwritten foundation. Where do we start?

## Classification (described, not labelled)

Something is broken and the symptoms are now describable -- 13 doc-level contradictions, five named legibility pains, a UI system that grew CLI-first and is now spreading to a browser and a conversational surface -- but the *real* problem has been a moving target ("design problem... no, legibility problem... no, 'nobody wrote the system down' problem"). It's a problem getting *more* defined as it's worked, not less. Causes are entangled: touch the picker, the conversational surface moves; resolve a token, three contradictions shift. A few corners (install failing, the statusline lying) now have nameable causes -- those have crossed over into "go fix this." Most of it is still in the "decompose before you decide" zone, with a genuinely contested tail (the conversational surface, one-vs-two visual systems, where the picker lives) that has conflicting authoritative voices and no obvious stopping rule.

In the PWS 2D matrix: **Ill-defined (late stage, partially crossing to Well-defined) x Complex (bordering Wicked).** Routing cell: Ill-defined x Complex -> `map-unknowns, analyze-systems`; Ill-defined x Wicked -> `think-hats, leadership`; the install/room-identity corners sit in Ill-defined x Complicated -> `root-cause, find-bottlenecks`.

## Recommended methodology sequence

| Priority | Command | Why it fits | What it produces |
|---|---|---|---|
| 1 | `/mos:analyze-systems` | The system was never decomposed; contradiction-hunting and journey-mapping on top of it is painting incoherence | Layer decomposition (primitive->semantic->component tokens, per-surface renderers, seams) + leverage points |
| 2 | `/mos:structure-argument` | MECE the 13 "contradictions" -> stop resolving the same conflict three times; produce the spec | MECE-grouped contradictions + a Minto-structured resolution argument |
| 3 | `/mos:find-bottlenecks` | The install stack + the room-identity surface are the reverse salients | Ranked lagging components with theses |
| 4 | `/mos:challenge-assumptions` | Devil's-advocate each genuinely-complex contradiction's resolution before ratifying | Stress-tested resolutions |
| 5 | `/mos:think-hats` | The wicked tail only -- conversational surface, one-vs-two systems, picker location | Hat-by-hat briefings on the contested few |

## Suggested path

Start **1 + 3** (decompose the system; find the reverse salients -- they inform each other). Then **2 -> 4** (MECE the contradictions; stress-test the resolutions). Hold **5** for the handful still contested after step 2. Net: a written-down UI system, a ranked fix queue grounded in user pain, a contradiction set sorted by "decide now" vs "needs perspectives."

## What was actually run this session

`/mos:user-needs` + `/mos:analyze-needs` (-> `02`), `/mos:analyze-systems` (-> `03`), `/mos:find-bottlenecks` (-> `04`), `/mos:structure-argument` (-> `08`), plus a manual contradiction audit (`05`), a 10-decision survey (`06`), a tester-evidence design brief (`07`), and -- after the Brain came back online -- a direct Brain consultation on the activation gap (`09`).
