#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-02 Task 3 -- D-06 auto_explore_decision capture integration tests.
 *
 * Verifies lib/agents/auto-explore-agent.cjs::handleUserResponse emits an
 * auto_explore_decision event through lib/core/telemetry/writer.cjs ONLY on
 * user-initiated F.1 picks (EXPLORE / SKIP / LATER). System-driven skip
 * paths (auto_explore_skipped from fingerprint / fire suppression) do NOT
 * emit (system decision, not user response).
 *
 * Test map (4 cases):
 *   1. handleUserResponse({finding, userResponse:'EXPLORE'}) emits a
 *      auto_explore_decision event with user_response='kept',
 *      finding_type='whitespace', and domain_match_score=finding.score.
 *   2. finding_type is one of {whitespace, reverse_salient, cross_domain}
 *      for the 3 Phase 117 source_pipeline values
 *      (domain / reverse-salients / cross-domain).
 *   3. user_response is one of {kept, redid, ignored} for the 3 user
 *      F.1 verbs that map to engagement (EXPLORE / LATER / SKIP).
 *   4. System-driven skip paths (auto_explore_skipped) do NOT route
 *      through handleUserResponse and therefore do NOT emit an
 *      auto_explore_decision event.
 *
 * Hermetic: each test creates a tmpdir + HOME swap.
 *
 * Em-dash HARD RULE: use "--" not U+2014.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..');
const AGENT_PATH = path.join(REPO, 'lib/agents/auto-explore-agent.cjs');
const WRITER_PATH = path.join(REPO, 'lib/core/telemetry/writer.cjs');

function mkTmpDir(prefix) {
  const base = path.join(
    os.tmpdir(),
    'mos-121-02-autoexp-' + prefix + '-' + process.pid + '-' + Date.now().toString(36)
  );
  fs.mkdirSync(base, { recursive: true });
  return base;
}
function rmRf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
}
function withHome(tmp, fn) {
  const originalHome = process.env.HOME;
  process.env.HOME = tmp;
  try { delete require.cache[require.resolve(WRITER_PATH)]; } catch (_) {}
  try { delete require.cache[require.resolve(AGENT_PATH)]; } catch (_) {}
  try { return fn(); } finally {
    process.env.HOME = originalHome;
    try { delete require.cache[require.resolve(WRITER_PATH)]; } catch (_) {}
    try { delete require.cache[require.resolve(AGENT_PATH)]; } catch (_) {}
  }
}
function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  return text.split('\n').filter(l => l.length > 0).map(l => JSON.parse(l));
}
function findEventsFile(tmpHome) {
  const dir = path.join(tmpHome, '.mindrian', 'telemetry', 'v1.13');
  if (!fs.existsSync(dir)) return null;
  const names = fs.readdirSync(dir).filter(n => /^events-\d{4}-W\d{2}\.jsonl$/.test(n));
  if (names.length === 0) return null;
  return path.join(dir, names[0]);
}

function makeFixtureRoomDir(tmp, slug) {
  const roomDir = path.join(tmp, 'rooms', slug);
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  return roomDir;
}

function fixtureFinding(sourcePipeline, score) {
  return {
    id: 'finding-id-' + Date.now().toString(36),
    material_id: 'material-id-fixture',
    source_node_id: 'node-id-fixture',
    file_path_sha256: 'a'.repeat(16),
    source_pipeline: sourcePipeline,
    score: typeof score === 'number' ? score : 0.85,
    candidate_count: 1,
    top_differential_score: 0.6,
  };
}

// ---------- Test 1: EXPLORE emits auto_explore_decision with kept + whitespace + score ----------

