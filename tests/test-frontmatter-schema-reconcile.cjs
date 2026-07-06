#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Writer <-> validator reconciliation guard (2026-07-06).
 * =======================================================
 * Closes two confirmed todos:
 *   - 2026-06-28-room-md-artifact-frontmatter-schema-drift (F-03)
 *   - 2026-06-28-section-artifact-title-status-frontmatter-uncovered
 *
 * Phase 88.1-07 codified an ASPIRATIONAL frontmatter vocabulary that no writer
 * ever adopted (ROOM.md required name+type; STATE.md required artifact_count;
 * artifacts required title+source+status). The real shipped writers emit
 * different vocabularies, so the advisory PostToolUse hook fired noisy
 * false-positive advisories on the plugin's own scaffolded output -- a Canon
 * Part 6 dog-food self-violation. The fix reconciled the VALIDATOR to the
 * WRITERS (Decision 15: the filesystem writers are the source of truth).
 *
 * This test is the DURABLE GUARD that keeps writer and validator locked. It
 * scaffolds a real room in a hermetic temp ROOMS_HOME, runs the real
 * compute-state script, writes a real USER.md via the real write primitive,
 * then asserts EVERY generated managed file (ROOM.md / STATE.md / MINTO.md /
 * USER.md / section artifacts) validates with ZERO blocking (error/critical)
 * violations through the SAME parse-then-validate path the hook uses. It also
 * asserts the two documented new-project entry-frontmatter shapes validate
 * clean. If a writer's vocabulary ever drifts from the schema again, this test
 * fails loudly instead of degrading into advisory noise.
 *
 * Canon:
 *   Part 6 dog-fooding: the plugin's own output MUST pass its own schema.
 *   Part 8 LOCAL-only: pure fs in a temp dir; no network, no Brain.
 *
 * CJS only. No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const schemas = require(path.join(REPO, 'lib/core/frontmatter-schemas.cjs'));
const scaffold = require(path.join(REPO, 'lib/core/room-skeleton-scaffold.cjs'));
const userMdOps = require(path.join(REPO, 'lib/core/user-md-ops.cjs'));

let matter;
try {
  matter = require('gray-matter');
} catch (_e) {
  process.stderr.write('SKIP: gray-matter unavailable; cannot run reconcile test\n');
  process.exit(0);
}

// ---------- Tmp cleanup ----------

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}
process.on('exit', function () {
  for (const d of TMP_ROOTS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ok */ }
  }
});

// ---------- Hook-equivalent parse + validate ----------

// Mirror scripts/frontmatter-schema-validator.cjs parseFrontmatter: files that
// do not START with a frontmatter delimiter carry no YAML to validate.
function parseLikeHook(body) {
  if (typeof body !== 'string' || !/^---\r?\n/.test(body)) {
    return { noFrontmatter: true };
  }
  try {
    const parsed = matter(body);
    const data = (parsed && parsed.data && typeof parsed.data === 'object')
      ? parsed.data : {};
    return { frontmatter: data };
  } catch (_e) {
    return { frontmatter: null };
  }
}

function blockingViolations(result) {
  const v = (result && Array.isArray(result.violations)) ? result.violations : [];
  return v.filter(function (x) {
    return x.severity === 'error' || x.severity === 'critical';
  });
}

// Validate one on-disk file exactly as the hook would (parse then validate).
// Files with no frontmatter block are trivially clean (the hook skips them).
// Returns { checked: boolean, schema: string, blocking: [] }.
function validateFile(filePath) {
  const body = fs.readFileSync(filePath, 'utf8');
  const parsed = parseLikeHook(body);
  if (parsed.noFrontmatter) {
    return { checked: false, schema: null, blocking: [] };
  }
  const schemaKey = schemas.selectSchemaKey(filePath);
  const result = schemas.validate(filePath, parsed.frontmatter);
  return { checked: true, schema: schemaKey, blocking: blockingViolations(result) };
}

