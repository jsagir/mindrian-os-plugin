'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 08 -- query-family composer. Legs F1-F11.
 *
 * Pure functions; no room, no network. No em-dash or en-dash in this file:
 * checks spell those characters through String.fromCharCode.
 * Exit 0 pass, 1 fail, 77 skip.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
hygiene.installNetGuard();
const { check, summary } = hygiene.makeChecker('363-08 families');

const ROOT = path.resolve(__dirname, '..');
const FAMILIES_FILE = path.join(ROOT, 'lib', 'core', 'research-planner', 'families.cjs');

let F = null;
let loadError = null;
try {
  F = require(FAMILIES_FILE);
} catch (e) {
  loadError = e;
}

function assertTrue(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (a !== b) throw new Error((msg || 'not equal') + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b)); }
function leg(name, fn) {
  try {
    if (loadError) throw new Error('module load failed: ' + String(loadError.message).slice(0, 120));
    const res = fn();
    if (res === false) check(name, false, 'returned false');
    else check(name, true);
  } catch (e) {
    check(name, false, String(e && e.message ? e.message : e).slice(0, 200));
  }
}
function sha(q) { return 'sha256:' + crypto.createHash('sha256').update(q, 'utf8').digest('hex'); }

const WS_SLOTS = { term: 'acoustic biofilm disruption', synonyms: ['sonic biofilm removal', 'ultrasonic biofilm control'] };

leg('F1 FAMILIES has exactly the five ids, each template with id, role, render', function () {
  const ids = Object.keys(F.FAMILIES).sort();
  eq(ids.join(','), ['causal-link/v1', 'concept-evidence/v1', 'constraint-interrogation/v1', 'diffusion/v1', 'whitespace-gap/v1'].join(','));
  ids.forEach(function (id) {
    const fam = F.FAMILIES[id];
    assertTrue(Array.isArray(fam.templates) && fam.templates.length > 0, 'templates ' + id);
    fam.templates.forEach(function (t) {
      assertTrue(typeof t.id === 'string' && typeof t.role === 'string' && typeof t.render === 'function', 'template shape ' + t.id);
    });
  });
  assertTrue(Object.isFrozen(F.FAMILIES), 'frozen');
  assertTrue(typeof F.SLOT_RULES === 'object', 'SLOT_RULES exported');
});

leg('F2 whitespace-gap composes four queries with the exact expected bytes', function () {
  const r = F.composeFamily('whitespace-gap/v1', WS_SLOTS);
  eq(r.ok, true, 'ok');
  const qs = r.queries.map(function (x) { return x.q; });
  eq(qs.length, 4, 'four queries');
  eq(qs[0], '"acoustic biofilm disruption"');
  eq(qs[1], '"acoustic biofilm disruption" OR "sonic biofilm removal" OR "ultrasonic biofilm control"');
  eq(qs[2], '"acoustic biofilm disruption" AND (review OR survey OR "systematic review")');
  eq(qs[3], '"acoustic biofilm disruption" AND (limitation OR barrier OR infeasible)');
  eq(r.queries.map(function (x) { return x.template_id; }).join(','), 'ws.exact,ws.synonym_cover,ws.prior_attempts,ws.absence_reason');
  eq(r.queries.map(function (x) { return x.role; }).join(','), 'primary,falsifier_covered_elsewhere,falsifier_tried_before,context');
});

