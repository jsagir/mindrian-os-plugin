#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 plan 02 Task 3 (D-17, D-22, D-30, D-43, A-03, R-01, R-15; Codex C3, C4 and rounds 2 and 3):
 * the Larry voice eval. It scores replies against evals/larry-voice/rubric.json, per probe and per cell,
 * and compares two runs over the required matrix that rubric.json defines apart from either run.
 *
 *   import      a P-probe-replies shaped research file becomes a run (kind research-import).
 *   generate    one claude --print per probe and cell, under the isolation contract of
 *               scripts/isolate-larry-voice.cjs; the run is sealed (local HMAC key).
 *   score       the code half (always) and the judge half (jev | claude | none | auto). Jev sees a run only after
 *               verifyJudgeProvenance re-derives its provenance (pre-egress, fail closed).
 *   compare     per cell and per probe, never one aggregate. Four outcomes: COMPLETE 0, REGRESSION 1,
 *               REFUSED 2, INCOMPLETE 3. An incomplete comparison never exits 0.
 *   ledger-row  one markdown row per cell for the measurement ledger.
 *
 * Fixture-only: a label resolves under evals/larry-voice/runs/ by realpath containment; a room only ever
 * exists inside a scratch root; nothing here reads or lists the owner's rooms. Canon Part 8: invented fixture
 * text only reaches a vendor, and only through jevVoice of scripts/jev-voice-transport.cjs.
 *
 * Exit codes: 0 ok, 1 regression or a loud live failure, 2 refused, 3 incomplete or a partial live run,
 * 77 the live leg cannot run (NOT RUN, with a reason). Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = fs.realpathSync(path.resolve(__dirname, '..'));
const RUNS_DIR = path.join(REPO_ROOT, 'evals', 'larry-voice', 'runs');
const RUBRIC_REL = 'evals/larry-voice/rubric.json';
const PROBES_REL = 'evals/larry-voice/probes.json';
const AGENT_REL = 'agents/larry-extended.md';
const OUTPUT_STYLE_REL = 'output-styles/destijl.md';
const TRANSCRIPT_REL = 'evals/larry-voice/fixtures/rung3-tool-noise.jsonl';

// The longest reply that may reach a vendor judge. Set from the longest reply the fixture probe set produces
// (research-p: 1488 characters for sample E, read from evals/larry-voice/runs/research-p/replies.json), rounded
// up to the next 1000. Raising it is a deliberate diff, because it widens what jevVoice accepts.
const JUDGE_MAX_REPLY_CHARS = 2000;
const JUDGE_MAX_PROMPT_CHARS = 1200;
const JUDGE_MAX_CONTEXT_CHARS = 2400;
const SEAL_SCRATCH_PREFIX = 'larry-voice-scratch-';
const JEV_CONFIDENCE_FLOOR_FALLBACK = 0.5;

// The home of the orchestrating user, read once when this module loads and passed explicitly to the seal
// functions. It is never the scratch HOME of makeScratch or isolatedEnv (Codex round 3 LOW).
const REAL_HOME = os.homedir();

function fail(reason, detail, exit) {
  const e = new Error(reason + (detail ? ': ' + detail : ''));
  e.reason = reason;
  e.detail = detail || null;
  e.exit = exit === undefined ? 2 : exit;
  return e;
}

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(function (k) { return JSON.stringify(k) + ':' + canonical(value[k]); }).join(',') + '}';
  }
  return JSON.stringify(value);
}

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
  }
  return o;
}

function git(args, opts) {
  const r = spawnSync('git', args, { cwd: (opts && opts.cwd) || REPO_ROOT, encoding: opts && opts.buffer ? 'buffer' : 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60000 });
  return r;
}

function gitShow(commit, rel, opts) {
  if (!/^[0-9a-f]{7,40}$/.test(String(commit))) return null;
  const r = git(['show', commit + ':' + rel], { cwd: opts && opts.repoRoot, buffer: true });
  return r.status === 0 ? r.stdout : null;
}

function gitHead(opts) {
  const r = git(['rev-parse', 'HEAD'], opts);
  return r.status === 0 ? String(r.stdout).trim() : null;
}

function isAncestor(commit, opts) {
  if (!/^[0-9a-f]{7,40}$/.test(String(commit))) return false;
  return git(['merge-base', '--is-ancestor', commit, 'HEAD'], opts).status === 0;
}

function readJson(abs) { return JSON.parse(fs.readFileSync(abs, 'utf8')); }

function loadRubric(repoRoot) { return readJson(path.join(repoRoot || REPO_ROOT, RUBRIC_REL)); }
function loadProbes(repoRoot) { return readJson(path.join(repoRoot || REPO_ROOT, PROBES_REL)); }

// ---------------------------------------------------------------------------------------------
// labels and run directories
// ---------------------------------------------------------------------------------------------
function resolveLabelDir(label, runsDir) {
  const base = runsDir || RUNS_DIR;
  if (typeof label !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(label) || label.indexOf('..') !== -1) {
    throw fail('label_outside_runs', String(label));
  }
  const dir = path.resolve(base, label);
  const rel = path.relative(base, dir);
  if (!rel || rel.indexOf('..') === 0 || path.isAbsolute(rel)) throw fail('label_outside_runs', label);
  // a symlinked label must not escape the runs directory
  try {
    const real = fs.realpathSync(dir);
    const realBase = fs.realpathSync(base);
    const r2 = path.relative(realBase, real);
    if (r2.indexOf('..') === 0 || path.isAbsolute(r2)) throw fail('label_outside_runs', label);
  } catch (e) {
    if (e && e.reason) throw e;
  }
  return dir;
}

// ---------------------------------------------------------------------------------------------
// the research import parser (a P-probe-replies shaped file)
// ---------------------------------------------------------------------------------------------
// Turn index and mode of the research probes. The research file does not carry them; the values mirror
// evals/larry-voice/probes.json for A, C and D and the P header for B and E.
const IMPORT_PROBE_META = deepFreeze({
  A: { turn_index: 1, expect_mode: 'conversation', surface: 'cli' },
  B: { turn_index: 1, expect_mode: 'conversation', surface: 'cli' },
  C: { turn_index: 1, expect_mode: 'conversation', surface: 'cli', asks_for_list: true },
  D: { turn_index: 4, expect_mode: 'conversation', surface: 'cli' },
  E: { turn_index: 4, expect_mode: 'report', surface: 'cli' },
});

function trimBlankEdges(s) { return s.replace(/^\s*\n/, '').replace(/\n\s*$/, ''); }