// Recursively collect every .md file under a directory.
function walkMd(dir, acc) {
  acc = acc || [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walkMd(full, acc);
    } else if (/\.md$/i.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

let passCount = 0;
function ok(label) {
  passCount += 1;
  process.stdout.write('PASS ' + label + '\n');
}

// ---------- Scaffold a hermetic room ----------

const ROOMS_HOME = mkTmp('fm-reconcile-rooms-');
const ROOM_DIR = path.join(ROOMS_HOME, 'untitled-2026-07-06-test');
fs.mkdirSync(ROOM_DIR, { recursive: true });
fs.writeFileSync(path.join(ROOM_DIR, '.room-root'), '', 'utf8');

const scaffoldResult = scaffold.scaffoldRoomSkeleton(ROOM_DIR, {
  placeholder_slug: 'untitled-2026-07-06-test',
  source_material_id: 'deadbeefdeadbeefdeadbeefdeadbeef',
});
assert.ok(scaffoldResult.ok, 'scaffold must succeed: ' + JSON.stringify(scaffoldResult.errors));
assert.ok(scaffoldResult.sections_created.length >= 8,
  'scaffold must create the 8 ICM section ROOM.md files');
ok('Test 1: room scaffolds cleanly (' + scaffoldResult.sections_created.length +
  ' sections, ' + scaffoldResult.identity_files_created.length + ' identity dirs)');

// ---------- Scaffold-transient STATE.md validates clean ----------

(function () {
  const statePath = path.join(ROOM_DIR, 'STATE.md');
  const r = validateFile(statePath);
  assert.ok(r.checked, 'scaffold STATE.md carries frontmatter to validate');
  assert.equal(r.schema, 'STATE.md', 'STATE.md routes to STATE.md schema');
  assert.equal(r.blocking.length, 0,
    'scaffold-transient STATE.md must have zero blocking violations, got ' +
      JSON.stringify(r.blocking));
  ok('Test 2: scaffold-transient STATE.md validates clean');
})();

// ---------- compute-state STATE.md validates clean ----------

(function () {
  const computeState = path.join(REPO, 'scripts', 'compute-state');
  const out = execFileSync('bash', [computeState, ROOM_DIR], { encoding: 'utf8' });
  const statePath = path.join(ROOM_DIR, 'STATE.md');
  fs.writeFileSync(statePath, out, 'utf8');
  const r = validateFile(statePath);
  assert.ok(r.checked, 'compute-state STATE.md carries frontmatter');
  assert.equal(r.schema, 'STATE.md', 'computed STATE.md routes to STATE.md schema');
  assert.equal(r.blocking.length, 0,
    'compute-state STATE.md must have zero blocking violations, got ' +
      JSON.stringify(r.blocking));
  ok('Test 3: compute-state STATE.md validates clean');
})();

// ---------- Real USER.md (converged machine schema) validates clean ----------

(function () {
  const userPath = path.join(ROOM_DIR, 'USER.md');
  const base = userMdOps.emptyUser();
  base.canonical_role = 'navigator';
  base.journey_stage = null;
  userMdOps.writeUserMdAtomic(userPath, base);
  const r = validateFile(userPath);
  assert.ok(r.checked, 'written USER.md carries frontmatter');
  assert.equal(r.schema, 'USER.md', 'USER.md routes to USER.md schema (not artifact-default)');
  assert.equal(r.blocking.length, 0,
    'converged USER.md must have zero blocking violations, got ' +
      JSON.stringify(r.blocking));
  ok('Test 4: converged USER.md validates clean');
})();

// ---------- Every generated managed .md file validates clean ----------

(function () {
  const files = walkMd(ROOM_DIR, []);
  assert.ok(files.length >= 13,
    'expected the scaffolded room to have many .md files, got ' + files.length);
  const offenders = [];
  let checkedCount = 0;
  const bySchema = {};
  for (const f of files) {
    const r = validateFile(f);
    if (r.checked) {
      checkedCount += 1;
      bySchema[r.schema] = (bySchema[r.schema] || 0) + 1;
    }
    if (r.blocking.length > 0) {
      offenders.push(path.relative(ROOM_DIR, f) + ' -> ' + JSON.stringify(r.blocking));
    }
  }
  assert.equal(offenders.length, 0,
    'every generated managed file must validate clean; offenders:\n' +
      offenders.join('\n'));
  ok('Test 5: all ' + checkedCount + ' frontmatter-bearing files clean ' +
    '(' + JSON.stringify(bySchema) + ')');
})();

// ---------- Every section ROOM.md routes to ROOM.md schema ----------

(function () {
  for (const section of scaffold.SECTION_NAMES) {
    const roomMd = path.join(ROOM_DIR, section, 'ROOM.md');
    assert.ok(fs.existsSync(roomMd), 'section ROOM.md must exist: ' + section);
    const r = validateFile(roomMd);
    assert.equal(r.schema, 'ROOM.md', section + '/ROOM.md must route to ROOM.md schema');
    assert.equal(r.blocking.length, 0,
      section + '/ROOM.md must validate clean, got ' + JSON.stringify(r.blocking));
  }
  ok('Test 6: all section ROOM.md files route to ROOM.md schema and validate clean');
})();

// ---------- Documented new-project entry shapes validate clean ----------

(function () {
  // new-project.md Step 6: source + date.
  const step6 = {
    source: 'new-project exploration',
    date: '2026-07-06',
  };
  const r6 = schemas.validate('room/problem-definition/initial-exploration.md', step6);
  assert.equal(blockingViolations(r6).length, 0,
    'new-project Step 6 shape (source+date) must validate clean, got ' +
      JSON.stringify(r6.violations));

  // new-project.md Step 6.1: source + date + opportunity_ref.
  const step61 = {
    source: 'conversation-capture',
    date: '2026-07-06',
    opportunity_ref: 'opportunity-bank/whitespace-in-clinical-trials.md',
  };
  const r61 = schemas.validate('room/solution-design/seeded.md', step61);
  assert.equal(blockingViolations(r61).length, 0,
    'new-project Step 6.1 shape (source+date+opportunity_ref) must validate clean, got ' +
      JSON.stringify(r61.violations));

  ok('Test 7: both documented new-project entry shapes validate clean');
})();

// ---------- Legacy artifacts with title/status still recognized (no warnings) ----------

(function () {
  // A legacy artifact that DID carry title/source/status must not warn -- those
  // keys are still recognized (moved from required to optional, not dropped).
  const legacy = {
    title: 'Whitespace in CAR-T trial design',
    source: 'meeting/2026-04-12-clinical-team',
    status: 'active',
  };
  const r = schemas.validate('room/problem-definition/legacy.md', legacy);
  assert.equal(r.violations.length, 0,
    'legacy title/source/status artifact must produce zero violations, got ' +
      JSON.stringify(r.violations));
  ok('Test 8: legacy title/source/status artifact still recognized (no drift warnings)');
})();

process.stdout.write('\ntest-frontmatter-schema-reconcile: ' + passCount + '/8 passed\n');
