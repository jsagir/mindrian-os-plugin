'use client';
// The room picker (plan 369-32, skinned by plan 369-20): the root route's "No room open" state. It lists the rooms
// on this machine and opens one through the frame's room switcher, which owns the leave-a-decision confirmation
// (the header's RoomSelector uses the same switcher). Shows the UI-SPEC "No room open" and "no rooms" states.
// Room names render as React text, never as markup.
import { LAUNCH_COMMAND, NO_ROOM_OPEN, NO_ROOMS } from './copy.ts';
import { useShell } from './frame/shell-context.ts';
import { Rule } from './primitives/Rule.tsx';
import { TextAction } from './primitives/TextAction.tsx';

export function RoomPicker() {
  const { rooms, roomsState, current, openRoom } = useShell();

  if (roomsState === 'failed') {
    return (
      <section className="stack">
        <Rule />
        <h1>{NO_ROOM_OPEN.title}</h1>
        <p>{NO_ROOMS.body}</p>
      </section>
    );
  }

  if (roomsState === 'ready' && rooms.length === 0) {
    return (
      <section className="stack">
        <Rule />
        <h1>{NO_ROOMS.heading}</h1>
        <p>{NO_ROOMS.body}</p>
        <p>
          <code>{LAUNCH_COMMAND}</code>
        </p>
      </section>
    );
  }

  return (
    <section className="stack">
      <Rule />
      <p className="eyebrow">{current === null ? NO_ROOM_OPEN.title : current}</p>
      <h1>
        {NO_ROOM_OPEN.heading.before}
        <em>{NO_ROOM_OPEN.heading.emphasis}</em>
        {NO_ROOM_OPEN.heading.after}
      </h1>
      <p>{NO_ROOM_OPEN.body}</p>
      <ul className="room-list">
        {rooms.map((room) => (
          <li key={room.slug} className="room-list-row" aria-current={room.slug === current ? 'true' : undefined}>
            <span className="room-list-name">{room.slug}</span>
            {room.slug === current ? (
              <span className="room-list-status">Open now</span>
            ) : (
              <TextAction onClick={() => void openRoom(room.slug)}>Open this room</TextAction>
            )}
          </li>
        ))}
      </ul>
      <p className="caption">Opens it in this browser. Nothing in the room changes.</p>
    </section>
  );
}
