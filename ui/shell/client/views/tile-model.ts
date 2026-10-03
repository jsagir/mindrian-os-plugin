// The tile mapping (D-11, UI-SPEC "Five-Square State Language with Written Statuses"). Pure, erasable
// TypeScript: no React, no DOM. tileFor(item, ctx) says which of the five Larry squares a room item carries and
// the words that go with it. A tile never travels without its words, so the result always has a status.
//
// Room states to tiles (lib/core/navigation/transitions.cjs review_status values and edges):
//   blue   PROPOSED                                                  (proposed, no open gate)
//   red    CONFIRMED, VALIDATED, NEEDS EVIDENCE, STALE, REJECTED, INVALIDATED
//   yellow CONTRADICTION                                             (the item touches a CONTRADICTS edge)
//   black  WAITING FOR YOU (an open gate on the item), DECIDED (a decision node)
//   white  DELIVERED, EMPTY, SUPERSEDED
// One mark per row. Precedence: black over yellow over red over blue over white. The other applicable states are
// written after the primary one: "WAITING FOR YOU . CONFIRMED . CONTRADICTION".
import type { Tile } from '../primitives/TileMark.tsx';

export type TileItem = {
  // The room's review_status (proposed, confirmed, ...). Absent means the room never moved it: it is proposed.
  status?: string | null;
  // decision: a recorded decision node. deliverable: a document handed over. Anything else is an ordinary node.
  kind?: 'node' | 'decision' | 'deliverable';
  // An empty section.
  empty?: boolean;
};

export type TileContext = {
  // An open gate names this item as its subject.
  openGate: boolean;
  // The title of the item on the other end of a CONTRADICTS edge, or null when the item has none.
  contradicts: string | null;
};

export type TileResult = {
  tile: Tile;
  // The full written status: the primary state first, the other states after it, joined by " . ".
  status: string;
  // The primary state alone.
  primary: string;
  // Words the row adds beside the mark, for example "Contradicts {title}".
  extra: string[];
};

type Entry = { tile: Tile; word: string };

const RANK: Record<Tile, number> = { black: 0, yellow: 1, red: 2, blue: 3, white: 4 };

const STATUS_WORDS: Record<string, Entry> = {
  proposed: { tile: 'blue', word: 'PROPOSED' },
  confirmed: { tile: 'red', word: 'CONFIRMED' },
  validated: { tile: 'red', word: 'VALIDATED' },
  needs_evidence: { tile: 'red', word: 'NEEDS EVIDENCE' },
  stale: { tile: 'red', word: 'STALE' },
  rejected: { tile: 'red', word: 'REJECTED' },
  invalidated: { tile: 'red', word: 'INVALIDATED' },
  superseded: { tile: 'white', word: 'SUPERSEDED' },
};

export const STATUS_JOIN = ' . ';

function statusEntry(status: string | null | undefined): Entry {
  const key = typeof status === 'string' ? status.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
  if (key === '') return STATUS_WORDS.proposed!;
  const known = STATUS_WORDS[key];
  if (known) return known;
  // A word the room uses that the table does not know is written as it is, on the white tile: never reinterpreted.
  return { tile: 'white', word: key.replace(/_/g, ' ').toUpperCase() };
}

export function tileFor(item: TileItem, ctx: TileContext): TileResult {
  // Written order: the gate, the decision, the review state (or delivered, or empty), then the contradiction.
  const entries: Entry[] = [];
  const extra: string[] = [];
  if (ctx.openGate) entries.push({ tile: 'black', word: 'WAITING FOR YOU' });
  if (item.kind === 'decision') entries.push({ tile: 'black', word: 'DECIDED' });
  if (item.kind === 'deliverable') {
    entries.push({ tile: 'white', word: 'DELIVERED' });
  } else if (item.empty === true) {
    entries.push({ tile: 'white', word: 'EMPTY' });
  } else if (item.kind === 'decision') {
    // A decision's verdict is written after DECIDED when the room recorded one; it never defaults to proposed.
    if (typeof item.status === 'string' && item.status.trim() !== '') entries.push(statusEntry(item.status));
  } else {
    entries.push(statusEntry(item.status));
  }
  if (typeof ctx.contradicts === 'string' && ctx.contradicts.length > 0) {
    entries.push({ tile: 'yellow', word: 'CONTRADICTION' });
    extra.push('Contradicts ' + ctx.contradicts);
  }

  // The mark is the highest-precedence state (black, yellow, red, blue, white; the first written wins a tie).
  let primary = entries[0]!;
  for (const e of entries) if (RANK[e.tile] < RANK[primary.tile]) primary = e;
  // The primary state is written first, the others after it in written order, each word once.
  const words: string[] = [primary.word];
  for (const e of entries) if (!words.includes(e.word)) words.push(e.word);
  return { tile: primary.tile, status: words.join(STATUS_JOIN), primary: primary.word, extra };
}

export type RelationLike = { source?: string; target?: string; type?: string };

// Which item sits on the other end of a CONTRADICTS edge: id -> the other item's id (the first one found).
export function contradictionPartners(relations: RelationLike[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of relations) {
    if (!r || String(r.type || '').toUpperCase() !== 'CONTRADICTS') continue;
    const a = typeof r.source === 'string' ? r.source : '';
    const b = typeof r.target === 'string' ? r.target : '';
    if (!a || !b) continue;
    if (!out.has(a)) out.set(a, b);
    if (!out.has(b)) out.set(b, a);
  }
  return out;
}
