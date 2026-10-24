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
