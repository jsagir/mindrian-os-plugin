'use strict';

// Real MCP lifecycle test: one Eureka process must stay alive between the
// distinct MindrianOS start, status, and result calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const engineRoot = process.env.MINDRIAN_EUREKA_ROOT;
if (!engineRoot) throw new Error('Set MINDRIAN_EUREKA_ROOT to run the live capability-job lifecycle test.');
let jobs;
let activeJobId;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-eureka-job-lifecycle-'));
process.env.MINDRIAN_EUREKA_DATA_DIR = path.join(tempDir, 'eureka-data');

const artifacts = [
  ['a', 'Biological sensors detect cellular stress through molecular signals and fluorescence measurements.'],
  ['b', 'Adaptive control systems adjust robotic motion using feedback from distributed sensor arrays.'],
  ['c', 'Medical imaging pipelines identify tissue anomalies from spectral and magnetic measurements.'],
  ['d', 'Environmental monitoring networks track water contamination with field-deployed biosensors.'],
  ['e', 'Robotic prostheses translate neural signals into motor control and tactile feedback for users.'],
  ['f', 'Microfluidic devices isolate rare cells for rapid diagnostic testing and targeted treatment.'],
].map(([id, text]) => ({ id, title: id, source_ref: `mindrian-graph://node/${id}`, text }));

(async () => {
  jobs = require('../lib/mcp/tools/eureka-capability-jobs.cjs');
  const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
  const started = await jobs.startCapability({
    capability_id: 'opportunity.synthesize_discovery_signals',
    request: { objective: 'Find candidate pair leads across the supplied local snapshot',
      scope_id: 'room:job-lifecycle', snapshot_id: 'snapshot-job-lifecycle', artifacts, top_k: 5 },
  }, {}, { env: process.env });
  assert.equal(started.ok, true, JSON.stringify(started));
  assert.ok(started.job_id);

  let status;
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    status = await jobs.jobStatus({ job_id: started.job_id });
    assert.equal(status.ok, true, JSON.stringify(status));
    if (['completed', 'completed_empty', 'failed', 'blocked', 'cancelled', 'expired'].includes(status.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(status && ['completed', 'completed_empty'].includes(status.status), JSON.stringify(status));

  const result = await jobs.jobResult({ job_id: started.job_id });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.capability_id, 'opportunity.synthesize_discovery_signals');
  assert.equal(result.scope_id, 'room:job-lifecycle');
  assert.equal(result.snapshot_id, 'snapshot-job-lifecycle');
  assert.equal(result.engine_result.scope.scope_id, result.scope_id);
  assert.equal(result.engine_result.scope.snapshot_id, result.snapshot_id);
  assert.equal(jobs.sessions.has(started.job_id), false, 'terminal result closes its retained MCP session');

  // Cancellation evidence: make the next local scout deliberately larger,
  // request cancellation while its worker is live, and prove both its terminal
  // state and the retained stdio child-process exit.
  const cancellationArtifacts = Array.from({ length: 120 }, (_, index) => ({
    id: `cancel-${index}`,
    title: `Candidate ${index}`,
    source_ref: `mindrian-graph://node/cancel-${index}`,
    text: `Local research artifact ${index} describes a distinct technical approach, constraints, mechanisms, evidence, and application context for opportunity discovery.`,
  }));
  let cancellationTransport;
  class CapturingTransport extends StdioClientTransport {
    constructor(server) { super(server); cancellationTransport = this; }
  }
  const cancelStarted = await jobs.startCapability({
    capability_id: 'opportunity.synthesize_discovery_signals',
    request: { objective: 'Cancellation integration fixture', scope_id: 'room:job-cancel',
      snapshot_id: 'snapshot-job-cancel', artifacts: cancellationArtifacts, top_k: 5 },
  }, {}, { env: process.env, StdioClientTransport: CapturingTransport });
  assert.equal(cancelStarted.ok, true, JSON.stringify(cancelStarted));
  activeJobId = cancelStarted.job_id;
  const childPid = cancellationTransport.pid;
  assert.ok(childPid, 'live Eureka worker child process has a pid');
  let inFlightStatus;
  const inFlightDeadline = Date.now() + 30000;
  while (Date.now() < inFlightDeadline) {
    inFlightStatus = await jobs.jobStatus({ job_id: cancelStarted.job_id });
    assert.equal(inFlightStatus.ok, true, JSON.stringify(inFlightStatus));
    if (inFlightStatus.progress === 'semantic-scoring' || inFlightStatus.progress === 'hsi-hybrid-similarity-pairs') break;
    if (['completed', 'completed_empty', 'failed', 'blocked', 'cancelled', 'expired'].includes(inFlightStatus.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(['semantic-scoring', 'hsi-hybrid-similarity-pairs'].includes(inFlightStatus.progress),
    `cancellation is requested while the live scout is processing; got ${JSON.stringify(inFlightStatus)}`);
  const cancelRequested = await jobs.cancelJob({ job_id: cancelStarted.job_id });
  assert.equal(cancelRequested.ok, true, JSON.stringify(cancelRequested));

  let cancelStatus;
  const cancelDeadline = Date.now() + 60000;
  while (Date.now() < cancelDeadline) {
    cancelStatus = await jobs.jobStatus({ job_id: cancelStarted.job_id });
    assert.equal(cancelStatus.ok, true, JSON.stringify(cancelStatus));
    if (['completed', 'completed_empty', 'failed', 'blocked', 'cancelled', 'expired'].includes(cancelStatus.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(cancelStatus.status, 'cancelled', JSON.stringify(cancelStatus));
  const cancelledResult = await jobs.jobResult({ job_id: cancelStarted.job_id });
  assert.equal(cancelledResult.ok, true, JSON.stringify(cancelledResult));
  assert.equal(cancelledResult.status, 'cancelled');
  assert.equal(jobs.sessions.has(cancelStarted.job_id), false, 'cancelled terminal result closes the retained MCP session');
  activeJobId = null;
  const processExitDeadline = Date.now() + 5000;
  let childExited = false;
  while (Date.now() < processExitDeadline) {
    try { process.kill(childPid, 0); } catch (error) { if (error.code === 'ESRCH') childExited = true; else throw error; }
    if (childExited) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(childExited, true, `cancelled Eureka child process ${childPid} exited`);
  console.log(`eureka async capability lifecycle: PASS (${status.status}; one retained MCP process)`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(() => {
  if (activeJobId && jobs) {
    void jobs.cancelJob({ job_id: activeJobId }).finally(() => jobs.closeSession(activeJobId));
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
});
