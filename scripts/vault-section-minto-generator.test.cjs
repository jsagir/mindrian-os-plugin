#!/usr/bin/env node
'use strict';

/**
 * Tests for the Phase 81-01 split of scripts/vault-section-minto-generator.cjs
 * into --plan and --write subcommands. Node built-in assert only, zero
 * external test frameworks, zero LLM calls.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GENERATOR = path.join(REPO_ROOT, 'scripts', 'vault-section-minto-generator.cjs');
const FIXTURE_ROOM = path.join(
  REPO_ROOT,
  'test-fixtures',
  'feynman',
  'sections',
  'fixture-small'
);
const FIXTURE_NARRATIVE = path.join(
  REPO_ROOT,
  'test-fixtures',
  'feynman',
  'narratives',
  'fixture-small.json'
);
const SECTION = 'problem-definition';
const MINTO_TARGET = path.join(FIXTURE_ROOM, SECTION, 'MINTO.md');
const FROZEN_DATE = '2026-04-14';

function runGenerator(args) {
  return spawnSync(process.execPath, [GENERATOR].concat(args), {
    env: Object.assign({}, process.env, { MINTO_FROZEN_DATE: FROZEN_DATE }),
    encoding: 'utf-8',
  });
}

function cleanGenerated() {
  if (fs.existsSync(MINTO_TARGET)) fs.unlinkSync(MINTO_TARGET);
}

function scanDashes(str) {
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i);
    if (cp === 8212 || cp === 8211) return true;
  }
  return false;
}

// Pre-test cleanup.
cleanGenerated();

// ------------------------------------------------------------------
// 1. --plan emits well-formed JSON payload with all R-1 keys.
// ------------------------------------------------------------------
{
  const res = runGenerator([
    '--plan',
    FIXTURE_ROOM,
    '--section',
    SECTION,
  ]);
  assert.strictEqual(
    res.status,
    0,
    '--plan exited non-zero: ' + res.stderr
  );
  let payload;
  try {
    payload = JSON.parse(res.stdout);
  } catch (e) {
    assert.fail('--plan stdout is not valid JSON: ' + e.message);
  }
  assert.ok('section_path' in payload, 'missing section_path');
  assert.ok('section_name' in payload, 'missing section_name');
  assert.ok('artifacts' in payload, 'missing artifacts');
  assert.ok('target_minto_path' in payload, 'missing target_minto_path');
  assert.ok('structural' in payload, 'missing structural');
  assert.strictEqual(payload.section_name, SECTION);
  assert.ok(Array.isArray(payload.artifacts));
  assert.strictEqual(payload.artifacts.length, 3, 'expected 3 artifacts');
  for (const a of payload.artifacts) {
    assert.ok('path' in a && 'title' in a && 'excerpt' in a, 'artifact shape');
  }
  const s = payload.structural;
  assert.ok('frontmatter' in s && 'mece_tree' in s && 'cross_refs' in s);
  assert.ok('sources' in s && 'navigation' in s);
  assert.strictEqual(s.frontmatter.created, FROZEN_DATE, 'frozen date honored');
}

// ------------------------------------------------------------------
// 2. --write with narrative produces MINTO.md with all expected sections.
// ------------------------------------------------------------------
cleanGenerated();
{
  const res = runGenerator([
    '--write',
    FIXTURE_ROOM,
    '--section',
    SECTION,
    '--narrative',
    FIXTURE_NARRATIVE,
  ]);
  assert.strictEqual(
    res.status,
    0,
    '--write exited non-zero: ' + res.stderr
  );
  assert.ok(fs.existsSync(MINTO_TARGET), 'MINTO.md not written');
  const content = fs.readFileSync(MINTO_TARGET, 'utf-8');

  // Frontmatter block and methodology marker.
  assert.ok(/^---\n/.test(content), 'frontmatter block missing');
  assert.ok(/methodology: feynman-minto/.test(content), 'methodology marker');
  assert.ok(
    new RegExp('created: ' + FROZEN_DATE).test(content),
    'frozen date in frontmatter'
  );

  // Narrative sections.
  assert.ok(/## Essence/.test(content), 'Essence section missing');
  assert.ok(/## Plain Language/.test(content), 'Plain Language section missing');
  assert.ok(/## Mental Model/.test(content), 'Mental Model section missing');
  assert.ok(/## Sweet Spot/.test(content), 'Sweet Spot section missing');
  assert.ok(/## Key Claims/.test(content), 'Key Claims section missing');
  assert.ok(
    /> \[!abstract\] Governing Thought/.test(content),
    'Governing Thought callout missing'
  );
  assert.ok(/### Claim 1/.test(content), 'Claim 1 missing');
  assert.ok(/### Claim 3/.test(content), 'Claim 3 missing');

  // Structural sections.
  assert.ok(/## MECE Issue Tree/.test(content), 'MECE tree missing');
  assert.ok(/## Evidence Gaps/.test(content), 'Evidence Gaps missing');
  assert.ok(/## Cross-References/.test(content), 'Cross-References missing');
  assert.ok(/## Source Artifacts/.test(content), 'Source Artifacts missing');
  assert.ok(/## Navigation/.test(content), 'Navigation missing');

  // Em-dash / en-dash ban.
  assert.strictEqual(
    scanDashes(content),
    false,
    'MINTO.md contains forbidden em-dash or en-dash'
  );

  // Rough token proxy: under 15000 chars.
  assert.ok(
    content.length < 15000,
    'MINTO.md unexpectedly large: ' + content.length
  );
}

// ------------------------------------------------------------------
// 3. Determinism: two --write runs produce byte-identical output.
// ------------------------------------------------------------------
{
  const first = fs.readFileSync(MINTO_TARGET, 'utf-8');
  cleanGenerated();
  const res = runGenerator([
    '--write',
    FIXTURE_ROOM,
    '--section',
    SECTION,
    '--narrative',
    FIXTURE_NARRATIVE,
  ]);
  assert.strictEqual(res.status, 0);
  const second = fs.readFileSync(MINTO_TARGET, 'utf-8');
  assert.strictEqual(
    first,
    second,
    'consecutive --write runs produced differing MINTO.md'
  );
}

// ------------------------------------------------------------------
// 4. MINTO_FROZEN_DATE freezes the date stamp (unset default is UTC today).
// ------------------------------------------------------------------
{
  const content = fs.readFileSync(MINTO_TARGET, 'utf-8');
  const dateMatches = content.match(/2026-04-14/g) || [];
  assert.ok(
    dateMatches.length >= 2,
    'frozen date should appear at least twice (frontmatter + footer)'
  );
}

// ------------------------------------------------------------------
// 5. --plan exit code 1 when --section is missing.
// ------------------------------------------------------------------
{
  const res = runGenerator(['--plan', FIXTURE_ROOM]);
  assert.notStrictEqual(res.status, 0, '--plan without --section should fail');
}

// ------------------------------------------------------------------
// 6. --write with invalid narrative falls through to tier-0 (81-03).
//    Pre-81-03 this was a hard error. Phase 81-03 changed the contract:
//    schema-invalid narratives emit a warning to stderr and route to
//    runTier0() instead of throwing.
// ------------------------------------------------------------------
cleanGenerated();
{
  const badPath = path.join(REPO_ROOT, 'test-fixtures', 'feynman', '_bad.json');
  fs.writeFileSync(badPath, JSON.stringify({ section: 'problem-definition' }));
  try {
    const res = runGenerator([
      '--write',
      FIXTURE_ROOM,
      '--section',
      SECTION,
      '--narrative',
      badPath,
    ]);
    assert.strictEqual(
      res.status,
      0,
      '--write with invalid narrative should fall through to tier-0, got status ' +
        res.status +
        ': ' +
        res.stderr
    );
    assert.ok(
      /schema validation/.test(res.stderr),
      'expected schema-validation warning on stderr, got: ' + res.stderr
    );
    assert.ok(
      fs.existsSync(MINTO_TARGET),
      'invalid narrative fallthrough did not produce MINTO.md'
    );
    const content = fs.readFileSync(MINTO_TARGET, 'utf-8');
    assert.ok(
      content.indexOf('## AAAK Compressed') !== -1,
      'tier-0 fallthrough output missing AAAK footer'
    );
  } finally {
    if (fs.existsSync(badPath)) fs.unlinkSync(badPath);
  }
}
cleanGenerated();

// ------------------------------------------------------------------
// 7. --write with no --narrative falls through to tier-0 pre-81 path.
//    Pre-81 path writes MINTO.md with pre-81 governing thought placeholder.
// ------------------------------------------------------------------
cleanGenerated();
{
  const res = runGenerator([
    '--write',
    FIXTURE_ROOM,
    '--section',
    SECTION,
  ]);
  assert.strictEqual(
    res.status,
    0,
    '--write fallthrough exited non-zero: ' + res.stderr
  );
  assert.ok(fs.existsSync(MINTO_TARGET), 'fallthrough did not write MINTO.md');
  const content = fs.readFileSync(MINTO_TARGET, 'utf-8');
  // Pre-81 marker: the governing thought placeholder string.
  assert.ok(
    /synthesizes \d+ artifact/.test(content),
    'pre-81 placeholder missing from fallthrough output'
  );
  // Pre-81 methodology marker.
  assert.ok(
    /methodology: minto-pyramid/.test(content),
    'pre-81 methodology marker missing'
  );
  // Phase 81-03: tier-0 now appends an AAAK compressed footer.
  assert.ok(
    content.indexOf('## AAAK Compressed') !== -1,
    'tier-0 output missing AAAK footer'
  );
  // Phase 81-03: tier-0 should log a warning to stderr.
  assert.ok(
    /no narrative provided/.test(res.stderr),
    'tier-0 no-narrative warning missing from stderr: ' + res.stderr
  );
}

// Final cleanup so the fixture folder stays tidy between runs.
cleanGenerated();

process.stdout.write('vault-section-minto-generator.test.cjs: all assertions passed\n');
