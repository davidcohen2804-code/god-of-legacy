# bake_cycle.py <gpt_image> <sheet_json> : GPT locomotion cycles (walk / run, 4 key poses) → base strips.
# The whole figure is GPT's. Per cycle: every frame's hips (shorts) are put on one fixed x — no horizontal jitter —
# and the frames that touch the ground (contact poses) put their lowest foot exactly on the ground line; flight poses
# keep the height GPT drew relative to them (both feet in the air). Labels hair / skin / shirt / shorts / shoes / sword.
# The json lists cells: [anim, col] (null = unused); `contact` lists, per anim, the columns that touch the ground
# (default: all). Each listed anim strip is REPLACED by exactly the listed columns.
import json, sys, os, numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352; C = 256; GROUND = 310
img, sj = sys.argv[1], sys.argv[2]
spec = json.load(open(sj)); cells = spec['cells']; contact = spec.get('contact', {}); hipx = spec.get('hipx', {})
BASE = G + 'public/assets/final/body/warrior/base/'
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bake_pose.py')).read()
exec(src[src.index('def keyed('):src.index('frames = []')])   # keyed(), labels() of the pose baker

gi = Image.open(img).convert('RGB')
if gi.size != (1536, 1024): gi = gi.resize((1536, 1024), Image.LANCZOS)
gi = np.array(gi).astype(np.float32)
frames = {}
for j, cell in enumerate(cells):
  if not cell: continue
  an, c = cell; cy, cx = (j // 6) * C, (j % 6) * C
  e = np.array(Image.fromarray(gi[cy:cy + C, cx:cx + C].clip(0, 255).astype(np.uint8)).resize((S, S), Image.LANCZOS)).astype(np.float32)
  e, a = keyed(e)
  fig, lab, sword = labels(e, a)
  if spec.get('nosword'):   # climbing: no sword in his hands — what was taken for a blade gets its nearest label
    sword = np.zeros_like(sword); un_ = fig & (lab == 0)
    if un_.any():
      id_ = nd.distance_transform_edt(lab == 0, return_distances=False, return_indices=True); lab[un_] = lab[id_[0], id_[1]][un_]
      blue_ = un_ & (e[..., 2] > e[..., 0] + 10); lab[blue_] = 200   # denim stays shorts
  if spec.get('shoes_anywhere'):   # raised knees: a shoe can be anywhere below the shorts, not only at the bottom
    R_, G_, B_ = e[..., 0], e[..., 1], e[..., 2]; mx_ = np.maximum(np.maximum(R_, G_), B_); mn_ = np.minimum(np.minimum(R_, G_), B_)
    brown_ = fig & (R_ > G_ + 12) & (G_ > B_ + 6) & ((mx_ - mn_) / np.maximum(mx_, 1) > 0.3) & (lab != 40) & (mx_ < 150)   # dark leather, not skin
    sy_ = np.nonzero(lab == 200)[0]
    if len(sy_):
      low_ = np.arange(S)[:, None] > sy_.mean() + 12
      shoes_ = nd.binary_opening(brown_ & low_ & (lab != 200), iterations=1)
      lab_s, n_s = nd.label(shoes_)
      for i_ in range(1, n_s + 1):
        cm_ = lab_s == i_
        if cm_.sum() >= 60: lab[nd.binary_fill_holes(nd.binary_closing(cm_, iterations=2)) & fig & (mx_ < 175)] = 160
  sh = np.nonzero(lab == 200); fy = np.nonzero((lab == 160) & fig)
  frames.setdefault(an, {})[c] = dict(e=e, a=a, fig=fig, lab=lab, sword=sword,
    hx=float(sh[1].mean()) if len(sh[0]) else 176.0, foot=int(fy[0].max()) if len(fy[0]) else int(np.nonzero(fig.any(1))[0].max()))
for an, fs in frames.items():
  hx0 = hipx.get(an, float(np.mean([f['hx'] for f in fs.values()])))
  cont = contact.get(an, list(fs))
  dys = [GROUND - fs[c]['foot'] for c in cont if c in fs]; dy_c = int(round(np.mean(dys))) if dys else 0
  n = max(fs) + 1; strips = [np.zeros((S, n * S, 4), np.uint8) for _ in range(3)]
  for c, f in fs.items():
    dx = int(round(hx0 - f['hx'])); dy = (GROUND - f['foot']) if c in cont else dy_c
    sh = lambda arr: np.roll(np.roll(arr, dy, 0), dx, 1)
    e, a, fig, lab, sword = sh(f['e']), sh(f['a']), sh(f['fig']), sh(f['lab']), sh(f['sword'])
    px, mk, wp = strips
    px[:, c * S:(c + 1) * S, :3] = e.astype(np.uint8); px[:, c * S:(c + 1) * S, 3] = np.where(fig, (a * 255).clip(0, 255), 0).astype(np.uint8)
    mk[:, c * S:(c + 1) * S, 0] = lab; mk[:, c * S:(c + 1) * S, 1] = np.where(sword, 255, 0); mk[:, c * S:(c + 1) * S, 3] = 255
    lum = (0.3 * e[..., 0] + 0.59 * e[..., 1] + 0.11 * e[..., 2]).clip(0, 255); lum = np.where(sword, lum, 0)   # colour only under the sword
    wp[:, c * S:(c + 1) * S] = np.dstack([lum, lum, lum, np.where(sword, 255, 0)]).astype(np.uint8)
    print(an, c, 'dx', dx, 'dy', dy, 'contact' if c in cont else 'flight')
  for s, arr in zip(('.png', '_m.png', '_weapon.png'), strips): Image.fromarray(arr).save(BASE + an + s, optimize=True)
# relabel hair robustly (same rules as every other base frame)
from relabel import relabel_frame
for an in frames:
  px = np.array(Image.open(BASE + an + '.png').convert('RGBA')); m = np.array(Image.open(BASE + an + '_m.png'))
  for c in range(px.shape[1] // S):
    nl = relabel_frame(px[:, c * S:(c + 1) * S].astype(np.float32), m[:, c * S:(c + 1) * S])
    if nl is not None: m[:, c * S:(c + 1) * S, 0] = nl
  Image.fromarray(m).save(BASE + an + '_m.png', optimize=True)
lp = G + 'src/data/base-sheets.json'; L = set(json.load(open(lp))); L |= set(frames); json.dump(sorted(L), open(lp, 'w'))
print('baked', sorted(frames))
