import { createContext, useContext, useState, useCallback, useEffect } from "react"
import { listen } from "@tauri-apps/api/event"
import { invoke } from "@tauri-apps/api/core"

export type TaskTag = "download" | "install" | "launch" | "instance" | "multiplayer" | "backup" | "sync"

export interface ManagerTask {
  id: string
  name: string
  stage: string
  message: string
  tag: TaskTag
  current: number
  total: number
  speed: number
  status: "pending" | "downloading" | "done" | "error"
  error?: string
}

interface DownloadProgressPayload {
  taskId: string
  versionId: string
  stage: string
  current: number
  total: number
  speed: number
  message: string
}

export interface TaskManagerState {
  tasks: ManagerTask[]
  history: ManagerTask[]
  activeCount: number
  doneCount: number
  overallProgress: number
  overallSpeed: number
  addTask: (name: string, id: string, tag?: TaskTag) => void
  markTaskError: (id: string, error: string) => void
  removeTask: (id: string) => void
  clearDone: () => void
  clearHistory: () => void
}

const TaskManagerContext = createContext<TaskManagerState | null>(null)

export function useTaskManager() {
  const ctx = useContext(TaskManagerContext)
  if (!ctx) throw new Error("useTaskManager must be used within TaskManagerProvider")
  return ctx
}

export function TaskManagerProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<ManagerTask[]>([])
  const [history, setHistory] = useState<ManagerTask[]>([])

  useEffect(() => {
    const unlisten = listen<DownloadProgressPayload>(
      "download-progress",
      (event) => {
        const { taskId, stage, current, total, speed, message } = event.payload
        setTasks((prev) => {
          const existing = prev.find((t) => t.id === taskId)
          if (!existing) return prev
          return prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  stage,
                  message,
                  current,
                  total,
                  speed,
                  status: stage === "done" ? ("done" as const) : ("downloading" as const),
                }
              : t,
          )
        })
      },
    )
    return () => { unlisten.then((fn) => fn()) }
  }, [])

  const addTask = useCallback((name: string, id: string, tag: TaskTag = "download") => {
    setTasks((prev) => {
      if (prev.find((t) => t.id === id)) return prev
      return [
        ...prev,
        {
          id,
          name,
          tag,
          stage: "preparing",
          message: "准备中...",
          current: 0,
          total: 1,
          speed: 0,
          status: "pending" as const,
        },
      ]
    })
  }, [])

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id)
      if (task && (task.status === "pending" || task.status === "downloading")) {
        invoke("cancel_install", { taskId: id }).catch(() => {})
      }
      return prev.filter((t) => t.id !== id)
    })
  }, [])

  const markTaskError = useCallback((id: string, error: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: "error" as const, error, message: error }
          : t,
      ),
    )
  }, [])

  const clearDone = useCallback(() => {
    setTasks((prev) => {
      const done = prev.filter((t) => t.status === "done")
      setHistory((h) => [...done, ...h])
      return prev.filter((t) => t.status !== "done")
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  const liveTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "downloading"
  )
  const activeCount = liveTasks.length
  const doneCount = tasks.filter((t) => t.status === "done").length

  const overallProgress = (() => {
    const relevant = [...liveTasks, ...tasks.filter((t) => t.status === "done")]
    if (relevant.length === 0) return 0
    let totalCurrent = 0
    let totalTotal = 0
    for (const t of relevant) {
      totalCurrent += t.current
      totalTotal += t.total
    }
    if (totalTotal === 0) return 0
    return Math.round((totalCurrent / totalTotal) * 100)
  })()

  const overallSpeed = tasks.reduce((s, t) => s + t.speed, 0)

  return (
    <TaskManagerContext.Provider
      value={{ tasks, history, activeCount, doneCount, overallProgress, overallSpeed, addTask, markTaskError, removeTask, clearDone, clearHistory }}
    >
      {children}
    </TaskManagerContext.Provider>
  )
}