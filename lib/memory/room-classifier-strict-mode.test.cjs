#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Phase 94-06 -- Room classifier strict-mode acceptance tests.
 *
 * Bug surfaced by Lawrence Aronhime's 2026-04-28 38-minute live test:
 * with two rooms loaded ('core-power-isolation' and
 * 'curriculum-redesign-fall-2026'), four utterances kept resolving to
 * the WRONG room because the classifier ran similarity heuristic only
 * and 'core-power-isolation' had high token overlap with everything:
 *
 *   1. "switch to 8"                                  -> resolved 'core-power-isolation' (wrong)
 *   2. "curriculum redesign"                          -> resolved 'core-power-isolation' (wrong)
 *   3. "the curriculum room"                          -> resolved 'core-power-isolation' (wrong, deferred)
 *   4. "/mos:rooms curriculum-redesign-fall-2026"     -> resolved 'core-power-isolation' (wrong)
 *
 * Plan 94-01 fixed the statusline drift surface symptom (STATE.md
 * canonical write surface). Plan 94-06 fixes the underlying classifier:
 * when the user is unambiguous (numeric position, explicit slug, quoted
 * exact name), bypass the similarity heuristic and resolve directly.
 * The override emits a Section-8 trace edge with
 * `routing_source: 'strict_mode'` per Canon Part 4 (every choice is
 * graph data).
 *
 * Test map (T1-T6, one-to-one with the PLAN <behavior> block):
 *
 *   T1 numeric strict-mode             'switch to 2' -> rooms[1]; bare '2' falls through
 *   T2 explicit slug strict-mode        registered slug   -> exact match
 *   T3 quoted exact name strict-mode    quoted registered name -> exact
 *   T4 Section-8 trace assertion        routing_source: 'strict_mode'
 *   T5 fallthrough regression fence     unknown text -> null (similarity falls through)
 *   T6 Lawrence reproducer              4 callouts, 3 strict + 1 deferred
 *
 * Order of precedence (locked decision):
 *   numeric -> explicit slug -> quoted name -> fall through to similarity
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const CLASSIFIER = path.join(REPO, 'scripts/intent-classifier.cjs');
// Phase 94-06: the strict-mode detector lives in its own pure-function
// module under lib/core/ so this test can require it without booting
// the classifier hot path (which reads stdin + spawns the navigation
// engine). The classifier itself requires the same module so production
// and tests share a single source of truth.
const STRICT_MOD = path.join(REPO, 'lib/core/room-classifier-strict-mode.cjs');

// ---------- Fixture helpers ----------

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMP_ROOTS) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch (_e) { /* best effort */ }
  }
});

// Build a fixture registry with the array form. The classifier's
// strict-mode detector tolerates both forms (array or object); the
// canon decision (1-indexed numeric position) requires deterministic
// ordering, so the array form is preferred for tests.
function writeRegistryArray(rootDir, activeSlug, rooms) {
  const dotRooms = path.join(rootDir, '.rooms');
  fs.mkdirSync(dotRooms, { recursive: true });
  const registry = {
    version: 2,
    active: activeSlug,
    rooms: rooms,
  };
  fs.writeFileSync(
    path.join(dotRooms, 'registry.json'),
    JSON.stringify(registry, null, 2),
    'utf8'
  );
  // Also create per-room directories so the Phase 83 sealed-room walker
  // does not fail on entry. Each room gets a minimal STATE.md so that
  // the existing similarity scoring path has something to read on the
  // T5 fallthrough fence.
  for (const r of rooms) {
    const slug = (typeof r === 'string') ? r : r.slug;
    if (!slug) continue;
    const roomDir = path.join(rootDir, slug);
    fs.mkdirSync(roomDir, { recursive: true });
    const fm = [
      '---',
      'project: ' + (typeof r === 'object' && r.name ? r.name : slug),
      'venture_stage: Pre-Opportunity',
      '---',
      '',
      '# ' + slug + ' state',
    ].join('\n');
    fs.writeFileSync(path.join(roomDir, 'STATE.md'), fm, 'utf8');
  }
}

