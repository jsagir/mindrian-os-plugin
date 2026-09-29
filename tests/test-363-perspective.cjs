/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 07 -- the research-perspective builder (Scientific Roadmapping
 * engine, D-18 and D-19). Legs S1-S16 pin the seven operations, the two-column
 * limiter sort, catalytic ranking, S-curve reading, the ratchet and the SEED-098
 * reuse contract. Plain node:assert/strict, zero deps. Exit 0 pass / 1 fail / 77 skip.
 * Hyphens only; dash characters are spelled with String.fromCharCode.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
const guard = hygiene.installNetGuard();

const legs = [];
function leg(name, fn) { legs.push({ name, fn }); }

let P = null;
let loadError = null;
try { P = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'perspective.cjs')); } catch (e) { loadError = e; }

// ---------------------------------------------------------------- fixtures
function forumFull() {
  return [
    { role: 'frustrated_insider', pass_order: 1, contributed: ['the incumbents treat the cost floor as fixed'], none_reason: null },
    { role: 'fresh_entrant', pass_order: 2, contributed: ['nobody has tried the cheaper substrate'], none_reason: null },
    { role: 'physics_grounder', pass_order: 3, contributed: ['the thermal limit is real, the cost floor is not'], none_reason: null },
  ];
}
function qsFull() {
  return {
    tension: {
      statement: 'Everyone agrees cheap storage would change this field. Nobody agrees it is reachable this decade.',
      agreed_value: 'cheap storage changes the field',
      disputed_feasibility: 'reachable this decade',
    },
    goal: { target: 'storage cost', unit: 'USD per kWh', threshold: '<= 50', falsifier: 'a pilot at 120 USD per kWh with no learning-rate drop would prove the direction wrong' },
    rung_phrase: { roadmap_type: 'Technical Roadmap', idea_kind: 'programs' },
    forum: forumFull(),
    paths: [
      { id: 'P1', label: 'new electrode chemistry', from_10x: false, raised_by: 'frustrated_insider' },
      { id: 'P2', label: 'grid scheduling software', from_10x: false, raised_by: 'fresh_entrant' },
      { id: 'P3', label: 'resurvey the whole field from scratch', from_10x: true, raised_by: 'physics_grounder' },
    ],
    limiters: [
      { id: 'L1', path_id: 'P1', leaf_id: 'Q1', statement: 'thermal limit on cell density', column: 'physics', derivation_row_id: 'E-D-1', question: null, raised_by: 'physics_grounder' },
      { id: 'L2', path_id: 'P1', leaf_id: 'Q2', statement: 'cost floor of the separator', column: 'assumed', question: 'What if we attacked the separator cost floor, which this field treats as fixed?', raised_by: 'fresh_entrant' },
      { id: 'L3', path_id: 'P2', leaf_id: 'Q3', statement: 'utility tariff structure', column: 'assumed', question: 'What if tariffs were the movable part?', raised_by: 'frustrated_insider' },
    ],
    unlock_chains: [
      { limiter_id: 'L2', steps: [
        { text: 'cheaper separator', pushed_by: 'field', kind: 'field' },
        { text: 'cheaper cells', pushed_by: 'field', kind: 'field' },
        { text: 'utilities adopt', pushed_by: 'field', kind: 'adoption' },
      ] },
      { limiter_id: 'L3', steps: [
        { text: 'we lobby', pushed_by: 'self', kind: 'field' },
        { text: 'tariff shift', pushed_by: 'field', kind: 'field' },
      ] },
    ],
  };
}
const OPTS_SCI = { rung: 'IllDefined', scientific: true, depth: 'full', mode: 'deep' };

function row(id, label, extra) {
  return Object.assign({ row_id: id, leaf_id: 'Q1', record_id: 'W1', claim: 'c', quote: 'q', label, flags: { retracted: false } }, extra || {});
}

// ---------------------------------------------------------------- legs
leg('S1 full scientific fixture passes with engine scientific-roadmapping, depth full', () => {
  const r = P.buildPerspective(qsFull(), OPTS_SCI);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
  assert.equal(r.perspective.engine, 'scientific-roadmapping');
  assert.equal(r.perspective.depth, 'full');
  assert.equal(r.perspective.tension.status, 'ok');
  assert.equal(r.perspective.goal.quantified, true);
  assert.equal(r.perspective.limiters.length, 3);
  assert.equal(r.perspective.ratchet.version, 1);
  // a non-scientific plan gets the constraint-layer engine
  const q = P.buildPerspective(qsFull(), { rung: 'IllDefined', scientific: false, depth: 'full', mode: 'deep' });
  assert.equal(q.perspective.engine, 'constraint-layer');
});

