import numpy as np
import scipy.signal as signal
import soundfile as sf
import os
import subprocess

FFMPEG = r'C:\Users\cteja\AppData\Local\Programs\Python\Python311\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
SR = 48000
TOTAL_DUR = 44.0
NUM_SAMPLES = int(TOTAL_DUR * SR)
t = np.linspace(0, TOTAL_DUR, NUM_SAMPLES, endpoint=False)

def butter_lowpass(data, cutoff, order=4):
    sos = signal.butter(order, cutoff, btype='low', fs=SR, output='sos')
    return signal.sosfilt(sos, data)

def butter_highpass(data, cutoff, order=4):
    sos = signal.butter(order, cutoff, btype='high', fs=SR, output='sos')
    return signal.sosfilt(sos, data)

def butter_bandpass(data, lowcut, highcut, order=3):
    sos = signal.butter(order, [lowcut, highcut], btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, data)

def saturate(x, drive=2.0):
    return np.tanh(drive * x)

print("Synthesizing Aggressive Trailer Audio Layers...")

# -------------------------------------------------------------
# Layer 1: Sub-Bass Drones & Atmospheric Rumble (0:00 - 44:00)
# -------------------------------------------------------------
drone = np.zeros(NUM_SAMPLES, dtype=np.float32)
# 36Hz - 45Hz moving sub rumble
drone += 0.4 * np.sin(2 * np.pi * (38 + 4 * np.sin(2 * np.pi * 0.1 * t)) * t)
drone += 0.25 * np.sin(2 * np.pi * 76 * t)
# Wind / solar noise
pink_noise = np.random.normal(0, 1.0, NUM_SAMPLES).astype(np.float32)
wind = butter_bandpass(pink_noise, 80, 450) * (0.15 + 0.1 * np.sin(2 * np.pi * 0.15 * t))
drone += wind

# Fade in
fade_in = np.clip(t / 2.0, 0, 1)
drone *= fade_in

# -------------------------------------------------------------
# Layer 2: Heartbeat & Breathing (0:00 - 11.5s, then 20s - 28s)
# -------------------------------------------------------------
heartbeat = np.zeros(NUM_SAMPLES, dtype=np.float32)

def add_heartbeat(track, start_time, bpm, count, intensity=0.7):
    period = 60.0 / bpm
    for i in range(count):
        hb_time = start_time + i * period
        if hb_time >= TOTAL_DUR:
            break
        # First lub
        idx1 = int(hb_time * SR)
        dur1 = int(0.12 * SR)
        if idx1 + dur1 < NUM_SAMPLES:
            env1 = np.sin(np.linspace(0, np.pi, dur1)) ** 2
            sub1 = np.sin(2 * np.pi * 48 * np.linspace(0, 0.12, dur1))
            track[idx1:idx1+dur1] += intensity * env1 * sub1
        # Second dub
        idx2 = idx1 + int(0.18 * SR)
        dur2 = int(0.10 * SR)
        if idx2 + dur2 < NUM_SAMPLES:
            env2 = np.sin(np.linspace(0, np.pi, dur2)) ** 2
            sub2 = np.sin(2 * np.pi * 55 * np.linspace(0, 0.10, dur2))
            track[idx2:idx2+dur2] += (intensity * 0.8) * env2 * sub2

# Slow tense heartbeat in Scene 1 (60 BPM)
add_heartbeat(heartbeat, 1.0, 60, 6, intensity=0.55)
# Accelerating heartbeat in Scene 2 (90 BPM)
add_heartbeat(heartbeat, 7.0, 90, 6, intensity=0.75)
# Panic racing heartbeat in Scene 4 (140 BPM)
add_heartbeat(heartbeat, 20.0, 140, 16, intensity=0.85)

# -------------------------------------------------------------
# Layer 3: Geiger Counter & Emergency Klaxon (7.0s - 12.0s & 20s - 28s)
# -------------------------------------------------------------
siren = np.zeros(NUM_SAMPLES, dtype=np.float32)
# Two-tone aggressive warning klaxon starting at 7.5s
klaxon_t = np.clip(t - 7.5, 0, 4.0)
klaxon_mask = (t >= 7.5) & (t < 11.5)
freq_klaxon = 520 + 320 * (np.sin(2 * np.pi * 3.5 * t) > 0)
siren_tone = signal.square(2 * np.pi * freq_klaxon * t) * klaxon_mask * 0.35
# Add distortion
siren += saturate(siren_tone, 3.0) * 0.4

