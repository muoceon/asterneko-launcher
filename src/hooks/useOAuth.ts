import { useState, useEffect, useCallback, useRef } from "react"
import { openUrl } from "@tauri-apps/plugin-opener"
import { listen } from "@tauri-apps/api/event"
import type { UnlistenFn } from "@tauri-apps/api/event"
import type { UserInfo, TokenResponse } from "@muoceon/oauth-client"
import { createStorage } from "@muoceon/storage"
import { createWebStorageAdapter } from "@muoceon/storage/adapters/web-storage"
import { oauthClient, getBridgeRedirectUri } from "@/config/oauth.config"

type AuthState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "authenticated"; user: UserInfo; tokens: TokenResponse }
  | { status: "error"; message: string }

const tokenStorage = createStorage({
  adapter: createWebStorageAdapter(localStorage),
  namespace: "asterneko:auth",
})

const TOKENS_KEY = "tokens"

async function persistTokens(tokens: TokenResponse) {
  await tokenStorage.setJSON(TOKENS_KEY, tokens)
}

async function loadTokens(): Promise<TokenResponse | null> {
  return tokenStorage.getJSON<TokenResponse>(TOKENS_KEY)
}

async function clearTokens() {
  await tokenStorage.remove(TOKENS_KEY)
}

interface BridgePayload {
  code: string | null
  state: string | null
  error: string | null
  error_description: string | null
}

export function useOAuth() {
  const [state, setState] = useState<AuthState>({ status: "idle" })
  const unlistenRef = useRef<UnlistenFn | null>(null)

  useEffect(() => {
    restoreSession()
    return () => {
      unlistenRef.current?.()
    }
  }, [])

  async function restoreSession() {
    try {
      const tokens = await loadTokens()
      if (!tokens?.access_token) return

      if (oauthClient.isTokenExpired(tokens.access_token)) {
        if (tokens.refresh_token) {
          const newTokens = await oauthClient.refreshToken(tokens.refresh_token)
          await persistTokens(newTokens)
          const user = await oauthClient.getUserInfo(newTokens.access_token)
          setState({ status: "authenticated", user, tokens: newTokens })
          return
        }
        await clearTokens()
        return
      }

      const user = await oauthClient.getUserInfo(tokens.access_token)
      setState({ status: "authenticated", user, tokens })
    } catch {
      await clearTokens()
      setState({ status: "idle" })
    }
  }

  const login = useCallback(async () => {
    try {
      setState({ status: "loading" })

      const redirectUri = await getBridgeRedirectUri()

      const authPromise = new Promise<{ code: string; state: string }>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            unlistenRef.current?.()
            reject(new Error("授权超时，请重试"))
          }, 120_000)

          listen<BridgePayload>("bridge-payload", (event) => {
            const { code, state: stateParam, error, error_description } =
              event.payload

            if (error) {
              clearTimeout(timeout)
              reject(
                new Error(
                  `授权被拒绝: ${error_description ?? error}`,
                ),
              )
              return
            }

            if (!code || !stateParam) return

            clearTimeout(timeout)
            resolve({ code, state: stateParam })
          }).then((fn) => {
            unlistenRef.current = fn
          })
        },
      )

      const authResult = await oauthClient.startAuthorization({
        redirectUri,
      })
      console.log("[OAuth] 授权 URL:", authResult.url)

      await openUrl(authResult.url)
      console.log("[OAuth] 浏览器已打开，等待 bridge 回调...")

      const { code, state: oauthState } = await authPromise
      console.log("[OAuth] 收到回调 code:", code.slice(0, 8) + "...")

      const tokens = await oauthClient.handleCallback({
        code,
        state: oauthState,
        redirectUri,
      })
      console.log("[OAuth] Token 交换成功")

      const user = await oauthClient.getUserInfo(tokens.access_token)

      await persistTokens(tokens)
      await oauthClient.clearSession()

      setState({ status: "authenticated", user, tokens })
    } catch (err) {
      const message = err instanceof Error ? err.message : "登录失败"
      console.error("[OAuth] 登录失败:", message)
      setState({ status: "error", message })
      unlistenRef.current?.()
      await oauthClient.clearSession()
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      if (state.status === "authenticated") {
        const tokens = state.tokens
        if (tokens.access_token) {
          await oauthClient
            .revokeToken(tokens.access_token, "access_token")
            .catch(() => {})
        }
        if (tokens.refresh_token) {
          await oauthClient
            .revokeToken(tokens.refresh_token, "refresh_token")
            .catch(() => {})
        }
      }
    } catch {
      // revoke 失败不影响本地登出
    }
    await clearTokens()
    setState({ status: "idle" })
  }, [state])

  const clearError = useCallback(() => {
    if (state.status === "error") {
      setState({ status: "idle" })
    }
  }, [state])

  return {
    state,
    login,
    logout,
    clearError,
  }
}