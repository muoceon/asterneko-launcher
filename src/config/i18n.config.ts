import type { I18nConfig, LocaleConfig } from "./types/i18n.types"

export const localesConfig: LocaleConfig[] = [
  {
    code: "en",
    name: "English",
  },
  {
    code: "zh-Hans",
    name: "简体中文",
  },
] as const

const i18nConfig: I18nConfig = {
  defaultLocale: "en",
  locales: localesConfig,
}

export default i18nConfig

export const defaultLocale = i18nConfig.defaultLocale

export const locales = localesConfig.map((item) => item.code)

export type Locale = (typeof locales)[number]