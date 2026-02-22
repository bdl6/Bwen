import { createClient } from '@supabase/supabase-js'

// 从环境变量获取 Supabase 配置
// 添加默认值防止构建时报错
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 创建 Supabase 客户端实例
// 只在有配置时创建，否则返回 null（运行时会有正确的值）
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any
