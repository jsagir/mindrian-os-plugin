'use strict';
// Phase 395-08: engine findings carried from the cold check of 395-06.
// Plain Node script. Exit 0 when all checks pass, 1 when one fails. One line per check: "ok:" or "FAIL:".
//
// Part A runs the real hook (scripts/intent-classifier.cjs) as a child process on a fixture room under an
// isolated home, as tests/test-395-offer-is-primary.cjs does. A preload file (written by this test into the
// isolated home, loaded with NODE_OPTIONS --require) wraps decide() and records the context and the offer.
// Part B calls resolveOffer(), decide() and selectorIds() in this process.
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
const SESSION = 't395-08';
const FROM = 'Beautiful Question';
const NO_COMMAND_FRAMEWORK = 'Business Model Canvas';

const S_OTHER = 'Chain proposal held: the section selector names another primary.';
const S_ALT = S_OTHER + ' The selector lists the command of this chain step as an alternative.';
const S_NONE = 'Chain step held: this framework has no command to offer, and the section selector names the next move.';
const fact = (from, to) => 'Framework chain: ' + from + ' FEEDS_INTO ' + to + ' (Brain confidence 0.85, held). ';
const openFact = (from, to) => 'Framework chain: ' + from + ' FEEDS_INTO ' + to + ' (Brain confidence 0.85).';

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
  '        tierIds: tc,',
  '        tierSource: ctx && ctx.tierCandidatesSource !== undefined ? ctx.tierCandidatesSource : null,',
  "        theoAsked: ctx && ctx.tierCandidatesTheoAsked !== undefined ? ctx.tierCandidatesTheoAsked : 'not set',",
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
  const iso = H.mkIsolatedHome('395e-' + tag);
  const b = H.birthFixtureRoom({ iso, slug: 'carried-' + tag, vname: 'Heron Tide', ventureText: 'Heron Tide tidal sensors for small harbours' });
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

// Runs the hook once on the room, from the saved state. Returns what the user's model got and what decide() saw.
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
  const stdout = res.stdout || '';
  return {
    status: res.status,
    stdout,
    whyLine: stdout.split('\n').find((l) => l.indexOf('Why: ') === 0) || '',
    capture: readJson(room.captureFile) || {},
  };
}

function pref(id) { return '/mos:' + String(id).replace(/^\/mos:/, ''); }

// What the selector returns for the section on the cli surface, in the id form decide() writes.
function selectorIdsOf(roomDir, section) {
  const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  const nm = NM.nextMoveForSection({ roomDir, sectionDir: path.join(roomDir, section), surface: 'cli' });
  const tier = nm && nm.primary ? NM.toTierCandidates(nm) : null;
  return tier ? tier[0].items.map((i) => pref(i.id)) : [];
}

const resolver = require(path.join(ROOT, 'lib', 'workflow', 'command-resolver.cjs'));
const ranker = require(path.join(ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));
const tier = (ids) => [{ source: 'feyminto_face', items: ids.map((id) => ({ id, confidence: null, source: 'feyminto_face' })) }];
const firstCommandOf = (framework) => { const c = resolver.commandsForFramework(framework); return c.length > 0 ? c[0] : null; };

// The chain line that the hook reads from BRAIN.md of the section.
function writeChain(room, section, baseText, to) {
  fs.writeFileSync(path.join(room.roomDir, section, 'BRAIN.md'),
    baseText + '\n## Framework Chain Predictions\n\n' + FROM + ' FEEDS_INTO ' + to + ' (confidence: 0.85)\n', 'utf8');
}

