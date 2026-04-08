# MyDay — Implementation Plan

## Overview

An Electron + TypeScript macOS desktop wallpaper app that renders behind all windows, displaying personal data (clock, weather, calendar, running stats, football scores) with three interactive features: Pomodoro timer, live score goal flashing, and weekly training load comparison. Doubles as a screensaver — after a configurable idle period the wallpaper elevates to fullscreen foreground with ambient animations, then drops back to desktop level on any input.

---

## Architecture

```
main process                          renderer process
─────────────                         ─────────────────
main.ts (app entry)                   index.html
  ├── scheduler.ts (intervals)          ├── dashboard.ts (orchestrator)
  ├── pomodoro.ts (state machine)       ├── cards/clock.ts
  ├── screensaver.ts (idle watcher)     ├── cards/weather.ts
  ├── fetchers/weather.ts               ├── cards/weather.ts
  ├── fetchers/calendar.ts              ├── cards/calendar.ts
  ├── fetchers/strava.ts                ├── cards/strava.ts
  ├── fetchers/football.ts              ├── cards/football.ts
  └── preload.ts (contextBridge)        └── pomodoro.ts (UI)
         │                                     │
         └────── IPC channels ─────────────────┘
```

## IPC Channel Map

| Channel                | Direction        | Payload           |
|------------------------|------------------|-------------------|
| `weather:update`       | main → renderer  | `WeatherData`     |
| `calendar:update`      | main → renderer  | `CalendarEvent[]` |
| `strava:update`        | main → renderer  | `StravaData`      |
| `football:update`      | main → renderer  | `Fixture[]`       |
| `football:goal`        | main → renderer  | `GoalEvent`       |
| `pomodoro:tick`        | main → renderer  | `PomodoroTick`    |
| `pomodoro:toggle`      | renderer → main  | (none)            |
| `pomodoro:reset`       | renderer → main  | (none)            |
| `window:set-clickable` | renderer → main  | `boolean`         |
| `screensaver:activate` | main → renderer  | (none)            |
| `screensaver:deactivate` | main → renderer | (none)           |

---

## Phase 0: Project Setup

**Goal:** Bootable Electron app that opens a blank window. Build pipeline works. Config loads.

### Steps

1. **Initialize project** (`package.json`)
   - `npm init -y` in `myday/`
   - Set `"main": "dist/main.js"`
   - Scripts: `"build": "tsc && cp src/renderer/index.html dist/renderer/index.html"`, `"start": "npm run build && electron ."`, `"dev": "tsc -w"`
   - Dev dep: `electron`

2. **TypeScript config** (`tsconfig.json`)
   - Target: `ES2022`, module: `commonjs`, outDir: `dist`, rootDir: `src`
   - `strict: true`, `esModuleInterop: true`, `resolveJsonModule: true`

3. **Config file** (`config.json`)
   - Full config shape from spec with empty string placeholders for secrets

4. **Config loader** (`src/config.ts`)
   - Read and parse `config.json` via `fs.readFileSync` + `JSON.parse`
   - Validate required fields, export frozen `AppConfig` object

5. **Shared types** (`src/types.ts`)
   - All shared interfaces: `PomodoroState`, `PomodoroTick`, `WeatherData`, `CalendarEvent`, `StravaWeekStats`, `StravaData`, `Fixture`, `FixtureScore`, `GoalEvent`, `AppConfig`

6. **Storage utility** (`src/storage.ts`)
   - `ensureStorageDir()` — creates `~/.myday/` if missing
   - `readJson<T>(filename): T | null` — returns null if missing
   - `writeJson<T>(filename, data): void` — atomic write (write `.tmp`, rename)

7. **Create full directory structure** — all files as stubs

### Acceptance Criteria
- [ ] `npm run build` compiles without errors
- [ ] `npm start` opens an Electron process
- [ ] `config.json` is loaded and parsed
- [ ] `~/.myday/` directory is created on startup

**Complexity:** Low

---

## Phase 1: Window Shell + Clock

**Goal:** Electron window pinned below all other windows, card layout with ticking clock.

### Steps

