// Generated file. Do not edit by hand.
// Regenerate with: node ui/mos-face/scripts/face-commands.cjs --write
// TERM_COMMANDS and STATE_COMMANDS: framework -> /mos: commands, resolved with the plugin's own
// resolver (lib/workflow/command-resolver.cjs commandsForFramework), never typed from memory. They
// are kept as they are; the --check mode fails when one names a command the registry no longer holds.
// WHY: the first sentence of each command teaching line in data/command-registry.json, in plain
// words (the override map of scripts/face-commands.cjs replaces a sentence that holds a stack word).
import type { FaceState } from '../types'

export const TERM_COMMANDS: Record<string, { framework: string; commands: string[] }> = {
  "Problem First": {
    "framework": "Problem Definition Transformation Framework",
    "commands": [
      "/mos:diagnose"
    ]
  },
  "Systematic Innovation": {
    "framework": "Domain Selection",
    "commands": [
      "/mos:explore-domains"
    ]
  },
  "Innovation": {
    "framework": "PWS Triple Validation Compass",
    "commands": [
      "/mos:compare-ventures",
      "/mos:deep-grade"
    ]
  },
  "Problem Type Progression": {
    "framework": "Problem Definition Transformation Framework",
    "commands": [
      "/mos:diagnose"
    ]
  },
  "Taxonomy of Problems": {
    "framework": "Problem Definition Transformation Framework",
    "commands": [
      "/mos:diagnose"
    ]
  },
  "Un-defined Problem": {
    "framework": "Domain Selection",
    "commands": [
      "/mos:explore-domains"
    ]
  },
  "Systems Thinking": {
    "framework": "Systems Thinking",
    "commands": [
      "/mos:analyze-systems",
      "/mos:systems-thinking"
    ]
  },
  "Problem Worth Solving": {
    "framework": "Problem Definition Transformation Framework",
    "commands": [
      "/mos:diagnose"
    ]
  },
  "Why-What If-How": {
    "framework": "Beautiful Question Framework",
    "commands": [
      "/mos:beautiful-question"
    ]
  },
  "Problem Statement": {
    "framework": "Problem Definition Transformation Framework",
    "commands": [
      "/mos:diagnose"
    ]
  },
  "Ill-defined Problem": {
    "framework": "Problem Definition Transformation Framework",
    "commands": [
      "/mos:diagnose"
    ]
  },
  "Well-defined Problem": {
    "framework": "Problem Definition Transformation Framework",
    "commands": [
      "/mos:diagnose"
    ]
  },
  "Job Statement": {
    "framework": "Jobs to Be Done (JTBD)",
    "commands": [
      "/mos:analyze-needs",
      "/mos:discover"
    ]
  },
  "Jobs-to-be-Done Theory": {
    "framework": "Jobs to Be Done (JTBD)",
    "commands": [
      "/mos:analyze-needs",
      "/mos:discover"
    ]
  },
  "Emotional Job": {
    "framework": "Jobs to Be Done (JTBD)",
    "commands": [
      "/mos:analyze-needs",
      "/mos:discover"
    ]
  },
  "Functional Job": {
    "framework": "Jobs to Be Done (JTBD)",
    "commands": [
      "/mos:analyze-needs",
      "/mos:discover"
    ]
  },
  "Extensive Searching": {
    "framework": "Domain Selection",
    "commands": [
      "/mos:explore-domains"
    ]
  },
  "Intensive Searching": {
    "framework": "Domain Selection",
    "commands": [
      "/mos:explore-domains"
    ]
  },
  "Weak Signals": {
    "framework": "PEST Analysis",
    "commands": [
      "/mos:macro-trends"
    ]
  },
  "Signals of Change": {
    "framework": "PEST Analysis",
    "commands": [
      "/mos:macro-trends"
    ]
  },
  "Root Cause Analysis": {
    "framework": "Root Cause Analysis",
    "commands": [
      "/mos:causal",
      "/mos:root-cause"
    ]
  },
  "Systems Analysis": {
    "framework": "Systems Thinking",
    "commands": [
      "/mos:analyze-systems",
      "/mos:systems-thinking"
    ]
  },
  "Orthodoxy": {
    "framework": "Red Teaming",
    "commands": [
      "/mos:challenge-assumptions"
    ]
  },
  "Reverse Salient": {
    "framework": "Reverse Salient Analysis",
    "commands": [
      "/mos:find-bottlenecks",
      "/mos:rs-experts"
    ]
  },
  "Macro Trends": {
    "framework": "PEST Analysis",
    "commands": [
      "/mos:macro-trends"
    ]
  },
  "Future-Back": {
    "framework": "Scenario Planning",
    "commands": [
      "/mos:explore-futures",
      "/mos:scenario-plan"
    ]
  },
  "Futures Wheel": {
    "framework": "Futures Wheel",
    "commands": [
      "/mos:futures"
    ]
  },
  "Logic Tree": {
    "framework": "MECE (Mutually Exclusive, Collectively Exhaustive)",
    "commands": [
      "/mos:structure-argument"
    ]
  },
  "Innovation Formula": {
    "framework": "Usher's Model of Cumulative Synthesis",
    "commands": [
      "/mos:find-connections"
    ]
  },
  "Medici Effect": {
    "framework": "Four Lenses of Innovation",
    "commands": [
      "/mos:find-analogies"
    ]
  },
  "Leverage Point": {
    "framework": "Systems Thinking",
    "commands": [
      "/mos:analyze-systems",
      "/mos:systems-thinking"
    ]
  },
  "Opportunity Sweet Spot": {
    "framework": "Jobs to Be Done (JTBD)",
    "commands": [
      "/mos:analyze-needs",
      "/mos:discover"
    ]
  },
  "Cross-Scenario Pattern": {
    "framework": "Scenario Planning",
    "commands": [
      "/mos:explore-futures",
      "/mos:scenario-plan"
    ]
  },
  "Dominant Design": {
    "framework": "Dominant Design",
    "commands": [
      "/mos:dominant-designs"
    ]
  },
  "Importance-Satisfaction": {
    "framework": "Jobs to Be Done (JTBD)",
    "commands": [
      "/mos:analyze-needs",
      "/mos:discover"
    ]
  },
  "Non-consumers": {
    "framework": "Jobs to Be Done (JTBD)",
    "commands": [
      "/mos:analyze-needs",
      "/mos:discover"
    ]
  },
  "Knightian uncertainty": {
    "framework": "Knowns and Unknowns Matrix Framework",
    "commands": [
      "/mos:map-unknowns"
    ]
  },
  "Era of Ferment": {
    "framework": "Dominant Design",
    "commands": [
      "/mos:dominant-designs"
    ]
  },
  "Solution-Jumping Trap": {
    "framework": "Problem Definition Transformation Framework",
    "commands": [
      "/mos:diagnose"
    ]
  },
  "TAM Trap": {
    "framework": "Lean Canvas",
    "commands": [
      "/mos:lean-canvas"
    ]
  },
  "Scenario Planning": {
    "framework": "Scenario Planning",
    "commands": [
      "/mos:explore-futures",
      "/mos:scenario-plan"
    ]
  },
  "Presentism": {
    "framework": "Scenario Planning",
    "commands": [
      "/mos:explore-futures",
      "/mos:scenario-plan"
    ]
  },
  "Era of Incremental Change": {
    "framework": "S-Curve Analysis",
    "commands": [
      "/mos:analyze-timing",
      "/mos:explore-trends"
    ]
  },
  "Red Teaming": {
    "framework": "Red Teaming",
    "commands": [
      "/mos:challenge-assumptions"
    ]
  },
  "Unintended Consequences": {
    "framework": "Systems Thinking",
    "commands": [
      "/mos:analyze-systems",
      "/mos:systems-thinking"
    ]
  },
  "Overshoot": {
    "framework": "S-Curve Analysis",
    "commands": [
      "/mos:analyze-timing",
      "/mos:explore-trends"
    ]
  },
  "Overshooting": {
    "framework": "S-Curve Analysis",
    "commands": [
      "/mos:analyze-timing",
      "/mos:explore-trends"
    ]
  },
  "Terms of Competition": {
    "framework": "Dominant Design",
    "commands": [
      "/mos:dominant-designs"
    ]
  },
  "Destruction Dynamics": {
    "framework": "S-Curve Analysis",
    "commands": [
      "/mos:analyze-timing",
      "/mos:explore-trends"
    ]
  },
  "Commoditization": {
    "framework": "Dominant Design",
    "commands": [
      "/mos:dominant-designs"
    ]
  },
  "Robust Strategy": {
    "framework": "Scenario Planning",
    "commands": [
      "/mos:explore-futures",
      "/mos:scenario-plan"
    ]
  },
  "Strategic Options": {
    "framework": "Scenario Planning",
    "commands": [
      "/mos:explore-futures",
      "/mos:scenario-plan"
    ]
  },
  "Strong Value Proposition": {
    "framework": "PWS Value Proposition",
    "commands": [
      "/mos:build-thesis",
      "/mos:validate-proposition"
    ]
  },
  "Business Case": {
    "framework": "Lean Canvas",
    "commands": [
      "/mos:lean-canvas"
    ]
  },
  "Variation-Selection-Retention": {
    "framework": "Dominant Design",
    "commands": [
      "/mos:dominant-designs"
    ]
  },
  "Value Proposition": {
    "framework": "PWS Value Proposition",
    "commands": [
      "/mos:build-thesis",
      "/mos:validate-proposition"
    ]
  },
  "Pains & Gains": {
    "framework": "PWS Value Proposition",
    "commands": [
      "/mos:build-thesis",
      "/mos:validate-proposition"
    ]
  }
}

