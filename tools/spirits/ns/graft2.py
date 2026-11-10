# The new Samurai's head and hair, second pass (test only).
#   python3 graft2.py OUT.glb [DBG]
# 1. the bust reconstruction (head, mask, eyes, bangs, crown, crimson tie, scarf) laid on the approved body by its
#    torso (ICP, cached in align.npz), then moved to where the approved drawings have the head (it sat ~4 cm high);
#    the scarf between the body's collar and the chin is eased (no seam);
# 2. the bust's own ponytail, the strands above the tie and the stray strips dropped; the scarf's back repainted
#    crimson where the bust's bake had laid hair on it;
# 3. a new ponytail: closed tapered locks from the tie along the right drawing's arc (pony.py);
# 4. one mesh, one atlas: the body's texture, the bust's, and the locks' strip under them.
import sys, os, json, numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree
from scipy import ndimage
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
import glbio, pony
OUT = sys.argv[1]; DBG = len(sys.argv) > 2
B = glbio.read('../h3d/stripped2.glb'); U = glbio.read('../bustbake/bust_prep.glb')
BP, BI, BUV = B['P'], B['I'], B['UV']; UP, UI, UUV = U['P'], U['I'], U['UV']
TB = np.asarray(Image.open('../h3d/tex4.png' if os.path.exists('../h3d/tex4.png') else '../h3d/tex3.png').convert('RGB')); TU = np.asarray(Image.open('../bustbake/bust_tex.png').convert('RGB')).copy()

def colours(I, UV, T):
    S = T.shape[0]; c = UV[I].mean(1); px = np.clip((c * S).astype(int), 0, S - 1); return T[px[:, 1], px[:, 0]].astype(np.float64)
def classes(col):
    r, g, b = col[:, 0], col[:, 1], col[:, 2]; mx = col.max(1); mn = col.min(1)
    hair = (mx > 150) & ((mx - mn) / np.maximum(mx, 1) < 0.38)
    crim = (r > g * 1.6) & (r > b * 1.15) & (r > 90)
    crim_l = (g < 0.55 * r) & (b < 0.95 * r) & (r > 45)       # crimson, its dark folds too (not gold, not purple)
    return hair, crim, crim_l
bcol = colours(BI, BUV, TB); ucol = colours(UI, UUV, TU)
bhair, bcrim, _ = classes(bcol); uhair, ucrim, ucrim_l = classes(ucol)
bc = BP[BI].mean(1)

# ---------------- 1. the bust on the body (cached)
def xf(P, s, R, t): return (P @ R.T) * s + t
if os.path.exists('align.npz'):
    A = np.load('align.npz'); s, R, t = float(A['s']), A['R'], A['t']
else:
    uc = UP[UI].mean(1); ub0, ub1 = UP.min(0), UP.max(0)
    s = (1.80 - 1.04) / (ub1[1] - ub0[1]); t = np.array([0 - (ub0[0] + ub1[0]) / 2 * s, 1.04 - ub0[1] * s, 0.0]); R = np.eye(3)
    ub_ch = UP[(UP[:, 1] - ub0[1]) / (ub1[1] - ub0[1]) < 0.2]; t[2] = 0.06 - ub_ch[:, 2].max() * s
    utor = uc[~uhair & (((uc[:, 1] - ub0[1]) / (ub1[1] - ub0[1])) < 0.55)]
    btor = bc[~bhair & (bc[:, 1] > 1.06) & (bc[:, 1] < 1.56) & (np.abs(bc[:, 0]) < 0.4)]
    tree = cKDTree(btor)
    for it in range(40):
        Q = xf(utor, s, R, t); d, j = tree.query(Q); keep = d < np.percentile(d, 80); Am = utor[keep]; Bm = btor[j[keep]]
        ma, mb = Am.mean(0), Bm.mean(0); A0, B0 = Am - ma, Bm - mb
        Cov = B0.T @ A0 / len(Am); Uu, Ss, Vt = np.linalg.svd(Cov); D = np.eye(3); D[2, 2] = np.sign(np.linalg.det(Uu @ Vt))
        R = Uu @ D @ Vt; s = (Ss * np.diag(D)).sum() / (A0 ** 2).sum() * len(Am); t = mb - s * (R @ ma)
    np.savez('align.npz', s=s, R=R, t=t)
