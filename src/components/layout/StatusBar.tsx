import { ListTodo, Check, Loader2 } from "lucide-react"
import { useTaskManager } from "@/contexts/TaskManagerContext"
import { Button } from "@/components/ui/button"

interface StatusBarProps {
  onOpenManager: () => void
}

export default function StatusBar({ onOpenManager }: StatusBarProps) {
  const { activeCount, doneCount, overallProgress } = useTaskManager()

  const hasActivity = activeCount > 0 || doneCount > 0

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-muted/30 px-2 text-xs text-muted-foreground">
      <span className="px-2">v0.1.0</span>

      <Button
        variant="ghost"
        size="xs"
        onClick={onOpenManager}
        className="h-full gap-1.5 rounded-none px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        {activeCount > 0 ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span>
              {activeCount} 个任务 · {overallProgress}%
            </span>
          </>
        ) : doneCount > 0 ? (
          <>
            <Check className="h-3 w-3 text-emerald-500" />
            <span>{doneCount} 个已完成</span>
          </>
        ) : (
          <>
            <ListTodo className="h-3 w-3" />
            <span>任务管理</span>
          </>
        )}

        {hasActivity && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {activeCount + doneCount}
          </span>
        )}
      </Button>
    </footer>
  )
}