// Event latency as Claude Code runs it: all matching hooks of one event start together; latency = time until the last one exits.
// 381: phase copy of /home/jsagi/.mindrian/perf-audit-2026-10-29/hook-bench-parallel.cjs. Extra env: SKIP, TRANSCRIPT, TOUCH, WAIT_ABSENT.
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const [root, cwd, runsArg, ...events] = process.argv.slice(2); const runs = +runsArg || 3;
const hooks = JSON.parse(fs.readFileSync(path.join(root, 'hooks/hooks.json'), 'utf8')).hooks;
// 381: TRANSCRIPT replaces the default transcript path
const transcript = process.env.TRANSCRIPT || path.join(process.env.SCRATCH, 'bench-transcript.jsonl');
const base = { session_id: 'benchp-' + process.pid, transcript_path: transcript, cwd, permission_mode: 'default' };
const payloads = {
  // 381: SessionStart payload (the original had none)
  SessionStart: { ...base, hook_event_name: 'SessionStart', source: 'startup' },
  UserPromptSubmit: { ...base, hook_event_name: 'UserPromptSubmit', prompt: 'what decision is stuck in the strategy section' },
  PreToolUse: { ...base, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' }, tool_use_id: 't' },
  PostToolUse: { ...base, hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: path.join(cwd, 'STATE.md') }, tool_response: { type: 'text', file: { filePath: path.join(cwd, 'STATE.md'), content: 'x' } }, tool_use_id: 't' },
  Stop: { ...base, hook_event_name: 'Stop', stop_hook_active: false },
};
const env = { ...process.env, CLAUDE_PLUGIN_ROOT: root };
const matches = (m, tool) => !m || new RegExp('^(' + m + ')$').test(tool);
// 381: SKIP is a regex; a hook whose command matches it is dropped
const skip = process.env.SKIP ? new RegExp(process.env.SKIP) : null;
// 381: 1-minute load average from /proc/loadavg
const load1 = () => { try { return fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]; } catch (_e) { return 'na'; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (const ev of events) {
    // 381: SessionStart groups match "startup"; UserPromptSubmit and Stop take every group; tool events keep the tool-name match
    const tool = ev === 'SessionStart' ? 'startup' : payloads[ev].tool_name; const list = [];
    const loadBefore = load1();
    for (const g of hooks[ev] || []) if (ev === 'UserPromptSubmit' || ev === 'Stop' || matches(g.matcher, tool)) for (const h of g.hooks || []) { const c = h.command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, root); if (skip && skip.test(c)) continue; list.push(c); }
    const walls = [], slowest = new Map();
    for (let i = 0; i < runs; i++) {
      // 381: TOUCH sets atime and mtime of one file to now before each run
      if (process.env.TOUCH) { const now = new Date(); fs.utimesSync(process.env.TOUCH, now, now); }
      const a = process.hrtime.bigint();
      await Promise.all(list.map(cmd => new Promise(res => { const s = process.hrtime.bigint(); const p = spawn('bash', ['-lc', cmd], { cwd, env, stdio: ['pipe', 'ignore', 'ignore'] }); p.on('exit', () => { const ms = Number(process.hrtime.bigint() - s) / 1e6; const k = cmd.replace(root + '/', '').slice(0, 44); slowest.set(k, Math.max(slowest.get(k) || 0, ms)); res(); }); p.stdin.end(JSON.stringify(payloads[ev])); })));
      walls.push(Number(process.hrtime.bigint() - a) / 1e6);
      // 381: WAIT_ABSENT polls every 500 ms until the path is gone, at most 120 s, and prints the wait
      if (process.env.WAIT_ABSENT) { const w0 = Date.now(); while (fs.existsSync(process.env.WAIT_ABSENT) && Date.now() - w0 < 120000) await sleep(500); console.log(`  waited ${Date.now() - w0} ms for ${process.env.WAIT_ABSENT}`); }
      // 381: PAUSE_MS sleeps after each run (after WAIT_ABSENT) so the next TOUCH lands in a later clock second than the previous STATE.md write; the /mnt/c 9p mount keeps whole seconds only
      if (process.env.PAUSE_MS) await sleep(+process.env.PAUSE_MS);
    }
    const raw = walls.slice(); walls.sort((x, y) => x - y);
    const top = [...slowest].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([k, v]) => `${k}=${v.toFixed(0)}ms`).join(', ');
    // 381: event line also prints the load average before and after, and the run walls in run order
    console.log(`${ev.padEnd(16)} hooks=${list.length} wall median=${walls[Math.floor(walls.length / 2)].toFixed(0)} ms  min=${walls[0].toFixed(0)}  max=${walls[walls.length - 1].toFixed(0)}  load1_before=${loadBefore} load1_after=${load1()}  runs_ms=[${raw.map(x => x.toFixed(0)).join(',')}]  slowest: ${top}`);
    // 381: one max line per hook
    for (const [k, v] of [...slowest].sort((x, y) => y[1] - x[1])) console.log(`  hook ${k.slice(0, 60)} max=${v.toFixed(0)} ms`);
  }
})();
