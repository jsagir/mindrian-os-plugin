#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-visualize-real-chain.cjs -- Phase 347-09.
 *
 * Task 1 (behaviors 1-7): generateMermaidChain's additive routing render --
 * labelled conditional arrows, a fan-out subgraph, a halt node and a
 * reviewer node, every one driven by an OPTIONAL field on the step object,
 * with the undeclared/linear render pinned byte-identical by a frozen
 * expected string (the floor every later plan must keep).
 *
 * Task 2 (behaviors 1-7, appended below): the visualize-chain router
 * sub-case repointed at the real resolved chain and the real recorded run,
 * the hardcoded six-step literal deleted, and an honest empty statement
 * when nothing has been recorded.
 *
 * Plain node:assert CJS script. Hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..');
const visualOps = require(path.join(REPO, 'lib', 'core', 'visual-ops.cjs'));
const { generateMermaidChain, DS_HEX } = visualOps;

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

let failures = 0;
function checkAsync(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      checks += 1;
      console.log('  ok - ' + name);
    })
    .catch((err) => {
      failures += 1;
      console.error('  FAIL - ' + name + '\n    ' + (err && err.message ? err.message : err));
    });
}

// ---------------------------------------------------------------------------
// Task 1: generateMermaidChain
// ---------------------------------------------------------------------------

// ---- Test 1: the no-routing floor, byte-frozen. ----
function test1Floor() {
  const steps = [
    { name: 'Diagnose', framework: 'diagnose', status: 'pending' },
    { name: 'Apply', framework: '', status: 'complete' },
    { name: 'File', framework: '', status: 'running' }
  ];
  const out = generateMermaidChain(steps);
  const expected = 'graph TD\n'
    + '  Diagnose["Diagnose [diagnose]"]\n'
    + '  Apply["Apply"]\n'
    + '  Diagnose --> Apply\n'
    + '  File["File"]\n'
    + '  Apply --> File\n'
    + '\n'
    + '  style Diagnose fill:' + DS_HEX.muted + ',color:' + DS_HEX.cream + ',stroke:' + DS_HEX.cream + '\n'
    + '  style Apply fill:' + DS_HEX.green + ',color:' + DS_HEX.cream + ',stroke:' + DS_HEX.cream + '\n'
    + '  style File fill:' + DS_HEX.yellow + ',color:' + DS_HEX.cream + ',stroke:' + DS_HEX.cream;
  assert.strictEqual(out, expected, 'a step array with no routing fields renders byte-identical to the pre-change output');
  ok('Test 1: no-routing floor is byte-frozen');
}

// ---- Test 2: on_pass + on_fail draw two labelled arrows. ----
function test2Conditional() {
  const steps = [
    { name: 'Gate', on_pass: 'Apply', on_fail: 'Retry' },
    { name: 'Apply' },
    { name: 'Retry' }
  ];
  const out = generateMermaidChain(steps);
  assert.match(out, /Gate -->\|pass\| Apply/, 'a labelled pass arrow leaves the declaring step');
  assert.match(out, /Gate -->\|fail\| Retry/, 'a labelled fail arrow leaves the declaring step');
  assert.doesNotMatch(out, /Gate --> Apply\n/, 'the default unlabelled arrow is suppressed once routing is declared');
  ok('Test 2: on_pass and on_fail render two labelled arrows out of the declaring node');
}

// ---- Test 3: fan_out renders a subgraph with one coordinator arrow. ----
function test3FanOut() {
  const steps = [{ name: 'Diagnose', fan_out: ['Domain A', 'Domain B'] }];
  const out = generateMermaidChain(steps);
  assert.match(out, /subgraph Diagnose_fanout \[Fan-out\]/, 'a subgraph block is opened for the fan-out');
  assert.match(out, /Domain_A\["Domain A"\]/, 'the first fan-out target is a node inside the subgraph');
  assert.match(out, /Domain_B\["Domain B"\]/, 'the second fan-out target is a node inside the subgraph');
  assert.match(out, /\n {2}end\n/, 'the subgraph block is closed');
  assert.match(out, /Diagnose --> Diagnose_fanout/, 'exactly one arrow runs from the coordinator into the subgraph');
  ok('Test 3: fan_out renders a Mermaid subgraph containing the fan-out targets');
}

