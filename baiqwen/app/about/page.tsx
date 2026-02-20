'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
export default function About() {
  const searchParams = useSearchParams()  
  const darkMode = searchParams.get('darkMode') === 'true'  // 转换为布尔值

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-white dark:bg-gray-900 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-4 dark:text-white">
            关于百问
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            这是一个基于通义千问的 AI 对话应用，仅供娱乐。
          </p>
          <Link
            href="/"
            className="text-blue-500 hover:underline"
          >
            返回聊天
          </Link>
        </div>
      </div>
    </div>

  )
}