'use strict';
/*
 * Phase 144.1-08 Task 2 -- RETRO-07c the exhaustive-coverage count gate.
 *
 * The capstone gate that lets Phase 146 certify a FULLY WIRED MindrianOS across
 * the WHOLE surface set (not a sample). It asserts that EVERY live command +
 * skill + agent on disk is classified EXACTLY ONCE: either WIRED (a connector in
 * data/connector-registry.json) or EXPLICITLY out-of-spine (a key in
 * data/connector-out-of-spine-allowlist.json with a non-empty reason). Zero
 * silently-unclassified surfaces; zero double-classified surfaces.
 *
 * Threat-model coverage (from the 144.1-08 PLAN threat_model):
 *   T-144.1-23 (a surface silently unclassified) -> assert wired + allowlisted === live
 *   T-144.1-25 (hardcoded 112/114 masking a new surface) -> derive the live count
 *              from the directories, NEVER a constant.
 *
 * The id scheme MUST match the registry generator (build-connector-registry.cjs):
 *   command -> "/mos:<base>"   skill -> "skill:<base>"   agent -> "agent:<base>"
 *
 * Pure: reads only the filesystem + the two JSON artifacts. No Brain, no network.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const AGENTS_DIR = path.join(REPO_ROOT, 'agents');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'connector-registry.json');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'data', 'connector-out-of-spine-allowlist.json');

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// ---------------------------------------------------------------------------
// (1) Enumerate the LIVE surfaces by reading the directories. The count is
//     DERIVED, never hardcoded (T-144.1-25). Same id scheme as the generator.
// ---------------------------------------------------------------------------
function liveSurfaceIds() {
  const out = new Set();

  let cmdFiles = [];
  try {
    cmdFiles = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md')).sort();
  } catch (_e) { cmdFiles = []; }
  for (const f of cmdFiles) out.add('/mos:' + f.replace(/\.md$/, ''));

  let skillDirs = [];
  try {
    skillDirs = fs
      .readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch (_e) { skillDirs = []; }
  for (const d of skillDirs) {
    if (fs.existsSync(path.join(SKILLS_DIR, d, 'SKILL.md'))) out.add('skill:' + d);
  }

  let agentFiles = [];
  try {
    agentFiles = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md')).sort();
  } catch (_e) { agentFiles = []; }
  for (const f of agentFiles) out.add('agent:' + f.replace(/\.md$/, ''));

  return out;
}

const live = liveSurfaceIds();

// ---------------------------------------------------------------------------
// (2) Load the WIRED set (registry surface ids) and the ALLOW-LIST keys.
// ---------------------------------------------------------------------------
let wired = new Set();
let allowlist = {};
let loadErr = null;
try {
  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const connectors = Array.isArray(reg.connectors) ? reg.connectors : [];
  wired = new Set(connectors.map((c) => c.surface));
  const al = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  allowlist = (al && typeof al.allowlist === 'object' && al.allowlist) || {};
} catch (e) { loadErr = e; }

(function check0_loaded() {
  const label = 'CHECK 0 - registry + allow-list load and are non-empty';
  try {
    assert.equal(loadErr, null, label + ': failed to load artifacts: ' + (loadErr && loadErr.message));
    assert.ok(live.size > 0, label + ': expected at least one live surface on disk');
    assert.ok(wired.size > 0, label + ': expected at least one wired connector in the registry');
    assert.ok(Object.keys(allowlist).length > 0, label + ': expected at least one allow-list entry');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// (3) Every live surface is in (wired UNION allowlisted). FAIL listing any
//     surface in NEITHER (silently unclassified) -- T-144.1-23.
// ---------------------------------------------------------------------------
(function check1_noUnclassified() {
  const label = 'CHECK 1 - every live surface is wired OR allow-listed (zero silently-unclassified)';
  try {
    const allow = new Set(Object.keys(allowlist));
    const unclassified = [...live].filter((s) => !wired.has(s) && !allow.has(s)).sort();
    assert.equal(
      unclassified.length, 0,
      label + ': ' + unclassified.length + ' surface(s) classified in NEITHER the registry nor the allow-list:\n      ' +
        unclassified.join('\n      ')
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// (4) No surface is in BOTH wired and allowlisted (wired XOR excluded).
// ---------------------------------------------------------------------------
(function check2_noDoubleClassified() {
  const label = 'CHECK 2 - no surface is BOTH wired and allow-listed (wired XOR excluded)';
  try {
    const allow = new Set(Object.keys(allowlist));
    const both = [...allow].filter((s) => wired.has(s)).sort();
    assert.equal(
      both.length, 0,
      label + ': ' + both.length + ' surface(s) double-classified (in registry AND allow-list):\n      ' +
        both.join('\n      ')
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// (5) Every allow-list key is a LIVE surface (no stale allow-list entry that
//     references a deleted/renamed surface) and carries a non-empty reason.
// ---------------------------------------------------------------------------
(function check3_allowlistEntriesValid() {
  const label = 'CHECK 3 - every allow-list entry is a live surface with a non-empty reason';
  try {
    const staleKeys = Object.keys(allowlist).filter((k) => !live.has(k)).sort();
    assert.equal(
      staleKeys.length, 0,
      label + ': ' + staleKeys.length + ' allow-list key(s) reference a non-live surface:\n      ' +
        staleKeys.join('\n      ')
    );
    const noReason = Object.keys(allowlist).filter(
      (k) => typeof allowlist[k] !== 'string' || allowlist[k].trim() === ''
    ).sort();
    assert.equal(
      noReason.length, 0,
      label + ': ' + noReason.length + ' allow-list key(s) carry an empty reason:\n      ' +
        noReason.join('\n      ')
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// (6) The two out-of-spine agents appear on the allow-list with their reasons.
// ---------------------------------------------------------------------------
(function check4_outOfSpineAgents() {
  const label = 'CHECK 4 - the 2 out-of-spine agents (framework-runner, larry-extended) are allow-listed';
  try {
    for (const a of ['agent:framework-runner', 'agent:larry-extended']) {
      assert.ok(
        typeof allowlist[a] === 'string' && allowlist[a].trim().length > 0,
        label + ': ' + a + ' must appear on the allow-list with a non-empty reason'
      );
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// (7) The count identity: wired + allowlisted === live (each classified once).
// ---------------------------------------------------------------------------
(function check5_countIdentity() {
  const label = 'CHECK 5 - wired + allowlisted === live (the exhaustive count identity)';
  try {
    const W = wired.size;
    const A = Object.keys(allowlist).length;
    const L = live.size;
    process.stdout.write('    live=' + L + ', wired=' + W + ', allowlisted=' + A + '\n');
    assert.equal(
      W + A, L,
      label + ': wired (' + W + ') + allowlisted (' + A + ') !== live (' + L + ')'
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('connector exhaustive-coverage gate: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
