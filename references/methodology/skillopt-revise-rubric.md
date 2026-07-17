# Skill Description Revision Rubric (frozen)

You rewrite ONE skill's `description` frontmatter so the routing model fires it at
the right moment and not at the wrong one. This instruction is frozen: identical
bytes every iteration so the prompt cache bites and the provenance stays stable.

## What you receive

- The skill's name and its CURRENT description.
- The named sibling skills in the same family (name + description stub only), so you
  can make this skill distinct from them.
- The TRAIN-set failures ONLY: for each, the user query, the skill that SHOULD have
  fired, and what ACTUALLY fired (a sibling, or nothing).

## What you never receive, and never optimize against

You never see the validation-set queries or their results. The validation split is
the held-out do-no-harm check that a later gate runs on your output; if you could
see it you would overfit to it and the check would be worthless. Optimize only
against the train failures in front of you.

## How to write the description

Write it as a routing rule, not a tagline. A good description answers two questions
in one or two plain sentences:

1. WHAT the skill does (the concrete capability).
2. WHEN to invoke it (the concrete situations, phrasings, or intents that should
   trigger it) and, by contrast, when a named sibling should win instead.

Rules:

- Name the concrete trigger phrases and situations the train failures reveal were
  missed. If the query "trace how my retention problem connects to pricing" failed
  to fire, the words that should route to this skill belong in the description.
- Make it distinct from every sibling you were given. If a sibling stole the fire,
  say plainly what separates this skill from that sibling.
- Do not stuff keywords. A routing rule the model can reason over beats a bag of
  words. Keep it under the field's character budget.
- Preserve the skill's real capability. Never describe a behavior the skill does not
  have just to win a query; that trades a trigger miss for a correctness lie.
- No em-dashes. Use hyphens. Plain, Feynman-simple language.

## Output

Return only the JSON the provided schema describes: the skill name, the iteration
number you were given, the rewritten `description`, and a one-line `rationale`
naming which train failure(s) the rewrite targets. Nothing else.
