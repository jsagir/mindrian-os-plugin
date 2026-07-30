#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 103-05 -- Memory hook integration test suite.
 * 10 assertion classes covering all three hooks:
 *   1.  scripts/memory-completion-detector.cjs loads cleanly + has CLI entry
 *   2.  completion-detector with empty cascade side-channel -> exit 0, no fire
 *   3.  completion-detector with cascade matching JTBD artifact_glob -> calls completeJtbd
 *   4.  completion-detector with cascade matching cascade_edge -> calls completeJtbd
 *   5.  completion-detector with cascade matching state_md_key -> calls completeJtbd
 *   6.  completion-detector with cascade.classification.cascade_status !== 'completed' -> NO fire (Pitfall 6 gate)
 *   7.  completion-detector with within-session confidence < 0.6 -> NO fire (Pitfall 6 gate)
 *   8.  scripts/memory-resume-nudge.cjs in fresh session with in_flight < 24h -> 'Last move:' variant
 *   9.  scripts/memory-resume-nudge.cjs in fresh session with in_flight 4-7d -> 'Stale job:' variant + park CTA
 *   10. scripts/jtbd-update.cjs Phase 100 Stop hook extension preserves Phase 100 behavior (manual-block branch)
 *       AND fires promoteIfEligible via the plan 240-03 manual-override round trip (updated 2026-07-30)
 *
 * Test isolation via freshTmpRoot + MINDRIAN_ROOMS_HOME env override (per RESEARCH §10).
 *
 * IIFE harness pattern (mirrors test-jtbd-state-io.cjs / test-jtbd-hook-integration.cjs).
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const COMPLETION_DETECTOR = path.join(REPO, 'scripts', 'memory-completion-detector.cjs');
const RESUME_NUDGE = path.join(REPO, 'scripts', 'memory-resume-nudge.cjs');
const JTBD_UPDATE = path.join(REPO, 'scripts', 'jtbd-update.cjs');
const ACROSS_SESSION_MODULE = path.join(REPO, 'lib', 'hmi', 'across-session-memory.cjs');
const JTBD_STATE_MODULE = path.join(REPO, 'lib', 'hmi', 'jtbd-state.cjs');

let passed = 0;
let failed = 0;

function ok(name) { passed++; process.stdout.write('  PASS  ' + name + '\n'); }
function fail(name, msg) { failed++; process.stdout.write('  FAIL  ' + name + (msg ? ' :: ' + msg : '') + '\n'); }

// freshTmpRoot: builds a fresh MindrianRooms-like tree under tmpdir.
// Returns { home, roomA, roomB, cleanup }.
function freshTmpRoot() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-hook-test-'));
  const roomA = path.join(home, 'room-a');
  const roomB = path.join(home, 'room-b');
  fs.mkdirSync(path.join(roomA, '.mindrian'), { recursive: true });
  fs.mkdirSync(path.join(roomB, '.mindrian'), { recursive: true });
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  fs.mkdirSync(path.join(home, '.memory'), { recursive: true });
  fs.writeFileSync(path.join(roomA, '.room-root'), '');
  fs.writeFileSync(path.join(roomB, '.room-root'), '');
  // Registry: across-session-memory.cjs reads `path` (string) per fixture convention.
  // jtbd-update.cjs reads `abs_path` + `active_room`. Provide BOTH conventions so
  // the test fixture supports both modules.
  fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify({
    version: 1,
    active: 'room-a',
    active_room: 'room-a',
    rooms: [
      { slug: 'room-a', path: 'room-a', abs_path: roomA },
      { slug: 'room-b', path: 'room-b', abs_path: roomB },
    ],
  }, null, 2));
  // Empty across-session memory file (matches fixture seed).
  fs.writeFileSync(path.join(home, '.memory', 'jtbd-history.json'), JSON.stringify({
    version: 1, rooms: {}, last_updated: null,
  }, null, 2));
  return {
    home, roomA, roomB,
    cleanup() { try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) {} },
  };
}

function writeCascadeSideChannel(roomDir, payload) {
  const dir = path.join(roomDir, '.mindrian');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'last-cascade.json'), JSON.stringify(payload, null, 2));
}

function writeJtbdState(roomDir, current) {
  const dir = path.join(roomDir, '.mindrian');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jtbd-state.json'), JSON.stringify({
    version: 1,
    current: current,
    history: [],
  }, null, 2));
}

