# Self-DD Neo4j Ingestion Schema

> Three missing methodology domains for the Brain: Legal/IP DD, Financial DD, ESG/Governance.
> Follows existing graph conventions discovered from 21K+ nodes.

---

## Existing Graph Patterns (for consistency)

These are the patterns already in the Brain that we MUST follow:

```
Node Labels Used:
  Framework, Technique, ProcessStep, Phase, Stage, InnovationStage,
  ProblemType, Concept, DictionaryTerm, WorthinessCriteria,
  DataRoomSection, ValidationTool, CorePrinciple, Person, Book

Relationship Types Used:
  LEADS_TO          — sequential progression (Stage→Stage, Phase→Phase)
  LOOPS_TO          — regression allowed (Phase→Phase)
  HAS_STEP          — Stage contains ProcessSteps
  HAS_PROCESS_STEP  — Framework contains ProcessSteps
  HAS_STAGE         — Phase contains Stages
  ADDRESSES_PROBLEM_TYPE — Framework→ProblemType routing
  USES_TECHNIQUE    — ProblemType→Technique routing
  FILED_IN          — Entity→DataRoomSection
  APPLIED_IN_STAGE  — Technique→InnovationStage
  COMPLEMENTS       — Framework↔Framework
  EQUIPS_WITH       — Framework→Technique
  DEFINES           — Framework→DictionaryTerm
  IMPLEMENTED_AS    — Framework→ValidationTool
  PART_OF           — Technique→Framework
  ENABLES           — Framework→Concept
  CO_OCCURS         — statistical co-occurrence
  HAS_DIMENSION     — Framework→Concept (sub-aspects)
  RELATES_TO        — soft association
```

**Naming Convention:** Use title case for node names. Use descriptive names, not abbreviations.

---

## Domain 1: Legal & IP Due Diligence

### 1.1 Master Framework

```cypher
// The overarching Legal DD framework
CREATE (ldd:Framework {
  name: 'Legal Due Diligence Framework',
  description: 'Risk-tiered legal review methodology covering corporate, IP, contracts, litigation, and regulatory compliance. Based on Debevoise & Plimpton best practices.',
  source: 'Self-DD methodology + Debevoise & Plimpton'
})

// IP DD as separate framework (distinct enough)
CREATE (ipdd:Framework {
  name: 'IP Due Diligence Framework',
  description: 'Systematic prior art search, patentability assessment, and freedom-to-operate analysis following USPTO/MPEP guidelines.',
  source: 'USPTO/MPEP + Self-DD methodology'
})

// Connect to problem types
MATCH (wp:ProblemType {name: 'Well-Defined Problem'})
CREATE (ldd)-[:ADDRESSES_PROBLEM_TYPE]->(wp)
CREATE (ipdd)-[:ADDRESSES_PROBLEM_TYPE]->(wp)

// Connect to existing Triple Validation
MATCH (phase:Phase {name: 'Is It Worth It? - Business Case'})
CREATE (ldd)-[:APPLIED_IN_PHASE]->(phase)
CREATE (ipdd)-[:APPLIED_IN_PHASE]->(phase)

// File in data room section
MATCH (s:DataRoomSection {name: 'legal_ip'})
CREATE (ldd)-[:FILED_IN]->(s)
CREATE (ipdd)-[:FILED_IN]->(s)
```

### 1.2 Legal DD Stages and Steps

