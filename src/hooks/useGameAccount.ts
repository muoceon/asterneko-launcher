import { useState, useCallback, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"

export type AccountType = "Offline" | "Microsoft" | "SkinStation"

export interface GameAccount {
  username: string
  uuid: string
  type: AccountType
  /** Skin station / Yggdrasil server URL (only for SkinStation type) */
  serverUrl?: string
  /** Microsoft refresh token (for Microsoft accounts) */
  msRefreshToken?: string
}

const STORAGE_KEY = "asterneko-game-accounts"
const ACTIVE_KEY = "asterneko-active-game-account"

function normalizeAccountType(raw: string): AccountType {
  const lower = raw.toLowerCase()
  if (lower === "microsoft") return "Microsoft"
  if (lower === "skinstation") return "SkinStation"
  return "Offline"
}

function normalizeAccount(account: GameAccount): GameAccount {
  return {
    ...account,
    type: normalizeAccountType(account.type),
  }
}

function loadAccounts(): GameAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GameAccount[]
    let migrated = false
    const normalized = parsed.map((a) => {
      const n = normalizeAccount(a)
      if (n.type !== a.type) migrated = true
      return n
    })
    if (migrated) {
      saveAccounts(normalized)
    }
    return normalized
  } catch {
    return []
  }
}

function saveAccounts(accounts: GameAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
}

function loadActive(): GameAccount | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    return raw ? normalizeAccount(JSON.parse(raw) as GameAccount) : null
  } catch {
    return null
  }
}

function saveActive(account: GameAccount | null) {
  if (account) {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(account))
  } else {
    localStorage.removeItem(ACTIVE_KEY)
  }
}

export interface MicrosoftLoginParams {
  code: string
  redirectUri: string
  codeVerifier: string
}

interface UseGameAccountReturn {
  accounts: GameAccount[]
  activeAccount: GameAccount | null
  loginOffline: (username: string) => Promise<GameAccount>
  loginMicrosoft: (params: MicrosoftLoginParams) => Promise<GameAccount>
  loginSkinStation: (serverUrl: string, email: string, password: string) => Promise<GameAccount>
  selectAccount: (account: GameAccount) => void
  removeAccount: (account: GameAccount) => void
}

export function useGameAccount(): UseGameAccountReturn {
  const [accounts, setAccounts] = useState<GameAccount[]>(loadAccounts)
  const [activeAccount, setActiveAccount] = useState<GameAccount | null>(loadActive)

  const persistAndSet = useCallback((list: GameAccount[]) => {
    setAccounts(list)
    saveAccounts(list)
  }, [])

  const loginOffline = useCallback(async (username: string): Promise<GameAccount> => {
    const account = await invoke<GameAccount>("offline_login", { username })
    const list = loadAccounts()
    const exists = list.find((a) => a.uuid === account.uuid)
    if (!exists) {
      const updated = [...list, account]
      persistAndSet(updated)
    }
    setActiveAccount(account)
    saveActive(account)
    return account
  }, [persistAndSet])

  const loginMicrosoft = useCallback(async (
    params: MicrosoftLoginParams,
  ): Promise<GameAccount> => {
    const account = await invoke<GameAccount>("microsoft_login", {
      code: params.code,
      redirectUri: params.redirectUri,
      codeVerifier: params.codeVerifier,
    })
    const list = loadAccounts()
    const exists = list.find((a) => a.uuid === account.uuid)
    if (!exists) {
      const updated = [...list, account]
      persistAndSet(updated)
    }
    setActiveAccount(account)
    saveActive(account)
    return account
  }, [persistAndSet])

  const loginSkinStation = useCallback(async (
    serverUrl: string,
    email: string,
    password: string,
  ): Promise<GameAccount> => {
    const account = await invoke<GameAccount>("skin_station_login", {
      serverUrl,
      email,
      password,
    })
    const list = loadAccounts()
    const exists = list.find((a) => a.uuid === account.uuid)
    if (!exists) {
      const updated = [...list, { ...account, serverUrl, type: "SkinStation" as AccountType }]
      persistAndSet(updated)
    }
    setActiveAccount(account)
    saveActive(account)
    return account
  }, [persistAndSet])

  const selectAccount = useCallback((account: GameAccount) => {
    setActiveAccount(account)
    saveActive(account)
  }, [])

  const removeAccount = useCallback(
    (account: GameAccount) => {
      const updated = accounts.filter((a) => a.uuid !== account.uuid)
      persistAndSet(updated)
      if (activeAccount?.uuid === account.uuid) {
        setActiveAccount(null)
        saveActive(null)
      }
    },
    [accounts, activeAccount, persistAndSet],
  )

  useEffect(() => {
    const stored = loadActive()
    if (stored) {
      const stillExists = loadAccounts().some((a) => a.uuid === stored.uuid)
      if (stillExists) {
        setActiveAccount(stored)
      } else {
        setActiveAccount(null)
        saveActive(null)
      }
    }
  }, [])

  return {
    accounts,
    activeAccount,
    loginOffline,
    loginMicrosoft,
    loginSkinStation,
    selectAccount,
    removeAccount,
  }
}