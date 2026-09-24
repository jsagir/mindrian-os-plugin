#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * scripts/measure-hsi-thinking-mode.cjs -- Phase 355 Plan 15 (HIPS-08,
 * D-44, D-45, D-58, AI-SPEC Section 4 item (3), D14). Dev-time only, never
 * required from lib/ or hooks/ (tripwire: tests/test-353-tripwires.cjs leg
 * 2, this script's own name is appended to HOOKS_BANNED_LEDGER_SCRIPTS in
 * the same commit that creates it, per the Phase 356 peer contract).
 *
 * Measures the HSI thinking-mode regex (lib/core/hsi-spectral.cjs's
 * classifySentenceMode) against one Jev Choice per gold sentence, three
 * repeats, with the D-45 adoption bar applied mechanically. All Jev use
 * goes through scripts/jev-devtime-client.cjs's jev()/pool()/loadKey (D-55)
 * composed with scripts/jev-question-ceilings.cjs's makeSentenceCeiling
 * (D-44); the AI-SPEC Section 4 item (3) illustrative draft named
 * scripts/build-section-command-ledger.cjs's jev()/pool()/loadKey, but that
 * draft predates the shared client Phase 356 built -- D-55 supersedes it.
 *
 * DIVERGENCE FROM THE OTHER measure- and build- .cjs --check SIBLINGS: this
 * script's --check does not rebuild anything. It replays the exact
 * responses recorded in tests/fixtures/355-jev-hsi-responses.json against
 * the CURRENT lib/core/hsi-spectral.cjs and the CURRENT frozen question,
 * and fails loudly the moment either has drifted from what
 * tests/fixtures/355-hsi-measurement-record.json claims. A real
 * measurement is a navigator-invoked, key-holding act
 * (`node scripts/measure-hsi-thinking-mode.cjs --repeats 3`, the key from
 * TYPESAFE_API_KEY or ~/.secrets/typesafe.env, mode 600), never a release
 * step and never a hook.
 *
 * Modes (argv switch-case):
 *   (default)             live: 3 repeats (override with --repeats <n>)
 *                          against the vendor, key from loadKey().
 *   --jev-fixture <path>   replay a canned {sha256Key: [{model,answers,
 *                          usage}, ...]} response map instead of calling
 *                          the vendor (a fake key string is still required
 *                          by the client's guard, never a real secret).
 *   --check                offline replay of the recorded responses
 *                          against the record; zero network, never calls
 *                          loadKey; exits 77 when no record exists yet.
 *   --regex-only            offline: recompute the regex side from the
 *                          CURRENT hsi-spectral.cjs and rewrite only the
 *                          record's regex_postfix + bar fields.
 *   --help                 print this file's own mode summary.
 *
 * D-32: refuses to run against a gold fixture that lacks `labeled_at`, or
 * whose `fixture_sha256` no longer matches the current items file's bytes.
 * D-45: the adoption bar (gap >= 10 points full-set with none counted, no
 * mode drops more than 5 points, holding on every repeat) is fixed in code
 * here, applied mechanically, never relaxed after seeing a result.
 * D-58: the regex baseline's `anolog` typo is measured as shipped
 * (regex_prefix) first; the fix and regex_postfix are plan 355-15 Task 2's
 * job, not this file's Task 1 shape.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

const { jev, pool, loadKey } = require('./jev-devtime-client.cjs');
const Q = require('./jev-question-ceilings.cjs');
const { parseJevResponse } = require('./jev-response-schema.cjs');
const { classifySentenceMode } = require(path.join(__dirname, '..', 'lib', 'core', 'hsi-spectral.cjs'));

const ROOT = path.join(__dirname, '..');
const DEFAULT_ITEMS_PATH = path.join(ROOT, 'tests', 'fixtures', '355-hsi-thinking-mode-sentences.items.json');
const DEFAULT_GOLD_PATH = path.join(ROOT, 'tests', 'fixtures', '355-hsi-thinking-mode-sentences.json');
const DEFAULT_RESPONSES_PATH = path.join(ROOT, 'tests', 'fixtures', '355-jev-hsi-responses.json');
const DEFAULT_RECORD_PATH = path.join(ROOT, 'tests', 'fixtures', '355-hsi-measurement-record.json');

const LABELS = Q.THINKING_MODE_LABELS; // ['analytical','integrative','descriptive','evaluative','creative','none']
const INPUT_TOKEN_TRIPWIRE = 8000; // Section 4: our own guard, not a vendor figure
const VENDOR_USD_PER_MILLION_INPUT_TOKENS = 0.042; // docs.typesafe.ai/models.md, vendor-documented
const GAP_BP_THRESHOLD = 1000; // D-45: 10 accuracy points, in basis points
const MODE_DROP_BP_THRESHOLD = 500; // D-45: 5 recall points, in basis points

// ---------------------------------------------------------------------------
// isZeroMatchFallback(sentence) -- diagnostic only (D14: "how many [descriptive
// answers] came from the zero-match fallback"). Mirrors lib/core/hsi-spectral.cjs's
// MODE_PATTERNS verbatim; the actual regex answer for every row always comes
// from classifySentenceMode itself, never from this mirror. Kept in sync
// manually with the same-commit typo fix (Task 2); a sync-guard test in
// tests/test-355-hsi-measurement-record.cjs asserts these five source
// strings still appear verbatim in the real file, so drift is caught loudly.
// ---------------------------------------------------------------------------
const MODE_PATTERN_MIRROR = Object.freeze({
  analytical: /\b(because|therefore|consequently|evidence|data|measure|quantif|statistic|analyz|assess|evaluat|compar)\w*\b/gi,
  integrative: /\b(connect|bridge|synthes|combin|integrat|cross|interdisciplin|convergence|fusion|hybrid|anolog|metaphor|transfer)\w*\b/gi,
  descriptive: /\b(is|are|was|were|has|have|consist|compris|includ|contain|describ|defin|refer|represent)\w*\b/gi,
  evaluative: /\b(should|must|better|worse|risk|opportunit|strength|weakness|advantage|disadvantage|critical|important|significant)\w*\b/gi,
  creative: /\b(novel|innovati|reimagin|redefin|what.if|could|might|envision|transform|disrupt|pioneer|breakthrough|radical)\w*\b/gi,
});

function isZeroMatchFallback(sentence) {
  const text = String(sentence == null ? '' : sentence);
  for (const mode of Object.keys(MODE_PATTERN_MIRROR)) {
    const re = MODE_PATTERN_MIRROR[mode];
    re.lastIndex = 0;
    if (re.test(text)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Small pure helpers.
// ---------------------------------------------------------------------------
function sha256Hex(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = canonicalize(value[k]);
    return out;
  }
  return value;
}

function canonicalKey(body) {
  return sha256Hex(JSON.stringify(canonicalize(body)));
}

function writeJsonAtomic(destPath, obj) {
  const tmp = destPath + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, destPath);
}

class RefusalError extends Error {}

// ---------------------------------------------------------------------------
// buildBody(sentence) -- { model, state: {sentence}, questions } (D-44).
// ---------------------------------------------------------------------------
function buildBody(sentence) {
  return { model: Q.PINNED_MODEL, state: { sentence }, questions: Q.THINKING_MODE_QUESTIONS };
}

// ---------------------------------------------------------------------------
// loadGold({goldPath, itemsPath}) -- D-32: refuses without labeled_at, or
// when fixture_sha256 no longer matches the items file's current bytes.
// ---------------------------------------------------------------------------
function loadGold(opts) {
  const o = opts || {};
  const goldPath = o.goldPath || DEFAULT_GOLD_PATH;
  const itemsPath = o.itemsPath || DEFAULT_ITEMS_PATH;
  const gold = JSON.parse(fs.readFileSync(goldPath, 'utf8'));
  if (!gold.labeled_at) {
    throw new RefusalError('measure-hsi-thinking-mode: refused -- gold fixture has no labeled_at (D-32); label the set before measuring (' + goldPath + ')');
  }
  const itemsRaw = fs.readFileSync(itemsPath, 'utf8');
  const itemsSha256 = sha256Hex(itemsRaw);
  if (gold.fixture_sha256 !== itemsSha256) {
    throw new RefusalError('measure-hsi-thinking-mode: refused -- fixture_sha256 does not match ' + itemsPath + ' (labeled_at ' + gold.labeled_at + '; items file changed since labeling) (D-32)');
  }
  return gold;
}

// ---------------------------------------------------------------------------
// computeMetrics internals (private). accuracyBp: integer basis points
// (0-10000), never a float, so --check replay compares by exact equality.
// A zero-denominator always yields null, never 0/0 and never NaN.
// ---------------------------------------------------------------------------
function accuracyBp(correct, total) {
  if (!total) return null;
  return Math.round((correct / total) * 10000);
}

function computeAccuracyOver(rows, key) {
  let correct = 0;
  let total = 0;
  for (const r of rows) {
    if (r[key] === null || r[key] === undefined) continue;
    total += 1;
    if (r[key] === r.gold) correct += 1;
  }
  return { correct, total, accuracy_bp: accuracyBp(correct, total) };
}

function computeRecallByMode(rows, key) {
  const out = {};
  for (const mode of LABELS) {
    let correct = 0;
    let total = 0;
    for (const r of rows) {
      if (r.gold !== mode) continue;
      if (r[key] === null || r[key] === undefined) continue;
      total += 1;
      if (r[key] === mode) correct += 1;
    }
    const entry = { correct, total, accuracy_bp: total ? accuracyBp(correct, total) : null };
    if (!total) entry.note = 'no gold examples';
    out[mode] = entry;
  }
  return out;
}

function computeConfusion(rows, key) {
  const idx = new Map(LABELS.map((m, i) => [m, i]));
  const matrix = LABELS.map(() => LABELS.map(() => 0));
  let any = false;
  for (const r of rows) {
    if (r[key] === null || r[key] === undefined) continue;
    any = true;
    const gi = idx.get(r.gold);
    const pi = idx.get(r[key]);
    if (gi === undefined || pi === undefined) continue;
    matrix[gi][pi] += 1;
  }
  return any ? { labels: LABELS.slice(), matrix } : null;
}

function computeItemCorrect(rows, key) {
  const out = {};
  for (const r of rows) {
    if (r[key] === null || r[key] === undefined) continue;
    out[r.id] = r[key] === r.gold;
  }
  return out;
}

// ---------------------------------------------------------------------------
// computeMetrics(rows) -- rows: [{id, gold, regex, jev, confidence}]. jev
// and/or regex may be null on every row (a regex-only or jev-only pass);
// null-for-all yields null sub-objects rather than a misleading zero.
// Confidence is secondary analysis only (Section 4): it never filters
// full_accuracy or subset5_accuracy, the argmax primary metric.
// ---------------------------------------------------------------------------
function computeMetrics(rows) {
  const n = rows.length;
  const subset = rows.filter((r) => r.gold !== 'none');

  const jevAny = rows.some((r) => r.jev !== null && r.jev !== undefined);
  const regexAny = rows.some((r) => r.regex !== null && r.regex !== undefined);

  const jevFull = computeAccuracyOver(rows, 'jev');
  const regexFull = computeAccuracyOver(rows, 'regex');
  const jevSubset = computeAccuracyOver(subset, 'jev');
  const regexSubset = computeAccuracyOver(subset, 'regex');

  const ge = rows.filter((r) => typeof r.confidence === 'number' && r.confidence >= 0.9);
  const lt = rows.filter((r) => typeof r.confidence === 'number' && r.confidence < 0.9);
  const geAcc = computeAccuracyOver(ge, 'jev');
  const ltAcc = computeAccuracyOver(lt, 'jev');

  const descriptiveCount = rows.reduce((acc, r) => acc + (r.regex === 'descriptive' ? 1 : 0), 0);
  const zeroMatchCount = rows.reduce((acc, r) => acc + (r.regex_zero_match ? 1 : 0), 0);

  return {
    n,
    full_accuracy: { jev: jevAny ? jevFull.accuracy_bp : null, regex: regexAny ? regexFull.accuracy_bp : null },
    subset5_accuracy: {
      n: subset.length,
      jev: jevAny ? jevSubset.accuracy_bp : null,
      regex: regexAny ? regexSubset.accuracy_bp : null,
    },
    recall_by_mode: {
      jev: jevAny ? computeRecallByMode(rows, 'jev') : null,
      regex: regexAny ? computeRecallByMode(rows, 'regex') : null,
    },
    confusion: {
      jev: jevAny ? computeConfusion(rows, 'jev') : null,
      regex: regexAny ? computeConfusion(rows, 'regex') : null,
    },
    confidence_slices: {
      ge_0_9: { n: ge.length, accuracy: geAcc.accuracy_bp },
      lt_0_9: { n: lt.length, accuracy: ltAcc.accuracy_bp },
    },
    regex_descriptive_share: regexAny ? accuracyBp(descriptiveCount, n) : null,
    regex_zero_match_fallbacks: regexAny ? zeroMatchCount : null,
    item_correct: {
      jev: jevAny ? computeItemCorrect(rows, 'jev') : null,
      regex: regexAny ? computeItemCorrect(rows, 'regex') : null,
    },
  };
}

// ---------------------------------------------------------------------------
// applyAdoptionBar(perRepeatMetrics, regexMetrics) -- D-45, mechanically.
// perRepeatMetrics: array of computeMetrics() results carrying jev's numbers
// per repeat (regex fields null on these -- regex is repeat-invariant).
// regexMetrics: a single computeMetrics() result carrying only regex's
// numbers (regex_prefix or regex_postfix) -- the comparison baseline.
// A mode with zero gold examples on either side is skipped (cannot be
// measured), never counted as a pass or a drop (gold_state ruling, n=45:
// 'none' has zero labeled examples this run).
// ---------------------------------------------------------------------------
function applyAdoptionBar(perRepeatMetrics, regexMetrics) {
  const regexRecall = (regexMetrics.recall_by_mode && regexMetrics.recall_by_mode.regex) || {};
  const skipped_modes = LABELS.filter((m) => !regexRecall[m] || regexRecall[m].total === 0);

  const per_repeat = perRepeatMetrics.map((m, i) => {
    const jevFullBp = m.full_accuracy.jev;
    const regexFullBp = regexMetrics.full_accuracy.regex;
    const gap_bp = (jevFullBp === null || regexFullBp === null) ? null : jevFullBp - regexFullBp;
    const mode_drops = [];
    const jevRecall = (m.recall_by_mode && m.recall_by_mode.jev) || {};
    for (const mode of LABELS) {
      const jr = jevRecall[mode];
      const rr = regexRecall[mode];
      if (!jr || !rr || jr.total === 0 || rr.total === 0) continue; // no gold examples: cannot evaluate
      const dropBp = rr.accuracy_bp - jr.accuracy_bp;
      if (dropBp > MODE_DROP_BP_THRESHOLD) mode_drops.push({ mode, drop_bp: dropBp });
    }
    const cleared = gap_bp !== null && gap_bp >= GAP_BP_THRESHOLD && mode_drops.length === 0;
    return { repeat: i + 1, gap_bp, mode_drops, cleared };
  });

  const clearedCount = per_repeat.filter((r) => r.cleared).length;
  let cleared;
  let reason;
  let flip_count = null;
  if (per_repeat.length === 0) {
    cleared = false;
    reason = 'not cleared: no repeats measured';
  } else if (clearedCount === per_repeat.length) {
    cleared = true;
    reason = 'cleared on all ' + per_repeat.length + ' repeats';
  } else if (clearedCount === 0) {
    cleared = false;
    reason = 'not cleared: bar not met on any repeat';
  } else {
    cleared = false;
    reason = 'not cleared: inside run-to-run noise';
    flip_count = countJevFlips(perRepeatMetrics);
  }

  return { cleared, per_repeat, reason, flip_count, skipped_modes };
}

function countJevFlips(perRepeatMetrics) {
  const ids = new Set();
  for (const m of perRepeatMetrics) {
    if (m.item_correct && m.item_correct.jev) {
      for (const id of Object.keys(m.item_correct.jev)) ids.add(id);
    }
  }
  let flips = 0;
  for (const id of ids) {
    const values = perRepeatMetrics
      .map((m) => (m.item_correct && m.item_correct.jev ? m.item_correct.jev[id] : undefined))
      .filter((v) => v !== undefined);
    const allSame = values.every((v) => v === values[0]);
    if (!allSame) flips += 1;
  }
  return flips;
}

// ---------------------------------------------------------------------------
// Live measurement loop (Section 4 item (3), adapted to jev-devtime-client
// per D-55). Retry/failure policy per AI-SPEC Section 4b's table:
//   429/529, network error/timeout -- handled inside jev() itself.
//   401 -- never retried; aborts the WHOLE run; the key never appears in
//     any thrown message.
//   400/422 -- never retried; aborts the whole run.
//   200 but parseJevResponse fails -- retried once at this level; still
//     failing marks the item failed (denominator preserved, never shrunk).
//   usage.input_tokens > 8000 on any call -- aborts the whole run.
//   Any failed item at the end of a repeat -- the whole run fails
//     (non-zero exit); rerun, never report on a shrunken denominator.
// ---------------------------------------------------------------------------
async function runLiveRepeats({ gold, repeats, key, fetchImpl, sleepImpl, ceiling }) {
  const responses = {};
  const perRepeatRows = [];
  let calls = 0;
  let totalInputTokens = 0;
  let nonZeroStatusCount = 0;

  for (let r = 0; r < repeats; r += 1) {
    const rows = await pool(gold.items, 4, async (f) => {
      const body = buildBody(f.sentence);
      const bodyKey = canonicalKey(body);
      let attempt = 0;
      let parsed = null;
      for (;;) {
        calls += 1;
        const res = await jev(body, { guard: ceiling, key, fetchImpl, sleepImpl, timeoutMs: 15000, honorRetryAfter: true });
        if (res.status === 401) {
          const err = new Error('measure-hsi-thinking-mode: aborted -- 401 from vendor (key withheld)');
          err.code = 'ABORT_401';
          throw err;
        }
        if (res.status === 400 || res.status === 422) {
          const err = new Error('measure-hsi-thinking-mode: aborted -- ' + res.status + ' response for item ' + f.id + ' (malformed question or state; a defect in our own code, not the vendor)');
          err.code = 'ABORT_MALFORMED';
          throw err;
        }
        if (res.status !== 200) {
          nonZeroStatusCount += 1;
          return { id: f.id, gold: f.gold, jev: null, confidence: null, status: 'http_' + res.status, model: null, input_tokens: 0 };
        }
        parsed = parseJevResponse(res, { mode: LABELS });
        if (parsed.ok) break;
        if (attempt < 1) { attempt += 1; continue; }
        return { id: f.id, gold: f.gold, jev: null, confidence: null, status: parsed.reason, model: null, input_tokens: 0 };
      }
      if (parsed.usage.input_tokens > INPUT_TOKEN_TRIPWIRE) {
        const err = new Error('measure-hsi-thinking-mode: aborted -- usage.input_tokens ' + parsed.usage.input_tokens + ' exceeds ' + INPUT_TOKEN_TRIPWIRE + ' for item ' + f.id);
        err.code = 'ABORT_TOKEN_TRIPWIRE';
        throw err;
      }
      totalInputTokens += parsed.usage.input_tokens;
      responses[bodyKey] = responses[bodyKey] || [];
      responses[bodyKey][r] = { model: parsed.model, answers: parsed.answers, usage: parsed.usage };
      return {
        id: f.id, gold: f.gold,
        jev: parsed.answers.mode.choice,
        confidence: parsed.answers.mode.confidence,
        status: 'ok', model: parsed.model, input_tokens: parsed.usage.input_tokens,
      };
    });

    const failed = rows.filter((row) => row.status !== 'ok');
    if (failed.length) {
      throw new Error(failed.length + ' of ' + rows.length + ' items failed (' + failed[0].status + '); rerun, never shrink the denominator');
    }
    perRepeatRows.push(rows);
  }

  return { responses, perRepeatRows, calls, totalInputTokens, nonZeroStatusCount };
}

// ---------------------------------------------------------------------------
// makeFixtureFetch(fixturePath) -- --jev-fixture replay: a fetchImpl that
// serves canned {sha256Key: [{model,answers,usage}, ...]} responses instead
// of a live vendor call, indexing into the per-key array by call order.
// ---------------------------------------------------------------------------
function makeFixtureFetch(fixturePath) {
  const data = JSON.parse(fs.readFileSync(path.resolve(fixturePath), 'utf8'));
  const counters = {};
  return async function fixtureFetch(_endpoint, init) {
    const body = JSON.parse(init.body);
    const key = canonicalKey(body);
    const idx = counters[key] || 0;
    counters[key] = idx + 1;
    const arr = data[key];
    const entry = arr && arr[idx];
    if (!entry) {
      return { status: 404, text: async () => JSON.stringify({ error: 'no fixture response for ' + key + ' call ' + idx }) };
    }
    return { status: 200, text: async () => JSON.stringify(entry) };
  };
}

// ---------------------------------------------------------------------------
// runRegexOnly({recordPath, itemsGold}) -- offline: recompute regex_postfix
// from the CURRENT hsi-spectral.cjs, re-apply the bar against it (the
// baseline this phase ships), and rewrite only those two record fields.
// ---------------------------------------------------------------------------
function runRegexOnly({ recordPath, itemsGold }) {
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  const regexRows = itemsGold.items.map((f) => ({
    id: f.id, gold: f.gold,
    regex: classifySentenceMode(f.sentence),
    regex_zero_match: isZeroMatchFallback(f.sentence),
    jev: null, confidence: null,
  }));
  const regexPostfix = computeMetrics(regexRows);
  const bar = applyAdoptionBar(record.repeats, regexPostfix);
  record.regex_postfix = regexPostfix;
  record.bar = bar;
  record.bar_baseline = 'regex_postfix';
  writeJsonAtomic(recordPath, record);
  return record;
}

// ---------------------------------------------------------------------------
// runCheck({recordPath, responsesPath, itemsGold}) -- offline replay
// (D11/D-32): zero network, never calls loadKey. Recomputes every per-repeat
// jev metric from the recorded responses, recomputes regex_postfix from the
// CURRENT hsi-spectral.cjs, and fails loudly on any drift from the record.
// ---------------------------------------------------------------------------
function runCheck({ recordPath, responsesPath, itemsGold, write, writeErr }) {
  const out = write || (() => {});
  const err = writeErr || (() => {});
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  if (!fs.existsSync(responsesPath)) {
    err('measure-hsi-thinking-mode --check: no responses fixture at ' + responsesPath);
    return false;
  }
  const responses = JSON.parse(fs.readFileSync(responsesPath, 'utf8'));

  if (record.jev_model !== Q.PINNED_MODEL) {
    err('measure-hsi-thinking-mode --check: record.jev_model ' + record.jev_model + ' is not the pinned model ' + Q.PINNED_MODEL);
    return false;
  }
  if (record.question_sha256 !== Q.questionSha256(Q.THINKING_MODE_QUESTIONS)) {
    err('measure-hsi-thinking-mode --check: record.question_sha256 does not match the current frozen question');
    return false;
  }
  if (record.fixture_sha256 !== itemsGold.fixture_sha256) {
    err('measure-hsi-thinking-mode --check: record.fixture_sha256 does not match the current gold fixture');
    return false;
  }

  const repeatsCount = Array.isArray(record.repeats) ? record.repeats.length : 0;
  let totalInputTokens = 0;
  const recomputedRepeats = [];
  for (let r = 0; r < repeatsCount; r += 1) {
    const rows = [];
    for (const f of itemsGold.items) {
      const body = buildBody(f.sentence);
      const key = canonicalKey(body);
      const arr = responses[key];
      const resp = arr && arr[r];
      if (!resp) {
        err('measure-hsi-thinking-mode --check: missing recorded response for item ' + f.id + ' repeat ' + (r + 1));
        return false;
      }
      if (resp.model !== Q.PINNED_MODEL) {
        err('measure-hsi-thinking-mode --check: recorded response for ' + f.id + ' repeat ' + (r + 1) + ' has model ' + resp.model + ', not ' + Q.PINNED_MODEL);
        return false;
      }
      totalInputTokens += resp.usage.input_tokens;
      rows.push({ id: f.id, gold: f.gold, jev: resp.answers.mode.choice, confidence: resp.answers.mode.confidence, regex: null });
    }
    recomputedRepeats.push(computeMetrics(rows));
  }

  if (!isDeepStrictEqual(recomputedRepeats, record.repeats)) {
    err('measure-hsi-thinking-mode --check: recomputed per-repeat metrics differ from the record');
    return false;
  }

  const regexRows = itemsGold.items.map((f) => ({
    id: f.id, gold: f.gold,
    regex: classifySentenceMode(f.sentence),
    regex_zero_match: isZeroMatchFallback(f.sentence),
    jev: null, confidence: null,
  }));
  const recomputedRegexPostfix = computeMetrics(regexRows);
  if (record.regex_postfix === null || record.regex_postfix === undefined) {
    err('measure-hsi-thinking-mode --check: record has no regex_postfix yet (run --regex-only after the typo fix)');
    return false;
  }
  if (!isDeepStrictEqual(recomputedRegexPostfix, record.regex_postfix)) {
    err('measure-hsi-thinking-mode --check: recomputed regex_postfix differs from the record (the regex changed since this record was written -- re-measure)');
    return false;
  }

  const recomputedBar = applyAdoptionBar(recomputedRepeats, recomputedRegexPostfix);
  if (!isDeepStrictEqual(recomputedBar, record.bar)) {
    err('measure-hsi-thinking-mode --check: recomputed adoption bar differs from the record');
    return false;
  }

  if (record.input_tokens !== totalInputTokens) {
    err('measure-hsi-thinking-mode --check: recomputed input_tokens (' + totalInputTokens + ') differs from record.input_tokens (' + record.input_tokens + ')');
    return false;
  }
  const expectedCost = (totalInputTokens / 1e6) * VENDOR_USD_PER_MILLION_INPUT_TOKENS;
  if (Math.abs(record.cost_usd_estimate - expectedCost) > 1e-9) {
    err('measure-hsi-thinking-mode --check: recomputed cost_usd_estimate differs from the record');
    return false;
  }

  if (!record.decision || (record.decision !== 'adopted' && record.decision !== 'not_adopted' && record.decision !== 'pending_signoff')) {
    err('measure-hsi-thinking-mode --check: record.decision is not one of adopted / not_adopted / pending_signoff');
    return false;
  }

  out('measure-hsi-thinking-mode --check: OK (' + repeatsCount + ' repeats, ' + itemsGold.items.length + ' gold items, model ' + record.jev_model + ', decision ' + record.decision + ')');
  return true;
}

// ---------------------------------------------------------------------------
// argv parsing + main().
// ---------------------------------------------------------------------------
function parseArgv(argv) {
  const flags = { repeats: 3 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help') flags.help = true;
    else if (a === '--check') flags.check = true;
    else if (a === '--regex-only') flags.regexOnly = true;
    else if (a === '--repeats') { flags.repeats = parseInt(argv[i + 1], 10); i += 1; }
    else if (a === '--jev-fixture') { flags.jevFixture = argv[i + 1]; i += 1; }
  }
  if (!Number.isFinite(flags.repeats) || flags.repeats < 1) flags.repeats = 3;
  return flags;
}

const HELP_TEXT = [
  'measure-hsi-thinking-mode.cjs -- Phase 355 Plan 15 (HIPS-08, D-44, D-45, D-58)',
  '',
  '  (default)             live: --repeats (default 3) against the vendor',
  '  --repeats <n>         override the repeat count (default 3)',
  '  --jev-fixture <path>  replay a canned response file instead of the vendor',
  '  --check               offline replay against the recorded record; zero network',
  '  --regex-only          offline: recompute regex_postfix + re-apply the bar',
  '  --help                this text',
].join('\n');

async function main(argv, deps) {
  const d = deps || {};
  const flags = parseArgv(argv || process.argv.slice(2));
  const write = d.write || ((s) => console.log(s));
  const writeErr = d.writeErr || ((s) => console.error(s));

  if (flags.help) { write(HELP_TEXT); return 0; }

  const itemsPath = d.itemsPath || DEFAULT_ITEMS_PATH;
  const goldPath = d.goldPath || DEFAULT_GOLD_PATH;
  const responsesPath = d.responsesPath || DEFAULT_RESPONSES_PATH;
  const recordPath = d.recordPath || DEFAULT_RECORD_PATH;

  if (flags.check && !fs.existsSync(recordPath)) {
    writeErr('measure-hsi-thinking-mode --check: SKIP -- no record at ' + recordPath + ' yet; run a live measurement first');
    return 77;
  }

  let gold;
  try {
    gold = loadGold({ goldPath, itemsPath });
  } catch (e) {
    writeErr(e && e.message ? e.message : String(e));
    return 1;
  }

  if (flags.check) {
    try {
      const ok = runCheck({ recordPath, responsesPath, itemsGold: gold, write, writeErr });
      return ok ? 0 : 1;
    } catch (e) {
      writeErr('measure-hsi-thinking-mode --check: ' + (e && e.message ? e.message : String(e)));
      return 1;
    }
  }

  if (flags.regexOnly) {
    try {
      runRegexOnly({ recordPath, itemsGold: gold });
      write('measure-hsi-thinking-mode: wrote regex_postfix + re-applied the bar to ' + recordPath);
      return 0;
    } catch (e) {
      writeErr('measure-hsi-thinking-mode --regex-only: ' + (e && e.message ? e.message : String(e)));
      return 1;
    }
  }

  // live, or --jev-fixture replay.
  const ceiling = Q.makeSentenceCeiling(new Set(gold.items.map((f) => f.sentence)));

  let key = d.key;
  let fetchImpl = d.fetchImpl;
  if (flags.jevFixture) {
    key = key || 'jev-fixture-replay-not-a-real-key';
    fetchImpl = fetchImpl || makeFixtureFetch(flags.jevFixture);
  } else if (!key) {
    key = loadKey();
    if (!key) {
      writeErr('measure-hsi-thinking-mode: SKIP -- no dev-time vendor key resolved (set TYPESAFE_API_KEY or ~/.secrets/typesafe.env)');
      return 3;
    }
  }

  try {
    const { responses, perRepeatRows, calls, totalInputTokens, nonZeroStatusCount } = await runLiveRepeats({
      gold, repeats: flags.repeats, key, fetchImpl, sleepImpl: d.sleepImpl, ceiling,
    });

    const perRepeatMetrics = perRepeatRows.map((rows) => computeMetrics(rows.map((r) => ({
      id: r.id, gold: r.gold, jev: r.jev, confidence: r.confidence, regex: null,
    }))));

    const regexRows = gold.items.map((f) => ({
      id: f.id, gold: f.gold,
      regex: classifySentenceMode(f.sentence),
      regex_zero_match: isZeroMatchFallback(f.sentence),
      jev: null, confidence: null,
    }));
    const regexPrefix = computeMetrics(regexRows);

    const record = {
      measured_at: (d.now ? d.now() : new Date()).toISOString(),
      jev_model: Q.PINNED_MODEL,
      calls,
      non_200: nonZeroStatusCount,
      input_tokens: totalInputTokens,
      cost_usd_estimate: (totalInputTokens / 1e6) * VENDOR_USD_PER_MILLION_INPUT_TOKENS,
      question_sha256: Q.questionSha256(Q.THINKING_MODE_QUESTIONS),
      fixture_sha256: gold.fixture_sha256,
      gold_labeled_at: gold.labeled_at,
      repeats: perRepeatMetrics,
      regex_prefix: regexPrefix,
      regex_postfix: null,
      bar: applyAdoptionBar(perRepeatMetrics, regexPrefix),
      bar_baseline: 'regex_prefix',
      decision: 'pending_signoff',
      signed_off_by: null,
      signed_off_at: null,
    };

    writeJsonAtomic(responsesPath, responses);
    writeJsonAtomic(recordPath, record);
    write('measure-hsi-thinking-mode: wrote ' + responsesPath + ' and ' + recordPath + ' (' + flags.repeats + ' repeats, ' + calls + ' calls, ' + totalInputTokens + ' input tokens)');
    return 0;
  } catch (e) {
    writeErr(e && e.message ? e.message : String(e));
    return 1;
  }
}

module.exports = {
  computeMetrics,
  applyAdoptionBar,
  buildBody,
  main,
  loadGold,
  canonicalKey,
  isZeroMatchFallback,
  MODE_PATTERN_MIRROR,
  RefusalError,
};

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code || 0))
    .catch((e) => { console.error(e && e.stack || e); process.exit(1); });
}
