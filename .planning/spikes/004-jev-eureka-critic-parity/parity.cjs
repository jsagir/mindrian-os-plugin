'use strict';
/*
 * Spike 004: jev-eureka-critic-parity.
 *
 * eureka_critic (lib/core/eureka-critic.cjs criticRule) takes an 8-key payload of
 * quantized scalars + closed enums and returns one of four verdicts. The verdict is
 * computed BY CODE from the six rubric booleans (verdictFromRubric): the model never
 * picks the class. This spike asks whether Jev can hold that closed-enum policy from
 * typed state alone -- the property needed before Jev sits on any Theo-side judgment
 * seat -- by running all 64 [01]^6 rubric patterns through Jev twice:
 *   Variant R (rule stated): the decision rule is in the question instructions.
 *   Variant N (no rule): only the rubric items and their answers, plus verdict glosses.
 * Agreement is measured against criticRule's verdictFromRubric. Canon Part 8: the
 * payload IS the Part-8-clean packet the MCP tool already accepts; no room content.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.join(__dirname, '..', '..', '..');
const critic = require(path.join(ROOT, 'lib', 'core', 'eureka-critic.cjs'));
const tags = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'eureka-critic-tags.json'), 'utf8'));
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';

function loadKey() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  try {
    const raw = fs.readFileSync(path.join(os.homedir(), '.secrets', 'typesafe.env'), 'utf8');
    const m = raw.match(/^TYPESAFE_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch (_) { /* fall through */ }
  return null;
}

const VERDICTS = tags.verdicts; // ['transferable','restatement','pseudoscience','general_shallow']
const GLOSS = {
  transferable: 'a genuine cross-domain transfer: schema statable without either domain nouns, elements map one-to-one, mechanism yields a checkable consequence, adds over prior knowledge, not a paraphrase, no unsourced quantities',
  restatement: 'the same idea with the vocabulary swapped: a paraphrase of the source in the target domain terms',
  pseudoscience: 'carries an unsourced quantity or statistic, or the stated mechanism yields nothing a reader could check',
  general_shallow: 'generic or shallow: adds nothing over the nearest prior knowledge, or the element mapping has orphans',
};
const RULE = 'Decision rule, apply in this order: if item f is no OR item c is no -> pseudoscience; else if item e is no -> restatement; else if item d is no -> general_shallow; else if items a, b and c are all yes -> transferable; else general_shallow.';

function itemsFromPattern(p) { const o = {}; 'abcdef'.split('').forEach((k, i) => { o[k] = p[i] === '1'; }); return o; }

function stateFor(pattern) {
  const items = itemsFromPattern(pattern);
  const rubric = {};
  critic.RUBRIC_ITEMS.forEach((it) => { rubric[it.id] = { question: it.question, answer: items[it.id] ? 'yes' : 'no' }; });
  return {
    rubric_items: rubric,
    differential_score: 0.6, semantic_similarity: 0.4, lsa_similarity: 0.3,
    surprise_type: 'structural_transfer', source_domain_tag: 'engineering', target_domain_tag: 'biology',
  };
}

function question(withRule) {
  const criteria = {}; VERDICTS.forEach((v) => { criteria[v] = GLOSS[v]; });
  return {
    type: 'choice',
    instructions: withRule
      ? { judge: 'Which verdict does this candidate cross-domain claim receive, given the six rubric answers in `rubric_items`?', rule: RULE }
      : { judge: 'Which verdict does this candidate cross-domain claim receive, given the six rubric answers in `rubric_items`?' },
    criteria: criteria,
  };
}

async function jev(key, body) {
  const t0 = Date.now();
  const r = await fetch(ENDPOINT, { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (_) {}
  return { status: r.status, ms: Date.now() - t0, json: json };
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { for (;;) { const k = i++; if (k >= items.length) return; out[k] = await fn(items[k], k); } }));
  return out;
}

async function main() {
  const key = loadKey();
  if (!key) { console.error('no TYPESAFE_API_KEY'); process.exit(3); }
  const patterns = []; for (let i = 0; i < 64; i++) patterns.push(i.toString(2).padStart(6, '0'));
  const expected = {}; patterns.forEach((p) => { expected[p] = critic.criticRule({ differential_score: 0.6, semantic_similarity: 0.4, lsa_similarity: 0.3, surprise_type: 'structural_transfer', source_domain_tag: 'engineering', target_domain_tag: 'biology', rubric_pattern: p, schema_version: tags.schema_version }).verdict; });
  const dist = {}; Object.values(expected).forEach((v) => { dist[v] = (dist[v] || 0) + 1; });
  console.log('code verdict distribution over 64 patterns: ' + JSON.stringify(dist));

  const out = { started: new Date().toISOString(), expected_distribution: dist, variants: {} };
  for (const [name, withRule] of [['R_rule_stated', true], ['N_no_rule', false]]) {
    const usage = { input_tokens: 0, output_tokens: 0 };
    const rows = await pool(patterns, 6, async (p) => {
      const r = await jev(key, { model: MODEL, state: stateFor(p), questions: { verdict: question(withRule) } });
      if (r.status !== 200 || !r.json) return { pattern: p, expected: expected[p], got: null, status: r.status, ms: r.ms };
      usage.input_tokens += (r.json.usage || {}).input_tokens || 0; usage.output_tokens += (r.json.usage || {}).output_tokens || 0;
      const a = r.json.answers.verdict;
      return { pattern: p, expected: expected[p], got: a.choice, confidence: a.confidence, p_expected: a.probabilities[expected[p]], ms: r.ms, status: 200 };
    });
    const ok = rows.filter((x) => x.got === x.expected).length;
    const confusion = {}; rows.forEach((x) => { const k = x.expected + '->' + x.got; confusion[k] = (confusion[k] || 0) + 1; });
    const confAgree = rows.filter((x) => x.got === x.expected).map((x) => x.confidence);
    const confDis = rows.filter((x) => x.got && x.got !== x.expected).map((x) => x.confidence);
    const mean = (xs) => xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
    const perVerdict = {}; VERDICTS.forEach((v) => { const rs = rows.filter((x) => x.expected === v); perVerdict[v] = { n: rs.length, agree: rs.filter((x) => x.got === v).length }; });
    out.variants[name] = { agreement: ok / rows.length, agree: ok, n: rows.length, per_verdict: perVerdict, confusion: confusion, conf_when_agree: mean(confAgree), conf_when_disagree: mean(confDis), usage: usage, ms_p50: rows.map((x) => x.ms).sort((a, b) => a - b)[Math.floor(rows.length / 2)], rows: rows };
    console.log(name + ': agreement ' + ok + '/' + rows.length + ' (' + (100 * ok / rows.length).toFixed(0) + '%) per-verdict=' + JSON.stringify(perVerdict) + ' conf agree=' + (mean(confAgree) || 0).toFixed(2) + ' disagree=' + (mean(confDis) || 0).toFixed(2) + ' tokens=' + JSON.stringify(usage));
    const wrong = Object.entries(confusion).filter(([k]) => k.split('->')[0] !== k.split('->')[1]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log('   top confusions: ' + wrong.map(([k, n]) => k + ' x' + n).join(' | '));
  }
  out.finished = new Date().toISOString();
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(out, null, 2));
  console.log('-> results.json');
}

main().catch((e) => { console.error('spike error: ' + (e && e.stack || e)); process.exit(1); });
