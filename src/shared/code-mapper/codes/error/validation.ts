import type { CodeMapping } from '../../types'

/**
 * ─── 示例：验证错误码映射 ───
 *
 * 这里的 code→key 均为示例，业务项目请替换为自己的错误码。
 */
export const validation: CodeMapping[] = [
  { code: 'VALIDATION_ERROR', key: 'error.generic' },
  { code: 'VALIDATION_FAILED', key: 'error.validationFailed' },
  { code: 'EMAIL_EXISTS', key: 'error.emailExists' },
  { code: 'CONFLICT', key: 'error.idExists' },
]