# Phase 243: Voice-Glyph - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 7 (2 MODIFY-existing-analog-is-self, 1 MODIFY-with-clear-before/after, 3 NEW, 1 NEW-doc)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `lib/statusline/cockpit-renderer.cjs` | renderer/utility (pure function) | transform (state object -> string) | itself (before/after, lines 338-350) | exact |
| `tests/test-voice-glyph-advisory.cjs` | test | request-response (assert on `renderCockpit` output) | itself (leg 3, lines 91-100) | exact |
| `tests/test-192-statusline-stance-chip.cjs` | test | request-response | itself (cases b/c, lines 91-110) | exact |
| `tests/test-243-voice-glyph-honest.cjs` | test (fixture suite) | transform / mutation-gate | `tests/test-voice-glyph-advisory.cjs` + `tests/test-192-statusline-stance-chip.cjs` | exact (idiom) |
| `tests/test-243-rca-routing.cjs` | test (doc-presence) | file-I/O (read + grep a markdown file) | `tests/test-stance-voice-glyph-override.cjs` (named doc-presence idiom by researcher; not re-read here, cited by RESEARCH.md as the precedent) | role-match |
| `tests/run-all-243.sh` | test aggregator | batch | `tests/run-all-233.sh` | exact |
| `.planning/debug/voice-signature-dark-runtime.md` | RCA doc (not source code) | file-I/O (structured markdown) | `docs/RCA-TEMPLATE.md` (structure) + `.planning/debug/resolved/hedge-fold-has-no-production-trigger.md` (worked example) | exact |

## Pattern Assignments

### `lib/statusline/cockpit-renderer.cjs` (renderer, transform)

**Analog:** itself - current lines 330-350 (read live this session)

**Current "before" content, exact:**
```javascript
  // yet"; "continue" pretended a live cue existed when it did not.
  const nextMove = (typeof s.next_move === 'string' && s.next_move.trim()) ? s.next_move.trim() : '--';
  // WHO is speaking (Voice Signature, Tier 1): Larry (thinking partner) vs the
  // native host (raw tool). Default larry -- the conversational surface IS Larry
  // (Part 10); 🤖 shows ONLY on an explicit non-Larry agent. Brain backing + the
  // pedagogical-move voice square render for Larry only (a host turn has neither).
  const isLarry = (typeof s.who === 'string' ? s.who.toLowerCase() : 'larry') !== 'claude';
  const brainOn = (s.brain === true || s.brain_tier === 'BRAIN') && isLarry;
  // Tier-1 voice glyph. SEED-042 (192-04), precedence softened by Phase 210 item B:
  // the stance color (redteam=red / tell-act=blue, resolved in cockpit-signals from
  // forcedVoiceColorForStance) is a PREFERENCE, not an override. Precedence rule:
  // natural voice-mark detection wins when it confidently yields a color; the stance
  // color fills the DEFAULT when natural detection yields nothing (null). research /
  // ask claim no color (s.stance_forced_color null), so natural detection governs
  // there unchanged. Byte-stable by default: with no stance color the glyph is
  // exactly resolveVoiceGlyph(s).
  let voiceGlyph = isLarry ? resolveVoiceGlyph(s) : null;
  if (isLarry && !voiceGlyph && voiceMark && typeof s.stance_forced_color === 'string' && s.stance_forced_color) {
    const stanceDefaultGlyph = voiceMark.glyphForColor(s.stance_forced_color);
    if (stanceDefaultGlyph) voiceGlyph = stanceDefaultGlyph;
  }
  const hostLabel = (typeof s.agent_label === 'string' && s.agent_label.trim()) ? s.agent_label.trim() : 'Claude';
```

