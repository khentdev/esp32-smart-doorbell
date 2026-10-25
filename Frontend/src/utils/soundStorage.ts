const DB_NAME = 'smart-door'
const STORE = 'sounds'
const KEY = 'custom'

export const MAX_SOUND_BYTES = 5 * 1024 * 1024
export const MAX_SOUND_SECONDS = 5

export type StoredSound = { blob: Blob; name: string }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export const saveCustomSound = (sound: StoredSound) => run('readwrite', (s) => s.put(sound, KEY))

export async function loadCustomSound(): Promise<StoredSound | null> {
  try {
    return ((await run('readonly', (s) => s.get(KEY))) as StoredSound | undefined) ?? null
  } catch {
    return null
  }
}

export type SoundValidation = { ok: true } | { ok: false; error: string }

const isSupportedType = (file: File) =>
  /\.(mp3|wav)$/i.test(file.name) ||
  ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave'].includes(file.type)

function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    const done = () => URL.revokeObjectURL(url)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      done()
      resolve(audio.duration)
    }
    audio.onerror = () => {
      done()
      reject(new Error('unreadable'))
    }
    audio.src = url
  })
}

/** mp3/wav only, max 5 MB and 5 seconds. */
export async function validateSoundFile(file: File): Promise<SoundValidation> {
  if (!isSupportedType(file)) return { ok: false, error: 'Unsupported file type' }
  if (file.size > MAX_SOUND_BYTES) return { ok: false, error: 'File too large' }
  try {
    const duration = await readDuration(file)
    if (!Number.isFinite(duration) || duration > MAX_SOUND_SECONDS) {
      return { ok: false, error: 'File too large' }
    }
  } catch {
    return { ok: false, error: 'Unsupported file type' }
  }
  return { ok: true }
}
