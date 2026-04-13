'use strict';

/**
 * Phase 80-06 Task 1 -- branding.cjs tests.
 *
 * Zero-dep Node assert pattern. Uses os.tmpdir() for fixtures.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const matter = require('gray-matter');

const branding = require('./branding.cjs');

function tmpFile(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'br-' + crypto.randomBytes(4).toString('hex') + '-'));
  const p = path.join(dir, 'artifact.md');
  fs.writeFileSync(p, contents);
  return p;
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    process.stdout.write('ok ' + name + '\n');
    passed++;
  } catch (e) {
    process.stderr.write('FAIL ' + name + '\n  ' + (e.stack || e.message) + '\n');
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test 1: injectBrandedFooter
// ---------------------------------------------------------------------------
test('Test 1: injectBrandedFooter appends and is idempotent', function () {
  const p = tmpFile('# Title\n\nBody text.\n');
  const ctx = {
    import_id: '2026-04-13-test',
    source_vault: '/vault',
    imported_at: '2026-04-13T10:00:00.000Z'
  };

  const first = branding.injectBrandedFooter(p, ctx);
  assert.equal(first, true, 'first injection returns true');
  let content = fs.readFileSync(p, 'utf8');
  assert.ok(content.includes('MindrianOS'), 'footer contains MindrianOS');
  assert.ok(content.includes('2026-04-13-test'), 'footer contains import_id');

  const second = branding.injectBrandedFooter(p, ctx);
  assert.equal(second, false, 'second injection returns false (idempotent)');
  const content2 = fs.readFileSync(p, 'utf8');
  const occurrences = (content2.match(/MindrianOS/g) || []).length;
  assert.equal(occurrences, 1, 'footer appears exactly once');
});

// ---------------------------------------------------------------------------
// Test 2: normalizeFrontmatter
// ---------------------------------------------------------------------------
test('Test 2: normalizeFrontmatter enforces canonical shape', function () {
  const p = tmpFile('---\ntitle: Old\ncustom_field: x\nauthor: Jane\n---\n\nBody.\n');
  const classification = { section: 'problem-definition' };
  const ctx = {
    import_id: '2026-04-13-test',
    source_path: 'notes/old.md',
    source_vault: '/vault'
  };

  const canonical = branding.normalizeFrontmatter(p, classification, ctx);

  assert.equal(canonical.title, 'Old', 'title preserved');
  assert.equal(canonical.section, 'problem-definition', 'section set');
  assert.equal(canonical.status, 'imported', 'status imported');
  assert.equal(canonical.imported_from, 'notes/old.md', 'imported_from set');
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(canonical.imported_at), 'imported_at is ISO-like');
  assert.equal(canonical.import_id, '2026-04-13-test', 'import_id set');
  assert.ok(Array.isArray(canonical.source_wikilinks), 'source_wikilinks is array');
  assert.ok(Array.isArray(canonical.tags), 'tags is array');
  assert.ok(canonical._source_frontmatter, '_source_frontmatter present');
  assert.equal(canonical._source_frontmatter.custom_field, 'x', 'custom_field preserved');
  assert.equal(canonical._source_frontmatter.author, 'Jane', 'author preserved');

  // Re-read and verify serialized form
  const reparsed = matter(fs.readFileSync(p, 'utf8'));
  assert.equal(reparsed.data.title, 'Old');
  assert.equal(reparsed.data.section, 'problem-definition');
  assert.equal(reparsed.data.status, 'imported');
});

// ---------------------------------------------------------------------------
// Test 3: promoteCalloutFields
// ---------------------------------------------------------------------------
test('Test 3: promoteCalloutFields produces callout blocks from _source_frontmatter', function () {
  // Seed with a post-normalize shape
  const fm = {
    title: 'Meeting',
    section: 'team-execution',
    status: 'imported',
    imported_from: 'm.md',
    imported_at: '2026-04-13T10:00:00.000Z',
    import_id: '2026-04-13-test',
    source_wikilinks: [],
    tags: [],
    _source_frontmatter: {
      author: 'Jane Doe',
      attendees: ['Jane Doe', 'John Roe'],
      date: '2026-01-15'
    }
  };
  const raw = matter.stringify('Meeting body.\n', fm);
  const p = tmpFile(raw);

  const changed = branding.promoteCalloutFields(p);
  assert.equal(changed, true, 'promotion returned true');

  const content = fs.readFileSync(p, 'utf8');
  assert.ok(content.includes('<!-- destijl-callout -->'), 'callout marker present');
  assert.ok(content.includes('> [!author] Jane Doe'), 'author callout');
  assert.ok(content.includes('> [!attendees] Jane Doe, John Roe'), 'attendees callout');
  assert.ok(content.includes('> [!date] 2026-01-15'), 'date callout');

  // Idempotent
  const again = branding.promoteCalloutFields(p);
  assert.equal(again, false, 'second promotion returns false');
  const content2 = fs.readFileSync(p, 'utf8');
  const markers = (content2.match(/destijl-callout/g) || []).length;
  assert.equal(markers, 1, 'exactly one callout marker');
});

// ---------------------------------------------------------------------------
// Test 4: applyBranding idempotent end-to-end
// ---------------------------------------------------------------------------
test('Test 4: applyBranding is fully idempotent on second run', function () {
  const p = tmpFile('---\ntitle: Notes\nauthor: Jane\ndate: 2026-02-01\ncustom: keep\n---\n\n# Heading\n\nBody paragraph.\n');
  const cls = { section: 'market-analysis' };
  const ctx = {
    import_id: '2026-04-13-test',
    source_path: 'notes/n.md',
    source_vault: '/vault',
    imported_at: '2026-04-13T10:00:00.000Z'
  };

  branding.applyBranding(p, cls, ctx);
  const first = fs.readFileSync(p, 'utf8');
  branding.applyBranding(p, cls, ctx);
  const second = fs.readFileSync(p, 'utf8');

  assert.equal(first, second, 'second applyBranding produced identical content');

  // Checks
  assert.ok(first.includes('MindrianOS'), 'footer present');
  assert.ok(first.includes('<!-- destijl-callout -->'), 'callout marker present');
  assert.ok(first.includes('> [!author] Jane'), 'author callout rendered');
  assert.ok(first.includes('> [!date] 2026-02-01'), 'date callout rendered');

  const fmParsed = matter(first);
  assert.equal(fmParsed.data.section, 'market-analysis');
  assert.equal(fmParsed.data.status, 'imported');
  assert.ok(fmParsed.data._source_frontmatter, '_source_frontmatter preserved');
  assert.equal(fmParsed.data._source_frontmatter.custom, 'keep', 'non-canonical field preserved');

  const footerOccurrences = (first.match(/MindrianOS/g) || []).length;
  assert.equal(footerOccurrences, 1, 'footer appears exactly once after double apply');
});

// ---------------------------------------------------------------------------
// Test 5: enricher hook -- after enrichRoom runs, each file has branding
// ---------------------------------------------------------------------------
test('Test 5: enrichRoom hook applies branding to routed files', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'br-enrich-' + crypto.randomBytes(4).toString('hex') + '-'));
  const roomDir = path.join(dir, 'room');
  const section = path.join(roomDir, 'problem-definition', 'onboarding');
  fs.mkdirSync(section, { recursive: true });
  const artifactPath = path.join(section, 'onboarding.md');
  fs.writeFileSync(
    artifactPath,
    '---\ntitle: Onboarding\nauthor: Jane\n---\n\n# Onboarding\n\nBody.\n'
  );

  const manifest = {
    import_id: '2026-04-13-enrich-test',
    source_vault: '/vault',
    destination_room: roomDir,
    stage_states: { enrich: {} },
    warnings: [],
    people: [],
    files: [
      {
        id: 'f1',
        source_path: 'notes/onboarding.md',
        destination_folder: path.join('problem-definition', 'onboarding'),
        destination_path: path.join('problem-definition', 'onboarding', 'onboarding.md'),
        destination_abs_path: artifactPath,
        destination_section: 'problem-definition',
        classification: { section: 'problem-definition', decision: 'AUTO', confidence: 0.9 },
        source_wikilinks: []
      }
    ]
  };

  const { enrichRoom } = require('./enricher.cjs');
  enrichRoom(manifest, { roomDir: roomDir });

  const content = fs.readFileSync(artifactPath, 'utf8');
  assert.ok(content.includes('MindrianOS'), 'branded footer present after enrichRoom');
  const fm = matter(content).data;
  assert.equal(fm.status, 'imported', 'canonical status set');
  assert.equal(fm.section, 'problem-definition', 'section normalized');
  assert.equal(fm.import_id, '2026-04-13-enrich-test', 'import_id in frontmatter');
  assert.ok(content.includes('> [!author] Jane'), 'author callout promoted');

  fs.rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Test 6: no em-dashes
// ---------------------------------------------------------------------------
test('Test 6: branding.cjs and branding.test.cjs contain no em-dashes', function () {
  const emDash = '\u2014';
  const mod = fs.readFileSync(path.join(__dirname, 'branding.cjs'), 'utf8');
  const tst = fs.readFileSync(__filename, 'utf8');
  assert.equal(mod.indexOf(emDash), -1, 'branding.cjs has no em-dash');
  assert.equal(tst.indexOf(emDash), -1, 'branding.test.cjs has no em-dash');
});

// ---------------------------------------------------------------------------
process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
process.stdout.write('all passing\n');
