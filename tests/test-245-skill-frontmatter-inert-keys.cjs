#!/usr/bin/env node
'use strict';

/*
 * INERT KEYS AND STALE BRIEFINGS -- two findings from 2026-08-09 that had no
 * executable carrier, converted into one.
 *
 * A document can be wrong for years. A test cannot. Both defects below were found by
 * reading, and reading is not a guarantee that survives a handover, so they are pinned
 * here instead of described somewhere.
 *
 * CLAIM (a): NO SKILL.md CARRIES AN INERT FRONTMATTER KEY THAT IMPLIES GATING.
 *
 *   Four skills carried `activation:` -- brain-connector ("env:MINDRIAN_BRAIN_KEY"),
 *   conversation-mode, room-passive and room-proactive. It reads like a load condition.
 *   It is inert twice over:
 *     - Claude Code's DOCUMENTED SKILL.md frontmatter is name, description,
 *       disable-model-invocation, allowed-tools, disallowed-tools, arguments, context,
 *       background. `activation` is not among them, so the host ignores it.
 *     - No code in this plugin reads it either (verified by grep across lib/, scripts/,
 *       bin/, hooks/).
 *   So brain-connector was NEVER gated on MINDRIAN_BRAIN_KEY. It loaded when the model
 *   happened to match its description, and a reader would reasonably conclude otherwise.
 *   That mattered: the same 123-line file also said "Never mention failures to user",
 *   and between the two clauses a total Brain outage ran invisibly for weeks.
 *
 *   The keys are now COMMENTS, so the intent survives and the false claim does not.
 *
 * CLAIM (b): CLAUDE.md DOES NOT BRIEF AGENTS ON A BACKEND THAT NO LONGER EXISTS.
 *
 *   The Memgraph cutover shipped 2026-07-22 (lib/core/brain-client.cjs:24 defaulted to
 *   pws-brain-mcp.onrender.com there). CLAUDE.md went on describing the Brain as "Neo4j
 *   teaching graph + Pinecone vectors" at mindrian-brain.onrender.com for eighteen days.
 *   A second cutover shipped 2026-09-03 (Phase 339): line 24 now defaults to
 *   theo-mcp.onrender.com, the current backend in this branch AND in the installed
 *   release.
 *
 *   CLAUDE.md is MANDATORY initial context for every GSD agent. So every fresh agent was
 *   briefed on a backend that does not exist and reasoned from it. A wrong hook breaks
 *   loudly; a wrong briefing misleads silently, and this one misled a full session.
 *
 * Hermetic: filesystem reads only. No network, no graph, no host.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
let checks = 0;
function ok(cond, msg) { assert.ok(cond, msg); checks++; }

// Claude Code's documented SKILL.md frontmatter keys. Anything outside this set is
// ignored by the HOST; that is fine for plugin-internal metadata this repo's own code
// reads, and NOT fine for a key that reads like a runtime gate.
const HOST_KEYS = new Set([
  'name', 'description', 'disable-model-invocation', 'allowed-tools', 'disallowed-tools',
  'arguments', 'context', 'background',
]);

// Keys that IMPLY the host will gate, trigger, or condition loading. A key here that the
// host does not read is a lie in a file people trust. Extend this list, never shrink it.
const GATING_ILLUSION_KEYS = ['activation', 'activate-when', 'enabled-when', 'load-when', 'trigger-on', 'auto-load'];

function skillFiles() {
  const dir = path.join(ROOT, 'skills');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map((d) => path.join(dir, d, 'SKILL.md'))
    .filter((p) => fs.existsSync(p));
}

// Frontmatter keys only: the leading --- block, top-level `key:` lines, comments skipped.
function frontmatterKeys(text) {
  if (!text.startsWith('---')) return [];
  const end = text.indexOf('\n---', 3);
  if (end === -1) return [];
  return text.slice(3, end).split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .map((l) => (l.match(/^([A-Za-z][\w-]*):/) || [])[1])
    .filter(Boolean);
}

function claimA() {
  console.log('--- CLAIM (a): no SKILL.md carries an INERT frontmatter key that implies gating ---');
  const files = skillFiles();
  ok(files.length > 0, 'CLAIM a: expected to find SKILL.md files under skills/');

  const offenders = [];
  for (const f of files) {
    const keys = frontmatterKeys(fs.readFileSync(f, 'utf8'));
    for (const k of keys) {
      if (GATING_ILLUSION_KEYS.includes(k) && !HOST_KEYS.has(k)) {
        offenders.push(path.relative(ROOT, f) + ' -> ' + k);
      }
    }
  }
  ok(
    offenders.length === 0,
    'CLAIM a: these SKILL.md files carry a frontmatter key that READS like a runtime gate and is ' +
      'ignored by both Claude Code and this plugin:\n  ' + offenders.join('\n  ') +
      '\nClaude Code reads only: ' + [...HOST_KEYS].join(', ') +
      '\nIf the intent matters, keep it as a COMMENT. A frontmatter key that gates nothing is a ' +
      'claim the file cannot honour, and somebody will trust it.'
  );

  // The intent must actually have survived, or this test just deleted knowledge.
  const bc = path.join(ROOT, 'skills', 'brain-connector', 'SKILL.md');
  if (fs.existsSync(bc)) {
    const t = fs.readFileSync(bc, 'utf8');
    ok(
      /MINDRIAN_BRAIN_KEY/.test(t),
      'CLAIM a: brain-connector must still RECORD its intended activation condition somewhere, ' +
        'even though nothing enforces it. Removing the key must not remove the knowledge.'
    );
  }
  console.log('CLAIM (a) ok (' + checks + ' assertions)');
}

function claimB() {
  console.log('--- CLAIM (b): CLAUDE.md does not brief agents on a retired Brain backend ---');
  const p = path.join(ROOT, 'CLAUDE.md');
  const text = fs.readFileSync(p, 'utf8');

  // Ground truth, asserted rather than assumed: the client's default IS the Theo host.
  const client = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'brain-client.cjs'), 'utf8');
  const url = (client.match(/const BRAIN_URL = [^\n]*'(https:\/\/[^']+)'/) || [])[1];
  ok(
    url === 'https://theo-mcp.onrender.com',
    'CLAIM b: expected brain-client.cjs to default to theo-mcp.onrender.com, got ' + url +
      '. If the backend genuinely moves again, update all THREE paired files together, in the ' +
      'SAME commit: this test (the literal above), CLAUDE.md (lines naming the current default), ' +
      'and lib/core/brain-client.cjs line 24 (the single source of the default). Changing any one ' +
      'alone is exactly the failure this claim exists to catch.'
  );

  // A line describing the CURRENT Brain must not name the retired stack. Historical and
  // explicitly-retired mentions are allowed, which is why this is line-scoped rather than
  // a whole-file grep.
  const bad = [];
  text.split('\n').forEach((line, i) => {
    if (!/Brain/i.test(line)) return;
    // Escapes. Two kinds, and both are legitimate:
    //   1. HISTORICAL - the line is explicitly about what WAS true.
    //   2. DISAMBIGUATING - the line names the retired stack while explicitly saying it
    //      is NOT the Brain. This matters because Neo4j Aura is still the real backend
    //      for the USER'S OWN ROOM GRAPH, which is a different thing that happens to
    //      share a vendor. Co-occurrence on one line is not attribution, and conflating
    //      the two is precisely the confusion that cost a session, so a line that does
    //      the disambiguation should PASS rather than be silently reworded away.
    if (/RETIRED|retired|was |formerly|Cutover from|until 2026|legacy/i.test(line)) return;
    if (/separate|unrelated|user's own|USER room|kept apart/i.test(line)) return;
    if (/Pinecone|Neo4j Aura|mindrian-brain\.onrender\.com/.test(line)) {
      bad.push((i + 1) + ': ' + line.trim().slice(0, 120));
    }
  });
  ok(
    bad.length === 0,
    'CLAIM b: CLAUDE.md describes the CURRENT Brain using a retired backend:\n  ' + bad.join('\n  ') +
      '\nThe Memgraph cutover shipped 2026-07-22. CLAUDE.md is MANDATORY initial context for every ' +
      'GSD agent, so a stale line here misbriefs every fresh session silently. Mark historical ' +
      'mentions with "retired", "formerly", or "Cutover from" and they will pass.'
  );

  console.log('CLAIM (b) ok (' + checks + ' assertions cumulative)');
}

function main() {
  try {
    claimA();
    claimB();
    console.log('PASS: test-skill-frontmatter-inert-keys (claims a, b -- ' + checks + ' assertions)');
    process.exit(0);
  } catch (e) {
    console.error('FAIL: ' + (e && e.message ? e.message : e));
    process.exit(1);
  }
}

main();
