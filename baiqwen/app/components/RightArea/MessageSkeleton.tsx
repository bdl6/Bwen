/**
 * 消息列表骨架屏
 * 用于加载消息时的占位显示
 */
export function MessageSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* 用户消息骨架 */}
      <div className="flex justify-end">
        <div className="max-w-[70%] p-4 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
        </div>
      </div>

      {/* AI 消息骨架 */}
      <div className="flex justify-start">
        <div className="max-w-[70%] p-4 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-64 mb-2"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-56 mb-2"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-40"></div>
        </div>
      </div>

      {/* 用户消息骨架 */}
      <div className="flex justify-end">
        <div className="max-w-[70%] p-4 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-40"></div>
        </div>
      </div>
    </div>
  )
}
