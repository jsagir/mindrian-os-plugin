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
// stop-hook-invalid-hookspecificoutput-schema (2026-07-23, 4th occurrence of this
// defect class): this assertion previously required hookSpecificOutput.additionalContext
// on the block envelope -- that was asserting the BUG (Stop has no hookSpecificOutput
// variant in Claude Code's schema; including it rejected the WHOLE envelope on every
// real Stop hook run, which a live user hit verbatim). The correct, schema-valid block
// envelope carries only top-level decision/reason/systemMessage/continue and NEVER
// hookSpecificOutput. See
// .planning/debug/resolved/stop-hook-invalid-hookspecificoutput-schema.md.
ok('(E2E-1) the block envelope NEVER carries hookSpecificOutput (Stop has no such schema variant)',
  r1.env.hookSpecificOutput === undefined);
ok('(E2E-1) the block carries a calm, non-empty systemMessage (the schema-valid user-facing surface)',
  typeof r1.env.systemMessage === 'string' && r1.env.systemMessage.length > 0);

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

// ---------------------------------------------------------------------------
// (CR-02) GROWING-transcript convergence -- the LIVE BACKSTOP-path proof.
//
// This is the anti-test-theater assertion the prior fixture was MISSING. The prior
// "convergence" test (above) held assistantCount constant at 1 per fixture, so it could not
// catch the production livelock: on the live BACKSTOP path the model APPENDS one assistant
// turn every time the interceptor blocks and re-emits, so any transcript-LENGTH-derived gate
// identity (the old gate_turn_index = assistantCount) mints a FRESH key every retry and the
// bounded escape NEVER converges. Here we reproduce the PRODUCTION shape: the SAME session,
// the SAME fixed last-USER message, but a GROWING transcript (run k = k prior assistant turns
// + the box turn). Runs 1..MAX MUST block (the counter climbs on ONE stable key), and run
// MAX+1 MUST degrade (continue:true, no block). This FAILS against the pre-fix
// gate_turn_index identity (5 distinct count:1 keys, blocks forever) and PASSES after the
// last_user_anchor fix (one key climbs to MAX then degrades).
// ---------------------------------------------------------------------------
const GROW_HOME = path.join(TMP, 'grow-home');
fs.mkdirSync(GROW_HOME, { recursive: true });

// growingTranscript(run) -- a transcript with a FIXED last-user message and `run` prior
// assistant turns BEFORE the final box turn, so assistantCount GROWS by one each run (the
// exact production shape the reviewer used to prove the livelock). Each turn carries unique
// prose so a volatile-output key would also drift -- only a growth-invariant gate identity
// converges.
function growingTranscript(run) {
  const lines = [
    { type: 'user', message: { role: 'user', content: 'I want to start a venture' } },
  ];
  for (let i = 0; i < run; i++) {
    lines.push({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'prior re-emission ' + i + ' ' + Math.random() }] },
    });
  }
  lines.push({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{
        type: 'text',
        text: 'Choose your starting point:\n  [1] a\n  [2] b\n  [3] c\ntype 1, 2, or 3\n' + Math.random(),
      }],
    },
  });
  return writeTranscript('grow-' + run + '.jsonl', lines);
}
function runGrow(run) {
  const fp = growingTranscript(run);
  const res = spawnSync('node', [INTERCEPTOR_PATH], {
    input: JSON.stringify({ hook_event_name: 'Stop', transcript_path: fp, session_id: 'grow-sess' }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_HOME: GROW_HOME }),
  });
  try { return JSON.parse((res.stdout || '').trim()); } catch (_e) { return null; }
}
function growStore() {
  try { return JSON.parse(fs.readFileSync(path.join(GROW_HOME, 'card-fire-retries.json'), 'utf8')); }
  catch (_e) { return {}; }
}
let growBlocked = 0;
let growKeysAtCeiling = [];
for (let run = 1; run <= m.MAX_FORCE_RETRIES; run++) {
  const env = runGrow(run);
  if (env && env.decision === 'block') growBlocked += 1;
  // Count PER-GATE keys only (exclude the CR-04 `__session__:` session-counter entry, which is a
  // legitimate second key the session-wide ceiling adds).
  if (run === m.MAX_FORCE_RETRIES) {
    growKeysAtCeiling = Object.keys(growStore()).filter((k) => k.indexOf(m.SESSION_KEY_PREFIX) !== 0);
  }
}
const growPastCeiling = runGrow(m.MAX_FORCE_RETRIES + 1);
const growDegraded = !!(growPastCeiling && growPastCeiling.continue === true && growPastCeiling.decision === undefined);
ok('(CR-02) a GROWING transcript blocks runs 1..MAX (counter climbs on a growth-invariant key)',
  growBlocked === m.MAX_FORCE_RETRIES);
