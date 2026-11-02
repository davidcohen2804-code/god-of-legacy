"""Gate 5's invalid sources that are made, not drawn: controlled changes of a valid item picture, so the importer meets
a known, measured defect (the art director's rule for X01 and X02: image transformations, not redraws). The same
inputs always give the same pictures.

Usage: python3 make_invalid.py   (writes the pictures under items/gate5/invalid/ and prints what each one changes)

X01 subtle proportions: the hat item (stress/i07) with the body below the neck re-proportioned: the torso (neck to
    hips) 4% shorter, the legs (hips to ankles) as much longer; the head, the hat and the feet stay where they were.
X02 wrong reference pose: the fitted trousers item (gate5/b01_07) with the far arm turned 6 deg outward about its
    shoulder joint (the hand moves about 21 px); everything else as drawn.
X03 mirrored source: the white linen shirt item (gate5/b01_02) flipped left to right (the character faces the other
    way).
X04 invalid background: the crimson shirt item (gate5/b01_03) with the flat magenta behind the figure replaced by a
    vertical gradient (pale sky blue at the top to warm sand at the bottom); the figure untouched.
X05 slot incompatibility: the ranger's sleeveless tunic item (gate5/b01_01), a valid top, unchanged; its catalog row
    (catalog_negative.csv) says shoes.
X07 facial identity mismatch: the hat item (stress/i07), its uncovered face changed under the hat: both eyes enlarged
    1.25 times about their centres (a smooth local magnification, 34 px round each eye) and the mouth moved 6 px down;
    the hat, the hair and everything else as drawn.
"""
import json, os
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'items/gate5/invalid')
T = json.load(open(os.path.join(HERE, 'template.json')))
J = {n: np.array(p, np.float64) for n, p in T['joints'].items()}
C = T['cuts']
H, W = T['size'][1], T['size'][0]
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
MAGENTA = (255, 0, 255)


def rgb(rel):
    return np.asarray(Image.open(os.path.join(HERE, rel)).convert('RGB'))


def figure(img):
    """The figure's pixels: everything that is not the flat magenta background."""
    d = np.abs(img.astype(np.int16) - np.array(MAGENTA, np.int16)).max(2)
    return d > 60


def x01_proportions(img, torso=0.96):
    """Rows between the neck and the hips squeezed by `torso`, rows between the hips and the ankles stretched so the
    ankles stay put (a piecewise-linear remap of the rows; columns untouched)."""
    neck, hips, ankles = J['neck'][1], (J['hip_B'][1] + J['hip_F'][1]) / 2, (J['ankle_B'][1] + J['ankle_F'][1]) / 2
    hips_new = neck + (hips - neck) * torso
    # output row → source row (the inverse of the change)
    src = np.interp(YY[:, 0], [0, neck, hips_new, ankles, H - 1], [0, neck, hips, ankles, H - 1]).astype(np.float32)
    map_y = np.repeat(src[:, None], W, 1)
    out = cv2.remap(img, XX, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return out, {'neck_y': neck, 'hips_y': round(hips, 1), 'hips_y_new': round(hips_new, 1), 'ankles_y': ankles,
                 'torso_scale': torso, 'legs_scale': round((ankles - hips_new) / (ankles - hips), 4)}


def far_arm_mask(img):
    """The far arm and its hand, cut as the exporter's part map cuts them: the part of the figure hanging free below
    the armpit, joined to the arm's top outside the line from the armpit up through the shoulder joint."""
    m = figure(img)
    xs, ys = zip(*C['head'])
    below_head = YY > np.interp(XX, xs, ys)
    R = m & below_head
    a, b = np.array(C['armpit_F'], float), J['shoulder_F']
    top_end = b + (b - a) * 0.9
    left = (top_end[0] - a[0]) * (YY - a[1]) - (top_end[1] - a[1]) * (XX - a[0])
    lab, _ = ndimage.label(R & (YY >= a[1]))
    seed = (J['elbow_F'] * 0.5 + J['wrist_F'] * 0.5).astype(int)
    free = lab == lab[seed[1], seed[0]]
    return free | (R & (YY < a[1]) & (left > 0))


def x02_pose(img, turn=6.0):
    """The far arm turned `turn` degrees outward (away from the body) about the shoulder joint: its pixels lifted off
    (the background shows where it was) and drawn back turned, behind the torso."""
    arm = ndimage.binary_dilation(far_arm_mask(img), iterations=4)   # with its whole soft outline
    sh = J['shoulder_F']
    # the far arm hangs down on the image's right: outward is counter-clockwise as displayed, which is a positive
    # angle for cv2's rotation matrix
    M = cv2.getRotationMatrix2D((float(sh[0]), float(sh[1])), turn, 1.0)
    moved = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=MAGENTA)
    moved_arm = cv2.warpAffine(arm.astype(np.uint8), M, (W, H), flags=cv2.INTER_NEAREST) > 0
    out = img.copy()
    out[arm] = MAGENTA
    body = figure(out)                      # the figure without the arm: drawn over the arm (the arm is behind)
    put = moved_arm & ~body
    out[put] = moved[put]
    wrist = M @ np.array([J['wrist_F'][0], J['wrist_F'][1], 1.0])
    return out, {'turn_deg': turn, 'about': sh.tolist(), 'wrist_moved_px': round(float(np.hypot(*(wrist - J['wrist_F']))), 1)}


