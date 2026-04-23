#!/usr/bin/env node
/**
 * ensure-brain-baseline.cjs -- Baseline Auto-Fire Helper
 * =======================================================
 * Ensures {roomDir}/.mindrian/brain-baseline.json exists before
 * downstream scripts (compute-whitespace-gaps.py, discover-*.py) run.
 *
 * Extracted from scripts/whitespace-command.cjs cmdMap per Phase 88.6-01
 * Canon Part 7 (Reuse Before Build). Shared by discovery-cycle.cjs and
 * whitespace-command.cjs.
 *
 * Graceful degradation: Brain unreachable -> log 'baseline unavailable
 * -- Brain offline' and return { ensured: false }. Caller decides whether
 * to continue with empty baseline or abort.
 *
 * License: BSL-1.1
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPTS_DIR = __dirname;
const OFFLINE_MSG = 'baseline unavailable -- Brain offline';

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function runCmd(cmd, timeoutMs) {
  try {
    execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs || 60000,
    });
    return { ok: true };
  } catch (err) {
    const stderr = (err.stderr || '').toString().trim();
    return { ok: false, error: stderr || err.message || 'unknown' };
  }
}

/**
 * Ensure brain-baseline.json exists for the given room.
 * Idempotent: no-op if baseline already present.
 *
 * @param {string} roomDir - Absolute path to room directory
 * @param {object} [options]
 * @param {boolean} [options.verbose=false] - Log progress to stderr
 * @returns {{ensured: boolean, reason: string, fetched: boolean, error?: string}}
 */
function ensureBrainBaseline(roomDir, options) {
  const opts = options || {};
  const mindrianDir = path.join(roomDir, '.mindrian');
  const baselinePath = path.join(mindrianDir, 'brain-baseline.json');

  if (fileExists(baselinePath)) {
    return { ensured: true, reason: 'already-present', fetched: false };
  }

  const fetchCjs = path.join(SCRIPTS_DIR, 'fetch-brain-baseline.cjs');
  const fetchPy = path.join(SCRIPTS_DIR, 'fetch-brain-baseline.py');
  if (!fileExists(fetchCjs) || !fileExists(fetchPy)) {
    process.stderr.write(OFFLINE_MSG + '\n');
    return { ensured: false, reason: 'fetch-scripts-missing', fetched: false };
  }

  fs.mkdirSync(mindrianDir, { recursive: true });

  if (opts.verbose) process.stderr.write('Fetching Brain consensus baseline...\n');
  const cjsResult = runCmd(`node "${fetchCjs}" --room "${roomDir}"`, 60000);
  const brainDataPath = path.join(mindrianDir, 'brain-data.json');

  if (!cjsResult.ok || !fileExists(brainDataPath)) {
    process.stderr.write(OFFLINE_MSG + '\n');
    return {
      ensured: false,
      reason: 'brain-offline',
      fetched: false,
      error: cjsResult.error || 'brain-data.json not produced',
    };
  }

  if (opts.verbose) process.stderr.write('Embedding Brain baseline...\n');
  const pyResult = runCmd(
    `python3 "${fetchPy}" --input "${brainDataPath}" --room "${roomDir}"`,
    120000
  );

  if (!pyResult.ok || !fileExists(baselinePath)) {
    process.stderr.write(OFFLINE_MSG + '\n');
    return {
      ensured: false,
      reason: 'embedding-failed',
      fetched: false,
      error: pyResult.error || 'brain-baseline.json not produced',
    };
  }

  return { ensured: true, reason: 'fetched', fetched: true };
}

module.exports = { ensureBrainBaseline, OFFLINE_MSG };

// Allow direct CLI invocation for testing: node scripts/ensure-brain-baseline.cjs ROOM_DIR
if (require.main === module) {
  const roomDir = process.argv[2];
  if (!roomDir) {
    process.stderr.write('Usage: node scripts/ensure-brain-baseline.cjs ROOM_DIR\n');
    process.exit(1);
  }
  const result = ensureBrainBaseline(path.resolve(roomDir), { verbose: true });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ensured ? 0 : 2);
}
