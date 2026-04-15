#!/usr/bin/env node
/**
 * MindrianOS Plugin -- Vault Export Orchestrator
 *
 * Master pipeline that turns any Data Room into a complete Obsidian-ready
 * vault in one command. Covers VAULT-01..06.
 *
 * 1. Resolve room path (explicit arg, named room, or active room)
 * 2. Resolve target path (default, --path, or --in-place)
 * 3. Copy source -> target with skip filter + symlink resolution (unless in-place)
 * 4. Run 7 Phase 76/77 vault-* scripts in sequence
 * 5. Drop references/vault-kit/ -> target/.obsidian/
 * 6. Print final summary
 *
 * Usage:
 *   node scripts/vault-export-orchestrator.cjs                           (active room)
 *   node scripts/vault-export-orchestrator.cjs <room>                    (path or name)
 *   node scripts/vault-export-orchestrator.cjs <room> --path <target>    (override target)
 *   node scripts/vault-export-orchestrator.cjs --in-place                (linkify active)
 *   node scripts/vault-export-orchestrator.cjs <room> --in-place         (linkify named)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const scriptFor = (name) => path.join(PLUGIN_ROOT, 'scripts', name);

const USE_COLOR = !process.env.NO_COLOR && process.stdout.isTTY;
const C_CYAN = USE_COLOR ? '\x1b[36m' : '';
const C_RED = USE_COLOR ? '\x1b[31m' : '';
const C_RESET = USE_COLOR ? '\x1b[0m' : '';

const USAGE = `
vault-export-orchestrator -- export any Data Room as an Obsidian vault

Usage:
  node scripts/vault-export-orchestrator.cjs                       Use active room (via scripts/resolve-room)
  node scripts/vault-export-orchestrator.cjs <room>                Named room under ~/MindrianRooms/ or path
  node scripts/vault-export-orchestrator.cjs <room> --path <dir>   Override target parent dir
  node scripts/vault-export-orchestrator.cjs --in-place            Linkify active room in place
  node scripts/vault-export-orchestrator.cjs <room> --in-place     Linkify named room in place

Flags:
  --path <dir>       Override target parent dir (default: ~/MindrianRooms-Vaults/)
  --in-place         Skip copy step; operate on source room directly
  --mode <value>     Export mode: vault (default, Obsidian-only, excludes .mindrian/)
                     or transplant (full room bridge, includes .mindrian/ so room.db
                     travels with the room between machines)
  --source <dir>     Explicit source path (advanced; bypasses room resolution)
  --target <dir>     Explicit target path (advanced; bypasses default target layout)
  --copy-only        Stop after the copy step; skip pipeline + vault-kit (test hook)
  --help, -h         Show this help
`;

// ---------- Argument parsing ----------

function parseArgs(argv) {
  const args = { room: null, targetParent: null, inPlace: false, help: false, mode: 'vault', source: null, target: null, copyOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      args.help = true;
    } else if (a === '--in-place') {
      args.inPlace = true;
    } else if (a === '--path') {
      args.targetParent = argv[++i];
    } else if (a === '--mode') {
      args.mode = argv[++i];
    } else if (a.startsWith('--mode=')) {
      args.mode = a.slice('--mode='.length);
    } else if (a === '--source') {
      args.source = argv[++i];
    } else if (a.startsWith('--source=')) {
      args.source = a.slice('--source='.length);
    } else if (a === '--target') {
      args.target = argv[++i];
    } else if (a.startsWith('--target=')) {
      args.target = a.slice('--target='.length);
    } else if (a === '--copy-only') {
      args.copyOnly = true;
    } else if (!a.startsWith('--') && args.room == null) {
      args.room = a;
    }
  }
  if (args.mode !== 'vault' && args.mode !== 'transplant') {
    errorExit([
      'x invalid --mode: ' + args.mode + '. expected: vault | transplant',
    ]);
  }
  return args;
}

// ---------- Path helpers ----------

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function looksLikePath(s) {
  return s.startsWith('/') || s.startsWith('~') || s.startsWith('./') || s.startsWith('../');
}

function errorExit(lines) {
  for (const ln of lines) process.stderr.write(ln + '\n');
  process.exit(1);
}

// ---------- Room resolution (VAULT-06) ----------

function resolveRoomPath(arg) {
  let source;
  if (!arg) {
    try {
      const out = execFileSync('bash', [path.join(PLUGIN_ROOT, 'scripts', 'resolve-room')], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      source = out.trim().split('\n').pop().trim();
    } catch (err) {
      errorExit([
        'x No Data Room found',
        '  Why: scripts/resolve-room did not return an active room',
        '  Fix: Pass an explicit room path or run from a project with an active room',
      ]);
    }
  } else if (looksLikePath(arg)) {
    source = path.resolve(expandHome(arg));
  } else {
    // Named room
    const named = path.join(os.homedir(), 'MindrianRooms', arg);
    if (fs.existsSync(named)) {
      source = named;
    } else if (arg === 'room' && fs.existsSync(path.resolve('room'))) {
      source = path.resolve('room');
    } else {
      source = named; // will fail sanity below
    }
  }

  if (!source || !fs.existsSync(source)) {
    errorExit([
      'x No Data Room found',
      `  Why: Path ${source || '(empty)'} does not exist`,
      '  Fix: Pass a valid room path or run from a project with an active room',
    ]);
  }

  const hasRoom = fs.existsSync(path.join(source, 'ROOM.md'));
  const hasState = fs.existsSync(path.join(source, 'STATE.md'));
  if (!hasRoom && !hasState) {
    errorExit([
      'x No Data Room found',
      `  Why: Path ${source} does not contain ROOM.md or STATE.md`,
      '  Fix: Pass a valid room path or run from a project with an active room',
    ]);
  }

  return source;
}

// ---------- Target resolution (VAULT-02) ----------

function resolveTargetPath(sourcePath, flagPath, inPlace) {
  if (inPlace) return sourcePath;
  const base = path.basename(sourcePath);
  if (flagPath) {
    return path.join(path.resolve(expandHome(flagPath)), base);
  }
  return path.join(os.homedir(), 'MindrianRooms-Vaults', base);
}

// ---------- Copy step (VAULT-03, VAULT-04, VAULT-05) ----------

// Vault mode: Obsidian-only export. Excludes .mindrian/ (room.db, memory, proactive-intelligence).
const SKIP_PATTERNS_VAULT = [
  '.lazygraph',
  '.context',
  '.mindrian',
  'node_modules',
  '.git',
  '.obsidian',
];

// Transplant mode: full room bridge. Includes .mindrian/ so room.db travels with the room.
// As of v1.10.9 node:sqlite is platform-agnostic so .mindrian/room.db works on any supported OS.
const SKIP_PATTERNS_TRANSPLANT = [
  '.lazygraph',
  '.context',
  'node_modules',
  '.git',
  '.obsidian',
];

let SKIP_PATTERNS = SKIP_PATTERNS_VAULT;

function hasRsync() {
  try {
    execFileSync('rsync', ['--version'], { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

function copyWithRsync(sourcePath, targetPath) {
  const excludes = [];
  for (const p of SKIP_PATTERNS) {
    excludes.push('--exclude=' + p);
    excludes.push('--exclude=' + p + '/**');
  }
  excludes.push('--exclude=*.lock');
  excludes.push('--exclude=.DS_Store');
  const args = ['-a', '--copy-links', '--delete', ...excludes, sourcePath + '/', targetPath + '/'];
  execFileSync('rsync', args, { stdio: 'inherit' });
}

function copyWithFs(sourcePath, targetPath) {
  const skipNames = new Set([...SKIP_PATTERNS, '.DS_Store']);
  const filter = (src) => {
    const base = path.basename(src);
    if (skipNames.has(base)) return false;
    if (base.endsWith('.lock')) return false;
    return true;
  };
  fs.cpSync(sourcePath, targetPath, { recursive: true, dereference: true, filter });
}

function doCopy(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    if (hasRsync()) {
      copyWithRsync(sourcePath, targetPath);
      return 'rsync';
    }
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      // rsync exists but failed for some other reason -- propagate
      throw err;
    }
  }
  copyWithFs(sourcePath, targetPath);
  return 'fs.cpSync';
}

// ---------- Pipeline runner ----------

function cyan(s) { return C_CYAN + s + C_RESET; }
function red(s) { return C_RED + s + C_RESET; }

function runStep(label, scriptPath, target) {
  process.stdout.write(cyan('[vault] >>> ' + label) + '\n');
  try {
    execFileSync(process.execPath, [scriptPath, target], { stdio: 'inherit' });
  } catch (err) {
    process.stderr.write(red('[vault] xxx ' + label + ' FAILED') + '\n');
    throw err;
  }
}

const PIPELINE = [
  ['Content reformatter (callouts, claim titles, nested folders)', 'vault-content-reformatter.cjs'],
  ['Wikilink injector (team, filed-to, sections, sub-rooms)', 'vault-wikilink-injector.cjs'],
  ['Footer injector (MindrianOS branded footers)', 'vault-footer-injector.cjs'],
  ['Section STATE.md generator', 'vault-section-state-generator.cjs'],
  ['Section MINTO.md generator', 'vault-section-minto-generator.cjs'],
  ['Welcome doc generator', 'vault-welcome-generator.cjs'],
  ['VAULT-RULES.md design system doc', 'vault-rules-generator.cjs'],
];

// ---------- Vault-kit drop ----------

function dropVaultKit(target) {
  const src = path.join(PLUGIN_ROOT, 'references', 'vault-kit');
  const dest = path.join(target, '.obsidian');
  if (!fs.existsSync(src)) {
    process.stderr.write(red('[vault] xxx vault-kit source missing: ' + src) + '\n');
    return;
  }
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (s) => !s.endsWith(path.sep + 'README.md') && !s.endsWith('/README.md'),
  });
  process.stdout.write(cyan('[vault] >>> Dropped .obsidian/ config (De Stijl CSS, graph.json, templates)') + '\n');
}

// ---------- File count ----------

function countMarkdown(target) {
  try {
    const out = execFileSync('find', [target, '-name', '*.md', '-type', 'f'], { encoding: 'utf8' });
    return out.split('\n').filter(Boolean).length;
  } catch (_) {
    // Fallback: walk manually
    let n = 0;
    const walk = (d) => {
      let entries;
      try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.isFile() && e.name.endsWith('.md')) n++;
      }
    };
    walk(target);
    return n;
  }
}

// ---------- Summary ----------

function printSummary({ mode, sourcePath, targetPath, fileCount }) {
  const line = '[vault] ' + '='.repeat(43);
  const lines = [
    '',
    line,
    '[vault] Vault export complete',
    '[vault]',
    '[vault]   Mode:     ' + mode,
    '[vault]   Source:   ' + sourcePath,
    '[vault]   Target:   ' + targetPath,
    '[vault]   Files:    ' + fileCount + ' markdown files',
    '[vault]   Kit:      .obsidian/ dropped (De Stijl)',
    '[vault]',
    '[vault]   Open in Obsidian: File > Open vault > ' + targetPath,
    line,
    '',
  ];
  for (const ln of lines) process.stdout.write(ln + '\n');
}

// ---------- Main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  // Select exclusion list based on export mode (vault | transplant).
  SKIP_PATTERNS = args.mode === 'transplant' ? SKIP_PATTERNS_TRANSPLANT : SKIP_PATTERNS_VAULT;
  process.stdout.write(cyan('[vault-export] mode=' + args.mode) + '\n');

  let sourcePath;
  if (args.source) {
    sourcePath = path.resolve(expandHome(args.source));
    if (!fs.existsSync(sourcePath)) {
      errorExit(['x --source path does not exist: ' + sourcePath]);
    }
  } else {
    sourcePath = resolveRoomPath(args.room);
  }
  const targetPath = args.target
    ? path.resolve(expandHome(args.target))
    : resolveTargetPath(sourcePath, args.targetParent, args.inPlace);
  const mode = args.inPlace ? 'in-place' : 'export';

  process.stdout.write(cyan('[vault] >>> Source: ' + sourcePath) + '\n');
  process.stdout.write(cyan('[vault] >>> Target: ' + targetPath) + '\n');
  process.stdout.write(cyan('[vault] >>> Mode:   ' + mode + ' (' + args.mode + ')') + '\n');

  if (args.inPlace) {
    process.stderr.write('[WARN] In-place mode: modifying files in ' + sourcePath + ' directly\n');
  } else {
    process.stdout.write(cyan('[vault] >>> Copying room (skip filter + symlink resolution)') + '\n');
    const method = doCopy(sourcePath, targetPath);
    process.stdout.write(cyan('[vault] >>> Copy complete (' + method + ')') + '\n');
  }

  if (args.copyOnly) {
    process.stdout.write(cyan('[vault] >>> --copy-only: skipping pipeline + vault-kit') + '\n');
    return;
  }

  for (const [label, script] of PIPELINE) {
    runStep(label, scriptFor(script), targetPath);
  }

  dropVaultKit(targetPath);

  const fileCount = countMarkdown(targetPath);
  printSummary({ mode, sourcePath, targetPath, fileCount });
}

(async () => {
  try {
    await main();
  } catch (err) {
    process.stderr.write(red('[vault] xxx ' + (err && err.message ? err.message : String(err))) + '\n');
    process.exit(1);
  }
})();
