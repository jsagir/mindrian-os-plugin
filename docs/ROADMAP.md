# MindrianOS Plugin — Roadmap

> **Last Updated:** 2026-04-02
> **Current Version:** v1.7.0 (Causal Reasoning Layer)
> **North Star:** "Did it find something nobody had ever thought of before?" — Lawrence Aronhime

---

## The Goal

Move MindrianOS from **Level 1-2 (intelligent recombination)** to **Level 3 (genuine discovery)**. The system must generate insights that surprise domain experts — not just organize what they already know.

See: `docs/research/RESEARCH_16_ACHIEVING_GENUINE_NOVELTY.md` for full theoretical grounding.

---

## Immediate Next Steps (Priority Order)

### TODAY: Run Adam Simulation with /mos:causal Active

**Task:** Re-run the Adam Peters / Synteris persona simulation with the v1.7.0 causal reasoning layer active. Compare output to the baseline simulation (RESEARCH_15).

**Success Criteria:**
- [ ] Causal claims extracted from conversation artifacts
- [ ] Mechanism identified for key insights (not just "A relates to B")
- [ ] Falsifiable predictions generated for top 3 claims
- [ ] Cascade analysis shows what breaks if key assumptions fail
- [ ] Novelty score improvement over baseline (target: 6.5/10 vs 5.3/10 baseline)

**Comparison Points:**
| Metric | Baseline (v1.6.3) | Target (v1.7.0) |
|--------|-------------------|-----------------|
| Mechanistic depth | Pattern-level | Mechanism-level |
| Falsifiable predictions | 0 | 3+ per session |
| Cascade visibility | None | Full assumption tree |
| Contrarian courage | 2/10 | 4/10 |
| Overall novelty | 5.3/10 | 6.5/10 |

---

### THIS WEEK: Add Prediction Tracking (P1)

**What:** Log every falsifiable prediction Larry generates → track outcomes → calibrate confidence.

**Implementation:**

1. **Prediction Registry** — new file `room/.predictions/REGISTRY.json`:
   ```json
   {
     "predictions": [
       {
         "id": "pred-001",
         "claim_id": "causal-0003",
         "prediction": "3/5 procurement leads will confirm 30%+ premium willingness for pre-qualified suppliers",
         "created": "2026-04-02",
         "deadline": "2026-04-30",
         "status": "pending",
         "result": null,
         "confidence_before": 0.5,
         "confidence_after": null,
         "learning": null
       }
     ]
   }
   ```

2. **`/mos:causal track`** subcommand — list, update, review predictions
3. **Confidence calibration** — after N results, compute: predicted confidence vs actual hit rate
4. **Learning loop** — each result updates the system's understanding

**Priority:** HIGHEST. This is the closest thing to closed-loop learning. Without it, the system can't self-improve.

---

### NEXT WEEK: Enhanced Novelty Scoring with Embeddings (P2)

**What:** Replace Jaccard distance novelty scoring with embedding-based consensus distance.

**Implementation:**

1. Use MiniLM embeddings (already in requirements-hsi.txt) to encode causal claims
2. Compute centroid of all existing claims per domain
3. Novelty score = cosine distance from domain centroid
4. Claims far from centroid are genuinely novel; claims near centroid are recombinations

**Dependencies:** sentence-transformers (already optional dep for HSI Tier 1)

**Expected Impact:** Better novelty calibration → Larry surfaces truly surprising claims, not just differently-worded versions of common claims.

---

### NEXT MONTH: Counterfactual Query Capability (P3)

**What:** `/mos:causal counterfactual "What if X were different?"`

**Implementation:**

1. User specifies an assumption to invert
2. System finds all CAUSES and CASCADES_TO edges from that assumption
3. For each downstream claim, compute the counterfactual impact
4. Present the cascade tree with before/after states
5. Identify which downstream claims are most sensitive to this assumption

**Example:**
```
/mos:causal counterfactual "What if we targeted B2C instead of B2B?"

Impact Analysis:
├── financial-model: unit economics shift from $80→$12 per customer
│   (mechanism: B2C = high volume, low margin; B2B = low volume, high margin)
├── market-analysis: TAM changes from $50M→$2B (larger market, lower capture)
├── competitive-analysis: 3 new competitors enter frame
│   (mechanism: B2C space has established players not present in B2B)
└── CASCADE: 4 assumptions in business-model invalidated
    └── RECOMMENDATION: Validate B2C unit economics BEFORE pivoting
```

**Priority:** HIGH. Counterfactual reasoning is the highest-leverage causal capability for venture strategy. It's what Lawrence's question really asks: "What would the world look like if..."

---

### ONGOING: Calibrate Confidence Scores → Publish Accuracy Metrics

**What:** Track prediction accuracy over time. Publish calibration curves.

**Implementation:**

1. After 20+ predictions tracked with outcomes, compute calibration:
   - For claims rated 0.8 confidence, what % actually turned out true?
   - For claims rated 0.5, what % turned out true?
2. Plot calibration curve (predicted probability vs actual frequency)
3. If systematically overconfident: add calibration correction factor
4. If systematically underconfident: expand search scope

**Success Metric:** Brier score < 0.25 (well-calibrated) after 50+ tracked predictions.

