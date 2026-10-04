// The gate view's pure model (plan 369-27, UI-SPEC "Gate Button Anatomy and States"). Two things live here and
// nothing else: toGateViewModel maps the Shape F gate contract (the card fields the shell server hands the page,
// plus the rendered contract's superset_options and the recommended option id) to what the page draws, and
// nextGateState is the answer state machine. No React, no browser, no fetch: the same module is imported by the
// CJS tests, which prove the web gate and the CLI card read one contract.
//
// Canon Part 3: the web gate is the fourth render of the one gate contract. It reads the contract's fields and never
// parses a zone's text. The recommended option id is read at `rendered.contract.recommended` (Phase 289, found by
// value on a live minted gate by plan 369-26's probe). Erasable TypeScript only.
import { gateApproveLabel, gateApproveMany, GATE, PROPOSAL_FROM_CLAUDE } from '../../copy.ts';

export type Verdict = 'approve' | 'reject' | 'defer';

// The names the web gate reads. tests/test-198-gate-renderers.test.cjs pins them against the live contract, so a
// rename in lib/mcp fails there, not in a browser.
export const CONTRACT_FIELDS = Object.freeze({
  superset: 'superset_options',
  optionKeys: Object.freeze(['id', 'label', 'description', 'rank', 'preview']),
  recommended: 'recommended',
  notice: 'notice',
  selectMode: 'multiSelect',
});
export const CARD_FIELDS = Object.freeze(['header', 'kind', 'select_mode', 'notice', 'approve_label', 'subject_node_id', 'evidence_node_ids']);
export const MCP_TOOLS = Object.freeze({ render: 'gate_render', answer: 'gate_answer' });

export type OptionIn = {
  id?: unknown;
  label?: unknown;
  description?: unknown;
  rank?: unknown;
  preview?: unknown;
  recommended?: unknown;
};

export type CardIn = {
  header?: unknown;
  kind?: unknown;
  select_mode?: unknown;
  notice?: unknown;
  approve_label?: unknown;
  subject_node_id?: unknown;
  evidence_node_ids?: unknown;
  options?: unknown;
  room?: unknown;
  // 'claude_code' when the card came from an agent proposal (the shell's proposeDecision path).
  proposal_from?: unknown;
  // false when the room relabelled the approve option because the claim is below the room's floor; null when unknown.
  floor_met?: unknown;
  // How many other gates wait (the view supplies it from the open-gates list).
  more_waiting?: unknown;
};

export type RenderedIn = { contract?: { superset_options?: unknown; recommended?: unknown; multiSelect?: unknown; notice?: unknown } | null } | null | undefined;

export type GateOption = {
  id: string;
  label: string;
  description: string;
  rank: number;
  rankText: string;
  preview: string;
  recommended: boolean;
};

export type GateViewModel = {
  header: string;
  roomName: string;
  subjectId: string | null;
  provenanceLine: string | null;
  notice: string | null;
  selectMode: 'single' | 'multi';
  options: GateOption[];
  recommendedId: string | null;
  preselected: string[];
  approveLabel: string;
  // The server's own approve_label (it relabels the option whose id is 'approve' only), or null.
  approveServerLabel: string | null;
  floorMet: boolean | null;
  evidenceIds: string[];
  moreWaiting: number;
};

export class GateMappingError extends Error {}

