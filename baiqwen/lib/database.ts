import { supabase } from './supabase'
import type { Message } from '@/app/types'

/**
 * 数据库操作层
 * 
 * 职责：封装所有 Supabase 数据库操作
 * 优点：
 * 1. 关注点分离：数据库操作和业务逻辑分离
 * 2. 代码复用：其他地方也可以调用这些函数
 * 3. 易于测试：可以单独测试数据访问层
 * 4. 易于维护：修改数据库查询不影响业务逻辑
 */

// ========================================
// 对话相关操作
// ========================================

/**
 * 获取当前用户的所有对话（包含消息）
 * 
 * 流程：
 * 1. 查询 conversations 表，获取对话列表
 * 2. 查询 messages 表，获取所有消息
 * 3. 把消息按 conversation_id 分组，组装成完整的对话数据
 * 
 * RLS 策略：
 * - Supabase 会自动添加 WHERE user_id = auth.uid()
 * - 用户只能看到自己的对话
 * 
 * @returns Promise<Conversation[]> 对话列表（包含消息）
 * @throws Error 如果数据库查询失败
 */
export async function fetchConversations() {
  // ---------- 1. 查询对话列表 ----------
  
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(50)  // 优化：只加载最近 50 个对话

  if (convError) throw convError

  // 如果没有对话，直接返回空数组
  if (!conversations || conversations.length === 0) {
    return []
  }

  // ---------- 2. 只查询这些对话的消息（每个对话最新 20 条）----------
  
  // 提取对话 ID 列表
  const conversationIds = conversations.map(conv => conv.id)
  
  // 为每个对话查询最新 10 条消息
  // 注意：这里我们需要对每个对话分别查询，因为 Supabase 不支持按分组限制
  const messagesPromises = conversationIds.map(async (convId) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })  // 最新的在前
      .limit(10)  // 每个对话只取最新 10 条

    if (error) throw error
    
    // 反转数组，让最旧的在前（显示顺序）
    return (data || []).reverse()
  })

  const messagesArrays = await Promise.all(messagesPromises)
  
  // 扁平化成一维数组
  const messages = messagesArrays.flat()

  // ---------- 3. 优化数据组装 ----------
  
  // 使用 Map 提升性能，时间复杂度从 O(n*m) 降到 O(n+m)
  const messagesByConvId = new Map<string, typeof messages>()
  
  // 先按 conversation_id 分组（只遍历一次）
  messages?.forEach(msg => {
    const convId = msg.conversation_id
    if (!messagesByConvId.has(convId)) {
      messagesByConvId.set(convId, [])
    }
    messagesByConvId.get(convId)!.push(msg)
  })
  
  // 组装最终数据
  return conversations.map(conv => {
    const convMessages = messagesByConvId.get(conv.id) || []
    
    return {
      id: conv.id,
      title: conv.title,
      messages: convMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      updatedAt: new Date(conv.updated_at),
      // 如果加载了 10 条消息，可能还有更多
      hasMoreMessages: convMessages.length === 10
    }
  })
}


/**
 * 创建新对话
 * 
 * 流程：
 * 1. 向 conversations 表插入一条记录
 * 2. 返回新创建的对话数据
 * 
 * RLS 策略：
 * - 插入时会自动验证 user_id 是否等于 auth.uid()
 * - 用户只能创建自己的对话
 * 
 * @param userId - 用户 ID（从 auth.user.id 获取）
 * @returns Promise<Conversation> 新创建的对话数据
 * @throws Error 如果插入失败
 */
export async function createConversation(userId: string) {
  // .insert() - 插入数据
  // .select() - 返回插入的数据（默认不返回）
  // .single() - 只返回一条记录（不是数组）
  
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,      // 关联到用户
      title: '新对话'       // 默认标题
      // id, created_at, updated_at 会自动生成
    })
    .select()               // 返回插入的数据
    .single()               // 返回单个对象，而不是数组

  if (error) throw error
  
  // 返回值示例：
  // {
  //   id: 'uuid-string',
  //   user_id: 'user-uuid',
  //   title: '新对话',
  //   created_at: '2024-01-01T00:00:00Z',
  //   updated_at: '2024-01-01T00:00:00Z'
  // }
  return data
}

