// Small pure formatters for the views (UI-SPEC Opening screen: "relative under 24 hours such as 2h ago,
// otherwise 2 Oct 2026"). No React, no DOM; erasable TypeScript.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "2 Oct 2026" in the person's own day.
export function formatDay(value: string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return '';
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

// "just now", "5m ago", "2h ago" under 24 hours, else "2 Oct 2026". Empty when the time is unknown.
export function timeLabel(value: string | number | null | undefined, now: number = Date.now()): string {
  const d = toDate(value);
  if (!d) return '';
  const diff = now - d.getTime();
  if (diff < 0 || diff >= 24 * 3600 * 1000) return formatDay(value);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + 'm ago';
  return Math.floor(minutes / 60) + 'h ago';
}

export function capitalize(word: string): string {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
}

// Evidence rows are every node except the room's structure: its sections and its question frame.
export function isStructural(type: string | undefined): boolean {
  const t = String(type || '').toLowerCase();
  return t === 'section' || t === 'frame';
}

// A source_path the document display can ask the room for: a room-relative Markdown file. Many nodes carry a
// synthetic handle instead ("meeting:ab12:inline", "system:hsi-to-graph"); those have no document to show.
export function readableDocumentPath(path: string | undefined): string | null {
  if (typeof path !== 'string' || path.trim() === '') return null;
  const p = path.trim();
  if (p.startsWith('/') || p.startsWith('\\') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(p) || p.split(/[\\/]/).includes('..')) return null;
  return /\.md$/i.test(p) ? p : null;
}

// The review states that count as settled (UI-SPEC Decisions view).
export const SETTLED_STATUSES = ['confirmed', 'validated', 'rejected', 'superseded', 'invalidated', 'stale'];
export const OPEN_STATUSES = ['proposed', 'needs_evidence'];

// Words for a settled row (D-08: attributed in words). Confirmed or validated carry "by you" because only a
// person confirms a truth claim (Canon Part 9); the day is named when the room recorded one.
export function attribution(status: string | undefined, confirmedBy: string | undefined, confirmedAt: string | undefined): string {
  const s = String(status || '').toLowerCase();
  const day = formatDay(confirmedAt);
  const human = typeof confirmedBy === 'string' && confirmedBy.length > 0 && confirmedBy !== 'system';
  const head = s === 'confirmed' ? 'Confirmed' : s === 'validated' ? 'Validated' : capitalize(s.replace(/_/g, ' '));
  if ((s === 'confirmed' || s === 'validated') && human) return head + ' by you' + (day ? ', ' + day : '');
  return head + (day ? ', ' + day : '');
}

// The room's question as a sentence. The room document in the copy carries the question card's own text
// ("Governing question (version 1 of 2): {question}" then Origin, Set at and Change lines, or "No governing
// question recorded yet."), so the question itself is read out of that text. Text in a shape this does not
// recognise is returned whole rather than dropped; an empty string means the room has no question.
export function questionOf(rendered: string | undefined | null): string {
  const text = typeof rendered === 'string' ? rendered.trim() : '';
  if (text === '') return '';
  const m = /Governing question \(version \d+ of \d+\):\s*([\s\S]*?)\s*(?:\r?\n\s*Origin:|$)/.exec(text);
  if (m && m[1]) return m[1].trim();
  if (/No governing question recorded yet\./.test(text)) return '';
  return text;
}
