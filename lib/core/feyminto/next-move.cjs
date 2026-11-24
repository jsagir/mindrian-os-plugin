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
 * Order when a job is known (Phase 395-04): first the candidates that serve the job, then the ledger's rating of the
 * command for that job (strong, then partial or not rated, then poor), then the score. Order when no job is known:
 * the score first, as before. In both cases the ties go to the ledger's own order, then the contract's order, then
 * Theo's rank, which is only the last
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
 * Phase 399 (I-07, I-08): with a job known, the decision advisor (lib/core/decision-advisor) is ONE more sort key, after
 * the job keys and before the source count, and one more pool source for a strong pick that serves the job. It acts only
 * on a strong pick that is strictly above the option it moves ahead of: a tie at the top of the table row (the order
 * inside a tie is alphabetical, not a preference) makes the advisor abstain, and the selector order is then exactly the
 * order without it. With no job, with the advisor not switched on (only MINDRIAN_DECISION_ADVISOR=on enables it), or when the advisor
 * abstains, the order is unchanged.
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
  advisor: 'the decision advisor',
});
// The jobs a nest's open records point at. Both are job ids the command registry already uses.
const NEED_JOB_COUNTER = 'surface-contradiction';
const NEED_JOB_ASSUMPTION = 'validate-idea';

function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function arr(v) { return Array.isArray(v) ? v : []; }
function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_e) { return null; } }

// Phase 395-07: two ceilings on what one selector call reads from a room, so its cost does not grow with the room.
//   MAX_NEST_FILE_BYTES  a nest file (BRAIN.md, MINTO.md, FEYNMAN.md, CONTEXT.md, ROOM.md) is read up to this size. A
//                        generated face is some kilobytes, so a normal nest is read whole, as before. A larger file is
//                        cut here, and its name goes to the `cut` list of gatherNest so the brief can say so.
//   MAX_RUNS_READ        the research runs of a room are read newest first by run id (rp-YYYY-MM-DD-<hex>), at most
//                        this many folders. Older runs are counted in `runs_not_read` and are not read.
const MAX_NEST_FILE_BYTES = 262144;
const MAX_RUNS_READ = 50;
function readNestFile(p, cut) {
  // Phase 395-07b (cold check 395-07, MA1): `cut` false reads the whole file (gatherNest wholeFiles, the brief blocks).
  if (cut === false) return readText(p);
  try {
    if (fs.statSync(p).size <= MAX_NEST_FILE_BYTES) return fs.readFileSync(p, 'utf8');
    const fd = fs.openSync(p, 'r');
    try {
      const buf = Buffer.alloc(MAX_NEST_FILE_BYTES);
      const n = fs.readSync(fd, buf, 0, MAX_NEST_FILE_BYTES, 0);
      if (Array.isArray(cut) && cut.indexOf(path.basename(p)) === -1) cut.push(path.basename(p));
      return buf.toString('utf8', 0, n);
    } finally {
      fs.closeSync(fd);
    }
  } catch (_e) {
    return null;
  }
}
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

