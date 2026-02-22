/**
 * 对话列表骨架屏
 * 用于加载对话时的占位显示
 */
export function ConversationSkeleton() {
  return (
    <div className="space-y-2">
      {/* 渲染 5 个骨架项 */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="p-3 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse"
        >
          {/* 标题骨架 */}
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
          {/* 消息数量骨架 */}
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  )
}
