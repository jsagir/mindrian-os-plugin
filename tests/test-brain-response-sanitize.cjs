'use strict';
// Phase 117-04 Wave 2 -- AUTOEXPLORE-117-07 SEED-003 A3 sanitizer real assertions.
//
// Promotes the 117-00 Wave 0 stub to real assertions per RESEARCH Section 4.6.
// 12 tests covering:
//   - 6 PII pattern fixtures (one per pattern: SSN, email, phone, money, ISO date, file path)
//   - Allowlist preservation (framework names, methodology verbs)
//   - Framework name preservation across all 14 ALLOWLIST framework strings
//   - sha256 deterministic placeholder
//   - Hook envelope shape per SEED-003 A3 spec
//   - No-op on non-Brain tools (passthrough)
//   - False-positive cap (pattern-only mode keeps 100% of framework-name-only inputs)
//
// Adversarial fixture catalogue: 6 PII + 5 false-positive scenarios + 1 hook
// envelope test + 1 no-op-on-non-Brain test (RESEARCH Section 4.6 risk T4
// mitigation: pattern-only v1 starts permissive; non-allowlist redaction
// disabled until Phase 121 telemetry calibrates).

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const sanitizer = require('../lib/core/brain-response-sanitize.cjs');

const HOOK_PATH = path.join(__dirname, '..', 'scripts', 'brain-response-sanitize-hook.cjs');

// ---------- Module exports surface ----------

test('exports sanitize, buildEnvelope, isBrainTool, PII_PATTERNS, ALLOWLIST', () => {
  for (const k of ['sanitize', 'buildEnvelope', 'isBrainTool', 'PII_PATTERNS', 'ALLOWLIST']) {
    assert.notEqual(sanitizer[k], undefined, 'missing export: ' + k);
  }
  assert.equal(typeof sanitizer.sanitize, 'function');
  assert.equal(typeof sanitizer.buildEnvelope, 'function');
  assert.equal(typeof sanitizer.isBrainTool, 'function');
  assert.equal(Array.isArray(sanitizer.PII_PATTERNS), true);
  assert.ok(sanitizer.PII_PATTERNS.length >= 6, 'expected 6+ PII patterns');
  assert.equal(sanitizer.ALLOWLIST instanceof Set, true);
  assert.ok(sanitizer.ALLOWLIST.size >= 25, 'expected 25+ allowlist entries');
});

// ---------- 6 PII pattern fixtures (one per pattern) ----------

test('Test 1: SSN redaction', () => {
  const out = sanitizer.sanitize('SSN 123-45-6789 is sensitive');
  assert.equal(out.includes('123-45-6789'), false, 'SSN leaked');
  assert.match(out, /\[REDACTED:[0-9a-f]{8}\]/, 'placeholder missing');
});

test('Test 2: Email redaction', () => {
  const out = sanitizer.sanitize('contact jane.doe@example.com please');
  assert.equal(out.includes('jane.doe@example.com'), false, 'email leaked');
  assert.match(out, /\[REDACTED:[0-9a-f]{8}\]/, 'placeholder missing');
});

test('Test 3: Phone redaction', () => {
  const out = sanitizer.sanitize('Call 555-123-4567 to follow up');
  assert.equal(out.includes('555-123-4567'), false, 'phone leaked');
  assert.match(out, /\[REDACTED:[0-9a-f]{8}\]/, 'placeholder missing');
});

test('Test 4: Money redaction', () => {
  const out = sanitizer.sanitize('Budget is $2.5M for Q1');
  assert.equal(out.includes('$2.5M'), false, 'money leaked');
  assert.match(out, /\[REDACTED:[0-9a-f]{8}\]/, 'placeholder missing');
});

test('Test 5: ISO date redaction', () => {
  const out = sanitizer.sanitize('Deadline 2026-05-06 firm');
  assert.equal(out.includes('2026-05-06'), false, 'date leaked');
  assert.match(out, /\[REDACTED:[0-9a-f]{8}\]/, 'placeholder missing');
});

test('Test 6: File path redaction (POSIX home + Users)', () => {
  const out1 = sanitizer.sanitize('Found at /home/jane/cv.md last week');
  assert.equal(out1.includes('/home/jane/cv.md'), false, 'home path leaked');
  assert.match(out1, /\[REDACTED:[0-9a-f]{8}\]/, 'placeholder missing for /home');
  const out2 = sanitizer.sanitize('Stored at /Users/jane/cv.md on macOS');
  assert.equal(out2.includes('/Users/jane/cv.md'), false, 'Users path leaked');
  assert.match(out2, /\[REDACTED:[0-9a-f]{8}\]/, 'placeholder missing for /Users');
});

// ---------- Allowlist preservation ----------

