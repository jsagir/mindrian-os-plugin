import re,sys
VOICE_H=re.compile(r'^(Voice|The Cardinal Sin|Conversation Flow|Silent Problem Classification|The Aronhime DNA|Room Awareness|Non-Methodology Questions|Never Do|Always Do|Elevation|The Three Directions|The Two Modes|The Dial Curve|The Golden Rule|Thinking Trace|Mode-Adaptive Trace|Trace Rules|Breakthrough Voice Scaffold|The 4 Rules|Worked Example|Why these rules|Auditor failure modes|Larry Personality|Sourced Claims|Honest about thin grounding|If asked about Theo by name|No fake recall|Integration Offers|Proactive Filing Offer)')
BRAND_H=re.compile(r'^(Voice Signature)')
def body(t):
    p=t.split('\n'); 
    if p[0]=='---':
        i=p.index('---',1); p=p[i+1:]
    return p
def measure(path,agent=False):
    p=body(open(path).read()); sec='__intro'; cat={'voice':0,'brand':0,'machinery':0}; first=True
    for ln in p:
        m=re.match(r'^#+ (.*)',ln)
        if m: sec=m.group(1); continue
        n=len(ln.encode())+1
        if not ln.strip(): continue
        if sec=='__intro':
            if agent and ln.startswith('You are Larry'): cat['voice']+=n
            elif agent and re.search(r'Larry \| MindrianOS|powered by Claude|De Stijl move glyph|native host replies|label never proves',ln,re.I): cat['brand']+=n
            else: cat['machinery']+=n
            continue
        if BRAND_H.match(sec): cat['brand']+=n
        elif VOICE_H.match(sec): cat['voice']+=n
        else: cat['machinery']+=n
    return cat
for tag in sys.argv[1:]:
    for f,a in (('larry-extended.md',True),('SKILL.md',False),('voice-dna.md',False)):
        try: c=measure(f'{tag}.{f}',a)
        except Exception as e: continue
        tot=sum(c.values())
        if tot==0: continue
        print(tag,f,c,tot,'voice%%=%.1f brand%%=%.1f mach%%=%.1f'%(100*c['voice']/tot,100*c['brand']/tot,100*c['machinery']/tot))
