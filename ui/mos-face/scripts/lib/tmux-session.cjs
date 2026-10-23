// 380-03: the tmux session helper of the real-terminal capture harness.
//
// Source: adapted from ui/mindrian-workspace-mod/scripts/render-check.cjs (preflight, makeTmux,
// trustDialogState, the trust answer loop, the env list, scrub) and lib/slash-safe.cjs (the safe slash
// submit). Copied, not required: this package stays walled.
//
// What it does: a private tmux server (its own socket) holds a real pseudo-terminal. The session
// types only an allow-listed one-line /mos-* slash command or a fixed set of keys; it never submits a
// model prompt. The claude child runs in a scratch config folder, so no user plugin, status line,
// onboarding screen or trust dialog appears and nothing is written by hand into the real ~/.claude.
//
// Build tooling (CJS, node built-ins only). Not the mod's runtime source. Hyphens only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const P = require('./ansi-page.cjs');

class EnvGap extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

// ---- the slash allow-list (T-380-08) ----------------------------------------------------------

// The registered commands of the mod that read or change only the panel itself. /mos-ask is left out
// (it puts a question in the prompt box) and /mos-advice is left out (it asks Theo now).
const ALLOWED_SLASH = [
  '/mos-state', '/mos-face', '/mos-style', '/mos-chip', '/mos-suggest', '/mos-refresh',
  '/mos-plain', '/mos-text', '/mos-words', '/mos-auto', '/theo-calls',
];

function isAllowedSlash(text) {
  return typeof text === 'string' && ALLOWED_SLASH.indexOf(text) !== -1;
}

function assertAllowedSlash(text) {
  if (!isAllowedSlash(text)) throw new Error('refused: ' + JSON.stringify(text) + ' is not allow-listed; the harness sends only a registered /mos-* command and never a prompt');
  return text;
}

// The only key names the session may send. Enter is guarded by the callers (the trust loop and the
// slash submit read the screen first).
const ALLOWED_KEYS = ['Enter', 'Down', 'Up', 'C-u'];

// ---- environment -----------------------------------------------------------------------------

// Names removed from the child so a nested or colored parent cannot change what the capture shows.
// TMUX and TMUX_PANE: measured 2026-10-23 (claude 2.1.309), claude rounds every color to the 256 palette
// when TMUX is set, even with COLORTERM=truecolor, and draws 24-bit color when TMUX is unset. The person's
// own terminal is not tmux, so the capture hides tmux from the child.
const UNSET_NAMES = ['NO_COLOR', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_ACTIVE_ROOM', 'TMUX', 'TMUX_PANE'];
// Not secret, so they ride on the env prefix of the child command: where claude keeps its login.
const PASS_PLAIN = ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'XDG_RUNTIME_DIR'];
// Secrets travel only through the tmux server's own environment (never a command line) and are scrubbed
// from every file the harness writes.
const SECRET_NAMES = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
const EXIT_RE = /CLAUDE_EXIT=(\d+)/;
const LINGER_SEC = 6;

