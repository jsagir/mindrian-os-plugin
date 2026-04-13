# Phase 80 Preconditions

## Known: bin/mindrian-tools.cjs MODULE_NOT_FOUND via lazygraph-ops (Phase 78-02 carryover)

**Status:** still broken as of 2026-04-13 (Phase 80-01 execution).

**Symptom:** `node bin/mindrian-tools.cjs --help` crashes at startup with:

```
Error: Cannot find module 'better-sqlite3'
requireStack:
  - lib/core/lazygraph-ops.cjs
  - lib/core/graph-ops.cjs
  - bin/mindrian-tools.cjs
```

`lib/core/lazygraph-ops.cjs` does a top-level `require('better-sqlite3')`
and `bin/mindrian-tools.cjs` eagerly loads `graph-ops.cjs` which pulls in
`lazygraph-ops.cjs`, so ANY subcommand (even `--help`) fails before
argv parsing. This is the same class of issue as Phase 78-02 (lazygraph-ops
side-effect load), just surfaced through a different native dep.

**Root cause (not fixed here):** `better-sqlite3` is declared in
package.json but is a native module that was not built against this
Node version / WSL env. Either `npm rebuild better-sqlite3`, pin a
pre-built version, or lazy-require better-sqlite3 inside the functions
that actually need it.

**Workaround for Phase 80:**

- Plan 80-05 (command wiring) must NOT add the `vault import` subcommand to
  `bin/mindrian-tools.cjs` via the graph-ops require chain.
- Instead, wire `/mos:vault import` through `node scripts/vault-import.cjs`
  directly (no import of graph-ops / lazygraph-ops in the entry path).
- If any downstream plan wants to call mindrian-tools.cjs as a smoke test
  (IMPORT-11), it MUST first confirm mindrian-tools.cjs runs cleanly OR
  stub the smoke test behind this precondition until fixed.

**Fix target:** separate plan (not Phase 80 scope). File as a post-Phase-80
follow-up task against `lib/core/lazygraph-ops.cjs` to lazy-require
better-sqlite3 at function-call time, not module-load time.
