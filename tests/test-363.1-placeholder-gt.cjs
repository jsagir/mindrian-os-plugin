'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363.1 Plan 04 Task 2 (D-07, B51-06) -- a placeholder governing
 * thought earns no governing-thought health and never reaches `check`.
 *
 * translational-capital-lab showed ten sections at a `check` health glyph on
 * "Business Model synthesizes 2 artifacts into a coherent argument for this
 * section of the venture." A sentence that asserts nothing was being paid
 * +0.3, and N was inflated because CONTEXT.md / FEYNMAN.md counted as
 * artifacts. Legs:
 *   1. the placeholder shape has ONE definition (render + regex + predicate)
 *      in lib/core/folder-memory-shared.cjs, and the generator renders its
 *      fallback through it (drift pin);
 *   2. computeHealthScore zeroes the GT component AND clamps to 0.69, because
 *      zeroing 0.3 alone still leaves 0.7 reachable and classifyHealth's
 *      check threshold is >= 0.7;
 *   3. parseMintoMd reads the governing_thought_placeholder frontmatter flag;
 *   4. the generator writes the flag, never counts scaffold as artifacts, and
 *      skips a scaffold-only section.
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
const shared = require(path.join(ROOT, 'lib/core/folder-memory-shared.cjs'));
const { classifyHealth } = require(path.join(ROOT, 'lib/core/statusline-cache.cjs'));
const generator = require(path.join(ROOT, 'scripts/vault-section-minto-generator.cjs'));
const timelineRunner = require(path.join(ROOT, 'lib/core/feynman/timeline-runner.cjs'));
const dialMemory = require(path.join(ROOT, 'lib/core/feynman/dial-memory-renderer.cjs'));
const roomBirth = require(path.join(ROOT, 'lib/core/navigation/room-birth.cjs'));

const GENERATOR = path.join(ROOT, 'scripts', 'vault-section-minto-generator.cjs');
const FIXTURE_ROOM = path.join(ROOT, 'test-fixtures', 'feynman', 'sections', 'fixture-small');
const SECTION = 'problem-definition';

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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'test-363.1-placeholder-gt-' + label + '-'));
  tmpRoots.push(d);
  return d;
}

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

const PLACEHOLDER_2 = 'Business Model synthesizes 2 artifacts into a coherent argument for this section of the venture.';

// ---------------------------------------------------------------------------
// 1. Placeholder shape: render, regex, predicate
// ---------------------------------------------------------------------------
leg('renderPlaceholderGoverningThought renders the exact fallback (plural and singular)', () => {
  assert.equal(shared.renderPlaceholderGoverningThought('Business Model', 2), PLACEHOLDER_2);
  assert.equal(
    shared.renderPlaceholderGoverningThought('Business Model', 1),
    'Business Model synthesizes 1 artifact into a coherent argument for this section of the venture.'
  );
});

leg('isPlaceholderGoverningThought: true for the fallback shape, false for real claims', () => {
  const p = shared.isPlaceholderGoverningThought;
  assert.equal(p(PLACEHOLDER_2), true);
  assert.equal(p(shared.renderPlaceholderGoverningThought('Business Model', 1)), true);
  assert.equal(p('Legal Ip synthesizes 14 artifacts into a coherent argument for this section of the venture.'), true);
  assert.equal(p('Hospitals will pay for faster triage.'), false);
  assert.equal(p('Our wedge synthesizes demand signals from 3 hospital pilots.'), false);
  assert.equal(p(''), false);
  assert.equal(p(null), false);
  assert.equal(p(undefined), false);
  assert.equal(p(42), false);
});

leg('PLACEHOLDER_GOVERNING_THOUGHT_RE is exported and anchored', () => {
  assert.ok(shared.PLACEHOLDER_GOVERNING_THOUGHT_RE instanceof RegExp);
  assert.equal(shared.PLACEHOLDER_GOVERNING_THOUGHT_RE.test(PLACEHOLDER_2 + ' It also proves demand.'), false);
});

