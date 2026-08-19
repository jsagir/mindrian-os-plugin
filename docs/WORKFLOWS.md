# Workflows -- the framework-to-command layer

> Phase 122 (Workflow Layer, shipped in the v1.13.0 capstone band). The link in the closed loop that turns "the methodology suggests framework X" into "run `/mos:x`" -- as a CI-enforced guarantee, never a hope. See also: `docs/COMMAND-FRONTMATTER.md` (the frontmatter contract), `docs/THE-BRAIN.md` (the methodology graph), `.planning/WORKFLOW-LAYER-SPEC.md` (the spec-locked authority).

---

## 1. The closed loop

The navigation engine routes you (intent classified on every message); the conversation-operator state machine sets the mode (JUST_TALK / EXPLORE_CAPTURE / BUILD_ROOM / METHODOLOGY / DECISION_GATE); the SQL navigation spine says where you are (which sections exist, which JTBD is active, which problem type is set, what has been filed); the cleaned Brain says what is next (`Framework -[:FEEDS_INTO]-> Framework` chains); the registry says which command does it (`data/command-registry.json`, generated from `commands/*.md` frontmatter); Larry proposes it as an F-shape selector ("run this chain? `/mos:a` -> `/mos:b` -> `/mos:c` -- [accept] [reject] [defer]"); you confirm; `/mos:act` runs it (respecting the autonomy gates); the artifact files; the cascade fires (INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES); the next nudge surfaces. The **Workflow Layer is the registry+resolver link in that sentence** -- nothing more, nothing less. It is ~90% wiring of code that already shipped (the navigation engine, the Brain client, the Feynman runner, the pre-commit hook); the new pieces are the generated registry, the resolver, the recommender, and these docs.

## 2. The five reliability rules

These are the contract, not suggestions (verbatim from `.planning/WORKFLOW-LAYER-SPEC.md`):

1. **Single source of truth.** `frameworks:` in each command's frontmatter is the only place the framework-to-command mapping is declared. Nothing else -- no skill, no doc, no hardcoded map in `lib/core/` -- may assert it. (`docs/COMMAND-FRONTMATTER.md` is the contract; Phase 122-05 pruned the last three hand-maintained maps: `framework-chain-composer.FRAMEWORK_TO_COMMAND_SLUG` is now empty, `lib/hmi/jtbd-taxonomy.json:methodology_hooks` is marked informational-only, `references/methodology/index.md` is now just a pointer.)
2. **Generated, never hand-written; drift impossible to commit.** `data/command-registry.json` is built from frontmatter by `scripts/build-command-registry.cjs`. A CI tripwire fails the build if (a) the committed registry is stale vs. the command frontmatter (`build-command-registry.cjs --check`), or (b) a command declares a `frameworks:` entry that is not a resolvable Brain framework name (validated against `data/framework-names.json`, the FEEDS_INTO-linked subset mirrored from a read-only Brain query at build time). The tripwire runs in `.git/hooks/pre-commit` (when any `commands/*.md` / `data/command-registry.json` / `data/framework-names.json` is staged) and in `lib/memory/run-feynman-tests.cjs` (the Feynman runner) -- same pattern as the Brain-side Phase-6 CI-01 tripwire. No GitHub Actions, no new dependencies.
3. **The resolver is the only door.** `lib/workflow/command-resolver.cjs` is the sole path from "framework" to "command." `/mos:suggest-next`, `/mos:pipeline`, `/mos:act --chain`, the navigation hook (`framework-chain-composer.proposeNextFramework`), the `pws-methodology` skill, and the `brain-connector` skill all go through it (`commandsForFramework(<framework>)`, `composeWorkflow(<framework-chain>)`, `validateChainAutonomy(<workflow>)`). **Larry never names a `/mos:` command from memory** -- every command he emits came back from the resolver. This eliminates the hallucinated-command failure mode permanently (Larry cannot emit `/mos:jtbd` thinking it runs the JTBD methodology -- `composeWorkflow(["Jobs to Be Done (JTBD)"])` returns `/mos:analyze-needs`, the real command).
4. **The trigger is the hook, not the model.** The navigation engine (the `UserPromptSubmit` hook firing on every message) computes the invocation: detect problem-description / methodology intent -> `recommendFrameworkChain` (Brain `FEEDS_INTO` traversal, in `lib/brain/chain-recommender.cjs`) -> `composeWorkflow` (the resolver) -> surface the command sequence as `offer_next_step`. Invocation is a deterministic graph+registry lookup; Larry is the voice, not the decision-maker.
5. **Degrade, do not fabricate.** A framework with no command yet -> "run [framework] manually -- there is no `/mos:` for it" (`composeWorkflow` yields `{ command: null, optional: true }`). Never a made-up command. No Brain -> the registry still gives framework-to-command (the resolver reads only the local registry; zero network). No registry -> the resolver degrades to empty results and Larry falls back to framework-only advice. Each layer degrades to a *true* statement -- it never fabricates.

## 3. The Brain <-> registry <-> Larry join (and the Canon Part 8 boundary)

