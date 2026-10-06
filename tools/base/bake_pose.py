# bake_pose.py <gpt_image> <sheet_json> : GPT redrew POSES (not just clothes) → new base frames.
# The whole figure is GPT's. Per frame: key magenta, upscale 256→352, align the hips (shorts) with the frame it replaces
# (so switching animations never jumps) and keep the cycle's feet on the ground, then label hair / skin / shirt /
# shorts / shoes / sword (sword = the long thin steel shape + its gold guard).
# Writes the base strips (<anim>.png, _m.png, _weapon.png) for the cells listed in the sheet json.
import json, sys, os, numpy as np
from PIL import Image
from scipy import ndimage as nd
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352; C = 256
img, sj = sys.argv[1], sys.argv[2]
cells = json.load(open(sj))['cells']
BASE = G + 'public/assets/final/body/warrior/base/'
gi = Image.open(img).convert('RGB')
if gi.size != (1536, 1024): gi = gi.resize((1536, 1024), Image.LANCZOS)
gi = np.array(gi).astype(np.float32)

def keyed(rgb):
  R, Gc, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
  a = 1 - np.clip(((np.minimum(R, B) - Gc) - 60) / 90, 0, 1)
  sp = np.clip(np.minimum(R, B) - Gc - 12, 0, None) * (a < 0.98); rgb = rgb.copy(); rgb[..., 0] -= sp * 0.75; rgb[..., 2] -= sp * 0.75
  return rgb.clip(0, 255), a

def labels(e, a):
  fig = a > 0.5
  lab, n = nd.label(fig)
  if n > 1: sz = nd.sum(fig, lab, range(1, n + 1)); fig &= np.isin(lab, 1 + np.nonzero(sz >= 120)[0])
  R, Gc, B = e[..., 0], e[..., 1], e[..., 2]
  mx = np.maximum(np.maximum(R, Gc), B); mn = np.minimum(np.minimum(R, Gc), B); sat = (mx - mn) / np.maximum(mx, 1)
  ys = np.nonzero(fig.any(1))[0]; top, bot = ys.min(), ys.max(); yy = np.arange(S)[:, None] * np.ones((1, S))
  skin = fig & (R > 150) & (Gc > 95) & (B > 60) & (R > Gc + 10) & (Gc > B + 8) & (Gc > 0.62 * R) & (B < 0.85 * Gc) & (B > 0.5 * Gc)
  white = fig & (mx > 150) & (sat < 0.22) & ~skin
  blue = fig & (B > R + 18) & (B > Gc + 4) & (sat > 0.2) & ~skin
  brown = fig & (R > Gc + 12) & (Gc > B + 6) & (sat > 0.3) & ~skin
  hairz = yy < top + (bot - top) * 0.42
  hair = brown & hairz & (mx < 215)
  lab_h, nh = nd.label(nd.binary_closing(hair, iterations=1))
  if nh: sz = nd.sum(hair, lab_h, range(1, nh + 1)); hair = hair & (lab_h == 1 + int(np.argmax(sz)))
  hair = nd.binary_fill_holes(hair) & fig & ~skin
  shoes = brown & (yy > bot - 30) & ~hair
  # sword: the blade is cool steel (blue-grey, B >= R) and long; the shirt is warm white, its cool shadows are blobs
  steel = fig & (mx > 90) & (B >= R - 6) & (sat < 0.45) & ~skin
  lab_s, ns = nd.label(nd.binary_closing(steel, iterations=1)); blade = np.zeros_like(steel)
  for i in range(1, ns + 1):
    cm = lab_s == i; py, px = np.nonzero(cm)
    if len(py) < 120: continue
    ev = np.sort(np.linalg.eigvalsh(np.cov(np.vstack([px, py]))))
    if ev[1] > 6 * max(ev[0], 1e-3) and np.sqrt(ev[1]) > 15: blade |= cm
  gold = fig & (R > 120) & (Gc > 0.45 * R) & (Gc < 0.88 * R) & (B < 0.55 * R) & (sat > 0.35) & ~skin
  near_b = nd.binary_dilation(blade, iterations=14)
  lab_g, ng = nd.label(gold & near_b); guard = np.zeros_like(gold)
  for i in range(1, ng + 1):
    cm = lab_g == i
    if cm.sum() >= 8: guard |= cm
  dark = fig & (mx < 110) & nd.binary_dilation(blade | guard, iterations=3) & ~hair & ~skin   # blade/guard outline
  sword = nd.binary_closing(blade | guard, iterations=2) & fig
  sword |= dark & nd.binary_dilation(sword, iterations=2)
  shirt = white & ~sword
  lab = np.zeros((S, S), np.uint8)
  for v, m in ((40, hair), (200, blue), (160, shoes), (80, shirt), (60, skin)):
    lab[nd.binary_opening(m, iterations=1) & (lab == 0)] = v
  un = fig & (lab == 0) & ~sword
  if un.any():
    idx = nd.distance_transform_edt(lab == 0, return_distances=False, return_indices=True); lab[un] = lab[idx[0], idx[1]][un]
  lab[~fig] = 0; lab[sword] = 0
  return fig, lab, sword

