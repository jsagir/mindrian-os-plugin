import { renderShell } from './shell-page.tsx';

// Rendered per request: the CSRF meta tag and the sign-in check belong to one browser session.
export const dynamic = 'force-dynamic';

export default async function Page() {
  return renderShell(undefined);
}
