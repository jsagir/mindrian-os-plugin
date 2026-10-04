import type { ReactNode } from 'react';
import '../client/styles/fonts.css';
import '../client/styles/tokens.css';
import '../client/styles/base.css';
import '../client/primitives/primitives.css';
import '../client/frame/frame.css';
import '../client/views/views.css';
import '../client/views/gate/gate.css';

export const metadata = { title: 'MindrianOS workspace' };

// The two files drawn above the fold, preloaded (Canon s14: fonts preloaded, layout shift under 0.1). The
// bundler resolves each URL to the same hashed file fonts.css references, under the shell's own /_next/static.
const PRELOAD = [
  new URL('../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2', import.meta.url),
  new URL('../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2', import.meta.url),
];

// No style attribute and no font host: a nonce does not cover a style attribute, and the browser contacts
// only 127.0.0.1 (Canon Part 8). The four fonts are bundled by fonts.css (relative url() into the walled
// package's own node_modules) and the token sheet is the one source of colour.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {PRELOAD.map((file) => (
          <link key={file.pathname} rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href={file.pathname} />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
