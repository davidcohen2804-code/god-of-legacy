#!/usr/bin/env python3
"""The blows themselves: every damaging hit in the arena lands with one of these under its skill's own sound — per class
and per weight (light: a basic blow or a burst's small one, medium: a skill's blow, heavy: the main hit). The aim is the
crunch and weight of the arcade brawlers David plays (inspiration only, nothing taken from them): a hit is layered —

  the crack     the contact: a bright transient a millisecond or two long (a heavy blow cracks twice)
  the body      the punch: a short falling thump and the slap of the blow in the middle of the spectrum
  the crunch    a noise burst driven into hard saturation and decimated — the gritty bite that makes it sound hard
  the material  the class's own: the greatsword's steel cleaving (warrior), the katana's slice and ring (samurai), an
                arrow's thunk in wood and flesh (archer), an arcane crack, zap and sparkle (book mage), the staff's wooden
                TOK and a card's slap (gambler)
  the tail      the decay: dust and grit, longer and lower the heavier the blow

Three takes of each (a blow never repeats exactly). Written as imp_<class>_<l|m|h>_<1..3> (.ogg + .mp3) into
public/assets/audio/sfx/; ArenaSound plays them under each skill's own hit (Sound.ts: SFX imp_*).

    python3 tools/audio/hits.py [wr sm ar bm gb]     (needs numpy, scipy, ffmpeg)
    python3 tools/audio/hits.py bar                  (the risers into the big beats and the flurries' ticks)
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from impacts import SR, bp, brown, env, finish, glide, hp, lp, write  # noqa: E402
from signatures import T, arc, bell, buf, click, crackle_kernels, grains, knock, place, ring, rustle, slow, svf, swoosh, thud  # noqa: E402

R = np.random.default_rng

# per weight: length, the body's thump (from, to, decay), the slap's band and decay, the crunch (decay, drive, hold), the tail
W = {
    'l': dict(dur=0.26, body=(215, 115, 0.032), bamp=0.55, slap=(800, 3400, 0.011), samp=0.85, crunch=(0.008, 5.0, 2), camp=0.5, tail=0.045, tamp=0.18, k=0.62),
    'm': dict(dur=0.42, body=(175, 68, 0.06), bamp=0.9, slap=(550, 3000, 0.019), samp=1.0, crunch=(0.016, 6.5, 3), camp=0.72, tail=0.085, tamp=0.32, k=0.85),
    'h': dict(dur=0.8, body=(145, 44, 0.13), bamp=1.25, slap=(380, 2600, 0.03), samp=1.1, crunch=(0.034, 8.0, 3), camp=1.0, tail=0.19, tamp=0.6, k=1.0),
}


def crunch(rng, dur, lo, hi, tau, drive, hold):
    """The bite: band noise slammed into saturation, then held every few samples (its aliasing is the grit)."""
    t = T(dur)
    n = bp(rng.standard_normal(t.size), lo, hi) * env(t, 0.0004, tau)
    n = np.tanh(drive * n / (np.abs(n).max() + 1e-9))
    if hold > 1:
        n = n[(np.arange(t.size) // hold) * hold]
    return n * env(t, 0.0004, tau * 1.4)


def blow(rng, w):
    """The common layers: crack, body, slap, crunch, tail."""
    p = W[w]; dur = p['dur']; t = T(dur); x = buf(dur)
    place(x, click(0.03, rng, rng.uniform(2000, 2800), 0.0011 if w != 'h' else 0.0016, 1.0), 0)
    if w == 'h':
        place(x, click(0.03, rng, 1800, 0.0014, 0.75), 0.007)  # (a heavy blow cracks twice)
    f0, f1, tau = p['body']
    x += thud(dur, f0 * rng.uniform(0.95, 1.05), f1, tau, 0.025) * p['bamp']
    lo, hi, st = p['slap']
    x += bp(rng.standard_normal(t.size), lo, hi) * env(t, 0.0007, st) * p['samp']
    ct, drive, hold = p['crunch']
    place(x, crunch(rng, ct * 6, 300, 4200, ct, drive, hold), 0.0015, p['camp'])
    tl = lp(rng.standard_normal(t.size), 1600 if w != 'h' else 1100) * env(t, 0.004, p['tail']) * p['tamp']
    if w == 'h':
        tl += lp(brown(t.size, rng), 160) * env(t, 0.01, 0.22) * 0.8  # (the floor taking it)
    x += tl
    n = {'l': 4, 'm': 8, 'h': 16}[w]
    times = np.minimum(0.01 + rng.exponential(p['tail'] * 0.6, n), p['tail'] * 1.6)  # (all close behind the blow: a stray one late reads as a glitch)
    x += grains(t.size, times, rng.uniform(0.1, 0.3, n) * p['k'], crackle_kernels(rng, 2600, (0.0005, 0.001)), rng)  # (grit)
    return x


# ---------------------------------------------------------------- the materials

def steel(rng, w):  # the warrior's greatsword cleaving in: a short clang of heavy steel, the chunk of the cut, armour rattling
    p = W[w]; dur = p['dur']; x = buf(dur); k = p['k']
    f = {'l': 1150, 'm': 900, 'h': 680}[w] * rng.uniform(0.96, 1.04); tau = {'l': 0.045, 'm': 0.085, 'h': 0.16}[w]
    place(x, ring(dur, f, [(1, 0.5, tau), (1.53, 0.42, tau * 0.7), (2.41, 0.3, tau * 0.5), (3.72, 0.2, tau * 0.3)], rng, beat=0.004), 0, 0.42 * k)
    t = T(0.12); place(x, bp(rng.standard_normal(t.size), 180, 900) * env(t, 0.001, 0.03), 0.002, 0.7 * k)  # (the chunk)
    if w == 'h':
        place(x, ring(dur, 420, [(1, 0.5, 0.25), (1.62, 0.35, 0.16), (2.31, 0.25, 0.1)], rng, beat=0.003), 0.004, 0.35)  # (the clang under it)
    n = {'l': 3, 'm': 5, 'h': 9}[w]
    for _ in range(n):  # (armour rattling)
        place(x, ring(0.05, rng.uniform(2600, 4200), [(1, 0.4, 0.012), (1.47, 0.25, 0.008)], rng), min(0.09, 0.012 + rng.exponential(0.025)), 0.12 * k)
    return x


def katana(rng, w):  # the samurai's katana: the slice going through (shk), its thin ring; a heavy cut adds the deep zan
    p = W[w]; dur = p['dur']; x = buf(dur); k = p['k']
    place(x, swoosh(0.045, 3200, 9500, 7000, rng, peak=0.25, q=3.0, tail=5), 0, 0.75 * k)
    f = {'l': 5200, 'm': 4600, 'h': 3900}[w] * rng.uniform(0.97, 1.03); tau = {'l': 0.05, 'm': 0.09, 'h': 0.16}[w]
    place(x, ring(dur, f, [(1, 0.45, tau), (1.38, 0.3, tau * 0.6), (2.06, 0.18, tau * 0.35)], rng, beat=0.005), 0.003, 0.28 * k)
    if w != 'l':
        t = T(0.14); z = lp(rng.standard_normal(t.size), 2400) * env(t, 0.002, 0.04)
        place(x, z, 0.004, 0.55 if w == 'h' else 0.3)  # (zan)
    if w == 'h':
        t = T(0.2); place(x, hp(rng.standard_normal(t.size), 600) * env(t, 0.002, 0.05) * np.exp(-t / 0.08), 0.01, 0.35)  # (the spray)
    return x


def arrowhead(rng, w):  # the archer's arrow (or boot) going in: a wooden thunk, the shaft's shudder, splinters
    p = W[w]; dur = p['dur']; x = buf(dur); k = p['k']
    t = T(dur)
    place(x, knock(dur, {'l': 760, 'm': 640, 'h': 520}[w] * rng.uniform(0.95, 1.05), {'l': 0.012, 'm': 0.018, 'h': 0.026}[w], rng, 0.9), 0, 0.8 * k)
    sh = np.sin(2 * np.pi * np.cumsum(185 * (1 + 0.06 * np.sin(2 * np.pi * 28 * t))) / SR) * env(t, 0.003, {'l': 0.04, 'm': 0.07, 'h': 0.12}[w])
    x += sh * 0.35 * k  # (the shaft shuddering)
    n = {'l': 4, 'm': 7, 'h': 14}[w]
    x += grains(t.size, np.minimum(0.004 + rng.exponential(0.025, n), 0.09), rng.uniform(0.2, 0.5, n) * k, [knock(0.03, f, 0.005, rng, 0.6) for f in (900, 1300, 1700)], rng)  # (splinters)
    if w == 'h':
        place(x, rustle(0.3, rng, 450, 2500, 9000, 0.35) * env(T(0.3), 0.005, 0.08), 0.004)  # (leaves)
    return x


def arcane(rng, w):  # the book mage's spell biting: a crystalline crack, the zap of it, sparkles; a heavy one bursts in a chord
    p = W[w]; dur = p['dur']; x = buf(dur); k = p['k']
    f = {'l': 2600, 'm': 2200, 'h': 1800}[w] * rng.uniform(0.96, 1.04)
    place(x, bell(dur, f, ratio=2.76, index=3.5, tau={'l': 0.04, 'm': 0.07, 'h': 0.12}[w], itau=0.02), 0, 0.35 * k)
    zd = {'l': 0.03, 'm': 0.05, 'h': 0.08}[w]
    place(x, arc(zd, rng, f=rng.uniform(110, 160), jit=0.5) * env(T(zd), 0.001, zd * 0.4), 0.002, 0.45 * k)
    for i in range({'l': 2, 'm': 4, 'h': 7}[w]):
        place(x, bell(0.18, rng.uniform(3500, 7500), ratio=2.0, index=0.8, tau=0.04), 0.01 + rng.uniform(0, 0.07), 0.1 * k)
    if w == 'h':
        t = T(dur); x += sum(np.sin(2 * np.pi * fr * t + i) for i, fr in enumerate((880.0, 1108.7, 1318.5))) * env(t, 0.004, 0.16) * 0.09
    return x


def staff(rng, w):  # the gambler's staff (or a card): the wooden TOK, the card's slap, chips; a heavy one a bat's crack
    p = W[w]; dur = p['dur']; x = buf(dur); k = p['k']
    place(x, knock(dur, {'l': 720, 'm': 610, 'h': 470}[w] * rng.uniform(0.95, 1.05), {'l': 0.02, 'm': 0.03, 'h': 0.045}[w], rng, 1.0), 0, 0.85 * k)
    place(x, hp(rng.standard_normal(T(0.02).size), 3200) * env(T(0.02), 0.0002, 0.003), 0.001, 0.5 * k)  # (a card's slap)
    n = {'l': 2, 'm': 4, 'h': 8}[w]
    for _ in range(n):  # (chips)
        place(x, ring(0.06, rng.uniform(3000, 5500), [(1, 0.4, 0.02), (1.52, 0.25, 0.012)], rng), min(0.11, 0.01 + rng.exponential(0.035)), 0.09 * k)
    if w == 'h':
        t = T(0.1); place(x, hp(rng.standard_normal(t.size), 1400) * env(t, 0.0005, 0.012), 0.003, 0.7)  # (the bat's crack)
        place(x, knock(0.2, 380, 0.05, rng, 0.8), 0.004, 0.5)
    return x


MAT = {'wr': steel, 'sm': katana, 'ar': arrowhead, 'bm': arcane, 'gb': staff}
SEED = {'wr': 2100, 'sm': 2200, 'ar': 2300, 'bm': 2400, 'gb': 2500}


def make(cls, w, take):
    rng = R(SEED[cls] + {'l': 0, 'm': 30, 'h': 60}[w] + take)
    x = blow(rng, w) + MAT[cls](rng, w)
    return finish(x, 0.88, 3, 2.4)


# ---------------------------------------------------------------- THE BAR (David 18:23, his reference: Prometheus)
# "A riser (a 0.3-0.5 s rising sweep) leads into every big beat"; "a flurry is a stream of short 'shing' ticks with a
# heavier accent every 4-6 (not a wall of one sound)".

def riser(seed, dur, ult=False):
    """The rise into a big beat: noise through a narrowing band sweeping up (250 Hz -> 7 kHz), a tone climbing under it,
    a shimmer on top quivering faster and faster; it swells to the beat and stops there (the blow takes over).
    `ult`: longer, with a deep swell under it."""
    rng = R(seed); t = T(dur); u = t / dur
    fc = 250 * (7000 / 250) ** (u ** 1.3); q = 1.4 + 4.5 * u
    x = svf(rng.standard_normal(t.size), fc, q) * u ** 2.4 * 1.0
    f = 180 * (1400 / 180) ** (u ** 1.6); ph = 2 * np.pi * np.cumsum(f) / SR
    x += (np.sin(ph) + 0.35 * np.sin(2 * ph + 0.4)) * u ** 2.2 * 0.22
    trem = 0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(30 + 50 * u) / SR)
    x += hp(rng.standard_normal(t.size), 6000) * u ** 3 * trem * 0.35
    if ult:
        x += np.sin(2 * np.pi * np.cumsum(55 + 70 * u ** 2) / SR) * u ** 3 * 0.5
    k = int(SR * 0.012); x[-k:] *= np.linspace(1, 0, k)  # (cut on the beat)
    return finish(x, 0.85, 3, 1.4)


def tick(cls, take):
    """A flurry's small blow, the class's own 'shing' (short: ~60 ms), never twice the same."""
    rng = R(3000 + 10 * list(MAT).index(cls) + take); dur = 0.16; t = T(dur); x = buf(dur)
    if cls == 'wr':  # steel scraping steel: a hiss and a short bright ring
        place(x, bp(rng.standard_normal(T(0.03).size), 1500, 6500) * env(T(0.03), 0.001, 0.008), 0, 0.9)
        place(x, ring(0.12, 2900 * rng.uniform(0.95, 1.05), [(1, 0.5, 0.03), (1.47, 0.35, 0.02), (2.2, 0.2, 0.012)], rng), 0.002, 0.5)
    elif cls == 'sm':  # the katana's shing: a thin slice of air and its ringing edge
        place(x, swoosh(0.05, 4000, 9500, 8000, rng, peak=0.3, q=3.2, tail=5), 0, 0.9)
        place(x, ring(0.12, 5200 * rng.uniform(0.96, 1.04), [(1, 0.45, 0.035), (1.38, 0.25, 0.02)], rng), 0.004, 0.45)
    elif cls == 'ar':  # an arrow going in: a small wooden thwk and its click
        place(x, knock(0.06, 820 * rng.uniform(0.94, 1.06), 0.012, rng, 0.9), 0, 0.9)
        x += click(dur, rng, 3200, 0.0008, 0.5)
    elif cls == 'bm':  # a spark of the spell: tsing, and a glint of sparkle
        place(x, bell(0.14, 3600 * rng.uniform(0.95, 1.05), ratio=2.76, index=2.5, tau=0.035, itau=0.01), 0, 0.6)
        place(x, bell(0.1, rng.uniform(6000, 8000), ratio=2.0, index=0.8, tau=0.02), 0.012, 0.25)
        x += click(dur, rng, 4500, 0.0006, 0.35)
    else:  # gb: a card's flick and a chip's ting
        place(x, hp(rng.standard_normal(T(0.02).size), 3000) * env(T(0.02), 0.0002, 0.003), 0, 0.7)
        place(x, bp(rng.standard_normal(T(0.04).size), 1500, 6500) * env(T(0.04), 0.002, 0.012), 0.002, 0.4)
        place(x, ring(0.08, 4300 * rng.uniform(0.94, 1.06), [(1, 0.4, 0.02), (1.52, 0.25, 0.012)], rng), 0.006, 0.4)
    return finish(x, 0.85, 3, 1.5)


def cutin_in(seed):
    """The ultimate's moment: the hero's portrait slams in from the side (a deep thoom under a short swept whoosh) and the
    star glint opens on his weapon (a bright shing and its sparkle)."""
    rng = R(seed); dur = 0.95; t = T(dur); x = buf(dur)
    x += np.sin(glide(t, 92, 42, 0.06)) * env(t, 0.004, 0.22) * 0.9  # (the thoom)
    x += lp(rng.standard_normal(t.size), 400) * env(t, 0.003, 0.05) * 0.5
    sw = T(0.16); place(x, svf(rng.standard_normal(sw.size), 600 * (4200 / 600) ** (sw / 0.16), 2.2) * np.sin(np.pi * sw / 0.16) ** 1.5, 0, 0.55)  # (the slide)
    place(x, bell(0.6, 2490, ratio=2.0, index=1.6, tau=0.18, itau=0.05), 0.12, 0.35)  # (the glint: shing)
    place(x, bell(0.5, 4980, ratio=1.5, index=1.0, tau=0.12), 0.125, 0.18)
    for k in range(7):  # (its sparkle)
        place(x, bell(0.2, rng.uniform(5500, 9000), ratio=2.0, index=0.6, tau=0.03), 0.15 + k * 0.035 + rng.uniform(0, 0.02), 0.06)
    return finish(x, 0.85, 20, 1.4)


def cutin_out(seed):
    """The portrait cut away in a frame: a sharp snap of air rising off, a click and a small thump."""
    rng = R(seed); dur = 0.3; t = T(dur); x = buf(dur)
    sw = T(0.09); place(x, svf(rng.standard_normal(sw.size), 1800 * (8500 / 1800) ** (sw / 0.09), 3.0) * (sw / 0.09) ** 2, 0, 0.8)
    place(x, click(0.05, rng, 2500, 0.0012, 1.0), 0.088)
    place(x, thud(0.2, 160, 70, 0.03) * 0.5, 0.088)
    return finish(x, 0.82, 10, 1.3)


def storm_turn(seed):
    """The archer's arrow crossing a charged point and turning to lightning: the snap of the charge taking it (a sharp
    crack), the arc buzzing along the shaft, a sizzle trailing off."""
    rng = R(seed); dur = 0.55; t = T(dur); x = buf(dur)
    x += hp(rng.standard_normal(t.size), 1800) * env(t, 0.0004, 0.006) * 1.0  # (the crack)
    x += bp(rng.standard_normal(t.size), 600, 5000) * env(t, 0.001, 0.025) * 0.6
    zd = 0.32; place(x, arc(zd, rng, f=rng.uniform(140, 190), jit=0.5) * env(T(zd), 0.002, 0.12), 0.004, 0.55)
    sz = T(0.45); place(x, hp(rng.standard_normal(sz.size), 4500) * (slow(rng, sz.size, 140) > 0.2) * env(sz, 0.01, 0.12), 0.02, 0.35)  # (the sizzle)
    x += thud(dur, 200, 90, 0.03) * 0.3
    return finish(x, 0.85, 10, 1.5)


# ---------------------------------------------------------------- continuity (David 14:35): what the fight leaves behind, gathered

def petal_gather(seed):
    """The samurai's Sheathe: his fallen petals whirl up off the planks into the scabbard — a swirling rise, a crowd of
    petals converging, swallowed with a soft fwp."""
    rng = R(seed); dur = 0.8; t = T(dur); x = buf(dur); u = np.clip(t / 0.55, 0, 1)
    fc = 700 * (5200 / 700) ** u * (1 + 0.25 * np.sin(2 * np.pi * 9 * t))  # (whirling)
    x += svf(rng.standard_normal(t.size), fc, 2.0) * np.sin(np.pi * np.clip(t / 0.6, 0, 1)) ** 1.5 * 0.5
    x += rustle(dur, rng, rate=520, lo=3200, hi=9500, amp=1.0) * np.sin(np.pi * np.clip(t / 0.58, 0, 1)) * 0.5
    sw = T(0.12); place(x, lp(rng.standard_normal(sw.size), 900) * env(sw, 0.004, 0.03), 0.52, 0.7)  # (into the scabbard)
    return finish(x, 0.84, 20, 1.3)


def petal_draw(seed):
    """The blossom draw: the Iai drawn with the petals — they burst out along the cut in a bright swish, a sakura chime."""
    rng = R(seed); dur = 0.9; t = T(dur); x = buf(dur)
    place(x, swoosh(0.22, 2500, 9000, 6000, rng, peak=0.2, q=2.4, tail=5), 0, 0.8)
    x += rustle(dur, rng, rate=700, lo=3500, hi=10000, amp=1.0) * env(t, 0.01, 0.18) * 0.5
    for k, f in enumerate((1318.5, 1567.98, 1975.53, 2349.32, 2637.02)):  # (a pentatonic shimmer: the blossoms)
        place(x, bell(0.6, f, ratio=2.0, index=0.9, tau=0.22), 0.02 + 0.03 * k, 0.11)
    return finish(x, 0.84, 20, 1.3)


def stone_burst(seed):
    """Leap Crash bursts the warrior's standing rock spikes: a hard crack, the stone shattering, the debris thrown up and
    raining back down as gravel."""
    rng = R(seed); dur = 1.4; t = T(dur); x = buf(dur)
    x += click(dur, rng, 1500, 0.0018, 1.0)
    x += thud(dur, 120, 48, 0.12) * 0.8
    times = np.sort(0.002 + rng.exponential(0.018, 22))
    x += grains(t.size, times, rng.uniform(0.4, 1.0, times.size), [knock(0.08, f, 0.02, rng, 0.8) for f in (330, 520, 760, 1100)], rng) * 0.6  # (the shatter)
    rain = np.sort(rng.uniform(0.28, 1.15, 70))
    x += grains(t.size, rain, rng.uniform(0.1, 0.5, rain.size) * np.exp(-(rain - 0.28) / 0.5), [knock(0.04, f, 0.008, rng, 1.0) for f in (900, 1400, 2100, 2900)], rng) * 0.55  # (the gravel raining down)
    x += lp(brown(t.size, rng), 300) * env(t, 0.005, 0.25) * 0.5
    return finish(x, 0.86, 30, 1.4)


def page_fold(seed):
    """The book mage's torn pages lift off the floor and fold into cranes: a rustle of paper rising, crisp creases."""
    rng = R(seed); dur = 0.7; t = T(dur); x = buf(dur)
    x += rustle(dur, rng, rate=380, lo=2200, hi=8000, amp=1.0) * np.sin(np.pi * np.clip(t / 0.45, 0, 1)) * 0.6
    for k in range(6):  # (the folds: crisp creases)
        tt = T(0.03); place(x, bp(rng.standard_normal(tt.size), 1800, 7000) * env(tt, 0.0005, 0.005), 0.18 + k * 0.045 + rng.uniform(0, 0.015), 0.8)
    place(x, bell(0.4, 1760, ratio=2.76, index=1.4, tau=0.12), 0.42, 0.16)  # (a little arcane spark: they come alive)
    return finish(x, 0.84, 20, 1.3)


