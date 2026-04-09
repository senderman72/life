import * as fs from 'fs'
import * as path from 'path'
import type { AppConfig } from './types'

const DEFAULT_SCREENSAVER = {
  enabled: true,
  idleMinutes: 5,
  dimCards: true,
  ambientAnimation: true,
} as const

const DEFAULT_POMODORO = {
  workMinutes: 25,
  breakMinutes: 5,
} as const

const VALID_POSITIONS = new Set(['center', 'bottom-left', 'bottom-right', 'top-left', 'top-right'])

function validate(parsed: unknown): asserts parsed is Record<string, unknown> {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Config validation failed: config must be an object')
  }
  const config = parsed as Record<string, unknown>

  // location (required)
  if (!config.location || typeof config.location !== 'object') {
    throw new Error('Config validation failed: missing location')
  }
  const loc = config.location as Record<string, unknown>
  if (typeof loc.latitude !== 'number') {
    throw new Error('Config validation failed: missing location.latitude')
  }
  if (typeof loc.longitude !== 'number') {
    throw new Error('Config validation failed: missing location.longitude')
  }

  // window.position (if provided)
  if (config.window && typeof config.window === 'object') {
    const win = config.window as Record<string, unknown>
    if (win.position !== undefined && !VALID_POSITIONS.has(win.position as string)) {
      throw new Error(`Config validation failed: window.position must be one of ${[...VALID_POSITIONS].join(', ')}`)
    }
  }
}

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj)
  for (const value of Object.values(obj)) {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as object)
    }
  }
  return obj
}

export function loadConfig(configPath?: string): AppConfig {
  const resolvedPath = configPath ?? path.join(process.cwd(), 'config.json')
  try {
    const raw = fs.readFileSync(resolvedPath, 'utf-8')
    const parsed = JSON.parse(raw)
    validate(parsed)
    const raw_config = parsed as Record<string, unknown>
    const config: AppConfig = {
      ...raw_config,
      pomodoro: { ...DEFAULT_POMODORO, ...(raw_config.pomodoro as object ?? {}) },
      screensaver: { ...DEFAULT_SCREENSAVER, ...(raw_config.screensaver as object ?? {}) },
    } as AppConfig
    return deepFreeze(config)
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Config validation failed')) {
      throw err
    }
    throw new Error(`Failed to load config from ${resolvedPath}: ${err}`)
  }
}
