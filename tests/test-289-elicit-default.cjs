#!/usr/bin/env node
'use strict';

/**
 * Phase 289 plan 03 (ELICIT289-01, ELICIT289-02, D-02) -- the elicitation
 * dialog opens on the recommended option, with an instruction title, and it
 * still fires where it must (a recognized non-Claude host).
 * ==========================================================================
 * Why: SEED-104 measured an elicitation dialog that opened on "not set" with a
 * dead Accept button. The navigator kept elicitation for non-Claude hosts
 * (D-02), so its default must be right and tested where it actually fires.
 *
 * Arm `unit` (pure, no process): the requestedSchema contract from
 * lib/mcp/gate-render.cjs _internal.buildElicitRequestedSchema.
 *   - single-select: `default` is the recommended option id (the lowest finite
 *     rank, an explicit flag wins), absent when there is no recommendation;
 *   - multi-select: `default` is the explicitly flagged ids in option order,
 *     absent when no option is flagged (ranks alone never preselect a basket);
 *   - the field title is an instruction: `Choose: A / B` or
 *     `Choose one or more: A / B`, capped at 120 characters (one line in the
 *     host dialog; four labels at the 80-character label cap would pass 300);
 *   - no field `description` (tests/test-198-gate-renderers.test.cjs pins it);
 *   - both shapes pass SDK 2.1.0 safeParse and keep their `default`;
 *   - the elicitation message still begins with the card header.
 *
 * Arm `live` (stdio, era 2025, default hermetic env = Claude desktop surface):
 *   (a) a Client named `Visual Studio Code` that declares elicitation gets
 *       exactly ONE dialog whose default is the recommended id;
 *   (b) a Client named `some-new-client` that declares elicitation gets the
 *       card and no dialog (the unknown client is treated as a Claude host).
 *
 * `--arm <id>` is repeatable; no flag runs both. Exit 1 on any FAIL; exit 77
 * (ENV GAP) only when the client SDK cannot be required or the server cannot
 * be spawned. Hermetic: temp HOME and MINDRIAN_ROOMS_HOME, MINDRIAN_BRAIN_URL
 * on an unreachable loopback port. Every spawned PID is killed in finally.
 *
 * No em-dashes (hyphens only). CJS.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

// Hermetic before the first lib require.
const HERMETIC_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 't289-elicit-'));
const HERMETIC_ROOMS = fs.mkdtempSync(path.join(os.tmpdir(), 't289-elicit-rooms-'));
process.env.HOME = HERMETIC_HOME;
process.env.MINDRIAN_ROOMS_HOME = HERMETIC_ROOMS;
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
delete process.env.MINDRIAN_BRAIN_KEY;
delete process.env.CLAUDE_CODE_SESSION_ID;
process.on('exit', () => {
  for (const d of [HERMETIC_HOME, HERMETIC_ROOMS]) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch (_e) {
      /* best effort */
    }
  }
});

const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const arms = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--arm' && i + 1 < args.length) {
    arms.push(args[i + 1]);
    i += 1;
  }
}
const wanted = (id) => arms.length === 0 || arms.includes(id);

let passed = 0;
let failed = 0;
function record(arm, name, err) {
  if (!err) {
    passed += 1;
    console.log('PASS: ' + arm + ' ' + name);
  } else {
    failed += 1;
    console.log('FAIL: ' + arm + ' ' + name);
    console.log('  ' + (err && err.message ? err.message : String(err)).split('\n').join('\n  '));
  }
}
async function check(arm, name, fn) {
  try {
    await fn();
    record(arm, name, null);
  } catch (err) {
    record(arm, name, err || new Error('failed'));
  }
}

