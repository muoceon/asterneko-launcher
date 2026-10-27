import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { X, Check, AlertTriangle, Loader2, Trash2, Clock, ListTodo, CheckCheck } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useTaskManager, type ManagerTask, type TaskTag } from "@/contexts/TaskManagerContext"

type PanelTab = "active" | "done" | "history"

const ALL_TAGS: TaskTag[] = ["download", "install", "launch", "instance", "multiplayer", "backup", "sync"]

const TAG_META: Record<TaskTag, { labelKey: string; className: string; dotClass: string }> = {
  download: {
    labelKey: "task.manager.tag_download",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    dotClass: "bg-blue-500",
  },
  install: {
    labelKey: "task.manager.tag_install",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  launch: {
    labelKey: "task.manager.tag_launch",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  instance: {
    labelKey: "task.manager.tag_instance",
    className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    dotClass: "bg-violet-500",
  },
  multiplayer: {
    labelKey: "task.manager.tag_multiplayer",
    className: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dotClass: "bg-rose-500",
  },
  backup: {
    labelKey: "task.manager.tag_backup",
    className: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    dotClass: "bg-teal-500",
  },
  sync: {
    labelKey: "task.manager.tag_sync",
    className: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    dotClass: "bg-cyan-500",
  },
}

const STAGE_LABELS: Record<string, string> = {
  client: "阶段：下载 Minecraft 主文件",
  asset_index: "阶段：下载资源索引",
  assets: "阶段：下载游戏资源",
  libraries: "阶段：下载依赖库",
  loader: "阶段：安装加载器",
  done: "阶段：完成",
}

interface TaskManagerPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatSpeed(bytesPerSec: number) {
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
}

function TaskRow({ task, onRemove }: { task: ManagerTask; onRemove?: () => void }) {
  const { t } = useTranslation("home")
  const meta = TAG_META[task.tag]

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        task.status === "downloading"
          ? "border-primary/30 bg-primary/5"
          : task.status === "done"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : task.status === "error"
              ? "border-destructive/30 bg-destructive/5"
              : "border-border bg-muted/20"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {task.status === "downloading" && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
            )}
            {task.status === "done" && (
              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            )}
            {task.status === "error" && (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            )}
            {task.status === "pending" && (
              <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
            )}
            <span className="text-sm font-medium truncate">{task.name}</span>
            <span
              className={`inline-flex items-center rounded px-1.5 py-0 text-[10px] font-medium shrink-0 ${meta.className}`}
            >
              {t(meta.labelKey)}
            </span>
          </div>

          {(task.status === "downloading" || task.status === "pending") && (
            <div className="space-y-1">
              {task.stage && (
                <div className="text-[10px] text-muted-foreground/70 mb-0.5">
                  {STAGE_LABELS[task.stage] || task.stage}
                </div>
              )}
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                  style={{
                    width: `${task.total > 0 ? Math.round((task.current / task.total) * 100) : 0}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="truncate max-w-[60%]" title={task.message || task.stage}>
                  {task.message || task.stage}
                </span>
                <span className="shrink-0 ml-2">
                  {task.total > 0
                    ? `${Math.round((task.current / task.total) * 100)}%`
                    : "..."}
                </span>
              </div>
              {task.speed > 0 && (
                <div className="text-[10px] text-muted-foreground/60 text-right">
                  {formatSpeed(task.speed)}
                </div>
              )}
            </div>
          )}

          {task.status === "error" && task.error && (
            <p className="text-[11px] text-destructive mt-1">{task.error}</p>
          )}

          {task.status === "done" && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t("task.manager.done", "已完成")}
            </p>
          )}
        </div>

        {onRemove && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Icon className="h-8 w-8 mb-2 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

function TagFilterBar({
  tagFilter,
  onTagFilter,
  onClearTagFilter,
  tasks,
}: {
  tagFilter: TaskTag | null
  onTagFilter: (tag: TaskTag) => void
  onClearTagFilter: () => void
  tasks: ManagerTask[]
}) {
  const { t } = useTranslation("home")

  return (
    <div className="flex flex-col gap-0.5 px-1.5 pt-2 border-t">
      <span className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("task.manager.filter_by_type", "类型")}
      </span>
      {ALL_TAGS.map((tag) => {
        const meta = TAG_META[tag]
        const count = tasks.filter((t) => t.tag === tag).length
        const isActive = tagFilter === tag

        return (
          <button
            key={tag}
            onClick={() => onTagFilter(tag)}
            className={`flex items-center gap-2 mx-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              isActive
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <span className={`h-2 w-2 rounded-full shrink-0 ${meta.dotClass}`} />
            <span className="flex-1 text-left">{t(meta.labelKey)}</span>
            {count > 0 && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {count}
              </span>
            )}
          </button>
        )
      })}

      {tagFilter && (
        <button
          onClick={onClearTagFilter}
          className="flex items-center gap-1.5 mx-1.5 mt-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <X className="h-3 w-3" />
          {t("task.manager.clear_filter", "清除筛选")}
        </button>
      )}
    </div>
  )
}

