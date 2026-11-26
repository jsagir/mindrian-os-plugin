#!/usr/bin/env node
'use strict';
// Phase 395-05: the findings carried from the cold checks of 395-02 and 395-03. Plain Node script.
// Exit 0 when all checks pass, 1 when one fails. One line per check: "ok:" or "FAIL:".
//
// A. suggest_next says how the person sets or changes the goal job, in every reply that has a room (finding MA1).
// B. a strategy card answered in a dialog (the elicitation rung) reaches gate_answer and sets the goal (finding F2).
// C. the brief: the problem type is in the fingerprint, the face_missing sentence names the goal job, and a nest in
//    a sub-room has one fingerprint for every writer and reader (findings mi2 a, mi2 c, mi1).
// D. the vocabulary check is for the option rewrite-jtbd only (finding mi2 d).
// E. the hook gives no section to decide() when its time budget is used (cold check 395-03, Major 2, part 1).
//
// The rooms are real born fixture rooms under an isolated temporary home (tests/helpers/isolated-home-36925.cjs).
// Every tool call goes through the real registered handler with an explicit fake session id. No network.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const HOOK = path.join(ROOT, 'scripts', 'intent-classifier.cjs');
const ENGINE = path.join(ROOT, 'lib', 'core', 'navigation-engine.cjs');

const SEC = 'problem-definition';
const SUB_SEC = 'meetings';
const FREE = 'field-notes';
const BARE = 'loose-notes';
const JOB_A = 'validate-idea';
const JOB_B = 'understand-market';
const FREE_TEXT_GOAL = 'make money somehow';
const OFFERS_MAX = 24;
const UNSET = '__unset__';
const SESSION = 'test-395-carried-' + Date.now() + '-' + Math.random().toString(36).slice(2);
const NOW = () => '2026-01-01T00:00:00Z';

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log('ok: ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + name + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

// The text of one "## heading" block of a brief (heading line left out).
function block(text, heading) {
  const lines = String(text).split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === heading);
  if (at === -1) return '';
  const out = [];
  for (let k = at + 1; k < lines.length; k++) {
    if (/^## /.test(lines[k])) break;
    out.push(lines[k]);
  }
  return out.join('\n').trim();
}

function frontmatterFingerprint(text) {
  const m = String(text).match(/^record_basis_fingerprint: (sha256:[0-9a-f]{64})$/m);
  return m ? m[1] : null;
}

// A fake MCP server. `inner` is what the gate reads to pick the rung: a client that declares nothing gives the text
// rung; a client that declares elicitation and is not a Claude host gives the dialog rung
// (lib/mcp/gate-render.cjs detectGateCapabilities).
function fakeServer(inner) {
  const registered = [];
  return {
    registered,
    server: {
      tool(name, _d, a, b) { registered.push({ name, handler: typeof b === 'function' ? b : a }); },
      registerTool(name, _c, handler) { registered.push({ name, handler }); },
      server: inner,
    },
  };
}

async function call(handler, args) {
  const res = await handler(args, { sessionId: SESSION });
  return JSON.parse(res.content[0].text);
}

// The three parts of the card that a how-to sentence describes: kind, approving, options.
function cardFromSentence(sentence) {
  const kind = String(sentence).match(/gate_render with kind ("[a-z_]+")/);
  const approving = String(sentence).match(/approving (\[[^\]]*\])/);
  const options = String(sentence).match(/and options (\[.*?\])\. To set the problem type/);
  assert.ok(kind && approving && options, 'the sentence holds kind, approving and options: ' + sentence);
  return { kind: JSON.parse(kind[1]), approving: JSON.parse(approving[1]), options: JSON.parse(options[1]) };
}

function withJob(options, job, rung) {
  const out = JSON.parse(JSON.stringify(options));
  const preview = { jtbd: job };
  if (rung) preview.rung = rung;
  out[0].preview = JSON.stringify(preview);
  return out;
}

