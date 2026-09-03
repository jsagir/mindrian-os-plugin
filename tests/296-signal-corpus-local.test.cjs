'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/296-signal-corpus-local.test.cjs -- the eight-proof local-signal-
 * corpus test for lib/core/rs_cache.py's per-room sidecar rewrite (Phase
 * 296 Plan 04, RSLOCAL-01/03/04).
 *
 * Drives Python through spawnSync('python3', ['-c', script]) and asserts on
 * parsed JSON printed by the Python side. Every Python invocation sets
 * MINDRIAN_RS_BRIDGE to tests/fixtures/296/stub-embed-bridge.cjs's absolute
 * path (so no real ONNX model ever loads), unsets PINECONE_API_KEY, and
 * sets PYTHONPATH to REPO_ROOT.
 *
 * Tests:
 *   1. Zero Pinecone in source (comment-and-docstring-stripped).
 *   2. Module imports with no key and no SDK-not-installed stderr line.
 *   3. Per-room isolation (closes SEED-029 F8): room A's corpus is invisible
 *      from room B.
 *   4. Round-trip shape: id/values/metadata, dim 4, abstract round-trips,
 *      doi/title/year/source/fetched_at all present.
 *   5. TTL: a 31-day-old manifest reads stale; a 1-day-old one reads fresh.
 *   6. Model invalidation: a manifest naming a different model reads as
 *      None (stale) rather than mixing embedding spaces.
 *   7. No partial writes on embed failure (STUB_296_FAIL): no vectors.jsonl
 *      is created, upsert_corpus still returns the namespace string.
 *   8. Atomicity residue: no .tmp file survives anywhere under any created
 *      room's .rs-signal-cache/ directory.
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
const RS_CACHE_PY = path.join(REPO_ROOT, 'lib', 'core', 'rs_cache.py');
const STUB_BRIDGE = path.join(__dirname, 'fixtures', '296', 'stub-embed-bridge.cjs');

const createdRooms = [];

function makeRoomDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p296-signal-corpus-'));
  createdRooms.push(dir);
  return dir;
}

// baseEnv(extra) -> the env every Python invocation in this file uses.
// MINDRIAN_RS_BRIDGE always points at the stub so no real ONNX model loads.
function baseEnv(extra) {
  const env = { ...process.env, ...(extra || {}) };
  delete env.PINECONE_API_KEY;
  env.MINDRIAN_RS_BRIDGE = STUB_BRIDGE;
  env.PYTHONPATH = REPO_ROOT;
  return env;
}

// runPython(script, extraEnv) -> { status, stdout, stderr }
//
// Spawns python3 -c <script> with cwd=REPO_ROOT. Asserts nothing itself;
// callers inspect status/stdout/stderr.
function runPython(script, extraEnv) {
  const result = spawnSync('python3', ['-c', script], {
    cwd: REPO_ROOT,
    env: baseEnv(extraEnv),
    encoding: 'utf8',
  });
  return result;
}