frames = []
for j, (an, c) in enumerate(cells):
  cy, cx = (j // 6) * C, (j % 6) * C
  g = gi[cy:cy + C, cx:cx + C]
  e = np.array(Image.fromarray(g.clip(0, 255).astype(np.uint8)).resize((S, S), Image.LANCZOS)).astype(np.float32)
  e, a = keyed(e)
  fig, lab, sword = labels(e, a)
  om = np.array(Image.open(BASE + an + '_m.png'))[:, c * S:(c + 1) * S, 0]; oa = np.array(Image.open(BASE + an + '.png'))[:, c * S:(c + 1) * S, 3] > 0
  sh_o = np.nonzero(om == 200); sh_n = np.nonzero(lab == 200)
  dx = int(round(sh_o[1].mean() - sh_n[1].mean())) if len(sh_o[0]) and len(sh_n[0]) else 0
  b_o = np.nonzero(oa.any(1))[0].max(); b_n = np.nonzero(fig.any(1))[0].max()
  frames.append(dict(an=an, c=c, e=e, a=a, fig=fig, lab=lab, sword=sword, dx=dx, dyb=int(b_o - b_n)))
# vertical: idle snaps to the ground; a cycle moves as one (its median), so the bob GPT drew stays
for an in set(f['an'] for f in frames):
  fs = [f for f in frames if f['an'] == an]; med = int(np.median([f['dyb'] for f in fs]))
  for f in fs: f['dy'] = f['dyb'] if an == 'idle' else med
strips = {}
for f in frames:
  an, c = f['an'], f['c']
  if an not in strips:
    strips[an] = [np.array(Image.open(BASE + an + s).convert('RGBA')) for s in ('.png', '_m.png', '_weapon.png')]
  px, mk, wp = strips[an]
  sh = lambda arr: np.roll(np.roll(arr, f['dy'], 0), f['dx'], 1)
  e, a, fig, lab, sword = sh(f['e']), sh(f['a']), sh(f['fig']), sh(f['lab']), sh(f['sword'])
  out = np.zeros((S, S, 4), np.uint8); out[..., :3] = e.astype(np.uint8); out[..., 3] = np.where(fig, (a * 255).clip(0, 255), 0).astype(np.uint8)
  m = np.zeros((S, S, 4), np.uint8); m[..., 0] = lab; m[..., 1] = np.where(sword, 255, 0); m[..., 3] = 255
  lum = (0.3 * e[..., 0] + 0.59 * e[..., 1] + 0.11 * e[..., 2]).clip(0, 255)
  w = np.dstack([lum, lum, lum, np.where(sword, 255, 0)]).astype(np.uint8)
  px[:, c * S:(c + 1) * S] = out; mk[:, c * S:(c + 1) * S] = m; wp[:, c * S:(c + 1) * S] = w
for an, (px, mk, wp) in strips.items():
  for s, arr in zip(('.png', '_m.png', '_weapon.png'), (px, mk, wp)): Image.fromarray(arr).save(BASE + an + s, optimize=True)
# QC: frame | labels
pal = {40: (255, 0, 0), 80: (255, 255, 255), 200: (40, 90, 255), 160: (160, 90, 30), 60: (255, 200, 150)}
qc = Image.new('RGB', (S * 2 * 6, S * ((len(frames) + 5) // 6)), (60, 70, 60))
for k, f in enumerate(frames):
  an, c = f['an'], f['c']; px, mk, _ = strips[an]
  t = Image.fromarray(px[:, c * S:(c + 1) * S]); qc.paste(t, ((k % 6) * 2 * S, (k // 6) * S), t)
  col = np.zeros((S, S, 3), np.uint8) + 60; l = mk[:, c * S:(c + 1) * S]
  for v, cc in pal.items(): col[l[..., 0] == v] = cc
  col[l[..., 1] > 127] = (0, 255, 0); qc.paste(Image.fromarray(col), ((k % 6) * 2 * S + S, (k // 6) * S))
os.makedirs(G + 'tools/base/qc', exist_ok=True); qc.save(G + 'tools/base/qc/' + os.path.basename(sj).replace('.json', '.png'))
print('baked', [(f['an'], f['c'], f['dx'], f['dy']) for f in frames])
