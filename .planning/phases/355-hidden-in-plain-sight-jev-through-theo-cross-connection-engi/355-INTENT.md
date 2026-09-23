---
phase: 355
kind: intent
source_room_entry: ~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-engine-intent-opportunity-review-and-pws-author-ruling.md
compositing: verbatim copy; edit the room entry first, then re-copy
---

---
methodology: research
title: "What the Eureka engines are for: the April 2025 opportunity review, the HEART pitch, and the PWS author's ruling that placed the tool in the methodology"
created: 2026-09-23
status: active
room_section: research
source: "Navigator paste, 2026-09-23: an AI-generated opportunity review + devil's advocate + HEART pitch story of the 'Reverse Salient Generator' (April 2025), and a 2025-04-20/21 email exchange with the PWS author. Email addresses omitted; first name only."
informs: "MindrianOS-Plugin Phase 355 SPEC (Goal, Background, users, acceptance); the 'strategy rather than keywords' framing"
---

# What the Eureka engines are for (2026-09-23)

> The deck (see `2026-09-23-origin-concept-...`) is the mechanism. This paste is the
> intent: who the engine serves, what stage of the methodology it belongs to, and what
> would make it fail. Nothing below is new analysis; it is the 2025 material compressed
> and then read against Phase 355.

## 1. The 2025 review, compressed

**Where it sits.** "At the edge of un-defined and ill-defined problem territory,
focusing not on solving existing problems but surfacing new ones by mining unexpected
connections between academic domains." A meta-opportunity: not a direct need, but "a
method to discover future needs and solution configurations." Its one-line framing:
**"You're not solving a problem. You're solving how we even find the right problems
to solve."** From serendipity to systematic provocation.

**Who cares.** Innovation teams at R&D-heavy firms; strategy and foresight consultants;
think tanks and policy labs; research universities and grant funders; deep-tech VCs;
national labs. "A systems innovation tool, not a widget... an instrument for
institutions and teams to discover what's worth building."

**Why current solutions are inadequate.** Human brainstorming (biased, narrow); trend
decks and market maps (lagging indicators); patent scraping (overly specific). The
blind spot: true cross-disciplinary analogical reasoning, reproducible and
explainable. The missing link: a structured way to mine reverse salients.

**What the review said was missing (2025).** End-user fit (PhD students? startup CTOs?
patent examiners?); interface (paper pairs? heatmaps? maps?); **trust and
transparency: "how will users interpret algorithmic relevance scores?"**; business
model. "You have a compelling engine -- now frame the vehicle and the road."

**Devil's advocate, four objections.**
1. Are unusual pairs actually useful? "A drone paper plus a garden robot doesn't equal
   a product. Signal-to-noise could be low."
2. Overfitted to research papers? Does it work for patents, clinical trials, internal
   R&D memos?
3. Can it scale beyond academic curiosity? Will people use it weekly to generate
   portfolio ideas, or does it stay a fascinating demo?
4. Who decides what is "reverse" or "salient"? The term implies a model of progress
   that may not be consistent across domains; a reverse salient in automotive may not
   look like one in biology.

**Extension (the "how can this opportunity be extended" moves).** Pair with strategic
foresight (scenario generation); user-defined filters (ethics, market size, funding
trends); low-data domains; voice copilots; and the wild one: auto-generate DARPA
calls, NSF prompts, or challenge prizes from emerging salients.

**Three questions the review left open.** How do we validate the usefulness of
weirdness? What is the design brief for making this usable by humans, not just
technically sound? Can the system seed not just ideas, but strategic bets?

**The HEART pitch, in its own words.** "We built a system that can tell you what to
build next. Before your competitors. Before the market even knows it wants it. This
isn't just smarter search. It's an engine for discovering the unknowns worth
chasing." Functions named: scan thousands of papers; detect unusual but
high-potential pairings; highlight the most surprising combinations in a topic; flag
where bottlenecks exist and what has been tried elsewhere to solve them; present a
curated map of unconventional solution pathways. Ask at the time: $500K for real-time
querying, a UI layer, and export.

