#!/usr/bin/env node
'use strict';
// Phase 400-05 (S2, CY-01, F-03): the cause_effect axis is a separate axis beside wickedness.
// Legs C1 to C6. C4 holds the 399 shapes; C5 holds "additions only" against base c1e496ae8;
// C6 is the fence: no lib consumer calls the weak rating source causeEffectFromRating.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'c1e496ae8';

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

let ax = null;
try {
  ax = require(path.join(ROOT, 'lib/core/problem-axes.cjs'));
} catch (_e) {
  ax = null;
}

const NULL_CE = { domain: null, source: null };

check('C1 frozen constants CAUSE_EFFECT_DOMAINS, MOVE_TYPES, DOMAIN_MOVE, CAUSE_EFFECT_SOURCES', () => {
  assert.ok(ax, 'lib/core/problem-axes.cjs is missing');
  assert.deepEqual(ax.CAUSE_EFFECT_DOMAINS, ['clear', 'complicated', 'complex', 'chaotic', 'disorder']);
  assert.deepEqual(ax.MOVE_TYPES, ['categorize', 'analyze', 'probe', 'act', 'slice']);
  assert.deepEqual(ax.DOMAIN_MOVE, { clear: 'categorize', complicated: 'analyze', complex: 'probe', chaotic: 'act', disorder: 'slice' });
  assert.deepEqual(ax.CAUSE_EFFECT_SOURCES, ['navigator', 'weak_cynefin_rating']);
  for (const k of ['CAUSE_EFFECT_DOMAINS', 'MOVE_TYPES', 'DOMAIN_MOVE', 'CAUSE_EFFECT_SOURCES']) {
    assert.ok(Object.isFrozen(ax[k]), k + ' is not frozen');
  }
  assert.equal(typeof ax.isCauseEffectDomain, 'function');
  assert.equal(ax.isCauseEffectDomain('disorder'), true);
  assert.equal(ax.isCauseEffectDomain('confused'), false);
});

check('C2 makeCauseEffect keeps only a closed domain with a closed source', () => {
  assert.ok(ax && typeof ax.makeCauseEffect === 'function', 'makeCauseEffect is missing');
  assert.deepEqual(ax.makeCauseEffect('complex', 'navigator'), { domain: 'complex', source: 'navigator' });
  for (const d of ax.CAUSE_EFFECT_DOMAINS) {
    assert.deepEqual(ax.makeCauseEffect(d, 'navigator'), { domain: d, source: 'navigator' }, d);
  }
  for (const bad of ['unknown', '', 'Disorder', 'confused', undefined, null, 3, {}]) {
    assert.deepEqual(ax.makeCauseEffect(bad, 'navigator'), NULL_CE, 'domain ' + String(bad));
  }
  for (const badSource of ['room_text', '', undefined, null, 'Navigator']) {
    assert.deepEqual(ax.makeCauseEffect('complex', badSource), NULL_CE, 'source ' + String(badSource));
  }
});

check('C3 causeEffectFromRating is a labelled weak source and never returns disorder or navigator', () => {
  assert.ok(ax && typeof ax.causeEffectFromRating === 'function', 'causeEffectFromRating is missing');
  const want = ['clear', 'complicated', 'complex', 'chaotic'];
  for (let r = 0; r < 4; r += 1) {
    assert.deepEqual(ax.causeEffectFromRating(r), { domain: want[r], source: 'weak_cynefin_rating' }, 'rating ' + r);
  }
  for (const bad of [-1, 4, 1.5, '1', null, undefined, NaN, true]) {
    assert.deepEqual(ax.causeEffectFromRating(bad), NULL_CE, 'rating ' + String(bad));
  }
  for (const r of [-1, 0, 1, 2, 3, 4, null]) {
    const got = ax.causeEffectFromRating(r);
    assert.notEqual(got.domain, 'disorder');
    assert.notEqual(got.source, 'navigator');
  }
});

check('C4 every 399 export stays, test-399-problem-axes passes, makeAxes output has no cause_effect key', () => {
  assert.ok(ax);
  for (const k of ['DEFINITION_LEVELS', 'CYNEFIN_LEVELS', 'isDefinitionLevel', 'fromExplicitClassification', 'fromFourValue', 'fromPersonaType', 'toFourValue', 'readRoomAxes']) {
    assert.ok(Object.prototype.hasOwnProperty.call(ax, k), 'missing 399 export ' + k);
  }
  assert.deepEqual(ax.CYNEFIN_LEVELS, ['clear', 'complicated', 'complex', 'chaotic']);
  for (const a of [ax.fromFourValue('Wicked'), ax.fromPersonaType('IDP'), ax.fromExplicitClassification({ definition: 'ill-defined', complexity: 'complex' })]) {
    assert.ok(!Object.prototype.hasOwnProperty.call(a, 'cause_effect'), 'axes object has a cause_effect key');
    assert.deepEqual(Object.keys(a), ['definition_level', 'wickedness']);
  }
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tests/test-399-problem-axes.cjs')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, 'test-399-problem-axes failed:\n' + r.stdout + r.stderr);
});

check('C5 lib/core/problem-axes.cjs has 0 deleted lines against ' + BASE, () => {
  const r = spawnSync('git', ['diff', '--numstat', BASE, '--', 'lib/core/problem-axes.cjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, 'git diff failed: ' + r.stderr);
  const line = r.stdout.trim();
  assert.ok(line.length > 0, 'no change against ' + BASE + ' (the additions are missing)');
  const del = line.split(/\s+/)[1];
  assert.equal(del, '0', 'deleted lines: ' + del);
});

check('C6 fence: no lib file other than problem-axes.cjs calls causeEffectFromRating', () => {
  const offenders = [];
  const own = path.join(ROOT, 'lib/core/problem-axes.cjs');
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules') continue;
        walk(p);
      } else if (/\.(cjs|js|mjs|ts)$/.test(ent.name) && p !== own) {
        const lines = fs.readFileSync(p, 'utf8').split('\n');
        lines.forEach((l, i) => {
          const t = l.trim();
          if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
          if (/causeEffectFromRating/.test(t)) offenders.push(path.relative(ROOT, p) + ':' + (i + 1));
        });
      }
    }
  };
  walk(path.join(ROOT, 'lib'));
  assert.deepEqual(offenders, []);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
