import { roomsHome } from './paths';
export async function boundRoom($) {
    try {
        const id = await $.session.id();
        const text = await $.fs.read(`${await roomsHome($)}/.rooms/registry.json`);
        const registry = JSON.parse(String(text));
        const own = registry.sessions?.[id]?.room;
        if (typeof own === 'string' && own !== '')
            return { room: own, how: 'recorded for this session' };
        if (registry.active_session === id && typeof registry.active === 'string') {
            return { room: registry.active, how: 'recorded as the active session' };
        }
        return { room: null, how: 'no record for this session' };
    }
    catch {
        return { room: null, how: 'the registry could not be read' };
    }
}
