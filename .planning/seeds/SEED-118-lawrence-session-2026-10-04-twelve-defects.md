---
id: SEED-118
title: "Twelve defects and one positive finding from a full working session on beta.57 (room fiber-optic-drone-wicked, Claude Code CLI): the deep research run, the lenses, the graph edge writes, the Jev judge, the analogy recall and the Brain egress verbs"
status: seeded
priority: critical
filed: 2026-10-04
source: "mindrianos-session-2026-10-04-for-jonathan.md" (session report written for the navigator at the end of a working session on v2.0.0-beta.57; the defects section is copied below verbatim; the full transcript is the companion file mindrianos-session-transcript-2026-10-04.md in the navigator's Downloads, not copied into the repo)
routing:
  phase_369_2: [1, 2, 3, 4, 5, 8, 11, positive_finding]
  seed_117: []
  graph_quick: [6]
  deep_record_quick: [7]
  jev_quick: [9]
  analogies_phase: [10]
  error_text_quick: [12]
---

# SEED-118: twelve defects from one real session

## How to read this

Defects 1 to 5, 8 and 11 and the positive finding belong to Phase 369.2 (the research planner
searches online for real): the lenses, the lane and slot plumbing, the counterevidence budget,
the Brain egress verbs, and the practice-name bias for slots. Defect 6 is a graph write quick
(`unknown_node:<id>` instead of a bare FOREIGN KEY). Defect 7 is a deep-record reason quick.
Defect 9 is a Jev judge quick (key resolution, flag names). Defect 10 is the analogy recall's
entity dependency (a phase of its own, or 369.2's second wave). Defect 12 is error text.

Defect 4 (a limiter STATEMENT sent as an exact-phrase query, guaranteed zero) and defect 1
(a lens named `patent` that queries PubMed) are the two to fix first: both make a run look like
it searched when it could not.

## Verbatim from the session report

## Defects, highest value first

### 1. The `patent` lens is PubMed
`lib/lens-engine/source-lens-driver.cjs`, `LENS_TO_SOURCE`:
```js
scholarly: 'openalex',
industry:  'tavily',
patent:    'pubmed',   // biomedical index
```
`--broad` advertises scholarly + industry + patent. There is no patent corpus in the install.
Three of the room's questions needed patent literature; a hand `WebSearch` found four
directly relevant US patents in one call, including US4902126 (1990), which answered the
room's central detection question. **The lens is named for an intent the implementation does
not have.**

### 2. One leaf per lens, or the second starves silently
`lib/core/research-planner/deep.cjs`, `laneSpecs` non-SR branch groups leaves by lens;
`roundOneQueries` fills `queries_per_round` (2) from the first leaf carrying slots. Two leaves
sharing a lens means the second **never fetches**. The F.6 plan card prints
`round one: no search text yet` and does not flag it as a fault. This killed 2 of 4 lanes on
one run; I only caught it by reading the card closely.

### 3. SR-template lanes ignore leaf `slots` entirely
`lib/core/research-planner/planner.cjs`, `attachQueries`: for deep mode it computes
`composed[leaf.id]` and then **never assigns it**; only `deepMod.roundOneQueries` writes
`leaf.queries`. For `template_id: scientific-roadmapping`, lane terms come solely from
`limiterSlot()`. Leaf lens and slots are dead inputs on that path.

### 4. `limiterSlot` falls back to the limiter *statement*
Same file, and the worst of the set:
```js
return nonEmpty(lim.statement) ? lim.statement.trim() : null;
```
A limiter with no bound leaf carrying `slots.limiter` sends its whole sentence as an
exact-phrase query. Observed live:
`"Entanglement requires pre-positioned physical barriers" AND ("fundamental limit" OR …)`
Guaranteed zero. **Should refuse as `bad_slot`, not degrade into a sentence.**

### 5. `term2` is silently unreachable on term-only lenses
`mu.blind_spot` renders `ce.alternative` + `ce.counter`, both `needs: ['term']`. A `term2`
supplied there is never rendered and never warned about. I put `optical time domain
reflectometry` in `term2`; it was never sent, and the lane returned nine rows of **electrical**
cable TDR instead. Re-sent as `term` on a follow-up, it immediately returned the decisive
optical-fiber evidence. One silent slot drop cost a whole round.

### 6. `edge_write_failed` -- FOREIGN KEY, and it is not just my call
`graph_write` with `opportunity-bank/<file>` → `{"reason":"edge_write_failed","detail":"FOREIGN KEY constraint failed"}`.
`artifact_file` creates `claim:artifact:<id>` but **no `Artifact` node** for opportunity-bank
cards, so the obvious id does not exist. Note the research filing hit the same class on its
own: `{"what":"edge INFORMS","reason":"edge_write_failed"}`. Worth a typed
`unknown_node:<id>` instead.

### 7. `deep-record` says `wrong_step` for an already-closed lane
A lane whose fetch returned `records: []` is closed by the fetch. Recording `[]` against it
returns `{"ok":false,"reason":"wrong_step","step":"dispatch_lanes"}`, which reads as a
sequencing bug rather than "nothing to record here". Suggest `lane_already_closed`.

### 8. The mandatory counterevidence pass silently does not run
Run `rp-2026-10-04-32664e65`: 5 of 6 branches returned `counterevidence not composed: bad_slot`.
Run `rp-2026-10-04-3f4b1d0a`: `deep-counterevidence` returned `executed: 0` because the cap was
already spent. Both runs synthesised with **no falsification leg**. If the pass is mandatory,
the budget should reserve for it.

### 9. Jev judge unusable; flag names differ from the docs
`scripts/eureka-jev-judge.cjs` → `{"ok":false,"reason":"no_key"}`. Also takes `--tag`, while
the MCP `next_step` text says `--run-tag`. With the MCP side reporting `judge: "none"`,
`judged: 0`, eureka judged nothing on either surface.

### 10. Analogy `structural: 0` is blocked on nodes, not on encoding
`lib/core/research-planner/perspectives/analogies-recall.cjs:78`:
```js
const signal = c.shared_entities.length + sharedFw.length;
```
Room had `shared_entity: 0` and `canon_resolved: 0`, so all 8 pairs dropped
`no_relational_signal`. I wrote a full 7-layer SAPPhIRE encoding as a room artifact and re-ran:
**counts identical.** The encoding can never move that number. This is the entity-extraction
dependency.
*One useful datum:* `artifact_file` on a methodology artifact minted
`framework:knowns-and-unknowns-matrix-framework` via `canon_handle`. So framework nodes arrive
only when an artifact names a canon framework -- that is a cheap path to seeding `sharedFw`.

### 11. Brain egress is inconsistent across the three verbs
`brain_ask` and `brain_search` → `BRAIN_EGRESS_BLOCKED`, class `freeform_unproven`
("constitutional refusal, not an outage"). `brain_query` with the *same* vocabulary returned
`verdict: "ambiguous", disposition: "proceeded"` and answered. Two verbs refuse what the third
allows.

### 12. Minor
`brain_query` → `PLAN_REJECTED: plan operator AllNodesScan is not on the read allow-list`
(a label-less `MATCH (n)`). Fine as policy; worth saying so in the error.

---

## The positive finding, which may matter more than the defects

Across both deep runs, the only two search terms that returned usable evidence were the two
that named an **established engineering practice**: `powerline detection` and `optical time
domain reflectometry`. Every term that named the *problem* returned nothing: thin wire
detection, wire strike avoidance, cable cutting, tether cutting, fiber optic drone range, high
power microwave effective range, drone operator attribution.

That is six for nothing against two for everything, and it suggests the composer should bias
slots toward practice names rather than problem descriptions -- which is also, almost word for
word, what step 5 of Scientific Roadmapping asks a human to do.

---

## What the methodology produced, for context

Working at a fixed contested-zone slice of a Wicked room, the session: refuted one limiter on
its own recorded falsifier; split a second cleanly by mechanism; gave a third a real
derivation; found a fourth that was never in the original catalogue and now ranks first; and
reached a well-defined problem with a staged solution whose strongest supporting evidence
arrived last, from a science-fiction analogy, after the governed pipeline had failed four times.

Filed to the room: 6 artifacts, 4 proposed claims, 2 CONTRADICTS edges, 8 opportunity cards,
2 research run homes with full audit trails.

---