// buildChildEnv({ base, scenarioEnv, configDir, roomsHome, homeDir }): { set, unset, names }.
//   set     name to value, passed on the env prefix of the child command
//   unset   names removed from the child (the five names, unless a scenario sets one)
function buildChildEnv(opts) {
  const base = opts.base || {};
  const scenario = {};
  for (const e of opts.scenarioEnv || []) {
    const i = String(e).indexOf('=');
    if (i > 0) scenario[e.slice(0, i)] = e.slice(i + 1);
  }
  const set = {};
  for (const n of PASS_PLAIN) if (typeof base[n] === 'string' && base[n] !== '') set[n] = base[n];
  // A scratch capture also gets a scratch HOME, so the mod can never read the person's real rooms home
  // (the mod reads HOME/MindrianRooms). The login rides on the symlink in the scratch config folder.
  if (opts.homeDir) set.HOME = opts.homeDir;
  if (opts.configDir) set.CLAUDE_CONFIG_DIR = opts.configDir;
  if (opts.roomsHome) set.MINDRIAN_ROOMS_HOME = opts.roomsHome;
  set.COLORTERM = 'truecolor';
  for (const k of Object.keys(scenario)) set[k] = scenario[k];
  // Root cause (measured 2026-10-23): a harness started from inside a Claude Code session inherits
  // CLAUDE_CODE_CHILD_SESSION and other session markers; the child then prints "Transcript saving is
  // off" in every screenshot. So every inherited CLAUDE_*, CLAUDECODE and MINDRIAN_* name is removed
  // too, except the secrets and the names this builder sets itself.
  const keep = new Set(SECRET_NAMES.concat(Object.keys(set)));
  const inherited = Object.keys(base).filter((n) => /^(CLAUDE_|CLAUDECODE|MINDRIAN_)/.test(n) && !keep.has(n));
  const unset = Array.from(new Set(UNSET_NAMES.concat(inherited))).filter((n) => scenario[n] === undefined && !keep.has(n));
  return { set, unset, names: Object.keys(set).sort() };
}

// The `env -u A -u B NAME='v'` prefix of the child command.
function envPrefix(childEnv) {
  const parts = ['env'];
  for (const u of childEnv.unset) parts.push('-u', u);
  for (const k of Object.keys(childEnv.set)) parts.push(k + '=' + shq(childEnv.set[k]));
  return parts.join(' ');
}

function secretValues(env) {
  return SECRET_NAMES.map((n) => (env || {})[n]).filter((v) => typeof v === 'string' && v.length >= 8);
}

// scrubWith(secrets, home): secrets become [secret removed]; the home path becomes HOME.
function scrubWith(secrets, home) {
  return (text) => {
    let t = String(text === undefined || text === null ? '' : text);
    for (const s of secrets || []) t = t.split(s).join('[secret removed]');
    if (home && home.length > 1) t = t.split(home).join('HOME');
    return t;
  };
}

function parseSize(size) {
  const m = /^(\d+)x(\d+)$/.exec(size || '');
  if (!m) throw new Error('bad size ' + size + ' (want COLSxROWS, for example 120x40)');
  return { cols: Number(m[1]), rows: Number(m[2]) };
}

// ---- preflight -------------------------------------------------------------------------------

function run(cmd, args, opts) {
  return spawnSync(cmd, args, Object.assign({ encoding: 'utf8', timeout: 20000 }, opts || {}));
}

// Throws EnvGap with one plain sentence when the machine cannot do the capture.
function preflight(opts) {
  const o = opts || {};
  const t = run('tmux', ['-V']);
  if (t.error || t.status !== 0) {
    throw new EnvGap('tmux is not installed or not on PATH, so the screen cannot be captured. Install tmux (for example: sudo apt install tmux), then run the same command again.');
  }
  const pw = run('playwright', ['--version']);
  if (pw.error || pw.status !== 0) {
    throw new EnvGap('The Playwright CLI is not installed or not on PATH, so no PNG can be taken. Install it (npm install -g playwright, then playwright install chromium), then run the same command again.');
  }
  const info = { tmux: t.stdout.trim(), playwright: pw.stdout.trim(), claude: null, login: 'not needed (--program test mode)' };
  if (o.program) return info;
  const v = run('claude', ['--version']);
  if (v.error || v.status !== 0) {
    throw new EnvGap('Claude Code (the claude command) is not on PATH, so there is no session to capture. Install it or fix PATH, then run the same command again.');
  }
  const a = run('claude', ['auth', 'status']);
  let loggedIn = null;
  try { loggedIn = JSON.parse(a.stdout).loggedIn; } catch (e) { loggedIn = null; }
  if (loggedIn === false) {
    throw new EnvGap('Claude Code is not logged in in this terminal, so a real session cannot start. Run claude, log in once (type /login), then run the same command again.');
  }
  info.claude = v.stdout.trim();
  info.login = loggedIn === true ? 'logged in' : 'unknown (auth status was not readable; continuing)';
  return info;
}

// ---- the scratch config folder (P8) -----------------------------------------------------------

