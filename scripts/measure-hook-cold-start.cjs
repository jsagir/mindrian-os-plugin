#!/usr/bin/env node
'use strict';
/**
 * scripts/measure-hook-cold-start.cjs  (Phase 369, plan 03, D-17 / TS369-05)
 *
 * Measures the cold-start latency of every command in hooks/hooks.json against
 * its declared timeout, BEFORE any hook is allowed to move (D-17: hooks stay
 * .cjs; a future move re-runs this script).
 *
 * What it does, in plain words: for each hook command it spawns the real
 * command n times inside a throwaway sandbox (throwaway HOME, rooms home, room
 * dir and cwd; Brain URL pointed at an unreachable loopback port; no session
 * id) feeding the representative stdin payload for that hook's
 * event, and records p50 / p95 / max wall time. Before the first spawn and after
 * the last it records `git status --short` of the checkout; any difference is
 * printed and exits 1 (a hook wrote into the shared tree). `--tree-check report`
 * prints the difference but does not fail, for a tree other sessions are editing
 * (a peer edit is indistinguishable from a hook write by status alone; the listed
 * paths let the reader judge).
 *
 * Percentile definition: samples sorted ascending; p50 = element at index
 * floor(0.50 * (n - 1)); p95 = element at index floor(0.95 * (n - 1)). At the
 * default n = 10 the p95 is therefore the second-largest sample; the report
 * records n so a reader knows how coarse the tail is.
 *
 * Units note: hooks.json declares most timeouts as 1500..120000 (treated here as
 * milliseconds, the unit the spike 003 budget uses). One entry (ambient-stop,
 * async) declares `5`; any declared timeout below 100 is read as SECONDS and
 * converted (x 1000), and the entry records `timeout_unit_note`.
 *
 * Usage:
 *   node scripts/measure-hook-cold-start.cjs [--n <count>] [--json] [--out <file>] [--include-heavy]
 *
 * Exports (for the tests): payloadFor, parseHookCommands, makeSandbox, hookEnv,
 * percentile, spawnHook.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOKS_JSON = path.join(REPO_ROOT, 'hooks', 'hooks.json');
const HEAVY_TIMEOUT_MS = 30000; // over 30 s = the network-capable SessionStart npm reconcile class
const GRACE_MS = 1000; // one second past the declared timeout, so a right-at-budget hook is a recorded breach not a cut-off

// ---------------------------------------------------------------------------
// hooks.json parsing
// ---------------------------------------------------------------------------

/**
 * parseHookCommands(hooksJson): flatten hooks.json into one record per command.
 * Accepts the parsed object or a file path. Returns
 * [{event, matcher, command, timeout_ms, declared_timeout, timeout_unit_note, async}].
 */
