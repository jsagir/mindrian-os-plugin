'use client';
// The root route. With no room open it is the room picker (plan 369-32); once a room is open it is Work, the
// default view after a room opens (D-09). The picker stays reachable on a room that is open at /?rooms, so the
// person can still list the rooms from the root.
import { useEffect, useState } from 'react';
import { useShell } from '../frame/shell-context.ts';
import { RoomPicker } from '../RoomPicker.tsx';
import { WorkView } from './work/WorkView.tsx';

export function HomeRoute() {
  const { current, roomEpoch } = useShell();
  const [picker, setPicker] = useState(false);
  // The address asks for the picker (/?rooms) only on a page that has just loaded. A room opened from the picker
  // remounts the view with roomEpoch above zero: that person asked for the room, so the flag is dropped and Work shows.
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).has('rooms');
    if (asked && roomEpoch > 0) window.history.replaceState({}, '', window.location.pathname);
    setPicker(asked && roomEpoch === 0);
  }, [roomEpoch]);
  if (current === null || picker) return <RoomPicker />;
  return <WorkView />;
}