# ---------------------------------------------------------------- THE BAR's reference pieces (DFO's Fx3D, after David's
# reference: each announced on onPieceRef — "each element its own layer: chimes and shimmer for magic sparkles, crackle
# for fire and lightning, a deep void 'thoom' for ink / dark").

def pc_line(seed):
    """A flurry's line (a thin, very long cut of light through the foe, ~115 ms; a new one every ~40 ms): a fast thin
    'tsing' — the air sliced (a band whipping up high), a hair-thin ring on its edge. Light: they come in streams."""
    rng = R(seed); dur = 0.13; x = buf(dur)
    place(x, swoosh(0.05, 3500, 11000, 8000, rng, peak=0.3, q=3.5, tail=6), 0, 0.9)
    place(x, ring(0.12, rng.uniform(5600, 6800), [(1, 0.5, 0.03), (1.41, 0.3, 0.02), (2.13, 0.15, 0.012)], rng, beat=0.004), 0.005, 0.3)
    x += click(dur, rng, 5000, 0.0004, 0.3)
    return finish(x, 0.85, 3, 1.4)


def pc_line_hv(seed):
    """A flurry's heavier line (every fifth: wider, longer, a flare and embers): a full SHING — a broader slice, a ringing
    edge, a knock of weight under it, the flare's 'fsh', a few sparks crackling off."""
    rng = R(seed); dur = 0.42; t = T(dur); x = buf(dur)
    place(x, swoosh(0.09, 1500, 8500, 4500, rng, peak=0.28, q=2.6, tail=5), 0, 0.95)
    place(x, ring(0.36, rng.uniform(3050, 3550), [(1, 0.5, 0.12), (1.53, 0.36, 0.075), (2.41, 0.22, 0.045), (3.7, 0.12, 0.025)], rng, beat=0.005), 0.012, 0.45)
    place(x, thud(0.18, 180, 85, 0.035), 0.01, 0.5)
    place(x, hp(rng.standard_normal(T(0.06).size), 4500) * env(T(0.06), 0.002, 0.018), 0.014, 0.35)  # (the flare)
    times = np.minimum(0.03 + np.sort(rng.exponential(0.07, 7)), 0.3)
    x += grains(t.size, times, rng.uniform(0.15, 0.45, times.size), crackle_kernels(rng, 3000, (0.0005, 0.001)), rng)  # (embers)
    return finish(x, 0.86, 10, 1.5)


