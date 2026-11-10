# The ponytail as a few closed, tapered locks swept along one spine (test only): GPT's brief, 10 Nov — about 6 to 10
# principal locks from the high crimson tie, one graceful arc back and down that follows the right-side drawing,
# fuller near the tie, pale silver-white with lavender shading. Its envelope (depth from the side drawings, width from
# the back drawing) is in pony_env.json; the spine and the locks are laid inside it.
import numpy as np
from scipy.interpolate import CubicSpline

def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def spline(pts, n):
    P = np.asarray(pts, float); d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    cs = CubicSpline(d / d[-1], P, bc_type='natural'); t = np.linspace(0, 1, n); S = cs(t)
    T = cs(t, 1); T /= np.linalg.norm(T, axis=1, keepdims=True); return t, S, T, d[-1]

def rmf(X, T, N0):
    """Rotation-minimizing normals along a polyline X with unit tangents T (double reflection, Wang et al. 2008)."""
    N = np.zeros_like(T); N[0] = N0 - T[0] * (N0 @ T[0]); N[0] /= np.linalg.norm(N[0])
    for i in range(len(T) - 1):
        v1 = X[i + 1] - X[i]; c1 = v1 @ v1
        if c1 < 1e-14: N[i + 1] = N[i]; continue
        rL = N[i] - (2 / c1) * (v1 @ N[i]) * v1; tL = T[i] - (2 / c1) * (v1 @ T[i]) * v1
        v2 = T[i + 1] - tL; c2 = v2 @ v2
        N[i + 1] = rL - (2 / c2) * (v2 @ rL) * v2 if c2 > 1e-14 else rL
        N[i + 1] -= T[i + 1] * (N[i + 1] @ T[i + 1]); N[i + 1] /= np.linalg.norm(N[i + 1])
    return N

def interp_by_y(ytab, vals, y):
    ytab = np.asarray(ytab); vals = np.asarray(vals); o = np.argsort(ytab); return np.interp(y, ytab[o], vals[o])

# lock: slot (a: out/in of the sweep, b: lateral, in units of the local half-depth / half-width), rr radius (of the
# local half-depth), t_end (along the spine), drift (world x, lower half), flick (tip outward), ph (wave phase), tile
LOCKS = [
    dict(a=+0.00, b=+0.00, rr=0.46, t_end=1.00, drift=0.00, flick=0.030, ph=0.0, tile=0),
    dict(a=+0.80, b=+0.05, rr=0.42, t_end=0.93, drift=0.00, flick=0.045, ph=3.6, tile=2),
    dict(a=-0.70, b=-0.05, rr=0.40, t_end=0.78, drift=0.00, flick=0.030, ph=1.3, tile=1),
    dict(a=+0.45, b=+0.70, rr=0.40, t_end=0.90, drift=0.03, flick=0.040, ph=2.1, tile=3),
    dict(a=+0.45, b=-0.70, rr=0.40, t_end=0.96, drift=-0.03, flick=0.040, ph=0.7, tile=1),
    dict(a=-0.42, b=+0.74, rr=0.37, t_end=0.74, drift=0.04, flick=0.040, ph=2.8, tile=0),
    dict(a=-0.42, b=-0.74, rr=0.37, t_end=0.82, drift=-0.04, flick=0.040, ph=1.9, tile=2),
    dict(a=+0.62, b=-0.95, rr=0.36, t_end=0.86, drift=-0.11, flick=0.045, ph=0.4, tile=3),
    dict(a=+0.40, b=-1.00, rr=0.30, t_end=0.70, drift=-0.08, flick=0.040, ph=2.4, tile=1),
    dict(a=+0.20, b=+1.00, rr=0.30, t_end=0.60, drift=+0.06, flick=0.040, ph=1.1, tile=0),
]
# the fountain at the tie: short locks that leave the tie up and fall over it (front, sides, back), seen above the head
# from the front and in the side views (alpha: towards the face, beta: lateral, in the tie's own frame)
FOUNTAIN = []

