# Brain Command Trigger Schema -- REMOVED (Phase 122, v1.13.0-beta)

This document used to describe a "commands are first-class Neo4j nodes with typed trigger relationships" design. That design was never built into the live Brain (no such label exists in the deployed graph), and it is a latent **Canon Part 8** breach in prose: it asserts that plugin commands live in the Brain. Per Canon Part 8 (`docs/MINDRIAN-CANON.md`), the Brain is a repository of strategic thinking tools, never a repository of plugin internals or user data. Commands never enter the Brain.

## What replaced it

The framework-to-command mapping is now plugin-local, generated, and CI-checked:

- **Source of truth:** the `frameworks:` key in each `commands/*.md` frontmatter. Contract: `docs/COMMAND-FRONTMATTER.md`.
- **Generated registry:** `data/command-registry.json` -- built from frontmatter by `scripts/build-command-registry.cjs`; never hand-edited; pre-commit + Feynman-runner tripwire on drift.
- **The only door at runtime:** `lib/workflow/command-resolver.cjs` (`commandsForFramework`, `composeWorkflow`, `validateChainAutonomy`).
- **The Brain side:** `lib/brain/chain-recommender.cjs` ranks WHICH frameworks to chain next via the Brain's `FEEDS_INTO` traversal -- framework names + problem-type enums only, never a command string, never user content.
- **The full picture:** `docs/WORKFLOWS.md`.

Trigger conditions (which signal surfaces which next step) live in the navigation engine (Phase 91 family) and the cascade hooks (Phase 116/117) -- locally, where the room state is, not in the Brain.
