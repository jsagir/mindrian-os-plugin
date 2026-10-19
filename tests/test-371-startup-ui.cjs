#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { realFlows, fixtures } = require('./test-startup-flows.cjs');
const { chromium } = require('playwright');
const { startupStyles } = require('../lib/mcp/room-assets.cjs');
const { URI } = require('../lib/mcp/room-app.cjs');

async function main() {
  await realFlows();
  fixtures.memory.structuredContent ||= JSON.parse(fixtures.memory.content.find(item => item.type === 'text').text);
  assert(URI.endsWith('/v4.html'));
  assert(fixtures.resource._meta.ui.csp.resourceDomains.includes('data:'));
  const vm = require('node:vm'), assetPath = path.join(__dirname, '../lib/mcp/room-assets.cjs');
  const sandbox = { module: { exports: {} }, __dirname: path.dirname(assetPath), require(name) {
    if (name !== 'node:fs') return require(name);
    return { readFileSync(file, ...args) { if (file.endsWith('.woff2')) throw Error('missing font'); return fs.readFileSync(file, ...args); } };
  } };
  vm.runInNewContext(fs.readFileSync(assetPath, 'utf8'), sandbox);
  assert(sandbox.module.exports.startupStyles().includes('font-family:Figtree,Arial,sans-serif'));
  console.log('PASS packaged asset CSP and usable system-font fallback when font bytes are unavailable');
  assert(startupStyles().includes('data:font/woff2;base64,'));
  for (const name of ['FIGTREE-OFL.txt', 'DM-SANS-OFL.txt']) assert(fs.readFileSync(path.join(__dirname, '../lib/mcp/assets', name), 'utf8').includes('SIL OPEN FONT LICENSE'));
  fixtures.preview.structuredContent.preview.name = 'Pilot evidence';
  fixtures.preview.structuredContent.gate.card.header = 'Create Pilot evidence?';
  fixtures.dashboard.structuredContent.name = 'Pilot evidence';
  const browser = await chromium.launch({ headless: true });
  const sdk = fs.readFileSync(require.resolve('@modelcontextprotocol/ext-apps/app-with-deps'), 'utf8');
  const page = await browser.newPage({ viewport: { width: 1024, height: 1100 } });
  const pageErrors = [], requests = [], cspErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', msg => { if (/Content Security Policy|Refused to load/.test(msg.text())) cspErrors.push(msg.text()); });
  await page.route('**/*', route => {
    const url = route.request().url(); requests.push(url);
    if (url.includes('@modelcontextprotocol/ext-apps@2.0.3/')) return route.fulfill({ contentType: 'text/javascript', body: sdk });
    if (url === 'http://startup-371.test/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0"></body>' });
    return route.abort();
  });
  async function open(mode = {}, width = 960) {
    await page.goto('http://startup-371.test/');
    await page.setViewportSize({ width: Math.max(1000, width), height: 1100 });
    await page.evaluate(({ fixtures, mode, width }) => {
      window.calls = []; window.messages = [];
      let creationAttempts = 0, moveAttempts = 0, moveRecorded = false, failedHandover = false, memoryAttempts = 0, briefingAttempts = 0;
      const iframe = document.createElement('iframe'); iframe.style = `display:block;width:${width}px;height:1000px;border:0`; iframe.sandbox = 'allow-scripts';
      const send = value => iframe.contentWindow.postMessage({ jsonrpc: '2.0', ...value }, '*');
      window.addEventListener('message', event => {
        if (event.source !== iframe.contentWindow) return; const message = event.data;
        if (message.method === 'ui/initialize') {
          send({ method: 'ui/notifications/tool-input', params: { arguments: {} } });
          const initial = mode.direct === 'create' ? fixtures.preview : mode.direct === 'startup' ? fixtures.startupReturning : mode.returning ? { structuredContent: { home: '/synthetic/rooms', rooms: ['first-room'] } } : fixtures.list;
          send({ method: 'ui/notifications/tool-result', params: initial });
          send({ id: message.id, result: { protocolVersion: message.params.protocolVersion, hostInfo: { name: 'ChatGPT-test', version: '371' }, hostCapabilities: { serverTools: {}, serverMessages: {}, updateModelContext: { text: {} } }, hostContext: { theme: 'light', displayMode: 'inline' } } });
        } else if (message.method === 'tools/call') {
          window.calls.push(message); const name = message.params.name, args = message.params.arguments; let result;
          const refuse = () => send({ id: message.id, error: { code: -32603, message: 'Injected unknown response' } });
          if (name === 'room_create') result = fixtures.preview;
          else if (name === 'gate_answer') {
            if (args.gate_id === fixtures.preview.structuredContent.gate.gate_id) {
              if (mode.unknownCreate && creationAttempts++ === 0) return refuse();
              if (mode.collision) result = { isError: true, structuredContent: { ok: false, reason: 'room_exists' } };
              else result = args.verdict === 'approve' ? fixtures.created : { structuredContent: { ok: true, verdict: args.verdict, room_creation: { ok: true, created: false } } };
            } else {
              if (mode.unknownMove && moveAttempts++ === 0) return refuse();
              moveRecorded = true; result = { structuredContent: { ok: true, gate_id: args.gate_id, verdict: args.verdict } };
            }
          } else if (name === 'room_bind') result = fixtures.binding;
          else if (name === 'context_assemble') {
            if (mode.memoryFail && memoryAttempts++ === 0) result = { isError: true, structuredContent: { ok: false, reason: 'no_room_db' } };
            else if (mode.memoryMismatch) result = { structuredContent: { ...fixtures.memory.structuredContent, room_dir: '/different/room' } };
            else result = fixtures.memory;
          } else if (name === 'room_startup') {
            if (mode.briefingFail && briefingAttempts++ === 0) result = { isError: true, structuredContent: { ok: false, reason: 'room_startup_failed' } };
            else {
              result = structuredClone(mode.returning || mode.direct === 'startup' ? fixtures.startupReturning : fixtures.startupFirst);
              if (mode.emptyHistory) { const b = result.structuredContent.briefing; b.last_session = null; b.previous_at = null; b.changes = { status: 'no_previous_checkpoint', items: [] }; b.open_questions = []; b.pending_decisions = []; }
              if (mode.noChanges) result.structuredContent.briefing.changes = { status: 'no_recorded_changes', items: [] };
              if (mode.partial) result.structuredContent.briefing.changes.truncated = true;
            }
          } else if (name === 'room-dashboard') result = mode.dashboardMismatch ? { structuredContent: { ...fixtures.dashboard.structuredContent, room_binding: { bound: true, slug: 'wrong-room' } } } : fixtures.dashboard;
          else if (name === 'room_list') {
            result = { structuredContent: { home: '/synthetic/rooms', rooms: ['first-room'] } };
            if (mode.holdRefresh) { window.releaseRefresh = () => send({ id: message.id, result }); return; }
          }
          else throw Error('Unexpected tool: ' + name);
          send({ id: message.id, result });
        } else if (message.id !== undefined && message.method) {
          window.messages.push(message);
          if (message.method === 'ui/message' && mode.failHandover && moveRecorded && !failedHandover) { failedHandover = true; send({ id: message.id, error: { code: -32603, message: 'Injected handover failure' } }); }
          else send({ id: message.id, result: {} });
        }
      });
      const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'">`;
      iframe.srcdoc = fixtures.html.replace('<head>', '<head>' + csp); document.body.append(iframe);
    }, { fixtures, mode, width });
    const frame = page.frames().find(f => f !== page.mainFrame());
    await frame.locator('#mindrian-status').filter({ hasText: /connected/ }).waitFor();
    await frame.evaluate(() => Promise.all([...document.fonts].map(font => font.load())));
    return frame;
  }
  async function choose(frame) { await frame.locator('input[value="first-room"]').check(); await frame.locator('#open').click(); }
  async function prepare(frame) { await frame.locator('#new-name').fill('Pilot evidence'); await frame.locator('#new-purpose').fill('Investigate the pilot evidence'); await frame.locator('#prepare').click(); await frame.locator('#creation-preview').waitFor({ state: 'visible' }); }
  async function screenshot(frame, name) {
    if (!process.env.MINDRIAN_371_OUTPUT) return;
    const height = await frame.evaluate(() => document.documentElement.scrollHeight);
    await page.locator('iframe').evaluate((el, height) => el.style.height = height + 'px', height);
    await page.setViewportSize({ width: 1024, height: height + 16 });
    await frame.locator('body').screenshot({ path: path.join(process.env.MINDRIAN_371_OUTPUT, name) });
  }
  try {
    for (const width of [320, 390, 600, 960]) {
      let frame = await open({}, width); await prepare(frame);
      assert(await frame.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'first-user width ' + width);
      assert.equal(await frame.locator('#creation-heading').evaluate(el => el === document.activeElement), true);
      const styles = await frame.locator('#title').evaluate(el => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight, family: getComputedStyle(el).fontFamily }));
      assert.equal(styles.size, '32px'); assert.equal(styles.weight, '700'); assert(styles.family.includes('Figtree'));
      assert(await frame.locator('button').evaluateAll(elements => elements.filter(el => !el.hidden && el.getClientRects().length).every(el => el.getBoundingClientRect().height >= 48)));
      if (width === 390 || width === 960) await screenshot(frame, `371-first-${width}.png`);
      await frame.locator('#birth-defer').click(); assert.equal(await page.evaluate(() => window.calls.some(c => c.params.name === 'room_bind')), false);
      frame = await open({ returning: true, partial: true }, width); await choose(frame); await frame.locator('#opened').waitFor({ state: 'visible' });
      assert(await frame.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'returning width ' + width);
      assert.equal(await frame.locator('#title').evaluate(el => el === document.activeElement), true);
      assert.match(await frame.locator('#changes').innerText(), /bounded selection/);
      assert((await frame.locator('time[datetime]').count()) >= 2);
      const context = await page.evaluate(() => window.messages.filter(m => m.method === 'ui/update-model-context').map(m => { try { return JSON.parse(m.params.content[0].text); } catch (_) { return {}; } }).filter(m => m.source === 'MindrianOS room opening').pop());
      assert.equal(context.memory.room_dir, fixtures.memory.structuredContent.room_dir); assert(context.briefing.last_session.next_action);
      if (width === 390 || width === 960) await screenshot(frame, `371-returning-${width}.png`);
    }
    console.log('PASS v5 typography, local font delivery under CSP, 320/390/600/960px layouts, focus, timestamp provenance and combined room context');
    let frame = await open({ unknownCreate: true }); await prepare(frame); await frame.locator('#birth-approve').click();
    await frame.locator('#retry-creation').waitFor({ state: 'visible' });
    assert(await frame.locator('#prepare').isDisabled()); assert(await frame.locator('#new-name').isDisabled());
    await frame.locator('#retry-creation').click(); await frame.locator('#opened').waitFor({ state: 'visible' });
    const creationCalls = await page.evaluate(() => window.calls.filter(c => c.params.name === 'gate_answer').map(c => c.params.arguments));
    assert.equal(creationCalls.length, 2); assert.deepEqual(creationCalls[0], creationCalls[1]);
    assert.equal(await page.evaluate(() => window.calls.filter(c => c.params.name === 'room_create').length), 1);
    frame = await open({ returning: true, unknownMove: true, failHandover: true }); await choose(frame); await frame.locator('#opened').waitFor({ state: 'visible' });
    await frame.locator('#today-intent').fill('Compare our pilot evidence today'); await frame.locator('button[data-choice=free_text]').click();
    await frame.locator('#retry-move').waitFor({ state: 'visible' }); assert(await frame.locator('#switch').isDisabled());
    await frame.locator('#retry-move').click(); await frame.locator('#status').filter({ hasText: 'Continue in the conversation' }).waitFor();
    assert.equal(await frame.locator('#today-intent').inputValue(), 'Compare our pilot evidence today');
    await frame.locator('#continue').click(); await frame.locator('#status').filter({ hasText: 'Continuing in the conversation' }).waitFor();
    const moves = await page.evaluate(() => window.calls.filter(c => c.params.name === 'gate_answer').map(c => c.params.arguments));
    assert.equal(moves.length, 2); assert.deepEqual(moves[0], moves[1]);
    const messages = await page.evaluate(() => window.messages.filter(m => m.method === 'ui/message').slice(-2).map(m => m.params));
    assert.deepEqual(messages[0], messages[1]); assert(JSON.stringify(messages[1]).includes('Compare our pilot evidence today'));
    console.log('PASS uncertain creation/move replies retry identical gate payloads; free-text survives failed handover without answering again');
    frame = await open({ collision: true }); await prepare(frame); await frame.locator('#birth-approve').click();
    await frame.locator('#status').filter({ hasText: 'already uses that folder' }).waitFor(); assert(await frame.locator('#prepare').isEnabled());
    frame = await open({ returning: true, memoryFail: true, briefingFail: true }); await choose(frame); await frame.locator('#opened').waitFor({ state: 'visible' });
    assert.match(await frame.locator('#brief').innerText(), /could not be loaded/);
    await frame.locator('#retry-memory').click(); await frame.locator('#status').filter({ hasText: 'Saved context loaded' }).waitFor();
    await frame.locator('#retry-briefing').click(); await frame.locator('#status').filter({ hasText: 'Workday briefing loaded' }).waitFor();
    for (const mode of [{ memoryMismatch: true }, { dashboardMismatch: true }]) {
      frame = await open({ returning: true, ...mode }); await choose(frame);
      await frame.locator('#status').filter({ hasText: 'belongs to another room' }).waitFor(); assert(await frame.locator('#opened').isHidden());
      const last = await page.evaluate(() => window.messages.filter(m => m.method === 'ui/update-model-context').pop());
      assert(JSON.stringify(last).includes('No room context'));
    }
    frame = await open({ returning: true, emptyHistory: true }); await choose(frame); await frame.locator('#opened').waitFor({ state: 'visible' });
    assert.match(await frame.locator('#left-off').innerText(), /No previous session summary/); assert.match(await frame.locator('#changes').innerText(), /No previous checkpoint/);
    frame = await open({ returning: true, noChanges: true }); await choose(frame); await frame.locator('#opened').waitFor({ state: 'visible' });
    assert.match(await frame.locator('#changes').innerText(), /No changes were recorded since/);
    console.log('PASS collision recovery, memory/briefing retry, wrong-room isolation and distinct missing/unchanged history');
    frame = await open({ holdRefresh: true }, 390);
    await frame.locator('#new-name').fill('Unsent draft'); await frame.locator('#reload').click();
    assert(await frame.locator('#prepare').isDisabled());
    await page.evaluate(() => window.releaseRefresh());
    await frame.locator('input[value=first-room]').waitFor();
    assert.equal(await frame.locator('#new-name').inputValue(), 'Unsent draft');
    assert(await frame.locator('#reload').isEnabled());
    console.log('PASS refresh serializes user actions and preserves an unsent same-view draft');
    frame = await open({ direct: 'create' }, 320); assert(await frame.locator('#creation-preview').isVisible());
    frame = await open({ direct: 'startup' }, 320); assert.match(await frame.locator('#brief').innerText(), /not been loaded/);
    await frame.locator('#retry-memory').click(); await frame.locator('#status').filter({ hasText: 'Saved context loaded' }).waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
    frame = await open({}, 320); await frame.locator('#new-name').fill('Keyboard room'); await frame.locator('#new-name').press('Tab');
    assert.equal(await frame.locator('#new-purpose').evaluate(el => el === document.activeElement), true);
    await frame.locator('#new-purpose').fill('Review evidence'); await frame.locator('#new-purpose').press('Tab'); await frame.locator('#prepare').press('Enter');
    await frame.locator('#creation-preview').waitFor({ state: 'visible' });
    assert.equal(await frame.locator('#birth-approve').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    await frame.locator('#creation-heading').press('Tab');
    assert.equal(await frame.locator('#birth-approve').evaluate(el => el === document.activeElement), true);
    assert.equal(await frame.locator('#birth-approve').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    await frame.locator('#birth-approve').press('Tab'); await frame.locator('#birth-reject').press('Enter');
    await frame.locator('#status').filter({ hasText: 'Room not created' }).waitFor();
    await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'none' });
    frame = await open({ returning: true }, 390); await choose(frame); await frame.locator('#opened').waitFor({ state: 'visible' });
    // Text-only zoom: double the contract's four sizes while keeping container width.
    await frame.addStyleTag({ content: 'body,button,input,textarea,h3{font-size:32px!important}h1{font-size:64px!important}h2{font-size:48px!important}.location,.help,legend,label,time,#sections li span,.space figcaption,.mindrian-identity-copy strong,.mindrian-identity-copy span,#mindrian-status{font-size:28px!important}' });
    assert(await frame.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    assert.equal(await frame.locator('#title').evaluate(el => getComputedStyle(el).fontSize), '64px');
    const noJs = await browser.newPage({ javaScriptEnabled: false });
    await noJs.setContent(fixtures.html);
    assert.match(await noJs.locator('noscript').innerText(), /Continue in chat/);
    assert(await noJs.locator('#picker-actions').isHidden());
    await noJs.close();
    assert.deepEqual(pageErrors, []); assert.deepEqual(cspErrors, []);
    assert(requests.every(url => url === 'http://startup-371.test/' || url.includes('@modelcontextprotocol/ext-apps@2.0.3/')), 'no runtime font or API request');
    console.log('PASS direct App entries, keyboard-only controls, forced-color focus, reduced motion and 200% text scaling');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
