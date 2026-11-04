#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 01 Task 2 (NS369.6-03, NS369.6-04, NS369.6-15; D-07, D-08, D-10, D-13, D-29, D-31, D-33).
 * The pure reply checks of lib/hmi/larry-reply-checks.cjs run against the labelled corpus
 * tests/fixtures/3696-voice-corpus.json.
 *
 *   one PASS or FAIL line per corpus row: every expectation of the row (ok, kinds, value, fields) holds
 *   C1  every original row carries source_sha256 equal to the sha256 of its text (Codex C11)
 *   C2  every normalized row names an existing original row and a normalization rule, and differs from
 *       its original only by the rule it names
 *   C3  the corpus holds the seven plurai-02 rows, probes A to D and sample E, and a normalized twin for
 *       each L3 model exchange
 *   C4  every exported check has at least one passing row and one failing row
 *   C5  the immutable-source register names the original corpus rows by field
 *   C6  Theo is not on the never-say list (R-20); the tool ids resolve from the generated registry
 *   C7  no em dash or en dash in this file, the module or the corpus; the corpus holds no non-ASCII byte
 *   C8  the module requires only node built-ins and voice-color-mark at the top level; no network call
 *
 * Hermetic: HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, MINDRIAN_ROOMS_ROOT and CLAUDE_CONFIG_DIR are mkdtemp
 * dirs before any repo require; a net guard counts any fetch.
 *
 * Output: one PASS or FAIL line per leg, then a final line PASS: n FAIL: n. Exit 0 only when FAIL is 0.
 * House rule: hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const HOME_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-3696-checks-'));
['HOME', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR'].forEach(function (k) {
  const d = path.join(HOME_TMP, k.toLowerCase());
  fs.mkdirSync(d, { recursive: true });
  process.env[k] = d;
});
process.env.USERPROFILE = process.env.HOME;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3696-reply-checks');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'lib', 'hmi', 'larry-reply-checks.cjs');
const CORPUS_PATH = path.join(__dirname, 'fixtures', '3696-voice-corpus.json');
const REGISTER_PATH = path.join(__dirname, 'fixtures', '3696-immutable-sources.json');
const m = require(MODULE_PATH);
const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
const rows = corpus.rows;
const sha = function (s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); };

const CHECKS = ['countSentences', 'countQuestions', 'checkIdentityLine', 'checkFirstReply', 'findBannedPhrases', 'findDashes',
  'detectFrameworkDump', 'findUnbackedStrongWords', 'findCorpusAbsence', 'findConsistencyAsSupport', 'findApologyClose', 'findIdLeak',
  'findUndefinedFirstUse', 'findOpeningPronoun', 'findMachineryNarration', 'findToolOutputShape', 'findClosingShape', 'findUnsourcedNumber'];

check('every exported check is a function', CHECKS.every(function (k) { return typeof m[k] === 'function'; }));
check('constants are exported', Array.isArray(m.NEVER_SAY_TERMS) && Array.isArray(m.BANNED_PHRASES) && Array.isArray(m.STRONG_WORDS));

// How each check is called from a corpus row.
const CALL = {
  countSentences: function (r, e) { return m.countSentences(r.text, e.args || {}); },
  countQuestions: function (r) { return m.countQuestions(r.text); },
  checkIdentityLine: function (r) { return m.checkIdentityLine(r.text, { turnIndex: r.turn_index || 1, surface: r.surface || 'cli' }); },
  checkFirstReply: function (r) { return m.checkFirstReply(r.text); },
  findBannedPhrases: function (r) { return m.findBannedPhrases(r.text); },
  findDashes: function (r) { return m.findDashes(r.text); },
  detectFrameworkDump: function (r) { return m.detectFrameworkDump(r.text, { userText: r.user_text || '' }); },
  findUnbackedStrongWords: function (r) { return m.findUnbackedStrongWords(r.text); },
  findCorpusAbsence: function (r) { return m.findCorpusAbsence(r.text); },
  findConsistencyAsSupport: function (r) { return m.findConsistencyAsSupport(r.text); },
  findApologyClose: function (r) { return m.findApologyClose(r.text); },
  findIdLeak: function (r) { return m.findIdLeak(r.text); },
  findUndefinedFirstUse: function (r, e) { return m.findUndefinedFirstUse(r.text, (e.args || {}).terms || []); },
  findOpeningPronoun: function (r) { return m.findOpeningPronoun(r.text); },
  findMachineryNarration: function (r) { return m.findMachineryNarration(r.text, { userText: r.user_text || '' }); },
  findToolOutputShape: function (r) { return m.findToolOutputShape(r.text); },
  findClosingShape: function (r) { return m.findClosingShape(r.text); },
  findUnsourcedNumber: function (r) { return m.findUnsourcedNumber(r.text, { userText: ((r.prior_user_text || '') + ' ' + (r.user_text || '')).trim() }); },
};

