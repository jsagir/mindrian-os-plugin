#!/usr/bin/env node
'use strict';

/*
 * check-plugin-path-anchoring.cjs
 *
 * Phase 271-01 - the measuring instrument for the bare-plugin-path defect class.
 *
 * WHY THIS EXISTS. commands/file-meeting.md shipped 25 citations of the form
 * "Read `references/meeting/knowledge-typing.md`". A slash command's body is
 * executed with the USER'S cwd (their Data Room), not the plugin install dir, so
 * every one of those reads resolved against the wrong base and silently failed.
 * The RCA (.planning/debug/resolved/file-meeting-missing-reference-files.md) fixed
 * that ONE file and named the structural guard as missing work. Without the guard,
 * the next command authored next month reintroduces the same defect and nobody
 * notices until a real user's session fails. This gate is that guard.
 *
 * THE PINNED PREDICATE (deterministic, lexical, no inference, no network).
 * A citation is a VIOLATION when ALL THREE hold:
 *
 *   (a) the line contains a backtick-delimited token matching `references/<path>`,
 *       OR a bare token references/<path> immediately following one of the words
 *       Read, read, load, loaded, see, See, per, from, or a leading list-number
 *       ("1. ", "2. ", optionally followed by markdown bold); AND
 *   (b) the token is NOT already prefixed by ${CLAUDE_PLUGIN_ROOT}/ or by the
 *       fail-closed ${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?...}}/ form; AND
 *   (c) the file:pattern pair is not present in ALLOWLIST.
 *
 * A bare mention that is neither backticked nor introduced by a citation verb is
 * NOT a site. That is deliberate: "it executes the chosen methodology from local
 * references/methodology/*.md" (agents/framework-runner.md:26) is prose about repo
 * layout inside an HTML comment, not an instruction the model resolves. The
 * predicate is intentionally narrower than a blanket grep for the string
 * "references/", because a gate that flags prose gets silenced.
 *
 * TARGET RESOLUTION. Every hit resolves its cited path against the repo root and
 * carries a target tag, so a dangling citation is never silently anchored:
 *   OK             - the path resolves to a real file under the repo root
 *   DIR            - the path resolves to a real directory (a family citation)
 *   TEMPLATE-TARGET- the path carries a placeholder ({framework}) or a glob (*),
 *                    so it cannot be existence-checked; reported, never counted
 *                    as missing
 *   MISSING-TARGET - the path is concrete and does NOT exist on disk
 *
 * SURFACES SCANNED, each reported as its own group:
 *   commands   - commands/*.md
 *   skills     - skills/<name>/SKILL.md, EXCLUDING generated mirrors
 *   agents     - agents/*.md
 *   pipelines  - pipelines/**\/*.md (recursive: every pipeline stage file lives one
 *                level down, under pipelines/<chain>/, so a flat pipelines/*.md
 *                glob matches ZERO files and would make this surface a permanent
 *                false negative)
 *
 * WHY MIRROR SKILLS ARE EXCLUDED. scripts/build-skill-mirrors.cjs generates
 * skills/<name>/SKILL.md byte-for-byte from commands/<name>.md for every command
 * except its SKIP_LIST. Counting a mirror would double-count its command's
 * citations, and fixing a mirror by hand would be reverted by the next generator
 * run. Mirrors are fixed by fixing the command and regenerating (plan 271-03);
 * the hand-authored skills that have NO command behind them are a genuinely
 * separate surface (plan 271-04). A skills/<name>/SKILL.md counts as
 * hand-authored when commands/<name>.md does not exist, or when <name> is in the
 * generator's SKIP_LIST.
 *
 * ADVISORY TIER (--include-scripts, NEVER affects the exit code). The adjacent
 * class of bare `bash scripts/<name>` / `node scripts/<name>` invocations is
 * measured and reported, never gated. A Read citation and a Bash invocation fail
 * differently and need different verification, so mixing them into one verdict
 * would make the fix diff unreviewable. Lines whose match sits inside an
 * allowed-tools permission pattern such as Bash(node scripts/mos-status.cjs:*)
 * are excluded, because a permission matcher declares a pattern and never
 * resolves a path; the exclusion count is printed so it stays visible.
 *
 * MODES:
 *   --report (default) - every group, file:line, matched token, target tag,
 *                        per-surface and total counts. ALWAYS exits 0.
 *   --check            - violations plus totals; exits 1 when the non-allowlisted
 *                        references/ violation total is greater than 0.
 *   --json             - machine-readable dump of the same scan.
 *   --include-scripts  - adds the advisory scripts tier to --report and --json.
 *
 * This is a dev-time check script, not one of Canon Part 11's four invocable
 * surface classes (command, agent, pipeline, Decision-Gate skill), so R16's
 * connector descriptor and hitl_shape declaration do not reach it.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// ALLOWLIST - the declared exception list.
//
// Each entry is { file, pattern, reason }:
//   file    - repo-relative path of the file the exception applies to
//   pattern - a substring of the matched token; every violating token in `file`
//             that contains this substring is suppressed
//   reason  - REQUIRED, non-empty. A gate that can be silenced anonymously is
//             not a gate. validateAllowlist() throws at module load on any entry
//             with a missing or empty reason (T-271-02), so an unreasoned
//             suppression cannot even be imported, let alone shipped.
//
// SHIPPED EMPTY by plan 271-01. Plan 271-02 populates it with the /mos:radar
// disposition after a human ruling.
// ---------------------------------------------------------------------------
const ALLOWLIST = [];

function validateAllowlist(list) {
  if (!Array.isArray(list)) {
    throw new Error('check-plugin-path-anchoring: ALLOWLIST must be an array');
  }
  list.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`check-plugin-path-anchoring: ALLOWLIST[${i}] is not an object`);
    }
    if (typeof entry.file !== 'string' || entry.file.trim() === '') {
      throw new Error(`check-plugin-path-anchoring: ALLOWLIST[${i}] has no file`);
    }
    if (typeof entry.pattern !== 'string' || entry.pattern.trim() === '') {
      throw new Error(`check-plugin-path-anchoring: ALLOWLIST[${i}] has no pattern`);
    }
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      throw new Error(
        `check-plugin-path-anchoring: ALLOWLIST[${i}] (${entry.file}) has no written reason. ` +
          'Every exception must carry a non-empty reason so the gate cannot be silenced anonymously.'
      );
    }
  });
  return list;
}

validateAllowlist(ALLOWLIST);

// ---------------------------------------------------------------------------
// Lexical predicate pieces.
//
// T-271-01: every quantifier below is BOUNDED and no quantifier is nested inside
// another quantifier, so no crafted markdown line can force catastrophic
// backtracking. The whole scan is a single left-to-right indexOf walk per line.
// ---------------------------------------------------------------------------

const NEEDLE = 'references/';

// The two accepted anchor prefixes, matched against the text ENDING at the token.
const ANCHOR_SHORT_RE = /\$\{CLAUDE_PLUGIN_ROOT\}\/$/;
const ANCHOR_LONG_RE = /\$\{MINDRIAN_OS_ROOT:-\$\{CLAUDE_PLUGIN_ROOT:[^}\n]{0,120}\}\}\/$/;

// The cited path itself, anchored at the needle. Bounded, single character class.
const PATH_TAIL_RE = /^references\/[A-Za-z0-9._@*{}/-]{1,200}/;

// A citation verb (optionally wrapped in markdown bold) ending the text before
// the token. "**Optionally read** `references/...`" and "Read `references/...`"
// both qualify.
const TRIGGER_WORD_RE = /(?:^|[\s(*_"'>-])(?:Read|read|load|loaded|see|See|per|from)\**[:,]?\s+$/;

// A leading markdown list number ending the text before the token: "1. ", "12. **".
const LIST_NUMBER_RE = /^\s{0,8}\d{1,3}\.\s{0,4}\**$/;

// A character that means the needle is the TAIL of a longer path (docs/references/...).
const PATH_CHAR_RE = /[A-Za-z0-9._-]$/;

// Advisory tier: a bare scripts/ invocation.
const SCRIPT_INVOKE_RE = /\b(?:bash|node)\s+scripts\/[A-Za-z0-9._-]{1,120}/g;
// An allowed-tools permission matcher opening, ending at the match.
const PERMISSION_MATCHER_RE = /(?:Bash|Read|Write|Edit)\([^)\n]{0,120}$/;

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function stripTrailingPunctuation(token) {
  let out = token;
  while (out.length > 1 && '.,;:)`\'"'.includes(out[out.length - 1])) {
    // A real citation ends in an extension, so a trailing dot is punctuation only
    // when it is not part of ".md" / ".json" etc. Peel one char at a time and stop
    // as soon as the tail looks like an extension.
    if (/\.[A-Za-z0-9]{1,6}$/.test(out) && out[out.length - 1] !== '.') break;
    out = out.slice(0, -1);
  }
  return out;
}

function classifyTarget(token) {
  if (token.includes('{') || token.includes('*')) return 'TEMPLATE-TARGET';
  const abs = path.join(REPO_ROOT, token);
  if (!fs.existsSync(abs)) return 'MISSING-TARGET';
  return fs.statSync(abs).isDirectory() ? 'DIR' : 'OK';
}

function isAllowlisted(relFile, token, list) {
  return list.some((e) => e.file === relFile && token.includes(e.pattern));
}

/**
 * Scan a single line for reference citation sites.
 * Returns an array of { token, anchored, why, target }.
 */
