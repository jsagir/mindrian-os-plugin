#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * first-touch-version-stamper.cjs
 * --------------------------------
 * Phase 121.5-05 Sub-plan F (SEED-007 absorption).
 *
 * Pure function module that returns the canonical version stamp for each
 * first-touch surface (banner / splash / onboard / sessionstart /
 * operator-update / larry-extended). The string the user sees -- "MindrianOS
 * v<version>" -- is derived once, here, so the per-surface emission stays in
 * lock-step with .claude-plugin/plugin.json.
 *
 * Source finding (SEED-007, 2026-05-09): a v1.12.0 "Three ways to do this"
 * greeting was rendering on a stale Windows install with NO version-of-record
 * visible. The user could not answer "what version am I running?" by LOOKING
 * at the terminal. This module is the canonical answer to that question.
 *
 * Canon Part 7 (Reuse Before Build): the version-of-record source is
 * .claude-plugin/plugin.json -- the same one scripts/banner already reads via
 * lib/core/platform.cjs::readPluginJsonVersion. This module wraps that source
 * with the per-surface rendering contract; it does NOT introduce a second
 * version-of-record surface.
 *
 * Canon Part 8: local-only; no fetch, no Brain, no telemetry egress.
 *
 * No emoji. No em-dashes. ASCII-clean source.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SURFACES_PATH = path.join(__dirname, '..', '..', 'data', 'first-touch-surfaces.json');
const PLUGIN_JSON_PATH = path.join(__dirname, '..', '..', '.claude-plugin', 'plugin.json');

const KNOWN_SURFACES = new Set([
  'banner',
  'splash',
  'onboard',
  'sessionstart',
  'operator-update',
  'larry-extended',
]);

function readSurfaces() {
  return JSON.parse(fs.readFileSync(SURFACES_PATH, 'utf8'));
}

function resolveCurrentVersion() {
  try {
    return JSON.parse(fs.readFileSync(PLUGIN_JSON_PATH, 'utf8')).version;
  } catch (_e) {
    return 'unknown';
  }
}

function stampVersion(surfaceId, version) {
  if (!KNOWN_SURFACES.has(surfaceId)) {
    throw new Error('unknown_surface: ' + surfaceId);
  }
  const v = version || resolveCurrentVersion();
  switch (surfaceId) {
    case 'banner':
      return 'MindrianOS v' + v;
    case 'splash':
      return 'MindrianOS v' + v + ' -- conversation as the product surface';
    case 'onboard':
      return 'Welcome to MindrianOS v' + v + '. Let me show you around.';
    case 'sessionstart':
    case 'operator-update':
    case 'larry-extended':
      return 'MindrianOS v' + v;
    default:
      // unreachable: KNOWN_SURFACES gates entry
      throw new Error('unknown_surface: ' + surfaceId);
  }
}

// U+2014 EM DASH detector -- the no-em-dash hard rule scanner uses this
// (CLAUDE.md / MEMORY feedback_no_emdashes). Written as an escape so this
// source file stays ASCII-clean.
const EM_DASH = '\u2014';

function hasEmDash(text) {
  return typeof text === 'string' && text.indexOf(EM_DASH) >= 0;
}

module.exports = {
  stampVersion,
  resolveCurrentVersion,
  readSurfaces,
  hasEmDash,
  KNOWN_SURFACES,
};

// Allow CLI invocation: `node lib/core/first-touch-version-stamper.cjs banner`
if (require.main === module) {
  const surfaceArg = process.argv[2];
  if (!surfaceArg) {
    process.stdout.write(stampVersion('banner') + '\n');
    process.exit(0);
  }
  try {
    process.stdout.write(stampVersion(surfaceArg) + '\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write('first-touch-version-stamper: ' + e.message + '\n');
    process.exit(2);
  }
}
