export { cn } from './utils'

// ─── 从 @muoceon/http-core 重新导出 HTTP 客户端 ───
export { HttpClient } from '@muoceon/http-core'
export type { HttpClientConfig, RequestOptions, RawRequestOptions } from '@muoceon/http-core'

// 适配器
export type { HttpAdapter } from '@muoceon/http-core'
export { fetchAdapter, xhrAdapter, rnAdapter } from '@muoceon/http-core'

// 拦截器
export { InterceptorManager } from '@muoceon/http-core'
export type {
  RequestInterceptor,
  ResponseInterceptor,
  ErrorInterceptor,
} from '@muoceon/http-core'

// 类型
export type {
  FetchInit,
  FetchResponse,
  Credentials,
  HttpMethod,
  FetchBody,
  FetchResponseType,
  ProgressEvent,
  ProgressCallback,
} from '@muoceon/http-core'

// 错误
export type { HttpError } from '@muoceon/http-core'
export {
  NETWORK_ERROR,
  TIMEOUT_ERROR,
  PARSE_ERROR,
  buildHttpError,
  withConfig,
} from '@muoceon/http-core'

// 工具函数
export { buildUrl, serializeParams, mergeHeaders, isAbortError } from '@muoceon/http-core'