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
 * Phase 358-02 (Rome B1, navigator ruling 2026-09-23, "Desktop writes: YES"):
 * Claude Desktop identifies itself as clientInfo.name 'claude-ai' and was
 * refused the write path by this same gate, exactly like the pre-260819-bql
 * claude-code case above -- so it gets the identical treatment, added as a
 * recognized tier0 host (host 'claude-desktop'), not a tier1 promotion (it
 * has no hook channel of its own). Cowork is intentionally NOT recognized
 * here: its MCP client name has not been confirmed by a live probe, and the
 * demo-machine fallback MINDRIAN_MCP_FIRST=desktop,cowork is documented
 * (358-06) rather than guessed at in code. An anchored regex (^claude-ai$)
 * keeps look-alike names such as claude-ai-beta on the conservative floor.
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

// 2026-09-23 navigator ruling (Phase 358 B1): Claude Desktop identifies as
// clientInfo.name 'claude-ai'. Recognized tier0 (not tier1: no hook channel
// of its own), same anchored-regex discipline as every other tier0 entry so
// a look-alike name never rides in on a substring match.
const desktop = detectHostTier({ name: 'claude-ai', version: '0.1.0' });
check("detectHostTier({name:'claude-ai'}) -> host 'claude-desktop'", desktop && desktop.host === 'claude-desktop');
check("detectHostTier({name:'claude-ai'}) -> hostTier 'tier0'", desktop && desktop.hostTier === 'tier0');
check("detectHostTier({name:'Claude-AI'}) (cased variant) -> host 'claude-desktop'",
  detectHostTier({ name: 'Claude-AI', version: '0.1.0' }).host === 'claude-desktop');

