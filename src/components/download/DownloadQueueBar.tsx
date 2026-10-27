import { useTranslation } from "react-i18next"
import type { ManagerTask } from "@/contexts/TaskManagerContext"
import { ArrowDown, X, Check, AlertTriangle } from "lucide-react"

interface DownloadQueueProps {
  tasks: ManagerTask[]
  hasActive: boolean
  overallProgress: number
  overallSpeed: number
  removeTask: (id: string) => void
  clearDone: () => void
}

export function DownloadQueueBar({ queue }: { queue: DownloadQueueProps }) {
  const { t } = useTranslation("home")
  const { tasks, hasActive, overallProgress, overallSpeed, clearDone, removeTask } =
    queue

  if (tasks.length === 0) return null

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec < 1024) return `${bytesPerSec} B${t("download.queue.speed")}`
    if (bytesPerSec < 1024 * 1024)
      return `${(bytesPerSec / 1024).toFixed(1)} KB${t("download.queue.speed")}`
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB${t("download.queue.speed")}`
  }

  const doneTasks = tasks.filter((t) => t.status === "done")
  const hasDone = doneTasks.length > 0

  return (
    <div className="border-t border-border bg-card/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-2">
        <ArrowDown className="h-3.5 w-3.5 shrink-0 text-primary" />

        {/* Progress bar */}
        {hasActive && (
          <>
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
              {overallProgress}% · {formatSpeed(overallSpeed)}
            </span>
          </>
        )}

        {/* Done indicator */}
        {hasDone && !hasActive && (
          <span className="flex-1 text-[11px] text-muted-foreground">
            {doneTasks.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1 mr-3">
                <Check className="h-3 w-3 text-emerald-500" />
                {t.name}
              </span>
            ))}
          </span>
        )}

        {/* Tasks list */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[50%]">
          {tasks.map((task) => (
            <span
              key={task.id}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-medium shrink-0 ${
                task.status === "downloading"
                  ? "bg-primary/10 text-primary"
                  : task.status === "done"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : task.status === "error"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted/50 text-muted-foreground"
              }`}
              title={`${task.name}: ${task.current}/${task.total}`}
            >
              {task.status === "error" && (
                <AlertTriangle className="h-2.5 w-2.5" />
              )}
              {task.name}
              {task.status === "downloading" || task.status === "pending" ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTask(task.id)
                  }}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors cursor-pointer"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              ) : null}
            </span>
          ))}
        </div>

        {/* Clear done */}
        {hasDone && (
          <button
            type="button"
            onClick={clearDone}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
          >
            {t("download.version.launch")}
          </button>
        )}
      </div>
    </div>
  )
}