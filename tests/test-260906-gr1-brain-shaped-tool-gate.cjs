'use strict';
// Quick task 260906-gr1 -- close the Part 8 egress-guard bypass for MCP
// connectors registered under a non-canonical key (the live `theo` case).
//
// Before this task: `mcp__theo__brain_ask` matched neither hooks/hooks.json's
// PreToolUse matcher nor the in-script isBrainTool() backstop, so those calls
// got ZERO Canon Part 8 egress enforcement and ZERO response sanitization.
// docs/339-NOTE-theo-desktop-connector-key.md Section 2 recorded this as an
// accepted residual risk, mitigated by documentation only. This file proves
// the code-level close: a `brain_<verb>` operation is now recognized as
// Brain-shaped regardless of which connector key it arrived under, while the
// trusted-key TRUST predicate (isBrainTool) stays byte-unchanged, and the
// plugin's own LOCAL mindrian-os tool surface stays provably outside scope.
//
// Four groups, per the plan:
//   1. The bypass proof (theo-keyed CONTENT-SET now blocks; theo-keyed
//      response now gets sanitized).
//   2. The trusted-path regression (mindrian-brain / pws-brain-mcp callers
//      keep behaving exactly as before on both hooks).
//   3. The true-negative leg + the standing disjointness guard (the local
//      mindrian-os tool surface, enumerated from disk, never collides with
//      the brain_ suffix rule).
//   4. The scope invariants (BRAIN_TOOL_MATCHER frozen, superset property,
//      the T3 anti-impersonation split).
//
// Zero npm deps. Pure CJS. No em-dashes (repo hard rule).

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const sanitizer = require('../lib/core/brain-response-sanitize.cjs');

const PRE_HOOK_PATH = path.join(__dirname, '..', 'scripts', 'part8-egress-guard-hook.cjs');
const POST_HOOK_PATH = path.join(__dirname, '..', 'scripts', 'brain-response-sanitize-hook.cjs');
const TOOL_ROUTER_PATH = path.join(__dirname, '..', 'lib', 'mcp', 'tool-router.cjs');
const TOOLS_DIR = path.join(__dirname, '..', 'lib', 'mcp', 'tools');

function runPreHook(toolName, question) {
  return spawnSync('node', [PRE_HOOK_PATH], {
    input: JSON.stringify({
      tool_name: toolName,
      tool_input: { question: question },
      session_id: 'gr1-test',
    }),
    encoding: 'utf8',
    timeout: 5000,
    env: Object.assign({}, process.env, { PART8_FORCE_BRAIN_AVAILABLE: '1' }),
  });
}

function runPostHook(toolName, responseText) {
  return spawnSync('node', [POST_HOOK_PATH], {
    input: JSON.stringify({
      tool_name: toolName,
      tool_input: {},
      tool_response: { content: [{ type: 'text', text: responseText }] },
      session_id: 'gr1-test',
    }),
    encoding: 'utf8',
    timeout: 5000,
  });
}

// A CONTENT-SET fixture: an email plus a money figure. Free-form user prose
// carrying identifiable specifics is exactly the shape Part 8 must block.
const CONTENT_SET_QUESTION = 'my cofounder jane.doe@example.com raised $2.5M last week';
const SSN_RESPONSE = 'JTBD reply echoing SSN 123-45-6789';

// =============================================================================
// GROUP 1: the bypass proof.
// =============================================================================

test('GROUP 1: mcp__theo__brain_ask CONTENT-SET now blocks (was allow() unconditionally, docs/339-NOTE Section 2 + part8-egress-guard-hook.cjs:152 pre-fix)', () => {
  const r = runPreHook('mcp__theo__brain_ask', CONTENT_SET_QUESTION);
  assert.equal(r.status, 2, 'theo-keyed CONTENT-SET must now block; stderr=' + (r.stderr || ''));
  assert.match(r.stderr, /Part 8/, 'block message must cite Canon Part 8');
});