leg('S2 no nameable limiter is a wish, not a plan', () => {
  const q = qsFull(); q.limiters = []; q.unlock_chains = [];
  const r = P.buildPerspective(q, OPTS_SCI);
  assert.equal(r.ok, false);
  assert.equal(r.perspective.tension.status, 'wish');
  assert.ok(r.errors.includes('no_nameable_limiter'));
});

leg('S3 falsifier is required in lite and full; full scientific needs unit and threshold', () => {
  const lite = qsFull(); delete lite.goal.falsifier;
  let r = P.buildPerspective(lite, { rung: 'IllDefined', scientific: false, depth: 'lite', mode: 'quick' });
  assert.ok(r.errors.includes('goal_falsifier_missing'));
  r = P.buildPerspective(lite, OPTS_SCI);
  assert.ok(r.errors.includes('goal_falsifier_missing'));
  const nounit = qsFull(); delete nounit.goal.unit; delete nounit.goal.threshold;
  r = P.buildPerspective(nounit, OPTS_SCI);
  assert.ok(r.errors.includes('goal_not_quantified'));
  assert.equal(r.perspective.goal.quantified, false);
  // lite does not demand quantification
  r = P.buildPerspective(nounit, { rung: 'IllDefined', scientific: false, depth: 'lite', mode: 'quick' });
  assert.ok(!r.errors.includes('goal_not_quantified'));
});

leg('S4 roadmap type versus rung', () => {
  const q = qsFull(); q.rung_phrase.roadmap_type = 'Pipeline';
  let r = P.buildPerspective(q, OPTS_SCI);
  assert.ok(r.warnings.some((w) => w.startsWith('climb_rung_honestly')));
  assert.ok(!r.errors.includes('roadmap_type_invalid'));
  r = P.buildPerspective(q, { rung: 'WellDefined', scientific: true, depth: 'full', mode: 'deep' });
  assert.ok(!r.warnings.some((w) => w.startsWith('climb_rung_honestly')));
  r = P.buildPerspective(qsFull(), { scientific: true, depth: 'full', mode: 'deep' });
  assert.ok(r.warnings.some((w) => w.startsWith('rung_unplaced')));
});

leg('S5 forum: roles, pass order, contribution, tensions kept verbatim', () => {
  let q = qsFull(); q.forum = q.forum.filter((f) => f.role !== 'fresh_entrant');
  let r = P.buildPerspective(q, OPTS_SCI);
  assert.ok(r.errors.includes('forum_role_missing:fresh_entrant'));
  q = qsFull(); q.forum[2].pass_order = 2;
  r = P.buildPerspective(q, OPTS_SCI);
  assert.ok(r.errors.some((e) => e.startsWith('forum_pass_order_duplicate')));
  q = qsFull(); q.forum[1].contributed = []; q.forum[1].none_reason = null;
  r = P.buildPerspective(q, OPTS_SCI);
  assert.ok(r.errors.includes('forum_role_silent:fresh_entrant'));
  q = qsFull(); q.forum[1].contributed = []; q.forum[1].none_reason = 'nothing new to add after pass 1';
  r = P.buildPerspective(q, OPTS_SCI);
  assert.deepEqual(r.errors, []);
  q = qsFull();
  const said = 'The cost floor is physics, not habit.';
  q.forum[2].contradicts = [{ role: 'fresh_entrant', text: said }];
  r = P.buildPerspective(q, OPTS_SCI);
  assert.equal(r.perspective.tensions.length, 1);
  assert.deepEqual(r.perspective.tensions[0].roles.slice().sort(), ['fresh_entrant', 'physics_grounder']);
  assert.equal(r.perspective.tensions[0].text, said);
  // lite does not require a forum
  q = qsFull(); q.forum = [];
  r = P.buildPerspective(q, { rung: 'IllDefined', scientific: false, depth: 'lite', mode: 'quick' });
  assert.ok(!r.errors.some((e) => e.startsWith('forum_')));
});

leg('S6 paths: count, 10X resurvey, MECE overlap', () => {
  let q = qsFull(); q.paths = [q.paths[0]];
  let r = P.buildPerspective(q, OPTS_SCI);
  assert.ok(r.errors.includes('paths_too_few'));
  q = qsFull(); q.paths.forEach((p) => { p.from_10x = false; });
  r = P.buildPerspective(q, OPTS_SCI);
  assert.ok(r.errors.includes('no_10x_resurvey'));
  r = P.buildPerspective(q, { rung: 'IllDefined', scientific: false, depth: 'full', mode: 'deep' });
  assert.ok(!r.errors.includes('no_10x_resurvey'));
  q = qsFull(); q.paths[0].label = 'novel electrode chemistry design'; q.paths[1].label = 'novel electrode chemistry tuning';
  r = P.buildPerspective(q, OPTS_SCI);
  assert.ok(r.warnings.some((w) => w.startsWith('paths_mece:') && /overlap/i.test(w)));
});