function asRec(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function text(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function textOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function twoDigits(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

// The options come from the rendered contract's superset (the shared tested superset); a card that carries its own
// options and no contract (nothing rendered yet) falls back to them so the view still draws the decision.
function sourceOptions(card: CardIn, rendered: RenderedIn): unknown[] {
  const contract = rendered ? asRec(rendered.contract) : null;
  if (contract && Array.isArray(contract.superset_options)) return contract.superset_options as unknown[];
  return Array.isArray(card.options) ? (card.options as unknown[]) : [];
}

export function toGateViewModel(card: CardIn, rendered: RenderedIn): GateViewModel {
  const contract = rendered ? asRec(rendered.contract) : null;
  const cardRec = asRec(card) ?? {};
  const multi = (contract && contract.multiSelect === true) || cardRec.select_mode === 'multi';
  const selectMode: 'single' | 'multi' = multi ? 'multi' : 'single';

  const seen = new Set<string>();
  const raw: Array<{ rank: number; index: number; option: GateOption }> = [];
  sourceOptions(card, rendered).forEach((entry, index) => {
    const o = asRec(entry);
    if (!o || typeof o.id !== 'string' || o.id === '' || typeof o.label !== 'string' || o.label === '' || seen.has(o.id)) return;
    seen.add(o.id);
    const rank = typeof o.rank === 'number' && Number.isFinite(o.rank) ? o.rank : Number.POSITIVE_INFINITY;
    raw.push({
      rank,
      index,
      option: { id: o.id, label: o.label, description: text(o.description), rank, rankText: '', preview: text(o.preview), recommended: o.recommended === true },
    });
  });
  // Ordered by rank, equal ranks keep the contract's order; the rank shows as two digits.
  raw.sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank));
  const options: GateOption[] = raw.map((r, position) => {
    const shown = Number.isFinite(r.rank) ? r.rank : position + 1;
    return { ...r.option, rank: shown, rankText: twoDigits(shown) };
  });

  // At most one recommended option on a single-select gate (the Shape F invariant): more is a mapping error.
  const flagged = options.filter((o) => o.recommended).map((o) => o.id);
  let recommendedId: string | null = null;
  if (selectMode === 'single') {
    if (flagged.length > 1) throw new GateMappingError('more than one option is recommended on a single-select gate: ' + flagged.join(', '));
    const fromContract = contract && typeof contract.recommended === 'string' && contract.recommended !== '' ? contract.recommended : null;
    if (fromContract !== null && !options.some((o) => o.id === fromContract)) {
      throw new GateMappingError('the recommended id is not one of the options: ' + fromContract);
    }
    recommendedId = fromContract ?? (flagged.length === 1 ? flagged[0]! : null);
    // The option flags follow the one id the contract names.
    for (const o of options) o.recommended = recommendedId !== null && o.id === recommendedId;
  }
  const preselected = selectMode === 'single' ? (recommendedId !== null ? [recommendedId] : []) : flagged;

  const subject = textOrNull(cardRec.subject_node_id);
  const evidence = Array.isArray(cardRec.evidence_node_ids) ? (cardRec.evidence_node_ids as unknown[]).filter((v): v is string => typeof v === 'string' && v !== '') : [];
  const moreWaiting = typeof cardRec.more_waiting === 'number' && cardRec.more_waiting > 0 ? Math.floor(cardRec.more_waiting) : 0;

  const vm: GateViewModel = {
    header: text(cardRec.header),
    roomName: text(cardRec.room),
    subjectId: subject,
    provenanceLine: cardRec.proposal_from === 'claude_code' ? PROPOSAL_FROM_CLAUDE : null,
    notice: textOrNull(contract ? contract.notice : null) ?? textOrNull(cardRec.notice),
    selectMode,
    options,
    recommendedId,
    preselected,
    approveLabel: '',
    approveServerLabel: textOrNull(cardRec.approve_label),
    floorMet: typeof cardRec.floor_met === 'boolean' ? cardRec.floor_met : null,
    evidenceIds: Array.from(new Set(evidence)),
    moreWaiting,
  };
  vm.approveLabel = approveLabelFor(vm, preselected);
  return vm;
}

// "Approve: {label}", "Approve {n} answers" for several, or the server's own approve_label when the one option it
// relabels (id 'approve') is the whole selection.
export function approveLabelFor(vm: GateViewModel, selected: string[]): string {
  const chosen = vm.options.filter((o) => selected.includes(o.id));
  if (chosen.length > 1) return gateApproveMany(chosen.length);
  if (chosen.length === 1) {
    if (vm.approveServerLabel !== null && chosen[0]!.id === 'approve') return vm.approveServerLabel;
    return gateApproveLabel(chosen[0]!.label);
  }
  return 'Approve';
}

// The consequence line under the primary action: nothing chosen, the room's floor not met, or the plain promise.
export function consequenceFor(vm: GateViewModel, selected: string[]): string {
  if (selected.length === 0) return GATE.chooseFirst;
  return vm.floorMet === false ? GATE.consequenceBelowFloor : GATE.consequenceMet;
}

const REJECT_IDS = ['reject', 'decline', 'no'];
const DEFER_IDS = ['hold', 'defer', 'later', 'wait'];

// What `chosen` carries for each verdict. An approve names what the person selected. A reject or a defer names the
// option that says so when the card has one (so the record reads as what the person did), and otherwise the
// person's selection, and otherwise the first option: gate_answer needs at least one id from the card.
export function chosenFor(vm: GateViewModel, verdict: Verdict, selected: string[]): string[] {
  if (verdict === 'approve') return selected.slice();
  const wanted = verdict === 'reject' ? REJECT_IDS : DEFER_IDS;
  const named = vm.options.find((o) => wanted.includes(o.id.toLowerCase()));
  if (named) return [named.id];
  if (selected.length > 0) return selected.slice();
  return vm.options.length > 0 ? [vm.options[0]!.id] : [];
}

// ---------------------------------------------------------------------------------------------
// The answer state machine (UI-SPEC States table)
// ---------------------------------------------------------------------------------------------

export type RefusalKey = 'stale_subject' | 'room_switched' | 'gate_expired' | 'unknown_gate' | 'session_mismatch' | 'human_only';
export type ReadyErrorKey = 'persistence_failed' | 'choice_refused' | 'not_saved';

export type GateState =
  | { phase: 'opening' }
  | { phase: 'ready'; error?: ReadyErrorKey }
  | { phase: 'saving'; verdict: Verdict }
  | { phase: 'checking'; verdict: Verdict; attempt: number }
  | { phase: 'recorded'; verdict: Verdict; replayed: boolean }
  | { phase: 'refused'; refusal: RefusalKey; room?: string };

export type GateEvent =
  | { type: 'opened' }
  | { type: 'open_answered'; verdict: Verdict }
  | { type: 'open_failed'; answer: unknown }
  | { type: 'submit'; verdict: Verdict }
  | { type: 'lost' }
  | { type: 'answer'; answer: unknown };

export const INITIAL_GATE_STATE: GateState = { phase: 'opening' };

const REFUSALS: Record<string, RefusalKey> = {
  stale_subject: 'stale_subject',
  room_switched: 'room_switched',
  gate_expired: 'gate_expired',
  unknown_gate: 'unknown_gate',
  // The chain tools' older slug, said in the same words as a gate that is no longer open.
  unknown_or_expired_gate: 'unknown_gate',
  session_mismatch: 'session_mismatch',
  human_only: 'human_only',
};

// Refused before anything is taken, the gate still answerable: the page shows the choice again.
const CHOICE_REFUSALS = new Set([
  'chosen_not_approving',
  'verdict_chosen_mismatch',
  'not_a_chain_gate',
  'chosen_not_in_card_options',
  'bad_input',
]);

// The transport could not say: the answer may or may not have been saved, so the page checks by gate id.
const TRANSPORT_UNKNOWN = new Set(['mcp_unavailable', 'answer_unreadable']);

// Gates whose record the shell drops (nothing left to answer); the others stay open.
export const DROPS_THE_GATE = new Set(['unknown_gate', 'gate_expired', 'unknown_or_expired_gate']);

export type Classified =
  | { kind: 'recorded'; replayed: boolean; verdict: Verdict | null }
  | { kind: 'refused'; refusal: RefusalKey; room?: string }
  | { kind: 'ready'; error: ReadyErrorKey }
  | { kind: 'lost' };

function asVerdict(v: unknown): Verdict | null {
  return v === 'approve' || v === 'reject' || v === 'defer' ? v : null;
}

// One server answer -> which row of the UI-SPEC table it is. "recorded" comes only from ok:true: a missing or
// unreadable answer is never taken for a save.
export function classifyAnswer(answer: unknown): Classified {
  const a = asRec(answer);
  if (!a) return { kind: 'lost' };
  if (a.ok === true) return { kind: 'recorded', replayed: a.replayed === true, verdict: asVerdict(a.verdict) };
  const reason = typeof a.reason === 'string' ? a.reason : '';
  if (reason in REFUSALS) {
    const out: { kind: 'refused'; refusal: RefusalKey; room?: string } = { kind: 'refused', refusal: REFUSALS[reason]! };
    if (typeof a.room === 'string') out.room = a.room;
    return out;
  }
  if (reason === 'persistence_failed') return { kind: 'ready', error: 'persistence_failed' };
  if (CHOICE_REFUSALS.has(reason)) return { kind: 'ready', error: 'choice_refused' };
  if (TRANSPORT_UNKNOWN.has(reason)) return { kind: 'lost' };
  return { kind: 'ready', error: 'not_saved' };
}

function mapAnswer(state: GateState, answer: unknown): GateState {
  const verdict: Verdict = state.phase === 'saving' || state.phase === 'checking' ? state.verdict : 'approve';
  const c = classifyAnswer(answer);
  switch (c.kind) {
    case 'recorded':
      return { phase: 'recorded', verdict: c.verdict ?? verdict, replayed: c.replayed };
    case 'refused':
      return c.room !== undefined ? { phase: 'refused', refusal: c.refusal, room: c.room } : { phase: 'refused', refusal: c.refusal };
    case 'ready':
      return { phase: 'ready', error: c.error };
    case 'lost':
      return { phase: 'checking', verdict, attempt: state.phase === 'checking' ? state.attempt + 1 : 1 };
  }
}

export function nextGateState(state: GateState, event: GateEvent): GateState {
  switch (event.type) {
    case 'opened':
      return state.phase === 'opening' ? { phase: 'ready' } : state;
    case 'open_answered':
      return state.phase === 'opening' ? { phase: 'recorded', verdict: event.verdict, replayed: true } : state;
    case 'open_failed': {
      if (state.phase !== 'opening') return state;
      const c = classifyAnswer(event.answer);
      if (c.kind === 'refused') return c.room !== undefined ? { phase: 'refused', refusal: c.refusal, room: c.room } : { phase: 'refused', refusal: c.refusal };
      // A gate that cannot be read at all is a gate with nothing to answer.
      return { phase: 'refused', refusal: 'unknown_gate' };
    }
    case 'submit':
      return state.phase === 'ready' ? { phase: 'saving', verdict: event.verdict } : state;
    case 'lost':
      if (state.phase === 'saving') return { phase: 'checking', verdict: state.verdict, attempt: 1 };
      if (state.phase === 'checking') return { phase: 'checking', verdict: state.verdict, attempt: state.attempt + 1 };
      return state;
    case 'answer':
      return state.phase === 'saving' || state.phase === 'checking' ? mapAnswer(state, event.answer) : state;
  }
}

// True while an answer is not confirmed saved: the session indicator's risk tier (plan 369-24) follows this.
export function answerPending(state: GateState): boolean {
  return state.phase === 'saving' || state.phase === 'checking';
}

// Options, actions and the selection stop answering while an answer is in flight or settled.
export function actionsEnabled(state: GateState): boolean {
  return state.phase === 'ready';
}
