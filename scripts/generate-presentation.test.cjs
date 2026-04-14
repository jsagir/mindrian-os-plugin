#!/usr/bin/env node
'use strict';

/**
 * Phase 82-04: fixture-based tests for scripts/generate-presentation.cjs.
 *
 * Exercises the three production changes from plans 82-01, 82-02, 82-03:
 *   - sec.artifacts populated with {filename,title,content,excerpt,date}
 *   - per-artifact 20 KB cap with truncation banner
 *   - per-room 2 MB injected-markdown cap with stderr warning + bloatNotice
 *   - SYSTEM_FILES exclusion via room-scanner source of truth
 *   - sec.summary upgrade via collectSectionMinto governing_thought
 *   - title-extraction fallback when MINTO.md is absent
 *   - order within section (date descending)
 *   - title preference order (frontmatter > h1 > basename)
 *   - backwards compatibility against fixture-medium
 *
 * Zero test frameworks. Node built-in assert only. CJS only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GENERATOR_PATH = path.join(REPO_ROOT, 'scripts', 'generate-presentation.cjs');
const gen = require(GENERATOR_PATH);

const FIXTURE_SMALL = path.join(
  REPO_ROOT, 'test-fixtures', 'feynman', 'sections', 'fixture-small'
);
const FIXTURE_MEDIUM = path.join(
  REPO_ROOT, 'test-fixtures', 'feynman', 'sections', 'fixture-medium'
);

// -- Harness --

const tests = [];
const cleanupPaths = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function makeFixtureRoot() {
  const dir = path.join(
    os.tmpdir(),
    'gsd-82-04-' + crypto.randomUUID()
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ROOM.md'), '# Test Room\n');
  fs.writeFileSync(path.join(dir, 'STATE.md'), '# State\n');
  cleanupPaths.push(dir);
  return dir;
}

function writeFile(absPath, content) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

function cleanupAll() {
  for (const p of cleanupPaths) {
    try {
      fs.rmSync(p, { recursive: true, force: true });
    } catch (_) { /* ignore */ }
  }
}

// -- Test 1: artifact shape on fixture-small --

test('artifact shape on fixture-small', () => {
  const result = gen.collectSections(FIXTURE_SMALL);
  assert.ok(Array.isArray(result.sections), 'sections is not an array');
  assert.ok(result.sections.length > 0, 'fixture-small has zero sections');

  for (const sec of result.sections) {
    if (sec.entryCount === 0) continue;
    assert.ok(Array.isArray(sec.artifacts), 'sec.artifacts is not an array');
    assert.strictEqual(
      sec.artifacts.length,
      sec.entryCount,
      'artifacts.length != entryCount for section ' + sec.id
    );
    for (const art of sec.artifacts) {
      assert.strictEqual(typeof art.filename, 'string', 'filename not string');
      assert.ok(art.filename.length > 0, 'filename empty');
      assert.strictEqual(typeof art.title, 'string', 'title not string');
      assert.ok(art.title.length > 0, 'title empty on ' + art.filename);
      assert.strictEqual(typeof art.content, 'string', 'content not string');
      assert.ok(art.content.length > 0, 'content empty on ' + art.filename);
      assert.strictEqual(typeof art.excerpt, 'string', 'excerpt not string');
      assert.strictEqual(typeof art.date, 'string', 'date not string');
      assert.ok(
        /^\d{4}-\d{2}-\d{2}$/.test(art.date),
        'date not YYYY-MM-DD: ' + art.date + ' on ' + art.filename
      );
    }
  }
});

// -- Test 2: SYSTEM_FILES exclusion --

test('SYSTEM_FILES exclusion', () => {
  const root = makeFixtureRoot();
  const sec = path.join(root, 'problem-definition');
  writeFile(path.join(sec, 'ROOM.md'), '# Section Room\n');
  writeFile(path.join(sec, 'STATE.md'), '# Section State\n');
  writeFile(path.join(sec, 'MINTO.md'), '# Minto\n');
  writeFile(path.join(sec, 'CLAUDE.md'), '# Claude\n');
  writeFile(path.join(sec, 'action-items.md'), '# Action items\n');
  writeFile(
    path.join(sec, 'real-artifact.md'),
    '# Real Artifact\n\nThis one should survive.\n'
  );

  const result = gen.collectSections(root);
  const section = result.sections.find(s => s.id === 'problem-definition');
  assert.ok(section, 'problem-definition section missing');
  assert.strictEqual(
    section.artifacts.length,
    1,
    'expected 1 artifact, got ' + section.artifacts.length +
      ': ' + section.artifacts.map(a => a.filename).join(',')
  );
  assert.strictEqual(section.artifacts[0].filename, 'real-artifact.md');
});

// -- Test 3: per-artifact 20 KB cap --

