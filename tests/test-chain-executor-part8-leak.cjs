#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 166-08 -- the Part 8 leak scan over ALL Phase-166 surfaces (WAVE 8 VERIFY).
 * ================================================================================
 * Canon Part 8 (The Graph Boundary): the Brain is a repository of strategic
 * thinking tools, NEVER a repository of user data. LOCAL data -> BRAIN: NO. This
 * scan is the leak-net: it walks every Phase-166 lib + command + skill + agent
 * surface and asserts ZERO user-content-to-Brain write tokens, ZERO raw external
 * fetch egress in the lib code, and ZERO hardcoded external http(s) endpoint.
 *
 * It MIRRORS the shipped run-all-156.sh BRAIN_WRITE + RAW_FETCH sweep regexes
 * (Part 7: reuse the proven sweep, do not invent a new one), but adds the
 * comment-stripping discipline the run-all-156 sweep uses so a doc-comment naming
 * a forbidden token (e.g. chain-executor.cjs's header "this file makes zero Brain
 * calls") cannot self-invalidate the count. Never a bare unfiltered == 0 gate.
 *
 * The verdict suite (test-chain-executor-verdict.cjs) delegates its Part 8 check
 * to this suite (it asserts this process exits zero), mirroring the Phase 163
 * verdict -> leak-scan delegation (test-trending-to-absurd-verdict.cjs:330-338).
 *
 * Pure node built-ins (fs + path). Zero npm deps. NO em-dashes (CLAUDE.md HARD
 * RULE: hyphens only).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SUITE = 'test-chain-executor-part8-leak';
const REPO = path.resolve(__dirname, '..');

// Every Phase-166 surface: the lib spine, the migrated command docs, the skill,
// and the agent. The scan is adversarial -- it assumes each surface is hostile
// until proven clean.
const SURFACES = [
  // lib spine (CODE: full forbidden-token sweep + raw-fetch + external-http).
  'lib/core/chain-executor.cjs',
  'lib/core/chain-retry.cjs',
  'lib/core/recipe-maps.cjs',
  'lib/mcp/pipeline-state.cjs',
  'scripts/act-command.cjs',
  // command / skill / agent markdown surfaces (DOC: Brain-write + pre-gate fetch).
  'commands/act.md',
  'commands/pipeline.md',
  'commands/ignite.md',
  'agents/larry-extended.md',
  'skills/larry-personality/SKILL.md',
];

// The lib CODE surfaces (the .cjs/.js files) get the full forbidden-token sweep
// PLUS the raw-fetch + external-http checks. The markdown surfaces get the
// Brain-write + pre-gate-fetch checks only (no raw-fetch idiom in prose).
const CODE_SURFACES = new Set([
  'lib/core/chain-executor.cjs',
  'lib/core/chain-retry.cjs',
  'lib/core/recipe-maps.cjs',
  'lib/mcp/pipeline-state.cjs',
  'scripts/act-command.cjs',
]);

// The canonical Part 8 breach: a Brain-WRITE MCP call or a brain-write helper.
// Mirrors run-all-156.sh:88 BRAIN_WRITE verbatim in shape.
const BRAIN_WRITE = /mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain/;

// A raw external fetch( egress in the lib code (recipe-maps / chain-executor read
// only local committed JSON and dispatch via callbacks; they open no fetch).
// Mirrors run-all-156.sh:91 RAW_FETCH.
const RAW_FETCH = /[^a-zA-Z_]fetch[\s]*\(/;

// A hardcoded external http(s) endpoint (github.com is allowed -- it appears in
// BSL/reference URLs, never as a runtime egress target).
const EXTERNAL_HTTP = /https?:\/\//;
const ALLOWED_HTTP = /github\.com/;

// A brain-client require (the spine joins posture from the LOCAL registry; it
// must not pull in a Brain client).
const BRAIN_CLIENT = /brain-client|brainClient|brain_client/;

// A pre-gate Brain FETCH in the larry surfaces (the OFFER-not-fetch rule: the
// Brain push is an OFFER that fires only AFTER the gate; a literal mcp__brain_
// tool CALL or a brain-write helper in the doc body is the breach). Prose like
// "Brain push" / "Brain consult" is allowed (it is the OFFER, not the call).
const LARRY_BRAIN_FETCH = /mcp__brain_[a-z]+\(|fetch[\s]*\(|writeBrain|sendToBrain|ingestToBrain/;
const LARRY_SURFACES = new Set(['agents/larry-extended.md', 'skills/larry-personality/SKILL.md']);

// Strip comment lines so a doc-comment naming a forbidden token cannot
// self-invalidate the count. For .cjs we strip //, *, /* leading lines; for .md
// we strip <!-- HTML-comment and # markdown-heading lines (grep -v '^#'-style).
function stripComments(text, isCode) {
  const lines = text.split('\n');
  const kept = [];
  for (const line of lines) {
    const trimmed = line.replace(/^[\s]+/, '');
    if (isCode) {
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    } else {
      if (trimmed.startsWith('<!--') || trimmed.startsWith('#')) continue;
    }
    kept.push(line);
  }
  return kept.join('\n');
}

const findings = [];
function fail(detail) { findings.push(detail); }

for (const rel of SURFACES) {
  const abs = path.join(REPO, rel);
  if (!fs.existsSync(abs)) {
    fail('MISSING Phase-166 surface (cannot prove it clean): ' + rel);
    continue;
  }
  const raw = fs.readFileSync(abs, 'utf8');
  const isCode = CODE_SURFACES.has(rel);
  const code = stripComments(raw, isCode);

  if (isCode) {
    if (BRAIN_WRITE.test(code)) fail('FORBIDDEN Brain-write token in: ' + rel);
    if (RAW_FETCH.test(code)) fail('FORBIDDEN raw fetch( egress in: ' + rel);
    if (BRAIN_CLIENT.test(code)) fail('FORBIDDEN brain-client require in: ' + rel);
    // External http(s) endpoint, github.com excepted (line-by-line so the
    // exception is per-line, not whole-file).
    for (const line of code.split('\n')) {
      if (EXTERNAL_HTTP.test(line) && !ALLOWED_HTTP.test(line)) {
        fail('FORBIDDEN external http(s) endpoint in: ' + rel + ' :: ' + line.trim().slice(0, 80));
        break;
      }
    }
  } else {
    // Markdown surface: the Brain-write breach + (for larry) the pre-gate fetch.
    if (BRAIN_WRITE.test(code)) fail('FORBIDDEN Brain-write token in: ' + rel);
    if (LARRY_SURFACES.has(rel) && LARRY_BRAIN_FETCH.test(code)) {
      fail('FORBIDDEN pre-gate Brain fetch in larry surface: ' + rel + ' (OFFER-not-fetch breach)');
    }
  }
}

console.log(SUITE);
if (findings.length === 0) {
  console.log('  ok - Part 8 leak scan clean across ' + SURFACES.length + ' Phase-166 surfaces (zero Brain-write / raw-fetch / external-http / brain-client token)');
  console.log('\n' + SUITE + ': PASS');
  process.exit(0);
}
for (const f of findings) console.log('  XX - ' + f);
console.error('\n' + SUITE + ': FAIL -- ' + findings.length + ' Part 8 leak finding(s) above.');
process.exit(1);
