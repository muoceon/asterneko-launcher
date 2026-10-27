import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { defaultLocale } from "@/config/i18n.config"
import { getSetting } from "@/lib/settings"

export default function LocaleRedirect() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    const persisted = getSetting("locale")
    const detected = persisted || i18n.language || defaultLocale
    navigate(`/${detected}`, { replace: true })
  }, [i18n, navigate])

  return null
}