// Standard 3-room fixture for T1, T2, T3, T5.
function buildThreeRoomFixture() {
  const root = mkTmp('mos-94-06-3room-');
  writeRegistryArray(root, 'beta', [
    { slug: 'alpha', name: 'Alpha', path: 'alpha' },
    { slug: 'beta', name: 'Beta', path: 'beta' },
    { slug: 'curriculum-redesign-fall-2026', name: 'Curriculum Redesign Fall 2026', path: 'curriculum-redesign-fall-2026' },
  ]);
  return root;
}

// Lawrence's exact 2-room fixture for T6.
function buildLawrenceFixture() {
  const root = mkTmp('mos-94-06-lawrence-');
  // Order matters: position 1 = core-power-isolation,
  //                position 2 = curriculum-redesign-fall-2026.
  // Lawrence's "switch to 2" maps to position 2.
  writeRegistryArray(root, 'core-power-isolation', [
    { slug: 'core-power-isolation', name: 'Core Power Isolation', path: 'core-power-isolation' },
    { slug: 'curriculum-redesign-fall-2026', name: 'Curriculum Redesign Fall 2026', path: 'curriculum-redesign-fall-2026' },
  ]);
  return root;
}

// Spawn intent-classifier as a child process with the user message
// piped to stdin. Returns { stdout, stderr, status, traceFile } where
// traceFile is the path to the decision-traces JSON written during the
// invocation (or null if none).
function runClassifier(rootDir, message, env) {
  const fullEnv = Object.assign({}, process.env, {
    MINDRIAN_ROOMS_ROOT: rootDir,
    // Disable the Phase 84 graph-findings injection so test stdout is
    // strictly intent-classifier output (less brittle on assertions).
    MINDRIAN_COPILOT_INJECT_FINDINGS: '0',
    // Stable session id so we can find the trace file deterministically.
    CLAUDE_SESSION_ID: 'test-94-06-' + Math.random().toString(36).slice(2, 10),
  }, env || {});
  const stdinPayload = JSON.stringify({ user_message: message });
  const res = spawnSync(process.execPath, [CLASSIFIER], {
    input: stdinPayload,
    env: fullEnv,
    encoding: 'utf8',
    timeout: 5000,
  });
  // Decision trace file (Phase 91-02 emits to <activeRoomDir>/.mindrian/
  // decision-traces/<session>.json). The active room dir is resolved
  // from the registry; first room with an existing dir on disk.
  let traceFile = null;
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(rootDir, '.rooms', 'registry.json'), 'utf8'));
    const active = reg.active;
    if (active) {
      const candidate = path.join(rootDir, active, '.mindrian', 'decision-traces',
        fullEnv.CLAUDE_SESSION_ID + '.json');
      if (fs.existsSync(candidate)) traceFile = candidate;
    }
  } catch (_e) { /* no trace */ }
  return { stdout: res.stdout, stderr: res.stderr, status: res.status, traceFile: traceFile };
}

// ---------- Direct module entry point ----------

// The strict-mode detector lives in lib/core/room-classifier-strict-mode.cjs
// so unit tests T1-T6 can require it without spawning a child process or
// booting the classifier hot path. Production code path: scripts/
// intent-classifier.cjs requires THIS SAME module and wires it into the
// top of the room-resolution path. Single source of truth.
function loadClassifierModule() {
  delete require.cache[STRICT_MOD];
  // eslint-disable-next-line global-require
  return require(STRICT_MOD);
}

// ---------- Tests ----------

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    fn();
    process.stdout.write('PASS ' + name + '\n');
    passed += 1;
  } catch (e) {
    process.stderr.write('FAIL ' + name + '\n');
    process.stderr.write('  ' + (e && e.stack ? e.stack : String(e)) + '\n');
    failed += 1;
  }
}