leg('F3 each query carries q_hash, audit pass, family, template_id, role, slot_terms', function () {
  const r = F.composeFamily('whitespace-gap/v1', WS_SLOTS);
  r.queries.forEach(function (x) {
    eq(x.q_hash, sha(x.q), 'q_hash');
    eq(x.q_hash, F.qHash(x.q), 'qHash export');
    eq(x.audit, 'not_applicable', 'web line: no policy audit (369.2-05)');
    eq(x.family, 'whitespace-gap/v1');
    assertTrue(typeof x.template_id === 'string' && typeof x.role === 'string', 'ids');
    assertTrue(Array.isArray(x.slot_terms) && x.slot_terms.indexOf('acoustic biofilm disruption') >= 0, 'slot_terms has term');
    assertTrue(x.q.length <= 200 && !/[\r\n]/.test(x.q), 'length/newline');
  });
  const syn = r.queries[1].slot_terms;
  assertTrue(syn.indexOf('sonic biofilm removal') >= 0 && syn.indexOf('ultrasonic biofilm control') >= 0, 'synonyms listed');
  // 369.2-05, ruling 2026-10-05: the web lines are not policy-gated; the Part 8 fence is the Theo line only.
  const theo = F.composeFamily('whitespace-gap/v1', WS_SLOTS, { destination: 'theo' });
  eq(theo.queries[0].audit, 'pass', 'theo destination keeps the Part 8 audit');
});

leg('F4 the other four families compose ok within 200 chars', function () {
  const cases = [
    ['concept-evidence/v1', { term: 'graph retrieval', term2: 'context windows' }, 5],
    ['causal-link/v1', { cause: 'sleep loss', effect: 'memory decline' }, 2],
    ['constraint-interrogation/v1', { limiter: 'battery energy density' }, 4],
    ['diffusion/v1', { technology: 'solid state batteries' }, 4],
  ];
  cases.forEach(function (c) {
    const r = F.composeFamily(c[0], c[1]);
    eq(r.ok, true, c[0]);
    eq(r.queries.length, c[2], c[0] + ' count');
    r.queries.forEach(function (x) { assertTrue(x.q.length <= 200, 'len'); });
  });
  const ci = F.composeFamily('constraint-interrogation/v1', { limiter: 'battery energy density' });
  eq(ci.queries[0].q, '"battery energy density" AND ("fundamental limit" OR "theoretical limit" OR bound)');
  const df = F.composeFamily('diffusion/v1', { technology: 'solid state batteries' });
  eq(df.queries[3].q, '"solid state batteries" AND ("S-curve" OR "adoption rate" OR "technology readiness")');
  const cl = F.composeFamily('causal-link/v1', { cause: 'sleep loss', effect: 'memory decline' });
  eq(cl.queries[1].q, '"sleep loss" AND "memory decline" AND (confound OR "no association" OR "not associated")');
});

leg('F5 egress violation (theo destination) returns local-only with no echo; the same slot composes on the web line', function () {
  // 369.2-05, ruling 2026-10-05: the web lines are not policy-gated; the Part 8 fence is the Theo line only.
  const bad = ['reach me at a.person@example.com', 'a $5M market', 'Acme Corp thermal design'];
  bad.forEach(function (v) {
    const w = F.composeFamily('whitespace-gap/v1', { term: v });
    eq(w.ok, true, 'web line composes the slot');
    assertTrue(w.queries[0].q.indexOf(v) >= 0, 'web query carries the slot as written');
    const r = F.composeFamily('whitespace-gap/v1', { term: v }, { destination: 'theo' });
    eq(r.ok, false);
    eq(r.degrade, 'local-only');
    eq(r.reason, 'egress_violation');
    eq(r.family, 'whitespace-gap/v1');
    assertTrue('template_id' in r, 'template_id key present');
    const json = JSON.stringify(r);
    assertTrue(json.indexOf(v) < 0, 'value echoed');
    assertTrue(json.indexOf('example.com') < 0 && json.indexOf('5M') < 0 && json.indexOf('Acme') < 0, 'fragment echoed');
  });
});

