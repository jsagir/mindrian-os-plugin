# Research 09: Self-DD Gap Analysis - Neo4j Brain vs Self-DD Document

> **Date:** 2026-03-27
> **Purpose:** Room-by-room mapping of what Neo4j already holds vs what the Self-DD document contributes, identifying coverage gaps

---

## The Organizing Spine: Mullins/PWS Triple Validation Compass

The Neo4j graph already has the master framework for the entire Self-DD. The Triple Validation Compass chains through three phases with LEADS_TO and LOOPS_TO:

```
Phase 1: "Is It Real?" - Problem Validation
  Stage: Opportunity Discovery
    - Define Domain and Sub-Domain
    - Identify Trends to Exploit
    - Identify Reverse Salients
    - Craft Well-Defined Problem Statement
  Stage: Problem Validation
    - Five Ws Analysis
    - Stakeholder Mapping
    - Jobs-to-Be-Done Analysis
    - Gather Validation Evidence
    - Problem Reality Decision Gate

Phase 2: "Can We Win?" - Solution Feasibility
  Stage: Team & Advantage Assessment
    - Team Overview & Domain Coverage
    - Gap Analysis & Fill Plan
    - Define Unfair Advantage
    - Competitive Landscape Analysis
  Stage: Solution Design & Feasibility
    - Solution Visualization
    - Feasibility & Build Plan
  LOOPS_TO -> Phase 1

Phase 3: "Is It Worth It?" - Business Case
  Stage: Market & Business Case Development
    - Value Exchange Mapping
    - Willingness to Pay Evidence
    - Return & Justification Analysis
    - Strategic Fit Assessment
  Stage: Synthesis & Final Decision
    - Craft Value Proposition Statement
    - Create Story Example
    - Final PWS Assessment
  LOOPS_TO -> Phase 2
```

After ingestion (2026-03-28), a 4th phase was added:

```
Phase 4: "Investment Readiness" - Due Diligence Preparation (NEW)
  Stage: Financial Readiness
  Stage: Legal Readiness
  Stage: IP Readiness
  Stage: Governance Readiness
  LOOPS_TO -> Phase 3
```

---

## Room-by-Room Coverage

### problem-definition/

| Neo4j Coverage | Self-DD Coverage | Winner |
|---|---|---|
| **RICH** | WEAK | **Neo4j** |

**What Neo4j has:**
- 18 ProblemType nodes (Undefined, Ill-Defined, Well-Defined, Wicked + compound types)
- 5-stage InnovationStage chain (Problem Exploration -> Framing -> Validation -> Solution Hypothesis -> Business Case)
- Beautiful Question Framework -> ADDRESSES_PROBLEM_TYPE -> Undefined Problem
- Cynefin Framework -> ADDRESSES_PROBLEM_TYPE -> Wicked Problem
- Knowns and Unknowns Matrix Framework
- Root Cause Analysis -> 6 problem types (Recurring Failure, Quality Defect, System Failure, etc.)
- 5 Whys, Fishbone (Ishikawa) -> Ill-Defined Problems
- Minto Pyramid: Situation -> Complication -> structured argument
- Wicked Problem Decomposition -> Ill-Defined Problem
- Problem Validation steps: Five Ws, Stakeholder Mapping, JTBD, Gather Evidence, Decision Gate

**What Self-DD has:** Almost nothing. The document starts at fundraising, not problem definition.

---

### market-analysis/

| Neo4j Coverage | Self-DD Coverage | Winner |
|---|---|---|
| **RICH** (why frameworks) | GOOD (what metrics) | Both needed |

**Neo4j has:**
- JTBD framework with full process chain + 3 dimensions (Functional, Emotional, Social Progress)
- JTBD-PWS Integration SystemMap with feedback loops and leverage points
- Trending to the Absurd framework + workshop
- S-Curve Analysis (InnovationTool + Concept + KeyConcept)
- Scenario Planning -> Undefined Problem, full 5-step chain
- Oracle Foresight Engine
- TAM/SAM/SOM concepts
- Dominant Design analysis (switching costs, weakness signals, S-curves)
- Domain Selection framework
- PESTLE/STEEP techniques

**Self-DD adds:**
- Cohort analysis mechanics (LTV/CAC/NRR formulas)
- Burn multiple, Rule of 40 calculations
- KPI dashboard templates
- Top-down vs bottom-up market sizing methodology
- SOM validation against CAC constraints and sales capacity

---

### competitive-analysis/

| Neo4j Coverage | Self-DD Coverage | Winner |
|---|---|---|
| GOOD (strategic) | GOOD (tactical) | Both needed |

