export interface LocaleConfig {
  code: string
  name: string
}

export interface I18nConfig {
  locales: readonly LocaleConfig[]
  defaultLocale: string
}