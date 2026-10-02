// Spike 007, stage 03: the one-click test, driven headless.
// Needs: the 006 demo stack (node ../006-room-pull-checkpoint/stages/03_probe/demo.cjs)
// and the agent-native dev server (stages/01_scaffold/serve.sh) on :8080.
// Arms: A grant gate approved with one click (recommended preselected);
//       B a gate_render gate approved; C a grant gate answered "Not now".
// For each: click -> ratified, click -> the decision visible in the 006 RxDB view
// with no reload, the grant state in the room, browser egress, server egress.
// No em-dashes.
'use strict';
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const S006 = path.resolve(__dirname, '../../../006-room-pull-checkpoint');
const { chromium } = require(path.join(S006, 'node_modules/playwright'));
const L = require(path.join(S006, 'stages/03_probe/launch.cjs'));
const stack = JSON.parse(fs.readFileSync(path.join(S006, 'stages/03_probe/output/stack.json'), 'utf8'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8080';
const OUT = path.resolve(__dirname, '../../results.json');
const log = [];
const ev = (label, data) => { const e = Object.assign({ ts: new Date().toISOString(), label }, data || {}); log.push(e); console.log(label, JSON.stringify(data || {}).slice(0, 400)); return e; };

function appPid() {
  const out = execFileSync('ss', ['-ltnpH']).toString();
  const m = out.split('\n').find((l) => /:8080\s/.test(l));
  const p = m && m.match(/pid=(\d+)/);
  return p ? Number(p[1]) : null;
}
// Remote endpoints of the app server's TCP sockets that are not loopback.
function serverEgress(pid) {
  if (!pid) return [];
  const out = execFileSync('ss', ['-tnpH']).toString().split('\n').filter((l) => l.includes('pid=' + pid + ','));
  return out.map((l) => l.trim().split(/\s+/)[4]).filter((peer) => peer && !/^(127\.|\[::1\]|\[::ffff:127\.)/.test(peer));
}

async function grantStatus() {
  const { c } = await L.mcpConnect(stack.mcpUrl, 'click-test-check');
  await c.callTool({ name: 'room_bind', arguments: { room: L.SLUG } });
  const j = L.toolJson(await c.callTool({ name: 'research_run', arguments: { op: 'grant_status' } }));
  await c.close();
  return { standing: j && j.standing ? { grant_id: j.standing.grant_id, lifetime: j.standing.lifetime, terms: (j.standing.terms || []).length } : null };
}

async function arm(browser, room, name, query, pick) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const hosts = new Set();
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  const pid = appPid();
  const egress = new Set();
  const sampler = setInterval(() => { for (const p of serverEgress(pid)) egress.add(p); }, 100);
  const t0 = Date.now();
  await page.goto(APP + '/gate' + query, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('[data-testid=confirm]', { timeout: 90000 });
  const shownMs = Date.now() - t0;
  const radios = await page.$$eval('input[name=choice]', (els) => els.map((e) => ({ id: e.value, checked: e.checked, rec: !!e.closest('label').querySelector('.rec') })));
  if (pick) await page.check('input[value=' + pick + ']');
  const decBefore = await room.evaluate(() => [...window.__probe.statusById.keys()].filter((k) => k.startsWith('decision:')).length);
  const roomLoad = await room.evaluate(() => window.__probe.loadId);
  await page.screenshot({ path: path.join(__dirname, 'output', name + '-before.png'), fullPage: true });
  const tClick = Date.now();
  await page.click('[data-testid=confirm]');
  await page.waitForFunction(() => window.__gate && window.__gate.result, null, { timeout: 30000 });
  const tAnswer = Date.now();
  const g = await page.evaluate(() => window.__gate);
  const decId = g.result.decision_node_id;
  let seenMs = null;
  if (decId) {
    try {
      await room.waitForFunction((k) => window.__probe.statusById.has(k), decId, { timeout: 15000, polling: 20 });
      seenMs = Date.now() - tClick;
    } catch (_) { seenMs = null; }
  }
  await page.waitForTimeout(400);
  const decAfter = await room.evaluate(() => [...window.__probe.statusById.keys()].filter((k) => k.startsWith('decision:')).length);
  await page.screenshot({ path: path.join(__dirname, 'output', name + '-after.png'), fullPage: true });
  clearInterval(sampler);
  const successShown = await page.isVisible('.done');
  const grant = await grantStatus();
  ev('arm_' + name, {
    gate_shown_ms: shownMs, options: radios, preselected: (radios.find((r) => r.checked) || {}).id || null,
    preselected_is_recommended: !!(radios.find((r) => r.checked && r.rec)) || (!radios.some((r) => r.rec) && radios[0] && radios[0].checked),
    clicked: pick || 'preselected', mint_session: g.mcp_session, click_to_answer_ms: tAnswer - tClick,
    answered: g.result.answered, ratified: g.result.ratified, executed: g.result.executed, refused: g.result.refused, decision_node_id: decId,
    click_to_room_view_ms: seenMs, room_view_same_load: (await room.evaluate(() => window.__probe.loadId)) === roomLoad,
    room_view_decisions_before: decBefore, room_view_decisions_after: decAfter, success_view_shown: successShown, grant_after: grant,
    browser_hosts: [...hosts], server_non_loopback_peers: [...egress],
  });
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    const roomCtx = await browser.newContext();
    const room = await roomCtx.newPage();
    const roomHosts = new Set();
    room.on('request', (r) => roomHosts.add(new URL(r.url()).host));
    await room.goto(stack.pullUrl + '/');
    await room.waitForFunction(() => window.__probe && window.__probe.ready, null, { timeout: 30000 });
    ev('room_view_ready', { url: stack.pullUrl, grant_before: await grantStatus() });
    await arm(browser, room, 'A_grant_one_click', '?source=grant&terms=liquid%20metal%20conductor,deep%20eutectic%20solvent', null);
    await arm(browser, room, 'B_gate_render_one_click', '?source=render', null);
    await arm(browser, room, 'C_grant_not_now', '?source=grant&terms=percolation%20threshold', 'not_now');
    await room.screenshot({ path: path.join(__dirname, 'output', 'room-view-after.png') });
    ev('room_view_hosts', { hosts: [...roomHosts] });
  } catch (e) {
    ev('error', { error: String(e.stack || e).slice(0, 800) });
  } finally {
    await browser.close();
    ev('real_room', { untouched_vs_stack_start: JSON.stringify(L.realRoomStamp()) === JSON.stringify(stack.before || L.realRoomStamp()) });
    fs.writeFileSync(OUT, JSON.stringify(log, null, 1));
    process.exit(0);
  }
})();
