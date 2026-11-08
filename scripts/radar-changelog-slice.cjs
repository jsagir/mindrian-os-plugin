#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 391 plan 03 (CC391-H): the ask-first changelog read for /mos:radar.
 *
 * WHAT IT DOES, IN PLAIN WORDS
 * Download the Claude Code changelog once, cut it by version header with
 * lib/core/radar/changelog-slice.cjs, and print the complete entries newer than
 * a mark (the newest version the capability ledger already covers) together
 * with a coverage object that says whether every version down to the mark was
 * read. A read that stopped early exits 4 and says why. It never looks complete
 * when it is not.
 *
 * CANON PART 8 STATEMENT
 * The only network edge is one public GET of one fixed URL on one fixed host.
 * No room is read. No Brain call is made. The request carries no credential, no
 * cookie, no Authorization header and no environment value: only a user-agent
 * and an accept header. The script reads no environment value other than HOME,
 * USERPROFILE and the temp folder variables (through os.tmpdir). It writes
 * nothing inside the repo.
 *
 * PHASE 386 ASK-FIRST RULE (the same rule as the older web paths)
 *   - no flag, or a wrong token: nothing is sent, exit 3
 *   - --list: prints the exact URL, the mark and the approval token, sends nothing
 *   - --approve TOKEN: the token must be the one --list printed; then one GET
 *   - before the GET the shared credential check runs on the URL
 *   - after the GET one audit record is written (provider claude_changelog),
 *     whatever the outcome; the record holds the URL and no response byte
 *   - no content scan runs on this line
 * The audit folder is outside any room: HOME/.mindrian/radar-audit by default,
 * so a changelog read never lands in a user's research ledger.
 *
 * USAGE
 *   node scripts/radar-changelog-slice.cjs --list [--after VERSION] [--ledger PATH]
 *   node scripts/radar-changelog-slice.cjs --approve TOKEN [--after VERSION] [options]
 *   node scripts/radar-changelog-slice.cjs --file PATH [--after VERSION] [options]
 *
 * FLAGS
 *   --list              print url, host, after, token, note as JSON; send nothing
 *   --approve TOKEN     send one GET (TOKEN from --list)
 *   --file PATH         parse a local file; no network, no token, no audit record
 *   --after VERSION     the mark; default: ledger_covers.to of the ledger file
 *   --ledger PATH       ledger file for the mark (default data/capability-ledger.json)
 *   --max-chars N       read only the first N characters (a test of coverage)
 *   --max-bytes N       size cap for the download (default 8388608)
 *   --allow-partial     exit 0 on incomplete coverage (the output still says so)
 *   --audit-dir DIR     audit folder (default HOME/.mindrian/radar-audit)
 *   --keep              keep the downloaded temp file and print its path to stderr
 *   --help              print this text
 *
 * EXIT CODES
 *   0 done (complete, or partial with --allow-partial, or list mode)
 *   1 internal error
 *   2 usage error
 *   3 refused (no token, wrong token, credential-shaped value)
 *   4 coverage incomplete
 *   5 network failure; typed reason on stdout: http_status, redirect_refused,
 *     size_cap, timeout, network
 *
 * API: run(argv, deps) -> Promise<number>. deps (all optional, for tests):
 *   stdout(text), stderr(text), fetchImpl, auditDir, tmpDir.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const CHANGELOG_URL = 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';
const CHANGELOG_HOST = 'raw.githubusercontent.com';
const DEFAULT_MAX_BYTES = 8388608;
const TIMEOUT_MS = 30000;
const PROVIDER = 'claude_changelog';
const USER_AGENT = 'mindrian-os-radar/1';
const DEFAULT_LEDGER = path.join(__dirname, '..', 'data', 'capability-ledger.json');

class Typed extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}

function usageText() {
  return [
    'Usage: node scripts/radar-changelog-slice.cjs (--list | --approve TOKEN | --file PATH) [options]',
    '',
    'Reads the Claude Code changelog once and prints the entries newer than the mark,',
    'with a coverage object. Ask first: --list shows the URL and the token and sends nothing.',
    '',
    'Options: --after VERSION  --ledger PATH  --max-chars N  --max-bytes N',
    '         --allow-partial  --audit-dir DIR  --keep  --help',
    'Exit codes: 0 done, 1 internal, 2 usage, 3 refused, 4 incomplete coverage, 5 network failure',
    '',
  ].join('\n');
}