// ---- Test 4: a halted trace renders a red halt node with the reason. ----
function test4Halt() {
  const steps = [
    { name: 'Diagnose' },
    { name: 'Apply', halted: true, halt_reason: 'quality_early_stop' }
  ];
  const out = generateMermaidChain(steps);
  assert.match(out, /Apply_halt\["Halted: quality_early_stop"\]/, 'the halt node carries the recorded reason');
  assert.match(out, new RegExp('style Apply_halt fill:' + DS_HEX.red.replace('#', '\\#')), 'the halt node is styled with DS_HEX.red');
  assert.match(out, /Apply --> Apply_halt/, 'the halt node is attached to the step that halted');
  ok('Test 4: a halted run renders a DS_HEX.red halt node carrying the halt reason');
}

// ---- Test 5: a reviewer renders a distinctly styled node naming its kind. ----
function test5Reviewer() {
  const steps = [{ name: 'Diagnose', reviewer: { kind: 'navigator' } }];
  const out = generateMermaidChain(steps);
  assert.match(out, /Diagnose_reviewer\["Reviewer: navigator"\]/, 'the reviewer node names the reviewer kind');
  assert.match(out, new RegExp('style Diagnose_reviewer fill:' + DS_HEX.amethyst.replace('#', '\\#')), 'the reviewer node is distinctly styled');
  assert.doesNotMatch(
    out.split('style Diagnose_reviewer')[1] || '',
    new RegExp(DS_HEX.green.replace('#', '\\#') + '|' + DS_HEX.red.replace('#', '\\#')),
    'the reviewer style is not a status color'
  );
  ok('Test 5: a reviewer renders a distinctly styled node naming navigator or subagent');
}

// ---- Test 6: the empty-array floor is unchanged. ----
function test6Empty() {
  const out = generateMermaidChain([]);
  assert.strictEqual(out, 'graph TD\n  empty[No chain data]', 'an empty step array still returns the existing empty marker');
  ok('Test 6: an empty step array renders the unchanged empty marker');
}

// ---- Test 7: no em-dash, every color a DS_HEX member. ----
function test7Palette() {
  const steps = [
    { name: 'Gate', on_pass: 'Apply', on_fail: 'Retry', fan_out: ['X'], halted: true, halt_reason: 'r', reviewer: { kind: 'subagent' } },
    { name: 'Apply' },
    { name: 'Retry' }
  ];
  const out = generateMermaidChain(steps);
  assert.strictEqual(out.indexOf('\u2014'), -1, 'no label contains an em-dash');
  const hexLiterals = out.match(/#[0-9a-fA-F]{6}/g) || [];
  const dsHexValues = new Set(Object.values(DS_HEX).filter((v) => typeof v === 'string'));
  for (const hex of hexLiterals) {
    assert.ok(dsHexValues.has(hex), 'every rendered color (' + hex + ') is a member of DS_HEX');
  }
  ok('Test 7: no em-dash anywhere, and every rendered color is a DS_HEX member');
}

test1Floor();
test2Conditional();
test3FanOut();
test4Halt();
test5Reviewer();
test6Empty();
test7Palette();

console.log('\n' + checks + ' checks passed (Task 1: generateMermaidChain)');

// ---------------------------------------------------------------------------
// Task 2: the visualize-chain router sub-case repointed at the real chain
// ---------------------------------------------------------------------------

const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const chainState = require(path.join(REPO, 'lib', 'core', 'navigation', 'chain-state.cjs'));
const { insertNode } = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
const router = require(path.join(REPO, 'lib', 'mcp', 'tool-router.cjs'));

const TOOL_ROUTER_SOURCE = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'tool-router.cjs'), 'utf8');

// A fake McpServer capturing each registered tool handler by name (mirrors
// tests/test-232.1-room-state-density.cjs's own harness pattern).
function makeFakeServer() {
  const tools = {};
  return { tools, tool(name, _desc, _schema, handler) { tools[name] = handler; } };
}

