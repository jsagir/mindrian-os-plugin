#!/usr/bin/env node
'use strict';

/**
 * resolveEffectiveSessionId -- the ONE shared implementation of the
 * MCP-extra session-id precedence rule (explicit param > extra.sessionId >
 * process.env.CLAUDE_CODE_SESSION_ID > null).
 *
 * RCA registry-active-room-concurrent-session-collision (quick task rt8): on
 * the stdio transport (local Claude Code CLI) the MCP SDK never populates
 * extra.sessionId, so every sibling tool that did the bare
 * `(extra && extra.sessionId) || undefined` failed to resolve a session id and
 * fell through to the wrong machine-wide path. room_bind already carried the
 * 3-tier fallback; this helper extracts it so every call site shares it.
 *
 * These 5 legs pin the precedence exactly:
 *   1. explicit param truthy + extra.sessionId + env all present -> explicit wins.
 *   2. explicit undefined, extra.sessionId present, env different -> extra wins.
 *   3. explicit undefined, extra.sessionId absent, env set -> env wins (the
 *      exact stdio bug this fix closes).
 *   4. explicit undefined, extra absent, env unset -> null (fail closed; must
 *      NOT return undefined or throw, matches room_bind's no_session_id contract).
 *   5. extra is null (not just missing the key) -> does not throw, falls through
 *      to the env/null legs exactly as extra=undefined would.
 *
 * Node built-in assert only. No test framework. CJS only. No em-dashes.
 * process.env.CLAUDE_CODE_SESSION_ID is saved/restored around every leg that
 * touches it.
 */

const assert = require('node:assert');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const { resolveEffectiveSessionId } = require(
  path.join(PLUGIN_ROOT, 'lib', 'core', 'session-binding.cjs')
);

let failed = 0;
function check(name, fn) {
  const saved = process.env.CLAUDE_CODE_SESSION_ID;
  try {
    fn();
    process.stdout.write('  ok ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' +
      (err && err.message ? err.message : err) + '\n');
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = saved;
  }
}

// Leg 1: explicit param always wins over both extra.sessionId and the env var.
check('explicit param wins over extra.sessionId and env', () => {
  process.env.CLAUDE_CODE_SESSION_ID = 'env-id';
  const got = resolveEffectiveSessionId('explicit-id', { sessionId: 'sdk-id' });
  assert.strictEqual(got, 'explicit-id',
    'explicit param must beat both extra.sessionId and the env var');
});

// Leg 2: with no explicit param, the SDK-supplied extra.sessionId beats the env.
check('extra.sessionId beats env when explicit is undefined', () => {
  process.env.CLAUDE_CODE_SESSION_ID = 'env-id';
  const got = resolveEffectiveSessionId(undefined, { sessionId: 'sdk-id' });
  assert.strictEqual(got, 'sdk-id',
    'extra.sessionId (SDK) must beat CLAUDE_CODE_SESSION_ID');
});

// Leg 3: the exact stdio bug -- extra.sessionId absent, env set -> env wins.
check('env wins when explicit undefined and extra.sessionId absent (stdio shape)', () => {
  process.env.CLAUDE_CODE_SESSION_ID = 'env-id';
  const got = resolveEffectiveSessionId(undefined, {});
  assert.strictEqual(got, 'env-id',
    'CLAUDE_CODE_SESSION_ID must resolve when extra.sessionId is absent (stdio)');
});

// Leg 4: nothing resolves -> null (fail closed), never undefined, never a throw.
check('returns null when nothing resolves (fail closed)', () => {
  delete process.env.CLAUDE_CODE_SESSION_ID;
  const got = resolveEffectiveSessionId(undefined, undefined);
  assert.strictEqual(got, null,
    'must return null (not undefined) when no source resolves');
});

// Leg 5: extra is null (not merely missing) must not throw; falls through.
check('extra=null does not throw and falls through to env/null', () => {
  delete process.env.CLAUDE_CODE_SESSION_ID;
  const gotNull = resolveEffectiveSessionId(undefined, null);
  assert.strictEqual(gotNull, null,
    'extra=null with no env must fall through to null, not throw');

  process.env.CLAUDE_CODE_SESSION_ID = 'env-id';
  const gotEnv = resolveEffectiveSessionId(undefined, null);
  assert.strictEqual(gotEnv, 'env-id',
    'extra=null with env set must fall through to the env value');
});

process.stdout.write('\nresolve-effective-session-id: ' +
  (failed === 0 ? 'ALL PASS' : failed + ' FAILED') + '\n');
process.exit(failed === 0 ? 0 : 1);
