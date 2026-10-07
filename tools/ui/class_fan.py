# class_fan.py : the class fan on the Character Creation screen (GPT art: tools/ui/gpt_class_fan.png, five cards — the
#   warrior, the book mage, the archer, the samurai, a "?" card — over the GOD OF LEGACY logo, on flat magenta) →
#   public/assets/final/character_create/class_fan.webp        the fan cut off the magenta
#   public/assets/final/character_create/class_fan_glow_N.webp card N's background lit up (the card's own colour, light
#                                                               from behind the hero), the hero and the frame left out —
#                                                               laid over the fan while the pointer is on that card
#   src/data/class-fan.json                                     the picture's size and each card's hover outline (fan px)
# The heroes' silhouettes come from tools/ui/class_fan_chars.png (tools/ui/class_fan_sam.py). The cards are split by the
# gold bars between them (lines fitted to the bars), the arch under them (a circle fitted to its top edge) and the fan's
# outline; each card's frame and the ornaments hanging off it are peeled off its background.
# python3 tools/ui/class_fan.py
import json, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
OUT = R + 'public/assets/final/character_create/'
OUT_W = 1180                        # exported width (the fan shows ~590 design px wide: 2x for sharp high-DPI screens)
LIGHT = [(1.0, 0.42, 0.18), (0.35, 0.68, 1.0), (0.72, 1.0, 0.3), (1.0, 0.35, 0.2), (1.0, 0.74, 0.32)]  # each card's glow
GAIN = [1.35, 1.4, 1.35, 1.35, 1.5]                                                                   # how much brighter
GLOW = 0.42
# the gold bars between the cards, roughly (top, bottom) — refined below from the picture
BARS = [((358, 143), (466, 600)), ((609, 93), (656, 550)), ((927, 93), (884, 550)), ((1181, 143), (1117, 529))]

bgr = cv2.imread(G + 'gpt_class_fan.png')
rgb = bgr[..., ::-1].astype(np.float32)
H, W = rgb.shape[:2]
hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV_FULL).astype(np.float32)
hue, sat, val = hsv[..., 0] * 360 / 256, hsv[..., 1] / 255, hsv[..., 2] / 255
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
heroes = (np.array(Image.open(G + 'class_fan_chars.png')).astype(np.int32) + 30) // 60   # 0 none, 1..4 the hero of card N-1
hero = heroes > 0

# ---- the fan off the magenta ------------------------------------------------------------------------------------------
M = np.array([255, 0, 255], np.float32)
dm = np.linalg.norm(rgb - M, axis=2)
lab, _ = ndimage.label(dm < 150)
seed = np.unique(lab[dm < 60]); seed = seed[seed > 0]
bg = np.isin(lab, seed)                                           # magenta, and its soft edge
mag = (np.abs(hue - 300) < 28) & (sat > 0.35) & (val > 0.12)      # magenta in shadow (pockets inside the ornaments)
lab, n = ndimage.label(mag)
size = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
touch = set(np.unique(lab[ndimage.binary_dilation(bg)]).tolist())
bg |= np.isin(lab, [i for i in range(1, n + 1) if size[i - 1] >= 6 or i in touch])
fg = ~bg
inner = ndimage.distance_transform_edt(fg) > 2.0
_, (iy, ix) = ndimage.distance_transform_edt(~inner, return_indices=True)
F = rgb[iy, ix]                                                   # the nearest colour well inside the fan
_, (by, bx) = ndimage.distance_transform_edt(~bg, return_indices=True)
B = np.where(bg[..., None], rgb, rgb[by, bx])                     # the nearest magenta (lit or in shadow)
FB = F - B
cover = np.clip(np.sum((rgb - B) * FB, axis=2) / np.maximum(np.sum(FB * FB, axis=2), 1.0), 0, 1)
near = ndimage.distance_transform_edt(~fg) <= 1.5
alpha = np.where(inner, 1.0, np.where(fg | near, cover, 0.0))
alpha[bg & ~near] = 0
col = np.where(inner[..., None], rgb, F)
rim = (ndimage.distance_transform_edt(~bg) < 4) & (np.abs(hue - 300) < 30) & (sat > 0.15)   # last pink on the rim: grey
col[rim] = (col[rim] @ np.array([0.3, 0.59, 0.11], np.float32))[:, None] * 0.9

