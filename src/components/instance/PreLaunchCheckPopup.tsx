import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { invoke } from "@tauri-apps/api/core"
import {
  X, Check, AlertTriangle, Loader2,
  FileWarning, HardDriveDownload, Wrench,
} from "lucide-react"
import { getSetting } from "../../lib/settings"
import type { Instance } from "../../pages/Instances"

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

interface Props {
  open: boolean
  instance: (Instance & { namespaceLabel?: string }) | null
  onClose: () => void
  onContinue: () => void
  onRepair: () => void
  repairing: boolean
}

type Phase = "checking" | "result"

export default function PreLaunchCheckPopup({
  open,
  instance,
  onClose,
  onContinue,
  onRepair,
  repairing,
}: Props) {
  const { t } = useTranslation(["home", "common"])
  const [phase, setPhase] = useState<Phase>("checking")
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)

  const runCheck = useCallback(async () => {
    if (!instance) return
    setPhase("checking")
    setLoading(true)
    try {
      const r = await invoke<VerifyResult>("verify_instance", {
        gameDir: instance.gameDir,
        versionId: instance.id,
      })
      setResult(r)
      setPhase("result")
    } catch (e) {
      console.error("verify failed:", e)
      setResult(null)
      setPhase("result")
    } finally {
      setLoading(false)
    }
  }, [instance?.id, instance?.gameDir])

  useEffect(() => {
    if (open && instance) {
      runCheck()
    } else {
      setPhase("checking")
      setResult(null)
    }
  }, [open, instance?.id])

  const allOk = result && !result.criticalMissing && result.missing.length === 0

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-[480px] max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Wrench className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("instance.preLaunch.title")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {instance?.name ?? instance?.id ?? ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={repairing}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted/60 transition-colors disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-5">
          {/* Checking spinner */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {t("instance.preLaunch.checking")}
              </p>
            </div>
          )}

          {/* Results */}
          {phase === "result" && result && (
            <>
              <div className="flex flex-col gap-2.5">
                {/* Client jar */}
                <CheckItem
                  icon={HardDriveDownload}
                  label={t("instance.preLaunch.clientJar")}
                  detail="client.jar"
                  ok={result.clientOk}
                />
                {/* Version JSON */}
                <CheckItem
                  icon={HardDriveDownload}
                  label={t("instance.preLaunch.versionJson")}
                  detail="version.json"
                  ok={result.versionJsonOk}
                />
                {/* Libraries */}
                <CheckItem
                  icon={HardDriveDownload}
                  label={t("instance.preLaunch.libraries")}
                  detail={
                    result.totalLibraries > 0
                      ? `${result.okLibraries}/${result.totalLibraries}${
                          result.totalLibraries > result.okLibraries
                            ? ` (${t("instance.preLaunch.missingCount", { count: result.totalLibraries - result.okLibraries })})`
                            : ""
                        }`
                      : ""
                  }
                  ok={result.okLibraries === result.totalLibraries || result.totalLibraries === 0}
                  warn={result.totalLibraries > result.okLibraries}
                />
                {/* Assets */}
                <CheckItem
                  icon={HardDriveDownload}
                  label={t("instance.preLaunch.assets")}
                  detail={
                    result.totalAssets > 0
                      ? `${result.okAssets}/${result.totalAssets}${
                          result.totalAssets > result.okAssets
                            ? ` (${t("instance.preLaunch.missingCount", { count: result.totalAssets - result.okAssets })})`
                            : ""
                        }`
                      : ""
                  }
                  ok={result.okAssets === result.totalAssets || result.totalAssets === 0}
                  warn={result.totalAssets > result.okAssets}
                />
              </div>

              {/* Warning / info box */}
              {result.criticalMissing && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <div>
                      <p className="text-xs font-medium text-red-600 dark:text-red-400">
                        {t("instance.preLaunch.criticalMissing")}
                      </p>
                      <p className="mt-0.5 text-[10px] text-red-500/80">
                        {t("instance.preLaunch.criticalHint")}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!result.criticalMissing && !allOk && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        {t("instance.preLaunch.nonCritical")}
                      </p>
                      <p className="mt-0.5 text-[10px] text-amber-500/80">
                        {t("instance.preLaunch.nonCriticalHint")}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {allOk && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <div>
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {t("instance.preLaunch.allGood")}
                      </p>
                      <p className="mt-0.5 text-[10px] text-emerald-500/80">
                        {t("instance.preLaunch.allGoodHint")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          {result && !result.criticalMissing && (
            <button
              onClick={onContinue}
              disabled={repairing}
              className={`rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                allOk
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-amber-500 text-white shadow-sm hover:bg-amber-600"
              } disabled:opacity-40`}
            >
              {allOk
                ? (t("instance.preLaunch.launch"))
                : (t("instance.preLaunch.ignoreAndLaunch"))}
            </button>
          )}
          {result && !result.criticalMissing && !allOk && (
            <button
              onClick={onRepair}
              disabled={repairing}
              className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/60 transition-all disabled:opacity-40"
            >
              {repairing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <HardDriveDownload className="h-3.5 w-3.5" />
              )}
              {t("instance.preLaunch.repair")}
            </button>
          )}
          {result?.criticalMissing && (
            <button
              onClick={onRepair}
              disabled={repairing}
              className="flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-red-600 transition-all disabled:opacity-40"
            >
              {repairing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <HardDriveDownload className="h-3.5 w-3.5" />
              )}
              {t("instance.preLaunch.repairRequired")}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={repairing}
            className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-all disabled:opacity-40"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ──── CheckItem subcomponent ──── */

function CheckItem({
  icon: Icon,
  label,
  detail,
  ok,
  warn,
}: {
  icon: typeof HardDriveDownload
  label: string
  detail: string
  ok: boolean
  warn?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 px-4 py-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        ok && !warn ? "bg-emerald-500/10" : warn ? "bg-amber-500/10" : "bg-red-500/10"
      }`}>
        {ok && !warn ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : warn ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : (
          <FileWarning className="h-4 w-4 text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {detail && (
          <p className="text-[10px] text-muted-foreground font-mono truncate">{detail}</p>
        )}
      </div>
    </div>
  )
}