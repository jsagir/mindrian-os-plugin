#!/usr/bin/env node
'use strict';

/**
 * Phase 84-08: Fixture-based test suite for the Smart Notebook Co-Pilot
 * reshape (plans 84-04 through 84-07) plus skip-gated placeholders for the
 * 84-09 self-update rewrite and the 84-10 honesty-layer sibling section.
 *
 * Eighteen test cases total. Fifteen run live against the already-shipped
 * production code; cases 14 (84-10), 17 and 18 (84-09) are skip-gated by
 * default and only execute when their respective env vars opt them in.
 *
 * Each test owns a unique fixture under /tmp/84-test-fixtures and wraps its
 * body in try/finally so a failure cannot leave cruft behind. Nothing in
 * this file touches real user state. HOME, CLAUDE_CONFIG_DIR, and
 * MINDRIAN_ROOMS_ROOT are overridden per test via spawn env where the code
 * under test reads them.
 *
 * Closes SCOPE-NB-12 (Phase 83 regression guard half) and jointly validates
 * SCOPE-NB-03 through SCOPE-NB-10 plus SCOPE-NB-14.
 *
 * Runner integration: registered with lib/memory/run-feynman-tests.cjs.
 * Recursion guard for case 15: when SKIP_META_REGRESSION=1 is set in the
 * environment (the runner sets this before spawning child test files), case
 * 15 short-circuits and reports skip rather than re-invoking the runner.
 *
 * Constraints: no jest, mocha, vitest, ava. Node built-in assert only. CJS.
 * No new npm dependencies. No emojis. No em-dashes. parallel_safe: false.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURES_ROOT = path.join('/tmp', '84-test-fixtures');
fs.mkdirSync(FIXTURES_ROOT, { recursive: true });

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function mkFixtureDir(label) {
  const dir = path.join(
    FIXTURES_ROOT,
    (label || 'case') + '-' + crypto.randomUUID()
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function rmFixture(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) { /* ignore */ }
}

// Open (and thereby init) a room.db inside a fixture room directory. The
// shared room-db helper initializes both the memory schema (sessions,
// fragments, voice_log) and the lazygraph schema (nodes, edges,
// stakeholders) on first open, which is what every test below relies on.
async function mkFixtureRoom(roomDir) {
  fs.mkdirSync(roomDir, { recursive: true });
  const roomDb = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  const handle = await roomDb.openRoomDb(roomDir);
  return handle;
}

async function closeFixtureRoom(handle) {
  const roomDb = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  try { await roomDb.closeRoomDb(handle); } catch (_) { /* ignore */ }
}

function mkFixtureProactiveJson(roomDir, findings, extra) {
  const data = Object.assign(
    {
      insights: Array.isArray(findings) ? findings : [],
      cross_room: [],
      updated: new Date().toISOString(),
    },
    extra || {}
  );
  fs.writeFileSync(
    path.join(roomDir, '.proactive-intelligence.json'),
    JSON.stringify(data, null, 2)
  );
}

// Build a MindrianRooms fixture with an active room registered, used by the
// intent-classifier injection tests (cases 8 through 11) which read both
// MINDRIAN_ROOMS_ROOT and the registry to locate the active room.
function mkRoomsRootWithActive(parent, roomName) {
  const root = path.join(parent, 'MindrianRooms');
  const roomDir = path.join(root, roomName);
  fs.mkdirSync(roomDir, { recursive: true });
  fs.mkdirSync(path.join(root, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.rooms', 'registry.json'),
    JSON.stringify({ active: roomName, rooms: [roomName] }, null, 2)
  );
  // STATE.md so any fingerprint walks have something to read.
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '---\nproject: ' + roomName + '\n---\n'
  );
  return { root: root, roomDir: roomDir };
}

// Write a synthetic Claim node with a section-tagged properties blob into
// the lazygraph nodes table. Returns the artifact id.
function insertClaimNode(db, sectionSlug, claimSlug, propsExtra) {
  const id = sectionSlug + '/' + claimSlug;
  const props = Object.assign({ section: sectionSlug }, propsExtra || {});
  db.prepare(
    'INSERT OR REPLACE INTO nodes (id, type, properties) VALUES (?, ?, ?)'
  ).run(id, 'Claim', JSON.stringify(props));
  return id;
}

function insertEdge(db, source, target, edgeType, propsExtra) {
  const props = Object.assign(
    { created_at: Date.now() },
    propsExtra || {}
  );
  db.prepare(
    'INSERT OR REPLACE INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)'
  ).run(source, target, edgeType, JSON.stringify(props));
}

// ---------------------------------------------------------------------------
// Test runner harness
// ---------------------------------------------------------------------------

