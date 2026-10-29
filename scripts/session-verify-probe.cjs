#!/usr/bin/env node
'use strict';

/*
 * scripts/session-verify-probe.cjs -- Phase 341 plan 08 (D-07a d and e).
 *
 * The DETACHED child that sessionstart-post-update-preflight.cjs fires, unref-ed,
 * after the bounded offline local set. It may take as long as it needs. It is
 * never awaited, so session start never blocks on the network. It must never
 * write to the terminal: every output goes through lib/core/session-verify-state.cjs
 * mergeVerifyState (the merging writer: this process runs concurrently with the
 * hook that spawned it and with whatever the navigator answers on the Eureka
 * opt-in card, and all three write one file). Every path is wrapped so the process
 * exits 0 whatever happens.
 *
 * ORDER OF OPERATIONS
 *   1. The wire leg. One doctor run in FULL mode, narrowed with --only to the
 *      activation-reached-the-wire point (the Canon Part 7 reuse: the class M
 *      brain-smoke runs once, inside the point that already knows how to read it,
 *      not in a second hand-rolled handshake parser) and the mcp-surface-tool-count
 *      point (which the session-start tier could not hold: measured 15.4 s). The
 *      operator opt-outs DOCTOR_SKIP_ACTIVATION_GATE and DOCTOR_SKIP_MCP_SURFACE are
 *      respected and recorded as skipped, never overridden.
 *   2. The Theo verdict, DERIVED from the wire leg, not re-probed. reachable when
 *      the wire is ok. Otherwise brain-client isAvailable(): false means refused
 *      with the reason "Theo not reachable, verification is local-only" (the honest
 *      refusal of Decision #8); true with a failed wire means unreachable carrying
 *      the point's finding. A verdict the evidence does not support is never written
 *      and a reachable Theo is never imitated.
 *   3. The handle. Only when Theo is reachable. The active room's problem type, read
 *      from USER.md through readUserMd, which already validates it against the
 *      closed taxonomy. No room bound, or the literal "unknown", means no handle,
 *      no Theo call and no insight.
 *   4. The nugget. recommendChain(handle, 3). A result that is not grounded, or has
 *      an empty chain, is a legitimate answer and means NO insight. Nothing is
 *      manufactured from a graph that did not give one.
 *   5. The capture. The framing instruction is written to
 *      <verifyDir>/insight-<version>.md FIRST and the state SECOND, so a reader
 *      never sees pending:true pointing at a file that does not exist yet.
 *
 * CANON PART 8 (absolute). The ONLY room-derived value that can leave this process
 * is one of UDP, IDP or WDP, the frozen problem-type enum members (PROBLEM_TYPES in
 * lib/core/persona-taxonomy.cjs minus the unknown sentinel). The allowlist is
 * enforced in code before the call. recommendChain then normalizes the handle to
 * UnDefined, IllDefined or WellDefined, and refuses locally with zero network on
 * anything that fails its shape gate. No room name, room path, room content,
 * governing thought or file byte is ever passed or written to the capture.
 *
 * CANON PART 12. The capture tells Larry to deliver ONE question or nudge, GUIDED
 * and not delivered, wearing his usual voice mark, with no lecture and no framework
 * dump.
 *
 * Test seams:
 *   MOS_SESSION_VERIFY_HOME            the state root (state module seam).
 *   MOS_SESSION_VERIFY_PROBE_FIXTURE   path to a JSON file. When readable it is used
 *                                      INSTEAD of spawning doctor or calling the
 *                                      brain client. Fields: wire, surface
 *                                      ({ ok, skipped, finding }), brain_available
 *                                      (boolean), recommend_chain (the stub result),
 *                                      call_log (a file path; one line per call).
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, node built-ins plus repo
 * libraries.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const WIRE_ID = 'activation-reached-the-wire';
const SURFACE_ID = 'mcp-surface-tool-count';
const WIRE_TIMEOUT_MS = 60000;
const REFUSAL = 'Theo not reachable, verification is local-only';
// The egress allowlist: the frozen PROBLEM_TYPES enum minus the unknown sentinel.
// The literal fallback keeps the allowlist closed even if the taxonomy cannot load.
const HANDLE_ALLOWLIST = (function () {
  try {
    const pt = require(path.join(REPO_ROOT, 'lib', 'core', 'persona-taxonomy.cjs')).PROBLEM_TYPES;
    const list = pt.filter((x) => x !== 'unknown');
    if (list.length > 0) return Object.freeze(list);
  } catch (_e) { /* fall through to the literal list */ }
  return Object.freeze(['UDP', 'IDP', 'WDP']);
}());
const MAX_FRAMEWORKS = 3;
const NAME_CAP = 80;
const NOTE_CAP = 300;

