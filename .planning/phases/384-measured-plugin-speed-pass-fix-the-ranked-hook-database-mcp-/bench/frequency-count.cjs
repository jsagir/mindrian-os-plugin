'use strict';
// frequency-count.cjs (plan 384-09, threat T-384-40).
// Counts events per session from Claude session record files. Node built-ins only.
// It parses each line in memory and keeps counts only. It writes no text, no file name and no path.
//
// Usage: node frequency-count.cjs --out <file> [--projects-dir <dir>]
// Reads the .jsonl files that are direct children of the folders of <dir> whose name contains
// the room folder marker. Writes one JSON file with counts. stdout holds the basis and the session count.
const fs = require('fs');
const os = require('os');
const path = require('path');

// The marker is built from parts so that this file holds no room folder name in one piece.
const MARKER = 'Mindrian' + 'Rooms';
const MIN_SESSIONS = 3;

const TOOL_GROUPS = ['write_edit', 'read_grep_glob', 'bash', 'task', 'slash_command', 'brain', 'gate_answer', 'other'];

function groupOf(name) {
  const n = String(name || '');
  if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(n)) return 'write_edit';
  if (/^(Read|Grep|Glob)$/.test(n)) return 'read_grep_glob';
  if (n === 'Bash') return 'bash';
  if (n === 'Task' || n === 'Agent') return 'task';
  if (n === 'SlashCommand' || n === 'Skill') return 'slash_command';
  if (/gate_answer/.test(n)) return 'gate_answer';
  if (/brain/i.test(n)) return 'brain';
  return 'other';
}

function safeType(t) {
  // A record type is a short structural word. Anything else is counted as "other".
  return typeof t === 'string' && /^[a-z][a-z_-]{0,39}$/.test(t) ? t : 'other';
}

function isPrompt(rec) {
  if (!rec || rec.type !== 'user' || !rec.message) return false;
  const c = rec.message.content;
  if (typeof c === 'string') return true;
  if (Array.isArray(c)) return !c.some((p) => p && p.type === 'tool_result');
  return false;
}

function countFile(file) {
  const out = { prompts: 0, tool_use: {}, record_types: {} };
  for (const g of TOOL_GROUPS) out.tool_use[g] = 0;
  let data;
  try {
    data = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return out;
  }
  const lines = data.split('\n');
  for (const ln of lines) {
    if (!ln) continue;
    let rec;
    try {
      rec = JSON.parse(ln);
    } catch (e) {
      continue;
    }
    if (!rec || typeof rec !== 'object') continue;
    const t = safeType(rec.type);
    out.record_types[t] = (out.record_types[t] || 0) + 1;
    if (isPrompt(rec)) out.prompts += 1;
    if (rec.type === 'assistant' && rec.message && Array.isArray(rec.message.content)) {
      for (const part of rec.message.content) {
        if (part && part.type === 'tool_use') out.tool_use[groupOf(part.name)] += 1;
      }
    }
  }
  return out;
}

function median(a) {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function p95(a) {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(0.95 * (s.length - 1))];
}

function stat(a) {
  return { median: median(a), p95: p95(a) };
}

function listSessionFiles(projectsDir) {
  const files = [];
  let dirs = [];
  try {
    dirs = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch (e) {
    return files;
  }
  for (const d of dirs) {
    if (!d.isDirectory() || !d.name.includes(MARKER)) continue;
    const base = path.join(projectsDir, d.name);
    let entries = [];
    try {
      entries = fs.readdirSync(base, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.jsonl')) files.push(path.join(base, e.name));
    }
  }
  return files;
}

// The assumed model of plan 384-09, used when fewer than 3 session files exist.
function assumedModel() {
  return {
    marker: 'ASSUMED',
    note: 'Every value in this model is ASSUMED. It is not a measurement and is never ranked as one.',
    session_start_per_session: 1,
    prompts_per_session: 30,
    stop_per_session: 30,
    stop_note: 'The Stop count is derived: one Stop per prompt.',
    read_grep_glob_per_session: 60,
    write_edit_per_session: 20,
    bash_per_session: 40,
    slash_commands_per_session: 2,
    brain_tool_calls_per_session: 5,
    gate_answer_per_session: 1,
    compaction_per_session: 1,
    session_end_per_session: 1,
    subagent_stop_per_session: 5,
    task_completed_per_session: 1,
    cwd_changed_per_session: 1,
    mcp_server_starts_per_session: 1,
  };
}

function main(argv) {
  let out = null;
  let projectsDir = path.join(os.homedir(), '.claude', 'projects');
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') out = argv[(i += 1)];
    else if (argv[i] === '--projects-dir') projectsDir = argv[(i += 1)];
    else {
      process.stderr.write('usage: frequency-count.cjs --out <file> [--projects-dir <dir>]\n');
      return 2;
    }
  }
  if (!out) {
    process.stderr.write('usage: frequency-count.cjs --out <file> [--projects-dir <dir>]\n');
    return 2;
  }

  const files = listSessionFiles(projectsDir);
  const per = files.map(countFile);
  const n = per.length;
  const measured = n >= MIN_SESSIONS;

  const result = {
    schema: 'mos.freq-384/1',
    basis: measured ? 'measured from ' + n + ' session files' : 'ASSUMED model',
    sessions: n,
    privacy: 'counts only: no text, no file name, no path',
    totals: {
      prompts: per.reduce((s, x) => s + x.prompts, 0),
      tool_use: {},
      record_types: {},
    },
  };
  for (const g of TOOL_GROUPS) result.totals.tool_use[g] = per.reduce((s, x) => s + x.tool_use[g], 0);
  for (const x of per) {
    for (const k of Object.keys(x.record_types)) {
      result.totals.record_types[k] = (result.totals.record_types[k] || 0) + x.record_types[k];
    }
  }

  if (measured) {
    result.per_session = { prompts: stat(per.map((x) => x.prompts)), tool_use: {}, record_types: {} };
    for (const g of TOOL_GROUPS) result.per_session.tool_use[g] = stat(per.map((x) => x.tool_use[g]));
    const types = Object.keys(result.totals.record_types);
    for (const k of types) result.per_session.record_types[k] = stat(per.map((x) => x.record_types[k] || 0));
    result.derived = {
      stop_per_session: 'derived: one Stop per prompt',
      session_start_per_session: 'derived: one SessionStart per session file',
    };
  } else {
    result.model = assumedModel();
  }

  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write('basis: ' + result.basis + '\nsessions: ' + n + '\n');
  return 0;
}

process.exit(main(process.argv.slice(2)));
