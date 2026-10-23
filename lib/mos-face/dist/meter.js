import { BLUE, INK, PAPER, RED, WHITE, YELLOW } from './face';
// The context meter: a blank De Stijl canvas that fills with the canon colors as
// the conversation uses up its window. Black lines frame blank paper cells; the
// cells are painted one after another, each from its bottom edge up, until the
// painted share of the colorable area equals the percent consumed. A few cells
// stay white for good, so a full window is a full painting, not a flood.
//
// The color never carries the figure alone: the percent is always printed beside it.
const X_LINES = [0.22, 0.58, 0.82];
const Y_LINES = [0.35, 0.72];
// The compact composition: the same four columns, two rows.
const COMPACT_Y_LINES = [0.5];
// Columns and rows of the 4 x 3 composition, in the order they are painted.
const ORDER = [
    { col: 0, row: 2, color: BLUE },
    { col: 3, row: 2, color: YELLOW },
    { col: 3, row: 1, color: BLUE },
    { col: 1, row: 1, color: RED },
    { col: 0, row: 0, color: YELLOW },
    { col: 2, row: 0, color: BLUE },
];
// width x height pixels; height should be even so it draws in whole terminal rows.
const COMPACT_ORDER = [
    { col: 0, row: 1, color: BLUE },
    { col: 3, row: 1, color: YELLOW },
    { col: 1, row: 0, color: RED },
    { col: 3, row: 0, color: BLUE },
    { col: 0, row: 0, color: YELLOW },
];
export function contextCanvas(percent, width, height) {
    const w = Math.max(12, width);
    const h = Math.max(6, height % 2 === 0 ? height : height + 1);
    const compact = h < 10;
    const order = compact ? COMPACT_ORDER : ORDER;
    const pixels = Array.from({ length: h }, () => Array(w).fill(PAPER));
    const xs = [0, ...X_LINES.map(f => Math.round(f * (w - 1))), w - 1];
    const ys = [0, ...(compact ? COMPACT_Y_LINES : Y_LINES).map(f => Math.round(f * (h - 1))), h - 1];
    // Only the inner lines are ink. The outer ring stays paper, so on an ink ground
    // the canvas reads as a bright framed tile with black lines across it.
    for (const x of xs.slice(1, -1)) {
        for (let r = 0; r < h; r++) {
            const row = pixels[r];
            if (row)
                row[x] = INK;
        }
    }
    for (const y of ys.slice(1, -1)) {
        const line = pixels[y];
        if (line)
            for (let c = 0; c < w; c++)
                line[c] = INK;
    }
    // Every interior pixel of the painted cells, bottom row first.
    const cells = order.map(cell => {
        const x0 = (xs[cell.col] ?? 0) + 1;
        const x1 = (xs[cell.col + 1] ?? w - 1) - 1;
        const y0 = (ys[cell.row] ?? 0) + 1;
        const y1 = (ys[cell.row + 1] ?? h - 1) - 1;
        const list = [];
        for (let r = y1; r >= y0; r--)
            for (let c = x0; c <= x1; c++)
                list.push([r, c]);
        return { color: cell.color, list };
    });
    const total = cells.reduce((sum, cell) => sum + cell.list.length, 0);
    const share = percent === undefined ? 0 : Math.min(100, Math.max(0, percent));
    let left = Math.round((share / 100) * total);
    const painted = left;
    for (const cell of cells) {
        for (const [r, c] of cell.list) {
            if (left <= 0)
                break;
            const row = pixels[r];
            if (row)
                row[c] = cell.color;
            left -= 1;
        }
    }
    // The white cells are drawn explicitly so a blank canvas reads as paper, not as a gap.
    for (let r = 0; r < h; r++) {
        const row = pixels[r];
        if (row)
            for (let c = 0; c < w; c++)
                if (row[c] === PAPER)
                    row[c] = WHITE;
    }
    return { pixels, painted, total };
}
export function contextWord(percent) {
    if (percent === undefined)
        return 'waiting for the first reply';
    if (percent < 60)
        return 'room to think';
    if (percent < 85)
        return 'filling up';
    return 'nearly full';
}