(function test1ExploreKeptWhitespace() {
  const tmp = mkTmpDir('t1');
  try {
    withHome(tmp, () => {
      const roomDir = makeFixtureRoomDir(tmp, 'fixture-room-t1');
      const agent = require(AGENT_PATH);
      const result = agent.handleUserResponse({
        finding: fixtureFinding('domain', 0.85),
        userResponse: 'EXPLORE',
        roomDir: roomDir,
      });
      assert.ok(result && result.ok, 'handleUserResponse must succeed: ' + JSON.stringify(result));
      const filePath = findEventsFile(tmp);
      assert.ok(filePath, 'events-YYYY-WNN.jsonl must be created');
      const rows = readJsonl(filePath).filter(r => r.event === 'auto_explore_decision');
      assert.equal(rows.length, 1, 'exactly 1 auto_explore_decision row; got ' + rows.length);
      const r = rows[0];
      assert.equal(r.user_response, 'kept', 'EXPLORE must normalize to kept');
      assert.equal(r.finding_type, 'whitespace', 'domain source_pipeline -> whitespace finding_type');
      assert.equal(r.domain_match_score, 0.85, 'domain_match_score must equal finding.score');
      assert.equal(r.room_slug_sha256.length, 64, 'room_slug_sha256 must be 64-hex');
    });
    console.log('PASS test 1: EXPLORE emits auto_explore_decision(kept, whitespace, 0.85)');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 2: finding_type normalization across all 3 source_pipeline values ----------

(function test2FindingTypeNormalization() {
  const tmp = mkTmpDir('t2');
  const cases = [
    { src: 'domain',          expected: 'whitespace' },
    { src: 'reverse-salients', expected: 'reverse_salient' },
    { src: 'cross-domain',    expected: 'cross_domain' },
  ];
  const valid = new Set(['whitespace', 'reverse_salient', 'cross_domain']);
  try {
    withHome(tmp, () => {
      const roomDir = makeFixtureRoomDir(tmp, 'fixture-room-t2');
      const agent = require(AGENT_PATH);
      for (const c of cases) {
        agent.handleUserResponse({
          finding: fixtureFinding(c.src, 0.5),
          userResponse: 'EXPLORE',
          roomDir: roomDir,
        });
      }
      const filePath = findEventsFile(tmp);
      const rows = readJsonl(filePath).filter(r => r.event === 'auto_explore_decision');
      assert.equal(rows.length, cases.length,
        cases.length + ' auto_explore_decision rows expected; got ' + rows.length);
      // Order is append order.
      for (let i = 0; i < cases.length; i++) {
        assert.equal(rows[i].finding_type, cases[i].expected,
          'case ' + i + ': finding_type for source_pipeline=' + cases[i].src
          + ' must be ' + cases[i].expected + '; got ' + rows[i].finding_type);
        assert.ok(valid.has(rows[i].finding_type),
          'finding_type must be one of {whitespace,reverse_salient,cross_domain}; got ' + rows[i].finding_type);
      }
    });
    console.log('PASS test 2: finding_type normalized to {whitespace,reverse_salient,cross_domain}');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 3: user_response normalization for EXPLORE/LATER/SKIP ----------

(function test3UserResponseNormalization() {
  const tmp = mkTmpDir('t3');
  const cases = [
    { resp: 'EXPLORE', expected: 'kept' },
    { resp: 'LATER',   expected: 'redid' },
    { resp: 'SKIP',    expected: 'ignored' },
  ];
  const valid = new Set(['kept', 'redid', 'ignored']);
  try {
    withHome(tmp, () => {
      const roomDir = makeFixtureRoomDir(tmp, 'fixture-room-t3');
      const agent = require(AGENT_PATH);
      for (const c of cases) {
        agent.handleUserResponse({
          finding: fixtureFinding('domain', 0.7),
          userResponse: c.resp,
          roomDir: roomDir,
        });
      }
      const filePath = findEventsFile(tmp);
      const rows = readJsonl(filePath).filter(r => r.event === 'auto_explore_decision');
      assert.equal(rows.length, cases.length,
        cases.length + ' auto_explore_decision rows expected; got ' + rows.length);
      for (let i = 0; i < cases.length; i++) {
        assert.equal(rows[i].user_response, cases[i].expected,
          'case ' + i + ': user_response for ' + cases[i].resp
          + ' must be ' + cases[i].expected + '; got ' + rows[i].user_response);
        assert.ok(valid.has(rows[i].user_response),
          'user_response must be one of {kept,redid,ignored}; got ' + rows[i].user_response);
      }
    });
    console.log('PASS test 3: user_response normalized to {kept,redid,ignored} for EXPLORE/LATER/SKIP');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 4: System-driven paths (auto_explore_skipped) do NOT emit ----------

(function test4SystemSkippedNoEmit() {
  const tmp = mkTmpDir('t4');
  try {
    withHome(tmp, () => {
      const roomDir = makeFixtureRoomDir(tmp, 'fixture-room-t4');
      const agent = require(AGENT_PATH);
      // emitSkipped is the system-driven path -- it fires from suppress
      // logic in fingerprint/fire (Tier 0, just_talk, dispatcher_load_failed,
      // all_pipelines_empty, brain_baseline_unavailable). It does NOT route
      // through handleUserResponse and must NOT emit auto_explore_decision.
      if (typeof agent.emitSkipped === 'function') {
        agent.emitSkipped(roomDir, {
          finding: fixtureFinding('domain', 0.1),
          suppress_reason: 'tier_0',
          phase: 'fingerprint',
        });
      }
      // FREE_TEXT is also NOT one of the 3 engagement verbs (it is a system
      // fallback when the user types prose). It MUST NOT emit auto_explore_decision.
      agent.handleUserResponse({
        finding: fixtureFinding('domain', 0.5),
        userResponse: 'FREE_TEXT',
        roomDir: roomDir,
      });
      const filePath = findEventsFile(tmp);
      const rows = filePath ? readJsonl(filePath).filter(r => r.event === 'auto_explore_decision') : [];
      assert.equal(rows.length, 0,
        'system-driven skipped path + FREE_TEXT must NOT emit auto_explore_decision; got ' + rows.length);
    });
    console.log('PASS test 4: system-driven auto_explore_skipped + FREE_TEXT do NOT emit auto_explore_decision');
  } finally {
    rmRf(tmp);
  }
})();

console.log('\ntest-121-02-auto-explore-capture.cjs: 4/4 tests passed');
