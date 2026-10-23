// Generator and drift gate for ui/mos-face/hooks/commands.ts (380-06, D-04, T-380-21, T-380-23).
//
// Why: commands.ts was generated against plugin 2.0.0-beta.69 by a script that was never kept.
// It held sentences with Brain, MCP and Aura words (shown to the person as the "why" line of a
// suggested command) and it could name a command the plugin no longer has. This script gives
// the file a source and a gate.
//
// Source of the WHY table: data/command-registry.json, the "teaching" field of each command.
// WHY[command] is the first sentence of that text (a sentence ends at a full stop, question mark
// or exclamation mark followed by a space and a capital letter), with the word Larry read as
// Theo, then the plain-words override map below. TERM_COMMANDS and STATE_COMMANDS were resolved
// with the plugin's own resolver (lib/workflow/command-resolver.cjs commandsForFramework) and
// are kept as they are; this script only checks that each command they name still exists.
//
// Modes:
//   --check  Exit 1 on a hard problem and write nothing. Hard problems: a command in WHY,
//            TERM_COMMANDS, STATE_COMMANDS or DOCTOR that the registry does not hold; a banned
//            word or dash in any string value of the file; the constant PLUGIN_VERSION; a bad
//            override. A WHY sentence that differs from the generated one prints a WARN line and
//            still exits 0 (the registry text changed; the recovery is --write, then the build).
//   --write  Rewrite the header comment and the WHY block of commands.ts, and delete the constant
//            PLUGIN_VERSION (nothing in the panel reads it and it goes stale at each release).
//            It fails and names the command when TERM_COMMANDS or STATE_COMMANDS names one the
//            registry does not hold, or when a generated sentence still holds a banned word.
//
// CJS, Node built-ins only. No network. Hyphens only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MOD = path.resolve(__dirname, '..');
const REPO = path.resolve(MOD, '..', '..');
const REGISTRY = path.join(REPO, 'data', 'command-registry.json');
const TARGET = path.join(MOD, 'hooks', 'commands.ts');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const COMMAND_NAME = /\/mos:[a-z0-9-]+/g;
const WORD_RULES = [
  ['ICM', /\bICM\b/i],
  ['Brain', /\bBrain\b/i],
  ['MCP', /\bMCP\b/i],
  ['Aura', /\bAura\b/i],
  ['Larry', /\bLarry\b/i],
  ['the book', /\bthe book\b/i],
  ['Aronhime', /Aronhime/i],
  ['Lawrence', /Lawrence/i],
  ['Johns Hopkins', /Johns Hopkins/i],
  ['JHU', /\bJHU\b/],
  // The voice segment of the book (mos-brand book e947a5d, segments/writing/voice) avoids these words.
  ['revolutionary', /\brevolutionary\b/i],
  ['game-changing', /\bgame-chang(ing|er)\b/i],
  ['supercharge', /\bsupercharg/i],
  ['unlimited potential', /\bunlimited potential\b/i],
  ['instant insight', /\binstant insight\b/i],
  ['AI workforce', /\bAI workforce\b/i],
  ['autonomous strategist', /\bautonomous strategist\b/i],
  // A claim the product has not checked (voice: "not a reason to claim a capability that has not been checked").
  ['unchecked superlative', /\b(ever published|most rigorous)\b/i],
];

// The banned things found in one text. A command name is a name, not prose, so it is removed
// before the words are checked.
function banned(text) {
  const found = [];
  if (text.includes(EM)) found.push('em-dash');
  if (text.includes(EN)) found.push('en-dash');
  // The book: never use a double hyphen to imitate an em dash (segment writing/voice, hard language rules).
  if (/ -- /.test(text)) found.push('double-hyphen');
  const words = text.replace(COMMAND_NAME, ' ');
  for (const [name, rule] of WORD_RULES) if (rule.test(words)) found.push(name);
  return found;
}