UPb = xf(UP, s, R, t); ucb = UPb[UI].mean(1)

# ---------------- 2. what of the bust is kept
scarf_top = np.percentile(ucb[ucrim & (np.abs(ucb[:, 0]) < 0.12) & (ucb[:, 1] > 1.35) & (ucb[:, 1] < 1.62) & (ucb[:, 2] > -0.03), 1], 92)
scarf_bot = 1.428
Ec = np.array([0.0, 1.645, -0.025]); Er = np.array([0.165, 0.17, 0.15])
inE = (((ucb - Ec) / Er) ** 2).sum(1) <= 1.0
T0 = np.array([-0.0038, 1.7563, -0.1298]); n0 = np.array([-0.358, 0.889, -0.287]); n0 /= np.linalg.norm(n0)
dT = ucb - T0; along = dT @ n0; radial = np.linalg.norm(dT - along[:, None] * n0, axis=1)
tie = ucrim_l & (np.abs(along) < 0.03) & (radial < 0.075)
plume = (along > 0.010) & (radial < 0.13) & ~tie
spikes = ucb[:, 1] > 1.79
neck_r = np.hypot(ucb[:, 0] / 0.20, (ucb[:, 2] + 0.03) / 0.17)
ring = (ucb[:, 1] > scarf_bot - 0.012) & (ucb[:, 1] <= scarf_top + 0.012) & (neck_r < 1.0)
ring &= ~((ucb[:, 1] < 1.46) & ~ucrim_l & ~uhair)                      # the bust's own pauldron edges at the band's foot
back_hair = uhair & (ucb[:, 2] < -0.172) & ~tie                        # what is left of the bust's ponytail by the head
ring &= ~(uhair & (ucb[:, 1] < 1.435))                                  # pale crumbs at the scarf's foot
ukeep = ((inE & ~plume & ~spikes & ~back_hair) | tie | ring)
ukeep &= ~(uhair & (ucb[:, 1] < 1.515) & ~ring)                         # strands hanging past the chin into the scarf
# the strips that hang off the scarf's surface below the chin (thin hair crumbs over the scarf)
low = ring & uhair & (ucb[:, 1] < scarf_top - 0.005)
if low.any():
    ang = np.arctan2(ucb[:, 0], ucb[:, 2] + 0.03); rr_ = np.hypot(ucb[:, 0], ucb[:, 2] + 0.03)
    sc = ring & ~uhair
    key = lambda m: (np.clip(((ucb[m, 1] - 1.40) / 0.012).astype(int), 0, 30) * 48 + ((ang[m] + np.pi) / (2 * np.pi) * 48).astype(int) % 48)
    med = np.full(31 * 48, np.nan); kk = key(sc)
    for q in np.unique(kk): med[q] = np.median(rr_[sc][kk == q])
    dl = np.abs(rr_[low] - med[key(low)]); off_surface = ~(dl < 0.014)
    li = np.where(low)[0]; ukeep[li[off_surface]] = False
# small islands (crumbs of the cut)
kf = np.where(ukeep)[0]
_, weld = np.unique(np.round(UP / 1e-5).astype(np.int64), axis=0, return_inverse=True); weld = weld.ravel()
Fk = weld[UI[kf]]; nV = weld.max() + 1
rows = np.concatenate([Fk[:, 0], Fk[:, 1], Fk[:, 2]]); cols = np.concatenate([Fk[:, 1], Fk[:, 2], Fk[:, 0]])
ncomp, lab = connected_components(coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(nV, nV)), directed=False)
fl = lab[Fk[:, 0]]; cnt = np.bincount(fl, minlength=ncomp); small = cnt[fl] < 0.004 * len(kf)
ukeep[kf[small]] = False
print('scarf %.3f..%.3f' % (scarf_bot, scarf_top), 'kept', ukeep.sum(), 'of', len(UI), '(tie', tie.sum(), 'ring', (ring & ukeep).sum(), 'islands', small.sum(), ')')

