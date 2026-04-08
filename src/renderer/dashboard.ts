import { initClock } from './cards/clock'
import { initWeather } from './cards/weather'

const disposers: Array<() => void> = []

function init(): void {
  const clockContainer = document.getElementById('card-clock')
  if (clockContainer) {
    disposers.push(initClock(clockContainer))
  }

  const weatherContainer = document.getElementById('card-weather')
  if (weatherContainer) {
    disposers.push(initWeather(weatherContainer))
  }
}

document.addEventListener('DOMContentLoaded', init)
