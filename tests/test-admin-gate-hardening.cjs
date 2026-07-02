#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick(admin-gate-hardening) -- the 5-case gate proof.
 * =====================================================
 * Exercises both the pure checker (scripts/check-admin-identity.cjs) and the
 * live UserPromptSubmit hook (scripts/admin-command-gate.cjs) as a real
 * subprocess, feeding a synthetic prompt on stdin and asserting the exit code.
 *
 *   (a) non-admin identity  -> hard block (exit 2), command never runs
 *   (b) admin via MOS_ADMIN=true -> passes (exit 0)
 *   (c) admin via hardcoded username/home -> passes (exit 0)
 *   (d) allowlist config grants a listed identity with no hardcoded match
 *   (e) an ordinary (non-admin-gated) command is NEVER blocked
 *
 * Pure CJS, node:assert, no npm deps. NO em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const GATE = path.join(REPO, 'scripts', 'admin-command-gate.cjs');
const CHECKER = path.join(REPO, 'scripts', 'check-admin-identity.cjs');

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass += 1; console.log('  ok  - ' + name); } else { fail += 1; console.log('  FAIL- ' + name); }
}

// runGate -- fire the hook as a subprocess with a controlled env + stdin prompt.
// Returns { status, stderr }. A clean env (no inherited MOS_ADMIN etc.) is built
// explicitly so the test is deterministic regardless of who runs it.
function runGate(prompt, env) {
  const res = spawnSync('node', [GATE], {
    input: JSON.stringify({ prompt }),
    env,
    encoding: 'utf8',
  });
  return { status: res.status, stderr: res.stderr || '' };
}

// A deterministic NON-admin env: no MOS_ADMIN, a neutral username + home, and an
// allowlist path pointed at a guaranteed-absent file so no stray real config on
// the running machine leaks in.
function nonAdminEnv(extra) {
  const base = {
    PATH: process.env.PATH,
    USER: 'randomcustomer',
    USERNAME: 'randomcustomer',
    HOME: '/home/randomcustomer',
    MINDRIAN_ADMIN_IDENTITY_PATH: path.join(os.tmpdir(), 'no-such-admin-identity-' + process.pid + '.json'),
  };
  return Object.assign(base, extra || {});
}

console.log('test-admin-gate-hardening');

// --- Case (a): non-admin typing /mos:admin -> hard block (exit 2) ----------
{
  const { status, stderr } = runGate('/mos:admin keys', nonAdminEnv());
  ok('(a) non-admin /mos:admin blocked with exit 2', status === 2);
  ok('(a) block renders "Command not found: admin"', /Command not found: admin/.test(stderr));
  ok('(a) block renders "Not an admin user"', /Not an admin user/.test(stderr));
}

// --- Case (b): admin via MOS_ADMIN=true -> passes (exit 0) ------------------
{
  const { status } = runGate('/mos:admin', nonAdminEnv({ MOS_ADMIN: 'true' }));
  ok('(b) MOS_ADMIN=true passes with exit 0', status === 0);
}

// --- Case (c): admin via hardcoded username / home -> passes ---------------
{
  const byUser = runGate('/mos:admin', nonAdminEnv({ USER: 'jsagi', USERNAME: 'jsagi' }));
  ok('(c) hardcoded username jsagi passes with exit 0', byUser.status === 0);
  const byHome = runGate('/mos:admin', nonAdminEnv({ USER: 'someone', USERNAME: 'someone', HOME: '/home/jsagi' }));
  ok('(c) hardcoded home /home/jsagi passes with exit 0', byHome.status === 0);
}

// --- Case (d): allowlist config grants a listed identity -------------------
{
  const cfgPath = path.join(os.tmpdir(), 'admin-identity-test-' + process.pid + '.json');
  fs.writeFileSync(cfgPath, JSON.stringify({
    usernames: ['deployadmin'],
    homes: ['/home/deployadmin'],
    env_flags: ['DEPLOY_ADMIN'],
  }));
  try {
    // Identity 'deployadmin' matches NONE of the hardcoded conditions but IS in
    // the allowlist -> must pass.
    const byAllowUser = runGate('/mos:admin', nonAdminEnv({
      USER: 'deployadmin', USERNAME: 'deployadmin', HOME: '/home/deployadmin',
      MINDRIAN_ADMIN_IDENTITY_PATH: cfgPath,
    }));
    ok('(d) allowlisted username passes with exit 0', byAllowUser.status === 0);

    // And the same machine WITHOUT the allowlist (absent file) blocks the same
    // identity -> proves the allowlist is what granted access.
    const withoutAllow = runGate('/mos:admin', nonAdminEnv({
      USER: 'deployadmin', USERNAME: 'deployadmin', HOME: '/home/deployadmin',
    }));
    ok('(d) same identity blocked (exit 2) when allowlist absent', withoutAllow.status === 2);

    // Extra: an allowlisted env flag grants access too.
    const byAllowFlag = runGate('/mos:admin', nonAdminEnv({
      DEPLOY_ADMIN: 'true', MINDRIAN_ADMIN_IDENTITY_PATH: cfgPath,
    }));
    ok('(d) allowlisted env flag passes with exit 0', byAllowFlag.status === 0);
  } finally {
    try { fs.unlinkSync(cfgPath); } catch (_) { /* best-effort */ }
  }
}

// --- Case (e): an ordinary command is NEVER blocked ------------------------
{
  // A non-admin user typing an ordinary command must pass (exit 0). /mos:help
  // is the critical case: help.md mentions "visibility: admin" in its BODY but
  // NOT in its frontmatter, so the frontmatter-only scan must not gate it.
  const help = runGate('/mos:help', nonAdminEnv());
  ok('(e) /mos:help NOT blocked for non-admin (exit 0)', help.status === 0);
  const scout = runGate('/mos:diagnose the problem', nonAdminEnv());
  ok('(e) ordinary /mos:diagnose NOT blocked for non-admin (exit 0)', scout.status === 0);
  // A mid-sentence mention of the admin command is not a leading invocation.
  const mention = runGate('please explain what /mos:admin does', nonAdminEnv());
  ok('(e) mid-sentence mention of /mos:admin NOT blocked (exit 0)', mention.status === 0);
  // dogfood-flush (the second visibility:admin command) IS blocked for non-admin.
  const flush = runGate('/mos:dogfood-flush', nonAdminEnv());
  ok('(e-inverse) /mos:dogfood-flush IS blocked for non-admin (exit 2)', flush.status === 2);
}

// --- Checker CLI --json contract -------------------------------------------
{
  const res = spawnSync('node', [CHECKER, '--json'], { env: nonAdminEnv(), encoding: 'utf8' });
  let parsed = null;
  try { parsed = JSON.parse(res.stdout.trim()); } catch (_) { /* leave null */ }
  ok('checker --json emits parseable verdict', parsed !== null);
  ok('checker --json non-admin -> admin:false + exit 1', parsed && parsed.admin === false && res.status === 1);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