['claude-ai-beta', 'my-claude-ai', 'claude-aix'].forEach((name) => {
  const t = detectHostTier({ name: name, version: '0.1.0' });
  check("detectHostTier({name:'" + name + "'}) -> host 'unknown' (look-alike stays refused)", t && t.host === 'unknown');
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
// PART A1b -- quick 261026-s8c item 1: CLAUDE_CODE_ENTRYPOINT=cli is surface
// cli. The rule sits after the Cowork rule and before the stdin rules, so an
// explicit MINDRIAN_TRANSPORT or CLAUDE_SURFACE, and the Cowork indicators,
// still win. The match is exact equality.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- A1b: CLAUDE_CODE_ENTRYPOINT=cli gives surface cli --\n');

// Own every variable the detector reads, stub the /sessions probe and the
// stdin TTY flag, and restore everything in finally. A null value deletes.
function withSurfaceEnv(vars, fn) {
  const fsMod = require('node:fs');
  const keys = ['MINDRIAN_TRANSPORT', 'CLAUDE_SURFACE', 'CLAUDE_CODE_ENTRYPOINT', 'COWORK_SESSION_ID'];
  const savedEnv = {};
  keys.forEach((k) => { savedEnv[k] = process.env[k]; delete process.env[k]; });
  Object.keys(vars).forEach((k) => {
    if (vars[k] !== null && vars[k] !== undefined) process.env[k] = vars[k];
  });
  const realExists = fsMod.existsSync;
  fsMod.existsSync = function (p) {
    if (p === '/sessions') return false;
    return realExists.apply(fsMod, arguments);
  };
  const ownTty = Object.prototype.hasOwnProperty.call(process.stdin, 'isTTY');
  const savedTty = process.stdin.isTTY;
  process.stdin.isTTY = false;
  try {
    return fn();
  } finally {
    fsMod.existsSync = realExists;
    if (ownTty) process.stdin.isTTY = savedTty; else delete process.stdin.isTTY;
    keys.forEach((k) => {
      if (typeof savedEnv[k] === 'string') process.env[k] = savedEnv[k]; else delete process.env[k];
    });
  }
}

function surfaceOf(vars) {
  return withSurfaceEnv(vars, () => {
    const d = detectSurface();
    return d.surface + '/' + d.transport;
  });
}

check('ENTRYPOINT=cli alone -> cli/stdio', surfaceOf({ CLAUDE_CODE_ENTRYPOINT: 'cli' }) === 'cli/stdio');
check('ENTRYPOINT=cli alone -> capabilities are CAPABILITY_MAP.cli',
  withSurfaceEnv({ CLAUDE_CODE_ENTRYPOINT: 'cli' }, () => detectSurface().capabilities) === CAPABILITY_MAP.cli);
check('ENTRYPOINT=cli + CLAUDE_SURFACE=desktop -> desktop/stdio (explicit surface wins)',
  surfaceOf({ CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_SURFACE: 'desktop' }) === 'desktop/stdio');
check('ENTRYPOINT=cli + CLAUDE_SURFACE=cowork -> cowork/http (explicit surface wins)',
  surfaceOf({ CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_SURFACE: 'cowork' }) === 'cowork/http');
check('ENTRYPOINT=cli + CLAUDE_SURFACE=cli -> cli/stdio',
  surfaceOf({ CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_SURFACE: 'cli' }) === 'cli/stdio');
check('ENTRYPOINT=cli + MINDRIAN_TRANSPORT=http -> cowork/http (explicit transport wins)',
  surfaceOf({ CLAUDE_CODE_ENTRYPOINT: 'cli', MINDRIAN_TRANSPORT: 'http' }) === 'cowork/http');
check('ENTRYPOINT=cli + MINDRIAN_TRANSPORT=stdio -> desktop/stdio (explicit transport wins)',
  surfaceOf({ CLAUDE_CODE_ENTRYPOINT: 'cli', MINDRIAN_TRANSPORT: 'stdio' }) === 'desktop/stdio');
check('ENTRYPOINT=cli + COWORK_SESSION_ID -> cowork/http (the Cowork rule runs first)',
  surfaceOf({ CLAUDE_CODE_ENTRYPOINT: 'cli', COWORK_SESSION_ID: 'abc' }) === 'cowork/http');
['claude-desktop', 'sdk-ts', 'CLI', ''].forEach((v) => {
  check("ENTRYPOINT='" + v + "' (non-TTY stdin) -> desktop/stdio (exact match only)",
    surfaceOf({ CLAUDE_CODE_ENTRYPOINT: v }) === 'desktop/stdio');
});
check('no ENTRYPOINT (non-TTY stdin) -> desktop/stdio (rule 4 unchanged)', surfaceOf({}) === 'desktop/stdio');

const NOVEL_CLIENT = { name: 'SomeNewClientNeverSeenBefore' };
const cliSurface = withSurfaceEnv({ CLAUDE_CODE_ENTRYPOINT: 'cli' }, () => detectSurface().surface);
check('ENTRYPOINT=cli + MINDRIAN_MCP_FIRST=cli + unrecognized client -> write path ON',
  withFlag('cli', () => isWritePathEnabled({ surface: cliSurface, clientVersion: NOVEL_CLIENT })) === true);
check('ENTRYPOINT=cli + flag unset + unrecognized client -> write path OFF',
  withFlag(null, () => isWritePathEnabled({ surface: cliSurface, clientVersion: NOVEL_CLIENT })) === false);
check('ENTRYPOINT=cli + MINDRIAN_MCP_FIRST=desktop only + unrecognized client -> write path OFF',
  withFlag('desktop', () => isWritePathEnabled({ surface: cliSurface, clientVersion: NOVEL_CLIENT })) === false);

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

// 2026-09-23 navigator ruling (Phase 358 B1): Claude Desktop (claude-ai) gets
// the write path by default too, on both surfaces it can plausibly report,
// with no hand-set env var. A look-alike name stays refused.
check("flag unset + claude-ai on desktop -> write path ON (navigator ruling 2026-09-23, Phase 358 B1)",
  withFlag(null, () => isWritePathEnabled({ surface: 'desktop', clientVersion: { name: 'claude-ai' } })) === true);
check("flag unset + claude-ai on cowork -> write path ON (same host, either surface)",
  withFlag(null, () => isWritePathEnabled({ surface: 'cowork', clientVersion: { name: 'claude-ai' } })) === true);
check("flag unset + claude-ai-beta on desktop -> write path OFF (look-alike stays refused)",
  withFlag(null, () => isWritePathEnabled({ surface: 'desktop', clientVersion: { name: 'claude-ai-beta' } })) === false);

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
// PART A7 -- quick 261026-s8c item 2: the client identity log line. One line
// per connection, stderr only, name and version only, sanitized.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- A7: client identity log line (stderr, once per connection) --\n');
{
  const { logClientIdentityOnce } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'client-identity-log.cjs'));
  const realWrite = process.stderr.write;
  const realStdout = process.stdout.write;
  function recordStderr(fn) {
    const lines = [];
    let stdoutTouched = false;
    process.stderr.write = function (chunk) { lines.push(String(chunk)); return true; };
    try {
      fn();
    } finally {
      process.stderr.write = realWrite;
    }
    return { lines, stdoutTouched };
  }
  const fakeServer = (cv) => ({ getClientVersion: () => cv });

  const s1 = fakeServer({ name: 'Claude Code', version: '2.1.310' });
  const rec1 = recordStderr(() => {
    check('logClientIdentityOnce returns true on the first call', logClientIdentityOnce(s1, 'initialize') === true);
    check('logClientIdentityOnce returns false on the second call, same server', logClientIdentityOnce(s1, 'status_read') === false);
  });
  check('one write for two calls with the same fake server', rec1.lines.length === 1);
  check('the line matches the pinned format',
    rec1.lines[0] === '[mindrian-os] client identity: name="Claude Code" version="2.1.310" via=initialize source=client_version\n');

  const s2 = fakeServer({ name: 'Other', version: '1' });
  const rec2 = recordStderr(() => { logClientIdentityOnce(s2, 'initialize'); });
  check('a second fake server writes again', rec2.lines.length === 1);

  const longVersion = 'v'.repeat(500);
  const nasty = fakeServer({ name: 'bad"name\nforged line\r\txé', version: longVersion, title: 'TITLE-LEAK', websiteUrl: 'URL-LEAK', icons: [1], capabilities: { x: 1 } });
  const rec3 = recordStderr(() => { logClientIdentityOnce(nasty, 'initialize'); });
  const text3 = rec3.lines.join('');
  check('a hostile name is written as one line (no newline except the final one)',
    rec3.lines.length === 1 && text3.indexOf('\n') === text3.length - 1 && text3.indexOf('\r') === -1);
  check('a quote in the name is escaped', text3.indexOf('name="bad\\"name') !== -1);
  check('non-ASCII characters become ?', text3.indexOf('?') !== -1 && text3.indexOf('é') === -1);
  check('a 500 character version is cut to 64 characters', text3.indexOf('"' + 'v'.repeat(64) + '"') !== -1 && text3.indexOf('v'.repeat(65)) === -1);
  check('extra client fields never appear in the line',
    ['TITLE-LEAK', 'URL-LEAK', 'icons', 'capabilities'].every((w) => text3.indexOf(w) === -1));

  const throwing = { getClientVersion: () => { throw new Error('boom'); } };
  let threw = false;
  let throwResult;
  recordStderr(() => { try { throwResult = logClientIdentityOnce(throwing, 'initialize'); } catch (_e) { threw = true; } });
  check('a throwing getClientVersion does not throw', threw === false);
  check('a null inner server returns false and writes nothing', (() => {
    let r;
    const rec = recordStderr(() => { r = logClientIdentityOnce(null, 'initialize'); });
    return r === false && rec.lines.length === 0;
  })());

  const envExtra = { mcpReq: { envelope: { 'io.modelcontextprotocol/clientInfo': { name: 'Claude Code', version: '2.1.310' } } } };
  const rec4 = recordStderr(() => { logClientIdentityOnce(fakeServer(undefined), 'status_read', envExtra); });
  check('the envelope fallback is used when getClientVersion returns undefined',
    rec4.lines[0] === '[mindrian-os] client identity: name="Claude Code" version="2.1.310" via=status_read source=envelope\n');
  const rec5 = recordStderr(() => { logClientIdentityOnce(fakeServer(null), 'status_read', {}); });
  check('both sources missing writes name=none and source=none',
    rec5.lines[0] === '[mindrian-os] client identity: name=none version=none via=status_read source=none\n');
  check('process.stdout.write was never replaced or used by the module', process.stdout.write === realStdout);
}

