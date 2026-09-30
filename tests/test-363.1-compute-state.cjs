'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363.1 Plan 04 Task 1 (D-06, B51-05) -- compute-state counts,
 * stages and cross-references CONTENT only.
 *
 * translational-capital-lab reported `venture_stage: Investment` and 12
 * "Well-developed" sections while seven of them held only CONTEXT.md, a
 * birth-seeded FEYNMAN.md and ROOM.md. compute-state must ask the shared
 * scaffold predicate (lib/core/scaffold-predicate.cjs, Plan 01) instead of
 * counting every .md that is not ROOM.md.
 *
 * Legs:
 *   A. scaffold-only sections: Pre-Opportunity, counts 0, no scaffold
 *      cross-references, an authored FEYNMAN still counts;
 *   B. real content still climbs the stage ladder (Investment) and a section
 *      dir with a space in its name travels as quoted argv;
 *   C. timing: 14 sections finish well inside state-ops' 10s timeout;
 *   D. source pins: bash 3.2 safe, predicate CLI spawned at most twice, and
 *      never inside a per-file loop.
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
const SCRIPT = path.join(ROOT, 'scripts', 'compute-state');

const timelineRunner = require(path.join(ROOT, 'lib/core/feynman/timeline-runner.cjs'));
const dialMemory = require(path.join(ROOT, 'lib/core/feynman/dial-memory-renderer.cjs'));
const roomBirth = require(path.join(ROOT, 'lib/core/navigation/room-birth.cjs'));

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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'test-363.1-compute-state-' + label + '-'));
  tmpRoots.push(d);
  return d;
}

// The real 34-line seeded FEYNMAN.md shape (birth seed + both auto blocks),
// built from the modules' exported constants, never hard-coded sentinels.
function seededFeynman(slug) {
  const seed = String(roomBirth.FEYNMAN_BIRTH_SEED_TEMPLATE).replace(/\{\{SECTION_SLUG\}\}/g, slug);
  return [
    '---',
    'timeline_last_rendered: 2026-09-29T16:10:46Z',
    'dial_memory_last_rendered: 2026-09-29T16:10:47Z',
    '---',
    '# ' + slug,
    '',
    seed.replace(/^# .*\n\n?/, ''),
    '',
    timelineRunner.HEADER,
    '',
    timelineRunner.SENTINEL_START,
    '*No timeline events yet.*',
    timelineRunner.SENTINEL_END,
    '',
    dialMemory.HEADER,
    '',
    dialMemory.SENTINEL_START,
    '*Last refreshed: 2026-09-29T16:10:47Z. No dial activity yet.*',
    '',
    '**Available reaches** (6):',
    '- context_block',
    '- contradiction',
    '- cross_room',
    '- brain_consult',
    '- deep_research',
    '- hats',
    '',
    '**Last selected:** none yet.',
    '',
    '**Current recommended:** none (Brain-gated marker is a mode_a concept; current tier tier_0).',
    '',
    '**Recent research conclusions:**',
    '- no recent research conclusions',
    dialMemory.SENTINEL_END,
    '',
  ].join('\n');
}

function w(dir, name, body) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), body);
}

// Scaffold a section the way room birth leaves it (no MINTO unless asked).
function scaffoldSection(roomDir, slug, opts) {
  const o = opts || {};
  const d = path.join(roomDir, slug);
  w(d, 'CONTEXT.md', '# CONTEXT\n\nSection contract for ' + slug + '.\n');
  w(d, 'ROOM.md', '# ROOM\n\nIdentity for ' + slug + '.\n');
  if (o.minto) w(d, 'MINTO.md', '# MINTO\n\nThis section synthesizes 0 artifacts.\n');
  w(d, 'FEYNMAN.md', seededFeynman(slug));
  return d;
}

function newRoom(label) {
  const roomDir = path.join(mkTmp(label), 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  return roomDir;
}

function runComputeState(roomDir) {
  const emptyHome = mkTmp('home');
  const t0 = Date.now();
  const r = spawnSync('bash', [SCRIPT, roomDir], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { ROOMS_HOME: emptyHome, MINDRIAN_ROOMS_HOME: emptyHome }),
    encoding: 'utf8',
    timeout: 60000,
  });
  return { status: r.status, out: r.stdout || '', err: r.stderr || '', ms: Date.now() - t0 };
}

function tableRow(out, section) {
  const lines = out.split('\n').filter((l) => l.startsWith('| ' + section + ' |'));
  assert.equal(lines.length, 1, 'expected one table row for ' + section + ' in:\n' + out.slice(0, 1500));
  const cells = lines[0].split('|').map((c) => c.trim());
  // cells: ['', section, entries, progress, status, date, '']
  return { entries: cells[2], status: cells[4] };
}

// ---------------------------------------------------------------------------
// Fixture A: scaffold-only sections plus two real ones.
// ---------------------------------------------------------------------------
const roomA = newRoom('A');
for (const s of ['business-model', 'market-analysis', 'solution-design', 'financial-model']) {
  scaffoldSection(roomA, s, { minto: true });
}
{
  const d = scaffoldSection(roomA, 'problem-definition');
  w(d, 'brief.md', '# Brief\n\nSee [[market-analysis]] for sizing.\n');
  w(d, 'meeting.md', '# Meeting\n\nNotes.\n');
}
{
  const d = scaffoldSection(roomA, 'competitive-analysis');
  w(d, 'FEYNMAN.md', seededFeynman('competitive-analysis') + '\nWe win on price against incumbents.\n');
  w(d, 'notes.md', '# Notes\n\nIncumbents.\n');
  w(d, 'teardown.md', '# Teardown\n\nFeature grid.\n');
}
// A section contract that names another section must not become a cross-ref.
fs.appendFileSync(path.join(roomA, 'business-model', 'CONTEXT.md'), '\nRelated: [[market-analysis]]\n');

