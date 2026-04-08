import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const STORAGE_DIR_NAME = '.myday'

export function getStorageDir(): string {
  return path.join(os.homedir(), STORAGE_DIR_NAME)
}

export function ensureStorageDir(): void {
  const dir = getStorageDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function readJson<T>(filename: string): T | null {
  const filePath = path.join(getStorageDir(), filename)
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    if (err instanceof SyntaxError) return null
    throw err
  }
}

export function writeJson<T>(filename: string, data: T): void {
  const dir = getStorageDir()
  const tmpPath = path.join(dir, `${filename}.tmp`)
  const finalPath = path.join(dir, filename)
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmpPath, finalPath)
}
