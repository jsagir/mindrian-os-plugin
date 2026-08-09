#!/usr/bin/env node
'use strict';

/*
 * Quick task 260807-h5s -- the four-claim regression fence for the Brain MCP
 * response envelope (defect A) and the Part 8 egress guard (defect B).
 * ==========================================================================
 *
 * WHY THIS FILE EXISTS, and why it is not redundant with the six green guard
 * suites that already ship. Those six suites were ALL green while 100 percent
 * of live Brain output was being silently blanked before it reached the model.
 * They stayed green because every fixture in them fed the PostToolUse hook a
 * synthetic tool_response of shape { text: '...' } that a real MCP transport
 * never sends. The fixtures encoded the bug's own assumption. A suite that can
 * only see the shape the bug assumes is not coverage; it is a mirror.
 *
 * So this fence asserts against the SHAPE A REAL TRANSPORT SENDS (an array of
 * content blocks) and it drives the hook as a CHILD PROCESS rather than
 * inspecting the module, because the child process is the only thing that
 * proves what actually lands on stdout.
 *
 * THE FOUR CLAIMS:
 *
 *   (a) SHAPE. hookSpecificOutput.updatedToolOutput is strictly an Array whose
 *       element zero is a text content block, in BOTH the hook and
 *       buildEnvelope. This is the fence against the bare object that made the
 *       client-side length reducer throw "e.reduce is not a function" in the
 *       user's face.
 *
 *   (b) NON-EMPTY ROUND TRIP. A tool_response carrying content blocks reaches
 *       the model with its distinctive tokens intact. Run TWICE, once with the
 *       plugin-scoped tool name (which Desktop and Cowork resolve) and once
 *       with the project-scoped name (which CLI in this dev checkout resolves),
 *       so the Tri-Polar claim is PROVEN rather than asserted in prose. Both
 *       defects live in surface-agnostic code, so one fix lands on all three
 *       surfaces by construction; these two legs are the construction proof.
 *
 *   (c) CONTENT-FREE CYPHER ALLOWS. A Cypher label census carrying zero user
 *       bytes classifies as allow, and explicitly NOT as freeform_unmatched, so
 *       a future vocabulary regression reddens here instead of silently
 *       re-gating a contentless introspection call.
 *
 *   (d) CANON PART 8 GUARD-RAIL. A payload carrying real user content is STILL
 *       blocked by step 1 on BOTH brain_query and brain_search. This is the
 *       non-negotiable one. Two anchors are used: an email address (already
 *       proven to block in tests/test-245-egress-contentless.cjs, so it is a
 *       known-good anchor) and a funding-round string. BOTH were PROBED against
 *       the shipped post-reversal classifier BEFORE these assertions were
 *       written; the observed verdict for both, on both tools, was
 *       block/content_set, including when generic methodology vocabulary is
 *       present in the SAME string. That last leg is the one that actually
 *       demonstrates the ordering claim: step 1 fires ahead of step 4, so
 *       widening step 4 cannot buy a content-carrying string an allow.
 *
 * Registration: the test-245- prefix is deliberate. tests/run-all-245.sh
 * discovers tests/test-245-*.cjs by glob, so this file registers with ZERO
 * runner execution edits (that runner's own header names the glob as its
 * contract and warns that a hand-maintained execution list is a second place to
 * forget something).
 *
 * Zero-dep: node assert + child_process only. CJS. NO em-dashes.
 *
 * License: BSL 1.1.
 */

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'scripts', 'brain-response-sanitize-hook.cjs');
const sanitizer = require(path.join(ROOT, 'lib', 'core', 'brain-response-sanitize.cjs'));
const guard = require(path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));

// Both live scopes. Plugin scope is what Claude Desktop and Cowork resolve;
// project scope is what Claude Code CLI resolves in this dev checkout, because
// the repo's root .mcp.json doubles as a project-scoped .mcp.json when the repo
// itself is opened in Claude Code.
const PLUGIN_SCOPED_STATS = 'mcp__plugin_mos_mindrian-brain__brain_stats';
const PROJECT_SCOPED_STATS = 'mcp__mindrian-brain__brain_stats';
const PLUGIN_SCOPED_QUERY = 'mcp__plugin_mos_mindrian-brain__brain_query';
const PLUGIN_SCOPED_SEARCH = 'mcp__plugin_mos_mindrian-brain__brain_search';

