# item2.py <gpt_image> <item_id> [kind] [master] : a head item from ONE GPT edit → every base frame, rigidly.
# MapleStory-style: the item is a single sprite anchored to the head (position + angle + scale per frame), so it is
# identical in every frame — no jitter, no stretching, no broken pieces. Arms and the sword in front of the head stay
# in front of it; for hats, the hair above the brim is pressed under it.
#   kind   : hat (hair above the brim hidden) | band | face   (default hat)
#   master : the master sheet the GPT image was made from (masters/<ver>.*; default v5 = the idle figure large,
#            1.45× the game frame, so the item's sprite comes out crisp; the small figures are pose hints)
# Output: public/assets/final/cosmetics/warrior/<id>/layers/base/<anim>.png, QC tools/base/qc/<id>_*.png
import json, sys, os, hashlib, numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anchors import masks as frame_masks, fit
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352
BASE = G + 'public/assets/final/body/warrior/base/'; MD = G + 'tools/base/masters/'
img, iid = sys.argv[1], sys.argv[2]
KIND = sys.argv[3] if len(sys.argv) > 3 else 'hat'
VER = sys.argv[4] if len(sys.argv) > 4 else 'v5'
FROM_LAYER = img == 'LAYER'   # port an item made for the old armour body: its sprite on the armour idle frame
if FROM_LAYER:
  VER = 'arm'; meta = {'single': False}
  if not os.path.exists(MD + 'arm_frame.png'):
    MV = G + 'public/assets/final/body/warrior/movement/'
    fr = np.array(Image.open(MV + 'idle.png').convert('RGBA'))[S:2 * S, 0:S]; mk = np.array(Image.open(MV + 'idle_m.png'))[S:2 * S, 0:S].copy()
    R_, G_, B_ = [fr[..., i].astype(int) for i in range(3)]
    skin_ = (fr[..., 3] > 150) & (R_ > 170) & (G_ > 110) & (G_ < 215) & (B_ > 80) & (B_ < 190) & (R_ > G_ + 12) & (G_ > B_ + 8)
    mk[..., 0][skin_ & (mk[..., 0] == 0)] = 60
    Image.fromarray(fr).save(MD + 'arm_frame.png'); Image.fromarray(mk).save(MD + 'arm_mask.png')
else:
  meta = json.load(open(MD + VER + '.json'))
