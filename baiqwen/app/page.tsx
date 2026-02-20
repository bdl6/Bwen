'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'

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

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    //先检查是否有window，避免在服务端出错
    if (typeof window === 'undefined') {
      return initialValue
    }

    try {
      // 这个函数只在首次渲染时执行
      //先获取item，之后没有再说
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(`获取${key}失败`, error)
      return initialValue

    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue))
    } catch (error) {
      console.error(`保存${key}失败`, error)
    }
  }, [key, storedValue])

  return [storedValue, setStoredValue] as const
}

// 对话管理 Hook
function useConversations() {
  const [conversations, setConversations] = useLocalStorage<Conversation[]>('conversations', [])
  const [currentConvId, setCurrentConvId] = useLocalStorage<string | null>('currentConvId', null)

  const currentConv = conversations.find(c => c.id === currentConvId)
  const currentConvmessages = currentConv?.messages || []

  // 创建新对话
  const createNewChat = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      updatedAt: new Date()
    }
    setConversations(prev => [newConv, ...prev])
    setCurrentConvId(newConv.id)
  }

  // 添加消息到对话
  const addMsgToConversation = (convId: string | null, newMsg: Message) => {
    setConversations(prev => {
      const targetConv = prev.find(c => c.id === convId)
      if (!targetConv) return prev

      const updatedConv: Conversation = {
        ...targetConv,
        messages: [...targetConv.messages, newMsg],
        title: targetConv.messages.length === 0
          ? newMsg.content.slice(0, 20)
          : targetConv.title,
        updatedAt: new Date()
      }

      const otherConvs = prev.filter(c => c.id !== convId)
      return [updatedConv, ...otherConvs]
    })
  }

  // 更新最后一条消息（用于流式输出）
  const updateLastMessage = (convId: string | null, newContent: string) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id !== convId) return conv

      const messages = [...conv.messages]
      if (messages.length > 0) {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content: newContent
        }
      }

      return {
        ...conv,
        messages,
        updatedAt: new Date()
      }
    }))
  }

  // 删除对话
  const delConversation = (convId: string) => {
    const newConversations = conversations.filter((c) => c.id !== convId)
    setConversations(newConversations)

    if (convId === currentConvId) {
      if (newConversations.length === 0) {
        createNewChat()
      } else {
        setCurrentConvId(newConversations[0].id)
      }
    }
  }

  // 页面加载时自动创建第一个对话
  useEffect(() => {
    if (conversations.length === 0) {
      createNewChat()
    }
  }, [])

  return {
    conversations,
    currentConvId,
    currentConvmessages,
    setCurrentConvId,
    createNewChat,
    addMsgToConversation,
    updateLastMessage,
    delConversation
  }
}


export default function Home() {
  // 使用对话管理 Hook
  const {
    conversations,
    currentConvId,
    currentConvmessages,
    setCurrentConvId,
    createNewChat,
    addMsgToConversation,
    updateLastMessage,
    delConversation
  } = useConversations()

  // 其他状态
  const [darkMode, setDarkMode] = useLocalStorage<Boolean>('darkMode', false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)  // 用于停止请求

  // 消息自动滚动
  const messageEndRef = useRef<HTMLDivElement>(null)
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [currentConvmessages])

  // 发送消息
  const sendMessage = async () => {
    if (input.trim() === '' || isLoading) return

    setIsLoading(true)

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()

    const userMsg: Message = {
      role: 'user',
      content: input
    }

    addMsgToConversation(currentConvId, userMsg)

    setInput('')

    //滑动窗口 控制上下文长度为20条消息
    const MAX_MESSAGES = 20
    const recentMessages = currentConvmessages.slice(-MAX_MESSAGES)
    const messagesToSend = [...recentMessages, userMsg]

    const emptyAiMsg: Message = {
      role: 'assistant',
      content: ''  // 空内容
    }
    addMsgToConversation(currentConvId, emptyAiMsg)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messagesToSend
        }),
        signal: abortControllerRef.current.signal  // 传入 signal
      })
      //也是web api
      const reader = response.body?.getReader()
      console.log('reader', reader)
      if (!reader) {
        console.error('无法获取 reader')
        return
      }
      //解码器，浏览器的web api，因为http只能传字节
      const decoder = new TextDecoder()
      console.log('decoder', decoder)
      //累加内容
      let accumulatedContent = ''
      let lastUpdateTime = 0

      while (true) {
        const { done, value } = await reader.read()
        console.log(value, done)
        if (done) break

        //解码字节数据，一个string
        const chunk = decoder.decode(value)

        //按行分割，一个数组
        const lines = chunk.split('\n')

        //处理一行
        for (const line of lines) {
          if (line.startsWith('data:')) {
            //去掉这个前缀，还是一个string
            const jsonString = line.slice(5).trim()
            if (jsonString) {
              try {
                //string变成object
                const data = JSON.parse(jsonString)
                const content = data.content

                if (content) {
                  accumulatedContent += content
                  const now = Date.now()
                  if (now - lastUpdateTime > 75) {  // 50ms 更新一次
                    updateLastMessage(currentConvId, accumulatedContent)
                    lastUpdateTime = now
                  }
                }
              } catch (error) {
                console.error('前端接收失败', error)
              }
            }
          }
        }
      }
    } catch (e) {
      // 如果是用户主动取消，不显示错误
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('用户停止了生成')
      } else {
        console.error('后端发送失败', e)
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  // 停止生成
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
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
              className={`group relative p-3 mb-2 rounded-lg cursor-pointer transition-colors ${currentConvId === conv.id
                ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
            >
              <div onClick={() => setCurrentConvId(conv.id)}>
                <div className="text-sm font-medium truncate dark:text-gray-200">
                  {conv.title}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {conv.messages.length} 条消息
                </div>
              </div>

              {/* 删除按钮 - hover 时显示 */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  delConversation(conv.id)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                title="删除对话"
              >
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧主内容 */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
        {/* 顶部导航栏 */}
        <div className="h-16 border-b dark:border-gray-700 flex items-center justify-end px-6">
          <Link href={`/about?darkMode=${darkMode}`} className="text-blue-500">
            关于
          </Link>
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
                className={`flex mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-4 rounded-lg ${msg.role === 'user'
                    ? 'bg-blue-500 text-white prose-invert'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 dark:prose-invert'
                    } prose`}
                >

                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))
          )}
          <div ref={messageEndRef} />
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
              disabled={isLoading}
              placeholder="输入消息..."
              className="flex-1 p-3 border dark:border-gray-600 rounded-lg resize-none dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />

            <button
              onClick={isLoading ? stopGeneration : sendMessage}
              disabled={!isLoading && input.trim() === ''}
              className={`px-6 py-2 rounded-lg text-white
              ${isLoading
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-blue-500 hover:bg-blue-600'
                }
              ${!isLoading && input.trim() === '' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? '停止' : '发送'}
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
