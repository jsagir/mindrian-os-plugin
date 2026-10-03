import type { ReactNode } from 'react';

export const metadata = { title: 'MindrianOS workspace' };

// No style attribute and no font host: a nonce does not cover a style attribute, and the browser
// contacts only 127.0.0.1 (Canon Part 8). Plan 369-20 adds the bundled fonts and the token sheet.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
