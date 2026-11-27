#!/usr/bin/env node
'use strict';

/*
 * Quick 261127-bnd shell-text: finding F17, Codex Blocker 2 and plan check r2.
 *
 * Reason: a shell runs a command substitution `$(...)` and a backtick
 * command that a line holds, inside double quotes and with no quotes. When
 * an instruction line puts pasted text on a shell command line, that text
 * can run a command.
 *
 * Scanned folders, every *.md file, recursive: agents, commands, skills,
 * references, pipelines, output-styles. A line that matches RUNNER is a
 * shell line.
 *
 * The 5 classes:
 *   P1 (strict, 0 allowed): a quoted shell variable with a text name.
 *   P2 (ratchet with counts): a quoted placeholder that is not a safe
 *      placeholder; one entry is the pair (file, placeholder).
 *   P3 (ratchet with counts): a shell line with $ARGUMENTS; one entry is
 *      the file.
 *   P4 (strict, 0 allowed): on a shell line that holds `scripts/`, a
 *      placeholder with a text keyword that is not a file placeholder.
 *   P5 (ratchet with counts): 6 command fragments with a value that the
 *      person gives, with no quotes around the placeholder.
 *
 * Ratchet rule with counts: an unknown entry fails; a count above the
 * pinned count fails; a pinned entry that is gone prints a note and does
 * not fail.
 *
 * Tasks 4 to 6 of this quick fixed the 15 lines that carried text not
 * typed by the person, or free text. The entries that stay in the 3 lists
 * hold a value that the person gives or `$ARGUMENTS`. Their repair is
 * Phase 401 hygiene, after F1, and an entry leaves the list in the commit
 * that fixes its line.
 *
 * The test reads files only. The X6 and X9 texts go to a temp folder that
 * the test removes. Node built-in modules only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bnd-st-')));
const DIRS = ['agents', 'commands', 'skills', 'references', 'pipelines', 'output-styles'];
const REF = 'references/personality/agent-operations.md';

const RUNNER = /(^|[\s`(!;|&])(node|bash|sh|python3?|npx|curl)\s/;
const QVAR = /"\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?"/g;
const TEXT_NAMES = new Set('USER_INPUT INPUT USER_TEXT TEXT PASTE PASTED CONTENT BODY MESSAGE PROMPT TRANSCRIPT DOCUMENT DOC QUERY QUESTION TOPIC ANSWER'.split(' '));
const QPH = /"(<[^>"]{1,40}>|\{[^}"$]{1,40}\}|\[[^\]"]{1,40}\])"/g;
const SAFE_PH = new Set(['<room dir>', '<room path>', '<run_id>', '<quick run_id>', '<deep run_id>', '<slug>', '<claim id>']);
const ARGS = /\$ARGUMENTS\b/;
const PH = /<[^>\n]{1,60}>|(?<!\$)\{[^}$\n]{1,60}\}|\[[^\]\n]{1,60}\]/g;
const KEYWORD = /display-name|words|text|answer|question|topic|context|venture_name/i;
const FILE_PH = /\.(json|txt|md)$/i;

const P5_FRAGMENTS = [
  'build-new-surface.cjs" --from-expert <surname|nodeId>',
  'build-new-surface.cjs" --check --kind skill --name <expert>',
  'stamp-connections.cjs" --pair "<A>|<B>"',
  'mindrian-tools.cjs" room linkify {room-name if provided}',
  'mindrian-tools.cjs" vault {room-arg} {--path <dir> if provided} {--mode <value> if provided}',
  'persona-override.cjs set <role>',
];

// Pinned lists (built from the scan itself after Tasks 4 to 6; sorted).
const PIN_P2 = {
  'commands/admin.md\t[name]': 1,
  'commands/new-project.md\t<remote_url_or_empty>': 1,
  'commands/publish.md\t{domain}': 1,
  'commands/rooms.md\t<existing_remote>': 1,
  'commands/rooms.md\t<mode>': 1,
  'commands/rooms.md\t<new_setting>': 1,
  'commands/rooms.md\t<remote>': 1,
  'commands/rooms.md\t<remote_url_or_empty>': 1,
  'skills/admin/SKILL.md\t[name]': 1,
  'skills/new-project/SKILL.md\t<remote_url_or_empty>': 1,
  'skills/publish/SKILL.md\t{domain}': 1,
  'skills/rooms/SKILL.md\t<existing_remote>': 1,
  'skills/rooms/SKILL.md\t<mode>': 1,
  'skills/rooms/SKILL.md\t<new_setting>': 1,
  'skills/rooms/SKILL.md\t<remote>': 1,
  'skills/rooms/SKILL.md\t<remote_url_or_empty>': 1,
};

const PIN_P3 = {
  'commands/brain-derive.md': 1,
  'commands/dashboard.md': 1,
  'commands/dial-memory-refresh.md': 1,
  'commands/doctor.md': 2,
  'commands/explain-decision.md': 1,
  'commands/feynman-timeline-refresh.md': 1,
  'commands/heal.md': 1,
  'commands/hmi-status.md': 1,
  'commands/jtbd.md': 2,
  'commands/memory.md': 2,
  'commands/mva-brief.md': 1,
  'commands/mva-report.md': 1,
  'commands/organize.md': 1,
  'commands/skill.md': 1,
  'commands/status.md': 1,
  'commands/visualize.md': 1,
  'skills/brain-derive/SKILL.md': 1,
  'skills/dashboard/SKILL.md': 1,
  'skills/dial-memory-refresh/SKILL.md': 1,
  'skills/doctor/SKILL.md': 2,
  'skills/explain-decision/SKILL.md': 1,
  'skills/feynman-timeline-refresh/SKILL.md': 1,
  'skills/heal/SKILL.md': 1,
  'skills/hmi-status/SKILL.md': 1,
  'skills/jtbd/SKILL.md': 2,
  'skills/memory/SKILL.md': 2,
  'skills/mva-brief/SKILL.md': 1,
  'skills/mva-report/SKILL.md': 1,
  'skills/organize/SKILL.md': 1,
  'skills/skill/SKILL.md': 1,
  'skills/status/SKILL.md': 1,
  'skills/visualize/SKILL.md': 1,
};

const PIN_P5 = {
  'commands/find-connections.md\tstamp-connections.cjs" --pair "<A>|<B>"': 1,
  'commands/persona.md\tpersona-override.cjs set <role>': 1,
  'commands/room.md\tmindrian-tools.cjs" room linkify {room-name if provided}': 1,
  'commands/skill.md\tbuild-new-surface.cjs" --check --kind skill --name <expert>': 1,
  'commands/skill.md\tbuild-new-surface.cjs" --from-expert <surname|nodeId>': 1,
  'commands/vault.md\tmindrian-tools.cjs" vault {room-arg} {--path <dir> if provided} {--mode <value> if provided}': 1,
  'skills/find-connections/SKILL.md\tstamp-connections.cjs" --pair "<A>|<B>"': 1,
  'skills/persona/SKILL.md\tpersona-override.cjs set <role>': 1,
  'skills/room/SKILL.md\tmindrian-tools.cjs" room linkify {room-name if provided}': 1,
  'skills/skill/SKILL.md\tbuild-new-surface.cjs" --check --kind skill --name <expert>': 1,
  'skills/skill/SKILL.md\tbuild-new-surface.cjs" --from-expert <surname|nodeId>': 1,
  'skills/vault/SKILL.md\tmindrian-tools.cjs" vault {room-arg} {--path <dir> if provided} {--mode <value> if provided}': 1,
};

// Pins outside the scanned folders (quick 261127-bnd follow-up, verifier item d6).
// The line holds a quoted placeholder that is not a safe placeholder (class P2),
// and origin/main holds the same line. It is not fixed here: it calls the import
// form `--layout=import` of scripts/create-speaker-profile, which has no file flag.
// One entry is (file, placeholder, class); the count is the number of lines that
// hold the placeholder on a create-speaker-profile call.
const PIN_OUTSIDE = [
  { rel: 'templates/import/stage-contracts/03-route.md', ph: '"{display}"', cls: 'P2', count: 1 },
];

// The old lines (origin/main) that class P4 must see, kept as literals.
const OLD_P4_LINES = [
  'Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/create-speaker-profile" <room_dir> <speaker-slug> <speaker-role> <display-name>`',
  '2. Show the exact searches first. Run: `bash "${CLAUDE_PLUGIN_ROOT}/scripts/research-speaker" <room_dir> <speaker-slug> <display-name> "<project-context>" --list-queries`. It prints the 3 searches and an approval token, and it sends nothing.',
  '4. After yes, run: `bash "${CLAUDE_PLUGIN_ROOT}/scripts/research-speaker" <room_dir> <speaker-slug> <display-name> "<project-context>" --approve <token>`. A search that looks like it holds a credential is refused before it is sent, and each search that is sent gets one line in the room\'s audit record.',
  '7. If confirmed, run: `bash "${CLAUDE_PLUGIN_ROOT}/scripts/research-speaker" <room_dir> <speaker-slug> <display-name> "<project-context>" --approve <token> --apply` (the same token as step 4)',
  'bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" create <slug> "<slug>" "<venture_name>" "<venture_stage>"',
  'bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" create <slug> "<slug>" "<venture_name>" "Pre-Opportunity"',
  'node "${CLAUDE_PLUGIN_ROOT}/scripts/claim-checks.cjs" show --room "<room path>" <id or words>',
  'Same as the `claim` subcommand: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/claim-checks.cjs" show --room "<room path>" <id or words>`, resolve ambiguity the same way (AskUserQuestion over up to 4 candidates), and use the same not-found 3-line error.',
  'node "${CLAUDE_PLUGIN_ROOT}/scripts/claim-checks.cjs" record --room "<room path>" --claim "<claim id>" --against "<answer>" --against-kind <kind> --rung <N> --method <method> --result <result>',
  '   node "${CLAUDE_PLUGIN_ROOT}/scripts/room-question.cjs" set --room "<room path>" --origin <id> --based-on <current version, omitted when there is none> "<question text>"',
  'Run it as `node "${CLAUDE_PLUGIN_ROOT}/scripts/close-loop.cjs" version-log --room <roomDir> --topic "<topic>"`. It prints the chain newest first and names any same-topic conclusion left off the chain. It writes nothing.',
  '- **CLI:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/rs-experts-command.cjs" "<topic>" [--limit N] [--json]` reads `MINDRIAN_ROOM` or the current directory.',
];

// New lines of this plan (Tasks 4 to 6), kept as literals: 0 class P4 hits.
const NEW_P4_LINES = [
  'Then run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/create-speaker-profile" <room_dir> <speaker-slug> --role-file "<dir>/speaker-role.txt" --name-file "<dir>/speaker-name.txt"`.',
  'Run: `bash "${CLAUDE_PLUGIN_ROOT}/scripts/research-speaker" <room_dir> <speaker-slug> --name-file "<dir>/speaker-name.txt" --context-file "<dir>/project-context.txt" --list-queries`.',
  'bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" create <slug> "<slug>" --name-file "<dir>/venture-name.txt" --stage-file "<dir>/venture-stage.txt"',
  'node "${CLAUDE_PLUGIN_ROOT}/scripts/claim-checks.cjs" show --room "<room path>" --words-file "<dir>/words.txt"',
  'node "${CLAUDE_PLUGIN_ROOT}/scripts/claim-checks.cjs" record --room "<room path>" --claim "<claim id>" --against-file "<dir>/against.txt" --against-kind <kind> --rung <N> --method <method> --result <result>',
  '   node "${CLAUDE_PLUGIN_ROOT}/scripts/room-question.cjs" set --room "<room path>" --origin <id> --based-on <current version, omitted when there is none> --text-file "<dir>/question.txt"',
  'Then run `node "${CLAUDE_PLUGIN_ROOT}/scripts/close-loop.cjs" version-log --room <roomDir> --topic-file "<dir>/topic.json"`.',
  'Then run `node "${CLAUDE_PLUGIN_ROOT}/scripts/rs-experts-command.cjs" --topic-file "<dir>/topic.txt" [--limit N] [--json]`.',
];

const OLD_LINE_63 = '   - **CLI:** shell out: `node -e "console.log(JSON.stringify(require(\'./lib/core/dual-path-detector.cjs\').classify(process.argv[1])))" "$USER_INPUT"`';
const NEW_REF_LINES = [
  '   - **In every session, the terminal included:** call the MCP tool `detect_dual_path` with the input as its `text` argument (registered in `lib/mcp/tools/dual-path.cjs`).',
  '   - **Never put the person\'s input, or any pasted text, on a shell command line**, as an argument or inside quotes: a shell runs `$(...)` and backticks that pasted text holds. When the tool is not available, do not classify: ask the fallback question of the ambiguous path below.',
  '     - Call the MCP `extract_shallow` tool (a pure parse that writes nothing; it wraps `lib/core/shallow-doc-parser.cjs`; decision D-354-SYS05, `lib/mcp/tools/dual-path.cjs`), never a shell command with the pasted text; it returns an in-memory `{ user, venture, claims }` object (1 user + 1 venture + 1-3 claims) and nothing lands in room.db yet.',
];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

function repoEntries() {
  const files = [];
  for (const d of DIRS) walk(path.join(REPO, d), files);
  return files.sort().map((f) => ({ rel: path.relative(REPO, f).split(path.sep).join('/'), text: fs.readFileSync(f, 'utf8') }));
}

// scan: the result of the 5 classes over a list of { rel, text }.
function scan(entries) {
  const r = { files: entries.length, shell: 0, p1: [], p2: {}, p3: {}, p4: [], p5: {}, p2where: {} };
  for (const { rel, text } of entries) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      for (const fr of P5_FRAGMENTS) {
        if (l.includes(fr)) { const k = rel + '\t' + fr; r.p5[k] = (r.p5[k] || 0) + 1; }
      }
      if (!RUNNER.test(l)) continue;
      r.shell += 1;
      for (const m of l.matchAll(QVAR)) {
        if (TEXT_NAMES.has(m[1].toUpperCase())) r.p1.push(rel + ':' + (i + 1) + ' ' + m[0]);
      }
      for (const m of l.matchAll(QPH)) {
        if (SAFE_PH.has(m[1])) continue;
        const k = rel + '\t' + m[1];
        r.p2[k] = (r.p2[k] || 0) + 1;
        r.p2where[k] = rel + ':' + (i + 1) + ' ' + m[1];
      }
      if (ARGS.test(l)) r.p3[rel] = (r.p3[rel] || 0) + 1;
      if (l.includes('scripts/')) {
        for (const m of l.matchAll(PH)) {
          const inner = m[0].slice(1, -1);
          if (KEYWORD.test(inner) && !FILE_PH.test(inner)) r.p4.push(rel + ':' + (i + 1) + ' ' + m[0]);
        }
      }
    }
  }
  return r;
}

function scanText(rel, text) {
  const f = path.join(TMP, rel.replace(/[\\/]/g, '_'));
  fs.writeFileSync(f, text);
  return scan([{ rel, text: fs.readFileSync(f, 'utf8') }]);
}

// ratchet: the errors and the notes of a found map against a pinned map.
function ratchet(found, pins, where) {
  const errors = [];
  const notes = [];
  for (const k of Object.keys(found).sort()) {
    if (!(k in pins)) errors.push('unknown entry: ' + ((where && where[k]) || k.replace('\t', ' ')));
    else if (found[k] > pins[k]) errors.push('count ' + found[k] + ' above pin ' + pins[k] + ': ' + k.replace('\t', ' '));
  }
  for (const k of Object.keys(pins).sort()) {
    if (!(k in found)) notes.push('note: pinned entry gone: ' + k.replace('\t', ' '));
  }
  return { errors, notes };
}

function assert(c, m) { if (!c) throw new Error(m); }

let REPO_SCAN = null;
function repoScan() { if (!REPO_SCAN) REPO_SCAN = scan(repoEntries()); return REPO_SCAN; }
const NOTES = [];

function section(text, heading) {
  const lines = text.split('\n');
  const s = lines.findIndex((l) => l.trim() === heading);
  if (s < 0) return null;
  const out = [];
  for (let i = s + 1; i < lines.length; i += 1) { if (/^#/.test(lines[i])) break; out.push(lines[i]); }
  return out.join('\n');
}

const CASES = [
  ['X1', 'class P1 (strict) has 0 hits in the scanned folders', function () {
    const r = repoScan();
    assert(r.p1.length === 0, r.p1.length + ' hit(s): ' + r.p1.join(' | '));
  }],
  ['X2', 'the Dual-Path Detection section puts no input on a shell line', function () {
    const t = fs.readFileSync(path.join(REPO, REF), 'utf8');
    const s = section(t, '### Dual-Path Detection (Phase 115 -- consumes 115-02 artifacts)');
    assert(s !== null, 'heading not found');
    for (const bad of ['node -e', 'shell out', 'shell-out', 'process.argv']) assert(!s.includes(bad), 'section holds ' + bad);
    for (const good of ['detect_dual_path', 'extract_shallow', "Never put the person's input"]) assert(s.includes(good), 'section lacks ' + good);
  }],
  ['X3', 'the reference keeps the phrases that other tests pin', function () {
    const t = fs.readFileSync(path.join(REPO, REF), 'utf8');
    for (const s of ['lib/core/dual-path-detector.cjs', 'lib/core/shallow-doc-parser.cjs', 'claim_write', 'extract_shallow', 'writes nothing']) assert(t.includes(s), 'lacks ' + s);
  }],
  ['X4', 'class P2 (ratchet with counts) stays inside the pinned list', function () {
    const r = repoScan();
    const { errors, notes } = ratchet(r.p2, PIN_P2, r.p2where);
    NOTES.push(...notes);
    assert(errors.length === 0, errors.join(' | '));
  }],
  ['X5', 'class P3 (ratchet with counts) stays inside the pinned list', function () {
    const r = repoScan();
    const { errors, notes } = ratchet(r.p3, PIN_P3);
    NOTES.push(...notes);
    assert(errors.length === 0, errors.join(' | '));
  }],
  ['X6', 'the scanner sees each class in a temp text', function () {
    let r = scanText('t/old63.md', OLD_LINE_63 + '\n');
    assert(r.p1.length === 1, 'old line 63: ' + r.p1.length + ' P1 hit(s)');
    r = scanText('t/new.md', NEW_REF_LINES.join('\n') + '\n');
    assert(r.shell === 0 && r.p1.length === 0 && r.p4.length === 0 && Object.keys(r.p2).length === 0, 'new lines: shell ' + r.shell + ' p1 ' + r.p1.length);
    r = scanText('t/p2.md', 'node x.cjs "<new text>"\n');
    assert(ratchet(r.p2, PIN_P2).errors.length === 1, 'an unknown P2 pair is not seen');
    r = scanText('t/file.md', 'node x.cjs --text-file "<dir>/question.txt"\n');
    assert(Object.keys(r.p2).length === 0, 'a file path gives a P2 pair');
    const rooms = fs.readFileSync(path.join(REPO, 'commands/rooms.md'), 'utf8');
    r = scanText('commands/rooms.md', rooms + '\nnode x.cjs "<mode>"\n');
    assert(ratchet(r.p2, PIN_P2).errors.length >= 1, 'the P2 count rule does not fail');
    const doctor = fs.readFileSync(path.join(REPO, 'commands/doctor.md'), 'utf8');
    r = scanText('commands/doctor.md', doctor + '\nnode x.cjs $ARGUMENTS\n');
    assert(ratchet(r.p3, PIN_P3).errors.length >= 1, 'the P3 count rule does not fail');
  }],
  ['X7', 'the scan is not blind', function () {
    const r = repoScan();
    assert(r.files >= 100, r.files + ' files');
    assert(r.shell >= 50, r.shell + ' shell lines');
  }],
  ['X8', 'class P4 (strict) has 0 hits in the scanned folders', function () {
    const r = repoScan();
    assert(r.p4.length === 0, r.p4.length + ' hit(s): ' + r.p4.join(' | '));
  }],
  ['X9', 'class P4 sees the old lines and not the new lines', function () {
    OLD_P4_LINES.forEach((l, i) => {
      const r = scanText('t/old-' + i + '.md', l + '\n');
      assert(r.p4.length >= 1, 'old line ' + i + ' gives 0 hits');
    });
    let r = scanText('t/bare.md', 'node "x/scripts/y.cjs" <id or words>\n');
    assert(r.p4.length === 1, 'a placeholder with no quotes: ' + r.p4.length + ' hit(s)');
    NEW_P4_LINES.forEach((l, i) => {
      const n = scanText('t/new-' + i + '.md', l + '\n');
      assert(n.p4.length === 0, 'new line ' + i + ': ' + n.p4.join(' | '));
    });
    r = scanText('t/qs.md', 'node "x/scripts/research.cjs" plan --question-set <question-set.json>\n');
    assert(r.p4.length === 0, 'a file placeholder gives a hit');
  }],
  ['X10', 'class P5 (ratchet with counts) stays inside the pinned list', function () {
    const r = repoScan();
    const { errors, notes } = ratchet(r.p5, PIN_P5);
    NOTES.push(...notes);
    assert(errors.length === 0, errors.join(' | '));
  }],
  ['X11', 'the pins outside the scanned folders hold their count (class P2, d6)', function () {
    for (const pin of PIN_OUTSIDE) {
      const p = path.join(REPO, pin.rel);
      const n = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.includes('create-speaker-profile') && l.includes(pin.ph)).length : 0;
      assert(n <= pin.count, pin.rel + ' ' + pin.ph + ' (' + pin.cls + '): count ' + n + ' above pin ' + pin.count);
      if (n < pin.count) NOTES.push('note: pinned entry gone: ' + pin.rel + ' ' + pin.ph + ' (' + pin.cls + ')');
    }
  }],
];

function main() {
  let p = 0;
  let f = 0;
  const failures = [];
  try {
    for (const [id, name, fn] of CASES) {
      try { fn(); p += 1; process.stdout.write('  ok   ' + id + ' ' + name + '\n'); }
      catch (err) { f += 1; failures.push(id + ': ' + (err && err.message ? err.message : String(err))); process.stdout.write('  FAIL ' + id + ' ' + name + '\n'); }
    }
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  process.stdout.write('261127-bnd shell-text: ' + p + ' passed, ' + f + ' failed\n');
  for (const m of failures) process.stdout.write('    ' + m.slice(0, 600) + '\n');
  for (const n of NOTES) process.stdout.write('    ' + n + '\n');
  process.exit(f ? 1 : 0);
}

main();
