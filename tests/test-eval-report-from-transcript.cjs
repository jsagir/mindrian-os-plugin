'use strict';
/*
 * Offline test for lab/eval/report-from-transcript.cjs.
 * =========================================================================
 * ZERO network by construction. The Plurai judges are retired (2026-09-29): the
 * tool never fetches, even when an apiKey and a counting fetchImpl are passed;
 * the three network judges report SKIPPED with PLURAI_RETIRED_REASON, and the
 * deterministic voice-signature leg still scores for real. Confirms: PII scrub
 * choke point, transcript parsing, the retired-judge labels, the aggregate
 * summary line, and that the module surface and source carry no network client.
 *
 * Run: node tests/test-eval-report-from-transcript.cjs
 * No em-dashes. CJS only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
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

okAsync('retired mode: apiKey + counting fetchImpl make ZERO fetch calls, three judges SKIPPED with the retirement reason', async function () {
  let fetchCalls = 0;
  const result = await mod.scoreTranscript(TRANSCRIPT, {
    apiKey: 'test-key',
    scrubRules: { replacements: [['Bob Jones', 'Person1']] },
    fetchImpl: async function () { fetchCalls += 1; return { status: 200, async json() { return {}; }, async text() { return ''; } }; },
  });
  assert.strictEqual(fetchCalls, 0, 'the retired tool must never fetch');
  assert.strictEqual(result.perTurn.length, 3);
  assert.strictEqual(result.offline, true, 'always reports offline');
  for (const t of result.perTurn) {
    for (const k of ['elevation', 'progress', 'reachgate']) {
      assert.strictEqual(t.judges[k].label, 'SKIPPED', k + ' is SKIPPED');
      assert.strictEqual(t.judges[k].reason, mod.PLURAI_RETIRED_REASON, k + ' carries the retirement reason');
    }
  }
  assert.ok(/retired/.test(mod.PLURAI_RETIRED_REASON), 'reason names the retirement');
  assert.strictEqual(result.perTurn[1].judges.voice.label, 'Missing', 'turn 2 voice is still Missing (deterministic)');
  assert.strictEqual(result.scrubStats.emails, 1, 'email scrubbed before any processing');
  // aggregate + summaryLine + formatReport render without throwing.
  assert.strictEqual(result.aggregate.progress.skipped, 3);
  assert.ok(typeof mod.summaryLine(result.aggregate) === 'string');
  const report = mod.formatReport(result);
  assert.ok(report.includes('Conversation-flow report'));
  assert.ok(report.includes('SKIPPED'));
  assert.ok(/retired/.test(report), 'report banner names the retirement');
});

ok('module surface: no network client is exported and none is left in the source', function () {
  for (const name of ['callJudge', 'endpointUrl', 'buildRequestBody', 'parseJudgeResponse', 'loadApiKey']) {
    assert.strictEqual(mod[name], undefined, name + ' must be gone');
  }
  const src = fs.readFileSync(path.join(__dirname, '..', 'lab', 'eval', 'report-from-transcript.cjs'), 'utf8');
  // Needles are assembled from parts so this test file itself never carries the literals.
  const needles = ['run.' + 'plurai.ai', 'PLURAI' + '_API_KEY', 'PLURAI' + '_RUN_BASE', 'fetch' + '('];
  const code = src.split(/\r?\n/).filter(function (l) {
    const t = l.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
  });
  for (const n of needles) {
    assert.ok(!code.some(function (l) { return l.includes(n); }), 'no non-comment line contains ' + n);
  }
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