export const STATE_COMMANDS: Record<FaceState, string[]> = {
  "rest": [
    "/mos:status",
    "/mos:suggest-next"
  ],
  "listen": [
    "/mos:diagnose"
  ],
  "search": [],
  "found": [
    "/mos:find-connections"
  ],
  "none": [
    "/mos:map-unknowns"
  ],
  "refused": [
    "/mos:doctor"
  ],
  "handover": [
    "/mos:suggest-next",
    "/mos:status"
  ]
}

export const DOCTOR = "/mos:doctor"

export const WHY: Record<string, string> = {
  "/mos:diagnose": "When you cannot tell if this is an Ill-Defined or Well-Defined Problem, /mos:diagnose classifies it against the PWS matrix",
  "/mos:explore-domains": "When the problem could live in any of several domains, /mos:explore-domains maps the territory through IKA and Feynman decomposition",
  "/mos:compare-ventures": "When you are weighing your approach against ventures that tried this before, /mos:compare-ventures lines them up on the dimensions that matter",
  "/mos:deep-grade": "When you need a calibrated grade on the room's quality, /mos:deep-grade scores it against 100+ real student projects",
  "/mos:analyze-systems": "When you need to find where leverage lives in a complex system, /mos:analyze-systems decomposes it into layers and surfaces the leverage points",
  "/mos:systems-thinking": "When the dynamics matter more than the parts, /mos:systems-thinking maps feedback loops, stocks, and flows",
  "/mos:beautiful-question": "When the framing feels stuck, /mos:beautiful-question reshapes the challenge as Why / What-if / How",
  "/mos:analyze-needs": "When you need to know which customer jobs matter most, /mos:analyze-needs scores them by importance versus satisfaction",
  "/mos:discover": "When you have a client or a product and need to understand it before you design or build, /mos:discover runs a guided one-question-at-a-time conversation across six movements and lands a Discovery Brief plus a scaffolded Data Room",
  "/mos:macro-trends": "When you need to map the forces shaping a domain, /mos:macro-trends runs PEST across Political, Economic, Social, and Technological dimensions",
  "/mos:causal": "When you suspect the visible problem is downstream of something else, /mos:causal traces causal edges in the room's graph",
  "/mos:root-cause": "When the symptom keeps coming back, /mos:root-cause traces it via 5-Whys, Fishbone, and Fault Tree",
  "/mos:challenge-assumptions": "When an idea feels too clean, /mos:challenge-assumptions runs Devil's Advocate against the load-bearing claims",
  "/mos:find-bottlenecks": "When progress feels stuck and you cannot say where, /mos:find-bottlenecks runs Reverse Salient analysis to name the lagging component",
  "/mos:rs-experts": "When you need to know who in the world is working on a reverse salient you found, /mos:rs-experts resolves the expert network from your local room mirror, populated by /mos:rs-fetch",
  "/mos:explore-futures": "When the path forward branches into multiple plausible futures, /mos:explore-futures synthesizes TTA, Scenario, and S-Curve views",
  "/mos:scenario-plan": "When the future could go two different ways on two key uncertainties, /mos:scenario-plan builds the 2x2 matrix and names each quadrant",
  "/mos:futures": "When you need to see the invisible cross-domain ripples a linear mind misses, /mos:futures turns a seed concept into a bounded multi-ring consequence wheel, scans for hidden bridges with HSI, and banks the opportunities",
  "/mos:structure-argument": "When an argument is muddled and you cannot say why, /mos:structure-argument restructures it with Minto pyramid, SCQA, and MECE",
  "/mos:find-connections": "When you suspect your work touches a pattern in another field, /mos:find-connections traces cross-domain links through the graph",
  "/mos:find-analogies": "When the answer might live in another field, /mos:find-analogies runs SAPPhIRE and TRIZ against your problem to surface cross-domain matches",
  "/mos:dominant-designs": "When you are wondering if the market has settled on a winning design, /mos:dominant-designs runs Utterback-Abernathy to spot it",
  "/mos:map-unknowns": "When you cannot tell what you do not know, /mos:map-unknowns plots known, unknown, and unknowable in a Rumsfeld matrix",
  "/mos:lean-canvas": "When you need the whole business model on one page, /mos:lean-canvas fills the nine boxes from your room data",
  "/mos:analyze-timing": "When you need to know if your technology is too early, too late, or right on time, /mos:analyze-timing places it on the S-Curve",
  "/mos:explore-trends": "When today's trends could become tomorrow's problems, /mos:explore-trends pushes them to extremes to surface the second-order effects",
  "/mos:build-thesis": "When you need to know if this venture is worth pursuing, /mos:build-thesis runs the Ten-Questions investment thesis gate",
  "/mos:validate-proposition": "When you have a value proposition but no proof it holds, /mos:validate-proposition scores it against the three PWS VP gates with sequential math",
  "/mos:status": "When you need a fast read on the room's current state, /mos:status shows the governing thought per section plus health glyphs",
  "/mos:suggest-next": "When you finish a step and want Theo to recommend the next move, /mos:suggest-next reads the room graph and proposes 3-5 options with reasons",
  "/mos:doctor": "When something feels off with the install, /mos:doctor diagnoses install-cache drift, ROOM.md gaps, statusline visibility, and UI compliance",
  "/mos:act": "When you have analyses on the table but no clear next step, /mos:act picks the best-fit methodology for your current room state and runs it",
  "/mos:admin": "When you need to inspect or rotate your Theo access keys, /mos:admin opens the admin panel",
  "/mos:agentshield": "When you want to know whether the plugin's own tools, hooks, skills, CLAUDE.md, and dependencies carry a known attack pattern, /mos:agentshield scans all five and reports what is clean and what is flagged",
  "/mos:auto-explore": "The room normally starts this domain decomposition on its own the moment a new artifact lands. /mos:auto-explore is the fallback: use it by hand only when the ambient run could not start on this surface",
  "/mos:bono": "When you have a wicked question and need a structured argument rather than one opinion, /mos:bono spawns a governed research swarm across the (subdomain x hat) grid, each persona bound to its hat's scrutiny discipline and its own wired sources, then debates the readings as a sequential inter-hat argument over a graph-proposed what-if hypothesis",
  "/mos:brain-derive": "When a room section drifts from its Theo context file, /mos:brain-derive rebuilds that file now",
  "/mos:build-knowledge": "When you have data but not yet wisdom, /mos:build-knowledge climbs Ackoff's DIKW pyramid across the room",
  "/mos:correct-reference-now": "When you see today's real date diverge from what the room thinks now is, /mos:correct-reference-now writes the true calendar date into the reference seam so every delta Theo speaks (you raised this 3 days ago) stays honest",
  "/mos:dashboard": "When you need to see the whole room at a glance, /mos:dashboard opens the live or snapshot view in De Stijl layout",
  "/mos:deck": "When your room is full but the story is not yet a deck, /mos:deck asks one thing: which shape fits (Feynman to make it clear, HEART to make it land, or mesh to do both), then walks the structure section by section, filling each from your own room and binding the MindrianOS look by default",
  "/mos:diagnostics": "When you need a quantitative read on the room, /mos:diagnostics runs the Wave-1 fingerprint: disruption, blindspot, novelty, surprise",
  "/mos:dial-memory-refresh": "When a section's Dial Memory feels stale, /mos:dial-memory-refresh rebuilds the auto-section from the SELECTED_REACH / PIVOTED / DRSCH relationship layer",
  "/mos:diffusion": "When you are working on a dual-use or deep-tech innovation and need to know if it will actually spread - and to whom first - /mos:diffusion runs the Adoption-Capacity Engine over it",
  "/mos:dogfood-flush": "When you want the plugin's own venture room to reflect your latest edits immediately, /mos:dogfood-flush drains the PostToolUse queue and regenerates the Live (auto) section in STATE.md",
  "/mos:eureka": "When you want to see where your room's ideas cross-pollinate into fundable opportunities, /mos:eureka recalls cross-domain pairs from your room's graph, researches them as a perspective of the research planner, and files the supported ones only on your yes",
  "/mos:explain-decision": "When Theo made a recommendation and you want to know why, /mos:explain-decision shows the Navigation Engine trace for the last turn",
  "/mos:explore-opportunity": "A qualified opportunity is still conceptual: a connection without a defined problem. /mos:explore-opportunity runs the analysis chain (deep research, diffusion timing, analogies, web validation) and files a Minto-shaped explored artifact - a governing thought backed by cited sources and typed graph evidence",
  "/mos:export": "When you need to share a Data Room view with someone outside the room, /mos:export packages it as a De Stijl HTML artifact",
  "/mos:feynman-timeline-refresh": "When a section's FEYNMAN.md timeline feels stale, /mos:feynman-timeline-refresh rebuilds the auto-section from the memory event log",
  "/mos:file-meeting": "When a meeting just happened, /mos:file-meeting captures the transcript and routes the intelligence into the right room sections",
  "/mos:funding": "When you need to track grants and investors as a real pipeline, /mos:funding manages the lifecycle from spotted to applied to decided",
  "/mos:grade-grant": "Grant reviewers score against a fixed rubric whether you see it or not. /mos:grade-grant runs that rubric on your draft BEFORE you submit, so the gaps a human reviewer would flag show up here first",
  "/mos:grade": "When you want a fast read on problem-discovery quality, /mos:grade scores the room on six components in under a minute",
  "/mos:graph": "When you want to ask the knowledge graph a question without writing Cypher, /mos:graph translates plain English into the right traversal",
  "/mos:hat-briefing": "When you have run several Six Hats sessions and need them consolidated, /mos:hat-briefing pulls the hat memory into one briefing",
  "/mos:heal": "Deprecated alias",
  "/mos:help": "When the surface feels overwhelming, /mos:help is a selector: 11 command families across 3 cards, each family's commands are the options, and the one you pick runs",
  "/mos:hmi-status": "Deprecated alias",
  "/mos:ignite": "Theo walks you through three birth gates (starting point, blueprint approve, first win) so every new room begins with a clear JTBD, the right section set, and one bankable opportunity",
  "/mos:ingest-methodology": "Maintainer-only",
  "/mos:intel-pipeline": "When you have a room and a question but no time to run the research by hand, /mos:intel-pipeline reads your active JTBD, breaks it into research dimensions, fans out a small set of evidence passes, scores them, and closes the loop into your graph",
  "/mos:jtbd": "When you need to see or set the active job-to-be-done for this room, /mos:jtbd shows the per-room signal that tells Theo what kind of work you are doing right now",
  "/mos:leadership": "When the team feels wrong-shaped for the stage, /mos:leadership diagnoses which leadership pattern you actually need",
  "/mos:memory-cortex-reach": "When a governing thought you set has gone stale, or a fresh contradiction has just landed against a claim, your memory cortex has something to tell you. /mos:memory-cortex-reach is the navigator-facing surface the orchestrator dispatches to bring that signal to a Decision Gate",
  "/mos:memory": "When you need to inspect what the room remembers, /mos:memory shows the three layers: within-session, across-session, and cross-room",
  "/mos:models": "When you want to see or switch which model routes which kind of work, /mos:models opens the routing profile",
  "/mos:mos-reason": "When a section needs its MINTO face generated against its artifacts, /mos:mos-reason produces the pyramid: governing thought down to grounded support",
  "/mos:mos": "When you do not know which /mos:* surface to invoke, /mos:mos picks the right one",
  "/mos:mullins": "When you need to screen an opportunity against seven domains, /mos:mullins runs the 7-Domains Model from Mullins' New Business Road Test",
  "/mos:mva-brief": "When you have just typed a venture sentence and want a brief in under a minute, /mos:mva-brief runs the 6-agent fan-out and deploys a shareable deck",
  "/mos:mva-option": "When the 3-option footer shows after an MVA brief, /mos:mva-option routes your pick (refine / build a room / iterate) into the right next move",
  "/mos:mva-report": "When you have finished a conversation with Theo and want to see whether it fired the right things at the right time (did it reach a conclusion or circle, did it elevate across frames, did the gates fire), run /mos:mva-report",
  "/mos:new-project": "When you are starting a new venture, /mos:new-project creates the room scaffolding and registers it in the room registry",
  "/mos:new-surface": "When you are adding a new command, agent, or skill to the harness, /mos:new-surface emits the surface .md with the correct 11-key connector frontmatter so its wiring is declared, never hand-written, then regenerates the connector-registry (its real home) and the harness-manifest wiring digest",
  "/mos:onboard": "When you just installed MindrianOS, /mos:onboard walks you through the system and builds your first room",
  "/mos:operator": "When you want to see or set how Theo should render right now, /mos:operator shows the conversation state machine: JUST_TALK, EXPLORE_CAPTURE, BUILD_ROOM, METHODOLOGY, or DECISION_GATE",
  "/mos:opportunities": "When you need to manage grants as a live pipeline rather than a list, /mos:opportunities surfaces the Opportunity Bank with HSI scores and decision states",
  "/mos:organize": "Deprecated alias",
  "/mos:persona": "When you need fresh perspectives on the room, /mos:persona generates Six-Hats lenses from your room data",
  "/mos:pipeline": "When you want several methodologies chained instead of run one-by-one, /mos:pipeline executes a multi-step pipeline with the room as the connecting tissue",
  "/mos:present": "When you need to walk someone through the room visually, /mos:present generates the 6-view presentation and opens it",
  "/mos:publish": "When the Data Room is ready to share publicly, /mos:publish deploys the presentation to Vercel with a one-click link",
  "/mos:qualify-opportunity": "When the harvest sensor surfaces a candidate, /mos:qualify-opportunity puts the decision where it belongs: with you",
  "/mos:radar": "When new Claude capabilities ship that might change what MindrianOS can do, /mos:radar tracks them so you do not have to",
  "/mos:reanalyze": "When a meeting was filed earlier and the room has since grown, /mos:reanalyze re-runs the cascade pattern detection",
  "/mos:research": "When you need fresh evidence from the web cross-referenced with Theo's methodology graph, /mos:research runs the dual-source pull",
  "/mos:room": "When you need to view the active Data Room, /mos:room opens it. /mos:room question shows the room's governing question with its origin and history, and asks what the old question got wrong before a changed question is recorded",
  "/mos:rooms": "When you have multiple venture rooms and need to switch, list, or archive them, /mos:rooms manages the registry",
  "/mos:rs-explain": "When you have a question about a Reverse Salient discovery, /mos:rs-explain takes natural language in and returns a Theo-voiced explanation grounded in the graph",
  "/mos:rs-fetch": "When you need the full Reverse Salient pipeline run on a topic, /mos:rs-fetch executes the discovery end-to-end: corpus, math, cross-domain match, thesis",
  "/mos:rs-thesis": "When you ran a Reverse Salient discovery earlier and want the thesis read back, /mos:rs-thesis surfaces the analytic conclusion in plain language",
  "/mos:scheduled-tasks": "When you want Cowork to run something on a schedule against this room, /mos:scheduled-tasks defines the recurring job",
  "/mos:scientific-roadmap": "When you know what must be delivered but not how, /mos:scientific-roadmap walks Theo's Scientific Roadmapping steps to find the limits that are only assumed, ranks them by what they unlock, and hands the top ones to /mos:research as falsifiable hypotheses",
  "/mos:score-innovation": "When you are choosing between cross-domain innovation candidates, /mos:score-innovation runs HSI scoring to rank them by semantic surprise",
  "/mos:scout": "When you want background scans running across the room without driving them yourself, /mos:scout fires the sentinel checks",
  "/mos:setup": "When you want to wire optional integrations like Velma or a meeting source, /mos:setup walks you through configuration",
  "/mos:show": "When the room is full but you don't know which view answers your question, /mos:show asks your job in plain language (know where I stand, find what's broken, make it land, get it into the world) and runs the right view underneath",
  "/mos:skill": "When you have a CONFIRMED SyntheticExpert in the graph and you want to talk to it as a persona anywhere in the room, /mos:skill projects that node's props (hat, name, beautiful question, research approach, evidence tier, provenance) into a room-scoped skills/<expert>/SKILL.md through the SHIPPED build-new-surface.cjs generator (kind=skill, --from-expert)",
  "/mos:snapshot": "When you need a frozen Data Room artifact to share with someone outside the team, /mos:snapshot packages everything into a portable bundle",
  "/mos:speakers": "When you have a meeting filed and want to know who said what, /mos:speakers shows the participants with their roles, attendance, and contribution patterns",
  "/mos:splash": "When you want the MindrianOS Mondrian banner, /mos:splash displays it",
  "/mos:stance": "When you want Theo to shift how he talks to you this session (pull evidence, deliver decisively, stay Socratic, or challenge you), /mos:stance flips the dial in one confirm",
  "/mos:think-hats": "When the team keeps wearing the same hat and missing perspectives, /mos:think-hats rotates them through de Bono's six",
  "/mos:trending-to-absurd": "When a trend feels safe, you have not pushed it far enough. /mos:trending-to-absurd seeds itself from your room's connective taxonomy, then extrapolates each trend to its absurd extreme across the 3-10 / 11-30 / 50yr horizons. The disruptive opportunity shows up at the edge first",
  "/mos:update": "When you suspect MindrianOS has a newer version waiting, /mos:update checks and installs via Claude Code's native plugin loader",
  "/mos:user-needs": "When you need to map what users actually want versus what they say they want, /mos:user-needs plots importance against satisfaction",
  "/mos:validate": "When an idea needs a real test before more investment, /mos:validate runs importance-satisfaction scoring against the customer segment",
  "/mos:vault": "When you want the Data Room available in Obsidian for offline reading, /mos:vault exports it as a nested vault with wikilinks intact",
  "/mos:visualize": "Deprecated alias",
  "/mos:whitespace": "When you suspect a gap exists in the room's coverage of a domain, /mos:whitespace runs HSI scoring across the artifact corpus to find under-explored zones",
  "/mos:wiki": "When you want to read the Data Room as linked wiki pages, /mos:wiki opens the wiki view"
}