// buildScratchConfig({ root, workDir, homeDir }): { configDir, credentialsPath }.
// The folder holds a symlink to the real login file and a seeded .claude.json (onboarding done, dark
// theme, exactly the scratch working folder trusted). Nothing is written inside the real config folder.
function buildScratchConfig(opts) {
  const homeDir = opts.homeDir || os.homedir();
  const realConfig = opts.realConfigDir || path.join(homeDir, '.claude');
  const credentials = path.join(realConfig, '.credentials.json');
  const configDir = path.join(path.resolve(opts.root), 'claude-config');
  const rel = path.relative(path.resolve(realConfig), configDir);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Error('refused: the scratch config folder would sit inside the real config folder ' + realConfig);
  }
  if (!fs.existsSync(credentials)) {
    throw new EnvGap('The Claude login file ' + credentials + ' was not found, so a scratch session cannot be logged in. Log in once with claude (type /login), then run the same command again.');
  }
  const work = fs.realpathSync(opts.workDir);
  fs.mkdirSync(configDir, { recursive: true });
  fs.symlinkSync(credentials, path.join(configDir, '.credentials.json'));
  const projects = {};
  projects[work] = { allowedTools: [], history: [], mcpContextUris: [], mcpServers: {}, enabledMcpjsonServers: [], disabledMcpjsonServers: [], hasTrustDialogAccepted: true, projectOnboardingSeenCount: 1 };
  const cfg = { hasCompletedOnboarding: true, theme: 'dark', numStartups: 1, projects };
  fs.writeFileSync(path.join(configDir, '.claude.json'), JSON.stringify(cfg, null, 2) + '\n');
  return { configDir, credentialsPath: credentials };
}

// ---- the synthetic transcript for the reply chip (P9) ------------------------------------------

// Claude Code keeps a session at CONFIG/projects/SLUG/SESSIONID.jsonl, SLUG being the working folder
// path with every character that is not a letter or a digit replaced by a hyphen. For the paths the
// harness makes (slashes, dots, letters, digits, hyphens) this is the rule "slash and dot become hyphen".
function projectSlug(workDir) {
  return String(workDir).replace(/[^A-Za-z0-9]/g, '-');
}

const DEFAULT_REPLY = '🟦 **Larry | MindrianOS** This is a fixed test sentence for the screenshot harness.';

function buildTranscript(opts) {
  const sessionId = opts.sessionId || crypto.randomUUID();
  const replyText = opts.replyText === undefined || opts.replyText === null ? DEFAULT_REPLY : opts.replyText;
  const version = opts.version || '2.1.309';
  const dir = path.join(opts.configDir, 'projects', projectSlug(opts.workDir));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, sessionId + '.jsonl');
  const t0 = Date.now() - 60000;
  const userUuid = crypto.randomUUID();
  const asstUuid = crypto.randomUUID();
  const common = { isSidechain: false, userType: 'external', cwd: opts.workDir, sessionId, version };
  const userLine = Object.assign({ parentUuid: null }, common, {
    type: 'user', uuid: userUuid, timestamp: new Date(t0).toISOString(),
    message: { role: 'user', content: opts.userText || 'Hello.' },
  });
  const asstLine = Object.assign({ parentUuid: userUuid }, common, {
    type: 'assistant', uuid: asstUuid, timestamp: new Date(t0 + 1000).toISOString(),
    message: { role: 'assistant', content: [{ type: 'text', text: replyText }] },
  });
  fs.writeFileSync(file, JSON.stringify(userLine) + '\n' + JSON.stringify(asstLine) + '\n');
  return { path: file, sessionId, userUuid, asstUuid };
}

// ---- tmux ------------------------------------------------------------------------------------

// The tmux SERVER is started by the first tmux call, and a new session's environment comes from the
// server's start environment, so what the child needs (the login token) must be in the environment of
// that first spawn.
function makeTmux(sock, env) {
  const base = ['-L', sock, '-f', '/dev/null'];
  return (args) => spawnSync('tmux', base.concat(args), { encoding: 'utf8', timeout: 20000, env: env || process.env });
}

