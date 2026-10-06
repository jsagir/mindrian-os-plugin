// 369.26-17: the pure helpers of the final render check (UI-SPEC 17.2 on the finished mod).
//
// Why a separate file: everything here is plain text in, plain verdict out, so it is unit tested
// with canned input (tests/test-369.26-render-parser.cjs) and nothing in it needs tmux, Claude
// Code or a room. The files that DO need them (render-check.cjs, live-room.cjs) call into this.
//
//   hashRecords          a stable hash of room rows, so "decide later wrote nothing" is hash equality
//   parseMcpServerNames  the server names out of a captured /mcp screen
//   compareServerName    does the name the mod calls appear in that list
//   parseScript, PRESETS the key-sequence language the harness plays into the session
//   deckStringFrom, readDeck, deckPrefix   the words the screen must show, read from the copy deck
//   judge*               verdicts from captured frames and the room read-back; a missing frame is
//                        PENDING-HUMAN, never a guess
//
// Build tooling (CJS, node built-ins only). Not the mod's runtime source. No em-dashes.
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

// ---- hashing ----------------------------------------------------------------------------------

function canon(value) {
  if (Array.isArray(value)) return '[' + value.map(canon).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canon(value[k])).join(',') + '}';
  }
  return JSON.stringify(value === undefined ? null : value);
}

// Rows in any order, keys in any order, the same hash.
function hashRecords(rows) {
  const lines = (Array.isArray(rows) ? rows : []).map(canon).sort();
  return crypto.createHash('sha256').update(lines.join('\n')).digest('hex');
}

// ---- /mcp screen ------------------------------------------------------------------------------

const STATUS_WORDS = ['connected', 'failed', 'needs authentication', 'pending', 'connecting', 'disabled'];

// The layout of the real /mcp panel has not been seen (no logged-in session yet), so this reads two
// shapes and says so: any plugin-qualified token (plugin:<plugin>:<server>), and any line that is
// a bare name followed by a status word. The raw capture is always kept for a human to read.
function parseMcpServerNames(text) {
  const names = [];
  const statuses = {};
  const add = (name, status) => {
    if (!names.includes(name)) names.push(name);
    if (status && !statuses[name]) statuses[name] = status;
  };
  const lines = String(text || '').split('\n');
  for (const raw of lines) {
    const line = raw.replace(/[\u2500-\u257f]/g, ' ').replace(/^[\s\u276f>*]+/, '').replace(/^\d+[.)]\s+/, '').trim();
    if (line.length === 0) continue;
    const statusWord = STATUS_WORDS.find((w) => line.toLowerCase().includes(w));
    const plug = /\bplugin:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+/.exec(line);
    if (plug) {
      add(plug[0], statusWord);
      continue;
    }
    if (statusWord) {
      const m = /^([A-Za-z][A-Za-z0-9_.:-]*)\s*(?:[\u00b7|:-]\s*)?(?:[\u2714\u2713\u2718\u2717\u25cf\u25cb]\s*)?/.exec(line);
      if (m && !STATUS_WORDS.includes(m[1].toLowerCase())) add(m[1], statusWord);
    }
  }
  return { names, statuses };
}

// verdict: match | differs | not_seen. closest: names that share the final server word.
function compareServerName(names, expected) {
  if (!Array.isArray(names) || names.length === 0) return { verdict: 'not_seen', closest: [] };
  if (names.includes(expected)) return { verdict: 'match', closest: [expected] };
  const tail = String(expected).split(':').pop();
  const parts = String(expected).split(':');
  const stem = parts.length > 1 ? parts.slice(0, -1).join(':') + ':' : '';
  const closest = names.filter((n) => (stem && n.startsWith(stem)) || n.endsWith(':' + tail) || n === tail);
  return { verdict: 'differs', closest };
}

// ---- the key script language ------------------------------------------------------------------

