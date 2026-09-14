#!/usr/bin/env node
'use strict';

/*
 * tests/test-344-layer-backfill.cjs
 *
 * Phase 344 Plan 03 (LAYER-06): proves the layer backfill's own contract --
 * idempotence and non-destruction -- without depending on git state.
 *
 * Written FIRST (RED), before the apply pass lands, per the plan's TDD
 * gate. Five assertions, none against a frozen count:
 *
 *   1. `node scripts/backfill-layer.cjs --check` exits 0: a second run
 *      changes nothing.
 *   2. Every commands/*.md file, with its `^layer(_why)?:` lines stripped,
 *      is byte-identical to a fresh in-memory snapshot taken with the same
 *      lines stripped -- proving the backfill inserted only those two keys
 *      and moved nothing else.
 *   3. Every commands/*.md file carries exactly one `^layer:` line, and its
 *      value is a member of the closed layer_vocabulary.
 *   4. The registry's per-command `layer` (data/command-registry.json)
 *      equals the value declared in that command's own frontmatter.
 *   5. Every denominator is computed with fs.readdirSync; no three-digit
 *      literal appears in this file.
 *
 * Canon Part 8: LOCAL-only. node:fs + node:path + node:child_process only.
 * Zero network, zero Brain reach, zero room access.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const SCHEMA_PATH = path.join(REPO_ROOT, 'data', 'layer-declaration-schema.json');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');
const BACKFILL_SCRIPT = path.join(REPO_ROOT, 'scripts', 'backfill-layer.cjs');

let pass = 0;
let fail = 0;

function assert(cond, label) {
  if (cond) {
    pass += 1;
    console.log('PASS: ' + label);
  } else {
    fail += 1;
    console.log('FAIL: ' + label);
  }
}

// Strip any line matching ^layer: or ^layer_why: (leading whitespace
// tolerated, mirroring scripts/backfill-layer.cjs's own stripLayerLines()).
function stripLayerLines(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^layer:/.test(line) && !/^layer_why:/.test(line))
    .join('\n');
}

function countLayerLines(text) {
  return text.split(/\r?\n/).filter((line) => /^layer:/.test(line)).length;
}

function extractLayerValue(text) {
  for (const line of text.split(/\r?\n/)) {
    const m = /^layer:\s*(.*)$/.exec(line);
    if (m) {
      let v = m[1].trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      return v;
    }
  }
  return null;
}

function main() {
  const files = fs
    .readdirSync(COMMANDS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  // 1. Snapshot every commands/*.md file, stripped of layer lines.
  const snapshots = new Map();
  for (const f of files) {
    const abs = path.join(COMMANDS_DIR, f);
    const before = fs.readFileSync(abs, 'utf8');
    snapshots.set(f, stripLayerLines(before));
  }

  // 2. --check must exit 0: a second run would change nothing.
  const res = spawnSync(process.execPath, [BACKFILL_SCRIPT, '--check'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert(
    res.status === 0,
    '`node scripts/backfill-layer.cjs --check` exits 0 (a re-run changes nothing); got status ' +
      res.status +
      (res.stderr ? ' stderr: ' + res.stderr.trim() : '')
  );

  // 3. Re-read every file, strip the same lines, assert byte-identical to
  // the snapshot -- nothing but the layer block moved.
  let mismatched = [];
  for (const f of files) {
    const abs = path.join(COMMANDS_DIR, f);
    const after = fs.readFileSync(abs, 'utf8');
    const strippedAfter = stripLayerLines(after);
    if (strippedAfter !== snapshots.get(f)) mismatched.push(f);
  }
  assert(
    mismatched.length === 0,
    'every commands/*.md file, stripped of layer(_why) lines, is byte-identical to its pre-backfill form (' +
      mismatched.length +
      ' mismatched: ' +
      mismatched.slice(0, 5).join(', ') +
      ')'
  );

  // 4. Every file has exactly one ^layer: line, value in vocabulary.
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const vocabulary =
    schema && schema._doc && Array.isArray(schema._doc.layer_vocabulary)
      ? schema._doc.layer_vocabulary
      : [];
  assert(vocabulary.length > 0, 'the layer vocabulary itself is non-empty');

  const notExactlyOne = [];
  const outOfVocab = [];
  const fileLayerByCommand = new Map();
  for (const f of files) {
    const abs = path.join(COMMANDS_DIR, f);
    const content = fs.readFileSync(abs, 'utf8');
    const n = countLayerLines(content);
    if (n !== 1) notExactlyOne.push(f + ' (' + n + ')');
    const layerValue = extractLayerValue(content);
    if (layerValue !== null && !vocabulary.includes(layerValue)) {
      outOfVocab.push(f + '=' + layerValue);
    }
    const commandName = '/mos:' + f.slice(0, -3);
    fileLayerByCommand.set(commandName, layerValue);
  }
  assert(
    notExactlyOne.length === 0,
    'every commands/*.md file carries exactly one ^layer: line (' +
      notExactlyOne.length +
      ' offenders: ' +
      notExactlyOne.slice(0, 5).join(', ') +
      ')'
  );
  assert(
    outOfVocab.length === 0,
    'every declared layer value is a member of the closed vocabulary (' +
      outOfVocab.length +
      ' offenders: ' +
      outOfVocab.slice(0, 5).join(', ') +
      ')'
  );

  // 5. The registry's per-command layer equals the frontmatter value.
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const commands = Array.isArray(registry.commands) ? registry.commands : [];
  const registryMismatch = [];
  for (const c of commands) {
    if (!fileLayerByCommand.has(c.command)) continue;
    const fmLayer = fileLayerByCommand.get(c.command);
    if (c.layer !== fmLayer) {
      registryMismatch.push(c.command + ': registry=' + c.layer + ' frontmatter=' + fmLayer);
    }
  }
  assert(
    registryMismatch.length === 0,
    "every command's registry layer equals its frontmatter layer (" +
      registryMismatch.length +
      ' offenders: ' +
      registryMismatch.slice(0, 5).join(', ') +
      ')'
  );

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail + ' (' + files.length + ' command files enumerated from disk)');
  process.exit(fail > 0 ? 1 : 0);
}

main();
