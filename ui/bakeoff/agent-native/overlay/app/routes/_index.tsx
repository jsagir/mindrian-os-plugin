// Candidate B: the room list. One action (listRooms), one link per room into
// the slice. Nothing is stored by this app. Hyphens only.
import { useActionQuery } from "@agent-native/core/client/hooks";
import { Link } from "react-router";

import "../slice.css";

export function meta() {
  return [{ title: "Rooms" }];
}

type RoomRow = { slug?: string; name?: string; id?: string };

function roomsOf(data: unknown): RoomRow[] {
  const d = (data as { rooms?: unknown } | undefined)?.rooms as { rooms?: RoomRow[] } | RoomRow[] | null | undefined;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.rooms)) return d.rooms;
  return [];
}

export default function RoomsRoute() {
  const rooms = useActionQuery("list-rooms" as never, {} as never);
  const rows = roomsOf(rooms.data);
  return (
    <div className="mos-slice">
      <div className="wrap">
        <p className="eyebrow">01 / Rooms</p>
        <h1>
          Open a <em>room</em>
        </h1>
        {rooms.isError && <p className="err" role="alert">The room daemon did not answer. Nothing was changed.</p>}
        {rooms.isLoading && <p className="note">Reaching the daemon...</p>}
        <div className="rooms">
          {rows.map((r) => {
            const slug = String(r.slug || r.id || r.name || "");
            return slug ? (
              <Link key={slug} to={"/slice/" + encodeURIComponent(slug)}>
                {r.name || slug}
              </Link>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}
