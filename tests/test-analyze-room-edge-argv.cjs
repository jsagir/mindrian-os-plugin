'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261029-u8x -- a room folder name must never reach node as program text.
 * RCA: .planning/debug/compute-team-analyze-room-python-date-fallback-injection.md
 *
 * scripts/analyze-room formatted each cross-reference edge with a small
 * node -e program (visual-ops formatEdge). The old program text held the
 * section and target folder names, so a folder name that closes the
 * JavaScript string ran its own code. The bash half had 2 such sites
 * (INFORMS and CONTRADICTS). The bash 3.2 python half had 2 twins.
 *
 * Phase 381 plan 381-09 removed the bash body and the python half after the
 * recorded zero-diff run; scripts/analyze-room now execs lib/core/room-render.cjs,
 * which calls formatEdge in process. Legs A to D still run the whole entry
 * point. The python-half leg E read the bash 3.2 heredoc and is retired with
 * it; leg F is re-pinned to the absence of every program-text site.
 *
 * Legs:
 *   A. INFORMS: payload folder name, no marker, composed EDGE line;
 *   B. CONTRADICTS: payload folder name, no marker, composed EDGE line;
 *   C. normal pair parity: EDGE line for two normal sections;
 *   D. leading-dash folder name keeps a composed EDGE line;
 *   F. source pins (re-pinned by 381-09): no node -e, no python3, no PYEOF
 *      heredoc and no formatEdge program text in the entry point; one exec
 *      line for the node renderer.
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

const MARK_INFORMS = 'mos-edge-informs-proof';
const MARK_CONTRA = 'mos-edge-contradicts-proof';

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
// whole entry point (the node renderer since plan 381-09)
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

leg('A. entry point INFORMS: folder name creates no marker; EDGE line carries formatEdge of the raw name', () => {
  assert.equal(bashRun.status, 0, 'analyze-room rc: ' + bashRun.stderr);
  assert.equal(fs.existsSync(path.join(bashBase, MARK_INFORMS)), false, 'marker file exists: node ran a folder name');
  assert.ok(
    bashRun.stdout.includes(composedEdge('problem-definition', payloadName(MARK_INFORMS), 'INFORMS')),
    'composed INFORMS EDGE line missing'
  );
});

leg('B. entry point CONTRADICTS: folder name creates no marker; EDGE line carries formatEdge of the raw name', () => {
  assert.equal(fs.existsSync(path.join(bashBase, MARK_CONTRA)), false, 'marker file exists: node ran a folder name');
  assert.ok(
    bashRun.stdout.includes(composedEdge('market-analysis', payloadName(MARK_CONTRA), 'CONTRADICTS')),
    'composed CONTRADICTS EDGE line missing'
  );
});

leg('C. entry point normal pair: INFORMS EDGE line equals the composed string', () => {
  assert.ok(
    bashRun.stdout.includes(composedEdge('problem-definition', 'market-analysis', 'INFORMS')),
    'composed normal INFORMS EDGE line missing'
  );
});

leg('D. entry point leading-dash folder name: no marker and a composed EDGE line', () => {
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
// F. source pins (re-pinned by plan 381-09)
// ---------------------------------------------------------------------------
leg('F. source pins: no node -e, no python3, no heredoc and no formatEdge program text; one exec line', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.equal(src.includes('node -e'), false, 'node -e must be gone');
  assert.equal(src.includes('python3'), false, 'python3 must be gone');
  assert.equal(src.includes('PYEOF'), false, 'the python heredoc must be gone');
  assert.equal(src.includes('formatEdge('), false, 'no formatEdge program text in the entry point');
  const exec = 'NODE_NO_WARNINGS=1 exec node "${SCRIPT_DIR}/../lib/core/room-render.cjs" analyze "$@"';
  assert.equal(src.split('\n').filter((l) => l === exec).length, 1, 'exactly one exec line');
});

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* best effort */ }
}
console.log(failures ? 'analyze-room-edge-argv: ' + failures + ' FAILED' : 'analyze-room-edge-argv: ALL PASS');
process.exit(failures ? 1 : 0);