ok('(CR-02) at the ceiling the side-file holds exactly ONE converging PER-GATE key (not MAX distinct keys)',
  growKeysAtCeiling.length === 1);
ok('(CR-02) past MAX the GROWING-transcript gate DEGRADES (continue:true, no block) -- no livelock',
  growDegraded);

// ---------------------------------------------------------------------------
// (CR-03) GROWING transcript with NO `role:user` record -- the no-anchor livelock the CR-02
// last-user-anchor fix left open. After a compaction the early user turns become a
// `type:'summary'` record (NOT `role:'user'`), and this codebase's own Phase 114/117 auto-fire
// flows can drive a Decision Gate before the navigator types a `role:user` turn. On those shapes
// the prior fix's last-user anchor was EMPTY and fell back to `assistantCount` (the growing
// counter), re-blocking forever. The ROOT fix anchors the retry key on the GATE-IDENTIFYING
// CONTENT (gate_signature), which has no such hole. This fixture writes NO `role:user` line (a
// `type:'summary'` lead stands in), grows the transcript by one assistant turn per run, and
// asserts ONE converging key + degrade-by-(MAX+1). FAILS pre-fix (the CR-03 livelock: MAX+1
// distinct count:1 keys, never degrades) / PASSES post-fix. Per the hard rule, the fixture writes
// NO `role:user` first line.
// ---------------------------------------------------------------------------
const NOUSER_HOME = path.join(TMP, 'nouser-home');
fs.mkdirSync(NOUSER_HOME, { recursive: true });

// growingNoUserTranscript(run) -- a transcript with NO `role:user` record (a `type:'summary'`
// compaction lead) and `run` prior assistant turns before the final box turn, so assistantCount
// GROWS by one each run. Each turn carries unique prose so a volatile-output key would also drift
// -- only a growth-invariant GATE-content identity converges here.
function growingNoUserTranscript(run) {
  const lines = [
    { type: 'summary', summary: 'compacted earlier conversation about a venture ' + Math.random() },
  ];
  for (let i = 0; i < run; i++) {
    lines.push({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'prior re-emission ' + i + ' ' + Math.random() }] },
    });
  }
  lines.push({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{
        type: 'text',
        text: 'Choose your starting point:\n  [1] a\n  [2] b\n  [3] c\ntype 1, 2, or 3\n' + Math.random(),
      }],
    },
  });
  return writeTranscript('nouser-grow-' + run + '.jsonl', lines);
}
function runNoUser(run) {
  const fp = growingNoUserTranscript(run);
  const res = spawnSync('node', [INTERCEPTOR_PATH], {
    input: JSON.stringify({ hook_event_name: 'Stop', transcript_path: fp, session_id: 'nouser-sess' }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_HOME: NOUSER_HOME }),
  });
  try { return JSON.parse((res.stdout || '').trim()); } catch (_e) { return null; }
}
function noUserStore() {
  try { return JSON.parse(fs.readFileSync(path.join(NOUSER_HOME, 'card-fire-retries.json'), 'utf8')); }
  catch (_e) { return {}; }
}
let noUserBlocked = 0;
let noUserKeysAtCeiling = [];
for (let run = 1; run <= m.MAX_FORCE_RETRIES; run++) {
  const env = runNoUser(run);
  if (env && env.decision === 'block') noUserBlocked += 1;
  // Count PER-GATE keys only (exclude the CR-04 `__session__:` session-counter entry).
  if (run === m.MAX_FORCE_RETRIES) {
    noUserKeysAtCeiling = Object.keys(noUserStore()).filter((k) => k.indexOf(m.SESSION_KEY_PREFIX) !== 0);
  }
}
const noUserPastCeiling = runNoUser(m.MAX_FORCE_RETRIES + 1);
const noUserDegraded = !!(noUserPastCeiling && noUserPastCeiling.continue === true && noUserPastCeiling.decision === undefined);
ok('(CR-03) a GROWING NO-role:user transcript blocks runs 1..MAX (gate-content key, not user-anchor)',
  noUserBlocked === m.MAX_FORCE_RETRIES);
