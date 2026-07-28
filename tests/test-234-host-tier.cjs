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

// Claude Code keeps its byte-identical legacy default: the flag is the only
// thing that turns the MCP write path on there, because slash commands and
// hooks already do the writing.
check("flag unset + claude-code -> write path OFF (legacy default preserved)",
  withFlag(null, () => isWritePathEnabled({ surface: 'cli', clientVersion: { name: 'claude-code' } })) === false);

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
check("MINDRIAN_MCP_FIRST=cli + claude-code on DESKTOP -> OFF (flag is per-surface, unchanged)",
  withFlag('cli', () => isWritePathEnabled({ surface: 'desktop', clientVersion: { name: 'claude-code' } })) === false);

// Defensive default: malformed input never flips a capability ON.
[undefined, null, {}, { surface: 42 }, 'nonsense'].forEach((bad, i) => {
  let threw = false;
  let out = null;
  try { out = withFlag(null, () => isWritePathEnabled(bad)); } catch (_e) { threw = true; }
  check('isWritePathEnabled(malformed #' + i + ') never throws and never enables', !threw && out === false);
});

process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
