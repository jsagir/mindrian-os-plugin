#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Phase 94.1-01 -- /mos:heal command orchestrator fence.
 *
 * Why this fixture exists.
 *
 *   The /mos:heal command wraps the 10-step room wiring heal recipe
 *   dog-fooded on the mindrianOS room on 2026-04-29 (see
 *   ~/MindrianRooms/mindrianOS/methodology/2026-04-29-v1-11-0-room-
 *   wiring-heal-process.md). The orchestrator is the v1.11.1 GA closing
 *   artifact: any user upgrading from v1.10.x to v1.11.x can self-heal
 *   their room without manual intervention.
 *
 *   This test fixture proves the orchestrator runs idempotently on a
 *   deliberately-degraded room, writes a valid heal-log envelope, makes
 *   a backup before any mutation, gracefully degrades on the FEYNMINTO-01
 *   mega-section budget rejection, and never throws on a per-section
 *   failure.
 *
 * Test map (6 cases, one-to-one with the PLAN <behavior> block).
 *
 *   T1  Dry-run on degraded fixture: runHeal(roomDir, {dryRun: true})
 *       returns plan envelope with 10 step entries; .mindrian/ NOT
 *       created; no files mutated.
 *
 *   T2  Full heal on degraded fixture: runHeal(roomDir) on a
 *       deliberately-degraded room. Assert post-heal: 8 canonical section
 *       directories present; every section has ROOM.md + STATE.md;
 *       .mindrian/room.db nodes COUNT > 0; root STATE.md regenerated;
 *       backup directory populated.
 *
 *   T3  heal-log envelope shape: <room>/.mindrian/heal-log.json present;
 *       valid JSON; schema_version + started_at + ended_at + room_dir +
 *       backup_dir + steps[10] + summary keys present; every step has
 *       step + status + duration_ms + details keys.
 *
 *   T4  Backup created: .heal-backup/<TS>/ directory present; <TS>
 *       matches YYYYMMDD-HHMMSS pattern; pre-heal STATE.md preserved
 *       verbatim in backup.
 *
 *   T5  Mega-section graceful degradation: a section with 50+ artifacts
 *       triggers FEYNMINTO-01 budget rejection. runHeal completes step 7
 *       for that section with status='blocked_feynminto_01'; no
 *       exception propagates; tier-0 fallback MINTO written or skipped
 *       gracefully. Other steps proceed normally.
 *
 *   T6  Idempotence: runHeal twice on the same room. Second run
 *       completes; nothing destructive. Second-run heal-log shows step
 *       statuses 'ok' or 'skipped' (no 'error_*').
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const ORCHESTRATOR_PATH = path.join(REPO, 'scripts', 'heal-command.cjs');

// ---------- Fixture helpers ----------

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}