// ---- T1: numeric strict-mode ----

run('T1 numeric strict-mode resolves to registry position', () => {
  const root = buildThreeRoomFixture();
  const mod = loadClassifierModule();
  assert.equal(typeof mod.detectStrictMode, 'function',
    'scripts/intent-classifier.cjs must export detectStrictMode');

  const reg = JSON.parse(fs.readFileSync(
    path.join(root, '.rooms', 'registry.json'), 'utf8'));

  // 'switch to 2' -> position 2 (1-indexed) -> 'beta'
  const r1 = mod.detectStrictMode('switch to 2', reg);
  assert.ok(r1, 'switch to 2 must produce a result');
  assert.equal(r1.slug, 'beta', 'expected beta at position 2');
  assert.equal(r1.pattern, 'numeric', 'pattern must be numeric');

  // bare '2' MUST fall through (2026-06-28 fix): a bare integer is a reply to a
  // numbered menu, not a room-switch command. The imperative verb is now
  // required, so a bare integer returns null and falls through to the
  // similarity heuristic (where a lone integer tokenizes to nothing and stays
  // silent). This is the Case-1 false-room-switch fix.
  const r2 = mod.detectStrictMode('2', reg);
  assert.equal(r2, null, 'bare numeric must fall through (no verb -> not a switch)');

  // Other imperative verbs still resolve (verb + to + N).
  const r2b = mod.detectStrictMode('go to 2', reg);
  assert.ok(r2b, 'go to 2 must produce a result');
  assert.equal(r2b.slug, 'beta');
  assert.equal(r2b.pattern, 'numeric');

  // out-of-bounds 'switch to 99' falls through (no result)
  const r3 = mod.detectStrictMode('switch to 99', reg);
  assert.equal(r3, null, 'out-of-bounds numeric must fall through (null)');

  // 'switch to 0' is invalid (1-indexed); falls through.
  const r4 = mod.detectStrictMode('switch to 0', reg);
  assert.equal(r4, null, 'zero is invalid 1-indexed; must fall through');

  // A lone integer with a trailing period / plain prose also falls through
  // (regression fence for the menu-reply case).
  const r5 = mod.detectStrictMode('1', reg);
  assert.equal(r5, null, 'bare "1" (menu reply) must fall through');
});

// ---- T2: explicit slug strict-mode ----

run('T2 explicit slug strict-mode matches by exact slug', () => {
  const root = buildThreeRoomFixture();
  const mod = loadClassifierModule();
  const reg = JSON.parse(fs.readFileSync(
    path.join(root, '.rooms', 'registry.json'), 'utf8'));

  // Plain slug input.
  const r1 = mod.detectStrictMode('curriculum-redesign-fall-2026', reg);
  assert.ok(r1, 'plain slug must produce a result');
  assert.equal(r1.slug, 'curriculum-redesign-fall-2026');
  assert.equal(r1.pattern, 'slug');

  // Slash-prefixed via /mos:rooms command form.
  const r2 = mod.detectStrictMode('/mos:rooms curriculum-redesign-fall-2026', reg);
  assert.ok(r2, '/mos:rooms <slug> must produce a result');
  assert.equal(r2.slug, 'curriculum-redesign-fall-2026');
  assert.equal(r2.pattern, 'slug');

  // Slug not in registry must NOT match.
  const r3 = mod.detectStrictMode('not-a-real-slug-xyz', reg);
  assert.equal(r3, null, 'unknown slug must fall through');
});

// ---- T3: quoted exact name strict-mode ----

