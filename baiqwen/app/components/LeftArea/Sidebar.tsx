import type { Conversation } from '../../types'
import { AuthButton } from './AuthButton'
import { ConversationItem } from './ConversationItem'
import { ConversationSkeleton } from './ConversationSkeleton'

interface SidebarProps {
  conversations: Conversation[]
  currentConvId: string | null
  onSelectConversation: (id: string) => void
  onCreateNewChat: () => void
  onDeleteConversation: (id: string) => void
  isLoadingSkeleton?: boolean  // 骨架屏加载状态
}

/**
 * 左侧边栏组件
 * 包含：标题、新建对话按钮、对话列表
 */
export function Sidebar({
  conversations,
  currentConvId,
  onSelectConversation,
  onCreateNewChat,
  onDeleteConversation,
  isLoadingSkeleton 
}: SidebarProps) {
  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r dark:border-gray-700 flex flex-col">
      {/* 标题和登录按钮 */}
      <div className="p-4 flex items-center justify-around border-b dark:border-gray-700">
        <h1 className="text-3xl font-bold dark:text-white">百问</h1>
        <AuthButton />
      </div>

      {/* 新建对话按钮 */}
      <div className="p-2 border-b">
        <button
          onClick={onCreateNewChat}
          className="w-full p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + 新建对话
        </button>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs text-gray-500 dark:text-gray-400 mb-2">最近对话</h3>
        
        {/* 加载状态：显示骨架屏 */}
        {isLoadingSkeleton ? (
          <ConversationSkeleton />
        ) : (
          /* 正常状态：显示对话列表 */
          conversations.map(conv => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={currentConvId === conv.id}
              onSelect={onSelectConversation}
              onDelete={onDeleteConversation}
            />
          ))
        )}
      </div>
    </div>
  )
}
