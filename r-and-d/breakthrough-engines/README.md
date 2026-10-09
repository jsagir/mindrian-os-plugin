# R&D index: where everything sits (saved 2026-10-09, not yet wired to Theo or MindrianOS)

Status of this folder: index only. It moves nothing. Every item below is a file in this workspace.

## Engines (engines/)
| Folder | What it does | Tests | Status |
|---|---|---|---|
| engines/eureka | breakthrough (eureka) engine | 74 pass | reviewed |
| engines/hsi | open-space (whitespace) engine | 30 of 31 pass (UMAP vs PCA test) | reviewed, one open item |
| engines/analogies | find-analogies, SAPPHIRE, TRIZ reference | pass | reviewed; method decision open |
| engines/algorithms | genesis, jason critique, opposable-mind model | genesis test broken | reviewed |
| engines/bono | debate a what-if | none | original, not reviewed |
| engines/rs | reverse salients: rs-explain, rs-experts, rs-fetch, rs-thesis, shared | 24 of 24 pass | reviewed; truncation open |
| engines/sme-agent | structure-mapping cross-domain agent | 18 of 18 pass | web access step untested |

## Bridges and checks
| Folder | What | Status |
|---|---|---|
| analogies bridge (package-2026/analogies/lib/sme_bridge.py) | candidate to SME, copy guard, MA control | 5 of 5 tests pass |
| design/jev-claim-check | Jev judges claims against excerpts | 4 of 4 agree with hand check; too few cases |
| design/cross-step | step 3: local gaps vs external results | seed gaps only; no room run |
| design/breakthrough-methods-register.md | five methods, claims checked | checked |
| design/algorithms-operating-model.md | pipeline steps 0 to 7 | design |

## Research outputs (research-queries/)
- academic results (OpenAlex, arXiv), Tavily results, C2 and A2 deep-research results. All PROPOSED. Candidates, not findings.

## Drivers (open-source, verified to exist; not installed)
| Piece | Driver |
|---|---|
| persistent homology | gudhi, ripser |
| topic matching | bertopic |
| novelty / atypicality | novelpy |
| Bayesian surprise | allenai/autodiscovery-neurips (licence not listed) |
| literature data | pyalex, OpenAlex, arXiv API |
| embeddings | sentence-transformers |
| judgment | Jev (TypeSafe API) |
| web search | Tavily API |

## Before Theo or MindrianOS (this week)
1. Settle the Theo rule: withdrawn ("no Theo at all") unless the navigator changes it.
2. Run step 1 on a real room.
3. Replace the seed gaps in cross-step with real ones.
4. Install the drivers in a controlled environment and run them on seed data.
5. Backtest each method against a plain baseline before any is called usable.
6. Plugin placement goes through GSD (the plugin rule), not a direct copy.
