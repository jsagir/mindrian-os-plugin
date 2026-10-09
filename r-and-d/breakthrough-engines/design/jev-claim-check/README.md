# Jev claim check (judgment only; PROPOSED)

What it does: asks Jev whether a public source excerpt supports a claim in the breakthrough methods register. Jev returns supported, contradicted or not_stated, with probabilities.
What it does not do: decide anything. Backtest pass or fail stays in code, against a baseline. The navigator decides.
Inputs: public excerpts only. No room content. No Theo or Brain calls.
Key: read from the environment (TYPESAFE_API_KEY). Never printed or written to a file.

Results (2026-10-09, jev-1.13.0)
| Claim | Jev | P(supported) | Hand check | Agree? |
|---|---|---|---|---|
| Kedrick: 58% more likely top 1% | not_stated | 0.00 | OR 1.58 in full text; not in abstract | yes |
| AutoDiscovery: 67% surprising to experts | supported | 1.00 | full text says 67% | yes |
| AutoDiscovery: 98% validity | not_stated | 0.00 | 98% not in text | yes |
| Bidirectional: uniqueness threshold 0.5 | supported | 1.00 | full text confirms | yes |

Read: 4 of 4 agree with the hand check. This is 4 cases, so it does not validate Jev. Test it on more cases before trusting it on a decision.

Limits:
- Jev judges wording only. It cannot tell whether the source is right.
- The 67% case is a share, not a correlation. Jev read the wording, not the meaning. Keep the meaning check by hand.
- Confidence shows how concentrated the answer is. It is not overall correctness.

Needed before wider use:
1. More labelled cases, including cases where the claim is wrong in a subtle way.
2. A rule for when a not_stated answer sends the claim to a person.
3. Recording the model version with each run (already in results.json).
