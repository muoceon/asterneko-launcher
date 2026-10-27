import { useTranslation } from "react-i18next"
import { PackagePlus, FolderUp } from "lucide-react"

export default function ModpackTab() {
  const { t } = useTranslation("home")

  return (
    <div className="flex flex-col">
      {/* Import Button */}
      <div className="mb-6">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-border px-5 py-3 text-sm font-medium text-muted-foreground transition-all cursor-pointer hover:border-primary/40 hover:text-primary hover:bg-primary/5"
        >
          <FolderUp className="h-4 w-4" />
          {t("download.modpack.import")}
        </button>
      </div>

      {/* Placeholder */}
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/40 ring-1 ring-border">
          <PackagePlus className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">
            {t("download.modpack.comingSoon")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("download.modpack.desc")}
          </p>
        </div>
      </div>
    </div>
  )
}