# ---------------- the side curls at the ears pulled in towards the head (they read as horns)
vh = np.zeros(len(UPb)); vh[UI[ukeep & uhair & inE].ravel()] = 1
wy = pony.smooth(1.545, 1.585, UPb[:, 1]) * (1 - pony.smooth(1.70, 1.735, UPb[:, 1])) * vh
ax = np.abs(UPb[:, 0]); over = np.maximum(ax - 0.118, 0)
UPb[:, 0] = np.sign(UPb[:, 0]) * (ax - wy * over * 0.80)
# ---------------- the scarf's foot flared out to the body's collar (no gap between them)
ringk = ring & ukeep
rc = ucb[ringk & (ucb[:, 1] > 1.43) & (ucb[:, 1] < 1.47)]; ax0 = np.array([rc[:, 0].mean(), rc[:, 2].mean()])
def polar(X, Z): return np.arctan2(X - ax0[0], Z - ax0[1]), np.hypot(X - ax0[0], Z - ax0[1])
NB = 36
bkeep_c = bc[~((bc[:, 1] > 1.435) & (np.abs(bc[:, 0]) < 0.17))]
bcol_k = bcol[~((bc[:, 1] > 1.435) & (np.abs(bc[:, 0]) < 0.17))]
cm = (bkeep_c[:, 1] > 1.395) & (bkeep_c[:, 1] < 1.44) & (bcol_k[:, 1] < 0.55 * bcol_k[:, 0]) & (bcol_k[:, 2] < 0.95 * bcol_k[:, 0])
th_c, r_c = polar(bkeep_c[cm, 0], bkeep_c[cm, 2]); bin_c = ((th_c + np.pi) / (2 * np.pi) * NB).astype(int) % NB
bm = ringk & (ucb[:, 1] < 1.445)
th_b, r_b = polar(ucb[bm, 0], ucb[bm, 2]); bin_b = ((th_b + np.pi) / (2 * np.pi) * NB).astype(int) % NB
RC = np.array([np.percentile(r_c[bin_c == q], 90) if (bin_c == q).sum() > 3 else np.nan for q in range(NB)])
RB = np.array([np.percentile(r_b[bin_b == q], 50) if (bin_b == q).sum() > 3 else np.nan for q in range(NB)])
K = np.where(np.isfinite(RC) & np.isfinite(RB), np.maximum(1.0, (RC + 0.006) / np.maximum(RB, 1e-3)), 1.0)
K = np.minimum(K, 1.6); K = ndimage.uniform_filter1d(K, 3, mode='wrap')
thv, rv = polar(UPb[:, 0], UPb[:, 2]); kv = np.interp((thv + np.pi) / (2 * np.pi) * NB - 0.5, np.arange(-1, NB + 1), np.r_[K[-1], K, K[0]])
fl = (1 - pony.smooth(1.420, 1.475, UPb[:, 1])) * (UPb[:, 1] > 1.36)
scale = 1 + (kv - 1) * fl
UPb[:, 0] = ax0[0] + (UPb[:, 0] - ax0[0]) * scale; UPb[:, 2] = ax0[1] + (UPb[:, 2] - ax0[1]) * scale
print('scarf foot flare: max %.2f mean %.2f' % (K.max(), K.mean()))
ucb = UPb[UI].mean(1)
# ---------------- the head where the drawings have it; the scarf eased between the collar and the chin
DH = np.array([-0.013, -0.042, -0.012])
w = pony.smooth(1.432, 1.530, UPb[:, 1])
UPs = UPb + w[:, None] * DH
# ---------------- GPT 10 Nov (light clean-up before the rig): the reconstruction's thin hair shells at the jaw, along the
# mask's upper edge and at the nape read crumpled: eased (Taubin, so they keep their volume) and their glassy greys
# (the bake's ground and the mask's dark caught on their edges) laid back in the hair's own lavender-white
cs = UPs[UI].mean(1)
facebox = (np.abs(cs[:, 0]) < 0.082) & (cs[:, 2] > -0.015) & (cs[:, 1] > 1.528)     # the eyes, the mask: untouched
zone_f = ukeep & ~ring & (cs[:, 1] < 1.600) & (cs[:, 1] > 1.47) & ~facebox
zone_v = np.zeros(len(UPs), bool); zone_v[UI[zone_f].ravel()] = True
# the welded neighbours (the reconstruction's vertices are split at uv seams)
_, wv = np.unique(np.round(UPs / 1e-6).astype(np.int64), axis=0, return_inverse=True); wv = wv.ravel()
Fz = wv[UI[ukeep]]; nW = wv.max() + 1
rws = np.concatenate([Fz[:, 0], Fz[:, 1], Fz[:, 2], Fz[:, 1], Fz[:, 2], Fz[:, 0]]); cls = np.concatenate([Fz[:, 1], Fz[:, 2], Fz[:, 0], Fz[:, 0], Fz[:, 1], Fz[:, 2]])
Adj = coo_matrix((np.ones(len(rws)), (rws, cls)), shape=(nW, nW)).tocsr(); Adj.data[:] = 1
deg = np.asarray(Adj.sum(1)).ravel(); deg[deg == 0] = 1
Wpos = np.zeros((nW, 3)); np.add.at(Wpos, wv, UPs); cntW = np.bincount(wv, minlength=nW).astype(float); Wpos /= np.maximum(cntW, 1)[:, None]
mov = np.zeros(nW, bool); mov[wv[zone_v]] = True
# the zone's rim stays put (no step where it meets the rest)
yv = Wpos[:, 1]; wgt = (mov * (1 - pony.smooth(1.585, 1.600, yv)) * pony.smooth(1.47, 1.49, yv))[:, None]
for it in range(8):
    for lam in (0.5, -0.53):
        L = (Adj @ Wpos) / deg[:, None] - Wpos
        Wpos = Wpos + lam * wgt * L
