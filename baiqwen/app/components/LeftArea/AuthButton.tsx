'use client'
import { useState } from 'react'
import { useAuth } from '@/app/hooks/useAuth'
import { useRouter } from 'next/navigation'
/**
 * 登录/登出按钮组件
 * 未登录：显示 GitHub 登录按钮
 * 已登录：显示用户头像，点击弹出登出确认
 */

export function AuthButton(){
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const { user, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    setShowLogoutMenu(false)
    await signOut()  // 等待登出完成
    // 强制刷新页面，确保清除所有状态
    window.location.href = '/login'
  }

  // 未登录：显示 GitHub 登录按钮
  if (!user) {
    return (
      <button
        onClick={() => router.push('/login')}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
        </svg>
        <span>登录</span>
      </button>
    )
  }

  // 已登录：显示头像和下拉菜单
  return (
    <div className="relative">
      {/* 用户头像按钮 */}
      <button
        onClick={() => setShowLogoutMenu(!showLogoutMenu)}
        className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
        title={user.user_metadata?.full_name || user.email || '用户'}
      >
        <img 
          src={user.user_metadata?.avatar_url || 'https://via.placeholder.com/32'} 
          alt={user.user_metadata?.full_name || '用户头像'}
          className="w-full h-full object-cover"
        />
      </button>

      {/* 登出确认菜单 */}
      {showLogoutMenu && (
        <>
          {/* 遮罩层：点击关闭菜单 */}
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setShowLogoutMenu(false)}
          />
          
          {/* 下拉菜单 */}
          <div className="absolute right-0 top-10 z-20 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-2">
            {/* 用户信息 */}
            <div className="px-4 py-2 border-b dark:border-gray-700">
              <div className="text-sm font-medium dark:text-white truncate">
                {user.user_metadata?.full_name || '用户'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user.email}
              </div>
            </div>

            {/* 登出按钮 */}
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              退出登录
            </button>
          </div>
        </>
      )}
    </div>
  )
}