leg('F6 slot rule violations return bad_slot without echo', function () {
  const long81 = 'a'.repeat(81);
  const terms = ['has "quote" inside', 'line\nbreak', 'paren (inside)', 'cats OR dogs', 'cats and dogs', 'not this', 'x', long81, 'back\\slash'];
  // MOVED 2026-10-04 (SEED-115, quick v16): the strict list still holds for a theo destination (Part 8);
  // on a web destination only too-short, over-cap (201) and control-character values are bad_slot.
  const webBad = ['x', 'a'.repeat(201), 'bad' + String.fromCharCode(7) + 'char'];
  webBad.forEach(function (v) {
    const w = F.composeFamily('whitespace-gap/v1', { term: v });
    eq(w.ok, false, 'web refused: ' + JSON.stringify(v).slice(0, 20));
    eq(w.reason, 'bad_slot');
  });
  terms.forEach(function (v) {
    const r = F.composeFamily('whitespace-gap/v1', { term: v }, { destination: 'theo' });
    eq(r.ok, false, 'refused: ' + JSON.stringify(v).slice(0, 20));
    eq(r.reason, 'bad_slot');
    eq(r.degrade, 'local-only');
    const json = JSON.stringify(r);
    assertTrue(json.indexOf(v) < 0 || v.length < 4, 'echo');
  });
  const r4 = F.composeFamily('whitespace-gap/v1', { term: 'acoustic biofilm', synonyms: ['a1', 'b2', 'c3', 'd4'] });
  eq(r4.reason, 'bad_slot', '4 synonyms');
  const r0 = F.composeFamily('whitespace-gap/v1', { term: 'acoustic biofilm', synonyms: [] });
  eq(r0.reason, 'bad_slot', '0 synonyms');
  const rd = F.composeFamily('whitespace-gap/v1', { term: 'acoustic biofilm', synonyms: ['same one', 'same one'] });
  eq(rd.reason, 'bad_slot', 'duplicate synonyms');
  const rm = F.composeFamily('causal-link/v1', { cause: 'sleep loss' });
  eq(rm.reason, 'bad_slot', 'missing effect');
  const ru = F.composeFamily('diffusion/v1', { technology: 'solid state', extra: 'nope' });
  eq(ru.reason, 'bad_slot', 'unknown slot');
});

leg('F7 unknown family refused; template subset composes only listed ids', function () {
  const r = F.composeFamily('nope/v9', { term: 'abc def' });
  eq(r.ok, false);
  eq(r.reason, 'unknown_family');
  eq(r.degrade, 'local-only');
  const s = F.composeFamily('whitespace-gap/v1', WS_SLOTS, { templateIds: ['ws.exact', 'ws.absence_reason'] });
  eq(s.ok, true);
  eq(s.queries.map(function (x) { return x.template_id; }).join(','), 'ws.exact,ws.absence_reason');
  const u = F.composeFamily('whitespace-gap/v1', WS_SLOTS, { templateIds: ['ws.exact', 'ce.exact'] });
  eq(u.ok, false, 'unknown template id refused');
  eq(u.reason, 'unknown_template');
});

leg('F8 injected auditFn (theo destination): once per slot value then once per composed string; throw maps to egress_violation; zero calls on the web line', function () {
  // 369.2-05, ruling 2026-10-05: the web lines are not policy-gated; the Part 8 fence is the Theo line only.
  const webCalls = [];
  const w = F.composeFamily('whitespace-gap/v1', WS_SLOTS, { templateIds: ['ws.exact', 'ws.synonym_cover'], auditFn: function (s) { webCalls.push(s); return s; } });
  eq(w.ok, true);
  eq(webCalls.length, 0, 'the web line runs no audit function');
  const calls = [];
  const r = F.composeFamily('whitespace-gap/v1', WS_SLOTS, {
    destination: 'theo',
    templateIds: ['ws.exact', 'ws.synonym_cover'],
    auditFn: function (s, surface) { calls.push(s); eq(surface, 'research-planner'); return s; },
  });
  eq(r.ok, true);
  eq(calls.length, 3 + 2, 'three slot values plus two strings');
  eq(calls[0], 'acoustic biofilm disruption');
  eq(calls[1], 'sonic biofilm removal');
  eq(calls[2], 'ultrasonic biofilm control');
  eq(calls[3], '"acoustic biofilm disruption"');
  let n = 0;
  const t = F.composeFamily('whitespace-gap/v1', WS_SLOTS, {
    destination: 'theo',
    auditFn: function (s) { n += 1; if (n === 4) throw new Error('boom ' + s); return s; },
  });
  eq(t.ok, false);
  eq(t.reason, 'egress_violation');
  eq(t.template_id, 'ws.exact', 'string-level failure names the template');
  assertTrue(JSON.stringify(t).indexOf('boom') < 0 && JSON.stringify(t).indexOf('acoustic') < 0, 'no echo');
});