leg('S7 limiters: physics needs a derivation reference; assumed needs a question', () => {
  let q = qsFull(); delete q.limiters[0].derivation_row_id;
  let r = P.buildPerspective(q, OPTS_SCI);
  const l1 = r.perspective.limiters.find((l) => l.id === 'L1');
  assert.equal(l1.column, 'assumed');
  assert.ok(r.warnings.some((w) => w.startsWith('physics_without_derivation_filed_as_assumed')));
  // the coerced limiter carries no question here, so it also fails the question rule
  assert.ok(r.errors.includes('assumed_limiter_question_missing:L1'));
  q.limiters[0].question = 'What if the thermal limit is assumed?';
  r = P.buildPerspective(q, OPTS_SCI);
  assert.deepEqual(r.errors, []);
  // a derivation claim is a reference
  q = qsFull(); delete q.limiters[0].derivation_row_id; q.limiters[0].derivation_claim = 'Carnot bound gives 1.2 kW per litre';
  r = P.buildPerspective(q, OPTS_SCI);
  assert.equal(r.perspective.limiters.find((l) => l.id === 'L1').column, 'physics');
  // assumed without a question fails
  q = qsFull(); q.limiters[1].question = '';
  r = P.buildPerspective(q, OPTS_SCI);
  assert.ok(r.errors.includes('assumed_limiter_question_missing:L2'));
  // unclear is assumed
  q = qsFull(); q.limiters[1].column = 'unclear';
  r = P.buildPerspective(q, OPTS_SCI);
  assert.equal(r.perspective.limiters.find((l) => l.id === 'L2').column, 'assumed');
});

leg('S8 rankByUnlock: self-pushed do not count, adoption counts, tie-break', () => {
  const p = {
    limiters: [
      { id: 'A', column: 'assumed' }, { id: 'B', column: 'assumed' }, { id: 'C', column: 'assumed' }, { id: 'D', column: 'assumed' },
    ],
    unlock_chains: [
      { limiter_id: 'A', steps: [{ text: 'x', pushed_by: 'self', kind: 'field' }, { text: 'y', pushed_by: 'self', kind: 'field' }, { text: 'z', pushed_by: 'self', kind: 'field' }] },
      { limiter_id: 'B', steps: [{ text: 'x', pushed_by: 'field', kind: 'field' }, { text: 'y', pushed_by: 'field', kind: 'adoption' }] },
      { limiter_id: 'C', steps: [{ text: 'x', pushed_by: 'field', kind: 'field' }, { text: 'y', pushed_by: 'field', kind: 'field' }] },
      { limiter_id: 'D', steps: [{ text: 'x', pushed_by: 'field', kind: 'field' }, { text: 'y', pushed_by: 'field', kind: 'field' }] },
    ],
  };
  const rank = P.rankByUnlock(p, { supportByLimiter: { B: 3, C: 1, D: 1 } });
  const byId = Object.fromEntries(rank.map((r) => [r.limiter_id, r]));
  assert.equal(byId.A.length, 0);
  assert.equal(byId.B.length, 2);
  // B (support 3) sorts after C and D (support 1) at the same length: weakest support first, then id
  assert.deepEqual(rank.map((r) => r.limiter_id), ['C', 'D', 'B', 'A']);
  assert.equal(rank[0].rank, 1);
});

