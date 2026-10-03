#!/usr/bin/env node
'use strict';

/**
 * Phase 289 plan 03 (MENU289-03, D-06) -- the bare-text chooser fence.
 * ==========================================================================
 * SEED-020: a command menu is a live AskUserQuestion selector, never bare
 * text. Phase 192 fenced four commands by name (tests/test-192-menu-sweep-
 * live-selectors.cjs). This fence generalizes it: it scans EVERY commands/*.md
 * body (frontmatter and fenced code skipped) for bare-text chooser phrasings
 * and fails any that is not either converted or allow-listed.
 *
 * A hit PASSES when the command's frontmatter `allowed-tools` lists
 * AskUserQuestion AND the hit's paragraph (the contiguous non-blank lines
 * around it, stopping at a blank line, a heading line or a fence) contains the
 * literal `AskUserQuestion`. Otherwise it needs an allow-list entry
 * (tests/fixtures/289/menu-fence-allowlist.json: same file, the entry's
 * `match` substring found in the hit line, a reason of at least 20
 * characters). An allow-list entry that matches no failing hit is stale and
 * fails. Default rule: a hit in a command that already allows AskUserQuestion
 * is converted; an entry is only for a line that is not a menu (a
 * prohibition, a pointer to the gate, a text floor).
 *
 * Disposition of the planning scan (HEAD d511f4c04, 10 hits):
 *   converted by plan 06: pipeline.md:108 (chain selection), pipeline.md:117
 *     (resume offer), find-analogies.md:341 (Step 6 next moves)
 *   converted by plan 08: radar.md:104, deck.md:67, new-project.md:98,
 *     skill.md:75
 *   allow-listed here:    ignite.md:105 (a prohibition),
 *     systems-thinking.md:225 (a pointer to the Decision Gate)
 *   passing already:      onboard.md:93 (allowed-tools lists AskUserQuestion
 *     and the paragraph names it)
 * Today the full run exits 1 with 7 unlisted failures.
 *
 * Pipeline assertions (only when commands/pipeline.md is in scope): its
 * allowed-tools lists AskUserQuestion; its hitl_stages has a stage whose
 * shapes include F.1; the `### Chain Selection` section contains
 * AskUserQuestion, `--list` and `Do not auto-select.`; the resume-offer
 * paragraph (the one under `### Pipeline Resumption Check` that names
 * "start fresh") contains AskUserQuestion.
 *
 * Positional file arguments (for example `commands/pipeline.md`) restrict the
 * scan, the stale check and the pipeline assertions to those files. No
 * argument scans everything. Pure scanner exported as scanCommands. Exit 1 on
 * any FAIL, never 77.
 *
 * No em-dashes (hyphens only). CJS.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ALLOWLIST_PATH = path.join(__dirname, 'fixtures', '289', 'menu-fence-allowlist.json');

// Exactly ten patterns, case-insensitive.
const PATTERNS = [
  /let (the )?(user|navigator) (choose|pick|decide)/i,
  /ask (the )?(user|navigator) (to (pick|choose|select)|which)/i,
  /present (both|all|the) options/i,
  /so (that )?(the )?(user|navigator) can (pick|choose|select)/i,
  /\bor start fresh\b/i,
  /\bpick one\b/i,
  /\bchoose (one|between)\b/i,
  /\bwhich (one )?(do|would) you (like|want|prefer)\b/i,
  /\btype\s+["'`]?\d(\s*,\s*\d)*,?\s*or\s*\d/i,
  /reply with (the|a) (option )?number/i,
];

function isFence(line) {
  return /^\s*(```|~~~)/.test(line);
}
function isHeading(line) {
  return /^\s{0,3}#{1,6}\s/.test(line);
}

// Split a command file into { fmLines, bodyStart } where bodyStart is the
// index of the first body line.
function splitFrontmatter(lines) {
  if (lines.length > 0 && /^---\s*$/.test(lines[0])) {
    for (let i = 1; i < lines.length; i += 1) {
      if (/^---\s*$/.test(lines[i])) return { fm: lines.slice(1, i), bodyStart: i + 1 };
    }
  }
  return { fm: [], bodyStart: 0 };
}

// allowed-tools as a list of names, from the frontmatter lines. Handles a
// block list, an inline [a, b] list and a comma string.
function allowedTools(fm) {
  const idx = fm.findIndex((l) => /^allowed-tools\s*:/.test(l));
  if (idx < 0) return [];
  const first = fm[idx].replace(/^allowed-tools\s*:/, '').trim();
  const out = [];
  if (first.length > 0) {
    first
      .replace(/^\[|\]$/g, '')
      .split(',')
      .forEach((t) => {
        const v = t.trim().replace(/^["']|["']$/g, '');
        if (v) out.push(v);
      });
  }
  for (let i = idx + 1; i < fm.length; i += 1) {
    const m = /^\s+-\s*(.+?)\s*$/.exec(fm[i]);
    if (m) out.push(m[1].replace(/^["']|["']$/g, ''));
    else if (/^\S/.test(fm[i])) break;
    else if (fm[i].trim() === '') continue;
  }
  return out;
}

// The paragraph around line index `i` (body lines): contiguous non-blank
// lines, stopping at a blank line, a heading line or a fence.
function paragraphAround(lines, i) {
  const stop = (l) => l.trim() === '' || isHeading(l) || isFence(l);
  let a = i;
  while (a - 1 >= 0 && !stop(lines[a - 1])) a -= 1;
  let b = i;
  while (b + 1 < lines.length && !stop(lines[b + 1])) b += 1;
  return lines.slice(a, b + 1).join('\n');
}

function scanFile(rootDir, rel) {
  const text = fs.readFileSync(path.join(rootDir, rel), 'utf8');
  const lines = text.split('\n');
  const { fm, bodyStart } = splitFrontmatter(lines);
  const tools = allowedTools(fm);
  const allows = tools.includes('AskUserQuestion');
  const hits = [];
  let inFence = false;
  for (let i = bodyStart; i < lines.length; i += 1) {
    const line = lines[i];
    if (isFence(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (!PATTERNS.some((re) => re.test(line))) continue;
    const para = paragraphAround(lines, i);
    hits.push({
      file: rel,
      line: i + 1,
      text: line.trim(),
      passes: allows && para.includes('AskUserQuestion'),
    });
  }
  return hits;
}

/**
 * scanCommands({ rootDir, allowlist, files }) -> { hits, passed, allowListed,
 * failures, stale }. `rootDir` holds a `commands/` directory; `files` (paths
 * relative to rootDir, for example `commands/pipeline.md`) restricts the scan.
 */
