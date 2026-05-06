'use strict';
/*
 * Phase 117-01 Wave 1 -- real assertions for scripts/auto-explore-fingerprint.cjs
 * + lib/agents/auto-explore-agent.cjs + hooks/hooks.json wiring.
 * Replaces the Phase 117-00 Wave 0 stub (which only verified EVENT_TYPES).
 *
 * Tests (13 real assertions):
 *  1.  Hook with non-Write tool -> exits silently, envelope continue:true, no spawn
 *  2.  Hook with file outside .room-root -> exits silently, no spawn
 *  3.  Hook with no room.db (Tier 0) -> ledger gets 'failed' entry suppress_reason='tier_0'
 *  4.  detectFirstMaterial (agent) returns is_first_material:false on missing roomDir
 *  5.  detectFirstMaterial returns Tier 1 on artifactCount in [0..4]
 *  6.  detectFirstMaterial returns Tier 2 on artifactCount >= 5
 *  7.  Hook never writes to stderr on success path
 *  8.  Hook does NOT require room-db.cjs (chokepoint preserved)
 *  9.  Hook + agent do NOT contain ADDRESSES_PROBLEM_TYPE substring (Brain Section 8.7)
 * 10.  hooks/hooks.json valid JSON + PostToolUse fingerprint entry present
 * 11.  hooks/hooks.json SessionStart preflight-auto-explore entry present
 * 12.  Detached spawn pattern present in fingerprint hook (regex check)
 * 13.  preflight-auto-explore.cjs sweepStaleInFlight only (Wave 1 surface)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const FINGERPRINT_HOOK = path.join(REPO_ROOT, 'scripts', 'auto-explore-fingerprint.cjs');
const PREFLIGHT_HOOK = path.join(REPO_ROOT, 'scripts', 'preflight-auto-explore.cjs');
const AGENT = path.join(REPO_ROOT, 'lib', 'agents', 'auto-explore-agent.cjs');
const HOOKS_JSON = path.join(REPO_ROOT, 'hooks', 'hooks.json');

const store = require('../lib/memory/explored-materials-store.cjs');
const agent = require('../lib/agents/auto-explore-agent.cjs');

function runHook(stdinJson, opts) {
  const env = Object.assign({}, process.env, (opts && opts.env) || {});
  return spawnSync('node', [FINGERPRINT_HOOK], {
    input: stdinJson,
    env: env,
    encoding: 'utf8',
    timeout: 5000,
  });
}

// 1. Non-Write tool -> exits silently
test('hook ignores non-Write tools and emits empty envelope', () => {
  const res = runHook(JSON.stringify({ tool_name: 'Read', tool_input: { file_path: '/tmp/x' } }));
  assert.equal(res.status, 0);
  const env = JSON.parse(res.stdout);
  assert.equal(env.continue, true);
});

// 2. file_path outside .room-root -> exits silently
test('hook ignores files outside .room-root', () => {
  // Create a temp file in /tmp that has no .room-root anywhere upstream.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase117-01-no-room-'));
  try {
    const f = path.join(tmpDir, 'file.md');
    fs.writeFileSync(f, 'hello');
    const res = runHook(JSON.stringify({ tool_name: 'Write', tool_input: { file_path: f } }));
    assert.equal(res.status, 0);
    const env = JSON.parse(res.stdout);
    assert.equal(env.continue, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// 3. No room.db -> Tier 0 -> ledger gets 'failed' suppress_reason='tier_0'
test('hook with .room-root but no room.db marks Tier 0 in ledger', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase117-01-tier0-'));
  const slug = path.basename(tmpDir);
  try {
    fs.writeFileSync(path.join(tmpDir, '.room-root'), '');
    const sectionDir = path.join(tmpDir, 'problem-definition');
    fs.mkdirSync(sectionDir);
    const f = path.join(sectionDir, 'cv.md');
    fs.writeFileSync(f, 'cv content');
    const res = runHook(JSON.stringify({ tool_name: 'Write', tool_input: { file_path: f } }));
    assert.equal(res.status, 0);
    const env = JSON.parse(res.stdout);
    assert.equal(env.continue, true);
    // Ledger should contain a 'failed' entry with suppress_reason='tier_0'.
    const all = store.readMaterials(slug);
    assert.equal(all.length, 1);
    assert.equal(all[0].state, 'failed');
    assert.equal(all[0].suppress_reason, 'tier_0');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    try { fs.rmSync(store.jsonlPath(slug), { force: true }); } catch (_e) { /* tolerate */ }
  }
});

// 4. detectFirstMaterial: missing roomDir -> invalid_args
test('detectFirstMaterial returns invalid_args on missing roomDir', () => {
  const r = agent.detectFirstMaterial({ relativeFilePath: 'cv.md', mtimeMs: 1746543210000, artifactCount: 0 });
  assert.equal(r.is_first_material, false);
  assert.equal(r.tier, 0);
  assert.equal(r.suppress_reason, 'invalid_args');
});

// 5. detectFirstMaterial: Tier 1 on artifactCount in [0..4]
test('detectFirstMaterial returns Tier 1 for artifactCount in [0..4]', () => {
  for (const ac of [0, 1, 4]) {
    const r = agent.detectFirstMaterial({
      roomDir: '/abs/room',
      relativeFilePath: 'cv.md',
      mtimeMs: 1746543210000,
      artifactCount: ac,
    });
    assert.equal(r.is_first_material, true);
    assert.equal(r.tier, 1);
    assert.match(r.material_id, /^[0-9a-f]{32}$/);
    assert.equal(r.suppress_reason, null);
  }
});

