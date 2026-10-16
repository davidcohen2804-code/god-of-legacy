#!/usr/bin/env python3
"""Synthesises the arena's heavy layers (written as .ogg + .mp3 into public/assets/audio/sfx/, like the other effects):

  boom_1..3   the main hit's boom (mono, ~0.9 s): a sub thump whose pitch falls fast (the weight you feel), its octave for
              small speakers, a punch of low noise (the body of the blow), a short crack on top (the contact), a low
              rumble under the tail; glued by a soft saturation. Three takes (pitch, length, grain) so a fight never
              repeats the same one.
  dim_whoosh  the room going dark on a big moment (stereo, ~1.7 s): low air swelling and sweeping down while a sub
              glide sinks under it.

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
