#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 343 Plan 08 Task 1 (CENSUS-14) -- proves the help family map's layer
 * label reads from data/command-registry.json's generated `layer` field
 * (never re-authored here, never read from commands/*.md frontmatter
 * directly), halts when Phase 344's backfill has not landed, and shows a
 * visible marker for a gap instead of a blank or a guess.
 *
 * Written FIRST (RED), per the plan's task-level TDD gate: at the time this
 * file lands, scripts/help-renderer.cjs exports no buildLayerMap/
 * requireLayerMap and renderHelpCards accepts only (groups, useColor), so
 * every arm below fails for the expected reason (missing export / wrong
 * arity) until Task 1's GREEN commit extends the renderer.
 *
 * Fixture registries are built under os.tmpdir() so the no-layer-field halt
 * case and the partial-backfill gap case are exercised WITHOUT touching the
 * real data/command-registry.json (that file already carries a `layer` on
 * every entry as of 344-03; this test proves the renderer's OWN contract,
 * not today's registry contents).
 *
 * Task 3 appends a "surface arm" section to this same file (commands/help.md
 * naming the registry + the signals doc, no hardcoded vocabulary/count) --
 * inserted before the final tally, per that task's own action text.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RENDERER_PATH = path.join(REPO_ROOT, 'scripts', 'help-renderer.cjs');
const REAL_SCHEMA_PATH = path.join(REPO_ROOT, 'data', 'layer-declaration-schema.json');
const REAL_GROUPS_PATH = path.join(REPO_ROOT, 'data', 'help-groups.json');

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

function assertThrows(fn, label, messageIncludes) {
  try {
    fn();
    fail += 1;
    console.log('FAIL: ' + label + ' (did not throw)');
  } catch (err) {
    const msg = (err && err.message) || String(err);
    if (!messageIncludes || msg.indexOf(messageIncludes) !== -1) {
      pass += 1;
      console.log('PASS: ' + label);
    } else {
      fail += 1;
      console.log('FAIL: ' + label + ' (threw, but message missing "' + messageIncludes + '": ' + msg + ')');
    }
  }
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

// --- Fixtures ----------------------------------------------------------

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'help-layer-label-test-'));

const NO_LAYER_REGISTRY_PATH = path.join(TMP_DIR, 'registry-no-layer.json');
fs.writeFileSync(
  NO_LAYER_REGISTRY_PATH,
  JSON.stringify({ commands: [{ command: '/mos:foo' }, { command: '/mos:bar' }] }),
  'utf8'
);

// A partial-backfill fixture: one valid layer, one command absent from the
// registry entirely (the "gap" case), one out-of-vocabulary value (the
// "rename surfaced" case). At least one entry carries `layer` so the
// dependency gate does NOT trip here -- a partial backfill is not a halt.
const PARTIAL_REGISTRY_PATH = path.join(TMP_DIR, 'registry-partial.json');
fs.writeFileSync(
  PARTIAL_REGISTRY_PATH,
  JSON.stringify({
    commands: [
      { command: '/mos:test-valid', layer: 'graph' },
      { command: '/mos:test-bogus', layer: 'nonexistent-layer' },
      { command: '/mos:something-else', layer: 'loop' },
      // '/mos:test-missing' is deliberately absent from the registry.
    ],
  }),
  'utf8'
);

const FIXTURE_GROUPS = {
  _lanes: { start: 'Start Here Lane' },
  groups: [
    {
      id: 'test-group',
      label: 'Test Group',
      glyph: '*',
      lane: 'start',
      commands: ['test-valid', 'test-missing', 'test-bogus'],
    },
  ],
};

function main() {
  const renderer = require(RENDERER_PATH);

  // --- Arm 1: the dependency gate -------------------------------------
  // No entry anywhere in the registry carries a `layer` key at all ->
  // halt, name 344-03, change nothing (no render happens).
  assert(
    typeof renderer.buildLayerMap === 'function',
    'scripts/help-renderer.cjs exports buildLayerMap'
  );
  if (typeof renderer.buildLayerMap === 'function') {
    const built = renderer.buildLayerMap({
      registryPath: NO_LAYER_REGISTRY_PATH,
      schemaPath: REAL_SCHEMA_PATH,
    });
    assert(
      built && built.anyLayerField === false,
      'buildLayerMap reports anyLayerField=false when no entry carries a `layer` key'
    );
  }

  assert(
    typeof renderer.renderHelp === 'function',
    'scripts/help-renderer.cjs exports renderHelp'
  );
  if (typeof renderer.renderHelp === 'function') {
    assertThrows(
      () =>
        renderer.renderHelp({
          groups: FIXTURE_GROUPS,
          capability: 'ascii',
          registryPath: NO_LAYER_REGISTRY_PATH,
          schemaPath: REAL_SCHEMA_PATH,
        }),
      'renderHelp halts (throws) when no registry entry carries a `layer` key',
      '344-03'
    );
  }

  // --- Arm 2: partial backfill is NOT a halt --------------------------
  let partial = null;
  if (typeof renderer.buildLayerMap === 'function') {
    partial = renderer.buildLayerMap({
      registryPath: PARTIAL_REGISTRY_PATH,
      schemaPath: REAL_SCHEMA_PATH,
    });
    assert(
      partial && partial.anyLayerField === true,
      'buildLayerMap reports anyLayerField=true when at least one entry carries a `layer` key (partial backfill is not a halt)'
    );
    assert(
      partial && partial.map && partial.map.get('/mos:test-valid') === 'graph',
      'a valid layer value is joined onto its command'
    );
    assert(
      partial && partial.offendingValues && partial.offendingValues.has('nonexistent-layer'),
      'an out-of-vocabulary layer value is recorded as an offending value'
    );
  } else {
    assert(false, 'buildLayerMap reports anyLayerField=true when at least one entry carries a `layer` key (partial backfill is not a halt)');
    assert(false, 'a valid layer value is joined onto its command');
    assert(false, 'an out-of-vocabulary layer value is recorded as an offending value');
  }

  // --- Arm 3: the unlabelled marker, never blank, never guessed -------
  assert(
    typeof renderer.UNLABELLED_LAYER_MARKER === 'string' && renderer.UNLABELLED_LAYER_MARKER.length > 0,
    'scripts/help-renderer.cjs exports a non-empty UNLABELLED_LAYER_MARKER token'
  );
  const marker = renderer.UNLABELLED_LAYER_MARKER || '';
  const vocab = ['prompt', 'context', 'harness', 'loop', 'graph'];
  assert(
    !vocab.includes(marker),
    'the unlabelled marker is not itself a member of the layer vocabulary (cannot be mistaken for a layer name)'
  );

  if (typeof renderer.renderHelpCards === 'function' && partial) {
    const asciiOut = renderer.renderHelpCards(FIXTURE_GROUPS, false, partial.map);
    assert(
      asciiOut.indexOf('/mos:test-valid') !== -1 && asciiOut.indexOf('graph') !== -1,
      'a command with a valid layer value renders that layer label'
    );
    assert(
      asciiOut.indexOf(marker) !== -1,
      'a command missing from the registry (the backfill gap) renders the unlabelled marker'
    );
    const bogusLineMatch = asciiOut.split('\n').find((l) => l.indexOf('/mos:test-bogus') !== -1);
    assert(
      !!bogusLineMatch && bogusLineMatch.indexOf(marker) !== -1,
      'a command with an out-of-vocabulary layer value renders the unlabelled marker, not the raw bogus value'
    );
    assert(
      !!bogusLineMatch && bogusLineMatch.indexOf('nonexistent-layer') === -1,
      'the raw out-of-vocabulary value is never rendered onto the card'
    );
    assert(
      asciiOut.indexOf('[]') === -1 && asciiOut.indexOf('[ ]') === -1,
      'the gap never renders as a blank/empty bracket pair'
    );

    // --- Arm 4: truecolor and ascii carry the SAME label text -----------
    const colorOut = renderer.renderHelpCards(FIXTURE_GROUPS, true, partial.map);
    assert(
      stripAnsi(colorOut) === asciiOut,
      'stripping ANSI from the truecolor render yields the SAME text as the ascii render (labels included)'
    );
  } else {
    assert(false, 'a command with a valid layer value renders that layer label');
    assert(false, 'a command missing from the registry (the backfill gap) renders the unlabelled marker');
    assert(false, 'a command with an out-of-vocabulary layer value renders the unlabelled marker, not the raw bogus value');
    assert(false, 'the raw out-of-vocabulary value is never rendered onto the card');
    assert(false, 'the gap never renders as a blank/empty bracket pair');
    assert(false, 'stripping ANSI from the truecolor render yields the SAME text as the ascii render (labels included)');
  }

  // --- Arm 5: the registry is read once, not re-read per card ---------
  if (typeof renderer.renderHelpCards === 'function' && partial) {
    const originalReadFileSync = fs.readFileSync;
    let registryReadDuringRender = 0;
    fs.readFileSync = function (...args) {
      if (typeof args[0] === 'string' && args[0].indexOf('command-registry.json') !== -1) {
        registryReadDuringRender += 1;
      }
      return originalReadFileSync.apply(fs, args);
    };
    try {
      renderer.renderHelpCards(FIXTURE_GROUPS, true, partial.map);
    } finally {
      fs.readFileSync = originalReadFileSync;
    }
    assert(
      registryReadDuringRender === 0,
      'renderHelpCards does not re-read data/command-registry.json when a pre-built layerMap is supplied (built once by the caller, not per card)'
    );
  } else {
    assert(false, 'renderHelpCards does not re-read data/command-registry.json when a pre-built layerMap is supplied (built once by the caller, not per card)');
  }

  // --- Arm 6: the offending value is reported once, not per occurrence -
  if (typeof renderer.requireLayerMap === 'function') {
    const originalWrite = process.stderr.write;
    let stderrText = '';
    process.stderr.write = function (chunk) {
      stderrText += String(chunk);
      return true;
    };
    try {
      renderer.requireLayerMap({ registryPath: PARTIAL_REGISTRY_PATH, schemaPath: REAL_SCHEMA_PATH });
    } finally {
      process.stderr.write = originalWrite;
    }
    const occurrences = stderrText.split('nonexistent-layer').length - 1;
    assert(
      occurrences === 1,
      'the offending out-of-vocabulary value is reported to stderr exactly once, not once per command (got ' + occurrences + ')'
    );
  } else {
    assert(false, 'scripts/help-renderer.cjs exports requireLayerMap');
  }

  // --- Arm 7: data/help-groups.json is never touched -------------------
  const groupsBefore = fs.readFileSync(REAL_GROUPS_PATH, 'utf8');

  // --- Arm 8: the real CLI, unmodified registry, exits 0 with a label --
  const cliResult = spawnSync(process.execPath, [RENDERER_PATH], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert(cliResult.status === 0, '`node scripts/help-renderer.cjs` exits 0 against the real (already-backfilled) registry');
  assert(
    /prompt|context|harness|loop|graph/.test(cliResult.stdout || ''),
    '`node scripts/help-renderer.cjs` output contains at least one real layer label'
  );

  const groupsAfter = fs.readFileSync(REAL_GROUPS_PATH, 'utf8');
  assert(groupsBefore === groupsAfter, 'data/help-groups.json is byte-identical before and after every render in this test');

  // --- Arm 9 (Task 3): the command surface ------------------------------
  // commands/help.md names the generated registry and the signals doc, and
  // never copies the closed layer vocabulary or a per-layer count into its
  // own PROSE (D-04: read from the data file every time, no drifting copy).
  //
  // "This prose" (the plan's own words) means the markdown body Larry reads
  // and follows, NOT the YAML frontmatter block: help.md's own `layer:` /
  // `layer_why:` frontmatter is 344-03's backfill declaring what /mos:help
  // ITSELF is (a single value, a fact this command's own file owns), never
  // a copied list of the five-member vocabulary. `layer_why`'s free-text
  // sentence also happens to use the plain English word "context" and
  // help.md's own layer is "harness" -- neither is the vocabulary being
  // enumerated, so the body-only scan below is the correct scope for the
  // "did we copy the vocabulary as a list" question the plan is asking.
  const HELP_MD_PATH = path.join(REPO_ROOT, 'commands', 'help.md');
  const helpMd = fs.readFileSync(HELP_MD_PATH, 'utf8');
  const helpMdBody = helpMd.replace(/^---\n[\s\S]*?\n---\n/, '');

  assert(
    helpMd.indexOf('data/command-registry.json') !== -1,
    'commands/help.md names data/command-registry.json as the layer source'
  );
  assert(
    helpMd.indexOf('docs/LOOP-VERSUS-GRAPH-SIGNALS.md') !== -1,
    'commands/help.md points at docs/LOOP-VERSUS-GRAPH-SIGNALS.md'
  );

  const vocabHits = ['prompt', 'context', 'harness', 'loop', 'graph'].filter((word) =>
    new RegExp('\\b' + word + '\\b', 'i').test(helpMdBody)
  );
  assert(
    vocabHits.length < 4,
    'commands/help.md prose (frontmatter excluded) does not read as a hardcoded copy of the closed layer vocabulary (hits: ' +
      JSON.stringify(vocabHits) +
      ')'
  );

  // A per-layer count is a number directly beside one of the five layer
  // names (e.g. "18 graph commands") -- NOT the pre-existing, unrelated
  // per-family/per-card counts ("11 command families", "4 options") this
  // file already carries for a different reason.
  assert(
    !/\b\d+\s+(prompt|context|harness|loop|graph)\b/i.test(helpMdBody),
    'commands/help.md prose carries no numeric per-layer count'
  );

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail > 0 ? 1 : 0);
}

main();