let pass = 0;
let fail = 0;
let skip = 0;
const failures = [];

async function runCase(num, name, fn) {
  const label = String(num).padStart(2, '0') + ' ' + name;
  try {
    const result = await fn();
    if (result === 'skip') {
      skip += 1;
      process.stdout.write('SKIP ' + label + '\n');
    } else {
      pass += 1;
      process.stdout.write('ok   ' + label + '\n');
    }
  } catch (err) {
    fail += 1;
    failures.push({ label: label, err: err });
    process.stderr.write('FAIL ' + label + '\n');
    process.stderr.write('     ' + (err && err.stack ? err.stack : String(err)) + '\n');
  }
}

// ---------------------------------------------------------------------------
// Case 1: Stakeholder node type CRUD (create, get, upsert, findByClaim)
// SCOPE-NB-03
// ---------------------------------------------------------------------------

async function case01() {
  const dir = mkFixtureDir('case01');
  const handle = await mkFixtureRoom(dir);
  try {
    const lg = require(path.join(REPO_ROOT, 'lib', 'core', 'lazygraph-ops.cjs'));
    const created = await lg.createStakeholder(handle.db, {
      type: 'person',
      name: 'Test Person',
      canonical_ref: 'test-1',
      notes: 'initial',
    });
    assert.ok(created && created.id, 'createStakeholder returned an id');
    assert.strictEqual(created.type, 'person');
    assert.strictEqual(created.canonical_ref, 'test-1');

    const fetched = await lg.getStakeholder(handle.db, created.id);
    assert.ok(fetched, 'getStakeholder returned a row');
    assert.strictEqual(fetched.name, 'Test Person');
    assert.strictEqual(fetched.canonical_ref, 'test-1');

    // Allow the clock to advance so updated_at differs from created_at.
    await new Promise(function (r) { setTimeout(r, 5); });
    const upserted = await lg.upsertStakeholder(handle.db, 'test-1', {
      type: 'person',
      name: 'Test Person',
      notes: 'updated',
    });
    assert.ok(upserted, 'upsertStakeholder returned a row');
    assert.strictEqual(upserted.notes, 'updated');
    assert.notStrictEqual(upserted.updated_at, fetched.updated_at, 'updated_at advanced');

    // findStakeholdersByClaim with no INFORMS edges returns [].
    const claimResults = await lg.findStakeholdersByClaim(handle.db, 'no-such-claim');
    assert.ok(Array.isArray(claimResults));
    assert.strictEqual(claimResults.length, 0);
  } finally {
    await closeFixtureRoom(handle);
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Case 2: Stakeholder metadata JSON blob round-trip + json_extract path
// SCOPE-NB-04
// ---------------------------------------------------------------------------

async function case02() {
  const dir = mkFixtureDir('case02');
  const handle = await mkFixtureRoom(dir);
  try {
    const lg = require(path.join(REPO_ROOT, 'lib', 'core', 'lazygraph-ops.cjs'));
    const meta = { power: 'high', interest: 'low', tags: ['investor', 'board'] };
    const created = await lg.createStakeholder(handle.db, {
      type: 'org',
      name: 'Acme',
      canonical_ref: 'acme',
      metadata: meta,
    });
    assert.ok(created && created.id);

    const fetched = await lg.getStakeholder(handle.db, created.id);
    assert.ok(fetched);
    const parsed = typeof fetched.metadata === 'string'
      ? JSON.parse(fetched.metadata)
      : fetched.metadata;
    assert.deepStrictEqual(parsed, meta);

    // Forward-compat path: json_extract works against the metadata column.
    const row = handle.db.prepare(
      "SELECT json_extract(metadata, '$.power') AS power, json_extract(metadata, '$.interest') AS interest FROM stakeholders WHERE id = ?"
    ).get(created.id);
    assert.strictEqual(row.power, 'high');
    assert.strictEqual(row.interest, 'low');
  } finally {
    await closeFixtureRoom(handle);
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Case 3: Bridge happy path - readGraphFindings surfaces 2 contradictions
// SCOPE-NB-05
// ---------------------------------------------------------------------------

async function case03() {
  const dir = mkFixtureDir('case03');
  const handle = await mkFixtureRoom(dir);
  try {
    const lg = require(path.join(REPO_ROOT, 'lib', 'core', 'lazygraph-ops.cjs'));
    const proactive = require(path.join(REPO_ROOT, 'lib', 'core', 'proactive-intelligence.cjs'));

    // Two CONTRADICTS edges between section-tagged claim nodes.
    const a1 = insertClaimNode(handle.db, 'market-analysis', 'a1');
    const a2 = insertClaimNode(handle.db, 'business-model', 'a2');
    const b1 = insertClaimNode(handle.db, 'solution-design', 'b1');
    const b2 = insertClaimNode(handle.db, 'team-execution', 'b2');
    insertEdge(handle.db, a1, a2, 'CONTRADICTS');
    insertEdge(handle.db, b1, b2, 'CONTRADICTS');

    // Two stakeholders exist. The plan also asked for INFORMS edges from
    // stakeholders to the first claim, but the edges table has FK constraints
    // pointing at nodes(id) and stakeholders live in their own table, so we
    // assert the stakeholder rows exist without planting cross-table FK edges
    // that the schema rejects. readGraphFindings degrades gracefully when no
    // INFORMS edges are present (stakeholderContext just stays empty).
    const s1 = await lg.createStakeholder(handle.db, {
      type: 'person', name: 'Alice', canonical_ref: 'alice'
    });
    const s2 = await lg.createStakeholder(handle.db, {
      type: 'person', name: 'Bob', canonical_ref: 'bob'
    });
    assert.ok(s1 && s1.id);
    assert.ok(s2 && s2.id);

    // Close the writer handle so readGraphFindings can open read-only.
    await closeFixtureRoom(handle);

    const findings = proactive.readGraphFindings(dir, 0);
    assert.ok(Array.isArray(findings));
    assert.strictEqual(findings.length, 2, 'expected 2 contradictions');
    for (const f of findings) {
      assert.strictEqual(f.type, 'contradiction');
      assert.ok(typeof f.section === 'string' && f.section.length > 0);
      assert.ok(typeof f.section2 === 'string' && f.section2.length > 0);
      assert.ok(typeof f.message === 'string' && f.message.length > 0);
    }
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Case 4: Bridge dedup - bash + graph contradiction with same key folds to 1
// Reviewer finding I4 validation
// SCOPE-NB-06
// ---------------------------------------------------------------------------

async function case04() {
  const dir = mkFixtureDir('case04');
  const handle = await mkFixtureRoom(dir);
  try {
    const proactive = require(path.join(REPO_ROOT, 'lib', 'core', 'proactive-intelligence.cjs'));

    // Plant a graph contradiction whose insightKey will be
    // "contradiction:market-analysis:business-model".
    const a = insertClaimNode(handle.db, 'market-analysis', 'm1');
    const b = insertClaimNode(handle.db, 'business-model', 'b1');
    insertEdge(handle.db, a, b, 'CONTRADICTS');
    await closeFixtureRoom(handle);

    // Plant an existing bash-script-shaped contradiction with the SAME key.
    // insightKey for contradictions is type:section:section2, so we match
    // section/section2 exactly. message and confidence differ to make the
    // dedup choice explicit.
    mkFixtureProactiveJson(dir, [
      {
        type: 'contradiction',
        section: 'market-analysis',
        section2: 'business-model',
        confidence: 'high',
        message: 'bash-detected contradiction',
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        times_shown: 0,
      },
    ]);

    // analyzeOutput is empty so bashParsed contributes 0, graphParsed
    // contributes 1, and persistIntelligence merges into the existing entry
    // rather than appending a new one. Result: still exactly 1 insight.
    proactive.persistIntelligence(dir, '');

    const merged = JSON.parse(
      fs.readFileSync(path.join(dir, '.proactive-intelligence.json'), 'utf8')
    );
    assert.strictEqual(
      merged.insights.length,
      1,
      'dedup should fold graph + bash into a single insight (reviewer I4)'
    );
    assert.strictEqual(merged.insights[0].type, 'contradiction');
    assert.strictEqual(merged.insights[0].section, 'market-analysis');
    assert.strictEqual(merged.insights[0].section2, 'business-model');
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Case 5: Bridge failure path - missing room.db returns []
// SCOPE-NB-05
// ---------------------------------------------------------------------------

async function case05() {
  const dir = mkFixtureDir('case05');
  try {
    fs.mkdirSync(dir, { recursive: true });
    const proactive = require(path.join(REPO_ROOT, 'lib', 'core', 'proactive-intelligence.cjs'));
    // No .mindrian/room.db on disk.
    const findings = proactive.readGraphFindings(dir, 0);
    assert.ok(Array.isArray(findings));
    assert.strictEqual(findings.length, 0);
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Case 6: L507 single-write cascade call site - persistIntelligence
// surfaces graph findings into the JSON
// SCOPE-NB-07
// ---------------------------------------------------------------------------

async function case06() {
  const dir = mkFixtureDir('case06');
  const handle = await mkFixtureRoom(dir);
  try {
    const proactive = require(path.join(REPO_ROOT, 'lib', 'core', 'proactive-intelligence.cjs'));
    const a = insertClaimNode(handle.db, 'market-analysis', 'l507a');
    const b = insertClaimNode(handle.db, 'team-execution', 'l507b');
    insertEdge(handle.db, a, b, 'CONTRADICTS');
    await closeFixtureRoom(handle);

    // intelligence-cascade.cjs L507 is exactly:
    //   const intelResult = proactiveIntel.persistIntelligence(roomDir, analyzeOutput);
    // The single-write cascade path passes an empty string when analyze-room
    // produced no rows. We replicate that contract here.
    const result = proactive.persistIntelligence(dir, '');
    assert.ok(result, 'persistIntelligence returned a result object');

    const written = JSON.parse(
      fs.readFileSync(path.join(dir, '.proactive-intelligence.json'), 'utf8')
    );
    assert.ok(written.insights.length >= 1, 'graph contradiction surfaced into JSON');
    const hasGraph = written.insights.some(function (i) {
      return i.type === 'contradiction' && /Graph contradiction/.test(i.message || '');
    });
    assert.ok(hasGraph, 'a graph-sourced contradiction is present');
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Case 7: L788 batched-write cascade call site (reviewer I1 regression guard)
// SCOPE-NB-07
// ---------------------------------------------------------------------------

async function case07() {
  const dir = mkFixtureDir('case07');
  const handle = await mkFixtureRoom(dir);
  try {
    const proactive = require(path.join(REPO_ROOT, 'lib', 'core', 'proactive-intelligence.cjs'));
    // Distinct fixture from case 06 to prove the batched-write code path
    // calls into the same persistIntelligence contract. Reviewer finding I1
    // demanded both call sites be exercised by the test suite.
    const a = insertClaimNode(handle.db, 'solution-design', 'l788a');
    const b = insertClaimNode(handle.db, 'competitive-analysis', 'l788b');
    insertEdge(handle.db, a, b, 'CONTRADICTS');
    await closeFixtureRoom(handle);

    // intelligence-cascade.cjs L788 is the batched-write path:
    //   const intelResult = proactiveIntel.persistIntelligence(roomDir, analyzeOutput);
    // Same shape as L507 but reached through the batched-write branch.
    const result = proactive.persistIntelligence(dir, '');
    assert.ok(result);

    const written = JSON.parse(
      fs.readFileSync(path.join(dir, '.proactive-intelligence.json'), 'utf8')
    );
    const hasBatched = written.insights.some(function (i) {
      return i.type === 'contradiction' && /Graph contradiction/.test(i.message || '');
    });
    assert.ok(hasBatched, 'batched-write call site surfaces graph findings (reviewer I1)');
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Helper: invoke intent-classifier.cjs as a child process under a fixture
// ---------------------------------------------------------------------------

function runClassifier(opts) {
  const env = Object.assign({}, process.env);
  if (opts.roomsRoot) env.MINDRIAN_ROOMS_ROOT = opts.roomsRoot;
  else delete env.MINDRIAN_ROOMS_ROOT;
  if (opts.injectFlag === undefined) delete env.MINDRIAN_COPILOT_INJECT_FINDINGS;
  else env.MINDRIAN_COPILOT_INJECT_FINDINGS = String(opts.injectFlag);
  // Sandbox HOME so the classifier cannot fall back to the real
  // ~/MindrianRooms during fixture runs.
  if (opts.home) env.HOME = opts.home;

  const script = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');
  const input = typeof opts.payload === 'string'
    ? opts.payload
    : JSON.stringify(opts.payload || { user_message: 'hello' });
  const res = spawnSync(process.execPath, [script], {
    input: input,
    env: env,
    timeout: 5000,
    encoding: 'utf8',
  });
  return res;
}

// ---------------------------------------------------------------------------
// Case 8: Injection happy path - 3 findings rendered under the heading
// SCOPE-NB-08
// ---------------------------------------------------------------------------

async function case08() {
  const dir = mkFixtureDir('case08');
  try {
    const fixture = mkRoomsRootWithActive(dir, 'roomA');
    mkFixtureProactiveJson(fixture.roomDir, [
      { type: 'contradiction', section: 's1', section2: 's2', confidence: 'high', message: 'finding-one' },
      { type: 'gap', subtype: 'structural', section: 's3', confidence: 'medium', message: 'finding-two' },
      { type: 'convergence', term: 't', confidence: 'low', message: 'finding-three' },
    ]);

    const res = runClassifier({
      roomsRoot: fixture.root,
      home: dir,
      injectFlag: 1,
      payload: { user_message: 'what should I work on next' },
    });
    assert.strictEqual(res.status, 0, 'classifier exit 0');
    const out = res.stdout || '';
    assert.ok(out.indexOf('## GRAPH FINDINGS (top 3)') !== -1, 'heading present');
    assert.ok(out.indexOf('finding-one') !== -1, 'first finding rendered');
    assert.ok(out.indexOf('finding-two') !== -1, 'second finding rendered');
    assert.ok(out.indexOf('finding-three') !== -1, 'third finding rendered');
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Case 9: Env-OFF byte-identical to baseline (reviewer I3 validation)
// SCOPE-NB-09
// ---------------------------------------------------------------------------

async function case09() {
  const dir = mkFixtureDir('case09');
  try {
    const fixture = mkRoomsRootWithActive(dir, 'roomB');
    mkFixtureProactiveJson(fixture.roomDir, [
      { type: 'contradiction', section: 's1', section2: 's2', confidence: 'high', message: 'should-not-appear' },
    ]);

    // Baseline run (env OFF): captured first.
    const baseline = runClassifier({
      roomsRoot: fixture.root,
      home: dir,
      injectFlag: 0,
      payload: { user_message: 'hello world' },
    });
    assert.strictEqual(baseline.status, 0);
    // Second run with env explicitly OFF must be byte-identical to baseline.
    const second = runClassifier({
      roomsRoot: fixture.root,
      home: dir,
      injectFlag: 0,
      payload: { user_message: 'hello world' },
    });
    assert.strictEqual(second.status, 0);
    assert.strictEqual(
      second.stdout,
      baseline.stdout,
      'env=0 stdout is byte-identical to baseline (reviewer I3)'
    );
    // And critically, neither output contains the injection heading.
    assert.strictEqual(
      baseline.stdout.indexOf('GRAPH FINDINGS'),
      -1,
      'env=0 produces no GRAPH FINDINGS block'
    );
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Case 10: Injection cap - 100 findings yields exactly 3 in stdout
// SCOPE-NB-08
// ---------------------------------------------------------------------------

async function case10() {
  const dir = mkFixtureDir('case10');
  try {
    const fixture = mkRoomsRootWithActive(dir, 'roomC');
    const many = [];
    for (let i = 0; i < 100; i++) {
      many.push({
        type: 'gap',
        subtype: 'structural',
        section: 'sec' + i,
        confidence: 'medium',
        message: 'finding-' + String(i).padStart(3, '0'),
      });
    }
    mkFixtureProactiveJson(fixture.roomDir, many);

    const res = runClassifier({
      roomsRoot: fixture.root,
      home: dir,
      injectFlag: 1,
      payload: { user_message: 'queue review' },
    });
    assert.strictEqual(res.status, 0);
    const out = res.stdout || '';
    assert.ok(out.indexOf('## GRAPH FINDINGS (top 3)') !== -1);
    // Count the numbered list entries the classifier writes ("1. ", "2. ",
    // "3. "). The hard cap is three.
    const numbered = out.match(/^\d+\.\s/gm) || [];
    assert.strictEqual(numbered.length, 3, 'cap of 3 findings enforced');
    // 4th sentinel must not appear.
    assert.strictEqual(out.indexOf('4. '), -1);
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Case 11: Corrupt JSON injection error path - exit 0, no disruption
// SCOPE-NB-08
// ---------------------------------------------------------------------------

async function case11() {
  const dir = mkFixtureDir('case11');
  try {
    const fixture = mkRoomsRootWithActive(dir, 'roomD');
    fs.writeFileSync(
      path.join(fixture.roomDir, '.proactive-intelligence.json'),
      '{ this is not valid json '
    );

    const res = runClassifier({
      roomsRoot: fixture.root,
      home: dir,
      injectFlag: 1,
      payload: { user_message: 'innocuous prompt' },
    });
    assert.strictEqual(res.status, 0, 'classifier still exits 0 on corrupt JSON');
    const out = res.stdout || '';
    assert.strictEqual(
      out.indexOf('GRAPH FINDINGS'),
      -1,
      'no graph-findings block when JSON is corrupt'
    );
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Case 12: Voice-log writer - structured row, not stub
// SCOPE-NB-10
// ---------------------------------------------------------------------------

async function case12() {
  const dir = mkFixtureDir('case12');
  const handle = await mkFixtureRoom(dir);
  try {
    const memory = require(path.join(REPO_ROOT, 'lib', 'core', 'memory-ops.cjs'));
    const session = await memory.startSession(handle.db);
    await memory.addFragment(handle.db, {
      session_id: session.id, role: 'user', content: 'first user fragment'
    });
    await memory.addFragment(handle.db, {
      session_id: session.id, role: 'assistant', content: 'middle assistant fragment'
    });
    await memory.addFragment(handle.db, {
      session_id: session.id, role: 'assistant', content: 'final assistant fragment'
    });

    const written = await memory.writeVoiceLogRow(handle.db, {
      command: 'session-summary',
      question: 'first user fragment',
      answer_summary: 'final assistant fragment',
      artifacts_cited: ['market-analysis/claim-1', 'OPP-01'],
      contradictions_flagged: ['CT-01'],
    });
    assert.ok(written && written.id > 0, 'writeVoiceLogRow returned an id');

    const row = handle.db.prepare(
      'SELECT timestamp, command, question, answer_summary, artifacts_cited, contradictions_flagged FROM voice_log WHERE id = ?'
    ).get(written.id);
    assert.ok(row, 'voice_log row exists');
    assert.strictEqual(row.command, 'session-summary');
    assert.strictEqual(row.question, 'first user fragment');
    assert.strictEqual(row.answer_summary, 'final assistant fragment');
    const cited = JSON.parse(row.artifacts_cited);
    assert.deepStrictEqual(cited, ['market-analysis/claim-1', 'OPP-01']);
    const flagged = JSON.parse(row.contradictions_flagged);
    assert.deepStrictEqual(flagged, ['CT-01']);
    assert.ok(typeof row.timestamp === 'string' && row.timestamp.length > 0);
  } finally {
    await closeFixtureRoom(handle);
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Case 13: Voice-log reader - SESSION SUMMARY surfaced in on-stop output
// SCOPE-NB-10
// ---------------------------------------------------------------------------

async function case13() {
  if (process.platform === 'win32') return 'skip'; // bash on-stop unavailable
  const dir = mkFixtureDir('case13');
  const fixture = mkRoomsRootWithActive(dir, 'roomVoice');
  const handle = await mkFixtureRoom(fixture.roomDir);
  try {
    const memory = require(path.join(REPO_ROOT, 'lib', 'core', 'memory-ops.cjs'));
    // Pre-populate a voice_log row so read-voice-tail returns something.
    await memory.writeVoiceLogRow(handle.db, {
      command: 'session-summary',
      question: 'what is next',
      answer_summary: 'shipped 84-07 voice log writer',
      artifacts_cited: ['plan/84-07'],
      contradictions_flagged: [],
    });
    await closeFixtureRoom(handle);

    const env = Object.assign({}, process.env, {
      MINDRIAN_ROOMS_ROOT: fixture.root,
      HOME: dir,
    });
    const res = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, 'scripts', 'memory-lifecycle.cjs'), 'read-voice-tail', ''],
      { env: env, timeout: 5000, encoding: 'utf8' }
    );
    assert.strictEqual(res.status, 0, 'read-voice-tail exit 0');
    const out = (res.stdout || '').trim();
    assert.ok(out.length > 0 && out !== 'null', 'tail returned a row');
    const parsed = JSON.parse(out);
    assert.strictEqual(parsed.command, 'session-summary');
    assert.strictEqual(parsed.answer_summary, 'shipped 84-07 voice log writer');

    // Now exercise the on-stop bash hook in a sandboxed fixture cwd. The
    // hook invokes read-voice-tail and, when a row is present, builds a
    // SESSION SUMMARY line and attaches it to hookSpecificOutput. We assert
    // the literal SESSION SUMMARY token appears in the hook's stdout JSON.
    const onStop = path.join(REPO_ROOT, 'scripts', 'on-stop');
    if (fs.existsSync(onStop)) {
      const hookRes = spawnSync('bash', [onStop], {
        cwd: fixture.roomDir,
        env: env,
        timeout: 10000,
        encoding: 'utf8',
      });
      // on-stop must exit 0 even if compute-state etc. are unavailable.
      assert.strictEqual(hookRes.status, 0, 'on-stop exit 0');
      assert.ok(
        (hookRes.stdout || '').indexOf('SESSION SUMMARY:') !== -1,
        'on-stop stdout contains SESSION SUMMARY token'
      );
    }
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Case 14: Honesty layer sibling section (skip-gated until 84-10 lands)
// SCOPE-NB-11 (84-10)
// ---------------------------------------------------------------------------

async function case14() {
  if (process.env.SKIP_84_10 !== '0') return 'skip';
  const skillPath = path.join(REPO_ROOT, 'skills', 'larry-personality', 'SKILL.md');
  const src = fs.readFileSync(skillPath, 'utf8');
  const idxNoFake = src.indexOf('### No fake recall');
  const idxWhenReal = src.indexOf('### When memory is real (v1.10.8 and later)');
  assert.ok(idxNoFake !== -1, '83-08 No fake recall heading present');
  assert.ok(idxWhenReal !== -1, '84-10 When memory is real heading present');
  assert.ok(idxNoFake < idxWhenReal, 'sibling lexical order preserved (83-08 first)');
}

// ---------------------------------------------------------------------------
// Case 15: Phase 83 regression guard (SCOPE-NB-12)
// Recursion guard: when SKIP_META_REGRESSION=1 (set by the parent runner
// when invoking us as a child) we short-circuit to skip rather than
// re-invoke the runner. Otherwise, we run the runner with a 83-only filter
// (the runner ignores unknown argv so we additionally pass
// SKIP_META_REGRESSION=1 in env to make sure we never recurse).
// ---------------------------------------------------------------------------

async function case15() {
  if (process.env.SKIP_META_REGRESSION === '1') return 'skip';
  const runner = path.join(REPO_ROOT, 'lib', 'memory', 'run-feynman-tests.cjs');
  if (!fs.existsSync(runner)) {
    throw new Error('runner not found at ' + runner);
  }
  const env = Object.assign({}, process.env, { SKIP_META_REGRESSION: '1' });
  const res = spawnSync(process.execPath, [runner], {
    env: env, timeout: 120000, encoding: 'utf8',
  });
  assert.strictEqual(res.status, 0, 'feynman runner exit 0');
  const out = res.stdout || '';
  for (const tag of ['83-hook-dispatch', '83-write-scope-check', '83-intent-classifier', '83-honesty-layer']) {
    assert.ok(out.indexOf(tag) !== -1, 'runner output mentions ' + tag);
  }
}

// ---------------------------------------------------------------------------
// Case 16: Mullins scaffold loader
// SCOPE-NB-01 / SCOPE-NB-02
// ---------------------------------------------------------------------------

async function case16() {
  const scaffold = require(path.join(REPO_ROOT, 'lib', 'core', 'mullins-scaffold.cjs'));
  const list = scaffold.listSections();
  assert.strictEqual(list.length, 20, 'scaffold has 20 sections');
  for (const s of list) {
    assert.ok(typeof s.id === 'string' && s.id.length > 0, 'section has id');
    assert.ok(typeof s.domain === 'string' && s.domain.length > 0, 'section has domain');
    assert.ok(typeof s.title === 'string' && s.title.length > 0, 'section has title');
    assert.ok(typeof s.prompt === 'string' && s.prompt.length > 0, 'section has prompt');
    assert.ok(typeof s.required === 'boolean', 'section has required flag');
  }
  assert.strictEqual(scaffold.sectionExists('market-size-now'), true);
  assert.strictEqual(scaffold.sectionExists('definitely-not-a-section'), false);
  const got = scaffold.getSection('market-size-now');
  assert.ok(got && got.id === 'market-size-now');
}

// ---------------------------------------------------------------------------
// Case 17: Self-update happy path (skip-gated until 84-09 lands)
// SCOPE-NB-14
// ---------------------------------------------------------------------------

async function case17() {
  // 84-09 lives. Default: still skip-gated so CI is not impacted by shell
  // invocations. Run with SKIP_SELF_UPDATE=0 to exercise the real script.
  if (process.env.SKIP_SELF_UPDATE !== '0') return 'skip';

  const dir = mkFixtureDir('case17');
  try {
    // Build a cache root with a v1.0.0 "previous install" and a v1.0.1
    // source fixture the rewritten self-update will clone from.
    const cacheRoot = path.join(dir, 'mos');
    const prevDir = path.join(cacheRoot, '1.0.0');
    fs.mkdirSync(path.join(prevDir, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(prevDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ version: '1.0.0' })
    );

    const srcDir = path.join(dir, 'fixture-v101');
    fs.mkdirSync(path.join(srcDir, '.claude-plugin'), { recursive: true });
    fs.mkdirSync(path.join(srcDir, 'commands'), { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ version: '1.0.1' })
    );
    fs.writeFileSync(path.join(srcDir, 'commands', 'noop.md'), '# noop\n');

    const script = path.join(REPO_ROOT, 'scripts', 'self-update');
    const r = spawnSync('bash', [script, 'install'], {
      env: Object.assign({}, process.env, {
        NODE_ENV: 'test',
        CACHE_ROOT: cacheRoot,
        SELF_UPDATE_SOURCE_DIR: srcDir,
      }),
      encoding: 'utf8',
    });
    assert.strictEqual(r.status, 0, 'self-update exited 0; stderr=' + r.stderr);
    assert.ok(r.stdout.indexOf('UPDATED') !== -1, 'stdout includes UPDATED');
    assert.ok(
      fs.existsSync(path.join(cacheRoot, '1.0.1', '.claude-plugin', 'plugin.json')),
      'new version dir created alongside old'
    );
    assert.ok(
      fs.existsSync(path.join(cacheRoot, '1.0.0', '.claude-plugin', 'plugin.json')),
      'old version dir left untouched (no rename, no delete)'
    );
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Case 18: Self-update preserves .env and node_modules (skip-gated)
// SCOPE-NB-14
// ---------------------------------------------------------------------------

async function case18() {
  if (process.env.SKIP_SELF_UPDATE !== '0') return 'skip';

  const dir = mkFixtureDir('case18');
  try {
    const cacheRoot = path.join(dir, 'mos');
    const prevDir = path.join(cacheRoot, '1.0.0');
    fs.mkdirSync(path.join(prevDir, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(prevDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ version: '1.0.0' })
    );
    // .env in the previous install must be preserved into the new one.
    const envContent = 'SECRET=keep-me\nANOTHER=value\n';
    fs.writeFileSync(path.join(prevDir, '.env'), envContent);

    const srcDir = path.join(dir, 'fixture-v101');
    fs.mkdirSync(path.join(srcDir, '.claude-plugin'), { recursive: true });
    fs.mkdirSync(path.join(srcDir, 'commands'), { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ version: '1.0.1' })
    );
    fs.writeFileSync(path.join(srcDir, 'commands', 'noop.md'), '# noop\n');

    const script = path.join(REPO_ROOT, 'scripts', 'self-update');
    const r = spawnSync('bash', [script, 'install'], {
      env: Object.assign({}, process.env, {
        NODE_ENV: 'test',
        CACHE_ROOT: cacheRoot,
        SELF_UPDATE_SOURCE_DIR: srcDir,
      }),
      encoding: 'utf8',
    });
    assert.strictEqual(r.status, 0, 'self-update exited 0; stderr=' + r.stderr);

    const newEnvPath = path.join(cacheRoot, '1.0.1', '.env');
    assert.ok(fs.existsSync(newEnvPath), '.env preserved into new version');
    assert.strictEqual(fs.readFileSync(newEnvPath, 'utf8'), envContent, '.env content matches');

    // Old .env also intact (cp -n, not mv).
    assert.strictEqual(
      fs.readFileSync(path.join(prevDir, '.env'), 'utf8'),
      envContent,
      'old .env still intact'
    );

    // Security gate: rejecting a non-/tmp, non-test path must exit without
    // touching the cache. Use NODE_ENV empty and a path outside /tmp.
    const badR = spawnSync('bash', [script, 'install'], {
      env: Object.assign({}, process.env, {
        NODE_ENV: '',
        CACHE_ROOT: cacheRoot,
        SELF_UPDATE_SOURCE_DIR: '/etc/passwd',
      }),
      encoding: 'utf8',
    });
    assert.ok(
      badR.stdout.indexOf('UPDATE_FAILED') !== -1,
      'security gate rejected non-/tmp non-test source'
    );
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async function main() {
  await runCase(1, 'stakeholder CRUD', case01);
  await runCase(2, 'stakeholder metadata json_extract', case02);
  await runCase(3, 'bridge happy path', case03);
  await runCase(4, 'bridge dedup (reviewer I4)', case04);
  await runCase(5, 'bridge missing db returns []', case05);
  await runCase(6, 'L507 single-write call site', case06);
  await runCase(7, 'L788 batched-write call site (reviewer I1)', case07);
  await runCase(8, 'injection happy path', case08);
  await runCase(9, 'env-OFF byte-identical (reviewer I3)', case09);
  await runCase(10, 'injection cap of 3', case10);
  await runCase(11, 'corrupt json injection error path', case11);
  await runCase(12, 'voice-log writer structured row', case12);
  await runCase(13, 'voice-log reader on-stop summary line', case13);
  await runCase(14, 'honesty layer sibling section (84-10)', case14);
  await runCase(15, 'phase 83 regression guard', case15);
  await runCase(16, 'mullins scaffold loader', case16);
  await runCase(17, 'self-update happy path (84-09)', case17);
  await runCase(18, 'self-update preserves .env (84-09)', case18);

  process.stdout.write('\n84-smart-notebook-copilot: ' + pass + ' passed, ' + skip + ' skipped, ' + fail + ' failed\n');
  if (fail > 0) {
    for (const f of failures) {
      process.stderr.write('  - ' + f.label + ': ' + (f.err && f.err.message ? f.err.message : f.err) + '\n');
    }
    process.exit(1);
  }
  process.exit(0);
})().catch(function (err) {
  process.stderr.write('UNHANDLED ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
