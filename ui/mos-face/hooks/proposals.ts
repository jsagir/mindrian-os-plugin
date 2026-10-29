// Two PROPOSALS of plan 380-04, kept behind one boolean flag each.
//
// Both go beyond decision D-03 as written (the owner ruling of 2026-10-21: only brain_ask
// carries the cleaned 240-character excerpt of the person's own prompts, on by default, off
// with /mos-words, shown in full). A planner proposed them. They default to on. The
// navigator can veto either one in plan 11, section B.
//
//   shimOnlyExcerpt (P1)  The excerpt travels only through the guarded shim tool
//                         (mcp__plugin_mos_mindrian-brain__brain_ask). The fallback to the
//                         raw mcp__theo__brain_ask sends a framework name and a problem
//                         type only, because the raw server never passes
//                         lib/core/part8-egress-guard.cjs (CLAUDE.md, THEO-04).
//                         Off: the fallback may carry the excerpt, as the ruling reads.
//
//   envSwitch (P2)        The environment variable MOS_FACE_WORDS=off (also 0 and false, any
//                         case) at session start turns the excerpt off for good, because the
//                         /mos-words setting is proven not to survive a new session.
//                         Off: the variable is ignored and no text names it.
//
// How to veto: set the flag to false, run node scripts/build-mos-face.cjs (the build script
// that plan 380-05 adds), run claude plugin test in ui/mos-face, commit. The tests in tests/egress.test.ts read these
// flags and hold for both values of each, so a veto needs no re-plan and no test edit.

export type Proposals = {
  shimOnlyExcerpt: boolean
  envSwitch: boolean
}

export const PROPOSALS: Proposals = {
  shimOnlyExcerpt: true,
  envSwitch: true,
}
