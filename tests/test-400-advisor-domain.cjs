#!/usr/bin/env node
'use strict';
// Phase 400 plan 09 (CY-05): the advisor knows the room's cause and effect domain without a second ranker.
// Legs A1 to A9: the domain-aware key, the in-band reorder, chaotic and disorder, the unknown domain floor.
// Legs P1 to P7: the domain line and the host notes in present.cjs; no number leaves present.cjs.
// Node built-ins only. No network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// The advisor is opt-in. Set the env before the modules load.
process.env.MINDRIAN_DECISION_ADVISOR = 'on';
delete process.env.MINDRIAN_DECISION_ADVISOR_TABLE;

const ROOT = path.resolve(__dirname, '..');
const ADV = path.join(ROOT, 'lib', 'core', 'decision-advisor');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', '400', 'domain-table.json');
const SHIPPED = path.join(ROOT, 'data', 'decision-advisor-table.json');

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

function load(file) {
  try { return require(file); } catch (e) { return { _loadError: e }; }
}
const S = load(path.join(ADV, 'shortlist.cjs'));
const D = load(path.join(ADV, 'domain.cjs'));
const AXES = require(path.join(ROOT, 'lib', 'core', 'problem-axes.cjs'));
const VOCAB = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'job-vocabulary.json'), 'utf8')).ids;

function needDomain() {
  if (D._loadError) throw new Error('domain.cjs does not load: ' + D._loadError.message);
}

function withTable(file, fn) {
  const saved = process.env.MINDRIAN_DECISION_ADVISOR_TABLE;
  if (file) process.env.MINDRIAN_DECISION_ADVISOR_TABLE = file;
  else delete process.env.MINDRIAN_DECISION_ADVISOR_TABLE;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.MINDRIAN_DECISION_ADVISOR_TABLE;
    else process.env.MINDRIAN_DECISION_ADVISOR_TABLE = saved;
  }
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'test-400-09-'));
const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

const LEVELS = [null].concat(AXES.DEFINITION_LEVELS);
const JUNK = [undefined, null, '', 'Complex', 'confused'];

// ---- A1 ----
check('A1 an unknown domain gives exactly the no-domain lookup, on the shipped table and on the fixture table', () => {
  assert.equal(VOCAB.length, 20, 'fixture: 20 vocabulary jobs');
  let compared = 0;
  for (const table of [SHIPPED, FIXTURE]) {
    withTable(table, () => {
      for (const job of VOCAB) {
        for (const level of LEVELS) {
          const plain = S.lookupShortlist({ jobId: job, definitionLevel: level, lastCommand: null });
          for (const ce of JUNK) {
            // The key is present in every case, the value undefined included.
            const q = { jobId: job, definitionLevel: level, lastCommand: null, causeEffect: ce };
            assert.deepEqual(S.lookupShortlist(q), plain, job + ' ' + level + ' ' + String(ce));
            assert.equal(S.scoreFor(q, '/mos:bono'), S.scoreFor({ jobId: job, definitionLevel: level, lastCommand: null }, '/mos:bono'));
            compared += 1;
          }
        }
      }
    });
  }
  assert.equal(compared, 2 * 20 * 4 * 5);
  // Positive control: the shipped table has rows, so the comparison is not vacuous.
  const r = withTable(SHIPPED, () => S.lookupShortlist({ jobId: 'explore' }));
  assert.equal(r.key_used, 'explore|*|*');
  assert.equal(Object.prototype.hasOwnProperty.call(r, 'domain'), false);
});

