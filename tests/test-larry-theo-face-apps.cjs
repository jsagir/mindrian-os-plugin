#!/usr/bin/env node
'use strict';

// Real stdio resources plus an optional real-SDK iframe pass. No user rooms,
// Brain calls, host globals, or mocked App implementation are used.
// Run: node tests/test-larry-theo-face-apps.cjs [--browser]
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { hermeticEnv, rpcOverStdio, LOCAL_SERVER } = require('./helpers/mcp-wire-267.cjs');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_HASH = '78c75c6a697213be390091d315af6e883a54f367651d79b36e18462eb46e2464';
const VIEWS = ['room-dashboard', 'room-wiki', 'room-graph'];
const LARRY_IDS = ['rest', 'think', 'reframe', 'challenge', 'contra', 'could', 'decision', 'handover'];
const THEO_IDS = ['t_rest', 't_listen', 't_search', 't_found', 't_none', 't_refused', 't_handover'];
let passed = 0;
async function check(name, task) {
  await task();
  passed++;
  process.stdout.write('ok - ' + name + '\n');
}

function canonicalChecks() {
  const faces = require('../lib/mcp/theo-faces.cjs');
  assert.equal(faces.CANONICAL_SOURCE.sha256, SOURCE_HASH);
  assert.equal(faces.CANONICAL_SOURCE.path, 'theo-face/prototype/theo-faces-canonical.html');
  assert.deepEqual(faces.LARRY.map(state => state.id), LARRY_IDS);
  assert.deepEqual(faces.THEO.map(state => state.id), THEO_IDS);
  for (const id of [...LARRY_IDS, ...THEO_IDS]) {
    const svg = faces.renderFace(id);
    assert.match(svg, /<svg\b/);
    assert.ok(svg.includes('data-state="' + id + '"'), id + ' is a renderable, labeled face');
    assert.match(svg, /role="img"/);
    assert.match(svg, /aria-label="[^"]+"/);
    assert.doesNotMatch(svg, /<animate|<script|undefined|NaN/);
  }
  const reference = path.resolve(ROOT, '..', 'theo-face', 'prototype', 'theo-faces-canonical.html');
  if (fs.existsSync(reference)) {
    const html = fs.readFileSync(reference, 'utf8');
    assert.equal(crypto.createHash('sha256').update(html).digest('hex'), SOURCE_HASH,
      'independent user-owned reference remains the agreed source');
    const colors = html.match(/var C = (\{[^\n]+\});/)[0];
    const start = html.indexOf('var K = C.ink');
    const end = html.indexOf('var LEGEND =', start);
    const context = {};
    vm.runInNewContext('var INK="#111111", PAPER="#F7F5EE", WHITE="#FFFFFF";\n' +
      colors + '\n' + html.slice(start, end), context);
    for (const key of ['POSES', 'LARRY', 'THEO']) {
      assert.deepEqual(JSON.parse(JSON.stringify(faces[key])), JSON.parse(JSON.stringify(context[key])),
        key + ' retains all canonical geometry and state descriptions');
    }
  }
  return faces;
}

async function wireViews() {
  const fixture = hermeticEnv();
  try {
    fs.mkdirSync(path.join(fixture.dirs.roomDir, 'problem-definition'));
    fs.writeFileSync(path.join(fixture.dirs.roomDir, 'problem-definition', 'question.md'),
      '# Synthetic question\n\nWhat would change our interpretation?\n');
    const inputFor = name => ({ room_path: fixture.dirs.roomDir,
      ...(name === 'room-wiki' ? { section: 'problem-definition' } : {}),
      ...(name === 'room-graph' ? { layout: 'grid' } : {}) });
    const requests = [
      { method: 'tools/list' },
      ...VIEWS.map(name => ({ method: 'resources/read', params: { uri: 'ui://mindrian-os/' + name } })),
      ...VIEWS.map(name => ({ method: 'tools/call', params: { name, arguments: inputFor(name) } })),
    ];
    const wire = await rpcOverStdio(LOCAL_SERVER, requests, { env: fixture.env });
    assert.ok(wire.initialize && wire.initialize.result, 'actual server initializes');
    const info = wire.initialize.result.serverInfo;
    assert.match(info.title || '', /Larry.*MindrianOS/);
    assert.ok(info.icons && info.icons.some(icon => /^data:image\/svg\+xml[;,]/.test(icon.src)),
      'neutral canonical icon is delivered as server metadata');
    const tools = wire.responses.get(2).result.tools;
    const records = {};
    for (let i = 0; i < VIEWS.length; i++) {
      const name = VIEWS[i];
      const uri = 'ui://mindrian-os/' + name;
      assert.equal(tools.find(tool => tool.name === name)._meta.ui.resourceUri, uri);
      const resource = wire.responses.get(3 + i).result.contents[0];
      assert.equal(resource.mimeType, 'text/html;profile=mcp-app');
      const html = resource.text;
      const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
      assert.equal((markup.match(/id="mindrian-identity"/g) || []).length, 1);
      assert.equal((markup.match(/id="mindrian-face"/g) || []).length, 1);
      assert.ok(markup.indexOf('id="mindrian-identity"') < markup.indexOf('id="app"'),
        name + ' keeps identity outside replaced content');
      assert.match(html, /Larry \| MindrianOS/);
      assert.match(html, /Powered by Claude/);
      const domains = resource._meta.ui.csp.resourceDomains;
      assert.ok(domains.includes('https://cdn.jsdelivr.net'));
      assert.ok(domains.includes('https://fonts.googleapis.com'));
      assert.ok(domains.includes('https://fonts.gstatic.com'));
      if (name === 'room-graph') assert.ok(domains.includes('https://cdnjs.cloudflare.com'));
      const result = wire.responses.get(6 + i).result;
      assert.ok(!result.isError, name + ' reads only the synthetic room');
      const fallback = JSON.parse(result.content.find(item => item.type === 'text').text);
      assert.deepEqual(result.structuredContent, fallback);
      assert.equal(result.structuredContent.sections[0].articles[0].title, 'Synthetic question');
      records[name] = { html, result, input: inputFor(name) };
    }
    return records;
  } finally { fixture.cleanup(); }
}

