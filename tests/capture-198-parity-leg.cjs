#!/usr/bin/env node
'use strict';
/*
 * Phase 198-10 Task 2 -- SPEC-6 two-host parity, the leg-capture harness.
 * ============================================================================
 * Runs the full governed transcript IN PROCESS against the real shipped MCP
 * tool spine (the same functions the daemon calls), then emits a NORMALIZED,
 * host-invariant artifact: the typed graph writes (node label-set + edge
 * source/target/type set) and the logical gate sequence. Two hosts running the
 * identical transcript must emit byte-identical normalized artifacts -- an
 * EMPTY node/edge diff and an identical gate sequence (SPEC-6).
 *
 * The six governed steps (run in order, flag ON):
 *   1. room_bind            -- a memory_event marks the bound room
 *   2. reach card           -- gate-render normalizes the superset card (a gate)
 *   3. chain_run with halt  -- 2 autonomous_safe steps + 1 material step; halts
 *                              at the material step and mints a gate
 *   4. gate_answer approve  -- resumes and executes the material step
 *   5. gated write          -- an INFORMS edge lands through navigation.cjs
 *   6. artifact_file        -- files the artifact + logs a memory_event
 *
 * NORMALIZATION (why the two hosts match despite different renderers): the
 * captured artifact deliberately drops host-specific and time-specific noise --
 * volatile node ids, timestamps, and the RENDERER used (elicitation on VS Code
 * vs the text ladder on CLI is a host affordance, NOT a governed-sequence
 * difference). What remains is the governed shape both hosts MUST reproduce:
 * which typed nodes/edges landed and which gates fired in what order with what
 * verdict.
 *
 * CLI:  node tests/capture-198-parity-leg.cjs --host cli [--out <path>]
 * API:  const { captureLeg } = require('./capture-198-parity-leg.cjs')
 *
 * House rule: CJS only, hyphens only (no em-dashes). No emoji. Hermetic (temp
 * room.db under os.tmpdir()).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const graphTool = require(path.join(REPO, 'lib', 'mcp', 'tools', 'graph.cjs'));
const chainTool = require(path.join(REPO, 'lib', 'mcp', 'tools', 'chain.cjs'));
const gateRender = require(path.join(REPO, 'lib', 'mcp', 'gate-render.cjs'));

const ARTIFACT_DIR = path.join(REPO, 'tests', 'artifacts');

function readRegistryFixture() {
  const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'connector-registry.json'), 'utf8'));
  const cmds = registry.connectors.filter((c) => c && c.source === 'command' && typeof c.surface === 'string');
  const push = cmds.filter((c) => c.posture === 'push_forward').slice(0, 2).map((c) => c.surface);
  const hold = cmds.filter((c) => c.posture === 'hold').slice(0, 1).map((c) => c.surface);
  if (push.length !== 2 || hold.length !== 1) {
    throw new Error('connector-registry.json must expose >=2 push_forward + >=1 hold command for the transcript');
  }
  return { push, hold };
}

function nodeLabel(propsJson) {
  try {
    const p = JSON.parse(propsJson || '{}');
    return typeof p.label === 'string' ? p.label : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Run the six-step governed transcript and return the normalized artifact.
 * @param {string} host  logical host label (cli | vscode)
 * @returns {Promise<object>}
 */
