# Phase 269: Moat Shift -- Install/Update Entitlement Gate - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 4 (2 modified doctrine files, 2 new test files)
**Analogs found:** 4 / 4
**Upstream input:** `269-RESEARCH.md` only (no CONTEXT.md -- `.planning/config.json` has `skip_discuss: true`)

## Scope Note (read before the tables)

RESEARCH.md splits this phase into two families. **Only Family D (doctrine) has files to
pattern-map.** Family E (engineering: an entitlement check in install.sh / bin/cli.js /
SessionStart preflight) is externally blocked on Theo Phase 9, which is two unplanned
phases away. Family E writes no code and therefore appears in the "No Analog Needed"
section, not in the pattern assignments. A `files_modified` list containing
`lib/core/entitlement.cjs` is the failure mode RESEARCH.md names explicitly.

## File Classification

| New/Modified File | New? | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|------|-----------|----------------|---------------|
| `.claude/includes/decisions.md` | modify | config / doctrine (`@include`d into CLAUDE.md) | file-I/O (static read at context load) | itself (rows 2-16 are the row-format precedent); amendment precedent `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md` | exact |
| `.claude/includes/moat.md` | modify | config / doctrine (`@include`d into CLAUDE.md) | file-I/O (static read at context load) | `.claude/includes/decisions.md` + `.claude/includes/architecture.md` (sibling include prose shape) | exact |
| `tests/269-doctrine-reconcile.test.cjs` | NEW | test (unit, text assertion on markdown) | file-I/O + transform | `tests/test-250-amendment-unit.cjs` (primary), `tests/test-250-doctrine-fence.cjs` (secondary, for the negative/canary legs) | exact |
| `tests/run-all-269.sh` | NEW | test (phase aggregator harness) | batch | `tests/run-all-266.sh` (primary, itself a clone of `tests/run-all-264.sh`) | exact |

---

## Pattern Assignments

### `.claude/includes/decisions.md` (config/doctrine, file-I/O) -- MODIFY rows 1 and 5

**Analog:** the file itself. This is a 3-column pipe-delimited markdown table. Preserve the
exact shape; do not reflow, do not re-number, do not add a column.

**Header + row format to preserve byte-for-byte:**

```markdown
# Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | One-command install; the Brain is part of what installs. | Larry's methodology comes from the Brain and says so; a keyless session gets an honest refusal and a visible path to a key, never an imitation. |
| 5 | Brain as remote MCP | IP never distributed; users get intelligence, not data. The Brain is remote by design, not optional by default; a keyless session gets an honest refusal, never a silent local substitute. |
```

Structural facts the editor must honor:
- Every row is ONE physical line. No wrapping. Rows 1 and 5 are already the two longest lines in the file; the reconciled text stays on one line each.
- Column 2 (`Decision`) is a short label. Rows 1 and 8 end with a period; rows 2-7 and 9-16 do not. Row 5's label `Brain as remote MCP` has no period. **Match the row you are editing, not a global rule.**
- Column 3 (`Rationale`) is sentence prose, semicolon-joined clauses.
- No em-dashes anywhere (project rule C6). Hyphens only.

**Amendment pattern (RESEARCH.md Pattern 1) -- the reasoning does NOT live in the row:**
The in-repo precedent is `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md`, referenced as the
frozen historical-exclusion path in `tests/test-250-doctrine-fence.cjs:130`
(`/^docs\/AMENDMENT-2026-08-DECISIONS-1-AND-8\.md$/`). The pattern is: amend the one-line
row, and file the ruling, rejected options, and threat model in a dated standalone doc that
quotes the decision. Phase 250-04 did this with `docs/BRAIN-IDENTITY-DESIGN.md`.

**CRITICAL COUPLING -- two existing tests already pin these rows.** Any edit must keep them
green, or must amend them in the same task:

`tests/test-250-amendment-unit.cjs:96-123` asserts on decisions.md directly:

```javascript
const DECISIONS_PATH = path.join(REPO_ROOT, '.claude', 'includes', 'decisions.md');
...
  assert.ok(
    decisions.includes('the Brain is part of what installs'),
    'decisions.md row 1 must carry the amendment\'s applied Decision #1 text -- the SWEEP release never ships without it'
  );
  assert.ok(
    decisions.includes('a keyless session gets an honest refusal and a visible path to a key'),
    'decisions.md row 1 rationale must carry the amendment\'s applied text'
  );
  assert.ok(
    decisions.includes('The Brain is remote by design, not optional by default'),
    'decisions.md row 5 rationale must carry the amendment\'s wording touch'
  );
  assert.ok(
    !decisions.includes('Zero config; Larry works immediately.'),
    'decisions.md row 1 must no longer carry the pre-amendment rationale -- regression to the old row'
  );
```

Consequence for the planner: the substring `a keyless session gets an honest refusal and a
visible path to a key` in row 1 is **currently test-locked**. If the reconciliation moves
the refusal from query-time to install/update-time and rewrites that clause, `test-250-amendment-unit.cjs`
goes RED. The row-1 task must either (a) preserve that substring and ADD the enforcement-point
clause alongside it, or (b) explicitly amend `tests/test-250-amendment-unit.cjs` in the same
task with a written reason. Option (a) is the lower-risk read and matches RESEARCH.md
MOAT-02's stated shape for row 5 ("keeps 'remote by design' verbatim AND carries the new clause").

`tests/test-250-doctrine-fence.cjs:113` also scans this file (`'.claude/includes/decisions.md'`
is in `LIVING_DOCS_FILES`) against four forbidden phrases. New doctrine text must not
introduce `silent fallback`, `never mention failures`, `graceful degradation everywhere`, or
`never tell the user about degradation`.

---

### `.claude/includes/moat.md` (config/doctrine, file-I/O) -- MODIFY (ADD a clause)

**Analog:** its own current 7-line prose shape, plus the sibling include
`.claude/includes/architecture.md` for the "Deep dive:" trailer convention.

**Current full text (the thing being extended):**

```markdown
# The Moat

Prompts can be copied. The graph that knows WHEN to use WHICH prompt, in WHAT SEQUENCE, calibrated by REAL teaching data, is the moat. Larry's Brain (teaching graph, grading intelligence, mode-engine calibration, curriculum web) is served via MCP, never distributed.

MWP deepening mandate: every feature must deepen the Mindrian Workspace Protocol moat (the 7 layers + edge vocabulary + Brain IP + teaching calibration), not just add surface area.

Deep dive: docs/MOAT-MANDATE.md (review process, what CAN vs CANNOT be copied) and docs/MWP-SPECIFICATION.md (the 7-layer protocol + edge schemas).
```

Structural conventions to copy:
- `# Title` H1, then one-paragraph-per-line blocks separated by blank lines. No sub-headers, no bullets, no tables.
- Each paragraph opens with a named concept (`Prompts can be copied.`, `MWP deepening mandate:`). A new commercial-boundary paragraph should follow that same "named concept, then the rule" shape.
- The file ends with a single `Deep dive:` line naming the deeper docs. **Insert the new clause BEFORE the `Deep dive:` line**, keeping that line last.
- SCREAMING-CAPS is used for the load-bearing words (`WHEN`, `WHICH`, `SEQUENCE`, `REAL`). Reuse sparingly and only for the new boundary's load-bearing term.
- No em-dashes.

**The precision constraint (RESEARCH.md:127-134):** `moat.md` does NOT contain the literal
string "pay per graph query" or "per-query" anywhere. A task written as "replace phrase X"
will fail. Write it as **"add a boundary clause"** -- an ADD, not a replace. The existing
"served via MCP, never distributed" sentence survives verbatim.

---

### `tests/269-doctrine-reconcile.test.cjs` (test, file-I/O + transform) -- NEW

