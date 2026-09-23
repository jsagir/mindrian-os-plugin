'use strict';
// Tests the shipped browser code against a disposable copy of POC data.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require('/home/jsagi/node_modules/playwright');
const repo = path.resolve(__dirname, '../../..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-354-browser-'));
const poc = path.join(repo, 'docs/reviews/localhost-poc');
for (const f of ['server.cjs', 'app.js', 'styles.css', 'index.html', 'data']) fs.cpSync(path.join(poc, f), path.join(scratch, f), { recursive: true });
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
(async () => {
  const reservation = http.createServer();
  const port = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const env = { ...process.env, MINDRIAN_POC_PORT: String(port) };
  delete env.MINDRIAN_POC_ROOM;
  const child = spawn(process.execPath, [path.join(scratch, 'server.cjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser, attacker;
  try {
    await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); child.once('exit', code => reject(Error('server exited ' + code))); });
    browser = await chromium.launch();

    // 354-08 note: the POC now serves a strict CSP (script-src 'self',
    // T-354-16/T-354-17 hardening), which correctly refuses Playwright's
    // addScriptTag inline-injection idiom. That CSP is the product of THIS
    // plan's own fix, so the chat-panel XSS probe below (a 354-07/SYS-03
    // concern, unrelated to the POC's save/origin model) runs against a
    // separate, CSP-free static page instead of the hardened POC origin --
    // decoupling the two concerns cleanly rather than weakening the POC's
    // CSP to accommodate a probe tool. The authoritative regression for
    // this check is tests/test-354-chat-inert-render.cjs, which uses the
    // same CSP-free-page pattern already.
    const chatProbeServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><html><head></head><body></body></html>');
    });
    const chatProbePort = await listen(chatProbeServer);
    const chatPage = await browser.newPage();
    await chatPage.goto(`http://127.0.0.1:${chatProbePort}`);
    await chatPage.addScriptTag({ path: path.join(repo, 'lib/chat/chat-panel.js') });
    await chatPage.evaluate(() => {
      window.researchExecuted = false;
      const panel = Object.create(ChatPanel.prototype);
      panel._msgList = document.body;
      panel._scrollToBottom = () => {};
      panel._renderMessage('assistant', '<img src="/missing-probe-image" onerror="window.researchExecuted=true">');
    });
    // 354-08 note: 354-07 already landed the chat-panel inert-render fix
    // (escape-first renderMarkdown), so `researchExecuted` now correctly
    // stays false on a fixed checkout -- waiting for it to become true
    // would hang forever post-354-07. Wait a bounded interval and record
    // whatever value actually resulted instead of gating on the pre-354-07
    // vulnerable outcome.
    await chatPage.waitForTimeout(500);
    console.log(JSON.stringify({ probe: 'assistant-html', executed: await chatPage.evaluate(() => window.researchExecuted) }));
    await chatPage.close();
    await new Promise((resolve) => chatProbeServer.close(resolve));

    const page = await browser.newPage();
    await page.goto(origin);
    await page.locator('#editor').waitFor();
    const markdown = '# Heading\nThis sentence must survive.\n\n- alpha\n- beta\n\nline one\nline two\n';
    fs.writeFileSync(path.join(scratch, 'data/workspace.md'), markdown);
    await page.reload();
    await page.locator('#editor').waitFor();
    // 354-08 note: post-fix, an untouched save does not POST at all (it sets
    // #save-state to "No changes to save" and stops) -- so waiting for
    // "just now" specifically would hang forever on the fixed POC. Wait for
    // the text to change from its pre-click value instead, which covers
    // both the pre-fix "Saved revision just now" path and the post-fix
    // no-op path; the file-bytes comparison below is the actual assertion.
    const saveStateBefore = await page.locator('#save-state').textContent();
    await page.locator('#save').click();
    await page.waitForFunction((prev) => {
      const el = document.getElementById('save-state');
      return !!el && el.textContent !== prev;
    }, saveStateBefore);
    const saved = fs.readFileSync(path.join(scratch, 'data/workspace.md'), 'utf8');
    console.log(JSON.stringify({ probe: 'save-without-edit', before: markdown, after: saved, preserved: markdown === saved }));
    attacker = http.createServer((req, res) => res.end('<!doctype html><title>synthetic other origin</title>'));
    const attackerPort = await listen(attacker);
    await page.goto(`http://127.0.0.1:${attackerPort}`);
    await page.evaluate(async target => { await fetch(target + '/api/document', { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ markdown: 'SYNTHETIC_CROSS_ORIGIN_WRITE' }) }); }, origin);
    console.log(JSON.stringify({ probe: 'cross-origin-browser-write', changed: fs.readFileSync(path.join(scratch, 'data/workspace.md'), 'utf8') === 'SYNTHETIC_CROSS_ORIGIN_WRITE' }));
  } finally {
    if (browser) await browser.close();
    if (attacker) await new Promise(resolve => attacker.close(resolve));
    child.kill('SIGINT');
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
