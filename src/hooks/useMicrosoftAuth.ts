import { useState, useCallback, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { openUrl } from "@tauri-apps/plugin-opener"
import { listen } from "@tauri-apps/api/event"
import type { UnlistenFn } from "@tauri-apps/api/event"
import { useGameAccount } from "@/hooks/useGameAccount"
import type { GameAccount } from "@/hooks/useGameAccount"

const MS_AUTHORIZE_URL =
  "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize"
const MS_CLIENT_ID = "0301aef4-2b8e-4817-9cb9-7925b881a3b8"
const MS_SCOPE = "XboxLive.signin offline_access"

export type MicrosoftLoginStep =
  | "opening_browser"
  | "waiting_user"
  | "exchanging_tokens"
  | "fetching_profile"

export type MicrosoftAuthState =
  | { status: "idle" }
  | { status: "loading"; step: MicrosoftLoginStep }
  | { status: "authenticated"; account: GameAccount }
  | { status: "error"; message: string }

interface BridgePayload {
  code: string | null
  state: string | null
  error: string | null
  error_description: string | null
}

function generateCodeVerifier(): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  const array = new Uint8Array(64)
  crypto.getRandomValues(array)
  let result = ""
  for (let i = 0; i < 64; i++) {
    result += charset[array[i] % charset.length]
  }
  return result
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

function generateState(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function useMicrosoftAuth() {
  const game = useGameAccount()
  const [state, setState] = useState<MicrosoftAuthState>({ status: "idle" })
  const unlistenRef = useRef<UnlistenFn | null>(null)
  const expectedStateRef = useRef<string | null>(null)

  const login = useCallback(async () => {
    try {
      setState({ status: "loading", step: "opening_browser" })

      const port = await invoke<number>("get_bridge_port")
      const redirectUri = `http://localhost:${port}/bridge`

      const codeVerifier = generateCodeVerifier()
      const codeChallenge = await generateCodeChallenge(codeVerifier)
      const msState = generateState()
      expectedStateRef.current = msState

      const authUrl = new URL(MS_AUTHORIZE_URL)
      authUrl.searchParams.set("client_id", MS_CLIENT_ID)
      authUrl.searchParams.set("response_type", "code")
      authUrl.searchParams.set("scope", MS_SCOPE)
      authUrl.searchParams.set("redirect_uri", redirectUri)
      authUrl.searchParams.set("code_challenge", codeChallenge)
      authUrl.searchParams.set("code_challenge_method", "S256")
      authUrl.searchParams.set("state", msState)

      console.log("[MicrosoftAuth] 授权 URL:", authUrl.toString())

      const authPromise = new Promise<{ code: string }>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            unlistenRef.current?.()
            reject(new Error("授权超时，请重试"))
          }, 120_000)

          listen<BridgePayload>("bridge-payload", (event) => {
            const {
              code,
              state: stateParam,
              error,
              error_description,
            } = event.payload

            if (error) {
              clearTimeout(timeout)
              reject(
                new Error(
                  `授权被拒绝: ${error_description ?? error}`,
                ),
              )
              return
            }

            if (!code) return

            if (stateParam && stateParam !== expectedStateRef.current) {
              clearTimeout(timeout)
              reject(new Error("安全验证失败：state 不匹配"))
              return
            }

            clearTimeout(timeout)
            resolve({ code })
          }).then((fn) => {
            unlistenRef.current = fn
          })
        },
      )

      await openUrl(authUrl.toString())
      console.log("[MicrosoftAuth] 浏览器已打开")
      setState({ status: "loading", step: "waiting_user" })

      const { code } = await authPromise
      console.log("[MicrosoftAuth] 收到回调 code:", code.slice(0, 8) + "...")

      setState({ status: "loading", step: "exchanging_tokens" })

      const account = await game.loginMicrosoft({
        code,
        redirectUri,
        codeVerifier,
      })

      console.log("[MicrosoftAuth] 登录成功:", account.username)
      setState({ status: "authenticated", account })
    } catch (err) {
      let message = "登录失败"
      if (err instanceof Error) {
        message = err.message
      } else if (typeof err === "string") {
        message = err
      } else if (err && typeof err === "object") {
        message = String((err as Record<string, unknown>).message ?? err)
      }
      console.error("[MicrosoftAuth] 登录失败 (完整错误):", err)
      console.error("[MicrosoftAuth] 提取的消息:", message)
      setState({ status: "error", message })
      unlistenRef.current?.()
    }
  }, [game])

  const clearError = useCallback(() => {
    if (state.status === "error") {
      setState({ status: "idle" })
    }
  }, [state])

  const reset = useCallback(() => {
    setState({ status: "idle" })
    unlistenRef.current?.()
  }, [])

  return {
    state,
    login,
    clearError,
    reset,
  }
}