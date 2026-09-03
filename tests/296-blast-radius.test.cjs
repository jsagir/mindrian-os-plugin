'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/296-blast-radius.test.cjs -- the zero-key end-to-end proof plus the
 * auto-explore-fire.cjs argv contract fence (Phase 296 Plan 05, RSLOCAL-01/
 * 03/04).
 *
 * 296-RESEARCH.md finding F-8 named scripts/auto-explore-fire.cjs as a live
 * Python hybrid-mode caller that bypasses lib/core/rs-backend-dispatch.cjs
 * (the Phase 272-10 chokepoint). This plan's own <planner_decision> block
 * NAMES that leftover and fences it, deliberately WITHOUT completing the
 * 272-10 wiring here (that would land hybrid mode on rs-engine.cjs, which
 * only implements Mode A internal today). Pitfall 5 notes the real risk:
 * this spawn's failure is swallowed into markFailed(..., 'all_pipelines_
 * empty') telemetry, so a break shows up as a slow drift in
 * auto_explore_skipped rather than an error. Test 1 below is the fence
 * against that silent drift.
 *
 * Tests:
 *   1. argv contract: every flag scripts/auto-explore-fire.cjs's python3
 *      spawn passes (--mode, hybrid, --room, --topk) is still accepted by
 *      scripts/rs-engine.py's argparse (via --help), and hybrid is still
 *      among --mode's enumerated choices when the help text lists them.
 *   2. the leftover is named in source: scripts/auto-explore-fire.cjs
 *      contains at least one reference to 'rs-backend-dispatch' and at
 *      least one to '272-10'.
 *   3. no new chokepoint bypass: comment-stripped lib/core/intelligence-
 *      cascade.cjs and lib/core/futures/orchestrator.cjs both still
 *      require rs-backend-dispatch.cjs (Phase 296 did not detach either of
 *      the two callers that already route correctly).
 *   4. zero-key Mode B end to end: drives lib/core/rs_cache.py's cache
 *      layer directly (upsert_corpus -> fetch_all_from_namespace) against a
 *      temp room, MINDRIAN_RS_BRIDGE pointed at the deterministic stub
 *      bridge, PINECONE_API_KEY unset. Never invokes the real fetcher
 *      (lib/core/rs_corpus.py makes live OpenAlex/arXiv/Tavily calls) --
 *      this suite stays offline and under the 15-second budget by scoping
 *      to the cache layer only, the same choice tests/296-signal-corpus-
 *      local.test.cjs (Plan 296-04) already made.
 *   5. no key required anywhere on the RS signal path: comment-stripped
 *      scripts/rs-engine.py, lib/core/rs_hybrid.py and lib/core/rs_cache.py
 *      together contain zero occurrences of PINECONE_API_KEY.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const AUTO_EXPLORE_FIRE = path.join(REPO_ROOT, 'scripts', 'auto-explore-fire.cjs');
const RS_ENGINE_PY = path.join(REPO_ROOT, 'scripts', 'rs-engine.py');
const RS_HYBRID_PY = path.join(REPO_ROOT, 'lib', 'core', 'rs_hybrid.py');
const RS_CACHE_PY = path.join(REPO_ROOT, 'lib', 'core', 'rs_cache.py');
const INTELLIGENCE_CASCADE = path.join(REPO_ROOT, 'lib', 'core', 'intelligence-cascade.cjs');
const FUTURES_ORCHESTRATOR = path.join(REPO_ROOT, 'lib', 'core', 'futures', 'orchestrator.cjs');
const STUB_BRIDGE = path.join(__dirname, 'fixtures', '296', 'stub-embed-bridge.cjs');

// ---------------------------------------------------------------------------
// Helpers (mirrors tests/296-no-pinecone-internal.test.cjs and
// tests/296-signal-corpus-local.test.cjs -- no shared helper module in this
// suite family, each test file stays self-contained).
// ---------------------------------------------------------------------------

