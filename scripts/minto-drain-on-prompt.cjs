'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261030-a2s win 1: the Phase 88-05 MINTO drain, run inside the intent-classifier process.
 *
 * Before, scripts/intent-classifier started a separate "node -e" process for this drain on every
 * prompt, and then started the classifier: two node starts per prompt. Now the classifier calls
 * drainOnPrompt(roomDir) as its first statement (when the wrapper exported MOS_MINTO_DRAIN_ROOM),
 * so one node start does both jobs, in the same order: the drain first, then the classifier reads
 * stdin.
 *
 * The body is the old wrapper block, step for step:
 *   1. drain the debouncer queue: entries older than 30 s, with a 500 ms drain timeout
 *   2. append the drained entries to .mindrian/pending-tier1-regen.json (tmp file + rename)
 *   3. spawn one tier-0 regen per section, detached and unref'd (fire and forget):
 *        node scripts/vault-section-minto-generator.cjs --write <roomDir> --section <name>
 *
 * Soft-fail contract (unchanged): nothing here throws, and nothing here writes to stdout or
 * stderr. The old block ran with 2>/dev/null; here process.stderr.write is silenced for the
 * duration of the drain (scripts/minto-debouncer.cjs warns on stderr for a corrupt queue). A
 * spawn 'error' event gets a no-op listener, because an unhandled child error would now crash
 * the classifier process (it could not reach the classifier when the drain had its own process).
 *
 * This module never reads fd 0 or the stdin stream: the classifier reads stdin after this returns.
 * Node built-ins only. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

function drainBody(roomDir, opts) {
  if (!roomDir || typeof roomDir !== 'string') return;
  try {
    if (!fs.statSync(path.join(roomDir, '.mindrian')).isDirectory()) return;
  } catch (_e) {
    return;
  }
  const debouncerScript = opts.debouncerScript || path.join(__dirname, 'minto-debouncer.cjs');
  const genScript = opts.genScript || path.join(__dirname, 'vault-section-minto-generator.cjs');

  // 1. drain via the debouncer API
  let drained = [];
  try {
    const debouncer = require(debouncerScript);
    drained = debouncer.drain(roomDir, { timeoutMs: 500, olderThanMs: 30000 });
  } catch (_e) {
    return;
  }
  if (!Array.isArray(drained) || drained.length === 0) return;

  // 2. atomic append to pending-tier1-regen.json (tmp + rename)
  try {
    const p = path.join(roomDir, '.mindrian', 'pending-tier1-regen.json');
    let pending = { version: 1, pending: [] };
    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (parsed && Array.isArray(parsed.pending)) pending = parsed;
    } catch (_e) { /* first write */ }
    pending.pending = pending.pending.concat(drained);
    const tmp = p + '.tmp.' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(pending, null, 2));
    fs.renameSync(tmp, p);
  } catch (_e) { /* pending-tier1-regen write is best effort */ }

  // 3. tier-0 regens in the background, one per section (deduped)
  const seen = {};
  for (let i = 0; i < drained.length; i += 1) {
    const e = drained[i];
    if (!e || typeof e.section !== 'string') continue;
    if (seen[e.section]) continue;
    seen[e.section] = true;
    try {
      const child = cp.spawn(
        process.execPath,
        [genScript, '--write', roomDir, '--section', e.section],
        { detached: true, stdio: 'ignore' }
      );
      child.on('error', function () { /* soft-fail: a spawn error never reaches the hook */ });
      child.unref();
    } catch (_e) { /* soft-fail */ }
  }
}

function drainOnPrompt(roomDir, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const origWrite = process.stderr.write;
  try {
    process.stderr.write = function () { return true; };
    drainBody(roomDir, o);
  } catch (_e) {
    /* soft-fail */
  } finally {
    process.stderr.write = origWrite;
  }
}

module.exports = { drainOnPrompt };
