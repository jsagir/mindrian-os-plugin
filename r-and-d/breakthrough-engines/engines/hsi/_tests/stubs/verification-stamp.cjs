'use strict';
module.exports = {
  loadFrameworkNames: () => new Set(['JTBD', 'MECE']),
  extractCarried: (raw, title) => ({ raw, title }),
  resolveEndpoint: (carried) => ({ name: null, via: null }),
  stampFindings: async (findings) => findings.map(() => ({ tier: 'unverified' })),
  stampFinding: async () => ({ tier: 'unverified' }),
  toNodeProps: (s) => ({ stamp_tier: s.tier }),
};
