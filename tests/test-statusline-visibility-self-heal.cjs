// F6 statusline VISIBILITY self-heal (.planning/debug/windows-install-update-ux.md).
//
// Locks the closed-loop behavior of scripts/check-onboard-statusline.cjs: when the
// SessionStart gate would fire, it FIRST auto-runs the shipped doctor repair
// (`doctor.cjs --statusline-visibility --fix --json`); on success it writes the
// touch-file and SUPPRESSES the manual "do you see it?" question; only on failure
// does it fall back to surfacing the question. Every invariant is preserved:
// never blocks the hook chain, idempotent (no doctor spawn when already onboarded),
// degrades gracefully when doctor is unavailable.
//
// The doctor spawn is STUBBED via a fake CLAUDE_PLUGIN_ROOT/scripts/doctor.cjs plus
// a temp HOME -- no real broken install required. Each case re-requires the hook
// module fresh so the module-load-time PLUGIN_ROOT const picks up the fake root.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let pass = 0, fail = 0;
const chk = (cond, label) => { if (cond) pass++; else { fail++; console.log('  FAIL ' + label); } };

const HOOK_PATH = path.join(__dirname, '..', 'scripts', 'check-onboard-statusline.cjs');
const REAL_VER = require(path.join(__dirname, '..', '.claude-plugin', 'plugin.json')).version;