// ---------------------------------------------------------------------------
// unit arm
// ---------------------------------------------------------------------------
async function runUnit() {
  const gateRender = require('../lib/mcp/gate-render.cjs');
  const { buildElicitRequestedSchema } = gateRender._internal;
  const build = (card) => buildElicitRequestedSchema(gateRender.normalizeCard(card));
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  const RANKED = {
    gate_id: 'gate-289-03-unit',
    header: 'Pick one',
    options: [
      { id: 'opt-top', label: 'Top choice', rank: 1 },
      { id: 'opt-second', label: 'Second choice', rank: 2 },
    ],
  };

  await check('unit', 'single-select default is the recommended id (lowest rank), one of its own oneOf consts', () => {
    const choice = build(RANKED).properties.choice;
    assert.ok(has(choice, 'default'), 'properties.choice has no `default` key (the dialog opens on "not set" with a dead Accept)');
    assert.equal(choice.default, 'opt-top', 'default must be the rank-1 option id');
    assert.ok(choice.oneOf.some((o) => o.const === choice.default), 'default must be one of the oneOf consts');
  });

  await check('unit', 'single-select default follows rank, not option order', () => {
    const choice = build({
      gate_id: 'gate-289-03-order',
      header: 'Pick one',
      options: [
        { id: 'opt-second', label: 'Second choice', rank: 2 },
        { id: 'opt-top', label: 'Top choice', rank: 1 },
      ],
    }).properties.choice;
    assert.equal(choice.default, 'opt-top', 'default must be the lowest rank even when listed second');
  });

  await check('unit', 'single-select title is an instruction: "Choose: Top choice / Second choice"', () => {
    const choice = build(RANKED).properties.choice;
    assert.equal(choice.title, 'Choose: Top choice / Second choice', 'title must be an instruction built from the labels, not the card header');
  });

  await check('unit', 'single-select field has no own description key', () => {
    const choice = build(RANKED).properties.choice;
    assert.equal(has(choice, 'description'), false, 'the field must carry no description (test-198 pins it undefined)');
  });

  await check('unit', 'single-select with no rank and no flag has no default key and still starts "Choose: "', () => {
    const choice = build({
      gate_id: 'gate-289-03-norank',
      header: 'Pick one',
      options: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
    }).properties.choice;
    assert.equal(has(choice, 'default'), false, 'no recommendation means no default key');
    assert.ok(typeof choice.title === 'string' && choice.title.startsWith('Choose: '), 'title must start "Choose: ", got ' + JSON.stringify(choice.title));
  });

  const MULTI_FLAGGED = {
    gate_id: 'gate-289-03-multi',
    header: 'Pick several',
    selectMode: 'multi',
    options: [
      { id: 'm-a', label: 'Alpha', recommended: true },
      { id: 'm-b', label: 'Beta' },
      { id: 'm-c', label: 'Gamma', recommended: true },
    ],
  };

  await check('unit', 'multi-select default is the explicitly flagged ids in option order', () => {
    const choices = build(MULTI_FLAGGED).properties.choices;
    assert.ok(has(choices, 'default'), 'properties.choices has no `default` key');
    assert.deepStrictEqual(choices.default, ['m-a', 'm-c'], 'default must be the two flagged ids in option order');
  });

  await check('unit', 'multi-select title starts "Choose one or more: "', () => {
    const choices = build(MULTI_FLAGGED).properties.choices;
    assert.ok(typeof choices.title === 'string' && choices.title.startsWith('Choose one or more: '), 'title must start "Choose one or more: ", got ' + JSON.stringify(choices.title));
    assert.equal(has(choices, 'description'), false, 'the field must carry no description');
  });

  await check('unit', 'multi-select with ranks but no flags has no default (a basket is never preselected by rank)', () => {
    const choices = build({
      gate_id: 'gate-289-03-multi-rank',
      header: 'Pick several',
      selectMode: 'multi',
      options: [
        { id: 'm-a', label: 'Alpha', rank: 1 },
        { id: 'm-b', label: 'Beta', rank: 2 },
      ],
    }).properties.choices;
    assert.equal(has(choices, 'default'), false, 'ranks alone must not produce a multi-select default');
  });

  await check('unit', 'title is capped at 120 characters and ends "..." with four 80-character labels', () => {
    const long = (c) => c.repeat(80);
    const choice = build({
      gate_id: 'gate-289-03-long',
      header: 'Pick one',
      options: [
        { id: 'l-a', label: long('a'), rank: 1 },
        { id: 'l-b', label: long('b'), rank: 2 },
        { id: 'l-c', label: long('c'), rank: 3 },
        { id: 'l-d', label: long('d'), rank: 4 },
      ],
    }).properties.choice;
    assert.ok(choice.title.length <= 120, 'title is ' + choice.title.length + ' characters, the cap is 120');
    assert.ok(choice.title.endsWith('...'), 'a capped title must end with "..."');
    assert.ok(choice.title.startsWith('Choose: '), 'a capped title must still start "Choose: "');
  });

  await check('unit', 'SDK 2.1.0 safeParse accepts both shapes with the default present and keeps it', () => {
    const core = require('@modelcontextprotocol/core');
    const single = core.TitledSingleSelectEnumSchemaSchema;
    const multi = core.TitledMultiSelectEnumSchemaSchema;
    assert.ok(single && typeof single.safeParse === 'function', 'TitledSingleSelectEnumSchemaSchema not reachable from @modelcontextprotocol/core');
    assert.ok(multi && typeof multi.safeParse === 'function', 'TitledMultiSelectEnumSchemaSchema not reachable from @modelcontextprotocol/core');

    const choice = build(RANKED).properties.choice;
    assert.ok(has(choice, 'default'), 'single-select has no default to validate');
    const sr = single.safeParse(choice);
    assert.ok(sr.success, 'single-select failed TitledSingleSelectEnumSchemaSchema: ' + (sr.error && sr.error.message));
    assert.equal(sr.data.default, 'opt-top', 'the parsed single-select data must keep default');

    const choices = build(MULTI_FLAGGED).properties.choices;
    assert.ok(has(choices, 'default'), 'multi-select has no default to validate');
    const mr = multi.safeParse(choices);
    assert.ok(mr.success, 'multi-select failed TitledMultiSelectEnumSchemaSchema: ' + (mr.error && mr.error.message));
    assert.deepStrictEqual(mr.data.default, ['m-a', 'm-c'], 'the parsed multi-select data must keep default');
  });

  await check('unit', 'renderGate over elicitation sends a message that still begins with the card header', async () => {
    let sent = null;
    const result = await gateRender.renderGate(RANKED, {
      capabilities: { elicitation: true },
      elicitInput: async (params) => {
        sent = params;
        return { action: 'accept', content: { choice: 'opt-top' } };
      },
    });
    assert.equal(result.renderer, 'elicitation', 'renderer must be rung (a) when the context declares elicitation');
    assert.ok(sent && typeof sent.message === 'string', 'elicitInput must receive a message');
    assert.ok(sent.message.startsWith('Pick one'), 'message must begin with the card header, got ' + JSON.stringify(sent.message));
  });
}

