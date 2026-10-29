'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261029-u8x -- a room folder name must never reach node as program text.
 * RCA: .planning/debug/compute-team-analyze-room-python-date-fallback-injection.md
 *
 * scripts/analyze-room formats each cross-reference edge with a small
 * node -e program (visual-ops formatEdge). The old program text held the
 * section and target folder names, so a folder name that closes the
 * JavaScript string ran its own code. The bash half had 2 such sites
 * (INFORMS and CONTRADICTS). The bash 3.2 python half had 2 twins.
 *
 * Legs:
 *   A. bash half, INFORMS: payload folder name, no marker, composed EDGE line;
 *   B. bash half, CONTRADICTS: payload folder name, no marker, composed EDGE line;
 *   C. bash half, normal pair parity: EDGE line for two normal sections;
 *   D. bash half, leading-dash folder name keeps a composed EDGE line;
 *   E. python half (the bash 3.2 heredoc run under python3): no marker,
 *      composed EDGE line;
 *   F. source pins: no program text interpolation, process.argv[3] 4 times.
 *
 * Plain node:assert/strict, zero deps, mkdtemp only. Exit 0 pass, 1 fail.
 * Hyphens only (no em-dash or en-dash).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'analyze-room');
const VISUAL_OPS = path.join(ROOT, 'lib', 'core', 'visual-ops.cjs');
const { formatEdge } = require(VISUAL_OPS);

let failures = 0;
function leg(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.log('not ok - ' + name);
    console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
  }
}

