import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import type { AppConfig } from '../types'

const VALID_CONFIG = {
  location: { city: 'Malmö', latitude: 55.605, longitude: 13.0038 },
  strava: { clientId: '', clientSecret: '', refreshToken: '' },
  google: { clientId: '', clientSecret: '', redirectUri: 'http://localhost:3000/oauth/callback' },
  football: {
    apiKey: '',
    premierLeagueId: 39,
    allsvenskanId: 113,
    favoriteTeams: ['Malmö FF', 'Liverpool'],
    'malmöFFTeamId': 371,
  },
  pomodoro: { workMinutes: 25, breakMinutes: 5 },
  window: { position: 'bottom-left', refreshIntervalMinutes: 5 },
  screensaver: { enabled: true, idleMinutes: 5, dimCards: true, ambientAnimation: true },
}

vi.mock('fs')

describe('loadConfig', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads and returns a valid config', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(VALID_CONFIG))
    const { loadConfig } = await import('../config')
    const config = loadConfig()
    expect(config.location.city).toBe('Malmö')
    expect(config.location.latitude).toBe(55.605)
    expect(config.pomodoro.workMinutes).toBe(25)
    expect(config.screensaver.enabled).toBe(true)
  })

  it('returns a frozen object', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(VALID_CONFIG))
    const { loadConfig } = await import('../config')
    const config = loadConfig()
    expect(Object.isFrozen(config)).toBe(true)
  })

  it('throws when config file is missing', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })
    const { loadConfig } = await import('../config')
    expect(() => loadConfig()).toThrow('Failed to load config')
  })

  it('throws when config has invalid JSON', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue('not valid json {{{')
    const { loadConfig } = await import('../config')
    expect(() => loadConfig()).toThrow('Failed to load config')
  })

  it('throws when location is missing', async () => {
    const { location, ...noLocation } = VALID_CONFIG
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(noLocation))
    const { loadConfig } = await import('../config')
    expect(() => loadConfig()).toThrow('location')
  })

  it('throws when location.latitude is missing', async () => {
    const bad = { ...VALID_CONFIG, location: { city: 'Malmö', longitude: 13.0 } }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(bad))
    const { loadConfig } = await import('../config')
    expect(() => loadConfig()).toThrow('latitude')
  })

  it('throws when location.longitude is missing', async () => {
    const bad = { ...VALID_CONFIG, location: { city: 'Malmö', latitude: 55.6 } }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(bad))
    const { loadConfig } = await import('../config')
    expect(() => loadConfig()).toThrow('longitude')
  })

  it('provides default screensaver config when missing', async () => {
    const { screensaver, ...noScreensaver } = VALID_CONFIG
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(noScreensaver))
    const { loadConfig } = await import('../config')
    const config = loadConfig()
    expect(config.screensaver.enabled).toBe(true)
    expect(config.screensaver.idleMinutes).toBe(5)
  })

  it('provides default pomodoro config when missing', async () => {
    const { pomodoro, ...noPomodoro } = VALID_CONFIG
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(noPomodoro))
    const { loadConfig } = await import('../config')
    const config = loadConfig()
    expect(config.pomodoro.workMinutes).toBe(25)
    expect(config.pomodoro.breakMinutes).toBe(5)
  })
})
