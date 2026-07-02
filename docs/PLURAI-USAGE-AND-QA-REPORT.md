# MindrianOS x Plurai - Usage and QA Report

**For:** Elad Levi, Plurai (eladl@plurai.ai)
**From:** Jonathan Sagir, MindrianOS
**Date:** 2026-07-02
**Status:** Live snapshot of a working integration (not a proposal)

---

## TL;DR (the one thing to take away)

We did not just try Plurai on one task. We turned Plurai into a **release gate and a ground rule of MindrianOS**: every new feature, every update, and increasingly every old surface must pass a Plurai eval before it ships. The next MindrianOS release will be enforced by these evals. Plurai is now part of how we define "done."

This report explains the model we built around your AI-Judge, the fourteen eval sets live today, the two-layer design that lets your judge run both at build time and in CI, and a QA snapshot proving the suite is green.

---

## 1. What MindrianOS is (30 seconds)

MindrianOS is a commercial Claude Code + Cowork plugin. It delivers a teaching methodology (PWS) as installable skills, commands, agents, and hooks, fronted by an AI teaching personality ("Larry") and a structured "Data Room" that captures a venture's reasoning as a typed graph. It runs on Claude's native runtime; an optional remote "Brain" adds enrichment.

The hard part is not the prompts. It is guaranteeing **behavior**: that Larry teaches instead of lecturing, that the system routes to the right methodology, that user data never leaks to the Brain, that a grade matches a calibrated reference. Behavior is exactly what a static test cannot pin down and what your AI-Judge can. That is why Plurai fits.

---

## 2. How we use Plurai - the model

We turn our own written contracts (the "Mindrian Canon" - our constitution) into Plurai AI-Judge training sets. The pipeline is:

```
  Canon contract (a rule we must honor)
        |
        v
  Plurai CSV  (Sample JSON-encoded | Label | Reasoning)  <- synthetic/dogfood samples only
        |
        v
  Plurai AI-Judge  (vibe-trained, judge model = fable)   <- the semantic verdict
        |
        v
  Local parity gate (lib/core/*-gate.cjs)                <- deterministic twin, runs in CI offline
```

Two things make this more than "we ran an eval":

- **Every CSV traces to a written contract.** We do not invent eval criteria per feature. Each CSV cites the exact Canon Part it enforces, so the eval is auditable against our own rules.
- **Every judged surface has a deterministic local twin.** Your AI-Judge is the source of semantic truth; we mirror its verdict in a small deterministic classifier (`lib/core/*-gate.cjs`) so our CI stays green without a live call, and the two are kept in parity. Plurai is the judge; the local gate is the always-on bailiff.

### The privacy boundary you should know about (Canon Part 8)

Every sample we upload to Plurai is **synthetic or dogfood only**. No real user-room content, no personal identifiers, no proprietary numbers. We evaluate Larry's *behavior* with manufactured data. This is a hard constitutional rule on our side, and it is why we can use a third-party judge aggressively without ever risking a customer's venture data. When we bring our own samples, they come from test fixtures and synthetic transcripts, never from a live room.

---

## 3. What we use it for - the live eval suite

Fourteen eval sets are live today, each mapping a MindrianOS behavioral contract to a Plurai use case:

