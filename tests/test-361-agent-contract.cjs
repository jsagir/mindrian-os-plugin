#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 361-04 -- dominant-design-researcher agent contract test (D-17).
 *
 * Pins the frontmatter and body contract of agents/dominant-design-researcher.md:
 * the host-enforced `tools:` allowlist mirrored by `allowed-tools:`, the R1
 * excluded-with-reason declaration with NO hitl_shape (Canon Part 11), the
 * layer declaration, the never-recompose contract sentences, the fixed
 * Tavily search budget, the no-write/no-Brain contract, and the D-06 return
 * shape (plus source_type, stated_date, entities) with no score-like key.
 *
 * A small local YAML-subset frontmatter reader, in the style of
 * scripts/check-cirs-declaration.cjs's parsePlanFrontmatter: top-level
 * scalars, top-level dash-lists (`tools:`, `allowed-tools:`), and one nested
 * map (`connector:`). No dependency added.
 *
 * exit 0 -> PASSED (all legs)
 * exit 1 -> FAILED
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const AGENT_PATH = path.join(ROOT, 'agents', 'dominant-design-researcher.md');

let passed = 0;
function ok(name) {
  passed += 1;
  console.log('  ok   ' + name);
}

// --- Local YAML-subset frontmatter reader -----------------------------------
// Handles: top-level `key: value` scalars, top-level `key:` followed by a
// dash-list, and ONE nested map (`connector:`) with its own `key: value`
// sub-lines. Good enough for this repo's agent frontmatter shape; no
// dependency added, mirroring parsePlanFrontmatter's focused-descent idiom.
function stripQuotes(s) {
  return s.replace(/^["']|["']$/g, '');
}

function parseAgentFrontmatter(md) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  assert.ok(m, 'file must open with a --- frontmatter block');
  const lines = m[1].split(/\r?\n/);
  const out = {};
  let currentListKey = null;
  let inNested = false;
  let nestedKey = null;
  let nestedObj = null;

  for (const rawLine of lines) {
    if (/^\s*#/.test(rawLine)) continue; // full-line comment
    const line = rawLine.replace(/\s+$/, '');
    if (line.trim() === '') continue;

    const indented = /^\s+\S/.test(line);

    if (inNested && indented) {
      const kv = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (kv) {
        nestedObj[kv[1]] = stripQuotes(kv[2].trim());
      }
      continue;
    }
    if (inNested && !indented) {
      out[nestedKey] = nestedObj;
      inNested = false;
      nestedKey = null;
      nestedObj = null;
      // fall through to process this non-indented line normally
    }

    if (indented) {
      const dash = /^\s+-\s+(.*)$/.exec(line);
      if (dash && currentListKey) {
        if (!Array.isArray(out[currentListKey])) out[currentListKey] = [];
        out[currentListKey].push(stripQuotes(dash[1].trim()));
        continue;
      }
      continue;
    }

    const topKv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!topKv) continue;
    const key = topKv[1];
    const val = topKv[2].trim();
    currentListKey = null;

    if (val === '') {
      // Either a dash-list follows, or a nested map follows.
      currentListKey = key;
      inNested = true;
      nestedKey = key;
      nestedObj = {};
      // We do not yet know if it is a list or a map; both branches above
      // handle their own shape (list appends to out[key] array, map lines
      // populate nestedObj). Reset ambiguity by checking on next line.
      out[key] = out[key]; // no-op placeholder
      continue;
    }
    out[key] = stripQuotes(val);
  }
  if (inNested) {
    out[nestedKey] = nestedObj;
  }
  return out;
}

// The parser above cannot statically know list-vs-map at the `key:` line, so
// re-derive `tools` / `allowed-tools` as arrays directly from source text
// (dash-list under those exact keys) rather than trusting the generic
// nested-map fallback, which only actually populates for `connector:`.
function parseDashList(md, key) {
  const re = new RegExp('^' + key + ':\\s*\\r?\\n((?:\\s+-\\s+.*\\r?\\n?)+)', 'm');
  const m = re.exec(md);
  if (!m) return null;
  return m[1]
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => stripQuotes(/^\s+-\s+(.*)$/.exec(l)[1].trim()));
}

