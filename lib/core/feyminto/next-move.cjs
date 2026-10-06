'use strict';
/*
 * lib/core/feyminto/next-move.cjs -- the ONE composition of a nest's next move, and the one place its inputs are read.
 *
 * Plan 369.25-18 (FBRIEF-01, FBRIEF-05; FeyMinto design v2 adoption note 4, ICM audit change 9).
 *
 * "The one next move" is a presentation of a composition, never a copy of the Theo face's top rank. composeNextMove
 * scores every candidate command by the number of independent sources that name it:
 *   theo             the Theo face's suggested commands (only when Theo was asked)
 *   ledger           lib/core/section-ruling-candidates.cjs buildLedgerCandidates (the filtered, autonomy-checked row)
 *   contract         the section contract's "Commands that write here" names (command-sources.cjs)
 *   navigator_table  the navigator relevance table (command-sources.cjs)
 *   job              the registry says the command serves this nest's job (data/command-registry.json serves_jtbd)
 *   minto            the nest has open counterevidence (a command serving surface-contradiction) or open assumptions
 *                    (a command serving validate-idea); these two add a source to a command another source already
 *                    names, they never put a new command in the pool
 * Order: score, then the ledger's own order, then the contract's order, then Theo's rank, which is only the last
 * tie-breaker. The primary is the first candidate that is runnable HERE (capability.cjs, per surface); an
 * instruction-only command can only be an alternative, labeled so. Up to two alternatives are kept. outcomes_differ is
 * true when an alternative rests on a different set of sources than the primary.
 *
 * What an "attempted" record is: a research run in .mindrian/research-runs/<id>/ whose plan.json return_target names
 * this nest. A run is terminal only when run.json carries the run schema, a finished_at and a stop_reason the planner
 * knows (lib/core/research-planner/plan.cjs STOP_REASONS); anything else, including a run with a state file and no
 * run.json, is unresolved. A run does not name a command, so it never drops one; an attempted record that DOES name a
 * command and is terminal and verified drops it (it already ran to a verified result).
 *
 * nextMoveForSection is the single gatherer: decide(), suggest_next and the BRIEF writer all call it, so there is one
 * decision path. gatherNest is the shared local reader of the nest's own files for brief.cjs.
 *
 * Pure local reads of the nest's own files and the plugin's data. No network, no Brain call, no write.
 */
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..', '..');
const NO_PRIMARY_LINE = 'Nothing runnable here for this nest; see the alternatives or assisted work.';
const MAX_ALTERNATIVES = 2;
const MAX_TIER_ITEMS = 3; // Canon Part 3 MAX_K: one primary plus at most two alternatives
const RUN_DIR = path.join('.mindrian', 'research-runs');

const SOURCE_LABELS = Object.freeze({
  theo: 'Theo',
  ledger: 'the ledger',
  contract: 'the section contract',
  navigator_table: 'the navigator table',
  job: 'the nest job',
  minto: 'open counterevidence or assumptions in MINTO',
});
// The jobs a nest's open records point at. Both are job ids the command registry already uses.
const NEED_JOB_COUNTER = 'surface-contradiction';
const NEED_JOB_ASSUMPTION = 'validate-idea';

function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function arr(v) { return Array.isArray(v) ? v : []; }
function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_e) { return null; } }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_e) { return null; } }
function stripCmd(n) { return String(n).replace(/^\/mos:/, ''); }

let registryCache = null;
function commandRegistry() {
  if (!registryCache) {
    const doc = readJson(path.join(PLUGIN_ROOT, 'data', 'command-registry.json'));
    registryCache = new Map();
    arr(doc && doc.commands).forEach((c) => { if (c && typeof c.command === 'string') registryCache.set(stripCmd(c.command), c); });
  }
  return registryCache;
}

// ---- composition ----------------------------------------------------------------------------------------------------

function capabilityOf(capabilityFor, name) {
  try {
    const c = capabilityFor(name, { kind: 'command' });
    if (!c || c.known === false) return null;
    return { cli: c.cli, mcp: c.mcp, label: c.label || 'capability not labeled' };
  } catch (_e) {
    return null;
  }
}

function sourceLabels(keys) { return keys.map((k) => SOURCE_LABELS[k]); }

function joinAnd(parts) {
  if (parts.length <= 1) return parts.join('');
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}

