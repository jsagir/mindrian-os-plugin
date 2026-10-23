// book-review.cjs: run the mos-brand book's own review on the copy the face panel really draws.
//
// Phase 380 plan 07 (D-01, coordinator rule 4, T-380-25, T-380-26).
//
// What it does, in order:
//   1. Finds the book CLI (default /home/jsagi/mos-brand/bin/mos-brand.cjs). Exit 77 with one
//      sentence if it is missing.
//   2. Records the git HEAD and `git status --short` of the book BEFORE the run.
//   3. Makes a scratch folder with fs.mkdtempSync under os.tmpdir(). Nothing is written in the book.
//      If the book HEAD is not the pinned ref (default e947a5d), the book is exported with
//      `git archive <ref>` into the scratch folder and the CLI of that export runs. This reads the
//      book and writes nothing in it.
//   4. Runs the copy tests in a SCRATCH COPY of ui/mos-face with the dump switched on, and takes the
//      lines between COPYDUMP_BEGIN and COPYDUMP_END. (The engine test sandbox has no env, so the
//      switch is a global that this script sets in the copy only.) It adds the output of
//      `claude --plugin-dir <copy> -p "/mos-text"`, run with an empty rooms folder, so no real room
//      name can enter the copy.
//   5. Builds a scratch consumer: init --project, configure --intake --project, adopt --apply
//      --project, all pointing at the scratch folder. The intake names the surfaces of the panel
//      (terminal, app-ui, mcp-tool), language en and the success sentence of the plan.
//   6. Writes the copy as docs/copy.txt in the consumer and runs `checklist` and
//      `review --file docs/copy.txt` from inside the consumer.
//   7. Records git status of the book AFTER the run. Exit 1 if it differs from BEFORE.
//   8. Writes the evidence (raw output) to the path given with --out, and nowhere else.
//      The line BOOK_STATUS_BEFORE_COUNT=N is the number of status lines before the run.
//
// Usage: node ui/mos-face/scripts/book-review.cjs --out <file> [--book <dir>] [--ref <commit>] [--keep]
// Exit codes: 0 ran and the book is unchanged; 1 the book changed, or a step failed; 77 no CLI or no claude.
// The review itself exits 2 (REVIEW-REQUIRED) on purpose. That is a normal result, not a failure.
// CJS, Node built-ins only. No network. Hyphens only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MOD = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const OUT = opt('--out', '');
const BOOK = opt('--book', '/home/jsagi/mos-brand');
const REF = opt('--ref', 'e947a5d');
const KEEP = args.includes('--keep');

