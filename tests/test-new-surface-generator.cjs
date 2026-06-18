'use strict';
/*
 * Phase 167-04 Task 1 - the /mos:new-surface generator test (HARN-03, D-167-05,
 * D-167-06).
 *
 * Covers the five Task-1 behaviors over scripts/build-new-surface.cjs:
 *   Test 1  emit a surface: a spec emits the surface .md to the correct dir
 *           (commands/ | agents/ | skills/<name>/SKILL.md) carrying ALL 11
 *           connector keys in the docs/CONNECTOR-CONTRACT.md order; a re-emit is
 *           idempotent (byte-stable). Emits to a TMP dir via the env-override,
 *           never the real commands/ tree.
 *   Test 2  frozen reach + posture: the emitter REFUSES an off-frozen reach_id
 *           (not in the frozen 6) and an off-frozen posture (not in the frozen
 *           3); a valid frozen reach + posture emits cleanly. A new tool identity
 *           must ride sub_mode, never a new reach_id.
 *   Test 3  transitive landing via regeneration: after emit (in a TMP mirror
 *           repo), the emitter shells out to regenerate connector-registry.json
 *           (the surface's REAL home) then the harness-manifest; the surface
 *           appears in connector-registry.json and the manifest --check exits 0.
 *           NO per-surface manifest row (D-166-03).
 *   Test 4  --check well-formed: build-new-surface.cjs --check asserts the
 *           surface is WELL-FORMED (11 keys, frozen reach, frozen posture) AND
 *           REGISTERED in connector-registry.json AND the harness-manifest
 *           --check is clean; a missing key / off-frozen reach yields a
 *           categorized finding + exit 1 + a recovery line.
 *   Test 5  zero Brain + ignite untouched: a forbidden-token scan over
 *           build-new-surface.cjs finds no mcp__brain_ / brain-client / raw
 *           fetch; commands/ignite.md is NOT modified by this phase.
 *
 * The fixture surface NEVER lands in the real commands/ tree: Tests 1/2/4 emit
 * to a TMP dir via MINDRIAN_SURFACE_OUT_DIR; Test 3 builds a full TMP mirror repo
 * and shells out within that cwd (LOW-5 / T-167-20).
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GEN_PATH = path.join(REPO_ROOT, 'scripts', 'build-new-surface.cjs');

const gen = require(GEN_PATH);

// The 11 connector keys, in the docs/CONNECTOR-CONTRACT.md order (the contract
// the emitter mirrors; build-connector-registry.cjs:89-101).
const EXPECTED_KEY_ORDER = [
  'connects_to_spine',
  'sensor_triggers',
  'reach_id',
  'sub_mode',
  'framework',
  'posture',
  'hierarchy_rank',
  'filing',
  'plan_gated',
  'web_scope',
  'surface',
];

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// A well-formed surface spec (frozen reach + frozen posture). framework:null +
// filing:none means the WFL-01 firesCommand gate does not fire (mirrors
// new-project.md), so the surface registers cleanly without a Brain framework.
function validSpec(overrides) {
  return Object.assign({
    kind: 'command',
    name: 'fixture-surface',
    connects_to_spine: true,
    sensor_triggers: ['SENS-01'],
    reach_id: 'context_block',
    sub_mode: 'fixture-tool',
    framework: null,
    posture: 'push_forward',
    hierarchy_rank: 42,
    filing: 'none',
    plan_gated: false,
    web_scope: null,
    surface: 'F.1',
  }, overrides || {});
}

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'new-surface-'));
}

// ---------------------------------------------------------------------------
// Test 1 - emit a surface to a TMP dir; 11 keys in contract order; idempotent.
// ---------------------------------------------------------------------------
(function test1_emit() {
  const label = 'Test 1 - emit 11-key surface to TMP dir + idempotent byte-stable re-emit';
  let tmp;
  try {
    tmp = mkTmp();
    const spec = validSpec();
    const res = gen.emitSurface(spec, { outDir: tmp });
    assert.ok(res && typeof res.path === 'string', label + ': emitSurface returns the emitted path');
    // The command surface lands at <tmp>/commands/<name>.md.
    const expectedPath = path.join(tmp, 'commands', spec.name + '.md');
    assert.equal(res.path, expectedPath, label + ': command surface lands at commands/<name>.md');
    assert.ok(fs.existsSync(expectedPath), label + ': the surface .md exists on disk');

    const body = fs.readFileSync(expectedPath, 'utf8');
    // The connector block carries ALL 11 keys.
    for (const k of EXPECTED_KEY_ORDER) {
      assert.ok(new RegExp('\\n\\s+' + k + ':').test(body),
        label + ': connector block carries key ' + k);
    }
    // The keys appear in the contract order.
    const idxs = EXPECTED_KEY_ORDER.map((k) => body.indexOf('\n  ' + k + ':'));
    for (let i = 1; i < idxs.length; i += 1) {
      assert.ok(idxs[i] > idxs[i - 1],
        label + ': key ' + EXPECTED_KEY_ORDER[i] + ' is after ' + EXPECTED_KEY_ORDER[i - 1]);
    }

    // Idempotent: re-emit produces a byte-identical file.
    const first = fs.readFileSync(expectedPath, 'utf8');
    gen.emitSurface(spec, { outDir: tmp });
    const second = fs.readFileSync(expectedPath, 'utf8');
    assert.equal(first, second, label + ': a re-emit of the same spec is byte-stable');

    // Real commands/ tree is untouched: no fixture-surface.md landed there.
    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'commands', spec.name + '.md')), false,
      label + ': the real commands/ tree is never polluted by the fixture');
    ok(label);
  } catch (e) { fail(label, e); }
  finally { if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ } } }
})();

// ---------------------------------------------------------------------------
// Test 1c - agent + skill kinds land in their correct dirs.
// ---------------------------------------------------------------------------
(function test1c_kinds() {
  const label = 'Test 1c - agent -> agents/<name>.md ; skill -> skills/<name>/SKILL.md';
  let tmp;
  try {
    tmp = mkTmp();
    const agentRes = gen.emitSurface(validSpec({ kind: 'agent', name: 'fixture-agent' }), { outDir: tmp });
    assert.equal(agentRes.path, path.join(tmp, 'agents', 'fixture-agent.md'),
      label + ': agent surface lands at agents/<name>.md');
    assert.ok(fs.existsSync(agentRes.path), label + ': agent .md exists');

    const skillRes = gen.emitSurface(validSpec({ kind: 'skill', name: 'fixture-skill' }), { outDir: tmp });
    assert.equal(skillRes.path, path.join(tmp, 'skills', 'fixture-skill', 'SKILL.md'),
      label + ': skill surface lands at skills/<name>/SKILL.md');
    assert.ok(fs.existsSync(skillRes.path), label + ': skill SKILL.md exists');
    ok(label);
  } catch (e) { fail(label, e); }
  finally { if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ } } }
})();

// ---------------------------------------------------------------------------
// Test 2 - frozen reach + posture refusal; a valid frozen pair emits cleanly.
// ---------------------------------------------------------------------------
(function test2_frozen() {
  const label = 'Test 2 - refuse off-frozen reach_id + posture; mint no new reach';
  let tmp;
  try {
    tmp = mkTmp();
    // An off-frozen reach_id (a 7th reach) is REFUSED.
    assert.throws(
      () => gen.emitSurface(validSpec({ reach_id: 'novel_reach' }), { outDir: tmp }),
      /reach_id|frozen/i,
      label + ': an off-frozen reach_id throws'
    );
    // An off-frozen posture is REFUSED.
    assert.throws(
      () => gen.emitSurface(validSpec({ posture: 'sideways' }), { outDir: tmp }),
      /posture|frozen/i,
      label + ': an off-frozen posture throws'
    );
    // A valid frozen reach + posture emits cleanly (no throw).
    const res = gen.emitSurface(validSpec({ name: 'frozen-ok', reach_id: 'hats', posture: 'hold' }), { outDir: tmp });
    assert.ok(fs.existsSync(res.path), label + ': a frozen reach + posture emits cleanly');
    ok(label);
  } catch (e) { fail(label, e); }
  finally { if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ } } }
})();

// ---------------------------------------------------------------------------
// Test 3 - transitive landing via regeneration in a TMP mirror repo.
//
// Build a minimal mirror repo (scripts/ + lib/ + data/ + commands/), emit the
// surface into it, and let the emitter shell out (execFileSync node) to
// regenerate connector-registry.json then the harness-manifest. Assert the
// surface appears in connector-registry.json and that the manifest --check exits
// 0. The real tree is never touched.
// ---------------------------------------------------------------------------
(function test3_transitive() {
  const label = 'Test 3 - transitive landing: emit -> regen connector-registry -> regen manifest -> manifest --check clean';
  let tmp;
  try {
    tmp = mkTmp();
    // Mirror the directories the two downstream generators read from.
    for (const d of ['scripts', 'data', 'commands', 'lib']) {
      fs.cpSync(path.join(REPO_ROOT, d), path.join(tmp, d), { recursive: true });
    }
    const spec = validSpec({ name: 'transitive-fixture' });
    // Emit into the mirror repo and regenerate the two downstream registries by
    // shelling out (the emitter does this when regenerate !== false).
    gen.emitSurface(spec, { outDir: tmp, cwd: tmp });

    const surfaceMd = path.join(tmp, 'commands', spec.name + '.md');
    assert.ok(fs.existsSync(surfaceMd), label + ': the surface .md landed in the mirror commands/ tree');

    // The surface is REGISTERED in connector-registry.json (its real home).
    const registry = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'connector-registry.json'), 'utf8'));
    const surfaceName = '/mos:' + spec.name;
    const found = registry.connectors.some((c) => c.surface === surfaceName);
    assert.ok(found, label + ': the surface is registered in connector-registry.json');

    // The harness-manifest --check is clean (the wiring digest reflects the new
    // surface). exit 0.
    let manifestCheckExit = 0;
    try {
      execFileSync('node', [path.join(tmp, 'scripts', 'build-harness-manifest.cjs'), '--check'],
        { cwd: tmp, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (err) {
      manifestCheckExit = err.status;
    }
    assert.equal(manifestCheckExit, 0, label + ': build-harness-manifest.cjs --check exits 0 after the emit');

    // NO per-surface manifest row (D-166-03): the manifest still names exactly
    // three maps; the surface is reflected transitively in the wiring digest.
    const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'harness-manifest.json'), 'utf8'));
    assert.equal(manifest.maps.length, 3, label + ': the manifest still names exactly three maps (no per-surface row)');
    assert.equal(manifest.maps.some((m) => m.role === surfaceName), false,
      label + ': no per-surface manifest entry for the new surface (D-166-03)');
    ok(label);
  } catch (e) { fail(label, e); }
  finally { if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ } } }
})();

// ---------------------------------------------------------------------------
// Test 4 - --check well-formed + registered + manifest-check clean; categorized
// findings + exit 1 + recovery line on a malformed / off-frozen surface.
// ---------------------------------------------------------------------------
(function test4_check() {
  const label = 'Test 4 - validateSurface categorized findings (MISSING_KEY / OFF_FROZEN / NOT_REGISTERED)';
  let tmp;
  try {
    tmp = mkTmp();
    // A well-formed emitted spec validates to zero findings on the well-formed +
    // frozen axes (NOT_REGISTERED is exercised against the real registry below).
    const wellFormed = gen.validateSurface(validSpec(), { outDir: tmp });
    assert.equal(wellFormed.missing_key.length, 0, label + ': a complete spec yields zero MISSING_KEY');
    assert.equal(wellFormed.off_frozen.length, 0, label + ': a frozen spec yields zero OFF_FROZEN');

    // A spec missing a connector key yields a MISSING_KEY finding.
    const missing = validSpec();
    delete missing.filing;
    const missingFindings = gen.validateSurface(missing, { outDir: tmp });
    assert.ok(missingFindings.missing_key.some((s) => /filing/.test(s)),
      label + ': a spec missing the filing key yields a MISSING_KEY finding');
    assert.ok(missingFindings.missing_key.some((s) => /node scripts\/build-new-surface\.cjs/.test(s)),
      label + ': the MISSING_KEY finding carries a recovery line');

    // An off-frozen reach yields an OFF_FROZEN finding.
    const offFrozen = gen.validateSurface(validSpec({ reach_id: 'novel_reach' }), { outDir: tmp });
    assert.ok(offFrozen.off_frozen.some((s) => /novel_reach|reach/.test(s)),
      label + ': an off-frozen reach yields an OFF_FROZEN finding');

    // runCheck on a tmp-emitted but NOT-registered surface exits 1 with a finding.
    // The emitter wrote the surface to TMP only; the real connector-registry does
    // not list it, so --check fires NOT_REGISTERED + exit 1.
    gen.emitSurface(validSpec({ name: 'unregistered-fixture' }), { outDir: tmp });
    let exitCode = 0;
    let stderr = '';
    try {
      execFileSync('node',
        [GEN_PATH, '--check', '--name', 'unregistered-fixture', '--kind', 'command'],
        { cwd: REPO_ROOT, env: Object.assign({}, process.env, { MINDRIAN_SURFACE_OUT_DIR: tmp }),
          stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (err) {
      exitCode = err.status;
      stderr = String(err.stderr || '');
    }
    assert.equal(exitCode, 1, label + ': --check on an unregistered surface exits 1');
    assert.ok(/NOT_REGISTERED|recovery|Run:/i.test(stderr),
      label + ': --check stderr carries a finding + recovery line');
    ok(label);
  } catch (e) { fail(label, e); }
  finally { if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ } } }
})();

// ---------------------------------------------------------------------------
// Test 5 - zero Brain egress + ignite untouched.
// ---------------------------------------------------------------------------
(function test5_part8() {
  const label = 'Test 5 - zero Brain / raw-fetch tokens in the emitter + ignite untouched';
  try {
    const src = fs.readFileSync(GEN_PATH, 'utf8');
    // Strip comment lines so a doc comment naming a forbidden token as prose does
    // not self-invalidate the scan (CJS comments lead with // or *).
    const codeLines = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
    const code = codeLines.join('\n');
    assert.equal(/mcp__brain_/.test(code), false, label + ': no mcp__brain_ token in the emitter');
    assert.equal(/brain-client/.test(code), false, label + ': no brain-client require in the emitter');
    assert.equal(/[^a-zA-Z_.]fetch\s*\(/.test(code), false, label + ': no raw fetch( egress in the emitter');

    // ignite is OUT of scope: commands/ignite.md exists and the emitter does not
    // reference it (the test asserts the emitter never names ignite as a write
    // target).
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'commands', 'ignite.md')),
      label + ': commands/ignite.md exists (untouched by this phase)');
    assert.equal(/ignite\.md/.test(code), false, label + ': the emitter never writes to ignite.md (D-167-05)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write(
  'new-surface generator: ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