async function browserChecks(records, faces) {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { throw Error('--browser needs an existing Playwright installation; no dependency is added by this suite'); }
  const sdk = fs.readFileSync(require.resolve('@modelcontextprotocol/ext-apps/app-with-deps'), 'utf8');
  const cdn = 'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js';
  const cache = path.join(os.tmpdir(), 'mindrian-cytoscape-3.28.1-test.js');
  if (!fs.existsSync(cache)) {
    const response = await fetch(cdn);
    assert.equal(response.status, 200, 'fetch the actual existing pinned Cytoscape runtime');
    fs.writeFileSync(cache, await response.text());
  }
  const cytoscape = fs.readFileSync(cache, 'utf8');
  const screenshots = path.join(os.tmpdir(), 'mindrian-larry-identity-20261011');
  fs.mkdirSync(screenshots, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('@modelcontextprotocol/ext-apps@2.0.3/') && url.endsWith('app-with-deps.js')) {
      if (await page.evaluate(() => window.blockSdk || false)) return route.abort();
      return route.fulfill({ contentType: 'text/javascript', body: sdk });
    }
    if (url === cdn) return route.fulfill({ contentType: 'text/javascript', body: cytoscape });
    if (url.startsWith('https://fonts.googleapis.com/')) return route.fulfill({ contentType: 'text/css', body: '' });
    if (url === 'http://mindrian-host.test/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body style="margin:0"></body></html>' });
    return route.abort(); // The host pass has no other network access.
  });

  async function open(name, options = {}) {
    await page.goto('http://mindrian-host.test/');
    await page.evaluate(({ record, width, failConnect, blockSdk, cancelInitial }) => {
      window.blockSdk = blockSdk;
      window.hostMessages = [];
      window.pendingCalls = [];
      const iframe = document.createElement('iframe');
      iframe.style = 'width:' + width + 'px;height:700px;border:0;display:block';
      iframe.setAttribute('sandbox', 'allow-scripts');
      const send = value => iframe.contentWindow.postMessage({ jsonrpc: '2.0', ...value }, '*');
      window.deliver = result => send({ method: 'ui/notifications/tool-result', params: result });
      window.finishRefresh = result => {
        const message = window.pendingCalls.shift();
        if (!message) throw Error('No pending refresh');
        send({ id: message.id, result });
      };
      window.rejectRefresh = () => {
        const message = window.pendingCalls.shift();
        if (!message) throw Error('No pending refresh');
        send({ id: message.id, error: { code: -32603, message: 'Synthetic refresh failure' } });
      };
      window.addEventListener('message', event => {
        if (event.source !== iframe.contentWindow) return;
        const message = event.data;
        window.hostMessages.push(message);
        if (message.method === 'ui/initialize') {
          if (failConnect) return send({ id: message.id, error: { code: -32603, message: 'Synthetic connection failure' } });
          // Deliver before the initialize response: an App that waits to install
          // callbacks until connect() finishes must lose this notification.
          send({ method: 'ui/notifications/tool-input', params: { arguments: record.input } });
          if (cancelInitial) send({ method: 'ui/notifications/tool-cancelled', params: { reason: 'Synthetic cancellation' } });
          else window.deliver(record.result);
          send({ id: message.id, result: {
            protocolVersion: message.params.protocolVersion,
            hostInfo: { name: 'test-claude-host', version: '1' },
            hostCapabilities: { serverTools: {}, updateModelContext: { text: {} } },
            hostContext: { theme: 'dark', displayMode: 'inline' },
          } });
        } else if (message.method === 'tools/call') {
          window.pendingCalls.push(message);
        } else if (message.id !== undefined && message.method) {
          send({ id: message.id, result: {} });
        }
      });
      iframe.srcdoc = record.html;
      document.body.append(iframe);
    }, { record: records[name], width: options.width || 900, failConnect: !!options.failConnect, blockSdk: !!options.blockSdk,
      cancelInitial: !!options.cancelInitial });
    if (!options.blockSdk) {
      await page.waitForFunction(() => window.hostMessages.some(message => message.method === 'ui/initialize'));
    }
    const frame = page.frames().find(frame => frame.parentFrame());
    assert.ok(frame);
    return frame;
  }
  async function state(frame, expected) {
    await frame.waitForFunction(expected => document.getElementById('mindrian-face')?.dataset.state === expected,
      expected, { timeout: 5000 });
  }
  async function layout(frame, name, width) {
    const measurement = await frame.evaluate(() => {
      const identity = document.getElementById('mindrian-identity');
      const box = identity.getBoundingClientRect();
      const status = document.getElementById('mindrian-status');
      const app = document.getElementById('app');
      return { fits: document.documentElement.scrollWidth <= innerWidth,
        left: box.left, right: box.right, width: innerWidth, top: box.top,
        statusRole: status.getAttribute('role'), label: identity.textContent,
        outside: !app.contains(identity), animations: identity.getAnimations({ subtree: true }).length,
        clippedControls: Array.from(app.querySelectorAll('button')).filter(button => {
          const rect = button.getBoundingClientRect();
          return rect.width && (rect.left < -1 || rect.right > innerWidth + 1);
        }).map(button => button.textContent.trim()),
      };
    });
    assert.ok(measurement.fits && measurement.left >= 0 && measurement.right <= width, name + ' fits ' + width + 'px');
    assert.ok(measurement.outside);
    assert.equal(measurement.statusRole, 'status');
    assert.match(measurement.label, /Larry \| MindrianOS/);
    assert.match(measurement.label, /Powered by Claude/);
    assert.equal(measurement.animations, 0, 'canonical identity has no animation under reduced motion');
    assert.deepEqual(measurement.clippedControls, [], 'action controls fit the frame');
    await frame.locator('body').screenshot({ path: path.join(screenshots, name + '-' + width + '.png') });
  }

  try {
    for (const name of VIEWS) {
      await check(name + ': early initial result, retained input, refresh, failure, and recovery through real SDK', async () => {
        const frame = await open(name);
        await state(frame, 'rest');
        assert.match(await frame.locator('#app').innerText(), /room-267/);
        assert.equal(await frame.locator('#mindrian-identity').count(), 1);
        await frame.evaluate(() => document.getElementById('mindrian-identity').dataset.persist = 'original');
        await layout(frame, name, 900);
        await frame.evaluate(() => { void window.MindrianView.refresh(); });
        await state(frame, 'think');
        await page.waitForFunction(() => window.pendingCalls.length === 1);
        const call = await page.evaluate(() => window.pendingCalls[0]);
        assert.equal(call.params.name, name);
        assert.deepEqual(call.params.arguments, records[name].input, 'refresh reads the same explicitly selected room');
        const updated = { structuredContent: { ...records[name].result.structuredContent, name: 'Updated synthetic room' },
          content: [{ type: 'text', text: '{bad JSON' }] };
        await page.evaluate(result => window.finishRefresh(result), updated);
        await state(frame, 'rest');
        assert.match(await frame.locator('#app').innerText(), /Updated synthetic room/);
        assert.equal(await frame.locator('#mindrian-identity').getAttribute('data-persist'), 'original');
        for (const result of [
          { isError: true, content: [{ type: 'text', text: 'Synthetic room refused' }] },
          { content: [{ type: 'text', text: '{bad JSON' }] },
          { structuredContent: { sections: 'invalid', stats: {} }, content: [] },
          { structuredContent: { ...records[name].result.structuredContent,
            ...(name === 'room-graph' ? { graphEdges: [null] } : { sections: [null] }) }, content: [] },
        ]) {
          await page.evaluate(result => window.deliver(result), result);
          await state(frame, 'could');
          assert.ok((await frame.locator('#mindrian-status').innerText()).trim().length,
            'the actual failure is explained visibly');
          await page.evaluate(result => window.deliver(result), records[name].result);
          await state(frame, 'rest');
        }
        await frame.evaluate(() => { void window.MindrianView.refresh(); });
        await state(frame, 'think');
        await page.waitForFunction(() => window.pendingCalls.length === 1);
        await page.evaluate(() => window.rejectRefresh());
        await state(frame, 'could');
        await page.evaluate(result => window.deliver({ content: result.content }), records[name].result);
        await state(frame, 'rest');
        assert.match(await frame.locator('#app').innerText(), /room-267/);
      });
      await check(name + ': mobile controls and persistent canonical header', async () => {
        const frame = await open(name, { width: 390 });
        await state(frame, 'rest');
        await layout(frame, name, 390);
      });
    }
    await check('all canonical faces remain accessible and static in the live header', async () => {
      const frame = await open('room-dashboard');
      await state(frame, 'rest');
      for (const id of [...LARRY_IDS, ...THEO_IDS]) {
        await frame.evaluate(id => window.MindrianIdentity.setState(id, 'Canonical preview: ' + id), id);
        await state(frame, id);
        assert.equal(await frame.locator('#mindrian-face svg').getAttribute('data-state'), id);
        assert.match(await frame.locator('#mindrian-face svg').getAttribute('aria-label'), /\S/);
        const observed = await frame.evaluate(() => {
          const svg = document.querySelector('#mindrian-face svg');
          const rects = Array.from(svg.querySelectorAll('rect'));
          const number = (rect, name) => Number(rect.getAttribute(name));
          const eye = rect => [number(rect, 'x') + number(rect, 'width') / 2,
            number(rect, 'y') + number(rect, 'height') / 2, number(rect, 'width'), number(rect, 'height')];
          return { e1: eye(rects[5]), e2: eye(rects[6]),
            bar: [number(rects[4], 'height'), number(rects[4], 'width')],
            transform: svg.querySelector('g').getAttribute('transform').match(/-?\d+(?:\.\d+)?/g).map(Number),
            rule: [number(rects[2], 'x') + number(rects[2], 'width') / 2,
              number(rects[3], 'y') + number(rects[3], 'height') / 2],
            plane: rects[1].getAttribute('fill') };
        });
        const pose = faces.POSES[id === 'reframe' ? 'rf2' : id];
        assert.deepEqual(observed, { e1: pose.e1, e2: pose.e2, bar: pose.s.slice(3),
          transform: pose.s.slice(0, 3), rule: pose.r, plane: pose.plane }, id + ' renders its canonical pose');
      }
      await frame.evaluate(() => window.MindrianIdentity.setState('reframe', 'Canonical reframe'));
      await frame.locator('#mindrian-identity').screenshot({ path: path.join(screenshots, 'canonical-reframe.png') });
    });
    await check('cancellation during initialization stays cancelled after connection', async () => {
      const frame = await open('room-dashboard', { cancelInitial: true });
      await state(frame, 'could');
      await page.waitForFunction(() => window.hostMessages.some(message => message.method === 'ui/notifications/initialized'));
      // The connected refresh proves connect() completed without replacing the
      // cancellation with an indefinite waiting state.
      assert.match(await frame.locator('#mindrian-status').innerText(), /cancelled/);
      await frame.evaluate(() => { void window.MindrianView.refresh(); });
      await state(frame, 'think');
      await page.waitForFunction(() => window.pendingCalls.length === 1);
      await page.evaluate(result => window.finishRefresh(result), records['room-dashboard'].result);
      await state(frame, 'rest');
    });
    await check('connection rejection and blocked SDK show the honest limit', async () => {
      for (const options of [{ failConnect: true }, { blockSdk: true }]) {
        const frame = await open('room-dashboard', options);
        await state(frame, 'could');
        assert.match(await frame.locator('#mindrian-status').innerText(), /connect|bridge|load|unavailable/i);
        assert.match(await frame.locator('#mindrian-identity').innerText(), /Larry \| MindrianOS/);
      }
    });
    assert.deepEqual(errors, [], 'no uncaught app exceptions');
    process.stdout.write('Screenshots: ' + screenshots + '\n');
  } finally { await browser.close(); }
}

(async () => {
  let faces, records;
  await check('all Larry and Theo state definitions retain canonical provenance and geometry', () => { faces = canonicalChecks(); });
  await check('actual MCP initialize, resources, CSP, and room tools deliver branded state', async () => { records = await wireViews(); });
  if (process.argv.includes('--browser')) await browserChecks(records, faces);
  process.stdout.write(passed + ' checks passed\n');
})().catch(error => {
  process.stderr.write(error.stack + '\n');
  process.exitCode = 1;
});
