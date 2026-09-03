#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 296 Plan 02 (RSEXP-01, RSEXP-02) -- rs-experts three-cause degrade proof.
 *
 * F-7 (296-RESEARCH.md): the old Tier-0 block conflated three distinct causes
 * (no transport ships / transport unreachable / topic genuinely has zero
 * experts) into one hand-rolled string. This file proves resolveExpertTier
 * now produces three pairwise-distinguishable outcomes, that the unreachable
 * copy is sourced from lib/core/refusal-messaging.cjs verbatim (never
 * retyped), that both refusal branches omit `authors` rather than carrying
 * it empty (Theo CONN-05 omit-never-null), and that the Part 8 no-Brain-
 * client property is fenced by a test instead of only a comment.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'rs-experts-command.cjs');
const CMD_MD = path.join(__dirname, '..', 'commands', 'rs-experts.md');

const { resolveExpertTier } = require(SCRIPT);
const { refusalResponse } = require(path.join(__dirname, '..', 'lib', 'core', 'refusal-messaging.cjs'));

// Test 1: Cause (a), no Tier-1 transport ships.
test('cause (a): no transport -> AURA_TRANSPORT_ABSENT, authors key absent', async () => {
  const result = await resolveExpertTier('quantum biology', {});
  assert.equal(result.tier, 'tier0');
  assert.equal(result.refusal_code, 'AURA_TRANSPORT_ABSENT');
  assert.equal(result.degraded_note, 'local_aura_transport_not_yet_available');
  assert.equal(typeof result.reason, 'string');
  assert.ok(result.reason.length > 0);
  assert.ok(Array.isArray(result.next_moves));
  assert.ok(result.next_moves.includes('run_rs_fetch'));
  assert.ok(!('authors' in result), 'authors key must be ABSENT, not empty');
});

// Test 2: Cause (b), transport present but unreachable.
test('cause (b): unreachable transport -> BRAIN_UNREACHABLE, byte-identical reason, authors absent', async () => {
  const transport = async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:7687');
  };
  const result = await resolveExpertTier('quantum biology', { _transport: transport });
  const expected = refusalResponse('unreachable', { tool: 'rs-experts' });
  assert.equal(result.tier, 'tier0');
  assert.equal(result.refusal_code, expected.status);
  assert.equal(result.reason, expected.reason, 'reason must be byte-identical to the shipped rail copy');
  assert.ok(!('authors' in result), 'authors key must be ABSENT, not empty');
});

// Test 3: Cause (c), transport works and returns nothing -- a SUCCESS.
test('cause (c): transport resolves [] -> SUCCESS tier1, authors: [], matched: 0, no refusal_code', async () => {
  const transport = async () => [];
  const result = await resolveExpertTier('quantum biology', { _transport: transport });
  assert.equal(result.tier, 'tier1');
  assert.ok(Array.isArray(result.authors));
  assert.equal(result.authors.length, 0);
  assert.equal(result.matched, 0);
  assert.ok(!('refusal_code' in result), 'a genuinely empty result must carry no refusal_code at all');
});

// Test 4: Cause (d), transport works and returns rows.
test('cause (d): transport resolves rows -> SUCCESS tier1, authors length 2, no refusal_code', async () => {
  const rows = [
    { name: 'A. Researcher', institutions: ['MIT'], paper_count: 3, score: 0.9 },
    { name: 'B. Scholar', institutions: ['Stanford'], paper_count: 1, score: 0.4 },
  ];
  const transport = async () => rows;
  const result = await resolveExpertTier('quantum biology', { _transport: transport });
  assert.equal(result.tier, 'tier1');
  assert.equal(result.authors.length, 2);
  assert.equal(result.matched, 2);
  assert.ok(!('refusal_code' in result));
});

// Test 5: A non-unreachable-shaped rejection never masquerades as an outage.
test('non-unreachable transport error -> AURA_QUERY_FAILED, bounded detail, never crashes', async () => {
  const transport = async () => {
    throw new Error('Cypher syntax error near MATCH clause: unexpected token');
  };
  const result = await resolveExpertTier('quantum biology', { _transport: transport });
  assert.equal(result.tier, 'tier0');
  assert.equal(result.refusal_code, 'AURA_QUERY_FAILED');
  assert.equal(typeof result.detail, 'string');
  assert.ok(result.detail.length <= 500);
  assert.ok(!('authors' in result));
});

// Test 6: Distinguishability -- no two of the five envelopes collapse.
test('distinguishability: five envelopes are pairwise distinct, refusal_code never collides', async () => {
  const envelopes = [];
  envelopes.push(await resolveExpertTier('t', {}));
  envelopes.push(await resolveExpertTier('t', { _transport: async () => { throw new Error('unreachable: connect failed'); } }));
  envelopes.push(await resolveExpertTier('t', { _transport: async () => [] }));
  envelopes.push(await resolveExpertTier('t', { _transport: async () => [{ name: 'X' }, { name: 'Y' }] }));
  envelopes.push(await resolveExpertTier('t', { _transport: async () => { throw new Error('malformed query'); } }));

  const serialized = envelopes.map((e) => JSON.stringify(e));
  for (let i = 0; i < serialized.length; i += 1) {
    for (let j = i + 1; j < serialized.length; j += 1) {
      assert.notEqual(serialized[i], serialized[j], 'envelope ' + i + ' and ' + j + ' must not be JSON-equal');
    }
  }

  const codes = envelopes.map((e) => e.refusal_code).filter((c) => typeof c === 'string');
  const uniqueCodes = new Set(codes);
  assert.equal(uniqueCodes.size, codes.length, 'refusal_code values must never collide across distinct causes');
});

// Test 7: never crashes end to end, exits 0, JSON carries the right code.
test('end to end: spawnSync --json exits 0, refusal_code === AURA_TRANSPORT_ABSENT', () => {
  const res = spawnSync(process.execPath, [SCRIPT, 'quantum biology', '--json'], { encoding: 'utf8' });
  assert.equal(res.status, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.refusal_code, 'AURA_TRANSPORT_ABSENT');
  assert.ok(!('authors' in parsed));
});

// Test 8: RSEXP-02, Part 8 fence. No brainClient/brain-client in comment-
// stripped source; no mcp__mindrian-brain__ entry in allowed-tools.
test('Part 8 fence: comment-stripped source carries no Brain client; frontmatter carries no Brain tool', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  const stripped = src
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    })
    .join('\n');
  const brainClientCount = (stripped.match(/brainClient/g) || []).length;
  const brainClientDashCount = (stripped.match(/brain-client/g) || []).length;
  assert.equal(brainClientCount, 0, 'comment-stripped source must carry zero occurrences of brainClient');
  assert.equal(brainClientDashCount, 0, 'comment-stripped source must carry zero occurrences of brain-client');

  const mdSrc = fs.readFileSync(CMD_MD, 'utf8');
  const fmMatch = mdSrc.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fmMatch, 'commands/rs-experts.md must have YAML frontmatter');
  const fm = fmMatch[1];
  const allowedToolsMatch = fm.match(/allowed-tools:\n((?:[ \t]+.*\n?)*)/);
  assert.ok(allowedToolsMatch, 'commands/rs-experts.md frontmatter must declare allowed-tools');
  const allowedBlock = allowedToolsMatch[1];
  const entries = allowedBlock
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'))
    .map((l) => l.replace(/^-\s*/, '').trim());
  const brainEntries = entries.filter((e) => e.startsWith('mcp__mindrian-brain__'));
  assert.equal(brainEntries.length, 0, 'allowed-tools must carry no mcp__mindrian-brain__ entry');
});
