#!/usr/bin/env node
'use strict';
/**
 * tests/test-380-gate-wiring.cjs  (Phase 380, plan 09, D-06 / MOD380-02 / MOD380-06)
 *
 * Static proof that the face panel rides the release gate and that RULE 10 says what it covers:
 *   W1 tests/run-all-366.sh holds one hard run line (not run_if) for tests/run-all-380.sh, with a
 *      comment that names Phase 380 and says a missing or red leg fails the cut.
 *   W2 tests/run-all-380.sh runs the engine-test wrapper with run_strict (a missing claude is a FAIL).
 *   W3 RULE 10 holds a bullet named The face panel (real-room run never draws the panel; what stands in
 *      its place; the Desktop observation the signer records).
 *   W4 CHANGELOG.md holds an Unreleased line for the panel, with Theo as the only name in it.
 *   W5 the Desktop payload gate (build-desktop-artifact.cjs --check) exits 0 with the dist in the payload.
 *   W6 the recorded pre-plan sha is a real commit and an ancestor of HEAD (skipped when the planning
 *      file is not on this machine; the file lives in the planning tree, not in the repo).
 *   W7 tests/run-all-380.sh runs the installed-layout test with run_strict_if and holds the line
 *      "environment gap blocks the cut".
 *   W8 the environment-gap result exists: with only node on PATH the layout test exits 77 within 10 s,
 *      and the aggregator function maps exit 77 to FAILED.
 *
 * Exit codes: 0 all pass; 1 any fail; 77 only when npm is missing (W5 needs it).
 * Hermetic: scratch folders only. Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;
let skipped = 0;

const DASH = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');
const say = (l) => process.stdout.write(l + '\n');
const check = (cond, name, detail) => {
  if (cond) { passed += 1; say('  PASS ' + name); } else { failed += 1; say('  FAIL ' + name); if (detail) say('    ' + String(detail).split('\n').join('\n    ')); }
};
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

function findOnPath(name) {
  for (const d of String(process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    try { const f = path.join(d, name); if (fs.statSync(f).isFile()) return f; } catch (_) { /* next */ }
  }
  return null;
}

// ---- W1 ------------------------------------------------------------------------------------
say('W1 the release suite gate runs the phase aggregator as a hard leg');
{
  const text = read('tests/run-all-366.sh');
  const lines = text.split('\n');
  const idx = lines.map((l, i) => (l.includes('run-all-380') ? i : -1)).filter((i) => i >= 0);
  check(idx.length === 1, 'run-all-366.sh names run-all-380 on exactly one line (' + idx.length + ')');
  const line = idx.length ? lines[idx[0]] : '';
  check(/^run\s+"[^"]+"\s+bash tests\/run-all-380\.sh\s*$/.test(line), 'that line is a plain hard run (not run_if, not run_known_if)', line);
  const above = idx.length ? lines.slice(Math.max(0, idx[0] - 4), idx[0]).join('\n') : '';
  check(/Phase 380/.test(above) && /fails the cut/.test(above), 'a comment above it names Phase 380 and says a missing or red test fails the cut', above);
  check(/(2h)/.test(above), 'the comment marks the leg as (2h)', above);
}

