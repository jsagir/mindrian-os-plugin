---
status: spec-locked
priority: CRITICAL (highest), but ships LATE — target band: v1.13.0-beta.10 (the capstone, not a beta.2 bolt-on)
target-band: v1.13.0-beta.10
created: 2026-05-11
owner: jsagi
relates-to: v1.13.0 "The Closed Loop" thesis ("Larry leads. SQL remembers. Brain reasons. Commands are internals."), navigation engine (Phase 91/91.6), larry-default-activation (Phase 114), conversation-operator state machine (Phase 99), SQL graph + memory triple (Phase 108/109), persona/role_blend (Phase 115), cascade hooks (Phase 116/117), Canon Part 9 + Part 10 proposal, Hooked Model audit, /mos:act autonomous engine, brain-cleanup Phase 5 (enrichCausalEdges -> FEEDS_INTO rewrite)
hard-dep: brain-cleanup Phase 5 (Workflow Layer Phase 3 only); brain-cleanup Phase 4 is DONE
brain-impact: NONE (the Brain stays methodology-pure; this is 100% plugin-side)
---

# Workflow Layer — framework ↔ command registry + reliable invocation

## Why (the highest need)

Larry can read the Brain's methodology chains (`Framework -[:FEEDS_INTO]-> Framework`, 163 edges / 7,882 traversable chains after brain-cleanup Phase 4). What he *cannot* reliably do is turn "the methodology suggests framework X" into "run `/mos:x`" — because the framework→command mapping is not 1:1, some frameworks have no command, some commands run no single framework, and today Larry names commands from memory (and sometimes names one that does not exist, e.g. `/mos:jtbd` — the real command is `/mos:analyze-needs`).

The fix is **not** "put commands in the Brain." That creates a second store to hand-sync — the exact drift class brain-cleanup just spent days scrubbing out of Neo4j, and it forfeits the Brain's portability (a methodology graph anyone could lift). The reliable move is the opposite: the truth lives in **one** place (the command file's own frontmatter), everything else is **generated from it and CI-checked against it**, and **Larry is not permitted to be a source of truth** about which command runs what.

## The five reliability rules (these are the contract, not suggestions)

1. **Single source of truth.** `frameworks:` in each command's frontmatter is the only place the framework↔command mapping is declared. Nothing else — no skill, no doc, no hardcoded map — may assert it.
2. **Generated, never hand-written; drift impossible to commit.** `data/command-registry.json` is built from frontmatter by `scripts/build-command-registry.cjs`. A CI tripwire fails the build if (a) the registry is stale vs. the command frontmatter, or (b) a command declares a `frameworks:` entry that is not a resolvable Brain framework name (validated against a `framework-names` list mirrored from a Brain query at build time / from `BRAIN-SCHEMA.md`). Same pattern as the Brain-side Phase-6 CI-01 tripwire.
3. **The resolver is the only door.** `lib/workflow/command-resolver.cjs` is the *sole* path from "framework" to "command." `/mos:suggest-next`, `/mos:pipeline`, `/mos:act`, the `pws-methodology` skill, the `brain-connector` skill, and the navigation hook all go through it. **Larry never names a `/mos:` command from memory** — every command he emits came back from the resolver. This eliminates the hallucinated-command failure mode permanently.
4. **The trigger is the hook, not the model.** The navigation engine (engine v1, the `UserPromptSubmit` hook firing on every message) gains a workflow-suggestion step: detect problem-description / methodology intent → `recommendFrameworkChain` (Brain `FEEDS_INTO` traversal) → `composeWorkflow` (resolver) → surface the command sequence as `offer_next_step`. Invocation is *computed* by a deterministic graph+registry lookup; Larry is the voice, not the decision-maker.
5. **Degrade, do not fabricate.** Framework with no command yet → "run [framework] manually — there's no `/mos:` for it." Never a made-up command. No Brain → registry still gives framework↔command. No registry → Larry falls back to framework-only advice. Each layer fails to a *true* statement.

## CRITICAL PATH — the algorithmic commands go first