test('per-artifact 20 KB cap with truncation banner', () => {
  const root = makeFixtureRoot();
  const sec = path.join(root, 'problem-definition');
  // Predictable first 200 chars so we can verify the excerpt is derived
  // from the ORIGINAL body (not the truncated content). Then pad with
  // filler well past the 20 KB cap.
  const head = '# Huge Article\n\n' +
    'Opening paragraph alpha beta gamma delta epsilon zeta eta theta iota kappa.\n\n';
  const filler = 'lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(600);
  const body = head + filler;
  assert.ok(Buffer.byteLength(body, 'utf8') > 25000, 'synthetic body < 25 KB');
  writeFile(path.join(sec, 'huge.md'), body);

  const result = gen.collectSections(root);
  const section = result.sections.find(s => s.id === 'problem-definition');
  assert.ok(section, 'section missing');
  assert.strictEqual(section.artifacts.length, 1);
  const art = section.artifacts[0];

  // Content size: truncated near 20 KB plus banner. Allow 400 bytes of slack
  // for the banner text and backoff to paragraph boundary.
  const bytes = Buffer.byteLength(art.content, 'utf8');
  assert.ok(
    bytes <= 20480 + 400,
    'content bytes ' + bytes + ' exceeds 20 KB + banner slack'
  );
  assert.ok(
    art.content.includes('truncated at 20 KB'),
    'truncation banner missing'
  );

  // Excerpt is derived from the ORIGINAL body (first 200 chars after
  // stripping the first h1). The word "alpha" from our seed should appear.
  assert.ok(
    art.excerpt.includes('alpha'),
    'excerpt missing seed word "alpha": ' + art.excerpt
  );
});

// -- Test 4: per-room 2 MB cap (subprocess for stderr) --

test('per-room 2 MB cap with stderr warning and bloatNotice', () => {
  const root = makeFixtureRoot();
  const sec = path.join(root, 'problem-definition');
  // 250 artifacts * ~10 KB each = ~2.5 MB raw. Each one stays under the
  // per-artifact 20 KB cap so the only cap that can fire is the per-room
  // 2 MiB ceiling.
  const filler = 'x'.repeat(10000);
  for (let i = 0; i < 250; i++) {
    const name = 'art-' + String(i).padStart(3, '0') + '.md';
    writeFile(
      path.join(sec, name),
      '# Artifact ' + i + '\n\n' + filler + '\n'
    );
  }

  // Spawn subprocess to capture stderr cleanly.
  const script = [
    "const gen = require(" + JSON.stringify(GENERATOR_PATH) + ");",
    "const result = gen.collectSections(" + JSON.stringify(root) + ");",
    "process.stdout.write(JSON.stringify({",
    "  bloatNotice: result.bloatNotice,",
    "  emptyContentCount: result.sections.reduce((acc, s) => acc + s.artifacts.filter(a => a.content === '').length, 0),",
    "  totalArtifacts: result.sections.reduce((acc, s) => acc + s.artifacts.length, 0),",
    "  firstArtifact: result.sections[0] && result.sections[0].artifacts[0] ? {",
    "    filename: result.sections[0].artifacts[0].filename,",
    "    title: result.sections[0].artifacts[0].title,",
    "    excerpt: result.sections[0].artifacts[0].excerpt,",
    "    date: result.sections[0].artifacts[0].date,",
    "  } : null,",
    "}));",
  ].join('\n');

  const res = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf-8',
    cwd: REPO_ROOT,
  });
  assert.strictEqual(
    res.status,
    0,
    'subprocess exited non-zero: ' + res.stderr
  );

  assert.ok(
    res.stderr.includes('WARN: room exceeded 2 MB injected-markdown cap'),
    'stderr missing WARN line: ' + res.stderr
  );
  assert.ok(
    /artifacts dropped/.test(res.stderr),
    'stderr missing "artifacts dropped" phrase'
  );

  const out = JSON.parse(res.stdout);
  assert.ok(
    typeof out.bloatNotice === 'string' && out.bloatNotice.length > 0,
    'bloatNotice not populated'
  );
  assert.ok(
    out.bloatNotice.includes('truncated or omitted'),
    'bloatNotice missing expected phrase: ' + out.bloatNotice
  );
  assert.strictEqual(out.totalArtifacts, 250, 'expected 250 artifacts in output');
  assert.ok(
    out.emptyContentCount >= 30,
    'expected at least 30 artifacts with empty content, got ' + out.emptyContentCount
  );
  assert.ok(out.firstArtifact, 'first artifact missing');
  // Metadata for over-cap artifacts is still populated on the surviving
  // sidebar entries.
  assert.ok(out.firstArtifact.filename.length > 0, 'first filename empty');
  assert.ok(out.firstArtifact.title.length > 0, 'first title empty');
});

// -- Test 5: summary upgrade with MINTO --

