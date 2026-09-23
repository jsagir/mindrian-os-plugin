#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 361-07 -- /mos:dominant-designs command contract test (RED-then-GREEN).
 *
 * Pins the upgraded commands/dominant-designs.md: the quick pass stays
 * byte-identical (DDR361-13), an unattended run always takes the quick pass
 * (D-12), the deep dive's research mode gates every fetch behind the
 * navigator's approval of the query gate card (D-03/D-04), the four-lane
 * fan-out caps (D-05), the Theo structure read carries only the generic
 * handle (D-09/D-10), evidence is validated and cited by row id before Larry
 * runs the six phases (D-06/D-07), nothing is filed before the navigator's
 * approval (D-08), the Tri-Polar behavior is stated, the pending Task grant
 * row exists (D-11), and the command-registry row moved (D-11/D-12).
 *
 * A small local YAML-subset frontmatter reader (regex-based, no dependency
 * added), in the style of tests/test-361-agent-contract.cjs's local parser --
 * copied rather than imported so this test stays independent of that file.
 *
 * exit 0 -> PASSED (all legs)
 * exit 1 -> FAILED (one or more legs)
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const COMMAND_PATH = path.join(ROOT, 'commands', 'dominant-designs.md');
const GRANTS_PATH = path.join(ROOT, 'data', 'subagent-dispatch-grants.json');
const REGISTRY_PATH = path.join(ROOT, 'data', 'command-registry.json');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', '361-pre-phase.json');

// --- Anchors (from 361-07-PLAN.md <context>) --------------------------------

const A1 = 'Ask: "Quick pass or deep dive?"';
const A2 =
  "When this command runs without a navigator present (inside `/mos:act`, `chain_run`, or any caller that cannot answer the gate card), take the quick pass. The research path starts only from a navigator's answer to the gate card.";
const A3 = 'There is no send-anyway path.';
const A4 = 'Do not fetch until they approve.';
const A5 = 'No agent is dispatched before the navigator approves the research pass.';
const A6 = '[DOMINANT-DESIGN] Dispatching N lane agents';
const A7 = 'subagent_type: dominant-design-researcher';
const A8 = 'File this to competitive-analysis?';
const A9 = 'node "${CLAUDE_PLUGIN_ROOT}/scripts/dominant-design-research.cjs" theo-structure';

// The pre-phase hitl_why value (unchanged by this plan; kept byte-identical
// per Task 2's action text). Not in tests/fixtures/361-pre-phase.json (that
// fixture pins registry/Setup/quick-pass slices, not hitl_why), so this is
// a small local pin of the same pre-phase file, verified once at RED time.
const BASE_HITL_WHY = 'The dominant design is identified as a single next-move call.';

// --- Local frontmatter helpers (copied, not imported, per plan instruction) -

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function loadFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

// Mirrors tests/test-361-baseline.cjs's extractSetupSection exactly (copied,
// not imported): '## Setup' up to the next '## Session Flow' heading.
function extractSetupSection(text) {
  const startIdx = text.indexOf('## Setup');
  const endIdx = text.indexOf('## Session Flow');
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
  return text.slice(startIdx, endIdx);
}

function extractFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  return m ? { text: m[0], inner: m[1] } : null;
}

function extractBody(raw) {
  const bodyStart = raw.indexOf('\n---', 4);
  return bodyStart >= 0 ? raw.slice(bodyStart + 4) : raw;
}

// extractTopScalar(fm, key) -> the trimmed, unquoted value of a top-level
// `key: value` line (not indented, not a comment).
function extractTopScalar(fm, key) {
  const re = new RegExp('^' + key + ':[ \\t]*(.*)$', 'm');
  const m = re.exec(fm);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/, '').replace(/["']$/, '');
}

// extractAllowedTools(fm) -> array of dash-list entries under `allowed-tools:`.
function extractAllowedTools(fm) {
  const re = /^allowed-tools:\s*\r?\n((?:[ \t]+-[ \t]+.*\r?\n?)+)/m;
  const m = re.exec(fm);
  if (!m) return null;
  return m[1]
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => l.replace(/^[ \t]*-[ \t]+/, '').trim());
}

// extractConnectorBlock(fm) -> the raw text of the `connector:` nested map,
// same slicing rule as tests/test-265-declaration-truth.cjs's
// extractConnectorBlock (copied, not imported).
function extractConnectorBlock(fm) {
  const m = /\nconnector:\r?\n([\s\S]*?)(\r?\n[a-zA-Z_][a-zA-Z0-9_-]*:|$)/.exec('\n' + fm);
  return m ? m[1] : null;
}