// The preload of the hook child: it records the context that the hook gave to decide(). With T395C_CLOCK_JUMP_MS set,
// each call of Date.now() returns a time that many milliseconds later than the call before, so the hook reads its
// time budget as used when it builds the context.
const PRELOAD_SOURCE = [
  "'use strict';",
  "const fs = require('node:fs');",
  'const jump = Number(process.env.T395C_CLOCK_JUMP_MS || 0);',
  'if (jump > 0) {',
  '  const real = Date.now.bind(Date);',
  '  let n = 0;',
  '  Date.now = function () { n += 1; return real() + n * jump; };',
  '}',
  'const enginePath = process.env.T395C_ENGINE_PATH;',
  'const outFile = process.env.T395C_CAPTURE_FILE;',
  'if (enginePath && outFile) {',
  '  const eng = require(enginePath);',
  '  const realDecide = eng.decide;',
  "  const pick = (o, k) => (o && o[k] !== undefined ? o[k] : '" + UNSET + "');",
  '  eng.decide = function (turn, ctx) {',
  '    const d = realDecide(turn, ctx);',
  '    try {',
  '      fs.writeFileSync(outFile, JSON.stringify({',
  "        section: pick(ctx, 'section'),",
  "        surface: pick(ctx, 'surface'),",
  "        sectionPath: pick(ctx, 'sectionPath'),",
  "        tierCandidatesSource: pick(ctx, 'tierCandidatesSource'),",
  '      }));',
  '    } catch (_e) { /* the capture is best effort */ }',
  '    return d;',
  '  };',
  '}',
  '',
].join('\n');

function runHook(iso, roomDir, sessionId, jumpMs) {
  const preload = path.join(iso.home, 'carried-preload.cjs');
  const captureFile = path.join(iso.home, 'carried-capture.json');
  fs.writeFileSync(preload, PRELOAD_SOURCE, 'utf8');
  try { fs.unlinkSync(captureFile); } catch (_e) { /* no earlier capture */ }
  const env = Object.assign({}, iso.env, {
    MINDRIAN_ROOMS_ROOT: iso.roomsHome,
    MOS_NAV_TEST_DISABLE_DRAIN: '1',
    MINDRIAN_COPILOT_INJECT_FINDINGS: '0',
    MINDRIAN_VOICE_REMINDER: '0',
    MINDRIAN_NAV_NO_SUPPRESS: '1',
    NODE_OPTIONS: '--require "' + preload.replace(/\\/g, '/') + '"',
    T395C_ENGINE_PATH: ENGINE,
    T395C_CAPTURE_FILE: captureFile,
  });
  if (jumpMs > 0) env.T395C_CLOCK_JUMP_MS = String(jumpMs);
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ user_message: 'what should I do next here', session_id: sessionId }),
    env,
    encoding: 'utf8',
    cwd: roomDir,
    timeout: 20000,
  });
  let capture = null;
  try { capture = JSON.parse(fs.readFileSync(captureFile, 'utf8')); } catch (_e) { capture = null; }
  return { status: res.status, stdout: res.stdout || '', capture };
}

