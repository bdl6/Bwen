'use client'  // 第一行！

import { useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}
interface Conversation {
  id: string
  title: string
  messages: Message[]
  updatedAt: Date
}

export default function Home() {

  const [darkMode, setDarkMode] = useState(false)
  //页面输入框
  const [input, setInput] = useState('')
  //左侧对话选择
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)

 const currentConv = conversations.find(c => c.id === currentConvId)
 const currentConvmessages = currentConv?.messages || []  // 添加默认值

  const createNewChat = () => {

    const newConv: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      updatedAt: new Date()
    }
    setConversations([newConv, ...conversations])
    setCurrentConvId(newConv.id)
  }

  //封装对话消息更新函数
  const addMsgToConversation = (convId: string | null, newMsg: Message) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id !== convId) return conv

      return {
        ...conv,
        messages: [...conv.messages, newMsg],
        title: conv.messages.length === 0
          ? newMsg.content.slice(0, 20)
          : conv.title,
        updatedAt: new Date()
      }
    }))
  }

  const sendMessage = () => {
    if (input.trim() === '') return

    const userMsg: Message = {
      role: 'user',
      content: input
    }

    addMsgToConversation(currentConvId, userMsg)

    setInput('')

    setTimeout(() => {
      const aiMsg: Message = {
        role: 'assistant',
        content: '模拟回复'
      }

      addMsgToConversation(currentConvId, aiMsg)

    }, 1000);
  }

  return (
    <div className={`flex h-screen ${darkMode ? 'dark' : ''}`}>
      {/* 左侧边栏 */}
      <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r dark:border-gray-700 flex flex-col">
        <div className="p-2 flex items-center justify-center" >
          <h1 className="text-2xl font-bold dark:text-white">百问</h1>
        </div>
        <div className="p-2 border-b">
          <button
            onClick={createNewChat}
            className="w-full p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            + 新建对话
          </button>
        </div>
        {/* 中间：历史对话列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs text-gray-500 dark:text-gray-400 mb-2">最近对话</h3>
          {/* 这里后面会放对话列表 */}
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => setCurrentConvId(conv.id)}
              className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors ${currentConvId === conv.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
            >
              <div className="text-sm font-medium truncate dark:text-gray-200">
                {conv.title}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {conv.messages.length} 条消息
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧主内容 */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
        {/* 顶部导航栏 */}
        <div className="h-16 border-b dark:border-gray-700 flex items-center justify-end px-6">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* 消息列表区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentConvmessages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-400 dark:text-gray-500">开始新的对话吧！</p>
            </div>
          ) : (
            currentConvmessages.map((msg, index) => (
              <div
                key={index}
                className={`flex mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
              >
                <div
                  className={`max-w-[70%] p-4 rounded-lg ${msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 输入框区域 */}
        <div className="border-t dark:border-gray-700 p-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="输入消息..."
              className="flex-1 p-3 border dark:border-gray-600 rounded-lg resize-none dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />

            <button 
              onClick={sendMessage}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              发送
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
