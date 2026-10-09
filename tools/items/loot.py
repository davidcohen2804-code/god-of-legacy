# loot.py : the loot sheet from GPT (red potion, blue potion, a few coins, a coin pile on magenta) -> the item icons.
#   in : tools/items/loot_gpt.png, items_gpt.png (food, scroll, buffs, elixir, materials), coin_gpt.png (8-frame coin spin -> coin_spin.png)     out: public/assets/final/items/<id>.png (128 px)
import numpy as np
from PIL import Image
from scipy import ndimage as nd
R = __file__.rsplit('/', 3)[0] + '/'
def key(path):
  im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
  r, g, b = im[..., 0], im[..., 1], im[..., 2]
  mag = np.clip((np.minimum(r, b) - g - 60) / 90, 0, 1)            # 1 = background magenta
  a = 1 - mag
  rgb = im.copy()
  # despill: pull the magenta tint out of the edge pixels
  m = np.minimum(r, b) > g
  k = np.where(m, (np.minimum(r, b) - g) * (1 - a) , 0)
  rgb[..., 0] -= k; rgb[..., 2] -= k
  out = np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)
  return Image.fromarray(out, 'RGBA')

def save(sheet, cols, rows, names):
  W, H = sheet.width / cols, sheet.height / rows
  for i, n in enumerate(names):
    cx, cy = i % cols, i // cols
    c = sheet.crop((round(cx * W), round(cy * H), round((cx + 1) * W), round((cy + 1) * H)))
    al = np.asarray(c)[..., 3]; al = np.where(al < 24, 0, al)
    lab, k = nd.label(al > 128)                    # the item only: no slivers of the neighbouring cells
    if k: sz = nd.sum(al > 128, lab, range(1, k + 1)); keep = nd.binary_dilation(np.isin(lab, 1 + np.nonzero(sz >= sz.max() * 0.08)[0]), iterations=3); al = np.where(keep, al, 0)
    c.putalpha(Image.fromarray(al.astype(np.uint8)))
    c = c.crop(c.getbbox()); S = 128; s = S * 0.94 / max(c.size)
    c = c.resize((round(c.width * s), round(c.height * s)), Image.LANCZOS)
    o = Image.new('RGBA', (S, S)); o.alpha_composite(c, ((S - c.width) // 2, (S - c.height) // 2))
    o.save(R + f'public/assets/final/items/{n}.png', optimize=True)
    print(n, c.size)

save(key(R + 'tools/items/loot_gpt.png'), 4, 1, ['red_potion', 'blue_potion', 'gold_small', 'gold_big'])
save(key(R + 'tools/items/cloud_icons.png'), 3, 1, ['cloud_puff', 'cloud_feather', 'storm_core'])
save(key(R + 'tools/items/items_gpt.png'), 5, 2, ['apple', 'meat', 'orange', 'cake', 'return_scroll', 'warrior_potion', 'swift_potion', 'elixir', 'rust_shard', 'cursed_cloth'])

# the spinning coin (8 frames, one scale for all: the turn stays true)
cs = key(R + 'tools/items/coin_gpt.png'); A = np.asarray(cs)[..., 3]
lab, k = nd.label(nd.binary_dilation(A > 128, iterations=4))   # each coin (with its glint) is one blob; left to right
objs = sorted([o for o in nd.find_objects(lab) if (o[1].stop - o[1].start) * (o[0].stop - o[0].start) > 2000], key=lambda o: o[1].start)
assert len(objs) == 8, len(objs)
frames = []
for o in objs:
  c = cs.crop((o[1].start, 0, o[1].stop, cs.height)); al = np.asarray(c)[..., 3]
  m = lab[:, o[1].start:o[1].stop] == lab[o][lab[o] > 0][0]; al = np.where(m, al, 0)
  c.putalpha(Image.fromarray(al.astype(np.uint8))); frames.append(c)
bbs = [f.getbbox() for f in frames]; top = min(b[1] for b in bbs); bot = max(b[3] for b in bbs); s = 128 * 0.9 / (bot - top)
sheet = Image.new('RGBA', (128 * 8, 128))
for i, (f, b) in enumerate(zip(frames, bbs)):
  g = f.crop((b[0], top, b[2], bot)); g = g.resize((max(1, round(g.width * s)), round(g.height * s)), Image.LANCZOS)
  sheet.alpha_composite(g, (i * 128 + (128 - g.width) // 2, (128 - g.height) // 2))
sheet.save(R + 'public/assets/final/items/coin_spin.png', optimize=True)
print('coin_spin', [f.getbbox()[2] - f.getbbox()[0] for f in frames])