1. **Main process entry** (`src/main.ts`)
   - Create `BrowserWindow`: fullscreen, frameless, transparent, no shadow, skip taskbar
   - Pin below all windows:
     ```ts
     win.setAlwaysOnTop(true, 'desktop')
     win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
     win.setIgnoreMouseEvents(true, { forward: true })
     ```
   - Load `dist/renderer/index.html`
   - Note: Desktop-level window on macOS may need `electron-as-wallpaper` or native bridge — test early

2. **Preload script** (`src/preload.ts`)
   - `contextBridge.exposeInMainWorld('myday', { ... })` — all IPC listeners and senders
   - Type declaration file `src/renderer/myday.d.ts` for `window.myday`

3. **IPC handler for click-through toggle** (`src/main.ts`)
   - `ipcMain.on('window:set-clickable', ...)` — toggles `setIgnoreMouseEvents`

4. **HTML layout** (`src/renderer/index.html`)
   - Full-viewport transparent container
   - CSS grid with card containers: `#card-clock`, `#card-weather`, `#card-calendar`, `#card-strava`, `#card-pomodoro`, `#card-football`
   - Cards: white with slight transparency, rounded corners, subtle shadow

5. **Clock card** (`src/renderer/cards/clock.ts`)
   - `setInterval` at 1000ms, display `HH:MM:SS` + `Wednesday, 8 April 2026`
   - Use `Intl.DateTimeFormat` for locale-aware formatting

6. **Dashboard orchestrator** (`src/renderer/dashboard.ts`)
   - Import and initialize all card modules
   - Register `window.myday.on*` callbacks (stubs for future phases)

7. **Scheduler stub** (`src/scheduler.ts`)
   - `start(win, config)` method — placeholder, wired up in later phases

### Acceptance Criteria
- [ ] Transparent, frameless window pinned below all other windows
- [ ] Visible on all macOS Spaces/Desktops
- [ ] White card containers rendered on the wallpaper
- [ ] Clock ticks every second with correct time and date
- [ ] Clicks pass through the window to apps beneath
- [ ] Window fills full screen

**Complexity:** Medium (macOS window level is the main unknown)

---

## Phase 2: Weather

**Goal:** First real external data flowing through the full pipeline: fetcher → IPC → renderer card.

### Prerequisites
- `config.json` has valid `location.latitude` and `location.longitude`

### Steps

1. **Weather fetcher** (`src/fetchers/weather.ts`)
   - `fetchWeather(config): Promise<WeatherData>`
   - Endpoint: `https://api.open-meteo.com/v1/forecast`
   - Params: `latitude`, `longitude`, `current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m`, `hourly=temperature_2m,weather_code`, `daily=temperature_2m_max,temperature_2m_min,sunrise,sunset`, `timezone=auto`, `forecast_days=1`
   - Use Node `fetch` (Node 18+)
   - Validate response shape before transforming
   - Fallback to `~/.myday/weather-cache.json` on failure

2. **Wire into scheduler** (`src/scheduler.ts`)
   - Fetch immediately on startup, then every 30 minutes
   - `win.webContents.send('weather:update', data)`

3. **Weather card renderer** (`src/renderer/cards/weather.ts`)
   - Display: current temp, apparent temp, conditions (WMO weather code → text), high/low, sunrise/sunset
   - WMO codes: 0=Clear, 1-3=Cloudy, 45-48=Fog, 51-67=Rain, 71-77=Snow, 80-82=Showers, 95-99=Thunderstorm

4. **Register in dashboard** (`src/renderer/dashboard.ts`)

### Acceptance Criteria
- [ ] Weather data fetches on startup
- [ ] Card displays temperature, conditions, high/low, sunrise/sunset
- [ ] Updates every 30 minutes
- [ ] Handles API failure gracefully (cached or "unavailable" state)

**Complexity:** Low

---

## Phase 3: Calendar

**Goal:** Google Calendar OAuth flow works, events display on the wallpaper.

### Prerequisites
- Google Cloud project with Calendar API enabled
- OAuth 2.0 credentials in `config.json`

### Steps

