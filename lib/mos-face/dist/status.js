import { mindrianDir } from './paths';
// The host text of a Reach that was never made: no Theo host is recorded (brain-prewarm.json), so Theo was
// not checked. probe.ts makes it, and every reader that turns a missing answer into a failure tests for
// it first (Phase 380 plan 19, gap 13): a Theo that was not checked is not a Theo that failed.
export const NO_HOST = 'unknown';
// True only for a check that ran and failed: the host is recorded and it gave no answer or a 5xx.
export const reachFailed = (r) => r.host !== NO_HOST && (r.status === null || r.status >= 500);
// The status line field, its source, the panel field that carries it, and the two labels (wide and
// narrow, at most 14 characters). The entries of one panel field share one pair of labels.
export const STATUS_FIELDS = {
    room: { source: 'host: STATE.md current_room, the room read', panel: 'room', wide: 'ROOM', narrow: 'ROOM' },
    stage: { source: 'host: STATE.md venture_stage', panel: 'room', wide: 'ROOM', narrow: 'ROOM' },
    section: { source: 'host: STATE.md sections table', panel: 'filed', wide: 'FILED', narrow: 'FILED' },
    health: { source: '~/.mindrian/room-health.json', panel: 'health', wide: 'HEALTH', narrow: 'HEALTH' },
    post_update: { source: '~/.mindrian/post-update-restart-pending', panel: 'now', wide: 'NOW', narrow: 'NOW' },
    ctx_pct: { source: 'host: session usage, context percent', panel: 'context', wide: 'Context', narrow: 'CTX' },
    next_move: { source: '~/.mindrian/next-move.json', panel: 'next', wide: 'NEXT MOVE', narrow: 'MOVE' },
    brain: { source: '~/.mindrian/bridge/brain-health.json', panel: 'theo', wide: 'THEO', narrow: 'THEO' },
    voice_glyph: { source: '~/.mindrian/voice-mark.json', panel: 'speaks', wide: 'SPEAKS', narrow: 'VOICE' },
    who: { source: '~/.mindrian/voice-mark.json, current_who', panel: 'speaks', wide: 'SPEAKS', narrow: 'VOICE' },
    agent_label: { source: 'host: agent name, which a mod cannot read; the voice file carries who', panel: 'speaks', wide: 'SPEAKS', narrow: 'VOICE' },
    voice_switched: { source: '~/.mindrian/voice-mark.json, switched_now', panel: 'speaks', wide: 'SPEAKS', narrow: 'VOICE' },
    switch_direction: { source: '~/.mindrian/voice-mark.json, prior_who and current_who', panel: 'speaks', wide: 'SPEAKS', narrow: 'VOICE' },
    stance: { source: '~/.mindrian/stance-state.json', panel: 'stance', wide: 'STANCE', narrow: 'STANCE' },
    stance_forced_color: { source: '~/.mindrian/stance-state.json, the stance color', panel: 'stance', wide: 'STANCE', narrow: 'STANCE' },
    jtbd: { source: 'room: .mindrian/jtbd-state.json, the Job block', panel: 'job', wide: 'JOB', narrow: 'JOB' },
    operator: { source: 'room: .mindrian/conversation-operator.json', panel: 'mode', wide: 'MODE', narrow: 'MODE' },
    version: { source: '~/.mindrian/install-state.json, the running plugin version', panel: 'version', wide: 'VERSION', narrow: 'VER' },
    update_available: { source: '~/.mindrian/update-check.json', panel: 'version', wide: 'VERSION', narrow: 'VER' },
};
// The fields the panel does not carry, each with the reason, checked when the plan was executed.
export const EXCLUDED = {
    focus: 'scripts/statusline-mos prints the focus segment only when the bash variable session_id is set, and nothing in scripts/ sets it, so the segment is dormant; its source is the room database, which the panel does not open (the subprocess was removed in plan 05) and the one tool that reads it would add a fifth tool read to each tick',
    governing_thought: 'the governing thought is the last leg of the Next move; it needs the active section and its reasoning file, which is a second read tree and would pass the budget of 8 local reads for each tick; the panel shows the routed move, then the recorded job, then none yet',
};
// The label pair of one panel field, from the map.
export function labelsOf(panel) {
    for (const entry of Object.values(STATUS_FIELDS))
        if (entry.panel === panel)
            return { wide: entry.wide, narrow: entry.narrow };
    return { wide: panel.toUpperCase(), narrow: panel.toUpperCase() };
}
// A panel-only fact (the status line has no such field): what is stale in the room.
export const STALE_LABELS = { wide: 'STALE', narrow: 'STALE' };
// ---- The local files ----------------------------------------------------------------------------
const COLORS = ['blue', 'red', 'yellow', 'black', 'white'];
// The five canonical moves of the voice mark and the color of each (lib/hmi/voice-color-mark.cjs).
const MOVE_COLOR = { building: 'blue', challenging: 'red', contradiction: 'yellow', gate: 'black', invisibility: 'white' };
// The five squares that open a marked turn.
const SQUARE_COLOR = { '\u{1F7E6}': 'blue', '\u{1F7E5}': 'red', '\u{1F7E8}': 'yellow', '\u{2B1B}': 'black', '\u{2B1C}': 'white' };
const STANCES = ['research', 'tell-act', 'ask', 'redteam'];
const OPERATORS = ['JUST_TALK', 'EXPLORE_CAPTURE', 'BUILD_ROOM', 'METHODOLOGY', 'DECISION_GATE'];
const HEALTHS = ['sound', 'drift', 'broken'];
function parse(text) {
    if (text === null)
        return null;
    try {
        const data = JSON.parse(text);
        return data !== null && typeof data === 'object' && !Array.isArray(data) ? data : null;
    }
    catch {
        return null;
    }
}
const str = (value) => (typeof value === 'string' ? value : '');
// The color of a voice mark, from the color, the move or the lead square of the turn, the way the
// status line reads it. Only the color is kept: the turn text is never held.
function colorOf(data) {
    const color = str(data.color).toLowerCase().trim();
    if (COLORS.includes(color))
        return color;
    const move = MOVE_COLOR[str(data.move).toLowerCase().trim()];
    if (move)
        return move;
    const turn = str(data.turn).replace(/^\s+/, '');
    const squares = [...turn].filter(ch => SQUARE_COLOR[ch] !== undefined);
    const lead = turn === '' ? '' : String.fromCodePoint(turn.codePointAt(0) ?? 0);
    return squares.length === 1 && SQUARE_COLOR[lead] ? (SQUARE_COLOR[lead] ?? '') : '';
}
export function parseVoice(text) {
    const data = parse(text);
    if (data === null)
        return null;
    // The voice file names who speaks: the host voice, or the persona. The panel is Theo's face, so any
    // name that is not the host is the persona, and the panel calls it Theo.
    const side = (name) => (name === '' ? '' : name === 'claude' ? 'claude' : 'theo');
    const prior = side(str(data.prior_who));
    const who = side(str(data.current_who));
    const switched = data.switched_now === true;
    const direction = prior === 'theo' && who === 'claude' ? 'to-claude' : prior === 'claude' && who === 'theo' ? 'to-theo' : '';
    const move = str(data.move).toLowerCase().trim();
    return { color: colorOf(data), move: MOVE_COLOR[move] ? move : '', who, switched, direction };
}
// Read the status line's own local files. Eight small reads, each once, started together; the
// operator file is read only when a room is read. A missing or damaged file gives null for its field.
// Never throws, and nothing is guessed.
export async function readStatusLocal($, roomPath) {
    const dir = await mindrianDir($);
    const get = (path) => $.fs.read(path).then(String, () => null);
    const absent = Promise.resolve(null);
    const [next, brain, pending, voice, stance, update, health, operator] = await Promise.all([
        get(`${dir}/next-move.json`),
        get(`${dir}/bridge/brain-health.json`),
        get(`${dir}/post-update-restart-pending`),
        get(`${dir}/voice-mark.json`),
        get(`${dir}/stance-state.json`),
        get(`${dir}/update-check.json`),
        get(`${dir}/room-health.json`),
        roomPath === '' ? absent : get(`${roomPath}/.mindrian/conversation-operator.json`),
    ]);
    const nextData = parse(next);
    const cue = str(nextData?.next_move).trim();
    const brainData = parse(brain);
    const brainStatus = brainData === null ? null : str(brainData.status) === 'error' ? 'error' : 'ok';
    const stanceData = parse(stance);
    const stanceName = str(stanceData?.stance);
    const updateData = parse(update);
    const available = updateData?.available === true ? str(updateData.available_version) : '';
    const healthName = str(parse(health)?.status);
    const operatorData = parse(operator);
    const operatorName = str(operatorData?.current);
    return {
        at: await $.clock.now(),
        nextMove: cue === '' ? null : cue,
        brain: brainStatus,
        // The touch file counts when it could be read at all, empty or not.
        postUpdate: pending !== null,
        voice: parseVoice(voice),
        stance: STANCES.includes(stanceName) ? stanceName : null,
        update: available === '' ? null : available,
        operator: str(operatorData?.schema_version) === '1.0.0' && OPERATORS.includes(operatorName) ? operatorName : null,
        health: HEALTHS.includes(healthName) ? healthName : null,
    };
}
// The context band of the status line: below 50 percent ok, 50 to 79 watch, 80 and over the cliff.
// The words carry the band; color does not. The bar is ASCII.
export function contextBand(percent) {
    if (percent === undefined || Number.isNaN(percent))
        return { band: 'none', words: 'waiting', bar: () => '' };
    const band = percent >= 80 ? 'cliff' : percent >= 50 ? 'watch' : 'ok';
    const words = band === 'cliff' ? 'cliff, file this insight before the context is compacted' : band;
    const bar = (width) => {
        const full = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width);
        return `[${'#'.repeat(full)}${'-'.repeat(width - full)}]`;
    };
    return { band, words, bar };
}
// The health word. A restart pending after an update escalates a sound room to drift, as the status
// line does; a room health file that was not read says so.
export function healthWord(status, postUpdate) {
    if (postUpdate && (status === null || status === 'sound'))
        return 'drift';
    return status === null ? 'not read' : status;
}
// The next move: Theo's own first command when it is fresh, else the move the router left for the
// status line, else the recorded job, else two hyphens (the status line's "--"), said in words.
export function nextMove(theo, routed, job) {
    if (theo !== null && theo !== '')
        return { value: theo, words: `${theo} (from Theo)`, source: 'theo' };
    if (routed !== null && routed !== '')
        return { value: routed, words: `${routed} (routed)`, source: 'routed' };
    if (job !== '')
        return { value: job, words: `${job} (your recorded job)`, source: 'job' };
    return { value: '--', words: 'none yet', source: 'none' };
}
// Whether Theo is on, as the status line means it: the Theo health file says error, or not. With no
// such file the reach check of the panel answers; with neither, it was not read.
export function theoWord(brain, reachStatus) {
    if (brain === 'error')
        return 'off';
    if (brain === 'ok')
        return 'on';
    if (reachStatus === null)
        return 'not read';
    return reachStatus >= 500 ? 'off' : 'on';
}
const COLOR_WORD = {
    blue: 'building',
    red: 'challenging',
    yellow: 'contradiction',
    black: 'your decision',
    white: 'handover',
};
// Who speaks and the move of the last mark, in words. The panel is Theo's face, so the persona voice
// is called Theo; the host voice is called Claude. Empty when the voice file says nothing.
export function voiceWord(voice) {
    if (voice === null)
        return '';
    const color = voice.color !== '' ? voice.color : (MOVE_COLOR[voice.move] ?? '');
    const word = COLOR_WORD[color] ?? '';
    if (voice.switched && voice.direction === 'to-claude')
        return 'Claude, just switched from Theo';
    if (voice.switched && voice.direction === 'to-theo')
        return word !== '' ? `Theo, just switched back, ${word}` : 'Theo, just switched back';
    if (voice.who === 'claude')
        return 'Claude, not Theo';
    if (word === '' && voice.who === '')
        return '';
    return word !== '' ? `Theo, ${word}` : 'Theo';
}
export function stanceWord(stance) {
    if (stance === null)
        return '';
    return stance === 'tell-act' ? 'tell and act' : stance === 'redteam' ? 'red team' : stance;
}
// The mode (the conversation operator). The default, just talk, is not shown, as on the status line.
export function modeWord(operator) {
    if (operator === null || operator === 'JUST_TALK')
        return '';
    return operator.toLowerCase().replace(/_/g, ' ');
}
// The version the plugin runs, and an available update when it differs from it.
export function versionWord(active, update) {
    if (active === 'unknown' || active === '')
        return 'not read';
    return update !== null && update !== active ? `${active}, update ${update} is available` : active;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// The room and filing facts: the room read and its stage, the entries filed and the sections, what is
// stale, and the health of the room. A room that was not read says so.
export function roomFacts(snap, local, bound = null) {
    const r = snap?.room ?? null;
    const stale = r === null ? 'not read' : r.stale.length === 0 ? 'nothing' : `${r.stale.map(one => one.section).slice(0, 4).join(', ')}${r.stale.length > 4 ? ` and ${r.stale.length - 4} more` : ''}`;
    const entries = r === null ? '' : r.entries === null || Number.isNaN(r.entries) ? 'entries not counted' : plural(r.entries, 'entry', 'entries');
    // The room read is not the bound one: the tools say bound false (the registry's active room is shown), or on
    // the files path no record binds this session. A different room that is bound keeps its own words.
    const unbound = r !== null && (snap?.binding ? !snap.binding.bound : bound === null);
    const other = bound !== null && r !== null && bound !== r.slug;
    const qualifier = other ? ', not the room this session writes to' : unbound ? ', not bound' : '';
    return [
        { id: 'room', value: r === null ? 'not read' : `${r.stage === '' || r.stage === 'unknown' ? `${r.slug}, stage unknown` : `${r.slug}, ${r.stage} stage`}${qualifier}`, strong: false },
        { id: 'filed', value: r === null ? 'not read' : `${entries} in ${plural(r.sections.length, 'section', 'sections')}`, strong: false },
        { id: 'stale', value: stale, strong: r !== null && r.stale.length > 0 },
        { id: 'health', value: healthWord(local?.health ?? null, local?.postUpdate === true), strong: false },
    ];
}
// The plugin facts, after the job: whether Theo is on, who speaks, the stance, the mode and the version.
// Voice, stance and mode appear only when set, as on the status line.
export function pluginFacts(snap, local) {
    const out = [{ id: 'theo', value: theoWord(local?.brain ?? null, snap?.theo.status ?? null), strong: false }];
    const voice = voiceWord(local?.voice ?? null);
    if (voice !== '')
        out.push({ id: 'speaks', value: voice, strong: false });
    const stance = stanceWord(local?.stance ?? null);
    if (stance !== '')
        out.push({ id: 'stance', value: stance, strong: false });
    const mode = modeWord(local?.operator ?? null);
    if (mode !== '')
        out.push({ id: 'mode', value: mode, strong: false });
    out.push({ id: 'version', value: versionWord(snap?.pluginActive ?? 'unknown', local?.update ?? null), strong: false });
    return out;
}
// The label of a fact, wide or narrow.
export function factLabel(id, narrow) {
    const pair = id === 'stale' ? STALE_LABELS : labelsOf(id);
    return narrow ? pair.narrow : pair.wide;
}
