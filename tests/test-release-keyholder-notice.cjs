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
const UPDATE = require(path.join(REPO, 'lib', 'core', 'update-path.cjs'));

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

  // ---- template contract ----
  const txtRaw = fs.readFileSync(path.join(TPL_DIR, 'notice.txt'), 'utf8');
  const htmlRaw = fs.readFileSync(path.join(TPL_DIR, 'notice.html'), 'utf8');
  for (const [name, body] of [['notice.txt', txtRaw], ['notice.html', htmlRaw]]) {
    assert.ok(body.indexOf(EM) === -1, name + ' has no em-dash');
    assert.ok(body.indexOf(EN) === -1, name + ' has no en-dash');
    assert.ok(!/brain/i.test(body), name + ' has no word Brain');
  }
  assert.equal(htmlRaw.split(EM).length - 1, 0, 'HTML holds zero em-dashes');
  ok('no em-dash, no en-dash, no word Brain in either template');

  assert.ok(!/<style[\s>]/i.test(htmlRaw), 'no style element');
  assert.ok(!/\sclass\s*=/i.test(htmlRaw), 'no class attribute');
  assert.ok(/role="presentation"/.test(htmlRaw), 'table layout role=presentation');
  assert.ok(/dir="ltr"/.test(htmlRaw), 'dir ltr');
  assert.ok(/text-align:left/.test(htmlRaw), 'text-align left');
  assert.ok(/<body[^>]*background:#F5F0E6/i.test(htmlRaw), 'paper ground #F5F0E6 on the body');
  ok('HTML contract: inline styles only, table layout, LTR, paper ground');

  assert.ok(/Js\.\s*<\/td>/.test(htmlRaw), 'HTML sign-off Js.');
  assert.ok(/\nJs\.\n/.test(txtRaw), 'text sign-off Js.');
  const txtFooter = txtRaw.slice(txtRaw.lastIndexOf('\n--\n'));
  assert.ok(txtFooter.indexOf('npx @mindrian_os/cli') !== -1 && txtFooter.indexOf('mindrian-os.com') !== -1, 'text footer has both');
  assert.ok(txtFooter.indexOf('npx @mindrian_os/cli') < txtFooter.indexOf('mindrian-os.com'), 'text footer: npm path first');
  const htmlFooter = htmlRaw.slice(htmlRaw.lastIndexOf('<tr>'));
  assert.ok(htmlFooter.indexOf('npx @mindrian_os/cli') !== -1 && htmlFooter.indexOf('mindrian-os.com') !== -1, 'html footer has both');
  assert.ok(htmlFooter.indexOf('npx @mindrian_os/cli') < htmlFooter.indexOf('mindrian-os.com'), 'html footer: npm path first');
  assert.ok(txtRaw.slice(0, txtRaw.lastIndexOf('\n--\n')).indexOf('mindrian-os.com') !== -1, 'text body has the website');
  assert.ok(htmlRaw.slice(0, htmlRaw.lastIndexOf('<tr>')).indexOf('mindrian-os.com') !== -1, 'html body has the website');
  ok('sign-off Js., website link in body and footer, npm path first in the footer');

  // fixed points
  assert.ok(/retired/i.test(txtRaw) && /retired/i.test(htmlRaw), 'old key retired');
  assert.ok(/Theo/.test(txtRaw) && /Theo/.test(htmlRaw), 'Theo named');
  assert.ok(/without a key/.test(txtRaw) && /without one/.test(htmlRaw), 'Theo needs no key');
  for (let n = 1; n <= 5; n += 1) {
    assert.ok(new RegExp('(^|\\n)' + n + '\\. ').test(txtRaw), 'text step ' + n);
    assert.ok(new RegExp('>' + n + '</td>').test(htmlRaw), 'html step ' + n);
  }
  assert.ok(txtRaw.indexOf('tick the box on your home page') !== -1 && htmlRaw.indexOf('tick the box on your home page') !== -1, 'tick the box');
  ok('the four fixed points are in both templates');

  // update block
  assert.ok(txtRaw.indexOf('Already installed? Update to the latest.') !== -1, 'text update heading');
  assert.ok(htmlRaw.indexOf('Already installed? Update to the latest.') !== -1, 'html update heading');
  for (const cmd of [UPDATE.MARKETPLACE_UPDATE_COMMAND, UPDATE.PLUGIN_UPDATE_COMMAND]) {
    assert.ok(txtRaw.indexOf(cmd) !== -1, 'text has update command from the single source');
    assert.ok(htmlRaw.indexOf('>' + cmd + '</code>') !== -1, 'html has update command from the single source');
  }
  ok('both update commands equal the exports of lib/core/update-path.cjs');

  // article and URL set
  const ARTICLE = 'https://mindrian-os.com/blog/the-breakthrough-might-already-exist-in-the-wrong-field';
  const HERO = 'https://mindrian-os.com/images/blog/the-breakthrough-might-already-exist-in-the-wrong-field-hero.jpg';
  function count(hay, needle) { return hay.split(needle).length - 1; }
  assert.equal(count(txtRaw, ARTICLE), 1, 'article URL once in text');
  const hrefCount = count(htmlRaw, 'href="' + ARTICLE + '"');
  assert.ok(hrefCount >= 1, 'article URL is an href in html');
  assert.equal(count(htmlRaw, ARTICLE), hrefCount, 'article URL only as an href value');
  assert.equal(count(htmlRaw, HERO), 1, 'hero URL once in html');
  assert.equal(count(htmlRaw, 'src="' + HERO + '"'), 1, 'hero URL only as the img src');
  assert.equal(count(txtRaw, HERO), 0, 'hero URL not in text');
  const ALLOWED_TXT = new Set(['https://mindrian-os.com', ARTICLE, 'https://claude.ai/install.sh', 'https://claude.ai/install.ps1']);
  const ALLOWED_HTML = new Set(ALLOWED_TXT);
  ALLOWED_HTML.add(HERO);
  function urlsOf(s) {
    return (s.match(/https?:\/\/[^\s"'<>)]+/g) || []).map(function (u) { return u.replace(/[.,;]+$/, ''); });
  }
  for (const u of urlsOf(txtRaw)) assert.ok(ALLOWED_TXT.has(u), 'text URL in the allowed set: ' + u);
  for (const u of urlsOf(htmlRaw)) assert.ok(ALLOWED_HTML.has(u), 'html URL in the allowed set: ' + u);
  assert.ok(!/\d+\.\d+\.\d+/.test(txtRaw) && !/\d+\.\d+\.\d+/.test(htmlRaw), 'no version number');
  ok('URL set is pinned: website root, article, two install URLs, hero image only in html');

  // image arms
  assert.equal((htmlRaw.match(/<img\b/gi) || []).length, 1, 'exactly one img element');
  const img = htmlRaw.match(/<img\b[^>]*>/i)[0];
  assert.ok(/\ssrc="https:\/\/[^"]+"/.test(img) && !/src="data:/i.test(img), 'img src is https, not data:');
  assert.equal((img.match(/\ssrc="([^"]+)"/) || [])[1], HERO, 'img src equals the hero URL');
  assert.ok(htmlRaw.indexOf('data:') === -1, 'the string data: appears nowhere in the HTML');
  const alt = (img.match(/\salt="([^"]*)"/) || [])[1];
  assert.ok(alt && alt.trim().length > 0, 'img has non-empty alt');
  assert.ok(/\swidth="\d+"/.test(img), 'img has a width attribute');
  const CAPTION = 'AI-generated concept illustration, made with Codex.';
  assert.ok(htmlRaw.indexOf(CAPTION) !== -1 && txtRaw.indexOf(CAPTION) !== -1, 'caption in html and text');
  const htmlBytes = Buffer.byteLength(htmlRaw, 'utf8');
  assert.ok(htmlBytes < 51200, 'HTML under 51200 bytes');
  ok('image arms: one img, https src, alt, width, caption, size ' + htmlBytes + ' bytes (limit 51200); no fetch of the image');

  // word arms
  const BAD_WORDS = /\b(expire|expires|expiry|expired|active|inactive|request|requests|usage|status|tier|release|newsletter|beta|changelog)\b/i;
  for (const [name, body] of [['notice.txt', txtRaw], ['notice.html', htmlRaw]]) {
    const m = body.match(BAD_WORDS);
    assert.ok(!m, name + ' carries a banned word: ' + (m && m[0]));
    const stripped = body.split('claude --version').join('');
    assert.ok(!/version/i.test(stripped), name + ' uses the word version outside claude --version');
    assert.ok(!/\d+\s*(days?|times|requests)/i.test(body), name + ' has a digit count claim');
  }
  ok('word arms: no banned word, version only inside claude --version, no count claim');

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
