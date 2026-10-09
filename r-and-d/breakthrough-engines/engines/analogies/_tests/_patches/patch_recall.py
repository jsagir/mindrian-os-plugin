p='lib/core/research-planner/perspectives/analogies-recall.cjs'
s=open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1,(old[:50],s.count(old))
    s=s.replace(old,new)
rep("""// lexical_ceiling: a pair above it shares words, so it is a eureka pair, not an analogy.
const BUDGETS = Object.freeze({ max_candidates: 100, max_leaves: 8, lexical_ceiling: 0.15 });""","""// lexical_ceiling: a pair above it shares words, so it is a eureka pair, not an analogy.
// lexical_mode (2026): 'fixed' (default) applies lexical_ceiling as is. 'percentile' also requires the
// pair to sit in the lowest lexical_percentile of the signal-bearing pool (never looser than the fixed
// ceiling), which adapts to a room whose wording overlaps more or less than the 0.15 calibration;
// it needs lexical_min_pool pairs, else it silently equals 'fixed' (reported in counts.lexical_mode).
const BUDGETS = Object.freeze({
  max_candidates: 100, max_leaves: 8, lexical_ceiling: 0.15,
  lexical_mode: 'fixed', lexical_percentile: 0.25, lexical_min_pool: 8,
});""")
rep("""function frameworksByThing(substrate) {
  const out = {};
  substrate.edges.forEach(function (e) {""","""function frameworksByThing(substrate) {
  const out = {};
  const fnodes = (substrate && substrate.framework_nodes) || {};
  ((substrate && substrate.edges) || []).forEach(function (e) {""")
rep("""    if (e.type !== 'USES_FRAMEWORK' || !substrate.framework_nodes[e.target]) return;""","""    if (!e || e.type !== 'USES_FRAMEWORK' || !fnodes[e.target]) return;""")

a=s.index("function recallCandidates(substrate, roomDir, budgets) {")
b=s.index("// ---------------------------------------------------------------------------\n// run files")
s=s[:a]+"""function lexicalQuantile(values, q) {
  const v = values.filter(Number.isFinite).sort(function (x, y) { return x - y; });
  if (!v.length) return NaN;
  const pos = (v.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos); const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

function lexicalPercentile(values, x) {
  const v = values.filter(Number.isFinite);
  if (!v.length || !Number.isFinite(x)) return 0;
  let less = 0; let equal = 0;
  v.forEach(function (y) { if (y < x) less += 1; else if (y === x) equal += 1; });
  return (less + 0.5 * equal) / v.length;
}

function recallCandidates(substrate, roomDir, budgets) {
  const B = Object.assign({}, BUDGETS, budgets || {});
  const cap = Number.isFinite(B.max_candidates) && B.max_candidates >= 0 ? Math.floor(B.max_candidates) : BUDGETS.max_candidates;
  // The pool is the eureka recall at the eureka cap; this module's own cap is applied after the filter.
  const pool = eurekaRecall.recallCandidates(substrate, roomDir, { max_candidates: eurekaRecall.BUDGETS.max_candidates });
  const fw = frameworksByThing(substrate);
  let droppedLexical = 0;
  let droppedNoSignal = 0;
  const signalled = [];
  pool.candidates.forEach(function (c) {
    const fa = fw[c.a] || []; const fb = fw[c.b] || [];
    const sharedFw = fa.filter(function (id) { return fb.indexOf(id) !== -1; }).sort();
    const entities = Array.isArray(c.shared_entities) ? c.shared_entities : [];
    const signal = entities.length + sharedFw.length;
    if (signal === 0) { droppedNoSignal += 1; return; }
    signalled.push({ c: c, sharedFw: sharedFw, signal: signal, entities: entities });
  });
  // Effective lexical ceiling: the fixed ceiling, tightened (never loosened) by the pool percentile when asked.
  const lexVals = signalled.map(function (x) { return x.c.lexical; });
  let ceiling = B.lexical_ceiling;
  let lexMode = 'fixed';
  if (B.lexical_mode === 'percentile' && lexVals.filter(Number.isFinite).length >= B.lexical_min_pool) {
    const qv = lexicalQuantile(lexVals, B.lexical_percentile);
    if (Number.isFinite(qv)) { ceiling = Math.min(B.lexical_ceiling, qv); lexMode = 'percentile'; }
  }
  const kept = [];
  signalled.forEach(function (x) {
    const c = x.c;
    if (c.lexical > ceiling) { droppedLexical += 1; return; }
    const row = Object.assign({}, c, { lanes: (c.lanes || []).slice(), shared_entities: x.entities.slice() });
    if (row.lanes.indexOf('structural') === -1) row.lanes.push('structural');
    row.shared_frameworks = x.sharedFw;
    row._signal = x.signal;
    row.lexical_percentile = lexicalPercentile(lexVals, c.lexical);
    kept.push(row);
  });
  // Most relational signal first; among equals the pair with the LEAST shared wording first (2026), then ids.
  kept.sort(function (x, y) {
    const lx = Number.isFinite(x.lexical) ? x.lexical : 1; const ly = Number.isFinite(y.lexical) ? y.lexical : 1;
    return (y._signal - x._signal) || (lx - ly) || (x.a < y.a ? -1 : (x.a > y.a ? 1 : 0)) || (x.b < y.b ? -1 : (x.b > y.b ? 1 : 0));
  });
  const truncated = Math.max(0, kept.length - cap);
  const list = kept.slice(0, cap);
  list.forEach(function (r) { delete r._signal; });
  const counts = {
    things: pool.counts.things,
    sections: pool.counts.sections,
    canon_resolved: pool.counts.canon_resolved,
    known_pairs: pool.counts.known_pairs,
    excluded_known: pool.counts.excluded_known,
    eureka_pool: pool.candidates.length,
    dropped_no_relational_signal: droppedNoSignal,
    dropped_lexical_above_ceiling: droppedLexical,
    structural: kept.length,
    candidates: list.length,
    lexical_mode: lexMode,
    lexical_ceiling_used: ceiling,
  };
  return { candidates: list, counts: counts, pairs_truncated: truncated, couplings: pool.couplings };
}

"""+s[b:]
rep("""  const base = eurekaRecall.questionSetFor(recall, substrate, { max_leaves: maxLeaves, tag: tag });""","""  const base = eurekaRecall.questionSetFor(recall, substrate, { max_leaves: maxLeaves, tag: tag });
  if (!base || !Array.isArray(base.leaves)) throw new Error('analogies-recall: eureka questionSetFor returned no leaves');""")
rep("""  const secs = recall.candidates.slice(0, maxLeaves).map(function (c) { return c.section_a + ' and ' + c.section_b; });""","""  const secs = recall.candidates.slice(0, maxLeaves).map(function (c) { return c.section_a + ' and ' + c.section_b; });
  const nThings = (substrate.things || []).length; const nSections = (substrate.sections || []).length;""")
rep("""'The room holds ' + substrate.things.length + ' things across ' + substrate.sections.length + ' sections;""","""'The room holds ' + nThings + ' things across ' + nSections + ' sections;""")
open(p,'w',encoding='utf-8').write(s)
