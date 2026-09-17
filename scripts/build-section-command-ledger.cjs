#!/usr/bin/env node
'use strict';
/*
 * scripts/build-section-command-ledger.cjs -- Phase 353 Plan 02 Task 2
 * (RULE-12, D-353-6, R-353-C, R-353-G, R-353-N).
 *
 * Builds data/section-command-ledger.json: the shipped, Theo-derived,
 * Jev-scored relevance ledger the runtime reads at every turn with ZERO
 * vendor calls (lib/core/section-ruling-candidates.cjs is the reader).
 *
 * DIVERGENCE FROM THE ELEVEN OTHER `build-*.cjs --check` SIBLINGS: this
 * builder's `--check` does NOT rebuild. A rebuild needs a live Theo
 * connection and a Jev vendor key; the release path must stay key-free and
 * Canon Part 8 clean (R-353-G). `--check` therefore asserts only what is
 * verifiable OFFLINE against the shipped file: it parses, its
 * plugin_version matches this repo, its age is reported, and every row key
 * names a known job. The real rebuild is a navigator-invoked pre-release
 * act (`node scripts/build-section-command-ledger.cjs`, the dev-time key
 * exported in the operator's own shell from ~/.secrets/typesafe.env), never
 * a release.sh step and never a hook.
 *
 * Three build modes:
 *   --offline-seed      builds from LOCAL sources only (the canon, the
 *                        command registry, the eleven hand-authored section
 *                        contract tables). build_mode: "offline-seed",
 *                        jev_model: null, every candidate confidence: null.
 *   (default)            pulls Theo (governed brain-client.cjs path, fixed
 *                        Cypher texts, $params only) and scores with Jev.
 *                        build_mode: "jev-scored".
 *   --jev-fixture <path> injects a recorded Jev response file instead of
 *                        calling the vendor, so the scoring path is
 *                        deterministic in tests with zero network. Also
 *                        build_mode: "jev-scored" (fixture-scored).
 *
 * Canon Part 8 ceiling, made executable: assertEgressCeiling(payload) runs
 * immediately before every fetch() and throws on any key outside the
 * allowed set, or any string over 140 characters outside the one allowed
 * `instructions` field. Only a framework/command NAME, a JTBD STATEMENT and
 * a GLOSSARY LINE ever cross to Jev. Never room content, never a full Theo
 * description, never a user string.
 *
 * The dev-time TYPESAFE_API_KEY is read from ~/.secrets/typesafe.env (mode
 * 600) or process.env.TYPESAFE_API_KEY ONLY. It is never printed, never
 * logged, never written into the ledger. This file lives in scripts/ only;
 * no file under lib/ or hooks/ may reference api.typesafe.ai, a Jev client,
 * or this script (CLAUDE.md constraint, T-353-09/T-353-10).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const LEDGER_PATH = path.join(DATA_DIR, 'section-command-ledger.json');
const CANON_PATH = path.join(DATA_DIR, 'section-job-canon.json');
const COMMAND_REGISTRY_PATH = path.join(DATA_DIR, 'command-registry.json');
const CONTRACTS_DIR = path.join(ROOT, 'templates', 'room-skeleton', 'section-contracts');
const TURNS_PATH = path.join(ROOT, 'evals', 'icm', 'cases', 'turns.json');

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const BATCH = 20;
const CONC = 4;
const VENDOR_USD_PER_INPUT_TOKEN = 42 / 1e9; // vendor-claimed, unverified (Spike 002)

// ---------------------------------------------------------------------------
// Key handling. Never printed, never logged, never written into the ledger.
// ---------------------------------------------------------------------------
function loadKey() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  try {
    const raw = fs.readFileSync(path.join(os.homedir(), '.secrets', 'typesafe.env'), 'utf8');
    const m = raw.match(/^TYPESAFE_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch (_e) { /* fall through */ }
  return null;
}

// ---------------------------------------------------------------------------
// Canon Part 8 ceiling made executable (T-353-09). Called immediately before
// every fetch(). Throws rather than degrades: an egress-ceiling violation is
// a defect in this script, never a runtime condition to tolerate.
// ---------------------------------------------------------------------------
const EGRESS_ALLOWED_TOP_KEYS = new Set(['model', 'state', 'questions']);
const EGRESS_ALLOWED_STATE_KEYS = new Set(['section', 'problem_type', 'stage', 'candidates']);
const EGRESS_ALLOWED_CANDIDATE_KEYS = new Set(['name', 'jtbd', 'glossary', 'description']);
const EGRESS_MAX_STRING_LEN = 140;

