#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 241-02 -- minto-debounce-consumer-census tests
 * =====================================================
 * Closes the RCA `.planning/debug/resolved/minto-debounce-consumer-dead-end.md`
 * (F-0). That RCA's own headline evidence ("decisive, not circumstantial")
 * was a grep scoped to `scripts/intent-classifier.cjs` -- an extension that
 * does not exist. The real UserPromptSubmit hook is the extensionless bash
 * wrapper `scripts/intent-classifier`, which has carried a live Phase 88-05
 * drain-and-act block since Phase 88. This file's Test 1 is written to walk
 * directories, not glob extensions, specifically so it cannot repeat that
 * mistake.
 *
 * 5 tests:
 *   1. Production census (excludes tests/, *.test.cjs, *.worker.cjs,
 *      .planning/, node_modules/, .git/, CHANGELOG.md). Walks by directory
 *      so extensionless files are found. Asserts at least one production
 *      enqueue producer and at least one production drain-and-act consumer
 *      exist, and that the census specifically discovers and correctly
 *      classifies scripts/intent-classifier.
 *   2. Vacuum ban: zero production sites drain with a zero age floor
 *      (`{ olderThanMs: 0 }` or `--older-than=0`). Mutation-provable gate
 *      for Task 1 -- restoring either retired vacuum turns this red.
 *   3. The drain-and-act consumer is genuinely reachable: hooks/hooks.json's
 *      UserPromptSubmit dispatches scripts/intent-classifier, and that file
 *      exists and is executable. A wired-but-never-invoked consumer is the
 *      same dead end in a different costume.
 *   4. Full cycle (RCA Test 2): guardian session-start enqueues a critical
 *      violation, the entry is backdated past the 30s threshold, the real
 *      scripts/intent-classifier drains it and BOTH appends it to
 *      pending-tier1-regen.json AND removes it from minto-queue.json --
 *      drained-and-acted, not drained-and-discarded.
 *   5. Mutation proof for the full cycle: a mutated on-stop with the
 *      retired vacuum restored breaks the cycle (queue emptied before the
 *      consumer ever sees the entry, pending-tier1-regen.json never
 *      gains the section); the real on-stop lets the cycle complete.
 *
 * Test harness: reuses the seedRoomsHome + invokeClassifier shape from
 * lib/memory/debouncer-drain-at-prompt.test.cjs (Phase 88-05's own test
 * file) rather than building a new one. Mutated on-stop copies pin
 * SCRIPT_DIR/PLUGIN_ROOT to the real repo path, per the harness-bug lesson
 * recorded in 241-01-SUMMARY.md Deviation 2 -- a naive tmp-path copy
 * silently breaks scripts/on-stop's own sibling-script resolution
 * (resolve-room, minto-debouncer.cjs, feynman-minto-guardian.cjs), which
 * would make a mutation-proof test pass for the wrong reason.
 *
 * BSL 1.1. Zero npm deps. Node built-ins only. Three-surface by construction.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GUARDIAN = path.join(REPO_ROOT, 'scripts', 'feynman-minto-guardian.cjs');
const ON_STOP = path.join(REPO_ROOT, 'scripts', 'on-stop');
const INTENT_CLASSIFIER = path.join(REPO_ROOT, 'scripts', 'intent-classifier');
const HOOKS_JSON = path.join(REPO_ROOT, 'hooks', 'hooks.json');

const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  return d;
}

function killOrphanRegens() {
  try {
    spawnSync('bash', ['-c', 'pgrep -f vault-section-minto-generator | xargs -r kill -9 2>/dev/null || true'], {
      stdio: 'ignore',
    });
  } catch (_) { /* best-effort */ }
}

