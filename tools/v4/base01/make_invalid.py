"""Gate 5's invalid sources that are made, not drawn: controlled changes of a valid item picture, so the importer meets
a known, measured defect (the art director's rule for X01 and X02: image transformations, not redraws). The same
inputs always give the same pictures.

Usage: python3 make_invalid.py   (writes the pictures under items/gate5/invalid/ and prints what each one changes)

X01 subtle proportions: the hat item (stress/i07) with the body below the neck re-proportioned: the torso (neck to
    hips) 4% shorter, the legs (hips to ankles) as much longer; the head, the hat and the feet stay where they were.
X02 wrong reference pose: the fitted trousers item (gate5/b01_07) with the far arm turned 6 deg outward about its
    shoulder joint (the hand moves about 21 px); everything else as drawn.
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


def main():
    os.makedirs(OUT, exist_ok=True)
    made = {}
    x01, info = x01_proportions(rgb('items/stress/i07_hat_v1.png'))
    Image.fromarray(x01).save(os.path.join(OUT, 'x01_proportions.png')); made['x01_proportions'] = {'from': 'items/stress/i07_hat_v1.png', **info}
    x02, info = x02_pose(rgb('items/gate5/b01_07_leather_trousers_v1.png'))
    Image.fromarray(x02).save(os.path.join(OUT, 'x02_pose.png')); made['x02_pose'] = {'from': 'items/gate5/b01_07_leather_trousers_v1.png', **info}
    json.dump(made, open(os.path.join(OUT, 'made.json'), 'w'), indent=1)
    for k, v in made.items(): print(k, v)


if __name__ == '__main__':
    main()
