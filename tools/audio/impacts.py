#!/usr/bin/env python3
"""Synthesises the arena's heavy layers and PVP 3D's room sounds (written as .ogg + .mp3 into public/assets/audio/sfx/,
like the other effects):

  boom_1..3   the main hit's boom (mono, ~0.9 s): a sub thump whose pitch falls fast (the weight you feel), its octave for
              small speakers, a punch of low noise (the body of the blow), a short crack on top (the contact), a low
              rumble under the tail; glued by a soft saturation. Three takes (pitch, length, grain) so a fight never
              repeats the same one.
  dim_whoosh  the room going dark on a big moment (stereo, ~1.7 s): low air swelling and sweeping down while a sub
              glide sinks under it.
  PVP 3D, a sound for each piece of a skill in the room (Fx3D.onPiece), under the blow:
  crack_1..2  stone splitting (two cracks, the stone's body, grit)     chunks_1..2  wood chunks falling, bouncing (a beat later)
  pillar      a rising roar of light (air rising, a chord gliding up)  bolt_1..2    a sharp electric crackle
  dome        a deep whump                                             wave         a rushing sweep along the floor
  crystals    ice growing (tinks rising), then shattering              streak       a quick airy fwip (what flies)
  slash       a bright swish with a ring                               rain         a pattering of arrows coming down
  and the fighters on the planks: step_1..4 (a foot on the wood), scuff_1..2 (driven back, sliding), thump_1..2 (landing).

    python3 tools/audio/impacts.py            (needs numpy, scipy, ffmpeg with libvorbis and libmp3lame)
"""
import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public/assets/audio/sfx')


def lp(x, f, order=4):
    return sosfilt(butter(order, f / (SR / 2), 'low', output='sos'), x, axis=0)


def hp(x, f, order=4):
    return sosfilt(butter(order, f / (SR / 2), 'high', output='sos'), x, axis=0)


def bp(x, f0, f1, order=3):
    return sosfilt(butter(order, [f0 / (SR / 2), f1 / (SR / 2)], 'band', output='sos'), x, axis=0)


def env(t, attack, tau):
    """A fast rise (attack s) and an exponential fall (tau s)."""
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * a * (3 - 2 * a) * np.exp(-np.maximum(0, t - attack) / tau)


def glide(t, f0, f1, tau):
    """Phase of a sine whose pitch falls from f0 toward f1 (exponentially, tau s)."""
    f = f1 + (f0 - f1) * np.exp(-t / tau)
    return 2 * np.pi * np.cumsum(f) / SR


def brown(n, rng):
    w = rng.standard_normal(n)
    b = np.cumsum(w)
    b -= np.convolve(b, np.ones(2048) / 2048, mode='same')  # (no drift)
    return b / (np.abs(b).max() + 1e-9)


def finish(x, peak=0.89, fade_ms=25, drive=1.7):
    x = np.tanh(drive * x) / np.tanh(drive)
    n = int(SR * fade_ms / 1000)
    x[-n:] *= np.linspace(1, 0, n)[:, None] if x.ndim == 2 else np.linspace(1, 0, n)
    return x * (peak / (np.abs(x).max() + 1e-9))


def boom(seed, f0, f1, decay, length=0.95):
    rng = np.random.default_rng(seed)
    t = np.arange(int(SR * length)) / SR
    sub = np.sin(glide(t, f0, f1, 0.05)) * env(t, 0.0025, decay) * 0.85             # the thump
    body = np.sin(glide(t, f0 * 0.9 + 40, 92, 0.03) + 1.1) * env(t, 0.002, 0.07) * 0.6  # its punch (small speakers hear it)
    octave = np.sin(glide(t, f0 * 2, f1 * 2, 0.04) + 0.6) * env(t, 0.002, decay * 0.45) * 0.55
    punch = lp(rng.standard_normal(t.size), 900) * env(t, 0.0015, 0.045) * 1.15     # the body of the blow
    crack = hp(rng.standard_normal(t.size), 2600) * env(t, 0.0006, 0.009) * 0.55    # the contact
    grit = bp(rng.standard_normal(t.size), 300, 1400) * env(t, 0.003, 0.11) * 0.22  # (debris in it)
    rumble = lp(brown(t.size, rng), 160) * env(t, 0.012, decay * 1.6) * 0.5         # the floor shaking under it
    return finish(sub + body + octave + punch + crack + grit + rumble, peak=0.84)


