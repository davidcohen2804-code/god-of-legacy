"""The gambler's free hand — the one that holds the cards, flips the coin, throws — in every atlas frame, for the effects
that sit in his hand (Charged Deal's fan, the coin, the ace, Call the Deck's card, 52 Pickup's glow, the double's coin):
→ src/data/gambler-hand.json { "<action>-<i>": [x, y] | null } relative to the frame's feet (frame px).
David 3 Nov 01:27 ("it must sit under the palm in every move — pay attention to these things, it's critical"): the effects
used one fixed point beside his chest, wherever the hand was drawn. In order:
 1. read by eye on a grid (tools/heroes/data/gambler_hand_marks.json: frame px from the frame's top-left) — the skills
    whose effects sit in his hand; the palm (or what it holds: the coin on the thumb, the card at the fingertips);
 2. the painted card fan he holds (idle, walk, the stance, the get-up's end…): its bright pink cards found by colour —
    the palm just under the fan;
 3. the run and Grand Slam's swing (both hands on the cane): the hand on the cane, just behind where its light starts
    (tools/heroes/data/gambler_cane_light.json);
 else null (the effect keeps its own place). Run after tools/heroes/cut.py gambler (re-read a re-shot action)."""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
A = json.load(open(os.path.join(ROOT, 'src/data/hero-atlas.json')))['gambler']['actions']
M = json.load(open(os.path.join(ROOT, 'tools/heroes/data/gambler_hand_marks.json')))
CANE = json.load(open(os.path.join(ROOT, 'tools/heroes/data/gambler_cane_light.json')))
IMG = np.asarray(Image.open(os.path.join(ROOT, 'public/assets/final/heroes/gambler/body.png')).convert('RGBA')).astype(int)

def fan(f):
    """The painted fan's palm: just under its bright pink cards (the coat's pink lining, big and low, is left out)."""
    x, y, w, h = f[:4]; F = IMG[y:y + h, x:x + w]
    r, g, b, a = F[..., 0], F[..., 1], F[..., 2], F[..., 3]
    pink = (a > 128) & (r > 190) & (b > 140) & (g > 60) & (g < 185) & (r > g + 40)
    lab, n = ndimage.label(ndimage.binary_dilation(pink, iterations=2))
    best = None
    for k in range(1, n + 1):
        m = (lab == k) & pink; s = int(m.sum())
        if s < 25: continue
        ys, xs = np.nonzero(m)
        if ys.mean() > h * 0.55: continue
        if not best or s > best[0]: best = (s, float(xs.mean()), float(ys.max()))
    return [best[1] - 1, best[2] + 4] if best else None

def run_hand(key):
    s = CANE.get(key)
    if not s: return None
    sx, sy, ex, ey = s[:4]; L = max(1e-6, ((ex - sx) ** 2 + (ey - sy) ** 2) ** 0.5)
    return [sx - (ex - sx) / L * 7, sy - (ey - sy) / L * 7]

out = {}
for act, fs in A.items():
    for i, f in enumerate(fs):
        key = f'{act}-{i}'
        p = M.get(key) or fan(f) or (run_hand(key) if act in ('run', 'grand_swing') else None)
        out[key] = [round(p[0] - f[4], 1), round(p[1] - f[5], 1)] if p else None
json.dump(out, open(os.path.join(ROOT, 'src/data/gambler-hand.json'), 'w'), separators=(',', ':'))
print(sum(v is not None for v in out.values()), '/', len(out))
