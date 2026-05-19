---
type: capability-map
status: canonical (sole source of truth for Brain ↔ Plugin contract)
created: 2026-05-14
authority: jsagir@gmail.com
canon_parts: [Part 8 (Graph Boundary), Part 9 (Memory Locality), Part 11 (Brain JTBD -- proposed)]
governed_by: docs/MINDRIAN-CANON.md + .planning/phases/110-brain-context-packet-contract/
---

# Brain ↔ Plugin Capability Map

**Single source of truth.** Every Brain capability the cloud server exposes MUST trace to a MindrianOS consumer surface. Brain features without a plugin consumer don't ship; plugin needs without a Brain capability are filed back as Brain backlog items. The two tracks meet at this map, not at the schema.

## The rule (canon)

> Every Brain capability must trace to a MindrianOS consumer surface. Brain features without a plugin consumer don't ship; plugin needs without a Brain capability are filed back as Brain backlog. The two tracks meet at a typed contract, not at the schema.

Failure modes this rule kills:

| Failure mode | What kills it |
|---|---|
| Brain ships capability nobody uses | "No consumer = doesn't ship" rule |
| Plugin expects something Brain doesn't build | "Need without capability = backlog" rule |
| Brain ships schema change that breaks plugin | Contract is typed (Phase 110); plugin tests fail in CI |
| Two tracks evolve in different directions | They meet at this map, not at the schema |

## Current capability map (as of 2026-05-14)

| # | Brain capability | Wire (Phase 110 packet shape) | Plugin consumer surfaces | Default mode | Status | Last verified |
|---|---|---|---|---|---|---|
| 1 | `brain_ask` | `DirectiveEnvelope` (NEW -- see §DirectiveEnvelope below) | `/mos:act`, `/mos:think-hats`, `/mos:pipeline`, Larry's mid-conversation routing | GUIDED | proposed (Phase 127) | 2026-05-14 |
| 2 | `brain_query` | `CypherResultPacket` | `/mos:graph`, `/mos:rs-explain`, brain-query agent, /mos:scout | n/a (raw) | shipped (Phase 110) | 2026-05-14 |
| 3 | `brain_schema` | `SchemaPacket` | doctor Class K (Phase 127), `/mos:setup brain` verify step | n/a | shipped (Phase 110) | 2026-05-14 |
| 4 | `brain_search` | `RankedHitsPacket` | `/mos:find-analogies`, `/mos:find-connections`, Phase 117 auto-explore | n/a | shipped (Phase 110) | 2026-05-14 |
| 5 | `brain_stats` | `StatsPacket` | `/mos:admin usage`, doctor Class K (admin tier) | n/a | shipped (Phase 110) | 2026-05-14 |
| 6 | `brain_write` | `WriteOpPacket` | `/mos:admin brain-write` only (admin-gated) | n/a (admin) | shipped (Phase 110) | 2026-05-14 |

## DirectiveEnvelope (NEW typed packet, Phase 127 consumer)

The Brain's `brain_ask` returns a directive envelope, not a free-form text answer. The envelope carries the **mode of delivery** AND the **content for that mode**, so Claude/Larry can execute appropriately.

```
{
  packet_version: "1.0",
  packet_type: "DirectiveEnvelope",

  mode: "GUIDED" | "AUTONOMOUS" | "HYBRID",

  // CANONICAL DEFAULT: GUIDED.
  // AUTONOMOUS only when explicitly invited (user said "just tell me",
  //   OR task is non-judgment prep work).
  // See: feedback_larry_pedagogical_guided_first.md

  mode_rationale: "user just dropped a CV with no stated decision -- guided
                    discovery is the right shape; autonomous would skip
                    the reframing they need"

  directive: {
    guided?: {
      questions: [{ ask, why, options? }, ...],
      framework: "Mullins-7-Domains",
      stage: "Domain 1 of 7"
    },
    autonomous?: {
      prompt: "Apply Mullins 7-Domains to <context>...",
      framework: "Mullins-7-Domains",
      expected_artifact: "mullins-analysis.md"
    },
    hybrid?: {
      prep: "<autonomous prompt for prep>",
      then_guided: [{ ask, ... }, ...]
    }
  },

  // Larry's escape-hatch contract -- user can flip mode mid-flow:
  user_override: {
    "just tell me":   "switch to AUTONOMOUS, run framework end-to-end",
    "let me think":   "switch to GUIDED, ask the next reframing question",
    "stop":           "halt, return control"
  },

  next_gate: {
    sub_shape: "F.1" | "F.2" | "F.3" | "F.4" | "F.5",
    options: [...]
  }
}
```

