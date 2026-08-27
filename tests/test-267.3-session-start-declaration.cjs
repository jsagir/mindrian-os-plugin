#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 267.3 Plan 03 -- the anchor tripwire
 * =========================================
 * The gap this closes, in one sentence: `scanDeclaredSurfaces()` checks that a
 * record's FILE exists, and nothing checks that the record's ANCHOR still points
 * at something inside it.
 *
 * Why that matters. `data/first-reward-surfaces.json` declares a first-reward
 * contract for four named prose branches inside `scripts/session-start`, a bash
 * hook with no frontmatter to declare in. The registry locates each branch by an
 * `anchor`: a literal string that is supposed to be a real substring of the file.
 * A future refactor that renames `COLD_START_MENU`, restructures the
 * `ONBOARD_TYPE` branches, or simply rewords the payload would leave the
 * declaration pointing at prose that no longer exists. The file would still be on
 * disk, so `file_not_found` would not fire, and every gate would stay green while
 * the declaration silently described nothing. That is threat T-267.3-13.
 *
 * What is checked here:
 *
 *   1  every record's `file` resolves to a real file under the repo root
 *   2  every record's `anchor` is a literal substring of that file
 *   3  a `scripts/session-start` record's anchor actually lands INSIDE the
 *      FIRST_INSTALL branch, not merely somewhere in the file
 *   4  every `id` is unique across the whole registry
 *   5  every `interactive_first_reward` is a member of the LIVE REWARD_TYPES Set
 *      read out of lib/core/mva-rule-linter.cjs at run time, never a copy of the
 *      token list pasted into this file
 *   6  no `why` field carries a U+2014 em-dash (house rule: hyphens only)
 *   7  the tripwire actually FIRES: a synthetic registry whose anchor is absent
 *      from its file fails the same predicate function the live sweep uses
 *
 * Test 7 is what stops this file passing vacuously. Tests 1, 2 and 7 all call one
 * shared `auditAnchors()` so the live sweep and the synthetic case cannot drift
 * into being two different checks, one of which happens to be toothless.
 *
 * Hermetic: the synthetic fixture lives under fs.mkdtempSync(os.tmpdir()). This
 * suite never writes into the repository.
 *
 * Pure CJS, node built-ins only, zero npm deps. No em-dashes, no emoji.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const LINTER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'mva-rule-linter.cjs');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'first-reward-surfaces.json');
const SESSION_START_REL = 'scripts/session-start';

const { REWARD_TYPES } = require(LINTER_PATH);

let passed = 0;
let failed = 0;

function run(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + '\n');
    passed += 1;
  } catch (err) {
    process.stderr.write(
      'FAIL ' + name + '\n' + (err && err.stack ? err.stack : String(err)) + '\n'
    );
    failed += 1;
  }
}

// ---------- the shared predicate ----------

/**
 * auditAnchors(registry, repoRoot) -> [{ id, reason, detail }]
 *
 * ONE implementation, used by the live sweep (tests 1 and 2) and by the
 * synthetic negative case (test 7). If this ever stops detecting a missing
 * anchor, test 7 reds too, so the suite cannot quietly become decorative.
 *
 * Reasons: `file_not_found` (the record's file is not a file on disk) and
 * `anchor_not_found` (the file exists but does not contain the anchor literal).
 */
function auditAnchors(registry, repoRoot) {
  const failures = [];
  const surfaces = Array.isArray(registry && registry.surfaces) ? registry.surfaces : [];

  for (const rec of surfaces) {
    const id = rec && typeof rec.id === 'string' ? rec.id : '(no id)';
    const rel = rec && typeof rec.file === 'string' ? rec.file : '';
    const anchor = rec && typeof rec.anchor === 'string' ? rec.anchor : '';
    const full = path.resolve(repoRoot, rel);

    let isFile = false;
    try {
      isFile = rel.length > 0 && fs.statSync(full).isFile();
    } catch (_e) {
      isFile = false;
    }
    if (!isFile) {
      failures.push({ id, reason: 'file_not_found', detail: rel });
      continue;
    }

    const body = fs.readFileSync(full, 'utf8');
    if (anchor.length === 0 || !body.includes(anchor)) {
      failures.push({ id, reason: 'anchor_not_found', detail: anchor });
    }
  }

  return failures;
}

function readLiveRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

// ---------- 1. every declared file is on disk ----------

run('1. every record file resolves to a real file under the repo root', () => {
  const registry = readLiveRegistry();
  assert.ok(
    Array.isArray(registry.surfaces) && registry.surfaces.length > 0,
    'the live registry declares no surfaces; this suite would prove nothing'
  );

  const misses = auditAnchors(registry, REPO_ROOT).filter((f) => f.reason === 'file_not_found');
  assert.deepEqual(
    misses,
    [],
    'these records name a file that is not on disk: ' + JSON.stringify(misses)
  );
});

// ---------- 2. every anchor is a live literal ----------

run('2. every record anchor is a literal substring of the file it names', () => {
  const registry = readLiveRegistry();
  const misses = auditAnchors(registry, REPO_ROOT).filter((f) => f.reason === 'anchor_not_found');
  assert.deepEqual(
    misses,
    [],
    'these declarations point at prose that no longer exists: ' +
      JSON.stringify(misses, null, 2) +
      '\nEither restore the literal in the file, or update the record in ' +
      'data/first-reward-surfaces.json to a literal that is really there.'
  );
});

// ---------- 3. the FIRST_INSTALL anchor lands inside the FIRST_INSTALL branch ----------

