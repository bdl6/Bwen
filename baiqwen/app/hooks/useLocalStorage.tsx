import { useState, useEffect } from 'react'

/**
 * 自定义 Hook：localStorage 持久化
 * @param key - localStorage 的 key
 * @param initialValue - 初始值
 * @returns [storedValue, setStoredValue] - 类似 useState
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    // 先检查是否有 window，避免在服务端出错
    if (typeof window === 'undefined') {
      return initialValue
    }

    try {
      // 从 localStorage 获取数据
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(`获取 ${key} 失败`, error)
      return initialValue
    }
  })

  // 当 storedValue 变化时，保存到 localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue))
    } catch (error) {
      console.error(`保存 ${key} 失败`, error)
    }
  }, [key, storedValue])

  return [storedValue, setStoredValue] as const
}