test('Test 7: Allowlist preservation -- framework names pass through unchanged', () => {
  const input = 'JTBD framework recommends Six Thinking Hats and Cynefin';
  const out = sanitizer.sanitize(input);
  assert.equal(out, input, 'framework names should pass through unchanged');
  for (const fw of ['JTBD', 'Six Thinking Hats', 'Cynefin']) {
    assert.ok(out.includes(fw), 'framework name redacted: ' + fw);
  }
});

test('Test 8: Framework name preservation across all 14 ALLOWLIST framework strings', () => {
  const frameworks = [
    'JTBD', 'MECE', 'Six Thinking Hats', 'Beautiful Questions', 'BONO', 'PAEI',
    'SWOT', 'Porter Five Forces', 'Reverse Salients', 'Hooked Model',
    'Cynefin', 'OODA', 'BMC', 'STP',
  ];
  for (const fw of frameworks) {
    const input = 'Framework reference: ' + fw + ' applies here';
    const out = sanitizer.sanitize(input);
    assert.ok(out.includes(fw), 'framework name redacted: ' + fw);
    assert.ok(sanitizer.ALLOWLIST.has(fw), 'allowlist missing: ' + fw);
  }
});

// ---------- Determinism ----------

test('Test 9: sha256 placeholder is deterministic across runs', () => {
  const input = 'SSN 123-45-6789 stays';
  const a = sanitizer.sanitize(input);
  const b = sanitizer.sanitize(input);
  const c = sanitizer.sanitize(input);
  assert.equal(a, b, 'run 1 != run 2');
  assert.equal(b, c, 'run 2 != run 3');
  // Same SSN -> same placeholder hash
  const out1 = sanitizer.sanitize('SSN 123-45-6789 here');
  const out2 = sanitizer.sanitize('SSN 123-45-6789 there');
  const m1 = out1.match(/\[REDACTED:([0-9a-f]{8})\]/);
  const m2 = out2.match(/\[REDACTED:([0-9a-f]{8})\]/);
  assert.ok(m1, 'placeholder missing in out1');
  assert.ok(m2, 'placeholder missing in out2');
  assert.equal(m1[1], m2[1], 'same input should produce same hash');
});

// ---------- Hook envelope shape (SEED-003 A3) ----------

