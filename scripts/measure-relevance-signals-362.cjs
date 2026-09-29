'use strict';
// scripts/measure-relevance-signals-362.cjs -- Phase 362 (CARD362-03, D-03).
//
// Dev-time only structured-signal measurement for the one known_false_block
// Phase 357 left open (dogfood-0f86dd63-092046). It measures every D-03
// candidate family against the committed replay corpus and names the smallest
// variant that clears the target with zero new misses, or proves none does:
//   C1 continuity-turn metadata (the low-signal token-count threshold),
//   C2 reach timing and consumption state,
//   C3 token provenance (extends the 357 D-08a F.1 chrome strip),
//   C4 relevance against the 359 declared options.
// Never evaluated, because they read meaning (D-03, 362-CONTEXT Deferred
// Ideas): any user-side word or phrase list (continuity cues), punctuation or
// question-shape tests, semantic similarity, any Jev or network call.
//
// Contract: dev-time only, never required from lib/ or hooks/. Zero network (a
// fetch thrower is installed for the whole run and restored in a finally).
// Reads only committed, sanitized fixtures and prints only their tokens.
// Requires nothing under tests/.
//
// Method: every corpus entry is replayed once on the CLI surface through the
// real harness (scripts/replay-card-fire.cjs runEntry) with classifyCardFire
// wrapped to capture the exact turn object it classified. Each variant is then
// a replacement for gateRelevance.gateTopicallyRelevant, and every captured
// turn is re-classified by the real classifyCardFire under it. The CLI hook and
// the MCP stop_gate_check share this predicate, so the verdict is the same on
// both surfaces. The BASE variant must reproduce every HEAD verdict exactly,
// otherwise the measurement is void (exit 2).
//
// Usage: node scripts/measure-relevance-signals-362.cjs [--json]
// Exit: 0 when the measurement completes (whatever the verdict), 2 on a corpus
// load error or a BASE reproduction failure.
//
// House rule: hyphens only, no em-dashes. CJS, node built-ins plus repo modules.

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const corpusLoader = require(path.join(REPO, 'scripts', 'card-fire-replay-corpus.cjs'));
const replay = require(path.join(REPO, 'scripts', 'replay-card-fire.cjs'));
const checkCardFire = require(path.join(REPO, 'scripts', 'check-card-fire.cjs'));
const gateRelevance = require(path.join(REPO, 'lib', 'core', 'gate-relevance.cjs'));
const forkDeclaration = require(path.join(REPO, 'lib', 'core', 'fork-declaration.cjs'));
const dialPresenter = require(path.join(REPO, 'lib', 'hmi', 'dial-presenter.cjs'));
const sidechannel = require(path.join(REPO, 'lib', 'core', 'card-fire-sidechannel.cjs'));

const DIAL_SRC = fs.readFileSync(path.join(REPO, 'lib', 'hmi', 'dial-presenter.cjs'), 'utf8');

const TARGET_ID = 'dogfood-0f86dd63-092046';
const ANTI_VACUITY_IDS = Object.freeze([
  '238:genuine-multiline-bracket-box:s2',
  '238:genuine-multiline-bracket-box:s3',
  '238:genuine-bulleted-bracket-box:s2',
  '238:genuine-bulleted-bracket-box:s3',
  '238:type-1-2-or-3-literal:s2',
  '238:type-1-2-or-3-literal:s3',
  '238:reconstructed-two-honest-paths-fork:s2',
  '238:reconstructed-two-honest-paths-fork:s3',
  'debug-intern-w1-labeled-fork',
  'debug-reach-gate-stale-turn-input',
  'debug-carveout-skill-meta-after-human',
  'debug-carveout-image-meta-after-human',
]);

