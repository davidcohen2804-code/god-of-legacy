"""R15 visual regression (the art director's check before 500+ items): every item worn alone, in the master's
reference pose and the review motion poses, against its approved maps (which piece shows at each pixel, B = 300 px,
from r15.mjs). Per item and pose it measures what changed: the silhouette (pixels drawn or not), the bare body showing
(pixels of the body's own pieces), and the boundaries between pieces (pixels whose piece changed). An item passes when
every map is identical to the approved one; a changed item is shown (approved | now | what changed) and either fixed or
approved again; a new item waits for approval.

Usage: python3 r15.py compare <renders> [fixtures]     (prints PASS / FAIL per item, writes <renders>/r15_report.json
                                                          and <renders>/r15_changes.png)
       python3 r15.py approve <renders> <id,id,...|all> [fixtures]   (the renders become the approved maps)
Fixtures: fixtures/r15/<item>/<pose>.png with fixtures/r15/slots.json and approved.json.
"""
import json, os, shutil, sys, datetime
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, 'fixtures/r15')
POSES = ['rest', 'idle', 'run_near_knee', 'run_far_knee', 'jump_tuck', 'landing', 'light_attack', 'heavy_attack']
EDGE = 254


def names(slots, m):
    """The map as slot names (None: nothing drawn; '~': an edge blending two pieces)."""
    lut = np.array([None] + list(slots) + [None] * (253 - len(slots)) + ['~', None], dtype=object)
    return lut[m]


def load(d, item, pose):
    p = os.path.join(d, item, pose + '.png')
    return np.asarray(Image.open(p).convert('L')) if os.path.exists(p) else None


def measure(a, sa, b, sb):
    """What changed between two maps (each with its slot names): silhouette, bare body, boundaries (pixel counts)."""
    na, nb = names(sa, a), names(sb, b)
    da, db = a > 0, b > 0
    sil = da ^ db
    body = lambda n: np.vectorize(lambda v: isinstance(v, str) and v.endswith('.skin'))(n)
    ba, bb = body(na), body(nb)
    bare = ba ^ bb
    piece = (na != nb) & da & db & ~((a == EDGE) & (b == EDGE))
    return {'silhouette_px': int(sil.sum()), 'silhouette_share': round(float(sil.sum()) / max(1, int((da | db).sum())), 4),
            'bare_body_px': int(bare.sum()), 'boundary_px': int(piece.sum())}, (sil, bare, piece)


def colour(m):
    rng = np.random.RandomState(7)
    pal = rng.randint(40, 230, (256, 3)).astype(np.uint8); pal[0] = (12, 16, 23); pal[EDGE] = (255, 255, 255)
    return pal[m]


