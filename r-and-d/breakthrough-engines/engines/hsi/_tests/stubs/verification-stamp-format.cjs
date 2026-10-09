'use strict';
module.exports = {
  formatStampLines: () => ['  stamp'],
  assertNoScalar: (lines) => {
    for (const l of lines) if (/\b\d+\.\d+\b/.test(l)) throw new Error('scalar leaked: ' + l);
    return { lines };
  },
};
