/**
 * DEAD SUN Audio Engine
 * Cinematic Web Audio API Sound Generator + Dedicated Space Ambient Soundtrack Engine
 * Features:
 * - High-Fidelity BGM Audio integration with user soundtrack (music.mp3)
 * - Seamless looping, volume management, and dynamic lowpass space-muffle filter
 * - Web Audio API bus routing with automatic fallback for WebView / file:// environments
 * - Upgraded cinematic procedural SFX:
 *   * Heavy pressurized rocket-dash whoosh with sub-bass impact
 *   * Shimmering harmonic shelter chime & cryogenic heat venting
 *   * Devastating multi-layer suit decompression & visor fracture death impact
 *   * NASA/Apollo quindar tone radio transmission chirps
 *   * Tactile magnetic boot regolith footsteps with organic variance
 *   * Futuristic tactile HUD button clicks & telemetry warnings
 *   * Seismic solar flare eruption roar and descending klaxon alarms
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
    this.lastFootstep = 0;
    this.lastNearMiss = 0;

    // Master Bus Nodes
    this.masterFilter = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.sizzleGain = null;
    this.roarGain = null;
    this.musicFilter = null;

    // Dedicated BGM Soundtrack
    this.bgmAudio = null;
    this.bgmSource = null;
    this.bgmConnectedToWebAudio = false;

    // Atmosphere Timers
    this.heartbeatTimer = null;

    // High crystalline celestial chimes for sparse cosmic accents
    this.chimeNotes = [880.00, 987.77, 1046.50, 1174.66, 1318.51, 1567.98, 1760.00];

    // Pre-initialize HTML5 audio element so it begins caching immediately
    this.setupBgmAudio();
  }

  setupBgmAudio() {
    try {
      this.bgmAudio = new Audio();
      this.bgmAudio.src = 'music.mp3';
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = 0.82;
      this.bgmAudio.preload = 'auto';
      this.bgmAudio.crossOrigin = 'anonymous';
    } catch (e) {
      console.warn("Could not pre-allocate Audio element:", e);
    }
  }

  init() {
    if (this.initialized) {
      this.resume();
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master lowpass filter (open at 20kHz normally; clamps on pause/dialogue/death for space muffle)
      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = "lowpass";
      this.masterFilter.frequency.value = 20000;
      this.masterFilter.Q.value = 0.707;
      this.masterFilter.connect(this.ctx.destination);

      // Music Master Bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicMuted ? 0 : 0.60;
      this.musicGain.connect(this.masterFilter);

      // Music Filter: Clean full-spectrum lowpass with wide ceiling (20kHz)
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = "lowpass";
      this.musicFilter.frequency.value = 20000;
      this.musicFilter.Q.value = 0.707;
      this.musicFilter.connect(this.musicGain);

      // Connect BGM Audio to Web Audio API graph
      if (this.bgmAudio && !this.bgmSource) {
        try {
          this.bgmSource = this.ctx.createMediaElementSource(this.bgmAudio);
          this.bgmSource.connect(this.musicFilter);
          this.bgmConnectedToWebAudio = true;
        } catch (mediaErr) {
          console.warn("MediaElementSource connection note (falling back to direct element playback):", mediaErr);
          this.bgmConnectedToWebAudio = false;
        }
      }

      // SFX Master Bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxMuted ? 0 : 0.85;
      this.sfxGain.connect(this.masterFilter);

      // Sizzle source (Filtered noise for suit heat when exposed to direct sunlight)
      const noise1 = this.createNoiseBufferNode();
      const sizzleHp = this.ctx.createBiquadFilter();
      sizzleHp.type = "highpass";
      sizzleHp.frequency.value = 4600;

      const sizzleBp = this.ctx.createBiquadFilter();
      sizzleBp.type = "bandpass";
      sizzleBp.frequency.value = 6800;
      sizzleBp.Q.value = 3.6;

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
      roarLp.frequency.value = 260;
      roarLp.Q.value = 1.4;

      this.roarGain = this.ctx.createGain();
      this.roarGain.gain.value = 0;

      noise2.connect(roarLp);
      roarLp.connect(this.roarGain);
      this.roarGain.connect(this.sfxGain);
      noise2.start(0);

      // Start music playback if not muted
      this.playMusic();

      // Launch dynamic tension heartbeat
      this.startHeartbeatLoop();
      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio initialization failed:", e);
    }
  }

  playMusic() {
    if (!this.bgmAudio || this.musicMuted) return;
    const playPromise = this.bgmAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        // Autoplay restrictions will unlock on first user gesture
        console.log("Music play queued for user interaction:", err.message);
      });
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    if (this.bgmAudio && !this.musicMuted && this.bgmAudio.paused) {
      this.bgmAudio.play().catch(() => {});
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

  // Dynamic tension heartbeat pulse (accelerates when firestorm or heat rises)
  startHeartbeatLoop() {
    const triggerHeartbeat = () => {
      if (!this.ctx || this.sfxMuted) {
        this.heartbeatTimer = setTimeout(triggerHeartbeat, 1800);
        return;
      }

      // Only audible if there is noticeable danger
      if (this.danger > 0.18) {
        const now = this.ctx.currentTime;
        const subOsc = this.ctx.createOscillator();
        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(58, now);
        subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.16);

        const subGain = this.ctx.createGain();
        const vol = 0.08 + this.danger * 0.22;
        subGain.gain.setValueAtTime(0.001, now);
        subGain.gain.linearRampToValueAtTime(vol, now + 0.02);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

        subOsc.connect(subGain);
        subGain.connect(this.sfxGain);

        subOsc.start(now);
        subOsc.stop(now + 0.18);
      }

      // Pulse rate scales with danger (from 2000ms down to 420ms)
      const delay = Math.max(420, 2000 - this.danger * 1580);
      this.heartbeatTimer = setTimeout(triggerHeartbeat, delay);
    };

    this.heartbeatTimer = setTimeout(triggerHeartbeat, 1600);
  }

  /* =======================================================
     UPGRADED SOUND EFFECTS (High-Impact Procedural Web Audio)
     ======================================================= */

  // 1. Dash Whoosh: Kinetic rocket-thruster impulse with sub-bass transient
  playDashWhoosh() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;

    // Layer 1: Sub-bass Punch Transient (135Hz -> 36Hz)
    const sub = this.ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(135, now);
    sub.frequency.exponentialRampToValueAtTime(36, now + 0.20);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.42, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.24);

    // Layer 2: Pressurized Nozzle Noise Sweep (650Hz -> 3800Hz -> 750Hz)
    const noise = this.createNoiseBurst(0.28);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.exponentialRampToValueAtTime(3800, now + 0.11);
    filter.frequency.exponentialRampToValueAtTime(750, now + 0.28);
    filter.Q.value = 3.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.55, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.30);

    // Layer 3: High-Frequency Gas Sizzle Pop (Crisp metallic edge)
    const highNoise = this.createNoiseBurst(0.14);
    const hpFilter = this.ctx.createBiquadFilter();
    hpFilter.type = "highpass";
    hpFilter.frequency.setValueAtTime(3600, now);

    const hpGain = this.ctx.createGain();
    hpGain.gain.setValueAtTime(0.30, now);
    hpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    highNoise.connect(hpFilter);
    hpFilter.connect(hpGain);
    hpGain.connect(this.sfxGain);

    highNoise.start(now);
    highNoise.stop(now + 0.16);
  }

  // 2. Shelter Enter Chime: Crystalline Harmonic Bell with Cryogenic Venting
  playShelterChime() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;

    // Harmonic Chord Progression: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
    const bellPitches = [523.25, 659.25, 783.99, 1046.50];
    bellPitches.forEach((freq, idx) => {
      const startT = now + idx * 0.055;

      // Dual detuned oscillators for lush celestial chorus shimmer
      [-3.5, 3.5].forEach(detune => {
        const osc = this.ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.detune.value = detune;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, startT);
        gain.gain.linearRampToValueAtTime(0.18, startT + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, startT + 0.85);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(startT);
        osc.stop(startT + 0.90);
      });
    });

    // Thermal Shield Activation Hum (Warm low-mid reassurance)
    const humOsc = this.ctx.createOscillator();
    humOsc.type = "triangle";
    humOsc.frequency.setValueAtTime(220, now);

    const humGain = this.ctx.createGain();
    humGain.gain.setValueAtTime(0.001, now);
    humGain.gain.linearRampToValueAtTime(0.22, now + 0.15);
    humGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.70);

    humOsc.connect(humGain);
    humGain.connect(this.sfxGain);
    humOsc.start(now);
    humOsc.stop(now + 0.75);

    // Thermal dissipation steam venting
    this.playCoolingSwell();
  }

  // 3. Cooling Swell: Thermal dissipation hiss when entering shade
  playCoolingSwell() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;

    const noise = this.createNoiseBurst(0.45);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(3200, now);
    bp.frequency.exponentialRampToValueAtTime(700, now + 0.45);
    bp.Q.value = 2.4;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.48);
  }

  // 4. Death / Catastrophic Elimination Sound: Devastating Multi-Layer Sci-Fi Impact
  playHit() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;

    // Layer 1: Sub-bass Seismic Implosion (95Hz down to 20Hz with massive punch)
    const subOsc = this.ctx.createOscillator();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(95, now);
    subOsc.frequency.exponentialRampToValueAtTime(20, now + 0.95);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(now);
    subOsc.stop(now + 1.05);

    // Layer 2: Decompression Rupture & Scorching Firestorm Blast
    const noise = this.createNoiseBurst(1.1);
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(4500, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(140, now + 1.0);
    noiseFilter.Q.value = 4.2;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.85, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 1.15);

    // Layer 3: Life-Support Emergency Distress Tone (High dual sirens fading out)
    [2200, 1100].forEach((freq, i) => {
      const teleOsc = this.ctx.createOscillator();
      teleOsc.type = "sawtooth";
      teleOsc.frequency.setValueAtTime(freq, now + i * 0.05);
      teleOsc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.65);

      const teleFilter = this.ctx.createBiquadFilter();
      teleFilter.type = "lowpass";
      teleFilter.frequency.value = 1800;

      const teleGain = this.ctx.createGain();
      teleGain.gain.setValueAtTime(0.22, now);
      teleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

      teleOsc.connect(teleFilter);
      teleFilter.connect(teleGain);
      teleGain.connect(this.sfxGain);
      teleOsc.start(now);
      teleOsc.stop(now + 0.80);
    });

    // Layer 4: Space Vacuum Muffle (Master lowpass clamps immediately to 220Hz)
    if (this.masterFilter) {
      this.masterFilter.frequency.setTargetAtTime(220, now, 0.08);
    }
  }

  // 5. Suit Decompression Rupture & Visor Fracture Crack
  playSuitRupture() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;

    // Tempered glass visor fracture
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(3800, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.16);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(1800, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.20);
  }

  // 6. Heat / Hazard Warning Beep: Crisp Sci-Fi HUD Chirp
  playWarningBeep(freq = 660) {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;

    // Primary tone with upward micro-ramp
    const osc1 = this.ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(freq, now);
    osc1.frequency.exponentialRampToValueAtTime(freq * 1.35, now + 0.06);

    // Harmonic overtone for high-tech HUD cut-through
    const osc2 = this.ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(freq * 2.0, now);
    osc2.frequency.exponentialRampToValueAtTime(freq * 2.7, now + 0.06);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.10);
    osc2.stop(now + 0.10);
  }

  // 7. Astronaut Magnetic Boot Footstep on Regolith
  playFootstep() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastFootstep < 0.14) return;
    this.lastFootstep = now;

    const pitchVar = 0.9 + Math.random() * 0.22;

    // Layer A: Low Regolith Sand Thud
    const noise = this.createNoiseBurst(0.05);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(160 * pitchVar, now);
    filter.Q.value = 2.4;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.048);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 0.055);

    // Layer B: Subtle magnetic boot latch click
    const clickOsc = this.ctx.createOscillator();
    clickOsc.type = "sine";
    clickOsc.frequency.setValueAtTime(920 * pitchVar, now);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.05, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);

    clickOsc.connect(clickGain);
    clickGain.connect(this.sfxGain);
    clickOsc.start(now);
    clickOsc.stop(now + 0.016);
  }

  // 8. Dialogue Typewriter Click: Mechanical tactile haptic feedback
  playTypeClick() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastTypeClick < 0.032) return;
    this.lastTypeClick = now;

    const pitch = 1600 + (Math.random() * 500 - 250);
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, now + 0.016);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.022);
  }

  // 9. NASA Apollo Quindar Tone + Radio Static Chirp
  playRadioChirp() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;

    // Authentic NASA Quindar Beep (2524Hz sine pulse)
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2524, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.20, now + 0.005);
    gain.gain.setValueAtTime(0.20, now + 0.038);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.048);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.052);

    // Comms Radio Squelch Noise Burst
    const squelch = this.createNoiseBurst(0.06);
    const sqFilter = this.ctx.createBiquadFilter();
    sqFilter.type = "bandpass";
    sqFilter.frequency.value = 1800;
    sqFilter.Q.value = 3.2;

    const sqGain = this.ctx.createGain();
    const sqStart = now + 0.025;
    sqGain.gain.setValueAtTime(0.001, sqStart);
    sqGain.gain.linearRampToValueAtTime(0.16, sqStart + 0.01);
    sqGain.gain.exponentialRampToValueAtTime(0.0001, sqStart + 0.055);

    squelch.connect(sqFilter);
    sqFilter.connect(sqGain);
    sqGain.connect(this.sfxGain);
    squelch.start(sqStart);
    squelch.stop(sqStart + 0.065);
  }

  // 10. UI Button Click: Crisp futuristic mechanical button press
  playButtonClick() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.035);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  // 11. UI Button Hover: Subtle high-tech pip
  playButtonHover() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1850, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.022);
  }

  // 12. Solar Flare Warning Alarm: Urgent 3-pulse descending klaxon
  playSolarFlareWarning() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.26;
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(740, t);
      osc.frequency.exponentialRampToValueAtTime(360, t + 0.19);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 920;
      filter.Q.value = 5.2;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.24);
    }
  }

  // 13. Solar Flare Eruption Roar: Thermonuclear Coronal Wind Storm
  playSolarFlareRoar() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    const dur = 6.5;

    // Dual Detuned Sub-bass Oscillators (creating acoustic beating rumble)
    [42, 47].forEach(freq => {
      const subOsc = this.ctx.createOscillator();
      subOsc.type = "triangle";
      subOsc.frequency.setValueAtTime(freq, now);
      subOsc.frequency.linearRampToValueAtTime(freq * 1.6, now + dur * 0.4);
      subOsc.frequency.linearRampToValueAtTime(freq * 0.85, now + dur);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.01, now);
      subGain.gain.linearRampToValueAtTime(0.38, now + dur * 0.35);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      subOsc.connect(subGain);
      subGain.connect(this.sfxGain);
      subOsc.start(now);
      subOsc.stop(now + dur);
    });

    // Coronal Plasma Wind Hiss
    const noise = this.createNoiseBufferNode();
    const bpFilter = this.ctx.createBiquadFilter();
    bpFilter.type = "bandpass";
    bpFilter.frequency.setValueAtTime(350, now);
    bpFilter.frequency.exponentialRampToValueAtTime(3200, now + dur * 0.4);
    bpFilter.frequency.exponentialRampToValueAtTime(300, now + dur);
    bpFilter.Q.value = 3.8;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.01, now);
    noiseGain.gain.linearRampToValueAtTime(0.40, now + dur * 0.4);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(bpFilter);
    bpFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
  }

  // 14. Eclipse Ambient Swell
  playEclipseSwell() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 2.0);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 3.2);
  }

  // 15. Near-Miss Whoosh: Close-call obstacle buzz
  playNearMiss() {
    if (!this.ctx || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastNearMiss < 0.6) return;
    this.lastNearMiss = now;

    const noise = this.createNoiseBurst(0.22);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(2100, now + 0.10);
    filter.frequency.exponentialRampToValueAtTime(450, now + 0.22);
    filter.Q.value = 4.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 0.24);
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
      const targetGain = this.sfxMuted ? 0 : this.roarTarget * 0.65;
      if (Number.isFinite(targetGain)) {
        this.roarGain.gain.setTargetAtTime(targetGain, now, 0.1);
      }
    }
  }

  // Dynamic lowpass space-suit helmet muffle (e.g. paused / dialogue / death)
  setLowpass(isLow) {
    if (!this.masterFilter || !this.ctx) return;
    const now = this.ctx.currentTime;
    const targetFreq = isLow ? 650 : 20000;
    this.masterFilter.frequency.setTargetAtTime(targetFreq, now, 0.15);
  }

  toggleMusic() {
    this.musicMuted = !this.musicMuted;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicMuted ? 0 : 0.60, this.ctx.currentTime, 0.05);
    }
    if (this.bgmAudio) {
      if (this.musicMuted) {
        this.bgmAudio.pause();
      } else {
        this.bgmAudio.play().catch(() => {});
      }
    }
    return !this.musicMuted;
  }

  toggleSfx() {
    this.sfxMuted = !this.sfxMuted;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxMuted ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
    return !this.sfxMuted;
  }
}

window.soundEngine = new SoundEngine();

// Automatic WebAudio and BGM unlock on first touch or click (essential for mobile webviews)
const unlockAudio = () => {
  if (window.soundEngine) {
    window.soundEngine.init();
    if (window.soundEngine.ctx && window.soundEngine.ctx.state === 'suspended') {
      window.soundEngine.ctx.resume();
    }
    if (window.soundEngine.bgmAudio && !window.soundEngine.musicMuted && window.soundEngine.bgmAudio.paused) {
      window.soundEngine.bgmAudio.play().catch(() => {});
    }
  }
};
window.addEventListener('touchstart', unlockAudio, { passive: true, once: false });
window.addEventListener('touchend', unlockAudio, { passive: true, once: false });
window.addEventListener('pointerdown', unlockAudio, { passive: true, once: false });
window.addEventListener('click', unlockAudio, { passive: true, once: false });