def sweep(C, r, D, sides, tile, tiles, body_back=None, lens_w=1.25, lens_t=0.62):
    """A closed tapered lock round the centreline C (m x 3) with radius r (m) and its thickness direction D (m x 3)."""
    Tk = np.gradient(C, axis=0); Tk /= np.maximum(np.linalg.norm(Tk, axis=1, keepdims=True), 1e-9)
    D = D - Tk * np.sum(D * Tk, 1, keepdims=True); D /= np.maximum(np.linalg.norm(D, axis=1, keepdims=True), 1e-9)
    Fk = np.cross(Tk, D); Fk /= np.maximum(np.linalg.norm(Fk, axis=1, keepdims=True), 1e-9)
    th = np.linspace(0, 2 * np.pi, sides + 1); cu, su = np.cos(th), np.sin(th)
    lens = np.sign(cu) * np.abs(cu) ** 0.85
    Vk = (C[:, None, :] + (r * lens_w)[:, None, None] * lens[None, :, None] * Fk[:, None, :]
          + (r * lens_t)[:, None, None] * su[None, :, None] * D[:, None, :])
    if body_back is not None:
        from scipy.ndimage import maximum_filter1d, gaussian_filter1d
        zb = body_back(Vk[..., 0].ravel(), Vk[..., 1].ravel()).reshape(Vk.shape[:2])
        need = np.max(np.maximum(0, Vk[..., 2] - (zb - 0.014)), axis=1)
        need = gaussian_filter1d(maximum_filter1d(need, 5), 1.5)
        Vk[..., 2] -= need[:, None]
    m = len(C); U_ = (tile % tiles + np.linspace(0.04, 0.96, sides + 1)) / tiles; V_ = 0.02 + 0.96 * np.linspace(0, 1, m)
    UVk = np.stack(np.meshgrid(U_, V_), -1).reshape(-1, 2)
    W1 = sides + 1; F = []
    for i in range(m - 1):
        for j in range(sides):
            a0 = i * W1 + j; a1 = a0 + 1; b0 = a0 + W1; b1 = b0 + 1
            F.append((a0, b0, a1)); F.append((a1, b0, b1))
    return Vk.reshape(-1, 3), np.array(F, np.int64), UVk

def build(spine_pts, hd_fn, hw_fn, tie_c, tie_n, n=160, rings=30, sides=8, tiles=4, body_back=None):
    """spine_pts: control points from the tie up, over and down; hd_fn/hw_fn(t, S): the half-depth and the half-width
    along the spine; tie_c/tie_n: the tie ring's centre and axis (the fountain's root). Returns V, F, UV (UV in the hair
    strip: u across `tiles` side-by-side tiles, v along the lock) and the per-vertex lock index."""
    t, S, T, Ltot = spline(spine_pts, n)
    Nr = rmf(S, T, np.array([0.0, 0.0, -1.0])); Nout = -Nr
    if Nout[-1] @ np.array([0, 0, -1.0]) < 0: Nout = -Nout
    Bl = np.cross(T, Nout); Bl /= np.linalg.norm(Bl, axis=1, keepdims=True)
    if Bl[-1][0] < 0: Bl = -Bl
    hd = hd_fn(t, S); hw = hw_fn(t, S)
    V, F, UV, LK = [], [], [], []
    def add(Vk, Fk, UVk, k):
        F.append(Fk + sum(len(v) for v in V)); V.append(Vk); UV.append(UVk); LK.append(np.full(len(Vk), k))
    for k, L in enumerate(LOCKS):
        te = L['t_end']; m = max(10, int(rings * (0.45 + 0.55 * te)))
        s = np.linspace(0, 1, m); tt = s * te; idx = np.clip(tt * (n - 1), 0, n - 1)
        def at(A): return np.stack([np.interp(idx, np.arange(n), A[:, j]) for j in range(A.shape[1])], 1)
        Sk, Nk, Bk = at(S), at(Nout), at(Bl)
        hdk = np.interp(idx, np.arange(n), hd); hwk = np.interp(idx, np.arange(n), hw)
        spread = smooth(0.0, 0.18, tt)
        # the radius: gathered in the tie, full soon after it, holding its width, then a pointed tip
        prof = (0.42 + 0.58 * smooth(0.0, 0.12, tt)) * (1 - smooth(0.62, 1.0, s)) ** 0.62 * (1 - 0.18 * smooth(0.1, 0.55, s)) + 0.004
        r = L['rr'] * np.maximum(hdk, 0.03) * prof
        fan = 1 + 0.55 * smooth(0.55, 1.0, s)
        off = (spread * fan)[:, None] * (L['a'] * 0.84 * hdk[:, None] * Nk + L['b'] * 0.76 * hwk[:, None] * Bk)
        off += (L['drift'] * smooth(0.20, 0.62, tt))[:, None] * np.array([1.0, 0, 0])
        wave = 0.018 * np.sin(2 * np.pi * 1.25 * tt + L['ph']) * smooth(0.22, 0.5, tt)
        wave2 = 0.012 * np.sin(2 * np.pi * 0.9 * tt + 1.7 * L['ph']) * smooth(0.22, 0.5, tt)
        off += wave[:, None] * Bk + wave2[:, None] * Nk
        D = L['a'] * Nk + L['b'] * Bk + 0.35 * Nk
        off += (0.45 * L['flick'] * smooth(0.70, 1.0, s) ** 2)[:, None] * (D / np.maximum(np.linalg.norm(D, axis=1, keepdims=True), 1e-9))
        Vk, Fk, UVk = sweep(Sk + off, r, D, sides, L['tile'], tiles, body_back)
        add(Vk, Fk, UVk, k)
    # the fountain
    n0 = tie_n / np.linalg.norm(tie_n); e1 = np.array([0, 0, 1.0]) - n0 * n0[2]; e1 /= np.linalg.norm(e1); e2 = np.cross(n0, e1)
    R0 = tie_c + 0.012 * n0
    for j, L in enumerate(FOUNTAIN):
        m = 14; s = np.linspace(0, 1, m)
        d0 = n0 + L['al'] * e1 + L['be'] * e2; d0 /= np.linalg.norm(d0)
        C = R0[None, :] + (L['L'] * s)[:, None] * d0[None, :] + (L['droop'] * s ** 2)[:, None] * np.array([0, -1.0, 0])
        C += (0.006 * s)[:, None] * n0       # a little lift out of the tie
        r = L['r'] * (0.55 + 0.45 * smooth(0.0, 0.2, s)) * (1 - smooth(0.35, 1.0, s)) ** 0.85 + 0.0015
        D = np.cross(d0, np.cross(n0, d0) + 1e-6) if abs(L['be']) < 0.5 else np.tile(n0, (m, 1))
        D = np.tile(D, (m, 1)) if D.ndim == 1 else D
        Vk, Fk, UVk = sweep(C, r, D, 6, L['tile'], tiles, lens_w=1.05, lens_t=0.6)
        add(Vk, Fk, UVk, len(LOCKS) + j)
    V = np.vstack(V); UV = np.vstack(UV); LK = np.concatenate(LK); F = np.vstack(F)
    return V, F, UV, LK, (t, S, T, Nout, Bl)

