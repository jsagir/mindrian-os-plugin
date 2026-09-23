/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 03 Task 2 (D-31, D-32, D-33). Dev-time only, never required
 * from lib/ or hooks/.
 *
 * The blind labeling CLI the whole phase uses. A human is the judge; this
 * script only records, and it is built so the judge cannot see what would
 * bias the label: item files carry no labels, the on-screen display is a
 * per-set whitelist of fields (boundary_tag is never one of them, and the
 * unstamped pairing set is never shown stamp_lines), and this file never
 * requires the thinking-mode regex module, the verification stamp module or
 * any dev-time Jev script (the tripwire this file's own test greps for).
 *
 * Subcommands: start / resume / status / emit, over four sets (sentences,
 * citations, pairings-unstamped, pairings-stamped). Keys 1-6 label the five
 * thinking modes plus none; y/n x3 per pairing (useful, direction ok,
 * already known); s/n/c per citation pair (supports / says nothing /
 * contradicts). u undoes the most recent entry; q (and Ctrl+C) saves and
 * quits. The session is saved after every key via a temp-file-then-rename
 * (atomic) write. Raw keypress via readline.emitKeypressEvents + setRawMode
 * when stdin is a TTY, with a line-mode fallback otherwise (WSL raw-mode
 * quirk, Pitfall 12): setRawMode is always restored in a finally / on
 * process 'exit'.
 *
 * The order sentences/citations/pairings are shown in is a seeded shuffle
 * (mulberry32); the seed is stored as order_seed so a resume reconstructs
 * the identical order from the same seed and the same item-id list. The
 * session file is keyed by item id, never by position (D-33).
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline');

const PHASE_DIR_REL = path.join(
  '.planning',
  'phases',
  '355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi',
);

// ---------------------------------------------------------------------------
// mulberry32(seed) -- a small deterministic PRNG. Same seed, same sequence.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, seed) {
  const rand = mulberry32(seed);
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// ---------------------------------------------------------------------------
// resolveAndContain: realpath + path.sep prefix guard (T-355-12). Resolves
// symlinks via realpathSync so an escaping symlink is caught; falls back to
// textual resolution when the target does not exist yet (idiom from
// scripts/eval-icm-writers.cjs's resolveAndContain).
// ---------------------------------------------------------------------------
function resolveAndContain(candidate, allowedRoots) {
  const resolved = path.resolve(candidate);
  let real;
  try {
    real = fs.realpathSync(resolved);
  } catch (_e) {
    real = resolved;
  }
  for (let i = 0; i < allowedRoots.length; i += 1) {
    const rootRaw = allowedRoots[i];
    let root;
    try {
      root = fs.realpathSync(rootRaw);
    } catch (_e) {
      root = path.resolve(rootRaw);
    }
    const prefixWithSep = root + path.sep;
    if (real === root || real.indexOf(prefixWithSep) === 0) {
      return real;
    }
  }
  return null;
}

function saveSessionAtomic(sessionPath, session) {
  const dir = path.dirname(sessionPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = sessionPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(session, null, 2));
  fs.renameSync(tmpPath, sessionPath);
}

// ---------------------------------------------------------------------------
// LEGENDS: the fixed on-screen legend per set, shown once at session start.
// ---------------------------------------------------------------------------
const LEGENDS = Object.freeze({
  sentences: '1 analytical  2 integrative  3 descriptive  4 evaluative  5 creative  6 none   u undo   q save+quit',
  citations: 's supports  n says nothing  c contradicts   u undo   q save+quit',
  'pairings-unstamped': 'y/n useful?  y/n direction ok?  y/n already known?   u undo   q save+quit',
  'pairings-stamped': 'y/n useful?  y/n direction ok?  y/n already known?   u undo   q save+quit',
});

// ---------------------------------------------------------------------------
// SETS: per-set defaults. displayFields is the whitelist rendered on screen
// (boundary_tag is never in any list; stamp_lines only for pairings-stamped).
// ---------------------------------------------------------------------------
const SETS = Object.freeze({
  sentences: Object.freeze({
    itemsDefault: path.join('tests', 'fixtures', '355-hsi-thinking-mode-sentences.items.json'),
    outDefault: path.join('tests', 'fixtures', '355-hsi-thinking-mode-sentences.json'),
    kind: 'keyed',
    keys: Object.freeze({ 1: 'analytical', 2: 'integrative', 3: 'descriptive', 4: 'evaluative', 5: 'creative', 6: 'none' }),
    displayFields: Object.freeze(['sentence']),
    requiresPhrase: false,
    legend: LEGENDS.sentences,
  }),
  citations: Object.freeze({
    itemsDefault: path.join('tests', 'fixtures', '355-citation-pairs.items.json'),
    outDefault: path.join('tests', 'fixtures', '355-citation-pairs.json'),
    kind: 'keyed',
    keys: Object.freeze({ s: 'supports', n: 'says_nothing', c: 'contradicts' }),
    displayFields: Object.freeze(['claim', 'path']),
    requiresPhrase: true,
    legend: LEGENDS.citations,
  }),
  'pairings-unstamped': Object.freeze({
    itemsDefault: path.join('tests', 'fixtures', '355-rooms', 'pairings.items.json'),
    outDefault: path.join('tests', 'fixtures', '355-rooms', 'judgments.json'),
    kind: 'triple',
    displayFields: Object.freeze(['room', 'a_excerpt', 'b_excerpt', 'direction_phrase']),
    requiresPhrase: true,
    legend: LEGENDS['pairings-unstamped'],
  }),
  'pairings-stamped': Object.freeze({
    itemsDefault: path.join('tests', 'fixtures', '355-rooms', 'pairings-stamped.items.json'),
    outDefault: path.join('tests', 'fixtures', '355-rooms', 'judgments-stamped.json'),
    kind: 'triple',
    displayFields: Object.freeze(['room', 'a_excerpt', 'b_excerpt', 'direction_phrase', 'stamp_lines']),
    requiresPhrase: true,
    legend: LEGENDS['pairings-stamped'],
  }),
});

const TRIPLE_FIELDS = ['useful', 'direction_ok', 'already_known'];

function promptFor(field) {
  if (field === 'useful') return 'useful? (y/n)';
  if (field === 'direction_ok') return 'direction ok? (y/n)';
  if (field === 'already_known') return 'already known? (y/n)';
  return field + '? (y/n)';
}

function parseArgv(argv) {
  const list = argv || [];
  const cmd = list[0];
  const flags = {};
  for (let i = 1; i < list.length; i += 1) {
    const tok = list[i];
    if (tok && tok.indexOf('--') === 0) {
      const key = tok.slice(2);
      const val = list[i + 1];
      flags[key] = val;
      i += 1;
    }
  }
  return { cmd, flags };
}

function renderItem(setDef, item) {
  const lines = [];
  for (let i = 0; i < setDef.displayFields.length; i += 1) {
    const field = setDef.displayFields[i];
    if (field === 'path') {
      if (Array.isArray(item.path)) {
        for (let h = 0; h < item.path.length; h += 1) {
          const hop = item.path[h];
          lines.push(h + 1 + '. ' + hop.from + ' -' + hop.relation + '-> ' + hop.to);
        }
      }
    } else if (item[field] !== undefined && item[field] !== null) {
      lines.push(String(item[field]));
    }
  }
  return lines.join('\n');
}

function loadDirectionModule(opts) {
  if (opts.direction) return opts.direction;
  // eslint-disable-next-line global-require, import/no-dynamic-require
  return require(path.join(__dirname, '..', 'lib', 'core', 'direction-convention.cjs'));
}

function usageText() {
  return [
    'label-355-gold.cjs -- blind labeling CLI (D-31, D-32, D-33)',
    'Usage:',
    '  node scripts/label-355-gold.cjs start   --set <set> [--items <p>] [--session-dir <d>] [--seed <n>]',
    '  node scripts/label-355-gold.cjs resume  --set <set> [--items <p>] [--session-dir <d>]',
    '  node scripts/label-355-gold.cjs status  --set <set> [--items <p>] [--session-dir <d>]',
    '  node scripts/label-355-gold.cjs emit    --set <set> [--items <p>] [--session-dir <d>] [--out <p>]',
    'Sets: sentences, citations, pairings-unstamped, pairings-stamped',
    '',
  ].join('\n');
}

function loadItems(itemsPath) {
  const raw = fs.readFileSync(itemsPath, 'utf8');
  const json = JSON.parse(raw);
  const items = json.items;
  if (!Array.isArray(items)) {
    throw new Error('items file has no items array: ' + itemsPath);
  }
  return { raw, items };
}

function sessionDirFor({ setDef, flags, root }) {
  const sessionDirRaw = flags['session-dir'] || path.join(root, PHASE_DIR_REL);
  return resolveAndContain(sessionDirRaw, [path.join(root, PHASE_DIR_REL), os.tmpdir()]);
}

function sessionPathFor(setId, sessionDirReal) {
  return path.join(sessionDirReal, 'labeling-session-' + setId + '.json');
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------
function doStatus({ setId, setDef, flags, write, root }) {
  const itemsPath = flags.items ? path.resolve(flags.items) : path.join(root, setDef.itemsDefault);
  let items;
  try {
    items = loadItems(itemsPath).items;
  } catch (_e) {
    write('label-355-gold: cannot read items file ' + itemsPath + '\n');
    return 1;
  }
  const total = items.length;

  const sessionDirReal = sessionDirFor({ setDef, flags, root });
  let labeled = 0;
  if (sessionDirReal) {
    const sessionPath = sessionPathFor(setId, sessionDirReal);
    try {
      const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      labeled = Object.keys(session.entries || {}).length;
    } catch (_e) {
      labeled = 0;
    }
  }
  write(labeled + '/' + total + ' labeled\n');
  return 0;
}

// ---------------------------------------------------------------------------
// emit
// ---------------------------------------------------------------------------
function doEmit({ setId, setDef, flags, write, root, now }) {
  const itemsPath = flags.items ? path.resolve(flags.items) : path.join(root, setDef.itemsDefault);
  let raw;
  let items;
  try {
    const loaded = loadItems(itemsPath);
    raw = loaded.raw;
    items = loaded.items;
  } catch (_e) {
    write('label-355-gold: cannot read items file ' + itemsPath + '\n');
    return 1;
  }
  const fixtureSha256 = sha256Hex(raw);

  const sessionDirReal = sessionDirFor({ setDef, flags, root });
  if (!sessionDirReal) {
    write('label-355-gold: refused -- --session-dir escapes the allowed roots\n');
    return 1;
  }
  const sessionPath = sessionPathFor(setId, sessionDirReal);
  let session;
  try {
    session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  } catch (_e) {
    write('label-355-gold: no session found at ' + sessionPath + '\n');
    return 1;
  }
  if (session.fixture_sha256 !== fixtureSha256) {
    write('label-355-gold: refused -- fixture_sha256 mismatch (items file changed since this session started)\n');
    return 1;
  }

  const missing = items.filter((it) => !session.entries[it.id]);
  if (missing.length > 0) {
    write('label-355-gold: refused -- ' + missing.length + ' item(s) not yet labeled\n');
    return 1;
  }

  const outRaw = flags.out ? path.resolve(flags.out) : path.join(root, setDef.outDefault);
  const outReal = resolveAndContain(outRaw, [path.join(root, 'tests', 'fixtures'), os.tmpdir()]);
  if (!outReal) {
    write('label-355-gold: refused -- --out escapes the allowed roots\n');
    return 1;
  }

  const labeledAt = new Date(now()).toISOString();
  let payload;
  if (setDef.kind === 'triple') {
    payload = {
      _labeling_note: 'Navigator blind gold, Phase 355 (' + setId + ').',
      labeler: 'navigator',
      fixture_sha256: fixtureSha256,
      labeled_at: labeledAt,
      items: items.map((it) => {
        const e = session.entries[it.id];
        return {
          pair_id: it.id,
          useful: e.useful,
          direction_ok: e.direction_ok,
          already_known: e.already_known,
          at: e.at,
        };
      }),
    };
  } else {
    payload = {
      _labeling_note: 'Navigator blind gold, Phase 355 (' + setId + ').',
      labeler: 'navigator',
      fixture_sha256: fixtureSha256,
      labeled_at: labeledAt,
      items: items.map((it) => {
        const out = { id: it.id };
        for (let i = 0; i < setDef.displayFields.length; i += 1) {
          const field = setDef.displayFields[i];
          if (it[field] !== undefined) out[field] = it[field];
        }
        out.gold = session.entries[it.id].label;
        return out;
      }),
    };
  }

  const dir = path.dirname(outReal);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = outReal + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
  fs.renameSync(tmpPath, outReal);
  write('label-355-gold: wrote ' + outReal + '\n');
  return 0;
}

// ---------------------------------------------------------------------------
// start / resume (interactive session)
// ---------------------------------------------------------------------------
function doSession({ mode, setId, setDef, flags, input, output, write, now, root, direction }) {
  return new Promise((resolve) => {
    const itemsPath = flags.items ? path.resolve(flags.items) : path.join(root, setDef.itemsDefault);
    let raw;
    let items;
    try {
      const loaded = loadItems(itemsPath);
      raw = loaded.raw;
      items = loaded.items;
    } catch (_e) {
      write('label-355-gold: cannot read items file ' + itemsPath + '\n');
      resolve(1);
      return;
    }
    const fixtureSha256 = sha256Hex(raw);

    if (setDef.requiresPhrase) {
      const confirmed = direction && direction.PHRASES_CONFIRMED;
      const currentHash = direction && typeof direction.phraseHash === 'function' ? direction.phraseHash() : null;
      if (!confirmed || !confirmed.phrase_hash || confirmed.phrase_hash !== currentHash) {
        write('label-355-gold: refused -- PHRASES_CONFIRMED is missing or stale for set "' + setId + '" (run 355-02 first)\n');
        resolve(1);
        return;
      }
    }

    const sessionDirReal = sessionDirFor({ setDef, flags, root });
    if (!sessionDirReal) {
      write('label-355-gold: refused -- --session-dir escapes the allowed roots\n');
      resolve(1);
      return;
    }
    const sessionPath = sessionPathFor(setId, sessionDirReal);

    const itemById = new Map();
    const ids = [];
    for (let i = 0; i < items.length; i += 1) {
      itemById.set(items[i].id, items[i]);
      ids.push(items[i].id);
    }

    let session;
    if (mode === 'resume') {
      let sessionRaw;
      try {
        sessionRaw = fs.readFileSync(sessionPath, 'utf8');
      } catch (_e) {
        write('label-355-gold: no session to resume at ' + sessionPath + '\n');
        resolve(1);
        return;
      }
      try {
        session = JSON.parse(sessionRaw);
      } catch (_e) {
        write('label-355-gold: session file is corrupt at ' + sessionPath + '\n');
        resolve(1);
        return;
      }
      if (session.fixture_sha256 !== fixtureSha256) {
        write('label-355-gold: refused -- fixture_sha256 mismatch (items file changed since this session started)\n');
        resolve(1);
        return;
      }
      if (setDef.requiresPhrase) {
        const currentHash = direction && typeof direction.phraseHash === 'function' ? direction.phraseHash() : null;
        if (session.phrase_module_hash !== currentHash) {
          write('label-355-gold: refused -- phrase_module_hash mismatch (direction phrases changed since this session started)\n');
          resolve(1);
          return;
        }
      }
    } else {
      const seedFlag = flags.seed !== undefined ? Number(flags.seed) : NaN;
      const seed = Number.isFinite(seedFlag) ? seedFlag : (Math.floor(now()) % 2147483647) || 1;
      session = {
        set: setId,
        fixture_sha256: fixtureSha256,
        order_seed: seed,
        phrase_module_hash: setDef.requiresPhrase && direction && typeof direction.phraseHash === 'function' ? direction.phraseHash() : null,
        started_at: new Date(now()).toISOString(),
        entries: {},
      };
      saveSessionAtomic(sessionPath, session);
    }

    const order = shuffle(ids, session.order_seed);

    write(setDef.legend + '\n');

    let currentId = null;
    let itemShownAt = now();
    let pending = {};
    let closeInput = () => {};

    function nextUnlabeledId() {
      for (let i = 0; i < order.length; i += 1) {
        if (!session.entries[order[i]]) return order[i];
      }
      return null;
    }

    function finish(code) {
      closeInput();
      resolve(code);
    }

    function showCurrent() {
      if (currentId === null) {
        write('All items labeled. Run `node scripts/label-355-gold.cjs emit --set ' + setId + '` to write the gold file.\n');
        finish(0);
        return;
      }
      const item = itemById.get(currentId);
      write(renderItem(setDef, item) + '\n');
      itemShownAt = now();
      pending = {};
      if (setDef.kind === 'triple') {
        write(promptFor(TRIPLE_FIELDS[0]) + '\n');
      }
    }

    function recordEntry(entryValue) {
      session.entries[currentId] = Object.assign({}, entryValue, {
        at: new Date(now()).toISOString(),
        ms: now() - itemShownAt,
      });
      saveSessionAtomic(sessionPath, session);
      currentId = nextUnlabeledId();
      showCurrent();
    }

    function undo() {
      const keys = Object.keys(session.entries);
      if (keys.length === 0) return;
      const lastId = keys[keys.length - 1];
      delete session.entries[lastId];
      saveSessionAtomic(sessionPath, session);
      currentId = lastId;
      showCurrent();
    }

    function saveAndQuit() {
      saveSessionAtomic(sessionPath, session);
      finish(0);
    }

    function handleToken(tokenRaw) {
      const token = String(tokenRaw == null ? '' : tokenRaw).trim().toLowerCase();
      if (token === '') return;
      if (token === 'q') {
        saveAndQuit();
        return;
      }
      if (token === 'u') {
        undo();
        return;
      }
      if (currentId === null) return;

      if (setDef.kind === 'keyed') {
        const label = setDef.keys[token];
        if (!label) return;
        recordEntry({ label: label });
        return;
      }

      if (setDef.kind === 'triple') {
        if (token !== 'y' && token !== 'n') return;
        const val = token === 'y';
        const nextField = TRIPLE_FIELDS.find((f) => !(f in pending));
        if (!nextField) return;
        pending[nextField] = val;
        const remaining = TRIPLE_FIELDS.find((f) => !(f in pending));
        if (!remaining) {
          recordEntry(pending);
        } else {
          write(promptFor(remaining) + '\n');
        }
      }
    }

    currentId = nextUnlabeledId();

    const useRaw = !!(input && input.isTTY && typeof input.setRawMode === 'function');
    if (useRaw) {
      readline.emitKeypressEvents(input);
      input.setRawMode(true);
      const restore = () => {
        try {
          input.setRawMode(false);
        } catch (_e) {
          // best-effort restore only
        }
      };
      const onExit = () => restore();
      process.on('exit', onExit);
      const keyHandler = (str, key) => {
        if (key && key.ctrl && key.name === 'c') {
          saveAndQuit();
          return;
        }
        const name = (key && key.name) || str;
        handleToken(name);
      };
      input.on('keypress', keyHandler);
      closeInput = () => {
        restore();
        input.removeListener('keypress', keyHandler);
        process.removeListener('exit', onExit);
      };
    } else {
      const rl = readline.createInterface({ input });
      const lineHandler = (line) => handleToken(line);
      rl.on('line', lineHandler);
      closeInput = () => {
        rl.close();
      };
    }

    showCurrent();
  });
}

// ---------------------------------------------------------------------------
// run({argv, input, output, now, repoRoot, direction}) -- the single entry
// point, driven directly by tests (PassThrough input) and by the CLI main
// block below (process.stdin/stdout).
// ---------------------------------------------------------------------------
async function run(opts) {
  const argv = opts.argv || [];
  const output = opts.output;
  const write = (s) => {
    output.write(s);
  };
  const nowFn = typeof opts.now === 'function' ? opts.now : () => Date.now();
  const root = opts.repoRoot || path.join(__dirname, '..');

  const { cmd, flags } = parseArgv(argv);

  if (!cmd || flags.help) {
    write(usageText());
    return 0;
  }

  const setId = flags.set;
  if (!setId || !SETS[setId]) {
    write('label-355-gold: unknown or missing --set "' + setId + '"\n');
    return 1;
  }
  const setDef = SETS[setId];

  if (cmd === 'status') {
    return doStatus({ setId, setDef, flags, write, root });
  }
  if (cmd === 'emit') {
    return doEmit({ setId, setDef, flags, write, root, now: nowFn });
  }
  if (cmd === 'start' || cmd === 'resume') {
    const direction = loadDirectionModule(opts);
    return doSession({
      mode: cmd,
      setId,
      setDef,
      flags,
      input: opts.input,
      output,
      write,
      now: nowFn,
      root,
      direction,
    });
  }

  write('label-355-gold: unknown command "' + cmd + '"\n');
  return 1;
}

module.exports = { run, SETS, LEGENDS, mulberry32 };

if (require.main === module) {
  const opts = {
    argv: process.argv.slice(2),
    input: process.stdin,
    output: process.stdout,
    now: () => Date.now(),
    repoRoot: path.join(__dirname, '..'),
  };
  Promise.resolve(run(opts))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      process.stderr.write('label-355-gold: ' + (err && err.stack ? err.stack : err) + '\n');
      process.exitCode = 1;
    });
}