```cypher
// --- Legal DD has 3 stages ---

CREATE (s1:Stage {name: 'Legal Information Gathering', description: 'Collect all corporate, contractual, and regulatory documents'})
CREATE (s2:Stage {name: 'Legal Risk Analysis', description: 'Assess hidden costs, legal risks, and deal-impact issues'})
CREATE (s3:Stage {name: 'Legal Impact Reporting', description: 'Quantify impact on deal value, inform reps & warranties'})

// Chain
CREATE (s1)-[:LEADS_TO]->(s2)
CREATE (s2)-[:LEADS_TO]->(s3)

// Connect to framework
MATCH (ldd:Framework {name: 'Legal Due Diligence Framework'})
CREATE (ldd)-[:HAS_STAGE]->(s1)
CREATE (ldd)-[:HAS_STAGE]->(s2)
CREATE (ldd)-[:HAS_STAGE]->(s3)

// --- Stage 1 Steps: Information Gathering ---
CREATE (ps1a:ProcessStep {name: 'Corporate Good Standing Verification', description: 'Confirm entity exists in all operating jurisdictions'})
CREATE (ps1b:ProcessStep {name: 'Minute Book Completeness Audit', description: 'Check for missing board resolutions — governance gap indicator'})
CREATE (ps1c:ProcessStep {name: 'Ownership Chain Verification', description: 'Confirm no shadow shareholders, side agreements, or undisclosed rights'})
CREATE (ps1d:ProcessStep {name: 'Material Contract Inventory', description: 'Catalog all customer, supplier, loan, lease, and NDA agreements'})
CREATE (ps1e:ProcessStep {name: 'Litigation Search — 5 Part', description: 'Current + threatened + historical + vendor-customer + regulatory disputes'})

CREATE (s1)-[:HAS_STEP]->(ps1a)
CREATE (s1)-[:HAS_STEP]->(ps1b)
CREATE (s1)-[:HAS_STEP]->(ps1c)
CREATE (s1)-[:HAS_STEP]->(ps1d)
CREATE (s1)-[:HAS_STEP]->(ps1e)

CREATE (ps1a)-[:LEADS_TO]->(ps1b)
CREATE (ps1b)-[:LEADS_TO]->(ps1c)
CREATE (ps1c)-[:LEADS_TO]->(ps1d)
CREATE (ps1d)-[:LEADS_TO]->(ps1e)

// --- Stage 2 Steps: Risk Analysis ---
CREATE (ps2a:ProcessStep {name: 'Worker Misclassification Risk Assessment', description: 'Check contractor vs employee status, non-compete enforceability, IP assignment coverage'})
CREATE (ps2b:ProcessStep {name: 'IP Assignment Chain Audit', description: 'Verify all engineers and contractors have valid IP assignment clauses'})
CREATE (ps2c:ProcessStep {name: 'Open Source License Risk Review', description: 'SBOM scan for GPL/AGPL copyleft licenses in commercial product — hard stop for many investors'})
CREATE (ps2d:ProcessStep {name: 'Litigation Exposure Quantification', description: 'Financial exposure range per open matter, check adequacy of reserves'})
CREATE (ps2e:ProcessStep {name: 'Regulatory Compliance Gap Analysis', description: 'Industry licenses, GDPR/DPA, data privacy policy completeness'})

CREATE (s2)-[:HAS_STEP]->(ps2a)
CREATE (s2)-[:HAS_STEP]->(ps2b)
CREATE (s2)-[:HAS_STEP]->(ps2c)
CREATE (s2)-[:HAS_STEP]->(ps2d)
CREATE (s2)-[:HAS_STEP]->(ps2e)

CREATE (ps2a)-[:LEADS_TO]->(ps2b)
CREATE (ps2b)-[:LEADS_TO]->(ps2c)
CREATE (ps2c)-[:LEADS_TO]->(ps2d)
CREATE (ps2d)-[:LEADS_TO]->(ps2e)

// --- Stage 3 Steps: Impact Reporting ---
CREATE (ps3a:ProcessStep {name: 'Reps and Warranties Drafting Input', description: 'Legal findings inform specific representations and warranties language'})
CREATE (ps3b:ProcessStep {name: 'Indemnification Scope Definition', description: 'Define indemnification obligations based on discovered risks'})
CREATE (ps3c:ProcessStep {name: 'Deal Value Impact Assessment', description: 'Quantify how legal findings affect valuation, escrow, or holdback'})

CREATE (s3)-[:HAS_STEP]->(ps3a)
CREATE (s3)-[:HAS_STEP]->(ps3b)
CREATE (s3)-[:HAS_STEP]->(ps3c)

CREATE (ps3a)-[:LEADS_TO]->(ps3b)
CREATE (ps3b)-[:LEADS_TO]->(ps3c)
```

### 1.3 IP Prior Art Search Framework

```cypher
// --- IP DD Stages ---

CREATE (ips1:Stage {name: 'Inventive Concept Identification', description: 'Break invention into independent claim elements'})
CREATE (ips2:Stage {name: 'Prior Art Search Execution', description: 'Three-stream search: domestic patents, foreign patents, non-patent literature'})
CREATE (ips3:Stage {name: 'Patentability Assessment', description: 'Evaluate novelty (§102) and non-obviousness (§103) per claim'})
CREATE (ips4:Stage {name: 'Freedom to Operate Analysis', description: 'FTO opinion before public disclosure or launch'})

CREATE (ips1)-[:LEADS_TO]->(ips2)
CREATE (ips2)-[:LEADS_TO]->(ips3)
CREATE (ips3)-[:LEADS_TO]->(ips4)

MATCH (ipdd:Framework {name: 'IP Due Diligence Framework'})
CREATE (ipdd)-[:HAS_STAGE]->(ips1)
CREATE (ipdd)-[:HAS_STAGE]->(ips2)
CREATE (ipdd)-[:HAS_STAGE]->(ips3)
CREATE (ipdd)-[:HAS_STAGE]->(ips4)

// --- Search Execution Steps ---
CREATE (ipa:ProcessStep {name: 'Build Boolean Search Queries', description: 'Combine IPC/CPC classification codes + keyword strings. Log every query with date, database, results count, relevance.'})
CREATE (ipb:ProcessStep {name: 'Search Domestic Patents', description: 'USPTO full-text search'})
CREATE (ipc:ProcessStep {name: 'Search Foreign Patents', description: 'Espacenet (EPO), WIPO PatentScope, J-PlatPat'})
CREATE (ipd:ProcessStep {name: 'Search Non-Patent Literature', description: 'Google Scholar, arXiv, GitHub, conference papers, product documentation'})
CREATE (ipe:ProcessStep {name: 'Build Relevance Matrix', description: 'Map each prior art piece to which claim elements it discloses (novel vs anticipated)'})

CREATE (ips2)-[:HAS_STEP]->(ipa)
CREATE (ips2)-[:HAS_STEP]->(ipb)
CREATE (ips2)-[:HAS_STEP]->(ipc)
CREATE (ips2)-[:HAS_STEP]->(ipd)
CREATE (ips2)-[:HAS_STEP]->(ipe)

CREATE (ipa)-[:LEADS_TO]->(ipb)
CREATE (ipb)-[:LEADS_TO]->(ipc)
CREATE (ipc)-[:LEADS_TO]->(ipd)
CREATE (ipd)-[:LEADS_TO]->(ipe)

// --- Techniques ---
CREATE (t1:Technique {name: 'Prior Art Three-Stream Search', description: 'Parallel search across domestic patents, foreign patents, and non-patent literature'})
CREATE (t2:Technique {name: 'Relevance Matrix Analysis', description: 'Prior art document ↔ claim element mapping for novelty assessment'})
CREATE (t3:Technique {name: 'Freedom to Operate Opinion', description: 'Attorney-commissioned FTO analysis before public disclosure'})
CREATE (t4:Technique {name: 'Five-Part Litigation Search', description: 'Current + threatened + historical + vendor-customer + regulatory dispute search'})

MATCH (ipdd:Framework {name: 'IP Due Diligence Framework'})
CREATE (ipdd)-[:EQUIPS_WITH]->(t1)
CREATE (ipdd)-[:EQUIPS_WITH]->(t2)
CREATE (ipdd)-[:EQUIPS_WITH]->(t3)

MATCH (ldd:Framework {name: 'Legal Due Diligence Framework'})
CREATE (ldd)-[:EQUIPS_WITH]->(t4)
```