// ---- A2 ----
const FULL_KEYS = [
  'explore|ill-defined|complex|/mos:dashboard',
  'explore|ill-defined|*|/mos:dashboard',
  'explore|ill-defined|complex|*',
  'explore|ill-defined|*|*',
  'explore|*|complex|/mos:dashboard',
  'explore|*|*|/mos:dashboard',
  'explore|*|complex|*',
  'explore|*|*|*',
];
check('A2 a 4-part table tries the 8 keys with the domain first, then without it; key_used names the first hit', () => {
  needDomain();
  const q = { jobId: 'explore', definitionLevel: 'ill-defined', causeEffect: 'complex', lastCommand: '/mos:dashboard' };
  for (let i = 0; i < FULL_KEYS.length; i += 1) {
    const t = JSON.parse(JSON.stringify(fixture));
    for (let j = 0; j < i; j += 1) delete t.rows[FULL_KEYS[j]];
    const file = path.join(scratch, 'a2-' + i + '.json');
    fs.writeFileSync(file, JSON.stringify(t));
    const r = withTable(file, () => S.lookupShortlist(q));
    assert.equal(r.key_used, FULL_KEYS[i], 'step ' + i);
    assert.equal(withTable(file, () => S.scoreFor(q, '/mos:bono')), 0.9, 'scoreFor step ' + i);
  }
  // No domain: only the 4 domain-free keys of the same shape.
  const FREE = FULL_KEYS.filter((k) => k.split('|')[2] === '*');
  const q0 = { jobId: 'explore', definitionLevel: 'ill-defined', lastCommand: '/mos:dashboard' };
  for (let i = 0; i < FREE.length; i += 1) {
    const t = JSON.parse(JSON.stringify(fixture));
    for (let j = 0; j < i; j += 1) delete t.rows[FREE[j]];
    const file = path.join(scratch, 'a2-free-' + i + '.json');
    fs.writeFileSync(file, JSON.stringify(t));
    assert.equal(withTable(file, () => S.lookupShortlist(q0)).key_used, FREE[i], 'free step ' + i);
  }
  // Only domain rows left: no domain finds no row.
  const t = JSON.parse(JSON.stringify(fixture));
  for (const k of FREE) delete t.rows[k];
  const file = path.join(scratch, 'a2-domain-only.json');
  fs.writeFileSync(file, JSON.stringify(t));
  assert.equal(withTable(file, () => S.lookupShortlist(q0)).state, 'no_row');
  // A 3-part table keeps the 399 key list, with or without a domain.
  const r3 = withTable(SHIPPED, () => S.lookupShortlist({ jobId: 'explore', definitionLevel: 'ill-defined', causeEffect: 'complex', lastCommand: '/mos:dashboard' }));
  assert.equal(r3.key_used, 'explore|*|*');
});

const onFixture = (q) => withTable(FIXTURE, () => S.lookupShortlist(q));
const names = (r) => r.options.map((o) => o.command);

// ---- A3 ----
check('A3 complex puts the methodology probe first inside the strong band; bands, values and the possible tail stay', () => {
  needDomain();
  const plain = onFixture({ jobId: 'validate-idea' });
  const r = onFixture({ jobId: 'validate-idea', causeEffect: 'complex' });
  assert.deepEqual(names(plain), ['/mos:explain-decision', '/mos:beautiful-question', '/mos:bono', '/mos:jtbd']);
  assert.deepEqual(names(r), ['/mos:beautiful-question', '/mos:explain-decision', '/mos:bono', '/mos:jtbd']);
  assert.deepEqual(r.options.map((o) => o.rank), [1, 2, 3, 4]);
  for (const o of r.options) {
    const p = plain.options.find((x) => x.command === o.command);
    assert.equal(o.band, p.band, o.command + ' band');
    assert.equal(o.calibrated, p.calibrated, o.command + ' value');
  }
  assert.equal(r.state, 'ok');
  assert.equal(r.top_tie, plain.top_tie);
  assert.deepEqual(r.domain, { id: 'complex', effect: 'reordered', fits: ['/mos:beautiful-question'] });
  // The input shortlist is not changed.
  const before = JSON.stringify(plain);
  D.applyDomain(plain, 'complex');
  assert.equal(JSON.stringify(plain), before);
  // complicated: the methodology analyze option rises over the utility analyze option.
  const c = onFixture({ jobId: 'validate-idea', causeEffect: 'complicated' });
  assert.deepEqual(names(c), ['/mos:bono', '/mos:explain-decision', '/mos:beautiful-question', '/mos:jtbd']);
  assert.deepEqual(c.domain.fits, ['/mos:bono']);
});

// ---- A4 ----
check('A4 a utility command whose move_type equals the domain move is not a fit; possible and weak options never rise', () => {
  needDomain();
  assert.equal(D.fitsDomain('/mos:eureka', 'complex'), false, 'utility probe');
  assert.equal(D.fitsDomain('/mos:beautiful-question', 'complex'), true, 'methodology probe');
  assert.equal(D.capabilityLabels()['/mos:eureka'].kind, 'utility');
  const plain = onFixture({ jobId: 'compare-options' });
  const r = onFixture({ jobId: 'compare-options', causeEffect: 'complex' });
  assert.deepEqual(names(r), names(plain));
  assert.deepEqual(names(r), ['/mos:bono', '/mos:eureka', '/mos:explore-trends', '/mos:find-connections']);
  assert.deepEqual(r.domain, { id: 'complex', effect: 'no_change', fits: [] });
});

