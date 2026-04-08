# MyDay — desktop wallpaper build plan

## What it is

An Electron app that sits as an interactive background on your macOS desktop,
behind all windows. It shows personal data at a glance — calendar, weather,
running stats, and football scores — and three active features: a Pomodoro
timer, live score flashing, and weekly training load comparison.

---

## Tech stack

| Layer      | Choice                             | Why                                            |
| ---------- | ---------------------------------- | ---------------------------------------------- |
| Shell      | Electron + TypeScript              | macOS desktop window control, IPC, file access |
| Renderer   | Vanilla HTML + CSS + JS            | No framework overhead, fast DOM updates        |
| Build      | tsc only                           | No bundler needed for this scale               |
| Storage    | `~/.myday/` local files            | Tokens, Pomodoro state, cached API responses   |
| Scheduling | Node `setInterval` in main process | Simple, no cron dependency                     |

---

## Project structure

```
myday/
├── src/
│   ├── main.ts                  ← Electron entry, window, IPC hub
│   ├── preload.ts               ← contextBridge: exposes safe APIs to renderer
│   ├── scheduler.ts             ← Controls all fetch intervals, live match mode
│   ├── pomodoro.ts              ← Timer state machine, persists to disk
│   ├── fetchers/
│   │   ├── weather.ts           ← Open-Meteo, no key
│   │   ├── strava.ts            ← This + last week stats, training load
│   │   ├── calendar.ts          ← Google Calendar OAuth
│   │   └── football.ts          ← API-Football, adaptive polling
│   └── renderer/
│       ├── index.html           ← Layout, card structure
│       ├── dashboard.ts         ← Orchestrates all card renders
│       ├── cards/
│       │   ├── clock.ts         ← Live clock + date
│       │   ├── weather.ts       ← Weather card render
│       │   ├── calendar.ts      ← Calendar card render
│       │   ├── strava.ts        ← Weekly stats + training load card
│       │   └── football.ts      ← Live scores + goal flash
│       └── pomodoro.ts          ← Pomodoro UI, pulse animation, controls
├── scripts/
│   └── auth-google.js           ← One-time OAuth flow, saves token
├── config.json                  ← Tokens, preferences, lat/lon
├── package.json
└── tsconfig.json
```

---

## APIs and request budgets

### Open-Meteo (weather)

- Free, no key, no rate limit worth worrying about
- Fetch: every 30 minutes
- Endpoint: `GET /v1/forecast` with `current` + `hourly` + `daily`

### Google Calendar

- Free OAuth with your own account
- Fetch: every 5 minutes
- Refresh access token automatically when it expires (use stored refresh token)
- Endpoint: `GET /calendar/v3/calendars/primary/events`

### Strava