1. **Google OAuth auth script** (`scripts/auth-google.js`)
   - Standalone Node.js script (not part of Electron app)
   - Start temporary HTTP server on `localhost:3000`
   - Open Google OAuth consent URL in browser
   - Scope: `https://www.googleapis.com/auth/calendar.readonly`
   - Exchange auth code for tokens: `POST https://oauth2.googleapis.com/token`
   - Save `refresh_token` to `~/.myday/google-tokens.json`

2. **Token manager** (`src/fetchers/calendar.ts`)
   - `getAccessToken(config): Promise<string>`
   - Read cached token from `~/.myday/google-tokens.json`
   - If expired, refresh via `POST https://oauth2.googleapis.com/token` with `grant_type: refresh_token`
   - Save new access token + expiry

3. **Calendar fetcher** (`src/fetchers/calendar.ts`)
   - `fetchCalendar(config): Promise<CalendarEvent[]>`
   - Endpoint: `GET https://www.googleapis.com/calendar/v3/calendars/primary/events`
   - Params: `timeMin`, `timeMax` (rest of today), `singleEvents=true`, `orderBy=startTime`, `maxResults=10`
   - Handle all-day events (`date` vs `dateTime` in start/end)
   - Cache to `~/.myday/calendar-cache.json`

4. **Wire into scheduler** — 5-minute interval

5. **Calendar card renderer** (`src/renderer/cards/calendar.ts`)
   - Event list: time range + summary
   - Highlight current/next event
   - All-day events at top with "All day" label
   - "No more events today" when empty

6. **Register in dashboard**

### Acceptance Criteria
- [ ] `node scripts/auth-google.js` completes OAuth and saves refresh token
- [ ] Calendar events for rest of today display on wallpaper
- [ ] Access token refreshes automatically
- [ ] Updates every 5 minutes
- [ ] All-day events display correctly
- [ ] Handles missing/revoked tokens gracefully

**Complexity:** Medium (OAuth flow)

---

## Phase 4: Strava

**Goal:** Running stats with weekly comparison and training load classification.

### Prerequisites
- Strava API app created at `https://www.strava.com/settings/api`
- `config.json` has Strava credentials

### Steps

1. **Strava auth script** (`scripts/auth-strava.js`)
   - Same pattern as Google auth
   - OAuth URL: `https://www.strava.com/oauth/authorize?client_id={id}&redirect_uri=http://localhost:3000/oauth/callback&response_type=code&scope=activity:read_all`
   - Token exchange: `POST https://www.strava.com/oauth/token`
   - Save to `~/.myday/strava-tokens.json`

2. **Strava token manager** (`src/fetchers/strava.ts`)
   - `getStravaAccessToken(config): Promise<string>`
   - Strava returns new refresh token on each refresh — must save it

3. **Week boundary utility** (`src/fetchers/strava.ts`)
   - `getMondayEpoch(weeksAgo: number): number` — Unix timestamp of Monday 00:00 local time
   - ISO week boundaries (Monday = start of week)

4. **Strava fetcher** (`src/fetchers/strava.ts`)
   - `fetchStrava(config): Promise<StravaData>`
   - Two API calls:
     - This week: `GET /athlete/activities?after={thisMondayEpoch}&per_page=100`
     - Last week: `GET /athlete/activities?after={lastMondayEpoch}&before={thisMondayEpoch}&per_page=100`
   - Filter to `type === 'Run'` only
   - Aggregate per week:
     ```
     totalKm = sum(distance / 1000)
     totalElevation = sum(total_elevation_gain)
     load = totalKm * (1 + totalElevation / 1000)
     ```
   - Classify:
     ```
     ratio = thisWeek.load / lastWeek.load
     ratio > 1.10  → "building"
     ratio 0.90–1.10 → "maintaining"
     ratio < 0.90  → "recovering"
     lastWeek.load === 0 → "insufficient"
     ```
   - Cache to `~/.myday/strava-cache.json`

5. **Wire into scheduler** — 15-minute interval

