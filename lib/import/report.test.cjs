'use strict';

/**
 * Phase 80 Plan 80-05 -- lib/import/report.cjs tests.
 *
 * Covers:
 *   1. generateImportReport returns a markdown string with all required sections
 *   2. Summary counts match manifest decision breakdown
 *   3. Main-topic extraction: top-2 sections join
 *   4. Main-topic extraction: single-section dominance (> 60%)
 *   5. Main-topic extraction: --topic override
 *   6. UNDONE: true frontmatter when manifest.undo.is_undone
 *   7. /mos: Usability Check placeholder section is always present
 */

const assert = require('node:assert/strict');
const {
  generateImportReport,
  extractMainTopicSlug,
  countDecisions
} = require('./report.cjs');

function makeManifest(overrides) {
  return Object.assign({
    schema_version: '1.0',
    import_id: '2026-04-13-problem-solution',
    source_vault: '/tmp/src',
    status: 'complete',
    main_topic: null,
    files: [],
    people: [],
    meetings: [],
    warnings: [],
    collisions: [],
    undo: { is_undone: false }
  }, overrides || {});
}

function file(source_path, section, confidence, decision, destination) {
  return {
    source_path: source_path,
    destination_path: destination || null,
    classification: {
      section: section,
      confidence: confidence,
      decision: decision,
      evidence: 'test'
    }
  };
}

