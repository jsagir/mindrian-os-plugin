# Section Mapping Matrix -- Speaker Role x Segment Type x Room Section

*Used by `file-meeting` to route classified segments to the correct room section.*

---

## The 12 Speaker Roles

| Role | Description | Typical Context |
|------|-------------|-----------------|
| mentor | Teaching advisor, framework guide | Academic, accelerator |
| researcher | Subject matter researcher, analyst | Research team, consultants |
| team-member | Core team, employees | Internal meetings |
| investor | VC, angel, LP, fund manager | Pitch, board, due diligence |
| advisor | Strategic or technical advisor | Advisory board |
| customer | Current or potential customer | Discovery, feedback |
| founder | Company founder, CEO | All meetings |
| partner | Business partner, channel partner | Partnership discussions |
| domain-expert | Industry expert, specialist | Expert interviews |
| government | Regulator, government official | Compliance, grants |
| competitor | Known competitor representative | Conferences, panels |
| unknown | Unidentified speaker | Raw paste, unlabeled |

---

## The 8 Room Sections

| Section | Primary Content |
|---------|----------------|
| problem-definition | Problem framing, assumptions, scope, unknowns |
| market-analysis | Market size, trends, timing, customer needs |
| solution-design | Architecture, features, technical approach |
| business-model | Revenue, pricing, unit economics, channels |
| competitive-analysis | Competitors, positioning, differentiation |
| team-execution | Team, hiring, capabilities, leadership |
| legal-ip | IP, patents, regulation, compliance |
| financial-model | Funding, valuation, projections, burn rate |

---

## Routing Matrix

The matrix below maps `(speaker_role, segment_type)` to the primary room section and priority modifier.

**Reading the matrix:** Each cell contains `section (+priority_modifier)`. Empty cells mean "Larry decides based on content" -- the combination is too context-dependent for a fixed rule.

### decision

| Speaker Role | Primary Section | Priority Modifier | Notes |
|-------------|----------------|-------------------|-------|
| founder | *content-dependent* | +1 | Founders decide across all sections |
| investor | financial-model | +2 | Unless explicitly about another section |
| mentor | problem-definition | +1 | Mentors guide problem framing decisions |
| advisor | *content-dependent* | +1 | Advisors span multiple domains |
| team-member | team-execution | 0 | Unless clearly about another section |
| customer | solution-design | +1 | Customer decisions inform product |
| researcher | market-analysis | 0 | Research findings drive decisions |
| partner | business-model | +1 | Partnership decisions affect model |
| domain-expert | *content-dependent* | +1 | Expert domain determines section |
| government | legal-ip | +2 | Regulatory decisions are highest priority |
| competitor | competitive-analysis | 0 | Competitor decisions are intel |
| unknown | *content-dependent* | -1 | Lower confidence without role context |

### action-item

| Speaker Role | Primary Section | Priority Modifier | Notes |
|-------------|----------------|-------------------|-------|
| founder | *content-dependent* | +1 | Founder-assigned actions are high priority |
| investor | financial-model | +2 | Investor requests are critical |
| mentor | *content-dependent* | +1 | Mentor-assigned homework |
| advisor | *content-dependent* | +1 | Advisor follow-ups |
| team-member | team-execution | 0 | Standard task tracking |
| customer | solution-design | +1 | Customer-requested features |
| researcher | market-analysis | 0 | Research tasks |
| partner | business-model | 0 | Partnership deliverables |
| domain-expert | *content-dependent* | 0 | Expert recommendations to pursue |
| government | legal-ip | +1 | Compliance requirements |
| competitor | competitive-analysis | -1 | Rare -- flagged for review |
| unknown | *content-dependent* | -1 | Low confidence assignment |

### insight

| Speaker Role | Primary Section | Priority Modifier | Notes |
|-------------|----------------|-------------------|-------|
| founder | *content-dependent* | 0 | Founder insights span all sections |
| investor | financial-model | +1 | Investor insights signal deal criteria |
| mentor | problem-definition | +1 | Mentor insights reframe the problem |
| advisor | *content-dependent* | +1 | Advisor insights from experience |
| team-member | *content-dependent* | 0 | Context-dependent |
| customer | market-analysis | +2 | Customer insights are primary market data |
| researcher | market-analysis | +1 | Research findings |
| partner | business-model | +1 | Partnership ecosystem data |
| domain-expert | *content-dependent* | +1 | Expert knowledge is high value |
| government | legal-ip | +1 | Regulatory landscape intelligence |
| competitor | competitive-analysis | +2 | Competitor admissions are gold |
| unknown | *content-dependent* | -1 | Needs attribution for proper routing |

