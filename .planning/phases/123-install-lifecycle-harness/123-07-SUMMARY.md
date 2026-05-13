---
phase: 123-install-lifecycle-harness
plan: 07
subsystem: install-lifecycle-harness
tags: [brain-key, sec-02, canon-part-8, http-path, session-start, skill, doc]
wave: 6
autonomous: true
requirements: [HARNESS-123-15, HARNESS-123-16]
canon_parts: [5, 6, 8]
dependency_graph:
  requires: [123-02, 123-05]
  provides: [single Brain-key resolver, positive session-start Brain status line, Bearer-only auth doc surface]
  affects: [brain-client.cjs::getApiKey delegation, brain-connector SKILL.md detection step 0, commands/setup.md chmod 600 SEC-02, install.sh Brain-key write annotation]
tech-stack:
  added: []
  patterns:
    - "ordered-fallback resolver mirroring active-plugin-root.cjs (env -> ~/.mindrian.env -> CWD .env -> not-found, {key, source, available, reason} return shape, CLI form on direct invocation)"
    - "env-aware home default (process.env.HOME || process.env.USERPROFILE || os.homedir()) so hermetic tests overriding HOME work on Linux/POSIX -- FLAG-3 fix"
    - "SEC-02 POSIX 0o077 mask reject with explicit reason string (never silent null); Windows process.platform short-circuit"
    - "session-start positive 3-case status line (HTTP active / NOT loaded with reason / not configured Tier 0) -- SEC-02 rejection routes through this same channel"
key-files:
  created:
    - lib/core/resolve-brain-key.cjs
    - tests/test-resolve-brain-key.cjs
  modified:
    - lib/core/brain-client.cjs
    - scripts/session-start
    - skills/brain-connector/SKILL.md
    - commands/setup.md
    - install.sh
    - docs/install/BRAIN-SETUP.md
    - .env.brain.template
    - CHANGELOG.md
    - lib/memory/run-feynman-tests.cjs
    - lib/memory/security-trifecta.test.cjs
decisions:
  - "D-31: order is env -> ~/.mindrian.env -> CWD .env -> not-found (REVERSES the prior brain-client order which had CWD before ~/.mindrian.env)"
  - "D-32: brain-client.getApiKey, scripts/session-start, brain-connector SKILL.md all delegate to the single resolver; the inline 3-path lookup in brain-client is gone"
  - "D-33: session-start emits a positive 3-case status line; the MCP-centric WARN that never fired correctly on a standard install is retired"
  - "D-34: commands/setup.md chmod 600 \\$HOME/.mindrian.env after the write (SEC-02); install.sh annotated -- it does NOT write the file today; if it ever does it MUST chmod 600 it"
  - "D-35: docs/install/BRAIN-SETUP.md + .env.brain.template state Bearer-only explicitly; CHANGELOG / brain-client.cjs header URL prose softened to acknowledge currently *.onrender.com, moving to brain.mindrian.ai, override via MINDRIAN_BRAIN_URL"
  - "D-36 OUT OF SCOPE (preserved): no canonical MCP-vs-HTTP path declaration, no MCP-path retirement, no .env.brain.template wholesale rewrite"
metrics:
  duration: "1 hour"
  completed: 2026-05-13
---

# Phase 123 Plan 07: Single Brain-Key Resolver + Positive Session-Start Status Summary

Wave 6 of 6 (the last autonomous wave) ships the consolidation of three independent Brain-key lookups into one resolver mirroring `active-plugin-root.cjs`, the rewiring of `brain-client.cjs::getApiKey()` to delegate to it, the replacement of the pre-Plan-7 MCP-centric session-start WARN with a positive 3-case status line, the SEC-02 `chmod 600` fix in `/mos:setup brain`, and the Bearer-only auth + brain-access URL surface in `docs/install/BRAIN-SETUP.md` + `.env.brain.template`. D-36 (MCP-vs-HTTP canonical path) stays deferred per CONTEXT.

