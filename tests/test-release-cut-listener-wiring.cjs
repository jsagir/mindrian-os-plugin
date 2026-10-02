'use strict';
/*
 * tests/test-release-cut-listener-wiring.cjs -- quick 261002-5v9
 * (navigator ruling 2026-10-02).
 *
 * Proves scripts/release.sh wires the release-cut listener the way the
 * ruling says:
 *   - STATIC: the --no-cut-listener flag (var, case arm, USAGE_BLOCK), the
 *     preamble refusal, Step 0.55 between Step 0.5 and Step 0.6 (reads
 *     repo-version.cjs and rev-parse HEAD, calls the theo leg, stops only in
 *     the 10|11 arm), Step 9.6c between Step 9.6b and Step 9.7 (website leg
 *     at $NEW_VERSION, no non-comment exit), and no Step 5.6 block (retired by
 *     quick 261002-byh: Step 0.55 is place 8's leading half now).
 *   - LIVE, hermetic: `bash scripts/release.sh patch --dry-run` with a fake
 *     Theo checkout whose python stub would touch a sentinel. The dry-run
 *     must print the call, never run the stub, never fire the notify
 *     command, write no report, keep every doctor.cjs expectedSteps member,
 *     and leave every release-owned file byte-identical (scoped, not the
 *     whole tree: peer sessions share it; review WR-06). More runs: Theo absent ->
 *     loud SKIPPED naming the path; --no-cut-listener -> audited line, no call.
 *
 * Safe by construction: --dry-run exits before any mutation (the same
 * property tests/test-349-dry-run-never-sends.cjs relies on), HOME is a temp
 * dir, and every seam env var points at a temp path.
 *
 * Bare node script: assert, an ok(label) counter, no framework, non-zero
 * exit on any assertion failure (uncaught throw), temp dirs removed in finally.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const RELEASE_SH = path.join(REPO, 'scripts', 'release.sh');
const DOCTOR_CJS = path.join(REPO, 'scripts', 'doctor.cjs');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-release-cut-listener-wiring:');

const src = fs.readFileSync(RELEASE_SH, 'utf8');

function headerIdx(prefix) {
  const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'm');
  const m = re.exec(src);
  return m ? m.index : -1;
}

function blockOf(prefix) {
  const start = headerIdx(prefix);
  assert.ok(start !== -1, 'header not found: ' + prefix);
  const rest = src.slice(start + 1);
  const next = rest.search(/^# --- Step/m);
  return next === -1 ? src.slice(start) : src.slice(start, start + 1 + next);
}

function nonComment(text) {
  return text.split('\n').filter(function (l) { return !/^\s*#/.test(l); });
}

// ---------------------------------------------------------------------------
// STATIC
// ---------------------------------------------------------------------------
{
  assert.ok(/^NO_CUT_LISTENER=0\b/m.test(src), 'NO_CUT_LISTENER=0 initialized');
  ok('flag: NO_CUT_LISTENER=0 initialized');

  assert.ok(/--no-cut-listener\)\s*NO_CUT_LISTENER=1\s*;;/.test(src), 'case arm sets NO_CUT_LISTENER=1');
  ok('flag: --no-cut-listener) NO_CUT_LISTENER=1 ;; present in the arg loop');

  const usage = (src.match(/^USAGE_BLOCK="[^\n]*"$/m) || [''])[0];
  assert.ok(usage.indexOf('[--no-cut-listener]') !== -1, 'single-line USAGE_BLOCK contains [--no-cut-listener]');
  assert.ok(usage.indexOf('[--no-cut-listener] [--dry-run]') !== -1, '[--no-cut-listener] sits immediately before [--dry-run]');
  ok('flag: [--no-cut-listener] in the single-line USAGE_BLOCK, right before [--dry-run]');

  const step0 = headerIdx('# --- Step 0:');
  const refusal = src.indexOf('release-cut-listener.cjs" ]; then');
  assert.ok(refusal !== -1 && refusal < step0, 'preamble refuses a missing listener before Step 0');
  assert.ok(/release-cut-listener\.cjs missing -- refusing to run a release from an incomplete checkout/.test(src));
  ok('preamble: refuses a missing scripts/release-cut-listener.cjs before Step 0 (incomplete-checkout wording)');

  const i05 = headerIdx('# --- Step 0.5:');
  const i055 = headerIdx('# --- Step 0.55');
  const i06 = headerIdx('# --- Step 0.6:');
  assert.ok(i05 !== -1 && i055 !== -1 && i06 !== -1);
  assert.ok(i05 < i055 && i055 < i06, 'Step 0.55 sits after Step 0.5 and before Step 0.6');
  ok('Step 0.55 header sits after Step 0.5 and before Step 0.6');

  const b055 = blockOf('# --- Step 0.55');
  assert.ok(b055.indexOf('repo-version.cjs') !== -1, 'Step 0.55 reads repo-version.cjs');
  assert.ok(b055.indexOf('rev-parse HEAD') !== -1, 'Step 0.55 resolves the full HEAD sha');
  assert.ok(b055.indexOf('release-cut-listener.cjs" theo') !== -1, 'literal theo call site');
  assert.ok(b055.indexOf('NEW_VERSION') === -1 || nonComment(b055).join('\n').indexOf('NEW_VERSION') === -1, 'Step 0.55 code never uses NEW_VERSION');
  assert.ok(b055.indexOf('RELEASE_SHA') === -1, 'Step 0.55 does not reuse RELEASE_SHA');
  const arm = b055.slice(b055.indexOf('10|11)'));
  const armEnd = arm.indexOf(';;');
  assert.ok(b055.indexOf('10|11)') !== -1 && armEnd !== -1);
  assert.ok(/\bexit 1\b/.test(arm.slice(0, armEnd)), 'exit 1 inside the 10|11 arm');
  const exitsElsewhere = nonComment(b055.slice(0, b055.indexOf('10|11)')) + '\n' + arm.slice(armEnd)).filter(function (l) { return /\bexit\b/.test(l); });
  assert.deepEqual(exitsElsewhere, [], 'no exit outside the 10|11 arm');
  ok('Step 0.55: repo-version.cjs + rev-parse HEAD + `release-cut-listener.cjs" theo`, exit 1 only inside the 10|11 arm');

  // Review WR-03: no Step 0.55 output line may claim the stamp gate guards
  // unconditionally; the claim lives only in the NO_THEO_CHECK=0 branch of
  // CUT_LISTENER_GATE_NOTE, and every fail-open echo uses that note.
  const code055 = nonComment(b055);
  const guardLines = code055.filter(function (l) { return /stamp gate still guards/.test(l); });
  assert.deepEqual(guardLines.map(function (l) { return l.trim(); }),
    ['CUT_LISTENER_GATE_NOTE="the Step 0.6 stamp gate still guards this cut"'],
    'the only unconditional-looking guard claim is the NO_THEO_CHECK=0 note: ' + JSON.stringify(guardLines));
  assert.ok(/if \[ "\$NO_THEO_CHECK" = "1" \]; then\n\s*CUT_LISTENER_GATE_NOTE="[^"]*ALSO opted out \(--no-theo-check\): nothing guards Theo freshness/.test(b055),
    'NO_THEO_CHECK=1 picks the "ALSO opted out ... nothing guards" note');
  const yellowEchoes = code055.filter(function (l) { return /echo -e "\$\{YELLOW\}  ! /.test(l); });
  assert.equal(yellowEchoes.length, 3, 'three fail-open / opt-out echoes: ' + JSON.stringify(yellowEchoes));
  yellowEchoes.forEach(function (l) { assert.ok(l.indexOf('$CUT_LISTENER_GATE_NOTE') !== -1, 'echo uses the branched note: ' + l); });
  ok('WR-03: Step 0.55 gate wording branches on NO_THEO_CHECK; every fail-open echo uses $CUT_LISTENER_GATE_NOTE');

  const i96b = headerIdx('# --- Step 9.6b');
  const i96c = headerIdx('# --- Step 9.6c');
  const i97 = headerIdx('# --- Step 9.7');
  assert.ok(i96b !== -1 && i96c !== -1 && i97 !== -1);
  assert.ok(i96b < i96c && i96c < i97, 'Step 9.6c sits after Step 9.6b and before Step 9.7');
  ok('Step 9.6c header sits after Step 9.6b and before Step 9.7');

  const b96c = blockOf('# --- Step 9.6c');
  assert.ok(b96c.indexOf('release-cut-listener.cjs" website') !== -1, 'website call site');
  assert.ok(b96c.indexOf('$NEW_VERSION') !== -1, 'website leg is checked against $NEW_VERSION');
  const exits = nonComment(b96c).filter(function (l) { return /\bexit\b/.test(l); });
  assert.deepEqual(exits, [], 'Step 9.6c has zero non-comment lines matching \\bexit\\b: ' + JSON.stringify(exits));
  assert.ok(b96c.indexOf('plugin.json') === -1 && b96c.indexOf('repo-version.cjs') === -1, 'Step 9.6c reads neither plugin.json nor repo-version.cjs');
  assert.ok(/NO_CUT_LISTENER/.test(b96c), 'Step 9.6c honors --no-cut-listener');
  ok('Step 9.6c: website leg at $NEW_VERSION, no non-comment exit, no version re-read, honors --no-cut-listener');

  assert.equal(headerIdx('# --- Step 5.6'), -1, 'the Step 5.6 block was retired by quick 261002-byh');
  assert.equal(src.indexOf('mos_theo_notify_gate'), -1, 'nothing calls the retired notify gate');
  ok('no Step 5.6 block and no mos_theo_notify_gate call (retired by quick 261002-byh)');
}

// ---------------------------------------------------------------------------
// LIVE hermetic dry-runs
// ---------------------------------------------------------------------------
const doctorSrc = fs.readFileSync(DOCTOR_CJS, 'utf8');
const arrayMatch = doctorSrc.match(/const expectedSteps = \[([^\]]*)\]/);
assert.ok(arrayMatch, 'scripts/doctor.cjs must define an expectedSteps array literal');
const expectedSteps = JSON.parse('[' + arrayMatch[1].replace(/'/g, '"') + ']');

// Review WR-06: the read-only proof is scoped to the files a release cut
// writes in this repo, never the whole tree. Two other sessions edit and
// stage files in this shared tree during the several-second dry-run window, so
// a whole-repo `git status --porcelain` comparison flaked red with nothing to
// do with release.sh. RELEASE_OWNED is every plugin-repo path release.sh
// writes or stages (Step 3 / 7 / 7.5 plugin.json, package.json, CHANGELOG.md;
// Step 4 / 7 marketplace.json; Step 6.7 npm-shrinkwrap.json and the lockfile
// `npm shrinkwrap` consumes); a static assert below keeps it in step with the
// `git add` lines in release.sh.
const RELEASE_OWNED = [
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'package.json',
  'CHANGELOG.md',
  'npm-shrinkwrap.json',
  'package-lock.json',
];

function releaseOwnedSnapshot() {
  const crypto = require('node:crypto');
  const files = RELEASE_OWNED.map(function (rel) {
    const p = path.join(REPO, rel);
    const h = fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : 'ABSENT';
    return rel + ' ' + h;
  });
  const r = cp.spawnSync('git', ['status', '--porcelain', '--'].concat(RELEASE_OWNED), { encoding: 'utf8', cwd: REPO });
  return files.join('\n') + '\n--- git status --porcelain (scoped) ---\n' + (r.stdout || '');
}

{
  const added = [];
  src.split('\n').forEach(function (l) {
    const m = /^\s*git add (.+)$/.exec(l);
    if (m) m[1].trim().split(/\s+/).forEach(function (t) { added.push(t); });
  });
  assert.ok(added.length > 0, 'release.sh has git add lines');
  // Paths staged in OTHER repos (minisite, website) do not exist here.
  const pluginAdded = added.filter(function (t) { return fs.existsSync(path.join(REPO, t)); });
  const uncovered = pluginAdded.filter(function (t) { return RELEASE_OWNED.indexOf(t) === -1; });
  assert.deepEqual(uncovered, [], 'every plugin-repo path release.sh stages is in RELEASE_OWNED: ' + JSON.stringify(uncovered));
  ok('WR-06: the read-only snapshot covers every plugin-repo path release.sh stages (' + pluginAdded.filter(function (t, i, a) { return a.indexOf(t) === i; }).join(', ') + ')');
}

function makeTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-cutl-wiring-'));
  const theoDir = path.join(dir, 'Theo');
  const venvBin = path.join(theoDir, '.theo-graph', '.venv', 'bin');
  fs.mkdirSync(venvBin, { recursive: true });
  const theoSentinel = path.join(dir, 'theo-spawned-sentinel');
  fs.writeFileSync(path.join(theoDir, '.theo-graph', 'release_sync.py'), '# fake release_sync.py, never run\n');
  const py = path.join(venvBin, 'python3');
  fs.writeFileSync(py, '#!/bin/sh\ntouch "' + theoSentinel + '"\nexit 0\n');
  fs.chmodSync(py, 0o755);
  const home = path.join(dir, 'home');
  fs.mkdirSync(home);
  const reports = path.join(dir, 'reports');
  fs.mkdirSync(reports);
  return {
    dir: dir, theoDir: theoDir, theoSentinel: theoSentinel, home: home, reports: reports,
    notifySentinel: path.join(dir, 'dispatch-sentinel'),
    notifyLog: path.join(dir, 'theo-notify-log.txt'),
  };
}

function runDryRun(tmp, extraArgs, theoDirOverride) {
  const env = Object.assign({}, process.env);
  env.HOME = tmp.home;
  env.MINDRIAN_THEO_STAMP_CMD = "printf ''";
  env.MINDRIAN_THEO_NOTIFY_CMD = 'touch "' + tmp.notifySentinel + '"; exit 0';
  env.MINDRIAN_THEO_NOTIFY_LOG = tmp.notifyLog;
  env.MINDRIAN_CUT_LISTENER_REPORT_DIR = tmp.reports;
  env.THEO_DIR = theoDirOverride || tmp.theoDir;
  delete env.THEO_PYTHON;
  const args = [RELEASE_SH, 'patch', '--dry-run'].concat(extraArgs || []);
  const r = cp.spawnSync('bash', args, { encoding: 'utf8', timeout: 60000, env: env, cwd: REPO });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

let tmp;
try {
  tmp = makeTmp();

  const before = releaseOwnedSnapshot();
  const r1 = runDryRun(tmp, []);
  const after = releaseOwnedSnapshot();
  assert.equal(r1.status, 0, 'release.sh patch --dry-run must exit 0: ' + r1.stderr.slice(-800));
  ok('dry-run exits 0');

  assert.ok(r1.stdout.indexOf('Step 0.55') !== -1 && r1.stdout.indexOf('Step 9.6c') !== -1, 'stdout lists Step 0.55 and Step 9.6c');
  assert.ok(r1.stdout.indexOf('release_sync.py') !== -1, 'stdout prints the release_sync.py call');
  assert.ok(/--ref [0-9a-f]{40}\b/.test(r1.stdout), 'the printed call carries --ref <40 hex>');
  ok('dry-run stdout lists Step 0.55 + Step 9.6c and prints the release_sync.py call with --ref <40 hex>');

  const missing = expectedSteps.filter(function (s) { return r1.stdout.indexOf(s) === -1; });
  assert.deepEqual(missing, [], 'every doctor.cjs expectedSteps member must appear in dry-run stdout, missing: ' + missing.join(', '));
  ok('every member of the extracted doctor.cjs expectedSteps array appears in the dry-run stdout');

  assert.equal(fs.existsSync(tmp.theoSentinel), false, 'the Theo python stub must never run under --dry-run');
  assert.equal(fs.existsSync(tmp.notifySentinel), false, 'the notify command must never run under --dry-run');
  assert.deepEqual(fs.readdirSync(tmp.reports), [], 'no listener report under --dry-run');
  ok('dry-run spawns no Theo process, fires no notify, writes no report');

  assert.equal(after, before, 'release-owned files and their scoped git status byte-identical before and after');
  ok('WR-06: every release-owned file (sha256) and its scoped git status byte-identical before and after the dry-run');

  const absent = path.join(tmp.dir, 'no-such-theo');
  const r2 = runDryRun(tmp, [], absent);
  assert.equal(r2.status, 0, 'dry-run with Theo absent still exits 0: ' + r2.stderr.slice(-500));
  assert.ok(r2.stdout.indexOf('SKIPPED') !== -1 && r2.stdout.indexOf(absent) !== -1, 'loud SKIPPED naming the absent path');
  assert.ok(r2.stdout.indexOf('the Step 0.6 stamp gate still guards this cut') !== -1, 'without --no-theo-check the fail-open line says the stamp gate still guards');
  ok('Theo absent -> exit 0, loud SKIPPED naming the path, "the Step 0.6 stamp gate still guards this cut"');

  // Review WR-03: with --no-theo-check the same path must never claim a guard.
  const r2b = runDryRun(tmp, ['--no-theo-check'], absent);
  assert.equal(r2b.status, 0, 'dry-run with --no-theo-check and Theo absent exits 0: ' + r2b.stderr.slice(-500));
  assert.ok(r2b.stdout.indexOf(absent) !== -1, 'still a loud SKIPPED naming the path');
  assert.equal(r2b.stdout.indexOf('stamp gate still guards'), -1, 'no "stamp gate still guards" claim under --no-theo-check');
  assert.ok(r2b.stdout.indexOf('ALSO opted out (--no-theo-check): nothing guards Theo freshness') !== -1, 'says nothing guards Theo freshness');
  ok('WR-03: --no-theo-check + Theo absent -> "ALSO opted out (--no-theo-check): nothing guards Theo freshness", no guard claim');

  const r3 = runDryRun(tmp, ['--no-cut-listener']);
  assert.equal(r3.status, 0, '--no-cut-listener dry-run exits 0');
  assert.ok(r3.stdout.indexOf('--no-cut-listener opt-out engaged') !== -1, 'audited opt-out line');
  assert.equal(r3.stdout.indexOf('release_sync.py'), -1, 'no release_sync.py call under --no-cut-listener');
  assert.equal(fs.existsSync(tmp.theoSentinel), false);
  ok('--no-cut-listener -> exit 0, "--no-cut-listener opt-out engaged" printed, no release_sync.py call');

  // Review IN-03: the dry-run listing's opt-out line renders its colors
  // (echo -e) instead of printing a literal backslash-033 escape.
  const listing = r3.stdout.split('\n').filter(function (l) { return l.indexOf('--no-cut-listener opt-out engaged (audit-logged; Theo sync not proposed') !== -1; });
  assert.equal(listing.length, 1, 'one dry-run listing opt-out line: ' + JSON.stringify(listing));
  assert.equal(listing[0].indexOf('\\033['), -1, 'no literal \\033[ escape in the listing line: ' + JSON.stringify(listing[0]));
  ok('IN-03: the dry-run --no-cut-listener listing line prints no literal \\033[ escape');
} finally {
  if (tmp && tmp.dir) fs.rmSync(tmp.dir, { recursive: true, force: true });
}

console.log(checks + ' checks passed.');
process.exit(0);