// extractNestedScalar(block, key) -> the trimmed, unquoted value of an
// indented `key: value` line inside a nested block (skips comment lines).
function extractNestedScalar(block, key) {
  if (block === null) return null;
  const lines = block.split(/\r?\n/);
  const re = new RegExp('^[ \\t]+' + key + ':[ \\t]*(.*)$');
  for (const line of lines) {
    if (/^\s*#/.test(line)) continue;
    const m = re.exec(line);
    if (m) return m[1].trim().replace(/^["']|["']$/, '').replace(/["']$/, '');
  }
  return null;
}

function countOccurrences(haystack, needle) {
  if (needle === '') return 0;
  let count = 0;
  let idx = 0;
  for (;;) {
    idx = haystack.indexOf(needle, idx);
    if (idx === -1) break;
    count += 1;
    idx += needle.length;
  }
  return count;
}

// --- Load state ---------------------------------------------------------

let pass = 0;
let fail = 0;

function leg(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    pass += 1;
  } catch (err) {
    console.log('FAIL: ' + name + ' -- ' + (err && err.message ? err.message : err));
    fail += 1;
  }
}

let fixture;
try {
  fixture = loadFixture();
} catch (err) {
  console.log('ENV GAP: fixture not readable at ' + FIXTURE_PATH + ' -- ' + err.message);
  process.exit(77);
}

let raw;
try {
  raw = fs.readFileSync(COMMAND_PATH, 'utf8');
} catch (err) {
  console.log('ENV GAP: commands/dominant-designs.md not readable -- ' + err.message);
  process.exit(77);
}

const fmMatch = extractFrontmatter(raw);
assert.ok(fmMatch, 'commands/dominant-designs.md must open with a --- frontmatter block');
const fm = fmMatch.inner;
const fmText = fmMatch.text;
const body = extractBody(raw);
const connectorBlock = extractConnectorBlock(fm);
const allowedTools = extractAllowedTools(fm) || [];

// ============================================================================
// Leg 1: frontmatter core connector/tool truths.
// ============================================================================
leg('frontmatter: web_scope white, Task pre-approved, autonomous_safe true, hitl_shape/hitl_why/produces unchanged', () => {
  assert.strictEqual(extractNestedScalar(connectorBlock, 'web_scope'), 'white', 'connector.web_scope must be white');
  assert.ok(allowedTools.includes('Task'), 'allowed-tools must include Task');
  assert.ok(/pre-approval/i.test(fmText), 'frontmatter must contain the word pre-approval');
  assert.strictEqual(extractTopScalar(fm, 'autonomous_safe'), 'true', 'autonomous_safe must stay true');
  assert.strictEqual(extractTopScalar(fm, 'hitl_shape'), 'F.1', 'hitl_shape must stay F.1');
  assert.strictEqual(extractTopScalar(fm, 'hitl_why'), BASE_HITL_WHY, 'hitl_why must stay byte-identical to the base text');
  assert.strictEqual(extractTopScalar(fm, 'produces'), 'room/**/dominant-designs/*', 'produces must be unchanged');
});

// ============================================================================
// Leg 2: frontmatter values that must stay exactly as they were.
// ============================================================================
leg('frontmatter: frameworks, sensor_triggers, filing, reach_id, sub_mode unchanged', () => {
  assert.strictEqual(extractTopScalar(fm, 'frameworks'), '["Dominant Design"]', 'frameworks must be unchanged');
  assert.strictEqual(extractNestedScalar(connectorBlock, 'sensor_triggers'), '[SENS-06]', 'connector.sensor_triggers must be unchanged');
  assert.strictEqual(extractNestedScalar(connectorBlock, 'filing'), 'fileEvidenceWithReadback', 'connector.filing must be unchanged');
  assert.strictEqual(extractNestedScalar(connectorBlock, 'reach_id'), 'context_block', 'connector.reach_id must be unchanged');
  assert.strictEqual(extractNestedScalar(connectorBlock, 'sub_mode'), 'dominant-design', 'connector.sub_mode must be unchanged');
});

// ============================================================================
// Leg 3: teaching line differs from the base row and names research.
// ============================================================================
leg('frontmatter: teaching differs from the base row and mentions research', () => {
  const teaching = extractTopScalar(fm, 'teaching');
  assert.ok(teaching, 'teaching must be present');
  assert.notStrictEqual(teaching, fixture.dominant_designs_row.teaching, 'teaching must differ from the pre-phase row');
  assert.ok(/research/i.test(teaching), 'teaching must mention research');
});

