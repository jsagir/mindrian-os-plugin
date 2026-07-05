#!/usr/bin/env node
'use strict';

/*
 * Quick task 260705-sy9 - the skill-mirror staleness tripwire test.
 *
 * Mirrors the structure of tests/test-connector-tripwire.cjs (assert helper,
 * failure counter, exit 1 on any FAIL) blended with the static wiring proofs
 * of tests/test-render-gate-wiring.cjs. Proves build-skill-mirrors.cjs --check
 * is wired HARD-FAIL into pre-commit (tracked hook + installer + installed
 * hook), verify-release, and doctor --acceptance, and that the trigger regex
 * only fires on the intended paths.
 *
 * House rules: hyphens only, no em-dashes. Pure-local, zero Brain/network.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GENERATOR = path.join(REPO_ROOT, 'scripts', 'build-skill-mirrors.cjs');
const gen = require(GENERATOR);
const { checkSkipList } = gen;

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log('  ok  ' + label);
  } else {
    console.error('  FAIL  ' + label);
    failures += 1;
  }
}

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

// ---------------------------------------------------------------------------
// Wiring proof, tracked hook: scripts/hooks/pre-commit contains a guard
// invoking build-skill-mirrors.cjs" --check with fail-closed exit 2, path-
// scoped by the trigger regex.
// ---------------------------------------------------------------------------
const hookSrc = read('scripts/hooks/pre-commit');

assert(
  /build-skill-mirrors\.cjs" --check/.test(hookSrc),
  'scripts/hooks/pre-commit invokes build-skill-mirrors.cjs --check'
);

const hookFailClosed = hookSrc.match(
  /node "[^"]*build-skill-mirrors\.cjs" --check \|\| \{ echo "skill-mirror drift[^}]*exit 2; \}/
);
assert(
  !!hookFailClosed,
  'scripts/hooks/pre-commit skill-mirror guard is HARD-FAIL (exit 2), the tracked hook convention'
);

// Extract the trigger ERE from the tracked hook source: the grep -qE '...'
// line immediately preceding the skill-mirrors block.
const triggerMatch = hookSrc.match(
  /Quick task 260705-sy9 guardian[\s\S]*?grep -qE '([^']+)'/
);
assert(!!triggerMatch, 'tracked hook skill-mirrors block has an extractable trigger regex');

const triggerRe = triggerMatch ? new RegExp(triggerMatch[1]) : null;

// ---------------------------------------------------------------------------
// Trigger-regex behavioral cases: positive matches for commands/*.md and
// skills/*/SKILL.md, negative controls for unrelated paths.
// ---------------------------------------------------------------------------
if (triggerRe) {
  assert(triggerRe.test('commands/foo.md'), 'trigger regex MATCHES commands/foo.md');
  assert(triggerRe.test('skills/foo/SKILL.md'), 'trigger regex MATCHES skills/foo/SKILL.md');
  assert(!triggerRe.test('lib/core/navigation.cjs'), 'trigger regex does NOT match lib/core/navigation.cjs (negative control)');
  assert(!triggerRe.test('docs/foo.md'), 'trigger regex does NOT match docs/foo.md (negative control)');
  assert(!triggerRe.test('skills/foo/README.md'), 'trigger regex does NOT match skills/foo/README.md (negative control)');
}

// ---------------------------------------------------------------------------
// Wiring proof, installer: scripts/install-pre-commit.sh has the grep-presence
// guard AND invokes build-skill-mirrors.cjs --check in BOTH install-block
// families (>=2 invocations), each fail-closed with exit 1.
// ---------------------------------------------------------------------------
const installSrc = read('scripts/install-pre-commit.sh');

assert(
  /grep -q "build-skill-mirrors\.cjs --check"/.test(installSrc),
  'install-pre-commit.sh grep-presence guard references build-skill-mirrors.cjs --check'
);

const installInvocations = (installSrc.match(/build-skill-mirrors\.cjs" --check/g) || []).length;
assert(
  installInvocations >= 2,
  'install-pre-commit.sh invokes build-skill-mirrors.cjs --check in BOTH install-block families (>=2 invocations, found ' +
    installInvocations +
    ')'
);

const installFailClosed = installSrc.match(
  /node "[^"]*build-skill-mirrors\.cjs" --check \|\| \{ echo "skill-mirror drift[^}]*exit 1; \}/g
) || [];
assert(
  installFailClosed.length >= 2,
  'install-pre-commit.sh skill-mirror invocations are HARD-FAIL (exit 1), the installer-family convention -- in BOTH families'
);

