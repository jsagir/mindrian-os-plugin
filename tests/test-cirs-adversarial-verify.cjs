'use strict';
/*
 * Phase 172-14 (INV-15) - THE adversarial red-team verify with a STRUCTURED
 * pass/fail verdict over the WHOLE coverage contract (CIRS R1-R14).
 *
 * This is the harness-as-code Phase V (property 6: an adversarial verify
 * returning a structured verdict). It is the final barrier of Phase 172: it
 * proves BY CONSTRUCTION that the born-wired hard gate catches the EXACT two
 * failure modes that caused the recurring 143.x / 144.1 regressions:
 *
 *   (1) a DARK SURFACE   - a surface neither WIRED nor EXCLUDED, on BOTH hard
 *                          gates (the connector gate AND, via the dark commands/
 *                          probe, the projection gate's command ledger);
 *   (2) a SECOND SELECTION BRAIN - a re-introduced ungoverned decideFn in
 *                          /mos:act (the () => null second brain) + act.md not
 *                          connector-wired.
 *
 * It also asserts the POSITIVE coverage contract that must hold at phase close:
 *   - rs-* family fires context_block on its sensor;
 *   - navigation-engine.cjs reachIdToSkillFamily has the `hats` case;
 *   - the coverage ledger has zero un-decided gaps (counts.gap === 0) on BOTH
 *     ledgers (connector + projection command);
 *   - the frozen invariants are intact: REACH_IDS=6, POSTURE_IDS=3,
 *     DIAL_REACH_K=6, MAX_K=3.
 *
 * Every assertion is checkable (a source grep, a registry/ledger read, or a
 * coverageReport call). The test EMITS a structured verdict object
 *   { pass: boolean, assertions: [{ id, name, status }] }
 * (printed AND returned via module.exports.runVerdict()), and exits non-zero if
 * any assertion FAILs.
 *
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain, zero network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CONN_GEN = path.join(REPO_ROOT, 'scripts', 'build-connector-registry.cjs');
const PROJ_GEN = path.join(REPO_ROOT, 'scripts', 'build-orchestration-projection.cjs');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'coverage-gate-dark');
const DARK_FIXTURE = path.join(FIXTURE_DIR, 'DARK-FIXTURE.md');

const connGen = require(CONN_GEN);
const sensorTypes = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-types.cjs'));
const dialOrch = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));

// ---------------------------------------------------------------------------
// The structured verdict accumulator. Each check appends {id, name, status}.
// status is 'PASS' | 'FAIL'. The overall verdict.pass is the AND of every row.
// ---------------------------------------------------------------------------
const assertions = [];
function record(id, name, cond) {
  const status = cond ? 'PASS' : 'FAIL';
  assertions.push({ id, name, status });
  console.log('  ' + status + ' - [' + id + '] ' + name);
  return !!cond;
}

function readSource(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

// ===========================================================================
// THE RED-TEAM ATTACKS (the two failure modes the gate must catch).
// ===========================================================================

// ---- Attack 1: a DARK SURFACE on the connector gate (in-memory classify) ----
const darkSrc = { kind: 'command', base: '__adv_dark__', file: DARK_FIXTURE };
const darkClass = connGen.classifySurface(darkSrc);
record('ADV-01a', 'red-team dark surface classifies state=gap (connector gate sees it)',
  darkClass && darkClass.state === 'gap');

// ---- Attack 1 (end-to-end): a dark surface PRESENT in commands/ trips BOTH
//      hard gates non-zero. We copy the dark fixture into commands/ under a temp
//      name, spawn each --check, and ALWAYS remove it (finally) so no tracked
//      file is mutated. The connector gate walks commands/; the projection gate
//      reads the command ledger derived from the same surface set, so a bare
//      dark command trips it too. ----
const TEMP_NAME = '__cirs_adversarial_dark_probe__.md';
const TEMP_PATH = path.join(COMMANDS_DIR, TEMP_NAME);
let connDark;
let projDark;
try {
  fs.copyFileSync(DARK_FIXTURE, TEMP_PATH);
  connDark = cp.spawnSync('node', [CONN_GEN, '--check'], { encoding: 'utf8', timeout: 60000 });
  projDark = cp.spawnSync('node', [PROJ_GEN, '--check'], { encoding: 'utf8', timeout: 60000 });
} finally {
  try { fs.unlinkSync(TEMP_PATH); } catch (_e) { /* best-effort */ }
}
record('ADV-01b', 'dark surface trips the CONNECTOR hard gate (exit non-zero)',
  connDark && connDark.status !== 0);
