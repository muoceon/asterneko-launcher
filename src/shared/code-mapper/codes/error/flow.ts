import type { CodeMapping } from '../../types'

/**
 * ─── 示例：流程 / 限流错误码映射 ───
 *
 * 这里的 code→key 均为示例，业务项目请替换为自己的错误码。
 */
export const flow: CodeMapping[] = [
  { code: 'AUTH_FLOW_EXPIRED', key: 'error.flowExpired' },
  { code: 'FLOW_EXPIRED', key: 'error.flowExpired' },
  { code: 'AUTH_FLOW_LIMIT_EXCEEDED', key: 'error.tooManyRequests' },
  { code: 'AUTH_FLOW_GLOBAL_LIMIT', key: 'error.tooManyRequests' },
  { code: 'AUTH_INVALID_FLOW_STEP', key: 'error.generic' },
  { code: 'AUTH_TOO_MANY_REQUESTS', key: 'error.tooManyRequests' },
]