---

## Short-Term Roadmap (1-3 Months)

### v1.7.1 — Prediction Tracking
- [ ] Prediction registry (`room/.predictions/REGISTRY.json`)
- [ ] `/mos:causal track` subcommand
- [ ] Confidence calibration from outcomes
- [ ] Integration with `/mos:validate` (predictions as validation targets)

### v1.7.2 — Enhanced Novelty Scoring
- [ ] Embedding-based novelty scoring (MiniLM)
- [ ] Domain consensus centroid computation
- [ ] Per-section novelty distribution (which sections have the most novel claims?)
- [ ] Novelty alerts in Larry's proactive suggestions

### v1.7.3 — Counterfactual Engine
- [ ] `/mos:causal counterfactual` subcommand
- [ ] Cascade tree visualization with before/after states
- [ ] Sensitivity analysis (which assumptions have the largest downstream impact?)
- [ ] Integration with `/mos:scenario-plan` (counterfactuals as scenario inputs)

### v1.8.0 — Contrarian Hypothesis Engine
- [ ] Domain consensus catalog (common beliefs per domain)
- [ ] Systematic inversion generation
- [ ] Evidence search for inversions
- [ ] Contrarian bet scoring (consensus_distance × plausibility × actionability)
- [ ] Larry presents contrarian bets when novelty_score > 0.6

---

## Medium-Term Roadmap (3-6 Months)

### Mechanistic Reasoning Graph
- [ ] Domain-specific ontologies (materials science, business economics, competitive dynamics)
- [ ] First-principles reasoning chains in KuzuDB
- [ ] Physics/economics constraint propagation
- [ ] Integration with `/mos:analyze-systems` for system-level causal modeling

### Temporal Dynamics & Second-Order Effects
- [ ] `/mos:causal project` — project causal chains forward in time
- [ ] Second-order effect detection (what does this cause to cause?)
- [ ] Competitive time machine (model future competitive landscape)
- [ ] Temporal windows (when to act before opportunities close)

### Cross-User Intelligence (Brain Enhancement)
- [ ] Anonymized causal pattern aggregation across users
- [ ] "Ventures like yours commonly miss..." feedback
- [ ] Cross-venture causal calibration (what causal claims actually held?)
- [ ] Brain enrichment from real outcomes (prediction accuracy data)

---

## Long-Term Roadmap (6-12 Months)

### The Novelty Layer
- [ ] Sits on top of all existing output
- [ ] Every insight scored for: information surprise, consensus distance, cross-domain rarity, counterfactual divergence, expert surprise
- [ ] Automatic inversion for high-scoring claims
- [ ] "So What?" chain pushed to 3rd order for every insight
- [ ] Falsifiable prediction generated for every claim

### Dual-Process Architecture (Full Implementation)
- [ ] THINKING engine: 8 divergent modes generating hypotheses
- [ ] REASONING engine: causal coherence, counterfactual validity, Bayesian plausibility testing
- [ ] Automatic hypothesis filtering (generate 50, reason down to 5)
- [ ] Integration with Brain for calibrated hypothesis quality thresholds

### Closed-Loop Learning
- [ ] Full prediction → outcome → learning cycle
- [ ] Confidence recalibration from real-world results
- [ ] Pattern detection: "When Larry predicts X in domain Y, he's right Z% of the time"
- [ ] User-specific calibration (adapt to individual user's domain expertise)

---

## UX & Adoption Roadmap (Parallel Track)

From consultant review (RESEARCH_14):

### Quick Wins (This Month)
- [ ] Command grouping in `/mos:help` by workflow phase
- [ ] `/mos:doctor` diagnostic command
- [ ] Better error messages with solutions
- [ ] 3-minute Getting Started video

### Medium-Term (1-3 Months)
- [ ] Interactive setup wizard (`/mos:setup --wizard`)
- [ ] Template system (SaaS Startup, Research, Innovation templates)
- [ ] Documentation site launch
- [ ] Discord community

### Long-Term (3-6 Months)
- [ ] Collaboration features (shared rooms, role-based access)
- [ ] Notion integration (bi-directional sync)
- [ ] Web app prototype (read-only mobile access)
- [ ] Template marketplace

---

## Success Metrics

### The North Star Test
Run persona simulation with domain expert profile. Judge scores novelty.
- **Current:** 5.3/10 (Level 1-2, intelligent recombination)
- **Target (3mo):** 7.0/10 (Level 2-3, extension with synthesis moments)
- **Target (6mo):** 8.0/10 (Level 3, genuine discovery — expert says "I hadn't thought of that")

### Operational Metrics
| Metric | Current | 3-Month Target |
|--------|---------|----------------|
| Causal claims per session | 0 | 10-20 |
| Falsifiable predictions per session | 0 | 3-5 |
| Prediction tracking accuracy | N/A | Brier < 0.3 |
| Cascade chains detected | 0 | 5-10 |
| Expert engagement (turns before quit) | 9 | 12+ |
| Contrarian bets surfaced | 0 | 1-2 per session |

---

*MindrianOS Roadmap — updated 2026-04-02*
*Driven by: Lawrence's question, Adam's ceiling, and the Three Gaps framework*