/**
 * composeNextMove({ section, jobId, face, sources, ledgerCandidates, surface, attempted, need, capabilityFor })
 *   face              { asked, commands: [{ name, cli, mcp }], not_asked_reason? } (readFace result or the same shape)
 *   sources           command-sources.cjs sourcesForSection(section) result, or null
 *   ledgerCandidates  buildLedgerCandidates result ([{ source: 'section_ledger', items: [{ id }] }]) or null
 *   surface           'cli' or 'mcp'
 *   attempted         [{ command, status: 'terminal' | 'unresolved', verified, run_id? }]
 *   need              { counterevidence, assumptions } counts of open items in the nest's MINTO
 *   capabilityFor     capability.cjs capabilityFor, or a function with the same contract
 * @returns {{ primary, alternatives, outcomes_differ, why, provenance }}
 */
function composeNextMove(input) {
  const inp = isObj(input) ? input : {};
  const surface = inp.surface === 'cli' ? 'cli' : 'mcp';
  const face = isObj(inp.face) ? inp.face : { asked: false, commands: [] };
  const asked = face.asked === true;
  const sources = isObj(inp.sources) ? inp.sources : null;
  const attempted = arr(inp.attempted).filter(isObj);
  const need = isObj(inp.need) ? inp.need : {};
  const capabilityFor = typeof inp.capabilityFor === 'function' ? inp.capabilityFor : require('./capability.cjs').capabilityFor;
  const jobId = typeof inp.jobId === 'string' && inp.jobId ? inp.jobId : null;

  const theoNames = asked ? arr(face.commands).map((c) => stripCmd(c && c.name)).filter(Boolean) : [];
  const ledgerItems = [];
  arr(inp.ledgerCandidates).forEach((entry) => { arr(entry && entry.items).forEach((i) => { if (i && typeof i.id === 'string') ledgerItems.push(stripCmd(i.id)); }); });
  const contractNames = sources && isObj(sources.contract) ? arr(sources.contract.names).map(stripCmd) : [];
  const tableNames = sources && isObj(sources.navigator_table) ? arr(sources.navigator_table.names).map(stripCmd) : [];

  // The pool: every command some source names. The job and the open MINTO records only add to a member.
  const pool = new Map();
  function add(name, key, idx) {
    if (!name) return;
    if (!pool.has(name)) pool.set(name, { name, keys: new Set(), ledgerIdx: Infinity, contractIdx: Infinity, theoIdx: Infinity });
    const c = pool.get(name);
    c.keys.add(key);
    if (key === 'ledger' && idx < c.ledgerIdx) c.ledgerIdx = idx;
    if (key === 'contract' && idx < c.contractIdx) c.contractIdx = idx;
    if (key === 'theo' && idx < c.theoIdx) c.theoIdx = idx;
  }
  theoNames.forEach((n, i) => add(n, 'theo', i));
  ledgerItems.forEach((n, i) => add(n, 'ledger', i));
  contractNames.forEach((n, i) => add(n, 'contract', i));
  tableNames.forEach((n, i) => add(n, 'navigator_table', i));

  const reg = commandRegistry();
  const serves = (name, job) => { const e = reg.get(name); return !!(e && arr(e.serves_jtbd).indexOf(job) !== -1); };
  pool.forEach((c) => {
    if (jobId && serves(c.name, jobId)) c.keys.add('job');
    if ((Number(need.counterevidence) > 0 && serves(c.name, NEED_JOB_COUNTER)) || (Number(need.assumptions) > 0 && serves(c.name, NEED_JOB_ASSUMPTION))) c.keys.add('minto');
  });

  // Drop a command whose latest attempted record in this nest ran to a terminal, verified result.
  const done = new Set(attempted.filter((a) => a.status === 'terminal' && a.verified === true && typeof a.command === 'string').map((a) => stripCmd(a.command)));
  const unresolvedAttempts = attempted.filter((a) => a.status === 'unresolved').length;

  const candidates = [];
  pool.forEach((c) => {
    if (done.has(c.name)) return;
    const cap = capabilityOf(capabilityFor, c.name);
    if (!cap) return; // not a command on this install: never offer a ghost
    candidates.push(Object.assign({}, c, { cap, score: c.keys.size, runnable: cap[surface] === 'runnable' }));
  });
  candidates.sort((a, b) => (b.score - a.score) || (a.ledgerIdx - b.ledgerIdx) || (a.contractIdx - b.contractIdx) || (a.theoIdx - b.theoIdx) || (a.name < b.name ? -1 : 1));

  const KEY_ORDER = ['contract', 'ledger', 'theo', 'navigator_table', 'job', 'minto'];
  const NAMING_KEYS = ['contract', 'ledger', 'theo', 'navigator_table'];
  const orderedKeys = (c) => KEY_ORDER.filter((k) => c.keys.has(k));
  const theoTop = theoNames.length > 0 ? theoNames[0] : null;

  function shape(c, primary) {
    const keys = orderedKeys(c);
    const labels = sourceLabels(keys);
    const namers = keys.filter((k) => NAMING_KEYS.indexOf(k) !== -1);
    const parts = [];
    if (namers.length > 0) parts.push('named by ' + joinAnd(sourceLabels(namers)));
    if (c.keys.has('job')) parts.push('serves the nest job');
    if (c.keys.has('minto')) parts.push('addresses open counterevidence or assumptions in MINTO');
    let why = parts.join('; ');
    if (primary && theoTop && theoTop !== c.name && c.keys.size >= 2) why += '; Theo ranked ' + theoTop + ' first, but agreement across sources outranks one source\'s order';
    if (!c.runnable) why += '; instruction-only on this surface';
    return {
      command: c.name,
      why,
      sources: labels,
      capability: { cli: c.cap.cli, mcp: c.cap.mcp, label: c.cap.label },
      instruction_only: !c.runnable,
    };
  }

  const primaryCandidate = candidates.find((c) => c.runnable) || null;
  const primary = primaryCandidate ? shape(primaryCandidate, true) : null;
  const rest = candidates.filter((c) => c !== primaryCandidate).slice(0, MAX_ALTERNATIVES);
  const alternatives = rest.map((c) => shape(c, false));
  const sig = (c) => orderedKeys(c).join('|');
  const outcomesDiffer = !!primaryCandidate && rest.some((c) => sig(c) !== sig(primaryCandidate));

  return {
    primary,
    alternatives,
    outcomes_differ: outcomesDiffer,
    why: primary ? primary.why : NO_PRIMARY_LINE,
    provenance: {
      face_asked: asked,
      theo_top: theoTop,
      ledger_stamp: sources && isObj(sources.ledger) && isObj(sources.ledger.provenance) ? (sources.ledger.provenance.stamp || null) : null,
      unresolved_attempts: unresolvedAttempts,
      surface,
    },
  };
}

