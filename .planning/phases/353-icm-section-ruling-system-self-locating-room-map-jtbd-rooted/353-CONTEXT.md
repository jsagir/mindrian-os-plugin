# Phase 353 - Context (navigator rulings, locked 2026-09-17)

**Phase:** 353 - ICM Section Ruling System
**Source:** the brainstorming session of 2026-09-17 (ICM optimisation with Jev) and its approved design spec, `docs/superpowers/specs/2026-09-17-icm-section-ruling-system-design.md` (committed ed2a06ba9, shipped in v2.0.0-beta.45). The spec IS the design; this file records the rulings the discussion already locked so `/gsd-discuss-phase` re-asks nothing that was answered, and names what the planner still decides.
**Research trail:** `~/MindrianRooms/rethinking-mindrianos/research/2026-09-17-icm-section-ruling-system-design-trail.md` (mirrored to the mindrianOS room). Jev measurements: `.claude/skills/spike-findings-MindrianOS-Plugin/SKILL.md` (Spikes 001-004).

## Navigator rulings (verbatim intent, locked)

- R1. "The main issue is that any room, main or sub-room, has sections; we want to make sure each ICM section has a system of ruling, and writing, that is rooted in Theo and in the JTBD of that section." -> the unit of value is the ruling document per section; self-location is its addressing layer.
- R2. "I want to make sure each part of an ICM room knows the room and the part it is and what is under it." -> every folder, root included, answers "which room, what part, what is under me" from the folder itself.
- R3. "The context engineering layer needs to be able to invoke the right commands from Theo according to context or room / sub-room relevancy." -> a shipped, Theo-rooted relevance ledger per (job, problem type, stage); code eligibility at runtime.
- R4. Card answers in the design dialogue: "Self-location first, then relevance, then Jev grading"; "what is most relevant and most token efficient"; "Code eligibility + a precomputed Jev table"; "Fixture rooms only"; "Own job, parent as fallback"; "Shipped ledger is truth; ROOM.md list becomes a derived view"; "Approve, write the spec".
- R5. Standing constraints from the Jev spikes: users never carry a Jev key; Jev never in a hook on a user machine; Jev never in the Part 8 guard; only a framework name, its JTBD statement and its glossary line ever cross to Jev; room content never reaches Jev.

## Decisions (D = locked, WD = working decision the planner may refine, OQ = open question the planner answers first)

