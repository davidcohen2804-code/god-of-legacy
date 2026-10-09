# clouds.py : the Sky Path — a trail of cloud platforms leading on from Ivy Summit's right end, high over the terrace;
# you run and jump from cloud to cloud (each its own height); fall between them and you drop to the floor below.
#   in : tools/world/clouds/sheet.png (GPT: 6 cloud platforms on magenta — 2 small, 2 medium, 2 large)
#   out: public/assets/world/clouds/c<i>.png (each cloud keyed), src/data/world-clouds.json:
#        sprites (size, the rows of its flat top face), band (the lane's y: the top face as walked), path (each cloud:
#        x0..x1, its height z, which sprite, a treasure on it)
#   python3 tools/world/clouds.py   (then tools/world/strip.py: the lane joins the world's floor)
import json, os
import numpy as np, cv2
from scipy import ndimage
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
OUT = R + 'public/assets/world/clouds/'; os.makedirs(OUT, exist_ok=True)
im = cv2.imread(G + 'clouds/sheet.png').astype(np.float32)
dist = np.sqrt((im[..., 2] - 255) ** 2 + im[..., 1] ** 2 + (im[..., 0] - 255) ** 2)
alpha = np.clip((dist - 70) / 80, 0, 1)
M = np.array([255, 0, 255], np.float32)
aa = np.maximum(alpha, 0.25)[..., None]
col = np.where((alpha > 0)[..., None], np.clip((im - (1 - aa) * M) / aa, 0, 255), im)   # the magenta out of the soft edge
lab, _ = ndimage.label(ndimage.binary_closing(alpha > 0.5, iterations=4))
boxes = [(sl[1].start, sl[0].start, sl[1].stop, sl[0].stop) for i, sl in enumerate(ndimage.find_objects(lab)) if (lab[sl] == i + 1).sum() > 3000]
boxes.sort(key=lambda b: ((b[2] - b[0]) // 150, b[1], b[0]))   # small, medium, large
sprites = []
for i, (x0, y0, x1, y1) in enumerate(boxes):
  x0, y0, x1, y1 = max(0, x0 - 6), max(0, y0 - 6), x1 + 6, y1 + 6
  c = col[y0:y1, x0:x1]; a = alpha[y0:y1, x0:x1]
  rgba = np.dstack([c, a[..., None] * 255]).clip(0, 255).astype(np.uint8)
  cv2.imwrite(OUT + f'c{i}.png', rgba)
  w = x1 - x0; mid = c[:, int(w * 0.3):int(w * 0.7)]
  yel = (mid[..., 1] > 150) & (mid[..., 2] > 215) & (mid[..., 0] < 200)
  rows = np.nonzero(yel.mean(1) > 0.4)[0]
  sprites.append({'img': f'assets/world/clouds/c{i}.png', 'w': int(w), 'h': int(y1 - y0), 'top': [int(rows.min()), int(rows.max())]})
  print('cloud', i, (x0, y0, x1, y1), 'top face rows', rows.min(), rows.max())
# the lane (world y) the clouds' top faces make — inside Ivy Summit's floor, so you step off its right end onto it
BAND = [30, 100]
# the path (world x): from Ivy Summit's right end (x 4304, its floor at z 680) to the right, up and down
PATH = [   # a journey: two easy steps right, a jump up, a little drop down, one more, then the big cloud before Cloud Haven
  {'x': [4330, 4560], 'z': 690, 's': 0},
  {'x': [4630, 4870], 'z': 690, 's': 1},
  {'x': [4940, 5250], 'z': 735, 's': 2},
  {'x': [5320, 5600], 'z': 700, 's': 3},
  {'x': [5670, 5910], 'z': 740, 's': 0},
  {'x': [5980, 6300], 'z': 770, 's': 5, 'reward': {'item': 'elixir', 'every': 300}},
]
json.dump({'name': 'Sky Path', 'band': BAND, 'lane': [4304, 6380], 'sprites': sprites, 'path': PATH},
          open(R + 'src/data/world-clouds.json', 'w'), indent=1)
print('sky path', len(PATH), 'clouds')