/**
 * toTierCandidates(nextMove) -> [{ source: 'feyminto_face', items: [{ id, confidence, source }] }] | null
 * The shape lib/core/section-ruling-candidates.cjs buildLedgerCandidates returns, so decide() feeds it to the same
 * ctx.tierCandidates seam. Primary first, then the runnable alternatives, at most three (Canon Part 3 MAX_K). Null
 * when there is no primary, so the ledger stays the fallback exactly as before.
 */
function toTierCandidates(nextMove) {
  const nm = isObj(nextMove) ? nextMove : {};
  if (!isObj(nm.primary) || typeof nm.primary.command !== 'string') return null;
  const items = [nm.primary].concat(arr(nm.alternatives).filter((a) => isObj(a) && a.instruction_only !== true))
    .slice(0, MAX_TIER_ITEMS)
    .map((m) => ({ id: m.command, confidence: null, source: 'feyminto_face' }));
  return [{ source: 'feyminto_face', items }];
}

// ---- the nest's own files -------------------------------------------------------------------------------------------

function unquote(v) {
  const t = String(v).trim();
  if (t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"') return t.slice(1, -1).replace(/\\"/g, '"');
  return t;
}

// `key: value` lines between the first two --- lines; a flat reader (a face's frontmatter is flat scalars).
function flatFrontmatter(text) {
  const out = {};
  if (typeof text !== 'string') return out;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return out;
  m[1].split(/\r?\n/).forEach((ln) => {
    const k = ln.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (k) out[k[1]] = unquote(k[2]);
  });
  return out;
}

function bodyAfterFrontmatter(text) {
  const m = typeof text === 'string' ? text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/) : null;
  return m ? m[1] : (typeof text === 'string' ? text : '');
}

