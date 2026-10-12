# towns.py : the class towns' data in world-areas.json — each town's people (mentor, shopkeeper, its Waystone), the
# region's monster kinds and the mentor's quest chain; the Waystones at the Temple Road and in Elderwood Village.
# Idempotent: run after expand.py (which rebuilds the areas from its ROUTE) and platforms.py.
#   python3 tools/world/towns.py
# A monster kind is added only once its frames exist (public/assets/enemy/<kind>, by tools/mobs/mobs.py): the game
# loads every kind's frames. A map whose kind has no frames yet stands empty until then.
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
def waystone(area, title, x, y):
  npc(area, {'id': f'waystone_{area}', 'name': 'Waystone', 'title': title, 'x': x, 'y': y, 'art': 'waystone', 'role': 'waystone', 'lines': WAYSTONE_LINES})

waystone('temple', 'Temple Road', 1580, 470)
waystone('dusk_village', 'Elderwood Village', 560, 440)

# ---------------------------------------------------------------- Sakura Temple (samurai)
waystone('sakura_village', 'Sakura Temple', 560, 455)
npc('sakura_village', {'id': 'ayame', 'name': 'Ayame', 'title': 'Shrine Maiden', 'x': 790, 'y': 400, 'art': 'ayame', 'role': 'quest', 'lines': [
  'Welcome to Sakura Temple, traveller. Every samurai of the mountain learned the first cut on these steps.',
  'Mind the Petal Sprites on the Blossom Steps. They only want to play, but they bury the path by noon.']})
npc('sakura_village', {'id': 'jiro', 'name': 'Jiro', 'title': 'Tea Master', 'x': 1020, 'y': 395, 'art': 'jiro', 'role': 'shop', 'lines': [
  'Tea, rice cakes, a potion or two! Sit a while, the mountain is not going anywhere.',
  'Everything on this tray was brewed with the spring water behind the shrine.']})

# ---------------------------------------------------------------- Ironhold (warrior)
waystone('ironhold_village', 'Ironhold', 520, 470)
npc('ironhold_village', {'id': 'thorne', 'name': 'Captain Thorne', 'title': 'Warrior Mentor', 'x': 720, 'y': 452, 'art': 'thorne', 'role': 'quest', 'lines': [
  'Welcome to Ironhold, recruit. Every warrior worth the name swung a wooden sword on these flagstones first.',
  'The crags are restless this season. Keep your shield arm up out there.']})
npc('ironhold_village', {'id': 'grit', 'name': 'Grit', 'title': 'Smith', 'x': 980, 'y': 446, 'art': 'grit', 'role': 'shop', 'lines': [
  'Potions, whetstones, a hot meal from the forge fire. Grit sells what keeps a warrior standing.',
  'Mind the sparks. The furnace has not gone cold in forty years.']})