def pc_impact(seed):
    """The main hit in one piece (the reference's hammer slam, 02): the white flash (a hard broadband crack), its colour
    bursting out as a shell (a FWOOMP of energy, darkening as it spreads), the floor cracking under it (two splits, the
    stone's body), the embers rising and fading (a fire's crackle thinning out). The blow's own boom stays under it
    (ArenaSound): only a short push here."""
    rng = R(seed); dur = 1.1; t = T(dur); x = buf(dur)
    x += hp(rng.standard_normal(t.size), 1500) * env(t, 0.0003, 0.005)  # (the flash)
    x += bp(rng.standard_normal(t.size), 2500, 9000) * env(t, 0.001, 0.02) * 0.45
    ts = T(0.7); u = np.clip(ts / 0.28, 0, 1)
    place(x, svf(rng.standard_normal(ts.size), 2600 * (380 / 2600) ** u, 0.9, 'lp') * env(ts, 0.018, 0.11), 0.03, 1.1)  # (the shell bursting out)
    place(x, np.sin(glide(ts, 120, 55, 0.06)) * env(ts, 0.006, 0.12), 0.03, 0.45)  # (its push)
    for st, f, tau, a in ((0.035, 900, 0.012, 0.75), (0.07 + rng.uniform(0, 0.02), 1200, 0.009, 0.5)):  # (the floor cracking)
        tc = T(0.08); place(x, hp(rng.standard_normal(tc.size), f) * env(tc, 0.0005, tau), st, a)
    tb = T(0.4); place(x, lp(brown(tb.size, rng), 320) * env(tb, 0.004, 0.09), 0.035, 0.5)  # (the stone's body)
    times = 0.08 + np.sort(rng.exponential(0.22, 40)); times = times[times < 0.95]
    x += grains(t.size, times, rng.uniform(0.1, 0.5, times.size) * np.exp(-(times - 0.08) / 0.35), crackle_kernels(rng, 2800, (0.0004, 0.0008, 0.0014)), rng) * 0.8  # (the embers)
    x += hp(rng.standard_normal(t.size), 5000) * np.clip((t - 0.06) / 0.08, 0, 1) * np.exp(-np.maximum(0, t - 0.14) / 0.25) * 0.05  # (their hiss)
    return finish(x, 0.86, 30, 1.5)