// The budget rule behind the declared ok of the two counting checks (D-10).
const COUNT_LIMIT = { countSentences: 8, countQuestions: 1 };

function uniqKinds(v) {
  const s = new Set((v.hits || []).map(function (h) { return h.kind; }));
  return Array.from(s).sort();
}

// ok is derived from the verdict object, or from the budget rule for the counting checks.
const coverage = {};
CHECKS.forEach(function (k) { coverage[k] = { pass: 0, fail: 0 }; });

rows.forEach(function (row) {
  const problems = [];
  Object.keys(row.expect || {}).forEach(function (key) {
    const name = key.split('#')[0];
    const exp = row.expect[key];
    if (typeof CALL[name] !== 'function') { problems.push(key + ': unknown check'); return; }
    let out;
    try { out = CALL[name](row, exp); } catch (err) { problems.push(key + ': threw ' + err.message); return; }
    const isCount = typeof out === 'number';
    const gotOk = isCount ? out <= COUNT_LIMIT[name] : out.ok;
    if (isCount) {
      if (exp.value !== undefined && out !== exp.value) problems.push(key + ': value ' + out + ' expected ' + exp.value);
    } else {
      if (exp.kinds !== undefined) {
        const want = exp.kinds.slice().sort().join(',');
        const got = uniqKinds(out).join(',');
        if (want !== got) problems.push(key + ': kinds [' + got + '] expected [' + want + ']');
      }
      if (exp.fields) {
        Object.keys(exp.fields).forEach(function (f) {
          const got = out.fields ? out.fields[f] : undefined;
          if (got !== exp.fields[f]) problems.push(key + ': field ' + f + ' = ' + got + ' expected ' + exp.fields[f]);
        });
      }
    }
    if (exp.ok !== undefined && gotOk !== exp.ok) problems.push(key + ': ok ' + gotOk + ' expected ' + exp.ok + (isCount ? ' (value ' + out + ')' : ''));
    if (exp.ok !== undefined && gotOk === exp.ok) coverage[name][exp.ok ? 'pass' : 'fail'] += 1;
  });
  check('row ' + row.id + ' (' + row.kind + ')', problems.length === 0, problems.join('; '));
});

// C1
const originals = rows.filter(function (r) { return r.kind === 'original'; });
check('C1 every original row carries source_sha256 equal to the sha256 of its text',
  originals.length > 0 && originals.every(function (r) { return /^[0-9a-f]{64}$/.test(r.source_sha256) && sha(r.text) === r.source_sha256; }));

// C2
const byId = {};
rows.forEach(function (r) { byId[r.id] = r; });
const normalized = rows.filter(function (r) { return r.kind === 'normalized'; });
check('C2 every normalized row names an existing original and a normalization rule',
  normalized.length > 0 && normalized.every(function (r) {
    const o = byId[r.normalized_from];
    return o && o.kind === 'original' && typeof r.normalization === 'string' && r.normalization.length > 0;
  }));
check('C2b a normalized row differs from its original only by the PwS spelling',
  normalized.every(function (r) { return byId[r.normalized_from].text.replace(/\bPWS\b/g, 'PwS') === r.text; }));
