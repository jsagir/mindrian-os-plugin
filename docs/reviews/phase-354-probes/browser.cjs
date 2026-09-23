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
    const page = await browser.newPage();
    await page.goto(origin);
    await page.locator('#editor').waitFor();
    await page.addScriptTag({ path: path.join(repo, 'lib/chat/chat-panel.js') });
    await page.evaluate(() => {
      window.researchExecuted = false;
      const panel = Object.create(ChatPanel.prototype);
      panel._msgList = document.body;
      panel._scrollToBottom = () => {};
      panel._renderMessage('assistant', '<img src="/missing-probe-image" onerror="window.researchExecuted=true">');
    });
    await page.waitForFunction(() => window.researchExecuted === true);
    console.log(JSON.stringify({ probe: 'assistant-html', executed: await page.evaluate(() => window.researchExecuted) }));
    const markdown = '# Heading\nThis sentence must survive.\n\n- alpha\n- beta\n\nline one\nline two\n';
    fs.writeFileSync(path.join(scratch, 'data/workspace.md'), markdown);
    await page.reload();
    await page.locator('#editor').waitFor();
    await page.locator('#save').click();
    await page.waitForFunction(() => document.getElementById('save-state').textContent.includes('just now'));
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
