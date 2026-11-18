#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 392-01 (P0, measure first): local extraction of the real Brain calls
 * from this machine's Claude Code transcripts (~/.claude/projects). The
 * replay harness (tests/helpers/part8-overblock-replay.cjs --real-calls)
 * classifies them and records COUNTS ONLY.
 *
 * What it does:
 *   walks <projects>/**\/*.jsonl, finds every tool_use block whose name
 *   matches the Brain matcher (the Part 8 hook matcher in hooks/hooks.json,
 *   plus mcp__theo__brain_* and mcp__pws-brain-mcp__*), and writes one JSON
 *   line per block: tool (the last segment of the name), input (the
 *   tool_input object), seen_at, source_hash (sha256 of the transcript path;
 *   never the path).
 *
 * Part 8 (absolute):
 *   - The output file stays on this machine. The default is
 *     $HOME/.mindrian/part8-replay/real-calls.jsonl.
 *   - An --out path inside this repository is refused with exit 2:
 *     "real calls never enter the repository (Part 8)".
 *   - The script prints counts only: files scanned, blocks found, unique
 *     inputs, labels. It never prints an input.
 *   - The owner labels the unique inputs later in a labels file
 *     (--labels <json>: sha256 of the canonical input JSON -> legitimate |
 *     not | unknown; a missing label counts as unknown). The harness reads
 *     the same map through canonicalInputHash. The committed matrix holds
 *     counts only.
 *
 * Command line (switch-case router, repo convention):
 *   node scripts/part8-real-calls-extract.cjs [--out <path>] [--projects <dir>]
 *        [--labels <path>]
 *   node scripts/part8-real-calls-extract.cjs --self-test
 *   The self-test runs the walker over a temporary folder with synthetic
 *   transcript lines only and asserts the counts and the repo-path refusal.
 *   No tests/test-396-* file covers this script because its real input is
 *   personal transcript data.
 *
 * No dependency added. No em dash and no en dash anywhere.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const REFUSAL = 'real calls never enter the repository (Part 8)';
const EXTRA_MATCHERS = ['mcp__theo__brain_[a-z0-9_]+', 'mcp__pws-brain-mcp__.*'];
const HOOK_MATCHER_FALLBACK = 'mcp__(?:(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp)__.*|[a-z0-9_-]+__brain_[a-z0-9_]+)';

function canonicalInputHash(input) {
  return require(path.join(REPO_ROOT, 'tests', 'helpers', 'part8-overblock-replay.cjs')).canonicalInputHash(input);
}

// The Part 8 hook matcher, read from hooks/hooks.json (one source), with
// the two explicit extra routes of this plan.
function brainToolMatcher() {
  let matcher = HOOK_MATCHER_FALLBACK;
  try {
    const hooks = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'hooks', 'hooks.json'), 'utf8'));
    const groups = [].concat.apply([], Object.keys(hooks.hooks || {}).map(function (k) { return hooks.hooks[k]; }));
    const hit = groups.find(function (g) {
      return g && typeof g.matcher === 'string' && Array.isArray(g.hooks) &&
        g.hooks.some(function (h) { return String(h.command || '').indexOf('part8-egress-guard-hook.cjs') >= 0; });
    });
    if (hit) matcher = hit.matcher;
  } catch (_e) { /* fallback literal */ }
  return new RegExp('^(?:' + [matcher].concat(EXTRA_MATCHERS).join('|') + ')$');
}

// Deepest existing ancestor, real path. Symlinks do not hide the repository.
function realDirOf(p) {
  let cur = path.resolve(p);
  for (;;) {
    if (fs.existsSync(cur)) {
      try { return fs.realpathSync(cur); } catch (_e) { return cur; }
    }
    const parent = path.dirname(cur);
    if (parent === cur) return cur;
    cur = parent;
  }
}

function insideRepo(outPath) {
  const repo = realDirOf(REPO_ROOT);
  const target = realDirOf(path.dirname(path.resolve(outPath)));
  return target === repo || target.indexOf(repo + path.sep) === 0;
}