def x03_mirrored(img):
    """The whole picture flipped left to right."""
    return np.ascontiguousarray(img[:, ::-1]), {'flip': 'left-right'}


def x04_background(img, top=(196, 222, 240), bottom=(232, 206, 160)):
    """The magenta behind the figure replaced by a vertical gradient, the figure's soft edge kept (keyed alpha)."""
    import sys
    sys.path.insert(0, HERE)
    from keying import key
    alpha, fg = key(Image.fromarray(img))
    t = (YY[:, :1] / (H - 1))[..., None]
    grad = (np.array(top, np.float32) * (1 - t) + np.array(bottom, np.float32) * t) * np.ones((1, W, 1), np.float32)
    a = alpha[..., None].astype(np.float32)
    out = fg.astype(np.float32) * a + grad * (1 - a)
    return np.clip(out + 0.5, 0, 255).astype(np.uint8), {'background': f'vertical gradient {top} to {bottom}'}


def bulge(img, c, r, k):
    """A smooth local magnification by k about c within radius r (none at the rim)."""
    dx, dy = XX - c[0], YY - c[1]; d = np.sqrt(dx * dx + dy * dy) / r
    w = np.clip(1 - d * d, 0, 1) ** 2
    s = 1 + (k - 1) * w                        # output → source: pull the source in by s near the centre
    return cv2.remap(img, (c[0] + dx / s).astype(np.float32), (c[1] + dy / s).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def shift(img, c, r, v):
    """A smooth local move by v (px) of what lies about c within radius r (none at the rim)."""
    dx, dy = XX - c[0], YY - c[1]; d = np.sqrt(dx * dx + dy * dy) / r
    w = np.clip(1 - d * d, 0, 1) ** 2
    return cv2.remap(img, (XX - v[0] * w).astype(np.float32), (YY - v[1] * w).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


EYES = ((670.0, 342.0), (743.0, 348.0))   # the master's eyes (the near one, the far one), drawing px
MOUTH = (710.0, 415.0)


def x07_face(img, k=1.25, mouth=6.0):
    out = img
    for c in EYES: out = bulge(out, c, 34.0, k)
    out = shift(out, MOUTH, 26.0, (0.0, mouth))
    return out, {'eyes': [list(c) for c in EYES], 'eye_scale': k, 'eye_radius_px': 34, 'mouth': list(MOUTH), 'mouth_moved_px': mouth}


def main():
    os.makedirs(OUT, exist_ok=True)
    made = {}
    x01, info = x01_proportions(rgb('items/stress/i07_hat_v1.png'))
    Image.fromarray(x01).save(os.path.join(OUT, 'x01_proportions.png')); made['x01_proportions'] = {'from': 'items/stress/i07_hat_v1.png', **info}
    x02, info = x02_pose(rgb('items/gate5/b01_07_leather_trousers_v1.png'))
    Image.fromarray(x02).save(os.path.join(OUT, 'x02_pose.png')); made['x02_pose'] = {'from': 'items/gate5/b01_07_leather_trousers_v1.png', **info}
    x03, info = x03_mirrored(rgb('items/gate5/b01_02_linen_shirt_v1.png'))
    Image.fromarray(x03).save(os.path.join(OUT, 'x03_mirrored.png')); made['x03_mirrored'] = {'from': 'items/gate5/b01_02_linen_shirt_v1.png', **info}
    x04, info = x04_background(rgb('items/gate5/b01_03_crimson_shirt_v1.png'))
    Image.fromarray(x04).save(os.path.join(OUT, 'x04_background.png')); made['x04_background'] = {'from': 'items/gate5/b01_03_crimson_shirt_v1.png', **info}
    x05 = rgb('items/gate5/b01_01_ranger_tunic_v1.png')   # the picture is valid: the defect is the row's slot
    Image.fromarray(x05).save(os.path.join(OUT, 'x05_wrong_slot.png')); made['x05_wrong_slot'] = {'from': 'items/gate5/b01_01_ranger_tunic_v1.png', 'change': 'none (a valid top, catalogued as shoes)'}
    x07, info = x07_face(rgb('items/stress/i07_hat_v1.png'))
    Image.fromarray(x07).save(os.path.join(OUT, 'x07_face.png')); made['x07_face'] = {'from': 'items/stress/i07_hat_v1.png', **info}
    json.dump(made, open(os.path.join(OUT, 'made.json'), 'w'), indent=1, default=float)
    for k, v in made.items(): print(k, v)


if __name__ == '__main__':
    main()
