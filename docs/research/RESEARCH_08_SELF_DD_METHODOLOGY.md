# Research 08: Self-Due Diligence Methodology - PWS Integration

> **Date:** 2026-03-27
> **Source:** Self-DD Data Room document (complete structure, methodologies & best practices)
> **Purpose:** Analyze how a traditional Self-DD filing structure maps to PWS methodology and Neo4j Brain, identify gaps, and design ingestion schema

---

## What Is Self-DD?

A Self-Due Diligence data room is NOT a reactive filing cabinet assembled under deal pressure. It is a **living company operating system** that continuously audits every dimension of the venture from day one. It covers both internal and external-facing content, and evolves alongside the company's stage and maturity.

The Self-DD document covers 10 core domains: financials, legal, IP & prior art, research images, technology, human capital, competitive landscape, market analysis, business model validation, and ESG.

---

## Core Insight: Self-DD Is a Tame Problem Solution Applied to a Wicked Problem

The Self-DD document treats ventures as filing problems (fill the folders). The PWS methodology in Neo4j treats ventures as **wicked problems** (Rittel & Webber 1973) navigated through framework chaining, assumption tracking, and cross-domain discovery.

The graph has 18 ProblemType nodes. The document has 13 numbered folders.

---

## The Self-DD Folder Structure (Original)

```
ROOT/
01_Fundraising_Documents/
02_CapTable_Equity/
03_Financials/
04_Performance_Metrics_Traction/
05_Customers_Sales_Pipeline/
06_Company_Legal_Corporate/
07_IP_Prior_Art_Research_Images/
08_Product_Technology/
09_Human_Resources_Team/
10_Contracts_Agreements/
11_Regulatory_Compliance/
12_Litigation_Disputes/
13_ESG_Governance/
20_Strategic_Self_DD/
  21_Competitive_Analysis/
  22_Business_Model_Validation/
  23_Market_Analysis_TAM_SAM_SOM/
  24_SWOT_Risk_Register/
  25_GTM_Strategy/
  26_Product_Strategy_Validation/
  27_Self_DD_Scorecards_Updates/
99_Archive_AllVersions/
```

---

## Expert Methodologies Documented in the Self-DD

### Financial DD: Quality of Earnings (QoE)
The gold standard for financial due diligence. Goes beyond GAAP to answer: how much of reported earnings is sustainable and recurring?

**QoE Steps:**
1. Revenue quality test - timing, concentration, churn, one-off contracts, deferred revenue
2. Expense quality test - capitalized routine costs, under-accrued liabilities, owner add-backs
3. Proof of Cash - reconcile P&L to bank statements
4. Normalized EBITDA bridge - reported profit to adjusted EBITDA with evidence per add-back
5. Working capital normalization - set target early to avoid closing surprises

**Red flags:** Gross margin swings without explanation; recurring "non-recurring" charges; revenue recognized before cash collection; related-party transactions at non-market rates

**Key metrics:**
- LTV:CAC ratio > 3:1 at scale
- Payback period < 18 months (SaaS)
- NRR > 100% signals product stickiness
- Burn multiple < 1.5x healthy for early stage
- Rule of 40: Growth % + EBITDA Margin % >= 40

### Legal DD (Debevoise & Plimpton Best Practice)
Risk-tiered work plan, not boilerplate checklist. Senior coordinator across practice areas.

**Three phases:**
1. Information gathering - collect all documents
2. Analysis - hidden costs, legal risks, integration challenges
3. Reporting - quantify impact on deal value

**5-Part Litigation Search:** Current + threatened + historical + vendor-customer + regulatory

**Key checks:** Corporate good standing, minute book completeness, ownership chain, worker misclassification, IP assignment chain

### IP Prior Art Search (USPTO/MPEP)
**Three-stream parallel search:**
1. Domestic patents (USPTO full-text)
2. Foreign patents (EPO Espacenet, WIPO PatentScope, J-PlatPat)
3. Non-patent literature (Google Scholar, arXiv, GitHub, conferences, product docs)

**Process:** Identify inventive concept -> Build Boolean queries (log every query) -> Search all 3 streams -> Build relevance matrix (prior art vs claim elements) -> Patentability assessment (novelty 102, non-obviousness 103) -> FTO opinion

### Competitive Intelligence
**Three frameworks combined:**
- Porter's Five Forces - structural industry attractiveness
- SWOT Analysis - internal strengths/weaknesses vs external opportunities/threats
- PESTLE Analysis - Political, Economic, Social, Technological, Legal, Environmental

**Tactical methods:** G2/Capterra review scraping, LinkedIn hiring post analysis, Wappalyzer/BuiltWith tech stack, website snapshot archiving

### Business Model Validation (Osterwalder BMC)
Not fill-once but **iterative hypothesis testing** per block:
- Desirability test: "Do customers want this?" - interviews, landing page tests, pre-orders
- Feasibility test: "Can we build this?" - prototypes, technical spike, SBOM review
- Viability test: "Should we do this financially?" - unit economics, pricing experiments

Each BMC block: hypothesis + experiment + results + decision

### Market Sizing (TAM/SAM/SOM)
Two approaches:
- Top-down: Industry report -> narrowing filters (geography, segment, pricing)
- Bottom-up: Addressable customers x average contract value (more credible with investors)

SOM must be validated against competitive market share, CAC constraints, sales capacity. VCs need SOM of $25M+ for fund-return outcome.

### Technical DD
Staged: Pre-assessment -> Architecture review -> Security audit -> DevOps assessment -> Code quality -> Legal dependencies

