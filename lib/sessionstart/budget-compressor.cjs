/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-00 -- SessionStart Coordinator: budget compressor (D-14 + D-15).
 *
 * BUDGET_CHARS = 2000 hard cap (D-14, uniform across CLI/Desktop/Cowork).
 *
 * Algorithm (D-15 iterative compression):
 *   1. Sort fragments by priority ascending (top first).
 *   2. Filter has_payload === true.
 *   3. Try full_payload for all -- if total <= budget, done.
 *   4. Else: walk lowest-priority -> highest, swap to one_line_pointer one at
 *      a time. Recompute. Repeat until total <= budget.
 *   5. If all at pointer-only and STILL over: drop from the bottom (lowest
 *      priority first) until under budget. Track in dropped[].
 *
 * Body format: fragments joined with \n\n (one blank line). No decoration,
 * no chrome, no dividers, no emoji (Canon Part 8 + SKILL.md no-emoji rule
 * for additionalContext).
 *
 * Returns: { body: string, dropped: string[], compressed: string[] }.
 *
 * Pure CJS, node built-ins only. Zero new runtime dependencies.
 */
'use strict';

const BUDGET_CHARS = 2000;

function totalBytes(items, useFull) {
  let sum = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (useFull[i]) sum += it.bytes_full;
    else sum += it.bytes_pointer;
  }
  // Plus \n\n joiner between adjacent items (2 bytes each, items-1 joiners).
  if (items.length > 1) sum += (items.length - 1) * 2;
  return sum;
}

function buildBody(items, useFull, droppedIds) {
  const pieces = [];
  for (let i = 0; i < items.length; i++) {
    if (droppedIds.has(items[i].id)) continue;
    pieces.push(useFull[i] ? items[i].full_payload : items[i].one_line_pointer);
  }
  return pieces.join('\n\n');
}

/**
 * compressUntilUnderBudget(fragments, budgetChars)
 *   fragments  : ContributorFragment[]
 *   budgetChars: number (defaults BUDGET_CHARS)
 *   returns    : { body, dropped, compressed }
 */
function compressUntilUnderBudget(fragments, budgetChars) {
  const budget = Number.isInteger(budgetChars) && budgetChars > 0 ? budgetChars : BUDGET_CHARS;

  // Filter + sort. Lowest priority number = highest precedence (top).
  const live = (Array.isArray(fragments) ? fragments : [])
    .filter((f) => f && f.has_payload === true)
    .slice()
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));

  if (live.length === 0) {
    return { body: '', dropped: [], compressed: [] };
  }

  // Parallel arrays: useFull[i] starts true, flips false when compressed.
  const useFull = live.map(() => true);
  const droppedIds = new Set();
  const compressedIds = [];

  // Pass 1: try all-full. If under, done.
  if (totalBytes(live, useFull) <= budget) {
    return {
      body: buildBody(live, useFull, droppedIds),
      dropped: [],
      compressed: [],
    };
  }

  // Pass 2: walk lowest-priority (highest index) down, swap to pointer.
  for (let i = live.length - 1; i >= 0; i--) {
    if (!useFull[i]) continue;
    useFull[i] = false;
    compressedIds.push(live[i].id);
    if (totalBytes(live, useFull) <= budget) {
      return {
        body: buildBody(live, useFull, droppedIds),
        dropped: [],
        compressed: compressedIds.slice(),
      };
    }
  }

  // Pass 3: all at pointer-only but still over budget. Drop from the bottom.
  for (let i = live.length - 1; i >= 0; i--) {
    if (droppedIds.has(live[i].id)) continue;
    droppedIds.add(live[i].id);
    // Recompute by excluding dropped from totalBytes -- inline the calculation:
    let sum = 0;
    let remaining = 0;
    for (let j = 0; j < live.length; j++) {
      if (droppedIds.has(live[j].id)) continue;
      sum += useFull[j] ? live[j].bytes_full : live[j].bytes_pointer;
      remaining++;
    }
    if (remaining > 1) sum += (remaining - 1) * 2;
    if (sum <= budget || remaining === 0) {
      return {
        body: buildBody(live, useFull, droppedIds),
        dropped: Array.from(droppedIds),
        compressed: compressedIds.slice(),
      };
    }
  }

  // All dropped (pathological): empty body.
  return {
    body: '',
    dropped: Array.from(droppedIds),
    compressed: compressedIds.slice(),
  };
}

module.exports = {
  BUDGET_CHARS,
  compressUntilUnderBudget,
};