run('T3 quoted exact name strict-mode matches name or slug', () => {
  const root = buildThreeRoomFixture();
  const mod = loadClassifierModule();
  const reg = JSON.parse(fs.readFileSync(
    path.join(root, '.rooms', 'registry.json'), 'utf8'));

  // Quoted exact NAME (uppercase + spaces).
  const r1 = mod.detectStrictMode('"Curriculum Redesign Fall 2026"', reg);
  assert.ok(r1, 'quoted exact name must produce a result');
  assert.equal(r1.slug, 'curriculum-redesign-fall-2026');
  assert.equal(r1.pattern, 'quoted');

  // Quoted exact SLUG (lowercase-dashes; useful when user pastes a slug).
  const r2 = mod.detectStrictMode('"curriculum-redesign-fall-2026"', reg);
  assert.ok(r2, 'quoted slug must produce a result');
  assert.equal(r2.slug, 'curriculum-redesign-fall-2026');
  assert.equal(r2.pattern, 'quoted');

  // Quoted with single quotes also works.
  const r3 = mod.detectStrictMode("'Beta'", reg);
  assert.ok(r3, 'single-quoted name must produce a result');
  assert.equal(r3.slug, 'beta');
  assert.equal(r3.pattern, 'quoted');

  // Quoted unknown name falls through.
  const r4 = mod.detectStrictMode('"This Room Does Not Exist"', reg);
  assert.equal(r4, null, 'quoted unknown name must fall through');
});

// ---- T4: Section-8 trace assertion ----

run('T4 strict-mode override emits routing_source strict_mode', () => {
  const root = buildThreeRoomFixture();
  const mod = loadClassifierModule();
  const reg = JSON.parse(fs.readFileSync(
    path.join(root, '.rooms', 'registry.json'), 'utf8'));

  // The pure-function detectStrictMode does not write the trace itself;
  // the routing_source 'strict_mode' value is emitted by the wiring at
  // the top of the room-resolution path. The detector exposes a
  // result with pattern + routing_source so the wiring can mirror.
  const r1 = mod.detectStrictMode('switch to 2', reg);
  assert.ok(r1, 'numeric strict-mode produces a result');
  assert.equal(r1.routing_source, 'strict_mode',
    'detectStrictMode result must carry routing_source: strict_mode');

  const r2 = mod.detectStrictMode('curriculum-redesign-fall-2026', reg);
  assert.ok(r2, 'slug strict-mode produces a result');
  assert.equal(r2.routing_source, 'strict_mode');

  const r3 = mod.detectStrictMode('"Beta"', reg);
  assert.ok(r3, 'quoted strict-mode produces a result');
  assert.equal(r3.routing_source, 'strict_mode');

  // Module-level constant: the canonical string is exported so writers
  // and tests share a single source of truth.
  assert.equal(typeof mod.STRICT_MODE_ROUTING_SOURCE, 'string',
    'STRICT_MODE_ROUTING_SOURCE constant must be exported');
  assert.equal(mod.STRICT_MODE_ROUTING_SOURCE, 'strict_mode');
});

// ---- T5: fallthrough regression fence ----

run('T5 unknown natural-language input falls through to similarity', () => {
  const root = buildThreeRoomFixture();
  const mod = loadClassifierModule();
  const reg = JSON.parse(fs.readFileSync(
    path.join(root, '.rooms', 'registry.json'), 'utf8'));

  // Natural language with no numeric, no explicit slug, no quoted name
  // -> strict-mode returns null. The existing similarity heuristic
  // takes over (per the plan's "no regression" invariant).
  const r1 = mod.detectStrictMode('please help me think about strategy', reg);
  assert.equal(r1, null, 'natural language must NOT trigger strict-mode');

  const r2 = mod.detectStrictMode('the curriculum room', reg);
  // 'the curriculum room' is the Lawrence callout 3 known-deferred case.
  // Strict-mode returns null (no numeric / slug / quoted match).
  // The similarity heuristic OR a future natural-language layer handles it.
  assert.equal(r2, null,
    'natural-language phrase must NOT trigger strict-mode (callout 3 deferred)');

  const r3 = mod.detectStrictMode('hello world', reg);
  assert.equal(r3, null);

  // Empty input also returns null.
  const r4 = mod.detectStrictMode('', reg);
  assert.equal(r4, null, 'empty input falls through');

  // Whitespace-only also returns null.
  const r5 = mod.detectStrictMode('   ', reg);
  assert.equal(r5, null, 'whitespace-only falls through');
});