async function captureLeg(host) {
  const surface = 'cli'; // the governed surface exercised in process
  const previousFlag = process.env.MINDRIAN_MCP_FIRST;
  const gateSequence = [];
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-198-' + (host || 'host') + '-'));
  const roomDir = path.join(tmpHome, 'room-parity');
  fs.mkdirSync(roomDir, { recursive: true });

  const boot = roomDb.openRoomDb(roomDir); // creates .mindrian/room.db + schema
  roomDb.closeRoomDb(boot);
  const db = navigation.openRoomDbForCaller(roomDir);

  try {
    // Flag ON for the governed surface (SPEC-6 runs the transcript flag-ON).
    process.env.MINDRIAN_MCP_FIRST = surface;
    const { push, hold } = readRegistryFixture();

    // STEP 1 -- room_bind (a memory_event marks the bound room).
    await graphTool.memoryEvent(db, { label: 'room_bind', payload: { step: 'room_bind' } });

    // STEP 2 -- reach a card (the superset schema; a gate is presented).
    const card = gateRender.normalizeCard({
      gate_id: 'parity-reach',
      header: 'Reach a card',
      kind: 'binding',
      options: [{ id: 'opt-a', label: 'Option A' }, { id: 'opt-b', label: 'Option B' }],
    });
    gateSequence.push('reach_card:' + card.kind);

    // STEP 3 -- chain_run with a material halt.
    const steps = [
      { step: 1, framework: 'parity-safe-1', command: push[0], optional: false },
      { step: 2, framework: 'parity-safe-2', command: push[1], optional: false },
      { step: 3, framework: 'parity-material', command: hold[0], optional: false },
    ];
    const executed = [];
    const run = await chainTool.chainRun(steps, {
      roomDir,
      onStep: async (s) => { executed.push(s.command); return { chain_output: { ran: s.command }, quality: 'high' }; },
    });
    if (!(run && run.halted === true && run.gate && run.gate.gate_id)) {
      throw new Error('chain_run did not halt at the material step as expected');
    }
    gateSequence.push('chain_halt:' + run.halted_at.step.command);
    const gateId = run.gate.gate_id;

    // STEP 4 -- gate_answer approve (resumes + executes the material step).
    const answer = await chainTool.chainRun(null, {
      gateAnswer: { gate_id: gateId, chosen: ['approve'], verdict: 'approve' },
    });
    if (!(answer && answer.executed === true)) {
      throw new Error('approve verdict did not execute the material step');
    }
    gateSequence.push('gate_answer:approve');

    // STEP 5 -- gated write (an INFORMS edge lands through navigation.cjs).
    const wrote = await graphTool.graphWrite(db, {
      sourceId: 'node:parity-a',
      targetId: 'node:parity-b',
      edgeType: 'INFORMS',
      properties: { note: 'parity governed write' },
    });
    if (!(wrote && wrote.ok === true)) {
      throw new Error('gated write through navigation.cjs failed');
    }
    await graphTool.memoryEvent(db, { label: 'gated_write', payload: { step: 'gated_write' } });

    // STEP 6 -- artifact_file (file the artifact + log a memory_event).
    const artSection = 'parity';
    const artDir = path.join(roomDir, artSection);
    fs.mkdirSync(artDir, { recursive: true });
    fs.writeFileSync(path.join(artDir, 'parity-artifact.md'), '# Parity artifact\n', 'utf8');
    await graphTool.memoryEvent(db, { label: 'artifact_file', payload: { step: 'artifact_file', section: artSection } });

    // --- Normalize the graph writes (host-invariant projection). ---
    const edgeRows = db.prepare('SELECT source, target, type FROM edges ORDER BY source, target, type').all();
    const edges = edgeRows.map((r) => ({ source: r.source, target: r.target, type: r.type }));

    const nodeRows = db.prepare("SELECT type, properties FROM nodes").all();
    const nodes = nodeRows
      .map((r) => ({ type: r.type, label: nodeLabel(r.properties) }))
      .sort((a, b) => (a.type + '|' + a.label).localeCompare(b.type + '|' + b.label));

    return {
      host: host || 'host',
      flag: surface,
      transcript: ['room_bind', 'reach_card', 'chain_run_halt', 'gate_answer_approve', 'gated_write', 'artifact_file'],
      gate_sequence: gateSequence,
      nodes,
      edges,
    };
  } finally {
    try { navigation.closeRoomDbForCaller(db); } catch (_e) { /* best-effort */ }
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    if (previousFlag === undefined) delete process.env.MINDRIAN_MCP_FIRST;
    else process.env.MINDRIAN_MCP_FIRST = previousFlag;
  }
}

function parseArgs(argv) {
  const args = { host: 'cli', out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--host') { args.host = argv[++i]; }
    else if (argv[i] === '--out') { args.out = argv[++i]; }
  }
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  captureLeg(args.host).then((artifact) => {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    const outPath = args.out || path.join(ARTIFACT_DIR, '198-parity-' + args.host + '.json');
    fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
    process.stdout.write('PARITY_LEG_CAPTURED host=' + args.host + ' nodes=' + artifact.nodes.length
      + ' edges=' + artifact.edges.length + ' gates=' + artifact.gate_sequence.length + ' -> ' + path.relative(REPO, outPath) + '\n');
    process.exit(0);
  }).catch((e) => {
    process.stderr.write('PARITY_LEG_FAIL ' + (e && e.stack ? e.stack : String(e)) + '\n');
    process.exit(1);
  });
}

module.exports = { captureLeg };
