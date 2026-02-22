'use client'
import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import { CodeBlock } from './CodeBlock'
import type { Message } from '@/app/types/index'

interface MessageItemProps {
  message: Message
  index: number
}

/**
 * 单个消息组件
 * 使用 React.memo 优化，避免不必要的重新渲染
 */
function MessageItemComponent({ message, index }: MessageItemProps) {
  return (
    <div
      className={`flex mb-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[70%] p-4 rounded-lg ${
          message.role === 'user'
            ? 'bg-blue-500 text-white prose-invert'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 dark:prose-invert'
        } prose`}
      >
        <ReactMarkdown
          components={{
            code(props: any) {
              const { node, inline, className, children, ...rest } = props
              const match = /language-(\w+)/.exec(className || '')
              const language = match ? match[1] : ''

              if (inline) {
                return <code className={className} {...rest}>{children}</code>
              }

              return (
                <CodeBlock
                  language={language}
                  value={String(children).replace(/\n$/, '')}
                />
              )
            },
            p({ children }) {
              const hasCodeBlock = (children as any)?.type?.name === 'code'
              if (hasCodeBlock) {
                return <div>{children}</div>
              }
              return <p>{children}</p>
            }
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

/**
 * 自定义比较函数
 * 只有消息内容变化时才重新渲染
 */
function areEqual(prevProps: MessageItemProps, nextProps: MessageItemProps) {
  // 比较消息内容和角色
  return prevProps.message.content === nextProps.message.content &&
         prevProps.message.role === nextProps.message.role
}

// 导出 memo 包装后的组件
export const MessageItem = memo(MessageItemComponent, areEqual)
