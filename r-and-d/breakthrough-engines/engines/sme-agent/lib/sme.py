#!/usr/bin/env python3
"""Structure-Mapping Engine (SME), Python port.

Implements the algorithm of Falkenhainer, Forbus and Gentner, "The Structure-Mapping
Engine: Algorithm and Examples", Artificial Intelligence 41 (1989) 1-63:

  1. local match construction (match hypotheses, rule sets LS / AN / MA, Appendix A)
  2. global match construction (consistency, Conflicting / Emaps / NoGood, three merge steps)
  3. candidate inferences (with skolem entities)
  4. structural evaluation (evidence rules, simplified Dempster combination, SES = sum of beliefs)

SME maps only. It does not do Access (finding a base) or Evaluation and Use (validity and
relevance); see agents/structure-mapping-research-agent.md for how those are covered.

Pure standard library. Deterministic. No network.
"""
from __future__ import annotations

import itertools
import json
import re
import sys

FUNCTION, ATTRIBUTE, RELATION = "function", "attribute", "relation"
DEFAULT_COMMUTATIVE = ("and", "or", "equals")
RULESETS = ("AN", "LS", "MA")
OK, UNDET, MISMATCH = "ok", "undetermined", "mismatch"


def _norm(x):
    return str(x).strip().lower()


# --------------------------------------------------------------------------- description groups
class Dgroup:
    """A description group: entities plus expressions (predicate applications)."""

    def __init__(self, name="dgroup", functions=(), commutative=None, constants=()):
        self.name = name
        self.entities = {}  # name -> type
        self.constants = set(_norm(c) for c in constants)
        self.exprs = {}  # name -> (functor, args tuple of item names)
        self.expr_order_added = []
        self.declared = {_norm(f): FUNCTION for f in functions}
        self.commutative = set(_norm(c) for c in (DEFAULT_COMMUTATIVE if commutative is None else commutative))
        self._final = False
        self._auto = 0

    # building
    def add_entity(self, name, etype=None, constant=False):
        n = _norm(name)
        self.entities[n] = etype
        if constant:
            self.constants.add(n)
        self._final = False
        return n

    def add_expr(self, functor, args, name=None):
        """args: item names, or nested tuples/lists (functor, arg, ...) for compound terms."""
        f = _norm(functor)
        resolved = []
        for a in args:
            if isinstance(a, (list, tuple)):
                resolved.append(self.add_expr(a[0], a[1:]))
            else:
                resolved.append(_norm(a))
        if name is None:
            self._auto += 1
            base = f + "-" + "-".join(resolved) if resolved else f
            name = base
            while name in self.exprs:
                self._auto += 1
                name = f"{base}-{self._auto}"
        name = _norm(name)
        if name in self.exprs:
            raise ValueError(f"duplicate expression name {name!r} in {self.name}")
        self.exprs[name] = (f, tuple(resolved))
        self.expr_order_added.append(name)
        self._final = False
        return name

    def finalize(self):
        if self._final:
            return self
        for name, (f, args) in list(self.exprs.items()):
            for a in args:
                if a not in self.exprs and a not in self.entities:
                    self.entities[a] = None  # undeclared symbol is an entity
        # cycle check
        state = {}

        def visit(x):
            if x not in self.exprs:
                return
            if state.get(x) == 1:
                raise ValueError(f"cyclic description at {x!r}")
            if state.get(x) == 2:
                return
            state[x] = 1
            for a in self.exprs[x][1]:
                visit(a)
            state[x] = 2

        for x in self.exprs:
            visit(x)
        self._kind, self._order, self._parents = {}, {}, {n: [] for n in list(self.exprs) + list(self.entities)}
        for name, (f, args) in self.exprs.items():
            for a in args:
                self._parents[a].append(name)
        self._final = True
        return self

    # queries (call finalize first)
    def is_entity(self, x):
        return x in self.entities

    def is_expr(self, x):
        return x in self.exprs

    def functor(self, x):
        return self.exprs[x][0]

    def args(self, x):
        return self.exprs[x][1]

    def kind(self, x):
        """function / attribute / relation of an expression."""
        if x in self._kind:
            return self._kind[x]
        f, args = self.exprs[x]
        if f in self.declared:
            k = self.declared[f]
        elif len(args) == 1 and args[0] in self.entities:
            k = ATTRIBUTE
        else:
            k = RELATION
        self._kind[x] = k
        return k

    def is_function_expr(self, x):
        return x in self.exprs and self.kind(x) == FUNCTION

    def is_commutative(self, x):
        return self.exprs[x][0] in self.commutative

    def order(self, x):
        if x in self._order:
            return self._order[x]
        if x in self.entities:
            o = 0
        else:
            args = self.exprs[x][1]
            o = 1 + (max(self.order(a) for a in args) if args else 0)
        self._order[x] = o
        return o

    def parents(self, x):
        return self._parents[x]

    def descendants(self, x):
        seen, stack = set(), [x]
        while stack:
            y = stack.pop()
            for a in (self.exprs[y][1] if y in self.exprs else ()):
                if a not in seen:
                    seen.add(a)
                    stack.append(a)
        return seen

    def roots(self):
        return [x for x in self.expr_order_added if not self._parents[x]]

    def to_text(self, x, memo=None):
        if x in self.entities:
            return x
        f, args = self.exprs[x]
        return "(" + " ".join([f] + [self.to_text(a) for a in args]) + ")"