// ---------------------------------------------------------------------------
// live arm
// ---------------------------------------------------------------------------
const LIVE_CARD = {
  gate_id: 'gate-289-03-elicit-live',
  header: 'Pick one',
  options: [
    { id: 'opt-top', label: 'Top choice', rank: 1 },
    { id: 'opt-second', label: 'Second choice', rank: 2 },
  ],
};

async function runLive() {
  const cp = require('node:child_process');
  let sdk = null;
  let sdkStdio = null;
  let helper = null;
  try {
    sdk = require('@modelcontextprotocol/client');
    sdkStdio = require('@modelcontextprotocol/client/stdio');
    helper = require('./helpers/mcp-wire-267.cjs');
  } catch (e) {
    console.log('ENV GAP: the MCP client SDK or the wire helper cannot be required (' + (e && e.message ? e.message : e) + ')');
    return 77;
  }
  const { Client } = sdk;
  const { StdioClientTransport } = sdkStdio;
  const { hermeticEnv, LOCAL_SERVER } = helper;

  const spawnedPids = [];
  const cleanups = [];
  const killPid = (pid) => {
    if (typeof pid !== 'number') return;
    try {
      process.kill(pid, 'SIGKILL');
    } catch (_e) {
      /* already gone */
    }
  };
  const serverPids = () => {
    const escaped = LOCAL_SERVER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const out = cp.execSync('pgrep -f "node .*' + escaped + '" || true').toString().trim();
      return out ? out.split('\n').map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n)) : [];
    } catch (_e) {
      return [];
    }
  };
  const pidsBefore = new Set(serverPids());

  let envGap = null;
  async function connect(clientName) {
    const hermetic = hermeticEnv({});
    cleanups.push(hermetic.cleanup);
    const seen = [];
    const client = new Client({ name: clientName, version: '1' }, { capabilities: { elicitation: {} } });
    client.setRequestHandler('elicitation/create', async (request) => {
      seen.push(request);
      return { action: 'accept', content: { choice: 'opt-top' } };
    });
    const transport = new StdioClientTransport({ command: 'node', args: [LOCAL_SERVER], env: hermetic.env, cwd: REPO_ROOT });
    const origStart = transport.start.bind(transport);
    transport.start = async function () {
      const r = await origStart();
      if (typeof transport.pid === 'number') spawnedPids.push(transport.pid);
      return r;
    };
    try {
      await client.connect(transport);
    } catch (e) {
      envGap = 'the local server could not be spawned or initialized (' + (e && e.message ? e.message : e) + ')';
      killPid(transport.pid);
      throw new Error('ENV GAP: ' + envGap);
    }
    if (typeof transport.pid === 'number' && !spawnedPids.includes(transport.pid)) spawnedPids.push(transport.pid);
    return { client, transport, seen };
  }
  async function close(conn) {
    try {
      await conn.client.close();
    } catch (_e) {
      /* best effort */
    }
    killPid(conn.transport.pid);
  }
  function parseToolText(result) {
    const text = result && result.content && result.content[0] && result.content[0].text;
    assert.ok(typeof text === 'string' && text.length > 0, 'gate_render must return text content');
    return JSON.parse(text);
  }

  try {
    await check('live', 'client "Visual Studio Code" declaring elicitation gets ONE dialog opening on the recommended id', async () => {
      const conn = await connect('Visual Studio Code');
      try {
        const body = parseToolText(await conn.client.callTool({ name: 'gate_render', arguments: LIVE_CARD }));
        console.log('    client Visual Studio Code; elicitation requests seen: ' + conn.seen.length + '; renderer ' + body.renderer);
        assert.equal(conn.seen.length, 1, 'exactly one elicitation request must reach a recognized non-Claude host, saw ' + conn.seen.length);
        const req = conn.seen[0];
        const params = (req && req.params) || req;
        const choice = params && params.requestedSchema && params.requestedSchema.properties && params.requestedSchema.properties.choice;
        assert.ok(choice, 'the elicitation request carried no requestedSchema.properties.choice');
        assert.equal(choice.default, 'opt-top', 'the dialog must open on the recommended id, default was ' + JSON.stringify(choice.default));
        assert.ok(typeof choice.title === 'string' && choice.title.startsWith('Choose: '), 'the field title must be an instruction starting "Choose: ", got ' + JSON.stringify(choice.title));
        assert.equal(body.ok, true, 'gate_render must succeed');
        assert.equal(body.renderer, 'elicitation', 'renderer must be rung (a) for a recognized non-Claude host');
        assert.deepStrictEqual(body.answer && body.answer.chosen, ['opt-top'], 'the inline answer must come from the client accept');
      } finally {
        await close(conn);
      }
    });

    await check('live', 'unknown client "some-new-client" declaring elicitation gets the card and no dialog', async () => {
      const conn = await connect('some-new-client');
      try {
        const body = parseToolText(await conn.client.callTool({ name: 'gate_render', arguments: LIVE_CARD }));
        console.log('    client some-new-client; elicitation requests seen: ' + conn.seen.length + '; renderer ' + body.renderer);
        assert.equal(conn.seen.length, 0, 'no elicitation request may reach an unknown client on a Claude surface, saw ' + conn.seen.length);
        assert.equal(body.ok, true, 'gate_render must succeed');
        assert.equal(body.renderer, 'askuserquestion', 'renderer must be rung (b), the AskUserQuestion card');
      } finally {
        await close(conn);
      }
    });
  } finally {
    for (const pid of spawnedPids) killPid(pid);
    await new Promise((r) => setTimeout(r, 300));
    for (const p of serverPids().filter((x) => !pidsBefore.has(x))) killPid(p);
    for (const c of cleanups) {
      try {
        c();
      } catch (_e) {
        /* best effort */
      }
    }
  }

  if (envGap) {
    console.log('ENV GAP: ' + envGap);
    return 77;
  }
  return 0;
}

async function main() {
  if (wanted('unit')) {
    try {
      await runUnit();
    } catch (e) {
      record('unit', 'arm setup', e);
    }
  }
  let live = 0;
  if (wanted('live')) {
    try {
      live = await runLive();
    } catch (e) {
      record('live', 'arm setup', e);
    }
  }
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  if (failed > 0) process.exit(1);
  process.exit(live === 77 ? 77 : 0);
}

main().catch((e) => {
  console.log('FAIL: harness ' + (e && e.stack ? e.stack : e));
  console.log('RESULT: PASS=' + passed + ' FAIL=' + (failed + 1));
  process.exit(1);
});