// 6. detectFirstMaterial: Tier 2 on artifactCount >= 5
test('detectFirstMaterial returns Tier 2 for artifactCount >= 5', () => {
  const r = agent.detectFirstMaterial({
    roomDir: '/abs/room',
    relativeFilePath: 'cv.md',
    mtimeMs: 1746543210000,
    artifactCount: 25,
  });
  assert.equal(r.is_first_material, true);
  assert.equal(r.tier, 2);
});

// 7. Hook does not write to stderr on success
test('hook does not write to stderr on Tier 0 success path', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase117-01-stderr-'));
  const slug = path.basename(tmpDir);
  try {
    fs.writeFileSync(path.join(tmpDir, '.room-root'), '');
    const sectionDir = path.join(tmpDir, 'problem-definition');
    fs.mkdirSync(sectionDir);
    const f = path.join(sectionDir, 'cv.md');
    fs.writeFileSync(f, 'cv');
    const res = runHook(JSON.stringify({ tool_name: 'Write', tool_input: { file_path: f } }));
    assert.equal(res.status, 0);
    assert.equal(String(res.stderr || ''), '');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    try { fs.rmSync(store.jsonlPath(slug), { force: true }); } catch (_e) { /* tolerate */ }
  }
});

// 8. Chokepoint preserved (no room-db.cjs require in any of the 3 modules)
test('fingerprint hook + agent + preflight do NOT require room-db.cjs', () => {
  for (const f of [FINGERPRINT_HOOK, AGENT, PREFLIGHT_HOOK]) {
    const src = fs.readFileSync(f, 'utf8');
    assert.equal(/require\(['"](\.\.?\/)+(lib\/)?core\/room-db/.test(src), false, 'chokepoint violated in ' + f);
  }
});

// Strip comments for executable-code-only scans.
function stripComments(src) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

// 9. LOCAL-only routing invariant (Brain Section 8.7 / AUTOEXPLORE-117-17)
//    Scan executable code only -- comments mentioning the invariant are allowed.
test('agent + fingerprint hook executable code contains ZERO ADDRESSES_PROBLEM_TYPE substrings', () => {
  for (const f of [AGENT, FINGERPRINT_HOOK]) {
    const src = fs.readFileSync(f, 'utf8');
    const code = stripComments(src);
    assert.equal(code.includes('ADDRESSES_PROBLEM_TYPE'), false, 'AUTOEXPLORE-117-17 violated in ' + f);
  }
});

// 10. hooks/hooks.json: valid JSON + PostToolUse Write|Edit|MultiEdit entry
test('hooks.json is valid JSON + contains auto-explore-fingerprint entry under PostToolUse', () => {
  const raw = fs.readFileSync(HOOKS_JSON, 'utf8');
  const obj = JSON.parse(raw); // throws if invalid
  assert.ok(obj.hooks);
  assert.ok(Array.isArray(obj.hooks.PostToolUse));
  // At least one PostToolUse entry must reference auto-explore-fingerprint.cjs.
  const flat = JSON.stringify(obj.hooks.PostToolUse);
  assert.ok(flat.includes('auto-explore-fingerprint.cjs'));
  // The entry must use matcher Write|Edit|MultiEdit.
  const entry = obj.hooks.PostToolUse.find((e) =>
    Array.isArray(e.hooks) && e.hooks.some((h) => typeof h.command === 'string' && h.command.includes('auto-explore-fingerprint.cjs')));
  assert.ok(entry, 'PostToolUse fingerprint entry must exist');
  assert.equal(entry.matcher, 'Write|Edit|MultiEdit');
});

// 11. hooks/hooks.json: SessionStart preflight-auto-explore entry
test('hooks.json contains preflight-auto-explore.cjs under SessionStart', () => {
  const raw = fs.readFileSync(HOOKS_JSON, 'utf8');
  const obj = JSON.parse(raw);
  assert.ok(Array.isArray(obj.hooks.SessionStart));
  const flat = JSON.stringify(obj.hooks.SessionStart);
  assert.ok(flat.includes('preflight-auto-explore.cjs'));
  const entry = obj.hooks.SessionStart.find((e) =>
    Array.isArray(e.hooks) && e.hooks.some((h) => typeof h.command === 'string' && h.command.includes('preflight-auto-explore.cjs')));
  assert.ok(entry, 'SessionStart preflight entry must exist');
  assert.equal(entry.matcher, 'startup|clear|compact');
});

// 12. Detached spawn pattern present in fingerprint hook
test('auto-explore-fingerprint.cjs uses detached spawn pattern', () => {
  const src = fs.readFileSync(FINGERPRINT_HOOK, 'utf8');
  assert.match(src, /detached:\s*true/, 'spawn must be detached');
  assert.match(src, /\.unref\(\)/, 'parent must call unref()');
  assert.match(src, /stdio:\s*['"]ignore['"]/, 'stdio must be ignored on spawn');
});

// 13. preflight-auto-explore.cjs is Wave 1 substrate only (sweepStaleInFlight)
//     Scan executable code only -- comments may mention future Wave plumbing.
test('preflight-auto-explore.cjs Wave 1 executable code surface is sweepStaleInFlight only', () => {
  const src = fs.readFileSync(PREFLIGHT_HOOK, 'utf8');
  const code = stripComments(src);
  assert.match(code, /sweepStaleInFlight/, 'Wave 1 must call sweepStaleInFlight');
  // Wave 1 executable code must NOT yet glob auto-explore-*.json (lands 117-03).
  assert.equal(/glob\(/.test(code), false,
    'Wave 1 must NOT yet implement UserPromptSubmit glob drain (lands in 117-03)');
  assert.equal(/['"]auto-explore-\*\.json['"]/.test(code), false,
    'Wave 1 must NOT yet reference auto-explore-*.json glob pattern (lands in 117-03)');
});