UPs = Wpos[wv]

# ---------------- the scarf's back: the bust's bake laid the old ponytail's colour on it; repainted from its crimson
ringf = np.where(ring & ukeep)[0]
S_ = TU.shape[0]; mask = Image.new('L', (S_, S_), 0); d = ImageDraw.Draw(mask)
for f in ringf:
    tri = UUV[UI[f]] * S_; d.polygon([tuple(p) for p in tri], fill=255)
M = ndimage.binary_dilation(np.asarray(mask) > 0, iterations=2)
Tf = TU.astype(np.float64); mx = Tf.max(2); mn = Tf.min(2); r_, g_, b_ = Tf[..., 0], Tf[..., 1], Tf[..., 2]
good = M & (g_ < 0.55 * r_) & (b_ < 0.95 * r_) & (r_ > 45)
pale_t = (mx > 135) & ((mx - mn) / np.maximum(mx, 1) < 0.42)
bad = M & pale_t & ~good
fill = Tf.copy(); known = good.astype(np.float64)
for sig in (2, 4, 8, 16, 32, 64):
    num = np.stack([ndimage.gaussian_filter(Tf[..., k] * known, sig) for k in range(3)], -1); den = ndimage.gaussian_filter(known, sig)
    ok = bad & (den > 0.02) & ~(known > 0)
    fill[ok] = num[ok] / den[ok, None]; known = np.where(ok, 1.0, known)
# keep a little of the original's light/dark so the folds still read
lum = Tf.mean(2); lf = ndimage.gaussian_filter(lum, 3)
shade = np.clip(0.80 + 0.35 * (lf - 150) / 100, 0.65, 1.15)
fill2 = fill.copy(); fill2[bad] = np.clip(fill[bad] * shade[bad, None], 0, 255)
TU2 = TU.copy(); TU2[bad] = fill2[bad].astype(np.uint8)
zmask = Image.new('L', (S_, S_), 0); dz = ImageDraw.Draw(zmask)
for f in np.where(zone_f & uhair)[0]:
    dz.polygon([tuple(p) for p in UUV[UI[f]] * S_], fill=255)
