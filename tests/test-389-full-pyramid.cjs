#!/usr/bin/env node
// Phase 389 plan 04: the Full depth runs on the Phase 363 pyramid engine.
// One explicit_only template (pyramid-argument) and one adapter (pyramid-seed-upgrade).
// Plain counters. Hyphens only. Exit 1 on a failure. No network. No real room.
//
// Records are built inline from tests/fixtures/389/sentences.json ids; the fixture room
// is tests/fixtures/389/room and is hashed before and after to prove a read-only run.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-389-full-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-389-full-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const guard = hygiene.installNetGuard();

const ROOM = path.join(ROOT, 'tests/fixtures/389/room');

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; console.log('ok   ' + name); }
function fail(name, detail) { failed += 1; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
function leg(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, String(e && e.message ? e.message : e).slice(0, 300)); }
}
function assertTrue(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function hashDir(dir) {
  const h = crypto.createHash('sha256');
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).sort(function (a, b) { return a.name < b.name ? -1 : 1; }).forEach(function (e) {
      const p = path.join(d, e.name);
      h.update(path.relative(dir, p) + '\n');
      if (e.isDirectory()) walk(p); else h.update(fs.readFileSync(p));
    });
  })(dir);
  return h.digest('hex');
}

// ---------------------------------------------------------------------------
// records (the contract mos.pyramid-seed/1), built inline for the 3 fixture sentences
// ---------------------------------------------------------------------------
const SENTENCES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/389/sentences.json'), 'utf8'));
const RECORDS = {
  'consumer-subscription': {
    schema: 'mos.pyramid-seed/1', id: 'a1b2c3d4', created_at: '2026-11-08T08:00:00.000Z', depth: 'seed',
    situation: 'People who live alone often cook for nobody and fall back on takeaway on tired evenings.',
    complication: 'Large meal kits feed several people and lock in a weekly plan, so they do not fit one person.',
    question: 'Would a monthly box with one proper dinner a week make these people stop ordering takeaway?',
    answer: 'Yes, if each box holds exact amounts, a recipe card and a short video, and asks for no weekly commitment.',
    support: [
      { group: 'The weekday takeaway habit is costly', claims: ['People who live alone order takeaway because cooking for one feels like too much work after a long day.'] },
      { group: 'Shopping and amounts are the real barrier', claims: ['A recipe with exact amounts, already bought, would change what a person does on a weeknight.'] },
      { group: 'One meal a week is a small enough promise', claims: ['None of the people asked wanted a commitment of more than one meal.'] },
    ],
    objection: 'A person who cooks on Sunday and eats leftovers until Wednesday may never feel the need for a weekly dinner.',
    evidence: [],
  },
  'business-tool': {
    schema: 'mos.pyramid-seed/1', id: 'b2c3d4e5', created_at: '2026-11-08T08:01:00.000Z', depth: 'seed',
    situation: 'Mid sized building contractors pay many supplier invoices against purchase orders each month.',
    complication: 'Mismatched invoices slip through and late payment penalties surprise the owner.',
    question: 'Would a tool that matches each invoice to its purchase order and flags mismatches end the surprise penalties?',
    answer: 'Yes, if the finance team trusts the match and sees the flagged invoices before the due date.',
    support: [
      { group: 'Matching by hand is slow and misses items', claims: ['Finance staff compare paper invoices against purchase orders late in the month.'] },
      { group: 'Penalties come from timing, not only from errors', claims: ['A flagged invoice found a week before the due date can still be paid on time.'] },
    ],
    objection: 'Suppliers may send invoices in formats a simple reader cannot parse, so the flags would be wrong.',
    evidence: [],
  },
  'local-service': {
    schema: 'mos.pyramid-seed/1', id: 'c3d4e5f6', created_at: '2026-11-08T08:02:00.000Z', depth: 'seed',
    situation: 'Elderly people in one city neighbourhood live with small repair jobs that stay undone.',
    complication: 'They do not trust strangers at the door, and their families live far away.',
    question: 'Would a vetted weekend helper at a fixed price get these small repairs done?',
    answer: 'Yes, if the family pays a fixed price and the helper is vetted and known by name.',
    support: [
      { group: 'Trust is the first barrier', claims: ['A vetted helper whose name the family knows removes the fear of a stranger.'] },
      { group: 'A fixed price removes the fear of cost', claims: ['The family pays a known amount, so the elderly person does not negotiate.'] },
      { group: 'Small jobs pile up unnoticed', claims: ['A loose shelf, a dripping tap and a stuck window are left for months.'] },
    ],
    objection: 'A weekend slot may not match the days when small jobs become urgent.',
    evidence: [],
  },
};
function clone(v) { return JSON.parse(JSON.stringify(v)); }

