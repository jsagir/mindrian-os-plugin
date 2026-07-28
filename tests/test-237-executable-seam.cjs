#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 237-05 -- executable seam-liveness (REACH-01, Task 2)
 * =======================================================================
 * Real behavior proven: data/command-registry.json makes a CLAIM for every
 * command carrying a non-null `executable` block -- "this command is
 * executable via this script". The far end of that claim can quietly go
 * away: someone renames or deletes the claimed script, and nothing today
 * reports it. The registry keeps reading green while the join is dead.
 *
 * This test consumes the generic lib/core/seam-liveness.cjs::assertSeamLive
 * primitive (Phase 235-02, CIRS-02) rather than writing a fifth wrapper.
 * The module's three existing named wrappers (mint-ratifier liveness,
 * enqueue-consumer liveness, claimed-module liveness) are each documented
 * in that file as the wrong fit for THIS seam shape (a registry entry
 * naming a script path, probed by existence + file-type on disk).
 * assertSeamLive is the correct fit: pass claims + isLive, get back
 * { ok, claimedCount, liveCount, dead }.
 * There is deliberately no second parameter and no force flag -- no caller
 * of assertSeamLive can weaken this verdict.
 *
 * isLive never requires, evals, or spawns the claimed script. It only
 * resolves the declared path against the repo root (asserting the
 * resolved path stays under the repo root, mirroring
 * scripts/write-scope-check.cjs::targetRoomUnderRoot's containment check)
 * and calls fs.existsSync + fs.statSync(...).isFile(). Turning a liveness
 * probe into an execution path would itself be the vulnerability this test
 * exists to rule out (T-237-05-03).
 *
 * Leg map (4 legs):
 *   Leg 1 REAL SEAM:       every command in data/command-registry.json
 *                          whose executable.script is a non-empty string is
 *                          a claim; assertSeamLive over the real registry
 *                          returns ok:true, claimedCount > 0, dead:[].
 *                          claimedCount > 0 is load-bearing (T-237-05-06):
 *                          zero claims is vacuously live in the primitive,
 *                          so without this assertion the gate cannot fail.
 *   Leg 2 POSITIVE CONTROL: /mos:snapshot specifically is among the real
 *                          claims and its resolved script path exists, so a
 *                          future refactor that silently empties the claim
 *                          set is caught by name, not only by count.
 *   Leg 3 SEEDED-DEAD FIXTURE: a synthetic, in-memory claim list containing
 *                          one command whose declared script does not
 *                          exist -> assertSeamLive returns ok:false and the
 *                          missing entry appears in dead. No file in the
 *                          working tree is touched for this leg.
 *   Leg 4 TRAVERSAL GUARD: a synthetic claim whose declared script path
 *                          escapes the repo root (../../etc/passwd) resolves
 *                          to NOT live (T-237-05-02), proving isLive fails
 *                          closed on traversal rather than following it.
 *
 * The live rename-and-restore mutation proof (renaming
 * scripts/generate-hub.cjs, re-running this file, observing the non-zero
 * exit naming /mos:snapshot in dead, then reverting) is demonstrated
 * separately and captured in 237-05-SUMMARY.md; it is not re-enacted here
 * because this file must stay a pure, repeatable node:assert suite that
 * never mutates the working tree.
 *
 * Harness shape: the assert(cond, label) / failures counter / process.exit
 * pattern used across tests/ (lib/core/seam-liveness.test.cjs,
 * tests/test-connector-tripwire.cjs), not a test-runner framework.
 *
 * bash/node only. No em-dashes.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const { assertSeamLive } = require(path.join(REPO_ROOT, 'lib', 'core', 'seam-liveness.cjs'));

let failures = 0;
function check(cond, label) {
  if (cond) {
    console.log('  ok  ' + label);
  } else {
    console.error('  FAIL  ' + label);
    failures += 1;
  }
}

// ---------------------------------------------------------------------------
// isLive: resolve a claimed command's declared script against the repo root,
// refuse to follow it outside the repo, then check existence + file-type
// only. No require, no eval, no exec, no spawn.
// ---------------------------------------------------------------------------
function resolveUnderRoot(scriptPath) {
  const resolved = path.resolve(REPO_ROOT, scriptPath);
  const rel = path.relative(REPO_ROOT, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null; // escapes the repo root -- fail closed, never followed
  }
  return resolved;
}

function isLive(cmd) {
  const script = cmd && cmd.executable && cmd.executable.script;
  if (typeof script !== 'string' || script.length === 0) return false;
  const resolved = resolveUnderRoot(script);
  if (!resolved) return false;
  try {
    return fs.existsSync(resolved) && fs.statSync(resolved).isFile();
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Leg 1 + 2: the real seam, over the real generated registry.
// ---------------------------------------------------------------------------
const registryPath = path.join(REPO_ROOT, 'data', 'command-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const claims = registry.commands.filter(
  (c) =>
    c &&
    c.executable &&
    typeof c.executable === 'object' &&
    typeof c.executable.script === 'string' &&
    c.executable.script.length > 0
);

const verdict = assertSeamLive({
  name: 'command-registry-executable-claim-names-a-live-script',
  claims,
  isLive,
});

check(
  verdict.claimedCount > 0,
  '1a: the real registry carries at least one executable claim (claimedCount > 0, the gate can fail)'
);
check(
  verdict.ok === true,
  '1b: every real executable claim names a live script (ok:true, dead: ' +
    JSON.stringify((verdict.dead || []).map((c) => c && c.command)) +
    ')'
);
check(
  Array.isArray(verdict.dead) && verdict.dead.length === 0,
  '1c: the dead list is empty for the real registry'
);

const snapshotClaim = claims.find((c) => c.command === '/mos:snapshot');
check(
  !!snapshotClaim,
  '2a: /mos:snapshot is among the real executable claims (caught by name, not only by count)'
);
if (snapshotClaim) {
  const resolvedSnapshotScript = resolveUnderRoot(snapshotClaim.executable.script);
  check(
    !!resolvedSnapshotScript && fs.existsSync(resolvedSnapshotScript),
    '2b: /mos:snapshot resolved script path exists on disk (' + snapshotClaim.executable.script + ')'
  );
}

// ---------------------------------------------------------------------------
// Leg 3: seeded-dead fixture. In-memory only -- no file in the working tree
// is renamed or deleted for this leg.
// ---------------------------------------------------------------------------
{
  const fixtureClaims = [
    { command: '/mos:snapshot', executable: { script: 'scripts/generate-hub.cjs' } },
    { command: '/mos:does-not-exist', executable: { script: 'scripts/this-script-does-not-exist.cjs' } },
  ];
  const fixtureVerdict = assertSeamLive({
    name: 'seeded-dead-fixture',
    claims: fixtureClaims,
    isLive,
  });
  check(
    fixtureVerdict.ok === false,
    '3a: the seeded-dead fixture reports ok:false'
  );
  check(
    fixtureVerdict.dead.some((c) => c.command === '/mos:does-not-exist'),
    '3b: the missing entry (/mos:does-not-exist) appears in dead'
  );
  check(
    !fixtureVerdict.dead.some((c) => c.command === '/mos:snapshot'),
    '3c: the live entry (/mos:snapshot) in the same fixture is not flagged dead'
  );
}

// ---------------------------------------------------------------------------
// Leg 4: traversal guard. A claimed script path that escapes the repo root
// must resolve to NOT live, never be followed (T-237-05-02).
// ---------------------------------------------------------------------------
{
  const traversalClaims = [
    { command: '/mos:traversal-fixture', executable: { script: '../../../../etc/passwd' } },
  ];
  const traversalVerdict = assertSeamLive({
    name: 'traversal-guard-fixture',
    claims: traversalClaims,
    isLive,
  });
  check(
    traversalVerdict.ok === false &&
      traversalVerdict.dead.some((c) => c.command === '/mos:traversal-fixture'),
    '4: a claimed script path that escapes the repo root is treated as dead, never followed'
  );
}

// ---------------------------------------------------------------------------
// Epilogue
// ---------------------------------------------------------------------------
console.log('');
if (failures > 0) {
  console.error('test-237-executable-seam: ' + failures + ' FAILURE(S)');
} else {
  console.log('test-237-executable-seam: all checks passed');
}
process.exit(failures > 0 ? 1 : 0);
