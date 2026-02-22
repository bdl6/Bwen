import Link from 'next/link'

interface HeaderProps {
  darkMode: boolean
  onToggleDarkMode: () => void
}

/**
 * 顶部导航栏组件
 */
export function Header({ darkMode, onToggleDarkMode }: HeaderProps) {
  return (
    <div className="h-16 border-b dark:border-gray-700 flex items-center justify-end px-6 gap-4">
      <Link href={`/about?darkMode=${darkMode}`} className="text-blue-500 hover:underline">
        关于
      </Link>
      <button
        onClick={onToggleDarkMode}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        {darkMode ? '☀️' : '🌙'}
      </button>
    </div>
  )
}
