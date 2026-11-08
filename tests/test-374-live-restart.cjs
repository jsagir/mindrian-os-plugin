#!/usr/bin/env node
'use strict';

/**
 * Phase 374 plan 10, test T12 (arm L1): the live host-restart test. THE OWNER RUNS THIS TEST, not the executor.
 * It needs a real Eureka engine and a local meaning model, and it should run on an idle host.
 *
 * Why it exists: the engine keeps a finished job for 30 days, and on every start it marks a job that was still
 * running as failed with failure_code server_restarted. Whether the first engine child process (eureka-mcp)
 * exits at once when its host dies is UNVERIFIED (the worker thread pool may keep it alive until the job
 * ends). This test shows what happens, so the owner can record it.
 *
 * Run it like this (one line, on an idle host with a local model):
 *
 *   MOS_374_LIVE=1 MINDRIAN_EUREKA_ROOT=<engine folder> MINDRIAN_EUREKA_RS_MODEL_PATH=<model folder> node tests/test-374-live-restart.cjs
 *
 * What it does when the switch is on (the steps):
 *   1. Make a scratch HOME and a scratch engine data folder (MINDRIAN_EUREKA_DATA_DIR). Nothing outside them is written.
 *   2. Spawn host process A (a small node script, written to the scratch folder, that starts a catalogued job
 *      through eureka_capability_start and writes the job id and the engine child pids to a file).
 *   3. Record the pid of the engine child of A (found from the process tree of A).
 *   4. Kill host process A with SIGKILL while the job runs.
 *   5. Spawn host process B (a second node script) that asks the job status through the recovery path
 *      (eureka_capability_job_status), twice, a few seconds apart, and prints the answers.
 *   6. Read the engine row state (status, progress, failure_code) from B's answer.
 *   7. Check whether the engine child of A still exists (kill -0 on the recorded pid) before and after B asked,
 *      and print: child_of_A_lingers_after_kill, child_of_A_lingers_after_recovery.
 *   8. Print a short report for the owner and clean the scratch folders. Exit 0 when A started, B answered with a
 *      recovered answer and the report was printed; exit 1 when a step failed.
 *
 * What the owner should record: (a) does the first engine child still run after the host is killed, (b) what
 * state does the engine row show after the recovery child opened (failed + server_restarted is expected for a job
 * that was still running), (c) whether a job that finished before the kill reads as completed after the restart.
 *
 * Without MOS_374_LIVE=1, without a resolvable engine, or without MINDRIAN_EUREKA_RS_MODEL_PATH the file prints
 * the reason and exits 77 (environment gap). The executor of the plan never runs it with the switch on.
 *
 * CJS. Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');

function skip(reason) {
  process.stdout.write('SKIPPED (ENV GAP) - L1 ' + reason + '\n');
  process.exit(77);
}

if (process.env.MOS_374_LIVE !== '1') skip('MOS_374_LIVE is not 1; this test is run by the owner on an idle host with a local model');
if (process.platform === 'win32') skip('win32 is not covered (SIGKILL and pid checks)');
if (!process.env.MINDRIAN_EUREKA_RS_MODEL_PATH) skip('MINDRIAN_EUREKA_RS_MODEL_PATH is not set (no local meaning model)');
const resolver = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-engine-resolver.cjs'));
const engine = resolver.resolveEngine(process.env);
if (engine.state !== 'present') skip('no Eureka engine folder resolves (set MINDRIAN_EUREKA_ROOT)');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-374-live-restart-'));
const home = path.join(scratch, 'home');
const dataDir = path.join(scratch, 'eureka-data');
fs.mkdirSync(home);
fs.mkdirSync(dataDir);
const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home, MINDRIAN_EUREKA_DATA_DIR: dataDir });

const IDENTITY = "callerIdentity: () => ({ sessionKeyHash: require('node:crypto').createHash('sha256').update(process.env.MOS_L1_SESSION).digest('hex'), roomId: 'live-restart-room' })";

const hostA = `
const jobs = require(${JSON.stringify(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-jobs.cjs'))});
const fs = require('node:fs');
const artifacts = Array.from({ length: 60 }, (_, i) => ({ id: 'a' + i, title: 'a' + i, source_ref: 'mindrian-graph://node/a' + i,
  text: 'Synthetic note ' + i + ' about sensors, control, imaging and diagnostics in many fields of work.' }));
(async () => {
  const out = await jobs.startCapability({ capability_id: 'opportunity.find_cross_domain_pairs', request: {
    objective: 'live restart test', scope_id: 'room:live-restart', snapshot_id: 'snap-live-restart', artifacts, top_k: 5 } },
    {}, { env: process.env, ${IDENTITY} });
  fs.writeFileSync(process.env.MOS_L1_OUT, JSON.stringify({ ok: out.ok, job_id: out.job_id, reason: out.reason, pid: process.pid }));
  setInterval(() => {}, 1000);
})();
`;

const hostB = `
const jobs = require(${JSON.stringify(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-jobs.cjs'))});
(async () => {
  const answers = [];
  for (let i = 0; i < 2; i += 1) {
    answers.push(await jobs.jobStatus({ job_id: process.env.MOS_L1_JOB }, {}, { env: process.env, ${IDENTITY} }));
    await new Promise((r) => setTimeout(r, 4000));
  }
  process.stdout.write(JSON.stringify(answers));
})();
`;

function childPids(pid) {
  const r = spawnSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' });
  return String(r.stdout || '').split('\n').map((s) => Number(s)).filter(Boolean);
}
function descendants(pid, seen) {
  const all = seen || [];
  for (const c of childPids(pid)) { if (!all.includes(c)) { all.push(c); descendants(c, all); } }
  return all;
}
function alive(pid) { try { process.kill(pid, 0); return true; } catch (_e) { return false; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let report = { L1: 'failed' };
  let a = null;
  try {
    const outFile = path.join(scratch, 'a-out.json');
    fs.writeFileSync(path.join(scratch, 'host-a.cjs'), hostA);
    fs.writeFileSync(path.join(scratch, 'host-b.cjs'), hostB);
    a = spawn(process.execPath, [path.join(scratch, 'host-a.cjs')], { env: Object.assign({}, env, { MOS_L1_OUT: outFile, MOS_L1_SESSION: 'live-session-1' }), stdio: 'ignore' });
    const deadline = Date.now() + 180000;
    while (!fs.existsSync(outFile) && Date.now() < deadline) await sleep(500);
    if (!fs.existsSync(outFile)) throw new Error('host A did not start a job in time');
    const started = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    if (!started.ok) throw new Error('host A start refused: ' + started.reason);
    const enginePids = descendants(a.pid);
    a.kill('SIGKILL');
    await sleep(1500);
    const lingersAfterKill = enginePids.filter(alive);
    const b = spawnSync(process.execPath, [path.join(scratch, 'host-b.cjs')], {
      env: Object.assign({}, env, { MOS_L1_JOB: started.job_id, MOS_L1_SESSION: 'live-session-2' }), encoding: 'utf8', timeout: 240000 });
    const answers = JSON.parse(b.stdout || '[]');
    const lingersAfterRecovery = enginePids.filter(alive);
    report = {
      L1: answers.length === 2 && answers.every((x) => x.recovered === true) ? 'ok' : 'failed',
      job_id: started.job_id,
      engine_pids_of_A: enginePids,
      child_of_A_lingers_after_kill: lingersAfterKill.length > 0,
      child_of_A_lingers_after_recovery: lingersAfterRecovery.length > 0,
      recovered_answers: answers.map((x) => ({ ok: x.ok, status: x.status, progress: x.progress, failure_code: x.failure_code, source: x.source, reason: x.reason })),
    };
    for (const pid of lingersAfterRecovery) { try { process.kill(pid, 'SIGKILL'); } catch (_e) { /* gone */ } }
  } catch (error) {
    report.error = String(error && error.message || error).split('\n')[0];
  } finally {
    if (a && a.exitCode === null) { try { a.kill('SIGKILL'); } catch (_e) { /* gone */ } }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  process.stdout.write((report.L1 === 'ok' ? 'ok - L1 ' : 'FAIL - L1 ') + 'live restart report for the owner\n' + JSON.stringify(report, null, 2) + '\n');
  process.exit(report.L1 === 'ok' ? 0 : 1);
})();
