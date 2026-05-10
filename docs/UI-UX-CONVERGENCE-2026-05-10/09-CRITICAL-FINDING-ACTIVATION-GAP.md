---
type: critical-finding
created: 2026-05-10
milestone: v1.13.0 "The Closed Loop"
brain_mode: mode-a (Neo4j Aura live; consulted directly via the my-neo4j MCP -- the graph holds both the diagnosis and the prescription; see 00b for the framework-chain confirmation)
status: working draft -- candidate for ratification alongside Canon Part 10 at the v1.13.0 final gate
---

# Critical Finding -- The Activation Gap

> **Tracked as `SEED-008`** (`.planning/seeds/SEED-008-intelligence-layer-activation-gap-close-the-loop.md`) -- a v1.13.0 FINAL RELEASE GATE concern, not a backlog idea. Embedded in `.planning/milestones/v1.13.0-CLOSED-LOOP-ROADMAP.md` (`related_seeds`, Seed Disposition, the "Loop-fires gate" blocker). Ratifies alongside Canon Part 10.

**The load-bearing realization for v1.13.0.** Stated plainly: MindrianOS's moat is "the graph that knows WHEN to use WHICH tool, calibrated by real teaching data" (`docs/moat.md`, verbatim). If the trigger mechanism -- the Navigation Engine (Phase 91), the proactive hooks, the auto-invocation of the algorithmic workflows and web research -- doesn't fire automatically on the right signal, the "knows WHEN" half is unrealized. **The moat becomes a claim, not a capability. "Mindrian is not Mindrian."** And the usage data shows it isn't firing. **And it is bigger than the Brain** -- see section 6: the local graph, the artifact-filing cascade, and the memory layers all run in the same compute-and-store-but-don't-deliver mode, and the local ones have no Canon Part 8 brake; they're just broken.

## 1. The evidence -- Brain-call usage analytics (2026-05-10)

`node mcp-server-brain/brain-admin.cjs usage`, filtered to exclude Jonathan Sagir (543 reqs on the "Desktop Permanent" key) and Lawrence Aronhime (43 + 0):

| Name | Plan | Requests | Last used |
|---|---|---|---|
| Leah Aronhime | admin | 40 | 2026-05-06 |
| Austin Granmoe | free | 9 | 2026-05-06 |
| Laszlo Szemelyi | pro | 5 | 2026-03-29 |
| Adam Peters | free | 3 | 2026-04-17 |
| Chiamala Aravamudhan | free | 3 | 2026-05-06 |
| Dror Barak | pro | 1 | 2026-04-12 |
| Jonathan Wilner | free | 1 | 2026-04-17 |
| Aryeh Holtzberg | free | 1 | 2026-04-29 |
| Amnon Dekel | pro | 1 | 2026-04-06 |

**Total: 64 external Brain calls, ever, across 9 people.** Jonathan's key alone is at 543 -- 8.5x the entire external base combined. The named tester cohort: Adam 3, Aryeh 1, Justin / Shmuel / Gary at **zero** (Gary just unblocked on install 2026-05-09; key re-issued; 0 uses). Issued-but-never-called: Gary, Taliah Lasry (pro), Pam Sheff (pro), Shmuel Schuman, Justin Stitzlein, `maydanw@gmail.com`.

