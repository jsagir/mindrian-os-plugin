#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260705-ui4 -- NEW fallback tests for the ratification-tracked
 * "Next:" cue. These cover ONLY the new behavior (the scanner + the opt-in
 * fallbackProvider leg of persistFromDecision); the existing clear-semantics
 * assertions in tests/test-statusline-context-aware.cjs stay untouched.
 *
 * Isolation: scanner tests point resolveActiveRoom at a temp fixture room via
 * CLAUDE_ACTIVE_ROOM (its top-precedence env seam) and pin MINDRIAN_ROOMS_HOME
 * to an empty temp dir for the no-room case; writer tests override HOME to a
 * temp dir so the real ~/.mindrian/next-move.json is never touched.
 *
 * Canon Part 8: LOCAL only, no Brain, no network, no user data leaves the box.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const ratNext = require(path.join(REPO, 'lib', 'statusline', 'ratification-next.cjs'));
const nextMoveCache = require(path.join(REPO, 'lib', 'statusline', 'next-move-cache.cjs'));

let n = 0;
let fails = 0;
function ok(desc, fn) {
  try {
    fn();
    n += 1;
    console.log('  ok   ' + desc);
  } catch (e) {
    fails += 1;
    console.error('  FAIL ' + desc + '\n       ' + (e && e.message ? e.message : e));
  }
}

console.log('test-statusline-ratification-next');

// --- fixtures --------------------------------------------------------------

// Build a frontmatter .md body from a spec object. Deliberately includes title,
// owner, and target prose so the content-leak guard has real strings to assert
// never reach the cue.
function fmBody(o) {
  let s = '---\n';
  if (o.title) s += 'title: ' + o.title + '\n';
  if (o.status) s += 'ratification_status: ' + o.status + '\n';
  if (o.owner) s += 'ratification_owner: ' + o.owner + '\n';
  if (o.target) s += 'ratification_target: ' + o.target + '\n';
  if (o.strength) s += 'ratification_strength: ' + o.strength + '\n';
  s += '---\n\n# Body\n\nSome prose here.\n';
  return s;
}

// Create a fixture room dir with research/<entry-dir>/<entry>.md entries.
// entries: [{ dir, file, content }]. Returns the room abs path.
function makeRoom(entries) {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ratif-room-'));
  if (entries) {
    const research = path.join(room, 'research');
    fs.mkdirSync(research, { recursive: true });
    entries.forEach(function (e, i) {
      const dir = path.join(research, e.dir || ('entry-' + i));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, (e.file || 'entry') + '.md'), e.content, 'utf8');
    });
  }
  return room;
}

// env save/restore around a body.
function withEnv(vars, body) {
  const saved = {};
  Object.keys(vars).forEach(function (k) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  });
  try {
    body();
  } finally {
    Object.keys(saved).forEach(function (k) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  }
}

const cleanup = [];
function track(p) { cleanup.push(p); return p; }

// --- 1. Scanner: 2 proposed (strong + weak) -> top strength cue ------------

ok('scanner: 2 proposed entries (strong + weak) -> "ratify strong (2 open)"', function () {
  const room = track(makeRoom([
    { dir: 'a-strong', content: fmBody({ title: 'Alpha', status: 'proposed', strength: 'strong', target: 'before Phase 999' }) },
    { dir: 'b-weak', content: fmBody({ title: 'Beta', status: 'proposed', strength: 'weak', target: 'someday' }) },
  ]));
  withEnv({ CLAUDE_ACTIVE_ROOM: room, MINDRIAN_ROOMS_HOME: undefined }, function () {
    const r = ratNext.scanRatificationNext();
    assert.ok(r, 'returns a result');
    assert.equal(r.cue, 'ratify strong (2 open)', 'cue is enum + count, strongest wins');
    assert.equal(r.count, 2, 'count is 2');
    assert.equal(r.strength, 'strong', 'top strength is strong');
  });
});

