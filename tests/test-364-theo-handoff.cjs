#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 10 -- the plugin-side Theo handoff for /mos:scientific-roadmap
 * (AWARE, SRM364-20). Legs T1-T8: one tracked notify doc, the facts Theo's sync
 * will read (copied from the generated registries, never from memory), the
 * OPEN-HANDOFFS row, the research-planner folder-contract rows, the dash fence,
 * and the no-write-into-Theo static check. Reads tracked docs only, never rooms.
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at mkdtemp dirs
 * before anything loads; the network guard is installed first and the last
 * check proves zero attempts.
 *
 * House rule: hyphens only. The dash characters below are unicode escapes.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-ho-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-ho-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-364-theo-handoff');

const CMD = '/mos:scientific-roadmap';
const NO_DASH = /[\u2014\u2013]/;

function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function readText(rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return ''; } }

const docsDir = path.join(ROOT, 'docs');
const notifyFiles = fs.readdirSync(docsDir).filter((f) => /-PHASE-364-THEO-NOTIFY\.md$/.test(f));
const docName = notifyFiles[0] || '';
const doc = docName ? readText('docs/' + docName) : '';

// T1 exactly one notify doc
C.check('T1 exactly one docs/*-PHASE-364-THEO-NOTIFY.md', notifyFiles.length === 1, JSON.stringify(notifyFiles));

// T2 required phrases
{
  const must = [CMD, 'Scientific Roadmapping', 'Hypothesis-Driven Problem Solving', 'command:/mos:research',
    'command:/mos:find-analogies', 'command-alias-table.yaml', 'live_framework: Scientific Roadmapping',
    'EXPECTED_RECIPE_COUNT', 'MindrianCommand', 'release-cut-listener', 'Step 0.55',
    'Theo has not authored this step yet', 'USES_FRAMEWORK', 'not live until', '25-PLUGIN-CONTRACT'];
  const missing = must.filter((s) => doc.indexOf(s) === -1);
  C.check('T2 the doc carries every required phrase', doc.length > 0 && missing.length === 0, 'missing: ' + JSON.stringify(missing));
}

// T3 each curated chain: target and confidence as written in the registry
{
  const reg = readJson('data/command-registry.json');
  const chains = (reg.curated_chains || []).filter((c) => c && c.from === 'command:' + CMD);
  const bad = [];
  for (const c of chains) {
    if (doc.indexOf(c.to) === -1) bad.push('to ' + c.to);
    if (doc.indexOf(String(c.confidence)) === -1) bad.push('confidence ' + c.confidence);
    if (c.transform && doc.indexOf(c.transform) === -1) bad.push('transform ' + c.transform);
  }
  C.check('T3 both curated chains match the registry (target, confidence, transform)',
    chains.length === 2 && bad.length === 0, 'chains=' + chains.length + ' ' + JSON.stringify(bad));
}

// T4 connector framework and hierarchy_rank as the connector registry has them
{
  const conn = readJson('data/connector-registry.json');
  const list = Array.isArray(conn) ? conn : (conn.connectors || conn.entries || Object.values(conn));
  const row = list.find((c) => c && c.surface === CMD);
  const ok = !!row && doc.indexOf(String(row.framework)) !== -1 &&
    doc.indexOf('hierarchy_rank ' + row.hierarchy_rank) !== -1 && doc.indexOf(String(row.reach_id)) !== -1;
  C.check('T4 the doc names the connector framework, reach and hierarchy_rank exactly', ok,
    row ? JSON.stringify({ f: row.framework, r: row.reach_id, h: row.hierarchy_rank }) : 'connector row absent');
}

// T5 OPEN-HANDOFFS links the doc by file name
{
  const oh = readText('docs/OPEN-HANDOFFS.md');
  C.check('T5 OPEN-HANDOFFS.md links the notify doc', !!docName && oh.indexOf('(' + docName + ')') !== -1, docName);
}

// T6 research-planner folder contract rows
{
  const ctx = readText('lib/core/research-planner/CONTEXT.md');
  const fileRows = ['sr-steps.cjs', 'sr-entry.cjs', 'sr-door.cjs', 'sr-filing.cjs']
    .filter((f) => !new RegExp('^\\|\\s*`' + f.replace('.', '\\.') + '`', 'm').test(ctx));
  const reuse = /^\|\s*`\/mos:scientific-roadmap`/m.test(ctx);
  C.check('T6 CONTEXT.md has the four file-map rows and the reuse-inventory row',
    fileRows.length === 0 && reuse, 'missing file rows: ' + JSON.stringify(fileRows) + ' reuse=' + reuse);
}

// T7 dash fence on the doc, CONTEXT.md and the OPEN-HANDOFFS lines for Phase 364
{
  const ctx = readText('lib/core/research-planner/CONTEXT.md');
  const ohLines = readText('docs/OPEN-HANDOFFS.md').split('\n').filter((l) => /Phase 364/.test(l));
  C.check('T7 no em-dash or en-dash in the doc, CONTEXT.md or the Phase 364 handoff lines',
    doc.length > 0 && !NO_DASH.test(doc) && !NO_DASH.test(ctx) && ohLines.length > 0 && !ohLines.some((l) => NO_DASH.test(l)),
    'doc=' + NO_DASH.test(doc) + ' ctx=' + NO_DASH.test(ctx) + ' ohLines=' + ohLines.length);
}

// T8 no 364 source file writes into or even names the Theo repo path
{
  const files = [];
  const rp = path.join(ROOT, 'lib/core/research-planner');
  for (const f of fs.readdirSync(rp)) if (/^sr-.*\.cjs$/.test(f)) files.push('lib/core/research-planner/' + f);
  files.push('scripts/scientific-roadmap.cjs');
  const td = path.join(ROOT, 'tests');
  for (const f of fs.readdirSync(td)) if (/^test-364-.*\.cjs$/.test(f) && f !== 'test-364-theo-handoff.cjs') files.push('tests/' + f);
  const hd = path.join(td, 'helpers');
  for (const f of fs.readdirSync(hd)) if (/-364\.cjs$/.test(f)) files.push('tests/helpers/' + f);
  const needle = '/home/' + 'jsagi/Theo';
  const hits = files.filter((f) => readText(f).indexOf(needle) !== -1);
  C.check('T8 no 364 source file contains the Theo repo path', files.length > 0 && hits.length === 0, JSON.stringify(hits));
}

C.check('zero network attempts (last check)', net.attempts() === 0, String(net.attempts()));
process.exit(C.summary());
