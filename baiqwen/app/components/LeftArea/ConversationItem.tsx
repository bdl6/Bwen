'use client'
import { memo } from 'react'
import type { Conversation } from '../../types'

interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

// 自定义比较函数
function areEqual(prevProps: ConversationItemProps, nextProps: ConversationItemProps) {
  // 只比较数据，不比较函数
  return prevProps.conversation.id === nextProps.conversation.id &&
         prevProps.conversation.title === nextProps.conversation.title &&
         prevProps.conversation.messages.length === nextProps.conversation.messages.length &&
         prevProps.isActive === nextProps.isActive
}

export const ConversationItem = memo(function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete
}: ConversationItemProps) {
  console.log('渲染对话项:', conversation.title)
  
  return (
    <div
      className={`group relative p-3 mb-2 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <div onClick={() => onSelect(conversation.id)}>
        <div className="text-sm font-medium truncate dark:text-gray-200">
          {conversation.title}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {conversation.messages.length} 条消息
        </div>
      </div>

      {/* 删除按钮 - hover 时显示 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(conversation.id)
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
        title="删除对话"
      >
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}, areEqual)  // 传入自定义比较函数
