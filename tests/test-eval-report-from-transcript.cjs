'use strict';
/*
 * Offline test for lab/eval/report-from-transcript.cjs.
 * =========================================================================
 * Part 8: ZERO network. The four Plurai judges are stubbed via an injected
 * fetchImpl; the deterministic voice-signature leg runs for real (it is offline
 * by construction). Confirms: PII scrub choke point, transcript parsing, per-turn
 * labels from the 4 judges, and the aggregate summary line.
 *
 * Run: node tests/test-eval-report-from-transcript.cjs
 * No em-dashes. CJS only.
 */

const assert = require('node:assert');
const path = require('node:path');
const mod = require(path.join(__dirname, '..', 'lab', 'eval', 'report-from-transcript.cjs'));

let passed = 0;
function ok(name, fn) {
  try { fn(); passed += 1; process.stdout.write(`ok - ${name}\n`); }
  catch (e) { process.stdout.write(`FAIL - ${name}\n  ${e.message}\n`); process.exitCode = 1; }
}
async function okAsync(name, fn) {
  try { await fn(); passed += 1; process.stdout.write(`ok - ${name}\n`); }
  catch (e) { process.stdout.write(`FAIL - ${name}\n  ${e.message}\n`); process.exitCode = 1; }
}

// --- Fixtures -------------------------------------------------------------
// A small transcript: 3 Larry turns. Turn 1 valid blue mark, turn 2 no mark
// (Missing, deterministic), turn 3 valid black gate mark. Contains an email and
// a person name to exercise the Part 8 scrub.
const TRANSCRIPT = [
  'Navigator: I am stuck deciding whether to pursue the consulting role. Reach me at alice.smith@example.com',
  '',
  '\u{1F7E6} Very simply, you are framing this as a job choice. What if it is a bet on a network? [reach: cross_room | gate: F.1]',
  '',
  'Navigator: Bob Jones from the firm said it is mostly about the relationships.',
  '',
  'Larry: So the real question is which network compounds. Have you mapped who you would meet?',
  '',
  '\u{2B1B} That is the frame. Choose: chase the title, or chase the room you walk into.',
].join('\n');

// Deterministic stub for the four judge endpoints, keyed by slug in the URL.
function makeStubFetch(labelBySlug, calls) {
  return async function stubFetch(url, opts) {
    calls.push({ url, body: JSON.parse(opts.body) });
    const slug = Object.values(mod.JUDGES).map(function (j) { return j.slug; })
      .find(function (s) { return url.includes('/' + s + '/'); });
    const label = labelBySlug[slug] || 'Ambiguous';
    return {
      status: 200,
      async json() { return { label, reason: `stub for ${slug}` }; },
      async text() { return ''; },
    };
  };
}

// --- Tests ----------------------------------------------------------------

ok('scrubText redacts emails and applies replacement map at the choke point', function () {
  const out = mod.scrubText('ping alice.smith@example.com and Bob Jones now', {
    replacements: [['Bob Jones', 'Person1']],
  });
  assert.ok(!/example\.com/.test(out.text), 'email should be redacted');
  assert.ok(out.text.includes('[EMAIL]'), 'email placeholder present');
  assert.ok(out.text.includes('Person1'), 'name pseudonymized');
  assert.ok(!out.text.includes('Bob Jones'), 'original name gone');
  assert.strictEqual(out.stats.emails, 1);
  assert.strictEqual(out.stats.replaced, 1);
});

ok('parseTranscript splits speaker lines and heading blocks, indexes Larry turns', function () {
  const parsed = mod.parseTranscript(TRANSCRIPT);
  const larry = parsed.turns.filter(function (t) { return t.role === 'larry'; });
  assert.strictEqual(larry.length, 3, 'three material Larry turns');
  assert.strictEqual(parsed.materialCount, 3);
  assert.strictEqual(larry[0].materialIndex, 1);
  assert.strictEqual(larry[2].materialIndex, 3);
});

ok('extractTurnMeta reads reach + gate annotation', function () {
  const meta = mod.extractTurnMeta('some turn [reach: cross_room | gate: F.1]');
  assert.strictEqual(meta.reach, 'cross_room');
  assert.strictEqual(meta.gate, 'F.1');
});

ok('buildRequestBody + parseJudgeResponse round-trip the contract', function () {
  const body = JSON.parse(mod.buildRequestBody('hello'));
  assert.strictEqual(body.input, 'hello');
  assert.deepStrictEqual(mod.parseJudgeResponse({ label: 'Confident', reason: 'x' }), { label: 'Confident', reason: 'x' });
  assert.strictEqual(mod.parseJudgeResponse({ output: { label: 'Hedged' } }).label, 'Hedged');
  assert.strictEqual(mod.parseJudgeResponse({}).label, null);
});

ok('endpointUrl builds the ioa/v1 serving path', function () {
  assert.strictEqual(mod.endpointUrl('cross-topic-connection'),
    'https://run.plurai.ai/ioa/v1/cross-topic-connection/1.0.0');
});

