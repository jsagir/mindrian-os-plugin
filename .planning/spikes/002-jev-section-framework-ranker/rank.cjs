'use strict';
/*
 * Spike 002: jev-section-framework-ranker.
 *
 * Question: given a room section + problem type + stage, can Jev rank Theo's
 * frameworks by first-move fit better than graph degree, over the FULL Theo
 * framework set (not just the 27 that carry a /mos: command)?
 *
 * Variant A: one call per (scenario, batch of K frameworks), one Score question
 *            per framework over a shared state. Fewer calls, shared context.
 * Variant B: one call per (scenario, framework) pair, the rerank-cookbook shape,
 *            run only over the 27 hand-labeled frameworks for a head-to-head.
 *
 * Canon Part 8: state carries framework names + Theo descriptions + scenario
 * enums. Zero room content. Frameworks are pulled through the plugin's own
 * brain-client (governed path), never a second wire.
 * Key: process.env.TYPESAFE_API_KEY else ~/.secrets/typesafe.env, never printed.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.join(__dirname, '..', '..', '..');
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const BATCH = parseInt(process.env.SPIKE_BATCH || '20', 10);
const CONC = parseInt(process.env.SPIKE_CONC || '4', 10);
// What crosses to TypeSafe about each framework. Theo descriptions are Mindrian
// IP (CLAUDE.md: served via MCP, never distributed); the default keeps them home.
//   ruling -> name + JTBD statement + glossary line (navigator ruling 2026-09-17; DEFAULT).
//             JTBD statement = the plugin's statement for f.jtbd_anchor when a map exists,
//             else the raw anchor label (a closed-set enum). Glossary = f.definition when
//             present, else the first sentence of the description capped at 140 chars.
//   none   -> framework name only (Jev judges from its own knowledge of the name)
//   short  -> name + first 100 chars of the Theo description
//   full   -> name + full Theo description (navigator-authorized egress only)
const DESC_MODE = (process.env.SPIKE_DESC || 'ruling').toLowerCase();
// f.jtbd_anchor on a Theo Framework node is a member of the Brain's closed job
// vocabulary (brain-client.cjs SHIPPED_JOBS), not a sentence. Rendered here as
// the job a navigator hires the framework for. Generic handles only.
let JTBD_MAP = {
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
  REVIEW_REQUIRED: '',
};
for (const p of (process.env.SPIKE_JTBD_MAP ? [process.env.SPIKE_JTBD_MAP] : [])) {
  try { JTBD_MAP = Object.assign({}, JTBD_MAP, JSON.parse(fs.readFileSync(p, 'utf8'))); } catch (_) { /* keep default */ }
}
function jtbdStatement(anchor) {
  if (!anchor) return '';
  if (JTBD_MAP && typeof JTBD_MAP[anchor] === 'string') return JTBD_MAP[anchor];
  if (JTBD_MAP && JTBD_MAP[anchor] && typeof JTBD_MAP[anchor] === 'object') return JTBD_MAP[anchor].statement || JTBD_MAP[anchor].summary || JTBD_MAP[anchor].label || anchor;
  return anchor;
}
function glossaryLine(f) {
  if (f.definition) return f.definition.slice(0, 140);
  const d = (f.description || '').replace(/\s+/g, ' ').trim();
  if (!d || /^PWS methodology framework:/i.test(d)) return '';
  const first = d.split(/(?<=[.!?])\s/)[0] || d;
  return first.slice(0, 140);
}
function describe(f) {
  if (DESC_MODE === 'full') return f.description || '(no description on record)';
  if (DESC_MODE === 'short') return (f.description || '').slice(0, 100) || '(no description on record)';
  if (DESC_MODE === 'ruling') {
    const j = jtbdStatement(f.jtbd_anchor); const g = glossaryLine(f);
    return { jtbd: j || '(no JTBD anchor on record)', glossary: g || '(no glossary line on record)' };
  }
  return '(judge from the framework name)';
}
const VENDOR_USD_PER_INPUT_TOKEN = 42 / 1e9; // vendor-claimed, unverified

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf8'));
const connector = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'connector-registry.json'), 'utf8'));
const DEGREE = {};
for (const [name, refs] of Object.entries(connector.framework_index || {})) {
  DEGREE[name] = refs.filter((x) => String(x).startsWith('/mos:')).length;
}

