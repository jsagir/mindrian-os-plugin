#!/usr/bin/env node
'use strict';

/**
 * Quick 261108-sng, fix 2: the start answer of eureka_capability_start says the truth about restarts.
 *
 * Since plan 374-10 a FINISHED job can be read again after a host restart from the saved record under
 * <home>/.mindrian/eureka-jobs/. A job that was still running when the host stopped does not resume, and the
 * engine may mark it failed with server_restarted. The old note said the job "cannot resume after that process
 * restarts", which hid the first half of that.
 *
 * Arms (one line each at column 1: "ok - N<n> ..." or "FAIL - N<n> ..."):
 *   N1  the start answer note says a finished job can be read again after a restart from the saved record,
 *       says a running job does not resume, and names server_restarted
 *   N2  the old sentence is absent from the note, the note is ASCII only, and has no em dash or en dash
 *   N3  the job-not-found runtime message (pinned by test-387-eureka-installed-layout) is unchanged
 *
 * The engine is an in-process fake client. No engine, no network. A scratch HOME. CJS. Hyphens only.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't374-sng-note-'));
const HOME = path.join(TMP, 'home');
const ENGINE = path.join(TMP, 'engine');
fs.mkdirSync(HOME);
fs.mkdirSync(ENGINE);
fs.writeFileSync(path.join(ENGINE, 'pyproject.toml'), '[project]\nname = "mindrian-eureka"\n\n[project.scripts]\neureka-mcp = "fixture:main"\n');
const SAVED = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, MINDRIAN_EUREKA_ROOT: process.env.MINDRIAN_EUREKA_ROOT };
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
process.env.MINDRIAN_EUREKA_ROOT = ENGINE;
function cleanup() {
  for (const k of Object.keys(SAVED)) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

const contract = require(path.join(REPO, 'lib', 'mcp', 'eureka-tool-contract.cjs'));
const jobs = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-jobs.cjs'));
const run = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-run.cjs'));

const GENERIC = 'opportunity.find_cross_domain_pairs';
const SCOPE = 'room:sng';
const SNAPSHOT = 'snap-sng';
const SESSION = 'sng-session';
const OLD_SENTENCE = 'cannot resume after that process restarts';

let failed = 0;
async function arm(id, label, fn) {
  try {
    await fn();
    process.stdout.write('ok - ' + id + ' ' + label + '\n');
  } catch (err) {
    failed += 1;
    const msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    process.stdout.write('FAIL - ' + id + ' ' + label + ' :: ' + msg + '\n');
  }
}

function hex(text) { return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex'); }
function sc(payload) { return { structuredContent: payload, content: [{ type: 'text', text: JSON.stringify(payload) }] }; }

function makeDeps() {
  class FakeTransport { constructor(options) { this.options = options; this.stderr = null; } }
  class FakeClient {
    async connect() { /* in process */ }
    async close() { /* in process */ }
    async callTool(call) {
      const args = call.arguments || {};
      switch (call.name) {
        case 'scout_capabilities':
          return sc({ capabilities: [{ id: GENERIC, status: 'experimental', routes: { mcp: { tool: 'scout_start' } } }] });
        case 'scout_capability_contract':
          return sc({ capability: { id: args.capability_id }, schemas: { input: { type: 'object' }, output: { type: 'object' } } });
        case 'scout_start':
          return sc({ job_id: 'job-sng-1', status: 'queued' });
        default:
          throw new Error('unexpected call ' + call.name);
      }
    }
  }
  return {
    env: { MINDRIAN_EUREKA_ROOT: ENGINE, HOME },
    ctx: { surface: 'cli' },
    server: { registerTool() {}, server: { getClientCapabilities() { return {}; } } },
    Client: FakeClient,
    StdioClientTransport: FakeTransport,
    callerIdentity: () => ({ sessionKeyHash: hex(SESSION), roomId: 'room-sng' }),
    prepare: async () => ({ ok: true, scope_id: SCOPE, snapshot_id: SNAPSHOT, projection: {}, room_binding: { room_id: 'room-sng' },
      bundle: { artifacts: [{ id: 'n1', source_ref: 'mindrian-graph://node/n1', title: 't', text: 'x', sha256: hex('x') }] } }),
  };
}

async function startNote() {
  run.clearCatalogCache();
  for (const session of jobs.sessions.values()) { if (session.timer) clearTimeout(session.timer); }
  jobs.sessions.clear();
  contract.setProbeDeps({
    needsForCall: () => ({}),
    extrasInstalled: () => ({ venv_present: true, located: false, installed: {} }),
    nodeStatus: () => ({ ok: true }),
  });
  const out = await jobs.startCapability({
    capability_id: GENERIC,
    request: { scope_id: SCOPE, snapshot_id: SNAPSHOT, topic: 'topic', artifacts: [{ id: 'n1', title: 't', text: 'x' }], top_k: 4 },
  }, { sessionId: SESSION }, makeDeps());
  assert.equal(out.ok, true, 'start: ' + JSON.stringify(out).slice(0, 200));
  assert.equal(typeof out.note, 'string');
  return out.note;
}

async function main() {
  let note = '';
  try {
    note = await startNote();
  } catch (error) {
    await arm('N1', 'the start note says a finished job reads again and a running job does not resume', async () => { throw error; });
  }

  await arm('N1', 'the start note says a finished job reads again and a running job does not resume', async () => {
    assert.ok(note, 'no note');
    assert.ok(note.includes('A finished job can be read again after a restart from its saved record.'), 'finished-job sentence missing');
    assert.ok(note.includes('A job that is still running when the host stops does not resume'), 'running-job sentence missing');
    assert.ok(note.includes('server_restarted'), 'server_restarted not named');
    assert.ok(note.includes('The retained session expires after 30 minutes.'), 'session expiry sentence lost');
  });

  await arm('N2', 'the old sentence is gone and the note is plain ASCII', async () => {
    assert.ok(note, 'no note');
    assert.ok(!note.includes(OLD_SENTENCE), 'old sentence still present');
    assert.ok(!note.includes('exists only in the MindrianOS MCP process'), 'old opening still present');
    assert.ok(/^[\x20-\x7e]*$/.test(note), 'non-ASCII character in the note');
  });

  await arm('N3', 'the job-not-found message keeps its pinned wording', async () => {
    const src = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-jobs.cjs'), 'utf8');
    assert.ok(src.includes('No active Eureka MCP session owns this job_id. Jobs cannot resume after the MindrianOS host process restarts; start a new job.'));
  });

  cleanup();
  if (failed) process.exit(1);
}

main().catch((error) => { cleanup(); process.stdout.write('FAIL - fatal :: ' + String(error && error.message) + '\n'); process.exit(1); });
