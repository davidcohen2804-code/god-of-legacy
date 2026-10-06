# item2.py <gpt_image> <item_id> [kind] [master] : a head item from ONE GPT edit → every base frame, rigidly.
# MapleStory-style: the item is a single sprite anchored to the head (position + angle + scale per frame), so it is
# identical in every frame — no jitter, no stretching, no broken pieces. Arms and the sword in front of the head stay
# in front of it; for hats, the hair above the brim is pressed under it.
#   kind   : hat (hair above the brim hidden) | band | face   (default hat)
#   master : the master sheet the GPT image was made from (masters/<ver>.*; v3 = one big figure, default)
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
VER = sys.argv[4] if len(sys.argv) > 4 else 'v3'
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
else:   # 6×4 sheets (v1/v2): cell 0, already 352-aligned by the old pipeline's registration
  K = 1.0; x0, y0, x1, y1 = 0, 0, S, S
  g = np.array(gi.resize((1536, 1024), Image.LANCZOS) if gi.size != (1536, 1024) else gi).astype(np.float32)[0:256, 0:256]
  e, ea = keyed(np.array(Image.fromarray(g.clip(0, 255).astype(np.uint8)).resize((S, S), Image.LANCZOS)).astype(np.float32))
  b = F0.astype(np.float32); lab0 = M0[..., 0]; RW, RH = S, S
  hair_ = lab0 == 40; low = ~nd.binary_dilation(hair_, iterations=30); _, dy, dx = best_shift(ea > 0.5, b[..., 3] > 128, low, 12)
  e = np.roll(np.roll(e, dy, 0), dx, 1); ea = np.roll(np.roll(ea, dy, 0), dx, 1)

# ---------------------------------------------------------------- 2) the piece = what GPT added around the head
ba = b[..., 3] > 128; hair = lab0 == 40; skin = lab0 == 60
it = max(1, int(round(K)))
if FROM_LAYER: e = np.where((ea > 0)[..., None], e, b[..., :3]); ea = np.where(ea > 0, 1.0, b[..., 3] / 255)   # piece over the frame = 'after'
hz = nd.binary_dilation(hair, iterations=48 * it)
diff = np.abs(e - b[..., :3]).sum(2)
strong = (ea > 0.5) & (~ba | (diff > 90)); weak = (ea > 0.5) & (diff > 55)
ch = (strong | (weak & nd.binary_dilation(strong, iterations=2 * it))) & hz
ch = nd.binary_opening(ch, iterations=it); lab, n = nd.label(ch)
if n: sz = nd.sum(ch, lab, range(1, n + 1)); ch = np.isin(lab, 1 + np.nonzero(sz >= max(40 * it * it, sz.max() * 0.2))[0])
ch = nd.binary_closing(ch, iterations=2 * it) & (ea > 0.5)
# GPT redraws the boy's own hair/skin a little: those colours are not the item (reds, blacks, greys, golds stay)
pal = b[..., :3][(hair | skin) & ba]
if len(pal) > 50:
  pal = pal[np.random.RandomState(0).choice(len(pal), min(600, len(pal)), replace=False)]
  idx = np.nonzero(ch)
  for s0 in range(0, len(idx[0]), 20000):
    yy_, xx_ = idx[0][s0:s0 + 20000], idx[1][s0:s0 + 20000]; px_ = e[yy_, xx_]
    d = np.sqrt(((px_[:, None, :] - pal[None]) ** 2).sum(2)).min(1)
    warm = ((px_[:, 0] - px_[:, 2]) > 18) & (px_[:, 1] > 0.32 * px_[:, 0])
    rm = (d < 30) & warm; ch[yy_[rm], xx_[rm]] = False
ch = nd.binary_opening(ch, iterations=it); lab, n = nd.label(ch)
if n: sz = nd.sum(ch, lab, range(1, n + 1)); ch = np.isin(lab, 1 + np.nonzero(sz >= max(40 * it * it, sz.max() * 0.15))[0])
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
tint = (P[..., 0] - P[..., 1] > 25) & (P[..., 2] - P[..., 1] > 25)
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
# colour-bleed the game-resolution piece too (for rotation)
op = piece[..., 3] > 0; idx = nd.distance_transform_edt(~op, return_distances=False, return_indices=True); piece[..., :3] = piece[..., :3][idx[0], idx[1]]
os.makedirs(G + 'tools/base/qc', exist_ok=True)
Image.fromarray(piece.clip(0, 255).astype(np.uint8)).save(G + f'tools/base/qc/{iid}_piece.png')

