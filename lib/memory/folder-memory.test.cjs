#!/usr/bin/env node
'use strict';

/**
 * Phase 88-01 -- folder-memory.cjs read contract acceptance tests.
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Verifies the ONE and ONLY read contract for the per-folder memory triple
 * (ROOM.md + STATE.md + MINTO.md). Every skill, hook, statusline segment,
 * session-start injection, guardian, and the Navigation Engine consume the
 * triple through this module.
 *
 * Test map (15 cases, one-to-one with the PLAN <behavior> block):
 *   1.  Fresh triple (all three exist, valid)
 *   2.  Only ROOM.md exists (partial-missing)
 *   3.  MINTO critical invariant violation -> stale_reason:'invariant_violation'
 *   4.  Missing last_generated_at -> stale_reason:'missing_timestamps'
 *   5.  Artifacts newer than MINTO.md -> stale_reason:'artifacts_newer_than_minto'
 *   6.  Malformed frontmatter -> governing_thought:null, stale_reason:'parse_failed'
 *   7.  ROOM.md wikilinks inside REFERENCES markers extracted
 *   8.  ROOM.md identity_text strips the REFERENCES block
 *   9.  Empty section directory -> all three exists:false, no throws
 *   10. readDecisionLog returns 20 entries in write order
 *   11. decision_log with 21 entries still READ by readTriple (guardian flags; read is permissive)
 *   12. computeHealthScore perfect input -> 1.0
 *   13. computeHealthScore empty/failing input -> 0
 *   14. Async readTriple returns same shape as sync
 *   15. Key-set parity: Object.keys(sync) === Object.keys(async); each async is AsyncFunction
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const SYNC_PATH = path.join(REPO, 'lib/core/folder-memory.cjs');
const ASYNC_PATH = path.join(REPO, 'lib/core/folder-memory-async.cjs');
const SHARED_PATH = path.join(REPO, 'lib/core/folder-memory-shared.cjs');

// ---------- Fixture helpers ----------

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMP_ROOTS) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch (_e) { /* best effort */ }
  }
});

function writeRoomMd(dir, identityText, referencesBlock) {
  const payload =
    identityText +
    '\n\n<!-- BEGIN REFERENCES -->\n' +
    referencesBlock +
    '\n<!-- END REFERENCES -->\n';
  fs.writeFileSync(path.join(dir, 'ROOM.md'), payload, 'utf8');
}

function writeStateMd(dir, opts) {
  const o = opts || {};
  const lines = [
    '# Section State',
    '',
    'artifact_count: ' + (o.artifact_count !== undefined ? o.artifact_count : 3),
    'gap_status: ' + (o.gap_status || 'active'),
    'completeness_score: ' + (o.completeness_score !== undefined ? o.completeness_score : 0.75),
    '',
    'Last activity: ' + (o.last_activity || '2026-04-19'),
    '',
  ];
  fs.writeFileSync(path.join(dir, 'STATE.md'), lines.join('\n'), 'utf8');
}