// ---- W2 and W7 -----------------------------------------------------------------------------
say('W2 and W7 the aggregator is strict where the machine can hide a gap');
{
  const text = read('tests/run-all-380.sh');
  check(/^run_strict\s+"380 engine tests[^"]*"\s+node tests\/test-380-engine-tests\.cjs\s*$/m.test(text), 'W2 the engine tests run with run_strict');
  check(/^run_strict_if\s+"380 installed layout[^"]*"\s+tests\/test-380-installed-layout\.cjs\s+node tests\/test-380-installed-layout\.cjs\s*$/m.test(text), 'W7 the installed-layout test runs with run_strict_if');
  check(/environment gap blocks the cut/.test(text), 'W7 the aggregator holds the line "environment gap blocks the cut"');
  check(/^run_if\s+"380 gate wiring/m.test(text), 'the gate wiring test itself is a leg of the aggregator');
}

// ---- W3 ------------------------------------------------------------------------------------
say('W3 RULE 10 carries the face panel bullet');
{
  const doc = read('docs/RELEASE-CEREMONY-RULING-SYSTEM.md');
  const start = doc.indexOf('## RULE 10');
  const end = doc.indexOf('\n## RULE 11');
  const rule = start >= 0 ? doc.slice(start, end > start ? end : undefined) : '';
  const bullet = rule.split('\n').find((l) => l.startsWith('- **The face panel.**')) || '';
  check(bullet !== '', 'RULE 10 holds a bullet named The face panel');
  const iPanel = rule.indexOf('- **The face panel.**');
  const iLimit = rule.indexOf('- **The limit.**');
  check(iPanel >= 0 && iLimit > iPanel, 'the bullet sits before The limit');
  check(/never draws the panel/.test(bullet), 'it says the real-room run never draws the panel');
  check(/tests\/run-all-380\.sh/.test(bullet) && /release suite gate/.test(bullet), 'it names tests/run-all-380.sh inside the release suite gate');
  check(/screenshots/.test(bullet) && /real terminal/.test(bullet), 'it names the real-terminal screenshots as what stands in its place');
  check(/Desktop copy/.test(bullet) && /record/.test(bullet), 'it tells the person who signs the receipt to record what the panel does on the cut\'s Desktop copy');
  check(!/\d+\.\d+\.\d+/.test(bullet) && !/\b(34|29)\b/.test(bullet) && !/beta/.test(bullet), 'it carries no version and no count that a lockstep test could pin');
  check(!DASH.test(bullet), 'it holds no em-dash or en-dash');
}

// ---- W4 ------------------------------------------------------------------------------------
say('W4 the changelog has the line');
{
  const log = read('CHANGELOG.md');
  const start = log.indexOf('## [Unreleased]');
  const next = log.indexOf('\n## [', start + 5);
  const section = start >= 0 ? log.slice(start, next > start ? next : undefined) : '';
  const line = section.split('\n').find((l) => /face panel/i.test(l)) || '';
  check(line !== '', 'the Unreleased section holds a line about the face panel');
  check(/Claude Code terminal/.test(line), 'it says the panel is for the Claude Code terminal');
  check(/Theo/.test(line) && !/\b(Larry|Brain|MCP|ICM)\b/.test(line), 'Theo is the only name in it');
  check(/framework name/.test(line) && /problem type/.test(line) && /short excerpt/.test(line), 'it says what is sent: the framework name, the problem type and an optional short excerpt');
  check(/\/mos-words/.test(line), 'it says /mos-words turns the excerpt off');
  check(!DASH.test(line), 'it holds no em-dash or en-dash');
}

// ---- W5 ------------------------------------------------------------------------------------
say('W5 the Desktop payload gate passes with the dist in the payload');
if (!findOnPath('npm')) {
  process.stdout.write('SKIPPED (ENV GAP): npm is not on PATH; the Desktop payload gate needs it\n');
  process.exit(77);
}
{
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-380-gate-'));
  try {
    const home = path.join(scratch, 'home');
    fs.mkdirSync(home, { recursive: true });
    const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home, npm_config_cache: path.join(scratch, 'npm-cache'), npm_config_update_notifier: 'false' });
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'release-lib', 'build-desktop-artifact.cjs'), '--check'], { cwd: REPO, env, encoding: 'utf8', timeout: 280000, maxBuffer: 64 * 1024 * 1024 });
    check(r.status === 0, 'build-desktop-artifact.cjs --check exits 0 (got ' + r.status + ')', String(r.stdout || '').slice(-600) + String(r.stderr || '').slice(-600));
    check(fs.existsSync(path.join(REPO, 'lib', 'mos-face', 'dist', 'register.js')), 'the dist is in the tree the gate measured');
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

