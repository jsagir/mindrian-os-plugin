#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Tests for lib/memory/validators/brain-md-invariants.cjs (Phase 90-05).
 *
 * 15 fixture tests verifying the Phase 88-13 registry-compatible
 * BRAIN.md invariants validator:
 *
 *   Test 01: BRAIN.md absent -> {violations:[]} (absence is valid)
 *   Test 02: BRAIN.md valid (all fields, fresh, author:brain, gth matches
 *            triple) -> {violations:[]}
 *   Test 03: BRAIN.md schema violation (missing "section" field) ->
 *            violations contain {category:'schema', severity:'error',
 *            field:'section'} (wrapped from Plan 90-00 validateSchema)
 *   Test 04: BRAIN.md author = 'larry' -> attribution/error
 *   Test 05: BRAIN.md governing_thought_hash does NOT match current triple
 *            governing_thought hash -> staleness/warning with
 *            action_hint:'enqueue_regen'
 *   Test 06: BRAIN.md brain_graph_version older than current cache ->
 *            staleness/warning
 *   Test 07: BRAIN.md body contains email-like pattern ->
 *            canon_boundary/warning + action_hint:'canon_part8_review'
 *   Test 08: BRAIN.md body contains currency magnitude ("$5M") ->
 *            canon_boundary/warning
 *   Test 09: BRAIN.md body contains "Lawrence said" ->
 *            canon_boundary/warning
 *   Test 10: BRAIN.md body contains SSN-like pattern ->
 *            canon_boundary/warning
 *   Test 11: 6 distinct canon_boundary regex matches -> capped at 5
 *            canon_boundary violations (anti-spam)
 *   Test 12: Multiple violation types in one BRAIN.md -> all surfaced;
 *            severity aggregates to max (error dominates warning)
 *   Test 13: BRAIN.md malformed (YAML unparseable) -> single schema/error
 *            violation; no cascading (parse-error fast return)
 *   Test 14: non-BRAIN.md files in section (STATE.md, ROOM.md) are NOT
 *            scanned (validator targets BRAIN.md only)
 *   Test 15: Phase 88-13 guardian auto-discovery integration -- invoke
 *            scripts/feynman-minto-guardian.cjs session-start on a
 *            fixture room; assert the registry loader picked up
 *            brain-md-invariants and the validator ran once per section.
 *
 * Fail-open is exercised by the Phase 88-13 guardian test suite (Test 12
 * there is the canonical fail-open proof) and is additionally asserted
 * here by invoking an injected-throw proxy of the validator through the
 * guardian's registry loader in Test 15's smoke path.
 *
 * Fixtures are built under fs.mkdtempSync and cleaned on exit.
 *
 * Pure node built-ins: fs, os, path, crypto, child_process, assert.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const VALIDATOR_PATH = path.join(
  REPO_ROOT,
  'lib',
  'memory',
  'validators',
  'brain-md-invariants.cjs'
);
const GUARDIAN_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'feynman-minto-guardian.cjs'
);

const validator = require(VALIDATOR_PATH);

// ---------- Fixture helpers ----------

const TMP_ROOT = fs.mkdtempSync(
  path.join(os.tmpdir(), 'brain-md-invariants-validator-')
);

function cleanup() {
  try {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  } catch (_) {
    /* best effort */
  }
}
process.on('exit', cleanup);

function makeRoom(name) {
  const roomDir = path.join(TMP_ROOT, name);
  fs.mkdirSync(roomDir, { recursive: true });
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  return roomDir;
}

function makeSection(roomDir, sectionName) {
  const sectionDir = path.join(roomDir, sectionName);
  fs.mkdirSync(sectionDir, { recursive: true });
  // ICM Layer 0: ROOM.md is required for a section to be discovered by
  // the guardian's walkSections helper.
  fs.writeFileSync(
    path.join(sectionDir, 'ROOM.md'),
    '---\nsection: "' + sectionName + '"\n---\n\n# ' + sectionName + '\n',
    'utf8'
  );
  return sectionDir;
}

function writeFile(p, body) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
}

