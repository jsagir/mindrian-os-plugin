'use strict';
/*
 * tests/e2e-369/lib/pw.cjs -- Phase 369-04 shared Playwright entry for every
 * Phase 369 e2e leg. Helpers only, no test logic.
 *
 *   resolvePlaywright()        the playwright module, or null when absent
 *   requirePlaywrightOrSkip()  the module, or print an ENV GAP line and exit 77
 *   launch(opts)               headless Chromium: { pw, browser }
 *   captureEgress(page)        records every request, websocket and
 *                              EventSource-backed fetch host; { hosts(), urls() }
 *   assertOnlyLoopback(cap)    throws naming the first non-127.0.0.1 host
 *
 * Playwright is not a root dependency (walled packages only, RULE 8). It is
 * resolved from the spike-local install first, then the repo, so a walled dev
 * package can supply it later.
 *
 * Canon Part 8: the egress capture is how the e2e legs prove the shell talks
 * to loopback only. Hyphens only; no em-dashes.
 */

const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SKIP_EXIT_CODE = 77;

function resolvePlaywright() {
  const paths = [
    path.join(REPO_ROOT, '.planning', 'spikes', '006-room-pull-checkpoint'),
    REPO_ROOT,
  ];
  let resolved;
  try {
    resolved = require.resolve('playwright', { paths });
  } catch (_e) {
    return null;
  }
  try {
    return require(resolved);
  } catch (_e) {
    return null;
  }
}

function requirePlaywrightOrSkip() {
  const pw = resolvePlaywright();
  if (!pw) {
    console.log('SKIPPED (ENV GAP): Playwright not installed (spike 006 install or a walled dev package)');
    process.exit(SKIP_EXIT_CODE);
  }
  return pw;
}

async function launch(opts) {
  const pw = requirePlaywrightOrSkip();
  const browser = await pw.chromium.launch(Object.assign({ headless: true }, opts || {}));
  return { pw, browser };
}

function hostOf(url) {
  try {
    const u = new URL(url);
    // data: and blob: and about: carry no host and make no network call.
    if (!u.host) return null;
    return u.host;
  } catch (_e) {
    return null;
  }
}

function captureEgress(page) {
  const urls = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  page.on('websocket', (ws) => {
    urls.push(ws.url());
  });
  return {
    urls() {
      return urls.slice();
    },
    hosts() {
      const seen = [];
      for (const u of urls) {
        const h = hostOf(u);
        if (h && seen.indexOf(h) === -1) seen.push(h);
      }
      return seen;
    },
  };
}

function isLoopbackHost(host) {
  // host includes the port, for example 127.0.0.1:4173
  return host === '127.0.0.1' || host.indexOf('127.0.0.1:') === 0;
}

function assertOnlyLoopback(capture) {
  for (const h of capture.hosts()) {
    if (!isLoopbackHost(h)) {
      throw new Error('egress to a non-loopback host: ' + h);
    }
  }
}

module.exports = {
  resolvePlaywright,
  requirePlaywrightOrSkip,
  launch,
  captureEgress,
  assertOnlyLoopback,
  SKIP_EXIT_CODE,
};
