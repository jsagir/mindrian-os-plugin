'use strict';
/*
 * Spike 003: jev-hook-latency-budget.
 *
 * Question: could a Jev call ever sit inside a MindrianOS per-turn path, and what
 * does the tail look like against the 2000 ms hook budgets in hooks.json
 * (UserPromptSubmit 2000, PreToolUse egress guard 2000, Stop 3000)?
 * The MANIFEST already rules that Jev never runs in a hook on a USER machine; this
 * spike sizes the Theo-side and dev-side paths and produces the numbers a wrapper
 * would need: cold start per fresh process, warm p50/p95, burst behavior (429/529),
 * and the share of calls that would miss a 2000 ms budget.
 *
 * Canon Part 8: state is generic enums only. Key from env or ~/.secrets, never printed.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const BUDGET_MS = 2000;

function loadKey() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  try {
    const raw = fs.readFileSync(path.join(os.homedir(), '.secrets', 'typesafe.env'), 'utf8');
    const m = raw.match(/^TYPESAFE_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch (_) { /* fall through */ }
  return null;
}

const BODY = {
  model: MODEL,
  state: { problem_type: 'ill-defined', stage: 'discovery', section: 'problem-definition' },
  questions: {
    first_move: { type: 'choice', instructions: 'Which framework family fits FIRST here?', criteria: { 'jobs-to-be-done': 'discover the jobs', 'red-teaming': 'stress-test assumptions', 'no-match': 'none fits' } },
  },
};

async function one(key, label) {
  const t0 = Date.now();
  try {
    const r = await fetch(ENDPOINT, { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(BODY) });
    await r.text();
    return { label: label, status: r.status, ms: Date.now() - t0 };
  } catch (e) {
    return { label: label, status: 0, ms: Date.now() - t0, error: e.message };
  }
}

function pct(sorted, p) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null; }
function stats(arr) { const s = arr.slice().sort((a, b) => a - b); return { n: s.length, min: s[0], p50: pct(s, 0.5), p95: pct(s, 0.95), max: s[s.length - 1] }; }

// Child mode: one call in a fresh process, print ms. Measures cold start (TLS + route).
if (process.argv[2] === '--child') {
  const key = loadKey();
  one(key, 'cold').then((r) => { process.stdout.write(JSON.stringify(r)); process.exit(0); });
} else {
  main().catch((e) => { console.error('spike error: ' + e.message); process.exit(1); });
}

async function main() {
  const key = loadKey();
  if (!key) { console.error('no TYPESAFE_API_KEY'); process.exit(3); }
  const out = { started: new Date().toISOString(), budget_ms: BUDGET_MS };

  // A. Cold start: 5 fresh processes, one call each (what a hook would pay every time,
  //    since hooks are fresh node processes with no connection to reuse).
  const cold = [];
  for (let i = 0; i < 5; i++) {
    const r = spawnSync(process.execPath, [__filename, '--child'], { encoding: 'utf8', env: process.env });
    try { cold.push(JSON.parse(r.stdout)); } catch (_) { cold.push({ status: 0, ms: null, error: (r.stderr || '').slice(0, 120) }); }
  }
  out.cold = { runs: cold, stats: stats(cold.filter((c) => c.ms != null).map((c) => c.ms)) };
  console.log('A cold start (fresh process each): ' + JSON.stringify(out.cold.stats) + ' statuses=' + JSON.stringify(cold.map((c) => c.status)));

  // B. Warm sequential: 20 calls on one process (connection reused).
  const warm = [];
  for (let i = 0; i < 20; i++) warm.push(await one(key, 'warm' + i));
  out.warm = { stats: stats(warm.map((w) => w.ms)), statuses: warm.map((w) => w.status) };
  console.log('B warm sequential x20: ' + JSON.stringify(out.warm.stats));

  // C. Burst: 20 concurrent calls at once. Any 429/529?
  const t0 = Date.now();
  const burst = await Promise.all(Array.from({ length: 20 }, (_, i) => one(key, 'burst' + i)));
  const burstWall = Date.now() - t0;
  const codes = {}; burst.forEach((b) => { codes[b.status] = (codes[b.status] || 0) + 1; });
  out.burst = { wall_ms: burstWall, stats: stats(burst.map((b) => b.ms)), status_counts: codes };
  console.log('C burst x20 concurrent: wall=' + burstWall + ' ms ' + JSON.stringify(out.burst.stats) + ' codes=' + JSON.stringify(codes));

  // D. Budget: share of ALL successful calls above the hook budget, and the shape of
  //    an async best-effort wrapper: fire, race against the budget, and report what a
  //    hook would actually have had in hand at 2000 ms.
  const all = cold.concat(warm, burst).filter((x) => x.status === 200 && x.ms != null);
  const over = all.filter((x) => x.ms > BUDGET_MS).length;
  const over1000 = all.filter((x) => x.ms > 1000).length;
  out.budget = { calls: all.length, over_2000_ms: over, over_1000_ms: over1000, share_over_2000: all.length ? over / all.length : null };
  console.log('D budget: ' + all.length + ' ok calls, over 2000 ms = ' + over + ', over 1000 ms = ' + over1000);

  // E. Wrapper shape: race a call against the budget; the loser is dropped, never awaited
  //    by the turn. Measured once here so the pattern is on record with a number.
  const raceT0 = Date.now();
  const winner = await Promise.race([one(key, 'raced').then((r) => ({ who: 'jev', r: r })), new Promise((res) => setTimeout(() => res({ who: 'budget' }), BUDGET_MS))]);
  out.race = { winner: winner.who, ms: Date.now() - raceT0, status: winner.r && winner.r.status };
  console.log('E race vs ' + BUDGET_MS + ' ms budget: winner=' + winner.who + ' at ' + out.race.ms + ' ms');

  out.finished = new Date().toISOString();
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(out, null, 2));
  console.log('-> results.json');
}