// ---------------------------------------------------------------------------
// PART A8 -- quick 261026-s8c item 3: one shared refusal hint that names the
// detected surface, the host and the exact MINDRIAN_MCP_FIRST value.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- A8: write_path_disabled hint (shared helper) --\n');
{
  const { writePathOffHint } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'mcp-first-flag.cjs'));
  check('writePathOffHint is exported as a function', typeof writePathOffHint === 'function');
  if (typeof writePathOffHint === 'function') {
    check('surface cli, no client -> exact text',
      writePathOffHint({ surface: 'cli', clientVersion: undefined }) ===
        'Write path is off: detected surface=cli, host=unknown. Set MINDRIAN_MCP_FIRST=cli (or all) and restart the session.');
    check('surface desktop, Grok Build -> exact text',
      writePathOffHint({ surface: 'desktop', clientVersion: { name: 'Grok Build' } }) ===
        'Write path is off: detected surface=desktop, host=grok-build. Set MINDRIAN_MCP_FIRST=desktop (or all) and restart the session.');
    check('surface cowork with a given host string uses that host',
      writePathOffHint({ surface: 'cowork', host: 'unknown' }) ===
        'Write path is off: detected surface=cowork, host=unknown. Set MINDRIAN_MCP_FIRST=cowork (or all) and restart the session.');
    check('an unknown surface says surface=unknown and names all once',
      writePathOffHint({ surface: 'weird', host: 'x' }) ===
        'Write path is off: detected surface=unknown, host=x. Set MINDRIAN_MCP_FIRST=all and restart the session.');
    check('a missing surface says surface=unknown',
      writePathOffHint({ clientVersion: undefined }).indexOf('surface=unknown') !== -1);
    check('a hostile surface value is never echoed',
      writePathOffHint({ surface: 'cli\nevil', host: 'unknown' }).indexOf('evil') === -1);
    [undefined, null, 'a string', 42, [], {}].forEach((junk, i) => {
      let out; let threw = false;
      try { out = writePathOffHint(junk); } catch (_e) { threw = true; }
      check('writePathOffHint(junk #' + i + ') never throws and names MINDRIAN_MCP_FIRST',
        !threw && typeof out === 'string' && out.indexOf('MINDRIAN_MCP_FIRST') !== -1);
    });
    check('hint text has no em-dash or en-dash',
      !/[\u2013\u2014]/.test(writePathOffHint({ surface: 'cli' }) + writePathOffHint({ surface: 'x' })));
  }
}

// The six refusing handlers, through register() with a recording fake server.
// Handlers are async, so the runs are collected here and awaited at the top of
// the live part, where the results are checked.
function recordHandlers(modulePath, ctx, getClientVersion) {
  const handlers = {};
  const target = {
    server: { getClientVersion: getClientVersion || (() => undefined) },
    registerTool(name, _cfg, handler) { handlers[name] = handler; },
  };
  const fake = new Proxy(target, {
    get(t, prop) { return prop in t ? t[prop] : function noop() { return undefined; }; },
  });
  require(modulePath).register(fake, ctx);
  return handlers;
}
const TOOLS_DIR = path.join(REPO_ROOT, 'lib', 'mcp', 'tools');
const SIX_WRITE_TOOLS = [
  ['graph_write', 'graph.cjs', { source_id: 'node:a', target_id: 'node:b', edge_type: 'INFORMS' }],
  ['memory_event', 'graph.cjs', { kind: 'k', summary: 's' }],
  ['artifact_file', 'views.cjs', { section: 'problem-definition', name: 'x', content: 'y' }],
  ['claim_write', 'claim.cjs', { knowledge_type: 'fact', text: 'x' }],
  ['claim_verify', 'claim-verify.cjs', { claim_id: 'c' }],
  ['question_set', 'question.cjs', { text: 'q' }],
];
// Start every handler with a getClientVersion that returns `cv` and an `extra`
// argument. Returns [{ tool, promise }].
function startSixHandlers(ctx, cv, extra) {
  return SIX_WRITE_TOOLS.map(([tool, file, args]) => {
    let promise;
    try {
      const h = recordHandlers(path.join(TOOLS_DIR, file), ctx, () => cv);
      promise = typeof h[tool] === 'function'
        ? Promise.resolve().then(() => h[tool](args, extra))
        : Promise.reject(new Error('handler not registered: ' + tool));
    } catch (e) { promise = Promise.reject(e); }
    return { tool, promise };
  });
}
async function settleSix(runs) {
  const out = {};
  for (const r of runs) {
    try {
      const res = await r.promise;
      out[r.tool] = { result: res, payload: toolPayload({ result: res }) };
    } catch (e) {
      out[r.tool] = { error: e };
    }
  }
  return out;
}
const refusalRunsA8 = startSixHandlers({ surface: 'cli' }, undefined, {});

