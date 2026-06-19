'use strict';
// Phase 164 Wave 3 -- diagnostic issue-tree engine tests (Tests 1-3, 5 from the
// 164-03-PLAN.md behavior block).
//
// Test 1 (MECE):           validateMECE flags overlap + a <2-branch decomposition;
//                          a clean MECE tree returns zero warnings.
// Test 2 (falsifiability): validateFalsifiability flags a leaf with no test; a
//                          tree where every leaf carries a test returns zero.
// Test 3 (render + det):   renderMarkdown is the only output; building the SAME
//                          tree twice yields byte-identical markdown AND
//                          byte-identical graphEdges (no Math.random, no Date.now
//                          in the build path). The hat-lens disclaimer is NEVER
//                          in renderMarkdown output.
// Test 5 (single call +    build() is one deterministic call returning
//          chokepoint):    {markdown, graphEdges, warnings}; writeIssueTreeEdges
//                          routes through a navigation.writeEdge SPY (no raw SQL,
//                          and the module has no runChain require).
//
// NO em-dashes (CLAUDE.md HARD RULE). Plain node, zero deps.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const ENGINE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'issue-tree.cjs');
const IssueTree = require(ENGINE_PATH);

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-issue-tree-engine');

// A clean MECE + falsifiable tree (every leaf carries an elimination test, no
// sibling keyword overlap, >= 2 branches per level).
function cleanTree() {
  return {
    keyQuestion: 'early-stage deep-tech founders churn after the first call',
    branches: [
      {
        label: 'The first call targets the wrong job-to-be-done',
        branches: [
          { label: 'They expect problem-framing, we deliver a fundraising pitch', test: 'Re-run 10 calls leading with framing; measure return rate vs control' },
          { label: 'They want a peer, we present as a vendor', test: 'A/B the relational stance (peer vs service); compare second booking' },
        ],
      },
      {
        label: 'The conversation fails to establish credibility',
        branches: [
          { label: 'No domain-specific proof shown in session', test: 'Insert a deep-tech case artifact; measure trust-survey delta' },
          { label: 'Caller seniority mismatch with the audience', test: 'Match seniority to the audience; compare churn' },
        ],
      },
    ],
  };
}

// ---- Test 1: MECE ----------------------------------------------------------
check('Test 1a: clean MECE tree returns zero MECE warnings', () => {
  const w = IssueTree.validateMECE(cleanTree().branches);
  assert.equal(w.length, 0, 'clean tree should have no MECE warnings, got: ' + JSON.stringify(w));
});

check('Test 1b: a <2-branch decomposition is flagged', () => {
  const w = IssueTree.validateMECE([{ label: 'Only one cause' }]);
  assert.ok(w.some(s => /needs >= 2/.test(s)), 'single-branch level should be flagged, got: ' + JSON.stringify(w));
});

check('Test 1c: overlapping sibling branches are flagged (not mutually exclusive)', () => {
  const w = IssueTree.validateMECE([
    { label: 'Pricing model confuses enterprise buyers' },
    { label: 'Pricing model confuses enterprise procurement' },
  ]);
  assert.ok(w.some(s => /overlap/.test(s)), 'overlapping siblings should be flagged, got: ' + JSON.stringify(w));
});

// ---- Test 2: falsifiability -------------------------------------------------
check('Test 2a: tree where every leaf carries a test returns zero falsifiability warnings', () => {
  const branches = cleanTree().branches;
  const w = branches.flatMap((b, i) => IssueTree.validateFalsifiability(b, `root/${i + 1}`));
  assert.equal(w.length, 0, 'every leaf has a test -> no warnings, got: ' + JSON.stringify(w));
});

check('Test 2b: a leaf with no elimination test is flagged', () => {
  const node = { label: 'The offer is undifferentiated', branches: [{ label: 'Value prop matches accelerators' /* no test */ }] };
  const w = IssueTree.validateFalsifiability(node, 'root/1');
  assert.ok(w.some(s => /no falsification test/.test(s)), 'untested leaf should be flagged, got: ' + JSON.stringify(w));
});

// ---- Test 3: render + determinism ------------------------------------------
check('Test 3a: renderMarkdown produces a markdown tree headed by the why-question', () => {
  const md = IssueTree.renderMarkdown(cleanTree());
  assert.ok(md.startsWith('# Why'), 'markdown should start with the normalized why-question, got: ' + md.slice(0, 40));
  assert.ok(/- The first call targets the wrong job-to-be-done/.test(md), 'branch labels render as list items');
  assert.ok(/\*Test: /.test(md), 'leaf tests render as italic Test lines');
});