// Build a scratch sandbox: a fake plugin root (holds our stub doctor.cjs) and a
// fresh HOME (so no real touch-file exists -> the gate fires). `doctorMode`:
//   'ok'      -> stub reports class G+H both status:'ok' (repaired)
//   'drift'   -> stub reports still-drifting (status:'warn')
//   'missing' -> no doctor.cjs written at all (doctor-unavailable)
// The stub always drops a sentinel file when invoked, so a test can assert that
// the doctor was NOT spawned (idempotency case).
function makeSandbox(doctorMode) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-selfheal-'));
  const fakeRoot = path.join(base, 'plugin-root');
  const fakeHome = path.join(base, 'home');
  fs.mkdirSync(path.join(fakeRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(fakeHome, { recursive: true });
  const sentinel = path.join(base, 'doctor-invoked.sentinel');
  if (doctorMode !== 'missing') {
    const gStatus = doctorMode === 'ok' ? 'ok' : 'warn';
    const stub = [
      "'use strict';",
      "require('node:fs').writeFileSync(" + JSON.stringify(sentinel) + ", 'x');",
      'const report = { checks: {',
      "  'statusline-visibility': { status: " + JSON.stringify(gStatus) + " },",
      "  'install-incomplete': { status: " + JSON.stringify(gStatus) + " },",
      '} };',
      'process.stdout.write(JSON.stringify(report));',
      'process.exit(0);',
    ].join('\n');
    fs.writeFileSync(path.join(fakeRoot, 'scripts', 'doctor.cjs'), stub);
  }
  return { base, fakeRoot, fakeHome, sentinel };
}

// Fresh module load under a chosen sandbox env. Restores env + require cache after.
function loadHook(sb) {
  const savedRoot = process.env.CLAUDE_PLUGIN_ROOT;
  const savedHome = process.env.HOME;
  process.env.CLAUDE_PLUGIN_ROOT = sb.fakeRoot;
  process.env.HOME = sb.fakeHome;
  delete require.cache[require.resolve(HOOK_PATH)];
  const mod = require(HOOK_PATH);
  return {
    mod,
    restore() {
      if (savedRoot === undefined) delete process.env.CLAUDE_PLUGIN_ROOT; else process.env.CLAUDE_PLUGIN_ROOT = savedRoot;
      if (savedHome === undefined) delete process.env.HOME; else process.env.HOME = savedHome;
      delete require.cache[require.resolve(HOOK_PATH)];
    },
  };
}

// ---- Case (a): missing statusLine wiring -> auto-fix succeeds -> touch-file + suppress ----
(function caseA() {
  const sb = makeSandbox('ok');
  const h = loadHook(sb);
  try {
    // Sanity: fresh HOME means no touch-file -> the gate WOULD fire.
    chk(h.mod.shouldFire() === true, '(a) gate fires on a fresh install (no touch-file)');

    const frag = h.mod.contributeOnboarding();
    // Resolved -> empty fragment (question suppressed).
    chk(frag && frag.has_payload === false, '(a) question SUPPRESSED after successful auto-fix');
    chk(fs.existsSync(sb.sentinel) === true, '(a) doctor WAS spawned (auto-fix attempted)');

    // Touch-file written with the documented shape + running version.
    const tfPath = h.mod.touchFilePath();
    chk(fs.existsSync(tfPath) === true, '(a) touch-file written on success');
    const tf = JSON.parse(fs.readFileSync(tfPath, 'utf8'));
    chk(tf.installed_version === REAL_VER, '(a) touch-file records the running plugin version');
    chk(typeof tf.completed_at === 'string' && !Number.isNaN(Date.parse(tf.completed_at)),
      '(a) touch-file completed_at is a valid ISO timestamp');
    chk(Object.keys(tf).sort().join(',') === 'completed_at,installed_version',
      '(a) touch-file shape unchanged (exactly installed_version + completed_at)');

    // Idempotent follow-up: now that the touch-file matches, the gate is a no-op.
    chk(h.mod.shouldFire() === false, '(a) gate no longer fires once onboarded at this version');
  } finally { h.restore(); }
})();

// ---- Case (b): already-healthy + current touch-file -> no-op, NO doctor spawn ----
(function caseB() {
  const sb = makeSandbox('ok');
  // Pre-seed a current touch-file so shouldFire() is false.
  const tfDir = path.join(sb.fakeHome, '.mindrian', 'onboarding');
  fs.mkdirSync(tfDir, { recursive: true });
  fs.writeFileSync(path.join(tfDir, 'statusline-onboarded.json'),
    JSON.stringify({ installed_version: REAL_VER, completed_at: new Date().toISOString() }));
  const h = loadHook(sb);
  try {
    chk(h.mod.shouldFire() === false, '(b) healthy + current touch-file: gate does not fire');
    const frag = h.mod.contributeOnboarding();
    chk(frag && frag.has_payload === false, '(b) no-op: nothing surfaced');
    chk(fs.existsSync(sb.sentinel) === false, '(b) doctor was NOT spawned (idempotent no-op)');
  } finally { h.restore(); }
})();

// ---- Case (c): doctor unavailable -> degrade gracefully, surface question, never throw ----
(function caseC() {
  const sb = makeSandbox('missing');
  const h = loadHook(sb);
  try {
    chk(h.mod.shouldFire() === true, '(c) gate fires on a fresh install');

    // Direct: the self-heal probe degrades to unresolved without throwing.
    let heal;
    assert.doesNotThrow(() => { heal = h.mod.attemptStatuslineSelfHeal(); },
      '(c) attemptStatuslineSelfHeal never throws when doctor is missing');
    chk(heal && heal.resolved === false, '(c) self-heal reports unresolved when doctor is unavailable');

    // Integration: falls back to SURFACING the question, never throws.
    let frag;
    assert.doesNotThrow(() => { frag = h.mod.contributeOnboarding(); },
      '(c) contributeOnboarding never throws when doctor is unavailable');
    chk(frag && frag.has_payload === true, '(c) manual question SURFACED as the fallback');

    // No touch-file written when unresolved.
    chk(fs.existsSync(h.mod.touchFilePath()) === false, '(c) no touch-file written when auto-fix could not resolve');
  } finally { h.restore(); }
})();

// ---- Case (d): doctor runs but reports STILL-DRIFT -> surface question, no touch-file ----
(function caseD() {
  const sb = makeSandbox('drift');
  const h = loadHook(sb);
  try {
    const heal = h.mod.attemptStatuslineSelfHeal();
    chk(heal && heal.resolved === false, '(d) unresolved when doctor still reports drift after --fix');
    const frag = h.mod.contributeOnboarding();
    chk(fs.existsSync(sb.sentinel) === true, '(d) doctor WAS spawned');
    chk(frag && frag.has_payload === true, '(d) question surfaced when drift persists');
    chk(fs.existsSync(h.mod.touchFilePath()) === false, '(d) no touch-file on persistent drift');
  } finally { h.restore(); }
})();

console.log(`\nstatusline visibility self-heal: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