leg('S9 classifyLimiter', () => {
  const lim = { id: 'L1', leaf_id: 'Q1', statement: 's', column: 'assumed' };
  let c = P.classifyLimiter(lim, [row('E-D-1', 'derivation')]);
  assert.equal(c.column, 'physics');
  assert.deepEqual(c.basis_row_ids, ['E-D-1']);
  c = P.classifyLimiter(lim, [row('E-R-1', 'retest')]);
  assert.equal(c.column, 'assumed');
  assert.equal(c.reason, 're_tested');
  c = P.classifyLimiter(lim, []);
  assert.equal(c.column, 'assumed');
  assert.equal(c.reason, 'unclear_filed_as_assumed');
  assert.equal(c.s_curve, 'unknown');
  c = P.classifyLimiter(lim, [row('E-S-1', 'scurve_ceiling')]);
  assert.equal(c.s_curve, 'near_ceiling');
  assert.equal(c.advice, 'route_around');
  c = P.classifyLimiter(lim, [row('E-S-2', 'scurve_headroom')]);
  assert.equal(c.s_curve, 'headroom');
  assert.equal(c.advice, 'push');
  c = P.classifyLimiter(lim, [row('E-S-1', 'scurve_ceiling'), row('E-S-2', 'scurve_headroom')]);
  assert.equal(c.s_curve, 'contested');
  // a diffusion timing leaf row with a scurve label counts the same
  c = P.classifyLimiter(lim, [row('E-T-1', 'scurve_ceiling', { leaf_id: 'Q1', lens: 'df.timing' })]);
  assert.equal(c.s_curve, 'near_ceiling');
  // retracted rows are ignored
  c = P.classifyLimiter(lim, [row('E-D-9', 'derivation', { flags: { retracted: true } }), row('E-S-9', 'scurve_ceiling', { flags: { retracted: true } })]);
  assert.equal(c.column, 'assumed');
  assert.equal(c.s_curve, 'unknown');
  assert.deepEqual(c.basis_row_ids, []);
});

leg('S10 nextBindingConstraint', () => {
  const r = P.buildPerspective(qsFull(), OPTS_SCI);
  const n = P.nextBindingConstraint(r.perspective);
  assert.equal(n.id, 'L2');
  assert.equal(r.perspective.next_binding_constraint, 'L2');
  const done = JSON.parse(JSON.stringify(r.perspective));
  done.limiters.forEach((l) => { if (l.id === 'L2' || l.id === 'L3') l.resolved = true; });
  assert.equal(P.nextBindingConstraint(done), null);
  const physOnly = JSON.parse(JSON.stringify(r.perspective));
  physOnly.limiters.forEach((l) => { l.column = 'physics'; });
  assert.equal(P.nextBindingConstraint(physOnly), null);
});

leg('S11 nextVersion carries the ratchet forward', () => {
  const built = P.buildPerspective(qsFull(), OPTS_SCI).perspective;
  built.ratchet.discarded.push({ id: 'P9', kind: 'path', reason: 'funded attractor only', version: 1 });
  const plan = { plan_hash: 'abc123', perspective: built };
  const next = P.nextVersion(plan, {
    run_id: 'R-20260929-01',
    classifications: [
      { limiter_id: 'L1', column: 'physics', basis_row_ids: ['E-D-1'], s_curve: 'unknown', advice: 'unknown', reason: 'validated_derivation' },
      { limiter_id: 'L2', column: 'assumed', basis_row_ids: [], s_curve: 'unknown', advice: 'unknown', reason: 'unclear_filed_as_assumed' },
    ],
  });
  assert.equal(next.version, 2);
  assert.equal(next.parent_plan_hash, 'abc123');
  assert.equal(next.discarded.length, 1);
  assert.equal(next.discarded[0].reason, 'funded attractor only');
  assert.equal(next.settled.length, 1);
  assert.equal(next.settled[0].limiter_key, P.limiterKey('thermal limit on cell density'));
  assert.deepEqual(next.settled[0].evidence, ['E-D-1']);
  assert.equal(next.settled[0].run_ref, 'R-20260929-01');
  assert.equal(next.settled[0].column, 'physics');
  // the input plan is not mutated
  assert.equal(plan.perspective.ratchet.settled.length, 0);
});

leg('S12 loadSettled and the no-reopen rule', () => {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'p363-07-'));
  try {
    const key = P.limiterKey('thermal limit on cell density');
    const mk = (slug, settled, raw) => {
      const d = path.join(room, 'research', slug);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'plan.json'), raw !== undefined ? raw : JSON.stringify({ perspective: { ratchet: { version: 2, settled } } }));
    };
    mk('2026-09-01-a', [{ limiter_key: key, column: 'physics', evidence: ['E-D-1'], run_ref: 'R-1' }]);
    mk('2026-09-02-b', [{ limiter_key: 'zzz111', column: 'assumed', evidence: ['E-R-2'], run_ref: 'R-2' }]);
    mk('2026-09-03-bad', null, '{not json');
    const settled = P.loadSettled(room);
    assert.equal(settled.length, 2);
    assert.ok(settled.every((s) => typeof s.run_ref === 'string'));
    assert.deepEqual(P.loadSettled(path.join(room, 'nope')), []);
    // reopening without new evidence fails
    let r = P.buildPerspective(qsFull(), Object.assign({ settled }, OPTS_SCI));
    assert.ok(r.errors.includes('reopen_settled_without_new_evidence:L1'));
    // new evidence not already in the settled set passes
    const q = qsFull(); q.limiters[0].new_evidence = ['E-D-77'];
    r = P.buildPerspective(q, Object.assign({ settled }, OPTS_SCI));
    assert.ok(!r.errors.some((e) => e.startsWith('reopen_settled')));
    assert.equal(r.perspective.limiters.find((l) => l.id === 'L1').settled_ref, 'R-1');
    // the same evidence ids as before is not new evidence
    const q2 = qsFull(); q2.limiters[0].new_evidence = ['E-D-1'];
    r = P.buildPerspective(q2, Object.assign({ settled }, OPTS_SCI));
    assert.ok(r.errors.includes('reopen_settled_without_new_evidence:L1'));
  } finally { fs.rmSync(room, { recursive: true, force: true }); }
});

