// Which real event shows which canon face (Phase 380 plan 13, D-10, MOD380-09).
//
// The rule: a state is mapped only where a real event exists. The 11 states and their ids are the
// ones of the canon asset (mos-brand book e947a5d, segment identity/theo, asset-fa8504998f.json).
// A state that no event reaches is listed in UNMAPPED_STATES and stays unmapped.
// tests/face-events.test.ts (W2) fails when an event maps to an id that is not in the asset, when a
// canon id is neither mapped nor listed as unmapped, and when a listed id is also mapped.
//
// The reply marker: the persona leads a reply with one colored square (blue building, red
// challenging, yellow contradiction, black gate, white deliverable). The marker is a real event of
// the reply text. In the canon colors (foundations/color) yellow stands for contradiction or
// reframe, and the marker alone does not say which of the two; the persona marker names it
// contradiction, so the yellow square maps to Contradiction. Reframe has no marker and no other
// event, so it stays unmapped. Blue and white lead a finished answer, which is a handover.
// The 11 ids, in the order of the asset.
export const FACE_STATES = [
    'rest',
    'listen',
    'search',
    'found',
    'challenge',
    'contradiction',
    'reframe',
    'limit',
    'decision',
    'boundary',
    'handover',
];
// Event name to state. The names are this panel's own labels for the events it already hears.
export const EVENT_STATES = {
    // A turn began and Theo is attending.
    'turn.start': 'listen',
    // A call is running.
    'tool.call': 'search',
    // A call returned material (this does not say the material is right).
    'tool.ok': 'found',
    // A call returned nothing, or failed.
    'tool.empty': 'limit',
    'tool.failed': 'limit',
    // The permission mode refused a call, or the model refused.
    'tool.denied': 'boundary',
    'turn.refusal': 'boundary',
    // A turn finished with an answer (this does not say the project is done).
    'turn.complete': 'handover',
    // The turn ended on an error, with nothing to show.
    'turn.error': 'limit',
    // The person interrupted the turn, or the session is quiet.
    'turn.aborted': 'rest',
    // The lead square of a reply.
    'lead.red': 'challenge',
    'lead.yellow': 'contradiction',
    'lead.black': 'decision',
};
// The canon states that no real event reaches.
export const UNMAPPED_STATES = ['reframe'];
// The state of one event, by the name used in EVENT_STATES. The panel sets every state through this
// function, so the table above and the running panel cannot drift apart. An unknown name is Rest.
export function stateFor(event) {
    return EVENT_STATES[event] ?? 'rest';
}
// The state a finished answer shows, from the glyph that leads it.
export function stateForLead(glyph) {
    if (glyph === '\u{1F7E5}')
        return EVENT_STATES['lead.red'] ?? 'handover';
    if (glyph === '\u{1F7E8}')
        return EVENT_STATES['lead.yellow'] ?? 'handover';
    if (glyph === '⬛')
        return EVENT_STATES['lead.black'] ?? 'handover';
    return EVENT_STATES['turn.complete'] ?? 'handover';
}