// --- 2. Degrade: no room / no research / malformed -------------------------

ok('scanner degrade: no active room -> null', function () {
  const emptyHome = track(fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ratif-empty-')));
  withEnv({ CLAUDE_ACTIVE_ROOM: undefined, MINDRIAN_ROOMS_HOME: emptyHome }, function () {
    assert.equal(ratNext.scanRatificationNext(), null, 'no registry -> null');
  });
});

ok('scanner degrade: room without research/ -> null', function () {
  const room = track(makeRoom(null)); // no research dir
  withEnv({ CLAUDE_ACTIVE_ROOM: room, MINDRIAN_ROOMS_HOME: undefined }, function () {
    assert.equal(ratNext.scanRatificationNext(), null, 'no research/ -> null');
  });
});

ok('scanner degrade: only non-proposed statuses -> null', function () {
  const room = track(makeRoom([
    { dir: 'ratified', content: fmBody({ title: 'Done', status: 'ratified', strength: 'strong' }) },
    { dir: 'rejected', content: fmBody({ title: 'Nope', status: 'rejected', strength: 'weak' }) },
  ]));
  withEnv({ CLAUDE_ACTIVE_ROOM: room, MINDRIAN_ROOMS_HOME: undefined }, function () {
    assert.equal(ratNext.scanRatificationNext(), null, 'no proposed -> null');
  });
});

ok('scanner degrade: malformed frontmatter entry is skipped, never throws', function () {
  const room = track(makeRoom([
    { dir: 'good', content: fmBody({ title: 'Good', status: 'proposed', strength: 'medium', target: 'soon' }) },
    { dir: 'broken', content: '---\nratification_status: proposed\nno closing fence and : garbage {[' },
  ]));
  withEnv({ CLAUDE_ACTIVE_ROOM: room, MINDRIAN_ROOMS_HOME: undefined }, function () {
    const r = ratNext.scanRatificationNext();
    assert.ok(r, 'returns a result from the good entry');
    assert.equal(r.count, 1, 'the malformed (no-fence) entry is skipped -> count 1');
    assert.equal(r.cue, 'ratify medium (1 open)', 'cue reflects only the good entry');
  });
});

// --- 3. Content-leak guard -------------------------------------------------

ok('content-leak guard: cue carries NO title and NO ratification_target prose', function () {
  const secretTitle = 'ZZTopSecretEntryTitle';
  const secretTarget = 'BeforePhase999SecretProse';
  const room = track(makeRoom([
    { dir: 'leaky', content: fmBody({ title: secretTitle, status: 'proposed', strength: 'strong', owner: 'navigator', target: secretTarget }) },
  ]));
  withEnv({ CLAUDE_ACTIVE_ROOM: room, MINDRIAN_ROOMS_HOME: undefined }, function () {
    const r = ratNext.scanRatificationNext();
    assert.ok(r, 'returns a result');
    assert.equal(r.cue.indexOf(secretTitle), -1, 'title substring never in the cue');
    assert.equal(r.cue.indexOf(secretTarget), -1, 'ratification_target prose never in the cue');
    assert.equal(r.cue.indexOf('target'), -1, 'no target token in the cue');
    assert.equal(r.cue.indexOf('navigator'), -1, 'no owner in the cue');
    assert.equal(r.cue, 'ratify strong (1 open)', 'cue is enum + count only');
  });
});

// --- 4-7. Writer fallback leg (HOME-isolated cache) ------------------------

ok('writer: abstaining decision + NO opts -> cache absent (clear semantics unchanged)', function () {
  const tmpHome = track(fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ratif-home-')));
  withEnv({ HOME: tmpHome }, function () {
    const wrote = nextMoveCache.persistFromDecision({ offer_next_step: null, fire_skill: null });
    assert.equal(wrote, true, 'clear returns true');
    assert.equal(fs.existsSync(nextMoveCache.cachePath()), false, 'cache file absent');
    assert.equal(nextMoveCache.readNextMove(), null, 'reader returns null');
  });
});

ok('writer: abstain + fallbackProvider -> raw cue persisted verbatim (parenthetical intact)', function () {
  const tmpHome = track(fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ratif-home-')));
  withEnv({ HOME: tmpHome }, function () {
    const wrote = nextMoveCache.persistFromDecision(
      { offer_next_step: null, fire_skill: null },
      { fallbackProvider: function () { return 'ratify strong (2 open)'; } }
    );
    assert.equal(wrote, true, 'write returns true');
    assert.equal(nextMoveCache.readNextMove(), 'ratify strong (2 open)',
      'exact raw cue, parenthetical intact (bypassed formatCommandCue)');
    // Confirm the additive source marker landed and command is null.
    const rec = JSON.parse(fs.readFileSync(nextMoveCache.cachePath(), 'utf8'));
    assert.equal(rec.source, 'ratification', 'additive source marker present');
    assert.equal(rec.command, null, 'no command for a ratification fallback');
  });
});

ok('writer: routed offer_next_step wins, provider is NEVER consulted', function () {
  const tmpHome = track(fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ratif-home-')));
  withEnv({ HOME: tmpHome }, function () {
    let called = 0;
    nextMoveCache.persistFromDecision(
      { offer_next_step: { command: '/mos:mullins', jtbd: 'assess' }, fire_skill: 'soft-systems' },
      { fallbackProvider: function () { called += 1; throw new Error('should never run'); } }
    );
    assert.equal(called, 0, 'provider not consulted when a real command routes');
    assert.equal(nextMoveCache.readNextMove(), 'mullins', 'routed command cue wins');
  });
});

ok('writer: fire_skill wins over provider (case 2 unchanged)', function () {
  const tmpHome = track(fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ratif-home-')));
  withEnv({ HOME: tmpHome }, function () {
    let called = 0;
    nextMoveCache.persistFromDecision(
      { offer_next_step: null, fire_skill: 'map-unknowns' },
      { fallbackProvider: function () { called += 1; return 'ratify weak (1 open)'; } }
    );
    assert.equal(called, 0, 'provider not consulted when a skill fires');
    assert.equal(nextMoveCache.readNextMove(), 'map unknowns', 'fire_skill cue wins');
  });
});

ok('writer: provider that THROWS -> clears as today, no exception escapes', function () {
  const tmpHome = track(fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ratif-home-')));
  withEnv({ HOME: tmpHome }, function () {
    const wrote = nextMoveCache.persistFromDecision(
      { offer_next_step: null, fire_skill: null },
      { fallbackProvider: function () { throw new Error('boom'); } }
    );
    assert.equal(wrote, true, 'still returns true (graceful)');
    assert.equal(fs.existsSync(nextMoveCache.cachePath()), false, 'cache cleared, no stale pin');
  });
});

ok('writer: provider returns null/empty -> clears as today', function () {
  const tmpHome = track(fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ratif-home-')));
  withEnv({ HOME: tmpHome }, function () {
    nextMoveCache.persistFromDecision(
      { offer_next_step: null, fire_skill: null },
      { fallbackProvider: function () { return null; } }
    );
    assert.equal(fs.existsSync(nextMoveCache.cachePath()), false, 'null cue clears');
    nextMoveCache.persistFromDecision(
      { offer_next_step: null, fire_skill: null },
      { fallbackProvider: function () { return '   '; } }
    );
    assert.equal(fs.existsSync(nextMoveCache.cachePath()), false, 'whitespace-only cue clears');
  });
});

// --- teardown + report -----------------------------------------------------

cleanup.forEach(function (p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
});

console.log('');
if (fails > 0) {
  console.error('FAILED: ' + fails + ' of ' + (n + fails) + ' checks');
  process.exit(1);
}
console.log('PASSED: ' + n + ' checks');
process.exit(0);
