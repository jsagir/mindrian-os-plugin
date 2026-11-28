#!/usr/bin/env node
'use strict';
// Phase 400.2-07: the citation boundary with self-found sources (owner answer 1, FS-5).
// Legs H1 to H7. Plan 09 adds H8 and H9 (the dispatch contracts of the command); plan 13 adds H10 to H13 (real packs); plan 14 adds H14 (the handle contract).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

let door;
try {
  door = require(DOOR_PATH);
} catch (e) {
  console.log('FAIL: the door is missing: ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}

const RUN = '20261125-102030-abcd';
const SQ = ['sq-00000001', 'sq-00000002'];
const CTX = { runId: RUN, subQuestionIds: SQ };
const OWN_ID = 'EvidenceClaim:s1:own';
const WHITE_ID = 'EvidenceClaim:s1:wht';
const YELLOW_URL = 'https://yellow.example.org/found';
const BLACK_URL = 'https://black.example.org/found';
const SETS = { ownIds: [OWN_ID], whiteIds: [WHITE_ID], ownUrls: ['https://pack.example.org/p', 'https://www.pack.example.org/q'], whiteUrls: ['https://white.example.org/w'] };

function foundSource(url) {
  return { url, title: 'A page', search_string: 'a search', summary: 'A summary.' };
}

function black(over) {
  return Object.assign({
    schema: 'mos.persona-reading/1',
    run_id: RUN,
    hat: 'black',
    positions: SQ.map(id => ({ sub_question: id, value: 'opposes', line: 'A line.' })),
    evidence: [{ source: OWN_ID, tier: 'T2', disposition: 'disconfirming', note: 'A counter.' }],
    steelman: 'The best case.',
    self_search_strings: ['a search'],
    self_found_sources: [foundSource(BLACK_URL)],
  }, over || {});
}

const cite = (hat, r) => door.citationCheck(hat, r, SETS);

// H1
check('H1. NEGATIVE: a black reading cites a URL that only a yellow reading found: rejected', () => {
  const r = black({ evidence: [{ source: YELLOW_URL, tier: 'self_found', disposition: 'disconfirming' }] });
  assert.equal(door.validateReading('black', r, CTX).ok, true);
  const out = cite('black', r);
  assert.equal(out.ok, false);
  assert.equal(out.state, 'rejected:citation_outside_sources');
  assert.equal(JSON.stringify(out).includes(YELLOW_URL), false, 'the refused text is not echoed');
});

// H2
check('H2. a black reading cites the url of its own self-found source: passes', () => {
  const r = black({ evidence: [{ source: BLACK_URL, tier: 'self_found', disposition: 'disconfirming' }, { source: OWN_ID, tier: 'T2', disposition: 'confirming' }, { source: WHITE_ID, tier: 'T2', disposition: 'confirming' }] });
  assert.deepEqual(cite('black', r), { ok: true });
});

// H3
check('H3. NEGATIVE: a URL in a position line, steelman, provocation or missing_data line outside the set is rejected', () => {
  const forms = ['http://other.example.org/a', 'https://other.example.org/a', 'www.other.example.org/a'];
  for (const f of forms) {
    const line = black({ positions: SQ.map(id => ({ sub_question: id, value: 'opposes', line: 'See ' + f + ' for the data.' })) });
    assert.equal(cite('black', line).state, 'rejected:citation_outside_sources', 'position ' + f);
    assert.equal(cite('black', black({ steelman: 'Per ' + f + ' the case holds.' })).ok, false, 'steelman ' + f);
    assert.equal(cite('green', { provocations: ['Look at ' + f] }).ok, false, 'provocation ' + f);
    assert.equal(cite('white', { missing_data: ['Not in ' + f] }).ok, false, 'missing_data ' + f);
  }
  // The same forms are fine when the URL is allowed.
  assert.equal(cite('black', black({ steelman: 'Per ' + BLACK_URL + ' the case holds.' })).ok, true);
  assert.equal(cite('black', black({ steelman: 'Per www.pack.example.org/q the case holds.' })).ok, true);
  assert.equal(cite('black', black({ steelman: 'Per www.black.example.org/found the case holds.' })).ok, false);
  // A URL deep in a field of a self-found source (title) is scanned too.
  const title = black({ self_found_sources: [Object.assign(foundSource(BLACK_URL), { title: 'Copy of https://other.example.org/x' })] });
  assert.equal(cite('black', title).ok, false);
  // The url field of a self-found source itself is the allowed set, not a violation.
  assert.equal(cite('black', black({ self_found_sources: [foundSource('https://another.example.org/z')], evidence: [] })).ok, true);
});

// H4
check('H4. NEGATIVE: an EvidenceClaim id outside the allowed ids is rejected, in any string field', () => {
  const outside = 'EvidenceClaim:s1:zzz';
  assert.equal(cite('black', black({ steelman: 'This follows ' + outside + '.' })).state, 'rejected:citation_outside_sources');
  assert.equal(cite('green', { provocations: ['What about (' + outside + ')?'] }).ok, false);
  assert.equal(cite('white', { missing_data: ['Missing: ' + outside] }).ok, false);
  assert.equal(cite('black', black({ steelman: 'This follows ' + OWN_ID + '.' })).ok, true);
  assert.equal(cite('black', black({ steelman: 'This follows ' + WHITE_ID + ', and more.' })).ok, true);
  // An id used as the source of an evidence item is checked by id.
  assert.equal(cite('black', black({ evidence: [{ source: outside, tier: 'T2', disposition: 'disconfirming' }] })).ok, false);
});

// H5
check('H5. NEGATIVE: a red reading and a blue reading with self-found sources or strings are refused', () => {
  const red = { schema: 'mos.persona-reading/1', run_id: RUN, hat: 'red', positions: SQ.map(id => ({ sub_question: id, value: 'favours', line: 'A line.' })) };
  for (const k of ['self_found_sources', 'self_search_strings']) {
    const r1 = door.validateReading('red', Object.assign({}, red, { [k]: [] }), CTX);
    assert.equal(r1.reason, 'forbidden_key:' + k);
    const r2 = door.validateReading('blue', { schema: 'mos.persona-reading/1', run_id: RUN, hat: 'blue', [k]: [] }, CTX);
    assert.equal(r2.reason, 'forbidden_key:' + k);
  }
});

// H5b (WR-02)
check('H5b. WR-02 NEGATIVE: red gives no evidence: a red line that cites a White id or a White URL is rejected, even with the White sets passed', () => {
  const red = (line) => ({ schema: 'mos.persona-reading/1', run_id: RUN, hat: 'red', positions: SQ.map(id => ({ sub_question: id, value: 'favours', line })) });
  for (const line of ['see ' + WHITE_ID + ' for the fact', 'see https://white.example.org/w for the fact', 'see ' + OWN_ID]) {
    const r = red(line);
    assert.equal(door.validateReading('red', r, CTX).ok, true);
    const out = cite('red', r);
    assert.equal(out.ok, false, line);
    assert.equal(out.state, 'rejected:citation_outside_sources', line);
  }
  assert.deepEqual(cite('red', red('A gut feeling, no source.')), { ok: true });
  // the same White id is still allowed for a researching hat
  assert.deepEqual(cite('black', black({ positions: SQ.map(id => ({ sub_question: id, value: 'opposes', line: 'see ' + WHITE_ID })) })), { ok: true });
});

// H6
check('H6. both violation strings of validateCitations map to rejected:citation_outside_sources', () => {
  const outside = black({ evidence: [{ source: 'EvidenceClaim:s1:nope', tier: 'T2', disposition: 'disconfirming' }] });
  const missing = black({ evidence: [{ tier: 'T2', disposition: 'disconfirming' }] });
  for (const r of [outside, missing]) {
    assert.equal(door.validateReading('black', r, CTX).ok, true);
    const out = cite('black', r);
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'citation_outside_sources');
    assert.equal(out.state, 'rejected:citation_outside_sources');
  }
});

// H7
check('H7. a final slash or a final full stop does not matter; any other difference does', () => {
  const urlIn = (u) => cite('black', black({ steelman: 'See ' + u }));
  assert.equal(urlIn(BLACK_URL + '/').ok, true);
  assert.equal(urlIn(BLACK_URL + '.').ok, true);
  assert.equal(urlIn(BLACK_URL + '/.').ok, true);
  assert.equal(urlIn(BLACK_URL + 'x').ok, false);
  assert.equal(urlIn(BLACK_URL + '/more').ok, false);
  assert.equal(urlIn('http://black.example.org/found').ok, false);
  assert.equal(urlIn('https://black.example.org/foun').ok, false);
  // The evidence source is compared in the same way.
  const src = (u) => cite('black', black({ evidence: [{ source: u, tier: 'self_found', disposition: 'disconfirming' }] }));
  assert.equal(src(BLACK_URL + '/').ok, true);
  assert.equal(src(BLACK_URL + '.').ok, true);
  assert.equal(src(BLACK_URL + 'x').ok, false);
});

// ---------------------------------------------------------------------------
// Plan 09: the dispatch contracts of commands/persona.md (owner answer 1)
// ---------------------------------------------------------------------------

const CMD_TEXT = fs.readFileSync(path.join(ROOT, 'commands', 'persona.md'), 'utf8');
const FS3 = 'Put no venture name, person name, figure or other room detail in a search string. This is a rule for you. No code checks it.';
// Phase 400.2.1 (S5): the reader contract names the reader search screen hook instead of "No code checks it.".
const FS3_READER = 'Put no venture name, person name, figure or other room detail in a search string. This is a rule for you. While this run is open, a hook of the plugin also screens each WebSearch query and each WebFetch url for room words before it leaves the machine, and blocks a search that holds one.';
const NO_WEB = 'this step makes no web search: do not call WebSearch or WebFetch.';
function contract(name) {
  const a = CMD_TEXT.indexOf('<!-- contract:' + name + ':start -->');
  const b = CMD_TEXT.indexOf('<!-- contract:' + name + ':end -->');
  assert.ok(a >= 0 && b > a, 'contract block ' + name);
  return CMD_TEXT.slice(a, b);
}

// H8
check('H8. every contract holds both Brain bans and FS-3; the builder, Blue and the red rule say the step makes no web search', () => {
  for (const name of ['builder', 'reader', 'blue']) {
    const c = contract(name);
    assert.ok(/Do not call brain_search or brain_query/.test(c), name + ': both Brain bans');
    assert.ok(c.includes(name === 'reader' ? FS3_READER : FS3), name + ': FS-3 word for word');
    assert.ok(c.toLowerCase().includes(NO_WEB.toLowerCase()), name + ': the step makes no web search');
  }
  // The four searching hats may use the two web tools in the reader contract only.
  assert.ok(/White, black, yellow and green may use WebSearch and WebFetch/.test(contract('reader')));
  for (const name of ['builder', 'blue']) {
    assert.ok(!/may use WebSearch/.test(contract(name)), name + ' allows no web tool');
  }
  const red = contract('reader').split('\n').filter((l) => /red/i.test(l) && /no web search/.test(l));
  assert.ok(red.length >= 1, 'the red rule line');
});

// H9
check('H9. the reader contract passes red the White copy and no evidence file of its own; the Blue contract passes the ledger and no White copy', () => {
  const reader = contract('reader');
  assert.ok(/red: `shared-white\.json` only/i.test(reader), 'red gets shared-white.json only');
  assert.ok(/red has no `evidence\.json`/i.test(reader), 'red has no evidence file');
  assert.ok(/white, black, yellow and green: `shared-white\.json` and `evidence\.json`/i.test(reader), 'the other four get both files');
  const blue = contract('blue');
  assert.ok(blue.includes('`ledger.json`'), 'Blue gets ledger.json');
  assert.ok(!/shared-white|evidence\.json/.test(blue), 'Blue gets no White copy and no evidence file');
});

// H14
check('H14. the handle contract gives the brief and the own persona file only: no room section, no White package, no evidence path', () => {
  const c = contract('handles');
  assert.ok(/no room section/i.test(c), 'no room section');
  assert.ok(/no White package/i.test(c), 'no White package');
  assert.ok(!/shared-white|evidence\.json|ledger\.json/.test(c), 'names no evidence path and no ledger');
  assert.ok(/Inputs:[^\n]*the brief[^\n]*own persona file/i.test(c), 'inputs: the brief and the own persona file');
  assert.ok(!/reading list/i.test(c.replace(/no reading list/gi, '')), 'the reading list is not passed');
  assert.ok(/Do not call brain_search or brain_query/.test(c) && c.includes(FS3), 'both Brain bans and FS-3');
  assert.ok(c.toLowerCase().includes(NO_WEB.toLowerCase()), 'the step makes no web search');
  assert.ok(!/may use WebSearch/.test(c), 'no web tool is allowed');
});

// ---------------------------------------------------------------------------
// Plan 13: the boundary with real door evidence (a real run-research, then check)
// ---------------------------------------------------------------------------

const fx = require(path.join(__dirname, 'fixtures', 'persona-run-4002.cjs'));
const asyncLegs = [];
function acheck(label, fn) {
  asyncLegs.push({ label, fn });
}

const SELF_URL_WHITE = 'https://self-found.example.net/white-page';
const SELF_URL_BLACK = 'https://self-found.example.net/black-page';
function foundBy(url, searchString) {
  return { url, title: 'A page', search_string: searchString, summary: 'A summary.' };
}

/** Run the research for all four hats, write the five readings (over(ctx) gives overrides by hat) and the Blue reading, then check. */
async function runAndCheck(over, researchOptions) {
  const { ctx } = await fx.researched(researchOptions);
  const o = typeof over === 'function' ? over(ctx) : (over || {});
  for (const h of fx.READ_HATS) fx.writeReading(ctx, h, fx.readingOf(ctx, h, o[h]));
  fx.writeReading(ctx, 'blue', fx.blueReadingOf(ctx));
  const out = fx.doCheck(ctx);
  assert.equal(out.ok, true, JSON.stringify(out));
  return { ctx, out };
}

// H10
acheck('H10. NEGATIVE: after a real run-research, a black reading that cites a yellow item id, or a yellow URL in a position line, is rejected in check', async () => {
  await fx.withEnvAsync(fx.NO_KEYS, async () => {
    const yellowItem = (ctx) => fx.packOf(ctx, 'yellow').items[0];
    const r1 = await runAndCheck((ctx) => ({
      black: { evidence: [{ source: yellowItem(ctx).id, tier: 'Academic', disposition: 'disconfirming' }] },
    }));
    assert.equal(r1.out.hats.black.reading, 'rejected:citation_outside_sources', JSON.stringify(r1.out.hats.black));
    assert.ok(r1.out.not_run.some(n => n.hat === 'black'));
    assert.equal(r1.out.hats.white.reading, 'ran');
    assert.equal(JSON.stringify(r1.out).includes(yellowItem(r1.ctx).id), false, 'the refused id is not echoed');
    // The same run, a yellow URL in a black position line.
    const url = yellowItem(r1.ctx).url;
    const black = fx.readingOf(r1.ctx, 'black', { positions: r1.ctx.ids.map(id => ({ sub_question: id, value: 'opposes', line: 'See ' + url + ' for the data.' })) });
    fx.writeReading(r1.ctx, 'black', black);
    const out2 = fx.doCheck(r1.ctx);
    assert.equal(out2.hats.black.reading, 'rejected:citation_outside_sources', JSON.stringify(out2.hats.black));
    // Control: the item id of black's own pack is allowed.
    const own = fx.packOf(r1.ctx, 'black').items[0];
    fx.writeReading(r1.ctx, 'black', fx.readingOf(r1.ctx, 'black', { evidence: [{ source: own.id, tier: own.tier, disposition: 'disconfirming' }] }));
    assert.equal(fx.doCheck(r1.ctx).hats.black.reading, 'ran');
  });
});

// H11
acheck('H11. a black reading that cites a White package id passes; a red reading has no evidence key and passes', async () => {
  await fx.withEnvAsync(fx.NO_KEYS, async () => {
    const { ctx, out } = await runAndCheck((c) => {
      const w = fx.packOf(c, 'white').items[0];
      return { black: { evidence: [{ source: w.id, tier: w.tier, disposition: 'disconfirming' }] } };
    });
    assert.equal(out.hats.black.reading, 'ran', JSON.stringify(out.hats.black));
    assert.equal(out.hats.red.reading, 'ran', JSON.stringify(out.hats.red));
    // The White package that black reads is the White pack, byte for byte; red has no evidence file of its own.
    assert.equal(fs.readFileSync(path.join(ctx.res.hats.black.dir, 'shared-white.json'), 'utf8'), fs.readFileSync(path.join(ctx.res.hats.white.dir, 'evidence.json'), 'utf8'));
    assert.equal(fs.existsSync(path.join(ctx.res.hats.red.dir, 'evidence.json')), false);
    assert.equal(fs.existsSync(path.join(ctx.res.hats.red.dir, 'shared-white.json')), true);
  });
});

// H12
acheck('H12. a black reading that cites its own pack id and its own self-found url in one evidence list passes', async () => {
  await fx.withEnvAsync(fx.NO_KEYS, async () => {
    const { out } = await runAndCheck((c) => {
      const own = fx.packOf(c, 'black').items[0];
      return { black: {
        evidence: [{ source: own.id, tier: own.tier, disposition: 'disconfirming' }, { source: SELF_URL_BLACK, tier: 'self_found', disposition: 'confirming' }],
        self_search_strings: ['grid storage costs'],
        self_found_sources: [foundBy(SELF_URL_BLACK, 'grid storage costs')],
      } };
    });
    assert.equal(out.hats.black.reading, 'ran', JSON.stringify(out.hats.black));
    assert.equal(out.hats.black.evidence_items, 2);
    assert.equal(out.hats.black.self_found_sources, 1);
  });
});

// H13
acheck('H13. NEGATIVE: the self-found url of white is not in the allowed set of black (FS-11); black citing it is rejected', async () => {
  await fx.withEnvAsync(fx.NO_KEYS, async () => {
    const { ctx, out } = await runAndCheck({
      white: { evidence: [{ source: SELF_URL_WHITE, tier: 'self_found' }], self_search_strings: ['grid storage costs'], self_found_sources: [foundBy(SELF_URL_WHITE, 'grid storage costs')] },
      black: { evidence: [{ source: SELF_URL_WHITE, tier: 'self_found', disposition: 'disconfirming' }] },
    });
    assert.equal(out.hats.white.reading, 'ran', JSON.stringify(out.hats.white));
    assert.equal(out.hats.black.reading, 'rejected:citation_outside_sources', JSON.stringify(out.hats.black));
    // The shared package holds door evidence only: the self-found url of white is in no pack.
    for (const h of fx.READ_HATS) {
      const file = path.join(ctx.res.hats[h].dir, 'shared-white.json');
      assert.equal(fs.readFileSync(file, 'utf8').includes(SELF_URL_WHITE), false, h);
    }
  });
});

(async () => {
  for (const t of asyncLegs) {
    try {
      await t.fn();
      passed += 1;
      console.log('ok: ' + t.label);
    } catch (e) {
      failed += 1;
      console.log('FAIL: ' + t.label + ' -- ' + (e && e.message ? e.message : String(e)));
    }
  }
  fx.cleanup();
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