test('Test 10: Hook envelope shape per SEED-003 A3 (live plugin-scoped Brain tool name)', () => {
  // Phase 239 (BRAIN-01): tool_name updated from the dead 'mcp__brain_query'
  // literal to the live plugin-scoped name so this test still exercises the
  // hook's positive-fire path after isBrainTool was anchored to
  // BRAIN_TOOL_MATCHER. The dead literal would now (correctly) fail the
  // in-hook isBrainTool re-check and take the passthrough branch, which
  // would have silently made this test assert nothing real.
  const stdinJson = JSON.stringify({
    tool_name: 'mcp__plugin_mos_mindrian-brain__brain_query',
    tool_input: { cypher: 'MATCH (n) RETURN n' },
    tool_response: { text: 'JTBD framework with SSN 123-45-6789 echoed' },
    session_id: 'test-session',
  });
  const result = spawnSync('node', [HOOK_PATH], { input: stdinJson, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, 'hook exit code != 0; stderr=' + (result.stderr || ''));
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.continue, true, 'continue should be true');
  assert.ok(envelope.hookSpecificOutput, 'hookSpecificOutput missing');
  assert.equal(envelope.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.ok(envelope.hookSpecificOutput.updatedToolOutput, 'updatedToolOutput missing');
  assert.equal(typeof envelope.hookSpecificOutput.updatedToolOutput.text, 'string');
  // Sanity: SSN was redacted; JTBD preserved.
  const sanitized = envelope.hookSpecificOutput.updatedToolOutput.text;
  assert.equal(sanitized.includes('123-45-6789'), false, 'SSN leaked through hook');
  assert.ok(sanitized.includes('JTBD'), 'JTBD redacted by hook');
});

// ---------- No-op on non-Brain tools ----------

test('Test 11: No-op on non-Brain tools (passthrough envelope)', () => {
  const stdinJson = JSON.stringify({
    tool_name: 'Read',
    tool_input: { file_path: '/some/path' },
    tool_response: { text: 'SSN 123-45-6789 in source file' },
    session_id: 'test-session',
  });
  const result = spawnSync('node', [HOOK_PATH], { input: stdinJson, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, 'hook exit code != 0; stderr=' + (result.stderr || ''));
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.continue, true);
  assert.equal(envelope.hookSpecificOutput, undefined, 'non-Brain tool should not have hookSpecificOutput');
});

// ---------- False-positive cap (pattern-only v1) ----------

test('Test 12: False-positive cap -- pattern-only mode preserves framework-name-only inputs (100%)', () => {
  // 5 false-positive scenarios: legitimate Brain output with framework names
  // and methodology verbs. v1 must keep 100% of these unchanged.
  const fixtures = [
    'JTBD framework chains with MECE coverage',
    'Six Thinking Hats sequence: Blue then White',
    'Cynefin classifies the problem as complex; OODA loop applies',
    'Reverse Salients identify lagging components per Hooked Model',
    'SWOT pairs with Porter Five Forces; BMC and STP follow',
  ];
  for (const fx of fixtures) {
    const out = sanitizer.sanitize(fx);
    assert.equal(out, fx, 'false positive on framework-name-only input: ' + fx);
  }
});

// ---------- Bonus: isBrainTool matcher (Phase 239 BRAIN-01: live scopes true, dead name false) ----------

test('isBrainTool matcher: both live scopes true, superseded bare-prefix form false', () => {
  // Phase 239: live plugin-scoped and project-scoped names now resolve true.
  assert.equal(sanitizer.isBrainTool('mcp__plugin_mos_mindrian-brain__brain_query'), true);
  assert.equal(sanitizer.isBrainTool('mcp__plugin_mos_mindrian-brain__brain_search'), true);
  assert.equal(sanitizer.isBrainTool('mcp__mindrian-brain__brain_query'), true);
  assert.equal(sanitizer.isBrainTool('mcp__mindrian-brain__brain_ask'), true);
  // Phase 239: mcp__brain_query was true before this phase; it is the
  // superseded dead literal that never matched a live registered name once
  // the Brain server shipped inside the "mos" plugin. Inverted, not deleted.
  assert.equal(sanitizer.isBrainTool('mcp__brain_query'), false);
  assert.equal(sanitizer.isBrainTool('mcp__brain_search'), false);
  // Phase 239: the old comment claimed a bare-prefix match was correct "per
  // spec". That claim is the fiction this phase kills -- the bare
  // mcp__brain_ prefix never occurs as a live registered tool name.
  assert.equal(sanitizer.isBrainTool('mcp__brain_'), false);
  // Falsy-input legs are correct today and stay unchanged.
  assert.equal(sanitizer.isBrainTool('Read'), false);
  assert.equal(sanitizer.isBrainTool('mcp__supabase_query'), false);
  assert.equal(sanitizer.isBrainTool(''), false);
  assert.equal(sanitizer.isBrainTool(null), false);
  assert.equal(sanitizer.isBrainTool(undefined), false);
});

// ---------- Threat T3: anti-impersonation (Phase 239 BRAIN-01) ----------

test('isBrainTool matcher: threat T3 anti-impersonation, foreign servers false', () => {
  // A third-party MCP server whose name merely contains or resembles
  // "mindrian-brain" must never be treated as the trusted Brain. The
  // plugin-prefix group is bounded to [a-z0-9_-]+, NOT .*, precisely to
  // block this class of impersonation.
  assert.equal(sanitizer.isBrainTool('mcp__plugin_evil_evil-brain__brain_ask'), false);
  assert.equal(sanitizer.isBrainTool('mcp__evil-brain__brain_ask'), false);
  assert.equal(sanitizer.isBrainTool('mcp__plugin_mos_mindrian-brain-evil__brain_ask'), false);
  assert.equal(sanitizer.isBrainTool('mcp__mindrian-brainX__brain_ask'), false);
});

// ---------- hooks.json parity (Phase 239 BRAIN-01, converts silent drift into a red test) ----------

test('hooks.json Brain matchers equal the exported BRAIN_TOOL_MATCHER authority', () => {
  const fs = require('node:fs');
  const hooksPath = path.join(__dirname, '..', 'hooks', 'hooks.json');
  const doc = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
  const hooks = (doc && doc.hooks) || {};
  const brainGroups = [];
  for (const hookType of Object.keys(hooks)) {
    const groups = Array.isArray(hooks[hookType]) ? hooks[hookType] : [];
    for (const group of groups) {
      const inner = Array.isArray(group.hooks) ? group.hooks : [];
      const isBrainGroup = inner.some((h) =>
        /part8-egress-guard-hook\.cjs|brain-response-sanitize-hook\.cjs/.test(String(h.command || ''))
      );
      if (isBrainGroup) brainGroups.push(group);
    }
  }
  // Exactly 2 groups expected (PreToolUse + PostToolUse). A deleted group
  // must turn this test red rather than pass vacuously over an empty set.
  assert.equal(brainGroups.length, 2, 'expected exactly 2 Brain hook groups in hooks.json, found ' + brainGroups.length);
  for (const group of brainGroups) {
    assert.equal(group.matcher, sanitizer.BRAIN_TOOL_MATCHER, 'hooks.json matcher drifted from BRAIN_TOOL_MATCHER: ' + group.matcher);
  }
});

// ---------- Bonus: empty input handling ----------

test('sanitize handles empty / null / undefined inputs without throwing', () => {
  assert.equal(sanitizer.sanitize(''), '');
  assert.equal(sanitizer.sanitize(null), '');
  assert.equal(sanitizer.sanitize(undefined), '');
  assert.equal(sanitizer.sanitize(0), '0');
});
