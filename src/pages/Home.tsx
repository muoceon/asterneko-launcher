import { useTranslation } from "react-i18next"
import { useState, useCallback, useEffect, useRef } from "react"
import {
  Play, ChevronDown, ChevronUp, Settings,
  Repeat, User, Check, Plus, Boxes, Square, Loader2,
} from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { useGameAccount } from "@/hooks/useGameAccount"
import type { GameAccount } from "@/hooks/useGameAccount"
import { getSetting } from "@/lib/settings"
import { Link } from "react-router-dom"
import PreLaunchCheckPopup from "@/components/instance/PreLaunchCheckPopup"
import QuickLaunchPopup from "@/components/instance/QuickLaunchPopup"

/* ──────────── types ──────────── */

interface Instance {
  id: string
  name: string
  versionId: string
  loader?: string
  loaderVersion?: string
  gameDir: string
  createdAt: string
}

const loaderColors: Record<string, string> = {
  vanilla: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  fabric: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  forge: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  neoforge: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  quilt: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
}

const loaderNames: Record<string, string> = {
  vanilla: "Vanilla", fabric: "Fabric", forge: "Forge",
  neoforge: "NeoForge", quilt: "Quilt",
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  } catch { return iso }
}

/* ──────────── helpers ──────────── */

function parseJavaMajor(versionId: string): number {
  const ver = versionId.replace(/^[^0-9]*/, "")
  const parts = ver.split(".")
  const major = parseInt(parts[0], 10)
  if (!isNaN(major)) {
    if (major >= 21) return 21
    if (major >= 17) return 17
    return 8
  }
  return 8
}

/* ──────────── page ──────────── */

