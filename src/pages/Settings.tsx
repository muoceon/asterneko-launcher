import { useTranslation } from "react-i18next"
import { useMemo, useState, useCallback } from "react"
import {
  Settings as SettingsIcon, Monitor, Gamepad2, Download,
  Info, Palette, Sun, Moon, Languages,
  Folder, Cpu, ChevronRight, Coffee, RefreshCw, Plus,
  Check, Trash2, CircleAlert, Shield, Lock, Globe,
} from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { useLanguage } from "@/hooks/useLanguage"
import { getAllSettings, getSetting, setSetting } from "@/lib/settings"
import type { DownloadChannel } from "@/lib/settings"
import { useJvmScan } from "@/hooks/useJvmScan"
import { Link } from "react-router-dom"

const themeOptions = [
  { key: "light", icon: Sun, labelKey: "settings.appearance.themeLight" },
  { key: "system", icon: Monitor, labelKey: "settings.appearance.themeSystem" },
  { key: "dark", icon: Moon, labelKey: "settings.appearance.themeDark" },
] as const

export default function SettingsPage() {
  const { t } = useTranslation("home")
  const { theme, setTheme } = useTheme()
  const { locale, switchLanguage, locales } = useLanguage()
  const settings = useMemo(() => getAllSettings(), [])
  const [javaPath, setJavaPath] = useState(() => getSetting("javaPath"))
  const [manualPath, setManualPath] = useState("")
  const [addError, setAddError] = useState("")
  const [downloadChannel, setDownloadChannel] = useState<DownloadChannel>(() =>
    getSetting("downloadChannel"),
  )

  const handleJavaPathChange = useCallback((path: string) => {
    setJavaPath(path)
    setSetting("javaPath", path)
  }, [])

  const {
    jvms,
    selectedPath,
    scanning,
    rescan,
    selectJvm,
    addManual,
    removeManual,
  } = useJvmScan(javaPath, handleJavaPathChange)

  const handleAddManual = useCallback(async () => {
    if (!manualPath.trim()) return
    setAddError("")
    const result = await addManual(manualPath.trim())
    if (result) {
      setManualPath("")
      setAddError("")
    } else {
      setAddError("Invalid Java path: no java executable found")
    }
  }, [manualPath, addManual])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleAddManual()
    },
    [handleAddManual],
  )

  const handleChannelChange = useCallback((ch: DownloadChannel) => {
    setDownloadChannel(ch)
    setSetting("downloadChannel", ch)
  }, [])

  const channelOptions: { key: DownloadChannel; labelKey: string }[] = [
    { key: "bmclapi", labelKey: "settings.download.channelBmclapi" },
    { key: "official", labelKey: "settings.download.channelOfficial" },
  ]

  return (
    <div className="flex min-h-full flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">{t("settings.title")}</h1>
      </div>

      <div className="space-y-4">
        {/* Appearance */}
        <div className="rounded-2xl border border-border">
          <div className="flex items-center gap-3 px-5 py-4">
            <Palette className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t("settings.appearance.title")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.appearance.desc")}</p>
            </div>
          </div>

          <div className="border-t border-border px-5 py-3 space-y-3">
            {/* Theme selector */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sun className="h-3.5 w-3.5" />
                {t("settings.appearance.theme")}
              </span>
              <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
                {themeOptions.map((opt) => {
                  const Icon = opt.icon
                  const isActive = theme === opt.key
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setTheme(opt.key as "light" | "system" | "dark")}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {t(opt.labelKey)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Language selector */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Languages className="h-3.5 w-3.5" />
                {t("settings.appearance.language")}
              </span>
              <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
                {locales.map((lang) => {
                  const isActive = lang.code === locale
                  return (
                    <button
                      key={lang.code}
                      onClick={() => switchLanguage(lang.code)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {lang.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Game Settings */}
        <div className="rounded-2xl border border-border">
          <div className="flex items-center gap-3 px-5 py-4">
            <Gamepad2 className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t("settings.game.title")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.game.desc")}</p>
            </div>
          </div>

          <div className="border-t border-border px-5 py-3 space-y-3">
            {/* Max Memory */}
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" />
                {t("settings.game.maxMemory")}
              </span>
              <span className="text-muted-foreground">{settings.maxMemory}</span>
            </div>

            {/* Game Directory */}
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Folder className="h-3.5 w-3.5" />
                {t("settings.game.gameDir")}
              </span>
              <span className="text-muted-foreground">{settings.gameDir}</span>
            </div>
          </div>
        </div>

        {/* Version Isolation */}
        <div className="rounded-2xl border border-border">
          <div className="flex items-center gap-3 px-5 py-4">
            <Shield className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t("settings.game.isolation.title")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.game.isolation.desc")}</p>
            </div>
          </div>

          <div className="border-t border-border px-5 py-3 space-y-3">
            {/* Enable toggle - forced on */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t("settings.game.isolation.enable")}
              </span>
              <div
                className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-primary cursor-default"
              >
                <span className="inline-block h-4 w-4 rounded-full bg-white shadow-sm translate-x-[18px]" />
              </div>
            </div>

            {/* Decorative options - greyed out */}
            <div className="flex items-center justify-between opacity-40">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                {t("settings.game.isolation.isolateSaves")}
              </span>
              <div className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-muted-foreground/15">
                <span className="inline-block h-4 w-4 rounded-full bg-muted-foreground/30 translate-x-[2px]" />
              </div>
            </div>

            <div className="flex items-center justify-between opacity-40">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                {t("settings.game.isolation.isolateMods")}
              </span>
              <div className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-muted-foreground/15">
                <span className="inline-block h-4 w-4 rounded-full bg-muted-foreground/30 translate-x-[2px]" />
              </div>
            </div>

            <div className="flex items-center justify-between opacity-40">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                {t("settings.game.isolation.isolateConfig")}
              </span>
              <div className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-muted-foreground/15">
                <span className="inline-block h-4 w-4 rounded-full bg-muted-foreground/30 translate-x-[2px]" />
              </div>
            </div>

            <div className="flex items-center justify-between opacity-40">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                {t("settings.game.isolation.isolateResourcepacks")}
              </span>
              <div className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-muted-foreground/15">
                <span className="inline-block h-4 w-4 rounded-full bg-muted-foreground/30 translate-x-[2px]" />
              </div>
            </div>
          </div>
        </div>

        {/* Java Runtime */}
        <div className="rounded-2xl border border-border">
          <div className="flex items-center gap-3 px-5 py-4">
            <Coffee className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t("settings.game.javaRuntime")}</p>
              <p className="text-xs text-muted-foreground">
                {jvms.length > 0
                  ? `${jvms.length} JVM${jvms.length > 1 ? "s" : ""} ${t("autoDetected").toLowerCase()}`
                  : t("settings.game.desc")}
              </p>
            </div>
            <button
              onClick={rescan}
              disabled={scanning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? t("settings.game.rescanning") : t("settings.game.rescan")}
            </button>
          </div>

          <div className="border-t border-border">
            {jvms.length === 0 && !scanning ? (
              <div className="px-5 py-4 text-xs text-muted-foreground text-center">
                <CircleAlert className="h-8 w-8 mx-auto mb-2 opacity-40" />
                {t("settings.game.noJavaDetected")}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {jvms.map((jvm) => {
                  const isSelected = jvm.javaExecutable === selectedPath
                  const isManual = jvm.source === "Manual"
                  return (
                    <div
                      key={jvm.javaExecutable}
                      onClick={() => selectJvm(jvm.javaExecutable)}
                      className={`flex items-center gap-3 px-5 py-3 text-xs cursor-pointer transition-colors hover:bg-muted/30 ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <Coffee className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium truncate ${isSelected ? "text-foreground" : ""}`}>
                            {jvm.vendor ? `${jvm.vendor} ` : ""}
                            {jvm.version || "Unknown"}
                          </span>
                          {jvm.arch && (
                            <span className="text-muted-foreground/60 text-[10px]">{jvm.arch}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">
                          {jvm.path}
                          {" · "}
                          <span className={isManual ? "text-orange-400" : "text-green-400"}>
                            {isManual ? t("settings.game.manualSource") : t("settings.game.autoDetected")}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isSelected && (
                          <span className="text-[10px] text-primary font-medium">
                            {t("settings.game.selected")}
                          </span>
                        )}
                        {isManual && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeManual(jvm.javaExecutable)
                            }}
                            className="p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Manual Add */}
          <div className="border-t border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={manualPath}
                  onChange={(e) => { setManualPath(e.target.value); setAddError("") }}
                  onKeyDown={handleKeyDown}
                  placeholder={t("settings.game.manualAddPlaceholder")}
                  className="w-full rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                />
                {addError && (
                  <p className="absolute -bottom-4 left-0 text-[10px] text-red-400">{addError}</p>
                )}
              </div>
              <button
                onClick={handleAddManual}
                disabled={!manualPath.trim()}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                {t("settings.game.manualAddBtn")}
              </button>
            </div>
          </div>
        </div>

        {/* Downloads */}
        <div className="rounded-2xl border border-border">
          <div className="flex items-center gap-3 px-5 py-4">
            <Download className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t("settings.download.title")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.download.desc")}</p>
            </div>
          </div>

          <div className="border-t border-border px-5 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                {t("settings.download.channel")}
              </span>
              <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
                {channelOptions.map((opt) => {
                  const isActive = downloadChannel === opt.key
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleChannelChange(opt.key)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* About */}
        <Link to="../about">
          <div className="rounded-2xl border border-border transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-3 px-5 py-4">
              <Info className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t("settings.about.title")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.about.desc")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}