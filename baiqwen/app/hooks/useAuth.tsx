'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

/**
 * 认证 Hook
 * 功能：管理用户登录状态和认证操作
 * 返回：user（用户信息）、loading（加载状态）、登录/登出方法
 */
export function useAuth() {
  // ========== 状态管理 ==========
  
  // user: 存储当前登录的用户信息
  // User 类型包含：id, email, user_metadata（头像、昵称等）
  // null 表示未登录
  const [user, setUser] = useState<User | null>(null)
  
  // loading: 是否正在检查登录状态
  // true = 正在检查，false = 检查完成
  // 用于显示加载动画，避免闪烁
  const [loading, setLoading] = useState(true)

  // ========== 初始化和监听 ==========
  
  useEffect(() => {
    // ---------- 1. 获取当前用户 ----------
    
    // supabase.auth.getUser() 的作用：
    // - 从浏览器的 localStorage 读取 token
    // - 向 Supabase 服务器验证 token 是否有效
    // - 返回用户信息（如果 token 有效）
    
    // 返回值是一个 Promise，结构是：
    // { data: { user: User | null }, error: Error | null }
    
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      // 解构赋值：从 data 中取出 user
      // 相当于：const user = response.data.user
      
      setUser(user)        // 更新用户状态
      setLoading(false)    // 检查完成，关闭加载状态
    })

    // ---------- 2. 监听登录状态变化 ----------
    
    // supabase.auth.onAuthStateChange() 的作用：
    // - 监听所有认证事件（登录、登出、token 刷新等）
    // - 返回一个订阅对象，包含 unsubscribe 方法
    
    // 回调函数参数：
    // - _event: 事件类型（SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED 等）
    //   前面加 _ 表示我们不使用这个参数
    // - session: 当前会话信息，包含 user 和 access_token
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: any, session: any) => {
        // session?.user 的含义：
        // - 如果 session 存在，取 session.user
        // - 如果 session 是 null，返回 undefined
        
        // ?? null 的含义：
        // - 如果左边是 null 或 undefined，返回右边的值（null）
        // - 这是"空值合并运算符"
        console.log(session?.user)
        setUser(session?.user ?? null)
        
        // 完整写法：
        // if (session && session.user) {
        //   setUser(session.user)
        // } else {
        //   setUser(null)
        // }
      }
    )

    // ---------- 3. 清理订阅 ----------
    
    // 为什么要清理？
    // - useEffect 的清理函数在组件卸载时执行
    // - 如果不清理，监听器会一直运行，导致内存泄漏
    // - 类似于 addEventListener 后要 removeEventListener
    
    return () => subscription.unsubscribe()
    
  }, [])  // 空依赖数组 = 只在组件挂载时执行一次

  // ========== 登录方法 ==========
  
  /**
   * GitHub 登录
   * 流程：
   * 1. 调用这个方法
   * 2. 跳转到 GitHub 授权页面
   * 3. 用户同意授权
   * 4. GitHub 重定向到 Supabase callback URL
   * 5. Supabase 处理登录，生成 session
   * 6. 重定向回我们的网站（redirectTo 指定的地址）
   * 7. onAuthStateChange 监听器触发，更新 user 状态
   */
  const signInWithGitHub = async () => {
    // supabase.auth.signInWithOAuth() 的作用：
    // - 生成 GitHub OAuth 授权 URL
    // - 自动跳转到 GitHub 授权页面
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',  // 使用 GitHub 作为登录提供商
      
      options: {
        // redirectTo: 登录成功后跳转的地址
        // window.location.origin = 当前网站的域名
        // 例如：http://localhost:3000 或 https://你的域名.vercel.app
        redirectTo: `${window.location.origin}/`
        
        // 其他可选参数：
        // scopes: 'repo user'  // 请求的权限范围
        // queryParams: { ... }  // 额外的查询参数
      }
    })
    
    // 返回 error（如果有的话）
    // 调用方可以检查是否登录失败
    return { error }
  }

  // ========== 登出方法 ==========
  
  /**
   * 登出
   * 流程：
   * 1. 调用这个方法
   * 2. Supabase 清除 localStorage 中的 token
   * 3. onAuthStateChange 监听器触发
   * 4. user 状态更新为 null
   */
  const signOut = async () => {
    // supabase.auth.signOut() 的作用：
    // - 清除本地存储的 token
    // - 触发 SIGNED_OUT 事件
    // - 不需要返回值，直接执行即可
    
    await supabase.auth.signOut()
  }

  // ========== 返回值 ==========
  
  return { 
    user,              // 用户信息（User 对象或 null）
    loading,           // 是否正在加载（boolean）
    signInWithGitHub,  // 登录方法（函数）
    signOut            // 登出方法（函数）
  }
}
