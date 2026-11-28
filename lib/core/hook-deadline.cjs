'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 400.3 plan 05a (OR-5, V3, V9, review B-a): the one synchronous deadline helper of the 2 guard hooks
 * that fail closed (onFailure: block in hooks/hooks.json).
 *
 * Why a child process and not a timer or a worker thread:
 *   - a timer cannot fire while the main thread is inside a synchronous call (V3: a 1000 ms timer fired only
 *     after a 5006 ms SQLite busy wait);
 *   - process.exit inside a worker thread ends only the worker, so a worker that times out cannot end the hook
 *     with exit code 2, and a main thread cannot stop a worker that is blocked in a native call; a worker start
 *     cost 68 ms against 10-20 ms for a bare node start (Linux WSL2, planning measure);
 *   - spawnSync with a timeout and killSignal SIGKILL ends a blocked child on Linux and on Windows
 *     (TerminateProcess), and the parent then writes the deny and exits 2.
 *
 * Why process.execArgv is passed (review B-a): a --require preload of a test or of a host is a node flag of the
 * parent. A child started with process.execPath alone would lose it. NODE_OPTIONS reaches the child through the
 * environment, as before.
 *
 * Test seams. MOS_HOOK_DEADLINE_TEST_MS (read here) can only lower the deadline. MOS_HOOK_DEADLINE_TEST_STALL_MS
 * (read by the --inner mode of each hook) adds a stall that ends in a deny. Neither seam can make a check pass.
 *
 * The deadline is an absolute time on the performance.now() clock (time since this process started). Node start
 * before that point is not counted. Native Windows is UNMEASURED.
 *
 * Node built-ins only. No em-dashes. License: BSL 1.1.
 */
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const DEADLINE_MARGIN_MS = 1000;
const MAX_CHILD_OUTPUT_BYTES = 4 * 1024 * 1024;

// deadlineFor(hostBudgetMs) -> absolute deadline in ms on the performance.now() clock.
function deadlineFor(hostBudgetMs) {
  let d = Number(hostBudgetMs) - DEADLINE_MARGIN_MS;
  if (!Number.isFinite(d) || d < 1) d = 1;
  const seam = process.env.MOS_HOOK_DEADLINE_TEST_MS;
  if (typeof seam === 'string' && /^[1-9][0-9]*$/.test(seam)) {
    const n = parseInt(seam, 10);
    if (n < d) d = n;
  }
  return d;
}

// runUnderDeadline({script, args, input, timeoutMs | deadlineAt}) -> {kind: 'done', status, stdout, stderr}
//   | {kind: 'deadline'} | {kind: 'spawn_failed', reason}. Never throws.
function runUnderDeadline(opts) {
  try {
    const o = opts || {};
    const hasRel = typeof o.timeoutMs === 'number';
    const hasAbs = typeof o.deadlineAt === 'number';
    if (hasRel === hasAbs) return { kind: 'spawn_failed', reason: 'bad_options' };
    let remaining = hasRel ? o.timeoutMs : (o.deadlineAt - performance.now());
    remaining = Math.max(1, Math.floor(remaining));
    const args = Array.isArray(o.args) ? o.args : [];
    const res = spawnSync(process.execPath, process.execArgv.concat([o.script], args), {
      input: typeof o.input === 'string' ? o.input : '',
      encoding: 'utf8',
      timeout: remaining,
      killSignal: 'SIGKILL',
      windowsHide: true,
      maxBuffer: MAX_CHILD_OUTPUT_BYTES,
    });
    if (res.error) {
      if (res.error.code === 'ETIMEDOUT') return { kind: 'deadline', pid: res.pid };
      return { kind: 'spawn_failed', reason: String(res.error.code || 'spawn_error'), pid: res.pid };
    }
    if (res.signal === 'SIGKILL') return { kind: 'deadline', pid: res.pid };
    return { kind: 'done', status: res.status, stdout: res.stdout || '', stderr: res.stderr || '', pid: res.pid };
  } catch (_e) {
    return { kind: 'spawn_failed', reason: 'spawn_threw' };
  }
}

// writeAllSync(fd, text): write every byte (fs.writeSync can write part of a buffer on a pipe).
function writeAllSync(fd, text) {
  const buf = Buffer.isBuffer(text) ? text : Buffer.from(String(text || ''), 'utf8');
  let off = 0;
  while (off < buf.length) {
    try {
      off += fs.writeSync(fd, buf, off, buf.length - off);
    } catch (e) {
      if (e && e.code === 'EAGAIN') continue;
      return;
    }
  }
}

module.exports = { deadlineFor, runUnderDeadline, writeAllSync, DEADLINE_MARGIN_MS, MAX_CHILD_OUTPUT_BYTES };