// ---------------------------------------------------------------------------
// Test 1: required sections present
// ---------------------------------------------------------------------------
(function testRequiredSections() {
  const m = makeManifest({
    files: [
      file('a.md', 'problem-definition', 0.9, 'AUTO', 'problem-definition/a/a.md'),
      file('b.md', 'business-model', 0.5, 'SUGGEST', 'inbox/suggested/b/b.md')
    ],
    people: [{ name: 'Jane Doe', role_guess: 'core-team', mention_files: ['f1'], profile_path: 'team/core-team/jane-doe/jane-doe.md' }],
    meetings: [{ detected_date: '2026-04-10', detection_signals: ['filename-date'], routed_to: 'meetings/2026-04-10-kickoff/2026-04-10-kickoff.md' }]
  });
  const out = generateImportReport(m);
  assert.equal(typeof out, 'string');
  assert.ok(out.startsWith('---\n'), 'starts with frontmatter');
  assert.ok(/\ndate: 2026-04-13\n/.test(out), 'date frontmatter');
  assert.ok(/\n# Import Report -- /.test(out), 'H1 present');
  assert.ok(/\n## Summary\n/.test(out), 'Summary section');
  assert.ok(/\n## Routing Table\n/.test(out), 'Routing Table section');
  assert.ok(/\n## People Detected\n/.test(out), 'People Detected section');
  assert.ok(/\n## Meetings Detected\n/.test(out), 'Meetings Detected section');
  assert.ok(/\n## Warnings\n/.test(out), 'Warnings section');
  assert.ok(/\n## Manifest Reference\n/.test(out), 'Manifest Reference section');
  assert.ok(out.indexOf('Jane Doe') !== -1, 'person name rendered');
  assert.ok(out.indexOf('2026-04-10') !== -1, 'meeting date rendered');
  process.stdout.write('ok required sections\n');
})();

// ---------------------------------------------------------------------------
// Test 2: Summary counts
// ---------------------------------------------------------------------------
(function testSummaryCounts() {
  const m = makeManifest({
    files: [
      file('a.md', 'problem-definition', 0.9, 'AUTO'),
      file('b.md', 'problem-definition', 0.85, 'AUTO'),
      file('c.md', 'business-model', 0.6, 'SUGGEST'),
      file('d.md', 'inbox', 0.3, 'INBOX')
    ],
    people: [{ name: 'P1' }, { name: 'P2' }, { name: 'P3' }],
    meetings: [{ detected_date: '2026-04-01' }]
  });
  const out = generateImportReport(m);
  assert.ok(out.indexOf('- 4 files ingested') !== -1, 'total files');
  assert.ok(out.indexOf('- 2 auto-routed') !== -1, 'auto count');
  assert.ok(out.indexOf('- 1 in inbox/suggested') !== -1, 'suggest count');
  assert.ok(out.indexOf('- 1 in inbox/unclassified') !== -1, 'inbox count');
  assert.ok(out.indexOf('- 3 people detected') !== -1, 'people count');
  assert.ok(out.indexOf('- 1 meetings detected') !== -1, 'meetings count');
  const c = countDecisions(m.files);
  assert.deepEqual(c, { auto: 2, sugg: 1, inbox: 1 });
  process.stdout.write('ok summary counts\n');
})();

// ---------------------------------------------------------------------------
// Test 3: Main-topic extraction -- top-2 sections
// ---------------------------------------------------------------------------
(function testMainTopicTopTwo() {
  const m = makeManifest({
    files: [
      file('a.md', 'problem-definition', 0.9, 'AUTO'),
      file('b.md', 'problem-definition', 0.9, 'AUTO'),
      file('c.md', 'solution-design', 0.9, 'AUTO'),
      file('d.md', 'solution-design', 0.9, 'AUTO')
    ]
  });
  const slug = extractMainTopicSlug(m);
  assert.equal(slug, 'problem-definition-solution-design', 'joins top two');
  process.stdout.write('ok main topic top-two\n');
})();

// ---------------------------------------------------------------------------
// Test 4: Single-section dominance (> 60%)
// ---------------------------------------------------------------------------
(function testMainTopicDominance() {
  const m = makeManifest({
    files: [
      file('a.md', 'problem-definition', 0.9, 'AUTO'),
      file('b.md', 'problem-definition', 0.9, 'AUTO'),
      file('c.md', 'problem-definition', 0.9, 'AUTO'),
      file('d.md', 'solution-design', 0.9, 'AUTO')
    ]
  });
  const slug = extractMainTopicSlug(m);
  assert.equal(slug, 'problem-definition', 'dominant section only');
  process.stdout.write('ok main topic dominance\n');
})();

// ---------------------------------------------------------------------------
// Test 5: --topic override
// ---------------------------------------------------------------------------
(function testTopicOverride() {
  const m = makeManifest({
    files: [file('a.md', 'problem-definition', 0.9, 'AUTO')]
  });
  const slug = extractMainTopicSlug(m, 'My Custom Label');
  assert.equal(slug, 'my-custom-label', 'override slugified');
  const out = generateImportReport(m, { topic: 'My Custom Label' });
  assert.ok(/main_topic: my-custom-label/.test(out), 'override in frontmatter');
  process.stdout.write('ok topic override\n');
})();

// ---------------------------------------------------------------------------
// Test 6: UNDONE frontmatter
// ---------------------------------------------------------------------------
(function testUndoneFrontmatter() {
  const m = makeManifest({
    undo: { is_undone: true, undone_at: '2026-04-13T12:00:00Z' },
    files: [file('a.md', 'problem-definition', 0.9, 'AUTO')]
  });
  const out = generateImportReport(m);
  assert.ok(/^---\nUNDONE: true\n/.test(out), 'UNDONE: true prepended');
  assert.ok(out.indexOf('This import has been UNDONE') !== -1, 'undone summary note');
  process.stdout.write('ok undone frontmatter\n');
})();

// ---------------------------------------------------------------------------
// Test 7: /mos: Usability Check placeholder always present
// ---------------------------------------------------------------------------
(function testUsabilityPlaceholder() {
  const m = makeManifest({
    files: [file('a.md', 'problem-definition', 0.9, 'AUTO')]
  });
  const out = generateImportReport(m);
  assert.ok(out.indexOf('## /mos: Usability Check') !== -1, 'Usability Check section');
  assert.ok(out.indexOf('Phase 80 Plan 06') !== -1, 'placeholder mentions 80-06');

  // With smoke result passed in, the placeholder is replaced by details
  const out2 = generateImportReport(m, { smokeTestResult: { status: 'pass', details: 'all green' } });
  assert.ok(out2.indexOf('status: pass') !== -1, 'smoke status rendered');
  assert.ok(out2.indexOf('all green') !== -1, 'smoke details rendered');
  process.stdout.write('ok usability placeholder\n');
})();

process.stdout.write('\nall report.test.cjs passing\n');
