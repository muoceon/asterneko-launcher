import { useState, useEffect, useMemo } from "react"
import { invoke } from "@tauri-apps/api/core"
import { getSetting } from "@/lib/settings"
import type { DownloadChannel } from "@/lib/settings"

export function useDownloadChannel(): DownloadChannel {
  return getSetting("downloadChannel") as DownloadChannel
}

export interface ManifestVersion {
  id: string
  type: string
  url: string
  time: string
  releaseTime: string
  sha1: string
}

export type VersionFilter = "release" | "snapshot" | "old" | "april_fools"

const APRIL_FOOLS_IDS = new Set([
  "2.0",
  "15w14a",
  "1.RV-Pre1",
  "3D Shareware v1.34",
  "20w14∞",
  "20w14infinite",
  "22w13oneBlockAtATime",
  "23w13a_or_b",
  "24w14potato",
])

export function useVersionList() {
  const [allVersions, setAllVersions] = useState<ManifestVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<VersionFilter>("release")
  const [search, setSearch] = useState("")
  const channel = useDownloadChannel()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    invoke<ManifestVersion[]>("fetch_version_manifest", { channel })
      .then((versions) => {
        if (!cancelled) {
          setAllVersions(versions)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error("获取版本列表失败:", err)
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [channel])

  const filtered = useMemo(() => {
    let list: ManifestVersion[]

    if (filter === "release") {
      list = allVersions.filter((v) => v.type === "release")
    } else if (filter === "snapshot") {
      list = allVersions.filter((v) => v.type === "snapshot")
    } else if (filter === "april_fools") {
      list = allVersions.filter((v) => APRIL_FOOLS_IDS.has(v.id))
    } else {
      list = allVersions.filter(
        (v) =>
          v.type === "old_beta" ||
          v.type === "old_alpha" ||
          v.type === "old",
      )
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((v) => v.id.toLowerCase().includes(q))
    }

    return list.sort(
      (a, b) =>
        new Date(b.releaseTime).getTime() -
        new Date(a.releaseTime).getTime(),
    )
  }, [allVersions, filter, search])

  return {
    versions: filtered,
    loading,
    filter,
    setFilter,
    search,
    setSearch,
  }
}