function parseHookCommands(hooksJson) {
  const doc = typeof hooksJson === 'string' ? JSON.parse(fs.readFileSync(hooksJson, 'utf8')) : hooksJson;
  const out = [];
  const events = (doc && doc.hooks) || {};
  for (const event of Object.keys(events)) {
    for (const group of events[event] || []) {
      for (const h of group.hooks || []) {
        if (h.type !== 'command' || typeof h.command !== 'string') continue;
        const declared = typeof h.timeout === 'number' ? h.timeout : null;
        let timeoutMs = declared;
        let note = null;
        if (declared !== null && declared < 100) {
          timeoutMs = declared * 1000;
          note = 'declared ' + declared + ' read as seconds';
        }
        out.push({
          event,
          matcher: group.matcher || null,
          command: h.command,
          declared_timeout: declared,
          timeout_ms: timeoutMs,
          timeout_unit_note: note,
          async: h.async === true,
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// sandbox, env, payloads
// ---------------------------------------------------------------------------

/**
 * makeSandbox(prefix, opts): one temp root with home, rooms, a fixture room, a cwd and an empty transcript.
 * By default HOME looks like a steady-state install (statusLine block in ~/.claude/settings.json and the
 * statusline onboarding touch-file for this plugin version), because a hook's per-session cold start is what
 * the budgets govern. `opts.fresh: true` leaves HOME bare: that is the one-time first-session-after-install
 * state, in which scripts/sessionstart-coordinator.cjs runs a doctor self-heal (see 369-HOOK-COLD-START.md).
 */
function makeSandbox(prefix, opts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), (prefix || 'mos-hook-sbx-') ));
  const home = path.join(root, 'home');
  const roomsHome = path.join(root, 'rooms');
  const roomDir = path.join(roomsHome, 'room-369');
  const cwd = path.join(root, 'cwd');
  const tmp = path.join(root, 'tmp');
  for (const d of [home, roomDir, cwd, tmp]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# room-369\n\nFixture room for plan 369-03. Synthetic, no real content.\n');
  const transcript = path.join(root, 'transcript.jsonl');
  fs.writeFileSync(transcript, '');
  if (!(opts && opts.fresh)) {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({
      statusLine: { type: 'command', command: 'bash "' + REPO_ROOT + '/scripts/statusline-mos"' },
    }));
    let ver = null;
    try { ver = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version; } catch (_) { ver = null; }
    if (ver) {
      fs.mkdirSync(path.join(home, '.mindrian', 'onboarding'), { recursive: true });
      fs.writeFileSync(path.join(home, '.mindrian', 'onboarding', 'statusline-onboarded.json'),
        JSON.stringify({ installed_version: ver, completed_at: '2026-10-02T00:00:00.000Z' }));
    }
  }
  return {
    root, home, roomsHome, roomDir, cwd, tmp, transcript,
    cleanup() { try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) { /* best effort */ } },
  };
}

/** hookEnv(sandbox, pluginRoot): hermetic env for one spawn. */
function hookEnv(sandbox, pluginRoot, extra) {
  const env = Object.assign({}, process.env);
  for (const k of ['MINDRIAN_MCP_FIRST', 'MINDRIAN_MCP_DAEMON', 'CLAUDE_CODE_SESSION_ID',
    'CLAUDE_ACTIVE_ROOM', 'CLAUDE_PROJECT_DIR']) delete env[k];
  env.HOME = sandbox.home;
  env.USERPROFILE = sandbox.home;
  env.TMPDIR = sandbox.tmp;
  env.MINDRIAN_ROOMS_HOME = sandbox.roomsHome;
  env.MINDRIAN_ROOM = sandbox.roomDir;
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9'; // unreachable loopback, never a real Brain (Canon Part 8)
  env.CLAUDE_PLUGIN_ROOT = pluginRoot;
  env.CLAUDE_PROJECT_DIR = sandbox.cwd;
  return Object.assign(env, extra || {});
}

/**
 * payloadFor(event, sandbox, matcher): representative stdin JSON (as an object) for a hook event.
 * `sandbox` supplies cwd and transcript_path; when omitted, os.tmpdir() and /dev/null stand in.
 */
function payloadFor(event, sandbox, matcher) {
  const cwd = (sandbox && sandbox.cwd) || os.tmpdir();
  const base = {
    session_id: 'sess-369-03-measure',
    transcript_path: (sandbox && sandbox.transcript) || os.devNull,
    cwd,
    hook_event_name: event,
  };
  const brainTool = matcher && /brain/.test(matcher);
  const toolName = brainTool ? 'mcp__mindrian-brain__brain_query' : 'Write';
  const toolInput = brainTool
    ? { query: 'what framework fits an ill-defined problem' } // generic methodology handle only
    : { file_path: path.join(cwd, 'probe.md'), content: 'probe\n' };
  switch (event) {
    case 'SessionStart': return Object.assign(base, { source: 'startup' });
    case 'UserPromptSubmit': return Object.assign(base, { prompt: 'what changed since I was last here?' });
    case 'PreToolUse': return Object.assign(base, { tool_name: toolName, tool_input: toolInput });
    case 'PostToolUse': return Object.assign(base, { tool_name: toolName, tool_input: toolInput, tool_response: { success: true } });
    case 'Stop': return Object.assign(base, { stop_hook_active: false, last_assistant_message: 'ok' });
    case 'SubagentStop': return Object.assign(base, { stop_hook_active: false, agent_id: 'agent-369', agent_type: 'general-purpose' });
    case 'Notification': return Object.assign(base, { message: 'Claude needs your attention', notification_type: 'idle_prompt' });
    case 'SessionEnd': return Object.assign(base, { reason: 'other' });
    case 'PreCompact': return Object.assign(base, { trigger: 'manual', custom_instructions: '' });
    case 'PostCompact': return Object.assign(base, { trigger: 'manual', compact_summary: 'summary' });
    case 'FileChanged': return Object.assign(base, { file_path: path.join(cwd, 'probe.md'), event: 'change' });
    case 'CwdChanged': return Object.assign(base, { old_cwd: cwd, new_cwd: cwd });
    case 'TaskCompleted': return Object.assign(base, { task_id: 'task-369', task_subject: 'probe' });
    default: return base;
  }
}

// ---------------------------------------------------------------------------
// spawning and statistics
// ---------------------------------------------------------------------------

function expandCommand(command, pluginRoot) {
  return command.split('${CLAUDE_PLUGIN_ROOT}').join(pluginRoot);
}

/**
 * spawnHook(entry, sandbox, pluginRoot): run one hook once; resolves
 * {ms, close_ms, status, signal, stderr, stdout, timedOut, pipeHeld}.
 *   ms        wall time to process EXIT (what the hook itself costs)
 *   close_ms  wall time until its stdout/stderr pipes closed (a backgrounded child that
 *             inherits the pipe holds this open past exit; Claude Code reads the pipes)
 * The hook runs in its own process group so any straggler it backgrounded is killed
 * after the run (only processes this call spawned).
 */
function spawnHook(entry, sandbox, pluginRoot, extraEnv) {
  const cmd = expandCommand(entry.command, pluginRoot);
  const limit = (entry.timeout_ms || 5000) + GRACE_MS;
  const stdin = JSON.stringify(payloadFor(entry.event, sandbox, entry.matcher));
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const elapsed = () => Number(process.hrtime.bigint() - t0) / 1e6;
    const child = spawn('bash', ['-c', cmd], {
      cwd: sandbox.cwd,
      env: hookEnv(sandbox, pluginRoot, extraEnv),
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let exitMs = null;
    let status = null;
    let signal = null;
    let timedOut = false;
    let done = false;
    child.stdout.on('data', (d) => { if (stdout.length < 4000) stdout += d; });
    child.stderr.on('data', (d) => { if (stderr.length < 4000) stderr += d; });
    child.on('error', () => { /* spawn failure shows as null status */ });
    child.stdin.on('error', () => { /* hook may exit before reading stdin */ });
    child.stdin.end(stdin);
    const killGroup = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch (_) { /* already gone */ } };
    const timer = setTimeout(() => { timedOut = true; killGroup(); }, limit);
    child.on('exit', (code, sig) => { exitMs = elapsed(); status = code; signal = sig; });
    child.on('close', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const closeMs = elapsed();
      killGroup(); // reap any background straggler this hook left in its own group
      resolve({
        ms: exitMs === null ? closeMs : exitMs,
        close_ms: closeMs,
        status,
        signal: signal || null,
        stderr,
        stdout,
        timedOut,
        pipeHeld: exitMs !== null && closeMs - exitMs > 250,
      });
    });
  });
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.floor(p * (sorted.length - 1))];
}

