"""
Generates a small set of original, royalty-free instrumental audio clips
used as placeholder playback audio for the song catalog.

Why: the catalog metadata (backend/database/songsData.js) lists 137 real,
commercially released songs for portfolio/demo purposes. Bundling the
actual copyrighted recordings of those songs is not something any
legitimate project can do without a label license. Instead, every track
below is 100% original — algorithmically composed and synthesized right
here — so the app has real, legally clean, playable audio and every
player control (play/pause/seek/volume/next/previous/shuffle/repeat)
works end to end. seed.js maps each catalog song to one of these by genre.

Run:  python3 generate_demo_audio.py
Output: ../backend/public/audio/*.wav
"""

import numpy as np
import wave
import os

SAMPLE_RATE = 22050
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "public", "audio")


def midi_to_freq(m):
    return 440.0 * (2 ** ((m - 69) / 12.0))


def chord_wave(t, freqs):
    """Sum of sine tones for a chord, two slightly-detuned layers per tone for warmth."""
    out = np.zeros_like(t)
    for f in freqs:
        out += np.sin(2 * np.pi * f * t)
        out += 0.5 * np.sin(2 * np.pi * (f * 1.003) * t)  # gentle chorus/detune
    return out / (len(freqs) * 1.5)


def generate_track(filename, duration, root_midi, chords, tempo_bpm,
                    beat=True, drone=False, beat_strength=0.4, seed=0):
    rng = np.random.default_rng(seed)
    n = int(SAMPLE_RATE * duration)
    t = np.arange(n) / SAMPLE_RATE
    beat_dur = 60.0 / tempo_bpm
    chord_dur = beat_dur * 4
    signal = np.zeros(n)

    # --- harmonic pad: cycle through the chord progression ---
    chord_idx = (t // chord_dur).astype(int) % len(chords)
    for ci, offsets in enumerate(chords):
        mask = chord_idx == ci
        if not np.any(mask):
            continue
        freqs = [midi_to_freq(root_midi + o) for o in offsets]
        signal[mask] += chord_wave(t[mask], freqs) * 0.38

    # --- optional low drone (adds an Indian-classical-ish sustained feel) ---
    if drone:
        drone_freqs = [midi_to_freq(root_midi - 12), midi_to_freq(root_midi - 5)]
        signal += chord_wave(t, drone_freqs) * 0.14

    # --- simple percussive pulse on the beat ---
    if beat:
        beat_positions = np.arange(0, duration, beat_dur)
        kick_len = int(0.15 * SAMPLE_RATE)
        for bp in beat_positions:
            idx_start = int(bp * SAMPLE_RATE)
            idx_end = min(idx_start + kick_len, n)
            if idx_start >= n:
                continue
            local_t = t[idx_start:idx_end] - bp
            env = np.exp(-local_t / 0.05)
            kick = np.sin(2 * np.pi * 58 * local_t) * env
            signal[idx_start:idx_end] += kick * beat_strength

    # --- a little texture: very soft filtered noise "air" ---
    noise = rng.normal(0, 1, n)
    kernel = np.ones(30) / 30
    soft_noise = np.convolve(noise, kernel, mode="same")
    signal += soft_noise * 0.015

    # --- overall fade in/out envelope ---
    fade_len = int(0.5 * SAMPLE_RATE)
    fade_out_len = int(1.0 * SAMPLE_RATE)
    signal[:fade_len] *= np.linspace(0, 1, fade_len)
    signal[-fade_out_len:] *= np.linspace(1, 0, fade_out_len)

    # --- normalize & write ---
    peak = np.max(np.abs(signal))
    if peak > 0:
        signal = signal / peak * 0.78
    pcm = (signal * 32767).astype(np.int16)

    path = os.path.join(OUT_DIR, filename)
    with wave.open(path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm.tobytes())
    print(f"  wrote {filename}  ({duration}s, {os.path.getsize(path)/1024:.0f} KB)")


# Chord progressions expressed as semitone offsets from the root
MAJOR_I_V_vi_IV = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]]
MAJOR_I_IV_V    = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]]
MINOR_i_VI_III_VII = [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]]
MINOR_i_iv_v    = [[0, 3, 7], [5, 8, 12], [7, 10, 14], [0, 3, 7]]
POWER_CHORDS    = [[0, 7, 12], [5, 12, 17], [7, 14, 19], [0, 7, 12]]

TRACKS = [
    dict(filename="pop_bright_1.wav",  duration=24, root_midi=60, chords=MAJOR_I_V_vi_IV,    tempo_bpm=120, seed=1),
    dict(filename="pop_bright_2.wav",  duration=24, root_midi=67, chords=MAJOR_I_V_vi_IV,    tempo_bpm=128, seed=2),
    dict(filename="ballad_1.wav",      duration=26, root_midi=57, chords=MINOR_i_VI_III_VII, tempo_bpm=68,  beat=False, seed=3),
    dict(filename="ballad_2.wav",      duration=26, root_midi=62, chords=MINOR_i_VI_III_VII, tempo_bpm=64,  beat=False, seed=4),
    dict(filename="bollywood_1.wav",   duration=25, root_midi=52, chords=MINOR_i_iv_v,       tempo_bpm=85,  drone=True, seed=5),
    dict(filename="bollywood_2.wav",   duration=25, root_midi=57, chords=MINOR_i_iv_v,       tempo_bpm=95,  drone=True, seed=6),
    dict(filename="edm_1.wav",         duration=24, root_midi=65, chords=MAJOR_I_V_vi_IV,    tempo_bpm=128, beat_strength=0.55, seed=7),
    dict(filename="edm_2.wav",         duration=24, root_midi=72, chords=MAJOR_I_IV_V,       tempo_bpm=132, beat_strength=0.55, seed=8),
    dict(filename="hiphop_1.wav",      duration=24, root_midi=50, chords=MINOR_i_VI_III_VII, tempo_bpm=85,  beat_strength=0.6, seed=9),
    dict(filename="rock_1.wav",        duration=24, root_midi=52, chords=POWER_CHORDS,       tempo_bpm=110, beat_strength=0.5, seed=10),
    dict(filename="classical_1.wav",   duration=28, root_midi=60, chords=MAJOR_I_V_vi_IV,    tempo_bpm=76,  beat=False, seed=11),
    dict(filename="latin_1.wav",       duration=24, root_midi=55, chords=MAJOR_I_IV_V,       tempo_bpm=100, seed=12),
    dict(filename="kpop_1.wav",        duration=24, root_midi=69, chords=MAJOR_I_V_vi_IV,    tempo_bpm=124, seed=13),
]

if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Generating {len(TRACKS)} placeholder tracks into {os.path.abspath(OUT_DIR)}")
    for cfg in TRACKS:
        generate_track(**cfg)
    print("Done.")
