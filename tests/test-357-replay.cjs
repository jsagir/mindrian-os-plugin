'use strict';
// Phase 357-02 -- test-357-replay.cjs: the replay harness's own test suite
// (GATE357-02 / GATE357-06).
//
// Drives scripts/replay-card-fire.cjs as a CHILD PROCESS for every leg (never
// requires it in-process), so each leg's environment isolation is proven at
// the same boundary a real invocation crosses, and so a leg that somehow
// leaked into the navigator's real ~/.mindrian or rooms cannot also corrupt
// THIS test process's own state.
//
// Test hygiene (every spawn): TYPESAFE_API_KEY is stripped from the child
// env (this harness makes zero egress calls of its own, but a defensive
// strip costs nothing); HOME is redirected to a fresh mkdtemp dir (belt and
// suspenders alongside the harness's own per-entry MINDRIAN_HOME/
// MINDRIAN_ROOMS_HOME isolation); NODE_OPTIONS preloads a network-attempt
// detector (writes NETWORK_ATTEMPT_357 to stderr and throws) as a BACKSTOP
// behind the harness's own D-13 fetch ban -- L1 asserts that backstop is
// never tripped across a full run.
//
// No em-dashes anywhere (hyphens only, CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

delete process.env.TYPESAFE_API_KEY;

const REPO = path.join(__dirname, '..');
const REPLAY_SCRIPT = path.join(REPO, 'scripts', 'replay-card-fire.cjs');
const corpusLoader = require(path.join(REPO, 'scripts', 'card-fire-replay-corpus.cjs'));

console.log('test-357-replay');

