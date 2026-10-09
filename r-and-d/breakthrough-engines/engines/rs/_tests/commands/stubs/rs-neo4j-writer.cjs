'use strict';
// HAND-MADE TEST STUB for the missing rs-neo4j-writer module (only the error class).
class AuraUnreachableError extends Error {
  constructor(message, meta) { super(message); this.name = 'AuraUnreachableError'; this.meta = meta || {}; }
}
module.exports = { AuraUnreachableError };