function round1(x) { return x === null ? null : Math.round(x * 10) / 10; }

function statsOf(samples) {
  const s = samples.slice().sort((a, b) => a - b);
  return {
    p50_ms: round1(percentile(s, 0.5)),
    p95_ms: round1(percentile(s, 0.95)),
    max_ms: round1(s.length ? s[s.length - 1] : null),
  };
}

function gitStatus() {
  const r = spawnSync('git', ['status', '--short'], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

function diffStatus(before, after) {
  const a = new Set((before || '').split('\n').filter(Boolean));
  const b = new Set((after || '').split('\n').filter(Boolean));
  const added = [...b].filter((x) => !a.has(x));
  const removed = [...a].filter((x) => !b.has(x));
  return { added, removed };
}

async function measureNodeBaseline(n, sandbox) {
  const samples = [];
  const entry = { event: 'UserPromptSubmit', matcher: null, command: JSON.stringify(process.execPath) + ' -e 0', timeout_ms: 5000 };
  for (let i = 0; i < n; i += 1) {
    const r = await spawnHook(entry, sandbox, REPO_ROOT);
    samples.push(r.ms);
  }
  return statsOf(samples);
}

// ---------------------------------------------------------------------------
// the measurement run
// ---------------------------------------------------------------------------

async function measureAll(opts) {
  const n = opts.n;
  const entries = parseHookCommands(HOOKS_JSON);
  const sandbox = makeSandbox('mos-hook-measure-');
  const before = gitStatus();
  const results = [];
  let nodeBaseline = null;
  let firstSessionProbe = null;
  try {
    nodeBaseline = await measureNodeBaseline(Math.max(n, 3), sandbox);
    for (const e of entries) {
      const rec = {
        event: e.event,
        matcher: e.matcher,
        command: e.command,
        timeout_ms: e.timeout_ms,
        async: e.async,
      };
      if (e.timeout_unit_note) rec.timeout_unit_note = e.timeout_unit_note;
      if (e.timeout_ms > HEAVY_TIMEOUT_MS && !opts.includeHeavy) {
        rec.not_measured = 'budget over 30 s, network-capable';
        results.push(rec);
        continue;
      }
      const samples = [];
      const closeSamples = [];
      const exitCodes = new Set();
      let breaches = 0;
      let pipeHeld = 0;
      let closeBreaches = 0;
      for (let i = 0; i < n; i += 1) {
        const r = await spawnHook(e, sandbox, REPO_ROOT);
        samples.push(r.ms);
        closeSamples.push(r.close_ms);
        exitCodes.add(r.signal ? 'signal:' + r.signal : r.status);
        if (r.ms > e.timeout_ms) breaches += 1; // exit time over the declared budget (a hook killed before exiting counts: its ms is the kill time)
        if (r.close_ms > e.timeout_ms) closeBreaches += 1;
        if (r.pipeHeld) pipeHeld += 1;
      }
      const cs = statsOf(closeSamples);
      Object.assign(rec, statsOf(samples), {
        exit_codes: [...exitCodes],
        timeout_breaches: breaches,
        pipe_held_after_exit: pipeHeld,
        close_breaches: closeBreaches,
        close_p95_ms: cs.p95_ms,
        close_max_ms: cs.max_ms,
      });
      results.push(rec);
    }
    // One-time first-session-after-install state (bare HOME): the coordinator runs a doctor self-heal.
    const coord = entries.find((e) => /sessionstart-coordinator/.test(e.command));
    if (coord) {
      const fresh = makeSandbox('mos-hook-fresh-', { fresh: true });
      try {
        const r = await spawnHook(coord, fresh, REPO_ROOT);
        firstSessionProbe = {
          command: coord.command,
          note: 'bare HOME (no statusLine block, no onboarding touch-file): the one-time first-session self-heal path, n=1',
          timeout_ms: coord.timeout_ms,
          exit_ms: round1(r.ms),
          close_ms: round1(r.close_ms),
          killed_at_limit: r.timedOut,
        };
      } finally {
        fresh.cleanup();
      }
    }
  } finally {
    sandbox.cleanup();
  }
  const after = gitStatus();
  const treeDiff = diffStatus(before, after);

  // per-event aggregates
  const aggregates = {};
  for (const r of results) {
    if (r.not_measured) continue;
    const a = aggregates[r.event] || (aggregates[r.event] = { hooks: 0, sum_p50_ms: 0, sum_p95_ms: 0 });
    a.hooks += 1;
    a.sum_p50_ms = round1(a.sum_p50_ms + r.p50_ms);
    a.sum_p95_ms = round1(a.sum_p95_ms + r.p95_ms);
  }
  const ups = aggregates.UserPromptSubmit || null;

  return {
    machine: os.release(),
    platform: os.platform() + ' ' + os.arch(),
    node: process.version,
    measured_at: new Date().toISOString(),
    n,
    percentile_rule: 'index floor(q*(n-1)) of ascending samples; at n=10 p95 is the second-largest sample',
    timing_rule: 'p50/p95/max are wall time to process EXIT; close_p95_ms/close_max_ms are wall time until the stdout/stderr pipes closed (a backgrounded child holding the pipe past exit shows as pipe_held_after_exit > 0)',
    node_empty_process_ms: nodeBaseline,
    entries: results,
    first_session_probe: firstSessionProbe,
    aggregates,
    user_prompt_submit_per_prompt: ups
      ? { hooks: ups.hooks, sum_p50_ms: ups.sum_p50_ms, sum_p95_ms: ups.sum_p95_ms, note: 'sequential sum; Claude Code may run hooks of one event concurrently, so this is the worst-case ceiling' }
      : null,
    // Raw before/after `git status --short` difference of the checkout. On a tree shared with other
    // sessions a difference can be a peer edit; the paths are listed so the reader can judge.
    tree_unchanged: treeDiff.added.length === 0 && treeDiff.removed.length === 0,
    tree_diff: treeDiff,
  };
}

function renderTable(report) {
  const lines = [];
  lines.push('Hook cold-start (n=' + report.n + ', node ' + report.node + ', ' + report.machine + ')');
  lines.push('empty node process p50 ' + report.node_empty_process_ms.p50_ms + ' ms, p95 ' + report.node_empty_process_ms.p95_ms + ' ms');
  let ev = null;
  for (const r of report.entries) {
    if (r.event !== ev) { ev = r.event; lines.push(''); lines.push('[' + ev + ']'); }
    const name = r.command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}\//g, '').replace(/^node "/, '').replace(/"/g, '');
    if (r.not_measured) lines.push('  ' + name + '  budget ' + r.timeout_ms + ' ms  NOT MEASURED (' + r.not_measured + ')');
    else lines.push('  ' + name + '  budget ' + r.timeout_ms + ' ms  p50 ' + r.p50_ms + '  p95 ' + r.p95_ms + '  max ' + r.max_ms + '  breaches ' + r.timeout_breaches + (r.pipe_held_after_exit ? '  pipe-held ' + r.pipe_held_after_exit + 'x (close max ' + r.close_max_ms + ')' : ''));
  }
  if (report.first_session_probe) {
    const f = report.first_session_probe;
    lines.push('');
    lines.push('first-session probe (bare HOME) ' + f.command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}\//g, '') + ': exit ' + f.exit_ms + ' ms, close ' + f.close_ms + ' ms, killed at limit ' + f.killed_at_limit);
  }
  lines.push('');
  for (const k of Object.keys(report.aggregates)) {
    const a = report.aggregates[k];
    lines.push(k + ' aggregate: ' + a.hooks + ' hooks, sum of p50 ' + a.sum_p50_ms + ' ms, sum of p95 ' + a.sum_p95_ms + ' ms');
  }
  if (report.user_prompt_submit_per_prompt) {
    const u = report.user_prompt_submit_per_prompt;
    lines.push('UserPromptSubmit per-prompt aggregate: ' + u.hooks + ' hooks, sum of p50 ' + u.sum_p50_ms + ' ms (sum of p95 ' + u.sum_p95_ms + ' ms)');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI (switch-case router, no commander/yargs)
// ---------------------------------------------------------------------------

async function main(argv) {
  const opts = { n: 10, json: false, out: null, includeHeavy: false, treeCheck: 'strict' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--n': opts.n = parseInt(argv[++i], 10); break;
      case '--json': opts.json = true; break;
      case '--out': opts.out = argv[++i]; break;
      case '--include-heavy': opts.includeHeavy = true; break;
      case '--tree-check': opts.treeCheck = argv[++i]; break;
      case '--help': case '-h':
        process.stdout.write('usage: measure-hook-cold-start.cjs [--n <count>] [--json] [--out <file>] [--include-heavy] [--tree-check strict|report]\n');
        return 0;
      default:
        process.stderr.write('unknown argument: ' + a + '\n');
        return 2;
    }
  }
  if (opts.treeCheck !== 'strict' && opts.treeCheck !== 'report') {
    process.stderr.write('--tree-check must be strict or report\n');
    return 2;
  }
  if (!Number.isInteger(opts.n) || opts.n < 1) {
    process.stderr.write('--n must be a positive integer\n');
    return 2;
  }
  const report = await measureAll(opts);
  if (opts.out) {
    const outPath = path.resolve(opts.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  }
  if (opts.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else process.stdout.write(renderTable(report) + '\n');
  if (!report.tree_unchanged) {
    const strict = opts.treeCheck === 'strict';
    process.stderr.write((strict ? 'FAIL' : 'note') + ': git status of the checkout changed during the run (a hook wrote into the shared tree, or a peer session edited it):\n');
    for (const x of report.tree_diff.added) process.stderr.write('  + ' + x + '\n');
    for (const x of report.tree_diff.removed) process.stderr.write('  - ' + x + '\n');
    if (strict) return 1;
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => { process.stderr.write(String(err && err.stack || err) + '\n'); process.exit(1); });
}

module.exports = { payloadFor, parseHookCommands, makeSandbox, hookEnv, spawnHook, percentile, statsOf, HOOKS_JSON, REPO_ROOT };