let failures = 0;
let total = 0;
function ok(desc, fn) {
  total += 1;
  try {
    fn();
    console.log('  ok   ' + desc);
  } catch (e) {
    failures += 1;
    console.log('  FAIL ' + desc + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const MUTATION_MODE = process.argv.indexOf('--mutation') !== -1;

// ---------------------------------------------------------------------
// The network-attempt-detector preload (D-13 backstop). Written ONCE to a
// shared temp file and reused by every replay() spawn.
// ---------------------------------------------------------------------
const preloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay357-preload-'));
const preloadPath = path.join(preloadDir, 'network-attempt-detector.cjs');
fs.writeFileSync(
  preloadPath,
  "'use strict';\n" +
  'globalThis.fetch = function () {\n' +
  "  process.stderr.write('NETWORK_ATTEMPT_357\\n');\n" +
  "  throw new Error('NETWORK_ATTEMPT_357');\n" +
  '};\n'
);

/**
 * replay(args, extraEnv) -- spawn `node scripts/replay-card-fire.cjs
 * ...args --json`, hygienic child env, returns {status, json, stdout,
 * stderr}. `json` is null when stdout did not parse (an error path prints
 * to stderr instead of stdout).
 */
function replay(args, extraEnv) {
  const childHome = fs.mkdtempSync(path.join(os.tmpdir(), 'replay357-test-home-'));
  const env = Object.assign({}, process.env);
  delete env.TYPESAFE_API_KEY;
  env.HOME = childHome;
  env.NODE_OPTIONS = ((env.NODE_OPTIONS || '') + ' --require ' + preloadPath).trim();
  Object.assign(env, extraEnv || {});

  const fullArgs = (args || []).concat(['--json']);
  const res = spawnSync(process.execPath, [REPLAY_SCRIPT].concat(fullArgs), {
    cwd: REPO,
    env: env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch (_e) {
    json = null;
  }
  return { status: res.status, json: json, stdout: res.stdout, stderr: res.stderr };
}

/**
 * writeTempCorpus(entries, opts) -- write a fresh mkdtemp corpus dir holding
 * ONE debug-cases.json file (source 'debug', a valid sanitization_statement)
 * with the given entries, and optionally a baseline.json. Returns the dir.
 */
function writeTempCorpus(entries, opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay357-corpus-'));
  const fileObj = {
    meta: {
      phase: '357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re',
      source: 'debug',
      schema: 'D-02 entry shape; see scripts/card-fire-replay-corpus.cjs validateEntry',
      sanitization_statement: 'Synthetic entries authored directly for tests/test-357-replay.cjs; no live session data, no third-party names, no room content.',
    },
    entries: entries,
  };
  fs.writeFileSync(path.join(dir, 'debug-cases.json'), JSON.stringify(fileObj));
  if (opts && opts.baseline) {
    fs.writeFileSync(path.join(dir, 'baseline.json'), JSON.stringify(opts.baseline));
  }
  return dir;
}

function findEntry(json, id) {
  return (json && Array.isArray(json.entries)) ? json.entries.find(function (e) { return e.id === id; }) : null;
}

// =======================================================================
// --mutation (357-09 Task 2, GATE357-08, R7/R-I/R-J): a distinct invocation
// mode, guarded by run-all-357.sh / run-all-238.sh on baseline.json's own
// existence. Proves that reverting either D-07 or D-08a fix (individually,
// then together) makes the standing replay fail honestly, by rebuilding a
// HEAD code root three times with the named runtime files restored to their
// pre-phase bytes (`git show <pre_phase_sha>:<path>`) and re-running the real
// replay against each mutant. Every mkdtemp is removed in a finally; nothing
// is ever written back into the working tree (T-357-12).
// =======================================================================
function buildMutantBase() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-357-root-mutation-base-'));
  const archivePath = path.join(tmp, 'a.tar');
  spawnSync('git', ['archive', '-o', archivePath, 'HEAD', 'scripts', 'lib', 'data', 'package.json', '.claude-plugin'], { cwd: REPO, stdio: ['ignore', 'ignore', 'pipe'] });
  spawnSync('tar', ['-xf', archivePath, '-C', tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
  fs.rmSync(archivePath, { force: true });
  const nodeModulesSrc = path.join(REPO, 'node_modules');
  if (fs.existsSync(nodeModulesSrc)) {
    try { fs.symlinkSync(nodeModulesSrc, path.join(tmp, 'node_modules'), 'dir'); } catch (_e) { /* best-effort */ }
  }
  return tmp;
}

function makeMutant(baseDir, label, preSha, revertPaths) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-357-root-mutation-' + label + '-'));
  fs.cpSync(baseDir, dir, { recursive: true });
  for (const relPath of revertPaths) {
    const shown = spawnSync('git', ['show', preSha + ':' + relPath], { cwd: REPO, maxBuffer: 16 * 1024 * 1024 });
    if (shown.status !== 0) {
      throw new Error('git show ' + preSha + ':' + relPath + ' failed: ' + shown.stderr);
    }
    fs.writeFileSync(path.join(dir, relPath), shown.stdout);
  }
  return dir;
}

function runMutationLeg() {
  const pre = corpusLoader.readPrePhase();
  const preSha = pre && pre.pre_phase_sha;
  if (!preSha) {
    ok('mutation: pre_phase_sha is available', function () {
      throw new Error('tests/fixtures/card-fire-replay/pre-phase.json is missing pre_phase_sha');
    });
    return;
  }

  // The revert can only be proven load-bearing when the unmutated HEAD bar
  // is itself green (R4 MET). A red HEAD bar is an honest red here, not an
  // improvised pass.
  const headRes = replay(['--surface', 'both', '--baseline', 'compare']);
  if (headRes.status !== 0) {
    console.log('mutation leg: not provable, R4 NOT MET');
    ok('mutation: the unmutated HEAD bar must be green (R4 MET) before a revert is provable', function () {
      assert.equal(headRes.status, 0, 'HEAD --baseline compare must exit 0; got ' + headRes.status + ' stdout=' + headRes.stdout + ' stderr=' + headRes.stderr);
    });
    return;
  }

  let baseDir = null;
  const mutantDirs = [];
  try {
    baseDir = buildMutantBase();
    const m1 = makeMutant(baseDir, 'm1', preSha, ['lib/hmi/turn-text.cjs', 'scripts/check-card-fire.cjs']);
    mutantDirs.push(m1);
    const m2 = makeMutant(baseDir, 'm2', preSha, ['lib/core/gate-relevance.cjs']);
    mutantDirs.push(m2);
    const m3 = makeMutant(baseDir, 'm3', preSha, ['lib/hmi/turn-text.cjs', 'scripts/check-card-fire.cjs', 'lib/core/gate-relevance.cjs']);
    mutantDirs.push(m3);

    ok('mutation M1: reverting D-07 (turn-text.cjs, check-card-fire.cjs) fails the replay on live-2026-09-23-01', function () {
      const res = replay(['--code-root', m1, '--surface', 'both', '--baseline', 'compare']);
      assert.equal(res.status, 1, 'M1 must exit 1 (a reverted D-07 fix must reproduce a false block); got ' + res.status + ' stdout=' + res.stdout + ' stderr=' + res.stderr);
      const e = findEntry(res.json, 'live-2026-09-23-01');
      assert.ok(e, 'live-2026-09-23-01 must be present in the M1 run');
      assert.equal(e.outcome, 'FALSE_BLOCK', 'live-2026-09-23-01 must be FALSE_BLOCK under M1, got ' + e.outcome);
    });

    ok('mutation M2: reverting D-08a (gate-relevance.cjs) fails the replay on live-2026-09-23-02', function () {
      const res = replay(['--code-root', m2, '--surface', 'both', '--baseline', 'compare']);
      assert.equal(res.status, 1, 'M2 must exit 1 (a reverted D-08a fix must reproduce a false block); got ' + res.status + ' stdout=' + res.stdout + ' stderr=' + res.stderr);
      const e = findEntry(res.json, 'live-2026-09-23-02');
      assert.ok(e, 'live-2026-09-23-02 must be present in the M2 run');
      assert.equal(e.outcome, 'FALSE_BLOCK', 'live-2026-09-23-02 must be FALSE_BLOCK under M2, got ' + e.outcome);
    });

    ok('mutation M3: reverting both fixes fails the replay on both live entries', function () {
      const res = replay(['--code-root', m3, '--surface', 'both', '--baseline', 'compare']);
      assert.equal(res.status, 1, 'M3 must exit 1 (both reverted fixes must reproduce both false blocks); got ' + res.status + ' stdout=' + res.stdout + ' stderr=' + res.stderr);
      const e1 = findEntry(res.json, 'live-2026-09-23-01');
      const e2 = findEntry(res.json, 'live-2026-09-23-02');
      assert.ok(e1 && e2, 'both live anchors must be present in the M3 run');
      assert.equal(e1.outcome, 'FALSE_BLOCK', 'live-2026-09-23-01 must be FALSE_BLOCK under M3, got ' + e1.outcome);
      assert.equal(e2.outcome, 'FALSE_BLOCK', 'live-2026-09-23-02 must be FALSE_BLOCK under M3, got ' + e2.outcome);
    });
  } finally {
    for (const d of mutantDirs) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    }
    if (baseDir) {
      try { fs.rmSync(baseDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    }
  }
}

if (MUTATION_MODE) {
  const baselinePath = path.join(corpusLoader.CORPUS_DIR, 'baseline.json');
  if (!fs.existsSync(baselinePath)) {
    console.log('SKIP mutation: baseline lands in 357-09');
    process.exit(0);
  }
  runMutationLeg();
  console.log((failures === 0 ? 'PASS' : 'FAIL') + ' ' + (total - failures) + '/' + total);
  process.exitCode = failures === 0 ? 0 : 1;
  process.exit(process.exitCode);
}

// =======================================================================
// L1 -- network ban: a full --surface both run has no NETWORK_ATTEMPT_357
// in stderr (SPEC R2, D-13).
// =======================================================================
ok('L1: --surface both, full corpus, never trips the NETWORK_ATTEMPT_357 backstop', function () {
  const res = replay(['--surface', 'both']);
  assert.equal(res.status, 0, 'a green full-corpus run must exit 0 (stderr: ' + res.stderr + ')');
  assert.ok(
    res.stderr.indexOf('NETWORK_ATTEMPT_357') === -1,
    'stderr must never contain NETWORK_ATTEMPT_357; got: ' + res.stderr
  );
});

// =======================================================================
// L2 -- exit semantics (SPEC R2 acceptance).
// =======================================================================

// L2(a): a genuine bracket box labeled pass, healthy + corroborated ->
// FALSE_BLOCK, counts.false_blocks === 1, exit 1.
ok('L2(a): a genuine bracket box labeled pass -> FALSE_BLOCK, exit 1', function () {
  const entry = {
    id: 'debug-l2a-false-block',
    source: 'debug',
    envelope: {
      mode: 'direct',
      output_text: 'Pick a path forward:\n[1] Rebuild the sample-library index from scratch\n\n[2] Patch only the changed sample-project entries',
      ran_entries: [],
      sidechannel_health: 'healthy',
      reach_corroborated: true,
    },
    expected_verdict_class: 'pass',
    label_origin: 'hand',
    why: 'a genuine bracket box labeled pass exercises the FALSE_BLOCK outcome leg (SPEC R2 acceptance)',
  };
  const dir = writeTempCorpus([entry]);
  const res = replay(['--surface', 'cli', '--source', 'debug', '--corpus-dir', dir]);
  assert.equal(res.status, 1, 'a run containing a FALSE_BLOCK must exit 1');
  assert.equal(res.json.counts.false_blocks, 1, 'counts.false_blocks must be 1');
  const e = findEntry(res.json, entry.id);
  assert.equal(e.outcome, 'FALSE_BLOCK', 'entry outcome must be FALSE_BLOCK');
  assert.equal(e.cli.class, 'block', 'the entry must actually classify as block');
});

// L2(b): an ordinary no-gate entry labeled block, plus a baseline saying
// block for it -> NEW_MISS, exit 1.
ok('L2(b): ordinary no-gate entry labeled block, baseline says block -> NEW_MISS, exit 1', function () {
  const entry = {
    id: 'debug-l2b-new-miss',
    source: 'debug',
    envelope: {
      mode: 'direct',
      output_text: 'Sure, I will go ahead and continue with the plan as discussed.',
      ran_entries: [],
      sidechannel_health: 'healthy',
      reach_corroborated: false,
    },
    expected_verdict_class: 'block',
    label_origin: 'hand',
    why: 'an ordinary no-gate turn labeled block against a block baseline exercises NEW_MISS (SPEC R2 acceptance)',
  };
  const dir = writeTempCorpus([entry], { baseline: { meta: { code_root: 'pre-phase' }, verdicts: { 'debug-l2b-new-miss': 'block' } } });
  const res = replay(['--surface', 'cli', '--source', 'debug', '--corpus-dir', dir, '--baseline', 'compare']);
  assert.equal(res.status, 1, 'a run containing a NEW_MISS must exit 1');
  assert.equal(res.json.counts.new_misses, 1, 'counts.new_misses must be 1');
  const e = findEntry(res.json, entry.id);
  assert.equal(e.outcome, 'NEW_MISS', 'entry outcome must be NEW_MISS');
  assert.equal(e.cli.class, 'pass', 'the entry must actually classify as pass (the miss)');
});

// L2(c): the same shape as (b), with known_miss and NO baseline -> KNOWN_MISS, exit 0.
ok('L2(c): the same entry with known_miss and no baseline -> KNOWN_MISS, exit 0', function () {
  const entry = {
    id: 'debug-l2c-known-miss',
    source: 'debug',
    envelope: {
      mode: 'direct',
      output_text: 'Sure, I will go ahead and continue with the plan as discussed.',
      ran_entries: [],
      sidechannel_health: 'healthy',
      reach_corroborated: false,
    },
    expected_verdict_class: 'block',
    known_miss: { reason: 'text-dependent prose fork, needs Jev labeling (357-04/357-08)' },
    label_origin: 'hand',
    why: 'the same no-gate turn, annotated known_miss, exercises KNOWN_MISS (SPEC R2 acceptance)',
  };
  const dir = writeTempCorpus([entry]);
  const res = replay(['--surface', 'cli', '--source', 'debug', '--corpus-dir', dir]);
  assert.equal(res.status, 0, 'a run whose only non-OK outcome is KNOWN_MISS must exit 0');
  assert.equal(res.json.counts.known_misses, 1, 'counts.known_misses must be 1');
  assert.equal(res.json.counts.new_misses, 0, 'a KNOWN_MISS must never also count as a NEW_MISS');
  const e = findEntry(res.json, entry.id);
  assert.equal(e.outcome, 'KNOWN_MISS', 'entry outcome must be KNOWN_MISS');
});

// L2(d): the (a) shape, with known_false_block -> KNOWN_FALSE_BLOCK, exit 0.
ok('L2(d): the bracket-box entry with known_false_block -> KNOWN_FALSE_BLOCK, exit 0', function () {
  const entry = {
    id: 'debug-l2d-known-false-block',
    source: 'debug',
    envelope: {
      mode: 'direct',
      output_text: 'Pick a path forward:\n[1] Rebuild the sample-library index from scratch\n\n[2] Patch only the changed sample-project entries',
      ran_entries: [],
      sidechannel_health: 'healthy',
      reach_corroborated: true,
    },
    expected_verdict_class: 'pass',
    known_false_block: { reason: 'text-dependent, needs Jev labeling (357-04/357-08)' },
    label_origin: 'hand',
    why: 'the same bracket box, annotated known_false_block, exercises KNOWN_FALSE_BLOCK (SPEC R2 acceptance)',
  };
  const dir = writeTempCorpus([entry]);
  const res = replay(['--surface', 'cli', '--source', 'debug', '--corpus-dir', dir]);
  assert.equal(res.status, 0, 'a run whose only non-OK outcome is KNOWN_FALSE_BLOCK must exit 0');
  assert.equal(res.json.counts.known_false_blocks, 1, 'counts.known_false_blocks must be 1');
  assert.equal(res.json.counts.false_blocks, 0, 'a KNOWN_FALSE_BLOCK must never also count as a FALSE_BLOCK');
  const e = findEntry(res.json, entry.id);
  assert.equal(e.outcome, 'KNOWN_FALSE_BLOCK', 'entry outcome must be KNOWN_FALSE_BLOCK');
});

// =======================================================================
// L3 -- hermeticity negative control (R-H, Pitfall 4): the MCP surface must
// never resolve, read, or write the navigator's real (here: a decoy)
// machine-wide active room, no matter what the LAUNCHING environment points
// MINDRIAN_ROOMS_HOME/MINDRIAN_ROOMS_ROOT at -- the harness's own per-entry
// override must always win.
// =======================================================================
ok('L3: a decoy machine-wide active room is never resolved or touched by the MCP surface', function () {
  const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'replay357-decoy-rooms-'));
  const decoyDir = path.join(roomsHome, 'decoy-room');
  fs.mkdirSync(decoyDir, { recursive: true });
  const statePath = path.join(decoyDir, 'STATE.md');
  fs.writeFileSync(statePath, '# Decoy room STATE.md -- must never be touched by the replay\n');
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'), JSON.stringify({
    active: 'decoy-room',
    rooms: { 'decoy-room': { abs_path: decoyDir } },
  }));

  const beforeStat = fs.statSync(statePath);
  const beforeBytes = fs.readFileSync(statePath);

  const res = replay(['--surface', 'mcp', '--source', '238'], {
    MINDRIAN_ROOMS_HOME: roomsHome,
    MINDRIAN_ROOMS_ROOT: roomsHome,
  });
  assert.equal(res.status, 0, '--surface mcp --source 238 must exit 0 (stderr: ' + res.stderr + ')');
  for (const e of res.json.entries) {
    const roomDir = e.mcp && e.mcp.room_dir;
    assert.ok(
      roomDir === null || roomDir === undefined,
      'entry ' + e.id + ' must resolve room_dir to null/undefined, got ' + JSON.stringify(roomDir)
    );
  }

  const afterStat = fs.statSync(statePath);
  const afterBytes = fs.readFileSync(statePath);
  assert.equal(afterStat.mtimeMs, beforeStat.mtimeMs, 'the decoy STATE.md mtime must be unchanged');
  assert.ok(beforeBytes.equals(afterBytes), 'the decoy STATE.md bytes must be unchanged');
});

// =======================================================================
// L4 -- envelope modes and bookkeeping (Pattern 1, Pattern 4 groundwork,
// D-07's code path actually exercised via transcript mode).
// =======================================================================

const L4_SUBJECT = 'choose a starting point for the venture plan: build the plan now, run research first, or file evidence';

ok('L4(a): a synthetic tool_result preceding record -> pass, preceding-turn-synthetic-no-user-engagement', function () {
  const entry = {
    id: 'debug-l4a-tool-result',
    source: 'debug',
    envelope: {
      mode: 'transcript+sidechannel',
      transcript: [
        {
          type: 'user',
          message: {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'toolu_01l4a', content: 'Background task finished.' }],
          },
        },
        { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Noted, continuing with the plan.' }] } },
      ],
      sidechannel_records: [{ entry: 'scripts/intent-classifier.cjs', shape: 'F.1', age_ms: 30000, subject: L4_SUBJECT }],
    },
    expected_verdict_class: 'pass',
    label_origin: 'hand',
    why: 'a tool_result preceding record must not force a Decision Gate card (room-bind-gate-fires-on-notification-only-turns fix, D-07 groundwork)',
  };
  const dir = writeTempCorpus([entry]);
  const res = replay(['--surface', 'both', '--source', 'debug', '--corpus-dir', dir]);
  assert.equal(res.json.counts.parity_mismatches, 0, 'CLI/MCP must agree');
  const e = findEntry(res.json, entry.id);
  assert.equal(e.cli.class, 'pass', 'cli must pass');
  assert.equal(e.cli.reason, 'preceding-turn-synthetic-no-user-engagement', 'cli reason must be the synthetic-turn pass');
  assert.equal(e.mcp.class, 'pass', 'mcp must agree (pass)');
});

