import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ModeToggle } from "@/components/features/theme/ThemeToggleIcon"
import { LanguageIcon } from "@/components/features/languages/LanguageIcon"
import { ResponsiveSheetMenu } from "@/components/features/ResponsiveSheetMenu/ResponsiveSheetMenu"
import { Logo } from "@/components/layout/Logo"

export default function Nav() {
  const { t, i18n } = useTranslation("nav")

  return (
    <nav className="fixed top-[var(--nav-height)] left-0 right-0 z-40 h-(--nav-height) bg-transparent">
      <div className="container flex justify-between items-center mx-auto px-4 py-4 md:px-6 md:py-5">
        <div className="flex items-center">
          <Logo />
        </div>

        <div className="flex flex-1 justify-end items-center mx-auto gap-2 md:gap-4">
          <div className="hidden md:flex items-center gap-2 md:gap-4">
            <Link
              to={`/${i18n.language}`}
              className="text-base text-primary hover:text-primary/80"
            >
              {t("home")}
            </Link>
          </div>

          <div className="hidden md:block w-px h-6 bg-border" />

          <div className="flex items-center gap-2">
            <ModeToggle />
            <LanguageIcon />
            <ResponsiveSheetMenu />
          </div>
        </div>
      </div>
    </nav>
  )
}