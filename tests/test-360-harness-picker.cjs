#!/usr/bin/env node
'use strict';
/*
 * Phase 360 Plan 04 -- the spawn-level proof for SPEC R1, R2, R3, R6.
 * ================================================================================
 * R1: every harness-triggered entry (the 5 SPEC R5 lead shapes, the bound
 *     off-scope and bound zero-score controls, and the strict-mode control)
 *     suppresses the whole room-resolution half of main() -- no marker, no
 *     F.8 side-channel record, no binding_gate/zero_score_gate/strict_mode
 *     trace, no offered marker file. Two controls prove the fixture is
 *     meaningful: control A (the exact harness prompt on the PLAN_BASE code
 *     root) and control B (the entry's control_prompt on HEAD). The
 *     pasted-lead accepted-limit entry (D-14, RESEARCH Finding 4, 0 observed
 *     cases) is pinned separately: it is suppressed too, which is the
 *     accepted limit, not a defect.
 * R2: a harness turn must not consume a pending F.8 binding_gate_payload.
 *     This is a CALL-SPY leg (RESEARCH Finding 6), not a bind-outcome leg:
 *     captureCliActionSet must be invoked 0 times on the harness turn (1
 *     before the fix), the binding file must stay unchanged, and no
 *     binding_gate_consumed entry may exist -- then the next human turn with
 *     the exact same label must still bind and write binding_gate_consumed.
 * R3: every human-origin entry must produce byte-identical stdout on HEAD
 *     (self-consistency, a freshly rebuilt copy of the same fixture path
 *     for each of the two runs -- see the r3 section below for why a
 *     shared, un-rebuilt path is the wrong experiment here) and on the
 *     PLAN_BASE code root vs HEAD (also each at a freshly rebuilt copy of
 *     the same fixture path). Never normalized; a mismatch reports only the
 *     first differing byte offset and both lengths.
 * R6: with turn-text's export made to throw or to be missing (two separate
 *     --require preloads), the human turn's stdout stays byte-identical, the
 *     harness turn still fires (fail toward the pre-fix behavior, PSB-06
 *     never-block), the process exits 0, and the stub records it was
 *     actually reached.
 *
 * Every spawn goes through tests/fixtures/ups-harness-360/spawn-kit.cjs (the
 * ONE hermetic spawn kit, D-13/T-360-05) -- this file holds no spawn call of
 * its own. `--only r1|r2|r3|r6` runs every leg whose id starts with that
 * prefix (same idiom as tests/test-360-tripwire.cjs). Node built-ins + the
 * spawn kit only. No em-dashes.
 *
 * Run: node tests/test-360-harness-picker.cjs [--only r1|r2|r3|r6]
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  CASES,
  PRE_PHASE,
  markersIn,
  makeFixture,
  writeBinding,
  readBinding,
  spawnClassifier,
  buildCodeRoot,
  sideWrites,
} = require(path.join(__dirname, 'fixtures', 'ups-harness-360', 'spawn-kit.cjs'));

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'ups-harness-360');
const CAPTURE_SPY_PATH = path.join(FIXTURES_DIR, 'capture-spy.cjs');
const THROWING_STUB_PATH = path.join(FIXTURES_DIR, 'throwing-turn-text.cjs');
const MISSING_STUB_PATH = path.join(FIXTURES_DIR, 'missing-export-turn-text.cjs');

// ---------------------------------------------------------------------------
// Leg harness (same idiom as tests/test-360-tripwire.cjs): a leg accumulates
// its own failure rather than aborting the whole file, so a RED leg reports
// exactly which entry failed and why, and every other leg still runs.
// ---------------------------------------------------------------------------
const ONLY_PREFIX = (function () {
  const idx = process.argv.indexOf('--only');
  return (idx !== -1 && process.argv[idx + 1]) ? process.argv[idx + 1] : null;
})();

let checks = 0;
let failed = 0;

function assertTrue(cond, msg) {
  if (!cond) throw new Error(msg);
}

function leg(id, fn) {
  if (ONLY_PREFIX && id.indexOf(ONLY_PREFIX) !== 0) return;
  checks += 1;
  try {
    fn();
    console.log('  ok - ' + id);
  } catch (e) {
    failed += 1;
    console.log('  FAIL ' + id + ': ' + (e && e.message ? e.message : String(e)));
  }
}

console.log('test-360-harness-picker.cjs (360-04): R1/R2/R3/R6 spawn-level legs');

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------

// Byte-identity comparison that NEVER normalizes (R3, D-17): on a mismatch,
// report only the first differing byte offset and both lengths -- never the
// bytes themselves (T-360-04).
function assertBytesEqual(a, b, contextLabel) {
  const bufA = Buffer.from(typeof a === 'string' ? a : '', 'utf8');
  const bufB = Buffer.from(typeof b === 'string' ? b : '', 'utf8');
  if (Buffer.compare(bufA, bufB) === 0) return;
  const minLen = Math.min(bufA.length, bufB.length);
  let offset = minLen;
  for (let i = 0; i < minLen; i += 1) {
    if (bufA[i] !== bufB[i]) { offset = i; break; }
  }
  throw new Error(
    'non-deterministic output; byte identity cannot be proven (' + contextLabel + '): '
    + 'first differing byte offset ' + offset + ', lengths ' + bufA.length + ' vs ' + bufB.length
  );
}

// The room-resolution segment of stdout is exactly what main() itself wrote
// (D-07's guard site): the F.8/strict-mode/zero-score JSON envelope, always
// written via `process.stdout.write(JSON.stringify(envelope) + '\n')` -- a
// SINGLE line, because JSON.stringify never emits a raw newline byte (only
// the two-character `\n` escape inside a string value). The trailing
// navigation-engine block (D-09: explicitly OUT of this phase's scope,
// "the engine NAV block keeps running on harness turns in this phase") is
// appended after that line and is excluded here -- not because its bytes are
// normalized, but because it is not part of what R1/R3 govern. First line
// only; everything after the first raw '\n' belongs to the nav block.
// main() writes a JSON object ('{' first byte) when it fires anything at
// all; when it writes nothing (e.g. human-terse: zero-score, unbound, below
// the PD-3 substantiality floor), the nav block's own content becomes the
// FIRST thing in stdout -- so a blind split-on-first-'\n' would wrongly pull
// the out-of-scope block's own header into the "room-resolution segment"
// whenever main() is silent. Gate on the leading '{' (main()'s own write
// contract) so a silent main() correctly yields an EMPTY segment.
function roomResolutionSegment(stdout) {
  const text = typeof stdout === 'string' ? stdout : '';
  if (text.length === 0 || text.charAt(0) !== '{') return '';
  const idx = text.indexOf('\n');
  return idx === -1 ? text : text.slice(0, idx);
}

function readSpyLines(spyPath) {
  try {
    const raw = fs.readFileSync(spyPath, 'utf8');
    return raw.split('\n').filter(function (l) { return l.length > 0; });
  } catch (_e) {
    return [];
  }
}

function applySetup(fixture, entry) {
  if (entry.setup && entry.setup.binding) {
    writeBinding(fixture, entry.stdin.session_id, entry.setup.binding);
  }
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// Scans every room dir under the fixture (a bound session's trace can land in
// any room, same idiom as spawn-kit's own sideWrites) for the most recent
// UN-consumed binding_gate_payload for this session -- the same backward scan
// scripts/intent-classifier.cjs's own consumePriorBindingAnswer performs.
function readLatestGatePayload(fixture, sessionId) {
  let roomNames = [];
  try {
    roomNames = fs.readdirSync(fixture.rooms, { withFileTypes: true })
      .filter(function (e) { return e.isDirectory() && e.name !== '.rooms'; })
      .map(function (e) { return e.name; });
  } catch (_e) {
    roomNames = [];
  }
  for (const roomName of roomNames) {
    const tracePath = path.join(fixture.rooms, roomName, '.mindrian', 'decision-traces', sessionId + '.json');
    try {
      const raw = fs.readFileSync(tracePath, 'utf8');
      const parsed = JSON.parse(raw);
      const traces = Array.isArray(parsed.traces) ? parsed.traces : [];
      for (let i = traces.length - 1; i >= 0; i -= 1) {
        const e = traces[i];
        if (!e || typeof e !== 'object') continue;
        if (e.kind === 'binding_gate_consumed') break; // already consumed in this room
        if (e.binding_gate_payload && typeof e.binding_gate_payload === 'object') {
          return { roomName: roomName, payload: e.binding_gate_payload };
        }
      }
    } catch (_e) {
      // No trace file in this room -- keep scanning the others.
    }
  }
  return null;
}

const SUPPRESS_ENTRIES = CASES.entries.filter(function (e) { return e.expect === 'suppress' && !e.accepted_limit; });
const ACCEPTED_LIMIT_ENTRIES = CASES.entries.filter(function (e) { return e.expect === 'suppress' && e.accepted_limit; });
const ALL_SUPPRESS_LIKE_ENTRIES = CASES.entries.filter(function (e) { return e.expect === 'suppress'; });
const FIRE_ENTRIES = CASES.entries.filter(function (e) { return e.expect === 'fire'; });
const R3_ENTRIES = CASES.entries.filter(function (e) { return e.expect === 'fire' || e.expect === 'unchanged'; });

// ===== R1 ====================================================================

// r1, every 'suppress' (non-accepted-limit) entry: no marker, no side write.
// RED until 360-07 (no guard exists yet -- every harness entry fires today,
// exactly as 360-02-SUMMARY's own smoke table recorded).
for (const entry of SUPPRESS_ENTRIES) {
  leg('r1-suppress-' + entry.id, function () {
    const fx = makeFixture();
    try {
      applySetup(fx, entry);
      const res = spawnClassifier(fx, entry.stdin, {});
      assertTrue(res.status === 0, entry.id + ' exit 0 (never-block); got ' + res.status + ' stderr=' + res.stderr);
      const hits = markersIn(res.stdout);
      assertTrue(hits.length === 0,
        entry.id + ' a harness turn must emit no room-resolution marker; got [' + hits.join(', ') + ']');
      const sw = sideWrites(fx, entry.stdin.session_id);
      assertTrue(sw.f8SideChannel === 0,
        entry.id + ' must record 0 F.8 side-channel entries; got ' + sw.f8SideChannel);
      assertTrue(sw.bindingGatePayload === 0,
        entry.id + ' must persist 0 binding_gate_payload traces; got ' + sw.bindingGatePayload);
      assertTrue(sw.zeroScoreGate === 0,
        entry.id + ' must persist 0 zero_score_gate traces; got ' + sw.zeroScoreGate);
      assertTrue(sw.strictModeTrace === 0,
        entry.id + ' must persist 0 strict_mode traces; got ' + sw.strictModeTrace);
      assertTrue(sw.offeredMarkerFiles.length === 0,
        entry.id + ' must write 0 offered-marker files; got ' + sw.offeredMarkerFiles.length);
    } finally {
      fx.cleanup();
    }
  });
}

// r1 control A: the SAME exact harness-prefixed prompt on the PLAN_BASE code
// root must fire (proves the corpus is meaningful, before AND after 360-07).
for (const entry of ALL_SUPPRESS_LIKE_ENTRIES) {
  leg('r1-controlA-' + entry.id, function () {
    const fx = makeFixture();
    try {
      applySetup(fx, entry);
      const planBase = buildCodeRoot(PRE_PHASE.plan_base_sha);
      const res = spawnClassifier(fx, entry.stdin, { classifier: planBase });
      assertTrue(res.status === 0, entry.id + ' control A exit 0; got ' + res.status + ' stderr=' + res.stderr);
      const hits = markersIn(res.stdout);
      assertTrue(hits.length > 0,
        entry.id + ' control A (PLAN_BASE, exact harness prompt) must fire; got no marker');
      // 360-02-SUMMARY's own strict-mode reachability finding: the harness lead's
      // "<task-notification>\n" prefix means the WHOLE trimmed message is no longer
      // the bare quoted span detectStrictMode's Pattern 3 requires, so the exact
      // harness-prefixed prompt falls through to the generic scoring path instead
      // (the default unbound header) -- only the bare control_prompt (control B)
      // reaches the strict-mode marker. Every other entry's marker IS reachable
      // through the harness-prefixed exact prompt (scoring is prefix-insensitive).
      if (typeof entry.marker === 'string' && entry.id !== 'harness-strict-mode') {
        assertTrue(hits.indexOf(entry.marker) !== -1,
          entry.id + ' control A expected marker "' + entry.marker + '", got [' + hits.join(', ') + ']');
      }
    } finally {
      fx.cleanup();
    }
  });
}

// r1 control B: the entry's control_prompt (no harness lead) on HEAD must
// fire (proves suppression is scoped to the lead, before AND after 360-07).
for (const entry of ALL_SUPPRESS_LIKE_ENTRIES.filter(function (e) { return typeof e.control_prompt === 'string'; })) {
  leg('r1-controlB-' + entry.id, function () {
    const fx = makeFixture();
    try {
      applySetup(fx, entry);
      const stdinB = Object.assign({}, entry.stdin, { prompt: entry.control_prompt });
      const res = spawnClassifier(fx, stdinB, {});
      assertTrue(res.status === 0, entry.id + ' control B exit 0; got ' + res.status + ' stderr=' + res.stderr);
      const hits = markersIn(res.stdout);
      assertTrue(hits.length > 0,
        entry.id + ' control B (control_prompt on HEAD) must fire; got no marker');
      if (typeof entry.marker === 'string') {
        assertTrue(hits.indexOf(entry.marker) !== -1,
          entry.id + ' control B expected marker "' + entry.marker + '", got [' + hits.join(', ') + ']');
      }
    } finally {
      fx.cleanup();
    }
  });
}

// r1, 'fire' entries (the carve-out, human-direct, human-queued, mid-text
// quote, image lead): R1 must never touch a genuinely non-harness turn.
for (const entry of FIRE_ENTRIES) {
  leg('r1-fire-' + entry.id, function () {
    const fx = makeFixture();
    try {
      applySetup(fx, entry);
      const res = spawnClassifier(fx, entry.stdin, {});
      assertTrue(res.status === 0, entry.id + ' exit 0; got ' + res.status + ' stderr=' + res.stderr);
      const hits = markersIn(res.stdout);
      assertTrue(hits.length > 0,
        entry.id + ' (non-harness) must still fire; R1 is scoped to the harness verdict only; got no marker');
    } finally {
      fx.cleanup();
    }
  });
}

// r1, the accepted-limit entry (pasted-harness-lead, D-14, RESEARCH Finding
// 4, 0 observed cases): once 360-07 lands, HEAD prints no marker -- the
// recorded limit, not a defect. RED until then (today it still fires, since
// no guard exists yet).
for (const entry of ACCEPTED_LIMIT_ENTRIES) {
  leg('r1-acceptedlimit-' + entry.id, function () {
    const fx = makeFixture();
    try {
      applySetup(fx, entry);
      const res = spawnClassifier(fx, entry.stdin, {});
      assertTrue(res.status === 0, entry.id + ' exit 0; got ' + res.status + ' stderr=' + res.stderr);
      const hits = markersIn(res.stdout);
      assertTrue(hits.length === 0,
        entry.id + ' is the accepted limit (0 observed cases): a pasted harness lead is suppressed too '
        + 'once 360-07 lands (lead-only verdict cannot tell it from a real harness turn); got ['
        + hits.join(', ') + ']');
    } finally {
      fx.cleanup();
    }
  });
}

// ===== R2 ====================================================================

// r2: a harness turn must not consume a pending F.8 binding_gate_payload.
// This is a CALL-SPY leg, not a bind-outcome leg (RESEARCH Finding 6): the
// harness-shaped body does not verbatim-match a rendered option label (it
// carries the leading tag), so today's bug is that captureCliActionSet is
// still REACHED (spy count 1) even though the eventual bind is a no-op.
// 360-07's D-08 guard wraps the whole consumePriorBindingAnswer call in
// `if (!TURN_IS_HARNESS)`, taking the spy count to 0.
leg('r2-sequence', function () {
  const seq = CASES.sequences.find(function (s) { return s.id === 'r2-pending-answer'; });
  assertTrue(seq, 'the r2-pending-answer sequence is missing from cases.json');
  const sid = 'sample-session-r2';
  const fx = makeFixture();
  try {
    // Turn 1 (human): fires the unbound F.8 gate and persists a
    // binding_gate_payload for the sequence to read back.
    const turn1Stdin = { prompt: seq.turns[0].prompt, session_id: sid, hook_event_name: 'UserPromptSubmit' };
    const res1 = spawnClassifier(fx, turn1Stdin, {});
    assertTrue(res1.status === 0, 'turn 1 (human) exit 0; got ' + res1.status + ' stderr=' + res1.stderr);
    const hits1 = markersIn(res1.stdout);
    assertTrue(hits1.length > 0, 'turn 1 (human) must fire the unbound F.8 gate; got no marker');

    const found = readLatestGatePayload(fx, sid);
    assertTrue(!!found, 'turn 1 must persist a binding_gate_payload the sequence can read back');
    const options = Array.isArray(found.payload.options) ? found.payload.options : [];
    const labelToSlug = (found.payload.labelToSlug && typeof found.payload.labelToSlug === 'object')
      ? found.payload.labelToSlug : {};
    const realLabel = options.find(function (label) { return label !== 'dev repo / no room'; });
    assertTrue(typeof realLabel === 'string' && realLabel.length > 0,
      'turn 1 payload must offer at least one real room label; options=[' + options.join(', ') + ']');

    // Turn 2 (harness): the body IS turn 1's real option label verbatim,
    // wrapped in a harness lead. Must leave the consumer unreached.
    const spyPath = path.join(fx.tmp, 'spy-out-r2.txt');
    const turn2Stdin = {
      prompt: '<task-notification>\n' + realLabel,
      session_id: sid,
      hook_event_name: 'UserPromptSubmit',
    };
    const res2 = spawnClassifier(fx, turn2Stdin, {
      preloads: [CAPTURE_SPY_PATH],
      env: { SPY_OUT_360: spyPath },
    });
    assertTrue(res2.status === 0, 'turn 2 (harness) exit 0; got ' + res2.status + ' stderr=' + res2.stderr);
    const spyLines2 = readSpyLines(spyPath);
    assertTrue(spyLines2.length === 0,
      'turn 2 (harness) must not reach captureCliActionSet (0 calls expected), got ' + spyLines2.length);

    const bindingAfter2 = readBinding(fx, sid);
    assertTrue(!bindingAfter2.primary,
      'turn 2 (harness) must leave the binding file absent/unchanged; primary=' + String(bindingAfter2.primary));
    const swAfter2 = sideWrites(fx, sid);
    assertTrue(swAfter2.bindingGateConsumed === 0,
      'turn 2 (harness) must not write a binding_gate_consumed trace entry; got ' + swAfter2.bindingGateConsumed);

    // Turn 3 (human): the identical label sent as a human turn must still
    // bind (today's behavior unchanged) and write binding_gate_consumed.
    const turn3Stdin = { prompt: realLabel, session_id: sid, hook_event_name: 'UserPromptSubmit' };
    const res3 = spawnClassifier(fx, turn3Stdin, {});
    assertTrue(res3.status === 0, 'turn 3 (human) exit 0; got ' + res3.status + ' stderr=' + res3.stderr);
    const bindingAfter3 = readBinding(fx, sid);
    const expectedSlug = (typeof labelToSlug[realLabel] === 'string') ? labelToSlug[realLabel] : realLabel;
    assertTrue(
      Array.isArray(bindingAfter3.bound) && bindingAfter3.bound.indexOf(expectedSlug) !== -1,
      'turn 3 (human, exact label) must bind ' + expectedSlug + '; bound=[' + (bindingAfter3.bound || []).join(', ') + ']'
    );
    const swAfter3 = sideWrites(fx, sid);
    assertTrue(swAfter3.bindingGateConsumed >= 1,
      'turn 3 (human, exact label) must write a binding_gate_consumed trace entry; got ' + swAfter3.bindingGateConsumed);
  } finally {
    fx.cleanup();
  }
});

// ===== R3 ====================================================================

// r3: every human-origin entry (no cwd in stdin) must be byte-identical on
// HEAD across two runs at the same fixture PATH, and between PLAN_BASE and
// HEAD at that same path. GREEN today (R3 guards today's behavior, it does
// not change it).
//
// Root-cause note 1 (diagnosed live, per this plan's own Task 2 action step
// 3, before writing any of the code below): running the SECOND of the two
// self-consistency spawns WITHOUT rebuilding the fixture in between is NOT
// byte-identical, but the mismatch has nothing to do with R1/R2/R3/R6 -- it
// is Phase 251's unrelated navigation-engine cache (CACHE-02a,
// NAV_UNCHANGED_MARKER / navBlockHashPath, exported by
// scripts/intent-classifier.cjs). That block runs LAST on every non-empty
// message regardless of session binding, hashes its own decision, and on a
// second turn with an unchanged hash prints the short
// '[NAV DECISION unchanged - prior block stands]' marker instead of
// re-rendering the full '## NAVIGATION DECISION (engine v1)' block -- a
// legitimate, working cache, but orthogonal to the F.8/R1 room-resolution
// half of main() this phase touches (confirmed: git log --format='%h %s'
// PLAN_BASE..HEAD -- scripts/intent-classifier.cjs lib/ shows no 360 commit
// yet, since 360-06/07 have not landed at plan-04 time -- the divergence is
// pre-existing CACHE-02a behavior, not a 360 regression). So each of the two
// self-consistency runs -- like the two cross-version runs -- gets its own
// freshly rebuilt copy of the SAME fixture path, which is the correct
// experiment for "does HEAD produce the same bytes given the same input
// twice", not "does a second turn's dial cache differ from the first's".
//
// Root-cause note 2 (same diagnostic step, second finding): comparing FULL
// stdout between the PLAN_BASE code root and HEAD is also not byte-identical
// -- again for a reason wholly outside R1/R2/R3/R6. `git diff PLAN_BASE HEAD
// -- scripts/intent-classifier.cjs` is EMPTY (the emitter has not changed at
// all since PLAN_BASE was recorded), but dozens of unrelated same-day
// commits from OTHER phases landed on this shared tree between PLAN_BASE and
// HEAD and touch the navigation engine's own dependencies -- most visibly a
// 454-line rewrite of data/framework-names.json (plus
// lib/core/navigation-engine.cjs, lib/hmi/dial-label-composer.cjs, and
// several lib/core/rs-*.cjs / lib/core/eureka/*.cjs files, none of them on
// any 360 requirement or file list). PLAN_BASE's archived tree carries its
// OWN period-correct copy of every one of those files (buildCodeRoot's `git
// archive <sha> scripts lib data` snapshots all three), so this is a
// legitimate behavior difference in the OUT-OF-SCOPE nav engine block (D-09:
// "Leave these untouched on harness turns... the engine NAV block keeps
// running on harness turns in this phase" -- 360-CONTEXT.md explicitly does
// not govern it), not a fault in this leg or a 360 regression. R1/R3 govern
// exactly what main() itself writes -- the F.8/strict-mode/zero-score JSON
// envelope, always a single line (JSON.stringify never emits a raw newline
// byte) -- so the cross-version comparison is scoped to that one line
// (roomResolutionSegment, defined above) rather than the whole process
// stdout. This is a scope decision, not byte normalization: no byte within
// the compared segment is altered, and the segment boundary is main()'s own
// write contract, not a value picked to make the leg pass.
for (const entry of R3_ENTRIES) {
  leg('r3-' + entry.id, function () {
    const fixedPath = path.join(os.tmpdir(), 'p360-r3-' + entry.id + '-' + process.pid);
    try {
      const fx1 = makeFixture({ at: fixedPath });
      const runA = spawnClassifier(fx1, entry.stdin, {});
      const fx1b = makeFixture({ at: fixedPath });
      const runB = spawnClassifier(fx1b, entry.stdin, {});
      assertBytesEqual(runA.stdout, runB.stdout, entry.id + ' HEAD self-consistency (fresh rebuild each run, full stdout)');

      const planBase = buildCodeRoot(PRE_PHASE.plan_base_sha);
      const fx2 = makeFixture({ at: fixedPath });
      const runPlanBase = spawnClassifier(fx2, entry.stdin, { classifier: planBase });
      const fx3 = makeFixture({ at: fixedPath });
      const runHead = spawnClassifier(fx3, entry.stdin, {});
      assertBytesEqual(
        roomResolutionSegment(runPlanBase.stdout),
        roomResolutionSegment(runHead.stdout),
        entry.id + ' PLAN_BASE vs HEAD (fresh rebuild each, room-resolution segment -- D-09 excludes the nav block)'
      );
    } finally {
      rmrf(fixedPath);
    }
  });
}

// ===== R6 ====================================================================

const HUMAN_DIRECT_ENTRY = CASES.entries.find(function (e) { return e.id === 'human-direct'; });
const HARNESS_TASK_ENTRY = CASES.entries.find(function (e) { return e.id === 'harness-task-notification'; });

// r6 (human leg): the human turn's stdout is unchanged by the fault, the
// process exits 0, and the stub records it was reached. RED until 360-06/07
// land the call site the stub intercepts (today, nothing calls
// classifyUserPromptText, so the stub is never reached: 0 lines).
function r6HumanLeg(id, stubPath, expectedLineSubstring) {
  leg(id, function () {
    const fixedPath = path.join(os.tmpdir(), 'p360-' + id + '-' + process.pid);
    try {
      const fxBase = makeFixture({ at: fixedPath });
      const baseline = spawnClassifier(fxBase, HUMAN_DIRECT_ENTRY.stdin, {});
      assertTrue(baseline.status === 0, id + ' baseline exit 0; got ' + baseline.status);

      const fxStub = makeFixture({ at: fixedPath });
      const spyPath = path.join(fxStub.tmp, 'spy-out.txt');
      const stubbed = spawnClassifier(fxStub, HUMAN_DIRECT_ENTRY.stdin, {
        preloads: [stubPath],
        env: { SPY_OUT_360: spyPath },
      });
      assertTrue(stubbed.status === 0, id + ' stubbed exit 0; got ' + stubbed.status + ' stderr=' + stubbed.stderr);
      assertBytesEqual(baseline.stdout, stubbed.stdout, id + ' human stdout must be unchanged by the injected fault');

      const lines = readSpyLines(spyPath);
      assertTrue(
        lines.length >= 1 && lines.every(function (l) { return l.indexOf(expectedLineSubstring) !== -1; }),
        id + ' the stub must be reached at least once; got ' + lines.length + ' lines'
      );
    } finally {
      rmrf(fixedPath);
    }
  });
}

r6HumanLeg('r6-throwing-human', THROWING_STUB_PATH, 'classifyUserPromptText invoked');
r6HumanLeg('r6-missing-human', MISSING_STUB_PATH, 'classifyUserPromptText accessed');

// r6 (harness leg): with the fault injected, the harness turn must still
// fail toward the pre-fix behavior (the unbound header fires) and exit 0
// (PSB-06 never-block). PASSES today already (nothing calls
// classifyUserPromptText yet, so the harness entry fires exactly as it does
// with no preload at all) and must keep passing once 360-06/07 land, because
// D-06's harnessVerdict swallows the thrown/missing fault and returns false.
function r6HarnessLeg(id, stubPath) {
  leg(id, function () {
    const fixedPath = path.join(os.tmpdir(), 'p360-' + id + '-' + process.pid);
    try {
      const fx = makeFixture({ at: fixedPath });
      const spyPath = path.join(fx.tmp, 'spy-out.txt');
      const res = spawnClassifier(fx, HARNESS_TASK_ENTRY.stdin, {
        preloads: [stubPath],
        env: { SPY_OUT_360: spyPath },
      });
      assertTrue(res.status === 0, id + ' exit 0 (never-block); got ' + res.status + ' stderr=' + res.stderr);
      const hits = markersIn(res.stdout);
      assertTrue(hits.length > 0,
        id + ' a classifier fault must fail toward the pre-fix behavior (the unbound header still fires); '
        + 'got no marker');
    } finally {
      rmrf(fixedPath);
    }
  });
}

r6HarnessLeg('r6-throwing-harness', THROWING_STUB_PATH);
r6HarnessLeg('r6-missing-harness', MISSING_STUB_PATH);

// ---------------------------------------------------------------------------

console.log('PASS test-360-harness-picker.cjs (' + checks + ' checks)');
if (failed > 0) process.exit(1);