function readMemoryFile(home) {
  try {
    return JSON.parse(fs.readFileSync(path.join(home, '.memory', 'jtbd-history.json'), 'utf8'));
  } catch (_) { return null; }
}

function runDetector(home, roomDir) {
  return spawnSync('node', [COMPLETION_DETECTOR], {
    env: Object.assign({}, process.env, {
      MINDRIAN_ROOMS_HOME: home,
      CLAUDE_ROOM_DIR: roomDir,
    }),
    encoding: 'utf8',
    input: '',
  });
}

function runNudge(home, currentRoomSlug) {
  // Override the registry's active room for the nudge run.
  const regPath = path.join(home, '.rooms', 'registry.json');
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  reg.active = currentRoomSlug;
  reg.active_room = currentRoomSlug;
  fs.writeFileSync(regPath, JSON.stringify(reg, null, 2));
  return spawnSync('node', [RESUME_NUDGE], {
    env: Object.assign({}, process.env, {
      MINDRIAN_ROOMS_HOME: home,
    }),
    encoding: 'utf8',
    input: '',
  });
}

// =============================================================================
// Class 1: completion-detector script loads cleanly + has CLI entry
// =============================================================================
(function class1() {
  if (!fs.existsSync(COMPLETION_DETECTOR)) {
    fail('Class 1: completion-detector exists', 'script not found at ' + COMPLETION_DETECTOR);
    return;
  }
  // node --check should pass (no syntax errors).
  const r = spawnSync('node', ['--check', COMPLETION_DETECTOR], { encoding: 'utf8' });
  if (r.status !== 0) {
    fail('Class 1: completion-detector parses', 'node --check failed: ' + r.stderr);
    return;
  }
  // Has BSL 1.1 license header.
  const body = fs.readFileSync(COMPLETION_DETECTOR, 'utf8');
  if (!/Copyright \(c\) 2026 Mindrian\. BSL 1\.1/.test(body)) {
    fail('Class 1: completion-detector BSL header', 'BSL 1.1 license header missing');
    return;
  }
  ok('Class 1: completion-detector exists + parses + BSL 1.1 header');
})();

// =============================================================================
// Class 2: empty cascade side-channel -> exit 0, no fire
// =============================================================================
(function class2() {
  const t = freshTmpRoot();
  try {
    // No cascade side-channel file written.
    writeJtbdState(t.roomA, {
      jtbd: 'find-bottleneck',
      confidence: 0.8,
      entered_at: new Date().toISOString(),
      evidence: ['test'],
      expires_at: null,
    });
    const r = runDetector(t.home, t.roomA);
    if (r.status !== 0) { fail('Class 2: empty cascade exit 0', 'exit ' + r.status + ' stderr=' + r.stderr); return; }
    const mem = readMemoryFile(t.home);
    const completed = (mem && mem.rooms && mem.rooms['room-a'] && mem.rooms['room-a'].completed) || [];
    if (completed.length !== 0) { fail('Class 2: empty cascade no fire', 'completed.length=' + completed.length); return; }
    ok('Class 2: empty cascade side-channel -> exit 0, no fire');
  } finally { t.cleanup(); }
})();

// =============================================================================
// Class 3: cascade matching JTBD artifact_glob -> calls completeJtbd
// (find-bottleneck has artifact_glob: **/rs-thesis*.md)
// =============================================================================
(function class3() {
  const t = freshTmpRoot();
  try {
    writeJtbdState(t.roomA, {
      jtbd: 'find-bottleneck',
      confidence: 0.8,
      entered_at: new Date().toISOString(),
      evidence: ['test'],
      expires_at: null,
    });
    writeCascadeSideChannel(t.roomA, {
      timestamp: new Date().toISOString(),
      file_path: path.join(t.roomA, 'rs-thesis-q1.md'),
      section: 'rs-thesis',
      cascade_status: 'completed',
      classification: { edges_added: [], state_md_section: null },
      git_commit: null,
      graph_index: null,
      proactive_intelligence: null,
    });
    const r = runDetector(t.home, t.roomA);
    if (r.status !== 0) { fail('Class 3: artifact_glob match exit 0', 'exit ' + r.status + ' stderr=' + r.stderr); return; }
    const mem = readMemoryFile(t.home);
    const completed = (mem && mem.rooms && mem.rooms['room-a'] && mem.rooms['room-a'].completed) || [];
    const found = completed.find(c => c.jtbd === 'find-bottleneck');
    if (!found) { fail('Class 3: artifact_glob fires completeJtbd', 'no completed find-bottleneck row; mem=' + JSON.stringify(mem.rooms)); return; }
    if (!/artifact_glob/.test(String(found.completion_shape || ''))) {
      fail('Class 3: completion_shape mentions artifact_glob', 'completion_shape=' + found.completion_shape);
      return;
    }
    ok('Class 3: cascade artifact_glob match -> completeJtbd fired');
  } finally { t.cleanup(); }
})();