ok('L4(b): a human-typed preceding record sharing a content token -> block, reached-registry-gate-no-card', function () {
  const entry = {
    id: 'debug-l4b-human-typed',
    source: 'debug',
    envelope: {
      mode: 'transcript+sidechannel',
      transcript: [
        { type: 'user', message: { role: 'user', content: 'help me choose a starting point for the venture plan' } },
        { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'I think you should probably just start with the research and skip the rest.' }] } },
      ],
      sidechannel_records: [{ entry: 'scripts/intent-classifier.cjs', shape: 'F.1', age_ms: 30000, subject: L4_SUBJECT }],
    },
    expected_verdict_class: 'block',
    label_origin: 'hand',
    why: 'a genuinely human, on-topic preceding turn must still force the reached gate (the conservative WR-06/CR-06 floor, unweakened)',
  };
  const dir = writeTempCorpus([entry]);
  const res = replay(['--surface', 'both', '--source', 'debug', '--corpus-dir', dir]);
  assert.equal(res.json.counts.parity_mismatches, 0, 'CLI/MCP must agree');
  const e = findEntry(res.json, entry.id);
  assert.equal(e.cli.class, 'block', 'cli must block');
  assert.equal(e.cli.reason, 'reached-registry-gate-no-card', 'cli reason must be the forced-gate reason');
  assert.equal(e.mcp.class, 'block', 'mcp must agree (block)');
});

