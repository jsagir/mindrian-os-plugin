# Phase 120: Breakthrough Scan / Category G - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 120-CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 120-breakthrough-scan-category-g
**Areas discussed:** Detector thresholds + window, F.4 reuse vs new selector shape, Render cadence + multi-fire policy, Voice prescriptiveness + Hooked ethics fence

---

## Detector thresholds + window

| Option | Description | Selected |
|--------|-------------|----------|
| Single fixed threshold | One number, simpler but fails at both edges (too sensitive -> Cried-Wolf; too dull -> dies) | |
| Two-tier (soft buffer + hard surface) | 3 artifacts in 14d, conf >= 0.25 -> soft-fire buffer; 4+ artifacts OR 3+cross-section, conf >= 0.35 -> hard-fire surface | check |
| Configurable per-detector | Each detector type tuned independently | partial -- baked into config defaults |

**User's choice:** Two-tier with specific thresholds + 0.40 semantic similarity (not 0.30 corpus-level) + reverse-salient-closed requires BOTH graph proof AND lagging-score baseline crossing + 14-day window cap (since-last-session, configurable, default 14).

**Notes:** Two-tier gives detectors time to confirm patterns are not transient + provides retraining signal when soft fires fail to escalate. Single-signal reverse-salient closure is where false positives live -- score deltas can swing from normal artifact accumulation without a real closure event. 14-day cap prevents the "look what you did 21 days ago" manipulation failure mode.

---

## F.4 reuse vs new selector shape

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse F.4 verbatim | Map breakthrough to "Key insights" option in existing F.4 | |
| Build new F.6 Breakthrough Surface | 5 new verbs specific to breakthrough recognition speech act | check |
| Use F.1 Next Move with custom verbs | Generic next-move shape with breakthrough-specific verbs | |

**User's choice:** Build new F.6 with verbatim options: Explore deeper / Confirm / File as decision / Dismiss / Back.

**Notes:** F.4 maps content-to-user-actionable-observation; Phase 120 maps user-actions-to-recognition-of-user-own-work. Different speech acts; verbs must reflect that. Dismiss is the MOST important option -- without it the detector only learns from confirmations (classic engagement-optimizer drift). "File as decision" bridges to Phase 88.2 decision-log machinery, making breakthroughs first-class decisions with audit trail per Canon Part 4.

---

## Render cadence + multi-fire policy

| Option | Description | Selected |
|--------|-------------|----------|
| Surface all detectors that fire | Show every breakthrough simultaneously | |
| Round-robin per session | Predictable rotation but punishes timely high-value signal | |
| Score-based top-1 with "More breakthroughs (N)" affordance | Defensible scoring formula picks highest-nutrition; others held below | check |

**User's choice:** Score-based top-1 with the locked 5-component formula:
- 0.4 * confidence
- 0.2 * recency_decay (half-life ~3 days)
- 0.2 * differential
- 0.1 * log(artifact_count)
- 0.1 * user_engagement_prior (per-detector-type)

Resurfacing rules:
- Dismissed: 7-day cooldown MIN + new artifacts must have accumulated
- Confirmed: once-only (never resurface)
- Filed as decision: never resurface as breakthrough but reference in future related breakthroughs

Empty state for new room: SILENCE (no placeholder).

**Notes:** Surface-all dilutes signal. Round-robin punishes timely signal. Highest-nutrition wins, but the scoring needs to be defensible, not vibes. Time passing alone does NOT license resurfacing -- that is manipulation. Placeholder empty-state fails the Hooked ethics test because it implies the system has detected something when it has not. Trust users to notice the difference between presence and absence.

---

## Voice prescriptiveness + Hooked ethics fence

| Option | Description | Selected |
|--------|-------------|----------|
| Template-locked voice | "You cracked X by Y on Z" -- robotic by week 3 | |
| Pure Larry discretion | Drifts toward superlatives over time (variable-reward selection pressure) | |
| 4-rule scaffold + Larry latitude | Evidence + Mechanism + Time + No-superlatives-without-backing | check |

**User's choice:** 4-rule voice scaffold (evidence requirement / mechanism clause / time anchor / no quantitative superlatives without backing).

| Ethics fence option | Description | Selected |
|---------------------|-------------|----------|
| Pure code-enforced | Brittle -- every edge case becomes a release | |
| Pure manual review | Does not scale | |
| Hybrid 4-tier | HARD FLOOR (Cypher provenance) + SOFT BAND (review queue) + HARD CEILING (auto-surface) + below-floor (soft-fire only) | check |

**User's choice:** Hybrid 4-tier ethics fence:
- HARD FLOOR (code-enforced): Cypher `MATCH (b:Breakthrough)-[:DERIVED_FROM]->(a:Artifact)` must return >=1 result
- HARD CEILING (auto-surface): confidence > 0.50 with full provenance
- SOFT BAND (review queue): confidence 0.35-0.50, 20% manual sample weekly
- Below 0.35: soft-fire buffer only, never surfaces

Plus per-detector dismissal-rate canary: > 30% dismissal over 100-fire rolling window -> auto-throttle to soft-fire-only until manual review.

**Meta-principle:** Every breakthrough must be Cypher-provable from graph state alone. This single principle resolves most edge cases in the voice rules, threshold logic, and cooldown policy.

**Notes:** This is the highest-stakes decision in the phase because it is exactly where engagement design crosses into manipulation. Hooked Model audit reduces to: would removing this feature make users worse off, or would it just stop manufactured engagement? If breakthroughs are real (provenance edges exist, mechanism is identifiable, time is concrete), users are worse off without it. If they are manufactured, removing the feature is engagement loss only -- and that is the dark pattern.

---

## Claude's Discretion

(Documented in CONTEXT.md "Claude's Discretion" section)

- Phase 117 math-layer integration shape (event-subscription vs direct read vs shared dispatcher)
- Specific Cypher schema for the Breakthrough node type + DERIVED_FROM edge type (additive extension)
- Review queue surface for SOFT BAND (rooms-meta.db pattern from Phase 119-01 vs YAML directory vs memory_event extension)
- Session-start hook insertion order with Phase 119 + Phase 117
- F.6 sub-shape registration with Phase 88.2 dispatcher

## Deferred Ideas

- AI-driven retraining of detector weights (static for v1.13.0; ML-tuned deferred to v1.14.0)
- Cross-detector convergence super-breakthroughs (revisit if real data shows correlation patterns)
- Auto-throttle recovery surface for D-19 canary (deferred to Phase 121 housekeeping)

## Constitutional rejections (never builds)

- Cross-room or cross-user breakthroughs (Canon Part 8)
- Streak / gamification UI (Hooked ethics audit)
- AI-generated congratulations without graph provenance (D-20 Cypher-provable principle)