KINDS = {
  # Sakura
  'petal_sprite': {'name': 'Petal Sprite', 'frames': 'petal_sprite', 'texQ': 2, 'scale': 1.0, 'hp': 230, 'damage': 14, 'speed': 52, 'aggro': 230, 'range': 72, 'cooldown': 1300, 'respawnMs': 10000, 'exp': 44, 'level': 11},
  'kitsune_kit': {'name': 'Kitsune Kit', 'frames': 'kitsune_kit', 'texQ': 2, 'scale': 1.0, 'hp': 330, 'damage': 17, 'speed': 80, 'aggro': 270, 'range': 96, 'cooldown': 1300, 'respawnMs': 11000, 'exp': 62, 'level': 13},
  'bamboo_ronin': {'name': 'Bamboo Ronin', 'frames': 'bamboo_ronin', 'texQ': 2, 'scale': 1.0, 'hp': 560, 'damage': 22, 'speed': 64, 'aggro': 250, 'range': 84, 'cooldown': 1400, 'respawnMs': 12000, 'exp': 100, 'level': 17},
  'tengu_elder': {'name': 'Tengu Elder', 'frames': 'tengu_elder', 'texQ': 1.4, 'scale': 1.0, 'hp': 5200, 'damage': 30, 'speed': 86, 'aggro': 440, 'range': 130, 'cooldown': 1600, 'respawnMs': 150000, 'exp': 1600, 'level': 19, 'boss': True},
  # Ironhold
  'pebblit': {'name': 'Pebblit', 'frames': 'pebblit', 'texQ': 2, 'scale': 1.0, 'hp': 240, 'damage': 15, 'speed': 50, 'aggro': 220, 'range': 70, 'cooldown': 1300, 'respawnMs': 10000, 'exp': 45, 'level': 11},
  'cinder_boar': {'name': 'Cinder Boar', 'frames': 'cinder_boar', 'texQ': 2, 'scale': 1.0, 'hp': 360, 'damage': 19, 'speed': 88, 'aggro': 280, 'range': 80, 'cooldown': 1300, 'respawnMs': 11000, 'exp': 66, 'level': 14},
  'forge_golem': {'name': 'Forge Golem', 'frames': 'forge_golem', 'texQ': 2, 'scale': 1.0, 'hp': 620, 'damage': 24, 'speed': 56, 'aggro': 250, 'range': 90, 'cooldown': 1500, 'respawnMs': 12000, 'exp': 108, 'level': 17},
  'boulder_bear': {'name': 'Boulder Bear', 'frames': 'boulder_bear', 'texQ': 1.4, 'scale': 1.0, 'hp': 5600, 'damage': 32, 'speed': 80, 'aggro': 440, 'range': 120, 'cooldown': 1700, 'respawnMs': 150000, 'exp': 1700, 'level': 19, 'boss': True},
}
for k, v in KINDS.items():
  if os.path.isdir(R + f'public/assets/enemy/{k}'): D['mobKinds'][k] = v
TRAINING = ('sakura_1', 'sakura_2', 'sakura_3', 'ironhold_1', 'ironhold_2', 'ironhold_3')
for area in TRAINING:
  if area not in A: continue
  m = A[area].get('mobs')
  if m and m['kind'] != 'none' and m['kind'] not in D['mobKinds']: A[area]['mobs'] = {'kind': 'none', 'spawns': []}
  m2 = A[area].get('mobs2')
  if m2 and m2['kind'] not in D['mobKinds']: A[area].pop('mobs2', None)