// Frozen local copies of the dial layout glyphs (lib/hmi/dial-presenter.cjs
// HEADER_GLYPH, CONTEXT_GLYPH, PROMPT_GLYPH are not exported). Checked against
// the dial-presenter source text below; a drift voids the run.
const HEADER_GLYPH = '■';
const CONTEXT_GLYPH = '▼';
const PROMPT_GLYPH = '→';
const GAUGE_LITERALS = Object.freeze([
  'Investigate | Blend | Insight',
  'Investigate | Blend | >Insight<',
  'Investigate | >Blend< | Insight',
]);
// C3b: dial-presenter literals that reach the rendered F.1 text (renderDial
// `text` = header, context, framing, gauge, prompt, rows, footer) and are NOT
// already in the 357 DIAL_STATIC_LITERALS list. MODIFIER_ITEMS labels are
// deliberately excluded: they ride the AskUserQuestion contract only, never the
// rendered text, so they never appear in an F.1 reach subject.
const C3B_EXTRA_LITERALS = Object.freeze([
  'Investigate | Blend | >Insight<',
  'Investigate | >Blend< | Insight',
  'top-',
  ' of ',
]);

const MIN_USER_SUBJECT_TOKENS_HEAD = 2; // mirrors gate-relevance.cjs (not exported)
const TURN_FRESH_MS = sidechannel.TURN_FRESH_MS;

function checkLiterals() {
  const need = [
    "HEADER_GLYPH = '" + HEADER_GLYPH + "'",
    "CONTEXT_GLYPH = '" + CONTEXT_GLYPH + "'",
    "PROMPT_GLYPH = '" + PROMPT_GLYPH + "'",
  ].concat(GAUGE_LITERALS).concat(C3B_EXTRA_LITERALS);
  const missing = need.filter(function (l) { return DIAL_SRC.indexOf(l) === -1; });
  return missing;
}

// ---------------------------------------------------------------------------
// Relevance, parameterized. With the default params this is a line-for-line
// re-statement of gateRelevance.gateTopicallyRelevant (the BASE check proves it).
// ---------------------------------------------------------------------------
function overlapTokens(userTokens, gateTokens) {
  const out = [];
  for (const u of userTokens) {
    for (const g of gateTokens) {
      if (u === g || u.indexOf(g) === 0 || g.indexOf(u) === 0) { out.push(u === g ? u : u + '~' + g); }
    }
  }
  return out;
}

function lineKind(line) {
  const s = line.trim();
  if (!s) return 'blank';
  if (s.indexOf(HEADER_GLYPH) === 0) return 'header';
  if (s.indexOf(CONTEXT_GLYPH) === 0) return 'context';
  if (s.indexOf(PROMPT_GLYPH) === 0) return 'prompt';
  if (s.indexOf(dialPresenter.MARKER_RECOMMENDED) === 0 || s.indexOf(dialPresenter.MARKER_ROW) === 0) return 'row';
  if (GAUGE_LITERALS.indexOf(s) !== -1) return 'gauge';
  return 'other';
}

function hasDialLayout(text) {
  return String(text || '').split('\n').some(function (l) {
    const k = lineKind(l);
    return k === 'header' || k === 'context' || k === 'prompt' || k === 'row';
  });
}

function tokenProvenance(token, gateText) {
  const lines = String(gateText || '').split('\n');
  if (!hasDialLayout(gateText)) return 'unstructured';
  const kinds = [];
  for (const l of lines) {
    if (gateRelevance.subjectTokens(l).has(token)) kinds.push(lineKind(l));
  }
  return kinds.length ? Array.from(new Set(kinds)).join('+') : 'absent';
}

function c3bExtraTokens() {
  const out = new Map();
  for (const lit of C3B_EXTRA_LITERALS) {
    for (const t of gateRelevance.subjectTokens(lit)) {
      if (gateRelevance.F1_DIAL_CHROME_TOKENS.has(t) || gateRelevance.GATE_BOILERPLATE_TOKENS.has(t)) continue;
      if (!out.has(t)) out.set(t, lit);
    }
  }
  return out;
}

function gateTokensFor(gateText, p) {
  let text = typeof gateText === 'string' ? gateText : '';
  if (p.rowsOnly && hasDialLayout(text)) {
    const rows = text.split('\n').filter(function (l) { return lineKind(l) === 'row'; });
    if (rows.length) text = rows.join('\n');
  }
  if (p.stripLayoutLines && hasDialLayout(text)) {
    text = text.split('\n').filter(function (l) {
      const k = lineKind(l);
      return k !== 'header' && k !== 'context' && k !== 'prompt';
    }).join('\n');
  }
  const toks = gateRelevance.gateSubjectTokens(text);
  if (p.extraStrip) for (const t of p.extraStrip) toks.delete(t);
  return toks;
}

