'use strict';
// Phase 267.1 -- regression pins for the FIRST_INSTALL Hooked Model audit. Source-assertions over
// scripts/session-start and lib/, anchored on literals (never line numbers -- the FIRST_INSTALL payload
// is one ~3000-char line and its line number moves).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const SESSION_START = path.join(REPO, 'scripts', 'session-start');
const CHECK_ONBOARD = path.join(REPO, 'scripts', 'check-onboard');
const FIRST_INSTALL_ANCHOR = '[MindrianOS Onboarding] First install detected.';
const MENU_ANCHOR = 'COLD_START_MENU=';

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-1-first-install-hooked-audit');

const src = fs.readFileSync(SESSION_START, 'utf8');

function region(anchor) {
  const i = src.indexOf(anchor);
  assert.notEqual(i, -1, 'anchor missing: ' + anchor);
  return src.slice(i, src.indexOf('\n', i));
}

ok('GAP I-1: ~/.mindrian-user.md has no writer under lib/, scripts/, hooks/', function () {
  const grep1 = spawnSync('grep', ['-rn', 'mindrian-user\\.md', 'lib/', 'scripts/', 'hooks/'], { cwd: REPO, encoding: 'utf8' });
  assert.ok(grep1.status === 0 || grep1.status === 1, 'grep exited unexpectedly: ' + grep1.status + ' ' + grep1.stderr);
  const lines = (grep1.stdout || '').split('\n').filter(Boolean);

  // scripts/session-start's FIRST_INSTALL prose block mentions the literal path as instructional
  // text for the model to act on (pinned separately below as the Action-leg finding) -- it is not
  // executable write code, so it is excluded before counting real source-code references.
  const codeLines = lines.filter(function (l) { return l.indexOf('scripts/session-start:') !== 0; });

  assert.equal(codeLines.length, 1,
    'GAP I-1 closed or changed shape: expected exactly one lib/scripts/hooks source reference to '
    + '~/.mindrian-user.md, found ' + codeLines.length + ' - re-run the 267.1 audit. All matches: '
    + JSON.stringify(lines));
  assert.ok(codeLines[0].indexOf('lib/core/user-archetype.cjs:') === 0,
    'GAP I-1 closed or changed shape: the sole code reference moved out of lib/core/user-archetype.cjs - '
    + 're-run the 267.1 audit. Got: ' + codeLines[0]);
  assert.ok(codeLines[0].indexOf('safeReadFile') !== -1,
    'GAP I-1 closed or changed shape: the reference is no longer a safeReadFile call (may now be a '
    + 'writer) - re-run the 267.1 audit. Got: ' + codeLines[0]);

  const grep2 = spawnSync('grep', ['-rn', 'mindrian-user\\.md', 'lib/', 'scripts/', 'hooks/', 'skills/', 'commands/'], { cwd: REPO, encoding: 'utf8' });
  assert.ok(grep2.status === 0 || grep2.status === 1, 'grep exited unexpectedly: ' + grep2.status + ' ' + grep2.stderr);
  const lines2 = (grep2.stdout || '').split('\n').filter(Boolean);
  const writerPattern = /writeFileSync|writeUserMdAtomic|appendFileSync|createWriteStream/;
  for (const l of lines2) {
    assert.ok(!writerPattern.test(l),
      'GAP I-1 closed: a writer for ~/.mindrian-user.md now exists - re-run the 267.1 audit. Offending line: ' + l);
  }
});

ok('GAP R-1: sweepDomainInsights is never invoked from scripts/session-start', function () {
  assert.equal(src.indexOf('sweepDomainInsights'), -1,
    'GAP R-1 closed or changed shape: sweepDomainInsights is now referenced from scripts/session-start - re-run the 267.1 audit');
  assert.equal(src.indexOf('domain-insight-sweep'), -1,
    'GAP R-1 closed or changed shape: domain-insight-sweep is now referenced from scripts/session-start - re-run the 267.1 audit');
});

ok('GAP R-1: the cold-start menu does not route the first-time user to /mos:ignite', function () {
  const menu = region(MENU_ANCHOR);
  assert.notEqual(menu.indexOf('/mos:new-project'), -1,
    'sanity check failed: the COLD_START_MENU= slice did not capture the real menu content');
  assert.equal(menu.indexOf('mos:ignite'), -1,
    'GAP R-1 closed or changed shape: the cold-start menu now routes to /mos:ignite (skills/ignite/SKILL.md:50 '
    + 'names it the canonical front door) - re-run the 267.1 audit');
});

