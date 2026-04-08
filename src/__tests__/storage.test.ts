import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

vi.mock('fs')
vi.mock('os')

describe('storage', () => {
  const STORAGE_DIR = '/Users/test/.myday'

  beforeEach(() => {
    vi.resetModules()
    vi.mocked(os.homedir).mockReturnValue('/Users/test')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('ensureStorageDir', () => {
    it('creates ~/.myday if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
      const { ensureStorageDir } = await import('../storage')
      ensureStorageDir()
      expect(fs.mkdirSync).toHaveBeenCalledWith(STORAGE_DIR, { recursive: true })
    })

    it('does not create directory if it already exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      const { ensureStorageDir } = await import('../storage')
      ensureStorageDir()
      expect(fs.mkdirSync).not.toHaveBeenCalled()
    })
  })

  describe('readJson', () => {
    it('reads and parses a JSON file', async () => {
      const data = { state: 'idle', sessionCount: 0 }
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(data))
      const { readJson } = await import('../storage')
      const result = readJson<typeof data>('pomodoro.json')
      expect(result).toEqual(data)
      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.join(STORAGE_DIR, 'pomodoro.json'),
        'utf-8'
      )
    })

    it('returns null when file does not exist', async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        const err = new Error('ENOENT') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      })
      const { readJson } = await import('../storage')
      const result = readJson('missing.json')
      expect(result).toBeNull()
    })

    it('returns null on invalid JSON', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('not json {{')
      const { readJson } = await import('../storage')
      const result = readJson('bad.json')
      expect(result).toBeNull()
    })

    it('rethrows non-ENOENT errors (e.g. permission denied)', async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        const err = new Error('EACCES') as NodeJS.ErrnoException
        err.code = 'EACCES'
        throw err
      })
      const { readJson } = await import('../storage')
      expect(() => readJson('forbidden.json')).toThrow('EACCES')
    })
  })

  describe('writeJson', () => {
    it('writes JSON atomically via temp file and rename', async () => {
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined)
      vi.mocked(fs.renameSync).mockReturnValue(undefined)
      const { writeJson } = await import('../storage')
      const data = { state: 'work', startedAt: 123 }
      writeJson('pomodoro.json', data)

      const tmpPath = path.join(STORAGE_DIR, 'pomodoro.json.tmp')
      const finalPath = path.join(STORAGE_DIR, 'pomodoro.json')
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        tmpPath,
        JSON.stringify(data, null, 2),
        'utf-8'
      )
      expect(fs.renameSync).toHaveBeenCalledWith(tmpPath, finalPath)
    })
  })

  describe('getStorageDir', () => {
    it('returns the storage directory path', async () => {
      const { getStorageDir } = await import('../storage')
      expect(getStorageDir()).toBe(STORAGE_DIR)
    })
  })
})
