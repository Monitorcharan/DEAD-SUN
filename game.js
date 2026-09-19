/**
 * DEAD SUN - Core Game Logic & PixiJS Rendering Engine
 * Faithful recreation based on original game & gameplay recording
 */

// Virtual Game Constants
const V_WIDTH = 1280;
const V_HEIGHT = 720;
const HORIZON_Y = 145;
const PLAY_MIN_Y = 175;
const PLAY_MAX_Y = 545;

// Physics & Gameplay Constants
const PLAYER_BASE_SPEED = 150;
const PLAYER_DASH_SPEED = 390; // 2.6x
const DASH_DURATION = 0.18; // seconds
const DASH_COOLDOWN = 1.1; // seconds
const PLAYER_COLLISION_RADIUS = 14;
const PLAYER_FEET_OFFSET = 0;

const SUN_HEAT_RATE = 0.22; // heat gain/sec in sun (MEDIUM default)
const SHADE_COOL_BASE = 0.34;
const SHADE_COOL_EXP = 1.585;
const STAMINA_REGEN_RATE = 0.9; // pips/sec in shade
const MAX_STAMINA = 3;

// Difficulty Profiles — applied at game start
const DIFFICULTY_PROFILES = {
  EASY: {
    fireBaseSpeed: 68,         // slower fire pursuit
    heatRate: 0.13,            // slower overheating
    shadeCoolBase: 0.42,       // faster cooling in shade
    obstacleSpacing: 80,       // extra px between formations
    flareTimer: 9999,          // no solar flares
    lavaFrequency: 0.5,        // 50% fewer lava pools in formations
    label: 'EASY'
  },
  MEDIUM: {
    fireBaseSpeed: 95,
    heatRate: 0.22,
    shadeCoolBase: 0.34,
    obstacleSpacing: 0,
    flareTimer: 26.0,
    lavaFrequency: 1.0,
    label: 'MEDIUM'
  },
  HARDCORE: {
    fireBaseSpeed: 138,        // relentless fire
    heatRate: 0.36,            // fast overheating
    shadeCoolBase: 0.26,       // slower cooling
    obstacleSpacing: -40,      // tighter gaps between formations
    flareTimer: 14.0,          // solar flares start sooner
    lavaFrequency: 1.4,        // 40% more lava pool spawns
    label: 'HARDCORE'
  }
};

// Asset Metadata for Shelter Obstacles
const ASSET_SPECS = {
  1: { file: 'asset1.png', w: 414, h: 660, solidH: 260, shadowH: 400, collPadX: 20 },
  2: { file: 'asset2.png', w: 300, h: 350, solidH: 140, shadowH: 210, collPadX: 16 },
  3: { file: 'asset3.png', w: 314, h: 497, solidH: 235, shadowH: 262, collPadX: 18 },
  4: { file: 'asset4.png', w: 378, h: 325, solidH: 145, shadowH: 180, collPadX: 16 },
  5: { file: 'asset5.png', w: 376, h: 440, solidH: 215, shadowH: 225, collPadX: 20 },
  6: { file: 'asset6.png', w: 281, h: 440, solidH: 215, shadowH: 225, collPadX: 18 },
  7: { file: 'asset7.png', w: 224, h: 269, solidH: 125, shadowH: 144, collPadX: 14 }
};

// Authentic Quips from Video
const COOLING_QUIPS = [
  "Now that is better",
  "Coolant levels recovering",
  "Survival mode: paused",
  "Finally, some shut-eye weather",
  "Ten out of ten, would shelter again",
  "Temperature: tolerable",
  "Almost feels like home",
  "Dark and lovely",
  "A moment's peace",
  "No robes, just shade",
  "Cool at last",
  "My suit thanks you",
  "Shade is my best friend",
  "The visor is defogging",
  "This'll do"
];

const HEATING_QUIPS = [
  "Getting crispy around the edges",
  "Roasting alive",
  "Heated seat I didn't ask for",
  "Feels like the inside of a kettle",
  "This is NOT a tan",
  "My thermostat gave up",
  "Hotter behind me every second!",
  "GAAAARGH",
  "Sun is flaring up!",
  "Radiation spike detected!"
];

// Initial Dialogues (from Video Frame 01:23)
const INTRO_DIALOGUE = [
  { speaker: "COMMAND", name: "STAR COMMAND", text: "Listen carefully: the dying sun bakes anything caught in it" },
  { speaker: "ASTRONAUT", name: "ASTRONAUT", text: "And the giant wall of flame behind me?" },
  { speaker: "COMMAND", name: "STAR COMMAND", text: "Also bakes you. Run, chain the shadows, stay alive." }
];

class DeadSunGame {
  constructor() {
    this.app = null;
    this.textures = {};
    this.shelterTextures = {};
    this.isVectorPlayer = true;

    // Game State: SPLASH, DIALOGUE, COUNTDOWN, PLAYING, TUTORIAL, PAUSED, GAMEOVER
    this.state = 'SPLASH';
    this.paused = false;
    this.quality = 'HIGH';

    // Sector Seed
    this.seed = Math.floor(Math.random() * 900000000 + 100000000);

    // Player
    this.player = {
      x: 300,
      y: 400,
      vx: 0,
      vy: 0,
      facingX: 1,
      facingY: 0,
      stamina: 3.0,
      dashTimer: 0,
      dashCooldown: 0,
      isDashing: false,
      shelterTime: 0,
      inShade: false,
      buffTimer: 0,
      hasBoots: false
    };

    // Heat & Metrics
    this.heat = 0.0;
    this.distance = 0;
    this.elapsedTime = 0;
    this.sheltersFound = 0;
    this.visitedShelterIds = new Set();
    this.heatBeepTimer = 0;
    this.heatQuipTimer = 6.0;

    // Best Scores (persisted)
    this.bests = this.loadBests();

    // Firestorm
    this.fire = {
      x: -450,
      baseSpeed: 95,
      speed: 95,
      proximity: 0
    };

    // Virtual Canvas & Camera Scaling (Mobile edge-to-edge + arcade zoom)
    this.vWidth = 1280;
    this.vHeight = 720;
    this.activeHeadMessage = null;

    // Camera
    this.camera = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      zoom: 1.28,
      shakeIntensity: 0,
      shakeDecay: 0.92,
      shakeOffset: { x: 0, y: 0 }
    };
    this.lastSpawnLane = -1;

    // Obstacles, Lava Pools, Supplies
    this.obstacles = [];
    this.lavaPools = [];
    this.supplies = [];
    this.nextSpawnX = 550;
    this.nextLavaX = 750;
    this.nextSupplyX = 1200;
    this.obstacleIdCounter = 1;

    // Particles & Decals
    this.particles = [];
    this.dashGhosts = [];

    // Death Sequence & Visual Effects
    this.deathTimer = 0;
    this.deathDuration = 1.65;
    this.deathCause = "";
    this.deathParticles = [];
    this.deathShockwaves = [];
    this.deathDebris = [];
    this.deathDecals = [];
    this.deathFlameGfx = null;
    this.deathFlashTimer = null;

    // Eclipse Event (Total solar eclipse with moon sliding over sun)
    this.eclipse = {
      active: false,
      timer: 35, // first eclipse after ~35s
      x: -800,
      width: 550,
      speed: 240,
      moonProgress: 0
    };

    // Solar Flare State Machine & Dynamic Sun Looming
    this.solarFlareTimer = 26.0; // first flare after ~26s
    this.solarFlarePhase = 'IDLE'; // 'IDLE', 'WARNING', 'ERUPTING', 'COOLDOWN'
    this.solarFlareDuration = 0;
    this.solarFlareIntensity = 0;
    this.solarFlareActive = false;
    this.sunBaseY = 72;

    // Tutorial Cards Seen Tracker
    this.tutorialsSeen = {
      cooling: false,
      overheating: false,
      supply: false
    };
    this.activeTutorial = null;

    // Dialogue State
    this.dialogueStep = 0;
    this.typewriterTimer = null;
    this.typewriterFull = "";
    this.typewriterCharIdx = 0;

    // Input Tracking
    this.keys = {};

    // DOM Elements
    this.dom = {
      container: document.getElementById('game-container'),
      heatFill: document.getElementById('heat-fill'),
      seg1: document.getElementById('seg-1'),
      seg2: document.getElementById('seg-2'),
      seg3: document.getElementById('seg-3'),
      heatStatus: document.getElementById('heat-status-text'),
      valDist: document.getElementById('val-dist'),
      valTime: document.getElementById('val-time'),
      valShelters: document.getElementById('val-shelters'),
      objText: document.getElementById('obj-text'),
      critBanner: document.getElementById('critical-banner'),
      flareBanner: document.getElementById('flare-banner'),
      flareText: document.getElementById('flare-text'),
      solarFlareOverlay: document.getElementById('solar-flare-overlay'),
      deathFlashOverlay: document.getElementById('death-flash-overlay'),
      heatVignette: document.getElementById('heat-vignette'),
      supplyTracker: document.getElementById('supply-tracker'),
      introBanner: document.getElementById('intro-title-banner'),
      countdown: document.getElementById('countdown-display'),
      shadeQuip: document.getElementById('shade-quip'),
      quipText: document.getElementById('quip-text'),
      headMessageBubble: document.getElementById('head-message-bubble'),
      headBubbleSender: document.getElementById('head-bubble-sender'),
      headBubbleIcon: document.getElementById('head-bubble-icon'),
      headBubbleText: document.getElementById('head-bubble-text'),
      headBubbleTail: document.getElementById('head-bubble-tail'),
      transmissionLayer: document.getElementById('transmission-layer'),
      dialogueSpeaker: document.getElementById('dialogue-speaker'),
      dialogueText: document.getElementById('dialogue-text'),
      dialogueAvatar: document.getElementById('dialogue-avatar'),
      tutorialCard: document.getElementById('tutorial-card'),
      tutTitle: document.getElementById('tut-title'),
      tutBody: document.getElementById('tut-body'),
      pauseMenu: document.getElementById('pause-menu'),
      termGameOver: document.getElementById('terminal-game-over'),
      termTypingBody: document.getElementById('term-typing-body'),
      termActions: document.getElementById('term-actions'),
      termSkipHint: document.getElementById('term-skip-hint'),
      btnRedeploy: document.getElementById('btn-redeploy'),
      btnMainMenu: document.getElementById('btn-main-menu'),
      startSplash: document.getElementById('start-splash'),
      btnPause: document.getElementById('btn-pause'),
      btnResume: document.getElementById('btn-resume'),
      btnToggleMusic: document.getElementById('btn-toggle-music'),
      btnToggleSfx: document.getElementById('btn-toggle-sfx'),
      btnToggleQuality: document.getElementById('btn-toggle-quality'),
      btnGiveUp: document.getElementById('btn-give-up'),
      btnStart: document.getElementById('btn-start'),
      // Mobile Touch Controls
      touchControlsLayer: document.getElementById('touch-controls-layer'),
      joystickZone: document.getElementById('joystick-zone'),
      joystickBase: document.getElementById('joystick-base'),
      joystickThumb: document.getElementById('joystick-thumb'),
      actionZone: document.getElementById('action-zone'),
      touchBtnDash: document.getElementById('touch-btn-dash'),
      btnToggleTouch: document.getElementById('btn-toggle-touch'),
      // Callsign Submission
      termCallsignBox: document.getElementById('term-callsign-box'),
      inputCallsign: document.getElementById('input-callsign'),
      btnSubmitScore: document.getElementById('btn-submit-score'),
      callsignStatus: document.getElementById('callsign-status'),
      // Leaderboard
      btnTermLeaderboard: document.getElementById('btn-term-leaderboard'),
      btnSplashLeaderboard: document.getElementById('btn-splash-leaderboard'),
      leaderboardModal: document.getElementById('leaderboard-modal'),
      leaderboardRows: document.getElementById('leaderboard-rows'),
      btnCloseLeaderboard: document.getElementById('btn-close-leaderboard'),
      btnClearDatabase: document.getElementById('btn-clear-database'),
      // Real-Time Pre-Game Pilot Registration
      splashCallsignInput: document.getElementById('splash-callsign-input'),
      // Mobile Controls Customization Modal
      btnPauseControls: document.getElementById('btn-pause-controls'),
      btnSplashControls: document.getElementById('btn-splash-controls'),
      controlsModal: document.getElementById('controls-modal'),
      btnCloseControlsX: document.getElementById('btn-close-controls-x'),
      btnSaveControls: document.getElementById('btn-save-controls'),
      btnResetControls: document.getElementById('btn-reset-controls'),
      sliderJoySize: document.getElementById('slider-joy-size'),
      sliderJoyX: document.getElementById('slider-joy-x'),
      sliderJoyY: document.getElementById('slider-joy-y'),
      sliderDashSize: document.getElementById('slider-dash-size'),
      valCtrlJoySize: document.getElementById('val-ctrl-joy-size'),
      valCtrlJoyX: document.getElementById('val-ctrl-joy-x'),
      valCtrlJoyY: document.getElementById('val-ctrl-joy-y'),
      valCtrlDashSize: document.getElementById('val-ctrl-dash-size'),
      btnSideLeft: document.getElementById('btn-side-left'),
      btnSideRight: document.getElementById('btn-side-right'),
      // Difficulty buttons
      pauseDiffEasy: document.getElementById('pause-diff-easy'),
      pauseDiffMedium: document.getElementById('pause-diff-medium'),
      pauseDiffHardcore: document.getElementById('pause-diff-hardcore'),
      splashDiffEasy: document.getElementById('splash-diff-easy'),
      splashDiffMedium: document.getElementById('splash-diff-medium'),
      splashDiffHardcore: document.getElementById('splash-diff-hardcore')
    };

    // Terminal typewriter timers & state
    this.termTypeTimer = null;
    this.termTyping = false;
    this.termFullText = "";

    // Pilot Callsign (Registered on Start Splash Screen)
    this.playerCallsign = (localStorage.getItem('deadsun_callsign') || 'PILOT').toUpperCase().slice(0, 8);

    // Difficulty — persisted across sessions
    const savedDiff = localStorage.getItem('deadsun_difficulty') || 'MEDIUM';
    this.difficulty = DIFFICULTY_PROFILES[savedDiff] ? savedDiff : 'MEDIUM';

    // Mobile Joystick Customization Settings
    this.joystickSettings = this.loadJoystickSettings();

    // Mobile Dual-Zone Touch State
    this.touchMode = 'AUTO'; // 'AUTO', 'ON', 'OFF'
    this.touchJoystick = {
      active: false,
      touchId: null,
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
      maxRadius: 46
    };
    this.scoreSubmitted = false;

