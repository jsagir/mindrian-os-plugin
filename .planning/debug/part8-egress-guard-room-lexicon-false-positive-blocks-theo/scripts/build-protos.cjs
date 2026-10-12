'use strict';
// Build scratch prototypes of the lexicon fix shapes. NEVER touches the real lib/core files.
// Each proto dir: lib/core = symlinks to every real lib/core entry except the two patched modules (real copies);
// data and lib/hmi are symlinks. Output dir: argv[2].
const fs = require('node:fs');
const path = require('node:path');
const REPO = '/home/jsagi/dev/MindrianOS-Plugin';
const OUT = process.argv[2];
const CORE = path.join(REPO, 'lib', 'core');

const lexSrc = fs.readFileSync(path.join(CORE, 'part8-room-lexicon.cjs'), 'utf8');
const guardSrc = fs.readFileSync(path.join(CORE, 'part8-egress-guard.cjs'), 'utf8');
const ANCHOR_GENERIC = '  if (generic) return null;\n';
const ANCHOR_TOKENS = '  if (tokens.length === 0) return null;\n';
const ANCHOR_FN = 'function makeEntry(kind, text, g) {';
if (lexSrc.indexOf(ANCHOR_GENERIC) === -1 || lexSrc.indexOf(ANCHOR_TOKENS) === -1 || lexSrc.indexOf(ANCHOR_FN) === -1) throw new Error('anchor missing');

const HELPERS = `
const REPO_ROOT = ${JSON.stringify(REPO)};
let _gt = null;
function _sectionTokens() {
  const sr = require(REPO_ROOT + '/lib/core/section-registry.cjs');
  const set = new Set();
  Object.keys(sr.CORE_SECTIONS).forEach(function (slug) {
    tokenize(slug).forEach(function (t) { set.add(t); });
    tokenize(String(sr.CORE_SECTIONS[slug].label).replace(/&/g, ' and ')).forEach(function (t) { set.add(t); });
  });
  return set;
}
function _sectionPhrases() {
  const sr = require(REPO_ROOT + '/lib/core/section-registry.cjs');
  const set = new Set();
  Object.keys(sr.CORE_SECTIONS).forEach(function (slug) {
    set.add(tokenize(slug).join(' '));
    set.add(tokenize(String(sr.CORE_SECTIONS[slug].label).replace(/&/g, ' and ')).join(' '));
  });
  return set;
}
function _vocabTokens(g, withRepoProse) {
  const set = new Set();
  (g.CANONICAL_PHRASES || []).forEach(function (p) { tokenize(p).forEach(function (t) { set.add(t); }); });
  g.COMMAND_SLUG_SET.forEach(function (s) { tokenize(s).forEach(function (t) { set.add(t); }); });
  g.METHODOLOGY_TOKEN_SET.forEach(function (t) { tokenize(t).forEach(function (x) { set.add(x); }); });
  g.QUESTION_FUNCTION_WORDS.forEach(function (t) { set.add(t); });
  _sectionTokens().forEach(function (t) { set.add(t); });
  if (withRepoProse) {
    const fs2 = require('node:fs');
    const files = fs2.readdirSync(REPO_ROOT + '/commands').filter(function (f) { return f.endsWith('.md'); }).map(function (f) { return REPO_ROOT + '/commands/' + f; });
    files.push(REPO_ROOT + '/docs/MINDRIAN-CANON.md');
    files.forEach(function (f) { tokenize(fs2.readFileSync(f, 'utf8')).forEach(function (t) { if (t.length >= 3 && !/[0-9]/.test(t)) set.add(t); }); });
  }
  return set;
}
`;

const SHAPES = {
  // S1: subtract generic methodology vocabulary (canonical-phrase tokens, command-slug tokens, core-section tokens,
  // methodology tokens, function words) from room_term and room_file entries at lexicon build time.
  S1: {
    inject: ANCHOR_GENERIC + `  if (kind === 'room_term' || kind === 'room_file') {
    if (!_gt) _gt = _vocabTokens(g, false);
    if (tokenize(clean).every(function (t) { return _gt.has(t); })) return null;
  }
`,
  },
  // S2: S1 plus the repo prose vocabulary (all words in commands/*.md and the Canon) as a proxy for plain PWS English.
  S2: {
    inject: ANCHOR_GENERIC + `  if (kind === 'room_term' || kind === 'room_file') {
    if (!_gt) _gt = _vocabTokens(g, true);
    if (tokenize(clean).every(function (t) { return _gt.has(t); })) return null;
  }
`,
  },
  // S3: minimum n-gram. A room_term or room_file entry must be 3 or more tokens (or carry a digit or underscore).
  S3: {
    tokens: ANCHOR_TOKENS + `  if ((kind === 'room_term' || kind === 'room_file') && tokens.length < 3 && !/[0-9_]/.test(clean)) return null;
`,
  },
  // S4: narrow scaffold denylist. Drop room_file and room_term entries equal to a CORE_SECTIONS slug or label.
  S4: {
    tokens: ANCHOR_TOKENS + `  if ((kind === 'room_term' || kind === 'room_file') && _sectionPhrases().has(tokens.join(' '))) return null;
`,
  },
};

fs.rmSync(OUT, { recursive: true, force: true });
Object.keys(SHAPES).forEach(function (name) {
  const base = path.join(OUT, name);
  const core = path.join(base, 'lib', 'core');
  fs.mkdirSync(core, { recursive: true });
  fs.readdirSync(CORE).forEach(function (f) {
    if (f === 'part8-room-lexicon.cjs' || f === 'part8-egress-guard.cjs') return;
    fs.symlinkSync(path.join(CORE, f), path.join(core, f));
  });
  fs.symlinkSync(path.join(REPO, 'data'), path.join(base, 'data'));
  fs.symlinkSync(path.join(REPO, 'lib', 'hmi'), path.join(base, 'lib', 'hmi'));
  let lex = lexSrc.replace(ANCHOR_FN, HELPERS + ANCHOR_FN);
  const s = SHAPES[name];
  if (s.inject) lex = lex.replace(ANCHOR_GENERIC, s.inject);
  if (s.tokens) lex = lex.replace(ANCHOR_TOKENS, s.tokens);
  fs.writeFileSync(path.join(core, 'part8-room-lexicon.cjs'), lex);
  fs.writeFileSync(path.join(core, 'part8-egress-guard.cjs'), guardSrc);
});
console.log('built', Object.keys(SHAPES).join(','), 'in', OUT);