### 1.4 Dictionary Terms

```cypher
CREATE (dt1:DictionaryTerm {name: 'Freedom to Operate', definition: 'Legal opinion confirming a product or process does not infringe existing patent rights. Commissioned before public disclosure or launch.'})
CREATE (dt2:DictionaryTerm {name: 'Prior Art', definition: 'Any evidence that an invention was already known before a patent filing date. Includes patents, publications, products, and public demonstrations.'})
CREATE (dt3:DictionaryTerm {name: 'SBOM', definition: 'Software Bill of Materials — inventory of all third-party libraries and their licenses. GPL/AGPL copyleft in a commercial product is a hard stop for many investors.'})
CREATE (dt4:DictionaryTerm {name: 'Chain of Title', definition: 'The documented sequence of IP ownership transfers from original inventor to current holder. Gaps in chain of title create investor risk.'})
CREATE (dt5:DictionaryTerm {name: 'Reps and Warranties', definition: 'Legally binding statements about the condition of the business made by the seller. Legal DD findings directly inform their scope.'})

MATCH (ldd:Framework {name: 'Legal Due Diligence Framework'})
CREATE (ldd)-[:DEFINES]->(dt4)
CREATE (ldd)-[:DEFINES]->(dt5)

MATCH (ipdd:Framework {name: 'IP Due Diligence Framework'})
CREATE (ipdd)-[:DEFINES]->(dt1)
CREATE (ipdd)-[:DEFINES]->(dt2)
CREATE (ipdd)-[:DEFINES]->(dt3)
```

---

## Domain 2: Financial Due Diligence

### 2.1 Master Framework

```cypher
CREATE (fdd:Framework {
  name: 'Financial Due Diligence Framework',
  description: 'Quality of Earnings (QoE) methodology — goes beyond GAAP compliance to assess sustainability and quality of reported earnings. Gold standard for buy-side and sell-side financial DD.',
  source: 'Self-DD methodology + QoE best practices'
})

// Connects to Well-Defined Problem (financials are quantifiable)
MATCH (wp:ProblemType {name: 'Well-Defined Problem'})
CREATE (fdd)-[:ADDRESSES_PROBLEM_TYPE]->(wp)

// Connects to "Is It Worth It?" phase
MATCH (phase:Phase {name: 'Is It Worth It? - Business Case'})
CREATE (fdd)-[:APPLIED_IN_PHASE]->(phase)

// Complements existing business case steps
MATCH (step:ProcessStep {name: 'Return & Justification Analysis'})
CREATE (fdd)-[:ENABLES]->(step)

// File in data room — create new section if needed
CREATE (fds:DataRoomSection {name: 'financial_model'})
CREATE (fdd)-[:FILED_IN]->(fds)
```

### 2.2 QoE Stages and Steps