def hair_strip(w=2048, h=512, tiles=4, seed=5):
    """The locks' texture: `tiles` variants side by side; u round the lock (u .25 its outer face, .75 its inner face,
    0 / .5 its edges), v along it (root at the top). Pale silver-white with lavender shading and strand lines (the
    drawings' palette)."""
    rng = np.random.default_rng(seed)
    img = np.zeros((h, w, 3)); tw = w // tiles
    hi = np.array([246, 238, 252.]); light = np.array([230, 216, 244.]); mid = np.array([204, 184, 228.])
    lav = np.array([172, 136, 204.]); dark = np.array([138, 104, 164.])
    yy = np.linspace(0, 1, h)[:, None]; x = np.linspace(0, 1, tw)[None, :]
    for k in range(tiles):
        # round the lens: light outer face, mid edges, lavender inner face
        outer = np.clip(np.cos(2 * np.pi * (x - 0.25)), 0, 1) ** 0.7
        inner = np.clip(np.cos(2 * np.pi * (x - 0.75)), 0, 1) ** 0.9
        base = mid[None, None, :] + (light - mid)[None, None, :] * outer[..., None] + (lav - mid)[None, None, :] * inner[..., None]
        base = np.repeat(base, h, 0)
        # strand lines: lavender grooves that start and fade along the lock
        n_l = 70; pos = rng.random(n_l); wid = rng.uniform(0.002, 0.009, n_l); st = rng.uniform(0.35, 1.0, n_l)
        v0 = rng.uniform(-0.2, 0.5, n_l); v1 = rng.uniform(0.55, 1.15, n_l)
        L = np.zeros((h, tw))
        for p, wd, a_, s0, s1 in zip(pos, wid, st, v0, v1):
            along = np.clip((yy - s0) / 0.08, 0, 1) * np.clip((s1 - yy) / 0.12, 0, 1)
            L = np.maximum(L, a_ * np.exp(-((x - p) / wd) ** 2) * along)
        base = base * (1 - 0.75 * L[..., None]) + lav[None, None, :] * 0.75 * L[..., None]
        # bright strands on the outer face
        for p in rng.uniform(0.08, 0.42, 14):
            s0 = rng.uniform(0.0, 0.4); hl = 0.6 * np.exp(-((x - p) / 0.004) ** 2) * np.exp(-((yy - s0 - 0.2) / 0.22) ** 2)
            base = base * (1 - hl[..., None]) + hi[None, None, :] * hl[..., None]
        # darker in the tie, a lavender cast towards the tip
        root = np.exp(-yy / 0.06)[..., None]
        base = base * (1 - 0.75 * root) + dark[None, None, :] * 0.75 * root
        tip = (smooth(0.50, 1.0, yy) * 0.42)[..., None]
        base = base * (1 - tip) + lav[None, None, :] * tip
        img[:, k * tw:(k + 1) * tw] = base
    return np.clip(img, 0, 255).astype(np.uint8)
