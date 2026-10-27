import { useTranslation } from "react-i18next"
import { useVersionList } from "@/hooks/useVersionList"
import type { VersionFilter, ManifestVersion } from "@/hooks/useVersionList"
import { Search, Download, Package, Loader2 } from "lucide-react"
import { useCallback, useState, useRef, useEffect } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { invoke } from "@tauri-apps/api/core"
import { getSetting } from "@/lib/settings"
import { VersionInstallDialog } from "@/components/download/VersionInstallDialog"
import type { InstallOptions } from "@/components/download/VersionInstallDialog"
import { useTaskManager } from "@/contexts/TaskManagerContext"

const ESTIMATED_ROW_HEIGHT = 64
const OVERSCAN = 5

const filterOptions: { key: VersionFilter; labelKey: string }[] = [
  { key: "release", labelKey: "download.version.filterRelease" },
  { key: "snapshot", labelKey: "download.version.filterSnapshot" },
  { key: "old", labelKey: "download.version.filterOld" },
  { key: "april_fools", labelKey: "download.version.filterAprilFools" },
]

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  } catch {
    return iso
  }
}

export default function VersionTab() {
  const { t } = useTranslation("home")
  const { versions, loading, filter, setFilter, search, setSearch } = useVersionList()
  const { addTask, markTaskError } = useTaskManager()
  const [dialogVersion, setDialogVersion] = useState<ManifestVersion | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: versions.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
  })

  // Reset scroll position when version list changes (filter/search switch)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [versions])

  const handleInstallClick = useCallback((version: ManifestVersion) => {
    setDialogVersion(version)
  }, [])

  const handleDialogConfirm = useCallback(async (opts: InstallOptions) => {
    if (!dialogVersion) return
    const name = opts.instanceName || dialogVersion.id
    const taskId = crypto.randomUUID()
    addTask(name, taskId, opts.loader ? "install" : "install")
    try {
      await invoke("install_version", {
        options: {
          taskId: taskId,
          versionId: dialogVersion.id,
          gameDir: getSetting("gameDir") || ".minecraft",
          downloadChannel: getSetting("downloadChannel"),
          instanceName: opts.instanceName,
          loader: opts.loader,
          loaderVersion: opts.loaderVersion,
        },
      })
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      console.error("安装失败:", errMsg)
      markTaskError(taskId, errMsg)
    }
    setDialogVersion(null)
  }, [dialogVersion, addTask, markTaskError])

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Filter + Search Bar */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                filter === opt.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("download.version.search")}
            className="w-full rounded-lg border border-border bg-muted/30 py-1.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary/40 focus:bg-background"
          />
        </div>
      </div>

      {/* Version List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : versions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">没有找到匹配的版本</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-auto rounded-xl border border-border/40"
        >
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const v = versions[virtualItem.index]
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full px-1"
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                    paddingBottom: "6px",
                  }}
                >
                  <VersionCard
                    version={v}
                    t={t}
                    onInstall={() => handleInstallClick(v)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Install Dialog */}
      {dialogVersion && (
        <VersionInstallDialog
          open={dialogVersion !== null}
          version={dialogVersion}
          channel={getSetting("downloadChannel")}
          onClose={() => setDialogVersion(null)}
          onConfirm={handleDialogConfirm}
          loading={false}
        />
      )}
    </div>
  )
}

function VersionCard({
  version,
  t,
  onInstall,
}: {
  version: ManifestVersion
  t: (key: string) => string
  onInstall: () => void
}) {
  const typeLabel: Record<string, string> = {
    release: t("download.version.filterRelease"),
    snapshot: t("download.version.filterSnapshot"),
    old_beta: "Beta",
    old_alpha: "Alpha",
    old: "Old",
  }
  const typeColor: Record<string, string> = {
    release: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    snapshot: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    old_beta: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    old_alpha: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    old: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  }
  const vType = version.type || "release"
  const label = typeLabel[vType] ?? vType
  const color = typeColor[vType] ?? typeColor.release

  return (
    <div className="rounded-xl border border-border bg-card transition-all hover:border-primary/25 hover:bg-muted/20">
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
          <Package className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {version.id}
            </span>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}
            >
              {label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(version.releaseTime)}
          </p>
        </div>

        {/* Action */}
        <button
          type="button"
          onClick={onInstall}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm cursor-pointer hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          <Download className="h-3 w-3" />
          {t("download.version.install")}
        </button>
      </div>
    </div>
  )
}