```cypher
// --- 5 QoE Stages ---

CREATE (qs1:Stage {name: 'Revenue Quality Test', description: 'Examine timing, concentration risk, churn, one-off contracts, deferred revenue'})
CREATE (qs2:Stage {name: 'Expense Quality Test', description: 'Scan for capitalised routine costs, under-accrued liabilities, owner add-backs claiming non-recurring'})
CREATE (qs3:Stage {name: 'Proof of Cash Reconciliation', description: 'Reconcile P&L to bank statements — if profit does not appear as cash, investigate why'})
CREATE (qs4:Stage {name: 'Normalized EBITDA Bridge', description: 'Build clean bridge from reported profit to adjusted EBITDA with documented evidence per add-back'})
CREATE (qs5:Stage {name: 'Working Capital Normalization', description: 'Set normalized working capital target early to avoid closing surprises'})

CREATE (qs1)-[:LEADS_TO]->(qs2)
CREATE (qs2)-[:LEADS_TO]->(qs3)
CREATE (qs3)-[:LEADS_TO]->(qs4)
CREATE (qs4)-[:LEADS_TO]->(qs5)

MATCH (fdd:Framework {name: 'Financial Due Diligence Framework'})
CREATE (fdd)-[:HAS_STAGE]->(qs1)
CREATE (fdd)-[:HAS_STAGE]->(qs2)
CREATE (fdd)-[:HAS_STAGE]->(qs3)
CREATE (fdd)-[:HAS_STAGE]->(qs4)
CREATE (fdd)-[:HAS_STAGE]->(qs5)

// --- Revenue Quality Steps ---
CREATE (rq1:ProcessStep {name: 'Revenue Timing Analysis', description: 'Check recognition timing vs cash collection — early recognition is a red flag'})
CREATE (rq2:ProcessStep {name: 'Customer Concentration Risk Assessment', description: 'Flag if any single customer exceeds 20% of revenue'})
CREATE (rq3:ProcessStep {name: 'Churn and Retention Analysis', description: 'Separate growth story from churn reality via cohort analysis'})
CREATE (rq4:ProcessStep {name: 'One-Off vs Recurring Revenue Classification', description: 'Identify and strip one-time contracts from run-rate projections'})
CREATE (rq5:ProcessStep {name: 'Deferred Revenue Audit', description: 'Verify deferred revenue schedule matches actual delivery obligations'})

CREATE (qs1)-[:HAS_STEP]->(rq1)
CREATE (qs1)-[:HAS_STEP]->(rq2)
CREATE (qs1)-[:HAS_STEP]->(rq3)
CREATE (qs1)-[:HAS_STEP]->(rq4)
CREATE (qs1)-[:HAS_STEP]->(rq5)

CREATE (rq1)-[:LEADS_TO]->(rq2)
CREATE (rq2)-[:LEADS_TO]->(rq3)
CREATE (rq3)-[:LEADS_TO]->(rq4)
CREATE (rq4)-[:LEADS_TO]->(rq5)

// --- Expense Quality Steps ---
CREATE (eq1:ProcessStep {name: 'Capitalized Cost Scan', description: 'Identify routine operating costs improperly capitalized to inflate EBITDA'})
CREATE (eq2:ProcessStep {name: 'Under-Accrued Liability Detection', description: 'Check for understated liabilities that will surface post-close'})
CREATE (eq3:ProcessStep {name: 'Owner Add-Back Validation', description: 'Scrutinize every claimed non-recurring charge — recurring non-recurring is the #1 red flag'})
CREATE (eq4:ProcessStep {name: 'Related Party Transaction Review', description: 'Flag transactions with related parties at non-market rates'})

CREATE (qs2)-[:HAS_STEP]->(eq1)
CREATE (qs2)-[:HAS_STEP]->(eq2)
CREATE (qs2)-[:HAS_STEP]->(eq3)
CREATE (qs2)-[:HAS_STEP]->(eq4)

CREATE (eq1)-[:LEADS_TO]->(eq2)
CREATE (eq2)-[:LEADS_TO]->(eq3)
CREATE (eq3)-[:LEADS_TO]->(eq4)

// --- Proof of Cash Steps ---
CREATE (pc1:ProcessStep {name: 'Bank Statement Collection', description: 'Gather statements for all accounts covering the analysis period'})
CREATE (pc2:ProcessStep {name: 'P&L to Cash Reconciliation', description: 'Match reported profit lines to actual bank deposits and withdrawals'})
CREATE (pc3:ProcessStep {name: 'Cash Variance Investigation', description: 'For every material variance between P&L and cash — document the explanation'})

CREATE (qs3)-[:HAS_STEP]->(pc1)
CREATE (qs3)-[:HAS_STEP]->(pc2)
CREATE (qs3)-[:HAS_STEP]->(pc3)

CREATE (pc1)-[:LEADS_TO]->(pc2)
CREATE (pc2)-[:LEADS_TO]->(pc3)

// --- EBITDA Bridge Steps ---
CREATE (eb1:ProcessStep {name: 'Reported Profit Baseline', description: 'Start from audited or management-reported profit figure'})
CREATE (eb2:ProcessStep {name: 'Add-Back Documentation', description: 'For every proposed adjustment: evidence document, rationale, amount, and whether buyer agrees'})
CREATE (eb3:ProcessStep {name: 'Adjusted EBITDA Calculation', description: 'Final normalized EBITDA — the number the deal prices off'})

CREATE (qs4)-[:HAS_STEP]->(eb1)
CREATE (qs4)-[:HAS_STEP]->(eb2)
CREATE (qs4)-[:HAS_STEP]->(eb3)

CREATE (eb1)-[:LEADS_TO]->(eb2)
CREATE (eb2)-[:LEADS_TO]->(eb3)

// --- Working Capital Steps ---
CREATE (wc1:ProcessStep {name: 'Working Capital Components Identification', description: 'Current assets minus current liabilities, excluding cash and debt'})
CREATE (wc2:ProcessStep {name: 'Seasonal Normalization', description: 'Average across periods to remove seasonal distortion'})
CREATE (wc3:ProcessStep {name: 'Working Capital Target Setting', description: 'Set the normalized target — deviations at close become purchase price adjustments'})

CREATE (qs5)-[:HAS_STEP]->(wc1)
CREATE (qs5)-[:HAS_STEP]->(wc2)
CREATE (qs5)-[:HAS_STEP]->(wc3)

CREATE (wc1)-[:LEADS_TO]->(wc2)
CREATE (wc2)-[:LEADS_TO]->(wc3)
```

### 2.3 Unit Economics & Traction Techniques

