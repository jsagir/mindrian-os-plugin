'use strict';
/*
 * tests/test-348-validity-window.cjs -- Phase 348-05 Task 1: the D-06 /
 * SUPER-10 validity-window ruling proof. Proves the column pair
 * (nodes.valid_from / nodes.valid_to) is what actually closes a claim, that
 * typed-claim.cjs's props pair (properties.valid_from / valid_until) is
 * display-only (a non-empty props valid_until changes NOTHING about the
 * close), that the zero-consumers claim is measured rather than assumed, and
 * that no fifth validity-window representation exists anywhere in the
 * production tree.
 *
 * MEASURED FINDING, named here rather than softened: a real, precise scan
 * (property-access patterns, comment-stripped, across lib/ scripts/
 * commands/ agents/ skills/ hooks/, excluding tests/ node_modules/ and
 * colocated *.test.cjs files) finds exactly ONE reader of the persisted
 * props strings: lib/core/leverage-scan.cjs's Meadows Level-9 ("Delays")
 * signature, which checks only json_extract(properties,'$.valid_from'/
 * '$.valid_until') IS NOT NULL -- an EXISTENCE-only heuristic leverage-score
 * nudge, never the VALUE, never a truth-state or closure decision. This is
 * a genuine, pre-existing (Phase 150.10-04) consumer the plan's own
 * "read by nothing" framing did not anticipate; it is named and allow-listed
 * here rather than silently excluded or falsely asserted away, and assertion
 * 3B below proves the exception is scoped to existence-only (no value read,
 * no comparison) so this allow-list cannot quietly widen into a real
 * competing authority. lib/mcp/tools/claim.cjs, lib/core/domain-insight-
 * sweep.cjs, commands/file-meeting.md and skills/file-meeting/SKILL.md all
 * mention valid_from/valid_until too, but every one of those is WRITE-side
 * (they construct params fed INTO writeClaimNode, exactly like typed-claim.cjs
 * itself), not a read of an already-persisted value -- confirmed by the
 * precise property-access regex below finding no match in any of them.
 *
 * The "no third representation" scan is scoped to a curated temporal-suffix
 * pattern (valid_{from,to,until,since,through} / invalidated_{at,on}, both
 * snake_case and camelCase) rather than a bare "contains the word valid" or
 * "contains the word expiry" scan, because this repo has several wholly
 * unrelated "valid"/"expiry" vocabularies (lib/conversation/operator.cjs's
 * valid_options, lib/core/bearer-token.cjs's expiresAt, lib/core/
 * eureka/analogy-fitness.cjs's valid_at, etc.) that a bare-word scan flags as
 * false positives with zero bearing on claim validity windows. The camelCase
 * forms validFrom / validTo / invalidatedAt are explicitly ALLOWED as the
 * same canonical columns, not a fifth representation: they are the JS-side
 * local-variable spelling supersession.cjs and transitions.cjs already use
 * for the exact same nodes.valid_from / nodes.valid_to / nodes.invalidated_at
 * columns (confirmed by direct read of both files, Phase 160-04 / 348-03),
 * so allow-listing them is not new leniency, it is recognizing a pre-existing
 * alias of an already-counted name, not a sixth or seventh identifier. A
 * genuinely new coinage (valid_since, valid_through, validSince, validThrough,
 * or any other temporal-suffix combination) still fails this test, named.
 *
 * House test idiom: node:assert/strict, an `ok(desc, fn)` counter, fixtures
 * from tests/helpers/fixture-room-348.cjs, final line
 * '>>> test-348-validity-window.cjs: PASSED'.
 *
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  writeClaimNode, PROTECTED_CLAIM_KEYS,
} = require('../lib/core/navigation/typed-claim.cjs');
const { supersede } = require('../lib/core/temporal/supersession.cjs');
const {
  buildSupersessionFixtureRoom,
  closeSupersessionFixtureRoom,
} = require('./helpers/fixture-room-348.cjs');

let n = 0;
function ok(desc, fn) {
  fn();
  n += 1;
  console.log('  ok ' + n + ' - ' + desc);
}

console.log('test-348-validity-window (SUPER-10 / D-06)');

// ---------------------------------------------------------------------------
// Assertion 1: the close boundary comes from the COLUMN, not a derived value.
// ---------------------------------------------------------------------------

ok('supersede() closes B.valid_to (column) to exactly A.valid_from (column) on the wide fixture', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const aBefore = fx.db.prepare('SELECT valid_from FROM nodes WHERE id = ?').get(fx.claimAId);
    const res = supersede(fx.db, fx.claimBId, fx.claimAId, { byUser: fx.byUser });
    assert.equal(res.ok, true, JSON.stringify(res));
    const bAfter = fx.db.prepare('SELECT valid_to FROM nodes WHERE id = ?').get(fx.claimBId);
    assert.equal(bAfter.valid_to, aBefore.valid_from, 'B.valid_to must equal A.valid_from, the column read, not a derived timestamp');
  } finally { closeSupersessionFixtureRoom(fx); }
});

// ---------------------------------------------------------------------------
// Assertion 2: a non-empty props.valid_until on A changes NOTHING about the
// close. This is the assertion that makes display-only a measured claim.
// ---------------------------------------------------------------------------

ok('setting a non-empty properties.valid_until string on A changes nothing about the close: B.valid_to still equals A.valid_from (column)', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const aPropsRow = fx.db.prepare('SELECT properties FROM nodes WHERE id = ?').get(fx.claimAId);
    const aProps = JSON.parse(aPropsRow.properties);
    aProps.valid_until = '2020-01-01T00:00:00.000Z';
    fx.db.prepare('UPDATE nodes SET properties = ? WHERE id = ?').run(JSON.stringify(aProps), fx.claimAId);

    const aBefore = fx.db.prepare('SELECT valid_from FROM nodes WHERE id = ?').get(fx.claimAId);
    const res = supersede(fx.db, fx.claimBId, fx.claimAId, { byUser: fx.byUser });
    assert.equal(res.ok, true, JSON.stringify(res));
    const bAfter = fx.db.prepare('SELECT valid_to FROM nodes WHERE id = ?').get(fx.claimBId);
    assert.equal(bAfter.valid_to, aBefore.valid_from, 'the props string must be inert: the close boundary is unaffected by it');
    assert.notEqual(bAfter.valid_to, Date.parse('2020-01-01T00:00:00.000Z'), 'sanity: the props string value must NOT have leaked into the close boundary');
  } finally { closeSupersessionFixtureRoom(fx); }
});

// ---------------------------------------------------------------------------
// Source-scan machinery shared by assertions 3 and 4.
// ---------------------------------------------------------------------------

const SCAN_ROOTS = ['lib', 'scripts', 'commands', 'agents', 'skills', 'hooks'];
const TEST_FILENAME_RE = /\.test\.(cjs|js)$/;

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
}

function scanFiles(extensions) {
  const files = [];
  for (const root of SCAN_ROOTS) walk(root, files);
  return files
    .filter((f) => extensions.some((ext) => f.endsWith(ext)))
    .filter((f) => !f.startsWith('tests' + path.sep))
    .filter((f) => !TEST_FILENAME_RE.test(f));
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ---------------------------------------------------------------------------
// Assertion 3A: zero UNEXPECTED reads of the persisted props strings.
// ---------------------------------------------------------------------------

const READ_PATTERNS = [
  /properties\.valid_(from|until)\b/,
  /props\.valid_(from|until)\b/,
  /json_extract\([^)]*valid_(from|until)/i,
  /JSON\.parse\([^)]*\)\.valid_(from|until)/,
  /\$\.valid_(from|until)\b/,
];

const KNOWN_READ_CONSUMERS = new Set([
  path.join('lib', 'core', 'navigation', 'typed-claim.cjs'), // the writer itself
  path.join('lib', 'core', 'leverage-scan.cjs'), // named exception, existence-only (see header + assertion 3B)
]);

ok('a comment-stripped source scan finds zero UNEXPECTED reads of properties.valid_from / valid_until outside the writer and the one named existence-only exception', function () {
  const files = scanFiles(['.cjs', '.js']);
  const hits = [];
  for (const f of files) {
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch (_e) { continue; }
    const stripped = stripComments(src);
    if (READ_PATTERNS.some((re) => re.test(stripped))) hits.push(f);
  }
  const unexpected = hits.filter((f) => !KNOWN_READ_CONSUMERS.has(f));
  if (unexpected.length > 0) {
    console.log('  MEASURED unexpected read consumers:', JSON.stringify(unexpected, null, 2));
  }
  assert.deepEqual(unexpected, [], 'display-only is a measured claim; an unexpected consumer must be named, not silently passed');
});

// ---------------------------------------------------------------------------
// Assertion 3B: the one named exception is existence-only, never value-reading.
// ---------------------------------------------------------------------------

ok('the one named exception (leverage-scan.cjs) checks EXISTENCE only (IS NOT NULL), never the value: no comparison, no Date parse, no equality check against the extracted scalar', function () {
  const src = fs.readFileSync(path.join('lib', 'core', 'leverage-scan.cjs'), 'utf8');
  const stripped = stripComments(src);
  assert.match(stripped, /json_extract\(properties,\s*'\$\.valid_from'\)\s*IS NOT NULL/, 'expected an IS NOT NULL existence check on valid_from');
  assert.match(stripped, /json_extract\(properties,\s*'\$\.valid_until'\)\s*IS NOT NULL/, 'expected an IS NOT NULL existence check on valid_until');
  // No SQL comparison operator applied to a json_extract'd valid_from/valid_until
  // scalar (e.g. '> ?', '< json_extract...'), and no JS-side Date parse of the
  // extracted value anywhere in this file.
  assert.doesNotMatch(stripped, /json_extract\([^)]*valid_(from|until)[^)]*\)\s*[<>]/, 'the exception must never compare the extracted VALUE');
  assert.doesNotMatch(stripped, /Date\.parse\([^)]*valid_(from|until)/, 'the exception must never parse the extracted VALUE as a date');
});

// ---------------------------------------------------------------------------
// Assertion 4: no third representation. The set of validity-related
// identifiers across the tree is exactly the two pairs already shipped
// (plus their pre-existing JS camelCase aliases -- see header).
// ---------------------------------------------------------------------------

const ALLOWED_IDENTIFIERS = new Set([
  'valid_from', 'valid_to', 'valid_until', 'invalidated_at',
  'validFrom', 'validTo', 'validUntil', 'invalidatedAt',
]);

// Narrow, curated temporal-suffix pattern (see header for why a bare
// "contains valid" or "contains expiry" scan is unusable in this repo).
const CANDIDATE_RE = /\bvalid_(from|to|until|since|through)\b|\bvalid(From|To|Until|Since|Through)\b|\binvalidated_(at|on)\b|\binvalidatedAt\b/g;

ok('no fifth validity-window identifier exists anywhere in the production tree (curated temporal-suffix scan, camelCase aliases of the shipped columns allowed, see header)', function () {
  const files = scanFiles(['.cjs', '.js', '.md']);
  const offenders = [];
  for (const f of files) {
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch (_e) { continue; }
    let m;
    CANDIDATE_RE.lastIndex = 0;
    while ((m = CANDIDATE_RE.exec(src))) {
      const tok = m[0];
      if (!ALLOWED_IDENTIFIERS.has(tok)) {
        offenders.push({ file: f, token: tok });
      }
    }
  }
  if (offenders.length > 0) {
    console.log('  MEASURED offending identifiers:', JSON.stringify(offenders, null, 2));
  }
  assert.deepEqual(offenders, [], 'a fifth validity-window name must be named, never silently absorbed');
});

// ---------------------------------------------------------------------------
// Assertion 5: PROTECTED_CLAIM_KEYS unchanged, still guards both keys.
// ---------------------------------------------------------------------------

ok('PROTECTED_CLAIM_KEYS still contains both valid_from and valid_until (unchanged)', function () {
  assert.ok(PROTECTED_CLAIM_KEYS.indexOf('valid_from') !== -1);
  assert.ok(PROTECTED_CLAIM_KEYS.indexOf('valid_until') !== -1);
});

// ---------------------------------------------------------------------------
// Assertion 6: writeClaimNode's stored properties JSON is byte-identical to
// the pre-plan output for a fixed input (this is a comment-only edit).
// ---------------------------------------------------------------------------

ok('writeClaimNode stores a byte-identical properties JSON for a fixed input (comment-only edit, zero behavior change)', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const res = writeClaimNode(fx.db, {
      knowledge_type: 'fact',
      text: 'the byte-identical fixed input claim',
      sessionId: 'byte348',
      sourceSegment: 'seg-byte348',
    });
    assert.equal(res.ok, true, JSON.stringify(res));
    const row = fx.db.prepare('SELECT properties FROM nodes WHERE id = ?').get(res.node_id);
    const expected = '{"knowledge_type":"fact","text":"the byte-identical fixed input claim","conditions":"","counter_conditions":"","valid_from":"","valid_until":"","source_speaker":"","source_segment":"seg-byte348","epistemic_type":"extracted_fact"}';
    assert.equal(row.properties, expected);
  } finally { closeSupersessionFixtureRoom(fx); }
});

console.log('');
console.log(n + ' assertions passed');
console.log('>>> test-348-validity-window.cjs: PASSED');
process.exit(0);
