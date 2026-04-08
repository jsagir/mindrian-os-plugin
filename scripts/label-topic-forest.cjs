#!/usr/bin/env node
/**
 * label-topic-forest.cjs -- Claude Recursive Topic Tree Labeling
 * ================================================================
 * Reads .mindrian/topic-forest.json (from compute-topic-forest.py) and
 * labels every tree node with a human-readable topic name using Claude.
 *
 * Labeling strategy (bottom-up, per D-03):
 *   - Leaf clusters: labeled from content snippets (artifact text or framework names)
 *   - Internal nodes: labeled by summarizing child labels
 *   - Taxonomy strategy: uses framework names directly (no Claude calls)
 *   - HDBSCAN strategy: one Claude call per cluster (flat)
 *   - TopicForest strategy: one Claude call per internal node, bottom-up by depth
 *
 * Claude is called via child_process.execSync (`claude -p "prompt"`).
 * When Claude is unavailable, graceful fallback: framework names for
 * Brain-heavy clusters, "Cluster N" for artifact-heavy clusters.
 *
 * Usage:
 *   node scripts/label-topic-forest.cjs /path/to/room [--force] [--dry-run]
 *   node scripts/label-topic-forest.cjs --room /path/to/room
 *   node scripts/label-topic-forest.cjs --help
 *
 * Reads:  .mindrian/topic-forest.json
 * Writes: .mindrian/topic-forest.json (enriched with labels)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Brain client (lazy-loaded, same pattern as interpret-whitespace.cjs)
// ---------------------------------------------------------------------------

let _brain = null;
function getBrain() {
  if (!_brain) {
    try {
      _brain = require('../lib/core/brain-client.cjs');
    } catch (e) {
      _brain = { isAvailable: () => false, query: async () => null };
    }
  }
  return _brain;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLAUDE_DELAY_MS = 500;
const MAX_SNIPPET_LENGTH = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call Claude CLI with a prompt and return the response text.
 * Returns null if Claude is unavailable or errors.
 *
 * @param {string} prompt
 * @returns {string|null}
 */
