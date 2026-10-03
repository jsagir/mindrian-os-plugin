'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { action } from '../../lib/slice-api';

export function RoomPicker() {
  const [rooms, setRooms] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    action<{ ok?: boolean; rooms?: string[]; reason?: string }>('listRooms', {}).then(
      (r) => {
        if (!live) return;
        if (r.body.ok === false || !Array.isArray(r.body.rooms)) setError(r.body.reason || 'The server did not list rooms.');
        else setRooms(r.body.rooms);
      },
      () => live && setError('The server could not be reached.'),
    );
    return () => {
      live = false;
    };
  }, []);

  if (error) return <p className="mt-6 border-2 border-mos-red p-3 text-sm" role="alert">{error}</p>;
  if (!rooms) return <p className="mt-6 font-mono text-sm text-mos-muted">Loading rooms...</p>;
  if (rooms.length === 0) return <p className="mt-6 text-sm">No rooms yet.</p>;
  return (
    <ul className="mt-6 flex flex-col gap-2">
      {rooms.map((r) => (
        <li key={r}>
          <Link
            href={'/slice/' + encodeURIComponent(r)}
            className="block border-2 border-mos-black bg-mos-soft px-4 py-3 font-mono text-sm shadow-[2px_2px_0_0_var(--color-mos-black)] hover:-translate-y-0.5"
          >
            {r}
          </Link>
        </li>
      ))}
    </ul>
  );
}
