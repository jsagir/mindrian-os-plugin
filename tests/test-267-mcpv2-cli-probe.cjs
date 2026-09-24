#!/usr/bin/env node
'use strict';

/*
 * Phase 267 Plan 04 (MCPV2-13) -- opt-in LIVE Claude Code CLI probe.
 * =============================================================================
 * Wraps this repo's local server AND the brain stdio shim, each in turn, in
 * tests/helpers/mcp-stdio-tee.cjs, and drives one real `claude -p` turn
 * against each so the exact opening handshake Claude Code sends over stdio
 * is RECORDED, not assumed. This is a live, host-dependent, opt-in probe:
 *
 *   SKIP (exit 77) unless MOS_267_LIVE_CLI_PROBE=1 AND `claude --version`
 *   succeeds. Never part of the default test run.
 *
 * The probe RECORDS behavior; it never asserts a particular era, because
 * host behavior changes week to week (267-RESEARCH.md: Claude Code 2.1.238
 * stopped probing stdio with server/discover; 2.1.280 declares
 * elicitation:{}). PASS means an opening record was captured for each
 * server; a missing record is reported as an ENV GAP with the exact reason,
 * never fabricated.
 *
 * The brain shim leg points MINDRIAN_BRAIN_URL at an unreachable loopback
 * (Canon Part 8: no real Brain egress from a test, live or otherwise).
 *
 * No em-dashes. CJS, Node built-ins only.
 */

const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEE = path.join(REPO_ROOT, 'tests', 'helpers', 'mcp-stdio-tee.cjs');
const LOCAL_SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const BRAIN_SHIM = path.join(REPO_ROOT, 'bin', 'mindrian-brain-mcp-client.cjs');
const CLAUDE_TIMEOUT_MS = 120000;

function claudeVersionOrNull() {
  try {
    const out = cp.execFileSync('claude', ['--version'], { encoding: 'utf8', timeout: 15000 });
    return out.trim();
  } catch (_e) {
    return null;
  }
}

function makeFixtureRoom(tag) {
  const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-cli-probe-267-rooms-' + tag + '-'));
  const roomDir = path.join(roomsHome, 'room-267-probe');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '# room-267-probe\n\nFixture room for tests/test-267-mcpv2-cli-probe.cjs. Synthetic, no real content.\n'
  );
  return { roomsHome, roomDir };
}

function writeMcpConfig(configPath, serverName, entryPath, env) {
  const config = {
    mcpServers: {
      [serverName]: {
        command: 'node',
        args: [TEE, 'node', entryPath],
        env,
      },
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function readRecords(logPath) {
  if (!fs.existsSync(logPath)) return [];
  return fs
    .readFileSync(logPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch (_e) {
        return null;
      }
    })
    .filter(Boolean);
}

function runClaudeProbe(tag, serverName, entryPath, extraEnv) {
  const { roomsHome, roomDir } = makeFixtureRoom(tag);
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-cli-probe-267-log-' + tag + '-'));
  const logPath = path.join(logDir, 'tee.jsonl');
  const configPath = path.join(logDir, 'mcp-config.json');
  const env = Object.assign(
    { MOS_TEE_LOG: logPath, MINDRIAN_ROOMS_HOME: roomsHome, MINDRIAN_ROOM: roomDir },
    extraEnv || {}
  );
  writeMcpConfig(configPath, serverName, entryPath, env);

  let claudeErr = '';
  let claudeExit = null;
  try {
    const res = cp.spawnSync(
      'claude',
      ['-p', 'Reply with the single word ok.', '--mcp-config', configPath, '--strict-mcp-config'],
      { cwd: REPO_ROOT, encoding: 'utf8', timeout: CLAUDE_TIMEOUT_MS }
    );
    claudeErr = res.stderr || '';
    claudeExit = res.status;
  } catch (e) {
    claudeErr = (e && e.message) || String(e);
  }

  const records = readRecords(logPath);
  const opening = records.find((r) => r.dir === 'c2s' && (r.method === 'initialize' || r.method === 'server/discover'));
  const sawServerDiscover = records.some((r) => r.method === 'server/discover');

  const cleanup = () => {
    try {
      fs.rmSync(roomsHome, { recursive: true, force: true });
    } catch (_e) {
      /* best effort */
    }
    try {
      fs.rmSync(logDir, { recursive: true, force: true });
    } catch (_e) {
      /* best effort */
    }
  };

  return { serverName, records, opening, sawServerDiscover, claudeErr, claudeExit, cleanup };
}

function reportResult(result) {
  if (!result.opening) {
    console.log('  ENV GAP: no opening record captured (claude exit=' + result.claudeExit + ')');
    console.log('  claude stderr tail: ' + result.claudeErr.slice(-600));
    return;
  }
  console.log('  method: ' + result.opening.method);
  console.log('  protocolVersion: ' + result.opening.protocolVersion);
  console.log('  capabilityKeys: ' + JSON.stringify(result.opening.capabilityKeys));
  console.log('  elicitation declared: ' + (Array.isArray(result.opening.capabilityKeys) && result.opening.capabilityKeys.includes('elicitation')));
  console.log('  server/discover seen: ' + result.sawServerDiscover);
}

function main() {
  const liveFlag = process.env.MOS_267_LIVE_CLI_PROBE === '1';
  const version = claudeVersionOrNull();
  if (!liveFlag || !version) {
    console.log(
      'test-267-mcpv2-cli-probe: SKIP (MOS_267_LIVE_CLI_PROBE=' +
        process.env.MOS_267_LIVE_CLI_PROBE +
        ', claude --version=' +
        version +
        ')'
    );
    process.exit(77);
  }

  console.log('claude --version: ' + version);

  let localResult = null;
  let brainResult = null;
  try {
    console.log('');
    console.log('-- local server (mindrian-os-tee) --');
    localResult = runClaudeProbe('local', 'mindrian-os-tee', LOCAL_SERVER, {});
    reportResult(localResult);

    console.log('');
    console.log('-- brain shim (mindrian-brain-tee) --');
    brainResult = runClaudeProbe('brain', 'mindrian-brain-tee', BRAIN_SHIM, {
      MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    });
    reportResult(brainResult);

    const localOk = !!localResult.opening;
    const brainOk = !!brainResult.opening;
    console.log('');
    console.log('local server opening record present: ' + localOk);
    console.log('brain shim opening record present: ' + brainOk);
    process.exitCode = localOk && brainOk ? 0 : 1;
  } finally {
    if (localResult) localResult.cleanup();
    if (brainResult) brainResult.cleanup();
  }
}

main();
