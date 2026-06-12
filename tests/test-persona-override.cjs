'use strict';
// Quick task 260612-t2k -- persona override (identity-only) seam test.
//
// Proves the readUserMd override seam end to end against a temp store and a
// temp USER.md fixture. Asserts:
//   1. No override        -> readUserMd returns the fixture's real persona.
//   2. setOverride(founder)-> readUserMd returns founder + override_active:true,
//                            IGNORING the fixture file.
//   3. detectPersonaUpdate({signal.source:'user_override'}) -> shouldUpdate:true,
//                            reason:'user_override' REGARDLESS of confidence
//                            (locks the existing seam so it cannot regress).
//   4. clearOverride()    -> readUserMd returns the real fixture again,
//                            byte-identical, override_active:false.
//   5. Malformed / absent store -> getOverride() null, readUserMd falls
//                            through (no throw).
//
// Hermetic: MINDRIAN_PERSONA_OVERRIDE_PATH points at a temp file for the whole
// run, so the test NEVER touches the real ~/.mindrian/persona-override.json.
// The fixture USER.md lives under os.tmpdir().
//
// House rule: hyphens only, no em-dashes (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// Point the override store at a temp file BEFORE requiring the modules so the
// store path resolution picks it up. The modules read the env var per-call
// (storePath() reads process.env each time), so order is not strictly load
// bearing, but set it up front to be safe.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'persona-override-t2k-'));
const STORE_PATH = path.join(tmpDir, 'persona-override.json');
process.env.MINDRIAN_PERSONA_OVERRIDE_PATH = STORE_PATH;

const personaOverride = require(path.join(REPO_ROOT, 'lib', 'core', 'persona-override.cjs'));
const userMdOps = require(path.join(REPO_ROOT, 'lib', 'core', 'user-md-ops.cjs'));

// Build a real USER.md fixture with a known persona that differs from the
// override we will set, so "ignored while active" is observable.
const USER_MD_PATH = path.join(tmpDir, 'USER.md');
const FIXTURE = [
  '---',
  'canonical_role: Researcher',
  'role_blend:',
  '  researcher: 0.9',
  '  founder: 0.1',
  '---',
  '',
  '# USER.md body (preserved)',
  '',
].join('\n');
fs.writeFileSync(USER_MD_PATH, FIXTURE);

// Capture the exact bytes readUserMd produces on a clean (no-override) read so
// assertion 4 can prove byte-identical behavior after clear.
function readSerialized() {
  return JSON.stringify(userMdOps.readUserMd(USER_MD_PATH));
}

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('ok  ' + name + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('FAIL ' + name + '\n     ' + (e && e.message ? e.message : e) + '\n');
  }
}

// Ensure clean start.
personaOverride.clearOverride();

// ---------------------------------------------------------------------------
// 1. No override -> readUserMd returns the fixture's real persona.
// ---------------------------------------------------------------------------
const cleanSerialized = readSerialized();
check('Test 1: no override -> readUserMd returns the fixture real persona', () => {
  const r = userMdOps.readUserMd(USER_MD_PATH);
  assert.equal(r.canonical_role, 'Researcher', 'canonical_role should be the file value');
  assert.equal(r.role_blend.researcher, 0.9, 'researcher weight should be the file value');
  assert.equal(r.role_blend.founder, 0.1, 'founder weight should be the file value');
  assert.equal(r.override_active, false, 'override_active false on the normal path');
  assert.equal(personaOverride.isActive(), false, 'isActive false when no store');
});

// ---------------------------------------------------------------------------
// 2. setOverride(founder) -> readUserMd returns founder, override_active true,
//    IGNORING the fixture file.
// ---------------------------------------------------------------------------
check('Test 2: setOverride(founder) -> readUserMd returns synthetic, ignores file', () => {
  const written = personaOverride.setOverride({
    canonical_role: 'founder',
    role_blend: { founder: 1.0 },
  });
  assert.equal(written.canonical_role, 'founder', 'setOverride returns the written canonical_role');
  assert.equal(written.role_blend.founder, 1.0, 'setOverride returns the written role_blend weight');
  assert.equal(typeof written.set_at, 'string', 'setOverride stamps set_at');
  assert.equal(personaOverride.isActive(), true, 'isActive true after setOverride');

  const r = userMdOps.readUserMd(USER_MD_PATH);
  assert.equal(r.canonical_role, 'founder', 'readUserMd returns synthetic canonical_role');
  assert.equal(r.override_active, true, 'override_active true while active');
  assert.equal(r.role_blend.founder, 1.0, 'synthetic founder weight surfaced');
  assert.equal(r.role_blend.researcher, 0, 'fixture researcher weight ignored while override active');
});

// ---------------------------------------------------------------------------
// 3. detectPersonaUpdate user_override seam locks in.
// ---------------------------------------------------------------------------
check('Test 3: detectPersonaUpdate user_override -> shouldUpdate true regardless of confidence', () => {
  const low = userMdOps.detectPersonaUpdate({
    current: { persona: 'Researcher', update_threshold: 0.99 },
    signal: { source: 'user_override', confidence: 0.0, consecutive_signal_count: 0 },
  });
  assert.equal(low.shouldUpdate, true, 'user_override bypasses confidence + consecutive gate');
  assert.equal(low.reason, 'user_override', 'reason is user_override');
});

// ---------------------------------------------------------------------------
// 4. clearOverride() -> readUserMd returns the real fixture again,
//    byte-identical, override_active false.
// ---------------------------------------------------------------------------
check('Test 4: clearOverride() -> readUserMd byte-identical to the clean read, override_active false', () => {
  personaOverride.clearOverride();
  assert.equal(personaOverride.isActive(), false, 'isActive false after clear');
  const r = userMdOps.readUserMd(USER_MD_PATH);
  assert.equal(r.canonical_role, 'Researcher', 'real canonical_role restored');
  assert.equal(r.override_active, false, 'override_active false after clear');
  assert.equal(
    readSerialized(),
    cleanSerialized,
    'readUserMd output is byte-identical to the pre-override clean read'
  );
});

// ---------------------------------------------------------------------------
// 5. Malformed / absent store -> getOverride() null, readUserMd falls through.
// ---------------------------------------------------------------------------
check('Test 5: malformed / absent store -> getOverride null, readUserMd falls through (no throw)', () => {
  // Absent: store was just cleared.
  assert.equal(personaOverride.getOverride(), null, 'absent store -> null');
  let r = userMdOps.readUserMd(USER_MD_PATH);
  assert.equal(r.canonical_role, 'Researcher', 'absent store -> real file read');

  // Malformed JSON bytes written directly to the store path.
  fs.writeFileSync(STORE_PATH, '{ this is not valid json ]]');
  assert.equal(personaOverride.getOverride(), null, 'malformed store -> null (graceful)');
  // readUserMd must not throw and must fall through to the real file.
  r = userMdOps.readUserMd(USER_MD_PATH);
  assert.equal(r.canonical_role, 'Researcher', 'malformed store -> falls through to real file');
  assert.equal(r.override_active, false, 'malformed store -> override_active false');

  // A JSON array (non-object) is also treated as no override.
  fs.writeFileSync(STORE_PATH, '[1,2,3]');
  assert.equal(personaOverride.getOverride(), null, 'non-object JSON -> null');

  // Cleanup the malformed bytes.
  personaOverride.clearOverride();
});

// ---------------------------------------------------------------------------
// Teardown + summary.
// ---------------------------------------------------------------------------
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}

process.stdout.write(
  '\npersona-override: ' + passed + '/' + (passed + failed) + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
