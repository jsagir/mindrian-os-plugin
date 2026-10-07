'use strict';
/*
 * tests/test-release-keyholder-notice.cjs -- quick 261007-c6j (owner ruling 2026-10-02).
 *
 * Hermetic suite for scripts/release-lib/keyholder-notice.cjs and its two mail
 * templates. No live network: the only server is a loopback stub on 127.0.0.1.
 * No address literal exists in this file: every sentinel address is built at run
 * time from parts. Bare node script: node:assert/strict, an ok(label) counter, no
 * framework, temp dirs removed in a finally block, non-zero exit on any failure.
 * House rule: hyphens only, no em-dashes (the dash characters are built at run
 * time from char codes below).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const MOD_PATH = path.join(REPO, 'scripts', 'release-lib', 'keyholder-notice.cjs');
const TPL_DIR = path.join(REPO, 'scripts', 'release-lib', 'keyholder-notice');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const AT = String.fromCharCode(64);

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

const TMPS = [];
function mkTmp(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kh-notice-' + tag + '-'));
  TMPS.push(d);
  return d;
}
function cleanup() {
  for (const d of TMPS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }
}

// Every printed or written string of every arm is collected here for the leak arm.
const CAPTURED = [];
function addr(i) { return 'holder' + i + AT + 'stub.invalid'; }
function localPart(i) { return 'holder' + i; }
const SENTINELS = [];
for (let i = 1; i <= 12; i += 1) SENTINELS.push(addr(i));
function hashes(s) {
  return ['sha256', 'sha1', 'md5'].map(function (a) { return crypto.createHash(a).update(s).digest('hex'); });
}

console.log('test-release-keyholder-notice:');

// ---------------------------------------------------------------------------
// Part 1: templates, pure functions, ledger, corruption, lock, redaction
// ---------------------------------------------------------------------------
function part1() {
  const K = require(MOD_PATH);

  // ---- exports ----
  const EXPECTED_EXPORTS = ['REASONS', 'QUESTION', 'loadNotice', 'noticeHash', 'redact', 'ledgerSalt', 'markerFor',
    'readMarkers', 'appendMarker', 'readLedger', 'appendLedger', 'repairLedger', 'acquireLedgerLock',
    'releaseLedgerLock', 'checkSender', 'loadRecipients', 'sendAll', 'runStep', 'dryRun', 'main'];
  const have = Object.keys(K);
  for (const name of EXPECTED_EXPORTS.slice(0, 14)) {
    assert.ok(have.indexOf(name) !== -1, 'module exports ' + name);
  }
  ok('module exports the Task 1 pure functions and constants');

  assert.equal(K.QUESTION, 'Send the key-holder service notice now?');
  ok('QUESTION text is exact');
  const REASON_KEYS = ['declined', 'no_tty', 'opted_out', 'already_sent', 'sender_unverified', 'no_recipient_source',
    'no_recipients', 'nothing_to_send', 'template_missing', 'ledger_unwritable', 'ledger_corrupt', 'ledger_locked',
    'send_failed', 'prompt_timeout', 'auto_yes_refused', 'crash'];
  assert.ok(Object.isFrozen(K.REASONS), 'REASONS frozen');
  for (const k of REASON_KEYS) assert.equal(K.REASONS[k], k, 'reason ' + k);
  ok('REASONS is frozen and carries every typed reason');

  // ---- template contract (generic only; the owner is rewriting the mail content) ----
  const txtRaw = fs.readFileSync(path.join(TPL_DIR, 'notice.txt'), 'utf8');
  const htmlRaw = fs.readFileSync(path.join(TPL_DIR, 'notice.html'), 'utf8');
  for (const [name, body] of [['notice.txt', txtRaw], ['notice.html', htmlRaw]]) {
    assert.ok(body.indexOf(EM) === -1, name + ' has no em-dash');
    assert.ok(body.indexOf(EN) === -1, name + ' has no en-dash');
    assert.ok(!/brain/i.test(body), name + ' has no word Brain');
  }
  ok('no em-dash, no en-dash, no word Brain in either template');
  assert.ok(htmlRaw.indexOf('data:') === -1, 'the string data: appears nowhere in the HTML');
  const imgs = htmlRaw.match(/<img\b[^>]*>/gi) || [];
  for (const img of imgs) {
    const alt = (img.match(/\salt="([^"]*)"/) || [])[1];
    assert.ok(alt && alt.trim().length > 0, 'every img has a non-empty alt');
    assert.ok(!/src="data:/i.test(img), 'img src is never a data: URI');
  }
  const htmlBytes = Buffer.byteLength(htmlRaw, 'utf8');
  assert.ok(htmlBytes < 51200, 'HTML under 51200 bytes');
  ok('generic template arms: no data: URI, alt text on every img, size ' + htmlBytes + ' bytes (limit 51200); the image is never fetched');

  // ---- parse arms ----
  const notice = K.loadNotice(TPL_DIR);
  assert.equal(notice.ok, true, 'loadNotice ok');
  assert.ok(/^Subject: .+/.test(txtRaw.split('\n')[0]), 'first line is Subject');
  assert.equal(notice.subject, txtRaw.split('\n')[0].replace(/^Subject:\s*/, ''), 'subject parsed');
  assert.equal(notice.text, txtRaw.slice(txtRaw.indexOf('\n\n') + 2), 'text body is after the first blank line');
  assert.equal(notice.html, htmlRaw, 'html loaded');
  assert.ok(/^[0-9a-f]{64}$/.test(notice.hash), 'hash is 64 hex');
  assert.equal(K.noticeHash(notice.subject, notice.text, notice.html), notice.hash, 'hash stable');
  assert.notEqual(K.noticeHash(notice.subject, notice.text, notice.html + 'x'), notice.hash, 'one byte changes the hash');
  const missing = K.loadNotice(path.join(mkTmp('nomiss'), 'nope'));
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'template_missing');
  ok('parse arms: subject, text, html, hash, template_missing');

  // ---- redact ----
  const red = K.redact('contact ' + addr(1) + ' and x.y+z' + AT + 'sub.example.org now');
  assert.ok(red.indexOf(AT) === -1, 'no at sign survives redact');
  assert.ok(red.indexOf('holder1') === -1, 'local part gone');
  ok('redact removes every email-like string');

  // ---- ledger arms ----
  const base = mkTmp('ledger');
  const dir = path.join(base, 'ledger-dir');
  assert.ok(!(dir + path.sep).startsWith(REPO + path.sep), 'ledger dir outside the repo');
  const defDir = K.ledgerDir({}, os.homedir());
  assert.ok(defDir.endsWith(path.join('.mindrian', 'release-keyholder-notice')), 'default ledger path');
  assert.ok(!(defDir + path.sep).startsWith(REPO + path.sep), 'default ledger dir outside the repo');
  assert.equal(K.ledgerDir({ MINDRIAN_KEYHOLDER_NOTICE_LEDGER_DIR: '/x/y' }, '/h'), '/x/y');
  ok('ledger dir resolves outside the repo; env override honoured');

  // counting wrapper around fs.writeSync
  const realWrite = fs.writeSync;
  const recordWrites = [];
  fs.writeSync = function (fd, buf) {
    const s = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf);
    if (s.indexOf('"v":1') !== -1 && s.indexOf('"event"') !== -1) recordWrites.push(s);
    return realWrite.apply(fs, arguments);
  };
  let salt;
  try {
    const sres = K.ledgerSalt(dir);
    assert.equal(sres.ok, true, 'first ledgerSalt ok');
    salt = sres.salt;
    assert.ok(/^[0-9a-f]{64}$/.test(salt), 'salt is 64 hex');
    assert.equal(K.ledgerSalt(dir).salt, salt, 'salt reused');
    const m1 = K.markerFor(salt, addr(1));
    const w1 = K.appendMarker(dir, m1, 'pending');
    assert.equal(w1.ok, true);
    const w2 = K.appendMarker(dir, m1, 'sent');
    assert.equal(w2.ok, true);
    assert.equal(K.appendLedger(dir, { event: 'started', recipients: 3, notice_hash: notice.hash, release_version: '0.0.0', override: false }).ok, true);
    assert.equal(K.appendLedger(dir, { event: 'finished', recipients: 3, sent: 3, failed: 0, unknown: 0 }).ok, true);
  } finally {
    fs.writeSync = realWrite;
  }
  assert.equal(recordWrites.length, 5, 'one fs.writeSync call per record (salt, 2 markers, started, finished)');
  for (const s of recordWrites) {
    assert.ok(s.endsWith('\n'), 'record ends with a newline');
    assert.equal(s.split('\n').length, 2, 'one line per write');
    assert.ok(Buffer.byteLength(s) < 4096, 'record under 4096 bytes');
  }
  ok('atomic append: one writeSync per record, one newline-ended JSON line under 4096 bytes');

  const ledgerFile = path.join(dir, 'ledger.jsonl');
  const led = K.readLedger(dir);
  assert.equal(led.corrupt_lines, 0);
  assert.equal(led.records.length, 5);
  assert.deepEqual(led.records.map(function (r) { return r.event; }), ['salt', 'marker', 'marker', 'started', 'finished']);
  const ALLOWED_KEYS = new Set(['v', 'event', 'at', 'salt', 'recipients', 'sent', 'failed', 'unknown', 'notice_hash', 'release_version', 'override', 'm', 'state']);
  for (const r of led.records) for (const k of Object.keys(r)) assert.ok(ALLOWED_KEYS.has(k), 'record key allowed: ' + k);
  assert.equal(led.records.filter(function (r) { return r.event === 'salt'; }).length, 1, 'exactly one salt record');
  K.appendLedger(dir, { event: 'started', recipients: 1, evil: 'x', email: addr(2) });
  const led2 = K.readLedger(dir);
  assert.ok(!('evil' in led2.records[led2.records.length - 1]) && !('email' in led2.records[led2.records.length - 1]), 'unknown keys dropped by the whitelist');
  ok('ledger records hold only whitelisted keys; one salt record');

  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(ledgerFile).mode & 0o777, 0o600, 'ledger file mode 0600');
    assert.equal(fs.statSync(dir).mode & 0o777, 0o700, 'ledger dir mode 0700');
    ok('ledger file mode 0600 and dir mode 0700');
  }

  // marker arms
  const mA = K.markerFor(salt, addr(1));
  assert.ok(/^[0-9a-f]{64}$/.test(mA), 'marker is 64 hex');
  assert.equal(K.markerFor(salt, addr(1)), mA, 'marker stable');
  assert.equal(K.markerFor(salt, '  ' + addr(1).toUpperCase() + ' '), mA, 'marker ignores case and padding');
  assert.notEqual(K.markerFor('f'.repeat(64), addr(1)), mA, 'different salt, different marker');
  assert.notEqual(K.markerFor(salt, addr(2)), mA, 'different address, different marker');
  for (const h of hashes(addr(1)).concat(hashes(addr(1).toLowerCase()))) assert.notEqual(mA, h, 'marker is not a plain hash');
  assert.equal(mA, crypto.createHmac('sha256', salt).update(addr(1).toLowerCase()).digest('hex'), 'marker is HMAC-SHA256 keyed with the salt');
  ok('markerFor is a salted HMAC-SHA256 of the lowercased address, never a plain hash');

  // readMarkers: sent wins; else latest wins
  const dir2 = path.join(base, 'ledger-2');
  const s2 = K.ledgerSalt(dir2).salt;
  const ma = K.markerFor(s2, addr(1));
  const mb = K.markerFor(s2, addr(2));
  const mc = K.markerFor(s2, addr(3));
  K.appendMarker(dir2, ma, 'pending');
  K.appendMarker(dir2, ma, 'sent');
  K.appendMarker(dir2, ma, 'failed');
  K.appendMarker(dir2, mb, 'pending');
  K.appendMarker(dir2, mb, 'unknown_outcome');
  K.appendMarker(dir2, mc, 'failed');
  K.appendMarker(dir2, mc, 'pending');
  const rm = K.readMarkers(dir2);
  assert.equal(rm.ok, true);
  assert.equal(rm.markers.get(ma), 'sent', 'sent wins over a later failed');
  assert.equal(rm.markers.get(mb), 'unknown_outcome', 'latest wins');
  assert.equal(rm.markers.get(mc), 'pending', 'latest wins (pending)');
  assert.equal(K.appendMarker(dir2, ma, 'bogus').ok, false, 'bad state refused');
  ok('readMarkers: sent wins over every other state, otherwise the latest record wins');

  // unwritable dir: dir path is a file
  const fileAsDir = path.join(base, 'iam-a-file');
  fs.writeFileSync(fileAsDir, 'x');
  const uw = K.appendLedger(fileAsDir, { event: 'started', recipients: 1 });
  assert.equal(uw.ok, false);
  assert.equal(uw.reason, 'ledger_unwritable');
  const uw2 = K.ledgerSalt(fileAsDir);
  assert.equal(uw2.ok, false);
  assert.equal(uw2.reason, 'ledger_unwritable');
  ok('a ledger dir that is a file gives ledger_unwritable, never a throw');

  // no address, local part or plain hash in the ledger
  const dir3 = path.join(base, 'ledger-3');
  const s3 = K.ledgerSalt(dir3).salt;
  for (let i = 1; i <= 4; i += 1) {
    K.appendMarker(dir3, K.markerFor(s3, addr(i)), 'pending');
    K.appendMarker(dir3, K.markerFor(s3, addr(i)), 'sent');
  }
  const dump3 = fs.readFileSync(path.join(dir3, 'ledger.jsonl'), 'utf8');
  CAPTURED.push(dump3, fs.readFileSync(ledgerFile, 'utf8'));
  for (let i = 1; i <= 4; i += 1) {
    assert.ok(dump3.indexOf(addr(i)) === -1, 'no address in the ledger');
    assert.ok(dump3.indexOf(localPart(i)) === -1, 'no local part in the ledger');
    assert.ok(dump3.indexOf(AT) === -1, 'no at sign in the ledger');
    for (const h of hashes(addr(i)).concat(hashes(addr(i).toLowerCase()))) assert.ok(dump3.indexOf(h) === -1, 'no plain hash in the ledger');
  }
  ok('the ledger holds no address, no local part and no plain hash');

  // ---- corruption arms ----
  const dir4 = path.join(base, 'ledger-4');
  const s4 = K.ledgerSalt(dir4).salt;
  K.appendMarker(dir4, K.markerFor(s4, addr(1)), 'sent');
  K.appendMarker(dir4, K.markerFor(s4, addr(2)), 'sent');
  const f4 = path.join(dir4, 'ledger.jsonl');
  const clean4 = fs.readFileSync(f4, 'utf8');
  fs.appendFileSync(f4, '\n\n'); // empty lines do not count
  assert.equal(K.readLedger(dir4).corrupt_lines, 0, 'empty lines are not corrupt');
  fs.writeFileSync(f4, clean4);
  fs.appendFileSync(f4, '{"v":1,"event":"marker","m":"abc'); // truncated, no newline
  assert.equal(K.readLedger(dir4).corrupt_lines, 1, 'truncated last line counts');
  assert.equal(K.readMarkers(dir4).ok, false);
  assert.equal(K.readMarkers(dir4).reason, 'ledger_corrupt');
  assert.equal(K.ledgerSalt(dir4).reason, 'ledger_corrupt');
  // garbage in the middle
  const lines4 = clean4.split('\n');
  fs.writeFileSync(f4, lines4[0] + '\nthis is garbage\n' + lines4[1] + '\n' + lines4[2] + '\n');
  assert.equal(K.readLedger(dir4).corrupt_lines, 1, 'garbage middle line counts');
  assert.equal(K.readMarkers(dir4).reason, 'ledger_corrupt');
  ok('corruption arms: truncated line and garbage line give ledger_corrupt; empty lines are fine');

  // repair
  const rep = K.repairLedger(dir4);
  assert.equal(rep.ok, true);
  assert.equal(rep.dropped, 1, 'one dropped line');
  const qfiles = fs.readdirSync(dir4).filter(function (n) { return /^ledger\.corrupt-/.test(n); });
  assert.equal(qfiles.length, 1, 'quarantine copy exists');
  assert.ok(fs.readFileSync(path.join(dir4, qfiles[0]), 'utf8').indexOf('this is garbage') !== -1, 'quarantine holds the original');
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(dir4, qfiles[0])).mode & 0o777, 0o600, 'quarantine mode 0600');
  assert.equal(K.readLedger(dir4).corrupt_lines, 0, 'ledger is clean after repair');
  assert.equal(K.readLedger(dir4).records.length, 3, 'valid records kept');
  assert.equal(fs.readdirSync(dir4).filter(function (n) { return /tmp/.test(n); }).length, 0, 'no temp file left');
  assert.equal(K.readMarkers(dir4).ok, true);
  const rep2 = K.repairLedger(dir4);
  assert.equal(rep2.ok, true);
  assert.equal(rep2.dropped, 0, 'repair of a clean ledger drops nothing');
  ok('repairLedger: quarantine copy, valid records only, dropped count, no temp file');

  // repair never invents a salt
  const dir5 = path.join(base, 'ledger-5');
  fs.mkdirSync(dir5, { recursive: true });
  const f5 = path.join(dir5, 'ledger.jsonl');
  const nosalt = JSON.stringify({ v: 1, event: 'started', at: '2026-10-07T00:00:00.000Z', recipients: 2 }) + '\n' + 'garbage\n';
  fs.writeFileSync(f5, nosalt);
  const rep5 = K.repairLedger(dir5);
  assert.equal(rep5.ok, false);
  assert.equal(rep5.reason, 'ledger_corrupt');
  assert.equal(rep5.detail, 'salt_missing');
  assert.equal(fs.readFileSync(f5, 'utf8'), nosalt, 'ledger unchanged when the salt is gone');
  const dir6 = path.join(base, 'ledger-6');
  fs.mkdirSync(dir6, { recursive: true });
  fs.writeFileSync(path.join(dir6, 'ledger.jsonl'), JSON.stringify({ v: 1, event: 'started', at: '2026-10-07T00:00:00.000Z', recipients: 2 }) + '\n');
  const sr6 = K.ledgerSalt(dir6);
  assert.equal(sr6.ok, false);
  assert.equal(sr6.reason, 'ledger_corrupt');
  assert.equal(sr6.detail, 'salt_missing');
  ok('records with no readable salt refuse with ledger_corrupt (salt_missing); repair never invents a salt');

  // ---- lock arms ----
  const lockBase = path.join(mkTmp('lock'), 'lk');
  const lockFile = path.join(lockBase, 'ledger.lock');
  const l1 = K.acquireLedgerLock(lockBase);
  assert.equal(l1.ok, true);
  const lk = JSON.parse(fs.readFileSync(lockFile, 'utf8').trim());
  assert.deepEqual(Object.keys(lk).sort(), ['at', 'pid'], 'lock holds the pid and the time only');
  assert.equal(lk.pid, process.pid);
  assert.ok(!isNaN(Date.parse(lk.at)), 'lock time is a date');
  if (process.platform !== 'win32') assert.equal(fs.statSync(lockFile).mode & 0o777, 0o600, 'lock mode 0600');
  const before = fs.readFileSync(lockFile, 'utf8');
  const l2 = K.acquireLedgerLock(lockBase);
  assert.equal(l2.ok, false);
  assert.equal(l2.reason, 'ledger_locked');
  assert.equal(l2.pid, process.pid);
  assert.ok(typeof l2.age_s === 'number' && l2.age_s >= 0, 'age in seconds');
  assert.equal(fs.readFileSync(lockFile, 'utf8'), before, 'a present lock is left untouched');
  assert.equal(K.releaseLedgerLock(lockBase).released, true, 'own lock released');
  assert.ok(!fs.existsSync(lockFile), 'lock removed');
  // a stale lock of another pid is refused and never removed
  fs.writeFileSync(lockFile, JSON.stringify({ pid: 999999, at: '2020-01-01T00:00:00.000Z' }) + '\n', { mode: 0o600 });
  const l3 = K.acquireLedgerLock(lockBase);
  assert.equal(l3.reason, 'ledger_locked');
  assert.equal(l3.pid, 999999);
  assert.ok(l3.age_s > 1000, 'stale age');
  assert.equal(K.releaseLedgerLock(lockBase).released, false, 'a lock of another pid is never removed');
  assert.ok(fs.existsSync(lockFile), 'foreign lock still there');
  // unwritable dir for the lock
  const l4 = K.acquireLedgerLock(fileAsDir);
  assert.equal(l4.ok, false);
  assert.equal(l4.reason, 'ledger_unwritable');
  ok('lock arms: O_EXCL create, pid and time only, present lock refused and untouched, release only own pid');
}