### Why GUIDED is the default

The pedagogical canon (Larry as guide for the human-in-the-loop) makes GUIDED the canonical default. AUTONOMOUS is reserved for two cases:

1. **Explicit user invitation** -- user said "just tell me" / "bottom line" / "skip the questions"
2. **Non-judgment prep work** -- e.g., the 30-second MVA pipeline (Phase 118) does autonomous prep + guided commit gate; the prep doesn't need human judgment, the commit always does

HYBRID is the most common shape for non-trivial methodologies: autonomous prep where there's no judgment, guided gates where there is.

## Mode-selection signals (what the Brain reads from the local context packet)

| Local context signal (in BrainContextPacket) | Brain's likely mode |
|---|---|
| User just dropped material with no stated question | GUIDED -- ask the reframing question first |
| User explicitly said *"run the analysis on X"* | AUTONOMOUS -- execute, return artifact |
| User has been in-room for 8+ sessions, room mature, commit phase | HYBRID -- prep then guided decision gate |
| User is brand new, first material | GUIDED -- never autonomous on cold start |
| User said *"just tell me"* in last 2 turns | AUTONOMOUS -- they want delivery |
| User overrode mode in 3 of last 5 calls | shift default toward their preference |

## Pending capabilities (plugin needs awaiting Brain backlog work)

| # | Plugin need | Proposed capability | Filed when | Status |
|---|---|---|---|---|
| 7 | Calibrated grading from 100+ student projects | `brain_grade(artifact, rubric)` returning `CalibratedGradePacket` | 2026-05-14 | NOT YET BACKLOGGED on Brain track |
| 8 | Cross-domain analogy with similarity scoring | extension to `brain_search` -- add `cross_domain: true` flag + similarity scores | 2026-05-14 | NOT YET BACKLOGGED on Brain track |

When a plugin phase needs capability #7 or #8, file a Brain backlog item BEFORE plugin work depends on it.

## Update protocol

Every PR that touches Brain or plugin must:

1. **Brain repo PRs:** cite which capability map row (or proposed capability) the PR serves. PRs that don't cite a row require explicit "internal-admin-only" tag.
2. **Plugin repo PRs:** cite which capability map row the PR consumes (or which proposed capability it depends on -- in which case the PR is gated on the Brain row landing).
3. **Schema changes:** require updating the Phase 110 typed-packet contract AND this map in the same PR.
4. **Verification:** the `Last verified` date in this map gets refreshed on each release-gate Brain end-to-end smoke test (doctor Class K).

## Cross-references

- `docs/MINDRIAN-CANON.md` Part 8, Part 9, Part 11 (proposed)
- `.planning/phases/110-brain-context-packet-contract/` -- the wire-shape contract
- `.planning/phases/127-brain-mcp-local-stdio-shim/127-CONTEXT.md` -- the consumer of the new DirectiveEnvelope
- `feedback_larry_pedagogical_guided_first.md` -- the GUIDED-default memory rule
- `feedback_no_admin_data_in_tester_emails.md` -- governs what we surface to testers about capability changes
- `feedback_local_graph_sqlite.md` -- the local layer is SQLite, not Kuzu (canonical, do not violate)
