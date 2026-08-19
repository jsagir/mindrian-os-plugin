#!/usr/bin/env node
'use strict';

/*
 * Phase 234-05 (D-04 / D-05 / D-12) -- the two-axis capability floor.
 *
 * WHAT THIS DEFENDS. Before this plan, the three write-path tools
 * (graph_write, memory_event, artifact_file) were gated at REGISTRATION time
 * behind MINDRIAN_MCP_FIRST, which defaults OFF. On Claude Code that is
 * harmless: slash commands and hooks do the writing. On any foreign MCP host
 * (Cursor, VS Code/Copilot, Goose, Zed, and the ~45 others in the Agent Skills
 * showcase) it meant the product could READ the room graph and never record
 * anything back into it, and the model could not even SEE that a write tool
 * existed to ask for. RESEARCH.md calls that the "silent one-way mirror" and
 * names it the phase's single biggest functional gap (Gap D).
 *
 * THE TIMING CONSTRAINT THAT FORCED THE DESIGN. The MCP SDK only populates
 * `getClientVersion()` AFTER the initialize handshake completes, but tool
 * registration happens once at boot inside createServer(), before any client
 * connects, on every transport this codebase runs. So host-based gating at
 * registration time is structurally impossible, not merely inelegant. The fix
 * is to separate the two concerns that were conflated: DISCOVERY (is the tool
 * in tools/list) becomes unconditional, and PERMISSION (may this call write)
 * becomes a live, per-call host-tier lookup inside the handler. D-04 is
 * preserved: the enforcement point is the server-side tool handler, never a
 * client hook.
 *
 * SCOPE OF THE TWO AXES (D-05 "state both axes honestly"):
 *   surface   -- cli | desktop | cowork (the existing detectSurface axis)
 *   hostTier  -- tier1 (Claude Code, Grok Build, OpenCode: hook-capable)
 *                tier0 (everything else: MCP + skills only)
 *
 * D-12 GUARD: host-capability tier and commercial tier are DIFFERENT AXES.
 * Nothing in this file, or in the code it tests, reads a plan, a key, or an
 * entitlement. A tier0 host can have a paying user; a tier1 host can have a
 * free one.
 *
 * T-234-08 (accepted, documented): clientInfo.name is client-supplied and
 * unauthenticated. It is a UX/routing signal that selects a DEFAULT
 * convenience gate, never an authentication boundary. Every write still routes
 * through navigation.cjs's own validation and CAS guard regardless of how the
 * call was gated in, so a spoofed name at worst grants the same write path a
 * legitimate Cursor user already gets by design.
 *
 * METHOD. Two layers, both ground truth:
 *   PART A (unit) -- direct calls against the two new exported functions.
 *   PART B (live) -- a REAL `node bin/mindrian-mcp-server.cjs` spawned over
 *     stdio and driven with genuine JSON-RPC, varying clientInfo.name across
 *     runs. A grep or a mocked server would not prove what a foreign host
 *     actually receives on the wire; the wire cannot lie.
 *
 * Canon Part 8: pure local calls plus a LOCAL child process under a hermetic
 * HOME with MINDRIAN_BRAIN_KEY unset. Zero network reach.
 *
 * 2026-08-19 AMENDMENT (quick task 260819-bql, RCA
 * .planning/debug/resolved/mcp-write-path-disabled-on-cli-host.md): Phase
 * 234-05's claude-code default -- "harmless: slash commands and hooks do the
 * writing" -- was reversed. It was NOT harmless: a visible-but-always-refusing
 * door provoked ungoverned direct-disk writes with no artifact_id and no
 * memory_event journal row, observed live in this repo's own history. The
 * three write tools ARE the governed Part 9 door (everything they do routes
 * through navigation.cjs), so claude-code is now PERMITTED by default, same
 * as any other confidently-recognized host. The honest-refusal proof this
 * suite used to pin against claude-code (Part B, B3/B4) moved to a THIRD
 * live drive against an unidentified client -- the conservative floor still
 * refuses, out loud, with an accurate hint. The original Gap D narrative
 * above is UNCHANGED and still the reason the three tools are registered
 * unconditionally in tools/list regardless of host.
 *
 * Run: node tests/test-234-host-tier.cjs
 * Exit: 0 when every check passes, non-zero otherwise. No em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { detectHostTier, HOST_TIER_MAP, detectSurface, CAPABILITY_MAP } =
  require(path.join(REPO_ROOT, 'lib', 'mcp', 'surface-detect.cjs'));
const { isMcpFirst, mcpFirstSurfaces, isWritePathEnabled } =
  require(path.join(REPO_ROOT, 'lib', 'mcp', 'mcp-first-flag.cjs'));

let passed = 0;
let failed = 0;

function check(label, cond) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL - ' + label + '\n');
    process.stdout.write('    ' + (e.message || String(e)) + '\n');
  }
}

// Every isWritePathEnabled assertion must own the flag it depends on, so a
// developer's ambient MINDRIAN_MCP_FIRST cannot turn a red test green.
function withFlag(value, fn) {
  const previous = process.env.MINDRIAN_MCP_FIRST;
  if (value === null || value === undefined) delete process.env.MINDRIAN_MCP_FIRST;
  else process.env.MINDRIAN_MCP_FIRST = value;
  try {
    return fn();
  } finally {
    if (typeof previous === 'string') process.env.MINDRIAN_MCP_FIRST = previous;
    else delete process.env.MINDRIAN_MCP_FIRST;
  }
}

process.stdout.write('Phase 234-05 (D-05): host-tier axis + write-path gate\n');

// ---------------------------------------------------------------------------
// PART A1 -- the existing surface-detect exports are untouched (Canon Part 7:
// this plan EXTENDS the chokepoint, it does not fork or replace it).
// ---------------------------------------------------------------------------
process.stdout.write('\n-- A1: existing chokepoint exports survive the extension --\n');

check('detectSurface is still exported as a function', typeof detectSurface === 'function');
check('CAPABILITY_MAP is still exported with all three surfaces',
  !!CAPABILITY_MAP && !!CAPABILITY_MAP.cli && !!CAPABILITY_MAP.desktop && !!CAPABILITY_MAP.cowork);
check('isMcpFirst is still exported as a function', typeof isMcpFirst === 'function');
check('mcpFirstSurfaces is still exported as a function', typeof mcpFirstSurfaces === 'function');
check('detectHostTier is exported as a function', typeof detectHostTier === 'function');
check('isWritePathEnabled is exported as a function', typeof isWritePathEnabled === 'function');
check('HOST_TIER_MAP is exported', !!HOST_TIER_MAP && typeof HOST_TIER_MAP === 'object');

// detectHostTier must be PURE with respect to ambient state: it reads its one
// argument and nothing else. If it ever started consulting process.env, this
// pair of calls would diverge.
check('detectHostTier ignores ambient MINDRIAN_MCP_FIRST (pure, argument-only)',
  withFlag(null, () => JSON.stringify(detectHostTier({ name: 'Cursor', version: '1' }))) ===
  withFlag('all', () => JSON.stringify(detectHostTier({ name: 'Cursor', version: '1' }))));

// ---------------------------------------------------------------------------
// PART A2 -- detectHostTier: Tier 1 (hook-capable hosts, D-02).
// ---------------------------------------------------------------------------
process.stdout.write('\n-- A2: Tier-1 hosts (hook-capable) --\n');

const cc = detectHostTier({ name: 'claude-code', version: '1.0' });
check("detectHostTier({name:'claude-code'}) -> host 'claude-code'", cc && cc.host === 'claude-code');
check("detectHostTier({name:'claude-code'}) -> hostTier 'tier1'", cc && cc.hostTier === 'tier1');

check("detectHostTier({name:'Claude Code'}) (spaced/cased variant) -> tier1",
  detectHostTier({ name: 'Claude Code', version: '1.0' }).hostTier === 'tier1');

const grok = detectHostTier({ name: 'Grok Build', version: '1.0' });
check("detectHostTier({name:'Grok Build'}) -> hostTier 'tier1'", grok && grok.hostTier === 'tier1');
check("detectHostTier({name:'Grok Build'}) -> a recognized (non-unknown) host", grok && grok.host !== 'unknown');

const oc = detectHostTier({ name: 'opencode', version: '1.0' });
check("detectHostTier({name:'opencode'}) -> hostTier 'tier1'", oc && oc.hostTier === 'tier1');
check("detectHostTier({name:'opencode'}) -> a recognized (non-unknown) host", oc && oc.host !== 'unknown');

// ---------------------------------------------------------------------------
// PART A3 -- detectHostTier: Tier 0 (recognized, MCP + skills only).
// ---------------------------------------------------------------------------
process.stdout.write('\n-- A3: Tier-0 hosts (recognized, no hooks) --\n');

const TIER0_NAMES = ['Cursor', 'Visual Studio Code', 'goose', 'Zed'];
TIER0_NAMES.forEach((name) => {
  const t = detectHostTier({ name: name, version: '1.0' });
  check("detectHostTier({name:'" + name + "'}) -> hostTier 'tier0'", t && t.hostTier === 'tier0');
  check("detectHostTier({name:'" + name + "'}) -> RECOGNIZED (host is not 'unknown')", t && t.host !== 'unknown');
});

// The rest of SEED-068's Tier-0 matrix, recognized so the capability floor can
// name the host honestly rather than shrugging.
['Cline', 'Continue', 'Windsurf', 'Devin', 'GitHub Copilot'].forEach((name) => {
  const t = detectHostTier({ name: name, version: '1.0' });
  check("detectHostTier({name:'" + name + "'}) -> recognized tier0",
    t && t.hostTier === 'tier0' && t.host !== 'unknown');
});

// ---------------------------------------------------------------------------
// PART A4 -- detectHostTier: the defensive floor. Unknown and pre-initialize
// both resolve to the conservative answer and NEVER throw (RESEARCH Assumption
// A4: clientInfo.name distinguishability is not guaranteed).
// ---------------------------------------------------------------------------
process.stdout.write('\n-- A4: unknown + pre-initialize resolve to the conservative floor --\n');

const preInit = detectHostTier(undefined);
check('detectHostTier(undefined) does not throw and returns an object', !!preInit && typeof preInit === 'object');
check("detectHostTier(undefined) -> host 'unknown'", preInit.host === 'unknown');
check("detectHostTier(undefined) -> hostTier 'tier0'", preInit.hostTier === 'tier0');

const novel = detectHostTier({ name: 'SomeNewClientNeverSeenBefore', version: '1.0' });
check("detectHostTier(novel client) -> host 'unknown'", novel.host === 'unknown');
check("detectHostTier(novel client) -> hostTier 'tier0'", novel.hostTier === 'tier0');

[null, {}, { name: '' }, { name: 42 }, 'a string', 123, []].forEach((bad, i) => {
  let out = null;
  let threw = false;
  try { out = detectHostTier(bad); } catch (_e) { threw = true; }
  check('detectHostTier(malformed input #' + i + ') never throws and floors to unknown/tier0',
    !threw && out && out.host === 'unknown' && out.hostTier === 'tier0');
});

// ---------------------------------------------------------------------------
// PART A5 -- isWritePathEnabled: Gap D closed, without a regression.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- A5: write-path gate --\n');

// 2026-08-19 (quick task 260819-bql): Claude Code now gets the write path ON
// by default. The three write tools ARE the governed navigation.cjs door;
// refusing them on the home surface provoked an ungoverned direct-disk
// bypass (RCA .planning/debug/resolved/mcp-write-path-disabled-on-cli-host.md).
check("flag unset + claude-code -> write path ON (the three write tools ARE the governed navigation.cjs door; refusing them provoked an ungoverned direct-disk bypass)",
  withFlag(null, () => isWritePathEnabled({ surface: 'cli', clientVersion: { name: 'claude-code' } })) === true);

// THE GAP D FIX: a confidently-recognized foreign host gets the write path by
// default, with no hand-set env var.
check("flag unset + Cursor -> write path ON (Gap D fix, no env var needed)",
  withFlag(null, () => isWritePathEnabled({ surface: 'desktop', clientVersion: { name: 'Cursor' } })) === true);

['Visual Studio Code', 'goose', 'Zed', 'Cline'].forEach((name) => {
  check("flag unset + " + name + " -> write path ON by default",
    withFlag(null, () => isWritePathEnabled({ surface: 'desktop', clientVersion: { name: name } })) === true);
});

// The deliberate resolution of the unknown-host tension (T-234-09): an
// UNIDENTIFIED client does not silently gain write access. This is not a
// silent skip -- Part B proves the tool stays visible in tools/list and
// returns an informative reason on call.
//
// These two checks are now the LOAD-BEARING conservative floor: since
// claude-code no longer sits in the false population, the unknown-host and
// novel-unrecognized-host checks are what proves an unidentified caller still
// cannot silently gain write access.
check('flag unset + unknown host -> write path OFF (conservative floor)',
  withFlag(null, () => isWritePathEnabled({ surface: 'desktop', clientVersion: undefined })) === false);
check('flag unset + novel unrecognized host -> write path OFF',
  withFlag(null, () => isWritePathEnabled({ surface: 'desktop', clientVersion: { name: 'SomeNewClientNeverSeenBefore' } })) === false);

// Tier-1 non-Claude-Code hosts (Grok Build, OpenCode) have hooks of their own,
// so they keep the legacy default too. Tier is the discriminator, not "is it
// Anthropic".
check('flag unset + Grok Build (tier1) -> write path OFF (has its own hook channel)',
  withFlag(null, () => isWritePathEnabled({ surface: 'cli', clientVersion: { name: 'Grok Build' } })) === false);
check('flag unset + OpenCode (tier1) -> write path OFF (has its own hook channel)',
  withFlag(null, () => isWritePathEnabled({ surface: 'cli', clientVersion: { name: 'opencode' } })) === false);

// NO REGRESSION: an explicit flag ALWAYS wins over host-tier auto-detection,
// for every host, on the named surface.
check("MINDRIAN_MCP_FIRST=cli + Cursor on cli -> ON (explicit flag wins)",
  withFlag('cli', () => isWritePathEnabled({ surface: 'cli', clientVersion: { name: 'Cursor' } })) === true);
check("MINDRIAN_MCP_FIRST=cli + claude-code on cli -> ON (explicit flag wins over the legacy default)",
  withFlag('cli', () => isWritePathEnabled({ surface: 'cli', clientVersion: { name: 'claude-code' } })) === true);
check("MINDRIAN_MCP_FIRST=all + unknown host -> ON (explicit flag wins over the conservative floor)",
  withFlag('all', () => isWritePathEnabled({ surface: 'desktop', clientVersion: undefined })) === true);
// 2026-08-19 (quick task 260819-bql): with claude-code now permitted by host
// detection alone, a flag naming only 'cli' no longer produces an observable
// OFF for a claude-code call on desktop (host detection grants it anyway).
// The surviving per-surface fact needs a host that is STILL in the false
// population to observe: Grok Build (tier1, has its own hook channel).
check("MINDRIAN_MCP_FIRST=cli + Grok Build on DESKTOP -> OFF (the flag is still per-surface: naming only cli does not enable desktop)",
  withFlag('cli', () => isWritePathEnabled({ surface: 'desktop', clientVersion: { name: 'Grok Build' } })) === false);

// Defensive default: malformed input never flips a capability ON.
[undefined, null, {}, { surface: 42 }, 'nonsense'].forEach((bad, i) => {
  let threw = false;
  let out = null;
  try { out = withFlag(null, () => isWritePathEnabled(bad)); } catch (_e) { threw = true; }
  check('isWritePathEnabled(malformed #' + i + ') never throws and never enables', !threw && out === false);
});

// ---------------------------------------------------------------------------
// PART B -- the live proof. Everything above is a unit call against a pure
// function. This part spawns the REAL server and speaks real JSON-RPC to it,
// because the claim being made is about what a FOREIGN HOST receives on the
// wire, and only the wire can settle that. Two things are proved that a unit
// test structurally cannot:
//
//   1. The write tools are in tools/list even when the write path is refused
//      for this caller. That is the actual repair to Gap D: before it, a
//      Cursor-side model could not see graph_write at all, so it had nothing
//      to ask for and no error to report. Discovery and permission are now
//      separate concerns.
//   2. A refused call REFUSES OUT LOUD. It returns
//      {ok:false, reason:'write_path_disabled', hint:...}, never a silent
//      no-op and never a fabricated success (T-234-09).
//
// The only variable across the two runs is clientInfo.name.
// ---------------------------------------------------------------------------

const fs = require('node:fs');
const os = require('node:os');
const cp = require('node:child_process');
const roomDb = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const TIMEOUT_MS = 20000;

/**
 * Drive a full handshake plus a scripted request sequence against a real
 * server process, under a hermetic HOME with a real (empty but schema-valid)
 * room.db so a permitted graph_write reaches the genuine navigation.cjs write
 * path rather than bailing out on a missing store.
 *
 * MINDRIAN_MCP_FIRST is explicitly DELETED from the child env: the whole point
 * is what happens on a host that has never heard of the flag.
 *
 * @param {string} clientName - the clientInfo.name to present as
 * @param {string|undefined} mcpFirst - when set, MINDRIAN_MCP_FIRST is exported
 *   into the child instead of deleted (the existing-user regression case)
 * @returns {Promise<{ok: boolean, reason?: string, responses?: object}>}
 */
