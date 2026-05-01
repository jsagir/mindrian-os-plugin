#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 100-04 -- /mos:jtbd UI Ruling System self-compliance test suite.
 *
 * Covers: HMI-100-04 (the user-facing /mos:jtbd command must comply with
 * skills/ui-system/SKILL.md sections 1-4 from day one -- no Wave-1 retrofit
 * needed; classification: Class F drift detector compatible).
 *
 * 8 compliance assertions:
 *   1. Frontmatter compliance: commands/jtbd.md frontmatter has body_shape,
 *      argument-hint, serves_jtbd, min_tier, concurrency, streams_events.
 *   2. Zone 1 present: every output mode contains the Zone 1 header pattern
 *      `-- {slug} -- jtbd --`.
 *   3. Zone 4 present: every output mode contains a Zone 4 action footer
 *      with at least 2 /mos: commands.
 *   4. No box chars: zero matches for [box-drawing-chars] in any output OR
 *      in the source code (excluding the U+251C + U+2500 / U+2514 + U+2500
 *      branch chars which are part of the 12-glyph vocabulary -- those are
 *      explicitly approved per SKILL.md §3 row "branch / last-branch").
 *   5. No unauthorized glyphs: zero matches for [crossmark family] and zero
 *      emoji codepoints.
 *   6. Approved glyphs only: every glyph found in output is a member of the
 *      12-glyph vocabulary.
 *   7. Color discipline: ANSI color codes mapped to the 5-color contract
 *      (green / cyan / yellow / red / gray); no magenta, blue (decorative),
 *      or other colors.
 *   8. Shape F.1 contract for set (no arg): output contains Free-Text option
 *      as a recognizable last row; the 12 first-class JTBD ids appear.
 *
 * Self-dog-food: this test file uses Unicode escape sequences for the
 * forbidden character set so the test source itself contains zero literal
 * forbidden chars. Same dog-food invariant as scripts/operator-command.cjs
 * Class F detector regex.
 *
 * Mirrors tests/test-doctor-ui-self-compliant.cjs scenario shape.
 * Registered in lib/memory/run-feynman-tests.cjs (Wave-0 stub replaced).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO, 'scripts', 'jtbd-command.cjs');
const COMMAND_MD = path.join(REPO, 'commands', 'jtbd.md');
const STATE_MOD = path.join(REPO, 'lib', 'hmi', 'jtbd-state.cjs');

let passed = 0;
let failed = 0;
const failures = [];

