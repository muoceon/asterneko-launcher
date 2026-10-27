import { auth } from './auth'
import { flow } from './flow'
import { validation } from './validation'
import { general } from './general'
import type { CodeMapping } from '../../types'

/**
 * 全部错误码映射（示例）
 *
 * 合并认证、验证、流程、通用四个子类别的错误码。
 * ─── 业务项目请替换为自己的错误码 ───
 */
export const ERROR_CODES: CodeMapping[] = [
  ...auth,
  ...validation,
  ...flow,
  ...general,
]