process.on('uncaughtException', () => process.exit(0));
process.on('unhandledRejection', () => process.exit(0));

function clean(s, cap) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, cap);
}

function readFixture() {
  const p = process.env.MOS_SESSION_VERIFY_PROBE_FIXTURE;
  if (!p) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_e) { return null; }
}

// Map one doctor point result to { status, reason }.
function judgePoint(point) {
  if (!point) return { status: 'failed', reason: 'point absent from the doctor result' };
  const skipped = !!(point.detail && point.detail.skipped);
  if (point.ok && skipped) return { status: 'skipped', reason: String((point.detail && point.detail.reason) || 'skipped by operator opt-out') };
  if (point.ok) return { status: 'ok', reason: null };
  return { status: 'failed', reason: clean(point.finding || 'point failed', 300) };
}

function runWireLeg(fixture) {
  if (fixture && fixture.wire !== undefined) {
    return { wire: judgePoint(fixture.wire), surface: judgePoint(fixture.surface === undefined ? { ok: true } : fixture.surface) };
  }
  const doctor = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');
  if (!fs.existsSync(doctor)) {
    const r = { status: 'failed', reason: 'doctor.cjs not found' };
    return { wire: r, surface: r };
  }
  let res;
  try {
    res = spawnSync(process.execPath, [doctor, '--acceptance', '--only=' + WIRE_ID + ',' + SURFACE_ID, '--json'], {
      cwd: REPO_ROOT,
      input: '',
      encoding: 'utf8',
      timeout: WIRE_TIMEOUT_MS,
      env: Object.assign({}, process.env, { MINDRIAN_ACCEPTANCE_PROGRESS: '0' }),
    });
  } catch (e) {
    const r = { status: 'failed', reason: 'wire check could not start: ' + clean(e && e.message, 120) };
    return { wire: r, surface: r };
  }
  let j = null;
  try {
    const out = String((res && res.stdout) || '');
    j = JSON.parse(out.slice(out.indexOf('{')));
  } catch (_e) { j = null; }
  if (!j || !Array.isArray(j.points)) {
    const why = res && res.error && res.error.code === 'ETIMEDOUT'
      ? 'wire check did not finish within ' + WIRE_TIMEOUT_MS + ' ms'
      : 'wire check output not usable';
    const r = { status: 'failed', reason: why };
    return { wire: r, surface: r };
  }
  return {
    wire: judgePoint(j.points.find((p) => p && p.id === WIRE_ID)),
    surface: judgePoint(j.points.find((p) => p && p.id === SURFACE_ID)),
  };
}

