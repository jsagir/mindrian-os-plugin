# Mindrian Workspace mod

A Claude Code mod (a plugin of function hooks, TypeScript `.tsx`, no DOM, no Node) that draws two things natively in the terminal: an orientation band above the prompt and a docked pane with four tabs (Room, Think, Sources, Review). The design contract is `.planning/phases/369.26-mindrian-workspace-mod-an-orientation-band-and-docked-review/369.26-UI-SPEC.md`.

This is a walled package (Phase 369 D-17 precedent). It declares no dependency of any kind. Nothing from it enters the root `package.json`, the root `files` array or the npm tarball. `tests/test-369.26-wall.cjs` guards that.

## Load it

```
claude --plugin-dir ui/mindrian-workspace-mod
```

Check it without a session:

```
claude plugin validate ui/mindrian-workspace-mod
claude plugin test ui/mindrian-workspace-mod
node ui/mindrian-workspace-mod/scripts/typecheck.cjs
bash tests/run-all-369.26.sh
```

## Tri-polar stance

- CLI: the build target. Band and pane load through `claude --plugin-dir`.
- Desktop: covered only by the kit's `mount` loops over `terminal` and `desktop`. A real Desktop render is deferred (phase CONTEXT, Deferred).
- Cowork: a mod has no Cowork surface. Stated skip.

## Engine facts (measured in plan 01)

Measured on Claude Code 2.1.290 (declaration file written by 2.1.289), 2026-10-06. Every later plan reads this section.

1. Import form. A relative import between plugin files loads with NO extension (`import { x } from './ids'`), with a directory index (`from './sub'`), and also with `.js` or `.ts` spelled out; `tsc` under our tsconfig accepts the extensionless and the `.js` spelling and rejects the `.ts` spelling (TS5097, `allowImportingTsExtensions` is off). Use the extensionless form everywhere. A missing module fails loudly in the engine ("cannot import ... no such file"). Proved by a throwaway sibling module drawn from a `ui.render` hook and found by a mounted test, under `claude plugin validate ui/mindrian-workspace-mod`, `claude plugin test ui/mindrian-workspace-mod` and `node ui/mindrian-workspace-mod/scripts/typecheck.cjs`, with a deliberate missing import failing all three.
2. hooks.json shape. `modules` is an ARRAY holding exactly one path, resolved relative to `hooks/hooks.json` itself: `{ "modules": ["../src/register.tsx"] }`. A bare string is refused ("expected array, received string"), and a second entry is refused ("one hooks module per plugin"). Proved by `claude plugin validate ui/mindrian-workspace-mod` failing on the string and passing on the array.
3. Test discovery. `claude plugin test <dir>` runs every `*.test.ts` and `*.test.tsx` anywhere under the folder (it found a test in `src/`, in `tests/` and in `tests/deep/`), each file in its own child. A test imports from `claude-code/testing`, and may import plugin source with a relative path (`../src/...`). The plan puts tests in `tests/`. Proved by `claude plugin test ui/mindrian-workspace-mod` counting all four throwaway tests in its own output ("Ran 4 tests across 4 files").
4. Types layout. The engine lays `.claude-plugin/types/` (`claude-code/`, `claude-code-tools/`, `claude-code-mcp/`, a `tsconfig.json`) when a session loads the mod from a folder (`claude --plugin-dir`); `claude plugin validate` and `claude plugin test` do NOT lay it. `scripts/lay-types.cjs` is the fallback that copies the plugin-authoring skill's declaration file when the folder has none, and `scripts/typecheck.cjs` runs it first. The folder is gitignored and is never committed. Proved by deleting `.claude-plugin/types`, running validate and test (still absent), then `claude --plugin-dir ui/mindrian-workspace-mod -p ...` (laid, even though the session then stopped at authentication).

Other facts worth knowing:

- The manifest wants an `author`; without one `claude plugin validate` passes with a warning, so plugin.json carries one.
- `hooks: nothing` in the validate output is the honest report of an empty `register`; once a hook exists the output lists it (`ui.render{component=AbovePrompt}`).
- Props the engine hands `AbovePrompt` (read from the declaration file): `hasSurvey`, `isWorking`, `maxRows`, `bodyColumns`, `scroll` (`{ offset, bodyRows }`) and `view` (`{ agentId? }`). A test mount must pass all six. `Pane` carries `title`, `isFocused`, `bodyColumns`, `placement`, `scroll` and `view`.
- TypeScript is the compiler of tools/ts-check (or ui/shell as a fallback); this package installs nothing.

## Layout

- `src/register.tsx` the hooks module; calls the three registrars in order.
- `src/registrars/` model (plan 06), band (plans 05 and 08), pane (plan 07). Each owns its file.
- `src/pane/bodies/` one file per tab, replaced by plans 11 to 14.
- `src/runtime/ids.ts`, `src/runtime/open-workspace.ts`, `src/state/atoms.ts`, `types/state.d.ts`, `src/pane/types.ts` the shared contracts.
- `scripts/` `typecheck.cjs`, `lay-types.cjs`.
- `tests/` the `*.test.ts` files for `claude plugin test`.