run('3. a session-start record anchors INSIDE the FIRST_INSTALL branch', () => {
  const registry = readLiveRegistry();
  const recs = registry.surfaces.filter((s) => s.file === SESSION_START_REL);
  assert.ok(recs.length > 0, 'no record declares ' + SESSION_START_REL);

  const body = fs.readFileSync(path.join(REPO_ROOT, SESSION_START_REL), 'utf8');
  const lines = body.split('\n');

  // The branch this must land in: the payload `if`, which is the LAST
  // FIRST_INSTALL comparison in the file (the earlier one only touches the
  // auto-update flag file), bounded below by the UPDATE elif.
  let openIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes('[ "$ONBOARD_TYPE" = "FIRST_INSTALL" ]')) openIdx = i;
  }
  const closeIdx = lines.findIndex((l) => l.includes('[ "$ONBOARD_TYPE" = "UPDATE" ]'));
  assert.ok(openIdx >= 0, 'could not locate the FIRST_INSTALL branch condition');
  assert.ok(closeIdx > openIdx, 'could not locate the UPDATE elif after the FIRST_INSTALL branch');

  const inBranch = lines.slice(openIdx, closeIdx).join('\n');
  const hit = recs.find((r) => typeof r.anchor === 'string' && inBranch.includes(r.anchor));
  assert.ok(
    hit,
    'no session-start record anchors inside the FIRST_INSTALL branch (lines ' +
      (openIdx + 1) +
      '-' +
      closeIdx +
      '). Anchors tried: ' +
      JSON.stringify(recs.map((r) => r.anchor))
  );
  assert.equal(
    hit.id,
    'session-start:FIRST_INSTALL',
    'the record anchored inside the FIRST_INSTALL branch should be the FIRST_INSTALL record'
  );
});

// ---------- 4. ids are unique registry-wide ----------

run('4. every record id is unique across the whole registry', () => {
  const registry = readLiveRegistry();
  const seen = new Set();
  const dupes = [];
  for (const rec of registry.surfaces) {
    const id = rec && typeof rec.id === 'string' ? rec.id.trim() : '';
    assert.ok(id.length > 0, 'a record has no id: ' + JSON.stringify(rec));
    if (seen.has(id)) dupes.push(id);
    seen.add(id);
  }
  assert.deepEqual(dupes, [], 'duplicate record ids: ' + JSON.stringify(dupes));
});

// ---------- 5. values come from the LIVE enum ----------

run('5. every declared value is a member of the live REWARD_TYPES Set', () => {
  // Read at run time from the linter, never a token list pasted into this file:
  // a copy would keep passing on the day the two drift, which is the exact
  // failure a vocabulary test exists to catch.
  assert.ok(REWARD_TYPES instanceof Set, 'REWARD_TYPES is expected to be a Set');
  assert.ok(Object.isFrozen(REWARD_TYPES), 'REWARD_TYPES is expected to stay frozen');

  const registry = readLiveRegistry();
  const bad = registry.surfaces
    .filter((s) => !REWARD_TYPES.has(s.interactive_first_reward))
    .map((s) => ({ id: s.id, value: s.interactive_first_reward }));

  assert.deepEqual(
    bad,
    [],
    'these records declare a value outside the closed vocabulary: ' +
      JSON.stringify(bad) +
      '\nLegal values (live): ' +
      JSON.stringify([...REWARD_TYPES])
  );
});

// ---------- 6. no em-dashes ----------

run('6. no why field carries a U+2014 em-dash', () => {
  const registry = readLiveRegistry();
  const offenders = registry.surfaces
    .filter((s) => typeof s.why === 'string' && s.why.indexOf('—') !== -1)
    .map((s) => s.id);
  assert.deepEqual(offenders, [], 'em-dash in why field of: ' + JSON.stringify(offenders));
});

// ---------- 7. the tripwire genuinely fires ----------

run('7. a synthetic registry with an absent anchor fails the same predicate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frs-267.3-03-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'scripts', 'session-start'),
      '#!/usr/bin/env bash\nechoded="A LITERAL THAT IS REALLY HERE"\n'
    );

    const good = {
      surfaces: [
        {
          id: 'synthetic:present',
          file: 'scripts/session-start',
          kind: 'injected_prose',
          anchor: 'A LITERAL THAT IS REALLY HERE',
          interactive_first_reward: [...REWARD_TYPES][0],
          why: 'fixture: the anchor is present, so this record must pass.',
        },
      ],
    };
    assert.deepEqual(
      auditAnchors(good, dir),
      [],
      'the control case must pass, otherwise test 7 proves nothing about the negative case'
    );

    // The negative case: same shape, anchor absent from the file.
    const bad = JSON.parse(JSON.stringify(good));
    bad.surfaces[0].id = 'synthetic:absent';
    bad.surfaces[0].anchor = 'A LITERAL THAT WAS RENAMED AWAY';
    const failures = auditAnchors(bad, dir);
    assert.equal(failures.length, 1, 'expected exactly one failure, got ' + JSON.stringify(failures));
    assert.equal(failures[0].reason, 'anchor_not_found');
    assert.equal(failures[0].id, 'synthetic:absent');

    // And the file-level case, so both reasons are proven live.
    const gone = JSON.parse(JSON.stringify(good));
    gone.surfaces[0].id = 'synthetic:no-file';
    gone.surfaces[0].file = 'scripts/this-file-does-not-exist';
    const goneFailures = auditAnchors(gone, dir);
    assert.equal(goneFailures.length, 1);
    assert.equal(goneFailures[0].reason, 'file_not_found');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- summary ----------

process.stdout.write(
  '\n267.3 session-start declaration: ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed > 0 ? 1 : 0);