## 2. The ruling (2025-04-21, PWS author, quoted)

> "This is a tool I use in the ill-defined section. But I never had a good
> methodology, until now. I think ... this is big, and will become one of the most
> powerful tools in the toolkit. I also think it will become integral to the How can
> this Opportunity be Extended section."

Asked whether it is a form of trending-to-the-absurd:

> "This is not trending to the absurd. This is its own tool and is also a great way
> of EXPANDING and EXTENDING the opportunity in any review. According to the Medici
> Effect, this is how breakthrough innovations are achieved."

Three facts fixed by that ruling: the tool's **home stage is the ill-defined
problem section**; it is **its own tool**, not a variant of trending-to-the-absurd;
and it doubles as the **"extend the opportunity" step of any opportunity review**,
grounded in the Medici Effect (intersections of fields produce breakthroughs).

## 3. What this fixes for Phase 355

**The trigger is a stage, not a keyword.** The engine belongs to two moments in the
PWS flow: when the room's problem is ill-defined (the real problem is not yet named),
and when an opportunity under review needs extending. In MindrianOS those moments are
already typed: Theo's problem-type classification and taxonomy ladder for the first,
the opportunity-review commands and the opportunity bank for the second. That is what
"strategy rather than keywords" means at the front end: the room's stage and the
review step decide when the engine runs and what it looks for; the operator never
types "car".

**The four objections map to the four homes of the design.**

| Objection (2025) | What answers it in the Phase 355 design |
|---|---|
| Unusual pairs may be noise | Verification against Theo's canon plus a Jev citation-check before anything is shown; a discovery-pattern label so the human knows what kind of pairing it is; the supervisor step when signals disagree; the human ratifies at a gate |
| Overfitted to papers | Home A already runs the same differential over the room's own artifacts (the "internal R&D memos" case); Home C runs it over literature corpora; the two are declared in the payload (`backend`), never conflated |
| Weekly use vs. demo | The engine fires from room state inside the existing review flow, not as a standalone toy; the opportunity files into the room and cascades (this is the "vehicle and road" the review asked for) |
| Who decides "reverse salient" | The room decides, for its own system: the reverse salient is derived from the room's graph (its lagging section, its structural holes), and Terminology Translation carries that structure across domains without asserting one domain's model of progress on another |

**"Trust and transparency: how will users interpret relevance scores?"** is answered
by not showing them scores. The devpkg's "no fake precision" rule and the Jev
docs' "not a calculator" rule agree: the user sees a pattern name, a verification
stamp with the path, and a Bit / Flip / Spark line -- never a 0.87.

**"Validate the usefulness of weirdness"** becomes an acceptance criterion, not a
philosophical question: on real rooms, a human-judged hit rate on the shown pairs,
compared against the deck-era baseline of scanning a thousand raw pairs. The deck
itself never stated a hit rate; Phase 355 should be the first thing that measures one.

**"Seed strategic bets"** is the handoff: the accepted pairing goes to the framework
Theo recommends next (SAPPhIRE, TRIZ, scenario planning) and, per the review's
extension list, can seed a funding-opportunity entry in the room's opportunity bank.

## Cross-references

- `research/2026-09-23-origin-concept-algorithmic-generation-of-rs-solutions.md`
  (the mechanism this entry gives the intent for)
- `research/2026-09-23-hidden-in-plain-sight-jev-through-theo-design.md` (Phase 355
  brief; three homes, one wire shape)
- Drive folder `algorithm-incorporation-devpkg` (its "no fake precision" and output
  shape rules are the trust answer)
- Mirror to `MindrianOS/research/` and copy into the Phase 355 dir as
  `355-INTENT.md` per the Dev-Research Compositing rule.
