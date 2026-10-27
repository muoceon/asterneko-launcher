import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { invoke } from "@tauri-apps/api/core"
import {
  X,
  Check, AlertTriangle, Loader2,
  Info, Package, FileArchive, FileWarning, FileCheck,
  HardDriveDownload, Box, Image, FolderOpen, Save,
  Database, Sparkles,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { type Instance } from "@/pages/Instances"

import { getSetting } from "@/lib/settings"
import { useTaskManager } from "@/contexts/TaskManagerContext"

type TFunc = {
  (key: string): string
  (key: string, defaultValue: string): string
  (key: string, options: Record<string, unknown>): string
  (key: string, options: Record<string, unknown>, defaultValue: string): string
}

/* ──────────── verify hook ──────────── */

interface VerifyResult {
  clientOk: boolean
  versionJsonOk: boolean
  totalLibraries: number
  okLibraries: number
  totalAssets: number
  okAssets: number
  missing: string[]
  criticalMissing: boolean
}

function useVerify(inst: Instance | null, open: boolean) {
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    if (!inst) return
    setLoading(true)
    try {
      const r = await invoke<VerifyResult>("verify_instance", {
        gameDir: inst.gameDir,
        versionId: inst.id,
      })
      setResult(r)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && inst) {
      run()
    } else {
      setResult(null)
    }
  }, [open, inst?.id])

  return { result, loading, run }
}

function useRepair(inst: Instance | null) {
  const [loading, setLoading] = useState(false)

  const repair = async () => {
    if (!inst) return
    setLoading(true)
    try {
      const channel = (getSetting("downloadChannel") as string) || "bmclapi"
      await invoke("repair_instance", {
        gameDir: inst.gameDir,
        versionId: inst.id,
        channel,
        instanceName: inst.name,
        loader: inst.loader ?? "",
        loaderVersion: inst.loaderVersion ?? "",
      })
    } finally {
      setLoading(false)
    }
  }

  return { loading, repair }
}

/* ──────────── data hooks ──────────── */

interface SaveEntry {
  name: string
  dirName: string
  lastPlayed: string
  sizeMb: number
}
interface PackEntry {
  name: string
  fileName: string
  enabled: boolean
  sizeMb: number
}

function useSaves(inst: Instance | null, open: boolean) {
  const [saves, setSaves] = useState<SaveEntry[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!inst || !open) return
    setLoading(true)
    invoke<SaveEntry[]>("list_instance_saves", { gameDir: inst.gameDir })
      .then(setSaves)
      .catch(() => setSaves([]))
      .finally(() => setLoading(false))
  }, [inst?.id, open])
  return { saves, loading }
}

function useMods(inst: Instance | null, open: boolean) {
  const [mods, setMods] = useState<PackEntry[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!inst || !open) return
    setLoading(true)
    invoke<PackEntry[]>("list_instance_mods", { gameDir: inst.gameDir })
      .then(setMods)
      .catch(() => setMods([]))
      .finally(() => setLoading(false))
  }, [inst?.id, open])
  return { mods, loading }
}

function useDataPacks(inst: Instance | null, open: boolean) {
  const [packs, setPacks] = useState<PackEntry[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!inst || !open) return
    setLoading(true)
    invoke<PackEntry[]>("list_instance_datapacks", { gameDir: inst.gameDir })
      .then(setPacks)
      .catch(() => setPacks([]))
      .finally(() => setLoading(false))
  }, [inst?.id, open])
  return { packs, loading }
}

function useResourcePacks(inst: Instance | null, open: boolean) {
  const [packs, setPacks] = useState<PackEntry[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!inst || !open) return
    setLoading(true)
    invoke<PackEntry[]>("list_instance_resourcepacks", { gameDir: inst.gameDir })
      .then(setPacks)
      .catch(() => setPacks([]))
      .finally(() => setLoading(false))
  }, [inst?.id, open])
  return { packs, loading }
}

function useShaders(inst: Instance | null, open: boolean) {
  const [packs, setPacks] = useState<PackEntry[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!inst || !open) return
    setLoading(true)
    invoke<PackEntry[]>("list_instance_shaderpacks", { gameDir: inst.gameDir })
      .then(setPacks)
      .catch(() => setPacks([]))
      .finally(() => setLoading(false))
  }, [inst?.id, open])
  return { packs, loading }
}

