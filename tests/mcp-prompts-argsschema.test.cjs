'use strict';
/*
 * Quick task 260730-mps Task 1 -- the acceptance + regression gate for the MCP
 * prompts argsSchema defect in lib/mcp/prompts.cjs.
 *
 * Follows the tests/test-eureka-mcp-tools.cjs idiom: plain node CJS, no test
 * framework, node:assert/strict, ok/fail counters, named scenario functions run
 * serially from an async main, a summary line, process.exit(failed === 0 ? 0 : 1).
 * No em-dashes, no emoji.
 *
 * THE DEFECT THIS GATE EXISTS FOR:
 *   All 6 prompts were registered through the legacy positional overload
 *   McpServer#prompt(name, ...rest). That overload shifts rest[0] off as the
 *   description ONLY when it is typeof 'string' (mcp.js:709-722). Every call
 *   site passed an OBJECT ({description, arguments:[...]}), so description
 *   stayed undefined and the whole object fell through into argsSchema.
 *   _createRegisteredPrompt then ran it through objectFromShape (zod-compat.js:49),
 *   whose values (a string and an array) are not zod schemas, so it built
 *   z3rt.object({description, arguments}). That ZodObject only explodes at PARSE
 *   time, inside ZodObject._parse, which is why registration succeeded and the
 *   FIRST prompts/get died with:
 *
 *     keyValidator._parse is not a function
 *
 *   surfacing to Desktop and Cowork Larry as MCP error -32603. Total outage of
 *   the prompts surface, not a degradation.
 *
 * WHAT IT PROVES:
 *   NON-VACUITY -- all 6 expected prompt names exist in server._registeredPrompts
 *                  before any scenario runs, so a rename or a silently-empty
 *                  registration cannot pass by testing nothing.
 *   SCENARIO A  -- the exact crash site: safeParseAsync(normalizeObjectSchema(
 *                  rp.argsSchema), fullValidArgs), byte-for-byte what the
 *                  prompts/get handler calls at mcp.js:432-433. Succeeds for the
 *                  5 argsSchema-bearing prompts; suggest-next has NO argsSchema.
 *   SCENARIO B  -- optionals are really optional: re-parse with ONLY the required
 *                  args present. All succeed.
 *   SCENARIO C  -- prompts/list metadata: description is a non-empty string on all
 *                  6; the declared arg keys are the REAL names and explicitly not
 *                  the fabricated pair ['description','arguments']; required flags
 *                  and per-arg descriptions match the originals verbatim.
 *   SCENARIO D  -- a real Client <-> real McpServer round-trip over
 *                  InMemoryTransport: prompts/list returns 6, and getPrompt works
 *                  on the argsSchema branch (grade-venture, reason-section) AND on
 *                  the no-argsSchema cb(extra) branch (suggest-next, arguments
 *                  omitted entirely). This is the -32603-is-gone proof.
 *   SCENARIO E  -- durable sweep gate: zero legacy-overload call sites survive
 *                  anywhere in tracked source.
 *
 * The server is the REAL McpServer class, never a hand-rolled stub. A stub never
 * calls objectFromShape, which IS the crash site, so a stub-based test would be
 * vacuous.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SDK_CJS = path.join(REPO_ROOT, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs');

// The SDK package "exports" map blocks deep subpath requires from a relative
// base, so every SDK internal is resolved via an absolute path built from
// REPO_ROOT rather than a bare specifier.
const { McpServer } = require(path.join(SDK_CJS, 'server', 'mcp.js'));
const { Client } = require(path.join(SDK_CJS, 'client', 'index.js'));
const { InMemoryTransport } = require(path.join(SDK_CJS, 'inMemory.js'));
const {
  normalizeObjectSchema,
  safeParseAsync,
  getObjectShape,
  getSchemaDescription,
  isSchemaOptional,
} = require(path.join(SDK_CJS, 'server', 'zod-compat.js'));

const { registerPrompts, METHODOLOGY_NAMES } = require(
  path.join(REPO_ROOT, 'lib', 'mcp', 'prompts.cjs')
);

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err && (err.stack || err.message) || String(err)) + '\n');
}
function section(title) { process.stdout.write('\n' + title + '\n'); }

// A single getPrompt must never hang the suite. computeState execSyncs
// `bash scripts/compute-state` with its own internal 10s timeout, so 20s is a
// generous ceiling that still fails with a diagnostic instead of stalling.
const GET_PROMPT_WATCHDOG_MS = 20000;
function withWatchdog(promise, ms, label) {
  let timer;
  const bark = new Promise((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error('WATCHDOG: ' + label + ' exceeded ' + ms + 'ms without returning')),
      ms
    );
  });
  return Promise.race([promise, bark]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// The expected contract. Descriptions are the verbatim originals; any drift
// here is a real behavior change, not a test-maintenance chore.
// ---------------------------------------------------------------------------
const EXPECTED = {
  'file-meeting': {
    description: 'File a meeting transcript into the Data Room. Larry extracts insights, maps to sections, and files artifacts.',
    args: {
      transcript: { required: true, description: 'The full meeting transcript text' },
      meetingDate: { required: false, description: 'Meeting date (YYYY-MM-DD format)' },
    },
    fullArgs: { transcript: 'A sample transcript body.', meetingDate: '2026-07-30' },
    requiredOnlyArgs: { transcript: 'A sample transcript body.' },
  },
  'analyze-room': {
    description: 'Analyze the current Data Room state. Larry identifies gaps, strengths, and what needs attention.',
    args: {
      focus: { required: false, description: 'Specific section or concern to focus on' },
    },
    fullArgs: { focus: 'problem' },
    requiredOnlyArgs: {},
  },
  'grade-venture': {
    description: 'Grade the venture using PWS assessment rubrics. Quick mode gives overview, deep mode provides detailed component analysis.',
    args: {
      depth: { required: false, description: 'Assessment depth: "quick" (overview) or "deep" (detailed component analysis)' },
    },
    fullArgs: { depth: 'deep' },
    requiredOnlyArgs: {},
  },
  'run-methodology': {
    description: 'Run a PWS innovation methodology framework. Larry guides you through the chosen framework applied to your venture.',
    args: {
      methodology: { required: true, description: 'Methodology to run. One of: ' + METHODOLOGY_NAMES.join(', ') },
      focus: { required: false, description: 'Specific venture aspect or question to focus the methodology on' },
    },
    fullArgs: { methodology: 'lean-canvas', focus: 'pricing' },
    requiredOnlyArgs: { methodology: 'lean-canvas' },
  },
  'suggest-next': {
    description: 'Larry analyzes room gaps and suggests what to work on next.',
    // Rule S: suggest-next OMITS argsSchema entirely. It does NOT pass {}.
    // GetPromptRequestSchema does not default params.arguments, so a client that
    // omits it yields undefined; objectFromShape({}) returns z4mini.object({}),
    // and parsing undefined against that FAILS. Passing {} would turn every
    // argument-less suggest-next call into InvalidParams. Omitting argsSchema
    // routes to the SDK else branch (mcp.js:443-447), cb(extra), no parse at all.
    args: null,
    fullArgs: null,
    requiredOnlyArgs: null,
  },
  'reason-section': {
    description: 'Analyze a room section using Minto/MECE structured reasoning. Larry captures WHY a section matters, rates confidence, and identifies cross-section dependencies.',
    args: {
      section: { required: true, description: 'Room section to reason about' },
    },
    fullArgs: { section: 'problem' },
    requiredOnlyArgs: { section: 'problem' },
  },
};

const EXPECTED_NAMES = Object.keys(EXPECTED);

// ---------------------------------------------------------------------------
// Non-vacuity self-test. Runs BEFORE every other scenario.
// ---------------------------------------------------------------------------
function checkNonVacuity(server) {
  section('NON-VACUITY -- all 6 prompts actually registered');
  const registered = Object.keys(server._registeredPrompts || {});
  for (const name of EXPECTED_NAMES) {
    try {
      assert.ok(
        Object.prototype.hasOwnProperty.call(server._registeredPrompts, name),
        'prompt "' + name + '" is absent from server._registeredPrompts (found: ' + registered.join(', ') + ')'
      );
      ok('registered: ' + name);
    } catch (e) {
      fail('registered: ' + name, e);
    }
  }
  try {
    assert.equal(registered.length, EXPECTED_NAMES.length,
      'expected exactly ' + EXPECTED_NAMES.length + ' prompts, found ' + registered.length + ': ' + registered.join(', '));
    ok('exactly ' + EXPECTED_NAMES.length + ' prompts registered');
  } catch (e) {
    fail('exactly ' + EXPECTED_NAMES.length + ' prompts registered', e);
  }
}

// ---------------------------------------------------------------------------
// SCENARIO A -- the exact crash site, with full valid args.
// ---------------------------------------------------------------------------
async function scenarioA(server) {
  section('SCENARIO A -- prompts/get argument parse (the exact crash site)');
  for (const name of EXPECTED_NAMES) {
    const spec = EXPECTED[name];
    const rp = server._registeredPrompts[name];
    const label = 'A/' + name;
    if (!rp) { fail(label, new Error('prompt not registered')); continue; }

    if (spec.args === null) {
      try {
        assert.equal(rp.argsSchema, undefined,
          'suggest-next must have NO argsSchema (Rule S), found: ' + JSON.stringify(Object.keys(getObjectShape(rp.argsSchema) || {})));
        ok(label + ' (no argsSchema, cb(extra) branch)');
      } catch (e) {
        fail(label, e);
      }
      continue;
    }

    try {
      // Byte-for-byte what mcp.js:432-433 does inside the prompts/get handler.
      const argsObj = normalizeObjectSchema(rp.argsSchema);
      assert.ok(argsObj, 'normalizeObjectSchema returned undefined for ' + name);
      const result = await safeParseAsync(argsObj, spec.fullArgs);
      assert.ok(result.success,
        'parse FAILED for ' + name + ': ' + JSON.stringify(result.error && result.error.issues || result.error));
      ok(label);
    } catch (e) {
      // The RED run lands here with the literal production error.
      fail(label, e);
    }
  }
}

// ---------------------------------------------------------------------------
// SCENARIO B -- optionals really are optional.
// ---------------------------------------------------------------------------
async function scenarioB(server) {
  section('SCENARIO B -- required-args-only parse (optionals omitted)');
  for (const name of EXPECTED_NAMES) {
    const spec = EXPECTED[name];
    const rp = server._registeredPrompts[name];
    const label = 'B/' + name;
    if (!rp) { fail(label, new Error('prompt not registered')); continue; }
    if (spec.args === null) { ok(label + ' (n/a, no argsSchema)'); continue; }

    try {
      const argsObj = normalizeObjectSchema(rp.argsSchema);
      assert.ok(argsObj, 'normalizeObjectSchema returned undefined for ' + name);
      const result = await safeParseAsync(argsObj, spec.requiredOnlyArgs);
      assert.ok(result.success,
        'required-only parse FAILED for ' + name + ' with ' + JSON.stringify(spec.requiredOnlyArgs) + ': '
        + JSON.stringify(result.error && result.error.issues || result.error));
      ok(label + ' ' + JSON.stringify(spec.requiredOnlyArgs));
    } catch (e) {
      fail(label, e);
    }
  }
}

// ---------------------------------------------------------------------------
// SCENARIO C -- prompts/list metadata.
// ---------------------------------------------------------------------------
function scenarioC(server) {
  section('SCENARIO C -- prompts/list metadata (description + real arg names)');
  for (const name of EXPECTED_NAMES) {
    const spec = EXPECTED[name];
    const rp = server._registeredPrompts[name];
    const label = 'C/' + name;
    if (!rp) { fail(label, new Error('prompt not registered')); continue; }

    try {
      assert.equal(typeof rp.description, 'string',
        'description must be a string, got ' + typeof rp.description + ' (' + String(rp.description) + ')');
      assert.ok(rp.description.length > 0, 'description must be non-empty');
      assert.equal(rp.description, spec.description, 'description drifted from the original verbatim text');
      ok(label + ' description present and verbatim');
    } catch (e) {
      fail(label + ' description', e);
    }

    if (spec.args === null) {
      try {
        assert.equal(rp.argsSchema, undefined, 'suggest-next must have NO argsSchema');
        ok(label + ' argsSchema omitted (Rule S)');
      } catch (e) {
        fail(label + ' argsSchema omitted', e);
      }
      continue;
    }

    try {
      const shape = getObjectShape(rp.argsSchema);
      assert.ok(shape, 'getObjectShape returned undefined for ' + name);
      const keys = Object.keys(shape).sort();
      const expectedKeys = Object.keys(spec.args).sort();

      // The signature of the defect: the fabricated pair.
      assert.notDeepEqual(keys, ['arguments', 'description'],
        'declared arg keys are the FABRICATED pair from the legacy overload, not real argument names');

      assert.deepEqual(keys, expectedKeys,
        'declared arg keys are ' + JSON.stringify(keys) + ', expected ' + JSON.stringify(expectedKeys));
      ok(label + ' arg keys ' + JSON.stringify(keys));

      for (const argName of expectedKeys) {
        const field = shape[argName];
        const want = spec.args[argName];
        assert.equal(isSchemaOptional(field), !want.required,
          'arg "' + argName + '" required flag mismatch (expected required=' + want.required + ')');
        assert.equal(getSchemaDescription(field), want.description,
          'arg "' + argName + '" description drifted from the original verbatim text');
      }
      ok(label + ' per-arg required flags + descriptions verbatim');
    } catch (e) {
      fail(label + ' arg shape', e);
    }
  }
}

// ---------------------------------------------------------------------------
// SCENARIO D -- real Client <-> real McpServer round-trip. Proves -32603 gone.
// ---------------------------------------------------------------------------
async function scenarioD(server) {
  section('SCENARIO D -- real prompts/list + prompts/get round-trip (the -32603 proof)');

  const client = new Client({ name: 'prompts-argsschema-test-client', version: '0.0.0' }, { capabilities: {} });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  try {
    await withWatchdog(
      Promise.all([client.connect(clientTransport), server.connect(serverTransport)]),
      GET_PROMPT_WATCHDOG_MS,
      'client/server connect'
    );
    ok('D/connect (InMemoryTransport linked pair)');
  } catch (e) {
    fail('D/connect', e);
    return;
  }

  try {
    const listed = await withWatchdog(client.listPrompts(), GET_PROMPT_WATCHDOG_MS, 'prompts/list');
    const names = listed.prompts.map(p => p.name).sort();
    assert.deepEqual(names, EXPECTED_NAMES.slice().sort(), 'prompts/list names mismatch');

    for (const p of listed.prompts) {
      const spec = EXPECTED[p.name];
      assert.equal(p.description, spec.description, 'prompts/list description mismatch for ' + p.name);
      const advertised = (p.arguments || []).map(a => a.name).sort();
      const expectedKeys = spec.args === null ? [] : Object.keys(spec.args).sort();
      assert.notDeepEqual(advertised, ['arguments', 'description'],
        'prompts/list advertises the FABRICATED arg pair for ' + p.name);
      assert.deepEqual(advertised, expectedKeys,
        'prompts/list arg names for ' + p.name + ' are ' + JSON.stringify(advertised) + ', expected ' + JSON.stringify(expectedKeys));
    }
    ok('D/prompts-list (6 prompts, real arg names, descriptions present)');
  } catch (e) {
    fail('D/prompts-list', e);
  }

  // argsSchema branch, all-optional args omitted.
  await roundTrip(client, 'D/get grade-venture (argsSchema branch, arguments:{})',
    { name: 'grade-venture', arguments: {} });

  // argsSchema branch, a required arg supplied.
  await roundTrip(client, 'D/get reason-section (argsSchema branch, required arg)',
    { name: 'reason-section', arguments: { section: 'problem' } });

  // No-argsSchema branch. `arguments` is omitted ENTIRELY on purpose: this is
  // the exact call shape Rule S exists to keep working.
  await roundTrip(client, 'D/get suggest-next (no-argsSchema cb(extra) branch, arguments omitted)',
    { name: 'suggest-next' });

  try {
    await client.close();
    await server.close();
  } catch (_e) { /* transport teardown is best-effort */ }
}

