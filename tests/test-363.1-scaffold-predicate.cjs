'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363.1 Plan 01 Task 3 (D-01, D-02) -- the one shared scaffold
 * predicate (lib/core/scaffold-predicate.cjs) and its bash CLI.
 *
 * The beta.51 bug cluster is "the system counts its own scaffold as
 * content". Eureka, compute-state and the MINTO generator each need to ask
 * "is this file scaffold?" the same way; this file pins that one answer:
 *   - CONTEXT/ROOM/MINTO/STATE/USER/BRAIN .md are always scaffold;
 *   - FEYNMAN.md is scaffold only while it holds nothing but the birth (or
 *     default) seed, its H1, frontmatter and the two auto sentinel blocks;
 *     one navigator-written line anywhere outside those blocks makes it
 *     content (T-363.1-01);
 *   - every other .md is content;
 *   - bash callers get the same answer through the CLI, many dirs per
 *     spawn (compute-state runs under a 10s execSync timeout);
 *   - Part 8: the module reaches no network and no Brain.
 *
 * Plain node:assert/strict, zero deps, mkdtemp only. Exit 0 on pass, 1 on
 * any failure. Hyphens only (no em-dash or en-dash).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const MODULE_REL = 'lib/core/scaffold-predicate.cjs';
const MODULE_ABS = path.join(ROOT, MODULE_REL);

const hygiene = require(path.join(ROOT, 'tests/helpers/hygiene-355.cjs'));
const timelineRunner = require(path.join(ROOT, 'lib/core/feynman/timeline-runner.cjs'));
const dialMemory = require(path.join(ROOT, 'lib/core/feynman/dial-memory-renderer.cjs'));
const feynmanSeedWriter = require(path.join(ROOT, 'lib/core/feynman/feynman-seed-writer.cjs'));
const roomSkeletonScaffold = require(path.join(ROOT, 'lib/core/room-skeleton-scaffold.cjs'));

let sp = null;
let loadError = null;
try {
  sp = require(MODULE_ABS);
} catch (err) {
  loadError = err;
}

let failures = 0;
function leg(name, fn) {
  try {
    if (!sp && !/^fence:/.test(name)) {
      throw new Error('scaffold-predicate module failed to load: ' + (loadError && loadError.message));
    }
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.log('not ok - ' + name);
    console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
  }
}

// ---------------------------------------------------------------------------
// Fixtures. The seeded FEYNMAN is the real 34-line shape room birth plus the
// timeline and dial refreshes leave behind, built from the two modules'
// EXPORTED sentinel and header constants (never hard-coded strings).
// ---------------------------------------------------------------------------
const BIRTH_SEED = 'Seeded at birth -- replace with your content for the business-model section of your venture.';
const AUTHORED = 'We sell the diagnostic to hospital CFOs first.';

function realSeededShape() {
  return [
    '---',
    'timeline_last_rendered: 2026-09-29T16:10:46Z',
    'dial_memory_last_rendered: 2026-09-29T16:10:47Z',
    '---',
    '# business-model',
    '',
    BIRTH_SEED,
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

const tmpRoots = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'test-363.1-scaffold-' + label + '-'));
  tmpRoots.push(d);
  return d;
}
function writeSection(dir, withContent) {
  for (const n of ['CONTEXT.md', 'ROOM.md', 'MINTO.md', 'STATE.md', 'USER.md', 'BRAIN.md']) {
    fs.writeFileSync(path.join(dir, n), '# ' + n + '\n\nanything at all, even authored-looking prose.\n');
  }
  fs.writeFileSync(path.join(dir, 'FEYNMAN.md'), realSeededShape());
  if (withContent) {
    fs.writeFileSync(path.join(dir, 'notes.md'), '# notes\n\n' + AUTHORED + '\n');
    fs.writeFileSync(path.join(dir, 'deal.md'), '# deal\n\nTerm sheet draft.\n');
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'x.md'), '# nested\n');
  }
}
function runCli(args) {
  return spawnSync(process.execPath, [MODULE_REL].concat(args), { cwd: ROOT, encoding: 'utf8' });
}

