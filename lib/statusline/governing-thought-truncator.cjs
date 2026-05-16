// lib/statusline/governing-thought-truncator.cjs -- Phase 121.5-03 Task 2 Step 3
//
// Truncation helpers for the two-row statusline. Pure functions; no fs, no
// process.env reads. Caller supplies any width caps. Designed so tests can
// exercise edge cases (boundary values, non-string inputs, undefined caps)
// without spinning up the renderer.
//
// Canon Part 7 (consolidation): one place that decides "this thought is too
// long for the row." Surface this here, not in every renderer.

'use strict';

const MAX_THOUGHT = 40; // chars
const DEFAULT_ROOM_CAP = 18; // chars

/**
 * Truncate a governing thought to MAX_THOUGHT chars, appending "..." when cut.
 * Strings <= MAX_THOUGHT chars pass through verbatim.
 * Non-string input returns ''.
 */
function truncateThought(thought) {
  if (typeof thought !== 'string') return '';
  if (thought.length <= MAX_THOUGHT) return thought;
  return thought.slice(0, MAX_THOUGHT - 3) + '...';
}

/**
 * Truncate a room name to `cap` chars (default 18), appending "..." when cut.
 * Strings <= cap chars pass through verbatim.
 * Non-string input returns ''.
 * Caller may pass a numeric cap; non-numeric or undefined falls back to default.
 */
function truncateRoom(room, cap) {
  if (typeof room !== 'string') return '';
  const limit = typeof cap === 'number' && cap > 3 ? cap : DEFAULT_ROOM_CAP;
  if (room.length <= limit) return room;
  return room.slice(0, limit - 3) + '...';
}

module.exports = {
  truncateThought,
  truncateRoom,
  MAX_THOUGHT,
  DEFAULT_ROOM_CAP,
};
