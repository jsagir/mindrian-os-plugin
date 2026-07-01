#!/usr/bin/env node
'use strict';

/*
 * Phase 188-02 (SFS-07, D-11) - the pure-code hitl_stages DECLARATION validator gate.
 *
 * hitl_stages is 'an engine is a pipeline of shapes': a surface declares an ordered
 * list of {stage, shapes[], mode} composing the closed F.0-F.9 shape set. This gate
 * READS data/hitl-stages-schema.json (the registry-is-the-table contract + the
 * vocabulary enums) and validates every fixture under data/hitl-stages-fixtures/
 * against it, by PURE CODE:
 *
 *   (1) surface is a non-empty string;
 *   (2) hitl_stages is a non-empty ordered array;
 *   (3) every stage has a non-empty stage name;
 *   (4) every stage has a non-empty shapes[] whose every id is in shape_vocabulary
 *       (the closed ten F.0-F.9), independent of whether a renderer has landed;
 *   (5) every stage mode is in mode_vocabulary (parallel | ordered | gate).
 *
 * DECLARATION ONLY (Pitfall 2): this gate does NOT execute a fixture end-to-end and
 * does NOT re-implement runChain's gated loop. hitl_stages composes SHAPES; runChain
 * chains COMMANDS. The only seam is mode:gate, which this gate DECLARES (accepts as a
 * valid mode), never wires.
 *
 * Canon Part 8 (The Graph Boundary): LOCAL-only. node:fs + node:path ONLY. Makes ZERO
 * Brain reads/writes and ZERO network calls; runs no inference and consults no agent.
 * CI-stable and reproducible: same schema + same fixtures -> same verdict.
 *
 * Fail closed: on ANY violation the gate prints a self-naming error + a recovery line
 * and process.exit(1). On a clean run it prints 'hitl-stages: OK' and exits 0.
 * check() is exported for the test harness (the check() -> {valid, violations} shape,
 * mirroring scripts/check-help-coverage.cjs; the --check exit contract mirrors
 * scripts/check-render-coverage.cjs).
 *
 * Usage:
 *   node scripts/check-hitl-stages.cjs
 *       validate the schema + all fixtures; exit 1 on any violation, else exit 0
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'data', 'hitl-stages-schema.json');
const FIXTURES_DIR = path.join(REPO_ROOT, 'data', 'hitl-stages-fixtures');

// ---------------------------------------------------------------------------
// loadSchema() -- read the declaration contract + vocabulary enums. Pure read; no
// network. Returns { modeVocabulary:Set, shapeVocabulary:Set } or a fatal.
// ---------------------------------------------------------------------------
function loadSchema() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    return { fatal: 'data/hitl-stages-schema.json not found' };
  }
  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  } catch (e) {
    return { fatal: 'data/hitl-stages-schema.json is not valid JSON: ' + e.message };
  }
  const doc = schema && schema._doc;
  if (
    !doc ||
    !Array.isArray(doc.mode_vocabulary) ||
    !Array.isArray(doc.shape_vocabulary) ||
    doc.mode_vocabulary.length === 0 ||
    doc.shape_vocabulary.length === 0
  ) {
    return { fatal: 'data/hitl-stages-schema.json is missing _doc.mode_vocabulary or _doc.shape_vocabulary' };
  }
  return {
    modeVocabulary: new Set(doc.mode_vocabulary),
    shapeVocabulary: new Set(doc.shape_vocabulary),
  };
}

// ---------------------------------------------------------------------------
// check(fixture, vocab) -- THE PINNED validation predicate over ONE fixture record.
// Pure code, deterministic, no LLM, no network. Returns
//   { valid:boolean, surface:string, violations:string[] }.
// When vocab is omitted it is loaded from the on-disk schema (so a caller can pass a
// synthetic fixture and get a real verdict, the check-help-coverage export shape).
// ---------------------------------------------------------------------------
function check(fixture, vocab) {
  const violations = [];

  let modeVocabulary;
  let shapeVocabulary;
  if (vocab && vocab.modeVocabulary && vocab.shapeVocabulary) {
    modeVocabulary = vocab.modeVocabulary;
    shapeVocabulary = vocab.shapeVocabulary;
  } else {
    const loaded = loadSchema();
    if (loaded.fatal) {
      return { valid: false, surface: '', violations: [loaded.fatal] };
    }
    modeVocabulary = loaded.modeVocabulary;
    shapeVocabulary = loaded.shapeVocabulary;
  }

  const surface =
    fixture && typeof fixture.surface === 'string' ? fixture.surface : '';

  // (1) surface is a non-empty string.
  if (!surface || surface.trim().length === 0) {
    violations.push('surface is missing or not a non-empty string');
  }

  const label = surface || '<unnamed>';

  // (2) hitl_stages is a non-empty ordered array.
  const stages = fixture ? fixture.hitl_stages : undefined;
  if (!Array.isArray(stages) || stages.length === 0) {
    violations.push(
      'surface ' + label + ': hitl_stages is missing or is not a non-empty array'
    );
    return { valid: violations.length === 0, surface, violations };
  }

  stages.forEach((stage, i) => {
    const at = 'surface ' + label + ' stage[' + i + ']';

    // (3) non-empty stage name.
    if (!stage || typeof stage.stage !== 'string' || stage.stage.trim().length === 0) {
      violations.push(at + ': missing a non-empty stage name');
    }

    // (4) non-empty shapes[] of in-vocabulary shape ids.
    if (!Array.isArray(stage.shapes) || stage.shapes.length === 0) {
      violations.push(at + ': shapes[] is missing or empty');
    } else {
      for (const s of stage.shapes) {
        if (!shapeVocabulary.has(s)) {
          violations.push(
            at + ': unknown shape id "' + s + '" (not in the closed F.0-F.9 set)'
          );
        }
      }
    }

    // (5) mode in mode_vocabulary.
    if (!modeVocabulary.has(stage.mode)) {
      violations.push(
        at + ': unknown mode "' + stage.mode + '" (not in {parallel, ordered, gate})'
      );
    }
  });

  return { valid: violations.length === 0, surface, violations };
}

// ---------------------------------------------------------------------------
// checkAll() -- validate the schema + every fixture. Returns
//   { valid:boolean, fixtures:number, violations:string[] }.
// ---------------------------------------------------------------------------
function checkAll() {
  const vocab = loadSchema();
  if (vocab.fatal) {
    return { valid: false, fixtures: 0, violations: [vocab.fatal] };
  }

  if (!fs.existsSync(FIXTURES_DIR)) {
    return {
      valid: false,
      fixtures: 0,
      violations: ['data/hitl-stages-fixtures/ not found'],
    };
  }

  const files = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const violations = [];
  for (const f of files) {
    let fixture;
    try {
      fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, f), 'utf8'));
    } catch (e) {
      violations.push(f + ': not valid JSON: ' + e.message);
      continue;
    }
    const r = check(fixture, vocab);
    for (const v of r.violations) violations.push(f + ': ' + v);
  }

  return { valid: violations.length === 0, fixtures: files.length, violations };
}

// ---------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------
function main() {
  const report = checkAll();

  if (!report.valid) {
    console.error('HITL-STAGES VIOLATION:');
    for (const v of report.violations) console.error('  - ' + v);
    console.error(
      'Recovery: fix the fixture(s) so every stage has a non-empty name, a non-empty ' +
        'shapes[] of ids in the closed F.0-F.9 set, and a mode in {parallel, ordered, ' +
        'gate}; see data/hitl-stages-schema.json.'
    );
    process.exit(1);
  }

  console.log('hitl-stages: OK (' + report.fixtures + ' fixtures)');
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    loadSchema,
    check,
    checkAll,
  };
}