leg('generator re-exports the same isPlaceholderGoverningThought (D-07 export surface)', () => {
  assert.equal(typeof generator.isPlaceholderGoverningThought, 'function');
  assert.equal(generator.isPlaceholderGoverningThought, shared.isPlaceholderGoverningThought);
});

leg('drift pin: the generator fallback satisfies the shared predicate', () => {
  const gt = generator.deriveGoverningThought({ name: 'business-model' }, [{}, {}]);
  assert.equal(gt, PLACEHOLDER_2);
  assert.equal(shared.isPlaceholderGoverningThought(gt), true);
  const one = generator.deriveGoverningThought({ name: 'legal-ip' }, [{}]);
  assert.equal(shared.isPlaceholderGoverningThought(one), true);
});

// ---------------------------------------------------------------------------
// 2. Health score
// ---------------------------------------------------------------------------
leg('placeholder GT with middling components scores about 0.48 and classifies warn', () => {
  const s = shared.computeHealthScore({
    governing_thought: PLACEHOLDER_2,
    arguments_count: 2,
    evidence_density: 0.5,
    mece_status: 'warn',
    is_stale: false,
  });
  assert.ok(Math.abs(s - 0.48333) < 0.01, 'score ' + s);
  assert.equal(classifyHealth(s), 'warn');
});

leg('placeholder GT with every other component maxed is capped below the check threshold', () => {
  const s = shared.computeHealthScore({
    governing_thought: shared.renderPlaceholderGoverningThought('Business Model', 3),
    arguments_count: 3,
    evidence_density: 1,
    mece_status: 'pass',
    is_stale: false,
  });
  assert.ok(s <= 0.69 + 1e-9, 'score ' + s);
  assert.ok(s < 0.7);
  assert.equal(classifyHealth(s), 'warn');
});

leg('a real GT with every component maxed still scores 1.0 and check (no regression)', () => {
  const s = shared.computeHealthScore({
    governing_thought: 'Hospitals will pay for faster triage.',
    arguments_count: 3,
    evidence_density: 1,
    mece_status: 'pass',
    is_stale: false,
  });
  assert.equal(s, 1);
  assert.equal(classifyHealth(s), 'check');
});

leg('a real GT carrying governing_thought_placeholder: true is capped too', () => {
  const s = shared.computeHealthScore({
    governing_thought: 'Hospitals will pay for faster triage.',
    governing_thought_placeholder: true,
    arguments_count: 3,
    evidence_density: 1,
    mece_status: 'pass',
    is_stale: false,
  });
  assert.ok(s <= 0.69 + 1e-9, 'score ' + s);
  assert.equal(classifyHealth(s), 'warn');
});

leg('the flag can only lower a score: placeholder: false on a placeholder-shaped GT still zeroes and caps', () => {
  const s = shared.computeHealthScore({
    governing_thought: PLACEHOLDER_2,
    governing_thought_placeholder: false,
    arguments_count: 3,
    evidence_density: 1,
    mece_status: 'pass',
    is_stale: false,
  });
  assert.ok(s < 0.7, 'score ' + s);
});

leg('PLACEHOLDER_HEALTH_CAP is exported and sits under the check threshold', () => {
  assert.equal(shared.PLACEHOLDER_HEALTH_CAP, 0.69);
});

// ---------------------------------------------------------------------------
// 3. parseMintoMd flag
// ---------------------------------------------------------------------------
function mintoWith(extraLines) {
  return [
    '---',
    'schema_version: "1"',
    'type: section-minto',
    'section: business-model',
    'governing_thought: "' + PLACEHOLDER_2 + '"',
    ...extraLines,
    '---',
    '',
    '# Business Model -- Minto Reasoning',
    '',
  ].join('\n');
}

leg('parseMintoMd reads governing_thought_placeholder: true as boolean true', () => {
  const out = shared.parseMintoMd(mintoWith(['governing_thought_placeholder: true']));
  assert.equal(out.governing_thought_placeholder, true);
});

leg('parseMintoMd without the key reports false', () => {
  const out = shared.parseMintoMd(mintoWith([]));
  assert.equal(out.governing_thought_placeholder, false);
});