6. **Strava card renderer** (`src/renderer/cards/strava.ts`)
   - This week stats: total km, runs, elevation, time
   - Training load bars:
     - Last week: gray, full width (reference)
     - This week: proportional width, colored by classification (amber=building, gray=maintaining, teal=recovering)
   - Label: "Building ↑", "Maintaining →", "Recovering ↓"
   - Sub-label: "52 km vs 47 km last week · +11%"
   - `insufficient` case: show this week only, no comparison

7. **Register in dashboard**

### Acceptance Criteria
- [ ] Fetches activities for this week and last week
- [ ] Training load calculated: `km * (1 + elevation / 1000)`
- [ ] Classification correct: building > 1.10, maintaining 0.90–1.10, recovering < 0.90
- [ ] Comparison bars render with correct proportions and colors
- [ ] Updates every 15 minutes
- [ ] Token auto-refreshes, new refresh token saved
- [ ] Zero last-week load shows "insufficient" without division by zero

**Complexity:** Medium

---

## Phase 5: Pomodoro Timer

**Goal:** Fully functional Pomodoro with state machine, persistence, notifications, and clickable UI on the wallpaper.

### Steps

1. **Pomodoro state machine** (`src/pomodoro.ts`)
   - States: `idle → work → break → idle`
   - Persist to `~/.myday/pomodoro.json`: `{ state, startedAt, workMinutes, breakMinutes, sessionCount }`
   - `toggle()`: idle→work (set startedAt, increment sessionCount), work→idle (pause), break→idle (skip)
   - `reset()`: → idle, sessionCount = 0
   - `tick()`: every second, calculate `remainingSeconds = (duration * 60) - ((now - startedAt) / 1000)`
     - If ≤ 0 and work → transition to break, fire notification
     - If ≤ 0 and break → transition to idle, fire notification
   - On startup: restore from disk, recalculate remaining from `startedAt`

2. **Notifications** (`src/pomodoro.ts`)
   - Electron `Notification` API:
     - Work ends: "Work session complete! Time for a break."
     - Break ends: "Break is over! Ready for another session?"

3. **Wire into scheduler and IPC** (`src/scheduler.ts` + `src/main.ts`)
   - Scheduler: `setInterval` at 1000ms, send `pomodoro:tick` via IPC
   - Main: `ipcMain.on('pomodoro:toggle')` and `ipcMain.on('pomodoro:reset')`

