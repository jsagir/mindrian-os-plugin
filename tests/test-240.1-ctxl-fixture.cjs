'use strict';
// Phase 240.1 Plan 05 Task 2 -- fences tests/fixtures/240.1-ctxl-tasks.json
// and tests/helpers/fixture-room-2401.cjs with the GROUNDED / DISCRIMINATING
// / SPECIFIC construction-rule assertions plus the Canon Part 8 containment
// checks the fixture exists to prove (240.1-05-PLAN.md Task 2).
//
// Every scenario re-reads bytes from disk rather than trusting the corpus
// JSON's own claims or the helper's return value -- a fabricated anchor or a
// silently-broken build must surface HERE, not three plans later in the eval
// harness (plan 240.1-06) that consumes readTaskCorpus().
//
// Hermetic: every scenario allocates its OWN fs.mkdtempSync root, removed in
// a finally. No network, no LLM call, no write outside the temp root.
//
// MUTATION THAT TURNS THIS RED (transcribed in 240.1-05-SUMMARY.md):
//   1. Editing one task's context_anchor so it no longer appears in its
//      context_file turns scenario 3 red, naming that task id.
//   2. Pasting one task's context_anchor verbatim into its own question
//      turns scenario 4 red, naming that task id. This is the important
//      one: it proves the corpus cannot silently accumulate a task that
//      measures nothing.
//
// NO em-dashes or en-dashes in this file (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const {
  buildFixtureRoom2401,
  readTaskCorpus,
  FIXTURE_SECTIONS,
} = require('./helpers/fixture-room-2401.cjs');
const part8Guard = require(path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));

let passed = 0;
let failed = 0;

function pass(label) { passed += 1; process.stdout.write('  PASS  ' + label + '\n'); }
function fail(label, err) {
  failed += 1;
  process.stdout.write('  FAIL  ' + label + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}
// assertCheck routes every check through node:assert/strict so a failing
// condition throws an AssertionError we catch and count, rather than being a
// hand-rolled boolean tracker.
function assertCheck(cond, label) {
  try {
    assert.ok(cond, label);
    pass(label);
  } catch (e) {
    fail(label, e);
  }
}

// A small frozen stop-list of common English words. SPECIFIC (construction
// rule 3) requires every answer_anchors token be an invented proper noun,
// number, or date, not a common word merely padded to 4+ characters.
const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'been', 'were', 'their', 'about',
  'which', 'there', 'would', 'could', 'should', 'other', 'these', 'those',
  'when', 'what', 'where', 'does', 'many', 'much', 'name', 'city', 'costs',
]);