```cypher
// These complement QoE — they validate the FORWARD story, not just historical
CREATE (t1:Technique {name: 'LTV-CAC Ratio Analysis', description: 'Lifetime Value / Customer Acquisition Cost — must exceed 3:1 at scale'})
CREATE (t2:Technique {name: 'Cohort Retention Analysis', description: 'Separates the growth narrative from churn reality by tracking user cohorts over time'})
CREATE (t3:Technique {name: 'Burn Multiple Calculation', description: 'Net burn / net new ARR — below 1.5x is healthy for early stage'})
CREATE (t4:Technique {name: 'Rule of 40 Assessment', description: 'Revenue Growth % + EBITDA Margin % >= 40 signals SaaS health'})
CREATE (t5:Technique {name: 'Net Revenue Retention Measurement', description: 'NRR above 100% signals product stickiness — expansion revenue exceeds churn'})
CREATE (t6:Technique {name: 'Vendor Due Diligence Report', description: 'Seller-commissioned QoE report — proactive sellers maintain negotiating leverage by running their own QoE'})

MATCH (fdd:Framework {name: 'Financial Due Diligence Framework'})
CREATE (fdd)-[:EQUIPS_WITH]->(t1)
CREATE (fdd)-[:EQUIPS_WITH]->(t2)
CREATE (fdd)-[:EQUIPS_WITH]->(t3)
CREATE (fdd)-[:EQUIPS_WITH]->(t4)
CREATE (fdd)-[:EQUIPS_WITH]->(t5)
CREATE (fdd)-[:EQUIPS_WITH]->(t6)
```

### 2.4 Red Flag Concepts

```cypher
// Red flags are first-class concepts — they enable the contradiction detection engine
CREATE (rf1:Concept {name: 'Gross Margin Swing Without Explanation', type: 'RedFlag', domain: 'financial_dd', description: 'Gross margin changes between periods without operational cause — signals revenue or cost manipulation'})
CREATE (rf2:Concept {name: 'Recurring Non-Recurring Charges', type: 'RedFlag', domain: 'financial_dd', description: 'The #1 QoE red flag — charges labeled non-recurring that appear every period'})
CREATE (rf3:Concept {name: 'Revenue Before Cash Collection', type: 'RedFlag', domain: 'financial_dd', description: 'Revenue recognized before payment received — check proof of cash'})
CREATE (rf4:Concept {name: 'Related Party Non-Market Transactions', type: 'RedFlag', domain: 'financial_dd', description: 'Transactions with related parties at prices that would not exist at arms length'})
CREATE (rf5:Concept {name: 'Customer Concentration Above 20%', type: 'RedFlag', domain: 'financial_dd', description: 'Single customer exceeding 20% of revenue creates existential dependency risk'})

MATCH (fdd:Framework {name: 'Financial Due Diligence Framework'})
CREATE (fdd)-[:REVEALS]->(rf1)
CREATE (fdd)-[:REVEALS]->(rf2)
CREATE (fdd)-[:REVEALS]->(rf3)
CREATE (fdd)-[:REVEALS]->(rf4)
CREATE (fdd)-[:REVEALS]->(rf5)
```

### 2.5 Dictionary Terms

```cypher
CREATE (dt1:DictionaryTerm {name: 'Quality of Earnings', definition: 'Analysis that goes beyond GAAP compliance to assess whether reported earnings are sustainable, recurring, and cash-backed. The gold standard for financial DD.'})
CREATE (dt2:DictionaryTerm {name: 'Normalized EBITDA', definition: 'Earnings before interest, taxes, depreciation, and amortization, adjusted for non-recurring items and owner-specific costs. The number the deal prices off.'})
CREATE (dt3:DictionaryTerm {name: 'Proof of Cash', definition: 'Reconciliation of P&L to bank statements. If profit does not appear as cash, it is not real profit.'})
CREATE (dt4:DictionaryTerm {name: 'Working Capital Target', definition: 'Normalized current assets minus current liabilities, excluding cash and debt. Deviations at close become purchase price adjustments.'})
CREATE (dt5:DictionaryTerm {name: 'Burn Multiple', definition: 'Net cash burn divided by net new ARR. Below 1.5x is healthy for early stage. Measures capital efficiency of growth.'})

MATCH (fdd:Framework {name: 'Financial Due Diligence Framework'})
CREATE (fdd)-[:DEFINES]->(dt1)
CREATE (fdd)-[:DEFINES]->(dt2)
CREATE (fdd)-[:DEFINES]->(dt3)
CREATE (fdd)-[:DEFINES]->(dt4)
CREATE (fdd)-[:DEFINES]->(dt5)
```

---

## Domain 3: ESG & Governance Due Diligence

### 3.1 Master Framework

```cypher
CREATE (esg:Framework {
  name: 'ESG Due Diligence Framework',
  description: 'VentureESG 9-part assessment for venture-backed companies. Includes materiality assessment to focus resources on highest-impact ESG factors per business type.',
  source: 'VentureESG + CSRD/EU Taxonomy + Self-DD methodology'
})

// ESG is a wicked problem — not every factor matters equally
MATCH (wp:ProblemType {name: 'Wicked Problem'})
CREATE (esg)-[:ADDRESSES_PROBLEM_TYPE]->(wp)

// Also well-defined for compliance-specific checks
MATCH (wdp:ProblemType {name: 'Well-Defined Problem'})
CREATE (esg)-[:ADDRESSES_PROBLEM_TYPE]->(wdp)

// File in governance section — create if needed
CREATE (gs:DataRoomSection {name: 'governance_esg'})
CREATE (esg)-[:FILED_IN]->(gs)
```

### 3.2 The 9-Part VentureESG Assessment