# ---- the cards ----------------------------------------------------------------------------------------------------------
gold = (hue > 15) & (hue < 62) & (sat > 0.25) & (val > 0.35)
bars = []
for (x0, y0), (x1, y1) in BARS:                                   # each bar: the centre of its gold, row by row → a line
    pts = []
    for y in range(y0 + 40, y1 - 10, 6):
        xp = x0 + (x1 - x0) * (y - y0) / (y1 - y0)
        lo = int(xp - 22); row = gold[y, lo:lo + 44] & ~hero[y, lo:lo + 44]
        best, cur, start = 0, 0, 0
        for i, g in enumerate(row):
            cur = cur + 1 if g else 0
            if cur > best: best, start = cur, i - cur + 1
        if best >= 5: pts.append((lo + start + best / 2, y))
    P = np.array(pts); keep = np.ones(len(P), bool)
    for _ in range(3):
        a, b = np.polyfit(P[keep, 1], P[keep, 0], 1)
        r = np.abs(P[:, 0] - (a * P[:, 1] + b)); keep = r < max(2.5, np.median(r[keep]) * 2.5)
    bars.append((a, b))
pts = []                                                          # the arch's top edge, column by column → a circle
gold_s = (hue > 15) & (hue < 62) & (sat > 0.25) & (val > 0.35) & ~hero
for x in range(360, 1180, 8):
    ye = int(540 + (x - 768) ** 2 * (90 / 368 ** 2))
    col_ = gold_s[ye - 40:ye + 30, x]; run = 0
    for i, g in enumerate(col_):
        run = run + 1 if g else 0
        if run >= 6: pts.append((x, ye - 40 + i - run + 1)); break
P = np.array(pts, float); keep = np.ones(len(P), bool)
for _ in range(4):
    A = np.c_[2 * P[keep, 0], 2 * P[keep, 1], np.ones(keep.sum())]
    cx, cy, c = np.linalg.lstsq(A, (P[keep] ** 2).sum(1), rcond=None)[0]; rad = np.sqrt(c + cx * cx + cy * cy)
    d = np.abs(np.hypot(P[:, 0] - cx, P[:, 1] - cy) - rad); keep = d < max(3, np.median(d[keep]) * 2.5)
fan = ndimage.binary_fill_holes(alpha > 0.5)
above = np.hypot(xx - cx, yy - cy)
xbar = [a * yy + b for a, b in bars]
def between(i, m):
    g = np.ones((H, W), bool)
    if i > 0: g &= xx > xbar[i - 1] + m
    if i < 4: g &= xx < xbar[i] - m
    return g

# each card's background: inside its frame, the frame peeled off (gold / dark outline pieces reaching the edge, and
# small gold pieces hanging from the top: an ornament's spike), the hero left out
fan_in = cv2.erode(fan.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))) > 0
gold = (hue > 15) & (hue < 62) & (sat > 0.22) & (val > 0.3)         # (a little wider: the frame's shaded gold too)
backs = []
for i in range(5):
    reg = fan_in & (above > rad + 2) & between(i, 3)
    d = ndimage.distance_transform_edt(reg)
    edge_bits = (gold | (val < 0.1)) & reg & (d < 26)
    lab, _ = ndimage.label(edge_bits, np.ones((3, 3)))
    t = np.unique(lab[(d > 0) & (d < 2.5) & edge_bits]); t = t[t > 0]
    back = reg & ~np.isin(lab, t)
    if i < 4:                                                     # (the "?" card: its cracks run into the frame — keep)
        hang = gold & reg & (d < 95) & back
        lab, _ = ndimage.label(hang, np.ones((3, 3)))
        top = np.where(reg.any(0), reg.argmax(0), H)
        ys, xs = np.nonzero(hang)
        up = set(np.unique(lab[ys, xs][ys <= top[xs] + 30]).tolist()) - {0}
        rim_ = ndimage.binary_dilation(reg & ~back, iterations=2)
        t = set(np.unique(lab[rim_ & hang]).tolist()) - {0}
        sz = dict(zip(range(1, lab.max() + 1), ndimage.sum(np.ones_like(lab), lab, range(1, lab.max() + 1))))
        back &= ~np.isin(lab, [j for j in t & up if sz[j] < 2500])
    back &= ~hero
    lab, n = ndimage.label(back)
    sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    backs.append(np.isin(lab, [j + 1 for j in range(n) if sz[j] >= 250]))