// ---------------------------------------------------------------------------
// Wiring proof, verify-release: source contains a build-skill-mirrors.cjs" --
// check invocation gated by fail().
// ---------------------------------------------------------------------------
const releaseSrc = read('scripts/verify-release');
assert(
  /build-skill-mirrors\.cjs" --check/.test(releaseSrc),
  'verify-release invokes build-skill-mirrors.cjs --check'
);
assert(
  /fail "Skill-mirror check FAILED/.test(releaseSrc),
  'verify-release gates the skill-mirror check behind fail()'
);

// ---------------------------------------------------------------------------
// Wiring proof, doctor: scripts/doctor.cjs source contains the gates[] entry
// inside the coverage-gate region.
// ---------------------------------------------------------------------------
const doctorSrc = read('scripts/doctor.cjs');
assert(
  /\{\s*id:\s*'skill-mirrors',\s*script:\s*'build-skill-mirrors\.cjs'\s*\}/.test(doctorSrc),
  "doctor.cjs gates[] array includes { id: 'skill-mirrors', script: 'build-skill-mirrors.cjs' }"
);
assert(
  doctorSrc.indexOf("id: 'coverage-gate'") >= 0 &&
    doctorSrc.indexOf("id: 'coverage-gate'") < doctorSrc.indexOf("id: 'skill-mirrors'"),
  'skill-mirrors gate lives inside the coverage-gate acceptance point (fold-in, not a new point)'
);

// ---------------------------------------------------------------------------
// Clean tree: the SAME code path the hook runs exits 0 on the real tree.
// ---------------------------------------------------------------------------
{
  const res = spawnSync(process.execPath, [GENERATOR, '--check'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert(
    res.status === 0,
    'node scripts/build-skill-mirrors.cjs --check exits 0 on the clean tree (the SAME path the hook runs)'
  );
}

// ---------------------------------------------------------------------------
// SKIP_LIST synthetic cases via the Task 1 exports, built under a temp
// fixture (fs.mkdtempSync under os.tmpdir).
// ---------------------------------------------------------------------------
{
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-mirrors-tripwire-'));
  const commandsDir = path.join(tmpRoot, 'commands');
  const skillsDir = path.join(tmpRoot, 'skills');
  fs.mkdirSync(commandsDir, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });

  const cmdBody = '---\nname: fake\n---\n\nFake command body for the tripwire fixture.\n';
  fs.writeFileSync(path.join(commandsDir, 'fake.md'), cmdBody);

  // (a) no skills/fake/SKILL.md at all -> SKIP-LIST MISSING
  {
    const errs = checkSkipList({ skipList: ['fake'], commandsDir, skillsDir });
    assert(
      errs.length === 1 && errs[0].indexOf('SKIP-LIST MISSING') !== -1,
      '(a) missing skill fixture is flagged SKIP-LIST MISSING'
    );
  }

  // (b) skills/fake/SKILL.md written byte-identical to the command -> NOT DIVERGENT
  {
    fs.mkdirSync(path.join(skillsDir, 'fake'), { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'fake', 'SKILL.md'), cmdBody);
    const errs = checkSkipList({ skipList: ['fake'], commandsDir, skillsDir });
    assert(
      errs.length === 1 && errs[0].indexOf('SKIP-LIST NOT DIVERGENT') !== -1,
      '(b) byte-identical skill fixture is flagged SKIP-LIST NOT DIVERGENT'
    );
  }

  // (c) change one byte in SKILL.md -> zero failures (genuinely divergent)
  {
    const divergedBody = cmdBody.replace('Fake command body', 'Fake SKILL body');
    fs.writeFileSync(path.join(skillsDir, 'fake', 'SKILL.md'), divergedBody);
    const errs = checkSkipList({ skipList: ['fake'], commandsDir, skillsDir });
    assert(
      errs.length === 0,
      '(c) genuinely divergent skill fixture (one byte changed) returns zero failures'
    );
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

// (d) real-tree negative control: defaults return [].
{
  const errs = checkSkipList();
  assert(errs.length === 0, '(d) checkSkipList() with defaults returns [] on the real tree');
}

if (failures > 0) {
  console.error('\ntest-skill-mirrors-tripwire: ' + failures + ' FAILURE(S)');
  process.exit(1);
}
console.log('\ntest-skill-mirrors-tripwire: PASS (wiring proofs + trigger-regex cases + 4 SKIP_LIST cases + clean tree)');