function responseText(res) {
  assert.ok(res && Array.isArray(res.content), 'response must carry a content array');
  return res.content.map((c) => (c && c.text) || '').join('\n');
}

function roomGraphHandler(roomDir) {
  const server = makeFakeServer();
  router.registerRouterTools(server, roomDir, REPO, { compact: '' });
  assert.strictEqual(typeof server.tools.room_graph, 'function', 'room_graph handler must be registered');
  return server.tools.room_graph;
}

// Seed a real, fully migrated room.db (the mutating door, setup only, same
// precedent as tests/test-232.1-room-state-density.cjs) with one chain_state
// run: `stepsSpec` is an array of { command, quality?, extraProps? }.
function seedChainRun(roomDir, runId, stepsSpec) {
  const db = roomDb.openRoomDb(roomDir);
  try {
    const subjectId = 'room:' + path.basename(roomDir);
    insertNode(db, subjectId, 'Section', JSON.stringify({}), { epistemic_type: 'observation' });
    stepsSpec.forEach((spec, idx) => {
      const write = chainState.writeChainStateRecord(db, {
        run_id: runId,
        step_index: idx,
        kind: 'notes',
        command: spec.command,
        body: null,
        quality: spec.quality || null,
        tier: null,
        produced_by: 'worker',
        subject_node_id: subjectId,
        extraProps: spec.extraProps,
      });
      assert.ok(write && write.ok === true, 'fixture write failed for step ' + idx + ': ' + JSON.stringify(write));
    });
  } finally {
    roomDb.closeRoomDb(db);
  }
}