## What shipped

### `lib/core/resolve-brain-key.cjs` (new, ~120 lines)

The single Brain-key resolver. Mirrors `lib/core/active-plugin-root.cjs`'s shape and discipline:

- Signature: `resolveBrainKey({ home = process.env.HOME || process.env.USERPROFILE || os.homedir(), cwd = process.cwd() } = {})` returning `{ key, source, available, reason }`.
- Order (D-31): `MINDRIAN_BRAIN_KEY` env -> `<home>/.mindrian.env` -> `<cwd>/.env` -> not-found.
- SEC-02 POSIX 0o077 mask reject with explicit reason string. Windows `process.platform === 'win32'` short-circuit (the mode bits do not translate to NTFS ACLs).
- CLI form: `node lib/core/resolve-brain-key.cjs` prints the JSON, exits 0 -- the shell-out path `scripts/session-start` uses.
- Canon Part 8 clean: `grep -E "fetch|http|curl|brain.mindrian|tavily" lib/core/resolve-brain-key.cjs` returns nothing. The resolver only CHECKS for a key; the actual Brain call lives in `brain-client.cjs`.

**FLAG-3 fix:** the `home` default is `process.env.HOME || process.env.USERPROFILE || os.homedir()` -- NOT bare `os.homedir()`. On Linux/POSIX, `os.homedir()` reads `/etc/passwd` and ignores `process.env.HOME`, which breaks hermetic tests that override `HOME` to a scratch directory. The env-aware default matches the precedent in `scripts/doctor.cjs`, `scripts/session-start`, and `active-plugin-root.cjs`. Test rbk.9 is the structural assertion proving the fix is in source.

### `lib/core/brain-client.cjs::getApiKey()` rewiring (HARNESS-123-16)

