# sword.py : the weapon in hand, MapleStory style — ONE sword picture, put in the near fist of every frame (the grip point
#   on the fist, the blade along the frame's angle), the grip hidden behind the fingers. The same sword in every move, and a
#   new weapon is a new picture (tools/base/naked_frames.py bakes the strips with it).
#   The picture: a plain steel sword drawn here (or a drawn one, gpt/sword.png, laid level). The bag icon is this same
#   sword (tools/base/gear_icons.py).
import os, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd

H = os.path.dirname(os.path.abspath(__file__))
LEN = 100.0                       # pommel to tip, cell px (the old warrior's and the swing swords' size)


def _drawn(K=8):
  """A plain steel sword, level, pointing right, K px per cell px: RGBA (straight), grip mask, grip point, tip point."""
  W, Hh = int(LEN * K) + 8, int(24 * K); cy = Hh / 2
  X = lambda v: v * K + 4
  col = np.zeros((Hh, W, 3), np.float32); al = np.zeros((Hh, W), np.float32); grip = np.zeros((Hh, W), bool)
  yy, xx = np.mgrid[0:Hh, 0:W].astype(np.float32); u = (xx - 4) / K; v = (yy - cy) / K        # cell px along / across
  half = np.where(u < 86, 4.0, 4.0 * np.clip((100 - u) / 14, 0, 1))                             # the blade: tapers to the tip
  blade = (u >= 23.5) & (u <= 100) & (np.abs(v) <= half)
  guard = (u >= 19.4) & (u <= 23.8) & (np.abs(v) <= 9.0)
  gripm = (u >= 5.6) & (u <= 19.6) & (np.abs(v) <= 2.5)
  pommel = (u - 3.6) ** 2 + v ** 2 <= 3.6 ** 2
  shape = blade | guard | gripm | pommel
  out = shape & ~nd.binary_erosion(shape, iterations=int(1.1 * K))                                 # the dark outline
  # colours: steel lit from above, a fuller down the middle; a dark grey guard and pommel; a brown wrapped grip
  steel = np.where(v[..., None] < 0, [[[226, 232, 242]]], [[[184, 192, 208]]]).astype(np.float32)
  steel = np.where((np.abs(v) < 0.45)[..., None] & (u > 26)[..., None] & (u < 85)[..., None], np.float32([150, 160, 178]), steel)
  steel = np.where(((v < -half + 1.3) & (v > -half + 0.55))[..., None], np.float32([248, 250, 255]), steel)
  col[blade] = steel[blade]
  g_ = np.where(v[..., None] < -2, [[[150, 155, 168]]], [[[100, 104, 116]]]).astype(np.float32); col[guard] = g_[guard]
  wrap = (((u + v * 0.8) * 1.0) % 3.2) < 1.0
  col[gripm] = np.where(wrap[..., None], np.float32([92, 56, 30]), np.float32([126, 80, 44]))[gripm]
  p_ = np.where(((u - 2.6) ** 2 + (v + 1.2) ** 2 <= 1.3 ** 2)[..., None], np.float32([176, 180, 192]), np.float32([112, 116, 128])); col[pommel] = p_[pommel]
  col[out] = (46, 48, 60); al[shape] = 1
  grip[gripm & ~guard & ~pommel] = True
  return col, al, grip, (X(12.6), cy), (X(100), cy), K


def _keyed(rgb):
  """GPT's magenta background off: colour, alpha (the pose baker's keying)."""
  src = open(H + '/bake_pose.py').read(); ns = {'np': np, 'nd': nd}
  exec(src[src.index('def keyed('):src.index('def labels(')], ns)
  return ns['keyed'](rgb)


def _from_icon(K=None):
  """A drawn sword (gpt/sword.png: on magenta, the leftmost picture), laid level, pointing right, LEN cell px long: colour,
  alpha, grip mask (its brown wrapped grip), grip point (the grip's middle), tip point, px per cell px."""
  rgb = np.asarray(Image.open(H + '/gpt/sword.png').convert('RGB')).astype(np.float32)
  e, a = _keyed(rgb); m = a > 0.5
  L, n = nd.label(nd.binary_dilation(m, iterations=6)); sz = nd.sum(m, L, range(1, n + 1))
  big = [i + 1 for i in range(n) if sz[i] > 0.2 * sz.max()]
  first = min(big, key=lambda i: np.nonzero(L == i)[1].mean())                       # the leftmost icon: the sword
  m1 = (L == first) & (a > 0.02); ys, xs = np.nonzero(m1 & (a > 0.5))
  ev, vec = np.linalg.eigh(np.cov(np.vstack([xs, ys]))); u = vec[:, 1]
  R, G, B = e[..., 0], e[..., 1], e[..., 2]; mx = np.maximum(np.maximum(R, G), B); mn = np.minimum(np.minimum(R, G), B)
  brown = m1 & (R > G + 15) & (G > B + 5) & ((mx - mn) / np.maximum(mx, 1) > 0.3) & (mx < 220)
  t = (xs - xs.mean()) * u[0] + (ys - ys.mean()) * u[1]
  by, bx = np.nonzero(brown); tb = ((bx - xs.mean()) * u[0] + (by - ys.mean()) * u[1]).mean() if len(bx) else t.min()
  if tb > 0: u = -u; t = -t; tb = -tb                                                  # the hilt to the left
  ang = np.degrees(np.arctan2(u[1], u[0]))
  y0, y1, x0, x1 = ys.min() - 4, ys.max() + 5, xs.min() - 4, xs.max() + 5
  pm = np.dstack([e * a[..., None], a * 255])[y0:y1, x0:x1]; gm = (brown & nd.binary_closing(brown, iterations=2))[y0:y1, x0:x1]
  im = Image.fromarray(pm.clip(0, 255).astype(np.uint8), 'RGBA').rotate(ang, Image.BICUBIC, expand=True)     # level
  gi = Image.fromarray((gm * 255).astype(np.uint8)).rotate(ang, Image.BILINEAR, expand=True)
  w = np.asarray(im).astype(np.float32); al = w[..., 3] / 255; col = np.where(al[..., None] > 1e-3, w[..., :3] / np.maximum(al[..., None], 1e-3), 0)
  gmask = np.asarray(gi) > 127
  yy_, xx_ = np.nonzero(al > 0.5); cy = (yy_.min() + yy_.max()) / 2; length = xx_.max() - xx_.min()
  gy_, gx_ = np.nonzero(gmask); gx = gx_.mean() if len(gx_) else xx_.min() + 0.13 * length
  return col, al, gmask, (float(gx), float(cy)), (float(xx_.max()), float(cy)), length / LEN


