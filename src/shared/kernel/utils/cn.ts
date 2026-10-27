import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 Tailwind CSS 类名
 *
 * 结合 clsx（条件类名）与 tailwind-merge（冲突去重），
 * 确保传入的类名组合始终正确且无冗余。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}