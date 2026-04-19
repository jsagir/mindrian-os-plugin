---
created: 2026-04-14
status: research
milestone_target: v2.0 (proposed)
authority: user reframe 2026-04-14
---

# Smart Notebook Co-Founder: Research and Architecture

> "I want you to deep research this idea. Think of it as a smart notebook that eventually has enough context to be your co-founder. What pieces are missing there as a default structure built to be filled and how new parts can need to be added according to user or context." - Jonathan Sagir, 2026-04-14

This document is the architectural seed for a future MindrianOS milestone (tentatively v2.0). It is not a backlog entry, it is not a plan, and it is not a PR. It is the research substrate that a future Claude session should read in full before proposing the concrete phase plan. The intended reader is another instance of Claude three months from now, sitting at `/home/jsagi/MindrianOS-Plugin/`, asked to build this, with no memory of the 2026-04-14 conversation.

---

## 0. Frame: Why "data room" stopped being enough

MindrianOS v1.x (up to v1.10.2 Feynman-MINTO Hybrid) treats the venture workspace as a *data room*. A data room is a filing metaphor. Artifacts enter, they get routed to one of eleven canonical sections (the `KNOWN_SECTIONS` set in `lib/vault/room-scanner.cjs`), and the intelligence layer reasons across those sections. The filing metaphor has carried the product well through the Lawrence feedback rounds, the Obsidian vault import, the Feynman-MINTO section compression work, and the /mos:organize tree view. It is a good metaphor for one thing: *safekeeping*. It is a weak metaphor for a different thing: *accumulation toward judgment*.

A data room files. It does not develop a voice. A stranger walking into a data room can read what is filed and still have no idea what the venture *is*, because the venture is not the union of the artifacts, it is the compressed judgment the founders carry in their heads that made those artifacts worth filing. The founders' judgment does not sit in the files. It sits in the space between the files.

The reframe the user articulated on 2026-04-14 is simple and sharp. A notebook accumulates. A notebook develops a personality shaped by the person holding the pen. A notebook, if it is smart enough and fed long enough, starts to answer questions the way the person holding the pen would answer them. The destination state the user named is "co-founder." Not "assistant." Not "advisor." Co-founder. The measure of success is whether the notebook's synthesized voice is useful in a high-stakes decision moment - the moment where a real co-founder would lean back, squint, and say "I would not do that, and here is why."

The trigger that produced the reframe was a third-party Notion "Problem Worth Solving" template the user had built months earlier. The Notion version had structural properties MindrianOS does not currently have: every page hosts *inline databases* the user can add, rename, or remove, and the default set of databases is only a scaffold. The user's venture-specific databases accumulate on top of the scaffold over time. MindrianOS has a flat allowlist of eleven section folders and no concept of user-declared sub-collections. When the user looked at the Notion template next to the current MindrianOS room, the gap was not "Notion has prettier tables." The gap was "Notion let me grow the structure, MindrianOS makes me file into a structure I cannot grow."

This document accepts the reframe in full and researches three questions:

1. What would a notebook need to know to function as a co-founder, and what does a real co-founder actually know?
2. What does MindrianOS already cover, and where are the honest gaps?
3. How do we grow MindrianOS from "data room" to "smart notebook with a co-founder voice" without breaking the Dror-activates-alone forcing function or violating Decisions 1 through 16 in `CLAUDE.md`?

Tri-polar check is applied in every major section. CLI, Desktop, and Cowork are asked the same questions at every architectural fork.

---

## 1. What a co-founder actually knows

A real co-founder holds a texture of knowledge that documents capture badly. The taxonomy below is the target surface area. Every item on this list is something a thoughtful co-founder would raise in a hard conversation that the current MindrianOS room cannot be asked about. Items are grouped into seven clusters. Each item names the dimension, explains why a co-founder needs it, and names what breaks when it is absent.

### 1.1 Decision trails and rationale

**Decision rationale.** A co-founder remembers *why* a choice was made, not just what was chosen. Picking pricing at 49 dollars versus 99 dollars looks identical in the financial model. The reasoning behind 49 (we wanted the procurement threshold, the design partner balked at 99, the unit economics worked at scale even at 49) is where the decision lives. Absent this, every revisit of the choice is litigated from scratch.

**Rejected alternatives.** Every real decision has a shadow decision: the thing the team almost did. The reasons it was rejected are more durable than the reasons the winner was picked, because rejection comes from a lived objection that survived a counterargument. Absent this, the team re-proposes rejected ideas every few months and the second debate is as long as the first.

**Decision reversibility.** A co-founder instinctively knows which decisions are cheap to reverse and which ones lock the company in. "We can change our name, we cannot change our regulatory posture." Absent this, the team treats reversible and irreversible decisions with the same caution, spending the same debate budget on trivial-to-unwind choices and life-or-death ones.

**Decision witnesses.** Who was in the room when the call was made. This is not a credit question, it is a calibration question - if the person who pushed hardest for the decision is the person who has been wrong twice this quarter, the decision gets reread. Absent this, decisions float free of their advocates and bad patterns never surface.

**Decision timing pressure.** A decision made under cash-out-in-four-weeks pressure is a different decision than the same choice made with runway. A co-founder who does not remember the felt pressure mis-weights the lesson.

### 1.2 The human dimension

**Trust graph between team members.** Who picks up whose slack. Who is diplomatic with whom. Which pairings produce good output and which ones produce silence. A co-founder who cannot answer "should A and B be on this call" is not doing the job.

**Unresolved interpersonal tensions.** The thing nobody is saying. The friction that has been parked three times. A notebook that pretends the team is frictionless is worse than useless, because it will confidently recommend moves that the actual humans will quietly sabotage.

**Personal context of each key person.** What motivates them. What they fear. What their personal runway looks like (cash on hand, family situation, visa status, the cofounder whose spouse just started chemo). A co-founder weighs every ask against this ledger without being asked to.

**Unvoiced assumptions about each other's competence.** The belief "A is great at sales but I would not let them write the roadmap" is almost never written down, and it drives half the delegation decisions in a small company.

**Hiring standards and cultural non-negotiables.** The things we would rather leave a role open than compromise on. Often learned from one painful bad hire.

**The "we do not do that" list.** Markets we refuse to serve. Products we refuse to build. Partnerships we refuse to sign. This list is the negative space of strategy and it is almost never written, but a co-founder holds it reflexively.

### 1.3 History and reactive context

**History of decisions and what they were reacting to.** A decision made in response to a specific competitor move is not the same decision as one made on first principles. Absent the trigger, future Claude cannot tell which decisions should age out when the trigger is resolved.

**Things we tried and failed.** With enough specificity that we do not repeat the mistake. The data room captures wins. Failures get compressed to "we pivoted" and the hard-won texture is lost.

**Promises made in meetings that are not yet in writing.** The handshake with the investor. The verbal commitment to the design partner. These live in the gap between meeting transcript and contract and they are load-bearing.

### 1.4 Stakeholder and external texture

**Stakeholder influence map.** Who has power over the venture outcome. Not just investors and customers, but regulators, platform partners, suppliers, press, advisors, and the quiet alumni network the team fell back on once already.

**Stakeholder concerns.** What each stakeholder is afraid of when they think about the venture. This is almost never written down and it is exactly what a real co-founder prepares against before every meeting.

**Stakeholder commitments.** What each party has committed to do. Mapped to calendar. A co-founder tracks these without being asked.

**The competitive mindset.** Who we watch. What moves make us panic. What moves we discount. The asymmetry in how a team reads competitors (some are threats, some are non-threats, some are acquirers, some are future employers) is a major part of judgment.

### 1.5 Money, runway, and commitments

**Financial runway as a felt pressure, not a number.** Cash on hand divided by burn is the number. The felt pressure is "we have ninety days before we start making worse decisions out of fear." A co-founder operates on the felt pressure, not on the number.

**Red lines and commitments.** Promises that cannot be broken. Equity grants that have vested. Debt covenants. Regulatory commitments. Marketing claims that would invite a lawsuit if retracted.

**Fundraising positioning.** What round are we *implicitly* on, not the name we call the round. What story we are telling investors. What numbers are load-bearing in that story. Where the story will crack.

**Contingency plans.** "If this investor passes we do X." "If the design partner churns we do Y." These plans are almost never written down and they are the entire value of having a co-founder to talk to.

**Acquisition thinking.** The "if we get big we will buy X" list. Often tied to specific people or specific capabilities. Shapes hiring and partnership calls in ways founders rarely articulate.

### 1.6 Operating rhythm and culture

**Operating cadence.** How fast things move. Weekly metrics review on Wednesday. Monthly all-hands Friday. Quarterly board. Investor update on the 3rd. A co-founder operates in this rhythm and flags drift.

**Shared jargon and internal shorthand.** "The Dror problem." "The Lawrence fix." "Ackoff mode." Internal shorthand compresses meetings. A notebook that does not hold the jargon cannot participate in the conversation.

**Unstated values and tradeoffs.** The things the team has absorbed and never written down. "We ship weekly or we die." "Customers always come before investors in the priority stack." "Design matters at the cost of features." A notebook that has not absorbed these will make tone-deaf recommendations.