4. **Pomodoro card renderer** (`src/renderer/pomodoro.ts`)
   - SVG circular ring with `stroke-dasharray` + `stroke-dashoffset` for progress
   - Colors: idle = gray (#9CA3AF), work = coral (#F97316), break = teal (#14B8A6)
   - Display: `MM:SS`, state label, "Session N"
   - Pulse: CSS `@keyframes` opacity 0.85→1.0, 4s cycle (work), slower (break)
   - Click → `window.myday.togglePomodoro()`
   - Right-click → `window.myday.resetPomodoro()`

5. **Click-through region management** (`src/renderer/pomodoro.ts`)
   - `mouseenter` on Pomodoro card → `window.myday.setClickable(true)`
   - `mouseleave` → `window.myday.setClickable(false)`

6. **Register in dashboard**

### Acceptance Criteria
- [ ] Click ring starts 25-minute work session
- [ ] Ring fills clockwise with correct color per state
- [ ] Timer counts down correctly (MM:SS)
- [ ] Work end → macOS notification → break
- [ ] Break end → notification → idle
- [ ] Session count increments on each work start
- [ ] Right-click resets
- [ ] State persists across restarts (mid-session resumes)
- [ ] Pulse animation visible during work/break
- [ ] Clicks pass through everywhere except Pomodoro card

**Complexity:** Medium-High

---

## Phase 6: Football

**Goal:** Live scores with adaptive polling, standings, goal flash. Most complex phase.

### Prerequisites
- API-Football account with key in `config.json`

### Steps

1. **Fixture loading** (`src/fetchers/football.ts`)
   - `fetchTodayFixtures(config): Promise<Fixture[]>`
   - Two requests per poll (one per league):
     ```
     GET https://v3.football.api-sports.io/fixtures?date={YYYY-MM-DD}&league={id}&season={year}
     Header: x-apisports-key: {apiKey}
     ```
   - Map `fixture.status.short`: NS=Not Started, 1H=First Half, HT=Half Time, 2H=Second Half, FT=Full Time, ET=Extra Time, PEN=Penalties

2. **Standings** (`src/fetchers/football.ts`)
   - `fetchStandings(config, leagueId): Promise<Standing[]>`
   - `GET https://v3.football.api-sports.io/standings?league={id}&season={year}`
   - Cache to `~/.myday/football-standings-{leagueId}.json`

3. **Score cache and goal detection** (`src/fetchers/football.ts`)
   - `scoreCache = new Map<number, { home: number; away: number }>()`
   - `isStartupPoll = true` — populate cache without events on first fetch
   - Compare previous vs new scores, generate `GoalEvent[]`
   - Determine `isFavorite` from `config.football.favoriteTeams`

4. **Adaptive polling** (`src/fetchers/football.ts`)
   - Export `FootballPoller` with `start(win, config)` and `stop()`
   - On startup: fetch today's fixtures (2 requests)
   - No live match: poll every 30 minutes (fixtures + standings)
   - Live match detected (`1H`, `2H`, `HT`, `ET`, `PEN`): switch to 2-minute interval
   - Match ends (all FT/NS): revert to 30 minutes
   - Night mode: skip polling 00:00–07:00
   - Track daily request count; hard stop at 90 requests
   - Log count to `~/.myday/football-requests-{date}.json`

5. **Wire into scheduler** (`src/scheduler.ts`)
   - Initialize `FootballPoller` from scheduler (self-manages its own intervals)

6. **Football card renderer** (`src/renderer/cards/football.ts`)
   - Live: team names, score, match minute, status badge
   - Upcoming: team names, kickoff time
   - Finished: team names, final score, "FT" badge
   - No matches today: league standings (top 5 + favorite team position)
   - Goal flash:
     - Favorite scores → `.goal-flash-green` (`#EAF3DE` bg, `#27500A` text)
     - Opponent scores → `.goal-flash-red` (`#FCEBEB` bg, `#A32D2D` text)
     - Other goal → `.goal-flash-amber` (`#FAEEDA` bg, `#633806` text)
     - Duration: 8 seconds, then 1-second fade-out

7. **Goal flash CSS** (`src/renderer/index.html`)
   ```css
   .goal-flash-green { background: #EAF3DE; color: #27500A; transition: none; }
   .goal-flash-red   { background: #FCEBEB; color: #A32D2D; transition: none; }
   .goal-flash-amber { background: #FAEEDA; color: #633806; transition: none; }
   .fading { transition: background 1s ease, color 1s ease; }
   ```

8. **Register in dashboard**

### Acceptance Criteria
- [ ] Today's fixtures for Premier League and Allsvenskan display
- [ ] Live match score updates every 2 minutes
- [ ] Non-live periods poll every 30 minutes
- [ ] Polling stops 00:00–07:00
- [ ] Malmö FF / Arsenal goal → green flash (8s)
- [ ] Goal against favorite → red flash
- [ ] Other goals → amber flash
- [ ] No flash on startup
- [ ] Standings display when no matches today
- [ ] API requests stay under 100/day
- [ ] Adaptive polling switches correctly between live and idle

**Complexity:** High

---

## Phase 7: Screensaver Mode

**Goal:** After a configurable idle period, the wallpaper elevates above all windows as a screensaver with ambient animations. Any mouse/keyboard input drops it back to desktop level instantly. Replaces the macOS system screensaver.

### Prerequisites
- Phase 1 complete (window level management working)
- User sets macOS screensaver to "Never" in System Settings

### How It Works

```
idle < threshold  →  window level: desktop (behind all windows)
idle ≥ threshold  →  window level: screen-saver (above all windows, fullscreen)
any input         →  back to desktop level, resume normal mode
```

Electron provides `powerMonitor.getSystemIdleTime()` which returns seconds since last mouse/keyboard input — no native modules needed.

### Steps

1. **Screensaver controller** (`src/screensaver.ts`)
   - Action: Implement idle watcher:
     ```ts
     import { powerMonitor, BrowserWindow } from 'electron'

     interface ScreensaverController {
       start(win: BrowserWindow, idleThresholdSeconds: number): void
       stop(): void
     }
     ```
   - Poll `powerMonitor.getSystemIdleTime()` every 5 seconds
   - When idle time ≥ threshold:
     - Elevate window: `win.setAlwaysOnTop(true, 'screen-saver')`
     - Send `screensaver:activate` IPC to renderer
     - Set `win.setIgnoreMouseEvents(false)` so any click wakes it
     - Start watching for input to deactivate
   - When input detected (idle time drops back to 0):
     - Restore window: `win.setAlwaysOnTop(true, 'desktop')` (back to desktop level)
     - Send `screensaver:deactivate` IPC to renderer
     - Restore `win.setIgnoreMouseEvents(true, { forward: true })`
   - Edge case: if Pomodoro is in `work` state, optionally keep Pomodoro timer prominent during screensaver
   - Risk: Low — `powerMonitor` is well-supported on macOS

2. **Config** (`config.json`)
   - Add screensaver settings:
     ```json
     "screensaver": {
       "enabled": true,
       "idleMinutes": 5,
       "dimCards": true,
       "ambientAnimation": true
     }
     ```
   - `idleMinutes`: time before screensaver activates (default 5)
   - `dimCards`: whether to dim data cards in screensaver mode
   - `ambientAnimation`: enable/disable ambient visual effects

3. **Wire into main process** (`src/main.ts`)
   - Import and initialize `ScreensaverController` after window creation
   - Read `config.screensaver.idleMinutes`, convert to seconds
   - Only start if `config.screensaver.enabled` is true

4. **Preload additions** (`src/preload.ts`)
   - Expose two new listeners:
     ```ts
     onScreensaverActivate: (cb: () => void) =>
       ipcRenderer.on('screensaver:activate', () => cb()),
     onScreensaverDeactivate: (cb: () => void) =>
       ipcRenderer.on('screensaver:deactivate', () => cb()),
     ```

5. **Renderer screensaver mode** (`src/renderer/dashboard.ts`)
   - Register `window.myday.onScreensaverActivate`:
     - Add `screensaver-active` class to body
     - Trigger ambient animations
   - Register `window.myday.onScreensaverDeactivate`:
     - Remove `screensaver-active` class
     - Stop ambient animations

6. **Screensaver CSS and animations** (`src/renderer/index.html`)
   - Action: Add screensaver styles:
     ```css
     /* Screensaver mode */
     body.screensaver-active {
       background: radial-gradient(ellipse at center, rgba(10,10,30,0.85), rgba(0,0,0,0.95));
     }

     /* Dim data cards — clock stays prominent */
     body.screensaver-active .card { opacity: 0.5; transition: opacity 2s ease; }
     body.screensaver-active #card-clock { opacity: 1; transform: scale(1.2); transition: all 2s ease; }
     body.screensaver-active #card-pomodoro { opacity: 0.9; }

     /* Subtle ambient glow animation */
     @keyframes ambient-glow {
       0%, 100% { box-shadow: 0 0 30px rgba(100, 140, 255, 0.08); }
       50%      { box-shadow: 0 0 60px rgba(100, 140, 255, 0.15); }
     }
     body.screensaver-active #card-clock {
       animation: ambient-glow 8s ease-in-out infinite;
     }

     /* Slow card drift for visual interest */
     @keyframes gentle-float {
       0%, 100% { transform: translateY(0px); }
       50%      { transform: translateY(-4px); }
     }
     body.screensaver-active .card {
       animation: gentle-float 12s ease-in-out infinite;
     }
     ```
   - The effect: dark ambient background fades in, clock scales up and glows, other cards dim and gently float. Clean and subtle, not distracting.
   - Risk: Low

7. **Wake behavior refinement** (`src/screensaver.ts`)
   - On deactivate: fade out screensaver over 0.5s rather than instant cut
   - Send deactivate slightly before restoring window level so the transition is smooth
   - If a goal flash fires during screensaver mode, bring that card to full opacity momentarily

### Acceptance Criteria
- [ ] After configured idle period, window elevates above all other windows
- [ ] Dark ambient background fades in
- [ ] Clock card scales up and stays prominent
- [ ] Other cards dim to ~50% opacity with gentle float animation
- [ ] Pomodoro card stays semi-visible (0.9 opacity) if timer is active
- [ ] Any mouse movement or keypress instantly deactivates screensaver
- [ ] Window drops back to desktop level on deactivation
- [ ] Click-through behavior restores correctly after deactivation
- [ ] Goal flash during screensaver mode is still visible
- [ ] Screensaver can be disabled via `config.screensaver.enabled: false`
- [ ] No interference with Pomodoro click region after wake

**Complexity:** Medium

---

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| macOS window level — Electron may not support true desktop-level windows natively | High | Test `electron-as-wallpaper` package or native Obj-C bridge early in Phase 1. Fallback: always-on-bottom window. |
| Click-through + clickable Pomodoro — `setIgnoreMouseEvents` toggling may race | Medium | Debounce the toggle. Test rapid mouse movement across boundary. |
| API-Football 100 req/day — two simultaneous live matches could exhaust budget | Medium | Track count in memory. Hard stop at 90. Prefer 3-min polling if tight. |
| Google/Strava token revocation | Low | Catch 401, log message to re-run auth script. Show "Auth required" in card. |
| Network failures | Low | Every fetcher falls back to `~/.myday/` cache. Show "Last updated: X min ago". |
| App restart during Pomodoro | Low | Persist `startedAt` epoch. Recalculate on startup. If elapsed, transition. |
| Timezone handling (Strava weeks, calendar, fixtures) | Medium | Use system timezone via `Intl.DateTimeFormat`. Calculate Monday 00:00 in local time → UTC epoch. |
| Screensaver window level transition — brief flicker when switching levels | Low | Fade the renderer background before changing window level. Send IPC slightly before `setAlwaysOnTop` call. |
| Screensaver + Pomodoro click region — `setIgnoreMouseEvents(false)` during screensaver may conflict with wake detection | Low | On screensaver activate, disable Pomodoro click region. On deactivate, restore. Track pre-screensaver state. |

---

## File Summary

```
myday/
├── package.json
├── tsconfig.json
├── config.json
├── src/
│   ├── main.ts                      ← App entry, window, IPC hub
│   ├── preload.ts                   ← contextBridge: safe APIs to renderer
│   ├── types.ts                     ← Shared type definitions
│   ├── config.ts                    ← Config loader and validator
│   ├── storage.ts                   ← ~/.myday/ file operations
│   ├── scheduler.ts                 ← Interval coordination
│   ├── pomodoro.ts                  ← Timer state machine
│   ├── screensaver.ts               ← Idle watcher, window level toggling
│   ├── fetchers/
│   │   ├── weather.ts               ← Open-Meteo, no key
│   │   ├── calendar.ts              ← Google Calendar OAuth
│   │   ├── strava.ts                ← Weekly stats, training load
│   │   └── football.ts              ← Adaptive polling, goal detection
│   ├── renderer/
│   │   ├── index.html               ← Layout + styles
│   │   ├── myday.d.ts               ← Type declarations for window.myday
│   │   ├── dashboard.ts             ← Orchestrator
│   │   ├── cards/
│   │   │   ├── clock.ts
│   │   │   ├── weather.ts
│   │   │   ├── calendar.ts
│   │   │   ├── strava.ts
│   │   │   └── football.ts
│   │   └── pomodoro.ts              ← Pomodoro UI + click handling
│   └── __tests__/
│       ├── config.test.ts
│       ├── storage.test.ts
│       ├── pomodoro.test.ts
│       └── fetchers/
│           ├── weather.test.ts
│           ├── calendar.test.ts
│           ├── strava.test.ts
│           └── football.test.ts
├── scripts/
│   ├── auth-google.js
│   └── auth-strava.js
└── dist/                            ← tsc output (gitignored)
```
