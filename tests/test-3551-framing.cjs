#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 04 Task 1 (AMB-07) -- pins the non-keyword framing chain:
 * lib/core/direction-convention.cjs's new FRAMING_IDS / FRAMING_PHRASES /
 * hashFramingTable / framingHash / FRAMING_CONFIRMED beside the direction
 * phrases, and lib/core/ambient-framing.cjs's resolveRoomRung / framingFor
 * resolver chain (jtbd goal.rung -> ROOM.md pws_stage -> STATE.md explicit
 * fields -> the structural MINTO classifier -> neutral).
 *
 * Bare node script, no framework, exits non-zero on any assertion failure.
 * hygiene-355 preamble (scrubVendorKey + installNetGuard BEFORE any repo
 * require, attempts() === 0 last -- Pitfall 16). House rule: hyphens only,
 * no em-dashes.
 *
 * RED by design at first run: lib/core/ambient-framing.cjs does not exist
 * yet and lib/core/direction-convention.cjs does not yet export the framing
 * constants.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REPO = path.join(__dirname, '..');
const DC_PATH = path.join(REPO, 'lib', 'core', 'direction-convention.cjs');
const AF_PATH = path.join(REPO, 'lib', 'core', 'ambient-framing.cjs');
const BRAIN_CLIENT_PATH = path.join(REPO, 'lib', 'core', 'brain-client.cjs');

const { buildDeltaRoom } = require('./helpers/fixture-room-3551.cjs');
const jtbdState = require('../lib/hmi/jtbd-state.cjs');
const verificationStampFormat = require('../lib/core/verification-stamp-format.cjs');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-3551-framing:');

let dc = null;
try {
  // eslint-disable-next-line global-require
  dc = require(DC_PATH);
} catch (_e) {
  dc = null;
}
assert.ok(dc, 'lib/core/direction-convention.cjs must load (module missing entirely)');

let af = null;
try {
  // eslint-disable-next-line global-require
  af = require(AF_PATH);
} catch (_e) {
  af = null;
}
assert.ok(af, 'lib/core/ambient-framing.cjs must exist and load (module missing)');
ok('lib/core/direction-convention.cjs and lib/core/ambient-framing.cjs both load');

// ---------------------------------------------------------------------------
// FRAMING_IDS / FRAMING_PHRASES / FRAMING_CONFIRMED on direction-convention.
// ---------------------------------------------------------------------------
(function test_framingIdsAndConfirmed() {
  assert.deepEqual(dc.FRAMING_IDS, ['find_the_problem', 'pursue_or_drop', 'neutral'], 'FRAMING_IDS must deep-equal [\'find_the_problem\',\'pursue_or_drop\',\'neutral\']');
  assert.strictEqual(Object.isFrozen(dc.FRAMING_IDS), true, 'FRAMING_IDS must be frozen');
  assert.deepEqual(Object.keys(dc.FRAMING_PHRASES), dc.FRAMING_IDS, 'Object.keys(FRAMING_PHRASES) must deep-equal FRAMING_IDS');
  assert.strictEqual(Object.isFrozen(dc.FRAMING_PHRASES), true, 'FRAMING_PHRASES must be frozen');
  // 355.1-08 Task 3 (navigator ruling 2026-09-27) confirmed FRAMING_CONFIRMED;
  // it is no longer null. Accept either the pre-confirmation null (kept for
  // any fixture that still constructs a fresh module state) or the confirmed
  // frozen pws-author record whose framing_hash matches the live table.
  if (dc.FRAMING_CONFIRMED === null) {
    ok('FRAMING_IDS deep-equals [\'find_the_problem\',\'pursue_or_drop\',\'neutral\'] (frozen); Object.keys(FRAMING_PHRASES) matches; FRAMING_CONFIRMED === null (pre-355.1-08)');
  } else {
    assert.strictEqual(Object.isFrozen(dc.FRAMING_CONFIRMED), true, 'FRAMING_CONFIRMED must be frozen once confirmed');
    assert.strictEqual(dc.FRAMING_CONFIRMED.by, 'pws-author', 'FRAMING_CONFIRMED.by must be pws-author');
    assert.strictEqual(dc.FRAMING_CONFIRMED.framing_hash, dc.framingHash(), 'FRAMING_CONFIRMED.framing_hash must equal framingHash()');
    ok('FRAMING_IDS deep-equals [\'find_the_problem\',\'pursue_or_drop\',\'neutral\'] (frozen); Object.keys(FRAMING_PHRASES) matches; FRAMING_CONFIRMED is a frozen pws-author record whose framing_hash equals framingHash() (355.1-08 confirmed 2026-09-27)');
  }
})();

