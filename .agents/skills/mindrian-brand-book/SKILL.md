---
name: mindrian-brand-book
description: Apply the Mindrian brand system to a declared project, website, service or content job. Resolve the project's relevant nested guidance, reuse canonical assets and review the result.
---

# Work with the Mindrian brand

Start from the consumer project, not the design-system package directory.

Use `npx --no-install mos-brand` when the local executable is not on PATH. `--help`, `-h` and `--version` work before project configuration. `self-test` checks a shipped synthetic consumer without changing the real project.

1. Run `mos-brand doctor`. If this is a new consumer, run `mos-brand init`, then ask for the missing identity, what/how/why and JTBD in `.mindrian/intake.json`. Do not invent answers. Run `mos-brand configure --intake .mindrian/intake.json`.
2. Read `.mindrian/WORKFLOW.md`. Preview `mos-brand adopt`, then apply the workflow reference when authorized. A reference installs instructions; it does not prove the team follows them.
3. Run `mos-brand context`. Read the returned shared rules and relevant segment contracts. Load canonical artifacts only for the current job. Preserve the nested relationships and the original source home. Never replace the brand book with recalled memory.
For homepage or long-form project scrollytelling, read the canonical `experience/scroll` SKILL.md returned by context before choosing effects. Follow its procedure and supersession rules, including the React hybrid flipbook ruling when architecture transforms. Use aligned frames and editable SVG under one scroll timeline; a new frame sequence must be authored and reviewed separately. A flipbook means many closely spaced successive images, not a few dissolves or a single image with moving overlays. Preserve the selected generated artwork and its visual quality. Declare `homepage` for homepage work and reconfigure if the scope changes. The React homepage is an implementation reference, not automatic production approval.

Use `mos-brand catalog --kind font` or `mos-brand catalog --query logo` to find exact selected assets. Read their owning guidance for role, license and status before using `asset` to copy. Never infer approval from a file appearing in the catalog.

For generated artwork, read the selected `teams/image-creation/generation/prompts` SKILL.md and GUIDE.md. For blog art, begin with `mos-brand image brief --article posts/article.md`, read the selected editorial STYLE.md and develop an original composition from the article. Use style guidance, not fixed rooms, stairs or the triangle. The editorial brief does not require the full quest story. For project explainers, begin with `mos-brand image brief`; ask its missing meaning questions before choosing a treatment. Complete the explanatory answers, including uncertainty, a conditional future and the next move. Then use `mos-brand image templates` for discovery and `mos-brand image prompt --brief brief.json` to compile. Read the resulting explanationPlan before generating. Pass `--recent previous-prompt.json` for collection variation or sequence continuity; never diversify frames within a flipbook. Save the compiled record with `--out`, then generate and review the actual image separately.

Critical: do not hand off substantial written content as a wall of text. Provide a meaningful scan path with restrained rich text and useful visual explanation, and record the actual editorial review.

For written content, apply the resolved `writing/text-augmentation` procedure: outline first, assign text roles, preserve evidence in the scan path, adapt Hebrew direction and review accessible reading. Its numeric defaults are brand starting points, not research-proven conversion claims.

Run `mos-brand checklist` for the selected contracts and human checks. Run `mos-brand review --file path/to/draft.md` on a Markdown, text or HTML draft. Exit 1 reports a blocker or command failure; exit 2 requires human review even when no heuristic signal was found. The scan does not inspect React components, rendered CSS or the truth of claims. Do not use its result as brand approval.

4. Use `mos-brand run start` for reviewable production. Each numbered stage has a contract and editable `output/`. Ask the reviewer to examine each output before recording `run approve`. An approval record is an attestation, not verified identity. Never invent a review or use the agent's name to impersonate one.
5. Explain the actual checks at handoff. Report draft, proposed, conflicting or unspecified material and pending UI/UX rules accurately. After updating the installed package, preview `mos-brand refresh`, then use `mos-brand refresh --apply` to refresh unedited managed guidance. Edited files remain protected; copied assets and old runs are not rewritten. Run doctor again. Reconfigure after scope changes.
6. Return useful learning with `mos-brand memory remember --text "..."` if memory is configured. Include the source and uncertainty. Recalled learning can suggest a change; only canonical source changes can change the rules.

If the executable is not on PATH, use `npx --no-install mos-brand` from the consumer project. The CLI provides context and records workflow evidence. It does not create polished content by itself or guarantee brand compliance.
