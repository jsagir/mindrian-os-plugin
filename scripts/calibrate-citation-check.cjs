#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * scripts/calibrate-citation-check.cjs -- Phase 355 Plan 26 (HIPS-09, D-46,
 * AI-SPEC D15). Dev-time only, never required from lib/ or hooks/ (tripwire:
 * tests/test-353-tripwires.cjs leg 2, this script's own name is appended to
 * HOOKS_BANNED_LEDGER_SCRIPTS in the same commit that creates it, per the
 * Phase 356 peer contract).
 *
 * Scores every templated citation item
 * (tests/fixtures/355-citation-pairs.items.json's `items` array, 43
 * entries) with the citation_check Choice, once with the rule stated
 * (Q.CITATION_QUESTIONS_STATED) and once with the rule withheld
 * (Q.CITATION_QUESTIONS_WITHHELD), against the navigator-ruled gold
 * (tests/fixtures/355-citation-pairs.json). That gold is machine-labeled by
 * an external model (claude-opus-5.5, labeler_kind external_model) under
 * the navigator's 2026-09-24 ruling recorded in 355-14-SUMMARY.md -- the
 * navigator's own blind sitting on this set stands at 0/43. D-32's
 * refusal check is about the gold's own labeled_at / fixture_sha256
 * provenance, not about who labeled it; that ruling stands independently.
 *
 * Two limitations carried forward from 355-14 into every number below
 * (also in deferred-items.md): (1) `supports` is structurally unreachable
 * in this item set -- no item samples an ALIAS_OF path, so the gold is a
 * two-class effective gold (says_nothing / contradicts) even though the
 * schema names three; (2) all 8 `contradicts` gold items are the
 * synthetic `contradicting` stratum (355-14 Task 2's fallback rule, since
 * Theo's canon carried zero naturally-occurring CONTRASTS_WITH edges among
 * the sampled pairs) -- every `contradicts` verdict here is scored against
 * a constructed contradiction, not one the canon produced unprompted.
 *
 * The item file's own `no_path` array (8 entries, no `path` field) makes
 * ZERO Jev calls: code decides `unverified` for those pairs at runtime
 * (D-46), so nothing about them is calibrated here; their count is
 * recorded for transparency only.
 *
 * Uses composeGuard(makeEgressGuard(EGRESS_PROFILES.citation_check),
 * closure) directly rather than jev-question-ceilings.cjs's own
 * makeCitationCeiling: the item file already carries each item's
 * pre-rendered `claim` and hop-shaped `path` (built by 355-14 Task 2 via
 * renderClaim/hopsFromTheoPath from a live Theo capture), so the closure
 * here asserts the sent state is byte/deep-equal to that item's own
 * `claim` and `path` -- the identical membership proof makeCitationCeiling
 * performs starting from a raw Theo path, without reconstructing the
 * original {path, pathLabels, edges} shape from the already-rendered hops.
 *
 * D-32: refuses to run against a gold fixture that lacks `labeled_at`, or
 * whose `fixture_sha256` no longer matches the current items file's bytes.
 *
 * Modes (argv switch-case):
 *   (default)             live: one stated + one withheld call per item
 *                          against the vendor, key from loadKey().
 *   --jev-fixture <path>   replay a canned {sha256Key: [{model,answers,
 *                          usage}]} response map instead of calling the
 *                          vendor (a fake key string is still required by
 *                          the client's guard, never a real secret).
 *   --check                offline replay of the recorded responses
 *                          against the shared calibration record's
 *                          `citation` section; zero network, never calls
 *                          loadKey; exits 77 when no `citation` section
 *                          exists yet.
 *   --help                 print this file's own mode summary.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

const { jev, pool, loadKey, makeEgressGuard, EGRESS_PROFILES } = require('./jev-devtime-client.cjs');
const Q = require('./jev-question-ceilings.cjs');
const { parseJevResponse } = require('./jev-response-schema.cjs');
const { confidenceFromBucket } = require(path.join(__dirname, '..', 'lib', 'core', 'eureka-critic.cjs'));

const ROOT = path.join(__dirname, '..');
const DEFAULT_ITEMS_PATH = path.join(ROOT, 'tests', 'fixtures', '355-citation-pairs.items.json');
const DEFAULT_GOLD_PATH = path.join(ROOT, 'tests', 'fixtures', '355-citation-pairs.json');
const DEFAULT_RESPONSES_PATH = path.join(ROOT, 'tests', 'fixtures', '355-jev-citation-responses.json');
const DEFAULT_RECORD_PATH = path.join(ROOT, 'tests', 'fixtures', '355-jev-calibration-record.json');

const INPUT_TOKEN_TRIPWIRE = 8000; // our own guard, not a vendor figure
const VENDOR_USD_PER_MILLION_INPUT_TOKENS = 0.042; // docs.typesafe.ai/models.md, vendor-documented
const AUTO_VERDICT_CONFIDENCE_CUT = 0.8; // D-46: auto-verdict only at confidence >= 0.8
const SEAM_RULE_TEXT = 'high: auto-verdict allowed at confidence >= 0.8. medium: every verdict goes to a human. low or unknown: rewrite the question before this seam is used.';

const VARIANT_QUESTIONS = Object.freeze({
  stated: Q.CITATION_QUESTIONS_STATED,
  withheld: Q.CITATION_QUESTIONS_WITHHELD,
});
const RELATION_OPTIONS = Object.freeze(['supports', 'contradicts', 'says_nothing']);

class RefusalError extends Error {}

// ---------------------------------------------------------------------------
// Small pure helpers (mirrors scripts/measure-hsi-thinking-mode.cjs).
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

// ---------------------------------------------------------------------------
// loadFixtures({itemsPath, goldPath}) -- D-32: refuses without labeled_at,
// or when fixture_sha256 no longer matches the items file's current bytes.
// ---------------------------------------------------------------------------
function loadFixtures(opts) {
  const o = opts || {};
  const itemsPath = o.itemsPath || DEFAULT_ITEMS_PATH;
  const goldPath = o.goldPath || DEFAULT_GOLD_PATH;
  const itemsRaw = fs.readFileSync(itemsPath, 'utf8');
  const itemsSha256 = sha256Hex(itemsRaw);
  const itemsParsed = JSON.parse(itemsRaw);
  const gold = JSON.parse(fs.readFileSync(goldPath, 'utf8'));
  if (!gold.labeled_at) {
    throw new RefusalError('calibrate-citation-check: refused -- gold fixture has no labeled_at (D-32); label the set before calibrating (' + goldPath + ')');
  }
  if (gold.fixture_sha256 !== itemsSha256) {
    throw new RefusalError('calibrate-citation-check: refused -- fixture_sha256 does not match ' + itemsPath + ' (labeled_at ' + gold.labeled_at + '; items file changed since labeling) (D-32)');
  }
  return {
    itemsSha256,
    items: itemsParsed.items || [],
    noPath: itemsParsed.no_path || [],
    gold,
  };
}

// ---------------------------------------------------------------------------
// summarizeVariant(rows) -- rows: [{pair_id, gold, choice, confidence}].
// Pure, deterministic. `rate`/`agreement`/`coverage_share`/
// `human_routed_share` are fractions (0..1) or null on a zero denominator,
// never NaN and never a misleading zero.
// ---------------------------------------------------------------------------
function summarizeVariant(rows) {
  const n = rows.length;
  let correct = 0;
  for (const r of rows) if (r.choice === r.gold) correct += 1;
  const exact_agreement = { correct, n, rate: n ? correct / n : null };

  const autoRows = rows.filter((r) => typeof r.confidence === 'number' && r.confidence >= AUTO_VERDICT_CONFIDENCE_CUT);
  let autoCorrect = 0;
  for (const r of autoRows) if (r.choice === r.gold) autoCorrect += 1;
  const auto_slice = {
    n: autoRows.length,
    correct: autoCorrect,
    agreement: autoRows.length ? autoCorrect / autoRows.length : null,
    coverage_share: n ? autoRows.length / n : null,
  };
  const human_routed_share = n ? (n - autoRows.length) / n : null;

  return { n, exact_agreement, auto_slice, human_routed_share };
}

// ---------------------------------------------------------------------------
// bandFromMeasured({correct, n}) -- D-46: equals eureka-critic.cjs's own
// confidenceFromBucket, computed from MEASURED accuracy, never Jev's own
// confidence number.
// ---------------------------------------------------------------------------
function bandFromMeasured(bucket) {
  return confidenceFromBucket(bucket);
}

// ---------------------------------------------------------------------------
// makeItemGuard(item, questions) -- per-call closure ceiling: the sent
// state.claim / state.path must be byte/deep-equal to this item's own
// pre-rendered claim and hop list; questions must be one of the two frozen
// citation-check sets.
// ---------------------------------------------------------------------------
function makeItemGuard(item, questions) {
  const closure = function itemClosure(payload) {
    const state = payload.state || {};
    if (state.claim !== item.claim) {
      throw new Error('calibrate-citation-check: claim is not the templated claim for ' + item.pair_id);
    }
    if (!isDeepStrictEqual(state.path, item.path)) {
      throw new Error('calibrate-citation-check: path is not the item hop list for ' + item.pair_id);
    }
    if (!isDeepStrictEqual(payload.questions, questions)) {
      throw new Error('calibrate-citation-check: questions are not a frozen citation-check set for ' + item.pair_id);
    }
    return true;
  };
  return Q.composeGuard(makeEgressGuard(EGRESS_PROFILES.citation_check), closure);
}

// ---------------------------------------------------------------------------
// runCalibration({items, gold, key, fetchImpl, sleepImpl}) -- live (or
// --jev-fixture replay) run: one stated + one withheld call per item.
// Retry/abort policy mirrors measure-hsi-thinking-mode.cjs's
// runLiveRepeats: 401 and a malformed-question 400/422 abort the whole run
// immediately (key withheld from any thrown message); a non-200 response
// is recorded as failed without a retry; a 200 that fails schema parsing
// (including model drift, handled inside parseJevResponse) is retried
// once; any item still failed once every item has been attempted throws
// (denominator guard -- rerun, never report on a shrunken set);
// usage.input_tokens > 8000 on any call aborts the whole run.
// ---------------------------------------------------------------------------
async function runCalibration({ items, gold, key, fetchImpl, sleepImpl }) {
  const goldMap = new Map((gold.items || []).map((g) => [g.id, g]));
  const responses = {};
  const variantRows = {};
  let calls = 0;
  let totalInputTokens = 0;
  let nonZeroStatusCount = 0;

  for (const variant of Object.keys(VARIANT_QUESTIONS)) {
    const questions = VARIANT_QUESTIONS[variant];
    const rows = await pool(items, 4, async (item) => {
      const guard = makeItemGuard(item, questions);
      const body = { model: Q.PINNED_MODEL, state: { claim: item.claim, path: item.path }, questions };
      const bodyKey = canonicalKey(body);
      let attempt = 0;
      let parsed = null;
      for (;;) {
        calls += 1;
        const res = await jev(body, { guard, key, fetchImpl, sleepImpl, timeoutMs: 15000, honorRetryAfter: true });
        if (res.status === 401) {
          const err = new Error('calibrate-citation-check: aborted -- 401 from vendor (key withheld)');
          err.code = 'ABORT_401';
          throw err;
        }
        if (res.status === 400 || res.status === 422) {
          const err = new Error('calibrate-citation-check: aborted -- ' + res.status + ' response for ' + item.pair_id + ' (' + variant + '; malformed question or state, a defect in our own code, not the vendor)');
          err.code = 'ABORT_MALFORMED';
          throw err;
        }
        if (res.status !== 200) {
          nonZeroStatusCount += 1;
          return { pair_id: item.pair_id, status: 'http_' + res.status, gold: null, choice: null, confidence: null };
        }
        parsed = parseJevResponse(res, { relation: RELATION_OPTIONS });
        if (parsed.ok) break;
        if (attempt < 1) { attempt += 1; continue; }
        return { pair_id: item.pair_id, status: parsed.reason, gold: null, choice: null, confidence: null };
      }
      if (parsed.usage.input_tokens > INPUT_TOKEN_TRIPWIRE) {
        const err = new Error('calibrate-citation-check: aborted -- usage.input_tokens ' + parsed.usage.input_tokens + ' exceeds ' + INPUT_TOKEN_TRIPWIRE + ' for ' + item.pair_id + ' (' + variant + ')');
        err.code = 'ABORT_TOKEN_TRIPWIRE';
        throw err;
      }
      totalInputTokens += parsed.usage.input_tokens;
      responses[bodyKey] = [{ model: parsed.model, answers: parsed.answers, usage: parsed.usage }];
      const g = goldMap.get(item.pair_id);
      return {
        pair_id: item.pair_id, status: 'ok',
        gold: g ? g.gold : null,
        choice: parsed.answers.relation.choice,
        confidence: parsed.answers.relation.confidence,
      };
    });

    const failed = rows.filter((r) => r.status !== 'ok');
    if (failed.length) {
      throw new Error(failed.length + ' of ' + rows.length + ' ' + variant + ' items failed (' + failed[0].status + '); rerun, never shrink the denominator');
    }
    variantRows[variant] = rows.map((r) => ({ pair_id: r.pair_id, gold: r.gold, choice: r.choice, confidence: r.confidence }));
  }

  return { responses, variantRows, calls, totalInputTokens, nonZeroStatusCount };
}

// ---------------------------------------------------------------------------
// makeFixtureFetch(fixturePath) -- --jev-fixture replay (mirrors
// measure-hsi-thinking-mode.cjs's version).
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
// buildCitationSection(...) -- the `citation` record section shape shared
// by both the live writer and --check's recompute.
// ---------------------------------------------------------------------------
function buildCitationSection({ variantRows, calls, totalInputTokens, nonZeroStatusCount, itemsSha256, goldLabeledAt, itemCount, noPathCount, now }) {
  const statedSummary = summarizeVariant(variantRows.stated);
  const withheldSummary = summarizeVariant(variantRows.withheld);
  return {
    measured_at: now.toISOString(),
    jev_model: Q.PINNED_MODEL,
    calls,
    non_200: nonZeroStatusCount,
    input_tokens: totalInputTokens,
    cost_usd_estimate: (totalInputTokens / 1e6) * VENDOR_USD_PER_MILLION_INPUT_TOKENS,
    fixture_sha256: itemsSha256,
    gold_labeled_at: goldLabeledAt,
    item_count: itemCount,
    no_path_count: noPathCount,
    stated: statedSummary,
    withheld: withheldSummary,
    band_stated: bandFromMeasured({ correct: statedSummary.auto_slice.correct, n: statedSummary.auto_slice.n }),
    seam_rule: SEAM_RULE_TEXT,
    rule_text_sha256: sha256Hex(Q.CITATION_RULE),
    question_sha256s: {
      stated: Q.questionSha256(Q.CITATION_QUESTIONS_STATED),
      withheld: Q.questionSha256(Q.CITATION_QUESTIONS_WITHHELD),
    },
  };
}

// ---------------------------------------------------------------------------
// runCheck({record, responsesPath, items, gold, itemsSha256, write, writeErr})
// -- offline replay: zero network, never calls loadKey. Recomputes both
// variants from the recorded responses and fails loudly on any drift from
// record.citation (measured_at is never recomputed or compared -- it is a
// wall-clock stamp from the live run, not a derived value).
// ---------------------------------------------------------------------------
function runCheckCitation({ record, responsesPath, items, gold, itemsSha256, write, writeErr }) {
  const out = write || (() => {});
  const err = writeErr || (() => {});
  const citation = record.citation;

  if (!fs.existsSync(responsesPath)) {
    err('calibrate-citation-check --check: no responses fixture at ' + responsesPath);
    return false;
  }
  const responses = JSON.parse(fs.readFileSync(responsesPath, 'utf8'));
  const goldMap = new Map((gold.items || []).map((g) => [g.id, g]));

  if (citation.fixture_sha256 !== itemsSha256) {
    err('calibrate-citation-check --check: citation.fixture_sha256 does not match the current items file');
    return false;
  }

  const variantRows = {};
  for (const variant of Object.keys(VARIANT_QUESTIONS)) {
    const questions = VARIANT_QUESTIONS[variant];
    const rows = [];
    for (const item of items) {
      const body = { model: Q.PINNED_MODEL, state: { claim: item.claim, path: item.path }, questions };
      const key = canonicalKey(body);
      const arr = responses[key];
      const resp = arr && arr[0];
      if (!resp) {
        err('calibrate-citation-check --check: missing recorded response for ' + item.pair_id + ' (' + variant + ')');
        return false;
      }
      if (resp.model !== Q.PINNED_MODEL) {
        err('calibrate-citation-check --check: recorded response for ' + item.pair_id + ' (' + variant + ') has model ' + resp.model + ', not ' + Q.PINNED_MODEL);
        return false;
      }
      const g = goldMap.get(item.pair_id);
      rows.push({ pair_id: item.pair_id, gold: g ? g.gold : null, choice: resp.answers.relation.choice, confidence: resp.answers.relation.confidence });
    }
    variantRows[variant] = rows;
  }

  const recomputedStated = summarizeVariant(variantRows.stated);
  const recomputedWithheld = summarizeVariant(variantRows.withheld);
  if (!isDeepStrictEqual(recomputedStated, citation.stated)) {
    err('calibrate-citation-check --check: recomputed stated summary differs from the record');
    return false;
  }
  if (!isDeepStrictEqual(recomputedWithheld, citation.withheld)) {
    err('calibrate-citation-check --check: recomputed withheld summary differs from the record');
    return false;
  }
  const recomputedBand = bandFromMeasured({ correct: recomputedStated.auto_slice.correct, n: recomputedStated.auto_slice.n });
  if (recomputedBand !== citation.band_stated) {
    err('calibrate-citation-check --check: recomputed band_stated differs from the record');
    return false;
  }

  out('calibrate-citation-check --check: OK (' + items.length + ' items, model ' + citation.jev_model + ', band_stated ' + citation.band_stated + ')');
  return true;
}

// ---------------------------------------------------------------------------
// argv parsing + main().
// ---------------------------------------------------------------------------
function parseArgv(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help') flags.help = true;
    else if (a === '--check') flags.check = true;
    else if (a === '--jev-fixture') { flags.jevFixture = argv[i + 1]; i += 1; }
  }
  return flags;
}