# ---------------------------------------------------------------- 3) head anchors (cached per master + base state)
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
T = tmpl_masks(M0)
anims = sorted(a for a in json.load(open(G + 'src/data/base-sheets.json')) if a != 'death')
state = hashlib.md5(b''.join(open(BASE + a + '_m.png', 'rb').read() for a in anims) + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'anchors.py'), 'rb').read()).hexdigest()   # base masks + the fitting code
ap = MD + VER + '_anchors.json'
A = json.load(open(ap)) if os.path.exists(ap) else {}
if A.get('state') != state:
  frames = {}
  for a in anims:
    n = np.array(Image.open(BASE + a + '_m.png')).shape[1] // S; row = []
    for c in range(n):
      Fm = frame_masks(a, c)
      if Fm[0].sum() < 50: row.append(None); continue
      r, _ = fit(T, Fm); row.append(r)
    # weak fits (head hidden behind arms…): search near the angle of the nearest well-fitted frames of the same move
    good = [i for i, x in enumerate(row) if x and x[4] >= 0.7]
    for i, x in enumerate(row):
      if not x or x[4] >= 0.7 or not good: continue
      nb = sorted(good, key=lambda g: abs(g - i))[:2]; am = int(round(np.mean([row[g][2] for g in nb])))
      r2, _ = fit(T, frame_masks(a, i), arange=(max(-75, am - 25), min(75, am + 25)))
      row[i] = r2 if (r2[4] >= x[4] - 0.08) else x
    frames[a] = row; print('anchors', a, [(x[2], 'F' if x[5] else '') if x else None for x in row], flush=True)
  ty, tx = np.nonzero(T[0])
  A = {'state': state, 'center': [int(round(tx.mean())), int(round(ty.mean()))], 'frames': frames}; json.dump(A, open(ap, 'w'))
cx, cy = A['center']

# ---------------------------------------------------------------- 4) place the piece on every frame
def warp(arr, tx, ty, ang, k, resample, flip=False):
  """Template → frame, the same as anchors.fit: mirror (head turned back), scale k and rotate ang (deg, counter-
  clockwise) about the template head centre, then move by (tx, ty)."""
  if flip: arr = np.roll(arr[:, ::-1], int(2 * cx - (S - 1)), axis=1)
  im = Image.fromarray(arr)
  if abs(k - 1) > 1e-6:
    w = round(S * k); r = im.resize((w, w), resample); c2 = Image.new(im.mode, (S, S)); c2.paste(r, (round(cx - cx * k), round(cy - cy * k))); im = c2
  return np.array(im.rotate(ang, resample=resample, center=(cx, cy), translate=(tx, ty)))
pc = piece.clip(0, 255).astype(np.uint8)
face_t = (T[1] * 255).astype(np.uint8)
# hats: the hair above the brim line is pressed under the hat — in template space: per column under the piece,
# carried flat past both ends of the brim
hide_t = np.zeros((S, S), np.uint8)
if KIND == 'hat':
  opq = piece[..., 3] > 128
  if opq.any():
    top = np.argmax(opq, axis=0); has = opq.any(0)
    run = np.cumprod(opq | ~(np.arange(S)[:, None] >= top[None, :]), axis=0).astype(bool) & opq
    bot = np.where(has, S - 1 - np.argmax(run[::-1], axis=0), -1).astype(float)
    xs = np.nonzero(has)[0]; xa, xb = xs.min(), xs.max(); line = bot.copy(); E = 6
    line[:xa] = np.median(bot[xa:xa + E]); line[xb + 1:] = np.median(bot[max(xa, xb - E + 1):xb + 1])
    hide_t = ((np.arange(S)[:, None] <= line[None, :] - 2) * 255).astype(np.uint8)
def head_hair(h):
  lab, n = nd.label(h)
  if n <= 1: return h
  sz = nd.sum(h, lab, range(1, n + 1)); big = lab == (1 + int(np.argmax(sz))); near = nd.binary_dilation(big, iterations=3); keep = big.copy()
  for i in range(1, n + 1):
    cm = lab == i
    if (cm & near).any(): keep |= cm
  return keep