// Phase 395-04: the ledger's rating of each command as a first move for one job.
// data/section-command-ledger.json row `<job>|*|*` carries a `score` from 0 (poor fit) through 1 (partial fit) to
// 2 (strong fit), and a `confidence` that says how sure the scorer is of that score. A high confidence does NOT mean
// a good fit, so the confidence is used only as the gate it already is in section-ruling-candidates.cjs: a score
// counts when its confidence is at or above the ledger's floor, or when it has no confidence and is ground truth.
// Levels: 2 strong (score at or above 1.5), 1 partial (0.5 up to 1.5), 0 poor (under 0.5). A command with no
// counted score has no entry; the caller gives it level 1 (no information is not a poor rating).
const JOB_FIT_STRONG = 1.5;
const JOB_FIT_POOR = 0.5;
const JOB_FIT_UNRATED = 1;
let ledgerDocCache = null;
function ledgerDoc() {
  if (ledgerDocCache === null) ledgerDocCache = readJson(path.join(PLUGIN_ROOT, 'data', 'section-command-ledger.json')) || {};
  return ledgerDocCache;
}
// Phase 395-07: the mark of the rules and the data that order the candidates and word the why sentence. brief.cjs
// puts it in the record basis, so a brief written under another order rule or another ledger build reads as stale and
// is rewritten 1 time. Change SELECTOR_ORDER when the sort keys or the why sentences of composeNextMove change.
// Phase 395-07b: the why sentence names a ledger row under the confidence floor (cold check 395-07, mi1).
// Phase 399-07: the advisor key and source change the order, and the mark names the advisor table build.
const SELECTOR_ORDER = '399-07';
function advisorMark() {
  try {
    const A = require('../decision-advisor/shortlist.cjs');
    if (!A.advisorEnabled()) return 'off';
    const meta = A.tableMeta();
    return meta && typeof meta.version === 'string' && meta.version ? meta.version : 'none';
  } catch (_e) {
    return 'none';
  }
}
function selectorMark() {
  const doc = ledgerDoc();
  return 'order ' + SELECTOR_ORDER + ', ledger built ' + (typeof doc.built_at === 'string' && doc.built_at ? doc.built_at : 'unknown') + ', advisor table ' + advisorMark();
}
// Phase 395-07b (cold check 395-07, mi1, mi6): ledgerRating gives the counted levels (`fit`) and the commands that
// have a score row that does not count (`unsure`: a confidence under the floor, or no confidence and not ground
// truth), so the why sentence never says "no rating" for a command that has a row. `doc` is optional: a ledger
// document in the shape of data/section-command-ledger.json (a test seam). When it is absent the plugin ledger is read.
function ledgerRating(jobId, doc) {
  const fit = new Map();
  const unsure = new Set();
  if (typeof jobId !== 'string' || !jobId) return { fit, unsure };
  const d = isObj(doc) ? doc : ledgerDoc();
  const floor = typeof d.confidence_floor === 'number' ? d.confidence_floor : null;
  arr(isObj(d.rows) ? d.rows[jobId + '|*|*'] : null).forEach((r) => {
    if (!isObj(r) || typeof r.command !== 'string' || typeof r.score !== 'number') return;
    const counted = typeof r.confidence === 'number' ? (floor === null || r.confidence >= floor) : r.source === 'ground-truth';
    if (!counted) { unsure.add(stripCmd(r.command)); return; }
    fit.set(stripCmd(r.command), r.score >= JOB_FIT_STRONG ? 2 : (r.score < JOB_FIT_POOR ? 0 : 1));
  });
  // A command with a counted row and a row that does not count is rated: the counted row decides.
  fit.forEach((_v, k) => unsure.delete(k));
  return { fit, unsure };
}
function jobFitFor(jobId, doc) {
  return ledgerRating(jobId, doc).fit;
}

// ---- composition ----------------------------------------------------------------------------------------------------