try {
  // ================= Part A: the real hook =========================================================================
  const rC = born('c');
  const CSEC = 'problem-definition';
  const idsC = selectorIdsOf(rC.roomDir, CSEC);
  setActiveSection(rC, CSEC);
  freshMinto(rC, CSEC, 'The ' + FROM + ' run is done: harbour masters wait for tide data');
  let brainBase = '';
  try { brainBase = fs.readFileSync(path.join(rC.roomDir, CSEC, 'BRAIN.md'), 'utf8'); } catch (_e) { brainBase = ''; }

  // ---- class 1: the chain command is not a selector id ------------------------------------------------------------
  writeChain(rC, CSEC, brainBase, 'Lean Canvas');
  saveState(rC);
  const other = runHook(rC, false);
  const otherOff = runHook(rC, true);

  check('A1. a chain command that is not a selector id is held, and the chain fact stays in the Why line, marked as held', () => {
    assert.ok(idsC.length > 0 && idsC.indexOf('/mos:lean-canvas') === -1, 'precondition: /mos:lean-canvas is not a selector id of ' + CSEC + ', got ' + idsC.join(', '));
    assert.strictEqual(other.status, 0, 'hook exit code');
    assert.strictEqual(other.capture.tierSource, 'feyminto_face', 'the selector ran');
    assert.strictEqual(other.capture.offerIsNull, true, 'decide() made no offer');
    assert.ok(other.stdout.indexOf('\noffer_next_step: null\n') !== -1, 'the block prints offer_next_step: null');
    assert.ok(other.whyLine.indexOf(fact(FROM, 'Lean Canvas') + S_OTHER) !== -1, 'the Why line holds the held chain fact and the sentence, got: ' + other.whyLine);
    assert.ok(other.whyLine.indexOf(S_ALT) === -1 && other.whyLine.indexOf(S_NONE) === -1, 'no sentence of another class');
    assert.ok(other.stdout.indexOf('/mos:lean-canvas') === -1, 'the block does not name the chain command');
  });

  check('A2. quiet switch: with ' + SWITCH + '=1 the chain offer and the plain chain sentence are back', () => {
    assert.strictEqual(otherOff.status, 0, 'hook exit code');
    assert.strictEqual(otherOff.capture.offerCommand, '/mos:lean-canvas', 'the chain offer');
    assert.ok(otherOff.whyLine.indexOf(openFact(FROM, 'Lean Canvas')) !== -1, 'the plain chain sentence, got: ' + otherOff.whyLine);
    assert.ok(otherOff.whyLine.indexOf('held') === -1, 'no held text with the switch');
  });

  // ---- class 2: the next framework of the chain has no command ----------------------------------------------------
  writeChain(rC, CSEC, brainBase, NO_COMMAND_FRAMEWORK);
  saveState(rC);
  const none = runHook(rC, false);

  check('A3. a chain step with no command: no offer, the chain fact is kept, and the sentence does not say "another primary"', () => {
    assert.strictEqual(firstCommandOf(NO_COMMAND_FRAMEWORK), null, 'precondition: the registry has no command for ' + NO_COMMAND_FRAMEWORK);
    assert.strictEqual(none.status, 0, 'hook exit code');
    assert.strictEqual(none.capture.tierSource, 'feyminto_face', 'the selector ran');
    assert.strictEqual(none.capture.offerIsNull, true, 'decide() made no offer');
    assert.ok(none.stdout.indexOf('\noffer_next_step: null\n') !== -1, 'the block prints offer_next_step: null');
    assert.ok(none.whyLine.indexOf(fact(FROM, NO_COMMAND_FRAMEWORK) + S_NONE) !== -1, 'the Why line holds the held chain fact and the no-command sentence, got: ' + none.whyLine);
    assert.ok(none.whyLine.indexOf('another primary') === -1, 'the sentence about another primary is not printed');
  });

  // ---- class 3: the chain command is a selector alternative -------------------------------------------------------
  // Found live: a section, and a framework whose first command is the second or third selector id of that section.
  const sections = fs.readdirSync(rC.roomDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name[0] !== '.').map((d) => d.name).sort();
  const frameworks = Object.keys((readJson(path.join(ROOT, 'data', 'command-registry.json')) || {}).framework_index || {}).sort();
  let ASEC = null;
  let ATO = null;
  let ACMD = null;
  let idsA = [];
  for (const s of sections) {
    const ids = selectorIdsOf(rC.roomDir, s);
    for (const f of frameworks) {
      if (f.toLowerCase().indexOf(FROM.toLowerCase()) !== -1) continue;
      const c = firstCommandOf(f);
      if (c && ids.indexOf(c) > 0) { ASEC = s; ATO = f; ACMD = c; idsA = ids; break; }
    }
    if (ASEC) break;
  }

  check('A4. a chain command that the selector lists as an alternative stays held (owner decision D1), and the Why line says it is an alternative', () => {
    assert.ok(ASEC, 'precondition: a born room has a section with a selector alternative that a framework resolves to');
    restoreState(rC);
    let baseA = '';
    try { baseA = fs.readFileSync(path.join(rC.roomDir, ASEC, 'BRAIN.md'), 'utf8').split('\n## Framework Chain Predictions')[0]; } catch (_e) { baseA = ''; }
    setActiveSection(rC, ASEC);
    freshMinto(rC, ASEC, 'The ' + FROM + ' run is done: harbour masters wait for tide data');
    writeChain(rC, ASEC, baseA, ATO);
    saveState(rC);
    const alt = runHook(rC, false);
    assert.strictEqual(alt.status, 0, 'hook exit code');
    assert.strictEqual(alt.capture.tierSource, 'feyminto_face', 'the selector ran');
    assert.deepStrictEqual(alt.capture.tierIds, idsA, 'the selector ids');
    assert.strictEqual(alt.capture.offerIsNull, true, 'decide() made no offer for the alternative ' + ACMD);
    assert.ok(alt.whyLine.indexOf(fact(FROM, ATO) + S_ALT) !== -1, 'the Why line holds the held chain fact and the alternative sentence, got: ' + alt.whyLine);
    assert.ok(alt.stdout.indexOf(ACMD + ',') === -1 && alt.stdout.indexOf('try ' + ACMD) === -1, 'the block does not offer the chain command');
  });

  // ================= Part B: in this process ======================================================================
  const offerMod = require(OFFER);
  const engine = require(ENGINE);
  const cmd = (o) => (o && typeof o.command === 'string' ? o.command : null);
  const plain = ranker.rankForSelector({ k: 3, roomState: {}, isAdmin: false });
  const P1 = plain[0] && plain[0].command;
  const P2 = plain[1] && plain[1].command;
  const P3 = plain[2] && plain[2].command;

  check('B1. selectorIds is the 1 reader of the selector list: the ids in order for the selector source, null for any other case', () => {
    assert.strictEqual(typeof offerMod.selectorIds, 'function', 'navigation-engine-offer.cjs exports selectorIds');
    assert.deepStrictEqual(offerMod.selectorIds({ tierCandidates: tier(['/mos:a', '/mos:b', '/mos:c']), tierCandidatesSource: 'feyminto_face' }), ['/mos:a', '/mos:b', '/mos:c'], 'the ids, the primary first');
    assert.strictEqual(offerMod.selectorIds({ tierCandidates: tier(['/mos:a']), tierCandidatesSource: 'section_command_ledger' }), null, 'another source');
    assert.strictEqual(offerMod.selectorIds({ tierCandidates: tier(['/mos:a']) }), null, 'no source');
    assert.strictEqual(offerMod.selectorIds({ tierCandidates: [{ source: 'feyminto_face', items: [{ id: null }, { id: '/mos:b' }] }], tierCandidatesSource: 'feyminto_face' }), null, 'a first item with no id');
    assert.strictEqual(offerMod.selectorIds({ tierCandidatesSource: 'feyminto_face' }), null, 'no list');
    assert.strictEqual(offerMod.selectorIds(null), null, 'no context');
    process.env[SWITCH] = '1';
    let got;
    try { got = offerMod.selectorIds({ tierCandidates: tier(['/mos:a']), tierCandidatesSource: 'feyminto_face' }); } finally { delete process.env[SWITCH]; }
    assert.strictEqual(got, null, 'the switch gives null');
  });

  check('B2. the switch is read in 1 place of the code and has its entry in docs/ENV-TUNING.md', () => {
    const hits = [];
    const walk = (dir) => {
      fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
        if (d.name === 'node_modules' || d.name[0] === '.') return;
        const p = path.join(dir, d.name);
        if (d.isDirectory()) { walk(p); return; }
        if (!/\.(cjs|js|mjs)$/.test(d.name) || /\.test\.cjs$/.test(d.name)) return;
        const n = fs.readFileSync(p, 'utf8').split('process.env.' + SWITCH).length - 1;
        if (n > 0) hits.push(path.relative(ROOT, p).split(path.sep).join('/') + ' x' + n);
      });
    };
    ['lib', 'scripts', 'bin', 'hooks'].forEach((d) => { if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d)); });
    assert.deepStrictEqual(hits, ['lib/core/navigation-engine-offer.cjs x1'], 'the files that read process.env.' + SWITCH);
    const doc = fs.readFileSync(path.join(ROOT, 'docs', 'ENV-TUNING.md'), 'utf8');
    assert.ok(doc.indexOf('\n### ' + SWITCH + '\n') !== -1, 'docs/ENV-TUNING.md has the heading of the switch');
    assert.ok(doc.indexOf('export ' + SWITCH + '=1') !== -1, 'docs/ENV-TUNING.md has the export line');
    const entry = doc.split('\n### ' + SWITCH + '\n')[1].split('\n## ')[0];
    ['**What:**', '**Default:**', '**Read:**', '**Why:**'].forEach((k) => assert.ok(entry.indexOf(k) !== -1, 'the entry has the field ' + k));
  });

  // The tier_0 step of resolveOffer picks a row of the minimal verb set when the ranked list holds one. No shipped
  // command is in that set today, so the ranked rows are stubbed for this 1 check (the export is put back after).
  function offerCtx(extra) {
    return Object.assign({
      operator: 'DECISION_GATE',
      jtbd: 'find-problem',
      sectionPath: 'problem-definition',
      quadruple: { reasoning: { governing_thought: 'Harbour masters wait for tide data', is_stale: false } },
      brainAvailable: false,
      roomState: {},
      tierCandidates: tier([P3, P2, P1]),
      tierCandidatesSource: 'feyminto_face',
    }, extra || {});
  }

  check('B3. tier_0: a minimal verb wins over the selector primary also when it is the TOP ranked row', () => {
    const shared = require(path.join(ROOT, 'lib', 'core', 'navigation-engine-shared.cjs'));
    const base = offerCtx();
    assert.strictEqual(shared.resolveTierMode(base.quadruple, base.brainAvailable), 'tier_0', 'precondition: the fixture context is tier_0');
    const row = (c) => ({ command: c, score: 0.5, jtbd_summary: 'A fixture summary for ' + c, jtbd_label: 'Fixture', framework: 'Fixture' });
    const real = ranker.rankForSelector;
    let minimalTop;
    let minimalTopOther;
    let minimalSecond;
    let noMinimal;
    let primaryTop;
    try {
      ranker.rankForSelector = () => [row('/mos:reformulate'), row('/mos:t395-second'), row('/mos:t395-primary')];
      minimalTop = cmd(offerMod.resolveOffer(offerCtx({ tierCandidates: tier(['/mos:t395-primary', '/mos:t395-second']) })));
      ranker.rankForSelector = () => [row('/mos:run-methodology'), row('/mos:t395-second'), row('/mos:t395-primary')];
      minimalTopOther = cmd(offerMod.resolveOffer(offerCtx({ tierCandidates: tier(['/mos:t395-primary', '/mos:t395-second']) })));
      ranker.rankForSelector = () => [row('/mos:t395-first'), row('/mos:reformulate'), row('/mos:t395-primary')];
      minimalSecond = cmd(offerMod.resolveOffer(offerCtx({ tierCandidates: tier(['/mos:t395-primary', '/mos:reformulate']) })));
      ranker.rankForSelector = () => [row('/mos:t395-first'), row('/mos:t395-second'), row('/mos:t395-primary')];
      noMinimal = cmd(offerMod.resolveOffer(offerCtx({ tierCandidates: tier(['/mos:t395-primary', '/mos:t395-second']) })));
      ranker.rankForSelector = () => [row('/mos:t395-primary'), row('/mos:t395-second'), row('/mos:t395-third')];
      primaryTop = cmd(offerMod.resolveOffer(offerCtx({ tierCandidates: tier(['/mos:t395-primary', '/mos:t395-second']) })));
    } finally { ranker.rankForSelector = real; }
    assert.strictEqual(minimalTop, '/mos:reformulate', 'the minimal verb is the top row: it is the offer');
    assert.strictEqual(minimalTopOther, '/mos:run-methodology', 'a second minimal verb as the top row: it is the offer');
    assert.strictEqual(minimalSecond, '/mos:reformulate', 'the minimal verb is row 2: it is the offer, as before');
    assert.strictEqual(noMinimal, '/mos:t395-primary', 'no minimal verb: the selector primary, as before');
    assert.strictEqual(primaryTop, '/mos:t395-primary', 'no minimal verb and the primary is the top row: the primary');
  });

  // decide() with a chain proposal. The context gives its own selector list (the test seam of decide()).
  const IN_FROM = 'Business Model Canvas';
  function chainQuadruple(to) {
    return {
      room: { exists: true, identity_text: 'fixture', references: [] },
      state: { exists: true, artifact_count: 1, completeness_score: 0.5 },
      reasoning: { exists: true, governing_thought: 'After our ' + IN_FROM + ' work we mapped the value flows.', reasoning_health_score: 0.7, is_stale: false, arguments: [] },
      brain: {
        exists: true, section: 'business-model', brain_generated_at: '2026-04-27T12:00:00Z', brain_graph_version: 1,
        governing_thought_hash: 'sha256:fixture', staleness: 'fresh', stale_reason: null, author: 'brain', confidence_baseline: 0.5, parse_failed: false,
        sections: {
          pattern_matches: null,
          framework_chain_predictions: { body: IN_FROM + ' FEEDS_INTO ' + to + ' (confidence: 0.85)', tokens_estimate: 20 },
          cross_domain_analogies: null, wicked_indicators: null, unfilled_opportunity_matches: null,
          assessment_thinking_chain_position: null, problemtype_classification: null, flagged_contradictions_xroom: null, hsi_signals: null,
        },
        flagged_weaknesses: [],
      },
    };
  }
  function chainDecide(to, extra) {
    const ctx = Object.assign({ quadruple: chainQuadruple(to), brainAvailable: true, userPersona: null, intentSignal: null }, extra || {});
    const d = engine.decide({ sectionPath: '/tmp/t395-fixture', sessionId: 's395' }, ctx);
    return { offer: d.offer_next_step, why: (d.decision_trace && d.decision_trace.chosen_rationale) || '' };
  }
  const NO_CMD_2 = 'Porter Five Forces';
  const sel = (ids) => ({ tierCandidates: tier(ids), tierCandidatesSource: 'feyminto_face' });

  check('B4. decide(): each of the 3 classes of a held chain proposal gets the chain fact and its own true sentence', () => {
    assert.ok(P2 && P3 && P2 !== '/mos:lean-canvas' && P3 !== '/mos:lean-canvas', 'precondition: P2 and P3 are not /mos:lean-canvas');
    assert.strictEqual(firstCommandOf('Lean Canvas'), '/mos:lean-canvas', 'precondition: Lean Canvas resolves to /mos:lean-canvas');
    assert.strictEqual(firstCommandOf(NO_CMD_2), null, 'precondition: the registry has no command for ' + NO_CMD_2);
    const o = chainDecide('Lean Canvas', sel([P3, P2]));
    assert.strictEqual(o.offer, null, 'not a selector id: no offer');
    assert.ok(o.why.indexOf(fact(IN_FROM, 'Lean Canvas') + S_OTHER) !== -1 && o.why.indexOf(S_ALT) === -1, 'not a selector id: fact and sentence, got: ' + o.why);
    const a = chainDecide('Lean Canvas', sel([P3, '/mos:lean-canvas']));
    assert.strictEqual(a.offer, null, 'a selector alternative: no offer (owner decision D1)');
    assert.ok(a.why.indexOf(fact(IN_FROM, 'Lean Canvas') + S_ALT) !== -1, 'a selector alternative: fact and sentence, got: ' + a.why);
    const a3 = chainDecide('Lean Canvas', sel([P3, P2, '/mos:lean-canvas']));
    assert.ok(a3.offer === null && a3.why.indexOf(S_ALT) !== -1, 'the third selector id is an alternative too');
    const n = chainDecide(NO_CMD_2, sel([P3, P2]));
    assert.strictEqual(n.offer, null, 'no command: no offer');
    assert.ok(n.why.indexOf(fact(IN_FROM, NO_CMD_2) + S_NONE) !== -1, 'no command: fact and sentence, got: ' + n.why);
    assert.ok(n.why.indexOf('another primary') === -1, 'no command: the sentence about another primary is not written');
    [o, a, n].forEach((r) => {
      const held = r.why.slice(r.why.indexOf('Framework chain: '));
      assert.ok(held.indexOf('/mos:') === -1, 'the held text names no command: ' + held);
      assert.strictEqual(r.why.split('Framework chain: ').length - 1, 1, 'the chain fact is written 1 time');
    });
  });

  check('B5. decide(): a proposal that is not held is as before: the selector primary, no selector list, and the switch', () => {
    const same = chainDecide('Lean Canvas', sel(['/mos:lean-canvas', P2]));
    assert.strictEqual(cmd(same.offer), '/mos:lean-canvas', 'the chain command is the selector primary: offered');
    assert.ok(same.why.indexOf(openFact(IN_FROM, 'Lean Canvas')) !== -1 && same.why.indexOf('held') === -1, 'the plain chain sentence, got: ' + same.why);
    const noList = chainDecide('Lean Canvas');
    assert.strictEqual(cmd(noList.offer), '/mos:lean-canvas', 'no selector list: the chain offer');
    assert.ok(noList.why.indexOf(openFact(IN_FROM, 'Lean Canvas')) !== -1 && noList.why.indexOf('held') === -1, 'no selector list: the plain chain sentence');
    const ledger = chainDecide('Lean Canvas', { tierCandidates: tier([P3, P2]), tierCandidatesSource: 'section_command_ledger' });
    assert.strictEqual(cmd(ledger.offer), '/mos:lean-canvas', 'a list that is not from the selector: the chain offer');
    const taken = chainDecide('Lean Canvas', Object.assign(sel([P3, P2, P1]), { operator: 'DECISION_GATE', jtbd: 'find-problem', sectionPath: 'problem-definition', roomState: {} }));
    assert.strictEqual(cmd(taken.offer), P3, 'an offer that the ranker made stays: the chain composer is not asked');
    assert.ok(taken.why.indexOf('Framework chain: ') === -1 && taken.why.indexOf('held') === -1, 'no chain text when the offer was made before the chain step, got: ' + taken.why);
    process.env[SWITCH] = '1';
    let alt;
    let noCmd;
    try {
      alt = chainDecide('Lean Canvas', sel([P3, '/mos:lean-canvas']));
      noCmd = chainDecide(NO_CMD_2, sel([P3, P2]));
    } finally { delete process.env[SWITCH]; }
    assert.strictEqual(cmd(alt.offer), '/mos:lean-canvas', 'the switch: the alternative is offered, as before Phase 395-06');
    assert.ok(alt.why.indexOf(openFact(IN_FROM, 'Lean Canvas')) !== -1 && alt.why.indexOf('held') === -1, 'the switch: the plain chain sentence');
    assert.ok(noCmd.offer !== null && noCmd.offer.command === null, 'the switch: a chain step with no command fills the offer with no command, as before Phase 395-06');
    assert.ok(noCmd.why.indexOf(openFact(IN_FROM, NO_CMD_2)) !== -1 && noCmd.why.indexOf('held') === -1, 'the switch: the plain chain sentence for no command');
  });

  check('B6. the owner decision D1 is 1 named constant, and the 3 sentences are 3 different texts', () => {
    const src = fs.readFileSync(ENGINE, 'utf8');
    assert.strictEqual(src.split('const CHAIN_HOLDS_SELECTOR_ALTERNATIVE = true;').length - 1, 1, 'the constant is in the engine file 1 time, with the value true');
    assert.strictEqual(src.split('CHAIN_HOLDS_SELECTOR_ALTERNATIVE ?').length - 1, 1, 'the constant is read in 1 place');
    assert.ok(S_OTHER !== S_NONE && S_ALT !== S_OTHER && S_ALT.indexOf(S_OTHER) === 0, 'the sentences differ');
    [S_OTHER, S_ALT.slice(S_OTHER.length), S_NONE].forEach((s) => assert.ok(src.indexOf(s.trim().split('. ')[0]) !== -1, 'the engine file holds: ' + s));
  });

  // ---- B7: the second field of the label (item A4) ----------------------------------------------------------------
  const rT = born('t');
  const TSEC = 'problem-definition';
  const brainT = path.join(rT.roomDir, TSEC, 'BRAIN.md');
  function selectorTurn() {
    const ctx = {
      quadruple: { reasoning: { governing_thought: 'Harbour masters wait for tide data', is_stale: false } },
      brainAvailable: false, userPersona: null, intentSignal: null, operator: 'JUST_TALK', roomState: {},
      section: TSEC, surface: 'cli', roomDir: rT.roomDir, sectionPath: path.join(rT.roomDir, TSEC),
    };
    engine.decide({ sectionPath: path.join(rT.roomDir, TSEC), sessionId: 's395' }, ctx);
    return ctx;
  }

  check('B7. ctx.tierCandidatesTheoAsked: false for a face that was not asked or cannot be read, true for an asked face; the label stays', () => {
    const bornText = fs.readFileSync(brainT, 'utf8');
    assert.ok(/\nasked: false\n/.test(bornText) && /\nface: "feyminto-theo"\n/.test(bornText), 'precondition: the born face is keyed and not asked');
    const notAsked = selectorTurn();
    assert.strictEqual(notAsked.tierCandidatesSource, 'feyminto_face', 'born face: the label');
    assert.strictEqual(notAsked.tierCandidatesTheoAsked, false, 'born face (not asked): false');
    fs.writeFileSync(brainT, bornText.replace('\nasked: false\n', '\nasked: true\n'), 'utf8');
    const asked = selectorTurn();
    assert.strictEqual(asked.tierCandidatesSource, 'feyminto_face', 'asked face: the label');
    assert.strictEqual(asked.tierCandidatesTheoAsked, true, 'asked face: true');
    fs.rmSync(brainT, { force: true });
    const gone = selectorTurn();
    assert.strictEqual(gone.tierCandidatesSource, 'feyminto_face', 'no BRAIN.md: the label is still set (the selector answered)');
    assert.strictEqual(gone.tierCandidatesTheoAsked, false, 'no BRAIN.md: false');
    assert.ok(Array.isArray(offerMod.selectorIds(gone)) && offerMod.selectorIds(gone).length > 0, 'no BRAIN.md: the selector ids are there');
    const own = { quadruple: { reasoning: { governing_thought: 'x', is_stale: false } }, brainAvailable: false, operator: 'JUST_TALK', roomState: {}, tierCandidates: tier([P3]) };
    engine.decide({ sectionPath: '/tmp/t395-fixture', sessionId: 's395' }, own);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(own, 'tierCandidatesTheoAsked'), false, 'a list that the caller gave: the field is not set');
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
