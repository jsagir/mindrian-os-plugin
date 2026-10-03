#!/usr/bin/env node
'use strict';

/**
 * Phase 369 Plan 07 (SESS369-03, T-369-07-01, T-369-07-07) -- ensureDaemon never
 * passes CLAUDE_CODE_SESSION_ID to the shared daemon.
 * ==========================================================================
 * The daemon serves every client on the machine. lib/core/session-binding.cjs
 * resolveEffectiveSessionId falls back to process.env.CLAUDE_CODE_SESSION_ID, so
 * a daemon that inherited one CLI's id would bind every stateless 2026-era
 * request to that one CLI session (arm 6 of test-369-sessionful-acceptance pins
 * the hazard). Arms:
 *
 *   1. static   ensureDaemon deletes CLAUDE_CODE_SESSION_ID after the env object
 *               is assembled and before spawn(); MINDRIAN_SESSION_ID is not
 *               touched in daemon-lifecycle.cjs.
 *   2. static   CLI rung (b) guard: the stdio shim never sets versionNegotiation
 *               to auto and hands process.env.MINDRIAN_SESSION_ID to the client
 *               options' sessionId, so a flagged CLI's daemon connection never
 *               depends on the daemon's own env.
 *   3. live     ensureDaemon with CLAUDE_CODE_SESSION_ID set in the spawner env
 *               (and again through opts.env) spawns a fixture server that records
 *               its own env keys: no CLAUDE_CODE_SESSION_ID, but MINDRIAN_TRANSPORT=http
 *               and MINDRIAN_MCP_DAEMON=1.
 *
 * No em-dashes (hyphens only). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const LIFECYCLE = path.join(REPO_ROOT, 'lib', 'mcp', 'daemon-lifecycle.cjs');
const SHIM = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-shim.cjs');

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + (err && err.message ? err.message : String(err)));
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureDaemonBody() {
  const src = fs.readFileSync(LIFECYCLE, 'utf8');
  const start = src.indexOf('async function ensureDaemon(');
  assert.ok(start !== -1, 'ensureDaemon must exist');
  const end = src.indexOf('\nmodule.exports', start);
  return src.slice(start, end === -1 ? undefined : end);
}

async function main() {
  await test('static: ensureDaemon deletes CLAUDE_CODE_SESSION_ID after the env is built and before spawn(); MINDRIAN_SESSION_ID untouched', async () => {
    const body = ensureDaemonBody();
    const built = body.indexOf('const env = Object.assign(');
    const del = body.indexOf('delete env.CLAUDE_CODE_SESSION_ID');
    const spawnAt = body.indexOf('spawn(');
    assert.ok(built !== -1, 'env object must be assembled in ensureDaemon');
    assert.ok(del !== -1, 'ensureDaemon must delete env.CLAUDE_CODE_SESSION_ID');
    assert.ok(built < del && del < spawnAt, 'delete must sit after the env build and before spawn(): ' + [built, del, spawnAt].join(','));
    const whole = fs.readFileSync(LIFECYCLE, 'utf8');
    const lifecycleLines = whole.split('\n').filter((l) => l.includes('MINDRIAN_SESSION_ID') && !/^\s*(\/\/|\*|\/\*)/.test(l));
    assert.equal(lifecycleLines.length, 0, 'daemon-lifecycle.cjs must not act on MINDRIAN_SESSION_ID: ' + lifecycleLines.join(' | '));
  });

  await test('static (CLI rung b): the shim keeps the default handshake and keys its daemon connection by MINDRIAN_SESSION_ID', async () => {
    const src = fs.readFileSync(SHIM, 'utf8');
    const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.ok(!/versionNegotiation/.test(code), 'the shim must not set versionNegotiation (no era auto-negotiation of its own)');
    assert.ok(/process\.env\.MINDRIAN_SESSION_ID/.test(code), 'the shim must read process.env.MINDRIAN_SESSION_ID');
    assert.ok(/clientOpts\.sessionId\s*=\s*hookSessionId/.test(code), 'the shim must pass the hook session id into the client options sessionId');
    assert.ok(!/CLAUDE_CODE_SESSION_ID/.test(code), 'the shim must not depend on CLAUDE_CODE_SESSION_ID');
  });

  await test('live: ensureDaemon spawns the daemon with no CLAUDE_CODE_SESSION_ID (spawner env and opts.env), transport and daemon markers kept', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-env-scrub-'));
    const saved = process.env.CLAUDE_CODE_SESSION_ID;
    try {
      const out = path.join(tmp, 'env-keys.json');
      const fixture = path.join(tmp, 'fixture-server.cjs');
      fs.writeFileSync(
        fixture,
        "const fs = require('node:fs');\n" +
          "fs.writeFileSync(process.env.TEST_369_ENV_OUT, JSON.stringify({\n" +
          "  keys: Object.keys(process.env),\n" +
          "  transport: process.env.MINDRIAN_TRANSPORT,\n" +
          "  daemon: process.env.MINDRIAN_MCP_DAEMON,\n" +
          "  sessionId: process.env.CLAUDE_CODE_SESSION_ID || null,\n" +
          "}));\n"
      );
      const { ensureDaemon } = require(LIFECYCLE);
      for (const via of ['spawner-env', 'opts.env']) {
        try { fs.rmSync(out, { force: true }); } catch (_e) { /* fresh */ }
        const opts = { home: tmp, serverPath: fixture, spawnTimeoutMs: 1500, healthTimeoutMs: 200, env: { TEST_369_ENV_OUT: out } };
        if (via === 'spawner-env') {
          process.env.CLAUDE_CODE_SESSION_ID = 'cli-session-369';
        } else {
          delete process.env.CLAUDE_CODE_SESSION_ID;
          opts.env.CLAUDE_CODE_SESSION_ID = 'cli-session-369';
        }
        await ensureDaemon(opts);
        for (let i = 0; i < 40 && !fs.existsSync(out); i += 1) await sleep(100);
        assert.ok(fs.existsSync(out), 'the fixture server must have run (' + via + ')');
        const rec = JSON.parse(fs.readFileSync(out, 'utf8'));
        assert.equal(rec.sessionId, null, 'CLAUDE_CODE_SESSION_ID must not reach the daemon (' + via + ')');
        assert.ok(rec.keys.indexOf('CLAUDE_CODE_SESSION_ID') === -1, 'no CLAUDE_CODE_SESSION_ID key (' + via + ')');
        assert.equal(rec.transport, 'http', 'MINDRIAN_TRANSPORT=http (' + via + ')');
        assert.equal(rec.daemon, '1', 'MINDRIAN_MCP_DAEMON=1 (' + via + ')');
      }
    } finally {
      if (saved === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
      else process.env.CLAUDE_CODE_SESSION_ID = saved;
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  });

  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
