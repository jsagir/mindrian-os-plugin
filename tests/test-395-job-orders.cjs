#!/usr/bin/env node
'use strict';
// Phase 395-04: the job orders the candidates inside the one selector. Plain Node script.
// Exit 0 when all checks pass, 1 when one fails. One line per check: "ok:" or "FAIL:".
//
// Sort keys under test (lib/core/feyminto/next-move.cjs composeNextMove), with a job known:
//   1. the candidate serves the job (data/command-registry.json serves_jtbd)
//   2. the ledger rating of the candidate for the job: 2 strong, 1 partial or not rated, 0 poor
//   3. the count of sources, then the ties, as before
// With no job known the order is the order before this change.
//
// What comes from where:
//   - Parts A, B and D call composeNextMove with a stub capability function and the `jobFit` input, so they do not
//     read the ledger. They read data/command-registry.json to learn which command serves which job; the command
//     names are picked from the registry at run time, not written here.
//   - Part C reads data/section-command-ledger.json and picks its commands from it at run time.
//   - Part E uses a real born fixture room under an isolated temporary home
//     (tests/helpers/isolated-home-36925.cjs). No network.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

const JOB = 'validate-idea';

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('ok: ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + name + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const strip = (n) => String(n).replace(/^\/mos:/, '');
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands
  .filter((c) => c && typeof c.command === 'string');
const servesOf = (name) => {
  const e = REG.find((c) => strip(c.command) === name);
  return e && Array.isArray(e.serves_jtbd) ? e.serves_jtbd : [];
};
const serves = (name, job) => servesOf(name).indexOf(job) !== -1;

const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
const capabilityFor = () => ({ known: true, cli: 'runnable', mcp: 'runnable', label: 'runnable (test)' });
const src = (contract, table) => ({ contract: { names: contract || [] }, navigator_table: { names: table || [] } });
const led = (names) => [{ source: 'section_ledger', items: names.map((n) => ({ id: n, confidence: null, source: 'ground-truth' })) }];
const face = (names) => ({ asked: true, commands: names.map((n) => ({ name: n, cli: 'runnable', mcp: 'runnable' })) });
function compose(extra) {
  return NM.composeNextMove(Object.assign({ surface: 'mcp', face: { asked: false, commands: [] }, ledgerCandidates: null, attempted: [], need: {}, capabilityFor }, extra));
}
const order = (m) => (m.primary ? [m.primary.command] : []).concat(m.alternatives.map((a) => a.command));

function main() {
  // Two commands that serve JOB and two that do not, from the registry.
  const all = REG.map((c) => strip(c.command));
  const serving = all.filter((n) => serves(n, JOB));
  const notServing = all.filter((n) => !serves(n, JOB));
  if (serving.length < 2 || notServing.length < 2) throw new Error('the registry needs 2 commands that serve ' + JOB + ' and 2 that do not');
  const S1 = serving[0];
  const S2 = serving[1];
  const N1 = notServing[0];
  const N2 = notServing[1];
  console.log('names: S1=' + S1 + ' S2=' + S2 + ' (serve ' + JOB + '); N1=' + N1 + ' N2=' + N2 + ' (do not)');

  // ---- A. the order with a job known ----
  check('A1. a command that serves the job is before a command with more sources that does not', () => {
    const m = compose({ jobId: JOB, jobFit: {}, sources: src([N1, S1], [N1]), ledgerCandidates: led([N1]) });
    assert.deepStrictEqual(order(m), [S1, N1]);
    assert.strictEqual(m.state, 'ok');
  });

  check('A2. among commands that serve the job, a strong ledger rating is before more sources', () => {
    const m = compose({ jobId: JOB, jobFit: { [S2]: 2 }, sources: src([S1, S2], [S1]) });
    assert.deepStrictEqual(order(m), [S2, S1]);
  });

  check('A3. a command with no rating is before a command with a poor rating', () => {
    const m = compose({ jobId: JOB, jobFit: { [S1]: 0 }, sources: src([S1, S2], [S1]) });
    assert.deepStrictEqual(order(m), [S2, S1]);
  });

  check('A4. the job key is before the rating key', () => {
    const m = compose({ jobId: JOB, jobFit: { [N1]: 2, [S1]: 0 }, sources: src([N1, S1], [N1]) });
    assert.deepStrictEqual(order(m), [S1, N1]);
  });

  check('A5. the rating also orders the commands that do not serve the job', () => {
    const m = compose({ jobId: JOB, jobFit: { [N2]: 2 }, sources: src([N1, N2], [N1]) });
    assert.deepStrictEqual(order(m), [N2, N1]);
  });

  check('A6. equal job key and equal rating: more sources first, then the ledger order', () => {
    const bySources = compose({ jobId: JOB, jobFit: { [S1]: 1, [S2]: 1 }, sources: src([S1, S2], [S2]) });
    assert.deepStrictEqual(order(bySources), [S2, S1]);
    const byLedger = compose({ jobId: JOB, jobFit: {}, sources: src([S1, S2], []), ledgerCandidates: led([S2, S1]) });
    assert.deepStrictEqual(order(byLedger), [S2, S1]);
  });

  check('A7. a rating that is not 0, 1 or 2 is not used', () => {
    const m = compose({ jobId: JOB, jobFit: { [S2]: 5 }, sources: src([S1, S2], [S1]) });
    assert.deepStrictEqual(order(m), [S1, S2]);
  });

  // ---- B. no job known: the order before this change ----
  check('B1. no job: the count of sources orders, and a jobFit input changes nothing', () => {
    const input = { jobId: null, sources: src([N1, S1], [N1]), ledgerCandidates: led([N1]) };
    const plain = compose(input);
    const withFit = compose(Object.assign({}, input, { jobFit: { [S1]: 2, [N1]: 0 } }));
    assert.deepStrictEqual(order(plain), [N1, S1]);
    assert.strictEqual(plain.state, 'job_unknown');
    assert.strictEqual(plain.job, null);
    assert.strictEqual(JSON.stringify(withFit), JSON.stringify(plain));
    assert.ok(plain.primary.sources.indexOf('the nest job') === -1, 'no job source without a job');
  });

  // ---- C. the rating read from the ledger file (repository data) ----
  const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'section-command-ledger.json'), 'utf8'));
  const floor = typeof ledger.confidence_floor === 'number' ? ledger.confidence_floor : null;
  const counted = (r) => (typeof r.confidence === 'number' ? (floor === null || r.confidence >= floor) : r.source === 'ground-truth');
  const rows = Object.keys(ledger.rows || {}).filter((k) => /\|\*\|\*$/.test(k)).map((k) => ({
    job: k.split('|')[0],
    items: ledger.rows[k].filter((r) => r && typeof r.command === 'string' && typeof r.score === 'number'),
  }));
  // The first pair (a, b) of one row with the same serves status for the row's job, where pa(a) and pb(b) hold.
  function findPair(pa, pb) {
    for (const row of rows) {
      for (const a of row.items) {
        if (!pa(a)) continue;
        const b = row.items.find((x) => x !== a && pb(x) && serves(strip(x.command), row.job) === serves(strip(a.command), row.job));
        if (b) return { job: row.job, a: strip(a.command), b: strip(b.command) };
      }
    }
    return null;
  }

  check('C1. ledger file: a counted strong score is before a counted poor score with more sources', () => {
    const p = findPair((r) => counted(r) && r.score >= 1.5, (r) => counted(r) && r.score < 0.5);
    assert.ok(p, 'the ledger holds no row with a counted strong and a counted poor command of the same serves status');
    const m = compose({ jobId: p.job, sources: src([p.b, p.a], [p.b]) });
    assert.deepStrictEqual(order(m), [p.a, p.b], 'job ' + p.job);
  });

  check('C2. ledger file: a counted strong score is before a counted partial score with more sources', () => {
    const p = findPair((r) => counted(r) && r.score >= 1.5, (r) => counted(r) && r.score >= 0.5 && r.score < 1.5);
    assert.ok(p, 'the ledger holds no row with a counted strong and a counted partial command of the same serves status');
    const m = compose({ jobId: p.job, sources: src([p.b, p.a], [p.b]) });
    assert.deepStrictEqual(order(m), [p.a, p.b], 'job ' + p.job);
  });

  check('C3. ledger file: a low score under the confidence floor is not used as a poor rating', () => {
    assert.ok(floor !== null, 'the ledger has a confidence floor');
    const p = findPair((r) => typeof r.confidence === 'number' && r.confidence < floor && r.score < 0.5, (r) => counted(r) && r.score < 0.5);
    assert.ok(p, 'the ledger holds no row with a low score under the floor and a counted poor command of the same serves status');
    const m = compose({ jobId: p.job, sources: src([p.b, p.a], [p.b]) });
    assert.deepStrictEqual(order(m), [p.a, p.b], 'job ' + p.job);
  });

  // ---- D. the why sentence names the key that decided ----
  check('D1. why: the job put the primary before the first command of Theo', () => {
    const m = compose({ jobId: JOB, jobFit: {}, face: face([N1]), sources: src([N1, S1], [N1]) });
    assert.strictEqual(m.primary.command, S1);
    assert.ok(m.why.indexOf('Theo ranked ' + N1 + ' first, but a command that serves the job is ordered first') !== -1, m.why);
    assert.ok(m.why.indexOf('agreement across sources') === -1, m.why);
  });

  check('D2. why: the ledger rating put the primary before the first command of Theo', () => {
    const m = compose({ jobId: JOB, jobFit: { [S2]: 2 }, face: face([S1]), sources: src([S1, S2], [S1]) });
    assert.strictEqual(m.primary.command, S2);
    assert.ok(m.why.indexOf('Theo ranked ' + S1 + ' first, but the ledger rates this command higher for the job') !== -1, m.why);
    assert.ok(m.why.indexOf('agreement across sources') === -1, m.why);
  });

  check('D3. why: equal job key and equal rating keep the agreement sentence, with a job and with no job', () => {
    const withJob = compose({ jobId: JOB, jobFit: {}, face: face([S2]), sources: src([S1], [S1]) });
    assert.strictEqual(withJob.primary.command, S1);
    assert.ok(withJob.why.indexOf('Theo ranked ' + S2 + ' first, but agreement across sources outranks one source\'s order') !== -1, withJob.why);
    const noJob = compose({ jobId: null, face: face([N2]), sources: src([N1], [N1]) });
    assert.strictEqual(noJob.primary.command, N1);
    assert.ok(noJob.why.indexOf('Theo ranked ' + N2 + ' first, but agreement across sources outranks one source\'s order') !== -1, noJob.why);
  });

  // ---- E. the real selector on a born room ----
  const iso = H.mkIsolatedHome('395orders');
  const born = H.birthFixtureRoom({ iso, slug: 'job-orders', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!born || born.ok !== true) throw new Error('fixture birth failed: ' + JSON.stringify(born));
  const roomDir = fs.realpathSync(born.roomDir);
  const jtbdState = require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
  const B = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'brief.cjs'));
  const folders = fs.readdirSync(roomDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.indexOf('.') !== 0).map((d) => d.name).sort();
  const sweep = () => {
    const out = {};
    folders.forEach((f) => ['mcp', 'cli'].forEach((s) => {
      out[f + '|' + s] = NM.nextMoveForSection({ roomDir, sectionDir: path.join(roomDir, f), surface: s });
    }));
    return out;
  };
  // With a job, when a runnable command in the top three serves the job, the primary serves the job.
  const jobFirstHolds = (moves) => {
    let withJob = 0;
    Object.keys(moves).forEach((k) => {
      const m = moves[k];
      if (!m.job || !m.primary) return;
      withJob += 1;
      if (serves(m.primary.command, m.job.id)) return;
      const better = m.alternatives.filter((a) => a.instruction_only !== true && serves(a.command, m.job.id)).map((a) => a.command);
      assert.deepStrictEqual(better, [], k + ': the primary ' + m.primary.command + ' does not serve ' + m.job.id + ', but a runnable alternative does');
    });
    return withJob;
  };

  const noGoal = sweep();
  const basisNoGoal = B.recordBasis(path.join(roomDir, 'problem-definition')).fingerprint;

  check('E1. born room, no goal: no primary is before a runnable command that serves the section job', () => {
    const n = jobFirstHolds(noGoal);
    assert.ok(n >= 10, 'at least 10 selector results have a job and a primary: ' + n);
  });

  check('E2. a goal job explore does not rank the move: the selector and the brief basis are as with no goal', () => {
    assert.ok(jtbdState.setGoal(roomDir, { jtbd: 'explore' }), 'the goal explore is stored');
    assert.strictEqual(jtbdState.getGoal(roomDir).jtbd, 'explore');
    assert.deepStrictEqual(jtbdState.resolveSelectionJob(roomDir, 'find-problem'), { id: 'find-problem', origin: 'section', rung: null });
    assert.deepStrictEqual(jtbdState.resolveSelectionJob(roomDir, null), { id: null, origin: null, rung: null });
    assert.strictEqual(JSON.stringify(sweep()), JSON.stringify(noGoal));
    assert.strictEqual(B.recordBasis(path.join(roomDir, 'problem-definition')).fingerprint, basisNoGoal);
  });

  check('E3. another goal job still ranks the move, and the job orders first in every nest', () => {
    assert.ok(jtbdState.setGoal(roomDir, { jtbd: JOB }), 'the goal ' + JOB + ' is stored');
    assert.strictEqual(jtbdState.resolveSelectionJob(roomDir, 'find-problem').origin, 'goal');
    const moves = sweep();
    Object.keys(moves).forEach((k) => assert.deepStrictEqual(moves[k].job, { id: JOB, origin: 'goal' }, k));
    const n = jobFirstHolds(moves);
    assert.ok(n >= 10, 'at least 10 selector results have a primary: ' + n);
    assert.notStrictEqual(B.recordBasis(path.join(roomDir, 'problem-definition')).fingerprint, basisNoGoal);
  });

  // ---- G. dash guard ----
  check('G1. no em dash or en dash in the files of this plan', () => {
    const files = ['lib/core/feyminto/next-move.cjs', 'lib/hmi/jtbd-state.cjs', 'tests/test-395-job-orders.cjs', 'tests/run-all-395.sh']
      .map((f) => path.join(ROOT, f));
    assert.deepStrictEqual(H.dashGuard(files), []);
  });
}

try {
  main();
} catch (e) {
  failed += 1;
  console.log('FAIL: the test did not run to its end -- ' + (e && e.stack ? e.stack : String(e)));
}
if (failed > 0) {
  console.log('FAILED: ' + failed + ' check(s)');
  process.exit(1);
}
console.log('PASSED: all checks');
process.exit(0);