export default function HomePage() {
  const { t } = useTranslation("home")
  const { accounts, activeAccount, selectAccount } = useGameAccount()

  const [instances, setInstances] = useState<Instance[]>([])
  const [currentInstance, setCurrentInstance] = useState<Instance | null>(null)
  const [loadingInstances, setLoadingInstances] = useState(true)
  const [showInstancePicker, setShowInstancePicker] = useState(false)
  const [showAccountPicker, setShowAccountPicker] = useState(false)

  const [gameRunning, setGameRunning] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [preCheckOpen, setPreCheckOpen] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [quickLaunchOpen, setQuickLaunchOpen] = useState(false)
  const quickLaunchWorldRef = useRef<string | null>(null)

  const loadInstances = useCallback(async () => {
    setLoadingInstances(true)
    try {
      const defaultDir = getSetting("gameDir")
      const extras = getSetting("extraGameDirs")
      const allDirs = [defaultDir, ...extras.map((e) => e.path)]

      const results = await Promise.allSettled(
        allDirs.map(async (dir) => {
          try {
            return await invoke<Instance[]>("list_instances", { gameDir: dir })
          } catch { return [] as Instance[] }
        }),
      )

      const merged = results.flatMap((r) =>
        r.status === "fulfilled" ? r.value : [],
      )

      setInstances(merged)
      if (merged.length > 0) {
        setCurrentInstance((prev) =>
          prev && merged.find((m) => m.id === prev.id) ? prev : merged[0],
        )
      } else {
        setCurrentInstance(null)
      }
    } catch (e) {
      console.error("加载实例失败:", e)
    } finally {
      setLoadingInstances(false)
    }
  }, [])

  useEffect(() => {
    loadInstances()
  }, [loadInstances])

  const handleSelectInstance = useCallback((inst: Instance) => {
    setCurrentInstance(inst)
    setShowInstancePicker(false)
    setLaunchError(null)
  }, [])

  const handleLaunch = useCallback(async () => {
    if (!currentInstance || !activeAccount) return
    quickLaunchWorldRef.current = null
    setPreCheckOpen(true)
  }, [currentInstance, activeAccount])

  const handleQuickLaunch = useCallback(async (worldName: string) => {
    if (!currentInstance || !activeAccount) return
    setQuickLaunchOpen(false)
    quickLaunchWorldRef.current = worldName
    setPreCheckOpen(true)
  }, [currentInstance, activeAccount])

  const handlePreCheckContinue = useCallback(async () => {
    setPreCheckOpen(false)
    await doLaunch()
  }, [currentInstance, activeAccount])

  const handlePreCheckRepair = useCallback(async () => {
    if (!currentInstance) return
    setRepairing(true)
    try {
      const channel = getSetting("downloadChannel") as string
      await invoke("repair_instance", {
        gameDir: currentInstance.gameDir,
        versionId: currentInstance.id,
        channel,
        instanceName: currentInstance.name,
        loader: currentInstance.loader ?? "",
        loaderVersion: currentInstance.loaderVersion ?? "",
      })
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.message ?? String(e)
      setLaunchError(msg)
    } finally {
      setRepairing(false)
    }
  }, [currentInstance])

  const doLaunch = useCallback(async () => {
    if (!currentInstance || !activeAccount) return

    setLaunching(true)
    setLaunchError(null)

    try {
      const maxMemory = getSetting("maxMemory").replace(/\s*GB?/i, "").trim()
      let javaPath = getSetting("javaPath")

      if (!javaPath || javaPath.trim() === "") {
        const requiredMajor = parseJavaMajor(currentInstance.versionId)
        javaPath = await invoke<string>("select_java", {
          requiredMajor,
          userJava: null,
        })
      }

      const jvmArgs: string[] = []
      if (maxMemory) {
        jvmArgs.push(`-Xmx${maxMemory}G`)
        jvmArgs.push(`-Xms${Math.max(1, Math.floor(Number(maxMemory) / 2))}G`)
      }

      let accessToken: string | null = null
      if (activeAccount.type === "Microsoft" && activeAccount.msRefreshToken) {
        const result = await invoke<{ accessToken: string }>("acquire_mc_token", {
          refreshToken: activeAccount.msRefreshToken,
        })
        accessToken = result.accessToken
      }

      await invoke("launch_game", {
        options: {
          gameDir: currentInstance.gameDir,
          versionId: currentInstance.id,
          javaPath,
          jvmArgs,
          account: {
            username: activeAccount.username,
            uuid: activeAccount.uuid,
            type: activeAccount.type,
          },
          windowWidth: 854,
          windowHeight: 480,
          loader: currentInstance.loader ?? null,
          loaderVersion: currentInstance.loaderVersion ?? null,
          baseMcVersion: currentInstance.versionId ?? null,
          accessToken: accessToken,
          quickLaunchWorld: quickLaunchWorldRef.current,
        },
      })

      setGameRunning(true)
      setLaunchError(null)
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.message ?? String(e)
      setLaunchError(msg)
    } finally {
      setLaunching(false)
    }
  }, [currentInstance, activeAccount])

  const handleKill = useCallback(async () => {
    try {
      await invoke("kill_game")
      setGameRunning(false)
    } catch (e) {
      console.error("终止游戏失败:", e)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!gameRunning) return
      try {
        const running = await invoke<boolean>("is_game_running")
        if (!running) {
          setGameRunning(false)
        }
      } catch {
        // ignore
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [gameRunning])

  const loaderKey = currentInstance?.loader ?? "vanilla"
  const loaderLabel = loaderNames[loaderKey] ?? loaderKey
  const loaderColor = loaderColors[loaderKey] ?? loaderColors.vanilla

  return (
    <div className="relative flex min-h-full flex-col items-end justify-end gap-6 p-10">
      {/* Background ambient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-0 h-96 w-96 translate-x-1/3 rounded-full bg-[radial-gradient(circle,var(--color-primary)/8%,transparent_60%)]" />
        <div className="absolute bottom-1/4 left-1/3 h-72 w-72 rounded-full bg-[radial-gradient(circle,var(--color-primary)/5%,transparent_70%)] blur-3xl" />
      </div>

      <div className="flex items-end gap-4">
        {/* Quick Account Selector */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowAccountPicker(!showAccountPicker)}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-muted/50 px-4 py-3 transition-all hover:bg-muted hover:border-foreground/20 cursor-pointer"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              {activeAccount ? (
                <span className="text-sm font-bold text-primary">
                  {activeAccount.username.charAt(0).toUpperCase()}
                </span>
              ) : (
                <User className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="text-left">
              <p className="text-xs text-muted-foreground">
                {t("account.switch")}
              </p>
              <p className="text-sm font-medium text-foreground">
                {activeAccount?.username ?? t("account.offline")}
              </p>
            </div>
            {showAccountPicker ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {showAccountPicker && (
            <div className="absolute bottom-full left-0 mb-2 w-56 rounded-2xl border border-border bg-background p-1.5 shadow-lg z-30">
              <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {activeAccount ? t("account.switch") : t("account.offline")}
              </p>
              {accounts.map((account: GameAccount) => {
                const isActive = activeAccount?.uuid === account.uuid
                return (
                  <button
                    key={account.uuid}
                    type="button"
                    onClick={() => {
                      selectAccount(account)
                      setShowAccountPicker(false)
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted/50 cursor-pointer"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-bold text-foreground/70">
                      {account.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {account.username}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {account.type === "Offline"
                          ? t("accountPage.game.type.offline")
                          : t("accountPage.game.type.microsoft")}
                      </p>
                    </div>
                    {isActive && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                )
              })}
              {accounts.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {t("accountPage.game.noAccount")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Launch Card */}
        <div className="relative w-[340px] rounded-3xl border border-border bg-muted/40 p-6 shadow-sm">
          {loadingInstances ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Loading instances…</p>
            </div>
          ) : !currentInstance ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Boxes className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {t("instance.empty")}
              </p>
              <Link
                to="../download"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("instance.newInstance")}
              </Link>
            </div>
          ) : (
            <>
              {/* Instance header */}
              <div className="mb-5 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
                    <Boxes className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {currentInstance.name}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${loaderColor}`}>
                        {loaderLabel}
                      </span>
                      <span className="font-mono">{currentInstance.versionId}</span>
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowInstancePicker(!showInstancePicker)}
                    className="flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30 cursor-pointer"
                  >
                    <Repeat className="h-3 w-3" />
                    Switch
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {showInstancePicker && (
                    <div className="absolute right-0 bottom-full mb-1.5 z-20 w-48 rounded-2xl border border-border bg-background p-1.5 shadow-lg">
                      {instances.map((inst) => {
                        const isActive = currentInstance.id === inst.id
                        const lk = inst.loader ?? "vanilla"
                        const lc = loaderColors[lk] ?? loaderColors.vanilla
                        const ll = loaderNames[lk] ?? lk
                        return (
                          <button
                            key={inst.id}
                            type="button"
                            onClick={() => handleSelectInstance(inst)}
                            className="flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted/50 cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-foreground">
                                {inst.name}
                              </span>
                              {isActive && (
                                <Check className="h-3.5 w-3.5 text-primary" />
                              )}
                            </div>
                            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className={`rounded-sm px-1 py-px text-[10px] font-medium ${lc}`}>
                                {ll}
                              </span>
                              <span className="font-mono">{inst.versionId}</span>
                            </span>
                          </button>
                        )
                      })}
                      <Link
                        to="../download"
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        New Instance
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Error message */}
              {launchError && (
                <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  {launchError}
                </div>
              )}

              {/* Play / Stop button */}
              {gameRunning ? (
                <button
                  type="button"
                  onClick={handleKill}
                  className="group relative mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 py-3.5 text-sm font-semibold text-white shadow-md shadow-red-500/20 transition-all hover:shadow-lg hover:shadow-red-500/25 active:scale-[0.98] cursor-pointer"
                >
                  <Square className="h-4 w-4" fill="currentColor" />
                  {t("game.stop") ?? "Stop"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLaunch}
                  disabled={launching || !activeAccount}
                  className={`group relative mb-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer ${
                    !activeAccount
                      ? "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
                      : "bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25"
                  }`}
                >
                  {launching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" fill="currentColor" />
                  )}
                  {launching
                    ? (t("game.launching") ?? "Launching…")
                    : !activeAccount
                      ? (t("game.loginFirst") ?? "Login first")
                      : t("play")}
                </button>
              )}

              {/* Bottom actions */}
              <div className="flex items-center justify-between">
                <Link
                  to="instances"
                  className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5" />
                  {t("manageGames")}
                </Link>

                <button
                  type="button"
                  onClick={() => setQuickLaunchOpen(true)}
                  disabled={!currentInstance || !activeAccount}
                  className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5" />
                  {t("quickLaunchBtn")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    {/* Pre-launch check popup */}
      <QuickLaunchPopup
        open={quickLaunchOpen}
        gameDir={currentInstance?.gameDir ?? null}
        onClose={() => setQuickLaunchOpen(false)}
        onLaunch={handleQuickLaunch}
      />

      <PreLaunchCheckPopup
        open={preCheckOpen}
        instance={currentInstance}
        onClose={() => { if (!launching) setPreCheckOpen(false) }}
        onContinue={handlePreCheckContinue}
        onRepair={handlePreCheckRepair}
        repairing={repairing}
      />
    </div>
  )
}