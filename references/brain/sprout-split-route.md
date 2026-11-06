# Brain Calls: Sprouts, Not Bodies (the split route)

Internal rule for any model that composes a Brain call. Nothing here is said to the person.

## The rule

A Brain call carries sprouts and never a body. A sprout is a framework name, a problem type or a few keywords, at most 12 words, with no names, numbers, places, quotes or room terms. A full body of text never leaves the room. Credentials, emails, phone-like and ID-like strings and room terms never leave either.

## When a long text or a private claim needs the Brain

1. Break the text into claims, the way the meeting filing does. Type each claim as `fact`, `causal`, `heuristic`, `anomaly_cue`, `mental_model` or `assumption`. A hypothesis is filed as an `assumption`.
2. Keep the room claims in the room. File each one as a proposed claim with `claim_write`.
3. Pick the generic sprouts the Brain needs: a framework name, a problem type, or a few keywords.
4. Call the Brain with the sprouts only. The route is `sprout_call`: ordinary `brain_ask` and `brain_search` calls, one call per sprout set.
5. Never copy a run of four words from a claim into a sprout. A sprout that shares a run of four or more words with a claim is rejected, and then nothing is filed and nothing is sent.
6. Build the answer here, from the Brain reply and the local claims.

## When a call comes back refused with `sprouts_required`

The refusal carries a 5 step split guide and says that nothing was sent. Do exactly the steps above, then call again with the sprouts only. Never retry with the same text. Never paste claims into a Brain call.

## Where the code lives

`lib/core/part8-split-route.cjs` holds the refusal text, the sprout check, the local claim filer and the local assembler. It reuses the claim types and the claim writer of the meeting filing. See `references/brain/query-patterns.md` (How to Use) for the short form.
