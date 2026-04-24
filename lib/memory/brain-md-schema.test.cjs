#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Tests for lib/core/brain-md-schema.cjs (Phase 90-00).
 *
 * 18 discrete test cases across 5 violation categories:
 *   existence, schema, staleness, attribution, canon_boundary.
 *
 * Pure node built-ins: fs, os, path, assert. No npm deps.
 * Fixtures are built under fs.mkdtempSync(...) and cleaned up on exit.
 *
 * This file mirrors the Phase 88-00-B feynman-minto-invariants.test.cjs
 * shape: golden fixture + targeted one-line mutations per negative case.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCHEMA_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'lib',
  'core',
  'brain-md-schema.cjs'
);

const mod = require(SCHEMA_PATH);
const {
  validateSchema,
  SCHEMA_VERSION,
  SEVERITY,
  CATEGORIES,
  STALENESS,
  STALE_REASON,
  REQUIRED_FRONTMATTER_FIELDS,
  OPTIONAL_SECTION_HEADINGS,
} = mod;

// ---------- Tmp workspace helpers ----------

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-md-schema-'));

function tmpFile(name, body) {
  const p = path.join(TMP_ROOT, name);
  fs.writeFileSync(p, body, 'utf8');
  return p;
}

function cleanup() {
  try {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  } catch (_) {
    /* best effort */
  }
}
process.on('exit', cleanup);

// ---------- Valid BRAIN.md fixture (golden) ----------
//
// A canonically well-formed BRAIN.md. All required frontmatter present,
// staleness=fresh, author=brain, optional fields populated, known section
// headings only. Every negative test below mutates one line from this.

const NOW_ISO = new Date().toISOString();
const STABLE_HASH = 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const VALID_BRAIN = [
  '---',
  'section: "market-analysis"',
  'brain_generated_at: "' + NOW_ISO + '"',
  'brain_graph_version: 21432',
  'governing_thought_hash: "' + STABLE_HASH + '"',
  'staleness: fresh',
  'author: brain',
  'stale_reason: null',
  'confidence_baseline: 0.7',
  'brain_query_count: 12',
  'cost_tokens: 4500',
  '---',
  '',
  '## Pattern Matches',
  'Brain matched 3 similar framework chains in the teaching graph.',
  '',
  '## Cross-Domain Analogies',
  'SAPPhIRE maps to two adjacent problem types.',
  '',
  '## Wicked Indicators',
  'Three WickedIndicator signals present.',
  '',
  '## Unfilled Opportunity Matches',
  'Two Opportunity nodes matched this section pattern.',
  '',
  '## Framework Chain Predictions',
  'JTBD-Outcome-Driven feeds into Porter Five Forces at phase 3.',
  '',
  '## Assessment Thinking Chain Position',
  'Current rigor level 2. Brain suggests advancing to level 3.',
  '',
  '## ProblemType Classification',
  'UDP-Complex with confidence 0.68.',
  '',
  '## Flagged Contradictions (cross-room)',
  'None.',
  '',
  '## HSI Signals',
  'Cross-domain innovation score 0.41.',
  '',
].join('\n');

// Convenience: produce a mutated copy of VALID_BRAIN with a frontmatter key
// line replaced or removed.

function withReplace(src, line, replacement) {
  return src.replace(line, replacement);
}

function withDelete(src, line) {
  return src.replace(line + '\n', '');
}

// ---------- Test runner ----------

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL  ' + name + '\n');
    process.stderr.write('        ' + (err && err.message ? err.message : err) + '\n');
  }
}

// ---------- Tests 1-18 ----------

// Test 01: valid BRAIN.md fixture.
run('Test 01: valid BRAIN.md -> {valid:true, violations:[], severity:null}', function () {
  const p = tmpFile('valid-brain.md', VALID_BRAIN);
  const r = validateSchema(p);
  assert.equal(r.valid, true, 'expected valid=true');
  assert.deepEqual(r.violations, [], 'expected zero violations');
  assert.equal(r.severity, null, 'expected null severity');
});

// Test 02: missing 'section' field.
run('Test 02: missing section -> schema/error', function () {
  const src = withDelete(VALID_BRAIN, 'section: "market-analysis"');
  const p = tmpFile('no-section.md', src);
  const r = validateSchema(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.SCHEMA &&
        v.severity === SEVERITY.ERROR &&
        /section/i.test(v.message)
      );
    }),
    'expected schema/error citing section'
  );
});

// Test 03: missing 'brain_generated_at' field.
run('Test 03: missing brain_generated_at -> schema/error', function () {
  const src = withDelete(VALID_BRAIN, 'brain_generated_at: "' + NOW_ISO + '"');
  const p = tmpFile('no-generated-at.md', src);
  const r = validateSchema(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.SCHEMA &&
        v.severity === SEVERITY.ERROR &&
        /brain_generated_at/i.test(v.message)
      );
    })
  );
});

