#!/usr/bin/env node
'use strict';
/*
 * tests/test-354-chat-inert-render.cjs -- Phase 354-07 (SYS-03 / SYS-06 sub-finding 1).
 *
 * Browser-level regression proving lib/chat/chat-panel.js's renderMarkdown and
 * lib/chat/generative-tools.js's component renderers are INERT against a model-
 * supplied payload, on the real ChatPanel/GenerativeTools prototype methods (not a
 * reimplementation) -- seeded from docs/reviews/phase-354-probes/browser.cjs's
 * addScriptTag + Object.create(ChatPanel.prototype) + _renderMessage pattern
 * (lines 25-37 there).
 *
 * The two layers that disagree (354-CONTEXT.md CTX-POC sub-finding 1, handoff
 * SYS-03): renderMarkdown's assumption that assistant text is trusted, versus the
 * page holding the visitor's Anthropic API key in localStorage (chat-panel.js
 * KEY_API = 'mos-api-key'). _renderMessage (chat-panel.js ~379) and the streamed
 * content_block_delta branch (chat-panel.js ~539) both assign
 * `innerHTML = renderMarkdown(...)` -- same private closure function, same fix,
 * both call sites. renderMarkdown is not exported as a standalone seam and the
 * streamed branch only runs inside a real fetch() SSE loop, so P6 below drives
 * _renderMessage and relies on that call-site identity rather than reaching into
 * the network path (documented at P6, per the plan's own fallback instruction).
 *
 * RED-PROOF (against the pre-fix chat-panel.js/generative-tools.js): P1 fails
 * because renderMarkdown's bold/italic/inline-code transforms insert their
 * captured groups directly (no escaping ever runs before an <img onerror=...>
 * payload is assigned through innerHTML), so the payload becomes a real DOM
 * element and its onerror handler fires. P2, P4 and P7's non-hex-color check fail
 * for the same class of reason (see inline comments at each case below).
 *
 * Plain-Node harness (tests/test-354-write-lock-ownership.cjs shape): a local
 * ok(label)/fail(label, err) counter pair, a leading log line, a trailing PASS/FAIL
 * summary, process.exitCode = 1 on any failure, process.exit(77) on ENV GAP (never
 * exit 0 when Playwright cannot resolve). Hyphens only, no em-dashes (CLAUDE.md).
 */

const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { resolvePlaywright } = require(path.join(__dirname, 'helpers', 'playwright-354.cjs'));

const REPO = path.resolve(__dirname, '..');
const CHAT_PANEL_PATH = path.join(REPO, 'lib', 'chat', 'chat-panel.js');
const GENERATIVE_TOOLS_PATH = path.join(REPO, 'lib', 'chat', 'generative-tools.js');
const KEY_API = 'mos-api-key'; // exact storage key from lib/chat/chat-panel.js:154

console.log('test-354-chat-inert-render');

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

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