function driveServer(clientName, mcpFirst) {
  return new Promise((resolve) => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-234-hosttier-'));
    const room = path.join(tmpHome, 'room');
    fs.mkdirSync(room, { recursive: true });
    // Create .mindrian/room.db + schema so the write path is genuinely
    // reachable. Without this, a permitted write would return no_room_db and
    // the test could not tell "allowed" from "allowed but nowhere to write".
    try {
      const boot = roomDb.openRoomDb(room);
      roomDb.closeRoomDb(boot);
    } catch (_e) {
      // Fall through: the drive still runs, and the assertions below treat
      // no_room_db as a distinct outcome from write_path_disabled.
    }

    const env = Object.assign({}, process.env, {
      HOME: tmpHome,
      MINDRIAN_TRANSPORT: 'stdio',
      MINDRIAN_ROOM: room,
      MINDRIAN_ROOMS_HOME: path.join(tmpHome, 'MindrianRooms'),
      CLAUDE_ACTIVE_ROOM: room,
    });
    delete env.MINDRIAN_MCP_FIRST;
    delete env.MINDRIAN_BRAIN_KEY;
    if (typeof mcpFirst === 'string') env.MINDRIAN_MCP_FIRST = mcpFirst;

    const proc = cp.spawn('node', [SERVER], {
      cwd: tmpHome,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    const responses = {};
    let stdoutBuf = '';
    let stderrBuf = '';
    let settled = false;

    function finish(payload) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { proc.kill('SIGKILL'); } catch (_e) { /* already gone */ }
      try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
      resolve(payload);
    }

    const timer = setTimeout(() => {
      finish({ ok: false, reason: 'timeout', responses: responses, stderr: stderrBuf.slice(-800) });
    }, TIMEOUT_MS);

    function send(obj) {
      try { proc.stdin.write(JSON.stringify(obj) + '\n'); } catch (_e) { /* the exit handler reports */ }
    }

    proc.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf8');
      let nl;
      while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        let obj;
        try { obj = JSON.parse(line); } catch (_e) { continue; }
        if (!obj || obj.id === undefined || obj.id === null) continue;
        responses[obj.id] = obj;

        if (obj.id === 1) {
          // initialize answered -> complete the handshake, then ask for the
          // catalog. getClientVersion() is populated from here on.
          send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
          send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
        } else if (obj.id === 2) {
          send({
            jsonrpc: '2.0', id: 3, method: 'tools/call',
            params: {
              name: 'graph_write',
              arguments: {
                source_id: 'node:host-tier-a',
                target_id: 'node:host-tier-b',
                edge_type: 'INFORMS',
                properties: { note: 'phase 234-05 live host-tier drive' },
              },
            },
          });
        } else if (obj.id === 3) {
          send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'status_read', arguments: {} } });
        } else if (obj.id === 4) {
          finish({ ok: true, responses: responses });
        }
      }
    });

    proc.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });
    proc.on('error', (err) => finish({ ok: false, reason: 'spawn_error', message: err.message }));
    proc.on('exit', (code) => finish({
      ok: false, reason: 'exited_before_completion', code, responses: responses, stderr: stderrBuf.slice(-800),
    }));

    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: clientName, version: '1.0.0' },
      },
    });
  });
}