// ============================================================================
// Leg 4 (DDR361-13a): Setup section byte-identical to the pinned fixture.
// ============================================================================
leg('DDR361-13: Setup section is byte-identical to the pre-phase fixture', () => {
  const setup = extractSetupSection(raw);
  assert.strictEqual(setup, fixture.setup_section, 'Setup section text must match the fixture byte-for-byte');
  assert.strictEqual(sha256(setup), fixture.setup_section_sha256, 'Setup section sha256 must match the fixture');
});

// ============================================================================
// Leg 5 (DDR361-13b): the quick-pass subsection is isolated and unmodified.
// ============================================================================
leg('DDR361-13: quick-pass subsection is isolated between headings and names no research-mode surface', () => {
  const startIdx = body.indexOf('### Quick pass');
  assert.notStrictEqual(startIdx, -1, '### Quick pass heading must be present');
  const afterHeading = startIdx + '### Quick pass'.length;
  const nextHeadingIdx = body.indexOf('### ', afterHeading);
  assert.notStrictEqual(nextHeadingIdx, -1, 'a next ### heading must follow ### Quick pass');
  const slice = body.slice(afterHeading, nextHeadingIdx);
  assert.strictEqual(slice.trim(), fixture.quick_pass_paragraph, 'the quick-pass subsection must contain exactly the pinned paragraph');
  assert.strictEqual(countOccurrences(body, fixture.quick_pass_paragraph), 1, 'the pinned quick-pass paragraph must occur exactly once');
  const FORBIDDEN = ['dominant-design-research.cjs', 'subagent_type', 'framework_step', 'tavily', 'websearch', 'task'];
  const sliceLower = slice.toLowerCase();
  for (const f of FORBIDDEN) {
    assert.ok(sliceLower.indexOf(f) === -1, 'quick-pass subsection must not name ' + f);
  }
});

// ============================================================================
// Leg 6 (DDR361-13c): A1 occurs exactly once.
// ============================================================================
leg('DDR361-13: the quick-pass-or-deep-dive question occurs exactly once', () => {
  assert.strictEqual(countOccurrences(body, A1), 1, 'A1 must occur exactly once');
});

// ============================================================================
// Leg 7 (DDR361-13d): both fixture when_complete_lines are present.
// ============================================================================
leg('DDR361-13: both pinned When Complete lines are present', () => {
  for (const line of fixture.when_complete_lines) {
    assert.ok(body.indexOf(line) !== -1, 'When Complete line missing: ' + line);
  }
});

// ============================================================================
// Leg 8 (D-12): unattended runs take the quick pass, stated before the fork.
// ============================================================================
leg('D-12: the unattended-takes-quick-pass rule (A2) precedes ### Deep dive', () => {
  const a2Idx = body.indexOf(A2);
  assert.notStrictEqual(a2Idx, -1, 'A2 must be present verbatim');
  const deepDiveIdx = body.indexOf('### Deep dive');
  assert.notStrictEqual(deepDiveIdx, -1, '### Deep dive heading must be present');
  assert.ok(a2Idx < deepDiveIdx, 'A2 must appear before the ### Deep dive heading');
});

// ============================================================================
// Leg 9 (D-03/D-04): the no-send-anyway / gate-before-dispatch rules, ordered.
// ============================================================================
leg('D-03/D-04: A3, A4, A5 present and ordered before the dispatch status block (A6)', () => {
  assert.notStrictEqual(body.indexOf(A3), -1, 'A3 must be present');
  const a4Idx = body.indexOf(A4);
  const a5Idx = body.indexOf(A5);
  const a6Idx = body.indexOf(A6);
  assert.notStrictEqual(a4Idx, -1, 'A4 must be present');
  assert.notStrictEqual(a5Idx, -1, 'A5 must be present');
  assert.notStrictEqual(a6Idx, -1, 'A6 must be present');
  assert.ok(a4Idx < a6Idx, 'A4 must precede A6');
  assert.ok(a5Idx < a6Idx, 'A5 must precede A6');
});

