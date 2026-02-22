'use client'

import { useState } from 'react'
// 动态导入，减少初始加载时间
import dynamic from 'next/dynamic'
// 主题样式直接导入（不能用 dynamic，因为它不是组件）
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

// 懒加载语法高亮组件
const SyntaxHighlighter = dynamic(
  () => import('react-syntax-highlighter').then(mod => mod.Prism),
  { ssr: false }
)

interface CodeBlockProps {
  language: string
  value: string
}

export function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  // 复制代码
  const copyCode = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)  // 2秒后恢复
  }

  return (
    <div className="relative group">
      {/* 复制按钮 */}
      <button
        onClick={copyCode}
        className="absolute right-2 top-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? '已复制!' : '复制'}
      </button>

      {/* 代码高亮 */}
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: '0.5rem',
          padding: '1rem'
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  )
}
