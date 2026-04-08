import { initClock } from './cards/clock'
import { initWeather } from './cards/weather'
import { initCalendar } from './cards/calendar'
import { initStrava } from './cards/strava'
import { initFootball } from './cards/football'
import { initStandings } from './cards/standings'

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

  const stravaContainer = document.getElementById('card-strava')
  if (stravaContainer) {
    disposers.push(initStrava(stravaContainer))
  }

  const footballContainer = document.getElementById('card-football')
  if (footballContainer) {
    disposers.push(initFootball(footballContainer))
  }

  const standingsContainer = document.getElementById('card-standings')
  if (standingsContainer) {
    disposers.push(initStandings(standingsContainer))
  }
}

document.addEventListener('DOMContentLoaded', init)