function scanLine(line) {
  const hits = [];
  let from = 0;
  for (;;) {
    const idx = line.indexOf(NEEDLE, from);
    if (idx === -1) break;
    from = idx + NEEDLE.length;

    const head = line.slice(0, idx);

    // Is this needle already anchored?
    let anchored = false;
    let tokenStart = idx;
    const shortM = head.match(ANCHOR_SHORT_RE);
    const longM = head.match(ANCHOR_LONG_RE);
    if (longM) {
      anchored = true;
      tokenStart = idx - longM[0].length;
    } else if (shortM) {
      anchored = true;
      tokenStart = idx - shortM[0].length;
    }

    // Not anchored and preceded by a path character means this needle is the tail
    // of some OTHER path (docs/references/..., .planning/references/...), not a
    // plugin-root citation.
    if (!anchored && PATH_CHAR_RE.test(head)) continue;
    if (!anchored && head.endsWith('/')) continue;

    const tailM = PATH_TAIL_RE.exec(line.slice(idx));
    if (!tailM) continue;
    const token = stripTrailingPunctuation(tailM[0]);
    const tokenEnd = idx + tailM[0].length;

    // Citation context (predicate a).
    const before = line.slice(0, tokenStart);
    const backticked = tokenStart > 0 && line[tokenStart - 1] === '`' && line.indexOf('`', tokenEnd - 1) !== -1;
    const triggered = TRIGGER_WORD_RE.test(before);
    const listNumbered = LIST_NUMBER_RE.test(before);

    if (!backticked && !triggered && !listNumbered) continue;

    hits.push({
      token,
      anchored,
      why: backticked ? 'backtick' : triggered ? 'citation-verb' : 'list-number',
      target: classifyTarget(token),
    });
  }
  return hits;
}

