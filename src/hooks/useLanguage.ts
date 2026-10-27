import { useTranslation } from "react-i18next"
import { useNavigate, useLocation } from "react-router-dom"
import { localesConfig } from "@/config/i18n.config"
import { setSetting } from "@/lib/settings"

export function useLanguage() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const switchLanguage = async (newLocale: string) => {
    await i18n.changeLanguage(newLocale)
    setSetting("locale", newLocale)
    const newPath = location.pathname.replace(/^\/[^/]+/, `/${newLocale}`)
    navigate(newPath, { replace: true })
  }

  return {
    locale: i18n.language,
    switchLanguage,
    locales: localesConfig,
  }
}