// ---- W6 ------------------------------------------------------------------------------------
say('W6 the recorded pre-plan sha');
{
  const given = process.env.MOS_380_PRE_SHA_FILE;
  let file = given && fs.existsSync(given) ? given : null;
  if (!file) {
    const phases = path.resolve(REPO, '..', 'MindrianOS-Plugin', '.planning', 'phases');
    try {
      const dir = fs.readdirSync(phases).find((d) => d.startsWith('380-'));
      if (dir && fs.existsSync(path.join(phases, dir, '380-09-PRE-SHA.txt'))) file = path.join(phases, dir, '380-09-PRE-SHA.txt');
    } catch (_) { /* not on this machine */ }
  }
  if (!file) {
    skipped += 1;
    say('  SKIP W6: 380-09-PRE-SHA.txt is not on this machine (it lives in the planning tree)');
  } else {
    const pre = fs.readFileSync(file, 'utf8').trim();
    check(/^[0-9a-f]{40}$/.test(pre), 'the file holds one 40-character id', pre);
    const cat = spawnSync('git', ['-C', REPO, 'cat-file', '-e', pre + '^{commit}'], { encoding: 'utf8' });
    check(cat.status === 0, 'git cat-file -e accepts the id in the release tree');
    const anc = spawnSync('git', ['-C', REPO, 'merge-base', '--is-ancestor', pre, 'HEAD'], { encoding: 'utf8' });
    check(anc.status === 0, 'the id is an ancestor of HEAD');
  }
}

// ---- W8 ------------------------------------------------------------------------------------
say('W8 the environment-gap result exists and the aggregator maps it to FAILED');
{
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-380-gap-'));
  try {
    const bin = path.join(scratch, 'onlynode');
    fs.mkdirSync(bin);
    fs.symlinkSync(process.execPath, path.join(bin, 'node'));
    const t0 = Date.now();
    const r = spawnSync(path.join(bin, 'node'), [path.join(REPO, 'tests', 'test-380-installed-layout.cjs')], {
      cwd: scratch, env: { PATH: bin, HOME: scratch, USERPROFILE: scratch }, encoding: 'utf8', timeout: 30000,
    });
    const secs = (Date.now() - t0) / 1000;
    check(r.status === 77, 'with only node on PATH the layout test exits 77 (got ' + r.status + ')', String(r.stdout || '') + String(r.stderr || ''));
    check(secs < 10, 'it answers within 10 seconds (' + secs.toFixed(1) + ' s)');
    check(/ENV GAP/.test(String(r.stdout || '')) && /npm is not on PATH/.test(String(r.stdout || '')), 'it names the one missing piece');
    check(/blocks the cut/.test(String(r.stdout || '')), 'it says an environment gap blocks the cut');

    // The aggregator function, taken from the real file, run against a stub that exits 77.
    const text = read('tests/run-all-380.sh');
    const m = /^run_strict_if\(\) \{\n[\s\S]*?\n\}\n/m.exec(text);
    check(!!m, 'run_strict_if is defined in the aggregator');
    if (m) {
      const guard = path.join(scratch, 'guard.cjs');
      fs.writeFileSync(guard, '');
      const script = ['PASS=0; FAIL=0; SKIP=0; KNOWN=0', m[0], 'run_strict_if "stub leg" "' + guard + '" bash -c "exit 77"', 'echo "COUNTS PASS=$PASS FAIL=$FAIL SKIP=$SKIP"'].join('\n');
      const b = spawnSync('bash', ['-c', script], { encoding: 'utf8', timeout: 30000 });
      const out = String(b.stdout || '');
      check(/stub leg: FAILED \(environment gap blocks the cut/.test(out), 'exit 77 prints FAILED with the line environment gap blocks the cut', out);
      check(/COUNTS PASS=0 FAIL=1 SKIP=0/.test(out), 'exit 77 counts as one FAILED and no SKIPPED', out);
      const script2 = ['PASS=0; FAIL=0; SKIP=0; KNOWN=0', m[0], 'run_strict_if "stub leg" "' + path.join(scratch, 'missing.cjs') + '" bash -c "exit 77"', 'echo "COUNTS PASS=$PASS FAIL=$FAIL SKIP=$SKIP"'].join('\n');
      const c = spawnSync('bash', ['-c', script2], { encoding: 'utf8', timeout: 30000 });
      check(/COUNTS PASS=0 FAIL=0 SKIP=1/.test(String(c.stdout || '')), 'control: a guard file that does not exist is SKIPPED (the leg has not landed)', c.stdout);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

say('');
say('test-380-gate-wiring: ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
process.exit(failed > 0 ? 1 : 0);
