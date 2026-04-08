import { initClock } from './cards/clock'

const disposers: Array<() => void> = []

function init(): void {
  const clockContainer = document.getElementById('card-clock')
  if (clockContainer) {
    disposers.push(initClock(clockContainer))
  }

  // IPC listener stubs — wired in subsequent phases
  // window.myday.onWeatherUpdate(...)
  // window.myday.onCalendarUpdate(...)
  // window.myday.onStravaUpdate(...)
  // window.myday.onFootballUpdate(...)
  // window.myday.onPomodoroTick(...)
  // window.myday.onScreensaverActivate(...)
  // window.myday.onScreensaverDeactivate(...)
}

document.addEventListener('DOMContentLoaded', init)