def pc_beam(seed, small=False):
    """A beam struck from the sky onto the foe (the reference's archer, 06): it falls in a breath (a bright tone and its
    air dropping fast from on high), lands with a crack and a ring at its foot, then burns — a bright 'shhh' flickering
    over a humming column — and fades. `small`: a thin quick one (a rain's volley: one of many) — the fall and its foot,
    the burn a flicker (never a wall of them)."""
    rng = R(seed); dur = 0.4 if small else 0.7; t = T(dur); x = buf(dur); bl = 0.16 if small else 0.42
    dd = 0.065; td = T(dd); u = td / dd
    place(x, np.sin(2 * np.pi * np.cumsum(4200 * (900 / 4200) ** u) / SR) * np.sin(np.pi * u) ** 0.7, 0, 0.22)  # (the fall)
    place(x, svf(rng.standard_normal(td.size), 9000 * (1500 / 9000) ** u, 2.0) * u ** 1.2, 0, 0.7)
    place(x, hp(rng.standard_normal(T(0.05).size), 1600) * env(T(0.05), 0.0003, 0.006), dd, 0.85)  # (its foot: the crack)
    place(x, thud(0.25, 150, 70, 0.05), dd, 0.3 if small else 0.45)
    place(x, ring(0.5, 1180 * (1.25 if small else 1), [(1, 0.4, 0.16), (2.0, 0.25, 0.1), (2.98, 0.15, 0.06), (4.1, 0.08, 0.04)], rng, beat=0.003), dd + 0.002, 0.14 if small else 0.2)  # (the ring at its foot)
    tb = T(0.5); burn = np.clip(tb / 0.01, 0, 1) * np.clip((bl - tb) / (bl * 0.48), 0, 1) ** 1.5
    flick = 0.82 + 0.18 * np.repeat(rng.random(int(0.5 * 70) + 2), SR // 70 + 1)[:tb.size]  # (the beam flickering)
    place(x, bp(rng.standard_normal(tb.size), 2500, 8000) * burn * flick, dd, 0.3)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 7 * tb)
    place(x, sum(np.sin(2 * np.pi * np.cumsum(880 * r * vib) / SR + i) for i, r in enumerate((1, 1.5, 2))) * burn * flick, dd, 0.07)
    place(x, (np.sin(2 * np.pi * 110 * tb) + 0.5 * np.sin(2 * np.pi * 220 * tb + 0.3)) * burn, dd, 0.12)  # (the column humming)
    return finish(x, 0.85, 20, 1.4)


