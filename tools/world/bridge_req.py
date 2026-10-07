# bridge_req.py : the pictures GPT fills to join two neighbouring maps into one scene → tools/world/bridges/req_<a>_<b>.png
# Canvas 1672x941 = the last 636 px of the left map | 400 px gap | the first 636 px of the right map; magenta = paint here
# (the gap, plus a map's closed edge where the walkway has to break through).
import os
from PIL import Image
G = os.path.dirname(os.path.abspath(__file__)) + '/'
KEEP, GAP = 636, 400
SEAMS = [('courtyard', 'training', 0, 0), ('training', 'plaza', 150, 0), ('plaza', 'terraces', 150, 300),
         ('terraces', 'ruins', 0, 200), ('ruins', 'temple', 0, 0)]  # left, right, px of the left/right map repainted
for a, b, ea, eb in SEAMS:
  A = Image.open(G + f'work/{a}_nosun.png').convert('RGB'); B = Image.open(G + f'work/{b}_nosun.png').convert('RGB')
  im = Image.new('RGB', (KEEP * 2 + GAP, 941), (255, 0, 255))
  im.paste(A.crop((1672 - KEEP, 0, 1672 - ea, 941)), (0, 0))
  im.paste(B.crop((eb, 0, KEEP, 941)), (KEEP + GAP + eb, 0))
  im.save(G + f'bridges/req_{a}_{b}.png')
  print('req', a, b)