// Test 04: missing 'brain_graph_version' field.
run('Test 04: missing brain_graph_version -> schema/error', function () {
  const src = withDelete(VALID_BRAIN, 'brain_graph_version: 21432');
  const p = tmpFile('no-graph-version.md', src);
  const r = validateSchema(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.SCHEMA &&
        v.severity === SEVERITY.ERROR &&
        /brain_graph_version/i.test(v.message)
      );
    })
  );
});

// Test 05: missing 'governing_thought_hash' field.
run('Test 05: missing governing_thought_hash -> schema/error', function () {
  const src = withDelete(VALID_BRAIN, 'governing_thought_hash: "' + STABLE_HASH + '"');
  const p = tmpFile('no-gth.md', src);
  const r = validateSchema(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.SCHEMA &&
        v.severity === SEVERITY.ERROR &&
        /governing_thought_hash/i.test(v.message)
      );
    })
  );
});

// Test 06: missing 'staleness' field.
run('Test 06: missing staleness -> schema/error', function () {
  const src = withDelete(VALID_BRAIN, 'staleness: fresh');
  const p = tmpFile('no-staleness.md', src);
  const r = validateSchema(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.SCHEMA &&
        v.severity === SEVERITY.ERROR &&
        /staleness/i.test(v.message)
      );
    })
  );
});

// Test 07: missing 'author' field -> attribution/error.
run('Test 07: missing author -> attribution/error', function () {
  const src = withDelete(VALID_BRAIN, 'author: brain');
  const p = tmpFile('no-author.md', src);
  const r = validateSchema(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.ATTRIBUTION &&
        v.severity === SEVERITY.ERROR &&
        /author/i.test(v.message)
      );
    }),
    'expected attribution/error citing author'
  );
});

// Test 08: author != 'brain' (e.g. 'larry') -> attribution/error.
run('Test 08: author="larry" -> attribution/error', function () {
  const src = withReplace(VALID_BRAIN, 'author: brain', 'author: larry');
  const p = tmpFile('wrong-author.md', src);
  const r = validateSchema(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.ATTRIBUTION &&
        v.severity === SEVERITY.ERROR &&
        /author/i.test(v.message) &&
        /brain/i.test(v.message)
      );
    })
  );
});

// Test 09: staleness = 'totally_stale' (not in STALENESS enum) -> staleness/warning.
run('Test 09: invalid staleness enum -> staleness/warning', function () {
  const src = withReplace(VALID_BRAIN, 'staleness: fresh', 'staleness: totally_stale');
  const p = tmpFile('bad-staleness.md', src);
  const r = validateSchema(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.STALENESS &&
        v.severity === SEVERITY.WARNING &&
        /staleness/i.test(v.message)
      );
    })
  );
});

// Test 10: staleness = 'stale' with no stale_reason -> staleness/warning.
run('Test 10: stale + stale_reason null -> staleness/warning', function () {
  let src = withReplace(VALID_BRAIN, 'staleness: fresh', 'staleness: stale');
  // stale_reason stays null in VALID_BRAIN fixture, so this triggers the rule.
  const p = tmpFile('stale-no-reason.md', src);
  const r = validateSchema(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.STALENESS &&
        v.severity === SEVERITY.WARNING &&
        /stale_reason/i.test(v.message)
      );
    }),
    'expected staleness/warning citing stale_reason missing'
  );
});

// Test 11: stale_reason = 'reasons' (not in STALE_REASON enum) -> staleness/warning.
run('Test 11: invalid stale_reason enum -> staleness/warning', function () {
  const src = withReplace(VALID_BRAIN, 'stale_reason: null', 'stale_reason: reasons');
  const p = tmpFile('bad-reason.md', src);
  const r = validateSchema(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.STALENESS &&
        v.severity === SEVERITY.WARNING &&
        /stale_reason/i.test(v.message)
      );
    })
  );
});

// Test 12: frontmatter delimiter missing -> schema/error + fast return.
run('Test 12: missing frontmatter delimiters -> schema/error (fast return)', function () {
  const body = VALID_BRAIN.replace(/^---\n/, '').replace(/\n---\n/, '\n');
  const p = tmpFile('no-delim.md', body);
  const r = validateSchema(p);
  assert.equal(r.valid, false);
  const schemaErrors = r.violations.filter(function (v) {
    return v.category === CATEGORIES.SCHEMA && v.severity === SEVERITY.ERROR;
  });
  assert.ok(schemaErrors.length >= 1, 'expected at least one schema/error');
  // Fast return: no cascading required-field checks should be emitted.
  // Assert that only the delimiter error is present (not a pile of
  // missing-field errors against undefined frontmatter).
  assert.ok(
    r.violations.length <= 2,
    'fast return expected (at most delimiter error + maybe existence)'
  );
});

