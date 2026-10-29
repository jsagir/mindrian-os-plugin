#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 plan 02 Task 3 (Codex C3, C4 and rounds 2 and 3): the Larry voice eval, offline.
 *
 *   E1  the research import and the code half: R2, R8, R12, OP1 values on research-p; OP2 to OP5 carry the
 *       rule id na_operation_on_voice_cell; the committed scores name the judge per item
 *   E2  the cells: cell 1 is exactly the agent body; cell 2s holds every part and lists each part with its sha256
 *   E3  provenance, every check before any payload exists: no manifest, a recomputed replies hash against the
 *       seal, a probe changed at the pinned commit, composition_unproven, a cell 2 run, an import with one byte
 *       changed, an import not in jev_imports; the seal key rules
 *   E4  the voice transport: its ceiling, the whole payload tuple compared before fetch, zero fetch calls on a
 *       mismatch, the ledger untouched, fallback to the claude judge and then not_scored with the reason
 *   E5  compare over the required matrix: COMPLETE, INCOMPLETE (truncated alike, unruled not_applicable,
 *       abstained, judge change, partial cell, hash change), REGRESSION (also beside incomplete parts, and the OP1
 *       never-say case with no tool log), REFUSED (run kind, label outside runs)
 *   E6  sampling: the median of three, the code-scored agreement flag, a second retry refused
 *   E7  the live leg: 77 with a reason, 1 under LARRY_VOICE_REQUIRE_LIVE=1, 3 when partial, fable refused
 *   E8  hygiene: no dash character, no ledger ceiling call, no inherited environment
 *
 * Hermetic: every home variable is a stand-in directory before the eval loads, so the seal key lives in a home
 * the test owns; a stub transport and a stub claude replace the network and the CLI; installNetGuard counts fetch.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');

const NET = installNetGuard();
const C = makeChecker('369.6-02 rubric eval');
const check = C.check;
const ROOT = fs.realpathSync(path.resolve(__dirname, '..'));
const OWNED = [];
function mk(prefix) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  OWNED.push(d);
  return d;
}

// The five home variables point at directories the test owns BEFORE the eval is required.
const STANDIN = mk('standin-home-rubric-3696-');
process.env.HOME = STANDIN;
process.env.USERPROFILE = STANDIN;
process.env.MINDRIAN_ROOMS_HOME = mk('standin-rooms-rubric-3696-');
process.env.MINDRIAN_ROOMS_ROOT = process.env.MINDRIAN_ROOMS_HOME;
process.env.CLAUDE_CONFIG_DIR = path.join(STANDIN, '.claude');
delete process.env.TYPESAFE_API_KEY;
delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
delete process.env.ANTHROPIC_API_KEY;
process.env.MINDRIAN_SKIP_LIVE_CLAUDE = '1';
delete process.env.LARRY_VOICE_REQUIRE_LIVE;

const e = require('../scripts/eval-larry-voice.cjs');
const t = require('../scripts/jev-voice-transport.cjs');
const iso = require('../scripts/isolate-larry-voice.cjs');
const checks = require('../lib/hmi/larry-reply-checks.cjs');
const rubric = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals/larry-voice/rubric.json'), 'utf8'));
const probes = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals/larry-voice/probes.json'), 'utf8'));
const RESEARCH = path.join(ROOT, rubric.judge_policy.jev_imports[0].source);
const RUNS = mk('runs-rubric-3696-');
const GLYPH = String.fromCodePoint(0x1F7E5);

function throwsReason(fn, reason) {
  try { fn(); return false; } catch (x) { return x && x.reason === reason; }
}
async function rejectsReason(fn, reason) {
  try { await fn(); return false; } catch (x) { return x && x.reason === reason; }
}

