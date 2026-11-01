# Pack body template t1 for the studio: the parts cut by template_build.py (the body and the items drawn on it), the head
# standard and the sun-guard sword from candidate B's atlas (the head was fitted to the drawn head at exactly the
# template's scale), and the hand standard cut at the template's hand size (build_hands.py with HAND_SCALE), its skin
# matched to each forearm of the drawing. One atlas page at 512 px per B, plus the data the runtime reads: frames, the
# rig measured on the drawing, the items.
# Usage: pack_t1.py <template dir> <build dir> <hands dir> <out dir>
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import template_lib as tl  # noqa: E402

TDIR, BUILD, HANDS, OUT = sys.argv[1:5]
REPO = os.path.abspath(os.path.join(HERE, '../../..'))
T = json.load(open(os.path.join(TDIR, 'template.json')))
P = json.load(open(os.path.join(BUILD, 'parts.json')))
frames = []  # (name, RGBA Image, pivot (px), extra)


def add(name, im, pivot, **extra): frames.append((name, im.convert('RGBA'), [float(pivot[0]), float(pivot[1])], extra))


# the template's own parts
for name, f in P['frames'].items():
    add(name, Image.open(os.path.join(BUILD, name + '.png')), f['pivot'], **({'rows': f['rows']} if 'rows' in f else {}))

# candidate B's head standard and sword (same 512 px per B: the head was fitted at the template's own scale)
bj = json.load(open(os.path.join(REPO, 'src/v4/real/assets/b.json')))
atlas = Image.open(os.path.join(REPO, 'src/v4/real/assets/b512.png')).convert('RGBA')
BF = {f['name']: f for f in bj['frames512']}


def from_b(src, name, fix=None):
    f = BF[src]
    im = atlas.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
    piv = (f['px'] * f['w'], f['py'] * f['h'])
    if fix: im = fix(im, piv)
    add(name, im, piv)


def cut_neck(im, piv):
    """The face's neck stub goes: the head standard is cut just under its jaw line (the body's own drawn neck carries on
    up under the chin), so no second neck and no line across the throat. The jaw line was read on the head standard's
    frame: from (48, 142) to (95, 159) at 512 px per B."""
    a = np.array(im).astype(np.float32)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    jaw = 142 + (xx - 48) * (17 / 47) + 2.0
    a[..., 3] *= np.clip((jaw - yy) / 1.5 + 0.5, 0, 1)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


from_b('b/head_face', 'head/face', cut_neck)
def hair_only(im, piv):
    """The hair layer without the thin contour of the face it was cut around (a 1-2 px line that ran down round the
    jaw and across the neck): only the hair's own mass is kept, opened by 2 px and grown back by 1."""
    from scipy import ndimage
    a = np.array(im).astype(np.float32)
    m = a[..., 3] > 100
    mass = ndimage.binary_dilation(ndimage.binary_opening(m, structure=np.ones((5, 5), bool)), iterations=1)
    a[..., 3] *= mass
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


from_b('b/hair', 'head/hair', hair_only)
for ex in ('blink', 'angry', 'hurt'): from_b(f'b/face_{ex}', f'head/face_{ex}')
for ex in ('neutral', 'blink', 'angry', 'hurt'): from_b(f'b/fringe_{ex}', f'head/fringe_{ex}')
from_b('b/sword', 'weapon/sun_sword')

# the hand standard at the template's hand size, skin matched to each forearm of the drawing
alpha, fg = tl.key(os.path.join(TDIR, T['body']))
J = {n: np.array(p, float) for n, p in T['joints'].items()}
hm = json.load(open(os.path.join(HANDS, 'parts_hands.json')))['parts']


def skin_median(rgb, a):
    m = (a > 0.9) & (rgb.max(-1) > 0.55) & (rgb[..., 0] > rgb[..., 2] + 0.12)
    return np.median(rgb[m], axis=0)


ref_hand = np.array(Image.open(os.path.join(HANDS, 'basic_fist.png')).convert('RGBA')).astype(np.float32) / 255
hand_skin = skin_median(ref_hand[..., :3], ref_hand[..., 3])
for s in 'BF':
    yy, xx = np.mgrid[0:alpha.shape[0], 0:alpha.shape[1]]
    near = ((xx - J[f'wrist_{s}'][0]) ** 2 + (yy - J[f'wrist_{s}'][1]) ** 2 < 30 ** 2) & ((xx - J[f'elbow_{s}'][0]) ** 2 + (yy - J[f'elbow_{s}'][1]) ** 2 < np.sum((J[f'wrist_{s}'] - J[f'elbow_{s}']) ** 2))
    arm_skin = skin_median(fg[near], alpha[near])
    gain = arm_skin / np.maximum(hand_skin, 1e-3)
    print(s, 'forearm skin', np.round(arm_skin * 255), 'hand skin', np.round(hand_skin * 255), 'gain', np.round(gain, 3))
    for state in ('relaxed', 'fist', 'grip', 'grip2', 'open'):
        for suf in ('', '_back'):
            n = f'basic_{state}{suf}'
            if n not in hm: continue
            im = np.array(Image.open(os.path.join(HANDS, n + '.png')).convert('RGBA')).astype(np.float32)
            im[..., :3] = np.clip(im[..., :3] * gain, 0, 255)
            pv = hm[n]['pivots']
            extra = {'grip': [round(pv[1][0], 2), round(pv[1][1], 2)]} if len(pv) > 1 else {}
            add(f'hand_{s}/{state}{suf}', Image.fromarray(im.astype(np.uint8)), pv[0], **extra)


def pack(size):
    W = size
    page = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    x = y = shelf = 0
    out = []
    for name, im, piv, extra in sorted(frames, key=lambda f: -f[1].height):
        w, h = im.width + 2, im.height + 2
        if x + w > W: x, y, shelf = 0, y + shelf, 0
        if y + h > W: raise SystemExit('atlas too small')
        page.alpha_composite(im, (x + 1, y + 1))
        out.append({'name': name, 'x': x + 1, 'y': y + 1, 'w': im.width, 'h': im.height,
                    'px': round(piv[0] / im.width, 5), 'py': round(piv[1] / im.height, 5), **extra})
        x += w; shelf = max(shelf, h)
    H = 1
    while H < y + shelf: H *= 2
    return page.crop((0, 0, W, H)), out


page, out = pack(1024)
os.makedirs(OUT, exist_ok=True)
page.save(os.path.join(OUT, 't1.png'), optimize=True)
# the source drawing at half size, keyed (the studio's overlay for checking the assembly at rest)
src = Image.open(os.path.join(TDIR, T['body'])).convert('RGB')
ka = tl.premul(alpha, fg)
tl.to_png(tl.resize_premul(ka, 0.5)).save(os.path.join(OUT, 't1_drawing.png'), optimize=True)
hand_len = round(hm['basic_grip']['pivots'][1][1] / 512 - hm['basic_grip']['pivots'][0][1] / 512, 5)
json.dump({'id': T['id'], 'bpx': 512, 'frames': out, 'rig': {**P['rig'], 'hand_len': hand_len}, 'items': P['items']},
          open(os.path.join(OUT, 't1.json'), 'w'), indent=1)
print('frames', len(out), 'page', page.size, 'hand_len', hand_len)
