import { oauth } from './oauth'
import type { CodeMapping } from '../../types'

/**
 * 全部 scope 描述码映射
 */
export const SCOPE_CODES: CodeMapping[] = [
  ...oauth,
]