ok('(CR-03) at the ceiling the side-file holds exactly ONE converging PER-GATE key (no growing-counter livelock)',
  noUserKeysAtCeiling.length === 1);
ok('(CR-03) past MAX the NO-role:user gate DEGRADES (continue:true, no block) -- the livelock is dead',
  noUserDegraded);

// A bare box-as-first-and-only message (ZERO prior records) must ALSO converge, not livelock on
// a transcript-length key (the degenerate floor: session_id alone via the gate signature).
const BARE_BOX = writeTranscript('bare-box.jsonl', [
  {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'Choose:\n  [1] a\n  [2] b\n  [3] c\ntype 1, 2, or 3' }],
    },
  },
]);
const rBare = runInterceptor({ hook_event_name: 'Stop', transcript_path: BARE_BOX, session_id: 'bare-sess' });
ok('(CR-03) a bare box-as-first-message still BLOCKS (gate detected; no role:user needed)',
  rBare.env && rBare.env.decision === 'block');

// ---------------------------------------------------------------------------
// (WR-07) two genuinely DIFFERENT gates in ONE session must get INDEPENDENT counters -- no
// cross-gate budget bleed. The prior user-anchor key merged any two gates that shared (or both
// lacked) a user message onto one counter, so gate B inherited gate A's spent budget. The
// gate-content anchor gives each distinct gate its own key. Drive gate A twice, then gate B once,
// in the same session: gate B must mint a NEW key at count 1, and gate A's counter must be
// UNTOUCHED. FAILS pre-fix (one merged key) / PASSES post-fix (two independent keys).
// ---------------------------------------------------------------------------
const WR07_HOME = path.join(TMP, 'wr07-home');
fs.mkdirSync(WR07_HOME, { recursive: true });
function gateBoxTranscript(name, labels) {
  // NO role:user -- proves the GATE CONTENT, not the user message, drives the per-gate counter.
  return writeTranscript(name, [
    { type: 'summary', summary: 'compacted' },
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'Choose:\n  [1] ' + labels[0] + '\n  [2] ' + labels[1] + '\n  [3] ' + labels[2] +
            '\ntype 1, 2, or 3\n' + Math.random(),
        }],
      },
    },
  ]);
}
function fireGate(name, labels) {
  const fp = gateBoxTranscript(name, labels);
  const res = spawnSync('node', [INTERCEPTOR_PATH], {
    input: JSON.stringify({ hook_event_name: 'Stop', transcript_path: fp, session_id: 'wr07-sess' }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_HOME: WR07_HOME }),
  });
  try { return JSON.parse((res.stdout || '').trim()); } catch (_e) { return null; }
}
function wr07Store() {
  // Return PER-GATE entries only -- strip the CR-04 `__session__:` session-counter entry so the
  // per-gate key-count assertions below (which predate the session ceiling) stay exact.
  let raw;
  try { raw = JSON.parse(fs.readFileSync(path.join(WR07_HOME, 'card-fire-retries.json'), 'utf8')); }
  catch (_e) { return {}; }
  const out = {};
  for (const k of Object.keys(raw)) {
    if (k.indexOf(m.SESSION_KEY_PREFIX) !== 0) out[k] = raw[k];
  }
  return out;
}
const GATE_A_LABELS = ['alpha', 'beta', 'gamma'];
const GATE_B_LABELS = ['delta', 'epsilon', 'zeta'];
fireGate('wr07-a1.jsonl', GATE_A_LABELS);
fireGate('wr07-a2.jsonl', GATE_A_LABELS);
const wr07AfterA = Object.assign({}, wr07Store());
fireGate('wr07-b1.jsonl', GATE_B_LABELS);
const wr07AfterB = wr07Store();
const wr07KeysA = Object.keys(wr07AfterA);
const wr07KeysB = Object.keys(wr07AfterB);
const wr07NewKey = wr07KeysB.filter((k) => !wr07KeysA.includes(k));
ok('(WR-07) gate A intercepted twice yields exactly ONE key at count 2',
  wr07KeysA.length === 1 && wr07AfterA[wr07KeysA[0]].count === 2);
ok('(WR-07) a DISTINCT gate B mints a NEW independent key (two keys total, no merge)',
  wr07KeysB.length === 2 && wr07NewKey.length === 1);
