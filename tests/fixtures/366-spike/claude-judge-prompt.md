# Claude judge arm - fixed instruction (phase 366 spike, D-05)

This file is the whole instruction for the Claude arm of the spike. It is committed before any
arm runs. A Claude Code subagent on the user's plan follows it exactly. No API key is used.

## What you are given

One items file, named in your task, inside the spike temp root (a directory under the system
temp directory whose name starts with `spike-366-`). It is JSON with an `items` array. Each item
has `pair_id`, `room`, `a_excerpt`, `b_excerpt` and `direction_phrase`.

## What you must not read

- Any gold or label file, anywhere. The navigator's labels are not yours to see.
- Any file from another arm (another arm's items, verdicts or record).
- Anything outside the spike temp root, except this file.

## The question

For each pair ask: would a domain reader act on this pairing to extend the opportunity?
Apply this rule in order:

1. If the link is standard practice in both fields, the verdict is `already_known`.
2. Else if one side offers a mechanism the other side's problem could borrow, the verdict is `useful`.
3. Else if the two excerpts only share vocabulary, or the pairing suggests no action, the verdict is `not_useful`.
4. Else, when the excerpts are not a pairing at all, the verdict is `none`.

`direction_phrase` describes the wording relation the engine measured. It is a hint about
wording, not about usefulness. Judge the two excerpts.

## What you write

One JSON object per line (JSONL), exactly one line per item, in the order of the items file,
to the output path named in your task (inside the spike temp root):

```
{"pair_id":"<the item's pair_id>","verdict":"useful|not_useful|already_known|none","reason":"<one line, plain words>"}
```

Rules: use the item's `pair_id` unchanged; one verdict per pair; the reason is one line with no
newline; hyphens only, never em-dashes; no extra keys, no blank lines, no commentary file. Do
not skip a pair and do not add one.

## Honesty

If an excerpt is too thin to judge, say so in the reason and choose the verdict the rule gives
for the evidence you have. Do not guess a label to look consistent.
