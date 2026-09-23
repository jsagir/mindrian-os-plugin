---
phase: 355
kind: origin-concept
source_room_entry: ~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-origin-concept-algorithmic-generation-of-rs-solutions.md
source_deck: Downloads/Algorithmic Generation of Solutions.pptx (2025-04-20)
compositing: verbatim copy; edit the room entry first, then re-copy
---

---
methodology: research
title: "The origin concept behind Eureka: 'Algorithmic Generation of Reverse Salient Solutions' (deck, April 2025) read against the Phase 355 rethink"
created: 2026-09-23
status: active
room_section: research
source: "Downloads/Algorithmic Generation of Solutions.pptx (15 slides, 1 note, 3 illustrative images; file dated 2025-04-20); text extracted from the slide XML, images viewed"
informs: "MindrianOS-Plugin Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection engines); the honesty pass on the structural_transfer / semantic_implementation sign convention"
---

# The origin concept behind Eureka (2026-09-23)

> The navigator asked for the concept that originated the whole opportunity / Eureka
> service. This is it, read in full, then read against today's two design notes. The
> deck is the ancestor of `rs-differential-scorer.cjs`, `rs-math.cjs`, `hsi-lsa.cjs`
> and the Eureka critic; several of the "new" devpkg capabilities are already present
> in it as failure notes the author wrote down while testing.

## 1. What the deck says, slide by slide (compressed, nothing added)

- **Title (1):** Algorithmic Generation of Reverse Salient Solutions.
- **Document acquisition (2):** decide topic(s) of interest -> decide input keywords ->
  Scopus database -> filter for relevant documents -> a smaller set of papers matching
  the topic(s) -> the algorithm. The corpus is the published literature, not a user's
  own material.
- **Two measures of similarity (3):** Latent Semantic Analysis, "shallow" -- unsupervised
  word co-occurrence, compared paper by paper, "compares words". Semantic Textual
  Similarity with a BERT transformer, "deep" -- similarity over the entire abstract at
  once, "compares meaning of whole text".
- **Processing algorithm (4):** input keywords -> determine the most reverse-salient
  issue -> collection of documents -> filter for relevant documents -> measure of
  similarity #1 -> measure of similarity #2 -> **find the highest difference between
  the two: "most unusual pairings"** -> determine maximal pairwise documents ->
  display top 1000 -> **report to user; the user scans over pairings and decides.**
- **Test domains (5):** Plants (~2,000 papers), Drones (~5,000), Automobiles
  (~10,000), Sleep (~10,000).
- **Drones (6-8):** top 1,000 displayed; the last 100 (ranks 990-999) were looked over
  in detail; found a human-swarm-teaming surveillance paper (reinforcement learning
  balancing human and swarm workload) paired with a naval-warfare paper on
  system-triggered dynamic allocation of visual-attention tasks. Stated opportunity:
  offload naval visual tasks automatically to a drone swarm.
