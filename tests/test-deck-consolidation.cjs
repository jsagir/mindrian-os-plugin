#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 175-03 -- test-deck-consolidation.cjs
 *
 * The behavior + consolidation proof for the /mos:deck phase. Every assertion
 * is data-driven or process-exit-driven (never subjective). Node built-ins only
 * (assert, child_process, fs, os, path). Zero Brain, zero network (Canon Part 8).
 *
 * Proves the 8 phase behaviors:
 *   (1) THREE DISTINCT ROUTES   -- feynman/heart/mesh each route_to distinctly;
 *                                  mesh.composes === ["feynman","heart"].
 *   (2) HEART 5 SECTIONS        -- 5 sections, letters H/E/A/R/T in order, every
 *                                  fill_source === "local-room-content" (Part 8).
 *   (3) FEYNMAN DETERMINISM     -- the 6 stage ids are a fixed ordered list,
 *                                  identical on a second read (deep-equal).
 *   (4) RULESET --check WARNS   -- check-deck-design.cjs over a deck with a missing
 *                                  source link AND a missing AI-image provenance
 *                                  footer exits 0 with WARN lines on stderr.
 *   (5) MAKE-LAND REPOINT       -- publish-needs.json has zero MOSDeckEngine
 *                                  resolves_to and >=1 make-land job -> /mos:deck.
 *   (6) ALIAS RESOLUTION        -- deck-aliases.json maps both handles -> /mos:deck;
 *                                  skills/mos-deck-engine/SKILL.md still exists and
 *                                  references /mos:deck (deprecate-not-delete).
 *   (7) PART 8 SWEEP            -- commands/deck.md states the Brain->local
 *                                  methodology direction and that room content
 *                                  does not egress to Brain.
 *   (8) NO EM-DASHES           -- commands/deck.md, data/deck-styles.json,
 *                                  data/deck-aliases.json carry no em/en-dash.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const p = (...parts) => path.join(REPO_ROOT, ...parts);
const readJson = (rel) => JSON.parse(fs.readFileSync(p(rel), 'utf8'));
const readText = (rel) => fs.readFileSync(p(rel), 'utf8');

let passed = 0;
function check(label, fn) {
  fn();
  passed++;
  console.log('  ok  ' + label);
}

console.log('test-deck-consolidation:');

// ---------------------------------------------------------------------------
// (1) THREE DISTINCT ROUTES
// ---------------------------------------------------------------------------
check('(1) three styles route distinctly + mesh composes feynman+heart', () => {
  const styles = readJson('data/deck-styles.json').styles;
  assert.ok(Array.isArray(styles), 'styles[] is an array');
  const ids = styles.map((s) => s.id);
  assert.deepStrictEqual(
    ids.slice().sort(),
    ['feynman', 'heart', 'mesh'],
    'exactly feynman/heart/mesh declared'
  );
  const routes = styles.map((s) => s.routes_to);
  assert.strictEqual(
    new Set(routes).size,
    3,
    'all three routes_to values are distinct'
  );
  const mesh = styles.find((s) => s.id === 'mesh');
  assert.deepStrictEqual(
    mesh.composes,
    ['feynman', 'heart'],
    'mesh.composes === ["feynman","heart"]'
  );
});

// ---------------------------------------------------------------------------
// (2) HEART 5 SECTIONS
// ---------------------------------------------------------------------------
check('(2) HEART emits 5 sections spelling H/E/A/R/T, all local-content fill', () => {
  const heart = readJson('data/deck-styles.json').heart_sections;
  assert.ok(Array.isArray(heart), 'heart_sections[] is an array');
  assert.strictEqual(heart.length, 5, 'exactly 5 HEART sections');
  assert.deepStrictEqual(
    heart.map((s) => s.letter),
    ['H', 'E', 'A', 'R', 'T'],
    'letters spell H/E/A/R/T in order'
  );
  heart.forEach((s) => {
    assert.strictEqual(
      s.fill_source,
      'local-room-content',
      'fill_source is local-room-content (Part 8): ' + s.id
    );
  });
});

// ---------------------------------------------------------------------------
// (3) FEYNMAN DETERMINISM
// ---------------------------------------------------------------------------
check('(3) Feynman is a fixed ordered 6-stage list (deterministic across reads)', () => {
  const first = readJson('data/deck-styles.json').feynman_stages.map((s) => s.id);
  const second = readJson('data/deck-styles.json').feynman_stages.map((s) => s.id);
  assert.strictEqual(first.length, 6, 'exactly 6 Feynman stages');
  assert.deepStrictEqual(first, second, 'the stage id list is identical on a second read');
  assert.deepStrictEqual(
    first,
    [
      'reduce-to-essence',
      'translate',
      'expose-confusion',
      'build-mental-models',
      'simplify-until-breaks',
      'teach-it-back'
    ],
    'the 6 stage ids are the fixed ordered mos-deck-engine pipeline'
  );
});