- Free OAuth, 100 req/15 min / 1000 req/day — plenty
- Fetch: every 15 minutes (data doesn't change faster than that)
- Two calls per fetch:
  - `GET /athlete/activities?after={monday_epoch}` → this week
  - `GET /athlete/activities?after={last_monday_epoch}&before={this_monday_epoch}` → last week
- Training load = total weekly km (this vs last), classified as:
  - **Building** if this week > last week × 1.10
  - **Maintaining** if within ±10%
  - **Recovering** if this week < last week × 0.90

### API-Football (football)

- Free tier: 100 requests/day
- **Smart adaptive polling** — the key design decision:
  - On startup: check today's fixtures for both leagues (2 requests)
  - No live match: refresh standings + next fixture every 30 minutes (2 req/30 min)
  - Live match detected: switch to every 2 minutes (1 req/2 min per active match)
  - Match ends: revert to 30-minute polling
- Budget math for a typical day:
  - 2 startup requests
  - ~30 slow-poll requests across the day (one every 30 min)
  - ~45 live requests per match (90 min ÷ 2 min)
  - Two matches in one day ≈ 2 + 30 + 90 = **122 requests** — slightly over
  - Mitigation: only switch to 2-min polling when `fixture.status` is live,
    skip polling between 00:00–07:00
- Endpoints used:
  - `GET /fixtures?date={today}&league={id}&season={year}`
  - `GET /standings?league={id}&season={year}`

---

## Feature specifications

### 1. Pomodoro timer

**State machine** — four states: `idle → work → break → idle`

**Storage** — persist state to `~/.myday/pomodoro.json` so it survives app restarts:

```json
{
  "state": "work",
  "startedAt": 1712567400000,
  "workMinutes": 25,
  "breakMinutes": 5,
  "sessionCount": 3
}
```

**Configuration** — in `config.json`:

```json
"pomodoro": {
  "workMinutes": 25,
  "breakMinutes": 5
}
```

**IPC flow:**

- Renderer → main: `pomodoro:toggle` (start/pause), `pomodoro:reset`
- Main → renderer: `pomodoro:tick` every second with `{ state, remainingSeconds, sessionCount }`

**UI behaviour:**

- Idle: shows a small circular ring, muted gray, clickable
- Work: ring fills clockwise in coral/orange, pulses subtly every ~4 seconds
- Break: ring fills in teal/green, slower pulse
- The card shows: time remaining (MM:SS), state label, session count (e.g. "session 3")
- Pulse = a gentle `opacity` keyframe animation on the ring, not a scale effect
- macOS notification when work session ends and when break ends (via Electron's
  `Notification` API — no extra dependency)

**Controls** — clicking the ring on the wallpaper toggles start/pause. Right-click resets.
Since the wallpaper is non-focusable, clicks are forwarded via `setIgnoreMouseEvents(false)`
on the Pomodoro card region only using `ipcMain` + `BrowserWindow.fromWebContents`.

### 2. Live score goal flash

**Normal state:** match cards show score quietly — same style as the rest of the dashboard.

**Goal detection:** compare previous score snapshot to new score on each poll.
Store last known score in memory:

```ts
const scoreCache = new Map<number, { home: number; away: number }>();
```

**Flash logic:**

- Malmö FF or Arsenal scores → green flash (`#EAF3DE` background, `#27500A` text)
- Opponent scores against your team → red flash (`#FCEBEB`, `#A32D2D`)
- Any other goal in either league → neutral amber flash (`#FAEEDA`, `#633806`)
- Flash duration: 8 seconds, then fade back to normal over 1 second
- Implementation: CSS class added to the card, removed after timeout
- No flash on app startup (don't flash stale scores from before launch)

**IPC:** main process detects goal, sends `football:goal` event to renderer with
`{ fixtureId, scoringTeam, isFavorite, newScore }`. Renderer handles the animation.

### 3. Weekly training load

**Data needed** — two Strava fetches (already described above):

- `thisWeek`: sum of `distance` + `moving_time` + `total_elevation_gain` for Mon–now
- `lastWeek`: same for last full Mon–Sun

**Load score** — use a simple proxy: km × (1 + elevation_m / 1000).
This gives a single comparable number that accounts for both distance and climbing.

**Classification:**

```
ratio = thisWeek.load / lastWeek.load

ratio > 1.10  → "building"   (show in amber — pushing up)
ratio 0.90–1.10 → "maintaining" (show in gray — steady)
ratio < 0.90  → "recovering"  (show in teal — pulling back)
```

**UI — training load card section:**

- Two bars side by side: last week (gray, full width = reference) and this week
  (colored by classification, width = proportional to last week)
- Label: "building ↑", "maintaining →", or "recovering ↓" next to the bars
- Sub-label: e.g. "52 km vs 47 km last week · +11%"
- If last week is zero (first week of tracking), skip classification, just show this week

---

## Window setup (macOS)

```ts
win.setLevel(-1); // below all normal windows
win.setVisibleOnAllWorkspaces(true); // shows on every Space
win.setIgnoreMouseEvents(true, { forward: true }); // default: clicks pass through
```

The Pomodoro card region overrides this locally using hit-testing:

```ts
// In renderer, on mousemove near the Pomodoro card:
window.myday.setClickable(true); // enables clicks on that region
// On mouseleave:
window.myday.setClickable(false); // pass-through resumes
```

---

## Data flow summary

```
main.ts
  └── scheduler.ts
        ├── every 10s   → pomodoro.ts tick → IPC → renderer pomodoro card
        ├── every 5 min → calendar.ts     → IPC → renderer calendar card
        ├── every 15min → strava.ts       → IPC → renderer strava cards
        ├── every 30min → weather.ts      → IPC → renderer weather card
        └── adaptive    → football.ts     → IPC → renderer football cards
                                                      └── goal detected → flash event
```

---

## Config shape

```json
{
  "location": {
    "city": "Malmö",
    "latitude": 55.605,
    "longitude": 13.0038
  },
  "strava": {
    "clientId": "",
    "clientSecret": "",
    "refreshToken": ""
  },
  "google": {
    "clientId": "",
    "clientSecret": "",
    "redirectUri": "http://localhost:3000/oauth/callback"
  },
  "football": {
    "apiKey": "",
    "premierLeagueId": 39,
    "allsvenskanId": 113,
    "favoriteTeams": ["Malmö FF", "Liverpool"],
    "malmöFFTeamId": 371
  },
  "pomodoro": {
    "workMinutes": 25,
    "breakMinutes": 5
  },
  "window": {
    "position": "bottom-left",
    "refreshIntervalMinutes": 5
  }
}
```

---

## Build and run

```bash
npm install
node scripts/auth-google.js     # once only
npm run build
npm start
```

---

## Phased build order (recommended)

Build in this order so you always have something working:

1. **Window shell** — Electron window at desktop level, blank white cards, clock ticking
2. **Weather** — first real data, easiest API, validates the IPC pipeline
3. **Calendar** — OAuth flow, confirms tokens work
4. **Strava** — two fetches, training load calculation
5. **Pomodoro** — state machine + IPC, no external dependency
6. **Football** — adaptive polling, score cache, goal flash last (most complex)
