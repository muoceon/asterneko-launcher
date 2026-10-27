import type { CodeMapping } from '../../types'

/**
 * OAuth scope 描述码映射
 */
export const oauth: CodeMapping[] = [
  { code: 'openid', key: 'scope.openid' },
  { code: 'profile', key: 'scope.profile' },
  { code: 'email', key: 'scope.email' },
  { code: 'offline_access', key: 'scope.offline_access' },
]