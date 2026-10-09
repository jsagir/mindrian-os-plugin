# Breakthrough methods register (draft, 2026-10-09)

Status: register only. Nothing built. No Theo or Brain call is made by anything in this file.
Rule: a method counts as usable only after its backtest (run on a past date, against a plain baseline) beats the baseline. Until then it is a candidate.

## Checked against sources
| Claim in the source article | Checked | Result |
|---|---|---|
| Kedrick et al., arXiv 2509.21899: 34.4M papers, 120 years | abstract, 2026-10-09 | Confirmed: 34,363,623 articles, 1900-2020 (Microsoft Academic Graph). |
| Gap-opening papers "58% more likely" to reach top 1% | full text, 2026-10-09 | The figure is an odds ratio, OR = 1.58 (p < 0.001), for "exceptional citation success". It is not a probability and not a top-1% rate. The source article misstates it. Outcome, from the paper: the regression outcome sits in the paragraph that defines the top 1% most cited papers within the same year and discipline (coded 1 if in the top 1% by citations). Read the OR as odds of top-1% citation, 1.58 times the baseline odds. The paper does not name the outcome in one sentence, so this is an inference from the paragraph. |
| Bidirectional Topic Matching, arXiv 2412.18376 | full text | Title and method confirmed. The uniqueness threshold of 0.5 is confirmed in the text (topics at 0.5 or higher are unique). The "three seeds" advice is not in the text. |
| BERTopic "10K+ GitHub stars", MIT | not checked | Unverified. |
| Bayesian surprise "67% correlation" and "98%+ validity" | arXiv 2507.00310 abstract, 2026-10-09 | Partly confirmed (full text). 67% of AutoDiscovery's surprising discoveries are surprising to domain experts too. That is a share of discoveries, not a correlation. The 98% figure is not in the text. The abstract also reports 5-29% more LLM-judged surprising discoveries under a fixed budget. Use the two-thirds share only with that wording. |
| KARMA "38,230 entities at 83.1%" | not checked | Unverified. |
| Uzzi et al., Science 2013 (atypicality) | not checked | Unverified in this session. |

## The five methods
| # | Method | Job | Source status | Our 2026 version (proposal) | Backtest gate |
|---|---|---|---|---|---|
| 1 | Persistent homology (gap detection) | Find structural holes in a concept network | Paper confirmed (scale); citation figure not | Run on the typed claim graph and the embedding cloud; keep holes present in both | Must beat a shuffled-null graph |
| 2 | Bidirectional topic matching | Find domain topics the room does not cover | Paper confirmed (title, method) | Compare claim clusters, labelled by a model; watch for new topics over time | Must beat a single-direction baseline |
| 3 | Bayesian surprise | Order candidates by how much they would change belief | Figures unverified | Closed-book vs after-evidence belief, several priors; use for ordering only | Must beat plain expected-information ordering |
| 4 | Uzzi atypicality | Rank unusual but grounded pairings | Paper known; not checked | Claim-level pairings; add a usefulness check from SME or evidence | Must beat a random pairing baseline |
| 5 | BisoNets (bridging) | Find concepts that connect separate fields | Book source (Berthold 2012) known; not checked | Typed sourced edges; SME check on every bridge | Must beat a bridging-by-degree baseline |

## Tier 2 (study, do not build)
- GraphAgents (lamm-mit/GraphAgents): dual graph design. Study the exploit/explore split.
- KARMA (YuxingLu613/KARMA): enrichment agents. Figures unverified.
- GraphMind (oyarsa/graphmind): show the path behind each novelty score. Adopt the "show your work" pattern.

## Cross-cutting rules from the 2026 proposal
- Typed, sourced claims in place of keyword graphs. Every claim has a source pointer.
- Two-sided check: missing in the room, and missing in the world.
- Claim extraction is the weak point. Sample, use a second extractor, and report a precision estimate.
- Costs: a budget per stage, reported.
- Roles: code scores; the model extracts and labels; the navigator gates.

## Open
- Theo: DECIDED 2026-10-09, no Theo at all (navigator). One read-only call to Theo's section-job contract was made after the withdrawal note, by another session. It is a recorded exception. It returned constants only. It is not repeated.
- Reference corpus for each domain (drives the topic-matching result).
- Whether triage sits inside the eureka scoring.
