'use strict';
// Phase 400.5 plan 01: CPU load for the G11 load leg. startCpuLoad(n, {maxMs}) spawns n busy-loop children of
// process.execPath. Each child checks Date.now() every 1,000,000 iterations and exits after maxMs (default 1,800,000).
// stop() sends SIGKILL and resolves when every child exited. A process 'exit' handler kills every live child.

const { spawn } = require('node:child_process');

const LIVE = new Set();
let exitHooked = false;
function hookExit() {
  if (exitHooked) return;
  exitHooked = true;
  process.on('exit', () => { for (const c of LIVE) { try { c.kill('SIGKILL'); } catch (_e) { /* gone */ } } });
}

function startCpuLoad(n, opts) {
  hookExit();
  const maxMs = Math.max(1000, Number((opts && opts.maxMs) || 1800000));
  const code = 'const end = Date.now() + Number(process.argv[1]); let i = 0, x = 0;' +
    ' for (;;) { x = (x + i * 7) % 1000003; i++; if (i % 1000000 === 0 && Date.now() > end) process.exit(0); }';
  const children = [];
  for (let k = 0; k < Math.max(0, Math.floor(n)); k++) {
    const c = spawn(process.execPath, ['-e', code, String(maxMs)], { stdio: 'ignore' });
    LIVE.add(c);
    c.on('exit', () => LIVE.delete(c));
    children.push(c);
  }
  function stop() {
    return Promise.all(children.map((c) => new Promise((resolve) => {
      if (c.exitCode !== null || c.signalCode !== null) return resolve();
      c.on('exit', () => resolve());
      try { c.kill('SIGKILL'); } catch (_e) { resolve(); }
    })));
  }
  return { pids: children.map((c) => c.pid), stop };
}

module.exports = { startCpuLoad };
