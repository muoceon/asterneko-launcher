import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { defaultLocale, locales } from "@/config/i18n.config"

const messageLoaders = import.meta.glob<{ default: Record<string, unknown> }>(
  "./messages/**/*.json"
)

const loaderMap: Record<string, Array<() => Promise<Record<string, unknown>>>> = {}
const allNamespaces = new Set<string>()

for (const [path, loader] of Object.entries(messageLoaders)) {
  const relative = path.replace(/^\.\/messages\//, "")
  const parts = relative.split("/")
  const locale = parts[0]
  if (!locales.includes(locale)) continue

  const dirSegments = parts.slice(1, -1)
  const fileName = parts[parts.length - 1].replace(/\.json$/, "")

  const nsPath: string[] = []
  let mergeDirectly = false

  for (const seg of dirSegments) {
    if (seg.startsWith("__")) {
      mergeDirectly = false
    } else if (seg.startsWith("_")) {
      nsPath.push(seg.replace(/^_+/, ""))
      mergeDirectly = true
    } else {
      nsPath.push(seg)
      mergeDirectly = false
    }
  }

  const baseNs = nsPath.join(".")

  if (mergeDirectly) {
    const key = `${locale}/${baseNs}`
    if (!loaderMap[key]) {
      loaderMap[key] = []
    }
    loaderMap[key].push(async () => {
      const module = await loader()
      return module.default
    })
    allNamespaces.add(baseNs)
  } else {
    const nsName = fileName.toLowerCase()
    const fullNs = baseNs ? `${baseNs}.${nsName}` : nsName
    const key = `${locale}/${fullNs}`
    if (!loaderMap[key]) {
      loaderMap[key] = []
    }
    loaderMap[key].push(async () => {
      const module = await loader()
      return module.default
    })
    allNamespaces.add(fullNs)
  }
}

const backend = {
  type: "backend" as const,
  init: () => {},
  read: async (
    language: string,
    namespace: string,
    callback: (err: Error | null, data: unknown) => void
  ) => {
    const key = `${language}/${namespace}`
    const loaders = loaderMap[key]
    if (loaders && loaders.length > 0) {
      try {
        const results = await Promise.all(loaders.map((l) => l()))
        const merged = Object.assign({}, ...results)
        callback(null, merged)
      } catch (err) {
        callback(err as Error, null)
      }
    } else {
      callback(null, null)
    }
  },
}

i18n
  .use(backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: defaultLocale,
    supportedLngs: locales as string[],
    defaultNS: "common",
    ns: Array.from(allNamespaces),
    partialBundledLanguages: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["cookie", "localStorage", "navigator"],
      caches: ["localStorage"],
      lookupCookie: "locale",
    },
  })

export default i18n