function ok(name) {
  passed += 1;
  process.stdout.write('[pass] ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  failures.push({ name, error: err && err.message ? err.message : String(err) });
  process.stdout.write('[FAIL] ' + name + '\n');
  if (err) {
    process.stdout.write('    ' + (err.message || String(err)) + '\n');
  }
}

// ---------- Forbidden character regexes (Unicode escapes -- this source
//             contains zero literal forbidden chars) ------------

// Box-drawing chars per SKILL.md §3 anti-list, EXCEPT U+251C + U+2500 +
// U+2514 (which form the approved branch / last-branch glyphs). The 12-glyph
// vocabulary explicitly includes branch / last-branch as composite tree
// glyphs; we do NOT flag these.
//   FORBIDDEN: U+256D, U+256E, U+2570, U+256F, U+250C, U+2510, U+2518,
//              U+2502, U+2501.
//   APPROVED:  U+251C, U+2500, U+2514 (branch composites only).
// We allow U+2500 because it is part of branch/last-branch composites; the
// renderer never emits a bare U+2500 (always paired with U+251C or U+2514).
const FORBIDDEN_BOX = new RegExp(
  '[' +
  '╭╮╰╯' +    // curved corners
  '┌┐┘' +           // straight corners (note: U+2514 omitted)
  '│' +                       // vertical line
  '━' +                       // heavy horizontal
  ']'
);

// X-glyph family: cross-marks NOT in the 12-glyph vocabulary.
//   U+2717, U+2718 (ballot x, heavy ballot x), U+2715 (multiplication X),
//   U+274C (cross-mark), U+2753 (question mark ornament),
//   U+2757 (heavy exclamation mark).
const FORBIDDEN_GLYPHS = new RegExp(
  '[' +
  '✗✘✕' +
  '❌❓❗' +
  ']'
);

// Emoji presence detector. Approximate: variation selector U+FE0F or any
// codepoint in the supplementary multilingual plane often used for emoji.
// We test against U+FE0F + the common emoji range U+1F300 .. U+1F9FF.
const FORBIDDEN_EMOJI = /[️]|[\u{1F300}-\u{1F9FF}]/u;

// ANSI color codes: only the 5-color contract is allowed.
//   green   \x1b[32m
//   cyan    \x1b[36m
//   yellow  \x1b[33m
//   red     \x1b[31m
//   gray    \x1b[90m
//   reset   \x1b[0m
const ALLOWED_ANSI = new Set(['\x1b[32m', '\x1b[36m', '\x1b[33m', '\x1b[31m', '\x1b[90m', '\x1b[0m']);
// Any \x1b[<code>m sequence outside the allowed set is a violation.
const ANSI_FIND = /\x1b\[(\d{1,3})m/g;

// 12-glyph vocabulary (skills/ui-system/SKILL.md §3) emitted via Unicode
// escapes so this source contains zero literal glyphs.
const APPROVED_GLYPHS = [
  '■', // filled-square (U+25A0)
  '▼', // down-triangle (U+25BC)
  '▶', // right-triangle-filled (U+25B6)
  '▷', // right-triangle-empty (U+25B7)
  '├', // branch start (U+251C; pairs with U+2500)
  '└', // last-branch start (U+2514; pairs with U+2500)
  '─', // branch tail (only valid as part of branch / last-branch)
  '✓', // check (U+2713)
  '•', // bullet (U+2022)
  '⚠', // warning (U+26A0)
  '⚡', // lightning (U+26A1)
  '⬜', // empty-square (U+2B1C)
  '→', // arrow (U+2192)
];

// ---------- Sandbox helpers (copied from test-jtbd-command.cjs) ----------

function makeScratchDir(suffix) {
  const base = path.join(os.tmpdir(), 'mos-100-04-ui-' + Date.now().toString(36) + '-' + suffix);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

function setupSyntheticRegistry(scratch, opts) {
  const o = opts || {};
  const slug = o.slug || 'test-room';
  const roomDir = path.join(scratch, slug);
  const mindrianDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(mindrianDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# ' + slug + '\n');
  const roomsDir = path.join(scratch, '.rooms');
  fs.mkdirSync(roomsDir, { recursive: true });
  const registry = {
    active_room: slug,
    rooms: [
      { slug: slug, name: slug, abs_path: roomDir, status: 'active' },
    ],
  };
  fs.writeFileSync(
    path.join(roomsDir, 'registry.json'),
    JSON.stringify(registry, null, 2)
  );
  return { scratch, slug, roomDir, mindrianDir };
}

function seedJtbdState(roomDir, opts) {
  const mod = require(STATE_MOD);
  mod.setCurrent(roomDir, {
    jtbd: opts.jtbd,
    confidence: typeof opts.confidence === 'number' ? opts.confidence : 0.8,
    evidence: opts.evidence || ['seed'],
    trigger: opts.trigger || 'seed',
    manual: opts.manual === undefined ? true : !!opts.manual,
  });
}

function runCmd(args, env) {
  const opts = {
    encoding: 'utf8',
    timeout: 5000,
    env: Object.assign({}, process.env, env || {}),
  };
  const res = spawnSync('node', [SCRIPT].concat(args), opts);
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: typeof res.status === 'number' ? res.status : -1,
  };
}

function captureAllModes(scratch) {
  // Capture stdout for show / list / history / clear in a fresh seeded room
  // so every mode is exercised against the compliance scanner.
  const reg = setupSyntheticRegistry(scratch, {});
  seedJtbdState(reg.roomDir, { jtbd: 'find-bottleneck', manual: true });
  const env = { MINDRIAN_ROOMS_HOME: scratch };
  return {
    show: runCmd([], env).stdout,
    list: runCmd(['list'], env).stdout,
    history: runCmd(['history'], env).stdout,
    setNoArg: runCmd(['set'], env).stdout,
    clear: runCmd(['clear'], env).stdout,
  };
}

// ---------- Test 1 ----------
// commands/jtbd.md frontmatter compliance (Phase 95.1 D-10 + Phase 104 fwd-compat).

(function test_01_frontmatter_compliance() {
  const label = 'Test 1: commands/jtbd.md frontmatter has all required fields';
  try {
    assert.equal(fs.existsSync(COMMAND_MD), true,
      label + ': commands/jtbd.md must exist at ' + COMMAND_MD);
    const md = fs.readFileSync(COMMAND_MD, 'utf8');
    const required = [
      'body_shape: E (Action Report)',
      'argument-hint:',
      'serves_jtbd:',
      'min_tier:',
      'concurrency:',
      'streams_events:',
    ];
    for (const field of required) {
      assert.ok(md.indexOf(field) !== -1,
        label + ': missing required frontmatter field: ' + field);
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 2 ----------
// Every output mode has Zone 1 header `-- {slug} -- jtbd --`.

(function test_02_zone_1_present_all_modes() {
  const label = 'Test 2: Zone 1 header present in every output mode';
  const scratch = makeScratchDir('t02');
  try {
    const out = captureAllModes(scratch);
    const modes = ['show', 'list', 'history', 'setNoArg', 'clear'];
    for (const m of modes) {
      assert.ok(out[m].indexOf('-- test-room -- jtbd --') !== -1,
        label + ': mode ' + m + ' missing Zone 1 header');
    }
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 3 ----------
// Every output mode has Zone 4 action footer with >=2 /mos: commands.

(function test_03_zone_4_present_all_modes() {
  const label = 'Test 3: Zone 4 footer with >=2 /mos: commands in every mode';
  const scratch = makeScratchDir('t03');
  try {
    const out = captureAllModes(scratch);
    const modes = ['show', 'list', 'history', 'setNoArg', 'clear'];
    for (const m of modes) {
      const matches = out[m].match(/\/mos:/g) || [];
      assert.ok(matches.length >= 2,
        label + ': mode ' + m + ' has only ' + matches.length + ' /mos: command refs (need >= 2)');
    }
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 4 ----------
// No box chars in any output OR in the script source (excluding approved
// branch / last-branch composites).

(function test_04_no_box_chars() {
  const label = 'Test 4: no box-drawing chars in source or any output mode';
  const scratch = makeScratchDir('t04');
  try {
    // Source scan.
    const src = fs.readFileSync(SCRIPT, 'utf8');
    const srcMatch = src.match(FORBIDDEN_BOX);
    if (srcMatch) {
      throw new Error(label + ': scripts/jtbd-command.cjs contains forbidden box char ' +
        JSON.stringify(srcMatch[0]) + ' at index ' + srcMatch.index);
    }
    // Output scan.
    const out = captureAllModes(scratch);
    for (const m of Object.keys(out)) {
      const outMatch = out[m].match(FORBIDDEN_BOX);
      if (outMatch) {
        throw new Error(label + ': mode ' + m + ' output contains forbidden box char ' +
          JSON.stringify(outMatch[0]) + ' at index ' + outMatch.index);
      }
    }
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 5 ----------
// No unauthorized glyphs (crossmark family, emoji) in source or output.

(function test_05_no_unauthorized_glyphs() {
  const label = 'Test 5: no crossmark family + no emoji in source or any output';
  const scratch = makeScratchDir('t05');
  try {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    const xMatch = src.match(FORBIDDEN_GLYPHS);
    if (xMatch) {
      throw new Error(label + ': source contains forbidden glyph ' +
        JSON.stringify(xMatch[0]) + ' at index ' + xMatch.index);
    }
    const eMatch = src.match(FORBIDDEN_EMOJI);
    if (eMatch) {
      throw new Error(label + ': source contains emoji ' +
        JSON.stringify(eMatch[0]) + ' at index ' + eMatch.index);
    }
    const out = captureAllModes(scratch);
    for (const m of Object.keys(out)) {
      const xo = out[m].match(FORBIDDEN_GLYPHS);
      if (xo) {
        throw new Error(label + ': mode ' + m + ' output contains forbidden glyph ' +
          JSON.stringify(xo[0]) + ' at index ' + xo.index);
      }
      const eo = out[m].match(FORBIDDEN_EMOJI);
      if (eo) {
        throw new Error(label + ': mode ' + m + ' output contains emoji ' +
          JSON.stringify(eo[0]) + ' at index ' + eo.index);
      }
    }
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 6 ----------
// Approved glyphs only: every non-ASCII glyph in any output mode must be
// a member of the 12-glyph vocabulary.

(function test_06_approved_glyphs_only() {
  const label = 'Test 6: every glyph in output is approved (12-glyph vocab)';
  const scratch = makeScratchDir('t06');
  try {
    const out = captureAllModes(scratch);
    const approvedSet = new Set(APPROVED_GLYPHS);
    // Strip ANSI sequences first.
    const ansiRe = /\x1b\[\d{1,3}m/g;
    for (const m of Object.keys(out)) {
      const stripped = out[m].replace(ansiRe, '');
      // Iterate over codepoints; any codepoint > U+007F (non-ASCII) must be
      // in approvedSet.
      let i = 0;
      while (i < stripped.length) {
        const cp = stripped.codePointAt(i);
        const ch = String.fromCodePoint(cp);
        if (cp > 0x7F && !approvedSet.has(ch)) {
          // Allow some specific punctuation common in plain-text output:
          //   U+2014 EM DASH, U+2013 EN DASH (these are NOT in the 12-glyph
          //   vocab but they are not banned either; SKILL.md §3 only
          //   restricts decorative/structural glyphs and emoji).
          // To stay strict against the 12-glyph rule, we explicitly allow
          // U+2014 + U+2013 + U+2026 (horizontal ellipsis) for prose.
          //
          // BUT we must NOT contain box-drawing chars or emoji here -- those
          // are caught by tests 4 + 5. This test catches anything else.
          const allowedPunct = new Set(['—', '–', '…']);
          if (!allowedPunct.has(ch)) {
            throw new Error(label + ': mode ' + m + ' contains non-approved glyph ' +
              'U+' + cp.toString(16).toUpperCase().padStart(4, '0') +
              ' (' + JSON.stringify(ch) + ') at index ' + i);
          }
        }
        i += ch.length;
      }
    }
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 7 ----------
// Color discipline: every ANSI color code matches the 5-color contract.

(function test_07_color_discipline() {
  const label = 'Test 7: every ANSI sequence is in 5-color contract';
  const scratch = makeScratchDir('t07');
  try {
    const out = captureAllModes(scratch);
    for (const m of Object.keys(out)) {
      const matches = out[m].match(ANSI_FIND) || [];
      for (const seq of matches) {
        if (!ALLOWED_ANSI.has(seq)) {
          throw new Error(label + ': mode ' + m + ' contains forbidden ANSI sequence ' +
            JSON.stringify(seq) + ' (allowed: ' + Array.from(ALLOWED_ANSI).map(JSON.stringify).join(', ') + ')');
        }
      }
    }
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 8 ----------
// Shape F.1 contract: set (no arg) renders Free-Text + 12 first-class JTBD
// ids in the picker block.

(function test_08_shape_f1_contract() {
  const label = 'Test 8: Shape F.1 picker has 12 first-class jobs + Free-Text';
  const scratch = makeScratchDir('t08');
  try {
    setupSyntheticRegistry(scratch, {});
    const res = runCmd(['set'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 0, label + ': set picker exit 0; got ' + res.status);
    assert.ok(res.stdout.indexOf('[F.1 Next Move]') !== -1,
      label + ': F.1 marker block missing');
    const firstClass = [
      'decide-pursue', 'find-problem', 'understand-market', 'find-bottleneck',
      'prepare-pitch', 'validate-idea', 'compare-options', 'connect-domains',
      'surface-contradiction', 'plan-execution', 'file-meeting', 'audit-room',
    ];
    for (const id of firstClass) {
      assert.ok(res.stdout.indexOf(id) !== -1,
        label + ': missing first-class job ' + id);
    }
    assert.ok(res.stdout.indexOf('Free-Text') !== -1,
      label + ': Free-Text option missing');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Report ----------

process.stdout.write('\n');
process.stdout.write(
  'jtbd UI self-compliance (UI Ruling System): ' + passed + ' passed, ' + failed + ' failed\n'
);
if (failures.length > 0) {
  process.stdout.write('\nFailures:\n');
  for (const f of failures) {
    process.stdout.write('  - ' + f.name + ': ' + f.error + '\n');
  }
}
process.exit(failed === 0 ? 0 : 1);