process.on('exit', () => {
  killOrphanRegens();
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

// ---------------------------------------------------------------------------
// Test 1/2 helpers: production-file census
// ---------------------------------------------------------------------------

// Directory names excluded outright wherever they appear. `.planning`
// excludes this phase's own RCA/knowledge-base prose; `tests` excludes
// "anything under tests/" per the RCA's Test 1 spec; `node_modules`/`.git`
// are the standard non-production exclusions.
const EXCLUDED_DIR_NAMES = new Set(['node_modules', '.git', '.planning', 'tests']);

// Binary/asset extensions skipped for speed; none of these can plausibly
// contain a production call site referencing minto-debouncer.cjs.
const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.mp3', '.mp4',
  '.woff', '.woff2', '.ttf', '.eot', '.psd', '.ai', '.svg',
]);
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function walkProductionFiles(root) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return;
    }
    for (const ent of entries) {
      if (ent.isDirectory()) {
        if (EXCLUDED_DIR_NAMES.has(ent.name)) continue;
        walk(path.join(dir, ent.name));
        continue;
      }
      if (!ent.isFile()) continue;
      const name = ent.name;
      // Explicit exclusions per the RCA's own Test 1 spec.
      if (name === 'CHANGELOG.md') continue;
      if (name.endsWith('.test.cjs')) continue;
      if (name.endsWith('.worker.cjs')) continue;
      const ext = path.extname(name).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext)) continue;
      out.push(path.join(dir, name));
    }
  }
  walk(root);
  return out;
}

