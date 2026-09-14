#!/usr/bin/env node
'use strict';

/*
 * tests/test-344-registry-layer-lift.cjs
 *
 * Phase 344 Plan 02 (LAYER-06): pins the two-line `layer` lift in
 * scripts/build-command-registry.cjs into data/command-registry.json.
 *
 * Three assertions, each computed rather than literal, so this test stays
 * correct after 344-03's backfill flips the values from null to real
 * vocabulary members:
 *   1. `layer` is an own property of every entry in `commands`.
 *   2. The entry count equals the count of commands/*.md files this test
 *      enumerates itself with fs.readdirSync.
 *   3. Every non-null `layer` value is a member of
 *      data/layer-declaration-schema.json's own `_doc.layer_vocabulary`.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const SCHEMA_PATH = path.join(REPO_ROOT, 'data', 'layer-declaration-schema.json');

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

function main() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const commands = Array.isArray(registry.commands) ? registry.commands : [];

  const missingLayerKey = commands.filter(
    (c) => !Object.prototype.hasOwnProperty.call(c, 'layer')
  );
  assert(
    missingLayerKey.length === 0,
    'every entry in commands carries a layer key (' +
      missingLayerKey.length +
      ' missing: ' +
      missingLayerKey.map((c) => c.command).slice(0, 5).join(', ') +
      ')'
  );

  const expectedCount = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md')).length;
  assert(
    commands.length === expectedCount,
    'entry count (' + commands.length + ') equals commands/*.md count on disk (' + expectedCount + ')'
  );

  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const vocabulary = schema && schema._doc && Array.isArray(schema._doc.layer_vocabulary)
    ? schema._doc.layer_vocabulary
    : [];
  assert(vocabulary.length > 0, 'the layer vocabulary itself is non-empty');

  const badLayers = commands.filter(
    (c) => c.layer !== null && c.layer !== undefined && !vocabulary.includes(c.layer)
  );
  assert(
    badLayers.length === 0,
    'every non-null layer value is a member of the closed vocabulary (' +
      badLayers.length +
      ' offenders: ' +
      badLayers.map((c) => c.command + '=' + c.layer).slice(0, 5).join(', ') +
      ')'
  );

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail > 0 ? 1 : 0);
}

main();