const IDS = ['consumer-subscription', 'business-tool', 'local-service'];
leg('fixture sentences and records line up', function () {
  assertTrue(SENTENCES.map(function (s) { return s.id; }).join(',') === IDS.join(','), 'sentence ids');
  IDS.forEach(function (id) { assertTrue(RECORDS[id], 'record ' + id); });
});

// ---------------------------------------------------------------------------
// the modules under test (absent before the plan: each leg then fails for that reason)
// ---------------------------------------------------------------------------
let Q = null;
let U = null;
let loadErr = '';
try { Q = require(path.join(ROOT, 'lib/core/research-planner/question-templates.cjs')); } catch (e) { loadErr = 'question-templates: ' + e.message; }
try { U = require(path.join(ROOT, 'lib/core/pyramid-seed-upgrade.cjs')); } catch (e) { loadErr = (loadErr ? loadErr + '; ' : '') + 'pyramid-seed-upgrade: ' + e.message; }

const STEPS = ['tension', 'goal', 'rung', 'forum', 'paths', 'limiters', 'ranking'];

leg('Test 1 template pyramid-argument is registered, explicit_only, plain command not rerouted', function () {
  const t = Q.TEMPLATES['pyramid-argument'];
  assertTrue(t, 'template missing');
  assertTrue(t.framework === 'The Pyramid Principle', 'framework ' + t.framework);
  assertTrue(t.explicit_only === true, 'explicit_only');
  assertTrue(JSON.stringify(t.doors) === JSON.stringify(['/mos:structure-argument full']), 'doors ' + JSON.stringify(t.doors));
  assertTrue(Q.templateForCommand('/mos:structure-argument') === null, 'plain command rerouted');
  assertTrue(Q.PLANNER_TEMPLATE_IDS[Q.PLANNER_TEMPLATE_IDS.length - 1] === 'pyramid-argument', 'registered last');
});

leg('Test 2 dimensions: four researchable on concept-evidence, one closed answer', function () {
  const t = Q.TEMPLATES['pyramid-argument'];
  const ids = t.dimensions.map(function (d) { return d.id; });
  assertTrue(JSON.stringify(ids) === JSON.stringify(['pa:situation', 'pa:complication', 'pa:support', 'pa:objection', 'pa:answer']), 'ids ' + ids.join(','));
  t.dimensions.forEach(function (d) {
    assertTrue(STEPS.indexOf(d.perspective_step) !== -1, d.id + ' step');
    if (d.id === 'pa:answer') {
      assertTrue(d.researchable === false, 'answer closed');
      assertTrue(/judgment/.test(d.not_researchable_reason) && /own/.test(d.not_researchable_reason), 'answer reason ' + d.not_researchable_reason);
    } else {
      assertTrue(d.researchable === true, d.id + ' researchable');
      assertTrue(d.default_family === 'concept-evidence/v1', d.id + ' family');
      assertTrue(d.falsifier_template === 'ce.counter', d.id + ' falsifier');
      assertTrue(typeof d.falsifier_default === 'string' && d.falsifier_default.length > 0, d.id + ' falsifier_default');
    }
  });
});