(async () => {
  const pw = resolvePlaywright();
  if (!pw) {
    console.log('ENV GAP: playwright unavailable');
    process.exit(77);
    return;
  }
  const { chromium } = pw;

  // Real http origin (not file://) so localStorage behaves like a deployed
  // presentation page -- matches the probe's own origin setup.
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><html><head></head><body><div id="app"></div></body></html>');
  });
  const port = await listen(server);
  const origin = 'http://127.0.0.1:' + port;

  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(origin);
    await page.addScriptTag({ path: CHAT_PANEL_PATH });
    await page.addScriptTag({ path: GENERATIVE_TOOLS_PATH });

    // Seed the visitor API key + a bare ChatPanel prototype instance -- no
    // constructor call, no DOM chrome, exactly what the probe does: _msgList and a
    // no-op scroller.
    await page.evaluate((keyName) => {
      localStorage.setItem(keyName, 'SYNTHETIC_KEY');
      window.__pwned = false;
      var container = document.createElement('div');
      document.body.appendChild(container);
      window.__panel = Object.create(ChatPanel.prototype);
      window.__panel._msgList = container;
      window.__panel._scrollToBottom = function () {};
    }, KEY_API);

    async function renderCase(text) {
      await page.evaluate((t) => {
        window.__pwned = false;
        window.__panel._msgList.innerHTML = '';
        window.__panel._renderMessage('assistant', t);
      }, text);
      await page.waitForTimeout(300);
      return readResult(page);
    }

    async function componentCase(component) {
      await page.evaluate((comp) => {
        window.__pwned = false;
        window.__panel._msgList.innerHTML = '';
        var html = GenerativeTools.renderComponent(comp);
        window.__lastComponentHtml = html;
        var el = document.createElement('div');
        el.innerHTML = html;
        window.__panel._msgList.appendChild(el);
      }, component);
      await page.waitForTimeout(300);
      const result = await readResult(page);
      result.html = await page.evaluate(() => window.__lastComponentHtml);
      return result;
    }

    async function readResult(pageRef) {
      const pwned = await pageRef.evaluate(() => window.__pwned);
      const badAttr = await pageRef.evaluate(() => {
        var els = window.__panel._msgList.querySelectorAll('*');
        for (var i = 0; i < els.length; i++) {
          var attrs = els[i].attributes;
          for (var j = 0; j < attrs.length; j++) {
            if (attrs[j].name.toLowerCase().indexOf('on') === 0) return attrs[j].name;
          }
        }
        return null;
      });
      return { pwned, badAttr };
    }

    function assertInert(label, result) {
      try {
        assert.strictEqual(result.pwned, false, label + ': payload must not execute (window.__pwned)');
        assert.strictEqual(result.badAttr, null, label + ': no on* attribute may land in the DOM (found ' + result.badAttr + ')');
        ok(label);
      } catch (e) {
        fail(label, e);
      }
    }

    // P1 -- whole-message path, the exact probe payload
    // (docs/reviews/phase-354-probes/browser.cjs:35). Pre-fix: no transform in
    // renderMarkdown escapes plain text with no markdown syntax, so the img element
    // is created verbatim and onerror fires. THIS IS THE RED CASE.
    assertInert('P1: whole-message img onerror', await renderCase('<img src="/missing-probe-image" onerror="window.__pwned=true">'));

    // P2 -- inline code. Pre-fix: the inline-code regex inserts its capture group
    // ($1) directly with no escaping, so the img element still executes even though
    // it is textually "inside backticks".
    assertInert('P2: inline-code img onerror', await renderCase('see `<img src=/m onerror="window.__pwned=true">` here'));

    // P3 -- fenced block. The fence extraction already called escapeHtml(code.trim())
    // pre-fix too, so this case is expected to already be inert; kept as a permanent
    // regression lock alongside P1/P2/P4.
    assertInert('P3: fenced-block script', await renderCase('```\n<script>window.__pwned=true</script>\n```'));

    // P4 -- bold wrapper. Pre-fix: same unescaped-capture-group issue as P2.
    assertInert('P4: bold-wrapped img onerror', await renderCase('**<img src=/m onerror="window.__pwned=true">**'));

    // P5 -- attribute-break text inside bold and italic markers. No real HTML
    // attribute context exists for this text to break out of (it lands as element
    // text content, not an attribute value), so this is a permanent regression lock
    // rather than a RED case -- kept per the plan's required case list.
    assertInert('P5a: bold attribute-break text', await renderCase('**x" onmouseover="window.__pwned=true**'));
    assertInert('P5b: italic attribute-break text', await renderCase('*x" onmouseover="window.__pwned=true*'));

    // P6 -- streamed path. renderMarkdown is a private closure var, not exported as
    // a standalone seam; _renderMessage (chat-panel.js ~379) and the
    // content_block_delta branch (chat-panel.js ~539) both call the SAME
    // renderMarkdown and both assign the result through innerHTML. Proving
    // _renderMessage is inert proves the streamed call site is inert too, since
    // fixing renderMarkdown once fixes both. See file-header comment.
    assertInert('P6: streamed path (via renderMarkdown identity, see comment)', await renderCase('<img src=/m onerror="window.__pwned=true"> streamed'));

    // P7 -- tool component: insight-card title/label attribute-break attempt, plus a
    // non-hex color value (CSS-injection vector T-354-15). title/label/value already
    // route through generative-tools.js's escapeHtml (which already escapes '"'), so
    // the attribute-break attempt is a permanent regression lock; the non-hex color
    // is the RED half of this case (pre-fix it passes straight through to the style
    // attribute, unvalidated).
    const p7 = await componentCase({
      type: 'insight-card',
      title: '<img src=/m onerror="window.__pwned=true">',
      items: [
        { label: 'x" onmouseover="window.__pwned=true', value: 'v', color: 'red;background-image:url(/leak)' }
      ],
      footer: ''
    });
    assertInert('P7: insight-card title/label attribute-break', p7);
    try {
      assert.ok(p7.html.indexOf('background-image') === -1, 'P7: non-hex color must be dropped, not passed through to style (safeColor)');
      ok('P7: non-hex color dropped from rendered component (safeColor)');
    } catch (e) {
      fail('P7: non-hex color dropped from rendered component (safeColor)', e);
    }

    // F1 -- formatting must survive: bold, italic, inline code, fenced code, list item.
    await page.evaluate(() => {
      window.__panel._msgList.innerHTML = '';
      window.__panel._renderMessage('assistant', '**bold** *it* `code`\n```\nfenced content\n```\n- item one');
    });
    await page.waitForTimeout(200);
    const f1 = await page.evaluate(() => {
      var ml = window.__panel._msgList;
      return {
        strong: ml.querySelectorAll('strong').length,
        em: ml.querySelectorAll('em').length,
        code: ml.querySelectorAll('code').length,
        pre: ml.querySelectorAll('pre').length,
        li: ml.querySelectorAll('li').length
      };
    });
    try {
      assert.strictEqual(f1.strong, 1, 'F1: exactly one <strong> (got ' + f1.strong + ')');
      assert.strictEqual(f1.em, 1, 'F1: exactly one <em> (got ' + f1.em + ')');
      assert.ok(f1.code >= 1, 'F1: at least one <code> (got ' + f1.code + ')');
      assert.strictEqual(f1.pre, 1, 'F1: exactly one <pre> (got ' + f1.pre + ')');
      assert.strictEqual(f1.li, 1, 'F1: exactly one <li> (got ' + f1.li + ')');
      ok('F1: formatting survives (strong/em/code/pre/li)');
    } catch (e) {
      fail('F1: formatting survives (strong/em/code/pre/li)', e);
    }
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
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