# --------------------------------------------------------------------------- loaders
def dgroup_from_dict(d):
    """JSON form: {name, entities:[..]|{name:type}, functions:[..], commutative:[..], constants:[..],
    expressions:[{name?, functor, args:[..]}]}. An arg may itself be a nested list [functor, arg, ...]."""
    g = Dgroup(d.get("name", "dgroup"), functions=d.get("functions", ()), commutative=d.get("commutative"),
               constants=d.get("constants", ()))
    ents = d.get("entities", [])
    if isinstance(ents, dict):
        for k, v in ents.items():
            g.add_entity(k, v)
    else:
        for e in ents:
            g.add_entity(e)
    for ex in d.get("expressions", []):
        g.add_expr(ex["functor"], ex.get("args", []), ex.get("name"))
    return g.finalize()


def _tokenize(s):
    s = re.sub(r";[^\n]*", "", s)
    return re.findall(r"\(|\)|[^\s()]+", s)


def _read(tokens, i=0):
    if tokens[i] == "(":
        out, i = [], i + 1
        while tokens[i] != ")":
            node, i = _read(tokens, i)
            out.append(node)
        return out, i + 1
    return tokens[i], i + 1


def dgroup_from_text(text, name="dgroup", functions=(), commutative=None, constants=()):
    """Appendix B style: (defdescription name entities (a b) expressions (((flow a b) :name f) ((g a)) ...))"""
    tree, _ = _read(_tokenize(text), 0)
    # tree: ['defdescription', name, 'entities', [...], 'expressions', [...]]
    g = Dgroup(name, functions=functions, commutative=commutative, constants=constants)
    if isinstance(tree, list) and tree and _norm(tree[0]) == "defdescription":
        if len(tree) > 1 and isinstance(tree[1], str):
            g.name = tree[1]
        body = tree[2:]
    else:
        body = tree
    ents, exprs = [], []
    k = 0
    while k < len(body):
        key = _norm(body[k]) if isinstance(body[k], str) else None
        if key == "entities":
            ents = body[k + 1]
            k += 2
        elif key == "expressions":
            exprs = body[k + 1]
            k += 2
        else:
            k += 1
    for e in ents:
        g.add_entity(e)

    def add(node, nm=None):
        if isinstance(node[0], list):  # ((functor args...) :name nm)
            inner = node[0]
            nm = None
            for j in range(1, len(node) - 1):
                if _norm(node[j]) == ":name":
                    nm = node[j + 1]
            return add(inner, nm)
        args = [add(a) if isinstance(a, list) else a for a in node[1:]]
        return g.add_expr(node[0], args, nm)

    for ex in exprs:
        add(ex)
    return g.finalize()


