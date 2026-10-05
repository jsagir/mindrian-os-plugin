const R='/home/jsagi/dev/MindrianOS-Plugin/';
const g=require(R+'lib/core/part8-egress-guard.cjs');
const agg=require(R+'lib/core/cross-room-aggregator.cjs');
const prompts=[
 "How do I decide which customer segment to pursue first?",
 "What is the best way to validate a business idea?",
 "How should I use the Minto Pyramid framework to structure an argument?",
 "Which framework fits a wicked problem?",
 "MATCH (f:Framework) WHERE f.name CONTAINS 'Minto' RETURN f.name",
 "MATCH (n) RETURN labels(n) AS labels, count(*) AS c",
 "How do I price my product for Tel Aviv customers?",
 "Which chain of frameworks follows discovery stage for an ill-defined problem?",
 "How do I decide which customer segment to pursue first, using the framework approach?",
 "MATCH (n) WHERE n.text CONTAINS 'customer segment' RETURN n",
];
// ask/search: _typedFreeformGate in brain-client.cjs (allow && typed_question else blocked)
function askSearch(tool,p){const key=tool==='brain_search'?'query':'question';const v=g.classify({[key]:p},{toolName:tool});
  return {v, disp:(v.verdict==='allow'&&v.class==='typed_question')?'proceed':'BLOCKED('+((v.verdict==='block')?'content_set':'freeform_unproven')+')'};}
// brain_query: brain-client.cjs query() blocks only on verdict==='block'
function q(p){const v=g.classify({cypher:p},{toolName:'brain_query'});return {v,disp:v.verdict==='block'?'BLOCKED(content_set)':'proceed'};}
let dis=0;
for(const p of prompts){const a=askSearch('brain_ask',p),s=askSearch('brain_search',p),c=q(p);
 const d=new Set([a.disp,s.disp,c.disp]).size>1; if(d)dis++;
 console.log(JSON.stringify({p,ask:a.disp+' '+a.v.class,search:s.disp+' '+s.v.class,query:c.disp+' '+c.v.class,disagree:d}));}
console.log('prompts='+prompts.length+' disagreements='+dis);
console.log('METHODOLOGY_TOKEN_SET.size='+g.METHODOLOGY_TOKEN_SET.size);
console.log('QUESTION_FUNCTION_WORDS.size='+g.QUESTION_FUNCTION_WORDS.size);
console.log('COMMAND_SLUG_SET.size='+g.COMMAND_SLUG_SET.size);
console.log('CANONICAL_PHRASES.length='+g.CANONICAL_PHRASES.length);
console.log('TOKENS='+JSON.stringify([...g.METHODOLOGY_TOKEN_SET]));
const city=agg.FORBIDDEN_PATTERNS.filter(r=>/Haifa/.test(r.source));
console.log('FORBIDDEN_PATTERNS.length='+agg.FORBIDDEN_PATTERNS.length);
console.log('city regexes='+city.length+' source='+city[0].source);
const alts=city[0].source.replace(/^\\b\(\?:/,'').replace(/\)\\b$/,'').split('|');
console.log('city alternatives='+alts.length+' '+JSON.stringify(alts));