/**
 * Scan one surface (a named list of repo-relative files).
 * Returns { name, files: [...], sites, violations, anchored, byFile }.
 */
function scanSurface(name, relFiles, opts) {
  const options = opts || {};
  const list = options.allowlist || ALLOWLIST;
  const sites = [];
  for (const rel of relFiles) {
    const abs = path.isAbsolute(rel) ? rel : path.join(options.root || REPO_ROOT, rel);
    let text;
    try {
      text = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      for (const hit of scanLine(lines[i])) {
        sites.push({
          surface: name,
          file: rel,
          line: i + 1,
          token: hit.token,
          anchored: hit.anchored,
          why: hit.why,
          target: hit.target,
          allowlisted: !hit.anchored && isAllowlisted(rel, hit.token, list),
        });
      }
    }
  }
  const violations = sites.filter((s) => !s.anchored && !s.allowlisted);
  return {
    name,
    files: relFiles,
    sites,
    violations,
    anchored: sites.filter((s) => s.anchored),
    allowlisted: sites.filter((s) => s.allowlisted),
    filesWithViolations: [...new Set(violations.map((v) => v.file))],
  };
}

/** Scan the advisory bare-scripts tier over the same files. */
function scanScriptInvocations(name, relFiles, root) {
  const base = root || REPO_ROOT;
  const sites = [];
  let excluded = 0;
  for (const rel of relFiles) {
    const abs = path.isAbsolute(rel) ? rel : path.join(base, rel);
    let text;
    try {
      text = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      SCRIPT_INVOKE_RE.lastIndex = 0;
      let m;
      while ((m = SCRIPT_INVOKE_RE.exec(line)) !== null) {
        const head = line.slice(0, m.index);
        if (PERMISSION_MATCHER_RE.test(head)) {
          excluded += 1;
          continue;
        }
        sites.push({ surface: name, file: rel, line: i + 1, token: m[0] });
      }
    }
  }
  return { name, sites, excluded };
}

