# Problem Type Classification -- Reference

*Loaded on demand by `/mos:diagnose` and used by `/mos:help` for framework routing.*

---

## Two-Dimensional Classification Matrix

Every venture problem sits on two axes. Larry uses this to route users to the right methodology.

### Axis 1: Definition Level

| Level | Signal | What It Looks Like |
|-------|--------|--------------------|
| **Undefined** | Future unclear, no constraints named, systemic | "I want to do something in climate tech" |
| **Ill-defined** | Something is broken but they cannot name it | "Customers aren't buying but I don't know why" |
| **Well-defined** | Clear parameters, specific constraints | "We need to reduce churn by 15% in Q2" |

### Axis 2: Complexity (Cynefin-Informed)

| Level | Signal | What It Looks Like |
|-------|--------|--------------------|
| **Simple** | Obvious cause-effect, best practice exists | "How do I structure my pitch deck?" |
| **Complicated** | Multiple possible causes, analysis needed | "Why is our conversion rate dropping?" |
| **Complex** | Entangled causes, emergent behavior | "How do we compete in a market that doesn't exist yet?" |
| **Wicked** | Multiple stakeholders, conflicting values, no stopping rule | "How do we make healthcare accessible AND profitable?" |

---

## Methodology Routing Table

| Definition \ Complexity | Simple | Complicated | Complex | Wicked |
|------------------------|--------|-------------|---------|--------|
| **Undefined** | beautiful-question, lean-canvas | explore-domains, build-knowledge | explore-trends, scenario-plan | explore-futures, systems-thinking |
| **Ill-defined** | analyze-needs, structure-argument | root-cause, find-bottlenecks | map-unknowns, analyze-systems | think-hats, leadership |
| **Well-defined** | lean-canvas, structure-argument | analyze-timing, validate | challenge-assumptions, dominant-designs | scenario-plan, macro-trends |

Use this table as guidance, not gospel. Multiple methodologies may apply. Larry picks based on conversation context.

---

## Evolution Rules

Problem type is NOT static. It evolves as the Room fills:

1. **Start**: Most ventures begin as Undefined + Complex (the default)
2. **After problem-definition fills**: Reclassify to Ill-defined (they can name something)
3. **After market-analysis fills**: Reclassify complexity based on evidence density
4. **After competitive-analysis fills**: Often shifts to Well-defined + Complicated
5. **After solution-design fills**: Full reclassification -- may reveal Wicked dimensions

The state script computes problem type from Room section fill levels. Larry uses this to adjust recommendations in `/mos:help`.

---

## Brain-Ready Interface

When Brain MCP connects (Phase 4), problem type classification gains:

- `ADDRESSES_PROBLEM_TYPE` relationship from the teaching graph
- Calibrated confidence scores per methodology-problem pairing
- Cross-user pattern matching (anonymized)
- Dynamic reclassification based on conversation signals

Until then, the routing table above provides Tier 0 classification.