function capabilityOf(capabilityFor, name) {
  try {
    const c = capabilityFor(name, { kind: 'command' });
    if (!c || c.known === false) return null;
    // Phase 395-07: `mcp` and `label` are read on demand, so the command-line surface does not load the MCP router.
    return { cli: c.cli, get mcp() { return c.mcp; }, get label() { return c.label || 'capability not labeled'; } };
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
 *   jobFit            optional { <command name>: 0 | 1 | 2 }, the ledger rating for the job (see jobFitFor). When it
 *                     is absent the rating is read from the ledger row of jobId. Phase 395-04.
 *   definitionLevel, lastCommand   the table key with the job (Phase 399-07); either may be null.
 *   causeEffect       optional, the room's cause and effect domain (Phase 400-10); null or unknown gives the 399 result.
 *   advisorShortlist  optional, a test seam: a lookupShortlist result (lib/core/decision-advisor/shortlist.cjs).
 * @returns {{ primary, alternatives, outcomes_differ, why, provenance }}
 */
// jobOffersFor(candidates, reg) -- when no job is set: the jobs that the most candidates
// serve, at most three, `explore` left out (it names no intent). Phase 395-01.
function jobOffersFor(candidates, reg) {
  const count = new Map();
  arr(candidates).forEach((c) => {
    const e = reg.get(c.name);
    arr(e && e.serves_jtbd).forEach((j) => {
      if (typeof j !== 'string' || !j || j === 'explore') return;
      count.set(j, (count.get(j) || 0) + 1);
    });
  });
  return Array.from(count.entries())
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1))
    .slice(0, 3)
    .map(([id, served]) => ({ id: id, served_by: served }));
}

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
  const jobOrigin = jobId ? (inp.jobOrigin === 'goal' ? 'goal' : 'section') : null;

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
  // Drop a command whose latest attempted record in this nest ran to a terminal, verified result.
  const done = new Set(attempted.filter((a) => a.status === 'terminal' && a.verified === true && typeof a.command === 'string').map((a) => stripCmd(a.command)));
  const unresolvedAttempts = attempted.filter((a) => a.status === 'unresolved').length;

  theoNames.forEach((n, i) => add(n, 'theo', i));
  ledgerItems.forEach((n, i) => add(n, 'ledger', i));
  contractNames.forEach((n, i) => add(n, 'contract', i));
  tableNames.forEach((n, i) => add(n, 'navigator_table', i));

  const reg = commandRegistry();
  const serves = (name, job) => { const e = reg.get(name); return !!(e && arr(e.serves_jtbd).indexOf(job) !== -1); };

  // Phase 399-07 (I-07): the advisor is read only with a job known. It acts only when the shortlist has a strong pick
  // AND the top of the table row is not a tie (the order inside a tie is alphabetical, not a preference). Its value
  // for a command is the calibrated number of a strong option in the shortlist, else 0; the sort moves a command
  // ahead of another only when that value is strictly greater, so equal values keep the order the other keys give.
  // The number stays inside this function: the result carries the band-word shape from present.cjs only.
  const advisorValue = new Map();
  let advisorPublic = null;
  if (jobId) {
    try {
      const A = require('../decision-advisor/shortlist.cjs');
      const PR = require('../decision-advisor/present.cjs');
      let shortlist = null;
      // Opt-in wins over the test seam: unless MINDRIAN_DECISION_ADVISOR=on, nothing here runs, even with a seam shortlist.
      if (!A.advisorEnabled()) shortlist = null;
      else if (isObj(inp.advisorShortlist)) shortlist = inp.advisorShortlist;
      else {
        const skip = [];
        done.forEach((n) => { skip.push(n); skip.push('/mos:' + n); });
        const last = typeof inp.lastCommand === 'string' && inp.lastCommand ? stripCmd(inp.lastCommand) : null;
        // Phase 400-10 (CY-05): the room's cause and effect domain goes to the one lookup. An unknown or absent
        // domain gives exactly the 399 shortlist (plan 09).
        shortlist = A.lookupShortlist({ jobId, definitionLevel: inp.definitionLevel || null, causeEffect: inp.causeEffect || null, lastCommand: last ? '/mos:' + last : null, exclude: skip });
      }
      if (shortlist) {
        advisorPublic = PR.publicShortlist(shortlist, { jobId });
        if (shortlist.state === 'ok' && !PR.isTopTie(shortlist)) {
          // Phase 400-10: when the domain reordered the strong band, a fit command goes first. Review WR-04: the
          // value is a fit bonus of 1 plus the calibrated value (calibrated is at most 1), not a position, so
          // equal calibrated values stay equal inside the fit part and inside the non-fit part, and the other
          // sort keys still decide a tie. Otherwise the 399 calibrated values.
          const strong = arr(shortlist.options).filter((o) => isObj(o) && o.band === 'strong' && typeof o.calibrated === 'number' && typeof o.command === 'string');
          const reordered = isObj(shortlist.domain) && shortlist.domain.effect === 'reordered';
          const fits = new Set(reordered ? arr(shortlist.domain.fits) : []);
          strong.forEach((o) => {
            const name = stripCmd(o.command);
            if (!done.has(name)) advisorValue.set(name, (fits.has(o.command) ? 1 : 0) + o.calibrated);
          });
        }
      }
    } catch (_e) { advisorValue.clear(); advisorPublic = null; }
  }
  const advisorOn = advisorValue.size > 0;
  // A strong pick that serves the job enters the pool even when no other source names it (D-01).
  if (advisorOn) advisorValue.forEach((_v, name) => { if (serves(name, jobId)) add(name, 'advisor', 0); });

  pool.forEach((c) => {
    if (jobId && serves(c.name, jobId)) c.keys.add('job');
    if ((Number(need.counterevidence) > 0 && serves(c.name, NEED_JOB_COUNTER)) || (Number(need.assumptions) > 0 && serves(c.name, NEED_JOB_ASSUMPTION))) c.keys.add('minto');
  });

  const jobFirst = jobId !== null;
  const fit = new Map();
  const unsure = new Set();
  if (jobFirst && isObj(inp.jobFit)) {
    Object.keys(inp.jobFit).forEach((k) => { const v = inp.jobFit[k]; if (v === 0 || v === 1 || v === 2) fit.set(stripCmd(k), v); });
  } else if (jobFirst) {
    // Phase 395-07b: `ledgerDoc` is an optional test seam (a ledger document). When it is absent the plugin ledger is read.
    const rating = ledgerRating(jobId, isObj(inp.ledgerDoc) ? inp.ledgerDoc : undefined);
    rating.fit.forEach((v, k) => fit.set(k, v));
    rating.unsure.forEach((k) => unsure.add(k));
  }

  const candidates = [];
  pool.forEach((c) => {
    if (done.has(c.name)) return;
    const cap = capabilityOf(capabilityFor, c.name);
    if (!cap) return; // not a command on this install: never offer a ghost
    const fitLevel = fit.has(c.name) ? fit.get(c.name) : JOB_FIT_UNRATED;
    candidates.push(Object.assign({}, c, { cap, score: c.keys.size, runnable: cap[surface] === 'runnable', servesJob: c.keys.has('job') ? 1 : 0, jobFit: fitLevel, jobRated: fit.has(c.name), jobUnsure: unsure.has(c.name), advisorValue: advisorOn && advisorValue.has(c.name) ? advisorValue.get(c.name) : 0 }));
  });
  // Phase 395-04: with a job known, the job orders the candidates first (serves the job, then the ledger rating for
  // the job). With no job known both new keys are skipped, so the order is exactly the order before this change.
  // Phase 399-07: then the advisor value (0 for every candidate unless the advisor acts, so a no-op otherwise).
  candidates.sort((a, b) => (jobFirst ? ((b.servesJob - a.servesJob) || (b.jobFit - a.jobFit) || (b.advisorValue - a.advisorValue)) : 0) || (b.score - a.score) || (a.ledgerIdx - b.ledgerIdx) || (a.contractIdx - b.contractIdx) || (a.theoIdx - b.theoIdx) || (a.name < b.name ? -1 : 1));

  const KEY_ORDER = ['contract', 'ledger', 'theo', 'navigator_table', 'job', 'minto', 'advisor'];
  const NAMING_KEYS = ['contract', 'ledger', 'theo', 'navigator_table', 'advisor'];
  const orderedKeys = (c) => KEY_ORDER.filter((k) => c.keys.has(k));
  const theoTop = theoNames.length > 0 ? theoNames[0] : null;

  function shape(c, primary) {
    const keys = orderedKeys(c);
    // Phase 395-02: when the goal job ranked the move, the label names that job and its origin.
    const labels = keys.map((k) => (k === 'job' && jobOrigin === 'goal' ? 'your goal job (' + jobId + ')' : SOURCE_LABELS[k]));
    const namers = keys.filter((k) => NAMING_KEYS.indexOf(k) !== -1);
    const parts = [];
    if (namers.length > 0) parts.push('named by ' + joinAnd(sourceLabels(namers)));
    if (c.keys.has('job')) parts.push(jobOrigin === 'goal' ? 'serves your goal job' : 'serves the nest job');
    if (c.keys.has('minto')) parts.push('addresses open counterevidence or assumptions in MINTO');
    let why = parts.join('; ');
    // Phase 395-04, 395-07: when Theo's first command is not the primary, the sentence names the fact that decided.
    // Each branch is the first true one in the order the code itself uses: dropped, not runnable here, then the sort keys.
    if (primary && theoTop && theoTop !== c.name) {
      const t = candidates.find((x) => x.name === theoTop) || null;
      const head = '; Theo ranked ' + theoTop + ' first, but ';
      if (!t) why += head + (done.has(theoTop) ? theoTop + ' already ran to a verified result in this nest' : theoTop + ' is not a command on this install');
      else if (candidates.indexOf(t) < candidates.indexOf(c)) why += head + theoTop + ' is instruction-only on this surface';
      else if (jobFirst && c.servesJob !== t.servesJob) why += head + 'a command that serves the job is ordered first';
      else if (jobFirst && c.jobFit !== t.jobFit) {
        if (c.jobRated && t.jobRated) why += head + 'the ledger rates this command higher for the job';
        // Phase 395-07b (cold check 395-07, mi1): a command with a score row under the confidence floor has a rating
        // that does not count; it is not a command with no rating.
        else if (c.jobRated) why += head + 'the ledger rates this command higher for the job (a strong first move; ' + (t.jobUnsure ? 'the ledger rating for ' + theoTop + ' is not sure enough to count' : 'the ledger has no rating for ' + theoTop) + ')';
        else why += head + 'the ledger rates ' + theoTop + ' as a poor first move for the job, and ' + (c.jobUnsure ? 'its rating for this command is not sure enough to count' : 'has no rating for this command');
      } else if (advisorOn && c.advisorValue > t.advisorValue) why += head + 'the decision advisor has a strong pick for the job';
      else if (c.score !== t.score) why += head + 'agreement across sources outranks one source\'s order';
      else if (c.ledgerIdx !== t.ledgerIdx) why += head + 'the two are level, and the tie goes to ' + (t.ledgerIdx === Infinity ? 'the command that the ledger names' : 'the ledger\'s own order');
      else why += head + 'the two are level, and the tie goes to ' + (t.contractIdx === Infinity ? 'the command that the section contract names' : 'the section contract\'s order');
    }
    if (!c.runnable) why += '; instruction-only on this surface';
    return {
      command: c.name,
      why,
      sources: labels,
      capability: { cli: c.cap.cli, get mcp() { return c.cap.mcp; }, get label() { return c.cap.label; } },
      instruction_only: !c.runnable,
    };
  }

  const primaryCandidate = candidates.find((c) => c.runnable) || null;
  const primary = primaryCandidate ? shape(primaryCandidate, true) : null;
  const rest = candidates.filter((c) => c !== primaryCandidate).slice(0, MAX_ALTERNATIVES);
  const alternatives = rest.map((c) => shape(c, false));
  const sig = (c) => orderedKeys(c).join('|');
  const outcomesDiffer = !!primaryCandidate && rest.some((c) => sig(c) !== sig(primaryCandidate));

  const result = {
    primary,
    alternatives,
    outcomes_differ: outcomesDiffer,
    why: primary ? primary.why : NO_PRIMARY_LINE,
    state: jobId ? 'ok' : 'job_unknown',
    job: jobId ? { id: jobId, origin: jobOrigin } : null,
    job_offers: jobId ? [] : jobOffersFor(candidates, reg),
    provenance: {
      face_asked: asked,
      theo_top: theoTop,
      ledger_stamp: sources && isObj(sources.ledger) && isObj(sources.ledger.provenance) ? (sources.ledger.provenance.stamp || null) : null,
      unresolved_attempts: unresolvedAttempts,
      surface,
    },
  };
  // Phase 399-07 (I-08): the shortlist for the host model, band words only. Absent (not null) with no job or advisor off.
  if (advisorPublic) result.advisor = advisorPublic;
  return result;
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
function readFace(sectionPath, cut) {
  const text = readNestFile(path.join(sectionPath, 'BRAIN.md'), cut);
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
function readMinto(sectionPath, cut) {
  const text = readNestFile(path.join(sectionPath, 'MINTO.md'), cut);
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
function readFeynman(sectionPath, cut) {
  const text = readNestFile(path.join(sectionPath, 'FEYNMAN.md'), cut);
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

/** The nest's job: the id from CONTEXT.md (the generated section ruling), else the canon, else the room's ratified declaration in .mindrian/section-jobs.json; the statement from ROOM.md. */
function readJob(sectionPath, section, roomDir, cut) {
  const ctx = flatFrontmatter(readNestFile(path.join(sectionPath, 'CONTEXT.md'), cut) || '');
  let id = typeof ctx.job_id === 'string' && ctx.job_id ? ctx.job_id : null;
  if (!id) {
    try {
      const j = require('../section-registry.cjs').getSectionJob(section, roomDir);
      if (j && typeof j.job_id === 'string' && j.job_id) id = j.job_id;
    } catch (_e) { /* an unreadable canon leaves the job undeclared */ }
  }
  const room = flatFrontmatter(readNestFile(path.join(sectionPath, 'ROOM.md'), cut) || '');
  return { id, statement: typeof room.statement === 'string' && room.statement ? room.statement : null };
}

/**
 * readRuns(roomDir, section) -> records for the research runs whose plan names this nest, newest first.
 *   { run_id, status: 'terminal' | 'unresolved', reason, mode, stop_reason, finished_at, mtime }
 */
function readRuns(roomDir, section, info) {
  const base = path.join(roomDir, RUN_DIR);
  let ids = [];
  try { ids = fs.readdirSync(base); } catch (_e) { return []; }
  // Phase 395-07: at most MAX_RUNS_READ run folders are read, the newest by run id. The count of the rest is reported.
  if (ids.length > MAX_RUNS_READ) {
    if (isObj(info)) info.not_read = ids.length - MAX_RUNS_READ;
    ids = ids.slice().sort((a, b) => (a < b ? 1 : (a > b ? -1 : 0))).slice(0, MAX_RUNS_READ);
  }
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
 * gatherNest({ roomDir, sectionDir, wholeFiles? }) -> everything the brief and the composition read from the nest's own files.
 *   wholeFiles  true reads each nest file whole, with no byte ceiling; `cut` is then []. The run ceiling stays.
 *               Phase 395-07b (cold check 395-07, MA1): the blocks of the brief read the nest this way.
 */
function gatherNest(input) {
  const inp = isObj(input) ? input : {};
  const sectionDir = path.resolve(String(inp.sectionDir || inp.sectionPath || ''));
  const roomDir = path.resolve(String(inp.roomDir || path.dirname(sectionDir)));
  const section = path.basename(sectionDir);
  const cut = inp.wholeFiles === true ? false : [];
  const runInfo = { not_read: 0 };
  const minto = readMinto(sectionDir, cut);
  const unansweredCounter = minto.counter.filter((l) => !/\[answered:/.test(l) && !/\(model narrative\)$/.test(l)).length;
  const openAssumptions = minto.assumptions.filter((a) => a.state !== 'model narrative').length;
  return {
    section,
    sectionDir,
    roomDir,
    job: readJob(sectionDir, section, roomDir, cut),
    face: readFace(sectionDir, cut),
    minto,
    feynman: readFeynman(sectionDir, cut),
    runs: readRuns(roomDir, section, runInfo),
    need: { counterevidence: unansweredCounter, assumptions: openAssumptions },
    // Phase 395-07: what the two ceilings left out (see MAX_NEST_FILE_BYTES and MAX_RUNS_READ). Empty and 0 for a normal room.
    cut: Array.isArray(cut) ? cut : [],
    runs_not_read: runInfo.not_read,
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
  // Phase 395-01: one read order for the job. A goal job in the vocabulary wins over the section job.
  const sectionJobId = nest.job && typeof nest.job.id === 'string' && nest.job.id ? nest.job.id : null;
  let sel = { id: sectionJobId, origin: sectionJobId ? 'section' : null, rung: null };
  try { sel = require('../../hmi/jtbd-state.cjs').resolveSelectionJob(nest.roomDir, sectionJobId); } catch (_e) { /* keep the section job */ }
  let ledgerCandidates = null;
  if (sel.id) {
    try { ledgerCandidates = require('../section-ruling-candidates.cjs').buildLedgerCandidates({ jobId: sel.id }); } catch (_e) { ledgerCandidates = null; }
  }
  const face = nest.face && nest.face.keyed === true
    ? { asked: nest.face.asked === true, commands: nest.face.commands, not_asked_reason: nest.face.not_asked_reason }
    : { asked: false, commands: [] };
  const attempted = nest.runs.map((r) => ({ command: null, status: r.status, verified: false, run_id: r.run_id }));
  // Phase 399-07: the room's definition level is half of the table key. An unreadable room gives null (the job-only row).
  // Review WR-05: with the advisor off the level feeds nothing, so the room is not read for it (hook path).
  let definitionLevel = null;
  // Phase 400-10 (CY-05): the room's cause and effect domain, read only on the advisor-on path (hook budget).
  // Null on any failure; the advisor then gives the 399 shortlist.
  let causeEffect = null;
  if (sel.id) {
    try {
      if (require('../decision-advisor/shortlist.cjs').advisorEnabled()) {
        definitionLevel = require('../problem-axes.cjs').readRoomAxes(nest.roomDir).definition_level || null;
        try {
          const ce = require('../navigation/cause-effect.cjs').readCauseEffectForRoom(nest.roomDir);
          causeEffect = ce && typeof ce.domain === 'string' ? ce.domain : null;
        } catch (_e2) { causeEffect = null; }
      }
    } catch (_e) { definitionLevel = null; }
  }
  return composeNextMove({
    section: nest.section,
    jobId: sel.id,
    jobOrigin: sel.origin,
    face,
    sources,
    ledgerCandidates,
    surface,
    attempted,
    need: nest.need,
    definitionLevel,
    causeEffect,
    lastCommand: null, // no reader of the last command exists on this path; the v0 table has wildcard last-command rows only
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
  jobFitFor,
  ledgerRating,
  selectorMark,
  SELECTOR_ORDER,
  MAX_NEST_FILE_BYTES,
  MAX_RUNS_READ,
  JOB_FIT_STRONG,
  JOB_FIT_POOR,
  NO_PRIMARY_LINE,
  NOTHING_RE,
};