# --------------------------------------------------------------------------- evidence arithmetic
def dempster(m1, m2):
    """Combine two (support, against) pairs; simplified Dempster rule on {A, not A}."""
    s1, n1 = m1
    s2, n2 = m2
    u1, u2 = 1.0 - s1 - n1, 1.0 - s2 - n2
    k = s1 * n2 + n1 * s2
    if k >= 1.0 - 1e-12:
        return (0.0, 0.0)
    s = (s1 * s2 + s1 * u2 + u1 * s2) / (1.0 - k)
    n = (n1 * n2 + n1 * u2 + u1 * n2) / (1.0 - k)
    return (s, n)


# --------------------------------------------------------------------------- match hypotheses
class MH:
    __slots__ = ("idx", "b", "t", "expr", "via_filter", "parents", "cand_children", "children",
                 "ambiguous", "belief", "conflicting", "emaps", "nogood", "reach", "supported")

    def __init__(self, idx, b, t, expr):
        self.idx, self.b, self.t, self.expr = idx, b, t, expr
        self.via_filter = False
        self.parents = set()
        self.cand_children = set()  # every MH over argument pairs (evidence propagation)
        self.children = set()  # entailed children (support constraint)
        self.ambiguous = False
        self.belief = (0.0, 0.0)


def _compat(rs, B, T, x, y):
    """May the argument pair (x, y) be installed by an :intern rule?"""
    if B.is_entity(x) and T.is_entity(y):
        return True
    if B.is_expr(x) and T.is_expr(y):
        if B.is_function_expr(x) and T.is_function_expr(y):
            return True
        if rs == "AN" and B.kind(x) == ATTRIBUTE and B.functor(x) == T.functor(y) and T.kind(y) == ATTRIBUTE:
            return True
    return False


def _intern_pairs(rs, B, T, b, t):
    if not (B.is_expr(b) and T.is_expr(t)):
        return []
    cb, ct = B.is_commutative(b), T.is_commutative(t)
    ab, at = B.args(b), T.args(t)
    out = []
    if rs == "MA":
        if not cb and not ct:
            out = [(x, y) for x, y in zip(ab, at) if B.is_entity(x) and T.is_entity(y)]
        elif cb and ct:
            out = [(x, y) for x in ab for y in at if B.is_entity(x) and T.is_entity(y)]
        return out
    if not cb and not ct:
        out = [(x, y) for x, y in zip(ab, at) if _compat(rs, B, T, x, y)]
    elif cb and ct:
        out = [(x, y) for x in ab for y in at if _compat(rs, B, T, x, y)]
    return out


def _filter(rs, B, T, b, t):
    if B.functor(b) != T.functor(t):
        return False
    if rs == "AN":
        return B.kind(b) != ATTRIBUTE
    if rs == "MA":
        return B.order(b) <= 1 and T.order(t) <= 1
    return True  # LS


class Match:
    """Result of SME.match: match hypotheses and gmaps."""

    def __init__(self, base, target, rules):
        self.base, self.target, self.rules = base, target, rules
        self.mhs = {}
        self.gmaps = []
        self.n_mh_initial = 0
        self.truncated = False


def _children_potential(B, T, b, t):
    """Tri-state test used by the arguments-potentially-match evidence rule (Appendix A)."""
    ab, at = B.args(b), T.args(t)
    if len(ab) != len(at):
        return MISMATCH

    def pair(x, y):
        if B.is_entity(x) and T.is_entity(y):
            return OK
        if B.is_expr(x) and T.is_expr(y):
            if B.functor(x) == T.functor(y):
                return OK
            if B.is_function_expr(x) and T.is_function_expr(y):
                return UNDET
        return MISMATCH

    if not B.is_commutative(b) and not T.is_commutative(t):
        sts = [pair(x, y) for x, y in zip(ab, at)]
    else:
        sts = []
        for x in ab:
            cand = [pair(x, y) for y in at]
            if OK in cand:
                sts.append(OK)
            elif UNDET in cand:
                sts.append(UNDET)
            else:
                sts.append(MISMATCH)
    if MISMATCH in sts:
        return MISMATCH
    if UNDET in sts:
        return UNDET
    return OK