test('GROUP 1: mcp__theo__brain_ask response is now sanitized (was bare passthrough)', () => {
  const r = runPostHook('mcp__theo__brain_ask', SSN_RESPONSE);
  assert.equal(r.status, 0, 'hook always exits 0; stderr=' + (r.stderr || ''));
  const envelope = JSON.parse(r.stdout);
  assert.ok(envelope.hookSpecificOutput, 'theo-keyed response must now be sanitized, not passed through');
  const blocks = envelope.hookSpecificOutput.updatedToolOutput;
  assert.equal(Array.isArray(blocks), true, 'updatedToolOutput must be an array of content blocks');
  assert.equal(blocks[0].text.includes('123-45-6789'), false, 'SSN leaked through the theo-keyed response path');
});

// =============================================================================
// GROUP 2: trusted-path regression. The widening must not change behavior for
// the already-trusted connector keys.
// =============================================================================

const TRUSTED_TOOL_NAMES = [
  'mcp__plugin_mos_mindrian-brain__brain_query',
  'mcp__mindrian-brain__brain_ask',
];

for (const toolName of TRUSTED_TOOL_NAMES) {
  test('GROUP 2: ' + toolName + ' CONTENT-SET still blocks (unchanged verdict)', () => {
    const r = runPreHook(toolName, CONTENT_SET_QUESTION);
    assert.equal(r.status, 2, toolName + ' must still block; stderr=' + (r.stderr || ''));
    assert.match(r.stderr, /Part 8/);
  });

  test('GROUP 2: ' + toolName + ' response is still sanitized (unchanged verdict)', () => {
    const r = runPostHook(toolName, SSN_RESPONSE);
    assert.equal(r.status, 0);
    const envelope = JSON.parse(r.stdout);
    assert.ok(envelope.hookSpecificOutput, toolName + ' must still be sanitized');
    const blocks = envelope.hookSpecificOutput.updatedToolOutput;
    assert.equal(blocks[0].text.includes('123-45-6789'), false, 'SSN leaked for ' + toolName);
  });
}

test('GROUP 2: mcp__mindrian-brain__find_connections (trusted key, non-brain_ suffix, in scope only via alternation 1) still reaches classify()', () => {
  // This is the leg that proves the widening did not accidentally NARROW
  // anything: a trusted-key call whose bare tool name does not end in a
  // brain_ suffix is covered exclusively by alternation 1 of
  // BRAIN_SHAPED_TOOL_MATCHER (the byte-unchanged BRAIN_TOOL_MATCHER body),
  // not by the new alternation 2.
  assert.equal(sanitizer.isBrainShapedTool('mcp__mindrian-brain__find_connections'), true);
  const r = runPreHook('mcp__mindrian-brain__find_connections', CONTENT_SET_QUESTION);
  assert.equal(r.status, 2, 'trusted non-brain_-suffix name must still reach classify() and block');
});

// =============================================================================
// GROUP 3: the true-negative leg, plus the standing disjointness guard. This
// is the leg that would have caught the Option A / Option B failures DD-1
// measured and rejected.
// =============================================================================

test('GROUP 3: mcp__plugin_mos_mindrian-os__room_bind is NOT Brain-shaped and takes the passthrough branch', () => {
  assert.equal(sanitizer.isBrainShapedTool('mcp__plugin_mos_mindrian-os__room_bind'), false);
  const r = runPostHook('mcp__plugin_mos_mindrian-os__room_bind', SSN_RESPONSE);
  assert.equal(r.status, 0);
  const envelope = JSON.parse(r.stdout);
  assert.equal(envelope.hookSpecificOutput, undefined, 'local mindrian-os tool must take the bare passthrough branch');
});

/**
 * enumerateLocalToolNames() -- reads lib/mcp/tool-router.cjs and every
 * lib/mcp/tools/*.cjs from disk and extracts every locally registered MCP
 * tool name. The registration call spans a newline (`server.tool(` then the
 * quoted name on the next line), so the whitespace class between them must
 * cross lines -- this is why the regex uses `[\s\S]*?` rather than a
 * same-line-only `\s*`.
 */
