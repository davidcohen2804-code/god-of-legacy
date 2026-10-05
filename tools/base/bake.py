# bake.py <sheet_no> : GPT's beginner-clothes redraw of base_NN.png → right-facing base body frames for the game.
# Per cell: key magenta, upscale 256→352, register to the original frame on the head (unchanged), keep the original
# hair/face and sword pixels, take GPT's body, and label regions (shirt/shorts/shoes/skin) for free recolours.
# Output: public/assets/final/body/warrior/base/<anim>.png (1 row, right-facing), <anim>_m.png (R=region, G=sword cut),
#         <anim>_weapon.png (luminance copy, sword alpha), and a QC report + contact sheet in tools/base/qc/.
import json, sys, os, numpy as np
from PIL import Image
from scipy import ndimage as nd
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'
S = 352; C = 256
no = int(sys.argv[1]); meta = json.load(open(G + 'tools/base/sheets/sheets.json'))[no - 1]
cells = json.load(open(G + 'src/data/body-cells.json'))
gpt = Image.open(G + f'tools/base/gpt/base_{no:02d}.png').convert('RGB')
if gpt.size != (1536, 1024): gpt = gpt.resize((1536, 1024), Image.LANCZOS)
gpt = np.array(gpt).astype(np.float32)
OUT = G + 'public/assets/final/body/warrior/base/'; os.makedirs(OUT, exist_ok=True); QC = G + 'tools/base/qc/'; os.makedirs(QC, exist_ok=True)

def key_magenta(rgb):
  R, Gc, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
  mag = np.clip(((np.minimum(R, B) - Gc) - 60) / 90, 0, 1)
  return 1 - mag

def skin_mask(rgb, a):
  R, Gc, B = [rgb[..., i] for i in range(3)]
  return (a > 0.5) & (R > 150) & (Gc > 95) & (B > 60) & (R > Gc + 10) & (Gc > B + 8) & (Gc > 0.62 * R) & (B < 0.85 * Gc) & (B > 0.5 * Gc)

sheets = {}   # anim → (rgba frames, masks, weapon) per column
report = []
def orig_cell(f):
  key, r, k, W, H = f['key'], f['r'], f['k'], f['W'], f['H']
  if key not in sheets: sheets[key] = (np.array(Image.open(G + 'public/' + key).convert('RGBA')), np.array(Image.open(G + 'public/' + key[:-4] + '_m.png')))
  a, m = sheets[key]
  fx = W // 2; fy = 310 + H - S; oy, ox = fy - 310, fx - 176
  def crop(src, ch):
    out = np.zeros((S, S, ch), src.dtype); sy0, sx0 = max(0, oy), max(0, ox); sy1, sx1 = min(H, oy + S), min(W, ox + S)
    out[sy0 - oy:sy1 - oy, sx0 - ox:sx1 - ox] = src[r * H + sy0:r * H + sy1, k * W + sx0:k * W + sx1]; return out
  return crop(a, 4), crop(m, 4)

