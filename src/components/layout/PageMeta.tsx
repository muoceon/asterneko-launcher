import { useEffect } from "react"
import { useMatches } from "react-router-dom"
import { useTranslation } from "react-i18next"

export interface RouteMeta {
  key: string
}

export function PageMeta() {
  const { t } = useTranslation("pageMeta")
  const { t: tCommon } = useTranslation("common")
  const matches = useMatches()

  const handle = (matches[matches.length - 1]?.handle ?? matches[matches.length - 2]?.handle) as
    | RouteMeta
    | undefined

  const siteName = tCommon("logoText")

  useEffect(() => {
    if (handle?.key) {
      const title = t(`${handle.key}.title`)
      const description = t(`${handle.key}.description`)
      document.title = `${title} - ${siteName}`

      const descMeta = document.querySelector('meta[name="description"]')
      if (description && description !== `${handle.key}.description`) {
        if (descMeta) {
          descMeta.setAttribute("content", description)
        } else {
          const el = document.createElement("meta")
          el.name = "description"
          el.content = description
          document.head.appendChild(el)
        }
      }
    } else {
      document.title = siteName
    }
  }, [handle, siteName, t])

  return null
}