ok('L4(c): a fired card consumes the reach record; the next turn in the same session does not re-force it', function () {
  const entry = {
    id: 'debug-l4c-consumption',
    source: 'debug',
    envelope: {
      mode: 'transcript',
      transcript: [
        { type: 'user', message: { role: 'user', content: 'help me choose a starting point for the venture plan' } },
        { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Continuing without re-asking.' }] } },
      ],
      steps: [
        {
          mode: 'transcript+sidechannel',
          transcript: [
            { type: 'user', message: { role: 'user', content: 'help me choose a starting point for the venture plan' } },
            {
              type: 'assistant',
              message: {
                role: 'assistant',
                content: [
                  { type: 'text', text: 'Here is a decision gate.' },
                  { type: 'tool_use', name: 'AskUserQuestion', input: {} },
                ],
              },
            },
          ],
          sidechannel_records: [{ entry: 'scripts/intent-classifier.cjs', shape: 'F.1', age_ms: 5000, subject: L4_SUBJECT }],
        },
      ],
    },
    expected_verdict_class: 'pass',
    label_origin: 'hand',
    why: 'proves the harness mirrors main() own record-consumption bookkeeping across a multi-step entry, on both surfaces',
  };
  const dir = writeTempCorpus([entry]);
  const res = replay(['--surface', 'both', '--source', 'debug', '--corpus-dir', dir]);
  assert.equal(res.json.counts.parity_mismatches, 0, 'CLI/MCP must agree on the FINAL step');
  const e = findEntry(res.json, entry.id);
  assert.equal(e.cli.class, 'pass', 'the final step must pass (no card, no leftover reach)');
  assert.equal(e.mcp.class, 'pass', 'mcp must agree on the final step (pass)');
});

// =======================================================================
// L5 -- code root: --code-root pre-phase gives the same per-entry classes
// as HEAD on the 238 corpus, and cleans up its archive.
// =======================================================================
ok('L5: --code-root pre-phase reproduces the HEAD classes on the 238 corpus and cleans up', function () {
  const headRes = replay(['--surface', 'both', '--source', '238']);
  const preRes = replay(['--code-root', 'pre-phase', '--surface', 'both', '--source', '238']);
  assert.equal(headRes.status, 0, 'the HEAD 238 run must exit 0');
  assert.equal(preRes.status, 0, 'the pre-phase 238 run must exit 0 (238 predates every 357 change)');
  assert.equal(headRes.json.entries.length, preRes.json.entries.length, 'both runs must cover the same 18 entries');

  const headById = {};
  for (const e of headRes.json.entries) headById[e.id] = e;
  for (const e of preRes.json.entries) {
    const h = headById[e.id];
    assert.ok(h, 'pre-phase entry ' + e.id + ' must also appear in the HEAD run');
    assert.equal(e.cli.class, h.cli.class, 'cli class must match for ' + e.id);
    assert.equal(e.mcp.class, h.mcp.class, 'mcp class must match for ' + e.id);
  }

  let leftover = [];
  try {
    leftover = fs.readdirSync(os.tmpdir()).filter(function (n) { return n.indexOf('replay-357-root-') === 0; });
  } catch (_e) {
    leftover = [];
  }
  assert.equal(leftover.length, 0, 'no replay-357-root-* archive directory may survive the run, found: ' + leftover.join(', '));
});

// =======================================================================
// L6 -- live anchors (SPEC R2 acceptance), active only once live-2026-09-23
// entries land (357-05). Anchors named here so the leg is already written
// and waiting, per the plan's own "already written, waiting on inputs" spec.
// =======================================================================
const LIVE_ANCHOR_IDS = ['live-2026-09-23-01', 'live-2026-09-23-02'];

function loadLiveEntryCount() {
  try {
    const filePath = path.join(corpusLoader.CORPUS_DIR, corpusLoader.SOURCE_FILES.live);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed.entries) ? parsed.entries.length : 0;
  } catch (_e) {
    return 0;
  }
}