function say(s) { process.stderr.write(s + '\n'); }
function die(code, s) { say(s); process.exit(code); }
function run(cmd, argv, o) {
  const r = spawnSync(cmd, argv, Object.assign({ encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }, o || {}));
  return { status: r.status, out: (r.stdout || '') + (r.stderr ? '\n[stderr]\n' + r.stderr : ''), stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}
function git(argv) { return run('git', ['-C', BOOK, ...argv]); }

if (!OUT) die(1, 'book-review: pass --out <file> (the evidence path).');
const liveCli = path.join(BOOK, 'bin', 'mos-brand.cjs');
if (!fs.existsSync(liveCli)) die(77, 'book-review: the book CLI is missing at ' + liveCli + '. Check out the book and run again.');
if (run('which', ['claude']).status !== 0) die(77, 'book-review: the claude CLI is not on PATH. Install it and run again.');

// ---- 2. the book before ----------------------------------------------------------------------
const headBefore = git(['rev-parse', '--short', 'HEAD']).stdout.trim();
const statusBefore = git(['status', '--short']).stdout.replace(/\s+$/, '');
const statusBeforeLines = statusBefore === '' ? [] : statusBefore.split('\n');
const refFull = git(['rev-parse', '--short', REF + '^{commit}']);
if (refFull.status !== 0) die(1, 'book-review: the ref ' + REF + ' is not in the book repository.');

// ---- 3. the scratch folder -------------------------------------------------------------------
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-face-book-review-'));
const consumer = path.join(scratch, 'consumer');
fs.mkdirSync(path.join(consumer, 'docs'), { recursive: true });
let cli = liveCli;
let cliFrom = 'the live checkout ' + BOOK + ' at ' + headBefore;
if (headBefore !== refFull.stdout.trim()) {
  const exportDir = path.join(scratch, 'book-' + REF);
  fs.mkdirSync(exportDir, { recursive: true });
  const archive = spawnSync('sh', ['-c', 'git -C "$1" archive "$2" | tar -x -C "$3"', 'sh', BOOK, REF, exportDir], { encoding: 'utf8' });
  if (archive.status !== 0) die(1, 'book-review: git archive of ' + REF + ' failed: ' + (archive.stderr || ''));
  cli = path.join(exportDir, 'bin', 'mos-brand.cjs');
  cliFrom = 'an export of ' + REF + ' (git archive, read only) because the live checkout is at ' + headBefore;
}

// ---- 4. the copy dump ------------------------------------------------------------------------
const modCopy = path.join(scratch, 'mod');
const cp = spawnSync('sh', ['-c', 'mkdir -p "$2" && tar -C "$1" --exclude=node_modules --exclude=.claude-plugin/types -cf - . | tar -C "$2" -xf -', 'sh', MOD, modCopy], { encoding: 'utf8' });
if (cp.status !== 0) die(1, 'book-review: could not copy the mod to the scratch folder: ' + (cp.stderr || ''));
const copyTest = path.join(modCopy, 'tests', 'copy.test.tsx');
const copySrc = fs.readFileSync(copyTest, 'utf8');
const HOOK = '// MOS_COPY_DUMP_HOOK';
if (!copySrc.includes(HOOK)) die(1, 'book-review: the dump marker is missing in tests/copy.test.tsx.');
fs.writeFileSync(copyTest, copySrc.replace(HOOK, ';(globalThis as unknown as { MOS_COPY_DUMP?: boolean }).MOS_COPY_DUMP = true'));
const testRun = run('claude', ['plugin', 'test', '.'], { cwd: modCopy, timeout: 600000 });
const dumpLines = [];
{
  let on = false;
  // The engine prints a test's console output on stderr, so read both streams.
  for (const line of (testRun.stdout + '\n' + testRun.stderr).split('\n')) {
    if (line.trim() === 'COPYDUMP_END') on = false;
    if (on) dumpLines.push(line);
    if (line.trim() === 'COPYDUMP_BEGIN') on = true;
  }
}
const testTail = (testRun.stdout + '\n' + testRun.stderr).split('\n').filter((l) => /^\s*\d+ (pass|fail)|^Ran /.test(l)).join('\n');
if (testRun.status !== 0 || dumpLines.length < 100) {
  die(1, 'book-review: the copy tests did not give a dump (exit ' + testRun.status + ', ' + dumpLines.length + ' lines).\n' + testTail);
}

const emptyRooms = path.join(scratch, 'rooms');
fs.mkdirSync(emptyRooms, { recursive: true });
const engineText = run('claude', ['--plugin-dir', modCopy, '-p', '/mos-text'], {
  cwd: scratch,
  timeout: 180000,
  env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: emptyRooms, NO_COLOR: '' }),
});
// A machine path is not copy. Replace the scratch and home folders by words.
const clean = (t) => t.split(scratch).join('SCRATCH').split(os.homedir()).join('HOME');
const mosText = clean(engineText.stdout).trim();

// ---- 5. the scratch consumer -----------------------------------------------------------------
const intake = {
  schemaVersion: 1,
  consumer: { id: 'mos-face-panel', name: 'M:OS face panel mod', kind: 'product', team: 'MindrianOS plugin', project: 'MindrianOS-Plugin phase 380', owner: 'Mindrian project owner' },
  what: { deliverable: 'Claude Code side panel, one-line status, prompt-box buttons and /mos-* commands that show room state, shipped inside the plugin', surfaces: ['terminal', 'app-ui', 'mcp-tool'], languages: ['en'], familyMember: null },
  how: { approach: 'Package the existing mod inside the plugin; rule every visible choice by the book.', workflowFile: 'docs/WORKFLOW.md', steps: [{ phase: 'brief', action: 'State the panel states, copy and surfaces.' }, { phase: 'produce', action: 'Apply segment contracts to the mod.' }, { phase: 'review', action: 'Check on a real terminal at wide, narrow, no-color.' }, { phase: 'return-learning', action: 'File gaps as proposed book entries.' }] },
  why: { purpose: 'Make the room state visible beside the chat without a command.', evidence: 'Phase 380 roadmap goal and owner handoff 2026-10-21.', success: 'Plain English in the teaching voice, Theo named, Larry not named, accessible contrast, no starved prompt.' },
  jtbd: { when: 'I am working in a room in Claude Code', want: 'to see room state, stage and next move beside the chat', so: 'I act without running a command to find out where I am' },
};
// init writes a template at .mindrian/intake.json. configure writes its own normalized copy there
// and refuses to overwrite any other content, so the template is removed after init (it is a
// scratch file) and the completed intake is a separate file at the consumer root.
const intakePath = path.join(consumer, 'intake-source.json');
fs.writeFileSync(intakePath, JSON.stringify(intake, null, 2));
fs.writeFileSync(path.join(consumer, 'docs', 'WORKFLOW.md'), '# Workflow\n\nScratch consumer for the face panel copy review.\n');