function scanCommands(opts) {
  const rootDir = opts.rootDir;
  const allowlist = opts.allowlist && Array.isArray(opts.allowlist.entries) ? opts.allowlist : { entries: [] };
  let files = opts.files && opts.files.length > 0 ? opts.files.slice() : null;
  if (!files) {
    const dir = path.join(rootDir, 'commands');
    files = fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((f) => f.endsWith('.md'))
          .sort()
          .map((f) => 'commands/' + f)
      : [];
  }
  const hits = [];
  for (const rel of files) hits.push(...scanFile(rootDir, rel));

  const used = new Set();
  const passed = [];
  const allowListed = [];
  const failures = [];
  for (const h of hits) {
    if (h.passes) {
      passed.push(h);
      continue;
    }
    const idx = allowlist.entries.findIndex((e) => e.file === h.file && typeof e.match === 'string' && h.text.includes(e.match));
    if (idx >= 0) {
      used.add(idx);
      allowListed.push(h);
    } else {
      failures.push(h);
    }
  }
  const inScope = new Set(files);
  const stale = [];
  allowlist.entries.forEach((e, idx) => {
    if (inScope.has(e.file) && !used.has(idx)) stale.push(e);
  });
  return { hits, passed, allowListed, failures, stale };
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let pass = 0;
let fail = 0;
function ok(name) {
  pass += 1;
  console.log('PASS: ' + name);
}
function bad(name, detail) {
  fail += 1;
  console.log('FAIL: ' + name);
  if (detail) console.log('  ' + String(detail).split('\n').join('\n  '));
}
function check(name, cond, detail) {
  if (cond) ok(name);
  else bad(name, detail);
}

function antiVacuity() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't289-fence-'));
  try {
    fs.mkdirSync(path.join(dir, 'commands'));
    const w = (name, body) => fs.writeFileSync(path.join(dir, 'commands', name), body);
    w(
      'bare.md',
      '---\nname: bare\nallowed-tools:\n  - Read\n---\n\n# bare\n\nLet the navigator choose which chain to run.\n'
    );
    w(
      'converted.md',
      '---\nname: converted\nallowed-tools:\n  - Read\n  - AskUserQuestion\n---\n\n# converted\n\nFire one AskUserQuestion card and let the navigator choose the chain.\n'
    );
    w(
      'fenced.md',
      '---\nname: fenced\nallowed-tools:\n  - Read\n---\n\n# fenced\n\n```\nLet the navigator choose which chain to run.\n```\n'
    );
    w(
      'allowed-but-far.md',
      '---\nname: far\nallowed-tools:\n  - AskUserQuestion\n---\n\n# far\n\nFire the AskUserQuestion card.\n\nLet the navigator choose which chain to run.\n'
    );
    const empty = { entries: [] };
    const r1 = scanCommands({ rootDir: dir, allowlist: empty, files: ['commands/bare.md'] });
    check(
      'anti-vacuity: a bare chooser in a command without AskUserQuestion is exactly one failure',
      r1.failures.length === 1 && r1.hits.length === 1,
      'hits=' + r1.hits.length + ' failures=' + r1.failures.length
    );
    const r2 = scanCommands({ rootDir: dir, allowlist: empty, files: ['commands/converted.md'] });
    check(
      'anti-vacuity: allowed-tools lists AskUserQuestion and the paragraph names it gives zero failures',
      r2.failures.length === 0 && r2.passed.length === 1,
      'hits=' + r2.hits.length + ' passed=' + r2.passed.length + ' failures=' + r2.failures.length
    );
    const r3 = scanCommands({ rootDir: dir, allowlist: empty, files: ['commands/fenced.md'] });
    check('anti-vacuity: a chooser inside a fenced code block is zero hits', r3.hits.length === 0, 'hits=' + r3.hits.length);
    const r4 = scanCommands({ rootDir: dir, allowlist: empty, files: ['commands/allowed-but-far.md'] });
    check(
      'anti-vacuity: AskUserQuestion in another paragraph does not rescue a bare chooser',
      r4.failures.length === 1,
      'failures=' + r4.failures.length
    );
    const r5 = scanCommands({
      rootDir: dir,
      allowlist: { entries: [{ file: 'commands/converted.md', match: 'a line that is not there', reason: 'a stale entry for the anti-vacuity check' }] },
      files: ['commands/converted.md'],
    });
    check('anti-vacuity: an allow-list entry that matches no failing hit is stale', r5.stale.length === 1, 'stale=' + r5.stale.length);
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_e) {
      /* best effort */
    }
  }
}

