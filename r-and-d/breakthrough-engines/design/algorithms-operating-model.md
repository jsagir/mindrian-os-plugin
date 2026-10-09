# Operating model: five algorithms as one Mindrian deep-research loop

Status: DRAFT design, 2026-10-09. Nothing here is built. Facts about the papers were checked against sources on 2026-10-09 (see "Checked facts").

## Theo rule that applies (read first)
design/theo-binding-spec.md is WITHDRAWN: "no Brain, no Theo". The navigator has now asked for the work to follow Theo's methodology. Until the navigator says Theo calls are allowed again, this model uses Theo's published frame only as method (problem types, job names, framework names) and makes no Theo or Brain call. If calls are re-allowed, the earlier rules return: structured calls only, framework name as the only handle, Theo is method not evidence, plan approved before running.

## The loop
Theo's frame sorts a problem into Un-Defined, Ill-Defined, Well-Defined or Wicked, and its job canon names the section jobs this loop serves: explore (opportunity-bank), find-problem (problem-definition), find-bottleneck (strategy). The agent runs five stages. Each algorithm owns one question.

| Stage | Question | Algorithm | Theo job | Output |
|---|---|---|---|---|
| A. Whitespace | Where is the room's knowledge missing something? | Persistent homology; Bidirectional Topic Matching | find-problem, find-bottleneck | Hole and gap candidates, each a one-line problem handle |
| B. Bridges | Which other field has the missing piece? | BisoNet bridging; Uzzi atypicality | explore | Ranked far-domain base candidates |
| C. Mapping | Does the structure really carry over? | SME (built, sme-agent) | explore | Reframes and candidate inferences |
| D. Triage | Which surmises are surprising enough to test first? | Bayesian surprise; Uzzi atypicality | find-bottleneck | Ordered test list |
| E. Test and report | Is it true here? | Evidence search, falsifiers | all | Findings and open items, discovery only |

## Operator cards

### 1. Persistent homology (stage A, structural gaps)
- Input: concept co-occurrence graph built from the room (concept = noun phrase or tagged entity, edge = co-occurs in a document or claim).
- Run: GUDHI or Ripser, dimension 1 holes, record birth and persistence.
- Reads as: a long-lived 1-cycle is a set of concepts each tied to common neighbors but not to each other. Each cycle becomes a handle: "A, B, C, D are all linked to X but never to each other."
- Fit with Theo: a hole is a Reverse Salient candidate (a lagging region of the structure) and feeds Ill-Defined routing.
- Guard rails: compare against a degree-preserving shuffled graph; keep only cycles that beat the null. Room graphs are small and noisy, so treat output as prompts, not findings. The source paper measures citation outcomes of past papers, not business opportunity.

### 2. Bidirectional Topic Matching (stage A, unconsidered topics)
- Input: room text and a domain reference corpus (web-fetched, with source trail).
- Run: one BERTopic model per corpus, cross-applied. Unique topics have uniqueness of 0.5 or more.
- Two readings: domain-unique topics = things the field discusses that the room does not (whitespace); room-unique topics = what is distinctive about the room.
- Fit with Theo: first move for Un-Defined problems ("what might be worth solving"). Runs on CPU, lowest effort of the five.
- Guard rails: topic models vary by seed and size; run three seeds, keep topics that persist. Corpus choice drives the answer, so report the corpus.

