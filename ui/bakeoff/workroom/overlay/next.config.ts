import type { NextConfig } from 'next';
import path from 'node:path';

// Candidate A (bake-off). Standalone output so the production server is one
// self-contained directory; mos-ui-shared is TypeScript source and is compiled
// here. Telemetry is switched off by NEXT_TELEMETRY_DISABLED=1 in build.sh and
// serve.sh (Next has no config switch for it).
const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['mos-ui-shared'],
  poweredByHeader: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