const resA = runComputeState(roomA);

leg('A: compute-state exits 0', () => {
  assert.equal(resA.status, 0, resA.err);
});

leg('A: scaffold-only sections report Pre-Opportunity, not Investment', () => {
  assert.match(resA.out, /^venture_stage: Pre-Opportunity$/m);
});

leg('A: total_entries counts content only (5)', () => {
  assert.match(resA.out, /^total_entries: 5$/m);
});

leg('A: a section with only scaffold shows 0 entries and Empty', () => {
  for (const s of ['business-model', 'market-analysis', 'solution-design', 'financial-model']) {
    const row = tableRow(resA.out, s);
    assert.equal(row.entries, '0', s);
    assert.equal(row.status, 'Empty', s);
  }
});

leg('A: two real files is Active, an authored FEYNMAN plus two files is Well-developed', () => {
  const pd = tableRow(resA.out, 'problem-definition');
  assert.equal(pd.entries, '2');
  assert.equal(pd.status, 'Active');
  const ca = tableRow(resA.out, 'competitive-analysis');
  assert.equal(ca.entries, '3');
  assert.equal(ca.status, 'Well-developed');
});

leg('A: a real file that names a section is a cross-reference', () => {
  assert.ok(resA.out.includes('- problem-definition/brief.md references market-analysis'), resA.out);
});

leg('A: a scaffold CONTEXT.md that names a section is NOT a cross-reference', () => {
  assert.ok(!/^- business-model\/CONTEXT\.md/m.test(resA.out), resA.out);
});

leg('A: no predicate-unavailable warning on a healthy tree', () => {
  assert.ok(!resA.err.includes('scaffold predicate unavailable'), resA.err);
});

// ---------------------------------------------------------------------------
// Fixture B: real content climbs the ladder; a space in a dir name survives.
// ---------------------------------------------------------------------------
const roomB = newRoom('B');
for (const s of ['problem-definition', 'market-analysis', 'solution-design', 'business-model', 'financial-model']) {
  const d = scaffoldSection(roomB, s);
  w(d, 'finding.md', '# Finding\n\nReal content for ' + s + '.\n');
}
{
  const d = path.join(roomB, 'deal notes');
  w(d, 'CONTEXT.md', '# CONTEXT\n');
  w(d, 'term-sheet.md', '# Term sheet\n\nDraft.\n');
}
const resB = runComputeState(roomB);

leg('B: real content in all five stage sections reports Investment', () => {
  assert.equal(resB.status, 0, resB.err);
  assert.match(resB.out, /^venture_stage: Investment$/m);
});

leg('B: a section dir with a space in its name is counted (quoted argv)', () => {
  assert.equal(tableRow(resB.out, 'deal notes').entries, '1');
  assert.match(resB.out, /^total_entries: 6$/m);
});

// ---------------------------------------------------------------------------
// Timing: 14 sections, constant node spawns.
// ---------------------------------------------------------------------------
const roomC = newRoom('C');
for (let i = 0; i < 14; i += 1) {
  const d = scaffoldSection(roomC, 'section-' + String(i).padStart(2, '0'), { minto: true });
  w(d, 'real.md', '# Real\n\nContent ' + i + '.\n');
}
const resC = runComputeState(roomC);

leg('C: 14 sections finish under 8000 ms (T-363.1-15)', () => {
  assert.equal(resC.status, 0, resC.err);
  assert.match(resC.out, /^total_entries: 14$/m);
  assert.ok(resC.ms < 8000, 'took ' + resC.ms + ' ms');
  console.log('    (14-section run: ' + resC.ms + ' ms)');
});

// ---------------------------------------------------------------------------
// Source pins.
// ---------------------------------------------------------------------------
const src = fs.readFileSync(SCRIPT, 'utf8');

leg('D: bash 3.2 safe (no declare -A, no mapfile)', () => {
  assert.ok(!/declare -A/.test(src));
  assert.ok(!/\bmapfile\b|\breadarray\b/.test(src));
});

leg('D: the predicate CLI is spawned exactly once for counts and once for the list', () => {
  const count = src.split('\n').filter((l) => /scaffold-predicate\.cjs" --count-content/.test(l));
  const list = src.split('\n').filter((l) => /scaffold-predicate\.cjs" --list-content/.test(l));
  assert.equal(count.length, 1, 'count spawns');
  assert.equal(list.length, 1, 'list spawns');
  assert.ok((src.match(/scaffold-predicate\.cjs/g) || []).length <= 5);
});

leg('D: neither predicate spawn sits inside a for/while over sections or files', () => {
  const lines = src.split('\n');
  for (const pat of [/--count-content/, /--list-content/]) {
    const idx = lines.findIndex((l) => pat.test(l) && /node /.test(l));
    assert.ok(idx > 0, 'spawn line present for ' + pat);
    // Walk back to the previous blank line; a loop opener directly above the
    // spawn in the same block would show as `for ...; do` / `while ... do`.
    let depth = 0;
    for (let i = 0; i < idx; i += 1) {
      const t = lines[i].trim();
      if (/^(for|while|until)\b.*;\s*do$/.test(t)) depth += 1;
      if (/^done\b/.test(t)) depth -= 1;
    }
    assert.equal(depth, 0, 'spawn for ' + pat + ' is inside a loop');
  }
});

leg('D: fallback path names the degrade on stderr (T-363.1-17)', () => {
  assert.ok(src.includes('compute-state: scaffold predicate unavailable; entry counts include scaffold files'));
});

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}
if (failures > 0) {
  console.log('\n' + failures + ' leg(s) failed');
  process.exit(1);
}
console.log('\nall legs passed');