class SME:
    def __init__(self, rules="AN", max_gmaps=2000):
        if rules not in RULESETS:
            raise ValueError(f"rules must be one of {RULESETS}")
        self.rules = rules
        self.max_gmaps = max_gmaps

    # ------------------------------------------------------------------ public
    def match(self, base: Dgroup, target: Dgroup) -> Match:
        base.finalize()
        target.finalize()
        res = Match(base, target, self.rules)
        self._local(res)
        self._structure(res)
        self._evidence(res)
        self._gmaps(res)
        self._inferences(res)
        res.gmaps.sort(key=lambda g: (-g["weight"], g["elements"]))
        for i, g in enumerate(res.gmaps, 1):
            g["rank"] = i
        return res

    # ------------------------------------------------------------------ step 1
    def _local(self, res):
        B, T, rs = res.base, res.target, self.rules
        mhs = res.mhs  # (b,t) -> MH
        queue = []

        def install(b, t, filt=False):
            key = (b, t)
            m = mhs.get(key)
            if m is None:
                m = MH(len(mhs), b, t, B.is_expr(b) and T.is_expr(t))
                mhs[key] = m
                queue.append(m)
            if filt:
                m.via_filter = True
            return m

        for b in B.expr_order_added:
            for t in T.expr_order_added:
                if _filter(rs, B, T, b, t):
                    install(b, t, True)
        while queue:
            m = queue.pop(0)
            for (x, y) in _intern_pairs(rs, B, T, m.b, m.t):
                install(x, y)
        res.n_mh_initial = len(mhs)

    # ------------------------------------------------------------------ support constraint
    def _structure(self, res):
        """Link MHs. As in the paper, MHs whose arguments have no counterpart MH are kept (they carry
        negative evidence from arguments-potentially-match); they simply have fewer children."""
        B, T = res.base, res.target
        mhs = res.mhs
        for m in mhs.values():
            m.parents, m.cand_children, m.children, m.ambiguous = set(), set(), set(), False
        for m in mhs.values():
            if not m.expr:
                continue
            ab, at = B.args(m.b), T.args(m.t)
            if len(ab) != len(at):
                continue
            if B.is_commutative(m.b) and T.is_commutative(m.t):
                pairs = [(x, y) for x in ab for y in at]
            else:
                pairs = list(zip(ab, at))
            for (x, y) in pairs:
                c = mhs.get((x, y))
                if c is not None:
                    m.cand_children.add(c.idx)
        by_idx = {m.idx: m for m in mhs.values()}
        for m in mhs.values():
            for ci in m.cand_children:
                by_idx[ci].parents.add(m.idx)
        for m in mhs.values():
            if not m.expr:
                continue
            ab, at = B.args(m.b), T.args(m.t)
            if len(ab) != len(at):
                continue
            if B.is_commutative(m.b) and T.is_commutative(m.t):
                sols = self._matchings(ab, at, mhs)
                best = max(sols, key=len) if sols else []
                m.children = set(mhs[p].idx for p in best)
                m.ambiguous = len(sols) > 1
            else:
                m.children = set(mhs[(x, y)].idx for x, y in zip(ab, at) if (x, y) in mhs)
        res.by_idx = by_idx
        # support constraint: an expression MH is usable only if every argument pair has a usable MH
        def usable(m, memo={}):
            return True
        for m in by_idx.values():
            m.supported = True
        changed = True
        while changed:
            changed = False
            for m in by_idx.values():
                if m.supported and m.expr:
                    need = len(B.args(m.b)) if len(B.args(m.b)) == len(T.args(m.t)) else -1
                    if need < 0 or len(m.children) < need or any(not by_idx[c].supported for c in m.children):
                        m.supported = False
                        changed = True

    @staticmethod
    def _matchings(ab, at, mhs, limit=64):
        sols = []

        def rec(i, used, cur):
            if len(sols) >= limit:
                return
            if i == len(ab):
                sols.append(list(cur))
                return
            for j, y in enumerate(at):
                if j in used or (ab[i], y) not in mhs:
                    continue
                used.add(j)
                cur.append((ab[i], y))
                rec(i + 1, used, cur)
                cur.pop()
                used.discard(j)

        rec(0, set(), [])
        return sols

    # ------------------------------------------------------------------ evidence (step 4a)
    def _evidence(self, res):
        B, T, rs = res.base, res.target, self.rules
        by_idx = res.by_idx
        # topological order: parents before children
        order, seen = [], set()

        def visit(i):
            if i in seen:
                return
            seen.add(i)
            for p in by_idx[i].parents:
                visit(p)
            order.append(i)

        for i in sorted(by_idx):
            visit(i)
        for i in order:
            m = by_idx[i]
            belief = (0.0, 0.0)
            if m.expr:
                b, t = m.b, m.t
                if rs in ("AN", "LS"):
                    if B.functor(b) == T.functor(t):
                        belief = dempster(belief, (0.2, 0.0) if B.kind(b) == FUNCTION else (0.5, 0.0))
                    pot = _children_potential(B, T, b, t)
                    if pot == OK:
                        belief = dempster(belief, (0.4, 0.0))
                    elif pot == MISMATCH:
                        belief = dempster(belief, (0.0, 0.8))
                    if B.kind(b) != FUNCTION and T.kind(t) != FUNCTION:
                        d = abs(B.order(b) - T.order(t))
                        if d == 0:
                            belief = dempster(belief, (0.3, 0.0))
                        elif d == 1:
                            belief = dempster(belief, (0.2, 0.05))
                else:  # MA
                    if B.functor(b) == T.functor(t):
                        if B.kind(b) == ATTRIBUTE:
                            belief = dempster(belief, (0.5, 0.0))
                        elif max(B.order(b), T.order(t)) == 1:
                            belief = dempster(belief, (0.4, 0.0))
            for pi in m.parents:  # systematicity: trickle-down from parents
                p = by_idx[pi]
                if rs in ("AN", "LS"):
                    belief = dempster(belief, (0.8 * p.belief[0], 0.0))
                else:
                    if max(B.order(p.b), T.order(p.t)) <= 1:
                        belief = dempster(belief, (0.9 * p.belief[0], 0.0))
            m.belief = belief

    # ------------------------------------------------------------------ step 2
    def _structure_sets(self, res):
        by_idx = res.by_idx
        order, seen = [], set()

        def post(i):
            if i in seen:
                return
            seen.add(i)
            for c in by_idx[i].children:
                post(c)
            order.append(i)

        for i in sorted(by_idx):
            post(i)
        bt_b, bt_t = {}, {}
        for m in by_idx.values():
            bt_b.setdefault(m.b, set()).add(m.idx)
            bt_t.setdefault(m.t, set()).add(m.idx)
        for m in by_idx.values():
            conf = set(bt_b[m.b]) | set(bt_t[m.t])
            conf.discard(m.idx)
            m.conflicting = sum(1 << j for j in conf)
        for i in order:
            m = by_idx[i]
            B = res.base
            own = 0
            if not m.expr or B.is_function_expr(m.b):
                own = 1 << m.idx
            em, ng = own, m.conflicting
            for c in m.children:
                em |= by_idx[c].emaps
                ng |= by_idx[c].nogood
            m.emaps, m.nogood = em, ng
        for i in order:  # Reachable
            m = by_idx[i]
            r = 1 << m.idx
            for c in m.children:
                r |= by_idx[c].reach
            m.reach = r

    def _gmaps(self, res):
        by_idx = res.by_idx
        self._structure_sets(res)
        if not by_idx:
            return
        roots = [m for m in by_idx.values() if not m.parents]
        g1 = {}

        def add_root(m):
            if not m.supported:
                for c in m.children:
                    add_root(by_idx[c])
            elif not (m.emaps & m.nogood):
                key = m.reach
                g1.setdefault(key, {"elements": m.reach, "nogood": 0, "emaps": 0, "roots": set()})
                g1[key]["roots"].add(m.idx)
                g1[key]["nogood"] |= m.nogood
                g1[key]["emaps"] |= m.emaps
            else:
                for c in m.children:
                    add_root(by_idx[c])

        for m in sorted(roots, key=lambda x: x.idx):
            add_root(m)
        gm1 = list(g1.values())
        for g in gm1:
            g["base_roots"] = self._base_roots(res, g["roots"])

        def consistent(a, b):
            return not (a["elements"] & b["nogood"]) and not (b["elements"] & a["nogood"])

        def maximal_cliques(items):
            n = len(items)
            adj = [set(j for j in range(n) if j != i and consistent(items[i], items[j])) for i in range(n)]
            out = []

            def bk(r, p, x):
                if len(out) > self.max_gmaps:
                    res.truncated = True
                    return
                if not p and not x:
                    out.append(sorted(r))
                    return
                if not p:
                    return
                u = max(p | x, key=lambda v: len(adj[v] & p))
                for v in sorted(p - adj[u]):
                    bk(r | {v}, p & adj[v], x & adj[v])
                    p = p - {v}
                    x = x | {v}

            bk(set(), set(range(n)), set())
            return out

        def merge(items, idxs):
            e = ng = em = 0
            roots, broots = set(), set()
            for i in idxs:
                e |= items[i]["elements"]
                ng |= items[i]["nogood"]
                em |= items[i]["emaps"]
                roots |= items[i]["roots"]
                broots |= items[i]["base_roots"]
            return {"elements": e, "nogood": ng, "emaps": em, "roots": roots, "base_roots": broots}

        # merge step 2: gmaps that share base structure
        comp = list(range(len(gm1)))

        def find(x):
            while comp[x] != x:
                comp[x] = comp[comp[x]]
                x = comp[x]
            return x

        for i, j in itertools.combinations(range(len(gm1)), 2):
            if gm1[i]["base_roots"] & gm1[j]["base_roots"]:
                comp[find(i)] = find(j)
        groups = {}
        for i in range(len(gm1)):
            groups.setdefault(find(i), []).append(i)
        gm2 = {}
        for members in groups.values():
            sub = [gm1[i] for i in members]
            for cl in maximal_cliques(sub):
                g = merge(sub, cl)
                gm2[g["elements"]] = g
        gm2 = list(gm2.values())
        # merge step 3: independent collections
        final = {}
        for cl in maximal_cliques(gm2):
            g = merge(gm2, cl)
            final[g["elements"]] = g
        # keep only maximal element sets
        sets = list(final.values())
        keep = [g for g in sets if not any(h is not g and (g["elements"] & h["elements"]) == g["elements"]
                                           and g["elements"] != h["elements"] for h in sets)]
        for g in keep:
            idxs = [i for i in by_idx if g["elements"] >> i & 1]
            weight = sum(by_idx[i].belief[0] for i in idxs)
            ems = sorted((by_idx[i].b, by_idx[i].t) for i in idxs if not by_idx[i].expr)
            corr = sorted((by_idx[i].b, by_idx[i].t) for i in idxs if by_idx[i].expr)
            res.gmaps.append({"elements": tuple(sorted(idxs)), "weight": weight, "emaps": ems,
                              "correspondences": corr, "candidate_inferences": [], "n_mh": len(idxs)})

    def _base_roots(self, res, root_idxs):
        B = res.base
        out = set()
        for ri in root_idxs:
            x = res.by_idx[ri].b
            stack, seen = [x], set()
            while stack:
                y = stack.pop()
                if y in seen:
                    continue
                seen.add(y)
                ps = B.parents(y)
                if not ps and B.is_expr(y):
                    out.add(y)
                stack.extend(ps)
        return out

    # ------------------------------------------------------------------ step 3
    def _inferences(self, res):
        B, T = res.base, res.target
        by_idx = res.by_idx
        for g in res.gmaps:
            mapping = {}
            for i in g["elements"]:
                m = by_idx[i]
                mapping.setdefault(m.b, m.t)
            matched = set(mapping)
            gm_roots = [i for i in g["elements"] if not (by_idx[i].parents & set(g["elements"]))]
            qualifying = set()
            for ri in gm_roots:
                x = by_idx[ri].b
                stack, seen = [x], set()
                while stack:
                    y = stack.pop()
                    if y in seen:
                        continue
                    seen.add(y)
                    if B.is_expr(y) and not B.parents(y):
                        qualifying.add(y)
                    stack.extend(B.parents(y))
            cand = set()
            for r in qualifying:
                for d in B.descendants(r) | {r}:
                    if B.is_expr(d) and d not in matched and (B.descendants(d) & matched):
                        cand.add(d)
            # keep only maximal unmatched expressions
            tops = [d for d in cand if not any(p in cand for p in B.parents(d))]
            skolems = {}

            def subst(x):
                if x in mapping:
                    return mapping[x]
                if B.is_entity(x):
                    if x in B.constants:
                        return x
                    return skolems.setdefault(x, f"(:skolem {x})")
                f, args = B.exprs[x]
                return "(" + " ".join([f] + [subst(a) for a in args]) + ")"

            out = []
            for d in sorted(tops):
                f, args = B.exprs[d]
                parts = [subst(a) for a in args]
                text = "(" + " ".join([f] + parts) + ")"
                if self._already_in_target(T, f, parts):
                    continue
                out.append({"base_expression": d, "expression": text, "functor": f, "args": parts})
            g["candidate_inferences"] = out
            g["skolems"] = sorted(skolems)

    @staticmethod
    def _already_in_target(T, f, parts):
        for name, (tf, targs) in T.exprs.items():
            if tf != f or len(targs) != len(parts):
                continue
            if list(targs) == parts:
                return True
            if f not in T.commutative and sorted(targs) == sorted(parts) and list(targs) != parts:
                return True  # weak consistency: permuted arguments of a non-commutative predicate
        return False