def pc_glyph(seed, chord=(659.26, 830.61, 987.77, 1318.51)):
    """A big glyph opening on the floor (the reference's archer, mage and gothic ults: 06, 08, 09): it lands (a soft whump)
    and blooms (a shimmer of chimes rising, its chord swelling), then hums under the fight, pulsing as it turns, and fades."""
    rng = R(seed); dur = 2.0; t = T(dur); x = buf(dur)
    x += np.sin(glide(t, 90, 50, 0.05)) * env(t, 0.008, 0.09) * 0.5  # (it lands)
    tw = T(0.24); place(x, svf(rng.standard_normal(tw.size), 500 * (4000 / 500) ** (tw / 0.24), 2.2) * np.sin(np.pi * tw / 0.24), 0, 0.35)  # (it opens)
    notes = [chord[i % len(chord)] * (2 if i >= len(chord) else 1) for i in range(6)]
    for k, f in enumerate(notes):  # (a shimmer of chimes rising)
        place(x, bell(0.6, f, ratio=2.0, index=1.0, tau=0.35, itau=0.06), 0.025 * k, 0.12)
    fade = np.clip((1.9 - t) / 0.6, 0, 1)
    pad = sum(np.sin(2 * np.pi * f * (1 + 0.0015 * (i - 1.5)) * t + i) for i, f in enumerate(chord)) * np.clip(t / 0.08, 0, 1) * np.exp(-t / 0.9) * fade
    x += pad * 0.05
    pulse = 0.7 + 0.3 * np.sin(2 * np.pi * 2.4 * t - np.pi / 2)  # (it pulses as it turns)
    hum = (np.sin(2 * np.pi * 110 * t) + 0.6 * np.sin(2 * np.pi * 165 * t + 0.4) + 0.45 * np.sin(2 * np.pi * 220 * t + 1.1)) * pulse
    x += hum * np.clip(t / 0.15, 0, 1) * fade * 0.12
    x += (np.sin(2 * np.pi * 2637 * t) + np.sin(2 * np.pi * 2643 * t)) * np.clip((t - 0.1) / 0.3, 0, 1) * fade * 0.012  # (a glint as it turns)
    return finish(x, 0.85, 60, 1.3)