def whoosh(seed, length=1.7):
    rng = np.random.default_rng(seed)
    t = np.arange(int(SR * length)) / SR
    swell = np.where(t < 0.42, np.sin(np.pi / 2 * t / 0.42) ** 2, np.exp(-(t - 0.42) / 0.42))  # up, then away
    out = np.zeros((t.size, 2))
    for c in range(2):  # (each side its own air: wide)
        n = rng.standard_normal(t.size)
        # the air sweeps down: the noise is filtered in blocks, the cutoff falling 880 -> 120 Hz
        y = np.zeros_like(n); blk = 1024; zi = None
        for i in range(0, t.size, blk):
            fc = 120 + 760 * np.exp(-t[i] / 0.42)
            sos = butter(2, fc / (SR / 2), 'low', output='sos')
            if zi is None:
                zi = np.zeros((sos.shape[0], 2))
            y[i:i + blk], zi = sosfilt(sos, n[i:i + blk], zi=zi)
        air = y * swell * 1.5
        hiss = bp(rng.standard_normal(t.size), 1200, 3200) * np.exp(-t / 0.1) * np.clip(t / 0.05, 0, 1) * 0.025  # (the first rush)
        out[:, c] = air + hiss
    shape = np.where(t < 0.5, np.sin(np.pi / 2 * t / 0.5) ** 2, np.exp(-(t - 0.5) / 0.55))
    sub = (np.sin(glide(t, 70, 34, 0.6)) * 0.9 + np.sin(glide(t, 140, 68, 0.6) + 0.4) * 0.38) * shape  # (and its octave: heard on small speakers)
    out += sub[:, None]
    return finish(out, peak=0.85, fade_ms=60, drive=1.3)


# ---------------------------------------------------------------- PVP 3D: the pieces and the planks

def burst(t, at, hpf, tau, rng, amp=1.0):
    """A crack: broadband noise from `at` s, highpassed, decaying fast."""
    n = hp(rng.standard_normal(t.size), hpf) * env(np.maximum(0, t - at), 0.0008, tau) * (t >= at)
    return n * amp


def knock(t, at, f, tau, amp, rng, click=0.5):
    """A wooden knock at `at` s: a damped tone (the plank / the chunk) and a short click on top."""
    u = np.maximum(0, t - at)
    tone = np.sin(2 * np.pi * f * u + rng.uniform(0, 6)) * np.exp(-u / tau) * (t >= at)
    c = bp(rng.standard_normal(t.size), 1200, 4200) * np.exp(-u / 0.003) * (t >= at) * click
    return (tone + c) * amp


def crack(seed):
    rng = np.random.default_rng(seed); t = np.arange(int(SR * 0.7)) / SR
    x = burst(t, 0, 500, 0.022, rng, 1.0) + burst(t, 0.028 + rng.uniform(0, 0.02), 900, 0.016, rng, 0.6)  # (it splits twice)
    x += lp(brown(t.size, rng), 300) * env(t, 0.004, 0.14) * 0.9                                       # the stone's body
    for f, a in ((235, 0.45), (410, 0.3), (690, 0.15)):
        x += np.sin(2 * np.pi * f * t) * env(t, 0.001, 0.07) * a
    grit = bp(rng.standard_normal(t.size), 1500, 4500) * (rng.random(t.size) < 0.004) * np.exp(-t / 0.15) * 6
    return finish(x + grit, peak=0.86)


def chunks(seed):
    rng = np.random.default_rng(seed); t = np.arange(int(SR * 0.75)) / SR
    x = np.zeros_like(t); at = 0.0
    for i in range(7):  # (bouncing: each a little later and softer)
        at += rng.uniform(0.03, 0.11); x += knock(t, at, rng.uniform(450, 1150), rng.uniform(0.012, 0.03), 0.8 * 0.78 ** i, rng)
    return finish(x, peak=0.8, drive=1.2)


def pillar(seed):
    rng = np.random.default_rng(seed); t = np.arange(int(SR * 1.05)) / SR
    swell = np.where(t < 0.55, np.sin(np.pi / 2 * t / 0.55) ** 2, np.exp(-(t - 0.55) / 0.16))
    n = rng.standard_normal(t.size); y = np.zeros_like(n); blk = 512; zi = None
    for i in range(0, t.size, blk):  # (the air rising: a band sweeping 250 Hz -> 2.4 kHz)
        fc = 250 * (2400 / 250) ** min(1, t[i] / 0.8)
        sos = butter(2, [fc * 0.7 / (SR / 2), min(0.95, fc * 1.4 / (SR / 2))], 'band', output='sos')
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        y[i:i + blk], zi = sosfilt(sos, n[i:i + blk], zi=zi)
    up = 2 ** (np.minimum(t, 0.8) / 0.8)  # (the chord glides up an octave)
    chord = sum(np.sin(2 * np.pi * np.cumsum(f * up) / SR) * a for f, a in ((220, 0.3), (330.5, 0.22), (441, 0.18), (662, 0.1)))
    trem = 1 + 0.15 * np.sin(2 * np.pi * 9 * t)
    return finish((y * 2.2 + chord * trem) * swell, peak=0.82, drive=1.2)