async function main() {
  // ---- the fixture room: born, no goal ----
  const iso = H.mkIsolatedHome('395carried');
  const born = H.birthFixtureRoom({ iso, slug: 'carried', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!born || born.ok !== true) throw new Error('fixture birth failed: ' + JSON.stringify(born));
  const roomDir = fs.realpathSync(born.roomDir);
  const sectionPath = path.join(roomDir, SEC);
  const bind = require(path.join(ROOT, 'lib', 'core', 'session-binding.cjs'))
    .writeSessionBinding(SESSION, { bound: ['carried'], primary: 'carried', sticky: false }, { home: iso.roomsHome });
  if (!bind || bind.ok !== true) throw new Error('session binding failed: ' + JSON.stringify(bind));

  const B = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'brief.cjs'));
  const F = require(path.join(ROOT, 'lib', 'memory', 'triple-context-formatter.cjs'));
  const jtbdState = require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
  const goalGate = require(path.join(ROOT, 'lib', 'core', 'strategy', 'goal-gate.cjs'));
  const registry = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs'));
  const generator = require(path.join(ROOT, 'scripts', 'vault-section-minto-generator.cjs'));
  const stateFile = (dir) => path.join(dir, '.mindrian', 'jtbd-state.json');
  // The checks of B and C need a goal job in the room. When an earlier check did not set one, it is set here through
  // the goal writer, so one fault does not make the later checks fail too.
  const ensureGoal = () => {
    const goal = jtbdState.getGoal(roomDir);
    if (goal && registry.isDeclaredJob(goal.jtbd)) return goal;
    assert.strictEqual(goalGate.applyGoalFile(roomDir, { jtbd: JOB_A }).goal_file, 'ok', 'a goal job is set for this check');
    return jtbdState.getGoal(roomDir);
  };

  // Two hand-made nests with no job of their own. FREE has a Theo face that names three commands, so the selector
  // has candidates and no job. BARE has a ROOM.md and no BRAIN.md face.
  const freeDir = path.join(roomDir, FREE);
  fs.mkdirSync(freeDir);
  fs.writeFileSync(path.join(freeDir, 'ROOM.md'), '---\nstatement: "Notes from the field."\n---\n# Field notes\n', 'utf8');
  fs.writeFileSync(path.join(freeDir, 'BRAIN.md'), '---\nface: feyminto-theo\nasked: true\nsuggested_commands: "root-cause:runnable:runnable,validate:runnable:runnable,explore-domains:runnable:runnable"\n---\n# Theo face\n', 'utf8');
  const bareDir = path.join(roomDir, BARE);
  fs.mkdirSync(bareDir);
  fs.writeFileSync(path.join(bareDir, 'ROOM.md'), '---\nstatement: "Loose notes."\n---\n# Loose notes\n', 'utf8');

  const sensors = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
  const sFake = fakeServer({ getClientCapabilities() { return {}; } });
  sensors.register(sFake.server, { fallbackRoomDir: roomDir });
  const suggestNext = sFake.registered.find((r) => r.name === 'suggest_next').handler;

  const gate = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));
  // The text rung: the client declares nothing.
  const gText = fakeServer({ getClientCapabilities() { return {}; } });
  gate.register(gText.server, { fallbackRoomDir: roomDir });
  const textRender = gText.registered.find((r) => r.name === 'gate_render').handler;
  const textAnswer = gText.registered.find((r) => r.name === 'gate_answer').handler;
  // The dialog rung: the client declares elicitation and is not a Claude host. dialog.next is what the person does.
  const dialog = { next: null, calls: 0 };
  const gDialog = fakeServer({
    getClientCapabilities() { return { elicitation: {} }; },
    getClientVersion() { return { name: 'vscode', version: '1.0.0' }; },
    elicitInput: async function () { dialog.calls += 1; return dialog.next; },
  });
  gate.register(gDialog.server, { fallbackRoomDir: roomDir });
  const dialogRender = gDialog.registered.find((r) => r.name === 'gate_render').handler;
  const dialogAnswer = gDialog.registered.find((r) => r.name === 'gate_answer').handler;

  const expectedOffers = registry.JOB_VOCABULARY.filter((id) => id !== 'explore').slice(0, OFFERS_MAX);
  const folders = fs.readdirSync(roomDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name[0] !== '.' && /^[a-z0-9-]+$/.test(d.name)).map((d) => d.name).sort();

  // ---- A. suggest_next: the goal job and how it is set (finding MA1) ----
  await check('A1. no goal: every reply of a born room says that no goal job ranks, and how to set one', async () => {
    assert.ok(folders.length >= 12, 'the born room has its folders: ' + folders.length);
    assert.ok(folders.indexOf(SEC) !== -1 && folders.indexOf('team') !== -1, 'a nest with a job and a nest with none are in the list');
    const argsList = folders.map((s) => ({ section: s })).concat([{}]);
    for (const args of argsList) {
      const r = await call(suggestNext, args);
      const where = JSON.stringify(args);
      assert.ok(r.goal_job && typeof r.goal_job === 'object', 'goal_job is in the reply for ' + where);
      assert.strictEqual(r.goal_job.state, 'not_set', where);
      assert.strictEqual(r.goal_job.id, null, where);
      // Phase 400.4 QA-F1: offers carry id, label and sentence; offer_ids keeps the ids.
      assert.deepStrictEqual(r.goal_job.offer_ids, expectedOffers, where);
      assert.deepStrictEqual(r.goal_job.offers.map((o) => o.id), expectedOffers, where);
      assert.strictEqual(typeof r.goal_job.how_to, 'string', where);
      assert.ok(r.goal_job.how_to.indexOf('No goal job ranks the next move.') === 0, 'how_to starts with the state: ' + where);
    }
  });

  await check('A2. the offers are job ids of the vocabulary, explore left out, at most ' + OFFERS_MAX, async () => {
    const r = await call(suggestNext, { section: SEC });
    assert.ok(registry.JOB_VOCABULARY.indexOf('explore') !== -1, 'precondition: explore is in the vocabulary');
    // Phase 400.4 QA-F1: offers carry id, label and sentence; offer_ids keeps the ids.
    const ids = r.goal_job.offer_ids;
    assert.ok(ids.length > 0 && ids.length <= OFFERS_MAX, 'count: ' + ids.length);
    assert.ok(ids.indexOf('explore') === -1, 'explore is not offered');
    ids.forEach((id) => assert.ok(registry.isDeclaredJob(id), id + ' is in the job vocabulary'));
    assert.ok(ids.indexOf(JOB_A) !== -1 && ids.indexOf(JOB_B) !== -1, 'the two jobs of this test are offered');
  });

  await check('A3. the how_to sentence names each step and the limit of a closed dialog', async () => {
    const r = await call(suggestNext, { section: SEC });
    ['gate_render', '"strategy_goal"', 'approving ["rewrite-jtbd"]', 'gate_answer', 'goal_job.offers', 'Do not pick for the person',
      'unknown_gate', 'card_pending', 'strategy_ratification.goal_written true'].forEach((w) => {
      assert.ok(r.goal_job.how_to.indexOf(w) !== -1, 'how_to names: ' + w);
    });
    assert.ok(!Object.prototype.hasOwnProperty.call(r.next_move, 'how_to_set_job'), 'next_move of a nest with a job is as before');
  });

  await check('A4. the old sentence how_to_set_job also carries the approving list that the gate uses (finding mi2 e)', async () => {
    assert.strictEqual(jtbdState.getGoal(roomDir), null, 'precondition: no goal is stored');
    const r = await call(suggestNext, { section: FREE });
    assert.strictEqual(r.next_move.job_state, 'job_unknown');
    assert.strictEqual(typeof r.next_move.how_to_set_job, 'string', 'a nest with no job and candidates gets the old sentence');
    assert.strictEqual(r.goal_job.state, 'not_set', 'the new field is sent beside the old sentence');
    const card = cardFromSentence(r.next_move.how_to_set_job);
    assert.strictEqual(card.kind, 'strategy_goal');
    assert.deepStrictEqual(card.approving, ['rewrite-jtbd']);
    const rendered = await call(textRender, { header: 'Set the job', kind: card.kind, approving: card.approving, options: withJob(card.options, JOB_A) });
    assert.strictEqual(rendered.ok, true, JSON.stringify(rendered));
    assert.deepStrictEqual(rendered.approving, ['rewrite-jtbd']);
    const wrong = await call(textAnswer, { gate_id: rendered.gate_id, chosen: ['defer'], verdict: 'approve' });
    assert.strictEqual(wrong.reason, 'chosen_not_approving', JSON.stringify(wrong));
    const deferred = await call(textAnswer, { gate_id: rendered.gate_id, chosen: ['defer'], verdict: 'defer' });
    assert.strictEqual(deferred.ok, true, JSON.stringify(deferred));
    assert.strictEqual(jtbdState.getGoal(roomDir), null, 'a deferred card writes no goal');
  });

  await check('A5. a stored goal in free text does not rank, and the reply still says not_set', async () => {
    assert.ok(jtbdState.setGoal(roomDir, { jtbd: JOB_A }), 'a goal is stored');
    const state = JSON.parse(fs.readFileSync(stateFile(roomDir), 'utf8'));
    state.goal.jtbd = FREE_TEXT_GOAL;
    fs.writeFileSync(stateFile(roomDir), JSON.stringify(state, null, 2), 'utf8');
    assert.strictEqual(jtbdState.getGoal(roomDir).jtbd, FREE_TEXT_GOAL);
    const r = await call(suggestNext, { section: SEC });
    assert.strictEqual(r.goal_job.state, 'not_set');
    assert.strictEqual(r.goal_job.id, null);
    assert.strictEqual(r.next_move.job.origin, 'section');
  });

  await check('A6. text rung: the card that how_to describes sets the goal; its approving list is used (finding mi2 e)', async () => {
    const r = await call(suggestNext, { section: SEC });
    const card = cardFromSentence(r.goal_job.how_to);
    assert.strictEqual(card.kind, 'strategy_goal');
    assert.deepStrictEqual(card.approving, ['rewrite-jtbd']);
    assert.deepStrictEqual(card.options.map((o) => o.id), ['rewrite-jtbd', 'defer']);
    assert.deepStrictEqual(JSON.parse(card.options[0].preview), { jtbd: '<job id>' });
    const rendered = await call(textRender, { header: 'Set the job to ' + JOB_A, kind: card.kind, approving: card.approving, options: withJob(card.options, JOB_A, 'IllDefined') });
    assert.strictEqual(rendered.ok, true, JSON.stringify(rendered));
    assert.ok(!Object.prototype.hasOwnProperty.call(rendered, 'answer'), 'the text rung gives no answer inline');
    const wrong = await call(textAnswer, { gate_id: rendered.gate_id, chosen: ['defer'], verdict: 'approve' });
    assert.strictEqual(wrong.ok, false);
    assert.strictEqual(wrong.reason, 'chosen_not_approving', 'an approve of the option defer is refused: ' + JSON.stringify(wrong));
    const answered = await call(textAnswer, { gate_id: rendered.gate_id, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    assert.strictEqual(answered.ok, true, JSON.stringify(answered));
    assert.strictEqual(answered.strategy_ratification.goal_written, true, JSON.stringify(answered.strategy_ratification));
    const goal = jtbdState.getGoal(roomDir);
    assert.strictEqual(goal.jtbd, JOB_A);
    assert.strictEqual(goal.rung, 'IllDefined');
  });

  await check('A7. goal set: the reply names the goal job and says how to change it', async () => {
    assert.strictEqual(jtbdState.getGoal(roomDir).jtbd, JOB_A, 'precondition: check A6 set the goal');
    for (const args of [{ section: SEC }, { section: 'team' }, {}]) {
      const r = await call(suggestNext, args);
      const where = JSON.stringify(args);
      assert.strictEqual(r.goal_job.state, 'set', where);
      assert.strictEqual(r.goal_job.id, JOB_A, where);
      // Phase 400.4 QA-F1: offers carry id, label and sentence; offer_ids keeps the ids.
      assert.deepStrictEqual(r.goal_job.offer_ids, expectedOffers, where);
      assert.ok(r.goal_job.how_to.indexOf('The goal job of this room ranks the next move in every nest: ' + JOB_A + '. To change it:') === 0, 'how_to: ' + r.goal_job.how_to.slice(0, 120));
      assert.ok(r.goal_job.how_to.indexOf('No goal job ranks') === -1, where);
      assert.deepStrictEqual(cardFromSentence(r.goal_job.how_to).approving, ['rewrite-jtbd']);
    }
    const r = await call(suggestNext, { section: SEC });
    assert.deepStrictEqual(r.next_move.job, { id: JOB_A, origin: 'goal' });
  });

  // ---- B. the dialog rung: a strategy card answered in a dialog reaches gate_answer (finding F2) ----
  await check('B2. dialog rung: a closed dialog gives no answer, and a relay is refused with card_pending', async () => {
    const before = ensureGoal();
    dialog.next = { action: 'cancel' };
    const rendered = await call(dialogRender, {
      header: 'Set the job to ' + JOB_A, kind: 'strategy_goal', approving: ['rewrite-jtbd'],
      options: [{ id: 'rewrite-jtbd', label: 'Set this job', preview: JSON.stringify({ jtbd: JOB_A }) }, { id: 'defer', label: 'Not now' }],
    });
    assert.strictEqual(rendered.ok, true, JSON.stringify(rendered));
    assert.ok(!Object.prototype.hasOwnProperty.call(rendered, 'answer'), 'no answer');
    assert.ok(!Object.prototype.hasOwnProperty.call(rendered, 'next'), 'no next');
    const relayed = await call(dialogAnswer, { gate_id: rendered.gate_id, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    assert.strictEqual(relayed.ok, false);
    assert.strictEqual(relayed.reason, 'card_pending', JSON.stringify(relayed));
    assert.deepStrictEqual(jtbdState.getGoal(roomDir), before, 'no goal was written');
  });

  await check('B3. dialog rung: a card of another kind is consumed inline, as before', async () => {
    dialog.next = { action: 'accept', content: { choice: 'yes' } };
    const rendered = await call(dialogRender, { header: 'A general card', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] });
    assert.strictEqual(rendered.ok, true, JSON.stringify(rendered));
    assert.deepStrictEqual(rendered.answer.chosen, ['yes']);
    assert.ok(!Object.prototype.hasOwnProperty.call(rendered, 'next'), 'no next for a card that is not a strategy card');
    const relayed = await call(dialogAnswer, { gate_id: rendered.gate_id, chosen: ['yes'], verdict: 'approve' });
    assert.strictEqual(relayed.ok, false);
    assert.strictEqual(relayed.reason, 'unknown_gate', JSON.stringify(relayed));
  });

  // ---- C. the brief ----
  await check('C1. a change of the problem type alone writes BRIEF.md again (finding mi2 a)', () => {
    const job = ensureGoal().jtbd;
    assert.strictEqual(goalGate.applyGoalFile(roomDir, { jtbd: job, rung: 'IllDefined' }).goal_file, 'ok');
    generator.renderBriefForSection(roomDir, sectionPath);
    const skipped = generator.renderBriefForSection(roomDir, sectionPath);
    assert.strictEqual(skipped.skipped, true, 'the same goal and problem type: ' + JSON.stringify(skipped));
    assert.strictEqual(goalGate.applyGoalFile(roomDir, { jtbd: job, rung: 'Wicked' }).goal_file, 'ok');
    assert.strictEqual(jtbdState.getGoal(roomDir).jtbd, job, 'the job is the same');
    const res = generator.renderBriefForSection(roomDir, sectionPath);
    assert.strictEqual(res.written, true, JSON.stringify(res));
    assert.strictEqual(res.reason, 'record_basis_changed');
    const text = fs.readFileSync(path.join(sectionPath, 'BRIEF.md'), 'utf8');
    assert.ok(block(text, '## RECORD BASIS').indexOf('- selection job: ' + job + ' (your goal job), problem type Wicked') !== -1, 'RECORD BASIS names the new problem type');
  });

  await check('C2. a nest with no BRAIN.md: the Theo sentence names the goal job (finding mi2 c)', () => {
    const job = ensureGoal().jtbd;
    assert.ok(!fs.existsSync(path.join(bareDir, 'BRAIN.md')), 'precondition: the nest has no BRAIN.md');
    const theo = block(B.renderBrief({ sectionPath: bareDir, roomDir, now: NOW }), "## THEO'S CONTRIBUTION");
    assert.ok(theo.indexOf('(reason: face_missing)') !== -1, 'the face_missing branch: ' + theo);
    assert.ok(theo.indexOf('The move above comes from the contract, the ledger, the nest itself and your goal job (' + job + ').') !== -1, 'the origin sentence names the goal job: ' + theo);
  });

  // A sub-room: <room>/sub-rooms/alpha/<section>. The section name is one the root room does not have, so the
  // generator finds it from the root by its name (resolveSection takes the first section with that name).
  const subRoom = path.join(roomDir, 'sub-rooms', 'alpha');
  const subSection = path.join(subRoom, SUB_SEC);
  await check('C3. a nest in a sub-room has one fingerprint for the generator, the stop walk and the reader (finding mi1)', () => {
    assert.ok(!fs.existsSync(path.join(roomDir, SUB_SEC)), 'precondition: the root room has no folder ' + SUB_SEC);
    fs.mkdirSync(subRoom, { recursive: true });
    fs.cpSync(sectionPath, subSection, { recursive: true });
    try { fs.unlinkSync(path.join(subSection, 'BRIEF.md')); } catch (_e) { /* no brief copied */ }
    fs.writeFileSync(path.join(subSection, 'note-one.md'), '---\ntitle: Note one\n---\n# Note one\n\nNew hires wait three weeks before they are useful.\n', 'utf8');
    const rootJob = ensureGoal().jtbd;
    assert.strictEqual(jtbdState.getGoal(subRoom), null, 'precondition: the sub-room has no goal');
    // The generator, from the root room (the real entry; it prints one line).
    const out = generator.runTier0({ roomDir: roomDir, sectionName: SUB_SEC });
    assert.strictEqual(out.path, path.join(subSection, 'MINTO.md'), 'the generator wrote the nest of the sub-room');
    const first = fs.readFileSync(path.join(subSection, 'BRIEF.md'), 'utf8');
    assert.strictEqual(frontmatterFingerprint(first), B.recordBasis(subSection).fingerprint, 'the brief fingerprint is the fingerprint a reader computes');
    assert.ok(first.indexOf('your goal job') === -1, 'the goal of the root room does not rank a nest of the sub-room');
    assert.strictEqual(F.assembleBriefHead({ roomDir: subRoom, section: SUB_SEC }).state, 'fresh', 'a reader bound to the sub-room reads the brief as fresh');
    // The stop walk of a session bound to the sub-room, then the generator path again: no rewrite.
    assert.strictEqual(generator.renderBriefForSection(subRoom, subSection).skipped, true, 'the stop walk does not write it again');
    assert.strictEqual(generator.renderBriefForSection(roomDir, subSection).skipped, true, 'the generator path does not write it again');
    // A goal of the sub-room ranks its nest, for both writers.
    assert.strictEqual(goalGate.applyGoalFile(subRoom, { jtbd: JOB_A === rootJob ? JOB_B : JOB_A }).goal_file, 'ok');
    const subJob = jtbdState.getGoal(subRoom).jtbd;
    assert.notStrictEqual(subJob, rootJob);
    const fromRoot = generator.renderBriefForSection(roomDir, subSection);
    assert.strictEqual(fromRoot.written, true, JSON.stringify(fromRoot));
    const second = fs.readFileSync(path.join(subSection, 'BRIEF.md'), 'utf8');
    assert.ok(block(second, '## THIS NEST SERVES').indexOf('Job: ' + subJob + ' (your goal job') === 0, 'the brief names the goal job of the sub-room');
    assert.strictEqual(frontmatterFingerprint(second), B.recordBasis(subSection).fingerprint);
    assert.strictEqual(generator.renderBriefForSection(subRoom, subSection).skipped, true, 'the stop walk agrees');
  });

  // ---- D. the vocabulary check is for rewrite-jtbd only ----
  await check('D1. change-rung on a stored goal in free text still writes (finding mi2 d)', () => {
    const dir = fs.mkdtempSync(path.join(iso.home, 'free-goal-'));
    assert.ok(jtbdState.setGoal(dir, { jtbd: JOB_A, rung: 'IllDefined' }));
    const state = JSON.parse(fs.readFileSync(stateFile(dir), 'utf8'));
    state.goal.jtbd = FREE_TEXT_GOAL;
    fs.writeFileSync(stateFile(dir), JSON.stringify(state, null, 2), 'utf8');
    const card = { kind: 'strategy_goal', options: [{ id: 'change-rung', label: 'Change the problem type', preview: JSON.stringify({ jtbd: FREE_TEXT_GOAL, rung: 'Wicked' }) }] };
    const out = goalGate.ratifyGoalProposal(null, dir, { card: card, chosen: ['change-rung'], verdict: 'approve' });
    assert.strictEqual(out.goal_written, true, JSON.stringify(out));
    const goal = jtbdState.getGoal(dir);
    assert.strictEqual(goal.jtbd, FREE_TEXT_GOAL);
    assert.strictEqual(goal.rung, 'Wicked');
    const refused = goalGate.ratifyGoalProposal(null, dir, { card: { kind: 'strategy_goal', options: [{ id: 'rewrite-jtbd', label: 'Set this job', preview: JSON.stringify({ jtbd: FREE_TEXT_GOAL }) }] }, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    assert.strictEqual(refused.reason, 'goal_job_not_in_vocabulary', 'rewrite-jtbd to free text is still refused');
  });

  // ---- E. the hook: no section for decide() when the time budget is used ----
  // The hook module reads stdin to its end when it is loaded, so it is loaded in a child process with an empty stdin.
  await check('E1. sectionForSelector: the slug under the budget, nothing at the budget, a missing clock never skips', () => {
    const source = [
      'const IC = require(process.argv[1]);',
      'const room = process.argv[2];',
      'const sec = process.argv[3];',
      'const limit = IC.NAV_HARD_TIMEOUT_MS;',
      "const show = (v) => (v === undefined ? '" + UNSET + "' : v);",
      'process.stdout.write(JSON.stringify({',
      '  type: typeof IC.sectionForSelector,',
      '  limit: limit,',
      '  zero: show(IC.sectionForSelector(room, sec, 0)),',
      '  under: show(IC.sectionForSelector(room, sec, limit - 1)),',
      '  at: show(IC.sectionForSelector(room, sec, limit)),',
      '  over: show(IC.sectionForSelector(room, sec, limit * 10)),',
      '  nan: show(IC.sectionForSelector(room, sec, NaN)),',
      '  none: show(IC.sectionForSelector(room, sec, undefined)),',
      "  nested: show(IC.sectionForSelector(room, require('node:path').join(sec, 'deep'), 0)),",
      '}));',
    ].join('\n');
    const res = spawnSync(process.execPath, ['-e', source, HOOK, roomDir, sectionPath], { input: '', encoding: 'utf8', env: iso.env, timeout: 20000 });
    assert.strictEqual(res.status, 0, 'the child exit code; stderr: ' + String(res.stderr || '').slice(0, 300));
    const got = JSON.parse(res.stdout);
    assert.deepStrictEqual(got, {
      type: 'function', limit: 1200, zero: SEC, under: SEC, at: UNSET, over: UNSET, nan: SEC, none: SEC, nested: UNSET,
    });
  });

  await check('E2. the real hook: with the budget used, decide() gets no section; with a normal clock it gets the slug', () => {
    const iso2 = H.mkIsolatedHome('395carried-hook');
    const b2 = H.birthFixtureRoom({ iso: iso2, slug: 'carried-hook', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
    assert.ok(b2 && b2.ok === true, 'fixture birth: ' + JSON.stringify(b2));
    const room2 = fs.realpathSync(b2.roomDir);
    fs.mkdirSync(path.join(room2, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(room2, '.mindrian', 'active-section.json'), JSON.stringify({ section: SEC }), 'utf8');
    const normal = runHook(iso2, room2, 't395c-normal', 0);
    assert.strictEqual(normal.status, 0, 'hook exit code, normal clock');
    assert.ok(normal.capture, 'decide() was called, normal clock');
    assert.strictEqual(normal.capture.section, SEC, 'normal clock: ctx.section is the slug');
    assert.strictEqual(normal.capture.tierCandidatesSource, 'feyminto_face', 'normal clock: the selector ran');
    const late = runHook(iso2, room2, 't395c-late', 5000);
    assert.strictEqual(late.status, 0, 'hook exit code, budget used');
    assert.ok(late.stdout.indexOf('NAVIGATION DECISION (engine v1)') !== -1, 'the block is printed, budget used');
    assert.ok(late.capture, 'decide() was called, budget used');
    assert.strictEqual(late.capture.sectionPath, path.join(room2, SEC), 'budget used: the section in focus is the same');
    assert.strictEqual(late.capture.section, UNSET, 'budget used: ctx.section is not set');
    assert.strictEqual(late.capture.surface, 'cli', 'budget used: ctx.surface stays');
    assert.strictEqual(late.capture.tierCandidatesSource, UNSET, 'budget used: the selector did not run');
  });

  // ---- G. dash guard ----
  await check('G1. no em dash or en dash in the files of this plan', () => {
    const files = ['lib/mcp/tools/sensors.cjs', 'lib/mcp/tools/gate.cjs', 'lib/core/feyminto/brief.cjs', 'scripts/intent-classifier.cjs', 'tests/test-395-carried.cjs', 'tests/run-all-395.sh']
      .map((f) => path.join(ROOT, f));
    assert.deepStrictEqual(H.dashGuard(files), []);
  });
}

main().then(() => {
  if (failed > 0) {
    console.log('FAILED: ' + failed + ' check(s)');
    process.exit(1);
  }
  console.log('PASSED: all checks');
  process.exit(0);
}).catch((e) => {
  console.log('FAIL: the test did not run to its end -- ' + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
});