```
   THE BRAIN (pws-brain-mcp.onrender.com, Memgraph)            THE PLUGIN (this repo)                      RUNTIME (Larry)
   ----------------------------------              ----------------------                      ---------------
   Framework -[:FEEDS_INTO]-> Framework            commands/*.md  frontmatter:                  command-resolver.cjs
   (the methodology chains -- generic,               frameworks: ["<exact Brain name>", ...]      commandsForFramework(fw) -> ["/mos:x", ...]
    no user data, anyone could lift it)                       |                                  composeWorkflow([fw1, fw2, ...]) -> [{step, framework, command|null, optional}]
            |                                       build-command-registry.cjs (generator)       validateChainAutonomy(workflow) -> {runnable, blockers}
            | (read-only, build time only,                     |                                          |
            |  query carries :Framework names       data/command-registry.json (generated,                | (zero Brain calls;
            |  ONLY -- a methodology handle)          committed, --check tripwire)                          |  reads only the local registry)
            v                                                  ^                                          |
   data/framework-names.json  <--- VALIDATED AGAINST ----------/                          chain-recommender.cjs
   (the FEEDS_INTO-linked :Framework slice +                                                recommendFrameworkChain({problemType?, currentFramework?, roomState?})
    a small curated whitelist; the ONLY                                                        -> [frameworkName]  (via FEEDS_INTO; framework names + problem-type enums only)
    Brain-derived artifact in this loop)
```

The Brain holds **methodology** (`Framework -[:FEEDS_INTO]-> Framework`, the chains, the teaching patterns). The plugin-local `data/command-registry.json` holds the **framework-to-command mapping** -- generated from frontmatter, VALIDATED against the Brain's framework names at build time via a read-only query (`MATCH (f:Framework) WHERE (f)-[:FEEDS_INTO]-() RETURN f.name`), and NEVER written back. `lib/workflow/command-resolver.cjs` joins them at runtime with **zero Brain calls** (it reads only the local registry). `lib/brain/chain-recommender.cjs` is the only piece that talks to the Brain at runtime, and its `FEEDS_INTO` Cypher binds only the seed framework name (`$seed`, a generic handle, sanitized) -- never a command string, never user content.

**Commands NEVER enter the Brain -- no `Command` node, ever.** The Brain is a repository of strategic thinking tools, not a repository of user data and not a repository of plugin internals (Canon Part 8, `docs/MINDRIAN-CANON.md`). A command string in a Brain-query payload is a canonical breach -- the `brain-boundary-scan` PR gate exists for it, and `lib/memory/workflow-layer-e2e.test.cjs` runs a grep sweep that fails the build if a `/mos:` literal appears near a `brain`/`query`/`fetch`/`http` token in `lib/brain/` or `lib/workflow/`, if `command-resolver.cjs` requires a brain client, if `build-command-registry.cjs` contains write-Cypher, or if a `Command`-node assertion survives anywhere in `skills/`, `agents/`, or `references/`. Phase 122-05 deleted the last dead `Command`-node prose (the `brain-connector` SKILL.md block and `references/brain/command-triggers-schema.md` -- both asserted commands live in the Brain; both were dead text; both bred the breach).

## 4. The surfaces

| Surface | What it does |
|---------|--------------|
| `/mos:suggest-next` | Reads the room's ProblemType / active JTBD, `recommendFrameworkChain` -> `composeWorkflow` -> renders the recommended framework chain AND its `/mos:` command sequence (a command-less framework renders "run it manually"). Helper: `scripts/suggest-next-command.cjs`. |
| `/mos:pipeline --from-problem-type <x>` / `--from-framework <x>` | Brain-derives the chain, composes commands, prints the `/mos:` run order; command-less steps print "run manually -- continuing". Helper: `scripts/pipeline-command.cjs`. |
| `/mos:act --chain` | `recommendFrameworkChain` -> `composeWorkflow` -> `validateChainAutonomy` FIRST -> runs the `autonomous_safe` prefix unattended and STOPS at the first non-`autonomous_safe` (or command-less) step with a "needs you here" gate. The autonomy gates are the Canon Part 3 "human confirms" clause made literal. Helper: `scripts/act-command.cjs`. |
| The navigation hook | `framework-chain-composer.proposeNextFramework` resolves the next framework's `/mos:` command via the resolver; the proposal carries a `composeWorkflow` array as data; surfaced through `offer_next_step` (the `offer_next_step` workflow in the navigation engine). |
| The `pws-methodology` skill | Framework routing -> the resolver; never names a `/mos:` from memory. |
| The `brain-connector` skill | Weaves "...and the command for that is `/mos:x`" passively -- via the resolver, not from the Brain. |

## 5. Canon citations

