'use strict';
/*
 * tests/test-skillopt-null-negative-reconciliation-318.cjs -- Phase 318,
 * SEED-061 step 1: the end-to-end proving-case reproduction of the disclosed
 * harness bug (230-07-CALIBRATION.md lines 55-72) plus the opportunistic
 * real-corpus audit.
 *
 * Standalone node CJS test, no framework (this repo's convention, matching
 * tests/test-trigger-invariant.cjs). Zero spawn: every runFunnel call below
 * passes an injected spawnImpl; the real defaultSpawn (which shells out to the
 * 'claude' CLI) is never reached. No em-dashes.
 *
 * Provenance note (the near-miss control pair, reused from the plan's Case D):
 * skill-c's negative "what's the status of my room" and skill-a's positive
 * "show me the current status of my room" are the REAL Phase 230 near-miss
 * pair (jtbd's negative vs status's positive, harvested at plan time from
 * .planning/phases/230-.../out/queries/{jtbd,status}.json). Similar wording,
 * never identical -- the exact-match rule (D-02) must never correct it.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const funnel = require(path.join(ROOT, 'scripts', 'skillopt-funnel.cjs'));
const { PHASE_OUT_DIR } = require(path.join(ROOT, 'lib', 'core', 'skillopt-schemas.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAILED ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

const FIXTURES_DIR = path.join(ROOT, 'tests', 'fixtures', '318');
const QUERIES_DIR = path.join(FIXTURES_DIR, 'queries');
const NOCOLLISION_DIR = path.join(FIXTURES_DIR, 'queries-nocollision');

// A deterministic fake judge keyed on the literal query text embedded in the
// -p prompt. Always predicts the "honest" answer a real full-roster judge
// would give: the collision text fires skill-a (the true collision target),
// the near-miss negative fires nothing, every filler fires its own skill.
const judgeCallLog = [];
function fakeJudgeSpawn(args) {
  const prompt = args[1] || '';
  const q = (prompt.match(/USER QUERY: (.*)/) || [])[1] || '';
  judgeCallLog.push(q);
  let predicted = null;
  if (q === 'FIXTURE-318-COLLIDE: draft a project proposal outline') predicted = 'skill-a';
  else if (q === "what's the status of my room") predicted = null;
  else if (q.startsWith('skill-a')) predicted = 'skill-a';
  else if (q.startsWith('skill-b')) predicted = 'skill-b';
  else if (q.startsWith('skill-c')) predicted = 'skill-c';
  return {
    status: 0,
    stdout: JSON.stringify({
      structured_output: { query: q, predicted_skill: predicted, expected_skill: null, confidence: 'high', reasoning: 'deterministic 318 fixture judge' },
      session_id: 'sess-318',
      total_cost_usd: 0.01,
    }),
  };
}

// Hash every tracked fixture file so Leg 3 can prove byte-identity after both
// runs. Reads once and returns a stable { path: sha256 } snapshot.
function snapshotFixtures() {
  const snap = {};
  for (const dir of [QUERIES_DIR, NOCOLLISION_DIR]) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const p = path.join(dir, f);
      snap[p] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  }
  return snap;
}

async function main() {
  const baseOut = path.join(ROOT, PHASE_OUT_DIR);
  fs.mkdirSync(baseOut, { recursive: true });
  const tmpRoot = fs.mkdtempSync(path.join(baseOut, '.test-318-reconcile-'));

  try {
    // ======================================================================
    // Leg 1: the flag-rule arithmetic. Two units, identical except
    // verdict.expected_skill (stale null vs reconciled foreign skill). This
    // is the bug mechanism in one assertion.
    // ======================================================================
    try {
      const label = 'Leg 1: classifySkills flags the stale-null unit, passes the reconciled unit (identical units otherwise)';
      const stale = [{
        item: { skill: 'leg1', split: 'train' },
        unit: { unit_id: 'leg1-stale-0', status: 'ok' },
        verdict: { predicted_skill: 'foreign', expected_skill: null, confidence: 'high' },
      }];
      const reconciled = [{
        item: { skill: 'leg1', split: 'train' },
        unit: { unit_id: 'leg1-reconciled-0', status: 'ok' },
        verdict: { predicted_skill: 'foreign', expected_skill: 'foreign', confidence: 'high' },
      }];
      const staleRows = funnel.classifySkills(stale);
      const reconciledRows = funnel.classifySkills(reconciled);
      assert.equal(staleRows[0].verdict, 'flagged', 'stale-null unit must flag');
      assert.equal(staleRows[0].train_miss_count, 1, 'stale-null unit must record one train miss');
      assert.equal(reconciledRows[0].verdict, 'pass', 'reconciled unit must pass');
      assert.equal(reconciledRows[0].train_miss_count, 0, 'reconciled unit must record zero train misses');
      ok(label);
    } catch (e) { fail('Leg 1: flag-rule arithmetic', e); }

    // ======================================================================
    // Leg 2 + Leg 3: the corpus A/B (real fixtures, real runFunnel, fake
    // judge), bracketed by a byte-identity snapshot of every fixture file
    // (Leg 3 proves the pass never rewrites the on-disk query sets).
    // ======================================================================
    const fixturesBefore = snapshotFixtures();
    let corpusRun = null;
    try {
      const label = 'Leg 2: no-collision corpus flags, collision corpus passes, correction row + near-miss control both correct';
      const outA = path.join(tmpRoot, 'out-nocollision');
      const noCollisionRun = await funnel.runFunnel({
        inventory: [], queriesDir: NOCOLLISION_DIR, outDir: outA,
        spawnImpl: fakeJudgeSpawn, config: { concurrency: 2 }, _noWriteResults: true,
      });
      const bBefore = noCollisionRun.results.find((r) => r.skill === 'skill-b');
      assert.ok(bBefore, 'skill-b must appear in the no-collision run');
      assert.equal(bBefore.verdict, 'flagged', 'skill-b must flag on the no-collision corpus (the false alarm this phase removes)');
      assert.equal(bBefore.train_miss_count, 1, 'skill-b must have exactly one train miss on the no-collision corpus');

      const outB = path.join(tmpRoot, 'out-collision');
      corpusRun = await funnel.runFunnel({
        inventory: [], queriesDir: QUERIES_DIR, outDir: outB,
        spawnImpl: fakeJudgeSpawn, config: { concurrency: 2 }, _noWriteResults: true,
      });
      const bAfter = corpusRun.results.find((r) => r.skill === 'skill-b');
      assert.ok(bAfter, 'skill-b must appear in the collision run');
      assert.equal(bAfter.verdict, 'pass', 'skill-b must pass on the collision corpus (the judge correctly routes to skill-a)');
      assert.equal(bAfter.train_miss_count, 0, 'skill-b must have zero train misses on the collision corpus');

      assert.equal(corpusRun.funnelResults.label_reconciliation.corrected_count, 1, 'exactly one correction on the collision corpus');
      const correctionRow = corpusRun.labelReconciliation.corrections[0];
      assert.equal(correctionRow.skill, 'skill-b', 'the correction row must name skill-b as the source');
      assert.equal(correctionRow.corrected_to, 'skill-a', 'the correction row must name skill-a as the target');

      const stillNull = corpusRun.labelReconciliation.remaining_null.some(
        (r) => r.skill === 'skill-c' && r.query === "what's the status of my room"
      );
      assert.ok(stillNull, 'the near-miss control (skill-c) must remain in remaining_null, never corrected');
      ok(label);
    } catch (e) { fail('Leg 2: corpus A/B', e); }

    try {
      const label = 'Leg 3: on-disk query fixtures are byte-identical before and after both runFunnel runs (never rewritten)';
      const fixturesAfter = snapshotFixtures();
      assert.deepEqual(fixturesAfter, fixturesBefore, 'fixture file hashes must be unchanged after the reconciliation pass runs');
      ok(label);
    } catch (e) { fail('Leg 3: no write-back', e); }

    // ======================================================================
    // Leg 4: zero spawn. The fake judge recorded every judged query; the
    // test's own source contains no reference to Node's process-spawning module.
    // ======================================================================
    try {
      const label = 'Leg 4: zero spawn -- fake judge recorded queries, test source has no forbidden spawn-module reference';
      assert.ok(judgeCallLog.length > 0, 'the fake judge must have been called at least once');
      assert.ok(judgeCallLog.includes('FIXTURE-318-COLLIDE: draft a project proposal outline'), 'the fake judge must have judged the collision query');
      const src = fs.readFileSync(__filename, 'utf8');
      // Built from fragments so this very assertion string does not itself
      // trip the check it performs.
      const forbidden = new RegExp(['child', '_process'].join(''));
      assert.ok(!forbidden.test(src), 'test source must not reference the forbidden spawn module');
      ok(label);
    } catch (e) { fail('Leg 4: zero spawn', e); }

    // ======================================================================
    // Leg 5: the opportunistic real-corpus audit. In-process (no CLI
    // subprocess, which would violate Leg 4's zero-spawn rule) -- mirrors
    // --reconcile-audit's computation using the exported pure functions
    // directly.
    // ======================================================================
    try {
      const label = 'Leg 5: opportunistic real Phase 230 corpus audit (or an explicit SKIP if absent)';
      const realQueriesDir = path.join(ROOT, '.planning', 'phases',
        '230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur', 'out', 'queries');
      if (!fs.existsSync(realQueriesDir)) {
        process.stdout.write('  SKIP: real 230 corpus not present (.planning is gitignored)\n');
        ok(label + ' (SKIP path)');
      } else {
        const allItems = funnel.enumerateQueries(realQueriesDir, null);
        const positiveIndex = funnel.buildPositiveIndex(allItems);
        const rec = funnel.reconcileNullNegatives(allItems, positiveIndex);
        const nullNegatives = allItems.filter((it) => it.kind === 'should_not_trigger' && it.expected_skill == null).length;
        process.stdout.write(
          '  real-230-audit: total=' + allItems.length + ' null_negatives=' + nullNegatives +
          ' corrected=' + rec.corrections.length + ' ambiguous=' + rec.ambiguous.length +
          ' residual_null=' + rec.remaining_null.length + '\n'
        );
        // Do NOT assert a nonzero corrected count: plan-time measurement says
        // 0 of 23 on the real corpus (Finding 1), and asserting otherwise
        // would fail this test for the wrong reason.
        assert.ok(Number.isInteger(rec.corrections.length), 'the audit computation must complete and return a real corrections array');
        ok(label);
      }
    } catch (e) { fail('Leg 5: real-corpus audit', e); }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  process.stdout.write('\n');
  process.stdout.write('318-01 null-negative reconciliation proving case: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

main();
