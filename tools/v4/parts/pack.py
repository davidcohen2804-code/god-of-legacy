# Pack the cut parts of candidate B (basic clothing + Golden Warrior set) into the lab's real-art atlases and write
# the rig geometry measured from the basic parts. Usage: pack.py <work dir> <out dir>
# Output: <out>/b512.png, <out>/b256.png, <out>/b.json
import json, sys
from PIL import Image

D, OUT = sys.argv[1], sys.argv[2]
HIP = 0.37
meta = {k: json.load(open(f'{D}/parts_{k}.json')) for k in ('basic', 'gold')}
BPX = meta['basic']['bpx']

frames = []  # (name, image, pivot)
def add(look, part, far=False, name=None):
    p = meta[look]['parts'][part]
    im = Image.open(f'{D}/parts_{look}/{part}{"_far" if far else ""}.png').convert('RGBA')
    frames.append((name or f'b/{look}/{part}{"_far" if far else ""}', im, p['pivots'][0], p['pivots']))

add('basic', 'head', name='b/head'); add('basic', 'sword', name='b/sword')
for look in ('basic', 'gold'):
    for part in ('torso', 'hips'): add(look, part)
    for part in ('uparm', 'forearm', 'fist', 'thigh', 'shin', 'foot'):
        add(look, part); add(look, part, far=True)
add('gold', 'cape')


def pack(scale, size):
    """Shelf packing into one page `size` wide; the height is the next power of two that holds every shelf."""
    W = size
    page = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    x = y = shelf = 0
    out = []
    for name, im, piv, _ in sorted(frames, key=lambda f: -f[1].height):
        if scale != 1:
            im = im.convert('RGBa').resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS).convert('RGBA')
        w, h = im.width + 2, im.height + 2
        if x + w > W: x, y, shelf = 0, y + shelf, 0
        if y + h > W: raise SystemExit(f'atlas {size} too small')
        page.alpha_composite(im, (x + 1, y + 1))
        out.append({'name': name, 'x': x + 1, 'y': y + 1, 'w': im.width, 'h': im.height,
                    'px': round(piv[0] * scale / im.width, 5), 'py': round(piv[1] * scale / im.height, 5)})
        x += w; shelf = max(shelf, h)
    H = 1
    while H < y + shelf: H *= 2
    return page.crop((0, 0, W, H)), out


p512, f512 = pack(1.0, 1024)
p256, f256 = pack(0.5, 512)
p512.save(f'{OUT}/b512.png', optimize=True)
p256.save(f'{OUT}/b256.png', optimize=True)

# rig geometry (B units, the rig's convention: offsets in the parent's rest frame, y down negative-up)
P = meta['basic']['parts']
pv = lambda n, i: P[n]['pivots'][i]
u = lambda v: round(v / BPX, 4)
h0 = pv('hips', 0)
geo = {
    'hip': [0, -HIP],
    'chest': [u(pv('hips', 1)[0] - h0[0]), u(pv('hips', 1)[1] - h0[1])],
    'thigh_F': [u(pv('hips', 2)[0] - h0[0]), u(pv('hips', 2)[1] - h0[1])],
    'thigh_B': [u(pv('hips', 3)[0] - h0[0]), u(pv('hips', 3)[1] - h0[1])],
}
t0 = pv('torso', 0)
for bone, k in (('head', 1), ('uparm_F', 2), ('uparm_B', 3)):
    geo[bone] = [u(pv('torso', k)[0] - t0[0]), u(pv('torso', k)[1] - t0[1])]
lens = {
    'uparm': u(pv('uparm', 1)[1] - pv('uparm', 0)[1]),
    'forearm': u(pv('forearm', 1)[1] - pv('forearm', 0)[1]),
    'hand': u(pv('fist', 1)[1] - pv('fist', 0)[1]),
    'thigh': u(pv('thigh', 1)[1] - pv('thigh', 0)[1]),
    'shin': u(pv('shin', 1)[1] - pv('shin', 0)[1]),
}
json.dump({'bpx': BPX, 'frames512': f512, 'frames256': f256, 'geometry': geo, 'lengths': lens}, open(f'{OUT}/b.json', 'w'), indent=1)
print(json.dumps({'geometry': geo, 'lengths': lens, 'frames': len(f512)}))
