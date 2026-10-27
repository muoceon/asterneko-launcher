import { Check, Loader2, Shield, X } from "lucide-react"
import type { MicrosoftAuthState, MicrosoftLoginStep } from "@/hooks/useMicrosoftAuth"

const STEP_ORDER: MicrosoftLoginStep[] = [
  "opening_browser",
  "waiting_user",
  "exchanging_tokens",
  "fetching_profile",
]

const STEP_LABELS: Record<MicrosoftLoginStep, string> = {
  opening_browser: "正在打开浏览器授权页面...",
  waiting_user: "请在浏览器中完成 Microsoft 登录",
  exchanging_tokens: "正在验证 Xbox Live 身份...",
  fetching_profile: "正在获取 Minecraft 账号信息...",
}

interface Props {
  open: boolean
  state: MicrosoftAuthState
  onClose: () => void
  onRetry: () => void
}

export default function MicrosoftLoginPopup({
  open,
  state,
  onClose,
  onRetry,
}: Props) {
  if (!open) return null

  const currentStep =
    state.status === "loading" ? state.step : null

  const currentStepIndex = currentStep
    ? STEP_ORDER.indexOf(currentStep)
    : -1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Microsoft 正版登录</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Loading steps */}
        {state.status === "loading" && (
          <div className="space-y-0">
            {STEP_ORDER.map((step, index) => {
              const isCompleted = currentStepIndex > index
              const isCurrent = currentStepIndex === index
              const isPending = currentStepIndex < index

              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 px-1 py-2.5 rounded-lg transition-colors ${
                    isCurrent ? "bg-primary/5" : ""
                  }`}
                >
                  <StepIcon
                    completed={isCompleted}
                    current={isCurrent}
                    pending={isPending}
                  />
                  <span
                    className={`text-sm ${
                      isCompleted
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isCurrent
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                    }`}
                  >
                    {STEP_LABELS[step]}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Error state */}
        {state.status === "error" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                {state.message}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
              >
                重试
              </button>
            </div>
          </div>
        )}

        {/* Success state */}
        {state.status === "authenticated" && (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <Check className="h-7 w-7 text-emerald-500" />
              </div>
            </div>
            <p className="text-center text-sm font-medium">
              登录成功: {state.account.username}
            </p>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
              >
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StepIcon({
  completed,
  current,
  pending,
}: {
  completed: boolean
  current: boolean
  pending: boolean
}) {
  if (completed) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      </div>
    )
  }
  if (current) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    )
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/20">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
    </div>
  )
}