/** Parse a tools/call result's JSON text payload. */
function toolPayload(response) {
  try {
    const content = response && response.result && response.result.content;
    if (!Array.isArray(content) || !content.length) return null;
    return JSON.parse(content[0].text);
  } catch (_e) {
    return null;
  }
}

function toolNames(response) {
  const tools = response && response.result && response.result.tools;
  return Array.isArray(tools) ? tools.map((t) => t.name) : [];
}

(async function livePart() {
  process.stdout.write('\n-- B: live JSON-RPC drive against the real server (no MINDRIAN_MCP_FIRST) --\n');

  // A Cursor-like identity. Recognized, tier0, not Claude Code -> permitted.
  const foreign = await driveServer('test-cursor-sim');
  // Claude Code's own identity. 2026-08-19 (quick task 260819-bql): now
  // PERMITTED by default, the same as a recognized tier0 host -- these three
  // tools ARE the governed Part 9 door.
  const claude = await driveServer('claude-code');
  // An unidentified/never-seen client. This is where the honest-refusal proof
  // moved to once claude-code left the false population: the conservative
  // floor still refuses, out loud, with an accurate hint.
  const unidentified = await driveServer('SomeNewClientNeverSeenBefore');

  [
    ['foreign host (test-cursor-sim)', foreign],
    ['claude-code', claude],
    ['unidentified client', unidentified],
  ].forEach(([label, run]) => {
    check('the ' + label + ' drive completed the full handshake + 3 calls' +
      (run.ok ? '' : ' [' + run.reason + ' ' + (run.stderr || run.message || '') + ']'), run.ok === true);
  });

  if (!foreign.ok || !claude.ok || !unidentified.ok) {
    process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
    process.exit(1);
    return;
  }

  // B1. DISCOVERY is unconditional. This is the assertion that would have
  // failed before this plan, on both runs.
  const foreignTools = toolNames(foreign.responses[2]);
  const claudeTools = toolNames(claude.responses[2]);
  check('tools/list is non-empty on the foreign-host drive (the catalog really was read)', foreignTools.length > 0);
  ['graph_write', 'memory_event', 'artifact_file'].forEach((name) => {
    check('tools/list includes ' + name + ' on a FOREIGN host with the flag unset', foreignTools.indexOf(name) !== -1);
    check('tools/list includes ' + name + ' on CLAUDE CODE with the flag unset (visible even where refused)',
      claudeTools.indexOf(name) !== -1);
  });
  check('the catalog is identical across the two host identities (host changes permission, not discovery)',
    JSON.stringify(foreignTools.slice().sort()) === JSON.stringify(claudeTools.slice().sort()));

  // B2. PERMISSION follows the host. The foreign host reaches the real write
  // path; no_room_db would mean the gate passed but the store was missing, so
  // it is called out separately rather than being quietly accepted.
  const foreignWrite = toolPayload(foreign.responses[3]);
  check('foreign-host graph_write returned a parseable payload', foreignWrite !== null);
  check('foreign-host graph_write was NOT refused by the write gate (Gap D closed)',
    foreignWrite && foreignWrite.reason !== 'write_path_disabled');
  check('foreign-host graph_write reached the REAL write path and succeeded' +
    (foreignWrite && !foreignWrite.ok ? ' [got reason: ' + foreignWrite.reason + ']' : ''),
    foreignWrite && foreignWrite.ok === true);

  // B3. 2026-08-19 (quick task 260819-bql): claude-code is now PERMITTED, the
  // same proof shape B2 used for the foreign host. It reaches the real
  // navigation.cjs write path against the hermetic room.db this harness
  // already creates.
  const claudeWrite = toolPayload(claude.responses[3]);
  check('claude-code graph_write returned a parseable payload', claudeWrite !== null);
  check('claude-code graph_write was NOT refused by the write gate (2026-08-19 fix)',
    claudeWrite && claudeWrite.reason !== 'write_path_disabled');
  check('claude-code graph_write reached the REAL write path and succeeded' +
    (claudeWrite && !claudeWrite.ok ? ' [got reason: ' + claudeWrite.reason + ']' : ''),
    claudeWrite && claudeWrite.ok === true);
  check('claude-code graph_write is NOT flagged isError on the wire',
    claude.responses[3] && claude.responses[3].result && claude.responses[3].result.isError !== true);

  // B4. status_read states the floor honestly, on both axes, live (D-05).
  const foreignStatus = toolPayload(foreign.responses[4]);
  const claudeStatus = toolPayload(claude.responses[4]);
  check('status_read returned segments on the foreign-host drive',
    foreignStatus && foreignStatus.segments && typeof foreignStatus.segments === 'object');
  const ff = foreignStatus && foreignStatus.segments && foreignStatus.segments.capability_floor;
  const cf = claudeStatus && claudeStatus.segments && claudeStatus.segments.capability_floor;
  check('status_read carries a capability_floor segment', !!ff && typeof ff === 'object');
  check('capability_floor states the surface axis', !!ff && Object.prototype.hasOwnProperty.call(ff, 'surface'));
  check('capability_floor states the host_tier axis', !!ff && !!ff.host_tier && typeof ff.host_tier === 'object');
  check('capability_floor states write_path_enabled',
    !!ff && Object.prototype.hasOwnProperty.call(ff, 'write_path_enabled'));
  check('capability_floor on the foreign host reports write_path_enabled true (matches what graph_write did)',
    !!ff && ff.write_path_enabled === true);
  // 2026-08-19 (quick task 260819-bql): matches what graph_write did (B3).
  check('capability_floor on claude-code reports write_path_enabled true (matches what graph_write did)',
    !!cf && cf.write_path_enabled === true);
  check("capability_floor identifies claude-code as tier1", !!cf && cf.host_tier.hostTier === 'tier1');
  check("capability_floor identifies the Cursor-like client as tier0 (recognized, no hook channel)",
    !!ff && ff.host_tier.hostTier === 'tier0' && ff.host_tier.host === 'cursor');

  // B4b. The honest-refusal proof, relocated to the unidentified client.
  // Discovery stays unconditional even where permission is refused.
  const unidentifiedTools = toolNames(unidentified.responses[2]);
  ['graph_write', 'memory_event', 'artifact_file'].forEach((name) => {
    check('tools/list includes ' + name + ' on an UNIDENTIFIED client with the flag unset (discovery stays unconditional)',
      unidentifiedTools.indexOf(name) !== -1);
  });
  const unidentifiedWrite = toolPayload(unidentified.responses[3]);
  check('unidentified-client graph_write returned a parseable payload', unidentifiedWrite !== null);
  check('unidentified-client graph_write is refused', unidentifiedWrite && unidentifiedWrite.ok === false);
  check("unidentified-client graph_write refusal names the reason 'write_path_disabled'",
    unidentifiedWrite && unidentifiedWrite.reason === 'write_path_disabled');
  check('unidentified-client graph_write refusal carries an actionable hint (not a silent skip)',
    unidentifiedWrite && typeof unidentifiedWrite.hint === 'string' && unidentifiedWrite.hint.length > 0);
  check('unidentified-client graph_write refusal is flagged isError on the wire',
    unidentified.responses[3] && unidentified.responses[3].result && unidentified.responses[3].result.isError === true);
  // Stale-prose guard: catches a hint that drifts back to describing the
  // retired "non-Claude-Code host" rule.
  check("unidentified-client graph_write hint does not describe the retired 'non-Claude-Code' rule",
    unidentifiedWrite && unidentifiedWrite.hint && unidentifiedWrite.hint.indexOf('non-Claude-Code') === -1);
  const unidentifiedStatus = toolPayload(unidentified.responses[4]);
  const uf = unidentifiedStatus && unidentifiedStatus.segments && unidentifiedStatus.segments.capability_floor;
  check('capability_floor on the unidentified client reports write_path_enabled false',
    !!uf && uf.write_path_enabled === false);
  check("capability_floor identifies the unidentified client as host 'unknown'",
    !!uf && uf.host_tier && uf.host_tier.host === 'unknown');

  // B5. THE REGRESSION CHECK, proved on the wire rather than argued. An
  // existing user who set MINDRIAN_MCP_FIRST by hand must see exactly what
  // they saw before this plan: the write path open on Claude Code, the host
  // axis unable to override their explicit instruction.
  process.stdout.write('\n-- B5: explicit MINDRIAN_MCP_FIRST still wins over host-tier detection --\n');
  const claudeFlagged = await driveServer('claude-code', 'all');
  check('the flag-ON claude-code drive completed' +
    (claudeFlagged.ok ? '' : ' [' + claudeFlagged.reason + ' ' + (claudeFlagged.stderr || '') + ']'),
    claudeFlagged.ok === true);
  if (claudeFlagged.ok) {
    const flaggedWrite = toolPayload(claudeFlagged.responses[3]);
    check('MINDRIAN_MCP_FIRST=all + claude-code: graph_write is NOT refused (no regression for existing users)',
      flaggedWrite && flaggedWrite.reason !== 'write_path_disabled');
    check('MINDRIAN_MCP_FIRST=all + claude-code: graph_write reaches the real write path and succeeds' +
      (flaggedWrite && !flaggedWrite.ok ? ' [got reason: ' + flaggedWrite.reason + ']' : ''),
      flaggedWrite && flaggedWrite.ok === true);
    const flaggedStatus = toolPayload(claudeFlagged.responses[4]);
    const xf = flaggedStatus && flaggedStatus.segments && flaggedStatus.segments.capability_floor;
    check('capability_floor reports write_path_enabled true under the explicit flag, on a tier1 host',
      !!xf && xf.write_path_enabled === true && xf.host_tier.hostTier === 'tier1');
  }

  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
