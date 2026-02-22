interface InputAreaProps {
  input: string
  onInputChange: (value: string) => void
  isLoadingMessage: boolean
  onSendMessage: () => void
  onStopGeneration: () => void
 
}

/**
 * 输入框区域组件
 * 包含：错误提示、输入框、发送按钮
 */
export function InputArea({
  input,
  onInputChange,
  isLoadingMessage,
  onSendMessage,
  onStopGeneration,
 
}: InputAreaProps) {
  return (
    <div className="border-t dark:border-gray-700 p-4">
     

      {/* 输入框和按钮 */}
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSendMessage()
            }
          }}
          disabled={isLoadingMessage}
          placeholder="输入消息..."
          className="flex-1 p-3 border dark:border-gray-600 rounded-lg resize-none dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />

        <button
          onClick={isLoadingMessage ? onStopGeneration : onSendMessage}
          disabled={!isLoadingMessage && input.trim() === ''}
          className={`px-6 py-2 rounded-lg text-white
            ${isLoadingMessage ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}
            ${!isLoadingMessage && input.trim() === '' ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoadingMessage ? '停止' : '发送'}
        </button>
      </div>
    </div>
  )
}