### 1.7 Meta-knowledge

**Known unknowns.** The things the team knows it does not know. The open research questions. The technical risks not yet characterized.

**Unknown unknowns awareness.** Where the team is most likely to be surprised. Often the junction of two functional areas neither founder owns cleanly. A co-founder has instinct for this.

**Assumption validity tracking.** Every claim the business is built on has a freshness date. Most get stale and nobody notices. This is the underserved outcome that drove Decision 12 ("assumptions are first-class").

**Contradictions held in tension.** A real co-founder holds "we need to fundraise now" and "we are not ready to fundraise" at the same time, and acts on the tension without resolving it prematurely. Naive LLMs pick one and forget the other. This is the single hardest property to replicate.

### 1.8 Literature ground

The dimensions above are not invented. They map to a literature the user's project is already grounded in and a few adjacent authors worth pulling forward.

- **Simon 1962** (Architecture of Complexity). Near-decomposable hierarchies. Justifies the section/collection/artifact three-level hierarchy proposed in Section 4, because Simon's theorem says the only stable architecture for a complex system is hierarchical with strong internal cohesion inside each subsystem and weak coupling between them. The co-founder knowledge taxonomy above is a hierarchy; the scaffold should be too.
- **Rittel and Webber 1973** (Wicked Problems). A venture exhibits all ten wicked-problem characteristics. Decision 9 already commits MindrianOS to wicked problem management. The co-founder voice has to handle wicked problems, which means it has to hold contradictions, revise in place, and tolerate ambiguity. It cannot be a Q and A bot.
- **Van Clief and McDermott 2026** (ICM). Folder structure is the code. The co-founder voice cannot be a separate layer bolted onto an unrelated folder shape. The scaffold IS the co-founder's skeleton.
- **Tetlock 2015** (Superforecasting). Calibration, decomposition, Bayesian updating. The co-founder voice has to be honest about uncertainty. "Confidence 6 of 10, based on these three signals" is more useful than "yes."
- **Hughes 1983** (Reverse Salients). Lagging components in an expanding system. The scaffold audit (Section 5) looks for reverse salients across the full default set and surfaces the section where understanding lags the ambition.
- **Knight 1921** (Risk vs Uncertainty). Some dimensions of a venture are risks (statable probability distributions). Most are uncertainties (unknown unknowns). The co-founder voice must flag which is which, because the wrong response to each is catastrophic.
- **Ben Horowitz, The Hard Thing About Hard Things.** The CEO psychology dimension. The lonely decisions. The "two in the morning and you are the only one awake" problem. The co-founder voice earns its keep in exactly those moments.
- **Ed Catmull, Creativity Inc.** Cultural norms as the thing you defend. The "we do not do that" list at the cultural level.
- **Marty Cagan, Inspired.** Product discovery as continuous, not a phase. Reinforces that the scaffold has to support discovery artifacts sitting alongside delivery artifacts at every stage.
- **Chris Voss, Never Split the Difference.** Negotiation memory. Every ask has a no-behind-the-no and it lives in the meeting transcript, not in the contract.
- **Stephen Bungay, The Art of Action.** Commander's intent. Friction. Decision rationale captured in a form that allows subordinates to improvise correctly when the plan meets reality. The decision trail in section 1.1 is Bungay's commander's intent in notebook form.

These authors do not need to be cited in the product. They need to be cited in this document because they define the surface area the product is trying to cover. The next Claude session reading this should be able to check proposals against the taxonomy and know when the proposal is too narrow.

---

## 2. Coverage matrix: MindrianOS today versus the co-founder dimensions

The current `KNOWN_SECTIONS` allowlist in `lib/vault/room-scanner.cjs` is eleven items:

```
business-model
competitive-analysis
financial-model
legal-ip
market-analysis
meetings
opportunity-bank
problem-definition
solution-design
team
team-execution
```

Plus the conventional helpers the scanner already understands without gating: `assets/`, `exports/`, `sub-rooms/`, `meetings/YYYY-MM-DD-*/`, `team/<category>/<person>/PROFILE.md`, and any `ROOM.md` files per Decision 15. Obsidian vault layout (Decision 16) enforces one-folder-per-artifact.

Against the taxonomy in Section 1, the honest coverage looks like this. GREEN means the dimension has an existing home that a user would naturally find. YELLOW means it can be filed but not in a way that surfaces it back to the user. RED means there is nowhere for it to live.

| Cluster | Dimension | Status | Notes |
|---|---|---|---|
| 1.1 Decisions | Decision rationale | YELLOW | Meetings capture some. No `decisions/` section. |
| 1.1 | Rejected alternatives | RED | Decision 13 says rejection is data, but rejection is captured as a graph node, not a first-class artifact. |
| 1.1 | Decision reversibility | RED | No place to tag a decision as reversible vs irreversible. |
| 1.1 | Decision witnesses | YELLOW | Speakers index tracks meeting participation but not decision ownership. |
| 1.1 | Timing pressure | RED | No runway-context field on decisions. |
| 1.2 People | Trust graph | RED | `team/` holds profiles, no edges between people. |
| 1.2 | Interpersonal tensions | RED | Culturally unsafe to file, structurally impossible to file. |
| 1.2 | Personal context | YELLOW | PROFILE.md can hold it; no convention asks for it. |
| 1.2 | Competence assumptions | RED | No place for this, probably correctly. |
| 1.2 | Hiring standards | RED | Not in `team/` or `team-execution/`. |
| 1.2 | "We do not do" list | RED | No negative-space section. |
| 1.3 History | Decision history with trigger | YELLOW | `problem-definition/history/` exists in target state per architecture.md but not in current KNOWN_SECTIONS. |
| 1.3 | Failed experiments | RED | No `experiments/` or `lessons-learned/`. |
| 1.3 | Verbal promises | YELLOW | Meetings capture them, but there is no promise-tracker that surfaces unfulfilled commitments. |
| 1.4 Stakeholder | Influence map | RED | `competitive-analysis/` is the closest thing and it is about competitors, not stakeholders. |
| 1.4 | Stakeholder concerns | RED | Nowhere. |
| 1.4 | Stakeholder commitments | RED | Nowhere. Meeting filing captures the utterance, not the commitment. |
| 1.4 | Competitive mindset | YELLOW | `competitive-analysis/` holds the list, not the reflexes. |
| 1.5 Money | Runway as felt pressure | RED | `financial-model/` has the number, not the felt pressure. |
| 1.5 | Red lines | RED | Nowhere. |
| 1.5 | Fundraising story positioning | RED | `business-model/` is adjacent but does not hold the narrative arc. |
| 1.5 | Contingency plans | RED | Nowhere. |
| 1.5 | Acquisition thinking | RED | Nowhere. |
| 1.6 Rhythm | Operating cadence | RED | Nowhere. |
| 1.6 | Internal jargon | RED | Nowhere, and this is a real gap for the co-founder voice which needs to speak the team's language. |
| 1.6 | Unstated values | RED | Nowhere. |
| 1.7 Meta | Known unknowns | YELLOW | `map-unknowns` command surfaces them but does not file them to a persistent section. |
| 1.7 | Assumption validity | GREEN | Decision 12 made this first-class. `assumptions.json` pattern is in target architecture. |
| 1.7 | Held contradictions | YELLOW | Cross-relationship scan detects CONTRADICTS edges. Does not yet hold them as first-class artifacts the user can revisit. |

The honest read: of 28 dimensions, 2 are GREEN, 8 are YELLOW, and 18 are RED. The current room covers the *artifact* layer (problem, solution, market, competition, business model, finance, legal, team roster, meetings, opportunities) but has almost no coverage of the *judgment* layer that makes a co-founder a co-founder.

This is not a failure of v1.x. The v1.x scope was to be a data room, and a data room it is. The reframe is precisely that a data room is not enough to carry the co-founder voice.

---

## 3. What the Notion template has that MindrianOS does not

The Notion "Problem Worth Solving" template the user shared is a page-based structure with inline databases per page. Reconstructing from what the user shared and the framing they used, the template exposes these page-level containers:

- Navigation helper callout
- PWS Road-Map callout
- Latest Deck slot
- PWS meetings log
- Template setup instructions
- Problem (with Problem Statement callout)
- Solution and Product (with Solution Statement callout)
- Business Model (with How Do We Make Money callout)
- Value Proposition as a peer section
- Market Analysis (with Market Statement callout)
- Marketing and Sales (separate from Market Analysis)
- Legal Docs
- Financial Information
- Funding Options
- Research Documents

On top of these, the user explicitly named dimensions present in the Notion template and missing or underfidelity in MindrianOS:

- Stakeholder Analysis (absent from MindrianOS)
- Team Building (distinct from the current `team/` profile roster)
- Competition as a peer section (MindrianOS has `competitive-analysis` but the Notion version makes it a top-level peer with its own subpages)
- Unit market analysis (finer than the current `market-analysis/` single section)
- Business model at higher fidelity than the current MindrianOS `business-model/` (which in practice is a Lean Canvas dumping ground)

The structural features the Notion template exposes that MindrianOS does not:

- **Inline databases under pages.** Each page can host zero or more databases the user adds, removes, or renames. The default set is a scaffold, not a contract. MindrianOS has a flat allowlist per section and no sub-collection concept.
- **User-declared schema per database.** The user picks columns. The schema is as loose or as strict as the user needs. MindrianOS has one implicit schema: the Obsidian artifact folder with a single markdown file plus attachments.
- **Callouts as typed blocks.** Problem Statement, Solution Statement, How Do We Make Money, Market Statement. These are typed first-class artifacts, not free-form markdown. MindrianOS does not currently distinguish between a section's core statement and the supporting evidence.
- **Separation of discovery narrative from data.** The callouts hold the thesis sentence. The surrounding databases hold the evidence. MindrianOS does not separate the thesis sentence from the evidence at the file-system level - the section's ROOM.md carries both in prose.
- **User-directed expansion.** Users add new databases as they discover new dimensions. The structure grows with understanding. MindrianOS structure grows only if a new section is added to the hardcoded allowlist, which requires a plugin change.

The last item is the load-bearing one. It is the reason the user said "that's the structural gap." Everything else is fixable by adding sections to the allowlist. The last one requires a new architectural level.

---

## 4. Proposed expanded default scaffold

This section proposes a scaffold that exceeds the Notion template. It is organized in four tiers. Tier 0 is present in every room. Tier 1 is added when the venture reaches a stage. Tier 2 is added when the venture is a certain type. Tier 3 is triggered by conversation signals. Every section is a directory with its own ROOM.md (Decision 15). Every section contains zero or more *collections*, and every collection is a directory with its own ROOM.md and zero or more artifact folders (Decision 16). This is a three-level hierarchy: section, collection, artifact.

The collection is the new architectural level. In current MindrianOS the hierarchy is section -> artifact. In the proposed scaffold it is section -> collection -> artifact. The collection is the direct analogue of the Notion inline database. It is how a section holds multiple typed sub-lists without forcing every artifact into one flat folder.

### 4.1 Tier 0 Foundational (every room, every venture type)

Names use hyphens to match existing convention.

- `problem-definition/` - the venture's current problem formulation
  - `statement/` - the canonical problem statement, revised over time
  - `reformulations/` - the history of how the problem statement changed and why
  - `evidence/` - data points that justify the problem framing
  - `wickedness/` - explicit capture of wicked-problem characteristics (per Rittel)
- `solution-design/` - what we propose to do about it
  - `statement/` - canonical solution statement
  - `alternatives/` - rejected solutions and why
  - `prototypes/` - artifacts from experiments and mockups
  - `architecture/` - the shape of the built thing
- `value-proposition/` - why anyone would care (promoted from sub-bullet in v1.x to peer section)
  - `statement/` - the one-line promise
  - `segments/` - who the promise applies to, differentiated
  - `alternatives/` - what the customer does today without us
- `business-model/` - how money flows
  - `lean-canvas/` - canonical single-page canvas
  - `revenue-streams/` - each stream with its own artifact
  - `unit-economics/` - per-customer math
  - `pricing/` - the pricing decision and its history
- `market-analysis/` - the terrain
  - `segments/` - customer segments
  - `sizing/` - TAM SAM SOM artifacts
  - `trends/` - macro and micro trends
  - `timing/` - why-now artifacts
  - `substitutes/` - adjacent solutions and non-consumption alternatives
- `competition/` (promoted from `competitive-analysis/` which becomes a legacy alias)
  - `direct/` - competitors who solve the same problem
  - `indirect/` - competitors who solve an adjacent problem our customer might pick instead
  - `substitutes/` - non-consumption and workarounds
  - `watched/` - companies we track even though they are not currently competing
  - `moves/` - notable competitive moves and our reaction
- `team/` - who we are
  - `members/` - founders and employees
  - `advisors/` - formal advisors
  - `mentors/` - informal but load-bearing
  - `trust-graph/` - who works well with whom, who covers whom (deliberately sparse to avoid feeling surveilled)
- `team-building/` - how we grow (distinct from team roster)
  - `hiring-standards/` - cultural non-negotiables
  - `open-roles/` - what we are looking for
  - `pipeline/` - candidates in process
  - `not-hires/` - categories we refuse to hire
- `stakeholder-analysis/` - the broader cast (NEW vs v1.x)
  - `stakeholders/` - people and orgs with a stake in the outcome
  - `influence-interest-map/` - 2x2 positioning
  - `concerns/` - surfaced objections and red flags per stakeholder
  - `commitments/` - what each party has committed to
  - `interviews/` - recorded conversations
- `meetings/` - the primary knowledge source (Decision 11)
  - Existing YYYY-MM-DD-* structure preserved
  - `promises/` collection added to surface verbal commitments extracted from transcripts
- `decisions/` - what we chose and why (NEW)
  - `active/` - decisions still in force
  - `reversed/` - decisions we reversed and why
  - `pending/` - live debates not yet resolved
- `assumptions/` - the validity ledger (already first-class per Decision 12, promoted from sub-file to full section)
  - `active/` - currently held
  - `invalidated/` - previously held, now known false
  - `untested/` - worth testing
- `experiments/` - what we tried
  - `active/` - running experiments
  - `failed/` - experiments that taught us something
  - `shelved/` - experiments we stopped but did not disprove
- `research-documents/` - the external reading
  - `literature/` - papers and books
  - `market-reports/` - purchased or found reports
  - `patents/` - relevant IP
  - `news-clippings/` - dated signals
- `legal-ip/` - already Tier 0
  - `ip/` - patents, trademarks, copyrights
  - `contracts/` - executed agreements
  - `obligations/` - red lines and covenants
  - `compliance/` - jurisdictional posture
- `financial-model/` - already Tier 0
  - `model/` - the live spreadsheet and its assumptions
  - `runway/` - cash position and burn, updated regularly
  - `scenarios/` - upside, base, downside

Tier 0 count: 17 sections with ~70 collections. Compare to current v1.x: 11 sections, 0 collections.

### 4.2 Tier 1 Stage-dependent

Added when the venture reaches a given stage (`venture_stage` field on ROOM.md).

#### Pre-Opportunity
- `discovery/`
  - `interviews/` - raw customer conversations
  - `signals/` - noticed patterns
  - `hypotheses/` - early guesses

#### Discovery
- `validation/`
  - `experiments/` - validation runs (distinct from Tier 0 experiments which continue post-discovery)
  - `evidence/` - what each experiment produced
  - `learnings/` - the takeaways

#### Opportunity
- `go-to-market/`
  - `channels/` - acquisition paths
  - `funnel/` - conversion math
  - `messaging/` - positioning per segment
  - `launches/` - sequenced launches
- `fundraising/`
  - `round/` - the round we are on
  - `story/` - the narrative arc we tell investors
  - `investors/` - pipeline
  - `rejections/` - investors who passed and why (gold for pattern detection)
  - `contingency/` - what we do if the round does not close

#### Scaling
- `operations/`
  - `cadence/` - weekly, monthly, quarterly rhythms
  - `metrics/` - what we watch
  - `incidents/` - things that broke
- `culture/`
  - `values/` - written and unstated
  - `rituals/` - recurring practices
  - `retros/` - post-incident reviews

Tier 1 count: 6 sections with ~22 collections.

### 4.3 Tier 2 Type-dependent

Added when `venture_type` matches. Venture type is declared at room creation (Section 5) and can change later.

#### B2B SaaS
- `pipeline/` - sales pipeline (distinct from fundraising)
  - `leads/`, `qualified/`, `negotiation/`, `closed-won/`, `closed-lost/`
- `unit-economics/` (deeper than Tier 0 placeholder)
  - `cac/`, `ltv/`, `payback/`, `gross-margin/`

#### Nonprofit
- `donors/`
  - `individuals/`, `foundations/`, `corporates/`, `grants/`
- `impact-metrics/`
  - `outcomes/`, `outputs/`, `stories/`, `evaluation/`
- `mission/`
  - `statement/`, `theory-of-change/`, `stakeholder-voice/`

#### Research project
- `literature-review/`
  - `canonical/`, `recent/`, `contradictions/`
- `methodology/`
  - `protocol/`, `ethics/`, `analysis-plan/`
- `data-management/`
  - `raw/`, `processed/`, `provenance/`

#### Hardware
- `supply-chain/`
  - `bom/`, `vendors/`, `lead-times/`, `risks/`
- `manufacturing/`
  - `process/`, `yield/`, `cost-curve/`, `qa/`

#### Regulated industry
- `regulatory/`
  - `jurisdictions/`, `filings/`, `interactions/`, `risks/`

Tier 2 count depends on type. A single room typically picks one type and gets 2-3 sections with ~8-12 collections.

### 4.4 Tier 3 Context-triggered

Added dynamically by the intelligence layer when conversation or filing signals demand it. Full triggers are in Section 5. A sample of what Tier 3 can spawn:

- `hiring-pipeline/` - triggered when hiring mentioned >3 times
- `regulatory-risk/` - triggered when compliance keywords fire
- `acquisition-targets/` - triggered when "we could buy X" said twice
- `red-lines/` - triggered when user rejects something with a principle
- `jargon/` - triggered when internal shorthand fires >5 times across meetings
- `contradictions-held/` - triggered when the cross-ref scan finds a persistent unresolved CONTRADICTS edge
- `runway-pressure/` - triggered when `financial-model/runway/` shows <120 days
- `promises-outstanding/` - triggered when meeting transcript contains verbal commitments not yet filed
- `reverse-salients/` - triggered when a section is thin but heavily cross-referenced (Hughes)
- `culture-drift/` - triggered when filed decisions contradict previously filed values

Tier 3 count is unbounded but typical rooms will surface 3-8 Tier 3 sections over their lifetime.

### 4.5 Totals

- Tier 0: 17 sections, ~70 collections
- Tier 1: up to 6 sections, ~22 collections
- Tier 2: up to 3 sections per type, ~8-12 collections
- Tier 3: 3-8 sections per lifetime, variable collections

A mature room in the proposed v2.0 scaffold has roughly 25-30 sections and 100-130 collections. A fresh room under the same scaffold has 17 sections and ~70 collections, most of which are empty and marked as such.

Compared to Notion: the Notion template has ~13 pages. The proposed scaffold at Tier 0 alone has 17 sections. At full expansion it has 2-3x the Notion template. The user's complaint that MindrianOS was "more stingy than Notion" is answered here by proposing a scaffold that is more generous than Notion in every direction.

### 4.6 Tri-polar check for Section 4

- **CLI.** Sections and collections are directories. `room-scanner.cjs` walks them. `vault-section-minto-generator.cjs` produces MINTO per section. No new UI primitives needed - the tree already works. The challenge is that `KNOWN_SECTIONS` is a `Set` of 11 strings and the scanner does not have a concept of a collection layer. Both need extension.
- **Desktop.** Larry reads the same filesystem via the same scanner. Desktop users do not type filenames - they ask Larry "add a stakeholder analysis section" and Larry materializes it. Desktop needs the materialization verb more than CLI does.
- **Cowork.** Shared state. Multiple users might propose new sections simultaneously. The scaffold creation has to be idempotent and concurrency-safe. The MWP edge schema already supports concurrent filing; extending it to section creation is additive.

---

## 5. How new parts get added dynamically

The scaffold in Section 4 is the *starting* set. The reframe demands that new parts get added based on signals. The taxonomy below names each trigger, the signal it reads, the section or collection it proposes, the approval flow, and what happens to rejections.

### 5.1 Trigger: User declaration at room creation

- **Signal.** A short questionnaire during `/mos:new-project`. Questions: founder role, venture type, stage, problem class, industry. ~6 questions, 60 seconds.
- **Detection.** Direct user input. No ambiguity.
- **Proposal.** The full Tier 0 + matching Tier 1 + matching Tier 2 scaffold is materialized on room creation.
- **Approval flow.** Auto-add. The user asked for a room, they get the scaffold.
- **Rejection path.** At any point a user can mark a section as "hidden" via `/mos:organize --hide <section>`. Hidden sections are filed to `.mos/hidden-sections/` with a reason. Rejection reasons feed Decision 13's "rejection is data" pattern - they become graph nodes.
- **Backwards compatibility.** Existing rooms pre-v2.0 see a migration prompt on session-start offering to expand to the new scaffold. User can defer indefinitely.

### 5.2 Trigger: Context-signal detection (keyword threshold)

- **Signal.** A keyword or phrase appears N times across M sessions. Example: "hiring" mentioned >=3 times in 2 distinct sessions.
- **Detection.** A new skill `room-context-triggers` (or extension of `room-proactive/`) hooks on session-start and reads the last N messages. Keyword table lives in `lib/core/context-triggers.cjs` as a static map of {keyword -> threshold -> section-proposal}.
- **Proposal.** Larry says: "I have heard you mention hiring five times. Should I add a `hiring-pipeline/` collection under `team-building/`?"
- **Approval flow.** Suggest-and-confirm. User types y, Larry materializes the collection and files the relevant past messages as bootstrap artifacts. User types n, Larry files the rejection to `.mos/rejected-suggestions/` with timestamp and the triggering quote.
- **Rejection path.** Rejection does not mean "never ask again." It means "not right now." The same trigger with the same signal can fire again after N days (default 14) or after the signal strength doubles (keyword count hits 2x the rejection threshold).

### 5.3 Trigger: Cross-section contradiction

- **Signal.** The existing cross-relationship scan (already deployed per `docs/MWP-SPECIFICATION.md`) detects a CONTRADICTS edge between two artifacts in different sections.
- **Detection.** Post-filing hook, already running.
- **Proposal.** Larry says: "Your `problem-definition/` assumes users want X. Your `market-analysis/segments/` suggests users want not-X. This tension has not been resolved. Should I open a `contradictions-held/` collection to track it?"
- **Approval flow.** Suggest-and-confirm. Rejection reason captured.
- **Collection created.** `decisions/pending/` and `assumptions/untested/` both get a linked artifact, plus a new `contradictions-held/` Tier 3 collection if the user accepts.

### 5.4 Trigger: Missing-dimension audit

- **Signal.** A periodic audit compares the current room structure against the full Tier 0 + matching Tier 1 + matching Tier 2 scaffold. Any Tier 0 section with zero artifacts older than N days is a gap. Any Tier 1 section that should exist for the current stage but does not is a gap.
- **Detection.** New script `scripts/scaffold-gap-audit.cjs` run weekly via `/mos:scout` (which already runs health checks).
- **Proposal.** Larry surfaces the top 3 gaps on session-start, ranked by a priority function that weights (a) stage appropriateness, (b) cross-ref pressure from other sections, (c) time since last filing in this area.
- **Approval flow.** Ambient suggestion, not a blocker. User can `/mos:organize --materialize <section>` to create it.
- **Rejection path.** User ignores the suggestion. The audit keeps surfacing it. The user can explicitly dismiss it via `/mos:organize --dismiss <section>` with a reason.

### 5.5 Trigger: Graph edge pressure

- **Signal.** A section has more cross-reference edges pointing *to* it than it has artifacts. This is Hughes's reverse salient in graph form - a thin section the rest of the room is leaning on.
- **Detection.** LazyGraph / Neo4j query (when connected) or local edge count (when Tier 0).
- **Proposal.** Larry says: "Your `market-analysis/` has 17 inbound references but only 2 artifacts. This section is load-bearing for your other thinking. Should I split it into `segments/`, `sizing/`, and `timing/` collections and start filing the inbound references there?"
- **Approval flow.** Suggest-and-confirm.
- **Rejection path.** Graph data. Future scans weight the rejection.

### 5.6 Trigger: Stage transition

- **Signal.** `venture_stage` frontmatter in room ROOM.md changes. MindrianOS already tracks this per Decision 14 (bidirectional stage progression).
- **Detection.** Hook on ROOM.md writes.
- **Proposal.** Larry announces the transition and offers to open the Tier 1 sections that match the new stage. On regression (Decision 14 explicit support), offers to archive stage-specific sections to `archive/<stage>/` rather than delete.
- **Approval flow.** Auto-add on progression, confirm on regression.
- **Rejection path.** User can decline. Sections are not created but the stage transition still records.

### 5.7 Trigger: Method invocation

- **Signal.** User runs a slash command that needs a section that does not exist. Example: `/mos:stakeholder-analysis` with no `stakeholder-analysis/` section.
- **Detection.** Command front-matter declares which sections it reads and writes. The dispatcher checks before execution.
- **Proposal.** "This command needs a `stakeholder-analysis/` section. Create it now?" Y/N.
- **Approval flow.** Confirm, auto-materialize with the matching Tier 0 collections.
- **Rejection path.** Command aborts. The method invocation is logged as a failed-because-structure-missing event.

### 5.8 Trigger: External pitch-deck import

- **Signal.** User drops a pitch deck via `/mos:file-meeting` or `/mos:build-thesis` that mentions sections not present in the room. Example: deck has a Competition slide, room has no `competition/` section.
- **Detection.** A deck parser (or for PDFs, Feynman-engine-style text extraction) pulls slide headers and runs them through a mapping table {header -> section}.
- **Proposal.** Larry lists the detected-but-missing sections: "Your deck references Competition and Unit Economics. Neither exists in your room. Create them now?"
- **Approval flow.** Confirm.
- **Rejection path.** Standard.

### 5.9 Trigger: Rejection is data

Decision 13 says rejection feeds the graph. When a user rejects any of the above proposals, the rejection record captures:

- Trigger type
- Signal strength at rejection time
- Proposed section or collection
- User reason (free text, optional)
- Timestamp

Over time, rejection patterns shape the trigger calibration. A user who rejects every hiring suggestion has their hiring threshold moved from 3 to 8 mentions. A user who accepts every proposal has their thresholds tightened. This is local adaptation without touching the moat - the Brain never sees per-user data.

### 5.10 Trigger: Tri-polar surface check