**Analog:** `tests/test-250-amendment-unit.cjs` (primary -- it asserts on this exact file),
with the negative-assertion and canary legs from `tests/test-250-doctrine-fence.cjs`.

**Header pattern** (`tests/test-250-doctrine-fence.cjs:1-2, 67-69`):

```javascript
#!/usr/bin/env node
'use strict';

/**
 * Phase 269 ... -- what this proves, in one sentence per requirement.
 *
 * Run BEFORE the edits land, this test demonstrably FAILS -- that RED run is
 * filed in the SUMMARY. (The can-fail proof convention.)
 *
 * node --test, CJS, node:assert/strict + node:fs only. No new deps.
 * No em-dashes.
 */
```

**Imports pattern** (`tests/test-250-doctrine-fence.cjs:71-76`) -- node built-ins only, zero deps:

```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
```

**Path-constant pattern** (`tests/test-250-amendment-unit.cjs:29`) -- `path.join` with split
segments, never a raw slash string:

```javascript
const DECISIONS_PATH = path.join(REPO_ROOT, '.claude', 'includes', 'decisions.md');
// Phase 269 adds:
const MOAT_PATH = path.join(REPO_ROOT, '.claude', 'includes', 'moat.md');
```

**Positive assertion pattern** (`tests/test-250-amendment-unit.cjs:96-117`) -- read once,
`assert.ok(text.includes(...))` with a message that says WHY the assertion exists, not what
it checks. Use this for MOAT-01, MOAT-02 (preserved-substring leg), MOAT-03, MOAT-04:

```javascript
test('Test 4 ... decisions.md carries the applied rows, never the pre-amendment text', () => {
  const decisions = fs.readFileSync(DECISIONS_PATH, 'utf8');
  assert.ok(
    decisions.includes('The Brain is remote by design, not optional by default'),
    'decisions.md row 5 rationale must carry the amendment\'s wording touch'
  );
```

**Negative assertion pattern** (`tests/test-250-amendment-unit.cjs:118-121`) -- the
regression arm, phrased as "must no longer carry":

```javascript
  assert.ok(
    !decisions.includes('Zero config; Larry works immediately.'),
    'decisions.md row 1 must no longer carry the pre-amendment rationale -- regression to the old row'
  );
```

**Content-anchored paragraph extraction** (`tests/test-250-doctrine-fence.cjs:231-241`) --
use this when an assertion must be scoped to ONE paragraph rather than the whole file, so
the same phrase appearing elsewhere cannot green a false pass. This is the right shape for
MOAT-03 (the moat.md boundary clause must be a real paragraph, not an incidental mention):

```javascript
// Locate by content, anchored on a fixed sentence unchanged by the edit, so
// the canary survives the edit it is guarding.
function extractCanonColdStartParagraph(text) {
  const anchor = 'Mode B (Local Only).';
  const anchorIdx = text.indexOf(anchor);
  if (anchorIdx === -1) return null;
  const afterAnchor = text.slice(anchorIdx);
  const firstBreak = afterAnchor.indexOf('\n\n');
  if (firstBreak === -1) return null;
  const rest = afterAnchor.slice(firstBreak + 2);
  const secondBreak = rest.indexOf('\n\n');
  return secondBreak === -1 ? rest : rest.slice(0, secondBreak);
}
```

**Scoped negative pattern** (`tests/test-250-doctrine-fence.cjs:254-268`) -- `assert.doesNotMatch`
against an extracted paragraph, with a message stating what regression it reds:

```javascript
  assert.doesNotMatch(
    para,
    /tier[ _-]?0/i,
    'a revert to "Tier 0" framing in the cold-start paragraph must red this canary'
  );
```

**Self-check pattern** (`tests/test-250-doctrine-fence.cjs:215-221`) -- assert the test's own
constant lists are the closed set they claim to be. Worth cloning for MOAT-04 if the phase
carries a fixed list of cross-cutting flags:

```javascript
test('Doctrine fence self-check: the pattern list is exactly the closed four-pattern set ...', () => {
  assert.equal(FORBIDDEN.length, 4, 'the fence must carry exactly four patterns after the 252-03 widening');
  assert.equal(FORBIDDEN[0].source, 'silent fallback');
});
```

**NAMING CONFLICT -- the planner must resolve this.** RESEARCH.md names the file
`tests/269-doctrine-reconcile.test.cjs`, but every repo analog uses `tests/test-<phase>-<slug>.cjs`
(`test-250-doctrine-fence.cjs`, `test-264-salient-critic.cjs`, `test-266-*`). More
importantly, the `run-all-<phase>.sh` harness discovers by the glob `tests/test-<phase>-*`.
A file named `269-doctrine-reconcile.test.cjs` **will not be discovered by a
`tests/test-269-` glob**, and the found-eq-0 guard will then fail the harness. Two valid
resolutions, pick one explicitly:
- (a) rename to `tests/test-269-doctrine-reconcile.cjs` so the glob finds it (recommended, matches every analog), or
- (b) keep the RESEARCH.md name and list it as an EXPLICIT GATE LINE in `run-all-269.sh` (the mechanism `run-all-266.sh:155` uses for `lib/mcp/no-instructions.test.cjs`), accepting that the glob discovers zero files and the found-eq-0 guard must then be satisfied some other way.

**Runner note:** `node:test` files in this repo are invoked bare as `node <file>` by the
aggregators (`run-all-264.sh:98`, with a written comment that this is deliberate and must
not be "fixed" back to `node --test`). `test-250-doctrine-fence.cjs` uses `node:test` and
still sets a non-zero exit code on failure under a bare `node` invocation, so both idioms
coexist. Follow the donor: bare `node "$t"`.

---

### `tests/run-all-269.sh` (test aggregator, batch) -- NEW

**Analog:** `tests/run-all-266.sh` (primary). It is itself an explicit clone of
`tests/run-all-264.sh`, which cloned `run-all-259.sh`. Copy `run-all-266.sh` and change the
phase number and the target lists. Every structural comment in it is load-bearing and should
be carried over with Phase 269 specifics substituted.

**Shebang + header contract** (`run-all-266.sh:1-15, 86`) -- the header enumerates what the
phase has to prove, one sentence per requirement, so a missing test is visible by READING
the file:

```bash
#!/usr/bin/env bash
# Phase 266 verification aggregator (MCPFIX-01: ...).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. MCPFIX-01: ...
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-264.sh). This
# harness globs every tests/test-266-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-266-* file requires NO edit to this runner.
#
# bash only. No em-dashes (hyphens only).
```

**Preamble + root resolution** (`run-all-266.sh:88-95`):

```bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_266_PREFIX=tests/test-266-nonexistent- bash
# tests/run-all-266.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_266_PREFIX:-tests/test-266-}"
```

**Counters + the two runner functions** (`run-all-266.sh:97-121`) -- copy verbatim:

```bash
PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

run_may_skip() {
  local label="$1"; shift
  local out rc
  echo "--- $label ---"
  out="$("$@" 2>&1)"; rc=$?
  printf '%s\n' "$out"
  if [ "$rc" -ne 0 ]; then
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  elif printf '%s' "$out" | grep -qE '^SKIP'; then
    echo ">>> $label: SKIPPED"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  fi
  echo ""
}
```

**Glob discovery + the load-bearing found-eq-0 guard** (`run-all-266.sh:128-147`):

```bash
shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  run "$(basename "$t")" node "$t"
done
for t in "$PREFIX"*.sh; do
  # Never re-run this runner against itself if it happens to match its own prefix.
  if [ "$(basename "$t")" = "$(basename "${BASH_SOURCE[0]}")" ]; then continue; fi
  found=$((found+1))
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no ${PREFIX}* files discovered"
  exit 1
fi
echo "discovered $found test file(s) under ${PREFIX}*"
echo ""
```