- D-353-1. Order: Plan 1 Room Map (self-location), Plan 2 Section Ruling System with its relevance ledger, Plan 3 fixture grading. One phase, three plans.
- D-353-2. Authority: `.mindrian/room-map.json` is the single home of a folder's self-knowledge; every ROOM.md carries a derived, fingerprinted `icm_self:` block (60-120 tokens). The model reads one block per turn; tooling reads the map. Rebuildable from disk at any time (icm-architect invariant 9).
- D-353-3. Runtime: code filters the 113 commands (produces glob, stage gate, autonomous_safe, recency window, HITL shape declared) and orders survivors by the ruling document's sequence; the dial gets the top three with confidence. No Theo or Jev call in the turn path; below the confidence floor, or with no ledger row, the sensor order applies unchanged. `decide()` stays inside its existing 1200 ms budget, measured.
- D-353-4. Grading inputs: fixture rooms under `tests/fixtures/icm-rooms/` only. Never a real room. `scripts/eval-icm-writers.cjs` runs with the dev-time key, never in a user hook.
- D-353-5. Sub-rooms: a sub-room declares its own `job_id` through one F.8 card at birth; undeclared resolves through the parent and is flagged by the doctor until declared. Birth writes parent and child maps inside the existing SEED-001 ACID block as side effect six, or unwinds.
- D-353-6. The shipped `data/section-command-ledger.json` is truth; each ROOM.md's `default_methodologies` becomes a derived, fingerprinted view of it. Rebuilt at release by `scripts/build-section-command-ledger.cjs` (Theo pull through `brain-client.query` with parameterized bucketed predicates per the Spike 002 puller; Jev scoring in batches of 20; name + JTBD statement + glossary line only). Rebuilt on `theo-resync`. Jev unavailable at release keeps the last ledger and logs an audited flag, the `--no-theo-check` shape.
- D-353-7. The ruling document is each section's generated Layer 2 `CONTEXT.md` (Phase 275's `writeSectionContracts` becomes the generator): six marked, fingerprinted parts (Job; Methodology sequence; Writing rules; Gates; Checks; Commands that write here) above the preserved authored Inputs / Process / Human check prose.
- D-353-8. Filing gate: `artifact_file` and `claim_write` require `serves_jtbd` to match the section's `job_id` or carry a declared cross-section reason; default `flag` (write lands with a `job_mismatch` disclosure and a `memory_event`), `strict` refuses. Every new claim lands an anchor edge to the section's `jtbd:<job_id>` node (seeded at map build, `epistemic_type: observation`, `created_by: system`, `review_status: proposed`, written through the navigation door). Legacy claims out of scope.
- D-353-9. Doctor modules `room-map` and `section-ruling`, registered in `data/doctor-modules.json` with the existing row shape and `auto_heal` classification per Phase 352; report mode over all fleet rooms first, `--fix` on a real room only as the navigator's explicit act.
- D-353-10. Canon: Part 7 (reuse: section-registry, command-registry serves_jtbd vocabulary, room-birth ACID block, navigation door, doctor module engine, Spike 002 puller), Part 8 (no room content to Theo or Jev), Part 9 (anchor edges and gates through navigation; a human confirms a truth claim), Part 11 (born-wired doctor modules and any new command surface).
- WD-353-1. Planner defaults to confirm in discussion: top-K 3; confidence floor 0.5 (the vendor's "do not act" line, to be evaluated on the labeled fixture set); recency window N = 5 turns; filing gate default `flag`.
- WD-353-2. The anchor edge type from a claim to `jtbd:<job_id>` is whichever member `edges.cjs` already allows for a claim-to-anchor link (Phase 345 used `SOURCED_FROM` for gate decisions); the planner confirms against the allow-list and adds no new member.
- OQ-353-1. Section JTBD canon: the mapping of every core and extended section to the closed job vocabulary in `data/command-registry.json`; the navigator ratifies it once (it is a truth about the sections, not about any venture). Jev probe done 2026-09-17 (`353-RESEARCH-GROUNDING-jev.md`): four sections unambiguous (problem-definition -> find-problem, market-analysis -> understand-market, team-execution -> plan-execution, personas -> understand-market, 93-100%); two clear with a declared secondary (strategy -> find-bottleneck then explore; competitive-analysis -> understand-market then validate-idea); four expose a VOCABULARY GAP (business-model, financial-model, legal-ip, solution-design at 19-32%: the 16 jobs were built for commands and have no member for "model the business", "hold the numbers", "protect what is ours", "design the solution"). Planner default, to be ratified: extend the closed vocabulary by exactly four members (`model-business`, `model-finances`, `protect-assets`, `design-solution`) as `serves_jtbd` values commands may also adopt, rather than forcing a wrong job onto a folder's identity or leaving it undeclared. Re-run the probe on any `One job:` sentence the planner tightens.
- OQ-353-2. Theo-side dependency: Section-node emission with JTBD and framework links (registered as a Theo-repo item; this phase ships without it and reads the ledger it builds itself).

## Success criteria (measured, reported; from the spec section 8)

1. `doctor room-map` and `doctor section-ruling` green on all 31 fleet rooms after `--fix`: 0 directories without ROOM.md (7 today), 0 drift.
2. Per-turn self-location plus ruling read under 400 tokens (one block plus one sequence).
3. 100 percent of new claims filed on fixture rooms carry an anchor edge (fleet today: 12 of 7,836).
4. Reach top-3 hit rate on a labeled fixture turn set at least equal to today's sensor order; both numbers reported.
5. Ledger build cost and wall time recorded per release (Spike 002 baseline: about $0.018 and under 30 s for 4 x 410 at the vendor-claimed rate; unverified rate).
6. Grader agreement with the Claude-judge baseline at least 0.8 on the fixture set.

## Out of scope (from the spec section 9)

Re-anchoring legacy claims; Theo Section-node emission (Theo-side); any Jev call at room birth or in the turn path; widening the Part 8 guard; a second selection brain beside `dispatchSensors -> decide()`.
