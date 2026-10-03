import { RoomPicker } from '../components/slice/room-picker';
import { MosLogo } from '../components/mos-logo';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <MosLogo size="sm" />
      <h1 className="mos-h1 mt-8 text-4xl">Open a room</h1>
      <p className="mt-2 text-mos-muted">Rooms come from the MindrianOS server. Nothing here reads the disk.</p>
      <RoomPicker />
    </main>
  );
}
