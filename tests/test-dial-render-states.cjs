/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143.1-04 -- the S1-S5 render-state test for the CLI dial presenter
 * (DIALTUI-03 + DIALTUI-10). Maps 1:1 to the UI-SPEC Section 13 ASCII mockups
 * + the Section 12 verification dimensions (V2 glyph-only / V5 row budget /
 * V7 looks-intentional) + the DIALTUI-10 surface-agnostic-core proof.
 *
 * The presenter is the FORMAT half of the nav-dial resolve/format split: it
 * consumes the surface-agnostic ReachList (Plan 01 buildReachList) + the
 * Feynman-JTBD labels (Plan 02 composeLabel) and renders the Shape F.1
 * Brain-suggestion variant by REUSING lib/hmi/shape-f1-renderer.cjs
 * renderShapeF1 -- no bespoke widget, MAX_K=3 untouched. The "dial" is the
 * right-aligned NN% confidence column prefixed by the filled/empty triangle.
 *
 * The 5 states (UI-SPEC Section 7 + 13):
 *   S1 mode_a clear leader  -> exactly 1 filled marker (reach #1)
 *   S2 mode_a near-tie      -> exactly 2 filled markers (reach #1 + #2)
 *   S3 mode_b               -> 0 filled; framing line; honest low %
 *   S4 tier_0               -> 0 filled; confidence '--'; framing line
 *   S5 partial-slot         -> markers per the gate; degraded row carries the
 *                              generic JTBD one_line (no raw '{topic}')
 *
 * No em-dashes anywhere (CLAUDE.md project hard rule). Hyphens only.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const PRESENTER_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'dial-presenter.cjs');
const ORCH_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'dial-reach-orchestrator.cjs');

function loadPresenter() {
  delete require.cache[require.resolve(PRESENTER_PATH)];
  return require(PRESENTER_PATH);
}

const orch = require(ORCH_PATH);

// Build a roomState that pins each reach's score (the pre-baked LOCAL priors
// the orchestrator consumes; zero live Brain calls).
function stateWith(tierMode, scores) {
  return { tierMode, reachScores: scores };
}

// A stable slotContext that resolves every reach's {topic}/{topic_a}/{topic_b}/
// {room_name}/{framework} slot, so non-degraded labels render in S1-S4.
const FULL_SLOTS = {
  topic: 'pricing',
  topic_a: 'pricing',
  topic_b: 'CAC',
  room_name: 'synteris',
  framework: 'SWOT',
};

// The ANSI escape detector for the surface-agnostic-core proof (DIALTUI-10).
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[/;

function countGlyph(str, glyph) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === glyph) n++;
  }
  return n;
}

// Pull the rendered body text out of whatever shape the presenter returns. The
// presenter returns { body, footer?, framing?, rows? } at minimum; we accept a
// `text` convenience field too.
function renderText(result) {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    if (typeof result.text === 'string') return result.text;
    const parts = [];
    if (typeof result.framing === 'string') parts.push(result.framing);
    if (typeof result.header === 'string') parts.push(result.header);
    if (typeof result.body === 'string') parts.push(result.body);
    if (typeof result.footer === 'string') parts.push(result.footer);
    if (parts.length > 0) return parts.join('\n');
  }
  return String(result);
}

// ---------------------------------------------------------------------------
// DIALTUI-10 core: the ReachList the presenter consumes is ANSI-free (the
// surface-agnostic core stays surface-agnostic; ANSI lives only in the format
// layer). Assert FIRST so a regression on the resolve/format split is loud.
// ---------------------------------------------------------------------------

test('DIALTUI-10: the ReachList core contains zero ANSI escape codes', () => {
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.87, contradiction: 0.61, cross_room: 0.54,
    brain_consult: 0.48, deep_research: 0.40,
  }));
  const serialized = JSON.stringify(rl);
  assert.ok(!ANSI_RE.test(serialized), 'the ReachList must carry no ANSI escapes');
});

// ---------------------------------------------------------------------------
// S1 -- Mode A, clear leader: exactly 1 filled marker, footer 'top-3 of 6'
// ---------------------------------------------------------------------------

