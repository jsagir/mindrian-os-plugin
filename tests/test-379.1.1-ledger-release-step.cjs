#!/usr/bin/env node
'use strict';
/*
 * Phase 379.1.1 plan 02 (work item 3, CLOSE379-03): the section-command ledger rebuild is a
 * named release.sh step (Step 2.3), backed by scripts/release-lib/ledger-rebuild.sh.
 *
 * WHY THIS TEST EXISTS. In the beta.73 cut the Jev-scored ledger rebuild was a surprise manual
 * step. The step now runs the offline check, rebuilds only when the ledger is stale, and leaves
 * the tree as it was on every failure path.
 *
 * Scenarios (hermetic: a temp HOME, a temp git repo per scenario, a STUB builder, no network):
 *   S1  ledger current                 returns 0, says current, no build call, no commit
 *   S2  stale, key absent              returns 1, names the recovery, no build call, tree unchanged
 *   S3  stale, key present             one commit, only the ledger, says HEAD moved and names Step 2.6
 *   S4  dry run, stale                 returns 0, [DRY RUN] line, no build call, no commit
 *   S5  --no-ledger-check              returns 0, names the flag and the consequence, no builder call
 *   S6  build exits non-zero           returns 1, ledger bytes restored, HEAD unchanged
 *   S7  rebuilt ledger fails re-check  returns 1, ledger bytes restored, HEAD unchanged
 *   S8  ledger file dirty              returns 1, names the file, no build call, change kept
 *   ST  static                         no key literal, no vendor URL, one non-check builder call
 *   W*  wiring in scripts/release.sh   (added with Task 2)
 *
 * The stub never touches the network and never reads or prints a key. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const LIB = path.join(ROOT, 'scripts', 'release-lib', 'ledger-rebuild.sh');
const RELEASE_SH = path.join(ROOT, 'scripts', 'release.sh');
const LEDGER_REL = 'data/section-command-ledger.json';
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
function arm(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
  }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }

const TMP = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMP) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test Author',
  GIT_AUTHOR_EMAIL: 'author@example.invalid',
  GIT_COMMITTER_NAME: 'Test Author',
  GIT_COMMITTER_EMAIL: 'author@example.invalid',
};

function git(dir, args, env) {
  return cp.spawnSync('git', ['-C', dir].concat(args), {
    encoding: 'utf8',
    env: Object.assign({}, process.env, GIT_ENV, env || {}),
  });
}

// The stub builder. Control files live in the state dir (outside the repo, so they never
// dirty the tree): current (check passes), nokey, build_exit, postfail.
const STUB = [
  "'use strict';",
  "const fs = require('node:fs');",
  "const path = require('node:path');",
  "const state = process.env.STUB_STATE;",
  "const ledger = path.join(__dirname, '..', 'data', 'section-command-ledger.json');",
  "const has = (n) => fs.existsSync(path.join(state, n));",
  "const log = (s) => fs.appendFileSync(path.join(state, 'calls.log'), s + '\\n');",
  "const argv = process.argv.slice(2);",
  "if (argv.includes('--check')) {",
  "  log('check');",
  "  const body = fs.readFileSync(ledger, 'utf8');",
  "  if (has('current') || (body.includes('\"rebuilt\": true') && !has('postfail'))) {",
  "    console.log('section-command-ledger: OK (stub)');",
  "    process.exit(0);",
  "  }",
  "  console.error('section-command-ledger: FAILED (plugin_version drift: ledger=1.0.0 repo=2.0.0)');",
  "  process.exit(1);",
  "}",
  "if (argv.includes('--key-status')) {",
  "  log('key-status');",
  "  if (has('nokey')) { console.log('key: absent'); process.exit(3); }",
  "  console.log('key: present');",
  "  process.exit(0);",
  "}",
  "log('build');",
  "if (has('build_exit')) {",
  "  fs.writeFileSync(ledger, '{ \"partial\": true ');",
  "  process.exit(parseInt(fs.readFileSync(path.join(state, 'build_exit'), 'utf8'), 10) || 1);",
  "}",
  "fs.writeFileSync(ledger, JSON.stringify({ jev_model: 'jev-stub', theo_frameworks: 7, rebuilt: true, rows: { 'a|b|c': [], 'd|e|f': [] } }, null, 2) + '\\n');",
  "process.exit(0);",
  '',
].join('\n');

const VERSION_STUB = "console.log('9.9.9-test');\n";

function makeScenario(opts) {
  const o = Object.assign({ current: false, nokey: false, buildExit: null, postfail: false, dirty: false }, opts || {});
  const dir = mkTmp('t3791102-repo-');
  const home = mkTmp('t3791102-home-');
  const state = mkTmp('t3791102-state-');
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'lib', 'core'), { recursive: true });
  fs.writeFileSync(path.join(dir, LEDGER_REL), JSON.stringify({ jev_model: 'old', theo_frameworks: 1, rows: {} }, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'scripts', 'build-section-command-ledger.cjs'), STUB);
  fs.writeFileSync(path.join(dir, 'lib', 'core', 'repo-version.cjs'), VERSION_STUB);
  let r = git(dir, ['init', '-q', '-b', 'main']);
  check(r.status === 0, 'git init failed: ' + r.stderr);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['add', '-A']);
  r = git(dir, ['commit', '-q', '-m', 'initial']);
  check(r.status === 0, 'initial commit failed: ' + r.stderr);
  if (o.current) fs.writeFileSync(path.join(state, 'current'), '');
  if (o.nokey) fs.writeFileSync(path.join(state, 'nokey'), '');
  if (o.buildExit !== null) fs.writeFileSync(path.join(state, 'build_exit'), String(o.buildExit));
  if (o.postfail) fs.writeFileSync(path.join(state, 'postfail'), '');
  if (o.dirty) fs.writeFileSync(path.join(dir, LEDGER_REL), '{ "uncommitted": true }\n');
  return { dir, home, state };
}

function run(sc, dryRun, noCheck, errexit) {
  // errexit mimics scripts/release.sh, which runs under set -euo pipefail and calls the step bare.
  const script = errexit
    ? 'set -euo pipefail; . "$1"; mos_ledger_rebuild_step "$2" "$3" "$4"; echo "RC=0"'
    : '. "$1"; mos_ledger_rebuild_step "$2" "$3" "$4"; echo "RC=$?"';
  const r = cp.spawnSync('bash', ['-c', script, 'x', LIB, sc.dir, String(dryRun || 0), String(noCheck || 0)], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, GIT_ENV, { HOME: sc.home, USERPROFILE: sc.home, STUB_STATE: sc.state }),
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = /RC=(\d+)\s*$/.exec(r.stdout || '');
  return { out, rc: m ? parseInt(m[1], 10) : null, raw: r };
}

function calls(sc) {
  try { return fs.readFileSync(path.join(sc.state, 'calls.log'), 'utf8').split('\n').filter(Boolean); } catch (_e) { return []; }
}
function head(sc) { return git(sc.dir, ['rev-parse', 'HEAD']).stdout.trim(); }
function ledgerBytes(sc) { return fs.readFileSync(path.join(sc.dir, LEDGER_REL), 'utf8'); }
function commitCount(sc) { return parseInt(git(sc.dir, ['rev-list', '--count', 'HEAD']).stdout.trim(), 10); }

// ---------------------------------------------------------------------------
// The library must exist before any scenario can run.
// ---------------------------------------------------------------------------
arm('L0 scripts/release-lib/ledger-rebuild.sh exists', () => {
  check(fs.existsSync(LIB), 'missing ' + LIB);
});

if (fs.existsSync(LIB)) {
  arm('S1 ledger current: returns 0, says current, no build call, no commit', () => {
    const sc = makeScenario({ current: true });
    const h0 = head(sc);
    const r = run(sc);
    check(r.rc === 0, 'rc ' + r.rc + '\n' + r.out);
    check(/current/i.test(r.out), 'output does not say current:\n' + r.out);
    check(!calls(sc).includes('build'), 'a build call was recorded');
    check(head(sc) === h0, 'HEAD moved');
  });

  arm('S2 stale, key absent: returns 1, names the recovery, tree unchanged', () => {
    const sc = makeScenario({ nokey: true });
    const h0 = head(sc);
    const b0 = ledgerBytes(sc);
    const r = run(sc);
    check(r.rc === 1, 'rc ' + r.rc + '\n' + r.out);
    check(r.out.includes('typesafe.env'), 'recovery does not name the dev key file:\n' + r.out);
    check(r.out.includes('--no-ledger-check'), 'recovery does not name --no-ledger-check');
    check(r.out.includes('--offline-seed'), 'recovery does not name --offline-seed');
    check(!calls(sc).includes('build'), 'a build call was recorded');
    check(ledgerBytes(sc) === b0, 'ledger changed');
    check(head(sc) === h0, 'HEAD moved');
  });

  arm('S3 stale, key present: one commit, only the ledger, HEAD moved, Step 2.6 named', () => {
    const sc = makeScenario();
    const n0 = commitCount(sc);
    const r = run(sc);
    check(r.rc === 0, 'rc ' + r.rc + '\n' + r.out);
    check(calls(sc).filter((c) => c === 'build').length === 1, 'expected exactly one build call: ' + calls(sc).join(','));
    check(commitCount(sc) === n0 + 1, 'expected one new commit');
    const subject = git(sc.dir, ['log', '-1', '--format=%s']).stdout.trim();
    check(subject.startsWith('chore(release): Jev-scored rebuild of the section-command ledger for'), 'subject: ' + subject);
    check(subject.includes('9.9.9-test'), 'subject lacks the version: ' + subject);
    check(subject.includes('jev-stub') && subject.includes('7 Theo frameworks') && subject.includes('2 rows'), 'subject lacks model, frameworks or rows: ' + subject);
    const files = git(sc.dir, ['show', '--name-only', '--format=', 'HEAD']).stdout.trim().split('\n').filter(Boolean);
    check(files.length === 1 && files[0] === LEDGER_REL, 'commit files: ' + files.join(','));
    check(/HEAD moved/.test(r.out) && r.out.includes('Step 2.6'), 'output lacks HEAD moved or Step 2.6:\n' + r.out);
  });

  arm('S4 dry run, stale: returns 0, [DRY RUN] line, no build call, no commit', () => {
    const sc = makeScenario();
    const h0 = head(sc);
    const b0 = ledgerBytes(sc);
    const r = run(sc, 1, 0);
    check(r.rc === 0, 'rc ' + r.rc + '\n' + r.out);
    const line = r.out.split('\n').find((l) => l.includes('[DRY RUN]')) || '';
    check(line && /would rebuild/.test(line), 'no [DRY RUN] would-rebuild line:\n' + r.out);
    check(!calls(sc).includes('build'), 'a build call was recorded');
    check(!calls(sc).includes('key-status'), 'dry run asked for the key status');
    check(ledgerBytes(sc) === b0 && head(sc) === h0, 'tree changed');
  });

  arm('S5 --no-ledger-check: returns 0, names the flag and the consequence, no builder call', () => {
    const sc = makeScenario();
    const r = run(sc, 0, 1);
    check(r.rc === 0, 'rc ' + r.rc + '\n' + r.out);
    const lines = r.out.split('\n').filter((l) => l.includes('--no-ledger-check'));
    check(lines.length === 1, 'expected one line naming --no-ledger-check, got ' + lines.length);
    check(/stale ledger ships/.test(lines[0]), 'line lacks the consequence: ' + lines[0]);
    check(calls(sc).length === 0, 'the builder was called: ' + calls(sc).join(','));
  });

  arm('S6 build exits non-zero: returns 1, ledger bytes restored, HEAD unchanged', () => {
    const sc = makeScenario({ buildExit: 4 });
    const h0 = head(sc);
    const b0 = ledgerBytes(sc);
    const r = run(sc);
    check(r.rc === 1, 'rc ' + r.rc + '\n' + r.out);
    check(calls(sc).includes('build'), 'the build was not attempted');
    check(ledgerBytes(sc) === b0, 'ledger not restored: ' + ledgerBytes(sc));
    check(head(sc) === h0, 'HEAD moved');
    check(git(sc.dir, ['status', '--porcelain', '--', LEDGER_REL]).stdout.trim() === '', 'ledger is dirty');
  });

  arm('S7 rebuilt ledger fails the re-check: returns 1, ledger bytes restored, HEAD unchanged', () => {
    const sc = makeScenario({ postfail: true });
    const h0 = head(sc);
    const b0 = ledgerBytes(sc);
    const r = run(sc);
    check(r.rc === 1, 'rc ' + r.rc + '\n' + r.out);
    check(calls(sc).filter((c) => c === 'check').length === 2, 'expected two check calls: ' + calls(sc).join(','));
    check(ledgerBytes(sc) === b0, 'ledger not restored');
    check(head(sc) === h0, 'HEAD moved');
  });

  arm('S9 under a set -euo pipefail caller: a stale dry run and a full rebuild both return 0 and reach the next line', () => {
    const a = makeScenario();
    const ra = run(a, 1, 0, true);
    check(ra.rc === 0 && /\[DRY RUN\]/.test(ra.out), 'stale dry run under set -e: rc ' + ra.rc + '\n' + ra.out);
    const b = makeScenario();
    const n0 = commitCount(b);
    const rb = run(b, 0, 0, true);
    check(rb.rc === 0 && commitCount(b) === n0 + 1, 'full rebuild under set -e: rc ' + rb.rc + '\n' + rb.out);
  });

  arm('S8 ledger file dirty: returns 1, names the file, no build call, change kept', () => {
    const sc = makeScenario({ dirty: true });
    const h0 = head(sc);
    const r = run(sc);
    check(r.rc === 1, 'rc ' + r.rc + '\n' + r.out);
    check(r.out.includes(LEDGER_REL), 'output does not name the file:\n' + r.out);
    check(!calls(sc).includes('build'), 'a build call was recorded');
    check(ledgerBytes(sc) === '{ "uncommitted": true }\n', 'the uncommitted change was lost');
    check(head(sc) === h0, 'HEAD moved');
  });
}

// ---------------------------------------------------------------------------
// Static checks.
// ---------------------------------------------------------------------------
function builderCallLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n')
    .filter((l) => /build-section-command-ledger\.cjs/.test(l))
    .filter((l) => !/^\s*#/.test(l) && !/^\s*echo\b/.test(l));
}

arm('ST1 the library holds no key literal and no vendor URL', () => {
  check(fs.existsSync(LIB), 'missing library');
  const src = fs.readFileSync(LIB, 'utf8');
  check(!/TYPESAFE_API_KEY/.test(src), 'key name literal in the library');
  check(!/api\.typesafe\.ai/.test(src), 'vendor URL in the library');
});

arm('ST2 exactly one non-check, non-key-status builder call exists, in ledger-rebuild.sh', () => {
  const libDir = path.join(ROOT, 'scripts', 'release-lib');
  const files = [RELEASE_SH].concat(fs.readdirSync(libDir).filter((f) => f.endsWith('.sh')).map((f) => path.join(libDir, f)));
  const hits = [];
  for (const f of files) {
    for (const l of builderCallLines(f)) {
      if (!/--check/.test(l) && !/--key-status/.test(l)) hits.push(path.basename(f) + ': ' + l.trim());
    }
  }
  check(hits.length === 1, 'expected 1 rebuild call site, got ' + hits.length + ': ' + hits.join(' | '));
  check(hits[0].startsWith('ledger-rebuild.sh:'), 'the rebuild call is not in ledger-rebuild.sh: ' + hits[0]);
});

arm('ST3 bash -n passes on the library', () => {
  const r = cp.spawnSync('bash', ['-n', LIB], { encoding: 'utf8' });
  check(r.status === 0, 'bash -n failed: ' + r.stderr);
});

arm('ST4 no em-dash and no en-dash in the library or this test', () => {
  for (const f of [LIB, __filename]) {
    if (!fs.existsSync(f)) continue;
    const s = fs.readFileSync(f, 'utf8');
    check(!s.includes(EM) && !s.includes(EN), 'dash in ' + f);
  }
});

// ---------------------------------------------------------------------------
// Wiring legs: scripts/release.sh carries Step 2.3, --ledger-only and the dry-run line.
// ---------------------------------------------------------------------------
const rsrc = fs.existsSync(RELEASE_SH) ? fs.readFileSync(RELEASE_SH, 'utf8') : '';
const CALL = 'mos_ledger_rebuild_step "$PLUGIN_DIR"';

arm('W1 the preamble sources ledger-rebuild.sh behind a missing-library guard, before Step 0', () => {
  const guard = rsrc.indexOf('scripts/release-lib/ledger-rebuild.sh missing');
  const source = rsrc.indexOf('. "$RELEASE_LIB_DIR/ledger-rebuild.sh"');
  const step0 = rsrc.indexOf('# --- Step 0: Parse bump type');
  check(guard !== -1 && source !== -1, 'guard or source line missing');
  check(guard < source, 'the guard must come before the source line');
  check(source < step0, 'the source line must come before Step 0');
  const after = rsrc.slice(guard, source);
  check(/exit 1/.test(after), 'the guard does not exit 1');
});

arm('W2 USAGE_BLOCK and the case list carry --ledger-only', () => {
  const usage = (rsrc.match(/USAGE_BLOCK="[^"]*"/) || [''])[0];
  check(usage.includes('--ledger-only'), 'USAGE_BLOCK lacks --ledger-only');
  check(/--ledger-only\)\s*LEDGER_ONLY=1/.test(rsrc), 'case arm lacks --ledger-only');
  check(/\nLEDGER_ONLY=0/.test(rsrc), 'LEDGER_ONLY default missing');
});

arm('W3 the Step 2.3 call sits after the Step 2 verify block and before the Step 2.4 header', () => {
  const verified = rsrc.indexOf('All verification checks passed');
  const header = rsrc.indexOf('# --- Step 2.3:');
  const step24 = rsrc.indexOf('# --- Step 2.4: coverage gates');
  const call = rsrc.lastIndexOf(CALL + ' "$DRY_RUN" "$NO_LEDGER_CHECK"');
  check(verified !== -1 && header !== -1 && step24 !== -1 && call !== -1, 'a marker is missing');
  check(verified < header && header < call && call < step24, 'order wrong: ' + [verified, header, call, step24].join(' '));
  const block = rsrc.slice(call, step24);
  check(/ABORT/.test(block) && /exit 1/.test(block), 'the call is not followed by an ABORT and exit 1');
});

arm('W4 the dry-run listing holds the Step 2.3 line and calls the step with DRY_RUN 1', () => {
  const line = rsrc.indexOf('  Step 2.3  : section-command ledger rebuild');
  const call = rsrc.indexOf(CALL + ' 1 "$NO_LEDGER_CHECK"');
  const exitIdx = rsrc.indexOf('=== DRY-RUN COMPLETE');
  const step2 = rsrc.indexOf('  Step 2    : run scripts/verify-release');
  const firstStep24 = rsrc.indexOf('  Step 2.4  :');
  check(line !== -1 && call !== -1, 'dry-run line or call missing');
  check(step2 < line && line < call && call < firstStep24 && call < exitIdx, 'dry-run order wrong');
  const lineText = rsrc.slice(line, rsrc.indexOf('\n', line));
  for (const w of ['offline check first', 'dev key', 'data/section-command-ledger.json', 'Step 2.6', '--ledger-only']) {
    check(lineText.includes(w), 'dry-run line lacks "' + w + '"');
  }
});

arm('W5 the ledger-only mode sits after Step 0.5 and before Step 0.55, and exits with the step code', () => {
  const s05 = rsrc.indexOf('# --- Step 0.5: semver preflight');
  const s055 = rsrc.indexOf('# --- Step 0.55:');
  const mode = rsrc.indexOf('if [ "$LEDGER_ONLY" = "1" ]; then', s05);
  check(s05 !== -1 && mode > s05 && mode < s055, 'standalone mode is not between Step 0.5 and Step 0.55');
  const block = rsrc.slice(mode, s055);
  check(block.includes(CALL) && /exit "?\$/.test(block), 'standalone mode does not call the step and exit with its code');
});

arm('W6 a bump flag together with --ledger-only prints the usage and exits 1', () => {
  const r = cp.spawnSync('bash', [RELEASE_SH, '--prerelease', '--ledger-only', '--dry-run'], { encoding: 'utf8', cwd: ROOT, timeout: 60000 });
  check(r.status === 1, 'exit ' + r.status + '\n' + r.stdout + r.stderr);
  check(/Usage:/.test(r.stdout + r.stderr), 'no usage text');
  check(!/unknown arg/.test(r.stdout + r.stderr), 'the flag was rejected as unknown, not as a bad combination');
  check(/--ledger-only/.test(r.stdout + r.stderr) && /cannot be combined|alone/.test(r.stdout + r.stderr), 'no message that --ledger-only stands alone');
});

function porcelain() {
  return git(ROOT, ['status', '--porcelain']).stdout;
}

arm('W7 --ledger-only --dry-run exits 0, prints only the ledger step, changes nothing', () => {
  const before = porcelain();
  const r = cp.spawnSync('bash', [RELEASE_SH, '--ledger-only', '--dry-run'], { encoding: 'utf8', cwd: ROOT, timeout: 120000 });
  const out = (r.stdout || '') + (r.stderr || '');
  check(r.status === 0, 'exit ' + r.status + '\n' + out);
  check(/\[DRY RUN\] ledger-rebuild:/.test(out), 'no [DRY RUN] ledger verdict:\n' + out);
  check(!/Step 0\.55|Step 0\.6|Planned release sequence/.test(out), 'other steps ran:\n' + out);
  check(porcelain() === before, 'git status changed');
});

arm('W8 the full cut --dry-run exits 0, prints the Step 2.3 line and a [DRY RUN] ledger verdict, changes nothing', () => {
  const before = porcelain();
  const flags = ['--prerelease', '--dry-run', '--no-cut-listener', '--no-theo-check', '--no-canon-snapshot-check', '--no-suite-check'];
  const r = cp.spawnSync('bash', [RELEASE_SH].concat(flags), { encoding: 'utf8', cwd: ROOT, timeout: 240000 });
  const out = (r.stdout || '') + (r.stderr || '');
  check(r.status === 0, 'exit ' + r.status + '\n' + out.slice(-1500));
  check(/Step 2\.3\s+: section-command ledger rebuild/.test(out), 'no Step 2.3 line');
  check(/\[DRY RUN\] ledger-rebuild:/.test(out), 'no [DRY RUN] ledger verdict');
  check(porcelain() === before, 'git status changed');
});

console.log('');
console.log('PASS=' + passed + ' FAIL=' + failed);
process.exit(failed === 0 ? 0 : 1);
