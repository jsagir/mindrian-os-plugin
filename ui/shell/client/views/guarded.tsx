'use client';
// A view needs an open room. With none open (or the room list still loading) the person gets the room picker's
// "No room open" state instead of an empty view that looks like an empty room.
import type { ComponentType } from 'react';
import { useShell } from '../frame/shell-context.ts';
import { RoomPicker } from '../RoomPicker.tsx';

export function requireRoom(View: ComponentType): ComponentType {
  function Guarded() {
    const { current } = useShell();
    if (current === null) return <RoomPicker />;
    return <View />;
  }
  Guarded.displayName = 'RequireRoom';
  return Guarded;
}
