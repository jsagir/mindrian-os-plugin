# Phase 173 - External best-implementation research (Tavily, 2026-06-23)

Web research on the best implementation of each decision area. Sourced via Tavily; cited inline. Feeds the planner alongside `173-CONTEXT.md` + `173-SPEC.md`.

## 1. JTBD selector - how to phrase jobs + surface them (R1, R6, R7)

- **JTBD statement formula** (user-POV, solution-agnostic): *"When [circumstance], I want to [job], so I can [outcome] without [pain]."* Write jobs in the USER's voice, as outcomes, not features - "the need behind the need." So selector labels stay outcome-phrased ("give me a link I can send"), never command names. [userinterviews.com; productplan.com]
- **B2B validation:** "users literally have jobs; make their job easier / make them a hero." Direct support for a job-based selector over a command list. [reddit/ProductManagement]
- **Command-palette UX patterns** (the selector is one): (a) surface frequently-used + recently-used FIRST -> our persona-default lane (role_blend) and recency should rank the opening lane; (b) keep it simple, GROUP by category -> our 4 intent lanes; (c) make it DISCOVERABLE, never hidden behind a secret shortcut -> the trigger suggestion is the discoverability surface. [medium design-bootcamp Command Palette UX]
- **Implementation takeaway:** rank the default lane by `role_blend` + recent use; phrase every job as a JTBD outcome; expose the "something else" free-text option (navigator standing preference) so the taxonomy never traps the user.

## 2. The "show my work" trigger - context over keyword (R4, D-03)

- **Move beyond brittle keyword matching.** Modern intent detection = input -> **context enrichment** (prior turns + state signals) -> classification -> **confidence scoring + thresholding** -> **fallback logic**. Keyword is the weak tier. [chatnexus.io; bluetweak.com; decagon.ai]
  - Maps cleanly to our spine: enrich via `navigation.cjs` room-state signals, score, threshold at the canon 0.70 gate, fall back. Keyword = fallback tier (matches CIRS R3: context is the basis, keyword the fallback).
- **Taxonomy is a design decision:** two-level hierarchy (category -> sub-intents). Ours is tiny - ONE intent ("show/share/present my work") firing `context_block`. Keep it minimal; do not over-class. [decagon.ai]
- **Start modest:** introduce simple prompt patterns (ghost text, a few suggestions), monitor flow before adding complexity. [raw.studio] -> Direct support for **D-03 (suggestion at the gate, not auto-open)** over an aggressive auto-fire.

## 3. Deck-design ruleset (seeds Phase 175 / R14)

- **Brand consistency is table stakes:** company colors, fonts, logos on EVERY slide; "Brand Kits" enforce fonts/logos/palette automatically (Beautiful.ai applies brand standards on the fly). -> validates the **default MindrianOS Design System auto-binding** + logo -> mindrian-os.com. [canva.com; beautiful.ai via hebbia]
- **In-line source citation is a real differentiator:** Hebbia ships "Iterative Source Decomposition (ISD) for **in-line citations**" as a headline enterprise feature. -> validates the **mandatory source-hyperlink rule (R14)** as a genuine value lever, not bureaucracy. [hebbia.com]
- **AI-generated-image provenance (concrete rule):** cite the image source in a slide footer at a CONSISTENT location (bottom-right), 8-10pt, tool name + year (e.g. "AI: Adobe Firefly, 2025"). -> the image-generation clause of R14 must stamp AI-image provenance footers. [PMC12594065]
- **Visual storytelling > text:** infographics, flow diagrams, visual metaphors make technical ideas intuitive (Dropbox used metaphors; cybersecurity/AI case studies replaced dense bullets with illustration). -> the SVG/diagram clause of R14; one main idea per slide. [mideahub; canva]
- **Storytelling over facts; narrative arc** (problem -> solution -> opportunity -> team; context/conflict/character/closure). -> validates HEART + Feynman as the two narrative spines. [qubit.capital; vocal.media]

## 4. Feynman + HEART as the two deck styles (seeds Phase 175 / R8-R10)

- **Feynman = a 4-step pipeline** (pick topic -> teach as if to a child, no jargon -> isolate gaps -> simplify/refine into a logical narrative, test, repeat). Confirms the Feynman STYLE is a deterministic, repeatable pipeline (matches MOSDeckEngine's 6-stage), not a vibe. [kodeskills; engineeringmanagementinstitute]
- **Narrative-arc decks** (Airbnb founder-hardship, Dropbox metaphor, Tesla vision) map to HEART (Hypothesis / Enormous stakes / Alternatives inadequate / Radically different / Team). HEART = the persuasion spine; Feynman = the comprehension spine; mesh = pick per deck type. [qubit.capital]

## Net implications for planning
- Selector: rank opening lane by role_blend + recency; JTBD-outcome labels; always-"something else"; the trigger suggestion IS the discoverability surface.
- Trigger: context-enriched + confidence-thresholded at 0.70, keyword as fallback, ONE intent -> `context_block`, suggestion-at-gate (not auto-open).
- Phase 175 ruleset: auto-bind brand (Brand-Kit model), in-line source hyperlinks as a value feature, AI-image provenance footers, visual-metaphor/diagram-first, one-idea-per-slide; Feynman (comprehension) + HEART (persuasion) + mesh as styles.
