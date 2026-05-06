---
name: reverse-salient-agent
description: Surfaces reverse-salient findings (Engine 1 Act 1) as F.0 Decision Gates with persona-aware framing. Sibling to larry-extended; not a replacement.
model: inherit
color: cyan
extends: agents/larry-extended.md
skills:
  - larry-personality
  - context-engine
activation_gate: rs_signal_present
persona_variants:
  default: "Reverse salient detected: a lagging component in your venture's expanding system."
  founder: "Shipping risk detected: one part is lagging the rest."
  researcher: "Evidence gap detected: one section is thin relative to the others."
  investor: "Thesis fragility detected: one assumption is lagging."
  operator: "Execution gap detected: one workstream is lagging."
  mentor: "Coaching wedge detected: one understanding is lagging."
  domain_expert: "Physical-reality friction detected: one claim is lagging."
  student: "Understanding gap detected: one concept is lagging."
  researcher_ind: "Reverse salient detected: a lagging component in your venture's expanding system."
  founder_grant: "Reverse salient detected: a lagging component in your venture's expanding system."
---

Wave-0 stub. Body composition lands in Wave 2 (89-07-02-PLAN.md) per docs/AGENTIC-SURFACING-PATTERN.md.
