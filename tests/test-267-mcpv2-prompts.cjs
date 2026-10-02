#!/usr/bin/env node
'use strict';

// Phase 267 Plan 09 (MCPV2-16) -- RCA 4 wire test:
// .planning/debug/runtime-loop-prompts-bogus-args-schema.md
//
// lib/mcp/prompts.cjs registered the three runtime-loop prompts (bind-room,
// status, act) through the v1 variadic server.prompt(name, argsSchema, cb)
// overload but passed prompt METADATA ({description, arguments}) in the
// argsSchema slot. Result on every surface: prompts/list advertises no
// description and two bogus REQUIRED arguments named `description` and
// `arguments`, and prompts/get dies with -32603 keyValidator._parse is not a
// function. This test drives the real local stdio server (hermetic env) and
// pins the correct wire behavior for all nine prompts.
//
// Node built-ins + tests/helpers/mcp-wire-267.cjs only. No em-dashes. CJS only.

const { hermeticEnv, rpcOverStdio, LOCAL_SERVER } = require('./helpers/mcp-wire-267.cjs');
const { METHODOLOGY_NAMES } = require('../lib/mcp/prompts.cjs');

let passCount = 0;
let failCount = 0;

function check(cond, label, detail) {
  if (cond) {
    passCount += 1;
    console.log('PASS: ' + label);
  } else {
    failCount += 1;
    console.log('FAIL: ' + label + (detail ? ' -- ' + detail : ''));
  }
}

const EXPECTED_DESCRIPTIONS = {
  'bind-room': 'Session start: list rooms and bind this conversation to one (run before any room write).',
  status: 'One-line status: room, stage, health, and suggested next move (the statusline, in prose).',
  act: "Run Larry's best-pick methodology for the current room state (resolve, gate, then chain_run the approved sequence).",
};

const ALL_PROMPTS = [
  'file-meeting',
  'analyze-room',
  'grade-venture',
  'run-methodology',
  'suggest-next',
  'reason-section',
  'bind-room',
  'status',
  'act',
];

// Minimal valid arguments per prompt for prompts/get.
const GET_ARGS = {
  'file-meeting': { transcript: 'Synthetic fixture transcript. Alice: we should test the pricing page.' },
  'analyze-room': {},
  'grade-venture': {},
  'run-methodology': { methodology: METHODOLOGY_NAMES[0] },
  'suggest-next': {},
  'reason-section': { section: 'problem-definition' },
  'bind-room': {},
  status: {},
  act: {},
};

function firstText(resp) {
  const m = resp && resp.result && resp.result.messages && resp.result.messages[0];
  return m && m.content && typeof m.content.text === 'string' ? m.content.text : null;
}

async function main() {
  const { env, cleanup } = hermeticEnv({});
  try {
    const requests = [{ method: 'prompts/list' }];
    ALL_PROMPTS.forEach((name) => {
      requests.push({ method: 'prompts/get', params: { name, arguments: GET_ARGS[name] } });
    });
    requests.push({ method: 'prompts/get', params: { name: 'act', arguments: { goal: 'focus on pricing' } } });
    requests.push({ method: 'prompts/get', params: { name: 'act', arguments: {} } });

    const { responses } = await rpcOverStdio(LOCAL_SERVER, requests, { env, timeoutMs: 45000 });

    // ---- prompts/list ----
    const listResp = responses.get(2);
    const prompts = (listResp && listResp.result && listResp.result.prompts) || [];
    const byName = new Map(prompts.map((p) => [p.name, p]));
    check(prompts.length === 9, 'prompts/list advertises 9 prompts', 'got ' + prompts.length);

    for (const name of Object.keys(EXPECTED_DESCRIPTIONS)) {
      const p = byName.get(name);
      check(!!p, 'prompts/list includes ' + name);
      if (!p) continue;
      check(
        p.description === EXPECTED_DESCRIPTIONS[name],
        name + ' advertises its description',
        'got ' + JSON.stringify(p.description)
      );
      check(typeof p.title === 'string' && p.title.length > 0, name + ' advertises a title', 'got ' + JSON.stringify(p.title));
    }

    const bind = byName.get('bind-room');
    const status = byName.get('status');
    const act = byName.get('act');
    check(!!bind && (bind.arguments || []).length === 0, 'bind-room takes no arguments', JSON.stringify(bind && bind.arguments));
    check(!!status && (status.arguments || []).length === 0, 'status takes no arguments', JSON.stringify(status && status.arguments));
    const actArgs = (act && act.arguments) || [];
    check(
      actArgs.length === 1 && actArgs[0].name === 'goal' && !actArgs[0].required,
      'act takes exactly one optional argument goal',
      JSON.stringify(actArgs)
    );
    check(
      actArgs.length === 1 && actArgs[0].description === 'Optional goal or focus to steer the pick',
      'act goal argument carries its description',
      JSON.stringify(actArgs)
    );

    const bogus = [];
    for (const p of prompts) {
      for (const a of p.arguments || []) {
        if (a.name === 'description' || a.name === 'arguments') bogus.push(p.name + '.' + a.name);
      }
    }
    check(bogus.length === 0, 'no prompt advertises arguments named description or arguments', bogus.join(', '));

    // ---- prompts/get for all 9 ----
    ALL_PROMPTS.forEach((name, i) => {
      const resp = responses.get(3 + i);
      const text = firstText(resp);
      check(
        !!text && !(resp && resp.error),
        'prompts/get succeeds for ' + name,
        resp && resp.error ? JSON.stringify(resp.error) : 'no message text'
      );
    });

    // ---- act goal handling ----
    const withGoal = firstText(responses.get(3 + ALL_PROMPTS.length));
    check(
      typeof withGoal === 'string' && withGoal.startsWith('Goal: focus on pricing'),
      'act with a goal embeds it as the first line of its message',
      JSON.stringify(withGoal && withGoal.slice(0, 60))
    );
    const noGoal = firstText(responses.get(4 + ALL_PROMPTS.length));
    check(
      typeof noGoal === 'string' && !noGoal.includes('Goal:'),
      'act without a goal carries no Goal: line',
      JSON.stringify(noGoal && noGoal.slice(0, 60))
    );
  } finally {
    cleanup();
  }

  console.log('');
  console.log('PASS=' + passCount + ' FAIL=' + failCount);
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((e) => {
  console.log('FAIL: unexpected error ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
