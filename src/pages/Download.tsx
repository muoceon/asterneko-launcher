import { useTranslation } from "react-i18next"
import { useState, useCallback, useMemo } from "react"
import { Download, PackagePlus, Puzzle, Sparkles } from "lucide-react"
import VersionTab from "@/components/download/VersionTab"
import ModTab from "@/components/download/ModTab"
import ModpackTab from "@/components/download/ModpackTab"
import ShaderTab from "@/components/download/ShaderTab"
import { DownloadQueueBar } from "@/components/download/DownloadQueueBar"
import { useTaskManager } from "@/contexts/TaskManagerContext"

type DownloadTab = "versions" | "modpacks" | "mods" | "shaders"

const tabs: { key: DownloadTab; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "versions", labelKey: "download.tabs.versions", icon: Download },
  { key: "modpacks", labelKey: "download.tabs.modpacks", icon: PackagePlus },
  { key: "mods", labelKey: "download.tabs.mods", icon: Puzzle },
  { key: "shaders", labelKey: "download.tabs.shaders", icon: Sparkles },
]

export default function DownloadPage() {
  const { t } = useTranslation("home")
  const [activeTab, setActiveTab] = useState<DownloadTab>("versions")
  const { tasks, activeCount, overallProgress, overallSpeed, removeTask, clearDone } =
    useTaskManager()

  const queue = useMemo(
    () => ({
      tasks,
      hasActive: activeCount > 0,
      overallProgress,
      overallSpeed,
      removeTask,
      clearDone,
    }),
    [tasks, activeCount, overallProgress, overallSpeed, removeTask, clearDone],
  )

  const renderTab = useCallback(() => {
    switch (activeTab) {
      case "versions":
        return <VersionTab />
      case "modpacks":
        return <ModpackTab />
      case "mods":
        return <ModTab />
      case "shaders":
        return <ShaderTab />
    }
  }, [activeTab])

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-8 pt-8 pb-2">
        <Download className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">
          {t("download.title")}
        </h1>
      </div>

      {/* Tab Bar */}
      <div className="px-8 pb-4">
        <div className="flex rounded-xl border border-border bg-muted/30 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(tab.labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 px-8 pb-4 min-h-0">
        {renderTab()}
      </div>

      {/* Global Download Queue */}
      <DownloadQueueBar queue={queue} />
    </div>
  )
}