def bolt(seed):
    rng = np.random.default_rng(seed); t = np.arange(int(SR * 0.45)) / SR
    x = burst(t, 0, 1500, 0.006, rng, 1.0)                                    # (the snap)
    for i in range(34):  # the crackle: clicks, densest at the start
        at = rng.exponential(0.07); x += burst(t, at, 2200, rng.uniform(0.0008, 0.003), rng, rng.uniform(0.2, 0.8) * np.exp(-at / 0.15))
    hum = hp(np.sign(np.sin(2 * np.pi * rng.uniform(70, 110) * t)) * (rng.random(t.size) < 0.6), 700) * env(t, 0.002, 0.07) * 0.25
    return finish(x + hum, peak=0.82, drive=1.4)


def dome(seed):
    rng = np.random.default_rng(seed); t = np.arange(int(SR * 0.85)) / SR
    whump = np.sin(glide(t, 82, 46, 0.12)) * env(t, 0.028, 0.24)
    air = lp(rng.standard_normal(t.size), 520) * env(t, 0.02, 0.09) * 0.9
    shimmer = np.sin(2 * np.pi * 940 * t) * env(t, 0.03, 0.18) * 0.06
    return finish(whump + air + shimmer, peak=0.84)


def wave(seed):
    rng = np.random.default_rng(seed); t = np.arange(int(SR * 0.95)) / SR
    swell = np.where(t < 0.35, np.sin(np.pi / 2 * t / 0.35) ** 2, np.exp(-(t - 0.35) / 0.22))
    n = rng.standard_normal(t.size); y = np.zeros_like(n); blk = 512; zi = None
    for i in range(0, t.size, blk):  # (rushing past: the band up to 2.6 kHz and back down)
        u = t[i] / 0.95; fc = 500 + 2100 * np.sin(np.pi * min(1, u * 1.2)) ** 1.5
        sos = butter(2, [fc * 0.6 / (SR / 2), min(0.95, fc * 1.6 / (SR / 2))], 'band', output='sos')
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        y[i:i + blk], zi = sosfilt(sos, n[i:i + blk], zi=zi)
    body = lp(brown(t.size, rng), 220) * 0.6
    return finish((y * 1.8 + body) * swell, peak=0.82, drive=1.2)


def crystals(seed):
    rng = np.random.default_rng(seed); t = np.arange(int(SR * 1.15)) / SR
    x = np.zeros_like(t)
    for i in range(16):  # growing: tinks rising, faster and faster
        at = 0.36 * (1 - (1 - i / 16) ** 1.6); f = 2400 * 2 ** (i / 16 * 1.2) * rng.uniform(0.95, 1.05)
        u = np.maximum(0, t - at); x += np.sin(2 * np.pi * f * u) * np.exp(-u / rng.uniform(0.015, 0.035)) * (t >= at) * 0.35
    creak = bp(rng.standard_normal(t.size), 1500, 5000) * (rng.random(t.size) < 0.02) * np.clip(t / 0.36, 0, 1) * (t < 0.37) * 1.2
    x += burst(t, 0.37, 2000, 0.06, rng, 1.0)  # the shatter
    for i in range(24):  # glass falling: pings scattered, fading
        at = 0.37 + rng.exponential(0.12); u = np.maximum(0, t - at)
        x += np.sin(2 * np.pi * rng.uniform(3000, 9000) * u) * np.exp(-u / rng.uniform(0.04, 0.14)) * (t >= at) * 0.3 * np.exp(-(at - 0.37) / 0.3)
    return finish(x + creak, peak=0.8, drive=1.3)


def streak(seed):
    rng = np.random.default_rng(seed); t = np.arange(int(SR * 0.28)) / SR
    e = np.where(t < 0.06, np.sin(np.pi / 2 * t / 0.06) ** 2, np.exp(-(t - 0.06) / 0.05))
    return finish(bp(rng.standard_normal(t.size), 1400, 4200) * e, peak=0.75, drive=1.1)


