import { useEffect } from "react"
import { Outlet, useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { locales, defaultLocale } from "@/config/i18n.config"
import { PageMeta } from "@/components/layout/PageMeta"

export default function LocaleGuard() {
  const { locale } = useParams<{ locale: string }>()
  const { i18n } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!locale) return

    if (!locales.includes(locale)) {
      navigate(`/${defaultLocale}`, { replace: true })
      return
    }

    if (i18n.language !== locale) {
      i18n.changeLanguage(locale)
    }
  }, [locale, i18n, navigate])

  return (
    <>
      <PageMeta />
      <Outlet />
    </>
  )
}