# Sirens in running scene (20s - 28s)
klaxon_mask2 = (t >= 20.0) & (t < 28.0)
freq_klaxon2 = 640 + 260 * (np.sin(2 * np.pi * 4.0 * t) > 0)
siren_tone2 = signal.square(2 * np.pi * freq_klaxon2 * t) * klaxon_mask2 * 0.28
siren += saturate(siren_tone2, 2.5) * 0.35

# Geiger clicks
geiger = np.zeros(NUM_SAMPLES, dtype=np.float32)
np.random.seed(42)
click_indices = np.random.choice(
    np.where((t >= 7.0) & (t < 12.0))[0],
    size=120,
    replace=False
)
for cidx in click_indices:
    if cidx + 80 < NUM_SAMPLES:
        geiger[cidx:cidx+80] += np.random.uniform(0.3, 0.7) * (np.random.normal(0, 1, 80))

# -------------------------------------------------------------
# Layer 4: Apocalyptic Trailer BRAAAMS (Hans Zimmer style)
# -------------------------------------------------------------
braams = np.zeros(NUM_SAMPLES, dtype=np.float32)

def add_braaam(track, start_time, dur=4.0, pitch=45.0, power=1.0):
    start_idx = int(start_time * SR)
    length = int(dur * SR)
    if start_idx + length > NUM_SAMPLES:
        length = NUM_SAMPLES - start_idx
    bt = np.linspace(0, dur, length)
    
    # Pitch bend downward slightly
    pitch_env = pitch * (1.0 - 0.12 * (bt / dur))
    
    # Layer 1: Sawtooth reese with detuning
    saw1 = signal.sawtooth(2 * np.pi * pitch_env * bt)
    saw2 = signal.sawtooth(2 * np.pi * (pitch_env * 1.015) * bt)
    saw3 = signal.sawtooth(2 * np.pi * (pitch_env * 0.5) * bt) # Sub octave
    
    raw = saw1 + saw2 + 0.8 * saw3
    
    # Filter envelope (sweeps open then closes)
    filt_env = np.exp(-1.5 * bt) * 0.9 + 0.1
    filtered = butter_lowpass(raw, 900)
    
    # Heavy tube saturation / overdrive distortion
    distorted = saturate(filtered, 4.5)
    
    # Sub boom punch at the attack
    attack_punch = np.exp(-12.0 * bt) * np.sin(2 * np.pi * 42 * bt) * 1.5
    
    # Amp envelope
    amp_env = np.ones_like(bt)
    # 50ms attack
    att_len = int(0.05 * SR)
    amp_env[:att_len] = np.linspace(0, 1, att_len)
    # Exponential decay tail
    amp_env = amp_env * np.exp(-0.7 * bt)
    
    combined = (distorted + attack_punch) * amp_env * power
    track[start_idx:start_idx+length] += combined

# BRAAAM 1: When Red Giant Arises (11.5s)
add_braaam(braams, 11.5, dur=4.5, pitch=48.0, power=1.4)
# BRAAAM 2: Peak Sun Swell (16.0s) - heavier & lower pitch
add_braaam(braams, 16.0, dur=4.2, pitch=40.0, power=1.6)

# -------------------------------------------------------------
# Layer 5: Heavy Aggressive Industrial Drums (20.0s - 28.0s)
# -------------------------------------------------------------
drums = np.zeros(NUM_SAMPLES, dtype=np.float32)

BPM = 140
BEAT_SEC = 60.0 / BPM # 0.4285s per beat
DRUM_START = 20.0
DRUM_END = 28.0

def make_kick(dur=0.35):
    l = int(dur * SR)
    kt = np.linspace(0, dur, l)
    f_env = 140 * np.exp(-35 * kt) + 40
    phase = 2 * np.pi * np.cumsum(f_env) / SR
    body = np.sin(phase)
    click = np.random.normal(0, 1, l) * np.exp(-120 * kt)
    env = np.exp(-9 * kt)
    return saturate((body + 0.3 * click) * env, 3.0)

def make_snare(dur=0.45):
    l = int(dur * SR)
    st = np.linspace(0, dur, l)
    tone = np.sin(2 * np.pi * 180 * st) * np.exp(-25 * st)
    noise = butter_bandpass(np.random.normal(0, 1, l), 800, 7000) * np.exp(-14 * st)
    return saturate((tone + noise * 1.8), 2.5)

