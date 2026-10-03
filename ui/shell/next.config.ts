import type { NextConfig } from 'next';
import path from 'node:path';

// Standalone output so the production server is one self-contained directory. mos-ui-shared is
// TypeScript source and is compiled here. Telemetry is switched off by the build and start scripts
// (NEXT_TELEMETRY_DISABLED=1, DO_NOT_TRACK=1): Next has no config switch for it.
const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['mos-ui-shared'],
  poweredByHeader: false,
  turbopack: { root: path.resolve(import.meta.dirname) },
};

export default nextConfig;
