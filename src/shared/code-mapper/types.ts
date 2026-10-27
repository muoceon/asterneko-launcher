/**
 * 代码到键的映射条目
 *
 * 将任意机器可读代码（错误码、scope、状态等）映射到对应的 i18n 翻译键。
 * 由 `CodeMapper` 用于解析用户可读字符串。
 *
 * @example
 * ```ts
 * // 错误码映射
 * { code: 'AUTH_USER_EXISTS', key: 'error.idExists' }
 *
 * // Scope 描述映射
 * { code: 'openid', key: 'scope.openid' }
 *
 * // 状态标签映射
 * { code: 'active', key: 'status.active' }
 * ```
 */
export interface CodeMapping {
  /** 源代码 — 机器可读标识符 */
  code: string

  /** 目标 i18n 翻译键 */
  key: string
}

/**
 * API 错误 / 查找对象的形状
 *
 * 传给 `CodeMapper.resolve()` 的对象的最小接口。
 * 只消费 `code` 和 `message` 字段。
 */
export interface CodeLookup {
  /** 机器可读代码 */
  code?: string
  /** 回退用的人类可读消息 */
  message?: string
}