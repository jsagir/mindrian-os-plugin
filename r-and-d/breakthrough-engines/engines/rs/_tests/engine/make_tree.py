"""Build a runnable tree: <dest>/scripts/rs-engine.py + <dest>/lib/core/*.py.
lib/core files come from the pristine baseline (read only); rs_math is the
test overlay. A no-op ensure_ml_deps is added so the ORIGINAL engine imports."""
import os, shutil, sys
def build(dest, engine_src, pkg_root):
    core_src = os.path.join(pkg_root, "_baseline", "orig", "rs", "shared", "lib", "core")
    os.makedirs(os.path.join(dest, "scripts", "lib"), exist_ok=True)
    os.makedirs(os.path.join(dest, "lib", "core"), exist_ok=True)
    shutil.copy(engine_src, os.path.join(dest, "scripts", "rs-engine.py"))
    with open(os.path.join(dest, "scripts", "lib", "ensure_ml_deps.py"), "w") as f:
        f.write("def ensure(pkgs):\n    return None\n")
    # Minimal sklearn.metrics.pairwise.cosine_similarity (numpy) so the ORIGINAL
    # engine can run here; the 2026 engine does not need it.
    sk = os.path.join(dest, "scripts", "lib", "sklearn", "metrics")
    os.makedirs(sk, exist_ok=True)
    open(os.path.join(dest, "scripts", "lib", "sklearn", "__init__.py"), "w").close()
    open(os.path.join(sk, "__init__.py"), "w").close()
    with open(os.path.join(sk, "pairwise.py"), "w") as f:
        f.write("import numpy as np\ndef cosine_similarity(X):\n    X=np.asarray(X,dtype=float)\n    n=np.linalg.norm(X,axis=1); n[n==0]=1\n    X=X/n[:,None]\n    return X@X.T\n")
    for fn in os.listdir(core_src):
        if fn.endswith(".py"):
            shutil.copy(os.path.join(core_src, fn), os.path.join(dest, "lib", "core", fn))
    here = os.path.dirname(os.path.abspath(__file__))
    shutil.copy(os.path.join(here, "stub_rs_math.py"), os.path.join(dest, "lib", "core", "rs_math.py"))
    return os.path.join(dest, "scripts", "rs-engine.py"), os.path.join(core_src, "rs_math.py")
if __name__ == "__main__":
    print(build(*sys.argv[1:4]))
