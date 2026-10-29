const DEFAULT_ROOMS = '~/MindrianRooms';
const clean = (path) => path.trim().replace(/\\/g, '/').replace(/\/+$/, '');
// The engine wants a literal name in every $.env.get call, so the variables a module reads can be
// listed (claude plugin validate prints them, and tests/test-380-budget.cjs pins the list).
// HOME first, then USERPROFILE; an empty variable counts as not set. Empty when neither is set.
export async function homeDir($) {
    const home = clean((await $.env.get('HOME').catch(() => undefined)) ?? '');
    if (home !== '')
        return home;
    return clean((await $.env.get('USERPROFILE').catch(() => undefined)) ?? '');
}
// MINDRIAN_ROOMS_HOME when it is set and not empty, else the home folder plus /MindrianRooms.
// Empty when no variable names a folder at all.
export async function roomsHome($) {
    const set = clean((await $.env.get('MINDRIAN_ROOMS_HOME').catch(() => undefined)) ?? '');
    if (set !== '')
        return set;
    const home = await homeDir($);
    return home === '' ? '' : `${home}/MindrianRooms`;
}
// The plugin's own state folder: the Theo warm-up record, the install record, the room health file.
export async function mindrianDir($) {
    return `${await homeDir($)}/.mindrian`;
}
// The folder that holds the rooms, from the registry's root field. A missing field and the default
// written with a tilde both mean the rooms folder of this machine, so they follow MINDRIAN_ROOMS_HOME.
// Any other leading tilde is the home folder.
export async function registryRoot($, raw) {
    const text = typeof raw === 'string' ? clean(raw) : '';
    if (text === '' || text === DEFAULT_ROOMS)
        return roomsHome($);
    return text.replace(/^~/, await homeDir($));
}
// The folder name of a room when the terminal sits inside the rooms folder, else an empty string.
export async function workspaceOf($, cwd) {
    const base = await roomsHome($);
    if (base === '')
        return '';
    const rooms = `${base}/`;
    const here = `${clean(cwd)}/`;
    return here.startsWith(rooms) ? (here.slice(rooms.length).split('/')[0] ?? '') : '';
}
