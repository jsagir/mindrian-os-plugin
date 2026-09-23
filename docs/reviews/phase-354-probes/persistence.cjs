'use strict';
// Research probes of production persistence paths. All writes use scratch data.
// Reports observations rather than pinning defective behavior as a contract.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const repo = path.resolve(__dirname, '../../..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-354-persistence-'));
process.env.MINDRIAN_ROOMS_HOME = path.join(scratch, 'rooms-home');
process.env.MINDRIAN_MCP_FIRST = 'all';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
const load = relative => require(path.join(repo, relative));
const emit = (probe, observation) => console.log(JSON.stringify({ probe, ...observation }));
const roomDb = load('lib/core/room-db.cjs');
function makeRoom(name) {
  const room = path.join(scratch, name);
  fs.mkdirSync(room, { recursive: true });
  const db = roomDb.openRoomDb(room);
  roomDb.closeRoomDb(db);
  return room;
}

async function approval() {
  const room = makeRoom('approval');
  const captured = new Map();
  const server = { tool: (name, description, schema, handler) => captured.set(name, handler) };
  load('lib/mcp/tool-router.cjs').registerRouterTools(server, room, repo, { full: '' }, 'cli');
  load('lib/mcp/tools/gate.cjs').register(server, { fallbackRoomDir: room, pluginRoot: repo, surface: 'cli' });
  const extra = { sessionId: 'synthetic-persistence-probe' };
  const raw = await captured.get('meeting')({ command: 'file-meeting', knowledge_type: 'fact', claim_text: 'Synthetic test evidence only.' }, extra);
  const text = raw.content[0].text;
  const match = /gate_id[:*"\s]+\**\s*([A-Za-z0-9._-]+)/.exec(text);
  if (!match) throw Error('Meeting returned no gate ID: ' + text);
  const answer = await captured.get('gate_answer')({ gate_id: match[1], chosen: ['approve'], verdict: 'approve' }, extra);
  const db = roomDb.openRoomDb(room);
  try {
    emit('gate-subject-confirmation', {
      response: JSON.parse(answer.content[0].text),
      rows: db.prepare("SELECT id,type,review_status FROM nodes WHERE type IN ('claim','decision')").all(),
    });
  } finally { roomDb.closeRoomDb(db); }
}

async function resume() {
  const room = makeRoom('resume');
  const ps = load('lib/mcp/pipeline-state.cjs');
  ps.initChain(room, ['research', 'validate', 'research'], 'manual');
  fs.writeFileSync(path.join(room, 'a.md'), 'Synthetic predecessor output.\n');
  ps.recordStep(room, 'research', 'a.md');
  const calls = [];
  const inputs = [];
  const result = await load('lib/core/chain-executor.cjs').runChain([
    { step: 1, command: 'research' },
    { step: 2, command: 'validate' },
    { step: 3, command: 'research' },
  ], {
    roomDir: room, journal: true, resume: true, gateFn: () => 'run',
    onStep: (step, previous) => {
      calls.push(step.step);
      inputs.push(previous);
      return { chain_output: { value: step.step }, quality: 'high' };
    },
  });
  const journal = ps.read(room);
  emit('repeated-command-resume', { calls, completed: result.completed, chainPosition: journal.chain_position, suggestedNext: journal.suggested_next });
  emit('resume-predecessor-input', { storedPredecessorPath: 'a.md', firstResumedInput: inputs[0] });
}

function locks() {
  const room = makeRoom('locks');
  const lock = load('lib/core/write-lock.cjs');
  const file = path.join(room, '.mindrian', 'write.lock');
  const foreignPid = process.ppid;
  process.kill(foreignPid, 0); // Prove that the seeded foreign owner is alive.
  fs.writeFileSync(file, JSON.stringify({ pid: foreignPid, timestamp: Date.now() - 6000 }));
  lock.acquireLock(room);
  emit('live-lock-takeover', { foreignPid, currentPid: process.pid, replacementPid: JSON.parse(fs.readFileSync(file, 'utf8')).pid });
  fs.writeFileSync(file, JSON.stringify({ pid: foreignPid, timestamp: Date.now() }));
  lock.releaseLock(room);
  emit('nonowner-lock-release', { foreignPid, lockStillExists: fs.existsSync(file) });
}

function artifact() {
  const room = makeRoom('artifact');
  const outside = path.join(scratch, 'outside-artifact-room');
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(room, 'research'));
  const db = roomDb.openRoomDb(room);
  try {
    const result = load('lib/mcp/tools/views.cjs')._internal.fileArtifact(db, room, {
      section: 'research', filename: 'probe.md', content: '# Synthetic outside write\n',
    });
    emit('artifact-symlink-containment', { ok: result.ok, returnedPath: result.file_path, writtenOutsideRoom: fs.existsSync(path.join(outside, 'probe.md')) });
  } finally { roomDb.closeRoomDb(db); }
}

function gateSession() {
  const ledger = load('lib/mcp/gate-ledger.cjs');
  const id = 'synthetic-wrong-session-gate';
  ledger.mintGate(id, { sessionId: 'owner-session', kind: 'general', card: { options: [{ id: 'approve', label: 'Approve' }] } });
  const wrongSession = ledger.consumeGate(id, 'other-session');
  const ownerAfterward = ledger.consumeGate(id, 'owner-session');
  emit('wrong-session-gate-consumption', { wrongSession, ownerAfterward });
}

(async () => {
  await approval();
  await resume();
  locks();
  artifact();
  gateSession();
})().catch(error => { console.error(error); process.exitCode = 1; });
