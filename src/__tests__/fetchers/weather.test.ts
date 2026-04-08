import { describe, it, expect } from 'vitest'
import { weatherCodeToText, parseWeatherResponse } from '../../fetchers/weather'
import type { WeatherData } from '../../types'

const VALID_API_RESPONSE = {
  current: {
    temperature_2m: 12.5,
    apparent_temperature: 10.2,
    weather_code: 1,
    wind_speed_10m: 15.3,
  },
  hourly: {
    time: ['2026-04-08T12:00', '2026-04-08T13:00', '2026-04-08T14:00'],
    temperature_2m: [12.5, 13.0, 13.5],
    weather_code: [1, 2, 3],
  },
  daily: {
    temperature_2m_max: [15.0],
    temperature_2m_min: [8.0],
    sunrise: ['2026-04-08T06:15'],
    sunset: ['2026-04-08T19:45'],
  },
}

describe('weatherCodeToText', () => {
  it('maps code 0 to Clear sky', () => {
    expect(weatherCodeToText(0)).toBe('Clear sky')
  })

  it('maps code 1 to Mainly clear', () => {
    expect(weatherCodeToText(1)).toBe('Mainly clear')
  })

  it('maps code 2 to Partly cloudy', () => {
    expect(weatherCodeToText(2)).toBe('Partly cloudy')
  })

  it('maps code 3 to Overcast', () => {
    expect(weatherCodeToText(3)).toBe('Overcast')
  })

  it('maps fog codes (45, 48)', () => {
    expect(weatherCodeToText(45)).toBe('Foggy')
    expect(weatherCodeToText(48)).toBe('Depositing rime fog')
  })

  it('maps rain codes', () => {
    expect(weatherCodeToText(51)).toBe('Light drizzle')
    expect(weatherCodeToText(61)).toBe('Slight rain')
    expect(weatherCodeToText(63)).toBe('Moderate rain')
    expect(weatherCodeToText(65)).toBe('Heavy rain')
  })

  it('maps snow codes', () => {
    expect(weatherCodeToText(71)).toBe('Slight snowfall')
    expect(weatherCodeToText(73)).toBe('Moderate snowfall')
    expect(weatherCodeToText(75)).toBe('Heavy snowfall')
  })

  it('maps thunderstorm codes', () => {
    expect(weatherCodeToText(95)).toBe('Thunderstorm')
    expect(weatherCodeToText(96)).toBe('Thunderstorm with slight hail')
    expect(weatherCodeToText(99)).toBe('Thunderstorm with heavy hail')
  })

  it('returns Unknown for unmapped codes', () => {
    expect(weatherCodeToText(999)).toBe('Unknown')
  })
})

describe('parseWeatherResponse', () => {
  it('parses a valid API response into WeatherData', () => {
    const result = parseWeatherResponse(VALID_API_RESPONSE)
    expect(result.temperature).toBe(12.5)
    expect(result.apparentTemperature).toBe(10.2)
    expect(result.weatherCode).toBe(1)
    expect(result.windSpeed).toBe(15.3)
    expect(result.dailyHigh).toBe(15.0)
    expect(result.dailyLow).toBe(8.0)
    expect(result.sunrise).toBe('2026-04-08T06:15')
    expect(result.sunset).toBe('2026-04-08T19:45')
  })

  it('parses hourly forecast', () => {
    const result = parseWeatherResponse(VALID_API_RESPONSE)
    expect(result.hourlyForecast).toHaveLength(3)
    expect(result.hourlyForecast[0]).toEqual({
      time: '2026-04-08T12:00',
      temperature: 12.5,
      weatherCode: 1,
    })
  })

  it('throws on missing current data', () => {
    const bad = { ...VALID_API_RESPONSE, current: undefined }
    expect(() => parseWeatherResponse(bad)).toThrow()
  })

  it('throws on missing daily data', () => {
    const bad = { ...VALID_API_RESPONSE, daily: undefined }
    expect(() => parseWeatherResponse(bad)).toThrow()
  })

  it('returns empty hourly if hourly data is missing', () => {
    const noHourly = { ...VALID_API_RESPONSE, hourly: undefined }
    const result = parseWeatherResponse(noHourly)
    expect(result.hourlyForecast).toEqual([])
  })
})