// ---------------------------------------------------------------------------
// SCAFFOLD_BASENAMES / isScaffoldBasename
// ---------------------------------------------------------------------------
leg('SCAFFOLD_BASENAMES is a frozen Set of the seven scaffold kinds, the generated BRIEF.md (369.25-19) and the shipped reference docs', () => {
  assert.ok(sp.SCAFFOLD_BASENAMES instanceof Set);
  assert.equal(Object.isFrozen(sp.SCAFFOLD_BASENAMES), true);
  const expected = ['BRAIN.md', 'BRIEF.md', 'CONTEXT.md', 'FEYNMAN.md', 'MINTO.md', 'ROOM.md', 'STATE.md', 'USER.md']
    .concat(roomSkeletonScaffold.REFERENCE_DOCS).sort();
  assert.deepEqual([...sp.SCAFFOLD_BASENAMES].sort(), expected);
});

// ---------------------------------------------------------------------------
// Gap closure (2026-09-30, B51-01 residual): the reference docs room birth
// copies into references/ (SECTION-SCHEMA.md, SUB-SCHEMAS.md) are scaffold.
// The list is CONSUMED from room-skeleton-scaffold's REFERENCE_DOCS export
// (Canon Part 7), never retyped here or in the predicate.
// ---------------------------------------------------------------------------
leg('gap: REFERENCE_DOCS export is the two shipped reference docs and every one is scaffold', () => {
  assert.deepEqual([...roomSkeletonScaffold.REFERENCE_DOCS], ['SECTION-SCHEMA.md', 'SUB-SCHEMAS.md']);
  for (const n of roomSkeletonScaffold.REFERENCE_DOCS) {
    assert.equal(sp.SCAFFOLD_BASENAMES.has(n), true, n);
    assert.equal(sp.isScaffoldBasename(n), true, n);
    assert.equal(sp.isScaffoldBasename(n.replace(/\.md$/, '')), true, n + ' bare stem');
    assert.equal(sp.isScaffoldBasename('references/' + n), true, 'references/' + n);
    assert.equal(sp.isScaffoldBasename('references\\' + n), true, 'backslash ' + n);
  }
});

leg('gap: isScaffoldFile and listContentFiles treat the reference docs as scaffold, not content', () => {
  const dir = mkTmp('refs');
  for (const n of roomSkeletonScaffold.REFERENCE_DOCS) {
    fs.writeFileSync(path.join(dir, n), '# ' + n + '\n\nshipped reference text.\n');
    assert.equal(sp.isScaffoldFile(path.join(dir, n)), true, n);
  }
  fs.writeFileSync(path.join(dir, 'my-notes.md'), '# notes\n');
  assert.deepEqual(sp.listContentFiles(dir), [path.join(dir, 'my-notes.md')]);
  // A similarly named content file is still content (exact basename match only).
  fs.writeFileSync(path.join(dir, 'SECTION-SCHEMA-notes.md'), '# mine\n');
  assert.equal(sp.isScaffoldFile(path.join(dir, 'SECTION-SCHEMA-notes.md')), false);
});