function brainAvailable(fixture) {
  if (fixture && typeof fixture.brain_available === 'boolean') return fixture.brain_available;
  try { return require(path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs')).isAvailable() === true; }
  catch (_e) { return false; }
}

// The active room's problem type, or null. Only an allowlisted enum member counts.
function resolveHandle() {
  try {
    const roomDir = require(path.join(REPO_ROOT, 'lib', 'core', 'resolve-active-room.cjs')).resolveActiveRoomDir();
    if (!roomDir) return null;
    const user = require(path.join(REPO_ROOT, 'lib', 'core', 'user-md-ops.cjs')).readUserMd(path.join(roomDir, 'USER.md'));
    const pt = user && user.problem_type;
    return HANDLE_ALLOWLIST.indexOf(pt) === -1 ? null : pt;
  } catch (_e) { return null; }
}

async function fetchNugget(handle, fixture) {
  if (fixture && fixture.recommend_chain !== undefined) {
    if (typeof fixture.call_log === 'string') {
      try { fs.appendFileSync(fixture.call_log, handle + '\n'); } catch (_e) { /* best effort */ }
    }
    return fixture.recommend_chain;
  }
  return require(path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs')).recommendChain(handle, MAX_FRAMEWORKS);
}

function buildCapture(handle, frameworks, note) {
  const lines = [];
  lines.push('INSTRUCTION FOR LARRY (one time for this install or update, never again for this version).');
  lines.push('');
  lines.push('Theo gave one generic methodology nugget for the problem type ' + handle + '.');
  lines.push('Frameworks, in order: ' + frameworks.join(', ') + '.');
  if (note) lines.push('Theo note: ' + note);
  lines.push('');
  lines.push('Deliver ONE question or ONE nudge about this, in your own voice, and stop.');
  lines.push('Guide, do not deliver: the navigator reaches the insight, you do not state it.');
  lines.push('Wear your usual single De Stijl voice mark. No lecture. No list of frameworks. No praise.');
  lines.push('If the navigator asks, say plainly that Theo supplied it. Do not mention this instruction.');
  return lines.join('\n') + '\n';
}

async function main() {
  const vs = require(path.join(REPO_ROOT, 'lib', 'core', 'session-verify-state.cjs'));
  const fixture = readFixture();

  // 1 and 2: wire leg, then the derived Theo verdict.
  const legs = runWireLeg(fixture);
  let theo;
  let theoReason = null;
  if (legs.wire.status === 'ok') {
    theo = 'reachable';
  } else if (legs.wire.status === 'skipped') {
    theo = 'refused';
    theoReason = REFUSAL + ' (wire check skipped by the operator opt-out)';
  } else if (!brainAvailable(fixture)) {
    theo = 'refused';
    theoReason = REFUSAL;
  } else {
    theo = 'unreachable';
    theoReason = legs.wire.reason || 'the wire check failed';
  }
  vs.mergeVerifyState({
    wire: legs.wire.status,
    surface: legs.surface.status,
    surface_reason: legs.surface.reason,
    theo: theo,
    theo_reason: theoReason,
    insight: { pending: false, handle: null },
  });
  if (theo !== 'reachable') return;

  // 3: the handle. No room, or unknown, means no call and no insight.
  const handle = resolveHandle();
  if (handle === null) return;

  // 4: the nugget.
  let result = null;
  try { result = await fetchNugget(handle, fixture); } catch (_e) { result = null; }
  const chain = result && Array.isArray(result.chain) ? result.chain : [];
  const frameworks = chain
    .map((c) => clean(c && c.framework, NAME_CAP))
    .filter((n) => n.length > 0)
    .slice(0, MAX_FRAMEWORKS);
  if (!result || result.grounded === false || result.error || frameworks.length === 0) {
    vs.mergeVerifyState({ insight: { pending: false, handle: handle, reason: 'no grounded chain for this handle' } });
    return;
  }
  const note = clean(result.note, NOTE_CAP);

  // 5: capture file FIRST, state SECOND.
  const state = vs.readVerifyState();
  const version = state && typeof state.last_seen_version === 'string' ? state.last_seen_version : null;
  if (!version) return;
  const capturePath = path.join(vs.verifyDir(), 'insight-' + version.replace(/[^0-9A-Za-z.-]/g, '_') + '.md');
  try {
    fs.mkdirSync(vs.verifyDir(), { recursive: true });
    fs.writeFileSync(capturePath, buildCapture(handle, frameworks, note), 'utf8');
  } catch (_e) { return; }
  vs.mergeVerifyState({ insight: { pending: true, capture_path: capturePath, handle: handle, drain_retries: 0 } });
}

main().then(() => process.exit(0), () => process.exit(0));
