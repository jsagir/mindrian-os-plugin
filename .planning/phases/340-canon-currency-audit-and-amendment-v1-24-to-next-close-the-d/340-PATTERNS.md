# Phase 340: Canon Currency Audit and Amendment - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 4 modified constitutional/doc files + N new floor-test files (N = number of
Appendix D entries the plan mints, RESEARCH.md drafts 6-8 candidates: CANON-01 through
CANON-08) + 1 new aggregator script
**Analogs found:** 6 / 6 (100% - this is a mature, 37-times-executed pattern; every file class
has a direct, current, non-hypothetical analog in the repo)

**Framing note:** this phase is pure documentation/constitutional-text work, not application
code. There are no controllers/services/components here. The "roles" below are the Canon's own
established categories (constitutional text, agent persona mirror, floor-test guard, aggregator
script, bookkeeping ledger) which map cleanly onto the standard role/data-flow taxonomy as
"config" (constitutional text edits, read by humans + floor tests) and "test" (the new `.cjs`
guards). Do not force these into controller/service/component shapes - the existing 37-entry
precedent is definitionally the correct pattern, not an analog risk.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `docs/MINDRIAN-CANON.md` (Part 9, Part 12, Appendix B, Appendix C, Part 4, Part 7, Part 2, Part 11 edits + new Appendix D entries 38+) | config (constitutional text) | transform (additive prose amendment) | itself, prior entries 31/36/37 (same file, same amendment lifecycle) | exact |
| `agents/larry-extended.md` (Sourced Claims doctrine mirror) | config (agent persona/system-prompt) | transform (additive prose) | itself - read in full this session, confirmed clean of Sourced Claims language; SEED-086/Aronhime precedent already established the "mirror into both places" pattern | exact |
| `docs/CANON-PHASE-MAP.md` (version-history table row per wave) | config (bookkeeping ledger) | CRUD (append-only row insert) | itself - every one of the 37 prior entries added exactly one row per wave, e.g. the "v1.24 ... entry 36 ... R16 ... shipped \| Phase 190 shape-f-declaration-mandate" row | exact |
| `CLAUDE.md` (Part 7 "25 methodology commands" x3, Part 11 "126 declared" line - only if those Parts are amended) | config (project instructions) | transform (in-place figure correction) | itself - CLAUDE.md's own Canon Compliance Core section already cross-cites the Canon; this is a same-wave sibling fix, not a new pattern | exact |
| `tests/test-canon-entry-NN-<slug>-floor.cjs` (one per new Appendix D entry, e.g. entry-38-sourced-claims, entry-39-theo-glossary, entry-40-two-chokepoint, entry-41-icm-citations, entry-42-edge-reconciliation) | test | batch (read-only static-file assertion, no I/O beyond a single `fs.readFileSync`) | `tests/test-canon-entry-36-shape-declaration-floor.cjs` (heaviest/most recent doctrine-amendment floor test) and `tests/test-canon-entry-31-two-gauge-floor.cjs` (multi-Part placement-proof floor test) | exact |
| `tests/test-canon-frozen-scalars-floor.cjs` (existing - re-run every wave, NOT modified unless a scalar restatement changes byte form) | test | batch | itself (carried forward unchanged) | exact |
| `tests/run-all-340.sh` (new aggregator) | test (aggregator/orchestrator script) | batch (sequential run + pass/fail/skip tally) | `tests/run-all-190.sh` | exact |

## Pattern Assignments

### `docs/MINDRIAN-CANON.md` (config, transform) - the Canon Amendment Lifecycle

**Analog:** the document's own prior 37 amendments (entries 31, 36, 37 read in full this
session). This is not a "copy from elsewhere" pattern - it is "extend the same document using
its own established idiom."

**The mandatory sequence, per amendment wave** (from `tests/run-all-190.sh` comments and the
entry-31/36 floor tests' own doc-comments, RESEARCH.md's "Architecture Patterns" section):
1. Navigator BLOCKING CHECKPOINT approves exact prose + version target BEFORE any byte lands.
2. Canon body text edit (the Part itself, additive where possible - never delete/reword a prior
   Appendix D entry).
3. New Appendix D entry N+1, in the same voice as all priors: a provenance paragraph (what
   changed, why, who approved, what stayed frozen).
4. Header/footer Version line bump (e.g. `Version: 1.24` -> `Version: 1.25`), example anchor
   from entry-36's floor test:
   ```
   ok('header carries Version: 1.24', /^Version: 1\.24$/m.test(canon));
   ok('footer carries Mindrian Canon v1.24', /_Mindrian Canon v1\.24 - MindrianOS Plugin_/.test(canon));
   ```