// ---------------------------------------------------------------------------
// phraseHash() still equals PHRASES_CONFIRMED.phrase_hash; framingHash() is
// 64 hex and changes when a framing phrase changes.
// ---------------------------------------------------------------------------
(function test_hashesSeparate() {
  assert.strictEqual(dc.phraseHash(), dc.PHRASES_CONFIRMED.phrase_hash, 'phraseHash() must still equal PHRASES_CONFIRMED.phrase_hash (framing kept out of its inputs)');

  const fh1 = dc.framingHash();
  assert.match(fh1, /^[0-9a-f]{64}$/, 'framingHash() must return a 64-char hex sha256');
  assert.strictEqual(typeof dc.hashFramingTable, 'function', 'hashFramingTable must be exported as a function');
  assert.strictEqual(dc.hashFramingTable(dc.FRAMING_PHRASES), fh1, 'hashFramingTable(FRAMING_PHRASES) must equal framingHash()');

  const clonedTable = Object.assign({}, dc.FRAMING_PHRASES, { find_the_problem: 'A changed phrase text of plausible length here.' });
  const fh2 = dc.hashFramingTable(clonedTable);
  assert.notStrictEqual(fh2, fh1, 'hashFramingTable() must change when a framing phrase changes');
  ok('phraseHash() untouched by the framing table; framingHash()/hashFramingTable() are 64-hex and change when a phrase changes');
})();