- **CLI.** All triggers fire in session-start hook or post-filing hook. Both already exist.
- **Desktop.** Larry surfaces proposals conversationally. Desktop users never see the keyword table - they experience it as Larry noticing things.
- **Cowork.** Proposals have an implicit quorum. In shared rooms, a Tier 3 section created by one user is visible to all but does not force the other users into the new workflow. The accepting user "owns" the new section's initial scaffold. Concurrent proposals are serialized via the MWP edge log.

---

## 6. The co-founder synthesis layer

This is the hardest section in the document and it is the one that does the most work for the reframe. Sections 1 through 5 describe a better filing cabinet. Section 6 describes the voice. The voice is what makes it a co-founder and not a bigger Notion.

### 6.1 What is the minimum viable co-founder voice?

Start from the user's question: "Given everything I know about this business, what would I do?" That is the utility function. The voice must answer that question in a way that is (a) specific, (b) opinionated, (c) honest about what it does not know, and (d) consistent with its own past answers.

A minimum viable voice has three modes:

1. **Answer on demand.** User asks a question, voice answers with a specific recommendation grounded in what the room contains. The reply cites the artifacts that drove the answer. If the answer requires something the room does not contain, the voice says so and names what is missing.
2. **Surface-on-entry.** On session-start, the voice produces a brief (3-5 sentence) "what I would do today" paragraph, grounded in the current state. Not a status report. An opinion.
3. **Disagree when warranted.** When the user states a plan the voice thinks is wrong, the voice pushes back with reasoning, not with warnings. This is the hardest mode because it requires the voice to be confident enough to contradict while humble enough to be wrong.

All three modes use the same underlying synthesis. The difference is the surface.

### 6.2 How synthesis composes from Feynman-MINTO

v1.10.2 shipped Feynman-MINTO Hybrid (see `.planning/phases/81-feynman-minto-hybrid/81-CONTEXT.md` Revision 2). The Feynman-MINTO pipeline produces a compressed understanding per section: essence, plain language, exposed confusion, mental model, and MINTO-structured argument. This is not coincidence. This is the infrastructure the co-founder voice rides on.

Synthesis layers bottom-up:

```
per-collection MINTO  ->  per-section MINTO  ->  per-tier synthesis  ->  venture voice
```

Each level compresses the level below. Per-section MINTO already exists. Per-tier synthesis is new: it composes Tier 0 section MINTOs into a Tier 0 narrative ("what the foundation of this venture says"), then layers Tier 1 and Tier 2 narratives on top, then layers Tier 3 context-specific narratives as the outermost ring. The venture voice is the composition of all four layers.

The composition is not concatenation. It is selective, because the voice cannot hold everything in working memory. The Feynman-MINTO MINTO.md files are written for exactly this purpose: each one is already compressed to the single load-bearing argument for its level. The synthesis layer's job is to pick which MINTOs to load for a given question and to flag when two MINTOs disagree.

### 6.3 Handling thin rooms

Thin room = Pre-Opportunity stage, <10 artifacts, no Tier 1 sections, no meetings filed. The voice must not hallucinate. Absolute rule: no invented facts, no invented confidence.

Thin-room voice behavior:

- Answers are explicitly "I do not know yet" with a list of what would help.
- Surface-on-entry produces a "what to do next to make me useful" paragraph instead of a "what I would do today" paragraph.
- Disagreement mode is suppressed entirely. A voice with nothing to stand on cannot disagree responsibly.

This is Tetlock's calibration discipline applied to the voice. Low information = high humility.

### 6.4 Handling deep rooms

Deep room = Opportunity or later, 200+ artifacts, 30+ meetings, 50+ decisions, Tier 2 populated, Tier 3 sections active. The voice must be specific, opinionated, and willing to disagree.

Deep-room voice behavior:

- Answers cite 3-7 load-bearing artifacts by path and explain *which edge* between them produced the opinion. "I would not raise now because (a) your fundraising/story/ arc depends on the metric in financial-model/runway/ which is stale, (b) your decisions/active/2026-02-pricing.md assumes a price you have not validated, and (c) your contradictions-held/ has an open item that investors will find in five minutes."
- Surface-on-entry produces a specific recommendation, not a summary.
- Disagreement mode is active. The voice pushes back.
- Confidence is expressed in Tetlock form: "5 of 10, moderate" not "I think maybe."

### 6.5 Handling contradictions held in tension

The hardest property. A real co-founder holds "we need to raise now" and "we are not ready" simultaneously. A naive LLM picks one and forgets the other.

Architectural answer: the `contradictions-held/` Tier 3 section is load-bearing for this. Every cross-ref CONTRADICTS edge that is not resolved gets a persistent artifact in that section. The synthesis layer, when asked a question, explicitly loads that section first. The voice, when producing an answer, must reference any held contradiction that bears on the question. It does not resolve it. It names it.

Example response form: "My recommendation is X. I notice this recommendation assumes the resolution of contradictions-held/2026-03-18-pricing-tension.md in favor of the premium path. I have not resolved this contradiction. If you resolve it in the other direction, my recommendation flips."

This is not a cop-out. This is what a real co-founder does when their partner asks a hard question: they name the tension instead of papering over it.

### 6.6 Interaction surface

Three surfaces, three modes:

- `/mos:ask-cofounder <question>` - the direct answer-on-demand mode. CLI, Desktop, Cowork all support it.
- Surface-on-entry paragraph - fires on every session-start automatically. No command needed. Part of the existing session-start contract (`mos:ui-system` already owns the 4-zone session-start layout; add a new zone for the voice).
- Disagreement mode - fires when the user states a plan that the voice thinks is wrong. This is the most delicate interaction. It should be rare (not every session) and it should be explicit (not ambient advice sneaked into another answer). The voice announces it is disagreeing before it disagrees.

### 6.7 How the voice earns trust over time

A real co-founder earns trust by being right, being honest about uncertainty, and remembering their own past answers so they can be held accountable. The notebook voice must do all three.

- **Being right.** The voice's past recommendations are filed to `.mos/voice-log/YYYY-MM-DD-<slug>.md`. On session-start, the voice checks for recent recommendations and looks at what happened. If the recommended path was taken and it worked, it flags the positive. If it did not work, it flags the negative. This is Tetlock-style calibration over time.
- **Being honest about uncertainty.** Every recommendation carries a confidence score. Scores update as evidence accumulates. A recommendation made at confidence 4 that the user took and lost on is not a failure of the voice - it is evidence the voice was appropriately uncertain.
- **Remembering past answers.** The voice-log is mandatory reading for the synthesis layer before producing a new recommendation on the same topic. Past answers are reconciled with new evidence. Flip-flops are explicit: "My last answer was different because I did not know X at the time."

### 6.8 The Dror test

The forcing function for MindrianOS: a stranger (Dror 2.0) sitting at a fresh machine, installing the plugin, reaching a filed artifact and visible dashboard without verbal coaching. The co-founder voice must work for Dror, not just for Jonathan.

Test: Dror installs MindrianOS, runs `/mos:new-project`, answers the 6 questionnaire questions, dumps a short problem description, files one meeting. The voice should produce a useful surface-on-entry paragraph the next session. "Useful" means Dror learns something about his own venture he had not explicitly written down - the voice surfaced an implication he missed.

This is an empirical test, not a theoretical one. Before v2.0 ships, the voice must pass this test on at least three real users.

### 6.9 Tri-polar check for Section 6

- **CLI.** `/mos:ask-cofounder` is a new command. Synthesis layer runs as `lib/core/cofounder-synthesis.cjs`. Voice-log is in `.mos/voice-log/`. Surface-on-entry is added to the session-start contract.
- **Desktop.** Larry *becomes* the voice when the room is deep enough. On Desktop there is no command - the user asks Larry and Larry routes to the synthesis layer. The tri-polar rule forbids features that only work on one surface, and this one needs explicit Desktop discoverability.
- **Cowork.** In shared rooms, the voice is one voice for the whole team, grounded in the shared artifacts. This is the dangerous surface. If two users ask `/mos:ask-cofounder` the same question, they must get the same answer, because otherwise the voice is not a co-founder, it is a mirror. The cofounder-synthesis.cjs must be deterministic given identical input state.

---

## 7. Architectural implications for MindrianOS

What building this actually requires.

### 7.1 Extending the folder hierarchy to three levels

The current hierarchy is `room/<section>/<artifact-folder>/<artifact.md>`. The proposed hierarchy is `room/<section>/<collection>/<artifact-folder>/<artifact.md>`. This breaks or changes:

- `lib/vault/room-scanner.cjs` - `findSections()`, `findContentFiles()`, `findSubRooms()`. The walker currently flat-walks under a section. It needs a collection-aware walk. The `KNOWN_SECTIONS` `Set` becomes a structure keyed by section with a nested allowed-collections set. `findContentFiles` needs a new `collection` field on each file record.
- `scripts/vault-section-minto-generator.cjs` - currently produces `<section>/MINTO.md`. Needs to also produce `<section>/<collection>/MINTO.md` and a rollup at the section level.
- `session-start` hook - displays the current room map. Needs to render the new three-level tree without exploding in verbosity. Folding collections under sections is mandatory; auto-expanding them for every session would cost several hundred tokens per user.
- `/mos:dashboard` and `/mos:wiki` - visualize the room. The dashboard already has a hierarchical graph view. Adding a level is not trivial but it is additive.
- Every command that walks sections: `/mos:reason`, `/mos:grade`, `/mos:deep-grade`, `/mos:present`, `/mos:export`, `/mos:snapshot`, `/mos:organize`, `/mos:query`, `/mos:graph`. All of them currently assume section -> artifact. All of them need a collection-aware iteration pattern. This is the single largest surface area of change.

