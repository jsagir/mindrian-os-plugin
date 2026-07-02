#!/usr/bin/env node
'use strict';

/*
 * Phase 190-02 (SFD-03) - unit tests for the HITL Shape-F backfill generator.
 *
 * Proves patchSurface's contract across BOTH surface shapes (command + skill):
 *   - insert-after-body_shape (a command WITH body_shape:)
 *   - append-at-end-of-frontmatter (a skill with NO body_shape: but WITH a
 *     nested connector: block that must survive byte-identical)
 *   - the hitl_stages (form B) multi-stage nested-array emission
 *   - idempotency (patch, then patch the result -> byte-identical)
 *   - malformed input (no frontmatter block -> throws, never silently appends)
 * Plus an end-to-end runBackfill() pass over a TEMP fixture directory proving
 * the apply/check modes touch ONLY files named as keys in the map (a file absent
 * from the map is never opened for write) and that a second run is a no-op.
 *
 * Zero dependencies: node:assert + node:fs + node:os + node:path only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gen = require('./backfill-hitl-shape.cjs');

let passed = 0;
function ok(name) {
  passed += 1;
  console.log('  ok - ' + name);
}

// ---------------------------------------------------------------------------
// Fixture 1: a command WITH body_shape: (form A). hitl_shape/hitl_why must be
// inserted immediately AFTER the body_shape: line, every other line untouched.
// ---------------------------------------------------------------------------
{
  const input = [
    '---',
    'name: lean-canvas',
    'body_shape: "methodology"',
    'serves_jtbd: ["prepare-pitch"]',
    'connector:',
    '  connects_to_spine: true',
    '  surface: F.8',
    '---',
    '',
    '# Lean Canvas body prose',
    'A second body line.',
    '',
  ].join('\n');
  const entry = { hitl_shape: 'F.8', hitl_why: 'The nine blocks are an any-order basket.' };
  const out = gen.patchSurface(input, entry);

  assert.ok(out.includes('hitl_shape: "F.8"'), 'emits hitl_shape');
  assert.ok(out.includes('hitl_why: "The nine blocks are an any-order basket."'), 'emits hitl_why');
  // inserted directly after body_shape, before serves_jtbd
  const lines = out.split('\n');
  const bi = lines.findIndex((l) => l.startsWith('body_shape:'));
  assert.strictEqual(lines[bi + 1], 'hitl_shape: "F.8"', 'hitl_shape sits right after body_shape');
  assert.strictEqual(lines[bi + 2], 'hitl_why: "The nine blocks are an any-order basket."', 'hitl_why follows');
  assert.strictEqual(lines[bi + 3], 'serves_jtbd: ["prepare-pitch"]', 'serves_jtbd preserved after insert');
  // body prose and connector block untouched
  assert.ok(out.includes('# Lean Canvas body prose\nA second body line.'), 'body prose byte-identical');
  assert.ok(out.includes('connector:\n  connects_to_spine: true\n  surface: F.8'), 'connector block byte-identical');
  ok('Fixture 1: command with body_shape inserts after body_shape');
}

// ---------------------------------------------------------------------------
// Fixture 2: a command WITHOUT body_shape: (form A). Appends at the END of the
// frontmatter block, immediately before the closing ---.
// ---------------------------------------------------------------------------
{
  const input = [
    '---',
    'name: status',
    'serves_jtbd: ["orient"]',
    '---',
    '',
    '# Status body',
    '',
  ].join('\n');
  const entry = { hitl_shape: 'F.1', hitl_why: 'Status offers one next move.' };
  const out = gen.patchSurface(input, entry);
  const lines = out.split('\n');
  const closeIdx = lines.indexOf('---', 1); // second '---'
  assert.strictEqual(lines[closeIdx - 2], 'hitl_shape: "F.1"', 'hitl_shape appended near end');
  assert.strictEqual(lines[closeIdx - 1], 'hitl_why: "Status offers one next move."', 'hitl_why last frontmatter line');
  assert.ok(out.includes('# Status body'), 'body preserved');
  ok('Fixture 2: command without body_shape appends at end of frontmatter');
}

// ---------------------------------------------------------------------------
// Fixture 3: form B (hitl_stages), a multi-stage command WITH body_shape.
// Emits a nested YAML list of {stage, shapes[], mode}.
// ---------------------------------------------------------------------------
{
  const input = [
    '---',
    'name: act',
    'body_shape: E (Action Report) + F.1 (Next-Move gate)',
    'kind: meta',
    '---',
    '',
    '# Act body',
    '',
  ].join('\n');
  const entry = {
    hitl_stages: [
      { stage: 'best-pick', shapes: ['F.7'], mode: 'gate' },
      { stage: 'ordered-chain', shapes: ['F.2', 'F.9'], mode: 'ordered' },
    ],
    hitl_why: 'Act has three modes in one file.',
  };
  const out = gen.patchSurface(input, entry);
  assert.ok(out.includes('hitl_stages:'), 'emits hitl_stages key');
  assert.ok(out.includes('  - stage: "best-pick"'), 'emits first stage');
  assert.ok(out.includes('    shapes: ["F.7"]'), 'emits single-shape array');
  assert.ok(out.includes('    mode: "gate"'), 'emits first mode');
  assert.ok(out.includes('  - stage: "ordered-chain"'), 'emits second stage');
  assert.ok(out.includes('    shapes: ["F.2", "F.9"]'), 'emits multi-shape array');
  assert.ok(out.includes('    mode: "ordered"'), 'emits second mode');
  assert.ok(out.includes('hitl_why: "Act has three modes in one file."'), 'emits hitl_why');
  // stages block sits after body_shape, before kind:
  const lines = out.split('\n');
  const bi = lines.findIndex((l) => l.startsWith('body_shape:'));
  assert.strictEqual(lines[bi + 1], 'hitl_stages:', 'hitl_stages right after body_shape');
  assert.ok(out.includes('kind: meta'), 'kind: preserved after the stages block');
  ok('Fixture 3: form B emits nested hitl_stages array');
}

// ---------------------------------------------------------------------------
// Fixture 4: idempotency. Patching an already-conformant file returns it
// byte-identical (a second patch is a no-op).
// ---------------------------------------------------------------------------
{
  const input = [
    '---',
    'name: lean-canvas',
    'body_shape: "methodology"',
    'connector:',
    '  surface: F.8',
    '---',
    '',
    '# body',
    '',
  ].join('\n');
  const entry = { hitl_shape: 'F.8', hitl_why: 'why.' };
  const once = gen.patchSurface(input, entry);
  const twice = gen.patchSurface(once, entry);
  assert.strictEqual(twice, once, 'second patch is byte-identical (idempotent)');
  ok('Fixture 4: patchSurface is idempotent');
}

// ---------------------------------------------------------------------------
// Fixture 5: a SKILL-shaped file with a nested connector: block and NO
// body_shape:. The connector: block (including its own nested surface: key)
// must survive byte-identical; the shape fields append at the end of the
// frontmatter, as ROOT-level siblings of connector:, never inside it.
// ---------------------------------------------------------------------------
{
  const connectorBlock = [
    'connector:',
    '  connects_to_spine: true',
    '  sensor_triggers: []',
    '  reach_id: brain_consult',
    '  sub_mode: mullins-scaffold',
    '  posture: hold',
    '  hierarchy_rank: 13',
    '  filing: fileEvidenceWithReadback',
    '  plan_gated: false',
    '  web_scope: null',
    '  surface: F.1',
  ].join('\n');
  const input = [
    '---',
    'name: mullins-scaffold',
    'description: >',
    '  Room scaffolding around the Mullins Seven Domains.',
    '# --- Phase 143.3 connector frontmatter ---',
    connectorBlock,
    '---',
    '',
    '# Skill body prose',
    '',
  ].join('\n');
  const entry = { hitl_shape: 'F.1', hitl_why: 'Each of the seven domain folders is offered at an F.1 gate.' };
  const out = gen.patchSurface(input, entry);

  // the entire connector block survives byte-identical
  assert.ok(out.includes(connectorBlock), 'nested connector: block byte-identical');
  // shape fields appended AFTER the connector block, at end of frontmatter
  const lines = out.split('\n');
  const closeIdx = lines.indexOf('---', 1);
  assert.strictEqual(lines[closeIdx - 2], 'hitl_shape: "F.1"', 'hitl_shape appended after connector, at end');
  assert.strictEqual(
    lines[closeIdx - 1],
    'hitl_why: "Each of the seven domain folders is offered at an F.1 gate."',
    'hitl_why is the last frontmatter line'
  );
  // hitl_shape is a ROOT-level line (no leading whitespace), not nested in connector
  assert.ok(/\nhitl_shape: /.test(out), 'hitl_shape is a root-level sibling, not indented into connector');
  // idempotent on the skill shape too
  assert.strictEqual(gen.patchSurface(out, entry), out, 'skill patch is idempotent');
  ok('Fixture 5: skill-shaped nested connector block survives, shape appends at end');
}

// ---------------------------------------------------------------------------
// Fixture 6: malformed input (no frontmatter block) must throw, never silently
// append a new frontmatter block to a bodiless file.
// ---------------------------------------------------------------------------
{
  const input = '# Just a heading, no frontmatter\n\nsome body\n';
  assert.throws(
    () => gen.patchSurface(input, { hitl_shape: 'F.1', hitl_why: 'x' }),
    /frontmatter/i,
    'throws on a file with no frontmatter block'
  );
  ok('Fixture 6: malformed input throws');
}

// ---------------------------------------------------------------------------
// End-to-end: runBackfill() over a TEMP fixture directory. Proves apply mode
// writes ONLY mapped files, an unmapped file is never touched, and a second run
// (and --check) reports zero pending changes (the idempotency invariant).
// ---------------------------------------------------------------------------
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hitl-backfill-'));
  fs.mkdirSync(path.join(tmp, 'commands'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'skills', 'mapped-skill'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'skills', 'exempt-skill'), { recursive: true });

  const cmd = [
    '---',
    'name: foo',
    'body_shape: "methodology"',
    '---',
    '',
    '# foo body',
    '',
  ].join('\n');
  const mappedSkill = [
    '---',
    'name: mapped-skill',
    'connector:',
    '  connects_to_spine: true',
    '  surface: F.1',
    '---',
    '',
    '# skill body',
    '',
  ].join('\n');
  const exemptSkill = [
    '---',
    'name: exempt-skill',
    'connector:',
    '  excluded: true',
    '  reason: "ambient infra"',
    '---',
    '',
    '# exempt body',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(tmp, 'commands', 'foo.md'), cmd);
  fs.writeFileSync(path.join(tmp, 'skills', 'mapped-skill', 'SKILL.md'), mappedSkill);
  fs.writeFileSync(path.join(tmp, 'skills', 'exempt-skill', 'SKILL.md'), exemptSkill);

  const map = {
    'commands/foo.md': { hitl_shape: 'F.8', hitl_why: 'foo why.' },
    'skills/mapped-skill/SKILL.md': { hitl_shape: 'F.1', hitl_why: 'mapped why.' },
  };

  // --check on a clean tree: both mapped files would change, exempt never listed
  const check1 = gen.runBackfill({ map, rootDir: tmp, check: true });
  assert.strictEqual(check1.wouldChange.length, 2, 'check reports 2 pending changes on clean tree');
  assert.strictEqual(check1.changed.length, 0, 'check mode writes nothing');
  // check mode must not have mutated disk
  assert.strictEqual(fs.readFileSync(path.join(tmp, 'commands', 'foo.md'), 'utf8'), cmd, 'check left foo untouched');

  // apply: writes the 2 mapped files
  const apply1 = gen.runBackfill({ map, rootDir: tmp, check: false });
  assert.strictEqual(apply1.changed.length, 2, 'apply writes 2 files');
  const fooAfter = fs.readFileSync(path.join(tmp, 'commands', 'foo.md'), 'utf8');
  assert.ok(fooAfter.includes('hitl_shape: "F.8"'), 'foo got its shape');

  // the exempt (unmapped) skill is byte-identical: never opened for write
  assert.strictEqual(
    fs.readFileSync(path.join(tmp, 'skills', 'exempt-skill', 'SKILL.md'), 'utf8'),
    exemptSkill,
    'unmapped exempt skill is byte-identical after apply'
  );

  // second apply: zero further writes (idempotent)
  const apply2 = gen.runBackfill({ map, rootDir: tmp, check: false });
  assert.strictEqual(apply2.changed.length, 0, 'second apply is a no-op');

  // --check after apply: zero pending
  const check2 = gen.runBackfill({ map, rootDir: tmp, check: true });
  assert.strictEqual(check2.wouldChange.length, 0, 'check reports zero pending after apply');

  fs.rmSync(tmp, { recursive: true, force: true });
  ok('End-to-end: runBackfill applies only mapped files and is idempotent');
}

console.log('\nAll ' + passed + ' backfill generator assertions passed.');