// ============================================================================
// Leg 10 (D-03/D-04): composer/audit CLI subcommands named, edit re-audit rule.
// ============================================================================
leg('D-03/D-04: body names compose-queries and audit-query, and a navigator edit is re-audited before the card re-renders', () => {
  assert.ok(body.indexOf('compose-queries') !== -1, 'body must name compose-queries');
  assert.ok(body.indexOf('audit-query') !== -1, 'body must name audit-query');
  assert.ok(body.indexOf('goes back through') !== -1, 'body must state the re-audit rule');
  assert.ok(body.indexOf('re-renders') !== -1, 'body must state that the card re-renders after a re-audited edit');
});

// ============================================================================
// Leg 11 (D-05): fan-out caps, dispatch anchor, fixed Tavily parameters.
// ============================================================================
leg('D-05: fan-out caps, subagent_type anchor (A7), and fixed Tavily parameters are all stated', () => {
  assert.ok(body.indexOf(A7) !== -1, 'A7 (subagent_type anchor) must be present');
  assert.ok(body.indexOf('resolveFanoutCap') !== -1, 'body must name resolveFanoutCap');
  assert.ok(body.indexOf('at most 4') !== -1, 'body must state the at-most-4 lane cap');
  assert.ok(body.indexOf('at most 2 approved queries per lane') !== -1, 'body must state the at-most-2-queries-per-lane cap');
  assert.ok(body.indexOf('search_depth: "basic"') !== -1, 'body must state search_depth basic');
  assert.ok(body.indexOf('topic: "general"') !== -1, 'body must state topic general');
  assert.ok(body.indexOf('max_results: 10') !== -1, 'body must state max_results 10');
  assert.ok(body.indexOf('identical string') !== -1, 'body must state the identical-string WebSearch fallback rule');
});

// ============================================================================
// Leg 12 (D-05): tavily-extract is named only inside a forbidding sentence.
// ============================================================================
leg('D-05: tavily-extract is mentioned only in a sentence that forbids it', () => {
  const lines = body.split(/\r?\n/).filter((l) => l.toLowerCase().indexOf('tavily-extract') !== -1);
  assert.ok(lines.length >= 1, 'body must mention tavily-extract at least once');
  for (const line of lines) {
    const lower = line.toLowerCase();
    assert.ok(lower.indexOf('never') !== -1 || /\bno\b/.test(lower), 'every tavily-extract line must forbid it: ' + line);
  }
});

// ============================================================================
// Leg 13 (D-09/D-10): the Theo structure call is exact and carries no domain.
// ============================================================================
leg('D-09/D-10: A9 present exactly, and no theo-structure line names a domain', () => {
  assert.ok(body.indexOf(A9) !== -1, 'A9 (theo-structure invocation, no other argument) must be present verbatim');
  const lines = raw.split(/\r?\n/).filter((l) => l.indexOf('theo-structure') !== -1);
  assert.ok(lines.length >= 1, 'at least one line must mention theo-structure');
  for (const line of lines) {
    assert.ok(line.toLowerCase().indexOf('domain') === -1, 'a theo-structure line must not also name a domain: ' + line);
  }
});

// ============================================================================
// Leg 14 (D-06/D-07/D-08): validation and evidence-frontmatter vocabulary.
// ============================================================================
leg('D-06/D-07/D-08: validate-lane, query_mismatch, structure_source(_reason), evidence_pack, depth: deep all named', () => {
  assert.ok(body.indexOf('validate-lane') !== -1, 'body must name validate-lane');
  assert.ok(body.indexOf('query_mismatch') !== -1, 'body must name query_mismatch');
  assert.ok(body.indexOf('structure_source') !== -1, 'body must name structure_source');
  assert.ok(body.indexOf('structure_source_reason') !== -1, 'body must name structure_source_reason');
  assert.ok(body.indexOf('evidence_pack') !== -1, 'body must name evidence_pack');
  assert.ok(body.indexOf('depth: deep') !== -1, 'body must name depth: deep');
});

// ============================================================================
// Leg 15 (D-06/D-07): row-id citation example and the no-number-unless-sourced rule.
// ============================================================================
leg('D-06/D-07: a row-id citation example is shown and no score/number appears unless sourced', () => {
  assert.ok(/\[E-(VC|CS|SL|DS)-\d+\]/.test(body), 'body must show a row-id citation example matching [E-(VC|CS|SL|DS)-N]');
  assert.ok(body.indexOf('unless an evidence row states it') !== -1, 'body must state the no-number-unless-sourced rule');
});