    this.init();
  }

  loadBests() {
    try {
      const data = JSON.parse(localStorage.getItem('deadsun_bests') || '{}');
      return {
        dist: data.dist || 0,
        time: data.time || 0,
        shelters: data.shelters || 0
      };
    } catch {
      return { dist: 0, time: 0, shelters: 0 };
    }
  }

  saveBests() {
    try {
      this.bests.dist = Math.max(this.bests.dist, this.distance);
      this.bests.time = Math.max(this.bests.time, Math.round(this.elapsedTime * 10) / 10);
      this.bests.shelters = Math.max(this.bests.shelters, this.sheltersFound);
      localStorage.setItem('deadsun_bests', JSON.stringify(this.bests));
    } catch {}
  }

  async init() {
    // 1. Create PixiJS Application (1280x720)
    this.app = new PIXI.Application({
      width: V_WIDTH,
      height: V_HEIGHT,
      backgroundColor: 0x120c18,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true
    });

    this.dom.container.appendChild(this.app.view);
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // 2. Setup Container Layers
    this.skyLayer = new PIXI.Container();
    this.worldLayer = new PIXI.Container();
    this.terrainLayer = new PIXI.Container();
    this.hazardLayer = new PIXI.Container(); // Lava pools
    this.shadowLayer = new PIXI.Container();
    this.eclipseLayer = new PIXI.Graphics();
    this.particleLayer = new PIXI.Container();
    this.entityLayer = new PIXI.Container(); // Y-sorted obstacles and player
    this.fireLayer = new PIXI.Container();

    this.app.stage.addChild(this.skyLayer);
    this.app.stage.addChild(this.worldLayer);

    this.worldLayer.addChild(this.terrainLayer);
    this.worldLayer.addChild(this.hazardLayer);
    this.worldLayer.addChild(this.shadowLayer);
    this.worldLayer.addChild(this.eclipseLayer);
    this.worldLayer.addChild(this.particleLayer);
    this.worldLayer.addChild(this.entityLayer);
    this.worldLayer.addChild(this.fireLayer);

    // 3. Load PNG Assets
    await this.loadAssets();

    // 4. Setup Sky, Horizon, Sun & Eclipse Moon
    this.setupSkyAndSun();

    // 5. Setup Firestorm Graphics
    this.setupFirestorm();

    // 6. Setup Player Sprite
    this.setupPlayer();

    // 7. Setup Input & Event Handlers
    this.setupInputHandlers();

    // 8. Start Game Loop
    this.lastTime = performance.now();
    this.app.ticker.add(() => this.update());
  }

  handleResize() {
    const windowW = window.innerWidth || document.documentElement.clientWidth || 1280;
    const windowH = window.innerHeight || document.documentElement.clientHeight || 720;
    const aspect = windowW / windowH;

    // Expand virtual width to match screen aspect ratio, eliminating all black bars!
    this.vHeight = 720;
    this.vWidth = Math.round(this.vHeight * Math.max(16 / 9, aspect));

    // Scale to fit window height exactly (100% full screen coverage)
    const scale = windowH / this.vHeight;

    if (this.dom.container) {
      this.dom.container.style.width = `${this.vWidth}px`;
      this.dom.container.style.height = `${this.vHeight}px`;
      this.dom.container.style.transform = `scale(${scale})`;
    }

    if (this.app && this.app.renderer) {
      this.app.renderer.resize(this.vWidth, this.vHeight);
      if (this.skySprite) {
        this.skySprite.scale.set(this.vWidth / 4, 1.0);
      }
      if (this.horizonLine) {
        this.horizonLine.clear();
        this.horizonLine.lineStyle(1.5, 0x48162e, 0.95);
        this.horizonLine.moveTo(0, HORIZON_Y);
        this.horizonLine.lineTo(this.vWidth, HORIZON_Y);
      }
      if (this.sunContainer) {
        this.sunContainer.position.set(this.vWidth / 2, this.sunBaseY);
      }
    }
  }

  generateProceduralShelterTextures() {
    if (!this.app || !this.app.renderer) return;

    for (let id = 1; id <= 7; id++) {
      const spec = ASSET_SPECS[id];
      if (!spec) continue;

      // 1. Structure Graphics
      const structGfx = new PIXI.Graphics();
      this.drawProceduralShelterStructure(structGfx, id, spec.w, spec.solidH);
      const structTex = this.app.renderer.generateTexture(structGfx);

      // 2. Shadow Graphics
      const shadowGfx = new PIXI.Graphics();
      this.drawProceduralShelterShadow(shadowGfx, id, spec.w, spec.shadowH);
      const shadowTex = this.app.renderer.generateTexture(shadowGfx);

      this.shelterTextures[id] = {
        structure: structTex,
        shadow: shadowTex
      };
    }
  }

  drawProceduralShelterStructure(g, id, w, h) {
    g.clear();

    // Base armored carbon hull with beveled corners
    g.beginFill(0x1a1f2c, 1.0);
    g.lineStyle(3.5, 0xff7a22, 1.0); // Safety Orange Hazard Perimeter
    g.drawRoundedRect(8, 8, w - 16, h - 16, 14);
    g.endFill();

    // Inner bevel rim
    g.lineStyle(2, 0xffbe3a, 0.75);
    g.drawRoundedRect(14, 14, w - 28, h - 28, 10);

    if (id === 1) {
      // Type 1: High-Tech Communications & Solar Relay Outpost (Matching Reference Image 1 & 2)
      const cols = 5;
      const rows = 4;
      const gridW = w * 0.64;
      const gridH = h * 0.58;
      const startX = (w - gridW) / 2;
      const startY = (h - gridH) / 2 + 10;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = startX + c * (gridW / cols) + 3;
          const cy = startY + r * (gridH / rows) + 3;
          const cellW = (gridW / cols) - 6;
          const cellH = (gridH / rows) - 6;
          g.lineStyle(1, 0x111622);
          g.beginFill(0x101520);
          g.drawRect(cx, cy, cellW, cellH);
          g.endFill();
          g.beginFill(0xffcc44, 0.92);
          g.drawRoundedRect(cx + 2, cy + 2, cellW - 4, cellH - 4, 3);
          g.endFill();
        }
      }

      // Tall Communication Antenna Mast & Blue Sphere Orb
      const mastX = w * 0.38;
      g.lineStyle(3.5, 0x90a8be);
      g.moveTo(mastX, startY + 14);
      g.lineTo(mastX, 22);

      // Cyan Communications Orb
      g.lineStyle(0);
      g.beginFill(0x43e1ff);
      g.drawCircle(mastX, 20, 17);
      g.endFill();
      // Specular highlight
      g.beginFill(0xffffff, 0.9);
      g.drawCircle(mastX - 5, 15, 6);
      g.endFill();
      g.lineStyle(2, 0x88f0ff, 0.85);
      g.drawCircle(mastX, 20, 21);
    } else if (id === 2) {
      // Type 2: Compact Emergency Survival Bunker
      g.beginFill(0x101722);
      g.lineStyle(2, 0x43e1ff);
      g.drawRoundedRect(w * 0.22, h * 0.22, w * 0.56, h * 0.56, 8);
      g.endFill();
      // Airlock keypads and indicator
      g.beginFill(0x43e1ff);
      g.drawCircle(w * 0.5, h * 0.35, 7);
      g.endFill();
      // Warning Chevrons
      g.lineStyle(3, 0xffa020);
      g.moveTo(w * 0.32, h * 0.65);
      g.lineTo(w * 0.42, h * 0.52);
      g.moveTo(w * 0.48, h * 0.65);
      g.lineTo(w * 0.58, h * 0.52);
    } else if (id === 3) {
      // Type 3: Cryo-Cooling Monolith Station
      for (let p = 0; p < 3; p++) {
        const px = w * 0.28 + p * (w * 0.22);
        g.lineStyle(5, 0x14202e);
        g.moveTo(px, 20);
        g.lineTo(px, h - 20);
        g.lineStyle(2.5, 0x43e1ff);
        g.moveTo(px, 22);
        g.lineTo(px, h - 22);
      }
      g.lineStyle(2, 0xffcc44);
      g.drawRoundedRect(w * 0.2, h * 0.4, w * 0.6, h * 0.24, 4);
    } else if (id === 4) {
      // Type 4: Low-Profile Armored Pillbox Station
      g.lineStyle(2.5, 0xff8811);
      g.beginFill(0x222838);
      g.drawPolygon([
        w * 0.18, 20,
        w * 0.82, 20,
        w * 0.92, h - 20,
        w * 0.08, h - 20
      ]);
      g.endFill();
      // Thermal louvers
      g.lineStyle(2, 0xffbe3a);
      for (let i = 0; i < 4; i++) {
        const yPos = 32 + i * ((h - 64) / 3);
        g.moveTo(w * 0.28, yPos);
        g.lineTo(w * 0.72, yPos);
      }
    } else if (id === 5) {
      // Type 5: Double-Vault Atmospheric Shelter
      g.beginFill(0x222a3a);
      g.lineStyle(3, 0xff9c30);
      g.drawCircle(w * 0.32, h * 0.5, h * 0.36);
      g.drawCircle(w * 0.68, h * 0.5, h * 0.36);
      g.endFill();
      // Inter-vault conduit
      g.beginFill(0x161e2b);
      g.lineStyle(2, 0x43e1ff);
      g.drawRect(w * 0.35, h * 0.42, w * 0.3, h * 0.16);
      g.endFill();
    } else if (id === 6) {
      // Type 6: Heavy Fortress Shield Depot
      g.beginFill(0x141a26);
      g.lineStyle(3, 0xff8c1a);
      g.drawRect(w * 0.2, 18, w * 0.6, h - 36);
      g.endFill();
      g.lineStyle(2, 0x43e1ff);
      g.drawCircle(w * 0.5, h * 0.5, h * 0.22);
    } else {
      // Type 7: Rapid-Deploy Geodesic Survival Pod
      g.beginFill(0x202838);
      g.lineStyle(3, 0xffae34);
      g.drawEllipse(w * 0.5, h * 0.5, w * 0.38, h * 0.36);
      g.endFill();
      // Solar wings
      g.lineStyle(2, 0x43e1ff);
      g.moveTo(w * 0.15, h * 0.5);
      g.lineTo(w * 0.85, h * 0.5);
    }
  }

  drawProceduralShelterShadow(g, id, w, shadowH) {
    g.clear();
    // Authentic dark violet ground shadow
    g.beginFill(0x0c0716, 0.96);
    const pad = 12;
    g.drawPolygon([
      pad, 0,
      w - pad, 0,
      w + pad * 0.4, shadowH,
      -pad * 0.4, shadowH
    ]);
    g.endFill();

    // Inner core shadow
    g.beginFill(0x050209, 0.85);
    g.drawRoundedRect(pad + 6, 8, w - (pad * 2 + 12), shadowH - 16, 8);
    g.endFill();
  }

  createVectorAstronautTexture() {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();

    // 1. Life support oxygen backpack (behind)
    g.beginFill(0x182434);
    g.drawRoundedRect(-14, -42, 10, 24, 4);
    g.endFill();
    g.lineStyle(1.5, 0x43e1ff);
    g.moveTo(-9, -38);
    g.lineTo(-9, -22);

    // 2. Spacesuit Torso
    g.lineStyle(0);
    g.beginFill(0xf0f5f9);
    g.drawRoundedRect(-12, -38, 24, 28, 6);
    g.endFill();

    // Suit shaded contours
    g.beginFill(0xc8d8e6);
    g.drawRoundedRect(-12, -20, 24, 10, 4);
    g.endFill();

    // 3. Chest telemetry plate & harness
    g.beginFill(0x1a2636);
    g.drawRoundedRect(-8, -34, 16, 12, 3);
    g.endFill();

    // Cyan & Green telemetry LED indicators
    g.beginFill(0x43e1ff);
    g.drawCircle(-4, -28, 2.2);
    g.beginFill(0x58f888);
    g.drawCircle(4, -28, 2.2);
    g.endFill();

    // 4. Helmet Dome
    g.beginFill(0xffffff);
    g.drawCircle(0, -44, 14);
    g.endFill();
    g.beginFill(0x2a3848);
    g.drawRoundedRect(-11, -33, 22, 5, 2); // collar ring
    g.endFill();

    // 5. Gold Reflective Visor
    g.beginFill(0xffaa11);
    g.drawRoundedRect(-9, -49, 18, 11, 4);
    g.endFill();
    g.beginFill(0xffdd66, 0.85);
    g.drawEllipse(-3, -46, 5, 2.5); // curved visor highlight
    g.endFill();
    g.beginFill(0xffffff, 0.9);
    g.drawCircle(-4, -46, 1.5); // specular glint
    g.endFill();

    // 6. Arms & Utility Gloves
    g.beginFill(0xe0edf6);
    g.drawRoundedRect(-15, -34, 5, 16, 2.5);
    g.drawRoundedRect(10, -34, 5, 16, 2.5);
    g.endFill();
    g.beginFill(0x2e3d4d);
    g.drawRoundedRect(-15, -20, 5, 6, 2);
    g.drawRoundedRect(10, -20, 5, 6, 2);
    g.endFill();

    // 7. Legs & Magnetic Boots
    g.beginFill(0xd2e0ed);
    g.drawRoundedRect(-10, -14, 8, 14, 3);
    g.drawRoundedRect(2, -14, 8, 14, 3);
    g.endFill();

    // Treaded magnetic lunar boots with orange hazard accents
    g.beginFill(0x253242);
    g.drawRoundedRect(-12, -2, 10, 6, 2);
    g.drawRoundedRect(2, -2, 10, 6, 2);
    g.endFill();
    g.beginFill(0xff7a22);
    g.drawRect(-11, 2, 8, 1.5);
    g.drawRect(3, 2, 8, 1.5);
    g.endFill();

    c.addChild(g);
    return this.app.renderer.generateTexture(c);
  }

  async loadAssets() {
    // 1. Generate ultra-crisp procedural shelter and astronaut textures FIRST
    // This guarantees the game renders 100% reliably even on slow network / Render / offline!
    this.generateProceduralShelterTextures();
    this.textures.astronautVector = this.createVectorAstronautTexture();

    const assetFiles = [
      { name: 'sun', url: 'sun.png' },
      { name: 'sun_glow', url: 'sun_glow.png' },
      { name: 'sky_bg', url: 'background_scene_for_sun.png' },
      { name: 'fire_wall', url: 'giant_approaching1.png' },
      { name: 'astronaut', url: 'astronaut.png' },
      { name: 'asset1', url: 'asset1.png' },
      { name: 'asset2', url: 'asset2.png' },
      { name: 'asset3', url: 'asset3.png' },
      { name: 'asset4', url: 'asset4.png' },
      { name: 'asset5', url: 'asset5.png' },
      { name: 'asset6', url: 'asset6.png' },
      { name: 'asset7', url: 'asset7.png' }
    ];

    for (const item of assetFiles) {
      try {
        const tex = await PIXI.Assets.load(item.url);
        this.textures[item.name] = tex;
        if (item.name === 'astronaut') {
          this.isVectorPlayer = false;
        }
      } catch (err) {
        // Multi-tiered fallback loading via standard HTML Image element
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = item.url;
          });
          const baseTex = new PIXI.BaseTexture(img);
          this.textures[item.name] = new PIXI.Texture(baseTex);
          if (item.name === 'astronaut') {
            this.isVectorPlayer = false;
          }
        } catch (e) {
          // If astronaut fails, keep procedural astronaut texture
          if (item.name === 'astronaut') {
            this.textures.astronaut = this.textures.astronautVector;
            this.isVectorPlayer = true;
          }
        }
      }
    }

    // Split loaded PNG assets 1 to 7 into Structure (top) and Shadow (bottom) subtextures
    for (let id = 1; id <= 7; id++) {
      const baseTex = this.textures[`asset${id}`];
      const spec = ASSET_SPECS[id];
      if (baseTex && spec && baseTex.valid) {
        try {
          const structTex = new PIXI.Texture(
            baseTex.baseTexture,
            new PIXI.Rectangle(0, 0, spec.w, spec.solidH)
          );
          const shadowTex = new PIXI.Texture(
            baseTex.baseTexture,
            new PIXI.Rectangle(0, spec.solidH, spec.w, spec.h - spec.solidH)
          );
          this.shelterTextures[id] = {
            structure: structTex,
            shadow: shadowTex
          };
        } catch (e) {
          // Keep procedural texture
        }
      }
    }
  }

  setupSkyAndSun() {
    // 1. Single Continuous Smooth Sky Gradient (Zero bands, zero overlapping cuts, perfect continuity)
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 4;
    skyCanvas.height = 360;
    const sCtx = skyCanvas.getContext('2d');
    const sGrad = sCtx.createLinearGradient(0, 0, 0, 360);
    sGrad.addColorStop(0.0, '#0c071d');  // deep midnight purple-navy
    sGrad.addColorStop(0.40, '#180929'); // cosmic purple
    sGrad.addColorStop(0.72, '#2a0e28'); // dark plum maroon
    sGrad.addColorStop(1.0, '#3a1329');  // warm atmospheric horizon edge
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 4, 360);

    const skyTex = PIXI.Texture.from(skyCanvas);
    const skySprite = new PIXI.Sprite(skyTex);
    this.skySprite = skySprite;
    skySprite.scale.set((this.vWidth || V_WIDTH) / 4, 1.0);
    skySprite.position.set(0, 0);
    this.skyLayer.addChild(skySprite);

    // 2. Starfield (crisp specks scattered naturally throughout upper sky)
    const starsGfx = new PIXI.Graphics();
    let starRand = 1234567;
    const nextR = () => { starRand = (starRand * 16807) % 2147483647; return (starRand - 1) / 2147483646; };
    const starW = Math.max(2400, (this.vWidth || V_WIDTH) * 2);
    for (let i = 0; i < 95; i++) {
      const sx = nextR() * starW;
      const sy = nextR() * (HORIZON_Y - 14);
      const r = nextR() < 0.15 ? 1.4 : (nextR() < 0.5 ? 0.9 : 0.6);
      const a = 0.25 + nextR() * 0.65;
      starsGfx.beginFill(0xffffff, a);
      starsGfx.drawCircle(sx, sy, r);
      starsGfx.endFill();
    }
    this.skyLayer.addChild(starsGfx);

    // 3. Glowing Red Giant Sun in Center (Matching Image 3: crisp defined core disc + soft atmospheric halo)
    this.sunContainer = new PIXI.Container();
    this.sunContainer.position.set((this.vWidth || V_WIDTH) / 2, this.sunBaseY);

    // Layer A: Soft Atmospheric Halo Bloom (radiates smoothly into deep space)
    const haloR = 90;
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = haloR * 2;
    haloCanvas.height = haloR * 2;
    const hCtx = haloCanvas.getContext('2d');
    const hGrad = hCtx.createRadialGradient(haloR, haloR, 0, haloR, haloR, haloR);
    hGrad.addColorStop(0.0, 'rgba(255, 95, 20, 0.70)');
    hGrad.addColorStop(0.38, 'rgba(255, 75, 18, 0.48)'); // at disc boundary (radius 35px)
    hGrad.addColorStop(0.62, 'rgba(220, 45, 15, 0.22)');
    hGrad.addColorStop(0.82, 'rgba(160, 20, 25, 0.07)');
    hGrad.addColorStop(1.0, 'rgba(70, 10, 25, 0.0)');
    hCtx.fillStyle = hGrad;
    hCtx.fillRect(0, 0, haloR * 2, haloR * 2);

    const haloTex = PIXI.Texture.from(haloCanvas);
    this.sunAtmosphereBloom = new PIXI.Sprite(haloTex);
    this.sunAtmosphereBloom.anchor.set(0.5);
    this.sunAtmosphereBloom.blendMode = PIXI.BLEND_MODES.ADD;
    this.sunContainer.addChild(this.sunAtmosphereBloom);

    // Layer B: Crisp Core Sun Disc (Radius 36px, sharp defined edge matching Image 3)
    const discR = 36;
    const discCanvas = document.createElement('canvas');
    discCanvas.width = (discR + 2) * 2;
    discCanvas.height = (discR + 2) * 2;
    const dCtx = discCanvas.getContext('2d');
    const dGrad = dCtx.createRadialGradient(discR + 2, discR + 2, 0, discR + 2, discR + 2, discR);
    dGrad.addColorStop(0.0, '#ff842c');  // bright luminous warm center
    dGrad.addColorStop(0.70, '#ff5816'); // rich burning solar orange
    dGrad.addColorStop(1.0, '#ff420a');  // crisp solid perimeter rim
    dCtx.fillStyle = dGrad;
    dCtx.beginPath();
    dCtx.arc(discR + 2, discR + 2, discR, 0, Math.PI * 2);
    dCtx.fill();

    const discTex = PIXI.Texture.from(discCanvas);
    this.sunCoreDisc = new PIXI.Sprite(discTex);
    this.sunCoreDisc.anchor.set(0.5);
    this.sunCoreDisc.blendMode = PIXI.BLEND_MODES.NORMAL;
    this.sunContainer.addChild(this.sunCoreDisc);

    // Layer C: Center White-Hot Specular Bloom (pulses during solar flares)
    this.sunWhiteFlare = new PIXI.Graphics();
    this.sunWhiteFlare.blendMode = PIXI.BLEND_MODES.ADD;
    this.sunWhiteFlare.beginFill(0xffffff, 0.35);
    this.sunWhiteFlare.drawCircle(0, 0, 18);
    this.sunWhiteFlare.endFill();
    this.sunWhiteFlare.alpha = 0.15;
    this.sunContainer.addChild(this.sunWhiteFlare);

    // Layer D: Eclipse Moon (Slides over Sun during Eclipse Event)
    this.eclipseMoon = new PIXI.Graphics();
    this.eclipseMoon.beginFill(0x050408, 0.98);
    this.eclipseMoon.drawCircle(0, 0, 38);
    this.eclipseMoon.endFill();
    this.eclipseMoon.position.set(-180, 0);
    this.eclipseMoon.alpha = 0;
    this.sunContainer.addChild(this.eclipseMoon);

    this.skyLayer.addChild(this.sunContainer);

    // 4. Horizon Dividing Line (single clean subtle dividing line)
    const horizonLine = new PIXI.Graphics();
    this.horizonLine = horizonLine;
    horizonLine.lineStyle(1.5, 0x48162e, 0.95);
    horizonLine.moveTo(0, HORIZON_Y);
    horizonLine.lineTo(this.vWidth || V_WIDTH, HORIZON_Y);
    this.skyLayer.addChild(horizonLine);

    // 5. Ground Terrain Base Fill (Continuous coverage)
    this.groundGfx = new PIXI.Graphics();
    this.groundGfx.beginFill(0x1f1325);
    this.groundGfx.drawRect(-4000, HORIZON_Y, 40000, (V_HEIGHT * 2));
    this.groundGfx.endFill();
    this.terrainLayer.addChild(this.groundGfx);
  }

  setupFirestorm() {
    this.fireContainer = new PIXI.Container();
    this.fireContainer.position.set(this.fire.x, 0);

    // 1. Solid & Gradient Magma Body (extends far to the left)
    this.fireBodyGfx = new PIXI.Graphics();
    this.fireContainer.addChild(this.fireBodyGfx);

    // 2. Texture overlay if available
    if (this.textures.fire_wall) {
      this.fireSprite = new PIXI.Sprite(this.textures.fire_wall);
      this.fireSprite.anchor.set(1.0, 0);
      this.fireSprite.scale.set(0.7, V_HEIGHT / this.textures.fire_wall.height);
      this.fireSprite.blendMode = PIXI.BLEND_MODES.ADD;
      this.fireSprite.alpha = 0.65;
      this.fireContainer.addChild(this.fireSprite);
    }

    // 3. Jagged Zigzag Leading Wave Line (Thick glowing boundary from video & screenshot)
    this.fireZigzagGfx = new PIXI.Graphics();
    this.fireContainer.addChild(this.fireZigzagGfx);

    // 4. Floating Magma / Ember Bubbles inside the flame column
    this.fireBubbles = [];
    this.bubbleContainer = new PIXI.Container();
    for (let i = 0; i < 35; i++) {
      const r = 3.5 + Math.random() * 9.5;
      const bGfx = new PIXI.Graphics();
      const color = Math.random() < 0.35 ? 0xffffff : (Math.random() < 0.6 ? 0xffe66d : 0xff9422);
      bGfx.beginFill(color, 0.85);
      bGfx.drawCircle(0, 0, r);
      bGfx.endFill();

      const bubble = {
        gfx: bGfx,
        xRel: -160 + Math.random() * 145,
        y: Math.random() * V_HEIGHT,
        speed: 55 + Math.random() * 85,
        phase: Math.random() * Math.PI * 2
      };
      bGfx.position.set(bubble.xRel, bubble.y);
      this.bubbleContainer.addChild(bGfx);
      this.fireBubbles.push(bubble);
    }
    this.fireContainer.addChild(this.bubbleContainer);

    // 5. Ambient Silky Gradient Light Spill onto the Desert (Zero hard vertical lines)
    const glowW = 320;
    const glowH = 64;
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowW;
    glowCanvas.height = glowH;
    const gCtx = glowCanvas.getContext('2d');
    const lGrad = gCtx.createLinearGradient(0, 0, glowW, 0);
    lGrad.addColorStop(0.0, 'rgba(255, 110, 15, 0.42)');
    lGrad.addColorStop(0.12, 'rgba(255, 75, 10, 0.30)');
    lGrad.addColorStop(0.30, 'rgba(230, 45, 8, 0.16)');
    lGrad.addColorStop(0.55, 'rgba(175, 25, 12, 0.07)');
    lGrad.addColorStop(0.80, 'rgba(110, 12, 18, 0.02)');
    lGrad.addColorStop(1.0, 'rgba(50, 5, 20, 0.0)');
    gCtx.fillStyle = lGrad;
    gCtx.fillRect(0, 0, glowW, glowH);

    const glowTex = PIXI.Texture.from(glowCanvas);
    this.fireGlowSprite = new PIXI.Sprite(glowTex);
    this.fireGlowSprite.blendMode = PIXI.BLEND_MODES.ADD;
    this.fireGlowSprite.scale.set(1.0, V_HEIGHT / glowH);
    this.fireGlowSprite.position.set(0, 0);
    this.fireContainer.addChild(this.fireGlowSprite);

    this.fireLayer.addChild(this.fireContainer);
  }

  setupPlayer() {
    this.playerContainer = new PIXI.Container();

    // Feet Shadow
    const feetShadow = new PIXI.Graphics();
    feetShadow.beginFill(0x000000, 0.45);
    feetShadow.drawEllipse(0, 0, 22, 10);
    feetShadow.endFill();
    this.playerContainer.addChild(feetShadow);

    // Astronaut Sprite
    if (this.textures.astronaut && !this.isVectorPlayer) {
      this.playerSprite = new PIXI.Sprite(this.textures.astronaut);
      this.playerSprite.anchor.set(0.5, 0.88);
      this.playerSprite.scale.set(0.064);
    } else {
      const astronautTex = this.textures.astronautVector || this.createVectorAstronautTexture();
      this.playerSprite = new PIXI.Sprite(astronautTex);
      this.playerSprite.anchor.set(0.5, 0.88);
      this.playerSprite.scale.set(1.22);
      this.isVectorPlayer = true;
    }
    this.playerContainer.addChild(this.playerSprite);

    // Cyan Oxygen Tank Glow indicator
    this.tankGlow = new PIXI.Graphics();
    this.tankGlow.beginFill(0x43e1ff, 0.75);
    this.tankGlow.drawCircle(-12, -26, 6);
    this.tankGlow.endFill();
    this.playerContainer.addChild(this.tankGlow);

    this.playerContainer.position.set(this.player.x, this.player.y);
    this.entityLayer.addChild(this.playerContainer);
  }

  createVectorAstronaut() {
    const g = new PIXI.Graphics();
    // Life support pack (behind)
    g.beginFill(0x2a3b4c);
    g.drawRoundedRect(-14, -42, 10, 24, 4);
    g.endFill();

    // Suit Torso
    g.beginFill(0xedf4f8);
    g.drawRoundedRect(-12, -38, 24, 28, 6);
    g.endFill();

    // Suit Chest Plate / Insignia
    g.beginFill(0x1a2b38);
    g.drawRoundedRect(-8, -34, 16, 12, 3);
    g.endFill();
    g.beginFill(0x43e1ff);
    g.drawCircle(-4, -28, 2);
    g.beginFill(0x58f888);
    g.drawCircle(4, -28, 2);
    g.endFill();

    // Helmet Dome
    g.beginFill(0xffffff);
    g.drawCircle(0, -44, 14);
    g.endFill();

    // Gold Reflective Visor
    g.beginFill(0xffaa22);
    g.drawRoundedRect(-8, -48, 16, 10, 4);
    g.endFill();
    g.beginFill(0xffe688, 0.7);
    g.drawEllipse(-3, -46, 4, 2);
    g.endFill();

    // Legs and Boots
    g.beginFill(0xcadbe8);
    g.drawRoundedRect(-10, -14, 8, 14, 3);
    g.drawRoundedRect(2, -14, 8, 14, 3);
    g.endFill();
    g.beginFill(0x324050);
    g.drawRoundedRect(-12, -3, 10, 5, 2);
    g.drawRoundedRect(2, -3, 10, 5, 2);
    g.endFill();

    return g;
  }

  setupInputHandlers() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Start Audio on first interaction
      if (window.soundEngine) {
        window.soundEngine.init();
        window.soundEngine.resume();
      }

      if (e.code === 'KeyP') {
        this.togglePause();
      }

      if (e.code === 'KeyL') {
        if (this.state === 'SPLASH' || this.state === 'GAMEOVER') {
          this.showLeaderboard();
        }
      }

      if (e.code === 'Escape') {
        if (this.dom.leaderboardModal && !this.dom.leaderboardModal.classList.contains('hidden')) {
          this.closeLeaderboard();
        } else if (this.state === 'PLAYING' || this.paused) {
          this.togglePause();
        }
      }

      if (e.code === 'KeyR' && (this.state === 'GAMEOVER' || this.state === 'DYING')) {
        if (this.state === 'DYING') this.skipDeathAnimation();
        this.restartGame();
      }

      if ((e.code === 'KeyM' || e.code === 'KeyQ') && (this.state === 'GAMEOVER' || this.state === 'DYING')) {
        if (this.state === 'DYING') this.skipDeathAnimation();
        this.returnToMenu();
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        if (this.state === 'SPLASH') {
          e.preventDefault();
          this.startGame();
        } else if (this.state === 'DIALOGUE') {
          e.preventDefault();
          this.advanceDialogue();
        } else if (this.state === 'TUTORIAL') {
          e.preventDefault();
          this.closeTutorial();
        } else if (this.state === 'DYING') {
          e.preventDefault();
          this.skipDeathAnimation();
        } else if (this.state === 'GAMEOVER') {
          // If typing is active, skip it; otherwise don't interfere if focused on callsign input
          if (document.activeElement === this.dom.inputCallsign) {
            if (e.code === 'Enter') {
              e.preventDefault();
              this.submitScore();
            }
          } else {
            e.preventDefault();
            if (this.termTyping) {
              this.skipTerminalTypewriter();
            } else {
              this.restartGame();
            }
          }
        } else if (this.state === 'PLAYING' && e.code === 'Space') {
          e.preventDefault();
          this.triggerDash();
        }
      }
    });

    // Tap / Click anywhere during dialogue or death animation to advance
    window.addEventListener('click', (e) => {
      if (this.state === 'DIALOGUE') {
        this.advanceDialogue();
      } else if (this.state === 'DYING') {
        this.skipDeathAnimation();
      }
    });
    window.addEventListener('touchstart', (e) => {
      if (this.state === 'DIALOGUE') {
        this.advanceDialogue();
      } else if (this.state === 'DYING') {
        this.skipDeathAnimation();
      }
    }, { passive: true });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Global UI Button tactile audio feedback
    document.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.soundEngine && window.soundEngine.playButtonClick) {
          window.soundEngine.playButtonClick();
        }
      });
    });

    // UI Button bindings
    this.dom.btnStart.addEventListener('click', () => {
      if (window.soundEngine) {
        window.soundEngine.init();
        window.soundEngine.resume();
      }
      this.startGame();
    });

    this.dom.btnPause.addEventListener('click', () => this.togglePause());
    this.dom.btnResume.addEventListener('click', () => this.togglePause());

    this.dom.btnToggleMusic.addEventListener('click', () => {
      if (window.soundEngine) {
        const on = window.soundEngine.toggleMusic();
        this.dom.btnToggleMusic.innerText = `MUSIC: ${on ? 'ON' : 'OFF'}`;
      }
    });

    this.dom.btnToggleSfx.addEventListener('click', () => {
      if (window.soundEngine) {
        const on = window.soundEngine.toggleSfx();
        this.dom.btnToggleSfx.innerText = `SFX: ${on ? 'ON' : 'OFF'}`;
      }
    });

    this.dom.btnToggleQuality.addEventListener('click', () => {
      this.quality = this.quality === 'HIGH' ? 'LOW' : 'HIGH';
      this.dom.btnToggleQuality.innerText = `QUALITY: ${this.quality}`;
    });

    if (this.dom.btnToggleTouch) {
      this.dom.btnToggleTouch.addEventListener('click', () => {
        this.cycleTouchControlsMode();
      });
    }

    this.dom.btnGiveUp.addEventListener('click', () => {
      this.triggerDeath("GAVE UP UNDER THE DEAD SUN");
    });

    this.dom.btnRedeploy.addEventListener('click', () => this.restartGame());
    this.dom.btnMainMenu.addEventListener('click', () => this.returnToMenu());

    // ── Difficulty Button Wiring ──────────────────────────────────────────
    this._setupDifficultyButtons();

    this.dom.transmissionLayer.addEventListener('click', () => this.advanceDialogue());
    this.dom.tutorialCard.addEventListener('click', () => this.closeTutorial());

    // Callsign submission & Leaderboard bindings
    if (this.dom.btnSubmitScore) {
      this.dom.btnSubmitScore.addEventListener('click', () => this.submitScore());
    }
    if (this.dom.inputCallsign) {
      this.dom.inputCallsign.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.submitScore();
        }
      });
    }
    if (this.dom.btnTermLeaderboard) {
      this.dom.btnTermLeaderboard.addEventListener('click', () => this.showLeaderboard());
    }
    if (this.dom.btnSplashLeaderboard) {
      this.dom.btnSplashLeaderboard.addEventListener('click', () => this.showLeaderboard());
    }
    if (this.dom.btnCloseLeaderboard) {
      this.dom.btnCloseLeaderboard.addEventListener('click', () => this.closeLeaderboard());
    }
    if (this.dom.btnClearDatabase) {
      this.dom.btnClearDatabase.addEventListener('click', async () => {
        if (confirm("Wipe all cloud and local leaderboard database records?")) {
          await this.clearAllDatabaseAndLocalScores();
        }
      });
    }

    // Pre-game Pilot Registration on Start Splash Screen
    if (this.dom.splashCallsignInput) {
      this.dom.splashCallsignInput.value = this.playerCallsign;
      this.dom.splashCallsignInput.addEventListener('input', (e) => {
        let clean = e.target.value.toUpperCase().replace(/[^A-Z0-9_\-]/g, '').slice(0, 8);
        e.target.value = clean;
        this.playerCallsign = clean || 'PILOT';
        localStorage.setItem('deadsun_callsign', this.playerCallsign);
      });
      this.dom.splashCallsignInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.startGame();
        }
      });
    }

    // Initialize Mobile Touch Controls
    this.initTouchControls();
    this.applyJoystickSettings();
    this.setupControlsModalListeners();
    this.applyTouchMode();
  }

  /* =======================================================
     MOBILE TOUCH CONTROLS ENGINE
     ======================================================= */
  initTouchControls() {
    const zone = this.dom.joystickZone;
    const base = this.dom.joystickBase;
    const thumb = this.dom.joystickThumb;
    const dashBtn = this.dom.touchBtnDash;

    if (!zone || !base || !thumb || !dashBtn) return;

    // 1. Virtual Joystick Touch Tracking
    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.touchJoystick.active) return;
      if (window.soundEngine) {
        window.soundEngine.init();
        window.soundEngine.resume();
      }

      const touch = e.changedTouches[0];
      this.touchJoystick.active = true;
      this.touchJoystick.touchId = touch.identifier;

      const rect = base.getBoundingClientRect();
      this.touchJoystick.startX = rect.left + rect.width / 2;
      this.touchJoystick.startY = rect.top + rect.height / 2;

      thumb.classList.add('active');
      this.updateJoystickPos(touch.clientX, touch.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!this.touchJoystick.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.touchJoystick.touchId) {
          e.preventDefault();
          this.updateJoystickPos(t.clientX, t.clientY);
          break;
        }
      }
    }, { passive: false });

    const endJoystickTouch = (e) => {
      if (!this.touchJoystick.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.touchJoystick.touchId) {
          this.resetJoystick();
          break;
        }
      }
    };

    window.addEventListener('touchend', endJoystickTouch);
    window.addEventListener('touchcancel', endJoystickTouch);

    // Desktop Mouse Drag Fallback for testing joystick
    let isMouseDown = false;
    zone.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isMouseDown = true;
      this.touchJoystick.active = true;
      const rect = base.getBoundingClientRect();
      this.touchJoystick.startX = rect.left + rect.width / 2;
      this.touchJoystick.startY = rect.top + rect.height / 2;
      thumb.classList.add('active');
      this.updateJoystickPos(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      this.updateJoystickPos(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      if (isMouseDown) {
        isMouseDown = false;
        this.resetJoystick();
      }
    });

    // 2. Dash Button Touch Handling
    dashBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      dashBtn.classList.add('active');
      if (window.soundEngine) {
        window.soundEngine.init();
        window.soundEngine.resume();
      }
      if (this.state === 'PLAYING') {
        this.triggerDash();
      }
    }, { passive: false });

    const endDashTouch = (e) => {
      e.preventDefault();
      dashBtn.classList.remove('active');
    };

    dashBtn.addEventListener('touchend', endDashTouch);
    dashBtn.addEventListener('touchcancel', endDashTouch);

    // Desktop Mouse Click on Dash Button
    dashBtn.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.state === 'PLAYING') {
        dashBtn.classList.add('active');
        this.triggerDash();
      }
    });
    dashBtn.addEventListener('mouseup', () => dashBtn.classList.remove('active'));
    dashBtn.addEventListener('mouseleave', () => dashBtn.classList.remove('active'));
  }

  updateJoystickPos(clientX, clientY) {
    const dx = clientX - this.touchJoystick.startX;
    const dy = clientY - this.touchJoystick.startY;
    const dist = Math.hypot(dx, dy);
    const maxR = this.touchJoystick.maxRadius;

    let clampedX = dx;
    let clampedY = dy;
    if (dist > maxR) {
      clampedX = (dx / dist) * maxR;
      clampedY = (dy / dist) * maxR;
    }

    if (this.dom.joystickThumb) {
      this.dom.joystickThumb.style.left = `calc(50% + ${clampedX}px)`;
      this.dom.joystickThumb.style.top = `calc(50% + ${clampedY}px)`;
    }

    this.touchJoystick.x = clampedX / maxR;
    this.touchJoystick.y = clampedY / maxR;
  }

  resetJoystick() {
    this.touchJoystick.active = false;
    this.touchJoystick.touchId = null;
    this.touchJoystick.x = 0;
    this.touchJoystick.y = 0;
    if (this.dom.joystickThumb) {
      this.dom.joystickThumb.style.left = '50%';
      this.dom.joystickThumb.style.top = '50%';
      this.dom.joystickThumb.classList.remove('active');
    }
  }

  cycleTouchControlsMode() {
    if (this.touchMode === 'AUTO') {
      this.touchMode = 'ON';
    } else if (this.touchMode === 'ON') {
      this.touchMode = 'OFF';
    } else {
      this.touchMode = 'AUTO';
    }
    this.applyTouchMode();
  }

  applyTouchMode() {
    if (this.dom.btnToggleTouch) {
      this.dom.btnToggleTouch.innerText = `TOUCH CONTROLS: ${this.touchMode}`;
    }

    const layer = this.dom.touchControlsLayer;
    if (!layer) return;

    if (this.touchMode === 'ON') {
      document.body.classList.add('touch-enabled');
      layer.style.display = 'block';
    } else if (this.touchMode === 'OFF') {
      document.body.classList.remove('touch-enabled');
      layer.style.display = 'none';
    } else {
      // AUTO detection
      const isTouch = ('ontouchstart' in window) ||
                      (navigator.maxTouchPoints > 0) ||
                      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      if (isTouch) {
        document.body.classList.add('touch-enabled');
        layer.style.display = 'block';
      } else {
        document.body.classList.remove('touch-enabled');
        layer.style.display = '';
      }
    }
  }

  /* =======================================================
     DIFFICULTY SYSTEM
     ======================================================= */
  _setupDifficultyButtons() {
    // Refresh UI to match saved difficulty
    this._syncDifficultyUI();

    // Splash buttons
    const splashBtns = [this.dom.splashDiffEasy, this.dom.splashDiffMedium, this.dom.splashDiffHardcore];
    splashBtns.forEach(btn => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        this._setDifficulty(btn.dataset.diff);
      });
    });

    // Pause menu buttons
    const pauseBtns = [this.dom.pauseDiffEasy, this.dom.pauseDiffMedium, this.dom.pauseDiffHardcore];
    pauseBtns.forEach(btn => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        this._setDifficulty(btn.dataset.diff);
        if (window.soundEngine) window.soundEngine.playUIClick?.();
      });
    });
  }

  _setDifficulty(diffKey) {
    if (!DIFFICULTY_PROFILES[diffKey]) return;
    this.difficulty = diffKey;
    localStorage.setItem('deadsun_difficulty', diffKey);
    this._syncDifficultyUI();
  }

  _syncDifficultyUI() {
    const d = this.difficulty;

    // Pause buttons — toggle .diff-active class
    const pauseMap = { EASY: this.dom.pauseDiffEasy, MEDIUM: this.dom.pauseDiffMedium, HARDCORE: this.dom.pauseDiffHardcore };
    Object.entries(pauseMap).forEach(([key, btn]) => {
      if (!btn) return;
      btn.classList.toggle('diff-active', key === d);
    });

    // Splash buttons — toggle .sdiff-selected class
    const splashMap = { EASY: this.dom.splashDiffEasy, MEDIUM: this.dom.splashDiffMedium, HARDCORE: this.dom.splashDiffHardcore };
    Object.entries(splashMap).forEach(([key, btn]) => {
      if (!btn) return;
      btn.classList.toggle('sdiff-selected', key === d);
    });
  }

  /* =======================================================
     MOBILE JOYSTICK & CONTROLS CUSTOMIZATION ENGINE
     ======================================================= */
  loadJoystickSettings() {

    const defaults = {
      size: 100,
      side: 'left',
      offsetX: 24,
      offsetY: 24,
      dashSize: 100
    };
    try {
      const saved = localStorage.getItem('deadsun_joystick_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          size: typeof parsed.size === 'number' ? Math.max(70, Math.min(160, parsed.size)) : defaults.size,
          side: (parsed.side === 'right' || parsed.side === 'left') ? parsed.side : defaults.side,
          offsetX: typeof parsed.offsetX === 'number' ? Math.max(10, Math.min(140, parsed.offsetX)) : defaults.offsetX,
          offsetY: typeof parsed.offsetY === 'number' ? Math.max(10, Math.min(140, parsed.offsetY)) : defaults.offsetY,
          dashSize: typeof parsed.dashSize === 'number' ? Math.max(70, Math.min(150, parsed.dashSize)) : defaults.dashSize
        };
      }
    } catch (e) {
      console.warn("Failed to load joystick settings", e);
    }
    return defaults;
  }

  saveJoystickSettings() {
    try {
      localStorage.setItem('deadsun_joystick_settings', JSON.stringify(this.joystickSettings));
    } catch (e) {
      console.warn("Failed to save joystick settings", e);
    }
  }

  applyJoystickSettings() {
    const s = this.joystickSettings;
    const jZone = this.dom.joystickZone;
    const jBase = this.dom.joystickBase;
    const jThumb = this.dom.joystickThumb;
    const aZone = this.dom.actionZone;
    const dashBtn = this.dom.touchBtnDash;

    if (!jZone || !jBase || !jThumb || !aZone || !dashBtn) return;

    const joyScale = s.size / 100;
    const baseDim = Math.round(130 * joyScale);
    const thumbDim = Math.round(52 * joyScale);
    const jZoneDim = Math.max(baseDim + 20, 150);
    this.touchJoystick.maxRadius = Math.round(46 * joyScale);

    const dashScale = s.dashSize / 100;
    const dashDim = Math.round(96 * dashScale);
    const aZoneDim = Math.max(dashDim + 20, 150);

    // Size updates
    jZone.style.width = `${jZoneDim}px`;
    jZone.style.height = `${jZoneDim}px`;
    jBase.style.width = `${baseDim}px`;
    jBase.style.height = `${baseDim}px`;
    jThumb.style.width = `${thumbDim}px`;
    jThumb.style.height = `${thumbDim}px`;

    aZone.style.width = `${aZoneDim}px`;
    aZone.style.height = `${aZoneDim}px`;
    dashBtn.style.width = `${dashDim}px`;
    dashBtn.style.height = `${dashDim}px`;

    const icon = dashBtn.querySelector('.touch-dash-icon');
    const label = dashBtn.querySelector('.touch-dash-label');
    if (icon) icon.style.fontSize = `${Math.round(26 * dashScale)}px`;
    if (label) label.style.fontSize = `${Math.round(11 * dashScale)}px`;

    // Position updates
    if (s.side === 'right') {
      // Southpaw: Joystick on Right, Dash on Left
      jZone.style.left = 'auto';
      jZone.style.right = `calc(${s.offsetX}px + env(safe-area-inset-right, 0px))`;
      jZone.style.bottom = `calc(${s.offsetY}px + env(safe-area-inset-bottom, 0px))`;

      aZone.style.right = 'auto';
      aZone.style.left = `calc(${s.offsetX}px + env(safe-area-inset-left, 0px))`;
      aZone.style.bottom = `calc(${s.offsetY}px + env(safe-area-inset-bottom, 0px))`;
    } else {
      // Default: Joystick on Left, Dash on Right
      jZone.style.right = 'auto';
      jZone.style.left = `calc(${s.offsetX}px + env(safe-area-inset-left, 0px))`;
      jZone.style.bottom = `calc(${s.offsetY}px + env(safe-area-inset-bottom, 0px))`;

      aZone.style.left = 'auto';
      aZone.style.right = `calc(${s.offsetX}px + env(safe-area-inset-right, 0px))`;
      aZone.style.bottom = `calc(${s.offsetY}px + env(safe-area-inset-bottom, 0px))`;
    }
  }

  updateControlsModalUI() {
    const s = this.joystickSettings;
    if (this.dom.sliderJoySize) this.dom.sliderJoySize.value = s.size;
    if (this.dom.valCtrlJoySize) this.dom.valCtrlJoySize.innerText = `${s.size}%`;

    if (this.dom.sliderJoyX) this.dom.sliderJoyX.value = s.offsetX;
    if (this.dom.valCtrlJoyX) this.dom.valCtrlJoyX.innerText = `${s.offsetX}px`;

    if (this.dom.sliderJoyY) this.dom.sliderJoyY.value = s.offsetY;
    if (this.dom.valCtrlJoyY) this.dom.valCtrlJoyY.innerText = `${s.offsetY}px`;

    if (this.dom.sliderDashSize) this.dom.sliderDashSize.value = s.dashSize;
    if (this.dom.valCtrlDashSize) this.dom.valCtrlDashSize.innerText = `${s.dashSize}%`;

    if (this.dom.btnSideLeft && this.dom.btnSideRight) {
      if (s.side === 'right') {
        this.dom.btnSideRight.classList.add('active');
        this.dom.btnSideLeft.classList.remove('active');
      } else {
        this.dom.btnSideLeft.classList.add('active');
        this.dom.btnSideRight.classList.remove('active');
      }
    }

    // Update preset pills active state
    if (this.dom.controlsModal) {
      const presetBtns = this.dom.controlsModal.querySelectorAll('.ctrl-preset-btn');
      presetBtns.forEach(btn => {
        const p = btn.getAttribute('data-preset');
        let matches = false;
        if (p === 'default' && s.size === 100 && s.side === 'left' && s.offsetX === 24 && s.offsetY === 24 && s.dashSize === 100) matches = true;
        else if (p === 'compact' && s.size === 80 && s.side === 'left' && s.offsetX === 16 && s.offsetY === 16 && s.dashSize === 85) matches = true;
        else if (p === 'large' && s.size === 130 && s.side === 'left' && s.offsetX === 32 && s.offsetY === 32 && s.dashSize === 120) matches = true;
        else if (p === 'southpaw' && s.size === 100 && s.side === 'right' && s.offsetX === 24 && s.offsetY === 24 && s.dashSize === 100) matches = true;

        if (matches) btn.classList.add('active');
        else btn.classList.remove('active');
      });
    }
  }

  openControlsModal() {
    if (!this.dom.controlsModal) return;
    if (this.state === 'PLAYING' && !this.paused) {
      this.togglePause();
    }
    document.body.classList.add('controls-customizing');
    this.dom.controlsModal.classList.remove('hidden');
    this.updateControlsModalUI();
  }

  closeControlsModal() {
    if (!this.dom.controlsModal) return;
    document.body.classList.remove('controls-customizing');
    this.dom.controlsModal.classList.add('hidden');
    this.applyTouchMode();
  }

  setupControlsModalListeners() {
    if (this.dom.btnPauseControls) {
      this.dom.btnPauseControls.addEventListener('click', () => this.openControlsModal());
    }
    if (this.dom.btnSplashControls) {
      this.dom.btnSplashControls.addEventListener('click', () => this.openControlsModal());
    }
    if (this.dom.btnCloseControlsX) {
      this.dom.btnCloseControlsX.addEventListener('click', () => {
        this.saveJoystickSettings();
        this.closeControlsModal();
      });
    }
    if (this.dom.btnSaveControls) {
      this.dom.btnSaveControls.addEventListener('click', () => {
        this.saveJoystickSettings();
        this.closeControlsModal();
      });
    }
    if (this.dom.btnResetControls) {
      this.dom.btnResetControls.addEventListener('click', () => {
        this.joystickSettings = {
          size: 100,
          side: 'left',
          offsetX: 24,
          offsetY: 24,
          dashSize: 100
        };
        this.applyJoystickSettings();
        this.updateControlsModalUI();
        this.saveJoystickSettings();
      });
    }

    // Sliders live preview
    if (this.dom.sliderJoySize) {
      this.dom.sliderJoySize.addEventListener('input', (e) => {
        this.joystickSettings.size = parseInt(e.target.value, 10);
        if (this.dom.valCtrlJoySize) this.dom.valCtrlJoySize.innerText = `${this.joystickSettings.size}%`;
        this.applyJoystickSettings();
        this.updateControlsModalUI();
      });
    }
    if (this.dom.sliderJoyX) {
      this.dom.sliderJoyX.addEventListener('input', (e) => {
        this.joystickSettings.offsetX = parseInt(e.target.value, 10);
        if (this.dom.valCtrlJoyX) this.dom.valCtrlJoyX.innerText = `${this.joystickSettings.offsetX}px`;
        this.applyJoystickSettings();
        this.updateControlsModalUI();
      });
    }
    if (this.dom.sliderJoyY) {
      this.dom.sliderJoyY.addEventListener('input', (e) => {
        this.joystickSettings.offsetY = parseInt(e.target.value, 10);
        if (this.dom.valCtrlJoyY) this.dom.valCtrlJoyY.innerText = `${this.joystickSettings.offsetY}px`;
        this.applyJoystickSettings();
        this.updateControlsModalUI();
      });
    }
    if (this.dom.sliderDashSize) {
      this.dom.sliderDashSize.addEventListener('input', (e) => {
        this.joystickSettings.dashSize = parseInt(e.target.value, 10);
        if (this.dom.valCtrlDashSize) this.dom.valCtrlDashSize.innerText = `${this.joystickSettings.dashSize}%`;
        this.applyJoystickSettings();
        this.updateControlsModalUI();
      });
    }

    // Side switch
    if (this.dom.btnSideLeft) {
      this.dom.btnSideLeft.addEventListener('click', () => {
        this.joystickSettings.side = 'left';
        this.applyJoystickSettings();
        this.updateControlsModalUI();
      });
    }
    if (this.dom.btnSideRight) {
      this.dom.btnSideRight.addEventListener('click', () => {
        this.joystickSettings.side = 'right';
        this.applyJoystickSettings();
        this.updateControlsModalUI();
      });
    }

    // Presets
    if (this.dom.controlsModal) {
      const presetBtns = this.dom.controlsModal.querySelectorAll('.ctrl-preset-btn');
      presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const p = btn.getAttribute('data-preset');
          if (p === 'default') {
            this.joystickSettings = { size: 100, side: 'left', offsetX: 24, offsetY: 24, dashSize: 100 };
          } else if (p === 'compact') {
            this.joystickSettings = { size: 80, side: 'left', offsetX: 16, offsetY: 16, dashSize: 85 };
          } else if (p === 'large') {
            this.joystickSettings = { size: 130, side: 'left', offsetX: 32, offsetY: 32, dashSize: 120 };
          } else if (p === 'southpaw') {
            this.joystickSettings = { size: 100, side: 'right', offsetX: 24, offsetY: 24, dashSize: 100 };
          }
          this.applyJoystickSettings();
          this.updateControlsModalUI();
        });
      });
    }
  }

  startGame() {
    // Register Pilot Callsign before beginning mission
    if (this.dom.splashCallsignInput) {
      const val = this.dom.splashCallsignInput.value.trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, '').slice(0, 8);
      this.playerCallsign = val || 'PILOT';
      localStorage.setItem('deadsun_callsign', this.playerCallsign);
    }
    this.dom.startSplash.classList.add('hidden');
    this.resetRun();

    // Start with Intro Transmission (Frames 01:22 - 01:26)
    this.state = 'DIALOGUE';
    this.startDialogueSequence(INTRO_DIALOGUE);
  }

  resetRun() {
    this.player.x = 280;
    this.player.y = 415;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.stamina = 3.0;
    this.player.dashTimer = 0;
    this.player.dashCooldown = 0;
    this.player.shelterTime = 0;
    this.player.inShade = true; // starts safely under shelter 1
    this.player.buffTimer = 0;
    this.player.hasBoots = false;

    this.heat = 0.0;
    this.distance = 0;
    this.elapsedTime = 0;
    this.sheltersFound = 1; // starts under shelter 1
    this.visitedShelterIds.clear();
    this.visitedShelterIds.add(1);

    // Reset Solar Flare — timer depends on difficulty
    const _dp = DIFFICULTY_PROFILES[this.difficulty] || DIFFICULTY_PROFILES.MEDIUM;
    this.solarFlareTimer = _dp.flareTimer;
    this.solarFlarePhase = 'IDLE';
    this.solarFlareDuration = 0;
    this.solarFlareIntensity = 0;
    this.solarFlareActive = false;
    if (this.dom.flareBanner) this.dom.flareBanner.classList.add('hidden');
    if (this.dom.solarFlareOverlay) this.dom.solarFlareOverlay.classList.add('hidden');

    this.fire.x = -450;
    // Apply difficulty profile to fire speed
    const diffProfile = DIFFICULTY_PROFILES[this.difficulty] || DIFFICULTY_PROFILES.MEDIUM;
    this.fire.baseSpeed = diffProfile.fireBaseSpeed;
    this.fire.speed = diffProfile.fireBaseSpeed;
    // Store active profile on instance for use in update loop
    this._diff = diffProfile;

    this.camera.x = 0;
    this.camera.y = 0;
    this.camera.targetX = 0;
    this.camera.targetY = 0;
    this.lastSpawnLane = -1;

    // Reset Obstacles, Lava, Supplies
    for (const obs of this.obstacles) {
      obs.structSprite.destroy();
      obs.shadowSprite.destroy();
    }
    this.obstacles = [];

    for (const lava of this.lavaPools) lava.gfx.destroy();
    this.lavaPools = [];

    for (const sup of this.supplies) sup.container.destroy();
    this.supplies = [];

    this.nextSpawnX = 420;
    this.nextLavaX = 650;
    this.nextSupplyX = 1300;
    this.lastPattern = -1;

    // Spawn start shelter (Asset 1 with blue sphere)
    this.spawnShelterOfType(1, 200, 210);

    // Spawn initial tactical formations ahead across all zones
    for (let i = 0; i < 5; i++) {
      this.spawnNextObstacle();
    }

    this.dom.tutorialCard.classList.add('hidden');
    this.dom.termGameOver.classList.add('hidden');
    this.dom.pauseMenu.classList.add('hidden');
    this.dom.critBanner.classList.add('hidden');
    if (this.dom.heatVignette) this.dom.heatVignette.style.opacity = '0';
    if (this.dom.container) this.dom.container.classList.remove('critical-heat-active');
    if (this.dom.supplyTracker) this.dom.supplyTracker.classList.add('hidden');

    // Clean up any remaining death decals, shockwaves, debris, particles & flames
    for (const d of this.deathDecals) { try { d.destroy(); } catch(e){} }
    this.deathDecals = [];
    for (const s of this.deathShockwaves) { try { s.gfx.destroy(); } catch(e){} }
    this.deathShockwaves = [];
    for (const p of this.deathParticles) { try { p.gfx.destroy(); } catch(e){} }
    this.deathParticles = [];
    for (const b of this.deathDebris) { try { b.gfx.destroy(); } catch(e){} }
    this.deathDebris = [];
    if (this.deathFlameGfx) { try { this.deathFlameGfx.destroy(); } catch(e){} this.deathFlameGfx = null; }

    if (this.dom.deathFlashOverlay) {
      this.dom.deathFlashOverlay.classList.add('hidden');
      this.dom.deathFlashOverlay.classList.remove('active', 'fade');
    }
    if (this.deathFlashTimer) {
      clearTimeout(this.deathFlashTimer);
      this.deathFlashTimer = null;
    }

    // Fully restore astronaut sprite & cyan oxygen tank glow
    if (this.playerSprite) {
      this.playerSprite.visible = true;
      this.playerSprite.alpha = 1.0;
      this.playerSprite.tint = 0xffffff;
      this.playerSprite.position.set(0, 0);
      this.playerSprite.scale.set(this.isVectorPlayer ? 1.0 : 0.052);
    }
    if (this.tankGlow) {
      this.tankGlow.visible = true;
      this.tankGlow.alpha = 0.65;
      this.tankGlow.scale.set(1.0);
    }

    if (this.termTypeTimer) {
      clearTimeout(this.termTypeTimer);
      this.termTypeTimer = null;
    }
    this.termTyping = false;

    this.dom.objText.innerText = "SEEK SHELTER";
    this.paused = false;
  }

  restartGame() {
    this.resetRun();
    this.startCountdownSequence();
  }

  returnToMenu() {
    this.dom.termGameOver.classList.add('hidden');
    this.dom.startSplash.classList.remove('hidden');
    this.state = 'SPLASH';
  }

  /* =======================================================
     COUNTDOWN SEQUENCE (Frames 01:27 - 01:32)
     ======================================================= */
  startCountdownSequence() {
    this.state = 'COUNTDOWN';

    // Show "OUTRUN THE FIRESTORM" banner
    this.dom.introBanner.innerText = "OUTRUN THE FIRESTORM";
    this.dom.introBanner.classList.remove('hidden');
    this.dom.introBanner.style.opacity = '1';

    setTimeout(() => {
      // Transition to "SHELTER FROM THE DYING SUN"
      this.dom.introBanner.innerText = "SHELTER FROM THE DYING SUN";
    }, 1300);

    setTimeout(() => {
      this.dom.introBanner.classList.add('hidden');
      this.runNumericCountdown();
    }, 2500);
  }

  runNumericCountdown() {
    if (this.state !== 'COUNTDOWN') return;
    let count = 3;
    this.dom.countdown.classList.remove('hidden');
    this.dom.countdown.innerText = `${count}`;

    if (window.soundEngine) window.soundEngine.playWarningBeep(520);

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        this.dom.countdown.innerText = `${count}`;
        if (window.soundEngine) window.soundEngine.playWarningBeep(520);
      } else if (count === 0) {
        this.dom.countdown.innerText = "GO";
        if (window.soundEngine) window.soundEngine.playWarningBeep(880);
      } else {
        clearInterval(timer);
        this.dom.countdown.classList.add('hidden');
        this.state = 'PLAYING';
      }
    }, 900);
  }

  /* =======================================================
     DIALOGUE SYSTEM (Frames 01:22 - 01:26)
     ======================================================= */
  startDialogueSequence(dialogueList) {
    this.currentDialogueList = dialogueList;
    this.dialogueStep = 0;
    if (this.dom.transmissionLayer) {
      this.dom.transmissionLayer.classList.add('hidden');
    }
    this.showCurrentDialogueLine();

    if (window.soundEngine) {
      window.soundEngine.playRadioChirp();
      window.soundEngine.setLowpass(true);
    }
  }

  showCurrentDialogueLine() {
    if (!this.currentDialogueList || this.dialogueStep >= this.currentDialogueList.length) {
      this.closeDialogue();
      return;
    }

    const item = this.currentDialogueList[this.dialogueStep];
    this.dom.dialogueSpeaker.innerText = item.name;

    if (this.typewriterTimer) clearInterval(this.typewriterTimer);
    this.typewriterFull = item.text;
    this.typewriterCharIdx = 0;
    this.dom.dialogueText.textContent = "";

    // Render directly on the robot's head!
    const isCommand = item.speaker === 'COMMAND';
    const sender = isCommand ? 'STAR COMMAND' : 'PILOT (YOU)';
    const type = isCommand ? 'radio' : 'safe';
    this.showHeadMessage(item.text, sender, 999, type);

    this.typewriterTimer = setInterval(() => {
      if (this.typewriterCharIdx < this.typewriterFull.length) {
        this.typewriterCharIdx++;
        const sub = this.typewriterFull.substring(0, this.typewriterCharIdx);
        this.dom.dialogueText.textContent = sub;
        if (this.dom.headBubbleText) {
          this.dom.headBubbleText.textContent = sub;
        }
        if (window.soundEngine && this.typewriterCharIdx % 2 === 0) {
          window.soundEngine.playTypeClick();
        }
      } else {
        clearInterval(this.typewriterTimer);
        this.typewriterTimer = null;
        if (this.dom.headBubbleText) {
          this.dom.headBubbleText.innerHTML = `${this.escapeHtml(this.typewriterFull)}<div style="font-size:11px; color:#43e1ff; margin-top:5px; opacity:0.85; letter-spacing:0.06em;">TAP ANYWHERE TO CONTINUE &raquo;</div>`;
        }
      }
    }, 20);
  }

  advanceDialogue() {
    if (!this.currentDialogueList) return;
    if (this.typewriterTimer) {
      clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
      this.dom.dialogueText.textContent = this.typewriterFull;
      if (this.dom.headBubbleText) {
        this.dom.headBubbleText.textContent = this.typewriterFull;
      }
    } else {
      this.dialogueStep++;
      if (this.dialogueStep >= this.currentDialogueList.length) {
        this.closeDialogue();
      } else {
        this.showCurrentDialogueLine();
      }
    }
  }

  closeDialogue() {
    this.currentDialogueList = null;
    this.hideHeadMessage();
    if (this.dom.transmissionLayer) {
      this.dom.transmissionLayer.classList.add('hidden');
    }
    if (window.soundEngine) window.soundEngine.setLowpass(false);

    // After intro dialogue finishes, trigger the countdown sequence
    if (this.state === 'DIALOGUE') {
      this.startCountdownSequence();
    }
  }

  /* =======================================================
     NON-BLOCKING OBJECTIVE HINTS & NOTIFICATIONS
     ======================================================= */
  showTutorialCard(type) {
    this.activeTutorial = type;
    // Crucial: NEVER pause or change this.state to TUTORIAL!
    if (this.dom.objText) {
      if (type === 'cooling') {
        this.dom.objText.innerText = "SHELTER COOLS YOUR SUIT";
      } else if (type === 'overheating') {
        this.dom.objText.innerText = "HEAT CRITICAL: SEEK SHADE";
      } else if (type === 'supply') {
        this.dom.objText.innerText = "SCAVENGE THE SUPPLY CACHE";
      }
    }
  }

  closeTutorial() {
    this.activeTutorial = null;
  }

  /* =======================================================
     PROCEDURAL GENERATION: SHELTERS, LAVA & SUPPLIES
     ======================================================= */
  spawnShelterOfType(typeId, xPos, yLane) {
    const spec = ASSET_SPECS[typeId] || ASSET_SPECS[1];
    let subTex = this.shelterTextures[typeId];
    if (!subTex) {
      this.generateProceduralShelterTextures();
      subTex = this.shelterTextures[typeId];
    }
    if (!spec || !subTex) return null;

    const scale = 0.48;
    const totalW = spec.w * scale;
    const solidH = spec.solidH * scale;
    const shadowH = spec.shadowH * scale;

    const shadowSprite = new PIXI.Sprite(subTex.shadow);
    shadowSprite.position.set(xPos, yLane + solidH - 2);
    shadowSprite.scale.set(scale);
    shadowSprite.alpha = 0.95;
    this.shadowLayer.addChild(shadowSprite);

    const structSprite = new PIXI.Sprite(subTex.structure);
    structSprite.position.set(xPos, yLane);
    structSprite.scale.set(scale);
    this.entityLayer.addChild(structSprite);

    const obstacleObj = {
      id: this.obstacleIdCounter++,
      typeId,
      x: xPos,
      y: yLane,
      w: totalW,
      solidH,
      shadowH,
      structSprite,
      shadowSprite,
      collBox: {
        x: xPos + 2,
        y: yLane + 2,
        w: totalW - 4,
        h: solidH - 4
      },
      shadeBox: {
        x: xPos - 4,
        y: yLane + solidH - 6,
        w: totalW + 8,
        h: shadowH + 20
      }
    };
    this.obstacles.push(obstacleObj);
    return obstacleObj;
  }

  canSpawnObstacleAt(x, y, w, solidH) {
    const bufferX = 25;
    const bufferY = 20;
    for (const obs of this.obstacles) {
      const ox = obs.x;
      const oy = obs.y;
      const ow = obs.w || 150;
      const oh = obs.solidH || 80;
      if (x < ox + ow + bufferX &&
          x + w + bufferX > ox &&
          y < oy + oh + bufferY &&
          y + solidH + bufferY > oy) {
        return false;
      }
    }
    for (const lava of this.lavaPools) {
      if (Math.abs(x - lava.x) < 65 && Math.abs(y - lava.y) < 40) {
        return false;
      }
    }
    return true;
  }

  spawnNextObstacle() {
    // 7 Tactical Formations — Full vertical range PLAY_MIN_Y(175) to PLAY_MAX_Y(545)
    // Extreme Top: Y 148-168 | Extreme Bottom: Y 455-480 (solidH@0.48 keeps bottom edge ≤545)
    // Difficulty-aware: spacing offset and lava frequency from this._diff
    const patternList = [0, 1, 2, 3, 4, 5, 6];
    let pattern;
    do {
      pattern = patternList[Math.floor(Math.random() * patternList.length)];
    } while (pattern === this.lastPattern && patternList.length > 1);
    this.lastPattern = pattern;

    const baseX = this.nextSpawnX;
    // Difficulty spacing: positive = more gap (EASY), negative = tighter (HARDCORE)
    const spacing = (this._diff ? this._diff.obstacleSpacing : 0);
    // Lava frequency gate: returns true if this lava pool should spawn
    const lavaFreq = (this._diff ? this._diff.lavaFrequency : 1.0);
    const lavaCheck = () => Math.random() < lavaFreq;

    switch (pattern) {
      case 0: {
        // --- FORMATION 0: DUAL PINCER GATE ---
        // Top AND true-extreme-bottom obstacles simultaneously; narrow corridor in center
        const topType = [1, 3, 5, 6][Math.floor(Math.random() * 4)];
        const topY = 148 + Math.random() * 18; // 148–166
        this.spawnShelterOfType(topType, baseX, topY);

        const botType = [7, 4][Math.floor(Math.random() * 2)];
        const botX = baseX + 20 + Math.random() * 50;
        // True extreme bottom: solidH*0.48 for type7=60, type4=70 → safe at Y=470
        const botY = 460 + Math.random() * 18; // 460–478
        this.spawnShelterOfType(botType, botX, botY);

        // Lava pool mid-left to close the easy path
        if (lavaCheck()) this.spawnLavaPool(baseX + 80 + Math.random() * 40, 290 + Math.random() * 30);

        const maxW = Math.max((ASSET_SPECS[topType].w || 300) * 0.48, (ASSET_SPECS[botType].w || 250) * 0.48);
        this.nextSpawnX = Math.max(botX, baseX) + maxW + 150 + Math.random() * 60 + spacing;
        break;
      }

      case 1: {
        // --- FORMATION 1: EXTREME-BOTTOM ANCHOR + TOP LAVA ---
        // Forces player to find a safe mid-corridor while both extremes are blocked
        const lavaY = PLAY_MIN_Y + 5 + Math.random() * 15; // 180–195
        if (lavaCheck()) this.spawnLavaPool(baseX + 30, lavaY);

        // Second lava at extreme bottom
        if (lavaCheck()) this.spawnLavaPool(baseX + 55 + Math.random() * 30, 490 + Math.random() * 10);

        const midType = [2, 4, 5, 6][Math.floor(Math.random() * 4)];
        const midX = baseX + 120 + Math.random() * 40;
        const midY = 230 + Math.random() * 30; // 230–260
        this.spawnShelterOfType(midType, midX, midY);

        // Shelter at extreme bottom zone to create "graze" challenge
        const botType = [7][0];
        const botX = midX + 130 + Math.random() * 50;
        const botY = 462 + Math.random() * 15; // 462–477
        this.spawnShelterOfType(botType, botX, botY);

        this.nextSpawnX = botX + (ASSET_SPECS[botType].w * 0.48) + 140 + Math.random() * 50 + spacing;
        break;
      }

      case 2: {
        // --- FORMATION 2: INVERTED SLALOM (Top monolith → Mid shelter → Bottom lava) ---
        const topType = [1, 3, 6][Math.floor(Math.random() * 3)];
        const topY = 148 + Math.random() * 18; // 148–166
        this.spawnShelterOfType(topType, baseX, topY);

        const midType = [4, 7, 2][Math.floor(Math.random() * 3)];
        const midX = baseX + 140 + Math.random() * 50;
        const midY = 285 + Math.random() * 30; // 285–315
        this.spawnShelterOfType(midType, midX, midY);

        // True extreme-bottom lava pool
        if (lavaCheck()) this.spawnLavaPool(midX + 25 + Math.random() * 30, 492 + Math.random() * 10);

        this.nextSpawnX = midX + (ASSET_SPECS[midType].w * 0.48) + 140 + Math.random() * 50 + spacing;
        break;
      }

      case 3: {
        // --- FORMATION 3: CENTRAL CITADEL + EDGE SENTINELS ---
        const isTopSentinel = Math.random() < 0.5;
        const sentType = [7, 2][Math.floor(Math.random() * 2)];
        // Extreme top or true extreme bottom
        const sentY = isTopSentinel ? (148 + Math.random() * 18) : (462 + Math.random() * 15);
        this.spawnShelterOfType(sentType, baseX, sentY);

        const centerType = [1, 5, 3][Math.floor(Math.random() * 3)];
        const centerX = baseX + 120 + Math.random() * 40;
        const centerY = 248 + Math.random() * 30; // 248–278 (tight center)
        this.spawnShelterOfType(centerType, centerX, centerY);

        // Opposite extreme lava pool
        const oppLavaY = isTopSentinel ? (492 + Math.random() * 10) : (180 + Math.random() * 15);
        if (lavaCheck()) this.spawnLavaPool(centerX + 35 + Math.random() * 25, oppLavaY);

        this.nextSpawnX = centerX + (ASSET_SPECS[centerType].w * 0.48) + 140 + Math.random() * 50 + spacing;
        break;
      }

      case 4: {
        // --- FORMATION 4: FULL-RANGE CASCADE (Top → Center → True Bottom diagonal) ---
        const topFirst = Math.random() < 0.5;
        const yTop = 150 + Math.random() * 15;
        const yMid = 270 + Math.random() * 25; // center-ish
        const yBot = 460 + Math.random() * 16; // true extreme bottom
        const ySeq = topFirst ? [yTop, yMid, yBot] : [yBot, yMid, yTop];
        const typeSeq = topFirst ? [6, 4, 7] : [7, 4, 6];

        let currX = baseX;
        for (let s = 0; s < 3; s++) {
          const sType = typeSeq[s];
          this.spawnShelterOfType(sType, currX, ySeq[s]);
          // Wider horizontal gaps so they don't feel like a straight line
          currX += (ASSET_SPECS[sType].w * 0.48) * 0.65 + 90 + Math.random() * 35;
        }
        this.nextSpawnX = currX + 80 + Math.random() * 45 + spacing;
        break;
      }

      case 5: {
        // --- FORMATION 5: TWIN APEX + TRUE EXTREME BOTTOM HAZARD ---
        const s1Type = [3, 5, 6][Math.floor(Math.random() * 3)];
        const s1Y = 150 + Math.random() * 18;
        this.spawnShelterOfType(s1Type, baseX, s1Y);

        const s2Type = [7, 4][Math.floor(Math.random() * 2)];
        const s2X = baseX + 95 + Math.random() * 40;
        // True extreme bottom
        const s2Y = 460 + Math.random() * 16;
        this.spawnShelterOfType(s2Type, s2X, s2Y);

        // Close the mid-zone with a lava pool
        if (lavaCheck()) this.spawnLavaPool(baseX + 50 + Math.random() * 30, 300 + Math.random() * 40);

        const maxW = Math.max((ASSET_SPECS[s1Type].w || 300) * 0.48, (ASSET_SPECS[s2Type].w || 250) * 0.48);
        this.nextSpawnX = s2X + maxW + 150 + Math.random() * 55 + spacing;
        break;
      }

      case 6: {
        // --- FORMATION 6: TRIPLE THREAT GAUNTLET (Max Difficulty) ---
        // Three obstacles: extreme top + mid + extreme bottom — the hardest formation
        const topType = [6, 3][Math.floor(Math.random() * 2)];
        const topY = 148 + Math.random() * 18;
        this.spawnShelterOfType(topType, baseX, topY);

        const midType = [2, 4][Math.floor(Math.random() * 2)];
        const midX = baseX + 130 + Math.random() * 40;
        const midY = 268 + Math.random() * 20; // 268–288 (tight center, hard to pass)
        this.spawnShelterOfType(midType, midX, midY);

        const botType = [7][0];
        const botX = midX + 110 + Math.random() * 40;
        const botY = 462 + Math.random() * 14; // 462–476
        this.spawnShelterOfType(botType, botX, botY);

        // Lava pool between mid and bot to seal the bottom escape
        if (lavaCheck()) this.spawnLavaPool(midX + 30, 490 + Math.random() * 8);

        const maxW = Math.max(
          (ASSET_SPECS[topType].w || 300) * 0.48,
          (ASSET_SPECS[midType].w || 250) * 0.48,
          (ASSET_SPECS[botType].w || 200) * 0.48
        );
        this.nextSpawnX = botX + maxW + 160 + Math.random() * 60 + spacing;
        break;
      }
    }

    // Supply drop placement
    if (this.nextSpawnX > this.nextSupplyX) {
      const supY = 220 + Math.random() * 240;
      this.spawnSupplyDrop(this.nextSpawnX - 60, supY);
      this.nextSupplyX = this.nextSpawnX + 900 + Math.random() * 450;
    }
  }

  spawnLavaPool(x, y) {
    const rx = 56 + Math.random() * 16;
    const ry = 26 + Math.random() * 8;
    const isRadioactive = Math.random() < 0.45;
    const lavaGfx = new PIXI.Graphics();

    // 1. Soft atmospheric heat emission aura
    lavaGfx.beginFill(isRadioactive ? 0x39ff14 : 0xff4500, 0.18);
    lavaGfx.drawEllipse(0, 0, rx + 14, ry + 10);
    lavaGfx.endFill();

    // 2. Dark obsidian crust basin
    lavaGfx.beginFill(isRadioactive ? 0x051608 : 0x1c0902, 0.96);
    lavaGfx.drawEllipse(0, 0, rx, ry);
    lavaGfx.endFill();

    // 3. Glowing molten perimeter border
    lavaGfx.lineStyle(2.5, isRadioactive ? 0x39ff14 : 0xff7a18, 0.95);
    lavaGfx.drawEllipse(0, 0, rx, ry);

    // 4. Molten honeycomb magma cells
    const rows = 4;
    const cols = 7;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = (c - cols / 2 + 0.5) * (rx * 1.8 / cols) + (Math.random() * 4 - 2);
        const cy = (r - rows / 2 + 0.5) * (ry * 1.8 / rows) + (Math.random() * 4 - 2);
        // Only draw if within ellipse boundary
        if ((cx * cx) / ((rx - 8) * (rx - 8)) + (cy * cy) / ((ry - 8) * (ry - 8)) < 1.0) {
          const cellW = (rx * 1.7 / cols) * 0.74;
          const cellH = (ry * 1.7 / rows) * 0.74;
          let cellColor;
          if (isRadioactive) {
            cellColor = Math.random() < 0.35 ? 0xccff90 : (Math.random() < 0.7 ? 0x76ff03 : 0x4caf50);
          } else {
            cellColor = Math.random() < 0.35 ? 0xffda4a : (Math.random() < 0.7 ? 0xff9924 : 0xff5510);
          }
          lavaGfx.beginFill(cellColor, 0.92);
          lavaGfx.drawRoundedRect(cx - cellW / 2, cy - cellH / 2, cellW, cellH, 3);
          lavaGfx.endFill();
        }
      }
    }

    lavaGfx.position.set(x, y);
    this.hazardLayer.addChild(lavaGfx);

    this.lavaPools.push({
      x,
      y,
      rx,
      ry,
      radius: Math.max(rx, ry),
      gfx: lavaGfx
    });
  }

  spawnSupplyDrop(x, y) {
    const container = new PIXI.Container();
    container.position.set(x, y);

    // Glowing item capsule
    const capsule = new PIXI.Graphics();
    capsule.lineStyle(2, 0xffaa34, 0.95);
    capsule.beginFill(0x241406, 0.85);
    capsule.drawRoundedRect(-60, -14, 120, 28, 8);
    capsule.endFill();

    // Label
    const text = new PIXI.Text("ALL-TERRAIN BOOTS", {
      fontFamily: 'Orbitron',
      fontSize: 10,
      fontWeight: 'bold',
      fill: 0xffcc44,
      letterSpacing: 1.5
    });
    text.anchor.set(0.5);

    container.addChild(capsule);
    container.addChild(text);
    this.entityLayer.addChild(container);

    this.supplies.push({
      x,
      y,
      radius: 40,
      container,
      collected: false
    });

    this.dom.objText.innerText = "SCAVENGE THE SUPPLY CACHE";
    if (this.dom.supplyTracker) this.dom.supplyTracker.classList.remove('hidden');
  }

  /* =======================================================
     MOVEMENT, DASH & COLLISION
     ======================================================= */
  triggerDash() {
    if (this.player.stamina < 1.0 || this.player.dashCooldown > 0) return;

    this.player.stamina = Math.max(0, this.player.stamina - 1.0);
    this.player.dashTimer = DASH_DURATION;
    this.player.dashCooldown = DASH_COOLDOWN;
    this.player.isDashing = true;

    if (window.soundEngine) window.soundEngine.playDashWhoosh();
    this.camera.shakeIntensity = Math.max(this.camera.shakeIntensity, 4.5);
    this.spawnDashGhost();
  }

  spawnDashGhost() {
    if (!this.playerSprite) return;
    const ghost = new PIXI.Sprite(this.playerSprite.texture);
    ghost.position.set(this.player.x, this.player.y);
    ghost.scale.set(this.playerSprite.scale.x, this.playerSprite.scale.y);
    ghost.anchor.set(0.5, 0.88);
    ghost.tint = 0x43e1ff;
    ghost.alpha = 0.55;
    this.particleLayer.addChild(ghost);
    this.dashGhosts.push({ sprite: ghost, alpha: 0.55 });
  }

  resolveCircleAABBCollision(px, py, radius, box) {
    if (!box || box.w <= 0 || box.h <= 0) return { collided: false, pushX: 0, pushY: 0 };

    // 1. Check if circle center is inside the box
    const insideX = px >= box.x && px <= box.x + box.w;
    const insideY = py >= box.y && py <= box.y + box.h;

    if (insideX && insideY) {
      const distLeft = px - box.x;
      const distRight = (box.x + box.w) - px;
      const distTop = py - box.y;
      const distBottom = (box.y + box.h) - py;

      const minDist = Math.min(distLeft, distRight, distTop, distBottom);
      if (minDist === distLeft) {
        return { collided: true, pushX: -(distLeft + radius), pushY: 0 };
      } else if (minDist === distRight) {
        return { collided: true, pushX: (distRight + radius), pushY: 0 };
      } else if (minDist === distTop) {
        return { collided: true, pushX: 0, pushY: -(distTop + radius) };
      } else {
        return { collided: true, pushX: 0, pushY: (distBottom + radius) };
      }
    }

    // 2. Circle center is outside: find closest point on AABB
    const closestX = Math.max(box.x, Math.min(px, box.x + box.w));
    const closestY = Math.max(box.y, Math.min(py, box.y + box.h));

    const distX = px - closestX;
    const distY = py - closestY;
    const distSq = distX * distX + distY * distY;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      if (dist < 0.0001) {
        return { collided: true, pushX: 0, pushY: radius };
      }
      const overlap = radius - dist;
      return {
        collided: true,
        pushX: (distX / dist) * overlap,
        pushY: (distY / dist) * overlap
      };
    }

    return { collided: false, pushX: 0, pushY: 0 };
  }

  /* =======================================================
     MAIN UPDATE LOOP
     ======================================================= */
  update() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.paused || this.state === 'SPLASH' || this.state === 'GAMEOVER') return;

    // Update Sun Movement, Looming Descent, Corona Glow, and Solar Flare
    this.updateSunAndSolarFlare(dt);

    // Update Firestorm Jagged Zigzag Leading Edge & Magma Bubbles
    this.updateFirestorm(dt);

    if (this.state === 'PLAYING') {
      this.elapsedTime += dt;

      // 1. Movement Inputs (Keyboard + Touch Joystick)
      let moveX = 0;
      let moveY = 0;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) moveY -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) moveY += 1;

      if (this.touchJoystick && this.touchJoystick.active) {
        moveX += this.touchJoystick.x;
        moveY += this.touchJoystick.y;
      }

      const len = Math.hypot(moveX, moveY);
      if (len > 0) {
        // Clamp speed factor to 1.0 maximum, but allow subtle analog control if under 1.0
        const normFactor = len > 1.0 ? 1.0 / len : 1.0;
        moveX *= normFactor;
        moveY *= normFactor;
        this.player.facingX = moveX;
        this.player.facingY = moveY;
        if (this.playerSprite) {
          const baseScale = this.isVectorPlayer ? 1.0 : 0.052;
          this.playerSprite.scale.x = (moveX < 0 ? -1 : 1) * baseScale;
          this.playerSprite.scale.y = baseScale;
          this.playerSprite.y = Math.sin(this.elapsedTime * 14) * 1.8;
        }
        // Tactile astronaut regolith footstep cadence
        this.footstepTimer = (this.footstepTimer || 0) - dt;
        if (this.footstepTimer <= 0) {
          this.footstepTimer = this.player.isDashing ? 0.18 : 0.36;
          if (window.soundEngine && window.soundEngine.playFootstep) {
            window.soundEngine.playFootstep();
          }
        }
      } else {
        this.footstepTimer = 0.05;
        if (this.playerSprite) {
          this.playerSprite.y = 0;
        }
      }

      // 2. Dash & Buffs
      if (this.player.dashTimer > 0) {
        this.player.dashTimer -= dt;
        if (this.player.dashTimer <= 0) this.player.isDashing = false;
      }
      if (this.player.dashCooldown > 0) {
        this.player.dashCooldown -= dt;
      }

      if (this.player.buffTimer > 0) {
        this.player.buffTimer -= dt;
        if (this.player.buffTimer <= 0) this.player.hasBoots = false;
      }

      // Speed with Boots multiplier
      let speedMult = this.player.hasBoots ? 1.25 : 1.0;
      const currentSpeed = (this.player.isDashing ? PLAYER_DASH_SPEED : PLAYER_BASE_SPEED) * speedMult;
      this.player.vx = moveX * currentSpeed;
      this.player.vy = moveY * currentSpeed;

      this.player.x += this.player.vx * dt;
      this.player.y += this.player.vy * dt;
      this.player.y = Math.max(PLAY_MIN_Y, Math.min(PLAY_MAX_Y, this.player.y));

      // 3. Circle Collision against Solid Modules (2 relaxation passes for smooth sliding against walls)
      for (let pass = 0; pass < 2; pass++) {
        for (const obs of this.obstacles) {
          if (!obs.collBox) continue;
          const res = this.resolveCircleAABBCollision(
            this.player.x,
            this.player.y,
            PLAYER_COLLISION_RADIUS,
            obs.collBox
          );
          if (res.collided) {
            this.player.x += res.pushX;
            this.player.y += res.pushY;
          }
        }
      }

      this.playerContainer.position.set(this.player.x, this.player.y);

      // 4. Shade & Heat Mechanics (Shade cast below structures is 100% walkable and cooling)
      let insideShade = false;
      let matchedObstacleId = null;

      for (const obs of this.obstacles) {
        const s = obs.shadeBox;
        if (this.player.x >= s.x && this.player.x <= s.x + s.w &&
            this.player.y >= s.y && this.player.y <= s.y + s.h) {
          insideShade = true;
          matchedObstacleId = obs.id;
          break;
        }
      }

      // Eclipse Shelter
      if (this.eclipse.active) {
        if (this.player.x >= this.eclipse.x && this.player.x <= this.eclipse.x + this.eclipse.width) {
          insideShade = true;
        }
      }

      // Enter Shade Event
      if (insideShade && !this.player.inShade) {
        this.player.inShade = true;
        if (window.soundEngine) window.soundEngine.playShelterChime();
        this.showShadeQuip(true); // cooling quip

        if (matchedObstacleId && !this.visitedShelterIds.has(matchedObstacleId)) {
          this.visitedShelterIds.add(matchedObstacleId);
          this.sheltersFound++;

          // First time entering second shelter: show COOLING ONLINE tutorial (Frame 00:02)
          if (!this.tutorialsSeen.cooling && this.sheltersFound >= 2) {
            this.tutorialsSeen.cooling = true;
            this.showTutorialCard('cooling');
          }
        }
      } else if (!insideShade && this.player.inShade) {
        this.player.inShade = false;
        this.player.shelterTime = 0;
      }

      // Lava Hazards Collision (Accurate elliptical hit detection)
      if (!this.player.hasBoots) {
        for (const lava of this.lavaPools) {
          const rx = lava.rx || lava.radius || 55;
          const ry = lava.ry || (lava.radius * 0.5) || 26;
          const dx = this.player.x - lava.x;
          const dy = this.player.y - lava.y;
          if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) < 1.0) {
            this.heat = Math.min(1.0, this.heat + 0.75 * dt);
            this.camera.shakeIntensity = Math.max(this.camera.shakeIntensity, 4);
          }
        }
      }

      // Supply Drop Pickup
      for (const sup of this.supplies) {
        if (!sup.collected && Math.hypot(this.player.x - sup.x, this.player.y - sup.y) < sup.radius) {
          sup.collected = true;
          sup.container.destroy();
          this.player.hasBoots = true;
          this.player.buffTimer = 16.0;
          if (window.soundEngine) window.soundEngine.playShelterChime();
          this.dom.objText.innerText = "ALL-TERRAIN BOOTS ACTIVE!";
          setTimeout(() => {
            if (this.state === 'PLAYING') this.dom.objText.innerText = "SEEK SHELTER";
          }, 3500);
        }
      }

      // Heat & Stamina Progression
      if (this.player.inShade) {
        this.player.shelterTime += dt;
        const coolMult = Math.min(3.0, Math.pow(this.player.shelterTime, SHADE_COOL_EXP)) * (this.player.hasBoots ? 1.6 : 1.0);
        const _coolBase = (this._diff ? this._diff.shadeCoolBase : SHADE_COOL_BASE);
        this.heat = Math.max(0, this.heat - _coolBase * coolMult * dt);
        this.player.stamina = Math.min(MAX_STAMINA, this.player.stamina + STAMINA_REGEN_RATE * dt);
      } else {
        const _heatRate = (this._diff ? this._diff.heatRate : SUN_HEAT_RATE);
        this.heat = Math.min(1.0, this.heat + _heatRate * dt);

        // Heat quip timer when baking in open sun
        this.heatQuipTimer -= dt;
        if (this.heat >= 0.55 && this.heatQuipTimer <= 0) {
          this.heatQuipTimer = 7.0;
          this.showShadeQuip(false); // roasting quip
        }
      }

      // First time overheating: OVERHEATING Tutorial (Frame 00:29)
      if (this.heat >= 0.85 && !this.tutorialsSeen.overheating) {
        this.tutorialsSeen.overheating = true;
        this.showTutorialCard('overheating');
      }

      // Warning beeps
      if (this.heat >= 0.40) {
        this.heatBeepTimer -= dt;
        const interval = this.heat >= 0.85 ? 0.35 : (this.heat >= 0.65 ? 0.65 : 1.1);
        const freq = this.heat >= 0.85 ? 880 : (this.heat >= 0.65 ? 580 : 380);
        if (this.heatBeepTimer <= 0) {
          this.heatBeepTimer = interval;
          if (window.soundEngine) window.soundEngine.playWarningBeep(freq);
        }
      }

      // Overheat Death Check
      if (this.heat >= 1.0) {
        this.triggerDeath("INCINERATED BY THE RED GIANT");
      }

      // 5. Firestorm Progression
      const distToFire = this.player.x - this.fire.x;
      const forgiveness = Math.min(1.4, Math.max(0.85, distToFire / 500));
      this.fire.speed = (this.fire.baseSpeed + (this.distance / 100) * 2.2) * forgiveness;
      this.fire.x += this.fire.speed * dt;
      this.fireContainer.position.set(this.fire.x, 0);

      this.fire.proximity = Math.max(0, Math.min(1, 1 - distToFire / 650));

      if (distToFire < 240) {
        this.camera.shakeIntensity = Math.max(this.camera.shakeIntensity, (1 - distToFire / 240) * 8);
      }

      if (this.fire.x >= this.player.x - 10) {
        this.triggerDeath("CONSUMED BY THE FIRESTORM");
      }

      // 6. Metrics & Objectives
      this.distance = Math.max(this.distance, Math.floor((this.player.x - 240) / 10));

      // Objective vs Critical vs Flare banner display
      if (this.solarFlareActive || this.solarFlarePhase === 'WARNING') {
        this.dom.critBanner.classList.add('hidden');
        this.dom.objText.parentElement.style.opacity = '0';
      } else if (this.heat >= 0.65) {
        this.dom.critBanner.classList.remove('hidden');
        this.dom.objText.parentElement.style.opacity = '0';
      } else {
        this.dom.critBanner.classList.add('hidden');
        this.dom.objText.parentElement.style.opacity = '1';
      }

      // 7. Eclipse Event Handling (Frames 00:38 - 00:40)
      this.updateEclipse(dt);

      // 8. Procedural Obstacles & Despawning (Cull off-screen objects)
      if (this.player.x + 1400 > this.nextSpawnX) {
        this.spawnNextObstacle();
      }

      const cullX = Math.min(this.camera.x - 700, this.fire.x - 200);

      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i];
        if (obs.x + obs.w < cullX) {
          obs.structSprite.destroy();
          obs.shadowSprite.destroy();
          this.obstacles.splice(i, 1);
        }
      }

      for (let i = this.lavaPools.length - 1; i >= 0; i--) {
        const lava = this.lavaPools[i];
        if (lava.x + lava.radius < cullX) {
          lava.gfx.destroy();
          this.lavaPools.splice(i, 1);
        }
      }

      for (let i = this.supplies.length - 1; i >= 0; i--) {
        const sup = this.supplies[i];
        if (sup.x + sup.radius < cullX) {
          sup.container.destroy();
          this.supplies.splice(i, 1);
        }
      }

      // 9. Camera & Juice
      this.updateCamera(dt);
      this.updateParticles(dt);

      // 10. Entity Y-sorting
      this.entityLayer.children.sort((a, b) => a.position.y - b.position.y);

      // 11. Audio Engine
      if (window.soundEngine) {
        window.soundEngine.update(dt, this.heat, this.fire.proximity);
      }

      // 12. HUD
      this.updateHud();

      // 13. Real-time Head Message tracking (Always anchored directly on robot's head)
      if (this.activeHeadMessage) {
        this.activeHeadMessage.timer -= dt;
        if (this.activeHeadMessage.timer <= 0) {
          this.hideHeadMessage();
        } else {
          this.updateHeadMessagePosition();
        }
      }
    } else if (this.state === 'DIALOGUE') {
      this.updateCamera(dt);
      if (this.activeHeadMessage) {
        this.updateHeadMessagePosition();
      }
    } else if (this.state === 'DYING') {
      this.updateDeathSequence(dt);
      if (this.activeHeadMessage) {
        this.hideHeadMessage();
      }
    }
  }

  updateEclipse(dt) {
    this.eclipse.timer -= dt;
    if (this.eclipse.timer <= 0 && !this.eclipse.active) {
      this.eclipse.active = true;
      this.eclipse.x = this.camera.x - 650;
      this.eclipse.moonProgress = 0;
      if (window.soundEngine) window.soundEngine.playEclipseSwell();
    }

    if (this.eclipse.active) {
      this.eclipse.x += this.eclipse.speed * dt;

      // Celestial Moon moves across Sun
      const moonX = -70 + (this.eclipse.moonProgress * 140);
      this.eclipseMoon.position.x = moonX;
      this.eclipseMoon.alpha = 0.96;
      this.eclipse.moonProgress += dt * 0.08;

      // Draw dark shadow band on terrain
      this.eclipseLayer.clear();
      this.eclipseLayer.beginFill(0x05060a, 0.72);
      this.eclipseLayer.drawRect(this.eclipse.x, HORIZON_Y, this.eclipse.width, V_HEIGHT - HORIZON_Y);
      this.eclipseLayer.endFill();

      // Soft glowing border edges
      this.eclipseLayer.beginFill(0x43e1ff, 0.12);
      this.eclipseLayer.drawRect(this.eclipse.x - 24, HORIZON_Y, 24, V_HEIGHT - HORIZON_Y);
      this.eclipseLayer.drawRect(this.eclipse.x + this.eclipse.width, HORIZON_Y, 24, V_HEIGHT - HORIZON_Y);
      this.eclipseLayer.endFill();

      if (this.eclipse.x > this.camera.x + V_WIDTH + 450) {
        this.eclipse.active = false;
        this.eclipseLayer.clear();
        this.eclipseMoon.alpha = 0;
        this.eclipse.timer = 50 + Math.random() * 20;
      }
    }
  }

  updateSunAndSolarFlare(dt) {
    if (!this.sunContainer) return;
    const time = this.elapsedTime;
    const sunProgress = Math.min(1.0, this.distance / 750);

    // 1. Solar Flare State Machine
    if (this.state === 'PLAYING') {
      if (this.solarFlarePhase === 'IDLE') {
        this.solarFlareTimer -= dt;
        if (this.solarFlareTimer <= 0) {
          this.solarFlarePhase = 'WARNING';
          this.solarFlareDuration = 2.6;
          if (this.dom.flareText) this.dom.flareText.innerText = "SOLAR FLARE IMMINENT";
          if (this.dom.flareBanner) this.dom.flareBanner.classList.remove('hidden');
          if (window.soundEngine) window.soundEngine.playSolarFlareWarning();
          this.showShadeQuip(false); // warning quip
        }
      } else if (this.solarFlarePhase === 'WARNING') {
        this.solarFlareDuration -= dt;
        this.solarFlareIntensity = (2.6 - this.solarFlareDuration) / 2.6 * 0.5;
        if (this.solarFlareDuration <= 0) {
          this.solarFlarePhase = 'ERUPTING';
          this.solarFlareDuration = 7.0;
          this.solarFlareActive = true;
          if (this.dom.flareText) this.dom.flareText.innerText = "SOLAR FLARE SURGE";
          if (this.dom.solarFlareOverlay) this.dom.solarFlareOverlay.classList.remove('hidden');
          if (window.soundEngine) window.soundEngine.playSolarFlareRoar();
          this.camera.shakeIntensity = Math.max(this.camera.shakeIntensity, 6.0);
        }
      } else if (this.solarFlarePhase === 'ERUPTING') {
        this.solarFlareDuration -= dt;
        this.solarFlareIntensity = 1.0;
        // Heat multiplier during solar flare while exposed to direct sunlight
        if (!this.player.inShade) {
          this.heat = Math.min(1.0, this.heat + SUN_HEAT_RATE * 0.85 * dt);
        }
        if (this.solarFlareDuration <= 0) {
          this.solarFlarePhase = 'COOLDOWN';
          this.solarFlareDuration = 3.0;
          this.solarFlareActive = false;
          if (this.dom.flareBanner) this.dom.flareBanner.classList.add('hidden');
        }
      } else if (this.solarFlarePhase === 'COOLDOWN') {
        this.solarFlareDuration -= dt;
        this.solarFlareIntensity = Math.max(0, this.solarFlareDuration / 3.0);
        if (this.solarFlareDuration <= 0) {
          this.solarFlarePhase = 'IDLE';
          this.solarFlareTimer = 28.0 + Math.random() * 12;
          if (this.dom.solarFlareOverlay) this.dom.solarFlareOverlay.classList.add('hidden');
        }
      }
    }

    // 2. Horizontal Movement (Parallax with Camera + Ambient Drift)
    const targetX = (V_WIDTH / 2) - ((this.camera.x * 0.035) % (V_WIDTH * 0.4)) + Math.sin(time * 0.25) * 16;
    this.sunContainer.x += (targetX - this.sunContainer.x) * dt * 3;

    // 3. Vertical Descent (Getting closer to the player and horizon as distance/time increases)
    const targetY = this.sunBaseY + sunProgress * 56 + Math.sin(time * 0.55) * 4;
    this.sunContainer.y = targetY;

    // 4. Sun Scale (Expanding as it comes closer + flare eruption swell)
    const closenessScale = 1.0 + sunProgress * 0.85;
    const breath = Math.sin(time * 2.6) * 0.04;
    const flareScale = this.solarFlareActive ? (this.solarFlareIntensity * 0.45) : (this.solarFlarePhase === 'WARNING' ? Math.sin(time * 16) * 0.05 : 0);
    const totalScale = closenessScale + breath + flareScale;

    // Apply scaling and glowing layers (crisp core disc + smooth halo)
    if (this.sunAtmosphereBloom) {
      this.sunAtmosphereBloom.scale.set(totalScale * (0.95 + sunProgress * 0.4 + this.solarFlareIntensity * 0.55));
      this.sunAtmosphereBloom.alpha = 0.85 + sunProgress * 0.15 + this.solarFlareIntensity * 0.25;
    }
    if (this.sunCoreDisc) {
      this.sunCoreDisc.scale.set(totalScale * (1.0 + sunProgress * 0.4));
    }
    if (this.sunWhiteFlare) {
      this.sunWhiteFlare.scale.set(totalScale * (1.0 + this.solarFlareIntensity * 0.7));
      this.sunWhiteFlare.alpha = 0.15 + (this.solarFlareActive ? 0.75 : (this.solarFlarePhase === 'WARNING' ? 0.4 : 0)) + Math.sin(time * 4) * 0.08;
    }
  }

  updateFirestorm(dt) {
    if (!this.fireZigzagGfx || !this.fireBodyGfx) return;
    const time = this.elapsedTime;

    this.fireZigzagGfx.clear();
    this.fireBodyGfx.clear();

    const stepY = 22;
    const count = Math.ceil((V_HEIGHT * 2) / stepY) + 1;
    const points = [];

    for (let i = 0; i <= count; i++) {
      const y = i * stepY;
      const xOff = Math.sin(time * 4.5 + i * 0.9) * 11 + Math.sin(time * 8.2 + i * 1.8) * 6;
      points.push({ x: xOff, y });
    }

    // Fill body behind zigzag line to -1400px
    this.fireBodyGfx.beginFill(0xff2200, 0.95);
    this.fireBodyGfx.moveTo(-1400, 0);
    this.fireBodyGfx.lineTo(points[0].x, 0);
    for (let i = 1; i < points.length; i++) {
      this.fireBodyGfx.lineTo(points[i].x, points[i].y);
    }
    this.fireBodyGfx.lineTo(-1400, V_HEIGHT);
    this.fireBodyGfx.closePath();
    this.fireBodyGfx.endFill();

    // Radiant orange inner band
    this.fireBodyGfx.beginFill(0xff6a14, 0.6);
    this.fireBodyGfx.moveTo(points[0].x - 45, 0);
    for (let i = 0; i < points.length; i++) {
      this.fireBodyGfx.lineTo(points[i].x, points[i].y);
    }
    for (let i = points.length - 1; i >= 0; i--) {
      this.fireBodyGfx.lineTo(points[i].x - 45, points[i].y);
    }
    this.fireBodyGfx.closePath();
    this.fireBodyGfx.endFill();

    // Draw outer thick fiery orange line (8px)
    this.fireZigzagGfx.lineStyle(8, 0xff7c08, 0.95);
    this.fireZigzagGfx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.fireZigzagGfx.lineTo(points[i].x, points[i].y);
    }

    // Draw inner bright yellow core line (4px)
    this.fireZigzagGfx.lineStyle(4, 0xffea52, 1.0);
    this.fireZigzagGfx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.fireZigzagGfx.lineTo(points[i].x, points[i].y);
    }

    // Update rising magma bubbles
    if (this.fireBubbles) {
      for (const b of this.fireBubbles) {
        b.y -= b.speed * dt;
        if (b.y < -20) {
          b.y = V_HEIGHT + 20;
          b.xRel = -160 + Math.random() * 145;
          b.speed = 55 + Math.random() * 85;
        }
        b.gfx.position.set(b.xRel + Math.sin(time * 3.2 + b.phase) * 6, b.y);
      }
    }

    // Fire ambient silky gradient light spill pulse
    if (this.fireGlowSprite) {
      this.fireGlowSprite.alpha = 0.82 + Math.sin(time * 3.5) * 0.14;
    }
  }

  updateCamera(dt) {
    const vW = this.vWidth || V_WIDTH;
    const targetCamX = this.player.x - vW * 0.32;
    this.camera.x += (targetCamX - this.camera.x) * Math.min(1, dt * 6);

    // Dynamic Vertical Camera Tracking (Follows player smoothly with soft boundary damping)
    const midY = (PLAY_MIN_Y + PLAY_MAX_Y) * 0.5;
    const targetCamY = Math.max(-20, Math.min(55, (this.player.y - midY) * 0.38));
    this.camera.y += (targetCamY - this.camera.y) * Math.min(1, dt * 4.5);

    if (this.camera.shakeIntensity > 0.1) {
      this.camera.shakeOffset.x = (Math.random() * 2 - 1) * this.camera.shakeIntensity;
      this.camera.shakeOffset.y = (Math.random() * 2 - 1) * this.camera.shakeIntensity;
      this.camera.shakeIntensity *= this.camera.shakeDecay;
    } else {
      this.camera.shakeOffset.x = 0;
      this.camera.shakeOffset.y = 0;
      this.camera.shakeIntensity = 0;
    }

    const zoom = this.camera.zoom || 1.28;
    this.worldLayer.scale.set(zoom);
    this.worldLayer.position.x = -this.camera.x * zoom + this.camera.shakeOffset.x;
    this.worldLayer.position.y = HORIZON_Y * (1 - zoom) - this.camera.y * zoom + this.camera.shakeOffset.y;

    const screenHorizonY = HORIZON_Y - this.camera.y * zoom;

    if (this.horizonLine) {
      this.horizonLine.position.y = screenHorizonY - HORIZON_Y;
    }
    if (this.skySprite) {
      this.skySprite.height = Math.max(HORIZON_Y, screenHorizonY + 2);
    }
    if (this.sunContainer) {
      this.sunContainer.position.y = this.sunBaseY + (screenHorizonY - HORIZON_Y) * 0.32;
    }

    if (this.groundGfx) {
      this.groundGfx.position.x = this.camera.x;
    }
  }

  updateParticles(dt) {
    for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
      const g = this.dashGhosts[i];
      g.alpha -= dt * 3.5;
      g.sprite.alpha = g.alpha;
      if (g.alpha <= 0) {
        g.sprite.destroy();
        this.dashGhosts.splice(i, 1);
      }
    }

    if (this.player.vx !== 0 || this.player.vy !== 0) {
      if (Math.random() < (this.quality === 'HIGH' ? 0.35 : 0.15)) {
        const dust = new PIXI.Graphics();
        dust.beginFill(0x9a5a6e, 0.4);
        dust.drawCircle(0, 0, 3 + Math.random() * 3);
        dust.endFill();
        dust.position.set(this.player.x + (Math.random() * 8 - 4), this.player.y + PLAYER_FEET_OFFSET);
        this.particleLayer.addChild(dust);
        this.particles.push({ gfx: dust, vx: -this.player.vx * 0.1, vy: -10, alpha: 0.5, life: 0.35 });
      }
    }

    if (this.quality === 'HIGH' && Math.random() < 0.6) {
      const ember = new PIXI.Graphics();
      ember.beginFill(0xffb24a, 0.85);
      ember.drawCircle(0, 0, 2 + Math.random() * 2.5);
      ember.endFill();
      ember.position.set(this.fire.x + Math.random() * 60, Math.random() * V_HEIGHT);
      this.particleLayer.addChild(ember);
      this.particles.push({ gfx: ember, vx: 50 + Math.random() * 90, vy: (Math.random() * 2 - 1) * 30, alpha: 0.9, life: 0.6 });
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.gfx.x += p.vx * dt;
      p.gfx.y += p.vy * dt;
      p.alpha = Math.max(0, p.life / 0.5);
      p.gfx.alpha = p.alpha;
      if (p.life <= 0) {
        p.gfx.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  showHeadMessage(text, sender = 'PILOT', duration = 3.0, type = 'safe') {
    this.activeHeadMessage = {
      text,
      sender,
      type,
      timer: duration
    };

    if (this.dom.headBubbleSender) {
      this.dom.headBubbleSender.innerText = sender;
    }
    if (this.dom.headBubbleIcon) {
      if (sender.includes('COMMAND')) {
        this.dom.headBubbleIcon.innerText = '📡';
      } else if (sender.includes('SYSTEM') || sender.includes('SUIT')) {
        this.dom.headBubbleIcon.innerText = '⚡';
      } else {
        this.dom.headBubbleIcon.innerText = '🧑‍🚀';
      }
    }
    if (this.dom.headBubbleText) {
      this.dom.headBubbleText.innerText = text;
    }

    const bubble = this.dom.headMessageBubble;
    if (bubble) {
      bubble.className = 'head-message-bubble visible';
      if (type === 'radio' || sender.includes('COMMAND')) {
        bubble.classList.add('sender-command');
      } else if (type === 'warning') {
        bubble.classList.add('sender-warning');
      }
    }

    if (window.soundEngine) {
      if (sender.includes('COMMAND')) {
        window.soundEngine.playRadioChirp();
      } else {
        window.soundEngine.playTypeClick();
      }
    }

    this.updateHeadMessagePosition();
  }

  hideHeadMessage() {
    this.activeHeadMessage = null;
    if (this.dom.headMessageBubble) {
      this.dom.headMessageBubble.classList.remove('visible');
    }
  }

  updateHeadMessagePosition() {
    if (!this.activeHeadMessage || !this.dom.headMessageBubble) return;

    const zoom = this.camera.zoom || 1.28;
    const screenX = (this.player.x - this.camera.x) * zoom;
    const screenY = this.worldLayer.position.y + (this.player.y - 58) * zoom;

    const vW = this.vWidth || 1280;
    const clampedX = Math.max(160, Math.min(vW - 160, screenX));
    const clampedY = Math.max(70, screenY);

    this.dom.headMessageBubble.style.left = `${clampedX}px`;
    this.dom.headMessageBubble.style.top = `${clampedY}px`;

    const tailOffset = Math.max(-100, Math.min(100, screenX - clampedX));
    if (this.dom.headBubbleTail) {
      this.dom.headBubbleTail.style.transform = `translateX(${tailOffset}px)`;
    }
  }

  showShadeQuip(isCooling = true) {
    const list = isCooling ? COOLING_QUIPS : HEATING_QUIPS;
    const quip = list[Math.floor(Math.random() * list.length)];
    this.showHeadMessage(quip, 'PILOT', 2.8, isCooling ? 'safe' : 'warning');
  }

  updateHud() {
    const stam = this.player.stamina;
    this.dom.seg1.classList.toggle('empty', stam < 0.95);
    this.dom.seg2.classList.toggle('empty', stam < 1.95);
    this.dom.seg3.classList.toggle('empty', stam < 2.95);

    if (this.dom.heatFill) {
      this.dom.heatFill.style.width = `${Math.min(100, Math.max(0, this.heat * 100))}%`;
    }

    if (this.heat >= 0.85) {
      this.dom.heatStatus.innerText = "HEAT CRITICAL";
      this.dom.heatStatus.className = "critical";
    } else if (this.heat >= 0.65) {
      this.dom.heatStatus.innerText = "HEAT DANGEROUS";
      this.dom.heatStatus.className = "dangerous";
    } else if (this.heat >= 0.40) {
      this.dom.heatStatus.innerText = "HEAT RISING";
      this.dom.heatStatus.className = "rising";
    } else {
      this.dom.heatStatus.innerText = "HEAT PERFECT";
      this.dom.heatStatus.className = "";
    }

    this.dom.valDist.innerText = `${this.distance} m`;
    this.dom.valTime.innerText = `${this.elapsedTime.toFixed(1)} s`;
    this.dom.valShelters.innerText = `${this.sheltersFound}`;

    // Dynamic Heat Warm Vignette (intensifies with temperature)
    if (this.dom.heatVignette) {
      const vigAlpha = Math.max(0, Math.min(1.0, (this.heat - 0.20) / 0.80));
      this.dom.heatVignette.style.opacity = vigAlpha.toFixed(2);
    }

    // Critical heat chromatic aberration color fringe
    if (this.dom.container) {
      if (this.heat >= 0.82) {
        this.dom.container.classList.add('critical-heat-active');
      } else {
        this.dom.container.classList.remove('critical-heat-active');
      }
    }

    // Off-screen Supply Drop Tracker Indicator
    if (this.dom.supplyTracker) {
      const activeSup = this.supplies.find(s => !s.collected && s.x > this.player.x);
      if (activeSup) {
        this.dom.supplyTracker.classList.remove('hidden');
      } else {
        this.dom.supplyTracker.classList.add('hidden');
      }
    }
  }

  togglePause() {
    if (this.state === 'GAMEOVER' || this.state === 'DYING' || this.state === 'SPLASH') return;
    this.paused = !this.paused;
    if (this.paused) {
      this.dom.pauseMenu.classList.remove('hidden');
      if (window.soundEngine) window.soundEngine.setLowpass(true);
    } else {
      this.dom.pauseMenu.classList.add('hidden');
      if (window.soundEngine) window.soundEngine.setLowpass(false);
    }
  }

  /* =======================================================
     CATASTROPHIC DEATH ANIMATION & INCINERATION SYSTEM
     ======================================================= */
  triggerDeath(cause) {
    if (this.state === 'GAMEOVER' || this.state === 'DYING') return;
    this.state = 'DYING';
    this.deathCause = cause || "SUCCUMBED TO THE DEAD SUN";
    this.deathTimer = 0;
    this.deathDuration = 1.65;

    // Catastrophic Audio Decompression & Shockwave
    if (window.soundEngine) {
      window.soundEngine.playHit();
      if (window.soundEngine.playSuitRupture) {
        window.soundEngine.playSuitRupture();
      }
    }

    // High intensity cinematic screen shudder
    this.camera.shakeIntensity = 28;
    this.saveBests();

    // Hide active HUD warnings and speech bubbles
    if (this.dom.critBanner) this.dom.critBanner.classList.add('hidden');
    if (this.dom.flareBanner) this.dom.flareBanner.classList.add('hidden');
    if (this.dom.supplyTracker) this.dom.supplyTracker.classList.add('hidden');
    if (this.dom.shadeQuip) this.dom.shadeQuip.classList.remove('active');
    if (this.dom.transmissionLayer) this.dom.transmissionLayer.classList.add('hidden');
    if (this.dom.tutorialCard) this.dom.tutorialCard.classList.add('hidden');
    if (this.dom.pauseMenu) this.dom.pauseMenu.classList.add('hidden');

    // Freeze player velocity
    this.player.vx = 0;
    this.player.vy = 0;

    // Searing solar flash vignette
    this.triggerDeathScreenFlash();

    // Spawn dramatic in-engine death FX (crater decal, shockwaves, debris, particles, flames)
    this.spawnDeathEffects();
  }

  triggerDeathScreenFlash() {
    if (!this.dom.deathFlashOverlay) return;
    const overlay = this.dom.deathFlashOverlay;
    overlay.classList.remove('hidden', 'fade');
    overlay.classList.add('active');
    if (this.deathFlashTimer) clearTimeout(this.deathFlashTimer);
    this.deathFlashTimer = setTimeout(() => {
      overlay.classList.remove('active');
      overlay.classList.add('fade');
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('fade');
      }, 1300);
    }, 180);
  }

  spawnDeathEffects() {
    const px = this.player.x;
    const py = this.player.y;

    // 1. Permanent Ground Blast Crater Decal (Charred ash & smoldering rim)
    const scorch = new PIXI.Graphics();
    scorch.beginFill(0xff4400, 0.55);
    scorch.drawEllipse(0, 0, 38, 16);
    scorch.endFill();
    scorch.beginFill(0x0c0709, 0.88);
    scorch.drawEllipse(0, 0, 28, 12);
    scorch.endFill();
    scorch.beginFill(0xffaa22, 0.8);
    scorch.drawCircle(-9, -2, 2.2);
    scorch.drawCircle(8, 3, 2.0);
    scorch.drawCircle(2, -4, 1.8);
    scorch.drawCircle(-3, 4, 1.5);
    scorch.endFill();
    scorch.position.set(px, py);
    this.particleLayer.addChild(scorch);
    this.deathDecals.push(scorch);

    // 2. Fiery Expanding Plasma Shockwave Rings
    // Ring 1: Blazing solar white-yellow inner rupture ring
    const ring1 = new PIXI.Graphics();
    ring1.position.set(px, py - 20);
    this.particleLayer.addChild(ring1);
    this.deathShockwaves.push({
      gfx: ring1,
      radius: 6,
      maxRadius: 85,
      speed: 180,
      alpha: 1.0,
      color: 0xffea55,
      width: 4
    });

    // Ring 2: Deep fiery plasma shockwave expanding outward
    const ring2 = new PIXI.Graphics();
    ring2.position.set(px, py - 20);
    this.particleLayer.addChild(ring2);
    this.deathShockwaves.push({
      gfx: ring2,
      radius: 4,
      maxRadius: 130,
      speed: 135,
      alpha: 0.9,
      color: 0xff4400,
      width: 5
    });

    // 3. Flame Plume attached to collapsing astronaut
    this.deathFlameGfx = new PIXI.Graphics();
    this.playerContainer.addChild(this.deathFlameGfx);

    // 4. Cyan Oxygen Tank Rupture Flash & Sparks
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i + (Math.random() * 0.4 - 0.2);
      const speed = 70 + Math.random() * 110;
      const spark = new PIXI.Graphics();
      spark.beginFill(0x43e1ff, 0.95);
      spark.drawCircle(0, 0, 2 + Math.random() * 2);
      spark.endFill();
      spark.position.set(px - 10, py - 22);
      this.particleLayer.addChild(spark);
      this.deathParticles.push({
        gfx: spark,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.92,
        gravity: 25,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        colorType: 'cyan'
      });
    }

    // 5. 48 Blazing Incineration Embers & Sparks (360-degree explosive burst)
    const emberColors = [0xffffff, 0xffe066, 0xff8822, 0xff3300, 0xdd1100];
    for (let i = 0; i < 48; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 260;
      const color = emberColors[Math.floor(Math.random() * emberColors.length)];
      const ember = new PIXI.Graphics();
      ember.beginFill(color, 0.95);
      ember.drawCircle(0, 0, 1.8 + Math.random() * 2.8);
      ember.endFill();
      ember.position.set(px + (Math.random() * 12 - 6), py - 22 + (Math.random() * 14 - 7));
      this.particleLayer.addChild(ember);
      this.deathParticles.push({
        gfx: ember,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.85 - 25,
        drag: 0.94,
        gravity: 45,
        life: 0.6 + Math.random() * 0.9,
        maxLife: 1.5,
        colorType: 'fire'
      });
    }

    // 6. 18 Billowing Rising Smoke & Soot Clouds
    for (let i = 0; i < 18; i++) {
      const smoke = new PIXI.Graphics();
      const gray = Math.floor(25 + Math.random() * 35);
      const hexColor = (gray << 16) | ((gray - 5) << 8) | (gray + 5);
      const rad = 6 + Math.random() * 9;
      smoke.beginFill(hexColor, 0.65);
      smoke.drawCircle(0, 0, rad);
      smoke.endFill();
      smoke.position.set(px + (Math.random() * 24 - 12), py - 18 + (Math.random() * 16 - 8));
      this.particleLayer.addChild(smoke);
      this.deathParticles.push({
        gfx: smoke,
        vx: (Math.random() * 2 - 1) * 28,
        vy: -35 - Math.random() * 45,
        drag: 0.97,
        gravity: -10,
        growth: 12,
        rad: rad,
        life: 0.8 + Math.random() * 0.85,
        maxLife: 1.65,
        colorType: 'smoke'
      });
    }

    // 7. 8 Flying Suit Armor Debris Fragments
    const debrisTypes = [
      { name: 'visor', color: 0xffaa22, w: 9, h: 5 },
      { name: 'shoulder_l', color: 0xdde8f0, w: 8, h: 7 },
      { name: 'shoulder_r', color: 0xdde8f0, w: 8, h: 7 },
      { name: 'pack_shard', color: 0x243340, w: 10, h: 8 },
      { name: 'chest_plate', color: 0x1a2b38, w: 10, h: 6 },
      { name: 'boot_l', color: 0x324050, w: 7, h: 5 },
      { name: 'boot_r', color: 0x324050, w: 7, h: 5 },
      { name: 'radio_antenna', color: 0x8899aa, w: 12, h: 2 }
    ];

    for (let i = 0; i < debrisTypes.length; i++) {
      const def = debrisTypes[i];
      const g = new PIXI.Graphics();
      g.beginFill(def.color, 0.9);
      g.drawRoundedRect(-def.w / 2, -def.h / 2, def.w, def.h, 1.5);
      g.endFill();
      g.position.set(px, py - 25);
      this.particleLayer.addChild(g);

      const angle = (Math.PI * 2 / debrisTypes.length) * i + (Math.random() * 0.5 - 0.25);
      const speed = 65 + Math.random() * 95;
      this.deathDebris.push({
        gfx: g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.7 - 40,
        groundY: py + (Math.random() * 12 - 6),
        rotSpeed: (Math.random() * 2 - 1) * 14,
        landed: false,
        life: 2.0
      });
    }
  }

  updateDeathSequence(dt) {
    this.deathTimer += dt;
    const t = this.deathTimer;

    // 1. Suit Overheating, Shuddering, and Disintegration
    if (this.playerSprite) {
      const shakeAmt = Math.max(0, (1 - t / 0.9)) * 7;
      this.playerSprite.position.x = (Math.random() - 0.5) * shakeAmt;
      this.playerSprite.position.y = (Math.random() - 0.5) * shakeAmt;

      // Color tint transition: White hot -> solar orange -> charred ash
      if (t < 0.22) {
        this.playerSprite.tint = 0xffffff;
      } else if (t < 0.55) {
        this.playerSprite.tint = 0xff6611;
      } else {
        this.playerSprite.tint = 0x221518;
      }

      // Suit collapse & dissolution into ash
      if (t > 0.35) {
        const dissolve = Math.max(0, 1 - (t - 0.35) / 0.65);
        this.playerSprite.alpha = dissolve;
        const baseScale = 0.052;
        const currentScaleX = Math.sign(this.playerSprite.scale.x || 1) * baseScale;
        this.playerSprite.scale.set(currentScaleX, baseScale * (0.3 + 0.7 * dissolve));
      }
    }

    // Oxygen tank explosion
    if (this.tankGlow) {
      if (t > 0.15) {
        this.tankGlow.visible = false;
      } else {
        this.tankGlow.alpha = 1.0;
        this.tankGlow.scale.set(1.5);
      }
    }

    // 2. Dynamic Flickering Fire Plume around Suit
    if (this.deathFlameGfx && t < 1.1) {
      const g = this.deathFlameGfx;
      g.clear();
      const flameAlpha = Math.max(0, 1 - t / 1.1);
      const fH = (1 - t / 1.1) * 35;

      // Outer orange flame
      g.beginFill(0xff4400, flameAlpha * 0.7);
      g.moveTo(-14, 0);
      g.lineTo(-7 + (Math.random() * 4 - 2), -fH * 0.8);
      g.lineTo(0, -fH * 1.1 - (Math.random() * 6));
      g.lineTo(7 + (Math.random() * 4 - 2), -fH * 0.85);
      g.lineTo(14, 0);
      g.closePath();
      g.endFill();

      // Inner searing yellow core
      g.beginFill(0xffdd33, flameAlpha * 0.85);
      g.moveTo(-9, 0);
      g.lineTo(-4 + (Math.random() * 2 - 1), -fH * 0.6);
      g.lineTo(0, -fH * 0.85);
      g.lineTo(4 + (Math.random() * 2 - 1), -fH * 0.6);
      g.lineTo(9, 0);
      g.closePath();
      g.endFill();

      g.position.set(0, -10);
    } else if (this.deathFlameGfx) {
      this.deathFlameGfx.clear();
    }

    // 3. Expanding Shockwaves
    for (let i = this.deathShockwaves.length - 1; i >= 0; i--) {
      const sw = this.deathShockwaves[i];
      sw.radius += sw.speed * dt;
      const progress = sw.radius / sw.maxRadius;
      sw.alpha = Math.max(0, 1 - progress);

      sw.gfx.clear();
      sw.gfx.lineStyle(sw.width * (1 - progress * 0.5), sw.color, sw.alpha);
      sw.gfx.drawEllipse(0, 0, sw.radius, sw.radius * 0.55);

      if (progress >= 1.0) {
        sw.gfx.destroy();
        this.deathShockwaves.splice(i, 1);
      }
    }

    // 4. Disintegration Particles & Smoke
    for (let i = this.deathParticles.length - 1; i >= 0; i--) {
      const p = this.deathParticles[i];
      p.life -= dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity * dt;

      p.gfx.x += p.vx * dt;
      p.gfx.y += p.vy * dt;

      const alphaNorm = Math.max(0, p.life / p.maxLife);
      p.gfx.alpha = alphaNorm;

      if (p.colorType === 'smoke') {
        const curScale = 1 + (1 - alphaNorm) * 1.6;
        p.gfx.scale.set(curScale);
      }

      if (p.life <= 0) {
        p.gfx.destroy();
        this.deathParticles.splice(i, 1);
      }
    }

    // 5. Suit Armor Debris Fragments (physics bounce and skid)
    for (let i = this.deathDebris.length - 1; i >= 0; i--) {
      const d = this.deathDebris[i];
      d.life -= dt;

      if (!d.landed) {
        d.vy += 180 * dt;
        d.gfx.x += d.vx * dt;
        d.gfx.y += d.vy * dt;
        d.gfx.rotation += d.rotSpeed * dt;

        if (d.gfx.y >= d.groundY) {
          d.gfx.y = d.groundY;
          d.landed = true;
          d.vx *= 0.3;
          d.rotSpeed *= 0.1;
        }
      } else {
        d.vx *= 0.85;
        d.gfx.x += d.vx * dt;
      }

      if (d.life <= 0.6) {
        d.gfx.alpha = Math.max(0, d.life / 0.6);
      }

      if (d.life <= 0) {
        d.gfx.destroy();
        this.deathDebris.splice(i, 1);
      }
    }

    // 6. Camera & Ambient Sound Update
    this.updateCamera(dt);
    if (window.soundEngine) {
      window.soundEngine.update(dt, this.heat, this.fire.proximity);
    }

    // 7. Transition to CRT Terminal on Animation Finish
    if (this.deathTimer >= this.deathDuration) {
      this.finishDeathSequence();
    }
  }

  finishDeathSequence() {
    if (this.state === 'GAMEOVER') return;
    this.state = 'GAMEOVER';

    if (this.playerSprite) {
      this.playerSprite.visible = false;
    }
    if (this.tankGlow) {
      this.tankGlow.visible = false;
    }
    if (this.deathFlameGfx) {
      this.deathFlameGfx.clear();
    }

    this.startTerminalTypewriter(this.deathCause);
  }

  skipDeathAnimation() {
    if (this.state !== 'DYING') return;
    this.finishDeathSequence();
  }

  startTerminalTypewriter(cause) {
    if (this.termTypeTimer) clearTimeout(this.termTypeTimer);

    const termBody = this.dom.termTypingBody;
    const actions = this.dom.termActions;
    const skipHint = this.dom.termSkipHint;

    termBody.innerHTML = '';
    actions.classList.add('hidden');
    skipHint.classList.remove('hidden');
    this.dom.termGameOver.classList.remove('hidden');

    if (this.dom.termCallsignBox) {
      this.dom.termCallsignBox.classList.add('hidden');
    }
    if (this.dom.callsignStatus) {
      this.dom.callsignStatus.innerText = '';
      this.dom.callsignStatus.className = 'callsign-status';
    }
    if (this.dom.btnSubmitScore) {
      this.dom.btnSubmitScore.disabled = false;
      this.dom.btnSubmitScore.innerHTML = '&#10003; TRANSMIT';
    }
    this.scoreSubmitted = false;

    const lines = [
      "> recovering unit telemetry ...",
      "",
      `PILOT .......... ${this.playerCallsign}`,
      `STATUS ......... KIA — ${cause.toUpperCase()}`,
      `DISTANCE ....... ${this.distance} M     (best ${this.bests.dist})`,
      `TIME SURVIVED .. ${this.elapsedTime.toFixed(1)} S    (best ${this.bests.time})`,
      `SHELTERS ....... ${this.sheltersFound}        (best ${this.bests.shelters})`,
      `SECTOR SEED .... ${this.seed}`,
      "",
      "> END OF TRANSMISSION"
    ];

    this.termFullText = lines.join("\n");
    this.termCurrentText = "";
    this.termTyping = true;

    // Trigger real-time transmission immediately under registered pilot name
    this.submitScore();

    let lineIdx = 0;
    let charIdx = 0;

    const typeNextChar = () => {
      if (!this.termTyping) return;

      if (lineIdx >= lines.length) {
        this.finishTerminalTypewriter();
        return;
      }

      const curLine = lines[lineIdx];

      if (charIdx < curLine.length) {
        this.termCurrentText += curLine[charIdx];
        charIdx++;
        termBody.innerHTML = this.escapeHtml(this.termCurrentText) + '<span class="term-cursor">█</span>';

        if (window.soundEngine && charIdx % 2 === 0) {
          window.soundEngine.playTypeClick();
        }

        this.termTypeTimer = setTimeout(typeNextChar, 14);
      } else {
        lineIdx++;
        charIdx = 0;
        if (lineIdx < lines.length) {
          this.termCurrentText += "\n";
          termBody.innerHTML = this.escapeHtml(this.termCurrentText) + '<span class="term-cursor">█</span>';
          this.termTypeTimer = setTimeout(typeNextChar, 95);
        } else {
          this.finishTerminalTypewriter();
        }
      }
    };

    this.termTypeTimer = setTimeout(typeNextChar, 180);
  }

  finishTerminalTypewriter() {
    this.termTyping = false;
    if (this.termTypeTimer) clearTimeout(this.termTypeTimer);
    this.dom.termTypingBody.innerHTML = this.escapeHtml(this.termFullText) + '<span class="term-cursor">█</span>';
    this.dom.termActions.classList.remove('hidden');
    this.dom.termSkipHint.classList.add('hidden');

    if (this.dom.termCallsignBox) {
      this.dom.termCallsignBox.classList.remove('hidden');
      if (this.dom.inputCallsign) {
        this.dom.inputCallsign.value = this.playerCallsign;
      }
    }
  }

  skipTerminalTypewriter() {
    if (!this.termTyping) return;
    this.finishTerminalTypewriter();
  }

  /* =======================================================
     SECTOR LEADERBOARD & TRANSMISSION CLIENT
     ======================================================= */
  async submitScore() {
    if (this.scoreSubmitted) return;

    let callsign = this.playerCallsign || (this.dom.inputCallsign ? this.dom.inputCallsign.value : 'PILOT') || 'PILOT';
    callsign = callsign.toUpperCase().replace(/[^A-Z0-9_\-]/g, '').slice(0, 8);
    if (!callsign) callsign = 'PILOT';

    this.playerCallsign = callsign;
    localStorage.setItem('deadsun_callsign', callsign);

    const payload = {
      callsign,
      distance: this.distance,
      time: parseFloat(this.elapsedTime.toFixed(1)),
      shelters: this.sheltersFound,
      seed: this.seed
    };

    // Save locally for resilient offline play
    this.saveLocalLeaderboard(payload);

    if (this.dom.callsignStatus) {
      this.dom.callsignStatus.innerText = 'TRANSMITTING...';
      this.dom.callsignStatus.className = 'callsign-status';
    }
    if (this.dom.btnSubmitScore) {
      this.dom.btnSubmitScore.disabled = true;
    }

    // Try submitting to dedicated backend server
    const endpoints = [
      '/api/score',
      'http://localhost:3000/api/score'
    ];

    let submitted = false;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          const rankText = data.rank ? `RANK #${data.rank}` : 'ACCEPTED';
          if (this.dom.callsignStatus) {
            this.dom.callsignStatus.innerText = `TRANSMITTED (${rankText})`;
            this.dom.callsignStatus.className = 'callsign-status';
          }
          submitted = true;
          this.scoreSubmitted = true;
          if (window.soundEngine) window.soundEngine.playShelterChime();
          break;
        }
      } catch (e) {
        // Continue to fallback endpoint
      }
    }

    if (!submitted) {
      // Offline fallback success
      if (this.dom.callsignStatus) {
        this.dom.callsignStatus.innerText = 'ARCHIVED LOCALLY (OFFLINE)';
        this.dom.callsignStatus.className = 'callsign-status';
      }
      this.scoreSubmitted = true;
    }
  }

  async showLeaderboard() {
    if (!this.dom.leaderboardModal) return;
    this.dom.leaderboardModal.classList.remove('hidden');

    if (this.dom.leaderboardRows) {
      this.dom.leaderboardRows.innerHTML = '<tr><td colspan="5" class="leaderboard-empty">FETCHING LIVE SECTOR TELEMETRY...</td></tr>';
    }

    const currentCallsign = this.playerCallsign || localStorage.getItem('deadsun_callsign') || 'PILOT';
    const endpoints = [
      '/api/leaderboard',
      'http://localhost:3000/api/leaderboard'
    ];

    let records = null;
    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok' && Array.isArray(data.leaderboard)) {
            records = data.leaderboard;
            break;
          }
        }
      } catch (e) {
        // Fallback
      }
    }

    if (!records || records.length === 0) {
      records = this.loadLocalLeaderboard();
    }

    this.renderLeaderboardTable(records, currentCallsign, this.distance);
  }

  closeLeaderboard() {
    if (this.dom.leaderboardModal) {
      this.dom.leaderboardModal.classList.add('hidden');
    }
  }

  renderLeaderboardTable(records, highlightCallsign, highlightDist) {
    if (!this.dom.leaderboardRows) return;
    if (!records || records.length === 0) {
      this.dom.leaderboardRows.innerHTML = '<tr><td colspan="5" class="leaderboard-empty">NO PILOT RUNS RECORDED IN THIS SECTOR YET<br><span style="font-size: 13px; color: #43e1ff; margin-top: 8px; display: block;">REGISTER YOUR CALLSIGN ON THE MAIN MENU &amp; SURVIVE TO CLAIM RANK #1</span></td></tr>';
      return;
    }

    let html = '';
    records.slice(0, 30).forEach((entry, idx) => {
      const rank = entry.rank || (idx + 1);
      const isCurrent = (entry.callsign === highlightCallsign && entry.distance === highlightDist);
      const rowClass = isCurrent ? 'current-pilot' : '';
      html += `
        <tr class="${rowClass}">
          <td class="rank-col">#${rank}</td>
          <td><strong>${this.escapeHtml(entry.callsign || 'UNKNOWN')}</strong></td>
          <td>${entry.distance} m</td>
          <td>${entry.time ? entry.time.toFixed(1) : '0.0'} s</td>
          <td>${entry.shelters || 0}</td>
        </tr>
      `;
    });

    this.dom.leaderboardRows.innerHTML = html;
  }

  loadLocalLeaderboard() {
    try {
      const stored = JSON.parse(localStorage.getItem('deadsun_local_scores') || '[]');
      if (Array.isArray(stored) && stored.length > 0) {
        stored.sort((a, b) => b.distance !== a.distance ? b.distance - a.distance : a.time - b.time);
        return stored.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
      }
    } catch (e) {}
    return [];
  }

  saveLocalLeaderboard(entry) {
    try {
      const stored = JSON.parse(localStorage.getItem('deadsun_local_scores') || '[]');
      stored.push(entry);
      stored.sort((a, b) => b.distance !== a.distance ? b.distance - a.distance : a.time - b.time);
      localStorage.setItem('deadsun_local_scores', JSON.stringify(stored.slice(0, 30)));
    } catch (e) {}
  }

  async clearAllDatabaseAndLocalScores() {
    try {
      localStorage.removeItem('deadsun_local_scores');
      localStorage.removeItem('deadsun_bests');
      this.bests = { dist: 0, time: 0, shelters: 0 };
    } catch (e) {}

    const endpoints = [
      '/api/admin/clear-database',
      'http://localhost:3000/api/admin/clear-database'
    ];

    for (const ep of endpoints) {
      try {
        await fetch(ep, { method: 'POST' });
      } catch (e) {}
    }

    if (this.dom.leaderboardRows) {
      this.dom.leaderboardRows.innerHTML = '<tr><td colspan="5" class="leaderboard-empty">DATABASE CLEARED &bull; ZERO ACTIVE RUNS</td></tr>';
    }
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.deadSunGame = new DeadSunGame();
});
