'use strict';
// Offline characterization, not a regression suite: exit 0 means the probe ran.
// All inputs are synthetic. No sockets, credentials, room reads or room writes.
const path = require('node:path');
const repo = path.resolve(__dirname, '../../..');
const fromRepo = name => require(path.join(repo, name));
process.env.MINDRIAN_BRAIN_KEY = 'synthetic-phase-354-key';
process.env.MINDRIAN_BRAIN_URL = 'https://theo-mcp.onrender.com';
process.env.MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS = '10';
const originalFetch = global.fetch;
const sent = [];
global.fetch = async (_url, options) => {
  const request = JSON.parse(options.body);
  sent.push(request);
  return {
    ok: true,
    status: 200,
    text: async () => 'data: ' + JSON.stringify({
      jsonrpc: '2.0', id: request.id,
      result: { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] },
    }) + '\n',
  };
};

(async () => {
  const brain = fromRepo('lib/core/brain-client.cjs');
  const guard = fromRepo('lib/core/part8-egress-guard.cjs');
  const question = 'Use the SWOT framework on our confidential plan: cedar will acquire juniper next autumn.';
  const verdict = guard.classify({ question }, { toolName: 'brain_ask' });
  const response = await brain.ask(question);
  console.log(JSON.stringify({
    probe: 'false-safe-egress', verdict,
    capturedToolCalls: sent.filter(r => r.method === 'tools/call').map(r => r.params),
    response,
  }));

  const state = fromRepo('lib/core/state-ops.cjs');
  const originalAsk = brain.ask;
  const originalAvailable = brain.isAvailable;
  const originalState = state.getState;
  const observed = [];
  try {
    brain.isAvailable = () => true;
    // 354-09: forwards the second (opts) argument brainRoute() now passes
    // to ask(question, { problem_type }) through to _composeTheoAsk's own
    // opts.rung parameter, so this probe observes the FIX (the structurally
    // carried rung), not the pre-fix text-inference fallback a one-argument
    // stub would silently force regardless of the fix.
    brain.ask = async (text, opts) => brain._test._composeTheoAsk(
      { answer_mode: 'structured_rows', rows: [] }, text, {
        recommendChain: async rung => {
          observed.push({ question: text, rung });
          return { chain: [{ framework: 'Design Thinking', degree: 100 }] };
        },
        query: async () => ({ records: [{
          framework: 'Design Thinking', commands: ['/mos:diagnose', '/mos:build-mvp'],
        }] }),
      },
      // brainRoute() calls ask(question, { problem_type }) -- the real
      // ask() translates opts.problem_type into _composeTheoAsk's own
      // opts.rung shape (see lib/core/brain-client.cjs::ask); this stub
      // bypasses ask() entirely, so it repeats that same translation here.
      { rung: opts && opts.problem_type }
    );
    const router = fromRepo('lib/mcp/brain-router.cjs');
    const cases = [
      ['well-defined', 'simple', 'WellDefined'],
      ['undefined', 'complex', 'UnDefined'],
      ['ill-defined', 'wicked', 'Wicked'],
    ];
    for (const [index, [definition, complexity, expectedRung]] of cases.entries()) {
      state.getState = () => `definition_level: ${definition}\ncomplexity: ${complexity}`;
      const recommendation = await router.recommend('synthetic-no-room-' + index);
      console.log(JSON.stringify({
        probe: 'router-composer-contract',
        input: { definition, complexity }, expectedRung,
        observed: observed.at(-1), recommendation,
        validation: router.validateChain(null, recommendation.chain),
        fixtureHasFeedsIntoEvidence: false,
      }));
    }
  } finally {
    brain.ask = originalAsk;
    brain.isAvailable = originalAvailable;
    state.getState = originalState;
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => { global.fetch = originalFetch; });