// ---------------------------------------------------------------------------
// PART A9 -- quick 261026-s8c item 5 (D-01): readClientIdentity reads the
// client identity from getClientVersion() first and from the request envelope
// second, so a 2026-era connection (getClientVersion() null) is still judged
// by the name it sends.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- A9: client identity from the request envelope (2026 era) --\n');
const ENVELOPE_KEY = 'io.modelcontextprotocol/clientInfo';
const envelopeExtra = (info) => ({ mcpReq: { envelope: { [ENVELOPE_KEY]: info } } });
const CLAUDE_CODE_EXTRA = envelopeExtra({ name: 'Claude Code', version: '2.1.310' });
{
  const sd = require(path.join(REPO_ROOT, 'lib', 'mcp', 'surface-detect.cjs'));
  const readClientIdentity = sd.readClientIdentity;
  check('readClientIdentity and CLIENT_INFO_META_KEY are exported',
    typeof readClientIdentity === 'function' && sd.CLIENT_INFO_META_KEY === ENVELOPE_KEY);
  if (typeof readClientIdentity === 'function') {
    const inner = (cv) => ({ getClientVersion: () => cv });
    const wrap = (cv) => ({ server: inner(cv) });
    let r = readClientIdentity(inner({ name: 'Cursor', version: '1' }), undefined);
    check('inner Server with getClientVersion -> source client_version', r.source === 'client_version' && r.clientVersion.name === 'Cursor');
    r = readClientIdentity(wrap({ name: 'Cursor', version: '1' }), undefined);
    check('McpServer (has .server) is unwrapped -> source client_version', r.source === 'client_version' && r.clientVersion.name === 'Cursor');
    r = readClientIdentity(wrap(null), CLAUDE_CODE_EXTRA);
    check('getClientVersion null + envelope -> source envelope with name and version',
      r.source === 'envelope' && r.clientVersion.name === 'Claude Code' && r.clientVersion.version === '2.1.310');
    r = readClientIdentity(wrap({ name: 'Cursor', version: '1' }), CLAUDE_CODE_EXTRA);
    check('getClientVersion populated and envelope different -> getClientVersion wins',
      r.source === 'client_version' && r.clientVersion.name === 'Cursor');
    r = readClientIdentity({ getClientVersion: () => { throw new Error('boom'); } }, CLAUDE_CODE_EXTRA);
    check('a throwing getClientVersion falls through to the envelope', r.source === 'envelope' && r.clientVersion.name === 'Claude Code');
    r = readClientIdentity(wrap(null), {});
    check('both missing -> { undefined, none }', r.source === 'none' && r.clientVersion === undefined);
    [[], 'str', 42, { name: 42 }, { name: '' }, null].forEach((bad, i) => {
      const rr = readClientIdentity(wrap(null), envelopeExtra(bad));
      check('malformed envelope #' + i + ' -> none', rr.source === 'none' && rr.clientVersion === undefined);
    });
    [undefined, null, 'x', 5, {}].forEach((badServer, i) => {
      let rr; let threw = false;
      try { rr = readClientIdentity(badServer, CLAUDE_CODE_EXTRA); } catch (_e) { threw = true; }
      check('readClientIdentity(junk server #' + i + ') never throws', !threw && !!rr && typeof rr.source === 'string');
    });
    r = readClientIdentity(wrap(null), envelopeExtra({ name: 'Claude Code', version: 'v'.repeat(500), title: 'LEAK', icons: [1], x: { y: 1 } }));
    check('only name and version are copied; each cut to 256 characters',
      r.source === 'envelope' && Object.keys(r.clientVersion).sort().join(',') === 'name,version' && r.clientVersion.version.length === 256);
    r = readClientIdentity(wrap(null), envelopeExtra({ name: 'Claude Code', version: 7 }));
    check('a non-string version is dropped', r.source === 'envelope' && r.clientVersion.name === 'Claude Code' && r.clientVersion.version === undefined);

    // Modeled 2026 era end to end through the gate.
    const modeled = readClientIdentity(wrap(null), CLAUDE_CODE_EXTRA).clientVersion;
    check('modeled 2026 era: Claude Code envelope -> host claude-code', detectHostTier(modeled).host === 'claude-code');
    check('modeled 2026 era: flag unset -> write path ON',
      withFlag(null, () => isWritePathEnabled({ surface: 'cli', clientVersion: modeled })) === true);
    const none = readClientIdentity(wrap(null), {}).clientVersion;
    check('both sources missing -> write path OFF', withFlag(null, () => isWritePathEnabled({ surface: 'cli', clientVersion: none })) === false);
    const novelEnv = readClientIdentity(wrap(null), envelopeExtra({ name: 'SomeNewClientNeverSeenBefore' })).clientVersion;
    check('unrecognized envelope name -> host unknown and write path OFF',
      detectHostTier(novelEnv).host === 'unknown' && withFlag(null, () => isWritePathEnabled({ surface: 'cli', clientVersion: novelEnv })) === false);
    const { writePathOffHint: offHint } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'mcp-first-flag.cjs'));
    check('both missing -> the hint says host=unknown', offHint({ surface: 'cli', clientVersion: none }).indexOf('host=unknown') !== -1);
  }

  // The refusal functions take the handler's second argument.
  const graphMod = require(path.join(TOOLS_DIR, 'graph.cjs'));
  const claimMod = require(path.join(TOOLS_DIR, 'claim.cjs'));
  const fakeNullServer = { server: { getClientVersion: () => null } };
  [['graph.cjs', graphMod], ['claim.cjs', claimMod]].forEach(([label, m]) => {
    const refuse = m._internal && m._internal.writePathRefusal;
    check(label + ' exports writePathRefusal', typeof refuse === 'function');
    if (typeof refuse === 'function') {
      withFlag(null, () => {
        check(label + ' writePathRefusal(server, ctx, extra) with the Claude Code envelope -> null (allowed)',
          refuse(fakeNullServer, { surface: 'cli' }, CLAUDE_CODE_EXTRA) === null);
        check(label + ' writePathRefusal(server, ctx, {}) with no envelope -> a refusal',
          refuse(fakeNullServer, { surface: 'cli' }, {}) !== null);
      });
    }
  });
  const { hostBlock } = require(path.join(TOOLS_DIR, 'claim-verify.cjs'));
  withFlag(null, () => {
    const hb = hostBlock(fakeNullServer, { surface: 'cli' }, CLAUDE_CODE_EXTRA);
    check('hostBlock(server, ctx, extra) with the Claude Code envelope -> host claude-code, write_path_enabled true',
      hb.host === 'claude-code' && hb.write_path_enabled === true && hb.client_name === 'Claude Code');
    const hb0 = hostBlock(fakeNullServer, { surface: 'cli' }, {});
    check('hostBlock with no envelope -> host unknown, write_path_enabled false, client_name null',
      hb0.host === 'unknown' && hb0.write_path_enabled === false && hb0.client_name === null);
  });

  // Static: the six modules no longer call getClientVersion directly, and every
  // identity read passes the handler's second argument.
  ['views.cjs', 'graph.cjs', 'claim.cjs', 'claim-verify.cjs', 'question.cjs', 'status.cjs'].forEach((f) => {
    const src = require('node:fs').readFileSync(path.join(TOOLS_DIR, f), 'utf8');
    const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    check(f + ' does not call getClientVersion directly', code.indexOf('getClientVersion') === -1);
  });
  ['claim-verify.cjs', 'question.cjs'].forEach((f) => {
    const src = require('node:fs').readFileSync(path.join(TOOLS_DIR, f), 'utf8');
    const calls = src.match(/hostBlock\(server, ctx[^)]*\)/g) || [];
    check(f + ': every hostBlock call site passes extra (' + calls.join(' | ') + ')',
      calls.length > 0 && calls.filter((c) => c.indexOf('hostBlock(server, ctx, extra)') !== 0).length === 0);
  });
}

