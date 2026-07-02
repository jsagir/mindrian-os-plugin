// Locks the 2026-07-02 update-detection bug: a beta must rank BELOW its stable
// release, so a beta tester is offered the stable upgrade (not told "current").
const fs = require('node:fs');
const assert = require('node:assert');
const src = fs.readFileSync(require('node:path').join(__dirname, '..', 'scripts', 'check-version-and-sha.cjs'), 'utf8');
const m = src.match(/function compareSemver[\s\S]*?\n}/);
assert(m, 'compareSemver function not found');
eval(m[0]);

let pass = 0, fail = 0;
const chk = (got, want, label) => {
  const norm = (n) => (n < 0 ? -1 : n > 0 ? 1 : 0);
  if (norm(got) === want) { pass++; }
  else { fail++; console.log(`  FAIL ${label}: got ${got}, want ${want}`); }
};

// THE regression: beta.13 vs stable 1.15.0 -> beta is OLDER (-1)
chk(compareSemver('1.15.0-beta.13', '1.15.0'), -1, 'beta.13 < stable 1.15.0 (the shipped bug)');
chk(compareSemver('1.15.0', '1.15.0-beta.13'),  1, 'stable 1.15.0 > beta.13');
// beta ordering
chk(compareSemver('1.15.0-beta.13', '1.15.0-beta.14'), -1, 'beta.13 < beta.14');
chk(compareSemver('1.15.0-beta.14', '1.15.0-beta.13'),  1, 'beta.14 > beta.13');
chk(compareSemver('1.15.0-beta.2',  '1.15.0-beta.13'), -1, 'beta.2 < beta.13 (numeric, not lexical)');
// core precedence still works
chk(compareSemver('1.14.0', '1.15.0'), -1, '1.14.0 < 1.15.0 (core upgrade)');
chk(compareSemver('1.15.0', '1.15.0'),  0, 'equal stable');
chk(compareSemver('1.15.1', '1.15.0'),  1, 'patch newer');
chk(compareSemver('1.15.0-beta.13', '1.15.0-beta.13'), 0, 'equal beta');
// a stable is greater than ANY prerelease of the same core
chk(compareSemver('2.0.0', '2.0.0-rc.9'), 1, 'stable > rc');

console.log(`\ncompareSemver prerelease: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
