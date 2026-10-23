// Generated file. Do not edit by hand.
// Regenerate with: node ui/mos-face/scripts/face-jobs.cjs --write
// Source: lib/hmi/jtbd-taxonomy.json, the plugin's own list of jobs (id, one-line want, cues). The
// outcome of each job is the reviewed map of scripts/face-jobs.cjs. The check mode fails on drift.
// A job with shown false is never drawn on the panel (explore is the steady state, not a job).

export type Job = {
  id: string
  want: string
  cues: readonly string[]
  outcome: string
  shown: boolean
}
export const JOBS: readonly Job[] = [
  {
    "id": "decide-pursue",
    "want": "decide if a venture / opportunity / approach is worth pursuing",
    "cues": [
      "should we pursue",
      "go / no-go",
      "is this worth",
      "kill it or keep it",
      "pivot",
      "double down"
    ],
    "outcome": "I can say go or no-go and write down my reason",
    "shown": true
  },
  {
    "id": "find-problem",
    "want": "find the problem worth solving (not the symptom, the root)",
    "cues": [
      "what's the real problem",
      "why are users",
      "wrong problem",
      "five whys",
      "root cause",
      "first principles"
    ],
    "outcome": "I know the real problem in a sentence I can test",
    "shown": true
  },
  {
    "id": "understand-market",
    "want": "understand the market for this idea - size, structure, dynamics",
    "cues": [
      "market size",
      "TAM SAM SOM",
      "competitors",
      "industry",
      "market dynamics",
      "Porter"
    ],
    "outcome": "I can say how big the market is and who else is in it",
    "shown": true
  },
  {
    "id": "find-bottleneck",
    "want": "find the lagging component (Hughes 1983 reverse salient) blocking progress",
    "cues": [
      "lagging",
      "stuck",
      "reverse salient",
      "blocking",
      "bottleneck",
      "what's slow",
      "what's holding us back"
    ],
    "outcome": "I know which part to fix first",
    "shown": true
  },
  {
    "id": "prepare-pitch",
    "want": "prepare for an investor / partner / customer meeting",
    "cues": [
      "investor",
      "pitch deck",
      "demo day",
      "fundraising",
      "meeting on Tuesday",
      "stakeholder review"
    ],
    "outcome": "I walk in with the story ready and the hard questions covered",
    "shown": true
  },
  {
    "id": "validate-idea",
    "want": "test if an idea / hypothesis / claim holds up under scrutiny",
    "cues": [
      "test if",
      "validate",
      "does this hold up",
      "stress-test",
      "challenge",
      "Devil's Advocate",
      "red team"
    ],
    "outcome": "I know what holds up, what does not and what I still need to find out",
    "shown": true
  },
  {
    "id": "compare-options",
    "want": "compare alternatives across criteria - choose between A/B/C",
    "cues": [
      "compare",
      "A vs B",
      "tradeoffs",
      "options",
      "alternatives",
      "scenarios",
      "decision matrix"
    ],
    "outcome": "I can choose between the options and say why",
    "shown": true
  },
  {
    "id": "connect-domains",
    "want": "find cross-domain analogues - what does this look like in another field?",
    "cues": [
      "analogous",
      "similar to",
      "from another domain",
      "cross-domain",
      "biology of",
      "what's the equivalent in"
    ],
    "outcome": "I see what this looks like in another field and what that could teach me",
    "shown": true
  },
  {
    "id": "surface-contradiction",
    "want": "notice and resolve internal contradictions in the room",
    "cues": [
      "contradicts",
      "doesn't match",
      "earlier we said",
      "inconsistent",
      "this conflicts with",
      "challenge our own"
    ],
    "outcome": "I know which claims pull apart and which one I keep",
    "shown": true
  },
  {
    "id": "plan-execution",
    "want": "plan the next 90 days - milestones, owners, dates",
    "cues": [
      "plan",
      "next 90 days",
      "milestones",
      "roadmap",
      "what's next",
      "execution plan",
      "OKRs"
    ],
    "outcome": "I know the next 90 days, with owners and dates",
    "shown": true
  },
  {
    "id": "file-meeting",
    "want": "capture and route meeting intelligence into the room",
    "cues": [
      "transcript",
      "meeting",
      "Velma",
      "spoke with",
      "spoke to",
      "call yesterday"
    ],
    "outcome": "I can see what the meeting changes in my data room",
    "shown": true
  },
  {
    "id": "audit-room",
    "want": "audit Data Room health - gaps, drift, evidence tier, decision quality",
    "cues": [
      "is the room healthy",
      "audit",
      "drift",
      "what's missing",
      "gaps",
      "deep grade"
    ],
    "outcome": "I know where my data room is thin or out of step",
    "shown": true
  },
  {
    "id": "explore",
    "want": "no specific job - general thinking, talking, ranging",
    "cues": [],
    "outcome": "I notice what is worth following",
    "shown": false
  }
]