check('C2c a normalized twin holds no all-capitals PWS', normalized.every(function (r) { return !/\bPWS\b/.test(r.text); }));
check('C2d every row has a kind of original, normalized or invented', rows.every(function (r) { return ['original', 'normalized', 'invented'].indexOf(r.kind) !== -1; }));

// C3
const csvRows = originals.filter(function (r) { return r.source === 'plurai-02'; });
check('C3 seven plurai-02 original rows', csvRows.length === 7);
['probe-A', 'probe-B', 'probe-C', 'probe-D', 'sample-E'].forEach(function (id) {
  check('C3 original row ' + id, byId[id] && byId[id].kind === 'original');
});
const l3Originals = originals.filter(function (r) { return r.source === 'L3-model-exchange'; });
check('C3 four L3 model-exchange replies (three exchanges) each have a normalized twin',
  l3Originals.length === 4 && l3Originals.every(function (o) {
    return normalized.some(function (n) { return n.normalized_from === o.id; });
  }));
check('C3 the original plurai-02 row with a dash keeps it after parsing (verbatim)',
  csvRows.some(function (r) { return r.text.indexOf(String.fromCharCode(0x2014)) !== -1; }));
check('C3 the original probe rows keep the all-capitals PWS spelling and the spaced pause (verbatim)',
  /\bPWS\b/.test(byId['probe-A'].text) && byId['probe-A'].text.indexOf(' ' + '-'.repeat(2) + ' ') !== -1);

// C4
CHECKS.forEach(function (k) {
  check('C4 coverage: ' + k + ' has a passing row and a failing row', coverage[k].pass >= 1 && coverage[k].fail >= 1,
    'pass ' + coverage[k].pass + ' fail ' + coverage[k].fail);
});

// C5
const register = JSON.parse(fs.readFileSync(REGISTER_PATH, 'utf8'));
check('C5 the immutable-source register names the original corpus rows by field',
  Array.isArray(register.fields) && register.fields.some(function (f) {
    return f.path === 'tests/fixtures/3696-voice-corpus.json' && f.field === 'text' && f.rows_of_kind === 'original';
  }));

// C6
check('C6 Theo is not on the never-say list (R-20)', !m.NEVER_SAY_TERMS.some(function (t) { return /^theo$/i.test(t); }));
check('C6b Brain as a backend noun is on the never-say list', m.NEVER_SAY_TERMS.indexOf('Brain') !== -1);
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'mcp-tool-connectors.json'), 'utf8'));
const someTool = registry.connectors.map(function (c) { return c.surface.replace(/^mcp:/, ''); }).filter(function (id) { return id.indexOf('_') !== -1; })[0];
check('C6c a tool id from the generated registry is flagged as narration', someTool && m.findMachineryNarration('I used ' + someTool + ' here.', { userText: '' }).ok === false, String(someTool));
check('C6d the same tool id is allowed when the navigator named it',
  someTool && m.findMachineryNarration('I used ' + someTool + ' here.', { userText: 'what is ' + someTool + '?' }).ok === true);

// C7
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
[__filename, MODULE_PATH, CORPUS_PATH].forEach(function (f) {
  const t = fs.readFileSync(f, 'utf8');
  check('C7 no em dash or en dash in ' + path.basename(f), t.indexOf(EM) === -1 && t.indexOf(EN) === -1);
});
check('C7b the corpus file holds no non-ASCII byte (dashes and glyphs are JSON escapes)', !/[^\x00-\x7F]/.test(fs.readFileSync(CORPUS_PATH, 'utf8')));

// C8
const topRequires = fs.readFileSync(MODULE_PATH, 'utf8').split('\n').filter(function (l) { return /^const .*require\(/.test(l); });
check('C8 top-level requires are node built-ins and voice-color-mark only',
  topRequires.length > 0 && topRequires.every(function (l) { return /require\('node:[a-z]+'\)/.test(l) || /require\('\.\/voice-color-mark\.cjs'\)/.test(l); }), topRequires.join(' | '));
check('C8b no network call', NET.attempts() === 0);

try { fs.rmSync(HOME_TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
process.exit(summary());
