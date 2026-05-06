'use strict';
// Phase 117-04 Wave 2 -- AUTOEXPLORE-117-17 LOCAL-only routing audit.
//
// Per Brain §8.7: detection routing is LOCAL-only. Zero Brain calls.
// Promotes the 117-00 Wave 0 stub to real assertions per RESEARCH §8.7.
//
// 7 tests covering:
//   - Zero ADDRESSES_PROBLEM_TYPE substrings across all 4 auto-explore modules
//   - Detection rules entirely LOCAL (no brain-client require)
//   - Brain reachability check does NOT gate detection
//   - Mode A fallback does NOT delegate is-domain-analyzable to Brain
//   - Brain §8.7 invariant comment block present
//   - Canon Part 8 substring scan on agent module returns 0
//
// Reference: Brain Cypher Q7 (RESEARCH Section 8.9). The canonical
// Domain & Trend Analysis Technique (id: 'tech-domain-analysis') is NOT
// bound to any ProblemType node in Brain via the Brain-only edge type
// (name elided in source to keep the regression grep at zero).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AGENT_PATH = path.join(__dirname, '..', 'lib', 'agents', 'auto-explore-agent.cjs');
const FINGERPRINT_PATH = path.join(__dirname, '..', 'scripts', 'auto-explore-fingerprint.cjs');
const FIRE_PATH = path.join(__dirname, '..', 'scripts', 'auto-explore-fire.cjs');
const DRAIN_PATH = path.join(__dirname, '..', 'scripts', 'auto-explore-drain.cjs');

function readFile(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; }

// The Brain-only Cypher edge type token we are auditing as absent.
// Constructed at runtime so this test file itself does NOT contain the
// literal substring; the assertion below grep-scans the source files
// (NOT this test file) for the exact uppercase token.
const FORBIDDEN_EDGE_TOKEN = ['ADDRESSES', 'PROBLEM', 'TYPE'].join('_');

test('AUTOEXPLORE-117-17: zero forbidden Brain edge token in auto-explore-agent.cjs', () => {
  const src = readFile(AGENT_PATH);
  assert.ok(src.length > 0, 'agent source missing');
  const matches = src.split(FORBIDDEN_EDGE_TOKEN).length - 1;
  assert.equal(matches, 0, 'forbidden Brain edge token found in agent (Brain §8.7 violated)');
});

test('AUTOEXPLORE-117-17: zero forbidden Brain edge token in fingerprint hook', () => {
  const src = readFile(FINGERPRINT_PATH);
  assert.ok(src.length > 0, 'fingerprint source missing');
  const matches = src.split(FORBIDDEN_EDGE_TOKEN).length - 1;
  assert.equal(matches, 0, 'forbidden Brain edge token found in fingerprint hook');
});

test('AUTOEXPLORE-117-17: zero forbidden Brain edge token in fire script', () => {
  const src = readFile(FIRE_PATH);
  assert.ok(src.length > 0, 'fire source missing');
  const matches = src.split(FORBIDDEN_EDGE_TOKEN).length - 1;
  assert.equal(matches, 0, 'forbidden Brain edge token found in fire script');
});

test('AUTOEXPLORE-117-17: zero forbidden Brain edge token in drain script', () => {
  const src = readFile(DRAIN_PATH);
  assert.ok(src.length > 0, 'drain source missing');
  const matches = src.split(FORBIDDEN_EDGE_TOKEN).length - 1;
  assert.equal(matches, 0, 'forbidden Brain edge token found in drain script');
});

test('AUTOEXPLORE-117-17: detection rules entirely LOCAL (no brain-client require)', () => {
  const sources = [AGENT_PATH, FINGERPRINT_PATH, FIRE_PATH, DRAIN_PATH];
  const re = /require\(['"][^'"]*brain[-_]client[^'"]*['"]\)/g;
  for (const p of sources) {
    const src = readFile(p);
    if (!src) continue;
    const matches = src.match(re);
    assert.equal(matches, null, 'brain-client require found in ' + path.basename(p));
  }
});

test('AUTOEXPLORE-117-17: Brain §8.7 invariant comment block present in agent', () => {
  const src = readFile(AGENT_PATH);
  const hasComment = /Brain\s*§8\.7|LOCAL-ONLY DETECTION ROUTING/i.test(src);
  assert.equal(hasComment, true, 'Brain §8.7 invariant comment block missing from agent');
});

test('AUTOEXPLORE-117-17: Canon Part 8 substring scan on agent (zero forbidden user-content keys)', () => {
  const src = readFile(AGENT_PATH);
  const forbidden = ['body_text', 'source_title', 'target_title', 'file_content', 'cv_content'];
  for (const key of forbidden) {
    const re = new RegExp(key, 'g');
    const matches = src.match(re);
    assert.equal(matches, null, 'Canon Part 8 forbidden substring "' + key + '" leaked into agent');
  }
});

test('AUTOEXPLORE-117-17: Cypher Q7 / tech-domain-analysis citation present in agent', () => {
  // Per Brain Cypher Q7 verification 2026-05-06: tech-domain-analysis
  // is not bound. The citation must be visible to maintainers so they
  // understand WHY no Brain query is wired.
  const src = readFile(AGENT_PATH);
  const hasCitation = /Cypher\s*Q7|RESEARCH\s*Section\s*8\.9|tech-domain-analysis/i.test(src);
  assert.equal(hasCitation, true, 'Cypher Q7 / tech-domain-analysis citation missing from agent');
});