```cypher
// --- 9 Stages mapping to VentureESG framework ---

CREATE (e1:Stage {name: 'ESG Context and General Assessment', description: 'Company context, industry, geography, and stage-specific ESG profile'})
CREATE (e2:Stage {name: 'Diversity and Inclusion Assessment', description: 'Board composition, hiring practices, pay equity, inclusion programs'})
CREATE (e3:Stage {name: 'Labor and Human Rights Assessment', description: 'Working conditions, supply chain labor practices, anti-forced-labor compliance'})
CREATE (e4:Stage {name: 'Health and Safety Assessment', description: 'Workplace safety, incident reporting, safety training programs'})
CREATE (e5:Stage {name: 'Environmental Impact Assessment', description: 'Carbon footprint, energy use, waste management, environmental permits'})
CREATE (e6:Stage {name: 'Community Impact Assessment', description: 'Local community engagement, social license to operate, stakeholder relations'})
CREATE (e7:Stage {name: 'Data Privacy and Ethics Assessment', description: 'GDPR compliance, data ethics policy, AI ethics, data processing agreements'})
CREATE (e8:Stage {name: 'Corporate Governance Assessment', description: 'Board charter, conflict of interest policy, audit committee, executive compensation'})
CREATE (e9:Stage {name: 'Business Conduct Assessment', description: 'Anti-bribery, anti-corruption, whistleblower policy, code of conduct'})

// Chain (assessment order)
CREATE (e1)-[:LEADS_TO]->(e2)
CREATE (e2)-[:LEADS_TO]->(e3)
CREATE (e3)-[:LEADS_TO]->(e4)
CREATE (e4)-[:LEADS_TO]->(e5)
CREATE (e5)-[:LEADS_TO]->(e6)
CREATE (e6)-[:LEADS_TO]->(e7)
CREATE (e7)-[:LEADS_TO]->(e8)
CREATE (e8)-[:LEADS_TO]->(e9)

MATCH (esg:Framework {name: 'ESG Due Diligence Framework'})
CREATE (esg)-[:HAS_STAGE]->(e1)
CREATE (esg)-[:HAS_STAGE]->(e2)
CREATE (esg)-[:HAS_STAGE]->(e3)
CREATE (esg)-[:HAS_STAGE]->(e4)
CREATE (esg)-[:HAS_STAGE]->(e5)
CREATE (esg)-[:HAS_STAGE]->(e6)
CREATE (esg)-[:HAS_STAGE]->(e7)
CREATE (esg)-[:HAS_STAGE]->(e8)
CREATE (esg)-[:HAS_STAGE]->(e9)
```

### 3.3 Materiality Assessment (The Routing Engine)

```cypher
// Materiality is the ESG equivalent of ProblemType routing —
// not all ESG factors are equally relevant to every business

CREATE (mat:Framework {
  name: 'ESG Materiality Assessment',
  description: 'Determines which ESG factors are material (high impact) for a specific business type. A SaaS company focuses on data privacy and governance; a hardware company adds supply chain and materials.',
  source: 'VentureESG + CSRD'
})

CREATE (mat)-[:PART_OF]->(esg)

// Process steps
CREATE (m1:ProcessStep {name: 'Industry Materiality Mapping', description: 'Map business type to SASB materiality standards — which ESG issues matter for this industry'})
CREATE (m2:ProcessStep {name: 'Stakeholder Impact Scoring', description: 'Score each ESG factor by stakeholder importance (investors, employees, customers, regulators)'})
CREATE (m3:ProcessStep {name: 'Materiality Matrix Construction', description: 'Plot ESG factors on impact vs likelihood matrix — High/Medium/Low per issue'})
CREATE (m4:ProcessStep {name: 'DD Resource Allocation', description: 'Focus detailed DD effort on high-materiality factors only — do not waste time on low-impact issues'})

MATCH (mat:Framework {name: 'ESG Materiality Assessment'})
CREATE (mat)-[:HAS_PROCESS_STEP]->(m1)
CREATE (mat)-[:HAS_PROCESS_STEP]->(m2)
CREATE (mat)-[:HAS_PROCESS_STEP]->(m3)
CREATE (mat)-[:HAS_PROCESS_STEP]->(m4)

CREATE (m1)-[:LEADS_TO]->(m2)
CREATE (m2)-[:LEADS_TO]->(m3)
CREATE (m3)-[:LEADS_TO]->(m4)
```

### 3.4 CSRD Compliance (EU)

```cypher
CREATE (csrd:Technique {name: 'CSRD Compliance Assessment', description: 'Corporate Sustainability Reporting Directive — mandatory for EU companies or those seeking EU investors. Double materiality: impact on business AND impact of business on environment/society.'})
CREATE (eutax:Technique {name: 'EU Taxonomy Alignment', description: 'Classification of economic activities as environmentally sustainable under EU regulation. Required for EU-market fundraising.'})

MATCH (esg:Framework {name: 'ESG Due Diligence Framework'})
CREATE (esg)-[:EQUIPS_WITH]->(csrd)
CREATE (esg)-[:EQUIPS_WITH]->(eutax)
```

### 3.5 Dictionary Terms

