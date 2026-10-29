// 380-15 status parity gate (D-08, MOD380-07, T-380-59 to T-380-63).
//
// The claim: every field the plugin status line can print has a panel field, and a field added to
// the status line later fails this test until it is mapped.
//
// Legs:
//   P1  the field list is built from the status line's own code, not typed here: the keys of
//       collectSignals (lib/statusline/cockpit-signals.cjs), the keys and assignments of rowState and
//       the segment names of scripts/context-monitor, and the focus segment of scripts/statusline-mos.
//       Each name must be a key of STATUS_FIELDS or an entry of EXCLUDED with a reason (hooks/status.ts).
//       An exclusion for a name that is no longer in the status line fails. A segment name that this
//       test does not know fails (a new segment must be mapped first).
//   P2  the map has a good shape: each entry names its source, its panel field, a wide label and a
//       narrow label of at most 14 characters; the labels of different panel fields differ; the entries
//       of one panel field share one label pair.
//   P3  the real status line runs on a fixture home (formats the plugin's own readers accept) and the
//       line it prints holds the fixture values. Three runs: healthy, drift with a post-update restart
//       pending, and the context cliff. The printed lines go in the SUMMARY.
//   P11 the focus segment is dormant: scripts/statusline-mos prints it only when a bash variable
//       session_id is set, and nothing in scripts/ assigns that variable.
// CJS, Node built-ins only. Hermetic: no network. The fixture home is made under the system temp folder.
// Hyphens only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mos-face');
const MONITOR = path.join(REPO, 'scripts', 'context-monitor');
const WRAPPER = path.join(REPO, 'scripts', 'statusline-mos');
const SIGNALS = path.join(REPO, 'lib', 'statusline', 'cockpit-signals.cjs');
const STATUS_TS = path.join(MOD, 'hooks', 'status.ts');

let passed = 0;
let failed = 0;
function say(s) { process.stdout.write(s + '\n'); }
function check(cond, msg) {
  if (cond) { passed += 1; say('  ok ' + msg); } else { failed += 1; say('  FAIL ' + msg); }
}

// ---- The fixture home -----------------------------------------------------------------------------
// One scratch root holds a HOME with the status line's own files and a rooms folder with one room. The
// builder lives in the capture harness (ui/mos-face/scripts/lib/tmux-session.cjs), so the screenshot run
// and this test use the same files, in the formats the plugin's own readers accept.
const { buildStatusFixture } = require(path.join(MOD, 'scripts', 'lib', 'tmux-session.cjs'));

// Run the real status line on a fixture and return its line, with ANSI removed and the home scrubbed.
function runStatusLine(fx, pct) {
  const input = JSON.stringify({ model: { display_name: 'M' }, workspace: { current_dir: fx.rooms }, context_window: { used_percentage: pct } });
  const r = spawnSync(process.execPath, [MONITOR], { input, encoding: 'utf8', env: Object.assign({}, process.env, { HOME: fx.home, USERPROFILE: fx.home }) });
  return String(r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '').split(fx.home).join('<home>');
}

if (require.main !== module) {
  module.exports = { runStatusLine };
  return;
}

// ---- P1 the field list, from the status line's own code ----------------------------------------------
say('P1 the status line fields, enumerated from its code');
const ALIAS = { current_version: 'version', brain_tier: 'brain', update_available_version: 'update_available' };
const SEGMENT_FIELD = { jtbdSeg: 'jtbd', operatorSeg: 'operator', verSuffix: 'version', focus_segment: 'focus' };
const norm = name => ALIAS[name] || name;

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos380-parity-'));
const probeFx = buildStatusFixture(path.join(scratch, 'probe'));
const keysOut = spawnSync(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(Object.keys(require(process.argv[1]).collectSignals({}))))', SIGNALS],
  { encoding: 'utf8', env: Object.assign({}, process.env, { HOME: probeFx.home, USERPROFILE: probeFx.home }) });
const signalKeys = JSON.parse(keysOut.stdout || '[]');

const monitor = fs.readFileSync(MONITOR, 'utf8');
const wrapper = fs.readFileSync(WRAPPER, 'utf8');
const literal = /const rowState = \{([\s\S]*?)\n    \};/.exec(monitor);
const rowKeys = literal ? [...literal[1].matchAll(/^\s+([a-z_]+):/gm)].map(m => m[1]) : [];
const rowAssigned = [...monitor.matchAll(/\browState\.([a-z_]+)\s*=(?!=)/g)].map(m => m[1]);
const segmentNames = [...monitor.matchAll(/\bconst\s+([A-Za-z]+Seg|verSuffix)\s*=/g)].map(m => m[1]);
const wrapperSegments = [...wrapper.matchAll(/\b([a-z_]*_segment)=/g)].map(m => m[1]);

