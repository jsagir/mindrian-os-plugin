#!/usr/bin/env node
'use strict';
/*
 * scripts/build-framework-command-ledger.cjs -- Phase 354 Plan 17 Task 1
 * (THEO-01 TypeSafe/Jev recall extension; sibling of Phase 353's
 * scripts/build-section-command-ledger.cjs).
 *
 * Builds data/framework-command-ledger.json: a shipped, Theo-derived,
 * Jev-scored mapping of Theo FRAMEWORK LABELS to real, registry-scoped
 * command ids, read at runtime by lib/mcp/brain-router.cjs's
 * `_lookupLedgerCommand` with ZERO vendor calls, consulted only after the
 * exact-`KNOWN_METHODOLOGIES` slug check (354-09) finds nothing. This
 * recovers recall that 354-09's exact-match safety fix deliberately costs,
 * without ever widening that safety property: `_lookupLedgerCommand` only
 * ever returns a `command_id` drawn from the live `KNOWN_METHODOLOGIES`
 * export (checked once at build time here, checked again at lookup time in
 * brain-router.cjs -- defense in depth, T-354-22).
 *
 * HONESTY (plan-checker blocker 4, 354-17 must_haves.truths): the ledger
 * this builder ships by DEFAULT (`--offline-seed`) carries
 * `build_mode: 'offline-seed'` and `confidence_floor: null`.
 * `_lookupLedgerCommand`'s own rule (source !== 'offline-seed' required to
 * ever return a match when confidence_floor is null) means the shipped
 * ledger promotes ZERO candidates on day one, by construction -- this is
 * infrastructure, not delivered recall, until a navigator runs a
 * `--jev-fixture` or default (jev-scored) build with a real
 * TYPESAFE_API_KEY pre-release. Neither this script's own output nor any
 * downstream summary may claim recall ships with the committed ledger
 * alone.
 *
 * Three build modes, matching the 353 sibling's convention:
 *   --offline-seed      LOCAL sources only (data/framework-names.json +
 *                        data/command-registry.json), zero network. Every
 *                        row: confidence: null, source: 'offline-seed',
 *                        score derived only from an exact case-insensitive
 *                        substring match between the framework name and a
 *                        command's teaching/jtbd_summary text -- best
 *                        effort, explicitly lower quality than jev-scored.
 *   (default)            pulls Theo (governed brain-client.cjs path, fixed
 *                        Cypher texts, $params only) and scores with Jev.
 *                        build_mode: 'jev-scored'. Navigator-invoked
 *                        pre-release only, never a release.sh step, never
 *                        a hook (mirrors the 353 sibling's R-353-G).
 *   --jev-fixture <path> injects a recorded Jev response file instead of
 *                        calling the vendor, so the scoring path is
 *                        deterministic in tests with zero network. Also
 *                        build_mode: 'jev-scored' (fixture-scored).
 *
 * --check is fully OFFLINE: parses the shipped ledger, confirms
 * plugin_version matches this repo, confirms every `rows[*][*].command_id`
 * is a member of the LIVE `KNOWN_METHODOLOGIES` export read from
 * lib/mcp/brain-router.cjs (never a hand-copied list, so registry drift is
 * caught), never requires TYPESAFE_API_KEY.
 *
 * Egress ceiling: this file defines NO local egress-ceiling logic of its
 * own. `assertEgressCeiling` is `makeEgressGuard(EGRESS_PROFILES.
 * framework_command_ledger)` from the shared `scripts/jev-devtime-client.cjs`
 * (extracted by Phase 356, commit 7336e5215, imported unchanged per this
 * plan's amended STEP 0 -- Phase 356 ran first). Its candidate key set is
 * name/jtbd/glossary ONLY (no `description`, unlike 353's
 * section_command_ledger profile) -- refuse, never strip, on any other key
 * or any string over 140 chars.
 *
 * The dev-time TYPESAFE_API_KEY is read from ~/.secrets/typesafe.env (mode
 * 600) or process.env.TYPESAFE_API_KEY ONLY (via the shared client's
 * loadKey). It is never printed, never logged, never written into the
 * ledger. This file lives in scripts/ only; no file under lib/ or hooks/
 * may reference api.typesafe.ai, a Jev client, or this script.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const LEDGER_PATH = path.join(DATA_DIR, 'framework-command-ledger.json');
const COMMAND_REGISTRY_PATH = path.join(DATA_DIR, 'command-registry.json');
const FRAMEWORK_NAMES_PATH = path.join(DATA_DIR, 'framework-names.json');
const LABELS_FIXTURE_PATH = path.join(ROOT, 'tests', 'fixtures', 'framework-command-ledger-labels.json');
const BRAIN_ROUTER_PATH = path.join(ROOT, 'lib', 'mcp', 'brain-router.cjs');

const {
  loadKey,
  jev: jevClient,
  pool,
  makeEgressGuard,
  EGRESS_PROFILES,
} = require('./jev-devtime-client.cjs');

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const BATCH = 20;
const CONC = 4;
const VENDOR_USD_PER_INPUT_TOKEN = 42 / 1e9; // vendor-claimed, unverified (Spike 002)

// This script defines NO local egress-ceiling logic of its own -- the guard
// is entirely the shared client's `framework_command_ledger` profile.
const assertEgressCeiling = makeEgressGuard(EGRESS_PROFILES.framework_command_ledger);

async function jev(key, body) {
  return jevClient(body, { key: key, guard: assertEgressCeiling, endpoint: ENDPOINT });
}

// ---------------------------------------------------------------------------
// Theo puller: verbatim port of the 353 sibling's bucketed-scan Cypher
// pattern (same alias/non-canonical filter, same 36-bucket-plus-catch-all
// loop, same second-character split on ROW_CAP). Never called by --check or
// --offline-seed. Not extracted into the shared client -- only loadKey/
// jev/pool/makeEgressGuard/EGRESS_PROFILES are shared (D-06); the Theo read
// shape stays local to each builder, per the section-framework-ledger
// reference's Theo-read-contract rules (Skip/Distinct/NodeUniqueIndexSeek
// ByRange are PLAN_REJECTED; a function-wrapped, parameterized predicate
// plans as NodeByLabelScan + Filter and passes).
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

// ---------------------------------------------------------------------------
// IP egress composition (navigator ruling 2026-09-17, spike-findings skill,
// section-framework-ledger.md / jev-typed-decisions-api.md): name + JTBD
// statement (rendered from the Brain's closed job vocabulary on
// jtbd_anchor, else the raw anchor label) + a glossary line (definition,
// else first sentence of description capped at 140 chars). Full Theo
// descriptions NEVER cross -- ported from
// .claude/skills/spike-findings-MindrianOS-Plugin/sources/002-jev-section-
// framework-ranker/rank.cjs's JTBD_MAP/jtbdStatement/glossaryLine (the
// canonical source for this composition), trimmed to the anchors this repo
// actually uses.
// ---------------------------------------------------------------------------
const JTBD_MAP = {
  select_methodology: 'Choose which methodology to run next for this room state',
  suggest_next_move: 'Suggest the next move for the navigator',
  detect_contradiction: 'Detect a contradiction between claims held in the room',
  summarize_neighborhood: 'Summarize the neighborhood of claims around a focus',
  classify_room_budding: 'Decide whether a room is budding into a sub-room',
  rank_assumptions: 'Rank the assumptions that are load-bearing',
  generate_feynman_explanation: 'Explain a concept from first principles in plain language',
  strengthen_minto: 'Strengthen the governing thought and its supporting pyramid',
  prepare_investor_brief: 'Prepare a brief for an investor, partner or customer meeting',
  opportunity_react: 'React to a newly surfaced opportunity',
  opportunity_reflect: 'Reflect on an opportunity against the venture thesis',
  opportunity_rank: 'Rank the opportunities in the bank',
};

function jtbdStatement(anchor) {
  if (!anchor) return '';
  if (typeof JTBD_MAP[anchor] === 'string') return JTBD_MAP[anchor];
  return anchor;
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
// buildCandidateMap(): the KNOWN_METHODOLOGIES-scoped command slug list,
// read LIVE from lib/mcp/brain-router.cjs (never hand-copied, so the two
// never drift). Bare slugs (no "/mos:" prefix) -- the exact shape
// KNOWN_METHODOLOGIES itself and brain-router.cjs's chain both use.
// ---------------------------------------------------------------------------
function buildCandidateMap() {
  // eslint-disable-next-line global-require
  const commandRegistry = require(COMMAND_REGISTRY_PATH);
  const commands = Array.isArray(commandRegistry.commands) ? commandRegistry.commands : [];
  // eslint-disable-next-line global-require
  const brainRouter = require(BRAIN_ROUTER_PATH);
  const known = new Set(Array.isArray(brainRouter.KNOWN_METHODOLOGIES) ? brainRouter.KNOWN_METHODOLOGIES : []);
  const result = [];
  const seen = new Set();
  for (const c of commands) {
    const bare = String(c.command || '').replace(/^\/mos:/, '');
    if (!bare || !known.has(bare) || seen.has(bare)) continue;
    seen.add(bare);
    result.push({ command_id: bare, commandRow: c });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Serialization: stable key order, trailing newline (matches the 353
// sibling's convention).
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
// calibrateFloor(rows): sweep the same way the 353 sibling's calibrateFloor
// does, but against this ledger's OWN hand-labeled fixture
// (tests/fixtures/framework-command-ledger-labels.json, >=15 (framework,
// command_id, correct) triples) rather than evals/icm/cases/turns.json --
// this ledger's rows are keyed by framework name, not job_id, so the
// sibling's turn-based calibration does not apply directly.
// ---------------------------------------------------------------------------
function calibrateFloor(rows) {
  let labels;
  try {
    // eslint-disable-next-line global-require
    labels = require(LABELS_FIXTURE_PATH).labels || [];
  } catch (_e) {
    return { confidence_floor: null, floor_basis: 'not calibrated: tests/fixtures/framework-command-ledger-labels.json unavailable', floor_hit_rate: null };
  }
  if (!Array.isArray(labels) || labels.length === 0) {
    return { confidence_floor: null, floor_basis: 'not calibrated: no labeled triples', floor_hit_rate: null };
  }
  const candidateFloors = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  let best = { floor: candidateFloors[0], hits: -1 };
  for (const floor of candidateFloors) {
    let hits = 0;
    for (const t of labels) {
      const frameworkRows = rows[t.framework] || [];
      const row = frameworkRows.find((r) => r.command_id === t.command_id);
      const survives = !!row && typeof row.score === 'number' && row.score >= floor;
      if (survives === !!t.correct) hits += 1;
    }
    if (hits > best.hits) best = { floor: floor, hits: hits };
  }
  return {
    confidence_floor: best.floor,
    floor_basis: 'swept over tests/fixtures/framework-command-ledger-labels.json (' + labels.length + ' labeled triples), argmax accuracy',
    floor_hit_rate: labels.length > 0 ? best.hits / labels.length : null,
  };
}

// ---------------------------------------------------------------------------
// --offline-seed: LOCAL sources only (data/framework-names.json's
// already-shipped snapshot + data/command-registry.json), zero network.
// Explicitly lower quality than jev-scored -- the fallback path used when
// no TYPESAFE_API_KEY is available, matching the sibling's own
// offline-seed honesty. Every row: confidence: null, source: 'offline-seed'.
// ---------------------------------------------------------------------------
function buildOfflineSeedLedger() {
  // eslint-disable-next-line global-require
  const { readRepoVersion } = require(path.join(ROOT, 'lib', 'core', 'repo-version.cjs'));
  const candidateMap = buildCandidateMap();

  let frameworkNames = [];
  try {
    // eslint-disable-next-line global-require
    const fnData = require(FRAMEWORK_NAMES_PATH);
    frameworkNames = Array.isArray(fnData.framework_names) ? fnData.framework_names : [];
  } catch (_e) { /* leave empty: no local framework-names snapshot available */ }

  const rows = {};
  for (const name of frameworkNames) {
    const lname = name.toLowerCase();
    if (!lname) continue;
    const matches = [];
    for (const cand of candidateMap) {
      const teaching = String((cand.commandRow && cand.commandRow.teaching) || '').toLowerCase();
      const jtbdSummary = String((cand.commandRow && cand.commandRow.jtbd_summary) || '').toLowerCase();
      const hit = (teaching && teaching.includes(lname))
        || (jtbdSummary && jtbdSummary.includes(lname))
        || lname.includes(cand.command_id);
      if (hit) {
        matches.push({ command_id: cand.command_id, score: 1, confidence: null, source: 'offline-seed' });
      }
    }
    if (matches.length > 0) rows[name] = matches;
  }

  const version = readRepoVersion();
  return {
    built_at: new Date().toISOString(),
    build_mode: 'offline-seed',
    plugin_version: version.version,
    theo_frameworks: 0,
    jev_model: null,
    confidence_floor: null,
    floor_basis: 'not calibrated: offline-seed build carries no vendor confidence',
    floor_hit_rate: null,
    wall_ms: 0,
    jev_calls: 0,
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost_usd: 0,
    cost_basis: 'vendor-claimed rate, unverified',
    rows: rows,
  };
}

