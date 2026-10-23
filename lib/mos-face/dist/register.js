import { atom, read, update } from 'claude-code';
import { askTheo, classify, frameFor, situationOf, subjectOf, thinkPrompt, wordsForNoted, wordsStartOn, wordsTexts } from './advice';
import { boundRoom } from './bind';
import { WHY } from './commands';
import { gaugeText } from './gauge';
import { FIX_COMMAND, compactJob, guessJob, jobLine, jobRows, jobShown, readJob } from './job';
import { JOBS } from './jobs';
import { workspaceOf } from './paths';
import { PROPOSALS } from './proposals';
import { noteOf, sentRow, sentText } from './sent';
import { BLUE, INK, LABEL, LINE_FACE, MOVE_BG, MOVE_FG, MUTED, PAPER, gridRuns, moveOf, } from './face';
import { stateFor, stateForLead } from './face-events';
import { clock, fit, nowLine, panelLights, plain, recommend, stateBlocks, stateText, statusText, suggestionText } from './lines';
import { contextCanvas } from './meter';
import { isPanelReading, readRoom, resetReach } from './source';
import { contextBand, factLabel, nextMove, pluginFacts, readStatusLocal, roomFacts } from './status';
import { loadFaceAsset, rasterFace, readFaceAsset } from './theo-face';
import { THEO_CALL_THOUGHTS, THEO_EMPTY, THEO_FAILED, THOUGHTS, glossaryWords } from './voice';
// /m:os face - the Theo face, a side-panel dashboard, a context meter and a
// Theo call monitor, ruled by the mos-brand book (Canon v5).
//
// Rules taken from the book and kept here:
// - The panel sits on the paper ground with ink text and secondary ink for
//   asides, so contrast does not depend on the terminal theme.
// - Every Button sits on an ink ground; its label color is the host's.
// - Color never carries meaning alone: each colored block has words beside it.
// - In Theo's face the colors are the voice vocabulary (blue building, red
//   challenging, yellow contradiction or reframe, black human decision, white
//   handover). The face is an illustration of real events, never proof.
// - Theo receives a framework name and a problem type only, never the talk.
const PANE = 'mos-state';
// Below this many columns the panel says so, instead of drawing a broken layout.
const MIN_PANE = 30;
const emptyTotals = { total: 0, ok: 0, empty: 0, error: 0, blocked: 0 };
const noAdvice = {
    status: 'idle',
    at: 0,
    turn: 0,
    handle: '',
    framework: '',
    commands: [],
    whys: [],
    framings: [],
    matched: [],
    sent: '',
    delivery: { kind: 'none' },
    question: '',
    guided: '',
    note: '',
};
// The state owner is the plugin that ships this module. In source it is mos-face, so a dev run
// (claude --plugin-dir ui/mos-face) does not replace the installed mos plugin. The shipped plugin is
// named mos, and the engine lets only the owner write a value, so scripts/build-mos-face.cjs rewrites
// the owner from mos-face to mos in lib/mos-face/dist (register module and types) and fails the build
// on a leftover. The engine needs the plugin and key as literals in source, so the name cannot sit in
// a constant.
const face = atom({ plugin: 'mos', key: 'face' }, 'rest');
const detail = atom({ plugin: 'mos', key: 'detail' }, '');
const mos = atom({ plugin: 'mos', key: 'mos' }, 0);
const move = atom({ plugin: 'mos', key: 'move' }, 'none');
const frame = atom({ plugin: 'mos', key: 'frame' }, 0);
const isHidden = atom({ plugin: 'mos', key: 'isHidden' }, false);
const isChipOff = atom({ plugin: 'mos', key: 'isChipOff' }, false);
const style = atom({ plugin: 'mos', key: 'style' }, 'tile');
const spoken = atom({ plugin: 'mos', key: 'spoken' }, 0);
const theo = atom({ plugin: 'mos', key: 'theo' }, []);
const theoTurn = atom({ plugin: 'mos', key: 'theoTurn' }, emptyTotals);
const theoTotals = atom({ plugin: 'mos', key: 'theoTotals' }, emptyTotals);
const flag = atom({ plugin: 'mos', key: 'flag' }, '');
const isSuggestOff = atom({ plugin: 'mos', key: 'isSuggestOff' }, false);
const snap = atom({ plugin: 'mos', key: 'snap' }, null);
const isRefreshing = atom({ plugin: 'mos', key: 'isRefreshing' }, false);
const advice = atom({ plugin: 'mos', key: 'advice' }, noAdvice);
const isAutoOff = atom({ plugin: 'mos', key: 'isAutoOff' }, false);
const paneAsked = atom({ plugin: 'mos', key: 'paneAsked' }, false);
const bound = atom({ plugin: 'mos', key: 'bound' }, null);
const boundHow = atom({ plugin: 'mos', key: 'boundHow' }, '');
const workspace = atom({ plugin: 'mos', key: 'workspace' }, '');
const isPlain = atom({ plugin: 'mos', key: 'isPlain' }, false);
// The owner allows the panel to send a cleaned excerpt of the person's own recent words to
// Theo (opt out any time). Held in memory for this session only: a new session starts with
// the excerpt on, unless MOS_FACE_WORDS=off is set (proposal envSwitch, hooks/proposals.ts).
const wordsOn = atom({ plugin: 'mos', key: 'wordsOn' }, true);
const refreshNote = atom({ plugin: 'mos', key: 'refreshNote' }, '');
const openSection = atom({ plugin: 'mos', key: 'openSection' }, '');
const openBlock = atom({ plugin: 'mos', key: 'openBlock' }, '');
const sectionFiles = atom({ plugin: 'mos', key: 'sectionFiles' }, []);
const freshNames = atom({ plugin: 'mos', key: 'freshNames' }, []);
const lit = atom({ plugin: 'mos', key: 'lit' }, {});
const litWhy = atom({ plugin: 'mos', key: 'litWhy' }, {});
// The canon face asset as checked text (an empty string when it could not be read), and the plain
// sentence that says so. Read once at session start through the engine (Phase 380 plan 13, D-10).
const faceAsset = atom({ plugin: 'mos', key: 'faceAsset' }, '');
const faceAssetNote = atom({ plugin: 'mos', key: 'faceAssetNote' }, '');
// The Job line (plan 14, D-09): the compact text of the room's recorded job, read once for each refresh
// tick (an empty string when there is none); whether the person hid the line; and the job it was hidden
// for. An empty jobHiddenFor means hidden whatever the job is (the /mos-job toggle).
const jobRecord = atom({ plugin: 'mos', key: 'jobRecord' }, '');
const jobHidden = atom({ plugin: 'mos', key: 'jobHidden' }, false);
const jobHiddenFor = atom({ plugin: 'mos', key: 'jobHiddenFor' }, '');
// The status line's own local files, read once for each refresh tick (plan 15, D-08). Null before the first
// read. Nothing reads them in a prompt or turn hook.
const statusLocal = atom({ plugin: 'mos', key: 'statusLocal' }, null);
// ---- Helpers ----------------------------------------------------------------
const THEO_TOOL = /^mcp__(theo|theo-context|claude_ai_Theo-Claude|plugin_mos_mindrian-brain)__/;
const MOS_TOOL = /^mcp__plugin_mos_mindrian-os__/;
const EMPTY_RESULT = /^\s*(\[\s*\]|\{\s*\}|no (matches|results|files)( found)?\.?)\s*$/i;
const MENTIONS_THEO = /\bTheo\b/;
// The lead of a reply: one move glyph (group 1) and the marker text the reply wrote (group 2). The chip
// quotes group 2 as it stands (D-07), so this pattern is the only place the persona's own words are named.
const LEAD = /^\s*(🟦|🟥|🟨|⬛|⬜)️?\s*\**(Larry \| MindrianOS)\**/;
const SPIN = ['-', '\\', '|', '/'];
const STYLES = ['tile', 'mini', 'line'];
function theoVia(name) {
    if (name.startsWith('mcp__theo-context__'))
        return 'Theo (context)';
    if (name.startsWith('mcp__claude_ai_Theo-Claude__'))
        return 'Theo (Claude app)';
    if (name.startsWith('mcp__plugin_mos_mindrian-brain__'))
        return 'Theo (through /m:os)';
    return 'Theo';
}
function toolName(name) {
    const parts = name.replace(/^mcp__/, '').split('__');
    return parts.length > 1 ? parts[parts.length - 1] ?? name : name;
}
function shortTool(name) {
    const parts = name.replace(/^mcp__/, '').split('__');
    const server = (parts[0] ?? '').replace(/^plugin_/, '');
    const tool = parts.length > 1 ? parts.slice(1).join('.') : '';
    const text = tool ? `${server}: ${tool}` : server;
    return text.length > 44 ? `${text.slice(0, 43)}~` : text;
}
function seconds(ms) {
    if (ms === null)
        return '...';
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}
function countText(t) {
    const parts = [];
    if (t.ok)
        parts.push(`${t.ok} ok`);
    if (t.empty)
        parts.push(`${t.empty} empty`);
    if (t.error)
        parts.push(`${t.error} error`);
    if (t.blocked)
        parts.push(`${t.blocked} blocked`);
    return parts.join(', ');
}
// A pick that walks the list with a stride coprime to its length, so a line
// does not return for a whole lap, and a salt so two lists do not move in step.
function pickVaried(list, n, salt) {
    const len = list.length;
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const stride = [7, 5, 3, 1].find(k => gcd(k, len) === 1) ?? 1;
    return list[(((salt + n * stride) % len) + len) % len];
}
// The canon asset, parsed once for each text it comes from (the atom holds the text).
let parsedText = '';
let parsedAsset = null;
function assetOf(text) {
    if (text === '')
        return null;
    if (text !== parsedText) {
        parsedAsset = loadFaceAsset(text);
        parsedText = text;
    }
    return parsedAsset;
}
// The runs of one face, n by n cells, drawn from the canon asset. Empty when n is 0 or the asset is
// missing: the panel then shows the words-only line face. It never draws numbers typed by hand.
function faceRuns(text, id, n) {
    const asset = assetOf(text);
    if (asset === null || n === 0)
        return [];
    const grid = rasterFace(asset, id, n);
    return grid === null ? [] : gridRuns(grid);
}
// The size of the tile in the box above the prompt, by style: tile 12, mini 6, line none.
const bandSize = (style) => (style === 'line' ? 0 : style === 'mini' ? 6 : 12);
// ---- The module -------------------------------------------------------------
// ---- State and helpers live at the top of the file: the engine only lets a
// function that receives $ be declared here, never inside register.
let spin;
let back;
let poll;
let lastToastAt = 0;
let autoInFlight = false;
let lastUser = '';
let recentUser = [];
let lastAnswer = '';
let turnsDone = 0;
let lastAskAt = 0;
let refreshStartedAt = 0;
let seenFrameworks = [];
let seenCommands = [];
let flash;
let flashStop;
const stopSpin = () => {
    spin?.cancel();
    spin = undefined;
};
const stopBack = () => {
    back?.cancel();
    back = undefined;
};
// A section of the room that just changed is lit: it flashes for a few seconds,
// then stays marked, with words, until it is opened or ten minutes pass.
const LIT_FLASH_MS = 9000;
const LIT_KEEP_MS = 600000;
const agoText = (ms, now) => {
    const s = Math.max(0, Math.round((now - ms) / 1000));
    if (s < 60)
        return `${s}s ago`;
    if (s < 3600)
        return `${Math.round(s / 60)}m ago`;
    return `${Math.round(s / 3600)}h ago`;
};
const markLit = async ($, section, why) => {
    try {
        const now = await $.clock.now();
        await update($, lit, m => ({ ...m, [section]: now }));
        await update($, litWhy, m => ({ ...m, [section]: why }));
        if (!flash) {
            flash = $.clock.every(400, () => {
                void update($, frame, n => n + 1);
            });
        }
        flashStop?.cancel();
        flashStop = $.clock.after(LIT_FLASH_MS, () => {
            flash?.cancel();
            flash = undefined;
            $.ui.invalidate('ui.render');
        });
        $.ui.invalidate('ui.render');
    }
    catch {
        // marking is a courtesy
    }
};
// Which part of the room did a finished tool call touch? Only real signals:
// the filing tools name their section, and a write names its file.
const noteChange = async ($, input) => {
    try {
        const tool = input.tool;
        if (tool === 'mcp__plugin_mos_mindrian-os__artifact_file' && typeof input.section === 'string' && input.section !== '') {
            await markLit($, input.section, 'artifact filed');
            return;
        }
        if (/^mcp__plugin_mos_mindrian-os__(claim_write|graph_write|meeting|room_content)$/.test(tool)) {
            await markLit($, '(graph)', 'a claim or an edge was written');
            return;
        }
        if ((tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit') && typeof input.file_path === 'string') {
            const snapshot = await read($, snap);
            const root = snapshot?.room?.path ?? '';
            if (root !== '' && input.file_path.startsWith(`${root}/`)) {
                const rel = input.file_path.slice(root.length + 1);
                const top = rel.split('/')[0] ?? '';
                if (rel.includes('/') && top !== '' && !top.startsWith('.'))
                    await markLit($, top, 'a file was written');
            }
        }
    }
    catch {
        // marking is a courtesy
    }
};
// What the Job line shows now, from memory only: the recorded job, else a cue match over the person's
// recent prompts, and whether the person hid it. No read, no call.
const jobNow = async ($) => {
    const now = await $.clock.now();
    const record = readJob(await read($, jobRecord), now);
    const guess = record ? null : guessJob(recentUser, JOBS);
    const id = jobShown(record, guess);
    const hiddenFor = await read($, jobHiddenFor);
    const isHidden2 = (await read($, jobHidden)) && (hiddenFor === '' || hiddenFor === id);
    return { record, guess, id, isHidden: isHidden2 };
};
// One pinned line under the prompt, in words. A fallback that does not depend
// on the panel or the band being drawn.
const pin = async ($) => {
    try {
        const snapshot = await read($, snap);
        const input = {
            snap: snapshot,
            bound: await read($, bound),
            boundHow: await read($, boundHow),
            workspace: await read($, workspace),
            advice: await read($, advice),
            totals: await read($, theoTotals),
            calls: await read($, theo),
            now: await $.clock.now(),
            width: 60,
            local: await read($, statusLocal),
        };
        $.ui.status(statusText(input));
    }
    catch {
        // the pinned line is a courtesy
    }
};
// A read that does not come back must not block every later one.
const withTimeout = ($, work, ms) => new Promise((resolve, reject) => {
    const timer = $.clock.after(ms, () => reject(new Error('the read took too long')));
    work.then(value => {
        timer.cancel();
        resolve(value);
    }, error => {
        timer.cancel();
        reject(error);
    });
});
// A read that is slow, or that fails, backs the next gentle reads off: 2x, then 4x, then 8x of the
// tick, never more than ten minutes. A quick read resets the wait. The person's own refresh always
// reads, and its result counts the same way. A starved machine is not hammered.
const TICK_MS = 120000;
const SLOW_READ_MS = 8000;
const BACKOFF_CAP_MS = 600000;
let slowStreak = 0;
let slowUntil = 0;
const backOff = (ended, wasSlow) => {
    if (!wasSlow) {
        slowStreak = 0;
        slowUntil = 0;
        return;
    }
    slowStreak = Math.min(slowStreak + 1, 3);
    slowUntil = ended + Math.min(TICK_MS * 2 ** slowStreak, BACKOFF_CAP_MS);
};
// force: the person asked, so read now. askReach: ask Theo and the website again whatever their age.
const refresh = async ($, force = true, askReach = force) => {
    try {
        const started = await $.clock.now();
        // Polls and turn ends ask gently; the person's Refresh always reads.
        if (!force) {
            if (started < slowUntil)
                return;
            const last = await read($, snap);
            if (last && started - last.at < TICK_MS)
                return;
        }
        if (await read($, isRefreshing)) {
            if (started - refreshStartedAt < 45000)
                return;
        }
        refreshStartedAt = started;
        await update($, isRefreshing, () => true);
        let failed = false;
        try {
            const before = await read($, snap);
            const snapshot = await withTimeout($, readRoom($, askReach), 30000).catch(error => {
                failed = true;
                throw error;
            });
            await update($, snap, () => snapshot);
            // The room's recorded job: one small local file, read inside the same tick, with a cut-off of its
            // own. Nothing is read at prompt time, and only the fields of the current job are kept.
            const jobPath = snapshot.room?.path ?? '';
            const jobText = jobPath === '' ? '' : await withTimeout($, $.fs.read(`${jobPath}/.mindrian/jtbd-state.json`).then(String), 4000).catch(() => '');
            await update($, jobRecord, () => compactJob(jobText));
            // The status line's own local files: eight small reads, started together, with a cut-off of their own.
            // When the cut-off hits, the last good reading stays.
            const local = await withTimeout($, readStatusLocal($, jobPath), 4000).catch(() => null);
            if (local !== null)
                await update($, statusLocal, () => local);
            if (before?.room && snapshot.room && before.room.slug === snapshot.room.slug) {
                for (const sec of snapshot.room.sections) {
                    const prev = before.room.sections.find(one => one.name === sec.name);
                    if (prev && sec.files > prev.files)
                        await markLit($, sec.name, 'a new file arrived');
                }
            }
            if (snapshot.binding) {
                // The tools say it: a fact, not an inference from the registry.
                const fact = snapshot.binding;
                await update($, bound, () => (fact.bound ? fact.slug : null));
                await update($, boundHow, () => fact.note || 'reported by the MindrianOS tools');
            }
            else {
                const binding = await boundRoom($);
                await update($, bound, () => binding.room);
                await update($, boundHow, () => binding.how);
            }
            const cwd = await $.session.cwd().catch(() => '');
            const folder = await workspaceOf($, cwd);
            await update($, workspace, () => folder);
            await update($, refreshNote, () => '');
        }
        catch (error) {
            const text = error instanceof Error ? error.message : String(error);
            await update($, refreshNote, () => text.slice(0, 80));
        }
        finally {
            const ended = await $.clock.now();
            backOff(ended, failed || ended - started > SLOW_READ_MS);
            await update($, isRefreshing, () => false);
        }
        await pin($);
    }
    catch {
        // keep the last reading
    }
};
const openPane = async ($) => {
    try {
        await $.ui.open({ id: PANE, title: '/m:os', columns: 46 });
        await update($, paneAsked, () => true);
        $.ui.invalidate('ui.render');
    }
    catch {
        // no surface places panes here; the band stays
    }
};
// The names this machine already knows, removed from the excerpt before it is sent: the
// bound room, the workspace folder and the folder of this session.
const knownNames = async ($) => {
    const names = [];
    const slug = await read($, bound);
    if (slug)
        names.push(slug);
    const room = (await read($, snap))?.room?.slug;
    if (room)
        names.push(room);
    const folder = await read($, workspace);
    if (folder)
        names.push(folder);
    const cwd = await $.session.cwd().catch(() => '');
    const last = cwd.split(/[\\/]/).filter(part => part !== '').at(-1);
    if (last)
        names.push(last);
    return names;
};
// Ask Theo what to do next. The question carries a framework name and a problem
// type, and the person's cleaned excerpt unless /mos-words turned it off; the talk is
// read here to choose the handles and the excerpt.
const runAdvice = async ($, force) => {
    try {
        if (autoInFlight)
            return;
        const now = await $.clock.now();
        if (!force && now - lastAskAt < 45000)
            return;
        // After a reload this module has not heard the talk yet: read it back, here,
        // from the session's own transcript. It is used only to choose the handles.
        if (lastUser === '' && lastAnswer === '') {
            try {
                const messages = await $.session.messages();
                const people = [];
                for (let i = messages.length - 1; i >= 0; i--) {
                    const one = messages[i];
                    if (!one || typeof one.text !== 'string')
                        continue;
                    if (one.role === 'user' && !looksInjected(one.text) && people.length < 6)
                        people.unshift(one.text.slice(0, 2000));
                    if (lastAnswer === '' && one.role === 'assistant')
                        lastAnswer = one.text.slice(0, 4000);
                    if (people.length >= 6 && lastAnswer !== '')
                        break;
                }
                recentUser = people;
                lastUser = people[people.length - 1] ?? '';
            }
            catch {
                // no transcript to read
            }
        }
        const classified = classify(recentUser.slice(-3).join('. '), lastAnswer);
        // The same handles would always get the same answer. When the talk has not
        // changed what it points at, walk on along Theo's chain from the framework it
        // last returned, instead of asking the same question again.
        const before = await read($, advice);
        const repeats = before.status === 'ok' && before.framework !== '' && (classified.matched.length === 0 || before.handle.startsWith(classified.framework));
        const handle = repeats ? { ...classified, framework: before.framework } : classified;
        // Nothing to go on is not a reason to guess: wait for a cue unless asked.
        if (!force && handle.matched.length === 0)
            return;
        lastAskAt = now;
        autoInFlight = true;
        // The old sent line goes the moment a new ask starts (plan 380-16): it described an earlier ask.
        await update($, advice, a => ({ ...a, status: 'asking', sent: '', delivery: { kind: 'none' } }));
        try {
            const noted = (await read($, wordsOn)) ? wordsForNoted(handle.matched, recentUser, await knownNames($)) : { text: '', left: [] };
            const result = await askTheo($, handle, turnsDone, seenFrameworks.slice(-6), noted.text, seenCommands.slice(-6), PROPOSALS, noted.left);
            if (result.status === 'ok' && result.framework !== '')
                seenFrameworks = [...seenFrameworks, result.framework].slice(-8);
            if (result.status === 'ok')
                seenCommands = [...seenCommands, ...result.commands.slice(0, 1)].slice(-8);
            const because = repeats
                ? `moving on from ${before.framework}`
                : handle.matched.length > 0
                    ? `because of: ${handle.matched.join(', ')}`
                    : 'no strong cue in the talk, so a general start';
            const framings = result.commands.map(command => frameFor(command, handle.matched, recentUser));
            await update($, advice, () => ({
                ...result,
                framings,
                matched: handle.matched,
                note: result.status === 'ok' && result.note === '' ? because : result.note,
            }));
            const first = framings[0];
            if (result.status === 'ok' && first && !(await read($, isSuggestOff))) {
                await $.prompt.suggest({ text: first });
            }
        }
        finally {
            autoInFlight = false;
            $.ui.invalidate('ui.render');
            await pin($);
        }
    }
    catch {
        autoInFlight = false;
    }
};
// Fold or open one part of the panel; only one is open at a time.
// Text that is not a person's own words: hooks, reminders and notices.
const looksInjected = (text) => /^\s*</.test(text) || /system-reminder|SessionStart|NAVIGATION DECISION|hook success/i.test(text.slice(0, 200));
const toggleBlock = async ($, key) => {
    try {
        const current = await read($, openBlock);
        await update($, openBlock, () => (current === key ? '' : key));
        $.ui.invalidate('ui.render');
    }
    catch {
        // leave the panel as it was
    }
};
// Put a question stem in the prompt box; the person finishes it and sends it.
const askAbout = async ($, text) => {
    const preview = text.length > 70 ? `${text.slice(0, 69)}~` : text;
    try {
        const filled = await $.prompt.fill({ text, mode: 'replace' });
        if (filled.isFilled) {
            $.ui.toast(`In the prompt box, press Enter to send: ${preview}`);
            return;
        }
        // The box would not take it: leave it waiting dim, and say so.
        const shown = await $.prompt.suggest({ text });
        $.ui.toast(shown.isShown
            ? 'The prompt box is busy, so it is waiting there dim. Press Tab to take it.'
            : `The prompt box could not take it. Type this: ${preview}`);
    }
    catch {
        $.ui.toast(`The prompt box could not take it. Type this: ${preview}`);
    }
};
// A section of the room: open it to see what is inside, and put a question
// stem about it in the prompt box. A folder inside it drills one level deeper.
const pickSection = async ($, path) => {
    try {
        const snapshot = await read($, snap);
        const root = snapshot?.room?.path;
        if (!root)
            return;
        const current = await read($, openSection);
        if (current === path) {
            const up = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
            await update($, openSection, () => up);
            await update($, sectionFiles, () => []);
            if (up !== '')
                await listSection($, root, up);
            return;
        }
        await update($, openSection, () => path);
        const top = path.split('/')[0] ?? path;
        await update($, lit, m => {
            const { [top]: _gone, ...rest } = m;
            return rest;
        });
        await listSection($, root, path);
        await askAbout($, `About the "${path.replaceAll('/', ' / ')}" section of the room: `);
    }
    catch {
        // leave the list as it was
    }
};
const listSection = async ($, root, path) => {
    try {
        const entries = await $.fs.list(`${root}/${path}`);
        const names = entries
            .filter(one => !one.name.startsWith('.'))
            .filter(one => one.kind === 'dir' || /\.(md|html|json|txt)$/i.test(one.name))
            .map(one => (one.kind === 'dir' ? `${one.name}/` : one.name))
            .sort((a, b) => Number(b.endsWith('/')) - Number(a.endsWith('/')) || a.localeCompare(b))
            .slice(0, 14);
        await update($, sectionFiles, () => names);
        const now = await $.clock.now();
        const recent = entries
            .filter(one => one.kind === 'file' && one.mtimeMs > 0 && now - one.mtimeMs < LIT_KEEP_MS)
            .map(one => one.name);
        await update($, freshNames, () => recent);
    }
    catch {
        await update($, sectionFiles, () => []);
        await update($, freshNames, () => []);
    }
};
const pickEntry = async ($, name) => {
    const path = await read($, openSection);
    if (name.endsWith('/')) {
        await pickSection($, `${path}/${name.slice(0, -1)}`);
        return;
    }
    await askAbout($, `About "${path.replaceAll('/', ' / ')} / ${name}" in the room: `);
};
// The terminal ground is ink with paper text; the face tile and the context
// canvas are the only bright planes. Buttons sit on soft ink so they read as
// raised. Asides are dimmed paper, never a dark tone on a dark ground.
const ink = { color: PAPER };
const soft = { color: PAPER, dimColor: true };
const RAISED = MUTED;
export const register = on => {
    on('session.start', async ($, e, next) => {
        await update($, isHidden, () => false);
        const noColor = await $.env.get('NO_COLOR');
        await update($, isPlain, () => noColor !== undefined && noColor !== '');
        // Proposal envSwitch: MOS_FACE_WORDS=off at session start makes the opt-out last.
        if (!wordsStartOn(await $.env.get('MOS_FACE_WORDS'), PROPOSALS))
            await update($, wordsOn, () => false);
        for (const [name, description] of [
            ['mos-state', 'Open the /m:os dashboard in the side panel'],
            ['mos-face', 'Show or hide the Theo face box (shown when the panel is not)'],
            ['mos-style', 'Change the Theo face style: tile, mini or line'],
            ['mos-chip', 'Turn the colored badge on replies on or off'],
            ['mos-suggest', 'Turn the grey command suggestion in the prompt box on or off'],
            ['mos-advice', 'Ask Theo now what to do next'],
            ['mos-ask', 'Start a question about the whole room in the prompt box'],
            ['mos-refresh', 'Read the room, the data room, Theo and the website again'],
            ['mos-plain', 'Plain mode: ASCII only, no color pictures (also on when NO_COLOR is set)'],
            ['mos-text', 'Print the whole /m:os state as plain linear text'],
            ['mos-words', 'Turn on or off sending your own recent words to Theo with each ask'],
            ['mos-auto', 'Turn the panel asking Theo every second turn on or off'],
            ['theo-calls', 'Open a pane with every call made to Theo this session'],
            ['mos-job', 'Show or hide the job line, the guess of what you are doing'],
        ]) {
            await $.command.register({ name, description });
        }
        // The canon face asset is read once, through the engine. When it cannot be read the panel shows the
        // words-only line face and one plain sentence (D-10); it never draws numbers typed by hand.
        const got = await readFaceAsset($);
        await update($, faceAsset, () => (got.asset === null ? '' : JSON.stringify(got.asset)));
        await update($, faceAssetNote, () => (got.asset === null ? got.reason : ''));
        $.ui.toast('/m:os face loaded. /mos-state opens the dashboard; /mos-face shows or hides the box.');
        resetReach();
        slowStreak = 0;
        slowUntil = 0;
        void refresh($);
        poll?.cancel();
        poll = $.clock.every(TICK_MS, () => {
            void refresh($, false);
        });
        void openPane($);
        await pin($);
        return next(e);
    });
    on('command.run', { command: 'mos-state' }, async ($) => {
        await openPane($);
        void refresh($, true, false);
        return { text: 'The /m:os dashboard is open in the side panel. It seats at any width when you ask for it.' };
    });
    on('command.run', { command: 'mos-face' }, async ($) => {
        const hidden = await read($, isHidden);
        await update($, isHidden, () => !hidden);
        $.ui.invalidate('ui.render');
        return { text: hidden ? 'Theo face box shown.' : 'Theo face box hidden. Run /mos-face to show it again.' };
    });
    on('command.run', { command: 'mos-style' }, async ($) => {
        const current = await read($, style);
        const next = STYLES[(STYLES.indexOf(current) + 1) % STYLES.length] ?? 'tile';
        await update($, style, () => next);
        const names = {
            tile: 'tile - the Theo face for each state',
            mini: 'mini - a small tile',
            line: 'line - one plain-text line',
        };
        return { text: `Face style: ${names[next]}.` };
    });
    on('command.run', { command: 'mos-chip' }, async ($) => {
        const off = await read($, isChipOff);
        await update($, isChipOff, () => !off);
        return { text: off ? 'Colored badge in replies is on.' : 'Colored badge in replies is off.' };
    });
    on('command.run', { command: 'mos-suggest' }, async ($) => {
        const off = await read($, isSuggestOff);
        await update($, isSuggestOff, () => !off);
        return {
            text: off
                ? 'Grey command suggestions are on: Tab takes one into the prompt, Enter runs it.'
                : 'Grey command suggestions are off.',
        };
    });
    on('command.run', { command: 'mos-ask' }, async ($) => {
        const snapshot = await read($, snap);
        const roomName = snapshot?.room?.slug;
        await askAbout($, roomName ? `About the room ${roomName}: ` : 'About the room: ');
        return { text: 'A question stem is in the prompt box. Finish it and press Enter.' };
    });
    on('command.run', { command: 'mos-refresh' }, async ($) => {
        void refresh($);
        return { text: 'Reading the room, the data room, Theo and the website again.' };
    });
    on('command.run', { command: 'mos-words' }, async ($) => {
        const on2 = await read($, wordsOn);
        await update($, wordsOn, () => !on2);
        $.ui.invalidate('ui.render');
        // on2 is the setting before the toggle: the setting now is its opposite.
        return { text: wordsTexts(!on2, PROPOSALS).words };
    });
    on('command.run', { command: 'mos-text' }, async ($) => {
        const usage = await $.session.usage().catch(() => null);
        const percent = usage?.context.percent;
        const tokens = usage?.context.tokens !== undefined && usage.context.window ? `, ${usage.context.tokens} of ${usage.context.window} tokens` : '';
        const snapshot = await read($, snap);
        const job = await jobNow($);
        const jobWords = jobLine(jobRows({ record: job.record, guess: job.guess, stage: snapshot?.room?.stage ?? '', section: await read($, openSection), hidden: job.isHidden, width: 200, plain: true }));
        const input = {
            snap: snapshot,
            bound: await read($, bound),
            boundHow: await read($, boundHow),
            workspace: await read($, workspace),
            advice: await read($, advice),
            totals: await read($, theoTotals),
            calls: await read($, theo),
            now: await $.clock.now(),
            width: 200,
            context: percent === undefined ? '' : `${Math.round(percent)}% used${tokens}`,
            sections: true,
            job: jobWords,
            local: await read($, statusLocal),
            jobId: job.record?.id ?? '',
        };
        return { text: stateText(input) };
    });
    on('command.run', { command: 'mos-plain' }, async ($) => {
        const on2 = await read($, isPlain);
        await update($, isPlain, () => !on2);
        $.ui.invalidate('ui.render');
        return { text: on2 ? 'Plain mode off.' : 'Plain mode on: ASCII only, no color pictures.' };
    });
    on('command.run', { command: 'mos-advice' }, async ($) => {
        void runAdvice($, true);
        return { text: wordsTexts(await read($, wordsOn), PROPOSALS).advice };
    });
    on('command.run', { command: 'mos-auto' }, async ($) => {
        const off = await read($, isAutoOff);
        await update($, isAutoOff, () => !off);
        return { text: off ? 'The panel asks Theo every second turn.' : 'The panel no longer asks Theo by itself.' };
    });
    on('command.run', { command: 'mos-job' }, async ($) => {
        const job = await jobNow($);
        if (job.isHidden) {
            await update($, jobHidden, () => false);
            $.ui.invalidate('ui.render');
            return { text: 'Job line shown. It is a guess from the room and your recent words, and nothing is sent anywhere.' };
        }
        await update($, jobHidden, () => true);
        await update($, jobHiddenFor, () => '');
        $.ui.invalidate('ui.render');
        return { text: 'Job line hidden. Run /mos-job to show it again.' };
    });
    on('command.run', { command: 'theo-calls' }, async ($) => {
        await $.ui.open({ id: 'theo-calls', title: 'Theo calls' });
        return { text: 'Theo calls pane opened (it seats from 110 columns wide, or at any width on request).' };
    });
    on('prompt.submit', async ($, e, next) => {
        if (!e.command && !looksInjected(e.text)) {
            lastUser = e.text.slice(0, 2000);
            recentUser = [...recentUser, lastUser].slice(-6);
        }
        return next(e);
    });
    on('turn.start', async ($, e, next) => {
        if (e.agentId === undefined) {
            stopBack();
            await update($, mos, () => 0);
            await update($, theoTurn, () => emptyTotals);
            await update($, flag, () => '');
            await update($, face, () => stateFor('turn.start'));
            await update($, detail, () => '');
            await update($, spoken, n => n + 1);
            if (!spin) {
                spin = $.clock.every(220, () => {
                    void update($, frame, n => n + 1);
                });
            }
            await pin($);
        }
        return next(e);
    });
    on('tool.call', async ($, e, next) => {
        const name = e.tool;
        const isTheo = THEO_TOOL.test(name);
        const isMain = e.agentId === undefined;
        const isAutoCall = autoInFlight || isPanelReading();
        const id = e.tool_use_id;
        const startedAt = isTheo ? await $.clock.now() : 0;
        if (isTheo) {
            const entry = {
                id,
                tool: toolName(name),
                via: theoVia(name),
                ms: null,
                status: 'running',
                isAgent: !isMain,
                isAuto: isAutoCall,
            };
            await update($, theo, list => [...list, entry].slice(-40));
            await update($, theoTotals, t => ({ ...t, total: t.total + 1 }));
            await update($, theoTurn, t => ({ ...t, total: t.total + 1 }));
        }
        const shows = isMain && !isAutoCall;
        if (shows) {
            stopBack();
            if (MOS_TOOL.test(name))
                await update($, mos, n => n + 1);
            await update($, face, () => stateFor('tool.call'));
            await update($, detail, () => (isTheo ? `${theoVia(name)}: ${toolName(name)}` : shortTool(name)));
            await update($, spoken, n => n + 1);
        }
        const ran = await next(e);
        const text = typeof ran.text === 'string' ? ran.text : '';
        let state = stateFor('tool.ok');
        let note = isTheo ? `${theoVia(name)}: ${toolName(name)}` : shortTool(name);
        let status = 'ok';
        if (ran.deny !== undefined) {
            state = stateFor('tool.denied');
            status = 'blocked';
            note = `blocked - ${note}`;
        }
        else if (ran.isError) {
            state = stateFor('tool.failed');
            status = 'error';
            note = `error - ${note}`;
        }
        else if (text.trim() === '' || EMPTY_RESULT.test(text)) {
            state = stateFor('tool.empty');
            status = 'empty';
            note = `empty - ${note}`;
        }
        if (isTheo) {
            const ms = (await $.clock.now()) - startedAt;
            await update($, theo, list => list.map(one => (one.id === id ? { ...one, ms, status } : one)));
            const bump = (t) => ({
                ...t,
                ok: t.ok + (status === 'ok' ? 1 : 0),
                empty: t.empty + (status === 'empty' ? 1 : 0),
                error: t.error + (status === 'error' ? 1 : 0),
                blocked: t.blocked + (status === 'blocked' ? 1 : 0),
            });
            await update($, theoTotals, bump);
            await update($, theoTurn, bump);
            if (status === 'error' || status === 'blocked') {
                const now = await $.clock.now();
                if (now - lastToastAt > 20000) {
                    lastToastAt = now;
                    $.ui.toast(`Theo call ${status === 'error' ? 'failed' : 'was blocked'}: ${toolName(name)}`);
                }
            }
        }
        if (shows) {
            await update($, face, () => state);
            await update($, detail, () => note);
            await update($, spoken, n => n + 1);
            back = $.clock.after(1400, () => {
                void update($, face, () => stateFor('turn.start'));
                void update($, detail, () => '');
                void update($, spoken, n => n + 1);
            });
        }
        if (ran.deny === undefined && !ran.isError) {
            void noteChange($, e);
        }
        void pin($);
        return ran;
    });
    on('turn.complete', async ($, e, next) => {
        if (e.agentId === undefined) {
            stopSpin();
            stopBack();
            lastAnswer = e.answer.slice(0, 4000);
            turnsDone += 1;
            const lead = LEAD.exec(e.answer);
            if (lead) {
                const glyph = lead[1] ?? '';
                await update($, move, () => moveOf(glyph));
            }
            else if (e.answer.trim() !== '') {
                await update($, move, () => 'none');
            }
            const turnCalls = await read($, theoTurn);
            if (MENTIONS_THEO.test(e.answer) && turnCalls.total === 0) {
                await update($, flag, () => 'the reply mentions Theo, but no call to Theo was made this turn');
            }
            const secs = Math.round(e.durationMs / 1000);
            // A finished answer is a handover, unless its lead square names another state (red, yellow, black).
            let state = lead ? stateForLead(lead[1] ?? '') : stateFor('turn.complete');
            let note = `${secs}s`;
            if (e.reason === 'refusal') {
                state = stateFor('turn.refusal');
                note = 'the model refused';
            }
            else if (e.reason === 'aborted') {
                state = stateFor('turn.aborted');
                note = 'interrupted';
            }
            else if (e.reason === 'error') {
                state = stateFor('turn.error');
                note = 'the turn ended on an error';
            }
            await update($, face, () => state);
            await update($, detail, () => note);
            await update($, spoken, n => n + 1);
            back = $.clock.after(9000, () => {
                void update($, face, () => stateFor('turn.aborted'));
                void update($, detail, () => '');
                void update($, spoken, n => n + 1);
            });
            // Leave one command waiting, dim, in the prompt box: Tab takes it.
            if (e.reason !== 'aborted' && !(await read($, isSuggestOff))) {
                const said = await read($, spoken);
                const warned = await read($, flag);
                const trouble = turnCalls.error > 0 || turnCalls.blocked > 0 || warned !== '';
                const words = glossaryWords(state);
                const recs = recommend(state, words.length > 0 ? pickVaried(words, said, 5).term : '', trouble);
                const first = recs[0];
                if (first) {
                    const text = suggestionText(first);
                    const offer = async () => (await $.prompt.suggest({ text })).isShown;
                    $.clock.after(700, () => {
                        void offer().then(shown => {
                            if (!shown)
                                $.clock.after(2500, () => void offer());
                        });
                    });
                }
            }
            void refresh($, false);
            $.ui.invalidate('ui.render');
            if (e.reason !== 'aborted' && !(await read($, isAutoOff)) && turnsDone % 2 === 0) {
                $.clock.after(1500, () => {
                    void runAdvice($, false);
                });
            }
            await pin($);
        }
        return next(e);
    });
    // ---- Drawing --------------------------------------------------------------
    // The side panel: an operating panel, not a monitor. Every fact comes with the
    // button that acts on it. Top to bottom: who is speaking and the context
    // budget, where this session writes, what is wrong now and its fix, Theo's
    // next moves, a way to ask about any part of the room, and a row of lights
    // that each open their details. A button never runs anything: it puts the
    // command in the prompt box, and Enter is the person's.
    on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
        const { Box, Text, Button } = $.ui.resolve(e);
        const state = await read($, face);
        const note = await read($, detail);
        const mv = await read($, move);
        const tick = await read($, frame);
        const st = await read($, style);
        const assetText = await read($, faceAsset);
        const assetNote = await read($, faceAssetNote);
        const said = await read($, spoken);
        const calls = await read($, theo);
        const totals = await read($, theoTotals);
        const snapshot = await read($, snap);
        const next = await read($, advice);
        const room = await read($, bound);
        const how = await read($, boundHow);
        const folder = await read($, workspace);
        const note2 = await read($, refreshNote);
        const open = await read($, openSection);
        const entries = await read($, sectionFiles);
        const fresh = await read($, freshNames);
        const litMap = await read($, lit);
        const why = await read($, litWhy);
        const openB = await read($, openBlock);
        const usage = await $.session.usage().catch(() => null);
        const now = await $.clock.now();
        const plainMode = await read($, isPlain);
        const rawCols = e.props.bodyColumns;
        if (rawCols < MIN_PANE) {
            return (h(Box, { flexDirection: "column", backgroundColor: INK, paddingX: 1, width: rawCols },
                h(Text, { ...ink, bold: true }, `/m:os needs ${MIN_PANE} columns`),
                h(Text, { ...soft }, "Widen the panel. The status line and /mos-state still work.")));
        }
        const cols = rawCols - 2;
        const short = e.props.scroll.bodyRows < 24;
        // The ladder: narrow folds the pictures to words, standard shrinks them, wide has room. The face
        // is 12 cells wide on a wide panel, 8 on a standard one (a tall panel is not needed), 6 in the
        // mini style, and words only below 40 columns, in plain mode and in the line style.
        const tier = plainMode || rawCols < 40 ? 'narrow' : rawCols < 50 ? 'standard' : 'wide';
        const n = tier === 'narrow' || st === 'line' ? 0 : st === 'mini' ? 6 : tier === 'standard' || short ? 8 : 12;
        const useBar = plainMode || tier === 'narrow' || short;
        const faceRows = faceRuns(assetText, state, n);
        // Words only: the style says so, or the panel is narrow, or the asset could not be read.
        const wordsOnly = faceRows.length === 0;
        const tileCols = wordsOnly ? 0 : n;
        let thought = pickVaried(THOUGHTS[state], said, 3);
        const running = calls.filter(one => one.status === 'running');
        const lastCall = calls[calls.length - 1];
        if (running.length > 0)
            thought = pickVaried(THEO_CALL_THOUGHTS, said, 1);
        else if (state === 'limit' && lastCall && lastCall.status === 'empty')
            thought = pickVaried(THEO_EMPTY, said, 0);
        else if ((state === 'limit' && lastCall && lastCall.status === 'error') ||
            (state === 'boundary' && lastCall && lastCall.status === 'blocked')) {
            thought = pickVaried(THEO_FAILED, said, 0);
        }
        const textWidth = Math.max(16, cols - tileCols - 2);
        const percent = usage?.context.percent;
        const canvas = useBar ? null : contextCanvas(percent, Math.min(cols, 32), 8);
        const canvasRows = canvas ? gridRuns(canvas.pixels) : [];
        const barWidth = Math.max(8, Math.min(20, cols - 8));
        // The context band of the status line, in words (ok, watch, cliff), and its text bar.
        const band = contextBand(percent);
        const narrowLabels = tier === 'narrow';
        const isOld = snapshot !== null && now - snapshot.at > 300000;
        const g = (text) => plainMode ? text.replaceAll('▸', '>').replaceAll('▾', 'v').replaceAll('◆', '*').replaceAll('⚠', '!').replaceAll('▌', '|') : text;
        const markerColor = e.props.isFocused ? BLUE : MUTED;
        const local = await read($, statusLocal);
        const job = await jobNow($);
        const input = { snap: snapshot, bound: room, boundHow: how, workspace: folder, advice: next, totals, calls, now, width: cols - 2, local, jobId: job.record?.id ?? '' };
        const roomName = snapshot?.room?.slug ?? null;
        // WRITES TO already says when nothing is bound, so NOW looks past it.
        const nowL = nowLine(room ? input : { ...input, bound: roomName ?? 'unbound' });
        const blocks = stateBlocks(input).filter(block => block.key !== 'next');
        const lights = panelLights(input);
        const changed = Object.entries(litMap)
            .filter(([, at]) => now - at < LIT_KEEP_MS)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2);
        const jrows = jobRows({
            record: job.record,
            guess: job.guess,
            stage: snapshot?.room?.stage ?? '',
            section: open,
            hidden: job.isHidden,
            width: rawCols,
            plain: plainMode,
        });
        const dismissJob = async () => {
            await update($, jobHidden, () => true);
            await update($, jobHiddenFor, () => job.id);
            $.ui.invalidate('ui.render');
        };
        const wordsShared = await read($, wordsOn);
        // One honest sentence about what happened to the person's words, and at most one note (plan 380-16).
        const sentLine = sentText(sentRow(next, wordsShared));
        const failNote = noteOf(next, wordsShared, 'Theo could not be asked');
        const age = turnsDone - next.turn;
        const isStale = next.status === 'ok' && age > 3;
        const thinkNow = (command) => thinkPrompt({
            command,
            framework: next.framework,
            whyLine: WHY[command] ?? '',
            room: roomName ?? room,
            stage: snapshot?.room?.stage ?? 'unknown',
            stale: (snapshot?.room?.stale ?? []).map(one => one.section),
            subject: subjectOf(next.matched, recentUser),
        });
        const moveNow = nextMove(next.status === 'ok' && !isStale ? (next.commands[0] ?? null) : null, local?.nextMove ?? null, job.record?.id ?? '');
        const frameNow = (command, idx) => frameFor(command, next.matched, recentUser) || next.framings[idx] || command;
        // A button: always on a raised ground, so its label reads on any terminal.
        const knob = (key, label, onPress, ground = RAISED) => (h(Box, { key: key, backgroundColor: ground, alignSelf: "flex-start" },
            h(Button, { key: key, label: g(label), onPress: onPress })));
        // One fact of the status line or of the room: its label, then its value, in one row of text.
        const fact = (one) => (h(Text, { key: `fact-${one.id}`, ...ink, bold: one.strong },
            h(Text, { ...ink, bold: true }, factLabel(one.id, narrowLabels)),
            g(`  ${one.value}`)));
        // A heading: a cobalt marker, the part in capitals, then its plain words.
        const heading = (title, words) => (h(Text, { ...ink, bold: true },
            h(Text, { color: markerColor }, g('▌')),
            ` ${title}  ${words}`));
        const sectionList = () => {
            const all = snapshot?.room?.sections ?? [];
            const shown = [...all].sort((a, b) => b.files - a.files).slice(0, 10);
            return (h(Box, { flexDirection: "column", paddingLeft: 1 },
                all.length === 0 && h(Text, { ...soft }, "no sections were read"),
                shown.map(sec => {
                    const isOpen = open === sec.name || open.startsWith(`${sec.name}/`);
                    const at = litMap[sec.name];
                    const isLit = at !== undefined && now - at < LIT_KEEP_MS;
                    const flashing = isLit && at !== undefined && now - at < LIT_FLASH_MS;
                    const ground = isLit && !(flashing && tick % 2 === 0) ? BLUE : RAISED;
                    const mark = isLit ? '◆ ' : '';
                    const tail = isLit && at !== undefined ? `  changed ${agoText(at, now)}` : '';
                    return (h(Box, { key: `sec${sec.name}`, flexDirection: "column" },
                        knob(`sec-${sec.name}`, `${isOpen ? '▾' : '▸'} ${mark}${sec.name}  ${sec.files}${tail}`, () => pickSection($, sec.name), ground),
                        isOpen && (h(Box, { flexDirection: "column", paddingLeft: 2 },
                            open.includes('/') && h(Text, { ...soft }, open.replaceAll('/', ' / ')),
                            entries.length === 0 && h(Text, { ...soft }, "nothing readable inside"),
                            entries.map(name => knob(`entry-${open}-${name}`, `${fresh.includes(name) ? '◆ new  ' : ''}${name.endsWith('/') ? `> ${name}` : name}`, () => pickEntry($, name), fresh.includes(name) ? BLUE : RAISED))))));
                }),
                all.length > shown.length && h(Text, { ...soft }, `+${all.length - shown.length} more sections`)));
        };
        return (h(Box, { flexDirection: "column", backgroundColor: INK, paddingX: 1, width: e.props.bodyColumns },
            h(Box, { gap: 1 },
                !wordsOnly && (h(Box, { flexDirection: "column" }, faceRows.map((runs, k) => (h(Text, { key: `f${k}`, ...ink }, runs.map((run, i) => (h(Text, { key: `f${k}c${i}`, color: run.top, backgroundColor: run.bottom }, '▀'.repeat(run.w))))))))),
                h(Box, { flexDirection: "column", width: textWidth },
                    h(Text, { color: MOVE_FG[mv], backgroundColor: MOVE_BG[mv], bold: true }, ' Theo | MindrianOS '),
                    h(Text, { ...ink, bold: true, wrap: "truncate-end" }, fit(`${wordsOnly ? `${LINE_FACE[state]} ` : ''}${LABEL[state]}${note ? `  ${note}` : ''}`, textWidth)),
                    h(Text, { ...ink, italic: true, wrap: "truncate-end" }, fit(`"${thought}"`, textWidth)))),
            assetText === '' && assetNote !== '' && h(Text, { ...soft }, assetNote),
            h(Text, { ...ink }, " "),
            canvasRows.map((runs, k) => (h(Text, { key: `m${k}`, ...ink }, runs.map((run, i) => (h(Text, { key: `m${k}c${i}`, color: run.top, backgroundColor: run.bottom }, '▀'.repeat(run.w))))))),
            useBar && percent !== undefined && h(Text, { ...ink }, band.bar(barWidth)),
            h(Box, { flexDirection: "column" },
                h(Text, { ...ink, bold: true }, gaugeText(percent, canvas !== null, factLabel('context', narrowLabels)).text),
                percent !== undefined && percent >= 60 && knob('compact', 'Free space /compact', () => askAbout($, '/compact'))),
            h(Text, { ...ink }, " "),
            heading('WRITES TO', room ?? 'nothing - this session is not bound'),
            h(Box, { gap: 1 }, knob('rooms', room ? 'Switch room' : 'Bind a room', () => askAbout($, '/mos:rooms'))),
            roomFacts(snapshot, local, room).map(fact),
            h(Text, { ...ink }, " "),
            heading('NOW', nowL.text),
            nowL.command !== '' && knob('fix', `${nowL.label || 'Try'}: ${nowL.command}`, () => askAbout($, nowL.command)),
            changed.map(([name, at]) => (h(Text, { key: `chg${name}`, ...ink, bold: true, wrap: "truncate-end" }, g(fit(`◆ ${name} - ${why[name] ?? 'changed'}, ${agoText(at, now)}`, cols))))),
            h(Text, { ...ink }, " "),
            heading('NEXT', 'from Theo'),
            h(Text, { ...ink }, g(`${factLabel('next', narrowLabels)}  ${moveNow.words}`)),
            next.status === 'asking' && h(Text, { ...soft }, "asking Theo..."),
            isStale && h(Text, { ...soft }, `Theo's last suggestion is ${age} turns old, so it is hidden. Ask Theo now for a fresh one.`),
            next.status === 'ok' && !isStale && next.framework !== '' && (h(Box, { flexDirection: "column" },
                knob('framework', `Framework: ${next.framework}`, () => askAbout($, thinkNow(next.commands[0] ?? ''))),
                h(Text, { ...soft }, "click: a question about your case goes in the prompt box, and Enter sends it. Run puts the bare command in the box."))),
            next.status === 'ok' && !isStale && next.commands.length > 0 && (h(Box, { flexDirection: "column" },
                next.commands.slice(0, 3).map((command, idx) => (h(Box, { key: `cmd${idx}`, flexDirection: "column" },
                    h(Box, { gap: 1 },
                        knob(`cmd-${idx}`, `${idx + 1} ${command}`, () => askAbout($, thinkNow(command))),
                        knob(`run-${idx}`, 'Run', () => askAbout($, frameNow(command, idx)))),
                    h(Text, { ...soft }, plain(`when ${situationOf(WHY[command] ?? '')}`))))),
                h(Text, { ...soft }, next.note ? next.note.replace(/^because of:/, 'Chosen because you mentioned:') : 'Chosen from what you said.'),
                h(Text, { ...soft }, "click a number: a question about your case goes in the box, then Enter sends it. Run: the bare command"))),
            next.status === 'idle' && h(Text, { ...soft }, "Theo will suggest once the talk gives something to go on."),
            next.status === 'failed' && failNote !== '' && h(Text, { ...soft }, failNote),
            h(Box, { gap: 1 },
                knob('ask-now', 'Ask Theo now', () => runAdvice($, true)),
                knob('words', wordsShared ? 'Words: shared' : 'Words: not shared', () => update($, wordsOn, v => !v))),
            sentLine !== '' && h(Text, { ...soft }, sentLine),
            h(Text, { ...ink }, " "),
            jrows
                .filter(row => row.kind !== 'button')
                .map((row, k) => row.kind === 'heading' ? (h(Box, { key: `job${k}` }, heading(row.title, row.text))) : (h(Text, { key: `job${k}`, ...(row.kind === 'dim' ? soft : ink) }, g(row.text)))),
            jrows.some(row => row.kind === 'button') && (h(Box, { gap: 1, flexWrap: "wrap" }, jrows.map(row => row.kind === 'button'
                ? knob(row.action === 'dismiss' ? 'job-dismiss' : 'job-fix', row.text, () => (row.action === 'dismiss' ? dismissJob() : askAbout($, FIX_COMMAND)))
                : null))),
            pluginFacts(snapshot, local).map(fact),
            h(Text, { ...ink }, " "),
            heading('ASK', 'about the room'),
            h(Box, { gap: 1 },
                knob('ask-room', 'Whole room', () => askAbout($, `About the room ${roomName ?? ''}: `.replace('  ', ' '))),
                knob('ask-sections', `${openB === 'ask' ? '▾' : '▸'} Sections`, () => toggleBlock($, 'ask'))),
            openB === 'ask' && sectionList(),
            h(Text, { ...ink }, " "),
            h(Box, { gap: 1, flexWrap: "wrap" }, lights.map(light => knob(`block-${light.key}`, `${openB === light.key ? '▾' : '▸'} ${light.label}`, () => toggleBlock($, light.key)))),
            blocks
                .filter(block => block.key === openB)
                .map(block => (h(Box, { key: `blk${block.key}`, flexDirection: "column", paddingLeft: 1 }, block.rows.map((row, k) => {
                if (row.kind === 'sections' || row.kind === 'commands')
                    return null;
                const tone = row.kind === 'dim' ? soft : ink;
                return (h(Text, { key: `r${block.key}${k}`, ...tone, bold: row.kind === 'strong' }, g(row.text)));
            })))),
            h(Text, { ...ink }, " "),
            h(Box, { gap: 1 },
                knob('refresh', 'Refresh', () => refresh($)),
                h(Text, { ...(isOld ? ink : soft), bold: isOld }, snapshot ? `${isOld ? 'stale: ' : ''}read ${clock(snapshot.at)} (${agoText(snapshot.at, now)})` : 'not read yet')),
            note2 !== '' && h(Text, { ...ink, bold: true }, `refresh failed: ${note2}`),
            h(Text, { ...soft }, openB === 'ask'
                ? 'click a section or file: it goes in the prompt box, Enter sends'
                : 'click, or type /mos-state /mos-advice /mos-ask /mos-refresh')));
    });
    // The box above the prompt: only when the side panel is not drawn, so the
    // dashboard always has a home and the box is never a second copy of it.
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
        if (e.props.hasSurvey)
            return next(e);
        const panes = await $.ui.panes().catch(() => []);
        if (panes.some(pane => pane.id === PANE && pane.isPlaced))
            return next(e);
        const { Box, Text, Button } = $.ui.resolve(e);
        const hidden = await read($, isHidden);
        const cols = e.props.bodyColumns;
        if (hidden) {
            return (h(Box, { width: cols, justifyContent: "flex-end", gap: 1 },
                h(Text, { ...soft }, "Theo face hidden"),
                h(Box, { backgroundColor: RAISED },
                    h(Button, { key: "show", label: "Show", onPress: () => update($, isHidden, () => false) }))));
        }
        const state = await read($, face);
        const note = await read($, detail);
        const mv = await read($, move);
        const bandStyle = await read($, style);
        const assetText = await read($, faceAsset);
        const assetNote = await read($, faceAssetNote);
        const said = await read($, spoken);
        const totals = await read($, theoTotals);
        const turnTotals = await read($, theoTurn);
        const next2 = await read($, advice);
        const faceRows = faceRuns(assetText, state, bandSize(bandStyle));
        const wordsOnly = faceRows.length === 0;
        const thought = pickVaried(THOUGHTS[state], said, 3);
        const textWidth = Math.max(20, Math.min(54, cols - 14));
        const first = next2.status === 'ok' ? next2.commands[0] : undefined;
        const why = first ? WHY[first] : undefined;
        return (h(Box, { width: cols, justifyContent: "flex-end" },
            h(Box, { backgroundColor: INK, paddingX: 1, gap: 1 },
                !wordsOnly && (h(Box, { flexDirection: "column" }, faceRows.map((runs, k) => (h(Text, { key: `b${k}`, color: INK }, runs.map((run, i) => (h(Text, { key: `b${k}c${i}`, color: run.top, backgroundColor: run.bottom }, '▀'.repeat(run.w))))))))),
                h(Box, { flexDirection: "column", width: textWidth },
                    h(Box, { gap: 1 },
                        h(Text, { color: MOVE_FG[mv], backgroundColor: MOVE_BG[mv], bold: true }, ' Theo | MindrianOS '),
                        h(Box, { backgroundColor: RAISED },
                            h(Button, { key: "hide", label: "Hide", onPress: () => update($, isHidden, () => true) }))),
                    h(Text, { ...ink, bold: true, wrap: "truncate-end" }, fit(`${wordsOnly ? `${LINE_FACE[state]} ` : ''}${LABEL[state]}${note ? `  ${note}` : ''} | Theo ${turnTotals.total} this turn, ${totals.total} in all`, textWidth)),
                    h(Text, { ...ink, wrap: "truncate-end" }, fit(why ? `Theo: ${plain(why)}` : `"${thought}"`, textWidth)),
                    assetText === '' && assetNote !== '' && h(Text, { ...soft }, assetNote)))));
    });
    // The hint line under the prompt keeps the engine's own hints and adds one
    // button: the way into the dashboard (and back to the box if it is hidden).
    on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
        if (e.props.isDraft)
            return next(e);
        const { Box, Text, Button } = $.ui.resolve(e);
        const hidden = await read($, isHidden);
        return (h(Box, { gap: 2 },
            h(Text, { dimColor: true }, e.props.hint),
            h(Box, { backgroundColor: RAISED },
                h(Button, { key: "dash", label: "/m:os dashboard", onPress: () => openPane($) })),
            hidden && (h(Box, { backgroundColor: RAISED },
                h(Button, { key: "unhide", label: "Show box", onPress: () => update($, isHidden, () => false) })))));
    });
    // The pane: every call made to Theo this session.
    on('ui.render', { component: 'Pane', requestId: 'theo-calls' }, async ($, e) => {
        const { Box, Text } = $.ui.resolve(e);
        const calls = await read($, theo);
        const totals = await read($, theoTotals);
        const spinner = SPIN[(await read($, frame)) % SPIN.length] ?? '-';
        const room = Math.max(1, (e.viewport?.rows ?? 24) - 6);
        return (h(Box, { flexDirection: "column", backgroundColor: INK, paddingX: 1 },
            h(Text, { ...ink, bold: true }, `Calls to Theo: ${totals.total}${countText(totals) ? ` - ${countText(totals)}` : ''}`),
            calls.length === 0 && h(Text, { ...soft }, "No call to Theo yet this session."),
            calls
                .slice(-room)
                .reverse()
                .map(call => (h(Text, { key: call.id, ...ink, wrap: "truncate-end" }, `${(call.status === 'running' ? `${call.status}${spinner}` : call.status).padEnd(8)} ${seconds(call.ms).padStart(6)}  ${call.via}: ${call.tool}${call.isAgent ? '  (agent)' : ''}${call.isAuto ? '  (panel)' : ''}`)))));
    });
    // The badge inside a reply: the leading glyph and label become one colored chip.
    on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
        if (!e.props.isFirstOfReply || e.props.isSummary || (await read($, isChipOff))) {
            return next(e);
        }
        const lead = LEAD.exec(e.props.text);
        if (!lead)
            return next(e);
        const mv = moveOf(lead[1] ?? '');
        // The reply's own marker text, unchanged (D-07): nothing is added, removed or rewritten.
        const quoted = lead[2] ?? '';
        const rest = e.props.text.slice(lead[0].length).replace(/^\s+/, '');
        const { Box, Text } = $.ui.resolve(e);
        return (h(Box, { flexDirection: "column" },
            h(Text, { color: MOVE_FG[mv], backgroundColor: MOVE_BG[mv], bold: true }, ` ${quoted} `),
            rest !== '' && (await next({ ...e, props: { ...e.props, text: rest } }))));
    });
};
