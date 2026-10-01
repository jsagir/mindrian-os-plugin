// Spike 006, stage 03: burst stress. Repeats concurrent write bursts (one and two MCP
// sessions) against the live page and records every document the browser never got,
// with its stamp, so a checkpoint skip can be explained rather than averaged away.
// Usage: node stages/03_probe/burst-stress.cjs [rounds] [perRound] [mode]
//   mode: ts (default server) | settle  (passed to the pull server as PULL_MODE)
// No em-dashes.
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const L = require('./launch.cjs');

const ROUNDS = Number(process.argv[2] || 8);
const PER = Number(process.argv[3] || 200);
const MODE = process.argv[4] || 'ts';
const OUT = path.resolve(__dirname, 'output/burst-stress-' + MODE + '.json');
const getJson = (u) => new Promise((res, rej) => http.get(u, (r) => { let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => res(JSON.parse(b))); }).on('error', rej));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  process.env.PULL_MODE = MODE;
  const stack = await L.startStack({ pullPort: 3871, prefix: 'spike006b-' });
  const out = { mode: MODE, rounds: [], started: new Date().toISOString() };
  let browser;
  try {
    const A = await L.mcpConnect(stack.mcpUrl, 'burst-a');
    const B = await L.mcpConnect(stack.mcpUrl, 'burst-b');
    for (const x of [A, B]) await x.c.callTool({ name: 'room_bind', arguments: { room: L.SLUG } });
    browser = await chromium.launch();
    const page = await (await browser.newContext()).newPage();
    await page.goto(stack.pullUrl + '/');
    await page.waitForFunction(() => window.__probe && window.__probe.ready === true, null, { timeout: 30000 });
    for (let r = 0; r < ROUNDS; r++) {
      const two = r % 2 === 1;
      const t0 = Date.now();
      await Promise.all(Array.from({ length: PER }, (_, i) => {
        const cl = two && i % 2 ? B.c : A.c;
        // Alternate a claim insert with a gate mint+answer (status update + decision + memory event).
        return cl.callTool({ name: 'claim_write', arguments: { knowledge_type: 'assumption', text: 'burst ' + r + ' ' + i + ' ' + t0 } });
      }));
      const t1 = Date.now();
      let conv = null;
      const end = Date.now() + 6000;
      while (Date.now() < end) {
        const c = await getJson(stack.pullUrl + '/census');
        const n = await page.evaluate(() => window.__probe.statusById ? window.__probe.statusById.size : -1);
        if (c.nodes_live === n) { conv = { ok: true, ms: Date.now() - t1 }; break; }
        await sleep(25);
      }
      const ids = await getJson(stack.pullUrl + '/ids');
      const have = new Set(await page.evaluate(() => [...window.__probe.statusById.keys()]));
      const missing = ids.nodes.filter((k) => !have.has(k));
      let missedDocs = [];
      if (missing.length) {
        const all = (await getJson(stack.pullUrl + '/pull/nodes?limit=1000')).documents;
        missedDocs = missing.map((k) => { const d = all.find((x) => x.id === k); return d && { id: d.id, type: d.type, ts: d.ts, lm: d.lm, status: d.status }; });
        // Neighbours in checkpoint order: did another doc share the millisecond?
        for (const m of missedDocs) { if (m) m.same_ms_neighbours = all.filter((x) => x.ts === m.ts && x.id !== m.id).length; }
      }
      out.rounds.push({ round: r, sessions: two ? 2 : 1, writes: PER, calls_ms: t1 - t0, converged: conv ? conv.ok : false, converge_ms: conv ? conv.ms : null, missing: missing.length, missedDocs: missedDocs.slice(0, 5) });
      console.log('round', r, JSON.stringify(out.rounds[out.rounds.length - 1]).slice(0, 400));
      // Missed docs stay missed until something re-pulls: a reload proves recovery.
    }
    await A.c.close(); await B.c.close();
  } catch (e) {
    out.error = String(e.stack || e).slice(0, 600);
  } finally {
    if (browser) await browser.close();
    out.teardown = await stack.stop();
    out.summary = { rounds: out.rounds.length, rounds_with_miss: out.rounds.filter((x) => x.missing > 0).length, total_missing: out.rounds.reduce((a, x) => a + x.missing, 0) };
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    console.log('summary', JSON.stringify(out.summary), 'real_room_untouched', out.teardown.real_room_untouched);
    process.exit(0);
  }
})();
