# Document Generation Reference

*Professional document structuring for MindrianOS — De Stijl formatted exports from the Data Room.*

---

## Architecture

```
Room Markdown Artifacts (YAML frontmatter)
    ↓
markdown2 (parse to HTML + extract metadata)
    ↓
Jinja2 (inject into document-type template)
    ↓
De Stijl CSS stylesheet (shared across all templates)
    ↓
WeasyPrint (render to PDF)
    ↓
PyMuPDF (optional: TOC bookmarks, merge sections, watermark)
    ↓
room/exports/{document-type}.pdf
```

**Zero additional dependencies.** All tools already installed:
- WeasyPrint 67.0 (HTML+CSS → PDF, CSS3 paged media)
- markdown2 2.5.4 (Markdown → HTML with frontmatter)
- Jinja2 3.1.6 (template engine)
- PyMuPDF 1.26.6 (PDF manipulation, TOC, merge)
- PyYAML 6.0.3 (frontmatter parsing)

---

## Document Types

| Document | Use Case | Template Style |
|----------|----------|---------------|
| **Investment Thesis** | Structured narrative for investors — problem, market, solution, financials | Multi-page portrait, section breaks, De Stijl accent bars |
| **Executive Summary** | 1-2 page dense overview of entire Data Room | Two-column layout, tight margins, summary boxes |
| **Due Diligence Report** | Comprehensive multi-section with TOC | Running headers, page numbers, section numbering |
| **Research Paper** | Academic-style with citations and methodology | Two-column body, footnotes, bibliography |
| **PWS Profile** | Professional profile/resume for cohort members | Single-page grid layout, accent bars, skill visualization |
| **Pitch Deck** | Landscape slides for presentation | Landscape @page, large headings, one-concept-per-page |
| **Venture Brief** | Quick 1-pager for stakeholder review | Constrained single page, key highlights only |

---

## De Stijl CSS for PDF

```css
@page {
  size: A4;
  margin: 24mm 20mm;
  background: #0D0D0D;

  @top-center {
    content: string(doctitle);
    font-family: 'Bebas Neue', sans-serif;
    color: #A09A90;
    font-size: 10px;
  }

  @bottom-right {
    content: counter(page) ' / ' counter(pages);
    font-family: 'Inter', sans-serif;
    color: #A09A90;
    font-size: 10px;
  }
}

:root {
  --ds-bg: #0D0D0D;
  --ds-surface: #1A1A1A;
  --ds-elevated: #2A2A2A;
  --ds-cream: #F5F0E8;
  --ds-muted: #A09A90;
  --ds-red: #A63D2F;
  --ds-blue: #1E3A6E;
  --ds-yellow: #C8A43C;
  --ds-green: #2D6B4A;
  --ds-sienna: #B5602A;
  --ds-gray: #5C5A56;
  --ds-amethyst: #6B4E8B;
  --ds-teal: #2A6B5E;
}

body {
  font-family: 'Inter', sans-serif;
  color: var(--ds-cream);
  background: var(--ds-bg);
  line-height: 1.6;
}

h1, h2, h3 {
  font-family: 'Bebas Neue', sans-serif;
  letter-spacing: 0.05em;
}

* { border-radius: 0; }
```

---

## Room Section → Document Section Mapping

| Room Section | Document Section | Accent Color |
|-------------|-----------------|-------------|
| problem-definition | Problem Statement / Opportunity | Red #A63D2F |
| market-analysis | Market Analysis / TAM-SAM-SOM | Yellow #C8A43C |
| solution-design | Solution Architecture / Technical Approach | Gray #5C5A56 |
| business-model | Business Model / Revenue Strategy | Green #2D6B4A |
| competitive-analysis | Competitive Landscape / Moat | Sienna #B5602A |
| team-execution | Team / Execution Plan | Blue #1E3A6E |
| legal-ip | Legal / IP Strategy | Amethyst #6B4E8B |
| financial-model | Financial Projections / Investment Ask | Teal #2A6B5E |

---

## Implementation Plan

### Plugin Files Needed

```
templates/
  destijl-base.css          # Shared De Stijl stylesheet for PDF
  investment-thesis.html    # Jinja2 template
  executive-summary.html    # Jinja2 template
  due-diligence.html        # Jinja2 template
  research-paper.html       # Jinja2 template
  profile.html              # Jinja2 template (PWS profiles)
  pitch-deck.html           # Jinja2 template (landscape)
  venture-brief.html        # Jinja2 template (1-page)
assets/
  fonts/BebasNeue-Regular.ttf  # Bundled font (~50KB)
scripts/
  render-pdf                # Orchestrator: reads room, selects template, renders PDF
commands/
  export.md                 # /mindrian-os:export thesis|summary|report|profile|deck|brief
```

### Command UX

```
/mindrian-os:export thesis      → Investment thesis PDF from full room
/mindrian-os:export summary     → 1-2 page executive summary
/mindrian-os:export report      → Due diligence report with TOC
/mindrian-os:export profile     → PWS profile for a cohort member
/mindrian-os:export deck        → Landscape pitch deck
/mindrian-os:export brief       → 1-page venture brief
```

### Tri-Polar Surface Behavior

| Surface | Behavior |
|---------|----------|
| **CLI** | `render-pdf` script generates PDF, opens with default viewer |
| **Desktop** | Larry offers "Want me to export this as a PDF?" after key milestones |
| **Cowork** | Export to shared `00_Context/exports/` directory, visible to all team members |

---

## LaTeX Skill Pattern Reference

The "LaTeX Handouts" Claude Code skill (mcpmarket.com) demonstrates the pattern:
- Skill reads source content (slides/markdown)
- Expands bullets into research-backed prose
- Generates structured professional document
- Outputs as standalone file

MindrianOS follows the same pattern but uses HTML→PDF (WeasyPrint) instead of LaTeX→PDF,
keeping zero dependencies while achieving the same professional output quality.

---

## Font Bundling Note

Bebas Neue is a free Google Font (SIL Open Font License). Bundle the .ttf in the plugin's
assets/ directory (~50KB). WeasyPrint loads it via @font-face in the CSS template.
No system font installation required.
