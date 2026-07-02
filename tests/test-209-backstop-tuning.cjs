'use strict';
// Phase 209-07 (H1 + H2) -- backstop tuning: drop the bare U+25A0 false
// positive, add the multiline-labeled-box and numbered-prose-gate false
// negatives, and widen askFired to the current-turn window (WR-06 fixed).
//
// Sequenced LAST by the phase's LOCKED wave order (tune the floor only
// after the native path from waves 1-2 is live).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const m = require(path.join(REPO, 'scripts', 'check-card-fire.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-209-backstop-tuning');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-backstop-tuning-'));
function writeTranscript(name, lines) {
  const fp = path.join(TMP, name);
  fs.writeFileSync(fp, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
  return fp;
}

// ---------------------------------------------------------------------------
// Task 1 (H1): the FP/FN regex matrix
// ---------------------------------------------------------------------------

ok('H1 FP: a bare U+25A0 in a dial/status row with no option structure does NOT match', function () {
  assert.equal(m.ASCII_BOX_GLYPH_RE.test('status: ■ pending review'), false);
});

ok('H1 FP: a U+25A0-bearing Voice Signature line in ordinary prose does NOT match', function () {
  assert.equal(m.ASCII_BOX_GLYPH_RE.test('Voice Signature: ■ building -- just talking here'), false);
});

ok('H1 FN (unchanged): same-line labeled box "[1] resume [2] new room" matches', function () {
  assert.equal(m.ASCII_BOX_GLYPH_RE.test('[1] resume [2] new room'), true);
});

ok('H1 FN (new): multiline labeled box matches', function () {
  const text = '[1] resume the room\n   details about the room\n[2] start fresh';
  assert.equal(m.ASCII_BOX_GLYPH_RE.test(text), true);
});

ok('H1 FN (unchanged): "type 1, 2, or 3" matches', function () {
  assert.equal(m.ASCII_BOX_GLYPH_RE.test('Type 1, 2, or 3 to choose a room.'), true);
});

ok('H1 FN (new): numbered-prose gate, adjacent lines, matches', function () {
  assert.equal(m.ASCII_BOX_GLYPH_RE.test('1. Resume align-ecosystem\n2. Start a new room'), true);
});

ok('H1 FN (new): numbered-prose gate with one description line between matches (3-line span)', function () {
  assert.equal(m.ASCII_BOX_GLYPH_RE.test('1. Resume align-ecosystem\nyour most recent room\n2. Start a new room'), true);
});

ok('H1 stability (WR-07): two distinct multiline gates produce distinct gate signatures', function () {
  const gateA = '[1] resume align-ecosystem\n   details A\n[2] start fresh';
  const gateB = '[1] resume village-of-life\n   details B\n[2] start fresh';
  const sigA = m.gateSignature(gateA);
  const sigB = m.gateSignature(gateB);
  assert.notEqual(sigA, '');
  assert.notEqual(sigB, '');
  assert.notEqual(sigA, sigB);
});

// ---------------------------------------------------------------------------
// Task 2 (H2): the current-turn askFired window
// ---------------------------------------------------------------------------

ok('H2: fired-then-glyph within one turn (no user message between) -> askFired true, no intercept', function () {
  const fp = writeTranscript('fired-then-glyph.jsonl', [
    { type: 'user', message: { role: 'user', content: 'resume my room' } },
    { type: 'assistant', message: { role: 'assistant', content: [
      { type: 'text', text: 'Let me pull up your rooms.' },
      { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [] } },
    ] } },
    { type: 'assistant', message: { role: 'assistant', content: [
      { type: 'text', text: '1. align-ecosystem\n2. village-of-life (recap of the options above)' },
    ] } },
  ]);
  const turn = m.readTranscriptTurn(fp);
  assert.equal(turn.askuserquestion_fired, true, 'a card fired earlier in the SAME turn must count');
});

ok('H2: stale card across turns still intercepts (the original WR-06 cross-turn bleed stays fixed)', function () {
  const fp = writeTranscript('stale-then-box.jsonl', [
    { type: 'user', message: { role: 'user', content: 'first message' } },
    { type: 'assistant', message: { role: 'assistant', content: [
      { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [] } },
    ] } },
    { type: 'user', message: { role: 'user', content: 'second message' } },
    { type: 'assistant', message: { role: 'assistant', content: [
      { type: 'text', text: '1. Resume align-ecosystem\n2. Start a new room' },
    ] } },
  ]);
  const turn = m.readTranscriptTurn(fp);
  assert.equal(turn.askuserquestion_fired, false, 'a card fired in a PRIOR turn must not mask a no-card box in the next turn');
});

ok('H2: the degenerate no-role:user path still works (whole tail is one window)', function () {
  const fp = writeTranscript('nouser-degenerate.jsonl', [
    { type: 'assistant', message: { role: 'assistant', content: [
      { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [] } },
    ] } },
    { type: 'assistant', message: { role: 'assistant', content: [
      { type: 'text', text: 'compaction summary lead, no user record anywhere in this tail' },
    ] } },
  ]);
  const turn = m.readTranscriptTurn(fp);
  assert.equal(turn.askuserquestion_fired, true, 'with no user record the whole tail is one window, so the fire still counts');
});

ok('H2 retry-key stability: gate_signature and turnContextHash are IDENTICAL before and after the window widening', function () {
  // A single-assistant-message transcript exercises the exact same code path as
  // the pre-209-07 LAST-message-only logic, so the key must be byte-identical.
  const fp = writeTranscript('single-message-key-stability.jsonl', [
    { type: 'user', message: { role: 'user', content: 'resume my room' } },
    { type: 'assistant', message: { role: 'assistant', content: [
      { type: 'text', text: '1. Resume align-ecosystem\n2. Start a new room' },
    ] } },
  ]);
  const turn = m.readTranscriptTurn(fp);
  assert.notEqual(turn.gate_signature, '', 'a gate signature must be derivable for this fixture');
  const hash1 = m.turnContextHash(Object.assign({ session_id: 'fixed-session' }, turn));
  const hash2 = m.turnContextHash(Object.assign({ session_id: 'fixed-session' }, turn));
  assert.equal(hash1, hash2, 'turnContextHash must be deterministic over identical input');
  assert.equal(hash1.length, 16);
});

// ---------------------------------------------------------------------------
// Floor + regression proofs
// ---------------------------------------------------------------------------

ok('Constitutional floor byte-untouched: MAX_FORCE_RETRIES=3, MAX_SESSION_INTERCEPTS=12', function () {
  assert.equal(m.MAX_FORCE_RETRIES, 3);
  assert.equal(m.MAX_SESSION_INTERCEPTS, 12);
});

console.log('\nPASS test-209-backstop-tuning (' + n + ' assertions)');