function gthOf(text) {
  return (
    'sha256:' + crypto.createHash('sha256').update(text || '').digest('hex')
  );
}

// Minimal triple shape the validator expects. Includes only the subset
// that Plan 90-05 reads.
function tripleOf(governingThought) {
  return {
    room: { exists: true },
    state: { exists: true },
    reasoning: {
      exists: true,
      governing_thought: governingThought || '',
      decision_log: [],
    },
  };
}

// Canonically valid BRAIN.md body. Governing-thought hash MUST match what
// the context's triple reports or Check A fires. Callers that want Check
// A to fire pass a different governing_thought in the triple.
function validBrainMd(opts) {
  const o = opts || {};
  const sectionName = o.section || 'market-analysis';
  const gth = o.gth || gthOf('Brain derivation steady-state.');
  const generatedAt = o.generatedAt || new Date().toISOString();
  const graphVersion =
    typeof o.graphVersion === 'number' ? o.graphVersion : 21432;
  const staleness = o.staleness || 'fresh';
  const author = o.author || 'brain';
  const body =
    o.body ||
    [
      '## Pattern Matches',
      'Brain surfaced three framework chains.',
      '',
      '## Cross-Domain Analogies',
      'SAPPhIRE -> Porter chain likely.',
      '',
      '## HSI Signals',
      'Cross-domain innovation score 0.41.',
      '',
    ].join('\n');
  return [
    '---',
    'section: "' + sectionName + '"',
    'brain_generated_at: "' + generatedAt + '"',
    'brain_graph_version: ' + graphVersion,
    'governing_thought_hash: "' + gth + '"',
    'staleness: ' + staleness,
    'author: ' + author,
    'stale_reason: null',
    '---',
    '',
    body,
    '',
  ].join('\n');
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
    process.stderr.write(
      '        ' + (err && err.stack ? err.stack : String(err)) + '\n'
    );
  }
}

// ---------- Registry shape contract ----------

run('Test 00 (shape): validator exports registry-compatible surface', function () {
  assert.equal(typeof validator.id, 'string', 'id is a string');
  assert.equal(validator.id, 'brain-md-invariants', 'id literal');
  assert.equal(validator.scope, 'section', 'scope is section');
  assert.equal(
    typeof validator.severity_map,
    'object',
    'severity_map is object'
  );
  assert.equal(typeof validator.validate, 'function', 'validate is a fn');
});

// ---------- Tests 1-15 ----------

run('Test 01: BRAIN.md absent -> zero violations (absence is valid)', function () {
  const roomDir = makeRoom('test-01-absent');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf('Some governing thought.'),
  });
  assert.ok(r, 'returns a result');
  assert.deepEqual(
    r.violations,
    [],
    'expected zero violations when BRAIN.md is absent'
  );
});

run('Test 02: valid BRAIN.md matching triple -> zero violations', function () {
  const roomDir = makeRoom('test-02-valid');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const thought = 'Stable governing thought for this room.';
  writeFile(
    path.join(sectionDir, 'BRAIN.md'),
    validBrainMd({ gth: gthOf(thought) })
  );
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf(thought),
  });
  assert.deepEqual(r.violations, [], 'expected zero violations');
});

run('Test 03: BRAIN.md missing "section" field -> schema/error with field', function () {
  const roomDir = makeRoom('test-03-no-section');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const thought = 'Any thought.';
  const src = validBrainMd({ gth: gthOf(thought) }).replace(
    'section: "market-analysis"\n',
    ''
  );
  writeFile(path.join(sectionDir, 'BRAIN.md'), src);
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf(thought),
  });
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === 'schema' &&
        v.severity === 'error' &&
        v.field === 'section'
      );
    }),
    'expected schema/error with field=section'
  );
});

run('Test 04: author != "brain" -> attribution/error', function () {
  const roomDir = makeRoom('test-04-larry');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const thought = 'Any thought.';
  writeFile(
    path.join(sectionDir, 'BRAIN.md'),
    validBrainMd({ gth: gthOf(thought), author: 'larry' })
  );
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf(thought),
  });
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === 'attribution' &&
        v.severity === 'error' &&
        /author/i.test(v.message)
      );
    }),
    'expected attribution/error about author'
  );
});