leg('F9 composeForLeaf maps lens ids to families and returns round-one queries', function () {
  const a = F.composeForLeaf({ lens: 'ws.gap', slots: WS_SLOTS }, { round: 1 });
  eq(a.ok, true);
  eq(a.family, 'whitespace-gap/v1');
  assertTrue(a.queries.length >= 2 && a.queries.every(function (x) { return x.round === 1; }), 'round one');
  eq(a.queries[0].template_id, 'ws.exact');
  const b = F.composeForLeaf({ lens: 'ci.derivation', slots: { limiter: 'battery energy density' } });
  eq(b.ok, true);
  eq(b.family, 'constraint-interrogation/v1');
  eq(b.queries[0].template_id, 'ci.derivation');
  const c = F.composeForLeaf({ lens: 'zz.unknown', slots: { term: 'abc def' } });
  eq(c.ok, false);
  eq(c.reason, 'unknown_lens');
  // every lens id 363-06 declares is covered
  const lensIds = ['ws.gap', 'ws.covered_elsewhere', 'ws.extraction', 'mu.verify', 'mu.blind_spot', 'mu.reveal', 'rc.why_link', 'rc.6m',
    'hat.white', 'hat.black', 'hat.yellow', 'hat.green', 'df.first_adopters', 'df.absorptive_capacity', 'df.civil_defense_crossing',
    'df.timing', 'ci.derivation', 'ci.retest', 'ci.scurve', 'ci.prior_attack'];
  lensIds.forEach(function (id) {
    assertTrue(F.LENS_FAMILY[id] && F.FAMILIES[F.LENS_FAMILY[id].family], 'LENS_FAMILY covers ' + id);
    F.LENS_FAMILY[id].templates.forEach(function (tid) {
      const fam = F.FAMILIES[F.LENS_FAMILY[id].family];
      assertTrue(fam.templates.some(function (t) { return t.id === tid; }), 'template exists ' + tid);
    });
  });
});

leg('F10 isRawQueryEdit and slotTerms', function () {
  eq(F.isRawQueryEdit({ q: 'x' }), true);
  eq(F.isRawQueryEdit({ question: 'a real question' }), false);
  eq(F.isRawQueryEdit(null), false);
  const r = F.composeFamily('whitespace-gap/v1', WS_SLOTS);
  const terms = F.slotTerms(r.queries);
  eq(terms.length, 3, 'distinct');
  assertTrue(terms.indexOf('acoustic biofilm disruption') >= 0, 'term');
});

leg('F11 deterministic, and the module performs no I/O', function () {
  const a = F.composeFamily('whitespace-gap/v1', WS_SLOTS);
  const b = F.composeFamily('whitespace-gap/v1', WS_SLOTS);
  eq(JSON.stringify(a), JSON.stringify(b));
  const src = fs.readFileSync(FAMILIES_FILE, 'utf8');
  assertTrue(!/require\(['"](node:)?(fs|https?|net|child_process)['"]\)/.test(src), 'no io require');
  assertTrue(!/\bfetch\s*\(/.test(src), 'no fetch');
  assertTrue(!/brain-client/.test(src), 'no brain-client');
  assertTrue(src.indexOf(String.fromCharCode(0x2014)) < 0 && src.indexOf(String.fromCharCode(0x2013)) < 0, 'no dashes');
});

process.exit(summary());
