#!/usr/bin/env node
/*
 * Phase 121.5-08 Plan Task 2 -- doctor class I (deprecated-usage surface)
 * + F.1 selector wiring on onboard Step 6 + diagnose recommendation.
 *
 * Behavior contract (per plan):
 *   T1: scripts/doctor.cjs --deprecated-usage detects synthetic usage in temp
 *       transcript fixtures (a temp ~/.claude/projects/.../session.jsonl-like
 *       fixture mentioning "/mos:heal" -- the class I detector picks it up).
 *   T2: Class I returns {class: 'I', status, action, deprecated_uses: []}.
 *   T3: --deprecated-usage exits 0 when no deprecated commands used; exits 1
 *       when violations found.
 *   T4: doctor --all includes class I in the cascade.
 *   T5: commands/onboard.md Step 6 body contains the canonical F.1 selector
 *       vocabulary (Run Methodology / Defer / Free-Text).
 *   T6: commands/diagnose.md recommendation block contains the canonical F.1
 *       selector vocabulary.
 *   T7: CHANGELOG.md has an Unreleased / next-beta entry listing all 5
 *       renames + the /mos:mos creation + the F.1 wiring + the class I add.
 *
 * Hermetic: uses fs.mkdtempSync for synthetic transcript fixture (T1). The
 * doctor invocation spawns scripts/doctor.cjs as a subprocess with the
 * fixture dir bound via MINDRIAN_DOCTOR_TRANSCRIPTS_DIR.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DOCTOR_CJS = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');

let pass = 0;
let fail = 0;
const failures = [];

function assert(cond, name, detail) {
  if (cond) {
    pass++;
    console.log('PASS  ' + name);
  } else {
    fail++;
    failures.push(name + (detail ? ' -- ' + detail : ''));
    console.log('FAIL  ' + name + (detail ? ' -- ' + detail : ''));
  }
}

// --- T1 + T2 + T3 (positive): synthesize a fixture transcript dir with
// "/mos:heal" usage; --deprecated-usage detects + exits 1 + returns class I.
{
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-deprec-'));
  const sessionDir = path.join(tmpRoot, 'sessions', 'fake-project-hash');
  fs.mkdirSync(sessionDir, { recursive: true });
  const jsonlPath = path.join(sessionDir, 'session-abc.jsonl');
  // Recent mtime (now). Per implementation contract: scan last 7 days.
  const fixture = JSON.stringify({ role: 'user', content: 'let me run /mos:heal here' }) + '\n'
                + JSON.stringify({ role: 'user', content: 'now /mos:query something' }) + '\n';
  fs.writeFileSync(jsonlPath, fixture);
  const now = Date.now();
  fs.utimesSync(jsonlPath, new Date(now), new Date(now));

  const r = cp.spawnSync('node', [DOCTOR_CJS, '--deprecated-usage', '--json'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_DOCTOR_TRANSCRIPTS_DIR: tmpRoot }),
    timeout: 30000,
  });
  // Parse JSON envelope
  let envelope = null;
  if (r.stdout) {
    const start = r.stdout.indexOf('{');
    if (start >= 0) {
      try { envelope = JSON.parse(r.stdout.slice(start)); } catch (_) { envelope = null; }
    }
  }
  assert(envelope !== null, 'T1: --deprecated-usage emits parseable JSON', (r.stdout || '').slice(0, 300));
  const cls = envelope && envelope.checks && envelope.checks['deprecated-usage'];
  assert(cls !== undefined && cls !== null, 'T1: report.checks["deprecated-usage"] exists', JSON.stringify(envelope && envelope.checks));
  if (cls) {
    assert(cls.class === 'L', 'T2: class==="L"', cls.class);
    assert(typeof cls.status === 'string', 'T2: status is a string', cls.status);
    assert(typeof cls.action === 'string', 'T2: action is a string', cls.action);
    assert(Array.isArray(cls.deprecated_uses), 'T2: deprecated_uses is array', JSON.stringify(cls.deprecated_uses));
    assert(cls.deprecated_uses.length >= 2, 'T1: detected at least 2 deprecated uses (heal + query)', JSON.stringify(cls.deprecated_uses));
    const found = cls.deprecated_uses.map(function (x) { return x.deprecated; }).sort();
    assert(found.indexOf('/mos:heal') >= 0, 'T1: /mos:heal detected', JSON.stringify(found));
    assert(found.indexOf('/mos:query') >= 0, 'T1: /mos:query detected', JSON.stringify(found));
    assert(cls.status === 'DEPRECATED_USAGE' || cls.status === 'warn', 'T2: status flags violation', cls.status);
  }
  // Cleanup
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
}

// --- T3 negative: no transcripts -> --deprecated-usage clean.
{
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-deprec-clean-'));
  const r = cp.spawnSync('node', [DOCTOR_CJS, '--deprecated-usage', '--json'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_DOCTOR_TRANSCRIPTS_DIR: tmpRoot }),
    timeout: 30000,
  });
  let envelope = null;
  if (r.stdout) {
    const start = r.stdout.indexOf('{');
    if (start >= 0) { try { envelope = JSON.parse(r.stdout.slice(start)); } catch (_) {} }
  }
  const cls = envelope && envelope.checks && envelope.checks['deprecated-usage'];
  // Phase 217 Plan 03: status vocabulary normalized to the standard
  // ok|warn|skip; the legacy 'OK' literal is preserved on legacy_status.
  assert(cls && cls.status === 'ok', 'T3: status === ok with no deprecated usage', cls && cls.status);
  assert(cls && cls.legacy_status === 'OK', 'T3: legacy_status === OK preserved', cls && cls.legacy_status);
  assert(cls && cls.deprecated_uses && cls.deprecated_uses.length === 0, 'T3: deprecated_uses is empty array');
  // Per spec: --deprecated-usage exits 0 when clean.
  assert(r.status === 0, 'T3: exit 0 when clean', String(r.status));
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
}

// --- T4: --all activates --deprecated-usage in the cascade.
{
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-deprec-all-'));
  const r = cp.spawnSync('node', [DOCTOR_CJS, '--all', '--json'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_DOCTOR_TRANSCRIPTS_DIR: tmpRoot }),
    timeout: 60000,
  });
  let envelope = null;
  if (r.stdout) {
    const start = r.stdout.indexOf('{');
    if (start >= 0) { try { envelope = JSON.parse(r.stdout.slice(start)); } catch (_) {} }
  }
  const cls = envelope && envelope.checks && envelope.checks['deprecated-usage'];
  assert(cls !== undefined && cls !== null, 'T4: --all includes deprecated-usage in cascade', JSON.stringify(envelope && envelope.checks ? Object.keys(envelope.checks) : null));
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
}

// --- T5: commands/onboard.md Step 6 has F.1 selector vocabulary.
{
  const onboardPath = path.join(REPO_ROOT, 'commands', 'onboard.md');
  const body = fs.readFileSync(onboardPath, 'utf8');
  // Locate Step 6 region for verification (the test asserts the F.1 lives
  // inside or in the vicinity of Step 6, not just anywhere in the file).
  const step6Idx = body.indexOf('## Step 6');
  assert(step6Idx > 0, 'T5: Step 6 section exists', String(step6Idx));
  // The whole step-6 region (from Step 6 to end of file or next ##)
  const rest = body.slice(step6Idx);
  const nextStep = rest.indexOf('\n## ', 5);
  const step6Region = nextStep > 0 ? rest.slice(0, nextStep) : rest;
  assert(/F\.1/.test(step6Region), 'T5: Step 6 mentions F.1', step6Region.slice(0, 400));
  assert(/Run Methodology/.test(step6Region), 'T5: Step 6 has "Run Methodology" verb');
  assert(/Defer/.test(step6Region), 'T5: Step 6 has "Defer" verb');
  assert(/Free-Text/.test(step6Region), 'T5: Step 6 has "Free-Text" verb');
  assert(step6Region.indexOf('—') < 0, 'T5: Step 6 region has no em-dash');
}

// --- T6: commands/diagnose.md recommendation has F.1 selector vocabulary.
{
  const diagPath = path.join(REPO_ROOT, 'commands', 'diagnose.md');
  const body = fs.readFileSync(diagPath, 'utf8');
  assert(/F\.1/.test(body), 'T6: diagnose.md mentions F.1');
  assert(/Run Methodology/.test(body), 'T6: diagnose.md has "Run Methodology" verb');
  assert(/Defer/.test(body), 'T6: diagnose.md has "Defer" verb');
  assert(/Free-Text/.test(body), 'T6: diagnose.md has "Free-Text" verb');
  assert(body.indexOf('—') < 0, 'T6: diagnose.md has no em-dash');
}

// --- T7: CHANGELOG.md entry for Phase 121.5-08 covers all 5 renames + /mos:mos + F.1.
{
  const cl = fs.readFileSync(path.join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');
  assert(/Phase 121\.5-08/.test(cl), 'T7: CHANGELOG mentions Phase 121.5-08');
  assert(/heal/i.test(cl), 'T7: CHANGELOG mentions heal rename');
  assert(/query/i.test(cl), 'T7: CHANGELOG mentions query rename');
  assert(/organize/i.test(cl), 'T7: CHANGELOG mentions organize rename');
  assert(/hmi-status/i.test(cl), 'T7: CHANGELOG mentions hmi-status rename');
  assert(/visualize/i.test(cl), 'T7: CHANGELOG mentions visualize rename');
  assert(/\/mos:mos/.test(cl), 'T7: CHANGELOG mentions /mos:mos creation');
  // F.1 selector wiring announcement
  assert(/F\.1/.test(cl) || /F.1 selector/.test(cl), 'T7: CHANGELOG mentions F.1 selector wiring');
}

console.log('');
console.log('doctor-deprecation-surface.test.cjs: ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
process.exit(0);