def compare(renders, fix=FIX):
    sr = json.load(open(os.path.join(renders, 'slots.json')))
    sf = json.load(open(os.path.join(fix, 'slots.json'))) if os.path.exists(os.path.join(fix, 'slots.json')) else {'slots': []}
    approved = json.load(open(os.path.join(fix, 'approved.json'))) if os.path.exists(os.path.join(fix, 'approved.json')) else {}
    report, changed_rows, fails = {}, [], 0
    for item in sr['items']:
        if item not in approved:
            report[item] = {'status': 'new: waits for approval'}; fails += 1
            print(f'FAIL {item}: new, no approved maps yet'); continue
        poses = {}
        for pose in POSES:
            a, b = load(fix, item, pose), load(renders, item, pose)
            if a is None or b is None: poses[pose] = {'missing': True}; continue
            m, masks = measure(a, sf['slots'], b, sr['slots'])
            poses[pose] = m
            if any(v for k, v in m.items() if k.endswith('_px')): changed_rows.append((item, pose, a, b, masks))
        bad = {p: m for p, m in poses.items() if m.get('missing') or any(v for k, v in m.items() if k.endswith('_px'))}
        report[item] = {'status': 'changed' if bad else 'unchanged', 'poses': poses}
        if bad:
            fails += 1
            worst = max(bad.items(), key=lambda kv: kv[1].get('silhouette_px', 0) + kv[1].get('boundary_px', 0))
            print(f"FAIL {item}: changed in {len(bad)} poses (worst {worst[0]}: {worst[1]})")
        else:
            print(f'PASS {item}: identical in {len(POSES)} poses')
    json.dump(report, open(os.path.join(renders, 'r15_report.json'), 'w'), indent=1)
    if changed_rows:
        # approved | now | what changed (red: silhouette, blue: bare body, yellow: a boundary between pieces)
        k = 0.5; W = int(780 * k); H = int(690 * k)
        F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
        sheet = Image.new('RGB', (3 * W + 20, len(changed_rows[:12]) * (H + 22)), (12, 16, 23)); d = ImageDraw.Draw(sheet)
        for i, (item, pose, a, b, (sil, bare, piece)) in enumerate(changed_rows[:12]):
            y = i * (H + 22)
            diff = np.zeros(a.shape + (3,), np.uint8) + 12
            diff[piece] = (240, 200, 60); diff[bare] = (80, 140, 255); diff[sil] = (240, 70, 60)
            for j, im in enumerate((colour(a), colour(b), diff)):
                sheet.paste(Image.fromarray(im).resize((W, H), Image.NEAREST), (j * (W + 10), y + 20))
            d.text((4, y + 2), f'{item} {pose}: approved | now | changed (red silhouette, blue bare body, yellow boundary)', fill=(226, 180, 92), font=F)
        sheet.save(os.path.join(renders, 'r15_changes.png'))
    total = len(sr['items'])
    print(f"R15 {'PASS' if not fails else 'FAIL'}: {total - fails} of {total} items identical to their approved maps in {len(POSES)} poses")
    return fails == 0


def approve(renders, ids, fix=FIX):
    sr = json.load(open(os.path.join(renders, 'slots.json')))
    os.makedirs(fix, exist_ok=True)
    if ids != 'all' and os.path.exists(os.path.join(fix, 'slots.json')) and json.load(open(os.path.join(fix, 'slots.json')))['slots'] != sr['slots']:
        raise SystemExit('the rig\'s slots changed since the approved maps: approve every item again (ids = all)')
    approved = json.load(open(os.path.join(fix, 'approved.json'))) if os.path.exists(os.path.join(fix, 'approved.json')) else {}
    todo = sr['items'] if ids == 'all' else ids.split(',')
    skip = os.environ.get('R15_EXCEPT', '')   # (items whose approval is pending, left out of 'all')
    todo = [t for t in todo if t not in skip.split(',')]
    parts = json.load(open(os.path.join(HERE, '../../../src/v4/base01/assets/base01.json')))
    for item in todo:
        src = os.path.join(renders, item)
        if not os.path.isdir(src): raise SystemExit(f'no renders of {item}')
        shutil.rmtree(os.path.join(fix, item), ignore_errors=True)
        os.makedirs(os.path.join(fix, item))
        for pose in POSES:   # kept as 8-bit maps (a few KB each)
            Image.open(os.path.join(src, pose + '.png')).convert('L').save(os.path.join(fix, item, pose + '.png'), optimize=True)
        approved[item] = {'exporter': parts.get('versions', {}).get('exporter'), 'source': parts.get('versions', {}).get('sources', {}).get(item), 'date': datetime.date.today().isoformat()}
    json.dump({'slots': sr['slots']}, open(os.path.join(fix, 'slots.json'), 'w'), indent=1)
    json.dump(dict(sorted(approved.items())), open(os.path.join(fix, 'approved.json'), 'w'), indent=1)
    print('approved', len(todo), 'items')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'compare': sys.exit(0 if compare(sys.argv[2], *(sys.argv[3:4])) else 1)
    elif cmd == 'approve': approve(sys.argv[2], sys.argv[3], *(sys.argv[4:5]))
    else: raise SystemExit(__doc__)
