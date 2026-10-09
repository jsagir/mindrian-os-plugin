'use strict';
// HAND-MADE TEST STUB. Not the shipped module. Mimics only the API surface
// the files under test use (class name, meta.surface).
class ExternalEgressViolation extends Error {
  constructor(message, meta) {
    super(message);
    this.name = 'ExternalEgressViolation';
    this.meta = meta || {};
  }
}
module.exports = { ExternalEgressViolation };
