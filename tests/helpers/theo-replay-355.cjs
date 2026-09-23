/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 Plan 06 Task 1 -- the offline Theo replay helper every 355-06 test
 * uses to drive lib/core/verification-stamp.cjs's `deps.callTool` seam without
 * ever reaching the network (Canon Part 8; THEO-04: the raw `theo` server is
 * never called; this helper does not call it either -- it plays back a
 * recorded fixture).
 *
 * Exports:
 *   makeReplayCallTool(fixture) -- async (tool, args) => the fixture entry
 *     keyed by args.from + '\u0000' + args.to, honoring three sentinels:
 *     { "$null": true } -> resolves null (transport-outage signal);
 *     { "$throw": "msg" } -> rejects with new Error(msg);
 *     { "$string": "..." } -> resolves the bare string (non-object reply).
 *     Every call is recorded on the returned function's `.calls` array as
 *     { tool, args: { from, to }, at }. An unmapped pair throws loudly (a
 *     test bug, not a degradation case -- never silently returns undefined).
 *   makeNullCallTool() -- always resolves null.
 *   makeThrowCallTool(message) -- always rejects.
 *   makeCountingCallTool(inner) -- wraps another callTool fn, tracking
 *     current/max in-flight concurrency (`.maxInFlight()`) and recording
 *     `.calls`, for the pool(4) concurrency proof.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

function makeReplayCallTool(fixture) {
  const calls = [];
  async function replayCallTool(tool, args) {
    const from = args && args.from;
    const to = args && args.to;
    calls.push({ tool: tool, args: { from: from, to: to }, at: Date.now() });
    const key = String(from) + '\u0000' + String(to);
    const responses = fixture && fixture.responses ? fixture.responses : {};
    if (!Object.prototype.hasOwnProperty.call(responses, key)) {
      throw new Error('makeReplayCallTool: no fixture entry for key ' + JSON.stringify(key));
    }
    const entry = responses[key];
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      if (Object.prototype.hasOwnProperty.call(entry, '$null')) return null;
      if (Object.prototype.hasOwnProperty.call(entry, '$throw')) throw new Error(String(entry.$throw));
      if (Object.prototype.hasOwnProperty.call(entry, '$string')) return entry.$string;
    }
    return entry;
  }
  replayCallTool.calls = calls;
  return replayCallTool;
}

function makeNullCallTool() {
  const calls = [];
  async function nullCallTool(tool, args) {
    calls.push({ tool: tool, args: args, at: Date.now() });
    return null;
  }
  nullCallTool.calls = calls;
  return nullCallTool;
}

function makeThrowCallTool(message) {
  const calls = [];
  async function throwCallTool(tool, args) {
    calls.push({ tool: tool, args: args, at: Date.now() });
    throw new Error(message || 'makeThrowCallTool: synthetic transport failure');
  }
  throwCallTool.calls = calls;
  return throwCallTool;
}

function makeCountingCallTool(inner) {
  let current = 0;
  let max = 0;
  const calls = [];
  async function countingCallTool(tool, args) {
    current += 1;
    if (current > max) max = current;
    calls.push({ tool: tool, args: args, at: Date.now() });
    try {
      return await inner(tool, args);
    } finally {
      current -= 1;
    }
  }
  countingCallTool.calls = calls;
  countingCallTool.maxInFlight = function maxInFlight() {
    return max;
  };
  return countingCallTool;
}

module.exports = {
  makeReplayCallTool: makeReplayCallTool,
  makeNullCallTool: makeNullCallTool,
  makeThrowCallTool: makeThrowCallTool,
  makeCountingCallTool: makeCountingCallTool,
};
