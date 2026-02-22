// 消息类型
export interface Message {
  role: 'user' | 'assistant'
  content: string
}

// 对话类型
export interface Conversation {
  id: string
  title: string
  messages: Message[]
  updatedAt: Date
  hasMoreMessages?:boolean
}
