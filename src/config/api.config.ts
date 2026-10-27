/**
 * ─── 示例：API 配置模板 ───
 *
 * 集中管理 API 基础 URL 和端点路径。
 *
 * 业务项目请：
 * 1. 修改 API_BASE 为自己的后端地址
 * 2. 按需修改/扩展 ENDPOINTS 对象
 */

/**
 * API 基础 URL
 *
 * 优先使用环境变量 VITE_API_BASE，否则使用默认值。
 * 业务项目请替换为你的实际 API 地址。
 */
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://api.example.com'

/**
 * ─── 示例：API 端点映射 ───
 *
 * 按业务域分组。以下为认证场景示例，业务项目请替换。
 */
export const ENDPOINTS = {
  /** 认证 */
  auth: {
    login: '/v1/auth/login',
    register: '/v1/auth/register',
    verifyEmail: '/v1/auth/verify/email',
  },
} as const