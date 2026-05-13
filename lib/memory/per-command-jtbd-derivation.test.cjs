'use strict';

/*
 * Phase 104.1 Plan 01 -- per-command-jtbd-derivation test. Asserts that the
 * Phase 104.1 build script extension (scripts/build-command-registry.cjs)
 * correctly derives `jtbd_label` and `jtbd_summary` from
 * `lib/hmi/jtbd-taxonomy.json` via the per-command `serves_jtbd[0]`.
 *
 * Per Canon Part 7 (Reuse Before Build): the taxonomy is the single source
 * of truth for JTBD content. Per-command frontmatter NEVER authors jtbd_label
 * or jtbd_summary -- both are derived at registry-build time.
 *
 * Expected state: GREEN immediately after Plan 01 Task 1 lands (the registry
 * already carries the derived fields; nothing about derivation depends on the
 * teaching content sweep in Plan 02).
 *
 * Registered in:
 *   - tests/run-all-104.1.sh (Phase 104.1 scoped aggregator)
 *   - lib/memory/run-feynman-tests.cjs TEST_FILES[]
 *
 * Canon Part 8 boundary: this test reads ONLY the local plugin registry +
 * the local taxonomy. Zero network surface, zero Brain calls.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const registryPath = path.join(__dirname, '..', '..', 'data', 'command-registry.json');
const taxonomyPath = path.join(__dirname, '..', '..', 'lib', 'hmi', 'jtbd-taxonomy.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));
const taxonomyById = Object.fromEntries(
  (Array.isArray(taxonomy.entries) ? taxonomy.entries : []).map((e) => [e.id, e])
);

test('commands with serves_jtbd have non-null jtbd_label in registry', () => {
  const offenders = registry.commands.filter(
    (c) =>
      Array.isArray(c.serves_jtbd) && c.serves_jtbd.length > 0 && !c.jtbd_label
  );
  assert.equal(
    offenders.length,
    0,
    offenders.length +
      ' commands with serves_jtbd missing jtbd_label: ' +
      offenders.slice(0, 3).map((c) => c.command).join(', ')
  );
});

test('commands with serves_jtbd have non-null jtbd_summary in registry (excluding orphan taxonomy references)', () => {
  // A command's serves_jtbd[0] may reference a JTBD id that is not in the
  // current taxonomy (an orphan). In that case jtbd_summary is null and that
  // is correct (the build script cannot derive a summary it does not have).
  // Real offenders are commands whose serves_jtbd[0] IS in the taxonomy yet
  // still emit a null jtbd_summary -- that is a derivation bug.
  const offenders = registry.commands.filter(
    (c) =>
      Array.isArray(c.serves_jtbd) &&
      c.serves_jtbd.length > 0 &&
      !c.jtbd_summary
  );
  const orphans = offenders.filter((c) => !taxonomyById[c.serves_jtbd[0]]);
  const realOffenders = offenders.filter((c) => taxonomyById[c.serves_jtbd[0]]);
  assert.equal(
    realOffenders.length,
    0,
    realOffenders.length +
      ' commands with valid serves_jtbd missing jtbd_summary (' +
      orphans.length +
      ' orphan references found separately): ' +
      realOffenders.slice(0, 3).map((c) => c.command).join(', ')
  );
});

test('jtbd_label matches capitalize+space-replace of serves_jtbd[0]', () => {
  // Spot-check: for a command with serves_jtbd ['find-bottleneck'],
  // jtbd_label should be 'Find Bottleneck'.
  const sample = registry.commands.find(
    (c) => Array.isArray(c.serves_jtbd) && c.serves_jtbd[0] === 'find-bottleneck'
  );
  if (sample) {
    assert.equal(
      sample.jtbd_label,
      'Find Bottleneck',
      "jtbd_label for find-bottleneck should be 'Find Bottleneck', got '" +
        sample.jtbd_label +
        "'"
    );
  }
  // Generic check: every jtbd_label should match the derivation rule.
  for (const c of registry.commands) {
    if (!Array.isArray(c.serves_jtbd) || c.serves_jtbd.length === 0) continue;
    const id = c.serves_jtbd[0];
    const expected = id
      .split('-')
      .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
    assert.equal(
      c.jtbd_label,
      expected,
      'jtbd_label mismatch for ' +
        c.command +
        ' (serves_jtbd[0]=' +
        id +
        "): expected '" +
        expected +
        "', got '" +
        c.jtbd_label +
        "'"
    );
  }
});

test('jtbd_summary matches taxonomy entry.one_line verbatim', () => {
  for (const c of registry.commands) {
    if (!Array.isArray(c.serves_jtbd) || c.serves_jtbd.length === 0) continue;
    const id = c.serves_jtbd[0];
    const entry = taxonomyById[id];
    if (!entry) continue; // orphan reference -- separate concern.
    assert.equal(
      c.jtbd_summary,
      entry.one_line,
      'jtbd_summary mismatch for ' +
        c.command +
        ': expected verbatim taxonomy one_line'
    );
  }
});