def make_anvil_impact(dur=0.8):
    l = int(dur * SR)
    at = np.linspace(0, dur, l)
    metal = np.sin(2 * np.pi * 840 * at) + 0.6 * np.sin(2 * np.pi * 1320 * at) + 0.4 * np.sin(2 * np.pi * 2100 * at)
    noise = np.random.normal(0, 1, l) * np.exp(-22 * at)
    env = np.exp(-8 * at)
    return saturate(metal * env + noise * 0.8, 3.0)

kick_sample = make_kick()
snare_sample = make_snare()
anvil_sample = make_anvil_impact()

cur_beat_time = DRUM_START
beat_count = 0
while cur_beat_time < DRUM_END:
    bidx = int(cur_beat_time * SR)
    
    # Heavy kick on beats 0, 2 and 16th pickups
    if beat_count % 4 in [0, 2]:
        kl = min(len(kick_sample), NUM_SAMPLES - bidx)
        drums[bidx:bidx+kl] += kick_sample[:kl] * 1.3
        
    # Anvil/Snare on beats 1 and 3
    if beat_count % 4 in [1, 3]:
        sl = min(len(snare_sample), NUM_SAMPLES - bidx)
        drums[bidx:bidx+sl] += snare_sample[:sl] * 1.2
        al = min(len(anvil_sample), NUM_SAMPLES - bidx)
        drums[bidx:bidx+al] += anvil_sample[:al] * 0.7
        
    # Double kick on 8th offbeats
    if beat_count % 4 == 2:
        off_idx = bidx + int(BEAT_SEC * 0.5 * SR)
        if off_idx + len(kick_sample) < NUM_SAMPLES:
            drums[off_idx:off_idx+len(kick_sample)] += kick_sample * 1.0
            
    cur_beat_time += BEAT_SEC
    beat_count += 1

# -------------------------------------------------------------
# Layer 6: Aggressive Distorted Synth Lead Riff (20.0s - 28.0s)
# -------------------------------------------------------------
synth_riff = np.zeros(NUM_SAMPLES, dtype=np.float32)
# Dark minor riff in D (D, F, G, G# -> D)
riff_notes = [73.42, 87.31, 98.00, 103.83, 73.42, 87.31, 98.00, 110.00] # D2, F2, G2, G#2...
note_dur = BEAT_SEC

for i in range(16):
    note_time = DRUM_START + i * (note_dur * 0.5)
    if note_time >= DRUM_END:
        break
    n_idx = int(note_time * SR)
    freq = riff_notes[i % len(riff_notes)]
    nl = int(note_dur * 0.48 * SR)
    if n_idx + nl < NUM_SAMPLES:
        nt = np.linspace(0, note_dur * 0.48, nl)
        wave = signal.sawtooth(2 * np.pi * freq * nt) + 0.5 * signal.square(2 * np.pi * freq * 2 * nt)
        env = np.exp(-6 * nt)
        lead = saturate(wave * env, 5.0) * 0.45
        synth_riff[n_idx:n_idx+nl] += lead

# -------------------------------------------------------------
# Layer 7: Hypersonic Climax Riser (28.0s - 34.0s)
# -------------------------------------------------------------
riser = np.zeros(NUM_SAMPLES, dtype=np.float32)
r_mask = (t >= 28.0) & (t < 34.0)
rt = np.clip((t - 28.0) / 6.0, 0, 1)

# Exponential pitch sweep from 60Hz to 6,000Hz
freq_sweep = 60.0 * ((6000.0 / 60.0) ** (rt ** 2.0))
phase_sweep = 2 * np.pi * np.cumsum(freq_sweep) / SR
saw_riser = signal.sawtooth(phase_sweep)

# Rushing noise wind
noise_riser = butter_bandpass(pink_noise, 300, 6000) * (rt ** 1.8)

# Accelerating stutter pulses
stutter_freq = 6.0 + 38.0 * (rt ** 2.5)
stutter_env = (np.sin(2 * np.pi * np.cumsum(stutter_freq) / SR) > 0).astype(np.float32)

riser = (saw_riser * 0.5 + noise_riser * 0.8) * stutter_env * (rt ** 1.4) * r_mask
riser = saturate(riser, 3.0) * 1.3

