'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/296-no-pinecone-internal.test.cjs -- regression fence for
 * 296-RESEARCH.md findings F-3 and F-9. GREEN BY DESIGN TODAY: every
 * assertion below is a fact that already holds, before any production file
 * in this phase is touched. It locks two of SEED-030's acceptance items so
 * they cannot silently regress while later plans in this phase (296-04
 * onward) touch adjacent Pinecone surfaces.
 *
 * Pure source-assertion. No subprocess, no ML model load, no room.db.
 *
 * Test 1/2 (F-3): scripts/rs-engine.py's run_mode_internal and
 * run_mode_cross_room already reach zero Pinecone surface -- neither
 * references the local signal-corpus cache module, PINECONE, nor the
 * external rs_cache module by name.
 * Test 3 (F-3, second half): _embed_via_pinecone_inference is still a
 * NotImplementedError stub. If a later change implements it, the internal
 * path gains a live Pinecone reachability edge and this fence must go red --
 * that is the point of asserting the stub, not just the absence of a call
 * site.
 * Test 4: lib/core/rs-engine.cjs (Phase 272's CJS port of Mode A internal)
 * carries zero live Pinecone call surface in its own code. Its header prose
 * documents the 384/1024-dim invariant by NAME-DROPPING "Pinecone" in
 * comments (expected, and stripped before counting), and it legitimately
 * imports the shared cosineSimilarity helper from rs-pinecone-bridge.cjs (a
 * generic math re-export, not a Pinecone SDK call) -- that one require line
 * is exempted BY NAME from this count, mirroring the identical
 * exempt-by-name precedent tests/run-all-296.sh's own Part 8 sweep uses for
 * lib/core/rs_cache.py. Everything else in the comment-stripped file must
 * carry zero "pinecone" (case-insensitive) occurrences.
 * Test 5 (F-9): all four rs-* surfaces are present in
 * data/connector-registry.json in both the /mos: and skill: families --
 * SEED-030 acceptance item 1, held as a regression fence.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const RS_ENGINE_PY = path.join(REPO_ROOT, 'scripts', 'rs-engine.py');
const RS_ENGINE_CJS = path.join(REPO_ROOT, 'lib', 'core', 'rs-engine.cjs');
const CONNECTOR_REGISTRY = path.join(REPO_ROOT, 'data', 'connector-registry.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// stripPyComments: drop lines whose trimmed form starts with '#'. Every
// count in this file runs on the comment-stripped slice, because
// rs-engine.py documents Pinecone in prose inside these functions and a raw
// count would be self-invalidating.
function stripPyComments(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

// stripJsCommentLines: drop lines whose trimmed form starts with '//', '*'
// or '/*'. Does not attempt to strip inline trailing comments -- every call
// site here only needs whole-line comment removal.
function stripJsCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    })
    .join('\n');
}

// sliceFunction(source, defLine): returns the body of a top-level Python
// function. Finds the line starting with defLine, then takes every line up
// to (excluding) the next line matching /^def /.
function sliceFunction(source, defLine) {
  const lines = source.split('\n');
  const startIdx = lines.findIndex((l) => l.startsWith(defLine));
  assert.ok(startIdx !== -1, `def line not found in source: ${defLine}`);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    if (/^def /.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join('\n');
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

const rsEnginePySrc = fs.readFileSync(RS_ENGINE_PY, 'utf8');

// ---------------------------------------------------------------------------
// Test 1: run_mode_internal reaches zero Pinecone surface (F-3)
// ---------------------------------------------------------------------------
test('296 F-3 #1: run_mode_internal references zero Pinecone surface', () => {
  const body = stripPyComments(sliceFunction(rsEnginePySrc, 'def run_mode_internal('));
  for (const token of ['_rs_cache_', 'PINECONE', 'rs_cache']) {
    const hits = countOccurrences(body, token);
    assert.equal(
      hits,
      0,
      `scripts/rs-engine.py::run_mode_internal must reference zero '${token}' (found ${hits})`
    );
  }
});

// ---------------------------------------------------------------------------
// Test 2: run_mode_cross_room reaches zero Pinecone surface (F-3)
// ---------------------------------------------------------------------------
test('296 F-3 #2: run_mode_cross_room references zero Pinecone surface', () => {
  const body = stripPyComments(sliceFunction(rsEnginePySrc, 'def run_mode_cross_room('));
  for (const token of ['_rs_cache_', 'PINECONE', 'rs_cache']) {
    const hits = countOccurrences(body, token);
    assert.equal(
      hits,
      0,
      `scripts/rs-engine.py::run_mode_cross_room must reference zero '${token}' (found ${hits})`
    );
  }
});

// ---------------------------------------------------------------------------
// Test 3: _embed_via_pinecone_inference is still a NotImplementedError stub
// (F-3 second half -- if this ever implements, the internal path gains a
// live Pinecone reachability edge and this fence must go red)
// ---------------------------------------------------------------------------
test('296 F-3 #3: _embed_via_pinecone_inference is still a NotImplementedError stub', () => {
  const body = stripPyComments(sliceFunction(rsEnginePySrc, 'def _embed_via_pinecone_inference('));
  assert.ok(
    body.includes('NotImplementedError'),
    'scripts/rs-engine.py::_embed_via_pinecone_inference must still raise NotImplementedError; ' +
      'if it now returns real vectors, run_mode_internal/cross_room gained a live Pinecone edge'
  );
});

// ---------------------------------------------------------------------------
// Test 4: lib/core/rs-engine.cjs carries zero live Pinecone call surface
// ---------------------------------------------------------------------------
test('296 F-3 #4: lib/core/rs-engine.cjs carries zero live Pinecone call surface', () => {
  const raw = fs.readFileSync(RS_ENGINE_CJS, 'utf8');
  const commentStripped = stripJsCommentLines(raw);
  // Exempt BY NAME the single require of rs-pinecone-bridge.cjs -- a
  // documented, reused, generic-math re-export (cosineSimilarity), not a
  // Pinecone SDK call site. See file header for the precedent this mirrors.
  const withoutBridgeRequire = commentStripped
    .split('\n')
    .filter((line) => !line.includes("require('./rs-pinecone-bridge.cjs')"))
    .join('\n');
  const hits = countOccurrences(withoutBridgeRequire.toLowerCase(), 'pinecone');
  assert.equal(
    hits,
    0,
    `lib/core/rs-engine.cjs must carry zero live 'pinecone' occurrences outside comments and the ` +
      `documented rs-pinecone-bridge.cjs require (found ${hits})`
  );
});

// ---------------------------------------------------------------------------
// Test 5: all four rs-* surfaces appear in connector-registry.json (F-9)
// ---------------------------------------------------------------------------
test('296 F-9 #5: all four rs-* surfaces are registered in both families', () => {
  const registry = JSON.parse(fs.readFileSync(CONNECTOR_REGISTRY, 'utf8'));
  const raw = fs.readFileSync(CONNECTOR_REGISTRY, 'utf8');
  const surfaces = ['rs-experts', 'rs-explain', 'rs-fetch', 'rs-thesis'];
  for (const s of surfaces) {
    assert.ok(
      raw.includes(`"/mos:${s}"`),
      `data/connector-registry.json must register "/mos:${s}"`
    );
    assert.ok(
      raw.includes(`"skill:${s}"`),
      `data/connector-registry.json must register "skill:${s}"`
    );
  }
  assert.ok(registry, 'connector-registry.json must parse as valid JSON');
});
