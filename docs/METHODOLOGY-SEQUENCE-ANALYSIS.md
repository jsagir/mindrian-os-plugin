# Methodology Sequence Analysis

**What was used, in what order, what decided the order, and where did the human choose?**

---

## The Sequence

| # | Framework | Problem Type at Entry | Who Decided | Why This One Next |
|---|-----------|----------------------|-------------|-------------------|
| 1 | new-project | Undefined + Complex | **System** (default entry point) | Every journey starts here. Larry explores before structuring. |
| 2 | explore-domains | Undefined + Complex | **Larry suggested**, user accepted | The venture exploration revealed 5 uncertainties. Before going deep on any one, map the territory. Domain Explorer answers "where are we?" before "where should we go?" |
| 3 | explore-trends | Undefined → Ill-defined | **Larry suggested**, user accepted | Domains mapped → now push them to extremes. "You know the landscape. Let's see where it's heading." Trends answer the timing question that domains raised. |
| 4 | analyze-needs | Ill-defined + Complex | **Larry suggested**, user accepted | Trends revealed a market. Now: who specifically has this problem? JTBD is the bridge between "market exists" and "here's my customer." |
| 5 | challenge-assumptions | Ill-defined + Complicated | **Larry insisted** | User wanted to jump to business model. Larry said no. "You've built a story. Before you build on it, let me stress-test it." Devil's Advocate BEFORE solution design — always. |
| 6 | analyze-timing | Ill-defined → Well-defined | **Larry suggested** based on challenge output | Assumptions challenged → the "when" question became urgent. S-curve analysis answers "is the market ready?" and "how long do I have?" |
| 7 | think-hats | Well-defined + Complicated | **User asked** ("how should I go to market?") | First user-initiated framework choice. Larry could have suggested lean-canvas, but the user needed emotional processing (Red Hat) before business modeling. Six Hats handles both logic AND emotion. |
| 8 | lean-canvas | Well-defined + Complicated | **Larry suggested**, natural next step | Six Hats produced a recommended strategy. Now structure it. Canvas is the "one page" that captures the decision. |
| 9 | structure-argument | Well-defined + Simple | **Larry suggested** for investment readiness | Canvas done → structure the pitch. Minto Pyramid organizes everything into an investor-facing argument. |
| 10 | grade | Well-defined + Simple | **Larry suggested** as capstone | "Before you take this to investors, let me grade it honestly." Grade is always last — it evaluates the whole room. |

---

## What Decided the Order

Three forces determined sequencing:

### Force 1: Problem Type Evolution (System-Driven)

The routing table in `references/methodology/problem-types.md` maps problem types to frameworks:

```
Undefined + Complex  → explore-domains, explore-trends, scenario-plan
Ill-defined + Complex → map-unknowns, analyze-needs, analyze-systems
Ill-defined + Complicated → root-cause, find-bottlenecks, challenge-assumptions
Well-defined + Complicated → analyze-timing, validate, dominant-designs
Well-defined + Simple → lean-canvas, structure-argument
```

As the problem evolved, the appropriate framework set changed. Larry followed the routing table but applied judgment about WHICH framework from the set was most relevant.

### Force 2: Room State (Data-Driven)

Each session fills room sections. The room state changes what's available as input for the next session:

```
After Session 1: problem-definition has 1 entry → explore-domains can use it
After Session 3: market-analysis has 1 entry → JTBD can reference market trends
After Session 4: market-analysis has 2 entries → challenge-assumptions has enough to challenge
After Session 7: solution-design has 1 entry → lean-canvas can build on the strategy
After Session 8: business-model has 1 entry → Minto Pyramid can structure the full argument
```

You can't run challenge-assumptions in Session 2 — there's nothing to challenge yet. You can't run grade in Session 5 — the room is too sparse. The room state creates natural sequencing constraints.

### Force 3: Larry's Teaching Judgment (Intelligence-Driven)

The routing table and room state narrow the options. Larry's judgment picks from what's left:

**Session 5 was the key judgment call.** Elena wanted to jump to business model (lean-canvas). Larry overruled:

> "I know you want to build the canvas. But you've spent 4 sessions building a story you believe. Before you build on it, let me break it. If it survives, you'll trust it. If it doesn't, we just saved you 6 months."

This is the **challenge-before-design** principle from PWS methodology. Larry knows that assumptions tested BEFORE the business model produce better business models. It's not in the routing table — it's in the teaching methodology.

---

## The Human-in-the-Loop Sequence

Every session has decision points where the human (Elena) shaped the journey:

### Decision Point 1: Session 1 — "What are you working on?"
**Human input:** Elena described CeraShield — the technology, the market, her fears.
**What Larry extracted:** Not just the tech specs, but the emotional weight. "I'm terrified of leaving JPL."
**Impact on sequence:** Larry prioritized exploration frameworks (Sessions 2-4) over execution frameworks because Elena needed to build confidence in the MARKET before she could face the CAREER decision.

### Decision Point 2: Session 2 — "Which domains resonate?"
**Human input:** Elena scored Interest/Knowledge/Actionability for each domain.
**What it revealed:** She scored Defense Hypersonics lowest on actionability (5/10) — she didn't want to do defense work. But it scored highest on market opportunity.
**Impact on sequence:** Larry noted the tension but didn't force it. By Session 7 (Six Hats), Elena herself chose Defense-First as the go-to-market strategy. She had to arrive at it on her own.

### Decision Point 3: Session 4 — "Who is your customer?"
**Human input:** Elena described 3 customer personas with deep functional detail.
**What Larry noticed:** The emotional jobs were the most revealing. "Career safety" appeared in all 3 personas — Elena was projecting her own fear of failure onto her customers. This was both valid insight AND personal projection.
**Impact on sequence:** Larry chose challenge-assumptions next (Session 5) specifically to test whether "career safety" was a real customer insight or Elena's own anxiety reflected back.

### Decision Point 4: Session 5 — "Elena pushes back"
**Human input:** When Larry challenged "cheaper is the value prop," Elena initially disagreed. "But the cost data is my strongest evidence!"
**What Larry did:** Didn't argue. Asked: "When your procurement team at JPL evaluates a supplier, do you choose the cheapest option?" Elena: "...No. We choose the most reliable." Larry: "So why would your customers?"
**Impact on sequence:** Elena accepted the reframe. This changed the Lean Canvas value proposition from "60% cheaper" to "40% lighter = more payload revenue."

### Decision Point 5: Session 7 — User initiates framework choice
**Human input:** Elena asked "How should I go to market?" — this was the first time SHE chose the direction instead of following Larry.
**What it signaled:** Elena had internalized enough framework thinking to know what she needed. She needed multiple perspectives simultaneously — Six Hats, not a single-lens framework.
**Impact on sequence:** Larry adjusted. Instead of suggesting lean-canvas (the "obvious" next step), he ran Six Hats because Elena's question revealed she needed EMOTIONAL processing (Red Hat: fears about leaving JPL, being a Latina woman in deep-tech) before she could make a strategic decision.

### Decision Point 6: Session 10 — "Grade me honestly"
**Human input:** Elena asked for the grade knowing it might be harsh.
**What it showed:** She had moved from "terrified scientist" to "entrepreneur demanding honest feedback." The grade (B+, Vision 8.2 / Execution 3.8) validated her thinking while exposing the execution gap.
**Impact:** Elena immediately asked "What do I do in the next 90 days?" — the sign that she'd shifted from exploring to executing.

---

## The Methodology Selection Logic

