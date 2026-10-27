const STORAGE_KEY = "asterneko-settings"

export type DownloadChannel = "bmclapi" | "official"

export interface ExtraGameDir {
  path: string
  label: string
}

export interface LauncherSettings {
  locale: string
  maxMemory: string
  javaPath: string
  gameDir: string
  versionIsolation: boolean
  downloadChannel: DownloadChannel
  extraGameDirs: ExtraGameDir[]
}

const defaults: LauncherSettings = {
  locale: "",
  maxMemory: "2 GB",
  javaPath: "",
  gameDir: ".minecraft",
  versionIsolation: true,
  downloadChannel: "bmclapi",
  extraGameDirs: [],
}

function load(): Partial<LauncherSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<LauncherSettings>) : {}
  } catch {
    return {}
  }
}

function save(settings: Partial<LauncherSettings>): void {
  const current = load()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...settings }))
}

export function getSetting<K extends keyof LauncherSettings>(key: K): LauncherSettings[K] {
  const stored = load()
  return (stored[key] as LauncherSettings[K]) ?? defaults[key]
}

export function setSetting<K extends keyof LauncherSettings>(key: K, value: LauncherSettings[K]): void {
  save({ [key]: value })
}

export function getAllSettings(): LauncherSettings {
  const stored = load()
  return { ...defaults, ...stored }
}