// The plain-words override map. Each key is a registry command whose first sentence still holds
// a banned word after Larry is read as Theo. Each value is one hand-written sentence in the form
// the other lines use: When ..., /mos:name ... Reviewed words: say Theo, never Brain; say data
// room, never ICM; no stack word; no dash.
const OVERRIDES = {
  '/mos:admin':
    'When you need to inspect or rotate your Theo access keys, /mos:admin opens the admin panel',
  '/mos:agentshield':
    "When you want to know whether the plugin's own tools, hooks, skills, CLAUDE.md, and dependencies carry a known attack pattern, /mos:agentshield scans all five and reports what is clean and what is flagged",
  '/mos:brain-derive':
    'When a room section drifts from its Theo context file, /mos:brain-derive rebuilds that file now',
  '/mos:mos-reason':
    'When a section needs its MINTO face generated against its artifacts, /mos:mos-reason produces the pyramid: governing thought down to grounded support',
  '/mos:research':
    "When you need fresh evidence from the web cross-referenced with Theo's methodology graph, /mos:research runs the dual-source pull",
  // Plan 380-07 (book review of the shipped copy). The registry sentence of each command below holds
  // a double hyphen used as a dash (the book: never use a double hyphen to imitate an em dash,
  // segment writing/voice) or a superlative that the product has not checked. The meaning is kept;
  // the dash becomes brackets, a colon or a full stop.
  '/mos:deck':
    'When your room is full but the story is not yet a deck, /mos:deck asks one thing: which shape fits (Feynman to make it clear, HEART to make it land, or mesh to do both), then walks the structure section by section, filling each from your own room and binding the MindrianOS look by default',
  '/mos:mullins':
    "When you need to screen an opportunity against seven domains, /mos:mullins runs the 7-Domains Model from Mullins' New Business Road Test",
  '/mos:mva-report':
    'When you have finished a conversation with Theo and want to see whether it fired the right things at the right time (did it reach a conclusion or circle, did it elevate across frames, did the gates fire), run /mos:mva-report',
  '/mos:show':
    "When the room is full but you don't know which view answers your question, /mos:show asks your job in plain language (know where I stand, find what's broken, make it land, get it into the world) and runs the right view underneath",
  '/mos:stance':
    'When you want Theo to shift how he talks to you this session (pull evidence, deliver decisively, stay Socratic, or challenge you), /mos:stance flips the dial in one confirm',
  '/mos:trending-to-absurd':
    "When a trend feels safe, you have not pushed it far enough. /mos:trending-to-absurd seeds itself from your room's connective taxonomy, then extrapolates each trend to its absurd extreme across the 3-10 / 11-30 / 50yr horizons. The disruptive opportunity shows up at the edge first",
};

function firstSentence(text) {
  const clean = String(text || '').trim();
  const first = clean.split(/(?<=[.!?])\s+(?=[A-Z])/)[0] || clean;
  return first.replace(/[.]$/, '');
}

function generatedWhy(registry) {
  const out = {};
  for (const entry of registry.commands) {
    if (!entry || typeof entry.command !== 'string') continue;
    const read = firstSentence(entry.teaching).replace(/\bLarry\b/g, 'Theo');
    out[entry.command] = Object.prototype.hasOwnProperty.call(OVERRIDES, entry.command) ? OVERRIDES[entry.command] : read;
  }
  return out;
}

function objectAfter(source, name) {
  const m = source.match(new RegExp('export const ' + name + '[^=\\n]*= (\\{[\\s\\S]*?\\n\\})\\n'));
  if (!m) throw new Error('could not find ' + name + ' in commands.ts');
  return { text: m[1], value: JSON.parse(m[1]) };
}

function commandsOf(value) {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string' && v.startsWith('/mos:')) out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(value);
  return out;
}

function stringValues(value, into) {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value)) value.forEach(v => stringValues(v, into));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.push(k);
      stringValues(v, into);
    }
  }
  return into;
}

const HEADER = [
  '// Generated file. Do not edit by hand.',
  '// Regenerate with: node ui/mos-face/scripts/face-commands.cjs --write',
  '// TERM_COMMANDS and STATE_COMMANDS: framework -> /mos: commands, resolved with the plugin\'s own',
  '// resolver (lib/workflow/command-resolver.cjs commandsForFramework), never typed from memory. They',
  '// are kept as they are; the --check mode fails when one names a command the registry no longer holds.',
  '// WHY: the first sentence of each command teaching line in data/command-registry.json, in plain',
  '// words (the override map of scripts/face-commands.cjs replaces a sentence that holds a stack word).',
  '',
].join('\n');