// ---------------------------------------------------------------------------
// (4) RULESET --check WARNS NOT FAILS
// ---------------------------------------------------------------------------
check('(4) check-deck-design.cjs WARNs (exit 0) on a non-conformant deck', () => {
  // A deck with a sourced claim that has NO href AND an AI-generated image with
  // NO conformant provenance footer AND a logo that does not bind to mindrian-os.com.
  const fixture =
    '<html><body>' +
    '<a class="logo" href="https://example.com">logo</a>' +
    '<p data-sourced>An unlinked sourced claim.</p>' +
    '<img data-ai src="x.png" alt="generated">' +
    '</body></html>';
  const tmp = path.join(os.tmpdir(), 'deck-consolidation-fixture-' + process.pid + '.html');
  fs.writeFileSync(tmp, fixture, 'utf8');
  try {
    const res = spawnSync('node', [p('scripts/check-deck-design.cjs'), tmp], {
      encoding: 'utf8'
    });
    assert.strictEqual(res.status, 0, 'WARN-first: the --check exits 0 even with warnings (D-04d)');
    assert.ok(
      /\[deck-design WARN\]/.test(res.stderr),
      'at least one [deck-design WARN] line is printed to stderr'
    );
  } finally {
    try { fs.unlinkSync(tmp); } catch (_e) { /* ignore */ }
  }
});

// ---------------------------------------------------------------------------
// (5) MAKE-LAND REPOINT
// ---------------------------------------------------------------------------
check('(5) make-land lane repoints to /mos:deck (no MOSDeckEngine resolves_to)', () => {
  const jobs = readJson('data/publish-needs.json').jobs;
  assert.ok(Array.isArray(jobs), 'jobs[] is an array');
  assert.strictEqual(
    jobs.filter((j) => j.resolves_to === 'MOSDeckEngine').length,
    0,
    'zero jobs still resolve_to MOSDeckEngine'
  );
  const deckMakeLand = jobs.filter(
    (j) => j.lane === 'make-land' && j.resolves_to === '/mos:deck'
  );
  assert.ok(
    deckMakeLand.length >= 1,
    'at least one make-land job resolves_to /mos:deck'
  );
});

// ---------------------------------------------------------------------------
// (6) ALIAS RESOLUTION
// ---------------------------------------------------------------------------
check('(6) both handles alias to /mos:deck; SKILL.md retained (deprecate-not-delete)', () => {
  const aliases = readJson('data/deck-aliases.json');
  assert.strictEqual(aliases.MOSDeckEngine, '/mos:deck', 'MOSDeckEngine -> /mos:deck');
  assert.strictEqual(aliases['feynman-engine'], '/mos:deck', 'feynman-engine -> /mos:deck');
  assert.ok(
    fs.existsSync(p('skills/mos-deck-engine/SKILL.md')),
    'skills/mos-deck-engine/SKILL.md still exists (not deleted)'
  );
  const skill = readText('skills/mos-deck-engine/SKILL.md');
  assert.ok(/\/mos:deck/.test(skill), 'the retained SKILL.md references /mos:deck');
  assert.ok(/connector:/.test(skill), 'the SKILL.md keeps its connector: block (stays WIRED)');
});

// ---------------------------------------------------------------------------
// (7) PART 8 SWEEP
// ---------------------------------------------------------------------------
check('(7) deck.md states the Brain->local methodology boundary (room content does not egress)', () => {
  const deck = readText('commands/deck.md');
  // The Brain-to-local methodology direction.
  assert.ok(
    /Brain\s*->\s*local/.test(deck),
    'deck.md states the methodology flows Brain -> local'
  );
  // The room content does NOT flow to Brain.
  assert.ok(
    /content NEVER flows local -> Brain/i.test(deck) ||
      /content never reaches Brain/i.test(deck) ||
      /never flows local -> Brain/i.test(deck),
    'deck.md states room content never egresses to Brain (Part 8)'
  );
});

// ---------------------------------------------------------------------------
// (8) NO EM-DASHES
// ---------------------------------------------------------------------------
check('(8) no em-dash or en-dash in deck.md / deck-styles.json / deck-aliases.json', () => {
  const targets = ['commands/deck.md', 'data/deck-styles.json', 'data/deck-aliases.json'];
  targets.forEach((rel) => {
    const text = readText(rel);
    assert.ok(
      !/[\u2014\u2013]/.test(text),
      'no em-dash (U+2014) or en-dash (U+2013) in ' + rel
    );
  });
});

console.log('test-deck-consolidation: ' + passed + '/' + passed + ' checks passed');
process.exit(0);
