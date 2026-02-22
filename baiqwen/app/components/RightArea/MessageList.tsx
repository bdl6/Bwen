import { RefObject, useEffect, useRef, useState } from 'react'
import { MessageItem } from './MessageItem'
import { MessageSkeleton } from './MessageSkeleton'
import type { Message } from '@/app/types/index'

interface MessageListProps {
  messages: Message[]
  messageEndRef: RefObject<HTMLDivElement | null>
  conversationId: string | null
  hasMoreMessages?: boolean
  onLoadMore: (convId: string) => void
  isLoadingSkeleton?: boolean  // 骨架屏加载状态
}

/**
 * 消息列表组件
 * 支持无限滚动：向上滚动到顶部时自动加载更多历史消息
 */
export function MessageList({
  messages,
  messageEndRef,
  conversationId,
  hasMoreMessages = true,
  onLoadMore,
  isLoadingSkeleton   
}: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)  // 无限滚动的加载状态
  const previousScrollHeight = useRef(0)

  // 监听滚动事件
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = async () => {
      // 如果正在加载，或者没有更多消息，或者没有对话 ID，直接返回
      if (isLoading || !hasMoreMessages || !conversationId) return

      // 检测是否滚动到顶部（距离顶部小于 100px）
      if (container.scrollTop < 100) {
        console.log('🔄 触发加载更多，当前消息数:', messages.length)
        setIsLoading(true)

        // 记录当前滚动高度
        previousScrollHeight.current = container.scrollHeight

        // 加载更多消息
        await onLoadMore(conversationId)

        // 加载完成后，恢复滚动位置
        // 新消息插入到顶部，需要调整 scrollTop 保持视觉位置不变
        requestAnimationFrame(() => {
          const newScrollHeight = container.scrollHeight
          const heightDiff = newScrollHeight - previousScrollHeight.current
          container.scrollTop = container.scrollTop + heightDiff
          setIsLoading(false)
          console.log('✅ 加载完成，调整滚动位置')
        })
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [isLoading, hasMoreMessages, conversationId, onLoadMore, messages.length])

  // 如果是初始加载，显示骨架屏（必须在所有 Hooks 之后）
  if (isLoadingSkeleton) {
    return <MessageSkeleton />
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-400 dark:text-gray-500">开始新的对话吧！</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6">
      {/* 加载更多提示 */}
      {hasMoreMessages && (
        <div className="text-center py-2 text-sm text-gray-400">
          {isLoading ? '加载中...' : '向上滚动加载更多'}
        </div>
      )}

      {/* 消息列表 */}
      {messages.map((msg, index) => (
        <MessageItem
          key={index}
          message={msg}
          index={index}
        />
      ))}

      {/* 滚动锚点 */}
      <div ref={messageEndRef} />
    </div>
  )
}