def pc_swirl(seed):
    """Small pictures orbiting and rising round a fighter (the Samurai's petals, pages, leaves; or soft sparkles): a
    whirling rush rising as they climb, fluttering as they pass, a rustle of them, a few glints."""
    rng = R(seed); dur = 1.7; t = T(dur); x = buf(dur)
    shape = np.clip(t / 0.25, 0, 1) * np.clip((1.7 - t) / 0.45, 0, 1)
    orbit = np.sin(2 * np.pi * 4.5 * t)
    fc = 800 * (3000 / 800) ** np.clip(t / 1.3, 0, 1) * (1 + 0.3 * orbit)
    x += svf(rng.standard_normal(t.size), fc, 2.2) * (0.65 + 0.35 * np.sin(2 * np.pi * 4.5 * t + np.pi / 2)) * shape * 0.6
    x += rustle(dur, rng, rate=450, lo=3000, hi=9500, amp=1.0) * shape * 0.45
    x += lp(brown(t.size, rng), 250) * shape * 0.25
    for k in range(10):
        place(x, bell(0.25, rng.uniform(4000, 8000), ratio=2.0, index=0.6, tau=0.12), rng.uniform(0.2, 1.4), 0.05)
    return finish(x, 0.84, 40, 1.3)


def pc_ink(seed):
    """An inked slash (its dark stroke inside the hot edge, the dark after-image as it fades): the void's deep 'thoom' —
    a low drop, its octave, the dark air pulled down after it as the after-image dissolves."""
    rng = R(seed); dur = 0.75; t = T(dur); x = buf(dur)
    ph = glide(t, 78, 38, 0.09)
    x += np.sin(ph) * env(t, 0.012, 0.22) * 0.8
    for h, a, tau in ((2, 0.45, 0.15), (3, 0.25, 0.1), (4, 0.12, 0.07)):  # (its harmonics: the drop heard on small speakers too)
        x += np.sin(h * ph + 0.5 * h) * env(t, 0.008, tau) * a
    x += svf(rng.standard_normal(t.size), 1400 * (150 / 1400) ** np.clip(t / 0.5, 0, 1), 0.8, 'lp') * env(t, 0.02, 0.18) * 0.8  # (the dark air)
    x += svf(rng.standard_normal(t.size), 320, 9.0) * env(t, 0.04, 0.2) * 0.6  # (hollow: the void)
    return finish(x, 0.85, 40, 1.4)