const tmpRoots = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'test-u8x-edge-' + label + '-'));
  tmpRoots.push(d);
  return d;
}
function assertUnderTmp(p) {
  assert.ok(p.startsWith(os.tmpdir()), 'room path must live under os.tmpdir(): ' + p);
}
function hasPython() {
  return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const MARK_INFORMS = 'mos-edge-informs-proof';
const MARK_CONTRA = 'mos-edge-contradicts-proof';
const MARK_PY = 'mos-edge-py-proof';

// A folder name that closes the JavaScript string and runs a command.
function payloadName(marker) {
  return "x'+require('child_process').execSync('touch " + marker + "')+'";
}
// Text that the grep -E pattern built from payloadName(marker) matches.
function payloadGrepText(marker) {
  return "x'require'child_process'.execSync'touch " + marker + "''";
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
function composedEdge(section, target, type) {
  return 'EDGE:' + section + ':' + target + ':' + type + ':' + formatEdge(section, target, type);
}
function runBash(room, cwd) {
  return spawnSync('bash', [SCRIPT, room], { cwd, encoding: 'utf8', timeout: 60000 });
}

// ---------------------------------------------------------------------------
// bash half
// ---------------------------------------------------------------------------
function buildBashRoom(base, extra) {
  const room = path.join(base, 'room');
  assertUnderTmp(room);
  write(path.join(room, 'problem-definition', 'p.md'),
    '# P\n[[' + payloadGrepText(MARK_INFORMS) + ']]\n[[market-analysis]]\n');
  write(path.join(room, 'market-analysis', 'c.md'),
    '# C\ncontradict ' + payloadGrepText(MARK_CONTRA) + '\n');
  write(path.join(room, 'market-analysis', 'm.md'), '# M\nplain\n');
  write(path.join(room, payloadName(MARK_INFORMS), 'a.md'), '# A\n');
  write(path.join(room, payloadName(MARK_CONTRA), 'a.md'), '# A\n');
  if (extra) extra(room);
  return room;
}

const bashBase = mkTmp('bash');
const bashRoom = buildBashRoom(bashBase);
const bashRun = runBash(bashRoom, bashBase);

leg('A. bash half INFORMS: folder name creates no marker; EDGE line carries formatEdge of the raw name', () => {
  assert.equal(bashRun.status, 0, 'analyze-room rc: ' + bashRun.stderr);
  assert.equal(fs.existsSync(path.join(bashBase, MARK_INFORMS)), false, 'marker file exists: node ran a folder name');
  assert.ok(
    bashRun.stdout.includes(composedEdge('problem-definition', payloadName(MARK_INFORMS), 'INFORMS')),
    'composed INFORMS EDGE line missing'
  );
});

leg('B. bash half CONTRADICTS: folder name creates no marker; EDGE line carries formatEdge of the raw name', () => {
  assert.equal(fs.existsSync(path.join(bashBase, MARK_CONTRA)), false, 'marker file exists: node ran a folder name');
  assert.ok(
    bashRun.stdout.includes(composedEdge('market-analysis', payloadName(MARK_CONTRA), 'CONTRADICTS')),
    'composed CONTRADICTS EDGE line missing'
  );
});

leg('C. bash half normal pair: INFORMS EDGE line equals the composed string', () => {
  assert.ok(
    bashRun.stdout.includes(composedEdge('problem-definition', 'market-analysis', 'INFORMS')),
    'composed normal INFORMS EDGE line missing'
  );
});

leg('D. bash half leading-dash folder name: no marker and a composed EDGE line', () => {
  const base = mkTmp('dash');
  const dashName = '-e-proof';
  const room = path.join(base, 'room');
  assertUnderTmp(room);
  write(path.join(room, 'problem-definition', 'p.md'), '# P\n[[' + dashName + ']]\n');
  write(path.join(room, dashName, 'a.md'), '# A\n');
  const r = runBash(room, base);
  assert.equal(r.status, 0, 'analyze-room rc: ' + r.stderr);
  assert.ok(
    r.stdout.includes(composedEdge('problem-definition', dashName, 'INFORMS')),
    'composed EDGE line for the dash folder missing (node parsed the name as an option?)'
  );
});

// ---------------------------------------------------------------------------
// python half (bash 3.2 heredoc)
// ---------------------------------------------------------------------------
function extractHeredoc() {
  const lines = fs.readFileSync(SCRIPT, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.endsWith("<< 'PYEOF'"));
  assert.ok(start >= 0, 'heredoc start not found');
  const end = lines.findIndex((l, i) => i > start && l === 'PYEOF');
  assert.ok(end > start, 'heredoc end not found');
  return lines.slice(start + 1, end).join('\n') + '\n';
}

leg('E. python half: folder name creates no marker; EDGE line carries formatEdge of the raw name', () => {
  if (!hasPython()) { console.log('    skip - python3 absent'); return; }
  const base = mkTmp('py');
  const cwd = path.join(base, 'py', 'scripts');
  fs.mkdirSync(cwd, { recursive: true });
  fs.mkdirSync(path.join(base, 'py', 'lib', 'core'), { recursive: true });
  fs.copyFileSync(VISUAL_OPS, path.join(base, 'py', 'lib', 'core', 'visual-ops.cjs'));
  const room = path.join(base, 'room');
  assertUnderTmp(room);
  const name = payloadName(MARK_PY);
  write(path.join(room, 'problem-definition', 'p.md'), '# P\n[[' + name + ']]\n');
  write(path.join(room, name, 'a.md'), '# A\n');
  const r = spawnSync('python3', ['-', room], { cwd, input: extractHeredoc(), encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 0, 'python half rc: ' + r.stderr);
  assert.equal(fs.existsSync(path.join(cwd, MARK_PY)), false, 'marker file exists: node ran a folder name');
  assert.ok(
    r.stdout.includes(composedEdge('problem-definition', name, 'INFORMS')),
    'composed EDGE line missing from the python half'
  );
});

// ---------------------------------------------------------------------------
// F. source pins
// ---------------------------------------------------------------------------
leg('F. source pins: no section or target in node program text; process.argv[3] 4 times', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.equal(src.includes("formatEdge('$section'"), false, "formatEdge('$section' must be gone");
  assert.equal(src.includes("formatEdge('{section}'"), false, "formatEdge('{section}' must be gone");
  assert.equal(src.split('process.argv[3]').length - 1, 4, 'process.argv[3] must appear 4 times');
});

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* best effort */ }
}
console.log(failures ? 'analyze-room-edge-argv: ' + failures + ' FAILED' : 'analyze-room-edge-argv: ALL PASS');
process.exit(failures ? 1 : 0);
