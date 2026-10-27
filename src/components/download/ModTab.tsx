import { useTranslation } from "react-i18next"
import { useModList, formatDownloads } from "@/hooks/useModList"
import type { ModLoader, ModItem } from "@/hooks/useModList"
import { Search, Download, Users, ArrowDownToLine, Puzzle } from "lucide-react"
import { useState, useCallback } from "react"

const loaderOptions: { key: ModLoader; labelKey: string }[] = [
  { key: "all", labelKey: "download.mod.filterAll" },
  { key: "fabric", labelKey: "download.mod.filterFabric" },
  { key: "forge", labelKey: "download.mod.filterForge" },
  { key: "neoforge", labelKey: "download.mod.filterNeoForge" },
  { key: "quilt", labelKey: "download.mod.filterQuilt" },
]

const mcVersionOptions = ["1.21.4", "1.21.1", "1.20.6", "1.20.4", "1.20.1", "1.19.4"]

export default function ModTab() {
  const { t } = useTranslation("home")
  const { mods, loader, setLoader, mcVersion, setMcVersion, search, setSearch } =
    useModList()
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)

  const toggleExpand = useCallback(
    (slug: string) => {
      setExpandedSlug((prev) => (prev === slug ? null : slug))
    },
    [],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
          {loaderOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setLoader(opt.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                loader === opt.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>

        <select
          value={mcVersion}
          onChange={(e) => setMcVersion(e.target.value)}
          className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground outline-none cursor-pointer hover:bg-muted/50"
        >
          {mcVersionOptions.map((v) => (
            <option key={v} value={v}>
              MC {v}
            </option>
          ))}
        </select>

        <div className="relative flex-1 max-w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("download.mod.search")}
            className="w-full rounded-lg border border-border bg-muted/30 py-1.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary/40 focus:bg-background"
          />
        </div>
      </div>

      {/* Mod List */}
      <div className="space-y-1.5">
        {mods.map((mod) => (
          <ModCard
            key={mod.slug}
            mod={mod}
            t={t}
            expanded={expandedSlug === mod.slug}
            onToggle={() => toggleExpand(mod.slug)}
          />
        ))}
        {mods.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Puzzle className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">没有找到匹配的模组</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ModCard({
  mod,
  t,
  expanded,
  onToggle,
}: {
  mod: ModItem
  t: (key: string) => string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full rounded-xl border border-border bg-card text-left transition-all cursor-pointer hover:border-primary/25 hover:bg-muted/20 ${
        expanded ? "border-primary/40 bg-muted/20 ring-1 ring-primary/10" : ""
      }`}
    >
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
          {mod.title.charAt(0)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {mod.title}
            </span>
            <span className="text-[10px] text-muted-foreground">
              by {mod.author}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {mod.description}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <ArrowDownToLine className="h-2.5 w-2.5" />
              {formatDownloads(mod.downloads)}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Users className="h-2.5 w-2.5" />
              {formatDownloads(mod.followers)}
            </span>
          </div>
        </div>

        {/* Action */}
        <div className="shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm">
            <Download className="h-3 w-3" />
            {t("download.mod.download")}
          </span>
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/10">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {mod.description}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {mod.loader !== "any" ? mod.loader.charAt(0).toUpperCase() + mod.loader.slice(1) : "Multi"}
            </span>
            {mod.mcVersions.slice(0, 4).map((v) => (
              <span
                key={v}
                className="rounded-md bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                MC {v}
              </span>
            ))}
            {mod.mcVersions.length > 4 && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{mod.mcVersions.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}
    </button>
  )
}