// --- Load fixture ------------------------------------------------------------
assert.ok(fs.existsSync(AGENT_PATH), 'agents/dominant-design-researcher.md must exist');
const raw = fs.readFileSync(AGENT_PATH, 'utf8');
const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
assert.ok(fmMatch, 'file must open with a --- frontmatter block');
const fmText = fmMatch[0];
const body = raw.slice(fmMatch[0].length);
const fm = parseAgentFrontmatter(raw);
const tools = parseDashList(fmText, 'tools');
const allowedTools = parseDashList(fmText, 'allowed-tools');

// ---------- Leg 1: frontmatter identity ----------
{
  assert.strictEqual(fm.name, 'dominant-design-researcher', 'Leg 1: name matches filename');
  assert.strictEqual(fm.model, 'inherit', 'Leg 1: model is inherit');
  const ALLOWED_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];
  assert.ok(ALLOWED_COLORS.includes(fm.color), 'Leg 1: color is a documented color, got ' + fm.color);
  ok('Leg 1: frontmatter parses, name/model/color are correct');
}

// ---------- Leg 2: tools equals allowed-tools, exact fixed list ----------
{
  const EXPECTED = ['mcp__tavily__tavily-search', 'mcp__tavily-mcp__tavily-search', 'WebSearch', 'Read'];
  assert.ok(Array.isArray(tools), 'Leg 2: tools: is a dash-list');
  assert.ok(Array.isArray(allowedTools), 'Leg 2: allowed-tools: is a dash-list');
  assert.deepStrictEqual(tools, EXPECTED, 'Leg 2: tools equals the fixed expected list, in order');
  assert.deepStrictEqual(allowedTools, EXPECTED, 'Leg 2: allowed-tools equals the fixed expected list, in order');
  assert.deepStrictEqual(tools, allowedTools, 'Leg 2: tools and allowed-tools are identical');
  ok('Leg 2: tools and allowed-tools are identical and match the fixed 4-entry list');
}

// ---------- Leg 3: no banned tool names in either list ----------
{
  const BANNED_EXACT = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'Glob', 'Grep', 'Task', 'Agent', 'WebFetch'];
  const BANNED_SUBSTR = ['tavily-extract', 'brain', 'mindrian', 'theo'];
  for (const list of [tools, allowedTools]) {
    for (const entry of list) {
      assert.ok(!BANNED_EXACT.includes(entry), 'Leg 3: banned exact tool name found: ' + entry);
      for (const sub of BANNED_SUBSTR) {
        assert.ok(
          entry.toLowerCase().indexOf(sub) === -1,
          'Leg 3: banned substring "' + sub + '" found in tool name: ' + entry
        );
      }
    }
  }
  ok('Leg 3: neither tool list contains a banned name or substring');
}

// ---------- Leg 4: connector.excluded, reason, no hitl_shape/hitl_why ----------
{
  assert.ok(fm.connector, 'Leg 4: connector block is present');
  assert.strictEqual(fm.connector.excluded, 'true', 'Leg 4: connector.excluded is true');
  assert.ok(typeof fm.connector.reason === 'string' && fm.connector.reason.length > 0, 'Leg 4: connector.reason is a non-empty string');
  assert.ok(fm.connector.reason.indexOf('—') === -1, 'Leg 4: connector.reason carries no em-dash');
  assert.ok(fmText.indexOf('hitl_shape') === -1, 'Leg 4: no hitl_shape key anywhere in frontmatter');
  assert.ok(fmText.indexOf('hitl_why') === -1, 'Leg 4: no hitl_why key anywhere in frontmatter');
  ok('Leg 4: connector.excluded true with a non-empty reason, no hitl_shape/hitl_why anywhere in frontmatter');
}

// ---------- Leg 5: layer + layer_why ----------
{
  assert.strictEqual(fm.layer, 'loop', 'Leg 5: layer is loop');
  assert.ok(typeof fm.layer_why === 'string' && fm.layer_why.length > 0, 'Leg 5: layer_why is non-empty');
  ok('Leg 5: layer is loop with a non-empty layer_why');
}

// ---------- Leg 6: the three literal never-recompose sentences ----------
{
  assert.ok(body.indexOf('The gate-approved query strings are the ONLY outbound strings.') !== -1, 'Leg 6: missing the ONLY-outbound-strings sentence');
  assert.ok(body.indexOf('Never compose, rephrase, expand, or supplement a query.') !== -1, 'Leg 6: missing the never-compose sentence');
  assert.ok(body.indexOf('Every claim is sourced or absent.') !== -1, 'Leg 6: missing the sourced-or-absent sentence');
  ok('Leg 6: all three literal never-recompose/sourced-or-absent sentences present');
}