ok('Action leg: the FIRST_INSTALL block carries the SEED-021 AskUserQuestion mandate (closed in 267.1-01)', function () {
  const fi = region(FIRST_INSTALL_ANCHOR);
  assert.ok(fi.length > 2000, 'sanity check failed: the FIRST_INSTALL slice looks truncated (length ' + fi.length + ')');
  assert.notEqual(fi.indexOf('AskUserQuestion'), -1,
    'Action leg regressed: FIRST_INSTALL lost the AskUserQuestion mandate landed in 267.1-01 task 1');
  assert.notEqual(fi.indexOf('SEED-021'), -1,
    'Action leg regressed: FIRST_INSTALL lost the SEED-021 citation landed in 267.1-01 task 1');
  assert.notEqual(fi.indexOf('1. Conversational Q&A'), -1, 'option 1 label missing from FIRST_INSTALL');
  assert.notEqual(fi.indexOf('2. Document paste'), -1, 'option 2 label missing from FIRST_INSTALL');
  assert.notEqual(fi.indexOf('3. Skip'), -1, 'option 3 label missing from FIRST_INSTALL');
});

ok('Action leg: FIRST_INSTALL still asserts the reward and investment legs as prose only (GAP R-1 / GAP I-1 unremediated by design)', function () {
  const fi = region(FIRST_INSTALL_ANCHOR);
  // These two literals are the audit's cited evidence for GAP R-1 (no domain-intelligence reward
  // routing) and GAP I-1 (no USER.md writer). If they disappear, the audit's citations are stale
  // and the deliverable must be revisited -- Phase 267.2 is where they are supposed to change.
  assert.notEqual(fi.indexOf('Based on your work in [domain]'), -1,
    'GAP R-1 citation stale: the reward-leg prose literal is gone from FIRST_INSTALL');
  assert.notEqual(fi.indexOf('~/.mindrian-user.md'), -1,
    'GAP I-1 citation stale: the USER.md prose literal is gone from FIRST_INSTALL');
});

ok('GAP G-1: the reward-before-investment guard has jurisdiction over commands/ only, never hooks', function () {
  const linter = require('../lib/core/mva-rule-linter.cjs');
  assert.equal(typeof linter.scanCommands, 'function', 'mva-rule-linter.cjs no longer exports scanCommands');
  assert.ok(
    Array.isArray(linter.REWARD_TYPES) || typeof linter.REWARD_TYPES === 'object',
    'mva-rule-linter.cjs no longer exports REWARD_TYPES as an array or object/Set'
  );

  const linterSrc = fs.readFileSync(path.join(REPO, 'lib', 'core', 'mva-rule-linter.cjs'), 'utf8');
  const cliSrc = fs.readFileSync(path.join(REPO, 'scripts', 'check-reward-before-investment.cjs'), 'utf8');

  assert.ok(cliSrc.indexOf("path.join(__dirname, '..', 'commands')") !== -1,
    'GAP G-1 changed shape: scripts/check-reward-before-investment.cjs no longer targets commands/ by default - '
    + 're-run the 267.1 audit');
  assert.equal(linterSrc.indexOf('session-start'), -1,
    'GAP G-1 closed or changed shape: lib/core/mva-rule-linter.cjs now references session-start - re-run the 267.1 audit');
  assert.equal(cliSrc.indexOf('session-start'), -1,
    'GAP G-1 closed or changed shape: scripts/check-reward-before-investment.cjs now references session-start - '
    + 're-run the 267.1 audit');
  assert.equal(linterSrc.indexOf("'hooks'"), -1,
    'GAP G-1 closed or changed shape: lib/core/mva-rule-linter.cjs now references \'hooks\' - re-run the 267.1 audit');
  assert.equal(cliSrc.indexOf("'hooks'"), -1,
    'GAP G-1 closed or changed shape: scripts/check-reward-before-investment.cjs now references \'hooks\' - '
    + 're-run the 267.1 audit');
});

ok('Reachability: a virgin HOME still yields FIRST_INSTALL from scripts/check-onboard', function () {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '267-1-'));
  try {
    const res = spawnSync('bash', [CHECK_ONBOARD], {
      env: Object.assign({}, process.env, { HOME: tmp, USERPROFILE: tmp }),
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, 'check-onboard exited non-zero on a virgin HOME: ' + res.stderr);
    const firstLine = (res.stdout || '').split('\n')[0].trim();
    assert.equal(firstLine, 'FIRST_INSTALL',
      'Reachability regressed: a virgin HOME no longer yields FIRST_INSTALL as the first line - re-run the 267.1 audit');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

ok('bash -n scripts/session-start exits 0 (the script still parses)', function () {
  execFileSync('bash', ['-n', SESSION_START], { cwd: REPO, stdio: 'pipe' });
});

console.log('\nPASS test-267-1-first-install-hooked-audit (' + n + ' assertions)');
