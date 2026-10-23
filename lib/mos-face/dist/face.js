// The Theo face: the seven brand colors, the move colors, the labels and the plain-text faces, as pure
// data. Nothing here draws, and no pose is held here: the drawing of each state comes from the canon
// asset through hooks/theo-face.ts (Phase 380 plan 13, D-10). The old poses, the crew faces, their
// rasterizers and the tone HOLLOW were removed in that plan (README, section Visual change).
// ---- Brand colors (De Stijl primaries from the brand book) -----------------
export const PAPER = '#F7F5EE';
export const INK = '#111111';
export const WHITE = '#FFFFFF';
export const BLUE = '#1F3FBF';
export const RED = '#D6281F';
export const YELLOW = '#F2C200';
export const MUTED = '#4B4943';
export const MOVE_BG = {
    none: MUTED,
    blue: BLUE,
    red: RED,
    yellow: YELLOW,
    black: INK,
    white: WHITE,
};
export const MOVE_FG = {
    none: PAPER,
    blue: PAPER,
    red: PAPER,
    yellow: INK,
    black: PAPER,
    white: INK,
};
export const MOVE_NAME = {
    none: 'host',
    blue: 'building',
    red: 'challenging',
    yellow: 'contradiction',
    black: 'gate',
    white: 'hand-over',
};
// ---- Labels and plain-text faces --------------------------------------------------------------
// The label of each state is the visible label of the canon asset (mos-brand book e947a5d, segment
// identity/theo, asset-fa8504998f.json), as the asset spells it: Searching and Nothing found.
// tests/face-events.test.ts (W1) and tests/colors.test.tsx (K5) check this table against the asset
// text. The book's states table spells two of them in older words (Search, Limit); that conflict is
// recorded in the README for the book follow-ups. What happened stays in the detail line, in words.
export const LABEL = {
    rest: 'Rest',
    listen: 'Listening',
    search: 'Searching',
    found: 'Found',
    challenge: 'Challenge',
    contradiction: 'Contradiction',
    reframe: 'Reframe',
    limit: 'Nothing found',
    decision: 'Your decision',
    boundary: 'Boundary',
    handover: 'Handover',
};
// Plain-text faces for the words-only style, and for the panel when the asset file cannot be read
// (they also work with color stripped). Seven characters at most, one for each state.
export const LINE_FACE = {
    rest: '[o|o]',
    listen: '[O/o]',
    search: '[o/O]>',
    found: '[O/O]!',
    challenge: '[o\\O]',
    contradiction: '[o<>o]',
    reframe: '[o~o]',
    limit: '[. - .]',
    decision: '[O|O]?',
    boundary: '[x|x]',
    handover: '[o|o]*',
};
export function moveOf(glyph) {
    if (glyph === '🟦')
        return 'blue';
    if (glyph === '🟥')
        return 'red';
    if (glyph === '🟨')
        return 'yellow';
    if (glyph === '⬛')
        return 'black';
    return 'white';
}
// Two pixels per terminal row: merge neighbours of the same colors into runs.
// Works for any rectangle of pixels, not only the square faces.
export function gridRuns(grid) {
    const width = grid[0]?.length ?? 0;
    const rows = [];
    for (let k = 0; k < Math.floor(grid.length / 2); k++) {
        const runs = [];
        for (let c = 0; c < width; c++) {
            const top = grid[k * 2]?.[c] ?? '#FFFFFF';
            const bottom = grid[k * 2 + 1]?.[c] ?? '#FFFFFF';
            const last = runs[runs.length - 1];
            if (last && last.top === top && last.bottom === bottom)
                last.w += 1;
            else
                runs.push({ top, bottom, w: 1 });
        }
        rows.push(runs);
    }
    return rows;
}