function sectionOf(lines, headingRe) {
  const start = lines.findIndex((l) => headingRe.test(l));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^#{1,3}\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end);
}

function pipelineAssertions() {
  const rel = 'commands/pipeline.md';
  const lines = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').split('\n');
  const { fm } = splitFrontmatter(lines);
  check('pipeline: allowed-tools lists AskUserQuestion', allowedTools(fm).includes('AskUserQuestion'), 'commands/pipeline.md allowed-tools does not list AskUserQuestion');

  const shapes = [];
  fm.forEach((l) => {
    const m = /^\s*shapes\s*:\s*\[([^\]]*)\]/.exec(l);
    if (m) m[1].split(',').forEach((s) => shapes.push(s.trim().replace(/^["']|["']$/g, '')));
  });
  check('pipeline: hitl_stages has a stage whose shapes include F.1', shapes.includes('F.1'), 'shapes declared: ' + shapes.join(', '));

  const chain = sectionOf(lines, /^###\s+Chain Selection\s*$/);
  if (!chain) {
    bad('pipeline: the "### Chain Selection" section exists', 'heading not found');
  } else {
    const body = chain.join('\n');
    check('pipeline: Chain Selection names AskUserQuestion', body.includes('AskUserQuestion'), 'no AskUserQuestion in the Chain Selection section');
    check('pipeline: Chain Selection names the --list text floor', body.includes('--list'), 'no --list in the Chain Selection section');
    check('pipeline: Chain Selection keeps the sentence "Do not auto-select."', body.includes('Do not auto-select.'), 'sentence missing');
  }

  const resume = sectionOf(lines, /^###\s+Pipeline Resumption Check\s*$/);
  if (!resume) {
    bad('pipeline: the "### Pipeline Resumption Check" section exists', 'heading not found');
  } else {
    const paras = [];
    for (let i = 0; i < resume.length; i += 1) {
      if (/start fresh/i.test(resume[i])) paras.push(paragraphAround(resume, i));
    }
    check('pipeline: the resume-offer paragraph (names "start fresh") exists', paras.length > 0, 'no paragraph in the section names "start fresh"');
    check(
      'pipeline: the resume-offer paragraph names AskUserQuestion',
      paras.some((p) => p.includes('AskUserQuestion')),
      'the resume offer is still bare prose'
    );
  }
}

function allowlistShape(allowlist) {
  check('allow-list: schema id is mindrian.menu-fence.allowlist.v1', allowlist.schema === 'mindrian.menu-fence.allowlist.v1', 'schema=' + allowlist.schema);
  const entries = Array.isArray(allowlist.entries) ? allowlist.entries : [];
  check('allow-list: entries is a non-empty array', entries.length > 0, 'entries missing');
  const weak = entries.filter(
    (e) => typeof e.file !== 'string' || typeof e.match !== 'string' || e.match.length === 0 || typeof e.reason !== 'string' || e.reason.length < 20
  );
  check('allow-list: every entry has file, match and a reason of at least 20 characters', weak.length === 0, JSON.stringify(weak));
}

function main() {
  const argFiles = process.argv
    .slice(2)
    .filter((a) => !a.startsWith('--'))
    .map((a) => path.relative(REPO_ROOT, path.resolve(a)));

  let allowlist;
  try {
    allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  } catch (e) {
    bad('allow-list: tests/fixtures/289/menu-fence-allowlist.json parses', e && e.message);
    console.log('RESULT: PASS=' + pass + ' FAIL=' + fail);
    process.exit(1);
  }

  antiVacuity();
  allowlistShape(allowlist);

  const r = scanCommands({ rootDir: REPO_ROOT, allowlist: allowlist, files: argFiles });
  console.log(
    'hits=' + r.hits.length + ' passed=' + r.passed.length + ' allow_listed=' + r.allowListed.length +
      ' failures=' + r.failures.length + ' stale=' + r.stale.length
  );
  for (const f of r.failures) console.log('  bare-text chooser: ' + f.file + ':' + f.line + ': ' + f.text);
  for (const s of r.stale) console.log('  stale allow-list entry: ' + s.file + ' match "' + s.match + '"');
  check('fence: no unlisted bare-text chooser in the scanned commands', r.failures.length === 0, r.failures.length + ' failure(s), listed above');
  check('fence: no stale allow-list entry', r.stale.length === 0, r.stale.length + ' stale entry(ies), listed above');

  if (argFiles.length === 0 || argFiles.includes('commands/pipeline.md')) pipelineAssertions();

  console.log('RESULT: PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail > 0 ? 1 : 0);
}

if (require.main === module) main();

module.exports = { scanCommands, PATTERNS };