async function runTask2() {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-347-09-'));

  // ---- Test 1: real commands render, none of the six hardcoded literals. ----
  await checkAsync('Task 2 Test 1: real recorded commands render, no hardcoded literal names', async () => {
    const roomDir = path.join(tmpBase, 'room-real-commands');
    fs.mkdirSync(roomDir, { recursive: true });
    seedChainRun(roomDir, 'run-1', [
      { command: '/mos:diagnose', quality: 'high' },
      { command: '/mos:apply', quality: 'medium' },
    ]);
    const handler = roomGraphHandler(roomDir);
    const text = responseText(await handler({ command: 'visualize-chain' }));
    assert.match(text, /mos_diagnose|mos:diagnose/, 'the real recorded command name reaches the render');
    assert.doesNotMatch(text, /Cross-ref/, 'the hardcoded Cross-ref literal is absent');
    assert.doesNotMatch(text, /Graph Update/, 'the hardcoded Graph Update literal is absent');
  });

  // ---- Test 2: a halted run renders a halt node with the recorded reason. ----
  await checkAsync('Task 2 Test 2: a halted run renders a halt node carrying the recorded reason', async () => {
    const roomDir = path.join(tmpBase, 'room-halted');
    fs.mkdirSync(roomDir, { recursive: true });
    seedChainRun(roomDir, 'run-2', [
      { command: '/mos:gate', quality: 'low', extraProps: { halted: true, halt_reason: 'quality_early_stop' } },
    ]);
    const handler = roomGraphHandler(roomDir);
    const text = responseText(await handler({ command: 'visualize-chain' }));
    assert.match(text, /Halted: quality_early_stop/, 'the halt node carries the recorded halt reason');
  });

  // ---- Test 3: declared routing renders labelled arrows and a subgraph. ----
  await checkAsync('Task 2 Test 3: declared routing renders labelled arrows and a fan-out subgraph', async () => {
    const roomDir = path.join(tmpBase, 'room-routing');
    fs.mkdirSync(roomDir, { recursive: true });
    seedChainRun(roomDir, 'run-3', [
      { command: '/mos:gate', quality: 'high', extraProps: { on_pass: 'mos_apply', fan_out: ['leg-a', 'leg-b'] } },
      { command: '/mos:apply', quality: 'high' },
    ]);
    const handler = roomGraphHandler(roomDir);
    const text = responseText(await handler({ command: 'visualize-chain' }));
    assert.match(text, /-->\|pass\|/, 'a labelled pass arrow reaches the render');
    assert.match(text, /subgraph/, 'a fan-out subgraph reaches the render');
  });

  // ---- Test 4: no recorded run, no room.db -> an honest single statement. ----
  await checkAsync('Task 2 Test 4: no recorded run and no room.db is told honestly, not fabricated', async () => {
    const roomDir = path.join(tmpBase, 'room-cold');
    fs.mkdirSync(roomDir, { recursive: true });
    const handler = roomGraphHandler(roomDir);
    const text = responseText(await handler({ command: 'visualize-chain' }));
    assert.match(text, /no chain run has been recorded/i, 'the response honestly names the empty state');
    assert.doesNotMatch(text, /graph TD/, 'no Mermaid diagram is fabricated for a room with nothing recorded');
    assert.doesNotMatch(text, /Diagnose/, 'the hardcoded Diagnose literal is absent');
    assert.doesNotMatch(text, /Cross-ref/, 'the hardcoded Cross-ref literal is absent');
  });

  // ---- Test 5: section supplied + no chain_state records -> the .reasoning scrape fallback still runs. ----
  await checkAsync('Task 2 Test 5: a supplied section with no chain_state records still runs the .reasoning scrape fallback', async () => {
    const roomDir = path.join(tmpBase, 'room-scrape-fallback');
    const sectionDir = path.join(roomDir, 'my-section');
    const reasonDir = path.join(sectionDir, '.reasoning');
    fs.mkdirSync(reasonDir, { recursive: true });
    fs.writeFileSync(
      path.join(reasonDir, '2026-01-01-run.md'),
      '## Step 1: Scraped Step\nframework: scrape-fw\nstatus: complete\n'
    );
    const handler = roomGraphHandler(roomDir);
    const text = responseText(await handler({ command: 'visualize-chain', section: 'my-section' }));
    assert.match(text, /Scraped_Step|Scraped Step/, 'the scraped step name reaches the render');
    assert.match(text, /scrape-fw/, 'the scraped framework reaches the render');
  });

  // ---- Test 6: the hardcoded six-step literal and its named entries are gone. ----
  await checkAsync('Task 2 Test 6: the hardcoded six-step literal is deleted from the source', () => {
    assert.doesNotMatch(TOOL_ROUTER_SOURCE, /Cross-ref/, 'the source no longer contains the Cross-ref literal');
    assert.doesNotMatch(TOOL_ROUTER_SOURCE, /Graph Update/, 'the source no longer contains the Graph Update literal');
    assert.match(TOOL_ROUTER_SOURCE, /readChainState/, 'the source now calls the real reader');
  });

  // ---- Test 7: safeResolveSection is still the sole path and its guard is unchanged. ----
  await checkAsync('Task 2 Test 7: safeResolveSection remains the sole path and its traversal guard is unchanged', async () => {
    const testExports = router._test;
    assert.strictEqual(typeof testExports.safeResolveSection, 'function', 'safeResolveSection stays exported for direct assertion');
    assert.throws(
      () => testExports.safeResolveSection('/tmp/some-room', '../../etc'),
      /traversal rejected/,
      'a traversal attempt is still rejected'
    );
    // Occurrence count unchanged from the pre-347-09 baseline (6: two
    // comments, the function definition, the one call site inside
    // visualize-chain, the JSDoc reference, and the module.exports._test
    // entry) -- the guard was neither removed nor duplicated.
    const occurrences = (TOOL_ROUTER_SOURCE.match(/safeResolveSection/g) || []).length;
    assert.strictEqual(occurrences, 6, 'safeResolveSection occurrence count is unchanged from the pre-edit baseline');
    // Exactly one actual CALL site (the assignment form), distinct from the
    // function definition's identical-looking parameter list.
    const callSites = TOOL_ROUTER_SOURCE.match(/= safeResolveSection\(roomDir,\s*section\)/g) || [];
    assert.strictEqual(callSites.length, 1, 'safeResolveSection is called from exactly one place: visualize-chain');
  });

  console.log('\n' + checks + ' checks passed total (Task 1 + Task 2)');
  if (failures > 0) {
    console.error(failures + ' check(s) FAILED');
    process.exitCode = 1;
  }
}

runTask2();
