#!/usr/bin/env node
/**
 * test_whitespace_sections.cjs -- Integration test for write-whitespace-sections.cjs
 * ===================================================================================
 * Creates a temporary mock room with whitespace-results.json, runs the script,
 * and verifies WHITESPACE.md files are created with correct content.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'write-whitespace-sections.cjs');

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whitespace-test-'));
const roomDir = path.join(tmpDir, 'room');

function setup() {
  // Create section directories
  fs.mkdirSync(path.join(roomDir, 'problem-definition'), { recursive: true });
  fs.mkdirSync(path.join(roomDir, 'market-analysis'), { recursive: true });
  fs.mkdirSync(path.join(roomDir, 'solution-design'), { recursive: true });
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });

  // Mock whitespace-results.json
  const mockResults = {
    metadata: {
      timestamp: '2026-04-08T00:00:00Z',
      room_artifact_count: 4,
      brain_baseline_count: 10,
      umap_dims: 15,
      kde_bandwidth: 'scott',
      model: 'all-MiniLM-L6-v2',
    },
    gaps: [
      {
        brain_framework: 'Jobs-to-be-Done',
        density_score: -5.23,
        knn_density: 0.015,
        nearest_room_artifacts: [
          { artifact_id: 'problem-definition/pain-points.md', title: 'Pain Points' },
        ],
        hypothesis: "Room has not explored topics related to 'Jobs-to-be-Done'",
        strategic_rank: 0.85,
        problem_type: 'market-fit',
      },
      {
        brain_framework: 'Blue Ocean Strategy',
        density_score: -4.11,
        knn_density: 0.022,
        nearest_room_artifacts: [
          { artifact_id: 'market-analysis/competitors.md', title: 'Competitors' },
          { artifact_id: 'market-analysis/trends.md', title: 'Market Trends' },
        ],
        hypothesis: "Room has not explored topics related to 'Blue Ocean Strategy'",
        strategic_rank: 0.65,
        problem_type: 'strategy',
      },
    ],
    novelty_scores: [
      {
        artifact_id: 'problem-definition/pain-points.md',
        title: 'Pain Points',
        section: 'problem-definition',
        novelty_score: 0.72,
        nearest_brain_framework: 'Jobs-to-be-Done',
      },
      {
        artifact_id: 'problem-definition/stakeholders.md',
        title: 'Stakeholders',
        section: 'problem-definition',
        novelty_score: 0.45,
        nearest_brain_framework: 'Stakeholder Analysis',
      },
      {
        artifact_id: 'market-analysis/competitors.md',
        title: 'Competitors',
        section: 'market-analysis',
        novelty_score: 0.88,
        nearest_brain_framework: 'Blue Ocean Strategy',
      },
      {
        artifact_id: 'market-analysis/trends.md',
        title: 'Market Trends',
        section: 'market-analysis',
        novelty_score: 0.31,
        nearest_brain_framework: 'Trend Analysis',
      },
    ],
  };

  fs.writeFileSync(
    path.join(roomDir, '.mindrian', 'whitespace-results.json'),
    JSON.stringify(mockResults, null, 2),
    'utf-8'
  );
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

function cleanup() {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {
    // best effort
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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

try {
  setup();

  // Run the script
  const output = execSync(`node "${SCRIPT}" "${roomDir}"`, { encoding: 'utf-8' });
  console.log(`Script output: ${output.trim()}`);
  console.log('');

  // -- problem-definition/WHITESPACE.md --
  const pdPath = path.join(roomDir, 'problem-definition', 'WHITESPACE.md');
  const pdContent = fs.readFileSync(pdPath, 'utf-8');

  test('problem-definition/WHITESPACE.md exists', () => {
    assert.ok(fs.existsSync(pdPath), 'WHITESPACE.md should exist');
  });

  test('problem-definition has correct gap (Jobs-to-be-Done)', () => {
    assert.ok(pdContent.includes('Jobs-to-be-Done'), 'Should contain Jobs-to-be-Done gap');
  });

  test('problem-definition has frontmatter with section name', () => {
    assert.ok(pdContent.includes('section: problem-definition'), 'Frontmatter should have section');
  });

  test('problem-definition has frontmatter with gap count', () => {
    assert.ok(pdContent.includes('gaps: 1'), 'Frontmatter should show 1 gap');
  });

  test('problem-definition has Detected Gaps heading', () => {
    assert.ok(pdContent.includes('## Detected Gaps'), 'Should have Detected Gaps heading');
  });

  test('problem-definition has novelty score table', () => {
    assert.ok(pdContent.includes('## Section Novelty Scores'), 'Should have novelty table');
    assert.ok(pdContent.includes('Pain Points'), 'Should list Pain Points artifact');
    assert.ok(pdContent.includes('Stakeholders'), 'Should list Stakeholders artifact');
    assert.ok(pdContent.includes('0.72'), 'Should show novelty score 0.72');
  });

  test('problem-definition has last_updated timestamp', () => {
    assert.ok(pdContent.includes('last_updated: 2026-04-08'), 'Should have timestamp');
  });

  // -- market-analysis/WHITESPACE.md --
  const maPath = path.join(roomDir, 'market-analysis', 'WHITESPACE.md');
  const maContent = fs.readFileSync(maPath, 'utf-8');

  test('market-analysis/WHITESPACE.md exists', () => {
    assert.ok(fs.existsSync(maPath), 'WHITESPACE.md should exist');
  });

  test('market-analysis has correct gap (Blue Ocean Strategy)', () => {
    assert.ok(maContent.includes('Blue Ocean Strategy'), 'Should contain Blue Ocean Strategy gap');
  });

  test('market-analysis has frontmatter with section name', () => {
    assert.ok(maContent.includes('section: market-analysis'), 'Frontmatter should have section');
  });

  test('market-analysis has Detected Gaps heading', () => {
    assert.ok(maContent.includes('## Detected Gaps'), 'Should have Detected Gaps heading');
  });

  test('market-analysis has novelty score table', () => {
    assert.ok(maContent.includes('## Section Novelty Scores'), 'Should have novelty table');
    assert.ok(maContent.includes('Competitors'), 'Should list Competitors artifact');
    assert.ok(maContent.includes('0.88'), 'Should show novelty score 0.88');
  });

  // -- solution-design/WHITESPACE.md (no gaps, no novelty) --
  const sdPath = path.join(roomDir, 'solution-design', 'WHITESPACE.md');
  const sdContent = fs.readFileSync(sdPath, 'utf-8');

  test('solution-design/WHITESPACE.md exists (no gaps section)', () => {
    assert.ok(fs.existsSync(sdPath), 'WHITESPACE.md should exist even with no gaps');
  });

  test('solution-design has well-covered message', () => {
    assert.ok(
      sdContent.includes('No whitespace gaps detected'),
      'Should have well-covered message'
    );
  });

  test('solution-design has frontmatter with gaps: 0', () => {
    assert.ok(sdContent.includes('gaps: 0'), 'Should show 0 gaps');
  });

  // -- Test no whitespace-results.json --
  const emptyRoom = path.join(tmpDir, 'empty-room');
  fs.mkdirSync(path.join(emptyRoom, 'problem-definition'), { recursive: true });

  test('handles missing whitespace-results.json gracefully', () => {
    const emptyOutput = execSync(`node "${SCRIPT}" "${emptyRoom}"`, { encoding: 'utf-8' });
    assert.ok(emptyOutput.includes('No whitespace-results.json'), 'Should skip gracefully');
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