5. `docs/CANON-PHASE-MAP.md` version-history row, same version, same date.
6. New floor test (see below).
7. Frozen scalars stay unweakened and BYTE-IDENTICAL: `MAX_K=3`, `DIAL_REACH_K=6`, `0.70/0.15`.
   Never restate a frozen scalar's VALUE differently - restating it byte-identical in new prose
   is fine and expected.
8. `tests/run-all-340.sh` registers the new floor test.

**Appendix D entry provenance-paragraph voice** (extracted structure from entry 31's own
doc-comment, apply to every new entry 38+):
- What changed (the concrete doctrinal/citation addition)
- Why (traced to a real incident/finding - SEED-086, the Phase 339 cutover, the live edge-type
  drift, etc. - never an invented justification)
- Who approved (navigator-APPROVED/LOCKED at a blocking checkpoint, dated)
- What stayed frozen (explicit "mints no reach/edge/node, opens no Brain wire" framing when true)
- A self-binding clause where relevant (entry 31's own precedent: "entry 32 ... live navigator
  on the gate" - a forward constraint on what unlocks the NEXT entry)

**Placement-proof discipline (critical, from entry-31 and entry-36 floor tests):** when a
doctrine spans multiple Parts (e.g. this phase's Part 9 two-chokepoint split, or a Part 5 +
Part 10 weld precedent), the amendment prose must land in EVERY Part it claims to touch, not
just Appendix D - the floor test slices each Part by `## Part N` header and asserts the doctrine
text is present in EACH slice independently. A citation only in Appendix D without the matching
Part-body edit will fail this placement-proof pattern.

---

### `agents/larry-extended.md` (config, transform)

**Analog:** itself, per the SEED-086/Aronhime precedent (commit `3c2339fb`) CONTEXT.md's own
canonical_refs cite as already-acted-on. No separate file to copy from - the requirement is
structural: whatever Sourced Claims clause lands in Part 12 of the Canon must have a mirrored,
behaviorally-equivalent statement in this file, since this is the file Larry's actual runtime
persona reads (the Canon is aspirational/constitutional; this file is the enforced system
prompt). Read the file in full before editing (181 lines, confirmed clean of any
number-sourcing language this session) to find the correct insertion point alongside existing
"never confident," "hedged" framing.

---

### `docs/CANON-PHASE-MAP.md` (config, CRUD - append row)

**Analog:** every prior version-history row, e.g. entry 36's row asserted by its own floor test:
```javascript
ok('CANON-PHASE-MAP carries a "v1.24" token', /v1\.24/.test(map));
ok('CANON-PHASE-MAP references entry 36 / R16',
  /entry 36/.test(map) && /R16/.test(map));
ok('CANON-PHASE-MAP flips Phase 190 shape-f-declaration-mandate to shipped',
  /shipped \| Phase 190 shape-f-declaration-mandate/.test(map));
```
Each new wave's row must carry: the new version token, the new entry number(s), the doctrine
slug, and a `shipped | Phase <this-phase-slug>` status flip. Key the row on the phase SLUG
(`340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d`), not the phase NUMBER alone
- RESEARCH.md's own Anti-Patterns section names phase-number collision as a known fragility.

---

### `tests/test-canon-entry-NN-<slug>-floor.cjs` (test, batch) - THE PRIMARY NEW-FILE PATTERN

**Analog:** `tests/test-canon-entry-36-shape-declaration-floor.cjs` (full text read above) is the
best template for a heavier doctrine-amendment entry (e.g. CANON-01 Sourced Claims, CANON-03
Part 9 two-chokepoint split, CANON-04 Appendix B citations). `tests/test-canon-entry-31-two-gauge-floor.cjs`
is the best template when the doctrine spans MULTIPLE Parts (directly relevant to CANON-03's
Part 9 two-chokepoint split, which - like entry 31's Part 5 + Part 10 weld - must be asserted
present in more than one section slice).

**Imports pattern** (byte-identical across every existing floor test - copy verbatim):
```javascript
'use strict';
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANON_PATH = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');
const MAP_PATH = path.join(REPO_ROOT, 'docs', 'CANON-PHASE-MAP.md');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

const canon = fs.readFileSync(CANON_PATH, 'utf8');
const map = fs.readFileSync(MAP_PATH, 'utf8');
```

**Core pattern - section slicing (from entry-36, reuse verbatim, do not reinvent):**
```javascript
// Slice the canon body between a section header and the NEXT `## ` header, so a
// match is provably INSIDE that section (not a member leaking in from elsewhere).
function sliceByHeader(text, headerRe) {
  const lines = text.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) { if (headerRe.test(lines[i])) { start = i; break; } }
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) { if (/^## /.test(lines[i])) { end = i; break; } }
  return lines.slice(start, end).join('\n');
}
const collapse = (s) => s.replace(/\s+/g, ' ');

const partN = sliceByHeader(canon, /^## Part N /);   // substitute the actual Part number/title
const appendixD = sliceByHeader(canon, /^## Appendix D/);
```

**Entry-body isolation pattern (from entry-36, needed whenever asserting facts specific to ONE
Appendix D entry so they can't false-pass against a neighboring entry):**
```javascript
function sliceEntry(flatAppendix, n) {
  const startRe = new RegExp('(^|\\s)' + n + '\\.\\s+\\*\\*');
  const m = startRe.exec(flatAppendix);
  if (!m) return '';
  const startIdx = m.index + m[0].indexOf(n + '.');
  const nextRe = new RegExp('\\s' + (n + 1) + '\\.\\s+\\*\\*');
  const nm = nextRe.exec(flatAppendix.slice(startIdx + 1));
  const endIdx = nm ? startIdx + 1 + nm.index : flatAppendix.length;
  return flatAppendix.slice(startIdx, endIdx);
}
const entryN = sliceEntry(collapse(appendixD), N);
```

**Assertion style rules (hard constraints, all three analogs agree, do not deviate):**
- Byte-presence/absence via `.includes()`/`.test()` against the raw or collapsed text - NEVER
  `.size`, `.length`, or a raw count of Appendix D entries (a future entry 38, 39... must never
  false-fail an older floor test).
- Loop `n = 1..currentMax` over the `## Appendix D` slice ONLY (not the whole canon, to avoid a
  low Appendix-D number leaking a false match from an unrelated Part) and assert
  `^N\.\s` is present per-number, never assert sequential ordering (entries 17/18 are
  intentionally out of numeric order in the real document).
- Assert frozen scalars are unchanged in the SAME test (copy entry-36's Test 7 verbatim pattern):
  ```javascript
  ok('frozen scalar MAX_K=3 is byte-present', /MAX_K=3/.test(canon));
  ok('frozen scalar DIAL_REACH_K=6 is byte-present', /DIAL_REACH_K=6/.test(canon));
  ok('the frozen 0.70/0.15 gate is byte-present', /0\.70\/0\.15/.test(canon));
  ```
- Assert the header/footer version bump with the exact regex form:
  ```javascript
  ok('header carries Version: 1.2X', /^Version: 1\.2X$/m.test(canon));
  ok('footer carries Mindrian Canon v1.2X', /_Mindrian Canon v1\.2X - MindrianOS Plugin_/.test(canon));
  ```
- Assert a light `docs/CANON-PHASE-MAP.md` row check (version token + entry number + slug).
- Where a doctrine self-disclaims non-frozen status (relevant to CANON-08/Part 11's "126"
  refresh), assert the FRAMING language itself, not a hardcoded new number - mirror entry-36's
  Test 5:
  ```javascript
  ok('entry frames the count as enumerated-from-disk', /enumerated from disk/.test(entryN));
  ok('entry marks the count as an illustrative snapshot, not a canon-frozen constant',
    /NOT a canon-frozen constant/.test(entryN) || /not a canon-frozen constant/.test(entryN));
  ```

**Error handling pattern:** none needed - these are standalone scripts that throw via
`node:assert` on first failure and exit non-zero naturally; `console.log` progress lines
(`'  ok - ' + name`) plus a final `PASS N assertions` / `>>> <file>: PASSED` banner are the
house style, copy verbatim.

**Doc-comment header pattern (mandatory house style, copy the shape from entry-31/36):** a block
comment naming the phase/plan, the entry number, the navigator-approval date, a numbered list of
what each Test asserts and why, and the explicit statement "NEVER asserts a raw count of
Appendix D entries" plus "House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain /
network."

---

### `tests/run-all-340.sh` (test/aggregator, batch)

**Analog:** `tests/run-all-190.sh` (full text above) - copy structure verbatim, substitute
phase-specific legs.

**Core pattern** (bash `run`/`run_if` helpers, copy verbatim):
```bash
#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"
    echo ">>> $label: SKIPPED (file not present: $file)"
    echo ""
    SKIP=$((SKIP+1))
  fi
}
```

**Registration pattern:** one `run_if` block per new floor test (so a not-yet-landed entry SKIPs
cleanly rather than FAILing hard - this is how `run-all-190.sh` itself handled its own Plan 05
canon floor test before that wave landed), PLUS the two carried-forward regression legs every
wave must re-run:
```bash
run_if "CANON-01 Sourced Claims FLOOR" \
  tests/test-canon-entry-38-sourced-claims-floor.cjs \
  node tests/test-canon-entry-38-sourced-claims-floor.cjs
# ... one run_if per new entry ...

run "frozen-scalars regression (must stay GREEN every wave)" \
  node tests/test-canon-frozen-scalars-floor.cjs
run "entry-31 two-gauge regression" \
  node tests/test-canon-entry-31-two-gauge-floor.cjs
run "entry-36 shape-declaration regression" \
  node tests/test-canon-entry-36-shape-declaration-floor.cjs

echo "========================================"
echo "  Summary (340 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
```

---

## Shared Patterns

### The section-slicing + collapse helper pair
**Source:** `tests/test-canon-entry-36-shape-declaration-floor.cjs` lines 58-67 (byte-identical
in `test-canon-entry-31-two-gauge-floor.cjs`)
**Apply to:** every new `tests/test-canon-entry-NN-*-floor.cjs` file this phase creates. Do not
write a new slicing approach - copy `sliceByHeader` and `collapse` verbatim into each new file
(these test files are deliberately standalone/dependency-free, so duplication across files is
the established convention, not a DRY violation to fix).

### Frozen-scalar non-regression
**Source:** `tests/test-canon-frozen-scalars-floor.cjs` (whole file, carried forward unmodified)
**Apply to:** every new floor test should include its own copy of the MAX_K/DIAL_REACH_K/0.70-0.15
byte-presence assertions (per entry-36's Test 7 precedent) IN ADDITION to the standalone frozen-
scalars file continuing to run in the aggregator - belt and suspenders, matching the existing
double-coverage pattern.

### Navigator blocking-checkpoint gate
**Source:** RESEARCH.md's "Architecture Patterns" + "Common Pitfalls" (Pitfall 4), and every
Appendix D entry 14+ 's own text
**Apply to:** the PLAN must schedule an explicit `checkpoint:human-verify` (or GSD-equivalent
blocking gate) task BEFORE any `Edit` call against `docs/MINDRIAN-CANON.md` in every wave. This
is not optional and not satisfied by this research/pattern-mapping step alone.

### "Corpus figures corrected" light-entry style vs. full doctrine-amendment style
**Source:** RESEARCH.md's Pitfall 2, referencing entries 13/16 (light) vs 20/29/31/34/35/36/37
(heavy)
**Apply to:** CANON-06 (Part 7 "25 commands"), CANON-07 (Part 2 Pinecone), CANON-08 (Part 11
"126") are likely light corrections (smaller floor tests, fewer assertions, no multi-Part
placement proof needed) while CANON-01/02/03/04 are full doctrine amendments needing the heavier
entry-31/36-style floor test. The planner should size each new floor test file's assertion count
to match its entry's actual weight - a light correction does not need a 15-assertion file.

### Multi-file same-wave lockstep (CLAUDE.md sibling fix)
**Source:** RESEARCH.md's Pitfall 3
**Apply to:** if the plan amends Part 7 or Part 11 in the Canon, the SAME wave/commit must also
fix `CLAUDE.md`'s matching stale figures ("25 methodology commands" x3, "126 declared" x1) - a
canon-only fix that leaves CLAUDE.md stale re-introduces the exact drift class this phase exists
to close.

## No Analog Found

None. Every file class in this phase (constitutional text edit, agent persona mirror,
bookkeeping ledger row, project-instructions figure fix, floor test, aggregator script) has a
direct, current, recently-verified analog already in the repository. This is expected: RESEARCH.md
itself frames the amendment MECHANISM as fully mature (37 prior executions) with only the SCOPE
of this sweep being novel.

## Metadata

**Analog search scope:** `docs/MINDRIAN-CANON.md`, `docs/CANON-PHASE-MAP.md`,
`agents/larry-extended.md`, `CLAUDE.md`, `tests/test-canon-*.cjs` (5 existing floor tests),
`tests/run-all-190.sh`
**Files scanned:** 4 target files (read via CONTEXT.md/RESEARCH.md's own already-completed
audit, not re-read here) + 4 analog test/script files read in full this session
**Pattern extraction date:** 2026-09-05