function loadKey() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  try {
    const raw = fs.readFileSync(path.join(os.homedir(), '.secrets', 'typesafe.env'), 'utf8');
    const m = raw.match(/^TYPESAFE_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch (_) { /* fall through */ }
  return null;
}

const events = [];
function log(cat, data) { events.push(Object.assign({ ts: new Date().toISOString(), cat: cat }, data)); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jev(key, body, label) {
  let attempt = 0;
  for (;;) {
    const t0 = Date.now();
    let r;
    try {
      r = await fetch(ENDPOINT, { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch (e) {
      log('network_error', { label: label, message: e.message, attempt: attempt });
      if (attempt++ < 3) { await sleep(500 * 2 ** attempt); continue; }
      return { status: 0, ms: Date.now() - t0, json: null };
    }
    const ms = Date.now() - t0;
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (_) {}
    log('response', { label: label, status: r.status, ms: ms, usage: json && json.usage, attempt: attempt });
    if ((r.status === 429 || r.status === 529) && attempt++ < 4) { await sleep(400 * 2 ** attempt); continue; }
    return { status: r.status, ms: ms, json: json, text: text.slice(0, 200) };
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { for (;;) { const k = i++; if (k >= items.length) return; out[k] = await fn(items[k], k); } }));
  return out;
}

const LEVELS = [
  'poor fit as a first move: premature, off-section, or answers a question this stage is not asking',
  'partial fit: useful as a later or supporting move once the first move has landed',
  'strong fit: a right first move for exactly this section, problem type and stage',
];

function scoreQuestion(id) {
  return {
    type: 'score',
    instructions: { judge: 'How well does the framework at `candidates.' + id + '` fit as the FIRST move for the room described by `section`, `problem_type` and `stage`?', note: 'Judge fit-as-first-move, not general usefulness. A famous framework can be a poor first move here.' },
    criteria: LEVELS,
  };
}

async function pullTheoFrameworks() {
  const brain = require(path.join(ROOT, 'lib', 'core', 'brain-client.cjs'));
  // Theo enforces ROW_CAP=100 and an over-cap query returns ONLY a text notice
  // ({text:"ROW_CAP: ..."}) with zero rows; SKIP is PLAN_REJECTED (not on the
  // read allow-list). Both observed 2026-09-17. So: bucket by name range and
  // split a bucket on a cap hit.
  // A range predicate on the indexed name becomes NodeUniqueIndexSeekByRange,
  // also rejected. A FUNCTION-wrapped predicate forces NodeByLabelScan + Filter,
  // both on the allow-list (Theo src/mcp/content/find-frameworks-for-problem-type.ts).
  // So: bucket by lower-cased first character (largest bucket observed: 47 rows).
  // Working set = not an alias and not explicitly non-canonical. coalesce() keeps the
  // predicate a Filter (an OR with IS NULL plans a Distinct, which is rejected).
  // Two FIXED query texts; every variation rides in $params. The substrate rule m4
  // forbids Cypher assembled by concatenation, and this is exactly why it exists.
  const rows = [];
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
  const alnum = '0123456789abcdefghijklmnopqrstuvwxyz'.split('');
  async function bucket(prefix, depth) {
    const res = await brain.query(CYPHER_PREFIX, { n: prefix.length, prefix: prefix });
    const page = (res && (res.rows || res.records)) || [];
    if (page.length === 0 && res && res.text && /ROW_CAP/.test(String(res.text))) {
      if (depth >= 2) { log('theo_row_cap_unsplit', { bucket: prefix }); return; }
      for (const c of alnum) await bucket(prefix + c, depth + 1);
      return;
    }
    if (page.length === 0 && res && res.text) log('theo_text_only', { bucket: prefix, text: String(res.text).slice(0, 120) });
    rows.push.apply(rows, page);
  }
  for (const c of alnum) await bucket(c, 0);
  {
    const res = await brain.query(CYPHER_OTHER, { alnum: alnum });
    const page = (res && (res.rows || res.records)) || [];
    if (page.length === 0 && res && res.text) log('theo_text_only', { bucket: 'other', text: String(res.text).slice(0, 120) });
    rows.push.apply(rows, page);
  }
  const seen = new Set();
  const list = [];
  for (const r of rows) {
    const name = String(r.name || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const description = String(r.description || '').trim();
    const stub = description.length === 0 || /^PWS methodology framework:/i.test(description);
    list.push({ name: name, description: description, stub: stub, jtbd_anchor: String(r.jtbd_anchor || '').trim(), definition: String(r.definition || '').trim() });
  }
  return list;
}

function rankAvg(values) {
  const idx = values.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < idx.length) {
    let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k][1]] = r;
    i = j + 1;
  }
  return ranks;
}
function spearman(a, b) {
  const ra = rankAvg(a), rb = rankAvg(b);
  const n = a.length; const ma = ra.reduce((s, x) => s + x, 0) / n; const mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return (da && db) ? num / Math.sqrt(da * db) : 0;
}
const mean = (xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;

async function main() {
  const key = loadKey();
  if (!key) { console.error('no TYPESAFE_API_KEY'); process.exit(3); }
  const started = new Date().toISOString();

  // 1. Pull Theo's frameworks (governed path).
  const t0 = Date.now();
  const frameworks = await pullTheoFrameworks();
  const stubs = frameworks.filter((f) => f.stub).length;
  console.log('theo frameworks: ' + frameworks.length + ' (stub/empty description: ' + stubs + ') in ' + (Date.now() - t0) + ' ms');
  fs.writeFileSync(path.join(__dirname, 'theo-frameworks.json'), JSON.stringify(frameworks, null, 1));
  const labeled = Object.keys(fixture.labels);
  const missing = labeled.filter((n) => !frameworks.find((f) => f.name === n));
  if (missing.length) console.log('labeled frameworks NOT in Theo by exact name: ' + JSON.stringify(missing));

  console.log('description mode crossing to TypeSafe: ' + DESC_MODE);
  const out = { started: started, model: null, desc_mode: DESC_MODE, frameworks: frameworks.length, stub_descriptions: stubs, batch: BATCH, scenarios: {}, usage: { A: { input_tokens: 0, output_tokens: 0, calls: 0 }, B: { input_tokens: 0, output_tokens: 0, calls: 0 } } };

  for (const [sid, sc] of Object.entries(fixture.scenarios)) {
    const state0 = { section: sc.section, problem_type: sc.problem_type, stage: sc.stage };
    // ---- Variant A: batched scores over the full set ----
    const batches = [];
    for (let i = 0; i < frameworks.length; i += BATCH) batches.push(frameworks.slice(i, i + BATCH));
    const tA = Date.now();
    const scoresA = {};
    await pool(batches, CONC, async (batch, bi) => {
      const candidates = {}; const questions = {};
      batch.forEach((f, j) => { const id = 'f' + j; candidates[id] = { name: f.name, description: describe(f) }; questions[id] = scoreQuestion(id); });
      const body = { model: MODEL, state: Object.assign({}, state0, { candidates: candidates }), questions: questions };
      const r = await jev(key, body, sid + '_A_b' + bi);
      if (r.status !== 200 || !r.json) { log('batch_failed', { label: sid + '_A_b' + bi, status: r.status, body: r.text }); return; }
      out.model = r.json.model || out.model;
      out.usage.A.calls++; out.usage.A.input_tokens += (r.json.usage || {}).input_tokens || 0; out.usage.A.output_tokens += (r.json.usage || {}).output_tokens || 0;
      batch.forEach((f, j) => { const a = r.json.answers['f' + j]; if (a) scoresA[f.name] = { score: a.score, confidence: a.confidence, probabilities: a.probabilities }; });
    });
    const wallA = Date.now() - tA;

    // ---- Variant B: one pair per call, labeled 27 only ----
    const tB = Date.now();
    const scoresB = {};
    await pool(labeled, Math.max(CONC, 6), async (name) => {
      const f = frameworks.find((x) => x.name === name) || { name: name, description: '' };
      const body = { model: MODEL, state: Object.assign({}, state0, { candidates: { f0: { name: f.name, description: describe(f) } } }), questions: { f0: scoreQuestion('f0') } };
      const r = await jev(key, body, sid + '_B_' + name.slice(0, 12));
      if (r.status !== 200 || !r.json) return;
      out.usage.B.calls++; out.usage.B.input_tokens += (r.json.usage || {}).input_tokens || 0; out.usage.B.output_tokens += (r.json.usage || {}).output_tokens || 0;
      const a = r.json.answers.f0; if (a) scoresB[name] = { score: a.score, confidence: a.confidence };
    });
    const wallB = Date.now() - tB;

    // ---- Metrics over the labeled 27 ----
    const L = labeled.filter((n) => scoresA[n]);
    const lab = L.map((n) => fixture.labels[n][sid]);
    const jA = L.map((n) => scoresA[n].score);
    const jB = L.map((n) => (scoresB[n] ? scoresB[n].score : 0));
    const deg = L.map((n) => DEGREE[n] || 0);
    const top5 = (vals) => L.map((n, i) => [n, vals[i]]).sort((a, b) => b[1] - a[1]).slice(0, 5).filter(([n]) => fixture.labels[n][sid] === 2).length;
    const confClear = mean(L.filter((n, i) => lab[i] !== 1).map((n) => scoresA[n].confidence));
    const confUnclear = mean(L.filter((n, i) => lab[i] === 1).map((n) => scoresA[n].confidence));
    const stubNames = frameworks.filter((f) => f.stub && scoresA[f.name]).map((f) => f.name);
    const descNames = frameworks.filter((f) => !f.stub && scoresA[f.name]).map((f) => f.name);
    const metrics = {
      n_labeled: L.length,
      spearman_jev: spearman(jA, lab), spearman_jev_B: spearman(jB, lab), spearman_degree: spearman(deg, lab), spearman_A_vs_B: spearman(jA, jB),
      top5_jev: top5(jA), top5_jev_B: top5(jB), top5_degree: top5(deg),
      conf_clear: confClear, conf_unclear: confUnclear,
      conf_stub_desc: mean(stubNames.map((n) => scoresA[n].confidence)), conf_with_desc: mean(descNames.map((n) => scoresA[n].confidence)),
      score_stub_desc: mean(stubNames.map((n) => scoresA[n].score)), score_with_desc: mean(descNames.map((n) => scoresA[n].score)),
    };
    const ranked = L.map((n) => ({ framework: n, score: scoresA[n].score, confidence: scoresA[n].confidence, score_B: scoresB[n] ? scoresB[n].score : null, label: fixture.labels[n][sid], degree: DEGREE[n] || 0 })).sort((a, b) => b.score - a.score);
    const fullTop = Object.entries(scoresA).map(([n, v]) => ({ framework: n, score: v.score, confidence: v.confidence, in_index: Object.prototype.hasOwnProperty.call(DEGREE, n), stub: !!(frameworks.find((f) => f.name === n) || {}).stub })).sort((a, b) => b.score - a.score || b.confidence - a.confidence).slice(0, 12);
    out.scenarios[sid] = { variant: 'A batched ' + BATCH + ' / B per-pair', wall_ms: wallA, wall_ms_B: wallB, usage: { input_tokens: out.usage.A.input_tokens, output_tokens: out.usage.A.output_tokens }, metrics: metrics, ranked: ranked, top_full: fullTop, scored: Object.keys(scoresA).length };
    console.log(sid + ' ' + sc.section + ': scored ' + Object.keys(scoresA).length + '/' + frameworks.length + ' in ' + wallA + ' ms (A) + ' + wallB + ' ms (B)');
    console.log('   spearman jev=' + metrics.spearman_jev.toFixed(2) + ' jevB=' + metrics.spearman_jev_B.toFixed(2) + ' degree=' + metrics.spearman_degree.toFixed(2) + ' A~B=' + metrics.spearman_A_vs_B.toFixed(2) + ' | top5 hits jev=' + metrics.top5_jev + ' degree=' + metrics.top5_degree + ' | conf clear=' + confClear.toFixed(2) + ' unclear=' + confUnclear.toFixed(2) + ' | conf stub-desc=' + metrics.conf_stub_desc.toFixed(2) + ' with-desc=' + metrics.conf_with_desc.toFixed(2));
    console.log('   full-set top 8: ' + fullTop.slice(0, 8).map((x) => x.framework + (x.in_index ? '' : '*') + ' ' + x.score.toFixed(2)).join(' | '));
  }

  const allMs = events.filter((e) => e.cat === 'response' && e.status === 200).map((e) => e.ms).sort((a, b) => a - b);
  out.latency = { calls: allMs.length, p50_ms: allMs[Math.floor(allMs.length * 0.5)], p95_ms: allMs[Math.floor(allMs.length * 0.95)], max_ms: allMs[allMs.length - 1] };
  const inTok = out.usage.A.input_tokens + out.usage.B.input_tokens;
  out.cost_vendor_claimed_usd_input = inTok * VENDOR_USD_PER_INPUT_TOKEN;
  out.events = events;
  out.finished = new Date().toISOString();
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(out, null, 2));
  console.log('usage A=' + JSON.stringify(out.usage.A) + ' B=' + JSON.stringify(out.usage.B) + ' latency=' + JSON.stringify(out.latency) + ' input cost (vendor-claimed rate) $' + out.cost_vendor_claimed_usd_input.toFixed(4) + ' -> results.json');
}

main().catch((e) => { console.error('spike error: ' + (e && e.stack || e)); process.exit(1); });
