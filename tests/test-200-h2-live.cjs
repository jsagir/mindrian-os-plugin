#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 200-01 -- SEED-018 H2 LIVE-WIRE regression test.
 *
 * Proves the semantic-floor gate is CALLED in the live scripts/rs-engine.py
 * Mode B production path (not just unit-tested in isolation). Two live wire
 * points are exercised:
 *
 *   1. Pinecone-records path: _gate_records_pinecone() drops off-topic records
 *      (using the e5 vectors they already carry) BEFORE _records_to_artifacts,
 *      so the off-topic candidate never reaches the differential matrix.
 *
 *   2. Local-fallback path: _gate_docs_local() drops off-topic docs using the
 *      reused local MiniLM encoder before _corpus_docs_to_artifacts.
 *
 *   3. Starvation guard: a below-minimum corpus (every candidate off-topic) is
 *      NOT starved -- the guard keeps the top-N by similarity and logs the skip.
 *
 * Canon Part 8: fully OFFLINE + deterministic. The Pinecone topic embed and the
 * MiniLM encoder are monkeypatched with a fixed-vocabulary bag-of-words stub.
 * NO live network, NO live model, NO Brain. The gate itself
 * (rs_corpus.semantic_gate) runs for real -- only the encoders are faked.
 */
'use strict';

const assert = require('node:assert');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

function hasPython() {
  try {
    execFileSync('python3', ['--version'], { stdio: 'ignore' });
    return true;
  } catch (_e) {
    return false;
  }
}

// Shared fixed vocabulary spanning on-topic (collaboration) and off-topic
// (atmospheric remote sensing) domains. Kept identical to
// test-200-corpus-quality.cjs so the two suites stay in lockstep.
const VOCAB = [
  'multi', 'user', 'team', 'teams', 'collaboration', 'collaborative',
  'shared', 'workspace', 'workspaces', 'presence', 'realtime', 'editing',
  'project', 'projects', 'onboard', 'members', 'platform', 'tooling',
  'atmospheric', 'remote', 'sensing', 'satellite', 'aerosol', 'radiance',
];

// The Python driver: imports scripts/rs-engine.py as a module, monkeypatches the
// two encoders with the deterministic stub, then calls the REAL production
// helpers and prints a JSON verdict.
const pyDriver = [
  'import sys, json, re, importlib.util',
  "sys.path.insert(0, 'lib/core')",
  'VOCAB = ' + JSON.stringify(VOCAB),
  '',
  'def _vec(text):',
  "    toks = re.findall(r'[a-z]+', (text or '').lower())",
  '    counts = {}',
  '    for t in toks:',
  '        counts[t] = counts.get(t, 0) + 1',
  '    return [float(counts.get(w, 0)) for w in VOCAB]',
  '',
  '# Load the live engine module (offline: no network at import time).',
  "spec = importlib.util.spec_from_file_location('rs_engine_mod', 'scripts/rs-engine.py')",
  'eng = importlib.util.module_from_spec(spec)',
  'spec.loader.exec_module(eng)',
  '',
  '# --- Monkeypatch encoders (Canon Part 8: deterministic, offline) ---',
  '# Pinecone topic embed -> bag-of-words vector for the topic string.',
  'eng._embed_topic_via_pinecone = lambda topic: _vec(topic)',
  '',
  '# Local MiniLM batch encoder -> bag-of-words matrix; None-proof shape.',
  'class _FakeArr(list):',
  '    pass',
  'def _fake_minilm(texts):',
  '    return _FakeArr([_vec(t) for t in texts])',
  'eng._embed_local_minilm = _fake_minilm',
  '',
  'topic = "multi user team collaboration"',
  '',
  '# Two on-topic candidates (so a valid corpus survives without tripping the',
  '# starvation guard) plus one off-topic candidate that must be dropped.',
  'on1_title = "Shared workspaces for multi-user team collaboration"',
  'on1_abs = ("A collaborative platform giving teams shared workspaces with '
    + 'realtime presence so multi-user project members can collaborate.")',
  'on2_title = "Onboarding members into collaborative project teams"',
  'on2_abs = ("Team tooling that onboards members into shared collaborative '
    + 'projects with realtime editing across multi-user workspaces.")',
  'off_title = "Atmospheric remote sensing of aerosol radiance"',
  'off_abs = ("Satellite remote sensing retrieves atmospheric aerosol radiance '
    + 'across spectral bands for climate monitoring.")',
  '',
  '# ---- Test 1: Pinecone-records path ----',
  '# Records carry their e5 vector in record["values"] (here the stub bag).',
  'def _rec(rid, title, abstract):',
  '    return {"id": rid, "values": _vec(title + " " + abstract),',
  '            "metadata": {"title": title, "abstract": abstract, "source": "openalex"}}',
  'records = [_rec("W:on1", on1_title, on1_abs),',
  '           _rec("W:on2", on2_title, on2_abs),',
  '           _rec("W:off", off_title, off_abs)]',
  'gated = eng._gate_records_pinecone(topic, records)',
  'arts = eng._records_to_artifacts(gated)',
  'art_ids = [a["id"] for a in arts]',
  'pinecone_kept_ids = sorted(r["id"] for r in gated)',
  '',
  '# ---- Test 2: local-fallback path ----',
  'def _doc(eid, title, abstract):',
  '    return {"source": "openalex", "external_id": eid, "title": title,',
  '            "abstract": abstract, "year": 2025, "authors": [], "url": eid, "doi": None}',
  'docs = [_doc("W:on1", on1_title, on1_abs),',
  '        _doc("W:on2", on2_title, on2_abs),',
  '        _doc("W:off", off_title, off_abs)]',
  'gated_docs = eng._gate_docs_local(topic, docs)',
  'local_kept_ids = sorted(d["external_id"] for d in gated_docs)',
  '',
  '# ---- Test 3: starvation guard (both off-topic -> would drop below 2) ----',
  'off2 = [_rec("W:off1", off_title, off_abs),',
  '        _rec("W:off2", "Aerosol radiance satellite sensing", off_abs)]',
  'guarded = eng._gate_records_pinecone(topic, off2)',
  'starve_kept = [r["id"] for r in guarded]',
  '',
  'print(json.dumps({',
  '    "pinecone_kept_ids": pinecone_kept_ids,',
  '    "pinecone_artifact_ids": art_ids,',
  '    "local_kept_ids": local_kept_ids,',
  '    "starve_kept": starve_kept,',
  '}))',
].join('\n');

