import { RefObject } from 'react'
import { Header } from './Header'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import type { Message } from '@/app/types/index'

interface ChatAreaProps {
  darkMode: boolean
  onToggleDarkMode: () => void
  messages: Message[]
  messageEndRef: RefObject<HTMLDivElement | null>
  input: string
  onInputChange: (value: string) => void
  isLoadingMessage: boolean
  onSendMessage: () => void
  onStopGeneration: () => void
  // 无限滚动相关
  conversationId: string | null
  hasMoreMessages?: boolean
  onLoadMore: (convId: string) => void
  isLoadingSkeleton?: boolean  // 骨架屏加载状态
}

/**
 * 右侧聊天区域组件
 * 包含：顶部导航、消息列表、输入框
 */
export function ChatArea({
  darkMode,
  onToggleDarkMode,
  messages,
  messageEndRef,
  input,
  onInputChange,
  isLoadingMessage,
  onSendMessage,
  onStopGeneration,
  conversationId,
  hasMoreMessages,
  onLoadMore,
  isLoadingSkeleton  // 默认值
}: ChatAreaProps) {
  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
      <Header darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} />
      
      <MessageList 
        messages={messages} 
        messageEndRef={messageEndRef}
        conversationId={conversationId}
        hasMoreMessages={hasMoreMessages}
        onLoadMore={onLoadMore}
        isLoadingSkeleton={isLoadingSkeleton}  // 传递给 MessageList
      />
      
      <InputArea
        input={input}
        onInputChange={onInputChange}
        isLoadingMessage={isLoadingMessage}
        onSendMessage={onSendMessage}
        onStopGeneration={onStopGeneration}
      />
    </div>
  )
}