**Explicit gate lines** (`run-all-266.sh:149-159`) -- pre-existing always-present files that
carry no phase prefix, listed by hand. For Phase 269 this is where the two coupled Phase 250
tests and the structural gates belong:

```bash
run "no-instructions.test.cjs (host-boundary byte-cap + Part 8 survival)" node lib/mcp/no-instructions.test.cjs
run "234 tool description floor"                  node tests/test-234-tool-description-floor.cjs
run "connector registry born-wired --check"       node scripts/build-connector-registry.cjs --check
```

Phase 269's explicit lines should be, at minimum:

```bash
run "250 amendment unit (decisions.md rows 1/5/8 lockstep)" node tests/test-250-amendment-unit.cjs
run "250 doctrine fence (living-docs forbidden phrases)"    node tests/test-250-doctrine-fence.cjs
run "connector registry born-wired --check"                 node scripts/build-connector-registry.cjs --check
```

Reason to include the two 250 tests explicitly: they are the coupling this phase is most
likely to break, and a break there is invisible unless the aggregator runs them.

**No-em-dash fence** (`run-all-266.sh:161-218`) -- copy including the `rc >= 2 SCAN BROKE`
arm; a broken `grep -P` must FAIL, never silently pass:

```bash
echo "--- 266 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_MISSING=0
EMDASH_TARGETS=(
  "lib/mcp/runtime-instructions.cjs"
  "tests/run-all-266.sh"
)
for t in "${EMDASH_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(LC_ALL=C.UTF-8 grep -lP '\x{2014}' "$f" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $t"
      EMDASH_OK=0
    elif [ -n "$hits" ]; then
      echo "    FORBIDDEN em-dash in: $t"
      EMDASH_OK=0
    fi
  else
    echo "    MISSING (not yet created): $t"
    EMDASH_MISSING=$((EMDASH_MISSING+1))
  fi
done
if [ "$EMDASH_MISSING" -gt 0 ] && [ "${TEST_266_ALLOW_MISSING:-0}" != "1" ]; then
  echo "    $EMDASH_MISSING target(s) missing and TEST_266_ALLOW_MISSING is not set"
  EMDASH_OK=0
fi
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 266 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 266 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""
```

Phase 269 `EMDASH_TARGETS` should be exactly:
`.claude/includes/decisions.md`, `.claude/includes/moat.md`, the new test file, and
`tests/run-all-269.sh` itself. The `TEST_269_ALLOW_MISSING=1` escape is set on early-wave
runs and UNSET on the phase's final gate plan -- that unset run is what proves every listed
file exists.

**Footer** (`run-all-266.sh:220-223`) -- copy verbatim, substituting the phase number:

```bash
echo "======================================"
echo "Phase 266: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
```

Note the last line is a bare test, not `exit`, so the script's exit status is the fence.

---

## Shared Patterns

### No em-dashes (project rule C6)
**Source:** `CLAUDE.md` Conventions, enforced by `tests/run-all-264.sh:181-200`
**Apply to:** every file this phase writes or edits, including the test files and the plans themselves.
Machine check: `LC_ALL=C.UTF-8 grep -lP '\x{2014}' <file>`.

### Zero external dependencies
**Source:** `CLAUDE.md` Conventions ("CJS only, no TypeScript"), demonstrated by both test analogs
**Apply to:** `tests/269-doctrine-reconcile.test.cjs`
```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
```
No jest, no vitest, no config file. `bash` + `node` only.

### The can-fail proof (RED-before-GREEN)
**Source:** `tests/test-250-doctrine-fence.cjs:63-65`, `tests/test-250-amendment-unit.cjs:14-16`
**Apply to:** the new test file
```javascript
 * Run BEFORE the amendment doc exists, this fence demonstrably FAILS (the
 * file is absent) -- that is this test's own can-fail proof (RED recorded in
 * the SUMMARY).
```
Convention: run the new test before the doctrine edits land, record the RED output in the
plan SUMMARY, then edit and record GREEN. A test that was never red proves nothing.