**Neo4j has:**
- Porter's Five Forces (Entity)
- Competitive Landscape Analysis (Technique) -> LEADS_TO -> Solution Visualization
- SWOT Analysis (Technique)
- Sustaining vs Disruptive Innovation (Framework, Christensen)
- Changing Terms of Competition (Framework)
- Four Lenses of Innovation (Framework)
- Black Hat Analysis - adversarial thinking
- "Can We Win?" stage with steps
- Reverse Salient mapping

**Self-DD adds:**
- G2/Capterra/Trustpilot review scraping methodology
- LinkedIn hiring post analysis (competitor strategy signals)
- Wappalyzer/BuiltWith tech stack reverse engineering
- Website snapshot archiving for messaging evolution
- Competitor folder-per-competitor template structure

---

### business-model/

| Neo4j Coverage | Self-DD Coverage | Winner |
|---|---|---|
| GOOD (validation logic) | GOOD (financial templates) | Both needed |

**Neo4j has:**
- Business Model Canvas (Technique) -> APPLIED_IN_STAGE -> Solution Hypothesis
- Lean Canvas (Concept)
- Osterwalder (Person) + Business Model Generation
- Value Proposition Design (Technique)
- Mullins Model Validation -> used by Well-Defined Problem
- "Is It Worth It?" phase: Value Exchange Mapping, Willingness to Pay, Return & Justification, Strategic Fit
- WorthinessCriteria: Market Size, Impact Potential, Solvability, Future Urgency, Expertise Match

**Self-DD adds:**
- Unit economics formulas (LTV/CAC/payback period)
- Pricing strategy A/B test templates
- Revenue stream validation templates
- Moat analysis framework (network effects, switching costs, data moat)

---

### solution-design/

| Neo4j Coverage | Self-DD Coverage | Winner |
|---|---|---|
| **VERY RICH** (408 entities) | GOOD (tech DD checklists) | Different layers |

**Neo4j has:**
- Systems Thinking -> Wicked Problem
- Process Mapping -> ENABLES -> Making the Invisible Visible
- User Journey Mapping, COMPLEMENTS JTBD
- Design Thinking, Six Thinking Hats (all 6 as separate nodes)
- Solution Visualization + Feasibility & Build Plan (ProcessSteps)
- Stock and Flow Diagrams, Causal Loop Diagramming
- HSI Semantic Surprise Analysis
- Usher's Cumulative Synthesis
- How Might We Framework

**Self-DD adds:**
- SBOM methodology (Software Bill of Materials)
- Supply chain security assessment (post-SolarWinds)
- DevOps maturity model (CI/CD, IaC, canary/blue-green)
- Scalability SLOs under 10x load
- OWASP security audit framework

**Key distinction:** Neo4j = "should we build this?" Self-DD = "was it built right?"

---

### team/

| Neo4j Coverage | Self-DD Coverage | Winner |
|---|---|---|
| GOOD (capability assessment) | GOOD (HR legal) | Different layers |

**Neo4j has:**
- Team & Advantage Assessment stage (4 steps)
- 11 leadership frameworks (Adaptive, Authentic, Distributed, Emotional Intelligence, Engineering Ethics, Servant, Situational, Systems, Strategic Decision Making, Transformational, Communication)
- Tuckman Team Stages
- Psychological Safety -> ENABLES -> High-Performing Teams
- Safe Fail Culture
- Expertise Match (WorthinessCriteria)
- Stakeholder Analysis (Technique)

**Self-DD adds:**
- Employment contract review methodology
- Worker misclassification risk assessment
- Compensation benchmarking framework
- Key talent retention / flight risk scoring (3-5 critical people)
- Culture fit assessment methodology
- HRIS/GDPR compliance checklist

---

### legal-ip/ (MAJOR GAP)

| Neo4j Coverage | Self-DD Coverage | Winner |
|---|---|---|
| **WEAK** (10 entities) | **VERY RICH** | **Self-DD** |

**Neo4j had (pre-ingestion):** 10 entities filed, no structured methodology

**Self-DD has (now ingested):**
- Prior art 3-stream search methodology (USPTO, EPO, NPL)
- Freedom to Operate (FTO) opinion framework
- Relevance matrix (prior art vs claim elements)
- Legal DD methodology (Debevoise & Plimpton risk-tiered work plan)
- 5-part litigation search
- Corporate good standing verification chain
- IP assignment chain audit
- Open source license risk review (SBOM)

**Status after ingestion:** Gap closed. Legal DD Framework + IP DD Framework with full stage/step chains now in Neo4j.