// Programmatic call shapes (`.enqueue(`, `.drain(`) and their CLI-form
// counterparts (a variable/literal containing "debouncer" within ~80 chars
// of the subcommand word), covering both the require()-based callers
// (scripts/feynman-minto-guardian.cjs, scripts/intent-classifier) and the
// bash CLI-invocation callers (scripts/post-write).
// Deliberately NARROW (same line, <=20 chars, a real identifier/path token
// immediately adjacent to the subcommand word) so free-form prose ("after
// the debouncer drain (88-06)...", a comment describing a DIFFERENT file's
// behavior) cannot masquerade as an actual call site. A loose 80-char
// cross-line proximity search was tried first and produced exactly this
// false-positive shape against scripts/feynman-minto-guardian.cjs's own
// doc comments and lib/memory/run-feynman-tests.cjs's registry comments;
// narrowed after hand-verifying the census output line by line.
const ENQUEUE_PROGRAMMATIC_RE = /\.enqueue\s*\(/;
const ENQUEUE_CLI_RE = /(?:DEBOUNCER_SCRIPT|debouncer\.cjs|minto-debouncer)[^\n]{0,20}\benqueue\b/;
const DRAIN_PROGRAMMATIC_RE = /\.drain\s*\(/;
const DRAIN_CLI_RE = /(?:DEBOUNCER_SCRIPT|debouncer\.cjs|minto-debouncer)[^\n]{0,20}\bdrain\b/;
// A drain site "acts" on what it drained only if it also references the
// downstream regen path (the generator spawn or the pending-tier1-regen.json
// append) -- otherwise it is drain-and-discard even if it superficially
// looks like a consumer.
const ACT_MARKERS_RE = /vault-section-minto-generator|pending-tier1-regen/;

function classifyFile(content) {
  const isEnqueue = ENQUEUE_PROGRAMMATIC_RE.test(content) || ENQUEUE_CLI_RE.test(content);
  const isDrain = DRAIN_PROGRAMMATIC_RE.test(content) || DRAIN_CLI_RE.test(content);
  const isAct = ACT_MARKERS_RE.test(content);
  if (isDrain && isAct) return 'drain-and-act';
  if (isDrain) return 'drain-only (no downstream action found)';
  if (isEnqueue) return 'enqueue-producer';
  return 'reference-only';
}

function censusMintoDebouncerReferences() {
  const files = walkProductionFiles(REPO_ROOT);
  const referencing = [];
  for (const f of files) {
    let stat;
    try {
      stat = fs.statSync(f);
    } catch (_e) {
      continue;
    }
    if (stat.size > MAX_FILE_BYTES) continue;
    let content;
    try {
      content = fs.readFileSync(f, 'utf8');
    } catch (_e) {
      continue;
    }
    if (content.indexOf('minto-debouncer') === -1) continue;
    referencing.push({
      rel: path.relative(REPO_ROOT, f),
      classification: classifyFile(content),
    });
  }
  return referencing;
}

function formatCensus(referencing) {
  return referencing.map((r) => r.rel + ' -> ' + r.classification).join('\n  ');
}

// ---------------------------------------------------------------------------
// Test 4/5 helpers: full-cycle fixture (mirrors
// lib/memory/debouncer-drain-at-prompt.test.cjs's seedRoomsHome, reused
// rather than rebuilt)
// ---------------------------------------------------------------------------

function seedRoomsHome(roomName, sections) {
  const home = mkTmp('census-cycle-');
  const roomsHome = path.join(home, 'MindrianRooms');
  const roomsMeta = path.join(roomsHome, '.rooms');
  const roomDir = path.join(roomsHome, roomName);
  const mindrianDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(roomsMeta, { recursive: true });
  fs.mkdirSync(mindrianDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  const now = new Date().toISOString();
  const registry = {
    version: 1,
    active: roomName,
    rooms: {
      [roomName]: {
        path: roomName,
        created: now,
        last_opened: now,
        status: 'active',
        venture_name: 'Test Venture',
        venture_stage: 'Pre-Opportunity',
      },
    },
  };
  fs.writeFileSync(path.join(roomsMeta, 'registry.json'), JSON.stringify(registry, null, 2));
  for (const sec of sections) {
    const secDir = path.join(roomDir, sec);
    fs.mkdirSync(secDir, { recursive: true });
    fs.writeFileSync(path.join(secDir, 'ROOM.md'), '# ' + sec + '\n\nIdentity.\n');
  }
  return { home, roomsHome, roomDir, mindrianDir };
}

// Same critical_tmp_marker shape lib/memory/feynman-minto-guardian.test.cjs
// Test 1 already uses (an orphan FEYNMINTO_TMP marker), reused per its own
// fixture rather than inventing a new critical-severity trigger -- 241-03
// has not yet raised missing-MINTO.md/governing_thought to critical, so
// this is the one existing path that reaches the guardian's enqueue gate.
function writeCriticalMinto(sectionDir) {
  fs.writeFileSync(
    path.join(sectionDir, 'MINTO.md'),
    '---\nschema_version: "1.0"\ngoverning_thought: "placeholder"\n---\n# FEYNMINTO_TMP\nBody.\n'
  );
}

function backdateQueueEntries(mindrianDir, secondsAgo) {
  const qp = path.join(mindrianDir, 'minto-queue.json');
  const q = JSON.parse(fs.readFileSync(qp, 'utf8'));
  const ts = new Date(Date.now() - secondsAgo * 1000).toISOString();
  for (const e of q.entries) e.enqueued_at = ts;
  fs.writeFileSync(qp, JSON.stringify(q, null, 2));
}

function runGuardianSessionStart(roomDir) {
  return spawnSync(process.execPath, [GUARDIAN, 'session-start', roomDir], {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });
}

function invokeClassifier(roomsHome, classifierPath) {
  const env = Object.assign({}, process.env, {
    MINDRIAN_ROOMS_HOME: roomsHome,
    MINDRIAN_COPILOT_INJECT_FINDINGS: '0',
  });
  return spawnSync('bash', [classifierPath || INTENT_CLASSIFIER], {
    input: '{}',
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15000,
  });
}

function invokeOnStop(roomsHome, onStopPath) {
  const env = Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: roomsHome });
  return spawnSync('bash', [onStopPath || ON_STOP], {
    input: '',
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15000,
  });
}

async function waitFor(predicate, maxMs, stepMs) {
  if (typeof maxMs !== 'number') maxMs = 2000;
  if (typeof stepMs !== 'number') stepMs = 25;
  const until = Date.now() + maxMs;
  while (Date.now() < until) {
    try {
      if (predicate()) return true;
    } catch (_e) { /* keep polling */ }
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return false;
}

// Builds a mutated copy of scripts/on-stop with the retired unconditional
// olderThanMs=0 vacuum restored in place of the Phase 241-02 peek census.
// SCRIPT_DIR/PLUGIN_ROOT are pinned to the REAL repo (harness plumbing, not
// part of the mutation under test) -- per 241-01-SUMMARY.md Deviation 2, a
// naive tmp-path copy silently breaks resolve-room and every sibling-script
// call, which would make this mutation-proof test pass for the wrong reason
// (the guardian block never running at all, mutation or not).
function buildMutatedOnStopWithVacuum() {
  const real = fs.readFileSync(ON_STOP, 'utf8');
  const scriptsDir = path.join(REPO_ROOT, 'scripts');

  let mutated = real.replace(
    'SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"',
    'SCRIPT_DIR="' + scriptsDir + '"'
  );
  assert.notEqual(mutated, real, 'harness: SCRIPT_DIR pin applied');
  mutated = mutated.replace(
    'PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"',
    'PLUGIN_ROOT="' + REPO_ROOT + '"'
  );

  const censusStart = 'MINTO_QUEUE_PENDING=$(ROOM_DIR_ENV="${ROOM_DIR}" SCRIPT_DIR_ENV="${SCRIPT_DIR}" node -e "';
  const censusEndMarker = '" 2>/dev/null || echo 0)';
  const startIdx = mutated.indexOf(censusStart);
  assert.ok(startIdx !== -1, 'harness: census block start marker found in scripts/on-stop');
  const endIdx = mutated.indexOf(censusEndMarker, startIdx);
  assert.ok(endIdx !== -1, 'harness: census block end marker found in scripts/on-stop');

  const before = mutated.slice(0, startIdx);
  const after = mutated.slice(endIdx + censusEndMarker.length);
  const oldVacuumLine =
    'node "${SCRIPT_DIR}/minto-debouncer.cjs" drain "${ROOM_DIR}" --timeout=1500 --older-than=0 >/dev/null 2>&1 || true';
  mutated = before + oldVacuumLine + after;

  const dir = mkTmp('mutated-on-stop-');
  const tmpFile = path.join(dir, 'on-stop');
  fs.writeFileSync(tmpFile, mutated);
  fs.chmodSync(tmpFile, 0o755);
  return tmpFile;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test(
  'Test 1: production census (walks directories, not extensions) proves a real enqueue producer and a real drain-and-act consumer exist',
  () => {
    const referencing = censusMintoDebouncerReferences();
    const summary = formatCensus(referencing);

    const hasProducer = referencing.some((r) => r.classification === 'enqueue-producer');
    const hasDrainAndAct = referencing.some((r) => r.classification === 'drain-and-act');
    assert.ok(hasProducer, 'at least one production site enqueues.\nCensus:\n  ' + summary);
    assert.ok(hasDrainAndAct, 'at least one production site drains AND acts on the drained array.\nCensus:\n  ' + summary);

    // The RCA's own methodology error was an extension-scoped grep
    // (scripts/intent-classifier.cjs) that missed the real, extensionless
    // consumer (scripts/intent-classifier). A census that repeats that
    // mistake is itself a regression -- assert the extensionless file is
    // both discovered and correctly classified.
    const classifierEntry = referencing.find((r) => r.rel === path.join('scripts', 'intent-classifier'));
    assert.ok(classifierEntry, 'census discovers the extensionless scripts/intent-classifier.\nCensus:\n  ' + summary);
    assert.equal(
      classifierEntry.classification,
      'drain-and-act',
      'scripts/intent-classifier classified as drain-and-act.\nCensus:\n  ' + summary
    );

    // No test path leaked into the production census (the exclusion list
    // itself must be load-bearing, not decorative).
    const leaked = referencing.filter((r) => /(^|[\\/])tests[\\/]/.test(r.rel) || r.rel.endsWith('.test.cjs'));
    assert.deepEqual(leaked, [], 'zero test paths in the production census.\nCensus:\n  ' + summary);

    process.stdout.write('  [census]\n  ' + summary + '\n');
  }
);

test(
  'Test 2: zero production sites drain with a zero age floor (mutation-provable gate for Task 1)',
  () => {
    const files = walkProductionFiles(REPO_ROOT);
    const VACUUM_OBJECT_RE = /\{[^}]*\bolderThanMs\s*:\s*0\b[^}]*\}/;
    const VACUUM_CLI_RE = /--older-than[= ]0\b/;
    const offenders = [];
    for (const f of files) {
      let stat;
      try {
        stat = fs.statSync(f);
      } catch (_e) {
        continue;
      }
      if (stat.size > MAX_FILE_BYTES) continue;
      let content;
      try {
        content = fs.readFileSync(f, 'utf8');
      } catch (_e) {
        continue;
      }
      if (VACUUM_OBJECT_RE.test(content) || VACUUM_CLI_RE.test(content)) {
        offenders.push(path.relative(REPO_ROOT, f));
      }
    }
    assert.deepEqual(
      offenders,
      [],
      'no production site vacuums the debounce queue with a zero age floor. The two historically ' +
        'retired sites are scripts/on-stop and lib/mcp/stop-gate-handler.cjs. Offenders: ' +
        JSON.stringify(offenders)
    );
  }
);

test(
  'Test 3: the drain-and-act consumer is genuinely reachable -- wired into a real hook, not merely wired',
  () => {
    const hooks = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
    const promptHooks = (hooks && hooks.hooks && hooks.hooks.UserPromptSubmit) || [];
    let dispatchesIntentClassifier = false;
    for (const group of promptHooks) {
      for (const h of (group.hooks || [])) {
        if (typeof h.command === 'string' && h.command.indexOf('intent-classifier') !== -1) {
          dispatchesIntentClassifier = true;
        }
      }
    }
    assert.ok(dispatchesIntentClassifier, 'hooks/hooks.json UserPromptSubmit dispatches intent-classifier');
    assert.ok(fs.existsSync(INTENT_CLASSIFIER), 'scripts/intent-classifier exists on disk');
    const st = fs.statSync(INTENT_CLASSIFIER);
    assert.ok((st.mode & 0o111) !== 0, 'scripts/intent-classifier is executable (mode=' + st.mode.toString(8) + ')');
  }
);

test(
  'Test 4: full cycle (RCA Test 2) -- guardian enqueues, entry survives to the next prompt, the real consumer drains and acts',
  async () => {
    const fx = seedRoomsHome('default', ['market-analysis']);
    writeCriticalMinto(path.join(fx.roomDir, 'market-analysis'));

    const guardianRes = runGuardianSessionStart(fx.roomDir);
    assert.equal(guardianRes.status, 0, 'guardian session-start exits 0; stderr=' + (guardianRes.stderr || ''));

    const queuePath = path.join(fx.mindrianDir, 'minto-queue.json');
    assert.ok(fs.existsSync(queuePath), 'queue file exists after guardian enqueue');
    let q = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    let sections = q.entries.map((e) => e.section);
    assert.ok(sections.indexOf('market-analysis') !== -1, 'market-analysis enqueued by guardian; got ' + JSON.stringify(sections));

    backdateQueueEntries(fx.mindrianDir, 60);

    const classifierRes = invokeClassifier(fx.roomsHome);
    assert.equal(classifierRes.status, 0, 'intent-classifier exits 0; stderr=' + (classifierRes.stderr || ''));

    const pendingPath = path.join(fx.mindrianDir, 'pending-tier1-regen.json');
    const gotPending = await waitFor(() => fs.existsSync(pendingPath), 2000);
    assert.ok(gotPending, 'pending-tier1-regen.json created by the real consumer within 2s');

    const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
    const pendingSections = pending.pending.map((e) => e.section);
    assert.ok(
      pendingSections.indexOf('market-analysis') !== -1,
      'market-analysis reaches pending-tier1-regen.json; got ' + JSON.stringify(pendingSections)
    );

    q = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    sections = q.entries.map((e) => e.section);
    assert.ok(
      sections.indexOf('market-analysis') === -1,
      'market-analysis is gone from minto-queue.json -- drained-and-acted, not drained-and-discarded; got ' +
        JSON.stringify(sections)
    );
  }
);

test(
  'Test 5: mutation proof -- restoring the retired vacuum breaks the full cycle; the real fix lets it complete',
  async () => {
    // --- mutated arm: vacuum restored -----------------------------------
    const fxMutated = seedRoomsHome('default', ['market-analysis']);
    writeCriticalMinto(path.join(fxMutated.roomDir, 'market-analysis'));
    let guardianRes = runGuardianSessionStart(fxMutated.roomDir);
    assert.equal(guardianRes.status, 0, 'guardian session-start exits 0 (mutated arm)');
    backdateQueueEntries(fxMutated.mindrianDir, 60);

    const mutatedOnStop = buildMutatedOnStopWithVacuum();
    const mutatedStopRes = invokeOnStop(fxMutated.roomsHome, mutatedOnStop);
    assert.equal(
      mutatedStopRes.status,
      0,
      'mutated on-stop still exits 0 (advisory contract preserved); stderr=' + (mutatedStopRes.stderr || '')
    );

    const mutatedQueuePath = path.join(fxMutated.mindrianDir, 'minto-queue.json');
    const mutatedQueue = JSON.parse(fs.readFileSync(mutatedQueuePath, 'utf8'));
    assert.equal(
      mutatedQueue.entries.length,
      0,
      'restoring the vacuum empties the queue at on-stop, before the consumer ever sees it'
    );

    const mutatedClassifierRes = invokeClassifier(fxMutated.roomsHome);
    assert.equal(mutatedClassifierRes.status, 0, 'intent-classifier exits 0 (mutated arm)');
    // Give the (empty) drain a brief beat, mirroring debouncer-drain-at-
    // prompt.test.cjs's Test 2 (no-op) pacing.
    await new Promise((r) => setTimeout(r, 300));
    const mutatedPendingPath = path.join(fxMutated.mindrianDir, 'pending-tier1-regen.json');
    assert.ok(
      !fs.existsSync(mutatedPendingPath),
      'with the vacuum restored, the consumer finds nothing left to act on: pending-tier1-regen.json never appears'
    );

    // --- real arm: the actual Phase 241-02 fix in place ------------------
    const fxReal = seedRoomsHome('default', ['market-analysis']);
    writeCriticalMinto(path.join(fxReal.roomDir, 'market-analysis'));
    guardianRes = runGuardianSessionStart(fxReal.roomDir);
    assert.equal(guardianRes.status, 0, 'guardian session-start exits 0 (real arm)');
    backdateQueueEntries(fxReal.mindrianDir, 60);

    const realStopRes = invokeOnStop(fxReal.roomsHome);
    assert.equal(realStopRes.status, 0, 'real on-stop exits 0; stderr=' + (realStopRes.stderr || ''));

    const realQueuePath = path.join(fxReal.mindrianDir, 'minto-queue.json');
    const realQueueAfterStop = JSON.parse(fs.readFileSync(realQueuePath, 'utf8'));
    const survivingSections = realQueueAfterStop.entries.map((e) => e.section);
    assert.ok(
      survivingSections.indexOf('market-analysis') !== -1,
      'the real on-stop leaves the entry queued (census, not drain); got ' + JSON.stringify(survivingSections)
    );

    const realClassifierRes = invokeClassifier(fxReal.roomsHome);
    assert.equal(realClassifierRes.status, 0, 'intent-classifier exits 0 (real arm)');
    const realPendingPath = path.join(fxReal.mindrianDir, 'pending-tier1-regen.json');
    const gotRealPending = await waitFor(() => fs.existsSync(realPendingPath), 2000);
    assert.ok(gotRealPending, 'with the real fix, the entry survives on-stop and the consumer picks it up at the next prompt');
    const realPending = JSON.parse(fs.readFileSync(realPendingPath, 'utf8'));
    const realPendingSections = realPending.pending.map((e) => e.section);
    assert.ok(
      realPendingSections.indexOf('market-analysis') !== -1,
      'market-analysis reaches pending-tier1-regen.json in the real arm; got ' + JSON.stringify(realPendingSections)
    );
  }
);

// --- runner ------------------------------------------------------------

(async () => {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      process.stdout.write('PASS ' + t.name + '\n');
    } catch (e) {
      failed += 1;
      process.stderr.write('FAIL ' + t.name + '\n' + (e && e.stack || e) + '\n');
    } finally {
      killOrphanRegens();
    }
  }
  process.stdout.write(
    '\nminto-debounce-consumer-census.test.cjs: ' +
    (tests.length - failed) + '/' + tests.length + ' passed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
})();
