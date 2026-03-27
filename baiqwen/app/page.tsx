'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'  // 添加：用于路由跳转
import { useLocalStorage } from './hooks/useLocalStorage'
import { useConversations } from './hooks/useConversations'
import { useAuth } from './hooks/useAuth'  // 添加：用于检查登录状态
import type { Message } from './types'
import { Sidebar } from './components/LeftArea/Sidebar'
import { ChatArea } from './components/RightArea/ChatArea'
import * as db from '@/lib/database'  // 导入数据库操作

export default function Home() {
  const router = useRouter()
  const { user, loading } = useAuth()  // 获取用户登录状态和加载状态
  
  // 使用对话管理 Hook（必须在条件 return 之前）
  const {
    conversations,
    currentConvId,
    currentConvmessages,
    isLoading: isLoadingSkeleton,  // 重命名：骨架屏加载状态
    setCurrentConvId,
    setConversations,
    saveConversation,
    saveMessage,
    updateLocalLastMessage,
    deleteConversation,
    loadMoreMessages  // 添加：用于无限滚动
  } = useConversations()

  // 获取当前对话（用于获取 hasMoreMessages）
  const currentConv = conversations.find(c => c.id === currentConvId)

  // 其他状态
  const [darkMode, setDarkMode] = useLocalStorage<Boolean>('darkMode', false)
  const [input, setInput] = useState('')
  const [isLoadingMessage, setIsLoadingMessage] = useState(false)  // 发送消息的加载状态
  const abortControllerRef = useRef<AbortController | null>(null)  // 用于停止请求

  // 消息自动滚动
  const messageEndRef = useRef<HTMLDivElement>(null)
  const prevMessagesLength = useRef(currentConvmessages.length)
  const isInitialLoad = useRef(true)  // 标记是否是首次加载
  
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    const currentLength = currentConvmessages.length
    const prevLength = prevMessagesLength.current
    
    // 情况 1：首次加载（从数据库加载消息）
    if (isInitialLoad.current && currentLength > 0) {
      requestAnimationFrame(() => {
        scrollToBottom()
      })
      isInitialLoad.current = false
      prevMessagesLength.current = currentLength
      return
    }
    
    // 情况 2：发送新消息（增加 1-2 条）
    if (currentLength > prevLength) {
      const diff = currentLength - prevLength
      if (diff <= 2) {  // 用户消息 + AI 消息
        requestAnimationFrame(() => {
          scrollToBottom()
        })
      }
      // 情况 3：无限滚动加载历史消息（增加 10 条）
      // diff > 2 时不滚动
    }
    
    prevMessagesLength.current = currentLength
  }, [currentConvmessages])
  
  // 切换对话时，重置首次加载标记
  useEffect(() => {
    isInitialLoad.current = true
  }, [currentConvId])
  
  // 路由鉴权：未登录则跳转到登录页
  useEffect(() => {
    // 等待 loading 完成后再判断
    if (!loading && user === null) {
      console.log('❌ 未登录，跳转到登录页')
      router.push('/login')
    }
  }, [user, loading, router])

  // 如果正在加载或未登录，显示加载中
  if (loading || user === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }

  // 发送消息
  const sendMessage = async () => {
    if (input.trim() === '' || isLoadingMessage || !currentConvId) return

    setIsLoadingMessage(true)

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()

    const userMsg: Message = {
      role: 'user',
      content: input
    }

    await saveMessage(currentConvId!, userMsg)

    setInput('')

    //滑动窗口 控制上下文长度为20条消息
    const MAX_MESSAGES = 20
    const recentMessages = currentConvmessages.slice(-MAX_MESSAGES)
    const messagesToSend = [...recentMessages, userMsg]

    // 先在本地状态添加一个空的 AI 消息（用于流式显示）
    const emptyAiMsg: Message = {
      role: 'assistant',
      content: ''
    }
    
    // 只更新本地状态，不写数据库
    setConversations(prev => prev.map(conv => {
      if (conv.id !== currentConvId) return conv
      
      return {
        ...conv,
        messages: [...conv.messages, emptyAiMsg],
        updatedAt: new Date()
      }
    }))

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

      if (!reader) {
        console.error('无法获取 reader')
        return
      }
      //解码器，浏览器的web api，因为http只能传字节
      const decoder = new TextDecoder()

      //累加内容
      let accumulatedContent = ''
      let animationFrameId: number | null = null;
      let pendingContent = '';

      const updateContent = () => {
        if (pendingContent) {
          updateLocalLastMessage(currentConvId, pendingContent);
          accumulatedContent = pendingContent;
        }
        animationFrameId = null;
      };

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
                  pendingContent = accumulatedContent + content;
                  
                  // 如果没有待处理的动画帧，则创建一个新的
                  if (animationFrameId === null) {
                    animationFrameId = requestAnimationFrame(updateContent);
                  }
                }
              } catch (error) {
                console.error('前端接收失败', error)
              }
            }
          }
        }
      }

      // 等待最后一个动画帧完成（如果有）
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        updateLocalLastMessage(currentConvId, pendingContent);
      }

      // ========== 关键：流式输出结束后，保存完整内容到数据库 ==========
      console.log('🎯 流式输出结束，准备保存到数据库')
      console.log('📊 累积内容长度:', accumulatedContent.length)
      
      if (accumulatedContent) {
        // 创建完整的 AI 消息
        const aiMsg: Message = {
          role: 'assistant',
          content: accumulatedContent
        }
        
        // 只保存到数据库，不更新本地状态（本地状态已经通过 updateLocalLastMessage 更新了）
        await db.addMessage(currentConvId, aiMsg)
        console.log('💾 AI 回复已保存到数据库')
      }
      // ============================================================

    } catch (e) {
      // 如果是用户主动取消，不显示错误
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('用户停止了生成')
      } else {
        console.error('后端发送失败', e)
      }
    } finally {
      setIsLoadingMessage(false)
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

      <Sidebar
        conversations={conversations}
        currentConvId={currentConvId}
        onSelectConversation={setCurrentConvId}
        onCreateNewChat={saveConversation}
        onDeleteConversation={deleteConversation}
        isLoadingSkeleton={isLoadingSkeleton}
      />

        

      {/* 右侧聊天区 */}
    <ChatArea
      darkMode={!!darkMode}
      onToggleDarkMode={() => setDarkMode(!darkMode)}
      messages={currentConvmessages}
      messageEndRef={messageEndRef}
      input={input}
      onInputChange={setInput}
      isLoadingMessage={isLoadingMessage}
      onSendMessage={sendMessage}
      onStopGeneration={stopGeneration}
      conversationId={currentConvId}
      hasMoreMessages={currentConv?.hasMoreMessages}
      onLoadMore={loadMoreMessages}
      isLoadingSkeleton={isLoadingSkeleton}
    />

    </div>
  )
}
