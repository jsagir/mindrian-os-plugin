# Segment Classification Taxonomy -- Meeting Intelligence

*Used by `file-meeting` to classify each speaker turn into a segment type for filing.*

---

## The 6 Segment Types (Priority Order)

| Priority | Type | Description | Filing Action |
|----------|------|-------------|---------------|
| HIGHEST | decision | Explicit choices made, direction set | File to target section, flag cascades |
| HIGH | action-item | Tasks assigned, deadlines mentioned | File to target section + action tracking |
| MEDIUM | insight | New information, discoveries, data points | File to target section |
| MEDIUM | advice | Recommendations, suggestions, should/could | File to speaker's advice folder + section |
| LOW | question | Open questions, uncertainties raised | File as gap/question in target section |
| SKIP | noise | Greetings, small talk, logistics, off-topic | Skip (unless flagged -- see Flag Rule below) |

---

## Type Definitions and Heuristics

### 1. decision (HIGHEST)

**Definition:** A speaker explicitly commits to a course of action, selects between options, or sets direction for the venture.

**Signal phrases:**
- "We've decided to..."
- "Let's go with..."
- "The plan is to..."
- "We're going to..."
- "I'm committing to..."
- "That's final"
- "We'll move forward with..."
- Negation decisions: "We're NOT doing X" / "We're killing that feature"

**Role-aware heuristics:**
| Speaker Role | Priority Modifier | Rationale |
|-------------|-------------------|-----------|
| founder | +1 | Founders make binding decisions |
| investor | +1 (conditional) | Only if decision involves funding/terms |
| mentor | 0 | Mentors advise, rarely decide |
| team-member | 0 | Context-dependent -- may decide within scope |

**Confidence indicators:**
- HIGH: Definitive language ("we will", "decided", "final")
- MEDIUM: Conditional ("if X then we'll do Y", "probably going with")
- LOW: Hypothetical ("we might want to", "it could make sense to")

**Classification rule:** If a statement both makes a decision AND assigns an action, classify as `decision` (higher priority). The action item is captured as a sub-element.

---

### 2. action-item (HIGH)

**Definition:** A task is explicitly assigned to someone, or a deadline is mentioned for deliverable work.

**Signal phrases:**
- "{Name} will..."
- "Can you {task} by {date}?"
- "Action item: ..."
- "Let's have {deliverable} ready by..."
- "I'll send that over"
- "Follow up on..."
- "TODO: ..."
- "Next step: ..."

**Extracted fields:**
- `owner`: Who is responsible (name or role)
- `task`: What needs to be done
- `deadline`: When (if mentioned -- NEVER invent a deadline)
- `context`: Why this action matters

**Role-aware heuristics:**
| Speaker Role | Priority Modifier | Rationale |
|-------------|-------------------|-----------|
| founder | 0 | Normal -- founders assign work |
| mentor | +1 | Mentor-assigned actions carry weight |
| investor | +1 | Investor requests are high-priority |
| team-member | 0 | Normal task assignment |

**Confidence indicators:**
- HIGH: Named owner + specific task ("Sarah will prepare the deck")
- MEDIUM: Implicit owner ("someone should look into that")
- LOW: Vague future ("we need to think about this at some point")

---

### 3. insight (MEDIUM)

**Definition:** New information, a discovery, a data point, or an observation that adds to the venture's knowledge base.

**Signal phrases:**
- "I found out that..."
- "The data shows..."
- "Interesting -- I didn't know that..."
- "According to {source}..."
- "The market is {specific observation}"
- Numbers, statistics, percentages
- Comparisons: "X is bigger/smaller/faster than Y"
- "What we learned is..."

**Role-aware heuristics:**
| Speaker Role | Priority Modifier | Rationale |
|-------------|-------------------|-----------|
| researcher | +1 | Researchers produce high-quality insights |
| domain-expert | +1 | Domain expertise makes insights more valuable |
| customer | +1 | Customer insights are primary market data |
| investor | 0 | Investor observations are insight or advice depending on framing |

**Confidence indicators:**
- HIGH: Specific data ("revenue grew 23% last quarter")
- MEDIUM: Observation with reasoning ("the enterprise segment seems stronger because...")
- LOW: Impression without evidence ("I feel like the market is shifting")

**Assumption extraction:** Every insight implies an assumption. Extract it:
- Insight: "The TAM is $190M" -> Assumption: `claim: "TAM is $190M", status: unvalidated`
- Insight: "Enterprise customers have 18-month sales cycles" -> Assumption: `claim: "Enterprise sales cycles are 18 months", status: unvalidated`

---

### 4. advice (MEDIUM)

**Definition:** A recommendation, suggestion, or guidance offered by a speaker. Framed as "you should" rather than "we will."