/**
 * 删除对话
 * 
 * 流程：
 * 1. 从 conversations 表删除指定的对话
 * 2. 该对话的所有消息会自动级联删除（ON DELETE CASCADE）
 * 
 * RLS 策略：
 * - 只能删除自己的对话
 * - 如果尝试删除别人的对话，会返回错误
 * 
 * @param conversationId - 对话 ID
 * @throws Error 如果删除失败或无权限
 */
export async function deleteConversation(conversationId: string) {
  // .delete() - 删除操作
  // .eq('id', conversationId) - WHERE id = conversationId
  
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)

  if (error) throw error
  
  // 注意：
  // - 不需要手动删除 messages 表的数据
  // - 因为创建表时设置了 ON DELETE CASCADE
  // - 删除对话时，数据库会自动删除相关的消息
}

/**
 * 更新对话的标题和更新时间
 * 
 * 使用场景：
 * 1. 用户发送第一条消息时，自动用消息内容作为标题
 * 2. 添加新消息时，更新 updated_at 字段（用于排序）
 * 
 * @param conversationId - 对话 ID
 * @param updates - 要更新的字段
 * @param updates.title - 新标题（可选）
 * @param updates.updated_at - 更新时间（可选）
 * @throws Error 如果更新失败
 */
export async function updateConversation(
  conversationId: string,
  updates: { 
    title?: string          // ? 表示可选参数
    updated_at?: string 
  }
) {
  // .update() - 更新操作
  // .eq('id', conversationId) - WHERE id = conversationId
  
  const { error } = await supabase
    .from('conversations')
    .update(updates)        // 只更新传入的字段
    .eq('id', conversationId)

  if (error) throw error
  
  // 示例调用：
  // updateConversation('conv-id', { title: '新标题' })
  // updateConversation('conv-id', { updated_at: new Date().toISOString() })
  // updateConversation('conv-id', { title: '新标题', updated_at: '...' })
}







// ========================================
// 消息相关操作
// ========================================

/**
 * 添加消息到对话
 * 
 * 流程：
 * 1. 向 messages 表插入一条消息记录
 * 2. 消息会自动关联到指定的对话
 * 
 * RLS 策略：
 * - 只能向自己的对话添加消息
 * - 通过 EXISTS 子查询验证对话所有权
 * 
 * @param conversationId - 对话 ID
 * @param message - 消息对象
 * @param message.role - 消息角色（'user' 或 'assistant'）
 * @param message.content - 消息内容
 * @throws Error 如果插入失败或无权限
 */
export async function addMessage(
  conversationId: string,
  message: Message
) {
  // .insert() - 插入消息
  // 不需要 .select() 因为我们不需要返回值
  
  const { error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,  // 关联到对话
      role: message.role,               // 'user' 或 'assistant'
      content: message.content          // 消息内容
      // id, created_at 会自动生成
    })

  if (error) throw error
  
  // RLS 策略会自动验证：
  // - 该对话是否属于当前用户
  // - 如果不属于，会抛出错误
}

/**
 * 分页查询对话的消息（用于无限滚动）
 * 
 * 流程：
 * 1. 查询指定对话的消息
 * 2. 按创建时间倒序排列（最新的在前）
 * 3. 使用 offset 和 limit 实现分页
 * 
 * 使用场景：
 * - 初始加载：fetchMessages(convId, 0, 10) 获取最新 10 条
 * - 向上滚动：fetchMessages(convId, 10, 10) 获取接下来 10 条
 * 
 * @param conversationId - 对话 ID
 * @param offset - 跳过的消息数量（从 0 开始）
 * @param limit - 每次加载的消息数量
 * @returns Promise<Message[]> 消息列表
 * @throws Error 如果查询失败
 */
export async function fetchMessages(
  conversationId: string,
  offset: number = 0,
  limit: number = 10
) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })  // 倒序：最新的在前
    .range(offset, offset + limit - 1)          // 分页：[offset, offset+limit)

  if (error) throw error

  // 返回前需要反转数组，因为我们要按时间正序显示
  // 数据库返回：[msg3, msg2, msg1]（最新在前）
  // 我们需要：[msg1, msg2, msg3]（最旧在前）
  return (data || []).reverse().map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content
  }))
}