ok('(WR-07) gate B starts fresh at count 1 (it does NOT inherit gate A spent budget)',
  wr07NewKey.length === 1 && wr07AfterB[wr07NewKey[0]].count === 1);
ok('(WR-07) gate A counter is UNTOUCHED by gate B (no cross-gate clear or bleed)',
  wr07KeysA.every((k) => wr07AfterB[k] && wr07AfterB[k].count === wr07AfterA[k].count));

// ---------------------------------------------------------------------------
// (WR-08) the transcript read is size-capped: readTranscriptTail reads at most the LAST
// TRANSCRIPT_TAIL_BYTES, so a pathological huge transcript cannot stall the 3000ms hook.
// Detection semantics are UNCHANGED -- the box turn at the tail is still detected and blocks.
// We build a transcript padded with megabytes of leading filler assistant turns, then the box at
// the very end; the cap must drop the leading filler yet STILL block on the tail box turn.
// ---------------------------------------------------------------------------
ok('(WR-08) TRANSCRIPT_TAIL_BYTES is exported as a positive number',
  Number.isFinite(m.TRANSCRIPT_TAIL_BYTES) && m.TRANSCRIPT_TAIL_BYTES > 0);
ok('(WR-08) readTranscriptTail is exported', typeof m.readTranscriptTail === 'function');

const HUGE_PATH = path.join(FIX_DIR, 'huge.jsonl');
{
  // Synchronous append so the file is fully flushed before the read below (no createWriteStream
  // async-flush race). Leading filler well past the cap, then the tail box turn.
  const fd = fs.openSync(HUGE_PATH, 'w');
  const fillerLine = JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text: 'x'.repeat(4000) }] },
  }) + '\n';
  const targetBytes = m.TRANSCRIPT_TAIL_BYTES + (1 * 1024 * 1024); // 1 MiB past the cap
  let written = 0;
  while (written < targetBytes) { fs.writeSync(fd, fillerLine); written += fillerLine.length; }
  // The tail box turn (the only gate-bearing line) at the very end.
  fs.writeSync(fd, JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'Choose:\n  [1] a\n  [2] b\n  [3] c\ntype 1, 2, or 3' }],
    },
  }) + '\n');
  fs.closeSync(fd);
}
const hugeStat = (() => { try { return fs.statSync(HUGE_PATH); } catch (_e) { return null; } })();
ok('(WR-08) the huge fixture exceeds the byte cap on disk',
  hugeStat && hugeStat.size > m.TRANSCRIPT_TAIL_BYTES);
const rHuge = runInterceptor({
  hook_event_name: 'Stop',
  transcript_path: HUGE_PATH,
  session_id: 'e2e-sess-huge',
});
ok('(WR-08) a capped read still detects the TAIL box turn and BLOCKS (semantics unchanged)',
  rHuge.env && rHuge.env.decision === 'block' && rHuge.env.continue === false);

// ---------------------------------------------------------------------------
// (WR-06) a STALE earlier AskUserQuestion must NOT suppress interception of the CURRENT box.
// The card-fired signal MUST be scoped to the LAST assistant message, same scope as
// output_text. Earlier-turn fires a card, last turn renders a flat box -> MUST block.
// FAILS pre-fix (askFired was OR'd across the whole transcript) / PASSES post-fix.
// ---------------------------------------------------------------------------
const STALE_CARD_THEN_BOX = writeTranscript('stale-card-then-box.jsonl', [
  { type: 'user', message: { role: 'user', content: 'I want to start a venture' } },
  {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Earlier turn that correctly fired the card.' },
        { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [] } },
      ],
    },
  },
  { type: 'user', message: { role: 'user', content: 'option 2 please' } },
  {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{
        type: 'text',
        text: 'Choose your next starting point:\n  [1] a\n  [2] b\n  [3] c\ntype 1, 2, or 3',
      }],
    },
  },
]);
const rStale = runInterceptor({
  hook_event_name: 'Stop',
  transcript_path: STALE_CARD_THEN_BOX,
  session_id: 'e2e-sess-stale',
});
ok('(WR-06) the script exits 0 on the stale-card-then-box transcript', rStale.res.status === 0);
ok('(WR-06) a stale EARLIER card does NOT suppress the CURRENT box -- it BLOCKS (decision:block)',
  rStale.env && rStale.env.decision === 'block' && rStale.env.continue === false);

