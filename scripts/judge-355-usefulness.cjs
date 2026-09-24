#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * scripts/judge-355-usefulness.cjs -- Phase 355 Plan 26 (HIPS-09, D-46,
 * AI-SPEC D18). Dev-time only, never required from lib/ or hooks/
 * (tripwire: tests/test-353-tripwires.cjs leg 2, this script's own name is
 * appended to HOOKS_BANNED_LEDGER_SCRIPTS in the same commit that creates
 * it, per the Phase 356 peer contract).
 *
 * Scores every sitting-1 judged pairing
 * (tests/fixtures/355-rooms/pairings.items.json, 96 items) with one Jev
 * Choice (usefulness_judge profile: useful / not_useful / already_known /
 * none) over { a_excerpt, b_excerpt, direction_phrase, verification } --
 * verification is the stamp TIER WORD from tests/fixtures/355-rooms/
 * stamps.json (strong / indirect / unverified), never a number -- against
 * the navigator's blind gold (tests/fixtures/355-rooms/judgments.json,
 * 355-24). Jev NEVER replaces the navigator's judgment: 355-VERIFICATION.md
 * (D16)'s hit rate is computed from judgments.json alone; this script only
 * measures how far Jev sits from it, per AI-SPEC D18.
 *
 * Agreement mapping: navigator `useful: true` <-> Jev choice `useful`;
 * navigator `useful: false` <-> any other Jev choice (not_useful,
 * already_known, none). Per-tier agreement groups by the stamp's
 * `verification` tier from stamps.json. The `already_known` rate per tier
 * (share of Jev answers that were `already_known`) is a separate figure
 * from `already_known_agreement` (whether Jev's `already_known` choice
 * agrees with the navigator's own `already_known` boolean, overall) --
 * both are reported. The navigator's `direction_ok` label is NOT judged by
 * Jev here (out of scope for D18); it is neither sent to Jev nor scored.
 *
 * Every pairing in pairings.items.json already has a stamp in stamps.json
 * (355-25 Task 1, commit c06156693): a pairing with no stamp entry is a
 * refusal, not a silent skip.
 *
 * D-32: refuses to run against a judgments (gold) file that lacks
 * `labeled_at`, or whose `fixture_sha256` no longer matches the current
 * pairings items file's bytes.
 *
 * Modes (argv switch-case):
 *   (default)             live: one call per pairing against the vendor,
 *                          key from loadKey().
 *   --jev-fixture <path>   replay a canned {sha256Key: [{model,answers,
 *                          usage}]} response map instead of calling the
 *                          vendor (a fake key string is still required by
 *                          the client's guard, never a real secret).
 *   --check                offline replay of the recorded responses
 *                          against the shared calibration record's
 *                          `usefulness` section; zero network, never calls
 *                          loadKey; exits 77 when no `usefulness` section
 *                          exists yet.
 *   --help                 print this file's own mode summary.
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

const ROOT = path.join(__dirname, '..');
const DEFAULT_ITEMS_PATH = path.join(ROOT, 'tests', 'fixtures', '355-rooms', 'pairings.items.json');
const DEFAULT_JUDGMENTS_PATH = path.join(ROOT, 'tests', 'fixtures', '355-rooms', 'judgments.json');
const DEFAULT_STAMPS_PATH = path.join(ROOT, 'tests', 'fixtures', '355-rooms', 'stamps.json');
const DEFAULT_RESPONSES_PATH = path.join(ROOT, 'tests', 'fixtures', '355-jev-usefulness-responses.json');
const DEFAULT_RECORD_PATH = path.join(ROOT, 'tests', 'fixtures', '355-jev-calibration-record.json');

const INPUT_TOKEN_TRIPWIRE = 8000;
const VENDOR_USD_PER_MILLION_INPUT_TOKENS = 0.042; // docs.typesafe.ai/models.md, vendor-documented
const USEFULNESS_OPTIONS = Object.freeze(['useful', 'not_useful', 'already_known', 'none']);

class RefusalError extends Error {}

// ---------------------------------------------------------------------------
// Small pure helpers (mirrors scripts/calibrate-citation-check.cjs).
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
// loadFixtures({itemsPath, judgmentsPath, stampsPath}) -- D-32: refuses
// without labeled_at, or when fixture_sha256 no longer matches the
// pairings items file's current bytes. Also refuses if any pairing has no
// stamp entry (a stamp is required to supply the `verification` tier).
// ---------------------------------------------------------------------------
function loadFixtures(opts) {
  const o = opts || {};
  const itemsPath = o.itemsPath || DEFAULT_ITEMS_PATH;
  const judgmentsPath = o.judgmentsPath || DEFAULT_JUDGMENTS_PATH;
  const stampsPath = o.stampsPath || DEFAULT_STAMPS_PATH;

  const itemsRaw = fs.readFileSync(itemsPath, 'utf8');
  const itemsSha256 = sha256Hex(itemsRaw);
  const itemsParsed = JSON.parse(itemsRaw);
  const items = itemsParsed.items || [];

  const judgments = JSON.parse(fs.readFileSync(judgmentsPath, 'utf8'));
  if (!judgments.labeled_at) {
    throw new RefusalError('judge-355-usefulness: refused -- judgments fixture has no labeled_at (D-32); judge the set before scoring (' + judgmentsPath + ')');
  }
  if (judgments.fixture_sha256 !== itemsSha256) {
    throw new RefusalError('judge-355-usefulness: refused -- fixture_sha256 does not match ' + itemsPath + ' (labeled_at ' + judgments.labeled_at + '; items file changed since judging) (D-32)');
  }

  const stamps = JSON.parse(fs.readFileSync(stampsPath, 'utf8'));
  const tierMap = new Map();
  for (const it of items) {
    const entry = stamps.by_pair && stamps.by_pair[it.pair_id];
    if (!entry || !entry.stamp || !entry.stamp.verification) {
      throw new RefusalError('judge-355-usefulness: refused -- no stamp tier for pairing ' + it.pair_id + ' in ' + stampsPath);
    }
    tierMap.set(it.pair_id, entry.stamp.verification);
  }

  return { itemsSha256, items, judgments, tierMap };
}

// ---------------------------------------------------------------------------
// agreement(rows) -- rows: [{pair_id, useful, already_known, choice,
// confidence, tier}]. navigator useful:true <-> Jev choice 'useful';
// useful:false <-> any other choice. Pure, deterministic.
// ---------------------------------------------------------------------------
function agreement(rows) {
  let agree = 0;
  for (const r of rows) if ((r.choice === 'useful') === r.useful) agree += 1;
  return { n: rows.length, agree, rate: rows.length ? agree / rows.length : null };
}

function groupByTier(rows) {
  const groups = {};
  for (const r of rows) {
    groups[r.tier] = groups[r.tier] || [];
    groups[r.tier].push(r);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// perTierAgreement(rows) -- agreement(), grouped by stamp tier.
// ---------------------------------------------------------------------------
function perTierAgreement(rows) {
  const groups = groupByTier(rows);
  const out = {};
  for (const tier of Object.keys(groups)) out[tier] = agreement(groups[tier]);
  return out;
}

// ---------------------------------------------------------------------------
// alreadyKnownByTier(rows) -- share of Jev answers that were
// 'already_known', grouped by stamp tier (the cross-tab D-flywheel rows
// use). NOT the same as alreadyKnownAgreement below.
// ---------------------------------------------------------------------------
function alreadyKnownByTier(rows) {
  const groups = groupByTier(rows);
  const out = {};
  for (const tier of Object.keys(groups)) {
    const g = groups[tier];
    const count = g.filter((r) => r.choice === 'already_known').length;
    out[tier] = { n: g.length, count, rate: g.length ? count / g.length : null };
  }
  return out;
}

// ---------------------------------------------------------------------------
// alreadyKnownAgreement(rows) -- overall agreement between Jev's
// 'already_known' choice and the navigator's own already_known boolean.
// ---------------------------------------------------------------------------
function alreadyKnownAgreement(rows) {
  let agree = 0;
  for (const r of rows) if ((r.choice === 'already_known') === r.already_known) agree += 1;
  return { n: rows.length, agree, rate: rows.length ? agree / rows.length : null };
}

// ---------------------------------------------------------------------------
// runJudge({items, judgments, tierMap, key, fetchImpl, sleepImpl}) -- live
// (or --jev-fixture replay) run: one call per pairing. Retry/abort policy
// mirrors calibrate-citation-check.cjs's runCalibration: 401 and a
// malformed-question 400/422 abort the whole run immediately (key withheld
// from any thrown message); a non-200 response is recorded as failed
// without a retry; a 200 that fails schema parsing (including model
// drift, inside parseJevResponse) is retried once; any item still failed
// once every item has been attempted throws (denominator guard -- rerun,
// never report on a shrunken set); usage.input_tokens > 8000 on any call
// aborts the whole run.
// ---------------------------------------------------------------------------
async function runJudge({ items, judgments, tierMap, key, fetchImpl, sleepImpl }) {
  const judgmentsMap = new Map((judgments.items || []).map((j) => [j.pair_id, j]));
  const pairMap = new Map(items.map((it) => [it.pair_id, {
    a_excerpt: it.a_excerpt, b_excerpt: it.b_excerpt, direction_phrase: it.direction_phrase,
  }]));
  const guard = Q.makeUsefulnessCeiling(pairMap);

  const responses = {};
  let calls = 0;
  let totalInputTokens = 0;
  let nonZeroStatusCount = 0;

  const out = await pool(items, 4, async (item) => {
    const tier = tierMap.get(item.pair_id);
    const body = {
      model: Q.PINNED_MODEL,
      state: { a_excerpt: item.a_excerpt, b_excerpt: item.b_excerpt, direction_phrase: item.direction_phrase, verification: tier },
      questions: Q.USEFULNESS_QUESTIONS,
    };
    const bodyKey = canonicalKey(body);
    let attempt = 0;
    let parsed = null;
    for (;;) {
      calls += 1;
      const res = await jev(body, { guard, key, fetchImpl, sleepImpl, timeoutMs: 15000, honorRetryAfter: true });
      if (res.status === 401) {
        const err = new Error('judge-355-usefulness: aborted -- 401 from vendor (key withheld)');
        err.code = 'ABORT_401';
        throw err;
      }
      if (res.status === 400 || res.status === 422) {
        const err = new Error('judge-355-usefulness: aborted -- ' + res.status + ' response for ' + item.pair_id + ' (malformed question or state, a defect in our own code, not the vendor)');
        err.code = 'ABORT_MALFORMED';
        throw err;
      }
      if (res.status !== 200) {
        nonZeroStatusCount += 1;
        return { pair_id: item.pair_id, status: 'http_' + res.status, tier, useful: null, already_known: null, choice: null, confidence: null };
      }
      parsed = parseJevResponse(res, { usefulness: USEFULNESS_OPTIONS });
      if (parsed.ok) break;
      if (attempt < 1) { attempt += 1; continue; }
      return { pair_id: item.pair_id, status: parsed.reason, tier, useful: null, already_known: null, choice: null, confidence: null };
    }
    if (parsed.usage.input_tokens > INPUT_TOKEN_TRIPWIRE) {
      const err = new Error('judge-355-usefulness: aborted -- usage.input_tokens ' + parsed.usage.input_tokens + ' exceeds ' + INPUT_TOKEN_TRIPWIRE + ' for ' + item.pair_id);
      err.code = 'ABORT_TOKEN_TRIPWIRE';
      throw err;
    }
    totalInputTokens += parsed.usage.input_tokens;
    responses[bodyKey] = [{ model: parsed.model, answers: parsed.answers, usage: parsed.usage }];
    const j = judgmentsMap.get(item.pair_id);
    return {
      pair_id: item.pair_id, status: 'ok', tier,
      useful: j ? j.useful : null,
      already_known: j ? j.already_known : null,
      choice: parsed.answers.usefulness.choice,
      confidence: parsed.answers.usefulness.confidence,
    };
  });

  const failed = out.filter((r) => r.status !== 'ok');
  if (failed.length) {
    throw new Error(failed.length + ' of ' + out.length + ' items failed (' + failed[0].status + '); rerun, never shrink the denominator');
  }
  const rows = out.map((r) => ({ pair_id: r.pair_id, tier: r.tier, useful: r.useful, already_known: r.already_known, choice: r.choice, confidence: r.confidence }));

  return { responses, rows, calls, totalInputTokens, nonZeroStatusCount };
}

// ---------------------------------------------------------------------------
// makeFixtureFetch(fixturePath) -- --jev-fixture replay.
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
// buildUsefulnessSection(...) -- the `usefulness` record section shape
// shared by both the live writer and --check's recompute.
// ---------------------------------------------------------------------------
function buildUsefulnessSection({ rows, calls, totalInputTokens, nonZeroStatusCount, itemsSha256, judgmentsLabeledAt, now }) {
  return {
    measured_at: now.toISOString(),
    jev_model: Q.PINNED_MODEL,
    calls,
    non_200: nonZeroStatusCount,
    input_tokens: totalInputTokens,
    cost_usd_estimate: (totalInputTokens / 1e6) * VENDOR_USD_PER_MILLION_INPUT_TOKENS,
    fixture_sha256: itemsSha256,
    judgments_labeled_at: judgmentsLabeledAt,
    n: rows.length,
    agreement: agreement(rows),
    per_tier: perTierAgreement(rows),
    already_known_by_tier: alreadyKnownByTier(rows),
    already_known_agreement: alreadyKnownAgreement(rows),
  };
}

// ---------------------------------------------------------------------------
// runCheck({record, responsesPath, items, judgments, tierMap, itemsSha256,
// write, writeErr}) -- offline replay: zero network, never calls loadKey.
// (measured_at is never recomputed or compared -- a wall-clock stamp from
// the live run, not a derived value.)
// ---------------------------------------------------------------------------
function runCheckUsefulness({ record, responsesPath, items, judgments, tierMap, itemsSha256, write, writeErr }) {
  const out = write || (() => {});
  const err = writeErr || (() => {});
  const usefulness = record.usefulness;

  if (!fs.existsSync(responsesPath)) {
    err('judge-355-usefulness --check: no responses fixture at ' + responsesPath);
    return false;
  }
  const responses = JSON.parse(fs.readFileSync(responsesPath, 'utf8'));
  const judgmentsMap = new Map((judgments.items || []).map((j) => [j.pair_id, j]));

  if (usefulness.fixture_sha256 !== itemsSha256) {
    err('judge-355-usefulness --check: usefulness.fixture_sha256 does not match the current items file');
    return false;
  }

  const rows = [];
  for (const item of items) {
    const tier = tierMap.get(item.pair_id);
    const body = {
      model: Q.PINNED_MODEL,
      state: { a_excerpt: item.a_excerpt, b_excerpt: item.b_excerpt, direction_phrase: item.direction_phrase, verification: tier },
      questions: Q.USEFULNESS_QUESTIONS,
    };
    const key = canonicalKey(body);
    const arr = responses[key];
    const resp = arr && arr[0];
    if (!resp) {
      err('judge-355-usefulness --check: missing recorded response for ' + item.pair_id);
      return false;
    }
    if (resp.model !== Q.PINNED_MODEL) {
      err('judge-355-usefulness --check: recorded response for ' + item.pair_id + ' has model ' + resp.model + ', not ' + Q.PINNED_MODEL);
      return false;
    }
    const j = judgmentsMap.get(item.pair_id);
    rows.push({ pair_id: item.pair_id, tier, useful: j ? j.useful : null, already_known: j ? j.already_known : null, choice: resp.answers.usefulness.choice, confidence: resp.answers.usefulness.confidence });
  }

  const recomputedAgreement = agreement(rows);
  const recomputedPerTier = perTierAgreement(rows);
  const recomputedAlreadyKnownByTier = alreadyKnownByTier(rows);
  const recomputedAlreadyKnownAgreement = alreadyKnownAgreement(rows);

  if (!isDeepStrictEqual(recomputedAgreement, usefulness.agreement)) {
    err('judge-355-usefulness --check: recomputed agreement differs from the record');
    return false;
  }
  if (!isDeepStrictEqual(recomputedPerTier, usefulness.per_tier)) {
    err('judge-355-usefulness --check: recomputed per_tier agreement differs from the record');
    return false;
  }
  if (!isDeepStrictEqual(recomputedAlreadyKnownByTier, usefulness.already_known_by_tier)) {
    err('judge-355-usefulness --check: recomputed already_known_by_tier differs from the record');
    return false;
  }
  if (!isDeepStrictEqual(recomputedAlreadyKnownAgreement, usefulness.already_known_agreement)) {
    err('judge-355-usefulness --check: recomputed already_known_agreement differs from the record');
    return false;
  }
  if (usefulness.n !== rows.length) {
    err('judge-355-usefulness --check: recomputed n differs from the record');
    return false;
  }

  out('judge-355-usefulness --check: OK (' + rows.length + ' pairings, model ' + usefulness.jev_model + ', agreement rate ' + usefulness.agreement.rate + ')');
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
  'judge-355-usefulness.cjs -- Phase 355 Plan 26 (HIPS-09, D-46, AI-SPEC D18)',
  '',
  '  (default)             live: one call per pairing against the vendor',
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
  const judgmentsPath = d.judgmentsPath || DEFAULT_JUDGMENTS_PATH;
  const stampsPath = d.stampsPath || DEFAULT_STAMPS_PATH;
  const responsesPath = d.responsesPath || DEFAULT_RESPONSES_PATH;
  const recordPath = d.recordPath || DEFAULT_RECORD_PATH;

  let loaded;
  try {
    loaded = loadFixtures({ itemsPath, judgmentsPath, stampsPath });
  } catch (e) {
    writeErr(e && e.message ? e.message : String(e));
    return 1;
  }
  const { items, judgments, tierMap, itemsSha256 } = loaded;

  if (flags.check) {
    let record = null;
    if (fs.existsSync(recordPath)) {
      record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    }
    if (!record || !record.usefulness) {
      writeErr('judge-355-usefulness --check: SKIP -- no usefulness section at ' + recordPath + ' yet; run a live judge first');
      return 77;
    }
    try {
      const ok = runCheckUsefulness({ record, responsesPath, items, judgments, tierMap, itemsSha256, write, writeErr });
      return ok ? 0 : 1;
    } catch (e) {
      writeErr('judge-355-usefulness --check: ' + (e && e.message ? e.message : String(e)));
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
      writeErr('judge-355-usefulness: SKIP -- no dev-time vendor key resolved (set TYPESAFE_API_KEY or ~/.secrets/typesafe.env)');
      return 3;
    }
  }

  try {
    const { responses, rows, calls, totalInputTokens, nonZeroStatusCount } = await runJudge({
      items, judgments, tierMap, key, fetchImpl, sleepImpl: d.sleepImpl,
    });

    const usefulness = buildUsefulnessSection({
      rows, calls, totalInputTokens, nonZeroStatusCount,
      itemsSha256, judgmentsLabeledAt: judgments.labeled_at,
      now: d.now ? d.now() : new Date(),
    });

    const existingResponses = fs.existsSync(responsesPath) ? JSON.parse(fs.readFileSync(responsesPath, 'utf8')) : {};
    const mergedResponses = Object.assign({}, existingResponses, responses);
    const existingRecord = fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath, 'utf8')) : {};
    const mergedRecord = Object.assign({}, existingRecord, { usefulness });

    writeJsonAtomic(responsesPath, mergedResponses);
    writeJsonAtomic(recordPath, mergedRecord);
    write('judge-355-usefulness: wrote ' + responsesPath + ' and the usefulness section of ' + recordPath + ' (' + calls + ' calls, ' + totalInputTokens + ' input tokens)');
    return 0;
  } catch (e) {
    writeErr(e && e.message ? e.message : String(e));
    return 1;
  }
}

module.exports = {
  runJudge,
  agreement,
  perTierAgreement,
  alreadyKnownByTier,
  alreadyKnownAgreement,
  loadFixtures,
  buildUsefulnessSection,
  canonicalKey,
  main,
  RefusalError,
};

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code || 0))
    .catch((e) => { console.error(e && e.stack || e); process.exit(1); });
}
