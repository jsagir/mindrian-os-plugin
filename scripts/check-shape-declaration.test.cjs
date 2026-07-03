#!/usr/bin/env node
'use strict';

/*
 * Phase 190-03 (SFD-04) - unit tests for the born-declared-shape gate's PURE core.
 *
 * Drives scripts/check-shape-declaration.cjs's check() against the 7 synthetic
 * fixtures under data/hitl-shape-declaration-fixtures/ (3 valid, 4 invalid) and
 * asserts each produces the expected valid/invalid verdict, and that each invalid
 * fixture's violations[] names its specific defect. Also exercises
 * checkPlanFrontmatter() over inline plan-frontmatter objects (the --check-plan
 * pure core). Pure, deterministic, LOCAL-only: node:fs + node:path + the gate
 * module; zero Brain, zero network.
 *
 * Phase 210-02 (item 210-A) extension: spawn-level advisory exit-code assertions.
 * The gate's --check CLI is advisory by default (WARN + exit 0 on violations)
 * with --strict restoring the pre-210 hard-fail (exit 1). These legs drive the
 * CLI against a SYNTHETIC violating tree via the CHECK_SHAPE_DECLARATION_ROOT
 * env-var test seam (documented in the gate's own header): the seam overrides
 * ONLY the scan root that collectSurfaces()/checkTree() walk; the schema still
 * loads from the real repo. The pure-predicate fixtures above are untouched by
 * the softening (only main()'s reporting/exit changed).
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const mod = require('./check-shape-declaration.cjs');
const { check, checkAll, checkPlanFrontmatter } = mod;

const FIX_DIR = path.join(__dirname, '..', 'data', 'hitl-shape-declaration-fixtures');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(FIX_DIR, name), 'utf8'));
}

let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error('  FAIL: ' + msg);
  }
}

// ---------------------------------------------------------------------------
// Exports contract.
// ---------------------------------------------------------------------------
ok(typeof check === 'function', 'exports check()');
ok(typeof checkAll === 'function', 'exports checkAll()');
ok(typeof checkPlanFrontmatter === 'function', 'exports checkPlanFrontmatter()');

// ---------------------------------------------------------------------------
// The 3 valid fixtures.
// ---------------------------------------------------------------------------
let r = check(load('valid-single-shape.json'));
ok(r.valid, 'valid-single-shape is valid: ' + JSON.stringify(r.violations));

r = check(load('valid-multi-stage.json'));
ok(r.valid, 'valid-multi-stage is valid (delegates to check-hitl-stages): ' + JSON.stringify(r.violations));

r = check(load('valid-skill-exempt.json'));
ok(r.valid, 'valid-skill-exempt is valid (connector.excluded reuse): ' + JSON.stringify(r.violations));

// ---------------------------------------------------------------------------
// The 4 invalid fixtures -- each names its specific defect.
// ---------------------------------------------------------------------------
r = check(load('invalid-missing-why.json'));
ok(!r.valid, 'invalid-missing-why is invalid');
ok(r.violations.some((v) => /hitl_why/.test(v)), 'invalid-missing-why names the missing hitl_why field');

r = check(load('invalid-bad-shape.json'));
ok(!r.valid, 'invalid-bad-shape is invalid');
ok(
  r.violations.some((v) => /F\.10/.test(v) && /closed/.test(v)),
  'invalid-bad-shape names the out-of-vocabulary shape and the closed set'
);

r = check(load('invalid-ranker-contradiction.json'));
ok(!r.valid, 'invalid-ranker-contradiction is invalid');
ok(
  r.violations.some((v) => /ranker/.test(v) && /F\.7/.test(v)),
  'invalid-ranker-contradiction names the f-selector-ranker-contradiction (expected F.7)'
);

r = check(load('invalid-skill-gap.json'));
ok(!r.valid, 'invalid-skill-gap is invalid');
ok(
  r.violations.some((v) => /excluded/.test(v)),
  'invalid-skill-gap names the missing declaration-or-exemption (connector.excluded)'
);

// ---------------------------------------------------------------------------
// checkPlanFrontmatter() -- the --check-plan pure core.
// ---------------------------------------------------------------------------
// Untriggered: no surfaces_added -> ok.
let pr = checkPlanFrontmatter({ cirs_relationship: { surfaces_added: [] } });
ok(pr.ok, 'plan with empty surfaces_added is ok');

// Triggered but no hitl_declarations -> fail closed.
pr = checkPlanFrontmatter({ cirs_relationship: { surfaces_added: ['commands/new-thing.md'] } });
ok(!pr.ok, 'plan adding a surface with no hitl_declarations fails closed');

// Triggered, fully declared -> ok.
pr = checkPlanFrontmatter({
  cirs_relationship: { surfaces_added: ['commands/new-thing.md'] },
  hitl_declarations: [
    { surface: 'commands/new-thing.md', hitl_shape: 'F.1', hitl_why: 'A single go/no-go plan approval.' },
  ],
});
ok(pr.ok, 'plan adding a surface with a matching hitl_declaration is ok: ' + JSON.stringify(pr.errors));

// Triggered, added surface missing from declarations -> fail.
pr = checkPlanFrontmatter({
  cirs_relationship: { surfaces_added: ['commands/a.md', 'commands/b.md'] },
  hitl_declarations: [
    { surface: 'commands/a.md', hitl_shape: 'F.1', hitl_why: 'A plan approval.' },
  ],
});
ok(!pr.ok, 'plan with an undeclared added surface fails closed');

// Triggered, newly-added exempt skill via connector_excluded -> ok.
pr = checkPlanFrontmatter({
  cirs_relationship: { surfaces_added: ['skills/ambient/SKILL.md'] },
  hitl_declarations: [
    { surface: 'skills/ambient/SKILL.md', connector_excluded: true, connector_reason: 'Ambient always-on infra.' },
  ],
});
ok(pr.ok, 'plan adding an exempt skill via connector_excluded is ok: ' + JSON.stringify(pr.errors));

// ---------------------------------------------------------------------------
// checkAll() over the fixtures dir returns the 4 invalid fixtures' violations.
// ---------------------------------------------------------------------------
const all = checkAll(FIX_DIR);
ok(all.fixtures === 7, 'checkAll walks all 7 fixtures (saw ' + all.fixtures + ')');
ok(!all.valid, 'checkAll is not clean over a dir that mixes valid and invalid fixtures');

// ---------------------------------------------------------------------------
// Phase 210-02 (item 210-A): advisory exit-code assertions over a synthetic
// violating tree (one command with NEITHER a declaration NOR an exclusion),
// driven through the CHECK_SHAPE_DECLARATION_ROOT spawn seam.
// ---------------------------------------------------------------------------
const SCRIPT = path.join(__dirname, 'check-shape-declaration.cjs');
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shape-decl-advisory-'));
fs.mkdirSync(path.join(tmpRoot, 'commands'), { recursive: true });
fs.writeFileSync(
  path.join(tmpRoot, 'commands', 'synthetic-210-violating.md'),
  '---\ndescription: synthetic Phase 210 fixture - declares neither hitl_shape/hitl_stages nor a connector exclusion\n---\n\nSynthetic body.\n',
  'utf8'
);
try {
  const seamEnv = Object.assign({}, process.env, { CHECK_SHAPE_DECLARATION_ROOT: tmpRoot });

  // Advisory default: --check WARNS and exits 0 on a violating tree; the
  // violation is still enumerated and names the offending surface.
  const adv = spawnSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8', env: seamEnv });
  const advOut = String(adv.stdout || '') + String(adv.stderr || '');
  ok(adv.status === 0, 'advisory default: --check exits 0 on a violating tree (saw ' + adv.status + ')');
  ok(/WARN:/.test(advOut), 'advisory output carries the WARN: prefix');
  ok(
    advOut.indexOf('synthetic-210-violating') !== -1,
    'advisory output still ENUMERATES the violation and names the offending surface'
  );

  // Strict opt-in: --check --strict restores the pre-210 hard-fail contract.
  const strict = spawnSync(process.execPath, [SCRIPT, '--check', '--strict'], { encoding: 'utf8', env: seamEnv });
  const strictOut = String(strict.stdout || '') + String(strict.stderr || '');
  ok(strict.status === 1, '--check --strict exits 1 on the same violating tree (saw ' + strict.status + ')');
  ok(
    /SHAPE DECLARATION VIOLATION/.test(strictOut),
    'strict output keeps the SHAPE DECLARATION VIOLATION hard-fail block'
  );
  ok(/strict/i.test(strictOut), 'strict output names strict mode');
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

console.log('check-shape-declaration.test: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