def spike_break(seed):
    """A foe thrown into one of the warrior's rock spikes: the body slamming into stone, the spike cracking, crumbling in
    chunks, gravel trickling down, a breath of dust."""
    rng = R(seed); dur = 1.0; t = T(dur); x = buf(dur)
    x += thud(dur, 115, 52, 0.08) * 0.85 + lp(rng.standard_normal(t.size), 600) * env(t, 0.001, 0.03) * 0.8  # (the slam)
    for st, f, tau, a in ((0.0, 700, 0.012, 1.0), (0.022, 1100, 0.009, 0.6)):  # (the crack)
        tc = T(0.08); place(x, hp(rng.standard_normal(tc.size), f) * env(tc, 0.0004, tau), st, a)
    times = np.sort(0.02 + rng.exponential(0.08, 16))
    x += grains(t.size, times, rng.uniform(0.4, 1.0, times.size) * np.exp(-times / 0.25), [knock(0.08, f, 0.02, rng, 0.8) for f in (300, 480, 700, 900)], rng) * 0.6  # (crumbling)
    gr = np.sort(0.15 + rng.exponential(0.18, 40)); gr = gr[gr < 0.95]
    x += grains(t.size, gr, rng.uniform(0.1, 0.45, gr.size) * np.exp(-(gr - 0.15) / 0.3), [knock(0.03, f, 0.006, rng, 1.0) for f in (900, 1400, 2000, 2400)], rng) * 0.5  # (gravel)
    x += bp(rng.standard_normal(t.size), 500, 3000) * env(t, 0.03, 0.25) * 0.12  # (dust)
    return finish(x, 0.86, 30, 1.4)


