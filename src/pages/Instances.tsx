import { useTranslation } from "react-i18next"
import { useState, useCallback, useEffect } from "react"
import {
  Boxes, Plus, Play, Trash2, Loader2, FolderOpen, ExternalLink,
  FolderTree, X,
} from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { Link } from "react-router-dom"
import { getSetting, setSetting, type ExtraGameDir } from "@/lib/settings"
import { Button } from "@/components/ui/button"
import { InstanceDetailPopup } from "@/components/instance/InstanceDetailPopup"

/* ──────────── types ──────────── */

export interface Instance {
  id: string
  name: string
  versionId: string
  loader?: string
  loaderVersion?: string
  customDir?: string
  gameDir: string
  createdAt: string
  status: "ready" | "installing" | "error"
}

type InstanceTab = "games" | "namespaces"
type InstanceFilter = "all" | "vanilla" | "fabric" | "forge" | "neoforge" | "quilt"

const filterOptions: { key: InstanceFilter; labelKey: string }[] = [
  { key: "all", labelKey: "instance.filterAll" },
  { key: "vanilla", labelKey: "instance.filterVanilla" },
  { key: "fabric", labelKey: "instance.filterFabric" },
  { key: "forge", labelKey: "instance.filterForge" },
  { key: "neoforge", labelKey: "instance.filterNeoForge" },
  { key: "quilt", labelKey: "instance.filterQuilt" },
]

const loaderNames: Record<string, string> = {
  vanilla: "Vanilla", fabric: "Fabric", forge: "Forge",
  neoforge: "NeoForge", quilt: "Quilt",
}
const loaderColors: Record<string, string> = {
  vanilla: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  fabric: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  forge: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  neoforge: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  quilt: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
}
const statusColors: Record<string, string> = {
  ready: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  installing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  error: "bg-red-500/10 text-red-600 dark:text-red-400",
}

const tabs: { key: InstanceTab; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "games", labelKey: "instance.tabs.games", icon: Boxes },
  { key: "namespaces", labelKey: "instance.tabs.namespaces", icon: FolderTree },
]

/* ──────────── helpers ──────────── */

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  } catch { return iso }
}

/* ──────────── page ──────────── */

export default function InstancesPage() {
  const { t } = useTranslation("home")
  const [activeTab, setActiveTab] = useState<InstanceTab>("games")

  return (
    <div className="flex min-h-full flex-col">
      {/* Header — mirror download page */}
      <div className="flex items-center gap-3 px-8 pt-8 pb-2">
        <Boxes className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">
          {t("instance.title")}
        </h1>
      </div>

      {/* Tab Bar — mirror download page */}
      <div className="px-8 pb-4">
        <div className="flex rounded-xl border border-border bg-muted/30 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(tab.labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 px-8 pb-8 min-h-0">
        {activeTab === "games" ? <GamesTab /> : <NamespacesTab />}
      </div>
    </div>
  )
}

/* =============================
   Games Tab — merged instances
   ============================= */