// ---- A5 ----
check('A5 a top tie of 2 keeps the order; effect tie_kept', () => {
  needDomain();
  const plain = onFixture({ jobId: 'decide-pursue' });
  const r = onFixture({ jobId: 'decide-pursue', causeEffect: 'complex' });
  assert.equal(plain.top_tie, 2);
  assert.deepEqual(r.options, plain.options);
  assert.equal(r.top_tie, 2);
  assert.deepEqual(r.domain, { id: 'complex', effect: 'tie_kept' });
});

// ---- A6 ----
check('A6 chaotic on a row with a strong pick gives an honest no strong pick; options unchanged', () => {
  needDomain();
  const plain = onFixture({ jobId: 'validate-idea' });
  const r = onFixture({ jobId: 'validate-idea', causeEffect: 'chaotic' });
  assert.equal(plain.state, 'ok');
  assert.equal(r.state, 'no_strong_pick');
  assert.equal(r.no_strong_pick, true);
  assert.deepEqual(r.options, plain.options);
  assert.deepEqual(r.domain, { id: 'chaotic', effect: 'no_fit' });
});

// ---- A7 ----
check('A7 disorder keeps the state and the options; effect note, no forced abstain', () => {
  needDomain();
  const plain = onFixture({ jobId: 'validate-idea' });
  const r = onFixture({ jobId: 'validate-idea', causeEffect: 'disorder' });
  assert.equal(r.state, plain.state);
  assert.equal(r.no_strong_pick, false);
  assert.deepEqual(r.options, plain.options);
  assert.deepEqual(r.domain, { id: 'disorder', effect: 'note' });
  assert.match(D.hostNote('disorder'), /slice/);
  assert.match(D.hostNote('chaotic'), /no strong pick/);
  assert.equal(D.hostNote('complex'), null);
  assert.equal(D.hostNote('Disorder'), null);
  // Rule 1: a state other than ok and no_strong_pick returns the same object.
  const none = { state: 'no_row', key_used: null, options: [], no_strong_pick: false, top_tie: 0, table_version: 'x' };
  assert.equal(D.applyDomain(none, 'complex'), none);
  const ok = onFixture({ jobId: 'validate-idea' });
  assert.equal(D.applyDomain(ok, 'confused'), ok);
  assert.equal(D.applyDomain(ok, null), ok);
});

// ---- A8 ----
check('A8 strongOrder lists every strong entry of the row, fit-first for a closed domain, row order otherwise', () => {
  needDomain();
  const so = (q) => withTable(FIXTURE, () => S.strongOrder(q));
  const rowOrder = ['/mos:explain-decision', '/mos:bono', '/mos:causal', '/mos:opportunities', '/mos:find-connections', '/mos:explore-trends'];
  assert.deepEqual(so({ jobId: 'find-problem' }), rowOrder, 'no domain: row order, beyond the top k');
  assert.deepEqual(so({ jobId: 'find-problem', causeEffect: 'confused' }), rowOrder, 'unknown domain');
  assert.deepEqual(so({ jobId: 'find-problem', causeEffect: 'chaotic' }), rowOrder, 'chaotic');
  assert.deepEqual(so({ jobId: 'find-problem', causeEffect: 'disorder' }), rowOrder, 'disorder');
  assert.deepEqual(so({ jobId: 'find-problem', causeEffect: 'complex' }),
    ['/mos:find-connections', '/mos:explore-trends', '/mos:explain-decision', '/mos:bono', '/mos:causal', '/mos:opportunities']);
  assert.deepEqual(so({ jobId: 'find-problem', causeEffect: 'complex', exclude: ['/mos:find-connections'], lastCommand: '/mos:bono' }),
    ['/mos:explore-trends', '/mos:explain-decision', '/mos:causal', '/mos:opportunities'], 'skip list applied');
  assert.deepEqual(so({ jobId: 'decide-pursue', causeEffect: 'complex' }),
    ['/mos:bono', '/mos:build-thesis', '/mos:beautiful-question'], 'a top tie keeps the row order');
  assert.deepEqual(so({ jobId: 'compare-options', causeEffect: 'complex' }), ['/mos:bono', '/mos:eureka'], 'possible never enters');
  assert.equal(so({ jobId: 'no-such-job' }), null, 'no row');
  const saved = process.env.MINDRIAN_DECISION_ADVISOR;
  process.env.MINDRIAN_DECISION_ADVISOR = 'off';
  try { assert.equal(so({ jobId: 'find-problem', causeEffect: 'complex' }), null, 'advisor off'); }
  finally { process.env.MINDRIAN_DECISION_ADVISOR = saved; }
});

