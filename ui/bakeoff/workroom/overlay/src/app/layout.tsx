import type { Metadata } from 'next';
import './globals.css';
import './slice.css';

// No Google-font loader from Next: it fetches the font files from a font host at build time
// and the browser would then contact an outside host (Canon Part 8). The
// bake-off uses the UI-SPEC fallback stacks (slice.css); bundled fonts are plan 20's.
export const metadata: Metadata = {
  title: 'MindrianOS - Workroom slice (bake-off A)',
  description: 'The D-05 vertical slice on the workroom chassis.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" style={{ colorScheme: 'light' }}>
      <body className="min-h-full flex flex-col bg-mos-paper text-mos-black">{children}</body>
    </html>
  );
}