// ---------------------------------------------------------------------------
// Surface enumeration.
// ---------------------------------------------------------------------------

function listMd(dirRel, root) {
  const dir = path.join(root || REPO_ROOT, dirRel);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => path.posix.join(dirRel, f));
}

function listMdRecursive(dirRel, root) {
  const base = root || REPO_ROOT;
  const dir = path.join(base, dirRel);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = path.posix.join(dirRel, entry.name);
    if (entry.isDirectory()) out.push(...listMdRecursive(rel, base));
    else if (entry.name.endsWith('.md')) out.push(rel);
  }
  return out;
}

// Mirror-generator parity: scripts/build-skill-mirrors.cjs mirrors every
// commands/<name>.md except its SKIP_LIST. Kept as a literal here rather than
// required from the generator so this gate stays a pure lexical scanner with no
// cross-script import; tests/test-271-plugin-path-anchoring.cjs does not depend
// on it, and any drift shows up as a skills-group count change in --report.
const MIRROR_SKIP_LIST = ['trending-to-absurd'];

function handAuthoredSkills(root) {
  const base = root || REPO_ROOT;
  const skillsDir = path.join(base, 'skills');
  const commandsDir = path.join(base, 'commands');
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .filter((name) => {
      const skillFile = path.join(skillsDir, name, 'SKILL.md');
      if (!fs.existsSync(skillFile)) return false;
      const isMirrored = fs.existsSync(path.join(commandsDir, `${name}.md`)) && !MIRROR_SKIP_LIST.includes(name);
      return !isMirrored;
    })
    .map((name) => path.posix.join('skills', name, 'SKILL.md'));
}

function enumerateSurfaces(root) {
  return [
    { name: 'commands', files: listMd('commands', root) },
    { name: 'skills (hand-authored, mirrors excluded)', files: handAuthoredSkills(root) },
    { name: 'agents', files: listMd('agents', root) },
    { name: 'pipelines', files: listMdRecursive('pipelines', root) },
  ];
}

