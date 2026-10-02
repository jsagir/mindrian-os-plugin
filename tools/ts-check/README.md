# tools/ts-check

The erasable-TypeScript gate for MindrianOS core (Phase 369 D-17).

## What it enforces

Node (>=22.18.0) runs a `.ts` file by stripping the type words. It never reads tsconfig and never type-checks, so an `enum`, a `namespace` with values, or a constructor parameter property would only fail on a user's machine. This gate asks `tsc` (with `erasableSyntaxOnly` and `verbatimModuleSyntax`) to refuse them first.

Four stages: core files under `lib/` (zero today, so it passes vacuously), forbidden fixtures that must be rejected with their expected TS code, allowed fixtures that must compile and run under Node type stripping, and greps (no `paths` alias in any tsconfig under `lib/` or `ui/`, no `.tsx` under `lib/`).

## Run it

```
npm --prefix tools/ts-check ci --ignore-scripts
node tools/ts-check/check.cjs
```

Exit 0 = pass, 1 = a stage failed, 77 = not installed (environment gap). `scripts/release.sh` runs it beside the Step 2.4 gates and stops the cut if it fails.

## Why it lives here

TypeScript is tooling for the maintainer, not a dependency of the plugin. Anything in the root `package.json`, even a devDependency, is installed on every user's machine by the loader (`npm ci --ignore-scripts`, no `--omit`). So TypeScript lives in this walled package with its own lockfile (the Phase 232 `lib/wiki/editor-src` precedent), and `tools/` is not in the root `files` list, so it never ships.

## No @types/node, on purpose

`tsconfig.core.json` sets `types: []` and the allowed fixture carries a tiny local ambient declaration. `@types/node` is added only when the first real `lib/core` `.ts` file lands, behind its own package-legitimacy check. Until then the gate fails on such a file, which is the intended signal.
