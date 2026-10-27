import { OAuthClient } from "@muoceon/oauth-client"
import type { OAuthStorage, OAuthCrypto } from "@muoceon/oauth-client"
import { createStorage } from "@muoceon/storage"
import { createWebStorageAdapter } from "@muoceon/storage/adapters/web-storage"
import { invoke } from "@tauri-apps/api/core"

const provider = {
  authorizeUrl: "https://auth.muoceon.com/authorize",
  tokenUrl: "https://api.muoceon.com/v1/oauth/token",
  userinfoUrl: "https://api.muoceon.com/v1/auth/userinfo",
  revocationUrl: "https://api.muoceon.com/v1/oauth/revoke",
  clientId: "asterneko-launcher",
} as const

export async function getBridgeRedirectUri(): Promise<string> {
  const port = await invoke<number>("get_bridge_port")
  return `http://127.0.0.1:${port}/bridge`
}

const storage = createStorage({
  adapter: createWebStorageAdapter(localStorage),
  namespace: "asterneko:oauth",
})

const oauthStorageAdapter: OAuthStorage = {
  get: (key) => storage.getString(key),
  set: (key, value) => storage.setString(key, value),
  remove: (key) => storage.remove(key),
}

const webCryptoAdapter: OAuthCrypto = {
  getRandomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
  sha256: async (data) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", data as BufferSource)),
}

export const oauthClient = new OAuthClient({
  provider,
  storage: oauthStorageAdapter,
  crypto: webCryptoAdapter,
  fetch: (url, init) => window.fetch(url, init),
  defaultScope: "openid profile email offline_access",
  defaultRedirectUri: "http://127.0.0.1:18923/bridge",
  sessionKey: "asterneko_oauth",
})