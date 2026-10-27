import { useTranslation } from "react-i18next"
import { NavLink } from "react-router-dom"
import { Logo } from "@/components/layout/Logo"
import { Home, Boxes, Download, Globe, User, Newspaper, Palette, Settings, Info } from "lucide-react"

const tabs = [
  { key: "home", icon: Home },
  { key: "instances", icon: Boxes },
  { key: "download", icon: Download },
  { key: "multiplayer", icon: Globe },
  { key: "account", icon: User },
  { key: "news", icon: Newspaper },
  { key: "theme", icon: Palette },
  { key: "settings", icon: Settings },
  { key: "about", icon: Info },
] as const

export default function Sidebar() {
  const { t } = useTranslation()

  return (
    <aside className="flex w-62 shrink-0 flex-col border-r border-border bg-muted/30">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2 px-6 pt-7 pb-4">
        <div className="inline-flex items-center justify-center rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/15">
          <Logo className="h-9 w-9" />
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold tracking-tight">AST NEKO</h2>
          <p className="text-[11px] text-muted-foreground">{t("home:slogan")}</p>
        </div>
      </div>

      {/* Nav tabs — VS Code style */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-auto px-3 py-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.key === "home" ? "." : tab.key}
            end={tab.key === "home"}
            className={({ isActive }) =>
              [
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-foreground/60 hover:bg-muted/60 hover:text-foreground",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
                )}
                <tab.icon className="h-4 w-4 shrink-0" />
                {t(`nav:${tab.key}`)}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      </aside>
  )
}