The retrofit (Phase 1) and registry (Phase 2) **must prioritize the computational/algorithmic command cohort** — the commands that do real work over the room graph + Brain (not template-fill). These are the ones whose chaining unlocks the most value, so they get frontmatter-retrofitted, registered, and chain-composable *before* the utility commands. The cohort (canonical-name to be confirmed against `commands/*.md`):

- **HSI** — `/mos:score-innovation` (cross-domain innovation scoring; `requirements-hsi.txt`, the HSI scripts)
- **Whitespace** — `/mos:whitespace` (coverage-gap detection; `scripts/whitespace-command.cjs` + `whitespace-to-graph.cjs` + `whitespace-to-brain.cjs`)
- **Domain analysis / decomposition** — `/mos:explore-domains` (IKA + Feynman decomposition), `/mos:explore-trends`, `/mos:macro-trends` (PEST)
- **Deep research + Six Hats** — `/mos:research` (web + Brain cross-reference), `/mos:think-hats` (De Bono Six Hats), `/mos:persona` (Six-Hats lenses from room data), `/mos:hat-briefing` (consolidated hat briefings), `/mos:scenario-plan` (2x2)
- **Reverse Salient pipeline** — `/mos:rs-fetch` (full discovery pipeline), `/mos:rs-experts`, `/mos:rs-thesis`, `/mos:rs-explain`, `/mos:find-bottlenecks` (Reverse Salient)
- **Cross-domain pattern engines** — `/mos:find-connections`, `/mos:find-analogies` (SAPPhIRE + TRIZ), `/mos:compare-ventures`
- **Diagnostics / fingerprint** — `/mos:diagnostics` (Wave-1 algorithmic fingerprint), `/mos:diagnose` (PWS matrix), `/mos:causal` (causal-edge trace), `/mos:mos-reason` (Feynman-MINTO reasoning), `/mos:root-cause` (5-Whys / Fishbone / Fault Tree)
- **Scoring / grading** — `/mos:analyze-needs`, `/mos:user-needs`, `/mos:validate` (importance–satisfaction), `/mos:value-proposition`, `/mos:grade`, `/mos:deep-grade`, `/mos:mullins` (7-Domains)
- **Systems / timing** — `/mos:systems-thinking`, `/mos:analyze-systems`, `/mos:analyze-timing` (S-Curve), `/mos:dominant-designs` (Utterback-Abernathy), `/mos:explore-futures`
- **Argument / structure / knowledge** — `/mos:structure-argument` (Minto + SCQA + MECE), `/mos:build-thesis` (Ten-Questions), `/mos:build-knowledge` (DIKW), `/mos:map-unknowns` (Rumsfeld), `/mos:beautiful-question`, `/mos:lean-canvas`

Utility (`/mos:status`, `/mos:help`, `/mos:rooms`, `/mos:organize`, ...) and meta-orchestrators (`/mos:pipeline`, `/mos:act`, `/mos:suggest-next`) get frontmatter (`kind: utility|meta`, `frameworks: []`) but are *not* on the critical path for the retrofit ordering.

## Build pieces (in order)

### Phase 1 — Frontmatter contract + retrofit (algorithmic cohort FIRST)
Extend the `/mos:` command frontmatter schema; document it as `docs/COMMAND-FRONTMATTER.md` (next to `ui-system`). Each command declares:
- `kind: methodology | utility | meta`
- `frameworks: ["<exact Brain framework name>", ...]` (empty for `utility`/`meta`)
- `produces: "<room artifact pattern>"`
- `inputs: ["<expected room state>", ...]`
- `autonomous_safe: true|false` (may `/mos:act` run it unattended)
Retrofit the algorithmic cohort first, then the rest.

### Phase 2 — Registry + generator + CI tripwire
- `data/command-registry.json`: `{ ontology_ref, commands[], framework_index, curated_chains[] }` (the schema in the brain-cleanup 04-02 context / repeated here).
- `scripts/build-command-registry.cjs`: scan frontmatter → build registry → validate against `framework-names` (mirrored from a Brain query / `BRAIN-SCHEMA.md`).
- CI: run the generator, fail on stale registry OR unresolvable framework. (Mirror Phase-6 Brain CI-01.)