// startSession(opts): { tmux, name, cap, capAnsi, alive, keysLit, keyName, kill, cols, rows }.
// The private server is set to default-terminal tmux-256color with the RGB feature BEFORE the session
// exists (one chained tmux call), so the child sees a truecolor-capable TERM.
function startSession(opts) {
  const sock = opts.sock;
  const name = opts.name || sock;
  const tmux = makeTmux(sock, opts.env || process.env);
  const term = opts.defaultTerminal || 'tmux-256color';
  const r = tmux([
    'start-server', ';',
    'set-option', '-g', 'exit-empty', 'off', ';',
    'set-option', '-g', 'default-terminal', term, ';',
    'set-option', '-as', 'terminal-features', ',*:RGB', ';',
    'new-session', '-d', '-s', name, '-x', String(opts.cols), '-y', String(opts.rows), '-c', opts.cwd, opts.command,
  ]);
  if (r.status !== 0) throw new Error('tmux new-session failed: ' + String(r.stderr || '').trim());
  tmux(['set-option', '-g', 'exit-empty', 'on']);
  const sendLiteral = (s) => {
    assertAllowedSlash(s);
    return tmux(['send-keys', '-t', name, '-l', s]);
  };
  const sendKey = (k) => {
    if (ALLOWED_KEYS.indexOf(k) === -1) throw new Error('refused: key ' + k + ' is not allow-listed');
    return tmux(['send-keys', '-t', name, k]);
  };
  return {
    tmux, sock, name, cols: opts.cols, rows: opts.rows,
    cap: () => (tmux(['capture-pane', '-p', '-t', name]).stdout || ''),
    capAnsi: () => (tmux(['capture-pane', '-p', '-e', '-t', name]).stdout || ''),
    alive: () => tmux(['has-session', '-t', name]).status === 0,
    keysLit: sendLiteral,
    keyName: sendKey,
    option: (n) => (tmux(['show-options', '-gv', n]).stdout || '').trim(),
    kill: () => { tmux(['kill-session', '-t', name]); tmux(['kill-server']); },
  };
}

// ---- the workspace trust dialog (T-380-07) -----------------------------------------------------

// The dialog lists its choices as rows and marks the selected one with a pointer. In claude 2.1.290 the
// first row was "No, exit" and it was selected by default, so a plain Enter quits the session. This
// reads which row carries the pointer, from the plain screen text. Rows may carry a number ("1. Yes").
//   state: 'absent', 'yes', 'no', or 'unknown' (dialog seen, no pointer row readable)
const TRUST_SEEN_RE = /Do you trust the files in this folder|trust this folder|Yes, I trust|Is this a project you/i;
function trustDialogState(screen) {
  const text = String(screen || '');
  if (!TRUST_SEEN_RE.test(text)) return { state: 'absent', selected: null, rows: [] };
  const rows = [];
  let selected = null;
  for (const line of text.split('\n')) {
    const m = /^\s*([❯›>])?\s*(?:\d+\.\s*)?((?:Yes|No)\b[^\n]*?)\s*$/.exec(line);
    if (!m) continue;
    rows.push(m[2]);
    if (m[1]) selected = m[2];
  }
  if (selected === null) return { state: 'unknown', selected, rows };
  return { state: /^Yes\b/i.test(selected) ? 'yes' : 'no', selected, rows };
}