/* ──────────── constants ──────────── */

type DetailTab = "basic" | "saves" | "mods" | "datapacks" | "resourcepacks" | "shaders" | "repair"

interface TabGroup {
  sectionKey: string
  items: { key: DetailTab; labelKey: string; icon: React.ComponentType<{ className?: string }> }[]
}

const tabGroups: TabGroup[] = [
  {
    sectionKey: "instance.detail.sectionBasic",
    items: [
      { key: "basic", labelKey: "instance.detail.tabBasic", icon: Info },
    ],
  },
  {
    sectionKey: "instance.detail.sectionResources",
    items: [
      { key: "saves", labelKey: "instance.detail.tabSaves", icon: Save },
      { key: "mods", labelKey: "instance.detail.tabMods", icon: Box },
      { key: "datapacks", labelKey: "instance.detail.tabDataPacks", icon: Database },
      { key: "resourcepacks", labelKey: "instance.detail.tabResourcePacks", icon: Image },
      { key: "shaders", labelKey: "instance.detail.tabShaders", icon: Sparkles },
    ],
  },
  {
    sectionKey: "instance.detail.sectionMaintenance",
    items: [
      { key: "repair", labelKey: "instance.detail.tabRepair", icon: HardDriveDownload },
    ],
  },
]

const loaderNames: Record<string, string> = {
  vanilla: "Vanilla", fabric: "Fabric", forge: "Forge",
  neoforge: "NeoForge", quilt: "Quilt",
}
const loaderColors: Record<string, string> = {
  vanilla: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  fabric: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  forge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  neoforge: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  quilt: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
}
const statusMap: Record<string, { label: string; color: string; dot: string }> = {
  ready: { label: "就绪", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  installing: { label: "安装中", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  error: { label: "错误", color: "bg-red-500/10 text-red-600 dark:text-red-400", dot: "bg-red-500" },
}

/* ──────────── component ──────────── */

interface InstanceDetailPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instance: Instance & { namespaceLabel: string } | null
}

export function InstanceDetailPopup({ open, onOpenChange, instance }: InstanceDetailPopupProps) {
  const { t } = useTranslation("home")
  const [activeTab, setActiveTab] = useState<DetailTab>("basic")

  if (!instance) return null

  const loader = instance.loader || "vanilla"
  const loaderLabel = loaderNames[loader] ?? loader
  const loaderColor = loaderColors[loader] ?? loaderColors.vanilla
  const st = statusMap[instance.status] ?? statusMap.ready

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] min-h-[420px] flex flex-col p-0 gap-0">
        {/* header */}
        <DialogHeader className="flex flex-row items-center justify-between border-b px-5 py-3.5 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-primary" />
            <span className="truncate">{instance.name}</span>
            <span className="text-[11px] text-muted-foreground font-normal">{instance.versionId}</span>
          </DialogTitle>
        </DialogHeader>

        {/* body: left sidebar + right content */}
        <div className="flex flex-1 min-h-0">
          {/* left sidebar */}
          <nav className="w-44 shrink-0 border-r bg-muted/10 flex flex-col">
            {/* identity card */}
            <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{instance.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`inline-flex items-center rounded-md border px-1.5 py-0 text-[9px] font-medium ${loaderColor}`}>
                    {loaderLabel}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0 text-[9px] font-medium ${st.color}`}>
                    <span className={`h-1 w-1 rounded-full ${st.dot}`} />
                    {t(`instance.status.${instance.status}`, st.label)}
                  </span>
                </div>
              </div>
            </div>

            {/* nav tabs with sections */}
            <div className="flex flex-col py-2 px-1.5 flex-1 gap-0.5">
              {tabGroups.map((group) => (
                <div key={group.sectionKey} className="mb-1">
                  <span className="block px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t(group.sectionKey)}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((tab) => {
                      const Icon = tab.icon
                      const isActive = activeTab === tab.key
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                            isActive
                              ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          }`}
                        >
                          <Icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : ""}`} />
                          <span>{t(tab.labelKey)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          {/* right content */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto">
            <div className="flex-1 p-5">
              {activeTab === "basic" && <BasicPanel instance={instance} t={t} loaderLabel={loaderLabel} open={open} />}
              {activeTab === "saves" && <SavesPanel instance={instance} t={t} open={open} />}
              {activeTab === "mods" && <ModsPanel instance={instance} t={t} open={open} />}
              {activeTab === "datapacks" && <DataPacksPanel instance={instance} t={t} open={open} />}
              {activeTab === "resourcepacks" && <ResourcePacksPanel instance={instance} t={t} open={open} />}
              {activeTab === "shaders" && <ShadersPanel instance={instance} t={t} open={open} />}
              {activeTab === "repair" && <RepairPanel instance={instance} t={t} open={open} />}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ============================================
   Panels
   ============================================ */

function BasicPanel({
  instance,
  t,
  loaderLabel,
  open: _open,
}: {
  instance: Instance & { namespaceLabel: string }
  t: (k: string, o?: Record<string, unknown>) => string
  loaderLabel: string
  open: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>{t("instance.detail.basicInfo")}</SectionTitle>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-xl border border-border bg-muted/10 p-4">
        <Field label={t("instance.detail.instanceId")} value={instance.id} mono />
        <Field label={t("instance.version")} value={instance.versionId} />
        <Field label={t("instance.loader")} value={loaderLabel + (instance.loaderVersion ? ` ${instance.loaderVersion}` : "")} />
        <Field label={t("instance.detail.namespace")} value={instance.namespaceLabel} />
        <div className="col-span-2 flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">{t("instance.detail.dir")}</span>
          <span className="text-xs font-medium text-foreground truncate font-mono">{instance.customDir || instance.gameDir}</span>
        </div>
        <Field label={t("instance.createdAt")} value={formatDate(instance.createdAt)} />
      </div>

      {/* quick actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          onClick={() => {
            // TODO: open in system file manager
          }}
        >
          <FolderOpen className="h-3 w-3" />
          {t("instance.detail.openFolder")}
        </button>
      </div>
    </div>
  )
}

function SavesPanel({
  instance,
  t,
  open,
}: {
  instance: Instance & { namespaceLabel: string }
  t: (k: string, o?: Record<string, unknown>) => string
  open: boolean
}) {
  const { saves, loading } = useSaves(instance, open)

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>{t("instance.detail.tabSaves")}</SectionTitle>
      {loading ? (
        <CenteredSpinner />
      ) : saves.length === 0 ? (
        <EmptyPlaceholder icon={Save} message={t("instance.detail.noSaves")} />
      ) : (
        <div className="flex flex-col gap-2">
          {saves.map((s, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <Save className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{s.name}</p>
                <p className="text-[10px] text-muted-foreground">{s.lastPlayed || "—"} · {s.sizeMb.toFixed(1)} MB</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ModsPanel({
  instance,
  t,
  open,
}: {
  instance: Instance & { namespaceLabel: string }
  t: (k: string, o?: Record<string, unknown>) => string
  open: boolean
}) {
  const { mods, loading } = useMods(instance, open)

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>{t("instance.detail.tabMods")}</SectionTitle>
      {loading ? (
        <CenteredSpinner />
      ) : mods.length === 0 ? (
        <EmptyPlaceholder icon={Box} message={t("instance.detail.noMods")} />
      ) : (
        <div className="flex flex-col gap-2">
          {mods.map((m, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                <Box className="h-4 w-4 text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{m.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">{m.fileName}</p>
              </div>
              {m.sizeMb > 0 && (
                <span className="text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 shrink-0">
                  {m.sizeMb.toFixed(1)} MB
                </span>
              )}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${
                m.enabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted/60 text-muted-foreground"
              }`}>
                {m.enabled
                  ? t("instance.detail.enabled")
                  : t("instance.detail.disabled")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ResourcePacksPanel({
  instance,
  t,
  open,
}: {
  instance: Instance & { namespaceLabel: string }
  t: (k: string, o?: Record<string, unknown>) => string
  open: boolean
}) {
  const { packs, loading } = useResourcePacks(instance, open)

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>{t("instance.detail.tabResourcePacks")}</SectionTitle>
      {loading ? (
        <CenteredSpinner />
      ) : packs.length === 0 ? (
        <EmptyPlaceholder icon={Image} message={t("instance.detail.noResourcePacks")} />
      ) : (
        <div className="flex flex-col gap-2">
          {packs.map((p, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10">
                <Image className="h-4 w-4 text-rose-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">{p.fileName}</p>
              </div>
              {p.sizeMb > 0 && (
                <span className="text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 shrink-0">
                  {p.sizeMb.toFixed(1)} MB
                </span>
              )}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${
                p.enabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted/60 text-muted-foreground"
              }`}>
                {p.enabled
                  ? t("instance.detail.enabled")
                  : t("instance.detail.disabled")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DataPacksPanel({
  instance,
  t,
  open,
}: {
  instance: Instance & { namespaceLabel: string }
  t: (k: string, o?: Record<string, unknown>) => string
  open: boolean
}) {
  const { packs, loading } = useDataPacks(instance, open)

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>{t("instance.detail.tabDataPacks")}</SectionTitle>
      {loading ? (
        <CenteredSpinner />
      ) : packs.length === 0 ? (
        <EmptyPlaceholder icon={Database} message={t("instance.detail.noDataPacks")} />
      ) : (
        <div className="flex flex-col gap-2">
          {packs.map((p, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                <Database className="h-4 w-4 text-cyan-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">{p.fileName}</p>
              </div>
              {p.sizeMb > 0 && (
                <span className="text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 shrink-0">
                  {p.sizeMb.toFixed(1)} MB
                </span>
              )}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${
                p.enabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted/60 text-muted-foreground"
              }`}>
                {p.enabled
                  ? t("instance.detail.enabled")
                  : t("instance.detail.disabled")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ShadersPanel({
  instance,
  t,
  open,
}: {
  instance: Instance & { namespaceLabel: string }
  t: (k: string, o?: Record<string, unknown>) => string
  open: boolean
}) {
  const { packs, loading } = useShaders(instance, open)

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>{t("instance.detail.tabShaders")}</SectionTitle>
      {loading ? (
        <CenteredSpinner />
      ) : packs.length === 0 ? (
        <EmptyPlaceholder icon={Sparkles} message={t("instance.detail.noShaders")} />
      ) : (
        <div className="flex flex-col gap-2">
          {packs.map((p, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">{p.fileName}</p>
              </div>
              {p.sizeMb > 0 && (
                <span className="text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 shrink-0">
                  {p.sizeMb.toFixed(1)} MB
                </span>
              )}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${
                p.enabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted/60 text-muted-foreground"
              }`}>
                {p.enabled
                  ? t("instance.detail.enabled")
                  : t("instance.detail.disabled")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RepairPanel({
  instance,
  t,
  open,
}: {
  instance: Instance & { namespaceLabel: string }
  t: (k: string, o?: Record<string, unknown>) => string
  open: boolean
}) {
  const { result, loading: verifying, run } = useVerify(instance, open)
  const { loading: repairing, repair } = useRepair(instance)
  const [showMissing, setShowMissing] = useState(false)

  const missingCount = result ? result.missing.length : 0
  const libOk = result && result.okLibraries === result.totalLibraries
  const assetOk = result && result.okAssets === result.totalAssets
  const allOk = result && result.clientOk && result.versionJsonOk && libOk && assetOk

  const handleRepair = async () => {
    await repair()
    await run()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionTitle>{t("instance.detail.fileIntegrity")}</SectionTitle>
        <div className="flex items-center gap-2">
          <button
            onClick={run}
            disabled={verifying || repairing}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted/60 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {verifying ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileCheck className="h-3 w-3" />
            )}
            {t("instance.detail.reCheck")}
          </button>
          {!allOk && (
            <button
              onClick={handleRepair}
              disabled={verifying || repairing}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {repairing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <HardDriveDownload className="h-3 w-3" />
              )}
              {t("instance.detail.repairFiles")}
            </button>
          )}
        </div>
      </div>

      {!result && !verifying && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
          <FileCheck className="h-8 w-8 text-muted-foreground/25" />
          <p className="text-xs text-muted-foreground">
            {t("instance.detail.autoChecking")}
          </p>
        </div>
      )}

      {(verifying || repairing) && (
        <CenteredSpinner />
      )}

      {result && !verifying && !repairing && (
        <div className="flex flex-col gap-3">
          {result.criticalMissing && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <div>
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {t("instance.detail.criticalMissing")}
                </p>
                <p className="mt-0.5 text-[10px] text-red-500/80">
                  {t("instance.detail.criticalHint")}
                </p>
              </div>
            </div>
          )}

          {!result.criticalMissing && !allOk && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {t("instance.detail.someMissing")}
                </p>
                <p className="mt-0.5 text-[10px] text-amber-500/80">
                  {t("instance.detail.someMissingHint")}
                </p>
              </div>
            </div>
          )}

          {allOk && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {t("instance.detail.allGood")}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/10 p-4">
            <CheckItemSmall
              icon={FileArchive}
              label={t("instance.detail.clientJar")}
              ok={result.clientOk}
            />
            <CheckItemSmall
              icon={FileArchive}
              label={t("instance.detail.versionConfig")}
              ok={result.versionJsonOk}
            />
            <CheckItemSmall
              icon={Package}
              label={t("instance.detail.libraries")}
              ok={libOk ?? false}
              detail={`${result.okLibraries} / ${result.totalLibraries}`}
              warn={result.totalLibraries > result.okLibraries}
            />
            <CheckItemSmall
              icon={FileArchive}
              label={t("instance.detail.assets")}
              ok={assetOk ?? false}
              detail={`${result.okAssets} / ${result.totalAssets}`}
              warn={result.totalAssets > result.okAssets}
            />
          </div>

          {missingCount > 0 && (
            <div>
              <button
                onClick={() => setShowMissing(!showMissing)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <FileWarning className="h-3.5 w-3.5 text-amber-500" />
                {t("instance.detail.missingCount", { count: missingCount } as any)}
                <span className="text-[10px]">{showMissing ? "▾" : "▸"}</span>
              </button>
              {showMissing && (
                <div className="mt-2 flex flex-col gap-1 rounded-lg border border-border p-3 max-h-40 overflow-y-auto bg-muted/5">
                  {result.missing.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <X className="h-3 w-3 text-destructive shrink-0" />
                      <span className="text-muted-foreground font-mono break-all">{f}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ──── CheckItemSmall widget ──── */

function CheckItemSmall({
  icon: Icon,
  label,
  ok,
  detail,
  warn,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  ok: boolean
  detail?: string
  warn?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
        ok && !warn ? "bg-emerald-500/10" : warn ? "bg-amber-500/10" : "bg-red-500/10"
      }`}>
        {ok && !warn ? (
          <Check className="h-3 w-3 text-emerald-500" />
        ) : warn ? (
          <AlertTriangle className="h-3 w-3 text-amber-500" />
        ) : (
          <X className="h-3 w-3 text-red-500" />
        )}
      </div>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-medium text-foreground">{label}</span>
        {detail && (
          <span className={`text-[10px] font-mono ${warn ? "text-amber-500" : "text-muted-foreground"}`}>
            {detail}
          </span>
        )}
      </div>
    </div>
  )
}

/* ============================================
   OLD CheckItem (used by BasicPanel etc)
   ============================================ */

function CheckItem({
  icon: Icon,
  label,
  ok,
  detail,
  warn,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  ok: boolean
  detail?: string
  warn?: boolean
}) {
  return (
    <div className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${
      ok ? "bg-emerald-500/5" : warn ? "bg-amber-500/5" : "bg-red-500/5"
    }`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${ok ? "text-emerald-500" : "text-amber-500"}`} />
      <span className="text-xs text-foreground flex-1">{label}</span>
      {detail && (
        <span className={`text-[10px] font-mono ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
          {detail}
        </span>
      )}
      {ok ? (
        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <X className="h-3.5 w-3.5 text-destructive shrink-0" />
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  } catch { return iso }
}

/* ============================================
   Shared widgets
   ============================================ */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold text-foreground">{children}</h4>
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`text-xs font-medium text-foreground truncate ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}

function CenteredSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}

function EmptyPlaceholder({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>
  message: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/25" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}