if (loadLiveEntryCount() >= 2) {
  ok('L6: the two 2026-09-23 live anchors reproduce as FALSE_BLOCK against the pre-phase code root', function () {
    const res = replay(['--code-root', 'pre-phase', '--surface', 'both', '--source', 'live']);
    assert.equal(res.status, 1, 'live anchors must reproduce as an exit-1 run (false blocks present)');
    for (const id of LIVE_ANCHOR_IDS) {
      const e = findEntry(res.json, id);
      assert.ok(e, 'live anchor ' + id + ' must be present in the corpus');
      assert.equal(e.outcome, 'FALSE_BLOCK', id + ' must reproduce as FALSE_BLOCK');
      assert.equal(e.cli.reason, 'reached-registry-gate-no-card', id + ' cli reason must be reached-registry-gate-no-card');
    }
  });
} else {
  console.log('SKIP L6: live entries land in 357-05');
}

// =======================================================================
// L7 -- bar (SPEC R2/R7 acceptance), active only once baseline.json lands
// (357-09).
// =======================================================================
if (fs.existsSync(path.join(corpusLoader.CORPUS_DIR, 'baseline.json'))) {
  ok('L7: the standing bar (HEAD, both surfaces, --baseline compare) is green', function () {
    const res = replay(['--surface', 'both', '--baseline', 'compare']);
    assert.equal(res.status, 0, 'the standing bar must be green');
    assert.equal(res.json.counts.false_blocks, 0, 'false_blocks must be 0');
    assert.equal(res.json.counts.new_misses, 0, 'new_misses must be 0');
    assert.equal(res.json.counts.parity_mismatches, 0, 'parity_mismatches must be 0');
    assert.equal(res.json.counts.unmarked_misses, 0, 'unmarked_misses must be 0');
  });
} else {
  console.log('SKIP L7: baseline lands in 357-09');
}

// =======================================================================
console.log((failures === 0 ? 'PASS' : 'FAIL') + ' ' + (total - failures) + '/' + total);
process.exitCode = failures === 0 ? 0 : 1;