const HELP_TEXT = [
  'calibrate-citation-check.cjs -- Phase 355 Plan 26 (HIPS-09, D-46, AI-SPEC D15)',
  '',
  '  (default)             live: one stated + one withheld call per item',
  '  --jev-fixture <path>  replay a canned response file instead of the vendor',
  '  --check               offline replay against the recorded record; zero network',
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

  let loaded;
  try {
    loaded = loadFixtures({ itemsPath, goldPath });
  } catch (e) {
    writeErr(e && e.message ? e.message : String(e));
    return 1;
  }
  const { items, noPath, gold, itemsSha256 } = loaded;

  if (flags.check) {
    let record = null;
    if (fs.existsSync(recordPath)) {
      record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    }
    if (!record || !record.citation) {
      writeErr('calibrate-citation-check --check: SKIP -- no citation section at ' + recordPath + ' yet; run a live calibration first');
      return 77;
    }
    try {
      const ok = runCheckCitation({ record, responsesPath, items, gold, itemsSha256, write, writeErr });
      return ok ? 0 : 1;
    } catch (e) {
      writeErr('calibrate-citation-check --check: ' + (e && e.message ? e.message : String(e)));
      return 1;
    }
  }

  let key = d.key;
  let fetchImpl = d.fetchImpl;
  if (flags.jevFixture) {
    key = key || 'jev-fixture-replay-not-a-real-key';
    fetchImpl = fetchImpl || makeFixtureFetch(flags.jevFixture);
  } else if (!key) {
    key = loadKey();
    if (!key) {
      writeErr('calibrate-citation-check: SKIP -- no dev-time vendor key resolved (set TYPESAFE_API_KEY or ~/.secrets/typesafe.env)');
      return 3;
    }
  }

  try {
    const { responses, variantRows, calls, totalInputTokens, nonZeroStatusCount } = await runCalibration({
      items, gold, key, fetchImpl, sleepImpl: d.sleepImpl,
    });

    const citation = buildCitationSection({
      variantRows, calls, totalInputTokens, nonZeroStatusCount,
      itemsSha256, goldLabeledAt: gold.labeled_at,
      itemCount: items.length, noPathCount: noPath.length,
      now: d.now ? d.now() : new Date(),
    });

    const existingResponses = fs.existsSync(responsesPath) ? JSON.parse(fs.readFileSync(responsesPath, 'utf8')) : {};
    const mergedResponses = Object.assign({}, existingResponses, responses);
    const existingRecord = fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath, 'utf8')) : {};
    const mergedRecord = Object.assign({}, existingRecord, { citation });

    writeJsonAtomic(responsesPath, mergedResponses);
    writeJsonAtomic(recordPath, mergedRecord);
    write('calibrate-citation-check: wrote ' + responsesPath + ' and the citation section of ' + recordPath + ' (' + calls + ' calls, ' + totalInputTokens + ' input tokens)');
    return 0;
  } catch (e) {
    writeErr(e && e.message ? e.message : String(e));
    return 1;
  }
}

module.exports = {
  runCalibration,
  summarizeVariant,
  bandFromMeasured,
  loadFixtures,
  buildCitationSection,
  canonicalKey,
  main,
  RefusalError,
};

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code || 0))
    .catch((e) => { console.error(e && e.stack || e); process.exit(1); });
}