The prior 3-path inline lookup (env -> CWD .env -> ~/.mindrian.env -- the REVERSE of D-31's intended order) is replaced with a one-liner delegating to `resolveBrainKey()`. The order reversal is documented inline; the new 60s memoization mirrors the prior implicit lifetime; a non-null `reason` is logged ONCE per process via stderr -- SEC-02 rejection routes through this channel, never as a silent null.

**Unchanged (verified):** `Authorization: Bearer` at L218 + L279, `BRAIN_REQUEST_TIMEOUT_MS`, `AbortSignal.timeout`, `async function ask`, memoized `schema()`, `sanitizeCypherInput`, the entire Plan 110-03 `sendPacket` middleware -- the brain-client-fix landing and Phase 110-03 work are all upstream of this and untouched.

The file header docstring URL claim ("calls mindrian-brain.onrender.com") is softened to "calls the Brain HTTP server (currently `https://mindrian-brain.onrender.com`, moving to `https://brain.mindrian.ai`; override via the MINDRIAN_BRAIN_URL env var)".

### `scripts/session-start` Brain block (D-33)

The pre-Plan-7 MCP-centric WARN that tested only the shell env var `MINDRIAN_BRAIN_KEY` and emitted "no 'mindrian-brain' MCP server resolved" on every HTTP-path install is replaced with a positive 3-case status line emitted to stderr:

```
Brain: HTTP client active (mindrian-brain.onrender.com)   # key resolved
Brain: NOT loaded -- permissions too open: ... (run: chmod 600 ~/.mindrian.env)   # SEC-02
Brain: not configured (Tier 0)                            # nothing found
```

The block shells out to `node $PLUGIN_ROOT/lib/core/resolve-brain-key.cjs` and parses the JSON with two tiny inline node one-liners (bash has no JSON parser; jq is not a system dependency to assume).

### `skills/brain-connector/SKILL.md` (D-32c)

A new "Step 0 -- HTTP-path detection (Phase 123)" branch is inserted at the top of the Detection section. The existing steps 1-3 (env, mcp__mindrian-brain, mcp__neo4j-brain legacy) are preserved as fallbacks -- D-36 is honored, both paths remain valid. The Tool Names table gains a CLI row for `brain-client.cjs::query() / search() / schema() / ask()` -- the HTTP path; the MCP rows remain as the alternative.

### `commands/setup.md` (D-34)

`chmod 600 "$HOME/.mindrian.env" 2>/dev/null || true` is inserted immediately after the `~/.mindrian.env` key write with the SEC-02 comment. Plan-05's L145 brain-access URL fix is preserved -- verified by `grep -q "mindrianos-jsagirs-projects" commands/setup.md` returning FALSE.

### `install.sh` (D-34)

Annotated. `install.sh` does NOT write `~/.mindrian.env` today (the key is a printed hint per `bin/cli.js`). A 6-line SEC-02 invariant comment is added near the bundled-Brain section: if a future code path writes the file, it MUST chmod 600 it.

### `docs/install/BRAIN-SETUP.md` + `.env.brain.template` (D-35)

`docs/install/BRAIN-SETUP.md` gains a new "Section 0 -- Authentication: Bearer-only (Phase 123 Plan-07)" stating explicitly that the Brain HTTP server (`https://mindrian-brain.onrender.com`, moving to `https://brain.mindrian.ai`) authenticates via `Authorization: Bearer <your-key>` only -- `x-api-key` returns 401 with a body that links to `https://mindrianos.vercel.app/brain-access` for help. The `MINDRIAN_BRAIN_URL` env var override is documented. A "Where the key is read from" subsection documents the D-31 resolver order and the SEC-02 chmod 600 requirement.

`.env.brain.template` gets a Bearer-only HTTP-path header block stating that only `MINDRIAN_BRAIN_KEY` is needed for the standard CLI install; the Supabase / Neo4j / Pinecone variables are MCP-path only. Body untouched -- the wholesale rewrite is D-36 (out of scope).

### `CHANGELOG.md`

A new Unreleased Added entry narrates the full Plan-07 landing (HARNESS-123-15 + HARNESS-123-16); the file list, the order reversal, the SEC-02 routing, the Wave-0 test scenarios.

### `tests/test-resolve-brain-key.cjs` (new, 9 scenarios)

- **rbk.1** env wins (`source: 'env'`, key trimmed).
- **rbk.2** ~/.mindrian.env over CWD .env -- depends on the env-aware `home` default (FLAG-3).
- **rbk.3** CWD .env fallback (`source: 'cwd-env-file'`).
- **rbk.4** not-found is explicit (`source: 'not-found'`, reason non-empty).
- **rbk.5** SEC-02 0o644 reject -- POSIX-only (`reason` includes "permissions too open" + "0644"); skipped on Windows.
- **rbk.6** Canon Part 8 grep: zero network markers in the resolver source.
- **rbk.7** brain-client.getApiKey() delegates -- spy proves the resolver is called.
- **rbk.8** brain-client preconditions intact (BRAIN_REQUEST_TIMEOUT_MS, AbortSignal.timeout, async function ask, Bearer auth) + the new require statement for resolve-brain-key.
- **rbk.9** Structural assertion: `home` default contains the FLAG-3 fix pattern.

All 9 green. Registered in `lib/memory/run-feynman-tests.cjs` Phase-123 block.

## Live evidence (on this dev box, MindrianOS-Plugin @ main, 2026-05-13)

### Resolver direct call (shell env has MINDRIAN_BRAIN_KEY)

```
$ node -e "const r = require('./lib/core/resolve-brain-key.cjs').resolveBrainKey();
            console.log(JSON.stringify({available:r.available, source:r.source,
                reason:r.reason, key_preview: r.key ? r.key.slice(0,4)+'...' : null}, null, 2));"
{
  "available": true,
  "source": "env",
  "reason": null,
  "key_preview": "544f..."
}
```

`available: true`, `source: 'env'` -- the shell `MINDRIAN_BRAIN_KEY` is set on this box.

### Not-found path (hermetic HOME + hermetic CWD)

```
$ env -u MINDRIAN_BRAIN_KEY HOME=/tmp/scratch-h USERPROFILE=/tmp/scratch-h \
    node -e "const r = require('./lib/core/resolve-brain-key.cjs').resolveBrainKey({cwd:'/tmp/scratch-c'});
             console.log(JSON.stringify(r, null, 2));"
{
  "key": null,
  "source": "not-found",
  "available": false,
  "reason": "MINDRIAN_BRAIN_KEY not set (env), and neither /tmp/scratch-h/.mindrian.env nor /tmp/scratch-c/.env contains a MINDRIAN_BRAIN_KEY line"
}
```

Explicit reason, never a silent null. Tier-0 fallback is detectable.

### Session-start Brain block in isolation (current shell)

```
Brain: HTTP client active (mindrian-brain.onrender.com)
```

The block (extracted from `scripts/session-start` between the `BEGIN Brain status (Phase 123, Plan-7)` / `END Brain status` markers) runs against the live resolver and emits the positive status line. Note: there is no `~/.mindrian.env` on this dev box (`ls -la ~/.mindrian.env` -> not present), so the SEC-02 "permissions too open" branch could not be reproduced in live evidence without writing a fixture file -- the Wave-0 test rbk.5 covers that path hermetically with `fs.chmodSync(p, 0o644)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated `lib/memory/security-trifecta.test.cjs` invariant**
- **Found during:** Task 2 (after the brain-client rewire landed)
- **Issue:** The existing test `'brain-client.cjs guards .env reads with checkFilePermissions'` asserted `>= 3 checkFilePermissions(` occurrences in `brain-client.cjs` (1 definition + 2 call sites: CWD .env + ~/.mindrian.env). Plan-07 intentionally REMOVES the two inline call sites -- the SEC-02 gating moves to `resolve-brain-key.cjs`. So the old assertion fires on the new structure.
- **Fix:** Updated the test to assert the new Plan-07 invariant: (1) `brain-client.cjs` must require `resolve-brain-key.cjs`, (2) `resolve-brain-key.cjs` must contain `0o077` (the SEC-02 mask) AND `process.platform` (the Windows short-circuit). Either failure is a regression to the pre-Plan-07 multiple-resolver disease. The unit tests for `checkFilePermissions` itself (accepts 0600 / 0400, rejects 0644 / 0664, returns false on missing file) are preserved -- the helper still exists, it's just no longer wired into `getApiKey()`.
- **Files modified:** `lib/memory/security-trifecta.test.cjs` (1 test rewritten; the other 5 `checkFilePermissions` unit tests preserved).
- **Commit:** 55485c0 (Task 2's commit -- the test fix landed with the rewire it covers).

**2. [Rule 3 - Blocking comment-text match] Softened the explanatory comment in `scripts/session-start`**
- **Found during:** Task 3 acceptance check
- **Issue:** The block-level explanation comment I added included the literal string `"no 'mindrian-brain' MCP server resolved"` to describe what the OLD WARN said. The acceptance criterion `grep -q "no .mindrian-brain. MCP server resolved" scripts/session-start` then matched the COMMENT and reported the old WARN as still present.
- **Fix:** Reworded the comment to describe the old behavior generically ("misleading MCP-server-not-found WARN") without quoting the exact pre-Plan-7 message.
- **Files modified:** `scripts/session-start` (3-line comment edit; no behavioral change).
- **Commit:** 5c8bf5c (Task 3's commit).

No checkpoints reached. No architectural decisions needed. No auth gates.

## D-36 Out-of-Scope Discipline

Per CONTEXT D-36, the following were NOT done:

- No canonical MCP-vs-HTTP path declaration in any doc.
- The MCP path is NOT retired -- `skills/brain-connector/SKILL.md`'s detection steps 1-3 (env, `mcp__mindrian-brain__*`, `mcp__neo4j-brain__*` legacy) are preserved as fallbacks.
- `.env.brain.template`'s body (`SUPABASE_*`, `NEO4J_*`, `PINECONE_*` variables) is NOT rewritten -- only a header comment block was added.
- `bin/cli.js` was NOT touched.
- `mcp-server-brain/` was NOT touched.

## Self-Check: PASSED

All Plan-07 success criteria verified:

| # | Check | Result |
|---|-------|--------|
| 1 | `lib/core/resolve-brain-key.cjs` exists with `0o077` + Windows no-op + HOME/USERPROFILE/os.homedir() | PASS |
| 2 | Canon Part 8 grep against resolver: zero network markers | PASS |
| 3 | `node --check` on resolver + brain-client + `bash -n scripts/session-start` | PASS |
| 4 | CLI form: `node lib/core/resolve-brain-key.cjs` prints JSON, exits 0 | PASS |
| 5 | `lib/core/brain-client.cjs` requires `resolve-brain-key.cjs` (delegation) | PASS |
| 6 | `Authorization: Bearer` at L218 + L279 unchanged | PASS |
| 7 | `BRAIN_REQUEST_TIMEOUT_MS` / `AbortSignal.timeout` / `async function ask` / `sendPacket` preserved | PASS |
| 8 | `scripts/session-start` has the new BEGIN/END Brain status markers (Phase 123) | PASS |
| 9 | `scripts/session-start` emits 3-case positive status line | PASS |
| 10 | Old `"no 'mindrian-brain' MCP server resolved"` WARN is gone | PASS |
| 11 | `skills/brain-connector/SKILL.md` has step 0 + CLI row | PASS |
| 12 | `commands/setup.md` has `chmod 600 "$HOME/.mindrian.env"` | PASS |
| 13 | Plan-05's L145 URL fix preserved (no `mindrianos-jsagirs-projects` regression) | PASS |
| 14 | `install.sh` annotated with SEC-02 invariant comment | PASS |
| 15 | `docs/install/BRAIN-SETUP.md` states Bearer-only explicitly | PASS |
| 16 | `.env.brain.template` has Bearer-only HTTP-path header block | PASS |
| 17 | `CHANGELOG.md` Unreleased entry narrates Plan-07 in full | PASS |
| 18 | `tests/test-resolve-brain-key.cjs` -- all 9 scenarios green | PASS |
| 19 | Registered in `lib/memory/run-feynman-tests.cjs` Phase-123 block | PASS |
| 20 | `lib/memory/security-trifecta.test.cjs` -- 22/22 pass post-rewire | PASS |
| 21 | No em-dashes in new content (all 4 Task 4 files) | PASS |
| 22 | No `git push`, no `git checkout`, no `git add -A` -- all commits with explicit paths | PASS |

### Commits (chronological, all on `main`)

| Commit | Task | Files |
|--------|------|-------|
| fe6c0f9 | Task 1 (Wave 0 -- RED then GREEN) | `lib/core/resolve-brain-key.cjs` [new], `tests/test-resolve-brain-key.cjs` [new], `lib/memory/run-feynman-tests.cjs` |
| 55485c0 | Task 2 (rewire `getApiKey()` to delegate) | `lib/core/brain-client.cjs`, `lib/memory/security-trifecta.test.cjs` |
| 5c8bf5c | Task 3 (`session-start` positive status line) | `scripts/session-start` |
| 6b04ddd | Task 4 (skill + setup + install + docs + template + CHANGELOG) | `skills/brain-connector/SKILL.md`, `commands/setup.md`, `install.sh`, `docs/install/BRAIN-SETUP.md`, `.env.brain.template`, `CHANGELOG.md`, `lib/core/brain-client.cjs` (header doc URL softening) |