### advice

| Speaker Role | Primary Section | Priority Modifier | Notes |
|-------------|----------------|-------------------|-------|
| founder | team-execution | 0 | Founder advice usually about execution |
| investor | financial-model | +2 | Investor advice signals expectations |
| mentor | problem-definition | +1 | Mentor guidance on framing |
| advisor | *content-dependent* | +2 | Advisors' PRIMARY output is advice |
| team-member | *content-dependent* | 0 | Peer suggestions |
| customer | solution-design | +1 | Customer suggestions = feature requests |
| researcher | *content-dependent* | 0 | Research recommendations |
| partner | business-model | +1 | Partnership strategy guidance |
| domain-expert | *content-dependent* | +2 | Expert recommendations are high value |
| government | legal-ip | +1 | Compliance guidance |
| competitor | competitive-analysis | -2 | Competitor "advice" is suspect -- flag |
| unknown | *content-dependent* | -1 | Unattributed advice has less weight |

### question

| Speaker Role | Primary Section | Priority Modifier | Notes |
|-------------|----------------|-------------------|-------|
| founder | *content-dependent* | 0 | Founder questions reveal their blind spots |
| investor | financial-model | +2 | Investor questions signal due diligence gaps |
| mentor | problem-definition | +1 | Mentor questions are diagnostic |
| advisor | *content-dependent* | +1 | Advisor questions reveal risks |
| team-member | *content-dependent* | 0 | Operational questions |
| customer | market-analysis | +2 | Customer questions reveal unmet needs |
| researcher | *content-dependent* | 0 | Research questions |
| partner | business-model | +1 | Partnership feasibility concerns |
| domain-expert | *content-dependent* | +1 | Expert questions expose technical gaps |
| government | legal-ip | +2 | Regulatory questions are compliance flags |
| competitor | competitive-analysis | +1 | Competitor questions reveal their strategy |
| unknown | *content-dependent* | -1 | Low priority without role context |

### noise

Noise segments are SKIPPED unless flagged by the Flag Potential Noise Rule (see `segment-classification.md`). No routing matrix needed. Flagged noise goes to user review.

---

## Content-Dependent Routing

When the matrix shows `*content-dependent*`, Larry uses keyword analysis to determine the section:

1. Run the segment text through `scripts/classify-insight` keyword patterns
2. If `classify-insight` returns `SUGGEST:{section}:MEDIUM`, use that section
3. If `UNCERTAIN`, analyze context:
   - What section was the conversation discussing before this segment?
   - What keywords appear in the segment? (see keyword lists below)
   - What is the speaker's domain of expertise?
4. If still uncertain, ask the user: "Where should I file this {type} from {speaker}?"

**Section keyword hints:**

| Section | Keywords |
|---------|----------|
| problem-definition | problem, challenge, issue, scope, definition, assumption, unknown, question, gap, need |
| market-analysis | market, customer, trend, TAM, SAM, growth, segment, user, demand, adoption, timing |
| solution-design | product, feature, architecture, design, technology, platform, integration, UX, build |
| business-model | revenue, pricing, model, channel, cost, unit economics, margin, subscription, sales |
| competitive-analysis | competitor, alternative, moat, differentiation, advantage, threat, positioning, benchmark |
| team-execution | team, hire, role, culture, leadership, process, execution, sprint, velocity, roadmap |
| legal-ip | legal, patent, IP, regulation, compliance, license, terms, privacy, GDPR |
| financial-model | funding, valuation, runway, burn, projection, revenue, cap table, dilution, round |

---

## Priority Scoring

Final filing priority = base_segment_priority + role_modifier + content_relevance

| Base Priority | Score |
|---------------|-------|
| decision | 10 |
| action-item | 8 |
| insight | 6 |
| advice | 6 |
| question | 4 |
| noise | 0 |

**Role modifier:** From the routing matrix above (-2 to +2).

**Content relevance:** +1 if the segment directly references the target section's domain. +0 otherwise.

**Filing order:** Segments are filed highest-priority first. This ensures decisions and actions are captured before the user fatigues during the confirm-then-file loop.

---

## Cross-Reference Vocabulary

The section names and classification vocabulary in this file are shared with:
- `scripts/classify-insight` -- uses the same 8 section names and keyword patterns
- `references/meeting/segment-classification.md` -- defines the 6 segment types referenced here
- `references/meeting/artifact-template.md` -- `room_section` and `segment_type` fields use these exact values
- `skills/room-passive/SKILL.md` -- provenance metadata uses the same section vocabulary
