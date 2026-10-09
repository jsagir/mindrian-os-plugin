'use strict';
// HAND-MADE TEST STUB for the missing Phase 196 guard. Tests normally inject
// opts.classify; this default only needs to exist so the module loads.
module.exports = { classify: function () { return { verdict: 'allow' }; } };