export function TaskManagerPopup({ open, onOpenChange }: TaskManagerPopupProps) {
  const { t } = useTranslation("home")
  const [activeTab, setActiveTab] = useState<PanelTab>("active")
  const [tagFilter, setTagFilter] = useState<TaskTag | null>(null)
  const { tasks, history, removeTask, clearDone, clearHistory } = useTaskManager()

  const activeScopedTasks = useMemo(() => {
    return tasks.filter(
      (t) => t.status === "pending" || t.status === "downloading" || t.status === "error",
    )
  }, [tasks])

  const doneScopedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === "done")
  }, [tasks])

  const filteredTasks = useMemo(() => {
    let source: ManagerTask[]
    switch (activeTab) {
      case "active":
        source = activeScopedTasks
        break
      case "done":
        source = doneScopedTasks
        break
      case "history":
        source = history
        break
    }
    if (tagFilter) {
      source = source.filter((t) => t.tag === tagFilter)
    }
    return source
  }, [activeTab, activeScopedTasks, doneScopedTasks, history, tagFilter])

  const activeCount = activeScopedTasks.length
  const doneCount = doneScopedTasks.length

  const sidebarItems: { key: PanelTab; labelKey: string; icon: React.ReactNode; count: number }[] = [
    { key: "active", labelKey: "task.manager.tab_active", icon: <ListTodo className="h-4 w-4" />, count: activeCount },
    { key: "done", labelKey: "task.manager.tab_done", icon: <CheckCheck className="h-4 w-4" />, count: doneCount },
    { key: "history", labelKey: "task.manager.tab_history", icon: <Clock className="h-4 w-4" />, count: history.length },
  ]

  const showClearDone = activeTab === "done" && doneCount > 0
  const showClearHistory = activeTab === "history" && history.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] min-h-125 flex flex-col p-0 gap-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-5 py-3.5 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ListTodo className="h-4 w-4 text-primary" />
            {t("task.manager.title", "任务管理器")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          <nav className="w-44 shrink-0 border-r bg-muted/10 flex flex-col overflow-y-auto">
            <div className="py-2 flex flex-col gap-0.5">
              {sidebarItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`flex items-center gap-2.5 mx-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === item.key
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <span className={activeTab === item.key ? "text-primary" : ""}>
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{t(item.labelKey)}</span>
                  {item.count > 0 && (
                    <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <TagFilterBar
              tagFilter={tagFilter}
              onTagFilter={(tag) => setTagFilter(tagFilter === tag ? null : tag)}
              onClearTagFilter={() => setTagFilter(null)}
              tasks={activeTab === "active" ? activeScopedTasks : activeTab === "done" ? doneScopedTasks : history}
            />
          </nav>

          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
              {filteredTasks.length === 0 ? (
                <EmptyState
                  icon={
                    activeTab === "active" ? ListTodo
                      : activeTab === "done" ? CheckCheck
                      : Clock
                  }
                  message={
                    activeTab === "active"
                      ? t("task.manager.empty_active", "没有进行中的任务")
                      : activeTab === "done"
                        ? t("task.manager.empty_done", "没有已完成的任务")
                        : t("task.manager.empty_history", "暂无历史记录")
                  }
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onRemove={
                        task.status === "pending" || task.status === "downloading"
                          ? () => removeTask(task.id)
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {showClearDone && (
              <DialogFooter className="shrink-0" showCloseButton={false}>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={clearDone}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("task.manager.archive_done", "归档已完成")}
                </Button>
              </DialogFooter>
            )}

            {showClearHistory && (
              <DialogFooter className="shrink-0" showCloseButton={false}>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={clearHistory}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("task.manager.clear_history", "清空历史记录")}
                </Button>
              </DialogFooter>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}