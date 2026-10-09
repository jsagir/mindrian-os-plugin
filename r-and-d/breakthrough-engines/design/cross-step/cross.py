"""Step 3, cross: local gaps against external findings, both directions. Offline, standard library.
Rule (two-sided check):
  local gap + external match  -> FILLED_EXTERNALLY (prior-art risk; read before use)
  local gap + no match        -> OPEN_GAP (candidate for a test; not a finding)
  external hit + no local gap -> EXTERNAL_NOT_IN_ROOM (monitor)
Matching is lexical (content-word overlap). It finds candidates; it does not judge meaning.
"""
import json, os, re, sys
STOP=set("a an the and or of to in on for with by as is are be from that this than not while other others".split())
def words(t): return {w for w in re.findall(r"[a-z]+", t.lower()) if w not in STOP and len(w)>2}
def overlap(a,b):
    if not a or not b: return 0.0
    return len(a&b)/len(a)  # share of the gap's words found in the external text
def load_external(paths):
    ext=[]
    for p in paths:
        d=json.load(open(p,encoding="utf-8"))
        rows=d if isinstance(d,list) else []
        for q in rows:
            for r in q.get("results",[]):
                ext.append({"query":q.get("tag") or q.get("id"),"title":r.get("title") or "","url":r.get("url") or "","text":(r.get("title") or "")+" "+(r.get("snippet") or "")})
    return ext
def cross(gaps, ext, thr=0.5):
    rows=[]; used=set()
    for g in gaps:
        gw=words(g["gap"]); best=None; bs=0.0
        for i,e in enumerate(ext):
            s=overlap(gw, words(e["text"]))
            if s>bs: bs=s; best=i
        if best is not None and bs>=thr:
            used.add(best)
            rows.append({"gap":g["id"],"status":"FILLED_EXTERNALLY","score":round(bs,2),"external":ext[best]["title"],"url":ext[best]["url"]})
        else:
            rows.append({"gap":g["id"],"status":"OPEN_GAP","score":round(bs,2),"external":None,"url":None})
    for i,e in enumerate(ext):
        if i not in used: rows.append({"gap":None,"status":"EXTERNAL_NOT_IN_ROOM","score":None,"external":e["title"],"url":e["url"]})
    return rows
if __name__=="__main__":
    here=os.path.dirname(os.path.abspath(__file__))
    gaps=json.load(open(os.path.join(here,"local_gaps.json"),encoding="utf-8"))
    base=os.path.join(here,"..","..","research-queries")
    paths=[os.path.join(base,"results-tavily","tavily-results-PROPOSED.json"),os.path.join(base,"results-deep-research","RESULTS-C2-A2-PROPOSED.json")]
    ext=load_external([p for p in paths if os.path.exists(p)])
    rows=cross(gaps,ext)
    out=os.path.join(here,"cross-result.json")
    json.dump(rows,open(out,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
    for r in rows: print(r["status"], r.get("gap"), r["score"], (r.get("external") or "")[:70])
