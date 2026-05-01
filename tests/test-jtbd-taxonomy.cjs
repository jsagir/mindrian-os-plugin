#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 100-01 -- schema + content invariants for lib/hmi/jtbd-taxonomy.json
 * (the canonical 12+1 JTBD taxonomy authored by Plan 100-01).
 *
 * Assertions (8):
 *   1. Taxonomy file parses as valid JSON.
 *   2. entries.length === 13.
 *   3. Last entry is `explore` with empty cues[].
 *   4. Every entry has all 8 required fields (id, one_line, cues,
 *      methodology_hooks, next_move_verbs, completion_shape,
 *      operator_affinity, persona_affinity).
 *   5. Every next_move_verbs[] entry is a member of Canon Part 3 ten-verb
 *      vocabulary (no invented verbs).
 *   6. Every methodology_hooks[] entry resolves to an existing
 *      commands/<name>.md file.
 *   7. No two entries share the same id.
 *   8. Every entry has 4-6 next_move_verbs (3 for explore is allowed).
 *
 * Pattern: IIFE harness cloned from tests/test-cascade-side-channel.cjs.
 *   - Each assertion increments a counter and prints PASS/FAIL.
 *   - Final summary line `[N/M passed]`.
 *   - Exits 0 if all pass, 1 if any fail.
 *
 * Registered in lib/memory/run-feynman-tests.cjs (per Phase 100 Plan 100-00).
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TAXONOMY_PATH = path.join(REPO, 'lib', 'hmi', 'jtbd-taxonomy.json');
const COMMANDS_DIR = path.join(REPO, 'commands');

// Canon Part 3 ten-verb vocabulary (docs/MINDRIAN-CANON.md Part 3).
const CANON_VERBS = new Set([
  'Run Methodology',
  'Reformulate',
  'Spawn Sub-Agent',
  'Navigate Graph',
  "Devil's Advocate",
  'Scenario Plan',
  'Synthesize',
  'Bank Opportunity',
  'Defer',
  'Free-Text',
]);

// 8 required per-entry fields per Plan 100-01 schema contract.
const REQUIRED_FIELDS = [
  'id',
  'one_line',
  'cues',
  'methodology_hooks',
  'next_move_verbs',
  'completion_shape',
  'operator_affinity',
  'persona_affinity',
];

let passed = 0;
let failed = 0;

function pass(name) {
  passed += 1;
  process.stdout.write('  ok  ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) {
    process.stdout.write('    ' + (err.message || String(err)) + '\n');
  }
}

// ---------- Test setup ----------

let raw;
let taxonomy;

(function loadTaxonomy() {
  // Assertion 1 -- parses as valid JSON.
  const name = 'taxonomy file parses as valid JSON';
  try {
    raw = fs.readFileSync(TAXONOMY_PATH, 'utf8');
    taxonomy = JSON.parse(raw);
    pass(name);
  } catch (err) {
    fail(name, err);
    // Cannot continue without a parsed object.
    process.stdout.write('\n[' + passed + '/' + (passed + failed) + ' passed]\n');
    process.exit(1);
  }
})();

// ---------- Assertions ----------

(function assertEntryCount() {
  const name = 'entries.length === 13';
  try {
    if (!Array.isArray(taxonomy.entries)) {
      throw new Error('entries is not an array');
    }
    if (taxonomy.entries.length !== 13) {
      throw new Error('expected 13 entries, got ' + taxonomy.entries.length);
    }
    pass(name);
  } catch (err) {
    fail(name, err);
  }
})();

(function assertExploreLast() {
  const name = 'last entry is `explore` with empty cues[]';
  try {
    const last = taxonomy.entries[taxonomy.entries.length - 1];
    if (!last) throw new Error('no last entry');
    if (last.id !== 'explore') {
      throw new Error('last entry id is "' + last.id + '" not "explore"');
    }
    if (!Array.isArray(last.cues)) {
      throw new Error('explore.cues is not an array');
    }
    if (last.cues.length !== 0) {
      throw new Error(
        'explore.cues should be empty, got ' + last.cues.length + ' entries'
      );
    }
    pass(name);
  } catch (err) {
    fail(name, err);
  }
})();

(function assertAllFields() {
  const name = 'every entry has all 8 required fields';
  try {
    for (const e of taxonomy.entries) {
      for (const f of REQUIRED_FIELDS) {
        if (!(f in e)) {
          throw new Error('entry "' + e.id + '" missing field "' + f + '"');
        }
      }
    }
    pass(name);
  } catch (err) {
    fail(name, err);
  }
})();

(function assertCanonVerbs() {
  const name = 'every next_move_verbs[] entry is in Canon Part 3 ten-verb set';
  try {
    for (const e of taxonomy.entries) {
      if (!Array.isArray(e.next_move_verbs)) {
        throw new Error(
          'entry "' + e.id + '" next_move_verbs is not an array'
        );
      }
      for (const v of e.next_move_verbs) {
        if (!CANON_VERBS.has(v)) {
          throw new Error(
            'non-canon verb "' + v + '" in entry "' + e.id + '"'
          );
        }
      }
    }
    pass(name);
  } catch (err) {
    fail(name, err);
  }
})();

(function assertHooksExist() {
  const name = 'every methodology_hooks[] resolves to commands/<name>.md';
  try {
    for (const e of taxonomy.entries) {
      if (!Array.isArray(e.methodology_hooks)) {
        throw new Error(
          'entry "' + e.id + '" methodology_hooks is not an array'
        );
      }
      for (const h of e.methodology_hooks) {
        if (typeof h !== 'string' || !h.startsWith('/mos:')) {
          throw new Error(
            'malformed hook "' + h + '" in entry "' + e.id + '"'
          );
        }
        const cmdName = h.replace(/^\/mos:/, '');
        const cmdPath = path.join(COMMANDS_DIR, cmdName + '.md');
        if (!fs.existsSync(cmdPath)) {
          throw new Error(
            'missing command file "' + cmdPath + '" for hook "' + h +
            '" in entry "' + e.id + '"'
          );
        }
      }
    }
    pass(name);
  } catch (err) {
    fail(name, err);
  }
})();

(function assertUniqueIds() {
  const name = 'no two entries share the same id';
  try {
    const seen = new Set();
    for (const e of taxonomy.entries) {
      if (seen.has(e.id)) {
        throw new Error('duplicate id "' + e.id + '"');
      }
      seen.add(e.id);
    }
    if (seen.size !== 13) {
      throw new Error(
        'expected 13 unique ids, got ' + seen.size
      );
    }
    pass(name);
  } catch (err) {
    fail(name, err);
  }
})();

(function assertVerbCount() {
  const name = 'every entry has 4-6 next_move_verbs (3 allowed for explore)';
  try {
    for (const e of taxonomy.entries) {
      const n = e.next_move_verbs.length;
      if (e.id === 'explore') {
        if (n < 3 || n > 6) {
          throw new Error(
            'explore has ' + n + ' verbs, expected 3-6'
          );
        }
      } else {
        if (n < 4 || n > 6) {
          throw new Error(
            'entry "' + e.id + '" has ' + n + ' verbs, expected 4-6'
          );
        }
      }
    }
    pass(name);
  } catch (err) {
    fail(name, err);
  }
})();

// ---------- Final summary ----------

const total = passed + failed;
process.stdout.write('\n[' + passed + '/' + total + ' passed]\n');
process.exit(failed === 0 ? 0 : 1);