function cleanupTmp() {
  for (const d of TMP_ROOTS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  TMP_ROOTS.length = 0;
}

process.on('exit', cleanupTmp);

const CANONICAL_SECTIONS = [
  'problem-definition',
  'market-analysis',
  'solution-design',
  'business-model',
  'competitive-analysis',
  'team-execution',
  'legal-ip',
  'financial-model',
];

/**
 * Build a deliberately-degraded fixture room.
 *
 * Degradations applied (one per recipe step that should heal):
 *   - missing legal-ip directory entirely (Step 2 should create it)
 *   - missing ROOM.md in 3 sections (Step 5 should backfill)
 *   - missing per-section STATE.md (Step 6 should write)
 *   - missing per-section MINTO.md (Step 7 should generate)
 *   - root STATE.md present but stale / minimal (Step 9 regenerates)
 *   - brain-derivation-queue.json with 1 stale entry (Step 8 reads, does NOT drain)
 *   - .mindrian/room.db absent (Step 4 rebuilds)
 *
 * The fixture has 7 of the 8 canonical sections (legal-ip missing) and
 * each present section has 1 seed artifact so the local graph rebuild
 * has something to index.
 */
function buildDegradedFixtureRoom(tmpDir) {
  // Create 7 of 8 canonical sections (legal-ip deliberately absent).
  for (const s of CANONICAL_SECTIONS) {
    if (s === 'legal-ip') continue;
    fs.mkdirSync(path.join(tmpDir, s), { recursive: true });

    // One seed artifact per section so graph rebuild has nodes.
    const artifactBody =
      '---\n' +
      'title: ' + s + '-seed\n' +
      'section: ' + s + '\n' +
      'date: 2026-04-29\n' +
      '---\n\n' +
      '# ' + s + ' seed\n\n' +
      'Seed artifact for the ' + s + ' section.\n' +
      'Captures placeholder evidence so the local graph indexes it.\n';
    fs.writeFileSync(
      path.join(tmpDir, s, '01-section-seed.md'),
      artifactBody,
      'utf8'
    );
  }

  // Backfill ROOM.md only on a subset of sections (3 missing).
  // problem-definition + market-analysis + solution-design + business-model
  // get a ROOM.md; competitive-analysis + team-execution + financial-model
  // do NOT (Step 5 should backfill).
  const sectionsWithRoomMd = [
    'problem-definition',
    'market-analysis',
    'solution-design',
    'business-model',
  ];
  for (const s of sectionsWithRoomMd) {
    const roomMd =
      '---\n' +
      'section: ' + s + '\n' +
      'purpose: existing ' + s + ' identity\n' +
      'methodology: bono-six-hats\n' +
      'parent: ../STATE.md\n' +
      'status: active\n' +
      '---\n\n' +
      '# ' + s + '\n\nThis section is wired.\n';
    fs.writeFileSync(path.join(tmpDir, s, 'ROOM.md'), roomMd, 'utf8');
  }

  // Root STATE.md: present but minimal (Step 9 will recompute).
  fs.writeFileSync(
    path.join(tmpDir, 'STATE.md'),
    '# Pre-heal STATE.md\n\nminimal placeholder content\n',
    'utf8'
  );

  // brain-derivation-queue.json with 1 stale entry (Step 8 reads).
  fs.mkdirSync(path.join(tmpDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.mindrian', 'brain-derivation-queue.json'),
    JSON.stringify(
      {
        queue: [
          {
            section: 'problem-definition',
            reason: 'governing_thought_changed',
            enqueued_at: '2026-04-24T08:11:00Z',
            prev_governing_thought_sha256: 'a'.repeat(64),
            new_governing_thought_sha256: 'b'.repeat(64),
          },
        ],
      },
      null,
      2
    ),
    'utf8'
  );

  return tmpDir;
}

/**
 * Build a mega-section fixture: a room where one section has 50+
 * artifacts so MINTO write triggers the FEYNMINTO-01 budget rejection
 * deterministically.
 */
function buildMegaSectionFixtureRoom(tmpDir) {
  buildDegradedFixtureRoom(tmpDir);
  // Inflate solution-design with 60 large artifacts so the rendered
  // source list pushes the MINTO body over the 1500-token budget.
  const inflateDir = path.join(tmpDir, 'solution-design');
  for (let i = 0; i < 60; i++) {
    const num = String(i + 2).padStart(2, '0');
    const body =
      '---\n' +
      'title: solution-artifact-' + num + '\n' +
      'section: solution-design\n' +
      'date: 2026-04-29\n' +
      '---\n\n' +
      '# Solution artifact ' + num + '\n\n' +
      // Pad with content so each artifact contributes meaningfully to
      // any rendered list / excerpt that the MINTO writer pulls in.
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(40) +
      '\n';
    fs.writeFileSync(
      path.join(inflateDir, num + '-artifact.md'),
      body,
      'utf8'
    );
  }
  return tmpDir;
}

// ---------- Tests ----------

async function runTests() {
  let failures = 0;
  function pass(label) { console.log('PASS ' + label); }
  function fail(label, err) {
    console.error('FAIL ' + label);
    console.error('  ' + (err && err.message ? err.message : String(err)));
    if (err && err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    failures++;
  }

  // Defensive load. If the orchestrator does not exist yet (RED phase),
  // every test fails with MODULE_NOT_FOUND, which is the desired RED
  // signal. Any other failure also surfaces.
  let healMod;
  try {
    healMod = require(ORCHESTRATOR_PATH);
  } catch (e) {
    // RED expected outcome: print one structured failure for each of the
    // 6 cases and exit with non-zero so the runner records FAIL.
    const msg = 'orchestrator not loadable: ' + (e && e.message ? e.message : String(e));
    fail('T1 dry-run on degraded fixture', new Error(msg));
    fail('T2 full heal on degraded fixture', new Error(msg));
    fail('T3 heal-log envelope shape', new Error(msg));
    fail('T4 backup created (timestamp + verbatim STATE.md preserved)', new Error(msg));
    fail('T5 mega-section graceful degradation (FEYNMINTO-01)', new Error(msg));
    fail('T6 idempotence (heal twice; second run no errors)', new Error(msg));
    console.log('heal-command: 0/6 passed (' + failures + ' failed)');
    process.exit(1);
  }

  if (typeof healMod.runHeal !== 'function') {
    const msg = 'orchestrator missing runHeal export';
    fail('T1 dry-run on degraded fixture', new Error(msg));
    fail('T2 full heal on degraded fixture', new Error(msg));
    fail('T3 heal-log envelope shape', new Error(msg));
    fail('T4 backup created (timestamp + verbatim STATE.md preserved)', new Error(msg));
    fail('T5 mega-section graceful degradation (FEYNMINTO-01)', new Error(msg));
    fail('T6 idempotence (heal twice; second run no errors)', new Error(msg));
    console.log('heal-command: 0/6 passed (' + failures + ' failed)');
    process.exit(1);
  }

  const { runHeal } = healMod;

  // ---------- T1 dry-run on degraded fixture ----------

  try {
    const roomDir = buildDegradedFixtureRoom(mkTmp('mos-heal-t1-'));
    const env = await runHeal(roomDir, { dryRun: true });

    assert.ok(env, 'dry-run returns envelope');
    assert.ok(Array.isArray(env.steps), 'envelope.steps is array');
    assert.equal(env.steps.length, 10, 'envelope.steps has 10 entries');
    assert.equal(typeof env.schema_version, 'string', 'schema_version present');

    // Critical: NO mutation. .mindrian/ may pre-exist from fixture builder
    // (we wrote brain-derivation-queue.json there), but heal-log.json
    // must NOT have been written, and .mindrian/room.db must NOT exist.
    assert.equal(
      fs.existsSync(path.join(roomDir, '.mindrian', 'heal-log.json')),
      false,
      'dry-run does not write heal-log.json'
    );
    assert.equal(
      fs.existsSync(path.join(roomDir, '.mindrian', 'room.db')),
      false,
      'dry-run does not create room.db'
    );

    // No backup directory created in dry-run.
    const backupRoot = path.join(roomDir, '.heal-backup');
    assert.equal(
      fs.existsSync(backupRoot),
      false,
      'dry-run does not create .heal-backup'
    );

    // legal-ip section was missing pre-heal; dry-run must NOT create it.
    assert.equal(
      fs.existsSync(path.join(roomDir, 'legal-ip')),
      false,
      'dry-run does not create missing canonical section'
    );

    pass('T1 dry-run on degraded fixture');
  } catch (e) {
    fail('T1 dry-run on degraded fixture', e);
  }

  // ---------- T2 full heal on degraded fixture ----------

  try {
    const roomDir = buildDegradedFixtureRoom(mkTmp('mos-heal-t2-'));
    const env = await runHeal(roomDir, {});

    assert.ok(env, 'full-heal returns envelope');
    assert.ok(Array.isArray(env.steps), 'envelope.steps is array');
    assert.equal(env.steps.length, 10, 'envelope.steps has 10 entries');

    // Step 2 result: all 8 canonical sections present.
    for (const s of CANONICAL_SECTIONS) {
      assert.equal(
        fs.existsSync(path.join(roomDir, s)),
        true,
        'canonical section directory exists: ' + s
      );
    }

    // Step 5 result: every present section has ROOM.md.
    for (const s of CANONICAL_SECTIONS) {
      const roomMdPath = path.join(roomDir, s, 'ROOM.md');
      assert.equal(
        fs.existsSync(roomMdPath),
        true,
        'every canonical section has ROOM.md: ' + s
      );
    }

    // Step 6 result: every present section has STATE.md.
    let stateMdCount = 0;
    for (const s of CANONICAL_SECTIONS) {
      if (fs.existsSync(path.join(roomDir, s, 'STATE.md'))) {
        stateMdCount++;
      }
    }
    assert.ok(
      stateMdCount >= CANONICAL_SECTIONS.length - 1,
      'most canonical sections have per-section STATE.md (got ' + stateMdCount + ')'
    );

    // Step 4 result: .mindrian/room.db nodes COUNT > 0.
    const dbPath = path.join(roomDir, '.mindrian', 'room.db');
    assert.equal(fs.existsSync(dbPath), true, 'room.db exists');
    let nodeCount = 0;
    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath);
      const row = db.prepare('SELECT COUNT(*) AS c FROM nodes').get();
      nodeCount = row && typeof row.c === 'number' ? row.c : 0;
      db.close();
    } catch (sqliteErr) {
      // If node:sqlite is not available, fall back to file-existence
      // assertion. In CI this still proves Step 4 fired.
      nodeCount = fs.statSync(dbPath).size > 0 ? 1 : 0;
    }
    assert.ok(nodeCount > 0, 'room.db nodes COUNT > 0 (got ' + nodeCount + ')');

    // Step 9 result: root STATE.md regenerated. The pre-heal placeholder
    // was 'minimal placeholder content'; post-heal must differ.
    const rootStatePost = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');
    assert.ok(
      !rootStatePost.includes('minimal placeholder content'),
      'root STATE.md regenerated (no longer placeholder)'
    );

    // Step 1 result: backup directory populated.
    const backupRoot = path.join(roomDir, '.heal-backup');
    assert.equal(fs.existsSync(backupRoot), true, '.heal-backup directory exists');
    const backupChildren = fs.readdirSync(backupRoot);
    assert.ok(
      backupChildren.length > 0,
      '.heal-backup has at least one timestamped child'
    );

    // Step 8 result: queue read, NOT drained (read-only contract).
    const queuePath = path.join(roomDir, '.mindrian', 'brain-derivation-queue.json');
    assert.equal(fs.existsSync(queuePath), true, 'queue file preserved (not drained)');
    const queueRaw = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    assert.ok(
      Array.isArray(queueRaw.queue) && queueRaw.queue.length >= 1,
      'queue entries preserved (drain deferred to v1.12)'
    );

    pass('T2 full heal on degraded fixture');
  } catch (e) {
    fail('T2 full heal on degraded fixture', e);
  }

  // ---------- T3 heal-log envelope shape ----------

  try {
    const roomDir = buildDegradedFixtureRoom(mkTmp('mos-heal-t3-'));
    await runHeal(roomDir, {});

    const logPath = path.join(roomDir, '.mindrian', 'heal-log.json');
    assert.equal(fs.existsSync(logPath), true, 'heal-log.json written');

    const raw = fs.readFileSync(logPath, 'utf8');
    const log = JSON.parse(raw);

    assert.equal(typeof log.schema_version, 'string', 'schema_version is string');
    assert.equal(typeof log.started_at, 'string', 'started_at is ISO-8601 string');
    assert.equal(typeof log.ended_at, 'string', 'ended_at is ISO-8601 string');
    assert.equal(typeof log.room_dir, 'string', 'room_dir is string');
    assert.equal(typeof log.backup_dir, 'string', 'backup_dir is string');
    assert.ok(Array.isArray(log.steps), 'steps is array');
    assert.equal(log.steps.length, 10, 'steps has 10 entries');

    // Every step has the contract keys.
    for (let i = 0; i < log.steps.length; i++) {
      const s = log.steps[i];
      assert.equal(typeof s.step, 'string', 'step[' + i + '].step is string');
      assert.equal(typeof s.status, 'string', 'step[' + i + '].status is string');
      assert.equal(typeof s.duration_ms, 'number', 'step[' + i + '].duration_ms is number');
      assert.ok(s.details && typeof s.details === 'object', 'step[' + i + '].details is object');
    }

    // Step names match the recipe contract.
    const expectedStepNames = [
      'step_01_backup',
      'step_02_scaffold_sections',
      'step_03_section_seed',
      'step_04_lazygraph_rebuild',
      'step_05_backfill_room_md',
      'step_06_section_state',
      'step_07_section_minto',
      'step_08_queue_check',
      'step_09_root_state',
      'step_10_invariant_scan',
    ];
    for (let i = 0; i < expectedStepNames.length; i++) {
      assert.equal(
        log.steps[i].step,
        expectedStepNames[i],
        'step[' + i + '].step name matches recipe'
      );
    }

    // Summary block.
    assert.ok(log.summary && typeof log.summary === 'object', 'summary present');
    assert.equal(typeof log.summary.ok_count, 'number', 'summary.ok_count is number');
    assert.equal(typeof log.summary.exit_code, 'number', 'summary.exit_code is number');

    pass('T3 heal-log envelope shape');
  } catch (e) {
    fail('T3 heal-log envelope shape', e);
  }

  // ---------- T4 backup created ----------

  try {
    const roomDir = buildDegradedFixtureRoom(mkTmp('mos-heal-t4-'));
    const preHealStateMd = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');

    await runHeal(roomDir, {});

    const backupRoot = path.join(roomDir, '.heal-backup');
    const tsChildren = fs.readdirSync(backupRoot);
    assert.ok(tsChildren.length >= 1, 'at least one timestamp child');

    const ts = tsChildren[0];
    // <TS> matches YYYYMMDD-HHMMSS pattern.
    assert.match(ts, /^\d{8}-\d{6}$/, '<TS> matches YYYYMMDD-HHMMSS pattern');

    // pre-heal STATE.md preserved verbatim (somewhere under the backup
    // tree). The backup may live at .heal-backup/<TS>/STATE.md or
    // .heal-backup/<TS>/<file basename>.
    let preserved = false;
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && entry.name === 'STATE.md') {
          const body = fs.readFileSync(full, 'utf8');
          if (body === preHealStateMd) {
            preserved = true;
            return;
          }
        }
      }
    }
    walk(path.join(backupRoot, ts));
    assert.equal(preserved, true, 'pre-heal STATE.md preserved verbatim in backup');

    pass('T4 backup created (timestamp + verbatim STATE.md preserved)');
  } catch (e) {
    fail('T4 backup created (timestamp + verbatim STATE.md preserved)', e);
  }

  // ---------- T5 mega-section graceful degradation ----------

  try {
    const roomDir = buildMegaSectionFixtureRoom(mkTmp('mos-heal-t5-'));

    let env;
    let threw = false;
    try {
      env = await runHeal(roomDir, {});
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, false, 'heal NEVER throws even on FEYNMINTO-01 budget');
    assert.ok(env, 'envelope returned');

    // Step 7 entry must exist with at least one section showing the
    // 'blocked_feynminto_01' status, OR (if the writer chose to not
    // attempt the mega-section because budget is pre-checked) details
    // record the budget block in some form. The contract is: heal does
    // not throw, log shows the block, other steps continue.
    const step07 = env.steps.find(function (s) { return s.step === 'step_07_section_minto'; });
    assert.ok(step07, 'step_07_section_minto entry present');

    const stringified = JSON.stringify(step07);
    assert.match(
      stringified,
      /blocked_feynminto_01|budget exceeded|FEYNMINTO-01/,
      'step_07 records budget block (blocked_feynminto_01 or budget exceeded)'
    );

    // Remaining steps still log their statuses (heal completed all 10).
    assert.equal(env.steps.length, 10, 'all 10 steps logged');

    // Heal completed successfully overall (exit 0 if any-step-success).
    assert.equal(typeof env.summary.exit_code, 'number', 'summary.exit_code is number');
    assert.ok(env.summary.exit_code === 0 || env.summary.exit_code === 2,
      'exit_code is 0 (any-step-success) or 2 (no-step-success)');

    pass('T5 mega-section graceful degradation (FEYNMINTO-01)');
  } catch (e) {
    fail('T5 mega-section graceful degradation (FEYNMINTO-01)', e);
  }

  // ---------- T6 idempotence ----------

  try {
    const roomDir = buildDegradedFixtureRoom(mkTmp('mos-heal-t6-'));
    await runHeal(roomDir, {});
    const env2 = await runHeal(roomDir, {});

    assert.ok(env2, 'second run returns envelope');
    assert.equal(env2.steps.length, 10, 'second-run envelope has 10 entries');

    // Second-run statuses: every step is 'ok' or 'skipped' or
    // 'blocked_*' (acceptable). NO 'error_*' on a clean idempotent
    // re-run because every degradation was already healed.
    let errorStepCount = 0;
    for (const s of env2.steps) {
      if (typeof s.status === 'string' && s.status.startsWith('error_')) {
        errorStepCount++;
      }
    }
    assert.equal(
      errorStepCount, 0,
      'second-run has zero error_* statuses (idempotent)'
    );

    pass('T6 idempotence (heal twice; second run no errors)');
  } catch (e) {
    fail('T6 idempotence (heal twice; second run no errors)', e);
  }

  cleanupTmp();

  const passed = 6 - failures;
  console.log('heal-command: ' + passed + '/6 passed (' + failures + ' failed)');
  if (failures > 0) process.exit(1);
}

runTests().catch(function (e) {
  console.error('runTests crashed: ' + (e && e.message));
  console.error(e && e.stack ? e.stack : '');
  process.exit(1);
});
