# loot.py : the loot sheet from GPT (red potion, blue potion, a few coins, a coin pile on magenta) -> the 4 item icons.
#   in : tools/items/loot_gpt.png     out: public/assets/final/items/{red_potion,blue_potion,gold_small,gold_big}.png (128 px)
import numpy as np
from PIL import Image
R = __file__.rsplit('/', 3)[0] + '/'
im = np.asarray(Image.open(R + 'tools/items/loot_gpt.png').convert('RGB')).astype(np.float32)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
mag = np.clip((np.minimum(r, b) - g - 60) / 90, 0, 1)            # 1 = background magenta
a = 1 - mag
rgb = im.copy()
spill = np.clip(np.minimum(r, b) - g, 0, None) * mag[..., None].squeeze() if False else None
# despill: pull the magenta tint out of the edge pixels
m = np.minimum(r, b) > g
k = np.where(m, (np.minimum(r, b) - g) * (1 - a) , 0)
rgb[..., 0] -= k; rgb[..., 2] -= k
out = np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)
sheet = Image.fromarray(out, 'RGBA')
W = sheet.width // 4
for i, n in enumerate(['red_potion', 'blue_potion', 'gold_small', 'gold_big']):
  c = sheet.crop((i * W, 0, (i + 1) * W, sheet.height))
  al = np.asarray(c)[..., 3]; al = np.where(al < 24, 0, al); c.putalpha(Image.fromarray(al.astype(np.uint8)))
  c = c.crop(c.getbbox()); S = 128; s = S * 0.94 / max(c.size)
  c = c.resize((round(c.width * s), round(c.height * s)), Image.LANCZOS)
  o = Image.new('RGBA', (S, S)); o.alpha_composite(c, ((S - c.width) // 2, (S - c.height) // 2))
  o.save(R + f'public/assets/final/items/{n}.png', optimize=True)
  print(n, c.size)
