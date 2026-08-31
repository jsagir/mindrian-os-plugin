'use strict';
// Phase 273 D-05 / M4 -- substrate baseline honesty checkpoint.
//
// Requirements: CHOKE-06.
//
// RED BY DESIGN until docs/architecture/SUBSTRATE-BASELINE.md's 2026-08-31
// re-measurement section is appended (see 273-PATTERNS.md File 4). Compares
// scripts/check-substrate.cjs's own scanRepo() count against the number
// documented in the baseline doc's most recent dated section. Per
// 273-RESEARCH.md's D-05 finding, the expected number after Phase 273's
// fixes is 208 (unchanged from pre-fix -- lib/core/navigation/ is
// path-allowlisted and INSERT OR IGNORE evades RE_RAW_WRITE, so C3's fix
// cannot move this count; see the doc's own reconciliation note for why).
//
// This is the self-detecting drift guard -- it is what stops the documented
// 195 from ever silently diverging from a measured 208 again.

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
  // Parse the most recently dated re-measurement section's stated number.
  // Looks for "Result: **N**" inside the "2026-08-31 re-measurement" block.
  const section = docSrc.match(/## 2026-08-31 re-measurement[\s\S]*?Result: \*\*(\d+)\*\*/);
  assert.ok(section, 'D-05: SUBSTRATE-BASELINE.md must contain a 2026-08-31 re-measurement section with a stated Result: **N**');
  const documented = Number(section[1]);

  assert.equal(
    measured, documented,
    'D-05: the measured substrate violation count (' + measured + ') must equal the documented baseline (' + documented + ') -- this is the honesty checkpoint that stops the next stale-baseline drift'
  );
  console.log('PASS test-273-substrate-baseline-honest (measured=' + measured + ')');
}

main();
