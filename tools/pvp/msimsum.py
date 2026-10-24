# Class win rates from matchsim results (every round a sample). The player side is the full class (its whole kit and
# mechanics) driven by the knight's AI; the knight side is the game's sparring knight. Each class as the player meets the
# same five knights (its mirror too): that column compares the classes on one yardstick.
import json, sys, math
from collections import defaultdict
rows = [r for f in sys.argv[1:] for r in json.load(open(f)) if r.get('phase') == 'over']
CLS = ['warrior', 'samurai', 'book_mage', 'archer', 'gambler']
NAME = {'warrior': 'Warrior', 'samurai': 'Samurai', 'book_mage': 'Book Mage', 'archer': 'Archer', 'gambler': 'Gambler'}
asP = defaultdict(lambda: [0, 0]); asB = defaultdict(lambda: [0, 0]); bat = defaultdict(lambda: [0, 0]); m = defaultdict(lambda: [0, 0])
side = [0, 0]; land = defaultdict(lambda: [0, 0])
for r in rows:
    a, b, aw, bw = r['A'], r['B'], r['aWins'], r['bWins']
    side[0] += aw; side[1] += bw
    asP[a][0] += aw; asP[a][1] += aw + bw
    asB[b][0] += bw; asB[b][1] += aw + bw
    if a != b:
        for c, w, l in ((a, aw, bw), (b, bw, aw)):
            bat[c][1] += 1; bat[c][0] += 1 if w > l else 0
        m[(a, b)][0] += aw; m[(a, b)][1] += bw
    for sk, (n, k) in (r['st'].get('pSk') or {}).items(): land[(a, sk)][0] += n; land[(a, sk)][1] += k
pct = lambda w, t: f"{w / t * 100:5.1f}%" if t else '   - '
print(f"battles {len(rows)}, rounds {sum(side)} — the player side won {pct(side[0], sum(side)).strip()}")
print(f"{'class':10s} {'as player vs the 5 knights':>27s} {'as the knight':>16s} {'both sides (no mirror)':>24s}")
for c in CLS:
    w2 = sum(m[(c, b)][0] + m[(b, c)][1] for b in CLS if b != c); t2 = sum(sum(m[(c, b)]) + sum(m[(b, c)]) for b in CLS if b != c)
    se = math.sqrt(max(1e-9, (w2 / t2) * (1 - w2 / t2) / t2)) * 100 if t2 else 0
    print(f"{NAME[c]:10s} {asP[c][0]:4d}/{asP[c][1]:<4d} {pct(*asP[c])}            {asB[c][0]:4d}/{asB[c][1]:<4d} {pct(*asB[c])}   {w2:4d}/{t2:<4d} {pct(w2, t2)} ±{se:.0f}   battles {bat[c][0]}/{bat[c][1]}")
print('matchups, rounds won by the row class (both sides, its mirror excluded):')
print('           ' + ' '.join(f'{NAME[c][:9]:>10s}' for c in CLS))
for a in CLS:
    cells = []
    for b in CLS:
        if a == b: cells.append(f"{'-':>10s}"); continue
        w = m[(a, b)][0] + m[(b, a)][1]; t = sum(m[(a, b)]) + sum(m[(b, a)])
        cells.append(f"{w:>5d}/{t:<4d}" if t else f"{'.':>10s}")
    print(f'{NAME[a][:10]:10s} ' + ' '.join(cells))

print('casts that land, as the player (top skills by use):')
for c in CLS:
    xs = sorted(((sk, n, k) for (cc, sk), (n, k) in land.items() if cc == c), key=lambda x: -x[1])[:8]
    if xs: print(f"  {NAME[c]:10s} " + ', '.join(f"{sk} {k}/{n}" for sk, n, k in xs))
