#!/usr/bin/env python3
"""L5 read-only scanner: Larry voice markers in Claude Code session transcripts."""
import glob,json,re,os,sys,collections,random
ROOT='/home/jsagi/.claude/projects'
GLYPH=re.compile(r'^\s*(\*\*)?\s*(\U0001F7E6|\U0001F7E5|\U0001F7E8|⬛|⬜)')
LABEL=re.compile(r'Larry \| MindrianOS')
OPEN=re.compile(r'(very simply|think about it like this|here\'s what everyone misses|let me challenge you with this)',re.I)
FORB=re.compile(r'(great question|absolutely!|i\'d be happy to help|i would be happy to help)',re.I)
REFRAME=re.compile(r'(you\'re thinking (about )?(this|it) as|you are thinking (about )?(this|it) as|but what if (it\'s|it is|this is)|that\'s not a problem\s*(--|-|—)?\s*that\'s a category|you\'ve given me a solution\.? what\'s the problem|what\'s the (real |actual )?problem\?)',re.I)
FW=['jobs to be done','jtbd','six hats','six thinking hats','de bono','lean canvas','triz','sapphire','reverse salient','dikw','ackoff','minto','devil\'s advocate','porter','swot','hooked model','mullins','dominant design','beautiful question','blue ocean','business model canvas','design thinking','five whys','5 whys','systems thinking','scenario plan','s-curve','cynefin','wardley','value proposition canvas','causal','root cause','trending to the absurd','bono','pws','brain']
FW=[f for f in FW if f not in ('pws','brain','causal','root cause')]
VER=re.compile(r'\[MindrianOS v([0-9][0-9A-Za-z.\-]*)\] You are Larry')
def text_of(content):
    if isinstance(content,str): return [content]
    return [b.get('text','') for b in content if isinstance(b,dict) and b.get('type')=='text']
def real_user(d):
    if d.get('isMeta') or d.get('isSidechain'): return None
    c=d['message']['content']
    if isinstance(c,list) and any(isinstance(b,dict) and b.get('type')=='tool_result' for b in c): return None
    t=' '.join(text_of(c)).strip()
    if not t or t.startswith('<') and 'system-reminder' in t[:40] and len(t)<50: return None
    if t.startswith('<command-') or t.startswith('<local-command') or t.startswith('Caveat:'): return None
    return t
def sentences(t):
    t=re.sub(r'```.*?```','',t,flags=re.S)
    t=re.sub(r'\|.*\|','',t)
    t=re.sub(r'^\s*[-*#>].*$',lambda m:m.group(0)+'.',t,flags=re.M)
    parts=re.split(r'(?<=[.!?])\s+|\n+',t)
    return len([p for p in parts if len(re.findall(r'\w+',p))>=2])
def scan(f):
    ver=None; first=None; larry=False; turns=[]; cur=None; utext=''
    for l in open(f,errors='ignore'):
        try:d=json.loads(l)
        except: continue
        ty=d.get('type'); ts=d.get('timestamp')
        if ts and not first: first=ts
        if ty=='attachment':
            a=d['attachment']
            if str(a.get('hookName','')).startswith('SessionStart') or a.get('type')=='hook_additional_context':
                m=VER.search(json.dumps(a).replace('\\n','\n'))
                if m and not ver: ver=m.group(1); larry=True
            continue
        if ty=='user':
            t=real_user(d)
            if t is not None:
                if cur and cur['texts']: turns.append(cur)
                cur={'texts':[],'tools':0,'user':t}
            continue
        if ty=='assistant' and cur is not None and not d.get('isSidechain'):
            m=d['message']
            if m.get('model')=='<synthetic>': continue
            for b in m['content'] if isinstance(m['content'],list) else []:
                if b.get('type')=='text' and b['text'].strip(): cur['texts'].append(b['text'])
                if b.get('type')=='tool_use': cur['tools']+=1
    if cur and cur['texts']: turns.append(cur)
    return ver,first,larry,turns
def markers(t):
    first=t['texts'][0]; last=t['texts'][-1]; full='\n'.join(t['texts'])
    ul=t['user'].lower()
    fws={x for x in FW if x in full.lower()}
    asked=any(x in ul for x in FW) or 'framework' in ul
    return {
     'glyph':bool(GLYPH.match(first)),'label':bool(LABEL.search(first[:80])),
     'len':sentences(last),'len_ok':3<=sentences(last)<=8,
     'reframe':bool(REFRAME.search(full)),
     'closeq':last.rstrip().endswith('?') or bool(re.search(r'\?\s*[\U0001F7E6\U0001F7E5\U0001F7E8⬛⬜]?\s*$',last.strip())),
     'fwdump':len(fws)>=3 and not asked,
     'opener':bool(OPEN.search(full)),'forbidden':bool(FORB.search(full)),
     'emdash':'—' in full,'pausedash':' -- ' in full,
     'notool':t['tools']==0,
    }
if __name__=='__main__':
    rows=[]
    for f in glob.glob(ROOT+'/*/*.jsonl'):
        if os.path.getsize(f)>200_000_000: continue
        ver,first,larry,turns=scan(f)
        if not larry or not turns: continue
        for t in turns:
            r=markers(t); r.update(ver=ver,month=(first or '')[:7],file=f,first=first,text=t['texts'][0][:200],last=t['texts'][-1][-200:],proj=f.split('/')[-2])
            rows.append(r)
    json.dump(rows,open(sys.argv[1],'w'))
    print(len(rows),len({r['file'] for r in rows}))