// ---- A9 ----
check('A9 the FN1 fence passes with domain.cjs present; the frozen copies equal problem-axes and the domain file', () => {
  needDomain();
  assert.ok(fs.existsSync(path.join(ADV, 'domain.cjs')));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tests', 'test-399-advisor-fence.cjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual([...D.CAUSE_EFFECT_DOMAINS], [...AXES.CAUSE_EFFECT_DOMAINS]);
  assert.deepEqual(Object.assign({}, D.DOMAIN_MOVE), Object.assign({}, AXES.DOMAIN_MOVE));
  assert.deepEqual([...S.CAUSE_EFFECT_DOMAINS], [...AXES.CAUSE_EFFECT_DOMAINS]);
  assert.ok(Object.isFrozen(D.CAUSE_EFFECT_DOMAINS) && Object.isFrozen(D.DOMAIN_MOVE) && Object.isFrozen(S.CAUSE_EFFECT_DOMAINS));
  const cy = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cynefin-domains.json'), 'utf8'));
  for (const d of cy.domains) assert.equal(D.DOMAIN_MOVE[d.id], d.move_type, d.id);
  assert.deepEqual([...D.DOMAIN_EFFECTS].sort(), ['no_change', 'no_fit', 'note', 'reordered', 'tie_kept']);
  // shortlist.cjs names only node:fs and node:path as require literals (the S6 rule of test-399-table);
  // its one lazy load is the built path of domain.cjs, and domain.cjs requires only node:fs and node:path.
  const src = fs.readFileSync(path.join(ADV, 'shortlist.cjs'), 'utf8');
  const lits = [...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(lits, ['node:fs', 'node:path']);
  assert.match(src, /const DOMAIN_MODULE = path\.join\(__dirname, 'domain\.cjs'\);/);
  const dyn = src.match(/\brequire\s*\(\s*[^'"\s)]/g) || [];
  assert.equal(dyn.length, 1, 'one built-path require only');
  assert.match(src, /require\(DOMAIN_MODULE\)/);
  const dsrc = fs.readFileSync(path.join(ADV, 'domain.cjs'), 'utf8');
  const dreq = [...dsrc.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
  assert.deepEqual(dreq, ['node:fs', 'node:path']);
});

// ---- Task 2: legs P1 to P7, the domain line and the notes in present.cjs ----
const P = load(path.join(ADV, 'present.cjs'));
const CY = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cynefin-domains.json'), 'utf8'));
const NOTE = { disorder: CY.host_notes.disorder.text, chaotic: CY.host_notes.chaotic.text };
// Review WR-05: the summary carries each note without its own leading domain head (the domain line writes it).
const NOTE_BODY = {
  disorder: NOTE.disorder.replace(/^Cause and effect domain: disorder\. /, ''),
  chaotic: NOTE.chaotic.replace(/^Cause and effect domain: chaotic\. /, ''),
};

// The 399 reference: shortlist.cjs and present.cjs at the plan base commit, read from git into scratch.
const BASE = 'c1e496ae8';
function baseModules() {
  const dir = path.join(scratch, 'base-399');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['shortlist.cjs', 'present.cjs']) {
    const r = spawnSync('git', ['show', BASE + ':lib/core/decision-advisor/' + f], { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0) return null;
    // The base shortlist resolves data/ from its own folder; point it at the real table.
    const src = f === 'shortlist.cjs'
      ? r.stdout.replace("path.join(__dirname, '..', '..', '..', 'data', 'decision-advisor-table.json')", JSON.stringify(SHIPPED))
      : r.stdout;
    fs.writeFileSync(path.join(dir, f), src);
  }
  return { S: require(path.join(dir, 'shortlist.cjs')), P: require(path.join(dir, 'present.cjs')) };
}
const OLD = baseModules();

function sl(state, options, extra) {
  return Object.assign({ state, key_used: 'x|*|*', options, no_strong_pick: state === 'no_strong_pick', top_tie: 1, table_version: '399-v0' }, extra || {});
}
const o = (command, band, rank, calibrated) => ({ command, band, rank, calibrated });
// Hand-built inputs in the shapes of the 399 tests.
const HAND = [
  sl('ok', [o('/mos:bono', 'strong', 1, 0.9), o('/mos:causal', 'possible', 2, 0.6)]),
  sl('ok', [o('/mos:bono', 'strong', 1, 0.9), o('/mos:causal', 'strong', 2, 0.8), o('/mos:jtbd', 'weak', 3, 0.2)]),
  sl('no_strong_pick', [o('/mos:bono', 'possible', 1, 0.6), o('/mos:causal', 'possible', 2, 0.55), o('/mos:jtbd', 'possible', 3, 0.5)]),
  sl('no_strong_pick', [o('/mos:bono', 'weak', 1, 0.3), o('/mos:causal', 'weak', 2, 0.3)], { top_tie: 9 }),
  sl('ok', [o('/mos:bono', 'strong', 1, 1), o('/mos:causal', 'strong', 2, 1)], { top_tie: 2 }),
  sl('no_row', [], { key_used: null }),
  sl('no_table', [], { key_used: null, table_version: null }),
  sl('off', [], { key_used: null, table_version: null }),
];

check('P1 with no domain key, publicShortlist and shortlistSentence are byte-identical to the 399 modules', () => {
  assert.ok(!P._loadError, 'present.cjs loads');
  assert.ok(OLD, 'the 399 reference modules load from git ' + BASE);
  let compared = 0;
  withTable(SHIPPED, () => {
    for (const job of VOCAB) {
      for (const level of LEVELS) {
        const q = { jobId: job, definitionLevel: level, lastCommand: null };
        const old = OLD.S.lookupShortlist(q);
        for (const ce of JUNK) {
          const now = S.lookupShortlist(Object.assign({}, q, { causeEffect: ce }));
          assert.equal(JSON.stringify(now), JSON.stringify(old), 'lookup ' + job + ' ' + level + ' ' + String(ce));
          const a = JSON.stringify(P.publicShortlist(now, { jobId: job }));
          const b = JSON.stringify(OLD.P.publicShortlist(old, { jobId: job }));
          assert.equal(a, b, 'public ' + job + ' ' + level);
          compared += 1;
        }
      }
    }
  });
  for (const x of HAND) {
    const a = P.publicShortlist(x, { jobId: 'validate-idea' });
    const b = OLD.P.publicShortlist(x, { jobId: 'validate-idea' });
    assert.equal(JSON.stringify(a), JSON.stringify(b), x.state);
    assert.equal(P.shortlistSentence(a), OLD.P.shortlistSentence(b));
    assert.equal(P.isTopTie(x), OLD.P.isTopTie(x));
  }
  assert.equal(compared, 20 * 4 * 5);
});

const pubOf = (ce, job) => {
  const r = onFixture({ jobId: job || 'validate-idea', causeEffect: ce });
  return { r, pub: P.publicShortlist(r, { jobId: job || 'validate-idea' }) };
};

check('P2 reordered: the domain object, no note, and the domain line with the reorder clause', () => {
  const { pub } = pubOf('complex');
  assert.equal(pub.state, 'ok');
  assert.deepEqual(pub.domain, { id: 'complex', verb_order: ['probe', 'sense', 'respond'], effect: 'reordered' });
  assert.equal(pub.domain_note, null);
  assert.deepEqual(pub.options.map((x) => x.command), ['/mos:beautiful-question', '/mos:explain-decision', '/mos:bono', '/mos:jtbd']);
  const tail = ' Cause and effect domain: complex (probe, then sense, then respond); inside the strong band, options whose move fits come first.';
  assert.ok(pub.summary.endsWith(tail), pub.summary);
  assert.equal(P.shortlistSentence(pub), pub.summary);
  // no_change: the domain line with no reorder clause.
  const nc = pubOf('complex', 'compare-options').pub;
  assert.equal(nc.domain.effect, 'no_change');
  assert.ok(nc.summary.endsWith(' Cause and effect domain: complex (probe, then sense, then respond).'), nc.summary);
});

check('P3 chaotic: no strong pick, the chaotic host note, and the sentence ends with the note', () => {
  const { pub } = pubOf('chaotic');
  assert.equal(pub.state, 'no_strong_pick');
  assert.equal(pub.no_strong_pick, true);
  assert.equal(pub.domain.effect, 'no_fit');
  assert.equal(pub.domain_note, NOTE.chaotic);
  assert.ok(pub.summary.endsWith(' Cause and effect domain: chaotic (act, then sense, then respond). ' + NOTE_BODY.chaotic), pub.summary);
  assert.ok(pub.summary.indexOf('no strong pick') !== -1);
});

check('P3b WR-05 chaotic: no public option says strong; the summary names the domain head once (chaotic and disorder)', () => {
  for (const job of ['validate-idea', 'compare-options', 'decide-pursue', 'find-problem', 'explore']) {
    const r = onFixture({ jobId: job, causeEffect: 'chaotic' });
    const pub = P.publicShortlist(r, { jobId: job });
    if (!pub) continue;
    assert.equal(pub.state, 'no_strong_pick', job);
    assert.equal(pub.options.some((x) => x.band === 'strong'), false, job + ' ' + JSON.stringify(pub.options));
    assert.ok(r.options.some((x) => x.band === 'strong') || job !== 'validate-idea', 'fixture: the internal shortlist keeps its strong band');
  }
  for (const ce of ['chaotic', 'disorder']) {
    const { pub } = pubOf(ce);
    const heads = pub.summary.split('Cause and effect domain: ' + ce).length - 1;
    assert.equal(heads, 1, ce + ': ' + pub.summary);
    assert.equal(pub.domain_note, NOTE[ce], 'the public note keeps the full text');
  }
});

check('P4 disorder: options and state as 399, the disorder note after the domain line', () => {
  const { pub } = pubOf('disorder');
  const plain = P.publicShortlist(onFixture({ jobId: 'validate-idea' }), { jobId: 'validate-idea' });
  assert.equal(pub.state, plain.state);
  assert.deepEqual(pub.options, plain.options);
  assert.equal(pub.domain_note, NOTE.disorder);
  assert.deepEqual(pub.domain, { id: 'disorder', verb_order: ['slice', 'place'], effect: 'note' });
  assert.equal(pub.summary, plain.summary + ' Cause and effect domain: disorder (slice, then place). ' + NOTE_BODY.disorder);
});

check('P5 tie_kept: the 399 tie path (no strong pick, unordered) with the domain line', () => {
  const { pub } = pubOf('complex', 'decide-pursue');
  const plain = P.publicShortlist(onFixture({ jobId: 'decide-pursue' }), { jobId: 'decide-pursue' });
  assert.equal(pub.state, 'no_strong_pick');
  assert.equal(pub.unordered, true);
  assert.deepEqual(pub.options, plain.options);
  assert.equal(pub.domain.effect, 'tie_kept');
  assert.equal(pub.summary, plain.summary + ' Cause and effect domain: complex (probe, then sense, then respond).');
});

check('P6 a reorder never turns a pick into a tie or a tie into a pick: isTopTie reads the lookup count only', () => {
  // A unique top (top_tie 1) whose reorder puts two equal fit values first.
  const x = sl('ok', [o('/mos:explain-decision', 'strong', 1, 0.95), o('/mos:find-connections', 'strong', 2, 0.8), o('/mos:explore-trends', 'strong', 3, 0.8)]);
  const r = D.applyDomain(x, 'complex');
  assert.equal(r.domain.effect, 'reordered');
  assert.equal(r.options[0].calibrated, r.options[1].calibrated, 'fixture: the reordered top holds two equal values');
  assert.equal(P.isTopTie(x), false);
  assert.equal(P.isTopTie(r), false, 'a pick stays a pick');
  const pub = P.publicShortlist(r, { jobId: 'validate-idea' });
  assert.equal(pub.state, 'ok');
  assert.equal(pub.unordered, undefined);
  // A tie stays a tie.
  const t = D.applyDomain(sl('ok', [o('/mos:bono', 'strong', 1, 0.9), o('/mos:build-thesis', 'strong', 2, 0.9)], { top_tie: 2 }), 'complex');
  assert.equal(P.isTopTie(t), true);
  assert.equal(P.publicShortlist(t, { jobId: 'validate-idea' }).unordered, true);
});

check('P7 no raw number in any public shortlist of these legs', () => {
  const inputs = [];
  for (const job of ['validate-idea', 'compare-options', 'decide-pursue', 'find-problem', 'explore']) {
    for (const ce of [undefined].concat(D.CAUSE_EFFECT_DOMAINS)) inputs.push([onFixture({ jobId: job, causeEffect: ce }), job]);
  }
  for (const x of HAND) {
    inputs.push([x, 'validate-idea']);
    for (const ce of D.CAUSE_EFFECT_DOMAINS) inputs.push([D.applyDomain(x, ce), 'validate-idea']);
  }
  for (const [x, job] of inputs) {
    const pub = P.publicShortlist(x, { jobId: job });
    assert.equal(P.hasRawNumber(pub), false, JSON.stringify(pub));
  }
  assert.ok(inputs.length > 40);
});

fs.rmSync(scratch, { recursive: true, force: true });
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
