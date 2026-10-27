import { useLanguage } from "@/hooks/useLanguage"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Globe } from "lucide-react"

export function LanguageIcon() {
  const { locale, switchLanguage, locales } = useLanguage()
  const current = locales.find((lang) => lang.code === locale)
  const { t } = useTranslation("nav")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("language.change")}>
          <Globe className="h-[0.9rem] w-[0.9rem]" />
          <span className="ml-1.5 text-xs font-normal">{current?.name ?? locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {locales
            .filter((l) => l.code !== locale)
            .map((l) => (
              <DropdownMenuItem
                key={l.code}
                onClick={() => switchLanguage(l.code)}
              >
                {l.name}
              </DropdownMenuItem>
            ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}