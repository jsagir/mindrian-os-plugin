import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import fixtures as f, sme
for fn in (["happiness"],["happiness","success"],[],["success"]):
  for rs in ("AN","MA"):
    out=[]
    for t in (f.TA5,f.MA5):
        b=sme.dgroup_from_text(f.KARLA_BASE,functions=fn); tt=sme.dgroup_from_text(t,functions=fn)
        r=sme.match(b,tt,rs); out.append((len(r.mhs),round(r.gmaps[0]["weight"],4)))
    print(fn,rs,out)
