import json,collections,sys
r=json.load(open('rows.json'))
M=['glyph','label','len_ok','reframe','closeq','fwdump','opener','forbidden','emdash','pausedash']
def tab(rows,key,title):
    g=collections.defaultdict(list)
    for x in rows: g[key(x)].append(x)
    print('\n###',title)
    print('group | sessions | turns | '+' | '.join(M)+' | medianSent')
    for k in sorted(g):
        v=g[k]; n=len(v); ss=len({x['file'] for x in v})
        med=sorted(x['len'] for x in v)[n//2]
        print(f"{k} | {ss} | {n} | "+' | '.join(f"{100*sum(x[m] for x in v)/n:.1f}" for m in M)+f" | {med}")
def vk(x):return x['ver'].replace('2.0.0-beta.','b')
def sk(x):return (x['first'] or '')[:10]
for name,rows in (('ALL',r),('NOTOOL',[x for x in r if x['notool']])):
    tab(rows,vk,name+' by version'); tab(rows,lambda x:x['month'],name+' by month')
    tab(rows,lambda x:(x['first'] or '')[:7]+('-a' if int((x['first'] or '0000-00-00')[8:10])<=15 else '-b'),name+' by half-month')
