#!/usr/bin/env python3
"""Pack the rendered frames (2x) into the game's hero atlas: body.png and its entry for src/data/hero-atlas.json.
usage: pack.py FRAMESDIR OUT_PNG OUT_JSON target_standing_height [maxW]"""
import sys, json
from PIL import Image
d, outp, outj, target = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
maxW = int(sys.argv[5]) if len(sys.argv) > 5 else 4096
meta = json.load(open(f'{d}/frames.json'))
idle = next(m for m in meta if m['name'] == 'idle-0')
stand2x = idle['ay'] - 4  # (the figure's top to the ground in the 2x frame: its box was padded 4 px)
k = target / stand2x
ims = []
for m in meta:
    im = Image.open(f"{d}/{m['name']}.png").convert('RGBA')
    w, h = max(1, round(m['w'] * k)), max(1, round(m['h'] * k))
    ims.append((m, im.resize((w, h), Image.LANCZOS)))
# shelf packing, tallest first
order = sorted(range(len(ims)), key=lambda i: -ims[i][1].height)
x = y = rowh = 0; place = {}; P = 2
for i in order:
    im = ims[i][1]
    if x + im.width > maxW: x = 0; y += rowh + P; rowh = 0
    place[i] = (x, y); x += im.width + P; rowh = max(rowh, im.height)
H = y + rowh
atlas = Image.new('RGBA', (maxW, H), (0, 0, 0, 0))
actions = {}
for i, (m, im) in enumerate(ims):
    px, py = place[i]; atlas.paste(im, (px, py))
    act, idx = m['name'].rsplit('-', 1)
    b = [round(v * k, 1) for v in m['blade']] if m.get('blade') else None
    fr = [px, py, im.width, im.height, round(m['ax'] * k, 1), round(m['ay'] * k, 1)] + ([b] if b else [])
    actions.setdefault(act, {})[int(idx)] = fr
actions = {a: [v[i] for i in sorted(v)] for a, v in actions.items()}
# the strides: the distance the planted foot slides back over a cycle (feet: per frame, per foot, heel/toe x at 2x)
def cycle(act):
    fr = [m for m in meta if m['name'].rsplit('-', 1)[0] == act]
    fr.sort(key=lambda m: int(m['name'].rsplit('-', 1)[1]))
    xs = [min(m['feet'][0]) for m in fr]
    return round((max(xs) - min(xs)) * 2 * k, 1)
entry = {'h': round(target, 1), 'actions': actions, 'cycle': {'walk': cycle('walk'), 'run': cycle('run')}}
atlas.save(outp, optimize=True)
json.dump(entry, open(outj, 'w'))
print('atlas', atlas.size, 'k', round(k, 4), 'frames', len(ims), 'cycle', entry['cycle'])