// The text of one `## heading` block (heading excluded), or null.
function h2Block(body, heading) {
  const lines = String(body).split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === heading);
  if (at === -1) return null;
  const out = [];
  for (let k = at + 1; k < lines.length; k++) {
    if (/^## /.test(lines[k])) break;
    out.push(lines[k]);
  }
  return out.join('\n');
}

function bullets(blockText) {
  return String(blockText || '').split(/\r?\n/).filter((l) => /^- /.test(l)).map((l) => l.slice(2).trim()).filter((l) => l.length > 0);
}

function decodeList(v) {
  try { return require('../brain-md-schema.cjs').decodeFaceList(v); } catch (_e) { return []; }
}

/**
 * readFace(sectionPath) -> the nest's Theo face (BRAIN.md) as the brief and the composition read it.
 *   { exists: false }                                    no BRAIN.md
 *   { exists: true, keyed: false }                       a BRAIN.md with no FeyMinto face keys (legacy): not recorded
 *   { exists: true, keyed: true, asked, not_asked_reason, ... commands, frameworks, limitations }
 * List scalars are percent-encoded on disk; decodeFaceList (the frontmatter owner's reader) decodes them.
 */
function readFace(sectionPath) {
  const text = readText(path.join(sectionPath, 'BRAIN.md'));
  if (text === null) return { exists: false };
  const f = flatFrontmatter(text);
  const keyed = f.face === 'feyminto-theo';
  if (!keyed) return { exists: true, keyed: false, staleness: f.staleness || null };
  const nullish = (v) => (v === undefined || v === 'null' || v === '' ? null : v);
  const num = (v) => { const n = Number(v); return nullish(v) !== null && Number.isFinite(n) ? n : null; };
  const commands = decodeList(f.suggested_commands).map((e) => {
    const parts = String(e).split(':');
    const mcp = parts.length >= 3 ? parts.pop() : null;
    const cli = parts.length >= 2 ? parts.pop() : null;
    return { name: parts.join(':'), cli, mcp };
  }).filter((c) => c.name.length > 0);
  const lim = h2Block(bodyAfterFrontmatter(text), '## Limitations');
  return {
    exists: true,
    keyed: true,
    asked: f.asked === 'true',
    not_asked_reason: nullish(f.not_asked_reason),
    asked_at: nullish(f.asked_at),
    theo_origin: nullish(f.theo_origin),
    queries_sent: num(f.queries_sent),
    rows: { find_frameworks: num(f.rows_find_frameworks), commands: num(f.rows_commands), route: num(f.rows_route), neighborhood: num(f.rows_neighborhood) },
    handles_on_wire: nullish(f.handles_on_wire),
    handles_problem_type: nullish(f.handles_problem_type),
    refusals: nullish(f.refusals),
    staleness: nullish(f.staleness),
    commands,
    frameworks: decodeList(f.suggested_frameworks),
    limitations: lim === null ? [] : lim.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0),
  };
}

const NOTHING_RE = /^Nothing (yet|recorded)/;
const OVERFLOW_RE = /^and \d+ more in /;

/**
 * readMinto(sectionPath) -> { exists, governing_thought, placeholder, last_generated_at, decision_log, claims,
 *   counter, assumptions, would_change }. claims: [{ title, source, summary }]; assumptions: [{ text, state }].
 */