frames = {}
for f in meta['frames']:
  j = f['cell']; cy, cx = (j // 6) * C, (j % 6) * C
  g = gpt[cy:cy + C, cx:cx + C]
  ga = key_magenta(g)
  # upscale to the game cell
  gi = Image.fromarray(np.dstack([g, ga * 255]).clip(0, 255).astype(np.uint8)).resize((S, S), Image.LANCZOS)
  e = np.array(gi).astype(np.float32); ea = e[..., 3] / 255; e = e[..., :3]
  spill = np.clip(np.minimum(e[..., 0], e[..., 2]) - e[..., 1] - 12, 0, None)   # magenta bleed on soft edges
  e[..., 0] -= spill * 0.75; e[..., 2] -= spill * 0.75
  o, om = orig_cell(f); oa = o[..., 3] > 128; reg = om[..., 0]; sword = om[..., 1] > 127
  hair = reg == 40
  # head zone of the original: hair + skin above the shoulders
  ys = np.nonzero(oa.any(1))[0]; top = ys.min() if len(ys) else 0
  oskin = skin_mask(o[..., :3].astype(np.float32), oa.astype(np.float32))
  hy = np.nonzero(hair.any(1))[0]; hb = hy.max() if len(hy) else top + 60
  # face = skin blobs touching the hair (armour trim and cape highlights are skin-coloured too, but not attached)
  sk_hi = oskin & (np.arange(S)[:, None] < hb + 30); lab_s, n_s = nd.label(sk_hi); near = nd.binary_dilation(hair, iterations=3)
  face = np.zeros_like(oskin); hxs = np.nonzero(hair.any(0))[0]; hx0, hx1 = (hxs.min() - 8, hxs.max() + 8) if len(hxs) else (0, S)
  for i_ in range(1, n_s + 1):
    comp = lab_s == i_; cxs = np.nonzero(comp.any(0))[0]
    if (comp & near).any() and comp.sum() > 40 and cxs.min() >= hx0 - 4 and cxs.max() <= hx1 + 4: face |= comp
  head = nd.binary_closing(hair | face, iterations=2) & oa
  # register GPT's cell on the hair (unchanged by the redraw)
  R0, G0, B0 = e[..., 0], e[..., 1], e[..., 2]
  ghair = (ea > 0.5) & (R0 > G0 + 15) & (G0 > B0 + 5) & (R0 < 215) & (R0 + G0 + B0 < 480) & (np.arange(S)[:, None] < hb + 26)
  ghair = nd.binary_opening(ghair, iterations=1)
  best = (-1, 0, 0)
  for dy in range(-14, 15, 2):
    for dx in range(-14, 15, 2):
      sh = np.roll(np.roll(ghair, dy, 0), dx, 1); iou = (sh & hair).sum() / max(1, (sh | hair).sum())
      if iou > best[0]: best = (iou, dy, dx)
  for ddy in (best[1] - 1, best[1], best[1] + 1):
    for ddx in (best[2] - 1, best[2], best[2] + 1):
      sh = np.roll(np.roll(ghair, ddy, 0), ddx, 1); iou = (sh & hair).sum() / max(1, (sh | hair).sum())
      if iou > best[0]: best = (iou, ddy, ddx)
  iou, dy, dx = best
  if iou < 0.35:  # hair not found where expected: align the figure boxes (top edge + horizontal centre) instead
    oys, oxs = np.nonzero(oa); gys, gxs = np.nonzero(ea > 0.5)
    if len(gys) and len(oys): dy = int(oys.min() - gys.min()); dx = int(round((oxs.min() + oxs.max()) / 2 - (gxs.min() + gxs.max()) / 2))
  e2 = np.roll(np.roll(e, dy, 0), dx, 1); a2 = np.roll(np.roll(ea, dy, 0), dx, 1); gh2 = np.roll(np.roll(ghair, dy, 0), dx, 1)
  # erase GPT's own head (hair + face skin in the head zone) and GPT's sword near the original sword line
  gskin = skin_mask(e2, a2)
  hx = np.nonzero(head.any(0))[0]; xl, xr = (hx.min() - 16, hx.max() + 16) if len(hx) else (0, S)
  xx = np.arange(S)[None, :] * np.ones((S, 1)); yy = np.arange(S)[:, None] * np.ones((1, S))
  ghead = (gh2 | (gskin & (yy < hb + 22) & (xx > xl) & (xx < xr))) & (a2 > 0.5)
  ghead = nd.binary_dilation(nd.binary_closing(ghead, iterations=2), iterations=2)
  band = nd.binary_dilation(sword, iterations=18) & ~head
  R1, G1, B1 = e2[..., 0], e2[..., 1], e2[..., 2]; mx1 = np.maximum(np.maximum(R1, G1), B1); mn1 = np.minimum(np.minimum(R1, G1), B1); sat1 = (mx1 - mn1) / np.maximum(mx1, 1)
  gold = (R1 > 120) & (G1 > 0.45 * R1) & (G1 < 0.88 * R1) & (B1 < 0.55 * R1) & (sat1 > 0.35)
  blade = (sat1 < 0.22) & (mx1 > 120)
  outline = nd.binary_dilation(sword, iterations=7) & (sat1 < 0.35) & (mx1 <= 140)   # GPT's dark blade outline right next to the real blade
  gsword = band & (gold | blade | outline) & ~gskin & (a2 > 0.5)
  # keep the white shirt: blade-like pixels that touch the shirt blob (outside the band core) stay
  core = nd.binary_dilation(sword, iterations=4)
  lab_, n_ = nd.label(gsword); keep = np.zeros_like(gsword)
  for i_ in range(1, n_ + 1):
    comp = lab_ == i_
    if (comp & core).any(): keep |= comp
  gsword = keep
  red = (R1 > 140) & (G1 < 0.5 * R1) & (B1 < 0.5 * R1)   # cape fragments GPT left behind: the base has no red
  useGptHead = iou < 0.35   # acrobatic frame where the hair could not be matched: keep GPT's whole figure
  if useGptHead: ghead[:] = False; head = np.zeros_like(head)
  body = (a2 > 0.5) & ~ghead & ~gsword & ~head & ~sword & ~red
  lb, nb = nd.label(body)   # drop stray bits (redrawn guard/pommel fragments) that are not the body
  if nb > 1:
    sz = nd.sum(body, lb, range(1, nb + 1)); body &= np.isin(lb, 1 + np.nonzero((sz >= 260) | (sz == sz.max()))[0])
  rgb = e2.copy(); alpha = np.where(body, a2, 0)
  rgb[head | sword] = o[..., :3][head | sword]; alpha[head | sword] = o[..., 3][head | sword] / 255
  out = np.dstack([rgb.clip(0, 255), alpha * 255]).astype(np.uint8)
  # regions on GPT's body: shirt (white), shorts (blue), shoes (brown, low), skin
  R, Gc, B = e2[..., 0], e2[..., 1], e2[..., 2]; mx = np.maximum(np.maximum(R, Gc), B); mn = np.minimum(np.minimum(R, Gc), B); sat = (mx - mn) / np.maximum(mx, 1)
  skin = skin_mask(e2, a2) & body
  white = body & (mx > 150) & (sat < 0.22) & ~skin
  blue = body & (B > R + 18) & (B > Gc + 4) & (sat > 0.2) & ~skin
  yy = np.arange(S)[:, None] * np.ones((1, S))
  brown = body & (R > Gc + 12) & (Gc > B + 6) & (mx < 190) & (sat > 0.3) & ~skin & (yy > 310 - 48)
  # clean up: majority vote in small windows
  lab = np.zeros((S, S), np.uint8)
  for v, m in ((80, white), (200, blue), (160, brown), (60, skin)):
    m2 = nd.binary_opening(m, iterations=1); lab[m2 & (lab == 0)] = v
  # unlabelled body pixels take the nearest label
  un = body & (lab == 0)
  if un.any():
    idx = nd.distance_transform_edt(lab == 0, return_distances=False, return_indices=True); lab[un] = lab[idx[0], idx[1]][un]
  lab[~body] = 0; lab[hair] = 40
  mask = np.zeros((S, S, 4), np.uint8); mask[..., 0] = lab; mask[..., 1] = np.where(sword, 255, 0); mask[..., 3] = 255
  # weapon layer: luminance copy with sword alpha (weapon skins tint it)
  lum = (0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]).clip(0, 255)
  wl = np.dstack([lum, lum, lum, np.where(sword, 255, 0)]).astype(np.uint8)
  cov = body.sum() / max(1, (oa & ~head & ~sword).sum())
  report.append(dict(cell=j, anim=f['anim'], col=f['k'], iou=round(float(iou), 2), gptHead=bool(useGptHead), dy=dy, dx=dx, bodyCover=round(float(cov), 2), shirt=int(white.sum()), shorts=int(blue.sum()), shoes=int(brown.sum()), skin=int(skin.sum())))
  frames.setdefault(f['anim'], {})[f['k']] = (out, mask, wl, f)
  for d in f['dups']: frames[f['anim']][d[1]] = (out, mask, wl, f)