PIECES = {'pc_line_1': lambda: pc_line(4201), 'pc_line_2': lambda: pc_line(4202), 'pc_line_3': lambda: pc_line(4203),
          'pc_line_hv_1': lambda: pc_line_hv(4211), 'pc_line_hv_2': lambda: pc_line_hv(4212),
          'pc_impact_1': lambda: pc_impact(4221), 'pc_impact_2': lambda: pc_impact(4222),
          'pc_beam_1': lambda: pc_beam(4231), 'pc_beam_2': lambda: pc_beam(4232), 'pc_beam_s_1': lambda: pc_beam(4233, True), 'pc_beam_s_2': lambda: pc_beam(4234, True),
          'pc_glyph_1': lambda: pc_glyph(4241) * 0.82,  # (as loud as the other take)
          'pc_glyph_2': lambda: pc_glyph(4242, (587.33, 739.99, 880.0, 1108.73)),
          'pc_swirl': lambda: pc_swirl(4251), 'pc_ink_1': lambda: pc_ink(4261), 'pc_ink_2': lambda: pc_ink(4262),
          'spike_break': lambda: spike_break(4271)}


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[:1] == ['pieces']:  # THE BAR's reference pieces (python3 tools/audio/hits.py pieces [name ...])
        for n in args[1:] or PIECES:
            write(n, PIECES[n]())
        raise SystemExit
    if args[:1] == ['bar']:  # the risers and the flurries' ticks
        write('riser_s', riser(4101, 0.36)); write('riser_l', riser(4102, 0.52, ult=True))
        write('cutin_in', cutin_in(4103)); write('cutin_out', cutin_out(4104))
        write('storm_turn', storm_turn(4105))
        write('petal_gather', petal_gather(4106)); write('petal_draw', petal_draw(4107)); write('stone_burst', stone_burst(4108)); write('page_fold', page_fold(4109))
        for c in MAT:
            for take in (1, 2):
                write(f'tk_{c}_{take}', tick(c, take))
        raise SystemExit
    classes = args or list(MAT)
    for c in classes:
        for w in 'lmh':
            for take in (1, 2, 3):
                write(f'imp_{c}_{w}_{take}', make(c, w, take))