// And the converse stays correct: a card fired on the LAST (current) turn still no-ops, even
// when an earlier turn rendered a box (proves the scope is genuinely last-turn, not first-match).
const BOX_THEN_CARD = writeTranscript('box-then-card.jsonl', [
  { type: 'user', message: { role: 'user', content: 'go' } },
  {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'old box:\n  [1] a\n  [2] b\ntype 1, 2, or 3' }],
    },
  },
  { type: 'user', message: { role: 'user', content: 'continue' } },
  {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Now I fire the card.' },
        { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [] } },
      ],
    },
  },
]);
const rBoxThenCard = runInterceptor({
  hook_event_name: 'Stop',
  transcript_path: BOX_THEN_CARD,
  session_id: 'e2e-sess-boxthencard',
});
ok('(WR-06) a card fired on the LAST turn no-ops even after an earlier box (last-turn scope)',
  rBoxThenCard.env && rBoxThenCard.env.continue === true && rBoxThenCard.env.decision === undefined);

// ---------------------------------------------------------------------------
// (CR-04) FLAPPING-LABELS -- the SESSION-WIDE intercept ceiling is the TERMINAL convergence
// floor. This is the anti-test-theater fixture the prior suite was MISSING: every prior green
// fixture above holds the option labels BYTE-CONSTANT (`[1] a [2] b [3] c`), so none of them can
// see the flap. Here each retry's box carries GENUINELY DIFFERENT option labels, so the per-gate
// gate_signature flaps to a fresh NON-empty key every run (count:1 each, never reaching
// MAX_FORCE_RETRIES). The per-gate counter therefore NEVER converges -- only the content-
// INDEPENDENT session counter does. We drive the REAL script MORE than MAX_SESSION_INTERCEPTS
// times on the SAME session_id and assert: runs 1..MAX_SESSION_INTERCEPTS BLOCK (the session
// counter climbs), the per-gate side-file holds MANY distinct count:1 keys (proving the flap is
// real), the session counter reaches the ceiling, and run MAX_SESSION_INTERCEPTS+1 DEGRADES.
// FAILS pre-fix (livelocks forever -- blocks on every run, no session ceiling exists) / PASSES
// post-fix (degrades at the session ceiling).
// ---------------------------------------------------------------------------
ok('(CR-04) MAX_SESSION_INTERCEPTS is exported as a positive number above MAX_FORCE_RETRIES',
  Number.isFinite(m.MAX_SESSION_INTERCEPTS) && m.MAX_SESSION_INTERCEPTS > m.MAX_FORCE_RETRIES);

const FLAP_HOME = path.join(TMP, 'flap-home');
fs.mkdirSync(FLAP_HOME, { recursive: true });

// flappingLabelsTranscript(run) -- a GROWING transcript whose box carries GENUINELY DIFFERENT
// option labels every run (`opt-<run>-a/b/c`), so the per-gate signature flaps to a fresh key
// each retry. Same session_id throughout.
function flappingLabelsTranscript(run) {
  const lines = [
    { type: 'user', message: { role: 'user', content: 'I want to start a venture' } },
  ];
  for (let i = 0; i < run; i++) {
    lines.push({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'prior re-emission ' + i + ' ' + Math.random() }] },
    });
  }
  lines.push({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{
        type: 'text',
        text: 'Choose your starting point:\n  [1] opt-' + run + '-aaa\n  [2] opt-' + run +
          '-bbb\n  [3] opt-' + run + '-ccc\ntype 1, 2, or 3\n' + Math.random(),
      }],
    },
  });
  return writeTranscript('flap-' + run + '.jsonl', lines);
}
function runFlap(run) {
  const fp = flappingLabelsTranscript(run);
  const res = spawnSync('node', [INTERCEPTOR_PATH], {
    input: JSON.stringify({ hook_event_name: 'Stop', transcript_path: fp, session_id: 'flap-sess' }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_HOME: FLAP_HOME }),
  });
  try { return JSON.parse((res.stdout || '').trim()); } catch (_e) { return null; }
}
function flapStore() {
  try { return JSON.parse(fs.readFileSync(path.join(FLAP_HOME, 'card-fire-retries.json'), 'utf8')); }
  catch (_e) { return {}; }
}
function flapSessionCount() {
  const e = flapStore()[m.SESSION_KEY_PREFIX + 'flap-sess'];
  return e && Number.isFinite(e.count) ? e.count : 0;
}
function flapPerGateKeyCount() {
  return Object.keys(flapStore()).filter((k) => k.indexOf(m.SESSION_KEY_PREFIX) !== 0).length;
}
let flapBlocked = 0;
let flapDistinctKeysAtCeiling = 0;
for (let run = 1; run <= m.MAX_SESSION_INTERCEPTS; run++) {
  const env = runFlap(run);
  if (env && env.decision === 'block') flapBlocked += 1;
  if (run === m.MAX_SESSION_INTERCEPTS) flapDistinctKeysAtCeiling = flapPerGateKeyCount();
}
const flapSessionAtCeiling = flapSessionCount();
const flapPastCeiling = runFlap(m.MAX_SESSION_INTERCEPTS + 1);
const flapDegraded = !!(flapPastCeiling && flapPastCeiling.continue === true && flapPastCeiling.decision === undefined);
ok('(CR-04) flapping labels: runs 1..MAX_SESSION_INTERCEPTS all BLOCK (the per-gate key flaps; session counter climbs)',
  flapBlocked === m.MAX_SESSION_INTERCEPTS);