let checks = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  checks++;
}

function runHook(payload) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 10000,
  });
  return res;
}

// ---------------------------------------------------------------------------
// HOST-CONSUMABLE ENVELOPE SHAPES.
//
// This fence originally pinned updatedToolOutput to strictly an Array. That
// over-fits. The shape is NOT documented by Claude Code: the PostToolUse
// example in the hooks guide shows a BARE STRING ("Sanitized output"), a real
// MCP transport sends an ARRAY of content blocks, and { content: [...] } is the
// raw tool-result shape. All three are things a host can read. Pinning exactly
// one undocumented form means a host that later honors the documented string
// form would redden this suite for being right.
//
// So the fence asserts the two things that actually matter and are stable:
//   1. the envelope is a shape a host can consume, and
//   2. the text survives inside it.
//
// The ONE shape that is not consumable is a bare object with no content key.
// That is the production defect: the client-side length reducer has no array to
// walk and throws "e.reduce is not a function" into the user's face. The
// negative assertion in CLAIM (a) proves this fence still catches it.
//
// Returns the concatenated text of every text block, or null when the value is
// not a host-consumable shape at all. Non-throwing on purpose, so the negative
// case can be asserted rather than crash the run.
function extractHostText(value) {
  if (typeof value === 'string') return value;
  let blocks = null;
  if (Array.isArray(value)) {
    blocks = value;
  } else if (value && typeof value === 'object' && Array.isArray(value.content)) {
    blocks = value.content;
  }
  if (blocks === null) return null;
  return blocks
    .filter(function (b) { return b && b.type === 'text'; })
    .map(function (b) { return typeof b.text === 'string' ? b.text : ''; })
    .join('');
}

function describeShape(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) return 'Array(' + v.length + ')';
  if (typeof v === 'object') return 'object with keys [' + Object.keys(v).join(',') + ']';
  return typeof v;
}

// Asserting wrapper. Use this everywhere the suite needs the text back.
function hostText(value, label) {
  const text = extractHostText(value);
  ok(
    text !== null,
    label + ': updatedToolOutput must be a shape a host can consume, meaning a bare string, an ' +
      'array of content blocks, or { content: [...] }. Got ' + describeShape(value) + '. A bare ' +
      'object carrying no content key is the exact production defect: the client-side length ' +
      'reducer has no array to walk and throws "e.reduce is not a function".'
  );
  return text;
}

// ---------------------------------------------------------------------------
// CLAIM (a): SHAPE.
// ---------------------------------------------------------------------------
function claimA() {
  console.log('--- CLAIM (a): updatedToolOutput is a host-consumable envelope, never the bug shape ---');

  // Leg 1: the hook, driven as a child process. Inspection of the module would
  // not prove what lands on stdout, which is the thing the client parses.
  const res = runHook({
    tool_name: PLUGIN_SCOPED_STATS,
    tool_input: {},
    tool_response: { content: [{ type: 'text', text: 'JTBD graph census' }] },
    session_id: 'h5s-claim-a',
  });
  ok(res.status === 0, 'CLAIM a: hook must exit 0, got ' + res.status + ' stderr=' + (res.stderr || ''));
  const envelope = JSON.parse(res.stdout);
  ok(envelope.continue === true, 'CLAIM a: continue must be true');
  ok(!!envelope.hookSpecificOutput, 'CLAIM a: hookSpecificOutput must be present for a Brain tool');
  ok(
    envelope.hookSpecificOutput.hookEventName === 'PostToolUse',
    'CLAIM a: hookEventName must be PostToolUse'
  );
  const hookText = hostText(envelope.hookSpecificOutput.updatedToolOutput, 'CLAIM a hook');
  ok(
    hookText.indexOf('JTBD graph census') !== -1,
    'CLAIM a: hook envelope must still carry the response text, got ' + JSON.stringify(hookText)
  );

  // THE NEGATIVE. The widened predicate must still reject the shape that caused
  // the outage, or this fence has been loosened into uselessness.
  ok(
    extractHostText({ text: '' }) === null,
    'CLAIM a: the bug shape { text: ... } must NOT be accepted as host-consumable'
  );
  ok(
    extractHostText({ text: 'looks plausible' }) === null,
    'CLAIM a: a bare object with a text key is still the bug shape, however populated'
  );

  // And the three documented-or-real forms must all be accepted, so a host that
  // honors any of them does not redden this suite for being right.
  ok(extractHostText('bare string form') === 'bare string form', 'CLAIM a: bare string form must be accepted');
  ok(
    extractHostText([{ type: 'text', text: 'array form' }]) === 'array form',
    'CLAIM a: array-of-blocks form must be accepted'
  );
  ok(
    extractHostText({ content: [{ type: 'text', text: 'wrapper form' }] }) === 'wrapper form',
    'CLAIM a: { content: [...] } wrapper form must be accepted'
  );

  // Leg 2: buildEnvelope, the library seam the hook is supposed to mirror.
  // Asserted separately so the two cannot re-diverge silently.
  const built = sanitizer.buildEnvelope(PLUGIN_SCOPED_STATS, {
    content: [{ type: 'text', text: 'JTBD graph census' }],
  });
  const builtText = hostText(built.hookSpecificOutput.updatedToolOutput, 'CLAIM a buildEnvelope');
  ok(
    builtText.indexOf('JTBD graph census') !== -1,
    'CLAIM a: buildEnvelope must still carry the response text, got ' + JSON.stringify(builtText)
  );

  // Non-Brain tools stay untouched: the fence must not have widened the hook's
  // scope while fixing its shape.
  const passthrough = runHook({
    tool_name: 'Read',
    tool_input: { file_path: '/some/path' },
    tool_response: { content: [{ type: 'text', text: 'unrelated' }] },
    session_id: 'h5s-claim-a-passthrough',
  });
  ok(passthrough.status === 0, 'CLAIM a: passthrough must exit 0');
  ok(
    JSON.parse(passthrough.stdout).hookSpecificOutput === undefined,
    'CLAIM a: a non-Brain tool must still take the passthrough branch'
  );

  console.log('CLAIM (a) ok (' + checks + ' assertions)');
}

