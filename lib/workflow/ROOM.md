---
type: directory-identity
name: lib/workflow
section: lib/workflow
purpose: Workflow layer -- the framework <-> command registry resolver. The sole door from "framework" to "/mos: command".
founding_phase: 122
phase: 122
milestone: v1.13.0-beta.12
canon_parts: [7, 8]
created: 2026-05-12
---

# lib/workflow/

`lib/workflow/` is the home for the Workflow Layer -- the deterministic join between the Brain's methodology graph (`Framework -[:FEEDS_INTO]-> Framework`) and the plugin's `/mos:` command surface. Phase 122 is the founding phase; the resolver is the contained surface.

The reliability rules this directory enforces (per `.planning/WORKFLOW-LAYER-SPEC.md`):

1. **Single source of truth.** `frameworks:` in each `commands/*.md` frontmatter is the only place the framework-to-command mapping is declared. Nothing here re-asserts it.
2. **Generated, drift-impossible.** `data/command-registry.json` is built from frontmatter; a CI tripwire fails on stale registry or an unresolvable Brain framework name.
3. **The resolver is the only door.** `command-resolver.cjs` is the sole path from framework to command. Larry never names a `/mos:` command from memory.
4. **The trigger is the hook, not the model.** The navigation engine computes the command sequence; Larry is the voice, not the decision-maker.
5. **Degrade, do not fabricate.** A framework with no command yields "run [framework] manually" -- never a made-up command.

## Files in this section

| File | Plan | Purpose |
|------|------|---------|
| `command-resolver.test.cjs` | 122-01 (stub), 122-03 (fill) | Wave-0 stub for the resolver test suite. Covers `commandsForFramework`, `frameworksForCommand`, `composeWorkflow` (incl. null/optional markers), `validateChainAutonomy`, the empty-registry degrade path, and the no-Brain assertion once 122-03 fills it. |
| `command-resolver.cjs` | 122-03 | The resolver. `commandsForFramework`, `frameworksForCommand`, `composeWorkflow(frameworkChain) -> [{step, framework, command\|null, optional}]`, `validateChainAutonomy(workflow) -> {runnable, blockers}`. Reads only `data/command-registry.json` at runtime. Never queries the Brain. |

## Canon Part 8 boundary (LOCAL + plugin-local, never Brain)

The resolver reads `data/command-registry.json` (plugin-local, generated, committed) and nothing else. It makes zero network calls. Commands NEVER enter the Brain (Canon Part 8) -- the registry is validated AGAINST the Brain's framework names at build time (`scripts/build-command-registry.cjs --refresh-names`), never written back. The chain recommender that seeds workflows from `FEEDS_INTO` lives in `lib/brain/` and carries only generic framework handles + problem-type enums in its Cypher -- never user content.

## Decision #15 compliance

Per `CLAUDE.md` Decision #15, every directory in the data room (and the lib tree by extension under this milestone's policy) carries a ROOM.md identity file. `lib/workflow/` is bound to Phase 122; subsequent additions update this file's "Files in this section" table. No MINTO.md required at this level -- the `.room-root` cascade scope is `room/`, not `lib/`.

## Cross-references

- Spec: `.planning/WORKFLOW-LAYER-SPEC.md`
- Phase 122 PLAN: `.planning/phases/122-workflow-layer/122-01-PLAN.md`
- Phase 122 RESEARCH: `.planning/phases/122-workflow-layer/122-RESEARCH.md`
- Frontmatter contract: `docs/COMMAND-FRONTMATTER.md`
- Canon: `docs/MINDRIAN-CANON.md` Parts 7, 8
- Sibling identity reference: `lib/hmi/ROOM.md` (Phase 100), `lib/conversation/ROOM.md` (Phase 99)
