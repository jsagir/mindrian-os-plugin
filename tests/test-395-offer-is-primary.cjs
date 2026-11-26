'use strict';
// Phase 395-06: the per-turn offer is the primary of the one selector.
// Plain Node script. Exit 0 when all checks pass, 1 when one fails. One line per check: "ok:" or "FAIL:".
//
// Part A runs the real hook (scripts/intent-classifier.cjs) as a child process on a fixture room under an
// isolated home, as tests/test-395-hook-reaches-selector.cjs does. A preload file (written by this test into
// the isolated home, loaded with NODE_OPTIONS --require) wraps decide() and records the context and the offer.
// Part B calls resolveOffer() and decide() in this process with a context that this test builds.
// No network. Nothing is written outside the isolated home.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const HOOK = path.join(ROOT, 'scripts', 'intent-classifier.cjs');
const ENGINE = path.join(ROOT, 'lib', 'core', 'navigation-engine.cjs');
const OFFER = path.join(ROOT, 'lib', 'core', 'navigation-engine-offer.cjs');
const SWITCH = 'MINDRIAN_NAV_NO_PRIMARY_PIN';
const SESSION = 't395-06';

// The switch must not come from the shell that runs this test.
delete process.env[SWITCH];

const PRELOAD_SOURCE = [
  "'use strict';",
  "const fs = require('node:fs');",
  'const enginePath = process.env.T395_ENGINE_PATH;',
  'const outFile = process.env.T395_CAPTURE_FILE;',
  'if (enginePath && outFile) {',
  '  const eng = require(enginePath);',
  '  const real = eng.decide;',
  '  eng.decide = function (turn, ctx) {',
  '    const d = real(turn, ctx);',
  '    try {',
  '      const tc = ctx && Array.isArray(ctx.tierCandidates) && ctx.tierCandidates[0] && Array.isArray(ctx.tierCandidates[0].items)',
  '        ? ctx.tierCandidates[0].items.map(function (i) { return i.id; }) : null;',
  '      fs.writeFileSync(outFile, JSON.stringify({',
  '        operator: ctx ? ctx.operator : null,',
  '        tierIds: tc,',
  '        tierSource: ctx && ctx.tierCandidatesSource !== undefined ? ctx.tierCandidatesSource : null,',
  "        offerCommand: d && d.offer_next_step && typeof d.offer_next_step.command === 'string' ? d.offer_next_step.command : null,",
  '        offerIsNull: !d || d.offer_next_step === null,',
  "        why: d && d.decision_trace && typeof d.decision_trace.chosen_rationale === 'string' ? d.decision_trace.chosen_rationale : '',",
  '      }));',
  '    } catch (_e) { /* the capture is best effort */ }',
  '    return d;',
  '  };',
  '}',
  '',
].join('\n');

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('ok: ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + name + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_e) { return null; }
}