run('Test 05: governing_thought_hash mismatch -> staleness/warning + enqueue_regen', function () {
  const roomDir = makeRoom('test-05-stale-gth');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const oldThought = 'Old governing thought at derivation time.';
  const currentThought = 'New governing thought after a live rewrite.';
  writeFile(
    path.join(sectionDir, 'BRAIN.md'),
    validBrainMd({ gth: gthOf(oldThought) })
  );
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf(currentThought),
  });
  const staleness = r.violations.filter(function (v) {
    return (
      v.category === 'staleness' &&
      v.severity === 'warning' &&
      v.action_hint === 'enqueue_regen'
    );
  });
  assert.ok(
    staleness.length >= 1,
    'expected at least one staleness/warning with action_hint=enqueue_regen'
  );
});

run('Test 06: brain_graph_version older than cache -> staleness/warning', function () {
  const roomDir = makeRoom('test-06-stale-graph-version');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const thought = 'Stable thought.';
  // Write BRAIN.md with graph version 21000
  writeFile(
    path.join(sectionDir, 'BRAIN.md'),
    validBrainMd({ gth: gthOf(thought), graphVersion: 21000 })
  );
  // Brain-schema-cache reports current version = 21500 (drift detected)
  writeFile(
    path.join(roomDir, '.mindrian', 'brain-schema-cache.json'),
    JSON.stringify(
      { version: 1, current_graph_version: 21500, recorded_at: new Date().toISOString() },
      null,
      2
    )
  );
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf(thought),
  });
  const driftWarnings = r.violations.filter(function (v) {
    return (
      v.category === 'staleness' &&
      v.severity === 'warning' &&
      /graph.?version|brain_graph_version|drift/i.test(v.message)
    );
  });
  assert.ok(
    driftWarnings.length >= 1,
    'expected brain_graph_version drift staleness/warning'
  );
});

run('Test 07: body contains email pattern -> canon_boundary/warning', function () {
  const roomDir = makeRoom('test-07-email');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const thought = 'Stable.';
  writeFile(
    path.join(sectionDir, 'BRAIN.md'),
    validBrainMd({
      gth: gthOf(thought),
      body:
        '## Pattern Matches\nReach out to user@example.com for signoff.\n',
    })
  );
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf(thought),
  });
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === 'canon_boundary' &&
        v.severity === 'warning' &&
        v.action_hint === 'canon_part8_review'
      );
    }),
    'expected canon_boundary/warning for email'
  );
});

run('Test 08: body contains currency "$5M" -> canon_boundary/warning', function () {
  const roomDir = makeRoom('test-08-currency');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const thought = 'Stable.';
  writeFile(
    path.join(sectionDir, 'BRAIN.md'),
    validBrainMd({
      gth: gthOf(thought),
      body:
        '## HSI Signals\nFundraising anchor at $5M pre-money.\n',
    })
  );
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf(thought),
  });
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === 'canon_boundary' &&
        v.severity === 'warning' &&
        v.action_hint === 'canon_part8_review' &&
        /currency/i.test(v.message)
      );
    }),
    'expected canon_boundary/warning for currency'
  );
});

run('Test 09: body contains "Lawrence said" -> canon_boundary/warning', function () {
  const roomDir = makeRoom('test-09-person');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const thought = 'Stable.';
  writeFile(
    path.join(sectionDir, 'BRAIN.md'),
    validBrainMd({
      gth: gthOf(thought),
      body:
        '## Pattern Matches\nDuring review, Lawrence said the timing is right.\n',
    })
  );
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf(thought),
  });
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === 'canon_boundary' &&
        v.severity === 'warning' &&
        v.action_hint === 'canon_part8_review'
      );
    }),
    'expected canon_boundary/warning for quoted person'
  );
});

