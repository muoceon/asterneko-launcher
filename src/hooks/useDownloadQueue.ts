import { useState, useCallback, useEffect } from "react"
import { listen } from "@tauri-apps/api/event"

export interface DownloadTask {
  id: string
  name: string
  stage: string
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

export function useDownloadQueue() {
  const [tasks, setTasks] = useState<DownloadTask[]>([])

  useEffect(() => {
    const unlisten = listen<DownloadProgressPayload>(
      "download-progress",
      (event) => {
        const { versionId, stage, current, total } = event.payload
        setTasks((prev) => {
          const existing = prev.find((t) => t.id === versionId)
          if (!existing) {
            return [
              ...prev,
              {
                id: versionId,
                name: versionId,
                stage,
                current,
                total,
                speed: 0,
                status: "downloading",
              },
            ]
          }
          return prev.map((t) =>
            t.id === versionId
              ? {
                  ...t,
                  stage,
                  current,
                  total,
                  status: stage === "done" ? "done" : "downloading",
                }
              : t,
          )
        })
      },
    )
    return () => { unlisten.then((fn) => fn()) }
  }, [])

  const addTask = useCallback((name: string, id: string) => {
    setTasks((prev) => [
      ...prev,
      {
        id,
        name,
        stage: "preparing",
        current: 0,
        total: 1,
        speed: 0,
        status: "pending",
      },
    ])
  }, [])

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const clearDone = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== "done"))
  }, [])

  const activeTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "downloading",
  )
  const hasActive = activeTasks.length > 0

  const overallProgress = (() => {
    if (tasks.length === 0) return 0
    let totalCurrent = 0
    let totalTotal = 0
    for (const t of tasks) {
      totalCurrent += t.current
      totalTotal += t.total
    }
    if (totalTotal === 0) return 0
    return Math.round((totalCurrent / totalTotal) * 100)
  })()

  const overallSpeed = tasks.reduce((s, t) => s + t.speed, 0)

  return {
    tasks,
    activeTasks,
    hasActive,
    overallProgress,
    overallSpeed,
    addTask,
    removeTask,
    clearDone,
  }
}