// A born fixture room (11 core sections) under its own isolated home.
function born(tag) {
  const iso = H.mkIsolatedHome('395p-' + tag);
  const b = H.birthFixtureRoom({ iso, slug: 'offer-' + tag, vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!b || b.ok !== true) throw new Error('fixture birth failed: ' + JSON.stringify(b));
  const roomDir = fs.realpathSync(b.roomDir);
  const preload = path.join(iso.home, 'capture-preload.cjs');
  fs.writeFileSync(preload, PRELOAD_SOURCE, 'utf8');
  return { iso, roomDir, preload, captureFile: path.join(iso.home, 'capture.json'), saved: path.join(iso.home, 'saved-state') };
}

function freshMinto(room, section, thought) {
  const nowIso = new Date().toISOString();
  fs.writeFileSync(path.join(room.roomDir, section, 'MINTO.md'), [
    '---',
    'governing_thought: "' + thought + '"',
    'reasoning_health_score: 0.85',
    'last_generated_at: "' + nowIso + '"',
    'last_artifact_write_seen_at: "' + nowIso + '"',
    '---',
    '',
  ].join('\n'), 'utf8');
}

function setActiveSection(room, value) {
  fs.mkdirSync(path.join(room.roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room.roomDir, '.mindrian', 'active-section.json'), JSON.stringify({ section: value }), 'utf8');
}

function setOperator(room, value) {
  const operator = require(path.join(ROOT, 'lib', 'conversation', 'operator.cjs'));
  const st = operator.getCurrent(room.roomDir);
  st.current = value;
  st.previous = 'JUST_TALK';
  fs.writeFileSync(path.join(room.roomDir, '.mindrian', 'conversation-operator.json'), JSON.stringify(st, null, 2), 'utf8');
}

// The 2 folders a hook turn writes in (the room and ~/.mindrian) are saved 1 time and put back before each hook
// run, so that 2 runs start from equal bytes.
function stateDirs(room) {
  return [
    { live: room.roomDir, copy: path.join(room.saved, 'room') },
    { live: path.join(room.iso.home, '.mindrian'), copy: path.join(room.saved, 'home-mindrian') },
  ];
}
function saveState(room) {
  fs.rmSync(room.saved, { recursive: true, force: true });
  fs.mkdirSync(room.saved, { recursive: true });
  stateDirs(room).forEach((d) => { if (fs.existsSync(d.live)) fs.cpSync(d.live, d.copy, { recursive: true }); });
}
function restoreState(room) {
  stateDirs(room).forEach((d) => {
    fs.rmSync(d.live, { recursive: true, force: true });
    if (fs.existsSync(d.copy)) fs.cpSync(d.copy, d.live, { recursive: true });
  });
}

// Runs the hook once on the room, from the saved state. Returns what the user's model and the side files got.
function runHook(room, switchOff) {
  restoreState(room);
  try { fs.unlinkSync(room.captureFile); } catch (_e) { /* no earlier capture */ }
  const env = Object.assign({}, room.iso.env, {
    MINDRIAN_ROOMS_ROOT: room.iso.roomsHome,
    MOS_NAV_TEST_DISABLE_DRAIN: '1',
    MINDRIAN_COPILOT_INJECT_FINDINGS: '0',
    MINDRIAN_VOICE_REMINDER: '0',
    MINDRIAN_NAV_NO_SUPPRESS: '1',
    NODE_OPTIONS: '--require "' + room.preload.replace(/\\/g, '/') + '"',
    T395_ENGINE_PATH: ENGINE,
    T395_CAPTURE_FILE: room.captureFile,
  });
  delete env[SWITCH];
  if (switchOff) env[SWITCH] = '1';
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ user_message: 'what should I do next here', session_id: SESSION }),
    env,
    encoding: 'utf8',
    cwd: room.roomDir,
    timeout: 20000,
  });
  const history = readJson(path.join(room.roomDir, '.mindrian', 'offer-history.json'));
  const traces = readJson(path.join(room.roomDir, '.mindrian', 'decision-traces', SESSION + '.json'));
  const lastTrace = traces && Array.isArray(traces.traces) && traces.traces.length ? traces.traces[traces.traces.length - 1] : null;
  return {
    status: res.status,
    stdout: res.stdout || '',
    capture: readJson(room.captureFile) || {},
    // QA-F12 D4 / plan 400.4-14: the cue is one record per session; the old global file is the fallback.
    statusCue: readJson(path.join(room.iso.home, '.mindrian', 'next-move', SESSION + '.json'))
      || readJson(path.join(room.iso.home, '.mindrian', 'next-move.json')),
    lastOffer: history && Array.isArray(history.history) && history.history.length ? history.history[history.history.length - 1] : null,
    lastTrace,
  };
}

function pref(id) { return '/mos:' + String(id).replace(/^\/mos:/, ''); }

// What the selector returns for the section on the cli surface, in the id form decide() writes.
function selectorIds(roomDir, section) {
  const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  const nm = NM.nextMoveForSection({ roomDir, sectionDir: path.join(roomDir, section), surface: 'cli' });
  const tier = nm && nm.primary ? NM.toTierCandidates(nm) : null;
  return {
    primary: nm && nm.primary ? pref(nm.primary.command) : null,
    ids: tier ? tier[0].items.map((i) => pref(i.id)) : [],
  };
}

const ranker = require(path.join(ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));
const tier = (ids) => [{ source: 'feyminto_face', items: ids.map((id) => ({ id, confidence: null, source: 'feyminto_face' })) }];

// The first command of the fused ranker list for these selector ids: the offer of the code before this plan.
function fusedTop(ids) {
  const rows = ranker.rankForSelector({ k: 3, roomState: {}, isAdmin: false, tierCandidates: tier(ids) });
  return rows.length ? rows[0].command : null;
}