The backwards-compatibility rule: when a section has artifacts directly (no collection layer), those artifacts continue to work. The scanner treats them as belonging to a synthetic default collection named `_root/`. The MINTO generator produces the same output it does today for those. New collections sit alongside, not under, the synthetic default. This lets existing rooms migrate lazily.

### 7.2 Extending KNOWN_SECTIONS from 11 to ~40 canonical

The current `Set` is hardcoded in `room-scanner.cjs`. For v2.0 it becomes a loaded structure from `lib/scaffold/tier-0.json`, `lib/scaffold/tier-1.json`, `lib/scaffold/tier-2-b2b-saas.json`, etc. Structure per section:

```
{
  "name": "stakeholder-analysis",
  "tier": 0,
  "description": "people and orgs with a stake in the outcome",
  "collections": [
    {"name": "stakeholders", "description": "..."},
    {"name": "influence-interest-map", "description": "..."},
    {"name": "concerns", "description": "..."},
    {"name": "commitments", "description": "..."},
    {"name": "interviews", "description": "..."}
  ],
  "room-md-template": "templates/stakeholder-analysis.md"
}
```

Per-room customization lives in `room/.mos/scaffold.json` and records added sections, hidden sections, and user-added collections with user-defined names. The loader merges the tier defaults with the per-room overrides.

### 7.3 Declaring collection schemas without being rigid

Every collection needs a frontmatter template so that artifacts filed into it are uniform enough to be queryable. Example for `decisions/active/`:

```
---
decision: <string>
rationale: <string>
reversibility: reversible | irreversible | costly
witnesses: [<name>, ...]
date: YYYY-MM-DD
pressure_context: <string>
status: active | reversed | pending
---
```

The template is a suggestion, not a contract. Artifacts that diverge from the template still file correctly. The MINTO generator handles missing fields gracefully. This preserves the plain-markdown-first property that made MindrianOS portable.

### 7.4 Storing the scaffold template set

Proposed location: `lib/scaffold/`. Files:

- `tier-0.json` - the foundational scaffold
- `tier-1-pre-opportunity.json`, `tier-1-discovery.json`, `tier-1-opportunity.json`, `tier-1-scaling.json`
- `tier-2-b2b-saas.json`, `tier-2-nonprofit.json`, `tier-2-research.json`, `tier-2-hardware.json`, `tier-2-regulated.json`
- `tier-3-triggers.json` - the keyword and signal table for context-triggered sections
- `templates/` - per-section ROOM.md templates

Loading happens in `lib/scaffold/loader.cjs`. Used by `/mos:new-project` on room creation and by `/mos:organize` for mid-life scaffold operations.

### 7.5 New skill: context-trigger detector

New skill in `skills/room-context-triggers/SKILL.md`. Auto-activated when `room/` exists. Hooks on session-start and on post-filing. Reads the last N sessions from `.mos/conversation-log/` (which does not exist yet - a precondition is that the plugin starts logging user turns locally for trigger purposes; this must be privacy-preserving and local-only).

Alternative: trigger detection runs off the existing meeting transcripts and filed artifacts, not off the raw conversation log. This is privacy-cleaner but misses signals that live in the chat. The v2.0 decision is probably to start with filed-artifact triggers only and defer chat-log triggers to a later phase with explicit user opt-in.

### 7.6 New skill and command: cofounder-synthesis

New skill `skills/cofounder-voice/SKILL.md` auto-activated when the room has >=N artifacts and >=M sections populated. New command `commands/ask-cofounder.md` runs the synthesis layer against a user question. Synthesis lives in `lib/core/cofounder-synthesis.cjs` which:

1. Loads the scaffold state (which sections, which collections exist)
2. Loads each section's MINTO.md
3. Loads `contradictions-held/` as mandatory first input
4. Loads the voice-log from `.mos/voice-log/` as mandatory self-reconciliation input
5. Produces the recommendation via a prompt that is conservative on uncertainty and explicit about contradictions
6. Appends the new recommendation to the voice-log for future self-reconciliation

This is the one component that is genuinely new research. The MINTO-composition, the scaffold walker, the trigger detector - these are known-pattern extensions. The synthesis layer's trust-building behavior is not a solved problem.

### 7.7 Performance

Walking 40 sections, each with 5-10 collections, each with 5-50 artifacts = ~2,000-20,000 file stats at the high end. session-start must stay under 2 seconds per the ui-system contract.

Mitigations:

- Scanner caches. `.mos/scan-cache.json` holds a hash of each directory's mtime plus a snapshot of its structure. Only directories with changed mtimes are re-walked.
- Parallel walks. `Promise.all` across sections.
- Lazy collection walks. session-start does not walk inside collections unless the display explicitly needs it. The tree-view can show "section has N collections, M artifacts total" without walking.
- Soft budget. If a scan exceeds 1500ms, it returns a partial snapshot and logs the budget violation for a later background fix.

These are all additive to existing patterns the scanner does not yet do. The performance work is non-trivial but not novel.

### 7.8 Test strategy

- **Scaffold generator.** Fixture-based tests. Given a questionnaire answer set, produce the expected scaffold. Diff against golden files.
- **Trigger detector.** Property tests. Given a stream of N events with K of them matching a trigger, the detector should fire exactly when the threshold is crossed. Thresholds are configurable so the test varies them.
- **Synthesis layer.** This is the hard one. Unit tests can validate structural properties (voice always cites artifacts, voice always includes a confidence score, voice never contradicts its own past answers without explicitly naming the flip). Semantic quality cannot be unit-tested - it has to be validated by user trials. The Dror test (Section 6.8) is the acceptance test.
- **Migration.** Existing pre-v2.0 rooms converted to v2.0 must scan identically to before (no loss), and must be expandable to the new scaffold without moving any existing files.

### 7.9 Dependency on Decisions 1 through 16

- **Decision 1 (one-command install).** Nothing in this proposal adds an install-time dependency. The scaffold JSON ships in the plugin. The synthesis layer runs on the user's Claude context, not on a remote service.
- **Decision 8 (Tier 0 fully functional, no dependencies).** The co-founder voice must work without Brain. With Brain, it becomes enriched - the Brain can add cross-venture pattern context. Without Brain, it still produces a useful recommendation from local artifacts. This must be verified in tests, not assumed.
- **Decision 15 (ROOM.md everywhere).** Every section and every collection gets a ROOM.md. The three-level hierarchy multiplies the ROOM.md count by ~5x. The ROOM.md template system (`lib/scaffold/templates/`) makes this automatic.
- **Decision 16 (nested artifact folders).** Unchanged. An artifact is still a folder with a markdown file plus attachments. The new level is above the artifact, not below it.
- **Decision 13 (rejection is data).** Heavily used. Every trigger rejection, every proposed section hidden, every voice-log disagreement becomes graph data.

No decision is contradicted by this proposal. Decision 15 expands in scope but does not change in substance.

---

## 8. Milestone proposal

The user's working style (from USER.md context and session history) forbids a 20-phase megaproject. The proposal below is staged so each stage ships a working slice that can be tested by Dror-class users before the next stage starts.

v1.11.0 is already reserved for release pipeline hardening (beta). The smart-notebook work starts at v1.12.0 and reaches v2.0 when the co-founder voice is trusted.

### 8.1 Stage A: Scaffold expansion (v1.12.0)

**Scope.** Expand `KNOWN_SECTIONS` from 11 to the full Tier 0 list (17 sections). No collection layer yet. Tier 0 sections are flat like v1.x. New sections: `stakeholder-analysis`, `value-proposition` (as peer), `team-building`, `decisions`, `assumptions` (promoted from file to section), `experiments`, `research-documents`. Plus rename `competitive-analysis` to `competition` with a backwards-compatible alias.

**Proves.** The wider default scaffold is usable, does not overwhelm new users, and existing rooms can migrate.

**Deliverable.** `lib/scaffold/tier-0.json`, updated `room-scanner.cjs`, `/mos:organize --materialize-tier-0` migration verb, updated session-start rendering, tests.

**Dror test.** Dror creates a new project. The fresh scaffold shows 17 sections with ROOM.md templates. Dror files one meeting. The meeting intelligence routes to the right section.

**Non-goals.** No collections, no triggers, no synthesis layer.

**Size.** 2-3 phases, 2 weeks.

### 8.2 Stage B: Collection layer (v1.13.0)

**Scope.** Introduce the collection level as a first-class architectural concept. One pilot section gets its full collection set: `stakeholder-analysis/` with all five collections. The scanner learns to walk three levels. The MINTO generator learns to produce per-collection and section-rollup MINTOs. Every other section continues to work flat.

**Proves.** The three-level hierarchy is tractable. The scanner, generator, and session-start render correctly. The pilot section feels better to use than the flat version.

