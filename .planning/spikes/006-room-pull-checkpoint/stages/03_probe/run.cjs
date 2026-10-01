// Spike 006, stage 03: the probe. Starts the throwaway stack, opens the stage-02 page
// in headless Chromium (Playwright), writes through the MCP server, and measures
// catch-up, live latency, burst, reconnect, supersession, hard deletes, egress and
// the plugin SSE bus. Writes ../../results.json (forensic log).
// No em-dashes.
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const L = require('./launch.cjs');

const MODE = process.argv[2] || 'journal';
process.env.PULL_MODE = MODE;
const OUT = MODE === 'journal' ? path.resolve(__dirname, '../../results.json') : path.resolve(__dirname, 'output/results-' + MODE + '.json');
const PULL_LOG = path.resolve(__dirname, 'output/pull-server.jsonl');
const log = [];
let walkPrev = null;
const ev = (label, data) => {
  const e = Object.assign({ ts: new Date().toISOString(), label }, data || {});
  if (/^(P\d|stack_up|teardown)/.test(label)) { const w = L.realRoomWalk(); if (walkPrev) e.real_room_files_changed_since_last_phase = L.walkDiff(walkPrev, w); walkPrev = w; } log.push(e); console.log(label, JSON.stringify(data || {}).slice(0, 260)); return e; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const stats = (arr) => ({ n: arr.length, min: arr.length ? Math.min(...arr) : null, p50: pct(arr, 0.5), p95: pct(arr, 0.95), max: arr.length ? Math.max(...arr) : null });

function getJson(url) {
  return new Promise((res, rej) => { http.get(url, (r) => { let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
}

async function call(c, name, args, label) {
  const t0 = Date.now();
  try {
    const r = await c.callTool({ name, arguments: args || {} });
    const j = L.toolJson(r);
    const e = ev(label || name, { ok: !r.isError, ms: Date.now() - t0, body: JSON.stringify(j).slice(0, 500) });
    return { j, t0, t1: Date.now(), ok: !r.isError, e };
  } catch (err) {
    ev(label || name, { ok: false, ms: Date.now() - t0, error: String(err.message || err).slice(0, 300) });
    return { j: null, t0, t1: Date.now(), ok: false };
  }
}

// Find the node id a claim_write produced: the tool answers with it.
function claimIdOf(j) {
  if (!j) return null;
  const s = JSON.stringify(j);
  const m = s.match(/"(?:node_id|claim_id|id)":"((?:claim|typed_claim|tclaim)[^"]*)"/) || s.match(/"(?:node_id|claim_id)":"([^"]+)"/);
  return m ? m[1] : null;
}

async function waitInPage(page, fnSrc, arg, timeoutMs) {
  const t0 = Date.now();
  try {
    await page.waitForFunction(fnSrc, arg, { timeout: timeoutMs || 15000, polling: 20 });
    return { ok: true, ms: Date.now() - t0 };
  } catch (_) { return { ok: false, ms: Date.now() - t0 }; }
}

async function browserCounts(page) {
  return page.evaluate(async () => {
    const db = window.__probe.db;
    const nodes = await db.nodes.find().exec();
    const edges = await db.edges.find().exec();
    return { nodes: nodes.length, edges: edges.length, nodeIds: nodes.map((d) => d.id), edgeIds: edges.map((d) => d.id) };
  });
}
async function converge(page, pullUrl, timeoutMs) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < (timeoutMs || 20000)) {
    const c = await getJson(pullUrl + '/census');
    const b = await browserCounts(page);
    last = { room_nodes_live: c.nodes_live, room_edges_live: c.edges_live, browser_nodes: b.nodes, browser_edges: b.edges };
    if (c.nodes_live === b.nodes && c.edges_live === b.edges) return Object.assign({ ok: true, ms: Date.now() - t0 }, last);
    await sleep(25);
  }
  return Object.assign({ ok: false, ms: Date.now() - t0 }, last);
}
async function idDiff(page, pullUrl) {
  const room = await getJson(pullUrl + '/ids');
  const b = await browserCounts(page);
  const rn = new Set(room.nodes); const bn = new Set(b.nodeIds);
  const re = new Set(room.edges); const be = new Set(b.edgeIds);
  return {
    nodes_only_in_browser: [...bn].filter((x) => !rn.has(x)).length,
    nodes_only_in_room: [...rn].filter((x) => !bn.has(x)).length,
    edges_only_in_browser: [...be].filter((x) => !re.has(x)).length,
    edges_only_in_room: [...re].filter((x) => !be.has(x)).length,
    sample_only_in_browser: [...bn].filter((x) => !rn.has(x)).slice(0, 3),
    sample_only_in_room: [...rn].filter((x) => !bn.has(x)).slice(0, 3),
  };
}

// Plugin SSE bus subscriber (GET /event on the MCP server).
function subscribePluginBus(mcpPort, sink) {
  const req = http.get({ host: '127.0.0.1', port: mcpPort, path: '/event', headers: { Accept: 'text/event-stream' } }, (res) => {
    sink.status = res.statusCode;
    res.on('data', (d) => { const s = String(d); for (const m of s.matchAll(/event: ([^\n]+)/g)) sink.frames.push({ t: Date.now(), kind: m[1] }); });
  });
  req.on('error', (e) => { sink.error = String(e.message); });
  return req;
}

async function liveWrite(page, c, i, label) {
  const r = await call(c, 'claim_write', { knowledge_type: 'assumption', text: 'Spike 006 probe claim ' + label + ' ' + i + ' ' + Date.now() }, 'claim_write.' + label);
  const id = claimIdOf(r.j);
  if (!id) return { ok: false, reason: 'no_id', body: r.j };
  const w = await waitInPage(page, (k) => !!(window.__probe.renderedIds && window.__probe.renderedIds.has(k)), id, 15000);
  const t = await page.evaluate((k) => {
    const p = window.__probe;
    const rec = p.received.find((x) => x.id === k);
    const fr = Object.entries(p.firstRender).find(([key]) => key.startsWith(k + '#'));
    return { received: rec ? rec.t : null, rendered: fr ? fr[1] : null };
  }, id);
  return {
    ok: w.ok, id,
    call_ms: r.t1 - r.t0,
    write_to_received_ms: t.received ? t.received - r.t0 : null,
    return_to_received_ms: t.received ? t.received - r.t1 : null,
    write_to_render_ms: t.rendered ? t.rendered - r.t0 : null,
    return_to_render_ms: t.rendered ? t.rendered - r.t1 : null,
  };
}

(async () => {
  try { fs.unlinkSync(PULL_LOG); } catch (_) {}
  const stack = await L.startStack({ pullPort: 3871, pullLog: PULL_LOG, prefix: 'spike006-' });
  ev('stack_up', { mode: MODE, home: stack.home, mcpPort: stack.mcpPort, pullPort: stack.pullPort, mcp_bound_to: stack.boundLine, bound_is_tmp: stack.boundLine.includes(stack.home) });
  const bus = { frames: [], status: null };
  const busReq = subscribePluginBus(stack.mcpPort, bus);
  let browser;
  try {
    const { c } = await L.mcpConnect(stack.mcpUrl, 'spike006-probe');
    await call(c, 'room_bind', { room: L.SLUG }, 'room_bind');
    const census0 = await getJson(stack.pullUrl + '/census');
    ev('census_initial', census0);

    browser = await chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const requests = [];
    page.on('request', (r) => requests.push({ method: r.method(), url: r.url() }));
    page.on('console', (m) => { if (m.type() === 'error') ev('page_console_error', { text: m.text().slice(0, 200) }); });
    const tNav = Date.now();
    await page.goto(stack.pullUrl + '/');
    const loadId = await page.evaluate(() => window.__probe.loadId);

    // P1 cold catch-up.
    const ready = await waitInPage(page, () => window.__probe && window.__probe.ready === true, null, 30000);
    const cold = await page.evaluate(() => ({ catchupMs: window.__probe.catchupMs, pulls: window.__probe.events.filter((e) => e.label.startsWith('pull_')).length }));
    const conv0 = await converge(page, stack.pullUrl, 10000);
    ev('P1_cold_catchup', { ready: ready.ok, nav_to_ready_ms: Date.now() - tNav, in_page_catchup_ms: cold.catchupMs, pull_requests: cold.pulls, converge: conv0 });

    // P2 live single writes x12.
    const live = [];
    for (let i = 0; i < 12; i++) { live.push(await liveWrite(page, c, i, 'single')); await sleep(150); }
    ev('P2_live_single', {
      ok: live.filter((x) => x.ok).length + '/' + live.length,
      call_ms: stats(live.map((x) => x.call_ms)),
      return_to_render_ms: stats(live.filter((x) => x.return_to_render_ms != null).map((x) => x.return_to_render_ms)),
      write_to_render_ms: stats(live.filter((x) => x.write_to_render_ms != null).map((x) => x.write_to_render_ms)),
      write_to_received_ms: stats(live.filter((x) => x.write_to_received_ms != null).map((x) => x.write_to_received_ms)),
    });

    // P3 gate: mint on THIS session with the new claim as subject, approve -> update.
    const subject = live.find((x) => x.ok) && live.find((x) => x.ok).id;
    const g = await call(c, 'gate_render', { header: 'Spike 006: confirm the probe claim?', subject_node_id: subject, options: [{ id: 'approve', label: 'Confirm the claim', rank: 1 }, { id: 'hold', label: 'Not yet', rank: 2 }] }, 'gate_render');
    const gid = g.j && (g.j.gate_id || (g.j.card && g.j.card.gate_id) || (g.j.gate && g.j.gate.gate_id));
    const statusBefore = await page.evaluate((k) => window.__probe.statusById.get(k), subject);
    const decBefore = await page.evaluate(() => window.__probe.db.nodes.find({ selector: { type: 'decision' } }).exec().then((d) => d.length));
    const ga = await call(c, 'gate_answer', { gate_id: gid, chosen: ['approve'], verdict: 'approve' }, 'gate_answer');
    const upd = await waitInPage(page, (a) => window.__probe.statusById.get(a.k) !== a.s, { k: subject, s: statusBefore }, 15000);
    const statusAfter = await page.evaluate((k) => window.__probe.statusById.get(k), subject);
    const decAfter = await page.evaluate(() => window.__probe.db.nodes.find({ selector: { type: 'decision' } }).exec().then((d) => d.length));
    const roomStatus = (await getJson(stack.pullUrl + '/pull/nodes?limit=1000')).documents.find((d) => d.id === subject);
    ev('P3_gate_answer_update', {
      gate_id: gid, ratified: !!(ga.j && (ga.j.ratified || ga.j.ok)), gate_answer_body: JSON.stringify(ga.j).slice(0, 300),
      subject, status_before: statusBefore, status_after_browser: statusAfter, status_in_room: roomStatus && roomStatus.status,
      update_seen_ms_after_return: upd.ms, decisions_before: decBefore, decisions_after: decAfter,
      same_page_load: (await page.evaluate(() => window.__probe.loadId)) === loadId,
    });

    // P4 burst: 200 writes fired concurrently on one session.
    const N = 200;
    const sb0 = await page.evaluate(() => window.__probe.streamItems);
    const tb0 = Date.now();
    const burst = await Promise.all(Array.from({ length: N }, (_, i) => c.callTool({ name: 'claim_write', arguments: { knowledge_type: 'assumption', text: 'Spike 006 burst claim ' + i + ' ' + tb0 } }).then((r) => ({ ok: !r.isError, id: claimIdOf(L.toolJson(r)) })).catch((e) => ({ ok: false, err: String(e.message).slice(0, 120) }))));
    const tb1 = Date.now();
    const convB = await converge(page, stack.pullUrl, 30000);
    const sb1 = await page.evaluate(() => window.__probe.streamItems);
    const diffB = await idDiff(page, stack.pullUrl);
    if (diffB.sample_only_in_room.length) {
      const all = (await getJson(stack.pullUrl + '/pull/nodes?limit=1000')).documents;
      diffB.missed_docs = diffB.sample_only_in_room.map((k2) => { const d = all.find((x) => x.id === k2); return d && { id: d.id, type: d.type, ts: d.ts, lm: d.lm, status: d.status }; });
      diffB.browser_checkpoint = await page.evaluate(() => window.__probe.events.filter((x) => x.label === 'stream_nodes').slice(-3));
    }
    ev('P4_burst', { writes: N, ok: burst.filter((x) => x.ok).length, distinct_ids: new Set(burst.map((x) => x.id)).size, all_calls_ms: tb1 - tb0, converge_after_last_return_ms: convB.ms, converged: convB.ok, stream_items_during_burst: sb1 - sb0, room_nodes: convB.room_nodes_live, browser_nodes: convB.browser_nodes, id_diff: diffB });

    // P5 reconnect: kill the pull server, write while it is down, restart.
    const k = stack.killPullOnly();
    await sleep(300);
    const downSeen = await waitInPage(page, () => document.getElementById('live').classList.contains('bad'), null, 8000);
    const offline = [];
    for (let i = 0; i < 6; i++) { const r = await call(c, 'claim_write', { knowledge_type: 'assumption', text: 'Spike 006 offline claim ' + i + ' ' + Date.now() }, 'claim_write.offline'); offline.push(claimIdOf(r.j)); }
    await sleep(1500);
    const tr0 = Date.now();
    await stack.startPullAgain();
    const convR = await converge(page, stack.pullUrl, 20000);
    const rec5 = await waitInPage(page, () => (window.__probe.reconciles || 0) >= 1, null, 8000);
    const missing = await page.evaluate((ids) => Promise.all(ids.map((k2) => window.__probe.db.nodes.findOne(k2).exec().then((d) => !d))).then((a) => a.filter(Boolean).length), offline);
    ev('P5_reconnect', { kill: k, ui_showed_disconnected: downSeen.ok, writes_while_down: offline.length, restart_to_converged_ms: Date.now() - tr0, converged: convR.ok, offline_writes_missing_in_browser: missing, epoch_reconcile_done: rec5.ok, epoch_reconcile_ms: rec5.ms, resyncs: await page.evaluate(() => window.__probe.resyncs), same_page_load: (await page.evaluate(() => window.__probe.loadId)) === loadId });

    // P6 superseded -> _deleted. No MCP tool reaches supersede() today
    // (supersession-gate.cjs WD-348-3), so the harness calls the plugin's one
    // supersession writer on its own handle, emulating the future trigger.
    const nav = require(path.join(L.PLUGIN_ROOT, 'lib/core/navigation.cjs'));
    const { supersede } = require(path.join(L.PLUGIN_ROOT, 'lib/core/temporal/supersession.cjs'));
    const allDocs = (await getJson(stack.pullUrl + '/pull/nodes?limit=1000')).documents;
    const oldClaim = allDocs.find((d) => d.type === 'claim' && d.status === 'confirmed') || allDocs.find((d) => d.status === 'confirmed' && !['Section', 'memory_event', 'birth_gate_anchor'].includes(d.type));
    const newClaim = offline.find(Boolean);
    let supRes = null;
    if (oldClaim && newClaim) {
      const wdb = nav.openRoomDbForCaller(stack.roomDir);
      try { supRes = supersede(wdb, oldClaim.id, newClaim, { reason: 'spike006 probe', roomDir: stack.roomDir }); } finally { try { nav.closeRoomDbForCaller(wdb); } catch (_) {} }
    }
    const gone = oldClaim ? await waitInPage(page, (k2) => !window.__probe.statusById.has(k2), oldClaim.id, 10000) : { ok: false };
    const stillStored = oldClaim ? await page.evaluate((k2) => window.__probe.db.nodes.storageInstance.findDocumentsById([k2], true).then((r) => r.length && r[0]._deleted === true), oldClaim.id) : null;
    const roomRow = oldClaim ? (await getJson(stack.pullUrl + '/census')) : null;
    ev('P6_superseded_soft_delete', { old: oldClaim && oldClaim.id, supersede_ok: supRes && supRes.ok, supersede_reason: supRes && supRes.reason, left_browser_view: gone.ok, ms: gone.ms, kept_as_rxdb_tombstone: stillStored, room_census: roomRow });

    // P7 hard deletes: the plugin's graph rebuild deletes and re-inserts indexer
    // nodes/edges. A checkpoint pull cannot see a row that no longer exists.
    const rb = await call(c, 'room_graph', { command: 'graph-rebuild' }, 'room_graph.graph-rebuild');
    await sleep(2500);
    const convH = await converge(page, stack.pullUrl, 5000);
    const diffH = await idDiff(page, stack.pullUrl);
    ev('P7_hard_delete_gap', { rebuild_ok: rb.ok, converged: convH.ok, room_nodes: convH.room_nodes_live, browser_nodes: convH.browser_nodes, room_edges: convH.room_edges_live, browser_edges: convH.browser_edges, id_diff: diffH });

    // P7b hard deletes while the pull server is DOWN: its index is rebuilt with a
    // new epoch, so no tombstone exists; the page reconciles against /ids.
    const rec7b0 = await page.evaluate(() => window.__probe.reconciles || 0);
    stack.killPullOnly();
    await sleep(300);
    const rb2 = await call(c, 'room_graph', { command: 'graph-rebuild' }, 'room_graph.graph-rebuild.while_down');
    const before7b = await idDiff(page, stack.pullUrl).catch(() => null);
    await stack.startPullAgain();
    const rec7b = await waitInPage(page, (n) => (window.__probe.reconciles || 0) > n, rec7b0, 8000);
    const conv7b = await converge(page, stack.pullUrl, 8000);
    const diff7b = await idDiff(page, stack.pullUrl);
    ev('P7b_hard_delete_while_down', { rebuild_ok: rb2.ok, stale_before_restart: before7b, reconcile_done: rec7b.ok, reconcile_ms_after_restart: rec7b.ms, converged: conv7b.ok, converge_ms: conv7b.ms, reconciles: await page.evaluate(() => window.__probe.reconciles || 0), reconcile_events: await page.evaluate(() => window.__probe.events.filter((x) => x.label === 'reconcile')), id_diff: diff7b });

    // P8 warm reload: the checkpoint persists in IndexedDB.
    const tw = Date.now();
    await page.reload();
    await waitInPage(page, () => window.__probe && window.__probe.ready === true, null, 30000);
    const warm = await page.evaluate(() => ({ catchupMs: window.__probe.catchupMs, pulled: window.__probe.events.filter((e) => e.label.startsWith('pull_')).map((e) => e.n) }));
    ev('P8_warm_reload', { nav_to_ready_ms: Date.now() - tw, in_page_catchup_ms: warm.catchupMs, docs_per_pull: warm.pulled });

    // P11 scale: 2000 more writes (10 x 200 concurrent), then converge and scan cost.
    const t11 = Date.now();
    for (let r = 0; r < 10; r++) {
      await Promise.all(Array.from({ length: 200 }, (_, i) => c.callTool({ name: 'claim_write', arguments: { knowledge_type: 'assumption', text: 'Spike 006 scale ' + r + ' ' + i + ' ' + t11 } })));
    }
    const t11b = Date.now();
    const conv11 = await converge(page, stack.pullUrl, 20000);
    const pl11 = fs.existsSync(PULL_LOG) ? fs.readFileSync(PULL_LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((x) => x.ts >= t11 && x.label === 'scan') : [];
    ev('P11_scale', { writes: 2000, calls_ms: t11b - t11, converged: conv11.ok, converge_after_last_return_ms: conv11.ms, room_nodes: conv11.room_nodes_live, browser_nodes: conv11.browser_nodes, scans: pl11.length, scan_ms: stats(pl11.map((x) => x.ms)), journal_refresh_ms: stats(pl11.filter((x) => x.journal).map((x) => x.journal.ms)) });
    const tw2 = Date.now();
    await page.reload();
    await waitInPage(page, () => window.__probe && window.__probe.ready === true, null, 30000);
    ev('P11_warm_reload_at_scale', { nav_to_ready_ms: Date.now() - tw2, in_page_catchup_ms: await page.evaluate(() => window.__probe.catchupMs) });
    // Fresh browser context at scale: a cold catch-up of the whole room.
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    const tc2 = Date.now();
    await page2.goto(stack.pullUrl + '/');
    await waitInPage(page2, () => window.__probe && window.__probe.ready === true, null, 60000);
    const conv11c = await converge(page2, stack.pullUrl, 20000);
    ev('P11_cold_catchup_at_scale', { nav_to_ready_ms: Date.now() - tc2, in_page_catchup_ms: await page2.evaluate(() => window.__probe.catchupMs), converged: conv11c.ok, nodes: conv11c.browser_nodes });
    await ctx2.close();

    // P9 egress + no push.
    const hosts = [...new Set(requests.map((r) => new URL(r.url).host))];
    const nonGetToPull = requests.filter((r) => r.url.startsWith(stack.pullUrl) && r.method !== 'GET');
    const pushProbe = await new Promise((res) => { const rq = http.request({ host: '127.0.0.1', port: stack.pullPort, path: '/pull/nodes', method: 'POST' }, (r) => res(r.statusCode)); rq.on('error', () => res(null)); rq.end('{}'); });
    ev('P9_egress_and_push', { hosts, allowed: hosts.every((h) => h.startsWith('127.0.0.1') || h === 'fonts.googleapis.com' || h === 'fonts.gstatic.com'), non_get_requests_to_pull_server: nonGetToPull.length, server_answer_to_POST: pushProbe, total_requests: requests.length });

    // P10 the plugin SSE bus during all of the above.
    ev('P10_plugin_sse_bus', { status: bus.status, error: bus.error || null, frames: bus.frames.length, kinds: [...new Set(bus.frames.map((f) => f.kind))] });

    // Pull-server internals from its own log.
    const pl = fs.existsSync(PULL_LOG) ? fs.readFileSync(PULL_LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
    const scans = pl.filter((x) => x.label === 'scan');
    const byTrig = {};
    for (const s of scans) byTrig[s.trigger] = (byTrig[s.trigger] || 0) + 1;
    ev('pull_server_scans', { scans: scans.length, by_trigger: byTrig, scan_ms: stats(scans.map((s) => s.ms)), pull_nodes_ms: stats(pl.filter((x) => x.label === 'pull_nodes').map((x) => x.ms)), scan_errors: pl.filter((x) => x.label === 'scan_error').length });

    await page.screenshot({ path: path.resolve(__dirname, 'output/page.png'), fullPage: true });
    await c.close();
  } catch (e) {
    ev('probe_error', { error: String(e.stack || e).slice(0, 800) });
  } finally {
    try { busReq.destroy(); } catch (_) {}
    if (browser) await browser.close();
    const st = await stack.stop();
    ev('teardown', st);
    fs.writeFileSync(OUT, JSON.stringify(log, null, 1));
    process.exit(0);
  }
})();