// CUR is set to the features of the entry being re-classified.
let CUR = null;

function makeRelevance(p) {
  const minTokens = Number.isInteger(p.minTokens) ? p.minTokens : MIN_USER_SUBJECT_TOKENS_HEAD;
  return function variantRelevance(userText, gateText, opts) {
    try {
      const isPrimaryCall = CUR && CUR.primary_subject && gateText === CUR.primary_subject;
      let stale = !!(opts && opts.gateStale === true);
      if (Number.isFinite(p.staleAfterMs) && isPrimaryCall && Number.isFinite(CUR.reach_age_ms) && CUR.reach_age_ms > p.staleAfterMs) stale = true;
      if (p.stalePasses && stale) return false;
      if (p.declaredOnly && CUR && CUR.fork_declared && isPrimaryCall) gateText = CUR.declared_labels.join('\n');
      if (p.noLabelPrimaryPasses && isPrimaryCall && !CUR.fork_declared && CUR.extracted_labels === 0) return false;
      const userTokens = gateRelevance.subjectTokens(userText);
      if (userTokens.size < minTokens) {
        if (p.lowSignalAlwaysPasses) return false;
        return stale ? false : true;
      }
      const gateTokens = gateTokensFor(gateText, p);
      if (gateTokens.size === 0) return true;
      return overlapTokens(userTokens, gateTokens).length > 0;
    } catch (_e) {
      return true;
    }
  };
}

// ---------------------------------------------------------------------------
// Variants. added: the number of new pass conditions the rule adds.
// ---------------------------------------------------------------------------
function buildVariants(ages) {
  const v = [];
  v.push({ id: 'BASE', family: 'BASE', rule: 'HEAD gateTopicallyRelevant, restated', params: {}, files: [], added: 0 });
  for (let t = 2; t <= 6; t += 1) {
    v.push({ id: 'C1a:min=' + t, family: 'C1', rule: 'low-signal threshold MIN_USER_SUBJECT_TOKENS=' + t + ', fresh-gate floor kept', params: { minTokens: t }, files: ['lib/core/gate-relevance.cjs'], added: 0 });
  }
  for (let t = 2; t <= 6; t += 1) {
    v.push({ id: 'C1b:min=' + t, family: 'C1', rule: 'low-signal threshold ' + t + ' and a low-signal turn passes even against a FRESH gate (WR-06 floor removed)', params: { minTokens: t, lowSignalAlwaysPasses: true }, files: ['lib/core/gate-relevance.cjs'], added: 1 });
  }
  const ts = Array.from(new Set(ages.concat([TURN_FRESH_MS]))).sort(function (a, b) { return a - b; });
  for (const T of ts) {
    v.push({ id: 'C2a:T=' + T, family: 'C2', rule: 'reach older than ' + T + ' ms is stale, today stale semantics (only a low-signal turn passes)', params: { staleAfterMs: T }, files: ['lib/core/gate-relevance.cjs', 'scripts/check-card-fire.cjs'], added: 1 });
  }
  for (const T of ts) {
    v.push({ id: 'C2b:T=' + T, family: 'C2', rule: 'reach older than ' + T + ' ms is stale and a stale reach passes whatever the overlap', params: { staleAfterMs: T, stalePasses: true }, files: ['lib/core/gate-relevance.cjs', 'scripts/check-card-fire.cjs'], added: 1 });
  }
  v.push({ id: 'C2c', family: 'C2', rule: 'consumption state and turn distance since the reach was minted', params: null, files: ['lib/core/gate-relevance.cjs', 'scripts/check-card-fire.cjs', 'lib/hmi/turn-text.cjs'], added: 1 });
  v.push({ id: 'C3a', family: 'C3', rule: 'when the subject carries reach rows, only reach-row tokens count; otherwise today tokens', params: { rowsOnly: true }, files: ['lib/core/gate-relevance.cjs'], added: 0 });
  const extra = c3bExtraTokens();
  v.push({ id: 'C3b', family: 'C3', rule: 'strip dial-presenter static template tokens not yet in F1_DIAL_CHROME_TOKENS (' + (extra.size ? Array.from(extra.keys()).join(', ') : 'none derivable') + ')', params: { extraStrip: Array.from(extra.keys()) }, files: ['lib/core/gate-relevance.cjs', 'tests/test-357-f1-chrome.cjs'], added: 0, c3b_tokens: Array.from(extra.entries()).map(function (e) { return { token: e[0], literal: e[1] }; }) });
  v.push({ id: 'C3c', family: 'C3', rule: 'strip header, context and prompt line tokens when the subject carries the dial layout', params: { stripLayoutLines: true }, files: ['lib/core/gate-relevance.cjs'], added: 0 });
  v.push({ id: 'C4a', family: 'C4', rule: 'when fork_declared is true, relevance is measured against the declared labels', params: { declaredOnly: true }, files: ['lib/core/gate-relevance.cjs', 'scripts/check-card-fire.cjs'], added: 1 });
  v.push({ id: 'C4b', family: 'C4', rule: 'a PRIMARY hit with no declared or extracted labels passes', params: { noLabelPrimaryPasses: true }, files: ['lib/core/gate-relevance.cjs', 'scripts/check-card-fire.cjs'], added: 1, rejected: 'rejected by construction: the 357 D-08 forbidden rule (it passes a PRIMARY hit on the absence of labels alone, which silences every label-free PRIMARY fork, including all three PRIMARY anti-vacuity fixtures)' });
  return v;
}

