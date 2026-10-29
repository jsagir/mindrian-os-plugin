// The overview by size (Phase 380 plan 19, D-04, D-08, D-09; gaps 1 and 2).
//
// Pure and erasable: no enum, no explicit any, no I/O, no engine import. The pane, the band and the hint
// line ask these functions what to draw at the size the host gives, so the rules sit in one place and a
// test can sweep them.
//
// Rules taken from the mos-brand book e947a5d, segments/experience/terminal GUIDE.md (status proposed):
//   line 28   compact below 60 columns: the SCREEN width (owner ruling of 2026-10-24), read from the viewport
//   line 107  under 24 rows pictures fold to words
//   lines 99 to 107  the width ladder is about the PANEL width
// The book is silent on the tiny class (under 12 rows) and on blank rows: proposal P19-3.
export const COMPACT_BELOW = 60;
export const FULL_ROWS = 24;
export const TINY_ROWS = 12;
export const MIN_SCREEN = 30;
// Fails to compile when a case of a switch is not handled.
export function assertNever(value) {
    throw new Error(`unhandled overview case: ${String(value)}`);
}
// True only for a screen that was measured and is under the compact width. No viewport (a test mount) is
// not compact.
export function isCompact(screenColumns) {
    return typeof screenColumns === 'number' && screenColumns < COMPACT_BELOW;
}
// The screen width: the viewport the host gave, else the body columns plus the cells the host keeps beside
// them when both are known, else undefined.
export function screenColumnsOf(viewport, bodyColumns, extra) {
    if (viewport !== undefined)
        return viewport.columns;
    if (bodyColumns !== undefined && extra !== undefined)
        return bodyColumns + extra;
    return undefined;
}
// The ladder of the panel: wide from 50 columns, standard from 40, narrow under 40 and in plain mode.
const tierOf = (columns, plain) => (plain || columns < 40 ? 'narrow' : columns < 50 ? 'standard' : 'wide');
// The cells of the face tile for a style. Narrow never gets here; a line style has no tile.
function cellsFor(style, tier) {
    switch (style) {
        case 'mini':
            return 6;
        case 'tile':
        case 'line':
            return tier === 'wide' ? 12 : 8;
        default:
            return assertNever(style);
    }
}
// What the pane draws at a size. The class comes from the rows the host gives (full from 24 rows, tiny under
// 12), the tier from the width of the pane, and compact from the width of the screen.
export function overviewLayout(input) {
    const { bodyRows, columns, screenColumns, plain, style } = input;
    const size = bodyRows < TINY_ROWS ? 'tiny' : bodyRows < FULL_ROWS ? 'short' : 'full';
    const compact = isCompact(screenColumns);
    const tier = tierOf(columns, plain);
    const pictures = size === 'full' && !compact && !plain && tier !== 'narrow';
    const hasTile = pictures && style !== 'line';
    const header = hasTile ? { kind: 'tile', cells: cellsFor(style, tier) } : { kind: 'words', rows: size === 'full' ? 3 : 1 };
    return {
        size,
        compact,
        tier,
        header,
        canvas: pictures,
        bar: !pictures,
        jobForm: size === 'tiny' ? 'one-row' : 'full',
        gaps: size === 'full',
    };
}
// What the box above the prompt draws at a screen width. The screen is the viewport columns the host gives,
// or the body columns plus the 5 cells the host keeps beside them.
export function bandLayout(input) {
    const { screenColumns, bodyColumns, plain, style } = input;
    if (screenColumns < MIN_SCREEN)
        return { kind: 'too-small', needs: MIN_SCREEN };
    const tile = bandTile(style, plain || isCompact(screenColumns));
    // Beside a tile the text has the width left by 12 cells and the padding; with no tile it has the body less 4.
    const textWidth = tile === 0 ? Math.max(8, Math.min(54, bodyColumns - 4)) : Math.max(20, Math.min(54, bodyColumns - 14));
    return { kind: 'ok', tile, hideOnOwnRow: bodyColumns < HIDE_OWN_ROW_BELOW, textWidth };
}
const HIDE_OWN_ROW_BELOW = 36;
// The tile of the band, by style: tile 12, mini 6, line none; none at all in plain mode and on a compact screen.
function bandTile(style, words) {
    if (words)
        return 0;
    switch (style) {
        case 'tile':
            return 12;
        case 'mini':
            return 6;
        case 'line':
            return 0;
        default:
            return assertNever(style);
    }
}
// What the hint line under the prompt draws at a screen width: the label of the dashboard button, the room
// the host hint may take (null when it is drawn whole, 0 when it is dropped) and whether Show box fits.
export function hintLayout(input) {
    const { screenColumns, hint, hidden } = input;
    const showBox = hidden && screenColumns >= COMPACT_BELOW;
    // The room the line has: the screen less the Show box button (2 cells of gap and 12 of button).
    const room = screenColumns - (showBox ? SHOW_BOX_CELLS : 0);
    const length = hint.length;
    if (length + GAP + LONG_CELLS <= room)
        return { label: LONG_LABEL, hintWidth: null, showBox };
    if (length + GAP + SHORT_CELLS <= room)
        return { label: SHORT_LABEL, hintWidth: null, showBox };
    const width = room - GAP - SHORT_CELLS;
    return { label: SHORT_LABEL, hintWidth: width < MIN_HINT ? 0 : width, showBox };
}
const LONG_LABEL = '/m:os dashboard';
const SHORT_LABEL = '/m:os';
const GAP = 2;
// A button is its label and 4 cells.
const LONG_CELLS = LONG_LABEL.length + 4;
const SHORT_CELLS = SHORT_LABEL.length + 4;
const SHOW_BOX_CELLS = GAP + 'Show box'.length + 4;
// A hint cut under 4 cells says nothing, so it is dropped.
const MIN_HINT = 4;