def slash(seed):
    rng = np.random.default_rng(seed); t = np.arange(int(SR * 0.34)) / SR
    e = np.where(t < 0.035, np.sin(np.pi / 2 * t / 0.035) ** 2, np.exp(-(t - 0.035) / 0.05))
    swish = hp(rng.standard_normal(t.size), 1800) * e
    ring = sum(np.sin(2 * np.pi * f * t) * a for f, a in ((3120, 0.12), (4730, 0.08), (6310, 0.05))) * env(t, 0.01, 0.1)
    return finish(swish + ring, peak=0.78, drive=1.1)


def rain(seed):
    rng = np.random.default_rng(seed); t = np.arange(int(SR * 1.0)) / SR
    x = lp(rng.standard_normal(t.size), 2500) * env(t, 0.08, 0.35) * 0.08  # (the air full of them)
    for i in range(30):
        at = rng.uniform(0, 0.85); u = np.maximum(0, t - at)
        whistle = np.sin(2 * np.pi * np.cumsum(np.where(t >= at, 3200 - 1200 * np.minimum(1, u / 0.04), 0)) / SR) * np.exp(-u / 0.02) * (t >= at) * 0.12
        x += whistle + burst(t, at + 0.035, 2000, rng.uniform(0.002, 0.005), rng, rng.uniform(0.3, 0.7))  # (the whistle, the tsk as it lands)
    return finish(x, peak=0.78, drive=1.2)


def step(seed):
    rng = np.random.default_rng(seed); t = np.arange(int(SR * 0.14)) / SR
    x = knock(t, 0, rng.uniform(170, 260), 0.025, 1.0, rng, click=0.7)              # the heel on the plank
    x += bp(rng.standard_normal(t.size), 2000, 6000) * env(t, 0.003, 0.015) * 0.18   # (a scuff of the sole)
    return finish(x, peak=0.8, drive=1.2)


def scuff(seed):
    rng = np.random.default_rng(seed); t = np.arange(int(SR * 0.4)) / SR
    grain = np.clip(lp(rng.standard_normal(t.size), 45) * 3 + 0.6, 0, None)  # (stick and slip)
    x = bp(rng.standard_normal(t.size), 800, 4000) * grain * np.where(t < 0.02, t / 0.02, np.exp(-(t - 0.02) / 0.14))
    x += lp(brown(t.size, rng), 180) * env(t, 0.01, 0.12) * 0.5
    return finish(x, peak=0.78, drive=1.2)


def thump(seed):
    rng = np.random.default_rng(seed); t = np.arange(int(SR * 0.3)) / SR
    x = np.sin(glide(t, 118, 56, 0.03)) * env(t, 0.002, 0.07)
    x += lp(rng.standard_normal(t.size), 400) * env(t, 0.001, 0.025) * 0.8
    x += knock(t, 0, rng.uniform(220, 280), 0.03, 0.45, rng, click=0.4)
    return finish(x, peak=0.85)


def write(name, x):
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, 'x.wav')
        wavfile.write(w, SR, (x * 32767).astype(np.int16))
        for ext, args in (('ogg', ['-c:a', 'libvorbis', '-q:a', '5']), ('mp3', ['-c:a', 'libmp3lame', '-b:a', '160k'])):
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', w, *args, os.path.join(OUT, f'{name}.{ext}')], check=True)
    print(name, f'{x.shape[0] / SR:.2f} s', 'stereo' if x.ndim == 2 else 'mono')


if __name__ == '__main__':
    write('boom_1', boom(11, 150, 44, 0.22))
    write('boom_2', boom(23, 132, 40, 0.26))
    write('boom_3', boom(37, 168, 48, 0.19))
    write('dim_whoosh', whoosh(5))
    for i, sd in enumerate((3, 9), 1): write(f'crack_{i}', crack(sd)); write(f'chunks_{i}', chunks(sd + 50)); write(f'bolt_{i}', bolt(sd + 70))
    write('pillar', pillar(4)); write('dome', dome(6)); write('wave', wave(8)); write('crystals', crystals(10))
    write('streak', streak(12)); write('slash', slash(14)); write('rain', rain(16))
    for i, sd in enumerate((21, 22, 23, 24), 1): write(f'step_{i}', step(sd))
    for i, sd in enumerate((31, 32), 1): write(f'scuff_{i}', scuff(sd)); write(f'thump_{i}', thump(sd + 10))