// =============================================================================
// Class 4: cascade matching cascade_edge -> calls completeJtbd
// (decide-pursue has cascade_edge: decision_edge:APPROVE|decision_edge:REJECT)
// =============================================================================
(function class4() {
  const t = freshTmpRoot();
  try {
    writeJtbdState(t.roomA, {
      jtbd: 'decide-pursue',
      confidence: 0.85,
      entered_at: new Date().toISOString(),
      evidence: ['test'],
      expires_at: null,
    });
    writeCascadeSideChannel(t.roomA, {
      timestamp: new Date().toISOString(),
      file_path: path.join(t.roomA, 'something.md'),
      section: 'decisions',
      cascade_status: 'completed',
      classification: { edges_added: ['decision_edge:APPROVE'], state_md_section: null },
      git_commit: null,
      graph_index: null,
      proactive_intelligence: null,
    });
    const r = runDetector(t.home, t.roomA);
    if (r.status !== 0) { fail('Class 4: cascade_edge match exit 0', 'exit ' + r.status); return; }
    const mem = readMemoryFile(t.home);
    const completed = (mem && mem.rooms && mem.rooms['room-a'] && mem.rooms['room-a'].completed) || [];
    const found = completed.find(c => c.jtbd === 'decide-pursue');
    if (!found) { fail('Class 4: cascade_edge fires completeJtbd', 'no completed decide-pursue row'); return; }
    if (!/cascade_edge/.test(String(found.completion_shape || ''))) {
      fail('Class 4: completion_shape mentions cascade_edge', 'completion_shape=' + found.completion_shape);
      return;
    }
    ok('Class 4: cascade_edge match -> completeJtbd fired');
  } finally { t.cleanup(); }
})();

// =============================================================================
// Class 5: cascade matching state_md_key -> calls completeJtbd
// (prepare-pitch has state_md_key: MEETING-PREP)
// =============================================================================
(function class5() {
  const t = freshTmpRoot();
  try {
    writeJtbdState(t.roomA, {
      jtbd: 'prepare-pitch',
      confidence: 0.85,
      entered_at: new Date().toISOString(),
      evidence: ['test'],
      expires_at: null,
    });
    writeCascadeSideChannel(t.roomA, {
      timestamp: new Date().toISOString(),
      file_path: path.join(t.roomA, 'STATE.md'),
      section: 'state',
      cascade_status: 'completed',
      classification: { edges_added: [], state_md_section: 'MEETING-PREP' },
      git_commit: null,
      graph_index: null,
      proactive_intelligence: null,
    });
    const r = runDetector(t.home, t.roomA);
    if (r.status !== 0) { fail('Class 5: state_md_key match exit 0', 'exit ' + r.status); return; }
    const mem = readMemoryFile(t.home);
    const completed = (mem && mem.rooms && mem.rooms['room-a'] && mem.rooms['room-a'].completed) || [];
    const found = completed.find(c => c.jtbd === 'prepare-pitch');
    if (!found) { fail('Class 5: state_md_key fires completeJtbd', 'no completed prepare-pitch row'); return; }
    if (!/state_md_key/.test(String(found.completion_shape || ''))) {
      fail('Class 5: completion_shape mentions state_md_key', 'completion_shape=' + found.completion_shape);
      return;
    }
    ok('Class 5: state_md_key match -> completeJtbd fired');
  } finally { t.cleanup(); }
})();