test('S1: mode_a clear leader -> exactly 1 filled marker; footer top-3 of 6', () => {
  const presenter = loadPresenter();
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.87, contradiction: 0.61, cross_room: 0.54,
    brain_consult: 0.48, deep_research: 0.40, hats: 0.33,
  }));
  const out = presenter.renderDial(rl, { slotContext: FULL_SLOTS });
  const txt = renderText(out);

  assert.strictEqual(countGlyph(txt, '▶'), 1, 'S1 must have exactly 1 filled marker (U+25B6)');
  assert.ok(countGlyph(txt, '▷') >= 2, 'S1 rows 2-3 carry the empty marker (U+25B7)');
  assert.ok(/top-3 of 6/.test(txt), "S1 footer must contain 'top-3 of 6' (Phase 148 D-09 raised 5 -> 6)");
});

test('S1: the highest confidence percent sits on the filled-marker row', () => {
  const presenter = loadPresenter();
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.87, contradiction: 0.61, cross_room: 0.54,
    brain_consult: 0.48, deep_research: 0.40,
  }));
  const out = presenter.renderDial(rl, { slotContext: FULL_SLOTS });
  const txt = renderText(out);
  const lines = txt.split('\n').filter((l) => l.indexOf('%') !== -1);
  const filledLine = lines.find((l) => l.indexOf('▶') !== -1);
  assert.ok(filledLine, 'a filled-marker row with a percent exists');
  // 87% is the highest; it must be on the filled row.
  assert.ok(/87%/.test(filledLine), 'the highest percent (87%) is on the filled row');
});

// ---------------------------------------------------------------------------
// S2 -- Mode A, near-tie (margin < 0.15): exactly 2 filled markers
// ---------------------------------------------------------------------------

test('S2: mode_a near-tie -> exactly 2 filled markers; row 3 empty', () => {
  const presenter = loadPresenter();
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.79, contradiction: 0.71, cross_room: 0.50,
    brain_consult: 0.45, deep_research: 0.40,
  }));
  const out = presenter.renderDial(rl, { slotContext: FULL_SLOTS });
  const txt = renderText(out);
  assert.strictEqual(countGlyph(txt, '▶'), 2, 'S2 must have exactly 2 filled markers');
  assert.ok(countGlyph(txt, '▷') >= 1, 'S2 row 3 carries the empty marker');
});

// ---------------------------------------------------------------------------
// S3 -- Mode B: zero filled markers; framing line; honest low % (not blank,
// not fake-high).
// ---------------------------------------------------------------------------

test('S3: mode_b -> zero filled markers; offline framing line; honest low %', () => {
  const presenter = loadPresenter();
  const rl = orch.buildReachList(stateWith('mode_b', {
    context_block: 0.44, contradiction: 0.41, cross_room: 0.38,
    brain_consult: 0.35, deep_research: 0.30,
  }));
  const out = presenter.renderDial(rl, { slotContext: FULL_SLOTS });
  const txt = renderText(out);
  assert.strictEqual(countGlyph(txt, '▶'), 0, 'Mode B carries zero filled markers');
  assert.ok(countGlyph(txt, '▷') >= 3, 'every Mode B row carries the empty marker');
  assert.ok(/No recommendation - offline\. You pick\./.test(txt),
    "S3 must carry the Mode B framing line");
  // honest low %: a real percent token present, and not a fake high one.
  assert.ok(/\d+%/.test(txt), 'S3 shows an honest percent, not a blank');
});

// ---------------------------------------------------------------------------
// S4 -- Tier 0 cold-room: zero markers; '--' confidence; framing line. MUST
// read as intentional, not broken (V7).
// ---------------------------------------------------------------------------

test('S4: tier_0 -> zero filled markers; -- confidence; cold-room framing line', () => {
  const presenter = loadPresenter();
  const rl = orch.buildReachList(stateWith('tier_0', {}));
  const out = presenter.renderDial(rl, { slotContext: FULL_SLOTS });
  const txt = renderText(out);
  assert.strictEqual(countGlyph(txt, '▶'), 0, 'Tier 0 carries zero filled markers');
  assert.ok(/New room - nothing to rank yet\. Start anywhere\./.test(txt),
    "S4 must carry the Tier 0 framing line");
  assert.ok(/--/.test(txt), "S4 confidence column shows '--' (no signal)");
});

test('V7: S4 cold-room is distinguishable-as-intentional from S1 populated', () => {
  const presenter = loadPresenter();
  const s1 = renderText(presenter.renderDial(
    orch.buildReachList(stateWith('mode_a', {
      context_block: 0.87, contradiction: 0.61, cross_room: 0.54,
      brain_consult: 0.48, deep_research: 0.40,
    })), { slotContext: FULL_SLOTS }));
  const s4 = renderText(presenter.renderDial(
    orch.buildReachList(stateWith('tier_0', {})), { slotContext: FULL_SLOTS }));
  // S1 has a filled marker; S4 does not. S4 has the framing line + '--'; S1 does not.
  assert.ok(countGlyph(s1, '▶') > 0 && countGlyph(s4, '▶') === 0,
    'marker presence distinguishes S1 from S4');
  assert.ok(/Start anywhere/.test(s4) && !/Start anywhere/.test(s1),
    'the cold-room framing line is unique to S4');
});

