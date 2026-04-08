import type { AppConfig, WeatherData, HourlyWeather } from '../types'
import { readJson, writeJson } from '../storage'

const WMO_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
}

const CACHE_FILE = 'weather-cache.json'

export function weatherCodeToText(code: number): string {
  return WMO_CODES[code] ?? 'Unknown'
}

function assertNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !isFinite(value)) {
    throw new Error(`Weather response: ${field} is not a valid number`)
  }
  return value
}

export function parseWeatherResponse(raw: Record<string, unknown>): WeatherData {
  const current = raw.current as Record<string, unknown> | undefined
  const daily = raw.daily as Record<string, unknown> | undefined

  if (!current || typeof current !== 'object') {
    throw new Error('Weather response missing current data')
  }
  if (!daily || typeof daily !== 'object') {
    throw new Error('Weather response missing daily data')
  }

  const dailyMax = daily.temperature_2m_max as unknown[] | undefined
  const dailyMin = daily.temperature_2m_min as unknown[] | undefined
  const sunriseArr = daily.sunrise as string[] | undefined
  const sunsetArr = daily.sunset as string[] | undefined

  if (!dailyMax?.length || !dailyMin?.length || !sunriseArr?.length || !sunsetArr?.length) {
    throw new Error('Weather response: daily arrays are empty or missing')
  }

  const hourly = raw.hourly as Record<string, unknown[]> | undefined
  const hourlyForecast: readonly HourlyWeather[] = hourly?.time
    ? (hourly.time as string[]).map((time, i) => ({
        time,
        temperature: (hourly.temperature_2m as number[])[i],
        weatherCode: (hourly.weather_code as number[])[i],
      }))
    : []

  return {
    temperature: assertNumber(current.temperature_2m, 'temperature_2m'),
    apparentTemperature: assertNumber(current.apparent_temperature, 'apparent_temperature'),
    weatherCode: assertNumber(current.weather_code, 'weather_code'),
    windSpeed: assertNumber(current.wind_speed_10m, 'wind_speed_10m'),
    hourlyForecast,
    dailyHigh: assertNumber(dailyMax[0], 'temperature_2m_max'),
    dailyLow: assertNumber(dailyMin[0], 'temperature_2m_min'),
    sunrise: sunriseArr[0],
    sunset: sunsetArr[0],
  }
}

function buildWeatherUrl(latitude: number, longitude: number): string {
  if (!isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error(`Invalid latitude: ${latitude}`)
  }
  if (!isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`Invalid longitude: ${longitude}`)
  }
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m')
  url.searchParams.set('hourly', 'temperature_2m,weather_code')
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,sunrise,sunset')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '1')
  return url.toString()
}

export async function fetchWeather(config: AppConfig): Promise<WeatherData> {
  const { latitude, longitude } = config.location
  const url = buildWeatherUrl(latitude, longitude)

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`)
    }
    const raw = await response.json()
    const data = parseWeatherResponse(raw)
    try { writeJson(CACHE_FILE, data) } catch { /* cache write failure is non-fatal */ }
    return data
  } catch (err) {
    const cached = readJson<WeatherData>(CACHE_FILE)
    if (cached) return cached
    throw new Error(`Weather fetch failed and no cache available: ${err}`)
  }
}
