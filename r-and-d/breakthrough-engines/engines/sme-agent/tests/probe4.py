import sys, os, collections
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import fixtures as f, sme
r=sme.match(f.karla(),f.ta5(),"AN")
c=collections.Counter()
for m in r.mhs.values():
    c[r.base.functor(m.b) if m.expr else "ENT"]+=1
print(sorted(c.items()))
print([ (m.b,m.t) for m in r.mhs.values() if not m.expr])