// One step per line; blank lines and lines starting with # are ignored.
//   wait <ms>            sleep
//   type <text>          send the literal text (spaces kept)
//   key <Name>           send one named tmux key (Enter, Escape, Tab, C-u ...)
//   burst <k> <k> ...    send these keys in ONE tmux command (two presses in the same instant)
//   capture <name>       keep the screen as a named frame (ansi, text, html, and the pane text)
//   inspect <name>       read the live room back (read only) and keep it under this name
//   open [tab]           open the workspace pane with its slash command, on a tab word when given
function parseScript(text) {
  const steps = [];
  const lines = String(text || '').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const at = (msg) => new Error('script line ' + (i + 1) + ': ' + msg + ' (' + JSON.stringify(raw) + ')');
    const m = /^(\S+)(?:\s+(.*))?$/.exec(line);
    const op = m[1];
    const rest = m[2] === undefined ? '' : m[2];
    if (op === 'wait') {
      if (!/^\d+$/.test(rest.trim())) throw at('wait needs a number of milliseconds');
      steps.push({ op: 'wait', ms: Number(rest.trim()) });
    } else if (op === 'type') {
      if (rest.length === 0) throw at('type needs some text');
      steps.push({ op: 'type', text: rest });
    } else if (op === 'key') {
      if (!/^[A-Za-z0-9-]+$/.test(rest.trim())) throw at('key needs one key name');
      steps.push({ op: 'key', name: rest.trim() });
    } else if (op === 'burst') {
      const keys = rest.split(/\s+/).filter(Boolean);
      if (keys.length === 0) throw at('burst needs at least one key');
      steps.push({ op: 'burst', keys });
    } else if (op === 'capture' || op === 'inspect') {
      if (!/^[A-Za-z0-9_-]+$/.test(rest.trim())) throw at(op + ' needs a one-word name');
      steps.push({ op, name: rest.trim() });
    } else if (op === 'open') {
      const tab = rest.trim();
      if (tab && !/^(room|think|sources|review)$/.test(tab)) throw at('open takes room, think, sources or review');
      steps.push(tab ? { op: 'open', tab } : { op: 'open' });
    } else {
      throw at('unknown step "' + op + '"');
    }
  }
  return steps;
}

// The pane is opened by its slash command, never by a hotkey, so the round trip does not depend on
// item 7. A digit press only lands when the pane holds the keys, which `open` gives it.
const PRESETS = {
  roundtrip: [
    '# a live gate round trip against a hermetic room (one card raised by another process)',
    'wait 2500',
    'capture band',
    'inspect before',
    'open review',
    'capture opened',
    '# c: press 1 directly. The card belongs to another window, so a refusal in plain words is expected',
    'type 1',
    'wait 2500',
    'capture direct',
    'inspect after-direct',
    '# d: ask it here (the mirror button)',
    'type i',
    'wait 3500',
    'capture mirrored',
    'inspect after-mirror',
    '# e: one press saves; a frame right away, then a settled one',
    'type 1',
    'wait 250',
    'capture saving',
    'wait 3500',
    'capture saved',
    'inspect after',
  ].join('\n'),
  'decide-later': [
    '# decide later writes nothing: the records are the same before and after the press',
    'wait 2500',
    'inspect before',
    'open review',
    'capture opened',
    'type d',
    'wait 2500',
    'capture after',
    'inspect after',
  ].join('\n'),
  'double-press': [
    '# two presses in the same instant leave exactly one decision',
    'wait 2500',
    'open review',
    'type i',
    'wait 3500',
    'capture mirrored',
    'burst 1 1',
    'wait 4000',
    'capture saved',
    'inspect after',
  ].join('\n'),
  'o-empty': ['# the open key with an empty prompt', 'wait 1500', 'capture before', 'type o', 'wait 2500', 'capture after'].join('\n'),
  'o-after-text': ['# the open key after typing in the prompt', 'wait 1500', 'capture before', 'type hello', 'wait 600', 'type o', 'wait 2500', 'capture after'].join('\n'),
  'h-empty': ['# the help key with an empty prompt', 'wait 1500', 'capture before', 'type h', 'wait 2500', 'capture after'].join('\n'),
  'digit-in-pane': ['# a digit with the pane focused', 'wait 1500', 'open review', 'capture before', 'type 1', 'wait 2500', 'capture after'].join('\n'),
};

// ---- the copy deck (the words the screen must show) ------------------------------------------

