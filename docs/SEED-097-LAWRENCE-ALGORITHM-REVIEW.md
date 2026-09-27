# SEED-097: review of Lawrence's three-signal algorithm briefing

Date: 2026-09-27. Status: research and design review; no algorithm has been adopted by this document.

## Sources and scope

The source is the June 2026 algorithm R&D briefing mirrored under
`~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-algorithm-rd-briefing-mirror/`
(especially `03-tier1.md`, `04-convergence.md`, `09-impl.md`, `11-incorporate.md`,
`13-sources.md`). Its linked incorporation site is the devpkg already summarized in
`2026-09-23-algorithm-engines-external-service-rethink.md`. The two Vercel pages were
unavailable to the web reader on this pass; the dated local mirror is the basis for
quoting the briefing. Primary papers and software documentation were checked separately.

The briefing explicitly calls three-signal convergence a **thesis, not a demonstrated
capability**. It surveyed algorithms; it did not execute the proposed pipeline. Its
implementation sketch describes a different Mindrian V2 architecture, so the suggested
Python script, direct `room.db` reads and writes, new edge types, and two remote LLM calls
per finding are not a drop-in plan for this plugin or its Part 8/9 boundaries.

## Decision

Add the **three evidence dimensions and five named methods as design inspirations**
to SEED-097. The intended intelligence layer is a set of narrow, stated **Jev
judgment policies**, reached through Theo, over locally prepared typed evidence. It
does not require five new algorithm implementations. Existing code and the local graph
still gather candidates, enforce boundaries, count and rank measured facts, and keep
the run ledger; Jev supplies semantic classification and review judgments that the
briefing's methods suggest. Formal methods may be run offline as comparators if a
specific Jev policy needs validation. A three-way score is not a truth gate.

| Briefing method | What the source supports | Jev-inspired question and limit |
| --- | --- | --- |
| Persistent homology via GUDHI/Ripser | Kedrick et al. report an **odds ratio of 1.58** for gap-opening papers reaching the top 1% of citations in a 34.4M-paper historical analysis. This is an association in a literature concept network, not a 58 percentage-point lift or a validated room predictor. | Ask whether a locally nominated gap is a meaningful missing relationship, an extraction artifact, or already covered. Jev cannot calculate topological persistence or prove a hole exists. Existing navigation/whitespace evidence must nominate the candidate first. |
| BERTopic plus Bidirectional Topic Matching | Adam and Kogler compare topics across two corpora. A domain reference corpus could expose topics absent from a room. The briefing's `uniqueness >= 0.5`, low effort, and CPU cost are local proposals, not demonstrated Mindrian thresholds. | Ask whether a public reference theme is genuinely absent, present under another name, or irrelevant to the room's question. Jev cannot establish corpus-wide absence without a bounded retrieval and coverage record. |
| AutoDiscovery Bayesian surprise | Agarwal et al. measure an LLM's belief shift after evidence. Their human study reports **67% of system-surprising discoveries were also surprising to experts**; it is not a 67% correlation coefficient. | Ask for a closed novelty type: restatement, expected extension, non-obvious transfer, or unsupported. This is **not** AutoDiscovery's Bayesian surprise calculation. The shipped `scripts/compute-bayesian-surprise.py` is leave-one-out cosine shift, also not that calculation; distinguish the labels. |
| Uzzi atypicality through Novelpy | It measures unusual combinations of cited journals or other bibliometric units against a temporal null model. Novelpy implements such indicators on bibliometric/patent data. | Ask whether a cited combination crosses genuinely distinct mechanisms or only shares an unusual label. Jev cannot produce an Uzzi z-score without bibliometric counts and a null model. If those numbers matter, compute them offline from the public corpus. |
| BisoNets / bisociation | Berthold's work motivates finding bridges across heterogeneous domain networks; Ahmed and Fuge show a topic-based variant. The briefing's `partitions_connected × cross_partition_ratio` is its own simple proxy, not a proven BisoNets algorithm. | Ask whether a proposed bridge carries a transferable mechanism across two domains and which structural role it plays. Jev cannot discover every bridge in a graph without local candidate generation. |