function readMinto(sectionPath) {
  const text = readText(path.join(sectionPath, 'MINTO.md'));
  if (text === null) return { exists: false, governing_thought: null, placeholder: false, last_generated_at: null, decision_log: [], claims: [], counter: [], assumptions: [], would_change: [] };
  let parsed = null;
  try { parsed = require('../folder-memory-shared.cjs').parseMintoMd(text); } catch (_e) { parsed = null; }
  const f = flatFrontmatter(text);
  const body = bodyAfterFrontmatter(text);
  const gt = parsed && parsed._parsed_ok ? parsed.governing_thought : (f.governing_thought || null);
  const placeholder = parsed && parsed._parsed_ok ? parsed.governing_thought_placeholder === true : f.governing_thought_placeholder === 'true';

  const claims = [];
  const kc = h2Block(body, '## Key Claims') || '';
  const kcLines = kc.split(/\r?\n/);
  for (let k = 0; k < kcLines.length; k++) {
    const m = kcLines[k].match(/^### Claim \d+: (.+)$/);
    if (!m) continue;
    const claim = { title: m[1].trim(), source: null, summary: '' };
    for (let j = k + 1; j < kcLines.length && !/^### /.test(kcLines[j]); j++) {
      const s = kcLines[j].match(/^>\s*Source:\s*\[\[([^\]|#]+)/);
      if (s) claim.source = s[1].trim();
      const d = kcLines[j].match(/^>\s*--\s*(.+)$/);
      if (d) claim.summary = d[1].trim();
    }
    claims.push(claim);
  }

  const counter = bullets(h2Block(body, '## Counterevidence')).filter((l) => !/^None recorded/.test(l) && !OVERFLOW_RE.test(l));
  const assumptions = bullets(h2Block(body, '## Assumptions')).filter((l) => !/^None recorded/.test(l) && !OVERFLOW_RE.test(l)).map((l) => {
    const v = l.match(/^(.*) \(validity: ([^)]*)\)$/);
    if (v) return { text: v[1].trim(), state: v[2].trim() || 'unknown' };
    const n = l.match(/^(.*) \(model narrative\)$/);
    if (n) return { text: n[1].trim(), state: 'model narrative' };
    return { text: l, state: 'unknown' };
  });
  const wouldChange = bullets(h2Block(body, '## What would change the conclusion')).filter((l) => !OVERFLOW_RE.test(l));
  return {
    exists: true,
    governing_thought: gt && String(gt).trim().length > 0 ? String(gt).trim() : null,
    placeholder,
    last_generated_at: parsed && parsed.last_generated_at ? parsed.last_generated_at : (f.last_generated_at || null),
    decision_log: parsed && Array.isArray(parsed.decision_log) ? parsed.decision_log : [],
    claims,
    counter,
    assumptions,
    would_change: wouldChange,
  };
}

/** readFeynman(sectionPath) -> { exists, what_changed: [lines], cannot_explain: [lines] } (the two generated blocks). */
function readFeynman(sectionPath) {
  const text = readText(path.join(sectionPath, 'FEYNMAN.md'));
  if (text === null) return { exists: false, what_changed: [], cannot_explain: [] };
  let S;
  try { S = require('./feynman-blocks.cjs').SENTINELS; } catch (_e) { S = null; }
  const between = (pair) => {
    if (!pair) return [];
    const a = text.indexOf(pair[0]);
    const b = text.indexOf(pair[1]);
    if (a === -1 || b === -1 || b <= a) return [];
    return bullets(text.slice(a + pair[0].length, b));
  };
  return { exists: true, what_changed: between(S && S.whatChanged), cannot_explain: between(S && S.cannotExplain) };
}

/** The nest's job: the id from CONTEXT.md (the generated section ruling), else the canon; the statement from ROOM.md. */
function readJob(sectionPath, section) {
  const ctx = flatFrontmatter(readText(path.join(sectionPath, 'CONTEXT.md')) || '');
  let id = typeof ctx.job_id === 'string' && ctx.job_id ? ctx.job_id : null;
  if (!id) {
    try {
      const j = require('../section-registry.cjs').getSectionJob(section);
      if (j && typeof j.job_id === 'string' && j.job_id) id = j.job_id;
    } catch (_e) { /* an unreadable canon leaves the job undeclared */ }
  }
  const room = flatFrontmatter(readText(path.join(sectionPath, 'ROOM.md')) || '');
  return { id, statement: typeof room.statement === 'string' && room.statement ? room.statement : null };
}

/**
 * readRuns(roomDir, section) -> records for the research runs whose plan names this nest, newest first.
 *   { run_id, status: 'terminal' | 'unresolved', reason, mode, stop_reason, finished_at, mtime }
 */
function readRuns(roomDir, section) {
  const base = path.join(roomDir, RUN_DIR);
  let ids = [];
  try { ids = fs.readdirSync(base); } catch (_e) { return []; }
  let planMod = null;
  try { planMod = require('../research-planner/plan.cjs'); } catch (_e) { planMod = null; }
  const out = [];
  ids.forEach((id) => {
    const dir = path.join(base, id);
    const plan = readJson(path.join(dir, 'plan.json'));
    if (!isObj(plan) || !isObj(plan.return_target) || plan.return_target.section !== section) return;
    let mtime = 0;
    ['plan.json', 'state.json', 'run.json'].forEach((f) => { try { mtime = Math.max(mtime, fs.statSync(path.join(dir, f)).mtimeMs); } catch (_e) { /* absent */ } });
    const runText = readText(path.join(dir, 'run.json'));
    const state = readJson(path.join(dir, 'state.json'));
    if (runText === null) {
      out.push({ run_id: id, status: 'unresolved', reason: 'no run.json yet' + (isObj(state) && state.step ? ' (controller step ' + String(state.step) + ')' : ''), mode: null, stop_reason: null, finished_at: null, mtime });
      return;
    }
    let run = null;
    try { run = JSON.parse(runText); } catch (_e) { run = null; }
    const stops = planMod ? arr(planMod.STOP_REASONS) : [];
    const schema = planMod ? planMod.RUN_SCHEMA : 'mos.research-run/1';
    const terminal = isObj(run) && run.schema === schema && typeof run.finished_at === 'string' && run.finished_at.length > 0 && stops.indexOf(run.stop_reason) !== -1;
    if (!terminal) {
      out.push({ run_id: id, status: 'unresolved', reason: 'run.json shape not recognized', mode: null, stop_reason: null, finished_at: null, mtime });
      return;
    }
    out.push({ run_id: id, status: 'terminal', reason: null, mode: typeof run.mode === 'string' ? run.mode : null, stop_reason: run.stop_reason, finished_at: run.finished_at, mtime });
  });
  out.sort((a, b) => (b.mtime - a.mtime) || (a.run_id < b.run_id ? -1 : 1));
  return out;
}

/**
 * gatherNest({ roomDir, sectionDir }) -> everything the brief and the composition read from the nest's own files.
 */
function gatherNest(input) {
  const inp = isObj(input) ? input : {};
  const sectionDir = path.resolve(String(inp.sectionDir || inp.sectionPath || ''));
  const roomDir = path.resolve(String(inp.roomDir || path.dirname(sectionDir)));
  const section = path.basename(sectionDir);
  const minto = readMinto(sectionDir);
  const unansweredCounter = minto.counter.filter((l) => !/\[answered:/.test(l) && !/\(model narrative\)$/.test(l)).length;
  const openAssumptions = minto.assumptions.filter((a) => a.state !== 'model narrative').length;
  return {
    section,
    sectionDir,
    roomDir,
    job: readJob(sectionDir, section),
    face: readFace(sectionDir),
    minto,
    feynman: readFeynman(sectionDir),
    runs: readRuns(roomDir, section),
    need: { counterevidence: unansweredCounter, assumptions: openAssumptions },
  };
}

/**
 * nextMoveForSection({ roomDir, sectionDir, surface, nest? }) -> composeNextMove's result for the nest, on one surface.
 * The one place the composition's inputs are gathered. A nest that is not a core section has no contract or table, so
 * its sources are null and the ledger and the face carry the move.
 */
function nextMoveForSection(input) {
  const inp = isObj(input) ? input : {};
  const surface = inp.surface === 'cli' ? 'cli' : 'mcp';
  const nest = isObj(inp.nest) ? inp.nest : gatherNest({ roomDir: inp.roomDir, sectionDir: inp.sectionDir });
  let sources = null;
  try { sources = require('./command-sources.cjs').sourcesForSection(nest.section); } catch (_e) { sources = null; }
  let ledgerCandidates = null;
  if (nest.job.id) {
    try { ledgerCandidates = require('../section-ruling-candidates.cjs').buildLedgerCandidates({ jobId: nest.job.id }); } catch (_e) { ledgerCandidates = null; }
  }
  const face = nest.face && nest.face.keyed === true
    ? { asked: nest.face.asked === true, commands: nest.face.commands, not_asked_reason: nest.face.not_asked_reason }
    : { asked: false, commands: [] };
  const attempted = nest.runs.map((r) => ({ command: null, status: r.status, verified: false, run_id: r.run_id }));
  return composeNextMove({
    section: nest.section,
    jobId: nest.job.id,
    face,
    sources,
    ledgerCandidates,
    surface,
    attempted,
    need: nest.need,
  });
}

module.exports = {
  composeNextMove,
  toTierCandidates,
  nextMoveForSection,
  gatherNest,
  readFace,
  readMinto,
  readFeynman,
  readRuns,
  NO_PRIMARY_LINE,
  NOTHING_RE,
};