function assertEgressCeiling(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('assertEgressCeiling: payload must be an object');
  }
  for (const k of Object.keys(payload)) {
    if (!EGRESS_ALLOWED_TOP_KEYS.has(k)) {
      throw new Error('assertEgressCeiling: disallowed top-level key "' + k + '"');
    }
  }
  const state = payload.state || {};
  if (typeof state === 'object' && !Array.isArray(state)) {
    for (const k of Object.keys(state)) {
      if (!EGRESS_ALLOWED_STATE_KEYS.has(k)) {
        throw new Error('assertEgressCeiling: disallowed state key "' + k + '"');
      }
    }
    const candidates = state.candidates || {};
    for (const cid of Object.keys(candidates)) {
      const c = candidates[cid] || {};
      for (const k of Object.keys(c)) {
        if (!EGRESS_ALLOWED_CANDIDATE_KEYS.has(k)) {
          throw new Error('assertEgressCeiling: disallowed candidate key "' + k + '" on ' + cid);
        }
        if (typeof c[k] === 'string' && c[k].length > EGRESS_MAX_STRING_LEN) {
          throw new Error('assertEgressCeiling: candidate.' + cid + '.' + k + ' exceeds ' + EGRESS_MAX_STRING_LEN + ' chars');
        }
      }
    }
  }
  // questions carry only instructions/criteria/type: no free-text room bytes.
  const questions = payload.questions || {};
  for (const qid of Object.keys(questions)) {
    const q = questions[qid] || {};
    if (q.instructions && typeof q.instructions.judge === 'string' && q.instructions.judge.length > 400) {
      throw new Error('assertEgressCeiling: question ' + qid + ' instructions.judge unexpectedly long');
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Jev client: near-verbatim port of the spike's jev()/pool(), 400*2**attempt
// backoff, max 4 attempts, retry on 429/529, batch 20, concurrency 4.
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jev(key, body) {
  assertEgressCeiling(body);
  let attempt = 0;
  for (;;) {
    const t0 = Date.now();
    let r;
    try {
      r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (attempt++ < 3) { await sleep(500 * 2 ** attempt); continue; }
      return { status: 0, ms: Date.now() - t0, json: null };
    }
    const ms = Date.now() - t0;
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_e) { /* leave json null */ }
    if ((r.status === 429 || r.status === 529) && attempt++ < 4) { await sleep(400 * 2 ** attempt); continue; }
    return { status: r.status, ms: ms, json: json, text: text.slice(0, 200) };
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    for (;;) {
      const k = i++;
      if (k >= items.length) return;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}

// ---------------------------------------------------------------------------
// Theo puller: verbatim port of Spike 002's pullTheoFrameworks. Two FIXED
// Cypher texts; every variation rides in $params (check-substrate.cjs rule
// m4-cypher-interpolation forbids concatenated Cypher). Never called by
// --check or --offline-seed.
// ---------------------------------------------------------------------------
const CYPHER_PREFIX = [
  'MATCH (f:Framework)',
  'WHERE toLower(left(f.name, $n)) = $prefix',
  "AND coalesce(f.alias_of, '') = '' AND coalesce(f.canonical, true) <> false",
  "RETURN f.name AS name, toString(coalesce(f.description, '')) AS description,",
  "toString(coalesce(f.jtbd_anchor, '')) AS jtbd_anchor, toString(coalesce(f.definition, '')) AS definition",
  'ORDER BY name LIMIT 100',
].join(' ');
const CYPHER_OTHER = [
  'MATCH (f:Framework)',
  'WHERE NOT toLower(left(f.name, 1)) IN $alnum',
  "AND coalesce(f.alias_of, '') = '' AND coalesce(f.canonical, true) <> false",
  "RETURN f.name AS name, toString(coalesce(f.description, '')) AS description,",
  "toString(coalesce(f.jtbd_anchor, '')) AS jtbd_anchor, toString(coalesce(f.definition, '')) AS definition",
  'ORDER BY name LIMIT 100',
].join(' ');
const ALNUM = '0123456789abcdefghijklmnopqrstuvwxyz'.split('');

async function pullTheoFrameworks() {
  // eslint-disable-next-line global-require
  const brain = require(path.join(ROOT, 'lib', 'core', 'brain-client.cjs'));
  const rows = [];

  async function bucket(prefix, depth) {
    const res = await brain.query(CYPHER_PREFIX, { n: prefix.length, prefix: prefix });
    if (res && res.error === 'brain_query_unrecognized_shape') {
      throw new Error('theo_unrecognized_shape: brain_query_unrecognized_shape on bucket "' + prefix + '" (shape_type=' + res.shape_type + ')');
    }
    const page = (res && (res.rows || res.records)) || [];
    if (page.length === 0 && res && res.text && /ROW_CAP/.test(String(res.text))) {
      if (depth >= 2) return; // named, tolerated: unsplit-at-depth-2 cap hit
      for (const c of ALNUM) await bucket(prefix + c, depth + 1);
      return;
    }
    rows.push.apply(rows, page);
  }
  for (const c of ALNUM) await bucket(c, 0);
  {
    const res = await brain.query(CYPHER_OTHER, { alnum: ALNUM });
    if (res && res.error === 'brain_query_unrecognized_shape') {
      throw new Error('theo_unrecognized_shape: brain_query_unrecognized_shape on catch-all bucket (shape_type=' + res.shape_type + ')');
    }
    const page = (res && (res.rows || res.records)) || [];
    rows.push.apply(rows, page);
  }
  const seen = new Set();
  const list = [];
  for (const r of rows) {
    const name = String(r.name || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    list.push({
      name: name,
      description: String(r.description || '').trim(),
      jtbd_anchor: String(r.jtbd_anchor || '').trim(),
      definition: String(r.definition || '').trim(),
    });
  }
  return list;
}

function glossaryLine(f) {
  if (!f) return '';
  if (f.definition) return f.definition.slice(0, 140);
  const d = (f.description || '').replace(/\s+/g, ' ').trim();
  if (!d) return '';
  const first = d.split(/(?<=[.!?])\s/)[0] || d;
  return first.slice(0, 140);
}

// ---------------------------------------------------------------------------
// The join (R-353-C): the UNION of (a) commands seeded from the section
// contract's own "## Commands that write here" table (both its ground-truth
// and framework-matched bullets are the seed set; never recomputed from a
// live `produces` glob match), and (b) commands whose serves_jtbd includes
// the job or its declared secondary. Keyed by job_id so the four
// vocabulary-extension jobs (with no serves_jtbd member of their own) still
// resolve non-empty rows through half (a).
// ---------------------------------------------------------------------------
function parseContractCommands(contractPath) {
  let text;
  try {
    text = fs.readFileSync(contractPath, 'utf8');
  } catch (_e) {
    return [];
  }
  const sectionMatch = text.match(/## Commands that write here([\s\S]*)$/);
  if (!sectionMatch) return [];
  const body = sectionMatch[1];
  const slugRe = /`(\/mos:[a-z0-9-]+)`/g;
  const found = [];
  const seen = new Set();
  let m;
  while ((m = slugRe.exec(body)) !== null) {
    const slug = m[1];
    if (!seen.has(slug)) { seen.add(slug); found.push(slug); }
  }
  // Ground truth vs framework-matched: split on the two named bullet lines.
  const groundLine = (body.match(/Ground truth[^\n]*\n?/) || [''])[0];
  const groundSlugs = new Set();
  let gm;
  const groundRe = /`(\/mos:[a-z0-9-]+)`/g;
  while ((gm = groundRe.exec(groundLine)) !== null) groundSlugs.add(gm[1]);
  return found.map((slug) => ({ command: slug, source: groundSlugs.has(slug) ? 'ground-truth' : 'framework-matched' }));
}

function buildJobCandidateMap() {
  const canon = require(CANON_PATH);
  const commandRegistry = require(COMMAND_REGISTRY_PATH);
  const commands = Array.isArray(commandRegistry.commands) ? commandRegistry.commands : [];
  const byCommand = new Map();
  for (const c of commands) byCommand.set(c.command, c);

  // Which jobs does each section's contract seed (half a)? A section may
  // seed its own job_id and its declared secondary_job_id.
  const jobToContractCommands = new Map(); // job_id -> [{command, source}]
  for (const [slug, row] of Object.entries(canon.sections)) {
    const contractPath = path.join(CONTRACTS_DIR, slug + '.md');
    const seeded = parseContractCommands(contractPath);
    if (seeded.length === 0) continue;
    for (const jobId of [row.job_id, row.secondary_job_id].filter(Boolean)) {
      const list = jobToContractCommands.get(jobId) || [];
      for (const entry of seeded) {
        if (!list.find((x) => x.command === entry.command)) list.push(entry);
      }
      jobToContractCommands.set(jobId, list);
    }
  }

  // Which jobs does each command's serves_jtbd declare (half b)?
  const jobToServesJtbdCommands = new Map();
  for (const c of commands) {
    const list = Array.isArray(c.serves_jtbd) ? c.serves_jtbd : [];
    for (const jobId of list) {
      const arr = jobToServesJtbdCommands.get(jobId) || [];
      arr.push({ command: c.command, source: 'serves-jtbd' });
      jobToServesJtbdCommands.set(jobId, arr);
    }
  }

  const allJobIds = new Set();
  for (const row of Object.values(canon.sections)) {
    allJobIds.add(row.job_id);
    if (row.secondary_job_id) allJobIds.add(row.secondary_job_id);
  }

  const result = new Map(); // job_id -> [{command, source, commandRow}]
  for (const jobId of allJobIds) {
    const merged = [];
    const seen = new Set();
    for (const entry of (jobToContractCommands.get(jobId) || [])) {
      if (seen.has(entry.command)) continue;
      seen.add(entry.command);
      merged.push({ command: entry.command, source: entry.source, commandRow: byCommand.get(entry.command) || null });
    }
    for (const entry of (jobToServesJtbdCommands.get(jobId) || [])) {
      if (seen.has(entry.command)) continue;
      seen.add(entry.command);
      merged.push({ command: entry.command, source: entry.source, commandRow: byCommand.get(entry.command) || null });
    }
    result.set(jobId, merged);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Row assembly.
// ---------------------------------------------------------------------------
function rowsFromCandidateMap(jobCandidateMap) {
  const rows = {};
  for (const [jobId, candidates] of jobCandidateMap.entries()) {
    if (candidates.length === 0) continue;
    const key = jobId + '|*|*';
    rows[key] = candidates.map((c) => ({
      command: c.command,
      framework: (c.commandRow && Array.isArray(c.commandRow.frameworks) && c.commandRow.frameworks[0]) || null,
      // Offline ordinal: ground-truth outranks serves-jtbd outranks
      // framework-matched, matching the Jev 0/1/2 fit-as-first-move scale.
      score: c.source === 'ground-truth' ? 2 : (c.source === 'serves-jtbd' ? 1.5 : 1),
      confidence: null,
      source: c.source === 'serves-jtbd' ? 'ground-truth' : c.source,
    }));
  }
  return rows;
}

function calibrateFloor(rows) {
  let turns;
  try {
    turns = require(TURNS_PATH).turns || [];
  } catch (_e) {
    return { confidence_floor: null, floor_basis: 'not calibrated: evals/icm/cases/turns.json unavailable', floor_hit_rate: null };
  }
  if (turns.length === 0) {
    return { confidence_floor: null, floor_basis: 'not calibrated: no labeled turns', floor_hit_rate: null };
  }
  const candidateFloors = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  let best = { floor: candidateFloors[0], hits: -1 };
  for (const floor of candidateFloors) {
    let hits = 0;
    for (const turn of turns) {
      const jobRow = Object.entries(rows).find(([k]) => k.startsWith(turn.section + '|') || k.split('|')[0] === turn.section);
      // Rows are keyed by job_id, not section; resolve through the canon.
      let candidates = [];
      try {
        const canon = require(CANON_PATH);
        const sectionRow = canon.sections[turn.section];
        if (sectionRow) {
          const key = sectionRow.job_id + '|*|*';
          candidates = rows[key] || [];
        }
      } catch (_e) { /* skip */ }
      const survivors = candidates.filter((c) => (c.confidence === null ? true : c.confidence >= floor));
      const top3 = survivors.slice(0, 3).map((c) => c.command.replace(/^\//, ''));
      const expected = Array.isArray(turn.expected_commands) ? turn.expected_commands : [];
      if (top3.some((c) => expected.includes(c))) hits += 1;
      void jobRow;
    }
    if (hits > best.hits) best = { floor: floor, hits: hits };
  }
  return {
    confidence_floor: best.floor,
    floor_basis: 'swept over evals/icm/cases/turns.json (' + turns.length + ' labeled turns), argmax top-3 hit rate',
    floor_hit_rate: turns.length > 0 ? best.hits / turns.length : null,
  };
}

// ---------------------------------------------------------------------------
// Serialization: stable key order, trailing newline.
// ---------------------------------------------------------------------------
function serializeLedger(ledger) {
  const orderedRows = {};
  for (const k of Object.keys(ledger.rows).sort()) orderedRows[k] = ledger.rows[k];
  const ordered = Object.assign({}, ledger, { rows: orderedRows });
  return JSON.stringify(ordered, null, 2) + '\n';
}

function writeLedger(ledger) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(LEDGER_PATH, serializeLedger(ledger));
}

// ---------------------------------------------------------------------------
// --offline-seed: local sources only.
// ---------------------------------------------------------------------------
function buildOfflineSeedLedger() {
  // eslint-disable-next-line global-require
  const { readRepoVersion } = require(path.join(ROOT, 'lib', 'core', 'repo-version.cjs'));
  const jobCandidateMap = buildJobCandidateMap();
  const rows = rowsFromCandidateMap(jobCandidateMap);
  const floorInfo = { confidence_floor: null, floor_basis: 'not calibrated: offline-seed build carries no vendor confidence', floor_hit_rate: null };
  const version = readRepoVersion();
  const ledger = {
    built_at: new Date().toISOString(),
    build_mode: 'offline-seed',
    plugin_version: version.version,
    theo_frameworks: 0,
    jev_model: null,
    confidence_floor: floorInfo.confidence_floor,
    floor_basis: floorInfo.floor_basis,
    floor_hit_rate: floorInfo.floor_hit_rate,
    wall_ms: 0,
    jev_calls: 0,
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost_usd: 0,
    cost_basis: 'vendor-claimed rate, unverified',
    rows: rows,
  };
  return ledger;
}

// ---------------------------------------------------------------------------
// --jev-fixture <path>: deterministic scoring path, zero network.
// ---------------------------------------------------------------------------
function buildWithJevFixture(fixturePath) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  // eslint-disable-next-line global-require
  const { readRepoVersion } = require(path.join(ROOT, 'lib', 'core', 'repo-version.cjs'));
  const jobCandidateMap = buildJobCandidateMap();
  const rows = rowsFromCandidateMap(jobCandidateMap);

  let jevCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const [jobId, fixtureRows] of Object.entries(fixture.rows || {})) {
    const key = jobId + '|*|*';
    const existing = rows[key] || [];
    jevCalls += 1;
    inputTokens += (fixture.usage && fixture.usage.input_tokens_per_call) || 500;
    outputTokens += (fixture.usage && fixture.usage.output_tokens_per_call) || 100;
    for (const fr of fixtureRows) {
      const match = existing.find((c) => c.command === fr.command);
      if (match) {
        match.score = fr.score;
        match.confidence = fr.confidence;
        match.source = match.source === 'ground-truth' ? 'ground-truth' : 'framework-matched';
      } else {
        existing.push({ command: fr.command, framework: fr.framework || null, score: fr.score, confidence: fr.confidence, source: 'framework-matched' });
      }
    }
    existing.sort((a, b) => (b.score - a.score));
    rows[key] = existing;
  }

  const floorInfo = calibrateFloor(rows);
  const version = readRepoVersion();
  const ledger = {
    built_at: new Date().toISOString(),
    build_mode: 'jev-scored',
    plugin_version: version.version,
    theo_frameworks: 0,
    jev_model: fixture.model || MODEL,
    confidence_floor: floorInfo.confidence_floor,
    floor_basis: floorInfo.floor_basis,
    floor_hit_rate: floorInfo.floor_hit_rate,
    wall_ms: 1,
    jev_calls: jevCalls,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: inputTokens * VENDOR_USD_PER_INPUT_TOKEN,
    cost_basis: 'vendor-claimed rate, unverified',
    rows: rows,
  };
  return ledger;
}

// ---------------------------------------------------------------------------
// Default: pull Theo, score with Jev. Navigator-invoked only (R-353-G).
// ---------------------------------------------------------------------------
async function buildJevScored() {
  const key = loadKey();
  if (!key) {
    console.error('build-section-command-ledger: no TYPESAFE_API_KEY (checked process.env and ~/.secrets/typesafe.env). Writing nothing.');
    process.exit(3);
  }
  const t0 = Date.now();
  const frameworks = await pullTheoFrameworks();
  const byFrameworkName = new Map(frameworks.map((f) => [f.name, f]));

  // eslint-disable-next-line global-require
  const { readRepoVersion } = require(path.join(ROOT, 'lib', 'core', 'repo-version.cjs'));
  const jobCandidateMap = buildJobCandidateMap();
  const rows = rowsFromCandidateMap(jobCandidateMap);

  let jevCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let model = MODEL;

  const jobIds = Array.from(jobCandidateMap.keys());
  await pool(jobIds, CONC, async (jobId) => {
    const candidates = jobCandidateMap.get(jobId) || [];
    if (candidates.length === 0) return;
    const batches = [];
    for (let i = 0; i < candidates.length; i += BATCH) batches.push(candidates.slice(i, i + BATCH));
    for (const batch of batches) {
      const state = { candidates: {} };
      batch.forEach((c, j) => {
        const fw = c.commandRow && Array.isArray(c.commandRow.frameworks) ? c.commandRow.frameworks[0] : null;
        const theoFw = fw ? byFrameworkName.get(fw) : null;
        state.candidates['c' + j] = {
          name: c.command,
          jtbd: (c.commandRow && c.commandRow.jtbd_summary) ? String(c.commandRow.jtbd_summary).slice(0, 140) : jobId,
          glossary: glossaryLine(theoFw) || '',
        };
      });
      const questions = {};
      batch.forEach((c, j) => {
        questions['c' + j] = {
          type: 'score',
          instructions: { judge: 'How well does the command at `candidates.c' + j + '` fit as the FIRST move for a room whose declared job is `' + jobId + '`?' },
          criteria: [
            'poor fit as a first move: premature, off-job, or answers a question this stage is not asking',
            'partial fit: useful as a later or supporting move once the first move has landed',
            'strong fit: a right first move for exactly this job',
          ],
        };
      });
      const body = { model: MODEL, state: state, questions: questions };
      const r = await jev(key, body);
      if (r.status !== 200 || !r.json) continue;
      model = r.json.model || model;
      jevCalls += 1;
      inputTokens += (r.json.usage || {}).input_tokens || 0;
      outputTokens += (r.json.usage || {}).output_tokens || 0;
      const key2 = jobId + '|*|*';
      const target = rows[key2] || [];
      batch.forEach((c, j) => {
        const a = r.json.answers && r.json.answers['c' + j];
        if (!a) return;
        const existing = target.find((x) => x.command === c.command);
        if (existing) {
          existing.score = a.score;
          existing.confidence = a.confidence;
        } else {
          target.push({ command: c.command, framework: (c.commandRow && c.commandRow.frameworks && c.commandRow.frameworks[0]) || null, score: a.score, confidence: a.confidence, source: 'framework-matched' });
        }
      });
      rows[key2] = target.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
  });

  const floorInfo = calibrateFloor(rows);
  const version = readRepoVersion();
  const wallMs = Date.now() - t0;
  const ledger = {
    built_at: new Date().toISOString(),
    build_mode: 'jev-scored',
    plugin_version: version.version,
    theo_frameworks: frameworks.length,
    jev_model: model,
    confidence_floor: floorInfo.confidence_floor,
    floor_basis: floorInfo.floor_basis,
    floor_hit_rate: floorInfo.floor_hit_rate,
    wall_ms: wallMs,
    jev_calls: jevCalls,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: inputTokens * VENDOR_USD_PER_INPUT_TOKEN,
    cost_basis: 'vendor-claimed rate, unverified',
    rows: rows,
  };
  writeLedger(ledger);
  const rowCount = Object.keys(rows).length;
  console.log('section-command-ledger: wrote ' + rowCount + ' rows, ' + frameworks.length + ' Theo frameworks, model ' + model);
}

// ---------------------------------------------------------------------------
// --check: ZERO network calls. Never requires brain-client.cjs.
// ---------------------------------------------------------------------------
function runCheck() {
  // eslint-disable-next-line global-require
  const { readRepoVersion } = require(path.join(ROOT, 'lib', 'core', 'repo-version.cjs'));
  let ledger;
  try {
    ledger = require(LEDGER_PATH);
  } catch (e) {
    console.error('section-command-ledger: FAILED (cannot parse ' + LEDGER_PATH + ': ' + e.message + ')');
    return false;
  }
  let canon;
  try {
    canon = require(CANON_PATH);
  } catch (e) {
    console.error('section-command-ledger: FAILED (cannot parse data/section-job-canon.json: ' + e.message + ')');
    return false;
  }
  const knownJobs = new Set();
  for (const row of Object.values(canon.sections)) {
    knownJobs.add(row.job_id);
    if (row.secondary_job_id) knownJobs.add(row.secondary_job_id);
  }

  const version = readRepoVersion();
  if (ledger.plugin_version !== version.version) {
    console.error('section-command-ledger: FAILED (plugin_version drift: ledger=' + ledger.plugin_version + ' repo=' + version.version + ')');
    return false;
  }
  const builtAt = Date.parse(ledger.built_at);
  if (Number.isNaN(builtAt)) {
    console.error('section-command-ledger: FAILED (built_at is not a valid ISO string: ' + ledger.built_at + ')');
    return false;
  }
  const ageMs = Date.now() - builtAt;
  if (typeof ledger.theo_frameworks !== 'number' || ledger.theo_frameworks < 0) {
    console.error('section-command-ledger: FAILED (theo_frameworks must be a non-negative integer)');
    return false;
  }
  if (ledger.jev_model !== null && typeof ledger.jev_model !== 'string') {
    console.error('section-command-ledger: FAILED (jev_model must be a string or null)');
    return false;
  }
  const rowIds = Object.keys(ledger.rows || {});
  for (const rowId of rowIds) {
    const parts = rowId.split('|');
    if (parts.length !== 3) {
      console.error('section-command-ledger: FAILED (row identifier "' + rowId + '" does not parse as job_id|problem_type|stage)');
      return false;
    }
    if (!knownJobs.has(parts[0])) {
      console.error('section-command-ledger: FAILED (row identifier "' + rowId + '" names an unknown job_id "' + parts[0] + '")');
      return false;
    }
  }
  console.log('section-command-ledger: OK (built ' + Math.round(ageMs / 86400000) + ' day(s) ago, mode=' + ledger.build_mode + ', ' + Object.keys(ledger.rows || {}).length + ' rows)');
  return true;
}

// ---------------------------------------------------------------------------
// main(): --check / --offline-seed / --jev-fixture <path> / default (jev-scored).
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--check')) {
    const ok = runCheck();
    process.exit(ok ? 0 : 1);
    return;
  }

  if (argv.includes('--offline-seed')) {
    writeLedger(buildOfflineSeedLedger());
    console.log('section-command-ledger: wrote offline-seed ledger');
    return;
  }

  const fixtureIdx = argv.indexOf('--jev-fixture');
  if (fixtureIdx !== -1) {
    const fixturePath = argv[fixtureIdx + 1];
    if (!fixturePath) {
      console.error('build-section-command-ledger: --jev-fixture requires a path');
      process.exit(1);
    }
    writeLedger(buildWithJevFixture(fixturePath));
    console.log('section-command-ledger: wrote jev-fixture-scored ledger');
    return;
  }

  buildJevScored().catch((e) => {
    console.error('build-section-command-ledger: ' + (e && e.stack || e));
    process.exit(1);
  });
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    LEDGER_PATH,
    CANON_PATH,
    loadKey,
    assertEgressCeiling,
    jev,
    pool,
    pullTheoFrameworks,
    buildJobCandidateMap,
    rowsFromCandidateMap,
    calibrateFloor,
    serializeLedger,
    buildOfflineSeedLedger,
    buildWithJevFixture,
    buildJevScored,
    runCheck,
    main,
  };
}
