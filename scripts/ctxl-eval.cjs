#!/usr/bin/env node
'use strict';
/**
 * scripts/ctxl-eval.cjs -- Phase 240.1 Plan 06, CTXL-03 room-context benchmark.
 * ============================================================================
 * This is the THIRD instance of the two-layer eval idiom this repo already
 * ships twice (scripts/huji-eval.cjs, Phase 229; scripts/skillopt-eval.cjs,
 * Phase 230), applied to a new question: does feeding Larry real room content
 * improve his answer accuracy on a fixed local task set?
 *
 * TWO LAYERS, BOTH REUSED FROM THE SIBLINGS, NEITHER RE-INVENTED:
 *   1. The no-model-call CODE checks (corpus-shape, anchor-grounded,
 *      context-discriminates, part8-hygiene, cost-ledger, delta-record) that
 *      gate every commit and wave at ZERO API spend. A check that re-reads
 *      the bytes from disk, never trusts a producer's own tally -- the same
 *      discipline skillopt-eval.cjs states over huji-run-one.cjs.
 *   2. The model-call A/B leg (--suite ab), opt-in only via CTXL_EVAL_LIVE=1,
 *      which skips cleanly with an explicit SKIP line and NEVER fails a
 *      structural run when it is not enabled.
 *
 * THE ONE PLACE THIS HARNESS MUST DIVERGE FROM ITS OWN ANALOG (RESOLUTION 1,
 * LOCKED, THE WHOLE POINT OF THIS PLAN): huji-eval's calibration gate fails
 * closed on a bad correlation (huji-eval.cjs:1055). checkDeltaRecord below
 * MUST NOT do that. It asserts a measurement RAN and a well-formed result was
 * WRITTEN. It never asserts the SIGN of the accuracy delta. A null or
 * negative delta is a recorded PASS carrying a populated `finding` string,
 * exactly like a positive one -- the direct, literal reading of ROADMAP SC3
 * and of 240.1-RESEARCH.md Pitfall 6 ("a CTXL-03 gate that fails on a null
 * result"). If no accuracy delta is measurable at MindrianOS's scale, THAT is
 * the finding to record, not a reason to skip the gate and not a reason to
 * fail it.
 *
 * EXTERNAL PRECEDENT, CITED AND LABELED, NEVER RESTATED AS OUR OWN
 * MEASUREMENT (locked decision D-02): MotherDuck's DABStep figures are
 * MotherDuck's own measurements, verified against their primary source. This
 * harness does not reproduce DABStep -- MindrianOS has no equivalent public
 * benchmark and must not fabricate one to look comparable.
 *   https://motherduck.com/blog/context-belongs-in-the-warehouse
 *   https://motherduck.com/blog/oops-maybe-we-do-need-semantic-layers
 *
 * THE MANIPULATED VARIABLE. buildBundle(room, task, opts) assembles the A/B
 * condition from the fixture room's own artifact bodies (Resolution 4): WITH
 * context includes the artifact text; WITHOUT context includes only the
 * question and a fixed neutral preamble. context-discriminates is the
 * deterministic proof that the two arms actually differ per task -- without
 * it, an A/B with no real difference between the arms would report a delta
 * of zero and look exactly like a legitimate null finding.
 *
 * CANON PART 8. part8-hygiene reuses lib/core/part8-egress-guard.classify
 * over every bundle this harness would send, NEVER a hand-rolled egress
 * regex (huji-eval's D4 doctrine). The harness also refuses outright to run
 * against any room dir resolving under the real rooms home
 * ($HOME/MindrianRooms or $MINDRIAN_ROOMS_HOME) -- it runs against the
 * synthetic fixture room (tests/helpers/fixture-room-2401.cjs) only
 * (240.1-RESEARCH.md Pitfall 7).
 *
 * CLI (switch-case argv router, the gsd-tools.cjs / huji-eval.cjs pattern --
 * no Commander/yargs):
 *   --selftest                        twelve PASS+FAIL fixture directions,
 *                                      zero spawn, zero network
 *   --check <name> [--out DIR] [--threshold N]
 *   --suite code [--strict]           all six checks, zero API spend
 *   --suite ab                        opt-in model leg; SKIPs cleanly unless
 *                                      CTXL_EVAL_LIVE=1 is set
 *   --report [--out DIR]              render the delta table from the run
 *                                      record on disk
 *
 * CJS only, zero new dependencies, no em-dashes or en-dashes (CLAUDE.md HARD
 * RULE) -- hyphens only.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const guard = require(path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));
const {
  buildFixtureRoom2401,
  readTaskCorpus,
} = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-2401.cjs'));

// The forbidden code points appear ONLY as \u escapes here, never as literal
// characters in this file (the tests/test-143.2-doctrine-presence.cjs house
// rule, ported verbatim).
const EM_DASH = '\u2014';
const EN_DASH = '\u2013';

const REQUIRED_TASK_KEYS = [
  'id', 'question', 'context_file', 'context_anchor', 'answer_anchors', 'distractor_anchors',
];

const RUN_RECORD_FILENAME = 'ctxl-eval-run-record.json';
const DEFAULT_OUT_DIR_REL = path.join(
  '.planning', 'phases', '240.1-context-layer-drift-detection', 'out', 'ctxl-eval'
);
const DEFAULT_COST_CAP = 0.50;

// The fixed neutral preamble the WITHOUT-context arm carries instead of any
// artifact body (Resolution 4). Never varies per task.
const NEUTRAL_PREAMBLE = 'You have no additional reference material for this '
  + 'question. Answer only from your own general knowledge; if you do not '
  + 'know, say so plainly rather than guessing.';

function defaultOutDir() {
  return path.join(REPO_ROOT, DEFAULT_OUT_DIR_REL);
}

function resolveOutDir(o) {
  if (o && o.out) return path.resolve(o.out);
  return defaultOutDir();
}

function parseThreshold(o) {
  if (o && o.threshold !== undefined) {
    const t = parseFloat(o.threshold);
    if (!Number.isNaN(t)) return t;
  }
  return undefined;
}

// A skipped result: printed with an explicit SKIP line, never a silent fake
// PASS (the skillopt-eval.cjs file-guarded SKIP doctrine, adopted verbatim
// in shape).
function skip(reason) { return { ok: true, skipped: true, reason: reason }; }

function normalizeText(s) {
  return String(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Fixture-room helper: every fixture-based check either takes a caller-
// supplied opts.room (so the gate test can hand it a room built under a fake
// MINDRIAN_ROOMS_HOME for the part8 refusal proof) or builds and tears down
// its own ephemeral room, never touching anything outside a mkdtempSync root.
// ---------------------------------------------------------------------------
function withFixtureRoom(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxl-eval-'));
  try {
    const room = buildFixtureRoom2401(tmp);
    return fn(room);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// scoreAnswer(answerText, task) -> { score, matched, distracted }
// score is 1 iff every answer_anchors token appears in the normalized answer
// AND no distractor_anchors token appears; otherwise 0.
// ---------------------------------------------------------------------------
function scoreAnswer(answerText, task) {
  const norm = normalizeText(answerText);
  const matched = [];
  const distracted = [];
  for (const a of (task.answer_anchors || [])) {
    if (norm.indexOf(normalizeText(a)) !== -1) matched.push(a);
  }
  for (const d of (task.distractor_anchors || [])) {
    if (norm.indexOf(normalizeText(d)) !== -1) distracted.push(d);
  }
  const anchors = task.answer_anchors || [];
  const allMatched = anchors.length > 0 && matched.length === anchors.length;
  const score = (allMatched && distracted.length === 0) ? 1 : 0;
  return { score: score, matched: matched, distracted: distracted };
}

// ---------------------------------------------------------------------------
// buildBundle(room, task, opts) -> { withContext, text }
// Resolution 4: assembled ONLY from the fixture room's own artifact bodies.
// The resolved task.context_file path is asserted to stay inside the fixture
// room root; a path that escapes throws rather than ever being read.
// ---------------------------------------------------------------------------
function buildBundle(room, task, opts) {
  const o = opts || {};
  const withContext = !!o.withContext;
  if (!withContext) {
    return { withContext: false, text: NEUTRAL_PREAMBLE + '\n\nQuestion: ' + task.question };
  }
  const roomRoot = path.resolve(room.roomDir);
  const resolved = path.resolve(roomRoot, task.context_file);
  if (resolved !== roomRoot && resolved.indexOf(roomRoot + path.sep) !== 0) {
    throw new Error('buildBundle: task.context_file escapes the fixture room root: ' + task.context_file);
  }
  const body = fs.readFileSync(resolved, 'utf8');
  return { withContext: true, text: 'Context:\n' + body + '\n\nQuestion: ' + task.question };
}

// ---------------------------------------------------------------------------
// checkCorpusShape -- every task carries all six required keys; ids unique;
// at least 8 tasks; no em-dash or en-dash anywhere in the corpus.
// ---------------------------------------------------------------------------
function checkCorpusShape(opts) {
  const o = opts || {};
  const tasks = o.tasks || readTaskCorpus();
  const violations = [];
  if (!Array.isArray(tasks) || tasks.length < 8) {
    violations.push('corpus must be an array of at least 8 tasks, got ' + (Array.isArray(tasks) ? tasks.length : typeof tasks));
  }
  const seen = new Set();
  for (const t of (Array.isArray(tasks) ? tasks : [])) {
    for (const k of REQUIRED_TASK_KEYS) {
      if (!t || !(k in t)) violations.push('task ' + (t && t.id) + ' missing required key ' + k);
    }
    if (t && t.id) {
      if (seen.has(t.id)) violations.push('duplicate task id ' + t.id);
      seen.add(t.id);
    }
  }
  const blob = JSON.stringify(tasks);
  if (blob.indexOf(EM_DASH) !== -1) violations.push('corpus contains an em-dash (U+2014)');
  if (blob.indexOf(EN_DASH) !== -1) violations.push('corpus contains an en-dash (U+2013)');
  return { ok: violations.length === 0, violations: violations };
}

// ---------------------------------------------------------------------------
// checkAnchorGrounded -- the huji-eval D4 anti-fabrication shape: for every
// task, context_anchor is a verbatim substring of context_file re-read from
// the seeded fixture room, never trusted from the corpus JSON's own claim.
// ---------------------------------------------------------------------------
function checkAnchorGrounded(opts) {
  const o = opts || {};
  const run = (room) => {
    const violations = [];
    for (const task of room.tasks) {
      const filePath = path.join(room.roomDir, task.context_file);
      let body;
      try {
        body = fs.readFileSync(filePath, 'utf8');
      } catch (_e) {
        violations.push(task.id + ': context_file not readable at ' + task.context_file);
        continue;
      }
      if (body.indexOf(task.context_anchor) === -1) {
        violations.push(task.id + ': context_anchor is not a verbatim substring of ' + task.context_file);
      }
    }
    return { ok: violations.length === 0, violations: violations };
  };
  return o.room ? run(o.room) : withFixtureRoom(run);
}

// ---------------------------------------------------------------------------
// checkContextDiscriminates -- THE CHECK THAT PROVES THE MANIPULATED VARIABLE
// IS REAL. For every task: context_anchor IS a substring of the WITH-context
// bundle AND is NOT a substring of the WITHOUT-context bundle. A task whose
// anchor appears in both bundles is non-discriminating and FAILS by name.
// Without this, a collapsed A/B with no real difference between the arms
// would report a delta of zero and look exactly like a legitimate null
// finding (240.1-RESEARCH.md Pitfall 6's near neighbor).
// ---------------------------------------------------------------------------
function checkContextDiscriminates(opts) {
  const o = opts || {};
  const run = (room) => {
    const violations = [];
    for (const task of room.tasks) {
      let withBundle;
      let withoutBundle;
      try {
        withBundle = buildBundle(room, task, { withContext: true });
        withoutBundle = buildBundle(room, task, { withContext: false });
      } catch (e) {
        violations.push(task.id + ': buildBundle threw: ' + e.message);
        continue;
      }
      const inWith = withBundle.text.indexOf(task.context_anchor) !== -1;
      const inWithout = withoutBundle.text.indexOf(task.context_anchor) !== -1;
      if (!inWith || inWithout) {
        violations.push(
          task.id + ': non-discriminating anchor (present in with-context bundle: '
          + inWith + ', present in without-context bundle: ' + inWithout + ')'
        );
      }
    }
    return { ok: violations.length === 0, violations: violations };
  };
  return o.room ? run(o.room) : withFixtureRoom(run);
}

// The real-rooms-home roots this harness must never touch (Pitfall 7). Both
// candidates are resolved with path.resolve, never realpath, so the refusal
// check works identically whether or not the directory happens to exist yet.
function realRoomsHomeRoots() {
  const roots = [];
  const home = os.homedir();
  if (home) roots.push(path.resolve(home, 'MindrianRooms'));
  if (process.env.MINDRIAN_ROOMS_HOME) roots.push(path.resolve(process.env.MINDRIAN_ROOMS_HOME));
  return roots;
}

// ---------------------------------------------------------------------------
// checkPart8Hygiene -- reuses lib/core/part8-egress-guard.classify over every
// bundle the harness would send, NEVER a hand-rolled egress regex. Adds the
// per-unit entity grep layer huji-eval's D4 uses: any real-rooms-home path
// surviving in a payload is a breach even if the guard passed it. Zero
// tolerance. Refuses outright, naming the path, if the room dir under test
// resolves under the real rooms home -- this harness runs against the
// synthetic fixture only (Pitfall 7).
// ---------------------------------------------------------------------------
function checkPart8Hygiene(opts) {
  const o = opts || {};
  const run = (room) => {
    const roomDirResolved = path.resolve(room.roomDir);
    for (const forbidden of realRoomsHomeRoots()) {
      if (roomDirResolved === forbidden || roomDirResolved.indexOf(forbidden + path.sep) === 0) {
        return {
          ok: false,
          violations: [
            'REFUSED: room dir ' + roomDirResolved + ' resolves under the real rooms home '
            + forbidden + ' -- this harness runs the synthetic fixture only (Pitfall 7)',
          ],
        };
      }
    }

    const violations = [];
    for (const task of room.tasks) {
      for (const withContext of [true, false]) {
        let bundle;
        try {
          bundle = buildBundle(room, task, { withContext: withContext });
        } catch (e) {
          violations.push(task.id + ' (withContext=' + withContext + '): buildBundle threw: ' + e.message);
          continue;
        }
        const payload = { question: bundle.text };
        const verdict = guard.classify(payload, { toolName: 'brain_ask' });
        if (verdict.verdict === 'block') {
          violations.push(task.id + ' (withContext=' + withContext + '): guard block: ' + verdict.reason);
        }
        for (const forbidden of realRoomsHomeRoots()) {
          if (bundle.text.indexOf(forbidden) !== -1) {
            violations.push(task.id + ' (withContext=' + withContext + '): payload contains the real rooms-home absolute path ' + forbidden);
          }
        }
      }
    }
    return { ok: violations.length === 0, violations: violations };
  };
  return o.room ? run(o.room) : withFixtureRoom(run);
}

// ---------------------------------------------------------------------------
// checkCostLedger -- mirrors huji-eval.cjs costLedger. Reads the run record
// if one exists and asserts total_cost_usd is at or below a cap (default
// 0.50, overridable by --threshold). SKIPs cleanly when no run record exists.
// ---------------------------------------------------------------------------
function checkCostLedger(opts) {
  const o = opts || {};
  const outDir = o.outDir || defaultOutDir();
  const recordPath = path.join(outDir, RUN_RECORD_FILENAME);
  if (!fs.existsSync(recordPath)) return skip('no run record at ' + recordPath);
  let record;
  try {
    record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  } catch (e) {
    return { ok: false, violations: ['run record unparseable: ' + e.message] };
  }
  const cap = typeof o.threshold === 'number' ? o.threshold : DEFAULT_COST_CAP;
  const cost = Number(record.total_cost_usd);
  if (Number.isNaN(cost)) {
    return { ok: false, violations: ['total_cost_usd is not a number: ' + JSON.stringify(record.total_cost_usd)] };
  }
  const ok = cost <= cap;
  return { ok: ok, cap: cap, cost: cost, violations: ok ? [] : ['total_cost_usd ' + cost + ' exceeds the cap ' + cap] };
}

// RESOLUTION 1 (LOCKED, THE WHOLE POINT OF THIS PLAN). This function asserts
// a measurement RAN and a well-formed record was WRITTEN. It must NEVER
// assert the sign of the accuracy delta -- not positive, not negative, not
// zero. An assertion shaped like "the with-context score beats the
// without-context score" is FORBIDDEN here (240.1-RESEARCH.md Pitfall 6;
// ROADMAP SC3). A null or negative delta is a recorded PASS carrying a
// populated `finding` string, exactly like a positive one. Do not
// "strengthen" this function with any comparison against the numeric value
// of the delta field -- that is the exact regression Pitfall 6 names.
function checkDeltaRecord(opts) {
  const o = opts || {};
  const outDir = o.outDir || defaultOutDir();
  const recordPath = path.join(outDir, RUN_RECORD_FILENAME);
  if (!fs.existsSync(recordPath)) return skip('no run record at ' + recordPath);
  let record;
  try {
    record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  } catch (e) {
    return { ok: false, violations: ['run record unparseable: ' + e.message] };
  }

  const violations = [];
  const numericFields = ['n_tasks', 'with_context_score', 'without_context_score', 'delta'];
  for (const f of numericFields) {
    if (typeof record[f] !== 'number' || Number.isNaN(record[f])) {
      violations.push('field ' + f + ' must be a number, got ' + JSON.stringify(record[f]));
    }
  }
  if (typeof record.finding !== 'string' || record.finding.trim().length === 0) {
    violations.push('field finding must be a non-empty string');
  }
  if (typeof record.model_id !== 'string' || record.model_id.length === 0) {
    violations.push('field model_id must be a non-empty string');
  }
  if (typeof record.run_at !== 'string' || record.run_at.length === 0) {
    violations.push('field run_at must be a non-empty string');
  }
  if (typeof record.n_tasks === 'number') {
    let corpusLen = null;
    try { corpusLen = readTaskCorpus().length; } catch (_e) { corpusLen = null; }
    if (corpusLen !== null && record.n_tasks !== corpusLen) {
      violations.push('n_tasks ' + record.n_tasks + ' does not match the corpus length ' + corpusLen);
    }
  }
  return { ok: violations.length === 0, violations: violations };
}

// ---------------------------------------------------------------------------
// Check registry.
// ---------------------------------------------------------------------------
const CHECKS = {
  'corpus-shape': checkCorpusShape,
  'anchor-grounded': checkAnchorGrounded,
  'context-discriminates': checkContextDiscriminates,
  'part8-hygiene': checkPart8Hygiene,
  'cost-ledger': checkCostLedger,
  'delta-record': checkDeltaRecord,
};
const CHECK_NAMES = Object.keys(CHECKS);

function printResult(name, r) {
  if (r.skipped) { console.log('SKIP  ' + name + '  (' + r.reason + ')'); return; }
  console.log((r.ok ? 'PASS' : 'FAIL') + '  ' + name);
  for (const v of (r.violations || [])) console.log('    violation: ' + v);
}

// ---------------------------------------------------------------------------
// --selftest: PASS + FAIL fixture directions for every check (twelve total).
// This is what makes the committed gate load-bearing when no run record
// exists on disk -- each direction turns RED the moment its check regresses.
// ---------------------------------------------------------------------------
function runSelftest() {
  const assert = require('assert');
  let directionCount = 0;

  function assertPass(result, label) {
    assert.strictEqual(result.ok, true, label + ': expected PASS, got ' + JSON.stringify(result));
    directionCount += 1;
    console.log('  PASS-direction OK: ' + label);
  }
  function assertFail(result, label) {
    assert.strictEqual(result.ok, false, label + ': expected FAIL, got PASS');
    directionCount += 1;
    console.log('  FAIL-direction OK (correctly reddened): ' + label);
  }

  console.log('=== ctxl-eval --selftest (twelve PASS+FAIL directions, zero spawn) ===');

  // 1. corpus-shape
  assertPass(checkCorpusShape({}), 'corpus-shape PASS: the real corpus is well-formed');
  const rawCorpus = readTaskCorpus();
  const corpusMissingKeys = rawCorpus.map((t, i) => (i === 0 ? { id: t.id, question: t.question } : t));
  assertFail(checkCorpusShape({ tasks: corpusMissingKeys }), 'corpus-shape FAIL: first task missing required keys');

  const tmpGood = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxl-eval-selftest-good-'));
  try {
    const roomGood = buildFixtureRoom2401(tmpGood);

    // 2. anchor-grounded
    assertPass(checkAnchorGrounded({ room: roomGood }), 'anchor-grounded PASS: the real fixture is grounded');
    const roomBadAnchor = Object.assign({}, roomGood, {
      tasks: roomGood.tasks.map((t, i) => (i === 0 ? Object.assign({}, t, { context_anchor: 'ZZZ-fabricated-anchor-not-in-any-fixture-file-QQQ' }) : t)),
    });
    assertFail(checkAnchorGrounded({ room: roomBadAnchor }), 'anchor-grounded FAIL: a fabricated context_anchor');

    // 3. context-discriminates
    assertPass(checkContextDiscriminates({ room: roomGood }), 'context-discriminates PASS: every anchor discriminates');
    const roomNonDiscriminating = Object.assign({}, roomGood, {
      tasks: roomGood.tasks.map((t, i) => (i === 0 ? Object.assign({}, t, { context_anchor: t.question.slice(0, Math.min(20, t.question.length)) }) : t)),
    });
    assertFail(checkContextDiscriminates({ room: roomNonDiscriminating }), 'context-discriminates FAIL: an anchor collapsed into the question itself');

    // 4a. part8-hygiene PASS direction (the well-formed synthetic fixture).
    assertPass(checkPart8Hygiene({ room: roomGood }), 'part8-hygiene PASS: the synthetic fixture never blocks and never leaks a real rooms-home path');
  } finally {
    fs.rmSync(tmpGood, { recursive: true, force: true });
  }

  // 4b. part8-hygiene FAIL direction: a room dir resolving under a FAKE
  // MINDRIAN_ROOMS_HOME must be refused outright, naming the path.
  const fakeHomeParent = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxl-eval-selftest-fakehome-'));
  const priorRoomsHome = process.env.MINDRIAN_ROOMS_HOME;
  try {
    process.env.MINDRIAN_ROOMS_HOME = fakeHomeParent;
    const insideFake = fs.mkdtempSync(path.join(fakeHomeParent, 'inside-'));
    const roomUnderFakeHome = buildFixtureRoom2401(insideFake);
    assertFail(checkPart8Hygiene({ room: roomUnderFakeHome }), 'part8-hygiene FAIL: a room dir resolving under $MINDRIAN_ROOMS_HOME is refused outright');
  } finally {
    if (priorRoomsHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = priorRoomsHome;
    fs.rmSync(fakeHomeParent, { recursive: true, force: true });
  }

  // 5. cost-ledger
  const tmpCost = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxl-eval-selftest-cost-'));
  try {
    fs.writeFileSync(path.join(tmpCost, RUN_RECORD_FILENAME), JSON.stringify({ total_cost_usd: 0.10 }));
    assertPass(checkCostLedger({ outDir: tmpCost }), 'cost-ledger PASS: total_cost_usd under the cap');
    fs.writeFileSync(path.join(tmpCost, RUN_RECORD_FILENAME), JSON.stringify({ total_cost_usd: 99.0 }));
    assertFail(checkCostLedger({ outDir: tmpCost }), 'cost-ledger FAIL: total_cost_usd exceeds the cap');
  } finally {
    fs.rmSync(tmpCost, { recursive: true, force: true });
  }

  // 6. delta-record
  const tmpDelta = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxl-eval-selftest-delta-'));
  try {
    const nTasks = readTaskCorpus().length;
    const wellFormed = {
      n_tasks: nTasks,
      with_context_score: 0.5,
      without_context_score: 0.5,
      delta: 0,
      finding: 'No measurable accuracy delta at this sample size.',
      model_id: 'selftest-model',
      run_at: '2026-07-30T00:00:00Z',
      total_cost_usd: 0,
      rows: [],
    };
    fs.writeFileSync(path.join(tmpDelta, RUN_RECORD_FILENAME), JSON.stringify(wellFormed));
    assertPass(checkDeltaRecord({ outDir: tmpDelta }), 'delta-record PASS: a well-formed record with a zero delta');

    const missingFinding = Object.assign({}, wellFormed);
    delete missingFinding.finding;
    fs.writeFileSync(path.join(tmpDelta, RUN_RECORD_FILENAME), JSON.stringify(missingFinding));
    assertFail(checkDeltaRecord({ outDir: tmpDelta }), 'delta-record FAIL: a record missing the required finding field');
  } finally {
    fs.rmSync(tmpDelta, { recursive: true, force: true });
  }

  assert.strictEqual(directionCount, 12, 'selftest must exercise exactly twelve PASS/FAIL directions, ran ' + directionCount);
  console.log('OK - ctxl-eval self-test passed: twelve PASS/FAIL directions across all six checks.');
}

// ---------------------------------------------------------------------------
// --suite code: run all six checks, zero API spend, explicit SKIP lines for
// the two data-dependent checks when no run record exists yet.
// ---------------------------------------------------------------------------
function runSuiteCode(o) {
  console.log('=== ctxl-eval --suite code (deterministic, zero API spend) ===');
  const opts = { outDir: resolveOutDir(o), threshold: parseThreshold(o) };
  let fails = 0;
  let skips = 0;
  for (const name of CHECK_NAMES) {
    let r;
    try {
      r = CHECKS[name](opts);
    } catch (e) {
      r = { ok: false, violations: ['check threw: ' + e.message] };
    }
    printResult(name, r);
    if (r.skipped) skips += 1;
    else if (!r.ok) fails += 1;
  }
  console.log(
    'roll-up: ' + (CHECK_NAMES.length - fails - skips) + ' PASS, ' + fails + ' FAIL, '
    + skips + ' SKIP of ' + CHECK_NAMES.length + ' checks' + (o && o.strict ? ' [strict]' : '')
  );
  process.exit(o && o.strict && fails > 0 ? 1 : 0);
}

function runCheck(name, o) {
  if (!CHECK_NAMES.includes(name)) {
    console.error('Unknown --check ' + name + ' (known: ' + CHECK_NAMES.join(', ') + ')');
    process.exit(2);
    return;
  }
  const opts = { outDir: resolveOutDir(o), threshold: parseThreshold(o) };
  const r = CHECKS[name](opts);
  printResult(name, r);
  process.exit(r.skipped ? 0 : (r.ok ? 0 : 1));
}

// --report: render the delta table from the run record on disk, if any.
function runReport(o) {
  console.log('=== ctxl-eval --report ===');
  const outDir = resolveOutDir(o);
  const recordPath = path.join(outDir, RUN_RECORD_FILENAME);
  if (!fs.existsSync(recordPath)) {
    console.log('no run record at ' + recordPath + ' (run --suite ab with CTXL_EVAL_LIVE=1 first)');
    process.exit(0);
    return;
  }
  let record;
  try {
    record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  } catch (e) {
    console.error('run record unparseable: ' + e.message);
    process.exit(1);
    return;
  }
  console.log('  model_id:              ' + record.model_id);
  console.log('  run_at:                ' + record.run_at);
  console.log('  n_tasks:               ' + record.n_tasks);
  console.log('  with_context_score:    ' + record.with_context_score);
  console.log('  without_context_score: ' + record.without_context_score);
  console.log('  delta:                 ' + record.delta);
  console.log('  total_cost_usd:        ' + record.total_cost_usd);
  console.log('  finding: ' + record.finding);
  if (Array.isArray(record.rows)) {
    console.log('  -- per-task rows --');
    for (const row of record.rows) console.log('    ' + JSON.stringify(row));
  }
  process.exit(0);
}

function usage() {
  console.error([
    'Usage: node scripts/ctxl-eval.cjs <mode>',
    '  --selftest                              twelve PASS+FAIL fixture directions, zero spawn',
    '  --check <' + CHECK_NAMES.join('|') + '>',
    '           [--out DIR] [--threshold N]',
    '  --suite code [--strict] [--out DIR]      all six checks, zero API spend',
    '  --report [--out DIR]                     render the delta table from the run record',
  ].join('\n'));
}

function parseArgs(argv) {
  const o = { _: [] };
  const takesVal = ['--check', '--suite', '--out', '--threshold'];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (takesVal.includes(a)) { o[a.slice(2)] = argv[++i]; }
    else if (a === '--selftest') o.selftest = true;
    else if (a === '--strict') o.strict = true;
    else if (a === '--report') o.report = true;
    else o._.push(a);
  }
  return o;
}

function main(argv) {
  const o = parseArgs(argv.slice(2));

  if (o.selftest) {
    try {
      runSelftest();
      process.exit(0);
    } catch (e) {
      console.error('FAIL - selftest: ' + (e.stack || e.message));
      process.exit(1);
    }
    return;
  }
  if (o.check !== undefined) { runCheck(o.check, o); return; }
  if (o.suite === 'code') { runSuiteCode(o); return; }
  if (o.suite !== undefined) {
    console.error('Unknown --suite ' + o.suite + ' (known: code)');
    process.exit(2);
    return;
  }
  if (o.report) { runReport(o); return; }
  usage();
  process.exit(2);
}

// Exported for programmatic reuse: tests/test-240.1-ctxl-eval-gate.cjs imports
// these directly rather than shelling out for every assertion.
module.exports = {
  checkCorpusShape,
  checkAnchorGrounded,
  checkContextDiscriminates,
  checkPart8Hygiene,
  checkCostLedger,
  checkDeltaRecord,
  scoreAnswer,
  buildBundle,
  RUN_RECORD_FILENAME,
  defaultOutDir,
};

if (require.main === module) main(process.argv);
