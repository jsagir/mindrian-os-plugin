'use strict';
const path = require('node:path'); const fs = require('node:fs');
const S = require('./_stubs.cjs'); const check = S.check;
const pkg = path.join(__dirname, '../..'); const orig = path.join(pkg, '../_baseline/orig/eureka');
function split(t) { const m = t.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/); return { fm: m[1], body: m[2] }; }
['commands/eureka.md', 'skills/eureka/SKILL.md'].forEach(function (f) {
  const o = split(fs.readFileSync(path.join(orig, f), 'utf8')), n = split(fs.readFileSync(path.join(pkg, f), 'utf8'));
  const keys = function (fm) { return fm.split('\n').filter(function (l) { return /^[a-z_-]+:/.test(l); }).map(function (l) { return l.split(':')[0]; }); };
  check(f + ': frontmatter keys unchanged', JSON.stringify(keys(o.fm)) === JSON.stringify(keys(n.fm)));
  const drop = function (fm) { return fm.split('\n').filter(function (l) { return l.indexOf('# Phase 267.3-06') !== 0; }).join('\n'); };
  check(f + ': frontmatter values unchanged (only the stale line-reference comment edited)', drop(o.fm) === drop(n.fm));
  const heads = function (b) { return (b.match(/^#{1,3} .*$/gm) || []); };
  const oh = heads(o.body), nh = heads(n.body);
  check(f + ': all original headings kept', oh.every(function (h) { return nh.indexOf(h) !== -1; }));
  check(f + ': one new heading only', nh.length === oh.length + 1 && nh.indexOf('## Inputs, outputs, failure and stop') !== -1);
  check(f + ': no em dash', n.body.indexOf('\u2014') === -1 && n.fm.indexOf('\u2014') === -1);
  check(f + ': fences balanced', (n.body.match(/^```/gm) || []).length % 2 === 0);
  check(f + ': voice glyph line intact', n.body.indexOf('only these 12 glyphs: ■ ▼ ▶ ▷ ├─ └─ ✓ • ⚠ ⚡ ⬜ →') !== -1);
  const cmds = function (b) { return (b.match(/research-planner\.cjs" [a-z-]+( [a-z]+)?/g) || []).map(function (x) { return x.replace(/^.*cjs" /, ''); }); };
  check(f + ': every planner subcommand preserved in order', JSON.stringify(cmds(o.body)) === JSON.stringify(cmds(n.body)));
  check(f + ': no lingering "judge what comes back" unbounded instruction', n.body.indexOf('judge what comes back') === -1);
  check(f + ': no emoji', !/[\u{1F300}-\u{1FAFF}]/u.test(n.body));
});
const cmd = fs.readFileSync(path.join(pkg, 'commands/eureka.md'), 'utf8'), sk = fs.readFileSync(path.join(pkg, 'skills/eureka/SKILL.md'), 'utf8');
check('skill no longer promises a fallback its own guard forbids', sk.indexOf('When `CLAUDE_PLUGIN_ROOT` is unset, fall back') === -1 && cmd.indexOf('When `CLAUDE_PLUGIN_ROOT` is unset, fall back') !== -1);
check('known inconsistency left alone and reported: sensor_triggers differs', /sensor_triggers: \[SENS-13\]/.test(cmd) && /sensor_triggers: \[\]/.test(sk));

// tags json
const t = JSON.parse(fs.readFileSync(path.join(pkg, 'data/eureka-critic-tags.json'), 'utf8')), o = JSON.parse(fs.readFileSync(path.join(orig, 'data/eureka-critic-tags.json'), 'utf8'));
check('tags: every original key and value preserved', Object.keys(o).every(function (k) { return JSON.stringify(o[k]) === JSON.stringify(t[k]); }));
check('tags: schema_version still 1 (critic requires it)', t.schema_version === 1);
check('tags: tag_verdicts covers every reasoning tag exactly', JSON.stringify(Object.keys(t.tag_verdicts).sort()) === JSON.stringify(Object.keys(t.reasoning_tags).sort()));
check('tags: tag_verdicts values are known verdicts', Object.keys(t.tag_verdicts).every(function (k) { return t.tag_verdicts[k].every(function (v) { return t.verdicts.indexOf(v) !== -1; }); }));
check('tags: domain tags unique, contain unknown', new Set(t.domain_tags).size === t.domain_tags.length && t.domain_tags.indexOf('unknown') !== -1);
check('tags: rubric_keys length == rubric_pattern_len', t.rubric_keys.length === t.rubric_pattern_len);
check('tags: no em dash', JSON.stringify(t).indexOf('\u2014') === -1);
// the critic-run script's DOMAIN_TAGS must all be members of the closed enum
const src = fs.readFileSync(path.join(pkg, 'scripts/eureka-critic-run.cjs'), 'utf8');
const block = src.match(/const DOMAIN_TAGS = \{([\s\S]*?)\n\};/)[1];
const used = (block.match(/'([a-z]+)'/g) || []).map(function (s) { return s.replace(/'/g, ''); }).filter(function (s) { return /^[a-z]+$/.test(s); });
const names = new Set(Object.keys({}));
const bad = used.filter(function (s) { return t.domain_tags.indexOf(s) === -1 && !/^(archimedes|davinci|lovelace|nichefoods|pair)$/.test(s); });
check('critic-run DOMAIN_TAGS values are all in the closed domain enum', bad.length === 0, bad.join(','));
S.done('test-md-and-json');
