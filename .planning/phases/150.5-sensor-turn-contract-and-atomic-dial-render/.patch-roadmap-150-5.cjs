'use strict';
// One-shot planner patch: flip the Phase 150.5 ROADMAP status from INSERTED to
// PLANNED and add the plan list. Idempotent; deletes itself on success.
const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, '..', '..', 'ROADMAP.md');
let s = fs.readFileSync(p, 'utf8');
if (s.indexOf('PLANNED (3 plans, 2 waves)') !== -1) {
  console.log('already patched');
  fs.unlinkSync(__filename);
  process.exit(0);
}
const oldLine = '**Status**: INSERTED (not planned yet) -- next: `/gsd-plan-phase 150.5`';
if (s.indexOf(oldLine) === -1) {
  console.error('status line not found');
  process.exit(1);
}
const newBlock = [
  '**Plans:** 3 plans, 2 waves',
  '',
  'Plans:',
  '- [ ] 150.5-01-PLAN.md -- one-seam turn-contract normalization (dispatcher-side, insight-sensors.cjs) + the 16-arm firability suite driving the EXACT production turn shape (SENS-FIX-01/02) [wave 1]',
  '- [ ] 150.5-02-PLAN.md -- atomic dial emission: contract threaded via the dispatcher trailer (SEED-020 single door), silent catch replaced with a dial_render_note in the persisted decision trace, D-01 sensor-fired tier-0 cold-card arm, claim-c2 hardened (DIAL-ATOM-01) [wave 1]',
  '- [ ] 150.5-03-PLAN.md -- ACPT-06 in doctor --dogfood-acceptance + run-all-146.sh, the run-all-150.5.sh phase gate, the no-card-no-picture doctrine line, D-01 recorded as EXECUTED (DIAL-ATOM-02/03) [wave 2]',
  '',
  '**Status**: PLANNED (3 plans, 2 waves) -- next: `/gsd:execute-phase 150.5`',
].join('\n');
s = s.replace(oldLine, newBlock);
fs.writeFileSync(p, s);
console.log('ROADMAP updated');
fs.unlinkSync(__filename);
