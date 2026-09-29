'use strict';
// Phase 362-02 -- test-362-disposition.cjs: the disposition of the one
// known_false_block Phase 357 left open, replay entry dogfood-0f86dd63-092046
// (CARD362-04, CARD362-05; D-03, D-04, D-05). Written once, here, in 362-02.
//
// OUTCOME is fixed by 362-SIGNALS.md line 1 (the committed structured-signal
// measurement, scripts/measure-relevance-signals-362.cjs):
//   'fixed'    - line 1 names a variant: the signal clears the target on both
//                surfaces, the known_false_block annotation is gone, and the
//                357 bar enforces the entry.
//   'residual' - line 1 is `SIGNAL: NONE`: the target stays a
//                known_false_block whose reason cites the 362 measurement,
//                and no gate runtime file changed since PRE362.
//
// Legs:
//   D1 target disposition, both surfaces
//   D2 the 357 bar over the full corpus, both surfaces
//   D3 no other verdict change against tests/fixtures/card-fire-replay/pre-362.json
//   D4 the 12 anti-vacuity fixtures still block on cli and mcp
//   D5 relevance floors (fixed only)
//   D6 no gate runtime change since PRE362 (residual only)
//   D7 hygiene: no network attempt, the measurement script never referenced
//      from lib/ or hooks/, no leftover replay-362-root-* temp dir
//   --mutation: revert every changed gate runtime file to its PRE362 bytes in
//      a temp code root and prove the target false-blocks again; exit 77 (SKIP)
//      when no gate runtime file changed (the residual branch).
//
// Test hygiene (every spawn): TYPESAFE_API_KEY stripped, HOME redirected to a
// fresh mkdtemp, and a NODE_OPTIONS preload that replaces globalThis.fetch with
// a thrower writing NETWORK_ATTEMPT_362 to stderr (the test-357-replay.cjs
// pattern, copied in style, never required).
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
const PRE362_PATH = path.join(REPO, 'tests', 'fixtures', 'card-fire-replay', 'pre-362.json');
const corpusLoader = require(path.join(REPO, 'scripts', 'card-fire-replay-corpus.cjs'));

const TARGET_ID = 'dogfood-0f86dd63-092046';
const ANTI_VACUITY_IDS = Object.freeze([
  '238:genuine-multiline-bracket-box:s2',
  '238:genuine-multiline-bracket-box:s3',
  '238:genuine-bulleted-bracket-box:s2',
  '238:genuine-bulleted-bracket-box:s3',
  '238:type-1-2-or-3-literal:s2',
  '238:type-1-2-or-3-literal:s3',
  '238:reconstructed-two-honest-paths-fork:s2',
  '238:reconstructed-two-honest-paths-fork:s3',
  'debug-intern-w1-labeled-fork',
  'debug-reach-gate-stale-turn-input',
  'debug-carveout-skill-meta-after-human',
  'debug-carveout-image-meta-after-human',
]);
const RUNTIME6 = Object.freeze([
  'scripts/check-card-fire.cjs',
  'lib/core/gate-relevance.cjs',
  'lib/hmi/turn-text.cjs',
  'lib/mcp/stop-gate-handler.cjs',
  'lib/core/card-fire-sidechannel.cjs',
  'lib/core/fork-declaration.cjs',
]);

// OUTCOME: set once, from 362-SIGNALS.md line 1 as committed in 362-02 Task 1:
//   "SIGNAL: NONE"
const OUTCOME = 'residual';
// The fixed branch only: the pass reason the chosen variant produces (it lives
// inside gateTopicallyRelevant or gateSubjectTokens, per D-03 placement).
const EXPECTED_TARGET_REASON = 'gate-irrelevant-to-turn';
const TARGET_FROM = Object.freeze({ cli_class: 'block', cli_reason: 'reached-registry-gate-no-card', mcp_class: 'block' });

const MUTATION_MODE = process.argv.indexOf('--mutation') !== -1;

console.log('test-362-disposition (' + OUTCOME + (MUTATION_MODE ? ', --mutation' : '') + ')');

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