function clsOf(verdict) {
  return verdict && verdict.intercept === true ? 'block' : 'pass';
}

function lastUserRecord(transcript) {
  const recs = Array.isArray(transcript) ? transcript : [];
  for (let i = recs.length - 1; i >= 0; i -= 1) {
    const r = recs[i];
    if (!r || r.type !== 'user' || !r.message) continue;
    const c = r.message.content;
    if (typeof c === 'string') return r;
    if (Array.isArray(c) && c.some(function (b) { return b && b.type === 'text'; })) return r;
  }
  return null;
}

function lastAssistantText(transcript) {
  const recs = Array.isArray(transcript) ? transcript : [];
  for (let i = recs.length - 1; i >= 0; i -= 1) {
    const r = recs[i];
    if (!r || r.type !== 'assistant' || !r.message) continue;
    const c = r.message.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.filter(function (b) { return b && b.type === 'text'; }).map(function (b) { return b.text; }).join('\n');
  }
  return '';
}

function features(entry, cap, head) {
  const env = entry.envelope || {};
  const t = cap.turn;
  const transcript = Array.isArray(env.transcript) ? env.transcript : [];
  const recs = Array.isArray(env.sidechannel_records) ? env.sidechannel_records : [];
  const ages = recs.map(function (r) { return r.age_ms; }).filter(Number.isFinite);
  const primary = Array.isArray(t.ran_entries) && t.ran_entries.length > 0 && typeof t.gate_subject_text === 'string' && t.gate_subject_text ? t.gate_subject_text : '';
  const userTokens = Array.from(gateRelevance.subjectTokens(t.preceding_user_text || ''));
  const gateText = primary || t.gate_subject_text || t.output_text || '';
  const gateTokens = Array.from(gateRelevance.gateSubjectTokens(gateText));
  const ov = overlapTokens(userTokens, gateTokens);
  const lu = lastUserRecord(transcript);
  const decl = forkDeclaration.parseForkDeclaration(lastAssistantText(transcript));
  return {
    id: entry.id,
    expected: entry.expected_verdict_class,
    head_cli_class: head.cli ? head.cli.class : null,
    head_cli_reason: head.cli ? head.cli.reason : null,
    head_mcp_class: head.mcp ? head.mcp.class : null,
    envelope_mode: env.mode || 'direct',
    preceding_user_text_source: t.preceding_user_text_source,
    human_origin: !!(lu && lu.origin && lu.origin.kind === 'human'),
    user_token_count: userTokens.length,
    user_tokens: userTokens,
    gate_tokens: gateTokens,
    overlap: ov,
    overlap_provenance: ov.map(function (o) { const tok = o.split('~').pop(); return o + ':' + tokenProvenance(tok, gateText); }),
    reach_records: recs.length,
    reach_shapes: recs.map(function (r) { return r.shape; }),
    reach_age_ms: ages.length ? Math.min.apply(null, ages) : null,
    reach_fresh: ages.length ? Math.min.apply(null, ages) <= TURN_FRESH_MS : null,
    records_with_timestamp: transcript.filter(function (r) { return r && r.timestamp; }).length,
    assistant_records: transcript.filter(function (r) { return r && r.type === 'assistant'; }).length,
    fork_declared: !!(decl && decl.declared === true),
    declared_labels: decl && decl.declared === true ? decl.labels.slice() : [],
    extracted_labels: gateRelevance.extractOptionLabels(t.output_text || '').length,
    primary_subject: primary,
    dial_layout: hasDialLayout(gateText),
  };
}

