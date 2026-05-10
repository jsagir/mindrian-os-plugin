---
type: critical-finding
created: 2026-05-10
milestone: v1.13.0 "The Closed Loop"
brain_mode: mode-a (Neo4j Aura live; consulted directly via the my-neo4j MCP -- the graph holds both the diagnosis and the prescription; see 00b for the framework-chain confirmation)
status: working draft -- candidate for ratification alongside Canon Part 10 at the v1.13.0 final gate
---

# Critical Finding -- The Activation Gap

**The load-bearing realization for v1.13.0.** Stated plainly: MindrianOS's moat is "the graph that knows WHEN to use WHICH tool, calibrated by real teaching data" (`docs/moat.md`, verbatim). If the trigger mechanism -- the Navigation Engine (Phase 91), the proactive hooks, the auto-invocation of the algorithmic workflows and web research -- doesn't fire automatically on the right signal, the "knows WHEN" half is unrealized. **The moat becomes a claim, not a capability. "Mindrian is not Mindrian."** And the usage data shows it isn't firing.

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

## 4. What this changes (folded into `08`)

- A new branch in the Minto tree: **Branch 2 "Wire the Trigger"** -- elevated to VITAL, sitting right behind the floor (95.6), ahead of the foundation (token core). Phase 91 (Navigation Engine) + the proactive hooks + Phase 117 (auto-explore-domains-on-first-material).
- **The v1.13.0 final gate must test the loop fires** -- not "does the code exist" but "in a session that should trigger a Brain call, does one happen? `routing_source: engine` not `legacy`? does WebSearch fire when it should? does explore-domains run on first material?" (This is already in Phase 94-03's acceptance criteria and has been emitting `legacy` all session -- the symptom, live.)
- Ratification candidate: this finding ratifies alongside Canon Part 10 ("Conversation as Product") at the v1.13.0 final gate -- because "the conversation IS the surface" only holds if the conversation can *reach* the Brain, the algorithms, and the world.

## 5. The stress-test before committing the re-order

Is the *full* Navigation Engine the right shape, or does the trigger need to be cheaper/dumber first? The Brain's own beautiful-question node says `action: Create smart triggers` -- plural, lightweight -- which leans toward "heuristic sensors first, full engine later." Run `/mos:challenge-assumptions` on it before Phase 91 eats a milestone.