IDS.forEach(function (id, n) {
  leg('Test 3.' + (n + 1) + ' seedToQuestionSet(' + id + ') validates; claims user_stated, rest framework_dimension', function () {
    const rec = RECORDS[id];
    const qs = U.seedToQuestionSet(rec);
    const v = Q.validateQuestionSet(qs);
    assertTrue(v.ok, 'validateQuestionSet ' + v.errors.join(','));
    assertTrue(qs.template_id === 'pyramid-argument', 'template_id');
    assertTrue(qs.key_line.length === rec.support.length, 'key_line per group');
    const claims = [];
    rec.support.forEach(function (g) { g.claims.forEach(function (c) { claims.push(c); }); });
    const stated = qs.leaves.filter(function (l) { return l.origin === 'user_stated'; });
    assertTrue(stated.length === claims.length, 'stated leaves ' + stated.length);
    stated.forEach(function (l) {
      assertTrue(l.dimension === 'pa:support', 'stated leaf dimension ' + l.dimension);
      assertTrue(claims.indexOf(l.question) !== -1, 'stated leaf text is the claim');
    });
    ['pa:situation', 'pa:complication', 'pa:objection'].forEach(function (dimId) {
      const hit = qs.leaves.filter(function (l) { return l.dimension === dimId; });
      assertTrue(hit.length === 1 && hit[0].origin === 'framework_dimension', dimId + ' leaf is framework_dimension');
    });
    assertTrue(qs.scqa.situation === rec.situation && qs.scqa.complication === rec.complication && qs.scqa.question === rec.question, 'scqa');
  });
});

IDS.forEach(function (id, n) {
  leg('Test 4.' + (n + 1) + ' upgradeSeed(' + id + ') builds, lists additions, reads the room', function () {
    const rec = RECORDS[id];
    const r = U.upgradeSeed(rec, { roomDir: ROOM });
    assertTrue(r.ok === true, 'ok ' + JSON.stringify(r.reason || r.errors));
    assertTrue(r.pyramid && r.pyramid.scqa.situation === rec.situation && r.pyramid.scqa.complication === rec.complication && r.pyramid.scqa.question === rec.question, 'pyramid scqa equals record');
    assertTrue(r.pyramid.scqa.answer_hypothesis === rec.answer, 'answer hypothesis');
    assertTrue(r.check && typeof r.check.status === 'string', 'check object');
    assertTrue(r.status !== 'incomplete' && r.status !== 'wish', 'status ' + r.status);
    const dims = r.additions.map(function (a) { return a.dimension; });
    ['pa:situation', 'pa:complication', 'pa:objection'].forEach(function (d) { assertTrue(dims.indexOf(d) !== -1, 'addition ' + d); });
    assertTrue(Array.isArray(r.uncovered) && r.uncovered.length === 0, 'uncovered ' + JSON.stringify(r.uncovered));
    assertTrue(Array.isArray(r.mece_warnings), 'mece_warnings');
    assertTrue(Array.isArray(r.room_evidence), 'room_evidence');
  });
});

leg('Test 4.4 room evidence names the support groups whose words are in the fixture room', function () {
  const r = U.upgradeSeed(RECORDS['consumer-subscription'], { roomDir: ROOM });
  assertTrue(r.ok, 'ok');
  assertTrue(r.room_evidence.length >= 1, 'room evidence empty');
  const e = r.room_evidence[0];
  assertTrue(typeof e.group === 'string' && e.artifact_count >= 1 && Array.isArray(e.artifacts) && e.artifacts[0].path, 'entry shape');
  assertTrue(e.artifacts.some(function (a) { return /interview-notes\.md$/.test(a.path); }), 'interview-notes.md named');
});

leg('Test 5a overlapping support groups give an overlap warning, no throw', function () {
  const rec = clone(RECORDS['consumer-subscription']);
  rec.support = [
    { group: 'Takeaway costs too much for one person', claims: ['Ordering takeaway costs a person who lives alone a lot each week.'] },
    { group: 'Takeaway costs too much each week', claims: ['Takeaway costs add up to a large sum every week for one person.'] },
  ];
  const r = U.upgradeSeed(rec, { roomDir: ROOM });
  assertTrue(r.ok === true, 'ok');
  assertTrue(r.check.mece.overlap_warnings.length >= 1, 'overlap warnings ' + r.check.mece.overlap_warnings.length);
  assertTrue(r.mece_warnings.some(function (w) { return /Possible overlap/.test(w); }), 'overlap in mece_warnings');
});