// runPythonJSON(script, extraEnv) -> parsed JSON from stdout.
// Fails the calling test (via assert) if the process exits non-zero or
// stdout does not parse.
function runPythonJSON(script, extraEnv) {
  const result = runPython(script, extraEnv);
  assert.equal(
    result.status,
    0,
    `python3 exited ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  try {
    return JSON.parse(result.stdout);
  } catch (e) {
    throw new Error(`could not parse stdout as JSON: ${result.stdout}\nstderr: ${result.stderr}`);
  }
}

// stripCommentsAndDocstring(source) -> source with # comments dropped and
// the module docstring (between the first and second triple-quote run)
// sliced out. Mandatory per this plan's action block: the rewritten
// docstring explains the Pinecone retirement and names the retired
// symbols by name, so a raw count would fail on its own documentation.
function stripCommentsAndDocstring(source) {
  const lines = source.split('\n').filter((line) => !/^\s*#/.test(line));
  const withoutComments = lines.join('\n');

  const firstIdx = withoutComments.indexOf('"""');
  if (firstIdx === -1) return withoutComments;
  const secondIdx = withoutComments.indexOf('"""', firstIdx + 3);
  if (secondIdx === -1) return withoutComments;
  return withoutComments.slice(0, firstIdx) + withoutComments.slice(secondIdx + 3);
}

test.after(() => {
  for (const dir of createdRooms) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_e) { /* best-effort cleanup */ }
  }
});

// ---------------------------------------------------------------------------
// Test 1: zero Pinecone in source (comment-and-docstring-stripped)
// ---------------------------------------------------------------------------
test('296-signal-corpus-local: Test 1 zero Pinecone in comment/docstring-stripped source', () => {
  const source = fs.readFileSync(RS_CACHE_PY, 'utf8');
  const stripped = stripCommentsAndDocstring(source);
  const forbidden = [
    'import pinecone',
    'from pinecone',
    'PINECONE_API_KEY',
    'create_index_for_model',
    'upsert_records',
    'api.pinecone.io',
  ];
  for (const token of forbidden) {
    assert.equal(
      stripped.includes(token),
      false,
      `rs_cache.py's comment/docstring-stripped source still contains ${JSON.stringify(token)}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 2: imports with no key and no package-not-installed stderr line
// ---------------------------------------------------------------------------
test('296-signal-corpus-local: Test 2 imports with PINECONE_API_KEY unset, no SDK-missing stderr', () => {
  const result = runPython('import lib.core.rs_cache');
  assert.equal(result.status, 0, `import failed: ${result.stderr}`);
  assert.equal(
    (result.stderr || '').includes('pinecone SDK not installed'),
    false,
    'stderr should not mention the retired pinecone SDK guard',
  );
});

// ---------------------------------------------------------------------------
// Test 3: per-room isolation (closes SEED-029 F8)
// ---------------------------------------------------------------------------
test('296-signal-corpus-local: Test 3 per-room isolation', () => {
  const roomA = makeRoomDir();
  const roomB = makeRoomDir();

  const upsertScript = `
import json
from lib.core.rs_cache import upsert_corpus, namespace_slug
docs = [
    {"external_id": "doi:1", "abstract": "quantum biology paper one", "doi": "10.1/1", "title": "T1", "year": 2020, "source": "openalex"},
    {"external_id": "doi:2", "abstract": "quantum biology paper two", "doi": "10.1/2", "title": "T2", "year": 2021, "source": "arxiv"},
    {"external_id": "doi:3", "abstract": "quantum biology paper three", "doi": "10.1/3", "title": "T3", "year": 2022, "source": "openalex"},
]
ns = upsert_corpus("quantum biology", docs, room_dir=${JSON.stringify(roomA)})
print(json.dumps({"namespace": ns}))
`;
  const upsertResult = runPythonJSON(upsertScript);
  const namespace = upsertResult.namespace;
  assert.equal(namespace, 'external:quantum-biology');

  const fetchBScript = `
import json
from lib.core.rs_cache import fetch_all_from_namespace
recs = fetch_all_from_namespace(${JSON.stringify(namespace)}, room_dir=${JSON.stringify(roomB)})
print(json.dumps({"count": len(recs)}))
`;
  const fetchBResult = runPythonJSON(fetchBScript);
  assert.equal(fetchBResult.count, 0, 'room B must read zero records for a topic cached only in room A');

  const fetchAScript = `
import json
from lib.core.rs_cache import fetch_all_from_namespace
recs = fetch_all_from_namespace(${JSON.stringify(namespace)}, room_dir=${JSON.stringify(roomA)})
print(json.dumps({"count": len(recs)}))
`;
  const fetchAResult = runPythonJSON(fetchAScript);
  assert.equal(fetchAResult.count, 3, 'room A must read all 3 records it cached');

  const sidecarA = path.join(roomA, 'research', 'quantum-biology', '.rs-signal-cache', 'vectors.jsonl');
  const sidecarBDir = path.join(roomB, 'research', 'quantum-biology');
  assert.equal(fs.existsSync(sidecarA), true, `expected sidecar at ${sidecarA}`);
  assert.equal(fs.existsSync(sidecarBDir), false, `room B must have no research/quantum-biology directory at all: ${sidecarBDir}`);
});

// ---------------------------------------------------------------------------
// Test 4: round-trip shape
// ---------------------------------------------------------------------------
test('296-signal-corpus-local: Test 4 round-trip shape', () => {
  const room = makeRoomDir();

  const script = `
import json
from lib.core.rs_cache import upsert_corpus, fetch_all_from_namespace, namespace_slug
docs = [
    {"external_id": "doi:shape-1", "abstract": "a round trip abstract", "doi": "10.9/1", "title": "Shape One", "year": 2023, "source": "tavily"},
]
ns = upsert_corpus("shape topic", docs, room_dir=${JSON.stringify(room)})
recs = fetch_all_from_namespace(ns, room_dir=${JSON.stringify(room)})
print(json.dumps(recs))
`;
  const recs = runPythonJSON(script);
  assert.equal(recs.length, 1);
  const rec = recs[0];

  assert.deepEqual(Object.keys(rec).sort(), ['id', 'metadata', 'values']);
  assert.equal(rec.values.length, 4, 'stub dim is 4');
  assert.equal(rec.metadata.abstract, 'a round trip abstract');
  for (const key of ['doi', 'title', 'year', 'source', 'fetched_at']) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(rec.metadata, key),
      true,
      `metadata missing key ${key}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 5: TTL
// ---------------------------------------------------------------------------
test('296-signal-corpus-local: Test 5 TTL freshness', () => {
  const room = makeRoomDir();

  const setupScript = `
import json
from lib.core.rs_cache import upsert_corpus
docs = [
    {"external_id": "doi:ttl-1", "abstract": "a ttl-probe abstract", "doi": "10.9/2", "title": "TTL One", "year": 2023, "source": "openalex"},
]
ns = upsert_corpus("ttl topic", docs, room_dir=${JSON.stringify(room)})
print(json.dumps({"namespace": ns}))
`;
  const { namespace } = runPythonJSON(setupScript);

  const manifestPath = path.join(room, 'research', 'ttl-topic', '.rs-signal-cache', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, fetched_at: staleDate }));

  const staleScript = `
import json
from lib.core.rs_cache import get_namespace_freshness, is_fresh
age = get_namespace_freshness(${JSON.stringify(namespace)}, room_dir=${JSON.stringify(room)})
print(json.dumps({"fresh": is_fresh(age)}))
`;
  const staleResult = runPythonJSON(staleScript);
  assert.equal(staleResult.fresh, false, '31-day-old manifest must read as stale');

  const freshDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, fetched_at: freshDate }));

  const freshResult = runPythonJSON(staleScript);
  assert.equal(freshResult.fresh, true, '1-day-old manifest must read as fresh');
});

// ---------------------------------------------------------------------------
// Test 6: model invalidation
// ---------------------------------------------------------------------------
test('296-signal-corpus-local: Test 6 model invalidation', () => {
  const room = makeRoomDir();

  const setupScript = `
import json
from lib.core.rs_cache import upsert_corpus
docs = [
    {"external_id": "doi:model-1", "abstract": "a model-invalidation abstract", "doi": "10.9/3", "title": "Model One", "year": 2023, "source": "openalex"},
]
ns = upsert_corpus("model topic", docs, room_dir=${JSON.stringify(room)})
print(json.dumps({"namespace": ns}))
`;
  const { namespace } = runPythonJSON(setupScript);

  const manifestPath = path.join(room, 'research', 'model-topic', '.rs-signal-cache', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.embedding_model, 'stub-296', 'manifest should record the stub model name');

  fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, embedding_model: 'a-different-model-entirely' }));

  const checkScript = `
import json
from lib.core.rs_cache import get_namespace_freshness
age = get_namespace_freshness(${JSON.stringify(namespace)}, room_dir=${JSON.stringify(room)})
print(json.dumps({"age": age}))
`;
  const result = runPythonJSON(checkScript);
  assert.equal(result.age, null, 'a manifest naming a different model must read as None (stale)');
});

// ---------------------------------------------------------------------------
// Test 7: no partial writes on embed failure
// ---------------------------------------------------------------------------
test('296-signal-corpus-local: Test 7 no partial writes on embed failure', () => {
  const room = makeRoomDir();

  const script = `
import json
from lib.core.rs_cache import upsert_corpus
docs = [
    {"external_id": "doi:fail-1", "abstract": "an abstract that never gets embedded", "doi": "10.9/4", "title": "Fail One", "year": 2023, "source": "openalex"},
]
ns = upsert_corpus("fail topic", docs, room_dir=${JSON.stringify(room)})
print(json.dumps({"namespace": ns}))
`;
  const result = runPythonJSON(script, { STUB_296_FAIL: '1' });
  assert.equal(result.namespace, 'external:fail-topic', 'upsert_corpus must still return the namespace, not raise');

  const vectorsPath = path.join(room, 'research', 'fail-topic', '.rs-signal-cache', 'vectors.jsonl');
  assert.equal(fs.existsSync(vectorsPath), false, 'no vectors.jsonl must be created on embed failure');
});

// ---------------------------------------------------------------------------
// Test 8: atomicity residue
// ---------------------------------------------------------------------------
test('296-signal-corpus-local: Test 8 no .tmp residue under any created room', () => {
  for (const room of createdRooms) {
    if (!fs.existsSync(room)) continue;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith('.tmp')) {
          assert.fail(`leftover .tmp file: ${full}`);
        }
      }
    };
    walk(room);
  }
});