def front_mask(mk, h, face_pred):
  # in front of the head: the sword (with its outline/glow), the arms/hands (big skin blobs that are not the face)
  # and their sleeves
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
  sword |= nd.binary_dilation(sword, iterations=2) & (mk[..., 0] != 40) & ~face_pred
  return sword | arms | sleeves

# ---------------------------------------------------------------- 3b) pose hints: on the hardest frames GPT drew the
# item in that pose; the clean sprite is laid exactly where GPT put it (mirrored if the head turned back)
CELLS = MD + VER + '_cells.npz'
if not FROM_LAYER and not meta.get('single') and os.path.exists(CELLS) and os.environ.get('HINTS', '1') == '1':
  z = np.load(CELLS); CF, CM = z['frames'], z['masks']; cells = meta['cells']
  g_full = np.array(gi.resize((1536, 1024), Image.LANCZOS) if gi.size != (1536, 1024) else gi).astype(np.float32)
  A0 = piece[..., 3] > 128
  for j in range(1, len(cells)):
    a, c = cells[j]
    g = g_full[(j // 6) * 256:(j // 6 + 1) * 256, (j % 6) * 256:(j % 6 + 1) * 256]
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
    hj = head_hair(hair_j); V = ~front_mask(bm, hj, np.zeros_like(hj))
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
    if v >= 0.65 and (not fl or v >= 0.8):
      A['frames'][a][c] = [dx, dy, ang, round(k, 3), round(v, 3), fl]
    print('hint', a, c, 'IoU', round(v, 2), 'angle', ang, 'flip', fl, '(head fit', old[2] if old else None, ')', flush=True)

OUT = G + f'public/assets/final/cosmetics/warrior/{iid}/layers/base/'; os.makedirs(OUT, exist_ok=True)
for a in json.load(open(G + 'src/data/base-sheets.json')):
  m = np.array(Image.open(BASE + a + '_m.png')); n = m.shape[1] // S; out = np.zeros((S, n * S, 4), np.uint8)
  px_strip = np.array(Image.open(BASE + a + '.png').convert('RGBA'))
  for c in range(n):
    r = A['frames'].get(a, [None] * n)[c] if a in A['frames'] else None
    if not r: continue
    tx, ty, ang, k, score = r[:5]; fl = r[5] if len(r) > 5 else False
    q = warp(pc, tx, ty, ang, k, Image.BICUBIC, fl)
    mk = m[:, c * S:(c + 1) * S]; h = head_hair(mk[..., 0] == 40); sk = mk[..., 0] == 60
    # in front of the head: the sword, the arms/hands (skin blobs that reach well outside the head) and their sleeves
    face_pred = nd.binary_dilation(warp(face_t, tx, ty, ang, k, Image.NEAREST, fl) > 127, iterations=6)
    front = front_mask(mk, h, face_pred)
    q[front] = 0
    if KIND == 'hat':
      hide = warp(hide_t, tx, ty, ang, k, Image.NEAREST, fl) > 127
      opq_f = q[..., 3] >= 128
      nearp = nd.distance_transform_edt(~opq_f) <= 14 if opq_f.any() else np.zeros_like(opq_f)   # only hair right beside the hat
      gone = hide & h & ~opq_f & nearp
      fpx = px_strip[:, c * S:(c + 1) * S].astype(int); dark = fpx[..., :3].max(2) < 120
      gone |= nd.binary_dilation(gone, iterations=2) & dark & ~face_pred & ~front & (q[..., 3] < 128) & (mk[..., 0] != 80)
      q[gone] = [255, 0, 255, 255]
    out[:, c * S:(c + 1) * S] = q
  Image.fromarray(out).save(OUT + a + '.png', optimize=True)
cp = G + 'src/data/cosmetics.json'; D = json.load(open(cp))
for x in D['classes']['warrior']:
  if x['id'] == iid: x['layers'] = f'assets/final/cosmetics/warrior/{iid}/layers'; x.pop('wip', None)
json.dump(D, open(cp, 'w'), indent=1)
print('baked', iid)
