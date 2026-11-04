#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 03 Task 2 (NS369.6-07, NS369.6-18; D-37, D-42, A-02; Codex C7).
 * The persona drift test. Persona text holds intent, procedure and scope. A name that moves on the release
 * clock (a command, a tool id, a path, a section slug, a cited heading, a cited rule) must resolve from the
 * source on disk. A name that resolves to nothing fails the build (REF-mesika: a rule that points at a deleted
 * asset must match nothing rather than everything).
 *
 * Two steps, kept apart on purpose (Codex C7):
 *   1. EXTRACTION uses REFERENCE_GRAMMAR. The grammar is built from token shapes and citation forms only. It
 *      reads no list of valid names, so an unknown name such as not_a_tool is still extracted.
 *   2. RESOLUTION reads the name sources at run time: commands/*.md, data/mcp-tool-connectors.json, the brain_*
 *      names of lib/core/part8-egress-guard.cjs, the file tree, SECTION_NAMES of lib/core/room-skeleton-scaffold.cjs,
 *      the headings of the cited file and the persona text.
 *
 * Grammar forms (one example each):
 *   command   /mos:<slug>                            "run /mos:grade"
 *   tool      lower snake_case with an underscore,   "call some_tool", "mcp__some_server__some_tool",
 *             mcp__<server>__<tool>, brain_<x>       "brain_some_read"
 *   path      slash and a file extension, or a       "lib/core/navigation.cjs", "${CLAUDE_PLUGIN_ROOT}/references/x.md"
 *             top-level repo folder, or the plugin
 *             root variable
 *   slug      lower kebab-case in a slug position    "sections/problem-definition", "`strategy/`", "the `funding` section"
 *   heading   a backticked heading, a quoted or      "`## Operating invisibly`", "see \"X\" in the larry-personality skill",
 *             plain title in a "see X above" cite    "the agent's `## X` section", "(see X above)"
 *   rule      a quoted rule phrase                   "the standing \"X\" rule"
 *
 * Scope: the body of agents/larry-extended.md, skills/larry-personality/SKILL.md, skills/larry-personality/
 * mode-engine.md, skills/room-proactive/SKILL.md and every references/personality/*.md (a glob, so the new
 * references of plans 08 and 10 are covered when they land). The frontmatter of a file is metadata and is
 * not scanned. A URL is not a reference and is masked before extraction.
 *
 * NON_TOOL: every snake_case token is a tool candidate. The tokens at the base that name a field, an argument, a
 * value or a code identifier are frozen in NON_TOOL, each with a reason. The table is frozen at this commit. A new
 * entry needs a reviewed diff with its reason, so an unknown token fails by default.
 *
 * KNOWN table (the KNOWN rule of this phase). A KNOWN name that fails to resolve prints "KNOWN <kind> <name> closes
 * in <plan>" or "KNOWN <kind> <name> route <line>" and does not fail the test. A KNOWN entry that now resolves, or
 * whose name no longer appears, FAILS the test: remove the KNOWN entry (the transition rule applies: the task that
 * makes it pass removes it in the same commit and records "KNOWN moved" in its SUMMARY). Entries are keyed by the
 * kind and the name. The file and line at the base are information only, so a line-for-line move does not reopen
 * an entry. Any other unresolved name fails.
 *
 * Exports (for plans 05, 08 and 10): extractReferences, resolveReference, REFERENCE_GRAMMAR, loadSources, SCOPE_FILES.
 *
 * Hermetic: HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, MINDRIAN_ROOMS_ROOT and CLAUDE_CONFIG_DIR are mkdtemp
 * dirs before any repo require; a net guard counts any fetch. Read-only. No network.
 *
 * Output: one PASS, FAIL or KNOWN line per leg, then PASS: n FAIL: n. Exit 0 when no required leg fails.
 * Run with --list to print every extracted reference with its resolution (used to build the tables).
 * House rule: hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// ---- grammar (token shapes and citation forms only; no name list, no file read) -------------------------------

const TOP = '(?:lib|scripts|references|skills|agents|commands|data|output-styles|bin|hooks|tests|docs)';
const EXT = '(?:cjs|mjs|js|ts|tsx|md|json|jsonl|sh|py|html|css|yml|yaml|txt|db)';
const KEBAB = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
// The plugin root variable in its three written forms (plain, braced, braced with the default and the guard message).
const ROOT_VAR = '(?:\\$\\{MINDRIAN_OS_ROOT:-\\$\\{CLAUDE_PLUGIN_ROOT:\\?[^}]*\\}\\}|\\$\\{CLAUDE_PLUGIN_ROOT\\}|\\$CLAUDE_PLUGIN_ROOT)';

const REFERENCE_GRAMMAR = Object.freeze({
  version: 1,
  // Spans that are not references. They are blanked before extraction.
  mask: Object.freeze([
    Object.freeze({ id: 'url', source: 'https?:\\/\\/[^\\s)>`\\]]+' }),
  ]),
  // Forms run in order on a line. A form with mask:true blanks its span so later forms do not hit it again.
  forms: Object.freeze([
    Object.freeze({ id: 'path-root', kind: 'path', group: 0, mask: true,
      source: ROOT_VAR + '\\/[A-Za-z0-9_.\\-\\/*<>]*[A-Za-z0-9_*>]' }),
    Object.freeze({ id: 'path-top', kind: 'path', group: 0, mask: true,
      source: '(?<![A-Za-z0-9_.\\-\\/~$])' + TOP + '\\/[A-Za-z0-9_.\\-\\/*<>]*[A-Za-z0-9_*>]' }),
    Object.freeze({ id: 'path-ext', kind: 'path', group: 0, mask: true,
      source: '(?<![A-Za-z0-9_\\-\\/])[~$A-Za-z0-9_.\\-]*\\/[A-Za-z0-9_.\\-\\/*<>]*\\.' + EXT + '(?![A-Za-z0-9_])' }),
    Object.freeze({ id: 'command', kind: 'command', group: 1, mask: true,
      source: '\\/mos:(' + KEBAB + ')' }),
    Object.freeze({ id: 'tool-mcp', kind: 'tool', group: 0, mask: true,
      source: '\\bmcp__[A-Za-z0-9_\\-]+__[A-Za-z0-9_]+\\b' }),
    Object.freeze({ id: 'tool-snake', kind: 'tool', group: 0, mask: true,
      source: '\\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\\b' }),
    Object.freeze({ id: 'slug-sections-path', kind: 'slug', group: 1, mask: false,
      source: '\\bsections?\\/(' + KEBAB + ')\\b' }),
    Object.freeze({ id: 'slug-trailing-slash', kind: 'slug', group: 1, mask: false,
      source: '`(' + KEBAB + ')\\/`' }),
    Object.freeze({ id: 'slug-before-word', kind: 'slug', group: 1, mask: false,
      source: '`(' + KEBAB + ')`\\s+sections?\\b' }),
    Object.freeze({ id: 'slug-after-word', kind: 'slug', group: 1, mask: false,
      source: '\\bsections?\\s+`(' + KEBAB + ')`' }),
  ]),
  // Citation forms. They run on the unmasked line because they hold backticks and quotes. They match without regard to case.
  // target: where the heading must resolve: agent, skill, self (the citing file) or any (the persona file set).
  citations: Object.freeze([
    Object.freeze({ id: 'heading-agent', kind: 'heading', group: 1, target: 'agent',
      source: 'the agent\u2019?\'?s `#{1,6} ([^`]+)` section' }),
    Object.freeze({ id: 'heading-backtick', kind: 'heading', group: 1, target: 'any',
      source: '`#{1,6} ([^`]+)`' }),
    Object.freeze({ id: 'heading-in-skill', kind: 'heading', group: 1, target: 'skill',
      source: '\\bsee (?:the )?["\u201c]?([^"`\u201c\u201d.;()\\n]{3,80}?)["\u201d]? in the larry-personality skill' }),
    Object.freeze({ id: 'heading-above', kind: 'heading', group: 1, target: 'self',
      source: '\\(see ["\u201c]?([^"\u201c\u201d()]{3,80}?)["\u201d]? above\\)' }),
    Object.freeze({ id: 'rule-standing', kind: 'rule', group: 1, target: 'any',
      source: 'the standing ["\u201c]([^"\u201d]+)["\u201d] rule' }),
  ]),
});

function lineHits(line, lineNo, file) {
  const hits = [];
  let work = line;
  const blank = function (start, len) { work = work.slice(0, start) + ' '.repeat(len) + work.slice(start + len); };
  REFERENCE_GRAMMAR.mask.forEach(function (m) {
    const re = new RegExp(m.source, 'g');
    let x;
    while ((x = re.exec(work)) !== null) blank(x.index, x[0].length);
  });
  REFERENCE_GRAMMAR.forms.forEach(function (f) {
    const re = new RegExp(f.source, 'g');
    let x;
    const spans = [];
    while ((x = re.exec(work)) !== null) {
      hits.push({ kind: f.kind, text: x[f.group], form: f.id, file: file, line: lineNo, target: null });
      spans.push([x.index, x[0].length]);
      if (x[0].length === 0) re.lastIndex += 1;
    }
    if (f.mask) spans.forEach(function (s) { blank(s[0], s[1]); });
  });
  REFERENCE_GRAMMAR.citations.forEach(function (c) {
    const re = new RegExp(c.source, 'gi');
    let x;
    while ((x = re.exec(line)) !== null) {
      hits.push({ kind: c.kind, text: x[c.group].trim(), form: c.id, file: file, line: lineNo, target: c.target });
    }
  });
  return hits;
}

/**
 * extractReferences(text, opts) -> [{ kind, text, form, file, line, target }]
 * Pure. Reads no file and no name list. opts.file labels the hits; opts.frontmatter true scans the frontmatter too.
 * A heading hit that two forms both match (for example an agent-targeted citation and the plain backtick form)
 * is kept once, with the narrower target.
 */
