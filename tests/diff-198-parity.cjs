#!/usr/bin/env node
'use strict';
/*
 * Phase 198-10 Task 2 -- SPEC-6 two-host parity diff.
 * ============================================================================
 * Compares two captured leg artifacts (Claude Code CLI + one elicitation-capable
 * non-Anthropic MCP host) and returns the parity verdict. Parity == an EMPTY
 * node/edge diff AND an identical gate sequence. Any node/edge divergence
 * (including a stale-room write, T-198-02) or a gate-sequence mismatch fails the
 * gate and blocks phase close.
 *
 * CLI:  node tests/diff-198-parity.cjs <cli-artifact.json> <vscode-artifact.json>
 * API:  const { diffLegs } = require('./diff-198-parity.cjs')
 *
 * House rule: CJS only, hyphens only (no em-dashes). No emoji.
 */

const fs = require('node:fs');

function edgeKey(e) { return e.source + '|' + e.target + '|' + e.type; }
function nodeKey(n) { return n.type + '|' + n.label; }

function setDiff(aList, bList, keyFn) {
  const bKeys = new Set(bList.map(keyFn));
  const aKeys = new Set(aList.map(keyFn));
  const onlyInA = aList.filter((x) => !bKeys.has(keyFn(x)));
  const onlyInB = bList.filter((x) => !aKeys.has(keyFn(x)));
  return onlyInA.concat(onlyInB);
}

/**
 * Diff two normalized leg artifacts.
 * @returns {{ parity: boolean, node_diff: Array, edge_diff: Array, gate_sequence_match: boolean, detail: object }}
 */
function diffLegs(legA, legB) {
  const nodeDiff = setDiff(legA.nodes || [], legB.nodes || [], nodeKey);
  const edgeDiff = setDiff(legA.edges || [], legB.edges || [], edgeKey);
  const seqA = JSON.stringify(legA.gate_sequence || []);
  const seqB = JSON.stringify(legB.gate_sequence || []);
  const gateSequenceMatch = seqA === seqB;
  const parity = nodeDiff.length === 0 && edgeDiff.length === 0 && gateSequenceMatch;
  return {
    parity,
    node_diff: nodeDiff,
    edge_diff: edgeDiff,
    gate_sequence_match: gateSequenceMatch,
    detail: {
      host_a: legA.host,
      host_b: legB.host,
      gate_sequence_a: legA.gate_sequence || [],
      gate_sequence_b: legB.gate_sequence || [],
    },
  };
}

if (require.main === module) {
  const [aPath, bPath] = process.argv.slice(2);
  if (!aPath || !bPath) {
    process.stderr.write('usage: node tests/diff-198-parity.cjs <cli-artifact.json> <vscode-artifact.json>\n');
    process.exit(2);
  }
  const legA = JSON.parse(fs.readFileSync(aPath, 'utf8'));
  const legB = JSON.parse(fs.readFileSync(bPath, 'utf8'));
  const res = diffLegs(legA, legB);
  if (res.parity) {
    process.stdout.write('PARITY_DIFF_EMPTY hosts=' + res.detail.host_a + '+' + res.detail.host_b
      + ' (identical typed graph writes + identical gate sequence)\n');
    process.exit(0);
  }
  process.stderr.write('PARITY_DIFF_DRIFT ' + JSON.stringify(res, null, 2) + '\n');
  process.exit(1);
}

module.exports = { diffLegs };
