/**
 * DEAD SUN Audio Engine
 * Cinematic Procedural Web Audio API sound generator + dynamic space ambient soundtrack
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.musicMuted = false;
    this.sfxMuted = false;
    this.initialized = false;

    this.danger = 0; // 0 (safe) to 1 (critical)
    this.sizzleTarget = 0;
    this.roarTarget = 0;
    this.lastTypeClick = 0;

    // Master Bus Nodes
    this.masterFilter = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.sizzleGain = null;
    this.roarGain = null;
    this.musicFilter = null;

    // Ambient Pad & Chime Timers
    this.musicTimer = null;
    this.chimeTimer = null;
    this.heartbeatTimer = null;
    this.padGainNodes = [];
    this.activePadOscs = [];
    this.chordIndex = 0;

    // Rich cinematic sci-fi chord progressions (Warm detuned analog pads)
    // Chords: Dm9, Bbmaj7, Fsus2, Csus4
    this.chordVoicings = [
      [73.42, 110.00, 146.83, 174.61, 261.63, 329.63],  // Dm9
      [58.27, 87.31, 146.83, 174.61, 220.00, 293.66],   // Bbmaj7
      [43.65, 87.31, 130.81, 174.61, 196.00, 261.63],   // Fsus2
      [65.41, 98.00, 130.81, 174.61, 261.63, 392.00]    // Csus4
    ];

    // High crystalline celestial chimes (D Dorian scale)
    this.chimeNotes = [880.00, 987.77, 1046.50, 1174.66, 1318.51, 1567.98, 1760.00];
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master lowpass filter (open normally, clamps on pause/dialogue/death for space muffle)
      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = "lowpass";
      this.masterFilter.frequency.value = 18000;
      this.masterFilter.Q.value = 0.707;
      this.masterFilter.connect(this.ctx.destination);

      // Music Master Bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicMuted ? 0 : 0.36;
      this.musicGain.connect(this.masterFilter);

      // Music Pad Filter (warm analog lowpass that slowly breathes and opens under danger)
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = "lowpass";
      this.musicFilter.frequency.value = 580;
      this.musicFilter.Q.value = 1.4;
      this.musicFilter.connect(this.musicGain);

      // SFX Master Bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxMuted ? 0 : 0.65;
      this.sfxGain.connect(this.masterFilter);

      // Sizzle source (Filtered noise for suit heat when exposed to direct sunlight)
      const noise1 = this.createNoiseBufferNode();
      const sizzleHp = this.ctx.createBiquadFilter();
      sizzleHp.type = "highpass";
      sizzleHp.frequency.value = 5200;

      const sizzleBp = this.ctx.createBiquadFilter();
      sizzleBp.type = "bandpass";
      sizzleBp.frequency.value = 7400;
      sizzleBp.Q.value = 4.0;

      this.sizzleGain = this.ctx.createGain();
      this.sizzleGain.gain.value = 0;

      noise1.connect(sizzleHp);
      sizzleHp.connect(sizzleBp);
      sizzleBp.connect(this.sizzleGain);
      this.sizzleGain.connect(this.sfxGain);
      noise1.start(0);

      // Roar source (Deep rumbling lowpass noise for approaching firestorm wall)
      const noise2 = this.createNoiseBufferNode();
      const roarLp = this.ctx.createBiquadFilter();
      roarLp.type = "lowpass";
      roarLp.frequency.value = 240;
      roarLp.Q.value = 1.2;

      this.roarGain = this.ctx.createGain();
      this.roarGain.gain.value = 0;

      noise2.connect(roarLp);
      roarLp.connect(this.roarGain);
      this.roarGain.connect(this.sfxGain);
      noise2.start(0);

      // Launch ambient generative soundtrack
      this.startAmbientMusic();
      this.startHeartbeatLoop();
      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio initialization failed:", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  createNoiseBufferNode() {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    return node;
  }

  createNoiseBurst(duration) {
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    return node;
  }

  /* =======================================================
     CINEMATIC ANALOG SPACE SOUNDTRACK
     Lush, warm evolving pad chords + crystalline bell chimes
     ======================================================= */
  startAmbientMusic() {
    if (!this.ctx) return;

    // Play next evolving chord in the ambient progression
    const playNextChord = () => {
      if (!this.ctx || this.musicMuted) {
        this.musicTimer = setTimeout(playNextChord, 3000);
        return;
      }

      const now = this.ctx.currentTime;
      const chordDuration = 8.5; // seconds per chord
      const crossfadeTime = 3.2; // seconds crossfade
      const freqs = this.chordVoicings[this.chordIndex % this.chordVoicings.length];
      this.chordIndex++;

      // Create gain envelope for this entire chord
      const chordMasterGain = this.ctx.createGain();
      chordMasterGain.gain.setValueAtTime(0, now);
      chordMasterGain.gain.linearRampToValueAtTime(0.24, now + crossfadeTime);
      chordMasterGain.gain.setValueAtTime(0.24, now + chordDuration - crossfadeTime);
      chordMasterGain.gain.linearRampToValueAtTime(0.0001, now + chordDuration);
      chordMasterGain.connect(this.musicFilter);

      // Spawn warm detuned oscillators for each note in the chord
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        // Bass notes use pure warm sine, higher notes use soft triangle
        osc.type = idx <= 1 ? "sine" : "triangle";
        // Subtle analog detuning for lush stereo chorusing
        const detune = (Math.random() - 0.5) * 8.0;
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(detune, now);

        const noteGain = this.ctx.createGain();
        // Lower frequencies have slightly more presence, higher voices are delicate
        const voiceVol = idx <= 1 ? 0.35 : 0.18;
        noteGain.gain.setValueAtTime(voiceVol, now);

        osc.connect(noteGain);
        noteGain.connect(chordMasterGain);

        osc.start(now);
        osc.stop(now + chordDuration + 0.5);
      });

      // Schedule next chord with smooth crossfade overlap
      this.musicTimer = setTimeout(playNextChord, (chordDuration - crossfadeTime) * 1000);
    };

    playNextChord();
    this.startCelestialChimes();
  }

  // Sparse crystalline bell chimes fading into the deep cosmos
  startCelestialChimes() {
    const triggerChime = () => {
      if (!this.ctx || this.musicMuted) {
        this.chimeTimer = setTimeout(triggerChime, 4000);
        return;
      }

      const now = this.ctx.currentTime;
      const note = this.chimeNotes[Math.floor(Math.random() * this.chimeNotes.length)];

      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note, now);

      const gain = this.ctx.createGain();
      const vol = 0.08 + Math.random() * 0.05;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + 3.4);

      // Trigger next chime at random intervals (3.5s to 7s)
      const nextInterval = 3500 + Math.random() * 3500;
      this.chimeTimer = setTimeout(triggerChime, nextInterval);
    };

    this.chimeTimer = setTimeout(triggerChime, 2500);
  }

  // Dynamic tension heartbeat pulse (accelerates when firestorm or heat rises)
  startHeartbeatLoop() {
    const triggerHeartbeat = () => {
      if (!this.ctx || this.musicMuted) {
        this.heartbeatTimer = setTimeout(triggerHeartbeat, 2000);
        return;
      }

      // Only audible if there is noticeable danger
      if (this.danger > 0.15) {
        const now = this.ctx.currentTime;
        const subOsc = this.ctx.createOscillator();
        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(52, now);
        subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.14);

        const subGain = this.ctx.createGain();
        const vol = 0.06 + this.danger * 0.16;
        subGain.gain.setValueAtTime(0.001, now);
        subGain.gain.linearRampToValueAtTime(vol, now + 0.02);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

        subOsc.connect(subGain);
        subGain.connect(this.musicGain);

        subOsc.start(now);
        subOsc.stop(now + 0.18);
      }

      // Pulse rate scales with danger (from 2200ms down to 450ms)
      const delay = Math.max(450, 2200 - this.danger * 1750);
      this.heartbeatTimer = setTimeout(triggerHeartbeat, delay);
    };

    this.heartbeatTimer = setTimeout(triggerHeartbeat, 1800);
  }

  /* =======================================================
     SOUND EFFECTS (Procedural Web Audio)
     ======================================================= */

  // Shelter Enter Chime (Warm consonant bell harmony: 523Hz & 784Hz - C5 & G5)
  playShelterChime() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    [523.25, 783.99].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const gain = this.ctx.createGain();
      const startT = now + idx * 0.06;
      gain.gain.setValueAtTime(0, startT);
      gain.gain.linearRampToValueAtTime(0.24, startT + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startT + 0.75);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startT);
      osc.stop(startT + 0.8);
    });
  }

  // Dash Whoosh (Sleek aerodynamic filtered noise sweep + subtle sub-sine)
  playDashWhoosh() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;

    const noise = this.createNoiseBurst(0.22);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.12);
    filter.frequency.exponentialRampToValueAtTime(500, now + 0.22);
    filter.Q.value = 2.8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.38, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.24);

    // Subtle low-end thrust punch
    const sub = this.ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(45, now + 0.16);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.2, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.2);
  }

  // Death / Elimination Sound: Multi-layered cinematic sci-fi catastrophe
  playHit() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;

    // Layer 1: Sub-bass Shockwave & Implosion Punch (75Hz down to 18Hz)
    const subOsc = this.ctx.createOscillator();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(75, now);
    subOsc.frequency.exponentialRampToValueAtTime(18, now + 0.75);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.85, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(now);
    subOsc.stop(now + 0.85);

    // Layer 2: Suit Decompression Rupture & Scorching Firestorm Blast (Sweeping Noise)
    const noise = this.createNoiseBurst(0.9);
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(3600, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(160, now + 0.85);
    noiseFilter.Q.value = 3.6;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 0.95);

    // Layer 3: Life-Support Telemetry Flatline (High tech tone dying out)
    const teleOsc = this.ctx.createOscillator();
    teleOsc.type = "sine";
    teleOsc.frequency.setValueAtTime(1760, now);
    teleOsc.frequency.setValueAtTime(1760, now + 0.15);
    teleOsc.frequency.exponentialRampToValueAtTime(880, now + 0.45);

    const teleGain = this.ctx.createGain();
    teleGain.gain.setValueAtTime(0.28, now);
    teleGain.gain.setValueAtTime(0.28, now + 0.35);
    teleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

    teleOsc.connect(teleGain);
    teleGain.connect(this.sfxGain);
    teleOsc.start(now);
    teleOsc.stop(now + 0.9);

    // Layer 4: Space Vacuum Muffle (Master lowpass clamps immediately)
    if (this.masterFilter) {
      this.masterFilter.frequency.setTargetAtTime(240, now, 0.08);
    }
  }

  // Heat Warning Beep (Sleek sci-fi dual-frequency telemetry chirp)
  playWarningBeep(freq = 660) {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + 0.06);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Dialogue Typewriter Click
  playTypeClick() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastTypeClick < 0.035) return;
    this.lastTypeClick = now;

    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 1800 + (Math.random() * 400 - 200);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.02);
  }

  // Radio Transmission Chirp
  playRadioChirp() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.08);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 3.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Eclipse Ambient Swell
  playEclipseSwell() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 2.0);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 3.2);
  }

  // Solar Flare Warning Alarm (Urgent descending pulse)
  playSolarFlareWarning() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.28;
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(620, t);
      osc.frequency.exponentialRampToValueAtTime(380, t + 0.2);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 850;
      filter.Q.value = 5.0;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.26);
    }
  }

  // Solar Flare Eruption Roar & Coronal Wind
  playSolarFlareRoar() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    const dur = 6.5;

    // Sub-bass rumble swell
    const subOsc = this.ctx.createOscillator();
    subOsc.type = "triangle";
    subOsc.frequency.setValueAtTime(55, now);
    subOsc.frequency.linearRampToValueAtTime(82, now + dur * 0.4);
    subOsc.frequency.linearRampToValueAtTime(45, now + dur);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.01, now);
    subGain.gain.linearRampToValueAtTime(0.42, now + dur * 0.35);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(now);
    subOsc.stop(now + dur);

    // Coronal solar wind hiss
    const noise = this.createNoiseBufferNode();
    const bpFilter = this.ctx.createBiquadFilter();
    bpFilter.type = "bandpass";
    bpFilter.frequency.setValueAtTime(400, now);
    bpFilter.frequency.exponentialRampToValueAtTime(2400, now + dur * 0.4);
    bpFilter.frequency.exponentialRampToValueAtTime(350, now + dur);
    bpFilter.Q.value = 3.5;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.01, now);
    noiseGain.gain.linearRampToValueAtTime(0.35, now + dur * 0.4);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(bpFilter);
    bpFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
  }

  /* =======================================================
     CONTINUOUS AUDIO UPDATES (Sizzle, Roar, Tension)
     ======================================================= */
  update(dt, heatRatio, fireProximity) {
    if (!this.ctx || !this.initialized) return;

    const safeHeat = Number.isFinite(heatRatio) ? heatRatio : 0;
    const safeFire = Number.isFinite(fireProximity) ? fireProximity : 0;

    // Sizzle volume scales with heat ratio
    this.sizzleTarget = Math.max(0, Math.min(1, (safeHeat - 0.2) / 0.8));
    // Roar volume scales with fire proximity (0 when fire is far, 1 when right on player)
    this.roarTarget = Math.max(0, Math.min(1, safeFire));

    // Overall danger factor
    this.danger = Math.max(this.sizzleTarget, this.roarTarget);

    const now = this.ctx.currentTime;
    if (this.sizzleGain) {
      const targetGain = this.sfxMuted ? 0 : this.sizzleTarget * 0.45;
      if (Number.isFinite(targetGain)) {
        this.sizzleGain.gain.setTargetAtTime(targetGain, now, 0.1);
      }
    }
    if (this.roarGain) {
      const targetGain = this.sfxMuted ? 0 : this.roarGain * 0.6;
      if (Number.isFinite(targetGain)) {
        this.roarGain.gain.setTargetAtTime(targetGain, now, 0.1);
      }
    }
    if (this.musicFilter) {
      // Dynamic music filter cutoff opens from 580Hz up to 2600Hz under danger
      const targetFreq = 580 + this.danger * 2000;
      if (Number.isFinite(targetFreq)) {
        this.musicFilter.frequency.setTargetAtTime(targetFreq, now, 0.25);
      }
    }
  }

  setLowpass(isLow) {
    if (!this.masterFilter || !this.ctx) return;
    const now = this.ctx.currentTime;
    const targetFreq = isLow ? 650 : 18000;
    this.masterFilter.frequency.setTargetAtTime(targetFreq, now, 0.15);
  }

  toggleMusic() {
    this.musicMuted = !this.musicMuted;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicMuted ? 0 : 0.36, this.ctx.currentTime, 0.05);
    }
    return !this.musicMuted;
  }

  toggleSfx() {
    this.sfxMuted = !this.sfxMuted;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxMuted ? 0 : 0.65, this.ctx.currentTime, 0.05);
    }
    return !this.sfxMuted;
  }
}

window.soundEngine = new SoundEngine();