// ---------------------------------------------------------------------------
// Part 2: loopback stub, network pieces, prompt flow, retry, dry-run, CLI, exit, leak
// ---------------------------------------------------------------------------
const http = require('node:http');
const cp = require('node:child_process');

const RKEY = 're_test_' + crypto.randomBytes(8).toString('hex');
const SKEY = 'svc_test_' + crypto.randomBytes(8).toString('hex');
const FROM_ADDR = 'notice' + AT + 'stub.invalid';
const FROM = 'MOS Notice <' + FROM_ADDR + '>';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function waitFor(pred, ms) {
  const end = Date.now() + (ms || 3000);
  while (Date.now() < end) {
    if (pred()) return true;
    await sleep(10);
  }
  return false;
}

function defaultCfg() {
  return {
    domainsStatus: 200,
    domainPages: [[{ name: 'stub.invalid', status: 'verified' }]],
    send: null,
    keyStatus: 200,
    keyRows: [1, 2, 3, 4, 5].map(function (i) { return { email: addr(i), user_id: 'u' + i }; }),
    authStatus: 200,
    authUsers: [1, 2, 3, 4, 5, 9].map(function (i) { return { id: 'u' + i, email: addr(i) }; }),
  };
}

function startStub() {
  return new Promise(function (resolve) {
    const stub = { cfg: defaultCfg(), reqs: [] };
    const server = http.createServer(async function (req, res) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks).toString('utf8');
      const u = new URL(req.url, 'http://127.0.0.1');
      const rec = { method: req.method, path: u.pathname, query: u.searchParams, headers: req.headers, body };
      stub.reqs.push(rec);
      const cfg = stub.cfg;
      function json(status, obj, headers) {
        res.writeHead(status, Object.assign({ 'content-type': 'application/json' }, headers || {}));
        res.end(JSON.stringify(obj));
      }
      try {
        if (req.method === 'GET' && u.pathname === '/domains') {
          if (cfg.domainsStatus !== 200) return json(cfg.domainsStatus, { message: 'no' });
          let idx = 0;
          const after = u.searchParams.get('after');
          if (after) {
            idx = cfg.domainPages.findIndex(function (pg) { return pg.some(function (d) { return 'id-' + d.name === after; }); }) + 1;
          }
          const page = cfg.domainPages[idx] || [];
          return json(200, { object: 'list', has_more: idx + 1 < cfg.domainPages.length, data: page.map(function (d) { return { id: 'id-' + d.name, name: d.name, status: d.status }; }) });
        }
        if (req.method === 'POST' && u.pathname === '/emails') {
          const n = stub.reqs.filter(function (r) { return r.method === 'POST' && r.path === '/emails'; }).length;
          const ans = cfg.send ? await cfg.send(rec, n) : { status: 200, body: { id: 'mail-' + n } };
          if (ans.destroy) { req.socket.destroy(); return undefined; }
          return json(ans.status, ans.body || {}, ans.headers);
        }
        if (req.method === 'GET' && u.pathname === '/rest/v1/brain_api_keys') {
          if (cfg.keyStatus !== 200) return json(cfg.keyStatus, { message: 'no' });
          const m = /(\d+)-(\d+)/.exec(req.headers.range || '0-999');
          return json(200, cfg.keyRows.slice(Number(m[1]), Number(m[2]) + 1));
        }
        if (req.method === 'GET' && u.pathname === '/auth/v1/admin/users') {
          if (cfg.authStatus !== 200) return json(cfg.authStatus, { message: 'no' });
          const page = Number(u.searchParams.get('page') || 1);
          const per = Number(u.searchParams.get('per_page') || 50);
          return json(200, { users: cfg.authUsers.slice((page - 1) * per, page * per) });
        }
        return json(404, {});
      } catch (e) {
        return json(500, {});
      }
    });
    server.listen(0, '127.0.0.1', function () {
      stub.base = 'http://127.0.0.1:' + server.address().port;
      stub.reset = function () { stub.cfg = defaultCfg(); stub.reqs.length = 0; };
      stub.posts = function () { return stub.reqs.filter(function (r) { return r.method === 'POST' && r.path === '/emails'; }); };
      stub.close = function () { server.closeAllConnections(); return new Promise(function (r) { server.close(r); }); };
      resolve(stub);
    });
  });
}

