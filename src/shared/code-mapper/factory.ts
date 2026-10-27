import { CodeMapper } from './code-mapper'
import { ERROR_CODES, SCOPE_CODES } from './codes'

/**
 * 创建预配置的 CodeMapper，包含所有内置代码集
 *
 * 注册错误码和 scope 码。可通过返回实例的 `.register()` 方法注册更多代码集。
 *
 * @returns 完整配置的 CodeMapper 实例
 *
 * @example
 * ```ts
 * import { createCodeMapper } from '@/shared/code-mapper'
 *
 * const mapper = createCodeMapper()
 * mapper.register(myCustomCodes)
 * export { mapper }
 * ```
 */
export function createCodeMapper(): CodeMapper {
  return new CodeMapper()
    .register(ERROR_CODES)
    .register(SCOPE_CODES)
}

/**
 * 单例代码映射器实例
 *
 * 预配置了所有内置代码集（error、scope）。大多数场景直接导入使用。
 *
 * @example
 * ```ts
 * import { codeMapper } from '@/shared/code-mapper'
 *
 * // 从 API 错误对象解析
 * const key = codeMapper.resolve(caughtError)
 *
 * // 从原始代码字符串解析
 * const scopeKey = codeMapper.resolveCode('openid')
 * ```
 */
export const codeMapper = createCodeMapper()