function unescapeDeck(s) {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_m, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function deckStringFrom(src, id) {
  const re = new RegExp("^\\s*'" + id + "':\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|\"((?:[^\"\\\\]|\\\\.)*)\")", 'm');
  const m = re.exec(String(src || ''));
  if (!m) return null;
  return unescapeDeck(m[1] !== undefined ? m[1] : m[2]);
}

function readDeck(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = {};
  const re = /^\s*'([A-Z]\d{2,3})':/gm;
  let m;
  while ((m = re.exec(src)) !== null) out[m[1]] = deckStringFrom(src, m[1]);
  return out;
}

// 'Saved to your data room: {label}.' -> 'Saved to your data room'
function deckPrefix(s) {
  const cut = String(s || '').split('{')[0];
  return cut.replace(/[\s:.]+$/, '');
}

// ---- judging ----------------------------------------------------------------------------------

const squash = (s) => String(s || '').replace(/[\u2500-\u257f]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (frame, phrase) => !!phrase && squash(frame).toLowerCase().includes(squash(phrase).toLowerCase());

const PENDING = 'PENDING-HUMAN';

function verdict(id, step, result, detail) {
  return { id, step, result, detail };
}

function savedPrefix(deck) {
  return deck.D24Prefix || deckPrefix(deck.D24 || 'Saved to your data room');
}

// The round trip of the plan, as ordered verdicts. frames: { band, opened, direct, mirrored,
// saving, saved } (text). inspection: { before, after-direct, after-mirror, after } read-backs.
function judgeRoundTrip(input) {
  const frames = (input && input.frames) || {};
  const ins = (input && input.inspection) || {};
  const deck = (input && input.deck) || {};
  const saved = savedPrefix(deck);
  const out = [];
  const need = (id, step, names, fn) => {
    const missing = names.filter((n) => frames[n] === undefined);
    if (missing.length) return out.push(verdict(id, step, PENDING, 'no frame "' + missing.join('", "') + '" was captured (the live run has not happened)'));
    return out.push(fn());
  };

  need('a', 'the band shows the real purpose and a waiting decision', ['band'], () => {
    const waiting = has(frames.band, deck.B60);
    const sample = has(frames.band, '(sample)');
    if (waiting && sample) return verdict('a', 'the band shows the real purpose and a waiting decision', 'PASS', 'the band said "' + deck.B60 + '" and showed the room purpose (marked sample)');
    const unbound = has(frames.band, "You're not in a data room") || has(frames.band, 'Last data room used');
    return verdict('a', 'the band shows the real purpose and a waiting decision', 'FAIL', unbound ? 'the nested session did not read the room as bound (the binding route did not carry); read the band frame' : 'waiting words ' + (waiting ? 'present' : 'missing') + ', purpose ' + (sample ? 'present' : 'missing'));
  });

  need('b', 'the open step shows the Review tab with the waiting card', ['opened'], () => {
    const tabs = ['Room', 'Think', 'Sources', 'Review'].every((t) => has(frames.opened, t));
    const card = has(frames.opened, deck.P110);
    return verdict('b', 'the open step shows the Review tab with the waiting card', tabs && card ? 'PASS' : 'FAIL', 'tab strip ' + (tabs ? 'present' : 'missing') + ', "' + deck.P110 + '" ' + (card ? 'present' : 'missing'));
  });

  need('c', 'a direct press is refused in plain words and the card stays', ['direct'], () => {
    const step = 'a direct press is refused in plain words and the card stays';
    if (has(frames.direct, saved)) return verdict('c', step, 'FAIL', 'a saved sentence ("' + saved + '") appeared on a press for a card another window raised');
    const refusal = has(frames.direct, deck.E01) || has(frames.direct, deck.E04);
    const intact = has(frames.direct, deck.P110);
    if (refusal && intact) return verdict('c', step, 'PASS', 'a refusal sentence (' + (has(frames.direct, deck.E01) ? 'E01' : 'E04') + ') showed and the card was still drawn');
    return verdict('c', step, 'INCONCLUSIVE', 'no refusal sentence found (' + (refusal ? 'refusal present' : 'refusal missing') + ', card ' + (intact ? 'present' : 'missing') + '); read the frame');
  });

  need('d', 'the mirror button draws the card here', ['mirrored'], () => {
    const step = 'the mirror button draws the card here';
    const card = has(frames.mirrored, deck.P110);
    const stillRefused = has(frames.mirrored, deck.E01) || has(frames.mirrored, deck.E04);
    if (card && !stillRefused) return verdict('d', step, 'PASS', 'the card is drawn and the refusal sentence is gone');
    return verdict('d', step, card ? 'INCONCLUSIVE' : 'FAIL', 'card ' + (card ? 'present' : 'missing') + ', refusal sentence ' + (stillRefused ? 'still showing' : 'gone'));
  });

  if (frames.saving === undefined) {
    out.push(verdict('saving', 'the saving sentence shows before the saved sentence', PENDING, 'no "saving" frame was captured; the human reads whether "' + (deck.D23 || 'Saving your decision') + '" shows before "' + saved + '"'));
  } else {
    const d23 = has(frames.saving, deck.D23);
    const early = has(frames.saving, saved);
    out.push(verdict('saving', 'the saving sentence shows before the saved sentence', d23 && !early ? 'PASS' : early ? 'FAIL' : 'INCONCLUSIVE', d23 ? (early ? 'the saved sentence was already showing in the saving frame' : 'the saving sentence showed first') : early ? 'the saved sentence showed with no saving frame caught (too fast to see; not a failure by itself)' : 'neither sentence in the quick frame; read it'));
  }

  need('e', 'the screen says saved only after the room holds the decision', ['saved'], () => {
    const step = 'the screen says saved only after the room holds the decision';
    const says = has(frames.saved, saved);
    const after = ins.after;
    if (!after) return verdict('e', step, PENDING, 'no room read-back after the press');
    const held = Array.isArray(after.decisionNodes) && after.decisionNodes.length >= 1;
    if (says && held) return verdict('e', step, 'PASS', 'the saved sentence showed and the room holds ' + after.decisionNodes.length + ' decision node');
    if (says && !held) return verdict('e', step, 'FAIL', 'the screen said saved but the room holds no decision (a false save)');
    if (!says && held) return verdict('e', step, 'FAIL', 'the room holds the decision but the screen never said saved');
    return verdict('e', step, 'FAIL', 'neither the screen nor the room shows a save');
  });

  const after = ins.after;
  if (!after || after.gateAnswer === undefined) {
    out.push(verdict('f', 'the room holds exactly one decision and the answer route', PENDING, 'no room read-back after the press'));
  } else {
    const ga = after.gateAnswer || {};
    const one = Array.isArray(after.decisionNodes) && after.decisionNodes.length === 1;
    const good = one && ga.found === true && ga.verdict === 'approve' && Array.isArray(ga.chosen) && ga.chosen.length === 1;
    out.push(verdict('f', 'the room holds exactly one decision and the answer route', good ? 'PASS' : 'FAIL', 'decision nodes ' + ((after.decisionNodes || []).length) + ', answer anchor ' + (ga.found ? 'found' : 'missing') + ', verdict ' + ga.verdict + ', chosen ' + JSON.stringify(ga.chosen) + ', answered_via ' + (ga.answeredVia || 'n/a')));
  }
  return out;
}

function judgeDecideLater(input) {
  const b = input && input.before;
  const a = input && input.after;
  if (!b || !a) return verdict('g', 'decide later writes nothing', PENDING, 'no before and after read-back (the live run has not happened)');
  const same = b.recordsHash === a.recordsHash;
  const frames = (input && input.frames) || {};
  const deck = (input && input.deck) || {};
  const waiting = frames.after === undefined ? null : has(frames.after, deck.B60);
  if (!same) return verdict('g', 'decide later writes nothing', 'FAIL', 'the room records changed (hash ' + b.recordsHash + ' then ' + a.recordsHash + ')');
  if (waiting === false) return verdict('g', 'decide later writes nothing', 'FAIL', 'the records are identical but the band no longer says a decision is waiting');
  return verdict('g', 'decide later writes nothing', 'PASS', 'records identical before and after' + (waiting ? '; the band still says a decision is waiting' : '; the after frame was not captured, so the band is unchecked'));
}

function judgeDoublePress(input) {
  const a = input && input.after;
  if (!a) return verdict('h', 'two presses in one instant leave one decision', PENDING, 'no room read-back (the live run has not happened)');
  const n = (a.decisionNodes || []).length;
  return verdict('h', 'two presses in one instant leave one decision', n === 1 ? 'PASS' : 'FAIL', 'decision nodes after the double press: ' + n);
}

// Item 7: did a hotkey fire, or did the letter go into the prompt. frames: { before, after }.
function judgeKeyRun(name, typed, frames, deck) {
  const f = frames || {};
  if (f.after === undefined) return verdict(name, 'hotkey ' + name, PENDING, 'no frame captured (the live run has not happened)');
  const tabs = ['Room', 'Think', 'Sources', 'Review'].every((t) => has(f.after, t));
  const lines = String(f.after).split('\n');
  const inPrompt = lines.some((l) => new RegExp('[>\u276f]\\s*' + String(typed).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[\u2502|]?\\s*$').test(l.trim()));
  if (tabs) return verdict(name, 'hotkey ' + name, 'PASS', 'the pane opened: the key fired with the prompt in this state');
  if (inPrompt) return verdict(name, 'hotkey ' + name, 'FAIL', 'the letter went into the prompt: the hotkey did not fire');
  const changed = f.before !== undefined && squash(f.before) !== squash(f.after);
  return verdict(name, 'hotkey ' + name, 'INCONCLUSIVE', changed ? 'the screen changed but no pane tab strip is on it; read the frame' : 'nothing visible changed; read the frame');
}

module.exports = {
  hashRecords,
  parseMcpServerNames,
  compareServerName,
  parseScript,
  PRESETS,
  deckStringFrom,
  readDeck,
  deckPrefix,
  squash,
  has,
  judgeRoundTrip,
  judgeDecideLater,
  judgeDoublePress,
  judgeKeyRun,
};
