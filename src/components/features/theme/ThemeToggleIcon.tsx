import { Moon, Sun } from "lucide-react"
import { useThemeToggle } from "@/hooks/useThemeToggle"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { t } = useTranslation("nav")
  const { isDark, toggleTheme } = useThemeToggle()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      aria-label={t("themeToggle.change")}
    >
      <span className="relative inline-flex items-center justify-center w-[0.9rem] h-[0.9rem]">
        <Sun className="absolute h-[0.9rem] w-[0.9rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute h-[0.9rem] w-[0.9rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </span>
      <span className="ml-1.5 text-xs font-normal">{isDark ? t("themeToggle.dark") : t("themeToggle.light")}</span>
    </Button>
  )
}