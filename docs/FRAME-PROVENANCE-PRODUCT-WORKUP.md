# MindrianOS: frame provenance as the explanation for better thinking

Status: product and architecture workup, not an implementation plan.
Date: 2026-09-23.

## The position

Mindrian can honestly say that it helps a person do better work and think better. That claim does not need to be presented as a clinical proof claim. The useful product question is: **what mechanism could explain the improvement, and can the mechanism be observed?**

The proposed mechanism is that Mindrian makes changes in the governing question visible. In a chat, a changed question is cheap and disappears into the conversation. The new answer feels like progress. In a room, a change in the governing thought can leave a durable relationship between the old frame, the new frame, the work produced under each, and the decision the work serves.

This gives Mindrian a sharper position without denying the user's experience:

> Mindrian helps you think better by making your thinking visible, structured, and checkable. It shows where the current work is standing, what it rests on, and when the question has moved.

The claim is narrower than “the system thinks better for you” and stronger than a generic productivity claim. It explains why a patient user may prefer Mindrian to a general chat session even when both can produce good prose.

## The two mechanisms

The paper's boundary mechanism asks what is missing from the record: evidence, observation, tacit expertise, or a decision that only a person can make. Mindrian already has useful machinery for local artifacts, claims, assumptions, provenance edges, gates, and graph history.

The frame mechanism asks a different question: what question are the facts being asked to answer, where did that question come from, and did it change? The current plugin has governing thoughts, hashes, freshness checks, and framework routing, but it does not yet preserve frame origin or distinguish a refinement from a relocation.

The two mechanisms should remain separate. A frame is not a claim, and a changed frame is not evidence that the new frame is better. The system should expose the change and ask for the human's account of it.

## What the current code actually provides

Verified in the current checkout:

- `lib/core/brain-derivation.cjs` computes a normalized `governing_thought_hash`.
- `lib/core/brain-derivation-queue.cjs` compares previous and new governing-thought hashes and queues derivation work when they differ.
- `lib/core/brain-md-staleness.cjs` reports `governing_thought_changed` as a stale reason.
- `lib/core/navigation-engine-offer.cjs` consumes governing-thought freshness when deciding whether to offer a next move.
- `lib/core/reconcile-memory-runner.cjs` carries a governing-thought hash as a generic handle across the local derivation boundary.

Not verified in the current checkout:

- a persisted `Frame` node type with frame-origin fields;
- a consumer that turns governing-thought hash changes into a user-facing reframe event;
- a `REFINES` edge implementation for governing frames;
- a pre-answer gate that asks what the previous question got wrong;
- a room-level portrait of verification rungs.

The work should therefore build on the existing hash and stale machinery, while treating the claim that a Frame node already ships as requiring source-level confirmation from the exact checkout and commit being reviewed.

## The smallest useful model

Do not begin with a large theory object or a new database table. Start with one local frame record and a small set of typed relationships.

```text
Frame
  id
  room_id
  governing_thought_hash
  origin: chosen | tasking | prompt | inherited | system
  purpose: decision | exploration | explanation | review | execution
  decision_node_id: optional local handle
  predecessor_frame_id: optional
  status: active | superseded | abandoned | unresolved
  created_at
  changed_at
```

The prose governing thought remains in the room artifact or MINTO source. The graph carries the stable hash and generic handles. This respects the existing locality rule and prevents user prose from entering Brain requests.

Edges:

- `GOVERNS`: frame to the claims, artifacts, chain, or decision it organizes.
- `REFINES`: new frame to predecessor when the person states what the prior question got wrong or left out.
- `RELOCATES`: new frame to predecessor when the old question is abandoned without a stated correction.
- `INHERITS_FRAME`: new session or task to the prior frame when its governing question is carried forward.

These names are design proposals. They must pass the existing graph edge allowlist and navigation chokepoint before implementation.

## The interaction rule

The trigger is an observed governing-thought hash change. Before showing the new answer or allowing the new work to become the active recommendation, Mindrian presents a small decision gate:

```text
The governing question changed.

Previous: Which camera solves the delay?
Current:  Which camera works with sunglasses?

What did the previous question get wrong?

[Refinement] [New question] [Continue without explanation]
```

If the person chooses `Refinement`, capture the explanation and create `REFINES`. If the person chooses `New question`, create `RELOCATES` and leave the earlier work visible. If they continue without explanation, keep the frame marked `unresolved`; never invent the rationale after the answer appears.

The timing matters. Asking after the new answer is displayed invites a post-hoc explanation. The product's value is precisely that it makes the movement visible before the new answer absorbs attention.

## The room portrait

The rung should become a room-level portrait only after the underlying verification record is honest. A useful first portrait is:

```text
Claims in room: 340
Verified against external evidence: 41 (12%)
Model-derived or internally repeated: 207 (61%)
Unchecked: 92 (27%)
Trend over 30 days: verification yield +3 points
Open frames: 4
Unresolved relocations: 2
```

The portrait must distinguish at least:

- source provenance, meaning where the claim came from;
- verification action, meaning what someone actually did to check it;
- verification target, meaning the source, observation, person, experiment, or decision record checked;
- verifier and time;
- result, scope, and unresolved disagreement.

Human approval alone is not verification. A gate can confirm that a person accepted a decision. It cannot retroactively claim that the supporting source was read or that the claim was tested.

The portrait should be descriptive, not punitive. It should show movement and open choices, not grade the user. A room with 61% rung-2 material may be exactly right during exploration; the product should ask whether that distribution fits the decision ahead.

## Why this is a real distinction from patient use of chat

Patience can reproduce careful prompting, comparison, and manual notes. It cannot reliably record a reframe that was not perceived as a reframe. That is the narrowest defensible product distinction.

The claim should not be “a person cannot do any of this manually.” The claim should be: **Mindrian continuously preserves the state changes that ordinary conversation causes people to forget, then makes those changes available for review.**

That is also why the user's Claude Pro comparison matters. It is informed testimony about a repeated experience, not a controlled efficacy study. Mindrian's job is to explain the experience with a mechanism that can be inspected and eventually measured.

## Minimum acceptance tests

Before calling this feature real, test the following with a disposable room:

1. Two different governing thoughts produce two frame records with distinct hashes.
2. A same-hash write does not create a false reframe.
3. A changed hash pauses before the new answer is presented.
4. `REFINES` requires a human-supplied explanation recorded before the new answer.
5. `RELOCATES` leaves the old frame and its artifacts reachable.
6. An unresolved change stays visibly unresolved and does not become a fabricated refinement.
7. A room portrait counts only typed verification records, not source labels or approval nodes.
8. A reopened process reconstructs the same frame history from local storage.
9. No frame prose, claim text, artifact body, or personal identifier crosses the Brain boundary.
10. CLI, Desktop MCP, and Cowork/shared-room paths use the same frame writer and renderer.

The key falsification test is not whether users like the feature. It is whether an independent reviewer can reconstruct the sequence of frames and tell which work belonged to which question without relying on the final answer.

## Build order

1. Confirm the exact existing governing-thought/hash call graph and graph edge vocabulary.
2. Add a local frame record and origin enum without changing existing claim semantics.
3. Consume hash changes at one governed write point and render the pre-answer reframe gate.
4. Add `REFINES` and `RELOCATES` only after the human response is persisted.
5. Add verification-event structure and the room portrait after its counts can be trusted.
6. Test the explanation against real work in a disposable room before changing positioning language.

The product becomes smaller and more defensible when its benefit is explained as observable state, while its broader benefit remains honest: users may in fact think better with Mindrian. Frame provenance explains one way that can happen. It does not need to replace the user's account in order to make that account credible.