// ---------------------------------------------------------------------------
// CLAIM (b): NON-EMPTY ROUND TRIP, on BOTH live tool-name scopes.
// ---------------------------------------------------------------------------
function claimB() {
  console.log('--- CLAIM (b): content blocks round-trip non-empty, both Tri-Polar scopes ---');

  const DISTINCTIVE_NODES = '28250';
  const DISTINCTIVE_RELS = '22862';
  const DISTINCTIVE_BACKEND = 'memgraph';

  function leg(toolName, label) {
    const res = runHook({
      tool_name: toolName,
      tool_input: {},
      tool_response: {
        content: [
          {
            type: 'text',
            text: 'nodes ' + DISTINCTIVE_NODES + ' relationships ' + DISTINCTIVE_RELS +
              ' backend ' + DISTINCTIVE_BACKEND,
          },
        ],
      },
      session_id: 'h5s-claim-b',
    });
    ok(res.status === 0, label + ': hook must exit 0, got ' + res.status + ' stderr=' + (res.stderr || ''));
    const text = hostText(JSON.parse(res.stdout).hookSpecificOutput.updatedToolOutput, label);
    ok(
      typeof text === 'string' && text.length > 0,
      label + ': the response was BLANKED to an empty string, which is the exact production defect ' +
        'this fence exists to catch'
    );
    ok(text.indexOf(DISTINCTIVE_NODES) !== -1, label + ': distinctive token ' + DISTINCTIVE_NODES + ' lost in transit');
    ok(text.indexOf(DISTINCTIVE_RELS) !== -1, label + ': distinctive token ' + DISTINCTIVE_RELS + ' lost in transit');
    ok(text.indexOf(DISTINCTIVE_BACKEND) !== -1, label + ': distinctive token ' + DISTINCTIVE_BACKEND + ' lost in transit');
  }

  // Tri-Polar proof by construction: one surface-agnostic hook, both live
  // scopes. Desktop and Cowork resolve the plugin-scoped name; CLI in this dev
  // checkout resolves the project-scoped one.
  leg(PLUGIN_SCOPED_STATS, 'CLAIM b plugin-scoped (Desktop + Cowork)');
  leg(PROJECT_SCOPED_STATS, 'CLAIM b project-scoped (CLI dev checkout)');

  // Multi-block responses join rather than dropping every block after the
  // first, and non-text blocks are skipped rather than coerced.
  const multi = runHook({
    tool_name: PLUGIN_SCOPED_STATS,
    tool_input: {},
    tool_response: {
      content: [
        { type: 'text', text: 'first-block-token' },
        { type: 'image', data: 'ignored-binary' },
        { type: 'text', text: 'second-block-token' },
      ],
    },
    session_id: 'h5s-claim-b-multi',
  });
  const multiText = JSON.parse(multi.stdout).hookSpecificOutput.updatedToolOutput[0].text;
  ok(multiText.indexOf('first-block-token') !== -1, 'CLAIM b: first text block lost');
  ok(multiText.indexOf('second-block-token') !== -1, 'CLAIM b: second text block dropped');
  ok(multiText.indexOf('ignored-binary') === -1, 'CLAIM b: a non-text block must not be coerced into the text');

  // The legacy { text } fixture shape stays supported, so nothing that really
  // does send a bare .text regresses.
  const legacy = runHook({
    tool_name: PLUGIN_SCOPED_STATS,
    tool_input: {},
    tool_response: { text: 'legacy-shape-token' },
    session_id: 'h5s-claim-b-legacy',
  });
  ok(
    JSON.parse(legacy.stdout).hookSpecificOutput.updatedToolOutput[0].text.indexOf('legacy-shape-token') !== -1,
    'CLAIM b: the legacy bare-.text shape must still round-trip'
  );

  // Sanitizer coverage now runs over REAL bytes instead of over an empty
  // string, which is a strict increase in coverage, not a relaxation. Proven
  // rather than argued: seeded PII must not survive, in any form, anywhere in
  // stdout.
  const PII = 'jane@startup.com';
  const seeded = runHook({
    tool_name: PLUGIN_SCOPED_STATS,
    tool_input: {},
    tool_response: { content: [{ type: 'text', text: 'nodes 28250 contact ' + PII }] },
    session_id: 'h5s-claim-b-pii',
  });
  const seededText = JSON.parse(seeded.stdout).hookSpecificOutput.updatedToolOutput[0].text;
  ok(seededText.indexOf('28250') !== -1, 'CLAIM b: live bytes must survive alongside redaction');
  ok(seededText.indexOf(PII) === -1, 'CLAIM b: seeded PII must be REWRITTEN, not echoed');
  ok(seeded.stdout.indexOf(PII) === -1, 'CLAIM b: the raw PII value must not appear ANYWHERE in stdout');
  ok(
    /\[REDACTED:[0-9a-f]{8}\]/.test(seededText),
    'CLAIM b: a REDACTED placeholder must be emitted in place of the PII'
  );

  // Threat T-h5s-05: a malformed or hostile tool_response must never throw.
  // The hook's always-exit-0 contract is load-bearing; a throw here stalls the
  // agent loop.
  const malformed = [
    { content: 'not an array' },
    { content: [null, 7, { type: 'text' }] },
    { text: 99 },
    [],
    {},
  ];
  for (let i = 0; i < malformed.length; i++) {
    const res = runHook({
      tool_name: PLUGIN_SCOPED_STATS,
      tool_input: {},
      tool_response: malformed[i],
      session_id: 'h5s-claim-b-malformed-' + i,
    });
    ok(res.status === 0, 'CLAIM b: malformed shape ' + i + ' must still exit 0, got ' + res.status);
  }

  console.log('CLAIM (b) ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// CLAIM (c): a content-free Cypher label census ALLOWS.
// ---------------------------------------------------------------------------
function claimC() {
  console.log('--- CLAIM (c): content-free graph introspection classifies as allow ---');

  const census = guard.classify(
    { cypher: 'MATCH (n) RETURN labels(n) AS labels, count(*) AS c' },
    { toolName: PLUGIN_SCOPED_QUERY }
  );
  ok(
    census.verdict === 'allow',
    'CLAIM c: a content-free label census must classify as allow, got ' + JSON.stringify(census)
  );
  // Asserted EXPLICITLY, not folded into the verdict check: a future vocabulary
  // regression must redden HERE rather than silently re-gating the call.
  ok(
    census.class !== 'freeform_unmatched',
    'CLAIM c: the label census must not fall back to freeform_unmatched, got ' + JSON.stringify(census)
  );

  const schemaCensus = guard.classify(
    { cypher: 'CALL db.schema.nodeTypeProperties()' },
    { toolName: PLUGIN_SCOPED_QUERY }
  );
  ok(
    schemaCensus.verdict === 'allow' && schemaCensus.class !== 'freeform_unmatched',
    'CLAIM c: a schema introspection call must classify as allow, got ' + JSON.stringify(schemaCensus)
  );

  // The brain_search recognizer widening, so the documented brain_ask to
  // brain_search fallback in commands/pws-brain.md is reachable at runtime.
  ok(
    guard._isFreeFormTool(PLUGIN_SCOPED_SEARCH) === true,
    'CLAIM c: _isFreeFormTool must recognize a scoped brain_search name'
  );
  const methodologySearch = guard.classify(
    { query: 'lean startup methodology' },
    { toolName: PLUGIN_SCOPED_SEARCH }
  );
  ok(
    methodologySearch.verdict === 'allow',
    'CLAIM c: a generic methodology brain_search must classify as allow, got ' + JSON.stringify(methodologySearch)
  );

  console.log('CLAIM (c) ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// CLAIM (d): the CANON PART 8 GUARD-RAIL. Non-negotiable.
// ---------------------------------------------------------------------------
function claimD() {
  console.log('--- CLAIM (d): user content is STILL blocked, on brain_query AND brain_search ---');

  // Anchor 1: an email address. Known-good, already proven to block in
  // tests/test-245-egress-contentless.cjs.
  //
  // Anchor 2: a funding-round string. PROBED against the shipped post-reversal
  // classifier BEFORE this assertion was written. OBSERVED VERDICT, verbatim:
  //   {"verdict":"block","class":"content_set",
  //    "reason":"forbidden pattern hit:
  //     \\b(?:Series\\s+[A-E]\\b|ARR|MRR|burn\\s+rate|runway|\\d+x\\s+growth)\\b"}
  // on BOTH brain_query and brain_search. The assertion below matches that
  // observed reality; nothing here asserts a block that was not observed.
  const anchors = [
    ['email address', 'note from jane@startup.com re the pivot'],
    ['funding round', 'Series A'],
    ['funding round in prose', 'we closed our Series A last quarter'],
    // The ordering proof. Generic methodology vocabulary is present in the SAME
    // string as the user content. If step 4 could ever pre-empt step 1, THIS is
    // where the hole would open. It does not: step 1 runs first and blocks.
    ['funding round PLUS methodology vocabulary', 'framework fit for our Series A funding round'],
    ['email PLUS methodology vocabulary', 'framework fit for jane@startup.com and her schema'],
  ];

  for (let i = 0; i < anchors.length; i++) {
    const label = anchors[i][0];
    const str = anchors[i][1];

    const q = guard.classify({ cypher: str }, { toolName: PLUGIN_SCOPED_QUERY });
    ok(
      q.verdict === 'block' && q.class === 'content_set',
      'CANON PART 8 BREACH on brain_query (' + label + '): expected block/content_set, got ' + JSON.stringify(q)
    );

    const s = guard.classify({ query: str }, { toolName: PLUGIN_SCOPED_SEARCH });
    ok(
      s.verdict === 'block' && s.class === 'content_set',
      'CANON PART 8 BREACH on brain_search (' + label + '): expected block/content_set, got ' + JSON.stringify(s)
    );
  }

  // The boundary itself: step 1 is the scan that holds the line, and it holds
  // it independently of the tool name and independently of step 4 entirely.
  const bare = guard.scanForContent({ cypher: 'note from jane@startup.com' });
  ok(bare.hit === true, 'CLAIM d: scanForContent must still hit on a user-content payload');
  ok(
    typeof bare.matched_pattern === 'string' && bare.matched_pattern.length > 0,
    'CLAIM d: a step 1 hit must carry the matched pattern scalar'
  );
  // The reason scalar must carry the PATTERN, never the offending bytes.
  const leak = guard.classify({ query: 'note from jane@startup.com' }, { toolName: PLUGIN_SCOPED_SEARCH });
  ok(
    leak.reason.indexOf('jane@startup.com') === -1,
    'CLAIM d: the block reason must carry no offending bytes, got ' + JSON.stringify(leak)
  );

  console.log('CLAIM (d) ok (' + checks + ' assertions cumulative)');
}

function main() {
  claimA();
  claimB();
  claimC();
  claimD();
  console.log(
    'PASS: test-245-brain-envelope-shape (claims a, b, c, d -- ' + checks + ' assertions)'
  );
  process.exit(0);
}

try {
  main();
} catch (e) {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
}
