#!/usr/bin/env node
'use strict';
/*
 * tests/test-354-poc-save-origin.cjs -- Phase 354-08 (SYS-06 sub-findings 2+3).
 *
 * Playwright + raw-HTTP regression for docs/reviews/localhost-poc/server.cjs and
 * app.js, seeded from docs/reviews/phase-354-probes/browser.cjs's scratch-copy +
 * spawn-with-reserved-port idiom (per Canon Part 7, reuse before build).
 *
 * The two layers that disagree (354-CONTEXT.md CTX-POC sub-findings 2+3, handoff
 * SYS-06): app.js:3-4's HTML<->Markdown round trip versus the file's exact bytes
 * (an untouched document must not change on save), and server.cjs:45-60's
 * "localhost is trusted" assumption versus a browser's ability to send
 * cross-origin simple requests (a foreign page must not be able to write or read).
 *
 * RED-PROOF (against the pre-fix POC): S1 fails because markdownToHtml/
 * htmlToMarkdown do not round-trip losslessly (heading/list/line-break shape
 * changes even with no edit). S2 fails because server.cjs never checks Origin,
 * so a cross-origin no-cors POST still lands. S3 fails because server.cjs never
 * checks Host, so a forged Host header still gets 200. S4-S6 also fail pre-fix
 * (no token/revision/size-cap concept exists yet) -- expected, not required by
 * the plan's acceptance criteria, but consistent with test-first discipline.
 *
 * Plain-Node harness (tests/test-354-chat-inert-render.cjs shape): a local
 * ok(label)/fail(label, err) counter pair, a leading log line, a trailing PASS/FAIL
 * summary, process.exitCode = 1 on any failure, process.exit(77) on ENV GAP (never
 * exit 0 when Playwright cannot resolve). Hyphens only, no em-dashes (CLAUDE.md).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { resolvePlaywright } = require(path.join(__dirname, 'helpers', 'playwright-354.cjs'));

const REPO = path.resolve(__dirname, '..');
const POC = path.join(REPO, 'docs/reviews/localhost-poc');

console.log('test-354-poc-save-origin');

let checks = 0;
let failed = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}
function fail(label, error) {
  failed += 1;
  console.log('  NOT OK - ' + label);
  console.log('    ' + (error && error.message ? error.message : String(error)));
}
function checkThat(label, fn) {
  try { fn(); ok(label); } catch (e) { fail(label, e); }
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

// node's built-in fetch (undici) silently ignores an explicit Host header
// override (it treats Host like a browser forbidden header), so it cannot
// forge a DNS-rebinding-style request. node:http's request API has no such
// guard -- it sends whatever Host header is passed, which is exactly what a
// real rebinding attacker's TCP connection would look like from the
// server's point of view. Used only where a forged Host is the point (S3);
// everything else uses plain fetch.
function rawRequest(targetUrl, options) {
  const opts = options || {};
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: opts.headers || {},
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (opts.body != null) req.write(opts.body);
    req.end();
  });
}

async function reservePort() {
  const s = http.createServer();
  const port = await listen(s);
  await new Promise((resolve) => s.close(resolve));
  return port;
}

function makeScratchPoc(label) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-354-poc-' + label + '-'));
  for (const f of ['server.cjs', 'app.js', 'styles.css', 'index.html', 'data']) {
    fs.cpSync(path.join(POC, f), path.join(scratch, f), { recursive: true });
  }
  return scratch;
}

function spawnServer(scratch, port) {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, { MINDRIAN_POC_PORT: String(port) });
    delete env.MINDRIAN_POC_ROOM;
    const child = spawn(process.execPath, [path.join(scratch, 'server.cjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let settled = false;
    const onData = () => {
      if (settled) return;
      settled = true;
      child.stdout.removeListener('data', onData);
      resolve(child);
    };
    child.stdout.on('data', onData);
    child.once('error', (e) => { if (!settled) { settled = true; reject(e); } });
    child.once('exit', (code) => { if (!settled) { settled = true; reject(new Error('server exited ' + code)); } });
  });
}

// Waits for #save-state's text to change from whatever it held before the
// save click -- covers both the pre-fix "Saved revision just now"/"Save
// failed" text and the post-fix "No changes to save" no-op path uniformly.
async function clickSaveAndWait(page) {
  const before = await page.locator('#save-state').textContent();
  await page.locator('#save').click();
  await page.waitForFunction((prev) => {
    const el = document.getElementById('save-state');
    return !!el && el.textContent !== prev;
  }, before, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  return page.locator('#save-state').textContent();
}

(async () => {
  const pw = resolvePlaywright();
  if (!pw) {
    console.log('ENV GAP: playwright unavailable');
    process.exit(77);
    return;
  }
  const { chromium } = pw;

  const port = await reservePort();
  const scratch = makeScratchPoc('save-origin');
  const documentPath = path.join(scratch, 'data', 'workspace.md');
  const origin = 'http://127.0.0.1:' + port;
  const hostHeader = '127.0.0.1:' + port;

  async function fetchDocInfo() {
    const r = await fetch(origin + '/api/document', { headers: { Host: hostHeader } });
    try { return await r.json(); } catch (_e) { return {}; }
  }
  async function fetchToken() {
    const r = await fetch(origin + '/', { headers: { Host: hostHeader } });
    const html = await r.text();
    const m = html.match(/<meta name="mos-poc-token" content="([^"]*)"/);
    return m ? m[1] : '';
  }

  let child;
  let browser;
  let attacker;
  try {
    child = await spawnServer(scratch, port);
    browser = await chromium.launch();

    // ---- S1: round trip (save without an edit leaves bytes byte-identical) ----
    const ORIGINAL_MD = '# Heading\nThis sentence must survive.\n\n- alpha\n- beta\n\nline one\nline two\n';
    fs.writeFileSync(documentPath, ORIGINAL_MD);
    {
      const page = await browser.newPage();
      await page.goto(origin);
      await page.locator('#editor').waitFor();
      await clickSaveAndWait(page);
      const after = fs.readFileSync(documentPath, 'utf8');
      checkThat('S1: save-without-edit preserves bytes exactly (headings, list spacing, line breaks)', () => {
        assert.strictEqual(after, ORIGINAL_MD, 'file changed after a no-edit save');
      });
      await page.close();
    }

    // ---- S2: cross-origin browser write is rejected ----
    attacker = http.createServer((_req, res) => res.end('<!doctype html><title>synthetic other origin</title>'));
    const attackerPort = await listen(attacker);
    {
      const page = await browser.newPage();
      await page.goto('http://127.0.0.1:' + attackerPort);
      await page.evaluate(async (target) => {
        try {
          await fetch(target + '/api/document', {
            method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ markdown: 'SYNTHETIC_CROSS_ORIGIN_WRITE' }),
          });
        } catch (_e) { /* the point of this probe is the write attempt, not its resolution */ }
      }, origin);
      const afterNoCors = fs.readFileSync(documentPath, 'utf8');
      checkThat('S2a: cross-origin no-cors text/plain POST does not write', () => {
        assert.notStrictEqual(afterNoCors, 'SYNTHETIC_CROSS_ORIGIN_WRITE', 'no-cors cross-origin write succeeded');
      });

      await page.evaluate(async (target) => {
        try {
          await fetch(target + '/api/document', {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markdown: 'SYNTHETIC_CROSS_ORIGIN_CORS_WRITE' }),
          });
        } catch (_e) { /* blocked by CORS preflight/response is the expected outcome */ }
      }, origin);
      const afterCors = fs.readFileSync(documentPath, 'utf8');
      checkThat('S2b: cross-origin cors application/json POST does not write', () => {
        assert.notStrictEqual(afterCors, 'SYNTHETIC_CROSS_ORIGIN_CORS_WRITE', 'cors cross-origin write succeeded');
      });
      await page.close();
    }

    // ---- S3: foreign Host is refused on every route, reads included ----
    {
      const info = await fetchDocInfo();
      const getDoc = await rawRequest(origin + '/api/document', { headers: { Host: 'review.invalid' } });
      const getGraph = await rawRequest(origin + '/api/graph', { headers: { Host: 'review.invalid' } });
      const postDoc = await rawRequest(origin + '/api/document', {
        method: 'POST',
        headers: { Host: 'review.invalid', Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: 'SYNTHETIC_FOREIGN_HOST', base_revision: info.revision || '' }),
      });
      checkThat('S3a: GET /api/document refuses foreign Host (403/421)', () => {
        assert.ok([403, 421].includes(getDoc.status), 'got ' + getDoc.status);
      });
      checkThat('S3b: GET /api/graph refuses foreign Host (403/421)', () => {
        assert.ok([403, 421].includes(getGraph.status), 'got ' + getGraph.status);
      });
      checkThat('S3c: POST /api/document refuses foreign Host (403/421)', () => {
        assert.ok([403, 421].includes(postDoc.status), 'got ' + postDoc.status);
      });
      const onDisk = fs.readFileSync(documentPath, 'utf8');
      checkThat('S3d: file unchanged after foreign-Host POST attempt', () => {
        assert.notStrictEqual(onDisk, 'SYNTHETIC_FOREIGN_HOST', 'foreign-Host POST wrote to the file');
      });
    }

    // ---- S4: same-origin POST with correct Origin/JSON but no/wrong token ----
    {
      const info = await fetchDocInfo();
      const noTokenRes = await fetch(origin + '/api/document', {
        method: 'POST',
        headers: { Origin: origin, Host: hostHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: 'SYNTHETIC_NO_TOKEN', base_revision: info.revision || '' }),
      });
      checkThat('S4a: POST with no X-Mindrian-Poc-Token is refused (403)', () => {
        assert.strictEqual(noTokenRes.status, 403, 'got ' + noTokenRes.status);
      });
      const wrongTokenRes = await fetch(origin + '/api/document', {
        method: 'POST',
        headers: {
          Origin: origin, Host: hostHeader, 'Content-Type': 'application/json',
          'X-Mindrian-Poc-Token': 'wrong'.padEnd(64, '0'),
        },
        body: JSON.stringify({ markdown: 'SYNTHETIC_WRONG_TOKEN', base_revision: info.revision || '' }),
      });
      checkThat('S4b: POST with a wrong X-Mindrian-Poc-Token is refused (403)', () => {
        assert.strictEqual(wrongTokenRes.status, 403, 'got ' + wrongTokenRes.status);
      });
      const onDisk = fs.readFileSync(documentPath, 'utf8');
      checkThat('S4c: file unchanged by no-token or wrong-token POSTs', () => {
        assert.notStrictEqual(onDisk, 'SYNTHETIC_NO_TOKEN', 'no-token POST wrote to the file');
        assert.notStrictEqual(onDisk, 'SYNTHETIC_WRONG_TOKEN', 'wrong-token POST wrote to the file');
      });
    }

    // ---- S5: stale base_revision conflicts instead of silently overwriting ----
    {
      const pageA = await browser.newPage();
      const pageB = await browser.newPage();
      await pageA.goto(origin);
      await pageA.locator('#editor').waitFor();
      await pageB.goto(origin);
      await pageB.locator('#editor').waitFor();

      const CONTENT_A = '# Heading\nPage A wins this save.\n';
      const CONTENT_B = '# Heading\nPage B should conflict.\n';

      await pageA.locator('#editor').fill(CONTENT_A);
      await clickSaveAndWait(pageA);
      await pageB.locator('#editor').fill(CONTENT_B);
      const bStateText = await clickSaveAndWait(pageB);

      const onDisk = fs.readFileSync(documentPath, 'utf8');
      checkThat('S5a: page B is told its save conflicted (state/banner mentions "changed")', () => {
        assert.ok(/changed/i.test(bStateText || ''), 'save-state text was: ' + JSON.stringify(bStateText));
      });
      checkThat('S5b: file holds page A\'s content, not page B\'s stale overwrite', () => {
        assert.strictEqual(onDisk, CONTENT_A, 'file did not hold page A\'s winning save');
      });

      await pageA.close();
      await pageB.close();
    }

    // ---- S6: oversized document is capped, not written ----
    {
      const info = await fetchDocInfo();
      const token = await fetchToken();
      const before = fs.readFileSync(documentPath, 'utf8');
      const res = await fetch(origin + '/api/document', {
        method: 'POST',
        headers: {
          Origin: origin, Host: hostHeader, 'Content-Type': 'application/json',
          'X-Mindrian-Poc-Token': token,
        },
        body: JSON.stringify({ markdown: 'x'.repeat(1000001), base_revision: info.revision || '' }),
      });
      checkThat('S6a: a 1,000,001-character document is rejected (413)', () => {
        assert.strictEqual(res.status, 413, 'got ' + res.status);
      });
      const after = fs.readFileSync(documentPath, 'utf8');
      checkThat('S6b: file unchanged after an oversized POST attempt', () => {
        assert.strictEqual(after, before, 'file changed despite the size cap');
      });
    }

    // ---- S7: a real edit is preserved exactly ----
    {
      const page = await browser.newPage();
      await page.goto(origin);
      await page.locator('#editor').waitFor();
      const EDITED = 'Freshly edited content for S7.\n';
      await page.locator('#editor').fill(EDITED);
      await clickSaveAndWait(page);
      const onDisk = fs.readFileSync(documentPath, 'utf8');
      checkThat('S7: an actual edit is saved with exact bytes', () => {
        assert.strictEqual(onDisk, EDITED, 'edited content was not preserved exactly');
      });
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    if (attacker) await new Promise((resolve) => attacker.close(resolve));
    if (child) { try { child.kill('SIGINT'); } catch (_e) { /* ignore */ } }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }

  console.log('');
  if (failed > 0) {
    console.log('FAIL - ' + failed + ' of ' + (checks + failed) + ' checks failed (checks that ran: ' + checks + ')');
    process.exitCode = 1;
  } else {
    console.log('PASS - ' + checks + ' checks');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