---

### financial-model/ (MAJOR GAP)

| Neo4j Coverage | Self-DD Coverage | Winner |
|---|---|---|
| **WEAK** (market sizing only) | **VERY RICH** | **Self-DD** |

**Neo4j had (pre-ingestion):** Market Sizing & Financial Analysis technique, WorthinessCriteria, basic "Return & Justification Analysis" step

**Self-DD has (now ingested):**
- Quality of Earnings (QoE) full methodology
- 5-stage chain: Revenue Quality -> Expense Quality -> Proof of Cash -> EBITDA Bridge -> Working Capital
- 18 ProcessSteps across all stages
- 6 Techniques (LTV-CAC, Cohort Retention, Burn Multiple, Rule of 40, NRR, Vendor DD)
- 5 Red Flag concepts as first-class nodes
- 5 DictionaryTerms (QoE, Normalized EBITDA, Proof of Cash, Working Capital Target, Burn Multiple)

**Status after ingestion:** Gap closed. Financial DD Framework with QoE methodology now in Neo4j.

---

### governance/ESG (MAJOR GAP)

| Neo4j Coverage | Self-DD Coverage | Winner |
|---|---|---|
| **ABSENT** | GOOD | **Self-DD** |

**Neo4j had (pre-ingestion):** Nothing

**Self-DD has (now ingested):**
- ESG Due Diligence Framework (VentureESG 9-part)
- 9 assessment stages chained with LEADS_TO
- ESG Materiality Assessment framework (4 process steps)
- CSRD Compliance Assessment technique
- EU Taxonomy Alignment technique
- 4 DictionaryTerms (Materiality Assessment, Double Materiality, VentureESG, Social License)

**Status after ingestion:** Gap closed. ESG DD Framework with full 9-part assessment now in Neo4j.

---

### meetings/

| Neo4j Coverage | Self-DD Coverage | Winner |
|---|---|---|
| HAS (462 Session nodes) | **ABSENT** | **Neo4j** |

Self-DD document has no meeting layer. PWS/MindrianOS treats meetings as the primary knowledge source.

---

## Summary Table

| Room Section | Neo4j (pre) | Self-DD | Gap Status |
|---|---|---|---|
| problem-definition | RICH | WEAK | No gap - Neo4j authority |
| market-analysis | RICH | GOOD | Complementary - both needed |
| competitive-analysis | GOOD | GOOD | Complementary - both needed |
| business-model | GOOD | GOOD | Complementary - both needed |
| solution-design | VERY RICH | GOOD | Different layers (why vs how) |
| team | GOOD | GOOD | Different layers (capability vs HR legal) |
| **legal-ip** | **WEAK** | **VERY RICH** | **CLOSED** (2026-03-28 ingestion) |
| **financial-model** | **WEAK** | **VERY RICH** | **CLOSED** (2026-03-28 ingestion) |
| **governance/ESG** | **ABSENT** | **GOOD** | **CLOSED** (2026-03-28 ingestion) |
| meetings | HAS | ABSENT | No gap - Neo4j authority |

---

## Ingestion Results (2026-03-28)

**91 new nodes** ingested across 4 domains:
- 5 Frameworks (Legal DD, IP DD, Financial DD, ESG DD, ESG Materiality)
- 1 Phase (Investment Readiness - extends Triple Validation)
- 22 Stages
- 36 ProcessSteps
- 12 Techniques
- 5 Red Flag Concepts
- 14 DictionaryTerms
- 2 DataRoomSections

**~145 new relationships** including:
- VALIDATES connections to Triple Validation (Is it Real? / Can We Win? / Is it Worth It?)
- COMPLEMENTS connections to BMC, Reverse Salient, Systems Thinking, Stakeholder Analysis
- MEASURES connections to WorthinessCriteria
- ENABLES connections to existing stages
- Full LEADS_TO chains within all new frameworks

**Schema document:** `docs/SELF-DD-NEO4J-SCHEMA.md`

---

## What This Enables

1. **Stage-aware routing:** Room state "Build financial projections" -> Brain recommends Financial DD Framework -> QoE stages
2. **Framework chaining:** JTBD -> BMC -> Financial DD -> Investment Readiness (full lifecycle)
3. **Contradiction detection:** Financial projections vs market analysis -> Red Flag nodes fire
4. **Investment readiness scoring:** Grade each of 4 readiness stages as room gaps
5. **Regression support:** LOOPS_TO edges allow Investment Readiness to send ventures back to "Is It Worth It?" when DD reveals issues
