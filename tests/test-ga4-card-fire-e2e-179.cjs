'use strict';
/*
 * Phase 179-08 GAP-CLOSURE -- the LOAD-BEARING end-to-end test for the GA-4 card-fire
 * interceptor (the R-1 cure). This is the test the original 22-assertion suite was
 * MISSING (WR-03 / BL-01): it pipes a REALISTIC Stop stdin through the ACTUAL script
 * entry point (spawnSync 'node scripts/check-card-fire.cjs') against a fixture
 * transcript_path -- the production input shape -- and asserts the block envelope is
 * emitted. The original suite only ever fed synthetic `turn` objects straight into the
 * pure predicate classifyCardFire(); it never crossed deriveTurnSignals/main against a
 * real Stop envelope, which is exactly why a fully-green suite coexisted with a runtime
 * no-op.
 *
 * This suite FAILS against the pre-fix code (deriveTurnSignals never read transcript_path,
 * so a realistic Stop stdin always no-opped) and PASSES after the BL-01 fix.
 *
 * Coverage:
 *   (E2E-1) realistic Stop stdin + ascii-box transcript (no AskUserQuestion) -> decision:block
 *   (E2E-2) realistic Stop stdin + transcript WITH an AskUserQuestion tool_use -> no-op (continue:true)
 *   (E2E-3) unreadable / missing transcript_path -> safe no-op (never throws, never blocks)
 *   (WR-01) the retry counter converges: re-WORDED re-prompts on the same session+gate
 *           increment the SAME counter (the volatile-output-text-hash bug is fixed)
 *   (WR-02) the retry store is pruned on write: a stale entry (older than RETRY_TTL_MS) is
 *           evicted; the store cannot grow without bound
 *
 * Canon Part 8: LOCAL-only. The fixtures are local .jsonl files; the script reads them,
 * scans for glyphs/tool-use, and egresses nothing. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const INTERCEPTOR_PATH = path.join(REPO_ROOT, 'scripts', 'check-card-fire.cjs');
const m = require(INTERCEPTOR_PATH);

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// A unique temp dir for this run's fixtures + an isolated retry side-file. We point
// MINDRIAN_HOME at it so the e2e runs never touch the real ~/.mindrian store.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ga4-e2e-'));
const FIX_DIR = path.join(TMP, 'fixtures');
const HOME_DIR = path.join(TMP, 'mindrian-home');
fs.mkdirSync(FIX_DIR, { recursive: true });
fs.mkdirSync(HOME_DIR, { recursive: true });

function writeTranscript(name, lines) {
  const fp = path.join(FIX_DIR, name);
  fs.writeFileSync(fp, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
  return fp;
}

// A realistic assistant turn that renders the flat ASCII-box gate (the R-1 anti-pattern):
// the box glyphs + the "type 1, 2, or 3" literal, with NO AskUserQuestion tool call.
const ASCII_BOX_TRANSCRIPT = writeTranscript('ascii-box.jsonl', [
  { type: 'user', message: { role: 'user', content: 'I want to start a venture' } },
  {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: [
            'Choose your starting point:',
            '  [1] Solution-first',
            '  [2] Domain-first',
            '  [3] Venture-first',
            'type 1, 2, or 3',
          ].join('\n'),
        },
      ],
    },
  },
]);

// A realistic assistant turn that FIRED the AskUserQuestion card (the correct behavior).
const CARD_FIRED_TRANSCRIPT = writeTranscript('card-fired.jsonl', [
  { type: 'user', message: { role: 'user', content: 'I want to start a venture' } },
  {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me ask you which starting point fits.' },
        { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [] } },
      ],
    },
  },
]);

// runInterceptor(envObj) -- spawn the ACTUAL script with a realistic Stop stdin and parse
// the emitted envelope. Isolated MINDRIAN_HOME so retry writes never touch the real store.
function runInterceptor(envObj, extraEnv) {
  const res = spawnSync('node', [INTERCEPTOR_PATH], {
    input: JSON.stringify(envObj),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_HOME: HOME_DIR }, extraEnv || {}),
  });
  let parsed = null;
  try { parsed = JSON.parse((res.stdout || '').trim()); } catch (_e) { parsed = null; }
  return { res, env: parsed };
}

// ---------------------------------------------------------------------------
// (E2E-1) realistic Stop stdin + ascii-box transcript -> decision:block.
// THIS is the assertion that fails pre-fix (the no-op) and passes post-fix.
// ---------------------------------------------------------------------------
const r1 = runInterceptor({
  hook_event_name: 'Stop',
  transcript_path: ASCII_BOX_TRANSCRIPT,
  session_id: 'e2e-sess-block',
});
ok('(E2E-1) the script exits 0 (never crashes the hook chain)', r1.res.status === 0);
ok('(E2E-1) a realistic Stop stdin + ascii-box transcript emits a parseable envelope',
  r1.env && typeof r1.env === 'object');
ok('(E2E-1) the envelope BLOCKS (decision:block) -- the LIVE cure, no longer a no-op',
  r1.env.decision === 'block' && r1.env.continue === false);
ok('(E2E-1) the block carries the card-fire re-prompt in hookSpecificOutput.additionalContext',
  r1.env.hookSpecificOutput &&
  /AskUserQuestion/.test(r1.env.hookSpecificOutput.additionalContext || ''));

// ---------------------------------------------------------------------------
// (E2E-2) realistic Stop stdin + a transcript WITH an AskUserQuestion tool_use -> no-op.
// ---------------------------------------------------------------------------
const r2 = runInterceptor({
  hook_event_name: 'Stop',
  transcript_path: CARD_FIRED_TRANSCRIPT,
  session_id: 'e2e-sess-fired',
});
ok('(E2E-2) the script exits 0', r2.res.status === 0);
ok('(E2E-2) a fired AskUserQuestion card yields a no-op (continue:true, NOT a block)',
  r2.env && r2.env.continue === true && r2.env.decision === undefined);

// ---------------------------------------------------------------------------
// (E2E-3) an unreadable / missing transcript_path -> safe no-op (fail-safe).
// ---------------------------------------------------------------------------
const r3 = runInterceptor({
  hook_event_name: 'Stop',
  transcript_path: path.join(FIX_DIR, 'does-not-exist.jsonl'),
  session_id: 'e2e-sess-missing',
});
ok('(E2E-3) a missing transcript never throws -- the script exits 0', r3.res.status === 0);
ok('(E2E-3) a missing transcript degrades to a safe no-op (never blocks spuriously)',
  r3.env && r3.env.continue === true && r3.env.decision === undefined);

// ---------------------------------------------------------------------------
// (WR-01) the retry counter converges across RE-WORDED retries on the SAME session+gate.
// The bug: keying the counter on the output_text hash mints a fresh key every re-word, so
// MAX_FORCE_RETRIES is never reachable. The fix: key on session_id + stable gate identity,
// so re-worded prose increments the SAME counter. We assert the KEY is identical across two
// turns with the SAME session + gate identity but DIFFERENT output text.
// ---------------------------------------------------------------------------
const turnA = m.deriveTurnSignals({
  hook_event_name: 'Stop',
  session_id: 'wr01-sess',
  ran_entries: ['lib/core/navigation-engine-offer.cjs'],
  output_text: 'Choose your starting point. Option one, two, or three.',
});
const turnB = m.deriveTurnSignals({
  hook_event_name: 'Stop',
  session_id: 'wr01-sess',
  ran_entries: ['lib/core/navigation-engine-offer.cjs'],
  output_text: 'COMPLETELY re-worded prose for the very same stuck gate, different bytes.',
});
ok('(WR-01) re-worded retries on the same session+gate produce the SAME retry key (converges)',
  m.turnContextHash(turnA) === m.turnContextHash(turnB));

// And a DIFFERENT session (or different gate) must NOT collide onto the same counter.
const turnC = m.deriveTurnSignals({
  hook_event_name: 'Stop',
  session_id: 'wr01-OTHER-sess',
  ran_entries: ['lib/core/navigation-engine-offer.cjs'],
  output_text: 'Choose your starting point. Option one, two, or three.',
});
ok('(WR-01) a different session yields a DIFFERENT retry key (no false convergence)',
  m.turnContextHash(turnA) !== m.turnContextHash(turnC));

// Gate-identity fallback: with no ran_entries, a stable gate_turn_index keys the counter
// (still output-text-independent).
const turnD1 = m.deriveTurnSignals({
  hook_event_name: 'Stop', session_id: 'wr01-fb', gate_turn_index: 4,
  output_text: 'first wording',
});
const turnD2 = m.deriveTurnSignals({
  hook_event_name: 'Stop', session_id: 'wr01-fb', gate_turn_index: 4,
  output_text: 'second, different wording',
});
ok('(WR-01) gate_turn_index fallback also converges across re-wording',
  m.turnContextHash(turnD1) === m.turnContextHash(turnD2));

// End-to-end convergence proof: drive the ACTUAL script MAX_FORCE_RETRIES times with
// RE-WORDED ascii-box transcripts on the SAME session; the counter must reach the ceiling
// and the script must DEGRADE (continue:true) on the Nth+1 run instead of blocking forever.
function asciiTranscriptWithText(name, text) {
  return writeTranscript(name, [
    { type: 'user', message: { role: 'user', content: 'go' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } },
  ]);
}
const CONV_HOME = path.join(TMP, 'conv-home');
fs.mkdirSync(CONV_HOME, { recursive: true });
function runConv(text, n) {
  const fp = asciiTranscriptWithText('conv-' + n + '.jsonl',
    'Choose your starting point:\n  [1] a\n  [2] b\n  [3] c\ntype 1, 2, or 3\n' + text);
  const res = spawnSync('node', [INTERCEPTOR_PATH], {
    input: JSON.stringify({ hook_event_name: 'Stop', transcript_path: fp, session_id: 'conv-sess' }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_HOME: CONV_HOME }),
  });
  try { return JSON.parse((res.stdout || '').trim()); } catch (_e) { return null; }
}
let blockedRuns = 0;
let degraded = false;
for (let i = 0; i < m.MAX_FORCE_RETRIES; i++) {
  const env = runConv('unique wording number ' + i + ' lorem ipsum ' + Math.random(), i);
  if (env && env.decision === 'block') blockedRuns += 1;
}
// One more run past the ceiling: the SAME session+gate must now degrade, NOT block.
const pastCeiling = runConv('yet another fresh wording ' + Math.random(), 99);
degraded = !!(pastCeiling && pastCeiling.continue === true && pastCeiling.decision === undefined);
ok('(WR-01) MAX_FORCE_RETRIES re-worded blocks are reached (counter actually climbs)',
  blockedRuns === m.MAX_FORCE_RETRIES);
ok('(WR-01) past the ceiling the SAME session+gate DEGRADES (no infinite loop)', degraded);

// ---------------------------------------------------------------------------
// (WR-02) the retry store is pruned on write: a stale entry older than RETRY_TTL_MS is
// evicted. pruneRetryStore is the exported pure pruner; we assert eviction + retention.
// ---------------------------------------------------------------------------
ok('(WR-02) RETRY_TTL_MS is exported as a positive number',
  Number.isFinite(m.RETRY_TTL_MS) && m.RETRY_TTL_MS > 0);
ok('(WR-02) pruneRetryStore + normalizeRetryEntry are exported',
  typeof m.pruneRetryStore === 'function' && typeof m.normalizeRetryEntry === 'function');

const now = 1000000000000;
const mixedStore = {
  fresh: { count: 2, ts: now - 1000 },                  // well within TTL
  stale: { count: 5, ts: now - (m.RETRY_TTL_MS + 1) },  // just past TTL -> evict
  legacyBare: 3,                                         // pre-WR-02 bare int -> normalized, kept
};
const pruned = m.pruneRetryStore(mixedStore, now);
ok('(WR-02) a fresh entry survives the prune', pruned.fresh && pruned.fresh.count === 2);
ok('(WR-02) a stale entry (older than RETRY_TTL_MS) is evicted', pruned.stale === undefined);
ok('(WR-02) a legacy bare-integer entry is normalized to { count, ts } and kept',
  pruned.legacyBare && pruned.legacyBare.count === 3 && Number.isFinite(pruned.legacyBare.ts));
ok('(WR-02) the pruned store never grows past its input key set',
  Object.keys(pruned).length <= Object.keys(mixedStore).length);

// Cleanup (best-effort; tmp dirs are disposable).
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* ignore */ }

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-ga4-card-fire-e2e-179.cjs: PASSED');

module.exports = { pass };
