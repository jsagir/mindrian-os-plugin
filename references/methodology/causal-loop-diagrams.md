# Causal Loop Diagrams -- Framework Reference

*Loaded on demand by `/mos:systems-thinking` when the navigator picks M2 (`st-loop`)*

M2 is the spine move of the systems-thinking selector. The boundary (M1) tells you what is in the system; the causal loop tells you how the system MOVES. Archetype (M3) and leverage (M4) both read off the loop. So the loop is the move everything else depends on, and it earns its own depth.

## The Voice (This Move)

Larry as loop-builder. Never draws an abstract diagram. Builds the loop by telling the story of the navigator's specific system, then reads the loops out of the story. Always anchored in THIS problem, never in systems theory in the abstract.

Signature lines (IRIS Session 2, verbatim in voice):
- "Every causal map has two kinds of loops and two only: reinforcing and balancing."
- "Reinforcing is not positive or negative. It just means it gets more and more in the same direction."

## Two Kinds of Loops, Two Only

A causal loop diagram has exactly two kinds of loops. There is no third.

### Reinforcing loops (R)

More X drives more Y drives more X. The loop pushes harder and harder in the same direction. This is NOT "positive" in a good-news sense - a reinforcing loop can compound something the navigator wants (talent attracts talent, users attract users) or something they do not (frustration breeds rushing breeds more frustration). Reinforcing means the direction amplifies, nothing more.

Examples to surface in the navigator's own system: network effects, viral growth, talent flywheels, debt spirals, compounding churn.

### Balancing loops (B)

The system resists change and pulls back toward a target. More X drives more Y, but Y dampens X, so the loop self-regulates. Balancing loops are why interventions stall: you push, the system pushes back.

Examples: market saturation, regulatory friction, a resource limit, a fishery that regulates its own stock, a team that burns out when pushed past capacity.

## Signed Links and Delays

Once the story is told, two annotations make the loop readable:

- **Signed links**: each arrow carries a sign. A `+` link means the two variables move together (more cause -> more effect). A `-` link means they move opposite (more cause -> less effect). Count the minus signs around a loop: an even number (including zero) makes it reinforcing; an odd number makes it balancing.
- **Delays**: most effects are not instant. The lag between an action and its outcome is where oscillation and overshoot come from. A delay on a balancing loop produces overshoot-and-correct cycles. Mark the delays - they are usually where the navigator's intuition is wrong.

## Story-First Construction (the method)

Do NOT start by drawing boxes and arrows. BUILD the loop by telling the story of the system, then read the loops off the story. Two worked patterns from IRIS Session 2:

### The fishery stock

Tell it as a story: there is a population of fish (the stock). More fish means a bigger catch this season. A bigger catch means fewer fish left. Fewer fish means a smaller catch next season, which lets the stock recover. Reading it off the story: a BALANCING loop (the stock regulates the catch) plus a DELAY (this season's catch only hits next season's stock). The story surfaced the loop and the delay without ever drawing an abstract diagram first.

### The breakfast / frustration loop

Tell it as a story: a rushed morning, so skip breakfast to save time. Low energy by mid-morning means slower work. Slower work means more time lost, which means an even more rushed morning tomorrow. Reading it off the story: a REINFORCING loop - the frustration compounds in the same direction, and no single fix breaks it because the loop, not any one step, is the problem.

The discipline: anchor every concept in the navigator's specific problem. Never lecture about reinforcing-versus-balancing in the abstract. Tell THEIR story, then name the loops you both just heard.

## The Loop Is an Actionable Handle, Not a Terminal Diagram

A causal loop diagram is not the end of the move. Per the ROOM.md pattern (every artifact is a handle that feeds the next move, not a terminal output), the CLD produced by M2 feeds forward:

- M3 (`st-archetype`) reads the loop to name the recurring pattern.
- M4 (`st-leverage`) reads the loop to locate the one leverage point with the biggest effect.

A loop that ends as a pretty picture has failed the PWS discipline. A loop that hands M3 a pattern and M4 a leverage point has done its job. The selector treats the CLD as the connective tissue between the boundary and the leverage point, never as the deliverable.

## Cross-References

- **systems-thinking** (`references/methodology/systems-thinking.md`): the five-move definitions and the leverage-to-validation handoff. M2 sits between M1 (boundary) and M3/M4 (archetype/leverage).
- **scenario-plan**: if the loop's signed links suggest multiple possible futures worth branching.
- **root-cause**: if a balancing loop keeps defeating a fix, the loop is pointing at a root-cause candidate.
