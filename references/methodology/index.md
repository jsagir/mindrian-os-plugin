# Methodology Index -- Pointer

> Phase 122 (Workflow Layer) replaced the hand-maintained framework-to-command routing table that used to live here. That table drifted (it is the exact drift class the Workflow Layer was built to delete). The authoritative mapping is now generated, CI-checked, and resolved at runtime through one door.

---

## Where the framework-to-command mapping lives now

- **Source of truth:** the `frameworks:` key in each `commands/*.md` frontmatter (one place, nothing else asserts it). Contract: `docs/COMMAND-FRONTMATTER.md`.
- **Generated registry:** `data/command-registry.json` -- built from that frontmatter by `scripts/build-command-registry.cjs`; never hand-edited. A pre-commit tripwire (`build-command-registry.cjs --check`) and the Feynman test runner fail the build on a stale registry or an unresolvable framework name.
- **The only door at runtime:** `lib/workflow/command-resolver.cjs` (`commandsForFramework(<framework>)`, `composeWorkflow(<framework-chain>)`, `validateChainAutonomy(...)`). Larry never names a `/mos:` command from memory -- every command he surfaces came back from the resolver. If a framework has no command yet, the resolver returns `null` and the answer is "run it manually" (degrade, do not fabricate).
- **The Brain side:** `lib/brain/chain-recommender.cjs` ranks WHICH frameworks to chain next via the Brain's `FEEDS_INTO` traversal -- framework names + problem-type enums only. Turning a recommended framework into a `/mos:` command is the resolver's job, not the Brain's. Commands NEVER enter the Brain (Canon Part 8). See `docs/WORKFLOWS.md` for the full Brain <-> registry <-> Larry join.

For a human-readable list of commands with descriptions, see `commands/help.md` (the `/mos:help` surface) or `docs/COMMAND-FRONTMATTER.md`. For the closed-loop picture, see `docs/WORKFLOWS.md`.

---

## Design-by-Analogy Reference Files

These are reference *data* files (not a framework-to-command map), loaded on demand by the Design-by-Analogy pipeline:

| File | Description |
|------|-------------|
| `triz-matrix.json` | 39x39 TRIZ contradiction matrix mapping engineering parameter pairs to inventive principles |
| `triz-principles.md` | All 40 inventive principles with descriptions and application examples |
| `sapphire-encoding.md` | SAPPhIRE 7-layer functional encoding guide for room artifact decomposition |

Used by the Design-by-Analogy pipeline (`/mos:find-analogies`) and `enrichContradictionWithTRIZ()` in `lazygraph-ops.cjs`.

---

## Brain Enhancement

When Brain MCP is connected, methodology commands gain contextual framework chaining (the Brain ranks the next framework via `FEEDS_INTO`), calibrated grading (100+ real student projects), and cross-domain pattern matching (21K+ knowledge graph nodes). Without Brain, all commands work using embedded reference definitions. Either way, the framework-to-command mapping comes from the plugin-local `data/command-registry.json` via `lib/workflow/command-resolver.cjs` -- not from the Brain, not from memory.