- **Part 7 (Reuse Before Build)** -- this is ~90% wiring of existing code (the navigation engine, the Brain client, the Feynman runner, the pre-commit hook); the only net-new files are the generated registry + generator, the resolver, the recommender, and these docs. Phase 122-05 *deletes* drift-class surface (three hand-maintained maps) rather than adding it.
- **Part 8 (The Graph Boundary)** -- the registry is plugin-local, validated against Brain names, never written back; commands never enter the Brain; the e2e grep sweep + the `brain-boundary-scan` PR gate enforce it.
- **Part 3 (The Tri-Context Decision Gate)** -- the resolver's `composeWorkflow` feeds the Decision Gate: a proposed workflow renders as an F-shape selector; `validateChainAutonomy` is the "human confirms" clause made literal.
- **Part 4 (Every Choice Is Graph Data)** -- the command suggestion is a deterministic graph+registry lookup, not model recall; the proposal/acceptance/rejection becomes a `memory_event` row and a typed graph edge.
- **Part 9 / Part 10 (Memory locality / Conversation as product)** -- the Workflow Layer is the "Brain reasons -> Larry proposes a workflow -> human confirms" exemplar; `docs/CANON-PHASE-MAP.md` records Phase 122 under Part 7, Part 8, and the v1.13.0 milestone table.

---

## 6. The F-Selector Ranker -- the next-move surface (Phase 125, v1.13.0-beta.14)

> Phase 125 (F-Selector Ranker, the ranking + decision-capture layer above the Phase 122 workflow layer). The link in the closed loop that turns "the methodology suggests framework chain X" into "here are the top-3 next-move commands, ranked, with badges, with accept/defer/reject/none-fit affordances, with the decision captured as graph data." See also: `docs/F-SELECTOR-CONSUMER-GUIDE.md` (the consumer wiring contract), `.planning/phases/125-f-selector-ranker/125-CONTEXT.md` (the design lock), `data/brain-packet-schema.json` (the `framework_chain_hint` superset extension).

### Phase 04 schema note -- `framework_chain_hint` (Plan 125-04)

Plan 125-04 extends `data/brain-packet-schema.json` with an optional
`framework_chain_hint` object under `local_graph_summary`. The shape:

```json
{
  "local_graph_summary": {
    "framework_chain_hint": {
      "edges": [
        { "from": "...", "to": "...", "confidence": 0.82,
          "transform_description": "...", "hop_distance": 1 }
      ],
      "slice_scope": 1,
      "slice_rationale": "well-defined state, strong governing_thought",
      "brain_snapshot_id": "<sha>",
      "fetched_at": "<ISO timestamp>"
    }
  }
}
```

The field is OPTIONAL (superset, backwards-compatible). When absent, the
ranker degrades gracefully to local-signal-only scoring (Tier-0 or
brain-unreachable paths). When present, it carries the 1-3 hop FEEDS_INTO
slice the ranker uses for the `brain_confidence` term of the D4 scoring
formula. The ajv2020 validator (Phase 110's stack) accepts packets with and
without the hint -- the existing Phase 110 packet tests continue to pass
without regression.

D-02 closed-vocab on 12 jobs is UNTOUCHED. `slice_scope` is a NUMBER (1, 2,
or 3). LIMIT 50 is enforced on the Cypher result before it lands in the
packet.

### The three F-selector surfaces

| Surface | What it does | Side effects |
|---------|--------------|--------------|
| `rankForSelector` | Pure sync ranker -- computes a top-K of next-move commands using continuous-gradient scoring (Brain priors at low investment + 3-signal formula at high investment). Reads packetOptional + roomState. | None (zero Brain calls; zero memory_event writes; idempotent). |
| `recordSelectorDecision` | Writes user's F.1 defer / F.2 reject decision as memory_event + typed cascade edge (DEFERRED or REJECTED). Both writes route through the Phase 109 `navigation.cjs` chokepoint. | memory_event + cascade edge. |
| `recordSelectorMiss` | Writes the "none fit" tuning signal as memory_event only (no cascade edge; D8 temporal-only). Consumer routes to `/mos:do` with the captured user_intent. | memory_event only. |

The consumer wiring contract -- preconditions, pseudocode, Canon Part 8
invariants, D11 fallback -- lives at `docs/F-SELECTOR-CONSUMER-GUIDE.md`.

### Canon citations (Phase 125)

- **Part 3 (Tri-Context Decision Gate)** -- the F-selector ranker is the
  decision-gate substrate for Phase 88.2 F.1 / F.2 selectors.
- **Part 4 (Every Choice Is Graph Data)** -- F.1 defer + F.2 reject become
  typed cascade edges with `{reason, decision_id, expires_at}`; "why not is
  more valuable than yes" made literal.
- **Part 7 (Reuse Before Build)** -- ~95% reuse of Phase 109 navigation
  chokepoint + Phase 110 packet + Phase 122 resolver + Phase 104.1 content;
  the new pieces are the ranker, the decision writers, and these docs.
- **Part 8 (Graph Boundary)** -- recordSelectorMiss writes user_intent
  LOCALLY only; never enters Brain. Source-grep audits enforce zero
  brain-client requires + zero memory_event side-channels.
- **Part 9 (Memory Locality)** -- every selector decision flows through the
  navigation chokepoint; SQL remembers, Larry proposes, the human confirms.
