#!/usr/bin/env node
'use strict';

/*
 * Phase 389 plan 12 (owner D10 = APPROVE): proof of the opt-in share step.
 * A Seed can be shared as a public page only behind a card that shows the exact text and names
 * Vercel. No test makes a real call to Vercel: the deploy is replaced by a stub through the
 * documented option opts.deploy, and the script tests run with VERCEL_TOKEN unset, in a scratch
 * HOME and a scratch working folder. Plain counters. Exit 1 on a failure.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const MODULE = path.join(ROOT, 'lib/core/pyramid-seed-share.cjs');
const SCRIPT = path.join(ROOT, 'scripts/pyramid-seed-share.cjs');
const CMD = path.join(ROOT, 'commands/structure-argument.md');
const SKILL = path.join(ROOT, 'skills/structure-argument/SKILL.md');

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass += 1; console.log('ok   ' + name); }
  else { fail += 1; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

const rec = require(path.join(ROOT, 'lib/core/pyramid-seed-record.cjs'));
const SENTENCE = 'We sell cold storage to small farms in a way nobody has tried';
const RECORD = {
  schema: rec.SCHEMA,
  id: rec.idFor(SENTENCE),
  created_at: '2026-11-08T10:00:00.000Z',
  depth: 'seed',
  situation: 'Small farms lose fruit between the field and the market.',
  complication: 'Cold storage is built for large buyers, not for a farm of 5 people.',
  question: 'Can a shared cold room serve small farms at a price they accept?',
  answer: 'Yes, if the room is rented by the pallet and the farms share one truck.',
  support: [
    { group: 'The loss is real', claims: ['Fruit spoils within 2 days in summer.', 'Farms report 15 & 20 percent loss <often>.'] },
    { group: 'The price can work', claims: ['A pallet slot costs less than one lost crate.'] },
  ],
  objection: 'Farms may not trust a shared room with their only crop.',
  evidence: [
    { cell: 'brain_similar', status: 'ok', summary_line: 'A similar case shared one room across 12 users.' },
    { cell: 'web_funding', status: 'empty', summary_line: '' },
  ],
};
const EVIL = JSON.parse(JSON.stringify(RECORD));
EVIL.support[0].claims[0] = '<script>alert("x")</script> & more';

function scratch(label) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-share-' + label + '-'));
  const home = path.join(base, 'home');
  const cwd = path.join(base, 'cwd');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(cwd, { recursive: true });
  return { base, home, cwd };
}
function cleanEnv(home) {
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home });
  delete env.VERCEL_TOKEN;
  delete env.MINDRIAN_EUREKA_ROOT;
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
  return env;
}
function runScript(args, s) {
  const r = spawnSync(process.execPath, [SCRIPT].concat(args), { cwd: s.cwd, env: cleanEnv(s.home), encoding: 'utf8' });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch (_e) { json = null; }
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, json };
}
function decode(t) {
  return t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
// Visible text of the body, one entry per block element, trimmed.
function bodyLines(html) {
  const b = /<body[^>]*>([\s\S]*)<\/body>/.exec(html);
  const body = (b ? b[1] : '').replace(/<div style="max-width[^>]*>/, '');
  const out = [];
  const re = /<(h1|div|p)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = re.exec(body)) !== null) out.push(decode(m[2].replace(/<[^>]*>/g, '')).trim());
  return out;
}

const exists = fs.existsSync(MODULE);
const share = exists ? require(MODULE) : {};
const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

async function main() {
  // -------------------------------------------------------------------------
  // Test 1: the page
  // -------------------------------------------------------------------------
  {
    const has = typeof share.buildSharePage === 'function';
    check('Test 1.0: the share module exports buildSharePage', has);
    const html = has ? share.buildSharePage(EVIL) : '';
    check('Test 1.1: a script tag in a claim shows as escaped text', html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more'));
    check('Test 1.2: no live script element', !/<script/i.test(html) && html.length > 0);
    check('Test 1.3: inline styles only (no style element)', html.length > 0 && !/<style/i.test(html) && /style="/.test(html));
    const home = os.homedir();
    check('Test 1.4: no home path, no environment value', html.length > 0 && !html.includes(home) && !/\/home\/|\/Users\/|C:\\\\Users/.test(html) && !(process.env.HOME && html.includes(process.env.HOME)));
    check('Test 1.5: no record id and no sentence hash', html.length > 0 && !html.includes(RECORD.id) && !html.includes(sha(SENTENCE).slice(0, 8)));
    const lines = html ? bodyLines(html) : [];
    check('Test 1.6: the page starts with the answer', lines.length > 1 && /^Your argument/.test(lines[0]) && /^Answer: /.test(lines[1]));
    const receipt = rec.renderReceipt(EVIL).split('\n').map((l) => l.trim());
    const footer = share.FOOTER_TEXT;
    check('Test 1.7: the page text is the receipt text plus one footer line',
      typeof footer === 'string' && /MindrianOS/.test(footer) && JSON.stringify(lines) === JSON.stringify(receipt.concat([footer])),
      JSON.stringify(lines).slice(0, 200));
    check('Test 1.8: the page is a full document with a charset', /^<!DOCTYPE html>/i.test(html) && /charset/i.test(html));
  }

  // -------------------------------------------------------------------------
  // Test 2: the card
  // -------------------------------------------------------------------------
  {
    const s = scratch('t2');
    const lines = typeof share.shareCardLines === 'function' ? share.shareCardLines(RECORD) : null;
    check('Test 2.1: shareCardLines equals the receipt text', lines === rec.renderReceipt(RECORD));
    const card = typeof share.prepareCard === 'function' ? share.prepareCard(RECORD, { home: s.home }) : null;
    check('Test 2.2: the card names Vercel and that anyone with the link can read the page',
      card && card.third_party === 'Vercel' && /anyone with the link can read/i.test(card.note) && /Vercel/.test(card.note));
    check('Test 2.3: the card text is the receipt and the hash is the hash of the page',
      card && card.text === rec.renderReceipt(RECORD) && card.page_sha256 === share.pageHash(share.buildSharePage(RECORD)) && /^[0-9a-f]{64}$/.test(card.page_sha256));
    check('Test 2.4: the card shows the footer line and says nothing is sent yet',
      card && card.footer === share.FOOTER_TEXT && /nothing is sent/i.test(card.note));
    const pdir = path.join(s.home, '.mindrian', 'pyramid-seed', 'share-pending');
    const pfile = card ? path.join(pdir, card.page_sha256 + '.json') : '';
    check('Test 2.5: the card writes one pending file with the hash and a time, and no text',
      card && fs.existsSync(pfile) && (() => { const t = fs.readFileSync(pfile, 'utf8'); const j = JSON.parse(t); return j.page_sha256 === card.page_sha256 && typeof j.created_at === 'string' && !/Answer|farm|Yes,/.test(t); })());
    check('Test 2.6: the card makes no fallback file and no deploy', !fs.existsSync(path.join(s.home, '.mindrian', 'mva')));
    fs.rmSync(s.base, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // Tests 3 to 6: the consent gate (deploy stub)
  // -------------------------------------------------------------------------
  {
    const s = scratch('gate');
    let calls = 0;
    let pendingGoneAtCall = null;
    let seenArgs = null;
    let pfileAtCall = '';
    const deploy = async (html, sha8) => {
      calls += 1;
      seenArgs = { html, sha8 };
      pendingGoneAtCall = !fs.existsSync(pfileAtCall);
      return { url: 'https://stub.vercel.app', deploy_duration_ms: 1 };
    };
    const opts = { home: s.home, deploy };
    const hasSend = typeof share.send === 'function';

    // Test 3: no card, no send
    const page = share.buildSharePage ? share.buildSharePage(RECORD) : '';
    const h = page ? share.pageHash(page) : '0'.repeat(64);
    const r3 = hasSend ? await share.send(RECORD, h, opts) : null;
    check('Test 3: send without a card is refused with card_required, no deploy, no fallback file',
      r3 && r3.ok === false && r3.error === 'card_required' && calls === 0 && !fs.existsSync(path.join(s.home, '.mindrian', 'mva')));
    const r3b = hasSend ? await share.send(RECORD, 'not-a-hash', opts) : null;
    check('Test 3.1: a malformed confirm value is refused', r3b && r3b.ok === false && r3b.error === 'card_required' && calls === 0);

    // Test 4: card then send
    const card = share.prepareCard(RECORD, opts);
    pfileAtCall = path.join(s.home, '.mindrian', 'pyramid-seed', 'share-pending', card.page_sha256 + '.json');
    const r4 = await share.send(RECORD, card.page_sha256, opts);
    check('Test 4.1: card then send calls the deploy once and returns its answer',
      calls === 1 && r4.ok === true && r4.result && r4.result.url === 'https://stub.vercel.app');
    check('Test 4.2: the pending file was deleted before the deploy was called', pendingGoneAtCall === true);
    check('Test 4.3: the deploy got the exact page and an 8 character name that is not the record id',
      seenArgs && sha(seenArgs.html) === card.page_sha256 && /^[0-9a-f]{8}$/.test(seenArgs.sha8) && seenArgs.sha8 !== RECORD.id);

    // Test 6: second send with the same hash
    const r6 = await share.send(RECORD, card.page_sha256, opts);
    check('Test 6: a second send with the same hash is refused, no second deploy', r6.ok === false && r6.error === 'card_required' && calls === 1);

    // Test 5: edited record
    const card2 = share.prepareCard(RECORD, opts);
    const edited = JSON.parse(JSON.stringify(RECORD));
    edited.answer = 'No, the room should be owned by one farm.';
    const hEdit = share.pageHash(share.buildSharePage(edited));
    check('Test 5.1: an edited record gives a different page hash', hEdit !== card2.page_sha256);
    const r5 = await share.send(edited, card2.page_sha256, opts);
    check('Test 5.2: the old card hash does not authorize the edited record', r5.ok === false && r5.error === 'card_required' && calls === 1);
    const r5b = await share.send(edited, hEdit, opts);
    check('Test 5.3: the edited record needs its own card', r5b.ok === false && r5b.error === 'card_required' && calls === 1);

    // expiry
    const card3 = share.prepareCard(RECORD, opts);
    const p3 = path.join(s.home, '.mindrian', 'pyramid-seed', 'share-pending', card3.page_sha256 + '.json');
    const j3 = JSON.parse(fs.readFileSync(p3, 'utf8'));
    j3.created_at = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(p3, JSON.stringify(j3));
    const r7e = await share.send(RECORD, card3.page_sha256, opts);
    check('Test 6.1: a card older than 1 hour is refused', r7e.ok === false && r7e.error === 'card_required' && calls === 1);

    // invalid record
    let threw = false;
    try { share.prepareCard({ schema: 'x' }, opts); } catch (_e) { threw = true; }
    check('Test 6.2: a record that fails validation makes no card', threw || (share.prepareCard({ schema: 'x' }, opts) || {}).ok === false);
    fs.rmSync(s.base, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // Test 7: the script, no token (no network, scratch HOME)
  // -------------------------------------------------------------------------
  {
    const s = scratch('script');
    const w = rec.writeRecord(RECORD, { home: s.home });
    check('Test 7.0: the scratch record is written', w.ok === true);
    const none = runScript(['send', '--id', RECORD.id, '--confirm', 'a'.repeat(64)], s);
    check('Test 7.1: send without a card exits 3 card_required and writes no fallback file',
      none.code === 3 && none.json && none.json.error === 'card_required' && !fs.existsSync(path.join(s.home, '.mindrian', 'mva')));
    const card = runScript(['card', '--id', RECORD.id], s);
    check('Test 7.2: card exits 0 and prints the exact text, Vercel and the hash',
      card.code === 0 && card.json && card.json.text === rec.renderReceipt(RECORD) && card.json.third_party === 'Vercel' &&
      /anyone with the link can read/i.test(card.json.note) && /^[0-9a-f]{64}$/.test(card.json.page_sha256) && card.json.card_id === card.json.page_sha256.slice(0, 12));
    check('Test 7.3: card sends nothing and makes no fallback file', !fs.existsSync(path.join(s.home, '.mindrian', 'mva')));
    const wrong = runScript(['send', '--id', RECORD.id, '--confirm', 'b'.repeat(64)], s);
    check('Test 7.4: a wrong hash exits 3', wrong.code === 3 && wrong.json && wrong.json.error === 'card_required');
    const sent = runScript(['send', '--id', RECORD.id, '--confirm', card.json.page_sha256], s);
    const fb = path.join(s.home, '.mindrian', 'mva', 'briefs', card.json.page_sha256.slice(0, 8) + '.html');
    check('Test 7.5: with no token send writes only the local fallback file and prints its path',
      sent.code === 0 && sent.json && sent.json.shared === false && sent.json.error === 'vercel_unavailable' && sent.json.fallback_path === fb && fs.existsSync(fb));
    check('Test 7.6: the fallback file is the exact page of the card', fs.existsSync(fb) && sha(fs.readFileSync(fb, 'utf8')) === card.json.page_sha256);
    const again = runScript(['send', '--id', RECORD.id, '--confirm', card.json.page_sha256], s);
    check('Test 7.7: a second send exits 3', again.code === 3);
    const bad = runScript(['card', '--id', 'ZZZZ'], s);
    check('Test 7.8: a bad id exits 4', bad.code === 4);
    const miss = runScript(['card', '--id', '00000000'], s);
    check('Test 7.9: a missing record exits 4', miss.code === 4);
    const use = runScript(['card'], s);
    check('Test 7.10: a missing flag exits 1 with a usage line', use.code === 1 && /usage/.test(use.stderr));
    const use2 = runScript(['frob', '--id', RECORD.id], s);
    check('Test 7.11: an unknown command exits 1', use2.code === 1);
    fs.rmSync(s.base, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // Test 8: the one caller of the deploy (static)
  // -------------------------------------------------------------------------
  {
    const needle = 'mva-vercel' + '-deploy';
    const g = spawnSync('git', ['grep', '--untracked', '-l', '-E', 'require\\([^)]*' + needle, '--', '.', ':!.planning', ':!r-and-d', ':!dist'], { cwd: ROOT, encoding: 'utf8' });
    const files = g.stdout.split('\n').filter(Boolean);
    const allowed = (f) => f === 'lib/core/pyramid-seed-share.cjs' || f.startsWith('tests/') || /^lib\/core\/[^/]+\.test\.cjs$/.test(f);
    check('Test 8.1: only the share module and test files require the deploy module', files.length > 0 && files.every(allowed) && files.includes('lib/core/pyramid-seed-share.cjs'), files.join(','));
    const d = spawnSync('git', ['grep', '--untracked', '-l', 'deployDeck', '--', '.', ':!.planning', ':!r-and-d', ':!dist', ':!CHANGELOG.md'], { cwd: ROOT, encoding: 'utf8' });
    const dfiles = d.stdout.split('\n').filter(Boolean);
    check('Test 8.2: only the deploy module, the share module and tests name deployDeck',
      dfiles.every((f) => allowed(f) || f === 'lib/core/mva-vercel-deploy.cjs'), dfiles.join(','));
    const scriptText = fs.existsSync(SCRIPT) ? fs.readFileSync(SCRIPT, 'utf8') : 'x deployDeck';
    check('Test 8.3: the script does not reach the deploy by itself', !/deployDeck|mva-vercel-deploy|resolve-vercel-key|fetch\(/.test(scriptText));
    const modText = exists ? fs.readFileSync(MODULE, 'utf8') : '';
    const sendAt = modText.indexOf('async function send');
    const unlinkAt = modText.indexOf('unlinkSync', sendAt);
    const reqAt = modText.indexOf(needle, sendAt);
    check('Test 8.4: inside send the pending file is deleted before the deploy module is loaded', sendAt > -1 && unlinkAt > sendAt && reqAt > unlinkAt);
    check('Test 8.5: the share module needs no Brain client and no room database', exists && !/brain-client|mindrian-brain|room\.db|navigation\.cjs/.test(modText));
    check('Test 8.6: nothing under dist, lib or hooks starts the share script', (() => {
      const r = spawnSync('git', ['grep', '--untracked', '-l', 'pyramid-seed-share', '--', 'hooks', 'lib', 'bin'], { cwd: ROOT, encoding: 'utf8' });
      return r.stdout.split('\n').filter(Boolean).every((f) => f === 'lib/core/pyramid-seed-share.cjs');
    })());
  }

  // -------------------------------------------------------------------------
  // Test 9: the Seed block
  // -------------------------------------------------------------------------
  {
    const blk = (t) => {
      const a = t.indexOf('<!-- seed:start -->');
      const b = t.indexOf('<!-- seed:end -->');
      return a === -1 || b === -1 ? null : t.slice(a, b + 17);
    };
    const c = blk(fs.readFileSync(CMD, 'utf8'));
    const k = blk(fs.readFileSync(SKILL, 'utf8'));
    const flat = (c || '').replace(/\s+/g, ' ');
    check('Test 9.1: the command and the skill hold byte equal Seed blocks', c !== null && c === k);
    check('Test 9.2: the block offers the share once and sends nothing before a yes',
      /Offer once: I can make a public page of this on Vercel\./.test(flat) && /Show the page text with the share card first/.test(flat) && /send nothing before the person says yes/.test(flat));
    check('Test 9.3: the block names the share script card and send commands',
      /pyramid-seed-share\.cjs card --id/.test(flat) && /pyramid-seed-share\.cjs send --id ID --confirm HASH/.test(flat));
    const head = (rel) => spawnSync('git', ['show', 'HEAD:' + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout;
    const fm = (t) => { const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(t); return m ? m[1] : ''; };
    check('Test 9.4: the command frontmatter (teaching, help_jtbd) is byte equal to HEAD',
      fm(fs.readFileSync(CMD, 'utf8')) === fm(head('commands/structure-argument.md')) && fm(fs.readFileSync(SKILL, 'utf8')) === fm(head('skills/structure-argument/SKILL.md')));
  }

  // -------------------------------------------------------------------------
  // Test 10: no em dash, no en dash in the files of this plan
  // -------------------------------------------------------------------------
  {
    const files = [MODULE, SCRIPT, __filename, CMD, SKILL];
    const bad = files.filter((f) => fs.existsSync(f) && /[\u2013\u2014]/.test(fs.readFileSync(f, 'utf8')));
    check('Test 10: no em dash or en dash in the files of this plan', files.every((f) => fs.existsSync(f)) && bad.length === 0, bad.join(','));
  }

  console.log('\ntest-389-share: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.log('FAIL crashed :: ' + (e && e.stack || e)); process.exit(1); });
