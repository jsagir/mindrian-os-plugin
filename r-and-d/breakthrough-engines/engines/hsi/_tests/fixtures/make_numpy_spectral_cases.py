import numpy as np, json
rng=np.random.default_rng(1)
out=[]
for k in range(60):
    seq=rng.integers(0,5,size=int(rng.integers(5,40)))
    c=np.zeros((5,5))
    for a,b in zip(seq[:-1],seq[1:]): c[a,b]+=1
    c+=0.1; P=c/c.sum(1,keepdims=True)
    ev=np.linalg.eigvals(P); mags=sorted(np.abs(ev),reverse=True)
    gap=max(0,min(1,1-mags[1]))
    w,v=np.linalg.eig(P.T); i=np.argmin(abs(w-1)); st=np.abs(np.real(v[:,i])); st/=st.sum()
    out.append({"P":P.tolist(),"gap":gap,"st":st.tolist()})
json.dump(out,open('numpy_spectral_cases.json','w'))