**Deliverable.** Scanner collection support, generator three-level support, migration strategy document, one pilot section fully populated, tests.

**Dror test.** Dror runs `/mos:stakeholder-analysis`, the command materializes the collection structure, files five stakeholder interviews into `interviews/`, and produces a per-collection MINTO that rolls up into the section MINTO.

**Non-goals.** Not all sections get collections yet. No triggers. No synthesis voice.

**Size.** 3-4 phases, 3 weeks.

### 8.3 Stage C: Dynamic expansion triggers (v1.14.0)

**Scope.** Ship the trigger framework. Start with three triggers only:

- Method invocation trigger (Section 5.7) - a command asks for a section that does not exist, offer to create it
- Missing-dimension audit (Section 5.4) - weekly scan, surface top 3 gaps
- Stage transition (Section 5.6) - on stage change, offer the Tier 1 sections

These three triggers are the lowest-risk, highest-value subset. Keyword triggers (5.2) and cross-section contradiction triggers (5.3) are deferred - they have higher false-positive risk.

**Proves.** Users accept the structure-growing model. Rejection is captured. The rejection rate is below some threshold (if Larry proposes sections and users reject >70% of them, the triggers are miscalibrated and need work before shipping more).

**Deliverable.** Trigger framework in `lib/core/triggers.cjs`, three triggers, rejection log, integration with `/mos:scout`, tests.

**Dror test.** Dror progresses his room from Pre-Opportunity to Discovery. Larry offers to open `validation/`. Dror accepts. The section materializes with the four Tier 1 collections.

**Non-goals.** Keyword triggers. Contradiction triggers. Synthesis voice.

**Size.** 2-3 phases, 2 weeks.

### 8.4 Stage D: Synthesis voice alpha (v1.15.0-alpha)

**Scope.** Minimum viable co-founder voice. `/mos:ask-cofounder` command. Surface-on-entry paragraph on session-start. No disagreement mode yet. Uses Feynman-MINTO section MINTOs as input. Voice-log persistence.

**Proves.** The synthesis layer produces useful answers on the Dror test. Users report the voice added value at least once in the first week.

**Deliverable.** `lib/core/cofounder-synthesis.cjs`, `commands/ask-cofounder.md`, voice-log infrastructure, tests, calibration document.

**Dror test.** Dror asks "should I raise now?" after three weeks of filing. The voice produces a specific recommendation, cites 3-5 artifacts, flags any held contradictions, and assigns a confidence.

**Non-goals.** Keyword triggers. Contradiction triggers. Disagreement mode. Cross-venture pattern learning.

**Size.** 4-5 phases, 4 weeks. This is the highest-risk stage.

### 8.5 Stage E: Voice hardening and remaining triggers (v2.0)

**Scope.** Add disagreement mode. Add keyword triggers (5.2) and cross-section contradiction triggers (5.3). Calibrate rejection thresholds from real user data. Ship the full Tier 1, Tier 2, and Tier 3 scaffold sets. Migration path for all existing rooms.

**Proves.** The full reframe is operational. Dror 2.0 can activate alone, reach a filed artifact, see a dashboard, ask the voice a question, and get something useful.

**Deliverable.** v2.0 release. CHANGELOG entry naming the reframe. Migration guide for existing users.

**Non-goals.** Cross-venture learning. The Brain does not see per-user voice data yet. That is a later milestone.

**Size.** 5-6 phases, 5-6 weeks.

### 8.6 Total

Approximately 16-21 phases across five stages, ~16 weeks end-to-end with normal cadence. This is a major milestone. It is also cuttable at any stage boundary - Stage A alone delivers real value (the expanded Tier 0 scaffold) even if Stages B through E are deferred.

### 8.7 What defers to later

- **Cross-venture learning.** The Brain learns from anonymized voice interactions across all rooms. Separate milestone.
- **Voice personalization.** The voice adopts the user's own phrasing and jargon over time. Separate milestone.
- **Multi-voice rooms.** Multiple synthesized perspectives (co-founder, advisor, investor) not just one. Separate milestone.
- **External integrations as trigger sources.** Slack, email, calendar as signal inputs. Separate milestone (interacts with the Phase 18 Dynamic Integrations project already in memory).

---

## 9. Risks and open questions

### 9.1 Risk: Scaffold bloat

Shipping 17 Tier 0 sections means a fresh room has 17 mostly-empty folders. For Dror, this could feel overwhelming - he came here to work on his problem, and the product handed him a filing cabinet.

**Mitigation.** The session-start rendering folds empty sections by default. Only non-empty sections are listed in the 4-zone session-start body. Empty sections are accessible via `/mos:organize` but do not clutter the main view. The ROOM.md template for each empty section explicitly says "this section is a scaffold, file something when you have it, nothing is wrong with it being empty."

**Residual risk.** Users who explore the filesystem directly will see the 17 folders. Some users will find this overwhelming. Acceptable cost.

### 9.2 Risk: Trigger noise

Larry proposing new sections every session becomes annoying fast. If the user rejects five proposals in a row, the product feels aggressive.

**Mitigation.** Hard cap: at most 1 trigger proposal per session-start. Rejections tighten the next proposal's threshold. After 3 consecutive rejections of any trigger type, that trigger type is silenced for 14 days.

**Residual risk.** A user who genuinely needs a section but keeps hitting snooze will not get the suggestion. Accept this; the user can materialize manually.

### 9.3 Risk: Synthesis layer confidently wrong

The worst failure mode. The voice says "raise now" with confidence 8, the user does, the round fails, the voice says "oh, I did not know X." Worse than being silent.

**Mitigation.** Confidence calibration discipline. The voice is forbidden from confidence >6 on any recommendation that depends on an assumption older than 30 days or on a cross-section edge that is unresolved. Confidence is produced mechanically from evidence age, edge stability, and contradiction status. Not from vibes.

**Residual risk.** Users may anchor on a confidence-5 recommendation as if it were a confidence-8. Education is not a solution. The product's tone around the voice must reinforce that this is a notebook, not an oracle.

### 9.4 Risk: Breaking existing rooms on migration

v1.x rooms have 11 sections and zero collections. v2.0 rooms have 17+ sections and many collections. If migration is forced, existing users break.

**Mitigation.** Migration is opt-in. `/mos:organize --migrate-to-v2` is a verb the user runs when ready. Until then, v2.0 plugins see v1.x rooms as "legacy layout" and walk them with the current scanner path. `competitive-analysis` -> `competition` rename uses an alias, not a move.

**Residual risk.** Users who never migrate miss the new features. Accept.

### 9.5 Risk: Co-founder metaphor over-promising

Users hear "co-founder" and expect a person. They get an LLM synthesis. The gap between expectation and reality destroys trust.

**Mitigation.** The product language is "notebook voice" in user-facing copy. "Co-founder" is the internal design north star, not the marketing term. The voice's own self-description explicitly says it is a synthesis of the room's artifacts, not a person.

**Residual risk.** Some users will still project. Accept.

### 9.6 Open question: Brain dependency

How much of the synthesis layer depends on Brain (the 21K-node teaching graph at brain.mindrian.ai) versus runs entirely locally?

**Initial read.** The local-only path must be fully functional (Decision 8). Brain adds cross-venture pattern context, not core voice capability. The voice can recommend without Brain; with Brain it can say "this is the third time I have seen a venture in this shape, the other two ran into X."

**Needs research.** What exactly does Brain contribute that cannot be done locally? Does Brain need a new node type for voice interactions? Does Brain learn from voice interactions in a way that affects other users? If yes, the privacy model needs explicit design.

### 9.7 Open question: interaction with v3.0 MCP server work

`.planning/PROJECT.md` has a v3.0 backlog for dual delivery (CLI + MCP server). The smart-notebook work assumes CLI-side execution. When v3.0 ships MCP, the synthesis layer needs to be exposed as an MCP tool: `ask_cofounder(question)`.

**Needs research.** Does the synthesis layer's file-system dependency (voice-log, scaffold.json, MINTO files) work cleanly when the MCP server is running remote? If yes, direct expose. If no, redesign. This interacts with the "room folder must be accessible (Git sync, mounted volume, or shared drive)" constraint already in STACK.md v3.0 notes.

### 9.8 Open question: validating the voice against real founder decisions

Can we backtest? Take a venture that has run for 12 months with a mature MindrianOS room. Freeze the room at month 6. Ask the voice "what would you do now?" Compare to what the founders actually did over months 6 through 12. Score on whether the voice's recommendation aligned with the good outcomes and avoided the bad ones.

**Needs research.** Do we have enough mature rooms to do this? Jonathan's own room may be the only one dense enough. N=1 is not validation. The alternative is synthetic: replay the room state at each week in its history and test whether the voice's recommendations would have improved outcomes if followed. This is cheaper but less convincing.

### 9.9 Open question: does the voice see the conversation log?

Section 5.2 noted that keyword triggers can read filed artifacts OR raw conversation turns. Filed-only is privacy-clean but misses a lot of signal. Conversation-log-aware is richer but requires local logging with clear user opt-in. The v2.0 default is filed-only. Raw conversation access is a later, opt-in feature.