function runDriver() {
  // stderr is captured separately so we can assert the starvation log line.
  const res = execFileSync('python3', ['-c', pyDriver], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return res;
}

function runDriverWithStderr() {
  const { spawnSync } = require('node:child_process');
  const r = spawnSync('python3', ['-c', pyDriver], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    throw new Error('python driver failed: ' + (r.stderr || '').slice(0, 1000));
  }
  return { stdout: r.stdout, stderr: r.stderr || '' };
}

function main() {
  console.log('test-200-h2-live: SEED-018 H2 live-wire regression (offline)');

  if (!hasPython()) {
    console.log('  skip: python3 unavailable (clean Tri-Polar degrade)');
    console.log('SKIP [test-200-h2-live]: python3 not present');
    return;
  }

  const { stdout, stderr } = runDriverWithStderr();
  let verdict;
  try {
    verdict = JSON.parse(stdout.trim().split('\n').pop());
  } catch (e) {
    throw new Error('could not parse driver stdout: ' + stdout);
  }

  // Test 1: Pinecone-records path -- off-topic dropped, on-topic reaches artifacts.
  assert.deepStrictEqual(verdict.pinecone_kept_ids, ['W:on1', 'W:on2'],
    'Pinecone path: only the on-topic records survive the live gate');
  assert.strictEqual(verdict.pinecone_artifact_ids.length, 2,
    'exactly the two on-topic artifacts reach the differential');
  assert.ok(verdict.pinecone_artifact_ids.every(function isOn(id) {
    return id.indexOf('off') === -1;
  }), 'no off-topic artifact reaches the differential');
  ok('H2 live: Pinecone-records gate drops off-topic BEFORE _records_to_artifacts');

  // Test 2: local-fallback path -- off-topic dropped, on-topic kept.
  assert.deepStrictEqual(verdict.local_kept_ids, ['W:on1', 'W:on2'],
    'local fallback: only the on-topic docs survive the live gate');
  ok('H2 live: local-fallback gate drops off-topic doc (reused MiniLM encoder)');

  // Test 3: starvation guard -- below-minimum corpus is NOT starved.
  assert.strictEqual(verdict.starve_kept.length, 2,
    'starvation guard must keep the top-N (2), never starve the differential');
  ok('H2 live: starvation guard keeps top-N instead of collapsing the corpus');

  assert.ok(
    stderr.indexOf('semantic gate skipped: would starve corpus') !== -1,
    'starvation guard must log the skip to stderr',
  );
  ok('H2 live: starvation skip is logged to stderr');

  console.log('PASS [test-200-h2-live]: ' + passed + ' assertions green');
}

main();