check(signalKeys.length >= 13, 'collectSignals returns ' + signalKeys.length + ' keys: ' + signalKeys.join(', '));
check(rowKeys.length >= 8, 'the rowState literal holds ' + rowKeys.length + ' keys: ' + rowKeys.join(', '));
check(segmentNames.length >= 3, 'context-monitor names the segments: ' + segmentNames.join(', '));
check(wrapperSegments.includes('focus_segment'), 'statusline-mos names focus_segment');
// Only a segment that reaches a process.stdout.write argument is printed. mintoSeg and dialSeg are built
// into roomInfo, and roomInfo is never written (the single navigator line replaced it, 2026-06-29): they
// are dormant, so they are not fields. A printed segment that this test does not know fails.
const writes = [...monitor.matchAll(/process\.stdout\.write\(([^;]*)\);/g)].map(m => m[1]);
const printedIdents = new Set(writes.flatMap(w => w.match(/[A-Za-z_]+/g) || []));
const printedSegments = segmentNames.filter(n => printedIdents.has(n));
const dormantSegments = segmentNames.filter(n => !printedIdents.has(n));
check(!printedIdents.has('roomInfo'), 'roomInfo is never written, so the segments built into it are dormant: ' + dormantSegments.join(', '));
const unknownSegments = [...printedSegments, ...wrapperSegments].filter(n => !SEGMENT_FIELD[n]);
check(unknownSegments.length === 0, 'every printed segment name is known to this test (a new one must be mapped first)' + (unknownSegments.length ? ': ' + unknownSegments.join(', ') : ''));

const found = new Set();
for (const n of [...signalKeys, ...rowKeys, ...rowAssigned]) found.add(norm(n));
for (const n of [...printedSegments, ...wrapperSegments]) if (SEGMENT_FIELD[n]) found.add(SEGMENT_FIELD[n]);
for (const must of ['room', 'health', 'post_update', 'ctx_pct', 'next_move', 'brain', 'voice_glyph', 'who', 'agent_label', 'voice_switched',
  'switch_direction', 'stance', 'stance_forced_color', 'jtbd', 'operator', 'version', 'focus']) {
  check(found.has(must), 'the enumeration holds ' + must);
}

// ---- hooks/status.ts: STATUS_FIELDS and EXCLUDED, read from the source --------------------------------
let FIELDS = null;
let EXCLUDED = null;
let loadError = '';
try {
  const mod = require('node:module');
  const src = fs.readFileSync(STATUS_TS, 'utf8');
  const stripped = mod.stripTypeScriptTypes(src, { mode: 'strip' })
    .replace(/^\s*import\b[^;\n]*;?\s*$/gm, '')
    .replace(/^export\s+(async\s+)?(const|function)\s/gm, '$1$2 ')
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(stripped + '\nthis.STATUS_FIELDS = STATUS_FIELDS; this.EXCLUDED = EXCLUDED;', ctx, { filename: 'status.ts' });
  FIELDS = ctx.STATUS_FIELDS;
  EXCLUDED = ctx.EXCLUDED;
} catch (e) {
  loadError = String(e && e.message ? e.message : e).split('\n')[0];
}
check(FIELDS !== null && EXCLUDED !== null, 'hooks/status.ts exports STATUS_FIELDS and EXCLUDED' + (loadError ? ' (' + loadError + ')' : ''));

if (FIELDS !== null && EXCLUDED !== null) {
  const mapped = Object.keys(FIELDS);
  const excluded = Object.keys(EXCLUDED);
  const missing = [...found].filter(n => !mapped.includes(n) && !excluded.includes(n));
  check(missing.length === 0, 'every status line field is mapped or excluded' + (missing.length ? ': missing ' + missing.join(', ') : ''));
  const both = mapped.filter(n => excluded.includes(n));
  check(both.length === 0, 'no field is both mapped and excluded' + (both.length ? ': ' + both.join(', ') : ''));
  const emptyReason = excluded.filter(n => typeof EXCLUDED[n] !== 'string' || EXCLUDED[n].trim().length < 20);
  check(emptyReason.length === 0, 'every exclusion has a reason' + (emptyReason.length ? ': ' + emptyReason.join(', ') : ''));
  const gone = [...mapped, ...excluded].filter(n => !found.has(n));
  check(gone.length === 0, 'no map entry names a field the status line no longer has' + (gone.length ? ': ' + gone.join(', ') : ''));

  // ---- P2 map shape ---------------------------------------------------------------------------------
  say('P2 the map has a good shape');
  const bad = mapped.filter(n => {
    const f = FIELDS[n];
    return !f || ['source', 'panel', 'wide', 'narrow'].some(k => typeof f[k] !== 'string' || f[k].trim() === '') || f.narrow.length > 14 || f.wide.length > 14;
  });
  check(bad.length === 0, 'each entry has a source, a panel field, a wide label and a narrow label of at most 14 characters' + (bad.length ? ': ' + bad.join(', ') : ''));
  const byPanel = {};
  for (const n of mapped) (byPanel[FIELDS[n].panel] = byPanel[FIELDS[n].panel] || []).push(n);
  const split = Object.keys(byPanel).filter(p => new Set(byPanel[p].map(n => FIELDS[n].wide + '|' + FIELDS[n].narrow)).size !== 1);
  check(split.length === 0, 'the entries of one panel field share one label pair' + (split.length ? ': ' + split.join(', ') : ''));
  const wides = Object.keys(byPanel).map(p => FIELDS[byPanel[p][0]].wide);
  const narrows = Object.keys(byPanel).map(p => FIELDS[byPanel[p][0]].narrow);
  check(new Set(wides).size === wides.length, 'wide labels are unique across panel fields: ' + wides.join(', '));
  check(new Set(narrows).size === narrows.length, 'narrow labels are unique across panel fields: ' + narrows.join(', '));
  const sources = mapped.filter(n => !/\.(json|md)|pending|host|signal|STATE/.test(FIELDS[n].source));
  check(sources.length === 0, 'each source names a file or a signal' + (sources.length ? ': ' + sources.join(', ') : ''));
}

