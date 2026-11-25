'use strict';
// Phase 400 plan 12 (RL-02, O-09): bounded per-bucket and global daily caps of the decision relay.
// In memory, one process, no store. The pattern follows the Theo install-id rate limit (bounded Maps,
// an address ceiling beside the install bucket); it is written again here in plain CJS.
//
// take(caller, questions, address) checks in this order and counts nothing when it refuses:
//   bucket_table_full (a new install or address bucket on a full table)
//   address_rate (per-minute requests), address_daily_requests (requests) - review WR-01: the install id is
//     self-minted, so only the address bounds one source; these two run before every install check,
//   install_rate (per-minute requests), install_daily_cap (questions), address_daily_cap (questions),
//   global_daily_requests, global_daily_questions, global_token_cap (input tokens added by recordUsage).
// The operator skips every user cap and meets only its own caps: operator_rate (per-minute requests),
// operator_daily_cap (questions) and operator_token_cap (input tokens added by recordUsage). Operator
// usage is kept apart from the user counters, so a release-time table build does not use up the user budget.
// Daily counters reset at UTC midnight. Keys are hashes: install buckets arrive hashed from
// verify-caller.cjs, and addresses are hashed here with a per-process random salt. snapshot() is counts only.
// CJS, node built-ins only. Hyphens only.

const crypto = require('node:crypto');

const MINUTE_MS = 60000;
const DAY_MS = 86400000;

function refuse(reason, retryAfterS) {
  return { ok: false, status: 429, reason, retryAfterS: Math.max(1, Math.ceil(retryAfterS)) };
}