**"After" content (RESEARCH.md's recommended form, verified as internally consistent with the surrounding code):**
```javascript
  // Tier-1 voice glyph. Phase 243 (GLYPH-01) supersedes the second half of Phase 210
  // item B: natural voice-mark detection is the ONLY source of the glyph. The stance
  // color no longer fills the default when detection is silent, because "silent" is
  // not an occasional state - no writer for ~/.mindrian/voice-mark.json exists, so
  // detection is silent on every production turn and the stance default was therefore
  // painting a Larry glyph over turns that carried no mark at all (audit finding V-1).
  // Honest-empty over plausible-default, the same rule as Ruling 3c's "--" for Next:.
  // The stance still shows as its own [stance] chip; only the fabricated glyph is gone.
  // The stance->color mapping in lib/core/stance-state.cjs is UNCHANGED capability.
  const voiceGlyph = isLarry ? resolveVoiceGlyph(s) : null;
```
Delete the four lines `if (isLarry && !voiceGlyph ...) { ... }` entirely; `voiceGlyph` becomes `const` (no longer reassigned). Do not touch `isLarry`, `brainOn`, `nextMove`, `hostLabel`, or `resolveVoiceGlyph`/`glyphForColor` themselves - only this branch and its comment block.

**Locate by symbol, not line number** (RESEARCH.md Pitfall 4): grep for `stanceDefaultGlyph` to find the exact branch; line numbers will drift.

---

### `tests/test-voice-glyph-advisory.cjs` (test, request-response)

**Analog:** itself - leg 3 (lines 91-100, read live this session)

**Before:**
```javascript
leg('leg 3 PRESERVE FLOOR: with no natural signal the stance color stays the default glyph', function () {
  const line = renderer.renderCockpit({
    room: 'test-room',
    next_move: 'map the fork',
    stance: 'redteam',
    stance_forced_color: 'red',
  });
  assert.equal(line.indexOf(RED_GLYPH) !== -1, true,
    'the stance default color renders when natural detection yields nothing');
});
```

**After (invert, do not delete):**
```javascript
leg('leg 3 SUPERSEDED BY PHASE 243: with no natural signal the stance color must NOT render a glyph', function () {
  const line = renderer.renderCockpit({
    room: 'test-room',
    next_move: 'map the fork',
    stance: 'redteam',
    stance_forced_color: 'red',
  });
  assert.equal(line.indexOf(RED_GLYPH) !== -1, false,
    'GLYPH-01 (Phase 243): the stance default no longer fabricates a glyph when natural detection is silent');
});
```
Also update the file's header comment block (lines 14-15, "Leg 3 (PRESERVE FLOOR...)") to say Leg 3 is now SUPERSEDED by Phase 243, not a preserve floor - the header doc and the assertion must not contradict each other. Leave legs 1, 2, 4 untouched (RESEARCH.md F3: these stay green).

---

### `tests/test-192-statusline-stance-chip.cjs` (test, request-response)

**Analog:** itself - cases (b) and (c) (lines 91-110, read live this session)

**Before (case b, redteam):**
```javascript
test('(b) redteam: chip + DEFAULT red glyph when natural detection is silent (Phase 210 re-point)', function () {
  const silent = baseState();
  delete silent.voice_color;
  const line = renderCockpit(Object.assign(silent, { stance: 'redteam', stance_forced_color: 'red' }));
  assert(line.indexOf('[redteam]') !== -1, 'redteam render must carry the [redteam] chip -- got ' + JSON.stringify(line));
  assert(line.indexOf(RED_SQUARE) !== -1, 'redteam render must carry the default red square when natural detection is silent');
  const natural = renderCockpit(Object.assign(baseState(), { stance: 'redteam', stance_forced_color: 'red' }));
  assert(natural.indexOf(YELLOW_SQUARE) !== -1, 'a confident natural yellow detection must WIN over the stance default (Phase 210 item B)');
});
```

**After (invert only the glyph assertion; the `[redteam]` chip assertion and the natural-wins assertion stay unchanged per RESEARCH.md F3):**
```javascript
test('(b) redteam: chip renders; NO glyph fabricated when natural detection is silent (Phase 243 supersedes 210 re-point)', function () {
  const silent = baseState();
  delete silent.voice_color;
  const line = renderCockpit(Object.assign(silent, { stance: 'redteam', stance_forced_color: 'red' }));
  assert(line.indexOf('[redteam]') !== -1, 'redteam render must carry the [redteam] chip -- got ' + JSON.stringify(line));
  assert(line.indexOf(RED_SQUARE) === -1, 'GLYPH-01: redteam render must NOT carry a fabricated red square when natural detection is silent');
  const natural = renderCockpit(Object.assign(baseState(), { stance: 'redteam', stance_forced_color: 'red' }));
  assert(natural.indexOf(YELLOW_SQUARE) !== -1, 'a confident natural yellow detection must still WIN over the stance (unchanged)');
});
```
Apply the same symmetric edit to case (c) (`tell-act` / `BLUE_SQUARE`): flip `!== -1` to `=== -1` on the glyph-presence line only, keep the `[tell-act]` chip assertion and the natural-yellow-wins assertion as-is. Update the file's header comment (lines ~14-17, items (b)/(c)) to note Phase 243 supersedes the Phase 210 re-point for the glyph half only; the chip segment (line ~407-409 in the renderer) is unaffected.

---

### `tests/test-243-voice-glyph-honest.cjs` (NEW, fixture + mutation-gate suite)

**Analog:** `tests/test-voice-glyph-advisory.cjs` (module require pattern, `renderer`/`voiceMark` imports) and RESEARCH.md's own sketch (Code Examples section), which was written against the live exports.

**Imports pattern (copy from `test-voice-glyph-advisory.cjs` lines 22-26):**
```javascript
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const renderer = require(path.join(REPO, 'lib', 'statusline', 'cockpit-renderer.cjs'));
const voiceMark = require(path.join(REPO, 'lib', 'hmi', 'voice-color-mark.cjs'));
```

**Core pattern (RESEARCH.md's fixture sketch, verified against F6's export list - `renderCockpit` at `cockpit-renderer.cjs:419`, `resolveVoiceGlyph` at `:429`, `VOICE_COLOR_MARKS`/`COLOR_GLYPHS`/`glyphForColor` in `voice-color-mark.cjs`):**
```javascript
const base = () => ({ who: 'larry', room: 'Demo', ctx_pct: 10, next_move: 'x' });

// (1) Every glyph in the vocabulary, through every input shape.
for (const [move, color] of Object.entries(voiceMark.VOICE_COLOR_MARKS)) {
  const glyph = voiceMark.glyphForColor(color);
  for (const shape of [{ voice_glyph: glyph }, { voice_color: color }, { voice_move: move }]) {
    const line = renderer.renderCockpit(Object.assign(base(), shape));
    assert.ok(line.includes(glyph), move + ' via ' + Object.keys(shape)[0] + ' renders ' + glyph);
  }
}

// (2) The honest empty state, WITH a stance active. Mutation-gate rows:
//     restoring cockpit-renderer.cjs lines 347-350 turns exactly these red.
for (const [stance, forced] of [['redteam', 'red'], ['tell-act', 'blue']]) {
  const line = renderer.renderCockpit(Object.assign(base(), { stance, stance_forced_color: forced }));
  for (const g of Object.values(voiceMark.COLOR_GLYPHS)) {
    assert.ok(!line.includes(g), stance + ' with no voice mark renders NO glyph (got: ' + line + ')');
  }
  assert.ok(line.includes('[' + stance + ']'), 'the [' + stance + '] chip still renders (unchanged)');
}
```
Print pass/fail counts and exit non-zero on failure, matching the `leg()` counter idiom in `test-voice-glyph-advisory.cjs` (lines 27-38) or the plain `assert` idiom in `test-192-statusline-stance-chip.cjs` (assert throws -> non-zero exit). Do NOT hard-code `{red:'🟥', blue:'🟦'}` literals - always resolve via `voiceMark.glyphForColor`/`COLOR_GLYPHS` (Don't Hand-Roll table).

**Error handling pattern:** none needed beyond `node:assert/strict` throwing (both analog files rely on this; no try/catch wrapper convention exists in these test files).

---

### `tests/test-243-rca-routing.cjs` (NEW, doc-presence test)

**Analog:** the doc-presence idiom named by RESEARCH.md (`tests/test-stance-voice-glyph-override.cjs`, "explicitly a DOCUMENTATION-presence test"). Not independently re-read here per the tight-scope instruction; the concrete target to assert against is `.planning/debug/voice-signature-dark-runtime.md`.

**Core pattern (read the RCA file as text, assert structural presence, not prose wording):**
```javascript
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RCA_PATH = path.join(__dirname, '..', '.planning', 'debug', 'voice-signature-dark-runtime.md');
assert.ok(fs.existsSync(RCA_PATH), 'RCA file must exist: ' + RCA_PATH);
const text = fs.readFileSync(RCA_PATH, 'utf8');

assert.match(text, /kind:\s*rca/, 'frontmatter must declare kind: rca');
assert.doesNotMatch(text, /status:\s*resolved/, 'V-2/V-3 stay open; status must not be resolved');
assert.match(text, /V-2/, 'must cross-reference V-2');
assert.match(text, /V-3/, 'must cross-reference V-3');
assert.match(text, /GLYPH-01/, 'must cite REQUIREMENTS.md GLYPH-01');
```
Assert structure only (frontmatter fields, V-2/V-3 headings, the GLYPH-01 citation) exactly as RESEARCH.md's Phase Requirements to Test Map (SC2 row) specifies - do not assert exact prose, which would ossify the document.

---

### `tests/run-all-243.sh` (NEW, phase aggregator)

**Analog:** `tests/run-all-233.sh` (read in full this session)

**Skeleton to copy (glob-discovery + hard-fail-on-zero + summary + `[ "$FAIL" -eq 0 ]` exit, stripped to the parts relevant to 243 - no Part 8 egress self-test infra needed unless the planner opts in per RESEARCH.md's "nearly vacuous but conventional" note):**
```bash
#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

shopt -s nullglob
found=0
for t in tests/test-243-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
for t in tests/test-243-*.sh; do
  found=1
  run "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no tests/test-243-* files discovered"
  exit 1
fi

# Mandatory regression legs (RESEARCH.md Pitfall 1): these carry the three
# assertions this phase inverted and MUST stay green.
run "run-all-192.sh (regression)" bash tests/run-all-192.sh
run "run-all-210.sh (regression)" bash tests/run-all-210.sh

echo "======================================"
echo "Phase 243: PASS=$PASS FAIL=$FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
```
`run_if`-style guards (from `tests/run-all-210.sh`, cited but not re-read here) are the alternative idiom if a later wave adds files that may not exist yet - not needed for 243's fixed 3-file list.

---

### `.planning/debug/voice-signature-dark-runtime.md` (NEW RCA doc)

**Analog 1 (structure/template):** `docs/RCA-TEMPLATE.md`, sections 1, 2, 2.5 (read this session)
**Analog 2 (worked example, same shape - "a fully-built layer with no production trigger"):** `.planning/debug/resolved/hedge-fold-has-no-production-trigger.md` (read this session, frontmatter + first ~40 lines)

**Frontmatter fields to copy (from the hedge-fold RCA, adjust values for 243):**
```yaml
---
status: investigating          # NOT resolved - V-2/V-3 stay open per SC2
kind: rca
slug: voice-signature-dark-runtime
trigger: "voice-signature-dark-runtime"
issue_id: ""
severity: medium
surfaces: [cli]                 # statusline is CLI-only per RESEARCH.md Tri-Polar note
brain_mode: local-only
canon_parts: [12]
created: 2026-07-28T00:00:00Z   # state plainly in Meta this predates its own creation date (see below)
updated: 2026-07-28T00:00:00Z
---
```

**Source-of-Truth Preamble (MANDATORY, exact block structure from `docs/RCA-TEMPLATE.md` section 2.5):**
```markdown
## Source-of-Truth Preamble

- **CODE claims read against:** <fill: branch main @ <sha>, worktree path>
- **WIRE claims probe against:** none. Pure LOCAL rendering finding.
- **Date of audit:** 2026-07-28
- **Re-verification rule:** <copy hedge-fold's phrasing pattern>
```

**Heading order to follow (from `docs/RCA-TEMPLATE.md` + the hedge-fold worked example, in this order):** `## Source-of-Truth Preamble` -> `## Current Focus` -> `## Meta` -> `## Problem Statement` -> `## Symptoms` -> `## Scope and Impact` -> `## Eliminated` (append-only) -> `## Evidence` (append-only) -> `## Technical Root Cause` -> (RCA-TEMPLATE also defines further sections for Required Code Changes / Tests / Non-Code Follow-ups per its intro; read the full template file before finalizing section list, only the first ~60 lines were needed for structure here).

**Content shape specific to this RCA (per F1's decision, RESEARCH.md lines 101-109):** carry V-1 as resolved-history (this phase, 243, fixed it), V-2 and V-3 as open cross-referenced sub-findings (their content is already fully specified in RESEARCH.md F1/F5 and the audit sections - reuse those facts, do not re-derive), and the F5 permanent-dark-residual as a named OPEN item. In `Meta` state plainly that the file was authored in Phase 243 to back six citations that predate it (F1's hard constraint) - do NOT fabricate a June `created:` date.

## Shared Patterns

### Honest-empty over plausible-default
**Source:** `lib/statusline/cockpit-renderer.cjs:328-331` (Ruling 3c, the `'--'` for `next_move`)
**Apply to:** the `cockpit-renderer.cjs` fix itself - this is the in-repo precedent the fix's new comment block should cite, not argue from scratch.

### Glob-discovering phase aggregator with hard-fail-on-zero
**Source:** `tests/run-all-233.sh`
**Apply to:** `tests/run-all-243.sh`

### Doc-presence test (assert structure, not prose)
**Source:** `tests/test-stance-voice-glyph-override.cjs` (named by RESEARCH.md; not independently re-read this session)
**Apply to:** `tests/test-243-rca-routing.cjs`

### RCA Source-of-Truth Preamble + append-only Evidence/Eliminated sections
**Source:** `docs/RCA-TEMPLATE.md` section 2.5 + `.planning/debug/resolved/hedge-fold-has-no-production-trigger.md`
**Apply to:** `.planning/debug/voice-signature-dark-runtime.md`

### Invert, never delete, a superseded contract assertion
**Source:** the phase's own governance requirement (RESEARCH.md F3, "Anti-patterns to avoid")
**Apply to:** `tests/test-voice-glyph-advisory.cjs` leg 3, `tests/test-192-statusline-stance-chip.cjs` cases (b)/(c)

## No Analog Found

None. All 7 files have a concrete analog (several are their own pre-edit state).

## Metadata

**Analog search scope:** `lib/statusline/`, `tests/test-voice-glyph-advisory.cjs`, `tests/test-192-statusline-stance-chip.cjs`, `tests/run-all-233.sh`, `docs/RCA-TEMPLATE.md`, `.planning/debug/resolved/hedge-fold-has-no-production-trigger.md` - all named directly by RESEARCH.md, no independent discovery needed.
**Files scanned:** 6 (all targeted reads, no full-file loads beyond what RESEARCH.md already excerpted)
**Pattern extraction date:** 2026-07-28
