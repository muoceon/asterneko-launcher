import type { CodeMapping } from '../../types'

/**
 * ─── 示例：认证 / 凭证错误码映射 ───
 *
 * 这里的 code→key 均为示例，业务项目请替换为自己的错误码。
 */
export const auth: CodeMapping[] = [
  { code: 'AUTH_USER_EXISTS', key: 'error.idExists' },
  { code: 'USER_EXISTS', key: 'error.idExists' },
  { code: 'AUTH_INVALID_CREDENTIALS', key: 'error.invalidCredentials' },
  { code: 'INVALID_CREDENTIALS', key: 'error.invalidCredentials' },
  { code: 'UNAUTHORIZED', key: 'error.invalidCredentials' },
  { code: 'AUTH_TOKEN_REVOKED', key: 'error.generic' },
  { code: 'AUTH_LOGIN_TOKEN_EXPIRED', key: 'error.generic' },
  { code: 'AUTH_LOGIN_TOKEN_NOT_FOUND', key: 'error.generic' },
  { code: 'AUTH_VERIFICATION_MISMATCH', key: 'verify.invalidCode' },
]