function evaluate(variant, rows, headById) {
  const orig = gateRelevance.gateTopicallyRelevant;
  const out = {};
  if (!variant.params) return null;
  gateRelevance.gateTopicallyRelevant = makeRelevance(variant.params);
  try {
    for (const r of rows) {
      CUR = r.features;
      out[r.id] = clsOf(checkCardFire.classifyCardFire(r.turn, r.registry));
    }
  } finally {
    gateRelevance.gateTopicallyRelevant = orig;
    CUR = null;
  }
  const newMisses = ANTI_VACUITY_IDS.filter(function (id) { return out[id] === 'pass'; });
  const toBlock = Object.keys(out).filter(function (id) { return headById[id] === 'pass' && out[id] === 'block'; });
  const otherPasses = Object.keys(out).filter(function (id) { return headById[id] === 'block' && out[id] === 'pass' && id !== TARGET_ID && ANTI_VACUITY_IDS.indexOf(id) === -1; });
  return { classes: out, clears_target: out[TARGET_ID] === 'pass', new_misses: newMisses, flipped_to_block: toBlock, other_passes: otherPasses, monotone: toBlock.length === 0 };
}

async function main() {
  const asJson = process.argv.indexOf('--json') !== -1;
  const drift = checkLiterals();
  if (drift.length) {
    process.stderr.write('dial-presenter literal drift: ' + JSON.stringify(drift) + '\n');
    process.exit(2);
  }
  const savedFetch = globalThis.fetch;
  globalThis.fetch = function () { throw new Error('network forbidden in measure-relevance-signals-362'); };
  const origClassify = checkCardFire.classifyCardFire;
  let result;
  try {
    const corpus = corpusLoader.loadCorpus({});
    if (corpus.errors.length) {
      process.stderr.write('corpus load errors: ' + JSON.stringify(corpus.errors) + '\n');
      process.exit(2);
    }
    const head = await replay.runReplay({ surface: 'both' });
    if (head.exitCode === 2) {
      process.stderr.write('HEAD replay error: ' + (head.error || 'exit 2') + '\n');
      process.exit(2);
    }
    const headEntries = {};
    for (const e of head.entries) headEntries[e.id] = e;
    const headById = {};
    for (const e of head.entries) headById[e.id] = e.cli ? e.cli.class : null;

    // Capture every entry's classified turn on the CLI surface.
    let cap = null;
    checkCardFire.classifyCardFire = function (turn, registry) {
      const verdict = origClassify(turn, registry);
      cap = { turn: JSON.parse(JSON.stringify(turn)), registry: registry, verdict: verdict };
      return verdict;
    };
    const rows = [];
    try {
      for (const entry of corpus.entries) {
        cap = null;
        await replay.runEntry(entry, { surface: 'cli' });
        if (!cap) throw new Error('no classifyCardFire capture for ' + entry.id);
        rows.push({ id: entry.id, turn: cap.turn, registry: cap.registry, verdict: cap.verdict, features: features(entry, cap, headEntries[entry.id] || {}) });
      }
    } finally {
      checkCardFire.classifyCardFire = origClassify;
    }

    const population = rows.filter(function (r) { return r.id === TARGET_ID || headById[r.id] === 'block'; });
    const ages = population.map(function (r) { return r.features.reach_age_ms; }).filter(Number.isFinite);
    const variants = buildVariants(ages);

    const base = evaluate(variants[0], rows, headById);
    const baseMismatch = Object.keys(base.classes).filter(function (id) { return base.classes[id] !== headById[id]; });
    if (baseMismatch.length) {
      process.stderr.write('BASE does not reproduce HEAD for: ' + baseMismatch.join(', ') + '\n');
      process.exit(2);
    }

    const table = [];
    for (const v of variants.slice(1)) {
      const r = evaluate(v, rows, headById);
      const row = { id: v.id, family: v.family, rule: v.rule, runtime_files: v.files, added_pass_conditions: v.added };
      if (!r) {
        const target = population.find(function (p) { return p.id === TARGET_ID; });
        row.measurable = false;
        row.clears_target = false;
        row.new_misses = [];
        row.monotone = null;
        row.viable = false;
        row.reason = 'not measurable on the ratified fixture: ' + target.features.records_with_timestamp + ' transcript records carry a timestamp (turn distance unknown) and every replayed reach is seeded fresh and unconsumed, so no entry carries a consumption state to test';
      } else {
        row.measurable = true;
        row.clears_target = r.clears_target;
        row.new_misses = r.new_misses;
        row.monotone = r.monotone;
        row.flipped_to_block = r.flipped_to_block;
        row.other_passes = r.other_passes;
        row.viable = !v.rejected && r.clears_target && r.new_misses.length === 0 && r.monotone && r.other_passes.length === 0;
        const bits = [];
        bits.push(r.clears_target ? 'clears ' + TARGET_ID : TARGET_ID + ' still blocks');
        if (r.new_misses.length) bits.push('new misses ' + r.new_misses.join(', '));
        if (r.flipped_to_block.length) bits.push('not monotone, pass to block: ' + r.flipped_to_block.join(', '));
        if (r.other_passes.length) bits.push('other verdict changes: ' + r.other_passes.join(', '));
        if (v.rejected) bits.push(v.rejected);
        row.reason = bits.join('; ');
      }
      if (v.c3b_tokens) row.c3b_tokens = v.c3b_tokens;
      table.push(row);
    }

    const familyOrder = { C3: 0, C1: 1, C2: 2, C4: 3 };
    const viable = table.filter(function (r) { return r.viable; }).sort(function (a, b) {
      return (a.runtime_files.length - b.runtime_files.length) ||
        (a.added_pass_conditions - b.added_pass_conditions) ||
        (familyOrder[a.family] - familyOrder[b.family]);
    });
    const verdict = viable.length ? 'SIGNAL: ' + viable[0].id : 'SIGNAL: NONE';
    const popOut = population.map(function (r) {
      const f = Object.assign({}, r.features);
      delete f.primary_subject;
      return f;
    });
    result = {
      verdict: verdict,
      target: TARGET_ID,
      head_counts: head.counts,
      turn_fresh_ms: TURN_FRESH_MS,
      population: popOut,
      candidates: table,
      never_evaluated: ['user-side word or phrase lists (continuity cues)', 'punctuation or question-shape tests', 'semantic similarity', 'any Jev or network call'],
    };
  } finally {
    globalThis.fetch = savedFetch;
    checkCardFire.classifyCardFire = origClassify;
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    console.log('Population (target plus every HEAD cli block):');
    for (const p of result.population) {
      console.log('  ' + p.id + ' | ' + p.head_cli_reason + ' | src ' + p.preceding_user_text_source + ' | user ' + p.user_token_count + ' | overlap [' + p.overlap_provenance.join(', ') + '] | reach ' + (p.reach_age_ms === null ? '-' : p.reach_age_ms + 'ms') + ' | declared ' + p.fork_declared);
    }
    console.log('Candidates:');
    for (const c of result.candidates) {
      console.log('  ' + c.id + ' | clears ' + c.clears_target + ' | new misses ' + (c.new_misses.length ? c.new_misses.join(', ') : '0') + ' | monotone ' + c.monotone + ' | viable ' + c.viable + ' | ' + c.reason);
    }
    console.log(result.verdict);
  }
  process.exit(0);
}

main().catch(function (e) {
  process.stderr.write('measure-relevance-signals-362 failed: ' + (e && e.stack ? e.stack : String(e)) + '\n');
  process.exit(2);
});