```cypher
CREATE (dt1:DictionaryTerm {name: 'Materiality Assessment', definition: 'Process of determining which ESG factors are most relevant to a specific business. Not all ESG issues are equally material — focus DD resources on highest-impact factors.'})
CREATE (dt2:DictionaryTerm {name: 'Double Materiality', definition: 'CSRD concept requiring companies to report both how sustainability issues affect the business (financial materiality) AND how the business affects society and environment (impact materiality).'})
CREATE (dt3:DictionaryTerm {name: 'VentureESG', definition: 'Standard 9-part ESG assessment framework specifically designed for venture-backed companies, covering Context through Business Conduct.'})
CREATE (dt4:DictionaryTerm {name: 'Social License to Operate', definition: 'The informal permission a community grants to a company based on trust and legitimacy. Loss of social license can halt operations regardless of legal rights.'})

MATCH (esg:Framework {name: 'ESG Due Diligence Framework'})
CREATE (esg)-[:DEFINES]->(dt1)
CREATE (esg)-[:DEFINES]->(dt2)
CREATE (esg)-[:DEFINES]->(dt3)
CREATE (esg)-[:DEFINES]->(dt4)
```

---

## Domain 4: Cross-Domain Connections

This is where the real intelligence lives — connecting the three new domains to everything already in the graph.

### 4.1 Connect to Existing Triple Validation Compass

```cypher
// Financial DD validates "Is It Worth It?" with hard evidence
MATCH (fdd:Framework {name: 'Financial Due Diligence Framework'})
MATCH (worth:Concept {name: 'Is it Worth It?'})
CREATE (fdd)-[:VALIDATES]->(worth)

// Legal DD validates "Is It Real?" at the corporate level
MATCH (ldd:Framework {name: 'Legal Due Diligence Framework'})
MATCH (real:Concept {name: 'Is it Real?'})
CREATE (ldd)-[:VALIDATES]->(real)

// IP DD validates "Can We Win?" at the defensibility level
MATCH (ipdd:Framework {name: 'IP Due Diligence Framework'})
MATCH (win:Concept {name: 'Can We Win?'})
CREATE (ipdd)-[:VALIDATES]->(win)

// ESG validates all three — governance is table stakes
MATCH (esg:Framework {name: 'ESG Due Diligence Framework'})
CREATE (esg)-[:VALIDATES]->(real)
CREATE (esg)-[:VALIDATES]->(worth)
```

### 4.2 Connect to Existing Frameworks

```cypher
// Financial DD complements Business Model Canvas
MATCH (fdd:Framework {name: 'Financial Due Diligence Framework'})
MATCH (bmc:Technique {name: 'Business Model Canvas'})
CREATE (fdd)-[:COMPLEMENTS]->(bmc)

// Legal DD complements Competitive Landscape Analysis
MATCH (ldd:Framework {name: 'Legal Due Diligence Framework'})
MATCH (cla:Technique {name: 'Competitive Landscape Analysis'})
CREATE (ldd)-[:COMPLEMENTS]->(cla)

// IP DD complements Reverse Salient Analysis
MATCH (ipdd:Framework {name: 'IP Due Diligence Framework'})
MATCH (rsa:Framework {name: 'Reverse Salient Analysis'})
CREATE (ipdd)-[:COMPLEMENTS]->(rsa)

// ESG complements Systems Thinking (ESG IS systems thinking applied to governance)
MATCH (esg:Framework {name: 'ESG Due Diligence Framework'})
MATCH (st:Framework {name: 'Systems Thinking'})
CREATE (esg)-[:COMPLEMENTS]->(st)

// ESG complements Stakeholder Mapping
MATCH (esg:Framework {name: 'ESG Due Diligence Framework'})
MATCH (sa:Technique {name: 'Stakeholder Analysis'})
CREATE (esg)-[:COMPLEMENTS]->(sa)

// Financial DD ENABLES the Market & Business Case Development stage
MATCH (fdd:Framework {name: 'Financial Due Diligence Framework'})
MATCH (mbcd:Stage {name: 'Market & Business Case Development'})
CREATE (fdd)-[:ENABLES]->(mbcd)

// Legal DD ENABLES Synthesis & Final Decision
MATCH (ldd:Framework {name: 'Legal Due Diligence Framework'})
MATCH (sfd:Stage {name: 'Synthesis & Final Decision'})
CREATE (ldd)-[:ENABLES]->(sfd)
```

### 4.3 Connect to WorthinessCriteria

```cypher
// Financial DD directly measures Market Size and Impact Potential
MATCH (fdd:Framework {name: 'Financial Due Diligence Framework'})
MATCH (ms:WorthinessCriteria {name: 'Market Size'})
MATCH (ip:WorthinessCriteria {name: 'Impact Potential'})
CREATE (fdd)-[:MEASURES]->(ms)
CREATE (fdd)-[:MEASURES]->(ip)

// IP DD directly measures Solvability (can we legally build this?)
MATCH (ipdd:Framework {name: 'IP Due Diligence Framework'})
MATCH (sv:WorthinessCriteria {name: 'Solvability'})
CREATE (ipdd)-[:MEASURES]->(sv)
```

### 4.4 The Investment Readiness Phase (NEW)