ok('(CR-04) flapping labels: the side-file holds MANY distinct per-gate count:1 keys (the flap is real, not a single converging key)',
  flapDistinctKeysAtCeiling >= m.MAX_SESSION_INTERCEPTS);
ok('(CR-04) flapping labels: the SESSION counter reaches the ceiling (the content-independent floor climbs regardless of the flap)',
  flapSessionAtCeiling === m.MAX_SESSION_INTERCEPTS);
ok('(CR-04) flapping labels: past MAX_SESSION_INTERCEPTS the session ceiling DEGRADES (continue:true) -- the livelock is dead even with distinct keys',
  flapDegraded);
ok('(CR-04) flapping labels: the degrade RESETS the session counter (a fresh run starts clean)',
  flapSessionCount() === 0);

// ---------------------------------------------------------------------------
// (CR-04 realistic-paraphrase) the SAME three semantic options RE-WORDED the way an LLM
// naturally paraphrases on a re-emit ("Solution-first" -> "Start from the solution" -> ...). A
// role:user IS present (the MAINLINE path, not an edge shape). The realistic paraphrase cycle
// partially collides under normalization, so a few per-gate keys recur and may even reach the
// per-gate ceiling LATE; the load-bearing guarantee is that the run is BOUNDED -- it must DEGRADE
// (via whichever floor fires first, per-gate OR session) within MAX_SESSION_INTERCEPTS+1 runs,
// instead of the pre-fix livelock that blocked on EVERY run forever. Pre-fix this cycle blocked
// indefinitely (no single key reached MAX every cycle, and no session ceiling existed); post-fix
// it is bounded. We drive an UNBROKEN run and assert a degrade lands no later than the session
// ceiling -- and that EVERY run up to the first degrade was a block (so the cap is the ONLY thing
// that stopped it, not a spurious early no-op).
// ---------------------------------------------------------------------------
const PARA_HOME = path.join(TMP, 'para-home');
fs.mkdirSync(PARA_HOME, { recursive: true });
// A cycle of natural paraphrases of the SAME three semantic options.
const PARAPHRASES = [
  ['Solution-first', 'Domain-first', 'Venture-first'],
  ['Start from the solution', 'Start from the domain', 'Start from the venture'],
  ['Solution first', 'Domain first', 'Venture first'],
  ['The solution-first path', 'The domain-first path', 'The venture-first path'],
  ['Begin with a solution', 'Begin with a domain', 'Begin with a venture'],
  ['Lead with the solution', 'Lead with the domain', 'Lead with the venture'],
];
function paraphraseTranscript(run) {
  const labels = PARAPHRASES[run % PARAPHRASES.length];
  return writeTranscript('para-' + run + '.jsonl', [
    { type: 'user', message: { role: 'user', content: 'I want to start a venture' } },
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'Choose your starting point:\n  [1] ' + labels[0] + '\n  [2] ' + labels[1] +
            '\n  [3] ' + labels[2] + '\ntype 1, 2, or 3\n' + Math.random(),
        }],
      },
    },
  ]);
}
function runPara(run) {
  const fp = paraphraseTranscript(run);
  const res = spawnSync('node', [INTERCEPTOR_PATH], {
    input: JSON.stringify({ hook_event_name: 'Stop', transcript_path: fp, session_id: 'para-sess' }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_HOME: PARA_HOME }),
  });
  try { return JSON.parse((res.stdout || '').trim()); } catch (_e) { return null; }
}
// Drive the cycle until the FIRST degrade, capping at MAX_SESSION_INTERCEPTS+1 runs. The run is
// bounded if a degrade lands within that window; every run before it must have been a block.
let paraFirstDegradeRun = -1;
let paraAllBlockedBeforeDegrade = true;
for (let run = 1; run <= m.MAX_SESSION_INTERCEPTS + 1 && paraFirstDegradeRun === -1; run++) {
  const env = runPara(run);
  if (env && env.continue === true && env.decision === undefined) {
    paraFirstDegradeRun = run;
  } else if (!(env && env.decision === 'block')) {
    // Anything that is neither a degrade nor a block before the cap is a spurious result.
    paraAllBlockedBeforeDegrade = false;
  }
}
ok('(CR-04 paraphrase) the realistic same-options paraphrase cycle is BOUNDED -- it DEGRADES no later than the session ceiling (pre-fix it livelocked forever)',
  paraFirstDegradeRun !== -1 && paraFirstDegradeRun <= m.MAX_SESSION_INTERCEPTS + 1);
