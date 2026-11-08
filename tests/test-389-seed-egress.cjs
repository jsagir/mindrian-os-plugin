#!/usr/bin/env node
'use strict';

/*
 * Phase 389 plan 03 task 2: the card and run commands, the consent gate and the
 * Part 8 canary. The real CLI runs as a child process against a loopback capture
 * server. Part 8: every child gets a scratch HOME, a dummy Brain key, no Tavily
 * key and a loopback Brain URL. No live Brain call and no Tavily call.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO, 'scripts/pyramid-seed-run.cjs');
const cap = require('./helpers/brain-capture-server.cjs');
const fixtures = require('./fixtures/389/sprouts.json');
const sentences = require('./fixtures/389/sentences.json');

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass += 1; console.log('ok   ' + name); }
  else { fail += 1; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

const SLOT_ORDER = ['situation', 'complication', 'analogy', 'funding'];
function setHash(set) {
  const o = {};
  SLOT_ORDER.forEach((s) => { if (typeof set[s] === 'string') o[s] = set[s].trim(); });
  return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
}

function mkHome() { return fs.mkdtempSync(path.join(os.tmpdir(), 'seed-egress-')); }
function writeJson(dir, name, obj) { const p = path.join(dir, name); fs.writeFileSync(p, JSON.stringify(obj)); return p; }

function runCli(args, home, brainUrl) {
  return new Promise((resolve) => {
    const env = {
      PATH: process.env.PATH,
      HOME: home,
      USERPROFILE: home,
      MINDRIAN_BRAIN_URL: brainUrl,
      MINDRIAN_BRAIN_KEY: 'dummy-key-not-real',
      MINDRIAN_BRAIN_RETRY_MAX: '0',
    };
    const child = spawn(process.execPath, [SCRIPT].concat(args), { env, cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { err += c; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, 60000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err }); });
  });
}
function parse(s) { try { return JSON.parse(s); } catch (_e) { return null; } }

function countingServer() {
  const state = { requests: 0 };
  const server = http.createServer((req, res) => { state.requests += 1; req.resume(); res.writeHead(500); res.end('no'); });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, state, url: 'http://127.0.0.1:' + server.address().port })));
}

const OK_BODY = 'data: ' + JSON.stringify({ jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: 'Case one first line\nsecond line of the answer' }] } }) + '\n';

async function main() {
  const SET = fixtures['consumer-subscription'];
  const SENTENCE = sentences[0].sentence;
  const DEAD = 'http://127.0.0.1:1';

  // Test 1
  {
    const home = mkHome();
    const sp = writeJson(home, 'set.json', SET);
    const r = await runCli(['card', '--sprouts', sp], home, DEAD);
    const j = parse(r.out);
    check('Test 1: card exits 0 with JSON', r.code === 0 && j !== null, 'code ' + r.code + ' ' + r.err.slice(0, 120));
    const sha = setHash(SET);
    check('Test 1: sprouts_sha256 and card_id', j && j.sprouts_sha256 === sha && typeof j.card_id === 'string' && j.card_id.length > 0);
    check('Test 1: one line per slot with slot, destination, phrase', j && Array.isArray(j.lines) && j.lines.length === 4 && j.lines.every((l) => l.slot && l.destination && l.phrase));
    const byS = {}; (j && j.lines || []).forEach((l) => { byS[l.slot] = l; });
    check('Test 1: brain cells name Theo, funding names web search (Tavily)', byS.situation && /Theo/.test(byS.situation.destination) && byS.analogy && /Theo/.test(byS.analogy.destination) && byS.funding && /web search \(Tavily\)/.test(byS.funding.destination));
    const pend = path.join(home, '.mindrian', 'pyramid-seed', 'pending', sha + '.json');
    check('Test 1: pending record exists', fs.existsSync(pend));
    const rec = fs.existsSync(pend) ? fs.readFileSync(pend, 'utf8') : '';
    const recJ = parse(rec) || {};
    check('Test 1: pending record holds hash and timestamp, no phrase', recJ.sprouts_sha256 === sha && typeof recJ.created_at === 'string' && Object.values(SET).every((p) => rec.indexOf(p) === -1));
    // --home flag moves the record
    const home2 = mkHome();
    const r2 = await runCli(['card', '--sprouts', sp, '--home', home2], home, DEAD);
    check('Test 1: --home flag sets the pending folder', r2.code === 0 && fs.existsSync(path.join(home2, '.mindrian', 'pyramid-seed', 'pending', sha + '.json')));
  }

  // Test 2
  {
    const home = mkHome();
    const body = Array.from({ length: 60 }, (_, i) => 'ZZBODYWORD' + i).join(' ');
    const sp = writeJson(home, 'bad.json', { situation: body, funding: 'startup funding sources' });
    const r = await runCli(['card', '--sprouts', sp], home, DEAD);
    const j = parse(r.out);
    check('Test 2: body in a slot exits 2 and names slot and class', r.code === 2 && j && JSON.stringify(j).indexOf('situation') !== -1 && JSON.stringify(j).indexOf('not_sprout') !== -1, 'code ' + r.code + ' ' + r.out.slice(0, 160));
    check('Test 2: no text of the rejected value in any output', (r.out + r.err).indexOf('ZZBODYWORD') === -1);
    const pdir = path.join(home, '.mindrian', 'pyramid-seed', 'pending');
    check('Test 2: no pending record written', !fs.existsSync(pdir) || fs.readdirSync(pdir).length === 0);
    const sf = path.join(home, 'sentence.txt'); fs.writeFileSync(sf, SENTENCE);
    const sp2 = writeJson(home, 'shared.json', { situation: 'cook one proper dinner a week' });
    const r2 = await runCli(['card', '--sprouts', sp2, '--sentence-file', sf], home, DEAD);
    check('Test 2: phrase sharing 4 words with the sentence exits 2', r2.code === 2 && /shares_sentence_run/.test(r2.out), 'code ' + r2.code + ' ' + r2.out.slice(0, 160));
    check('Test 2: sentence never in the output', (r2.out + r2.err).indexOf(SENTENCE.slice(0, 40)) === -1);
  }

  // Test 3
  {
    const home = mkHome();
    const sp = writeJson(home, 'set.json', SET);
    const cs = await countingServer();
    const r = await runCli(['run', '--sprouts', sp], home, cs.url);
    check('Test 3: run with no pending record exits 3 card_required', r.code === 3 && (parse(r.out) || {}).error === 'card_required', 'code ' + r.code + ' ' + r.out.slice(0, 120));
    const r2 = await runCli(['run', '--sprouts', sp, '--confirm', setHash(SET)], home, cs.url);
    check('Test 3: run with a confirm value but no card exits 3', r2.code === 3 && (parse(r2.out) || {}).error === 'card_required');
    check('Test 3: capture server saw 0 requests', cs.state.requests === 0, String(cs.state.requests));
    await new Promise((res) => cs.server.close(res));
  }

  // Test 4
  {
    const home = mkHome();
    const cs = await countingServer();
    const sp = writeJson(home, 'set.json', SET);
    await runCli(['card', '--sprouts', sp], home, cs.url);
    const other = Object.assign({}, SET, { funding: 'seed grants for food startups' });
    const spOther = writeJson(home, 'other.json', other);
    const r = await runCli(['run', '--sprouts', spOther, '--confirm', setHash(SET)], home, cs.url);
    check('Test 4: confirm of another set exits 3', r.code === 3 && (parse(r.out) || {}).error === 'card_required', 'code ' + r.code);
    const r2 = await runCli(['run', '--sprouts', spOther, '--confirm', setHash(other)], home, cs.url);
    check('Test 4: matching hash without its own pending record exits 3', r2.code === 3);
    const r3 = await runCli(['run', '--sprouts', sp, '--confirm', 'abc'], home, cs.url);
    check('Test 4: malformed confirm exits 3', r3.code === 3);
    // edited after the card
    writeJson(home, 'set.json', other);
    const r4 = await runCli(['run', '--sprouts', sp, '--confirm', setHash(SET)], home, cs.url);
    check('Test 4: phrase file edited after the card exits 3', r4.code === 3);
    check('Test 4: pending record of the card survives refusals', fs.existsSync(path.join(home, '.mindrian', 'pyramid-seed', 'pending', setHash(SET) + '.json')));
    check('Test 4: no request reached the server', cs.state.requests === 0, String(cs.state.requests));
    await new Promise((res) => cs.server.close(res));
  }

  // Test 5
  {
    const home = mkHome();
    cap.resetCaptured(); cap.resetToolScript(); cap.setToolScript([{ status: 200, body: OK_BODY }]);
    const srv = await cap.startCaptureServer();
    const sp = writeJson(home, 'set.json', SET);
    const sha = setHash(SET);
    await runCli(['card', '--sprouts', sp], home, srv.url);
    const r = await runCli(['run', '--sprouts', sp, '--confirm', sha], home, srv.url);
    const j = parse(r.out);
    check('Test 5: card then run exits 0', r.code === 0 && j !== null, 'code ' + r.code + ' ' + r.err.slice(0, 200) + ' ' + r.out.slice(0, 200));
    check('Test 5: one entry per present slot with the fields', j && Array.isArray(j.cells) && j.cells.length === 4 && j.cells.every((c) => c.id && c.pyramid && c.status && typeof c.duration_ms === 'number' && 'summary_line' in c && 'excerpt' in c) && typeof j.elapsed_ms === 'number');
    const byId = {}; (j && j.cells || []).forEach((c) => { byId[c.id] = c; });
    check('Test 5: Brain cells are ok with the answer', byId.similar_cases && byId.similar_cases.status === 'ok' && byId.similar_cases.summary_line === 'Case one first line' && byId.known_traps.status === 'ok' && byId.analogies.status === 'ok');
    check('Test 5: funding cell is empty without a Tavily key', byId.funding && byId.funding.status === 'empty');
    check('Test 5: pending record deleted', !fs.existsSync(path.join(home, '.mindrian', 'pyramid-seed', 'pending', sha + '.json')));
    const r2 = await runCli(['run', '--sprouts', sp, '--confirm', sha], home, srv.url);
    check('Test 5: second run with the same hash exits 3 (single use)', r2.code === 3);
    check('Test 5: second run made no more Brain calls', cap.captured.length === 3, String(cap.captured.length));
    await cap.stopCaptureServer(srv.server); cap.resetToolScript();
  }

  // Test 6 (canary)
  {
    const home = mkHome();
    cap.resetCaptured(); cap.resetToolScript();
    const srv = await cap.startCaptureServer();
    for (const fx of sentences) {
      cap.resetCaptured();
      const set = fixtures[fx.id];
      const sp = writeJson(home, fx.id + '.json', set);
      const sf = path.join(home, fx.id + '.txt'); fs.writeFileSync(sf, fx.sentence);
      const card = await runCli(['card', '--sprouts', sp, '--sentence-file', sf], home, srv.url);
      const run = await runCli(['run', '--sprouts', sp, '--confirm', setHash(set)], home, srv.url);
      const approved = [set.situation, set.complication, set.analogy];
      const qs = cap.captured.map((c) => (c.arguments && (c.arguments.query || c.arguments.question)));
      check('Test 6 [' + fx.id + ']: card and run exit 0', card.code === 0 && run.code === 0, card.code + '/' + run.code + ' ' + card.err.slice(0, 120));
      check('Test 6 [' + fx.id + ']: three Brain calls captured (not vacuous)', cap.captured.length === 3 && cap.captured.every((c) => c.name === 'brain_search'), JSON.stringify(cap.captured).slice(0, 200));
      check('Test 6 [' + fx.id + ']: every captured query is an approved phrase', qs.every((q) => approved.indexOf(q) !== -1), JSON.stringify(qs));
      const words = fx.sentence.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ');
      const runs = []; for (let i = 0; i + 4 <= words.length; i += 1) runs.push(' ' + words.slice(i, i + 4).join(' ') + ' ');
      const wire = ' ' + JSON.stringify(cap.captured).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
      check('Test 6 [' + fx.id + ']: no captured argument shares a 4-word run with the sentence', runs.every((rw) => wire.indexOf(rw) === -1));
      check('Test 6 [' + fx.id + ']: the sentence is not in the card or run output', (card.out + card.err + run.out + run.err).indexOf(fx.sentence.slice(0, 30)) === -1);
    }
    await cap.stopCaptureServer(srv.server);
  }

  // Test 7
  {
    const home = mkHome();
    const sp = writeJson(home, 'set.json', SET);
    await runCli(['card', '--sprouts', sp], home, DEAD);
    const t0 = Date.now();
    const r = await runCli(['run', '--sprouts', sp, '--confirm', setHash(SET), '--budget-ms', '8000'], home, DEAD);
    const j = parse(r.out);
    check('Test 7: dead Brain, run exits 0', r.code === 0 && j !== null, 'code ' + r.code + ' ' + r.err.slice(0, 200));
    const brainCells = (j && j.cells || []).filter((c) => c.id !== 'funding');
    check('Test 7: every Brain cell is empty with a typed reason', brainCells.length === 3 && brainCells.every((c) => c.status === 'empty' && typeof c.reason === 'string' && c.reason.length > 0), JSON.stringify(brainCells).slice(0, 300));
    check('Test 7: inside the budget', Date.now() - t0 < 20000, String(Date.now() - t0));
  }

  // Test 8
  {
    const home = mkHome();
    const r = await runCli(['bogus'], home, DEAD);
    check('Test 8: unknown subcommand exits 1 with a usage line', r.code === 1 && /usage/i.test(r.err), 'code ' + r.code + ' ' + r.err.slice(0, 100));
    const r2 = await runCli(['card'], home, DEAD);
    check('Test 8: missing --sprouts exits 1', r2.code === 1 && /usage/i.test(r2.err));
    const r3 = await runCli([], home, DEAD);
    check('Test 8: no command exits 1', r3.code === 1);
    const r4 = await runCli(['card', '--sprouts', path.join(home, 'nope.json')], home, DEAD);
    check('Test 8: unreadable phrase file exits 2 invalid', r4.code === 2);
  }

  // Test 9
  {
    const src = fs.existsSync(SCRIPT) ? fs.readFileSync(SCRIPT, 'utf8') : '';
    check('Test 9: script exists', src.length > 0);
    check('Test 9: no room-db require', !/room-db/.test(src));
    check('Test 9: no em dash or en dash', !/[\u2013\u2014]/.test(src));
    const writes = (src.match(/(writeFileSync|appendFileSync|renameSync|mkdirSync|copyFileSync|createWriteStream)/g) || []);
    check('Test 9: file writes limited to the pending record helper', writes.every((w) => ['writeFileSync', 'renameSync', 'mkdirSync'].indexOf(w) !== -1) && !/appendFile|copyFile|createWriteStream/.test(src));
    check('Test 9: this test holds no em dash or en dash', !/[\u2013\u2014]/.test(fs.readFileSync(__filename, 'utf8')));
  }

  console.log('test-389-seed-egress: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.log('FAIL uncaught :: ' + String(e && e.stack).slice(0, 400)); process.exit(1); });