function parseArgs(argv) {
  const o = {
    list: false, approve: null, file: null, after: null, ledger: null,
    maxChars: null, maxBytes: DEFAULT_MAX_BYTES, allowPartial: false,
    auditDir: null, keep: false, help: false,
  };
  const valueFlags = ['--approve', '--file', '--after', '--ledger', '--max-chars', '--max-bytes', '--audit-dir'];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') o.list = true;
    else if (a === '--allow-partial') o.allowPartial = true;
    else if (a === '--keep') o.keep = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (valueFlags.indexOf(a) !== -1) {
      if (i + 1 >= argv.length) throw new Typed('usage', a + ' needs a value');
      const v = argv[++i];
      if (a === '--approve') o.approve = v;
      else if (a === '--file') o.file = v;
      else if (a === '--after') o.after = v;
      else if (a === '--ledger') o.ledger = v;
      else if (a === '--audit-dir') o.auditDir = v;
      else {
        if (!/^\d+$/.test(v) || Number(v) < 1) throw new Typed('usage', a + ' needs a positive integer');
        if (a === '--max-chars') o.maxChars = Number(v);
        else o.maxBytes = Number(v);
      }
    } else {
      throw new Typed('usage', 'unknown argument ' + a);
    }
  }
  return o;
}

function resolveMark(o, slicer) {
  if (o.after !== null) {
    if (!slicer.isDotted(o.after)) throw new Typed('usage', '--after must be a dotted triple such as 2.1.288');
    return o.after;
  }
  const file = o.ledger || DEFAULT_LEDGER;
  let to = null;
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    to = j && j.ledger_covers && j.ledger_covers.to;
  } catch (_e) {
    to = null;
  }
  if (!slicer.isDotted(to)) throw new Typed('usage', 'no mark: give --after VERSION or a ledger file with ledger_covers.to');
  return to;
}

// Read the body and stop at the size cap. A reader is used when the response offers one.
async function readBody(res, maxBytes) {
  const len = res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-length') : null;
  if (len && Number(len) > maxBytes) throw new Typed('size_cap', 'the answer is larger than ' + maxBytes + ' bytes');
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.length;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch (_e) { /* the cap already decided */ }
        throw new Typed('size_cap', 'the answer is larger than ' + maxBytes + ' bytes');
      }
      chunks.push(Buffer.from(part.value));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  const text = await res.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Typed('size_cap', 'the answer is larger than ' + maxBytes + ' bytes');
  return text;
}

