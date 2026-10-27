import { useTranslation } from "react-i18next"
import { Sparkles } from "lucide-react"
import { useState } from "react"

export default function ShaderTab() {
  const { t } = useTranslation("home")
  const [subTab, setSubTab] = useState<"shaders" | "resourcepacks">("shaders")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex rounded-lg border border-border p-0.5 bg-muted/30 self-start">
        <button
          onClick={() => setSubTab("shaders")}
          className={`rounded-md px-4 py-1 text-xs font-medium transition-all cursor-pointer ${
            subTab === "shaders"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("download.shader.tabShaders")}
        </button>
        <button
          onClick={() => setSubTab("resourcepacks")}
          className={`rounded-md px-4 py-1 text-xs font-medium transition-all cursor-pointer ${
            subTab === "resourcepacks"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("download.shader.tabResourcepacks")}
        </button>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/40 ring-1 ring-border">
          <Sparkles className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">
            {t("download.shader.comingSoon")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("download.shader.desc")}
          </p>
        </div>
      </div>
    </div>
  )
}