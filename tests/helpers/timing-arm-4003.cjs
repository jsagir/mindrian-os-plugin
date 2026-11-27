'use strict';
/*
 * Phase 400.3 wave 2 Goldfish W2-CD-06: one rule for the timing arms that are not deterministic.
 *
 * A breach runs the measurement once more. The arm fails only when both runs breach. Each run prints its measured
 * value with the bound and the load average, so a breach on a loaded machine is visible and no bound is raised.
 * Deterministic arms (K1 of the 06b hookcap group and the C10 index busy arm) keep their hard bound and do not use it.
 *
 * measure() returns { value, ok, funcOk, detail } (value in ms). funcOk is the functional part of the arm (exit code,
 * result, sentence). Wave 2 re-review W2R-01: a functional failure is never retried; the arm fails at once. Only a
 * breach of the time or load bound (ok false while funcOk is not false) runs once more.
 * timedSync takes a sync measure; timedAsync takes one that
 * may return a promise. Both return { ok, label, detail } for the check() of the calling test.
 * Node built-ins only. Hyphens only.
 */
const os = require('node:os');

function loadAverage() {
  try { return os.loadavg().map((x) => x.toFixed(2)).join(' '); } catch (_e) { return 'unknown'; }
}
function fmt(v) { return Number.isFinite(v) ? v.toFixed(0) : String(v); }
function runOne(label, bound, attempt, r) {
  console.log('  timing ' + label + ' run ' + attempt + ': ' + fmt(r.value) + ' ms (bound ' + bound + ', load average ' + loadAverage() + ')');
}
function summary(label, runs) {
  const last = runs[runs.length - 1];
  const how = last.funcOk === false ? 'functional failure, not retried'
    : last.ok ? (runs.length === 1 ? 'first run' : 'retry after 1 breach') : '2 breaches';
  return {
    ok: last.ok === true && last.funcOk !== false,
    label: label + ' (measured ' + runs.map((r) => fmt(r.value)).join(', ') + ' ms; ' + how + ')',
    detail: JSON.stringify(runs.map((r) => r.detail)),
  };
}
function safeRun(measure) {
  try { return measure(); } catch (e) { return { value: NaN, ok: false, funcOk: false, detail: e && e.message }; }
}
function stop(r) { return r.ok === true || r.funcOk === false; }
function timedSync(label, bound, measure) {
  const runs = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const r = safeRun(measure);
    runOne(label, bound, attempt, r);
    runs.push(r);
    if (stop(r)) break;
  }
  return summary(label, runs);
}
async function timedAsync(label, bound, measure) {
  const runs = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let r;
    try { r = await measure(); } catch (e) { r = { value: NaN, ok: false, funcOk: false, detail: e && e.message }; }
    runOne(label, bound, attempt, r);
    runs.push(r);
    if (stop(r)) break;
  }
  return summary(label, runs);
}

module.exports = { timedSync, timedAsync, loadAverage };
