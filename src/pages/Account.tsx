import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import {
  User, Cloud, Gamepad2, LogIn, UserPlus,
  Settings, Shield, Wifi, WifiOff, X,
} from "lucide-react"
import { Logo } from "@/components/layout/Logo"
import { useOAuth } from "@/hooks/useOAuth"
import { useGameAccount } from "@/hooks/useGameAccount"
import type { GameAccount } from "@/hooks/useGameAccount"
import { useMicrosoftAuth } from "@/hooks/useMicrosoftAuth"
import MicrosoftLoginPopup from "@/components/instance/MicrosoftLoginPopup"

type AccountTab = "muoceon" | "game"

export default function AccountPage() {
  const { t } = useTranslation("home")
  const [activeTab, setActiveTab] = useState<AccountTab>("muoceon")

  const oauth = useOAuth()
  const game = useGameAccount()
  const msAuth = useMicrosoftAuth()

  const [showOfflineDialog, setShowOfflineDialog] = useState(false)
  const [showMicrosoftDialog, setShowMicrosoftDialog] = useState(false)
  const [offlineUsername, setOfflineUsername] = useState("")
  const [offlineError, setOfflineError] = useState("")

  const handleOfflineLogin = async () => {
    const trimmed = offlineUsername.trim()
    if (!trimmed) {
      setOfflineError(t("accountPage.game.offlineDialog.errorEmpty"))
      return
    }
    if (trimmed.length > 16) {
      setOfflineError(t("accountPage.game.offlineDialog.errorTooLong"))
      return
    }
    setOfflineError("")
    try {
      await game.loginOffline(trimmed)
      setShowOfflineDialog(false)
      setOfflineUsername("")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setOfflineError(message)
    }
  }

  const handleOfflineDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleOfflineLogin()
    if (e.key === "Escape") {
      setShowOfflineDialog(false)
      setOfflineUsername("")
      setOfflineError("")
    }
  }

  const handleMicrosoftLogin = useCallback(() => {
    setShowMicrosoftDialog(true)
    msAuth.login()
  }, [msAuth])

  useEffect(() => {
    if (msAuth.state.status === "authenticated") {
      const timer = setTimeout(() => {
        setShowMicrosoftDialog(false)
        msAuth.reset()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [msAuth.state.status])

  return (
    <div className="flex min-h-full flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <User className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">{t("accountPage.title")}</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl border border-border bg-muted/50 p-1 w-fit">
        {(["muoceon", "game"] as AccountTab[]).map((tab) => {
          const isActive = activeTab === tab
          const Icon = tab === "muoceon" ? Cloud : Gamepad2
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(`accountPage.tabs.${tab}`)}
            </button>
          )
        })}
      </div>

      {/* MuoCeon Cloud Account */}
      {activeTab === "muoceon" && (
        <div className="space-y-4">
          {oauth.state.status === "loading" ? (
            <div className="rounded-2xl border border-border">
              <div className="flex items-center justify-center gap-3 px-5 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">正在跳转授权页面...</p>
              </div>
            </div>
          ) : oauth.state.status === "authenticated" ? (
            <>
              <div className="rounded-2xl border border-border">
                <div className="flex items-center gap-4 px-5 py-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                    {oauth.state.user.picture ? (
                      <img
                        src={oauth.state.user.picture}
                        alt=""
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <Logo className="h-7 w-7" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {oauth.state.user.name ?? oauth.state.user.preferred_username ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {oauth.state.user.email ?? ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {t("accountPage.muoceon.loggedInAs")}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-border">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium">{t("accountPage.muoceon.sync.title")}</p>
                      <p className="text-[11px] text-muted-foreground">{t("accountPage.muoceon.sync.desc")}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer transition-colors hover:bg-emerald-500/20"
                  >
                    <Wifi className="h-3 w-3" />
                    {t("accountPage.muoceon.sync.enabled")}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={oauth.logout}
                className="flex w-full items-center gap-3 rounded-2xl border border-border px-5 py-3.5 text-sm text-red-500 transition-colors hover:bg-red-500/5 cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                {t("accountPage.muoceon.logout")}
              </button>
            </>
          ) : (
            <>
              {oauth.state.status === "error" && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {oauth.state.message}
                  </p>
                </div>
              )}
              <div className="rounded-2xl border border-border">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Cloud className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t("accountPage.muoceon.title")}</p>
                      <p className="text-xs text-muted-foreground">{t("accountPage.muoceon.desc")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={oauth.login}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      {t("accountPage.muoceon.login")}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted/50 cursor-pointer"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {t("accountPage.muoceon.register")}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Game Account */}
      {activeTab === "game" && (
        <div className="space-y-4">
          {game.accounts.length > 0 ? (
            <div className="space-y-4">
              {game.activeAccount && (
                <div className="rounded-2xl border border-border">
                  <div className="flex items-center gap-4 px-5 py-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 ring-1 ring-amber-500/20">
                      <Gamepad2 className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold">{game.activeAccount.username}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          game.activeAccount.type === "Microsoft"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted-foreground/10 text-muted-foreground"
                        }`}>
                          {t(`accountPage.game.type.${game.activeAccount.type === "Microsoft" ? "microsoft" : "offline"}`)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("accountPage.game.current")}</p>
                    </div>
                  </div>
                </div>
              )}

              {game.accounts.length > 1 && (
                <div className="rounded-2xl border border-border">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <User className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <p className="text-sm font-medium">{t("account.switch")}</p>
                  </div>
                  <div className="border-t border-border divide-y divide-border">
                    {game.accounts
                      .filter((a) => a.uuid !== game.activeAccount?.uuid)
                      .map((acc) => (
                        <AccountListItem
                          key={acc.uuid}
                          account={acc}
                          t={t}
                          onSelect={game.selectAccount}
                          onRemove={game.removeAccount}
                        />
                      ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-border">
                <div className="flex items-center gap-3 px-5 py-4">
                  <UserPlus className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <p className="text-sm font-medium">{t("accountPage.game.add")}</p>
                </div>
                <div className="border-t border-border px-5 py-3 flex gap-3">
                  <button
                    type="button"
                    onClick={handleMicrosoftLogin}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50 cursor-pointer"
                  >
                    <Shield className="h-4 w-4" />
                    {t("accountPage.game.microsoft")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOfflineError("")
                      setOfflineUsername("")
                      setShowOfflineDialog(true)
                    }}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50 cursor-pointer"
                  >
                    <WifiOff className="h-4 w-4" />
                    {t("accountPage.game.offline")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border border-border bg-muted/30 px-8 pt-10 pb-8">
              <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-16 right-0 h-48 w-48 translate-x-1/4 rounded-full bg-[radial-gradient(circle,var(--color-primary)/8%,transparent_60%)]" />
                <div className="absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-[radial-gradient(circle,var(--color-primary)/5%,transparent_70%)] blur-2xl" />
              </div>

              <div className="inline-flex items-center justify-center rounded-2xl bg-muted-foreground/10 p-4 ring-1 ring-border">
                <Gamepad2 className="h-10 w-10 text-muted-foreground" />
              </div>

              <div className="text-center">
                <h2 className="text-lg font-bold tracking-tight">{t("accountPage.game.noAccount")}</h2>
                <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
                  {t("accountPage.game.noAccountDesc")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleMicrosoftLogin}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25 active:scale-[0.98] cursor-pointer"
                >
                  <Shield className="h-4 w-4" />
                  {t("accountPage.game.microsoft")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOfflineError("")
                    setOfflineUsername("")
                    setShowOfflineDialog(true)
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted/50 active:scale-[0.98] cursor-pointer"
                >
                  <WifiOff className="h-4 w-4" />
                  {t("accountPage.game.offline")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Offline Login Dialog */}
      {showOfflineDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => {
              setShowOfflineDialog(false)
              setOfflineUsername("")
              setOfflineError("")
            }}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">{t("accountPage.game.offlineDialog.title")}</h2>
              <button
                type="button"
                onClick={() => {
                  setShowOfflineDialog(false)
                  setOfflineUsername("")
                  setOfflineError("")
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              {t("accountPage.game.offlineDialog.desc")}
            </p>

            <input
              type="text"
              value={offlineUsername}
              onChange={(e) => {
                setOfflineUsername(e.target.value)
                setOfflineError("")
              }}
              onKeyDown={handleOfflineDialogKeyDown}
              placeholder={t("accountPage.game.offlineDialog.placeholder")}
              maxLength={16}
              autoFocus
              className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            {offlineError && (
              <p className="mt-2 text-xs text-red-500">{offlineError}</p>
            )}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowOfflineDialog(false)
                  setOfflineUsername("")
                  setOfflineError("")
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              >
                {t("accountPage.game.offlineDialog.cancel")}
              </button>
              <button
                type="button"
                onClick={handleOfflineLogin}
                className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
              >
                {t("accountPage.game.offlineDialog.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Microsoft Login Dialog */}
      <MicrosoftLoginPopup
        open={showMicrosoftDialog}
        state={msAuth.state}
        onClose={() => {
          setShowMicrosoftDialog(false)
          msAuth.reset()
        }}
        onRetry={() => {
          msAuth.reset()
          msAuth.login()
        }}
      />
    </div>
  )
}

function AccountListItem({
  account,
  t,
  onSelect,
  onRemove,
}: {
  account: GameAccount
  t: (key: string) => string
  onSelect: (account: GameAccount) => void
  onRemove: (account: GameAccount) => void
}) {
  const accountTypeLabel =
    account.type === "Microsoft"
      ? t("accountPage.game.type.microsoft")
      : t("accountPage.game.type.offline")

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 ring-1 ring-border">
        {account.type === "Microsoft" ? (
          <Shield className="h-4 w-4 text-emerald-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{account.username}</p>
        <p className="text-[10px] text-muted-foreground">{accountTypeLabel}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onSelect(account)}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
        >
          {t("account.switch")}
        </button>
        <button
          type="button"
          onClick={() => onRemove(account)}
          className="rounded-md p-1 text-muted-foreground/60 hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}