record('ADV-01c', 'CONNECTOR gate FAIL names the dark surface',
  connDark && (connDark.stderr || '').indexOf('/mos:__cirs_adversarial_dark_probe__') !== -1);
record('ADV-01d', 'dark surface trips the PROJECTION hard gate (exit non-zero)',
  projDark && projDark.status !== 0);
record('ADV-01e', 'temp dark probe removed (zero tracked-file mutation)',
  !fs.existsSync(TEMP_PATH));

// ---- Attack 2: a SECOND SELECTION BRAIN re-appears in /mos:act ----
// The original regression was `decideFn: () => null` (or the equivalent
// `function () { return null; }`) at the TOP-LEVEL of the runChain call - an
// ungoverned second selection path. The cure feeds the REAL decide() via
// loadRealDecide(). The red-team asserts: (a) act-command.cjs carries
// loadRealDecide (the real engine is fed) and (b) it carries NO ungoverned
// top-level decideFn that returns null without first loading the real engine.
const actSrc = readSource('scripts/act-command.cjs');
record('ADV-02a', 'act-command.cjs feeds the REAL decide() (loadRealDecide present)',
  /loadRealDecide\s*\(/.test(actSrc) && /navigation-engine\.cjs/.test(actSrc));
// The ungoverned form is an ASSIGNMENT `decideFn: () => null` or
// `decideFn: function () { return null; }` NOT preceded by the real-engine load.
// Any literal `decideFn:` followed directly by an arrow/function returning null
// is the second brain. We assert no such bare assignment exists (the only
// live `decideFn:` is the IIFE that loads realDecide). The source carries the
// removed form ONLY in a documentary comment ("decideFn: () => null was that
// second brain; it is gone"), so we strip line + block comments before the grep
// to avoid a false-positive on the prose that records the cure.
const actCodeOnly = actSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')   // strip block comments
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))  // strip trailing line comments
  .join('\n');
const ungovernedDecideFn =
  /decideFn:\s*\(\s*\)\s*=>\s*null/.test(actCodeOnly) ||
  /decideFn:\s*function\s*\(\s*\)\s*\{\s*return\s+null\s*;?\s*\}/.test(actCodeOnly);
record('ADV-02b', 'act-command.cjs carries NO ungoverned () => null decideFn (second brain closed)',
  !ungovernedDecideFn);
// act.md must be connector-wired (the surface is governed, not dark).
const actMd = readSource('commands/act.md');
record('ADV-02c', 'act.md is connector-wired (connects_to_spine: true)',
  /connects_to_spine:\s*true/.test(actMd));

// ===========================================================================
// THE POSITIVE COVERAGE CONTRACT (what must hold at phase close).
// ===========================================================================

// ---- rs-* family fires context_block on its sensor ----
const reg = require(path.join(REPO_ROOT, 'data', 'connector-registry.json'));
const connectors = Array.isArray(reg.connectors) ? reg.connectors
  : (Array.isArray(reg) ? reg : Object.values(reg.connectors || reg));
const rsFamily = connectors.filter((c) => /\/mos:rs-/.test(String(c.surface || '')));
const rsAllContextBlock = rsFamily.length > 0 &&
  rsFamily.every((c) => c.reach_id === 'context_block' &&
    Array.isArray(c.sensor_triggers) && c.sensor_triggers.length > 0);
