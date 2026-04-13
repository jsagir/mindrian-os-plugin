'use strict';

/**
 * Unit tests for lib/memory/aaak-compress.cjs
 *
 * Run: node lib/memory/aaak-compress.test.cjs
 */

const assert = require('node:assert/strict');
const {
  compressToAaak,
  renderAaakFooter,
  parseAaakFooter,
  attachAaakFooter,
  _internals,
} = require('./aaak-compress.cjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    process.stdout.write('  ok  ' + name + '\n');
    passed++;
  } catch (err) {
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err.message || err) + '\n');
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_MINTO = `---
type: section-minto
section: problem-definition
created: 2026-04-13
room: mindrianos-product
---

# Problem Definition -- Minto Reasoning

> [!abstract] Governing Thought
> The core problem is that MindrianOS does not activate for new users without Jonathan physically present. The Dror Barak session is the canonical evidence that the installation flow requires verbal coaching to reach a filed artifact.

## Argument Structure

> [!info] Pyramid Logic
> This section argues that the activation gap is a structural invariant problem, not a documentation problem.

## Key Claims

### Claim 1: Dror activation required Jonathan
The session only succeeded because Jonathan was sitting next to Dror. This assumes that a stranger cannot replicate the activation without live guidance. We will build a session-start hook that enforces a conversion event on every state transition.

### Claim 2: Patches have failed
Each patch addressed a specific symptom but not the structural invariant. This only holds if the user does not work around the patch. Next action: write a structural invariant that protects future state transitions by default.

## Source Artifacts

- [[dror-barak-session|Dror Barak Session Notes]]
`;

const SAMPLE_MINTO_NO_AAAK_STRUCTURE = `# Random Notes

Some random content without clear MINTO structure.
We did a thing. It worked.
Next time we should do more.
The end.
`;

// ---------------------------------------------------------------------------
// compressToAaak()
// ---------------------------------------------------------------------------

test('compressToAaak returns all 4 fields + metadata', () => {
  const result = compressToAaak(SAMPLE_MINTO, {
    section: 'problem-definition',
    room: 'mindrianos-product',
  });
  assert.ok(result.assertion, 'assertion should be non-empty');
  assert.ok(result.assumption, 'assumption should be non-empty');
  assert.ok(result.action, 'action should be non-empty');
  assert.ok(result.knowledge, 'knowledge should be non-empty');
  assert.ok(result.metadata, 'metadata should exist');
  assert.equal(result.metadata.section, 'problem-definition');
  assert.equal(result.metadata.room, 'mindrianos-product');
  assert.equal(result.metadata.format_version, '1.0');
});

test('compressToAaak extracts assertion from governing thought', () => {
  const result = compressToAaak(SAMPLE_MINTO);
  assert.match(
    result.assertion,
    /activat|MindrianOS|Jonathan|Dror/i,
    'assertion should reference the core problem'
  );
});

test('compressToAaak extracts action from imperative sentences', () => {
  const result = compressToAaak(SAMPLE_MINTO);
  assert.match(
    result.action,
    /(build|write|ship|next)/i,
    'action should use imperative or next-action language'
  );
});

test('compressToAaak computes compression ratio >= 1', () => {
  const result = compressToAaak(SAMPLE_MINTO);
  assert.ok(
    result.metadata.compression_ratio >= 1,
    `compression_ratio should be >= 1, got ${result.metadata.compression_ratio}`
  );
});

test('compressToAaak respects maxTokens budget', () => {
  const result = compressToAaak(SAMPLE_MINTO, { maxTokens: 100 });
  assert.ok(
    result.metadata.compressed_tokens <= 150,
    `over-budget input should be trimmed, got ${result.metadata.compressed_tokens}`
  );
});

test('compressToAaak handles degenerate input without crashing', () => {
  const result = compressToAaak(SAMPLE_MINTO_NO_AAAK_STRUCTURE, {
    section: 'unknown',
    room: 'unknown',
  });
  assert.ok(result.assertion);
  assert.ok(result.assumption);
  assert.ok(result.action);
  assert.ok(result.knowledge);
});

test('compressToAaak rejects non-string input', () => {
  assert.throws(() => compressToAaak(42), /text must be a string/);
  assert.throws(() => compressToAaak(null), /text must be a string/);
});

test('compressToAaak output has no em-dashes (hard rule)', () => {
  const result = compressToAaak(SAMPLE_MINTO);
  const combined = [
    result.assertion,
    result.assumption,
    result.action,
    result.knowledge,
  ].join(' ');
  assert.equal(
    combined.indexOf('\u2014'),
    -1,
    'AAAK output must contain zero em-dashes'
  );
});

// ---------------------------------------------------------------------------
// renderAaakFooter()
// ---------------------------------------------------------------------------

