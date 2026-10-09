// ========================================
// GENESIS EXPERT PERSONA PANEL v1.1 (2026 revision)
// IP-Finance Innovation Engine Experts
// BONO Framework Integration
//
// READ FIRST. This panel is CASE-SPECIFIC and SCRIPTED. Each hat returns text
// pre-written for one project (IP-backed credit scoring); generate() inserts the
// question only in the first line. Nothing is searched or computed, the Blue hat
// does not derive a consensus from the other hats, and every figure below comes
// from the author's notes and is UNVERIFIED (see ExpertPanel.claims). Treat the
// output as a labelled set of working hypotheses and prompts for research, never
// as findings or as words from real experts.
// ========================================

const ExpertPanel = {

    // ============================================
    // CLAIM REGISTRY: every figure used in the scripted texts
    // status 'unverified' = taken from author notes, not checked against the cited source
    // ============================================
    claims: [
        { id: 'C1', text: 'Companies with valuable IP portfolios are 44 times less likely to default', cited: 'none given', status: 'unverified', note: 'No source, sample or definition of "valuable". Needs independent replication before any use.' },
        { id: 'C2', text: 'Intangibles were 17% (1975), 68% (1995), 90% (2020) of S&P 500 market value', cited: 'Ocean Tomo', status: 'unverified', note: 'Widely quoted; confirm the edition and the definition of market value.' },
        { id: 'C3', text: '79% of intangible value is not in financial statements', cited: 'Brand Finance', status: 'unverified', note: 'The companion persona document also says "only 21% is captured", a different statement (global vs S&P 500). Do not mix them.' },
        { id: 'C4', text: 'Global IP financing $22.4B (2023) to $75.4B (2031) at 15.5% CAGR', cited: 'market report, not named', status: 'unverified', note: 'Internal check: 22.4 to 75.4 over 8 years is 16.4% a year, not 15.5%. The base year or end value is likely different.' },
        { id: 'C5', text: 'China IP-backed loans about 500B yuan (about $69B) by 2023', cited: 'not named', status: 'unverified', note: '' },
        { id: 'C6', text: 'Japan IP Business Valuation: 154 loans, JPY 7.83B by 2022', cited: 'not named', status: 'unverified', note: '' },
        { id: 'C7', text: 'Singapore IP Financing Scheme: S$100M capacity, 3 banks', cited: 'not named', status: 'unverified', note: '' },
        { id: 'C8', text: 'GII 2025: Israel 14th with "2x IP leverage"; Singapore 5th', cited: 'Global Innovation Index', status: 'unverified', note: 'Ranks are checkable; the 2x leverage figure has no stated method.' },
        { id: 'C9', text: 'US R&D investment $823B', cited: 'not named', status: 'unverified', note: '' },
        { id: 'C10', text: 'US corporate debt about $10 trillion; IP finance under 1% of potential', cited: 'not named', status: 'unverified', note: '"Potential" is undefined.' },
        { id: 'C11', text: 'AI credit models improve default prediction by 15-25%', cited: 'not named', status: 'unverified', note: 'Typically vendor or survey claims; depends on baseline and data.' }
    ],

    // Set to true to silence progress logging (tests, library use).
    silent: false,

    log: function(...args) {
        if (!ExpertPanel.silent) console.log(...args);
    },
    
    // ============================================
    // EXPERT DEFINITIONS
    // ============================================
    
    experts: {
        
        //  YELLOW HAT - Benefits & Opportunities
        YELLOW: {
            title: "IP-Portfolio",
            surname: "Strategy-Coherence",
            fullName: "IP-Portfolio Strategy-Coherence",
            hat: "YELLOW",
            hatEmoji: "💛",
            role: "Benefits & Opportunities",
            
            domain: "Intellectual Property Strategy",
            subdomains: [
                "Patent Portfolio Management & Optimization",
                "Strategic IP Alignment with Business Models",
                "IP Valuation Methodologies",
                "Competitive IP Intelligence",
                "Portfolio Coherence Assessment"
            ],
            
            perspective: "Identifies value creation potential and strategic advantages",
            
            keyPhrases: [
                "This portfolio reveals exceptional strategic coherence...",
                "The filing pattern demonstrates disciplined leadership...",
                "Citation velocity indicates growing industry recognition...",
                "This represents a significant untapped opportunity...",
                "The portfolio thesis shows that..."
            ],
            
            coreBeliefs: [
                "Portfolio analysis > Individual patent scoring",
                "IP patterns reveal management quality",
                "44x default advantage is massive opportunity",
                "Self-reinforcing innovation mechanism benefits all",
                "First-mover advantage in this space is significant"
            ],
            
            generate: (context) => {
                return `As IP-Portfolio Strategy-Coherence (Yellow Hat - Benefits, simulated AI perspective), examining ${context.topic}:

**OPPORTUNITIES IDENTIFIED:**

1. **Portfolio-Level Value Creation**
   The key insight is that analyzing portfolios reveals company quality, not just asset quality. We're measuring management discipline, strategic coherence, and innovation velocity - all indicators of credit strength.

2. **Claimed 44x Default Advantage [C1, UNVERIFIED]**
   The working claim is that companies with valuable IP portfolios are 44 times less likely to default. If it replicates, that is an order-of-magnitude effect and banks identifying these borrowers would gain a structural advantage. It has not been replicated here.

3. **Self-Reinforcing Mechanism**
   Better IP → Higher score → Better financing → More R&D capital → More innovation → Better IP
   This creates a virtuous cycle where profit motive aligns with innovation goals.

4. **Market Timing**
   Intangibles are reported at about 90% of S&P 500 value [C2, UNVERIFIED], but financial infrastructure may not have caught up. Whether a window exists is a hypothesis to test, not a finding.

**Hypothesis for the panel: the opportunity could be large if C1 holds. Evidence required before this is more than a hypothesis.**`;
            }
        },
        
        //  BLACK HAT - Risks & Critical Analysis
        BLACK: {
            title: "Credit-Risk",
            surname: "Banking-Collateral",
            fullName: "Credit-Risk Banking-Collateral",
            hat: "BLACK",
            hatEmoji: "🖤",
            role: "Risks & Critical Analysis",
            
            domain: "Credit Risk Analysis",
            subdomains: [
                "Default Probability Modeling",
                "Collateral Valuation & Recovery",
                "Bank Capital Requirements (Basel)",
                "Credit Committee Processes",
                "Loan Portfolio Risk Management"
            ],
            
            perspective: "Identifies risks, challenges, and what could go wrong",
            
            keyPhrases: [
                "What happens when the borrower defaults?",
                "The regulatory capital treatment remains unclear...",
                "How do we validate against actual defaults?",
                "Credit committee will ask about recovery...",
                "This needs stress-testing against downturns..."
            ],
            
            coreBeliefs: [
                "Collateral must be recoverable in default",
                "Regulatory approval is essential, not optional",
                "Validation requires real default data",
                "Credit officers need defensible positions",
                "Risks aren't blockers - they're design requirements"
            ],
            
            generate: (context) => {
                return `As Credit-Risk Banking-Collateral (Black Hat - Risks, simulated AI perspective), examining ${context.topic}:

**CRITICAL CONCERNS:**

1. **The Collateral Recovery Problem**
   IP is fundamentally different from tangible collateral. When a borrower defaults:
   - How do we seize and liquidate patents?
   - Who's the buyer in a distressed sale?
   - IP value is tied to the company - may evaporate at default
   - Secondary markets are thin or non-existent

2. **Validation Requirements**
   - The 44x claim [C1] needs independent replication
   - What's the sample size and selection criteria?
   - Survivorship bias risk in historical data
   - Technology cycles may invalidate past correlations

3. **Regulatory & Operational Risks**
   - Basel treatment of IP collateral is undefined
   - Bank capital reserves unclear
   - Credit committee unfamiliarity creates friction
   - Internal model approval is lengthy process

4. **Value Volatility**
   - Patent litigation can destroy value overnight
   - Technology obsolescence creates cliff risk
   - Competitor innovations can erode positioning
   - Patent expiration is predictable but often ignored

**These are open risks to specify and test, not verdicts.**`;
            }
        },
        
        //  WHITE HAT - Facts & Data
        WHITE: {
            title: "Innovation-Economics",
            surname: "National-Competitiveness",
            fullName: "Innovation-Economics National-Competitiveness",
            hat: "WHITE",
            hatEmoji: "🤍",
            role: "Facts & Data",
            
            domain: "Innovation Economics",
            subdomains: [
                "National Innovation Systems",
                "R&D Investment Analysis",
                "Knowledge Economy Metrics",
                "Global Innovation Index",
                "Technology Transfer Economics"
            ],
            
            perspective: "Provides objective, sourced data without interpretation",
            
            keyPhrases: [
                "The data shows that...",
                "According to the Global Innovation Index...",
                "WIPO reports indicate...",
                "The trend line demonstrates...",
                "Empirically, we observe..."
            ],
            
            coreBeliefs: [
                "Data should be presented without advocacy",
                "Sources must be cited",
                "Gaps in data should be acknowledged",
                "Quantification enables comparison",
                "Facts are the foundation for all hats"
            ],
            
            generate: (context) => {
                return `As Innovation-Economics National-Competitiveness (White Hat - Facts, as cited by the author; unverified), examining ${context.topic}:

**OBJECTIVE DATA:**

1. **Intangible Asset Market Value (Ocean Tomo)**
   - 1975: 17% of S&P 500 [C2, UNVERIFIED]
   - 1995: 68% of S&P 500 [C2, UNVERIFIED]
   - 2020: 90% of S&P 500 [C2, UNVERIFIED]
   - 79% of intangible value unaccounted in financial statements (Brand Finance) [C3, UNVERIFIED]

2. **IP Finance Market Size**
   - Global IP Financing: $22.4B (2023) to $75.4B (2031) at 15.5% CAGR [C4, UNVERIFIED; the stated endpoints imply 16.4%]
   - China IP-backed loans: ~500B yuan (~$69B) by 2023 [C5, UNVERIFIED]
   - Japan IP Business Valuation: 154 loans, JPY 7.83B by 2022 [C6, UNVERIFIED]
   - Singapore IP Financing Scheme: S$100M capacity, 3 banks participating [C7, UNVERIFIED]

3. **Innovation Rankings (GII 2025)**
   - Israel: 14th globally, 2x IP leverage vs global average [C8, UNVERIFIED]
   - Singapore: 5th, leads in Unicorn valuation [C8, UNVERIFIED]
   - US: $823B R&D investment (largest globally) [C9, UNVERIFIED]

4. **Market Gap Analysis**
   - US corporate debt market: ~$10 trillion [C10, UNVERIFIED]
   - IP finance represents <1% of theoretical potential [C10, UNVERIFIED; "potential" undefined]
   - AI credit models improve default prediction by 15-25% [C11, UNVERIFIED]

**All figures above are taken from author notes and are UNVERIFIED (see ExpertPanel.claims).**

**DATA GAPS REQUIRING RESEARCH:**
- Independent validation of 44x default claim
- Recovery rates for IP-backed loan defaults
- Basel working group positions on IP collateral`;
            }
        },
        
        //  GREEN HAT - Creative Solutions
        GREEN: {
            title: "FinTech-Infrastructure",
            surname: "AI-Credit-Systems",
            fullName: "FinTech-Infrastructure AI-Credit-Systems",
            hat: "GREEN",
            hatEmoji: "💚",
            role: "Creative Solutions",
            
            domain: "Financial Technology Infrastructure",
            subdomains: [
                "AI/ML Credit Scoring Systems",
                "Alternative Data Integration",
                "Explainable AI (XAI)",
                "Real-time Risk Monitoring",
                "API-First Architecture"
            ],
            
            perspective: "Generates innovative solutions and alternatives",
            
            keyPhrases: [
                "What if we built a system that...",
                "We could leverage graph algorithms to...",
                "The architecture pattern would be...",
                "Imagine combining X with Y...",
                "This is a classic data engineering problem..."
            ],
            
            coreBeliefs: [
                "Technical problems have technical solutions",
                "Systems thinking enables scale",
                "Explainability is architecture, not afterthought",
                "MVPs enable iteration",
                "Build for scale from day one"
            ],
            
            generate: (context) => {
                return `As FinTech-Infrastructure AI-Credit-Systems (Green Hat - Creative, simulated AI perspective), examining ${context.topic}:

**SOLUTION PROPOSALS:**

1. **Graph-Based Portfolio Analysis Engine**
   \`\`\`
   Neo4j Knowledge Graph:
   ├── Nodes: Patents, Companies, Inventors, Technologies
   ├── Edges: Cites, Owns, Invented, Competes, Licenses
   └── Properties: Dates, Values, Scores, Classifications
   
   Algorithms:
   ├── PageRank for citation influence
   ├── Community detection for technology clustering
   ├── Path analysis for competitive positioning
   └── Temporal patterns for velocity calculation
   \`\`\`

2. **LLM-Powered Explainability Engine**
   - Input: Portfolio metrics, peer data, trend analysis
   - Process: Template-guided narrative with evidence assembly
   - Output: Credit memo-ready narrative
   - Key: SHAP + LIME for feature attribution

3. **Continuous Monitoring Architecture**
   \`\`\`
   Event-Driven Triggers:
   ├── New patent filings → velocity update
   ├── Patent expirations → cliff risk alert
   ├── Litigation events → value impact assessment
   ├── Inventor departures → talent risk flag
   └── Competitor filings → positioning recalculation
   \`\`\`

4. **Adoption Wedge Strategy**
   - Start: Monitoring service (low commitment)
   - Expand: Supplementary scoring (de-risk adoption)
   - Scale: Primary underwriting (full integration)

**ALTERNATIVE APPROACHES:**
- IP tokenization for liquidity creation
- IP bonds/CDOs to bypass accounting standards
- Insurance-backed guarantee mechanism`;
            }
        },
        
        //  RED HAT - Intuitions & Human Factors
        RED: {
            title: "Policy-Regulation",
            surname: "Adoption-Barriers",
            fullName: "Policy-Regulation Adoption-Barriers",
            hat: "RED",
            hatEmoji: "❤️",
            role: "Intuitions & Human Factors",
            
            domain: "Financial Policy & Regulation",
            subdomains: [
                "Banking Regulatory Frameworks",
                "Accounting Standards Evolution",
                "Technology Adoption Psychology",
                "Stakeholder Change Management",
                "Cross-jurisdictional Coordination"
            ],
            
            perspective: "Shares intuitions about adoption and human dynamics",
            
            keyPhrases: [
                "My gut feeling is...",
                "I sense that stakeholders will...",
                "The emotional barrier here is...",
                "Intuitively, the resistance comes from...",
                "Something tells me the real issue is..."
            ],
            
            coreBeliefs: [
                "Adoption is emotional, not just rational",
                "Fear of looking foolish drives conservatism",
                "Trust must be earned through small wins",
                "Political dynamics shape possibilities",
                "Timing matters as much as quality"
            ],
            
            generate: (context) => {
                return `As Policy-Regulation Adoption-Barriers (Red Hat - Intuitions, simulated AI perspective), examining ${context.topic}:

**INTUITIVE ASSESSMENTS:**

1. **Bank Officer Psychology**
   A hypothesis (simulated intuition, not an interview result): traditional bankers may be deeply skeptical. They've built careers on tangible collateral - property they can see and touch. IP feels like 'air' to them. The emotional barrier isn't ignorance - it's fear of looking foolish if it fails.

2. **Regulatory Hesitation**
   I sense regulators will move slowly - not from obstruction, but from caution. They fear being blamed if an IP-backed portfolio blows up. They need cover: successful implementations elsewhere, academic validation, industry association support.

3. **Explainability is Emotional**
   The 'why' narrative isn't really about technical transparency - it's about giving the loan officer a story they can believe in and defend to their committee. It's emotional safety, not just regulatory compliance.

4. **Trust Building Sequence**
   Something tells me: one bank, one success, one case study. Then two banks see it works. Then three. Then regulators feel safe to codify. Trying to scale before trust is built will trigger immune response.

5. **Timing Sense**
   The window feels right now:
   - Post-pandemic capital seeking returns
   - ESG fatigue creating space for 'innovation' narratives
   - AI hype making 'intelligent credit' palatable
   - But windows close - urgency is real

6. **Israel Feels Right**
   Intuitively, Israel is the right pilot - small enough to matter, sophisticated enough to appreciate innovation, connected to global finance. Singapore will want to see Israel succeed first.

**These are simulated intuitions. They mark questions to test with real stakeholders; they are not evidence.**`;
            }
        },
        
        //  BLUE HAT - Process Control
        BLUE: {
            title: "Integration",
            surname: "Synthesis",
            fullName: "Integration Synthesis",
            hat: "BLUE",
            hatEmoji: "💙",
            role: "Process Control & Consolidation",
            
            domain: "Process Orchestration",
            subdomains: [
                "Debate Facilitation",
                "Perspective Synthesis",
                "Consensus Building",
                "Action Item Generation",
                "Meta-cognitive Oversight"
            ],
            
            perspective: "Manages process and synthesizes conclusions",
            
            keyPhrases: [
                "Let us now hear from...",
                "To synthesize what we've heard...",
                "The panel has identified a tension between...",
                "Moving forward, the priorities are...",
                "We have reached consensus on..."
            ],
            
            // Consolidates what the run actually produced. The pre-written convergence and tension
            // lists of v1.0 asserted "actionable consensus" regardless of the contributions;
            // they are now shown as the author's working hypotheses, separately labelled.
            synthesize: (contributions) => {
                const list = Array.isArray(contributions) ? contributions : [];
                const present = list.map(c => c.hat);
                const allHats = ['WHITE', 'RED', 'YELLOW', 'BLACK', 'GREEN'];
                const missing = allHats.filter(h => !present.includes(h));
                const citedClaims = new Set();
                list.forEach(c => {
                    (String(c.content).match(/\[C\d+/g) || []).forEach(m => citedClaims.add(m.slice(1)));
                });
                return `As Integration Synthesis (Blue Hat - Process), consolidating the panel discussion:

**WHAT THIS RUN CONTAINS:**
- Perspectives present: ${present.length ? present.join(', ') : 'none'}
- Perspectives missing: ${missing.length ? missing.join(', ') : 'none'}
- Claims cited in the texts: ${citedClaims.size ? Array.from(citedClaims).sort().join(', ') : 'none'}; all are UNVERIFIED
- No consensus is computed. The panel is scripted, so agreement between hats is not evidence of anything.

**AUTHOR'S WORKING HYPOTHESES (pre-written for the IP Credit Scoring case, not derived from this run):**
- Opportunity: intangible value is large and may be poorly recognized by credit infrastructure (depends on C2, C3)
- The default advantage (C1) is the load-bearing claim and is unreplicated
- Explainability may matter for adoption
- A small pilot market may be a sensible place to start (open question)

**PRODUCTIVE TENSIONS TO TEST:**
- Analytical sophistication (Yellow, Green) vs adoption reality (Red, Black)
- Speed to market vs validation rigor
- Technical completeness vs minimum viable iteration

**CANDIDATE NEXT STEPS (template; owners are the author's suggestions):**
| Priority | Action | Suggested owner |
|----------|--------|-----------------|
| 1 | Methodology documentation | Jonathan + Yu Sarn |
| 2 | Test company selection | Yu Sarn |
| 3 | Graph database prototype | Technical team |
| 4 | Explainability templates | Jonathan |
| 5 | Israel connection meeting | Yishay |

**NEXT DEBATE QUESTION:**
"How do we validate the 44x claim [C1] with available data while keeping the pilot question open?"`;
            }
        }
    },

    // ============================================
    // DEBATE ORCHESTRATION
    // ============================================
    
    sequences: {
        innovation: ['BLUE', 'WHITE', 'RED', 'GREEN', 'YELLOW', 'BLACK', 'BLUE'],
        strategic: ['BLUE', 'WHITE', 'BLACK', 'YELLOW', 'GREEN', 'RED', 'BLUE'],
        crisis: ['BLUE', 'RED', 'WHITE', 'BLACK', 'YELLOW', 'GREEN', 'BLUE'],
        riskAssessment: ['BLUE', 'WHITE', 'BLACK', 'RED', 'YELLOW', 'GREEN', 'BLUE']
    },
    
    runDebate: async function(question, context, sequenceType = 'innovation') {
        if (typeof question !== 'string' || !question.trim()) {
            throw new TypeError("question must be a non-empty string");
        }
        const sequence = this.sequences[sequenceType];
        if (!sequence) {
            throw new RangeError("Unknown sequenceType '" + sequenceType + "'. Use one of: " + Object.keys(this.sequences).join(', '));
        }
        const contributions = [];
        const log = ExpertPanel.log;
        
        log("\n" + "=".repeat(70));
        log("EXPERT PANEL DEBATE (scripted, simulated perspectives)");
        log("=".repeat(70));
        log(`\nQuestion: ${question}`);
        log(`Sequence: ${sequenceType.toUpperCase()}`);
        log("-".repeat(70) + "\n");
        
        for (const hatColor of sequence) {
            const expert = this.experts[hatColor];
            
            log(`\n${expert.hat} HAT: ${expert.fullName}`);
            log(`   Role: ${expert.role}`);
            log("-".repeat(50));
            
            if (hatColor === 'BLUE' && contributions.length > 0) {
                // Final Blue Hat synthesis
                const synthesis = expert.synthesize(contributions);
                log(synthesis);
                contributions.push({ hat: hatColor, content: synthesis });
            } else if (hatColor === 'BLUE') {
                // Opening Blue Hat
                log(`\nThe question before us: ${question}\n`);
                log("Let us proceed systematically through each perspective.\n");
            } else {
                // Generate perspective
                const response = expert.generate({ topic: question, context: context });
                log(response);
                contributions.push({ hat: hatColor, content: response });
            }
        }
        
        log("\n" + "=".repeat(70));
        log("DEBATE CONCLUDED");
        log("=".repeat(70) + "\n");

        // additive: array property, ignored by JSON.stringify and by existing array consumers
        contributions.provenance = {
            module: 'GenesisExpertPanel_IPFinance',
            version: '1.1',
            sequenceType,
            scripted: true,
            claimsUnverified: ExpertPanel.claims.length,
            generatedAt: new Date().toISOString()
        };
        return contributions;
    },
    
    // Get single expert perspective
    consult: function(hatColor, question, context = {}) {
        if (typeof hatColor !== 'string') {
            throw new TypeError("hatColor must be a string");
        }
        const expert = this.experts[hatColor.toUpperCase()];
        if (!expert) {
            throw new Error(`Unknown hat color: ${hatColor}`);
        }
        if (typeof expert.generate !== 'function') {
            throw new Error(`The ${expert.hat} hat only consolidates; use runDebate()`);
        }
        return expert.generate({ topic: question, context: context });
    },
    
    // List all experts
    listExperts: function() {
        return Object.values(this.experts).map(e => ({
            hat: e.hat,
            emoji: e.hatEmoji,
            name: e.fullName,
            role: e.role,
            domain: e.domain
        }));
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExpertPanel;
}

// ============================================
// DEMONSTRATION (only when run directly with node)
// ============================================

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    console.log("\nIP-FINANCE EXPERT PANEL - DEMONSTRATION (scripted; claims unverified)\n");
    console.log("Experts:");
    ExpertPanel.listExperts().forEach(e => {
        console.log(`  ${e.hat} ${e.name} - ${e.role}`);
    });
    
    console.log("\n" + "-".repeat(50) + "\n");
    console.log("Running debate on: 'How should we architect the IP Credit Scoring system?'\n");
    
    ExpertPanel.runDebate(
        "How should we architect the IP Credit Scoring system to achieve both analytical accuracy AND bank adoption?",
        { market: "Israel pilot", stage: "initial design" },
        "innovation"
    ).catch(err => {
        console.error("Demo failed:", err.message);
        process.exitCode = 1;
    });
}
