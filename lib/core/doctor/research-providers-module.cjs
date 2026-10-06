'use strict';
/*
 * lib/core/doctor/research-providers-module.cjs -- Phase 369.2 Plan 26 (HARNESS-03, SW-11, SEED-120 CFG-01; R15).
 *
 * A cadence:always, fix_supported:false, flag:null doctor module (the check(ctx) contract of
 * capability-ledger-module.cjs). It publishes the lens-to-provider reachability matrix: for every research
 * lens, which provider answers it and one state a person can read:
 *
 *   ready              the provider's gate is met (a key is set)
 *   ready (keyless)    the provider needs no key
 *   no key             the provider needs a key that is not set
 *   line off           the egress policy line for the provider is off
 *   not checked offline  the provider is a remote service; this module never calls it
 *
 * Sources of truth, all read from disk and the process environment, never copied:
 *   - LENS_TO_SOURCE in lib/lens-engine/source-lens-driver.cjs (which provider each lens uses)
 *   - data/research-sources.json gates, through research-corpus.sourceGateStatus
 *   - data/egress-policy.json, through research-planner/egress-policy.cjs (the theo and judge_jev lines)
 *
 * Canon Part 8: ZERO network calls. The module reads key PRESENCE only; no key value reaches a row, a finding
 * or the detail string (T-369.2-26-02). It never blocks: the status is 'ok' unless the module itself fails.
 *
 * Contract: check(ctx) -> { status, detail, rows }. matrix(opts) -> [{ lens, provider, state, needs }].
 * No fix export (fix_supported is false; the contract-parity gate enforces the two-way declaration).
 * No em-dashes anywhere in this file (house rule).
 */

const STATE_READY = 'ready';
const STATE_KEYLESS = 'ready (keyless)';
const STATE_NO_KEY = 'no key';
const STATE_LINE_OFF = 'line off';
const STATE_NOT_CHECKED = 'not checked offline';

// Rows after the lens rows: the planner's own search line, the Theo line, and the judge line.
const JUDGE_LINE = 'judge_jev';
// The name of the Jev key variable lives in data/eureka-judge-lines.json (key_env), not in lib/:
// tests/test-355-part8-egress.cjs leg D bans the name on any non-comment lib/ line (Phase 355 D-44).
// Same precedent as plan 369.2-27. The key is checked for presence only; the value is never read into a row.
function judgeKeyEnv() {
  try {
    const doc = JSON.parse(require('fs').readFileSync(require('path').resolve(__dirname, '..', '..', '..', 'data', 'eureka-judge-lines.json'), 'utf8'));
    if (doc && typeof doc.key_env === 'string' && doc.key_env.length > 0) return doc.key_env;
  } catch (_e) { /* fall through: no name, no key */ }
  return '';
}

function lineIsOn(policy, line) {
  const l = policy && policy.lines && policy.lines[line];
  return !!l && l.allowed === true;
}

// gateState(source) -> { state, needs } from the source's env gates (presence only).
function gateState(corpus, source) {
  const gate = corpus.sourceGateStatus(source);
  if (gate.known === false) return { state: STATE_NO_KEY, needs: 'unknown_source' };
  if (!gate.met) return { state: STATE_NO_KEY, needs: gate.unmet.join(',') };
  const entry = corpus._adapters.SOURCE_BY_ID[source];
  const gates = entry && Array.isArray(entry.gates) ? entry.gates : [];
  const hasEnvGate = gates.some(function (g) { return typeof g === 'string' && g.indexOf('env:') === 0; });
  return { state: hasEnvGate ? STATE_READY : STATE_KEYLESS, needs: '' };
}

function matrix(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const driver = require('../../lens-engine/source-lens-driver.cjs');
  const corpus = require('../research-corpus.cjs');
  const egress = require('../research-planner/egress-policy.cjs');
  const lensToSource = driver._internal.LENS_TO_SOURCE;
  const policy = egress.loadEgressPolicy(typeof o.roomDir === 'string' ? o.roomDir : '', { offline: o.offline === true });
  const rows = [];

  Object.keys(lensToSource).forEach(function (lens) {
    const source = lensToSource[lens];
    if (source === 'brain-cypher') {
      // The Brain lane is Theo. A remote service: line off, or reachable-in-principle but never called here.
      let state = STATE_NOT_CHECKED;
      let needs = '';
      if (!lineIsOn(policy, 'theo')) {
        state = STATE_LINE_OFF;
      } else {
        let available = true;
        try { available = require('../brain-client.cjs').isAvailable(); } catch (_e) { available = false; }
        if (!available) { state = STATE_NO_KEY; needs = 'brain:isAvailable'; }
      }
      rows.push({ lens: lens, provider: 'theo', state: state, needs: needs });
      return;
    }
    const g = gateState(corpus, source);
    rows.push({ lens: lens, provider: source, state: g.state, needs: g.needs });
  });

  // The research planner's own search line: OpenAlex, keyless, offline-safe at plan time.
  const planner = gateState(corpus, 'openalex');
  rows.push({ lens: 'planner', provider: 'openalex', state: planner.state, needs: planner.needs });

  // The Theo line the planner and the Brain lane share.
  rows.push({ lens: 'theo', provider: 'theo', state: lineIsOn(policy, 'theo') ? STATE_NOT_CHECKED : STATE_LINE_OFF, needs: '' });

  // The judge line (Jev, TypeSafe): off by default; when on, it needs its key.
  let judgeState = STATE_LINE_OFF;
  let judgeNeeds = '';
  if (lineIsOn(policy, JUDGE_LINE)) {
    const keyEnv = judgeKeyEnv();
    if (keyEnv && process.env[keyEnv]) { judgeState = STATE_READY; } else { judgeState = STATE_NO_KEY; judgeNeeds = 'env:' + keyEnv; }
  }
  rows.push({ lens: JUDGE_LINE, provider: 'typesafe', state: judgeState, needs: judgeNeeds });
  return rows;
}

function check(ctx) {
  const c = (ctx && typeof ctx === 'object') ? ctx : {};
  let rows;
  try {
    rows = matrix({ roomDir: c.roomDir, offline: c.offline === true });
  } catch (e) {
    return { status: 'error', detail: 'research-providers: could not build the matrix (' + ((e && e.message) || e) + ')' };
  }
  const ready = rows.filter(function (r) { return r.state.indexOf('ready') === 0; }).length;
  const lines = rows.map(function (r) { return r.lens + ' -> ' + r.provider + ': ' + r.state; });
  const detail = 'research-providers: ' + ready + ' of ' + rows.length + ' lines ready (no network was called)\n' + lines.join('\n');
  return { status: 'ok', detail: detail, rows: rows, findings: lines };
}

module.exports = {
  check: check,
  matrix: matrix,
};