// =============================================================================
// Class 6: Pitfall 6 gate -- cascade_status !== 'completed' -> NO fire
// =============================================================================
(function class6() {
  const t = freshTmpRoot();
  try {
    writeJtbdState(t.roomA, {
      jtbd: 'find-bottleneck',
      confidence: 0.8,
      entered_at: new Date().toISOString(),
      evidence: ['test'],
      expires_at: null,
    });
    writeCascadeSideChannel(t.roomA, {
      timestamp: new Date().toISOString(),
      file_path: path.join(t.roomA, 'rs-thesis-q1.md'),
      section: 'rs-thesis',
      cascade_status: 'in_progress',  // INVERTED
      classification: { edges_added: ['REVERSE_SALIENT'], state_md_section: null },
      git_commit: null,
      graph_index: null,
      proactive_intelligence: null,
    });
    const r = runDetector(t.home, t.roomA);
    if (r.status !== 0) { fail('Class 6: in_progress cascade exit 0', 'exit ' + r.status); return; }
    const mem = readMemoryFile(t.home);
    const completed = (mem && mem.rooms && mem.rooms['room-a'] && mem.rooms['room-a'].completed) || [];
    if (completed.length !== 0) { fail('Class 6: cascade_status gate', 'should not fire on in_progress, got ' + completed.length); return; }
    ok('Class 6: cascade_status !== completed -> Pitfall 6 gate blocks fire');
  } finally { t.cleanup(); }
})();

// =============================================================================
// Class 7: Pitfall 6 gate -- confidence < 0.6 -> NO fire
// =============================================================================
(function class7() {
  const t = freshTmpRoot();
  try {
    writeJtbdState(t.roomA, {
      jtbd: 'find-bottleneck',
      confidence: 0.4,  // BELOW FLOOR
      entered_at: new Date().toISOString(),
      evidence: ['test'],
      expires_at: null,
    });
    writeCascadeSideChannel(t.roomA, {
      timestamp: new Date().toISOString(),
      file_path: path.join(t.roomA, 'rs-thesis-q1.md'),
      section: 'rs-thesis',
      cascade_status: 'completed',
      classification: { edges_added: ['REVERSE_SALIENT'], state_md_section: null },
      git_commit: null,
      graph_index: null,
      proactive_intelligence: null,
    });
    const r = runDetector(t.home, t.roomA);
    if (r.status !== 0) { fail('Class 7: low-confidence cascade exit 0', 'exit ' + r.status); return; }
    const mem = readMemoryFile(t.home);
    const completed = (mem && mem.rooms && mem.rooms['room-a'] && mem.rooms['room-a'].completed) || [];
    if (completed.length !== 0) { fail('Class 7: confidence floor gate', 'should not fire on confidence 0.4, got ' + completed.length); return; }
    ok('Class 7: within-session confidence < 0.6 -> Pitfall 6 gate blocks fire');
  } finally { t.cleanup(); }
})();

// =============================================================================
// Class 8: resume-nudge with in_flight < 24h -> 'Last move:' variant
// =============================================================================
(function class8() {
  if (!fs.existsSync(RESUME_NUDGE)) {
    fail('Class 8: resume-nudge exists', 'script not found at ' + RESUME_NUDGE);
    return;
  }
  const t = freshTmpRoot();
  try {
    // Seed across-session memory with an in_flight entry from 2 hours ago in room-b.
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(path.join(t.home, '.memory', 'jtbd-history.json'), JSON.stringify({
      version: 1,
      rooms: {
        'room-b': {
          in_flight: [
            { jtbd: 'prepare-pitch', first_seen: recent, last_seen: recent, confidence_avg: 0.8, turn_count: 5 },
          ],
          parked: [], completed: [],
        },
      },
      last_updated: recent,
    }, null, 2));
    // Active room is room-a, so cross-room nudge for room-b should fire.
    const r = runNudge(t.home, 'room-a');
    if (r.status !== 0) { fail('Class 8: nudge exit 0', 'exit ' + r.status + ' stderr=' + r.stderr); return; }
    const stdout = r.stdout || '';
    if (!/Last move:\s*prepare-pitch/.test(stdout)) {
      fail('Class 8: "Last move:" variant', 'stdout=' + JSON.stringify(stdout));
      return;
    }
    if (!/\/mos:memory resume/.test(stdout)) {
      fail('Class 8: nudge includes resume CTA', 'stdout=' + JSON.stringify(stdout));
      return;
    }
    ok('Class 8: in_flight <24h -> "Last move:" variant + resume CTA');
  } finally { t.cleanup(); }
})();