// stripPyComments: drop lines whose trimmed form starts with '#'.
function stripPyComments(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

// stripJsCommentLines: drop lines whose trimmed form starts with '//', '*'
// or '/*'. Whole-line comment removal only, matching this repo's existing
// convention (tests/296-dim-invariant.sh's bash equivalent, tests/296-no-
// pinecone-internal.test.cjs's identical JS helper).
function stripJsCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    })
    .join('\n');
}

function countOccurrences(haystack, needle) {
  if (needle === '') return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

const createdRooms = [];
function makeRoomDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p296-blast-radius-'));
  createdRooms.push(dir);
  return dir;
}

test.after(() => {
  for (const dir of createdRooms) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_e) { /* best-effort cleanup */ }
  }
});

// ---------------------------------------------------------------------------
// Test 1: argv contract between auto-explore-fire.cjs and rs-engine.py
// ---------------------------------------------------------------------------
test('296-blast-radius Test 1: auto-explore-fire.cjs argv contract with rs-engine.py --help', () => {
  const source = fs.readFileSync(AUTO_EXPLORE_FIRE, 'utf8');
  const spawnMatch = source.match(/spawnAsync\('python3',\s*\[([^\]]+)\]/);
  assert.ok(spawnMatch, 'could not find the python3 spawnAsync call in scripts/auto-explore-fire.cjs');

  // Extract every single-quoted literal token from the argv array literal.
  const tokens = Array.from(spawnMatch[1].matchAll(/'([^']*)'/g)).map((m) => m[1]);
  for (const flag of ['--mode', 'hybrid', '--room', '--topk']) {
    assert.ok(
      tokens.includes(flag),
      `scripts/auto-explore-fire.cjs's python3 spawn argv is missing literal token ${JSON.stringify(flag)} (found: ${JSON.stringify(tokens)})`,
    );
  }

  const helpResult = spawnSync('python3', [RS_ENGINE_PY, '--help'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { PYTHONPATH: REPO_ROOT }),
    cwd: REPO_ROOT,
  });
  assert.equal(
    helpResult.status,
    0,
    `python3 scripts/rs-engine.py --help exited ${helpResult.status}\nstderr: ${helpResult.stderr}`,
  );
  const helpText = String(helpResult.stdout || '') + String(helpResult.stderr || '');
  for (const flag of ['--mode', '--room', '--topk']) {
    assert.ok(helpText.includes(flag), `rs-engine.py --help does not name ${flag}`);
  }

  // If the help text enumerates --mode's choices (argparse's default
  // {choice1,choice2,...} rendering), hybrid must be among them.
  const choicesMatch = helpText.match(/--mode\s*\{([^}]+)\}/);
  if (choicesMatch) {
    const choices = choicesMatch[1].split(',');
    assert.ok(
      choices.includes('hybrid'),
      `rs-engine.py --help enumerates --mode choices without 'hybrid': ${choicesMatch[1]}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 2: the leftover is named in source
// ---------------------------------------------------------------------------
test('296-blast-radius Test 2: auto-explore-fire.cjs names the leftover in source', () => {
  const source = fs.readFileSync(AUTO_EXPLORE_FIRE, 'utf8');
  assert.ok(
    countOccurrences(source, 'rs-backend-dispatch') >= 1,
    'scripts/auto-explore-fire.cjs does not reference rs-backend-dispatch',
  );
  assert.ok(
    countOccurrences(source, '272-10') >= 1,
    'scripts/auto-explore-fire.cjs does not reference 272-10',
  );
});

// ---------------------------------------------------------------------------
// Test 3: no new chokepoint bypass
// ---------------------------------------------------------------------------
test('296-blast-radius Test 3: intelligence-cascade.cjs and futures/orchestrator.cjs still route through rs-backend-dispatch.cjs', () => {
  const cascadeBody = stripJsCommentLines(fs.readFileSync(INTELLIGENCE_CASCADE, 'utf8'));
  const orchestratorBody = stripJsCommentLines(fs.readFileSync(FUTURES_ORCHESTRATOR, 'utf8'));
  assert.ok(
    /require\(['"][^'"]*rs-backend-dispatch\.cjs['"]\)/.test(cascadeBody),
    'lib/core/intelligence-cascade.cjs no longer requires rs-backend-dispatch.cjs',
  );
  assert.ok(
    /require\(['"][^'"]*rs-backend-dispatch\.cjs['"]\)/.test(orchestratorBody),
    'lib/core/futures/orchestrator.cjs no longer requires rs-backend-dispatch.cjs',
  );
});

// ---------------------------------------------------------------------------
// Test 4: zero-key Mode B end to end (cache layer only, offline)
// ---------------------------------------------------------------------------
test('296-blast-radius Test 4: zero-key upsert -> fetch round-trip through the local signal cache', () => {
  const roomDir = makeRoomDir();

  // Deliberately drives ONLY lib.core.rs_cache's cache layer (upsert_corpus
  // -> fetch_all_from_namespace) via a temp room, never rs_corpus.fetch_corpus
  // (that function makes live OpenAlex/arXiv/Tavily calls). Keeping this
  // suite offline and under the 15-second budget is the same scoping choice
  // tests/296-signal-corpus-local.test.cjs already made for Plan 296-04.
  const script = [
    'import sys, os, json',
    'sys.path.insert(0, os.environ["BLAST_RADIUS_REPO_ROOT"])',
    'from lib.core.rs_cache import upsert_corpus, fetch_all_from_namespace, namespace_slug',
    'room_dir = os.environ["BLAST_RADIUS_ROOM_DIR"]',
    'docs = [',
    '    {"external_id": "doc-1", "source": "test", "title": "Doc One", "abstract": "alpha beta gamma", "doi": None, "year": 2020},',
    '    {"external_id": "doc-2", "source": "test", "title": "Doc Two", "abstract": "delta epsilon zeta", "doi": None, "year": 2021},',
    '    {"external_id": "doc-3", "source": "test", "title": "Doc Three", "abstract": "eta theta iota", "doi": None, "year": 2022},',
    ']',
    'ns = upsert_corpus("blast radius smoke topic", docs, room_dir=room_dir)',
    'records = fetch_all_from_namespace(ns, limit=10, room_dir=room_dir)',
    'print(json.dumps({"count": len(records), "dims": [len(r.get("values") or []) for r in records]}))',
  ].join('\n');

  const env = Object.assign({}, process.env, {
    BLAST_RADIUS_REPO_ROOT: REPO_ROOT,
    BLAST_RADIUS_ROOM_DIR: roomDir,
    MINDRIAN_RS_BRIDGE: STUB_BRIDGE,
    PYTHONPATH: REPO_ROOT,
  });
  delete env.PINECONE_API_KEY;

  const result = spawnSync('python3', ['-c', script], {
    cwd: REPO_ROOT,
    env: env,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(
    result.status,
    0,
    `python3 cache round-trip exited ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (_e) {
    throw new Error(`could not parse stdout as JSON: ${result.stdout}\nstderr: ${result.stderr}`);
  }
  assert.equal(parsed.count, 3, `expected 3 records back, got ${parsed.count}`);
  for (const dim of parsed.dims) {
    assert.equal(dim, 4, `expected the stub bridge's 4-dim vectors, got ${dim}`);
  }
});

// ---------------------------------------------------------------------------
// Test 5: no key required anywhere on the RS signal path
// ---------------------------------------------------------------------------
test('296-blast-radius Test 5: zero PINECONE_API_KEY on the RS signal path', () => {
  const targets = [RS_ENGINE_PY, RS_HYBRID_PY, RS_CACHE_PY];
  for (const t of targets) {
    const stripped = stripPyComments(fs.readFileSync(t, 'utf8'));
    const hits = countOccurrences(stripped, 'PINECONE_API_KEY');
    assert.equal(
      hits,
      0,
      `${path.relative(REPO_ROOT, t)} still references PINECONE_API_KEY outside comments (${hits} hit(s))`,
    );
  }
});
