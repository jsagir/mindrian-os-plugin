// F1 (the 2026-10-06 real run): the safe way to run a slash command inside a live session.
//
// What went wrong: the harness typed "/workspace" and pressed Enter. At 80 columns or more the
// session's slash autocomplete had highlighted a DIFFERENT command (/icm-workspace-architect), so
// Enter started that command, which is a model turn ("Larry is working"), and the pane never
// opened. The harness must send no model prompt in any run.
//
// The rule written here: type the whole text, READ the screen, and press Enter only when
//   (1) the live prompt line shows exactly the typed text, and
//   (2) the suggestion list is visible, and its highlighted row is the mod command.
// If the highlight is another command, press Down until it is the mod command. If that cannot be
// done, try the plugin-qualified form once. If the mod command still cannot be made the target, send
// nothing (clear the prompt line with Ctrl-U) and report 'open_step_unsafe'. A highlight that cannot
// be read from the screen is never guessed.
//
// Build tooling (CJS, node built-ins only). Not the mod's runtime source. No em-dashes.
'use strict';

const G = require('./ansi-grid.cjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const POINTER_CHARS = '❯›▶>';
const PROMPT_RE = new RegExp('^\\s*(?:[\\u2502|]\\s*)?[' + POINTER_CHARS + ']\\s?(.*?)\\s*(?:[\\u2502|])?\\s*$');
const RULE_RE = /─{5,}/;
const SUGGESTION_RE = new RegExp('^\\s*(?:[\\u2502|]\\s*)?([' + POINTER_CHARS + ']\\s*)?(\\/[\\w.:-]+)(?:\\s+(.*?))?\\s*(?:[\\u2502|])?\\s*$');

function styleKey(cell) {
  return [cell.fg, cell.bg, cell.bold ? 'b' : '', cell.inverse ? 'i' : '', cell.dim ? 'd' : ''].join('|');
}

// A style a list shows only for the selected row: a color, a fill, bold or reverse video, and not dim.
// The unselected rows of a list are the terminal's plain style or dim. This is an inference from the
// screen, used only when no pointer glyph or reverse video marks the row; if the rows do not split
// into exactly one emphasized row and the rest plain, the highlight is NOT readable and nothing is sent.
function isEmphasized(cell) {
  return !cell.dim && (cell.inverse || cell.bold || cell.fg !== null || cell.bg !== null);
}

// readSlashState(ansi, cols, rows): what a person would read off the screen.
//   promptRow, promptText   the live prompt line and the text on it (null when no prompt line is found)
//   rows                    the suggestion rows under the prompt: { row, token, text, pointer, inverse, style }
//   highlightedIndex        index into rows of the highlighted row, or null when it cannot be read
//   signal                  how the highlight was read: pointer, inverse, only_row, style, or why not
function readSlashState(ansi, cols, rows) {
  const grid = G.parseAnsi(String(ansi || ''), cols, rows);
  const texts = [];
  for (let r = 0; r < grid.rows; r += 1) texts.push(G.rowText(grid, r));
  let promptRow = null;
  let promptText = null;
  // The live prompt is the first pointer row with a horizontal rule (or a box top) right above it;
  // an earlier echo of a past command has no rule above it.
  for (let r = 1; r < texts.length; r += 1) {
    const m = PROMPT_RE.exec(texts[r]);
    if (m && (RULE_RE.test(texts[r - 1]) || /[╭┌]/.test(texts[r - 1]))) { promptRow = r; promptText = m[1]; break; }
  }
  const out = { promptRow, promptText, rows: [], highlightedIndex: null, signal: 'no_prompt_line' };
  if (promptRow === null) return out;
  for (let r = promptRow + 1; r < texts.length; r += 1) {
    const m = SUGGESTION_RE.exec(texts[r]);
    if (!m) continue;
    const token = m[2];
    const f = G.findText(grid, token, { fromRow: r });
    const cell = f && f.row === r ? grid.cells[r][f.col] : null;
    out.rows.push({ row: r, token, text: (token + ' ' + (m[3] || '')).trim(), pointer: !!m[1], inverse: !!(cell && cell.inverse), style: cell ? styleKey(cell) : null, emphasized: !!(cell && isEmphasized(cell)) });
  }
  if (out.rows.length === 0) { out.signal = 'no_suggestion_list'; return out; }
  const ptr = out.rows.map((x, i) => (x.pointer ? i : -1)).filter((i) => i >= 0);
  const inv = out.rows.map((x, i) => (x.inverse ? i : -1)).filter((i) => i >= 0);
  if (ptr.length === 1) { out.highlightedIndex = ptr[0]; out.signal = 'pointer'; return out; }
  if (ptr.length > 1) { out.signal = 'several_pointer_rows'; return out; }
  if (inv.length === 1) { out.highlightedIndex = inv[0]; out.signal = 'inverse'; return out; }
  if (inv.length > 1) { out.signal = 'several_inverse_rows'; return out; }
  if (out.rows.length === 1) { out.highlightedIndex = 0; out.signal = 'only_row'; return out; }
  const emph = out.rows.map((x, i) => (x.emphasized ? i : -1)).filter((i) => i >= 0);
  if (emph.length === 1) { out.highlightedIndex = emph[0]; out.signal = 'style'; return out; }
  out.signal = 'highlight_not_readable';
  return out;
}

// pickTarget(rows, spec): the suggestion row that is the mod command, or null. spec.tokenRe matches
// the command token; spec.descRe (optional) matches its description. With several rows of the right
// name the description must match; a single row of the right name is accepted without one (a narrow
// list may cut the description).
function pickTarget(rows, spec) {
  const exact = rows.filter((r) => spec.tokenRe.test(r.token));
  if (exact.length === 0) return null;
  if (spec.descRe) {
    const withDesc = exact.filter((r) => spec.descRe.test(r.text));
    if (withDesc.length > 0) return withDesc[0];
  }
  return exact.length === 1 ? exact[0] : null;
}

// submitSlashSafely(h, spec): the whole procedure. h = { capAnsi, keysLit, keyName, cols, rows }.
// spec = { typed, tokenRe, descRe, qualified: [typed forms to try next], suffix }.
// Returns { ok, state, reason, typed, target, moves, notes } where state is 'sent' (Enter pressed)
// or 'open_step_unsafe' (nothing was sent). It never presses Enter unless both conditions hold.
async function submitSlashSafely(h, spec) {
  const result = { ok: false, state: 'open_step_unsafe', reason: null, typed: null, target: null, moves: [], notes: [] };
  const clear = async () => { h.keyName('C-u'); await sleep(300); };
  const read = () => readSlashState(h.capAnsi(), h.cols, h.rows);
  const forms = [spec.typed].concat(spec.qualified || []);
  const why = (r) => { if (result.reason === null) result.reason = r; };
  for (const typed of forms) {
    result.typed = typed;
    h.keysLit(typed);
    await sleep(1200);
    let st = read();
    if (st.promptText !== typed) { await sleep(800); st = read(); }
    if (st.promptText !== typed) {
      why(st.promptRow === null ? 'prompt_line_not_found' : 'prompt_text_mismatch');
      result.notes.push('typed ' + typed + ': the prompt line shows ' + (st.promptText === null ? 'nothing readable' : '"' + st.promptText + '"') + ', not exactly the typed text; pressed nothing');
      await clear();
      continue;
    }
    const tokenRe = typed === spec.typed ? spec.tokenRe : new RegExp('^' + typed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
    let target = pickTarget(st.rows, { tokenRe, descRe: spec.descRe });
    if (st.rows.length === 0) {
      why('no_suggestion_list_visible');
      result.notes.push('typed ' + typed + ': no suggestion list is on the screen, so the highlight cannot be checked; pressed nothing');
      await clear();
      continue;
    }
    if (!target) {
      why('mod_command_not_in_list');
      result.notes.push('typed ' + typed + ': the list holds ' + st.rows.map((x) => x.token).join(', ') + ' and none is the mod command; pressed nothing');
      await clear();
      continue;
    }
    let reachable = false;
    for (let i = 0; i <= st.rows.length + 1; i += 1) {
      target = pickTarget(st.rows, { tokenRe, descRe: spec.descRe });
      if (st.highlightedIndex === null) {
        why('highlight_not_readable');
        result.notes.push('typed ' + typed + ': the highlighted row cannot be read from the screen (' + st.signal + '); pressed nothing');
        break;
      }
      const hi = st.rows[st.highlightedIndex];
      if (target && hi.row === target.row) {
        const shown = st.promptText;
        if (shown === typed || shown === target.token) { reachable = true; result.target = target.token; }
        else {
          why('prompt_text_mismatch');
          result.notes.push('the mod command is highlighted but the prompt line shows "' + shown + '"; pressed nothing');
        }
        break;
      }
      if (i === st.rows.length + 1) break;
      h.keyName('Down');
      result.moves.push('Down');
      await sleep(400);
      st = read();
      if (st.rows.length === 0) { why('no_suggestion_list_visible'); break; }
    }
    if (reachable) {
      if (spec.suffix) {
        h.keysLit(spec.suffix);
        await sleep(500);
        const after = read();
        if (after.promptText !== typed + spec.suffix && after.promptText !== result.target + spec.suffix) {
          why('prompt_text_mismatch');
          result.notes.push('after the suffix the prompt line shows "' + after.promptText + '"; pressed nothing');
          await clear();
          return result;
        }
      }
      h.keyName('Enter');
      result.ok = true;
      result.state = 'sent';
      result.reason = null;
      result.notes.push('typed ' + typed + '; the highlighted row was ' + result.target + (result.moves.length ? ' after ' + result.moves.length + ' Down press(es)' : ' at once') + '; pressed Enter');
      return result;
    }
    why('mod_command_not_reachable');
    result.notes.push('typed ' + typed + ': could not make the mod command the highlighted row (' + result.reason + '); pressed nothing');
    await clear();
  }
  return result;
}

module.exports = { readSlashState, pickTarget, submitSlashSafely };