- **Plants (9-11):** top 500 displayed, then keyword filters to what was wanted ("at
  home", "consumer"); found a wireless-sensor intelligent home potting system paired
  with a speech-based plant-care system for elderly and special-needs users. Stated
  opportunity: combine auto-caring plants (a large technological barrier) with
  elderly-friendly design.
- **Automobiles (12-14):** keyword filter "car" -- **"apparently automobile means
  something else in biology"**; then "wire" and "efficiency"; found battery-line
  communication for x-by-wire (10.2 Mbps to a rear light, 297 kbps to the battery
  because of engine/AC/wiper noise) paired with a GaN junctionless FinFET switch that
  gave a 2% efficiency gain in wireless charging. Stated opportunity: use the novel
  FinFET as the switch to improve battery-line communication.
- **Sleep (15):** mostly improved diagnostics; multiple search phrases paired
  machine-learning papers with polysomnography-for-insomnia papers; **"looked it up,
  looks like someone tried this last year with promising results."**

## 2. What the origin actually is, in one sentence

Two encoders, one corpus, and the **difference** between shallow and deep similarity as
the signal: a pair of papers that agree on meaning but not on words, or on words but
not on meaning, is an "unusual pairing", and unusual pairings are where a reverse
salient's solution hides. Everything after that is filtering, ranking, and a human
scanning the tail.

## 3. Read against the two notes filed today

**The sign convention was never in the concept.** The deck says "highest difference"
and stops. It does not say which direction means what. The two directions the plugin
later named (`structural_transfer` / `semantic_implementation`) were added afterwards,
and today `rs-math.cjs`, `hsi-lsa.cjs` and `detect-reverse-salients.py` disagree on
which sign is which. The honesty pass in Phase 355 should not pick a convention by
majority vote of the code; it should derive the two directions from the deck's own
semantics and name them by what they mean:

- **deep high, shallow low -- same meaning, different words.** This is the vocabulary
  bridge: two fields describing one structure with disjoint terms. It is the
  hidden-in-plain-sight class, the one Terminology Translation exists to widen and the
  one that maps to "analogical transfer" in the discovery-pattern taxonomy. The drones
  and plants results are both of this kind.
- **shallow high, deep low -- same words, different meaning.** The false friend:
  "automobile means something else in biology." Usually noise; occasionally a
  different-implementation opportunity (same terms, new mechanism), which is what the
  automobiles result is.

Whatever the labels end up called, they should be defined by these two sentences, with
the deck cited, and the code made to agree with the definition rather than with itself.

**The devpkg's capabilities are already in the deck as failure notes.** The author
wrote down, while testing, exactly the gaps the 2026 devpkg later specified:

| Deck moment | Devpkg capability it anticipates |
|---|---|
| "automobile means something else in biology"; filtering by "car", "wire", "at home" | #1 Terminology Translation (domain-aware vocabulary), and a domain filter before pairing |
| "looked it up, looks like someone tried this last year" | #2 Temporal Convergence and #4 KG-Verified detection: check whether the combination already exists before calling it an opportunity |
| "user scans over pairings, decides"; "top 1,000 displayed"; "last 100 looked over in detail" | #3 Discovery Pattern labels and #6 Bit-Flip-Spark: make each pairing self-explanatory so a human can scan a thousand; and the Eureka tail-quadrant (the surprise is in the tail, not the top) |
| keyword filters "to what was wanted" | #7 Problem Decomposition: the search intent had to be supplied by hand each time |
| Sleep: "largely results on improved diagnostic tests" | #8 Supervisor Reconciliation: a domain where the differential returns the obvious, and the system should say so rather than rank it |

**The origin runs at literature scale; the plugin miniaturized it into the room.** The
deck's corpus is Scopus, filtered to thousands of papers per domain. The plugin's
`rs-engine.cjs` and `hsi-engine.cjs` point the same two-encoder differential at the
room's own artifacts, and the July consolidation audit judged them as room-differential
engines. Today's "make them external services for research-heavy cross-connections" is
therefore not a new direction: it is the original pipeline asking to get its corpus
back. In the three-homes design, the deck is Home C by construction (corpus -> two
encoders -> differential -> top-N -> human), and Home A is the later, smaller
adaptation of it to a single room. Both are legitimate; the deck settles which is the
ancestor.

**The human at the end of the pipeline is the design, not a limitation.** "Report to
user; user scans over pairings, decides" is the deck's final step, and every result
slide is a human reading two abstracts and writing one sentence ("potential
opportunity: ..."). That is the Eureka critic's job description and the
ratify-by-human rule in one line, stated in 2025 before either existed.

## 4. Three things the deck does not have, that Phase 355 adds

- A verifier between the pairing and the human: the deck's only check was the author
  looking a result up by hand (Sleep). KG-verification against Theo's canon plus a
  Jev citation-check Choice is that step, automated and stamped.
- A typed name for what kind of pairing it is: the deck reports pairs; it never says
  "this is an analogical transfer" or "this is a recombination". The 8-pattern Choice
  is that.
- Any scoring beyond the raw differential: the deck displays top 1,000 by difference
  and leaves the rest to eyes. The plugin's later floors (0.3 / 0.2 / 0.2 and the
  rest) are additions with no calibration behind them, which the deck never claimed
  either -- consistent with treating them as unverified until sourced.

## 5. Numbers from the deck, sourced

Domain sizes (~2,000 / ~5,000 / ~10,000 / ~10,000 papers), display sizes (top 1,000;
top 500; ranks 990-999 read in detail), and the two paper figures quoted on the
automobiles slides (10.2 Mbps vs 297 kbps; 2% efficiency gain) are the deck's own
statements. No validation rate, precision, or hit rate is stated anywhere in the deck.

## 6. The navigator's framing (2026-09-23, same session, paraphrased)

The deck is old, but MindrianOS with Theo and Jev can take the concept further: an
innovation Eureka engine **built on strategy rather than keywords and context alone.**
This deck is what originated HSI, rs-engine, find-analogies, whitespace, SAPPhIRE and
the rest; now, with Jev, Claude, the ICM structure, Theo and the local graph, the
concept can be completed.

Read against the deck, "strategy rather than keywords" names its two weak ends
precisely. The front end is keyword-driven: topic -> hand-typed keywords -> Scopus ->
"car" / "wire" / "at home" filters, with the reverse salient chosen by the operator.
The back end is context-blind: a thousand raw pairs and a human with no stated
strategy for what to look for. What MindrianOS has that the deck did not, mapped to
those two ends:

| Deck's weak end | What replaces it | Where it lives |
|---|---|---|
| Keywords chosen by hand | The room's own strategic state chooses the query: the reverse salient the room actually has (RS over the room graph), the venture stage, the JTBD, the problem type on Theo's taxonomy ladder, the structural holes (Burt) in the room's own graph | Home A + Theo `taxonomy_ladder` / `classify_problem_type` |
| Operator picks "the most reverse-salient issue" | Same: it is derived, with provenance, not typed | Home A |
| Filter by "car", "wire" | Terminology Translation widens the query to every domain's word for the same structure; a domain-aware relevance Noul filters | Home A map + Jev Noul |
| Two encoders, one differential, a raw top-1000 | Same differential, kept; then a Jev Choice names the pairing's discovery pattern, a Theo path + Jev citation-check verifies it, and a supervisor step flags where signals disagree | Home A -> B -> C |
| Human scans a thousand pairs | Human reads twenty explained, verified, pattern-labeled pairs, each with a Bit / Flip / Spark line | Larry composes, human ratifies |
| Opportunity written as one sentence on a slide | Opportunity filed as a proposed claim in the room's ICM structure with `SOURCED_FROM` provenance, cascading to the sections it changes, and handed to the methodology Theo recommends next (SAPPhIRE for the structural mapping, TRIZ for the contradiction, scenario planning for the timing) | navigation.cjs + Theo `recommend_chain` |

The difference is not a better ranker. The deck's pipeline produced pairs; the
completed engine produces a strategic move: where the venture is stuck, which
outside structure resolves it, what kind of transfer that is, whether the graph
supports it, and which framework to run next. That is what "strategy rather than
keywords" cashes out to, and it is the sentence Phase 355's spec should open with.

## Cross-references

- `research/2026-09-23-hidden-in-plain-sight-jev-through-theo-design.md` (the Phase
  355 brief; section 6 "one label, three meanings" is resolved by section 3 above)
- `research/2026-09-23-algorithm-engines-external-service-rethink.md` (earlier note)
- dev/MindrianOS-Plugin: `lib/core/rs-math.cjs:401`, `lib/core/hsi-lsa.cjs:7-20,130`,
  `scripts/detect-reverse-salients.py:30-37`, `lib/core/rs-differential-scorer.cjs:450`,
  `lib/core/eureka/tail-quadrant.cjs`
- Drive folder `algorithm-incorporation-devpkg` (the 2026 capabilities the deck's
  failure notes anticipate)
- Mirror to `MindrianOS/research/` and copy into
  `.planning/phases/355-.../355-ORIGIN-CONCEPT.md` per the Dev-Research Compositing rule.