**Needs research.** What is the right storage format for a conversation log? Is Claude Code's native session transcript directly accessible to plugin code? Does the plugin need to instrument message capture? How does this interact with Desktop and Cowork where the plugin's file access is different?

### 9.10 Open question: multi-room voice sharing

A user with multiple rooms (Jonathan has PWS, VOL, milken-twin, etc.) might want the voice to know things across rooms. "My other venture had this same stakeholder tension." Cross-room voice is orthogonal to cross-venture Brain learning because it stays within one user's scope.

**Needs research.** How does `/mos:rooms` interact with the voice? Is there a per-user-scoped layer above per-room scaffolds? This may be where the "Mindrian as a user operating system" metaphor gets real.

---

## 10. References and further reading

### 10.1 Primary source

- Jonathan Sagir, verbal reframe, 2026-04-14, summarized in the task brief that produced this document. The Notion "Problem Worth Solving" template he built and pointed at as the structural trigger for the reframe.

### 10.2 Foundational literature already in CLAUDE.md

- Simon, Herbert A. 1962. "The Architecture of Complexity." *Proceedings of the American Philosophical Society* 106 (6). Near-decomposable hierarchies as the universal form of stable complex systems. The theoretical basis for the three-level section/collection/artifact hierarchy in Section 4.
- Rittel, Horst W. J., and Melvin M. Webber. 1973. "Dilemmas in a General Theory of Planning." *Policy Sciences* 4. The ten characteristics of wicked problems. Justifies holding contradictions in tension rather than resolving them prematurely (Section 6.5).
- Van Clief, Stuart, and Ben McDermott. 2026. *ICM: Integrated Context Management*. The "folder structure is the code" thesis. The scaffold in Section 4 IS the ICM Layer 0.
- Tetlock, Philip E. 2015. *Superforecasting: The Art and Science of Prediction*. Calibrated confidence, Bayesian updating, decomposition. Directly shapes the voice's confidence scoring in Section 6.3 through 6.7.
- Hughes, Thomas P. 1983. *Networks of Power: Electrification in Western Society*. The reverse salient concept - the lagging component in an expanding system. Directly shapes the graph edge pressure trigger in Section 5.5 and the `reverse-salients/` Tier 3 section.
- Knight, Frank H. 1921. *Risk, Uncertainty, and Profit*. The risk/uncertainty distinction. Shapes the voice's handling of known unknowns versus unknown unknowns in Section 1.7.

### 10.3 Adjacent literature pulled in for the co-founder dimension

- Horowitz, Ben. 2014. *The Hard Thing About Hard Things*. The CEO psychology dimension. Two-in-the-morning decisions. Cluster 1.5 (felt runway pressure) and the disagreement mode in Section 6.1.
- Catmull, Ed. 2014. *Creativity Inc*. Cultural non-negotiables, the things you defend. Section 1.6 (unstated values, the "we do not do that" list).
- Cagan, Marty. 2017. *Inspired: How to Create Tech Products Customers Love*. Discovery as continuous, not a phase. Justifies the `discovery/` and `validation/` sections existing alongside delivery sections at every stage.
- Voss, Chris. 2016. *Never Split the Difference*. Negotiation memory and the no-behind-the-no. Section 1.3 (verbal promises, commitments not yet in writing).
- Bungay, Stephen. 2010. *The Art of Action*. Commander's intent, friction, decision rationale captured so subordinates can improvise correctly. Directly shapes the `decisions/` section's frontmatter schema in Section 7.3.

### 10.4 Comparable tools in the market

- **Notion.** The trigger for this reframe. Pages with inline databases, user-declared schemas, freeform nesting. Strength: flexibility and user empowerment to grow structure. Weakness: no synthesis, no intelligence layer, everything is manual. The Notion page IS the "data room" done well; it is not a co-founder.
- **Coda.** Similar flexibility to Notion, with a stronger formula language. Same weakness. No voice.
- **Obsidian.** The vault metaphor MindrianOS already ships compatibility with (Decision 16). Strong on graph, weak on scaffold and weak on synthesized voice. Obsidian is the backup surface, not the destination.
- **Roam Research.** Bidirectional links as the primary structural concept. Strong on graph discovery, weak on scaffold. A Roam graph grows organically and gets overwhelming fast - no tiered structure, no default to guide the user.
- **Tana.** Super-tags and AI features layered on an outliner. Closest to the "smart notebook" metaphor in spirit. Weak on domain-specific scaffold - Tana wants you to define your own structure. MindrianOS ships one pre-loaded.
- **Mem.** AI-first notebook with auto-linking and a chat surface. Chat-over-notes is close to the voice layer, but Mem does not scaffold and does not hold contradictions.
- **Reflect.** AI-augmented daily notes. Personal journal with an AI layer. Not venture-specific.
- **Granola.** AI meeting notes. Strong on one axis MindrianOS already covers (meeting intelligence). Not a notebook, not a scaffold.

### 10.5 Existing AI "co-founder" products and why they fall short

- **General-purpose LLM chatbots used as a "startup co-founder."** ChatGPT, Claude, etc. No persistent context, no room-grounded memory, no calibration, no voice-log. Every session starts from zero. Useful for idea generation, useless for co-founder judgment.
- **"AI advisor" apps (multiple startups).** Thin wrappers around an LLM with a prompt like "you are a startup advisor." No persistent artifact base, no contradiction tracking, no honest uncertainty. These are interactive magic-8-balls.
- **Vertical "AI co-pilots" for specific functions (Copilot, sales GPTs, marketing GPTs).** Strong on a single function. None of them hold the cross-functional judgment that a co-founder holds. A co-founder has to integrate sales, product, finance, and culture at once.

The gap every existing product leaves: a persistent, venture-grounded, calibrated, contradiction-aware, opinion-capable voice. That is exactly the gap MindrianOS v2.0 is proposing to fill, and it is the gap the existing taxonomy of tools does not address.

### 10.6 Internal references

- `/home/jsagi/MindrianOS-Plugin/CLAUDE.md` - main architecture and Decisions 1 through 16
- `/home/jsagi/MindrianOS-Plugin/.claude/includes/architecture.md` - the ICM x Simon x Rittel triangle
- `/home/jsagi/MindrianOS-Plugin/.claude/includes/decisions.md` - decision table
- `/home/jsagi/MindrianOS-Plugin/.planning/PROJECT.md` - v3.0 backlog and Notion Template Gap Close section
- `/home/jsagi/MindrianOS-Plugin/.planning/phases/81-feynman-minto-hybrid/81-CONTEXT.md` - Revision 2, per-section narrative compression infrastructure the voice rides on
- `/home/jsagi/MindrianOS-Plugin/lib/vault/room-scanner.cjs` - the canonical KNOWN_SECTIONS set and walker that needs extension
- `/home/jsagi/MindrianOS-Plugin/scripts/vault-section-minto-generator.cjs` - the MINTO generator the synthesis layer composes over
- `/home/jsagi/MindrianOS-Plugin/commands/` - existing ~65 slash commands including `/mos:organize`, `/mos:reason`, `/mos:new-project`, `/mos:dashboard`, `/mos:wiki`, all of which are touch points for the scaffold expansion
- `/home/jsagi/MindrianOS-Plugin/skills/` - 8 core skills (brain-connector, context-engine, conversation-mode, larry-personality, pws-methodology, room-passive, room-proactive, ui-system). The proposed new skills are `room-context-triggers` and `cofounder-voice`.
- `/home/jsagi/MindrianOS-Plugin/docs/MWP-SPECIFICATION.md` - the 7-layer Mindrian Workspace Protocol. The voice must not operate outside this protocol.
- `/home/jsagi/MindrianOS-Plugin/docs/MOAT-MANDATE.md` - every feature must deepen the moat. The voice deepens it by composing Feynman-MINTO + LazyGraph + Brain enrichment into a single user-facing surface.

---

## Closing note for the future Claude session reading this

You are the next reader. You are probably being asked "build the smart notebook co-founder thing." Before you propose a phase plan, check these things:

1. Re-read Section 2 (the coverage matrix). Confirm the gaps are still the gaps. If the product has already closed some of them in the intervening months, the staging in Section 8 should shrink accordingly.
2. Re-read Section 6 (synthesis layer). The hardest part. If you find yourself designing it as "a prompt that reads the MINTO files," you have missed the trust-building and contradiction-holding requirements. Go back to 6.5 and 6.7.
3. Re-read Section 9 (risks and open questions). The open questions are not rhetorical - they are the list of things you need to research before committing to an architecture. Spend a session on them before writing a phase plan.
4. Do not skip the Dror test. A v2.0 that passes internal review but fails the Dror test is a failure. The Dror test is the user's only real acceptance criterion.
5. The moat is not "we have a voice." The moat is "we have the only voice that is grounded in a Simon-decomposed, Rittel-aware, Tetlock-calibrated, contradiction-holding artifact base that the user actually uses." Every piece of that sentence is load-bearing.

This document is 800 to 1500 lines of dense research. It is not a plan. You are the one who writes the plan. Use this as the ground you stand on.