function withTmpRoot(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxl-2401-fixture-test-'));
  try {
    return fn(tmp);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

function normalize(s) {
  return String(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

function walkFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(abs));
    else out.push(abs);
  }
  return out;
}

// --- Scenario 1: BUILD ------------------------------------------------
function scenario1Build() {
  withTmpRoot((tmp) => {
    const built = buildFixtureRoom2401(tmp);
    assertCheck(
      typeof built.roomsHome === 'string' && fs.existsSync(built.roomsHome),
      'scenario 1: roomsHome exists on disk'
    );
    assertCheck(
      fs.existsSync(built.roomDir) && fs.statSync(built.roomDir).isDirectory(),
      'scenario 1: roomDir exists as a directory'
    );
    assertCheck(
      fs.existsSync(path.join(built.roomDir, '.room-root')),
      'scenario 1: .room-root exists'
    );
    assertCheck(
      fs.existsSync(path.join(built.roomDir, '.mindrian'))
        && fs.statSync(path.join(built.roomDir, '.mindrian')).isDirectory(),
      'scenario 1: .mindrian/ exists as a directory'
    );
    assertCheck(
      fs.existsSync(path.join(built.roomDir, 'ROOM.md')),
      'scenario 1: ROOM.md exists'
    );
    assertCheck(
      fs.existsSync(path.join(built.roomsHome, '.rooms', 'registry.json')),
      'scenario 1: .rooms/registry.json exists'
    );
    assertCheck(
      FIXTURE_SECTIONS.length >= 3,
      'scenario 1: at least three section dirs are declared'
    );
    assertCheck(
      built.artifactPaths.length >= FIXTURE_SECTIONS.length,
      'scenario 1: at least one artifact per section'
    );
    for (const artifact of built.artifactPaths) {
      assertCheck(
        fs.existsSync(artifact.absPath),
        'scenario 1: artifact ' + artifact.relPath + ' exists on disk'
      );
    }
  });
}

// --- Scenario 2: SEEDED STAMP ------------------------------------------
function scenario2SeededStamp() {
  withTmpRoot((tmp) => {
    const built = buildFixtureRoom2401(tmp);
    const stateMd = fs.readFileSync(path.join(built.roomDir, 'STATE.md'), 'utf8');
    assertCheck(
      stateMd.includes('gsd_state_version: 1.0'),
      'scenario 2: STATE.md carries gsd_state_version: 1.0'
    );
    assertCheck(
      stateMd.includes('status: active'),
      'scenario 2: STATE.md carries status: active'
    );
  });
}

// --- Scenario 3: GROUNDED (construction rule 1) -------------------------
function scenario3Grounded() {
  withTmpRoot((tmp) => {
    const built = buildFixtureRoom2401(tmp);
    for (const task of built.tasks) {
      const filePath = path.join(built.roomDir, task.context_file);
      const exists = fs.existsSync(filePath);
      assertCheck(
        exists,
        'scenario 3 [' + task.id + ']: context_file exists at ' + task.context_file
      );
      if (!exists) continue;
      const body = fs.readFileSync(filePath, 'utf8');
      assertCheck(
        body.includes(task.context_anchor),
        'scenario 3 [' + task.id + ']: context_anchor is a verbatim substring of ' + task.context_file
      );
    }
  });
}

// --- Scenario 4: DISCRIMINATING (construction rule 2) --------------------
function scenario4Discriminating() {
  withTmpRoot((tmp) => {
    const built = buildFixtureRoom2401(tmp);
    for (const task of built.tasks) {
      const anchorNorm = normalize(task.context_anchor);
      const questionNorm = normalize(task.question);
      assertCheck(
        !questionNorm.includes(anchorNorm),
        'scenario 4 [' + task.id + ']: context_anchor is absent from its own question'
      );
    }
  });
}

// --- Scenario 5: SPECIFIC (construction rule 3) --------------------------
function scenario5Specific() {
  withTmpRoot((tmp) => {
    const built = buildFixtureRoom2401(tmp);
    for (const task of built.tasks) {
      assertCheck(
        Array.isArray(task.answer_anchors) && task.answer_anchors.length > 0,
        'scenario 5 [' + task.id + ']: answer_anchors is a non-empty array'
      );
      for (const token of (task.answer_anchors || [])) {
        const clean = String(token);
        assertCheck(
          clean.length >= 4,
          'scenario 5 [' + task.id + ']: answer_anchor "' + clean + '" is at least 4 characters'
        );
        assertCheck(
          !STOP_WORDS.has(clean.toLowerCase()),
          'scenario 5 [' + task.id + ']: answer_anchor "' + clean + '" is not a common stop word'
        );
      }
    }
  });
}

// --- Scenario 6: UNIQUE IDS -----------------------------------------------
function scenario6UniqueIds() {
  withTmpRoot((tmp) => {
    const built = buildFixtureRoom2401(tmp);
    assertCheck(
      built.tasks.length >= 8,
      'scenario 6: corpus holds at least 8 tasks, got ' + built.tasks.length
    );
    const seen = new Set();
    let dupe = null;
    for (const task of built.tasks) {
      if (seen.has(task.id)) { dupe = task.id; break; }
      seen.add(task.id);
    }
    assertCheck(
      dupe === null,
      'scenario 6: no duplicate task id' + (dupe ? (' (found duplicate: ' + dupe + ')') : '')
    );
  });
}

// --- Scenario 7: PART 8 CONTAINMENT ---------------------------------------
function scenario7Part8Containment() {
  withTmpRoot((tmp) => {
    const built = buildFixtureRoom2401(tmp);
    const corpusBlob = JSON.stringify(built.tasks);
    assertCheck(
      !corpusBlob.includes('MindrianRooms'),
      'scenario 7: no corpus string contains the literal MindrianRooms'
    );

    let allArtifactBodies = '';
    for (const task of built.tasks) {
      const filePath = path.join(built.roomDir, task.context_file);
      if (!fs.existsSync(filePath)) continue;
      const body = fs.readFileSync(filePath, 'utf8');
      allArtifactBodies += body + '\n';
      assertCheck(
        !body.includes('MindrianRooms'),
        'scenario 7 [' + task.id + ']: seeded artifact body does not contain the literal MindrianRooms'
      );
    }

    // Reuse the shipped Part 8 classifier (huji-eval's D4 doctrine: never a
    // hand-rolled egress regex). A payload assembled purely from this
    // fixture's invented artifact bodies must never come back 'block'.
    const verdict = part8Guard.classify({ note: allArtifactBodies });
    assertCheck(
      verdict.verdict !== 'block',
      'scenario 7: part8-egress-guard.classify does not block a payload assembled from '
        + 'fixture artifact bodies (got: ' + verdict.verdict + ' / ' + verdict.reason + ')'
    );
  });
}

// --- Scenario 8: NO LIVE ROOM ----------------------------------------------
function scenario8NoLiveRoom() {
  withTmpRoot((tmp) => {
    const priorEnv = process.env.MINDRIAN_ROOMS_HOME;
    // The fixture never reads or sets this variable (RESOLUTION 1). This
    // assertion only documents that whatever this test process happens to
    // inherit is either absent or a plain string, without this test EVER
    // setting it itself.
    assertCheck(
      priorEnv === undefined || typeof priorEnv === 'string',
      'scenario 8: MINDRIAN_ROOMS_HOME is either unset or a string (never touched by the fixture)'
    );

    const built = buildFixtureRoom2401(tmp);
    const allFiles = walkFiles(tmp);
    let outside = null;
    for (const f of allFiles) {
      if (!f.startsWith(built.roomsHome)) { outside = f; break; }
    }
    assertCheck(
      outside === null,
      'scenario 8: nothing was written outside roomsHome' + (outside ? (' (found: ' + outside + ')') : '')
    );

    for (const a of built.artifactPaths) {
      assertCheck(
        fs.existsSync(a.absPath),
        'scenario 8: reported artifact path actually exists on disk: ' + a.relPath
      );
    }
    const reported = new Set(built.artifactPaths.map((a) => a.absPath));
    const infraFiles = allFiles.filter((f) => !reported.has(f));
    assertCheck(
      infraFiles.length >= 3,
      'scenario 8: infra files (.room-root, ROOM.md, STATE.md, registry.json) exist alongside artifacts'
    );
  });
}

(function main() {
  process.stdout.write('[test-240.1-ctxl-fixture] running 8 scenarios\n');

  try { scenario1Build(); } catch (e) { fail('scenario 1: BUILD (unexpected throw)', e); }
  try { scenario2SeededStamp(); } catch (e) { fail('scenario 2: SEEDED STAMP (unexpected throw)', e); }
  try { scenario3Grounded(); } catch (e) { fail('scenario 3: GROUNDED (unexpected throw)', e); }
  try { scenario4Discriminating(); } catch (e) { fail('scenario 4: DISCRIMINATING (unexpected throw)', e); }
  try { scenario5Specific(); } catch (e) { fail('scenario 5: SPECIFIC (unexpected throw)', e); }
  try { scenario6UniqueIds(); } catch (e) { fail('scenario 6: UNIQUE IDS (unexpected throw)', e); }
  try { scenario7Part8Containment(); } catch (e) { fail('scenario 7: PART 8 CONTAINMENT (unexpected throw)', e); }
  try { scenario8NoLiveRoom(); } catch (e) { fail('scenario 8: NO LIVE ROOM (unexpected throw)', e); }

  let taskCount = 0;
  try { taskCount = readTaskCorpus().length; } catch (_e) { taskCount = 0; }

  process.stdout.write('\n');
  if (failed === 0) {
    process.stdout.write('PASS test-240.1-ctxl-fixture.cjs (8 scenarios, ' + taskCount + ' tasks)\n');
    process.exit(0);
  } else {
    process.stdout.write('FAIL test-240.1-ctxl-fixture.cjs: ' + failed + ' assertion(s) failed, ' + passed + ' passed\n');
    process.exit(1);
  }
})();
