---
wish: generate-hub.cjs output must match synteris-full-hub.vercel.app quality
observed: 2026-04-05
context: "Side-by-side comparison shows our generator produces a basic skeleton. The Synteris hub has persona cards, view buttons, grade circles, richer stats, badges, gating questions. The generator needs to close that gap completely."
status: OPEN
priority: critical
reference: https://synteris-full-hub.vercel.app/
local_reference: /home/jsagi/room-adam/exports/synteris-hub.html
decision: D20
---

# W014: Hub Generator Must Match Synteris Quality

## What Synteris Has That We Don't

### 1. Persona Card (top of page)
- Avatar circle with initials
- "SIMULATED USER PERSONA" label
- Name, title, affiliations
- Colored credential badges (PhD, JHU, APL Fellow)
- Persona traits sidebar (Communication: terse/direct, Patience: low, etc.)
- Connection to Larry note
- Session goal quote
- Source buttons (Google Scholar, LinkedIn, Patents, Grants.gov)

### 2. Data Room Views Button Row
- Wiki, Graph Intelligence, Constellation, Dashboard, Deck, Insights, Diagrams
- Narrative, Synthesis tabs below
- Each with icon + label
- These link to the multi-file views (if generated) or are decorative

### 3. Venture Card with Grade
- B+ grade circle (large, right-aligned)
- "SESSION GRADE" label
- Founder, Employees, Funding, Affiliation metadata row

### 4. Richer Stats Row
- 11 SECTIONS, 25 DOCUMENTS, 8 MARKET ANALYSES, 4 FRAMEWORKS, $4M GRANTS SECURED, B+ SESSION GRADE
- Not just artifact count -- domain-specific stats extracted from room content

### 5. Market Cards (not generic cards)
- Market name + badge ("Priority Beachhead")
- TAM, CAGR, Addressable, HSI Score stats row
- Finding paragraph with links
- Gating Question box

### 6. Framework Section
- Methodology cards with stage indicators
- Output summaries per framework run

### 7. Research Section  
- External research with source links
- Cross-referenced findings

### 8. Transcript Section
- Session transcript with speaker attribution
- Collapsible sections

### 9. Deck Section
- Slide-by-slide presentation

### 10. Grade Section
- Full grading rubric with scores per component
- Radar chart (Chart.js)
- Letter grade with percentile

### 11. "Get Summary" Notification
- Top-right toast notification
- Quick action button

## What generate-hub.cjs Currently Produces
- Mondrian header (correct)
- Tab navigation (correct)
- Overview with venture card and stats (basic -- missing grade, persona, view buttons)
- Section tabs with article cards (basic -- missing badges, stats, gating questions)
- Footer (correct)

## Implementation Path
The generator needs to detect what data exists in the room and render the appropriate rich components:
- If GRADE.md exists -> render grade circle + rubric
- If team/ has profiles -> render persona card
- If market-analysis/ has entries -> render market cards with TAM/stats
- If methodology frontmatter exists -> render framework cards
- If meetings/ has transcripts -> render transcript section
- Otherwise -> fall back to generic cards (what we have now)

The template CSS is already in synteris-hub.html (2561 lines). Extract and generalize.
