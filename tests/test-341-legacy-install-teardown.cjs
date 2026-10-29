#!/usr/bin/env node
'use strict';

/*
 * tests/test-341-legacy-install-teardown.cjs -- Phase 341 Plan 07 Task 1.
 *
 * Hermetic proof of scripts/migrate-legacy-install-location.cjs: the refuse,
 * backup, remove, dry-run, already-clean and path-guard arms. Every arm runs
 * against an fs.mkdtempSync tree. HOME and USERPROFILE of this process are
 * pointed at a temp directory first, so nothing here can reach the real
 * ~/.claude. The migrator is also driven through its CLI with the
 * MOS_LEGACY_INSTALL_HOME seam.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MIGRATOR = path.join(REPO, 'scripts', 'migrate-legacy-install-location.cjs');

const SAFE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mos341-07-safe-'));
process.env.HOME = SAFE_ROOT;
process.env.USERPROFILE = SAFE_ROOT;
delete process.env.MINDRIAN_OS_ROOT;
delete process.env.MOS_LEGACY_INSTALL_HOME;

const m = require(MIGRATOR);

let PASS = 0;
let FAIL = 0;
const made = [SAFE_ROOT];

function arm(name, fn) {
  try {
    fn();
    PASS += 1;
    console.log('PASS ' + name);
  } catch (err) {
    FAIL += 1;
    console.log('FAIL ' + name + ': ' + (err && err.message ? err.message : err));
  }
}

function tmpHome(label) {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'mos341-07-' + label + '-'));
  made.push(h);
  return h;
}

function legacyOf(home) {
  return path.join(home, '.claude', 'plugins', 'mindrian-os');
}

function plantLegacy(home) {
  const d = legacyOf(home);
  fs.mkdirSync(path.join(d, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(d, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(d, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'mos', version: '0.0.1' }));
  fs.writeFileSync(path.join(d, 'scripts', 'statusline-mos'), '#!/usr/bin/env bash\necho legacy\n');
  fs.writeFileSync(path.join(d, 'README.md'), 'legacy install fixture\n');
  return d;
}

function writeSettings(home, obj) {
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
}

function measure(dir) {
  let count = 0;
  let bytes = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else { count += 1; bytes += fs.statSync(f).size; }
    }
  };
  walk(dir);
  return { count, bytes };
}

function runCli(home, args) {
  return spawnSync(process.execPath, [MIGRATOR].concat(args), {
    encoding: 'utf8',
    input: '',
    timeout: 30000,
    env: Object.assign({}, process.env, { HOME: home, USERPROFILE: home, MOS_LEGACY_INSTALL_HOME: home }),
  });
}

// 1. ALREADY CLEAN
arm('ALREADY CLEAN: no legacy dir returns already-clean, ok, creates nothing', () => {
  const home = tmpHome('clean');
  const before = fs.readdirSync(home);
  const r = m.migrate({ apply: true, home });
  assert.strictEqual(r.action, 'already-clean');
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(fs.readdirSync(home), before, 'home must be unchanged');
  assert.ok(!fs.existsSync(path.join(home, '.mindrian')), 'no .mindrian dir created');
});

// 2. REFUSED on statusLine reference
arm('REFUSED: statusLine names the legacy dir', () => {
  const home = tmpHome('statusline');
  const d = plantLegacy(home);
  writeSettings(home, { statusLine: { type: 'command', command: 'bash "' + d + '/scripts/statusline-mos"' } });
  const r = m.migrate({ apply: true, home });
  assert.strictEqual(r.action, 'refused');
  assert.strictEqual(r.ok, false);
  assert.ok(fs.existsSync(d), 'legacy dir must still exist');
  assert.ok(r.references.some((x) => x.where.startsWith('statusLine')), 'statusLine reference listed');
  assert.ok(!fs.existsSync(path.join(home, '.mindrian')), 'no backup made on refusal');
});

// 3. REFUSED on hook reference
arm('REFUSED: SessionStart hook carries the marker', () => {
  const home = tmpHome('hook');
  const d = plantLegacy(home);
  writeSettings(home, {
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'bash "$HOME/.claude/plugins/mindrian-os/scripts/session-start"', _source: 'mindrian-os' }] }] },
  });
  const r = m.migrate({ apply: true, home });
  assert.strictEqual(r.action, 'refused');
  assert.strictEqual(r.ok, false);
  assert.ok(fs.existsSync(d), 'legacy dir must still exist');
  assert.ok(r.references.some((x) => x.where.startsWith('hooks.SessionStart')), 'hook reference listed');
});

// 4. REFUSED on malformed settings
arm('REFUSED: malformed settings.json is not read as "no references"', () => {
  const home = tmpHome('malformed');
  const d = plantLegacy(home);
  writeSettings(home, '{ this is not json');
  const r = m.migrate({ apply: true, home });
  assert.strictEqual(r.action, 'refused');
  assert.strictEqual(r.ok, false);
  assert.ok(fs.existsSync(d), 'legacy dir must still exist');
  assert.ok(/not valid JSON/.test(r.detail), 'detail names the parse problem');
});

// 5. REMOVED with verified backup
arm('REMOVED: backup exists with equal file count and bytes, legacy dir gone', () => {
  const home = tmpHome('remove');
  const d = plantLegacy(home);
  writeSettings(home, { theme: 'dark' });
  const original = measure(d);
  const r = m.migrate({ apply: true, home });
  assert.strictEqual(r.action, 'removed', r.detail);
  assert.strictEqual(r.ok, true);
  assert.ok(r.backupPath && fs.existsSync(r.backupPath), 'backup path exists');
  assert.ok(path.dirname(r.backupPath) === path.join(home, '.mindrian'), 'backup under <home>/.mindrian');
  assert.ok(/legacy-install-backup-/.test(path.basename(r.backupPath)), 'backup name');
  const backup = measure(r.backupPath);
  assert.strictEqual(backup.count, original.count, 'file count equal');
  assert.strictEqual(backup.bytes, original.bytes, 'byte total equal');
  assert.ok(!fs.existsSync(d), 'legacy dir gone');
});

// 6. DRY RUN
arm('DRY RUN: no apply leaves the directory in place and reports the plan', () => {
  const home = tmpHome('dry');
  const d = plantLegacy(home);
  writeSettings(home, {});
  const r = m.migrate({ home });
  assert.strictEqual(r.action, 'dry-run');
  assert.strictEqual(r.ok, true);
  assert.ok(fs.existsSync(d), 'legacy dir still exists');
  assert.ok(!fs.existsSync(path.join(home, '.mindrian')), 'no backup in dry run');
  assert.ok(/would back up/.test(r.detail), 'detail says what would happen');
});

// 7. PATH GUARD
arm('PATH GUARD: refuses every path that is not the exact legacy directory', () => {
  const home = tmpHome('guard');
  const d = plantLegacy(home);
  const other = path.join(home, '.claude', 'plugins', 'other');
  fs.mkdirSync(other, { recursive: true });
  assert.strictEqual(m.guardRemovalPath(d, home).ok, true, 'exact legacy dir is allowed');
  assert.strictEqual(m.guardRemovalPath(other, home).ok, false, 'sibling dir refused');
  assert.strictEqual(m.guardRemovalPath(home, home).ok, false, 'home refused');
  assert.strictEqual(m.guardRemovalPath(path.parse(home).root, home).ok, false, 'root refused');
  assert.strictEqual(m.guardRemovalPath(path.join(d, '..', 'other'), home).ok, false, '".." refused');
  assert.strictEqual(m.guardRemovalPath(path.join(d, 'scripts'), home).ok, false, 'child refused');
  assert.strictEqual(m.guardRemovalPath('', home).ok, false, 'empty refused');
  // A matching suffix under a DIFFERENT root is refused (single home root).
  const elsewhere = tmpHome('guard-else');
  const d2 = plantLegacy(elsewhere);
  assert.strictEqual(m.guardRemovalPath(d2, home).ok, false, 'suffix match under another root refused');
});

arm('PATH GUARD: a symlink at the legacy path is refused and the target survives', () => {
  const home = tmpHome('symlink');
  const real = path.join(home, 'precious');
  fs.mkdirSync(real, { recursive: true });
  fs.writeFileSync(path.join(real, 'keep.txt'), 'keep\n');
  fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
  try {
    fs.symlinkSync(real, legacyOf(home), 'dir');
  } catch (_) {
    return; // symlink not permitted on this platform; arm is vacuous here
  }
  assert.strictEqual(m.guardRemovalPath(legacyOf(home), home).ok, false);
  const r = m.migrate({ apply: true, home });
  assert.strictEqual(r.ok, false);
  assert.ok(fs.existsSync(path.join(real, 'keep.txt')), 'symlink target must survive');
});

// 8. T-341-25 redaction
arm('REDACTION: env values under KEY/TOKEN/SECRET/PASSWORD keys are never echoed', () => {
  const home = tmpHome('redact');
  const d = plantLegacy(home);
  writeSettings(home, {
    env: {
      MINDRIAN_OS_ROOT: d,
      BRAIN_API_KEY: d + '/secret-in-path',
      OTHER_TOKEN: d,
    },
  });
  const scan = m.scanLegacyReferences(home);
  const byWhere = Object.fromEntries(scan.references.map((x) => [x.where, x.value]));
  assert.strictEqual(byWhere['env.MINDRIAN_OS_ROOT'], d, 'plain env value is listed');
  assert.ok(/^\[redacted:BRAIN_API_KEY\]$/.test(byWhere['env.BRAIN_API_KEY']), 'key redacted');
  assert.ok(/^\[redacted:OTHER_TOKEN\]$/.test(byWhere['env.OTHER_TOKEN']), 'token redacted');
  assert.ok(!JSON.stringify(scan.references).includes('secret-in-path'), 'secret value absent');
  const r = m.migrate({ apply: true, home });
  assert.strictEqual(r.action, 'refused');
  assert.ok(fs.existsSync(d));
});

// 9. scanLegacyReferences shape and absent settings
arm('SCAN: absent settings.json yields zero references and never throws', () => {
  const home = tmpHome('scan');
  plantLegacy(home);
  const scan = m.scanLegacyReferences(home);
  assert.strictEqual(scan.exists, true);
  assert.deepStrictEqual(scan.references, []);
  assert.strictEqual(scan.settingsError, null);
  assert.strictEqual(scan.legacyDir, legacyOf(home));
});

// 10. CLI contract
arm('CLI: no flag is a dry run and keeps the directory', () => {
  const home = tmpHome('cli-default');
  const d = plantLegacy(home);
  writeSettings(home, {});
  const r = runCli(home, ['--json']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(JSON.parse(r.stdout).action, 'dry-run');
  assert.ok(fs.existsSync(d), 'directory survives the default run');
});

arm('CLI: --dry-run wins over --apply', () => {
  const home = tmpHome('cli-both');
  const d = plantLegacy(home);
  writeSettings(home, {});
  const r = runCli(home, ['--apply', '--dry-run', '--json']);
  assert.strictEqual(JSON.parse(r.stdout).action, 'dry-run');
  assert.ok(fs.existsSync(d));
});

arm('CLI: --apply --quiet --json removes and reports the backup path', () => {
  const home = tmpHome('cli-apply');
  const d = plantLegacy(home);
  writeSettings(home, {});
  const r = runCli(home, ['--apply', '--quiet', '--json']);
  assert.strictEqual(r.status, 0, r.stderr);
  const env = JSON.parse(r.stdout);
  assert.strictEqual(env.action, 'removed');
  assert.ok(fs.existsSync(env.backupPath));
  assert.ok(!fs.existsSync(d));
});

arm('CLI: already clean is a single quiet line and exit 0', () => {
  const home = tmpHome('cli-clean');
  const r = runCli(home, ['--apply']);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim().split('\n').length, 1);
  assert.strictEqual(r.stderr, '');
});

arm('CLI: unknown flag prints usage and exits 2', () => {
  const home = tmpHome('cli-bogus');
  const r = runCli(home, ['--bogus']);
  assert.strictEqual(r.status, 2);
  assert.ok(/^usage:/.test(r.stderr));
});

arm('CLI: a refusal exits 1', () => {
  const home = tmpHome('cli-refuse');
  const d = plantLegacy(home);
  writeSettings(home, { statusLine: { command: 'bash ' + d + '/scripts/statusline-mos' } });
  const r = runCli(home, ['--apply', '--json']);
  assert.strictEqual(r.status, 1);
  assert.strictEqual(JSON.parse(r.stdout).action, 'refused');
  assert.ok(fs.existsSync(d));
});

// 11. Source order proves verify, then back up, then remove
arm('ORDER: scanLegacyReferences precedes cpSync precedes rmSync in migrate()', () => {
  const src = fs.readFileSync(MIGRATOR, 'utf8').split('\n');
  const lineOf = (needle, from) => {
    for (let i = from || 0; i < src.length; i += 1) if (src[i].includes(needle)) return i + 1;
    return -1;
  };
  const migrateStart = lineOf('function migrate(');
  const scanCall = lineOf('scanLegacyReferences(root)', migrateStart);
  const cp = lineOf('backupLegacyDir(scan.legacyDir', migrateStart);
  const rm = lineOf('fs.rmSync(', migrateStart);
  assert.ok(scanCall > 0 && cp > scanCall && rm > cp, 'order scan=' + scanCall + ' backup=' + cp + ' rm=' + rm);
  assert.ok(lineOf('fs.cpSync(') > 0, 'cpSync present');
});

arm('DASHES: the migrator and this test carry no em-dash or en-dash', () => {
  const bad = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];
  for (const f of [MIGRATOR, __filename]) {
    const t = fs.readFileSync(f, 'utf8');
    for (const ch of bad) assert.ok(!t.includes(ch), f + ' has a dash character');
  }
});

for (const dir of made) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* best effort */ }
}

console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
