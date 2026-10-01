// Spike 006 side probe: after a pull-server restart (new journal epoch), does the
// browser's persisted checkpoint move to the new epoch, so the next reload pulls 0?
'use strict';
const http = require('http');
const { chromium } = require('playwright');
const L = require('./launch.cjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  process.env.PULL_MODE = 'journal';
  const stack = await L.startStack({ pullPort: 3871, prefix: 'spike006e-' });
  const b = await chromium.launch();
  const out = {};
  try {
    const page = await (await b.newContext()).newPage();
    const pulled = () => page.evaluate(() => window.__probe.events.filter((e) => e.label.startsWith('pull_')).map((e) => e.label + ':' + e.n));
    const ready = () => page.waitForFunction(() => window.__probe && window.__probe.ready, null, { timeout: 30000 });
    await page.goto(stack.pullUrl + '/'); await ready();
    out.first_load = await pulled();
    await page.reload(); await ready(); out.reload_same_epoch = await pulled();
    stack.killPullOnly(); await sleep(400); await stack.startPullAgain();
    await page.waitForFunction(() => (window.__probe.reconciles || 0) > 0, null, { timeout: 15000 }).catch(() => {});
    out.after_restart_same_page = await pulled();
    for (const wait of [0, 1500, 5000]) {
      await sleep(wait); await page.reload(); await ready();
      out['reload_after_epoch_change_wait_' + wait] = await pulled();
    }
  } catch (e) { out.error = String(e.stack || e).slice(0, 400); }
  await b.close(); out.teardown = await stack.stop();
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})();
