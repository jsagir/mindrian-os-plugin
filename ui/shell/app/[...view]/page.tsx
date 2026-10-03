import { renderShell } from '../shell-page.tsx';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ view: string[] }> }) {
  const { view } = await params;
  return renderShell(view);
}