# -------------------------------------------------------------
# Layer 8: Devastating Nuclear Sub-Bass Drop & Slam (34.0s)
# -------------------------------------------------------------
slam = np.zeros(NUM_SAMPLES, dtype=np.float32)
slam_start = 34.0
slam_idx = int(slam_start * SR)
slam_dur = 9.5
sl = int(slam_dur * SR)
if slam_idx + sl > NUM_SAMPLES:
    sl = NUM_SAMPLES - slam_idx
st = np.linspace(0, slam_dur, sl)

# 1. Devastating sub-bass 24Hz - 60Hz drop
sub_freq = 75.0 * np.exp(-4.5 * st) + 28.0
sub_drop = np.sin(2 * np.pi * np.cumsum(sub_freq) / SR) * np.exp(-0.45 * st)

# 2. Heavy distorted metal crash & explosion
metal_crash = (np.sin(2 * np.pi * 120 * st) + np.sin(2 * np.pi * 310 * st)) * np.exp(-8.0 * st)
explosion = butter_lowpass(np.random.normal(0, 1, sl), 1200) * np.exp(-1.8 * st)

# 3. Sustained dark ambient power chord under the logo (D minor: D2, A2, D3)
chord_t = st
chord_d = np.sin(2 * np.pi * 73.42 * chord_t) * 0.6
chord_a = np.sin(2 * np.pi * 110.00 * chord_t) * 0.4
chord_d3 = np.sin(2 * np.pi * 146.83 * chord_t) * 0.3
chord_body = saturate(chord_d + chord_a + chord_d3, 2.0) * np.clip(st / 0.5, 0, 1) * np.exp(-0.25 * st)

slam_combined = (sub_drop * 1.8 + metal_crash * 1.0 + explosion * 1.4 + chord_body * 0.7)
slam[slam_idx:slam_idx+sl] = slam_combined

# -------------------------------------------------------------
# MASTER MIX (Stereo Balancing, Overdrive, Limiting)
# -------------------------------------------------------------
master_left = (
    drone * 0.7 +
    heartbeat * 0.85 +
    geiger * 0.6 +
    siren * 0.5 +
    braams * 1.1 +
    drums * 1.25 +
    synth_riff * 0.8 +
    riser * 1.1 +
    slam * 1.4
)

master_right = (
    drone * 0.7 +
    heartbeat * 0.85 +
    geiger * 0.7 +
    siren * 0.45 +
    braams * 1.05 +
    drums * 1.25 +
    synth_riff * 0.85 +
    riser * 1.1 +
    slam * 1.4
)

# Stereo widening delay on sirens and synth
delay_samples = int(0.015 * SR)
master_right[delay_samples:] += (siren[:-delay_samples] * 0.2 + synth_riff[:-delay_samples] * 0.15)

# Master saturation / soft limiter
master_left = np.tanh(master_left * 0.85)
master_right = np.tanh(master_right * 0.85)

# Fade out at the very end (42.5s -> 44s)
end_fade = np.clip((44.0 - t) / 1.5, 0, 1)
master_left *= end_fade
master_right *= end_fade

# Normalize to -0.3 dB peak
peak = max(np.max(np.abs(master_left)), np.max(np.abs(master_right)))
if peak > 0:
    master_left = (master_left / peak) * 0.96
    master_right = (master_right / peak) * 0.96

stereo_master = np.stack([master_left, master_right], axis=1)

raw_wav = 'trailer_build_mg/aggressive_score_raw.wav'
sf.write(raw_wav, stereo_master, SR, subtype='PCM_24')
print(f"Aggressive raw WAV synthesized successfully: {raw_wav}")

# -------------------------------------------------------------
# Post-Processing with FFmpeg (Heavy Compressor, Sub-Bass & Limiter)
# -------------------------------------------------------------
final_mp3 = 'trailer_assets/aggressive_trailer_soundtrack.mp3'
cmd_fx = [
    FFMPEG, '-i', raw_wav,
    '-af', (
        # Bass boost below 100Hz
        'bass=g=5:f=60:w=0.5,'
        # High shelf boost for crisp grit
        'treble=g=3:f=4000:w=0.5,'
        # Aggressive multiband-style compressor
        'compand=attacks=0.01:decays=0.15:points=-80/-80|-40/-30|-20/-10|-10/-5|0/0:soft-knee=6,'
        # Volume boost
        'volume=1.8'
    ),
    '-c:a', 'libmp3lame', '-b:a', '320k', final_mp3, '-y'
]
subprocess.run(cmd_fx, check=True)
print(f"MASTERED AGGRESSIVE SOUNDTRACK CREATED: {final_mp3}")
