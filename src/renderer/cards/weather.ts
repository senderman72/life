import type { WeatherData } from '../../types'

const WMO_LABELS: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Light freezing rain', 67: 'Heavy freezing rain',
  71: 'Slight snowfall', 73: 'Moderate snowfall', 75: 'Heavy snowfall', 77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
}

function weatherIcon(code: number): string {
  if (code === 0) return '\u2600\uFE0F'
  if (code <= 3) return '\u26C5'
  if (code <= 48) return '\uD83C\uDF2B\uFE0F'
  if (code <= 67) return '\uD83C\uDF27\uFE0F'
  if (code <= 77) return '\u2744\uFE0F'
  if (code <= 82) return '\uD83C\uDF26\uFE0F'
  return '\u26A1'
}

function formatSunTime(isoTime: string): string {
  const date = new Date(isoTime)
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

function renderWeather(container: HTMLElement, data: WeatherData): void {
  container.textContent = ''

  const main = document.createElement('div')
  main.className = 'weather-main'

  const icon = document.createElement('span')
  icon.className = 'weather-icon'
  icon.textContent = weatherIcon(data.weatherCode)

  const temp = document.createElement('span')
  temp.className = 'weather-temp'
  temp.textContent = `${Math.round(data.temperature)}\u00B0`

  main.append(icon, temp)

  const condition = document.createElement('div')
  condition.className = 'weather-condition'
  condition.textContent = WMO_LABELS[data.weatherCode] ?? 'Unknown'

  const details = document.createElement('div')
  details.className = 'weather-details'
  details.textContent = `Feels like ${Math.round(data.apparentTemperature)}\u00B0 \u00B7 Wind ${Math.round(data.windSpeed)} km/h`

  const range = document.createElement('div')
  range.className = 'weather-range'
  range.textContent = `\u2191 ${Math.round(data.dailyHigh)}\u00B0  \u2193 ${Math.round(data.dailyLow)}\u00B0`

  const sun = document.createElement('div')
  sun.className = 'weather-sun'
  sun.textContent = `\u2600 ${formatSunTime(data.sunrise)}  \u263E ${formatSunTime(data.sunset)}`

  container.append(main, condition, details, range, sun)
}

export function initWeather(container: HTMLElement): () => void {
  return window.myday.onWeatherUpdate((data: WeatherData) => {
    renderWeather(container, data)
  })
}