async function run(argv, deps) {
  const d = deps || {};
  const out = d.stdout || function (s) { process.stdout.write(s); };
  const err = d.stderr || function (s) { process.stderr.write(s); };
  try {
    let o;
    try {
      o = parseArgs(argv || []);
    } catch (e) {
      if (e instanceof Typed) { err('radar-changelog-slice: ' + e.message + '\n' + usageText()); return 2; }
      throw e;
    }
    if (o.help) { out(usageText()); return 0; }

    const slicer = require('../lib/core/radar/changelog-slice.cjs');
    const gate = require('../lib/core/web-path-gate.cjs');
    let mark;
    try {
      mark = resolveMark(o, slicer);
    } catch (e) {
      if (e instanceof Typed) { err('radar-changelog-slice: ' + e.message + '\n'); return 2; }
      throw e;
    }

    // ---- local file mode: no network, no token, no audit record --------------
    if (o.file !== null) {
      let text;
      try {
        text = fs.readFileSync(o.file, 'utf8');
      } catch (_e) {
        err('radar-changelog-slice: cannot read the file given by --file\n');
        return 2;
      }
      return finish(slicer, text, mark, o, null, out);
    }

    // ---- ask first -------------------------------------------------------------
    const urls = [CHANGELOG_URL];
    const token = gate.approvalToken(urls);
    if (o.list) {
      out(JSON.stringify({
        url: CHANGELOG_URL,
        host: CHANGELOG_HOST,
        after: mark,
        token: token,
        note: 'One public GET of this URL, nothing else. No credential, cookie or room data is sent. Run again with --approve and the token to send it. Nothing was sent by --list.',
      }) + '\n');
      return 0;
    }
    const cred = gate.credentialCheck(urls, PROVIDER);
    if (!cred.ok) {
      err('radar-changelog-slice: the URL holds a credential-shaped value (' + cred.reason + '). Nothing was sent.\n');
      return 3;
    }
    if (!gate.checkApproval(urls, o.approve)) {
      err('radar-changelog-slice: approval is needed before anything is sent.\n');
      err('  Run with --list to see the exact URL and the approval token.\n');
      err('  Approval token for this read: ' + token + '\n');
      err('  Then run again with --approve <token>. Nothing was sent.\n');
      return 3;
    }

    // ---- the one GET -----------------------------------------------------------
    const runId = 'radar-changelog-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
    const auditDir = o.auditDir || d.auditDir || path.join(home, '.mindrian', 'radar-audit');
    let body = null;
    let failure = null;
    const ac = new AbortController();
    const timer = setTimeout(function () { ac.abort(); }, TIMEOUT_MS);
    try {
      const send = d.fetchImpl || globalThis.fetch;
      const res = await send(CHANGELOG_URL, {
        method: 'GET',
        redirect: 'manual',
        signal: ac.signal,
        headers: { 'user-agent': USER_AGENT, accept: 'text/plain' },
      });
      if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
        let where = 'another place';
        try {
          const loc = res.headers && res.headers.get ? res.headers.get('location') : null;
          if (loc) where = new URL(loc, CHANGELOG_URL).host;
        } catch (_e) { /* keep the generic text */ }
        throw new Typed('redirect_refused', 'the host answered with a redirect to ' + where + '; no redirect is followed');
      }
      if (res.status !== 200) throw new Typed('http_status', 'the host answered with status ' + res.status);
      body = await readBody(res, o.maxBytes);
    } catch (e) {
      if (e instanceof Typed) failure = e;
      else if (e && e.name === 'AbortError') failure = new Typed('timeout', 'no complete answer within ' + TIMEOUT_MS + ' ms');
      else failure = new Typed('network', 'the request failed (' + (e && e.code ? e.code : 'error') + ')');
    } finally {
      clearTimeout(timer);
    }

    // one audit record per request, whatever the outcome; URL only, no response byte
    const rec = gate.recordSent(auditDir, PROVIDER, urls, { token: token, runId: runId, outcome: failure ? 'failed' : 'ok' });
    if (!rec.ok) err('radar-changelog-slice: audit record not written (' + rec.reason + ').\n');

    if (failure) {
      out(JSON.stringify({ ok: false, reason: failure.reason, message: failure.message, url: CHANGELOG_URL }) + '\n');
      err('radar-changelog-slice: download failed, reason ' + failure.reason + ': ' + failure.message + '\n');
      return 5;
    }

    // the body goes to a temp file, is parsed, and the file is removed at exit
    const tmpDir = d.tmpDir || os.tmpdir();
    const tmpFile = path.join(tmpDir, 'mos-radar-changelog-' + process.pid + '-' + Date.now() + '.md');
    try {
      fs.writeFileSync(tmpFile, body, { encoding: 'utf8', mode: 0o600 });
      const text = fs.readFileSync(tmpFile, 'utf8');
      return finish(slicer, text, mark, o, CHANGELOG_URL, out);
    } finally {
      if (o.keep) err('radar-changelog-slice: kept ' + tmpFile + '\n');
      else { try { fs.unlinkSync(tmpFile); } catch (_e) { /* already gone */ } }
    }
  } catch (e) {
    err('radar-changelog-slice: internal error: ' + (e && e.message ? e.message : String(e)) + '\n');
    return 1;
  }
}

function finish(slicer, text, mark, o, url, out) {
  const r = slicer.sliceChangelog(text, { after: mark, maxChars: o.maxChars === null ? undefined : o.maxChars });
  out(JSON.stringify({ url: url, after: mark, entries: r.entries, coverage: r.coverage }) + '\n');
  if (!r.coverage.complete && !o.allowPartial) return 4;
  return 0;
}

module.exports = { run, CHANGELOG_URL, CHANGELOG_HOST };

if (require.main === module) {
  run(process.argv.slice(2)).then(function (code) { process.exitCode = code; });
}