// ---------- Leg 7: search budget parameters and cap ----------
{
  assert.ok(body.indexOf('search_depth: "basic"') !== -1, 'Leg 7: missing search_depth basic');
  assert.ok(body.indexOf('topic: "general"') !== -1, 'Leg 7: missing topic general');
  assert.ok(body.indexOf('max_results: 10') !== -1, 'Leg 7: missing max_results 10');
  const bodyFlat = body.replace(/\s+/g, ' ');
  assert.ok(/one\s+`?tavily-search`?\s+call per approved query|exactly one `tavily-search` call/i.test(bodyFlat), 'Leg 7: missing one-call-per-query statement');
  assert.ok(/WebSearch.*identical string|identical string.*WebSearch/i.test(bodyFlat), 'Leg 7: missing WebSearch-with-identical-string fallback statement');
  ok('Leg 7: fixed Tavily parameters, one-call-per-query cap, and identical-string WebSearch fallback all stated');
}

// ---------- Leg 8: no-write, no-Brain, page-text-is-data ----------
{
  assert.ok(/never writes/i.test(body), 'Leg 8: missing never-writes statement');
  assert.ok(/never calls (the )?Brain/i.test(body), 'Leg 8: missing never-calls-Brain statement');
  assert.ok(/(data, never as instructions|is data.*never.*instructions|treats? fetched page text as data)/is.test(body), 'Leg 8: missing treat-fetched-text-as-data rule');
  ok('Leg 8: body states it never writes, never calls Brain, and treats fetched page text as data');
}

// ---------- Leg 9: Return shape fenced block field names, no score-like key ----------
{
  const rsIdx = body.indexOf('## Return shape');
  assert.ok(rsIdx !== -1, 'Leg 9: missing ## Return shape heading');
  const after = body.slice(rsIdx);
  const fence = /```[a-zA-Z]*\r?\n([\s\S]*?)```/.exec(after);
  assert.ok(fence, 'Leg 9: ## Return shape has a fenced block');
  const block = fence[1];
  const REQUIRED_FIELDS = [
    'claim', 'source_url', 'source_title', 'retrieved_at', 'quote_or_locator',
    'source_type', 'stated_date', 'entities', 'searched_not_found', 'error',
  ];
  for (const f of REQUIRED_FIELDS) {
    assert.ok(block.indexOf(f) !== -1, 'Leg 9: return shape missing field ' + f);
  }
  assert.ok(!/\b(score|confidence|strength|probability|rank)\b\s*:/i.test(block), 'Leg 9: return shape carries a forbidden score-like key');
  ok('Leg 9: return shape names all D-06-plus fields and carries no score-like key');
}

// ---------- Leg 10: all four lane ids appear in the body ----------
{
  const LANE_IDS = ['variant_census', 'convergence_signals', 's_curve_limits', 'discontinuity_signals'];
  for (const id of LANE_IDS) {
    assert.ok(body.indexOf(id) !== -1, 'Leg 10: lane id missing from body: ' + id);
  }
  ok('Leg 10: all four D-05 lane ids appear in the body');
}

// ---------- Leg 11: no em-dash/en-dash, no test-250 banned phrase, min lines ----------
{
  assert.ok(raw.indexOf('—') === -1, 'Leg 11: file carries an em-dash');
  assert.ok(raw.indexOf('–') === -1, 'Leg 11: file carries an en-dash');
  const FORBIDDEN = [
    /silent fallback/i,
    /never mention (failures|this bookkeeping)/i,
    /graceful degradation everywhere/i,
    /never tell (the )?user about degradation/i,
  ];
  for (const re of FORBIDDEN) {
    assert.ok(!re.test(raw), 'Leg 11: file carries a test-250 banned phrase matching ' + re);
  }
  const lineCount = raw.split(/\r?\n/).length;
  assert.ok(lineCount >= 90, 'Leg 11: file has at least 90 lines, got ' + lineCount);
  ok('Leg 11: no em-dash/en-dash, no test-250 banned phrase, at least 90 lines');
}

console.log('');
console.log('PASSED (' + passed + ' legs)');
process.exit(0);