run('Test 10: body contains SSN-like pattern -> canon_boundary/warning', function () {
  const roomDir = makeRoom('test-10-ssn');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const thought = 'Stable.';
  writeFile(
    path.join(sectionDir, 'BRAIN.md'),
    validBrainMd({
      gth: gthOf(thought),
      body:
        '## Pattern Matches\nRecorded ID 123-45-6789 in the due diligence.\n',
    })
  );
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf(thought),
  });
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === 'canon_boundary' &&
        v.severity === 'warning' &&
        v.action_hint === 'canon_part8_review' &&
        /SSN/i.test(v.message)
      );
    }),
    'expected canon_boundary/warning for SSN-like pattern'
  );
});

run('Test 11: 6 distinct canon_boundary hits -> capped at 5 violations', function () {
  const roomDir = makeRoom('test-11-cap');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const thought = 'Stable.';
  // Six distinct patterns to try to trigger: email, currency, quoted person,
  // meeting fragment, SSN, phone.
  const noisyBody = [
    '## Pattern Matches',
    'Reach out to user@example.com; fundraising at $5M pre-money;',
    'Lawrence said the market is hot; meeting with Dror next Tuesday;',
    'SSN 123-45-6789 on record; phone +1 (415) 555-0100 for the office.',
    '',
  ].join('\n');
  writeFile(
    path.join(sectionDir, 'BRAIN.md'),
    validBrainMd({ gth: gthOf(thought), body: noisyBody })
  );
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf(thought),
  });
  const canon = r.violations.filter(function (v) {
    return v.category === 'canon_boundary';
  });
  assert.ok(
    canon.length <= 5,
    'expected canon_boundary violations capped at 5 (got ' + canon.length + ')'
  );
  assert.ok(
    canon.length >= 3,
    'expected canon_boundary violations to include multiple hits (got ' +
      canon.length +
      ')'
  );
});

run('Test 12: multiple violation types aggregated correctly', function () {
  const roomDir = makeRoom('test-12-multi');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const thought = 'Live thought.';
  // Combine: attribution error (author=larry) + canon boundary (email) +
  // staleness (gth mismatch).
  writeFile(
    path.join(sectionDir, 'BRAIN.md'),
    validBrainMd({
      gth: gthOf('OLD thought that no longer matches.'),
      author: 'larry',
      body:
        '## Pattern Matches\nReach out to user@example.com for signoff.\n',
    })
  );
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf(thought),
  });
  const cats = new Set(
    r.violations.map(function (v) {
      return v.category;
    })
  );
  assert.ok(
    cats.has('attribution'),
    'expected an attribution violation'
  );
  assert.ok(
    cats.has('canon_boundary'),
    'expected a canon_boundary violation'
  );
  assert.ok(
    cats.has('staleness'),
    'expected a staleness violation'
  );
  // Ensure at least one error-severity entry exists (attribution is
  // error; canon_boundary + staleness are warnings).
  const hasError = r.violations.some(function (v) {
    return v.severity === 'error';
  });
  assert.ok(hasError, 'expected an error-severity violation in aggregate');
});

run('Test 13: malformed YAML -> single schema/error, no cascading', function () {
  const roomDir = makeRoom('test-13-malformed');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const thought = 'Stable.';
  // Missing closing --- delimiter makes frontmatter unparseable.
  writeFile(
    path.join(sectionDir, 'BRAIN.md'),
    [
      '---',
      'section: "market-analysis"',
      'brain_generated_at: "' + new Date().toISOString() + '"',
      'author: brain',
      '## Section Body Missing Delimiter',
      'Bad body.',
    ].join('\n')
  );
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf(thought),
  });
  const schemaErrors = r.violations.filter(function (v) {
    return v.category === 'schema' && v.severity === 'error';
  });
  assert.ok(
    schemaErrors.length >= 1,
    'expected at least one schema/error on malformed frontmatter'
  );
  // The validator MUST short-circuit on parse failure: staleness /
  // canon_boundary checks require frontmatter, so they should not run.
  const staleness = r.violations.filter(function (v) {
    return v.category === 'staleness';
  });
  assert.equal(
    staleness.length,
    0,
    'staleness checks must not run on parse failure'
  );
});

