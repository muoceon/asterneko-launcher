import { useState, useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { X, Package, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { invoke } from "@tauri-apps/api/core"
import type { ManifestVersion } from "@/hooks/useVersionList"

export type ModLoader = "" | "fabric" | "forge" | "neoforge" | "quilt"

export interface LoaderVersion {
  id: string
  type: "release" | "snapshot"
}

const loaderOptions: { key: Exclude<ModLoader, "">; labelKey: string }[] = [
  { key: "fabric", labelKey: "download.version.installDialog.loader.fabric" },
  { key: "forge", labelKey: "download.version.installDialog.loader.forge" },
  { key: "neoforge", labelKey: "download.version.installDialog.loader.neoforge" },
  { key: "quilt", labelKey: "download.version.installDialog.loader.quilt" },
]

const versionTypeBadge: Record<LoaderVersion["type"], { labelKey: string; className: string }> = {
  release: {
    labelKey: "download.version.installDialog.versionType.release",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  snapshot: {
    labelKey: "download.version.installDialog.versionType.snapshot",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
}

export interface InstallOptions {
  instanceName: string
  loader: ModLoader
  loaderVersion: string
}

interface VersionInstallDialogProps {
  open: boolean
  version: ManifestVersion
  channel: string
  onClose: () => void
  onConfirm: (options: InstallOptions) => void
  loading?: boolean
}

export function VersionInstallDialog({
  open,
  version,
  channel,
  onClose,
  onConfirm,
  loading = false,
}: VersionInstallDialogProps) {
  const { t } = useTranslation("home")
  const [instanceName, setInstanceName] = useState(version.id)
  const [loader, setLoader] = useState<ModLoader>("")
  const [loaderVersion, setLoaderVersion] = useState("")
  const [availableVersions, setAvailableVersions] = useState<LoaderVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInstanceName(version.id)
    setLoader("")
    setLoaderVersion("")
    setAvailableVersions([])
  }, [version.id, open])

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  const fetchVersions = useCallback(
    async (l: Exclude<ModLoader, "">) => {
      setVersionsLoading(true)
      try {
        const versions: LoaderVersion[] = await invoke("fetch_loader_versions", {
          loader: l,
          mcVersion: version.id,
          channel,
        })
        setAvailableVersions(versions)
        if (versions.length > 0) {
          setLoaderVersion(versions[0].id)
        }
      } catch (e) {
        console.error("获取加载器版本失败:", e)
        setAvailableVersions([])
      } finally {
        setVersionsLoading(false)
      }
    },
    [version.id, channel],
  )

  const handleLoaderToggle = useCallback(
    (l: Exclude<ModLoader, "">) => {
      setLoader((prev) => {
        if (prev === l) {
          setLoaderVersion("")
          setAvailableVersions([])
          return ""
        }
        void fetchVersions(l)
        return l
      })
    },
    [fetchVersions],
  )

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose],
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const name = instanceName.trim() || version.id
      onConfirm({ instanceName: name, loader, loaderVersion })
    },
    [instanceName, loader, loaderVersion, version.id, onConfirm],
  )

  if (!open) return null

  const hasLoader = loader !== ""

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px] animate-in fade-in-0 duration-150"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 fade-in-0 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {version.id}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("download.version.installDialog.title")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Instance Name */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="instance-name"
                className="text-xs font-medium text-foreground"
              >
                {t("download.version.installDialog.instanceName")}
              </label>
              <input
                ref={inputRef}
                id="instance-name"
                type="text"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder={version.id}
                disabled={loading}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
              />
              <p className="text-[11px] text-muted-foreground/60">
                {t("download.version.installDialog.instanceNameHint")}
              </p>
            </div>

            {/* Loader Selection */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-medium text-foreground">
                {t("download.version.installDialog.loaderLabel")}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {loaderOptions.map((opt) => {
                  const isSelected = loader === opt.key
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleLoaderToggle(opt.key)}
                      disabled={loading}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer border disabled:opacity-50 ${
                        isSelected
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                      }`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  )
                })}
              </div>

              {/* Loader Version */}
              {hasLoader && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {t("download.version.installDialog.loaderVersion")}
                  </span>
                  {versionsLoading ? (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t("download.version.installDialog.loading")}
                    </span>
                  ) : availableVersions.length === 0 ? (
                    <span className="text-xs text-muted-foreground/50">
                      {t("download.version.installDialog.loader.noVersions")}
                    </span>
                  ) : (
                    <Select
                      value={loaderVersion}
                      onValueChange={setLoaderVersion}
                      disabled={loading}
                    >
                      <SelectTrigger
                        size="sm"
                        className="flex-1 text-xs min-w-0 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {availableVersions.map((v) => {
                          const badge = versionTypeBadge[v.type]
                          return (
                            <SelectItem key={v.id} value={v.id}>
                              <span className="flex items-center gap-2">
                                <span>{v.id}</span>
                                <span
                                  className={`inline-block rounded-full px-1.5 py-0 text-[10px] font-semibold leading-relaxed ${badge.className}`}
                                >
                                  {t(badge.labelKey)}
                                </span>
                              </span>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={loading}
            >
              {t("download.version.installDialog.cancel")}
            </Button>
            <Button type="submit" disabled={loading || !instanceName.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("download.version.installDialog.installing")}
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  {t("download.version.installDialog.confirm")}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}