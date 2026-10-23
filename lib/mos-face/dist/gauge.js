import { contextBand } from './status';
// Fails to compile when a case of a switch is not handled.
export function assertNever(value) {
    throw new Error(`unhandled gauge case: ${String(value)}`);
}
const IDLE_WITH_BOXES = 'Context gauge: waiting for the first reply';
const IDLE_WITHOUT_BOXES = 'Context: waiting for the first reply';
// A figure the host really gave: a finite number. Zero is a reading, not a wait.
function isReading(percent) {
    return typeof percent === 'number' && !Number.isNaN(percent);
}
// The line of the context gauge. percent is the figure the host gives, or undefined when no reply
// has used any of the window yet. drawsBoxes is true when the canvas is drawn above the line. label is
// the field label of the status map (Context, or its short form); a reading starts with it.
export function gaugeText(percent, drawsBoxes, label) {
    if (!isReading(percent)) {
        return { kind: 'idle', drawsBoxes, text: drawsBoxes ? IDLE_WITH_BOXES : IDLE_WITHOUT_BOXES };
    }
    const band = contextBand(percent);
    switch (band.band) {
        case 'ok':
        case 'watch':
        case 'cliff':
            return { kind: 'reading', band: band.band, text: `${label} ${Math.round(percent)}% - ${band.words}` };
        case 'none':
            // contextBand says none only for no figure, which isReading has already ruled out.
            return { kind: 'idle', drawsBoxes, text: drawsBoxes ? IDLE_WITH_BOXES : IDLE_WITHOUT_BOXES };
        default:
            return assertNever(band.band);
    }
}