okAsync('offline mode: voice-signature deterministic, network judges skipped, ZERO fetch', async function () {
  let fetchCalls = 0;
  const result = await mod.scoreTranscript(TRANSCRIPT, {
    offline: true,
    scrubRules: { replacements: [['Bob Jones', 'Person1']] },
    fetchImpl: async function () { fetchCalls += 1; return { status: 200, async json() { return {}; }, async text() { return ''; } }; },
  });
  assert.strictEqual(fetchCalls, 0, 'offline must make no network calls');
  assert.strictEqual(result.perTurn.length, 3);
  // Turn 1 has a valid blue mark -> Pass? deterministically resolved to a needsLlm
  // pre-verdict; offline keeps it as the hybrid pre-label. Turn 2 has no mark -> Missing.
  assert.strictEqual(result.perTurn[1].judges.voice.label, 'Missing', 'no-mark turn is Missing');
  assert.ok(result.perTurn[1].judges.voice.deterministic, 'Missing is deterministic');
  for (const t of result.perTurn) {
    assert.strictEqual(t.judges.progress.label, 'SKIPPED');
    assert.strictEqual(t.judges.elevation.label, 'SKIPPED');
    assert.strictEqual(t.judges.reachgate.label, 'SKIPPED');
  }
  assert.strictEqual(result.scrubStats.emails, 1, 'email scrubbed before any processing');
});

okAsync('online mode with stubbed judges: per-turn labels + aggregate summary line', async function () {
  const calls = [];
  const stub = makeStubFetch({
    'cross-topic-connection': 'Confident',
    'ai-turn-progress-evaluator': 'progressing',
    'reach-gate-choice-classifier': 'Correct',
    'de-stijl-mark-classifier': 'Pass',
  }, calls);

  const result = await mod.scoreTranscript(TRANSCRIPT, {
    apiKey: 'test-key',
    scrubRules: { replacements: [['Bob Jones', 'Person1']] },
    fetchImpl: stub,
  });

  assert.strictEqual(result.perTurn.length, 3);
  // Every turn should carry the stubbed labels for the three network judges.
  for (const t of result.perTurn) {
    assert.strictEqual(t.judges.progress.label, 'progressing');
    assert.strictEqual(t.judges.elevation.label, 'Confident');
    assert.strictEqual(t.judges.reachgate.label, 'Correct');
  }
  // Voice: turns 1 and 3 have valid single marks -> hybrid asks the LLM leg (stub
  // returns Pass); turn 2 is Missing deterministically (no LLM leg).
  assert.strictEqual(result.perTurn[0].judges.voice.label, 'Pass');
  assert.strictEqual(result.perTurn[1].judges.voice.label, 'Missing');
  assert.strictEqual(result.perTurn[2].judges.voice.label, 'Pass');

  // Aggregate + summary line.
  assert.strictEqual(result.aggregate.progress.progressing, 3);
  assert.strictEqual(result.aggregate.elevation.Confident, 3);
  const summary = mod.summaryLine(result.aggregate);
  assert.ok(/3\/3 progressing/.test(summary), `summary has progressing ratio: ${summary}`);
  assert.ok(/1 voice violation\b/.test(summary), `summary counts the 1 Missing as a voice violation: ${summary}`);
  assert.ok(/0 missed cross-frame/.test(summary), `summary: ${summary}`);

  // Part 8: NO unscrubbed PII reached any stubbed endpoint.
  const allBodies = JSON.stringify(calls.map(function (c) { return c.body; }));
  assert.ok(!/example\.com/.test(allBodies), 'no email egressed to judges');
  assert.ok(!/Bob Jones/.test(allBodies), 'no real name egressed to judges');
  assert.ok(allBodies.includes('Person1') || calls.length > 0, 'pseudonym used');

  // The report renders without throwing and contains the summary.
  const report = mod.formatReport(result);
  assert.ok(report.includes('Conversation-flow report'));
  assert.ok(report.includes('3/3 progressing'));
});

okAsync('endpoint error is surfaced per-turn, never crashes', async function () {
  const errStub = async function () { return { status: 404, async json() { return {}; }, async text() { return 'not found'; } }; };
  const result = await mod.scoreTranscript(TRANSCRIPT, {
    apiKey: 'test-key',
    scrubRules: { replacements: [['Bob Jones', 'Person1']] },
    fetchImpl: errStub,
  });
  for (const t of result.perTurn) {
    assert.ok(t.judges.progress.error, 'progress judge marked error on 404');
    assert.strictEqual(t.judges.progress.label, 'ERROR');
  }
  // Voice hybrid: on a network gap the LLM leg keeps the deterministic pre-verdict
  // (Pass), never inventing Wrong-Color.
  assert.strictEqual(result.perTurn[0].judges.voice.label, 'Pass');
  assert.strictEqual(result.aggregate.progress.error, 3);
  // formatReport still renders.
  assert.ok(mod.formatReport(result).includes('ERROR'));
});

okAsync('Part 8 advisory fires when names present and no scrub map supplied', async function () {
  const result = await mod.scoreTranscript('Larry: \u{1F7E6} talking to Carol White today.', {
    offline: true,
  });
  assert.ok(result.warnings.some(function (w) { return /advisory/.test(w); }), 'advisory warning present');
});

process.on('exit', function () {
  process.stdout.write(`\n${passed} assertions passed\n`);
});