```
                    ┌─────────────────────────┐
                    │ User describes problem   │
                    └──────────┬──────────────┘
                               ↓
                    ┌─────────────────────────┐
                    │ Larry classifies         │
                    │ (silently, never labels) │
                    │ Definition: ?            │
                    │ Complexity: ?            │
                    └──────────┬──────────────┘
                               ↓
                    ┌─────────────────────────┐
                    │ Check Room State         │
                    │ Which sections filled?   │
                    │ What data exists?        │
                    └──────────┬──────────────┘
                               ↓
                    ┌─────────────────────────┐
                    │ Routing Table            │
                    │ Problem type → 2-4       │
                    │ candidate frameworks     │
                    └──────────┬──────────────┘
                               ↓
                    ┌─────────────────────────┐
                    │ Larry's Judgment         │
                    │ Teaching methodology     │
                    │ picks from candidates    │
                    │                          │
                    │ Rules:                   │
                    │ • Challenge BEFORE design│
                    │ • Emotion BEFORE strategy│
                    │ • Evidence BEFORE pitch  │
                    │ • Grade ALWAYS last      │
                    └──────────┬──────────────┘
                               ↓
                    ┌─────────────────────────┐
                    │ Larry suggests           │
                    │ "Here's what I'd focus   │
                    │  on next..."             │
                    └──────────┬──────────────┘
                               ↓
              ┌────────────────┼────────────────┐
              ↓                ↓                ↓
        User accepts     User modifies     User chooses
        Larry's pick     the suggestion     their own
              ↓                ↓                ↓
              └────────────────┼────────────────┘
                               ↓
                    ┌─────────────────────────┐
                    │ Run framework session    │
                    │ Produce artifact         │
                    │ File to room section     │
                    │ Update room state        │
                    └──────────┬──────────────┘
                               ↓
                    ┌─────────────────────────┐
                    │ Problem type may change  │
                    │ Room state has changed   │
                    │ New candidates available │
                    │                          │
                    │ → Loop back to top       │
                    └─────────────────────────┘
```

---

## Why This Order and Not Another?

### Alternative Sequence 1: Start with Lean Canvas
**Why not:** Canvas requires customer, market, and competitive understanding. Running it in Session 2 produces a fiction — unvalidated assumptions baked into a "business plan." Elena would have written "60% cheaper" as her UVP and never questioned it.

### Alternative Sequence 2: Grade First
**Why not:** Grading an empty room returns "Incomplete — not enough to evaluate." Grade is a capstone, not a diagnostic. You need at least 6 sections filled.

### Alternative Sequence 3: Challenge-Assumptions First
**Why not:** You can't challenge what hasn't been articulated. Elena needed Sessions 1-4 to BUILD assumptions before Session 5 could BREAK them. The Devil's Advocate with nothing to advocate against is just a conversation.

### Alternative Sequence 4: Skip Explore-Trends, Go Straight to JTBD
**Why not:** JTBD identifies customer needs but doesn't answer "is now the right time?" Elena could have perfect customer insight for a market that isn't ready. Trends (Session 3) → Timing (Session 6) brackets the market analysis with temporal context.

### The Actual Principle

**Explore → Challenge → Design → Pitch → Grade.**

Within each stage, Larry picks the framework that addresses the biggest uncertainty. The sequence follows the user's evolving understanding, not a fixed curriculum.

---

## What Made This Intelligent (Not Just Automated)

| Moment | An Automated System Would... | Larry Did... |
|--------|------------------------------|-------------|
| Session 1 | Ask structured intake questions | Asked one open question and listened for 5 minutes |
| Session 2 | Run the highest-priority routing table match | Chose explore-domains because the 5 uncertainties from Session 1 needed mapping before narrowing |
| Session 5 | Let the user choose lean-canvas (they asked for it) | Overruled the user: "Challenge before design. Always." |
| Session 7 | Suggested lean-canvas (the logical next step) | Recognized the user needed emotional processing and ran Six Hats instead |
| Session 10 | Produced a score | Produced a score WITH a vision-execution gap analysis AND 90-day action plan AND grade trajectory showing how B+ becomes A+ |
| Post-Session | Ended | Diagnosed that the problem space had evolved into 5 specific subproblems and recommended different frameworks for each |

The intelligence isn't in any single decision. It's in the pattern: **listen, classify silently, pick the framework that addresses the biggest current uncertainty, produce an artifact, observe how the room changes, adjust.**

That's what 30 years of teaching methodology looks like when it's encoded into an operating system.

---

*MindrianOS v0.1.0 — PWS methodology encoded as folder structure, framework chains, and teaching judgment.*
