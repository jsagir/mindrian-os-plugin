#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 02 (Scientific Roadmapping command, SRM364-01): the canon
 * snapshot data/framework-names.json must carry "Scientific Roadmapping" and
 * a theo_stamp, written only by `node scripts/refresh-framework-names.cjs
 * --live` (NV-3), and the Part 8 guard must classify the framework_step read
 * for it as known_tool_shape (allow) while Hypothesis-Driven Problem Solving
 * stays allow.
 *
 * Legs: C1 name present, C2 theo_stamp complete, C3 validateSnapshot + hash,
 * C4 guard allows Scientific Roadmapping, C5 guard still allows HDPS, C6 the
 * frameworks other commands bind still resolve, C7 zero network attempts.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Test hygiene: sandbox HOME and rooms home, scrub session env, BEFORE any repo require.
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 't364-02-'));
process.env.HOME = sandbox;
process.env.USERPROFILE = sandbox;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 't364-02-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();
const { check, summary } = hygiene.makeChecker('364-02 canon snapshot');

const REPO = path.resolve(__dirname, '..');
const snapPath = path.join(REPO, 'data', 'framework-names.json');
const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
const all = new Set((snap.framework_names || []).concat(snap.curated_extras || []));

// C1
check('C1 snapshot carries "Scientific Roadmapping"', all.has('Scientific Roadmapping'));

// C2
const st = snap.theo_stamp;
check(
  'C2 theo_stamp carries mapped_by, plugin_version, refreshed_at',
  !!st &&
    typeof st.mapped_by === 'string' && st.mapped_by.length > 0 &&
    typeof st.plugin_version === 'string' && st.plugin_version.length > 0 &&
    typeof st.refreshed_at === 'string' && st.refreshed_at.length > 0
);

// C3
const refresh = require(path.join(REPO, 'scripts', 'refresh-framework-names.cjs'));
let valid = false;
let validDetail = '';
try {
  const v = refresh.validateSnapshot(snap);
  valid = !!(v === true || (v && v.valid === true));
  if (!valid) validDetail = JSON.stringify(v).slice(0, 200);
} catch (e) {
  validDetail = e.message;
}
check('C3a validateSnapshot valid', valid, validDetail);
check(
  'C3b source_sha256 matches namesSha256(framework_names)',
  snap.source_sha256 === refresh.namesSha256(snap.framework_names)
);

// C4 / C5 (guard reads the snapshot at load)
const guard = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));
const sr = guard.classify({ framework: 'Scientific Roadmapping' }, { toolName: 'framework_step' });
check(
  'C4 guard: framework_step Scientific Roadmapping is known_tool_shape (allow)',
  sr.verdict === 'allow' && sr.class === 'known_tool_shape',
  JSON.stringify(sr)
);
const hd = guard.classify({ framework: 'Hypothesis-Driven Problem Solving' }, { toolName: 'framework_step' });
check(
  'C5 guard: framework_step Hypothesis-Driven Problem Solving stays known_tool_shape',
  hd.verdict === 'allow' && hd.class === 'known_tool_shape',
  JSON.stringify(hd)
);

// C6
for (const n of [
  'Hypothesis-Driven Problem Solving',
  'Systems Thinking',
  'Reverse Salient Analysis',
  'Dominant Design',
  'Scenario Planning',
]) {
  check('C6 still resolvable: ' + n, all.has(n));
}

// C7
check('C7 zero network attempts', netGuard.attempts() === 0, String(netGuard.attempts()));
netGuard.restore();

process.exit(summary());