(async function main() {
  // ---- E1 ---------------------------------------------------------------------------------------------
  const imp = e.importRun({ label: 'research-p', from: RESEARCH, runsDir: RUNS });
  const runP = e.loadRun('research-p', { runsDir: RUNS });
  const entry = rubric.judge_policy.jev_imports[0];
  check('E1a the import holds replies A to E verbatim, cell 1, method P', imp.replies === 5 && runP.replies.replies.map(function (r) { return r.probe; }).join('') === 'ABCDE' && runP.replies.replies.every(function (r) { return r.cell === '1' && /agent text only/.test(r.method); }));
  check('E1b the manifest is kind research-import with the source, commit and sha256 of the rubric entry',
    runP.manifest.kind === 'research-import' && runP.manifest.run_kind === 'voice' && runP.manifest.source === entry.source && runP.manifest.source_commit === entry.source_commit && runP.manifest.source_sha256 === entry.source_sha256);
  const reconstructed = e.parseProbeReplies(execFileSync('git', ['show', entry.source_commit + ':' + entry.source], { cwd: ROOT, encoding: 'utf8' }));
  check('E1c every reply byte-equals the one reconstructed from the pinned source', reconstructed.length === 5 && reconstructed.every(function (p, i) { return p.text === runP.replies.replies[i].text; }));
  const sc0 = await e.scoreRun(runP, { judge: 'none' });
  const byProbe = {};
  sc0.entries.forEach(function (x) { byProbe[x.probe] = x; });
  check('E1d R2 is 1 for A, B and C (the all-capitals spelling; the model clause passes on the cli surface) and 0 for D (repeated identity)',
    ['A', 'B', 'C'].every(function (p) { return byProbe[p].items.R2.value === 1; }) && byProbe.D.items.R2.value === 0);
  check('E1e R8 is 0 for every reply with two or more questions under the D-10 rule',
    sc0.entries.every(function (x) {
      const r = runP.replies.replies.filter(function (q) { return q.probe === x.probe; })[0];
      return checks.countQuestions(r.text) < 2 || x.items.R8.value === 0;
    }) && sc0.entries.some(function (x) { return x.items.R8.value === 0; }));
  check('E1f R12 is not 2 for any reply that holds a spaced double hyphen',
    sc0.entries.every(function (x) {
      const r = runP.replies.replies.filter(function (q) { return q.probe === x.probe; })[0];
      return !/\s--\s/.test(r.text) || x.items.R12.value !== 2;
    }) && sc0.entries.some(function (x) { return /\s--\s/.test(runP.replies.replies.filter(function (q) { return q.probe === x.probe; })[0].text); }));
  check('E1g OP1 carries a code-half value (status scored, judge code) for every reply although none has a tool log',
    sc0.entries.every(function (x) { return x.items.OP1.status === 'scored' && x.items.OP1.judge === 'code'; }));
  check('E1h OP2 to OP5 are not_applicable with the rule id na_operation_on_voice_cell on every reply',
    sc0.entries.every(function (x) { return ['OP2', 'OP3', 'OP4', 'OP5'].every(function (id) { return x.items[id].status === 'not_applicable' && x.items[id].rule === 'na_operation_on_voice_cell'; }); }));
  check('E1i probe E is a report probe: R3, R4, R6, R9 and R11 carry the rule id na_report_mode', ['R3', 'R4', 'R6', 'R9', 'R11'].every(function (id) { return byProbe.E.items[id].status === 'not_applicable' && byProbe.E.items[id].rule === 'na_report_mode'; }));
  check('E1j a judge-only item is not_scored with judge none (never a guess)', ['R6', 'R7', 'R9', 'R13'].every(function (id) { return byProbe.A.items[id].status === 'not_scored'; }) && byProbe.A.total.status === 'not_scored');
  const committed = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals/larry-voice/runs/research-p/scores.json'), 'utf8'));
  const committedManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals/larry-voice/runs/research-p/manifest.json'), 'utf8'));
  check('E1k the committed research-p scores name the judge on every item that is not rule-not-applicable',
    committed.entries.length === 5 && committed.entries.every(function (x) { return Object.keys(x.items).every(function (id) { const it = x.items[id]; return it.status === 'not_applicable' || ['code', 'jev', 'claude', 'none'].indexOf(it.judge) !== -1 || it.judge === null; }); }) && typeof committed.judge_per_item === 'object');
  check('E1l the committed manifest has kind research-import and the source commit and sha256 of the rubric entry',
    committedManifest.kind === 'research-import' && committedManifest.source_commit === entry.source_commit && committedManifest.source_sha256 === entry.source_sha256);

  // ---- E2 ---------------------------------------------------------------------------------------------
  const agentText = fs.readFileSync(path.join(ROOT, 'agents/larry-extended.md'), 'utf8');
  const body = e.agentBodyOf(agentText);
  const cell1 = e.buildCellPrompt('1', { agentBody: body });
  check('E2a cell 1 is exactly the agent body bytes (no skill text, no capture)', cell1.system === body && cell1.transcriptPrefix === '' && cell1.manifest.parts.join() === 'agent_body');
  const skills = [{ path: 'skills/x/SKILL.md', text: 'SKILL TEXT ONE' }, { path: 'skills/y/SKILL.md', text: 'SKILL TEXT TWO' }];
  const cell2s = e.buildCellPrompt('2s', { agentBody: body, sessionCapture: 'SESSION CAPTURE', skills: skills, outputStyleBody: 'STYLE BODY', userPromptCapture: 'TURN CAPTURE' });
  check('E2b cell 2s holds the body, both skills, the style and both captures', ['SESSION CAPTURE', 'SKILL TEXT ONE', 'SKILL TEXT TWO', 'STYLE BODY', 'TURN CAPTURE'].every(function (x) { return cell2s.system.indexOf(x) !== -1; }) && cell2s.system.indexOf(body) === 0);
  check('E2c the 2s composition manifest lists each part with its sha256',
    cell2s.manifest.skills.length === 2 && cell2s.manifest.skills.every(function (s) { return /^[0-9a-f]{64}$/.test(s.sha256); }) &&
    ['agent_body_sha256', 'session_start_capture_sha256', 'output_style_sha256', 'user_prompt_capture_sha256'].every(function (k) { return /^[0-9a-f]{64}$/.test(cell2s.manifest[k]); }));
  const cell3 = e.buildCellPrompt('3', { agentBody: body, sessionCapture: 'SESSION CAPTURE', transcriptText: fs.readFileSync(path.join(ROOT, 'evals/larry-voice/fixtures/rung3-tool-noise.jsonl'), 'utf8') });
  check('E2d cell 3 adds the rendered transcript as prior turns and no skills', /\[tool call\] context_assemble/.test(cell3.transcriptPrefix) && cell3.system.indexOf('SKILL TEXT') === -1 && /^[0-9a-f]{64}$/.test(cell3.manifest.transcript_sha256));
  check('E2e an unknown cell is refused', throwsReason(function () { e.buildCellPrompt('9', { agentBody: body }); }, 'cell_unknown'));

  // ---- generation run for E3, E4, E7 -------------------------------------------------------------------
  function stubSpawn(initOverrides, calls) {
    return function (scratch, cmd, args) {
      if (calls) calls.push({ cmd: cmd, args: args });
      const prompt = args[args.length - 1];
      const init = Object.assign({ type: 'system', subtype: 'init', agent: null, plugins: [], mcp_servers: [], tools: [], output_style: 'default' }, initOverrides || {});
      const text = GLYPH + ' **Larry | MindrianOS**\n\nStub reply to: ' + String(prompt).slice(0, 14).replace(/\s+/g, ' ') + '.';
      return { status: 0, stdout: JSON.stringify(init) + '\n' + JSON.stringify({ type: 'result', subtype: 'success', result: text }) + '\n', stderr: '' };
    };
  }
  const ENV_OK = Object.assign({}, process.env, { CLAUDE_CODE_OAUTH_TOKEN: 'token-for-test-only' });
  delete ENV_OK.MINDRIAN_SKIP_LIVE_CLAUDE;
  const calls = [];
  const gen = await e.generateRun({ label: 'gen-ok', cells: ['1'], runsDir: RUNS, spawn: stubSpawn(null, calls), claudeCli: process.execPath, env: ENV_OK, home: STANDIN });
  check('E3a a cell 1 generation (stub claude) completes: exit 0, 9 replies', gen.exit === 0 && gen.replies === 9, JSON.stringify(gen.statuses));
  const genRun = e.loadRun('gen-ok', { runsDir: RUNS });
  check('E3b the generation manifest is sealed, kind voice-fixture-generation, run_kind voice, inputs_clean true, files 0444',
    typeof genRun.manifest.seal === 'string' && genRun.manifest.kind === 'voice-fixture-generation' && genRun.manifest.run_kind === 'voice' && genRun.manifest.inputs_clean === true &&
    (fs.statSync(path.join(genRun.dir, 'replies.json')).mode & 0o222) === 0 && (fs.statSync(path.join(genRun.dir, 'manifest.json')).mode & 0o222) === 0);
  check('E3c the spawn args carry no plugin directory and no tools, and an empty tool list', calls.length === 9 && calls.every(function (c) { return c.args.indexOf('--plugin-dir') === -1 && c.args[c.args.indexOf('--tools') + 1] === '' && c.args.indexOf('--no-session-persistence') !== -1; }));
  const keyFile = e.sealKeyPath(STANDIN);
  const keySt = fs.lstatSync(keyFile);
  check('E3d the seal key was created once: 32 bytes, mode 0600, parent 0700', keySt.size === 32 && (keySt.mode & 0o777) === 0o600 && (fs.lstatSync(path.dirname(keyFile)).mode & 0o777) === 0o700);
  const keyBefore = fs.readFileSync(keyFile);
  e.ensureSealKey(STANDIN);
  check('E3e a second ensureSealKey reuses the key unchanged (wx, never overwritten)', Buffer.compare(keyBefore, fs.readFileSync(keyFile)) === 0);

  function tweak(srcLabel, newLabel, mutate, reseal) {
    const src = path.join(RUNS, srcLabel);
    const dst = path.join(RUNS, newLabel);
    fs.mkdirSync(dst, { recursive: true });
    const replies = JSON.parse(fs.readFileSync(path.join(src, 'replies.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
    mutate(replies, manifest);
    const bytes = Buffer.from(JSON.stringify(replies, null, 2) + '\n');
    manifest.replies_sha256 = e.sha256(bytes);
    const finalManifest = reseal ? e.sealRun(bytes, manifest, { home: STANDIN }) : manifest;
    fs.writeFileSync(path.join(dst, 'replies.json'), bytes);
    fs.writeFileSync(path.join(dst, 'manifest.json'), JSON.stringify(finalManifest, null, 2) + '\n');
    return e.loadRun(newLabel, { runsDir: RUNS });
  }
  const ctx = { home: STANDIN };

  // ---- E3 provenance ----------------------------------------------------------------------------------
  const vOk = e.verifyJudgeProvenance(genRun, rubric, ctx);
  check('E3f a sealed, proven cell 1 generation run is accepted: 9 entries, a frozen record', vOk.ok === true && vOk.record.entries.length === 9 && Object.isFrozen(vOk.record) && Object.isFrozen(vOk.record.entries[0]));
  const vImp = e.verifyJudgeProvenance(runP, rubric, ctx);
  check('E3g the unmodified research-p import is accepted: 5 entries', vImp.ok === true && vImp.record.entries.length === 5);
  const handDir = path.join(RUNS, 'hand-written');
  fs.mkdirSync(handDir, { recursive: true });
  fs.writeFileSync(path.join(handDir, 'replies.json'), JSON.stringify({ version: 1, replies: [{ probe: 'A', cell: '1', sample: 1, text: 'A private-looking reply about Dana and her Lisbon lease.' }] }));
  check('E3h a hand-written replies.json with no manifest is refused (no_manifest)', throwsReason(function () { e.loadRun('hand-written', { runsDir: RUNS }); }, 'no_manifest'));
  const recomputed = tweak('gen-ok', 'gen-recomputed', function (r) { r.replies[0].text = r.replies[0].text + ' Changed after the seal.'; }, false);
  const vRecomputed = e.verifyJudgeProvenance(recomputed, rubric, ctx);
  check('E3i a rewritten run whose replies_sha256 was recomputed is refused by the seal (seal_mismatch)', vRecomputed.ok === false && vRecomputed.reason === 'seal_mismatch', vRecomputed.reason);
  const probeChanged = tweak('gen-ok', 'gen-probe', function (r) { r.replies[0].prompt = r.replies[0].prompt + ' (edited)'; }, true);
  const vProbe = e.verifyJudgeProvenance(probeChanged, rubric, ctx);
  check('E3j a sealed run whose stored prompt differs from the probe at its pinned commit is refused (probe_mismatch_at_commit)', vProbe.ok === false && vProbe.reason === 'probe_mismatch_at_commit', vProbe.reason);
  const hashChanged = tweak('gen-ok', 'gen-hash', function (r, m) { m.probes_sha256 = 'f'.repeat(64); }, true);
  check('E3k a run whose probes_sha256 does not re-derive at the pinned commit is refused (hash_mismatch_at_commit)', e.verifyJudgeProvenance(hashChanged, rubric, ctx).reason === 'hash_mismatch_at_commit');
  const unproven = tweak('gen-ok', 'gen-unproven', function (r, m) { m.statuses.A['1'] = 'composition_unproven'; }, true);
  check('E3l a sealed run with one cell marked composition_unproven is refused (composition_unproven) although its replies hash matches', e.verifyJudgeProvenance(unproven, rubric, ctx).reason === 'composition_unproven');
  const unprovenReply = tweak('gen-ok', 'gen-unproven-reply', function (r) { r.replies[2].composition.init_event.tools = ['Bash']; }, true);
  check('E3m a reply whose init event lists a tool is refused (composition_unproven)', e.verifyJudgeProvenance(unprovenReply, rubric, ctx).reason === 'composition_unproven');
  const bareInit = await e.generateRun({ label: 'gen-bareinit', cells: ['1'], probes: ['A'], runsDir: RUNS, claudeCli: process.execPath, env: ENV_OK, home: STANDIN,
    spawn: function () { return { status: 0, stdout: JSON.stringify({ type: 'system', subtype: 'init' }) + '\n' + JSON.stringify({ type: 'result', result: GLYPH + ' **Larry | MindrianOS**\n\nA reply.' }) + '\n', stderr: '' }; } });
  const bareRun = e.loadRun('gen-bareinit', { runsDir: RUNS });
  check('E3l2 an init event that omits the plugin, server and tool lists is composition_unproven (missing evidence is not an empty list)',
    bareInit.exit === 3 && bareInit.statuses.A['1'] === 'composition_unproven' && bareRun.replies.replies[0].composition.proven === false && e.verifyJudgeProvenance(bareRun, rubric, ctx).ok === false);
  const promptMismatch = tweak('gen-ok', 'gen-promptmismatch', function (r) { r.replies[0].composition.agent_body_sha256 = '0'.repeat(64); }, true);
  check('E3l3 a reply that records a system prompt other than the pinned agent body is refused (hash_mismatch_at_commit)', e.verifyJudgeProvenance(promptMismatch, rubric, ctx).reason === 'hash_mismatch_at_commit');
  const extraPart = tweak('gen-ok', 'gen-extrapart', function (r) { r.replies[1].composition.parts = ['agent_body', 'skills']; }, true);
  check('E3l4 a cell 1 reply whose composition holds a part beyond the agent body is refused', e.verifyJudgeProvenance(extraPart, rubric, ctx).ok === false);
  const cell2run = tweak('gen-ok', 'gen-cell2', function (r, m) {
    r.replies.forEach(function (x) { x.cell = '2'; });
    Object.keys(m.statuses).forEach(function (p) { m.statuses[p] = { '2': 'complete' }; });
    m.cells = ['2'];
  }, true);
  check('E3n a valid generation manifest for cell 2 is refused for Jev (cell_not_eligible) and routed to the claude judge', e.verifyJudgeProvenance(cell2run, rubric, ctx).reason === 'cell_not_eligible');
  const dirty = tweak('gen-ok', 'gen-dirty', function (r, m) { m.inputs_clean = false; }, true);
  check('E3o a run generated with an uncommitted probes, rubric or agent file is refused', e.verifyJudgeProvenance(dirty, rubric, ctx).ok === false);
  const impBad = e.importRun({ label: 'imp-bad', from: RESEARCH, runsDir: RUNS });
  void impBad;
  const impBadRun = tweak('imp-bad', 'research-p-changed', function (r, m) { r.replies[1].text = r.replies[1].text + ' x'; m.label = 'research-p'; }, false);
  check('E3p an import with one reply byte changed is refused (import_content_mismatch)', (function () {
    // the label of the run directory must be research-p for the entry lookup; use a loader view with that label
    const view = Object.assign({}, impBadRun, { label: 'research-p' });
    return e.verifyJudgeProvenance(view, rubric, ctx).reason === 'import_content_mismatch';
  })());
  const impOther = e.loadRun('imp-bad', { runsDir: RUNS });
  check('E3q an import whose label is not in jev_imports is refused (not_in_jev_imports)', e.verifyJudgeProvenance(impOther, rubric, ctx).reason === 'not_in_jev_imports');
  const homeNone = mk('standin-home-nokey-3696-');
  const vNoKey = e.verifySeal(genRun.repliesBytes, genRun.manifest, { home: homeNone });
  check('E3r verifySeal with no key refuses (seal_key_missing) and creates no file and no directory', vNoKey.ok === false && vNoKey.reason === 'seal_key_missing' && fs.readdirSync(homeNone).length === 0);
  function badKey(modeKey, size, linkIt) {
    const h = mk('standin-home-badkey-3696-');
    const dir = path.join(h, '.mindrian', 'eval-seal');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.chmodSync(dir, 0o700);
    const kp = path.join(dir, 'larry-voice.key');
    if (linkIt) {
      const real = path.join(h, 'real.key');
      fs.writeFileSync(real, crypto.randomBytes(32), { mode: 0o600 });
      fs.symlinkSync(real, kp);
    } else {
      fs.writeFileSync(kp, crypto.randomBytes(size), { mode: modeKey });
      fs.chmodSync(kp, modeKey);
    }
    return h;
  }
  check('E3s a key of mode 0644 is refused (seal_key_unsafe)', e.verifySeal(genRun.repliesBytes, genRun.manifest, { home: badKey(0o644, 32, false) }).reason === 'seal_key_unsafe');
  check('E3t a key reached through a symlink is refused (seal_key_unsafe)', e.verifySeal(genRun.repliesBytes, genRun.manifest, { home: badKey(0o600, 32, true) }).reason === 'seal_key_unsafe');
  check('E3u a key of 31 bytes is refused (seal_key_unsafe)', e.verifySeal(genRun.repliesBytes, genRun.manifest, { home: badKey(0o600, 31, false) }).reason === 'seal_key_unsafe');
  const scratchForKey = iso.makeScratch('larry-voice-scratch-', { claudeCli: null });
  OWNED.push(scratchForKey.root);
  check('E3v a key path under a makeScratch root is refused (seal_key_in_scratch)', throwsReason(function () { e.loadSealKey(scratchForKey.home); }, 'seal_key_in_scratch') && throwsReason(function () { e.ensureSealKey(scratchForKey.home); }, 'seal_key_in_scratch'));
  check('E3w the seal key path comes from the real home read when the module loaded (the stand-in), never a scratch HOME', e.sealKeyPath() === path.join(STANDIN, '.mindrian', 'eval-seal', 'larry-voice.key'));

  // ---- E4 transport -----------------------------------------------------------------------------------
  const record = vOk.record;
  const entry0 = record.entries[0];
  const goodBody = e.buildJudgePayload(entry0);
  check('E4a buildJudgePayload is built only from the verified entry: probe id, turn index, prompt, context, reply and the rubric items',
    goodBody.state.probe_id === entry0.probe_id && goodBody.state.reply === entry0.reply && Object.keys(goodBody.questions).join() === entry0.items.map(function (i) { return i.id; }).join() && Object.keys(goodBody.state).sort().join() === 'context,probe_id,prompt,reply,turn_index');
  check('E4b buildJudgePayload throws on an incomplete entry (it reads nothing from probe or run files)', throwsReason(function () { e.buildJudgePayload({ probe_id: 'A' }); }, 'payload_entry_incomplete'));
  check('E4c the ceiling accepts the verified payload', t.assertVoiceEgressCeiling(JSON.parse(JSON.stringify(goodBody)), { verified: record }) === true);
  function ceilingReason(mut) {
    const b = JSON.parse(JSON.stringify(goodBody));
    mut(b);
    try { t.assertVoiceEgressCeiling(b, { verified: record }); return null; } catch (x) { return x.reason; }
  }
  check('E4d a top-level key outside model, state and questions is refused', ceilingReason(function (b) { b.extra = 1; }) === 'disallowed_top_key');
  check('E4e a state key outside the allowed set (a tool log) is refused', ceilingReason(function (b) { b.state.tool_log = []; }) === 'disallowed_state_key');
  check('E4f a probe id outside the verified run is refused', ceilingReason(function (b) { b.state.probe_id = 'Z'; }) === 'probe_id_not_verified');
  check('E4g a reply that does not byte-equal a verified reply is refused', ceilingReason(function (b) { b.state.reply = b.state.reply + ' '; }) === 'reply_not_in_verified_set');
  check('E4h an altered prompt, an altered context, another turn index and an altered rubric item are each refused (payload_tuple_mismatch)',
    ceilingReason(function (b) { b.state.prompt += ' x'; }) === 'payload_tuple_mismatch' && ceilingReason(function (b) { b.state.context += 'x'; }) === 'payload_tuple_mismatch' &&
    ceilingReason(function (b) { b.state.turn_index += 1; }) === 'payload_tuple_mismatch' && ceilingReason(function (b) { const id = Object.keys(b.questions)[0]; b.questions[id].criteria[0] += ' x'; }) === 'payload_tuple_mismatch' &&
    ceilingReason(function (b) { const id = Object.keys(b.questions)[0]; b.questions[id].instructions.judge += ' x'; }) === 'payload_tuple_mismatch');
  const tinyLimits = { reply: 10, prompt: 5000, context: 5000 };
  check('E4h2 a nested field inside instructions, or an instructions value that is not an object, is refused (every transmitted field is covered)',
    ceilingReason(function (b) { b.questions[Object.keys(b.questions)[0]].instructions.private_notes = 'not fixture text'; }) === 'disallowed_instruction_key' &&
    ceilingReason(function (b) { b.questions[Object.keys(b.questions)[0]].instructions = 'text'; }) === 'instructions_not_object' &&
    ceilingReason(function (b) { b.questions[Object.keys(b.questions)[0]].extra = 1; }) === 'disallowed_question_key');
  check('E4i a reply longer than the limit is refused', (function () { try { t.assertVoiceEgressCeiling(JSON.parse(JSON.stringify(goodBody)), { verified: record, limits: tinyLimits }); return false; } catch (x) { return x.reason === 'reply_too_long'; } })());
  check('E4j the limit is set from the fixture and is a finite number', Number.isFinite(e.JUDGE_MAX_REPLY_CHARS) && e.JUDGE_MAX_REPLY_CHARS >= Math.max.apply(null, runP.replies.replies.map(function (r) { return r.text.length; })));
  check('E4k a string that carries a path under a home directory or the word for the owner rooms is refused', (function () {
    const fake = JSON.parse(JSON.stringify(record));
    const e0 = Object.assign({}, fake.entries[0], { reply: 'See /home/someone/notes for the file.' });
    const rec2 = { entries: [e0] };
    try { t.assertVoiceEgressCeiling(e.buildJudgePayload(e0), { verified: rec2 }); return false; } catch (x) { return x.reason === 'home_path_in_payload'; }
  })());
  check('E4l a missing verified record is refused', throwsReason(function () { t.assertVoiceEgressCeiling(goodBody, {}); }, 'verified_record_required'));
  let fetchCount = 0;
  let sentBody = null;
  function stubFetch(answers) {
    return async function (url, init) {
      fetchCount += 1;
      sentBody = init.body;
      return { status: 200, text: async function () { return JSON.stringify({ answers: answers }); } };
    };
  }
  const answers = {};
  Object.keys(goodBody.questions).forEach(function (id) { answers[id] = { score: 2, confidence: 0.9 }; });
  const res = await t.jevVoice('test-key', goodBody, { verified: record, fetchImpl: stubFetch(answers) });
  check('E4m jevVoice sends the same bytes that it serialized once, with one fetch call', res.status === 200 && fetchCount === 1 && sentBody === JSON.stringify(goodBody));
  fetchCount = 0;
  const altered = JSON.parse(JSON.stringify(goodBody));
  altered.state.prompt = altered.state.prompt + ' extra';
  const rej = await rejectsReason(function () { return t.jevVoice('test-key', altered, { verified: record, fetchImpl: stubFetch(answers) }); }, 'payload_tuple_mismatch');
  check('E4n a valid sealed reply with an altered prompt: payload_tuple_mismatch and zero fetch calls', rej && fetchCount === 0);
  const ledgerSrc = fs.readFileSync(path.join(ROOT, 'scripts/build-section-command-ledger.cjs'), 'utf8');
  check('E4o JEV_VOICE_ENDPOINT equals the ENDPOINT literal of the ledger source', (ledgerSrc.match(/const ENDPOINT = '([^']+)'/) || [])[1] === t.JEV_VOICE_ENDPOINT);
  check('E4p scripts/build-section-command-ledger.cjs is byte-unchanged against the plan base', (function () { try { execFileSync('git', ['diff', '--quiet', 'd6a2fdbaa', '--', 'scripts/build-section-command-ledger.cjs'], { cwd: ROOT }); return true; } catch (_x) { return false; } })());
  check('E4q loadKey and pool are reused from the ledger module', typeof t.loadKey === 'function' && typeof t.pool === 'function' && t.loadKey === require('../scripts/build-section-command-ledger.cjs').loadKey);

  // scoring through the transport, then the fallbacks
  const transportOk = function (key, body, o) { return t.jevVoice(key, body, { verified: o.verified, fetchImpl: stubFetch(answers) }); };
  const scJev = await e.scoreRun(genRun, { judge: 'jev', key: 'test-key', transport: transportOk, home: STANDIN });
  check('E4r --judge jev on the sealed run scores judge items with the judge named jev', scJev.entries.length === 9 && scJev.entries.every(function (x) { return x.items.R6 ? (x.items.R6.status === 'not_applicable' || x.items.R6.judge === 'jev') : true; }) && scJev.jev_refusals.length === 0);
  const claudeStub = async function (ent, ids) { const out = {}; ids.forEach(function (id) { out[id] = { value: 2, confidence: 0.9 }; }); return { results: out }; };
  const transportRefuse = function () { const x = new Error('stubbed refusal'); x.reason = 'stub_refused'; throw x; };
  const scFallback = await e.scoreRun(genRun, { judge: 'auto', key: 'test-key', transport: transportRefuse, claudeJudge: claudeStub, home: STANDIN });
  check('E4s with the transport stubbed to refuse, --judge auto falls back to the claude judge and keeps the refusal reason',
    scFallback.entries.every(function (x) { return x.items.R7.judge === 'claude' && x.items.R7.status === 'scored'; }) && scFallback.jev_refusals.length === 9 && scFallback.jev_refusals.every(function (r) { return r.reason === 'stub_refused'; }));
  const claudeOff = async function () { return { refused: 'no_isolated_credential' }; };
  const transport503 = async function () { return { status: 503, ms: 1, json: null }; };
  const sc503 = await e.scoreRun(genRun, { judge: 'auto', key: 'test-key', transport: transport503, claudeJudge: claudeStub, home: STANDIN });
  check('E4s2 a Jev HTTP failure (503) is a failed leg: auto falls back to the claude judge and records jev_http_503',
    sc503.entries.every(function (x) { return x.items.R7.judge === 'claude'; }) && sc503.jev_refusals.length === 9 && sc503.jev_refusals.every(function (r) { return r.reason === 'jev_http_503'; }));
  const judgeCalls = [];
  const spyScore = await e.scoreRun(runP, { judge: 'claude', env: ENV_OK, claudeCli: process.execPath, spawn: function (sc, cmd, args) { judgeCalls.push(args[args.length - 1]); return { status: 0, stdout: JSON.stringify({ result: '{"R5":{"score":2}}' }), stderr: '' }; } });
  const dCall = judgeCalls.filter(function (c) { return /bottom line/.test(c); })[0] || '';
  check('E4s3 the claude judge input carries the turn index and the supplied context, as the Jev payload does',
    spyScore.entries.length === 5 && /Turn index: 4/.test(dCall) && /Conversation so far:/.test(dCall) && /two grant programs/.test(dCall) && /Larry reply:/.test(dCall));
  const scNone = await e.scoreRun(genRun, { judge: 'auto', key: 'test-key', transport: transportRefuse, claudeJudge: claudeOff, home: STANDIN });
  check('E4t with claude also off the judge items are not_scored with the reason recorded', scNone.entries.every(function (x) { return x.items.R7.status === 'not_scored' && x.judge_reasons.some(function (r) { return /no_isolated_credential/.test(r); }); }));
  const scCell2 = await e.scoreRun(cell2run, { judge: 'auto', key: 'test-key', transport: transportOk, claudeJudge: claudeStub, home: STANDIN });
  check('E4u a cell 2 run goes to the claude judge, never to Jev, and the Jev refusal reason is recorded', scCell2.entries.every(function (x) { return x.items.R7.judge === 'claude'; }) && scCell2.jev_refusals.some(function (r) { return r.reason === 'cell_not_eligible'; }));
  const scNoKey = await e.scoreRun(runP, { judge: 'jev', key: null, transport: transportOk, home: STANDIN });
  check('E4v with no Jev key the run records no_jev_key and scores nothing by Jev', scNoKey.jev_refusals.some(function (r) { return r.reason === 'no_jev_key'; }) && scNoKey.entries.every(function (x) { return x.items.R7.status === 'not_scored'; }));

  // ---- E5 compare -------------------------------------------------------------------------------------
  const credit = new Set(checks.NEVER_SAY_TERMS);
  void credit;
  const term = checks.NEVER_SAY_TERMS.filter(function (x) { return !checks.findMachineryNarration('I checked the ' + x + ' for you.', { userText: 'hi' }).ok; })[0];
  function goodReply(p) {
    const id = p.turn_index === 1 ? "I'm Larry, MindrianOS's PwS thinking partner, powered by Claude. " : '';
    return GLYPH + ' **Larry | MindrianOS**\n\n' + id + 'Short answer first. Your lab has a capability, not yet a product. Who loses time when humidity swings? Name one person.';
  }
  const claudeJudgeStub = async function (ent, ids) {
    const out = {};
    ids.forEach(function (id) { out[id] = { value: /LOWSCORE/.test(ent.reply) ? 0 : 2, confidence: 0.9 }; });
    return { results: out };
  };
  async function buildRun(label, spec) {
    const s = spec || {};
    const kind = s.kind || 'voice-fixture-generation';
    const operation = kind === 'operation-generation';
    const cells = s.cells || (operation ? ['2s-live', '3s-live'] : ['1', '2', '3', '2s', '3s']);
    const list = (operation ? probes.operation_probes : probes.probes).filter(function (p) { return !s.dropProbes || s.dropProbes.indexOf(p.id) === -1; });
    const replies = [];
    const statuses = {};
    list.forEach(function (p) { statuses[p.id] = {}; });
    cells.forEach(function (cell) {
      if (s.dropCells && s.dropCells.indexOf(cell) !== -1) return;
      list.forEach(function (p) {
        const n = s.samples ? s.samples(p.id, cell) : 1;
        for (let i = 1; i <= n; i += 1) {
          const text = s.replyFor ? s.replyFor(p, cell, i) : goodReply(p);
          replies.push({ probe: p.id, cell: cell, sample: i, text: text, prompt: p.prompt, context: p.context || '', turn_index: p.turn_index || 1 });
        }
        statuses[p.id][cell] = 'complete';
      });
    });
    const repliesBytes = Buffer.from(JSON.stringify({ version: 1, label: label, kind: kind, replies: replies }, null, 2) + '\n');
    const manifest = e.writeRunManifest({ kind: kind, label: label, repliesBytes: repliesBytes, statuses: statuses, cells: cells, rubric: rubric });
    if (s.mutateManifest) s.mutateManifest(manifest);
    const dir = path.join(RUNS, label);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'replies.json'), repliesBytes);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    const loaded = e.loadRun(label, { runsDir: RUNS });
    const scores = await e.scoreRun(loaded, { judge: s.judge || 'claude', claudeJudge: s.claudeJudge || claudeJudgeStub });
    if (s.mutateScores) s.mutateScores(scores);
    fs.writeFileSync(path.join(dir, 'scores.json'), JSON.stringify(scores, null, 2) + '\n');
    return e.loadRun(label, { runsDir: RUNS });
  }
  const before = await buildRun('before');
  const afterSame = await buildRun('after-same');
  const r1 = e.compareRuns(before, afterSame, { rubric: rubric, probes: probes });
  check('E5a identical complete runs: COMPLETE, exit 0, no drop', r1.outcome === 'COMPLETE' && r1.exit === 0 && r1.regressions.length === 0 && r1.incomplete.length === 0, JSON.stringify(r1.incomplete.slice(0, 3)));
  check('E5b the result is per cell and per probe, with a total per probe and cell and no key holding a total across cells',
    Object.keys(r1.per_cell).join() === '1,2,3,2s,3s' && r1.per_cell['1'].A.total && r1.per_cell['3s'].K.R14 && !('total' in r1) && !('overall' in r1) && !('aggregate' in r1) && !/"overall"|"aggregate"/.test(JSON.stringify(r1)));
  check('E5c probe E R3 is not applicable by na_report_mode and the rest of the matrix is scored: still COMPLETE',
    r1.per_cell['1'].E.R3 && r1.per_cell['1'].E.R3.na === true && r1.per_cell['1'].E.R3.rule === 'na_report_mode' && r1.outcome === 'COMPLETE');
  check('E5d OP2 to OP5 are not applicable on the voice cells by na_operation_on_voice_cell', r1.per_cell['2s'].A.OP1 && r1.per_cell['2s'].A.OP1.verdict !== 'not_applicable');
  const cutBoth1 = await buildRun('before-cut3', { dropCells: ['3'] });
  const cutBoth2 = await buildRun('after-cut3', { dropCells: ['3'] });
  const r2 = e.compareRuns(cutBoth1, cutBoth2, { rubric: rubric, probes: probes });
  check('E5e two runs truncated the same way (both lack cell 3) are INCOMPLETE, exit 3, never COMPLETE', r2.outcome === 'INCOMPLETE' && r2.exit === 3 && r2.incomplete.some(function (x) { return x.cell === '3' && x.reason === 'missing'; }));
  const cutK1 = await buildRun('before-cutk', { dropProbes: ['K'] });
  const cutK2 = await buildRun('after-cutk', { dropProbes: ['K'] });
  check('E5f two runs that both lack probe K are INCOMPLETE, exit 3', e.compareRuns(cutK1, cutK2, { rubric: rubric, probes: probes }).exit === 3);
  const unruled = await buildRun('after-unruled', { mutateScores: function (sc) { sc.entries.filter(function (x) { return x.probe === 'A' && x.cell === '1'; }).forEach(function (x) { x.items.R3 = { value: null, status: 'not_applicable', rule: 'na_report_mode', judge: null }; }); } });
  const r3 = e.compareRuns(before, unruled, { rubric: rubric, probes: probes });
  check('E5g a run that marks R3 not applicable on probe A (no rule gives it) is INCOMPLETE, exit 3', r3.outcome === 'INCOMPLETE' && r3.exit === 3 && r3.incomplete.some(function (x) { return x.reason === 'unruled_not_applicable' && x.probe === 'A'; }));
  const worse = await buildRun('after-worse', { replyFor: function (p, cell) { return p.id === 'A' && cell === '1' ? goodReply(p).replace('Name one person.', 'Why does it matter? How would you test it? Who decides?') : goodReply(p); } });
  const r4 = e.compareRuns(before, worse, { rubric: rubric, probes: probes });
  check('E5h a drop of R8 on one probe and cell is REGRESSION, exit 1 (R8 is code-scored, never retried)', r4.outcome === 'REGRESSION' && r4.exit === 1 && r4.regressions.some(function (x) { return x.probe === 'A' && x.cell === '1' && x.item === 'R8'; }) && r4.retry_available.length === 0);
  const worseAndCut = await buildRun('after-worse-cut', { dropCells: ['3'], replyFor: function (p, cell) { return p.id === 'A' && cell === '1' ? goodReply(p).replace('Name one person.', 'Why does it matter? How would you test it? Who decides?') : goodReply(p); } });
  check('E5i a REGRESSION wins over incomplete parts (cell 3 missing): exit 1', e.compareRuns(before, worseAndCut, { rubric: rubric, probes: probes }).exit === 1);
  const never = await buildRun('after-never', { replyFor: function (p, cell) { return p.id === 'G' && cell === '2' ? goodReply(p).replace('Short answer first.', 'I checked the ' + term + ' for you.') : goodReply(p); } });
  const neverEntry = never.scores.entries.filter(function (x) { return x.probe === 'G' && x.cell === '2'; })[0];
  const r5 = e.compareRuns(before, never, { rubric: rubric, probes: probes });
  check('E5j an AFTER voice-cell reply with a never-say term and no tool log scores OP1 0 (status scored, reply text alone); compare against a clean BEFORE is REGRESSION, exit 1',
    neverEntry.items.OP1.value === 0 && neverEntry.items.OP1.status === 'scored' && r5.outcome === 'REGRESSION' && r5.exit === 1 && r5.regressions.some(function (x) { return x.item === 'OP1' && x.probe === 'G' && x.cell === '2'; }) && r5.regressions.some(function (x) { return x.kind === 'gate'; }) === true);
  const abstainR14 = async function (ent, ids) { const out = {}; ids.forEach(function (id) { out[id] = id === 'R14' ? { abstained: true, reason: 'below_confidence_floor' } : { value: 2, confidence: 0.9 }; }); return { results: out }; };
  const r14run = await buildRun('after-r14abstain', { claudeJudge: abstainR14 });
  const rNotes = e.compareRuns(before, r14run, { rubric: rubric, probes: probes });
  check('E5k0 an item where the judge abstained and the code half decided alone (R14) is surfaced in the notes, and the judge label changes, so the comparison is INCOMPLETE rather than silent',
    rNotes.notes.some(function (x) { return x.item === 'R14' && x.side === 'after' && /abstained/.test(x.note); }) && rNotes.outcome === 'INCOMPLETE');
  const abstainJudge = async function (ent, ids) { const out = {}; ids.forEach(function (id) { out[id] = id === 'R7' && ent.probe_id === 'C' ? { abstained: true, reason: 'below_confidence_floor' } : { value: 2, confidence: 0.9 }; }); return { results: out }; };
  const abst = await buildRun('after-abstain', { claudeJudge: abstainJudge });
  const r6 = e.compareRuns(before, abst, { rubric: rubric, probes: probes });
  check('E5k an abstained judge item leaves the total of that probe not scored: INCOMPLETE, exit 3', r6.outcome === 'INCOMPLETE' && r6.exit === 3 && r6.incomplete.some(function (x) { return x.probe === 'C' && x.item === 'total' && x.reason === 'abstained'; }));
  const swapped = await buildRun('after-judge', { mutateScores: function (sc) { sc.entries.forEach(function (x) { Object.keys(x.items).forEach(function (id) { if (x.items[id].judge === 'claude') x.items[id].judge = 'jev'; }); }); } });
  const r7 = e.compareRuns(before, swapped, { rubric: rubric, probes: probes });
  check('E5l a judge change on an acceptance item is INCOMPLETE (never compare across judges)', r7.outcome === 'INCOMPLETE' && r7.incomplete.some(function (x) { return x.reason === 'judge_changed'; }));
  check('E5l1 the judge-change rule covers the gate-only item R15 too: no regression is reported across judges, only judge_changed', r7.incomplete.some(function (x) { return x.item === 'R15' && x.reason === 'judge_changed'; }) && !r7.regressions.some(function (x) { return x.item === 'R15'; }));
  const stale = await buildRun('after-stale', { mutateScores: function (sc) { sc.replies_sha256 = 'b'.repeat(64); } });
  const rStale = e.compareRuns(before, stale, { rubric: rubric, probes: probes });
  check('E5l2 scores that belong to other reply bytes are never applied: INCOMPLETE (scores_stale), exit 3', rStale.exit === 3 && rStale.incomplete.some(function (x) { return x.reason === 'scores_stale'; }));
  const noStatus = await buildRun('after-nostatus', { mutateManifest: function (m) { m.statuses = {}; } });
  const rNoStatus = e.compareRuns(before, noStatus, { rubric: rubric, probes: probes });
  check('E5l3 manifest statuses that are absent are not complete: INCOMPLETE (cell_status_missing), exit 3', rNoStatus.exit === 3 && rNoStatus.incomplete.some(function (x) { return x.reason === 'cell_status_missing'; }));
  const partial = await buildRun('after-partial', { mutateManifest: function (m) { m.statuses.A['1'] = 'partial'; } });
  const r8 = e.compareRuns(before, partial, { rubric: rubric, probes: probes });
  check('E5m a manifest cell marked partial is INCOMPLETE', r8.outcome === 'INCOMPLETE' && r8.incomplete.some(function (x) { return x.reason === 'cell_partial'; }));
  const unp = await buildRun('after-unp', { mutateManifest: function (m) { m.statuses.C['3'] = 'composition_unproven'; } });
  check('E5n a manifest cell marked composition_unproven is INCOMPLETE', e.compareRuns(before, unp, { rubric: rubric, probes: probes }).incomplete.some(function (x) { return x.reason === 'cell_composition_unproven'; }));
  const hashed = await buildRun('after-hash', { mutateManifest: function (m) { m.probes_sha256 = 'a'.repeat(64); } });
  check('E5o a probe set hash change is INCOMPLETE', e.compareRuns(before, hashed, { rubric: rubric, probes: probes }).incomplete.some(function (x) { return x.reason === 'probes_sha256_differs'; }));
  const none = await buildRun('after-none', { judge: 'none' });
  check('E5p a run scored with no judge cannot be COMPLETE (the totals are not scored): exit 3 or 1, never 0', [1, 3].indexOf(e.compareRuns(before, none, { rubric: rubric, probes: probes }).exit) !== -1);
  function opScores(valueFor) {
    return function (sc) {
      sc.entries.forEach(function (x) {
        ['OP2', 'OP3', 'OP5'].forEach(function (id) { x.items[id] = { value: valueFor(x, id), status: 'scored', judge: 'log+claude', scorer: 'log' }; });
      });
    };
  }
  const opBefore = await buildRun('op-before', { kind: 'operation-generation', mutateScores: opScores(function () { return 2; }) });
  const opAfter = await buildRun('op-after', { kind: 'operation-generation', mutateScores: opScores(function () { return 2; }) });
  const rOp = e.compareRuns(opBefore, opAfter, { rubric: rubric, probes: probes });
  check('E5p2 two fully scored operation runs compare COMPLETE: the OP2, OP3 and OP5 values stored by the tool-log parser are restored', rOp.outcome === 'COMPLETE' && rOp.exit === 0 && rOp.run_kind === 'operation', JSON.stringify(rOp.incomplete.slice(0, 3)));
  const opDrop = await buildRun('op-drop', { kind: 'operation-generation', mutateScores: opScores(function (x, id) { return id === 'OP5' && x.probe === 'OG' ? 0 : 2; }) });
  const rOpDrop = e.compareRuns(opBefore, opDrop, { rubric: rubric, probes: probes });
  check('E5p3 a drop of a reported operation item (OP5) is visible in the per-cell verdict even though it is not an acceptance item', rOpDrop.per_cell['2s-live'].OG.OP5.verdict === 'down' && rOpDrop.regressions.every(function (x) { return x.item !== 'OP5'; }));
  const opNoLog = await buildRun('op-nolog', { kind: 'operation-generation' });
  check('E5p4 an operation run with no stored tool-log scores leaves OP2, OP3 and OP5 missing or unscored: INCOMPLETE, exit 3', e.compareRuns(opNoLog, opNoLog, { rubric: rubric, probes: probes }).exit === 3);
  const opRun = await buildRun('after-op', { kind: 'operation-generation', judge: 'none' });
  const r9 = e.compareRuns(before, opRun, { rubric: rubric, probes: probes });
  check('E5q a voice BEFORE against an operation AFTER is REFUSED (run_kind_mismatch), exit 2', r9.outcome === 'REFUSED' && r9.exit === 2 && r9.refusals[0].reason === 'run_kind_mismatch');
  const noKind = JSON.parse(JSON.stringify({ manifest: before.manifest }));
  delete noKind.manifest.run_kind;
  const r10 = e.compareRuns(Object.assign({}, before, { manifest: noKind.manifest }), afterSame, { rubric: rubric, probes: probes });
  check('E5r a manifest with no run_kind is REFUSED (run_kind_invalid), exit 2', r10.outcome === 'REFUSED' && r10.refusals[0].reason === 'run_kind_invalid');
  check('E5s loadRun refuses a manifest with no run_kind', (function () {
    const d = path.join(RUNS, 'after-nokind');
    fs.mkdirSync(d, { recursive: true });
    const m = JSON.parse(JSON.stringify(before.manifest));
    delete m.run_kind;
    fs.writeFileSync(path.join(d, 'replies.json'), before.repliesBytes);
    fs.writeFileSync(path.join(d, 'manifest.json'), JSON.stringify(m));
    return throwsReason(function () { e.loadRun('after-nokind', { runsDir: RUNS }); }, 'run_kind_invalid');
  })());
  const wrongCell = await buildRun('after-wrongcell', { cells: ['1', '2s-live'] });
  check('E5t a reply whose cell is outside the selected matrix is REFUSED (run_kind_cell_mismatch)', e.compareRuns(before, wrongCell, { rubric: rubric, probes: probes }).refusals.some(function (x) { return x.reason === 'run_kind_cell_mismatch'; }));
  check('E5u a label outside evals/larry-voice/runs is refused: exit 2 from the command line', await (async function () {
    const realWrite = process.stderr.write;
    process.stderr.write = function () { return true; };
    try { return (await e.cli(['compare', '--before', '../outside', '--after', 'research-p'])) === 2; } finally { process.stderr.write = realWrite; }
  })() && throwsReason(function () { e.resolveLabelDir('../x', RUNS); }, 'label_outside_runs') && throwsReason(function () { e.resolveLabelDir('a/b', RUNS); }, 'label_outside_runs'));
  const lowOne = await buildRun('after-low1', { replyFor: function (p, cell, i) { return p.id === 'A' && cell === '1' ? goodReply(p).replace('Short answer first.', 'Short answer first LOWSCORE.') : goodReply(p); } });
  const r11 = e.compareRuns(before, lowOne, { rubric: rubric, probes: probes });
  check('E5v a judge-scored drop with one after sample is REGRESSION and names the allowed retry', r11.outcome === 'REGRESSION' && r11.regressions.some(function (x) { return x.probe === 'A' && x.cell === '1' && x.item === 'total'; }) && r11.retry_available.length > 0);
  const lowMedian = await buildRun('after-low3', { samples: function (pid, cell) { return pid === 'A' && cell === '1' ? 3 : 1; }, replyFor: function (p, cell, i) { return p.id === 'A' && cell === '1' && i === 1 ? goodReply(p).replace('Short answer first.', 'Short answer first LOWSCORE.') : goodReply(p); } });
  const r12 = e.compareRuns(before, lowMedian, { rubric: rubric, probes: probes });
  check('E5w after the retry (three samples) the median of three is compared: one low sample no longer drops, COMPLETE', r12.outcome === 'COMPLETE' && r12.exit === 0, JSON.stringify(r12.regressions.slice(0, 2)));
  const lowTwo = await buildRun('after-low3b', { samples: function (pid, cell) { return pid === 'A' && cell === '1' ? 3 : 1; }, replyFor: function (p, cell, i) { return p.id === 'A' && cell === '1' && i <= 2 ? goodReply(p).replace('Short answer first.', 'Short answer first LOWSCORE.') : goodReply(p); } });
  check('E5x a median that still drops is a REGRESSION', e.compareRuns(before, lowTwo, { rubric: rubric, probes: probes }).exit === 1);
  const codeDisagree = await buildRun('after-codedisagree', { samples: function (pid, cell) { return pid === 'A' && cell === '1' ? 3 : 1; }, replyFor: function (p, cell, i) { return p.id === 'A' && cell === '1' && i === 1 ? goodReply(p).replace('Short answer first.', 'Short answer first -- then the reframe.') : goodReply(p); } });
  const rCode = e.compareRuns(before, codeDisagree, { rubric: rubric, probes: probes });
  check('E5x2 samples that disagree on a code-scored item outside the acceptance subset (R12) are flagged: INCOMPLETE, exit 3, never hidden by the median total',
    rCode.exit === 3 && rCode.incomplete.some(function (x) { return x.item === 'R12' && x.reason === 'code_samples_disagree'; }), JSON.stringify(rCode.incomplete.slice(0, 2)) + ' ' + rCode.outcome);
  const four = await buildRun('after-four', { samples: function (pid, cell) { return pid === 'A' && cell === '1' ? 4 : 1; } });
  check('E5y a second retry (four samples for one probe and cell) is refused', e.compareRuns(before, four, { rubric: rubric, probes: probes }).refusals.some(function (x) { return x.reason === 'second_retry_refused'; }));
  const txt = e.formatCompareText(r4);
  check('E5z the text report names the outcome, the exit and the regression', /REGRESSION \(exit 1\)/.test(txt) && /cell 1 probe A R8/.test(txt));

  // ---- E6 sampling ------------------------------------------------------------------------------------
  const J = function (v, judge) { return { value: v, status: 'scored', judge: judge }; };
  check('E6a the median of three samples for a judge-scored item', e.aggregateSamples([J(2, 'claude'), J(0, 'claude'), J(2, 'claude')]).value === 2 && e.aggregateSamples([J(0, 'claude'), J(0, 'claude'), J(2, 'claude')]).value === 0);
  const agree = e.aggregateSamples([J(2, 'code'), J(0, 'code')]);
  check('E6b a code-scored item with samples that disagree is flagged', agree.flagged === 'code_samples_disagree');
  check('E6c a code-scored item with agreeing samples is not flagged', e.aggregateSamples([J(2, 'code'), J(2, 'code')]).flagged === null);
  check('E6d four samples are refused (second_retry_refused)', e.aggregateSamples([J(2, 'code'), J(2, 'code'), J(2, 'code'), J(2, 'code')]).reason === 'second_retry_refused');
  const mixed = e.aggregateSamples([J(0, 'jev'), J(2, 'claude'), J(2, 'claude')]);
  check('E6d2 samples scored by different judges are flagged mixed_judges (never labeled with the first judge alone)', mixed.flagged === 'mixed_judges' && mixed.judge === 'claude+jev');
  check('E6e a missing item is missing, an unscored sample keeps its status', e.aggregateSamples([]).status === 'missing' && e.aggregateSamples([{ value: null, status: 'abstained', judge: 'jev' }]).status === 'abstained');

  // ---- E7 live leg -----------------------------------------------------------------------------------
  const envSkip = Object.assign({}, process.env, { MINDRIAN_SKIP_LIVE_CLAUDE: '1', CLAUDE_CODE_OAUTH_TOKEN: 'x' });
  const g1 = await e.generateRun({ label: 'live-skip', cells: ['1'], runsDir: RUNS, spawn: stubSpawn(), claudeCli: process.execPath, env: envSkip, home: STANDIN });
  check('E7a MINDRIAN_SKIP_LIVE_CLAUDE=1 exits 77 with a printed reason', g1.exit === 77 && g1.reason === 'skip_live_claude');
  const envNoCred = Object.assign({}, process.env);
  delete envNoCred.MINDRIAN_SKIP_LIVE_CLAUDE; delete envNoCred.CLAUDE_CODE_OAUTH_TOKEN; delete envNoCred.ANTHROPIC_API_KEY;
  const g2 = await e.generateRun({ label: 'live-nocred', cells: ['1'], runsDir: RUNS, spawn: stubSpawn(), claudeCli: process.execPath, env: envNoCred, home: STANDIN });
  check('E7b no credential variable exits 77 with reason no_isolated_credential', g2.exit === 77 && g2.reason === 'no_isolated_credential');
  process.env.LARRY_VOICE_REQUIRE_LIVE = '1';
  const g3 = await e.generateRun({ label: 'live-require', cells: ['1'], runsDir: RUNS, spawn: stubSpawn(), claudeCli: process.execPath, env: envNoCred, home: STANDIN });
  delete process.env.LARRY_VOICE_REQUIRE_LIVE;
  check('E7c the same condition under LARRY_VOICE_REQUIRE_LIVE=1 exits 1', g3.exit === 1 && g3.reason === 'no_isolated_credential');
  const g4 = await e.generateRun({ label: 'live-nocli', cells: ['1'], runsDir: RUNS, spawn: stubSpawn(), claudeCli: null, env: ENV_OK, home: STANDIN });
  check('E7d a missing claude CLI exits 77 with reason claude_cli_missing', g4.exit === 77 && g4.reason === 'claude_cli_missing');
  const sessionEscapes = iso.scanFile('scripts/session-start').length;
  const g5 = await e.generateRun({ label: 'live-partial', cells: ['1', '2'], probes: ['A'], runsDir: RUNS, spawn: stubSpawn(), claudeCli: process.execPath, env: ENV_OK, home: STANDIN });
  check('E7e some cells complete and others do not: exit 3 (a partial live run), the skipped cell and its reason are recorded',
    sessionEscapes > 0 ? (g5.exit === 3 && /isolation_canary_failed/.test(g5.skipped['2']) && g5.statuses.A['1'] === 'complete' && g5.statuses.A['2'] === 'skipped') : g5.exit === 0);
  const g5run = e.loadRun('live-partial', { runsDir: RUNS });
  check('E7f a partial run is never eligible for Jev', sessionEscapes > 0 ? e.verifyJudgeProvenance(g5run, rubric, ctx).ok === false : true);
  check('E7g the generate and judge arg builders refuse a model id containing fable (any case)',
    throwsReason(function () { e.buildGenerateArgs({ systemPromptFile: 'f', prompt: 'p', model: 'claude-Fable-1' }); }, 'model_refused') && throwsReason(function () { e.buildJudgeArgs({ systemText: 's', model: 'fable' }); }, 'model_refused'));
  const okArgs = e.buildGenerateArgs({ systemPromptFile: 'f', prompt: 'p', model: 'sonnet' });
  check('E7h the generate args carry no plugin directory, an empty tool list, no saved session and the model as given', okArgs.indexOf('--plugin-dir') === -1 && okArgs[okArgs.indexOf('--tools') + 1] === '' && okArgs.indexOf('--no-session-persistence') !== -1 && okArgs[okArgs.indexOf('--model') + 1] === 'sonnet');
  check('E7i generateRun refuses a model with fable before any other step', await rejectsReason(function () { return e.generateRun({ label: 'live-fable', cells: ['1'], runsDir: RUNS, model: 'fable', env: ENV_OK }); }, 'model_refused'));
  check('E7j an existing label is never overwritten (label_exists)', await rejectsReason(function () { return e.generateRun({ label: 'gen-ok', cells: ['1'], runsDir: RUNS, spawn: stubSpawn(), claudeCli: process.execPath, env: ENV_OK, home: STANDIN }); }, 'label_exists'));

  // ---- ledger rows -----------------------------------------------------------------------------------
  const rows = e.ledgerRows({ run: before, plan: '369.6-02', shares: 'shares-for-test' });
  check('E7k ledger-row prints one row per cell plus the operation row, each with the plan, a status and the doctrine note',
    rows.length === 6 && rows.slice(0, 5).every(function (r) { return /COMPLETE/.test(r) && /369\.6-02/.test(r); }) && /NOT RUN/.test(rows[5]) && rows.every(function (r) { return /doctrine/.test(r); }));
  const onlyA = await buildRun('only-a', { dropProbes: ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'K'] });
  const rowsOnlyA = e.ledgerRows({ run: onlyA, plan: 'p', shares: 'x' });
  check('E7k2 a scored run that lacks required probes prints INCOMPLETE with the missing probes, never COMPLETE', rowsOnlyA.slice(0, 5).every(function (r) { return /INCOMPLETE: missing probes C,D,E,F,G,H,I,K/.test(r) && !/\| COMPLETE \|/.test(r); }));
  const rowsPartial = e.ledgerRows({ run: g5run, plan: '369.6-02', shares: 'x' });
  check('E7l a run without scores prints NOT RUN: not scored', e.ledgerRows({ run: g5run, plan: 'p', shares: 'x' })[0].indexOf('NOT RUN') !== -1 && rowsPartial.length >= 2);

  // ---- E8 hygiene ------------------------------------------------------------------------------------
  const EM = String.fromCharCode(0x2014);
  const EN = String.fromCharCode(0x2013);
  const files = ['scripts/eval-larry-voice.cjs', 'scripts/jev-voice-transport.cjs', 'tests/test-3696-rubric-eval.cjs'];
  check('E8a no em-dash or en-dash in the three files', files.every(function (f) { const x = fs.readFileSync(path.join(ROOT, f), 'utf8'); return x.indexOf(EM) === -1 && x.indexOf(EN) === -1; }));
  const evalSrc = fs.readFileSync(path.join(ROOT, 'scripts/eval-larry-voice.cjs'), 'utf8');
  const transportSrc = fs.readFileSync(path.join(ROOT, 'scripts/jev-voice-transport.cjs'), 'utf8');
  const code = (evalSrc + '\n' + transportSrc).split('\n').filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); });
  check('E8b the ledger ceiling and client are never called here (no assertEgressCeiling, no jev( call, no loadKey definition)', code.filter(function (l) { return /assertEgressCeiling|[^A-Za-z]jev\(|function loadKey/.test(l); }).length === 0);
  check('E8c no child inherits the parent environment', !/env: process\.env|\.\.\.process\.env/.test(evalSrc));
  check('E8d the eval names the owner rooms nowhere', !/MindrianRooms/.test(evalSrc));
  check('E8e the seal key is created with randomBytes(32) and the exclusive flag, and never printed', /randomBytes\(32\)/.test(evalSrc) && /'wx'/.test(evalSrc) && !/console\.|stdout\.write\([^)]*key/i.test(evalSrc.split('async function cli')[0]));
  check('E8f the net guard counted zero fetch calls in the test process', NET.attempts() === 0);

  OWNED.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_x) { /* best effort */ } });
  process.exit(C.summary());
})().catch(function (err) {
  console.log('FAIL: unexpected error ' + (err && err.stack || err));
  OWNED.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_x) { /* best effort */ } });
  process.exit(1);
});