### 3. BisoNet bridging (stage B, cross-domain access)
- Input: k-partite graph, one partition for the room and one per candidate domain, nodes are concepts, edges are relations or co-occurrence.
- Run: bridging scores for concepts that connect otherwise separate partitions. Pattern types in the bisociation literature: bridging concepts, bridging graphs, bridging by structural similarity.
- Fit: bridging concepts and graphs give cheap candidate bases. Structural similarity is the hard case and is what SME computes, so BisoNet proposes and SME disposes.
- Guard rails: bridging by shared words returns near-domain look-alikes. Require a relational signature, not a keyword, as the search handle (Gentner's access result).

### 4. Uzzi atypicality (stages B and D, combination novelty)
- Input: pairs of concepts (or fields) and a reference corpus with co-occurrence or co-citation counts.
- Run: z-score of each pair against a null; low tail (10th percentile) = unusual pairing. Novelpy computes this and related indices.
- Use: score the (target concept, base concept) pairing of each reframe. Best profile per the source work: conventional core plus a few unusual links.
- Guard rails: needs bibliographic data (for example OpenAlex); cost and coverage to confirm. A rare pairing can be rare because it is useless.

### 5. Bayesian surprise (stage D, triage)
- Input: a candidate inference or hole handle, stated as a testable claim.
- Run: ask the model for belief before and after reading gathered evidence; surprise is the divergence between the two.
- Use: order the test list so the claims that move belief most are tested first.
- Guard rails: it is a proxy that depends on the model's prior, repeated runs differ, and each score costs model calls. In the source study 67% of the method's surprising picks were also surprising to expert annotators, so about a third were not. Never cite a surprise score as evidence. Only ordering.

## Gates (decision points for the navigator)
1. After classification: confirm the problem type and which stage to start from (Un-Defined starts at A; Ill-Defined may start at B with a named target).
2. After A: pick which gaps to pursue (max 5).
3. After B and C: pick which reframes to test.
4. Before any web fetch: approve queries (same rule as find-analogies).

## Mapping to existing engines (09102026 workspace)
| Stage | Existing engine | Gap |
|---|---|---|
| A | engines/hsi (whitespace) | add persistent homology and BTM beside current UMAP and gap scoring |
| B | engines/analogies (find-analogies) | add BisoNet bridging; Uzzi as extra fitness term |
| C | engines/sme-agent | built; live web not tested |
| D | engines/eureka (breakthrough) | add Bayesian surprise and atypicality as triage terms |
| E | engines/rs verification | reuse evidence and provenance checks |

## Build order (smallest value first, no schedule implied)
BTM, then persistent homology, then Uzzi, then BisoNet bridging, then Bayesian surprise. BTM and PH need only the room text; the others need an outside corpus or paid model calls.

## Checked facts (2026-10-09, primary sources)
- Persistent homology paper: arXiv 2509.21899, 34,363,623 papers, 1900 to 2020. Gap-opening papers are more likely to be top 1 to 20% cited. The 58% figure was not found.
- BTM: arXiv 2412.18376; uniqueness 0.5 or above marks unique topics.
- AutoDiscovery: arXiv 2507.00310, repo allenai/autodiscovery-neurips; 67% is a precision-style agreement rate, not a correlation coefficient; 98% validity not found.
- Novelpy: arXiv 2211.10346. KARMA and GraphAgents are real; GraphAgents repo is small (9 stars).
- Not checked: GUDHI, Ripser, BERTopic license and stars, KNIME BisoNet implementations, OpenAlex coverage.

## Open
- Navigator: is the Theo withdrawal lifted, and for which calls?
- Which reference corpus per domain (stage A and B)?
- Where does stage D sit relative to the eureka engine's current scoring?

## Pipeline order (added 2026-10-09, design only)

The plan stage was missing. It goes first, and the local work is crossed with the external work before any claim is checked.

0. Plan. Larry-extended builds the JTBD of the research, its sub-jobs, and generic search strings. The navigator approves the queries before any search runs.
1. Local run. Whitespace (topic matching, homology), eureka, rs local. No outbound calls.
2. Deep research. Approved queries only: Tavily for web, academic indexes for papers, patents for prior art.
3. Cross. Local gaps are checked against external findings: missing in the room, and missing in the world (the two-sided check).
4. Extract. Claims with source excerpts. Errors here flow into everything after.
5. Jev claim check. Supported, contradicted or not stated, with probabilities. Advice only.
6. Code scoring and the backtest pass or fail against a plain baseline. No model scores.
7. Navigator gate. Confirms or rejects. Nothing is confirmed by a model.
