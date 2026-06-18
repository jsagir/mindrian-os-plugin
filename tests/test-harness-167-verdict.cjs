'use strict';
/*
 * Phase 167-05 Task 1 -- THE ADVERSARIAL STRUCTURED VERDICT over the whole
 * harness-as-code completion (HARN-01/02/03 + D-167-01..06 + the Part 8 boundary
 * + the no-em-dash instrumentation). This is harness-as-code property 6:
 * "adversarial verify returns a STRUCTURED VERDICT, not a vibe."
 *
 * It MIRRORS the shipped 166 W8 verdict (tests/test-chain-executor-verdict.cjs)
 * and the 163 W6 verdict (tests/test-trending-to-absurd-verdict.cjs): a
 * record(check, passed, detail) accumulator that pushes { check, passed, detail }
 * into findings[], prints the structured verdict { passed, findings[] }, and
 * exits NON-ZERO printing the findings if ANY check failed. The verdict proves
 * each requirement BY INSTRUMENTATION (it exercises the real surface), never by
 * promise.
 *
 * The six requirement groups (each pushes one or more findings):
 *   1. HARN-01 / D-167-01 -- the manifest is a byte-stable 3-MAP DIGEST naming the
 *      three maps by path+role+digest, EXACTLY three entries (no per-surface row,
 *      D-166-03), methodology_tier=mindrian-operation; --check exits 0 clean and a
 *      forced in-memory STALE yields a finding.
 *   2. D-167-02 -- recipe-maps.loadManifest() returns the declared binding AND the
 *      three executable functions are intact + rankedNextReach stays CONTRACT-ONLY
 *      (recipe-maps NOT retired).
 *   3. D-167-03 -- the manifest --check is wired into BOTH the installable
 *      pre-commit template AND tests/run-all-167.sh.
 *   4. HARN-02 / D-167-04 -- fable-mode posture-scoped self-critique fires the
 *      LOW_QUALITY halt on a material step in BOTH the sync runChain path AND the
 *      async _runChainResilient path, skips a trivially-safe step, adds NO
 *      convergence stop (166 B3) and NO fable model tier.
 *   5. HARN-03 / D-167-05 -- /mos:new-surface emits an 11-key connector surface,
 *      refuses an off-frozen reach/posture, registers in connector-registry (so
 *      the manifest --check is clean -- the surface lands TRANSITIVELY), and
 *      commands/ignite.md is untouched by this phase.
 *   6. D-167-06 -- the Part 8 planted-secret boundary tripwire is clean; the Part
 *      9 truth-claim confirm-gate is an explicit NOT-APPLICABLE with a NAMED
 *      RATIONALE (passed:true, NOT a rubber-stamp, LOW-1); the no-em-dash sweep
 *      over every Phase-167 file is clean.
 *
 * If the verdict finds a REAL defect it surfaces it as a FINDING (passed:false),
 * exactly as 163 W6 caught FINDING-163-06-01 -- never a silent pass.
 *
 * House rule: hyphens only, no em-dashes (the U+2014 codepoint is referenced by
 * escape, never as a literal). node built-ins only. Plain node harness.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

const MANIFEST_GEN = path.join(REPO_ROOT, 'scripts', 'build-harness-manifest.cjs');
const RECIPE_MAPS = path.join(REPO_ROOT, 'lib', 'core', 'recipe-maps.cjs');
const CHAIN_EXECUTOR = path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs');
const NEW_SURFACE_GEN = path.join(REPO_ROOT, 'scripts', 'build-new-surface.cjs');
const INSTALL_PRECOMMIT = path.join(REPO_ROOT, 'scripts', 'install-pre-commit.sh');
const RUN_ALL_167 = path.join(REPO_ROOT, 'tests', 'run-all-167.sh');
const PART8_BOUNDARY = path.join(REPO_ROOT, 'tests', 'test-harness-manifest-part8-boundary.cjs');
const MODEL_PROFILES = path.join(REPO_ROOT, 'lib', 'core', 'model-profiles.cjs');
const IGNITE_MD = path.join(REPO_ROOT, 'commands', 'ignite.md');

const MANIFEST_ARTIFACT = path.join(REPO_ROOT, 'data', 'harness-manifest.json');
const CONNECTOR_REGISTRY = path.join(REPO_ROOT, 'data', 'connector-registry.json');

const EM_DASH = String.fromCharCode(0x2014);

// ---------------------------------------------------------------------------
// THE STRUCTURED VERDICT ACCUMULATOR (harness-as-code property 6; mirrors
// test-chain-executor-verdict.cjs + test-trending-to-absurd-verdict.cjs). Each
// check pushes { check, passed, detail } into findings[]; the verdict is
// { passed, findings[] }; exit non-zero printing the findings if ANY failed.
// ---------------------------------------------------------------------------
const findings = [];
function record(check, passed, detail) {
  findings.push({ check: check, passed: !!passed, detail: detail });
}

// guard(check, fn) -- run an instrumented assertion block; a thrown AssertionError
// becomes a FAILED finding carrying the assertion message (the real defect), so a
// genuine breach is SURFACED, never silently swallowed.
function guard(check, fn) {
  try {
    const detail = fn();
    record(check, true, detail || 'verified by instrumentation');
  } catch (e) {
    record(check, false, (e && e.message) ? e.message : String(e));
  }
}

// ===========================================================================
// GROUP 1 -- HARN-01 / D-167-01: the manifest is a byte-stable 3-MAP DIGEST.
// ===========================================================================
guard('HARN-01/D-167-01: manifest is a byte-stable 3-MAP DIGEST (path+role+digest, exactly three, no per-surface row, tier=mindrian-operation)', () => {
  const gen = require(MANIFEST_GEN);
  // byte-stable across two builds (deterministic source walk).
  const a = gen.serializeManifest(gen.buildManifest());
  const b = gen.serializeManifest(gen.buildManifest());
  assert.equal(a, b, 'buildManifest is not byte-stable across two calls');

  const manifest = gen.buildManifest();
  // EXACTLY three map entries, one per declared role (no per-surface row, D-166-03).
  assert.ok(Array.isArray(manifest.maps), 'manifest.maps is not an array');
  assert.equal(manifest.maps.length, 3, 'manifest does not have EXACTLY three map entries (a per-surface row or a merge)');
  const roles = manifest.maps.map((m) => m.role).sort();
  assert.deepEqual(roles, ['posture', 'ranked_next_reach', 'wiring'],
    'the three roles are not exactly {posture, wiring, ranked_next_reach}');
  // each entry NAMES its map by role+path+digest (NOT inlined contents).
  for (const m of manifest.maps) {
    assert.equal(typeof m.role, 'string', 'a maps entry lacks a role');
    assert.equal(typeof m.path, 'string', 'a maps entry lacks a path (not named by path)');
    assert.equal(typeof m.digest, 'string', 'a maps entry lacks a digest (not named by digest)');
    assert.ok(/^[0-9a-f]{64}$/.test(m.digest), 'a maps entry digest is not a sha256 hex fingerprint (a digest, not contents)');
    assert.equal(typeof m.source_count, 'number', 'a maps entry lacks a numeric source_count');
    // no inlined map contents: only the four machinery keys.
    assert.deepEqual(Object.keys(m).sort(), ['digest', 'path', 'role', 'source_count'],
      'a maps entry carries a key beyond {role, path, digest, source_count} (inlined contents)');
  }
  // methodology_tier boundary-keeper.
  assert.equal(manifest.methodology_tier, 'mindrian-operation',
    'manifest.methodology_tier is not mindrian-operation (not a legal Part 8 machinery descriptor)');

  // --check exits 0 on the clean repo (the committed artifact is in sync).
  execFileSync('node', [MANIFEST_GEN, '--check'], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });

  // a forced in-memory STALE yields a finding (the validateManifest STALE branch).
  const poisoned = JSON.parse(JSON.stringify(manifest));
  poisoned.maps[0].digest = '0'.repeat(64);
  const v = gen.validateManifest(poisoned);
  assert.ok(v.stale.length >= 1, 'a forced in-memory stale digest did NOT trip the STALE branch');

  // exactly-three guard: a per-surface 4th row trips MALFORMED.
  const extra = JSON.parse(JSON.stringify(manifest));
  extra.maps.push({ role: 'surface:/mos:foo', path: 'x', digest: 'y', source_count: 1 });
  const vm = gen.validateManifest(extra);
  assert.ok(vm.malformed.length >= 1, 'a per-surface 4th row did NOT trip MALFORMED (D-166-03 not enforced)');

  return 'byte-stable; EXACTLY 3 maps {posture,wiring,ranked_next_reach} by role+path+sha256-digest; tier=mindrian-operation; --check clean; forced STALE + per-surface-row both rejected';
});

// ===========================================================================
// GROUP 2 -- D-167-02: recipe-maps WRAPS, not becomes (the three functions intact).
// ===========================================================================
guard('D-167-02: recipe-maps.loadManifest() returns the declared binding AND postureForCommand / wiringForReach / rankedNextReach are intact (recipe-maps NOT retired, rankedNextReach stays CONTRACT-ONLY)', () => {
  delete require.cache[require.resolve(RECIPE_MAPS)];
  const rm = require(RECIPE_MAPS);
  if (typeof rm.__reset === 'function') rm.__reset();

  // loadManifest() returns the declared three-map binding (the SAME three roles).
  const binding = rm.loadManifest();
  assert.ok(binding && Array.isArray(binding.maps), 'loadManifest() did not return a { maps:[] } binding');
  assert.equal(binding.maps.length, 3, 'loadManifest() binding does not name three maps');
  const roles = binding.maps.map((m) => m.role).sort();
  assert.deepEqual(roles, ['posture', 'ranked_next_reach', 'wiring'],
    'loadManifest() binding roles are not the three declared maps');
  assert.equal(binding.methodology_tier, 'mindrian-operation', 'loadManifest() binding tier is not mindrian-operation');
  // manifest() is the alias of loadManifest().
  assert.deepEqual(rm.manifest(), binding, 'manifest() is not an alias of loadManifest()');

  // the three executable functions still return their shipped shapes (NOT retired).
  assert.equal(typeof rm.postureForCommand, 'function', 'postureForCommand was retired');
  assert.equal(typeof rm.wiringForReach, 'function', 'wiringForReach was retired');
  assert.equal(typeof rm.rankedNextReach, 'function', 'rankedNextReach was retired');
  const p = rm.postureForCommand('/mos:new-surface');
  assert.ok(p && typeof p.autonomous_safe === 'boolean' && typeof p.posture === 'string',
    'postureForCommand no longer returns { autonomous_safe, posture }');
  const w = rm.wiringForReach('context_block');
  assert.ok(Array.isArray(w), 'wiringForReach no longer returns a string[]');
  const r = rm.rankedNextReach();
  assert.ok(Array.isArray(r), 'rankedNextReach no longer returns an array');

  // rankedNextReach stays CONTRACT-ONLY: the source doc-comment names it (read the source).
  const src = fs.readFileSync(RECIPE_MAPS, 'utf8');
  assert.ok(/CONTRACT-ONLY/.test(src), 'recipe-maps no longer documents rankedNextReach as CONTRACT-ONLY (live consumption snuck in)');
  assert.ok(/D-167-02/.test(src), 'recipe-maps source no longer cites D-167-02 (the declared-vs-executable split)');

  return 'loadManifest() returns the 3-role declared binding; the 3 executable functions return shipped shapes; rankedNextReach stays CONTRACT-ONLY; D-167-02 split documented';
});

// ===========================================================================
// GROUP 3 -- D-167-03: manifest --check wired into BOTH pre-commit AND CI.
// ===========================================================================
guard('D-167-03: manifest --check wired into BOTH the installable pre-commit template AND tests/run-all-167.sh', () => {
  const tmpl = fs.readFileSync(INSTALL_PRECOMMIT, 'utf8');
  assert.ok(/build-harness-manifest\.cjs --check/.test(tmpl),
    'the installable pre-commit template does NOT wire build-harness-manifest.cjs --check (a fresh clone misses the guard)');

  const agg = fs.readFileSync(RUN_ALL_167, 'utf8');
  assert.ok(/build-harness-manifest\.cjs["'][[:space:]]*\)?[[:space:]]*--check|build-harness-manifest\.cjs/.test(agg) && /--check/.test(agg),
    'tests/run-all-167.sh does NOT run the manifest --check leg');
  // tighter: the aggregator invokes the generator with --check as a CI leg.
  assert.ok(/build-harness-manifest\.cjs"?\s+--check/.test(agg) || /build-harness-manifest\.cjs[^\n]*--check/.test(agg),
    'tests/run-all-167.sh does NOT invoke build-harness-manifest.cjs with --check');

  return 'build-harness-manifest.cjs --check present in BOTH scripts/install-pre-commit.sh AND tests/run-all-167.sh (stronger than the connector/projection CI-only precedent)';
});

// ===========================================================================
// GROUP 4 -- HARN-02 / D-167-04: fable-mode posture-scoped, BOTH paths, no
// convergence, no fable tier. Driven against the REAL runChain executor.
// ===========================================================================
function makeDecideFn() {
  const calls = [];
  function decideFn() {
    const decision = { fire_skill: null, decision_trace: { rationale: 'stub ' + (calls.length + 1) } };
    calls.push({ returned: decision });
    return decision;
  }
  decideFn.calls = calls;
  return decideFn;
}
function makeOnStep(quality) {
  const seen = [];
  function onStep(step, previousOutput) {
    seen.push({ step: step, previousOutput: previousOutput });
    return { chain_output: 'out-' + step.command, quality: quality || 'high' };
  }
  onStep.seen = seen;
  return onStep;
}
function postureFn(command) {
  // step 1 material (posture verb halt); all else trivially safe (run).
  if (command === '/mos:material') return { command: command, autonomous_safe: true, posture: 'halt' };
  return { command: command, autonomous_safe: true, posture: 'run' };
}
function makeLowCritique() {
  const calls = [];
  function selfCritiqueFn(step, result) { calls.push({ step: step, result: result }); return { passed: false, quality: 'low' }; }
  selfCritiqueFn.calls = calls;
  return selfCritiqueFn;
}
const MATERIAL_THEN_SAFE = [
  { step: 1, command: '/mos:material', material: true },
  { step: 2, command: '/mos:safe' },
];
const ALL_SAFE = [
  { step: 1, command: '/mos:safe', framework: 'x' },
  { step: 2, command: '/mos:safe2', framework: 'y' },
];

// These two checks are async (the resilient path is awaited); collect them.
const ASYNC_CHECKS = [];

ASYNC_CHECKS.push({
  check: 'HARN-02/D-167-04: fable-mode material-step LOW_QUALITY halt fires in BOTH the sync runChain AND the async _runChainResilient paths; a trivially-safe step is NOT critiqued (MEDIUM-3, posture-scoped)',
  fn: async () => {
    const { runChain } = require(CHAIN_EXECUTOR);

    // SYNC: material + low critique -> existing quality_early_stop / LOW_QUALITY halt.
    const syncCritique = makeLowCritique();
    const syncOnStep = makeOnStep('high');
    const syncResult = runChain(MATERIAL_THEN_SAFE, {
      postureFn: postureFn, gateFn: function () { return 'run'; }, onStep: syncOnStep,
      selfCritiqueFn: syncCritique, decideFn: makeDecideFn(), onHalt: function () { return 'approve'; }, maxSteps: 10,
    });
    assert.equal(syncCritique.calls.length, 1, 'SYNC: critique did not fire exactly once on the material step');
    assert.equal(syncResult.completed, false, 'SYNC: chain completed (the LOW_QUALITY halt did not fire)');
    assert.equal(syncResult.haltedAt && syncResult.haltedAt.reason, 'quality_early_stop',
      'SYNC: halt reason is not the EXISTING quality_early_stop (a new halt reason was invented)');
    assert.equal(syncResult.haltedAt.quality, 'low', 'SYNC: augmented quality is not low');
    assert.equal(syncOnStep.seen.length, 1, 'SYNC: step 2 dispatched despite the material halt');

    // ASYNC: the resilient path (roomDir + injected no-op sleep) -> SAME halt.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-async-'));
    const asyncCritique = makeLowCritique();
    const asyncOnStep = makeOnStep('high');
    const asyncResult = await runChain(MATERIAL_THEN_SAFE, {
      postureFn: postureFn, gateFn: function () { return 'run'; }, onStep: asyncOnStep,
      selfCritiqueFn: asyncCritique, decideFn: makeDecideFn(), onHalt: function () { return 'approve'; }, maxSteps: 10,
      roomDir: tmp, sleep: function () { return Promise.resolve(); },
    });
    assert.equal(asyncCritique.calls.length, 1, 'ASYNC: critique did not fire once on the material step');
    assert.equal(asyncResult.completed, false, 'ASYNC: chain completed (the LOW_QUALITY halt did not fire in the resilient path)');
    assert.equal(asyncResult.haltedAt && asyncResult.haltedAt.reason, 'quality_early_stop',
      'ASYNC: halt reason is not the IDENTICAL quality_early_stop (the seam drifted between paths, MEDIUM-3)');
    assert.equal(asyncResult.partial, false, 'ASYNC: this is a quality halt, not a graceful-partial (dispatchError path was wrongly hit)');
    assert.equal(asyncOnStep.seen.length, 1, 'ASYNC: step 2 dispatched despite the material halt');
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }

    // trivially-safe step is NOT critiqued in either path (D-167-04 token scoping).
    const safeCritique = makeLowCritique();
    const safeResult = runChain(ALL_SAFE, {
      postureFn: postureFn, gateFn: function () { return 'run'; }, onStep: makeOnStep('high'),
      selfCritiqueFn: safeCritique, decideFn: makeDecideFn(), onHalt: function () { return 'approve'; }, maxSteps: 10,
    });
    assert.equal(safeCritique.calls.length, 0, 'a trivially-safe push_forward step was critiqued (token scoping violated)');
    assert.equal(safeResult.completed, true, 'the all-safe chain did not complete (a spurious halt fired)');

    return 'sync + async BOTH halt the material step at the existing quality_early_stop/LOW_QUALITY path; trivially-safe steps skipped';
  },
});

guard('HARN-02/D-167-04: chain-executor adds NO convergence-stop branch (166 B3) and NO fable model tier (naming over shipped machinery)', () => {
  const src = fs.readFileSync(CHAIN_EXECUTOR, 'utf8');
  // strip comment lines so prose naming the rejected pattern does not self-trip.
  const code = src.split('\n').filter((line) => {
    const t = line.trim();
    return t.length > 0 && t.indexOf('//') !== 0 && t.indexOf('*') !== 0 && t.indexOf('/*') !== 0;
  }).join('\n');
  assert.ok(!/loop\s+until/i.test(code), 'a "loop until" convergence branch was added (166 B3 breach)');
  assert.ok(!/until.*converge/i.test(code), 'an "until converge" branch was added (166 B3 breach)');
  assert.ok(!/all[._]?passing/i.test(code), 'an "all passing" convergence stop was added (166 B3 breach)');
  assert.ok(/quality_early_stop/.test(code), 'the existing quality_early_stop halt is gone (the seam no longer reuses it)');
  // no fable model alias in the executor code.
  assert.ok(!/['"]fable['"]\s*:/.test(code), 'a "fable" model alias key was minted in the executor');
  // no fable tier in model-profiles (stays opus/sonnet/haiku).
  if (fs.existsSync(MODEL_PROFILES)) {
    const mp = fs.readFileSync(MODEL_PROFILES, 'utf8');
    assert.ok(!/fable/i.test(mp), 'model-profiles.cjs introduced a fable tier (must stay opus/sonnet/haiku)');
    assert.ok(/opus|sonnet|haiku/i.test(mp), 'model-profiles.cjs no longer names the shipped tiers');
  }
  return 'no convergence-stop branch; existing quality_early_stop reused; no fable model alias in executor or model-profiles';
});

// ===========================================================================
// GROUP 5 -- HARN-03 / D-167-05: /mos:new-surface emits + registers + lands
// TRANSITIVELY; off-frozen refused; ignite untouched.
// ===========================================================================
guard('HARN-03/D-167-05: new-surface emits an 11-key surface to a tmp dir; an off-frozen reach/posture is REFUSED; the real /mos:new-surface is registered in connector-registry so the manifest --check is clean (transitive landing); ignite untouched', () => {
  const gen = require(NEW_SURFACE_GEN);
  assert.ok(Array.isArray(gen.CONNECTOR_KEYS) && gen.CONNECTOR_KEYS.length === 11,
    'the generator does not export the 11 CONNECTOR_KEYS');

  // emit a well-formed fixture surface to a TMP dir (env override), assert 11 keys.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-surface-'));
  const goodSpec = {
    kind: 'command', name: 'verdict-fixture', connects_to_spine: true,
    sensor_triggers: ['SENS-01'], reach_id: 'context_block', sub_mode: 'verdict-fixture',
    framework: null, posture: 'push_forward', hierarchy_rank: 99, filing: 'none',
    plan_gated: false, web_scope: null, surface: 'F.1',
  };
  const res = gen.emitSurface(goodSpec, { outDir: tmp });
  assert.ok(fs.existsSync(res.path), 'emitSurface did not write the surface .md to the tmp dir');
  const emitted = fs.readFileSync(res.path, 'utf8');
  // The 11 connector keys are emitted under the `connector:` block (the Phase
  // 143.3 connector-frontmatter contract), indented beneath it -- NOT at the
  // top level. Assert each key appears as a (possibly indented) YAML key in the
  // emitted file, so a dropped key is caught wherever the block lives.
  assert.ok(/\nconnector:\s*\n/.test(emitted), 'the emitted surface has no connector: block (the 11-key wiring is not declared)');
  for (const k of gen.CONNECTOR_KEYS) {
    assert.ok(new RegExp('\\n\\s*' + k + ':').test(emitted), 'the emitted surface is missing the connector key "' + k + '"');
  }
  // reach_id in the frozen 6, posture in the frozen 3 (read from the emitted block).
  assert.ok(/reach_id:\s*"?context_block"?/.test(emitted), 'the emitted reach_id is not in the frozen 6');
  assert.ok(/posture:\s*"?push_forward"?/.test(emitted), 'the emitted posture is not in the frozen 3');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }

  // an OFF-FROZEN reach is REFUSED (emitSurface throws; validateSurface flags OFF_FROZEN).
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-offfrozen-'));
  const badSpec = Object.assign({}, goodSpec, { name: 'off-frozen-fixture', reach_id: 'not_a_real_reach' });
  let threw = false;
  try { gen.emitSurface(badSpec, { outDir: tmp2 }); } catch (_e) { threw = true; }
  assert.ok(threw, 'emitSurface did NOT refuse an off-frozen reach_id (a 7th reach could be smuggled)');
  const vf = gen.validateSurface(badSpec, { skipRegistry: true });
  assert.ok(vf.off_frozen.length >= 1, 'validateSurface did not flag OFF_FROZEN for an off-frozen reach_id');
  try { fs.rmSync(tmp2, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }

  // the REAL /mos:new-surface is REGISTERED in connector-registry.json (its real home).
  const reg = JSON.parse(fs.readFileSync(CONNECTOR_REGISTRY, 'utf8'));
  const registered = Array.isArray(reg.connectors) && reg.connectors.some((c) => c.surface === '/mos:new-surface');
  assert.ok(registered, 'the real /mos:new-surface is NOT registered in connector-registry.json (the surface did not land in its real home)');

  // the manifest --check is clean -> the surface landed TRANSITIVELY (no per-surface manifest row).
  execFileSync('node', [MANIFEST_GEN, '--check'], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  // and the surface is NOT a per-surface manifest row (the manifest has exactly three maps).
  const mgen = require(MANIFEST_GEN);
  assert.equal(mgen.buildManifest().maps.length, 3, 'the manifest grew a per-surface row for the new surface (D-166-03 breach)');

  // commands/ignite.md is UNTOUCHED by Phase 167 (no 167 plan lists it as a modified file).
  assert.ok(fs.existsSync(IGNITE_MD), 'commands/ignite.md is missing');
  const planDir = path.join(REPO_ROOT, '.planning', 'phases', '167-harness-manifest-and-surface-generator');
  const plans = fs.readdirSync(planDir).filter((f) => /-PLAN\.md$/.test(f));
  let ignteIsAModifiedFile = false;
  for (const pf of plans) {
    const body = fs.readFileSync(path.join(planDir, pf), 'utf8');
    // a plan's files_modified frontmatter listing ignite would be a touch; the
    // prose mentions ignite only to say it is OUT of scope / untouched.
    const fm = body.split('---')[1] || '';
    if (/files_modified:[\s\S]*commands\/ignite\.md/.test(fm)) ignteIsAModifiedFile = true;
  }
  assert.equal(ignteIsAModifiedFile, false, 'a Phase-167 plan lists commands/ignite.md as a modified file (ignite was touched)');

  return 'emits 11-key surface to tmp; refuses off-frozen reach/posture; real /mos:new-surface registered in connector-registry; manifest --check clean (transitive, exactly 3 maps); ignite not a modified file in any 167 plan';
});

// ===========================================================================
// GROUP 6 -- D-167-06: Part 8 planted-secret tripwire clean; Part 9 explicit
// N/A with NAMED rationale (LOW-1); no em-dash across the phase.
// ===========================================================================
guard('D-167-06 (Part 8): the planted-secret manifest boundary tripwire exits 0 (the boundary scan catches a planted secret and the real artifact is clean)', () => {
  // spawn the Wave-1 boundary suite (the planted-secret tripwire) and assert exit 0.
  execFileSync('node', [PART8_BOUNDARY], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  return 'tests/test-harness-manifest-part8-boundary.cjs exits 0 (planted secret caught RED, real manifest clean GREEN)';
});

// Part 9 -- the truth-claim confirm-gate is NOT-APPLICABLE WITH A NAMED RATIONALE
// (LOW-1: an explicit, reasoned N/A, NOT a rubber-stamp). The detail NAMES why.
(function part9NamedNA() {
  const PART9_RATIONALE =
    'no Phase-167 surface writes a truth-claim node; fable-mode augments quality and ' +
    'halts, never promotes to confirmed; the Part 9 confirm-gate is upstream (Phase 129.5) ' +
    'and untouched';
  // Prove the claim is REASONED, not blind: instrument that no Phase-167 surface
  // calls a confirm/promote path (confirmNode / review_status: confirmed write).
  let reasoned = true;
  let detail = 'Part 9 confirm-gate NOT-APPLICABLE: ' + PART9_RATIONALE;
  try {
    const surfaces = [MANIFEST_GEN, RECIPE_MAPS, CHAIN_EXECUTOR, NEW_SURFACE_GEN];
    for (const f of surfaces) {
      const src = fs.readFileSync(f, 'utf8');
      // strip comment lines so prose discussing Part 9 does not self-trip.
      const code = src.split('\n').filter((line) => {
        const t = line.trim();
        return t.length > 0 && t.indexOf('//') !== 0 && t.indexOf('*') !== 0 && t.indexOf('/*') !== 0;
      }).join('\n');
      // no confirmNode( call, no truth-claim promotion to confirmed.
      if (/confirmNode\s*\(/.test(code)) { reasoned = false; detail = 'Part 9 N/A is FALSE: ' + path.basename(f) + ' calls confirmNode() (it DOES promote a truth-claim)'; break; }
      if (/review_status\s*[:=]\s*['"]confirmed['"]/.test(code)) { reasoned = false; detail = 'Part 9 N/A is FALSE: ' + path.basename(f) + ' writes review_status: confirmed (it DOES promote a truth-claim)'; break; }
    }
  } catch (e) {
    reasoned = false;
    detail = 'Part 9 N/A check could not read a surface: ' + ((e && e.message) || String(e));
  }
  // passed:true means the explicit, instrumented N/A holds; passed:false means a
  // Phase-167 surface DOES touch the confirm-gate (then it would NOT be N/A).
  record('D-167-06 (Part 9): truth-claim confirm-gate NOT-APPLICABLE with a NAMED rationale (instrumented, not a rubber-stamp, LOW-1)', reasoned, detail);
})();

guard('D-167-06 (no em-dash): zero U+2014 codepoints across every Phase-167 file (the CLAUDE.md HARD RULE, proven by instrumentation)', () => {
  const PHASE_167_FILES = [
    'scripts/build-harness-manifest.cjs',
    'data/harness-manifest.json',
    'lib/core/recipe-maps.cjs',
    'lib/core/chain-executor.cjs',
    'scripts/build-new-surface.cjs',
    'commands/new-surface.md',
    'agents/framework-runner.md',
    'scripts/install-pre-commit.sh',
    'tests/test-harness-manifest-check.cjs',
    'tests/test-recipe-maps-loadmanifest.cjs',
    'tests/test-harness-manifest-part8-boundary.cjs',
    'tests/test-harness-manifest-precommit-wiring.cjs',
    'tests/test-chain-executor-fable-mode.cjs',
    'tests/test-new-surface-generator.cjs',
    'tests/test-harness-167-verdict.cjs',
    'tests/test-harness-167-part8-leak.cjs',
    'tests/run-all-167.sh',
  ];
  const hits = [];
  for (const rel of PHASE_167_FILES) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    if (fs.readFileSync(abs, 'utf8').includes(EM_DASH)) hits.push(rel);
  }
  assert.equal(hits.length, 0, 'em-dash (U+2014) found in: ' + hits.join(', '));
  return 'zero U+2014 across ' + PHASE_167_FILES.length + ' Phase-167 files';
});

// ---------------------------------------------------------------------------
// Run the async checks, then emit the structured verdict.
// ---------------------------------------------------------------------------
(async function main() {
  for (const c of ASYNC_CHECKS) {
    try {
      const detail = await c.fn();
      record(c.check, true, detail || 'verified by instrumentation');
    } catch (e) {
      record(c.check, false, (e && e.message) ? e.message : String(e));
    }
  }

  const passedAll = findings.every((f) => f.passed);
  const verdict = { passed: passedAll, findings: findings };

  process.stdout.write('harness-167 adversarial verdict\n');
  process.stdout.write('================================\n');
  for (const f of findings) {
    process.stdout.write((f.passed ? '  PASS ' : '  FAIL ') + f.check + '\n');
    process.stdout.write('       ' + f.detail + '\n');
  }
  process.stdout.write('\n');
  process.stdout.write('VERDICT: ' + JSON.stringify({ passed: verdict.passed, checks: findings.length, failed: findings.filter((f) => !f.passed).length }) + '\n');

  if (!passedAll) {
    process.stdout.write('\nFINDINGS (failures):\n');
    for (const f of findings.filter((x) => !x.passed)) {
      process.stdout.write('  - [' + f.check + '] ' + f.detail + '\n');
    }
    process.exit(1);
  }
  process.exit(0);
})();
