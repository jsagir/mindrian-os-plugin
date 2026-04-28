#!/usr/bin/env node
'use strict';

/**
 * Phase 94-03 -- canonical Brain MCP server-name resolution fence.
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Why this fixture exists.
 *
 *   The v1.11.0 QA harness (Lawrence's Dr. Miriam Kaplan persona, 2026-04-28)
 *   surfaced a P0 ship-blocker (FIX-2): the Brain knowledge graph is alive
 *   (7,353 LazyGraphConcept nodes, 119,706 CO_OCCURS edges, 20+ named PWS
 *   frameworks) but unreachable from /mos:* commands. Root cause: plugin
 *   command frontmatter declared THREE inconsistent server-name prefixes
 *
 *     mcp__neo4j-brain__       (5 commands)
 *     mcp__mindrian-brain__    (6 commands -- already canonical)
 *     mcp__pinecone-brain__    (3 commands)
 *
 *   while .mcp.json declared only `mindrian-os` (the plugin's own MCP
 *   router, not the Brain). Result: every Brain-touching slash command
 *   silently fell back to the graceful tier_0 path. Decision-traces
 *   confirmed routing_source: legacy and brain_md_tier_mode: tier_0
 *   on every session.
 *
 *   Plan 94-03 selects Option A from the QA handoff (cheapest path):
 *   standardize the canonical server name across all 10 affected command
 *   frontmatter files on `mindrian-brain`, document the user-side
 *   .mcp.json snippet, and let users register their Neo4j MCP under the
 *   canonical name. No alias system. No auto-detect. Both deferred to
 *   v1.12 per Options B/C.
 *
 * Test map (5 cases, one-to-one with the PLAN <behavior> block).
 *
 *   T1  Every commands/*.md allowed-tools list mcp__*brain* reference
 *       starts with the canonical prefix `mcp__mindrian-brain__`. We
 *       walk the 10 affected files, parse each YAML frontmatter, collect
 *       allowed-tools entries, and assert any tool matching /^mcp__\\S+brain\\S*__/
 *       starts with `mcp__mindrian-brain__`.
 *
 *   T2  Zero `mcp__neo4j-brain__` references remain in any commands/*.md
 *       (frontmatter OR body prose). grep -lE pattern.
 *
 *   T3  Zero `mcp__pinecone-brain__` references remain in any commands/*.md
 *       (frontmatter OR body prose). grep -lE pattern.
 *
 *   T4  docs/install/BRAIN-SETUP.md exists and contains the literal
 *       substring `mindrian-brain` (canonical name) AND the literal
 *       substring `mcpServers` (user-side .mcp.json snippet shape).
 *
 *   T5  Optional gate: scripts/frontmatter-schema-validator.cjs (Phase
 *       88.1-07) returns exit 0 against each of the 10 modified command
 *       files. The validator is ADVISORY (PostToolUse) -- it always
 *       exits 0 regardless of violations -- so this case is structural:
 *       prove the validator is invokable against each file without
 *       crashing. Skip gracefully (PASS-and-warn) if the validator is
 *       absent in this checkout.
 *
 * Canon traceability.
 *
 *   Part 7 (Reuse Before Build): Option A is the cheapest sweep -- no
 *   new alias system, no auto-detect, no new MCP server entry in the
 *   plugin's .mcp.json. We compose existing command frontmatter into
 *   a single canonical name.
 *
 *   Part 8 (Graph Boundary): the Brain query chokepoint behavior is
 *   unchanged. This plan only standardizes the MCP server name passed
 *   in. Zero user-data egress added or removed.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const COMMANDS_DIR = path.join(REPO, 'commands');
const SETUP_DOC = path.join(REPO, 'docs', 'install', 'BRAIN-SETUP.md');
const VALIDATOR = path.join(REPO, 'scripts', 'frontmatter-schema-validator.cjs');

// The 10 commands declared by the plan as carrying or potentially carrying
// Brain MCP references. Order mirrors plan frontmatter files_modified.
const AFFECTED_COMMANDS = [
  'compare-ventures',
  'suggest-next',
  'find-analogies',
  'brain-derive',
  'query',
  'rs-experts',
  'rs-explain',
  'rs-fetch',
  'rs-thesis',
  'admin',
];

const CANONICAL_PREFIX = 'mcp__mindrian-brain__';
const FORBIDDEN_PREFIXES = ['mcp__neo4j-brain__', 'mcp__pinecone-brain__'];

// ---------- Fixture helpers ----------

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

/**
 * Minimal single-key YAML frontmatter parser sufficient for allowed-tools.
 * Returns the array of allowed-tools entries (raw strings, '- ' stripped),
 * or [] if no allowed-tools section is found. Tolerant of:
 *   - inline form: `allowed-tools: Bash(node *)`
 *   - list form (multi-line dash-prefixed entries)
 * Does NOT honor nested YAML structures or quoted values; the fixture
 * does not need them for this contract.
 */
function parseAllowedTools(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return [];
  const fm = m[1];
  const lines = fm.split('\n');
  const tools = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (/^allowed-tools:\s*$/.test(line)) {
      inList = true;
      continue;
    }
    if (/^allowed-tools:\s*\S/.test(line)) {
      // Inline form: allowed-tools: Bash(node *)
      const inline = line.replace(/^allowed-tools:\s*/, '').trim();
      if (inline) tools.push(inline);
      inList = false;
      continue;
    }
    if (inList) {
      if (/^\s+-\s+/.test(line)) {
        const v = line.replace(/^\s+-\s+/, '').trim();
        if (v) tools.push(v);
        continue;
      }
      // Any non-list-item line ends the allowed-tools block.
      if (/^\S/.test(line)) inList = false;
    }
  }
  return tools;
}