QUESTS = [
  # ---- Sakura Temple: Ayame
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
   'done': ['Cool as spring water... yes, this is it. Tonight the shrine foxes will have their lights again.', "Take these, with the mountain's thanks."], 'complete': 'Glad to help',
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
  # ---- Ironhold: Captain Thorne
  {'id': 'pebbles_underfoot', 'giver': 'thorne', 'title': 'Pebbles Underfoot', 'after': 'before_road',
   'summary': 'Captain Thorne of Ironhold asked you to clear ten Pebblits off the Crag Path, where the recruits run their morning drills.',
   'offer': ['New blood! Good. The recruits run the Crag Path every morning, and every morning the Pebblits roll under their boots.',
             'Clear ten of them off the path east of the gate and report back. They bounce and they bump. Nothing a recruit cannot handle.'],
   'accept': 'Yes, Captain', 'decline': 'Not now', 'progress': ['Ten Pebblits on the Crag Path, east of the gate.'],
   'done': ['Ten, and not a scratch on you. That is how it is done. Here, from the garrison stores.'], 'complete': 'Thank you, Captain',
   'objectives': [{'kind': 'kill', 'mob': 'pebblit', 'count': 10, 'text': 'Defeat Pebblits (Crag Path)'}, {'kind': 'talk', 'npc': 'thorne', 'text': 'Report to Captain Thorne'}],
   'reward': {'gold': 250, 'exp': 450, 'items': {'meat': 5, 'red_potion': 5}}},
  {'id': 'cinder_tusks', 'giver': 'thorne', 'title': 'Cinder Tusks', 'after': 'pebbles_underfoot',
   'summary': 'The Cinder Boars have come down onto the Forge Road and the carts cannot pass. Captain Thorne asked you for eight Cinder Tusks to prove the road is clear.',
   'offer': ['The Forge Road is blocked. Cinder Boars, a whole sounder of them, rooting through the ore carts and scattering embers everywhere.',
             'Drive them off and bring me eight of their tusks so I know the road is clear. They charge straight: step aside, then strike.'],
   'accept': 'On my way', 'decline': 'Not now', 'progress': ['Eight Cinder Tusks from the Cinder Boars on the Forge Road.'],
   'done': ['Eight tusks, still warm. The carts are already rolling. You have a warrior\'s timing, whatever your weapon.'], 'complete': 'Glad to help',
   'objectives': [{'kind': 'collect', 'item': 'cinder_tusk', 'count': 8, 'text': 'Collect Cinder Tusks from Cinder Boars (Forge Road)'}, {'kind': 'talk', 'npc': 'thorne', 'text': 'Bring them to Captain Thorne'}],
   'reward': {'gold': 400, 'exp': 750, 'items': {'blue_potion': 5, 'meat': 10}}},
  {'id': 'grits_order', 'giver': 'thorne', 'title': "Grit's Order", 'after': 'cinder_tusks',
   'summary': "Grit the smith's furnace is running low on forge cores. Captain Thorne asked you to bring him six from the Forge Golems in the Ember Quarry.",
   'offer': ['Grit has been hammering cold iron for two days. His furnace wants forge cores, and the only ones left are inside the old Forge Golems in the Ember Quarry.',
             'The golems were built to haul ore, not to fight, but they do not like being switched off. Bring Grit six cores. He will remember it when you need a blade.'],
   'accept': "I'll bring them", 'decline': 'Not now', 'progress': ['Six Forge Cores from the Forge Golems in the Ember Quarry, for Grit at the forge.'],
   'done': ['Forge cores! Ha! Hear that? The furnace is singing again.', 'Anything on my racks is yours at a fair price, and come warm your hands whenever you like.'], 'complete': 'Good to hear',
   'objectives': [{'kind': 'collect', 'item': 'forge_core', 'count': 6, 'text': 'Collect Forge Cores from Forge Golems (Ember Quarry)'}, {'kind': 'talk', 'npc': 'grit', 'text': 'Bring them to Grit'}],
   'reward': {'gold': 450, 'exp': 900, 'items': {'meat': 10, 'elixir': 1}}},
  {'id': 'crag_king', 'giver': 'thorne', 'title': 'The Crag King', 'after': 'grits_order',
   'summary': "The Boulder Bear that the recruits call the Crag King has taken the garrison's old war horn into his den at the end of the Ember Quarry. Captain Thorne asked you to bring it back.",
   'offer': ['One more, and this one is no drill. The Boulder Bear, the Crag King, the recruits call him, came down in the night and carried off the garrison\'s war horn, the one that has called Ironhold to arms for three hundred years.',
             'He dens at the far end of the Ember Quarry. He is slow, he is proud and he hits like a landslide. Are you ready?',
             'Bring the horn home and I will sound it for you myself.'],
   'accept': "I'm ready", 'decline': 'Not yet', 'progress': ['The Boulder Bear, at the far end of the Ember Quarry. Keep moving: his paws come down slow and heavy. Bring the War Horn to Captain Thorne.'],
   'done': ['The horn! Thorne lifts it, draws a breath, and one long note rolls down the canyon and back.', 'Ironhold has heard it. Whatever your path, you have a place in these walls.'], 'complete': 'It was an honour',
   'objectives': [{'kind': 'collect', 'item': 'war_horn', 'count': 1, 'text': 'Take the War Horn from the Boulder Bear (Ember Quarry)'}, {'kind': 'talk', 'npc': 'thorne', 'text': 'Bring it to Captain Thorne'}],
   'reward': {'gold': 1200, 'exp': 2500, 'items': {'elixir': 3, 'warrior_potion': 2}}},
]
ids = [q['id'] for q in D['quests']]
for q in QUESTS:
  if q['id'] in ids: D['quests'][ids.index(q['id'])] = q
  else: D['quests'].append(q)
open(P, 'w').write(json.dumps(D, indent=1, ensure_ascii=False) + '\n')
print('towns: kinds', [k for k in KINDS if k in D['mobKinds']], 'quests', len(QUESTS))