check('Test 3b: building the SAME tree twice yields byte-identical markdown AND byte-identical graphEdges', () => {
  const a = IssueTree.build(cleanTree());
  const b = IssueTree.build(cleanTree());
  assert.equal(a.markdown, b.markdown, 'markdown must be byte-identical across builds (determinism)');
  assert.equal(JSON.stringify(a.graphEdges), JSON.stringify(b.graphEdges), 'graphEdges must be byte-identical across builds (determinism)');
});

check('Test 3c: the build path makes no Math.random() and no Date.now() CALL (source assertion, comments excluded)', () => {
  const src = fs.readFileSync(ENGINE_PATH, 'utf8');
  // Strip line comments + block comments so the no-Date.now/no-Math.random
  // rationale prose in the header does not trip the call detector.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, ''))
    .join('\n');
  assert.ok(!/Math\.random\s*\(/.test(code), 'engine code must not call Math.random()');
  assert.ok(!/Date\.now\s*\(/.test(code), 'engine code must not call Date.now() in the build path');
});

check('Test 3d: the hat-lens disclaimer is NEVER in renderMarkdown output', () => {
  // Force a tree whose label text could collide; the disclaimer must not appear.
  const md = IssueTree.renderMarkdown(cleanTree());
  assert.ok(!md.includes(IssueTree.HAT_LENS_DISCLAIMER), 'disclaimer string must not be in the tree output');
  assert.ok(!/perspective lens/i.test(md), 'no perspective-lens text in the tree output');
  assert.ok(!/not expert advice/i.test(md), 'no not-expert-advice text in the tree output');
});

// ---- Test 5: single call + chokepoint --------------------------------------
check('Test 5a: build is one deterministic call returning {markdown, graphEdges, warnings}', () => {
  const r = IssueTree.build(cleanTree());
  assert.equal(typeof r.markdown, 'string', 'build returns markdown');
  assert.ok(Array.isArray(r.graphEdges), 'build returns graphEdges array');
  assert.ok(Array.isArray(r.warnings), 'build returns warnings array');
  assert.equal(r.warnings.length, 0, 'clean tree has no warnings');
});

check('Test 5b: writeIssueTreeEdges routes EVERY edge through a navigation.writeEdge spy (no raw SQL)', () => {
  const r = IssueTree.build({
    keyQuestion: 'why did the pilot stall',
    branches: [
      { label: 'Integration cost too steep', status: 'confirmed' /* leaf */ },
      { label: 'Stakeholder buy-in never secured', status: 'invalidated', test: 'check sign-off log' },
    ],
  });
  const calls = [];
  const spyNavigation = {
    writeEdge: (db, params) => {
      calls.push({ db, params });
      return { ok: true, edge_id: 'edge:spy', type: params.edge_type, source: params.source_id, target: params.target_id };
    },
  };
  const sentinelDb = { __sentinel: true };
  const out = IssueTree.writeIssueTreeEdges(spyNavigation, sentinelDb, r.graphEdges);
  assert.equal(out.rejected, 0, 'no edge rejected by the chokepoint');
  assert.equal(out.written, r.graphEdges.length, 'every emitted edge was written through the spy');
  assert.equal(calls.length, r.graphEdges.length, 'the spy received one call per edge');
  // The caller-owned db handle is threaded unchanged (no internal open).
  assert.ok(calls.every(c => c.db === sentinelDb), 'the caller-owned db handle is passed through unchanged');
  // Every write carries the proposed review_status (Part 9: human confirms).
  assert.ok(calls.every(c => c.params.properties.review_status === 'proposed'), 'edges land proposed (Part 9 role 5)');
});

check('Test 5c: the engine module has NO runChain require and no raw SQLite (deterministic build, not a debate)', () => {
  const src = fs.readFileSync(ENGINE_PATH, 'utf8');
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, ''))
    .join('\n');
  assert.ok(!/require\([^)]*runChain[^)]*\)/.test(code), 'engine must not require runChain');
  assert.ok(!/runChain\s*\(/.test(code), 'engine must not call runChain');
  assert.ok(!/require\([^)]*node:sqlite[^)]*\)/.test(code), 'engine must not open raw SQLite (writes route via the chokepoint)');
});

console.log(`\ntest-issue-tree-engine: ${pass} checks passed`);
