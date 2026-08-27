#!/usr/bin/env node
/**
 * Phase 265 Plan 15 (RADAR-22) -- unit + text tripwire for scout's
 * per-competitor fan-out consolidation.
 *
 * Unit arms (Task 1) exercise lib/core/scheduled-scanner.cjs's
 * consolidateCompetitorFindings pure function directly: same-event dedup
 * across competitors, contradiction dedup, typed failure preservation, the
 * cross-item consistency surface, and determinism.
 *
 * Text arm (Task 2) asserts commands/scout.md declares the fan-out shape
 * correctly: the snapshot-before-health ordering survives, the shared
 * module is called rather than reimplemented, the dispatch idiom is
 * explicit, and the zero-competitor honest refusal survives verbatim.
 *
 * Plain Node.js script, no node:test, no npm deps. Hyphens only (no
 * em-dashes, CLAUDE.md HARD RULE).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..');
const scanner = require(path.join(REPO_ROOT, 'lib', 'core', 'scheduled-scanner.cjs'));

let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
  } catch (e) {
    failures += 1;
    console.error('FAIL: ' + name);
    console.error('  ' + (e && e.message ? e.message : e));
  }
}

// ---------------------------------------------------------------------------
// Unit arms over consolidateCompetitorFindings
// ---------------------------------------------------------------------------

check('same acquisition, same date, two shared entities merge with cross_referenced', () => {
  const results = [
    {
      competitor: 'Acme',
      ok: true,
      findings: [
        {
          text: 'Acme acquires Beta Corp',
          source_url: 'https://a.example/1',
          date: '2026-08-01',
          entities: ['Acme', 'Beta Corp'],
        },
      ],
      contradictions: [],
    },
    {
      competitor: 'Zenith',
      ok: true,
      findings: [
        {
          text: 'Zenith reports Acme buying Beta Corp',
          source_url: 'https://b.example/2',
          date: '2026-08-01',
          entities: ['Acme', 'Beta Corp'],
        },
      ],
      contradictions: [],
    },
  ];
  const out = scanner.consolidateCompetitorFindings(results);
  assert.equal(out.findings.length, 1, 'expected one merged finding');
  assert.deepEqual(out.findings[0].cross_referenced, ['Acme', 'Zenith']);
  assert.equal(out.findings[0].competitor, 'Acme', 'attribution must be the alphabetically first competitor');
});

check('different events, same date, one shared entity do NOT merge', () => {
  const results = [
    {
      competitor: 'Acme',
      ok: true,
      findings: [
        { text: 'Acme launches product X', source_url: 'https://a.example/3', date: '2026-08-02', entities: ['Acme'] },
      ],
      contradictions: [],
    },
    {
      competitor: 'Zenith',
      ok: true,
      findings: [
        { text: 'Zenith raises funding round', source_url: 'https://b.example/4', date: '2026-08-02', entities: ['Acme'] },
      ],
      contradictions: [],
    },
  ];
  const out = scanner.consolidateCompetitorFindings(results);
  assert.equal(out.findings.length, 2, 'one shared entity is below the SAME_EVENT_ENTITY_OVERLAP threshold');
});

check('identical source_url merges regardless of entity overlap', () => {
  const results = [
    {
      competitor: 'Acme',
      ok: true,
      findings: [
        { text: 'Report A', source_url: 'https://shared.example/story', date: '2026-08-03', entities: ['Acme'] },
      ],
      contradictions: [],
    },
    {
      competitor: 'Zenith',
      ok: true,
      findings: [
        { text: 'Report B', source_url: 'https://shared.example/story', date: '2026-08-04', entities: ['Zenith'] },
      ],
      contradictions: [],
    },
  ];
  const out = scanner.consolidateCompetitorFindings(results);
  assert.equal(out.findings.length, 1, 'identical source_url must merge despite zero entity overlap and different dates');
});

check('a contradiction attached to a merged event is counted once', () => {
  const sharedNewFinding = 'Acme and Zenith both confirm the joint venture';
  const results = [
    {
      competitor: 'Acme',
      ok: true,
      findings: [
        { text: 'Joint venture announced', source_url: 'https://a.example/5', date: '2026-08-05', entities: ['Acme', 'Zenith'] },
      ],
      contradictions: [{ claim: 'Acme operates alone', new_finding: sharedNewFinding }],
    },
    {
      competitor: 'Zenith',
      ok: true,
      findings: [
        { text: 'Joint venture confirmed', source_url: 'https://b.example/6', date: '2026-08-05', entities: ['Acme', 'Zenith'] },
      ],
      contradictions: [{ claim: 'Zenith has no partners', new_finding: sharedNewFinding }],
    },
  ];
  const out = scanner.consolidateCompetitorFindings(results);
  assert.equal(out.contradictions.length, 1, 'duplicate new_finding across competitors must be counted once');
});

check('one ok:false entry yields a typed failure and an honest scanned count', () => {
  const results = [
    { competitor: 'Acme', ok: true, findings: [], contradictions: [] },
    { competitor: 'Zenith', ok: false, findings: [], contradictions: [], error: 'search timeout' },
  ];
  const out = scanner.consolidateCompetitorFindings(results);
  assert.equal(out.competitors_requested, 2);
  assert.equal(out.competitors_scanned, 1, 'competitors_scanned must never silently include a failed entry');
  assert.equal(out.competitors_failed, 1);
  assert.equal(out.failed.length, 1);
  assert.equal(out.failed[0].competitor, 'Zenith');
  assert.equal(out.failed[0].error, 'search timeout');
});

check('a finding naming two tracked competitors in its contradiction text produces a cross_item_flags entry', () => {
  const results = [
    {
      competitor: 'Acme',
      ok: true,
      findings: [],
      contradictions: [
        {
          claim: 'the market has no incumbent at scale',
          new_finding: 'Acme and Zenith both scaled past the incumbent threshold this quarter',
        },
      ],
    },
    { competitor: 'Zenith', ok: true, findings: [], contradictions: [] },
  ];
  const out = scanner.consolidateCompetitorFindings(results);
  assert.equal(out.cross_item_flags.length, 1);
  assert.deepEqual(out.cross_item_flags[0].affects, ['Acme', 'Zenith']);
});

check('determinism: running the same input twice returns byte-identical JSON', () => {
  const results = [
    {
      competitor: 'Acme',
      ok: true,
      findings: [
        {
          text: 'Acme acquires Beta Corp',
          source_url: 'https://a.example/1',
          date: '2026-08-01',
          entities: ['Acme', 'Beta Corp'],
        },
      ],
      contradictions: [{ claim: 'x', new_finding: 'y' }],
    },
    { competitor: 'Zenith', ok: false, findings: [], contradictions: [], error: 'timeout' },
  ];
  const out1 = JSON.stringify(scanner.consolidateCompetitorFindings(results));
  const out2 = JSON.stringify(scanner.consolidateCompetitorFindings(results));
  assert.equal(out1, out2, 'the pure function must be deterministic across repeated calls on the same input');
});

// ---------------------------------------------------------------------------
// Text arm (Task 2) over commands/scout.md
// ---------------------------------------------------------------------------

check('commands/scout.md: Step 1 snapshot script precedes Step 2 health-check script (baseline dependency survives)', () => {
  const scoutPath = path.join(REPO_ROOT, 'commands', 'scout.md');
  const text = fs.readFileSync(scoutPath, 'utf8');
  const step1Idx = text.indexOf('Step 1');
  const snapshotIdx = text.indexOf('sentinel-snapshot');
  const healthIdx = text.indexOf('sentinel-health-check');
  assert.ok(step1Idx !== -1, 'Step 1 heading must exist');
  assert.ok(snapshotIdx !== -1, 'sentinel-snapshot script reference must exist');
  assert.ok(healthIdx !== -1, 'sentinel-health-check script reference must exist');
  assert.ok(step1Idx < snapshotIdx, 'Step 1 heading must precede the snapshot script reference');
  assert.ok(
    snapshotIdx < healthIdx,
    'the snapshot script must be referenced before the health-check script (byte-offset ordering)'
  );
});

check('commands/scout.md: names the shared consolidateCompetitorFindings function (no reimplementation)', () => {
  const scoutPath = path.join(REPO_ROOT, 'commands', 'scout.md');
  const text = fs.readFileSync(scoutPath, 'utf8');
  assert.ok(text.includes('consolidateCompetitorFindings'), 'must name the shared function literally');
  assert.ok(text.includes('scheduled-scanner.cjs'), 'must name the shared module path literally');
  assert.equal(
    (text.match(/SAME_EVENT_ENTITY_OVERLAP/g) || []).length,
    0,
    'scout.md must NOT contain a second dedup implementation'
  );
});

check('commands/scout.md: dispatch idiom is explicit (no run_in_background, named subagent_type + concurrency ceiling)', () => {
  const scoutPath = path.join(REPO_ROOT, 'commands', 'scout.md');
  const text = fs.readFileSync(scoutPath, 'utf8');
  assert.equal((text.match(/run_in_background/g) || []).length, 0, 'no run_in_background anywhere in scout.md');
  assert.ok(text.includes('subagent_type'), 'must name an explicit subagent_type');
  assert.ok(text.includes('CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS'), 'must name the standing concurrency ceiling');
});

check('commands/scout.md: zero-competitor honest refusal survives verbatim', () => {
  const scoutPath = path.join(REPO_ROOT, 'commands', 'scout.md');
  const text = fs.readFileSync(scoutPath, 'utf8');
  assert.equal(
    (text.match(/No competitors tracked yet/g) || []).length,
    1,
    'the honest zero-competitor refusal must survive exactly once, verbatim'
  );
});

if (failures > 0) {
  console.error('\n' + failures + ' failure(s) found.');
  process.exit(1);
}

console.log('\nPASS: all unit + text arms passed (test-265-scout-competitor-fanout.cjs).');
process.exit(0);