const book = (argv, cwd) => run(process.execPath, [cli, ...argv], { cwd: cwd || scratch, timeout: 180000 });
const steps = [];
function step(name, r) { steps.push({ name, status: r.status, out: clean(r.out).trim() }); return r; }
const failedStep = [];
{
  const a = step('init --project', book(['init', '--project', consumer]));
  if (a.status !== 0) failedStep.push('init');
  fs.rmSync(path.join(consumer, '.mindrian', 'intake.json'), { force: true });
  const b = step('configure --intake --project', book(['configure', '--intake', intakePath, '--project', consumer]));
  if (b.status !== 0) failedStep.push('configure');
  const c = step('adopt --apply --project', book(['adopt', '--apply', '--project', consumer]));
  if (c.status !== 0) failedStep.push('adopt');
}

// ---- 6. the review ---------------------------------------------------------------------------
const copyText = [
  '# Copy the face panel draws',
  '',
  'Rendered and registered copy, one line each (tests/copy.test.tsx, the dump of plan 380-07). Every Text and Button of the pane and the band in 7 states, 4 face styles, 4 widths and plain mode, the 13 command descriptions and results, every toast, the glossary, the thoughts, the labels and the why lines.',
  '',
  ...dumpLines.flatMap((l) => [l, '']),
  '## Output of /mos-text on the real engine',
  '',
  ...mosText.split('\n').flatMap((l) => [l, '']),
].join('\n');
fs.writeFileSync(path.join(consumer, 'docs', 'copy.txt'), copyText);
const checklist = step('checklist', book(['checklist'], consumer));
const review = step('review --file docs/copy.txt', book(['review', '--file', 'docs/copy.txt'], consumer));
const doctor = step('doctor', book(['doctor'], consumer));

// ---- 7. the book after -----------------------------------------------------------------------
const headAfter = git(['rev-parse', '--short', 'HEAD']).stdout.trim();
const statusAfter = git(['status', '--short']).stdout.replace(/\s+$/, '');
const unchanged = headAfter === headBefore && statusAfter === statusBefore;

// ---- 8. the evidence -------------------------------------------------------------------------
const fence = (t) => '```\n' + t.replace(/```/g, "'''") + '\n```';
const parts = [];
parts.push('# Raw output of ui/mos-face/scripts/book-review.cjs');
parts.push('');
parts.push('This block is machine output. The verdict and the findings are written by hand around it.');
parts.push('');
parts.push('## Book state');
parts.push('');
parts.push('- Pinned ref: ' + REF + ' (' + refFull.stdout.trim() + ')');
parts.push('- Book HEAD before: ' + headBefore + ', after: ' + headAfter);
parts.push('- The CLI that ran: ' + cliFrom);
parts.push('- Scratch consumer: ' + clean(consumer) + ' (a folder under the system temp folder; ' + (KEEP ? 'kept' : 'removed after the run') + ')');
parts.push('- BOOK_STATUS_BEFORE_COUNT=' + statusBeforeLines.length);
parts.push(fence(statusBefore === '' ? '(no lines)' : statusBefore));
parts.push('- Book status after the run: ' + (statusAfter === statusBefore ? 'identical to before' : 'DIFFERENT'));
parts.push('- Book unchanged: ' + (unchanged ? 'yes' : 'NO'));
parts.push('');
parts.push('## Copy tests (scratch copy of ui/mos-face, dump on)');
parts.push('');
parts.push(fence(testTail));
parts.push('- Lines in the dump: ' + dumpLines.length);
parts.push('- Characters in docs/copy.txt: ' + copyText.length);
parts.push('');
parts.push('## /mos-text on the real engine (empty rooms folder, no room name)');
parts.push('');
parts.push('- exit ' + engineText.status);
parts.push(fence(mosText));
parts.push('');
for (const s of steps) {
  parts.push('## ' + s.name + ' (exit ' + s.status + ')');
  parts.push('');
  parts.push(fence(s.out));
  parts.push('');
}
parts.push('## The copy that was reviewed (docs/copy.txt)');
parts.push('');
parts.push(fence(dumpLines.join('\n')));
parts.push('');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, parts.join('\n'));

if (!KEEP) fs.rmSync(scratch, { recursive: true, force: true });

say('book-review: book HEAD ' + headBefore + ' -> ' + headAfter + '; status lines before ' + statusBeforeLines.length + '; unchanged ' + unchanged + '; dump lines ' + dumpLines.length);
say('book-review: review exit ' + review.status + ' (2 is REVIEW-REQUIRED, expected); checklist exit ' + checklist.status + '; doctor exit ' + doctor.status);
if (failedStep.length) die(1, 'book-review: a step failed: ' + failedStep.join(', '));
if (!unchanged) die(1, 'book-review: THE BOOK CHANGED during the run. Stop and report.');
process.exit(0);