leg('gap: CLI --is-scaffold and --count-content agree for the reference docs', () => {
  assert.equal(runCli(['--is-scaffold', '/nonexistent-363-1/references/SECTION-SCHEMA.md']).status, 0);
  assert.equal(runCli(['--is-scaffold', '/nonexistent-363-1/references/SUB-SCHEMAS.md']).status, 0);
  const dir = mkTmp('cli-refs');
  for (const n of roomSkeletonScaffold.REFERENCE_DOCS) fs.writeFileSync(path.join(dir, n), '# ref\n');
  fs.writeFileSync(path.join(dir, 'deal.md'), '# deal\n');
  const r = runCli(['--count-content', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '1\n');
});

leg('gap: single source of truth, the predicate source does not retype a reference doc name', () => {
  const src = fs.readFileSync(MODULE_ABS, 'utf8');
  for (const n of roomSkeletonScaffold.REFERENCE_DOCS) {
    assert.equal(src.includes(n), false, 'predicate must not copy ' + n);
    assert.equal(src.includes(n.replace(/\.md$/, '')), false, 'predicate must not copy stem of ' + n);
  }
  assert.ok(/room-skeleton-scaffold/.test(src), 'predicate must consume room-skeleton-scaffold');
});

leg('isScaffoldBasename accepts basename, bare stem and a backslash path', () => {
  assert.equal(sp.isScaffoldBasename('CONTEXT.md'), true);
  assert.equal(sp.isScaffoldBasename('CONTEXT'), true);
  assert.equal(sp.isScaffoldBasename('market-analysis\\CONTEXT.md'), true);
  assert.equal(sp.isScaffoldBasename('/abs/room/market-analysis/ROOM.md'), true);
});

leg('isScaffoldBasename rejects content names and a case-mismatched stem', () => {
  assert.equal(sp.isScaffoldBasename('notes.md'), false);
  assert.equal(sp.isScaffoldBasename('Context.md'), false);
  assert.equal(sp.isScaffoldBasename(''), false);
  assert.equal(sp.isScaffoldBasename(null), false);
});

// ---------------------------------------------------------------------------
// isSeededFeynman (D-02)
// ---------------------------------------------------------------------------
leg('isSeededFeynman: the real seeded shape with both auto blocks is scaffold', () => {
  assert.equal(sp.isSeededFeynman(realSeededShape()), true);
});

leg('isSeededFeynman: authored prose after the auto blocks makes it content', () => {
  assert.equal(sp.isSeededFeynman(realSeededShape() + '\n' + AUTHORED + '\n'), false);
});

leg('isSeededFeynman: authored prose between the two auto blocks makes it content', () => {
  const shape = realSeededShape().replace(dialMemory.HEADER, AUTHORED + '\n\n' + dialMemory.HEADER);
  assert.equal(sp.isSeededFeynman(shape), false);
});

leg('isSeededFeynman: authored prose replacing the seed sentence makes it content', () => {
  assert.equal(sp.isSeededFeynman(realSeededShape().replace(BIRTH_SEED, AUTHORED)), false);
});

leg('isSeededFeynman: FEYNMAN_DEFAULT_SEED body is scaffold', () => {
  assert.equal(sp.isSeededFeynman('# market-analysis\n\n' + feynmanSeedWriter.FEYNMAN_DEFAULT_SEED + '\n'), true);
});

leg('isSeededFeynman: empty body, and frontmatter plus H1 only, are scaffold', () => {
  assert.equal(sp.isSeededFeynman(''), true);
  assert.equal(sp.isSeededFeynman('---\ntimeline_last_rendered: 2026-09-29T16:10:46Z\n---\n# market-analysis\n'), true);
});

// ---------------------------------------------------------------------------
// isScaffoldFile / listContentFiles
// ---------------------------------------------------------------------------
leg('isScaffoldFile: non-FEYNMAN scaffold kinds are true without reading', () => {
  for (const n of ['CONTEXT.md', 'ROOM.md', 'MINTO.md', 'STATE.md', 'USER.md', 'BRAIN.md']) {
    assert.equal(sp.isScaffoldFile('/nonexistent-363-1/' + n), true, n);
  }
});

leg('isScaffoldFile: FEYNMAN.md is scaffold only when seeded', () => {
  const dir = mkTmp('file');
  const fey = path.join(dir, 'FEYNMAN.md');
  fs.writeFileSync(fey, realSeededShape());
  assert.equal(sp.isScaffoldFile(fey), true);
  fs.writeFileSync(fey, realSeededShape() + '\n' + AUTHORED + '\n');
  assert.equal(sp.isScaffoldFile(fey), false);
});

leg('isScaffoldFile: missing FEYNMAN.md and oversized FEYNMAN.md are content', () => {
  const dir = mkTmp('big');
  assert.equal(sp.isScaffoldFile(path.join(dir, 'FEYNMAN.md')), false);
  const fey = path.join(dir, 'FEYNMAN.md');
  fs.writeFileSync(fey, '# big\n\n' + '\n'.repeat(262145));
  assert.equal(sp.isScaffoldFile(fey), false);
});

leg('isScaffoldFile: notes.md is content', () => {
  const dir = mkTmp('notes');
  const p = path.join(dir, 'notes.md');
  fs.writeFileSync(p, '# notes\n');
  assert.equal(sp.isScaffoldFile(p), false);
});

leg('listContentFiles: only top-level non-scaffold .md, absolute, codepoint-sorted', () => {
  const dir = mkTmp('list');
  writeSection(dir, true);
  assert.deepEqual(sp.listContentFiles(dir), [path.join(dir, 'deal.md'), path.join(dir, 'notes.md')]);
});

leg('listContentFiles: a nonexistent dir returns []', () => {
  assert.deepEqual(sp.listContentFiles('/nonexistent-363-1/section'), []);
});

// ---------------------------------------------------------------------------
// CLI (argv only, never string-interpolated code: T-363.1-03)
// ---------------------------------------------------------------------------
leg('CLI --is-scaffold exits 0 for CONTEXT.md and 1 for notes.md', () => {
  assert.equal(runCli(['--is-scaffold', '/nonexistent-363-1/CONTEXT.md']).status, 0);
  const dir = mkTmp('cli-is');
  const p = path.join(dir, 'notes.md');
  fs.writeFileSync(p, '# notes\n');
  assert.equal(runCli(['--is-scaffold', p]).status, 1);
});

leg('CLI --count-content prints one count per dir in argument order', () => {
  const a = mkTmp('cli-a');
  const b = mkTmp('cli-b');
  writeSection(a, true);
  writeSection(b, false);
  const r = runCli(['--count-content', a, b]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '2\n0\n');
});

leg('CLI --list-content prints absolute content paths one per line', () => {
  const a = mkTmp('cli-list');
  writeSection(a, true);
  const r = runCli(['--list-content', a]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, path.join(a, 'deal.md') + '\n' + path.join(a, 'notes.md') + '\n');
});

leg('CLI with no arguments or an unknown flag exits 2 with usage on stderr', () => {
  const none = runCli([]);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /usage/i);
  const bad = runCli(['--bogus']);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /usage/i);
});