function createLimits(cfg, nowFn) {
  const c = cfg || {};
  const now = typeof nowFn === 'function' ? nowFn : Date.now;
  const salt = crypto.randomBytes(16);
  const maxBuckets = c.maxBuckets;

  let day = -1;
  let minute = new Map(); // install bucket -> { count, resetAt }
  let installDaily = new Map(); // install bucket -> questions today
  let addressDaily = new Map(); // address hash -> questions today
  let addressDailyReq = new Map(); // address hash -> requests today (same keys as addressDaily)
  const addressMinute = new Map(); // address hash -> { count, resetAt }
  let globalRequests = 0;
  let globalQuestions = 0;
  let globalInputTokens = 0;
  let operatorQuestions = 0;
  let operatorRequests = 0;
  let operatorInputTokens = 0;
  let operatorMinute = null; // { count, resetAt } of the operator per-minute window

  function roll(t) {
    const d = Math.floor(t / DAY_MS);
    if (d === day) return;
    day = d;
    installDaily = new Map();
    addressDaily = new Map();
    addressDailyReq = new Map();
    globalRequests = 0;
    globalQuestions = 0;
    globalInputTokens = 0;
    operatorQuestions = 0;
    operatorRequests = 0;
    operatorInputTokens = 0;
  }

  function toMidnightS(t) {
    return ((day + 1) * DAY_MS - t) / 1000;
  }

  function addressKey(address) {
    const a = typeof address === 'string' && address.length > 0 ? address : 'unknown';
    return crypto.createHmac('sha256', salt).update(a, 'utf8').digest('hex').slice(0, 32);
  }

  // Drop expired minute windows when the table is full, so a minute Map stays bounded.
  function sweepMinute(table, t) {
    if (table.size < maxBuckets) return;
    for (const [k, w] of table) if (w.resetAt <= t) table.delete(k);
  }

  function take(caller, questions, address) {
    const t = now();
    roll(t);
    const n = Number.isInteger(questions) && questions > 0 ? questions : 0;

    if (caller && caller.kind === 'operator') {
      // WR-02: a leaked token is bounded by a per-minute request window and a daily input-token cap,
      // not by the daily question count only. Checked in this order; a refusal counts nothing.
      if (operatorMinute && operatorMinute.resetAt <= t) operatorMinute = null;
      if (operatorMinute && operatorMinute.count + 1 > c.operatorPerMinute) return refuse('operator_rate', (operatorMinute.resetAt - t) / 1000);
      if (operatorQuestions + n > c.operatorDailyQuestions) return refuse('operator_daily_cap', toMidnightS(t));
      if (operatorInputTokens >= c.operatorDailyInputTokens) return refuse('operator_token_cap', toMidnightS(t));
      if (!operatorMinute) operatorMinute = { count: 0, resetAt: t + MINUTE_MS };
      operatorMinute.count += 1;
      operatorQuestions += n;
      operatorRequests += 1;
      return { ok: true };
    }

    const bucket = caller && typeof caller.bucket === 'string' ? caller.bucket : 'unknown';
    const addr = addressKey(address);
    if (!installDaily.has(bucket) && installDaily.size >= maxBuckets) return refuse('bucket_table_full', toMidnightS(t));
    if (!addressDaily.has(addr) && addressDaily.size >= maxBuckets) return refuse('bucket_table_full', toMidnightS(t));

    // WR-01: the per-address request window and daily request cap, before every install check.
    let aw = addressMinute.get(addr);
    if (aw && aw.resetAt <= t) aw = undefined;
    if (aw && aw.count + 1 > c.addressPerMinute) return refuse('address_rate', (aw.resetAt - t) / 1000);
    const usedAddressReq = addressDailyReq.get(addr) || 0;
    if (usedAddressReq + 1 > c.addressDailyRequests) return refuse('address_daily_requests', toMidnightS(t));

    let w = minute.get(bucket);
    if (w && w.resetAt <= t) w = undefined;
    if (w && w.count + 1 > c.installPerMinute) return refuse('install_rate', (w.resetAt - t) / 1000);

    const usedInstall = installDaily.get(bucket) || 0;
    if (usedInstall + n > c.installDailyQuestions) return refuse('install_daily_cap', toMidnightS(t));
    const usedAddress = addressDaily.get(addr) || 0;
    if (usedAddress + n > c.addressDailyQuestions) return refuse('address_daily_cap', toMidnightS(t));
    if (globalRequests + 1 > c.globalDailyRequests) return refuse('global_daily_requests', toMidnightS(t));
    if (globalQuestions + n > c.globalDailyQuestions) return refuse('global_daily_questions', toMidnightS(t));
    if (globalInputTokens >= c.globalDailyInputTokens) return refuse('global_token_cap', toMidnightS(t));

    // Every check passed: count the call.
    if (!w) {
      sweepMinute(minute, t);
      w = { count: 0, resetAt: t + MINUTE_MS };
      minute.set(bucket, w);
    }
    w.count += 1;
    if (!aw) {
      sweepMinute(addressMinute, t);
      aw = { count: 0, resetAt: t + MINUTE_MS };
      addressMinute.set(addr, aw);
    }
    aw.count += 1;
    installDaily.set(bucket, usedInstall + n);
    addressDaily.set(addr, usedAddress + n);
    addressDailyReq.set(addr, usedAddressReq + 1);
    globalRequests += 1;
    globalQuestions += n;
    return { ok: true };
  }

  function recordUsage(caller, inputTokens) {
    roll(now());
    const n = Number.isInteger(inputTokens) && inputTokens > 0 ? inputTokens : 0;
    if (caller && caller.kind === 'operator') operatorInputTokens += n;
    else globalInputTokens += n;
  }

  function snapshot() {
    roll(now());
    return {
      day: new Date(day * DAY_MS).toISOString().slice(0, 10),
      installBuckets: installDaily.size,
      addressBuckets: addressDaily.size,
      minuteWindows: minute.size,
      addressMinuteWindows: addressMinute.size,
      globalRequests,
      globalQuestions,
      globalInputTokens,
      operatorRequests,
      operatorQuestions,
      operatorInputTokens,
    };
  }

  return { take, recordUsage, snapshot };
}

module.exports = { createLimits };
