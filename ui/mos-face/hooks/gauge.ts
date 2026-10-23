import { contextBand } from './status'

// The context gauge line (Phase 380 plan 17, G5, D-04 D-08 D-11).
//
// While no reply has used any of the window, the eight boxes of the canvas look like empty boxes.
// The words next to them say what they are. The boxes are not redrawn or dimmed: their pixels are
// pinned (tests/meter-pin.test.ts), and a dimmed fill would need a color the book does not have.
//
// Pure and erasable: no enum, no explicit any, no I/O.

export type GaugeLine =
  | { kind: 'idle'; drawsBoxes: boolean; text: string }
  | { kind: 'reading'; band: 'ok' | 'watch' | 'cliff'; text: string }

// Fails to compile when a case of a switch is not handled.
export function assertNever(value: never): never {
  throw new Error(`unhandled gauge case: ${String(value)}`)
}

// The line of the context gauge. percent is the figure the host gives, or undefined when no reply
// has used any of the window yet. drawsBoxes is true when the canvas is drawn above the line. label is
// the field label of the status map (Context, or its short form).
export function gaugeText(percent: number | undefined, drawsBoxes: boolean, label: string): GaugeLine {
  void percent
  void drawsBoxes
  void label
  void contextBand
  throw new Error('not implemented')
}