function main() {
  const mode = process.argv[2];
  if (mode !== '--check' && mode !== '--write') {
    process.stderr.write('usage: node ui/mos-face/scripts/face-commands.cjs --check | --write\n');
    return 2;
  }
  const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  const known = new Set(registry.commands.map(c => c.command));
  const source = fs.readFileSync(TARGET, 'utf8');
  const term = objectAfter(source, 'TERM_COMMANDS');
  const state = objectAfter(source, 'STATE_COMMANDS');
  const problems = [];

  // The commands that TERM_COMMANDS and STATE_COMMANDS name must exist.
  const doctor = (source.match(/export const DOCTOR = "([^"]+)"/) || [])[1];
  const named = [...commandsOf(term.value), ...commandsOf(state.value), ...(doctor ? [doctor] : [])];
  // A command whose registry surface is internal is not for the person (main-session ruling on plan
  // 380-13, risk a): the panel never suggests one.
  const surfaceOf = new Map(registry.commands.map(c => [c.command, c.surface]));
  for (const command of new Set(named)) {
    if (!known.has(command)) problems.push('unknown command named by TERM_COMMANDS, STATE_COMMANDS or DOCTOR: ' + command);
    else if (surfaceOf.get(command) === 'internal') problems.push('internal command named by TERM_COMMANDS, STATE_COMMANDS or DOCTOR: ' + command);
  }

  // The override map must itself be clean and must point at a command that exists.
  for (const [command, sentence] of Object.entries(OVERRIDES)) {
    const found = banned(sentence);
    if (found.length > 0) problems.push('override for ' + command + ' holds ' + found.join(', '));
    if (!known.has(command)) process.stdout.write('WARN override for ' + command + ' points at a command the registry no longer holds\n');
  }

  const want = generatedWhy(registry);
  for (const [command, sentence] of Object.entries(want)) {
    const found = banned(sentence);
    if (found.length > 0) problems.push('generated sentence for ' + command + ' holds ' + found.join(', ') + ' (add a plain-words override)');
  }

  if (mode === '--write') {
    if (problems.length > 0) {
      for (const p of problems) process.stderr.write('FAIL ' + p + '\n');
      return 1;
    }
    // Keep the order of the keys already in the file (a small diff); new commands follow in
    // registry order.
    const oldOrder = Object.keys(objectAfter(source, 'WHY').value).filter(k => Object.prototype.hasOwnProperty.call(want, k));
    const ordered = {};
    for (const k of oldOrder) ordered[k] = want[k];
    for (const k of Object.keys(want)) if (!(k in ordered)) ordered[k] = want[k];
    const why = JSON.stringify(ordered, null, 2);
    let next = source;
    const importAt = next.indexOf("import type { FaceId }");
    if (importAt < 0) throw new Error('could not find the import line of commands.ts');
    next = HEADER + next.slice(importAt);
    next = next.replace(/export const PLUGIN_VERSION = .*\n\n?/, '');
    next = next.replace(/\/\/ First sentence of each command teaching line[^\n]*\n/, '');
    next = next.replace(/(export const WHY[^=\n]*= )\{[\s\S]*?\n\}\n/, (_, head) => head + why + '\n');
    fs.writeFileSync(TARGET, next);
    process.stdout.write('face-commands: wrote ' + Object.keys(want).length + ' WHY lines to hooks/commands.ts\n');
    return 0;
  }

  // --check
  if (/PLUGIN_VERSION/.test(source)) problems.push('the constant PLUGIN_VERSION is present (nothing reads it and it goes stale)');
  const why = objectAfter(source, 'WHY').value;
  for (const command of Object.keys(why)) {
    if (!known.has(command)) problems.push('WHY holds a command the registry does not: ' + command);
  }
  const values = [...stringValues(term.value, []), ...stringValues(state.value, []), ...stringValues(why, []), doctor || ''];
  const bad = new Set();
  for (const text of values) {
    const found = banned(text);
    if (found.length > 0) bad.add(found.join(',') + ' in "' + text.slice(0, 80) + '"');
  }
  for (const b of bad) problems.push('banned text: ' + b);

  let drift = 0;
  for (const [command, sentence] of Object.entries(want)) {
    if (why[command] !== sentence) {
      drift += 1;
      process.stdout.write('WARN WHY differs from the registry for ' + command + ' (run --write, then the build)\n');
    }
  }
  for (const p of problems) process.stderr.write('FAIL ' + p + '\n');
  process.stdout.write('face-commands: ' + Object.keys(why).length + ' WHY lines, ' + drift + ' drift warnings, ' + problems.length + ' problems\n');
  return problems.length > 0 ? 1 : 0;
}

process.exit(main());