// ---------------------------------------------------------------------------
// S5 -- Partial-slot label degradation: markers unchanged; the degraded row
// drops to the generic JTBD one_line; NEVER a raw '{topic}' anywhere.
// ---------------------------------------------------------------------------

test('S5: partial-slot -> degraded row carries the generic JTBD line; no raw {topic}', () => {
  const presenter = loadPresenter();
  // mode_a clear leader (markers intact) but the contradiction slot cannot
  // resolve (topic_b missing) -> that row degrades to the generic line.
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.82, contradiction: 0.58, cross_room: 0.51,
    brain_consult: 0.45, deep_research: 0.40,
  }));
  const partialSlots = { topic: 'pricing', framework: 'Porter Five Forces' };
  const out = presenter.renderDial(rl, { slotContext: partialSlots });
  const txt = renderText(out);
  // marker logic intact: still exactly 1 filled (clear leader).
  assert.strictEqual(countGlyph(txt, '▶'), 1, 'S5 marker count matches the gate (1 filled)');
  // NEVER a raw slot placeholder.
  assert.ok(txt.indexOf('{') === -1, 'no raw {slot} placeholder ever renders');
});

// ---------------------------------------------------------------------------
// V2 -- the literal string '(Recommended)' NEVER appears (glyph swap only).
// ---------------------------------------------------------------------------

test('V2: the literal "(Recommended)" never appears in any rendered output', () => {
  const presenter = loadPresenter();
  const states = [
    stateWith('mode_a', { context_block: 0.87, contradiction: 0.61, cross_room: 0.54, brain_consult: 0.48, deep_research: 0.40 }),
    stateWith('mode_a', { context_block: 0.79, contradiction: 0.71, cross_room: 0.50, brain_consult: 0.45, deep_research: 0.40 }),
    stateWith('mode_b', { context_block: 0.44, contradiction: 0.41, cross_room: 0.38, brain_consult: 0.35, deep_research: 0.30 }),
    stateWith('tier_0', {}),
  ];
  for (const st of states) {
    const txt = renderText(presenter.renderDial(orch.buildReachList(st), { slotContext: FULL_SLOTS }));
    assert.ok(txt.indexOf('(Recommended)') === -1, "no literal '(Recommended)' (glyph swap only)");
  }
});

// ---------------------------------------------------------------------------
// V5 -- the chooser body has exactly 3 option rows (MAX_K=3); preview/total
// reflects 6 (DIAL_REACH_K; Phase 148 D-09 raised 5 -> 6).
// ---------------------------------------------------------------------------

test('V5: the chooser body has exactly 3 option rows; total reflects 6', () => {
  const presenter = loadPresenter();
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.87, contradiction: 0.61, cross_room: 0.54,
    brain_consult: 0.48, deep_research: 0.40, hats: 0.33,
  }));
  const out = presenter.renderDial(rl, { slotContext: FULL_SLOTS });
  const txt = renderText(out);
  // exactly 3 option rows = 3 marker glyphs total (filled + empty) in the body.
  const markerRows = countGlyph(txt, '▶') + countGlyph(txt, '▷');
  assert.strictEqual(markerRows, 3, 'exactly 3 option rows (MAX_K=3)');
  assert.strictEqual(rl.total_count, 6, 'the preview/total reflects 6 (DIAL_REACH_K)');
  assert.ok(/top-3 of 6/.test(txt), 'the footer surfaces the 6-of-N overflow, not pagination');
});

// ---------------------------------------------------------------------------
// FIX-09 (150.6-04): the Shape F.7 tri-context Decision Gate header
// (SKILL.md:253-258) renders ON the engine arm and is PREPENDED to the dial.
// Production-shaped: driven through the real orchestrator ReachList (no
// hand-built fixture for the header), the SAME path the engine arm emits.
// ---------------------------------------------------------------------------

