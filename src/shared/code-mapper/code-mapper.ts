import type { CodeLookup, CodeMapping } from './types'

/**
 * 通用代码 → 键解析器
 *
 * 基于注册表的映射器，将机器可读代码翻译为 i18n 翻译键。
 * 设计为类别无关 — 可以处理错误码、scope 标签、状态标签或任何
 * 其他 code→key 映射领域。
 *
 * @example
 * ```ts
 * const mapper = new CodeMapper()
 *   .register(ERROR_CODES)
 *   .register(SCOPE_CODES)
 *   .register(STATUS_CODES)
 *
 * mapper.resolve({ code: 'AUTH_USER_EXISTS' }) // => 'error.idExists'
 * mapper.resolve({ code: 'openid' })           // => 'scope.openid'
 * ```
 */
export class CodeMapper {
  /** 内部注册表: code → key */
  private readonly registry = new Map<string, string>()

  /**
   * 注册一批 code→key 映射
   *
   * 相同 `code` 的后续注册会覆盖之前的。返回 `this` 支持链式调用。
   *
   * @param mappings - 要注册的映射数组
   * @returns 当前 CodeMapper 实例，用于链式调用
   */
  register(mappings: CodeMapping[]): this {
    for (const { code, key } of mappings) {
      this.registry.set(code, key)
    }
    return this
  }

  /**
   * 将代码查找解析为其翻译键
   *
   * 解析优先级：
   * 1. 在注册表中匹配 `lookup.code` → 返回映射的 key
   * 2. 如果存在 `lookup.message`，回退到它
   * 3. 如果无法解析任何内容，返回 `null`
   *
   * @param lookup - 带有可选 `code` 和 `message` 的对象
   * @returns 映射的 key、原始 message 或 null
   */
  resolve(lookup: unknown): string | null {
    const source = lookup as CodeLookup | undefined
    if (!source) return null

    const code = source.code
    if (code) {
      const key = this.registry.get(code)
      if (key) return key
    }

    return source.message ?? null
  }

  /**
   * 直接解析原始代码字符串（无需 `{ code, message }` 包装）
   *
   * @param code - 要查找的原始代码字符串
   * @returns 映射的 key，未找到则返回 null
   */
  resolveCode(code: string): string | null {
    return this.registry.get(code) ?? null
  }

  /**
   * 检查代码是否已注册
   *
   * @param code - 要检查的代码
   * @returns 代码是否存在于注册表中
   */
  has(code: string): boolean {
    return this.registry.has(code)
  }

  /**
   * 获取已注册映射的总数
   *
   * @returns 已注册的 code→key 对数
   */
  get size(): number {
    return this.registry.size
  }
}