POS = meta.get('pos') or [[(j % 6) * 256, (j // 6) * 256, 256] for j in range(24)]   # each cell's [x, y, size] on the sheet
F0 = np.array(Image.open(MD + VER + '_frame.png').convert('RGBA'))      # the frame GPT edited (frozen snapshot)
M0 = np.array(Image.open(MD + VER + '_mask.png'))

def keyed(rgb):
  R, Gc, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
  a = 1 - np.clip(((np.minimum(R, B) - Gc) - 60) / 90, 0, 1)
  sp = np.clip(np.minimum(R, B) - Gc - 12, 0, None) * (a < 0.98); rgb = rgb.copy(); rgb[..., 0] -= sp * 0.75; rgb[..., 2] -= sp * 0.75
  return rgb.clip(0, 255), a

def best_shift(a, b, zone, rng, step=1):
  best = (-1, 0, 0)
  for dy in range(-rng, rng + 1, step):
    for dx in range(-rng, rng + 1, step):
      s = np.roll(np.roll(a, dy, 0), dx, 1); v = ((s & b) & zone).sum() / max(1, ((s | b) & zone).sum())
      if v > best[0]: best = (v, dy, dx)
  return best

# ---------------------------------------------------------------- 1) the GPT edit, aligned on the snapshot frame
gi = Image.open(img).convert('RGB') if not FROM_LAYER else None
if FROM_LAYER:
  L_ = np.array(Image.open(G + f'public/assets/final/cosmetics/warrior/{iid}/layers/idle.png').convert('RGBA'))[S:2 * S, 0:S].astype(np.float32)
  magm = (L_[..., 0] == 255) & (L_[..., 1] == 0) & (L_[..., 2] == 255)
  L_[magm] = 0; e = L_[..., :3]; ea = L_[..., 3] / 255; K = 1.0; x0, y0, x1, y1 = 0, 0, S, S; RW, RH = S, S
  b = F0.astype(np.float32); lab0 = M0[..., 0]
elif meta.get('single'):
  x0, y0, x1, y1 = meta['crop']; K = meta['scale']; ox, oy = meta['offset']; CW, CH = meta['canvas']
  master = np.array(Image.open(MD + VER + '.png').convert('RGB')).astype(np.float32)
  mm = keyed(master)[1] > 0.5
  # GPT may return another canvas size / framing: find scale + shift of its figure on the master canvas (body only)
  g0 = np.array(gi).astype(np.float32); gm0 = keyed(g0)[1] > 0.5
  hy = np.nonzero(M0[..., 0] == 40)[0]; neck = (hy.max() + 10 - y0) * K + oy if len(hy) else CH * 0.45
  zone_c = np.zeros((CH, CW), bool); zone_c[int(neck):] = True
  PADC = 800
  def on_canvas(im, f, dx, dy, mode, bg, q=1):
    w, h = round(im.size[0] * f / q), round(im.size[1] * f / q); cw, chh = (CW + PADC) // q, (CH + PADC) // q
    big = Image.new(mode, (cw, chh), bg); big.paste(im.resize((w, h), Image.LANCZOS if mode == 'RGB' else Image.BOX), ((cw - w) // 2 + dx, (chh - h) // 2 + dy))
    return big.crop((PADC // 2 // q, PADC // 2 // q, PADC // 2 // q + CW // q, PADC // 2 // q + CH // q))
  gmi = Image.fromarray(gm0.astype(np.uint8) * 255)
  small = lambda q_: np.array(Image.fromarray(q_.astype(np.uint8) * 255).resize((CW // 4, CH // 4), Image.BOX)) > 127
  mms, zs = small(mm), small(zone_c); best = (-1, 1.0, 0, 0)
  for f in np.linspace(0.8, 1.25, 19) * (CH / gi.size[1]):
    can = np.array(on_canvas(gmi, f, 0, 0, 'L', 0, 4)) > 127
    v, dy, dx = best_shift(can, mms, zs, 40, 2)
    if v > best[0]: best = (v, f, dy * 4, dx * 4)
  v, f, dy, dx = best
  can = np.array(on_canvas(gi, f, dx, dy, 'RGB', (255, 0, 255))).astype(np.float32)
  # fine shift at full resolution
  cm = keyed(can)[1] > 0.5; v2, fdy, fdx = best_shift(cm, mm, zone_c, 6, 1)
  can = np.roll(np.roll(can, fdy, 0), fdx, 1)
  print('registered: scale', round(f, 3), 'shift', dx + fdx, dy + fdy, 'body IoU', round(v2, 3))
  # work at the master's resolution (K× the game): the snapshot frame region upscaled
  e, ea = keyed(can[oy:oy + round((y1 - y0) * K), ox:ox + round((x1 - x0) * K)])
  RW, RH = e.shape[1], e.shape[0]
  b = np.array(Image.fromarray(F0[y0:y1, x0:x1]).resize((RW, RH), Image.LANCZOS)).astype(np.float32)
  lab0 = np.array(Image.fromarray(M0[y0:y1, x0:x1, 0]).resize((RW, RH), Image.NEAREST))
  place_back = lambda P: (P, (x0, y0, x1, y1))
else:   # grid sheets: cell 0 = the idle frame (v5: a 2×2 block at 1.45× the game frame — worked on at that size)
  x0, y0, x1, y1 = 0, 0, S, S
  g_full = np.array(gi.resize((1536, 1024), Image.LANCZOS) if gi.size != (1536, 1024) else gi).astype(np.float32)
  px0, py0, sz0 = POS[0]; g = g_full[py0:py0 + sz0, px0:px0 + sz0]
  if sz0 <= S:   # a small cell: brought up to the game frame
    K = 1.0; RW = RH = S
    e, ea = keyed(np.array(Image.fromarray(g.clip(0, 255).astype(np.uint8)).resize((S, S), Image.LANCZOS)).astype(np.float32))
    b = F0.astype(np.float32); lab0 = M0[..., 0]
  else:          # the big cell: the frame brought up to it; GPT may move / rescale the big figure — found by its body
    K = sz0 / S; RW = RH = sz0
    b = np.array(Image.fromarray(F0).resize((sz0, sz0), Image.LANCZOS)).astype(np.float32); lab0 = np.array(Image.fromarray(M0[..., 0]).resize((sz0, sz0), Image.NEAREST))
    from scipy.signal import fftconvolve
    mm_ = b[..., 3] > 128; hy_ = np.nonzero(lab0 == 40)[0]
    zone_ = np.zeros_like(mm_); zone_[int(hy_.max() + 12 * K):] = True        # the body below the head (the item is above)
    Rm = 200; reg = np.full((sz0 + 2 * Rm, sz0 + 2 * Rm, 3), (255, 0, 255), np.float32)
    ya, xa = max(0, py0 - Rm), max(0, px0 - Rm); yb, xb = min(1024, py0 + sz0 + Rm), min(1536, px0 + sz0 + Rm)
    reg[ya - (py0 - Rm):yb - (py0 - Rm), xa - (px0 - Rm):xb - (px0 - Rm)] = g_full[ya:yb, xa:xb]
    gm_ = keyed(reg)[1] > 0.5
    def corr(f, q):   # IoU of the master body with GPT's figure scaled by 1/f, at every offset (FFT), at 1/q resolution
      gq = np.array(Image.fromarray(gm_.astype(np.uint8) * 255).resize((round(gm_.shape[1] / f / q), round(gm_.shape[0] / f / q)), Image.BOX)).astype(np.float32) / 255
      mq = np.array(Image.fromarray((mm_ & zone_).astype(np.uint8) * 255).resize((sz0 // q, sz0 // q), Image.BOX)).astype(np.float32) / 255
      zq = np.array(Image.fromarray(zone_.astype(np.uint8) * 255).resize((sz0 // q, sz0 // q), Image.BOX)).astype(np.float32) / 255
      if gq.shape[0] < mq.shape[0] or gq.shape[1] < mq.shape[1]: return -1, 0, 0
      I = fftconvolve(gq, mq[::-1, ::-1], mode='valid'); Bz = fftconvolve(gq, zq[::-1, ::-1], mode='valid')
      iou = I / np.maximum(mq.sum() + Bz - I, 1e-6); j = np.unravel_index(np.argmax(iou), iou.shape)
      return float(iou[j]), j[0] * q, j[1] * q
    best = max(((corr(f, 4), f) for f in np.linspace(0.75, 1.4, 27)), key=lambda t: t[0][0])
    f0 = best[1]; best = max(((corr(f, 1), f) for f in np.linspace(f0 - 0.025, f0 + 0.025, 6)), key=lambda t: t[0][0])
    (v_, oy_, ox_), f_ = best
    big_ = Image.fromarray(reg.clip(0, 255).astype(np.uint8)).resize((round(reg.shape[1] / f_), round(reg.shape[0] / f_)), Image.LANCZOS)
    g = np.array(big_.crop((ox_, oy_, ox_ + sz0, oy_ + sz0))).astype(np.float32)
    print('big figure: GPT scale', round(f_, 3), 'offset', ox_ - round(Rm / f_), oy_ - round(Rm / f_), 'body IoU', round(v_, 3))
    e, ea = keyed(g)
  hair_ = lab0 == 40; low = ~nd.binary_dilation(hair_, iterations=int(round(30 * K))); _, dy, dx = best_shift(ea > 0.5, b[..., 3] > 128, low, int(round(12 * K)))
  e = np.roll(np.roll(e, dy, 0), dx, 1); ea = np.roll(np.roll(ea, dy, 0), dx, 1)

# ---------------------------------------------------------------- 2) the piece = what GPT added around the head
DBG = os.environ.get('DBG')
def dbg(name, m):
  if DBG: Image.fromarray((m * 255).astype(np.uint8) if m.dtype == bool else m.clip(0, 255).astype(np.uint8)).save(f'{DBG}/{name}.png')
def drop_small(m, mn, rel=0.0, near=0):
  """Remove connected pieces smaller than mn px, and pieces smaller than rel × the biggest unless they lie within
  `near` px of a big one (a gem or bead set a little apart from the item)."""
  lab, n = nd.label(m)
  if not n: return m
  sz = nd.sum(m, lab, range(1, n + 1))
  bigs = [i + 1 for i in range(n) if sz[i] >= rel * sz.max()]
  close = nd.binary_dilation(np.isin(lab, bigs), iterations=near) if near else np.isin(lab, bigs)
  keep = [i + 1 for i in range(n) if sz[i] >= mn and (i + 1 in bigs or (close & (lab == i + 1)).any())]
  return np.isin(lab, keep)
def extract(e, ea, b, lab0, K, RW, RH, x0, y0, x1, y1, from_layer=False):
  """The item = what changed around the head between the frame b and GPT's edit e (alpha ea)."""
  dbg('0_e', e); dbg('0_b', b[..., :3])
  ba = b[..., 3] > 128; hair = lab0 == 40; skin = lab0 == 60
  it = max(1, int(round(K)))
  if from_layer: e = np.where((ea > 0)[..., None], e, b[..., :3]); ea = np.where(ea > 0, 1.0, b[..., 3] / 255)   # piece over the frame = 'after'
  hz = nd.binary_dilation(hair, iterations=int(round(64 * K)))   # the item stays within ~64 game px of the hair
  if KIND == 'face':   # glasses / masks: on the head only (hair + the face beside it), never the shirt below
    face_near = skin & nd.binary_dilation(hair, iterations=int(round(22 * K)))
    hz = nd.binary_dilation(hair | face_near, iterations=int(round(5 * K)))
  diff = np.abs(e - b[..., :3]).sum(2)
  strong = (ea > 0.5) & (~ba | (diff > 90)); weak = (ea > 0.5) & (diff > 55)
  ch = (strong | (weak & nd.binary_dilation(strong, iterations=2 * it))) & hz
  ch = drop_small(ch, 12 * it * it)                            # noise only: fine parts (spikes, beads, thin arms) stay
  ch = nd.binary_closing(ch, iterations=2 * it) & (ea > 0.5); dbg('1_change', ch)
  # GPT redraws the boy's own hair/skin a little (strands shifted, outlines moved): a changed pixel whose colour the
  # boy already has right there (within a few px) is that redraw, not the item — warm (hair / skin family) colours and
  # the dark outline strokes. A gold frame across the hair, a black band over it, a pink lining stay; a lens over the
  # dark eye keeps its shape (enclosed holes are closed below).
  r_ = max(2, int(round(5 * K))); bb_ = np.where(ba[..., None], b[..., :3], 1e4)
  dloc = np.full(ch.shape, 1e9, np.float32)
  for dy_ in range(-r_, r_ + 1):
    for dx_ in range(-r_, r_ + 1):
      if dy_ * dy_ + dx_ * dx_ > r_ * r_: continue
      sh_ = np.roll(np.roll(bb_, dy_, 0), dx_, 1)
      dloc = np.minimum(dloc, np.sqrt(((e - sh_) ** 2).sum(2)))
  warm_ = ((e[..., 0] - e[..., 2]) > 18) & (e[..., 1] > 0.32 * e[..., 0])
  mxe_ = e.max(2); dk_ = ch & (mxe_ < 70)
  solid_ = nd.binary_dilation(nd.binary_opening(dk_, iterations=2 * it), iterations=it)   # a lens, a hat body: not a stroke
  ch &= ~((dloc < 28) & (warm_ | (dk_ & ~solid_)))
  dbg('2_palette', ch)
  # GPT also re-draws the hair around the item (new spikes, darker locks): hair-coloured changes — brown, or dark
  # crimson shadow; not pink, gold or a bright red jewel — outside the area the item's own colours enclose are hair.
  # If the item itself is hair-coloured (most of what GPT put in the empty space around the head is), only the boy's
  # own hair colours (above) are dropped.
  R_, G_, B_ = e[..., 0], e[..., 1], e[..., 2]; mx_ = np.maximum(np.maximum(R_, G_), B_); mn_ = np.minimum(np.minimum(R_, G_), B_)
  sat_ = (mx_ - mn_) / np.maximum(mx_, 1); gr_ = G_ / np.maximum(R_, 1)
  brown = (mx_ > 30) & (mx_ < 215) & (sat_ > 0.35) & (R_ >= B_) & (gr_ >= 0.3) & (gr_ < 0.68) & (B_ <= G_ + 5)
  crimson = (mx_ > 30) & (mx_ < 125) & (sat_ > 0.5) & (R_ >= B_) & (gr_ < 0.3)
  hairish = brown | crimson
  empty = ch & ~ba & ~nd.binary_dilation(hair, iterations=3 * it)
  share = (hairish & empty).sum() / max(1, empty.sum()) if KIND != 'face' else 0.0   # (face items sit on the face: what
  # GPT changes outside the boy there is re-drawn hair)
  print('hair-coloured share of the new shape', round(float(share), 2), '(dropped)' if share < 0.35 else '(kept: the item is hair-coloured)')
  if share < 0.35 and not from_layer:   # (an old armour-era layer is the item as painted: no re-drawn hair in it)
    core = ch & ~hairish
    inside = nd.binary_fill_holes(nd.binary_closing(core, iterations=2 * it))   # jewels / shading enclosed by the item
    removed = ch & hairish & ~inside
    ch = ch & ~removed
    dbg('2_hairish', removed)
  # thin dark-brown strands at the rim are GPT's hair poking out around the item (they read as dark specks): drop them
  thin = ch & ~nd.binary_opening(ch, iterations=2 * it)
  hairlike = (R_ - B_ > 12) & (G_ > 0.3 * R_) & (G_ < 0.68 * R_) & (mx_ < 140)
  ch &= ~(thin & hairlike & ~nd.binary_dilation(ch & ~thin & ~hairlike, iterations=it)); dbg('3_thin', ch)
  ch = drop_small(ch, 30 * it * it, rel=0.2, near=4 * it)     # GPT's re-drawn outlines elsewhere on the body go
  if os.environ.get('CLEAN') == 'strict': ch = drop_small(nd.binary_opening(ch, iterations=it), 40 * it * it, rel=0.15)   # a source with stray bits (old beret layer)
  P = np.zeros((RH, RW, 4), np.float32); P[..., :3] = e
  # cracks: hair-outline pixels GPT left inside the item were removed above → close them and paint them with the
  # item's own surrounding colour (never with the hair colour), so nothing of the head shows through the item
  closed = (nd.binary_fill_holes(nd.binary_closing(ch, iterations=3 * it)) | ch) & (ea > 0.5)
  crack = closed & ~ch
  if crack.any():
    idc = nd.distance_transform_edt(~ch, return_distances=False, return_indices=True); P[..., :3][crack] = e[idc[0][crack], idc[1][crack]]
  ch = closed
  P[..., 3] = np.where(ch, ea * 255, 0)
  # defringe the rim: colours carrying GPT's magenta anti-aliasing take the nearest inner colour
  inner = nd.binary_erosion(ch, iterations=2 * it); rim = ch & ~inner
  tint = (P[..., 0] - P[..., 1] > 25) & (P[..., 2] - P[..., 1] > 25) & (P[..., 1] < 0.6 * np.minimum(P[..., 0], P[..., 2]))   # magenta-ish, not pink
  bad = rim & tint
  if bad.any() and inner.any():
    idx = nd.distance_transform_edt(~(ch & ~bad), return_distances=False, return_indices=True); P[..., :3][bad] = P[..., :3][idx[0][bad], idx[1][bad]]
  # bleed colours outward (clean resampling edges), then bring the piece to game resolution (premultiplied)
  idx = nd.distance_transform_edt(~ch, return_distances=False, return_indices=True); P[..., :3] = P[..., :3][idx[0], idx[1]]
  if K != 1:
    pm = P.copy(); pm[..., :3] *= pm[..., 3:4] / 255
    W2, H2 = x1 - x0, y1 - y0
    r = np.array(Image.fromarray(pm[..., 3].clip(0, 255).astype(np.uint8)).resize((W2, H2), Image.LANCZOS)).astype(np.float32)
    rgb = np.dstack([np.array(Image.fromarray(pm[..., i].clip(0, 255).astype(np.uint8)).resize((W2, H2), Image.LANCZOS)).astype(np.float32) for i in range(3)])
    rgb = np.where(r[..., None] > 0, rgb * 255 / np.maximum(r[..., None], 1), 0)
    piece = np.zeros((S, S, 4), np.float32); piece[y0:y1, x0:x1, :3] = rgb.clip(0, 255); piece[y0:y1, x0:x1, 3] = r
    piece[..., 3][piece[..., 3] < 8] = 0
  else:
    piece = P
  op = piece[..., 3] > 0; idx = nd.distance_transform_edt(~op, return_distances=False, return_indices=True); piece[..., :3] = piece[..., :3][idx[0], idx[1]]
  return piece

piece = extract(e, ea, b, lab0, K, RW, RH, x0, y0, x1, y1, FROM_LAYER)
os.makedirs(G + 'tools/base/qc', exist_ok=True)
Image.fromarray(piece.clip(0, 255).astype(np.uint8)).save(G + f'tools/base/qc/{iid}_piece.png')

# ---------------------------------------------------------------- 3) the head table (one for every item: tools/base/headtable.py)
def tmpl_masks(m):
  hair = m[..., 0] == 40; lab, n = nd.label(hair)
  if n > 1:
    sz = nd.sum(hair, lab, range(1, n + 1)); big = lab == 1 + int(np.argmax(sz)); near = nd.binary_dilation(big, iterations=3)
    hair = big | (hair & np.isin(lab, [i for i in range(1, n + 1) if (near & (lab == i)).any()]))
  sk = m[..., 0] == 60; lab, n = nd.label(sk); face = np.zeros_like(sk); nb = nd.binary_dilation(hair, iterations=3); hyc = np.nonzero(hair)[0].mean()
  for i in range(1, n + 1):
    c_ = lab == i
    if (c_ & nb).any() and np.nonzero(c_)[0].mean() > hyc - 4 and c_.sum() < 2.5 * hair.sum(): face |= c_
  return hair, face
import headtable
A = headtable.table()
T = headtable.template()                     # the idle-0 head every transform starts from
cx, cy = A['center']
# a master made on an older idle drawing (v1/v2, armour ports): its piece is first laid onto today's idle head
idle0 = np.array(Image.open(BASE + 'idle.png').convert('RGBA'))[:, 0:S]
if not np.array_equal(F0, idle0):
  r0, ctr0 = fit(tmpl_masks(M0), T, allow_flip=False)
  pm_ = piece.copy(); al_ = pm_[..., 3:4] / 255; pm_[..., :3] *= al_
  def _w(ch): 
    im = Image.fromarray(ch.astype(np.float32)); k_ = r0[3]; c0x, c0y = ctr0
    if abs(k_ - 1) > 1e-6:
      w_ = round(S * k_); im2 = im.resize((w_, w_), Image.BICUBIC); c2 = Image.new('F', (S, S)); c2.paste(im2, (round(c0x - c0x * k_), round(c0y - c0y * k_))); im = c2
    return np.array(im.rotate(r0[2], resample=Image.BICUBIC, center=(c0x, c0y), translate=(r0[0], r0[1])))
  a2 = _w(pm_[..., 3]).clip(0, 255); rgb2 = np.dstack([_w(pm_[..., i]) for i in range(3)])
  piece = np.zeros_like(piece); piece[..., 3] = np.where(a2 >= 8, a2, 0); piece[..., :3] = np.where(a2[..., None] > 0, rgb2 / np.maximum(a2[..., None] / 255, 1e-3), 0).clip(0, 255)
  op_ = piece[..., 3] > 0; idx_ = nd.distance_transform_edt(~op_, return_distances=False, return_indices=True); piece[..., :3] = piece[..., :3][idx_[0], idx_[1]]
  print('piece moved onto today\'s idle head:', r0)

# ---------------------------------------------------------------- 4) place the piece on every frame
def warp(arr, tx, ty, ang, k, resample, flip=False, ctr=None):
  """Template → frame, the same as anchors.fit: mirror (head turned back), scale k and rotate ang (deg, counter-
  clockwise) about the template head centre, then move by (tx, ty)."""
  cx_, cy_ = ctr if ctr else (cx, cy)
  if flip: arr = np.roll(arr[:, ::-1], int(2 * cx_ - (S - 1)), axis=1)
  im = Image.fromarray(arr)
  if abs(k - 1) > 1e-6:
    w = round(S * k); r = im.resize((w, w), resample); c2 = Image.new(im.mode, (S, S)); c2.paste(r, (round(cx_ - cx_ * k), round(cy_ - cy_ * k))); im = c2
  return np.array(im.rotate(ang, resample=resample, center=(cx_, cy_), translate=(tx, ty)))
pc = piece.clip(0, 255).astype(np.uint8)
face_t = (T[1] * 255).astype(np.uint8)
# hats: the hair above the brim line is pressed under the hat — in template space: per column under the piece,
# carried flat past both ends of the brim
def hide_of(pce):
  ht = np.zeros((S, S), np.uint8)
  opq = pce[..., 3] > 128
  if KIND == 'hat' and opq.any():
    top = np.argmax(opq, axis=0); has = opq.any(0)
    run = np.cumprod(opq | ~(np.arange(S)[:, None] >= top[None, :]), axis=0).astype(bool) & opq
    bot = np.where(has, S - 1 - np.argmax(run[::-1], axis=0), -1).astype(float)
    xs = np.nonzero(has)[0]; xa, xb = xs.min(), xs.max(); line = bot.copy(); E = 6
    line[:xa] = np.median(bot[xa:xa + E]); line[xb + 1:] = np.median(bot[max(xa, xb - E + 1):xb + 1])
    ht = ((np.arange(S)[:, None] <= line[None, :] - 2) * 255).astype(np.uint8)
  return ht
hide_t = hide_of(piece)
def head_hair(h):
  lab, n = nd.label(h)
  if n <= 1: return h
  sz = nd.sum(h, lab, range(1, n + 1)); big = lab == (1 + int(np.argmax(sz))); near = nd.binary_dilation(big, iterations=3); keep = big.copy()
  for i in range(1, n + 1):
    cm = lab == i
    if (cm & near).any(): keep |= cm
  return keep
def front_mask(mk, h, face_pred, px=None):
  # in front of the head: the sword (with its outline/glow and its golden hilt), the arms/hands (big skin blobs that
  # are not the face) and their sleeves
  sk = mk[..., 0] == 60
  lab, nl = nd.label(sk); headreg = nd.binary_fill_holes(nd.binary_dilation(h, iterations=6)); arms = np.zeros_like(sk)
  for i in range(1, nl + 1):
    cm = lab == i
    if (cm & face_pred).sum() > 0.5 * cm.sum(): continue
    if cm.sum() >= 150: arms |= cm
  arms = nd.binary_opening(arms, iterations=2)          # thin skin-labelled outlines along the hair are not arms
  arms |= nd.binary_dilation(arms, iterations=1) & (mk[..., 0] != 40) & (mk[..., 0] != 0)   # the arm keeps its outline
  sleeves = (mk[..., 0] == 80) & nd.binary_dilation(arms, iterations=8) & headreg
  sword = mk[..., 1] > 127
  if px is not None and sword.any():   # the hilt (gold guard, grip, pommel) is often labelled hair: take it by its gold
    R_, G_, B_ = px[..., 0].astype(float), px[..., 1].astype(float), px[..., 2].astype(float)
    gold = (px[..., 3] > 0) & (R_ > 140) & (G_ > 0.66 * R_) & (B_ < 0.55 * G_)
    hilt = nd.binary_closing(gold & nd.binary_dilation(sword, iterations=12), iterations=3) & (px[..., 3] > 0) & ~face_pred
    lab_h, n_h = nd.label(hilt); near_s = nd.binary_dilation(sword, iterations=4)
    sword |= np.isin(lab_h, [i for i in range(1, n_h + 1) if ((lab_h == i) & near_s).any()])
  sword |= nd.binary_dilation(sword, iterations=2) & (mk[..., 0] != 40) & ~face_pred
  return sword | arms | sleeves

# ---------------------------------------------------------------- 3b) pose hints: on the hardest frames GPT drew the
# item in that pose; the clean sprite is laid exactly where GPT put it (mirrored if the head turned back)
CELLS = MD + VER + '_cells.npz'
if not FROM_LAYER and not meta.get('single') and os.path.exists(CELLS) and os.environ.get('HINTS', '0') == '1' and np.array_equal(F0, idle0):
  z = np.load(CELLS); CF, CM = z['frames'], z['masks']; cells = meta['cells']
  A0 = piece[..., 3] > 128
  for j in range(1, len(cells)):
    if j in meta.get('back', []): continue
    a, c = cells[j]
    if a not in A['frames'] or c >= len(A['frames'][a]) or f'{a}:{c}' in A['fixed']: continue   # gone, or set by hand
    x_, y_, sz_ = POS[j]; g = g_full[y_:y_ + sz_, x_:x_ + sz_]
    e, ea = keyed(np.array(Image.fromarray(g.clip(0, 255).astype(np.uint8)).resize((S, S), Image.LANCZOS)).astype(np.float32))
    b = CF[j].astype(np.float32); bm = CM[j]; ba = b[..., 3] > 128; hair_j = bm[..., 0] == 40
    low = ~nd.binary_dilation(hair_j, iterations=30); _, dy_, dx_ = best_shift(ea > 0.5, ba, low, 12)
    e = np.roll(np.roll(e, dy_, 0), dx_, 1); ea = np.roll(np.roll(ea, dy_, 0), dx_, 1)
    diff = np.abs(e - b[..., :3]).sum(2); hz = nd.binary_dilation(hair_j, iterations=48)
    strong = (ea > 0.5) & (~ba | (diff > 90)); ch_ = nd.binary_opening(strong & hz, iterations=1)
    lab_, n_ = nd.label(ch_)
    if not n_: continue
    sz_ = nd.sum(ch_, lab_, range(1, n_ + 1)); Aj = np.isin(lab_, 1 + np.nonzero(sz_ >= max(40, sz_.max() * 0.2))[0])
    Aj = nd.binary_closing(Aj, iterations=2)
    if Aj.sum() < 0.25 * A0.sum(): continue                     # GPT hid it (behind the arms): keep the head fit
    hj = head_hair(hair_j); V = ~front_mask(bm, hj, np.zeros_like(hj), CF[j])
    yj, xj = np.nonzero(Aj); tgt = (yj.mean(), xj.mean())
    best = (-1, None)
    def score_at(M, dy, dx, r=1):
      Ms = np.roll(np.roll(M, dy, 0), dx, 1)
      if r > 1: Ms, A_, V_ = Ms[::r, ::r], Aj[::r, ::r], V[::r, ::r]
      else: A_, V_ = Aj, V
      return ((Ms & A_) & V_).sum() / max(1, ((Ms | A_) & V_).sum())
    old = A['frames'][a][c]; ha = old[2] if old else 0; span = 35 if (old and old[4] >= 0.7) else 60
    for fl in (False, True):
      for ang in range(ha - span, ha + span + 1, 5):
        for k in (0.85, 0.92, 1.0, 1.08, 1.15):
          M = warp((A0 * 255).astype(np.uint8), 0, 0, ang, k, Image.NEAREST, fl) > 127
          if not M.any(): continue
          my, mx_ = np.nonzero(M); oy, ox = int(round(tgt[0] - my.mean())), int(round(tgt[1] - mx_.mean()))
          for dy in range(oy - 12, oy + 13, 3):
            for dx in range(ox - 12, ox + 13, 3):
              v = score_at(M, dy, dx, 2)
              if v > best[0]: best = (v, (fl, ang, k, dy, dx))
    v, (fl, ang0, k0, dy0, dx0) = best; best = (-1, None)
    for ang in range(ang0 - 6, ang0 + 7, 2):
      for k in (k0 - 0.04, k0, k0 + 0.04):
        M = warp((A0 * 255).astype(np.uint8), 0, 0, ang, k, Image.NEAREST, fl) > 127
        for dy in range(dy0 - 3, dy0 + 4):
          for dx in range(dx0 - 3, dx0 + 4):
            v = score_at(M, dy, dx)
            if v > best[0]: best = (v, (fl, ang, k, dy, dx))
    v, (fl, ang, k, dy, dx) = best
    # GPT's drawing is the truth for this pose: keep whichever placement matches it better (the head fit or the hint)
    v_head = -1
    if old:
      Mh = warp((A0 * 255).astype(np.uint8), old[0], old[1], old[2], old[3], Image.NEAREST, old[5] if len(old) > 5 else False) > 127
      v_head = score_at(Mh, 0, 0)
    use = v >= 0.45 and v > v_head + 0.03 and (not fl or v >= 0.8)
    if use: A['frames'][a][c] = [dx, dy, ang, round(k, 3), round(v, 3), fl]
    print('hint', a, c, 'IoU', round(v, 2), 'vs head fit', round(v_head, 2), 'used' if use else 'kept head fit', flush=True)

OUT = G + f'public/assets/final/cosmetics/warrior/{iid}/layers/base/'; os.makedirs(OUT, exist_ok=True)
for a in json.load(open(G + 'src/data/base-sheets.json')):
  m = np.array(Image.open(BASE + a + '_m.png')); n = m.shape[1] // S; out = np.zeros((S, n * S, 4), np.uint8)
  px_strip = np.array(Image.open(BASE + a + '.png').convert('RGBA'))
  for c in range(n):
    r = A['frames'].get(a, [None] * n)[c] if a in A['frames'] else None
    if not r: continue
    tx, ty, ang, k, score = r[:5]; fl = r[5] if len(r) > 5 else False
    q = warp(pc, tx, ty, ang, k, Image.BICUBIC, fl)
    mk = m[:, c * S:(c + 1) * S]; h = head_hair(mk[..., 0] == 40)
    # in front of the head: the sword, the arms/hands (skin blobs that reach well outside the head) and their sleeves
    face_pred = nd.binary_dilation(warp(face_t, tx, ty, ang, k, Image.NEAREST, fl) > 127, iterations=6)
    fpx = px_strip[:, c * S:(c + 1) * S]
    front = front_mask(mk, h, face_pred, fpx)
    q[front] = 0
    if KIND == 'hat':
      hide = warp(hide_t, tx, ty, ang, k, Image.NEAREST, fl) > 127
      opq_f = q[..., 3] >= 128
      fpx_ = fpx.astype(int)
      # what sits on the head above the brim: the hair, its dark outline and soft edge pixels
      outline = ((fpx_[..., :3].max(2) < 130) | (fpx_[..., 3] < 200)) & (mk[..., 0] != 80) & ~face_pred
      cand = hide & (h | outline) & ~front & ~opq_f & (fpx_[..., 3] > 0)
      # hair poking a little out of the hat is pressed under it (hidden whole); a real lock of hair reaching well past
      # the hat stays as it is (cutting it would leave a hole)
      gone = np.zeros_like(cand)
      if cand.any() and opq_f.any():
        dist = nd.distance_transform_edt(~opq_f); lab_g, n_g = nd.label(cand)
        if n_g:
          mx_d = nd.maximum(dist, lab_g, range(1, n_g + 1))
          gone = np.isin(lab_g, 1 + np.nonzero(np.asarray(mx_d) <= 10)[0])
      q[gone] = [255, 0, 255, 255]
    out[:, c * S:(c + 1) * S] = q
  Image.fromarray(out).save(OUT + a + '.png', optimize=True)
cp = G + 'src/data/cosmetics.json'; D = json.load(open(cp))
W_ = D['classes']['warrior']; ent = next((x for x in W_ if x['id'] == iid), None)
if ent is None:   # new item: shop entry + icon (the item worn on the idle head)
  NAME = os.environ.get('NAME') or iid.replace('_', ' ').title()
  ent = {'id': iid, 'type': {'hat': 'hat', 'band': 'hat', 'face': 'faceacc'}[KIND], 'attachment': 'worn', 'name': NAME, 'desc': os.environ.get('DESC', NAME.lower() + '.')}
  W_.append(ent)
ent['layers'] = f'assets/final/cosmetics/warrior/{iid}/layers'; ent.pop('wip', None)
ip = f'assets/final/cosmetics/warrior/{iid}/icon.png'; ent['icon'] = ip
import icons; icons.icon(iid)   # the item on the idle head, whole item and whole head in frame
json.dump(D, open(cp, 'w'), indent=1)
print('baked', iid)