# write 1-row sheets per animation (merge with frames already baked from other sheets)
for anim, cols in frames.items():
  f0 = next(iter(cols.values()))[3]; key = f0['key']; W, H = f0['W'], f0['H']
  n = int(np.array(Image.open(G + 'public/' + key)).shape[1] // W)
  paths = [OUT + f'{anim}.png', OUT + f'{anim}_m.png', OUT + f'{anim}_weapon.png']
  imgs = [np.array(Image.open(p).convert('RGBA')) if os.path.exists(p) else np.zeros((S, n * S, 4), np.uint8) for p in paths]
  for k, (out, mask, wl, f) in cols.items():
    for im, src in zip(imgs, (out, mask, wl)): im[:, k * S:(k + 1) * S] = src
  for p, im in zip(paths, imgs): Image.fromarray(im).save(p, optimize=True)
json.dump(report, open(QC + f'base_{no:02d}.json', 'w'), indent=1)
lp = G + 'src/data/base-sheets.json'; done = set()
# an animation counts as baked only when every one of its right-facing columns has a frame
for fn in os.listdir(OUT):
  if not fn.endswith('.png') or fn.endswith('_m.png') or fn.endswith('_weapon.png'): continue
  strip = np.array(Image.open(OUT + fn).convert('RGBA')); n = strip.shape[1] // S
  if all((strip[:, k * S:(k + 1) * S, 3] > 0).sum() > 200 for k in range(n)): done.add(fn[:-4])
json.dump(sorted(done), open(lp, 'w'))
print('baked animations', sorted(done))
bad = [r for r in report if r['iou'] < 0.6 or r['bodyCover'] < 0.35 or r['bodyCover'] > 1.2]
print('cells', len(report), 'bad', bad)
# contact sheet: original | new | regions
cs = Image.new('RGB', (S * 3, S * len(meta['frames'])), (60, 70, 60))
pal = {40: (255, 0, 0), 80: (255, 255, 255), 200: (40, 90, 255), 160: (160, 90, 30), 60: (255, 200, 150)}
for i, f in enumerate(meta['frames']):
  out, mask, wl, _ = frames[f['anim']][f['k']]; o, om = orig_cell(f)
  oi = Image.fromarray(o); cs.paste(oi, (0, i * S), oi); ni = Image.fromarray(out); cs.paste(ni, (S, i * S), ni)
  col = np.zeros((S, S, 3), np.uint8) + 60
  for v, c in pal.items(): col[mask[..., 0] == v] = c
  col[mask[..., 1] > 127] = (0, 255, 0); cs.paste(Image.fromarray(col), (2 * S, i * S))
cs.save(QC + f'base_{no:02d}.png')
