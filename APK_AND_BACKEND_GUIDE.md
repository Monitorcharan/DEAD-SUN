# DEAD SUN: Android APK & Dedicated Leaderboard Guide

This guide details how to compile **DEAD SUN** into an Android APK and how to deploy and maintain the backend leaderboard server.

---

## Part 1: Android APK Compilation (via Capacitor)

The project is structured with native Capacitor 6 configuration. The web bundle in `www/` contains PixiJS, WebAudio, dual-zone multi-touch controls, and all PNG shelter assets.

### Prerequisites
1. **Node.js** (v18+) - Already installed on your machine.
2. **Android Studio** (or Android SDK with Command-line Tools & Java 17/21).

### Step-by-Step Compilation

#### Step 1: Install Capacitor Dependencies
Open PowerShell or your terminal in the game root folder:
```powershell
npm install
```

#### Step 2: Bundle Game Assets & Initialize Android Native Project
```powershell
npm run bundle:mobile
npx cap add android
```
*Note: `npx cap add android` creates the `android/` native Android Studio workspace configured for landscape orientation.*

#### Step 3: Synchronize Assets
Whenever you update code or art assets:
```powershell
npm run cap:sync
```

#### Step 4: Build the APK

**Option A: Using Android Studio (Recommended)**
```powershell
npm run cap:open
```
- Android Studio opens automatically.
- Go to the menu: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
- Once finished, click **locate** in the notification balloon.

**Option B: Direct Command Line (Gradle)**
```powershell
cd android
./gradlew assembleDebug
```
Your compiled Android APK will be located at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```
Transfer this `.apk` to any Android phone or tablet, install, and play with full on-screen joystick and dash controls!

---

## Part 2: Dedicated Leaderboard Server

The project includes a lightweight, zero-dependency compatible Node.js leaderboard server in `server/server.js`.

### Server Capabilities
- **Endpoints**:
  - `GET /api/leaderboard`: Returns top 50 ranked pilot runs.
  - `POST /api/score`: Receives pilot callsign, distance, time, and shelters.
  - `GET /api/health`: Server status and ping.
- **Anti-Cheat Validation**:
  - Automatically rejects runs with impossible velocity ($v > 450\text{ m/s}$).
  - Sanitizes callsigns ($2-8$ alphanumeric characters).
- **Offline Fallback**:
  - If the player is on mobile without internet or the server is down, high scores are archived locally in `localStorage` without any crash or interrupted gameplay.

### Running Locally
To run the server locally:
```powershell
node server/server.js
```
The server will start at `http://localhost:3000`.

---

## Part 3: Deploying the Leaderboard to the Cloud

Here are our recommended production hosting options ranked by ease of use and cost:

### 1. Render.com / Railway (Free / Lowest Effort - Recommended)
- **Cost**: Free tier available / ~$5/month
- **How to Deploy**:
  1. Push this project to GitHub.
  2. Create a new **Web Service** on Render or Railway.
  3. Set:
     - **Root Directory**: leave blank (or `.`) so all game files and server code are deployed together
     - **Build Command**: `npm install`
     - **Start Command**: `node server/server.js` (or `npm start`)
  4. Once deployed, you will get an HTTPS URL (e.g., `https://dead-sun.onrender.com`).
  5. Both the entire game (with all visual assets and responsive gameplay) AND the dedicated pilot leaderboard are hosted seamlessly!

### 2. DigitalOcean / Hetzner VPS (Maximum Control & Low Cost)
- **Cost**: $4 – $5/month
- **How to Deploy**:
  1. Spin up an Ubuntu LTS Droplet.
  2. Install Node.js and PM2:
     ```bash
     sudo apt update && sudo apt install -y nodejs npm nginx
     sudo npm install -g pm2
     ```
  3. Clone the repository and start with PM2:
     ```bash
     pm2 start server/server.js --name "dead-sun-api"
     pm2 startup
     pm2 save
     ```
  4. Setup Nginx reverse proxy with free Let's Encrypt SSL (`certbot`).

### 3. Serverless BaaS: Supabase / Firebase
- If you prefer not to manage a Node.js process at all:
  - Create a table `scores` (`id`, `callsign`, `distance`, `time`, `shelters`, `created_at`).
  - Use Supabase REST API directly from `game.js` with your public anon API key.