### The written-reason idiom
**Source:** `run-all-266.sh:40-50` (why there is no Part 8 grep sweep in that runner)
**Apply to:** any gate this phase deliberately omits or diverges on
When you skip a gate the donor had, write the reason IN the file. `.planning/` is gitignored
and does not travel between machines; the tracked test file is the only place the reasoning
survives.

### Amend the row, file the reasoning elsewhere (RESEARCH.md Pattern 1)
**Source:** `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md`, `docs/BRAIN-IDENTITY-DESIGN.md`
**Apply to:** both doctrine file edits
A decisions.md row is a one-line summary. The ruling citation, the rejected options with
reasons, the threat model, and the revocation path go in a dated standalone doc that quotes
the decision. A find-and-replace on decisions.md with no companion doc loses all of it.

### Cross-repo work uses a spec file, never a foreign path (RESEARCH.md Pattern 2)
**Source:** `.planning/phases/115-owned-emotion-dual-path-first-touch/115-00-PLAN.md:795-820`
**Apply to:** anything touching `mindrian-website`
```markdown
---
type: out-of-repo-deliverable
phase: 115
target_repo: ~/mindrian-website/
applied_post_merge: pending (manual action in CHANGELOG)
---
```
No `mindrian-website` path may appear in a Phase 269 `files_modified` list.

---

## No Analog Needed

| File / Work | Role | Reason |
|-------------|------|--------|
| Family E engineering (an entitlement check in `install.sh`, `bin/cli.js`, `scripts/sessionstart-post-update-preflight.cjs`) | middleware / guard | **No code is written this phase.** Blocked on Theo Phase 9, which is two unplanned phases away (Theo Phase 7 is 2 of 12 plans in; Phases 8 and 9 both read `Plans: TBD`). RESEARCH.md Pattern 3 gives the plan-level mechanism: separate plan family, `autonomous: false`, leading `<task type="checkpoint:human-action" gate="blocking">`. When it eventually runs, the reuse targets are already named in RESEARCH.md's "Don't Hand-Roll" table (`resolve-brain-key.cjs`, `refusal-messaging.cjs`, `sessionstart-post-update-preflight.cjs`, `post-update-activation.cjs`) -- extend, never fork. |
| Cross-cutting flags (`docs/BUSINESS-MODEL-AND-MOAT.md`, `LICENSE`, personal memory note, the Gaurav RCA gap) | doc | These are FLAGGED, not edited. No analog needed because no file is modified; the flags land as phase output that MOAT-04 asserts the presence of. |

---

## Planner Warnings (surfaced by the pattern search, not in RESEARCH.md)

1. **The row-1 substring is test-locked.** `tests/test-250-amendment-unit.cjs:102-105` pins
   `a keyless session gets an honest refusal and a visible path to a key`. Reconciling row 1
   by rewriting that clause reds an existing test. Prefer ADD-alongside over replace, or
   amend the 250 test in the same task with a written reason.
2. **The new test filename does not match the glob the harness uses.** See the NAMING
   CONFLICT block above. Resolve it explicitly in the plan, do not leave it to the executor.
3. **`.claude/includes/decisions.md` is in the Phase 250 living-docs fence scope**
   (`tests/test-250-doctrine-fence.cjs:113`). New doctrine text must avoid the four forbidden
   phrases.
4. **`run-all-269.sh` should explicitly run both Phase 250 tests**, since they are the
   coupling this phase is most likely to break and the glob will never discover them.

## Metadata

**Analog search scope:** `tests/`, `lib/**/*.test.cjs`, `scripts/*.cjs`, `.claude/includes/`
**Files scanned:** ~10 candidates via grep; 4 read in full (`run-all-266.sh`, `run-all-264.sh`, `test-250-doctrine-fence.cjs`, `test-250-amendment-unit.cjs` targeted read), plus the 3 `.claude/includes/*.md` files already in context via CLAUDE.md
**Pattern extraction date:** 2026-08-27