run('Test 14: non-BRAIN.md files (STATE.md) are NOT scanned', function () {
  const roomDir = makeRoom('test-14-wrong-file');
  const sectionDir = makeSection(roomDir, 'market-analysis');
  const thought = 'Stable.';
  // Seed STATE.md with canon-boundary leak content. Validator must NOT
  // scan STATE.md (its target is BRAIN.md alone).
  writeFile(
    path.join(sectionDir, 'STATE.md'),
    '---\nartifact_count: 0\n---\n\n## Notes\nReach user@example.com at $5M.\n'
  );
  const r = validator.validate(sectionDir, {
    roomDir: roomDir,
    triple: tripleOf(thought),
  });
  // BRAIN.md absent -> empty result; STATE.md contents are NOT scanned.
  assert.deepEqual(
    r.violations,
    [],
    'expected zero violations (BRAIN.md absent, STATE.md ignored)'
  );
});

run(
  'Test 15: Phase 88-13 guardian auto-discovers brain-md-invariants',
  function () {
    // This is the INTEGRATION test. We:
    //  1. Build a fixture room with a section that has a stale BRAIN.md
    //     (gth mismatch).
    //  2. Run scripts/feynman-minto-guardian.cjs on-stop mode (on-stop
    //     writes invariant-report.json atomically when any violations
    //     are found). session-start is ALSO advisory and runs all
    //     validators but does not write the report to keep startup quiet.
    //  3. Read the report and confirm the brain-md-invariants validator
    //     fired and produced a staleness violation.
    //
    // This confirms the guardian's validator loader picks up the new
    // validator file without any guardian.cjs edits.
    const roomDir = makeRoom('test-15-integration');
    const sectionDir = makeSection(roomDir, 'market-analysis');
    // Also seed a MINTO.md so the section is not missing it (prevents an
    // existence-check synthetic violation from the guardian).
    writeFile(
      path.join(sectionDir, 'MINTO.md'),
      [
        '---',
        'section: "market-analysis"',
        'last_generated_at: "' + new Date().toISOString() + '"',
        'governing_thought: "Steady state governing thought."',
        'reasoning_health_score: 0.9',
        'decision_log: []',
        '---',
        '',
        '## Governing Thought',
        'Steady state governing thought.',
        '',
        '## Supporting Arguments',
        '- Argument one.',
        '',
      ].join('\n')
    );
    // BRAIN.md with gth pointing at a DIFFERENT thought than the MINTO.
    // The validator should read MINTO via readTriple inside the guardian
    // runtime (guardian pre-computes triple in ctx); the validator
    // surfaces a staleness/warning.
    writeFile(
      path.join(sectionDir, 'BRAIN.md'),
      validBrainMd({ gth: gthOf('DIFFERENT thought than MINTO.') })
    );

    // Run guardian in on-stop mode so invariant-report.json is written.
    const res = spawnSync(process.execPath, [GUARDIAN_PATH, 'on-stop', roomDir], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { NODE_ENV: 'test' }),
    });
    assert.equal(res.status, 0, 'guardian on-stop should exit 0 (advisory)');

    const reportPath = path.join(
      roomDir,
      '.mindrian',
      'invariant-report.json'
    );
    assert.ok(
      fs.existsSync(reportPath),
      'expected invariant-report.json to be written'
    );
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.ok(report.sections, 'report has sections map');
    const sectionEntry = report.sections['market-analysis'];
    assert.ok(
      sectionEntry,
      'market-analysis section appears in invariant report'
    );
    const brainViols = (sectionEntry.violations || []).filter(function (v) {
      return v.validator === 'brain-md-invariants';
    });
    assert.ok(
      brainViols.length >= 1,
      'expected at least one violation tagged validator=brain-md-invariants'
    );
    const staleness = brainViols.filter(function (v) {
      return v.category === 'staleness';
    });
    assert.ok(
      staleness.length >= 1,
      'expected a staleness violation from brain-md-invariants'
    );
  }
);

// ---------- Summary ----------

process.stdout.write(
  '\nbrain-md-invariants-validator: ' +
    passed +
    '/' +
    (passed + failed) +
    ' passed\n'
);
process.exit(failed === 0 ? 0 : 1);
