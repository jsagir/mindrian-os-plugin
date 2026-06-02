#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260602-dsc -- structure test for the /mos:help De Stijl CARD view
 * (scripts/help-renderer.cjs renderHelpCards).
 *
 * The card view replaced the flat 1-line-per-command list with a lane-grouped
 * 2-line-card layout (user-approved prototype). This test locks the card-view
 * contract so a future edit cannot silently regress it:
 *
 *   1. COLOR mode (renderHelpCards(groups, true)): output carries a DS truecolor
 *      escape AND prints a /mos:<cmd> + its help_jtbd one-liner for every
 *      non-admin command; all 4 lane labels appear.
 *   2. ASCII mode (renderHelpCards(groups, false)): output carries ZERO ANSI
 *      escapes; still prints a /mos:<cmd> + its help_jtbd for every non-admin
 *      command; all 4 lane labels appear.
 *   3. Neither mode prints a visibility:admin command (admin, dogfood-flush) and
 *      neither prints a deprecated_aliases key (soft redirect).
 *
 * The non-admin set is derived from commands/*.md frontmatter (visibility !=
 * admin) minus the deprecated_aliases keys, mirroring scripts/check-help-
 * coverage.cjs and tests/test-help-selector-lanes.cjs byte-for-byte (Canon
 * Part 7 -- reuse the one visibility convention, do not invent a second).
 *
 * Canon Part 8 (Graph Boundary): filesystem only -- zero network surface.
 *
 * Registered additively in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GROUPS_PATH = path.join(REPO_ROOT, 'data', 'help-groups.json');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const { renderHelpCards, loadGroups } = require(path.join(REPO_ROOT, 'scripts', 'help-renderer.cjs'));

const ESC = '\x1b'; // ANSI escape introducer

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + ((err && err.message) || err)); }

// Frontmatter parser -- byte-for-byte the dialect scripts/check-help-coverage.cjs
// and tests/test-help-selector-lanes.cjs use (first match per key).
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.+)$/i);
    if (kv && out[kv[1]] === undefined) {
      let v = kv[2].trim();
      const qm = v.match(/^"([\s\S]*)"$/);
      if (qm) v = qm[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      out[kv[1]] = v;
    }
  }
  return out;
}

// Mirror scripts/check-help-coverage.cjs: non-admin = visibility != admin, minus
// deprecated_aliases keys. Also return the help_jtbd per command + the admin set.
function deriveCommands(groups) {
  const deprecated = new Set(
    Object.keys(groups.deprecated_aliases || {}).filter((k) => !k.startsWith('_'))
  );
  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md'));
  const nonAdmin = new Set();
  const adminCommands = new Set();
  const jtbd = {};
  for (const f of files) {
    const name = f.replace(/\.md$/, '');
    const fm = parseFrontmatter(fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf8'));
    const visibility = (fm && fm.visibility) || 'user';
    if (visibility === 'admin') { adminCommands.add(name); continue; }
    if (!deprecated.has(name)) {
      nonAdmin.add(name);
      jtbd[name] = (fm && fm.help_jtbd) ? fm.help_jtbd : '';
    }
  }
  return { nonAdmin, adminCommands, deprecated, jtbd };
}

const groups = JSON.parse(fs.readFileSync(GROUPS_PATH, 'utf8'));
const { nonAdmin, adminCommands, deprecated, jtbd } = deriveCommands(groups);

// The 4 lane labels exactly as the data file declares them (renderer reads _lanes).
const laneLabels = groups._lanes || {};
const LANE_KEYS = ['start', 'methodology', 'explore', 'view'];

// Sanity: loadGroups() and the direct JSON read agree (renderer's own entry point).
try {
  const lg = loadGroups();
  assert.ok(Array.isArray(lg.groups) && lg.groups.length > 0, 'loadGroups returns a non-empty groups array');
  pass('Sanity (loadGroups returns parseable groups)');
} catch (err) { failTest('Sanity (loadGroups returns parseable groups)', err); }

// Shared per-mode assertions: every non-admin /mos:<cmd> + its jtbd present;
// all 4 lane labels present.
function assertCardContent(out, modeName) {
  const missingCmd = [];
  const missingJtbd = [];
  for (const cmd of nonAdmin) {
    if (out.indexOf('/mos:' + cmd) === -1) { missingCmd.push(cmd); continue; }
    const j = jtbd[cmd];
    if (j && out.indexOf(j) === -1) missingJtbd.push(cmd);
  }
  assert.strictEqual(missingCmd.length, 0,
    modeName + ': a /mos:<cmd> line for every non-admin command; missing: ' + JSON.stringify(missingCmd));
  assert.strictEqual(missingJtbd.length, 0,
    modeName + ': the help_jtbd one-liner for every non-admin command; missing: ' + JSON.stringify(missingJtbd));

  const missingLane = [];
  for (const k of LANE_KEYS) {
    const label = laneLabels[k];
    if (!label || out.indexOf(label) === -1) missingLane.push(k + ' (' + label + ')');
  }
  assert.strictEqual(missingLane.length, 0,
    modeName + ': all 4 lane labels appear; missing: ' + JSON.stringify(missingLane));
}

// No admin command and no deprecated alias may appear in either mode.
function assertNoHidden(out, modeName) {
  const leakedAdmin = [...adminCommands].filter((c) => out.indexOf('/mos:' + c) !== -1);
  assert.strictEqual(leakedAdmin.length, 0,
    modeName + ': no visibility:admin /mos:<cmd> appears; leaked: ' + JSON.stringify(leakedAdmin));
  const leakedAlias = [...deprecated].filter((c) => out.indexOf('/mos:' + c) !== -1);
  assert.strictEqual(leakedAlias.length, 0,
    modeName + ': no deprecated_aliases key appears; leaked: ' + JSON.stringify(leakedAlias));
}

// -- Assertion 1: COLOR mode -------------------------------------------------
try {
  const out = renderHelpCards(groups, true);
  assert.ok(out.indexOf(ESC) !== -1, 'color mode carries at least one ANSI escape');
  assert.ok(out.indexOf('\x1b[38;2;') !== -1, 'color mode carries a DS 24-bit truecolor escape (\\x1b[38;2;...)');
  assertCardContent(out, 'color');
  assertNoHidden(out, 'color');
  pass('Assertion 1 (color mode: DS truecolor escape + every non-admin /mos:<cmd> + jtbd + 4 lanes; no admin/alias)');
} catch (err) { failTest('Assertion 1 (color mode)', err); }

// -- Assertion 2: ASCII mode (zero ANSI) -------------------------------------
try {
  const out = renderHelpCards(groups, false);
  assert.strictEqual(out.indexOf(ESC), -1, 'ascii mode carries ZERO ANSI escapes (no \\x1b anywhere)');
  assertCardContent(out, 'ascii');
  assertNoHidden(out, 'ascii');
  pass('Assertion 2 (ascii mode: zero ANSI + every non-admin /mos:<cmd> + jtbd + 4 lanes; no admin/alias)');
} catch (err) { failTest('Assertion 2 (ascii mode)', err); }

// -- Assertion 3: admin set is exactly {admin, dogfood-flush} ----------------
try {
  assert.ok(adminCommands.has('admin'), 'admin is a visibility:admin command');
  assert.ok(adminCommands.has('dogfood-flush'), 'dogfood-flush is a visibility:admin command');
  pass('Assertion 3 (admin set includes the two canonical visibility:admin commands)');
} catch (err) { failTest('Assertion 3 (admin set)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' assertion block(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' assertion blocks PASS (' + nonAdmin.size + ' non-admin commands covered)');
process.exit(0);