def picture():
  """The sword picture: colour, alpha 0..1, grip mask (hidden behind the fist), grip point, tip point, px per cell px —
  a drawn sword (gpt/sword.png) when there is one, else the plain steel sword drawn here."""
  return _from_icon() if os.path.exists(H + '/gpt/sword.png') else _drawn()


def reach(pic):
  """Grip point → tip, cell px."""
  return (pic[4][0] - pic[3][0]) / pic[5]


def skin_of(fig, lab, e):
  """Our skin (warm and light: not the steel, not the outline)."""
  R, G, B = e[..., 0], e[..., 1], e[..., 2]
  return fig & (lab == 60) & (R > 150) & (G > 95) & (B > 60) & (R > G + 10) & (G > B + 8)


def fist_at(fig, lab, e, p, r=7.0, it=8):
  """The near fist around p (cell px): the middle of its light skin, by steps (mean shift)."""
  skin = skin_of(fig, lab, e)
  yy, xx = np.mgrid[0:fig.shape[0], 0:fig.shape[1]]
  x, y = float(p[0]), float(p[1])
  for _ in range(it):
    w = skin & ((xx - x) ** 2 + (yy - y) ** 2 <= r * r)
    if not w.any(): break
    x, y = float(xx[w].mean()), float(yy[w].mean())
  return x, y


def place(pic, at, angle, reach, shape, hide=None, behind=None, ss=4):
  """The sword drawn into a layer of this shape: its grip point at `at` (x, y), the blade along `angle` (degrees, 0 = right,
  + = down), grip → tip = `reach` px; where `hide` (0..1: the fist) covers the grip, the grip is hidden; where `behind`
  (0..1: the body in front of the sword) is, all of it is. → straight
  RGBA float (colour 0..255, alpha 0..1). Rendered ss× larger, then averaged down (smooth edges)."""
  col, al, grip, (gx, gy), (tx, ty), K = pic
  k = reach / (tx - gx)                                       # picture px → layer px
  a = np.radians(angle); ca, sa = np.cos(a), np.sin(a)
  # layer (ss×) pixel q → picture point: p = R^-1 (q / ss - at) / k + g
  A = ca / (k * ss); B = sa / (k * ss); C = -sa / (k * ss); D = ca / (k * ss)
  c0 = gx - (ca * at[0] + sa * at[1]) / k; f0 = gy - (-sa * at[0] + ca * at[1]) / k
  coeffs = (A, B, c0, C, D, f0)
  Hh, W = shape[0] * ss, shape[1] * ss
  pm = np.dstack([col * al[..., None], al * 255]).clip(0, 255).astype(np.uint8)
  big = np.asarray(Image.fromarray(pm, 'RGBA').transform((W, Hh), Image.AFFINE, coeffs, Image.BICUBIC)).astype(np.float32)
  gm = np.asarray(Image.fromarray((grip * 255).astype(np.uint8)).transform((W, Hh), Image.AFFINE, coeffs, Image.BILINEAR)).astype(np.float32) / 255
  small = big.reshape(shape[0], ss, shape[1], ss, 4).mean((1, 3)); gs = gm.reshape(shape[0], ss, shape[1], ss).mean((1, 3))
  a_ = small[..., 3] / 255
  if hide is not None: a_ = a_ * (1 - np.clip(gs * 1.6, 0, 1) * hide)
  if behind is not None: a_ = a_ * (1 - behind)
  rgb = np.where((small[..., 3] > 0.5)[..., None], small[..., :3] / np.maximum(small[..., 3:4], 1e-3) * 255, 0)
  return np.concatenate([rgb, a_[..., None]], -1)


def fist_mask(fig, at, r=7.5):
  """Where the fist is (the figure within r of the grip point), softly: the grip goes behind it."""
  yy, xx = np.mgrid[0:fig.shape[0], 0:fig.shape[1]]
  d = np.hypot(xx - at[0], yy - at[1])
  return np.clip((r + 0.5 - d), 0, 1) * nd.binary_dilation(fig, iterations=1)
