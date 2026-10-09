'use strict';
// HAND-MADE TEST STUB. The real FORBIDDEN_PATTERNS live in cross-room-aggregator
// (not in this slice). These patterns are a simplified stand-in (email pattern omitted: it is not known whether the shipped patterns include one).
const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const FORBIDDEN_PATTERNS = [
  /meeting_transcript/i,
  /decision_log/i,
  /governing_thought/i,
  /\b\d{3}-\d{3}-\d{4}\b/,
  /\bSSN\b/,
];
function auditQueryString(s, surface) {
  if (typeof s !== 'string') return s;
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(s)) throw new ExternalEgressViolation('forbidden pattern', { surface: surface });
  }
  return s;
}
function auditQueryObject(obj, surface) {
  const s = JSON.stringify(obj);
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(s)) throw new ExternalEgressViolation('forbidden pattern', { surface: surface });
  }
  return obj;
}
module.exports = { FORBIDDEN_PATTERNS, auditQueryString, auditQueryObject };
