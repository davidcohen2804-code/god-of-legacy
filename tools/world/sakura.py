# sakura.py : the samurai's region in world-areas.json — Sakura Temple's people, the Waystones (here, at the Temple
# Road and in Elderwood Village), the region's monsters and Ayame's quests. Idempotent: run after expand.py.
#   python3 tools/world/sakura.py
import json, os
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
P = R + 'src/data/world-areas.json'
D = json.load(open(P))
A = D['areas']

def npc(area, n):
  if area not in A: return
  L = A[area].setdefault('npcs', [])
  i = next((i for i, x in enumerate(L) if x['id'] == n['id']), None)
  if i is None: L.append(n)
  else: L[i] = n

WAYSTONE_LINES = ['A standing stone, warm to the touch, a golden sun rune glowing in its face. The old roads between the towns run through these.']
npc('temple', {'id': 'waystone_temple', 'name': 'Waystone', 'title': 'Temple Road', 'x': 1580, 'y': 470, 'art': 'waystone', 'role': 'waystone', 'lines': WAYSTONE_LINES})
npc('dusk_village', {'id': 'waystone_dusk_village', 'name': 'Waystone', 'title': 'Elderwood Village', 'x': 560, 'y': 440, 'art': 'waystone', 'role': 'waystone', 'lines': WAYSTONE_LINES})
npc('sakura_village', {'id': 'waystone_sakura_village', 'name': 'Waystone', 'title': 'Sakura Temple', 'x': 560, 'y': 455, 'art': 'waystone', 'role': 'waystone', 'lines': WAYSTONE_LINES})
npc('sakura_village', {'id': 'ayame', 'name': 'Ayame', 'title': 'Shrine Maiden', 'x': 790, 'y': 400, 'art': 'ayame', 'role': 'quest', 'lines': [
  'Welcome to Sakura Temple, traveller. Every samurai of the mountain learned the first cut on these steps.',
  'Mind the Petal Sprites on the Blossom Steps. They only want to play, but they bury the path by noon.']})
npc('sakura_village', {'id': 'jiro', 'name': 'Jiro', 'title': 'Tea Master', 'x': 1020, 'y': 395, 'art': 'jiro', 'role': 'shop', 'lines': [
  'Tea, rice cakes, a potion or two! Sit a while, the mountain is not going anywhere.',
  'Everything on this tray was brewed with the spring water behind the shrine.']})

# monsters (frames by tools/mobs/mobs.py; a kind is added once its frames exist)
KINDS = {
  'petal_sprite': {'name': 'Petal Sprite', 'frames': 'petal_sprite', 'texQ': 2, 'scale': 1.0, 'hp': 230, 'damage': 14, 'speed': 52, 'aggro': 230, 'range': 72, 'cooldown': 1300, 'respawnMs': 10000, 'exp': 44, 'level': 11},
  'kitsune_kit': {'name': 'Kitsune Kit', 'frames': 'kitsune_kit', 'texQ': 2, 'scale': 1.0, 'hp': 330, 'damage': 17, 'speed': 80, 'aggro': 270, 'range': 96, 'cooldown': 1300, 'respawnMs': 11000, 'exp': 62, 'level': 13},
  'bamboo_ronin': {'name': 'Bamboo Ronin', 'frames': 'bamboo_ronin', 'texQ': 2, 'scale': 1.0, 'hp': 560, 'damage': 22, 'speed': 64, 'aggro': 250, 'range': 84, 'cooldown': 1400, 'respawnMs': 12000, 'exp': 100, 'level': 17},
  'tengu_elder': {'name': 'Tengu Elder', 'frames': 'tengu_elder', 'texQ': 1.4, 'scale': 1.0, 'hp': 5200, 'damage': 30, 'speed': 86, 'aggro': 440, 'range': 130, 'cooldown': 1600, 'respawnMs': 150000, 'exp': 1600, 'level': 19, 'boss': True},
}
for k, v in KINDS.items():
  if os.path.isdir(R + f'public/assets/enemy/{k}'): D['mobKinds'][k] = v
# a map whose monsters have no frames yet stands empty (the game loads every kind's frames)
for area in ('sakura_1', 'sakura_2', 'sakura_3'):
  if area not in A: continue
  for key in ('mobs', 'mobs2'):
    m = A[area].get(key)
    if m and m['kind'] not in D['mobKinds'] and m['kind'] != 'none': A[area][key] = {'kind': 'none', 'spawns': []} if key == 'mobs' else None
  if A[area].get('mobs2') is None: A[area].pop('mobs2', None)