function extractReferences(text, opts) {
  const o = opts || {};
  const file = o.file || '(text)';
  const lines = String(text).split('\n');
  let start = 0;
  if (!o.frontmatter && lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end !== -1) start = end + 1;
  }
  const out = [];
  for (let i = start; i < lines.length; i += 1) {
    lineHits(lines[i], i + 1, file).forEach(function (h) { out.push(h); });
  }
  // Keep one heading hit per (text, line): the narrowest target wins.
  const rank = { agent: 0, skill: 1, self: 2, any: 3 };
  const best = new Map();
  out.forEach(function (h) {
    if (h.kind !== 'heading' && h.kind !== 'rule') return;
    const key = h.kind + '|' + h.text + '|' + h.file + '|' + h.line;
    const cur = best.get(key);
    if (!cur || rank[h.target] < rank[cur.target]) best.set(key, h);
  });
  return out.filter(function (h) {
    if (h.kind !== 'heading' && h.kind !== 'rule') return true;
    return best.get(h.kind + '|' + h.text + '|' + h.file + '|' + h.line) === h;
  });
}

// ---- name sources (read from disk at run time) ------------------------------------------------------------------

const SCOPE_FIXED = Object.freeze([
  'agents/larry-extended.md',
  'skills/larry-personality/SKILL.md',
  'skills/larry-personality/mode-engine.md',
  'skills/room-proactive/SKILL.md',
]);

