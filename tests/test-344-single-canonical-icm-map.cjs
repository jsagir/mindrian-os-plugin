#!/usr/bin/env node
'use strict';

/*
 * Pins the single-canonical-ICM-map rule (the layer contract phase, the
 * one-canonical-statement-and-three-pointers plan, requirements LAYER-13,
 * LAYER-14, the second-canonical-mapping-reappearing threat).
 *
 * Over a FIXED four-file list, exactly ONE file may carry the full ICM Layer
 * 0 through Layer 4 mapping; the other three must each point at it instead.
 * A fifth statement appearing anywhere later is a deliberate edit to the
 * list below, never a silent miss.
 *
 * Classification rule, read the comment above classifyFile for the full
 * reasoning: a file that names the canonical file elsewhere in its own text
 * is classified as a POINTER even if it also happens to retain raw layer
 * rows for provenance or a different scope (docs/ARCHITECTURE-DEEP-DIVE.md's
 * retained table, templates/icm/CLAUDE.md's fleet-level list). Only a file
 * with the full five-layer mapping AND no such delegation line counts as the
 * canonical FULL_MAPPING file.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const REPO_ROOT = path.resolve(__dirname, '..');

// The declared four-file list. Named here, once, for this plan.
const FIXED_FILES = [
  '.claude/includes/architecture.md',
  'docs/ARCHITECTURE-DEEP-DIVE.md',
  'templates/icm/CLAUDE.md',
  'docs/MINDRIAN-CANON.md',
];

const CANONICAL_MARKER = 'docs/MINDRIAN-CANON.md';
const GHOST_MARKER = /ghost|never built/i;

let pass = 0;
let fail = 0;

function check(label, fn) {
  try {
    fn();
    console.log('PASS: ' + label);
    pass += 1;
  } catch (err) {
    console.log('FAIL: ' + label);
    console.log('  ' + err.message);
    fail += 1;
  }
}

function readFixedFiles() {
  const out = {};
  for (const rel of FIXED_FILES) {
    const abs = path.join(REPO_ROOT, rel);
    assert.ok(fs.existsSync(abs), 'declared file must exist: ' + rel);
    out[rel] = fs.readFileSync(abs, 'utf8');
  }
  return out;
}

// A line-scan, not a table parse (the four files use three different table
// shapes; a brittle parser would need three separate readers). Returns true
// only when all five of Layer 0 through Layer 4 are each named on their own
// distinct line, so a heading like "ICM Layers 0-4" (no per-layer line)
// never counts.
function hasFiveDistinctLayerLines(text) {
  const lines = text.split('\n');
  const matchedLineIndices = new Set();
  for (let layer = 0; layer <= 4; layer += 1) {
    const pattern = new RegExp('\\bLayer\\s*' + layer + '\\b', 'i');
    const idx = lines.findIndex((line) => pattern.test(line));
    if (idx === -1) return false;
    matchedLineIndices.add(idx);
  }
  return matchedLineIndices.size === 5;
}

// A file names the canonical file (the pointer predicate) when its own text
// contains the canonical file's path as a string, anywhere. This is
// deliberately broader than "in a delegation sentence": a superseded banner,
// a scoping sentence, or a deep-dive footer all satisfy it the same way.
function namesCanonicalFile(text) {
  return text.includes(CANONICAL_MARKER);
}

// Classification: a delegation line naming the canonical file elsewhere
// disqualifies a file from FULL_MAPPING even if it also retains raw layer
// rows for provenance (the superseded ARCHITECTURE-DEEP-DIVE.md table) or a
// different scope (the fleet-level list in templates/icm/CLAUDE.md). Only
// docs/MINDRIAN-CANON.md itself, which never names itself, can be
// FULL_MAPPING.
function classifyFile(rel, text) {
  const pointer = namesCanonicalFile(text);
  const fullMapping = hasFiveDistinctLayerLines(text) && !pointer;
  return { rel, pointer, fullMapping };
}

const texts = readFixedFiles();
const classifications = FIXED_FILES.map((rel) => classifyFile(rel, texts[rel]));

check('exactly one of the four declared files is the full ICM L0-L4 mapping', () => {
  const fullMappingFiles = classifications.filter((c) => c.fullMapping).map((c) => c.rel);
  if (fullMappingFiles.length !== 1) {
    assert.fail(
      'expected exactly one full-mapping file, found ' +
        fullMappingFiles.length +
        ': [' +
        fullMappingFiles.join(', ') +
        ']'
    );
  }
});

check('the other three declared files each name the canonical file (the pointer predicate)', () => {
  const nonCanonical = classifications.filter((c) => !c.fullMapping);
  const failing = nonCanonical.filter((c) => !c.pointer).map((c) => c.rel);
  if (failing.length > 0) {
    assert.fail('these non-canonical files do not name the canonical file: [' + failing.join(', ') + ']');
  }
});

check('docs/MINDRIAN-CANON.md is the one full-mapping file (not a pointer)', () => {
  const canon = classifications.find((c) => c.rel === 'docs/MINDRIAN-CANON.md');
  assert.ok(canon.fullMapping, 'docs/MINDRIAN-CANON.md must be the full-mapping file');
  assert.ok(!canon.pointer, 'docs/MINDRIAN-CANON.md must not itself name docs/MINDRIAN-CANON.md as a pointer would');
});

// ---------------------------------------------------------------------------
// The ROUTING.md ghost. Checked over the same declared four-file list: any
// mention of ROUTING.md as a claimed artifact must carry a ghost marker
// within five lines. Files outside this declared list are out of this
// task's scope (scope-boundary rule); a stray unmarked mention elsewhere in
// the repo (docs/IDEA-DOCUMENT.md, an old idea document untouched by this
// plan) is named in deferred-items.md, not fixed or asserted here.
// ---------------------------------------------------------------------------
check('every ROUTING.md mention in the declared files carries a ghost marker within five lines', () => {
  const unmarked = [];
  for (const rel of FIXED_FILES) {
    const lines = texts[rel].split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].includes('ROUTING.md')) continue;
      const windowStart = Math.max(0, i - 5);
      const windowEnd = Math.min(lines.length, i + 6);
      const window = lines.slice(windowStart, windowEnd).join('\n');
      if (!GHOST_MARKER.test(window)) {
        unmarked.push(rel + ':' + (i + 1));
      }
    }
  }
  if (unmarked.length > 0) {
    assert.fail('ROUTING.md mentioned without a nearby ghost marker at: ' + unmarked.join(', '));
  }
});

check('no file named ROUTING.md exists on disk', () => {
  function findRoutingMd(dir) {
    const skip = new Set(['node_modules', '.git']);
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return [];
    }
    let found = [];
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        found = found.concat(findRoutingMd(full));
      } else if (entry.name === 'ROUTING.md') {
        found.push(full);
      }
    }
    return found;
  }
  const hits = findRoutingMd(REPO_ROOT);
  assert.strictEqual(hits.length, 0, 'ROUTING.md must not exist on disk, found: ' + hits.join(', '));
});

// ---------------------------------------------------------------------------
// The superseded table in docs/ARCHITECTURE-DEEP-DIVE.md is retained, not
// deleted. A reader who bookmarked it lands on a correction, not a dead link.
// ---------------------------------------------------------------------------
check('docs/ARCHITECTURE-DEEP-DIVE.md still contains its ICM table (the banner did not become a deletion)', () => {
  assert.ok(
    texts['docs/ARCHITECTURE-DEEP-DIVE.md'].includes('| Layer | Purpose | MindrianOS Name | Budget |'),
    'the original ICM table header must still be present'
  );
  assert.ok(
    /superseded/i.test(texts['docs/ARCHITECTURE-DEEP-DIVE.md']),
    'a superseded banner must be present above the retained table'
  );
});

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
