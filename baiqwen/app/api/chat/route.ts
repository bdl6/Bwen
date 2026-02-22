
export async function POST(request: Request) {
  // 1. 获取前端发来的消息列表
  const { messages } = await request.json()

  // 2. 从环境变量获取 API Key（保护密钥安全）
  const apiKey = process.env.DASHSCOPE_API_KEY

  // 3. 调用通义千问 API
  const dashscopeResponse = await fetch(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-SSE': 'enable'  // 开启 SSE 流式输出
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        input: {
          messages: messages  // 发送对话历史
        },
        parameters: {
          result_format: 'message',
          incremental_output: true  // 开启增量输出
        }
      })
    }
  )

 

  // 4. 检查 API 是否正常返回数据
  if (!dashscopeResponse.body) {
    return Response.json({ error: '无法获取响应' }, { status: 500 })
  }

  // 5. 创建一个流，用于转发数据给前端
  const stream = new ReadableStream({
    async start(controller) {
      // 5.1 创建读取器，从千问 API 读取数据
      const reader = dashscopeResponse.body!.getReader()
      // 5.2 创建解码器，把字节转成文字
      const decoder = new TextDecoder()

      try {
        // 5.3 循环读取数据，直到读完
        while (true) {
          // 读取一块数据
          const { done, value } = await reader.read()
          
          // 如果读完了，退出循环
          if (done) break

          // 把字节数据转成文字
          const chunk = decoder.decode(value)
          
          // 按行分割（千问返回的是多行数据）
          const lines = chunk.split('\n')

          // 处理每一行
          for (const line of lines) {
            // 只处理以 "data:" 开头的行
            if (line.startsWith('data:')) {
              // 去掉 "data:" 前缀，得到 JSON 字符串
              const jsonString = line.slice(5).trim()
              
             
              // 如果不是空行
              if (jsonString) {
                try {
                  // 解析 JSON
                  const jsonData = JSON.parse(jsonString)
                  
              
                  
                  // 提取 AI 生成的文字内容
                  const aiContent = jsonData.output?.choices?.[0]?.message?.content
                  
               
                  
                  // 如果有内容，就发送给前端
                  if (aiContent) {
                    // 把内容转成 SSE 格式：data: {...}\n\n
                    const sseMessage = `data: ${JSON.stringify({ content: aiContent })}\n\n`
                    
                    // 把字符串转成字节，发送给前端
                    controller.enqueue(new TextEncoder().encode(sseMessage))
                  }
                } catch (parseError) {
                  // 如果 JSON 解析失败，忽略这一行
                  console.error('JSON 解析失败:', parseError)
                }
              }
            }
          }
        }
      } catch (error) {
        // 如果读取过程出错，通知前端
        console.error('流式读取错误:', error)
        controller.error(error)
      } finally {
        // 无论成功还是失败，最后都要关闭流
        controller.close()
      }
    }
  })

  // 6. 返回流式响应给前端
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',  // SSE 格式
      'Cache-Control': 'no-cache',          // 不缓存
      'Connection': 'keep-alive'            // 保持连接
    }
  })
}