function scopeFiles() {
  const files = SCOPE_FIXED.slice();
  fs.readdirSync(path.join(ROOT, 'references', 'personality')).filter(function (f) { return /\.md$/.test(f); }).sort()
    .forEach(function (f) { files.push('references/personality/' + f); });
  return files;
}

function headingsOf(text) {
  const out = [];
  String(text).split('\n').forEach(function (ln) {
    const m = /^(#{1,6}) (.*)$/.exec(ln);
    if (m) out.push(m[2].trim());
  });
  return out;
}

let SOURCES = null;
function loadSources() {
  if (SOURCES) return SOURCES;
  const commands = new Set(fs.readdirSync(path.join(ROOT, 'commands')).filter(function (f) { return /\.md$/.test(f); })
    .map(function (f) { return f.replace(/\.md$/, ''); }));
  const connectors = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'mcp-tool-connectors.json'), 'utf8')).connectors;
  const tools = new Set();
  connectors.forEach(function (c) { const m = /^mcp:(.+)$/.exec(c.surface || ''); if (m) tools.add(m[1]); });
  // The brain_* names that the Part 8 egress guard governs, read from its source text.
  const guard = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs'), 'utf8');
  const brain = new Set();
  const bre = /\bbrain_[a-z]+(?:_[a-z]+)*\b/g;
  let b;
  while ((b = bre.exec(guard)) !== null) brain.add(b[0]);
  // The Brain surface contract: the loop tools, the FeyMinto reads and the registered read tools it names.
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'brain-surface-contract.json'), 'utf8'));
  const namesOf = function (v) { return Array.isArray(v) ? v : Object.keys(v || {}); };
  namesOf(contract.loop_tools).concat(namesOf(contract.feyminto_reads)).forEach(function (n) { brain.add(n); });
  const noteTools = String(contract.non_contract_note || '').match(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g) || [];
  noteTools.forEach(function (n) { brain.add(n); });
  const sections = new Set(require(path.join(ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs')).SECTION_NAMES);
  const personaText = {};
  const headings = {};
  scopeFiles().forEach(function (rel) {
    personaText[rel] = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    headings[rel] = headingsOf(personaText[rel]);
  });
  SOURCES = { commands: commands, tools: tools, brain: brain, sections: sections, personaText: personaText, headings: headings };
  return SOURCES;
}

// 369.6-10 (D-04): the skill and the three references its operator manual moved to.
const MOVED_HOME = Object.freeze(['skills/larry-personality/SKILL.md', 'references/personality/reach-and-dial.md',
  'references/personality/memory-and-findings.md', 'references/personality/onboarding.md']);

const NORM = function (s) { return String(s).replace(/\u2019/g, "'").toLowerCase().trim(); };

function headingMatches(list, wanted) {
  const w = NORM(wanted);
  return list.some(function (h) { return NORM(h).indexOf(w) === 0; });
}

// ---- NON_TOOL: snake_case tokens at the base that are not tools (frozen; a new entry needs a reviewed diff) -----
const NON_TOOL_GROUPS = Object.freeze({
  'a reach id of the reach table (a value, not a tool)': ['brain_consult', 'context_block', 'cross_room', 'deep_research', 'eureka_bridge'],
  'a posture value of the dial (push_forward, hold, pull_back)': ['push_forward', 'pull_back'],
  'a field, argument or output key of a tool, a file or the engine': [
    'autonomous_safe', 'body_shape', 'canonical_role', 'canonical_verb', 'chain_confidence', 'curated_chains', 'epistemic_type',
    'evidence_node_ids', 'fire_skill', 'hitl_shape', 'include_superseded', 'next_gate', 'persona_variants', 'proactive_intelligence',
    'reach_id', 'readiness_score', 'review_status', 'role_blend', 'room_delta', 'routing_source', 'venture_stage'],
  'a violation code returned by the voice-line audit': ['evidence_requirement', 'mechanism_clause', 'no_unbacked_superlatives', 'time_anchor'],
  'a wire id, stamp action or graph edge type shown only to explain what Larry must not say': [
    'find_the_problem', 'pursue_or_drop', 'semantic_implementation', 'structural_transfer', 'part_of'],
  'a gap or contradiction code in a room-proactive table': [
    'capacity_mismatch', 'no_assessment', 'no_mentors', 'no_profiles', 'solo_founder', 'stage_mismatch', 'stale_assessment'],
  'a role or persona key of the persona map': ['cv_analyst', 'domain_expert', 'founder_grant', 'pws_consultant', 'pws_investment', 'researcher_ind'],
  'a lexicon id (a concept key of the lexicon table)': ['beautiful_question', 'nested_hierarchies', 'reverse_salient'],
});
// Pinned count: a new NON_TOOL entry changes this number in the same reviewed diff, with its reason.
const NON_TOOL_FROZEN_COUNT = 53;

// ---- KNOWN table: every name unresolved at the base (plan 369.6-03), keyed by kind and name --------------------
// closes_in: the plan that rewrites that text. route: a runtime fact or a file outside this phase, routed to a quick task.
// base: the file and line at the base, information only.
// 369.6-11 Task 2 (2026-10-30): KNOWN moved to required, closed by 369.6-11 Task 2: command|command and command|reason (the Provoked formula and table are retired),
// rule|never announce tool calls (the No ceremony line cites the agent's Operating invisibly section), and the owner-home research path (the example is reworded).
const KNOWN = Object.freeze({
  'path|~/.mindrian/stance-state.json': { route: 'runtime path in the user home; the repo tree cannot resolve it; typed runtime-path form via /gsd-quick', base: 'SKILL.md:181' },
  'path|~/MindrianRooms/.rooms/registry.json': { route: 'runtime path in the user home; typed runtime-path form via /gsd-quick', base: 'room-proactive/SKILL.md:37' },
  'path|/.mindrian/last-cascade.json': { route: 'runtime path under a room folder (<roomDir> placeholder); typed runtime-path form via /gsd-quick', base: 'room-proactive/SKILL.md:47' },
  'path|.planning/research/cool-ui-style-reference.md': { route: 'dangling file reference in room-proactive; /gsd-quick', base: 'room-proactive/SKILL.md:125' },
  'path|docs/2026-09-03-DESIGN-t2-write-back-minimal.md': { route: 'dangling file reference in room-proactive; /gsd-quick', base: 'room-proactive/SKILL.md:243' },
  'slug|room': { route: 'the legacy room/ folder is not a section slug; slug form needs a legacy-folder allowance via /gsd-quick', base: 'room-proactive/SKILL.md:37' },
  'tool|brain_find_patterns': { route: 'mode-engine.md names a Brain tool that no registry lists; /gsd-quick (mode-engine.md is outside the persona plans)', base: 'mode-engine.md:164' },
  'tool|brain_framework_chain': { route: 'mode-engine.md names a Brain tool that no registry lists; /gsd-quick', base: 'mode-engine.md:166' },
  'tool|brain_gap_assess': { route: 'mode-engine.md names a Brain tool that no registry lists; /gsd-quick', base: 'mode-engine.md:162' },
});

const NON_TOOL = new Map();
Object.keys(NON_TOOL_GROUPS).forEach(function (reason) {
  NON_TOOL_GROUPS[reason].forEach(function (tok) { NON_TOOL.set(tok, reason); });
});

/**
 * resolveReference(hit, sources) -> { ok, reason }
 * sources defaults to loadSources(). Fails closed: an unrecognised kind is unresolved.
 */
function resolveReference(hit, sources) {
  const S = sources || loadSources();
  const t = hit.text;
  switch (hit.kind) {
    case 'command':
      return S.commands.has(t) ? { ok: true, reason: 'commands/' + t + '.md exists' } : { ok: false, reason: 'no commands/' + t + '.md' };
    case 'tool': {
      const name = /^mcp__/.test(t) ? t.split('__').pop() : t;
      if (S.tools.has(name)) return { ok: true, reason: 'tool id in data/mcp-tool-connectors.json' };
      if (S.brain.has(name)) return { ok: true, reason: 'brain tool name in the egress guard or data/brain-surface-contract.json' };
      if (NON_TOOL.has(t)) return { ok: true, reason: 'NON_TOOL: ' + NON_TOOL.get(t) };
      return { ok: false, reason: 'no tool, brain tool or NON_TOOL entry named ' + name };
    }
    case 'path': {
      let p = t.replace(new RegExp('^' + ROOT_VAR + '\\/'), '').replace(/^\.\//, '');
      if (/^(~|\$HOME|\/)/.test(p)) return { ok: false, reason: 'runtime path outside the repo tree' };
      const wild = p.search(/[*<]/);
      if (wild !== -1) {
        const dir = p.slice(0, wild).replace(/[^/]*$/, '');
        const base = dir.replace(/\/$/, '');
        return base === '' || fs.existsSync(path.join(ROOT, base))
          ? { ok: true, reason: 'directory ' + (base || '.') + ' exists (pattern)' } : { ok: false, reason: 'no directory ' + base };
      }
      return fs.existsSync(path.join(ROOT, p)) ? { ok: true, reason: p + ' exists' } : { ok: false, reason: 'no file ' + p };
    }
    case 'slug':
      return S.sections.has(t) ? { ok: true, reason: 'section in SECTION_NAMES' } : { ok: false, reason: 'not in SECTION_NAMES' };
    case 'heading': {
      let list;
      if (hit.target === 'agent') list = S.headings['agents/larry-extended.md'];
      else if (hit.target === 'skill') list = S.headings['skills/larry-personality/SKILL.md'];
      else if (hit.target === 'self') {
        // 369.6-10 (D-04): the skill's operator manual moved line for line into three references, so an "above" or "below" cite
        // between those moved sections can cross a file. A cite made inside the skill or one of the three references resolves in
        // any of the four; every other file still resolves in itself only.
        list = S.headings[hit.file] || [];
        if (MOVED_HOME.indexOf(hit.file) !== -1) {
          list = MOVED_HOME.reduce(function (acc, k) { return acc.concat(S.headings[k] || []); }, []);
        }
      }
      else list = Object.keys(S.headings).reduce(function (acc, k) { return acc.concat(S.headings[k]); }, []);
      return headingMatches(list, t) ? { ok: true, reason: 'heading found' } : { ok: false, reason: 'no heading starts with "' + t + '" (' + (hit.target || 'any') + ')' };
    }
    case 'rule': {
      const w = NORM(t);
      const found = Object.keys(S.personaText).some(function (rel) {
        return S.personaText[rel].split('\n').some(function (ln, i) {
          if (rel === hit.file && i + 1 === hit.line) return false;
          return NORM(ln).indexOf(w) !== -1;
        });
      });
      return found ? { ok: true, reason: 'phrase found on another line of the persona text' } : { ok: false, reason: 'phrase appears nowhere else in the persona text' };
    }
    default:
      return { ok: false, reason: 'unknown kind ' + hit.kind };
  }
}

module.exports = { extractReferences: extractReferences, resolveReference: resolveReference, REFERENCE_GRAMMAR: REFERENCE_GRAMMAR, loadSources: loadSources, SCOPE_FILES: scopeFiles, NON_TOOL: NON_TOOL, KNOWN: KNOWN };

function main() {
  const HOME_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-3696-drift-'));
  ['HOME', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR'].forEach(function (k) {
    const d = path.join(HOME_TMP, k.toLowerCase());
    fs.mkdirSync(d, { recursive: true });
    process.env[k] = d;
  });
  process.env.USERPROFILE = process.env.HOME;
  const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
  const NET = installNetGuard();
  const { check, summary } = makeChecker('test-3696-persona-drift');

  const S = loadSources();
  const all = [];
  scopeFiles().forEach(function (rel) {
    extractReferences(fs.readFileSync(path.join(ROOT, rel), 'utf8'), { file: rel }).forEach(function (h) { all.push(h); });
  });

  if (process.argv.includes('--list')) {
    all.forEach(function (h) {
      const r = resolveReference(h, S);
      console.log([r.ok ? 'ok ' : 'BAD', h.kind, JSON.stringify(h.text), h.file + ':' + h.line, h.form, r.reason].join('\t'));
    });
    return 0;
  }

  // ---- E: the extraction self-test runs first, before any persona file is judged (Codex C7) -------------------
  const SYNTH = [
    'Call not_a_tool now.',
    'Use `not_a_tool` in a code span.',
    'See /mos:not-a-command for the rest.',
    'Open lib/core/not-a-file.cjs first.',
    'The `not-a-section` section holds it.',
    'See `## Not A Heading` in the larry-personality skill.',
    'This mirrors the standing "not a rule" rule.',
  ].join('\n');
  const synth = extractReferences(SYNTH, { file: '(synthetic)' });
  const want = [
    ['E1 a bare snake_case word', 'tool', 'not_a_tool', 1],
    ['E2 a snake_case word in a code span', 'tool', 'not_a_tool', 2],
    ['E3 a /mos: command', 'command', 'not-a-command', 3],
    ['E4 a repo path', 'path', 'lib/core/not-a-file.cjs', 4],
    ['E5 a section slug in a slug position', 'slug', 'not-a-section', 5],
    ['E6 a cited heading', 'heading', 'Not A Heading', 6],
    ['E7 a cited rule phrase', 'rule', 'not a rule', 7],
  ];
  want.forEach(function (w) {
    check(w[0] + ' is extracted by extractReferences alone', synth.some(function (h) { return h.kind === w[1] && h.text === w[2] && h.line === w[3]; }),
      'got ' + JSON.stringify(synth.map(function (h) { return h.kind + ':' + h.text + '@' + h.line; })));
  });
  check('E8 the synthetic text yields exactly those seven references', synth.length === 7, 'count ' + synth.length);
  const synthUnresolved = synth.filter(function (h) { return !resolveReference(h, S).ok; });
  check('E9 fail closed: all seven synthetic names are reported unresolved', synthUnresolved.length === 7, 'unresolved ' + synthUnresolved.length);
  {
    const extra = extractReferences([
      'Run /mos:grade and see https://example.com/a/b.html for more.',
      'Call mcp__srv__not_a_real_tool, then lib/core/x_y.cjs.',
      'See "Not A Quoted Heading" in the larry-personality skill, then the agent\u2019s `## Not An Agent Heading` section (see Not Above above).',
      'Look in sections/not-a-slug and `not-a-folder/` today.',
    ].join('\n'), { file: '(synthetic)' });
    const has = function (k, t) { return extra.some(function (h) { return h.kind === k && h.text === t; }); };
    check('E10 further forms: command, mcp tool, quoted heading, agent heading, above cite, slug forms, no URL path',
      has('command', 'grade') && has('tool', 'mcp__srv__not_a_real_tool') && has('path', 'lib/core/x_y.cjs')
      && has('heading', 'Not A Quoted Heading') && has('heading', 'Not An Agent Heading') && has('heading', 'Not Above')
      && has('slug', 'not-a-slug') && has('slug', 'not-a-folder')
      && !extra.some(function (h) { return h.kind === 'path' && /example\.com/.test(h.text); }),
      JSON.stringify(extra.map(function (h) { return h.kind + ':' + h.text; })));
    check('E11 the tool inside a path is not also read as a tool', !extra.some(function (h) { return h.kind === 'tool' && h.text === 'x_y'; }));
  }
  check('E12 REFERENCE_GRAMMAR is frozen plain data (strings only, no function, no file read)',
    Object.isFrozen(REFERENCE_GRAMMAR) && ['mask', 'forms', 'citations'].every(function (k) {
      return REFERENCE_GRAMMAR[k].every(function (f) { return typeof f.source === 'string' && Object.keys(f).every(function (x) { return typeof f[x] !== 'function'; }); });
    }));

  // ---- D: the run-time name sources and the frozen tables ---------------------------------------------------
  check('D1 name sources are read from disk: ' + S.commands.size + ' commands, ' + S.tools.size + ' tool ids, ' + S.brain.size + ' brain tools, ' + S.sections.size + ' sections',
    S.commands.size > 50 && S.tools.size > 30 && S.brain.size > 5 && S.sections.size >= 11);
  {
    const own = fs.readFileSync(__filename, 'utf8');
    const typed = Array.from(S.tools).filter(function (id) { return new RegExp('\\b' + id + '\\b').test(own); });
    check('D2 this file holds no typed tool id of the generated registry', typed.length === 0, typed.join(', '));
  }
  check('D3 NON_TOOL holds ' + NON_TOOL_FROZEN_COUNT + ' entries (frozen count)', NON_TOOL.size === NON_TOOL_FROZEN_COUNT, 'size ' + NON_TOOL.size);
  {
    const shadow = Array.from(NON_TOOL.keys()).filter(function (t) { return S.tools.has(t) || S.brain.has(t); });
    check('D4 no NON_TOOL entry hides a real tool', shadow.length === 0, shadow.join(', '));
  }
  check('D5 the persona scope holds ' + scopeFiles().length + ' files and extraction found ' + all.length + ' references', scopeFiles().length >= 10 && all.length > 100);

  // ---- R: resolution of every reference in the persona text ------------------------------------------------
  const unique = new Map();
  all.forEach(function (h) {
    const key = h.kind + '|' + h.text;
    if (!unique.has(key)) unique.set(key, { hit: h, count: 0 });
    unique.get(key).count += 1;
  });
  const unresolved = [];
  unique.forEach(function (v, key) {
    const r = resolveReference(v.hit, S);
    if (!r.ok) unresolved.push({ key: key, hit: v.hit, reason: r.reason, count: v.count });
  });
  const newOnes = unresolved.filter(function (u) { return !KNOWN[u.key]; });
  check('R1 no new unresolved name (' + unique.size + ' distinct names, ' + unresolved.length + ' unresolved, all of them KNOWN)', newOnes.length === 0,
    newOnes.map(function (u) { return u.key + ' at ' + u.hit.file + ':' + u.hit.line + ' (' + u.reason + ')'; }).join('; '));
  let knownCount = 0;
  Object.keys(KNOWN).forEach(function (key) {
    const k = KNOWN[key];
    const u = unresolved.find(function (x) { return x.key === key; });
    const label = key.replace('|', ' ');
    if (u) {
      knownCount += 1;
      console.log('KNOWN ' + label + ' ' + (k.closes_in ? 'closes in ' + k.closes_in : 'route ' + k.route) + ' (base ' + k.base + '; now at ' + u.hit.file + ':' + u.hit.line + '; ' + u.reason + ')');
    } else if (unique.has(key)) {
      check('R2 ' + label + ': KNOWN entry now resolves: remove the KNOWN entry', false);
    } else {
      check('R2 ' + label + ': KNOWN name no longer appears: remove the KNOWN entry', false);
    }
  });

  // ---- X: dash guard and network ----------------------------------------------------------------------------
  const EM = String.fromCharCode(0x2014);
  const EN = String.fromCharCode(0x2013);
  check('X1 no em dash or en dash in this file', fs.readFileSync(__filename, 'utf8').split(EM).length === 1 && fs.readFileSync(__filename, 'utf8').split(EN).length === 1);
  check('X2 no network call was attempted', NET.attempts() === 0);
  console.log('KNOWN names: ' + knownCount);
  return summary();
}

if (require.main === module) {
  process.exit(main());
}