record('ADV-03', 'rs-* family fires context_block on its sensor (reach_id + sensor_triggers)',
  rsAllContextBlock);

// ---- navigation-engine has the hats case ----
const engineSrc = readSource('lib/core/navigation-engine.cjs');
const hatsCase = /case\s+'hats':/.test(engineSrc) &&
  /reachIdToSkillFamily/.test(engineSrc);
record('ADV-04', 'navigation-engine.cjs reachIdToSkillFamily has the hats case',
  hatsCase);

// ---- counts.gap === 0 on BOTH ledgers ----
const connReport = connGen.coverageReport();
record('ADV-05a', 'connector ledger counts.gap === 0',
  connReport && connReport.counts && connReport.counts.gap === 0);
record('ADV-05b', 'connector ledger has zero excluded-without-reason errors',
  connReport && Array.isArray(connReport.errors) && connReport.errors.length === 0);
let projLedger;
try {
  projLedger = require(path.join(REPO_ROOT, 'data', 'orchestration-command-ledger.json'));
} catch (_e) { projLedger = null; }
record('ADV-05c', 'projection command ledger counts.gap === 0',
  projLedger && projLedger.counts && projLedger.counts.gap === 0);

// ---- frozen invariants intact ----
record('ADV-06a', 'frozen REACH_IDS length === 6',
  Array.isArray(sensorTypes.REACH_IDS) && sensorTypes.REACH_IDS.length === 6);
record('ADV-06b', 'frozen POSTURE_IDS length === 3',
  Array.isArray(sensorTypes.POSTURE_IDS) && sensorTypes.POSTURE_IDS.length === 3);
record('ADV-06c', 'frozen DIAL_REACH_K === 6',
  dialOrch.DIAL_REACH_K === 6);
record('ADV-06d', 'frozen MAX_K === 3',
  ranker.MAX_K === 3);

// ---- the clean live repo passes BOTH hard gates (no false-positive) ----
const cleanConn = cp.spawnSync('node', [CONN_GEN, '--check'], { encoding: 'utf8', timeout: 60000 });
const cleanProj = cp.spawnSync('node', [PROJ_GEN, '--check'], { encoding: 'utf8', timeout: 60000 });
record('ADV-07a', 'clean live repo passes the CONNECTOR hard gate (exit 0)',
  cleanConn && cleanConn.status === 0);
record('ADV-07b', 'clean live repo passes the PROJECTION hard gate (exit 0)',
  cleanProj && cleanProj.status === 0);

// ===========================================================================
// THE STRUCTURED VERDICT.
// ===========================================================================
function buildVerdict() {
  const failed = assertions.filter((a) => a.status === 'FAIL');
  return {
    pass: failed.length === 0,
    assertions: assertions.slice(),
    summary: {
      total: assertions.length,
      passed: assertions.length - failed.length,
      failed: failed.length,
    },
  };
}

const verdict = buildVerdict();

console.log('');
console.log('=== CIRS ADVERSARIAL VERDICT ===');
console.log(JSON.stringify({ pass: verdict.pass, summary: verdict.summary }, null, 2));
console.log('');

// Hard guarantee: exit non-zero if ANY assertion failed.
if (!verdict.pass) {
  console.error('>>> test-cirs-adversarial-verify.cjs: FAILED (' +
    verdict.summary.failed + ' assertion(s) red)');
  process.exitCode = 1;
} else {
  console.log('PASS ' + verdict.summary.passed + ' assertions');
  console.log('>>> test-cirs-adversarial-verify.cjs: PASSED');
}

// Belt-and-suspenders: a final assert so a swallowed exitCode still fails the run.
assert.ok(verdict.pass, 'CIRS adversarial verdict must be pass=true');

module.exports = { runVerdict: buildVerdict };
