import { initClock } from './cards/clock'
import { initWeather } from './cards/weather'
import { initCalendar } from './cards/calendar'

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

  const calendarContainer = document.getElementById('card-calendar')
  if (calendarContainer) {
    disposers.push(initCalendar(calendarContainer))
  }
}

document.addEventListener('DOMContentLoaded', init)
