'use client'
import { useState, useEffect, useCallback } from 'react'
import { Conversation, Message } from '../types'
import { useAuth } from './useAuth'
import * as db from '@/lib/database'
/**
 * 自定义 Hook：对话管理
 * 负责对话的增删改查和当前对话的切换
 */
export function useConversations() {

  const { user } = useAuth()  // 获取当前用户

  const [conversations, setConversations] = useState<Conversation[]>([])
  
  // 使用 localStorage 持久化当前对话 ID
  const [currentConvId, setCurrentConvId] = useState<string | null>(() => {
    // 初始化时从 localStorage 读取
    if (typeof window !== 'undefined') {
      return localStorage.getItem('currentConvId')
    }
    return null
  })
  
  const [isLoading, setIsLoading] = useState(true)  // 加载状态（包括用户和对话）
  
  // 当 currentConvId 变化时，保存到 localStorage
  useEffect(() => {
    if (currentConvId) {
      localStorage.setItem('currentConvId', currentConvId)
    }
  }, [currentConvId])

  const currentConv = conversations.find(c => c.id === currentConvId)
  const currentConvmessages = currentConv?.messages || []

  const loadConversations = async () => {

    try {
      setIsLoading(true)  // 开始加载
      
      // 临时：添加延迟以便看到骨架屏效果（测试用）
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // ---------- 2. 从数据库查询对话 ----------

      // db.fetchConversations() 会：
      // - 查询 conversations 表
      // - 查询 messages 表
      // - 组装成完整的对话数据
      // - RLS 策略自动过滤，只返回当前用户的对话
      const data = await db.fetchConversations()

      // ---------- 3. 更新状态 ----------

      setConversations(data)

      // ---------- 4. 智能选择对话 ----------

      // 优先级：
      // 1. 如果 localStorage 中有保存的对话 ID，且该对话存在，选择它
      // 2. 否则，选择第一个对话
      const savedConvId = localStorage.getItem('currentConvId')
      const savedConvExists = data.some(c => c.id === savedConvId)
      
      if (savedConvExists) {
        setCurrentConvId(savedConvId)  // 恢复之前选中的对话
      } else if (data.length > 0) {
        setCurrentConvId(data[0].id)   // 选择第一个对话
      }

    } catch (error) {
      // 数据库查询失败，打印错误信息
      console.error('加载对话失败:', error)

    } finally {
      setIsLoading(false)  // 加载完成
    }
  }
 
  // ---------- 监听用户登录状态 ----------

  // 当 user 变化时（登录/登出），重新加载对话
  useEffect(() => {
    console.log('🔍 useEffect 触发，user:', user)
    if (user) {
      console.log('✅ 用户已登录，开始加载对话')
      loadConversations()
    } else {
      console.log('⏳ 等待用户登录...')
      // 不设置 isLoading = false，保持骨架屏显示
    }
  }, [user])  // 依赖项：user

  // 保存新对话（数据库 + 本地状态）
  const saveConversation = useCallback(async () => {
    try {
      const data: any = await db.createConversation(user!.id)
      const newConv: Conversation = {
        id: data.id,
        title: data.title,
        messages: [],
        updatedAt: new Date()
      }
      setConversations(prev => [newConv, ...prev])
      setCurrentConvId(newConv.id)
    } catch (error) {
      console.error('创建对话失败:', error)
    }
  }, [user])  // 只依赖 user，因为使用了函数式更新

  // 添加消息到对话
  const saveMessage =  useCallback( async (convId: string, newMsg: Message) => {
    try {
      await db.addMessage(convId, newMsg)

      // 找到当前对话
      const targetConv = conversations.find(c => c.id === convId)

      // 判断是否需要更新标题
      // 如果是第一条消息（messages.length === 0），用消息内容作为标题
      const shouldUpdateTitle = targetConv && targetConv.messages.length === 0

      // 更新数据库中的对话记录
      await db.updateConversation(convId, {
        updated_at: new Date().toISOString(),  // 更新时间（用于排序）
        ...(shouldUpdateTitle && { title: newMsg.content.slice(0, 20) })  // 条件更新标题
      })

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
    } catch (error) {
      console.error('添加消息失败:', error)
    }
  }, [conversations])  // 依赖 conversations，因为需要读取它的值

  // 更新最后一条消息（用于流式输出）
  // 只更新本地状态，不写数据库
  const updateLocalLastMessage = useCallback( (convId: string | null, newContent: string) => {
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
  }, [])  // 空数组，因为使用了函数式更新，不需要外部变量

  // 删除对话
  const deleteConversation = useCallback( async (convId: string) => {

    try {
      //先改数据库
      await db.deleteConversation(convId)
      //再改本地的显示
      const newConversations = conversations.filter((c) => c.id !== convId)
      setConversations(newConversations)

      if (convId === currentConvId) {
        if (newConversations.length === 0) {
          await saveConversation()
        } else {
          setCurrentConvId(newConversations[0].id)
        }
      }

    } catch (error) {
      console.error('删除对话失败:', error)
    }
  }, [conversations, currentConvId, saveConversation])  // 依赖所有读取的外部变量



  const loadMoreMessages = useCallback(async (convId: string) => {
    try {
      // 找到当前对话
      const targetConv = conversations.find(c => c.id === convId)
      if (!targetConv) return

      // 当前已有 10 条消息，要加载第 11-20 条
      const currentCount = targetConv.messages.length
      
      // 调用数据库函数：fetchMessages(对话ID, 跳过10条, 加载10条)
      const olderMessages = await db.fetchMessages(convId, currentCount, 10)
      
      // 如果返回空数组，说明没有更多了
      if (olderMessages.length === 0) {
        // 标记为 hasMoreMessages = false
        setConversations(prev => prev.map(conv => 
          conv.id === convId 
            ? { ...conv, hasMoreMessages: false }
            : conv
        ))
        return
      }
      
      // 把新消息插入到开头：[新10条, 原来10条]
      setConversations(prev => prev.map(conv => {
        if (conv.id !== convId) return conv
        return {
          ...conv,
          messages: [...olderMessages, ...conv.messages],
          hasMoreMessages: olderMessages.length === 10  // 如果返回了 10 条，可能还有更多
        }
      }))
    } catch (error) {
      console.error('加载更多消息失败:', error)
    }
  }, [conversations])

  return {
    conversations,
    currentConvId,
    currentConvmessages,
    isLoading,  // 导出加载状态
    setCurrentConvId,
    setConversations,
    saveConversation,
    saveMessage,
    updateLocalLastMessage,
    deleteConversation,
    loadMoreMessages
  }
}
