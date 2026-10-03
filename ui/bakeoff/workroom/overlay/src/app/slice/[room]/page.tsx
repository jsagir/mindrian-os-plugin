import { SliceClient } from '../../../components/slice/slice-client';

export const dynamic = 'force-dynamic';

// The page is a thin server shell: every room read and write happens through
// the action routes, so the server renders nothing about a room itself.
export default async function SlicePage({
  params,
  searchParams,
}: {
  params: Promise<{ room: string }>;
  searchParams: Promise<{ artifact?: string }>;
}) {
  const { room } = await params;
  const { artifact } = await searchParams;
  return <SliceClient room={decodeURIComponent(room)} artifact={artifact || 'STATE.md'} />;
}
