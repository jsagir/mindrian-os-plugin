import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import fixtures as f, sme
r = sme.match(f.solar(), f.rutherford(), "AN")
print(r.n_mh_initial, len(r.mhs))
for m in sorted(r.mhs.values(), key=lambda m: m.idx): print(m.b, m.t, round(m.belief[0],3), m.via_filter)
for g in r.gmaps: print(round(g["weight"],3), g["n_mh"])