# --------------------------------------------------------------------------- convenience
def match(base, target, rules="AN", **kw):
    return SME(rules, **kw).match(base, target)


def summarize(res):
    """JSON friendly summary."""
    B, T = res.base, res.target
    return {
        "rules": res.rules,
        "base": B.name,
        "target": T.name,
        "n_match_hypotheses": len(res.mhs),
        "n_gmaps": len(res.gmaps),
        "truncated": res.truncated,
        "gmaps": [
            {
                "rank": g["rank"],
                "ses": round(g["weight"], 6),
                "emaps": [list(e) for e in g["emaps"]],
                "correspondences": [list(c) for c in g["correspondences"]],
                "candidate_inferences": g["candidate_inferences"],
                "skolem_entities": g.get("skolems", []),
            }
            for g in res.gmaps
        ],
    }


def _main(argv):
    import argparse

    ap = argparse.ArgumentParser(description="Structure-Mapping Engine")
    ap.add_argument("base")
    ap.add_argument("target")
    ap.add_argument("--rules", default="AN", choices=RULESETS)
    ap.add_argument("--max-gmaps", type=int, default=2000)
    a = ap.parse_args(argv)
    with open(a.base, encoding="utf-8") as f:
        b = dgroup_from_dict(json.load(f))
    with open(a.target, encoding="utf-8") as f:
        t = dgroup_from_dict(json.load(f))
    r = SME(a.rules, a.max_gmaps).match(b, t)
    sys.stdout.write(json.dumps(summarize(r), indent=2) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