// ---- P11 the focus segment is dormant ------------------------------------------------------------------
say('P11 the focus segment is dormant');
const scripts = fs.readdirSync(path.join(REPO, 'scripts')).filter(n => { try { return fs.statSync(path.join(REPO, 'scripts', n)).isFile(); } catch (_e) { return false; } });
const assigners = [];
for (const n of scripts) {
  let text = '';
  try { text = fs.readFileSync(path.join(REPO, 'scripts', n), 'utf8'); } catch (_e) { continue; }
  if (text.length > 400000) continue;
  if (/^\s*(export\s+)?session_id=/m.test(text) || /^\s*read\s+(-r\s+)?[^\n]*\bsession_id\b/m.test(text)) assigners.push(n);
}
check(/\[ -n "\$\{session_id:-\}" \]/.test(wrapper), 'the wrapper prints the focus segment only when the variable session_id is set');
check(assigners.length === 0, 'no script in scripts/ assigns the variable session_id' + (assigners.length ? ': ' + assigners.join(', ') : ''));
check(/openRoomDb|getActiveFocus/.test(wrapper), 'its source is the room database (the panel does not open it)');

// ---- P3 the real status line on a fixture home ----------------------------------------------------------
say('P3 the real status line, on a fixture home');
const pkg = JSON.parse(fs.readFileSync(path.join(REPO, '.claude-plugin', 'plugin.json'), 'utf8'));
const healthy = runStatusLine(buildStatusFixture(path.join(scratch, 'a')), 62);
say('  line A (healthy, 62 percent): ' + healthy);
check(healthy.includes('demo-room'), 'A holds the room name');
check(healthy.includes('Next: map unknowns'), 'A holds the next move text');
check(healthy.includes('62%'), 'A holds the percent 62');
check(healthy.includes('v' + pkg.version), 'A holds the version v' + pkg.version);
check(healthy.includes('\u{1F9E0}on'), 'A holds the Theo chip');
check(healthy.includes('[redteam]'), 'A holds the stance chip');
check(healthy.includes('find-bottleneck') && healthy.includes('BUILD_ROOM'), 'A holds the recorded job and the mode');

const drift = runStatusLine(buildStatusFixture(path.join(scratch, 'b'), { health: 'drift', postUpdate: true }), 62);
say('  line B (drift and a restart pending, 62 percent): ' + drift);
check(drift.includes('-> run /mos:doctor --fix') && drift.includes('demo-room'), 'B holds the doctor fix and the room name');
// Root cause of the plan note: at drift the status line replaces the Next move, the Theo chip and the
// stance chip with the fix. The panel keeps all of them, so it shows more than the line does here.
check(!drift.includes('Next:') && !drift.includes('[redteam]'), 'B drops Next and the stance chip (the panel keeps them)');

// Quick 261029-pnl: the post_update signal is the failed session-start verification (Phase 341-08), not a
// touch-file. On a SOUND room with a failed verification the real status line still shows the fix, so the
// fixture state file is what the plugin reads, and the panel reads the same file.
const verifyOnly = runStatusLine(buildStatusFixture(path.join(scratch, 'b2'), { health: 'sound', postUpdate: true }), 62);
say('  line B2 (sound room, failed verification, 62 percent): ' + verifyOnly);
check(verifyOnly.includes('-> run /mos:doctor --fix'), 'B2 a failed verification alone puts the doctor fix on the line');
const panelSource = fs.readFileSync(STATUS_TS, 'utf8');
check(/post_update:\s*\{\s*source:\s*'~\/\.mindrian\/session-verify\/state\.json/.test(panelSource), 'the panel maps post_update to the session-verify state file');
check(!/post-update-/.test(panelSource + fs.readFileSync(path.join(MOD, 'scripts', 'lib', 'tmux-session.cjs'), 'utf8')), 'neither the panel source nor its fixture names the retired touch-file');

const cliff = runStatusLine(buildStatusFixture(path.join(scratch, 'c')), 85);
say('  line C (the cliff, 85 percent): ' + cliff);
check(cliff.includes('file this insight') && cliff.includes('85%'), 'C holds the file-this-insight words and the percent');

fs.rmSync(scratch, { recursive: true, force: true });
say(passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