// ---------------------------------------------------------------------------
// --jev-fixture <path>: deterministic scoring path, zero network. Fixture
// shape: { model, usage: { input_tokens_per_call, output_tokens_per_call },
// rows: { "<framework name>": [{ command_id, score, confidence }, ...] } }.
// ---------------------------------------------------------------------------
function buildWithJevFixture(fixturePath) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  // eslint-disable-next-line global-require
  const { readRepoVersion } = require(path.join(ROOT, 'lib', 'core', 'repo-version.cjs'));
  const candidateMap = buildCandidateMap();
  const known = new Set(candidateMap.map((c) => c.command_id));

  let jevCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const rows = {};
  for (const [frameworkName, fixtureRows] of Object.entries(fixture.rows || {})) {
    jevCalls += 1;
    inputTokens += (fixture.usage && fixture.usage.input_tokens_per_call) || 500;
    outputTokens += (fixture.usage && fixture.usage.output_tokens_per_call) || 100;
    const scored = [];
    for (const fr of (fixtureRows || [])) {
      // Defense in depth (T-354-22): the candidate set was already scoped
      // to buildCandidateMap()'s KNOWN_METHODOLOGIES-live list; drop
      // anything outside it rather than trust the fixture file blindly.
      if (!fr || !known.has(fr.command_id)) continue;
      scored.push({ command_id: fr.command_id, score: fr.score, confidence: fr.confidence, source: 'jev-scored' });
    }
    scored.sort((a, b) => (b.score || 0) - (a.score || 0));
    if (scored.length > 0) rows[frameworkName] = scored;
  }

  const floorInfo = calibrateFloor(rows);
  const version = readRepoVersion();
  return {
    built_at: new Date().toISOString(),
    build_mode: 'jev-scored',
    plugin_version: version.version,
    theo_frameworks: Object.keys(rows).length,
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
}

