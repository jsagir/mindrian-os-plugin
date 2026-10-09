import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import fixtures as f, sme
def show(name, b, t, rs, n=3):
    r = sme.match(b, t, rs)
    print(name, rs, len(r.mhs), "MHs", [round(g["weight"],4) for g in r.gmaps[:n]], len(r.gmaps),"gmaps")
    return r
r=show("water/heat", f.water(), f.heat(), "LS")
print([c["expression"] for c in r.gmaps[0]["candidate_inferences"]])
r=show("solar/rutherford", f.solar(), f.rutherford(), "AN")
print([c["expression"] for c in r.gmaps[0]["candidate_inferences"]])
for t,n in ((f.ta5(),"TA5"),(f.ma5(),"MA5")):
    show("karla/"+n, f.karla(), t, "AN", 2); show("karla/"+n, f.karla(), t, "MA", 2)