// =============================================================================
// Class 9: resume-nudge with in_flight 4-7d -> 'Stale job:' variant + park CTA
// =============================================================================
(function class9() {
  const t = freshTmpRoot();
  try {
    // Seed an in_flight entry from 5 days ago in room-b.
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(path.join(t.home, '.memory', 'jtbd-history.json'), JSON.stringify({
      version: 1,
      rooms: {
        'room-b': {
          in_flight: [
            { jtbd: 'find-bottleneck', first_seen: fiveDaysAgo, last_seen: fiveDaysAgo, confidence_avg: 0.7, turn_count: 4 },
          ],
          parked: [], completed: [],
        },
      },
      last_updated: fiveDaysAgo,
    }, null, 2));
    const r = runNudge(t.home, 'room-a');
    if (r.status !== 0) { fail('Class 9: stale nudge exit 0', 'exit ' + r.status); return; }
    const stdout = r.stdout || '';
    if (!/Stale job:\s*find-bottleneck/.test(stdout)) {
      fail('Class 9: "Stale job:" variant', 'stdout=' + JSON.stringify(stdout));
      return;
    }
    if (!/\/mos:memory park\s*find-bottleneck/.test(stdout)) {
      fail('Class 9: stale nudge includes park CTA', 'stdout=' + JSON.stringify(stdout));
      return;
    }
    ok('Class 9: in_flight 4-7d -> "Stale job:" variant + park CTA');
  } finally { t.cleanup(); }
})();