// ---------------------------------------------------------------------------
// Default: pull Theo, score with Jev. Navigator-invoked only (R-353-G
// sibling convention). Outer loop = KNOWN_METHODOLOGIES-scoped commands
// (concurrency 4); each call batches up to 20 Theo FRAMEWORKS as candidates
// (the IP-sensitive entity the egress ceiling limits to name/jtbd/glossary),
// one Score question per framework candidate asking how well it fits the
// OUTER command as its right executable step.
// ---------------------------------------------------------------------------
async function buildJevScored() {
  const key = loadKey();
  if (!key) {
    console.error('build-framework-command-ledger: no TYPESAFE_API_KEY (checked process.env and ~/.secrets/typesafe.env). Writing nothing.');
    process.exit(3);
  }
  const t0 = Date.now();
  const frameworks = await pullTheoFrameworks();
  const candidateMap = buildCandidateMap();

  // eslint-disable-next-line global-require
  const { readRepoVersion } = require(path.join(ROOT, 'lib', 'core', 'repo-version.cjs'));

  let jevCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let model = MODEL;
  const rows = {};

  await pool(candidateMap, CONC, async (cand) => {
    const batches = [];
    for (let i = 0; i < frameworks.length; i += BATCH) batches.push(frameworks.slice(i, i + BATCH));
    for (const batch of batches) {
      const state = { candidates: {} };
      batch.forEach((f, j) => {
        state.candidates['f' + j] = {
          name: f.name,
          jtbd: jtbdStatement(f.jtbd_anchor) || f.jtbd_anchor || '',
          glossary: glossaryLine(f) || '',
        };
      });
      const questions = {};
      batch.forEach((f, j) => {
        questions['f' + j] = {
          type: 'score',
          instructions: { judge: 'How well does the framework at `candidates.f' + j + '` fit as the right executable step for the command `/mos:' + cand.command_id + '`?' },
          criteria: [
            "not a fit for this command's job",
            'plausible but not the framework this command is built for',
            'this command is the right executable step for this framework',
          ],
        };
      });
      const body = { model: MODEL, state: state, questions: questions };
      // eslint-disable-next-line no-await-in-loop
      const r = await jev(key, body);
      if (r.status !== 200 || !r.json) continue;
      model = r.json.model || model;
      jevCalls += 1;
      inputTokens += (r.json.usage || {}).input_tokens || 0;
      outputTokens += (r.json.usage || {}).output_tokens || 0;
      batch.forEach((f, j) => {
        const a = r.json.answers && r.json.answers['f' + j];
        if (!a) return;
        const target = rows[f.name] || [];
        const existing = target.find((x) => x.command_id === cand.command_id);
        if (existing) {
          existing.score = a.score;
          existing.confidence = a.confidence;
        } else {
          target.push({ command_id: cand.command_id, score: a.score, confidence: a.confidence, source: 'jev-scored' });
        }
        rows[f.name] = target.sort((x, y) => (y.score || 0) - (x.score || 0));
      });
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
  console.log('framework-command-ledger: wrote ' + Object.keys(rows).length + ' framework rows, ' + frameworks.length + ' Theo frameworks, model ' + model);
}

// ---------------------------------------------------------------------------
// --check: ZERO network calls. Never requires brain-client.cjs's Theo path
// (only brain-router.cjs's live, local KNOWN_METHODOLOGIES export).
// ---------------------------------------------------------------------------
function runCheck() {
  // eslint-disable-next-line global-require
  const { readRepoVersion } = require(path.join(ROOT, 'lib', 'core', 'repo-version.cjs'));
  let ledger;
  try {
    ledger = require(LEDGER_PATH);
  } catch (e) {
    console.error('framework-command-ledger: FAILED (cannot parse ' + LEDGER_PATH + ': ' + e.message + ')');
    return false;
  }
  // eslint-disable-next-line global-require
  const brainRouter = require(BRAIN_ROUTER_PATH);
  const known = new Set(Array.isArray(brainRouter.KNOWN_METHODOLOGIES) ? brainRouter.KNOWN_METHODOLOGIES : []);

  const version = readRepoVersion();
  if (ledger.plugin_version !== version.version) {
    console.error('framework-command-ledger: FAILED (plugin_version drift: ledger=' + ledger.plugin_version + ' repo=' + version.version + ')');
    return false;
  }
  const builtAt = Date.parse(ledger.built_at);
  if (Number.isNaN(builtAt)) {
    console.error('framework-command-ledger: FAILED (built_at is not a valid ISO string: ' + ledger.built_at + ')');
    return false;
  }
  const ageMs = Date.now() - builtAt;
  for (const [frameworkName, rowsForFramework] of Object.entries(ledger.rows || {})) {
    if (!Array.isArray(rowsForFramework)) {
      console.error('framework-command-ledger: FAILED (rows["' + frameworkName + '"] is not an array)');
      return false;
    }
    for (const row of rowsForFramework) {
      if (!row || typeof row.command_id !== 'string' || !known.has(row.command_id)) {
        console.error('framework-command-ledger: FAILED (unscoped or malformed command_id "' + (row && row.command_id) + '" under framework "' + frameworkName + '")');
        return false;
      }
    }
  }
  console.log('framework-command-ledger: OK (built ' + Math.round(ageMs / 86400000) + ' day(s) ago, mode=' + ledger.build_mode + ', ' + Object.keys(ledger.rows || {}).length + ' framework rows)');
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
    console.log('framework-command-ledger: wrote offline-seed ledger');
    return;
  }

  const fixtureIdx = argv.indexOf('--jev-fixture');
  if (fixtureIdx !== -1) {
    const fixturePath = argv[fixtureIdx + 1];
    if (!fixturePath) {
      console.error('build-framework-command-ledger: --jev-fixture requires a path');
      process.exit(1);
    }
    writeLedger(buildWithJevFixture(fixturePath));
    console.log('framework-command-ledger: wrote jev-fixture-scored ledger');
    return;
  }

  buildJevScored().catch((e) => {
    console.error('build-framework-command-ledger: ' + (e && e.stack || e));
    process.exit(1);
  });
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    LEDGER_PATH,
    COMMAND_REGISTRY_PATH,
    FRAMEWORK_NAMES_PATH,
    LABELS_FIXTURE_PATH,
    assertEgressCeiling,
    jev,
    pool,
    pullTheoFrameworks,
    jtbdStatement,
    glossaryLine,
    buildCandidateMap,
    calibrateFloor,
    serializeLedger,
    buildOfflineSeedLedger,
    buildWithJevFixture,
    buildJevScored,
    runCheck,
    main,
  };
}
