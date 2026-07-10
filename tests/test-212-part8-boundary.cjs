'use strict';
/*
 * Phase 212-03 Task 2 -- the Canon Part 8 boundary scan over the eureka_critic
 * MCP surface (D7 legs c and d).
 *
 * Reuses the tests/test-connector-part8-boundary.cjs idiom (named check IIFEs,
 * plain node:assert, ok/fail counters, source-region extraction, a summary line,
 * and a non-zero exit on any failure) rather than writing a parallel scanner
 * (D7c: reuse the pattern). Zero network, zero model load: this scan reads source
 * bytes + calls the pure criticRule with a stubbed baseline fixture only.
 *
 * The scan asserts the phase-212 wire boundary stays CLOSED:
 *
 *   CHECK 1 (D1 wire discipline) -- the eureka_critic zod schema carries ONLY the
 *           closed D1 shape: the six scalar/enum fields + rubric_pattern (regex-
 *           bound) + schema_version, and NO bare string field (the sycophancy
 *           channel D2 item 5 closed stays closed).
 *   CHECK 2 (D3b quantize + audit at the assembly site) -- assembleCriticPayload
 *           quantizes every float and calls auditQueryObject on the assembled
 *           payload, reusing rs-egress-prompts (never a second auditor).
 *   CHECK 3 (D4 portability) -- eureka-critic.cjs couples to NO MCP framework: no
 *           modelcontextprotocol / server.tool / tool-router reference in its code.
 *   CHECK 4 (D5 per-call resolution, D7d) -- the eureka_critic handler references
 *           NEITHER the room-directory NOR the plugin-root NOR loadRoomState.
 *   CHECK 5 (D3b item 3 coarse return) -- criticRule returns a coarse STRING
 *           confidence, never a raw float.
 *   CHECK 6 (D3b item 4) -- the handler carries the dedupe map + the rate-limit
 *           tunables (query-stream / shadow-model brake).
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TOOL_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs');
const CRITIC_PATH = path.join(REPO_ROOT, 'lib', 'core', 'eureka-critic.cjs');

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// ---------------------------------------------------------------------------
// Source-region helpers (the connector-scan line-window idiom).
// ---------------------------------------------------------------------------

// stripComments(src): drop whole-line // and block-comment (* / /*) lines so a
// scan asserts against CODE, never prose that names the very token it forbids
// (the grep -v hygiene rule D7c calls for). Inline trailing // comments are also
// trimmed so a `code(); // roomDir note` line cannot smuggle a false positive.
function stripComments(src) {
  return src
    .split(/\r?\n/)
    .map(function (raw) {
      const t = raw.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return '';
      return raw.replace(/\/\/.*$/, '');
    })
    .join('\n');
}

// extractEurekaSchemaRegion(src): the lines from the 'eureka_critic' name arg to
// (but not including) the async handler start -- the zod schema literal.
function extractEurekaSchemaRegion(src) {
  const lines = src.split(/\r?\n/);
  let nameIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*'eureka_critic'\s*,/.test(lines[i])) { nameIdx = i; break; }
  }
  assert.ok(nameIdx !== -1, 'could not locate the eureka_critic registration name arg');
  let handlerIdx = -1;
  for (let i = nameIdx; i < lines.length; i += 1) {
    if (/async\s*\(\s*payload\s*\)/.test(lines[i])) { handlerIdx = i; break; }
  }
  assert.ok(handlerIdx !== -1, 'could not locate the eureka_critic async handler');
  return { region: lines.slice(nameIdx, handlerIdx).join('\n'), handlerIdx: handlerIdx, lines: lines };
}

// extractEurekaHandlerRegion(src): the lines from the async handler start to the
// server.tool close (the first two-space `);` after the handler).
function extractEurekaHandlerRegion(src) {
  const parsed = extractEurekaSchemaRegion(src);
  const lines = parsed.lines;
  let closeIdx = -1;
  for (let i = parsed.handlerIdx; i < lines.length; i += 1) {
    if (/^ {2}\);\s*$/.test(lines[i])) { closeIdx = i; break; }
  }
  assert.ok(closeIdx !== -1, 'could not locate the eureka_critic server.tool close');
  return lines.slice(parsed.handlerIdx, closeIdx + 1).join('\n');
}

// extractFn(src, decl): the lines of a top-level function from its declaration to
// the next column-0 close brace.
function extractFn(src, declRe) {
  const lines = src.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (declRe.test(lines[i])) { start = i; break; }
  }
  assert.ok(start !== -1, 'could not locate function for ' + declRe);
  let end = -1;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\}/.test(lines[i])) { end = i; break; }
  }
  assert.ok(end !== -1, 'could not locate function close for ' + declRe);
  return lines.slice(start, end + 1).join('\n');
}

// The exact closed D1 field set the eureka_critic schema is allowed to carry.
const EXPECTED_SCHEMA_FIELDS = [
  'differential_score', 'semantic_similarity', 'lsa_similarity',
  'surprise_type', 'source_domain_tag', 'target_domain_tag',
  'rubric_pattern', 'schema_version',
];

// ---------------------------------------------------------------------------
// CHECK 1 -- D1 wire discipline: closed scalar/enum schema, no bare string.
// ---------------------------------------------------------------------------
(function check1_wireDiscipline() {
  const label = 'CHECK 1 - D1 wire discipline (closed scalar/enum schema, no free-text string)';
  try {
    const src = fs.readFileSync(TOOL_ROUTER_PATH, 'utf8');
    const schemaRegion = extractEurekaSchemaRegion(src).region;

    // (a) every schema field is present and NO other field is (exact closed set).
    const fieldKeys = [];
    for (const line of schemaRegion.split(/\r?\n/)) {
      const m = /^\s+([A-Za-z0-9_]+):\s*z\./.exec(line);
      if (m) fieldKeys.push(m[1]);
    }
    const got = fieldKeys.slice().sort();
    const want = EXPECTED_SCHEMA_FIELDS.slice().sort();
    assert.deepEqual(got, want,
      label + ': schema fields ' + JSON.stringify(got) + ' do not equal the closed D1 set ' + JSON.stringify(want));

    // (b) NO bare z.string(): every z.string() must be immediately .regex-bound
    // (rubric_pattern is the only string allowed, and it carries a regex).
    const allStrings = (schemaRegion.match(/z\.string\(\)/g) || []).length;
    const regexStrings = (schemaRegion.match(/z\.string\(\)\.regex/g) || []).length;
    assert.equal(allStrings, regexStrings,
      label + ': found a bare z.string() with no .regex constraint (a free-text smuggling channel)');
    assert.ok(regexStrings >= 1,
      label + ': rubric_pattern must be a regex-bound string');

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 2 -- D3b quantize + Part 8 audit at the assembly site.
// ---------------------------------------------------------------------------
(function check2_quantizeAndAudit() {
  const label = 'CHECK 2 - D3b quantize every float + auditQueryObject reuse at assembleCriticPayload';
  try {
    const src = fs.readFileSync(CRITIC_PATH, 'utf8');
    const fn = extractFn(src, /function\s+assembleCriticPayload\s*\(/);

    for (const field of ['differential_score', 'semantic_similarity', 'lsa_similarity']) {
      const re = new RegExp(field + ':\\s*quantize\\(');
      assert.ok(re.test(fn),
        label + ': ' + field + ' is not quantized inside assembleCriticPayload (D3b item 1)');
    }
    assert.ok(/auditQueryObject\(/.test(fn),
      label + ': assembleCriticPayload does not call auditQueryObject on the assembled payload (T-212-01)');

    // Reuse, not reinvent: the egress auditors are REQUIRED from rs-egress-prompts
    // and NO local audit* function is DEFINED in this module.
    assert.ok(/require\(\s*['"]\.\/rs-egress-prompts\.cjs['"]\s*\)/.test(src),
      label + ': eureka-critic.cjs must require the shared rs-egress-prompts auditors');
    assert.ok(!/\bfunction\s+audit\w*/.test(src),
      label + ': eureka-critic.cjs defines a local audit* function (must reuse rs-egress-prompts, not reinvent)');

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 3 -- D4 portability: no MCP-framework coupling in the critic module code.
// ---------------------------------------------------------------------------
(function check3_portability() {
  const label = 'CHECK 3 - D4 portability (eureka-critic.cjs code couples to no MCP framework)';
  try {
    const code = stripComments(fs.readFileSync(CRITIC_PATH, 'utf8'));
    for (const token of ['modelcontextprotocol', 'server.tool', 'tool-router']) {
      assert.ok(code.indexOf(token) === -1,
        label + ': eureka-critic.cjs code references "' + token + '" (breaks the SEED-014 lift boundary)');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 4 -- D5 per-call resolution (D7d): the handler touches no room closure.
// ---------------------------------------------------------------------------
(function check4_perCallResolution() {
  const label = 'CHECK 4 - D5 per-call resolution (eureka_critic handler references no roomDir / pluginRoot / loadRoomState)';
  try {
    const src = fs.readFileSync(TOOL_ROUTER_PATH, 'utf8');
    const handlerCode = stripComments(extractEurekaHandlerRegion(src));
    for (const token of ['roomDir', 'pluginRoot', 'loadRoomState']) {
      assert.ok(handlerCode.indexOf(token) === -1,
        label + ': the handler references "' + token + '" (the addendum stale-room bug the D5 mandate forbids)');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 5 -- D3b item 3 coarse return: criticRule returns a STRING confidence.
// ---------------------------------------------------------------------------
(function check5_coarseConfidence() {
  const label = 'CHECK 5 - D3b item 3 coarse return (criticRule confidence is a string band, never a raw float)';
  let tmpBaseline;
  try {
    const critic = require(CRITIC_PATH);
    // Stubbed baseline fixture: a calibrated bucket so confidence bands to a
    // string ('high') rather than the deferred 'unknown' -- either way a STRING.
    tmpBaseline = path.join(os.tmpdir(), 'test-212-baseline-' + process.pid + '.json');
    fs.writeFileSync(tmpBaseline, JSON.stringify({
      status: 'calibrated',
      embedding_model: 'stub',
      buckets: { '111111': { n: 10, correct: 10 } },
    }));
    const payload = {
      differential_score: 0.90,
      semantic_similarity: 0.30,
      lsa_similarity: 0.20,
      surprise_type: 'structural_transfer',
      source_domain_tag: 'engineering',
      target_domain_tag: 'biology',
      rubric_pattern: '111111',
      schema_version: 1,
    };
    const ruling = critic.criticRule(payload, { baselinePath: tmpBaseline });
    assert.equal(typeof ruling.confidence, 'string',
      label + ': confidence is ' + typeof ruling.confidence + ', expected a coarse string band');
    assert.equal(typeof ruling.verdict, 'string', label + ': verdict must be a string enum');
    assert.equal(typeof ruling.reasoning_tag, 'string', label + ': reasoning_tag must be a string enum');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (tmpBaseline) { try { fs.unlinkSync(tmpBaseline); } catch (_e) { /* best effort */ } }
  }
})();

// ---------------------------------------------------------------------------
// CHECK 6 -- D3b item 4: dedupe map + rate-limit tunables live in the handler.
// ---------------------------------------------------------------------------
(function check6_dedupeAndRateLimit() {
  const label = 'CHECK 6 - D3b item 4 (handler carries the dedupe map + rate-limit tunables)';
  try {
    const src = fs.readFileSync(TOOL_ROUTER_PATH, 'utf8');
    const handlerRegion = extractEurekaHandlerRegion(src);
    for (const token of [
      'EUREKA_CRITIC_DEDUPE_TTL_MS',
      'EUREKA_CRITIC_RATE_LIMIT',
      '_eurekaCriticDedupeCache',
      '_eurekaCriticRateWindow',
    ]) {
      assert.ok(handlerRegion.indexOf(token) !== -1,
        label + ': the handler is missing "' + token + '" (dedupe/rate-limit brake, D3b item 4)');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('eureka_critic Part-8 boundary scan: ' + passed + ' passed, ' + failed + ' failed (D7 legs c + d)\n');
process.exit(failed === 0 ? 0 : 1);