// ---------------------------------------------------------------------------
// Fences (run even when the module is missing, so they report on their own)
// ---------------------------------------------------------------------------
leg('fence: Part 8, no network or Brain token in the module source', () => {
  assert.ok(fs.existsSync(MODULE_ABS), 'module missing: ' + MODULE_REL);
  const lines = hygiene.nonCommentLines(MODULE_ABS);
  const forbidden = ['brain-client', 'fetch(', 'http://', 'https://', 'node:http', 'node:https'];
  for (const line of lines) {
    for (const tok of forbidden) {
      assert.equal(String(line).includes(tok), false, 'forbidden token "' + tok + '" in: ' + line);
    }
  }
});

leg('fence: no em-dash or en-dash in the module or either 363.1 test file', () => {
  const dashes = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];
  const targets = [
    MODULE_ABS,
    __filename,
    path.join(ROOT, 'tests/test-363.1-feynman-seed.cjs'),
  ];
  for (const t of targets) {
    assert.ok(fs.existsSync(t), 'missing: ' + t);
    const src = fs.readFileSync(t, 'utf8');
    for (const ch of dashes) assert.equal(src.includes(ch), false, 'dash in ' + t);
  }
});

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

if (failures > 0) {
  console.log('FAIL: ' + failures + ' leg(s) failed');
  process.exit(1);
}
console.log('PASS: all legs green');
process.exit(0);