function runScan(opts) {
  const options = opts || {};
  const root = options.root || REPO_ROOT;
  const groups = enumerateSurfaces(root).map((s) =>
    scanSurface(s.name, s.files, { root, allowlist: options.allowlist || ALLOWLIST })
  );
  const result = {
    root,
    groups,
    totals: {
      files: groups.reduce((n, g) => n + g.files.length, 0),
      sites: groups.reduce((n, g) => n + g.sites.length, 0),
      violations: groups.reduce((n, g) => n + g.violations.length, 0),
      anchored: groups.reduce((n, g) => n + g.anchored.length, 0),
      allowlisted: groups.reduce((n, g) => n + g.allowlisted.length, 0),
      missingTarget: groups.reduce((n, g) => n + g.violations.filter((v) => v.target === 'MISSING-TARGET').length, 0),
      templateTarget: groups.reduce((n, g) => n + g.violations.filter((v) => v.target === 'TEMPLATE-TARGET').length, 0),
    },
  };
  if (options.includeScripts) {
    result.advisory = enumerateSurfaces(root).map((s) => scanScriptInvocations(s.name, s.files, root));
    result.advisoryTotals = {
      sites: result.advisory.reduce((n, g) => n + g.sites.length, 0),
      excluded: result.advisory.reduce((n, g) => n + g.excluded, 0),
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Reporting.
// ---------------------------------------------------------------------------

const RECOVERY =
  'Recovery: anchor each citation with ${CLAUDE_PLUGIN_ROOT}/ (commands, agents) or the ' +
  'fail-closed ${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?...}}/ form (hand-authored skills), ' +
  'or add a reasoned ALLOWLIST entry.';

function printReport(scan, opts) {
  const violationsOnly = (opts || {}).violationsOnly === true;
  for (const g of scan.groups) {
    const rows = violationsOnly ? g.violations : g.sites;
    console.log(`\n=== ${g.name} === (${g.files.length} files scanned)`);
    if (rows.length === 0) {
      console.log('  (none)');
    }
    for (const s of rows) {
      const tags = [s.target];
      if (s.anchored) tags.push('ANCHORED');
      if (s.allowlisted) tags.push('ALLOWLISTED');
      console.log(`  ${s.file}:${s.line}  ${s.token}  [${tags.join(' ')}] (${s.why})`);
    }
    console.log(
      `  -- ${g.name}: sites=${g.sites.length} violations=${g.violations.length} ` +
        `anchored=${g.anchored.length} allowlisted=${g.allowlisted.length} ` +
        `filesWithViolations=${g.filesWithViolations.length}`
    );
  }

  if (scan.advisory) {
    console.log('\n=== ADVISORY (not gated by this phase): bare scripts/ invocations ===');
    for (const g of scan.advisory) {
      for (const s of g.sites) console.log(`  ${s.file}:${s.line}  ${s.token}`);
    }
    console.log(
      `  -- advisory sites=${scan.advisoryTotals.sites} ` +
        `permission-matcher exclusions=${scan.advisoryTotals.excluded} (never affects exit code)`
    );
  }

  console.log('\n=== TOTALS ===');
  console.log(`  files scanned      : ${scan.totals.files}`);
  console.log(`  citation sites     : ${scan.totals.sites}`);
  console.log(`  already anchored   : ${scan.totals.anchored}`);
  console.log(`  allowlisted        : ${scan.totals.allowlisted}`);
  console.log(`  VIOLATIONS         : ${scan.totals.violations}`);
  // Lowercase on purpose: the UPPERCASE token MISSING-TARGET must appear in the
  // output ONLY as a per-site tag, so `--report | grep -c 'MISSING-TARGET'` is an
  // honest count of dangling citations and not inflated by this summary label.
  console.log(`  of which missing-target: ${scan.totals.missingTarget}`);
  console.log(`  of which template-target: ${scan.totals.templateTarget}`);
}

function main(argv) {
  const args = argv.slice(2);
  const includeScripts = args.includes('--include-scripts');
  const scan = runScan({ includeScripts });

  let mode = 'report';
  for (const a of args) {
    switch (a) {
      case '--check':
        mode = 'check';
        break;
      case '--json':
        mode = 'json';
        break;
      case '--report':
        mode = 'report';
        break;
      case '--include-scripts':
        break;
      case '--help':
      case '-h':
        mode = 'help';
        break;
      default:
        if (a.startsWith('--')) {
          console.error(`unknown flag: ${a}`);
          return 2;
        }
    }
  }

  if (mode === 'help') {
    console.log('usage: check-plugin-path-anchoring.cjs [--report|--check|--json] [--include-scripts]');
    return 0;
  }

  if (mode === 'json') {
    console.log(JSON.stringify(scan, null, 2));
    return 0;
  }

  if (mode === 'check') {
    printReport(scan, { violationsOnly: true });
    if (scan.totals.violations > 0) {
      console.error(`\nFAIL: ${scan.totals.violations} unanchored plugin-relative references/ citation(s).`);
      console.error(RECOVERY);
      return 1;
    }
    console.log('\nOK: every plugin-relative references/ citation is anchored or allowlisted.');
    return 0;
  }

  printReport(scan, { violationsOnly: false });
  return 0;
}

module.exports = {
  ALLOWLIST,
  validateAllowlist,
  scanLine,
  scanSurface,
  scanScriptInvocations,
  handAuthoredSkills,
  enumerateSurfaces,
  runScan,
  main,
  REPO_ROOT,
  RECOVERY,
};

if (require.main === module) {
  process.exit(main(process.argv));
}
