import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { invoke } from "@tauri-apps/api/core"
import {
  X, Folder, HardDrive, Calendar, Loader2, Play,
} from "lucide-react"

interface SaveEntry {
  name: string
  dirName: string
  lastPlayed: string
  sizeMb: number
}

interface Props {
  open: boolean
  gameDir: string | null
  onClose: () => void
  onLaunch: (worldName: string) => void
}

export default function QuickLaunchPopup({
  open,
  gameDir,
  onClose,
  onLaunch,
}: Props) {
  const { t } = useTranslation(["home", "common"])
  const [saves, setSaves] = useState<SaveEntry[]>([])
  const [loading, setLoading] = useState(false)

  const fetchSaves = useCallback(async () => {
    if (!gameDir) return
    setLoading(true)
    try {
      const result = await invoke<SaveEntry[]>("list_instance_saves", {
        gameDir,
      })
      setSaves(result)
    } catch (e) {
      console.error("fetch saves failed:", e)
      setSaves([])
    } finally {
      setLoading(false)
    }
  }, [gameDir])

  useEffect(() => {
    if (open && gameDir) {
      fetchSaves()
    } else {
      setSaves([])
    }
  }, [open, gameDir])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-[420px] max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
              <Play className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("quickLaunch.title")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t("quickLaunch.desc")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {t("quickLaunch.loading")}
              </p>
            </div>
          ) : saves.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Folder className="h-10 w-10 opacity-30" />
              <p className="text-sm">{t("quickLaunch.noSaves")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {saves.map((save) => (
                <button
                  key={save.dirName}
                  onClick={() => onLaunch(save.dirName)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/60 cursor-pointer group"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Folder className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {save.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {save.sizeMb.toFixed(1)} MB
                      </span>
                      {save.lastPlayed && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {save.lastPlayed}
                        </span>
                      )}
                    </div>
                  </div>
                  <Play className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}