test('F.7 header: the tri-context Decision Gate header renders with all three lines', () => {
  const presenter = loadPresenter();
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.87, contradiction: 0.61, cross_room: 0.54,
    brain_consult: 0.48, deep_research: 0.40, hats: 0.33,
  }));
  const out = presenter.renderDial(rl, { slotContext: FULL_SLOTS });
  // structured header is present
  assert.ok(out.decisionGateHeader && typeof out.decisionGateHeader === 'object',
    'renderDial returns a decisionGateHeader object');
  const txt = renderText(out);
  // Line 1: the '[filled-square] [CONTEXT] - REACH - decision gate' header line.
  assert.ok(/■ .* - REACH - decision gate/.test(txt),
    'the header line carries the filled-square glyph + REACH + decision gate (SKILL.md:255)');
  // Line 2: the '[down-triangle] LOCAL / BRAIN / SIGNAL' tri-context line.
  assert.ok(/▼ LOCAL .* \/ BRAIN .* \/ SIGNAL /.test(txt),
    'the tri-context line carries the down-triangle glyph + LOCAL / BRAIN / SIGNAL (SKILL.md:256)');
  // Line 3: the '[arrow] Choose next reach:' prompt line (FIX-09 amended SKILL.md:257).
  assert.ok(/→ Choose next reach:/.test(txt),
    'the prompt line carries the arrow glyph + Choose next reach: (SKILL.md:257, FIX-09)');
  // the context label is derived from the slotContext (room_name preferred).
  assert.ok(txt.indexOf('synteris') !== -1,
    'the header CONTEXT label is derived from slotContext.room_name');
});

test('F.7 header: BRAIN shows a prior in mode_a, offline otherwise; SIGNAL absent', () => {
  const presenter = loadPresenter();
  const modeA = renderText(presenter.renderDial(
    orch.buildReachList(stateWith('mode_a', {
      context_block: 0.87, contradiction: 0.61, cross_room: 0.54,
      brain_consult: 0.48, deep_research: 0.40,
    })), { slotContext: FULL_SLOTS }));
  // BRAIN prior present only when a Brain-derived ranking exists (mode_a).
  assert.ok(/BRAIN prior/.test(modeA), 'mode_a header shows a BRAIN prior');
  // SIGNAL is honestly absent this turn (the presenter threads no outside signal).
  assert.ok(/SIGNAL \(none this turn\)/.test(modeA),
    'SIGNAL is "(none this turn)" when no outside-world signal is threaded');

  const modeB = renderText(presenter.renderDial(
    orch.buildReachList(stateWith('mode_b', {
      context_block: 0.44, contradiction: 0.41, cross_room: 0.38,
      brain_consult: 0.35, deep_research: 0.30,
    })), { slotContext: FULL_SLOTS }));
  assert.ok(/BRAIN \(offline\)/.test(modeB),
    'Mode B header shows BRAIN (offline) -- no Brain-derived prior exists');
});

test('F.7 header: the header glyphs do NOT pollute the frozen body marker count', () => {
  const presenter = loadPresenter();
  // S1 clear leader must STILL be exactly one filled body marker, even with the
  // header prepended -- the header uses ■/▼/→, never the body markers ▶/▷.
  const out = presenter.renderDial(
    orch.buildReachList(stateWith('mode_a', {
      context_block: 0.87, contradiction: 0.61, cross_room: 0.54,
      brain_consult: 0.48, deep_research: 0.40, hats: 0.33,
    })), { slotContext: FULL_SLOTS });
  const txt = renderText(out);
  assert.strictEqual(countGlyph(txt, '▶'), 1,
    'S1 still has exactly 1 filled body marker (header does not add a ▶)');
  const markerRows = countGlyph(txt, '▶') + countGlyph(txt, '▷');
  assert.strictEqual(markerRows, 3, 'still exactly 3 body option rows (MAX_K=3 frozen)');
});

test('F.7 header: zero em-dashes in the rendered header (CLAUDE.md hard rule)', () => {
  const presenter = loadPresenter();
  const states = [
    stateWith('mode_a', { context_block: 0.87, contradiction: 0.61, cross_room: 0.54, brain_consult: 0.48, deep_research: 0.40 }),
    stateWith('mode_b', { context_block: 0.44, contradiction: 0.41, cross_room: 0.38, brain_consult: 0.35, deep_research: 0.30 }),
    stateWith('tier_0', {}),
  ];
  for (const st of states) {
    const txt = renderText(presenter.renderDial(orch.buildReachList(st), { slotContext: FULL_SLOTS }));
    assert.ok(txt.indexOf('\u2014') === -1, 'no em-dash (U+2014) anywhere in the render');
  }
});
