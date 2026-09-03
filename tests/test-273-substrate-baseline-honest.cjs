'use strict';
// Phase 273 D-05 / M4 -- substrate baseline honesty checkpoint.
//
// Requirements: CHOKE-06.
//
// Compares scripts/check-substrate.cjs's own scanRepo() count against the
// number documented in the baseline doc's MOST RECENT dated re-measurement
// section. Per 273-RESEARCH.md's D-05 finding, the expected number after
// Phase 273's fixes was 208 (unchanged from pre-fix -- lib/core/navigation/
// is path-allowlisted and INSERT OR IGNORE evades RE_RAW_WRITE, so C3's fix
// could not move this count; see the doc's own reconciliation note for why).
//
// 260903-gdm fix (Rule 1): this originally hardcoded the section heading to
// "## 2026-08-31 re-measurement", contradicting its own documented intent
// ("the baseline doc's most recent dated section", line 9 above) and its own
// name ("...-honest"). Any later re-measurement section (e.g. R17's
// consolidation-driven 208 -> 205 drop) would silently keep comparing
// against the STALE 2026-08-31 number instead of the new one, defeating the
// drift guard the test exists to be. Now finds the LAST
// "## <anything> re-measurement" section in the doc and reads ITS Result.
//
// This is the self-detecting drift guard -- it is what stops the documented
// baseline number from ever silently diverging from a fresh measurement again.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const { scanRepo } = require(path.join(REPO, 'scripts', 'check-substrate.cjs'));
const BASELINE_DOC = path.join(REPO, 'docs', 'architecture', 'SUBSTRATE-BASELINE.md');

function main() {
  const violations = scanRepo();
  const measured = Array.isArray(violations) ? violations.length : violations.count;

  const docSrc = fs.readFileSync(BASELINE_DOC, 'utf8');
  // Find every "## <heading> re-measurement ... Result: **N**" section and
  // take the LAST one (the most recently appended, per file-append order).
  const sectionRe = /## [^\n]*re-measurement[\s\S]*?Result: \*\*(\d+)\*\*/g;
  let section = null;
  let match;
  while ((match = sectionRe.exec(docSrc)) !== null) {
    section = match;
  }
  assert.ok(section, 'D-05: SUBSTRATE-BASELINE.md must contain at least one "<...> re-measurement" section with a stated Result: **N**');
  const documented = Number(section[1]);

  assert.equal(
    measured, documented,
    'D-05: the measured substrate violation count (' + measured + ') must equal the documented baseline (' + documented + ') -- this is the honesty checkpoint that stops the next stale-baseline drift'
  );
  console.log('PASS test-273-substrate-baseline-honest (measured=' + measured + ')');
}

main();
