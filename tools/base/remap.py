# remap.py : side view only — base frames drawn front/back-facing are replaced by side-view frames of other moves.
# Each entry: (anim, col) := (src_anim, src_col)  (frame, mask and weapon layers copied together).
import os, numpy as np
from PIL import Image
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352
BASE = G + 'public/assets/final/body/warrior/base/'
MAP = {
  # Whirlwind (skill 4): no spin — rapid forward / backhand horizontal slashes (the VFX spins around him)
  ('whirlwind', 2): ('warrior_basic', 3), ('whirlwind', 3): ('whirlwind', 1), ('whirlwind', 4): ('warrior_basic', 3),
  ('whirlwind', 5): ('dash_slash', 4), ('whirlwind', 6): ('warrior_basic', 3), ('whirlwind', 7): ('whirlwind', 1),
  ('whirlwind', 8): ('warrior_basic', 3),
  # basic chain, strike 2 wind-up was drawn facing the camera: sword extended forward, then the backhand
  ('warrior_basic', 2): ('whirlwind', 1),
  # War Cry roar was drawn facing the camera: the side-view power pose (fist raised)
  ('war_cry', 1): ('ground_breaker', 4), ('war_cry', 2): ('ground_breaker', 5),   # planting the sword: side view
  ('war_cry', 3): ('iron_grip', 3), ('war_cry', 4): ('iron_grip', 4), ('war_cry', 5): ('radiant_blade', 1),
  # sword to the sky (Blade Storm hold, also Radiant Blade's hold) was drawn with the face turned to the camera:
  # the side-view raised sword
  ('blade_storm', 3): ('titans_verdict', 1), ('blade_storm', 4): ('titans_verdict', 1), ('blade_storm', 5): ('titans_verdict', 1),
  # Radiant Blade overhead charge was drawn facing the camera: two-handed raised sword, side view
  ('radiant_blade', 2): ('sanctuary', 6), ('radiant_blade', 3): ('sanctuary', 6), ('radiant_blade', 4): ('sanctuary', 6),
}
cache = {}
def strip(a):
  if a not in cache: cache[a] = [np.array(Image.open(BASE + a + s).convert('RGBA')) for s in ('.png', '_m.png', '_weapon.png')]
  return cache[a]
src = {k: [x[:, v[1] * S:(v[1] + 1) * S].copy() for x in strip(v[0])] for k, v in MAP.items()}   # read all sources first
for (a, c), arrs in src.items():
  for x, y in zip(strip(a), arrs): x[:, c * S:(c + 1) * S] = y
for a, arrs in cache.items():
  for s, x in zip(('.png', '_m.png', '_weapon.png'), arrs): Image.fromarray(x).save(BASE + a + s, optimize=True)
print('remapped', len(MAP), 'frames')