test('summary upgrade from collectSectionMinto', () => {
  const root = makeFixtureRoot();
  const sec = path.join(root, 'problem-definition');
  writeFile(
    path.join(sec, 'MINTO.md'),
    '---\ngoverning_thought: "test governing thought from 82-04"\n---\n\n# Section MINTO body\n'
  );
  writeFile(
    path.join(sec, 'real-artifact.md'),
    '# Unrelated H1\n\nBody text.\n'
  );

  const result = gen.collectSections(root);
  const section = result.sections.find(s => s.id === 'problem-definition');
  assert.ok(section, 'section missing');
  assert.strictEqual(
    section.summary,
    'test governing thought from 82-04',
    'summary not upgraded from MINTO governing_thought: got ' + section.summary
  );
});

// -- Test 6: summary fallback without MINTO --

test('summary fallback via title extraction when MINTO absent', () => {
  const root = makeFixtureRoot();
  const sec = path.join(root, 'problem-definition');
  writeFile(
    path.join(sec, 'real-artifact.md'),
    '# My Artifact Title\n\nBody text.\n'
  );

  const result = gen.collectSections(root);
  const section = result.sections.find(s => s.id === 'problem-definition');
  assert.ok(section, 'section missing');
  assert.strictEqual(
    section.summary,
    'My Artifact Title',
    'summary fallback did not produce the h1: got ' + section.summary
  );
});

// -- Test 7: order within section (date descending) --

test('order within section by date descending', () => {
  const root = makeFixtureRoot();
  const sec = path.join(root, 'problem-definition');
  writeFile(
    path.join(sec, 'a.md'),
    '---\ndate: 2026-04-10\n---\n\n# A\n\nBody a.\n'
  );
  writeFile(
    path.join(sec, 'b.md'),
    '---\ndate: 2026-04-12\n---\n\n# B\n\nBody b.\n'
  );
  writeFile(
    path.join(sec, 'c.md'),
    '---\ndate: 2026-04-11\n---\n\n# C\n\nBody c.\n'
  );

  const result = gen.collectSections(root);
  const section = result.sections.find(s => s.id === 'problem-definition');
  assert.ok(section, 'section missing');
  const order = section.artifacts.map(a => a.filename);
  assert.deepStrictEqual(
    order,
    ['b.md', 'c.md', 'a.md'],
    'unexpected order: ' + order.join(',')
  );
});

// -- Test 8: title extraction preference order --

test('title extraction preference: frontmatter > h1 > basename', () => {
  const root = makeFixtureRoot();
  const sec = path.join(root, 'problem-definition');
  writeFile(
    path.join(sec, 'one.md'),
    '---\ntitle: "Frontmatter Title"\ndate: 2026-04-10\n---\n\n# H1 Title\n\nBody.\n'
  );
  writeFile(
    path.join(sec, 'two.md'),
    '---\ndate: 2026-04-09\n---\n\n# H1 Only\n\nBody.\n'
  );
  writeFile(
    path.join(sec, 'three-basename.md'),
    '---\ndate: 2026-04-08\n---\n\nPlain body with no heading.\n'
  );

  const result = gen.collectSections(root);
  const section = result.sections.find(s => s.id === 'problem-definition');
  assert.ok(section, 'section missing');
  const byName = {};
  for (const art of section.artifacts) byName[art.filename] = art.title;
  assert.strictEqual(byName['one.md'], 'Frontmatter Title', 'frontmatter title not preferred');
  assert.strictEqual(byName['two.md'], 'H1 Only', 'h1 title not used as fallback');
  assert.strictEqual(
    byName['three-basename.md'],
    'three-basename',
    'basename fallback wrong: got ' + byName['three-basename.md']
  );
});

// -- Test 9: backwards compat on fixture-medium --

test('backwards compat regression on fixture-medium', () => {
  const result = gen.collectSections(FIXTURE_MEDIUM);
  assert.ok(Array.isArray(result.sections), 'sections not an array');
  assert.ok(result.sections.length > 0, 'fixture-medium has zero sections');
  // No per-room cap fired on fixture-medium.
  assert.strictEqual(
    result.bloatNotice,
    '',
    'fixture-medium fired the per-room cap unexpectedly: ' + result.bloatNotice
  );
  for (const sec of result.sections) {
    assert.strictEqual(
      sec.entryCount,
      sec.artifacts.length,
      'entryCount != artifacts.length for ' + sec.id
    );
    if (sec.entryCount > 0) {
      assert.ok(
        typeof sec.summary === 'string' && sec.summary.length > 0,
        'summary empty on ' + sec.id
      );
    }
  }
});

// -- Runner --

function run() {
  process.stdout.write('1..' + tests.length + '\n');
  let passed = 0;
  let failed = 0;
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const n = i + 1;
    try {
      t.fn();
      process.stdout.write('ok ' + n + ' - ' + t.name + '\n');
      passed += 1;
    } catch (err) {
      failed += 1;
      process.stdout.write('not ok ' + n + ' - ' + t.name + '\n');
      process.stdout.write('  ' + (err && err.stack ? err.stack : String(err)) + '\n');
    }
  }
  cleanupAll();
  process.stdout.write(
    '\n# ' + tests.length + ' tests, ' + passed + ' passed, ' + failed + ' failed\n'
  );
  process.exit(failed > 0 ? 1 : 0);
}

run();