```cypher
// This extends the Triple Validation Compass with a 4th phase
// that the Self-DD methodology uniquely contributes

CREATE (ir:Phase {
  name: 'Investment Readiness - Due Diligence Preparation',
  description: 'Post-validation phase where the venture prepares proactive Self-DD across financial, legal, IP, and ESG domains. Converts validated venture into investor-ready state.'
})

// Chain from existing
MATCH (worth:Phase {name: 'Is It Worth It? - Business Case'})
CREATE (worth)-[:LEADS_TO]->(ir)
CREATE (ir)-[:LOOPS_TO]->(worth)

// Investment Readiness has 4 stages
CREATE (ir1:Stage {name: 'Financial Readiness', description: 'QoE, EBITDA bridge, proof of cash, unit economics validation'})
CREATE (ir2:Stage {name: 'Legal Readiness', description: 'Corporate good standing, ownership chain, material contracts, litigation clear'})
CREATE (ir3:Stage {name: 'IP Readiness', description: 'Prior art search complete, FTO opinion obtained, SBOM reviewed'})
CREATE (ir4:Stage {name: 'Governance Readiness', description: 'ESG materiality assessed, key policies in place, board governance established'})

CREATE (ir)-[:HAS_STAGE]->(ir1)
CREATE (ir)-[:HAS_STAGE]->(ir2)
CREATE (ir)-[:HAS_STAGE]->(ir3)
CREATE (ir)-[:HAS_STAGE]->(ir4)

CREATE (ir1)-[:LEADS_TO]->(ir2)
CREATE (ir2)-[:LEADS_TO]->(ir3)
CREATE (ir3)-[:LEADS_TO]->(ir4)

// Connect frameworks to their readiness stages
MATCH (fdd:Framework {name: 'Financial Due Diligence Framework'})
CREATE (fdd)-[:APPLIED_IN_STAGE]->(ir1)

MATCH (ldd:Framework {name: 'Legal Due Diligence Framework'})
CREATE (ldd)-[:APPLIED_IN_STAGE]->(ir2)

MATCH (ipdd:Framework {name: 'IP Due Diligence Framework'})
CREATE (ipdd)-[:APPLIED_IN_STAGE]->(ir3)

MATCH (esg:Framework {name: 'ESG Due Diligence Framework'})
CREATE (esg)-[:APPLIED_IN_STAGE]->(ir4)
```

---

## Ingestion Summary

### Node Count (new)

| Label | Count | Examples |
|-------|-------|---------|
| Framework | 5 | Legal DD, IP DD, Financial DD, ESG DD, ESG Materiality |
| Stage | 17 | Revenue Quality Test, Legal Information Gathering, ESG Context... |
| ProcessStep | 38 | Corporate Good Standing Verification, Cohort Retention Analysis... |
| Technique | 10 | Prior Art Three-Stream Search, LTV-CAC Ratio Analysis, CSRD... |
| Concept (RedFlag) | 5 | Recurring Non-Recurring Charges, Revenue Before Cash... |
| DictionaryTerm | 13 | Quality of Earnings, Freedom to Operate, Double Materiality... |
| DataRoomSection | 2 | financial_model, governance_esg |
| Phase | 1 | Investment Readiness - Due Diligence Preparation |
| **TOTAL NEW NODES** | **~91** | |

### Relationship Count (new)

| Type | Count | Purpose |
|------|-------|---------|
| LEADS_TO | ~45 | Sequential chains within stages and between stages |
| HAS_STEP | ~30 | Stage → ProcessStep containment |
| HAS_STAGE | ~17 | Framework/Phase → Stage containment |
| EQUIPS_WITH | ~8 | Framework → Technique |
| DEFINES | ~13 | Framework → DictionaryTerm |
| VALIDATES | ~5 | New DD Frameworks → Triple Validation Concepts |
| COMPLEMENTS | ~5 | New DD Frameworks ↔ Existing Frameworks |
| REVEALS | ~5 | Financial DD → Red Flag Concepts |
| ENABLES | ~2 | Framework → Stage cross-connections |
| MEASURES | ~3 | Framework → WorthinessCriteria |
| ADDRESSES_PROBLEM_TYPE | ~4 | Framework → ProblemType routing |
| FILED_IN | ~3 | Framework → DataRoomSection |
| APPLIED_IN_STAGE | ~4 | Framework → Investment Readiness Stage |
| LOOPS_TO | ~1 | Investment Readiness → Is It Worth It? |
| **TOTAL NEW RELS** | **~145** | |

### What This Enables

After ingestion, the Brain can:

1. **Route by venture stage**: When room state shows "Build financial projections" → Brain recommends Financial DD Framework → QoE stages
2. **Chain frameworks**: JTBD → validates problem → Business Model Canvas → validates model → **Financial DD → validates the numbers** → Investment Readiness
3. **Detect contradictions**: If financial-model/ shows 30% growth but market-analysis/ shows declining TAM → Red Flag: Revenue Before Cash Collection
4. **Grade investment readiness**: Score each of the 4 readiness stages (Financial, Legal, IP, Governance) — missing stages surface as gaps
5. **Loop back**: If Legal DD reveals IP chain of title issues → LOOPS_TO → "Can We Win?" requires re-assessment

---

## Execution Order

1. Run Domain 1 (Legal/IP) — 35 nodes, 55 rels
2. Run Domain 2 (Financial) — 30 nodes, 50 rels
3. Run Domain 3 (ESG) — 20 nodes, 30 rels
4. Run Domain 4 (Cross-Domain) — 6 nodes, 15 rels (depends on 1-3)
5. Verify with: `MATCH (f:Framework) WHERE f.name CONTAINS 'Due Diligence' RETURN f.name`

Run domains 1-3 in any order. Domain 4 MUST run last.