try {
  // ================= Part A: the real hook =========================================================================
  // The fixture section: one whose selector primary is NOT the first command of the fused list. It is found live,
  // so a new selector order or a new registry gives a clear message and not a false result.
  const rA = born('a');
  const sections = fs.readdirSync(rA.roomDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name[0] !== '.').map((d) => d.name).sort();
  let SEC = null;
  let wantA = null;
  let oldTopA = null;
  for (const s of sections) {
    const w = selectorIds(rA.roomDir, s);
    if (!w.primary || w.ids.length < 2) continue;
    const top = fusedTop(w.ids);
    if (top && top !== w.primary && w.ids.indexOf(top) !== -1) { SEC = s; wantA = w; oldTopA = top; break; }
  }

  check('A0. precondition: a born room has a section whose selector primary is not the first fused command', () => {
    assert.ok(SEC, 'no section of the born room has a fused top that differs from the selector primary; this test needs 1');
  });

  if (SEC) {
    setActiveSection(rA, SEC);
    freshMinto(rA, SEC, 'New hires wait too long to be useful');
    require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs')).setCurrent(rA.roomDir, { jtbd: 'find-problem', confidence: 0.9, trigger: 'test-395-06' });
    setOperator(rA, 'DECISION_GATE');
    saveState(rA);
    const on = runHook(rA, false);

    check('A1. on an offer turn the offer in the block is the selector primary', () => {
      assert.strictEqual(on.status, 0, 'hook exit code');
      assert.strictEqual(on.capture.tierSource, 'feyminto_face', 'the selector ran');
      assert.deepStrictEqual(on.capture.tierIds, wantA.ids, 'the hook gave decide() the selector ids in the selector order');
      assert.strictEqual(on.capture.offerCommand, wantA.primary, 'decide() offer');
      assert.ok(on.stdout.indexOf('offer_next_step: {command: ' + wantA.primary + ',') !== -1, 'the block field prints the primary');
      assert.ok(on.stdout.indexOf('offer_next_step: {command: ' + oldTopA + ',') === -1, 'the block field does not print the old fused top ' + oldTopA);
    });

    check('A2. the offer line, the status line cue, the offer history and the decision trace name the primary', () => {
      assert.ok(on.stdout.split('\n').some((l) => l.indexOf('Offer: ') === 0 && l.slice(-(', try ' + wantA.primary + '.').length) === ', try ' + wantA.primary + '.'), 'the Offer line ends with the primary');
      assert.ok(on.statusCue && on.statusCue.command === wantA.primary, 'next-move.json command, got ' + JSON.stringify(on.statusCue));
      assert.ok(on.lastOffer && on.lastOffer.command === wantA.primary && on.lastOffer.outcome === 'shown', 'offer-history.json last entry, got ' + JSON.stringify(on.lastOffer));
      assert.ok(on.lastTrace && typeof on.lastTrace.offer_rendered === 'string' && on.lastTrace.offer_rendered.indexOf('try ' + wantA.primary + '.') !== -1, 'decision trace offer_rendered');
    });

    check('A3. the reason of the offer is built for the primary (its registry summary), with the section link', () => {
      const reg = readJson(path.join(ROOT, 'data', 'command-registry.json'));
      const row = (reg.commands || []).find((c) => c.command === wantA.primary);
      assert.ok(row && typeof row.jtbd_summary === 'string' && row.jtbd_summary.length > 0, 'precondition: the primary has a registry summary');
      const line = on.stdout.split('\n').find((l) => l.indexOf('offer_next_step: ') === 0) || '';
      assert.ok(line.indexOf(row.jtbd_summary.trim()) !== -1, 'the reason holds the summary of the primary');
      assert.ok(line.indexOf('[[' + path.join(rA.roomDir, SEC) + ']]') !== -1, 'the reason holds the section link');
    });

    const off = runHook(rA, true);
    check('A4. quiet switch: with ' + SWITCH + '=1 the offer is the old fused top', () => {
      assert.strictEqual(off.status, 0, 'hook exit code');
      assert.strictEqual(off.capture.offerCommand, oldTopA, 'decide() offer with the switch');
      assert.ok(off.stdout.indexOf('offer_next_step: {command: ' + oldTopA + ',') !== -1, 'the block prints the old fused top');
    });

    // The default operator: no offer, and the whole stdout is byte-identical with the change on and off.
    setOperator(rA, 'JUST_TALK');
    saveState(rA);
    const talkOn = runHook(rA, false);
    const talkOff = runHook(rA, true);
    check('A5. default operator JUST_TALK: no offer, and stdout is byte-identical with the change on and off', () => {
      assert.strictEqual(talkOn.capture.operator, 'JUST_TALK', 'the hook saw the default operator');
      assert.strictEqual(talkOn.capture.tierSource, 'feyminto_face', 'the selector ran');
      assert.strictEqual(talkOn.capture.offerIsNull, true, 'decide() made no offer');
      assert.ok(talkOn.stdout.indexOf('\noffer_next_step: null\n') !== -1, 'the block prints offer_next_step: null');
      assert.ok(talkOn.stdout.indexOf('\nOffer: ') === -1, 'no Offer line');
      assert.ok(talkOn.stdout.length > 0 && talkOn.stdout === talkOff.stdout, 'stdout equal: ' + talkOn.stdout.length + ' against ' + talkOff.stdout.length + ' bytes');
    });

    // An operator that is silent by default: no offer on this room (the margin is under the strong signal bar).
    setOperator(rA, 'EXPLORE_CAPTURE');
    saveState(rA);
    const explore = runHook(rA, false);
    check('A6. operator EXPLORE_CAPTURE with an ordinary signal: still no offer', () => {
      assert.strictEqual(explore.capture.operator, 'EXPLORE_CAPTURE', 'the hook saw the operator');
      assert.strictEqual(explore.capture.tierSource, 'feyminto_face', 'the selector ran');
      assert.strictEqual(explore.capture.offerIsNull, true, 'decide() made no offer');
    });
  }

  // ---- A7, A8: the framework chain composer (the second writer of the offer) --------------------------------------
  const rC = born('c');
  const CSEC = 'problem-definition';
  const wantC = selectorIds(rC.roomDir, CSEC);
  setActiveSection(rC, CSEC);
  freshMinto(rC, CSEC, 'The Beautiful Question run is done: new hires wait too long');
  const brainPath = path.join(rC.roomDir, CSEC, 'BRAIN.md');
  let brainText = '';
  try { brainText = fs.readFileSync(brainPath, 'utf8'); } catch (_e) { brainText = ''; }
  fs.writeFileSync(brainPath, brainText + '\n## Framework Chain Predictions\n\nBeautiful Question FEEDS_INTO Lean Canvas (confidence: 0.85)\n', 'utf8');
  saveState(rC);
  const chainOff = runHook(rC, true);
  const chainOn = runHook(rC, false);

  check('A7. precondition and switch: with the switch the chain composer fills the empty offer with its own command', () => {
    assert.ok(typeof wantC.primary === 'string' && wantC.primary !== '/mos:lean-canvas', 'precondition: the selector primary of ' + CSEC + ' is not /mos:lean-canvas, got ' + wantC.primary);
    assert.strictEqual(chainOff.capture.tierSource, 'feyminto_face', 'the selector ran');
    assert.strictEqual(chainOff.capture.offerCommand, '/mos:lean-canvas', 'the chain offer of the old code');
  });

  check('A8. a chain proposal for a command that is not the selector primary does not become the offer', () => {
    assert.strictEqual(chainOn.status, 0, 'hook exit code');
    assert.strictEqual(chainOn.capture.tierSource, 'feyminto_face', 'the selector ran');
    assert.strictEqual(chainOn.capture.offerIsNull, true, 'decide() made no offer');
    assert.ok(chainOn.stdout.indexOf('\noffer_next_step: null\n') !== -1, 'the block prints offer_next_step: null');
    assert.ok(chainOn.stdout.indexOf('/mos:lean-canvas') === -1, 'the block does not name the chain command');
    assert.ok(String(chainOn.capture.why).indexOf('Chain proposal held: the section selector names another primary.') !== -1, 'the rationale says why');
  });

  // ================= Part B: resolveOffer() and decide() in this process ==========================================
  const offerMod = require(OFFER);
  const engine = require(ENGINE);

  // 3 commands that the ranker lets through, in the order of the unsteered ranker. A selector list [P3, P2, P1]
  // has a fused order that starts with P1 (checked in B1).
  const plain = ranker.rankForSelector({ k: 3, roomState: {}, isAdmin: false });
  const P1 = plain[0] && plain[0].command;
  const P2 = plain[1] && plain[1].command;
  const P3 = plain[2] && plain[2].command;
  function offerCtx(extra) {
    return Object.assign({
      operator: 'DECISION_GATE',
      jtbd: 'find-problem',
      sectionPath: 'problem-definition',
      quadruple: { reasoning: { governing_thought: 'New hires wait too long to be useful', is_stale: false } },
      brainAvailable: false,
      roomState: {},
      tierCandidates: tier([P3, P2, P1]),
      tierCandidatesSource: 'feyminto_face',
    }, extra || {});
  }
  const cmd = (o) => (o && typeof o.command === 'string' ? o.command : null);

  check('B1. resolveOffer: the offer is the first selector id, not the first fused row', () => {
    assert.ok(P1 && P2 && P3, 'precondition: the ranker returns 3 rows');
    assert.strictEqual(fusedTop([P3, P2, P1]), P1, 'precondition: the fused order of [P3, P2, P1] starts with P1');
    assert.strictEqual(cmd(offerMod.resolveOffer(offerCtx())), P3, 'the offer is P3, the selector primary');
  });

  check('B2. the offer keeps its 6 keys, and framework, reason and scope belong to the primary', () => {
    const o = offerMod.resolveOffer(offerCtx());
    assert.ok(o, 'an offer');
    assert.deepStrictEqual(Object.keys(o).sort(), ['command', 'confidence', 'framework', 'jtbd', 'reason', 'scope'], 'the 6 keys');
    assert.strictEqual(o.command, P3, 'command');
    assert.strictEqual(o.framework, plain[2].framework, 'framework of the primary');
    assert.ok(o.reason.indexOf(plain[2].jtbd_summary.trim()) !== -1, 'the reason holds the summary of the primary');
    assert.ok(o.reason.indexOf('[[problem-definition]]') === 0, 'the reason starts with the section link');
    assert.strictEqual(o.scope, 'problem-definition', 'scope');
    assert.ok(typeof o.confidence === 'number' && o.confidence >= 0 && o.confidence <= 1, 'confidence in 0..1');
  });

  check('B3. only the selector source pins: a list with another source, or with no source, keeps the first fused row', () => {
    assert.strictEqual(cmd(offerMod.resolveOffer(offerCtx({ tierCandidatesSource: undefined }))), P1, 'no source: the fused top');
    assert.strictEqual(cmd(offerMod.resolveOffer(offerCtx({ tierCandidatesSource: 'section_command_ledger' }))), P1, 'ledger source: the fused top');
  });

  check('B4. the abstention rules hold with a selector primary: operator modes and the margin floor', () => {
    assert.strictEqual(offerMod.resolveOffer(offerCtx({ operator: 'JUST_TALK' })), null, 'JUST_TALK: no offer');
    assert.strictEqual(offerMod.resolveOffer(offerCtx({ operator: 'EXPLORE_CAPTURE' })), null, 'EXPLORE_CAPTURE under the strong signal bar: no offer');
    assert.strictEqual(offerMod.resolveOffer(offerCtx({ operator: 'BUILD_ROOM' })), null, 'BUILD_ROOM under the strong signal bar: no offer');
    assert.strictEqual(offerMod.resolveOffer(offerCtx({ operator: 'SOMETHING_ELSE' })), null, 'an unknown operator: no offer');
    assert.strictEqual(offerMod.resolveOffer(offerCtx({ operator: undefined })), null, 'no operator: no offer');
    assert.strictEqual(offerMod.resolveOffer(offerCtx({ jtbd: null })), null, 'margin under 0.15 (no job cue): no offer');
    assert.strictEqual(cmd(offerMod.resolveOffer(offerCtx({ operator: 'METHODOLOGY' }))), P3, 'METHODOLOGY: the primary');
  });

  check('B5. rejection backoff: a rejected primary is not offered, and a rejected fused top gives no offer as before', () => {
    const rejected = (c) => { const m = {}; m[c] = 0; return { invocationsSinceDecision: m }; };
    assert.strictEqual(offerMod.resolveOffer(offerCtx({ roomState: rejected(P3) })), null, 'the primary P3 was rejected: no offer');
    assert.strictEqual(offerMod.resolveOffer(offerCtx({ roomState: rejected(P1) })), null, 'the fused top P1 was rejected: no offer, as before');
    assert.strictEqual(cmd(offerMod.resolveOffer(offerCtx({ roomState: rejected(P2) }))), P3, 'another command was rejected: the primary');
  });

  check('B6. a primary with no row in the ranked list is never the offer: the first fused row stays, as before', () => {
    const ghost = '/mos:t395-not-a-command';
    const got = cmd(offerMod.resolveOffer(offerCtx({ tierCandidates: tier([ghost, P3]) })));
    assert.strictEqual(fusedTop([ghost, P3]), P3, 'precondition: the only known id of the list is the fused top');
    assert.strictEqual(got, P3, 'an unknown primary: the first fused row');
    const reg = readJson(path.join(ROOT, 'data', 'command-registry.json'));
    const noText = (reg.commands || []).find((c) => !(typeof c.teaching === 'string' && c.teaching.length > 0) || !(typeof c.jtbd_summary === 'string' && c.jtbd_summary.length > 0));
    assert.ok(noText && typeof noText.command === 'string', 'precondition: the registry has a command that the ranker drops (no teaching text or no summary)');
    assert.strictEqual(cmd(offerMod.resolveOffer(offerCtx({ tierCandidates: tier([noText.command, P3]) }))), P3, 'a primary the ranker drops (' + noText.command + '): the first fused row');
  });

  check('B7. quiet switch in this process: with ' + SWITCH + '=1 resolveOffer gives the first fused row', () => {
    process.env[SWITCH] = '1';
    let got;
    try { got = cmd(offerMod.resolveOffer(offerCtx())); } finally { delete process.env[SWITCH]; }
    assert.strictEqual(got, P1, 'the fused top with the switch');
    assert.strictEqual(cmd(offerMod.resolveOffer(offerCtx())), P3, 'the primary again with no switch');
  });

  // decide() with a chain proposal. The context gives its own selector list (the test seam of decide()).
  function chainQuadruple() {
    return {
      room: { exists: true, identity_text: 'fixture', references: [] },
      state: { exists: true, artifact_count: 1, completeness_score: 0.5 },
      reasoning: { exists: true, governing_thought: 'After our Business Model Canvas work we mapped the value flows.', reasoning_health_score: 0.7, is_stale: false, arguments: [] },
      brain: {
        exists: true, section: 'business-model', brain_generated_at: '2026-04-27T12:00:00Z', brain_graph_version: 1,
        governing_thought_hash: 'sha256:fixture', staleness: 'fresh', stale_reason: null, author: 'brain', confidence_baseline: 0.5, parse_failed: false,
        sections: {
          pattern_matches: null,
          framework_chain_predictions: { body: 'Business Model Canvas FEEDS_INTO Lean Canvas (confidence: 0.85)', tokens_estimate: 20 },
          cross_domain_analogies: null, wicked_indicators: null, unfilled_opportunity_matches: null,
          assessment_thinking_chain_position: null, problemtype_classification: null, flagged_contradictions_xroom: null, hsi_signals: null,
        },
        flagged_weaknesses: [],
      },
    };
  }
  function chainDecide(extra) {
    const ctx = Object.assign({ quadruple: chainQuadruple(), brainAvailable: true, userPersona: null, intentSignal: null }, extra || {});
    const d = engine.decide({ sectionPath: '/tmp/t395-fixture', sessionId: 's395' }, ctx);
    return { offer: d.offer_next_step, why: (d.decision_trace && d.decision_trace.chosen_rationale) || '' };
  }

  check('B8. decide(): the chain composer still offers with no selector list, with another source, and for the primary', () => {
    const none = chainDecide();
    assert.strictEqual(cmd(none.offer), '/mos:lean-canvas', 'no selector list: the chain offer, as before');
    assert.ok(/FEEDS_INTO/.test(none.offer.reason), 'the chain reason');
    const ledger = chainDecide({ tierCandidates: tier([P3, P2]), tierCandidatesSource: 'section_command_ledger' });
    assert.strictEqual(cmd(ledger.offer), '/mos:lean-canvas', 'a list that is not from the selector: the chain offer, as before');
    const same = chainDecide({ tierCandidates: tier(['/mos:lean-canvas', P2]), tierCandidatesSource: 'feyminto_face' });
    assert.strictEqual(cmd(same.offer), '/mos:lean-canvas', 'the chain command is the selector primary: offered');
    assert.ok(same.why.indexOf('Chain proposal held') === -1, 'no held sentence');
  });

  check('B9. decide(): a chain command that is not the selector primary is held, and the switch lets it pass', () => {
    const held = chainDecide({ tierCandidates: tier([P3, '/mos:lean-canvas']), tierCandidatesSource: 'feyminto_face' });
    assert.strictEqual(held.offer, null, 'no offer');
    assert.ok(held.why.indexOf('Chain proposal held: the section selector names another primary.') !== -1, 'the rationale says why');
    process.env[SWITCH] = '1';
    let open;
    try { open = chainDecide({ tierCandidates: tier([P3, '/mos:lean-canvas']), tierCandidatesSource: 'feyminto_face' }); } finally { delete process.env[SWITCH]; }
    assert.strictEqual(cmd(open.offer), '/mos:lean-canvas', 'the chain offer with the switch');
  });

  check('B10. the frozen values are the same: MAX_K 3, DIAL_REACH_K 6, 0.70, 0.15, and the 2 offer floors', () => {
    const f = engine.frozenConstitutionalSet();
    assert.strictEqual(f.MAX_K, 3, 'MAX_K');
    assert.strictEqual(f.DIAL_REACH_K, 6, 'DIAL_REACH_K');
    assert.strictEqual(f.RECOMMEND_FLOOR, 0.70, 'RECOMMEND_FLOOR');
    assert.strictEqual(f.MARGIN_THRESHOLD, 0.15, 'MARGIN_THRESHOLD');
    assert.strictEqual(offerMod.MARGIN_THRESHOLD, 0.15, 'offer MARGIN_THRESHOLD');
    assert.strictEqual(offerMod.STRONG_SIGNAL_THRESHOLD, 0.30, 'offer STRONG_SIGNAL_THRESHOLD');
    assert.ok(ranker.rankForSelector({ k: 20, roomState: {}, tierCandidates: tier([P3, P2, P1]) }).length <= 3, 'the ranker still returns at most 3 rows');
  });

  // The tier_0 step of resolveOffer picks a row of the minimal verb set when the ranked list holds one. No shipped
  // command is in that set today, so the ranked rows are stubbed for this 1 check (the export is put back after).
  check('B11. tier_0: a minimal verb in the ranked rows wins over the selector primary; with none, the primary is offered', () => {
    const shared = require(path.join(ROOT, 'lib', 'core', 'navigation-engine-shared.cjs'));
    const base = offerCtx();
    assert.strictEqual(shared.resolveTierMode(base.quadruple, base.brainAvailable), 'tier_0', 'precondition: the fixture context is tier_0');
    const row = (c) => ({ command: c, score: 0.5, jtbd_summary: 'A fixture summary for ' + c, jtbd_label: 'Fixture', framework: 'Fixture' });
    const real = ranker.rankForSelector;
    let withMinimal;
    let withoutMinimal;
    try {
      ranker.rankForSelector = () => [row('/mos:t395-first'), row('/mos:reformulate'), row('/mos:t395-primary')];
      withMinimal = cmd(offerMod.resolveOffer(offerCtx({ tierCandidates: tier(['/mos:t395-primary', '/mos:reformulate']) })));
      ranker.rankForSelector = () => [row('/mos:t395-first'), row('/mos:t395-second'), row('/mos:t395-primary')];
      withoutMinimal = cmd(offerMod.resolveOffer(offerCtx({ tierCandidates: tier(['/mos:t395-primary', '/mos:t395-second']) })));
    } finally { ranker.rankForSelector = real; }
    assert.strictEqual(withMinimal, '/mos:reformulate', 'the minimal verb is the offer');
    assert.strictEqual(withoutMinimal, '/mos:t395-primary', 'no minimal verb: the selector primary');
  });

  // ---- dash guard on this file ------------------------------------------------------------------------------------
  check('C1. no em dash and no en dash in this test file', () => {
    assert.deepStrictEqual(H.dashGuard([__filename]), [], 'dash guard');
  });
} catch (e) {
  failed += 1;
  console.log('FAIL: setup -- ' + (e && e.stack ? e.stack : String(e)));
}

console.log(failed === 0 ? 'PASSED: all checks' : 'FAILED: ' + failed + ' check(s)');
process.exit(failed === 0 ? 0 : 1);
