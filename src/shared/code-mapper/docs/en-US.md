# Code Mapper — Universal Code-to-Key Mapping Module

## Overview

`CodeMapper` is a category-agnostic **code → i18n key** registry/resolver. It translates machine-readable codes (error codes, scopes, statuses, etc.) into `react-i18next` translation keys for user-facing display.

## Design Philosophy

Instead of a flat dictionary in `lib/` that only handles errors, CodeMapper elevates this into a **universal translation infrastructure**:

- **Category-agnostic**: Error codes, scope codes, status codes — all share the same mechanism
- **Composable**: Different code sets combine via chainable `.register()` calls
- **Singleton + Factory**: Default singleton `codeMapper` for convenience, `createCodeMapper()` for isolated instances in tests
- **Consistent with Server template**: Follows the same factory pattern used in the server-side template

## Directory Structure

```
code-mapper/
  types.ts          # CodeMapping, CodeLookup types
  code-mapper.ts    # CodeMapper class (core)
  factory.ts        # createCodeMapper() factory + codeMapper singleton
  codes/
    error.ts        # Error code mappings
    scope.ts        # OAuth scope description mappings
    index.ts        # Barrel export
  index.ts          # Module unified export
  docs/             # Documentation
```

## Usage

### Basic usage (singleton)

```ts
import { codeMapper } from '@/shared/code-mapper'

// Resolve an API error object
const key = codeMapper.resolve({ code: 'AUTH_USER_EXISTS' })
// => 'error.idExists'

// Direct raw code lookup
const scopeKey = codeMapper.resolveCode('openid')
// => 'scope.openid'

// Unregistered codes fall back to message or null
codeMapper.resolve({ code: 'UNKNOWN', message: 'Something broke' })
// => 'Something broke'
```

### Register custom code sets

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

## Resolution Priority

1. Exact match of `lookup.code` in registry → returns mapped `key`
2. No match → falls back to raw `lookup.message`
3. Neither available → returns `null`

## API

| Method | Description |
|--------|-------------|
| `register(codes)` | Register a batch of `CodeMapping[]`, chainable |
| `resolve(lookup)` | Resolve i18n key from `{ code?, message? }` object |
| `resolveCode(code)` | Direct string-based lookup |
| `has(code)` | Check if a code is registered |
| `size` | Total number of registered mappings |