Primary sources: [Kedrick et al.](https://arxiv.org/html/2509.21899),
[Bidirectional Topic Matching](https://arxiv.org/abs/2412.18376),
[AutoDiscovery](https://arxiv.org/abs/2507.00310),
[Uzzi et al.](https://pubmed.ncbi.nlm.nih.gov/24159044/),
[Novelpy](https://arxiv.org/abs/2211.10346),
[Berthold's BISON volume](https://link.springer.com/book/10.1007/978-3-642-31830-6),
[Ahmed and Fuge](https://arxiv.org/abs/1801.10084).

## Incorporations and verification

- **Terminology Translation** is already in the seed's pattern service. BioSage is a
  relevant example of cross-disciplinary terminology alignment, not a guarantee that
  a curated synonym map is sufficient for every domain. Record each expansion's public
  term, source, and approval status. [BioSage](https://arxiv.org/abs/2511.18298).
- **Temporal Convergence** is already explicit in the seed's corpus requirement and
  devpkg list. The Frohnert et al. dynamic-embedding paper supports a research spike,
  with a time-sliced corpus and retrospective evaluation; it does not validate a
  particular prediction threshold for Mindrian. [Frohnert et al.](https://arxiv.org/abs/2411.06577).
- **Discovery-pattern taxonomy** is already named in the seed. CrossTrace supports
  grounded reasoning traces and eight pattern labels, but its reported validation
  concerns its dataset/model, not Mindrian's opportunities. Reuse the labels only
  after checking fit and agreement on local examples. [CrossTrace](https://arxiv.org/abs/2603.28924).
- **Show your work** should become an explicit output contract. For each candidate,
  show the local cohort and graph path, the distinct whitespace/novelty/connection
  evidence, the closest counterexample or prior attempt, corpus citation and result
  hash where applicable, verification status, and what the human accepted or rejected.
  GraphMind demonstrates traceable literature context; an attractive graph path alone
  does not establish a claim. [GraphMind](https://arxiv.org/abs/2510.15706).

## Three-signal test, not a three-signal dogma

Define whitespace, novelty, and cross-domain connection as **separate evidence
dimensions** on a `DiscoveryCandidate`. Record `present`, `absent`, or `unmeasured` for
each, with provenance and calibrated score if available. Jev uses a separate stated
closed-enum policy per semantic judgment, plus a supervisor policy for disagreement.
Choice and Noul probabilities are not combined as if they were one scale. Do not turn
missing data into zero or use the briefing's geometric mean as an automatic discard
rule. Three independently supported signals can raise priority; disagreement should
trigger review and targeted research.

Evaluate four ranking policies on the same frozen candidates: the existing Phase 355 baseline,
each Jev policy alone, three-signal conjunction, and a calibrated ranker.
Include negative controls (same words/different mechanism, familiar pair without a
gap, accidental co-citation) and planted known transfers. Blind raters to the policy
that produced each card. Report top-10 useful rate, planted-transfer recall@10,
novelty beyond existing room edges, evidence completeness, cost, and disagreements.

The briefing's **at least 5 of the top 10 judged interesting** is a useful pilot
target, but `interesting` needs a written rubric and independent human judgment. It
cannot be compared directly with Phase 355's 43/96 overall useful rate because the
denominators and ranking positions differ. Seed acceptance should require both a
top-10 usefulness threshold and a recall/non-regression check; a highly selective
conjunction could otherwise look precise while missing the best transfers.

## Boundaries for a prototype

1. Build local cohorts and concept graphs through `lib/core/navigation.cjs`. A
   prototype must not open or mutate `room.db` directly.
2. Keep all room-derived text, embeddings, model priors/posteriors, and cross-room
   comparison on the user's machine. External providers receive only exact audited
   and approved query strings; reviewed results return with hashes and provenance.
3. Use the existing engine adapters and candidate ledger. Treat the five methods as
   inspirations for typed Jev policies, with explicit `not_applicable` and `uncertain`
   states when the supporting corpus, graph, or evidence is missing. Jev is a judge
   of supplied state, not a hidden calculator or corpus search engine.
4. File evidence as proposed through navigation; a human ratifies any truth claim.
5. Record input coverage, latency, Jev confidence/abstention, model version, and
   query/provider costs. The briefing's five-week timeline and room-scale runtime
   estimates are hypotheses to measure.

The existing 355 brief (`355-BRIEF.md`) already maps several similar capabilities to
Jev Choice, Noul, and Score questions and assigns counting and distances to code.
This review keeps that division while making Jev the main semantic decision layer.
There is a feasibility gate: a remote Jev call may receive only the Part-8-safe typed
state, not the room's prose or embeddings. Some questions above may be impossible to
answer reliably from those handles and buckets. Evaluate each policy with the actual
allowed wire state, blind to any richer local context. If that state is insufficient,
leave the judgment local or unresolved; do not enlarge egress to make the policy pass.
The Theo keyholder `judgment` seam is still a separate, gated dependency in Theo's
SEED-015; its current seed says no Jev code is authorized there before the written
rule amendment and discuss-phase. SEED-097 can design policies and run offline
evaluation without presenting that seam as already shipped.
