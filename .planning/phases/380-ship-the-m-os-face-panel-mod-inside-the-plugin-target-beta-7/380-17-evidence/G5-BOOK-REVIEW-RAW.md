# Raw output of the book review on the G5 strings

- Pinned ref: e947a5d; the CLI ran from a git archive export of it (read only); the live checkout HEAD is 9f4ee34 before and 9f4ee34 after.
- BOOK_STATUS_BEFORE_COUNT=2
- BOOK_STATUS_AFTER_COUNT=2
- Book unchanged: yes
- Scratch consumer: SCRATCH/consumer (a folder under the session scratch folder; removed after the run)

### Strings reviewed

```
Context gauge: waiting for the first reply
Context: waiting for the first reply
Context 62% - watch
```

## init --project (exit 0)

```
{
  "status": "intake-template-created",
  "file": "SCRATCH/consumer/.mindrian/intake.json",
  "next": "Complete identity, what/how/why and JTBD, then mos-brand configure --intake .mindrian/intake.json"
}
```

## configure --intake --project (exit 0)

```
{
  "status": "configured",
  "version": "2.43.0",
  "segments": 47,
  "workflow": ".mindrian/WORKFLOW.md",
  "applicationPlan": ".mindrian/APPLICATION-PLAN.md",
  "next": "Read the workflow and run mos-brand adopt --apply to add its reference to the declared project workflow."
}
```

## adopt --apply --project (exit 0)

```
{
  "status": "workflow-reference-installed",
  "file": "docs/WORKFLOW.md",
  "humanReview": "not-verified"
}
```

## review --file docs/g5.txt (exit 2)

```
{
  "evidence": {
    "status": "not-provided",
    "truthVerification": "not-performed",
    "next": "Optionally supply --evidence with the declared-claim ledger; read the editorial-integrity contract."
  },
  "status": "REVIEW-REQUIRED",
  "file": "docs/g5.txt",
  "sha256": "970cc9d57038277e9c5dc21d174b1b08ad32d42e6688cc5f4aaffef0307557f6",
  "findings": [],
  "humanReview": {
    "status": "not-performed",
    "required": [
      "Inspect hierarchy, emphasis and visual aids in the rendered result; framing text in a box is not a visual explanation.",
      "Keep evidence, uncertainty, qualifications and next actions visible while scanning.",
      "Verify exact fonts, identity assets, bilingual reading and relevant motion against selected contracts."
    ],
    "source": "references/brand-rules.md"
  },
  "limits": "Read-only heuristic prose scan. Code examples are excluded. HTML parsing is approximate; rendered text, CSS, JSX, links, truth and accessibility need separate review. No automatic rewriting or brand approval."
}
```
