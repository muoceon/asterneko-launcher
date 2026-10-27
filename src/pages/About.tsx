import { useTranslation } from "react-i18next"
import { useState, useEffect } from "react"
import {
  Info, BookOpen, Heart, ExternalLink,
  Code, Boxes, Atom, Paintbrush,
  Monitor, Sparkles,
  Bug, RefreshCw, Globe,
} from "lucide-react"
import { Logo } from "@/components/layout/Logo"

const techStack = [
  { icon: Atom, label: "Tauri 2" },
  { icon: Code, label: "React 19" },
  { icon: Boxes, label: "TypeScript" },
  { icon: Paintbrush, label: "Tailwind CSS v4" },
]

const acknowledgments = [
  "React", "Tauri", "Vite", "TypeScript", "Tailwind CSS",
  "lucide-react", "shadcn/ui", "i18next", "Radix UI",
  "react-router", "tw-animate-css",
]

function getRuntimeInfo() {
  const ua = navigator.userAgent
  let os = "Unknown"
  if (ua.includes("Windows")) os = "Windows"
  else if (ua.includes("Mac")) os = "macOS"
  else if (ua.includes("Linux")) os = "Linux"

  let webview = "Unknown"
  if (ua.includes("Edg")) webview = "WebView2"
  else if (ua.includes("Chrome")) webview = "Chromium"
  else if (ua.includes("Firefox")) webview = "Gecko"

  return {
    os,
    arch: navigator.platform ?? "Unknown",
    webview,
  }
}

export default function AboutPage() {
  const { t } = useTranslation("home")
  const [runtime, setRuntime] = useState<ReturnType<typeof getRuntimeInfo> | null>(null)

  useEffect(() => {
    setRuntime(getRuntimeInfo())
  }, [])

  return (
    <div className="flex min-h-full flex-col gap-8 p-8">
      {/* Hero */}
      <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl border border-border bg-muted/30 px-8 pt-10 pb-8">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-20 right-0 h-64 w-64 translate-x-1/4 rounded-full bg-[radial-gradient(circle,var(--color-primary)/10%,transparent_60%)]" />
          <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-[radial-gradient(circle,var(--color-primary)/6%,transparent_70%)] blur-2xl" />
        </div>

        <div className="inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/15">
          <Logo className="h-12 w-12" />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">AST NEKO</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("about.slogan")}</p>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          v0.1.0
        </div>
      </div>

      {/* Project Description */}
      <p className="text-center text-sm leading-relaxed text-muted-foreground max-w-md mx-auto">
        {t("about.description")}
      </p>

      {/* Info Cards */}
      <div className="space-y-4">
        {/* Version */}
        <div className="rounded-2xl border border-border">
          <div className="flex items-center gap-3 px-5 py-4">
            <Info className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t("about.version.title")}</p>
              <p className="text-xs text-muted-foreground">{t("about.version.desc")}</p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">0.1.0</span>
          </div>

          <div className="border-t border-border px-5 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("about.version.channel")}</span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">Beta</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("about.version.build")}</span>
              <span className="font-mono">2026.1004.0</span>
            </div>
          </div>
        </div>

        {/* Runtime Environment */}
        {runtime && (
          <div className="rounded-2xl border border-border divide-y divide-border">
            <div className="flex items-center gap-3 px-5 py-4">
              <Monitor className="h-5 w-5 shrink-0 text-muted-foreground" />
              <p className="text-sm font-medium">{t("about.runtime.title")}</p>
            </div>
            <div className="px-5 py-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("about.runtime.os")}</span>
                <span className="font-medium text-foreground/80">{runtime.os}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("about.runtime.arch")}</span>
                <span className="font-medium text-foreground/80">{runtime.arch}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("about.runtime.webview")}</span>
                <span className="font-medium text-foreground/80">{runtime.webview}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tech Stack */}
        <div className="rounded-2xl border border-border divide-y divide-border">
          <div className="flex items-center gap-3 px-5 py-4">
            <Boxes className="h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-sm font-medium">{t("about.tech.title")}</p>
          </div>
          <div className="px-5 py-3">
            <div className="flex flex-wrap gap-2">
              {techStack.map((tech) => (
                <span
                  key={tech.label}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground/80"
                >
                  <tech.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {tech.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Acknowledgments */}
        <div className="rounded-2xl border border-border divide-y divide-border">
          <div className="flex items-center gap-3 px-5 py-4">
            <Sparkles className="h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-sm font-medium">{t("about.acknowledgments.title")}</p>
          </div>
          <div className="px-5 py-3">
            <div className="flex flex-wrap gap-1.5">
              {acknowledgments.map((name) => (
                <span
                  key={name}
                  className="inline-flex rounded-md bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Credits */}
        <div className="rounded-2xl border border-border">
          <div className="flex items-center gap-3 px-5 py-4">
            <Heart className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t("about.credits.title")}</p>
              <p className="text-xs text-muted-foreground">{t("about.credits.desc")}</p>
            </div>
          </div>

          <div className="border-t border-border px-5 py-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
        </div>

        {/* License */}
        <div className="rounded-2xl border border-border">
          <div className="flex items-center gap-3 px-5 py-4">
            <BookOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t("about.license.title")}</p>
              <p className="text-xs text-muted-foreground">{t("about.license.desc")}</p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">GPL-3.0</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm font-medium text-foreground/80 transition-all hover:bg-muted hover:text-foreground hover:border-foreground/20"
        >
          <RefreshCw className="h-4 w-4" />
          {t("about.actions.updates")}
        </a>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm font-medium text-foreground/80 transition-all hover:bg-muted hover:text-foreground hover:border-foreground/20"
        >
          <Bug className="h-4 w-4" />
          {t("about.actions.feedback")}
        </a>
        <a
          href="https://asterneko.muoceon.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm font-medium text-foreground/80 transition-all hover:bg-muted hover:text-foreground hover:border-foreground/20"
        >
          <Globe className="h-4 w-4" />
          {t("about.actions.homepage")}
        </a>
      </div>

      {/* Footer */}
      <p className="text-center text-[11px] text-muted-foreground/60">
        {t("about.footer", { year: new Date().getFullYear() })}
      </p>
    </div>
  )
}