// ---------------------------------------------------------------------
// Network-attempt-detector preload, shared by every spawn.
// ---------------------------------------------------------------------
const scratch = [];
const preloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay362-preload-'));
scratch.push(preloadDir);
const preloadPath = path.join(preloadDir, 'network-attempt-detector.cjs');
fs.writeFileSync(
  preloadPath,
  "'use strict';\n" +
  'globalThis.fetch = function () {\n' +
  "  process.stderr.write('NETWORK_ATTEMPT_362\\n');\n" +
  "  throw new Error('NETWORK_ATTEMPT_362');\n" +
  '};\n'
);

let networkAttempts = 0;

function replay(args) {
  const childHome = fs.mkdtempSync(path.join(os.tmpdir(), 'replay362-home-'));
  scratch.push(childHome);
  const env = Object.assign({}, process.env);
  delete env.TYPESAFE_API_KEY;
  env.HOME = childHome;
  env.NODE_OPTIONS = ((env.NODE_OPTIONS || '') + ' --require ' + preloadPath).trim();
  const res = spawnSync(process.execPath, [REPLAY_SCRIPT].concat(args || [], ['--json']), {
    cwd: REPO,
    env: env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (String(res.stderr || '').indexOf('NETWORK_ATTEMPT_362') !== -1) networkAttempts += 1;
  let json = null;
  try { json = JSON.parse(res.stdout); } catch (_e) { json = null; }
  return { status: res.status, json: json, stdout: res.stdout, stderr: res.stderr };
}

function findEntry(json, id) {
  return (json && Array.isArray(json.entries)) ? json.entries.find(function (e) { return e.id === id; }) : null;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function cleanup() {
  for (const d of scratch) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

const pre362 = JSON.parse(fs.readFileSync(PRE362_PATH, 'utf8'));

// =======================================================================
// --mutation: revert every RUNTIME6 file whose bytes differ from PRE362 in a
// fresh HEAD code root; the replay must then fail with the target FALSE_BLOCK,
// while an unmutated HEAD copy stays green. Nothing is written to the tree.
// =======================================================================
function buildHeadRoot(label) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-362-root-mutation-' + label + '-'));
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

function changedRuntimeFiles() {
  return RUNTIME6.filter(function (p) {
    return sha256(fs.readFileSync(path.join(REPO, p))) !== pre362.runtime_files[p];
  });
}

if (MUTATION_MODE) {
  const changed = changedRuntimeFiles();
  if (changed.length === 0) {
    console.log('SKIP mutation: no gate runtime change since PRE362');
    cleanup();
    process.exit(77);
  }
  const roots = [];
  try {
    const control = buildHeadRoot('control');
    roots.push(control);
    const mutant = buildHeadRoot('mutant');
    roots.push(mutant);
    for (const relPath of changed) {
      const shown = spawnSync('git', ['show', pre362.pre_362_sha + ':' + relPath], { cwd: REPO, maxBuffer: 16 * 1024 * 1024 });
      if (shown.status !== 0) throw new Error('git show ' + pre362.pre_362_sha + ':' + relPath + ' failed');
      fs.writeFileSync(path.join(mutant, relPath), shown.stdout);
    }
    ok('mutation: reverting ' + changed.join(', ') + ' to PRE362 reproduces the target false block', function () {
      const res = replay(['--code-root', mutant, '--surface', 'both', '--baseline', 'compare']);
      assert.equal(res.status, 1, 'mutant must exit 1; got ' + res.status + ' stderr=' + res.stderr);
      const e = findEntry(res.json, TARGET_ID);
      assert.ok(e, TARGET_ID + ' must be present in the mutant run');
      assert.equal(e.outcome, 'FALSE_BLOCK', TARGET_ID + ' must be FALSE_BLOCK under the mutant, got ' + e.outcome);
    });
    ok('mutation control: an unmutated HEAD copy stays green', function () {
      const res = replay(['--code-root', control, '--surface', 'both', '--baseline', 'compare']);
      assert.equal(res.status, 0, 'control must exit 0; got ' + res.status + ' stderr=' + res.stderr);
    });
  } finally {
    for (const d of roots) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    }
  }
  ok('mutation hygiene: no spawn attempted a network call', function () {
    assert.equal(networkAttempts, 0, 'NETWORK_ATTEMPT_362 seen in ' + networkAttempts + ' spawn(s)');
  });
  cleanup();
  console.log((failures === 0 ? 'PASS' : 'FAIL') + ' ' + (total - failures) + '/' + total);
  process.exit(failures === 0 ? 0 : 1);
}

// =======================================================================
// Default mode: D1-D7.
// =======================================================================
const corpus = corpusLoader.loadCorpus({});
const targetEntry = corpus.entries.find(function (e) { return e.id === TARGET_ID; });
const entryRun = replay(['--surface', 'both', '--only', TARGET_ID]);
const fullRun = replay(['--surface', 'both', '--baseline', 'compare']);

ok('D1: target disposition on both surfaces (' + OUTCOME + ')', function () {
  assert.ok(targetEntry, TARGET_ID + ' must be in the loaded corpus');
  const e = findEntry(entryRun.json, TARGET_ID);
  assert.ok(e, TARGET_ID + ' must be in the --only run; stderr=' + entryRun.stderr);
  if (OUTCOME === 'fixed') {
    assert.equal(e.cli.class, 'pass', 'cli must pass');
    assert.equal(e.cli.reason, EXPECTED_TARGET_REASON, 'cli reason');
    assert.equal(e.mcp.class, 'pass', 'mcp must pass');
    assert.equal(Object.prototype.hasOwnProperty.call(targetEntry, 'known_false_block'), false, 'known_false_block must be removed');
  } else {
    assert.equal(e.cli.class, 'block', 'cli must still block');
    assert.equal(e.mcp.class, 'block', 'mcp must still block');
    assert.equal(e.outcome, 'KNOWN_FALSE_BLOCK', 'outcome');
    const kfb = targetEntry.known_false_block;
    assert.ok(kfb && typeof kfb.reason === 'string', 'known_false_block.reason must exist');
    assert.ok(kfb.reason.indexOf('text') !== -1, 'reason must keep the word text');
    assert.ok(kfb.reason.indexOf('362-SIGNALS.md') !== -1, 'reason must cite 362-SIGNALS.md');
  }
});

ok('D2: the 357 bar over the full corpus, both surfaces', function () {
  assert.equal(fullRun.status, 0, 'full replay must exit 0; got ' + fullRun.status + ' stderr=' + fullRun.stderr);
  const c = fullRun.json.counts;
  assert.equal(c.false_blocks, 0, 'false_blocks');
  assert.equal(c.new_misses, 0, 'new_misses');
  assert.equal(c.parity_mismatches, 0, 'parity_mismatches');
  assert.equal(c.unmarked_misses, 0, 'unmarked_misses');
  assert.equal(c.errors, 0, 'errors');
  assert.equal(c.known_false_blocks, OUTCOME === 'fixed' ? 0 : 1, 'known_false_blocks');
});

ok('D3: no verdict other than the ratified target change moved since pre-362.json', function () {
  const diffs = [];
  for (const id of Object.keys(pre362.verdicts)) {
    const before = pre362.verdicts[id];
    const e = findEntry(fullRun.json, id);
    if (!e) { diffs.push(id + ': missing'); continue; }
    const mcpDedup = e.mcp && e.mcp.dedup === true;
    const after = { cli_class: e.cli.class, cli_reason: e.cli.reason, mcp_class: e.mcp.class };
    if (OUTCOME === 'fixed' && id === TARGET_ID) {
      assert.deepEqual(before, TARGET_FROM, 'target PRE362 row');
      if (after.cli_class !== 'pass' || after.cli_reason !== EXPECTED_TARGET_REASON || after.mcp_class !== 'pass') diffs.push(id + ': ratified flip not reached ' + JSON.stringify(after));
      continue;
    }
    if (before.cli_class !== after.cli_class || before.cli_reason !== after.cli_reason) diffs.push(id + ': cli ' + JSON.stringify(before) + ' -> ' + JSON.stringify(after));
    if (!mcpDedup && before.mcp_class !== after.mcp_class) diffs.push(id + ': mcp ' + before.mcp_class + ' -> ' + after.mcp_class);
  }
  assert.equal(diffs.length, 0, diffs.join('; '));
});

ok('D4: all 12 anti-vacuity fixtures exist, are labeled block, and block on cli and mcp', function () {
  for (const id of ANTI_VACUITY_IDS) {
    const entry = corpus.entries.find(function (e) { return e.id === id; });
    assert.ok(entry, id + ' must be in the corpus');
    assert.equal(entry.expected_verdict_class, 'block', id + ' must be labeled block');
    const e = findEntry(fullRun.json, id);
    assert.ok(e, id + ' must be in the full run');
    assert.equal(e.cli.class, 'block', id + ' must block on cli');
    assert.equal(e.mcp.class, 'block', id + ' must block on mcp');
  }
});

if (OUTCOME === 'fixed') {
  const gr = require(path.join(REPO, 'lib', 'core', 'gate-relevance.cjs'));
  const target = targetEntry && targetEntry.envelope;
  const humanText = target ? target.transcript[target.transcript.length - 1].message.content : '';
  const reachSubject = target ? target.sidechannel_records[0].subject : '';
  ok('D5a: the target-shaped input reads irrelevant', function () {
    assert.equal(gr.gateTopicallyRelevant(humanText, reachSubject, { gateStale: false }), false);
  });
  ok('D5b: a human on-topic turn overlapping distinguishing reach content stays relevant (357 L4(b) floor)', function () {
    assert.equal(gr.gateTopicallyRelevant('Can we review the sample-project migration checklist now?', 'F.1 engine arm: review the sample-project migration checklist before the next reach.', { gateStale: false }), true);
  });
  ok('D5c: a terse turn against a fresh gate stays relevant (WR-06)', function () {
    assert.equal(gr.gateTopicallyRelevant('option 2 please', 'Pick one:\n[1] Build the plan\n[2] File the evidence', { gateStale: false }), true);
  });
  ok('D5d: a chrome-only overlap reads irrelevant (D-08a)', function () {
    assert.equal(gr.gateTopicallyRelevant('which decision gate fired on the workshop agenda?', '- REACH - decision gate\nChoose next reach:\nbriefing notes', { gateStale: false }), false);
  });
} else {
  ok('D6: no gate runtime file changed since PRE362 (residual)', function () {
    const res = spawnSync('git', ['diff', '--quiet', pre362.pre_362_sha, 'HEAD', '--'].concat(RUNTIME6), { cwd: REPO });
    assert.equal(res.status, 0, 'git diff --quiet ' + pre362.pre_362_sha + ' HEAD -- RUNTIME6 must exit 0; got ' + res.status);
    const drift = changedRuntimeFiles();
    assert.equal(drift.length, 0, 'working-tree bytes differ from PRE362: ' + drift.join(', '));
  });
}

ok('D7a: no spawn attempted a network call', function () {
  assert.equal(networkAttempts, 0, 'NETWORK_ATTEMPT_362 seen in ' + networkAttempts + ' spawn(s)');
});

ok('D7b: no non-comment line under lib/ or hooks/ names the dev-only measurement script', function () {
  const hits = [];
  const exts = ['.cjs', '.js', '.json', '.sh'];
  function walk(dir) {
    let list = [];
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    for (const d of list) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) { if (d.name !== 'node_modules') walk(p); continue; }
      if (exts.indexOf(path.extname(d.name)) === -1) continue;
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const s = lines[i].trim();
        if (s.indexOf('//') === 0 || s.indexOf('#') === 0 || s.indexOf('*') === 0) continue;
        if (lines[i].indexOf('measure-relevance-signals-362') !== -1) hits.push(path.relative(REPO, p) + ':' + (i + 1));
      }
    }
  }
  walk(path.join(REPO, 'lib'));
  walk(path.join(REPO, 'hooks'));
  assert.equal(hits.length, 0, hits.join(', '));
});

cleanup();

ok('D7c: no replay-362-root-* temp dir remains', function () {
  const left = fs.readdirSync(os.tmpdir()).filter(function (n) { return n.indexOf('replay-362-root-') === 0; });
  assert.equal(left.length, 0, left.join(', '));
});

console.log((failures === 0 ? 'PASS' : 'FAIL') + ' test-362-disposition ' + (total - failures) + '/' + total);
process.exit(failures === 0 ? 0 : 1);
