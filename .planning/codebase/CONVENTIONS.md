# Conventions

## Code

- TypeScript is allowed plugin-wide (navigator ruling 2026-10-02, SEED-107, Phase 369 D-17). What the old CJS-only rule protected still holds: no build step on the user's machine, hook cold start inside its budgets, inspectable shipped source, the release lockstep.
- Core `.ts` is erasable-only and runs natively under Node >=22.18.0: no enum, no namespace, no parameter properties, no TS path aliases, explicit file extensions in every require and import, `import type` for types, no TSX; enforced by `erasableSyntaxOnly` and `verbatimModuleSyntax` through the walled-off `tools/ts-check` package (Node strips types without reading tsconfig and never type-checks).
- Hooks and the MCP server stay `.cjs`. Erasable `.ts` enters `lib/core` only after `tests/test-369-installed-layout.cjs` passes (Node refuses type stripping under `node_modules`) and only in a module no hook reaches (`tests/test-369-hook-require-graph.cjs`).
- Module system: a `lib/core` `.ts` file is CommonJS (the root package.json declares no `type`): `const x = require('./x.cjs') as typeof import('./x.cjs')`, `module.exports = {...}`, `import type`; UI packages under `ui/` are ESM TypeScript and TSX, built for the release, and only their built assets ship.
- TypeScript, UI and build packages never enter the root package.json, not even as devDependencies (the loader runs `npm ci --ignore-scripts` with no `--omit`; `tests/test-341-shrinkwrap-no-dev.cjs`); they live in walled-off packages with their own lockfiles (`tools/ts-check/`, `ui/*`), the Phase 232 `lib/wiki/editor-src` precedent.
- CLI entry points parse `process.argv` with a switch-case router (the gsd-tools.cjs pattern); no Commander or yargs.
- Bash scripts in `scripts/` stay authoritative; CJS wraps them.

## Writing and Structure

- No em-dashes anywhere; use hyphens. Feynman-simplified, JTBD-oriented prose.
- Every directory gets a `ROOM.md` identity file (ICM Layer 0); the filesystem is the source of truth (no DB for room state).
- Reuse before build: search the methodology surface enumerated from disk first (commands/*.md, agents/*.md, pipelines/*/CHAIN.md, skills/*/SKILL.md); every feature works on all three surfaces.