**Signal phrases:**
- "You should..."
- "I'd recommend..."
- "Have you considered..."
- "My suggestion would be..."
- "In my experience..."
- "What worked for us was..."
- "I'd be careful about..."
- "Watch out for..."
- "One thing to think about..."

**Role-aware heuristics:**
| Speaker Role | Priority Modifier | Rationale |
|-------------|-------------------|-----------|
| mentor | +1 | Mentors' primary output is advice |
| advisor | +1 | Advisors' primary output is advice |
| investor | +1 | Investor advice often signals deal criteria |
| domain-expert | +1 | Domain expertise makes advice actionable |
| competitor | -1 | Competitor "advice" is suspect |

**Dual filing:** Advice is filed to BOTH:
1. The relevant room section (based on content)
2. The speaker's `advice/` subfolder in their profile

**Confidence indicators:**
- HIGH: Specific actionable recommendation ("hire a VP Sales before Series A")
- MEDIUM: General direction ("you should think about enterprise")
- LOW: Vague encouragement ("keep doing what you're doing")

---

### 5. question (LOW)

**Definition:** An open question or uncertainty raised during the meeting. Represents a gap in knowledge.

**Signal phrases:**
- "What about...?"
- "How do we...?"
- "Do we know...?"
- "Has anyone looked into...?"
- "I'm not sure about..."
- "What if...?"
- "Why is...?"

**Role-aware heuristics:**
| Speaker Role | Priority Modifier | Rationale |
|-------------|-------------------|-----------|
| investor | +2 | Investor questions often signal deal-breaking concerns |
| mentor | +1 | Mentor questions reveal blind spots |
| customer | +1 | Customer questions reveal product gaps |
| team-member | 0 | Normal operational questions |

**Important:** Investor questions about financials, market size, or competition are ALWAYS priority-boosted. An investor asking "What's your churn rate?" is not a LOW-priority question -- it signals a critical data gap.

**Filing:** Questions become gap entries in the relevant section. They represent "what we don't know yet."

**Confidence indicators:**
- HIGH: Direct question with clear topic ("What's our customer acquisition cost?")
- MEDIUM: Rhetorical or exploratory ("I wonder if the timing is right...")
- LOW: Conversational ("Does that make sense?")

---

### 6. noise (SKIP)

**Definition:** Content with no substantive value for the venture's knowledge base. Greetings, logistics, small talk, off-topic tangents.

**Examples:**
- "Hey everyone, can you hear me?"
- "Let me share my screen"
- "Sorry, I was on mute"
- "Should we take a 5-minute break?"
- "Nice weather today"
- "How was your weekend?"
- Laughter, filler words, repeated phrases

**SKIP rule:** Noise segments are not filed. They are excluded from the meeting summary's segment count.

---

## The Flag Potential Noise Rule

**Critical:** When a segment is classified as `noise` but contains ANY of the following, FLAG it for user review instead of skipping:

1. **Proper nouns** -- company names, person names, product names
2. **Competitor names** -- any mention of a known or potential competitor
3. **Numbers** -- revenue figures, percentages, dates, counts
4. **Technical terms** -- domain-specific language that might indicate hidden insight

**Example:**
```
"Oh by the way, I ran into the CEO of Acme Corp at that conference last week."
```
This looks like small talk (noise) but contains a competitor name ("Acme Corp") and a potential connection. Flag it.

**Flagged noise format:**
```
FLAGGED_NOISE: "{original text}"
REASON: Contains competitor name "Acme Corp"
ACTION: User review required -- may contain buried insight
```

---

## Classification Confidence Scoring

Each classified segment gets a confidence score (0.0 - 1.0):

| Score Range | Label | Meaning |
|-------------|-------|---------|
| 0.9 - 1.0 | HIGH | Clear signal phrases, unambiguous type |
| 0.7 - 0.89 | MEDIUM | Strong indicators but some ambiguity |
| 0.5 - 0.69 | LOW | Weak signals, multiple possible types |
| Below 0.5 | UNCERTAIN | Larry should ask user for classification |

**Threshold rule:** Segments with confidence below 0.5 are presented to the user: "I'm not sure how to classify this. Is it an insight, advice, or something else?"

---

## Multi-Type Segments

Some segments contain multiple types. Resolution rules:

1. **Higher priority wins** for primary classification
2. **Secondary types are noted** in the artifact metadata: `secondary_types: [insight, action-item]`
3. **Decision + Action:** Classify as `decision`, extract action as sub-element
4. **Insight + Advice:** If speaker is mentor/advisor, classify as `advice`. Otherwise, `insight`.
5. **Question + Insight:** If the question reveals new information, classify as `insight`. If purely asking, classify as `question`.

---

## Cross-Reference: Section Mapping

After classification, the segment type combines with the speaker role to determine the target room section. See `references/meeting/section-mapping.md` for the full routing matrix.