| Eval set | Plurai use case | What it guards |
|----------|-----------------|----------------|
| `01-part8-boundary-guardrail` | Policy Compliance / Guardrail | Blocks user-specific content from leaving the machine to the Brain (our #1 privacy line) |
| `02-larry-pedagogy-voice` | Agent Response Compliance | Larry teaches via a reframe, ends with a question, no framework-dumping, right length, no filler |
| `02-agentshield-surface-guardrail` | Policy Compliance / Guardrail | Every invocable surface is safe (prompt-injection / unsafe-tool surface scan) |
| `03-command-routing` | Tool Invocation Validation | The right methodology command fires for the user's request |
| `04-dual-path-first-touch` | Intent Detection | First-turn input classified: pasted doc vs typed answer vs ambiguous |
| `05-problem-type-classification` | Response Classification | Problem framed by definition clarity (undefined / ill-defined / well-defined) |
| `06-grading-calibration` | Reference Evaluation | Our grade matches a calibrated reference grade |
| `07-rs-corpus-quality` | Output Quality / Regression | A reverse-salient differential set is discriminating, not degenerate |
| `08-ralph-loop-behavior` | Behavior / Loop Correctness | An autonomous retry loop stays bounded and only writes verified edges |
| `09-apo-output-voice` | Output Quality / Guardrail | An auto-optimized prompt still honors the voice contract (reward cannot buy a voice violation) |
| `09-hitl-memory-governance-ranking` | Output Quality / Regression | Memory-governance pre-checks the decision-relevant candidates, not noise |
| `09-ignite-branch-routing` | Intent Detection / Routing | The new-room front door routes the navigator to the right lane |
| `10-synthetic-expert-construction` | Output Quality / Construction | A synthetic expert was *built* faithfully - real cognitive stance, coherent domain, genuine framing, distinct source frameworks (see section 5) |
| `11-synthetic-expert-behavior` | Agent Response / Behavior | A synthetic expert *reasons* in-character from its lens when invoked (see section 5) |

Alongside these, we keep a **per-phase baseline** (`<phase>-baseline.json`) so each shipped feature carries its own eval anchor. Eight are live today (phases 189, 196, 199, 200, 201, 202, 203, 204), one added per release.

---

## 4. The strategic use: Plurai as a runtime guardrail, not just a test

The most important CSV is `01-part8-boundary-guardrail`. It is more than an eval. Plurai can train a sub-100ms SLM from it, which means our privacy boundary can become a **runtime guardrail** that blocks a leaky payload *before it leaves the machine* - not a test that catches a leak after the fact. This is the piece our constitution previously listed as "pending"; Plurai delivers it as a trained classifier. This is the direction we are most excited to push with your new product.

---

## 5. The newest capability - the two-surface expert gate (shipped)

Shipped in this build (Phase 203, "Synthetic-Expert-as-Skill"), we do something we think is a genuinely sharp use of an AI-Judge. When MindrianOS composes a synthetic domain expert (fanned out from many frameworks, then synthesized into a persona), we do not just judge whether it *answers* well. We judge **two separate surfaces**:

- **(A) Construction fidelity** (`10-synthetic-expert-construction`) - was the expert *built* like a real person? Valid cognitive stance, coherent domain, a genuine framing question and research approach, drawn from genuinely distinct frameworks (not one source wearing many hats). A hollow, template-built expert **fails this surface even if it answers well once**.
- **(B) Behavioral fidelity** (`11-synthetic-expert-behavior`) - does the invoked expert reason in-character from its lens?

Judging only (B) lets a costume pass. Judging (A) is what makes it an actual lens. Two CSVs, two judges, two local parity twins. This is the pattern we want to generalize with Plurai across the product.

---

## 6. The ground rule (what changed on our side)

Plurai is now wired into how MindrianOS defines "shippable":

- A new feature does not close until it carries a Plurai eval (a CSV + a local parity gate + a phase baseline).
- Verification is **eval-scored, not grep-scored** - a feature proves itself against a judge, not against a string match.
- The next MindrianOS update will be gated on these evals as a release requirement.

This is now a standing rule of the project, not a one-off experiment.

---

## 7. QA Report - live snapshot

*Snapshot taken 2026-07-02 against branch `feat/v1.15-shape-brain-phases`.*

### Eval assets

| Asset | Count |
|-------|-------|
| Plurai eval CSVs (behavioral contracts) | 14 |
| Per-phase eval baselines | 8 |
| Local deterministic parity gates (`lib/core/*-gate.cjs`) | 6 |
| Part 8 boundary test files (the privacy lane) | 10 |

### Gate results (run this snapshot)

| Check | Result |
|-------|--------|
| `synthetic-expert-construction-gate` (surface A, new) | PASS (via `run-all-203`) |
| `synthetic-expert-behavior-gate` (surface B, new) | PASS (via `run-all-203`) |
| `rs-corpus-quality-gate` (RS output-quality twin) | PASS (exit 0) |
| `ralph-loop-gate` (autonomous-loop correctness twin) | PASS (exit 0) |
| `ignite-branch-gate` (front-door routing twin) | PASS (exit 0) |
| `abstraction-gate` (abstraction-quality twin) | PASS (exit 0) |
| Phase 203 suite (`run-all-203.sh`) | PASS = 5 / FAIL = 0 / SKIP = 0 |
| Part 8 boundary sweep (privacy egress) | PASS |
| Acceptance roll-up (`doctor --acceptance`) | 14 / 14 PASS |

### Coverage read

Fourteen behavioral contracts under continuous eval, each backed by a deterministic CI twin, with per-phase baselines anchoring shipped features. The privacy boundary (Part 8) is covered both as an eval and as a dedicated 10-file test lane. The newest feature (the synthetic expert) is gated on two independent Plurai surfaces. The suite is green.

---

## 8. What we would love from Plurai next

- Access to the new product you applied to our agent - we are eager to see the insights you mentioned.
- The SLM path for `01-part8-boundary-guardrail`: turning our privacy eval into a sub-100ms runtime guardrail.
- Generalizing the two-surface pattern (construction + behavior) as a reusable judge template.

Thank you for the partnership - this has moved from an experiment to a load-bearing part of how we ship.

Jonathan
