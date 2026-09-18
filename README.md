# DEAD SUN ☀️

> **Shelter from the Red Giant. Flee the firestorm. Shadow is life.**

DEAD SUN is a fast-paced 2D sci-fi vector survival game rendered in **PixiJS** with a procedural solar event engine, dual-zone multi-touch mobile controls, dynamic heat dissipation mechanics, a retro CRT field terminal, and a dedicated online leaderboard.

---

## 🎮 Features

- **Dynamic Solar Looming & Firestorm Engine**: Smooth cosmic sky gradient, radiant solar corona flares, and dynamic heat screen vignettes with critical chromatic aberration.
- **Realistic Shelter & Shade Physics**: Shadows cast from towering sci-fi monoliths provide active cooling and stamina recharge.
- **Retro CRT Field Terminal**: Authentic green phosphor scanline terminal with typewriter telemetry readout and callsign transmission.
- **Dual-Zone Mobile Touch Controls**: Ergonomic virtual analog joystick and tactile dash button with multi-touch support for phones and tablets.
- **Native Android APK Ready**: Pre-configured with Capacitor 6 for 1-click mobile deployment.
- **Dedicated Leaderboard Server**: RESTful Node.js leaderboard backend with anti-cheat velocity verification and offline resilience.

---

## 🚀 Quick Start

### Play / Run Locally
```bash
npm install
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Controls
- **Movement**: `W` `A` `S` `D` / Arrow Keys / Virtual Joystick (mobile)
- **Dash**: `Space` / On-screen DASH button (mobile)
- **Leaderboard**: `L` key or tap Leaderboard button
- **Pause**: `P` key or Pause icon

---

## 📱 Build Android APK

```bash
npm install
npm run bundle:mobile
npx cap add android
npm run cap:open
```
In Android Studio: Select **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.

---

## 🌐 Deploy to Render

See [`APK_AND_BACKEND_GUIDE.md`](./APK_AND_BACKEND_GUIDE.md) for full deployment instructions.
