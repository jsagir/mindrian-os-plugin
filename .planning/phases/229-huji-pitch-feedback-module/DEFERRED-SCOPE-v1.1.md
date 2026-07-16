# Phase 229 - Deferred Scope for v1.1 (navigator ruling, 2026-07-16)

**Status:** PAUSED pending baseline demo review. Navigator wants to see the actual
gate-clean output from the current pipeline (post DI-1..DI-7 fixes) before deciding
whether to build any of this. Not abandoned - explicitly deferred, sequenced next
if approved after seeing the baseline.

Do not build any of this until the navigator has seen `demo/feedback-sample-1.md` +
`demo/feedback-sample-2.md` and explicitly says to proceed.

---

## Addition 1: Live research validation + cited hyperlinks

Grade the pitch's factual claims (market size, technology numbers, feasibility
figures) against real web sources, the way the old LarrAI process did (see
calibration/01-ldes-innovation-assessment.md - 5 targeted Tavily searches,
citations to IEA/Nature Energy/DOE). The current PWS_grading pipeline does NOT do
this - Stage B is scoped to `Read,Write,Edit,Bash(node lib/core/*)` only, no
WebSearch/Tavily, by design (cost/reliability control at N=200).

**Decisions already locked (navigator, 2026-07-16):**
- Tool: Tavily (navigator's default validation tool per dev profile), not a
  generic web-search grab-bag.
- Bounded: targeted searches on the highest-stakes claims only (3-5 per
  submission, matching the LDES precedent), never an unbounded crawl.
- Output: real hyperlinked citations embedded in the Minto feedback branches
  ("you claimed $17B market - actual DNA storage market is $74M, source: [X]").
- Cost impact: adds Tavily-call cost per unit on top of the existing $4-5/unit
  ceiling - needs its own cost pass before shipping, not assumed to fit inside
  the current fuse.

## Addition 2: "Path to A+" section

A new closing Minto section, grounded in evidence.json (nothing invented),
listing concrete next actions in 5 categories:
1. Unanswered questions (specific things the pitch never named)
2. Research required (claims stated but not sourced - connects to Addition 1)
3. Validation gaps (asserted-as-done but not demonstrated)
4. Science/technical claims to verify (specific, checkable technical assertions)
5. Unproven skills/team gaps (capabilities leaned on with no team member shown
   to actually have them)

Precedent: DnATA review's "Your Actual Homework" (name a real customer, run a
pilot, prove value today) and the DNA-storage review's "if it was A+" projection
- both already in the calibration corpus, this makes the pattern a guaranteed
structured section instead of ad hoc.

## Addition 3: Six Hats discussion on the "Path to A+" findings

Run `/mos:think-hats` (De Bono, already shipped, reuse per Canon Part 7) as a
discussion specifically about the Path-to-A+ gaps. Each hat is a persona derived
from the pitch's own actual technical domains, not a generic "White Hat" label.

**Framing (navigator ruling, 2026-07-16):** the hats do not just critique from six
angles. The discussion is anchored to one literal question - "how can this become
an A+, what needs to be done" - and each hat argues that question from its own
domain-derived vantage, in tension with the others. The synthesis call resolves
the disagreement into the concrete next-step ordering, not a summary of six
opinions.

**Decisions already locked (navigator, 2026-07-16):**
- **Hat naming convention:** each hat's display name = "{Domain-derived first
  name} {Subdomain-derived surname}", regenerated per submission from that
  pitch's actual technical territory. Example given: for SafeScan, White Hat
  might render as "Biosensor Allergendetection" (domain=biosensor engineering,
  subdomain=allergen detection). A different pitch generates an entirely
  different cast of six names from its own domains - never a fixed cast reused
  across students.
- **Generation architecture (cost-vs-fidelity trade-off, resolved toward cost):**
  NOT six independent judge sessions (would reuse Plan 06's `spawnJudge`
  mechanism, ~6-7 extra calls/student, highest fidelity, highest cost). Instead:
  ONE call generates all six hat perspectives together (prompted to force real
  disagreement/tension between hats, not let them collapse into agreement), then
  ONE separate synthesis call (Blue-Hat-style) pulls the six into a final
  coherent read. Total: 2 extra calls per student, not 7.
- Precedent: calibration fixture 02 (AI-in-Education) already used exactly this
  Six-Hats-review technique on a student's work - not new invention.

---

## Build order if approved

1. Research-validation + citation layer (Addition 1) - Path-to-A+'s "research
   required" category depends on this existing first.
2. Path-to-A+ section (Addition 2) - gives the Hats something concrete to argue
   about.
3. Six Hats discussion (Addition 3) - reads Path-to-A+ + citations as its input.

Each layer feeds the next; build in this order, not in parallel, to avoid
rewiring twice.

## Cost note (must revisit before shipping any of this)

Original phase 229 economics: ~$0.6-2.0/unit actual cost vs $4-5/unit quoted
(AI-SPEC Section 4). Additions 1+3 both add real per-unit model/API cost on top
of that. Re-run the unit-economics estimate once all three are designed, before
assuming the existing $4-5/unit quote to Amnon still holds at v1.1 scope.
