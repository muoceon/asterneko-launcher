# Code Mapper — 通用代码映射模块

## 概述

`CodeMapper` 是一个通用、类别无关的 **code → i18n key** 注册/解析器。它将机器可读代码（错误码、scope、状态等）翻译为 `react-i18next` 的翻译键，用于向用户展示可读信息。

## 设计理念

传统做法是在 `lib/` 下放一个大字典做错误码映射，仅限 error。CodeMapper 将其提升为**通用翻译基础设施**：

- **类别无关**：error code、scope code、status code 统一用同一套机制
- **可组合**：不同的 code 集合通过 `.register()` 链式组合
- **单例 + 工厂**：默认用单例 `codeMapper`，测试时可以 `createCodeMapper()` 独立实例
- **与 Server 端一致的工厂模式**：遵循模板的整体设计风格

## 目录结构

```
code-mapper/
  types.ts          # CodeMapping、CodeLookup 类型
  code-mapper.ts    # CodeMapper 类（核心）
  factory.ts        # createCodeMapper() 工厂 + codeMapper 单例
  codes/
    error.ts        # 错误码映射
    scope.ts        # OAuth scope 描述映射
    index.ts        # 桶导出
  index.ts          # 模块统一导出
  docs/             # 文档
```

## 使用方法

### 基础用法（单例）

```ts
import { codeMapper } from '@/shared/code-mapper'

// 解析 API 错误对象
const key = codeMapper.resolve({ code: 'AUTH_USER_EXISTS' })
// => 'error.idExists'

// 直接解析原始 code 字符串
const scopeKey = codeMapper.resolveCode('openid')
// => 'scope.openid'

// 未注册的 code 回退到 message 或 null
codeMapper.resolve({ code: 'UNKNOWN', message: 'Something broke' })
// => 'Something broke'
```

### 注册自定义代码集

```ts
import { createCodeMapper } from '@/shared/code-mapper'
import type { CodeMapping } from '@/shared/code-mapper'

const MY_STATUS_CODES: CodeMapping[] = [
  { code: 'draft', key: 'status.draft' },
  { code: 'published', key: 'status.published' },
]

const myMapper = createCodeMapper()
  .register(MY_STATUS_CODES)
```

## 解析优先级

1. 在注册表中精确匹配 `lookup.code` → 返回映射的 `key`
2. 无匹配时回退到 `lookup.message` 原始文本
3. 都无匹配时返回 `null`

## API

| 方法 | 说明 |
|------|------|
| `register(codes)` | 注册一批 `CodeMapping[]`，链式调用 |
| `resolve(lookup)` | 从 `{ code?, message? }` 对象解析 i18n key |
| `resolveCode(code)` | 直接按字符串查找 |
| `has(code)` | 检查 code 是否已注册 |
| `size` | 已注册映射总数 |