// ---------------------------------------------------------------------------
// direction-convention.cjs still has exactly one require( on an executable
// line (node:crypto).
// ---------------------------------------------------------------------------
(function test_dcSingleRequire() {
  const requireCalls = hygiene.nonCommentLines(DC_PATH).join('\n').match(/require\(([^)]*)\)/g) || [];
  assert.strictEqual(requireCalls.length, 1, 'direction-convention.cjs must have exactly one require( call, found: ' + JSON.stringify(requireCalls));
  assert.match(requireCalls[0], /require\(\s*['"]node:crypto['"]\s*\)/, 'the one require( call must be require(\'node:crypto\')');
  ok('direction-convention.cjs still has exactly one require( call (node:crypto)');
})();

// ---------------------------------------------------------------------------
// ambient-framing.cjs exports shape.
// ---------------------------------------------------------------------------
(function test_ambientFramingExportsShape() {
  assert.deepEqual(af.RUNG_IDS, ['UnDefined', 'IllDefined', 'WellDefined', 'Wicked', 'unknown'], 'RUNG_IDS must deep-equal the five rung ids');
  assert.strictEqual(Object.isFrozen(af.RUNG_IDS), true, 'RUNG_IDS must be frozen');
  assert.deepEqual(af.RUNG_SOURCES, ['jtbd_goal', 'room_pws_stage', 'state_explicit', 'minto_structural', 'none'], 'RUNG_SOURCES must deep-equal the five source ids');
  assert.strictEqual(Object.isFrozen(af.RUNG_SOURCES), true, 'RUNG_SOURCES must be frozen');

  assert.strictEqual(af.FRAMING_BY_RUNG.UnDefined, 'find_the_problem');
  assert.strictEqual(af.FRAMING_BY_RUNG.IllDefined, 'find_the_problem');
  assert.strictEqual(af.FRAMING_BY_RUNG.WellDefined, 'pursue_or_drop');
  assert.strictEqual(af.FRAMING_BY_RUNG.Wicked, 'neutral');
  assert.strictEqual(af.FRAMING_BY_RUNG.unknown, 'neutral');
  assert.strictEqual(Object.isFrozen(af.FRAMING_BY_RUNG), true, 'FRAMING_BY_RUNG must be frozen');

  assert.strictEqual(af.PWS_STAGE_FRAMING.ill_defined, 'find_the_problem');
  assert.strictEqual(af.PWS_STAGE_FRAMING.extend_opportunity, 'pursue_or_drop');
  assert.strictEqual(Object.isFrozen(af.PWS_STAGE_FRAMING), true, 'PWS_STAGE_FRAMING must be frozen');

  assert.strictEqual(typeof af.resolveRoomRung, 'function', 'resolveRoomRung must be exported as a function');
  assert.strictEqual(typeof af.framingFor, 'function', 'framingFor must be exported as a function');
  ok('ambient-framing.cjs exports RUNG_IDS, RUNG_SOURCES, FRAMING_BY_RUNG, PWS_STAGE_FRAMING (all frozen), resolveRoomRung, framingFor');
})();

// ---------------------------------------------------------------------------
// Chain order leg 1: jtbd goal.rung wins even when ROOM.md pws_stage and
// STATE.md explicit fields are also set.
// ---------------------------------------------------------------------------
(function test_chainJtbdGoalWins() {
  const room = buildDeltaRoom('framing-jtbd');
  try {
    room.writeRoomMd({ pws_stage: 'ill_defined' });
    fs.writeFileSync(path.join(room.roomDir, 'STATE.md'), '---\ndefinition_level: well-defined\n---\n# State\n', 'utf8');
    const setResult = jtbdState.setGoal(room.roomDir, { jtbd: 'framing-goal', rung: 'WellDefined' });
    assert.ok(setResult, 'jtbd-state.setGoal must succeed for a valid Theo rung id');

    const result = af.resolveRoomRung(room.roomDir, {});
    assert.strictEqual(result.source, 'jtbd_goal', 'a ratified jtbd goal.rung must win over ROOM.md pws_stage and STATE.md explicit fields');
    assert.strictEqual(result.rung, 'WellDefined', 'the resolved rung must be the ratified goal rung');

    const framing = af.framingFor(room.roomDir, {});
    assert.strictEqual(framing.framing, 'pursue_or_drop', 'WellDefined must frame as pursue_or_drop');
    ok('chain order: jtbd goal.rung (source jtbd_goal) wins over ROOM.md pws_stage and STATE.md explicit fields both also set');
  } finally {
    room.cleanup();
  }
})();

// ---------------------------------------------------------------------------
// Chain order leg 2: no goal, ROOM.md pws_stage 'ill_defined' ->
// find_the_problem, source room_pws_stage; 'extend_opportunity' ->
// pursue_or_drop.
// ---------------------------------------------------------------------------
(function test_chainRoomPwsStage() {
  const roomIll = buildDeltaRoom('framing-pws-ill');
  try {
    roomIll.writeRoomMd({ pws_stage: 'ill_defined' });
    const resultIll = af.resolveRoomRung(roomIll.roomDir, {});
    assert.strictEqual(resultIll.source, 'room_pws_stage', 'ROOM.md pws_stage ill_defined must resolve via source room_pws_stage');
    assert.strictEqual(af.framingFor(roomIll.roomDir, {}).framing, 'find_the_problem', 'pws_stage ill_defined must frame as find_the_problem');
  } finally {
    roomIll.cleanup();
  }

  const roomExtend = buildDeltaRoom('framing-pws-extend');
  try {
    roomExtend.writeRoomMd({ pws_stage: 'extend_opportunity' });
    const resultExtend = af.resolveRoomRung(roomExtend.roomDir, {});
    assert.strictEqual(resultExtend.source, 'room_pws_stage', 'ROOM.md pws_stage extend_opportunity must resolve via source room_pws_stage');
    assert.strictEqual(af.framingFor(roomExtend.roomDir, {}).framing, 'pursue_or_drop', 'pws_stage extend_opportunity must frame as pursue_or_drop');
  } finally {
    roomExtend.cleanup();
  }
  ok('chain order: ROOM.md pws_stage ill_defined frames find_the_problem, extend_opportunity frames pursue_or_drop, both source room_pws_stage');
})();

// ---------------------------------------------------------------------------
// Chain order leg 3: with neither a goal nor a pws_stage, an explicit
// STATE.md field (definition_level) resolves via source state_explicit.
// ---------------------------------------------------------------------------
(function test_chainStateExplicit() {
  const room = buildDeltaRoom('framing-state-explicit');
  try {
    fs.writeFileSync(path.join(room.roomDir, 'STATE.md'), '---\ndefinition_level: well-defined\n---\n# State\n', 'utf8');
    const result = af.resolveRoomRung(room.roomDir, {});
    assert.strictEqual(result.source, 'state_explicit', 'an explicit STATE.md definition_level field must resolve via source state_explicit');
    assert.strictEqual(result.rung, 'WellDefined', 'definition_level well-defined must map to rung WellDefined');
    ok('chain order: STATE.md frontmatter definition_level (no goal, no pws_stage) resolves via source state_explicit');
  } finally {
    room.cleanup();
  }
})();

// ---------------------------------------------------------------------------
// Chain order leg 4: a STATE.md holding ONLY venture_stage must NOT resolve
// as state_explicit (the venture_stage inference branch is skipped).
// ---------------------------------------------------------------------------
(function test_chainVentureStageSkipped() {
  const room = buildDeltaRoom('framing-venture-only');
  try {
    // buildDeltaRoom's default STATE.md already carries only venture_stage.
    const result = af.resolveRoomRung(room.roomDir, {});
    assert.notStrictEqual(result.source, 'state_explicit', 'a STATE.md holding only venture_stage must NOT resolve as state_explicit');
    assert.strictEqual(result.source, 'none', 'with only venture_stage and no other signal, the chain must fall through to none');
    assert.strictEqual(result.rung, 'unknown', 'with only venture_stage and no other signal, the rung must be unknown');
    ok('chain order: STATE.md holding ONLY venture_stage is NOT state_explicit (the venture_stage inference is skipped)');
  } finally {
    room.cleanup();
  }
})();

// ---------------------------------------------------------------------------
// Chain order leg 5: allowStructural true with an injected structuralFn.
// ---------------------------------------------------------------------------
(function test_chainStructural() {
  const room = buildDeltaRoom('framing-structural');
  try {
    const r1 = af.resolveRoomRung(room.roomDir, { allowStructural: true, structuralFn: () => 'IDP' });
    assert.strictEqual(r1.rung, 'IllDefined', 'structuralFn returning IDP must map to rung IllDefined');
    assert.strictEqual(r1.source, 'minto_structural', 'the structural step must report source minto_structural');
    assert.strictEqual(af.framingFor(room.roomDir, { allowStructural: true, structuralFn: () => 'IDP' }).framing, 'find_the_problem', 'IllDefined must frame as find_the_problem');

    const r2 = af.resolveRoomRung(room.roomDir, { allowStructural: true, structuralFn: () => 'WDP' });
    assert.strictEqual(r2.rung, 'WellDefined', 'structuralFn returning WDP must map to rung WellDefined');
    assert.strictEqual(af.framingFor(room.roomDir, { allowStructural: true, structuralFn: () => 'WDP' }).framing, 'pursue_or_drop', 'WellDefined must frame as pursue_or_drop');
    ok('chain order: allowStructural true with an injected structuralFn maps IDP/WDP to IllDefined/WellDefined, source minto_structural');
  } finally {
    room.cleanup();
  }
})();

// ---------------------------------------------------------------------------
// Chain order leg 6: with allowStructural false, the structural step never
// runs (the structuralFn spy is never called).
// ---------------------------------------------------------------------------
(function test_structuralNotCalledWhenDisallowed() {
  const room = buildDeltaRoom('framing-structural-off');
  try {
    let called = false;
    const spy = () => {
      called = true;
      return 'IDP';
    };
    const result = af.resolveRoomRung(room.roomDir, { allowStructural: false, structuralFn: spy });
    assert.strictEqual(called, false, 'structuralFn spy must never be called when allowStructural is not true');
    assert.strictEqual(result.source, 'none', 'with allowStructural false and no other signal, the chain must fall through to none');
    ok('chain order: allowStructural false means the structural step never runs (structuralFn spy not called)');
  } finally {
    room.cleanup();
  }
})();

// ---------------------------------------------------------------------------
// Chain order leg 7: nothing found -> { rung: 'unknown', source: 'none' },
// framing 'neutral'.
// ---------------------------------------------------------------------------
(function test_chainNothingFound() {
  const room = buildDeltaRoom('framing-none');
  try {
    fs.writeFileSync(path.join(room.roomDir, 'STATE.md'), '', 'utf8');
    fs.writeFileSync(path.join(room.roomDir, 'ROOM.md'), '# no frontmatter here\n', 'utf8');
    const result = af.resolveRoomRung(room.roomDir, {});
    assert.deepEqual(result, { rung: 'unknown', source: 'none' }, 'with no signal at all the result must be exactly { rung: unknown, source: none }');
    assert.strictEqual(af.framingFor(room.roomDir, {}).framing, 'neutral', 'no signal at all must frame as neutral');
    ok('chain order: nothing found resolves to { rung: \'unknown\', source: \'none\' }, framing neutral');
  } finally {
    room.cleanup();
  }
})();

// ---------------------------------------------------------------------------
// Chain order leg 8: any thrown error inside a step moves on to the next
// step, never throws out of resolveRoomRung.
// ---------------------------------------------------------------------------
(function test_thrownErrorFallsThrough() {
  let result;
  assert.doesNotThrow(() => {
    result = af.resolveRoomRung(12345, {});
  }, 'resolveRoomRung must never throw, even when roomDir is malformed and every step throws internally');
  assert.deepEqual(result, { rung: 'unknown', source: 'none' }, 'a malformed roomDir must fall through every throwing step to the none default');
  ok('a thrown error inside a step moves resolveRoomRung on to the next step and never escapes (malformed roomDir proof)');
})();

// ---------------------------------------------------------------------------
// framingFor always returns a FRAMING_IDS member.
// ---------------------------------------------------------------------------
(function test_framingForReturnsFramingIdsMember() {
  const room = buildDeltaRoom('framing-member-check');
  try {
    const result = af.framingFor(room.roomDir, {});
    assert.ok(dc.FRAMING_IDS.indexOf(result.framing) !== -1, 'framingFor must return a FRAMING_IDS member, got: ' + result.framing);
    ok('framingFor(roomDir) always returns a FRAMING_IDS member');
  } finally {
    room.cleanup();
  }
})();

// ---------------------------------------------------------------------------
// Every FRAMING_PHRASES value passes 355-23's gates.
// ---------------------------------------------------------------------------
const BANNED_WORDS_RE = /\b(breakthrough|convergent|validated|proven|great|amazing|excellent|brilliant)\b/i;

(function test_phraseGates() {
  for (const id of dc.FRAMING_IDS) {
    const phrase = dc.FRAMING_PHRASES[id];
    assert.strictEqual(typeof phrase, 'string', 'FRAMING_PHRASES.' + id + ' must be a string');
    const scan = verificationStampFormat.assertNoScalar([phrase]);
    assert.strictEqual(scan.withheld, 0, 'FRAMING_PHRASES.' + id + ' must pass the D-30 no-decimal/no-percent sweep: ' + phrase);
    assert.strictEqual(/[0-9]+%/.test(phrase), false, 'FRAMING_PHRASES.' + id + ' must contain no [0-9]+% token: ' + phrase);
    assert.strictEqual(/[0-9]/.test(phrase), false, 'FRAMING_PHRASES.' + id + ' must contain no digit at all: ' + phrase);
    assert.strictEqual(BANNED_WORDS_RE.test(phrase), false, 'FRAMING_PHRASES.' + id + ' must contain no banned over-claim or praise word: ' + phrase);
    assert.strictEqual(/\u2014/.test(phrase), false, 'FRAMING_PHRASES.' + id + ' must contain no em-dash: ' + phrase);
    assert.ok(phrase.length >= 20 && phrase.length <= 90, 'FRAMING_PHRASES.' + id + ' length must be between 20 and 90 chars, got ' + phrase.length + ': ' + phrase);
  }
  ok('every FRAMING_PHRASES value passes the D-30 sweep, the [0-9]+% ban, the no-digit ban, the banned-word ban, the em-dash ban and the 20-90 length gate');
})();

// ---------------------------------------------------------------------------
// Static legs on ambient-framing.cjs's own source (non-comment lines only,
// so the module's own doc header is free to explain what is forbidden and
// why without tripping the token ban).
// ---------------------------------------------------------------------------
// tokenizeStringsAndRegex(text) -> [{ value, inArray }]. A small, real
// single-pass tokenizer (not a naive quote regex): it skips `//` line
// comments and real `/.../flags` regex literals (character classes and
// escapes handled, so a class like `["']?` never confuses the scanner into
// treating its own quote as a string boundary), and tracks a bracket stack
// so every extracted string literal records whether its innermost enclosing
// bracket is `[` (an array literal) -- the shape a phrase-marker table
// actually has.
const REGEX_START_PREV_CHARS = new Set(['(', ',', '=', ':', ';', '!', '&', '|', '?', '{', '[', '+', '-', '*', '%', '^', '~', '<', '>']);

function tokenizeStringsAndRegex(text) {
  const tokens = [];
  const stack = [];
  let prevSignificant = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === "'" || c === '"') {
      const quote = c;
      let j = i + 1;
      let buf = '';
      while (j < n && text[j] !== quote) {
        if (text[j] === '\\' && j + 1 < n) {
          buf += text[j] + text[j + 1];
          j += 2;
          continue;
        }
        buf += text[j];
        j += 1;
      }
      const inArray = stack.length > 0 && stack[stack.length - 1] === '[';
      tokens.push({ value: buf, inArray: inArray });
      i = j + 1;
      prevSignificant = quote;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      let j = i;
      while (j < n && text[j] !== '\n') j += 1;
      i = j;
      continue;
    }
    if (c === '/' && (prevSignificant === '' || REGEX_START_PREV_CHARS.has(prevSignificant))) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n) {
        const cj = text[j];
        if (cj === '\\') {
          j += 2;
          continue;
        }
        if (cj === '[') {
          inClass = true;
          j += 1;
          continue;
        }
        if (cj === ']') {
          inClass = false;
          j += 1;
          continue;
        }
        if (cj === '\n') break;
        if (cj === '/' && !inClass) {
          j += 1;
          closed = true;
          break;
        }
        j += 1;
      }
      if (closed) {
        while (j < n && /[a-z]/i.test(text[j])) j += 1;
        i = j;
        prevSignificant = '/';
        continue;
      }
      // Not a real regex literal (malformed / division-like); fall through
      // and treat the '/' as a plain character below.
    }
    if (c === '(' || c === '{' || c === '[') stack.push(c);
    else if (c === ')' || c === '}' || c === ']') stack.pop();
    if (!/\s/.test(c)) prevSignificant = c;
    i += 1;
  }
  return tokens;
}

