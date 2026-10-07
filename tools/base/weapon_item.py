# weapon_item.py <id> <drawing> : a new sword ITEM in hand, from ONE drawing (GPT: on magenta, level, pommel left, tip right)
#   → public/assets/final/body/naked/<g>/gear/<move>_sword_<id>.png for both genders, the same frames as the starter sword's
#   strips (<move>_sword.png). Where the sword goes comes from those: each frame's blade line (src/data/naked-blades.json:
#   guard → tip) gives the grip and the angle; the body strip gives the fist that hides the grip; and where the starter
#   sword is drawn BEHIND the body (a swing over the head), the new one is too. Same reach as the starter sword (effects
#   ride the same line). New moves: re-run after naked_frames.py.
#   python3 tools/base/weapon_item.py warrior_job tools/base/gpt/weapons/warrior_job_sword.png
import json, os, sys, shutil, tempfile, numpy as np
from PIL import Image
from scipy import ndimage as nd
H = os.path.dirname(os.path.abspath(__file__)); G = H + '/../../'
sys.path.insert(0, H); import sword as SWORD
S = 352; GROUND = 310
iid, drawing = sys.argv[1], sys.argv[2]
OLD = SWORD.picture(); REACH = SWORD.reach(OLD); GUARD = SWORD.guard(OLD)
tmp = tempfile.mkdtemp(); os.makedirs(tmp + '/gpt'); shutil.copy(drawing, tmp + '/gpt/sword.png'); shutil.copy(H + '/bake_pose.py', tmp)
SWORD.H = tmp; NEW = SWORD._from_icon(); SWORD.H = H
def regrip(pic):
  """The grip by the drawing's shape (not by colour: gold trim reads as brown): left of the guard (the tallest columns
  past the hilt), the narrow run between the pommel and the guard; the grip point = its middle, the grip mask = it."""
  col, al, _, _, tip, K = pic
  hcol = (al > 0.5).sum(0).astype(np.float32); xs = np.nonzero(hcol)[0]; x0, x1 = xs.min(), xs.max()
  span = x1 - x0; guard = x0 + int(np.argmax(hcol[x0:x0 + int(0.45 * span)]))          # the cross-guard: the tallest column
  blade_h = np.median(hcol[guard + int(0.15 * span):x1 - int(0.1 * span)])
  narrow = [x for x in range(x0, guard) if 0 < hcol[x] <= blade_h * 0.75]
  runs, cur = [], []
  for x in narrow:
    if cur and x != cur[-1] + 1: runs.append(cur); cur = []
    cur.append(x)
  if cur: runs.append(cur)
  g = max(runs, key=len) if runs else list(range(x0, guard))
  gmask = np.zeros(al.shape, bool); gmask[:, g[0]:g[-1] + 1] = al[:, g[0]:g[-1] + 1] > 0.5
  return col, al, gmask, ((g[0] + g[-1]) / 2, pic[3][1]), tip, K
NEW = regrip(NEW)
LOOK = json.load(open(G + 'src/data/naked-look.json')); BL = json.load(open(G + 'src/data/naked-blades.json'))
for g in ('male', 'female'):
  SW = LOOK[g]['swordCell']; PAD = (SW - S) // 2; D = G + f'public/assets/final/body/naked/{g}/'
  for anim in LOOK[g]['gear'].get('sword', []):
    old = np.asarray(Image.open(D + f'gear/{anim}_sword.png').convert('RGBA')).astype(np.float32)
    body = np.asarray(Image.open(D + f'{anim}.png').convert('RGBA'))[..., 3] > 128
    n = old.shape[1] // SW; out = np.zeros_like(old)
    for c in range(n):
      gx, gy, tx, ty = BL[g][anim][c]
      gx += S / 2; gy += GROUND; tx += S / 2; ty += GROUND
      L = np.hypot(tx - gx, ty - gy) / (1 - GUARD); ux, uy = (tx - gx) / (L * (1 - GUARD)), (ty - gy) / (L * (1 - GUARD))
      grip = (tx - ux * L, ty - uy * L); ang = np.degrees(np.arctan2(uy, ux))
      fig = body[:, c * S:(c + 1) * S]; figp = np.pad(fig, ((0, 0), (PAD, PAD)))
      hide = SWORD.fist_mask(figp, (grip[0] + PAD, grip[1]))
      full = SWORD.place(OLD, (grip[0] + PAD, grip[1]), ang, L, (S, SW), hide=hide)
      have = old[:, c * SW:(c + 1) * SW, 3] / 255
      behind = np.clip(full[..., 3] - have, 0, 1) > 0.35                       # the starter sword is hidden there: behind the body
      behind = nd.binary_dilation(behind, iterations=3) & (figp | behind)
      new = SWORD.place(NEW, (grip[0] + PAD, grip[1]), ang, L, (S, SW), hide=hide, behind=behind.astype(np.float32))
      out[:, c * SW:(c + 1) * SW] = np.concatenate([new[..., :3], new[..., 3:] * 255], -1)
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(D + f'gear/{anim}_sword_{iid}.png', optimize=True)
  print(g, 'done')

# its bag icon: the same drawing, diagonal, tip up and right (like the starter sword's) → public/assets/items/<id>_sword.png
col, al = NEW[0], NEW[1]
im = Image.fromarray(np.dstack([col * al[..., None], al * 255]).clip(0, 255).astype(np.uint8), 'RGBA').rotate(45, Image.BICUBIC, expand=True)
im = im.crop(im.getbbox()); SIZE, PADI = 96, 6; k = (SIZE - 2 * PADI) / max(im.size)
im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
cv = Image.new('RGBA', (SIZE, SIZE)); cv.alpha_composite(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
cv.save(G + f'public/assets/items/{iid}_sword.png', optimize=True)