// ---------------------------------------------------------------------------
// 4. Generator end to end
// ---------------------------------------------------------------------------
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function runGen(args) {
  return spawnSync(process.execPath, [GENERATOR].concat(args), {
    cwd: ROOT,
    env: Object.assign({}, process.env, { MINTO_FROZEN_DATE: '2026-04-14' }),
    encoding: 'utf8',
  });
}

leg('generator fallthrough --write: flag written, scaffold not counted or listed as a source', () => {
  const room = path.join(mkTmp('gen'), 'fixture-small');
  copyDir(FIXTURE_ROOM, room);
  const sec = path.join(room, SECTION);
  fs.writeFileSync(path.join(sec, 'CONTEXT.md'), '# CONTEXT\n\nSection contract.\n');
  fs.writeFileSync(path.join(sec, 'FEYNMAN.md'), seededFeynman(SECTION));
  const r = runGen(['--write', room, '--section', SECTION]);
  assert.equal(r.status, 0, r.stderr);
  const minto = fs.readFileSync(path.join(sec, 'MINTO.md'), 'utf8');
  assert.match(minto, /^governing_thought_placeholder: true$/m);
  const sourcesLine = (minto.match(/^sources: \[.*\]$/m) || [''])[0];
  assert.ok(sourcesLine.length > 0, 'sources line present');
  assert.ok(!/CONTEXT\.md/.test(sourcesLine), sourcesLine);
  assert.ok(!/FEYNMAN\.md/.test(sourcesLine), sourcesLine);
  const gt = (minto.match(/^governing_thought: "(.*)"$/m) || [])[1];
  assert.ok(gt && /synthesizes 3 artifacts /.test(gt), 'governing thought: ' + gt);
  // The written MINTO round-trips through the parser and health scorer.
  const parsed = shared.parseMintoMd(minto);
  assert.equal(parsed.governing_thought_placeholder, true);
});

leg('generator: a MINTO whose governing thought is real carries no placeholder flag line', () => {
  // The narrative path writes a real governing thought; that MINTO must stay
  // byte-identical to today (no flag line at all).
  const room = path.join(mkTmp('narr'), 'fixture-small');
  copyDir(FIXTURE_ROOM, room);
  const narrative = path.join(ROOT, 'test-fixtures', 'feynman', 'narratives', 'fixture-small.json');
  const r = runGen(['--write', room, '--section', SECTION, '--narrative', narrative]);
  assert.equal(r.status, 0, r.stderr);
  const minto = fs.readFileSync(path.join(room, SECTION, 'MINTO.md'), 'utf8');
  assert.ok(!/^governing_thought_placeholder:/m.test(minto), 'unexpected flag line in a real-GT MINTO');
});

leg('generator: a scaffold-only section is skipped as empty and gets no MINTO.md', () => {
  const room = path.join(mkTmp('empty'), 'fixture-small');
  copyDir(FIXTURE_ROOM, room);
  const empty = path.join(room, 'market-analysis');
  fs.mkdirSync(empty, { recursive: true });
  fs.writeFileSync(path.join(empty, 'ROOM.md'), '# ROOM\n');
  fs.writeFileSync(path.join(empty, 'CONTEXT.md'), '# CONTEXT\n\nSection contract.\n');
  fs.writeFileSync(path.join(empty, 'FEYNMAN.md'), seededFeynman('market-analysis'));
  const r = runGen([room, '--section', 'market-analysis']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('skip market-analysis: empty (no artifacts)'), r.stdout);
  assert.equal(fs.existsSync(path.join(empty, 'MINTO.md')), false);
});

leg('the structural payload field governing_thought_placeholder is left as it was', () => {
  const src = fs.readFileSync(GENERATOR, 'utf8');
  assert.equal((src.match(/governing_thought_placeholder: governingPlaceholder/g) || []).length, 1);
});

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}
if (failures > 0) {
  console.log('\n' + failures + ' leg(s) failed');
  process.exit(1);
}
console.log('\nall legs passed');