// ============================================================================
// Leg 16 (D-08): the deep-dive filing confirm (A8) precedes the file-pack call.
// ============================================================================
leg('D-08: the deep-dive filing confirm (A8) precedes the file-pack --pack invocation', () => {
  const a8Idx = body.indexOf(A8);
  const filePackIdx = body.indexOf('file-pack --pack');
  assert.notStrictEqual(a8Idx, -1, 'A8 must be present');
  assert.notStrictEqual(filePackIdx, -1, 'file-pack --pack must be present');
  assert.ok(a8Idx < filePackIdx, 'A8 must precede the file-pack --pack invocation');
});

// ============================================================================
// Leg 17: Tri-Polar section names Claude Desktop and Cowork.
// ============================================================================
leg('Tri-Polar: a ## Tri-Polar section names Claude Desktop and Cowork, and the sourced pass runs in Claude Code', () => {
  assert.ok(body.indexOf('## Tri-Polar') !== -1, 'a ## Tri-Polar section must be present');
  assert.ok(body.indexOf('Claude Desktop') !== -1, 'Tri-Polar must name Claude Desktop');
  assert.ok(body.indexOf('Cowork') !== -1, 'Tri-Polar must name Cowork');
  assert.ok(/sourced research pass runs in Claude Code/i.test(body), 'Tri-Polar must state the sourced research pass runs in Claude Code');
});

// ============================================================================
// Leg 18 (D-11): the pending Task grant row for commands/dominant-designs.md.
// ============================================================================
leg('D-11: exactly one complete Task grant row exists for commands/dominant-designs.md', () => {
  const grantsFile = JSON.parse(fs.readFileSync(GRANTS_PATH, 'utf8'));
  const rows = (grantsFile.grants || []).filter((r) => r.command === 'commands/dominant-designs.md');
  assert.strictEqual(rows.length, 1, 'exactly one grant row must exist for commands/dominant-designs.md');
  const row = rows[0];
  assert.strictEqual(row.token, 'Task', 'grant row token must be Task');
  assert.ok(row.status === 'pending' || row.status === 'granted', 'grant row status must be pending or granted');
  assert.strictEqual(row.reviewed_by, 'navigator', 'grant row reviewed_by must be navigator');
  assert.ok(typeof row.dispatch_shape === 'string' && row.dispatch_shape.length > 0, 'grant row dispatch_shape must be non-empty');
  assert.ok(typeof row.fan_bound === 'string' && row.fan_bound.length > 0, 'grant row fan_bound must be non-empty');
  assert.ok(typeof row.reason === 'string' && row.reason.length > 0, 'grant row reason must be non-empty');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(row.reviewed_date || ''), 'grant row reviewed_date must be YYYY-MM-DD');
  assert.ok(typeof row.evidence === 'string' && row.evidence.length > 0, 'grant row evidence must be non-empty');
});

// ============================================================================
// Leg 19 (D-11/D-12): the registry row's key set is unchanged, hash moved.
// ============================================================================
leg('D-11/D-12: registry row key set unchanged, autonomous_safe true, teaching moved, registry hash moved', () => {
  const registryText = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const registry = JSON.parse(registryText);
  const row = (registry.commands || []).find((c) => c && c.command === '/mos:dominant-designs');
  assert.ok(row, 'the /mos:dominant-designs row must exist in data/command-registry.json');
  const rowKeys = Object.keys(row).sort();
  const fixtureKeys = Object.keys(fixture.dominant_designs_row).sort();
  assert.deepStrictEqual(rowKeys, fixtureKeys, 'the registry row key set must be unchanged');
  assert.strictEqual(row.autonomous_safe, true, 'registry row autonomous_safe must be true');
  assert.notStrictEqual(row.teaching, fixture.dominant_designs_row.teaching, 'registry row teaching must differ from the pre-phase row');
  assert.notStrictEqual(sha256(registryText), fixture.command_registry_sha256, 'the command-registry.json sha256 must have moved');
});

// ============================================================================
// Leg 20: hygiene -- no em-dash/en-dash, no "silent fallback".
// ============================================================================
leg('hygiene: no em-dash/en-dash in commands/dominant-designs.md, and no "silent fallback"', () => {
  assert.ok(raw.indexOf('\u2014') === -1, 'file must carry no em-dash');
  assert.ok(raw.indexOf('\u2013') === -1, 'file must carry no en-dash');
  assert.ok(!/silent fallback/i.test(raw), 'file must not say "silent fallback"');
});

console.log('');
console.log('PASSED=' + pass + ' FAILED=' + fail);
process.exit(fail > 0 ? 1 : 0);
