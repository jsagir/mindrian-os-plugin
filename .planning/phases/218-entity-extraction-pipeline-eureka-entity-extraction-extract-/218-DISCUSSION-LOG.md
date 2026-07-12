# Phase 218: Eureka Entity Extraction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 218-entity-extraction-pipeline-eureka-entity-extraction-extract-
**Areas discussed:** Entity type taxonomy, Edge vocabulary beyond the 3 named, Invocation surface, Test room for verification

Advisor mode active (USER-PROFILE.md present). Calibration tier: `minimal_decisive` (Vendor Philosophy rating: `opinionated`). Each area researched by a parallel `gsd-advisor-researcher` agent (model: opus) producing a 2-option comparison table before the pick.

---

## Entity type taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly company/technology/market | Matches tier-1's actual signal strength; frozen-Set pattern makes adding more later trivial | ✓ |
| Add more types now (person, funding_round, regulation) | Richer graph sooner, but tier-1 regex can't reliably distinguish these classes yet | |

**User's choice:** Exactly company/technology/market (Recommended)
**Notes:** Research rationale: tier-1's capitalization-only signal can't reliably distinguish additional proper-noun classes; adding types now buys graph breadth at the cost of the exact mislabel noise this phase exists to eliminate.

---

## Edge vocabulary beyond the 3 named

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly the 3 named: COMPETES_WITH/USES_COMPONENT/SUPPLIES_TO | Matches the unbroken additive-only convention (Phases 125-200-02) | ✓ |
| Add more now (FOUNDED_BY, PARTNERS_WITH, TARGETS_MARKET, ACQUIRED_BY) | Pre-declares vocabulary for a future pass, but freezes constitutional edge types with zero producer this phase | |

**User's choice:** Exactly the 3 named (Recommended)
**Notes:** Research rationale: the codebase's own `ALLOWED_EDGE_TYPES` history explicitly documents refusing speculative members by name; a type with no emitter is dead surface under Canon Part 11 born-wired. Test precedent to mirror: `tests/test-200-02-rs-edge-vocab.cjs`.

---

## Invocation surface

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone script, mirrors eureka-command.cjs | scripts/entity-extract.cjs ROOM_DIR start/status/report. Zero new command surface, zero CIRS governance overhead | ✓ |
| Auto pre-step inside /mos:eureka run | Closes the manual-sequencing gap now, but needs a freshness gate to avoid wasteful re-extraction | |

**User's choice:** Standalone script (Recommended)
**Notes:** A third candidate (hidden `/mos:eureka extract` subcommand) was explicitly evaluated by the research agent and rejected outright - undocumented-but-reachable violates Part 11's "born wired or excluded" clarity mandate while buying nothing the script doesn't already give. The auto-pre-step option is not rejected, just deferred (see Deferred Ideas below).

---

## Test room for verification

| Option | Description | Selected |
|--------|-------------|----------|
| aion-eureka-synergy, real room | 100%-noise baseline already measured this session - the literal denominator R5's acceptance criterion needs | ✓ |
| Build a dedicated synthetic fixture room | Gives planted ground truth for precision/recall, but answers a different question than R5 asks | |

**User's choice:** aion-eureka-synergy (Recommended)
**Notes:** Research rationale: Requirement 5 is a directional regression proof, not a precision claim - a synthetic fixture would answer a genuinely different question (extraction correctness) than what R5's acceptance criteria actually require.

---

## Claude's Discretion

- Exact regex/heading-heuristic rules for tier-1 extraction - deferred to planner/executor once looking at real artifact prose in aion-eureka-synergy.
- Exact `entity-extract.cjs` file layout and internal module boundaries - follow existing `lib/core/eureka/*.cjs` conventions.
- Entity-type disambiguation heuristics beyond simple capitalization/heading-context rules - explicitly out of scope (tier-2 territory).

## Deferred Ideas

- Auto pre-step inside `/mos:eureka run` with a freshness gate (skip re-extraction if nothing changed) - good future layer once verification shows navigators hit the manual two-step sequencing gap.
- Tier-2 NER models (onnx-community/distilbert-NER-ONNX, bert-base-NER-ONNX) - confirmed untested on business/venture domain text; requires tier-1 verification first.
- Tier-3 relation extraction (GLiREL) - confirmed a Python-subprocess pattern is viable here (precedent: `intelligence-cascade.cjs`'s `execSync('python3 compute-hsi.py')`), but would need `spawn` (long-lived process) not `execSync` (one-shot) - a meaningfully different implementation, not copy-pasteable from the existing precedent.
- Dedicated synthetic fixture room for extraction-correctness calibration - reserve for later if tier-1 recall proves insufficient.
- Rewiring `/mos:find-connections`/`/mos:find-analogies` onto room.db - separate follow-on phase (navigator-decided 2026-07-12), out of this phase's scope by design.