// Test 13: unknown section heading (not in OPTIONAL_SECTION_HEADINGS).
run('Test 13: unknown section heading "## Secret Analysis" -> schema/info', function () {
  const src = VALID_BRAIN + '\n## Secret Analysis\nCustom user-extended section.\n';
  const p = tmpFile('unknown-section.md', src);
  const r = validateSchema(p);
  // Unknown headings are downgraded to info (user-extensible).
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.SCHEMA &&
        v.severity === SEVERITY.INFO &&
        /Secret Analysis|unknown section/i.test(v.message)
      );
    }),
    'expected schema/info citing unknown section heading'
  );
});

// Test 14: Canon Part 8 leak: governing_thought_hash contains 'Lawrence said'.
run('Test 14: "Lawrence said" leak in gth -> canon_boundary/warning', function () {
  const src = withReplace(
    VALID_BRAIN,
    'governing_thought_hash: "' + STABLE_HASH + '"',
    'governing_thought_hash: "Lawrence said the market is ready"'
  );
  const p = tmpFile('canon-leak-1.md', src);
  const r = validateSchema(p);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.CANON_BOUNDARY &&
        v.severity === SEVERITY.WARNING &&
        v.action_hint === 'canon_part8_review'
      );
    }),
    'expected canon_boundary/warning with action_hint canon_part8_review'
  );
});

// Test 15: Canon Part 8 leak: section field contains email-like pattern.
run('Test 15: email-like leak in section -> canon_boundary/warning', function () {
  const src = withReplace(
    VALID_BRAIN,
    'section: "market-analysis"',
    'section: "user@example.com notes"'
  );
  const p = tmpFile('canon-leak-2.md', src);
  const r = validateSchema(p);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.CANON_BOUNDARY &&
        v.severity === SEVERITY.WARNING &&
        v.action_hint === 'canon_part8_review'
      );
    }),
    'expected canon_boundary/warning for email pattern'
  );
});

// Test 16: empty (zero-byte) file -> existence/critical; no schema checks.
run('Test 16: empty file -> existence/critical (no schema cascade)', function () {
  const p = tmpFile('empty.md', '');
  const r = validateSchema(p);
  assert.equal(r.valid, false);
  assert.equal(r.severity, SEVERITY.CRITICAL);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.EXISTENCE &&
        v.severity === SEVERITY.CRITICAL
      );
    })
  );
  // Confirm no cascading schema errors were pushed.
  assert.equal(
    r.violations.filter(function (v) {
      return v.category === CATEGORIES.SCHEMA;
    }).length,
    0,
    'no schema cascade on empty file'
  );
});

// Test 17: nonexistent path -> existence/critical; does NOT throw.
run('Test 17: nonexistent path -> existence/critical (no throw)', function () {
  let r;
  assert.doesNotThrow(function () {
    r = validateSchema('/nonexistent/path/BRAIN.md');
  });
  assert.equal(r.valid, false);
  assert.equal(r.severity, SEVERITY.CRITICAL);
  assert.ok(
    r.violations.some(function (v) {
      return v.category === CATEGORIES.EXISTENCE;
    })
  );
});

// Test 18: enums frozen. Part 8 leak heuristics imply frozen regex set.
run('Test 18: SEVERITY, CATEGORIES, STALENESS, STALE_REASON are frozen', function () {
  assert.equal(Object.isFrozen(SEVERITY), true, 'SEVERITY frozen');
  assert.equal(Object.isFrozen(CATEGORIES), true, 'CATEGORIES frozen');
  assert.equal(Object.isFrozen(STALENESS), true, 'STALENESS frozen');
  assert.equal(Object.isFrozen(STALE_REASON), true, 'STALE_REASON frozen');
  assert.equal(Object.isFrozen(REQUIRED_FRONTMATTER_FIELDS), true, 'REQUIRED frozen');
  assert.equal(
    Object.isFrozen(OPTIONAL_SECTION_HEADINGS),
    true,
    'OPTIONAL_SECTION_HEADINGS frozen'
  );
  // Sanity: SCHEMA_VERSION is 1.
  assert.equal(SCHEMA_VERSION, 1, 'SCHEMA_VERSION is 1');
});

// ---------- Summary ----------

process.stdout.write(
  '\nbrain-md-schema.test: ' + passed + '/' + (passed + failed) + ' passed\n'
);
process.exit(failed === 0 ? 0 : 1);