function parseProbeReplies(markdown) {
  const text = String(markdown).replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const heads = [];
  lines.forEach(function (l, i) { if (/^## /.test(l)) heads.push(i); });
  const out = [];
  heads.forEach(function (start, k) {
    const head = lines[start];
    const m = head.match(/^## (?:Probe|Sample) ([A-Z])\.\s*(.*)$/);
    if (!m) return;
    const end = k + 1 < heads.length ? heads[k + 1] : lines.length;
    const body = trimBlankEdges(lines.slice(start + 1, end).join('\n'));
    const rest = m[2];
    const pm = rest.match(/Prompt: "([^"]*)"/);
    const cm = rest.match(/Context: (.*?)(?: Prompt: ".*)?$/);
    out.push({
      probe: m[1],
      heading: head,
      prompt: pm ? pm[1] : null,
      context: cm ? cm[1].replace(/\s+Prompt: "[^"]*"\s*$/, '').trim() : '',
      sameAs: (rest.match(/Same prompt as ([A-Z])\./) || [])[1] || null,
      text: body,
    });
  });
  out.forEach(function (r) {
    if (r.prompt === null && r.sameAs) {
      const src = out.filter(function (x) { return x.probe === r.sameAs; })[0];
      r.prompt = src ? src.prompt : '';
    }
    if (r.prompt === null) r.prompt = '';
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// the seal (Codex C3, round 3 LOW)
// ---------------------------------------------------------------------------------------------
function sealKeyPath(home) {
  return path.join(home || REAL_HOME, '.mindrian', 'eval-seal', 'larry-voice.key');
}

function assertKeyNotInScratch(keyPath) {
  if (keyPath.split(path.sep).some(function (c) { return c.indexOf(SEAL_SCRATCH_PREFIX) === 0; })) throw fail('seal_key_in_scratch', 'the seal key path has a scratch component');
}

function loadSealKey(home) {
  const kp = sealKeyPath(home);
  assertKeyNotInScratch(kp);
  let st;
  try { st = fs.lstatSync(kp); } catch (e) {
    if (e && e.code === 'ENOENT') throw fail('seal_key_missing', null);
    throw fail('seal_key_unsafe', 'lstat failed');
  }
  if (!st.isFile() || st.isSymbolicLink()) throw fail('seal_key_unsafe', 'not a regular file');
  if ((st.mode & 0o777) !== 0o600) throw fail('seal_key_unsafe', 'mode is not 0600');
  if (typeof process.getuid === 'function' && st.uid !== process.getuid()) throw fail('seal_key_unsafe', 'not owned by the current user');
  if (st.size !== 32) throw fail('seal_key_unsafe', 'not 32 bytes');
  let pst;
  try { pst = fs.lstatSync(path.dirname(kp)); } catch (_e) { throw fail('seal_key_unsafe', 'parent directory unreadable'); }
  if (!pst.isDirectory() || pst.isSymbolicLink() || (pst.mode & 0o777) !== 0o700) throw fail('seal_key_unsafe', 'parent directory is not a 0700 directory');
  return fs.readFileSync(kp);
}

// Only generate calls this. It creates the key once (exclusive create) and otherwise loads the existing key.
function ensureSealKey(home) {
  const kp = sealKeyPath(home);
  assertKeyNotInScratch(kp);
  const dir = path.dirname(kp);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  try { fs.mkdirSync(dir, { mode: 0o700 }); } catch (e) { if (!e || e.code !== 'EEXIST') throw e; }
  try {
    const fd = fs.openSync(kp, 'wx', 0o600);
    try { fs.writeSync(fd, crypto.randomBytes(32)); } finally { fs.closeSync(fd); }
  } catch (e) {
    if (!e || e.code !== 'EEXIST') throw e;
  }
  return loadSealKey(home);
}

function sealOf(key, repliesBytes, manifestWithoutSeal) {
  const h = crypto.createHmac('sha256', key);
  h.update(repliesBytes);
  h.update('\n--manifest--\n');
  h.update(canonical(manifestWithoutSeal));
  return h.digest('hex');
}

function stripSeal(manifest) {
  const m = Object.assign({}, manifest);
  delete m.seal;
  return m;
}

// sealRun(repliesBytes, manifestWithoutSeal, {home, create}) -> the manifest with its seal field written last
function sealRun(repliesBytes, manifest, opts) {
  const o = opts || {};
  const key = o.create ? ensureSealKey(o.home) : loadSealKey(o.home);
  const base = stripSeal(manifest);
  return Object.assign({}, base, { seal: sealOf(key, repliesBytes, base) });
}

function verifySeal(repliesBytes, manifest, opts) {
  const o = opts || {};
  if (!manifest || typeof manifest.seal !== 'string') return { ok: false, reason: 'seal_mismatch', detail: 'no seal' };
  let key;
  try { key = loadSealKey(o.home); } catch (e) { return { ok: false, reason: e.reason || 'seal_key_unsafe', detail: e.detail }; }
  const expect = sealOf(key, repliesBytes, stripSeal(manifest));
  const a = Buffer.from(expect, 'hex');
  const b = Buffer.from(String(manifest.seal), 'hex');
  const same = a.length === b.length && crypto.timingSafeEqual(a, b);
  return same ? { ok: true } : { ok: false, reason: 'seal_mismatch' };
}

// ---------------------------------------------------------------------------------------------
// the run manifest
// ---------------------------------------------------------------------------------------------
function inputsClean(repoRoot) {
  const r = git(['status', '--porcelain', '--', PROBES_REL, RUBRIC_REL, AGENT_REL], { cwd: repoRoot });
  return r.status === 0 && String(r.stdout).trim() === '';
}

function pluginVersion(repoRoot) {
  const r = spawnSync(process.execPath, [path.join(repoRoot || REPO_ROOT, 'lib', 'core', 'repo-version.cjs')], { encoding: 'utf8', timeout: 30000 });
  return r.status === 0 ? String(r.stdout).trim() : null;
}

function agentBodyOf(text) {
  const t = String(text);
  if (t.indexOf('---') !== 0) return t;
  const close = t.indexOf('\n---', 3);
  if (close === -1) return t;
  const nl = t.indexOf('\n', close + 1);
  return nl === -1 ? '' : t.slice(nl + 1);
}

function runKindOf(kind, rubric) {
  const map = (rubric.comparison && rubric.comparison.run_kinds) || {};
  return Object.keys(map).filter(function (k) { return map[k].indexOf(kind) !== -1; })[0] || null;
}

/*
 * writeRunManifest(spec) -> manifest object (not yet sealed). spec: kind, label, repliesBytes, replies (parsed),
 * statuses, cells, rubric, repoRoot, extra.
 */
function writeRunManifest(spec) {
  const repoRoot = spec.repoRoot || REPO_ROOT;
  const rubric = spec.rubric || loadRubric(repoRoot);
  const probesBytes = fs.readFileSync(path.join(repoRoot, PROBES_REL));
  const rubricBytes = fs.readFileSync(path.join(repoRoot, RUBRIC_REL));
  const agentText = fs.readFileSync(path.join(repoRoot, AGENT_REL), 'utf8');
  const m = {
    version: 1,
    kind: spec.kind,
    run_kind: runKindOf(spec.kind, rubric),
    label: spec.label,
    generator: 'scripts/eval-larry-voice.cjs',
    commit: gitHead({ cwd: repoRoot }),
    plugin_version: pluginVersion(repoRoot),
    claude_version: spec.claudeVersion || null,
    probes_sha256: sha256(probesBytes),
    rubric_sha256: sha256(rubricBytes),
    agent_body_sha256: sha256(Buffer.from(agentBodyOf(agentText))),
    cells: spec.cells,
    statuses: spec.statuses,
    replies_sha256: sha256(spec.repliesBytes),
    inputs_clean: inputsClean(repoRoot),
    executables: spec.executables || null,
    created: new Date().toISOString(),
  };
  // generate hashes the bytes it actually used at the start, and the inputs must be clean at both ends
  if (spec.used) {
    m.probes_sha256 = spec.used.probes_sha256;
    m.rubric_sha256 = spec.used.rubric_sha256;
    m.agent_body_sha256 = spec.used.agent_body_sha256;
    m.inputs_clean = spec.used.inputs_clean === true && m.inputs_clean === true;
  }
  return Object.assign(m, spec.extra || {});
}

function verifyRunManifest(manifest, repliesBytes, rubric) {
  if (!manifest || typeof manifest !== 'object') return { ok: false, reason: 'no_manifest' };
  if (!repliesBytes) return { ok: false, reason: 'no_replies' };
  if (manifest.replies_sha256 !== sha256(repliesBytes)) return { ok: false, reason: 'replies_sha256_mismatch' };
  const rk = runKindOf(manifest.kind, rubric);
  if (!manifest.run_kind || manifest.run_kind !== rk) return { ok: false, reason: 'run_kind_invalid', detail: String(manifest.run_kind) + ' for ' + String(manifest.kind) };
  return { ok: true };
}

function loadRun(label, opts) {
  const o = opts || {};
  const dir = resolveLabelDir(label, o.runsDir);
  let repliesBytes;
  let manifest;
  try { repliesBytes = fs.readFileSync(path.join(dir, 'replies.json')); } catch (_e) { throw fail('no_replies', label); }
  try { manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch (_e) { throw fail('no_manifest', label); }
  const rubric = o.rubric || loadRubric(o.repoRoot);
  const v = verifyRunManifest(manifest, repliesBytes, rubric);
  if (!v.ok) throw fail(v.reason, v.detail || label);
  let replies;
  try { replies = JSON.parse(repliesBytes.toString('utf8')); } catch (_e) { throw fail('replies_unreadable', label); }
  let scores = null;
  try { scores = JSON.parse(fs.readFileSync(path.join(dir, 'scores.json'), 'utf8')); } catch (_e) { scores = null; }
  const modeWarn = (fs.statSync(path.join(dir, 'replies.json')).mode & 0o222) !== 0 ? 'replies.json is writable (a guard against accidental edits only, never the control)' : null;
  return { label: label, dir: dir, replies: replies, repliesBytes: repliesBytes, manifest: manifest, scores: scores, warnings: modeWarn ? [modeWarn] : [] };
}

function writeRunFiles(dir, repliesBytes, manifest) {
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(path.join(dir, 'replies.json')) || fs.existsSync(path.join(dir, 'manifest.json'))) throw fail('label_exists', path.basename(dir));
  fs.writeFileSync(path.join(dir, 'replies.json'), repliesBytes, { mode: 0o444 });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o444 });
}


// ---------------------------------------------------------------------------------------------
// the code half: every item the rubric lets a string decide
// ---------------------------------------------------------------------------------------------
const checks = require('../lib/hmi/larry-reply-checks.cjs');
const oplog = require('./oplog-larry-voice.cjs');

const VOICE_ITEMS = Object.freeze(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15']);
const OP_ITEMS = Object.freeze(['OP1', 'OP2', 'OP3', 'OP4', 'OP5']);
const ALL_ITEMS = Object.freeze(VOICE_ITEMS.concat(OP_ITEMS));
// Items a judge scores. The code half is a ceiling for the "both" items and the whole value for the
// code-authoritative ones; the judge can lower a value, never raise it.
const JUDGE_IDS = Object.freeze(['R5', 'R6', 'R7', 'R9', 'R11', 'R13', 'R14', 'R15']);
const JUDGE_ONLY = Object.freeze(['R6', 'R7', 'R9', 'R13', 'OP3']);
// The operation items a judge may score on a reply that carries a tool log (plan 369.6-05). Only the claude judge ever sees them.
const OP_JUDGE_IDS = Object.freeze(['OP2', 'OP3']);
const GATES = Object.freeze(['R1', 'R10', 'R15', 'OP1']);
const VIBE_CORE = Object.freeze(['R5', 'R6', 'R7', 'R9', 'R11', 'R12']);

function normalizeProbe(p) {
  return {
    id: p.id,
    prompt: p.prompt || '',
    context: p.context || '',
    turn_index: typeof p.turn_index === 'number' ? p.turn_index : 1,
    expect_mode: p.expect_mode || 'conversation',
    surface: p.surface || 'cli',
    asks_for_list: !!p.asks_for_list,
  };
}

function lookupProbe(id, probes) {
  const hit = (probes.probes || []).concat(probes.operation_probes || []).filter(function (x) { return x.id === id; })[0];
  if (hit) return normalizeProbe(hit);
  if (IMPORT_PROBE_META[id]) return normalizeProbe(Object.assign({ id: id }, IMPORT_PROBE_META[id]));
  return null;
}

/*
 * applicableItems(probe, cell, rubric) -> { applicable: [ids], not_applicable: { id: ruleId } }.
 * The only two rules are the ones in rubric.comparison.applicability (D-12, D-30). Never read from a run.
 */
function applicableItems(probe, cell, rubric) {
  const rules = rubric.comparison.applicability;
  const na = {};
  if (probe && probe.expect_mode === 'report') rules.na_report_mode.items.forEach(function (id) { na[id] = 'na_report_mode'; });
  if (rules.na_operation_on_voice_cell.cells.indexOf(String(cell)) !== -1) rules.na_operation_on_voice_cell.items.forEach(function (id) { na[id] = 'na_operation_on_voice_cell'; });
  return { applicable: ALL_ITEMS.filter(function (id) { return !na[id]; }), not_applicable: na };
}

function words(s) { return String(s).trim().split(/\s+/).filter(Boolean); }

function sentencesOf(text) {
  const body = String(text).split('\n').filter(function (l) { return !/Larry \| MindrianOS/.test(l); }).join(' ');
  return body.split(/(?<=[.!?])\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
}

function hasShortSentence(text) {
  return sentencesOf(text).some(function (s) {
    if (/^I.m Larry\b/.test(s)) return false;
    const w = words(s.replace(/^[-*\d.)\s]+/, ''));
    return w.length >= 1 && w.length <= 6;
  });
}

function r4Value(text, probe) {
  const t = String(text);
  const requested = probe.asks_for_list || /\b(plan|list|steps|outline|table)\b/i.test(probe.prompt);
  const headings = /^#{1,6}\s/m.test(t);
  const table = /^\s*\|.*\|\s*$/m.test(t) && /^\s*\|?\s*:?-{3,}/m.test(t);
  const accordingTo = /^\s*(?:\S+\s+){0,3}According to\b/i.test(t.replace(/^.*Larry \| MindrianOS.*\n/, ''));
  if (headings || table || accordingTo) return { value: 0, detail: 'heading, table or According-to opening' };
  const lists = (t.match(/^\s*(?:[-*+]|\d+[.)])\s+/gm) || []).length;
  const boldHeader = /^\s*\*\*[^*\n]+\*\*\s*$/m.test(t.replace(/^.*Larry \| MindrianOS.*$/m, ''));
  if (requested) return { value: 2, detail: 'a requested list or plan is exempt' };
  if (lists > 0 || boldHeader) return { value: 1, detail: 'one list or bold header' };
  return { value: 2, detail: 'prose only' };
}

function r5Value(text, probe) {
  const v = checks.detectFrameworkDump(text, { userText: probe.prompt });
  const m = String(v.detail).match(/names (\d+), commands (\d+), asked (true|false)/);
  const names = m ? Number(m[1]) : 0;
  const asked = m ? m[3] === 'true' : false;
  if (/\bthis is an? (?:un-?defined|ill-?defined|well-?defined|wicked)\b/i.test(text)) return { value: 0, detail: 'out-loud classification' };
  if (probe.asks_for_list || asked) {
    if (names > 4) return { value: 0, detail: 'a list of more than 4 names' };
    return { value: names === 0 ? 2 : 1, detail: 'asked for a list, ' + names + ' names' };
  }
  if (names >= 2) return { value: 0, detail: names + ' framework names unprompted' };
  if (names === 1) return { value: 1, detail: 'one framework named' };
  return { value: 2, detail: 'no framework name' };
}

function r14Value(text, probe) {
  const v = checks.findClosingShape(text);
  const kinds = v.hits.map(function (h) { return h.kind; });
  const f = v.fields || {};
  if (kinds.indexOf('prose_menu') !== -1 || kinds.indexOf('stacked_closing_questions') !== -1 || /^\s*[+|]-{3,}/m.test(text)) return { value: 0, detail: kinds.join(',') || 'ascii box' };
  if (kinds.indexOf('compound_closing_question') !== -1) return { value: 1, detail: 'compound closing question' };
  if (f.uses_your_call) {
    return probe.expect_mode === 'fork' ? { value: 2, detail: 'Your call on a fork probe' } : { value: 1, detail: 'Your call on a turn that is not a genuine fork' };
  }
  if (f.ends_on_next_step || f.last_question_count === 1) return { value: 2, detail: f.ends_on_next_step ? 'ends on a next step' : 'one closing question' };
  return { value: 1, detail: 'generic closer' };
}

function item(value, detail, extra) {
  return Object.assign({ value: value, status: 'scored', judge: 'code', scorer: 'code', detail: detail || '' }, extra || {});
}

function notScored(reason, extra) {
  return Object.assign({ value: null, status: 'not_scored', judge: null, scorer: 'code', detail: reason }, extra || {});
}

/*
 * scoreCode(reply, probe, rubric) -> { items }. Every item of the rubric, deterministic. A judge-only item is
 * not_scored until a judge runs. OP2 to OP5 need a tool log: not_applicable on a voice cell (the rule id is
 * stored), missing on an operation cell without one.
 */
function scoreCode(reply, probe, rubric) {
  const text = String(reply.text);
  const userText = probe.prompt;
  const cell = String(reply.cell);
  const app = applicableItems(probe, cell, rubric);
  const out = {};
  const turn = probe.turn_index;
  function put(id, val) {
    if (app.not_applicable[id]) out[id] = { value: null, status: 'not_applicable', rule: app.not_applicable[id], judge: null, scorer: 'rule', detail: '' };
    else out[id] = val;
  }
  const first = checks.checkFirstReply(text);
  put('R1', first.hits.some(function (h) { return ['glyph_missing', 'glyph_count', 'label_missing'].indexOf(h.kind) !== -1; }) ? item(0, 'glyph or label fault') : item(2, 'glyph and label'));
  const idv = checks.checkIdentityLine(text, { turnIndex: turn, surface: probe.surface });
  const idk = idv.hits.map(function (h) { return h.kind; });
  put('R2', ['missing_identity', 'repeated_identity', 'duplicate_identity', 'model_clause_host_neutral'].some(function (k) { return idk.indexOf(k) !== -1; })
    ? item(0, idk.join(','))
    : (idk.indexOf('spelling_pws_caps') !== -1 ? item(1, 'spelling_pws_caps') : item(2, 'identity line fits')));
  const n = checks.countSentences(text, { skipIdentityLine: true });
  const wantsPlan = probe.asks_for_list || /\b(plan|list|steps|outline)\b/i.test(probe.prompt);
  let r3;
  if ((wantsPlan && n >= 5 && n <= 15) || (n >= 2 && n <= 8)) r3 = 2; else if (n <= 15) r3 = 1; else r3 = 0;
  put('R3', item(r3, n + ' sentences' + (wantsPlan ? ', a list or plan was asked for' : '')));
  const r4 = r4Value(text, probe);
  put('R4', item(r4.value, r4.detail));
  const r5 = r5Value(text, probe);
  put('R5', item(r5.value, r5.detail, { scorer: 'both', ceiling: r5.value }));
  JUDGE_ONLY.forEach(function (id) { put(id, notScored('judge item, no judge ran', { scorer: 'judge' })); });
  const q = checks.countQuestions(text);
  put('R8', item(q >= 2 ? 0 : 2, q + ' questions'));
  const r10 = checks.findUnsourcedNumber(text, { userText: userText + ' ' + probe.context });
  put('R10', item(r10.ok ? 2 : 0, r10.ok ? 'no unsourced figure' : 'unsourced figure'));
  const banned = checks.findBannedPhrases(text);
  put('R11', banned.ok ? notScored('code half is a ceiling only; the judge decides demand and human signal', { scorer: 'both', ceiling: 2 }) : item(0, 'banned phrase', { scorer: 'both', ceiling: 0 }));
  const dashes = checks.findDashes(text);
  const short = hasShortSentence(text);
  put('R12', item((dashes.ok ? 1 : 0) + (short ? 1 : 0), (dashes.ok ? 'no dash' : 'dash or pause') + ', ' + (short ? 'short sentence' : 'no short sentence')));
  const r14 = r14Value(text, probe);
  put('R14', item(r14.value, r14.detail, { scorer: 'both', ceiling: r14.value }));
  const mach = checks.findMachineryNarration(text, { userText: userText });
  put('R15', item(mach.ok ? 2 : 0, mach.ok ? 'no machinery narration' : 'machinery: ' + mach.hits.map(function (h) { return h.term; }).join(','), { scorer: 'both', ceiling: mach.ok ? 2 : 0 }));
  put('OP1', item(mach.ok ? 2 : 0, mach.ok ? 'no machinery narration' : 'machinery: ' + mach.hits.map(function (h) { return h.term; }).join(','), { scorer: 'both' }));
  // A reply with a stored tool log (the redacted record of scripts/oplog-larry-voice.cjs) is scored from that log on every
  // run of score and compare: the stored op_code is evidence, never the source of the value (plan 369.6-05, Codex C2).
  const hasLog = !!(reply.tool_log && typeof reply.tool_log === 'object' && Array.isArray(reply.tool_log.calls));
  let opScore = null;
  if (hasLog) opScore = oplog.scoreOperationLog(reply.tool_log, text, probe);
  if (opScore) put('OP2', item(opScore.OP2.value, opScore.OP2.reason, { scorer: 'log+judge', ceiling: opScore.OP2.ceiling, evidence: opScore.OP2.evidence, judge: 'code' }));
  else put('OP2', { value: null, status: 'missing', judge: null, scorer: 'log+judge', detail: 'no tool log' });
  put('OP3', notScored('judge item, no judge ran', { scorer: 'judge' }));
  const tos = checks.findToolOutputShape(text);
  put('OP4', item(tos.ok ? 2 : 0, tos.ok ? 'no tool output shape' : 'tool output shape', { scorer: 'both' }));
  if (opScore) put('OP5', item(opScore.OP5.value, opScore.OP5.reason, { scorer: 'log+code', evidence: opScore.OP5.evidence }));
  else put('OP5', { value: null, status: 'missing', judge: null, scorer: 'log+code', detail: 'no tool log' });
  return { items: out, applicable: app.applicable, not_applicable: app.not_applicable };
}

// ---------------------------------------------------------------------------------------------
// the judge half
// ---------------------------------------------------------------------------------------------
function clip(s, n) { const t = String(s); return t.length > n ? t.slice(0, n) : t; }

/*
 * judgeItems(rubric) -> [{ id, judge, criteria: [level0, level1, level2] }]: the questions a judge answers,
 * built from the rubric item cells (levels worded as situations, the Jev contract).
 */
function judgeItems(rubric, withOperation) {
  const opItems = (rubric.operation && rubric.operation.items) || [];
  return JUDGE_IDS.concat(withOperation ? OP_JUDGE_IDS : []).map(function (id) {
    const it = rubric.items.concat(opItems).filter(function (x) { return x.id === id; })[0];
    return {
      id: id,
      judge: clip(it.name + '. Score the reply to the navigator message in the state, from 0 to 2.', 400),
      criteria: [clip(it.cells['0'], 900), clip(it.cells['1'], 900), clip(it.cells['2'], 900)],
    };
  });
}

/*
 * buildJudgePayload(entry) -> the Jev body. Built ONLY from a verified record entry: the probe id, turn index,
 * prompt, context, reply bytes and the rubric items. No field is read from a probe file or a run file here.
 */
function buildJudgePayload(entry) {
  const need = ['probe_id', 'turn_index', 'prompt', 'context', 'reply', 'items'];
  need.forEach(function (k) { if (!entry || entry[k] === undefined) throw fail('payload_entry_incomplete', k); });
  const questions = {};
  entry.items.forEach(function (it) {
    questions[it.id] = { type: 'score', instructions: { judge: it.judge }, criteria: it.criteria.slice() };
  });
  return {
    model: 'jev-latest',
    state: { probe_id: entry.probe_id, turn_index: entry.turn_index, prompt: entry.prompt, context: entry.context, reply: entry.reply },
    questions: questions,
  };
}

function confidenceFloor() {
  try {
    const m = require('./eval-icm-writers.cjs');
    if (typeof m.JEV_CONFIDENCE_FLOOR === 'number') return m.JEV_CONFIDENCE_FLOOR;
  } catch (_e) { /* fall back */ }
  return JEV_CONFIDENCE_FLOOR_FALLBACK;
}

// A Jev response -> { id: { value, confidence } | { abstained: true, reason } }
function readJevAnswers(res, ids) {
  const out = {};
  const answers = res && res.json && res.json.answers;
  ids.forEach(function (id) {
    const a = answers && answers[id];
    if (!(res && res.status === 200 && a && typeof a.score === 'number')) { out[id] = { abstained: true, reason: 'jev_unrecognized_answer' }; return; }
    const conf = typeof a.confidence === 'number' ? a.confidence : null;
    if (conf !== null && conf < confidenceFloor()) { out[id] = { abstained: true, reason: 'below_confidence_floor', confidence: conf }; return; }
    out[id] = { value: Math.max(0, Math.min(2, Math.round(a.score))), confidence: conf };
  });
  return out;
}

function buildJudgeArgs(spec) {
  const model = spec && spec.model;
  if (model && /fable/i.test(String(model))) throw fail('model_refused', 'a model id containing fable is refused');
  const args = ['--print', '--output-format', 'json', '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--disable-slash-commands',
    '--append-system-prompt', String(spec.systemText)];
  if (model) args.push('--model', String(model));
  return args;
}

function judgeSystemText(items) {
  return [
    'You are a strict rubric judge for short replies written by a thinking partner named Larry.',
    'Score each item below from 0 to 2 using only the level descriptions. Reply with one JSON object and nothing else:',
    '{"R5": {"score": 0|1|2}, ...} with one key per item id.',
    items.map(function (it) { return it.id + ' ' + it.judge + '\n  0: ' + it.criteria[0] + '\n  1: ' + it.criteria[1] + '\n  2: ' + it.criteria[2]; }).join('\n'),
  ].join('\n');
}


function computeTotals(items, applicable) {
  const ids = applicable.filter(function (id) { return VOICE_ITEMS.indexOf(id) !== -1; });
  const scored = ids.filter(function (id) { return items[id] && items[id].status === 'scored'; });
  const sum = scored.reduce(function (a, id) { return a + items[id].value; }, 0);
  const judges = {};
  scored.forEach(function (id) { judges[items[id].judge || 'code'] = true; });
  if (scored.length === ids.length) {
    return { value: sum, status: 'scored', max: ids.length * 2, judge: Object.keys(judges).sort().join('+') || 'code', applicable_items: ids.length };
  }
  const missing = ids.filter(function (id) { return !items[id] || items[id].status !== 'scored'; });
  const anyAbstained = missing.some(function (id) { return items[id] && items[id].status === 'abstained'; });
  return { value: null, status: anyAbstained ? 'abstained' : 'not_scored', partial_sum: sum, missing: missing, applicable_items: ids.length, judge: null };
}

function mergeJudge(code, results, name) {
  const items = {};
  Object.keys(code.items).forEach(function (id) { items[id] = Object.assign({}, code.items[id]); });
  if (!results) return items;
  JUDGE_IDS.concat(OP_JUDGE_IDS).forEach(function (id) {
    const base = items[id];
    if (!base || base.status === 'not_applicable') return;
    const r = results[id];
    if (!r) return;
    if (r.abstained) {
      if (JUDGE_ONLY.indexOf(id) !== -1 || id === 'R11') {
        items[id] = { value: null, status: 'abstained', judge: name, scorer: 'judge', detail: r.reason || 'abstained', confidence: r.confidence === undefined ? null : r.confidence };
      } else {
        items[id] = Object.assign({}, base, { note: 'judge ' + name + ' abstained: ' + (r.reason || 'unknown') });
      }
      return;
    }
    const cap = typeof base.ceiling === 'number' ? base.ceiling : (typeof base.value === 'number' ? base.value : 2);
    items[id] = {
      value: Math.min(cap, r.value),
      status: 'scored',
      judge: name,
      scorer: base.scorer === 'both' ? 'both' : 'judge',
      judge_value: r.value,
      code_value: typeof base.value === 'number' ? base.value : null,
      confidence: r.confidence === undefined ? null : r.confidence,
      detail: base.detail || '',
    };
  });
  return items;
}

function gatesOf(items) {
  const g = {};
  GATES.forEach(function (id) {
    const it = items[id];
    g[id] = !it || it.status !== 'scored' ? 'unknown' : (it.value > 0 ? 'pass' : 'fail');
  });
  return g;
}

function vibeCoreSum(items) {
  return VIBE_CORE.reduce(function (a, id) { return a + (items[id] && items[id].status === 'scored' ? items[id].value : 0); }, 0);
}

/*
 * scoreReply(reply, probe, rubric, opts) -> a score entry. opts.judge = { name, results } or absent.
 */
function scoreReply(reply, probe, rubric, opts) {
  const o = opts || {};
  const code = scoreCode(reply, probe, rubric);
  const items = o.judge ? mergeJudge(code, o.judge.results, o.judge.name) : mergeJudge(code, null, 'none');
  return {
    probe: reply.probe,
    cell: String(reply.cell),
    sample: reply.sample || 1,
    items: items,
    total: computeTotals(items, code.applicable),
    gates: gatesOf(items),
    vibe_core_sum: vibeCoreSum(items),
    applicable: code.applicable,
    not_applicable: code.not_applicable,
  };
}

// ---------------------------------------------------------------------------------------------
// composition proof and pre-egress provenance (Codex C3, rounds 2 and 3)
// ---------------------------------------------------------------------------------------------
function compositionProven(init) {
  if (!init || typeof init !== 'object') return false;
  const empty = function (a) { return Array.isArray(a) && a.length === 0; };
  return empty(init.plugins) && empty(init.mcp_servers) && empty(init.tools) && (!init.output_style || init.output_style === 'default');
}

function refusal(reason, detail) { return { ok: false, reason: reason, detail: detail || null, entries: [], refusals: [] }; }

function replyKey(r) { return String(r.probe) + '|' + String(r.cell) + '|' + String(r.sample || 1); }

function verifyImportProvenance(run, rubric, ctx) {
  const repoRoot = ctx.repoRoot;
  const m = run.manifest;
  const imports = (rubric.judge_policy && rubric.judge_policy.jev_imports) || [];
  const entry = imports.filter(function (i) { return i.label === m.label && i.label === run.label; })[0];
  if (!entry) return refusal('not_in_jev_imports', String(m.label));
  if (m.source !== entry.source || m.source_commit !== entry.source_commit || m.source_sha256 !== entry.source_sha256) return refusal('not_in_jev_imports', 'the manifest source fields differ from the rubric entry');
  const bytes = gitShow(entry.source_commit, entry.source, { repoRoot: repoRoot });
  if (!bytes) return refusal('import_content_mismatch', 'the pinned source is unreadable');
  if (sha256(bytes) !== entry.source_sha256) return refusal('import_content_mismatch', 'the pinned source sha256 differs');
  const rubricStatus = git(['status', '--porcelain', '--', RUBRIC_REL], { cwd: repoRoot });
  if (rubricStatus.status !== 0 || String(rubricStatus.stdout).trim() !== '') return refusal('hash_mismatch_at_commit', 'rubric.json has an uncommitted change');
  const parsed = parseProbeReplies(bytes.toString('utf8'));
  const byProbe = {};
  parsed.forEach(function (p) { byProbe[p.probe] = p; });
  const got = {};
  (run.replies.replies || []).forEach(function (r) { got[r.probe] = (got[r.probe] || 0) + 1; });
  const wanted = entry.probes.slice().sort().join(',');
  const have = Object.keys(got).sort().join(',');
  if (wanted !== have || Object.keys(got).some(function (k) { return got[k] !== 1; })) return refusal('import_content_mismatch', 'probe set differs: ' + have);
  const items = judgeItems(rubric);
  const entries = [];
  for (const r of run.replies.replies) {
    const p = byProbe[r.probe];
    if (!p || p.text !== r.text || String(r.cell) !== '1') return refusal('import_content_mismatch', 'reply ' + r.probe + ' differs from the reconstructed source');
    entries.push({ probe: r.probe, cell: '1', sample: r.sample || 1, probe_id: r.probe, turn_index: IMPORT_PROBE_META[r.probe].turn_index, prompt: p.prompt, context: p.context, reply: p.text, items: items });
  }
  return { ok: true, entries: entries, refusals: [] };
}

function verifyGenerationProvenance(run, ctx) {
  const repoRoot = ctx.repoRoot;
  const m = run.manifest;
  const rows = m.statuses || {};
  const statusList = [];
  Object.keys(rows).forEach(function (pid) { Object.keys(rows[pid]).forEach(function (c) { statusList.push(rows[pid][c]); }); });
  if (!statusList.length || statusList.some(function (x) { return x !== 'complete'; })) {
    return refusal(statusList.indexOf('composition_unproven') !== -1 ? 'composition_unproven' : 'cell_not_eligible', 'a probe or cell is not complete');
  }
  const replies = run.replies.replies || [];
  if (replies.some(function (r) { return !r.composition || r.composition.proven !== true || !compositionProven(r.composition.init_event); })) return refusal('composition_unproven', 'a reply has no proven composition');
  if (m.inputs_clean !== true) return refusal('hash_mismatch_at_commit', 'probes.json, rubric.json or the agent file had an uncommitted change at generation');
  const commit = m.commit;
  if (!/^[0-9a-f]{40}$/.test(String(commit)) || !isAncestor(commit, { cwd: repoRoot })) return refusal('hash_mismatch_at_commit', 'the pinned commit is not an ancestor of HEAD');
  const probesBytes = gitShow(commit, PROBES_REL, { repoRoot: repoRoot });
  const rubricBytes = gitShow(commit, RUBRIC_REL, { repoRoot: repoRoot });
  const agentBytes = gitShow(commit, AGENT_REL, { repoRoot: repoRoot });
  if (!probesBytes || !rubricBytes || !agentBytes) return refusal('hash_mismatch_at_commit', 'a pinned file is unreadable');
  if (sha256(probesBytes) !== m.probes_sha256 || sha256(rubricBytes) !== m.rubric_sha256) return refusal('hash_mismatch_at_commit', 'probes_sha256 or rubric_sha256 does not re-derive');
  const bodySha = sha256(Buffer.from(agentBodyOf(agentBytes.toString('utf8'))));
  if (bodySha !== m.agent_body_sha256) return refusal('hash_mismatch_at_commit', 'agent_body_sha256 does not re-derive');
  // every reply records the hash of the system prompt that was actually used; it must be the pinned agent body, and a
  // cell 1 prompt holds nothing else (Codex round 4, P1)
  if (replies.some(function (r) {
    const c1 = String(r.cell) === '1';
    return !r.composition || r.composition.agent_body_sha256 !== bodySha || (c1 && JSON.stringify(r.composition.parts) !== JSON.stringify(['agent_body']));
  })) return refusal('hash_mismatch_at_commit', 'a reply records a system prompt that is not the pinned agent body');
  const seal = verifySeal(run.repliesBytes, m, { home: ctx.home });
  if (!seal.ok) return refusal(seal.reason, seal.detail);
  const probesAt = JSON.parse(probesBytes.toString('utf8'));
  const rubricAt = JSON.parse(rubricBytes.toString('utf8'));
  for (const r of replies) {
    const pr = (probesAt.probes || []).filter(function (x) { return x.id === r.probe; })[0];
    if (!pr || pr.prompt !== r.prompt || (pr.context || '') !== (r.context || '') || pr.turn_index !== r.turn_index) return refusal('probe_mismatch_at_commit', 'probe ' + r.probe);
  }
  const items = judgeItems(rubricAt);
  const entries = [];
  const refusals = [];
  replies.forEach(function (r) {
    if (String(r.cell) !== '1') { refusals.push({ probe: r.probe, cell: String(r.cell), sample: r.sample || 1, reason: 'cell_not_eligible' }); return; }
    entries.push({ probe: r.probe, cell: '1', sample: r.sample || 1, probe_id: r.probe, turn_index: r.turn_index, prompt: r.prompt, context: r.context || '', reply: r.text, items: items });
  });
  if (!entries.length) return refusal('cell_not_eligible', 'the run holds no cell 1 reply');
  return { ok: true, entries: entries, refusals: refusals };
}

/*
 * verifyJudgeProvenance(run, rubric, ctx) -> { ok, reason, entries, refusals, record }. Every check runs before any
 * payload is built. record is the deep-frozen verified record that buildJudgePayload and jevVoice consume.
 */
function verifyJudgeProvenance(run, rubric, ctx) {
  const c = { repoRoot: (ctx && ctx.repoRoot) || REPO_ROOT, home: (ctx && ctx.home) || REAL_HOME };
  if (!run || !run.manifest) return refusal('no_manifest');
  let v;
  if (run.manifest.kind === 'research-import') v = verifyImportProvenance(run, rubric, c);
  else if (run.manifest.kind === 'voice-fixture-generation') v = verifyGenerationProvenance(run, c);
  else v = refusal('cell_not_eligible', 'run kind ' + run.manifest.kind);
  if (!v.ok) return v;
  v.record = deepFreeze({ label: run.label, kind: run.manifest.kind, entries: v.entries });
  return v;
}

// ---------------------------------------------------------------------------------------------
// score
// ---------------------------------------------------------------------------------------------
function probeForReply(reply, probes) {
  const p = lookupProbe(reply.probe, probes);
  if (p) {
    if (!p.prompt && reply.prompt) p.prompt = reply.prompt;
    if (!p.context && reply.context) p.context = reply.context;
    return p;
  }
  return normalizeProbe({ id: reply.probe, prompt: reply.prompt, context: reply.context, turn_index: reply.turn_index, expect_mode: reply.expect_mode });
}

function credentialPresent(env) {
  const e = env || process.env;
  return ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY'].some(function (n) { return !!e[n]; });
}

function liveGate(env) {
  const e = env || process.env;
  if (e.MINDRIAN_SKIP_LIVE_CLAUDE === '1') return { ok: false, reason: 'skip_live_claude' };
  if (!credentialPresent(e)) return { ok: false, reason: 'no_isolated_credential' };
  return { ok: true };
}

async function defaultClaudeJudge(entry, ids, ctx) {
  const iso = require('./isolate-larry-voice.cjs');
  const gate = liveGate(ctx.env);
  if (!gate.ok) return { refused: gate.reason };
  const items = entry.items.filter(function (it) { return ids.indexOf(it.id) !== -1; });
  const scratch = ctx.scratch || iso.makeScratch(SEAL_SCRATCH_PREFIX, { claudeCli: ctx.claudeCli });
  if (!scratch.claude) return { refused: 'claude_cli_missing' };
  const args = buildJudgeArgs({ model: ctx.model, systemText: judgeSystemText(items) });
  // the judge sees the same supplied context and turn index as the Jev payload carries
  const userMsg = 'Turn index: ' + entry.turn_index + '\n' +
    (entry.context ? 'Conversation so far:\n' + entry.context + '\n\n' : '') +
    'Navigator message:\n' + entry.prompt + '\n\nLarry reply:\n' + entry.reply +
    (entry.evidence ? '\n\nEvidence for the operation items (from the recorded tool log):\n' + entry.evidence : '');
  const spawn = ctx.spawn || iso.spawnIsolated;
  const r = spawn(scratch, path.join(scratch.bin, 'claude'), args.concat([userMsg]), { envOpts: { withCredential: true, parentEnv: ctx.env }, timeout: 180000 });
  if (r.status !== 0) return { refused: 'claude_exit_' + r.status };
  let text = String(r.stdout || '');
  try { const j = JSON.parse(text); if (typeof j.result === 'string') text = j.result; } catch (_e) { /* raw text */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { refused: 'claude_no_json' };
  let parsed;
  try { parsed = JSON.parse(m[0]); } catch (_e) { return { refused: 'claude_bad_json' }; }
  const out = {};
  ids.forEach(function (id) {
    const v = parsed[id] && typeof parsed[id] === 'object' ? parsed[id].score : parsed[id];
    out[id] = typeof v === 'number' ? { value: Math.max(0, Math.min(2, Math.round(v))), confidence: null } : { abstained: true, reason: 'claude_no_score' };
  });
  return { results: out };
}

// The evidence a judge needs for OP2 and OP3 (Codex round 1 of plan 369.6-05, finding 3): the ordered calls with their
// outcomes, the approval facts, the code finding for OP2, the step the last executed engine call surfaced, and the artifact
// titles of the fixture room (invented content). It holds no argument text and no result text beyond the engine step.
function fixtureRoomTitles(repoRoot) {
  const base = path.join(repoRoot || REPO_ROOT, 'tests', 'fixtures', 'release-room', 'sections');
  const out = [];
  try {
    fs.readdirSync(base).sort().forEach(function (sec) {
      const dirSec = path.join(base, sec);
      fs.readdirSync(dirSec).sort().forEach(function (art) {
        const f = path.join(dirSec, art, art + '.md');
        if (!fs.existsSync(f)) return;
        const m = /^title:\s*(.+)$/m.exec(fs.readFileSync(f, 'utf8'));
        out.push(sec + ': ' + (m ? m[1].trim() : art));
      });
    });
  } catch (_e) { /* the fixture room is optional evidence */ }
  return out;
}

function operationEvidenceText(reply, repoRoot) {
  const log = reply.tool_log;
  const lines = ['Tool calls in order (id, tool, outcome, flags):'];
  (log.calls || []).forEach(function (c) {
    lines.push('  ' + c.id + ' ' + c.tool + ' ' + c.outcome + (c.material ? ' material' : '') + (c.exempt ? ' exempt' : '') + (c.setup ? ' setup' : ''));
  });
  if (!(log.calls || []).length) lines.push('  none');
  lines.push('Navigator approvals before a step: ' + (log.approvals || []).filter(function (a) { return a.approve; }).length + '; model-made gate answers: ' + (log.selfApprovals || []).length + '.');
  if (reply.op_code && reply.op_code.OP2) lines.push('Code finding for OP2: ' + reply.op_code.OP2.value + ' (' + reply.op_code.OP2.reason + ').');
  const eng = (log.calls || []).filter(function (c) { return c.engine && c.outcome === 'executed'; });
  if (eng.length) {
    const last = eng[eng.length - 1];
    lines.push('Last executed engine call ' + last.id + ' surfaced: commands [' + last.engine.commands.join(', ') + '], frameworks [' + last.engine.frameworks.join(', ') + '].');
  }
  const titles = fixtureRoomTitles(repoRoot);
  if (titles.length) lines.push('Artifact titles the room holds (invented fixture content):\n  ' + titles.join('\n  '));
  return lines.join('\n');
}

/*
 * scoreRun(run, opts) -> the scores.json object. opts: judge (jev | claude | none | auto), transport, key, home,
 * claudeJudge, model, rubric, probes, repoRoot, env.
 */
async function scoreRun(run, opts) {
  const o = opts || {};
  const rubric = o.rubric || loadRubric(o.repoRoot);
  const probes = o.probes || loadProbes(o.repoRoot);
  const mode = o.judge || 'none';
  if (['jev', 'claude', 'none', 'auto'].indexOf(mode) === -1) throw fail('judge_unknown', mode);
  const jevWanted = mode === 'jev' || mode === 'auto';
  const claudeWanted = mode === 'claude' || mode === 'auto';
  const jevRefusals = [];
  let prov = null;
  let key = null;
  if (jevWanted) {
    key = o.key !== undefined ? o.key : require('./jev-voice-transport.cjs').loadKey();
    if (!key) jevRefusals.push({ probe: '*', cell: '*', sample: 0, reason: 'no_jev_key' });
    else {
      prov = verifyJudgeProvenance(run, rubric, { repoRoot: o.repoRoot, home: o.home });
      if (!prov.ok) { jevRefusals.push({ probe: '*', cell: '*', sample: 0, reason: prov.reason, detail: prov.detail }); prov = null; }
      else prov.refusals.forEach(function (x) { jevRefusals.push(x); });
    }
  }
  const transport = o.transport || (jevWanted ? require('./jev-voice-transport.cjs').jevVoice : null);
  const claudeJudge = o.claudeJudge || defaultClaudeJudge;
  const entries = [];
  const replies = run.replies.replies || [];
  for (const reply of replies) {
    const probe = probeForReply(reply, probes);
    const code = scoreCode(reply, probe, rubric);
    const hasLog = !!(reply.tool_log && typeof reply.tool_log === 'object' && Array.isArray(reply.tool_log.calls));
    const ids = JUDGE_IDS.concat(hasLog ? OP_JUDGE_IDS : []).filter(function (id) { return code.items[id] && code.items[id].status !== 'not_applicable'; });
    let judge = null;
    const reasons = [];
    if (mode !== 'none' && ids.length) {
      const vEntry = prov && prov.record.entries.filter(function (e) { return replyKey(e) === replyKey(reply); })[0];
      // a reply that carries a tool log never goes to Jev: the judge policy refuses it (Canon Part 8, the IP egress ruling)
      if (jevWanted && key && vEntry && !hasLog) {
        try {
          const body = buildJudgePayload(vEntry);
          const res = await transport(key, body, { verified: prov.record });
          if (!res || res.status !== 200) {
            // an HTTP failure or exhausted retries is a failed Jev leg, never a judge verdict (Codex round 4, P2)
            jevRefusals.push({ probe: reply.probe, cell: String(reply.cell), sample: reply.sample || 1, reason: 'jev_http_' + String(res && res.status) });
          } else {
            judge = { name: 'jev', results: readJevAnswers(res, ids) };
          }
        } catch (e) {
          jevRefusals.push({ probe: reply.probe, cell: String(reply.cell), sample: reply.sample || 1, reason: String((e && e.reason) || 'transport_refused'), detail: String(e && e.message).slice(0, 200) });
        }
      }
      if (!judge && jevWanted && key && !vEntry && prov && !jevRefusals.some(function (x) { return x.probe === reply.probe && x.cell === String(reply.cell); })) {
        jevRefusals.push({ probe: reply.probe, cell: String(reply.cell), sample: reply.sample || 1, reason: 'cell_not_eligible' });
      }
      if (!judge && claudeWanted) {
        const forJudge = {
          probe_id: reply.probe, turn_index: probe.turn_index, prompt: probe.prompt, context: probe.context, reply: reply.text, items: judgeItems(rubric, hasLog),
          evidence: hasLog ? operationEvidenceText(reply, o.repoRoot) : '',
        };
        const res = await claudeJudge(forJudge, ids, { env: o.env, model: o.model, scratch: o.scratch, spawn: o.spawn, claudeCli: o.claudeCli });
        if (res && res.results) judge = { name: 'claude', results: res.results };
        else reasons.push('claude: ' + String((res && res.refused) || 'no result'));
      }
    }
    const entry = scoreReply(reply, probe, rubric, { judge: judge });
    entry.judge_reasons = reasons;
    entries.push(entry);
  }
  return {
    version: 1,
    label: run.label,
    replies_sha256: run.manifest.replies_sha256,
    judge_requested: mode,
    scored_at: new Date().toISOString(),
    judge_per_item: judgeSummary(entries),
    jev_refusals: jevRefusals,
    entries: entries,
  };
}

function judgeSummary(entries) {
  const out = {};
  entries.forEach(function (e) {
    Object.keys(e.items).forEach(function (id) {
      const it = e.items[id];
      if (it.status === 'not_applicable') return;
      const j = it.judge || 'none';
      out[id] = out[id] || {};
      out[id][j] = (out[id][j] || 0) + 1;
    });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// compare (Codex C4, round 2): the required matrix, four outcomes, no cross-cell aggregate
// ---------------------------------------------------------------------------------------------
function requiredMatrix(rubric, probes, runKind) {
  const rm = rubric.comparison && rubric.comparison.required_matrix && rubric.comparison.required_matrix[runKind];
  if (!rm) throw fail('run_kind_invalid', String(runKind));
  const ids = (runKind === 'voice' ? probes.probes : probes.operation_probes).map(function (p) { return p.id; }).sort().join(',');
  if (ids !== rm.probes.slice().sort().join(',')) throw fail('matrix_probe_mismatch', 'required_matrix.' + runKind + '.probes differs from probes.json');
  return { run_kind: runKind, probes: rm.probes.slice(), cells: rm.cells.slice(), items: rm.items.slice(), reported_items: (rm.reported_items || []).slice() };
}

function median(values) {
  const v = values.slice().sort(function (a, b) { return a - b; });
  return v[Math.floor((v.length - 1) / 2)];
}

/*
 * aggregateSamples(list) -> one item result. A judge-scored item takes the median of up to three samples (the
 * retry rule of rubric.sampling); a code-scored item must agree across samples, else it is flagged. More than
 * three samples means a second retry, which is refused.
 */
function aggregateSamples(list) {
  if (!list.length) return { value: null, status: 'missing', judge: null, n: 0 };
  if (list.length > 3) return { value: null, status: 'refused', reason: 'second_retry_refused', n: list.length };
  const first = list[0];
  if (list.every(function (x) { return x.status === 'not_applicable'; })) return Object.assign({ n: list.length }, first);
  const bad = list.filter(function (x) { return x.status !== 'scored'; })[0];
  if (bad) return Object.assign({ n: list.length }, bad);
  const values = list.map(function (x) { return x.value; });
  const judged = list.some(function (x) { return x.judge && x.judge !== 'code' && x.judge !== 'none'; });
  if (judged) {
    const judgeNames = {};
    list.forEach(function (x) { judgeNames[x.judge || 'code'] = true; });
    if (Object.keys(judgeNames).length > 1) {
      return { value: median(values), status: 'scored', judge: Object.keys(judgeNames).sort().join('+'), n: list.length, samples: values, flagged: 'mixed_judges' };
    }
    const judgeLimited = list.some(function (x) { return x.judge && x.judge !== 'code' && x.judge !== 'none' && (x.code_value === null || x.code_value === undefined || x.judge_value < x.code_value); });
    return { value: median(values), status: 'scored', judge: first.judge, n: list.length, samples: values, judge_limited: judgeLimited };
  }
  const same = values.every(function (v) { return v === values[0]; });
  return { value: values[0], status: 'scored', judge: first.judge || 'code', n: list.length, samples: values, flagged: same ? null : 'code_samples_disagree' };
}

function storedEntry(run, reply) {
  const k = replyKey(reply);
  return run.scores && (run.scores.entries || []).filter(function (e) { return replyKey(e) === k; })[0] || null;
}

// Recompute every entry of a run: the code half from the reply text, the judge half from the stored scores.
function buildTable(run, rubric, probes) {
  const table = {};
  const flags = [];
  // Stored judge answers belong to one replies file: scores for other bytes are never applied (Codex round 4, P2).
  const scoresFresh = !!(run.scores && run.scores.replies_sha256 === run.manifest.replies_sha256);
  if (run.scores && !scoresFresh) flags.push({ reason: 'scores_stale', label: run.label });
  (run.replies.replies || []).forEach(function (reply) {
    const probe = probeForReply(reply, probes);
    const stored = scoresFresh ? storedEntry(run, reply) : null;
    const code = scoreCode(reply, probe, rubric);
    let items = Object.keys(code.items).reduce(function (a, id) { a[id] = Object.assign({}, code.items[id]); return a; }, {});
    if (stored) {
      const byName = {};
      JUDGE_IDS.concat(OP_JUDGE_IDS).forEach(function (id) {
        const s = stored.items && stored.items[id];
        if (!s || !s.judge || s.judge === 'code' || s.judge === 'none' || s.judge === 'log') return;
        byName[s.judge] = byName[s.judge] || {};
        byName[s.judge][id] = s.status === 'abstained' ? { abstained: true, reason: s.detail } : (s.status === 'scored' ? { value: s.judge_value, confidence: s.confidence } : null);
        if (byName[s.judge][id] === null) delete byName[s.judge][id];
      });
      Object.keys(byName).forEach(function (name) { items = mergeJudge({ items: items }, byName[name], name); });
      // OP2, OP3 and OP5 need a tool log: this module has no parser for it (plan 369.6-05 owns the evidence rules).
      // A value that parser stored with status scored is restored; a deterministic item is never restored.
      ['OP2', 'OP3', 'OP5'].forEach(function (id) {
        const sv = stored.items && stored.items[id];
        if (sv && sv.status === 'scored' && typeof sv.value === 'number' && items[id] && items[id].status !== 'not_applicable' && items[id].status !== 'scored') {
          items[id] = Object.assign({}, sv, { restored_from_stored: true, judge: sv.judge || 'log' });
        }
      });
      // keep the note of an item whose judge abstained and whose code half decided alone
      JUDGE_IDS.forEach(function (id) {
        const sn = stored.items && stored.items[id] && stored.items[id].note;
        if (sn && items[id] && items[id].status === 'scored' && !items[id].note) items[id] = Object.assign({}, items[id], { note: sn });
      });
      // a stored not_applicable mark that no rule of rubric.comparison.applicability gives is a fault of the run
      Object.keys(stored.items || {}).forEach(function (id) {
        const s = stored.items[id];
        if (s && s.status === 'not_applicable' && code.not_applicable[id] !== s.rule) flags.push({ probe: reply.probe, cell: String(reply.cell), item: id, reason: 'unruled_not_applicable' });
      });
    }
    const entry = {
      sample: reply.sample || 1,
      items: items,
      total: computeTotals(items, code.applicable),
      not_applicable: code.not_applicable,
    };
    const key = reply.probe + '|' + String(reply.cell);
    (table[key] = table[key] || { probe: probe, entries: [] }).entries.push(entry);
  });
  Object.keys(table).forEach(function (k) { table[k].entries.sort(function (a, b) { return a.sample - b.sample; }); });
  return { table: table, flags: flags };
}

function sideValue(slot, item) {
  if (!slot) return { value: null, status: 'missing', judge: null, n: 0 };
  const list = slot.entries.map(function (e) { return item === 'total' ? e.total : e.items[item]; }).filter(Boolean);
  return aggregateSamples(list);
}

function plainSide(v) {
  const o = { value: v.value === undefined ? null : v.value, status: v.status, judge: v.judge === undefined ? null : v.judge, n: v.n };
  if (v.rule) o.rule = v.rule;
  if (v.reason) o.reason = v.reason;
  if (v.flagged) o.flagged = v.flagged;
  if (v.samples) o.samples = v.samples;
  return o;
}

function compareRuns(before, after, opts) {
  const o = opts || {};
  const rubric = o.rubric || loadRubric(o.repoRoot);
  const probes = o.probes || loadProbes(o.repoRoot);
  const out = {
    outcome: null, exit: null, run_kind: null,
    before: { label: before && before.label }, after: { label: after && after.label },
    per_cell: {}, matrix_entries: { scored: 0, abstained: 0, not_scored: 0, not_applicable: 0, missing: 0 },
    regressions: [], incomplete: [], refusals: [], retry_available: [], notes: [],
  };
  function done(kind) {
    const ex = rubric.comparison.outcomes[kind].exit;
    out.outcome = kind;
    out.exit = ex;
    return out;
  }
  function refuseWith(reason, detail) { out.refusals.push({ reason: reason, detail: detail || null }); return done('REFUSED'); }
  const sides = { before: before, after: after };
  for (const name of ['before', 'after']) {
    const run = sides[name];
    if (!run || !run.manifest || !run.replies || !run.repliesBytes) return refuseWith('no_manifest', name);
    const v = verifyRunManifest(run.manifest, run.repliesBytes, rubric);
    if (!v.ok) return refuseWith(v.reason, name + ': ' + (v.detail || ''));
  }
  if (before.manifest.run_kind !== after.manifest.run_kind) return refuseWith('run_kind_mismatch', before.manifest.run_kind + ' against ' + after.manifest.run_kind);
  out.run_kind = before.manifest.run_kind;
  let matrix;
  try { matrix = requiredMatrix(rubric, probes, out.run_kind); } catch (e) { return refuseWith(e.reason || 'matrix_invalid', e.detail); }
  for (const name of ['before', 'after']) {
    const bad = (sides[name].replies.replies || []).filter(function (r) { return matrix.cells.indexOf(String(r.cell)) === -1; })[0];
    if (bad) return refuseWith('run_kind_cell_mismatch', name + ' holds cell ' + bad.cell + ' outside the ' + out.run_kind + ' matrix');
  }
  const tb = buildTable(before, rubric, probes);
  const ta = buildTable(after, rubric, probes);
  tb.flags.concat(ta.flags).forEach(function (f) { out.incomplete.push(f); });
  if (before.manifest.probes_sha256 !== after.manifest.probes_sha256) out.incomplete.push({ reason: 'probes_sha256_differs' });
  if (before.manifest.rubric_sha256 !== after.manifest.rubric_sha256) out.incomplete.push({ reason: 'rubric_sha256_differs' });
  const accept = matrix.items.slice();
  const reported = matrix.reported_items.slice();
  const evaluated = accept.concat(reported).concat(GATES.filter(function (g) { return accept.indexOf(g) === -1 && reported.indexOf(g) === -1; }));
  const retryCandidates = [];
  function bump(status) { if (out.matrix_entries[status] === undefined) out.matrix_entries[status] = 0; out.matrix_entries[status] += 1; }
  matrix.cells.forEach(function (cell) {
    out.per_cell[cell] = {};
    matrix.probes.forEach(function (pid) {
      const key = pid + '|' + cell;
      const slotB = tb.table[key];
      const slotA = ta.table[key];
      const probeObj = (slotA || slotB) ? (slotA || slotB).probe : (lookupProbe(pid, probes) || normalizeProbe({ id: pid }));
      const app = applicableItems(probeObj, cell, rubric);
      const row = {};
      out.per_cell[cell][pid] = row;
      for (const name of ['before', 'after']) {
        const st = sides[name].manifest.statuses && sides[name].manifest.statuses[pid] && sides[name].manifest.statuses[pid][cell];
        // an absent status is not a complete one (Codex round 4, P2)
        if (st !== 'complete') out.incomplete.push({ probe: pid, cell: cell, side: name, reason: st ? 'cell_' + st : 'cell_status_missing' });
      }
      // A deterministic item must agree across the samples of a probe and cell, whether or not it is an acceptance item:
      // a median must never hide a code-scored fault (Codex round 4, P2).
      [['before', slotB], ['after', slotA]].forEach(function (pair) {
        if (!pair[1] || pair[1].entries.length < 2) return;
        ALL_ITEMS.forEach(function (id) {
          const agg = sideValue(pair[1], id);
          if (agg.flagged) out.incomplete.push({ probe: pid, cell: cell, item: id, side: pair[0], reason: agg.flagged });
        });
      });
      evaluated.forEach(function (id) {
        const isAccept = accept.indexOf(id) !== -1;
        const isReported = reported.indexOf(id) !== -1;
        if (id !== 'total' && app.not_applicable[id]) {
          row[id] = { na: true, rule: app.not_applicable[id], verdict: 'not_applicable' };
          bump('not_applicable'); bump('not_applicable');
          return;
        }
        const b = sideValue(slotB, id);
        const a = sideValue(slotA, id);
        if (b.status === 'refused' || a.status === 'refused') { out.refusals.push({ reason: (b.reason || a.reason), detail: pid + ' ' + cell + ' ' + id }); }
        bump(b.status); bump(a.status);
        const r = { before: plainSide(b), after: plainSide(a), verdict: 'same' };
        row[id] = r;
        const required = isAccept || isReported;
        if (b.status !== 'scored' || a.status !== 'scored') {
          r.verdict = 'incomplete';
          if (required) {
            if (b.status !== 'scored') out.incomplete.push({ probe: pid, cell: cell, item: id, side: 'before', reason: b.status });
            if (a.status !== 'scored') out.incomplete.push({ probe: pid, cell: cell, item: id, side: 'after', reason: a.status });
          }
          return;
        }
        if (b.flagged || a.flagged) out.incomplete.push({ probe: pid, cell: cell, item: id, reason: b.flagged || a.flagged });
        const judged = function (x) { return x.judge && x.judge !== 'code' && x.judge !== 'none'; };
        // never compare across judges, gates included (Codex round 4, P2)
        if (b.judge !== a.judge && (judged(b) || judged(a))) {
          r.verdict = 'incomplete';
          out.incomplete.push({ probe: pid, cell: cell, item: id, reason: 'judge_changed', before_judge: b.judge, after_judge: a.judge });
          return;
        }
        const delta = a.value - b.value;
        r.delta = delta;
        if (delta < 0 && isAccept) {
          r.verdict = 'down';
          const reg = { probe: pid, cell: cell, item: id, before: b.value, after: a.value, judge: a.judge, kind: 'drop' };
          out.regressions.push(reg);
          if (judged(a) && a.n < 3 && (id === 'total' || a.judge_limited)) retryCandidates.push({ probe: pid, cell: cell, item: id, reason: 'a judge-scored drop allows one retry of two more after samples' });
        } else if (GATES.indexOf(id) !== -1 && b.value > 0 && a.value === 0) {
          r.verdict = 'down';
          out.regressions.push({ probe: pid, cell: cell, item: id, before: b.value, after: a.value, judge: a.judge, kind: 'gate' });
        } else if (delta > 0) {
          r.verdict = 'up';
        } else if (delta < 0) {
          r.verdict = 'down'; // a reported item that dropped is visible, even though it is not an acceptance item
        }
      });
    });
  });
  // A retry is allowed only for a drop that a judge can explain. The total of a probe and cell qualifies only when
  // no code-scored item of the same probe and cell dropped as well (a deterministic drop is never retried).
  retryCandidates.forEach(function (c) {
    const otherDrops = out.regressions.filter(function (r) { return r.probe === c.probe && r.cell === c.cell && r.item !== c.item && r.item !== 'total'; });
    const codeScored = otherDrops.some(function (r) { return !r.judge || r.judge === 'code'; });
    if (c.item === 'total' && codeScored) return;
    out.retry_available.push(c);
  });
  // Surface every item where a judge was asked, abstained, and the code half decided alone (R5, R14, R15 by design)
  [['before', tb], ['after', ta]].forEach(function (pair) {
    Object.keys(pair[1].table).forEach(function (k) {
      pair[1].table[k].entries.forEach(function (en) {
        Object.keys(en.items).forEach(function (id) {
          const it = en.items[id];
          if (it && it.note && /abstained/.test(it.note)) out.notes.push({ side: pair[0], probe: k.split('|')[0], cell: k.split('|')[1], item: id, note: it.note });
        });
      });
    });
  });
  if (out.refusals.length) return done('REFUSED');
  if (out.regressions.length) return done('REGRESSION');
  if (out.incomplete.length) return done('INCOMPLETE');
  return done('COMPLETE');
}

function formatCompareText(res) {
  const lines = [];
  lines.push('compare ' + res.before.label + ' -> ' + res.after.label + ' (run kind ' + res.run_kind + '): ' + res.outcome + ' (exit ' + res.exit + ')');
  res.refusals.forEach(function (r) { lines.push('  REFUSED ' + r.reason + (r.detail ? ': ' + r.detail : '')); });
  res.regressions.forEach(function (r) { lines.push('  REGRESSION cell ' + r.cell + ' probe ' + r.probe + ' ' + r.item + ' ' + r.before + ' -> ' + r.after + (r.judge && r.judge !== 'code' ? ' (judge ' + r.judge + ')' : '')); });
  const seen = {};
  res.incomplete.forEach(function (r) {
    const k = [r.cell, r.probe, r.item, r.side, r.reason].join('|');
    if (seen[k]) return;
    seen[k] = true;
    lines.push('  INCOMPLETE' + (r.cell ? ' cell ' + r.cell : '') + (r.probe ? ' probe ' + r.probe : '') + (r.item ? ' ' + r.item : '') + (r.side ? ' (' + r.side + ')' : '') + ': ' + r.reason);
  });
  lines.push('  matrix entries: ' + Object.keys(res.matrix_entries).map(function (k) { return k + ' ' + res.matrix_entries[k]; }).join(', '));
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// import
// ---------------------------------------------------------------------------------------------
function importRun(o) {
  const repoRoot = o.repoRoot || REPO_ROOT;
  const rubric = o.rubric || loadRubric(repoRoot);
  const dir = resolveLabelDir(o.label, o.runsDir);
  const abs = path.resolve(o.from);
  let bytes;
  try { bytes = fs.readFileSync(abs); } catch (_e) { throw fail('import_source_unreadable', String(o.from)); }
  const rel = path.relative(repoRoot, abs);
  const parsed = parseProbeReplies(bytes.toString('utf8'));
  if (!parsed.length) throw fail('import_empty', String(o.from));
  parsed.forEach(function (p) { if (!IMPORT_PROBE_META[p.probe]) throw fail('import_probe_unknown', p.probe); });
  const replies = parsed.map(function (p) {
    return {
      probe: p.probe, cell: '1', sample: 1, text: p.text, prompt: p.prompt, context: p.context,
      turn_index: IMPORT_PROBE_META[p.probe].turn_index,
      method: 'agent text only, no hooks (research method P)',
      source_heading: p.heading,
    };
  });
  const repliesBytes = Buffer.from(JSON.stringify({ version: 1, label: o.label, kind: 'research-import', replies: replies }, null, 2) + '\n');
  const statuses = {};
  replies.forEach(function (r) { statuses[r.probe] = { '1': 'complete' }; });
  const lastCommit = git(['log', '-1', '--format=%H', '--', rel], { cwd: repoRoot });
  const commit = lastCommit.status === 0 ? String(lastCommit.stdout).trim() : '';
  const committed = commit ? gitShow(commit, rel, { repoRoot: repoRoot }) : null;
  const manifest = writeRunManifest({
    kind: 'research-import', label: o.label, repliesBytes: repliesBytes, statuses: statuses, cells: ['1'], rubric: rubric, repoRoot: repoRoot,
    extra: { source: rel, source_commit: commit || null, source_sha256: sha256(bytes), source_dirty: !committed || sha256(committed) !== sha256(bytes) },
  });
  writeRunFiles(dir, repliesBytes, manifest);
  return { dir: dir, replies: replies.length, manifest: manifest };
}

// ---------------------------------------------------------------------------------------------
// generate (the live leg: exit 77 with a reason, 1 under LARRY_VOICE_REQUIRE_LIVE=1, 3 when partial)
// ---------------------------------------------------------------------------------------------
function buildGenerateArgs(spec) {
  const model = spec && spec.model;
  if (model && /fable/i.test(String(model))) throw fail('model_refused', 'a model id containing fable is refused');
  if (!spec || !spec.systemPromptFile || typeof spec.prompt !== 'string') throw fail('generate_args_incomplete');
  // no plugin directory, no tools, no saved session, no MCP servers, no slash commands
  const args = ['--print', '--output-format', 'stream-json', '--verbose', '--tools', '', '--no-session-persistence',
    '--strict-mcp-config', '--disable-slash-commands', '--system-prompt-file', String(spec.systemPromptFile)];
  if (model) args.push('--model', String(model));
  args.push(spec.prompt);
  return args;
}

function renderTranscript(jsonlText) {
  const out = [];
  String(jsonlText).split('\n').filter(Boolean).forEach(function (line) {
    let msg;
    try { msg = JSON.parse(line); } catch (_e) { return; }
    const who = msg.role === 'user' ? 'Navigator' : 'Larry';
    (msg.content || []).forEach(function (b) {
      if (b.type === 'text') out.push(who + ': ' + b.text);
      else if (b.type === 'tool_use') out.push('[tool call] ' + b.name + ' ' + JSON.stringify(b.input));
      else if (b.type === 'tool_result') out.push('[tool result] ' + JSON.stringify(b.content));
    });
  });
  return out.join('\n');
}

const SESSION_HEAD = 'SessionStart hook context for this conversation:\n';
const SKILL_HEAD = 'Loaded skill: ';
const STYLE_HEAD = 'Active output style:\n';
const PROMPT_HEAD = 'Per-turn hook context for this message:\n';

/*
 * buildCellPrompt(cell, parts) -> { system, transcriptPrefix, manifest }. Cell 1 is exactly the agent body (the P
 * method). Cells 2 and 3 add the SessionStart capture (and the transcript for 3). The shipped cells 2s and 3s add
 * every frontmatter skill, the output style and the per-turn capture (D-43, A-03).
 */
function buildCellPrompt(cell, parts) {
  const c = String(cell);
  if (['1', '2', '3', '2s', '3s'].indexOf(c) === -1) throw fail('cell_unknown', c);
  const body = String(parts.agentBody);
  const manifest = { cell: c, agent_body_sha256: sha256(Buffer.from(body)), parts: ['agent_body'] };
  let system = body;
  if (c !== '1') {
    system += '\n\n' + SESSION_HEAD + String(parts.sessionCapture || '');
    manifest.session_start_capture_sha256 = sha256(Buffer.from(String(parts.sessionCapture || '')));
    manifest.parts.push('session_start_capture');
  }
  if (c === '2s' || c === '3s') {
    manifest.skills = [];
    (parts.skills || []).forEach(function (s) {
      system += '\n\n' + SKILL_HEAD + s.path + '\n' + s.text;
      manifest.skills.push({ path: s.path, sha256: sha256(Buffer.from(String(s.text))) });
    });
    system += '\n\n' + STYLE_HEAD + String(parts.outputStyleBody || '');
    manifest.output_style_sha256 = sha256(Buffer.from(String(parts.outputStyleBody || '')));
    system += '\n\n' + PROMPT_HEAD + String(parts.userPromptCapture || '');
    manifest.user_prompt_capture_sha256 = sha256(Buffer.from(String(parts.userPromptCapture || '')));
    manifest.parts.push('skills', 'output_style', 'user_prompt_capture');
  }
  let transcriptPrefix = '';
  if (c === '3' || c === '3s') {
    transcriptPrefix = renderTranscript(parts.transcriptText || '');
    manifest.transcript_sha256 = sha256(Buffer.from(String(parts.transcriptText || '')));
    manifest.parts.push('transcript');
  }
  return { system: system, transcriptPrefix: transcriptPrefix, manifest: manifest };
}

function buildUserPrompt(probe, built) {
  const prior = [built.transcriptPrefix, probe.context].filter(Boolean).join('\n');
  if (!prior) return probe.prompt;
  return 'Conversation so far:\n' + prior + '\n\nThe navigator now writes:\n' + probe.prompt;
}

function parseStreamJson(stdout) {
  let init = null;
  let result = null;
  const texts = [];
  String(stdout).split('\n').forEach(function (line) {
    const t = line.trim();
    if (!t || t[0] !== '{') return;
    let ev;
    try { ev = JSON.parse(t); } catch (_e) { return; }
    if (ev.type === 'system' && ev.subtype === 'init' && !init) init = ev;
    else if (ev.type === 'result' && typeof ev.result === 'string') result = ev.result;
    else if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) ev.message.content.forEach(function (b) { if (b.type === 'text') texts.push(b.text); });
  });
  return { init: init, text: result !== null ? result : (texts.length ? texts.join('') : null) };
}

function initSummary(init) {
  if (!init) return null;
  // A missing or malformed list stays null: it is evidence that is absent, never an empty list (Codex round 4, P1).
  const names = function (a) { return Array.isArray(a) ? a.map(function (x) { return typeof x === 'string' ? x : (x && x.name) || String(x); }) : null; };
  return { agent: init.agent || null, plugins: names(init.plugins), mcp_servers: names(init.mcp_servers), tools: names(init.tools), output_style: init.output_style || null };
}

function frontmatterSkills(agentText, repoRoot) {
  const matter = require('gray-matter');
  const fm = matter(agentText).data || {};
  return (fm.skills || []).map(function (name) {
    const rel = 'skills/' + name + '/SKILL.md';
    return { path: rel, text: fs.readFileSync(path.join(repoRoot, rel), 'utf8') };
  });
}

function liveExit(code) { return process.env.LARRY_VOICE_REQUIRE_LIVE === '1' ? 1 : code; }

async function generateRun(o) {
  const iso = require('./isolate-larry-voice.cjs');
  const repoRoot = o.repoRoot || REPO_ROOT;
  const rubric = o.rubric || loadRubric(repoRoot);
  const probes = o.probeSet || loadProbes(repoRoot);
  const env = o.env || process.env;
  if (o.model && /fable/i.test(String(o.model))) throw fail('model_refused', 'a model id containing fable is refused');
  const dir = resolveLabelDir(o.label, o.runsDir);
  if (fs.existsSync(path.join(dir, 'replies.json'))) throw fail('label_exists', o.label);
  const cells = (o.cells && o.cells.length ? o.cells : ['1', '2', '3', '2s', '3s']).map(String);
  cells.forEach(function (c) { if (['1', '2', '3', '2s', '3s'].indexOf(c) === -1) throw fail('cell_unknown', c); });
  const wanted = o.probes && o.probes.length ? o.probes : probes.probes.map(function (p) { return p.id; });
  const probeList = wanted.map(function (id) {
    const p = (probes.probes || []).filter(function (x) { return x.id === id; })[0];
    if (!p) throw fail('probe_unknown', id);
    return normalizeProbe(p);
  });
  const samples = Math.max(1, Math.min(3, Number(o.samples) || 1));
  const gate = liveGate(env);
  if (!gate.ok) return { exit: liveExit(77), reason: gate.reason, label: o.label };
  const scratch = iso.makeScratch(SEAL_SCRATCH_PREFIX, { claudeCli: o.claudeCli });
  if (!scratch.claude) return { exit: liveExit(77), reason: 'claude_cli_missing', label: o.label };
  const spawn = o.spawn || iso.spawnIsolated;
  const startClean = inputsClean(repoRoot);
  const probesBytesUsed = fs.readFileSync(path.join(repoRoot, PROBES_REL));
  const rubricBytesUsed = fs.readFileSync(path.join(repoRoot, RUBRIC_REL));
  const agentText = fs.readFileSync(path.join(repoRoot, AGENT_REL), 'utf8');
  const agentBody = agentBodyOf(agentText);
  const styleBody = agentBodyOf(fs.readFileSync(path.join(repoRoot, OUTPUT_STYLE_REL), 'utf8'));
  const skills = cells.some(function (c) { return c === '2s' || c === '3s'; }) ? frontmatterSkills(agentText, repoRoot) : [];
  const transcriptText = fs.readFileSync(path.join(repoRoot, TRANSCRIPT_REL), 'utf8');
  const statuses = {};
  const skipped = {};
  const replies = [];
  probeList.forEach(function (p) { statuses[p.id] = {}; });
  let roomDir = null;
  let sessionCapture = null;
  const needsRoom = cells.some(function (c) { return c !== '1'; });
  let roomFailure = null;
  if (needsRoom) {
    try {
      roomDir = iso.bornScratchRoom(scratch, { envOpts: { parentEnv: env } }).roomDir;
      sessionCapture = iso.captureHookContext(scratch, { roomDir: roomDir, hook: 'session-start' }).text;
    } catch (e) { roomFailure = e; }
  }
  const claudeBin = path.join(scratch.bin, 'claude');
  for (const cell of cells) {
    if (cell !== '1' && roomFailure) {
      skipped[cell] = String(roomFailure.reason || roomFailure.message).slice(0, 120);
      probeList.forEach(function (p) { statuses[p.id][cell] = 'skipped'; });
      continue;
    }
    for (const p of probeList) {
      let statusForCell = 'complete';
      for (let s = 1; s <= samples; s += 1) {
        let userCapture = '';
        if (cell === '2s' || cell === '3s') {
          try { userCapture = iso.captureHookContext(scratch, { roomDir: roomDir, hook: 'user-prompt', prompt: p.prompt }).text; } catch (e) { userCapture = ''; statusForCell = 'error'; }
        }
        const built = buildCellPrompt(cell, { agentBody: agentBody, sessionCapture: sessionCapture, skills: skills, outputStyleBody: styleBody, userPromptCapture: userCapture, transcriptText: transcriptText });
        const promptFile = path.join(scratch.tmp, 'system-' + p.id + '-' + cell + '-' + s + '.txt');
        fs.writeFileSync(promptFile, built.system);
        const userPrompt = buildUserPrompt(p, built);
        const args = buildGenerateArgs({ systemPromptFile: promptFile, prompt: userPrompt, model: o.model });
        const r = spawn(scratch, claudeBin, args, { cwd: scratch.root, input: '', envOpts: { withCredential: true, parentEnv: env }, timeout: o.timeoutMs || 240000 });
        const parsed = r && r.status === 0 ? parseStreamJson(r.stdout) : { init: null, text: null };
        if (!parsed.text) { statusForCell = 'error'; continue; }
        const init = initSummary(parsed.init);
        const proven = compositionProven(init);
        if (!proven && statusForCell === 'complete') statusForCell = 'composition_unproven';
        replies.push({
          probe: p.id, cell: cell, sample: s, text: parsed.text, prompt: p.prompt, context: p.context, turn_index: p.turn_index,
          date: new Date().toISOString(),
          args: args.slice(0, -1),
          method: rubric.ladder.cells[cell].method,
          composition: Object.assign({ proven: proven, init_event: init }, built.manifest),
        });
      }
      statuses[p.id][cell] = statusForCell;
    }
  }
  const repliesBytes = Buffer.from(JSON.stringify({ version: 1, label: o.label, kind: 'voice-fixture-generation', replies: replies }, null, 2) + '\n');
  const ver = spawnSync(claudeBin, ['--version'], { encoding: 'utf8', timeout: 30000, env: iso.isolatedEnv(scratch, {}) });
  const base = writeRunManifest({
    kind: 'voice-fixture-generation', label: o.label, repliesBytes: repliesBytes, statuses: statuses, cells: cells, rubric: rubric, repoRoot: repoRoot,
    claudeVersion: ver.status === 0 ? String(ver.stdout).trim().slice(0, 60) : null,
    executables: { node: scratch.node, claude: scratch.claude },
    used: { probes_sha256: sha256(probesBytesUsed), rubric_sha256: sha256(rubricBytesUsed), agent_body_sha256: sha256(Buffer.from(agentBody)), inputs_clean: startClean },
    extra: { samples: samples, model: o.model || null, skipped: skipped },
  });
  const sealed = sealRun(repliesBytes, base, { home: o.home, create: true });
  writeRunFiles(dir, repliesBytes, sealed);
  const all = Object.keys(statuses).every(function (id) { return Object.keys(statuses[id]).every(function (c) { return statuses[id][c] === 'complete'; }); });
  return { exit: all ? 0 : 3, label: o.label, statuses: statuses, skipped: skipped, dir: dir, replies: replies.length };
}

// ---------------------------------------------------------------------------------------------
// the operational probe (plan 369.6-05): a live session in a scratch room, tools on, isolated
// ---------------------------------------------------------------------------------------------
const FENCE_HOOK_REL = 'evals/larry-voice/fence-hook.cjs';
const OPERATE_CELLS = Object.freeze(['2s-live', '3s-live']);
// built-in file, shell, web and agent tools: denied in the scratch settings and off through --tools ""
const DENIED_BUILTINS = Object.freeze(['Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'PowerShell', 'Task', 'TodoWrite']);
const OWN_MCP_ALLOW = Object.freeze(['mcp__plugin_mos_mindrian-os', 'mcp__plugin_mos_mindrian-brain']);
const OPERATE_METHOD = 'scratch room, tools on, isolated';

function shellQuote(v) {
  const s = String(v);
  if (/['\n\r\0]/.test(s) || !path.isAbsolute(s)) throw fail('settings_path_unsafe', 'a settings path must be absolute and hold no quote or newline');
  return "'" + s + "'";
}

/*
 * writeScratchSettings(scratch, opts) -> { file, fenceLog }. Writes a settings file INSIDE the scratch root: the built-in file,
 * shell and web tools denied, the dev plugin's own MCP tools allowed, the fence registered as the PreToolUse hook of every tool
 * with FENCE_ROOT and FENCE_LOG set in the hook command. opts: fenceHook (absolute path), allowedMcpTools, node (absolute path).
 */
function writeScratchSettings(scratch, opts) {
  const o = opts || {};
  const fenceHook = o.fenceHook || path.join(REPO_ROOT, FENCE_HOOK_REL);
  const node = o.node || path.join(scratch.bin, 'node');
  const dir = path.join(scratch.root, 'settings');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const fenceLog = path.join(scratch.root, 'fence-log.jsonl');
  fs.writeFileSync(fenceLog, '', { mode: 0o600 });
  const command = 'env FENCE_ROOT=' + shellQuote(scratch.root) + ' FENCE_LOG=' + shellQuote(fenceLog) + ' ' + shellQuote(node) + ' ' + shellQuote(fenceHook);
  const settings = {
    permissions: { deny: DENIED_BUILTINS.slice(), allow: (o.allowedMcpTools || OWN_MCP_ALLOW).slice() },
    hooks: { PreToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: command, timeout: 10 }] }] },
  };
  const file = path.join(dir, 'operate-settings.json');
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
  return { file: file, fenceLog: fenceLog };
}

/*
 * buildOperateArgs(spec) -> the claude argument list (pure). One plugin directory (the dev plugin), its own MCP servers, the
 * built-in tools off, the scratch settings file that registers the fence, stream-json with tool calls and the init event,
 * no saved session, a permission mode that answers nobody, and the persona by a system prompt file the runner wrote.
 */
function buildOperateArgs(spec) {
  const model = spec && spec.model;
  if (model && /fable/i.test(String(model))) throw fail('model_refused', 'a model id containing fable is refused');
  if (!spec || typeof spec.prompt !== 'string' || !spec.pluginDir || !spec.settingsFile || !spec.systemPromptFile) throw fail('operate_args_incomplete');
  ['pluginDir', 'settingsFile', 'systemPromptFile'].forEach(function (k) { if (!path.isAbsolute(String(spec[k]))) throw fail('operate_args_incomplete', k + ' must be absolute'); });
  const args = ['--print', '--output-format', 'stream-json', '--verbose', '--tools', '', '--no-session-persistence',
    '--plugin-dir', String(spec.pluginDir), '--settings', String(spec.settingsFile), '--setting-sources', 'user',
    '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--disable-slash-commands', '--system-prompt-file', String(spec.systemPromptFile)];
  if (model) args.push('--model', String(model));
  args.push(spec.prompt);
  return args;
}

// The system prompt of an operation cell: the agent body and the full text of its frontmatter skills only. In the live
// session the hooks supply the session-start and per-turn context and the plugin supplies the output style.
function buildOperateCellPrompt(cell, parts) {
  const c = String(cell);
  if (OPERATE_CELLS.indexOf(c) === -1) throw fail('cell_unknown', c);
  const body = String(parts.agentBody);
  const manifest = { cell: c, agent_body_sha256: sha256(Buffer.from(body)), parts: ['agent_body'], skills: [] };
  let system = body;
  (parts.skills || []).forEach(function (sk) {
    system += '\n\n' + SKILL_HEAD + sk.path + '\n' + sk.text;
    manifest.skills.push({ path: sk.path, sha256: sha256(Buffer.from(String(sk.text))) });
  });
  manifest.parts.push('skills');
  manifest.system_prompt_sha256 = sha256(Buffer.from(system));
  let transcriptPrefix = '';
  if (c === '3s-live') {
    transcriptPrefix = renderTranscript(parts.transcriptText || '');
    manifest.transcript_sha256 = sha256(Buffer.from(String(parts.transcriptText || '')));
    manifest.parts.push('transcript');
  }
  return { system: system, transcriptPrefix: transcriptPrefix, manifest: manifest };
}

function operationCompositionProven(init, systemSha) {
  return !!(init && Array.isArray(init.plugins) && Array.isArray(init.mcp_servers) && Array.isArray(init.tools) && systemSha);
}

function readFenceLines(file, offset) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (_e) { return { entries: [], next: offset }; }
  const lines = text.split('\n').filter(Boolean);
  const entries = [];
  lines.slice(offset).forEach(function (l) { try { entries.push(JSON.parse(l)); } catch (_e) { entries.push({ seq: null, tool: '', reason: 'fence_log_unreadable' }); } });
  return { entries: entries, next: lines.length };
}

// A fingerprint of the repository state: the status lines, a hash of the content difference of every tracked file against
// HEAD (so a second write to a file that was already modified still shows), and a hash of every untracked file. The run
// folder of the label is excluded. Codex round 3, finding 4.
function repoFingerprint(repoRoot, relRunDir) {
  const st = git(['status', '--porcelain'], { cwd: repoRoot });
  if (st.status !== 0) return null;
  const lines = String(st.stdout).split('\n').filter(Boolean).filter(function (l) { return !relRunDir || l.indexOf(relRunDir) === -1; });
  const diffArgs = ['diff', 'HEAD', '--binary', '--'].concat(['.']).concat(relRunDir ? [':(exclude)' + relRunDir] : []);
  const df = git(diffArgs, { cwd: repoRoot, buffer: true });
  const diffSha = df.status === 0 ? sha256(df.stdout) : 'diff_failed';
  // NUL separated, so a file name with non-ASCII characters is read by its real name. A symlink is fingerprinted by its link
  // text and never followed; a file that is not a regular file is recorded by type and never opened (Codex round 4).
  const un = git(['ls-files', '-z', '--others', '--exclude-standard'], { cwd: repoRoot });
  const untracked = {};
  if (un.status === 0) {
    String(un.stdout).split('\0').filter(Boolean).forEach(function (rel) {
      if (relRunDir && rel.indexOf(relRunDir) === 0) return;
      const abs = path.join(repoRoot, rel);
      try {
        const st = fs.lstatSync(abs);
        if (st.isSymbolicLink()) untracked[rel] = 'link:' + fs.readlinkSync(abs);
        else if (st.isFile()) untracked[rel] = sha256(fs.readFileSync(abs));
        else untracked[rel] = 'type:' + (st.isDirectory() ? 'dir' : 'special');
      } catch (_e) { untracked[rel] = 'unreadable'; }
    });
  }
  return { lines: lines, diffSha: diffSha, untracked: untracked };
}

function repoChanges(before, after) {
  if (!before || !after) return [];
  const out = after.lines.filter(function (l) { return before.lines.indexOf(l) === -1; });
  if (before.diffSha !== after.diffSha) out.push('content of tracked files changed');
  Object.keys(after.untracked).forEach(function (rel) { if (before.untracked[rel] !== after.untracked[rel]) out.push('untracked file changed: ' + rel); });
  Object.keys(before.untracked).forEach(function (rel) { if (!(rel in after.untracked)) out.push('untracked file removed: ' + rel); });
  return out;
}

/*
 * operateRun(o) -> { exit, reason?, label, statuses, dir, replies }.
 * Order: the live gate (skip variable, credential), the scratch root, the startup chain verdict (the reconcile switch proof
 * runs here, on a stand-in copy), only then the room birth and any claude spawn. A safety stop is not a test result:
 * exit 1 with the replies kept under status breach.
 */
async function operateInner(o, holder) {
  const iso = require('./isolate-larry-voice.cjs');
  const repoRoot = o.repoRoot || REPO_ROOT;
  const rubric = o.rubric || loadRubric(repoRoot);
  const probes = o.probeSet || loadProbes(repoRoot);
  const env = o.env || process.env;
  if (o.model && /fable/i.test(String(o.model))) throw fail('model_refused', 'a model id containing fable is refused');
  const dir = resolveLabelDir(o.label, o.runsDir);
  if (fs.existsSync(path.join(dir, 'replies.json'))) throw fail('label_exists', o.label);
  const cells = (o.cells && o.cells.length ? o.cells : OPERATE_CELLS).map(String);
  cells.forEach(function (c) { if (OPERATE_CELLS.indexOf(c) === -1) throw fail('cell_unknown', c); });
  const wanted = o.probes && o.probes.length ? o.probes : (probes.operation_probes || []).map(function (p) { return p.id; });
  const probeList = wanted.map(function (id) {
    const p = (probes.operation_probes || []).filter(function (x) { return x.id === id; })[0];
    if (!p) throw fail('probe_unknown', id);
    return { raw: p, probe: normalizeProbe(p) };
  });
  const gate = liveGate(env);
  if (!gate.ok) return { exit: liveExit(77), reason: gate.reason, label: o.label };
  const scratch = iso.makeScratch(SEAL_SCRATCH_PREFIX, { claudeCli: o.claudeCli });
  holder.scratch = scratch;
  if (!scratch.claude) return { exit: liveExit(77), reason: 'claude_cli_missing', label: o.label };
  const verdictFn = o.startupChainVerdict || iso.startupChainVerdict;
  const verdict = verdictFn(path.join(repoRoot, 'hooks', 'hooks.json'), { scratch: scratch, repoRoot: repoRoot });
  const live = iso.liveLegGate(verdict, { loadsPlugin: true });
  if (!live.ok) {
    return { exit: live.exit, reason: live.reason, label: o.label, proof: verdict.reconcile_proof ? verdict.reconcile_proof.reason : null, blockers: verdict.blockers };
  }
  const spawn = o.spawn || iso.spawnIsolated;
  const startClean = inputsClean(repoRoot);
  const probesBytesUsed = fs.readFileSync(path.join(repoRoot, PROBES_REL));
  const rubricBytesUsed = fs.readFileSync(path.join(repoRoot, RUBRIC_REL));
  const agentText = fs.readFileSync(path.join(repoRoot, AGENT_REL), 'utf8');
  const agentBody = agentBodyOf(agentText);
  const skills = frontmatterSkills(agentText, repoRoot);
  const transcriptText = fs.readFileSync(path.join(repoRoot, TRANSCRIPT_REL), 'utf8');
  const born = (o.born || iso.bornScratchRoom)(scratch, { envOpts: { parentEnv: env } });
  const settings = writeScratchSettings(scratch, {});
  const registry = o.registry || oplog.loadRegistry(repoRoot);
  const relRunDir = path.relative(repoRoot, dir).split(path.sep).join('/');
  const fingerprint = o.fingerprint || repoFingerprint;
  const before = fingerprint(repoRoot, relRunDir);
  const statuses = {};
  const replies = [];
  probeList.forEach(function (p) { statuses[p.probe.id] = {}; });
  let breach = null;
  let fenceOffset = 0;
  const claudeBin = path.join(scratch.bin, 'claude');
  outer:
  for (const cell of cells) {
    for (const p of probeList) {
      if (p.raw.cells && p.raw.cells.indexOf(cell) === -1) continue;
      const built = buildOperateCellPrompt(cell, { agentBody: agentBody, skills: skills, transcriptText: transcriptText });
      const promptFile = path.join(scratch.tmp, 'system-' + p.probe.id + '-' + cell + '.txt');
      fs.writeFileSync(promptFile, built.system);
      const args = buildOperateArgs({ prompt: buildUserPrompt(p.probe, built), model: o.model, pluginDir: repoRoot, settingsFile: settings.file, systemPromptFile: promptFile });
      const r = spawn(scratch, claudeBin, args, { cwd: born.roomDir, input: '', envOpts: { withCredential: true, parentEnv: env }, timeout: o.timeoutMs || 300000 });
      const stdout = r && r.stdout ? String(r.stdout) : '';
      const record = oplog.parseStream(stdout, { scratchRoot: scratch.root, roomDir: born.roomDir, slug: born.slug, registry: registry });
      const fl = readFenceLines(settings.fenceLog, fenceOffset);
      fenceOffset = fl.next;
      record.fence = fl.entries;
      const fv = oplog.fenceVerdict(record, {});
      const changed = repoChanges(before, fingerprint(repoRoot, relRunDir));
      const text = record.reply;
      const score = oplog.scoreOperationLog(record, text || '', p.probe);
      const init = record.init;
      const proven = operationCompositionProven(init, built.manifest.system_prompt_sha256);
      let status = 'complete';
      if (fv.verdict !== 'ok') status = 'breach';
      else if (changed.length) status = 'breach';
      else if (!text || !r || r.status !== 0) status = 'error';
      else if (!proven) status = 'composition_unproven';
      statuses[p.probe.id][cell] = status;
      if (text) {
        replies.push({
          probe: p.probe.id, cell: cell, sample: 1, text: text, prompt: p.probe.prompt, context: p.probe.context, turn_index: p.probe.turn_index,
          date: new Date().toISOString(), args: args.slice(0, -1), method: OPERATE_METHOD, status: status,
          composition: Object.assign({ proven: proven, init_event: init }, built.manifest),
          tool_log: oplog.redactToolLog(record),
          op_code: { OP2: { value: score.OP2.value, reason: score.OP2.reason, evidence: score.OP2.evidence }, OP5: { value: score.OP5.value, reason: score.OP5.reason, evidence: score.OP5.evidence } },
          routes: oplog.routesReport(record),
        });
      }
      if (status === 'breach') {
        breach = fv.verdict !== 'ok' ? fv.reason : 'repo_file_changed';
        if (changed.length) breach += ': ' + changed.slice(0, 3).join(' ; ');
        break outer;
      }
    }
  }
  const repliesBytes = Buffer.from(JSON.stringify({ version: 1, label: o.label, kind: 'operation-generation', replies: replies }, null, 2) + '\n');
  const ver = spawnSync(claudeBin, ['--version'], { encoding: 'utf8', timeout: 30000, env: iso.isolatedEnv(scratch, {}) });
  const manifest = writeRunManifest({
    kind: 'operation-generation', label: o.label, repliesBytes: repliesBytes, statuses: statuses, cells: cells, rubric: rubric, repoRoot: repoRoot,
    claudeVersion: ver.status === 0 ? String(ver.stdout).trim().slice(0, 60) : null,
    executables: { node: scratch.node, claude: scratch.claude },
    used: { probes_sha256: sha256(probesBytesUsed), rubric_sha256: sha256(rubricBytesUsed), agent_body_sha256: sha256(Buffer.from(agentBody)), inputs_clean: startClean },
    extra: {
      samples: 1, model: o.model || null, method: OPERATE_METHOD, breach: breach,
      reconcile_proof: verdict.reconcile_proof ? { proven: verdict.reconcile_proof.proven, reason: verdict.reconcile_proof.reason, reconcile_sha256: verdict.reconcile_proof.reconcile_sha256 || null } : null,
      startup_chain: { containable: verdict.containable, hooks: verdict.hooks.map(function (h) { return { hook: h.hook, containable: h.containable }; }) },
    },
  });
  writeRunFiles(dir, repliesBytes, manifest);
  if (breach) return { exit: 1, reason: breach, label: o.label, statuses: statuses, dir: dir, replies: replies.length };
  const all = Object.keys(statuses).every(function (id) { return Object.keys(statuses[id]).length > 0 && Object.keys(statuses[id]).every(function (c) { return statuses[id][c] === 'complete'; }); });
  return { exit: all ? 0 : 3, label: o.label, statuses: statuses, dir: dir, replies: replies.length };
}

// ---------------------------------------------------------------------------------------------
// ledger rows (the CONTEXT "Measurement ledger" columns)
// ---------------------------------------------------------------------------------------------
function voiceShares(repoRoot) {
  const r = spawnSync(process.execPath, [path.join(repoRoot || REPO_ROOT, 'scripts', 'measure-larry-voice.cjs'), 'files', '--json'], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) return 'shares not available';
  try {
    const j = JSON.parse(r.stdout);
    return 'agent voice ' + j.agent.loose.share.voice + '/brand ' + j.agent.loose.share.brand + '/op ' + j.agent.loose.share.operation + ' strict ' + j.agent.strict.share + '; skill voice ' + j.skill.loose.share.voice;
  } catch (_e) { return 'shares not available'; }
}

// The scratch root holds a copy of nothing the operator owns, but its HOME may hold a session cache: remove it after the run.
async function operateRun(o) {
  const holder = { scratch: null };
  try {
    return await operateInner(o, holder);
  } finally {
    const root = holder.scratch && holder.scratch.root;
    if (root && !o.keepScratch && path.basename(root).indexOf(SEAL_SCRATCH_PREFIX) === 0 && path.dirname(root) === fs.realpathSync(os.tmpdir())) {
      try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }
}

// One row per operation cell: OP1 to OP5 per probe, the routes the evidence shows (executed or proposed) against the
// probe's expect_routes, the judge that ran per item, and the status. A claim of a route the evidence does not show is not made.
function operationRows(spec, opRun, probes, rubric) {
  const out = [];
  const scores = opRun.scores;
  const cells = (opRun.manifest.cells || []).slice();
  const probeDefs = {};
  (probes.operation_probes || []).forEach(function (p) { probeDefs[p.id] = p; });
  let required = [];
  try { required = requiredMatrix(rubric, probes, opRun.manifest.run_kind).probes; } catch (_e) { required = []; }
  cells.forEach(function (cell) {
    const replies = (opRun.replies.replies || []).filter(function (r) { return String(r.cell) === String(cell); });
    const entries = scores ? (scores.entries || []).filter(function (e) { return String(e.cell) === String(cell); }) : [];
    const st = opRun.manifest.statuses || {};
    const bad = [];
    required.forEach(function (pid) {
      const v = st[pid] && st[pid][cell];
      if (v !== 'complete') bad.push(pid + ' ' + (v || 'no status'));
    });
    let status;
    if (!replies.length) status = 'NOT RUN: no replies for this cell' + (opRun.manifest.breach ? ' (breach: ' + opRun.manifest.breach + ')' : '');
    else if (!scores) status = 'NOT RUN: not scored';
    else status = bad.length ? 'INCOMPLETE: ' + bad.join('; ') : (entries.some(function (e) { return e.total.status !== 'scored'; }) ? 'INCOMPLETE: a total is not scored' : 'COMPLETE');
    const perProbe = replies.map(function (r) {
      const e = entries.filter(function (x) { return x.probe === r.probe; })[0];
      const it = function (id) { return e && e.items[id] ? (e.items[id].status === 'scored' ? e.items[id].value : e.items[id].status) : '-'; };
      const expect = (probeDefs[r.probe] && probeDefs[r.probe].expect_routes) || [];
      const routes = r.routes || { executed: [], proposed: [] };
      return r.probe + ' OP1 ' + it('OP1') + ' OP2 ' + it('OP2') + ' OP3 ' + it('OP3') + ' OP4 ' + it('OP4') + ' OP5 ' + it('OP5') +
        ' executed [' + routes.executed.join(',') + '] proposed [' + routes.proposed.join(',') + '] expect [' + expect.join(' / ') + ']';
    }).join('; ');
    const judges = scores && scores.judge_per_item ? ['OP2', 'OP3'].map(function (id) { return id + '=' + (scores.judge_per_item[id] ? Object.keys(scores.judge_per_item[id]).join('/') : 'none'); }).join(' ') : '-';
    out.push({ cell: String(cell), status: status, perProbe: perProbe || '-', judges: judges, ran: replies.length > 0 });
  });
  return out;
}

function ledgerRows(spec) {
  const repoRoot = spec.repoRoot || REPO_ROOT;
  const rubric = spec.rubric || loadRubric(repoRoot);
  const probes = spec.probes || loadProbes(repoRoot);
  const run = spec.run;
  const rows = [];
  const commit = (run.manifest && run.manifest.commit || '').slice(0, 9) || 'unknown';
  const shares = spec.shares || voiceShares(repoRoot);
  const doctrineTest = path.join(repoRoot, 'tests', 'test-3696-operation-doctrine.cjs');
  const doctrine = fs.existsSync(doctrineTest) ? 'doctrine legs present, run tests/test-3696-operation-doctrine.cjs for KNOWN and PASS' : 'doctrine check not present';
  const identityFile = path.join(repoRoot, 'lib', 'hmi', 'larry-identity.cjs');
  let version = 'constant not present';
  if (fs.existsSync(identityFile)) { try { version = String(require(identityFile).VERSION); } catch (_e) { version = 'constant not readable'; } }
  const scores = run.scores;
  const cells = (run.manifest.cells || []).slice();
  const opRun = spec.operationRun || null;
  cells.forEach(function (cell) {
    let status;
    let perProbe = '';
    let judges = '';
    if (!scores) {
      status = 'NOT RUN: not scored';
    } else {
      const entries = (scores.entries || []).filter(function (e) { return String(e.cell) === String(cell); });
      const skippedReason = run.manifest.skipped && run.manifest.skipped[cell];
      if (skippedReason) status = 'NOT RUN: ' + skippedReason;
      else {
        const kinds = {};
        entries.forEach(function (e) { Object.keys(e.items).forEach(function (id) { const j = e.items[id].judge; if (j && e.items[id].status === 'scored') kinds[id + ':' + j] = true; }); });
        judges = Object.keys(kinds).length ? Object.keys(scores.judge_per_item || {}).slice(0, 20).map(function (id) { return id + '=' + Object.keys(scores.judge_per_item[id]).join('/'); }).join(' ') : 'none';
        const table = entries.map(function (e) {
          const it = function (id) { return e.items[id] && e.items[id].status === 'scored' ? e.items[id].value : (e.items[id] ? e.items[id].status : '-'); };
          return e.probe + ' total ' + (e.total.status === 'scored' ? e.total.value : e.total.status) + ' R2 ' + it('R2') + ' R3 ' + it('R3') + ' R8 ' + it('R8') + ' R14 ' + it('R14') + ' OP1 ' + it('OP1');
        });
        perProbe = table.join('; ');
        const st = (run.manifest.statuses || {});
        // coverage is checked against the required matrix of the run kind, never against what the run happens to hold
        let required = [];
        try { required = requiredMatrix(rubric, probes, run.manifest.run_kind).probes; } catch (_e) { required = []; }
        const present = entries.map(function (e) { return e.probe; });
        const missingProbes = required.filter(function (pid) { return present.indexOf(pid) === -1; });
        const notComplete = required.filter(function (pid) { return !st[pid] || st[pid][cell] !== 'complete'; });
        const holes = entries.filter(function (e) { return e.total.status !== 'scored'; }).map(function (e) { return e.probe + ' total ' + e.total.status; });
        const reasons = [];
        if (missingProbes.length) reasons.push('missing probes ' + missingProbes.join(','));
        if (notComplete.length) reasons.push('cell status not complete for ' + notComplete.join(','));
        if (holes.length) reasons.push(holes.join(', '));
        status = !entries.length ? 'NOT RUN: no replies for this cell' : (reasons.length ? 'INCOMPLETE: ' + reasons.join('; ') : 'COMPLETE');
      }
    }
    rows.push('| ' + [commit, cell, status, shares, perProbe || '-', judges || '-', 'live leg ' + (run.manifest.kind === 'voice-fixture-generation' ? 'ran' : 'did not run (' + run.manifest.kind + ')'), doctrine, 'template VERSION ' + version, 'plan ' + spec.plan].join(' | ') + ' |');
  });
  if (!opRun) {
    rows.push('| ' + [commit, 'operation', 'NOT RUN: no operation run named', shares, 'OP1 to OP5 per operation probe: NOT RUN', '-', 'live leg did not run', doctrine, 'template VERSION ' + version, 'plan ' + spec.plan].join(' | ') + ' |');
  } else {
    operationRows(spec, opRun, probes, rubric).forEach(function (r) {
      rows.push('| ' + [commit, r.cell, r.status, shares, r.perProbe, r.judges, 'live leg ' + (r.ran ? 'ran' : 'did not run'), doctrine, 'template VERSION ' + version, 'plan ' + spec.plan].join(' | ') + ' |');
    });
  }
  void probes;
  return rows;
}

// ---------------------------------------------------------------------------------------------
// the command line
// ---------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.indexOf('--') === 0) {
      const k = a.slice(2);
      if (k === 'json') out.json = true;
      else { out[k] = argv[i + 1]; i += 1; }
    } else out._.push(a);
  }
  return out;
}

function listArg(v) { return v ? String(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean) : null; }

async function cli(argv) {
  const cmd = argv[0];
  const a = parseArgs(argv.slice(1));
  try {
    if (cmd === 'import') {
      if (!a.label || !a.from) throw fail('usage', 'import --label <l> --from <md>');
      const r = importRun({ label: a.label, from: a.from });
      process.stdout.write('imported ' + r.replies + ' replies into ' + path.relative(REPO_ROOT, r.dir) + '\n');
      return 0;
    }
    if (cmd === 'generate') {
      if (!a.label) throw fail('usage', 'generate --label <l> [--probes ids] [--cells list] [--samples n] [--model m]');
      const r = await generateRun({ label: a.label, probes: listArg(a.probes), cells: listArg(a.cells), samples: a.samples, model: a.model });
      if (r.exit === 77 || (r.exit === 1 && r.reason)) { process.stdout.write('NOT RUN: ' + r.reason + '\n'); return r.exit; }
      process.stdout.write('generate ' + r.label + ': ' + (r.exit === 0 ? 'complete' : 'PARTIAL') + ', ' + r.replies + ' replies' + (Object.keys(r.skipped).length ? ', skipped ' + JSON.stringify(r.skipped) : '') + '\n');
      return r.exit;
    }
    if (cmd === 'operate') {
      if (!a.label) throw fail('usage', 'operate --label <l> [--probes ids] [--cells 2s-live,3s-live] [--model m]');
      const r = await operateRun({ label: a.label, probes: listArg(a.probes), cells: listArg(a.cells), model: a.model });
      if (r.exit === 77 || (r.exit === 1 && r.reason && !r.statuses)) {
        process.stdout.write('NOT RUN: ' + r.reason + (r.proof ? ' (reconcile proof: ' + r.proof + ')' : '') + '\n');
        return r.exit;
      }
      if (r.exit === 1) { process.stderr.write('SAFETY STOP: ' + r.reason + '. The replies are kept with status breach under ' + path.relative(REPO_ROOT, r.dir) + '\n'); return 1; }
      process.stdout.write('operate ' + r.label + ': ' + (r.exit === 0 ? 'complete' : 'PARTIAL') + ', ' + r.replies + ' replies ' + JSON.stringify(r.statuses) + '\n');
      return r.exit;
    }
    if (cmd === 'score') {
      if (!a.label) throw fail('usage', 'score --label <l> --judge jev|claude|none|auto');
      const run = loadRun(a.label);
      const scores = await scoreRun(run, { judge: a.judge || 'none', model: a.model });
      fs.writeFileSync(path.join(run.dir, 'scores.json'), JSON.stringify(scores, null, 2) + '\n');
      process.stdout.write('scored ' + scores.entries.length + ' replies for ' + a.label + '; judge requested ' + scores.judge_requested + '; judge per item ' + JSON.stringify(scores.judge_per_item) + '\n');
      if (scores.jev_refusals.length) process.stdout.write('jev refusals: ' + JSON.stringify(scores.jev_refusals.map(function (r) { return r.reason + (r.probe && r.probe !== '*' ? ' ' + r.probe + '/' + r.cell : ''); })) + '\n');
      return 0;
    }
    if (cmd === 'compare') {
      if (!a.before || !a.after) throw fail('usage', 'compare --before <l1> --after <l2> [--json]');
      const res = compareRuns(loadRun(a.before), loadRun(a.after), {});
      process.stdout.write(a.json ? JSON.stringify(res, null, 2) + '\n' : formatCompareText(res) + '\n');
      return res.exit;
    }
    if (cmd === 'ledger-row') {
      if (!a.label || !a.plan) throw fail('usage', 'ledger-row --label <l> [--operation-label <l2>] --plan <id>');
      const run = loadRun(a.label);
      const opRun = a['operation-label'] ? loadRun(a['operation-label']) : null;
      process.stdout.write(ledgerRows({ run: run, operationRun: opRun, plan: a.plan }).join('\n') + '\n');
      return 0;
    }
    process.stderr.write('usage: eval-larry-voice.cjs import|generate|operate|score|compare|ledger-row ...\n');
    return 2;
  } catch (e) {
    if (e && e.reason) {
      process.stderr.write('refused: ' + e.reason + (e.detail ? ' (' + e.detail + ')' : '') + '\n');
      return typeof e.exit === 'number' ? e.exit : 2;
    }
    process.stderr.write('internal_error: ' + String((e && e.message) || e).slice(0, 300) + '\n');
    return 1;
  }
}

module.exports = {
  RUNS_DIR,
  JUDGE_MAX_REPLY_CHARS,
  JUDGE_MAX_PROMPT_CHARS,
  JUDGE_MAX_CONTEXT_CHARS,
  IMPORT_PROBE_META,
  ALL_ITEMS,
  JUDGE_IDS,
  buildCellPrompt,
  buildUserPrompt,
  buildGenerateArgs,
  buildJudgeArgs,
  buildJudgePayload,
  verifyJudgeProvenance,
  writeRunManifest,
  verifyRunManifest,
  sealRun,
  verifySeal,
  loadSealKey,
  ensureSealKey,
  sealKeyPath,
  requiredMatrix,
  applicableItems,
  scoreReply,
  scoreCode,
  scoreRun,
  compareRuns,
  aggregateSamples,
  ledgerRows,
  importRun,
  generateRun,
  operateRun,
  repoFingerprint,
  repoChanges,
  buildOperateArgs,
  writeScratchSettings,
  buildOperateCellPrompt,
  OPERATE_CELLS,
  loadRun,
  parseProbeReplies,
  parseStreamJson,
  resolveLabelDir,
  readJevAnswers,
  judgeItems,
  formatCompareText,
  agentBodyOf,
  sha256,
  canonical,
  lookupProbe,
  cli,
};

if (require.main === module) {
  cli(process.argv.slice(2)).then(function (code) { process.exitCode = code; });
}
