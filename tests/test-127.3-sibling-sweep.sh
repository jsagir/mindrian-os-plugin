#!/usr/bin/env bash
# Phase 127.3 Plan 03 -- structural tripwire test (Canon Part 7 sibling-sweep).
#
# Asserts that NO script in scripts/ or lib/ reads the room registry via the
# legacy-only broken pattern (`!reg.active_room || !Array.isArray(reg.rooms)`)
# that intentionally rejected the current "active + Object rooms" shape, which
# silently killed the JTBD memory layer for ~7 months. After 127.3 lands,
# every consumer MUST go through lib/core/resolve-active-room.cjs (the
# Plan 00 chokepoint), or be on the deferral allow-list with a TODO comment
# naming the venue.
#
# The pattern this scans for is the union of:
#   - `reg.active_room`             -- legacy registry shape, intentionally
#                                      rejected the current shape
#   - `Array.isArray(reg.rooms)`    -- legacy array-only iteration shape
#
# The shape-tolerant helpers in the chokepoint legitimately match both
# patterns (they BOTH support the legacy form AND the current form). The
# chokepoint is allow-listed.
#
# Bash only. No emoji. No em-dashes. No external deps. set -euo pipefail.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ALLOW list rationale (machine-readable + human-readable; ALLOW regex below
# matches these files; any new match outside the regex breaks the build):
#
# (1) lib/core/resolve-active-room.cjs -- THE chokepoint (Phase 127.3 Plan 00).
#     Both shapes legitimately appear here in the canonical branches; that is
#     the entire point of the chokepoint extraction. This is the canonical
#     home and is permanent.
#
# (2) scripts/memory-completion-detector.cjs TODO Phase 129: iterateRegisteredRooms chokepoint helper -- absorb onto canonical multi-room API; drop this ALLOW entry.
#     Multi-room iteration site (line 160: `Array.isArray(reg.rooms) ? reg.rooms : []`).
#     Plan 03's chokepoint API (single-active-room resolution) is NOT a drop-in
#     replacement for multi-room iteration. Per iteration-1 plan-check B-01
#     (Fix Path B) + CONTEXT.md D-01, this site is deferred to Phase 129
#     (spine-repair-memory-event), which will ship `iterateRegisteredRooms()`
#     on the same lib/core/resolve-active-room.cjs helper and reroute this
#     file onto the canonical multi-room API.
#
# (3) scripts/intent-classifier.cjs TODO Phase 129: registeredRoomNames multi-room scope-matching helper -- absorb onto canonical multi-room API when iterateRegisteredRooms ships.
#     Specifically the `registeredRoomNames` function around line 91
#     (`Array.isArray(reg.rooms)`). Plan 02 already rerouted this script's
#     `resolveActiveRoomDir()` (around line 680) through the chokepoint. The
#     remaining Array.isArray match is in the OTHER helper (registeredRoomNames)
#     that is used for SCOPE-MATCHING at unrelated call-sites; it is correct
#     shape-tolerant code on the non-resolveActiveRoomDir path. Per
#     iteration-1 plan-check landmine #2, this specific occurrence is
#     allow-listed.
#
# (4) scripts/memory-command.cjs TODO Phase 129: memory-command multi-room helpers -- absorb onto canonical multi-room API; drop this ALLOW entry.
#     Multi-room helpers around lines 108-139 (`getActiveRoom()` +
#     `getActiveRoomDir()`) that intentionally tolerate BOTH shapes for
#     resolution. This is the original shape-tolerant template PATTERNS.md
#     cites as one of the canonical sources Plan 00 modeled after. The script
#     needs multi-room iteration AND tolerant resolution; Phase 129 repoints
#     it onto the chokepoint.
#
# (5) scripts/operator-update.cjs TODO Phase 129: operator-update sibling hook -- absorb onto canonical single-active-room API; drop this ALLOW entry.
#     Broken pattern at lines 104-105. This file is a sibling hook to
#     operator-command.cjs (Task 4 of this plan) but is NOT in this plan's
#     `files_modified` set. Phase 127.3 Plan 03's scope is the 4 sibling-script
#     set named in the PATTERNS.md sibling-sweep targets table
#     (hmi-compliance-poll, jtbd-command, operator-command,
#     check-onboard-statusline). operator-update.cjs lives in the same family
#     and gets absorbed in Phase 129's spine-repair sweep alongside
#     memory-completion-detector.cjs.
#
# (6) scripts/memory-resume-nudge.cjs TODO Phase 129: memory-resume-nudge contributor surface -- absorb onto canonical single-active-room API; drop this ALLOW entry.
#     PATTERNS.md sibling-sweep targets table lists this file at line 134 as
#     tolerating both shapes via inline pattern. Out of scope for this plan's
#     4-file sibling-sweep set; Phase 129 absorption.
#
# (7) scripts/hmi-status-command.cjs TODO Phase 129: hmi-status-command sibling -- absorb onto canonical single-active-room API; drop this ALLOW entry.
#     Broken pattern at lines 101-102. Not enumerated in PATTERNS.md
#     sibling-sweep targets table because the empirical grep that mapped the
#     targets ran on a slightly earlier tree; surfaces now in the structural
#     tripwire. Out of scope for this plan's 4-file sibling-sweep set;
#     Phase 129 absorption.
#
# (8) lib/core/room-classifier-strict-mode.cjs TODO Phase 129: room-classifier-strict-mode multi-room helper -- absorb onto canonical multi-room API when iterateRegisteredRooms ships.
#     Array-tolerant scope helper at line 86. Multi-room iteration site;
#     Phase 129 territory.
#
# (9) lib/hmi/across-session-memory.cjs TODO Phase 129: across-session-memory cross-room scan -- absorb onto canonical multi-room API when iterateRegisteredRooms ships.
#     Array-tolerant cross-room scan at line 241. Multi-room iteration site;
#     Phase 129 territory.
ALLOW='lib/core/resolve-active-room\.cjs|scripts/memory-completion-detector\.cjs|scripts/intent-classifier\.cjs|scripts/memory-command\.cjs|scripts/operator-update\.cjs|scripts/memory-resume-nudge\.cjs|scripts/hmi-status-command\.cjs|lib/core/room-classifier-strict-mode\.cjs|lib/hmi/across-session-memory\.cjs'

MATCHES=$(grep -rnE 'reg\.active_room|Array\.isArray\(reg\.rooms\)' \
  "${REPO}/scripts/" "${REPO}/lib/" 2>/dev/null \
  | grep -vE "${ALLOW}" || true)

if [ -n "${MATCHES}" ]; then
  echo "FAIL: broken registry-resolution pattern found outside the chokepoint + deferral allow-list:" >&2
  echo "" >&2
  echo "${MATCHES}" >&2
  echo "" >&2
  echo "Every consumer of the room registry for single-active-room resolution MUST go through" >&2
  echo "lib/core/resolve-active-room.cjs (the Phase 127.3 Plan 00 chokepoint), or be on the" >&2
  echo "ALLOW list above with a TODO comment naming the venue (Phase 129)." >&2
  exit 1
fi

echo "PASS: 127.3 sibling-sweep tripwire (no broken registry-resolution sites outside the chokepoint + deferral allow-list; memory-completion-detector.cjs deferred to Phase 129)"
exit 0
