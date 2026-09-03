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

ok('GAP I-1: ~/.mindrian-user.md has exactly the pre-existing reader (lib/core/user-archetype.cjs) '
  + 'and the shipped writer (lib/mcp/tools/identity.cjs, Phase 270-11 identity_write), and no '
  + 'scripts/ or hooks/ file is writer-shaped for this path', function () {
  // GAP I-1 originally meant "the FIRST_INSTALL path has no writer for ~/.mindrian-user.md
  // anywhere in lib/, scripts/, hooks/". Phase 270-11 shipped identity_write
  // (lib/mcp/tools/identity.cjs), the MECHANISM half of closing that gap, built on the
  // pre-existing writeUserMdAtomic (Part 7 reuse-before-build). .planning/REQUIREMENTS.md
  // MEMOP-08 binds Phase 267.2 W2 to owning the TRIGGER without building a second writer -- so
  // this leg's job now is to pin the exact file SET (not a brittle integer count) so a THIRD
  // file appearing here is the signal to re-run the audit. Plan 267.2-09 is the one authorised
  // to add scripts/first-install-router.cjs to this set.
  const grep1 = spawnSync('grep', ['-rn', 'mindrian-user\\.md', 'lib/', 'scripts/', 'hooks/'], { cwd: REPO, encoding: 'utf8' });
  assert.ok(grep1.status === 0 || grep1.status === 1, 'grep exited unexpectedly: ' + grep1.status + ' ' + grep1.stderr);
  const lines = (grep1.stdout || '').split('\n').filter(Boolean);

  // scripts/session-start's FIRST_INSTALL prose block mentions the literal path as instructional
  // text for the model to act on (pinned separately below as the Action-leg finding) -- it is not
  // executable write code, so it is excluded before counting real source-code references.
  const codeLines = lines.filter(function (l) { return l.indexOf('scripts/session-start:') !== 0; });

  const fileSet = new Set(codeLines.map(function (l) { return l.split(':')[0]; }));
  const expectedFiles = ['lib/core/user-archetype.cjs', 'lib/mcp/tools/identity.cjs'];
  assert.equal(fileSet.size, expectedFiles.length,
    'GAP I-1 closed or changed shape: expected exactly the file set '
    + JSON.stringify(expectedFiles) + ', found ' + JSON.stringify(Array.from(fileSet))
    + ' - re-run the 267.1 audit. All matches: ' + JSON.stringify(lines));
  for (const f of expectedFiles) {
    assert.ok(fileSet.has(f),
      'GAP I-1 closed or changed shape: expected file ' + f + ' missing from the reference set - '
      + 're-run the 267.1 audit. Found set: ' + JSON.stringify(Array.from(fileSet)));
  }

  const readerLines = codeLines.filter(function (l) { return l.indexOf('lib/core/user-archetype.cjs:') === 0; });
  assert.ok(readerLines.length > 0,
    'GAP I-1 closed or changed shape: lib/core/user-archetype.cjs no longer references '
    + '~/.mindrian-user.md - re-run the 267.1 audit.');
  assert.ok(readerLines.every(function (l) { return l.indexOf('safeReadFile') !== -1; }),
    'GAP I-1 closed or changed shape: the lib/core/user-archetype.cjs reference is no longer a '
    + 'safeReadFile call (may now be a writer) - re-run the 267.1 audit. Got: ' + JSON.stringify(readerLines));

  const writerPattern = /writeFileSync|writeUserMdAtomic|appendFileSync|createWriteStream/;

  // identity.cjs's actual write call (writeUserMdAtomic(userMdPath, data)) does not literally
  // contain the string "mindrian-user.md" on its own line -- the path is built earlier via
  // USER_MD_PATH() (lib/mcp/tools/identity.cjs:71-73) and passed in as a variable. So confirming
  // identity.cjs really is writer-shaped requires reading its own full source, not filtering the
  // mindrian-user.md grep above.
  const identitySrc = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'tools', 'identity.cjs'), 'utf8');
  const identityWriterLines = identitySrc.split('\n').filter(function (l) { return writerPattern.test(l); });
  assert.ok(identityWriterLines.length > 0,
    'GAP I-1 closed or changed shape: lib/mcp/tools/identity.cjs no longer contains a '
    + 'writer-shaped call (writeFileSync|writeUserMdAtomic|appendFileSync|createWriteStream) - '
    + 're-run the 267.1 audit.');

  // No scripts/ or hooks/ file may be writer-shaped for THIS path: scope the check to lines that
  // already reference ~/.mindrian-user.md (grep2, extended to skills/ and commands/ for full
  // repo-wide coverage), then assert none of the scripts/ or hooks/ lines among them are
  // writer-shaped. scripts/session-start:684 is prose injected as model context, not executable
  // write code, and does not match writerPattern today -- if it or any other scripts/ or hooks/
  // file ever became writer-shaped for this path, that is a second writer and MEMOP-08 forbids it.
  const grep2 = spawnSync('grep', ['-rn', 'mindrian-user\\.md', 'lib/', 'scripts/', 'hooks/', 'skills/', 'commands/'], { cwd: REPO, encoding: 'utf8' });
  assert.ok(grep2.status === 0 || grep2.status === 1, 'grep exited unexpectedly: ' + grep2.status + ' ' + grep2.stderr);
  const lines2 = (grep2.stdout || '').split('\n').filter(Boolean);
  const scriptsOrHooksLines = lines2.filter(function (l) { return l.indexOf('scripts/') === 0 || l.indexOf('hooks/') === 0; });
  for (const l of scriptsOrHooksLines) {
    assert.ok(!writerPattern.test(l),
      'GAP I-1 closed: a second writer for ~/.mindrian-user.md now exists under scripts/ or hooks/, '
      + 'violating MEMOP-08 (must not build a second writer) - re-run the 267.1 audit. Offending line: ' + l);
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

ok('Action leg: the FIRST_INSTALL block does NOT carry the SEED-021 AskUserQuestion mandate '
  + '(reverted in 267.2-03 W0, per the 267.1-06 Task 2 navigator ruling)', function () {
  // Phase 267.1 shipped this mandate out of scope inside an otherwise audit-only phase (commit
  // f39f24d9). The navigator reversed that scope call at the 267.1-06 Task 2 checkpoint and
  // ordered the revert deferred to Phase 267.2 W0. This pin is therefore a NEGATIVE pin matching
  // the audit's own original pre-fix framing (267.1-VALIDATION.md row 267.1-01-04): if a future
  // well-meaning session re-adds AskUserQuestion/SEED-021 here, that is a regression of the
  // navigator's own reversed scope call, not a fix, and must fail loudly.
  const fi = region(FIRST_INSTALL_ANCHOR);
  // Threshold lowered from 2000 to 1200 by 267.2-08: that plan deliberately shrank this payload
  // (removed the unbacked domain-intelligence promise, the eight-field ~/.mindrian-user.md
  // capture instruction, and the three-option menu), so a smaller-but-real region is expected,
  // not a truncation. 1200 still catches a genuinely truncated or empty slice.
  assert.ok(fi.length > 1200, 'sanity check failed: the FIRST_INSTALL slice looks truncated (length ' + fi.length + ')');
  assert.equal(fi.indexOf('AskUserQuestion'), -1,
    'Action leg regressed: FIRST_INSTALL regained the AskUserQuestion mandate that the 267.2 W0 '
    + 'revert (commit f39f24d9 reverted, per the 267.1-06 Task 2 navigator ruling) removed');
  assert.equal(fi.indexOf('SEED-021'), -1,
    'Action leg regressed: FIRST_INSTALL regained the SEED-021 citation that the 267.2 W0 revert '
    + '(commit f39f24d9 reverted, per the 267.1-06 Task 2 navigator ruling) removed');
  // 267.2-08 (D-B) replaced the three-option menu with one open question, so the three numbered
  // option labels are gone by design. Assert no numbered-list menu marker sequence (e.g. "1. ",
  // "2. ") survives at all: a menu on this turn would be investment before reward, the exact
  // defect this phase fixes.
  assert.equal(/(^|\n)\s*\d+\.\s/.test(fi), false,
    'Action leg regressed: FIRST_INSTALL carries a numbered-list menu marker again -- '
    + 'a menu on this turn is investment before reward, the exact ordering 267.2-08 fixed');
});

ok('Action leg: FIRST_INSTALL hands first contact to the router with no unbacked reward or '
  + 'investment promise (GAP R-1 / GAP I-1 repaired, 267.2-08)', function () {
  const fi = region(FIRST_INSTALL_ANCHOR);
  // These two literals were the audit's own cited evidence for GAP R-1 (no domain-intelligence
  // reward routing) and GAP I-1 (no USER.md writer). Both are now gone by design: the reward is
  // delivered by scripts/first-install-router.cjs machinery, not promised in prose, and the
  // investment ask (~/.mindrian-user.md capture) is emitted by the router AFTER the reward, per
  // docs/reward-before-investment-rule.md, never asked for in the session-start payload itself.
  assert.equal(fi.indexOf('Based on your work in [domain]'), -1,
    'GAP R-1 regressed: the unbacked domain-intelligence reward promise returned to FIRST_INSTALL; '
    + 'the reward must be delivered by scripts/first-install-router.cjs, not promised in prose');
  assert.equal(fi.indexOf('~/.mindrian-user.md'), -1,
    'GAP I-1 regressed: the ~/.mindrian-user.md investment ask returned to FIRST_INSTALL; per '
    + 'docs/reward-before-investment-rule.md the ask must be emitted by the router AFTER the '
    + 'reward, not requested in the session-start payload');
  assert.notEqual(fi.indexOf('first-install-router'), -1,
    'FIRST_INSTALL no longer names scripts/first-install-router.cjs as the surface that owns the '
    + 'handoff -- the positive proof that the reward/investment repair actually wired something');
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

  // Phase 267.3 (commit 9a1b9fda, landed before this plan touched this file) legitimately added
  // scanDeclaredSurfaces(), a SEPARATE registry-based path (data/first-reward-surfaces.json) for
  // bash hooks like scripts/session-start, which have no frontmatter for scanCommands to read.
  // Its own comments explain that exclusion in prose that happens to contain the literal
  // substring "session-start" and "'hooks'" was already absent, but a bare indexOf() over the
  // whole file cannot distinguish an explanatory COMMENT from actual scanning-jurisdiction CODE.
  // This out-of-scope staleness (same category as GAP I-1's, discovered here only because
  // 267.2-BASELINE.md's measurement never reached past GAP I-1 to exercise this leg at all) is
  // fixed minimally by checking non-comment code lines only, so the assertion measures the real
  // invariant (scanCommands/scanDeclaredSurfaces never scan session-start's own file, never treat
  // 'hooks' as a jurisdiction directory) instead of any incidental prose mention.
  function nonCommentLines(src) {
    let inBlock = false;
    return src.split('\n').filter(function (l) {
      const t = l.trim();
      if (inBlock) {
        if (t.indexOf('*/') !== -1) inBlock = false;
        return false;
      }
      if (t.indexOf('/*') === 0) {
        if (t.indexOf('*/') === -1) inBlock = true;
        return false;
      }
      if (t.indexOf('//') === 0 || t.indexOf('*') === 0) return false;
      return true;
    }).join('\n');
  }
  const linterCode = nonCommentLines(linterSrc);
  const cliCode = nonCommentLines(cliSrc);

  assert.ok(cliSrc.indexOf("path.join(__dirname, '..', 'commands')") !== -1,
    'GAP G-1 changed shape: scripts/check-reward-before-investment.cjs no longer targets commands/ by default - '
    + 're-run the 267.1 audit');
  assert.equal(linterCode.indexOf('session-start'), -1,
    'GAP G-1 closed or changed shape: lib/core/mva-rule-linter.cjs now references session-start in CODE '
    + '(not just a comment) - re-run the 267.1 audit');
  assert.equal(cliCode.indexOf('session-start'), -1,
    'GAP G-1 closed or changed shape: scripts/check-reward-before-investment.cjs now references session-start '
    + 'in CODE (not just a comment) - re-run the 267.1 audit');
  assert.equal(linterCode.indexOf("'hooks'"), -1,
    'GAP G-1 closed or changed shape: lib/core/mva-rule-linter.cjs now references \'hooks\' in CODE '
    + '(not just a comment) - re-run the 267.1 audit');
  assert.equal(cliCode.indexOf("'hooks'"), -1,
    'GAP G-1 closed or changed shape: scripts/check-reward-before-investment.cjs now references \'hooks\' '
    + 'in CODE (not just a comment) - re-run the 267.1 audit');
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