Zm = np.asarray(zmask) > 0
Z2 = TU2.astype(np.float64); zmx = Z2.max(2); zmn = Z2.min(2); zsat = (zmx - zmn) / np.maximum(zmx, 1)
greyish = Zm & (zsat < 0.20) & (zmx > 70)
lumz = Z2.mean(2)
lav_hi = np.array([238, 228, 248.]); lav_lo = np.array([170, 145, 200.])
tt = np.clip((lumz - 90) / 140, 0, 1)[..., None]
Z2[greyish] = (lav_lo * (1 - tt) + lav_hi * tt)[greyish]
TU2 = np.clip(Z2, 0, 255).astype(np.uint8)
print('glassy grey texels re-tinted', int(greyish.sum()))
print('scarf texels repainted', int(bad.sum()), 'of', int(M.sum()))

# ---------------- what of the body is dropped: its head and what is left of its hair above the collar
bdrop = ((bc[:, 1] > 1.47) & (np.abs(bc[:, 0]) < 0.13) & ~bcrim) | (bc[:, 1] > 1.58) | (bhair & (bc[:, 1] > 1.40) & (np.abs(bc[:, 0]) < 0.17))
# the old collar's crumbs above the new scarf's foot: only what lies inside the (flared) scarf's footprint
thb, rbb = polar(bc[:, 0], bc[:, 2]); qb = ((thb + np.pi) / (2 * np.pi) * NB).astype(int) % NB
RBf = np.where(np.isfinite(RB), RB * K, np.nanmedian(RB * K))
bdrop |= (bc[:, 1] > 1.435) & (rbb < RBf[qb] - 0.004)
bdrop |= bcrim & (bc[:, 1] > 1.50)                                      # the old scarf's top (the new one wraps the neck)
# the body's own small islands (crumbs left by the strip)
_, bweld = np.unique(np.round(BP / 1e-5).astype(np.int64), axis=0, return_inverse=True); bweld = bweld.ravel()
bk_ = np.where(~bdrop)[0]; Fb = bweld[BI[bk_]]; nVb = bweld.max() + 1
rws = np.concatenate([Fb[:, 0], Fb[:, 1], Fb[:, 2]]); cls = np.concatenate([Fb[:, 1], Fb[:, 2], Fb[:, 0]])
nb_, lb_ = connected_components(coo_matrix((np.ones(len(rws)), (rws, cls)), shape=(nVb, nVb)), directed=False)
fb = lb_[Fb[:, 0]]; cb = np.bincount(fb, minlength=nb_); bsmall = (cb[fb] < 60) & (bc[bk_, 1] > 1.30)
bdrop[bk_[bsmall]] = True
print('body crumbs dropped', int(bsmall.sum()))
bI = BI[~bdrop]

# ---------------- 3. the ponytail
bk = BP[np.unique(bI)]
gx = np.arange(-0.50, 0.51, 0.01); gy = np.arange(0.80, 1.70, 0.01)
zb = np.full((len(gx), len(gy)), np.inf)
ix = np.clip(np.round((bk[:, 0] - gx[0]) / 0.01).astype(int), 0, len(gx) - 1); iy = np.clip(np.round((bk[:, 1] - gy[0]) / 0.01).astype(int), 0, len(gy) - 1)
inb = (bk[:, 1] >= gy[0]) & (bk[:, 1] <= gy[-1])
np.minimum.at(zb, (ix[inb], iy[inb]), bk[inb, 2])
zb = ndimage.minimum_filter(zb, size=5)
def body_back(x, y):
    i = np.clip(np.round((x - gx[0]) / 0.01).astype(int), 0, len(gx) - 1); j = np.clip(np.round((y - gy[0]) / 0.01).astype(int), 0, len(gy) - 1)
    out = zb[i, j]; out[(y < gy[0]) | (y > gy[-1])] = np.inf; return out
T0s = np.array([-0.018, 1.718, -0.127])          # the tie ring's centre as seen (front and side views of the moved head)
spine = [T0s - 0.025 * n0, T0s, T0s + 0.045 * n0 + np.array([0, 0, -0.012]),
         [-0.030, 1.785, -0.205], [-0.035, 1.755, -0.240], [-0.040, 1.680, -0.252], [-0.045, 1.580, -0.258],
         [-0.045, 1.480, -0.276], [-0.040, 1.380, -0.282], [-0.030, 1.270, -0.272], [-0.020, 1.160, -0.270],
         [-0.010, 1.060, -0.276], [0.000, 0.985, -0.285]]