// The six write handlers, called through register() with the identity only in
// the envelope. The env is hermetic (temp HOME and room) so a handler that
// passes the gate cannot touch a real room.
async function runSixHermetic(cv, extra) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-s8c-six-'));
  const keys = ['HOME', 'MINDRIAN_ROOM', 'CLAUDE_ACTIVE_ROOM', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_MCP_FIRST'];
  const saved = {};
  keys.forEach((k) => { saved[k] = process.env[k]; });
  try {
    process.env.HOME = tmp;
    process.env.MINDRIAN_ROOMS_HOME = path.join(tmp, 'rooms');
    process.env.MINDRIAN_ROOM = path.join(tmp, 'room');
    process.env.CLAUDE_ACTIVE_ROOM = path.join(tmp, 'room');
    delete process.env.MINDRIAN_MCP_FIRST;
    fs.mkdirSync(process.env.MINDRIAN_ROOM, { recursive: true });
    return await settleSix(startSixHandlers({ surface: 'cli', fallbackRoomDir: process.env.MINDRIAN_ROOM }, cv, extra));
  } finally {
    keys.forEach((k) => { if (typeof saved[k] === 'string') process.env[k] = saved[k]; else delete process.env[k]; });
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

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
 * @param {object} [envOverrides] - extra child env; a null value deletes the key
 * @returns {Promise<{ok: boolean, reason?: string, responses?: object}>}
 */
function driveServer(clientName, mcpFirst, envOverrides) {
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
    if (envOverrides && typeof envOverrides === 'object') {
      Object.keys(envOverrides).forEach((k) => {
        if (envOverrides[k] === null) delete env[k]; else env[k] = envOverrides[k];
      });
    }

    const proc = cp.spawn('node', [SERVER], {
      cwd: tmpHome,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    const responses = {};
    let stdoutBuf = '';
    let stderrBuf = '';
    let badStdout = 0;
    let settled = false;

    function finish(payload) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { proc.kill('SIGKILL'); } catch (_e) { /* already gone */ }
      try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
      if (payload && payload.ok === true) {
        payload.stderr = stderrBuf;
        payload.badStdout = badStdout;
      }
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
        try { obj = JSON.parse(line); } catch (_e) { badStdout += 1; continue; }
        if (!obj || obj.jsonrpc !== '2.0') badStdout += 1;
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

/**
 * List the tool names and resource uris of a real server (D-03 MCP App diff).
 * Same hermetic HOME and room as driveServer. A null value in envOverrides
 * deletes the key.
 */
function listCatalog(envOverrides) {
  return new Promise((resolve) => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-s8c-catalog-'));
    const room = path.join(tmpHome, 'room');
    fs.mkdirSync(room, { recursive: true });
    const env = Object.assign({}, process.env, {
      HOME: tmpHome,
      MINDRIAN_ROOM: room,
      MINDRIAN_ROOMS_HOME: path.join(tmpHome, 'MindrianRooms'),
      CLAUDE_ACTIVE_ROOM: room,
    });
    delete env.MINDRIAN_MCP_FIRST;
    delete env.MINDRIAN_BRAIN_KEY;
    Object.keys(envOverrides || {}).forEach((k) => {
      if (envOverrides[k] === null) delete env[k]; else env[k] = envOverrides[k];
    });
    const proc = cp.spawn('node', [SERVER], { cwd: tmpHome, stdio: ['pipe', 'pipe', 'pipe'], env });
    const out = { tools: [], resources: [] };
    let buf = '';
    let settled = false;
    function finish(payload) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { proc.kill('SIGKILL'); } catch (_e) { /* gone */ }
      try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
      resolve(payload);
    }
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), TIMEOUT_MS);
    function send(obj) { try { proc.stdin.write(JSON.stringify(obj) + '\n'); } catch (_e) { /* exit handler */ } }
    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let obj;
        try { obj = JSON.parse(line); } catch (_e) { continue; }
        if (!obj || obj.id === undefined || obj.id === null) continue;
        if (obj.id === 1) {
          send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
          send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
        } else if (obj.id === 2) {
          out.tools = ((obj.result && obj.result.tools) || []).map((t) => t.name);
          send({ jsonrpc: '2.0', id: 3, method: 'resources/list', params: {} });
        } else if (obj.id === 3) {
          out.resources = ((obj.result && obj.result.resources) || []).map((r) => r.uri);
          finish({ ok: true, tools: out.tools, resources: out.resources });
        }
      }
    });
    proc.on('error', (err) => finish({ ok: false, reason: 'spawn_error', message: err.message }));
    proc.on('exit', (code) => finish({ ok: false, reason: 'exited_before_completion', code }));
    send({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'SomeNewClientNeverSeenBefore', version: '1.0.0' } },
    });
  });
}

