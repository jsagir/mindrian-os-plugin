'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 03 -- fake brain-client for the Phase 364 tests. layer: harness
 *
 * Two modes:
 *
 *  1. In-process: `installFakeBrain({ framework_step, recommend_chain })`
 *     swaps the cached exports of lib/core/brain-client.cjs for a shallow copy
 *     whose callTool and recommendChain serve scripted payloads and record
 *     every call. Each value is a payload object, a function returning one,
 *     or the string 'throw' (the call rejects). Returns { calls, restore }.
 *
 *  2. Preload for CLI children: when the process starts with
 *     `node --require tests/helpers/fake-brain-364.cjs ...` and the env var
 *     MOS_364_FAKE_BRAIN names a JSON file
 *       { "framework_step": "<fixture path>", "recommend_chain": "<fixture path>" }
 *     the helper installs itself, installs a fetch thrower that counts
 *     attempts, and on process exit writes { calls, net_attempts } as JSON to
 *     the path in MOS_364_FAKE_BRAIN_LOG.
 *
 * The scripted payloads are fixtures, never Theo content. No network.
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CLIENT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');

function serve(script, tool) {
  const v = script ? script[tool] : undefined;
  if (v === 'throw') return Promise.reject(new Error('fake brain: scripted throw for ' + tool));
  if (typeof v === 'function') return Promise.resolve(v());
  if (v === undefined) return Promise.reject(new Error('fake brain: ' + tool + ' not scripted'));
  return Promise.resolve(JSON.parse(JSON.stringify(v)));
}

function installFakeBrain(script) {
  const resolved = require.resolve(CLIENT_PATH);
  const real = require(resolved);
  const cached = require.cache[resolved];
  const originalExports = cached.exports;
  const calls = [];
  const fake = Object.assign({}, real, {
    callTool: function (tool, args) {
      calls.push({ tool: tool, args: args });
      return serve(script, tool);
    },
    recommendChain: function (problemType, maxSteps) {
      calls.push({ tool: 'recommend_chain', args: { problem_type: problemType, max_steps: maxSteps } });
      return serve(script, 'recommend_chain');
    },
    isAvailable: function () { return true; },
    askOp: function () { return Promise.reject(new Error('fake: not scripted')); },
  });
  cached.exports = fake;
  return {
    calls: calls,
    restore: function () { cached.exports = originalExports; },
  };
}

function installPreload() {
  const cfgPath = process.env.MOS_364_FAKE_BRAIN;
  const logPath = process.env.MOS_364_FAKE_BRAIN_LOG;
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const script = {};
  Object.keys(cfg).forEach(function (tool) {
    const v = cfg[tool];
    script[tool] = v === 'throw' ? 'throw' : JSON.parse(fs.readFileSync(path.resolve(v), 'utf8'));
  });
  let netAttempts = 0;
  globalThis.fetch = function noNetwork364() {
    netAttempts += 1;
    throw new Error('no network in 364 tests (fake-brain-364 preload)');
  };
  const handle = installFakeBrain(script);
  process.on('exit', function () {
    if (logPath) {
      try {
        fs.writeFileSync(logPath, JSON.stringify({ calls: handle.calls, net_attempts: netAttempts }));
      } catch (_e) { /* the child's exit code is the signal; a log miss fails the parent leg */ }
    }
  });
}

if (process.env.MOS_364_FAKE_BRAIN) installPreload();

module.exports = { installFakeBrain };