leg('S13 limiterKey is stable across case, punctuation and word order', () => {
  const a = P.limiterKey('Thermal limit, on cell density!');
  assert.equal(a, P.limiterKey('cell DENSITY on thermal limit'));
  assert.notEqual(a, P.limiterKey('thermal limit on cell voltage'));
  assert.match(a, /^[0-9a-f]{16}$/);
});

leg('S14 srStepGuide: ledger when present, local template otherwise', () => {
  const local = P.srStepGuide(null);
  assert.equal(local.source, 'local_template');
  assert.equal(local.steps.length, 7);
  assert.deepEqual(local.steps.map((s) => s.name), Array.from(P.SR_OPERATIONS));
  assert.deepEqual(P.SR_OPERATIONS.slice(0, 2), ['Tension Qualification', 'Goal Quantification']);
  const ledger = { frameworks: { 'Scientific Roadmapping': { steps: [
    { order: 1, name: 'Tension Qualification', key_question: 'Does the field agree it matters?', gates: ['a nameable limiter'] },
    { order: 2, name: 'Goal Quantification', key_question: 'What number, with what unit?', gates: ['a falsifier'] },
  ] } } };
  const g = P.srStepGuide(ledger);
  assert.equal(g.source, 'ledger');
  assert.equal(g.steps.length, 7);
  assert.equal(g.steps[0].key_question, 'Does the field agree it matters?');
  assert.deepEqual(g.steps[1].gates, ['a falsifier']);
  assert.equal(g.steps[2].name, 'Rung Placement and Type Selection');
  assert.ok(g.steps[2].key_question.length > 0);
});

leg('S15 describeEngine is the SEED-098 reuse contract', () => {
  const d = P.describeEngine();
  assert.equal(d.template_id, 'scientific-roadmapping');
  assert.equal(d.operations.length, 7);
  assert.equal(d.forum_roles.length, 3);
  assert.equal(d.api_version, '1');
  assert.ok(Object.isFrozen(P.ENGINES));
  assert.ok(Object.isFrozen(P.SR_OPERATIONS));
  assert.ok(Object.isFrozen(P.FORUM_ROLES));
});

leg('S16 no brain-client, no network module, no dash characters', () => {
  const file = path.join(ROOT, 'lib', 'core', 'research-planner', 'perspective.cjs');
  const src = fs.readFileSync(file, 'utf8');
  const reqs = Array.from(src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)).map((m) => m[1]);
  assert.ok(reqs.length > 0);
  for (const r of reqs) {
    assert.ok(!/brain-client|research-corpus|fetch|http|https|net|undici|axios/.test(r), 'forbidden require: ' + r);
  }
  assert.ok(!/globalThis\.fetch|\bfetch\(/.test(src));
  const em = String.fromCharCode(0x2014);
  const en = String.fromCharCode(0x2013);
  assert.ok(!src.includes(em) && !src.includes(en));
});

// ---------------------------------------------------------------- runner
let failed = 0;
if (loadError) {
  console.log('FAIL  module load: ' + loadError.message);
  for (const l of legs) console.log('FAIL  ' + l.name + ' (module absent)');
  console.log('\n' + legs.length + ' legs, ' + legs.length + ' failed');
  process.exit(1);
}
for (const l of legs) {
  try { l.fn(); console.log('PASS  ' + l.name); } catch (e) { failed += 1; console.log('FAIL  ' + l.name + '\n      ' + (e && e.message)); }
}
if (guard.attempts() !== 0) { failed += 1; console.log('FAIL  net guard: ' + guard.attempts() + ' fetch attempts'); }
guard.restore();
console.log('\n' + legs.length + ' legs, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