function callClaude(prompt) {
  try {
    // Escape the prompt for shell safety
    const escaped = prompt.replace(/'/g, "'\\''");
    const result = execSync(`claude -p '${escaped}'`, {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (e) {
    return null;
  }
}

/**
 * Extract a content snippet from an artifact file path.
 * Reads the first MAX_SNIPPET_LENGTH characters of the file.
 *
 * @param {string} filePath - absolute path to artifact file
 * @returns {string}
 */
function getArtifactSnippet(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf-8');
    // Strip frontmatter
    let text = content;
    if (text.startsWith('---')) {
      const endIdx = text.indexOf('---', 3);
      if (endIdx !== -1) {
        text = text.slice(endIdx + 3).trim();
      }
    }
    // Strip markdown heading
    text = text.replace(/^#+\s+.*\n/, '').trim();
    return text.slice(0, MAX_SNIPPET_LENGTH);
  } catch (e) {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Content collection for leaf nodes
// ---------------------------------------------------------------------------

/**
 * Collect content descriptions for leaf nodes under a given parent.
 * For room artifacts: read snippet from file.
 * For brain frameworks: use framework_name.
 *
 * @param {Object} node - tree node
 * @param {string} roomDir - room directory path
 * @param {Object} wsData - whitespace-embeddings.json data
 * @param {Object} blData - brain-baseline.json data
 * @returns {string[]} array of content descriptions
 */
function collectLeafContent(node, roomDir, wsData, blData) {
  const descriptions = [];

  if (isLeaf(node)) {
    const desc = getNodeDescription(node, roomDir, wsData, blData);
    if (desc) descriptions.push(desc);
    return descriptions;
  }

  for (const child of (node.children || [])) {
    descriptions.push(...collectLeafContent(child, roomDir, wsData, blData));
  }

  return descriptions;
}

/**
 * Get a description string for a single leaf node.
 *
 * @param {Object} node
 * @param {string} roomDir
 * @param {Object} wsData
 * @param {Object} blData
 * @returns {string}
 */
function getNodeDescription(node, roomDir, wsData, blData) {
  // Brain framework leaf
  if (node.framework_name) {
    return node.framework_name;
  }

  // Taxonomy node with framework_name at top level
  if (node.id && node.id.startsWith('framework-') && node.framework_name) {
    return node.framework_name;
  }

  // Room artifact leaf -- try to get snippet
  if (node.is_room_artifact && wsData) {
    const embList = wsData.embeddings || [];
    const idx = node.artifact_index;
    if (idx !== undefined && idx < embList.length) {
      const artId = embList[idx].id || '';
      const artPath = path.join(roomDir, artId);
      const snippet = getArtifactSnippet(artPath);
      if (snippet) return snippet.slice(0, 80);
      return embList[idx].title || artId || `Artifact ${idx}`;
    }
  }

  // Taxonomy artifacts list
  if (node.artifacts && node.artifacts.length > 0) {
    return node.artifacts.map(a => a.title || a.artifact_id || 'unknown').join(', ').slice(0, 120);
  }

  // Artifact ID fallback
  if (node.artifact_id) return node.artifact_id;

  return node.id || 'unknown';
}

/**
 * Check if a node is a leaf (no children or empty children).
 * @param {Object} node
 * @returns {boolean}
 */
function isLeaf(node) {
  return !node.children || node.children.length === 0;
}

// ---------------------------------------------------------------------------
// Labeling strategies
// ---------------------------------------------------------------------------

/**
 * Label taxonomy tree: use framework names directly, no Claude needed.
 * @param {Object} tree
 */
function labelTaxonomy(tree) {
  if (!tree.children) return;

  for (const child of tree.children) {
    if (child.framework_name && !child.label) {
      child.label = child.framework_name;
    } else if (child.artifacts && child.artifacts.length > 0 && !child.label) {
      child.label = `Artifacts (${child.artifact_count})`;
    }
  }

  // Root label
  if (!tree.label) {
    const childLabels = tree.children
      .filter(c => c.label)
      .map(c => c.label)
      .slice(0, 5);
    tree.label = childLabels.length > 0
      ? 'Knowledge Domain'
      : 'Room Topics';
  }
}

/**
 * Label HDBSCAN flat clusters: one Claude call per cluster.
 *
 * @param {Object} tree
 * @param {string} roomDir
 * @param {Object} wsData
 * @param {Object} blData
 * @param {Object} options - { dryRun: boolean }
 * @returns {Promise<void>}
 */
async function labelHdbscan(tree, roomDir, wsData, blData, options) {
  if (!tree.children) return;

  let clusterIdx = 0;
  for (const child of tree.children) {
    if (child.label && !options.force) continue;

    // Collect content from cluster members
    const contents = collectLeafContent(child, roomDir, wsData, blData);

    // Use frameworks first if available
    const frameworks = child.frameworks || [];
    if (frameworks.length > 0 && contents.length === 0) {
      child.label = frameworks[0];
      continue;
    }

    const items = contents.length > 0 ? contents : frameworks;
    if (items.length === 0) {
      child.label = `Cluster ${clusterIdx}`;
      clusterIdx++;
      continue;
    }

    const prompt = buildLeafClusterPrompt(items);

    if (options.dryRun) {
      process.stdout.write(`[DRY-RUN] Cluster ${child.id}:\n  Prompt: ${prompt.slice(0, 120)}...\n\n`);
      child.label = `Cluster ${clusterIdx}`;
    } else {
      const label = callClaude(prompt);
      if (label) {
        child.label = sanitizeLabel(label);
      } else {
        // Fallback
        child.label = frameworks.length > 0
          ? frameworks[0]
          : `Cluster ${clusterIdx}`;
      }
      await sleep(CLAUDE_DELAY_MS);
    }

    clusterIdx++;
  }

  // Root label
  if (!tree.label || options.force) {
    const childLabels = tree.children.filter(c => c.label).map(c => c.label);
    if (childLabels.length > 0) {
      const prompt = buildParentPrompt(childLabels);
      if (options.dryRun) {
        process.stdout.write(`[DRY-RUN] Root:\n  Prompt: ${prompt.slice(0, 120)}...\n\n`);
        tree.label = 'Knowledge Domain';
      } else {
        const label = callClaude(prompt);
        tree.label = label ? sanitizeLabel(label) : 'Knowledge Domain';
      }
    } else {
      tree.label = 'Knowledge Domain';
    }
  }
}

/**
 * Label TopicForest agglomerative tree: recursive bottom-up by depth level.
 *
 * @param {Object} tree
 * @param {string} roomDir
 * @param {Object} wsData
 * @param {Object} blData
 * @param {Object} options - { dryRun: boolean, force: boolean }
 * @returns {Promise<void>}
 */
async function labelTopicForest(tree, roomDir, wsData, blData, options) {
  // Collect all nodes by depth
  const nodesByDepth = {};

  function collectByDepth(node, depth) {
    if (!nodesByDepth[depth]) nodesByDepth[depth] = [];
    nodesByDepth[depth].push(node);
    for (const child of (node.children || [])) {
      collectByDepth(child, depth + 1);
    }
  }

  collectByDepth(tree, 0);

  // Process deepest first (bottom-up)
  const depths = Object.keys(nodesByDepth)
    .map(Number)
    .sort((a, b) => b - a);

  let labelCount = 0;

  for (const depth of depths) {
    for (const node of nodesByDepth[depth]) {
      if (node.label && !options.force) continue;

      if (isLeaf(node)) {
        // Leaf: use framework name or artifact info
        const desc = getNodeDescription(node, roomDir, wsData, blData);
        node.label = desc ? desc.slice(0, 50) : `Leaf ${node.id}`;
        continue;
      }

      // Internal node: label from children
      const childLabels = (node.children || [])
        .filter(c => c.label)
        .map(c => c.label);

      if (childLabels.length === 0) {
        // Children not labeled yet -- collect content snippets
        const contents = collectLeafContent(node, roomDir, wsData, blData);
        if (contents.length === 0) {
          node.label = `Topic ${node.id}`;
          continue;
        }

        const prompt = buildLeafClusterPrompt(contents.slice(0, 10));
        if (options.dryRun) {
          process.stdout.write(`[DRY-RUN] Node ${node.id} (depth ${depth}):\n  Prompt: ${prompt.slice(0, 120)}...\n\n`);
          node.label = `Topic ${labelCount}`;
        } else {
          const label = callClaude(prompt);
          node.label = label ? sanitizeLabel(label) : `Topic ${labelCount}`;
          await sleep(CLAUDE_DELAY_MS);
        }
      } else {
        const prompt = buildParentPrompt(childLabels);
        if (options.dryRun) {
          process.stdout.write(`[DRY-RUN] Node ${node.id} (depth ${depth}):\n  Prompt: ${prompt.slice(0, 120)}...\n\n`);
          node.label = `Topic ${labelCount}`;
        } else {
          const label = callClaude(prompt);
          node.label = label ? sanitizeLabel(label) : `Topic ${labelCount}`;
          await sleep(CLAUDE_DELAY_MS);
        }
      }

      labelCount++;
    }
  }
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/**
 * Build a prompt for labeling a leaf cluster from content snippets.
 * @param {string[]} contents
 * @returns {string}
 */
function buildLeafClusterPrompt(contents) {
  const items = contents.slice(0, 10).map(c => `- ${c}`).join('\n');
  return (
    'These documents/frameworks are clustered together. Generate a short topic label (2-5 words) that captures their shared theme:\n' +
    items + '\n' +
    'Respond with ONLY the topic label, nothing else.'
  );
}

/**
 * Build a prompt for labeling a parent node from child labels.
 * @param {string[]} childLabels
 * @returns {string}
 */
function buildParentPrompt(childLabels) {
  const items = childLabels.slice(0, 10).map(c => `- ${c}`).join('\n');
  return (
    'These are sub-topics within a larger theme. Generate a broader topic label (2-5 words) that encompasses all of them:\n' +
    items + '\n' +
    'Respond with ONLY the topic label, nothing else.'
  );
}

/**
 * Sanitize a Claude response to extract just the label.
 * Removes quotes, periods, extra whitespace, and truncates.
 * @param {string} raw
 * @returns {string}
 */
function sanitizeLabel(raw) {
  let label = raw
    .replace(/^["'\s]+|["'\s.]+$/g, '')  // trim quotes, whitespace, trailing periods
    .replace(/\n.*/g, '')                 // take only first line
    .trim();

  // Truncate to reasonable length
  if (label.length > 60) {
    label = label.slice(0, 57) + '...';
  }

  return label || 'Unnamed Topic';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  // Help
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(
      'Usage: node scripts/label-topic-forest.cjs /path/to/room [--force] [--dry-run]\n' +
      '       node scripts/label-topic-forest.cjs --room /path/to/room\n' +
      '\n' +
      'Labels every node in .mindrian/topic-forest.json with a human-readable\n' +
      'topic name using Claude. Labels are generated recursively from leaf\n' +
      'clusters upward -- parent labels summarize children.\n' +
      '\n' +
      'Options:\n' +
      '  --force     Re-label even if labels_pending is false\n' +
      '  --dry-run   Print prompts without calling Claude\n' +
      '  --room DIR  Specify room directory\n' +
      '  --help      Show this help\n' +
      '\n' +
      'Reads:  .mindrian/topic-forest.json (from compute-topic-forest.py)\n' +
      'Writes: .mindrian/topic-forest.json (enriched with labels)\n'
    );
    process.exit(0);
  }

  // Parse args
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');
  let roomDir = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--room' && args[i + 1]) {
      roomDir = args[i + 1];
      i++;
    } else if (!args[i].startsWith('-')) {
      roomDir = args[i];
    }
  }

  if (!roomDir) {
    process.stderr.write('Error: No room path provided.\n');
    process.stderr.write('Usage: node scripts/label-topic-forest.cjs /path/to/room [--force] [--dry-run]\n');
    process.exit(1);
  }

  const resolvedRoom = path.resolve(roomDir);
  if (!fs.existsSync(resolvedRoom)) {
    process.stderr.write(`Error: ${resolvedRoom} does not exist\n`);
    process.exit(1);
  }

  // Load topic-forest.json
  const mindrianDir = path.join(resolvedRoom, '.mindrian');
  const forestPath = path.join(mindrianDir, 'topic-forest.json');

  if (!fs.existsSync(forestPath)) {
    process.stderr.write(
      'No topic-forest.json found. Run compute-topic-forest.py first:\n' +
      `  python3 scripts/compute-topic-forest.py ${resolvedRoom}\n`
    );
    process.exit(0);
  }

  let forestData;
  try {
    forestData = JSON.parse(fs.readFileSync(forestPath, 'utf-8'));
  } catch (e) {
    process.stderr.write('Error: Could not parse topic-forest.json\n');
    process.exit(1);
  }

  const metadata = forestData.metadata || {};
  const tree = forestData.tree;

  if (!tree) {
    process.stderr.write('Error: topic-forest.json has no tree field\n');
    process.exit(1);
  }

  // Check if already labeled
  if (metadata.labels_pending === false && !force) {
    process.stdout.write('Labels already generated. Use --force to re-label.\n');
    process.exit(0);
  }

  // Load supporting data for content snippets
  const wsPath = path.join(mindrianDir, 'whitespace-embeddings.json');
  const blPath = path.join(mindrianDir, 'brain-baseline.json');

  let wsData = null;
  let blData = null;

  try {
    if (fs.existsSync(wsPath)) {
      wsData = JSON.parse(fs.readFileSync(wsPath, 'utf-8'));
    }
  } catch (e) { /* ignore */ }

  try {
    if (fs.existsSync(blPath)) {
      blData = JSON.parse(fs.readFileSync(blPath, 'utf-8'));
    }
  } catch (e) { /* ignore */ }

  // Route to labeling strategy
  const strategy = metadata.strategy || 'taxonomy';
  const options = { force, dryRun };

  process.stdout.write(`Labeling topic forest (strategy: ${strategy})...\n`);

  if (strategy === 'taxonomy') {
    labelTaxonomy(tree);
  } else if (strategy === 'hdbscan') {
    await labelHdbscan(tree, resolvedRoom, wsData, blData, options);
  } else {
    // topicforest (agglomerative)
    await labelTopicForest(tree, resolvedRoom, wsData, blData, options);
  }

  // Update metadata
  metadata.labels_pending = false;
  metadata.labels_generated_at = new Date().toISOString();
  forestData.metadata = metadata;

  // Also label whitespace branches with their tree node labels
  if (forestData.whitespace_branches) {
    const labelMap = {};
    collectLabelMap(tree, labelMap);

    for (const wb of forestData.whitespace_branches) {
      const nodeLabel = labelMap[wb.node_id];
      if (nodeLabel) {
        wb.label = nodeLabel;
      }
    }
  }

  // Write back
  if (!dryRun) {
    try {
      fs.writeFileSync(forestPath, JSON.stringify(forestData, null, 2), 'utf-8');
      process.stdout.write(`Labeled topic forest written to ${forestPath}\n`);
    } catch (e) {
      process.stderr.write(`Error writing topic-forest.json: ${e.message}\n`);
      process.exit(1);
    }
  } else {
    process.stdout.write(`[DRY-RUN] Would write to ${forestPath}\n`);
  }

  // Summary
  const labeledCount = countLabeled(tree);
  const totalCount = countNodes(tree);
  process.stdout.write(
    `Labeled ${labeledCount}/${totalCount} nodes` +
    (dryRun ? ' (dry-run, no Claude calls made)' : '') +
    '\n'
  );
}

/**
 * Recursively collect node labels into a map keyed by node ID.
 * @param {Object} node
 * @param {Object} map
 */
function collectLabelMap(node, map) {
  if (node.id && node.label) {
    map[node.id] = node.label;
  }
  for (const child of (node.children || [])) {
    collectLabelMap(child, map);
  }
}

/**
 * Count nodes with labels.
 * @param {Object} node
 * @returns {number}
 */
function countLabeled(node) {
  let count = node.label ? 1 : 0;
  for (const child of (node.children || [])) {
    count += countLabeled(child);
  }
  return count;
}

/**
 * Count total nodes.
 * @param {Object} node
 * @returns {number}
 */
function countNodes(node) {
  let count = 1;
  for (const child of (node.children || [])) {
    count += countNodes(child);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Exports (for testability)
// ---------------------------------------------------------------------------

module.exports = {
  buildLeafClusterPrompt,
  buildParentPrompt,
  sanitizeLabel,
  collectLeafContent,
  isLeaf,
  labelTaxonomy,
  countLabeled,
  countNodes,
  collectLabelMap,
};
