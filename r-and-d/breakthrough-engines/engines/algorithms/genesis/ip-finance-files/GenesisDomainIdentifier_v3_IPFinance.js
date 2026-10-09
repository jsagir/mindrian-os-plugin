// ========================================
// GENESIS DOMAIN IDENTIFIER v3.1 (2026 revision)
// Enhanced with IP-Finance Domain Detection
// Rule based: keyword lexicons per domain. Confidence is a hit-count heuristic
// (hits / 8), not a probability. Ties between domains go to the domain declared
// first in domainPatterns (deterministic). Ambiguous short acronyms (PD, PE, VC,
// CAR, SEP, ...) are matched case-sensitively in acronymPatterns.
// ========================================

const DomainIdentifier = {
    // Set to true to silence progress logging (tests, library use).
    silent: false,

    // useSecondaryDomains: also feed each segment's runner-up domains into
    // cross-domain synthesis detection. The original attached them
    // ("for synthesis detection") but never read them. Set false for old behaviour.
    options: { useSecondaryDomains: true },

    log: (...args) => {
        if (!DomainIdentifier.silent) console.log(...args);
    },

    // Identify domains from decomposed context
    identifyDomains: async (decomposition) => {
        DomainIdentifier.log("\nIdentifying expertise domains (v3.1 IP-Finance)\n");

        if (!decomposition || !Array.isArray(decomposition.segments)) {
            throw new TypeError("decomposition.segments must be an array (output of ContextDecomposer.analyzeContext)");
        }
        const methodologies = (decomposition.elements && Array.isArray(decomposition.elements.methodologies))
            ? decomposition.elements.methodologies : [];
        
        const domains = {
            primary: [],
            technical: [],
            adjacent: [],
            methodological: [],
            implementation: [],
            strategic: []  // NEW: Strategic/policy domains
        };
        
        // Analyze segments for domain indicators
        decomposition.segments.forEach((seg, idx) => {
            const domainAnalysis = DomainIdentifier.analyzeDomainIndicators(seg.text);
            
            DomainIdentifier.log(`Segment ${idx + 1} domain analysis:`, {
                domain: domainAnalysis.domain,
                confidence: domainAnalysis.confidence.toFixed(2),
                technical: domainAnalysis.technical,
                strategic: domainAnalysis.strategic || false
            });
            
            // Categorize domains with enhanced logic
            if (domainAnalysis.confidence > 0.7) {
                domains.primary.push(domainAnalysis);
            } else if (domainAnalysis.technical && domainAnalysis.confidence > 0.4) {
                domains.technical.push(domainAnalysis);
            } else if (domainAnalysis.strategic && domainAnalysis.confidence > 0.3) {
                domains.strategic.push(domainAnalysis);
            } else if (domainAnalysis.confidence > 0.2) {
                domains.adjacent.push(domainAnalysis);
            }
        });
        
        // Extract methodological domains from elements
        if (methodologies.length > 2) {
            domains.methodological.push({
                domain: 'Research-Methodology',
                indicators: methodologies,
                confidence: 0.6,
                technical: false
            });
        }
        
        // NEW: Detect cross-domain synthesis requirements
        const crossDomainSignals = DomainIdentifier.detectCrossDomainSynthesis(domains);
        if (crossDomainSignals.required) {
            domains.primary.push({
                domain: 'Cross-Domain-Integration',
                indicators: crossDomainSignals.bridgeTerms,
                confidence: crossDomainSignals.confidence,
                technical: false,
                strategic: true,
                synthesisRequirements: crossDomainSignals.requirements
            });
        }
        
        // Deduplicate and prioritize
        domains.primary = DomainIdentifier.deduplicateDomains(domains.primary);
        domains.technical = DomainIdentifier.deduplicateDomains(domains.technical);
        domains.adjacent = DomainIdentifier.deduplicateDomains(domains.adjacent);
        domains.strategic = DomainIdentifier.deduplicateDomains(domains.strategic);
        
        return domains;
    },
    
    // Analyze text for domain indicators - ENHANCED with IP-Finance
    analyzeDomainIndicators: (text) => {
        const domainPatterns = {
            // ============================================
            // ORIGINAL TECHNOLOGY DOMAINS (Enhanced)
            // ============================================
            'Machine-Learning': /\b(neural|network|training|model|dataset|classification|regression|deep learning|supervised|unsupervised|reinforcement|feature engineering|hyperparameter|epoch|batch size|gradient descent)\b/gi,
            'Quantum-Computing': /\b(quantum|qubit|superposition|entanglement|quantum gate|quantum circuit|decoherence|quantum algorithm|quantum advantage)\b/gi,
            'Blockchain': /\b(blockchain|cryptocurrency|smart contract|consensus|distributed ledger|mining|defi|web3|dao|tokenization)\b/gi,
            'Biotechnology': /\b(genetic|dna|rna|protein|cell|organism|crispr|sequencing|bioengineering|synthetic biology)\b/gi,
            'Data-Engineering': /\b(pipeline|etl|data lake|streaming|batch|processing|warehouse|kafka|spark|airflow)\b/gi,
            'Cybersecurity': /\b(security|encryption|vulnerability|threat|authentication|authorization|penetration|firewall|malware)\b/gi,
            'Cloud-Architecture': /\b(cloud|serverless|microservice|container|kubernetes|scaling|aws|azure|gcp|devops)\b/gi,
            'Natural-Language-Processing': /\b(natural language|nlp|tokenization|embedding|transformer|bert|gpt|sentiment|parsing|llm|large language model)\b/gi,
            'Robotics': /\b(robot|actuator|sensor|kinematics|control system|autonomous|navigation|manipulation)\b/gi,
            'Computer-Vision': /\b(vision|image|video|cnn|detection|segmentation|recognition|opencv|yolo)\b/gi,
            'IoT': /\b(iot|sensor|edge computing|mqtt|embedded|arduino|raspberry|telemetry)\b/gi,
            'AR-VR': /\b(augmented reality|virtual reality|mixed reality|metaverse|oculus|hololens)\b/gi,
            'DevOps': /\b(ci\/cd|continuous integration|deployment|docker|jenkins|gitlab|monitoring|infrastructure as code)\b/gi,
            
            // ============================================
            // NEW: INTELLECTUAL PROPERTY DOMAINS
            // ============================================
            'Intellectual-Property-Strategy': /\b(intellectual property|ip strategy|ip portfolio|patent portfolio|patent strategy|ip management|ip rights|ip protection|ip assets|ip valuation|patent valuation|ip monetization|licensing|royalty|trade secret|proprietary|ip landscape|freedom to operate|patent mapping|white space analysis|patent wall|patent thicket|ip due diligence)\b/gi,
            
            'Patent-Analytics': /\b(patent analytics|patent analysis|citation analysis|forward citation|backward citation|patent family|patent classification|patent claims|claim mapping|patent strength|patent quality|patent score|prior art|novelty|non-obviousness|patent examiner|patent prosecution|continuation|divisional|patent litigation|infringement|invalidation|patent landscape|competitive intelligence|technology scouting)\b/gi,
            
            'IP-Commercialization': /\b(technology transfer|tech transfer|licensing agreement|license|exclusive license|non-exclusive|royalty rate|running royalty|lump sum|milestone payment|sublicense|cross-license|patent pool|standard essential patent|frand|ip transaction|ip sale|ip acquisition|spinoff|spinout|startup|commercialization|market entry)\b/gi,
            
            // ============================================
            // NEW: FINANCE & CREDIT DOMAINS
            // ============================================
            'Credit-Risk-Analysis': /\b(credit risk|credit score|credit rating|default probability|default rate|probability of default|loss given default|exposure at default|credit assessment|creditworthiness|credit decision|credit committee|credit memo|underwriting|risk assessment|risk model|credit model|scoring model|scorecard|risk-adjusted|credit spread|counterparty risk)\b/gi,
            
            'Asset-Based-Finance': /\b(asset-based lending|collateral|secured lending|secured loan|collateralized|asset valuation|appraisal|loan-to-value|lien|security interest|ucc filing|perfection|lien priority|priority of liens|recovery rate|liquidation value|going concern value|forced sale|orderly liquidation|guarantor|guarantee fund|credit enhancement)\b/gi,
            
            'Corporate-Finance': /\b(corporate finance|capital structure|debt financing|equity financing|capital allocation|working capital|cash flow|free cash flow|ebitda|enterprise value|market cap|valuation multiple|discounted cash flow|cost of capital|financial leverage|leverage ratio|leveraged buyout|debt-to-equity|financial ratio|balance sheet|income statement)\b/gi,
            
            'Investment-Analysis': /\b(investment analysis|investment decision|investment thesis|due diligence|investor|venture capital|private equity|angel investor|seed funding|series a|series b|growth equity|buyout|investment return|portfolio theory|diversification|risk-return|jensen's alpha|beta coefficient|sharpe ratio)\b/gi,
            
            // ============================================
            // NEW: IP-FINANCE NEXUS DOMAINS
            // ============================================
            'IP-Backed-Finance': /\b(ip-backed|ip backed|ip financing|ip lending|ip collateral|ip-secured|ip secured|patent-backed|patent backed|intangible asset financing|intangible collateral|ip credit|ip loan|ip mortgage|ip securitization|royalty securitization|ip sale-leaseback|ip guarantee|ip insurance|patent insurance|ip fund)\b/gi,
            
            'Intangible-Asset-Valuation': /\b(intangible asset|intangible value|intangible capital|knowledge capital|intellectual capital|brand value|brand equity|goodwill|fair value|book value|market value|replacement cost|income approach|market approach|cost approach|relief from royalty|excess earnings|capitalized earnings|discounted royalty|comparable transaction|arm's length|transfer pricing)\b/gi,
            
            'Innovation-Economics': /\b(innovation economics|innovation system|national innovation|innovation policy|r&d investment|research and development|innovation ecosystem|technology spillover|knowledge spillover|absorptive capacity|innovation diffusion|technology adoption|s-curve|technology lifecycle|disruptive innovation|incremental innovation|radical innovation|innovation metrics|innovation index|patent intensity|r&d intensity)\b/gi,
            
            // ============================================
            // NEW: STRATEGIC & POLICY DOMAINS
            // ============================================
            'National-Competitiveness': /\b(national competitiveness|competitive advantage|economic development|industrial policy|strategic industry|national champion|sovereign wealth|state investment|government program|national program|policy framework|regulatory framework|economic policy|trade policy|technology policy|innovation authority|development bank|export credit|strategic investment)\b/gi,
            
            'Banking-Regulation': /\b(banking regulation|basel|capital requirement|risk-weighted asset|tier 1|tier 2|capital adequacy|capital reserve|loan loss provisions?|provisioning|loan loss|non-performing|regulatory capital|stress test|prudential|macroprudential|bank supervision|central bank|monetary policy|financial stability)\b/gi,
            
            'Technology-Sovereignty': /\b(technology sovereignty|tech sovereignty|strategic autonomy|supply chain|reshoring|nearshoring|friend-shoring|domestic production|local content|technology independence|critical technology|emerging technology|dual-use|export control|foreign investment|cfius|national security|strategic asset|essential facility)\b/gi,
            
            // ============================================
            // NEW: METHODOLOGY DOMAINS
            // ============================================
            'Strategic-Foresight': /\b(strategic foresight|scenario planning|future studies|trend analysis|weak signal|horizon scanning|backcasting|roadmapping|technology roadmap|delphi method|futures wheel|causal layered analysis|three horizons|emerging issues|wild card|black swan|megatrend|driving force)\b/gi,
            
            'Innovation-Methodology': /\b(innovation methodology|design thinking|lean startup|agile|mvp|minimum viable|prototype|iteration|pivot|product-market fit|customer discovery|jobs to be done|blue ocean|value innovation|systematic innovation|triz|inventive principles|ideation|brainstorming|structured creativity)\b/gi,
            
            // ============================================
            // ENHANCED: FINTECH (Expanded)
            // ============================================
            'FinTech': /\b(fintech|financial technology|digital banking|neobank|challenger bank|payment processing|payment gateway|mobile payment|digital wallet|open banking|banking api|embedded finance|buy now pay later|bnpl|regtech|regulatory technology|suptech|insurtech|wealthtech|proptech|lendtech|alternative lending|peer-to-peer|p2p lending|crowdfunding|marketplace lending)\b/gi
        };
        
        // Case-sensitive acronyms. As /gi these collide with ordinary words (car, pe, sep, ros, ar).
        const acronymPatterns = {
            'AR-VR': /\b(AR|VR|XR)\b/g,
            'Robotics': /\b(ROS)\b/g,
            'Patent-Analytics': /\b(IPC|CPC)\b/g,
            'IP-Commercialization': /\b(SEP)\b/g,
            'Credit-Risk-Analysis': /\b(PD|LGD|EAD)\b/g,
            'Asset-Based-Finance': /\b(ABL|LTV)\b/g,
            'Corporate-Finance': /\b(DCF|IRR|NPV|WACC)\b/g,
            'Investment-Analysis': /\b(PE|VC|LBO|ROI)\b/g,
            'Banking-Regulation': /\b(RWA|CAR|NPLs?)\b/g,
            'Intellectual-Property-Strategy': /\b(FTO)\b/g
        };
        
        let bestMatch = { domain: 'General-Systems', score: 0, confidence: 0.3, indicators: [], technical: false, strategic: false };
        let allMatches = [];  // NEW: Track all matches for multi-domain detection
        
        for (const [domain, pattern] of Object.entries(domainPatterns)) {
            const matches = (text.match(pattern) || []).concat(
                acronymPatterns[domain] ? (text.match(acronymPatterns[domain]) || []) : []
            );
            const score = matches.length;
            
            if (score > 0) {
                const domainMatch = {
                    domain,
                    score,
                    confidence: Math.min(score / 8, 1.0),  // Adjusted threshold
                    indicators: [...new Set(matches.map(m => m.toLowerCase()))].slice(0, 8),
                    technical: DomainIdentifier.isTechnicalDomain(domain),
                    strategic: DomainIdentifier.isStrategicDomain(domain)
                };
                
                allMatches.push(domainMatch);
                
                if (score > bestMatch.score) {
                    bestMatch = domainMatch;
                }
            }
        }
        
        // Check for subdomain specificity
        bestMatch.subdomains = DomainIdentifier.identifySubdomains(text, bestMatch.domain);
        
        // NEW: Attach secondary domains for synthesis detection
        bestMatch.secondaryDomains = allMatches
            .filter(m => m.domain !== bestMatch.domain && m.score >= 2)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
        
        return bestMatch;
    },
    
    // NEW: Determine if domain is technical
    isTechnicalDomain: (domain) => {
        const technicalDomains = [
            'Machine-Learning', 'Quantum-Computing', 'Blockchain', 'Biotechnology',
            'Data-Engineering', 'Cybersecurity', 'Cloud-Architecture', 
            'Natural-Language-Processing', 'Robotics', 'Computer-Vision', 
            'IoT', 'AR-VR', 'DevOps', 'Patent-Analytics'
        ];
        return technicalDomains.includes(domain);
    },
    
    // NEW: Determine if domain is strategic/policy
    isStrategicDomain: (domain) => {
        const strategicDomains = [
            'National-Competitiveness', 'Banking-Regulation', 'Technology-Sovereignty',
            'Innovation-Economics', 'Strategic-Foresight', 'IP-Backed-Finance',
            'Intellectual-Property-Strategy'
        ];
        return strategicDomains.includes(domain);
    },
    
    // Identify subdomains within a primary domain - EXPANDED with IP-Finance
    identifySubdomains: (text, primaryDomain) => {
        const subdomainMap = {
            // Original subdomains...
            'Machine-Learning': {
                'Computer-Vision': /\b(image|vision|cnn|object detection|segmentation|yolo|resnet)\b/gi,
                'Reinforcement-Learning': /\b(agent|reward|policy|q-learning|environment|mdp|actor-critic)\b/gi,
                'Generative-AI': /\b(gan|vae|diffusion|generation|synthesis|stable diffusion|midjourney)\b/gi,
                'Time-Series': /\b(lstm|rnn|forecasting|temporal|sequence|arima)\b/gi,
                'MLOps': /\b(mlflow|kubeflow|model serving|deployment|monitoring|drift)\b/gi
            },
            'Quantum-Computing': {
                'Quantum-Algorithms': /\b(shor|grover|vqe|qaoa|quantum algorithm|quantum supremacy)\b/gi,
                'Quantum-Hardware': /\b(ion trap|superconducting|photonic|quantum processor|ibm quantum|rigetti)\b/gi,
                'Quantum-Error-Correction': /\b(error correction|fault tolerant|surface code|logical qubit)\b/gi,
                'Quantum-ML': /\b(quantum machine learning|qml|variational|quantum neural)\b/gi
            },
            'Blockchain': {
                'Smart-Contracts': /\b(solidity|vyper|evm|contract|dapp|chainlink)\b/gi,
                'DeFi': /\b(defi|liquidity pool|amm|yield farming|lending protocol|dex)\b/gi,
                'Layer2': /\b(layer 2|rollup|polygon|arbitrum|optimism|scaling solution)\b/gi,
                'Web3': /\b(web3|ipfs|decentralized|dao|nft|metaverse)\b/gi
            },
            'Natural-Language-Processing': {
                'Large-Language-Models': /\b(llm|gpt|bert|transformer|attention|fine-tuning)\b/gi,
                'Information-Extraction': /\b(ner|entity extraction|relation extraction|knowledge graph)\b/gi,
                'Conversational-AI': /\b(chatbot|dialogue|intent|slot filling|rasa)\b/gi,
                'Multilingual-NLP': /\b(multilingual|translation|cross-lingual|mbert|xlm)\b/gi
            },
            
            // ============================================
            // NEW: IP-FINANCE SUBDOMAINS
            // ============================================
            'Intellectual-Property-Strategy': {
                'Patent-Portfolio-Management': /\b(portfolio management|portfolio optimization|portfolio review|portfolio rationalization|maintenance fee|renewal|pruning|harvesting)\b/gi,
                'Competitive-IP-Intelligence': /\b(competitive intelligence|competitor analysis|patent landscape|technology scouting|white space|freedom to operate)\b/gi,
                'IP-Lifecycle-Management': /\b(lifecycle|prosecution|maintenance|enforcement|licensing|monetization|abandonment)\b/gi,
                'Strategic-IP-Planning': /\b(ip strategy|filing strategy|claim strategy|geographic strategy|enforcement strategy)\b/gi
            },
            'Credit-Risk-Analysis': {
                'Probability-Modeling': /\b(probability of default|pd model|logistic regression|survival analysis|hazard rate|transition matrix)\b/gi,
                'Portfolio-Risk': /\b(portfolio risk|concentration risk|correlation|diversification|value at risk|expected loss|unexpected loss)\b/gi,
                'Early-Warning-Systems': /\b(early warning|watchlist|deterioration|migration|downgrade|upgrade)\b/gi
            },
            'IP-Backed-Finance': {
                'IP-Collateralization': /\b(ip collateral|security interest|perfection|lien|ucc|registration)\b/gi,
                'IP-Valuation-For-Lending': /\b(loan-to-value|collateral value|liquidation value|going concern|forced sale)\b/gi,
                'IP-Backed-Securitization': /\b(securitization|asset-backed securit(?:y|ies)|special purpose|spv|tranche|waterfall)\b/gi
            },
            'Innovation-Economics': {
                'Innovation-Measurement': /\b(innovation metrics|r&d productivity|patent intensity|citation impact|innovation index)\b/gi,
                'Innovation-Systems': /\b(innovation system|triple helix|ecosystem|cluster|spillover|absorptive capacity)\b/gi,
                'Innovation-Policy': /\b(innovation policy|r&d tax credit|grant|subsidy|public procurement|sbir|sttr)\b/gi
            },
            'National-Competitiveness': {
                'Industrial-Strategy': /\b(industrial strategy|industrial policy|strategic industry|national champion|picking winners)\b/gi,
                'Development-Finance': /\b(development bank|development finance|dfi|export credit|investment promotion)\b/gi,
                'Technology-Policy': /\b(technology policy|science policy|research policy|innovation authority|technology council)\b/gi
            }
        };
        
        const subdomains = [];
        const domainSubdomains = subdomainMap[primaryDomain] || {};
        
        for (const [subdomain, pattern] of Object.entries(domainSubdomains)) {
            const matches = text.match(pattern) || [];
            if (matches.length > 0) {
                subdomains.push({
                    name: subdomain,
                    indicators: matches.length,
                    indicatorTerms: [...new Set(matches.map(m => m.toLowerCase()))],
                    confidence: Math.min(matches.length / 4, 1.0)
                });
            }
        }
        
        return subdomains.sort((a, b) => b.confidence - a.confidence);
    },
    
    // NEW: Detect cross-domain synthesis requirements
    detectCrossDomainSynthesis: (domains) => {
        const base = [
            ...domains.primary,
            ...domains.technical,
            ...domains.strategic
        ];
        const secondary = DomainIdentifier.options.useSecondaryDomains
            ? base.flatMap(d => Array.isArray(d.secondaryDomains) ? d.secondaryDomains : [])
            : [];
        const allDomains = [...base, ...secondary];
        
        // Look for IP-Finance bridge patterns
        const hasIPDomain = allDomains.some(d => 
            d.domain.includes('Intellectual-Property') || 
            d.domain.includes('Patent') ||
            d.domain.includes('IP-')
        );
        
        const hasFinanceDomain = allDomains.some(d => 
            d.domain.includes('Finance') || 
            d.domain.includes('Credit') ||
            d.domain.includes('Investment') ||
            d.domain.includes('Banking')
        );
        
        const hasPolicyDomain = allDomains.some(d => 
            d.domain.includes('National') || 
            d.domain.includes('Competitiveness') ||
            d.domain.includes('Sovereignty')
        );
        
        const hasTechDomain = allDomains.some(d => d.technical);
        
        // Calculate synthesis requirements
        const bridgePatterns = [];
        let confidence = 0;
        
        if (hasIPDomain && hasFinanceDomain) {
            bridgePatterns.push('IP-Finance-Integration');
            confidence += 0.4;
        }
        
        if (hasIPDomain && hasPolicyDomain) {
            bridgePatterns.push('IP-Policy-Integration');
            confidence += 0.3;
        }
        
        if (hasFinanceDomain && hasPolicyDomain) {
            bridgePatterns.push('Finance-Policy-Integration');
            confidence += 0.3;
        }
        
        if (hasTechDomain && hasFinanceDomain) {
            bridgePatterns.push('Tech-Finance-Integration');
            confidence += 0.2;
        }
        
        return {
            required: bridgePatterns.length >= 2,
            bridgeTerms: bridgePatterns,
            confidence: Math.min(confidence, 1.0),
            requirements: {
                needsIPExpert: hasIPDomain,
                needsFinanceExpert: hasFinanceDomain,
                needsPolicyExpert: hasPolicyDomain,
                needsTechExpert: hasTechDomain,
                primaryBridge: bridgePatterns[0] || null
            }
        };
    },
    
    // Deduplicate and merge similar domains
    deduplicateDomains: (domains) => {
        const unique = {};
        
        domains.forEach(d => {
            const key = d.domain;
            if (!unique[key]) {
                unique[key] = d;
            } else if (unique[key].confidence < d.confidence) {
                // Original discarded the previous entry's subdomains when replacing it.
                const previous = unique[key];
                unique[key] = d;
                if (previous.subdomains && previous.subdomains.length > 0) {
                    unique[key].subdomains = DomainIdentifier.mergeSubdomains(
                        unique[key].subdomains || [],
                        previous.subdomains
                    );
                }
            } else if (d.subdomains && d.subdomains.length > 0) {
                unique[key].subdomains = DomainIdentifier.mergeSubdomains(
                    unique[key].subdomains || [],
                    d.subdomains
                );
            }
        });
        
        return Object.values(unique);
    },
    
    // Merge subdomain lists
    mergeSubdomains: (existing, newSubs) => {
        const merged = [...existing];
        
        newSubs.forEach(newSub => {
            const exists = merged.find(s => s.name === newSub.name);
            if (!exists) {
                merged.push(newSub);
            } else if (exists.confidence < newSub.confidence) {
                exists.confidence = newSub.confidence;
                exists.indicators = newSub.indicators;
                exists.indicatorTerms = [...new Set([...exists.indicatorTerms, ...newSub.indicatorTerms])];
            }
        });
        
        return merged.sort((a, b) => b.confidence - a.confidence);
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DomainIdentifier;
}