ok('(CR-04 paraphrase) every run before the degrade was a BLOCK (the cap is what stopped it, not a spurious early no-op)',
  paraAllBlockedBeforeDegrade);

// ---------------------------------------------------------------------------
// (CR-04 WR-07-coexist) the session ceiling must NOT break the legitimate two-distinct-gates
// case: two genuinely-different gates, each forced to the PER-GATE degrade (MAX_FORCE_RETRIES),
// must BOTH degrade via the per-gate counter BEFORE the session ceiling fires. With
// MAX_SESSION_INTERCEPTS (12) well above 2 x MAX_FORCE_RETRIES (6), two gates each reaching their
// per-gate degrade consume only 2 x MAX_FORCE_RETRIES session intercepts -- under the ceiling --
// so the per-gate degrade is what fires, not the session ceiling.
// ---------------------------------------------------------------------------
ok('(CR-04 WR-07-coexist) MAX_SESSION_INTERCEPTS is well above 2 x MAX_FORCE_RETRIES (per-gate degrade fires first for distinct gates)',
  m.MAX_SESSION_INTERCEPTS > 2 * m.MAX_FORCE_RETRIES);

const COEX_HOME = path.join(TMP, 'coex-home');
fs.mkdirSync(COEX_HOME, { recursive: true });
// A STABLE-label gate (constant labels each run) so the per-gate signature does NOT flap -- the
// per-gate counter converges and the per-gate degrade fires. Two such distinct gates in one
// session.
function stableGateTranscript(name, labels) {
  return writeTranscript(name, [
    { type: 'summary', summary: 'compacted' },
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'Choose:\n  [1] ' + labels[0] + '\n  [2] ' + labels[1] + '\n  [3] ' + labels[2] +
            '\ntype 1, 2, or 3\n' + Math.random(),
        }],
      },
    },
  ]);
}
function runStableGate(name, labels) {
  const fp = stableGateTranscript(name, labels);
  const res = spawnSync('node', [INTERCEPTOR_PATH], {
    input: JSON.stringify({ hook_event_name: 'Stop', transcript_path: fp, session_id: 'coex-sess' }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_HOME: COEX_HOME }),
  });
  try { return JSON.parse((res.stdout || '').trim()); } catch (_e) { return null; }
}
// Gate A: force it MAX_FORCE_RETRIES times (block), then the MAX+1 run must degrade PER-GATE.
let coexAblocked = 0;
for (let i = 0; i < m.MAX_FORCE_RETRIES; i++) {
  const env = runStableGate('coex-a' + i + '.jsonl', ['alpha', 'beta', 'gamma']);
  if (env && env.decision === 'block') coexAblocked += 1;
}
const coexAdegrade = runStableGate('coex-a-deg.jsonl', ['alpha', 'beta', 'gamma']);
const coexAdegraded = !!(coexAdegrade && coexAdegrade.continue === true && coexAdegrade.decision === undefined);
ok('(CR-04 WR-07-coexist) a STABLE-label gate A still converges via the PER-GATE counter (blocks MAX, then per-gate degrade) -- the session ceiling did not steal its budget',
  coexAblocked === m.MAX_FORCE_RETRIES && coexAdegraded);

// Cleanup (best-effort; tmp dirs are disposable).
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* ignore */ }

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-ga4-card-fire-e2e-179.cjs: PASSED');

module.exports = { pass };