// =============================================================================
// Class 10: jtbd-update.cjs Phase 100 Stop hook extension
//   - Phase 100 setCurrent path preserved (within-session jtbd-state.json updated)
//   - additive promoteIfEligible call writes across-session in_flight row
//
// Updated by plan 240-03 (MEM-01). The original scenario pre-seeded history
// with rows targeting the SAME jtbd so the OLD turnCount fallback (counting
// history rows where to === cur.jtbd) reached NOISE_FLOOR_TURNS = 3 on a
// single classifier-driven transition. That fallback was itself the
// deadlock 240-RESEARCH.md Finding 1 identifies: jtbd-state.cjs's setCurrent
// now unconditionally persists turn_count: 1 on EVERY transition (the
// transition turn IS turn 1 on the new topic, R-08), so a single Stop-hook
// transition can never again reach turnCount >= 3 by itself -- reaching 3
// on continuous same-topic work requires bumpTurnCount, which plan 240-04
// wires into this same additive block. Testing the old fallback path here
// would be testing dead code.
//
// This class now proves the ACTUAL round trip plan 240-03 closes: a manual
// override is active (manual_set: true, persisted per Task 1) when a real
// auto transition attempt arrives. jtbd-state.cjs's pre-existing manual-
// block behavior (Phase 100, untouched by this plan) blocks the auto write
// and leaves `current` unchanged, so the additive block re-reads the SAME
// manually-set `current` -- and because manual_set now round-trips and the
// gate now recognizes it (Task 2), promoteIfEligible correctly promotes the
// manually-set jtbd through the real Stop hook, with no turn_count floor
// needed. This is reachable TODAY (does not depend on plan 240-04).
(function class10() {
  const t = freshTmpRoot();
  try {
    // Seed STATE.md so the Phase 100 classifier can find decisions.
    fs.writeFileSync(path.join(t.roomA, 'STATE.md'),
      '## Decisions\n' +
      '- 2026-04-30 Run Methodology rs-fetch [methodology: /mos:rs-fetch]\n' +
      '- 2026-04-29 Run Methodology rs-fetch [methodology: /mos:rs-fetch]\n' +
      '- 2026-04-28 Run Methodology rs-fetch [methodology: /mos:rs-fetch]\n');
    // Seed Phase 99 operator state so classifier threshold is 0.6 (METHODOLOGY).
    fs.writeFileSync(path.join(t.roomA, '.mindrian', 'conversation-operator.json'), JSON.stringify({
      schema_version: '1.0.0',
      current: 'METHODOLOGY',
      previous: 'JUST_TALK',
      entered_at: new Date().toISOString(),
      context: { active_room: 'room-a', active_section: null, methodology_in_flight: null, decision_gate_pending: null },
      history: [],
    }));
    // Pre-seed within-session jtbd-state with an ACTIVE MANUAL OVERRIDE on a
    // DIFFERENT jtbd than the classifier will produce, so the incoming
    // classifier-driven transition is a real topic change that setCurrent's
    // pre-existing manual-block branch (jtbd-state.cjs:116-130, untouched by
    // this plan) will block.
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(path.join(t.roomA, '.mindrian', 'jtbd-state.json'), JSON.stringify({
      version: 1,
      current: {
        jtbd: 'decide-pursue',
        confidence: 1.0,
        entered_at: now,
        evidence: ['manual_set'],
        expires_at: expiresAt,
        turn_count: 1,
        manual_set: true,
      },
      history: [
        { from: 'explore', to: 'decide-pursue', trigger: 'manual_set', at: now, evidence: ['manual_set'] },
      ],
    }, null, 2));
    // Capture state file mtime + content BEFORE running.
    const statePath = path.join(t.roomA, '.mindrian', 'jtbd-state.json');
    const beforeState = fs.readFileSync(statePath, 'utf8');

    // Run the Stop hook with a /mos: methodology last response so the Phase 100
    // classifier path engages and attempts a transition to find-bottleneck.
    const r = spawnSync('node', [JTBD_UPDATE, 'stop'], {
      env: Object.assign({}, process.env, {
        MINDRIAN_ROOMS_HOME: t.home,
        CLAUDE_ACTIVE_ROOM: t.roomA,
        CLAUDE_USER_MESSAGE: 'where is the bottleneck',
        CLAUDE_LAST_RESPONSE: 'Larry: I will run /mos:rs-fetch to find the bottleneck.',
      }),
      encoding: 'utf8',
      input: '',
    });
    if (r.status !== 0) { fail('Class 10: Stop hook exit 0', 'exit ' + r.status + ' stderr=' + r.stderr); return; }

    // (a) Phase 100 within-session preserved: the manual-block branch keeps
    //     `current` untouched (still decide-pursue, manual_set true) and
    //     appends an auto_blocked_by_manual history row. Must be valid JSON
    //     with version 1 and a current row.
    let afterStateRaw = '';
    try { afterStateRaw = fs.readFileSync(statePath, 'utf8'); }
    catch (e) { fail('Class 10: within-session preserved', 'state file missing after Stop'); return; }
    let afterState;
    try { afterState = JSON.parse(afterStateRaw); }
    catch (e) { fail('Class 10: within-session valid JSON', 'parse error: ' + e.message); return; }
    if (!afterState || afterState.version !== 1 || !afterState.current) {
      fail('Class 10: within-session schema preserved', 'schema mismatch: ' + afterStateRaw.slice(0, 200));
      return;
    }
    if (afterState.current.jtbd !== 'decide-pursue' || afterState.current.manual_set !== true) {
      fail('Class 10: manual override held through the auto attempt',
        'current=' + JSON.stringify(afterState.current));
      return;
    }
    const blockedRow = (afterState.history || []).find(h => h && h.trigger === 'auto_blocked_by_manual');
    if (!blockedRow) {
      fail('Class 10: auto_blocked_by_manual row appended', 'history=' + JSON.stringify(afterState.history || []).slice(0, 400));
      return;
    }

    // (b) across-session in_flight row should now exist for room-a's
    //     manually-set jtbd (decide-pursue), proving the MEM-01 manual
    //     round trip fires end to end through the real Stop hook: the
    //     additive block re-reads the still-manual `current`, manual_set
    //     round-trips true, and the reconciled gate promotes it with no
    //     turn_count floor needed.
    const mem = readMemoryFile(t.home);
    const inFlight = (mem && mem.rooms && mem.rooms['room-a'] && mem.rooms['room-a'].in_flight) || [];
    const promoted = inFlight.find(x => x.jtbd === 'decide-pursue');
    if (!promoted) {
      fail('Class 10: additive promoteIfEligible fired via manual round trip',
        'no across-session in_flight row for decide-pursue; mem.rooms=' + JSON.stringify((mem && mem.rooms) || {}).slice(0, 400));
      return;
    }
    if (promoted.manual_set !== true) {
      fail('Class 10: promoted row carries manual_set true', 'row=' + JSON.stringify(promoted));
      return;
    }

    ok('Class 10: Phase 100 Stop hook extension preserves the manual-blocked within-session state AND fires across-session promote via the manual round trip');
  } finally { t.cleanup(); }
})();

// =============================================================================
// Summary
// =============================================================================
process.stdout.write('\nPhase 103-05 hook integration: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
