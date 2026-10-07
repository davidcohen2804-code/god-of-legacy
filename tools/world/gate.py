# gate.py : the Temple Gate — the open gateway on the line between the Crimson Ruins (monsters) and Temple Road (the class
# masters). GPT drew it seen along the terrace's depth: the back tower on the floor's back edge, the front tower on the
# front balustrade, the arch between them high over the walkway (you walk through it left to right).
#   in : tools/world/gate/gate_gpt.png (magenta)
#   out: public/assets/world/gate/{back,front}.png (back tower + its door / the rest: arch, banner, front tower),
#        src/data/world-gate.json (where they go, their layers, the two towers' footprints)
import json, os
import numpy as np
from PIL import Image
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
Q = 1.5                                   # texture px per world px
S = 0.73                                  # world px per GPT px (floor depth: back tower foot → front tower foot)
# GPT px → world px: the back tower's foot (600, 559) stands at (6270, 375), just in front of the back balustrade
AX, AY, WX, WY = 600, 559, 6270, 375
SPLIT_X = 705                             # GPT px: left of it the back tower and its door (behind anyone on the floor)

im = np.array(Image.open(G + 'gate/gate_gpt.png').convert('RGB')).astype(np.float32)
Rc, Gc, Bc = im[..., 0], im[..., 1], im[..., 2]
a = 1 - np.clip(((np.minimum(Rc, Bc) - Gc) - 60) / 90, 0, 1)
sp = np.clip(np.minimum(Rc, Bc) - Gc - 12, 0, None) * (a < 0.98); im[..., 0] -= sp * 0.75; im[..., 2] -= sp * 0.75
rgba = np.dstack([im.clip(0, 255), a * 255]).astype(np.uint8)
out = R + 'public/assets/world/gate/'; os.makedirs(out, exist_ok=True)
H, W = a.shape
k = S * Q
parts = {}
for name, sl in (('back', np.s_[:, :SPLIT_X]), ('front', np.s_[:, SPLIT_X:])):
  part = np.zeros_like(rgba); part[sl] = rgba[sl]
  img = Image.fromarray(part); bb = img.getbbox()
  img = img.crop(bb); img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
  img.save(out + f'{name}.png', optimize=True)
  parts[name] = {'x': round(WX + (bb[0] - AX) * S, 1), 'y': round(WY + (bb[1] - AY) * S, 1)}
W2 = lambda ix, iy: [round(WX + (ix - AX) * S, 1), round(WY + (iy - AY) * S, 1)]
data = {
  'q': Q,
  # layers: the back tower behind anyone on the floor; the arch, the banner and the front tower in front of everyone
  'back': {**parts['back'], 'depth': WY + 1},
  'front': {**parts['front'], 'depth': 705},
  # footprints (world px): the towers' bases, solid (nobody walks or jumps through them)
  'props': [
    {'id': 'gate-back', 'foot': [W2(500, 470), W2(705, 470), W2(705, 562), W2(500, 562)], 'h': 999},
    {'id': 'gate-front', 'foot': [W2(820, 880), W2(1040, 880), W2(1040, 990), W2(820, 990)], 'h': 999},
  ],
}
json.dump(data, open(R + 'src/data/world-gate.json', 'w'), indent=1)
print(json.dumps(data))