/**
 * Drive the real server with the SDK Client in the 2026 era (versionNegotiation
 * auto: server/discover, no initialize). One status_read call, then close.
 * Same hermetic HOME and room as driveServer. Returns the status payload and
 * the full stderr text.
 */
async function driveModern(clientName, envOverrides, opts) {
  const { Client } = require('@modelcontextprotocol/client');
  const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-s8c-modern-'));
  const room = path.join(tmpHome, 'room');
  fs.mkdirSync(room, { recursive: true });
  try {
    const boot = roomDb.openRoomDb(room);
    roomDb.closeRoomDb(boot);
  } catch (_e) { /* the drive still runs */ }
  const env = Object.assign({}, process.env, {
    HOME: tmpHome,
    MINDRIAN_ROOM: room,
    MINDRIAN_ROOMS_HOME: path.join(tmpHome, 'MindrianRooms'),
    CLAUDE_ACTIVE_ROOM: room,
  });
  delete env.MINDRIAN_MCP_FIRST;
  delete env.MINDRIAN_BRAIN_KEY;
  Object.keys(envOverrides || {}).forEach((k) => {
    if (envOverrides[k] === null) delete env[k]; else env[k] = envOverrides[k];
  });
  let stderrText = '';
  let writePayload = null;
  let client = null;
  let transport = null;
  try {
    transport = new StdioClientTransport({ command: 'node', args: [SERVER], env, cwd: tmpHome, stderr: 'pipe' });
    if (transport.stderr) transport.stderr.on('data', (d) => { stderrText += d.toString('utf8'); });
    client = new Client({ name: clientName, version: '2.1.310' }, { versionNegotiation: { mode: 'auto' } });
    const result = await Promise.race([
      (async () => {
        await client.connect(transport);
        const r = await client.callTool({ name: 'status_read', arguments: {} });
        const statusPayload = JSON.parse(r.content[0].text);
        if (opts && opts.write) {
          const w = await client.callTool({
            name: 'graph_write',
            arguments: {
              source_id: 'node:host-tier-a',
              target_id: 'node:host-tier-b',
              edge_type: 'INFORMS',
              properties: { note: 'quick 261026-s8c 2026-era drive' },
            },
          });
          writePayload = JSON.parse(w.content[0].text);
        }
        return statusPayload;
      })(),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
    ]);
    return { ok: true, status: result, write: writePayload, stderr: stderrText };
  } catch (e) {
    return { ok: false, reason: e && e.message, stderr: stderrText };
  } finally {
    try { await client.close(); } catch (_e) { /* best effort */ }
    if (transport && typeof transport.pid === 'number') {
      try { process.kill(transport.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
    }
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

function identityLines(text) {
  return String(text || '').split('\n').filter((l) => l.indexOf('[mindrian-os] client identity:') === 0);
}

(async function livePart() {
  // A8 (async part): the six refusing handlers carry the shared hint.
  process.stdout.write('\n-- A8 (handlers): six write handlers refuse with the shared hint --\n');
  const a8 = await settleSix(refusalRunsA8);
  SIX_WRITE_TOOLS.forEach(([tool]) => {
    const r = a8[tool];
    const pl = r && r.payload;
    check(tool + ' refuses with reason write_path_disabled' + (r && r.error ? ' [' + r.error.message + ']' : ''),
      !!pl && pl.reason === 'write_path_disabled');
    check(tool + ' hint names surface=cli and MINDRIAN_MCP_FIRST=cli',
      !!pl && typeof pl.hint === 'string' && pl.hint.indexOf('surface=cli') !== -1 && pl.hint.indexOf('MINDRIAN_MCP_FIRST=cli') !== -1);
  });
  ['claim_verify', 'question_set'].forEach((tool) => {
    const pl = a8[tool] && a8[tool].payload;
    check(tool + ' payload keeps the host block keys',
      !!pl && !!pl.host && ['client_name', 'host', 'host_tier', 'write_path_enabled'].every((k) => Object.prototype.hasOwnProperty.call(pl.host, k)));
  });

  // A9 (handlers): the identity only in the envelope.
  process.stdout.write('\n-- A9 (handlers): six write handlers, getClientVersion null, identity in the envelope --\n');
  const withEnv = await runSixHermetic(null, CLAUDE_CODE_EXTRA);
  const withoutEnv = await runSixHermetic(null, {});
  SIX_WRITE_TOOLS.forEach(([tool]) => {
    const a = withEnv[tool];
    const b = withoutEnv[tool];
    check(tool + ' with the Claude Code envelope: no write_path_disabled and no throw' + (a && a.error ? ' [' + a.error.message + ']' : ''),
      !!a && !a.error && !(a.payload && a.payload.reason === 'write_path_disabled'));
    check(tool + ' with no envelope: write_path_disabled',
      !!b && !b.error && !!b.payload && b.payload.reason === 'write_path_disabled');
  });

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

  // B7. quick 261026-s8c item 2: the identity line on a real connection, in
  // both handshake eras.
  process.stdout.write('\n-- B7: client identity line on a real connection (legacy and 2026 era) --\n');
  const legacyLines = identityLines(foreign.stderr);
  process.stdout.write('  OBSERVED legacy identity line: ' + JSON.stringify(legacyLines) + '\n');
  check('legacy drive: exactly 1 identity line', legacyLines.length === 1);
  check('legacy drive: via=initialize, source=client_version, with the client name',
    legacyLines.length === 1 && legacyLines[0] ===
      '[mindrian-os] client identity: name="test-cursor-sim" version="1.0.0" via=initialize source=client_version');
  check('legacy drive: every non-empty stdout line is JSON-RPC 2.0', foreign.badStdout === 0);
  const modern = await driveModern('Claude Code');
  check('2026-era drive completed' + (modern.ok ? '' : ' [' + modern.reason + ']'), modern.ok === true);
  const modernLines = identityLines(modern.stderr);
  process.stdout.write('  OBSERVED 2026-era identity line: ' + JSON.stringify(modernLines) + '\n');
  check('2026-era drive: exactly 1 identity line', modernLines.length === 1);
  check('2026-era drive: via=status_read, source=envelope, with the client name',
    modernLines.length === 1 && modernLines[0] ===
      '[mindrian-os] client identity: name="Claude Code" version="2.1.310" via=status_read source=envelope');

  // B8. quick 261026-s8c item 5 (D-01): the 2026-era connection, where
  // getClientVersion() is null and the identity is only in the envelope.
  process.stdout.write('\n-- B8: 2026-era drive, identity from the request envelope --\n');
  const m1 = await driveModern('Claude Code', undefined, { write: true });
  const m2 = await driveModern('SomeNewClientNeverSeenBefore', undefined, { write: true });
  check('B8 Claude Code drive completed' + (m1.ok ? '' : ' [' + m1.reason + ']'), m1.ok === true);
  check('B8 unrecognized-client drive completed' + (m2.ok ? '' : ' [' + m2.reason + ']'), m2.ok === true);
  if (m1.ok && m2.ok) {
    const f1 = m1.status.segments.capability_floor;
    const f2 = m2.status.segments.capability_floor;
    check('B8 Claude Code: capability_floor host claude-code, tier1', f1.host_tier.host === 'claude-code' && f1.host_tier.hostTier === 'tier1');
    check('B8 Claude Code: write_path_enabled true with MINDRIAN_MCP_FIRST unset', f1.write_path_enabled === true);
    check('B8 Claude Code: graph_write ok true against the real write path' +
      (m1.write && !m1.write.ok ? ' [got reason: ' + m1.write.reason + ']' : ''), !!m1.write && m1.write.ok === true);
    check('B8 unrecognized client: host unknown and write_path_enabled false', f2.host_tier.host === 'unknown' && f2.write_path_enabled === false);
    check('B8 unrecognized client: graph_write refused with write_path_disabled',
      !!m2.write && m2.write.ok === false && m2.write.reason === 'write_path_disabled');
    check('B8 unrecognized client: the hint contains host=unknown',
      !!m2.write && typeof m2.write.hint === 'string' && m2.write.hint.indexOf('host=unknown') !== -1);
  }

  // B6. quick 261026-s8c item 1: the real server, no MINDRIAN_TRANSPORT and no
  // CLAUDE_SURFACE, ENTRYPOINT=cli. Uses an unrecognized client so only the
  // surface and the flag decide the write path.
  process.stdout.write('\n-- B6: CLAUDE_CODE_ENTRYPOINT=cli on the real server (quick 261026-s8c item 1) --\n');
  if (fs.existsSync('/sessions')) {
    process.stdout.write('  SKIP - B6 needs a machine without /sessions (Cowork indicator), found /sessions\n');
  } else {
    const CLI_ENV = { MINDRIAN_TRANSPORT: null, CLAUDE_SURFACE: null, CLAUDE_CODE_ENTRYPOINT: 'cli', COWORK_SESSION_ID: null };
    const cliOn = await driveServer('SomeNewClientNeverSeenBefore', 'cli', CLI_ENV);
    const cliOff = await driveServer('SomeNewClientNeverSeenBefore', undefined, CLI_ENV);
    const cliDesktop = await driveServer('SomeNewClientNeverSeenBefore', 'cli',
      Object.assign({}, CLI_ENV, { CLAUDE_SURFACE: 'desktop' }));
    [['entrypoint cli + flag cli', cliOn], ['entrypoint cli + flag unset', cliOff],
      ['entrypoint cli + CLAUDE_SURFACE=desktop + flag cli', cliDesktop]].forEach(([label, run]) => {
      check('B6 drive completed: ' + label + (run.ok ? '' : ' [' + run.reason + ' ' + (run.stderr || run.message || '') + ']'),
        run.ok === true);
    });
    if (cliOn.ok && cliOff.ok && cliDesktop.ok) {
      const onFloor = (toolPayload(cliOn.responses[4]) || {}).segments;
      const offFloor = (toolPayload(cliOff.responses[4]) || {}).segments;
      const deskFloor = (toolPayload(cliDesktop.responses[4]) || {}).segments;
      const onCf = onFloor && onFloor.capability_floor;
      const offCf = offFloor && offFloor.capability_floor;
      const deskCf = deskFloor && deskFloor.capability_floor;
      check('B6 flag cli: capability_floor surface is cli', !!onCf && onCf.surface === 'cli');
      check('B6 flag cli: write_path_enabled true', !!onCf && onCf.write_path_enabled === true);
      const onWrite = toolPayload(cliOn.responses[3]);
      check('B6 flag cli: graph_write is not refused with write_path_disabled',
        onWrite !== null && onWrite.reason !== 'write_path_disabled');
      check('B6 flag unset: capability_floor surface is cli', !!offCf && offCf.surface === 'cli');
      check('B6 flag unset: write_path_enabled false', !!offCf && offCf.write_path_enabled === false);
      const offWrite = toolPayload(cliOff.responses[3]);
      check('B6 flag unset: graph_write refused with write_path_disabled',
        offWrite !== null && offWrite.ok === false && offWrite.reason === 'write_path_disabled');
      check('B6 flag unset: the live refusal hint names surface=cli and MINDRIAN_MCP_FIRST=cli',
        offWrite !== null && typeof offWrite.hint === 'string' &&
        offWrite.hint.indexOf('surface=cli') !== -1 && offWrite.hint.indexOf('MINDRIAN_MCP_FIRST=cli') !== -1);
      check('B6 CLAUDE_SURFACE=desktop wins over ENTRYPOINT=cli: surface desktop', !!deskCf && deskCf.surface === 'desktop');
      check('B6 CLAUDE_SURFACE=desktop + flag cli (names cli only): write_path_enabled false',
        !!deskCf && deskCf.write_path_enabled === false);
    }

    // D-03: the MCP App views that stop registering on surface cli.
    const catCli = await listCatalog(CLI_ENV);
    const catDesktop = await listCatalog(Object.assign({}, CLI_ENV, { CLAUDE_SURFACE: 'desktop' }));
    check('MCP-APP-DIFF: cli catalog listing completed', catCli.ok === true);
    check('MCP-APP-DIFF: desktop catalog listing completed', catDesktop.ok === true);
    if (catCli.ok && catDesktop.ok) {
      const ACCEPTED = ['room-dashboard', 'room-wiki', 'room-graph',
        'ui://mindrian-os/room-dashboard', 'ui://mindrian-os/room-wiki', 'ui://mindrian-os/room-graph'];
      const cliSet = new Set(catCli.tools.concat(catCli.resources));
      const deskSet = new Set(catDesktop.tools.concat(catDesktop.resources));
      const onlyCli = Array.from(cliSet).filter((n) => !deskSet.has(n)).sort();
      const onlyDesktop = Array.from(deskSet).filter((n) => !cliSet.has(n)).sort();
      process.stdout.write('  MCP-APP-DIFF onlyDesktop (stop registering on cli): ' + JSON.stringify(onlyDesktop) + '\n');
      process.stdout.write('  MCP-APP-DIFF onlyCli: ' + JSON.stringify(onlyCli) + '\n');
      check('MCP-APP-DIFF: the cli catalog is a subset of the desktop catalog (onlyCli is empty)', onlyCli.length === 0);
      const unaccepted = onlyDesktop.filter((n) => ACCEPTED.indexOf(n) === -1);
      check('MCP-APP-DIFF: every view lost on cli is one of the six accepted names' +
        (unaccepted.length ? ' [UNACCEPTED LOSS: ' + JSON.stringify(unaccepted) + ']' : ''), unaccepted.length === 0);
    }
  }

  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