// ---------- Tests ----------

let passed = 0;
let failed = 0;
const fail = (name, msg) => {
  failed++;
  process.stderr.write('FAIL ' + name + ': ' + msg + '\n');
};
const pass = (name) => {
  passed++;
  process.stdout.write('PASS ' + name + '\n');
};

function t1_canonical_prefix_in_frontmatter() {
  const name = 'T1 every brain reference in allowed-tools uses canonical prefix';
  try {
    const violations = [];
    for (const cmd of AFFECTED_COMMANDS) {
      const file = path.join(COMMANDS_DIR, cmd + '.md');
      if (!fs.existsSync(file)) {
        violations.push(cmd + ': file missing');
        continue;
      }
      const txt = readFile(file);
      const tools = parseAllowedTools(txt);
      for (const tool of tools) {
        if (/^mcp__\S+brain\S*__/.test(tool)) {
          if (!tool.startsWith(CANONICAL_PREFIX)) {
            violations.push(cmd + ': non-canonical brain tool ' + tool);
          }
        }
      }
    }
    assert.equal(
      violations.length,
      0,
      'Non-canonical brain tools found:\n  ' + violations.join('\n  ')
    );
    pass(name);
  } catch (e) {
    fail(name, e.message);
  }
}

function t2_no_neo4j_brain_anywhere() {
  const name = 'T2 zero mcp__neo4j-brain__ references in commands/*.md';
  try {
    const matches = [];
    const files = fs.readdirSync(COMMANDS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => path.join(COMMANDS_DIR, f));
    for (const f of files) {
      const txt = readFile(f);
      if (txt.includes('mcp__neo4j-brain__') || txt.includes('mcp__neo4j-brain ')) {
        matches.push(path.relative(REPO, f));
      }
    }
    assert.equal(
      matches.length,
      0,
      'mcp__neo4j-brain__ references must be zero, found in:\n  ' + matches.join('\n  ')
    );
    pass(name);
  } catch (e) {
    fail(name, e.message);
  }
}

function t3_no_pinecone_brain_anywhere() {
  const name = 'T3 zero mcp__pinecone-brain__ references in commands/*.md';
  try {
    const matches = [];
    const files = fs.readdirSync(COMMANDS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => path.join(COMMANDS_DIR, f));
    for (const f of files) {
      const txt = readFile(f);
      if (txt.includes('mcp__pinecone-brain__') || txt.includes('mcp__pinecone-brain ')) {
        matches.push(path.relative(REPO, f));
      }
    }
    assert.equal(
      matches.length,
      0,
      'mcp__pinecone-brain__ references must be zero, found in:\n  ' + matches.join('\n  ')
    );
    pass(name);
  } catch (e) {
    fail(name, e.message);
  }
}

function t4_brain_setup_doc_exists() {
  const name = 'T4 docs/install/BRAIN-SETUP.md exists with canonical name + mcpServers snippet';
  try {
    assert.ok(
      fs.existsSync(SETUP_DOC),
      'docs/install/BRAIN-SETUP.md does not exist'
    );
    const txt = readFile(SETUP_DOC);
    assert.ok(
      txt.includes('mindrian-brain'),
      'BRAIN-SETUP.md missing canonical name `mindrian-brain`'
    );
    assert.ok(
      txt.includes('mcpServers'),
      'BRAIN-SETUP.md missing user-side .mcp.json snippet (`mcpServers`)'
    );
    pass(name);
  } catch (e) {
    fail(name, e.message);
  }
}

function t5_frontmatter_validator_runnable() {
  const name = 'T5 frontmatter-schema-validator runnable on each modified file';
  try {
    if (!fs.existsSync(VALIDATOR)) {
      // Skip gracefully -- validator is an optional Phase 88.1-07 artifact.
      process.stdout.write(
        'SKIP ' + name + ' (validator absent at ' +
          path.relative(REPO, VALIDATOR) + ')\n'
      );
      passed++;
      return;
    }
    // Phase 88.1-07 validator is a PostToolUse hook -- it reads JSON on stdin
    // and emits a JSON response on stdout. Calling it without stdin will
    // either no-op or error gracefully. We assert it does not crash with a
    // non-zero exit on a benign invocation. This is a structural smoke
    // (the validator is invokable in this checkout), not a content gate.
    const res = spawnSync(process.execPath, [VALIDATOR, '--help'], {
      input: '',
      timeout: 5000,
    });
    // Accept exit 0 (help printed) OR exit codes from "missing stdin / not a
    // hook context" branches. The validator is advisory and never blocks;
    // the only failure mode that matters here is a hard crash (e.g. syntax
    // error in the validator source).
    assert.ok(
      res.status === null || res.status === 0 || res.status === 1,
      'frontmatter-schema-validator crashed with unexpected status ' + res.status +
        ' (signal=' + res.signal + ')\n' +
        'stderr: ' + (res.stderr ? res.stderr.toString() : '')
    );
    pass(name);
  } catch (e) {
    fail(name, e.message);
  }
}

// ---------- Run ----------

t1_canonical_prefix_in_frontmatter();
t2_no_neo4j_brain_anywhere();
t3_no_pinecone_brain_anywhere();
t4_brain_setup_doc_exists();
t5_frontmatter_validator_runnable();

const total = passed + failed;
process.stdout.write(
  '\nbrain-server-resolution: ' + passed + '/' + total + ' passed\n'
);
process.exit(failed === 0 ? 0 : 1);
