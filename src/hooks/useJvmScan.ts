import { useState, useCallback, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"

export interface JvmInstallation {
  path: string
  javaExecutable: string
  version: string | null
  vendor: string | null
  arch: string | null
  source: "Automatic" | "Manual"
}

interface UseJvmScanReturn {
  jvms: JvmInstallation[]
  selectedPath: string
  scanning: boolean
  rescan: () => Promise<void>
  selectJvm: (executable: string) => void
  addManual: (path: string) => Promise<JvmInstallation | null>
  removeManual: (executable: string) => void
}

export function useJvmScan(
  initialJavaPath: string,
  onJavaPathChange: (path: string) => void,
): UseJvmScanReturn {
  const [jvms, setJvms] = useState<JvmInstallation[]>([])
  const [scanning, setScanning] = useState(false)
  const [manualJvms, setManualJvms] = useState<JvmInstallation[]>(() => {
    try {
      const raw = localStorage.getItem("asterneko-manual-jvms")
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const persistManual = useCallback((list: JvmInstallation[]) => {
    setManualJvms(list)
    localStorage.setItem("asterneko-manual-jvms", JSON.stringify(list))
  }, [])

  const rescan = useCallback(async () => {
    setScanning(true)
    try {
      const autoJvms: JvmInstallation[] = await invoke("scan_jvm")
      setJvms([...autoJvms, ...manualJvms])
    } catch (e) {
      console.error("scan_jvm failed:", e)
    } finally {
      setScanning(false)
    }
  }, [manualJvms])

  useEffect(() => {
    rescan()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectJvm = useCallback(
    (executable: string) => {
      onJavaPathChange(executable)
    },
    [onJavaPathChange],
  )

  const addManual = useCallback(
    async (path: string): Promise<JvmInstallation | null> => {
      try {
        const result: JvmInstallation | null = await invoke("add_manual_jvm", { path })
        if (result) {
          const updated = [...manualJvms, result]
          persistManual(updated)
          setJvms((prev) => [...prev, result])
        }
        return result
      } catch (e) {
        console.error("add_manual_jvm failed:", e)
        return null
      }
    },
    [manualJvms, persistManual],
  )

  const removeManual = useCallback(
    (executable: string) => {
      const updated = manualJvms.filter((j) => j.javaExecutable !== executable)
      persistManual(updated)
      setJvms((prev) => prev.filter((j) => j.javaExecutable !== executable))
      if (initialJavaPath === executable) {
        onJavaPathChange("")
      }
    },
    [manualJvms, persistManual, initialJavaPath, onJavaPathChange],
  )

  return {
    jvms,
    selectedPath: initialJavaPath,
    scanning,
    rescan,
    selectJvm,
    addManual,
    removeManual,
  }
}