async function roundTrip(client, label, params) {
  try {
    const res = await withWatchdog(client.getPrompt(params), GET_PROMPT_WATCHDOG_MS, label);
    assert.ok(Array.isArray(res.messages), 'getPrompt did not return a messages array');
    assert.ok(res.messages.length > 0, 'getPrompt returned an EMPTY messages array');
    assert.equal(typeof res.messages[0].content.text, 'string', 'first message has no text content');
    assert.ok(res.messages[0].content.text.length > 0, 'first message text is empty');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
}

// ---------------------------------------------------------------------------
// SCENARIO E -- durable sweep gate.
//
// The pattern is assembled from fragments so that this file's own source never
// contains the literal token it searches for. A test that matches itself would
// be permanently red for the wrong reason.
// ---------------------------------------------------------------------------
function scenarioE() {
  section('SCENARIO E -- repo sweep: zero legacy-overload call sites survive');
  const legacyPattern = '\\.' + 'prompt' + '(';
  const cmd = "git grep -n \"" + legacyPattern + "\" -- '*.cjs' '*.js' '*.mjs' | grep -v ':[0-9]*: *//' || true";
  try {
    const out = execFileSync('bash', ['-c', cmd], { cwd: REPO_ROOT, encoding: 'utf-8' });
    const hits = out.split('\n').map(l => l.trim()).filter(Boolean);
    if (hits.length > 0) {
      const err = new Error(
        hits.length + ' legacy-overload call site(s) still in tracked source:\n      '
        + hits.join('\n      ')
      );
      fail('E/sweep', err);
      return;
    }
    ok('E/sweep (0 hits)');
  } catch (e) {
    fail('E/sweep', e);
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const tmpRoomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mps-prompts-'));
  let server;
  try {
    server = new McpServer({ name: 'prompts-argsschema-test', version: '0.0.0' });
    registerPrompts(server, tmpRoomDir, REPO_ROOT);

    checkNonVacuity(server);
    await scenarioA(server);
    await scenarioB(server);
    scenarioC(server);
    await scenarioD(server);
    scenarioE();
  } catch (e) {
    fail('harness', e);
  } finally {
    try { fs.rmSync(tmpRoomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }

  process.stdout.write('\n----------------------------------------\n');
  process.stdout.write('Passed: ' + passed + '  Failed: ' + failed + '\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stdout.write('\nFATAL harness error: ' + (e && (e.stack || e.message) || String(e)) + '\n');
  process.exit(1);
});