**Read:** the Brain-enriched ("Full Loop", Mode A) MindrianOS experience is essentially untested by external users -- they're almost all running Tier 0 / Local-Only. That's tolerable by the canon (Larry's pedagogy is intrinsic), but it means the differentiated product is a hypothesis, not a validated experience. Root cause is NOT "users won't adopt the Brain" -- it's "**the product never triggers the Brain for them**." Different root -> different fix (wire the trigger, not market the Brain).

(Registry hygiene noted: duplicate-email rows -- Jonathan ×2/3, Aryeh ×2, Gary ×3 incl. one `revoked`. -> `08`'s 95.6 housekeeping scope.)

## 2. What the Brain says about it (Mode A, live)

**The graph already named this problem.** A `Question` node, verbatim:

> **"How might we design 'insight sensors' that trigger the most appropriate methodology lens?"**
> -- domain: `Dynamic Switching` . action: `Create smart triggers`
> -- `LEADS_TO` -> *"What if methodologies activated automatically based on the type of customer insight emerging?"*
> -- `ENABLES_EXPERIMENT` -> *"Insight Sensor Prototype"*

That "Insight Sensor Prototype" is the **Navigation Engine (Phase 91)**. So this isn't a discovery -- it's a known gap, written into the curriculum, not yet closed. The thing v1.13.0 calls "The Closed Loop" is the loop `signal -> trigger -> capability -> surface -> signal`. Today it's `signal -> ... -> nothing -> Tier 0`.

**This is a reverse salient in Hughes's exact sense.** Graph edges on `Reverse Salient`: `CAUSES -> "Growth of the Entire Enterprise is Hampered"`; `SUGGESTS -> "Need for Concentrated Action"`; `REQUIRES -> "Remedial Action"`; `APPEARS_IN -> "Expanding System"`. MindrianOS *is* an expanding system -- Brain (23,466 nodes / 166,960 edges), the algorithmic workflows, web research, the methodology surface, all growing. The **activation layer** has fallen out of phase with everything it should drive. Hughes's law, and `/mos:find-bottlenecks`'s own logic: optimize every other subsystem and the system won't advance. **The reverse salient of v1.13.0 is the trigger mechanism -- not the Brain, not the algorithms.**

**The value-proposition math says the same.** Graph: `Reverse Salient Analysis --FEEDS_INTO--> PWS Value Proposition`. The PWS VP framework's own properties: `formula: VPS = R*0.35 + W*0.35 + V*0.30`; `gates: Is It Real (R>=6.0), Can We Win (W>=5.5), Is It Worth It (V>=5.0)`; `teaching_note: A value proposition is not good or bad -- it is strong or weak. The Samsonite Test: strength beats premium.` W is the *defensibility* dimension. The activation reverse salient is, per the graph's own chain, an *input to W*. Not fired -> the analysis that feeds W is starved -> W drops below its gate -> VPS fails its gate. What's left running is Larry-with-a-journal: useful, but not the value proposition you're selling, and not defensible (anyone ships Larry-with-a-journal). **A dormant moat is a weak value proposition wearing strong-VP clothes.**

**The graph also encodes the connection to the algorithmic workflows directly:** `Algorithmic Generation of Reverse Salient Solutions --FEEDS_INTO--> Reverse Salient Analysis`; `HSI Semantic Surprise Analysis Assistant (type: analytical) --FEEDS_INTO--> Reverse Salient Analysis` (also `--> Domain Selection`). So the HSI / whitespace / reverse-salient algorithmic layer is, *in the graph itself*, a feeder of the analysis that feeds the moat score. Not triggering those algorithms starves the chain at its source.

## 3. Tester / opportunity counterfactual -- "would the Brain / algorithmic workflows have helped if invoked properly?"

| Pain (tester) / opportunity | What *should* have fired automatically | Brain? | Algorithmic? | Counterfactual outcome | Verdict |
|---|---|---|---|---|---|
| Install dies 4 ways (Gary) | `/mos:doctor` self-verify (post-install, automatic); proactive cross-relationship scan on install events | No -- Brain isn't a sysadmin | **Yes, high** -- doctor would have told Gary "registration incomplete: agents not symlinked, hook missing" instead of leaving his AI to reverse-engineer it | Algorithmic = big win; Brain = wrong domain |
| "Install is a recurring failure family" (4th in a row, nobody saw it) | Reverse-salient algorithm (Phase 89 engine) over the bug-report corpus; whitespace scan over `docs/testers/` | No (local data, Part 8) | **Yes, high** -- would have flagged "install is THE reverse salient" weeks before the NATO crunch | Algorithmic = big win |
| "Does it run in every Claude project?" (Gary) | -- | No | No | Nothing -- a docs/comms gap, not an activation gap | **Neither.** Not everything is an activation problem. |
| "Which room am I in?" (Lawrence) | The classifier's deterministic numeric/slug/quoted-name bypass (Phase 94-06 strict-mode); the Navigation Engine firing on the "8" | No -- a routing bug | **Yes** -- the algorithmic strict-mode resolver is the fix (caveat: even *that* misfired this session, matching "polygon" on the "MindrianOS" token -- precision problem) | Algorithmic = the fix; Brain = irrelevant |
| Empty room, no guidance (Lawrence's P1) | On first material: auto-trigger `/mos:explore-domains` (5-lens decomposition) + `/mos:whitespace` (HSI gap scan) + a Brain query for the stage-appropriate framework chain -- i.e. Phase 117 | **Yes, high** -- Brain returns the methodology path | **Yes, high** -- explore-domains + whitespace pre-populate the room with a domain tree, a gap map, candidate Opportunity Bank entries | **The showcase case.** The room is empty *because the trigger doesn't fire.* Both = the fix. |
| "I set a JTBD and nothing changed" (Phase 104) | The selector library + Navigation Engine *consuming* the JTBD signal -- re-tuning menus, re-weighting which commands fire, re-weighting Brain queries via `ADDRESSES_PROBLEM_TYPE` | **Yes, medium** -- Brain has the JTBD<->framework mappings | **Yes, high** -- the selector library makes the change visible | Both -- and the signal is already captured, just not consumed |
| The picker feels bolted-on | -- | No | No | Nothing -- the rendering/token-core problem (`03`, `05` C6) | **Neither.** |
| RS commands work but only when summoned (Justin/Aryeh) | Navigation Engine noticing "this conversation has a lagging-component shape -> run rs-fetch" | No | **Yes** -- the algorithm exists and works; it's just not auto-triggered | Algorithmic exists; the *trigger* is the gap |
| Important relationships dormant (Dror 1 call, Amnon 1, Laszlo 1) | Local Opportunity Bank scan + sentinel (`/mos:scout`) + cross-room aggregator surfacing "investor looked once, decks sent, re-engage" | No (Part 8 -- Brain doesn't know about Dror; correctly) | **Yes, medium** -- local algorithms could flag the re-engagement opportunity | Local algorithmic = medium; Brain = none, by constitution |

**Opportunity clusters (from `02`), same lens:** Cluster 1 "Meet me where I'm stuck" (Define+Prepare) -> the Brain + explore-domains + whitespace *would be the meeting*; **currently dormant** (Phase 114/115/117). Cluster 2 "Get it running" (Locate) -> algorithmic only -- doctor self-verify, preflight; **currently dormant** (no auto-doctor). Cluster 4 "Hand me something to show" (Conclude) -> **the Brain-enriched room IS the deliverable** -- whitespace map, reverse salients, HSI-scored Opportunity Bank, Brain framework path; **currently dormant**, so the founder gets a folder of markdown -- the journal she was escaping. The Opportunity Bank itself is an algorithmic workflow (HSI scoring + candidate ADDs from whitespace/reverse-salient): if the Act-1 engine fired on first material, *every session would generate banked opportunities.* 64 external Brain calls ever says it doesn't.

**The pattern, in one line:** for half the tester pain (install, routing, the bolted-on picker) the algorithmic workflows are the fix and the Brain is irrelevant -- and some of it isn't an activation problem at all. For the other half -- the half that's actually about *the product being the product* (empty room / what next / hand me something / I told you my job) -- the Brain + the Act-1 algorithmic engine are *exactly* the fix, and the only reason they didn't fire is the reverse salient: nothing triggers them.

## 4. It's bigger than the Brain -- the whole intelligence layer is "compute and store, not act"

The activation gap runs through every intelligence system, not just the Brain -- and the local ones have NO Canon Part 8 constitutional brake; they are simply broken.

- **Local graph (`room/.room-graph/`, SQLite).** WRITTEN fine (the filing cascade writes decision edges + the typed cross-relationship edges INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES on every artifact -- Canon Part 4). NOT NAVIGATED -- the Navigation Engine that should read STATE + the graph + the methodology cache for Mode B routing isn't wired (`routing_source: legacy` on every turn is the proof). `/mos:graph` / `/mos:query` / `/mos:rs-explain` read it -- only on manual invoke. Roadmap fix: Phase 109 ("sql-context-memory-navigation-spine", load-bearing) -- confirm it actually *navigates* before the gate.
- **Artifact-filing / cascade pipeline.** FILES fine; COMPUTES the cross-relationship scan fine; has NEVER DELIVERED. The room-proactive intelligence loop (Phase 88.1-03) has been silently broken since it shipped -- `skills/room-proactive/SKILL.md` reads cascade findings from `additionalContext`; the bash hook has always written them at JSON root; they never connected. *Mid-session intelligence injection has never functioned in production.* Phase 95 fixes the plumbing (side-channel); Phase 91 makes Larry *act* on it. No Part-8 excuse -- the local cascade loop has no constitutional brake at all.
- **Memory layers (3).** Within-session = fine, except post-compact re-injection is half-wired (`scripts/post-compact` writes `TRIPLE_CONTEXT` to a side-channel; the consumer is deferred -- memory degrades across an auto-compact boundary). Across-session = the Feynman-MINTO triple (MINTO.md governing thoughts) exists; the BRAIN.md per-folder quadruple is OFTEN ABSENT (which is exactly why every turn says `tier_mode: tier_0` / "BRAIN.md absent" -> the engine falls to its dumbest mode); the brain-derivation queue does NOT auto-drain (entries sit for days). Cross-room = the contradiction aggregator (Phase 90) exists but runs on the staleness scan / manual invoke, not proactively.

**Canon Part 9 (proposed) states the closed loop in one line:** *"Files preserve meaning. SQL remembers and navigates. Brain reasons over structured packets. Larry explains and acts. Human confirms truth."* Map the gaps: **Files** OK. **SQL** broken (stores, doesn't navigate -- Phase 109). **Brain** broken (not invoked -- heuristic sensors / Phase 91). **Larry acts** broken (cascade findings never reach him -- Phase 95 plumbing). **Human confirms** impossible (can't confirm what was never surfaced). Every link except "files" is "compute but don't deliver."

So the close-the-loop work is **three sub-loops, ordered by cheapness-per-leverage** (this is the Branch 2 detail in `08`):

1. **The local loop (cheapest; no Part-8 concerns; mostly scoped).** Fix the cascade-surfacing plumbing (Phase 95) + wire BRAIN.md derivation so the engine stops falling to Tier 0 + drain the brain-derivation queue + land Phase 109's navigation spine + wire the post-compact re-injection consumer. Highest leverage-per-effort on the board; touches zero Brain code. *Even if the Brain never came back online, v1.13.0's loop would still be broken -- because the local loop is broken.*
2. **The Brain / web loop (medium; Part-8-constrained).** Heuristic "insight sensors" first (the Brain's own `action: Create smart triggers` -- plural, lightweight): first-material -> `explore-domains` + `brain_framework_chain`; methodology moment -> Brain `CHAINS_TO` query; external-fact -> WebSearch hat-scoped per Canon Part 2; JTBD set -> re-weight selector menus + Brain queries. The `brain_framework_chain` / `brain_find_patterns` patterns already exist in `references/brain/query-patterns.md` -- nobody calls them automatically. Cheap v1.
3. **The unifier (Phase 91 full Navigation Engine).** Replaces the heuristic sensors with a calibrated classifier. The v2.

## 5. What this changes (folded into `08`)

- A new branch in the Minto tree: **Branch 2 "Wire the Trigger"** -- elevated to VITAL, sitting right behind the floor (95.6), ahead of the foundation (token core). Phase 91 (Navigation Engine) + the proactive hooks + Phase 117 (auto-explore-domains-on-first-material).
- **The v1.13.0 final gate must test the loop fires** -- not "does the code exist" but "in a session that should trigger a Brain call, does one happen? `routing_source: engine` not `legacy`? does WebSearch fire when it should? does explore-domains run on first material?" (This is already in Phase 94-03's acceptance criteria and has been emitting `legacy` all session -- the symptom, live.)
- Ratification candidate: this finding ratifies alongside Canon Part 10 ("Conversation as Product") at the v1.13.0 final gate -- because "the conversation IS the surface" only holds if the conversation can *reach* the Brain, the algorithms, and the world.

## 6. The stress-test before committing the re-order

Is the *full* Navigation Engine the right shape, or does the trigger need to be cheaper/dumber first? The Brain's own beautiful-question node says `action: Create smart triggers` -- plural, lightweight -- which leans toward "heuristic sensors first, full engine later." Run `/mos:challenge-assumptions` on it before Phase 91 eats a milestone. (Tracked: `SEED-008` Acceptance Contract treats the "loop fires" 5-check test as the gate blocker; the *shape* of the fix -- sensors vs full engine -- is the open question.)

## 7. Brain insights vs non-Brain insights -- the honest comparison

This whole bundle was produced mostly without the Brain (Aura was paused for the first half); the Brain came back and was queried manually for `09` and `00b`. The honest accounting of what each contributed:

**Non-Brain (embedded references + Canon + manual analysis) gave the substance** -- the contradictions (`05`), the two reverse salients (`03`, `04`), the tester pains and the JTBD matrix (`02`, `07`), the Kano "fix the broken floor first" sequencing, the "Floor -> Trigger -> Foundation -> Surfaces" pyramid (`08`), the brain-admin usage analytics (admin metadata, not a Brain query). The session could not have run without it; this *is* the body of work.

**Brain (live Neo4j, Mode A) gave confirmation, precision, named chains, stage placement, and the edge paths that justify the findings:**
- The graph *already named the problem* -- the "insight sensors" beautiful-question node. Non-Brain reasoning suspected an activation gap; the Brain showed the curriculum had articulated it and the remedy.
- The framework chain, confirmed and named -- non-Brain guessed "Decompose -> JTBD -> journey-map -> token-map"; the graph gave the precise chain (`Design Thinking -> {JTBD, User Journey Mapping} -> Process Mapping -> Reverse Salient Analysis -> PWS Value Proposition`), the decomposition sub-chain (`MAP THE HIERARCHY -> Hierarchy Mapping -> Systems Thinking -> Reverse Salient Analysis`), the UJM process-step nodes (the 1:1 map onto the v1.14.0 sub-plans), and the `User Journey Mapping REVEALS "Making the Invisible Visible"` edge. (See `00b`.)
- The activation-gap argument became graph-backed, not inferred -- `Reverse Salient Analysis --FEEDS_INTO--> PWS Value Proposition`, and the algorithmic workflows `--FEEDS_INTO--> Reverse Salient Analysis`. Non-Brain reasoning got to "the moat is dormant"; the Brain gave the edge path that proves it.
- The value-proposition math -- the PWS VP framework's actual properties (`VPS = R*0.35 + W*0.35 + V*0.30`; gates R>=6.0 / W>=5.5 / V>=5.0; teaching note "a value proposition is not good or bad -- it is strong or weak"). That let "all our moat claims disappear" be restated as "W drops below its gate -> VPS fails." A number, not a vibe.
- Stage placement (the `TYPICAL_AT` edges) and classification confirmation (the literal "Ill-Defined + Wicked" node).

| Dimension | Non-Brain | Brain (live) |
|---|---|---|
| What it gave | The findings themselves -- contradictions, reverse salients, tester pains, the JTBD matrix, the sequencing logic | Confirmation, precision, named chains, stage placement, the edge paths that justify the findings |
| Could the session have run without it? | No -- this is the substance | Yes -- but the recommendations stay "Tier-0 inference," and the activation-gap argument is reasoning rather than graph-backed |
| Where it was useless | n/a | Install bugs, the room-classifier bug, the bolted-on picker -- wrong domain; the Brain holds methodology, not sysadmin/routing/rendering |
| Where it was decisive | Everywhere structural | The activation-gap finding -- the Brain held *both* the diagnosis (the "insight sensors" node) *and* the prescription (the Navigation Engine = "insight sensor prototype") *and* the edge path algorithms -> Reverse Salient -> PWS VP that makes it the moat-killer |

**The meta-point -- which is itself the critical finding:** the Brain added real, decisive value here -- but only because a human manually queried it. In normal operation nothing triggers it. The 64-calls-ever number proves the gap. So the comparison's own conclusion is: **Brain insights are strictly better where they apply -- and the product's problem is that they almost never get invoked.** That is `SEED-008` in one sentence.