function mkEnv(stub, extra) {
  return Object.assign({
    RESEND_API_KEY: RKEY,
    MOS_KEYHOLDER_NOTICE_FROM: FROM,
    MOS_RESEND_API_BASE: stub.base,
    SUPABASE_URL: stub.base,
    SUPABASE_SERVICE_ROLE_KEY: SKEY,
    MOS_KEYHOLDER_NOTICE_PACE_MS: '0',
  }, extra || {});
}
function newDir() { return path.join(mkTmp('run'), 'ledger'); }
function mkDeps(stub, dir, over) {
  const out = [];
  const d = Object.assign({
    env: mkEnv(stub),
    isTTY: true,
    ask: async function () { return 'y'; },
    out: function (l) { out.push(l); CAPTURED.push(l); },
    err: function (l) { out.push(l); CAPTURED.push(l); },
    fetch: globalThis.fetch,
    homedir: '/nonexistent-home',
    ledgerDir: dir,
    pace: 0,
    noticeDir: TPL_DIR,
  }, over || {});
  d._out = out;
  return d;
}
function snap(dir) {
  try { CAPTURED.push(fs.readFileSync(path.join(dir, 'ledger.jsonl'), 'utf8')); } catch (e) { /* none */ }
}
function addrOfPost(rec) { return JSON.parse(rec.body).to[0]; }
function countsByAddr(stub) {
  const m = {};
  for (const r of stub.posts()) { const a = addrOfPost(r); m[a] = (m[a] || 0) + 1; }
  return m;
}
function hasLine(deps, re) { return deps._out.some(function (l) { return re.test(l); }); }
function lockPresent(dir) { return fs.existsSync(path.join(dir, 'ledger.lock')); }
function ledgerPresent(dir) { return fs.existsSync(path.join(dir, 'ledger.jsonl')); }
function failWriteWhen(pred) {
  const real = fs.writeSync;
  fs.writeSync = function (fd, buf) {
    const s = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf);
    if (pred(s)) { const e = new Error('simulated disk failure'); e.code = 'EIO'; throw e; }
    return real.apply(fs, arguments);
  };
  return function restore() { fs.writeSync = real; };
}
function runCli(args, opts) {
  return new Promise(function (resolve) {
    const child = cp.spawn(process.execPath, [MOD_PATH].concat(args), { env: opts.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let so = '';
    let se = '';
    child.stdout.on('data', function (c) { so += c; });
    child.stderr.on('data', function (c) { se += c; });
    const timer = setTimeout(function () { child.kill('SIGKILL'); }, 5000);
    child.on('close', function (code, sig) {
      clearTimeout(timer);
      CAPTURED.push(so, se);
      resolve({ status: code, signal: sig, stdout: so, stderr: se });
    });
    child.stdin.on('error', function () { /* closed early */ });
    child.stdin.end(opts.input || '');
  });
}

async function part2() {
  const K = require(MOD_PATH);
  const notice = K.loadNotice(TPL_DIR);
  const stub = await startStub();
  try {
    for (const name of ['checkSender', 'loadRecipients', 'sendAll', 'runStep', 'dryRun', 'main']) {
      assert.equal(typeof K[name], 'function', 'module exports ' + name);
    }
    ok('module exports the Task 2 functions');

    // ------------------------------------------------------------ sender arms
    const httpc = K.makeHttp(globalThis.fetch);
    stub.reset();
    let r = await K.checkSender(mkEnv(stub, { RESEND_API_KEY: '' }), httpc);
    assert.equal(r.reason, 'sender_unverified'); assert.equal(r.detail, 'api_key_unset');
    r = await K.checkSender(mkEnv(stub, { MOS_KEYHOLDER_NOTICE_FROM: '' }), httpc);
    assert.equal(r.reason, 'sender_unverified'); assert.equal(r.detail, 'from_unset');
    assert.equal(stub.reqs.length, 0, 'unset env makes no request');
    stub.cfg.domainsStatus = 401;
    r = await K.checkSender(mkEnv(stub), httpc);
    assert.equal(r.ok, false); assert.equal(r.reason, 'sender_unverified'); assert.equal(r.detail, 'api_status_401');
    stub.cfg.domainsStatus = 200;
    const closed = await new Promise(function (res) { const s = http.createServer(); s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { res(p); }); }); });
    r = await K.checkSender(mkEnv(stub, { MOS_RESEND_API_BASE: 'http://127.0.0.1:' + closed }), httpc);
    assert.equal(r.reason, 'sender_unverified'); assert.equal(r.detail, 'api_unreachable');
    stub.cfg.domainPages = [[{ name: 'other.invalid', status: 'verified' }]];
    r = await K.checkSender(mkEnv(stub), httpc);
    assert.equal(r.reason, 'sender_unverified'); assert.equal(r.detail, 'domain_not_listed');
    stub.cfg.domainPages = [[{ name: 'stub.invalid', status: 'pending' }]];
    r = await K.checkSender(mkEnv(stub), httpc);
    assert.equal(r.reason, 'sender_unverified'); assert.equal(r.detail, 'domain_not_verified');
    stub.cfg.domainPages = [[{ name: 'stub.invalid', status: 'verified' }]];
    r = await K.checkSender(mkEnv(stub), httpc);
    assert.equal(r.ok, true, 'verified domain passes');
    r = await K.checkSender(mkEnv(stub, { MOS_KEYHOLDER_NOTICE_FROM: 'notice' + AT + 'mail.stub.invalid' }), httpc);
    assert.equal(r.ok, true, 'subdomain of a verified domain passes');
    stub.reqs.length = 0;
    stub.cfg.domainPages = [[{ name: 'other.invalid', status: 'verified' }], [{ name: 'stub.invalid', status: 'verified' }]];
    r = await K.checkSender(mkEnv(stub), httpc);
    assert.equal(r.ok, true, 'second page followed');
    assert.equal(stub.reqs.filter(function (q) { return q.path === '/domains'; }).length, 2, 'two pages fetched');
    assert.equal(stub.reqs[0].headers.authorization, 'Bearer ' + RKEY, 'bearer auth');
    assert.equal(K.resendBase({ MOS_RESEND_API_BASE: 'https://evil.example/x' }), 'https://api.resend.com', 'non-loopback base ignored');
    assert.equal(K.resendBase({}), 'https://api.resend.com');
    assert.equal(K.resendBase({ MOS_RESEND_API_BASE: 'http://localhost:4000' }), 'http://localhost:4000');
    assert.equal(K.resendBase({ MOS_RESEND_API_BASE: stub.base }), stub.base);
    ok('sender arms: unset, 401, unreachable, not listed, not verified, verified, subdomain, paging, base guard');

    // ------------------------------------------------------------ recipient arms
    stub.reset();
    stub.cfg.keyRows = [
      { email: addr(1), user_id: 'u1' },
      { email: null, user_id: 'u2' },
      { email: addr(3).toUpperCase(), user_id: 'u3' },
      { email: addr(3), user_id: 'u3b' },
      { email: 'junk-value', user_id: null },
      { email: '  ', user_id: 'u4' },
    ];
    stub.cfg.authUsers = [{ id: 'u1', email: addr(1) }, { id: 'u2', email: addr(2) }, { id: 'u4', email: addr(4) }, { id: 'u9', email: addr(9) }];
    let lr = await K.loadRecipients(mkEnv(stub), httpc);
    assert.equal(lr.ok, true);
    assert.deepEqual(lr.recipients.map(function (a) { return a.toLowerCase(); }).sort(), [addr(1), addr(2), addr(3), addr(4)].sort(), 'recipient set');
    assert.deepEqual(lr.counts, { key_rows: 6, with_address: 3, via_auth: 2, no_address: 1, recipients: 4, auth_accounts: 4, auth_only_excluded: 1 });
    assert.ok(lr.recipients.indexOf(addr(9)) === -1, 'auth-only account is not mailed');
    assert.ok(stub.reqs.length >= 2 && stub.reqs.every(function (q) { return q.method === 'GET'; }), 'every Supabase request is a GET');
    assert.equal(stub.reqs[0].headers.apikey, SKEY);
    assert.equal(stub.reqs[0].headers.authorization, 'Bearer ' + SKEY);
    lr = await K.loadRecipients(mkEnv(stub, { SUPABASE_URL: '' }), httpc);
    assert.equal(lr.reason, 'no_recipient_source');
    lr = await K.loadRecipients(mkEnv(stub, { SUPABASE_SERVICE_ROLE_KEY: '' }), httpc);
    assert.equal(lr.reason, 'no_recipient_source');
    stub.cfg.keyStatus = 500;
    lr = await K.loadRecipients(mkEnv(stub), httpc);
    assert.equal(lr.reason, 'no_recipient_source');
    stub.cfg.keyStatus = 200;
    stub.cfg.authStatus = 500;
    lr = await K.loadRecipients(mkEnv(stub), httpc);
    assert.equal(lr.reason, 'no_recipient_source');
    stub.cfg.authStatus = 200;
    stub.cfg.keyRows = [];
    lr = await K.loadRecipients(mkEnv(stub), httpc);
    assert.equal(lr.reason, 'no_recipients');
    ok('recipient arms: dedupe, via auth, auth-only excluded, counts, GET only, typed failures');

    // ------------------------------------------------------------ flow arms
    // no TTY
    stub.reset();
    let dir = newDir();
    let deps = mkDeps(stub, dir, { isTTY: false });
    let res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.reason, 'no_tty'); assert.ok(hasLine(deps, /reason=no_tty/));
    assert.equal(stub.reqs.length, 0, 'no TTY: zero requests');
    // CI set with a TTY
    deps = mkDeps(stub, dir, { env: mkEnv(stub, { CI: 'true' }) });
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.reason, 'no_tty');
    assert.equal(stub.reqs.length, 0);
    // declined answers
    for (const a of ['n', '', 'maybe']) {
      deps = mkDeps(stub, dir, { ask: async function () { return a; } });
      res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
      assert.equal(res.reason, 'declined', 'answer ' + JSON.stringify(a));
    }
    assert.equal(stub.reqs.length, 0, 'declined: zero requests');
    assert.ok(!ledgerPresent(dir) && !lockPresent(dir), 'declined: nothing on disk');
    // prompt timeout
    deps = mkDeps(stub, dir, { ask: function () { return new Promise(function () { /* never */ }); }, promptTimeoutMs: 40 });
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.reason, 'prompt_timeout');
    // QUESTION is what is asked
    let asked = null;
    deps = mkDeps(stub, dir, { ask: async function (q) { asked = q; return 'n'; } });
    await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.ok(asked && asked.indexOf(K.QUESTION) !== -1, 'the exact question is asked');
    ok('flow arms: no TTY, CI, declined answers, timeout, exact question');

    // sender failure on Yes
    stub.cfg.domainPages = [[{ name: 'stub.invalid', status: 'pending' }]];
    dir = newDir();
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.reason, 'sender_unverified'); assert.ok(hasLine(deps, /reason=sender_unverified/));
    assert.equal(stub.posts().length, 0, 'sender failure: zero POST');
    assert.ok(!ledgerPresent(dir), 'sender failure: no ledger file');
    assert.ok(!lockPresent(dir), 'sender failure: no lock left');
    ok('a Yes with a failed sender check is refused, no ledger, no lock');

    // already_sent
    stub.reset();
    dir = newDir();
    K.ledgerSalt(dir);
    K.appendLedger(dir, { event: 'started', recipients: 5, notice_hash: notice.hash, release_version: '0.0.0', override: false });
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.reason, 'already_sent');
    assert.ok(hasLine(deps, /--resend-keyholder-notice/), 'hint names the override flag');
    assert.equal(stub.posts().length, 0);
    assert.ok(!lockPresent(dir));
    ok('a started record on record gives already_sent and zero POST');

    // happy path
    stub.reset();
    dir = newDir();
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.reason, null, 'happy path has no refusal reason');
    assert.equal(res.sent, 5);
    const posts = stub.posts();
    assert.equal(posts.length, 5, 'one POST per recipient');
    const led = K.readLedger(dir);
    const saltRec = led.records.find(function (x) { return x.event === 'salt'; }).salt;
    for (const p of posts) {
      const b = JSON.parse(p.body);
      assert.ok(Array.isArray(b.to) && b.to.length === 1, 'to is an array of one');
      assert.ok(!('cc' in b) && !('bcc' in b), 'no cc, no bcc');
      assert.equal(b.from, FROM); assert.equal(b.subject, notice.subject);
      assert.equal(b.text, notice.text); assert.equal(b.html, notice.html);
      const mk = K.markerFor(saltRec, b.to[0]);
      assert.equal(p.headers['idempotency-key'], notice.hash.slice(0, 12) + '-' + mk.slice(0, 32), 'idempotency key');
      assert.ok(p.headers['idempotency-key'].indexOf(localPart(1)) === -1);
      assert.equal(p.headers.authorization, 'Bearer ' + RKEY);
    }
    const evs = led.records.map(function (x) { return x.event; });
    assert.deepEqual(evs, ['salt', 'started'].concat(Array(10).fill('marker'), ['finished']), 'ledger event sequence');
    const marks = led.records.filter(function (x) { return x.event === 'marker'; });
    for (let i = 0; i < 10; i += 2) {
      assert.equal(marks[i].state, 'pending'); assert.equal(marks[i + 1].state, 'sent'); assert.equal(marks[i].m, marks[i + 1].m);
    }
    assert.equal(led.records[1].recipients, 5);
    assert.equal(led.records[1].release_version, '0.0.0');
    assert.equal(led.records[12].sent, 5);
    assert.ok(!lockPresent(dir), 'no lock left after the happy path');
    snap(dir);
    ok('happy path: one POST per person, ledger salt/started/pending-sent/finished, idempotency key, no lock');

    // markers are HMACs and the file holds no address or plain hash
    const dump = fs.readFileSync(path.join(dir, 'ledger.jsonl'), 'utf8');
    for (let i = 1; i <= 5; i += 1) {
      assert.ok(dump.indexOf(addr(i)) === -1 && dump.indexOf(localPart(i)) === -1);
      for (const h of hashes(addr(i)).concat(hashes(addr(i).toLowerCase()))) assert.ok(dump.indexOf(h) === -1, 'no plain hash');
      assert.ok(marks.some(function (m2) { return m2.m === crypto.createHmac('sha256', saltRec).update(addr(i)).digest('hex'); }), 'marker recomputed from the salt');
    }
    if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(dir, 'ledger.jsonl')).mode & 0o777, 0o600);
    ok('salt privacy: every marker is an HMAC recomputed from the salt in the file; no address, no plain hash; mode 0600');

    // 422 echoing an address
    stub.reset();
    dir = newDir();
    stub.cfg.send = function (rec, n) { return n === 2 ? { status: 422, body: { message: 'invalid recipient ' + addrOfPost(rec) } } : { status: 200, body: { id: 'ok' } }; };
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.sent, 4); assert.equal(res.failed, 1); assert.equal(res.unknown, 0);
    for (const l of deps._out) for (let i = 1; i <= 5; i += 1) assert.ok(l.indexOf(localPart(i)) === -1, 'no address in output');
    const failedAddr = addrOfPost(stub.posts()[1]);
    const rmk = K.readMarkers(dir).markers;
    assert.equal(rmk.get(K.markerFor(K.ledgerSalt(dir).salt, failedAddr)), 'failed', 'definite failure ends as failed');
    snap(dir);
    // definite failure: retry mails it again
    stub.reqs.length = 0; stub.cfg.send = null;
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0', resend: true }, deps);
    assert.equal(stub.posts().length, 1, 'retry mails only the failed recipient');
    assert.equal(addrOfPost(stub.posts()[0]), failedAddr);
    assert.ok(hasLine(deps, /already_mailed=4/) && hasLine(deps, /to_send=1/));
    snap(dir);
    ok('422 prints no address, ends failed, and a retry mails that person again');

    // five in a row
    stub.reset();
    stub.cfg.keyRows = [1, 2, 3, 4, 5, 6, 7].map(function (i) { return { email: addr(i), user_id: 'u' + i }; });
    stub.cfg.send = function () { return { status: 422, body: {} }; };
    dir = newDir();
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.reason, 'send_failed');
    assert.equal(stub.posts().length, 5, 'stopped after 5 in a row');
    assert.ok(!lockPresent(dir));
    snap(dir);
    ok('five failures in a row stop the run with send_failed');

    // 429 retry once
    stub.reset();
    stub.cfg.send = function (rec, n) { return n === 1 ? { status: 429, body: {}, headers: { 'retry-after': '0' } } : { status: 200, body: { id: 'ok' } }; };
    dir = newDir();
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.sent, 5);
    const p429 = stub.posts();
    assert.equal(p429.length, 6, 'the first mail was retried once');
    assert.equal(p429[0].headers['idempotency-key'], p429[1].headers['idempotency-key'], 'same key on the retry');
    stub.reset();
    stub.cfg.send = function (rec, n) { return n <= 2 ? { status: 429, body: {}, headers: { 'retry-after': '0' } } : { status: 200, body: {} }; };
    dir = newDir();
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.failed, 1, 'a second 429 is a failure');
    snap(dir);
    ok('429 with Retry-After is retried once, then counted as failed');

    // auto-yes flags
    stub.reset();
    dir = newDir();
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0', autoYes: true }, deps);
    assert.equal(res.reason, 'auto_yes_refused');
    for (const flag of ['--yes', '--yes-all', '-y', '--assume-yes']) {
      const d2 = mkDeps(stub, dir);
      const saved = process.exitCode;
      await K.main(['run', flag, '--release-version', '0.0.0'], d2);
      assert.equal(process.exitCode, 0);
      process.exitCode = saved;
      assert.ok(hasLine(d2, /reason=auto_yes_refused/), flag + ' refused');
    }
    assert.equal(stub.reqs.length, 0, 'auto-yes: zero requests');
    ok('--yes, --yes-all, -y and --assume-yes are refused');

    // include-unknown without resend; repair on a clean ledger
    stub.reset();
    dir = newDir();
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0', includeUnknown: true, repair: true }, deps);
    assert.equal(res.sent, 5);
    assert.ok(hasLine(deps, /--include-unknown.*no effect/), 'include-unknown without the override flag has no effect');
    assert.ok(hasLine(deps, /no repair needed/), 'clean ledger: no repair needed');
    snap(dir);
    ok('--include-unknown alone has no effect; --repair-keyholder-ledger on a clean ledger changes nothing');

    // opt-out
    stub.reset();
    dir = newDir();
    let askedOpt = false;
    deps = mkDeps(stub, dir, { ask: async function () { askedOpt = true; return 'y'; } });
    res = await K.runStep({ releaseVersion: '0.0.0', optedOut: true }, deps);
    assert.equal(res.reason, 'opted_out');
    assert.ok(hasLine(deps, /--no-keyholder-notice/) && hasLine(deps, /no notice was sent/), 'audit line names the flag and the consequence');
    assert.equal(askedOpt, false, 'opt-out asks no question');
    assert.equal(stub.reqs.length, 0);
    ok('opt-out: one audit line with the flag and the consequence, no question, zero requests');

    // crash
    stub.reset();
    dir = newDir();
    deps = mkDeps(stub, dir, { ask: async function () { throw new Error('boom ' + addr(1)); } });
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.reason, 'crash');
    assert.ok(hasLine(deps, /reason=crash/));
    assert.ok(!hasLine(deps, /holder1/), 'crash message is redacted');
    assert.ok(!lockPresent(dir));
    ok('a thrown error gives reason crash, redacted, and the function returns normally');

    // ------------------------------------------------------------ retry arms
    // interrupted run: hook throws after the third sent write
    stub.reset();
    dir = newDir();
    let nSent = 0;
    deps = mkDeps(stub, dir, { afterSent: async function () { nSent += 1; if (nSent === 3) throw new Error('simulated kill'); } });
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.reason, 'crash');
    let l2 = K.readLedger(dir);
    assert.equal(l2.records.filter(function (x) { return x.event === 'marker' && x.state === 'sent'; }).length, 3, 'three sent markers');
    assert.ok(l2.records.some(function (x) { return x.event === 'started'; }), 'started record');
    assert.ok(!l2.records.some(function (x) { return x.event === 'finished'; }), 'no finished record');
    assert.ok(!lockPresent(dir), 'no lock left after the interrupted run');
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0', resend: true }, deps);
    assert.equal(res.sent, 2);
    assert.ok(hasLine(deps, /already_mailed=3/) && hasLine(deps, /to_send=2/), 'second run prints already_mailed=3 and to_send=2');
    const seen = countsByAddr(stub);
    for (let i = 1; i <= 5; i += 1) assert.equal(seen[addr(i)], 1, 'each recipient mailed exactly once across both runs');
    snap(dir);
    ok('interrupted run then retry: each recipient mailed exactly once');

    // pending before POST
    stub.reset();
    dir = newDir();
    const checks2 = [];
    stub.cfg.send = function (rec, n) {
      const lg = K.readLedger(dir);
      const sl = lg.records.find(function (x) { return x.event === 'salt'; }).salt;
      const mk = K.markerFor(sl, addrOfPost(rec));
      const mine = lg.records.filter(function (x) { return x.event === 'marker' && x.m === mk; });
      const sentBefore = lg.records.filter(function (x) { return x.event === 'marker' && x.state === 'sent'; }).length;
      checks2.push({ last: mine.length ? mine[mine.length - 1].state : null, sentBefore: sentBefore, n: n });
      return { status: 200, body: { id: 'ok' } };
    };
    deps = mkDeps(stub, dir);
    await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(checks2.length, 5);
    for (const c of checks2) { assert.equal(c.last, 'pending', 'pending marker is on disk before the POST'); assert.equal(c.sentBefore, c.n - 1, 'earlier recipients are already sent'); }
    snap(dir);
    ok('a pending marker is on disk before each POST, and every earlier recipient is already sent');

    // the one remaining window
    stub.reset();
    dir = newDir();
    let acc = 0;
    deps = mkDeps(stub, dir, { afterAccept: async function () { acc += 1; if (acc === 2) throw new Error('simulated kill'); } });
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.reason, 'crash');
    const firstKeys = {};
    for (const p of stub.posts()) firstKeys[addrOfPost(p)] = p.headers['idempotency-key'];
    const pendingAddr = addrOfPost(stub.posts()[1]);
    const saltW = K.ledgerSalt(dir).salt;
    assert.equal(K.readMarkers(dir).markers.get(K.markerFor(saltW, pendingAddr)), 'pending', 'marker stays pending');
    stub.reqs.length = 0;
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0', resend: true }, deps);
    assert.ok(hasLine(deps, /unknown_skipped=1/), 'retry skips the pending recipient');
    assert.equal(countsByAddr(stub)[pendingAddr], undefined, 'pending recipient not mailed');
    assert.equal(stub.posts().length, 3);
    stub.reqs.length = 0;
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0', resend: true, includeUnknown: true }, deps);
    assert.equal(stub.posts().length, 1);
    assert.equal(addrOfPost(stub.posts()[0]), pendingAddr);
    assert.equal(stub.posts()[0].headers['idempotency-key'], firstKeys[pendingAddr], 'same Idempotency-Key as the first attempt');
    snap(dir);
    ok('the remaining window: pending counts as unknown, skipped by default, mailed with --include-unknown under the same key');

    // unknown outcome: dropped connection and 503
    stub.reset();
    dir = newDir();
    stub.cfg.send = function (rec, n) { return n === 2 ? { destroy: true } : (n === 3 ? { status: 503, body: {} } : { status: 200, body: {} }); };
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.sent, 3); assert.equal(res.unknown, 2); assert.equal(res.failed, 0);
    const unkAddrs = [addrOfPost(stub.posts()[1]), addrOfPost(stub.posts()[2])];
    const unkKeys = [stub.posts()[1].headers['idempotency-key'], stub.posts()[2].headers['idempotency-key']];
    const sU = K.ledgerSalt(dir).salt;
    for (const a of unkAddrs) assert.equal(K.readMarkers(dir).markers.get(K.markerFor(sU, a)), 'unknown_outcome');
    stub.reqs.length = 0; stub.cfg.send = null;
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0', resend: true }, deps);
    assert.equal(res.reason, 'nothing_to_send');
    assert.ok(hasLine(deps, /unknown_skipped=2/));
    assert.equal(stub.posts().length, 0, 'unknown recipients are skipped by default');
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0', resend: true, includeUnknown: true }, deps);
    assert.equal(stub.posts().length, 2);
    assert.deepEqual(stub.posts().map(function (p) { return p.headers['idempotency-key']; }).sort(), unkKeys.slice().sort(), 'same keys');
    snap(dir);
    ok('unknown outcome (dropped connection, 503): marker unknown_outcome, skipped by default, retried under the same keys');

    // nothing to send
    stub.reqs.length = 0;
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0', resend: true }, deps);
    assert.equal(res.reason, 'nothing_to_send');
    assert.equal(stub.posts().length, 0);
    ok('every recipient sent: nothing_to_send, zero POST');

    // corrupt ledger arms
    stub.reset();
    dir = newDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ledger.jsonl'), JSON.stringify({ v: 1, event: 'started', at: '2026-10-07T00:00:00.000Z', recipients: 5 }) + '\n');
    for (const repairFlag of [false, true]) {
      deps = mkDeps(stub, dir);
      res = await K.runStep({ releaseVersion: '0.0.0', resend: true, repair: repairFlag }, deps);
      assert.equal(res.reason, 'ledger_corrupt', 'no salt gives ledger_corrupt, repair ' + repairFlag);
    }
    assert.equal(stub.posts().length, 0);
    assert.ok(!lockPresent(dir));
    function seedLedger(d2) {
      const s = K.ledgerSalt(d2).salt;
      K.appendLedger(d2, { event: 'started', recipients: 5, notice_hash: notice.hash, release_version: '0.0.0', override: false });
      K.appendMarker(d2, K.markerFor(s, addr(1)), 'pending');
      K.appendMarker(d2, K.markerFor(s, addr(1)), 'sent');
      return s;
    }
    // truncated last line
    dir = newDir();
    seedLedger(dir);
    fs.appendFileSync(path.join(dir, 'ledger.jsonl'), '{"v":1,"event":"marker","m":"ab');
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0', resend: true }, deps);
    assert.equal(res.reason, 'ledger_corrupt');
    assert.equal(stub.posts().length, 0);
    assert.ok(!lockPresent(dir));
    // garbage in the middle
    dir = newDir();
    seedLedger(dir);
    const gl = fs.readFileSync(path.join(dir, 'ledger.jsonl'), 'utf8').split('\n');
    fs.writeFileSync(path.join(dir, 'ledger.jsonl'), gl[0] + '\ngarbage here\n' + gl.slice(1).join('\n'));
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0', resend: true }, deps);
    assert.equal(res.reason, 'ledger_corrupt');
    assert.equal(stub.posts().length, 0);
    // repair, then the retry proceeds
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0', resend: true, repair: true }, deps);
    assert.equal(res.sent, 4, 'after repair the retry mails the four with no marker');
    assert.ok(fs.readdirSync(dir).some(function (n) { return /^ledger\.corrupt-/.test(n); }), 'quarantine copy exists');
    assert.equal(K.readLedger(dir).corrupt_lines, 0);
    assert.ok(hasLine(deps, /dropped 1 line/) && hasLine(deps, /mailed again/), 'repair prints the dropped count and the warning');
    snap(dir);
    ok('corrupt ledger: no salt, truncated line and garbage line refuse; repair keeps a quarantine copy and the retry proceeds');

    // overlap: a stale lock
    stub.reset();
    dir = newDir();
    fs.mkdirSync(dir, { recursive: true });
    const lockPath = path.join(dir, 'ledger.lock');
    const staleBody = JSON.stringify({ pid: 999999, at: '2020-01-01T00:00:00.000Z' }) + '\n';
    fs.writeFileSync(lockPath, staleBody);
    deps = mkDeps(stub, dir);
    res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    assert.equal(res.reason, 'ledger_locked');
    assert.equal(stub.posts().length, 0);
    assert.equal(fs.readFileSync(lockPath, 'utf8'), staleBody, 'stale lock left untouched');
    // F2: the refusal line
    const refusal = deps._out.find(function (l) { return /ledger_locked/.test(l); });
    assert.ok(refusal, 'a refusal line exists');
    const ix = [];
    let from = 0;
    for (const t of [lockPath, 'pid 999999', 'age ', 'alive', 'delete it by hand only after you confirm no run is active']) {
      const at = refusal.indexOf(t, from);
      assert.ok(at !== -1, 'refusal line has "' + t + '" in order: ' + refusal);
      ix.push(at);
      from = at + t.length;
    }
    assert.ok(/age \d+ s/.test(refusal) || /age[^,]*\d+/.test(refusal), 'age in seconds');
    assert.ok(/alive[^,;]*(no|yes)/.test(refusal), 'alive yes or no');
    fs.unlinkSync(lockPath);
    ok('overlap: a stale lock refuses with ledger_locked; the line prints path, pid, age, alive and the by-hand text; lock untouched');

    // two runs in one process
    stub.reset();
    dir = newDir();
    let release;
    const hold = new Promise(function (res2) { release = res2; });
    stub.cfg.send = function (rec, n) { return n === 1 ? hold.then(function () { return { status: 200, body: {} }; }) : { status: 200, body: {} }; };
    const depsA = mkDeps(stub, dir);
    const runA = K.runStep({ releaseVersion: '0.0.0' }, depsA);
    assert.ok(await waitFor(function () { return stub.posts().length >= 1; }), 'run A reached its first POST');
    const depsB = mkDeps(stub, dir);
    const resB = await K.runStep({ releaseVersion: '0.0.0' }, depsB);
    assert.equal(resB.reason, 'ledger_locked');
    assert.equal(stub.posts().length, 1, 'run B made no POST');
    assert.ok(lockPresent(dir), 'run B did not remove the lock it never created');
    release();
    const resA = await runA;
    assert.equal(resA.sent, 5);
    assert.ok(!lockPresent(dir), 'lock gone after run A ends');
    snap(dir);
    ok('two runs in one process: the second gives ledger_locked and sends nothing; the lock goes when the first ends');

    // marker write failure
    stub.reset();
    dir = newDir();
    let pendingCount = 0;
    let restore = failWriteWhen(function (s) { if (s.indexOf('"state":"pending"') !== -1) { pendingCount += 1; return pendingCount === 2; } return false; });
    try {
      deps = mkDeps(stub, dir);
      res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    } finally { restore(); }
    assert.equal(res.reason, 'ledger_unwritable');
    assert.equal(stub.posts().length, 1, 'nothing sent for the recipient whose pending marker failed');
    assert.ok(!lockPresent(dir));
    stub.reset();
    dir = newDir();
    let sentCount = 0;
    restore = failWriteWhen(function (s) { if (s.indexOf('"state":"sent"') !== -1) { sentCount += 1; return sentCount === 1; } return false; });
    try {
      deps = mkDeps(stub, dir);
      res = await K.runStep({ releaseVersion: '0.0.0' }, deps);
    } finally { restore(); }
    assert.equal(res.reason, 'ledger_unwritable');
    assert.equal(stub.posts().length, 1, 'run stops at once after a failed sent write');
    const s1 = K.ledgerSalt(dir).salt;
    assert.equal(K.readMarkers(dir).markers.get(K.markerFor(s1, addrOfPost(stub.posts()[0]))), 'pending', 'marker stays pending');
    assert.ok(!lockPresent(dir));
    snap(dir);
    ok('marker write failure: ledger_unwritable, stop at once, pending stays pending');

    // ------------------------------------------------------------ dry-run arms
    const ALLOWED = [/^keyholder-notice: step 9\.9 /, /^keyholder-notice: opt-out: /, /^keyholder-notice: sender check: (PASSED|REFUSED)/,
      /^keyholder-notice: recipients: /, /^keyholder-notice: ledger: /, /^keyholder-notice: nothing is sent/];
    function allAllowed(d2) {
      for (const l of d2._out) assert.ok(ALLOWED.some(function (re) { return re.test(l); }), 'dry-run line is in the allowed set: ' + l);
    }
    stub.reset();
    dir = newDir();
    deps = mkDeps(stub, dir);
    await K.dryRun({ releaseVersion: '0.0.0' }, deps);
    allAllowed(deps);
    assert.ok(hasLine(deps, /sender check: PASSED/) && hasLine(deps, /recipients: key_rows=5 .*recipients=5/) && hasLine(deps, /auth_only_excluded=1/));
    assert.ok(hasLine(deps, /ledger: no prior send/) && hasLine(deps, /nothing is sent/));
    assert.equal(stub.posts().length, 0, 'dry-run: zero POST');
    for (const l of deps._out) for (let i = 1; i <= 9; i += 1) assert.ok(l.indexOf(localPart(i)) === -1, 'dry-run prints no address');
    assert.ok(!ledgerPresent(dir) && !lockPresent(dir), 'dry-run writes nothing');
    // ledger states
    stub.reset();
    dir = newDir();
    await K.runStep({ releaseVersion: '0.0.0' }, mkDeps(stub, dir));
    stub.reqs.length = 0;
    deps = mkDeps(stub, dir);
    await K.dryRun({ releaseVersion: '0.0.0' }, deps);
    allAllowed(deps);
    assert.ok(hasLine(deps, /ledger: started \d{4}-\d{2}-\d{2}.*sent=5/), 'dry-run shows the start date and the counts');
    assert.equal(stub.posts().length, 0);
    fs.appendFileSync(path.join(dir, 'ledger.jsonl'), 'garbage\n');
    deps = mkDeps(stub, dir);
    await K.dryRun({ releaseVersion: '0.0.0' }, deps);
    allAllowed(deps);
    assert.ok(hasLine(deps, /ledger: corrupt \(1 bad lines?\)/));
    fs.writeFileSync(path.join(dir, 'ledger.lock'), staleBody);
    deps = mkDeps(stub, dir);
    await K.dryRun({ releaseVersion: '0.0.0' }, deps);
    allAllowed(deps);
    assert.ok(hasLine(deps, /ledger: locked/));
    assert.equal(fs.readFileSync(path.join(dir, 'ledger.lock'), 'utf8'), staleBody, 'dry-run does not take or remove the lock');
    // opt-out
    stub.reqs.length = 0;
    deps = mkDeps(stub, newDir());
    await K.dryRun({ releaseVersion: '0.0.0', optedOut: true }, deps);
    allAllowed(deps);
    assert.ok(hasLine(deps, /opt-out: engaged \(--no-keyholder-notice\)/));
    assert.equal(stub.reqs.length, 0, 'dry-run opt-out: no request');
    // no env: no network call
    deps = mkDeps(stub, newDir(), { env: {} });
    await K.dryRun({ releaseVersion: '0.0.0' }, deps);
    allAllowed(deps);
    assert.ok(hasLine(deps, /sender check: REFUSED/) && hasLine(deps, /recipients: unavailable/));
    assert.equal(stub.reqs.length, 0, 'dry-run with no env: no network call');
    ok('dry-run arms: allowed line set, counts, ledger states, opt-out, no env, zero POST, no address');

    // ------------------------------------------------------------ CLI arms (subprocess)
    stub.reset();
    const cliHome = mkTmp('home');
    const cliLedger = path.join(mkTmp('cli'), 'ledger');
    const cliEnv = Object.assign({}, process.env, mkEnv(stub), { HOME: cliHome, MINDRIAN_KEYHOLDER_NOTICE_LEDGER_DIR: cliLedger });
    delete cliEnv.CI;
    let cli = await runCli(['run', '--release-version', '0.0.0'], { env: cliEnv, input: 'y\n' });
    assert.equal(cli.status, 0, 'CLI run exits 0');
    assert.ok(/reason=no_tty/.test(cli.stdout), 'piped y is not accepted: no_tty');
    assert.equal(stub.reqs.length, 0);
    assert.ok(!fs.existsSync(cliLedger), 'CLI no_tty: no ledger');
    cli = await runCli(['dry-run', '--release-version', '0.0.0'], { env: cliEnv });
    assert.equal(cli.status, 0, 'CLI dry-run exits 0');
    assert.equal(stub.posts().length, 0, 'CLI dry-run: zero POST');
    assert.ok(/nothing is sent/.test(cli.stdout));
    cli = await runCli(['bogus'], { env: cliEnv });
    assert.equal(cli.status, 2, 'bad subcommand exits 2');
    ok('CLI arms: piped y gives no_tty with exit 0; dry-run exits 0 with zero POST; bad subcommand exits 2');

    // optional pty arm
    let ptyOk = false;
    try { ptyOk = cp.spawnSync('script', ['--version'], { encoding: 'utf8' }).status === 0; } catch (e) { ptyOk = false; }
    if (!ptyOk) {
      console.log('  SKIP - pty arm (the script command is not available)');
    } else {
      const pty = await new Promise(function (resolve) {
        const child = cp.spawn('script', ['-qec', process.execPath + ' ' + MOD_PATH + ' run --release-version 0.0.0', '/dev/null'], { env: cliEnv, stdio: ['pipe', 'pipe', 'pipe'] });
        let so = '';
        let sent = false;
        child.stdout.on('data', function (c) {
          so += c;
          if (!sent && so.indexOf(K.QUESTION) !== -1) { sent = true; setTimeout(function () { child.stdin.write('n\n'); }, 50); }
        });
        const timer = setTimeout(function () { child.kill('SIGKILL'); }, 5000);
        child.on('close', function (code) { clearTimeout(timer); CAPTURED.push(so); resolve({ code: code, out: so }); });
        child.stdin.on('error', function () { /* ignore */ });
      });
      if (pty.out.indexOf(K.QUESTION) === -1) {
        console.log('  SKIP - pty arm (no pty could be made)');
      } else {
        assert.ok(/reason=declined/.test(pty.out), 'pty: answer n gives declined');
        ok('pty arm: the question is asked on a terminal and n gives declined');
      }
    }

    // ------------------------------------------------------------ F1: SIGINT and SIGTERM
    for (const sig of ['SIGINT', 'SIGTERM']) {
      stub.reset();
      dir = newDir();
      let rel2;
      const hold2 = new Promise(function (res2) { rel2 = res2; });
      stub.cfg.send = function (rec, n) { return n === 1 ? hold2.then(function () { return { status: 200, body: {} }; }) : { status: 200, body: {} }; };
      deps = mkDeps(stub, dir);
      const before = process.listenerCount(sig);
      const savedCode = process.exitCode;
      const runM = K.main(['run', '--release-version', '0.0.0'], deps);
      assert.ok(await waitFor(function () { return stub.posts().length >= 1; }), sig + ' arm: first POST reached');
      assert.ok(lockPresent(dir), 'the run holds the lock mid-send');
      process.kill(process.pid, sig);
      await runM;
      assert.equal(process.exitCode, sig === 'SIGINT' ? 130 : 143, sig + ' sets the exit code');
      assert.ok(!lockPresent(dir), sig + ': the lock file is gone');
      assert.equal(stub.posts().length, 1, sig + ': no further mail after the signal');
      assert.equal(process.listenerCount(sig), before, sig + ': handler removed after main returns');
      const mm = K.readMarkers(dir).markers;
      const sg = K.ledgerSalt(dir).salt;
      assert.equal(mm.get(K.markerFor(sg, addrOfPost(stub.posts()[0]))), 'unknown_outcome', sig + ': the in-flight mail is recorded as unknown_outcome');
      process.exitCode = savedCode;
      rel2();
      snap(dir);
    }
    // a lock the run did not create is never removed by the signal path
    stub.reset();
    dir = newDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ledger.lock'), staleBody);
    deps = mkDeps(stub, dir);
    const savedC2 = process.exitCode;
    await K.main(['run', '--release-version', '0.0.0'], deps);
    process.exitCode = savedC2;
    assert.equal(fs.readFileSync(path.join(dir, 'ledger.lock'), 'utf8'), staleBody, 'a foreign lock survives the run and the end of main');
    fs.unlinkSync(path.join(dir, 'ledger.lock'));
    ok('F1: SIGINT and SIGTERM release the lock this run created, set the exit code, return, and never touch a foreign lock');

    // ------------------------------------------------------------ exit arms
    const src = fs.readFileSync(MOD_PATH, 'utf8');
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(function (l) { return l.replace(/(^|\s)\/\/.*$/, ''); }).join('\n');
    assert.ok(!/process\.exit\s*\(/.test(stripped), 'the module never calls process.exit');
    const savedExit = process.exitCode;
    process.exitCode = undefined;
    stub.reset();
    deps = mkDeps(stub, newDir(), { isTTY: false });
    await K.main(['run', '--release-version', '0.0.0'], deps);
    assert.equal(process.exitCode, 0, 'main sets 0 with no TTY');
    process.exitCode = undefined;
    deps = mkDeps(stub, newDir(), { ask: async function () { throw new Error('boom'); } });
    await K.main(['run', '--release-version', '0.0.0'], deps);
    assert.equal(process.exitCode, 0, 'main sets 0 on a crash');
    assert.ok(hasLine(deps, /reason=crash/));
    process.exitCode = undefined;
    deps = mkDeps(stub, newDir());
    await K.main(['nonsense'], deps);
    assert.equal(process.exitCode, 2, 'main sets 2 on a bad subcommand');
    process.exitCode = undefined;
    deps = mkDeps(stub, newDir());
    await K.main(['run', '--no-such-flag'], deps);
    assert.equal(process.exitCode, 2, 'main sets 2 on a bad argument');
    process.exitCode = savedExit;
    ok('exit arms: no process.exit call; main sets 0, 0 on a crash, 2 on bad input, and returns');

    // ------------------------------------------------------------ leak arm
    const everything = CAPTURED.join('\n');
    assert.ok(everything.length > 1000, 'the leak arm saw real output');
    for (let i = 1; i <= 12; i += 1) {
      assert.ok(everything.indexOf(addr(i)) === -1, 'no sentinel address in any output or ledger');
      assert.ok(everything.indexOf(localPart(i) + AT) === -1);
    }
    for (let i = 1; i <= 9; i += 1) assert.ok(!new RegExp('holder' + i + '(?![0-9])').test(everything), 'no local part of a sentinel in any output or ledger: holder' + i);
    assert.ok(everything.indexOf(RKEY) === -1, 'no Resend key value');
    assert.ok(everything.indexOf(SKEY) === -1, 'no service key value');
    ok('leak arm: no sentinel address, local part or secret value in any output, ledger or collected line');
  } finally {
    await stub.close();
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
(async function run() {
  try {
    part1();
    if (typeof part2 === 'function') await part2();
    console.log('test-release-keyholder-notice: ' + checks + ' checks passed');
  } catch (e) {
    console.error('FAIL: ' + (e && e.stack ? e.stack : e));
    process.exitCode = 1;
  } finally {
    cleanup();
  }
})();