function extractQuotedLiterals(text) {
  return tokenizeStringsAndRegex(text).map((t) => t.value);
}

// extractArrayLiteralSpaceyStrings(text) -> quoted string values that sit
// directly inside a `[...]` array literal AND contain an internal space --
// the exact shape of a phrase-marker table such as `['future of', ...]`. A
// lone `'use strict';` (a space, but not inside an array) never matches.
function extractArrayLiteralSpaceyStrings(text) {
  return tokenizeStringsAndRegex(text)
    .filter((t) => t.inArray && /\s/.test(t.value))
    .map((t) => t.value);
}

function extractRungMarkers() {
  const src = fs.readFileSync(BRAIN_CLIENT_PATH, 'utf8');
  const start = src.indexOf('const _RUNG_MARKERS = [');
  const end = src.indexOf('];', start);
  assert.ok(start !== -1 && end !== -1, '_RUNG_MARKERS table must be found in brain-client.cjs to build the negative-control marker list');
  const block = src.slice(start, end);
  const markers = [];
  const re = /markers:\s*\[([^\]]*)\]/g;
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(block)) !== null) {
    const inner = m[1];
    const strRe = /'([^']+)'/g;
    let sm;
    // eslint-disable-next-line no-cond-assign
    while ((sm = strRe.exec(inner)) !== null) {
      markers.push(sm[1]);
    }
  }
  assert.ok(markers.length > 0, '_RUNG_MARKERS markers list must be non-empty');
  return markers;
}