// answerTrust(session, screen, log): one step of the answer loop. Returns:
//   'absent'    no dialog on screen
//   'waiting'   dialog seen, pointer row not readable yet; pressed nothing
//   'answered'  pointer was moved onto Yes (re-reading after each key) and Enter pressed
//   'gone'      the dialog or the session went away while moving the pointer
//   'refused'   the pointer could not be put on Yes; Enter was NOT pressed
async function answerTrust(session, screen, log) {
  const trust = trustDialogState(screen);
  if (trust.state === 'absent') return 'absent';
  if (trust.state === 'unknown') {
    if (!log.some((a) => /pointer row not readable/.test(a))) log.push('trust dialog: pointer row not readable yet; pressed nothing, reading again');
    return 'waiting';
  }
  let cur = trust;
  const moves = [];
  const order = ['Down', 'Down', 'Up', 'Down'];
  for (let i = 0; i < order.length && cur.state !== 'yes'; i += 1) {
    session.keyName(order[i]);
    moves.push(order[i]);
    await sleep(250);
    const s = session.cap();
    if (EXIT_RE.test(s)) return 'gone';
    cur = trustDialogState(s);
    if (cur.state === 'absent') return 'gone';
  }
  if (cur.state === 'yes') {
    session.keyName('Enter');
    log.push('trust dialog: ' + (moves.length ? 'the pointer was on "' + trust.selected + '"; pressed ' + moves.join(', ') + ' until it sat on "' + cur.selected + '"; ' : 'the pointer was already on "' + cur.selected + '"; ') + 'then pressed Enter (chose: Yes, I trust this folder)');
    return 'answered';
  }
  log.push('trust dialog: could not put the pointer on "Yes, I trust this folder" (pressed ' + (moves.join(', ') || 'nothing') + '; pointer on "' + (cur.selected || 'no readable row') + '"); did NOT press Enter');
  return 'refused';
}

// ---- the safe slash submit ---------------------------------------------------------------------

// Why: a past real run typed /workspace and pressed Enter; the autocomplete had highlighted a DIFFERENT
// command, so Enter started a model turn. The rule: type the whole text, READ the screen, press Enter
// only when (1) the live prompt line shows exactly the typed text and (2) the suggestion list is
// visible and its highlighted row is the typed command. Otherwise clear the line (Ctrl-U) and report.
const POINTER_CHARS = '❯›▶>';
const PROMPT_RE = new RegExp('^\\s*(?:[\\u2502|]\\s*)?[' + POINTER_CHARS + ']\\s?(.*?)\\s*(?:[\\u2502|])?\\s*$');
const RULE_RE = /─{5,}/;
const SUGGESTION_RE = new RegExp('^\\s*(?:[\\u2502|]\\s*)?([' + POINTER_CHARS + ']\\s*)?(\\/[\\w.:-]+)(?:\\s+(.*?))?\\s*(?:[\\u2502|])?\\s*$');

function emphasized(cell) {
  return !cell.dim && (cell.inverse || cell.bold || cell.fg !== null || cell.bg !== null);
}

function readSlashState(ansi, cols, rows) {
  const grid = P.parseAnsi(String(ansi || ''), cols, rows);
  const texts = [];
  for (let r = 0; r < grid.rows; r += 1) texts.push(P.rowText(grid, r));
  let promptRow = null;
  let promptText = null;
  for (let r = 1; r < texts.length; r += 1) {
    const m = PROMPT_RE.exec(texts[r]);
    if (m && (RULE_RE.test(texts[r - 1]) || /[╭┌]/.test(texts[r - 1]))) { promptRow = r; promptText = m[1]; break; }
  }
  const out = { promptRow, promptText, rows: [], highlightedIndex: null, signal: 'no_prompt_line' };
  if (promptRow === null) return out;
  // Measured 2026-10-23 (claude 2.1.309): the suggestion list is drawn ABOVE the prompt rule, with the
  // panel block between the list and the rule. Older hosts drew it below. Both sides are read.
  for (let r = 0; r < texts.length; r += 1) {
    if (r === promptRow) continue;
    const m = SUGGESTION_RE.exec(texts[r]);
    if (!m) continue;
    const token = m[2];
    const f = P.findText(grid, token, { fromRow: r });
    const cell = f && f.row === r ? grid.cells[r][f.col] : null;
    out.rows.push({ row: r, token, pointer: !!m[1], inverse: !!(cell && cell.inverse), emphasized: !!(cell && emphasized(cell)) });
  }
  if (out.rows.length === 0) { out.signal = 'no_suggestion_list'; return out; }
  const ptr = out.rows.map((x, i) => (x.pointer ? i : -1)).filter((i) => i >= 0);
  const inv = out.rows.map((x, i) => (x.inverse ? i : -1)).filter((i) => i >= 0);
  if (ptr.length === 1) { out.highlightedIndex = ptr[0]; out.signal = 'pointer'; return out; }
  if (inv.length === 1) { out.highlightedIndex = inv[0]; out.signal = 'inverse'; return out; }
  if (out.rows.length === 1) { out.highlightedIndex = 0; out.signal = 'only_row'; return out; }
  const emph = out.rows.map((x, i) => (x.emphasized ? i : -1)).filter((i) => i >= 0);
  if (emph.length === 1) { out.highlightedIndex = emph[0]; out.signal = 'style'; return out; }
  out.signal = 'highlight_not_readable';
  return out;
}