def hd_fn(t, S):
    y = S[:, 1]; v = np.interp(-y, -np.array([1.70, 1.60, 1.50, 1.40, 1.30, 1.20, 1.10, 1.00]), [0.068, 0.092, 0.115, 0.112, 0.092, 0.080, 0.056, 0.024])
    rise = pony.smooth(0.0, 0.22, t); return 0.058 * (1 - rise) + v * rise
def hw_fn(t, S):
    y = S[:, 1]; v = np.interp(-y, -np.array([1.70, 1.60, 1.50, 1.40, 1.30, 1.20, 1.10, 1.00]), [0.075, 0.090, 0.100, 0.095, 0.070, 0.055, 0.040, 0.018])
    rise = pony.smooth(0.0, 0.22, t); return 0.072 * (1 - rise) + v * rise
PV, PF, PUV, PLK, frame = pony.build(spine, hd_fn, hw_fn, T0s, n0, body_back=body_back)
# the plug: the gathered hair filling the tie ring (its opening showed the sky)
mn_ax = np.array([-0.799, -0.45, -0.399]); m_ = 10; s_ = np.linspace(0, 1, m_)
Cp = T0s[None, :] + ((-0.022 + 0.036 * s_))[:, None] * n0[None, :]
rp = 0.025 * (1 - 0.40 * pony.smooth(0.70, 1.0, s_)) + 0.002
Vp, Fp, UVp = pony.sweep(Cp, rp, np.tile(mn_ax, (m_, 1)), 10, 1, 4, lens_w=1.08, lens_t=0.95)
PF = np.vstack([PF, Fp + len(PV)]); PV = np.vstack([PV, Vp]); PUV = np.vstack([PUV, UVp])
print('ponytail verts', len(PV), 'tris', len(PF))
strip = pony.hair_strip(2048, 512, 4)
json.dump({'spine': frame[1].round(5).tolist(), 'tie': T0s.round(5).tolist(), 'axis': n0.round(5).tolist(), 'pony_verts': PV.round(5).tolist()}, open('pony_rig.json', 'w'))

# ---------------- 4. one mesh, one atlas
Ht = 2048 * 2 + 512
atlas = np.zeros((Ht, 2048, 3), np.uint8)
atlas[:2048] = np.asarray(Image.fromarray(TB).resize((2048, 2048))); atlas[2048:4096] = np.asarray(Image.fromarray(TU2).resize((2048, 2048))); atlas[4096:] = strip
Image.fromarray(atlas).save('graft2_tex.png')
uI = UI[ukeep] + len(BP); pI = PF + len(BP) + len(UP)
P = np.vstack([BP, UPs, PV]); I = np.vstack([bI, uI, pI])
UVa = np.vstack([np.stack([BUV[:, 0], BUV[:, 1] * 2048 / Ht], 1), np.stack([UUV[:, 0], (2048 + UUV[:, 1] * 2048) / Ht], 1), np.stack([PUV[:, 0], (4096 + PUV[:, 1] * 512) / Ht], 1)])
used = np.unique(I); remap = -np.ones(len(P), int); remap[used] = np.arange(len(used))
glbio.write(OUT, P[used], remap[I], UVa[used], 'graft2_tex.png')
print('wrote', OUT, 'tris', len(I), '(body', len(bI), '+ head', len(uI), '+ ponytail', len(pI), ')')
if DBG:
    np.savez('graft2_dbg.npz', P=P, I=I, nb=len(bI), nu=len(uI), UVa=UVa)
    for nm, II in (('g2dbg_body', bI), ('g2dbg_head', uI), ('g2dbg_pony', pI)):
        u2 = np.unique(II); rm2 = -np.ones(len(P), int); rm2[u2] = np.arange(len(u2)); glbio.write(nm + '.glb', P[u2], rm2[II], UVa[u2], 'graft2_tex.png')
