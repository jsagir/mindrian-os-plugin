'use strict';
// Phase 400 plan 12 (RL-02): relay configuration from the environment, with stated defaults.
// The defaults are proposals; the owner sets the real values at deploy time (OWNER-GATED).
// The Gemini key value is never copied into the config. Only `hasKey` says whether it is present.
// CJS, node built-ins only, no npm dependency. Hyphens only.

const KEY_ENV = 'GEMINI_API_KEY';

const DEFAULTS = Object.freeze({
  userTraffic: false,
  operatorHashes: Object.freeze([]),
  droppedHashes: 0,
  hasKey: false,
  proxyHops: 0,
  maxBodyBytes: 524288,
  maxQuestions: 1000,
  installPerMinute: 10,
  installDailyQuestions: 2000,
  addressDailyQuestions: 20000,
  addressPerMinute: 20,
  addressDailyRequests: 500,
  globalDailyRequests: 5000,
  globalDailyQuestions: 100000,
  globalDailyInputTokens: 20000000,
  operatorDailyQuestions: 200000,
  operatorPerMinute: 30,
  operatorDailyInputTokens: 40000000,
  maxInFlight: 4,
  maxBuckets: 10000,
  upstreamTimeoutMs: 120000,
});

// env name -> [config field, smallest accepted value]
const NUMBERS = Object.freeze({
  RELAY_PROXY_HOPS: ['proxyHops', 0],
  RELAY_MAX_BODY_BYTES: ['maxBodyBytes', 1],
  RELAY_MAX_QUESTIONS: ['maxQuestions', 1],
  RELAY_INSTALL_PER_MINUTE: ['installPerMinute', 1],
  RELAY_INSTALL_DAILY_QUESTIONS: ['installDailyQuestions', 1],
  RELAY_ADDRESS_DAILY_QUESTIONS: ['addressDailyQuestions', 1],
  RELAY_ADDRESS_PER_MINUTE: ['addressPerMinute', 1],
  RELAY_ADDRESS_DAILY_REQUESTS: ['addressDailyRequests', 1],
  RELAY_GLOBAL_DAILY_REQUESTS: ['globalDailyRequests', 1],
  RELAY_GLOBAL_DAILY_QUESTIONS: ['globalDailyQuestions', 1],
  RELAY_GLOBAL_DAILY_INPUT_TOKENS: ['globalDailyInputTokens', 1],
  RELAY_OPERATOR_DAILY_QUESTIONS: ['operatorDailyQuestions', 1],
  RELAY_OPERATOR_PER_MINUTE: ['operatorPerMinute', 1],
  RELAY_OPERATOR_DAILY_INPUT_TOKENS: ['operatorDailyInputTokens', 1],
  RELAY_MAX_IN_FLIGHT: ['maxInFlight', 1],
  RELAY_MAX_BUCKETS: ['maxBuckets', 1],
  RELAY_UPSTREAM_TIMEOUT_MS: ['upstreamTimeoutMs', 1],
});

const HASH_RE = /^[a-f0-9]{64}$/;

// Digits only: no sign, no fraction, no exponent, no spaces. Anything else falls back to the default.
function parseCount(raw, min) {
  if (typeof raw !== 'string' || !/^[0-9]{1,15}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= min ? n : null;
}

function parseHashes(raw) {
  const kept = [];
  let dropped = 0;
  if (typeof raw !== 'string') return { kept, dropped };
  for (const part of raw.split(',')) {
    const h = part.trim().toLowerCase();
    if (h.length === 0) continue;
    if (HASH_RE.test(h)) { if (kept.indexOf(h) === -1) kept.push(h); } else dropped += 1;
  }
  return { kept, dropped };
}

function loadConfig(env) {
  const e = env || {};
  const cfg = {};
  for (const k of Object.keys(DEFAULTS)) cfg[k] = DEFAULTS[k];
  // Only the exact value `on` turns user traffic on (F-09: the paid tier must be confirmed first).
  cfg.userTraffic = e.RELAY_USER_TRAFFIC === 'on';
  const hashes = parseHashes(e.RELAY_OPERATOR_TOKEN_SHA256);
  cfg.operatorHashes = Object.freeze(hashes.kept);
  cfg.droppedHashes = hashes.dropped;
  cfg.hasKey = typeof e[KEY_ENV] === 'string' && e[KEY_ENV].length > 0;
  for (const name of Object.keys(NUMBERS)) {
    const [field, min] = NUMBERS[name];
    const v = parseCount(e[name], min);
    if (v !== null) cfg[field] = v;
  }
  return cfg;
}

module.exports = { loadConfig, DEFAULTS, KEY_ENV };
