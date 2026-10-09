'use strict';
module.exports = {
  declaredCouplings: () => new Set(),
  buildSubstrate: (db, o) => globalThis.__SUBSTRATE,
  _test: { abstractTerm: () => 'term' },
};