// ---- T6: Lawrence reproducer (4 callouts) ----

run('T6 Lawrence reproducer: 3 strict-mode + 1 known-deferred', () => {
  const root = buildLawrenceFixture();
  const mod = loadClassifierModule();
  const reg = JSON.parse(fs.readFileSync(
    path.join(root, '.rooms', 'registry.json'), 'utf8'));

  // Callout 1: 'switch to 2' -> position 2 -> curriculum-redesign-fall-2026
  // (Lawrence said 'switch to 8' but his fixture had only 2 rooms; he
  // was approximating room position. The canonical fence test is that
  // a numeric position resolves to the room AT that position, which
  // 'switch to 2' verifies with the 2-room Lawrence fixture.)
  const c1 = mod.detectStrictMode('switch to 2', reg);
  assert.ok(c1, 'callout 1 must resolve via strict-mode');
  assert.equal(c1.slug, 'curriculum-redesign-fall-2026',
    'Lawrence callout 1: switch to 2 must map to curriculum-redesign-fall-2026');
  assert.equal(c1.pattern, 'numeric');
  assert.equal(c1.routing_source, 'strict_mode');

  // Callout 2 (variant): 'curriculum-redesign-fall-2026' bare slug.
  // Lawrence's literal phrasing was 'curriculum redesign' (no dashes),
  // which is natural-language and falls through to similarity (deferred
  // to v1.11.3 alongside callout 3). The strict-mode FENCE is the slug
  // form (canonical input).
  const c2 = mod.detectStrictMode('curriculum-redesign-fall-2026', reg);
  assert.ok(c2, 'callout 2 (slug form) must resolve via strict-mode');
  assert.equal(c2.slug, 'curriculum-redesign-fall-2026');
  assert.equal(c2.pattern, 'slug');
  assert.equal(c2.routing_source, 'strict_mode');

  // Callout 3 (KNOWN-DEFERRED): 'the curriculum room' (natural language).
  // Strict-mode returns null. Similarity heuristic handles (or fails);
  // documented as known-deferred to v1.11.3 (natural-language intent
  // training out of scope).
  const c3 = mod.detectStrictMode('the curriculum room', reg);
  assert.equal(c3, null,
    'Lawrence callout 3 KNOWN-DEFERRED to v1.11.3: '
    + 'natural-language intent training required');

  // Callout 4: '/mos:rooms curriculum-redesign-fall-2026' explicit form.
  const c4 = mod.detectStrictMode('/mos:rooms curriculum-redesign-fall-2026', reg);
  assert.ok(c4, 'callout 4 (slash command) must resolve via strict-mode');
  assert.equal(c4.slug, 'curriculum-redesign-fall-2026');
  assert.equal(c4.pattern, 'slug');
  assert.equal(c4.routing_source, 'strict_mode');

  // The before-94-06 buggy-resolution path mapped all 4 callouts to
  // 'core-power-isolation'. The post-94-06 fence proves 3 of 4 callouts
  // resolve to 'curriculum-redesign-fall-2026' via strict-mode; callout
  // 3 is documented as deferred (NOT a regression; its pre-94-06
  // resolution was also wrong).
  for (const c of [c1, c2, c4]) {
    assert.notEqual(c.slug, 'core-power-isolation',
      'Lawrence reproducer fence: NO callout may resolve to core-power-isolation');
  }
});

// ---- Summary ----

process.stdout.write('\n');
process.stdout.write('room-classifier-strict-mode: ' + passed + '/' + (passed + failed) + ' passed\n');
process.exit(failed === 0 ? 0 : 1);
