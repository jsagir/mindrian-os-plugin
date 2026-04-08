#!/usr/bin/env node
/**
 * test_interpret_whitespace.cjs -- Unit tests for interpret-whitespace.cjs
 * =========================================================================
 * Tests classifyZone, selectFrameworkChain, buildProblemTypeMap,
 * buildFeedsIntoMap, and interpretWhitespace with mock Brain data.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Module under test
const SCRIPT_PATH = path.resolve(__dirname, '..', 'scripts', 'interpret-whitespace.cjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(`        ${e.message}`);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(`        ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Load module
// ---------------------------------------------------------------------------

const mod = require(SCRIPT_PATH);
const {
  classifyZone,
  selectFrameworkChain,
  buildProblemTypeMap,
  buildFeedsIntoMap,
  interpretWhitespace,
} = mod;

// ---------------------------------------------------------------------------
// Mock data matching Brain schema
// ---------------------------------------------------------------------------

// ADDRESSES_PROBLEM_TYPE query results
const mockProblemTypeRecords = [
  { framework: 'JTBD', problem_type: 'Ill-Defined', effectiveness: 0.95 },
  { framework: 'Design Thinking', problem_type: 'Ill-Defined', effectiveness: 0.90 },
  { framework: 'MECE', problem_type: 'Well-Defined', effectiveness: 0.95 },
  { framework: 'Pyramid Principle', problem_type: 'Well-Defined', effectiveness: 0.88 },
  { framework: 'Systems Thinking', problem_type: 'Wicked', effectiveness: 0.95 },
  { framework: 'Causal Loop Diagrams', problem_type: 'Wicked', effectiveness: 0.80 },
  { framework: 'Beautiful Questions', problem_type: 'Un-Defined', effectiveness: 0.95 },
  { framework: 'Domain Selection', problem_type: 'Un-Defined', effectiveness: 0.85 },
  { framework: 'Weak Framework', problem_type: 'Ill-Defined', effectiveness: 0.45 },
];

// FEEDS_INTO query results
const mockFeedsIntoRecords = [
  { source: 'JTBD', target: 'Process Mapping', confidence: 0.85, transform: 'Jobs to processes' },
  { source: 'Process Mapping', target: 'Reverse Salients', confidence: 0.80, transform: 'Processes to bottlenecks' },
  { source: 'Systems Thinking', target: 'Causal Loop Diagrams', confidence: 0.90, transform: 'Systems to causal loops' },
  { source: 'Causal Loop Diagrams', target: 'Root Cause Analysis', confidence: 0.85, transform: 'Loops to root causes' },
  { source: 'Root Cause Analysis', target: 'Solution Design', confidence: 0.70, transform: 'Causes to solutions' },
  { source: 'Beautiful Questions', target: 'Hypothesis-Driven Problem Solving', confidence: 0.88, transform: 'Questions to hypotheses' },
  { source: 'MECE', target: 'Pyramid Principle', confidence: 0.92, transform: 'Structure to presentation' },
  { source: 'Pyramid Principle', target: 'Stakeholder Analysis', confidence: 0.75, transform: 'Presentation to audience' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('Test: buildProblemTypeMap');
console.log('');

test('buildProblemTypeMap creates lookup from Brain records', () => {
  const map = buildProblemTypeMap(mockProblemTypeRecords);
  assert.ok(map['JTBD'], 'Should have JTBD entry');
  assert.strictEqual(map['JTBD'].problem_type, 'Ill-Defined');
  assert.strictEqual(map['JTBD'].effectiveness, 0.95);
  assert.ok(map['Systems Thinking'], 'Should have Systems Thinking entry');
  assert.strictEqual(map['Systems Thinking'].problem_type, 'Wicked');
});

test('buildProblemTypeMap handles empty input', () => {
  const map = buildProblemTypeMap([]);
  assert.deepStrictEqual(map, {});
});

console.log('');
console.log('Test: buildFeedsIntoMap');
console.log('');

test('buildFeedsIntoMap creates adjacency list from Brain records', () => {
  const map = buildFeedsIntoMap(mockFeedsIntoRecords);
  assert.ok(Array.isArray(map['JTBD']), 'Should have JTBD edges');
  assert.strictEqual(map['JTBD'].length, 1);
  assert.strictEqual(map['JTBD'][0].target, 'Process Mapping');
  assert.strictEqual(map['JTBD'][0].confidence, 0.85);
});

test('buildFeedsIntoMap handles empty input', () => {
  const map = buildFeedsIntoMap([]);
  assert.deepStrictEqual(map, {});
});

console.log('');
console.log('Test: classifyZone');
console.log('');

const ptMap = buildProblemTypeMap(mockProblemTypeRecords);

test('Test 1: classifyZone returns Ill-Defined when nearest framework is JTBD with effectiveness 0.95', () => {
  const result = classifyZone('JTBD', ptMap);
  assert.strictEqual(result.problem_type, 'Ill-Defined');
  assert.ok(result.confidence >= 0.6, 'Confidence should be >= 0.6');
  assert.ok(Array.isArray(result.voting_frameworks), 'Should have voting_frameworks array');
});

test('Test 2: classifyZone returns Un-Defined when no framework has confidence >= 0.6', () => {
  const result = classifyZone('Weak Framework', ptMap);
  assert.strictEqual(result.problem_type, 'Un-Defined', 'Below 0.6 effectiveness should be Un-Defined');
});

test('Test 3: classifyZone returns Un-Defined for unknown framework', () => {
  const result = classifyZone('Completely Unknown Framework', ptMap);
  assert.strictEqual(result.problem_type, 'Un-Defined');
  assert.strictEqual(result.confidence, 0);
});

test('Test 3b: classifyZone uses weighted vote when multiple frameworks within cosine threshold', () => {
  // Both JTBD (0.95) and Design Thinking (0.90) are Ill-Defined
  // When a zone has multiple votes, highest total effectiveness wins
  const multiMap = buildProblemTypeMap(mockProblemTypeRecords);
  const result = classifyZone('JTBD', multiMap);
  assert.strictEqual(result.problem_type, 'Ill-Defined');
  assert.ok(result.confidence >= 0.6);
});

console.log('');
console.log('Test: selectFrameworkChain');
console.log('');

const fiMap = buildFeedsIntoMap(mockFeedsIntoRecords);

test('Test 4: selectFrameworkChain returns array of max 3 frameworks', () => {
  const chain = selectFrameworkChain('Wicked', 'Systems Thinking', fiMap, ptMap);
  assert.ok(Array.isArray(chain), 'Should return array');
  assert.ok(chain.length <= 3, `Chain length ${chain.length} should be <= 3`);
  assert.ok(chain.length >= 1, 'Chain should have at least 1 framework');
});

test('Test 5: selectFrameworkChain starts with highest ADDRESSES_PROBLEM_TYPE effectiveness framework', () => {
  // For Wicked: Systems Thinking has 0.95, Causal Loop Diagrams has 0.80
  // So chain should start with Systems Thinking
  const chain = selectFrameworkChain('Wicked', 'Systems Thinking', fiMap, ptMap);
  assert.strictEqual(chain[0], 'Systems Thinking', 'Should start with highest effectiveness framework');
});

test('selectFrameworkChain traverses FEEDS_INTO edges', () => {
  const chain = selectFrameworkChain('Wicked', 'Systems Thinking', fiMap, ptMap);
  // Systems Thinking -> Causal Loop Diagrams -> Root Cause Analysis
  assert.ok(chain.includes('Causal Loop Diagrams'), 'Should include Causal Loop Diagrams');
});

test('selectFrameworkChain handles missing FEEDS_INTO edges', () => {
  const chain = selectFrameworkChain('Un-Defined', 'Beautiful Questions', fiMap, ptMap);
  assert.ok(Array.isArray(chain), 'Should return array');
  assert.ok(chain.length >= 1, 'Should have at least the start framework');
  assert.strictEqual(chain[0], 'Beautiful Questions');
});

test('selectFrameworkChain respects max depth 3', () => {
  // Root Cause Analysis -> Solution Design is depth 4 from Systems Thinking
  // Systems Thinking -> Causal Loop Diagrams -> Root Cause Analysis (depth 3)
  const chain = selectFrameworkChain('Wicked', 'Systems Thinking', fiMap, ptMap);
  assert.ok(chain.length <= 3, `Chain length ${chain.length} should be capped at 3`);
});

console.log('');
console.log('Test: interpretWhitespace (integration)');
console.log('');

// Create temporary room for integration test
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'interp-test-'));
const roomDir = path.join(tmpDir, 'room');

function setupMockRoom() {
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });

  const mockWhitespaceResults = {
    metadata: {
      timestamp: '2026-04-08T00:00:00Z',
      room_artifact_count: 3,
      brain_baseline_count: 8,
    },
    gaps: [
      {
        brain_framework: 'JTBD',
        density_score: -5.23,
        knn_density: 0.015,
        nearest_room_artifacts: [
          { artifact_id: 'problem-definition/pain-points.md', title: 'Pain Points' },
        ],
        hypothesis: "Room has not explored topics related to 'JTBD'",
        strategic_rank: 0.85,
        problem_type: '',
      },
      {
        brain_framework: 'Systems Thinking',
        density_score: -4.11,
        knn_density: 0.022,
        nearest_room_artifacts: [],
        hypothesis: "Room has not explored topics related to 'Systems Thinking'",
        strategic_rank: 0.65,
        problem_type: '',
      },
      {
        brain_framework: 'Completely Unknown',
        density_score: -3.50,
        knn_density: 0.030,
        nearest_room_artifacts: [],
        hypothesis: "Room has not explored topics related to 'Completely Unknown'",
        strategic_rank: 0.40,
        problem_type: '',
      },
    ],
    novelty_scores: [],
    umap_2d: {},
  };

  fs.writeFileSync(
    path.join(roomDir, '.mindrian', 'whitespace-results.json'),
    JSON.stringify(mockWhitespaceResults, null, 2),
    'utf-8'
  );
}

function cleanup() {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// Gate validation tests
// ---------------------------------------------------------------------------

// Mock UMAP data for anchor gate tests
const mockUmap2d = {
  room_artifacts: [
    // Cluster A: tightly packed around (1, 1)
    { id: 'art-a1', x: 1.0, y: 1.0, cluster: 'A' },
    { id: 'art-a2', x: 1.1, y: 1.1, cluster: 'A' },
    { id: 'art-a3', x: 0.9, y: 0.95, cluster: 'A' },
    // Cluster B: tightly packed around (5, 5)
    { id: 'art-b1', x: 5.0, y: 5.0, cluster: 'B' },
    { id: 'art-b2', x: 5.1, y: 5.1, cluster: 'B' },
    { id: 'art-b3', x: 4.9, y: 4.95, cluster: 'B' },
  ],
};

// Import new gate + hypothesis functions
const {
  anchorGate,
  brainConsensusGate,
  semanticCoherenceGate,
  validateZone,
  buildHypothesisPrompt,
} = mod;

console.log('');
console.log('Test: anchorGate');
console.log('');

test('anchorGate rejects gaps at periphery (nearest artifacts from single cluster)', () => {
  // Gap at (10, 10) - far from everything, nearest artifacts all from cluster A
  const peripheralGap = {
    brain_framework: 'JTBD',
    nearest_room_artifacts: ['art-a1', 'art-a2', 'art-a3'],
  };
  const result = anchorGate(peripheralGap, 0, mockUmap2d);
  assert.strictEqual(result.passed, false, 'Should reject peripheral gap');
  assert.ok(result.reason.length > 0, 'Should provide rejection reason');
});

test('anchorGate passes gaps between 2+ distinct artifact clusters', () => {
  // Gap between clusters A and B, nearest artifacts from both
  const interpolationGap = {
    brain_framework: 'Design Thinking',
    nearest_room_artifacts: ['art-a1', 'art-a2', 'art-b1', 'art-b2'],
  };
  const result = anchorGate(interpolationGap, 0, mockUmap2d);
  assert.strictEqual(result.passed, true, 'Should pass interpolation gap');
});

console.log('');
console.log('Test: brainConsensusGate');
console.log('');

const brainFrameworkNames = ['JTBD', 'Design Thinking', 'Systems Thinking', 'MECE', 'Beautiful Questions'];

test('brainConsensusGate rejects gaps where Brain has no framework nearby', () => {
  const gap = { brain_framework: 'Nonexistent Framework XYZ' };
  const result = brainConsensusGate(gap, brainFrameworkNames);
  assert.strictEqual(result.passed, false, 'Should reject unknown framework');
});

test('brainConsensusGate passes gaps where Brain framework maps to region', () => {
  const gap = { brain_framework: 'JTBD' };
  const result = brainConsensusGate(gap, brainFrameworkNames);
  assert.strictEqual(result.passed, true, 'Should pass known framework');
});

console.log('');
console.log('Test: semanticCoherenceGate');
console.log('');

test('semanticCoherenceGate is placeholder that always passes', () => {
  const gap = { brain_framework: 'Whatever' };
  const result = semanticCoherenceGate(gap);
  assert.strictEqual(result.passed, true, 'Placeholder should always pass');
  assert.ok(result.reason.includes('deferred'), 'Should mention deferred');
});

console.log('');
console.log('Test: validateZone');
console.log('');

test('validateZone returns valid when Anchor + Brain gates pass', () => {
  const gap = {
    brain_framework: 'JTBD',
    nearest_room_artifacts: ['art-a1', 'art-b1', 'art-a2', 'art-b2'],
  };
  const result = validateZone(gap, 0, mockUmap2d, brainFrameworkNames);
  assert.strictEqual(result.valid, true, 'Should be valid');
  assert.ok(result.gates_passed.includes('anchor'), 'Should pass anchor gate');
  assert.ok(result.gates_passed.includes('brain_consensus'), 'Should pass brain consensus gate');
  assert.ok(result.gates_passed.includes('semantic_coherence'), 'Should pass semantic coherence gate');
});

test('validateZone returns invalid when Brain gate fails', () => {
  const gap = {
    brain_framework: 'Nonexistent Framework',
    nearest_room_artifacts: ['art-a1', 'art-b1'],
  };
  const result = validateZone(gap, 0, mockUmap2d, brainFrameworkNames);
  assert.strictEqual(result.valid, false, 'Should be invalid');
  assert.ok(result.gates_failed.includes('brain_consensus'), 'Should fail brain consensus');
});

test('validateZone returns invalid when Anchor gate fails', () => {
  const gap = {
    brain_framework: 'JTBD',
    nearest_room_artifacts: ['art-a1', 'art-a2', 'art-a3'],
  };
  const result = validateZone(gap, 0, mockUmap2d, brainFrameworkNames);
  assert.strictEqual(result.valid, false, 'Should be invalid when anchor fails');
  assert.ok(result.gates_failed.includes('anchor'), 'Should fail anchor gate');
});

// ---------------------------------------------------------------------------
// Hypothesis Prompt Builder tests
// ---------------------------------------------------------------------------

console.log('');
console.log('Test: buildHypothesisPrompt');
console.log('');

test('buildHypothesisPrompt produces structured prompt with zone context', () => {
  const gap = {
    brain_framework: 'JTBD',
    problem_type: 'Ill-Defined',
    framework_chain: ['JTBD', 'Process Mapping', 'Reverse Salients'],
    density_score: -5.23,
    validated: true,
  };
  const artifacts = [{ title: 'Pain Points', id: 'problem-definition/pain-points.md', section: 'problem-definition' }];
  const descriptions = { 'JTBD': 'Jobs-to-be-Done framework for understanding customer needs' };

  const prompt = buildHypothesisPrompt(gap, artifacts, descriptions);
  assert.ok(typeof prompt === 'string', 'Should return a string');
  assert.ok(prompt.includes('Ill-Defined'), 'Should include problem type');
  assert.ok(prompt.includes('JTBD'), 'Should include framework name');
  assert.ok(prompt.includes('Process Mapping'), 'Should include chain frameworks');
  assert.ok(prompt.includes('Pain Points'), 'Should include nearest artifact');
  assert.ok(prompt.includes("What's missing"), 'Should include 3-part format instruction');
  assert.ok(prompt.includes('Framework-driven question'), 'Should include framework question instruction');
  assert.ok(prompt.includes('Suggested next action'), 'Should include action instruction');
});

test('buildHypothesisPrompt includes framework-specific question for Wicked type', () => {
  const gap = {
    brain_framework: 'Systems Thinking',
    problem_type: 'Wicked',
    framework_chain: ['Systems Thinking', 'Causal Loop Diagrams'],
    density_score: -4.0,
    validated: true,
  };
  const prompt = buildHypothesisPrompt(gap, [], {});
  assert.ok(prompt.includes('feedback loops'), 'Wicked type should ask about feedback loops');
});

test('buildHypothesisPrompt handles missing data gracefully', () => {
  const gap = { brain_framework: '', problem_type: '', framework_chain: [], density_score: 0 };
  const prompt = buildHypothesisPrompt(gap, [], {});
  assert.ok(typeof prompt === 'string', 'Should still return a string');
  assert.ok(prompt.length > 100, 'Should produce a non-trivial prompt');
});

// Run async integration tests
(async () => {
  try {
    setupMockRoom();

    // Test 6: interpretWhitespace reads and enriches gaps
    await asyncTest('Test 6: interpretWhitespace reads whitespace-results.json and enriches gaps', async () => {
      // Use fallback mode (no Brain) for deterministic test
      const result = await interpretWhitespace(roomDir);
      assert.ok(result, 'Should return a result');
      assert.ok(Array.isArray(result.gaps), 'Should have gaps array');
      assert.ok(result.gaps.length > 0, 'Should have gaps');
      // Each gap should have problem_type and framework_chain
      for (const gap of result.gaps) {
        assert.ok(gap.problem_type, `Gap ${gap.brain_framework} should have problem_type`);
        assert.ok(Array.isArray(gap.framework_chain), `Gap ${gap.brain_framework} should have framework_chain array`);
      }
    });

    // Test 7: When Brain is unavailable, all zones get Un-Defined
    await asyncTest('Test 7: Brain unavailable fallback -- all zones Un-Defined', async () => {
      // interpretWhitespace without Brain should fallback
      const result = await interpretWhitespace(roomDir);
      assert.ok(result, 'Should return a result');
      // Without Brain, all should be Un-Defined
      for (const gap of result.gaps) {
        assert.strictEqual(gap.problem_type, 'Un-Defined', `Gap ${gap.brain_framework} should be Un-Defined in fallback`);
        assert.ok(gap.framework_chain.includes('Beautiful Questions'), 'Fallback chain should include Beautiful Questions');
      }
    });

    // Test 8: Output JSON written to interpretation-results.json
    await asyncTest('Test 8: Output written to interpretation-results.json', async () => {
      await interpretWhitespace(roomDir);
      const outPath = path.join(roomDir, '.mindrian', 'interpretation-results.json');
      assert.ok(fs.existsSync(outPath), 'interpretation-results.json should be written');
      const data = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
      assert.ok(Array.isArray(data.gaps), 'Output should have gaps array');
      assert.ok(data.metadata, 'Output should have metadata');
    });

    // Summary
    console.log('');
    console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (e) {
    console.error('Test execution error:', e.message);
    process.exit(1);
  } finally {
    cleanup();
  }
})();