function GamesTab() {
  const { t } = useTranslation("home")
  const [instances, setInstances] = useState<(Instance & { namespaceLabel: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<InstanceFilter>("all")

  const [deleteTarget, setDeleteTarget] = useState<Instance | null>(null)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [selectedInstance, setSelectedInstance] = useState<(Instance & { namespaceLabel: string }) | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const defaultDir = getSetting("gameDir")
      const extras = getSetting("extraGameDirs")
      const allDirs = [{ dir: defaultDir, label: t("instance.namespace.default") },
        ...extras.map((e) => ({ dir: e.path, label: e.label || e.path.split(/[/\\]/).pop() || e.path }))]

      const results = await Promise.allSettled(
        allDirs.map(async ({ dir, label }) => {
          const list: Instance[] = await invoke("list_instances", { gameDir: dir })
          return list.map((inst) => ({ ...inst, namespaceLabel: label }))
        }),
      )

      const merged = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      setInstances(merged)
    } catch (e) {
      console.error("加载实例失败:", e)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { loadAll() }, [loadAll])

  const filtered = instances.filter((inst) => {
    if (filter === "all") return true
    if (filter === "vanilla") return !inst.loader || inst.loader === "vanilla"
    return inst.loader === filter
  })

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await invoke("delete_instance", {
        gameDir: deleteTarget.gameDir,
        instanceId: deleteTarget.id,
        deleteFiles,
      })
      setDeleteTarget(null)
      await loadAll()
    } catch (e) {
      console.error("删除失败:", e)
    } finally { setDeleting(false) }
  }, [deleteTarget, deleteFiles, loadAll])

  return (
    <div className="flex flex-col gap-4">
      {/* Filter + New Instance */}
      <div className="flex items-center justify-between gap-3 shrink-0">
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

        <Link to="../download">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t("instance.newInstance")}
          </Button>
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Boxes className="h-12 w-12 text-muted-foreground/25" />
          <p className="text-sm text-muted-foreground">{t("instance.empty")}</p>
          <p className="text-xs text-muted-foreground/60">{t("instance.emptyHint")}</p>
          <Link to="../download" className="mt-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              {t("instance.goDownload")}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((inst) => (
            <InstanceCard
              key={`${inst.gameDir}::${inst.id}`}
              instance={inst}
              t={t}
              onDelete={() => { setDeleteTarget(inst); setDeleteFiles(false) }}
              onClick={() => { setSelectedInstance(inst); setDetailOpen(true) }}
            />
          ))}
        </div>
      )}

      {/* Instance Detail Popup */}
      <InstanceDetailPopup
        open={detailOpen}
        onOpenChange={setDetailOpen}
        instance={selectedInstance}
      />

      {/* Delete Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px] animate-in fade-in-0 duration-150">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 fade-in-0 duration-150">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold text-foreground">{t("instance.deleteDialog.title")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("instance.deleteDialog.desc", { name: deleteTarget.name })}
              </p>
            </div>
            <div className="flex flex-col gap-3 px-6 py-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="deleteMode" checked={!deleteFiles}
                  onChange={() => setDeleteFiles(false)} className="mt-0.5 h-3.5 w-3.5 accent-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{t("instance.deleteDialog.keepFiles")}</p>
                  <p className="text-xs text-muted-foreground">{t("instance.deleteDialog.keepFilesHint")}</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="deleteMode" checked={deleteFiles}
                  onChange={() => setDeleteFiles(true)} className="mt-0.5 h-3.5 w-3.5 accent-destructive" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-destructive">{t("instance.deleteDialog.deleteAll")}</p>
                  <p className="text-xs text-muted-foreground">{t("instance.deleteDialog.deleteAllHint")}</p>
                </div>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer">
                {t("instance.deleteDialog.cancel")}
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground shadow-sm transition-all hover:bg-destructive/90 disabled:opacity-50 cursor-pointer">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {t("instance.deleteDialog.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* =============================
   Namespaces Tab — dir management
   ============================= */

function NamespacesTab() {
  const { t } = useTranslation("home")
  const defaultDir = getSetting("gameDir")
  const [extras, setExtras] = useState<ExtraGameDir[]>(() => getSetting("extraGameDirs"))

  const [showAdd, setShowAdd] = useState(false)
  const [addPath, setAddPath] = useState("")
  const [addLabel, setAddLabel] = useState("")
  const [addError, setAddError] = useState("")

  const [removeTarget, setRemoveTarget] = useState<ExtraGameDir | null>(null)

  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const loadCounts = async () => {
      const dirs = [defaultDir, ...extras.map((e) => e.path)]
      const results = await Promise.allSettled(
        dirs.map(async (dir) => {
          const list: Instance[] = await invoke("list_instances", { gameDir: dir })
          return { dir, count: list.length }
        }),
      )
      const map: Record<string, number> = {}
      results.forEach((r) => {
        if (r.status === "fulfilled") map[r.value.dir] = r.value.count
      })
      setCounts(map)
    }
    loadCounts()
  }, [defaultDir, extras])

  const handleAdd = () => {
    setAddError("")
    const trimmed = addPath.trim()
    if (!trimmed) { setAddError(t("instance.namespace.addDialog.errorEmpty")); return }
    if (trimmed === defaultDir || extras.some((e) => e.path === trimmed)) {
      setAddError(t("instance.namespace.addDialog.errorDuplicate")); return
    }
    const updated = [...extras, { path: trimmed, label: addLabel.trim() }]
    setExtras(updated)
    setSetting("extraGameDirs", updated)
    setAddPath(""); setAddLabel(""); setShowAdd(false)
  }

  const handleRemove = () => {
    if (!removeTarget) return
    const updated = extras.filter((e) => e.path !== removeTarget.path)
    setExtras(updated)
    setSetting("extraGameDirs", updated)
    setRemoveTarget(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Default Directory */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FolderTree className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{t("instance.namespace.default")}</p>
              <p className="text-xs text-muted-foreground truncate">{defaultDir}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {t("instance.namespace.defaultHint")} · {t("instance.namespace.instanceCount", { count: counts[defaultDir] ?? "..." })}
              </p>
            </div>
          </div>
          <Link to="../settings">
            <Button variant="outline" size="sm" className="shrink-0 text-xs">
              {t("settings.title")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Extra Directories */}
      {extras.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <FolderTree className="h-10 w-10 text-muted-foreground/25" />
          <p className="text-sm text-muted-foreground">{t("instance.namespace.noExtra")}</p>
          <p className="text-xs text-muted-foreground/60">{t("instance.namespace.noExtraHint")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {extras.map((ex) => (
            <div key={ex.path} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                <FolderTree className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{ex.label || ex.path.split(/[/\\]/).pop()}</p>
                <p className="text-xs text-muted-foreground truncate">{ex.path}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {t("instance.namespace.instanceCount", { count: counts[ex.path] ?? "..." })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRemoveTarget(ex)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Button */}
      <button
        type="button"
        onClick={() => { setShowAdd(true); setAddPath(""); setAddLabel(""); setAddError("") }}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-4 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground hover:bg-muted/30 cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("instance.namespace.addDir")}
      </button>

      {/* Add Dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px] animate-in fade-in-0 duration-150">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 fade-in-0 duration-150">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold text-foreground">{t("instance.namespace.addDialog.title")}</h2>
            </div>
            <div className="flex flex-col gap-4 px-6 py-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">{t("instance.namespace.addDialog.pathLabel")}</label>
                <input
                  type="text"
                  value={addPath}
                  onChange={(e) => setAddPath(e.target.value)}
                  placeholder={t("instance.namespace.addDialog.pathPlaceholder")}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary/40 focus:bg-background"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">{t("instance.namespace.addDialog.labelLabel")}</label>
                <input
                  type="text"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  placeholder={t("instance.namespace.addDialog.labelPlaceholder")}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary/40 focus:bg-background"
                />
              </div>
              {addError && <p className="text-xs text-destructive">{addError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <button type="button" onClick={() => setShowAdd(false)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer">
                {t("instance.namespace.addDialog.cancel")}
              </button>
              <button type="button" onClick={handleAdd}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 cursor-pointer">
                {t("instance.namespace.addDialog.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Dialog */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px] animate-in fade-in-0 duration-150">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 fade-in-0 duration-150">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold text-foreground">{t("instance.namespace.removeDialog.title")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("instance.namespace.removeDialog.desc", { label: removeTarget.label || removeTarget.path })}
              </p>
              <p className="mt-2 text-xs text-muted-foreground/60">{t("instance.namespace.removeDialog.hint")}</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4">
              <button type="button" onClick={() => setRemoveTarget(null)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer">
                {t("instance.namespace.removeDialog.cancel")}
              </button>
              <button type="button" onClick={handleRemove}
                className="rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground shadow-sm transition-all hover:bg-destructive/90 cursor-pointer">
                {t("instance.namespace.removeDialog.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* =============================
   Instance Card
   ============================= */

function InstanceCard({
  instance,
  t,
  onDelete,
  onClick,
}: {
  instance: Instance & { namespaceLabel: string }
  t: (k: string, o?: Record<string, unknown>) => string
  onDelete: () => void
  onClick: () => void
}) {
  const loader = instance.loader || "vanilla"
  const loaderLabel = loaderNames[loader] || instance.loader || "Vanilla"
  const loaderColor = loaderColors[loader] || loaderColors.vanilla
  const statusColor = statusColors[instance.status] || statusColors.ready

  return (
    <div
      onClick={onClick}
      className="group flex flex-col rounded-xl border border-border bg-card transition-all hover:border-primary/20 hover:bg-muted/10 cursor-pointer"
    >
      <div className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-3">
        {/* Name + Status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground truncate">{instance.name}</h3>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {t(`instance.status.${instance.status}`)}
          </span>
        </div>

        {/* Version + Loader */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
            {instance.versionId}
          </span>
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${loaderColor}`}>
            {loaderLabel}
          </span>
          {instance.loaderVersion && (
            <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {instance.loaderVersion}
            </span>
          )}
        </div>

        {/* Namespace + Dir */}
        <div className="flex flex-col gap-1 text-[11px] text-muted-foreground/70">
          <div className="flex items-center gap-1.5">
            <FolderTree className="h-3 w-3 shrink-0" />
            <span className="font-medium text-muted-foreground/90">{instance.namespaceLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span className="truncate">{instance.customDir || instance.gameDir}</span>
          </div>
          <p>{t("instance.createdAt")}: {formatDate(instance.createdAt)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-border px-3 py-2">
        <button
          type="button"
          disabled={instance.status !== "ready"}
          onClick={(e) => { e.stopPropagation() }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 cursor-pointer">
          <Play className="h-3 w-3" />
          {t("instance.launch")}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}