function enumerateLocalToolNames() {
  const files = [TOOL_ROUTER_PATH];
  for (const f of fs.readdirSync(TOOLS_DIR)) {
    if (f.endsWith('.cjs')) files.push(path.join(TOOLS_DIR, f));
  }
  const names = new Set();
  const re = /server\.tool\(\s*['"]([a-z0-9_]+)['"]/g;
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(src)) !== null) {
      names.add(m[1]);
    }
  }
  return names;
}

test('GROUP 3 (DISJOINTNESS GUARD): zero locally registered mindrian-os tool names collide with the brain_ suffix rule', () => {
  const localNames = enumerateLocalToolNames();
  // The leg must not pass vacuously over zero matches: DD-1 measured 36 local
  // tool names during planning. Assert at least 20 so a broken enumeration
  // regex (e.g. a future refactor to a different registration idiom) turns
  // this test red instead of silently green.
  assert.ok(localNames.size >= 20, 'expected at least 20 local mindrian-os tool names, found ' + localNames.size);

  const collisions = [];
  for (const name of localNames) {
    const pluginScoped = 'mcp__plugin_mos_mindrian-os__' + name;
    const projectScoped = 'mcp__mindrian-os__' + name;
    if (sanitizer.isBrainShapedTool(pluginScoped)) collisions.push(pluginScoped);
    if (sanitizer.isBrainShapedTool(projectScoped)) collisions.push(projectScoped);
  }
  // This is the reason the fix is a RULE (brain_<verb> suffix) rather than a
  // ROSTER (a maintained list of known operation names): if anyone ever
  // registers a local tool literally named brain_something, this assertion
  // turns red instead of the plugin's own local write path silently getting
  // gated by the Brain egress guard.
  assert.deepEqual(collisions, [], 'local mindrian-os tool name(s) collide with the brain_ suffix rule: ' + collisions.join(', '));
});

// =============================================================================
// GROUP 4: the scope invariants.
// =============================================================================

test('GROUP 4 (FREEZE): BRAIN_TOOL_MATCHER equals its exact literal string', () => {
  assert.equal(
    sanitizer.BRAIN_TOOL_MATCHER,
    'mcp__(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp)__.*',
    'BRAIN_TOOL_MATCHER drifted from its frozen literal'
  );
});

test('GROUP 4 (SUPERSET): every fixture matching BRAIN_TOOL_MATCHER also matches BRAIN_SHAPED_TOOL_MATCHER', () => {
  const trustedFixtures = [
    'mcp__mindrian-brain__brain_ask',
    'mcp__mindrian-brain__brain_query',
    'mcp__mindrian-brain__find_connections',
    'mcp__plugin_mos_mindrian-brain__brain_ask',
    'mcp__plugin_mos_mindrian-brain__brain_query',
    'mcp__pws-brain-mcp__brain_ask',
  ];
  assert.ok(trustedFixtures.length >= 6, 'fixture corpus must have at least 6 entries');
  const trustedRe = new RegExp('^' + sanitizer.BRAIN_TOOL_MATCHER + '$');
  const shapedRe = new RegExp('^' + sanitizer.BRAIN_SHAPED_TOOL_MATCHER + '$');
  for (const name of trustedFixtures) {
    assert.equal(trustedRe.test(name), true, name + ' must match BRAIN_TOOL_MATCHER (bad fixture)');
    assert.equal(shapedRe.test(name), true, name + ' matches BRAIN_TOOL_MATCHER but not BRAIN_SHAPED_TOOL_MATCHER -- widening narrowed the trusted scope');
  }
});

test('GROUP 4 (T3 SPLIT): isBrainTool stays false while isBrainShapedTool is true for an impersonating name', () => {
  // Brain-shaped means INSPECTED, never TRUSTED, and inspection is fail-safe:
  // the guard can only block or gate a Brain-shaped call, never grant an
  // allow the payload had not already earned. mcp__evil-brain__brain_ask is
  // now Brain-shaped (the guard inspects it) but it is still not
  // Brain-TRUSTED (isBrainTool stays false), so threat T3
  // (anti-impersonation) is unaffected by this widening.
  assert.equal(sanitizer.isBrainTool('mcp__evil-brain__brain_ask'), false);
  assert.equal(sanitizer.isBrainShapedTool('mcp__evil-brain__brain_ask'), true);
});