leg('Test 5b claims that restate the question give a restatement warning or d00_failed, no throw', function () {
  const rec = clone(RECORDS['consumer-subscription']);
  rec.support = [
    { group: 'The first restatement', claims: ['Would a monthly box with one proper dinner a week make these people stop ordering takeaway?'] },
    { group: 'The second restatement', claims: ['A monthly box with one proper dinner a week would make these people stop ordering takeaway.'] },
  ];
  const r = U.upgradeSeed(rec, { roomDir: ROOM });
  assertTrue(r.ok === true, 'ok');
  const restated = (r.restatement_warnings && r.restatement_warnings.length > 0) || (r.check && r.check.errors.indexOf('d00_failed') !== -1);
  assertTrue(restated, 'no restatement signal');
});

leg('Test 6 renderUpgrade never says MECE verified, shows counts, no em dash', function () {
  const rec = clone(RECORDS['consumer-subscription']);
  rec.support = [
    { group: 'Takeaway costs too much for one person', claims: ['Ordering takeaway costs a person who lives alone a lot each week.'] },
    { group: 'Takeaway costs too much each week', claims: ['Takeaway costs add up to a large sum every week for one person.'] },
  ];
  [RECORDS['consumer-subscription'], RECORDS['business-tool'], rec].forEach(function (r0) {
    const r = U.upgradeSeed(r0, { roomDir: ROOM });
    const text = U.renderUpgrade(r);
    assertTrue(typeof text === 'string' && text.length > 0, 'text');
    assertTrue(!/MECE verified/i.test(text), 'MECE verified present');
    assertTrue(text.indexOf(String(r.additions.length) + ' question') !== -1, 'additions count missing');
    assertTrue(text.indexOf(String(r.check.mece.overlap_warnings.length) + ' overlap') !== -1, 'overlap count missing');
    assertTrue(!/[\u2013\u2014]/.test(text), 'dash in text');
  });
  const bad = U.renderUpgrade(U.upgradeSeed({ schema: 'nope' }, {}));
  assertTrue(typeof bad === 'string' && !/MECE verified/i.test(bad) && !/[\u2013\u2014]/.test(bad), 'render of a failed result');
});

leg('Test 7 read-only, 0 network attempts, missing roomDir, bad record', function () {
  const before = hashDir(ROOM);
  const r = U.upgradeSeed(RECORDS['business-tool'], { roomDir: ROOM });
  assertTrue(r.ok === true, 'ok');
  assertTrue(hashDir(ROOM) === before, 'room changed');
  const noRoom = U.upgradeSeed(RECORDS['business-tool'], {});
  assertTrue(noRoom.ok === true && Array.isArray(noRoom.room_evidence) && noRoom.room_evidence.length === 0, 'no roomDir');
  const gone = U.upgradeSeed(RECORDS['business-tool'], { roomDir: path.join(TMP_HOME, 'does-not-exist') });
  assertTrue(gone.ok === true && gone.room_evidence.length === 0, 'absent roomDir');
  const bad = clone(RECORDS['business-tool']);
  bad.support = [{ group: 'only one', claims: ['one'] }];
  const rb = U.upgradeSeed(bad, { roomDir: ROOM });
  assertTrue(rb.ok === false && typeof rb.reason === 'string' && rb.reason.length > 0, 'bad record typed reason');
  const rn = U.upgradeSeed(null, {});
  assertTrue(rn.ok === false && typeof rn.reason === 'string', 'null record');
  assertTrue(guard.attempts() === 0, 'network attempts ' + guard.attempts());
});

leg('Test 8 exports exactly seedToQuestionSet, upgradeSeed, renderUpgrade', function () {
  assertTrue(JSON.stringify(Object.keys(U).sort()) === JSON.stringify(['renderUpgrade', 'seedToQuestionSet', 'upgradeSeed']), Object.keys(U).join(','));
});

if (loadErr) console.log('note: load error :: ' + loadErr);
console.log('--- test-389-full-pyramid ---');
console.log('passed ' + passed + ' failed ' + failed);
process.exit(failed === 0 ? 0 : 1);
