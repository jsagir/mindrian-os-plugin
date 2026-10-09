p='references/methodology/sapphire-encoding.md'
s=open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1,(old[:50],s.count(old))
    s=s.replace(old,new)
rep('''The model captures how a system transforms inputs''','''**Terminology note (read before comparing with the literature).** In Chakrabarti's published model the seven constructs are State change, Action, Part, Phenomenon, Input, oRgan and Effect, where the final "Effect" is the physical effect (the natural law or principle applied) and "oRgan" is the set of properties and conditions that enable it. This guide adapts the model for business and venture artifacts: layer 6 is named `real_effect` (the governing law or mechanism, closest to the published "Effect") and layer 7 is named `effect` (the intended outcome or value, a function-level statement that the published model does not carry as a layer). The layer names below are frozen because the scoring code (`lib/core/semantic-index/analogy-fitness.cjs`) and the JSON handed to `scripts/analogy-fitness-report.cjs` use them: `state_change, action, parts, phenomenon, input, real_effect, effect`. Citations to Chakrabarti et al. support the method, not this exact layer naming.

The model captures how a system transforms inputs''')
rep('''**Room mapping:** `problem-definition/` -- the gap between current state and desired state.''','''**Room mapping (a starting heuristic for where to look, not a rule):** `problem-definition/` -- the gap between current state and desired state.''')
rep('''## SAPPhIRE Extraction Template
''','''## Flattening an encoding for scoring

The YAML template below is the human-readable extraction form. The fitness engine compares ONE string per layer, so before writing `<slug>-fitness-input.json` flatten each layer to a single plain-language sentence or phrase:

- `state_change`: `delta`, or "before -> after" in one phrase
- `action`: `verb` + `description`
- `parts`: the part names and roles joined with semicolons
- `phenomenon`: `observable` + `pattern`
- `input`: the non-empty ones of `energy`, `information`, `material`, joined
- `real_effect`: `principle` + `why_it_works`
- `effect`: `intended_outcome` (leave out `beneficiary`)

Rules: strip domain nouns where a functional term exists (the same word on both sides inflates the cosine without proving structure); leave a layer as an empty string when the source does not support it (an empty layer counts as "no correspondence", a guessed one counts as noise); never pad a layer with text copied from another layer. The encoding must come from the artifact or fetched source text, not from what the match is hoped to be.

## SAPPhIRE Extraction Template
''')
rep('''## Worked Examples
''','''## Worked Examples

The three examples are illustrative constructions. Their figures (pass rates, fraud reductions) are placeholders to show the encoding shape, not sourced facts; do not quote them.
''')
a=s.index("### Scoring Structural Fitness")
b=s.index("---\n\n## Reference")
s=s[:a]+'''### Scoring Structural Fitness

Compare two SAPPhIRE encodings layer by layer. A layer "corresponds" when both sides are non-empty and the embedding cosine of the two layer strings clears the layer threshold. The set of corresponding layers picks the band:

| Match Level | Layers corresponding | Score range |
|-------------|----------------------|-------------|
| None | State change does not correspond | 0.0 |
| Surface | State change, but not the behavioral set | 0.1-0.2 |
| Behavioral | State change + Action + Phenomenon | 0.3-0.5 |
| Structural | State change + Action + Phenomenon + Real effect | 0.6-0.8 (upper bound exclusive) |
| Deep | All 7 layers | 0.8-1.0 |

The score sits inside the band range, scaled by the mean cosine of the corresponding layers. The ranges leave gaps (0.2-0.3, 0.5-0.6) on purpose so bands are never confused, and Structural tops out at 0.8 only when every corresponding cosine is 1.0, which is the same value Deep starts at; ordering therefore uses the band first, then the score. Parts and Input are required only for Deep.

**Layer threshold.** The 2025 engine used one fixed cosine (0.5) for every layer. Cosines are encoder-specific, so the 2026 runner (`score`, default `--rank-mode percentile`) derives a threshold per layer from the candidate set itself: the 75th percentile of that layer's cosines, clamped to 0.3-0.9, with the fixed 0.5 used when fewer than 5 candidates are scored. `--rank-mode fixed` reproduces the 2025 behaviour. Report which mode ran.

**Restatement.** A candidate whose text reads almost identically (high text cosine) but whose band is None, Surface or Behavioral is flagged as a restatement and is never placed at Rank 1 while a non-restatement exists. In percentile mode "high" means at or above the 90th percentile of the run's text cosines and at least 0.5.

High structural fitness with different domains = far analogy = candidate for high innovation potential. A score is a triage signal for what to read and test first; it does not show that the mechanism transfers.

'''+s[b:]
rep('''4. Isomorphism score = proportion of layers with structural correspondence''','''4. Layer correspondence feeds the band table under "Scoring Structural Fitness" (not a simple proportion of layers)''')
open(p,'w',encoding='utf-8').write(s)