# ---- the glow: brighter (in linear light) plus light of the card's colour from behind the hero ---------------------------
base = col / 255.0
lin = base ** 2.2
glows = []
for i, m in enumerate(backs):
    ys, xs = np.nonzero(m)
    gy, gx = ys.mean() - ys.std() * 0.3, xs.mean()
    ry, rx = ys.std() * 2.2, xs.std() * 2.4
    light = np.exp(-(((yy - gy) / ry) ** 2 + ((xx - gx) / rx) ** 2) * 1.4)
    lit = np.clip(lin * GAIN[i] ** 2.2 + (np.array(LIGHT[i]) ** 2.2)[None, None] * (light * GLOW)[..., None], 0, 1) ** (1 / 2.2)
    a = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.0) * alpha
    glows.append(np.dstack([lit * 255, a * 255]))

# ---- hover outlines: the card between the bars' centres, above the arch, and its hero wherever he reaches ---------------
cards = np.zeros((H, W), np.uint8)
for i in range(5): cards[fan & (above > rad) & between(i, 0)] = i + 1
cards[hero] = heroes[hero]

# ---- export: the fan's box (a little margin), scaled to OUT_W -----------------------------------------------------------
ys, xs = np.nonzero(alpha > 0.02)
x0, y0, x1, y1 = max(0, xs.min() - 4), max(0, ys.min() - 4), min(W, xs.max() + 5), min(H, ys.max() + 5)
k = OUT_W / (x1 - x0); OW, OH = OUT_W, round((y1 - y0) * k)
os.makedirs(OUT, exist_ok=True)
def save(rgba, name):
    im = Image.fromarray(np.clip(rgba[y0:y1, x0:x1] + 0.5, 0, 255).astype(np.uint8), 'RGBA')
    im = Image.fromarray(np.array(im.resize((OW, OH), Image.LANCZOS)), 'RGBA')
    im.save(OUT + name, 'WEBP', quality=90, method=6)
save(np.dstack([col, alpha * 255]), 'class_fan.webp')
for i, g in enumerate(glows): save(g, f'class_fan_glow_{i}.webp')
outlines = []
for i in range(5):
    lab, n = ndimage.label(cards == i + 1)
    sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    big = (lab == int(np.argmax(sz)) + 1).astype(np.uint8)
    cs, _ = cv2.findContours(big, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    poly = cv2.approxPolyDP(max(cs, key=cv2.contourArea), 2.0, True)[:, 0]
    outlines.append([[round((px - x0) * k, 1), round((py - y0) * k, 1)] for px, py in poly])
json.dump({'w': OW, 'h': OH, 'cards': outlines}, open(R + 'src/data/class-fan.json', 'w'), separators=(',', ':'))
print('fan', OW, 'x', OH, '| bars', [tuple(round(v, 3) for v in b) for b in bars], '| arch', round(cx, 1), round(cy, 1), round(rad, 1),
      '| backgrounds', [int(m.sum()) for m in backs], '| outline points', [len(o) for o in outlines])