(function test_staticAmbientFramingSource() {
  const codeText = hygiene.nonCommentLines(AF_PATH).join('\n');

  assert.strictEqual(codeText.indexOf('_inferRungFromQuestion'), -1, 'ambient-framing.cjs (non-comment code) must contain no _inferRungFromQuestion token');

  const spacey = extractArrayLiteralSpaceyStrings(codeText);
  assert.deepEqual(spacey, [], 'ambient-framing.cjs must contain no array literal holding a quoted string with an internal space (the shape of a phrase-marker table), found: ' + JSON.stringify(spacey));

  const quoted = extractQuotedLiterals(codeText);
  const markers = extractRungMarkers();
  const lowerQuoted = quoted.map((q) => q.toLowerCase());
  for (const marker of markers) {
    assert.strictEqual(lowerQuoted.indexOf(marker.toLowerCase()), -1, 'ambient-framing.cjs must not contain the literal marker string \'' + marker + '\' from _inferRungFromQuestion\'s own table');
  }

  const lines = hygiene.nonCommentLines(AF_PATH);
  const topLevelRequireLines = lines.filter((l) => /^\S/.test(l) && /require\(/.test(l));
  assert.ok(topLevelRequireLines.length >= 3, 'ambient-framing.cjs must have top-level requires for node:fs, node:path and ./direction-convention.cjs');
  const allowedTargets = ['node:fs', 'node:path', './direction-convention.cjs'];
  for (const line of topLevelRequireLines) {
    const m = line.match(/require\(\s*(['"])([^'"]+)\1\s*\)/);
    assert.ok(m, 'unrecognized top-level require( shape in ambient-framing.cjs: ' + line);
    assert.ok(allowedTargets.indexOf(m[2]) !== -1, 'a top-level (unindented) require( in ambient-framing.cjs must be only node:fs, node:path or ./direction-convention.cjs, found: ' + m[2]);
  }
  ok('static: ambient-framing.cjs has no _inferRungFromQuestion token, no quoted literal with a space, none of the marker strings, and only fs/path/direction-convention at the top level');
})();

// ---------------------------------------------------------------------------
// Negative control: scanForKeywordClassifier(files) must flag a planted
// _inferRungFromQuestion( call and a planted marker-table-shaped array.
// ---------------------------------------------------------------------------
function scanForKeywordClassifier(files) {
  const flagged = [];
  for (const f of files) {
    let src;
    try {
      src = fs.readFileSync(f, 'utf8');
    } catch (_e) {
      continue;
    }
    if (src.indexOf('_inferRungFromQuestion(') !== -1) {
      flagged.push({ file: f, reason: 'a keyword-classifier call site (_inferRungFromQuestion() smuggled in)' });
      continue;
    }
    if (extractArrayLiteralSpaceyStrings(src).length > 0) {
      flagged.push({ file: f, reason: 'a marker-table-shaped array (a quoted string with an internal space inside an array literal)' });
    }
  }
  return flagged;
}

(function test_negativeControlPlantedKeywordClassifier() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-framing-scan-'));
  const fileCall = path.join(tmpDir, 'planted-call.cjs');
  const fileTable = path.join(tmpDir, 'planted-table.cjs');
  fs.writeFileSync(fileCall, "'use strict';\nfunction smuggled(q) { return _inferRungFromQuestion(q); }\nmodule.exports = { smuggled };\n", 'utf8');
  fs.writeFileSync(fileTable, "'use strict';\nconst MARKERS = ['stakeholder', 'future of', 'measure'];\nmodule.exports = { MARKERS };\n", 'utf8');
  try {
    // Negative control 1: a planted _inferRungFromQuestion( call must be caught.
    const flaggedCall = scanForKeywordClassifier([fileCall]);
    assert.strictEqual(flaggedCall.length, 1, 'negative control 1: scanForKeywordClassifier must flag the planted _inferRungFromQuestion( call file');
    assert.strictEqual(flaggedCall[0].file, fileCall);
    ok('negative control 1: scanForKeywordClassifier catches a planted _inferRungFromQuestion( call, PASS when caught');

    // Negative control 2: a planted marker-table-shaped array must be caught.
    const flaggedTable = scanForKeywordClassifier([fileTable]);
    assert.strictEqual(flaggedTable.length, 1, 'negative control 2: scanForKeywordClassifier must flag the planted marker-table-shaped array file');
    assert.strictEqual(flaggedTable[0].file, fileTable);
    ok('negative control 2: scanForKeywordClassifier catches a planted marker-table-shaped array, PASS when caught');

    const flaggedBoth = scanForKeywordClassifier([fileCall, fileTable]);
    assert.strictEqual(flaggedBoth.length, 2, 'scanForKeywordClassifier must flag both planted files when scanned together');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();

console.log('');
console.log('PASS test-3551-framing.cjs (' + checks + ' checks)');
// house-style summary line (hygiene-355 makeChecker's own "PASS: x FAIL: y"
// shape): every check above throws via assert on the first failure, so
// reaching this line means FAIL is always 0.
console.log('--- test-3551-framing ---');
console.log('PASS: ' + checks + ' FAIL: 0');

assert.strictEqual(netGuard.attempts(), 0, 'installNetGuard must record zero fetch attempts (Pitfall 16)');
netGuard.restore();