function walkJsonl(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  entries.forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkJsonl(p, out);
    else if (e.isFile() && /\.jsonl$/.test(e.name)) out.push(p);
  });
  return out;
}

// Pull every matching tool_use block out of one transcript file.
function blocksOf(file, matcher) {
  const found = [];
  const sourceHash = crypto.createHash('sha256').update(file).digest('hex');
  const text = fs.readFileSync(file, 'utf8');
  text.split('\n').forEach(function (line) {
    if (line.indexOf('"tool_use"') < 0) return;
    let o;
    try { o = JSON.parse(line); } catch (_e) { return; }
    const content = o && o.message && o.message.content;
    if (!Array.isArray(content)) return;
    content.forEach(function (b) {
      if (!b || b.type !== 'tool_use' || typeof b.name !== 'string') return;
      if (!matcher.test(b.name)) return;
      found.push({
        tool: b.name.split('__').pop(),
        input: b.input !== null && typeof b.input === 'object' ? b.input : {},
        seen_at: o.timestamp || null,
        source_hash: sourceHash,
      });
    });
  });
  return found;
}

function readLabels(labelsPath) {
  if (!labelsPath) return null;
  return JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
}

// Returns { code, message, counts }. Writes only when code is 0.
function extract(opts) {
  const outPath = path.resolve(opts.out || path.join(os.homedir(), '.mindrian', 'part8-replay', 'real-calls.jsonl'));
  if (insideRepo(outPath)) return { code: 2, message: REFUSAL, counts: null };
  const projects = path.resolve(opts.projects || path.join(os.homedir(), '.claude', 'projects'));
  const matcher = brainToolMatcher();
  const files = walkJsonl(projects, []);
  const labels = readLabels(opts.labels);
  const seen = {};
  const byTool = {};
  const labelCount = { legitimate: 0, not: 0, unknown: 0 };
  const lines = [];
  files.forEach(function (f) {
    blocksOf(f, matcher).forEach(function (rec) {
      const h = canonicalInputHash(rec.input);
      if (!seen[h]) {
        seen[h] = true;
        const lab = labels && ['legitimate', 'not'].indexOf(String(labels[h])) >= 0 ? String(labels[h]) : 'unknown';
        labelCount[lab] += 1;
      }
      byTool[rec.tool] = (byTool[rec.tool] || 0) + 1;
      lines.push(JSON.stringify(rec));
    });
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  const counts = {
    files_scanned: files.length,
    blocks_found: lines.length,
    unique_inputs: Object.keys(seen).length,
    by_tool: byTool,
    labels: labelCount,
  };
  return { code: 0, message: 'wrote ' + outPath, counts: counts };
}

function printCounts(r) {
  console.log(r.message);
  if (!r.counts) return;
  console.log('files scanned ' + r.counts.files_scanned + ', blocks found ' + r.counts.blocks_found + ', unique inputs ' + r.counts.unique_inputs);
  console.log('by tool ' + JSON.stringify(r.counts.by_tool));
  console.log('labels ' + JSON.stringify(r.counts.labels));
}

function synthLine(name, input, ts) {
  return JSON.stringify({ type: 'assistant', timestamp: ts, message: { role: 'assistant', content: [{ type: 'tool_use', id: 'x', name: name, input: input }] } });
}

// Synthetic transcript lines only. Never a real transcript.
function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos392-extract-'));
  let failed = 0;
  function check(cond, msg) { if (!cond) { failed += 1; console.log('FAIL - ' + msg); } else { console.log('ok - ' + msg); } }
  try {
    const projects = path.join(tmp, 'projects', 'proj-a');
    fs.mkdirSync(projects, { recursive: true });
    const q = { question: 'which framework fits a well defined problem' };
    const lines = [
      // line 1: one Brain block plus one block that is not a Brain tool
      JSON.stringify({ type: 'assistant', timestamp: '2026-01-01T00:00:00.000Z', message: { content: [
        { type: 'tool_use', id: 'a', name: 'mcp__plugin_mos_mindrian-brain__brain_ask', input: q },
        { type: 'tool_use', id: 'b', name: 'Read', input: { file_path: '/nowhere' } },
      ] } }),
      // line 2: a theo route with the same input (a duplicate for the unique count)
      synthLine('mcp__theo__brain_ask', q, '2026-01-01T00:00:01.000Z'),
      // line 3: a different input through pws-brain-mcp
      synthLine('mcp__pws-brain-mcp__brain_search', { query: 'jobs to be done' }, '2026-01-01T00:00:02.000Z'),
      'not json at all',
    ];
    fs.writeFileSync(path.join(projects, 't.jsonl'), lines.join('\n') + '\n', 'utf8');
    fs.writeFileSync(path.join(projects, 'ignored.txt'), lines[0] + '\n', 'utf8');

    const out = path.join(tmp, 'out', 'real-calls.jsonl');
    const r = extract({ out: out, projects: path.join(tmp, 'projects') });
    check(r.code === 0, 'extract exits 0 outside the repository');
    check(r.counts && r.counts.files_scanned === 1, 'files scanned 1 (only .jsonl)');
    check(r.counts && r.counts.blocks_found === 3, 'blocks found 3 (the Read block is skipped)');
    check(r.counts && r.counts.unique_inputs === 2, 'unique inputs 2 (one duplicate)');
    check(r.counts && r.counts.by_tool.brain_ask === 2 && r.counts.by_tool.brain_search === 1, 'by tool brain_ask 2, brain_search 1');
    check(r.counts && r.counts.labels.unknown === 2, 'labels unknown 2 without a labels file');
    const written = fs.readFileSync(out, 'utf8').trim().split('\n').map(function (l) { return JSON.parse(l); });
    check(written.length === 3 && written.every(function (w) { return ['tool', 'input', 'seen_at', 'source_hash'].every(function (k) { return k in w; }); }), 'each line holds tool, input, seen_at, source_hash');
    check(written.every(function (w) { return /^[0-9a-f]{64}$/.test(w.source_hash) && JSON.stringify(w).indexOf(tmp) < 0; }), 'source_hash is a sha256, the path is never written');

    const labelsPath = path.join(tmp, 'labels.json');
    const labels = {};
    labels[canonicalInputHash(q)] = 'legitimate';
    fs.writeFileSync(labelsPath, JSON.stringify(labels), 'utf8');
    const r2 = extract({ out: out, projects: path.join(tmp, 'projects'), labels: labelsPath });
    check(r2.counts && r2.counts.labels.legitimate === 1 && r2.counts.labels.unknown === 1, 'labels file: legitimate 1, unknown 1');

    const refused = extract({ out: path.join(REPO_ROOT, 'tests', 'fixtures', 'never.jsonl'), projects: path.join(tmp, 'projects') });
    check(refused.code === 2 && refused.message === REFUSAL, 'an --out path under the repository exits 2 with the Part 8 refusal');
    check(!fs.existsSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'never.jsonl')), 'nothing was written under the repository');
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  if (failed > 0) { console.log('part8-real-calls-extract self-test: ' + failed + ' check(s) failed'); return 1; }
  console.log('part8-real-calls-extract self-test: all checks passed');
  return 0;
}

function usage() {
  console.log('usage: node scripts/part8-real-calls-extract.cjs [--out <path>] [--projects <dir>] [--labels <path>] | --self-test | --help');
}

function main(argv) {
  const opts = {};
  let mode = 'extract';
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--out': opts.out = argv[++i]; break;
      case '--projects': opts.projects = argv[++i]; break;
      case '--labels': opts.labels = argv[++i]; break;
      case '--self-test': mode = 'self-test'; break;
      case '--help': case '-h': mode = 'help'; break;
      default:
        console.error('unknown argument: ' + argv[i]);
        usage();
        return 2;
    }
  }
  switch (mode) {
    case 'self-test': return selfTest();
    case 'help': usage(); return 0;
    default: {
      const r = extract(opts);
      if (r.code !== 0) { console.error(r.message); return r.code; }
      printCounts(r);
      return 0;
    }
  }
}

module.exports = { extract: extract, brainToolMatcher: brainToolMatcher, insideRepo: insideRepo, REFUSAL: REFUSAL };

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
