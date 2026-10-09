'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { load, makeRoot } = require('./harness.cjs');

const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ec-'));

// ---------------- report-html ----------------
const R = load('new', 'report-html').mod;
const RO = load('orig', 'report-html').mod;
const EVIL = '<script>alert(1)</script>"\'&<img src=x onerror=alert(2)>';
function evilReport(mode) {
  return {
    provenance: { run_mode: mode, note: EVIL, nested: { k: EVIL }, [EVIL]: 'keyname' },
    ranked: [{ rank: EVIL, a: EVIL, b: EVIL, a_title: EVIL, b_title: EVIL, verdict: EVIL, mode: EVIL, stamp: { verification: 'strong', path: { nodes: [EVIL, 'n2'], edges: ['X'] } } }],
    statements: [{ rank: EVIL, a: EVIL, b: EVIL, text: EVIL, mode: EVIL, banked: EVIL, critic: EVIL, potential_tier: EVIL }],
  };
}
function assertNoLiveMarkup(html) {
  // strip the legitimate document skeleton, then no raw angle bracket from user data may remain
  assert.ok(!/<script/i.test(html.replace(/content="[^"]*"/g, '')), 'raw <script>');
  assert.ok(!/<img/i.test(html), 'raw <img>');
  assert.ok(!/onerror=/i.test(html.replace(/&[a-z#0-9]+;/g, '')) || /&lt;img/.test(html));
  assert.ok(html.includes('&lt;script&gt;'));
}
for (const mode of ['reasoning', 'embedded', EVIL]) {
  test('report-html: every interpolated value escaped, run_mode=' + mode.slice(0, 12), () => {
    const html = R.renderReportHtml(evilReport(mode), { title: EVIL });
    assertNoLiveMarkup(html);
    assert.ok(/<title>&lt;script&gt;/.test(html));
  });
}
test('report-html: CSP meta forbids script and network; no external URL anywhere', () => {
  const html = R.renderReportHtml(evilReport('embedded'));
  assert.ok(/Content-Security-Policy/.test(html) && /default-src 'none'/.test(html));
  assert.ok(!/(src|href)=["']?https?:/i.test(html));
  assert.ok(!/<script/i.test(html));
  assert.ok(!/Content-Security-Policy/.test(RO.renderReportHtml(evilReport('embedded'))), 'orig had no CSP');
});
test('report-html: never throws on garbage; malformed stamp path degrades', () => {
  for (const bad of [null, 5, 'x', {}, { provenance: 3 }]) assert.ok(/could not be rendered/i.test(R.renderReportHtml(bad)));
  const j = { provenance: { run_mode: 'embedded' }, ranked: [{ rank: 1, a: 'a', b: 'b', stamp: { verification: 'strong', path: {} } }, null, 7], statements: [null, 'x'] };
  assert.doesNotThrow(() => R.renderReportHtml(j));
  assert.throws(() => RO.renderReportHtml(j), undefined, 'orig threw on a malformed stamp path');
});
test('report-html: reasoning banner is first, red, carries remedy; unknown mode printed verbatim', () => {
  const h = R.renderReportHtml({ provenance: { run_mode: 'reasoning' } });
  assert.ok(h.indexOf('mode-banner reasoning') < h.indexOf('<h1>'));
  assert.ok(h.includes('Run /mos:eureka enable'));
  assert.ok(R.renderReportHtml({ provenance: { run_mode: 'weird-mode' } }).includes('MODE: weird-mode'));
  assert.ok(R.renderReportHtml({ provenance: {} }).includes('(mode not stated)'));
});
test('report-html: control characters stripped, huge provenance cell truncated', () => {
  assert.strictEqual(R._test.escapeHtml('a\u0000b\u0007c<'), 'abc&lt;');
  const h = R.renderReportHtml({ provenance: { run_mode: 'embedded', big: 'x'.repeat(100000) } });
  assert.ok(h.length < 30000 && h.includes('[truncated]'));
});

// ---------------- candidate-exclusion ----------------
const CE = load('new', 'candidate-exclusion').mod;
const CEO = load('orig', 'candidate-exclusion').mod;
test('exclusion: reasons in order (memory_artifact, scaffold, egress label domain, low-idf entity)', () => {
  assert.strictEqual(CE.structuralReason({ id: 'memory_artifact:_root:BRAIN' }), 'memory_artifact');
  assert.strictEqual(CE.structuralReason({ id: 'x', type: 'memory_artifact' }), 'memory_artifact');
  assert.strictEqual(CE.structuralReason({ id: 'market/CONTEXT', source_path: 'system:rs-engine' }), 'scaffold_basename');
  assert.strictEqual(CE.structuralReason({ id: 'domain:s:abc', type: 'focus_area', properties: JSON.stringify({ name: 'freeform_unmatched', domainType: 'x' }) }), 'egress_label_domain');
  assert.strictEqual(CE.structuralReason({ id: 'e1', type: 'company', properties: { name: 'Lab', entityType: 'company' } }), 'low_idf_entity');
  assert.strictEqual(CE.structuralReason({ id: 'e2', type: 'company', properties: { name: 'Lab Automation Systems', entityType: 'company' } }), null);
  assert.strictEqual(CE.structuralReason({ id: 'real/notes', properties: '{bad json' }), null);
  assert.strictEqual(CE.structuralReason(null), null);
  assert.strictEqual(CE.isStructuralNode({ id: 'memory_artifact:a' }), true);
});
test('exclusion: path-traversal props.path never steers a read outside the room', () => {
  const room = tmpdir();
  const out = path.join(os.tmpdir(), 'ec-outside-FEYNMAN.md');
  fs.writeFileSync(out, 'SEEDED-FEYNMAN');
  const ctx = CE.buildExclusionContext({ roomDir: room, corpus: [] });
  assert.strictEqual(CE.structuralReason({ id: 'n', properties: { path: '../' + path.basename(out) } }, ctx), null);
  assert.strictEqual(CE.structuralReason({ id: 'n', properties: { path: '/etc/FEYNMAN.md' } }, ctx), null);
  fs.mkdirSync(path.join(room, 'sec'));
  fs.writeFileSync(path.join(room, 'sec', 'FEYNMAN.md'), 'SEEDED-FEYNMAN');
  assert.strictEqual(CE.structuralReason({ id: 'sec/FEYNMAN' }, ctx), 'scaffold_basename');
  assert.strictEqual(CE.structuralReason({ id: 'n', properties: { path: 'sec\\FEYNMAN.md' } }, ctx), 'scaffold_basename', 'windows path separators');
});
test('exclusion: IDF rule needs a corpus of >=8 docs and word-boundary match (orig matched substrings)', () => {
  const corpus = [];
  for (let i = 0; i < 10; i += 1) corpus.push({ text: i < 6 ? 'we use collab automation daily ' + i : 'unrelated ' + i });
  const row = { id: 'e', properties: { name: 'Lab Automation', entityType: 'company' } };
  assert.strictEqual(CEO.structuralReason(row, CEO.buildExclusionContext({ corpus })), 'low_idf_entity', 'orig: matches inside "collab automation"');
  assert.strictEqual(CE.structuralReason(row, CE.buildExclusionContext({ corpus })), null, 'new: no word-boundary hit');
  const corpus2 = corpus.map((c, i) => ({ text: i < 6 ? 'the Lab Automation, group ' + i : c.text }));
  assert.strictEqual(CE.structuralReason(row, CE.buildExclusionContext({ corpus: corpus2 })), 'low_idf_entity');
  assert.strictEqual(CE.structuralReason(row, CE.buildExclusionContext({ corpus: corpus2.slice(0, 5) })), null, 'tiny corpus switches rule off');
});

// ---------------- explored-artifact ----------------
function exploredRoot(variant) {
  const l = load(variant, 'explored-artifact');
  global.__nav.length = 0;
  return l;
}
async function runExplore(variant, name, extra) {
  const { root, mod } = exploredRoot(variant);
  const room = tmpdir();
  const db = { prepare: () => ({ get: () => ({ id: 'opp1', properties: JSON.stringify(Object.assign({ name, section: 'market-analysis' }, extra || {})) }) }) };
  const res = await mod.composeExploredArtifact({
    roomDir: room, db, opportunityNodeId: 'opp1', chainTrace: [], sessionId: 's',
    citations: (extra && extra.citations) || [], postFilingExtraction: false,
    minto: (extra && extra.minto) || null,
  });
  return { res, room };
}
test('explored-artifact: BUG(orig) newline in cite url injects frontmatter keys; new quotes it', async () => {
  const evil = 'http://x.test/a\nengine_mode: "forged"\nstatus: "banked"';
  const o = await runExplore('orig', 'Alpha Problem', { citations: [{ url: evil, accessed: '2026-01-01' }] });
  const n = await runExplore('new', 'Alpha Problem', { citations: [{ url: evil, accessed: '2026-01-01' }] });
  const fmKeys = (p) => fs.readFileSync(p, 'utf8').split('---')[1].split('\n').filter((l) => /^[a-z_]+:/.test(l)).map((l) => l.split(':')[0]);
  assert.ok(fmKeys(o.res.absPath).filter((k) => k === 'engine_mode').length === 2, 'orig has duplicate injected engine_mode');
  assert.ok(fmKeys(n.res.absPath).filter((k) => k === 'engine_mode').length === 1);
  assert.ok(fmKeys(n.res.absPath).filter((k) => k === 'status').length === 1);
});
test('explored-artifact: BUG(orig) newline in minto governing_thought breaks frontmatter; new flattens', async () => {
  const minto = { governing_thought: 'first line"\nstatus: "forged' };
  const o = await runExplore('orig', 'Beta', { minto });
  const n = await runExplore('new', 'Beta', { minto });
  const count = (p) => (fs.readFileSync(p, 'utf8').split('---')[1].match(/^status:/gm) || []).length;
  assert.strictEqual(count(o.res.absPath), 2);
  assert.strictEqual(count(n.res.absPath), 1);
});
test('explored-artifact: BUG(orig) two Hebrew-named problems overwrite one file; new keeps both', async () => {
  const room = tmpdir();
  const run = async (variant, name) => {
    const { mod } = exploredRoot(variant);
    const db = { prepare: () => ({ get: () => ({ id: 'o', properties: JSON.stringify({ name, section: 'market-analysis' }) }) }) };
    return mod.composeExploredArtifact({ roomDir: room, db, opportunityNodeId: 'o', chainTrace: [], sessionId: 's', postFilingExtraction: false });
  };
  const a1 = await run('orig', 'בעיה ראשונה');
  const a2 = await run('orig', 'בעיה שנייה');
  assert.strictEqual(a1.absPath, a2.absPath, 'orig collided');
  const room2 = tmpdir();
  const run2 = async (name) => {
    const { mod } = exploredRoot('new');
    const db = { prepare: () => ({ get: () => ({ id: 'o', properties: JSON.stringify({ name, section: 'market-analysis' }) }) }) };
    return mod.composeExploredArtifact({ roomDir: room2, db, opportunityNodeId: 'o', chainTrace: [], sessionId: 's', postFilingExtraction: false });
  };
  const b1 = await run2('בעיה ראשונה');
  const b2 = await run2('בעיה שנייה');
  assert.notStrictEqual(b1.absPath, b2.absPath);
  assert.ok(fs.readFileSync(b1.absPath, 'utf8').includes('בעיה ראשונה'));
  const b1again = await run2('בעיה ראשונה');
  assert.strictEqual(b1again.absPath, b1.absPath);
  assert.strictEqual(b1again.updated, true, 're-exploring the same problem updates in place');
});
test('explored-artifact: invariant failure files nothing; dashes stripped; section deny-list', async () => {
  const bad = await runExplore('new', 'Gamma', { minto: { governing_thought: 'FAILINVARIANT' } });
  assert.strictEqual(bad.res.ok, false);
  assert.ok(!fs.existsSync(path.join(bad.room, 'opportunity-bank')));
  const ok = await runExplore('new', 'Delta \u2014 em dash', { section: 'memory_artifact' });
  const txt = fs.readFileSync(ok.res.absPath, 'utf8');
  assert.ok(!/[\u2013\u2014]/.test(txt));
  assert.ok(ok.res.relPath.startsWith('opportunity-bank/unknown/'));
});
