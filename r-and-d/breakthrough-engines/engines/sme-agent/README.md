# SME Cross-Domain Research Agent

Turns the Structure-Mapping Engine paper (Falkenhainer, Forbus, Gentner, 1989) into a deep-research agent that looks at a problem through another domain.

## What is here

| Path | What |
|---|---|
| `lib/sme.py` | The engine. Match hypotheses (LS, AN, MA rule sets), consistency (Conflicting, Emaps, NoGood), three-step gmap merge, candidate inferences with skolem entities, structural evaluation (evidence rules, Dempster combination). Standard library only. |
| `lib/breakthrough.py` | Ranks maps: structural fit x surface distance x novelty. Triage only. |
| `lib/sme_cli.py` | Command line. `--assess` adds the ranking. |
| `agents/structure-mapping-research-agent.md` | The agent: access, mapping, inference testing, report. |
| `commands/cross-domain.md` | Slash command that launches it. |
| `tests/` | 18 tests, including the paper's published numbers. |
| `data/examples/` | Water flow and heat flow in the paper's own format. |

## Quick start

    cd sme-agent
    python3 lib/sme_cli.py data/examples/water_flow.sme data/examples/heat_flow.sme \
        --rules LS --functions pressure,diameter,temperature --assess
    PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest discover -s tests -v

## Verified against the paper

| Example | Rules | Paper | This engine |
|---|---|---|---|
| Water flow to heat flow | LS | 14 MHs; 5.99, 3.94, 2.44; CAUSE inference | same (5.992, 3.938, 2.445) |
| Solar system to Rutherford atom | AN | 16 MHs; 6.03, 4.04, 1.87 | 16; 6.026, 4.038, 1.872 |
| Karla base to TA5 | AN | 54 MHs; 22.362718 | 54; 22.362718 |
| Karla base to MA5 | AN | 47 MHs; 16.816530 | 47; 16.816530 |
| Karla base to TA5 | MA | 12 MHs; 6.411572 | 12; 6.411572 |
| Karla base to MA5 | MA | 14 MHs; 7.703568 | 14; 7.703568 |

The paper prints gmap weights to two decimals for the first two examples, so those are checked to that tolerance. The Karla runs match to six digits only when `happiness` and `success` are declared as functions. The appendix does not show the predicate declarations, so that is an inference from the numbers; it is the one choice that reproduces all four counts and weights.

## Limits

- SME maps. It does not retrieve or validate. Retrieval and testing are the agent's job and depend on the quality of the encodings.
- Results depend on how the domains are encoded. The agent is told to rerun the top reframe with an alternative encoding.
- Candidate inferences are surmises. A high breakthrough score means "worth testing first", not "true".
- Commutative predicates default to `and`, `or`, `equals`. Override with the `commutative` field in JSON descriptions.
- With many equally plausible matchings the number of gmaps can grow; `max_gmaps` caps the search and sets `truncated`.
- Tested only on the paper's examples and the unit tests here. Not yet run on a real research problem with live web access.