function writeMintoMd(dir, fm, body) {
  // fm is an object of frontmatter keys. Block-style YAML for arrays.
  const lines = ['---'];
  for (const k of Object.keys(fm)) {
    const v = fm[k];
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(k + ': []');
      } else if (typeof v[0] === 'string') {
        lines.push(k + ':');
        for (const s of v) lines.push('  - ' + JSON.stringify(s));
      } else {
        // array of objects
        lines.push(k + ':');
        for (const obj of v) {
          const keys = Object.keys(obj);
          if (keys.length === 0) continue;
          lines.push('  - ' + keys[0] + ': ' + JSON.stringify(obj[keys[0]]));
          for (let i = 1; i < keys.length; i++) {
            lines.push('    ' + keys[i] + ': ' + JSON.stringify(obj[keys[i]]));
          }
        }
      }
    } else if (v === null) {
      lines.push(k + ': null');
    } else if (typeof v === 'string') {
      lines.push(k + ': "' + v.replace(/"/g, '\\"') + '"');
    } else {
      lines.push(k + ': ' + v);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(body || '# MINTO body');
  fs.writeFileSync(path.join(dir, 'MINTO.md'), lines.join('\n'), 'utf8');
}

function isoFromMs(ms) {
  return new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
}

// ---------- Existence / file-pre-condition check (RED precondition) ----------

function t1_moduleFilesExist() {
  assert.ok(fs.existsSync(SHARED_PATH), 'lib/core/folder-memory-shared.cjs missing');
  assert.ok(fs.existsSync(SYNC_PATH), 'lib/core/folder-memory.cjs missing');
  assert.ok(fs.existsSync(ASYNC_PATH), 'lib/core/folder-memory-async.cjs missing');
}

// ---------- Individual fixture tests ----------

function test_1_freshTriple(sync) {
  const dir = mkTmp('folder-mem-t1-');
  writeRoomMd(dir, '# market-analysis\n\nCore section of the room.', '- [[financial-model/tam-bottom-up]]');
  writeStateMd(dir, { artifact_count: 5, gap_status: 'active', completeness_score: 0.8 });
  const now = Date.now();
  writeMintoMd(
    dir,
    {
      schema_version: 'v88',
      governing_thought: 'TAM of $12B is bottom-up defensible',
      key_claims: ['claim a', 'claim b', 'claim c'],
      mece_arguments: ['arg 1', 'arg 2'],
      last_generated_at: isoFromMs(now),
      last_artifact_write_seen_at: isoFromMs(now - 5000),
      reasoning_health_score: 0.85,
      flagged_weaknesses: [],
      decision_log: [],
    },
    '# Market Analysis MINTO\n\nbody content'
  );

  const r = sync.readTriple(dir);
  assert.strictEqual(r.room.exists, true, 't1: room.exists');
  assert.strictEqual(r.state.exists, true, 't1: state.exists');
  assert.strictEqual(r.reasoning.exists, true, 't1: reasoning.exists');
  assert.strictEqual(r.reasoning.governing_thought, 'TAM of $12B is bottom-up defensible');
  assert.strictEqual(r.reasoning.is_stale, false, 't1: not stale');
  assert.strictEqual(r.reasoning.stale_reason, null);
  assert.ok(r.room.references.length >= 1, 't1: at least one ref');
  assert.strictEqual(r.state.artifact_count, 5, 't1: artifact_count parsed');
}

function test_2_onlyRoomMd(sync) {
  const dir = mkTmp('folder-mem-t2-');
  writeRoomMd(dir, '# problem-definition\n\nJust identity.', '');

  const r = sync.readTriple(dir);
  assert.strictEqual(r.room.exists, true, 't2: room.exists');
  assert.strictEqual(r.state.exists, false, 't2: state absent');
  assert.strictEqual(r.reasoning.exists, false, 't2: reasoning absent');
  assert.strictEqual(r.reasoning.governing_thought, null);
  assert.deepStrictEqual(r.reasoning.decision_log, []);
}

function test_3_invariantViolation(sync) {
  const dir = mkTmp('folder-mem-t3-');
  writeRoomMd(dir, '# s', '');
  writeStateMd(dir, { artifact_count: 1 });
  // Write a file with an orphan TMP marker that 88-00-B detects as critical.
  const raw = [
    '---',
    'schema_version: "v88"',
    'governing_thought: "gt"',
    'last_generated_at: "' + isoFromMs(Date.now()) + '"',
    'decision_log: []',
    '---',
    '',
    '# FEYNMINTO_TMP orphan marker',
    'body',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'MINTO.md'), raw, 'utf8');

  const r = sync.readTriple(dir);
  assert.strictEqual(r.reasoning.exists, true, 't3: reasoning still exists');
  assert.strictEqual(r.reasoning.is_stale, true, 't3: stale because critical invariant');
  assert.strictEqual(r.reasoning.stale_reason, 'invariant_violation', 't3: exact stale_reason');
  // Best-effort parse: governing_thought still surfaces
  assert.strictEqual(r.reasoning.governing_thought, 'gt');
}

function test_4_missingLastGeneratedAt(sync) {
  const dir = mkTmp('folder-mem-t4-');
  writeRoomMd(dir, '# s', '');
  writeStateMd(dir, {});
  writeMintoMd(
    dir,
    {
      schema_version: 'v88',
      governing_thought: 'gt',
      // last_generated_at deliberately omitted
      decision_log: [],
    },
    'body'
  );

  const r = sync.readTriple(dir);
  assert.strictEqual(r.reasoning.is_stale, true, 't4: stale because missing timestamp');
  assert.strictEqual(r.reasoning.stale_reason, 'missing_timestamps');
}

function test_5_artifactsNewerThanMinto(sync) {
  const dir = mkTmp('folder-mem-t5-');
  writeRoomMd(dir, '# s', '');
  writeStateMd(dir, {});
  const older = Date.now() - 60 * 60 * 1000; // 1h ago
  writeMintoMd(
    dir,
    {
      schema_version: 'v88',
      governing_thought: 'gt',
      last_generated_at: isoFromMs(older),
      last_artifact_write_seen_at: isoFromMs(older),
      decision_log: [],
    },
    'body'
  );
  // Back-date MINTO mtime to 1h ago explicitly.
  const past = older / 1000;
  fs.utimesSync(path.join(dir, 'MINTO.md'), past, past);

  // Write an artifact NEWER than MINTO.md.
  const now = Date.now() / 1000;
  fs.writeFileSync(path.join(dir, 'artifact-new.md'), '# Newer artifact\n', 'utf8');
  fs.utimesSync(path.join(dir, 'artifact-new.md'), now, now);

  const r = sync.readTriple(dir);
  assert.strictEqual(r.reasoning.is_stale, true, 't5: stale because newer artifact');
  assert.strictEqual(r.reasoning.stale_reason, 'artifacts_newer_than_minto');
}

function test_6_malformedFrontmatter(sync) {
  const dir = mkTmp('folder-mem-t6-');
  writeRoomMd(dir, '# s', '');
  writeStateMd(dir, {});
  // Malformed: no closing delimiter, bogus garbage.
  fs.writeFileSync(
    path.join(dir, 'MINTO.md'),
    '---\nschema_version: "v88"\nthis is not valid yaml because : : : :\n',
    'utf8'
  );

  const r = sync.readTriple(dir);
  assert.strictEqual(r.reasoning.exists, true, 't6: reasoning still exists');
  assert.strictEqual(r.reasoning.governing_thought, null, 't6: gt null on parse failure');
  assert.strictEqual(r.reasoning.is_stale, true);
  assert.strictEqual(r.reasoning.stale_reason, 'parse_failed');
}

function test_7_roomReferencesExtracted(sync) {
  const dir = mkTmp('folder-mem-t7-');
  const refs = [
    '- [[financial-model/tam-bottom-up.md|TAM]]',
    '- [[competitive-analysis/first-mover.md|First-Mover]]',
    '- [[team/jane-doe/PROFILE.md|Jane Doe]]',
  ].join('\n');
  writeRoomMd(dir, '# market-analysis\n\nCore prose.', refs);
  writeStateMd(dir, {});
  writeMintoMd(
    dir,
    {
      schema_version: 'v88',
      governing_thought: 'gt',
      last_generated_at: isoFromMs(Date.now()),
      decision_log: [],
    },
    'body'
  );

  const r = sync.readTriple(dir);
  assert.strictEqual(r.room.references.length, 3, 't7: three wikilinks parsed');
  // Every ref must have the canonical shape.
  for (const ref of r.room.references) {
    assert.ok(typeof ref.target === 'string' && ref.target.length > 0);
    assert.ok(['section', 'artifact', 'team', 'meeting'].indexOf(ref.type) !== -1);
    assert.ok(typeof ref.label === 'string');
  }
  // The team reference must classify as type 'team'.
  const teamRef = r.room.references.find((x) => x.target.indexOf('/team/') !== -1);
  assert.ok(teamRef, 't7: team wikilink present');
  assert.strictEqual(teamRef.type, 'team', 't7: team classified');
}

function test_8_identityStripsReferencesBlock(sync) {
  const dir = mkTmp('folder-mem-t8-');
  const identity = '# solution-design\n\nIdentity prose to preserve.';
  const refs = '- [[problem-definition/root-cause.md|Root Cause]]';
  writeRoomMd(dir, identity, refs);
  writeStateMd(dir, {});

  const r = sync.readTriple(dir);
  assert.strictEqual(r.room.exists, true);
  assert.ok(
    r.room.identity_text.indexOf('Identity prose to preserve') !== -1,
    't8: identity text preserved'
  );
  assert.strictEqual(
    r.room.identity_text.indexOf('[[problem-definition/root-cause.md'), -1,
    't8: references block stripped from identity_text'
  );
}

function test_9_emptyDir(sync) {
  const dir = mkTmp('folder-mem-t9-');
  // No files written.
  let r;
  assert.doesNotThrow(() => {
    r = sync.readTriple(dir);
  }, 't9: no throws on empty dir');
  assert.strictEqual(r.room.exists, false);
  assert.strictEqual(r.state.exists, false);
  assert.strictEqual(r.reasoning.exists, false);
}

function test_10_readDecisionLog20(sync) {
  const dir = mkTmp('folder-mem-t10-');
  writeRoomMd(dir, '# s', '');
  writeStateMd(dir, {});
  const decisions = [];
  for (let i = 0; i < 20; i++) {
    decisions.push({
      session_id: 'sess-' + String(i).padStart(3, '0'),
      timestamp: isoFromMs(Date.now() + i * 1000),
      action: 'flag-staleness',
      user_response: 'defer',
      reason: 'round ' + i,
    });
  }
  writeMintoMd(
    dir,
    {
      schema_version: 'v88',
      governing_thought: 'gt',
      last_generated_at: isoFromMs(Date.now()),
      decision_log: decisions,
    },
    'body'
  );

  const log = sync.readDecisionLog(dir);
  assert.strictEqual(log.length, 20, 't10: 20 entries');
  assert.strictEqual(log[0].session_id, 'sess-000', 't10: oldest first');
  assert.strictEqual(log[19].session_id, 'sess-019', 't10: newest last');
}

function test_11_decisionLog21Permissive(sync) {
  const dir = mkTmp('folder-mem-t11-');
  writeRoomMd(dir, '# s', '');
  writeStateMd(dir, {});
  const decisions = [];
  for (let i = 0; i < 21; i++) {
    decisions.push({
      session_id: 'sess-' + i,
      timestamp: isoFromMs(Date.now() + i * 1000),
      action: 'flag',
      user_response: 'approve',
      reason: 'r',
    });
  }
  writeMintoMd(
    dir,
    {
      schema_version: 'v88',
      governing_thought: 'gt',
      last_generated_at: isoFromMs(Date.now()),
      decision_log: decisions,
    },
    'body'
  );

  // Read is permissive (guardian is strict). All 21 entries must come back.
  const r = sync.readTriple(dir);
  assert.strictEqual(r.reasoning.decision_log.length, 21, 't11: read returns all 21');
}

function test_12_computeHealthPerfect(sync) {
  const score = sync.computeHealthScore({
    governing_thought: 'x',
    arguments_count: 5,
    evidence_density: 0.9,
    mece_status: 'pass',
    is_stale: false,
  });
  assert.ok(Math.abs(score - 1.0) < 1e-9, 't12: perfect score = 1.0 (got ' + score + ')');
}

function test_13_computeHealthZero(sync) {
  const score = sync.computeHealthScore({
    governing_thought: null,
    arguments_count: 0,
    evidence_density: 0,
    mece_status: 'fail',
    is_stale: true,
  });
  assert.strictEqual(score, 0, 't13: empty input score = 0 (got ' + score + ')');
}

async function test_14_asyncParity(sync, asyncMod) {
  const dir = mkTmp('folder-mem-t14-');
  writeRoomMd(dir, '# s', '- [[a/b.md|B]]');
  writeStateMd(dir, { artifact_count: 2 });
  writeMintoMd(
    dir,
    {
      schema_version: 'v88',
      governing_thought: 'async-gt',
      last_generated_at: isoFromMs(Date.now()),
      decision_log: [],
    },
    'body'
  );

  const syncResult = sync.readTriple(dir);
  const asyncResult = await asyncMod.readTriple(dir);

  assert.deepStrictEqual(
    Object.keys(syncResult).sort(),
    Object.keys(asyncResult).sort(),
    't14: top-level keys match'
  );
  assert.strictEqual(asyncResult.reasoning.governing_thought, 'async-gt');
  assert.strictEqual(asyncResult.room.references.length, 1);
}

function test_15_keySetParity(sync, asyncMod) {
  const syncKeys = Object.keys(sync).filter((k) => typeof sync[k] === 'function').sort();
  const asyncKeys = Object.keys(asyncMod).filter((k) => typeof asyncMod[k] === 'function').sort();
  assert.deepStrictEqual(syncKeys, asyncKeys, 't15: key-set parity');
  for (const k of asyncKeys) {
    assert.strictEqual(
      asyncMod[k].constructor.name,
      'AsyncFunction',
      't15: async.' + k + ' must be AsyncFunction (got ' + asyncMod[k].constructor.name + ')'
    );
  }
}

// ---------- Runner ----------

async function run() {
  t1_moduleFilesExist();

  // eslint-disable-next-line global-require
  const sync = require(SYNC_PATH);
  // eslint-disable-next-line global-require
  const asyncMod = require(ASYNC_PATH);

  test_1_freshTriple(sync);
  test_2_onlyRoomMd(sync);
  test_3_invariantViolation(sync);
  test_4_missingLastGeneratedAt(sync);
  test_5_artifactsNewerThanMinto(sync);
  test_6_malformedFrontmatter(sync);
  test_7_roomReferencesExtracted(sync);
  test_8_identityStripsReferencesBlock(sync);
  test_9_emptyDir(sync);
  test_10_readDecisionLog20(sync);
  test_11_decisionLog21Permissive(sync);
  test_12_computeHealthPerfect(sync);
  test_13_computeHealthZero(sync);
  await test_14_asyncParity(sync, asyncMod);
  test_15_keySetParity(sync, asyncMod);

  process.stdout.write('folder-memory: 15/15 tests passed\n');
  process.exit(0);
}

run().catch((e) => {
  process.stderr.write((e && e.stack) || String(e));
  process.stderr.write('\n');
  process.exit(1);
});