test('renderAaakFooter produces well-formed markdown', () => {
  const aaak = compressToAaak(SAMPLE_MINTO);
  const md = renderAaakFooter(aaak);
  assert.match(md, /^## AAAK Compressed/m, 'must have AAAK heading');
  assert.match(md, /^### Assertion$/m, 'must have Assertion subsection');
  assert.match(md, /^### Assumption$/m, 'must have Assumption subsection');
  assert.match(md, /^### Action$/m, 'must have Action subsection');
  assert.match(md, /^### Knowledge$/m, 'must have Knowledge subsection');
  assert.match(md, /<!-- aaak-end -->/, 'must have end marker');
});

test('renderAaakFooter includes metadata', () => {
  const aaak = compressToAaak(SAMPLE_MINTO);
  const md = renderAaakFooter(aaak);
  assert.match(md, /Compression ratio:/);
  assert.match(md, /Tokens:/);
  assert.match(md, /Method:/);
});

test('renderAaakFooter has no em-dashes', () => {
  const aaak = compressToAaak(SAMPLE_MINTO);
  const md = renderAaakFooter(aaak);
  assert.equal(md.indexOf('\u2014'), -1);
});

test('renderAaakFooter rejects invalid input', () => {
  assert.throws(() => renderAaakFooter(null), /aaak must be an object/);
  assert.throws(() => renderAaakFooter('string'), /aaak must be an object/);
});

// ---------------------------------------------------------------------------
// parseAaakFooter()
// ---------------------------------------------------------------------------

test('parseAaakFooter round-trips a rendered footer', () => {
  const original = compressToAaak(SAMPLE_MINTO);
  const md = renderAaakFooter(original);
  const parsed = parseAaakFooter(md);

  assert.ok(parsed, 'parse should succeed');
  // Round-trip: assertion text should survive (modulo whitespace normalization)
  assert.match(
    parsed.assertion,
    new RegExp(original.assertion.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
  assert.equal(
    parsed.metadata.compression_ratio,
    original.metadata.compression_ratio
  );
});

test('parseAaakFooter returns null when no footer present', () => {
  assert.equal(parseAaakFooter('# Random document\n\nno aaak here'), null);
  assert.equal(parseAaakFooter(null), null);
  assert.equal(parseAaakFooter(42), null);
});

// ---------------------------------------------------------------------------
// attachAaakFooter()
// ---------------------------------------------------------------------------

test('attachAaakFooter appends to MINTO without existing footer', () => {
  const aaak = compressToAaak(SAMPLE_MINTO);
  const updated = attachAaakFooter(SAMPLE_MINTO, aaak);
  assert.match(updated, /## AAAK Compressed/);
  assert.match(updated, /<!-- aaak-end -->/);
  // Original content must still be present
  assert.match(updated, /Problem Definition -- Minto Reasoning/);
  assert.match(updated, /Key Claims/);
});

test('attachAaakFooter is idempotent (replace, not duplicate)', () => {
  const aaak = compressToAaak(SAMPLE_MINTO);
  const once = attachAaakFooter(SAMPLE_MINTO, aaak);
  const twice = attachAaakFooter(once, aaak);
  // Count occurrences of the AAAK heading
  const matches = twice.match(/## AAAK Compressed/g) || [];
  assert.equal(matches.length, 1, 'must have exactly one AAAK footer after second attach');
});

test('attachAaakFooter preserves filing signature trailer', () => {
  const withSig =
    SAMPLE_MINTO + '\n\n---\n*Filed by MindrianOS -- Section MINTO -- 2026-04-13*\n';
  const aaak = compressToAaak(withSig);
  const updated = attachAaakFooter(withSig, aaak);
  assert.match(updated, /\*Filed by MindrianOS/);
  // Signature should come AFTER the AAAK footer
  const aaakIdx = updated.indexOf('## AAAK Compressed');
  const sigIdx = updated.indexOf('*Filed by MindrianOS');
  assert.ok(aaakIdx < sigIdx, 'AAAK footer must precede filing signature');
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

test('_internals.stripFrontmatter removes YAML block', () => {
  const withFm = '---\nkey: value\n---\n\nbody text';
  assert.equal(_internals.stripFrontmatter(withFm).trim(), 'body text');
  assert.equal(_internals.stripFrontmatter('no frontmatter'), 'no frontmatter');
});

test('_internals.cleanField strips markdown bullet prefixes', () => {
  assert.equal(_internals.cleanField('- hello'), 'hello');
  assert.equal(_internals.cleanField('* world'), 'world');
  assert.equal(_internals.cleanField('  spaced  '), 'spaced');
});

test('_internals.cleanField converts em-dashes to hyphens', () => {
  assert.equal(_internals.cleanField('a \u2014 b'), 'a - b');
});

test('_internals.truncate adds ellipsis only when over limit', () => {
  assert.equal(_internals.truncate('short', 100), 'short');
  assert.equal(_internals.truncate('1234567890', 8), '12345...');
});

// ---------------------------------------------------------------------------

process.stdout.write('\n');
process.stdout.write(`${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.stdout.write('FAIL\n');
  process.exit(1);
}
process.stdout.write('PASS\n');