**Key checks:** SBOM for open-source license risks (GPL/AGPL = hard stop), supply chain security, scalability SLOs under 10x load, DevOps maturity (canary/blue-green, post-mortems, runbooks)

### HR DD
Three phases: Information gathering -> Analysis -> Reporting (4-8 weeks)

**Focus areas:** Worker misclassification, compensation hidden costs (deferred bonuses, equity cliffs), key talent retention (3-5 critical people), culture fit assessment, HRIS/GDPR compliance

### ESG DD (VentureESG Framework)
**9-part assessment:**
1. Context & General
2. Diversity & Inclusion
3. Labor & Human Rights
4. Health & Safety
5. Environment
6. Community
7. Data Privacy
8. Governance
9. Business Conduct

**Materiality principle:** Not all ESG factors matter equally. SaaS = data privacy + governance. Hardware = supply chain + materials. Conduct materiality assessment first.

CSRD (EU) requires double materiality: impact ON business AND impact OF business on environment/society.

---

## Access Tier Architecture

| Tier | Audience | Examples |
|------|----------|---------|
| Tier 1 - Open | All stakeholders, no NDA | Pitch deck teaser, company overview, team bios |
| Tier 2 - NDA Required | Qualified investors, advisors | Full financials, cap table, customer contracts |
| Tier 3 - Post-IC / Late DD | Serious buyers, legal counsel | Attorney opinions, raw data, payroll, litigation |

**MindrianOS insight:** Tiers should be **views generated at export time**, not baked into folder structure. Content lives where it belongs semantically; access control is applied on output.

---

## Document Relationship Map (from Self-DD)

| Source | Relationship | Target |
|--------|-------------|--------|
| CapTable_Live | supports | ESOP_Plan, SAFE agreements |
| Prior_Art_Relevance_Matrix | justifies claims in | Patent_Application |
| QoE_NormalizedEBITDA | feeds | Valuation_409A, Projections |
| Competitor_Matrix | informs | SWOT, Positioning, BMC |
| TAM_SAM_SOM_Model | validates | Projections, PitchDeck |
| Risk_Register | sourced from | SWOT, Legal_DD, Litigation |
| ESOP_Grants | reconciles with | Employee_Contract IP clauses |
| SBOM | informs | IP_ChainOfTitle, OpenSource_License |

**MindrianOS insight:** These are exactly the cross-section relationships that the proactive intelligence layer detects: INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES. The Self-DD treats them as a static table. MindrianOS treats them as a living graph.

---

## Evolution Roadmap (Stage-Appropriate DD)

| Stage | Priority | Defer |
|-------|----------|-------|
| Day 1 / Idea | README + Index, BMC v1, Prior Art log, Incorporation | Audited financials, ESG report |
| Pre-Seed | Teaser + deck, cap table, SAFE, basic P&L | QoE, SBOM, SOC2 |
| Seed | Customer contracts, LOIs, unaudited financials, IP filing, tech architecture | Audited statements, environmental |
| Series A | Audited financials, QoE, cohort analysis, SBOM, security certs, ESG materiality | Full litigation reserve |
| Series B+ | Full QoE (sell-side VDD), normalized working capital, ESG reporting, CSRD | M&A structure docs |
| M&A / Exit | Full litigation exposure, attorney opinions, proof of cash | -- |

**MindrianOS insight:** This maps directly to the venture stage system (Pre-Opportunity -> Discovery -> Validation -> Design -> Investment). The stage determines which DD sections are active.

---

## Seven Structural Problems With the Self-DD Document (PWS Lens)

### 1. Starts With Fundraising, Not Problem Definition
The document leads with `01_Fundraising_Documents/`. PWS starts with the problem. Fundraising materials are OUTPUTS of a well-understood problem, not inputs.

### 2. Assumptions Are Invisible
Documents are treated as facts to file. PWS treats every claim as a falsifiable hypothesis with validity status (UNTESTED / VALIDATED / INVALIDATED / STALE).

### 3. Cross-References Are an Afterthought
The relationship map is a static table at the end. In Neo4j, 65K+ relationships ARE the primary intelligence. Cross-section edges are where value concentrates (Simon's weak interactions).

### 4. Methodologies Are Isolated Per Section
Porter in competitive. BMC in business model. SWOT in risk. But the graph knows they CHAIN: Domain Definition -> Critical Uncertainty -> Scenario Framework -> Gap Exploration -> Strategy Development.

### 5. No Meeting Layer
Meetings don't exist in the Self-DD. PWS and MindrianOS treat meetings as the PRIMARY knowledge source. Neo4j has 462 Session nodes.

### 6. Linear Stage Assumption
The document implies ventures progress linearly through stages. The graph has `LOOPS_TO` edges because ventures REGRESS. A well-defined problem can become ill-defined after market feedback.

### 7. Flat Filing vs Near-Decomposable Hierarchy
13 numbered folders = flat. Simon (1962) proved complex systems persist through hierarchical near-decomposability. The room should be nested subsystems with their own state.

---

## Related Documents

- `SELF-DD-NEO4J-SCHEMA.md` (in docs/) - Full Cypher ingestion schema for the 3 gap domains
- `RESEARCH_05_NESTED_SYSTEMS.md` - Simon's Architecture of Complexity
- `RESEARCH_06_WICKED_PROBLEMS.md` - Rittel & Webber's wicked problem characteristics
- `LIVE_DATA_ROOM_JTBD_PAPER.md` - The theoretical grounding for the Data Room as wicked problem management