// submitSlashSafely(session, typed): the whole procedure for one allow-listed command.
// Returns { ok, state, reason, notes } where state is 'sent' (Enter pressed) or 'unsafe' (nothing sent).
async function submitSlashSafely(session, typed) {
  assertAllowedSlash(typed);
  const result = { ok: false, state: 'unsafe', reason: null, typed, moves: [], notes: [] };
  const read = () => readSlashState(session.capAnsi(), session.cols, session.rows);
  const clear = async () => { session.keyName('C-u'); await sleep(300); };
  const why = (r) => { if (result.reason === null) result.reason = r; };
  const tokenRe = new RegExp('^' + typed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
  session.keysLit(typed);
  await sleep(1200);
  let st = read();
  if (st.promptText !== typed) { await sleep(800); st = read(); }
  if (st.promptText !== typed) {
    why(st.promptRow === null ? 'prompt_line_not_found' : 'prompt_text_mismatch');
    result.notes.push('typed ' + typed + ': the prompt line does not show exactly the typed text; pressed nothing');
    await clear();
    return result;
  }
  if (st.rows.length === 0) {
    why('no_suggestion_list_visible');
    result.notes.push('typed ' + typed + ': no suggestion list is on the screen, so the highlight cannot be checked; pressed nothing');
    await clear();
    return result;
  }
  for (let i = 0; i <= st.rows.length + 1; i += 1) {
    const target = st.rows.find((x) => tokenRe.test(x.token));
    if (!target) {
      why('command_not_in_list');
      result.notes.push('typed ' + typed + ': the list holds ' + st.rows.map((x) => x.token).join(', ') + ' and none is the command; pressed nothing');
      break;
    }
    if (st.highlightedIndex === null) {
      why('highlight_not_readable');
      result.notes.push('typed ' + typed + ': the highlighted row cannot be read from the screen (' + st.signal + '); pressed nothing');
      break;
    }
    if (st.rows[st.highlightedIndex].row === target.row) {
      session.keyName('Enter');
      result.ok = true;
      result.state = 'sent';
      result.reason = null;
      result.notes.push('typed ' + typed + '; the highlighted row was ' + target.token + (result.moves.length ? ' after ' + result.moves.length + ' Down press(es)' : ' at once') + '; pressed Enter');
      return result;
    }
    session.keyName('Down');
    result.moves.push('Down');
    await sleep(400);
    st = read();
    if (st.rows.length === 0) { why('no_suggestion_list_visible'); break; }
  }
  why('command_not_reachable');
  await clear();
  return result;
}

module.exports = {
  EnvGap,
  ALLOWED_SLASH,
  ALLOWED_KEYS,
  UNSET_NAMES,
  SECRET_NAMES,
  EXIT_RE,
  LINGER_SEC,
  DEFAULT_REPLY,
  isAllowedSlash,
  assertAllowedSlash,
  buildChildEnv,
  envPrefix,
  secretValues,
  scrubWith,
  parseSize,
  preflight,
  run,
  buildScratchConfig,
  projectSlug,
  buildTranscript,
  makeTmux,
  startSession,
  trustDialogState,
  answerTrust,
  readSlashState,
  submitSlashSafely,
  shq,
  sleep,
};