### Phase 3 — Resolver + chain recommender
- `lib/workflow/command-resolver.cjs`: `commandsForFramework`, `frameworksForCommand`, `composeWorkflow(frameworkChain) -> [{step, framework, command|null, optional}]`, `validateChainAutonomy(workflow) -> {runnable, blockers}`. Reads only `data/command-registry.json` at runtime.
- `lib/brain/chain-recommender.cjs` (or extend `brain-ask.cjs`/`brain-client.cjs`): `recommendFrameworkChain({problemType?, currentFramework?, roomState?}) -> [frameworkName]` via `FEEDS_INTO` traversal. **Depends on brain-cleanup Phase 5** (the `enrichCausalEdges` rewrite to use `FEEDS_INTO` instead of the now-zero `CO_OCCURS` edges) — sequence accordingly.

### Phase 4 — Wire the orchestrators
- `/mos:suggest-next` — render the recommended framework chain AND its command sequence.
- `/mos:pipeline` — new arg `--from-problem-type <x>` / `--from-framework <x>`: Brain-derive the chain, compose commands, run in sequence.
- `/mos:act` — pick the framework for the room state via the recommender, resolve to command, run; `--chain` mode runs the composed workflow but `validateChainAutonomy` first and stops at the first non-autonomous step with a "needs you here" gate.

### Phase 5 — Skill cleanup + docs + end-to-end
- `pws-methodology` skill: delete the hardcoded framework→command routing; point at `command-resolver.cjs`.
- `brain-connector` skill: weave "...and the command for that is `/mos:x`" passively.
- `docs/WORKFLOWS.md`: the Brain↔registry↔Larry join, and the Canon Part 8 boundary (commands never enter the Brain). Update `THE-BRAIN.md` to point at it.

## Acceptance criteria

- `scripts/build-command-registry.cjs` runs clean; CI fails on a command with an unresolvable framework or a stale registry.
- `composeWorkflow(["Beautiful Question Framework","Domain Selection","Jobs to Be Done (JTBD)"])` → `[/mos:beautiful-question, /mos:explore-domains, /mos:analyze-needs]` (with explicit `null` markers wherever a framework has no command).
- `/mos:suggest-next` in a room with a known `ProblemType` returns a *command sequence*, not just a framework list.
- `/mos:pipeline --from-problem-type ill-defined` runs a Brain-derived command chain.
- `/mos:act --chain` stops at the first non-`autonomous_safe` step.
- The algorithmic cohort (HSI / whitespace / explore-domains / research+think-hats / rs-* / find-* / diagnostics / causal / scoring) is registered and chain-composable *before* the utility commands.
- **Zero Brain mutation**: `BRAIN-SCHEMA.md` sha256 unchanged; 27 labels / 28 rel types unchanged; no `Command` node anywhere; the Brain's `IMPLEMENTED_AS` edges untouched.

## How this slots into the v1.13.0 roadmap — it is the CAPSTONE (target: beta.10)

Slot this **late, not early — as `v1.13.0-beta.10`**, the capstone that closes the loop, *not* a beta.2 bolt-on. The reason: the Workflow Layer is only as reliable as the foundations it stands on, and those foundations are themselves in-flight v1.13.0 work. Ship it before they stabilize and you've built the capstone on sand. So: it is `CRITICAL` (highest-priority, well-scoped, queued) but it ships **after** the substrate, and it must be *designed knowing what else 1.13.0 delivers* so it makes maximal use of all of it.

It is the operational realization of the v1.13.0 thesis ("Larry leads. SQL graph remembers. Brain reasons. Commands are internals.") — the thing that turns "Larry leads → invokes the right command" from a hope into a CI-enforced guarantee. Formalize via `/gsd:insert-phase` / `/gsd:add-phase` with this file as the brief, slotted in the beta.10 band.

### What it leverages — design it knowing all of 1.13.0 (this is a hard requirement, not a nice-to-have)

The Workflow Layer must be built on top of, and make the best of, every relevant piece of v1.13.0:

- **Navigation engine + graph wiring (Phase 91 / 91.6, the `engine v1` hook firing on every message)** — the Workflow Layer's "trigger is the hook" rule plugs *directly* into the navigation engine: the workflow-suggestion step becomes a stage in `engine v1`'s `offer_next_step` pipeline. It does NOT re-implement intent detection — it consumes the engine's classification.
- **larry-default-activation (Phase 114) + `.mcp.json` alwaysLoad on the brain MCP server (SEED-003 A1)** — the Workflow Layer assumes Larry is the default surface ("commands are internals") and the brain MCP is always-on, so `recommendFrameworkChain` is a constant, not a maybe.
- **conversation-operator state machine (Phase 99: JUST_TALK / EXPLORE_CAPTURE / BUILD_ROOM / METHODOLOGY / DECISION_GATE)** — the workflow suggestion is **operator-aware**: it surfaces command chains under `METHODOLOGY` / `BUILD_ROOM` / `DECISION_GATE`, stays quiet under `JUST_TALK`. The resolver output is filtered by the active operator.
- **SQL graph + memory triple (Phase 108/109, v1.11.0 memory)** — `recommendFrameworkChain` reads *room state* (which sections exist, which JTBD is active, which problem type is set, what's been filed) from the SQL navigation spine — that's how it picks *which* framework to start the chain from. It writes its proposals/acceptances back as `memory_event` rows so the loop is observable.
- **brain-cleanup Phase 5 (`enrichCausalEdges` → `FEEDS_INTO`, framework corpus re-embed)** — HARD dependency for Workflow Layer Phase 3. The chain traversal is `FEEDS_INTO` over the cleaned Brain; the vector-similarity fallback ("frameworks like this one") needs the re-embedded corpus (target 748/748, baseline 6/100). Phases 1, 2, 4-(partial), 5-(docs) of this spec can start before that; Phase 3 waits.
- **Canon Part 9 (files preserve meaning · SQL remembers · Brain reasons · Larry explains · human confirms) + Canon Part 10 proposal (conversation as product)** — the Workflow Layer *is* "Brain reasons → Larry proposes a workflow → human confirms." It should be cited as a Part-9/Part-10 exemplar; the `--chain` autonomy gates are the "human confirms" clause made literal.
- **F-shape selectors (the accept / reject / defer UI)** — a proposed workflow renders as `F.0`: "run this chain? `/mos:a` → `/mos:b` → `/mos:c` — [accept] [reject] [defer]". Accept → run (respecting autonomy gates); defer → it persists as a pending nudge.
- **cascade-edge infra + tension/auto-explore hooks (Phase 116/117, the typed `INFORMS`/`CONTRADICTS`/`CONVERGES`/`INVALIDATES`/`ENABLES` cascade)** — the Workflow Layer's proactive "...and the command for that is `/mos:z`" rides the *same* cascade surface; a `CONTRADICTS` finding can carry a suggested command to resolve it.
- **persona / role_blend (Phase 115)** — the workflow suggestion is framed in the navigator's active persona blend (a researcher gets "run the diagnostics fingerprint first"; a founder gets "let's score this with Mullins").
- **Hooked Model audit (27/70 → 58/70)** — the Workflow Layer is a deliberate move on the *action* and *variable-reward* axes: a one-tap "run this → get a filed artifact → here's the next link" loop. Note the per-axis delta in the milestone audit when this lands.
- **UI Ruling System (`ui-system` skill, 4-zone anatomy)** — every workflow render is a `body_shape` (an F-selector list + an intelligence strip); no command invents its own format. The `command-registry` carries each command's `body_shape` so the orchestrator renders consistently.

In one line: **beta.10 = the loop closes** — the navigation engine routes you, the operator state machine sets the mode, the SQL graph says where you are, the cleaned Brain says what's next, the registry says which command does it, Larry proposes it as an F-selector, you confirm, `/mos:act` runs it, the artifact files, the cascade fires, the next nudge surfaces. The Workflow Layer is the wiring that makes that one sentence true — which is exactly why it ships last and ships informed.
