#!/usr/bin/env python3
"""The chibi warrior's rig from GPT's parts sheet (src/warrior_parts.png, cut by cut.py into work/cut): each piece made ready (its
skin-coloured joint caps painted over with the limb's own colours, the upper piece's lower end faded into the piece
under it) and its joints, in each piece's own pixels.  usage: build_warrior.py [scale overrides json] -> rig_w/"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
S = os.environ.get('CHIBI_WORK', os.path.join(HERE, 'work'))  # (cut.py's pieces in work/cut; the rig written to work/rig_w)
C = f'{S}/cut'
OUT = f'{S}/rig_w'
os.makedirs(f'{OUT}/pieces', exist_ok=True)
P = {p['name']: p for p in json.load(open(f'{C}/pieces.json'))}
SHEET = np.asarray(Image.open(os.path.join(HERE, 'src', 'warrior_parts.png')).convert('RGB')).astype(np.float32)
OV = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}

def keyed(box):
    """A box of the sheet keyed off its green (for pieces the cutter joined: the two heads)."""
    x0, y0, x1, y1 = box
    im = SHEET[y0:y1, x0:x1]
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    gn = g - np.maximum(r, b)
    a = np.clip(1.0 - (gn - 40) / 100, 0, 1)
    rgb = im.copy(); rgb[..., 1] = np.where(gn > 0, np.maximum(r, b), g)
    lab, n = ndi.label(a > 0.5)
    if n > 1:  # (the box's largest piece only)
        sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1)); keep = 1 + int(np.argmax(sizes))
        m = ndi.binary_dilation(lab == keep, iterations=2); a = np.where(m, a, 0)
    return np.dstack([rgb.round().astype(np.uint8), (a * 255).astype(np.uint8)]), (x0, y0)

def load(n):
    a = np.asarray(Image.open(f'{C}/{n}.png').convert('RGBA')).copy()
    return a, tuple(P[n]['crop'][:2])

def clean(a):
    f = a.astype(int)
    lime = (f[..., 1] > f[..., 0] - 5) & (f[..., 1] > f[..., 2] + 25)
    a[..., 3] = np.where(lime, 0, a[..., 3]).astype(np.uint8)
    return a

def fill_top(a, o, jy, r, k=0.35):
    """The top cap (above the joint's centre) painted with the limb's colours just below it, stretched up."""
    yr = int(round(jy + k * r - o[1]))
    ref = a[yr, :, :3].copy(); refa = a[yr, :, 3] > 200
    for y in range(0, yr):
        m = (a[y, :, 3] > 0) & refa; a[y, m, :3] = ref[m]
    return a

def fill_bot(a, o, jy, r, k=0.7):
    yr = int(round(jy - k * r - o[1]))
    ref = a[yr, :, :3].copy(); refa = a[yr, :, 3] > 200
    for y in range(yr + 1, a.shape[0]):
        m = (a[y, :, 3] > 0) & refa; a[y, m, :3] = ref[m]
    return a

def fade_down(a, o, jy, r):
    ys = np.arange(a.shape[0])[:, None]
    y0, y1 = jy - 0.75 * r - o[1], jy - 0.05 * r - o[1]
    a[..., 3] = (a[..., 3] * np.clip((y1 - ys) / (y1 - y0), 0, 1)).astype(np.uint8)
    return a

pieces = {}
# the chibi's proportions (the design: chibi/design1.jpg): the sheet drew the limbs too long — shortened, not thinned
SQUASH = {'thigh': 0.58, 'shin': 0.58, 'fore': 0.76}
def piece(name, a, o, pivot, scale=1.0):
    sy = SQUASH.get(name, 1.0)
    im = Image.fromarray(a, 'RGBA')
    if sy != 1.0: im = im.resize((im.width, max(1, round(im.height * sy))), Image.LANCZOS)
    im.save(f'{OUT}/pieces/{name}.png')
    pieces[name] = {'src': f'pieces/{name}.png', 'pivot': [pivot[0] - o[0], (pivot[1] - o[1]) * sy], 'scale': OV.get(name, scale), 'o': o, 'sy': sy}

# joints (sheet px): [centre x, centre y, radius]
J = {
    'arm_top': (100, 455), 'arm_bot': (95, 648, 40),
    'fore_top': (262, 500, 37), 'fore_bot': (300, 752, 40),
    'fist_top': (452, 560, 40), 'hand_top': (627, 560, 40),
    'thigh_top': (822, 495), 'thigh_bot': (836, 756, 40),
    'shin_top': (995, 505, 50), 'shin_bot': (996, 772, 42),
    'boot_top': (1162, 640, 45),
}
HEAD_SCALE = 1.6

a, o = load('p4'); a = clean(a); a = fill_bot(a, o, J['arm_bot'][1], J['arm_bot'][2], 1.0); a = fade_down(a, o, J['arm_bot'][1], J['arm_bot'][2]); piece('arm', a, o, J['arm_top'])
a, o = load('p6'); a = clean(a); a = fill_top(a, o, J['fore_top'][1], J['fore_top'][2]); a = fill_bot(a, o, J['fore_bot'][1], J['fore_bot'][2], 0.9); a = fade_down(a, o, J['fore_bot'][1], J['fore_bot'][2]); piece('fore', a, o, J['fore_top'][:2])
a, o = load('p8'); a = clean(a); a = fill_top(a, o, J['fist_top'][1], J['fist_top'][2], 0.6); piece('fist', a, o, J['fist_top'][:2])
a, o = load('p9'); a = clean(a); a = fill_top(a, o, J['hand_top'][1], J['hand_top'][2], 0.6); piece('hand', a, o, J['hand_top'][:2])
a, o = load('p5'); a = clean(a); a = fill_bot(a, o, J['thigh_bot'][1], J['thigh_bot'][2], 1.0); a = fade_down(a, o, J['thigh_bot'][1], J['thigh_bot'][2]); piece('thigh', a, o, J['thigh_top'])
a, o = load('p7'); a = clean(a); a = fill_top(a, o, J['shin_top'][1], J['shin_top'][2]); a = fade_down(a, o, J['shin_bot'][1], J['shin_bot'][2]); piece('shin', a, o, J['shin_top'][:2])
a, o = load('p10'); a = clean(a); a = fill_top(a, o, J['boot_top'][1], J['boot_top'][2], 0.5); piece('boot', a, o, J['boot_top'][:2])
a, o = load('p2'); a = clean(a); piece('torso', a, o, (775, 398))
a, o = load('p3'); a = clean(a); piece('hips', a, o, (1040, 330))
a, o = load('p0'); a = clean(a); piece('cape', a, o, (1330, 95))
a, o = load('p11'); a = clean(a); piece('sword', a, o, (252, 887), 0.9)
a, o = keyed((0, 20, 329, 336)); a = clean(a); piece('head', a, o, (196, 300), HEAD_SCALE)
a, o = keyed((329, 20, 664, 336)); a = clean(a); piece('head_shout', a, o, (196 + 329, 300), HEAD_SCALE)

def L(name, pt):
    oo = pieces[name]['o']; return [pt[0] - oo[0], (pt[1] - oo[1]) * pieces[name]['sy']]

# bones: name, parent, piece, attach point on the parent's piece (sheet px), z, dark
SHN, SHB = (706, 152), (858, 140)
HIPN, HIPB = (982, 368), (1092, 362)
bones = [
    ('root', None, 'hips', None, 30, 1),
    ('torso', 'root', 'torso', (1040, 192), 31, 1),
    ('cape', 'torso', 'cape', (716, 84), 0, 1),
    ('head', 'torso', 'head', (750, 102), 32, 1),
    ('armB', 'torso', 'arm', SHB, 3, 0.7), ('foreB', 'armB', 'fore', J['arm_bot'][:2], 2, 0.7), ('handB', 'foreB', 'hand', J['fore_bot'][:2], 1, 0.7),
    ('thighB', 'root', 'thigh', HIPB, 12, 0.76), ('shinB', 'thighB', 'shin', J['thigh_bot'][:2], 11, 0.76), ('footB', 'shinB', 'boot', J['shin_bot'][:2], 10, 0.76),
    ('thighF', 'root', 'thigh', HIPN, 22, 1), ('shinF', 'thighF', 'shin', J['thigh_bot'][:2], 21, 1), ('footF', 'shinF', 'boot', J['shin_bot'][:2], 20, 1),
    ('foreF', 'armF', 'fore', J['arm_bot'][:2], 40, 1),
    ('armF', 'torso', 'arm', SHN, 41, 1),
    ('handF', 'foreF', 'fist', J['fore_bot'][:2], 43, 1),
    ('sword', 'handF', 'sword', (482, 712), 42, 1),
]
order = ['root', 'torso', 'cape', 'head', 'armB', 'foreB', 'handB', 'thighB', 'shinB', 'footB', 'thighF', 'shinF', 'footF', 'armF', 'foreF', 'handF', 'sword']
bd = {b[0]: b for b in bones}
out_b = []
for nm in order:
    name, parent, pc, at, z, dark = bd[nm]
    e = {'name': name, 'piece': pc, 'z': z}
    if parent: e['parent'] = parent; e['at'] = L(bd[parent][2], at)
    if dark != 1: e['dark'] = dark
    out_b.append(e)
rig = {'pieces': {k: {kk: vv for kk, vv in v.items() if kk not in ('o', 'sy')} for k, v in pieces.items()}, 'bones': out_b}
json.dump(rig, open(f'{OUT}/warrior.json', 'w'), indent=1)
print('pieces', len(pieces), 'bones', len(out_b))