QUESTS = [
  {'id': 'petal_sweep', 'giver': 'ayame', 'title': 'Petals on the Steps', 'after': 'before_road',
   'summary': 'Ayame, the shrine maiden of Sakura Temple, asked you to send the Petal Sprites on the Blossom Steps back to sleep before they bury the path.',
   'offer': ['New to the mountain? Then you can help the shrine. The Petal Sprites woke early this spring, and they bury the Blossom Steps in petals faster than I can sweep.',
             'Send ten of them back to sleep, east of the court, and come back to me. A tap is enough. They are only blossoms with a bit of mischief in them.'],
   'accept': 'On it', 'decline': 'Not now', 'progress': ['Ten Petal Sprites on the Blossom Steps, just east of the court.'],
   'done': ['The steps are clear! Thank you. Here, Jiro sent rice cakes up for whoever helped.'], 'complete': 'Thank you, Ayame',
   'objectives': [{'kind': 'kill', 'mob': 'petal_sprite', 'count': 10, 'text': 'Defeat Petal Sprites (Blossom Steps)'}, {'kind': 'talk', 'npc': 'ayame', 'text': 'Return to Ayame'}],
   'reward': {'gold': 250, 'exp': 450, 'items': {'cake': 5, 'red_potion': 5}}},
  {'id': 'fox_fire', 'giver': 'ayame', 'title': 'Fox Fire', 'after': 'petal_sweep',
   'summary': "The stone foxes of the Fox Shrine Path have lost their lantern fire. Ayame asked you for eight Fox Fire from the Kitsune Kits who ran off with it.",
   'offer': ['Up the path, past the steps, stand the shrine foxes, and their lanterns have gone dark. The Kitsune Kits ran off with the fire to play with.',
             'Bring me eight Fox Fire and I will light the lanterns again. The kits drop it when they are startled. Be gentle: they are young, and they bite only a little.'],
   'accept': "I'll gather it", 'decline': 'Not now', 'progress': ['Eight Fox Fire, from the Kitsune Kits on the Fox Shrine Path.'],
   'done': ['Cool as spring water... yes, this is it. Tonight the shrine foxes will have their lights again.', 'Take these, with the mountain\'s thanks.'], 'complete': 'Glad to help',
   'objectives': [{'kind': 'collect', 'item': 'fox_fire', 'count': 8, 'text': 'Collect Fox Fire from Kitsune Kits (Fox Shrine Path)'}, {'kind': 'talk', 'npc': 'ayame', 'text': 'Bring it to Ayame'}],
   'reward': {'gold': 400, 'exp': 750, 'items': {'blue_potion': 5, 'orange': 10}}},
  {'id': 'tea_order', 'giver': 'ayame', 'title': "Jiro's Order", 'after': 'fox_fire',
   'summary': "Jiro the tea master is out of bamboo shoots for his spring soup. Ayame asked you to bring him six from the Bamboo Grove, where the Bamboo Ronin stand guard.",
   'offer': ['Jiro has been grumbling all week: no bamboo shoots, no spring soup. The grove beyond the fox path is full of them.',
             'Trouble is, the old training dummies up there woke up along with everything else this spring. Bamboo Ronin, the children call them. They swing bamboo, nothing worse.',
             'Bring Jiro six fresh shoots. He will not forget it.'],
   'accept': "I'll bring them", 'decline': 'Not now', 'progress': ['Six Bamboo Shoots from the Bamboo Ronin in the Bamboo Grove, for Jiro at the tea house.'],
   'done': ['Bamboo shoots! Fresh ones! Soup tonight, and you eat first.', 'Here, and come back whenever you are hungry. The mountain feeds those who help it.'], 'complete': 'Smells wonderful',
   'objectives': [{'kind': 'collect', 'item': 'bamboo_shoot', 'count': 6, 'text': 'Collect Bamboo Shoots from Bamboo Ronin (Bamboo Grove)'}, {'kind': 'talk', 'npc': 'jiro', 'text': 'Bring them to Jiro'}],
   'reward': {'gold': 450, 'exp': 900, 'items': {'cake': 10, 'elixir': 1}}},
  {'id': 'tengu_elder', 'giver': 'ayame', 'title': 'The Tengu of the Grove', 'after': 'tea_order',
   'summary': "The temple's great bell has been silent since the Tengu Elder flew off with its clapper. Ayame asked you to face him at the end of the Bamboo Grove and bring it back.",
   'offer': ['You have heard our bell? No. No one has, since the spring. The Tengu Elder flew down one night and took its clapper for his collection.',
             'He roosts at the far end of the Bamboo Grove, fanning anyone who comes close off the path. He is vain and he is old, but he is no small foe. Are you ready for him?',
             'Bring the clapper home, and the bell rings again for you.'],
   'accept': "I'll face him", 'decline': 'Not yet', 'progress': ['The Tengu Elder, at the far end of the Bamboo Grove. Mind his fan: it blows you back. Bring the Bell Clapper to Ayame.'],
   'done': ['The clapper! Listen... Ayame hangs it, steps back, and the great bell rings out over the whole mountain.', 'That ring is yours now, samurai or not. Sakura Temple will always have a place for you.'], 'complete': 'It was an honour',
   'objectives': [{'kind': 'collect', 'item': 'bell_clapper', 'count': 1, 'text': 'Take the Bell Clapper from the Tengu Elder (Bamboo Grove)'}, {'kind': 'talk', 'npc': 'ayame', 'text': 'Bring it to Ayame'}],
   'reward': {'gold': 1200, 'exp': 2500, 'items': {'elixir': 3, 'swift_potion': 2}}},
]
ids = [q['id'] for q in D['quests']]
for q in QUESTS:
  if q['id'] in ids: D['quests'][ids.index(q['id'])] = q
  else: D['quests'].append(q)
open(P, 'w').write(json.dumps(D, indent=1, ensure_ascii=False) + '\n')
print('sakura: npcs', [n['id'] for a in ('temple', 'dusk_village', 'sakura_village') if a in A for n in A[a].get('npcs', [])], 'kinds', [k for k in KINDS if k in D['mobKinds']])
