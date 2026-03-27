# 百问 AI 对话助手 — 面试问答

> 基于项目真实代码整理，涵盖面试官最可能追问的技术细节。

---

## 一、流式输出 / SSE

**Q1：你说用了 SSE 实现流式输出，能讲一下具体是怎么做的吗？**

A：前端发送 POST 请求到 `/api/chat`，后端 API Route 拿到请求后，带上 `X-DashScope-SSE: enable` 请求头去调通义千问 API，让它以 SSE 格式返回数据。后端拿到响应的 `ReadableStream` 后，用 `getReader()` 循环读取字节块，用 `TextDecoder` 解码成字符串，按行解析 `data:` 前缀的 JSON，提取 `output.choices[0].message.content`，再重新封装成 `data: {"content": "..."}` 格式推给前端。最终 `new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })` 返回给客户端。

前端用 `fetch` 拿到响应后，同样用 `getReader()` 读取流，每收到一个 chunk 就更新本地状态，实现打字机效果。

**Q2：为什么不用 WebSocket，而选择 SSE？**

A：SSE 是单向通信（服务端推送），对于 AI 对话这个场景完全够用——用户发一次消息，服务端持续推送回复。WebSocket 是双向的，实现更复杂，而且 Next.js API Routes 对 SSE 的支持更自然。SSE 还自带断线重连机制，基于 HTTP 协议，穿透代理和防火墙的兼容性也更好。

**Q3：流式输出过程中，你是怎么更新 UI 的？**

A：AI 回复开始时，先在本地 state 里插入一条 `role: 'assistant'` 的空消息占位。每收到一个 chunk，调用 `updateLocalLastMessage` 方法，用函数式更新 `setConversations` 替换最后一条消息的 content。这个方法不写数据库，只改本地状态，保证 UI 响应足够快。等流结束后，再把完整的 AI 回复一次性写入 Supabase。

**Q4：`incremental_output: true` 是什么意思？**

A：这是通义千问 API 的参数，开启后每次推送的是新增的文字片段，而不是累积的全量文本。这样前端只需要把每次收到的 content 拼接到已有内容后面就行，不需要每次替换整个字符串，减少了不必要的字符串操作。

---

## 二、Supabase Auth / GitHub OAuth

**Q5：GitHub OAuth 登录的完整流程是什么？**

A：
1. 用户点击登录，前端调用 `supabase.auth.signInWithOAuth({ provider: 'github' })`
2. Supabase 生成 GitHub 授权 URL，浏览器跳转过去
3. 用户在 GitHub 授权页面同意
4. GitHub 回调到 Supabase 的 callback URL，Supabase 用 code 换取 access token，创建用户 session
5. Supabase 把用户重定向回我们配置的 `redirectTo`（即网站首页）
6. 前端的 `onAuthStateChange` 监听器触发 `SIGNED_IN` 事件，`session.user` 更新到 state

**Q6：你是怎么在全局管理登录状态的？**

A：封装了 `useAuth` 这个自定义 Hook。里面用 `useState` 存 `user`，组件挂载时调用 `supabase.auth.getUser()` 从 localStorage 恢复 session，同时用 `onAuthStateChange` 监听后续的登录/登出事件。Hook 返回 `user`、`loading`、`signInWithGitHub`、`signOut`，其他组件直接调用这个 Hook 就能拿到登录状态，不需要 Context 或全局状态库。

**Q7：为什么要有 `loading` 状态？**

A：防止页面闪烁。`getUser()` 是异步的，在它返回之前 `user` 是 `null`，如果这时候渲染页面，会先显示"未登录"状态，然后突然跳变成"已登录"，体验很差。有了 `loading`，可以在检查完成之前显示骨架屏或 loading 动画，检查完再渲染真实内容。

---

## 三、数据持久化 / Supabase PostgreSQL

**Q8：你的数据库表结构是怎么设计的？**

A：两张表：
- `conversations`：`id`（UUID）、`user_id`（关联 auth.users）、`title`、`created_at`、`updated_at`
- `messages`：`id`、`conversation_id`（外键，ON DELETE CASCADE）、`role`（user/assistant）、`content`、`created_at`

`messages` 表的外键设置了级联删除，删除对话时不需要手动清理消息，数据库自动处理。

**Q9：什么是 RLS？你是怎么用的？**

A：RLS（Row Level Security）是 PostgreSQL 的行级安全策略，可以在数据库层面控制每一行数据的访问权限。我在 `conversations` 和 `messages` 表上都开启了 RLS，策略是 `user_id = auth.uid()`，这样每个用户只能查询、修改、删除自己的数据。即使前端代码有漏洞，数据库层面也会拦截越权访问。

**Q10：加载对话时你做了哪些性能优化？**

A：有几个点：
1. `conversations` 表只加载最近 50 个对话，加了 `.limit(50)`
2. 每个对话只预加载最新 10 条消息，用 `.order('created_at', { ascending: false }).limit(10)` 实现
3. 组装数据时用 `Map` 做消息分组，时间复杂度从 O(n×m) 降到 O(n+m)，避免嵌套循环
4. 多个对话的消息查询用 `Promise.all` 并发执行，而不是串行等待

---

## 四、无限滚动加载

**Q11：无限滚动是怎么实现的？**

A：在 `MessageList` 组件里监听滚动容器的 `scroll` 事件，当 `scrollTop < 100`（距顶部不足 100px）时触发加载。加载前记录当前 `scrollHeight`，加载完成后在 `requestAnimationFrame` 里计算高度差，把 `scrollTop` 加上这个差值，这样新消息插入到顶部后，用户的视觉位置不会跳动。

分页逻辑在 `fetchMessages` 里，用 `offset` 和 `limit` 实现：第一次加载 offset=0，第二次 offset=当前消息数，以此类推。

**Q12：为什么用 `requestAnimationFrame` 来恢复滚动位置？**

A：因为 DOM 更新是异步的，React 的 state 更新触发重渲染后，新的 DOM 高度不会立刻生效。`requestAnimationFrame` 会在浏览器下一次绘制前执行，这时候 DOM 已经更新完毕，`scrollHeight` 是最新的值，计算出来的高度差才准确。

---

## 五、骨架屏

**Q13：你是怎么实现骨架屏的？解决了什么问题？**

A：做了两个骨架屏组件：`MessageSkeleton`（消息列表占位）和 `ConversationSkeleton`（侧边栏对话列表占位）。用 Tailwind 的 `animate-pulse` 实现呼吸动画，用不同宽度的灰色 div 模拟真实内容的布局。

解决的问题是首屏加载时的空白闪烁。用户登录后需要等待 Supabase 查询返回，这段时间如果直接显示空白，体验很差。骨架屏让用户感知到"内容正在加载"，降低了主观等待感。

**Q14：骨架屏的显示时机是怎么控制的？**

A：`useConversations` 里有 `isLoading` 状态，初始值是 `true`，`loadConversations` 执行完（无论成功失败）才在 `finally` 里设为 `false`。`isLoading` 传给 `MessageList` 的 `isLoadingSkeleton` prop，为 `true` 时直接 return `<MessageSkeleton />`，不渲染真实消息列表。

---

## 六、Next.js / React 原理

**Q15：你用的是 App Router，它和 Pages Router 有什么区别？**

A：App Router 基于 React Server Components，默认所有组件都是服务端组件，只有加了 `'use client'` 才是客户端组件。好处是服务端组件可以直接访问数据库、不会把代码打包到客户端 bundle，减少 JS 体积。Pages Router 的组件默认都是客户端的，需要用 `getServerSideProps` 或 `getStaticProps` 来做服务端数据获取，写法更繁琐。

**Q16：API Routes 是怎么工作的？**

A：`app/api/chat/route.ts` 导出一个 `POST` 函数，Next.js 会把它编译成一个独立的 serverless 函数，部署到 Vercel 后每次请求都会触发这个函数执行。API key 存在服务端环境变量里，前端永远拿不到，这是保护 API key 的关键。

**Q17：你用了哪些自定义 Hook，为什么要封装？**

A：封装了 `useAuth`、`useConversations`、`useLocalStorage`。封装的原因是关注点分离——认证逻辑、对话管理逻辑不应该堆在页面组件里，否则组件会变得很臃肿难以维护。自定义 Hook 让逻辑可复用，也更容易单独测试。

---

## 七、安全性

**Q18：你是怎么保护通义千问的 API Key 的？**

A：API Key 存在 `.env.local` 里，变量名是 `DASHSCOPE_API_KEY`（没有 `NEXT_PUBLIC_` 前缀），所以只在服务端可访问，不会被打包到前端代码。所有 AI 请求都通过 `/api/chat` 这个后端路由中转，前端只和自己的 API 通信，永远不会直接调用通义千问。

**Q19：如果不做 RLS，会有什么安全问题？**

A：Supabase 的 anon key 是公开的（存在 `NEXT_PUBLIC_` 环境变量里），任何人都能拿到这个 key 直接调用 Supabase API。如果没有 RLS，用户 A 可以构造请求查询用户 B 的对话数据，造成数据泄露。RLS 在数据库层面强制隔离，即使绕过前端也无法越权访问。

---

## 八、TypeScript

**Q20：你在项目里是怎么用 TypeScript 的？**

A：定义了 `Message`（`role: 'user' | 'assistant'`，用联合类型限制枚举值）和 `Conversation` 类型，放在 `app/types/index.ts` 统一管理。数据库操作函数都有明确的参数类型和返回类型，比如 `addMessage(conversationId: string, message: Message)`。这样 IDE 有完整的类型提示，传错参数时编译阶段就能发现问题。

---

*面试时记得结合具体代码细节来回答，比如提到 `requestAnimationFrame`、`Map` 优化、`Promise.all` 并发等，会让回答更有说服力。*


---

## 九、项目亮点与难点

**Q21：这个项目你觉得最大的亮点是什么？**

A：我觉得有两个点比较有意思。

第一个是流式输出的设计。AI 回复如果等全部生成完再显示，用户要盯着空白等好几秒，体验很差。我用 SSE 实现了实时推送，后端 API Route 把通义千问的流直接转发给前端，前端用 `getReader()` 逐块读取，每收到一个 chunk 就更新 UI，实现打字机效果。这里有个细节：流式更新只调用 `updateLocalLastMessage` 改本地 state，等流结束才一次性把完整回复写入 Supabase，避免了频繁写库的性能问题。

第二个是性能上的一些小优化。加载对话数据时，用 `Map` 做消息分组，把时间复杂度从 O(n×m) 降到 O(n+m)；多个对话的消息查询用 `Promise.all` 并发执行；消息组件用 `React.memo` 加自定义比较函数，流式输出时只有内容变化的那条消息会重渲染，其他消息不受影响。

---

**Q22：开发过程中遇到的最大难点是什么？**

A：无限滚动加载历史消息时遇到了一个体验问题：新消息插入到列表顶部后，页面会突然往下跳，用户正在看的内容位置全乱了。

排查后发现原因是 DOM 更新是异步的。我的思路是：加载前记录 `scrollHeight`，加载完成后用新旧高度差来补偿 `scrollTop`。但直接在 `await onLoadMore()` 后面设置 `scrollTop` 不生效，因为 React 的 state 更新触发重渲染后，新的 DOM 高度还没有反映到页面上，`scrollHeight` 读到的还是旧值。

最终用 `requestAnimationFrame` 解决——把补偿逻辑放进去，它会在浏览器下一帧绘制前执行，这时候 DOM 已经更新完毕，`scrollHeight` 是最新的值，计算出来的偏移量才准确，滚动位置就稳了。

```ts
requestAnimationFrame(() => {
  const newScrollHeight = container.scrollHeight
  const heightDiff = newScrollHeight - previousScrollHeight.current
  container.scrollTop = container.scrollTop + heightDiff
  setIsLoading(false)
})
```

---

## 十、Markdown 渲染与代码高亮

**Q23：AI 回复的 Markdown 是怎么渲染的？**

A：用的是 `react-markdown` 库。在 `MessageItem` 组件里，把 `message.content` 直接传给 `<ReactMarkdown>`，它会把 Markdown 字符串解析成对应的 React 元素，比如 `**bold**` 渲染成 `<strong>`，`# 标题` 渲染成 `<h1>`。

样式上用了 Tailwind 的 `prose` 类，它提供了一套排版样式，标题、段落、列表、引用块都有合适的间距和字号，不需要手动写 CSS。

**Q24：代码高亮是怎么实现的？**

A：通过 `react-markdown` 的 `components` prop 自定义 `code` 元素的渲染逻辑。当解析到代码块时，用正则 `/language-(\w+)/` 从 `className` 里提取语言名（比如 `language-javascript` → `javascript`），然后渲染自定义的 `CodeBlock` 组件。

`CodeBlock` 内部用 `react-syntax-highlighter` 的 `Prism` 引擎做语法高亮，主题用的是 `vscDarkPlus`（就是 VS Code 的深色主题）。

区分行内代码和代码块的方式是判断 `inline` prop：`inline` 为 `true` 时直接渲染 `<code>` 标签，`false` 时才走 `CodeBlock` 组件。

**Q25：为什么要用 `dynamic` 懒加载 `SyntaxHighlighter`？**

A：`react-syntax-highlighter` 支持几百种语言的语法高亮，整个库体积很大。如果直接 `import`，它会被打包进首屏 JS bundle，拖慢初始加载速度。用 `next/dynamic` 懒加载，加上 `ssr: false`，这个组件只在客户端、且真正需要渲染代码块时才加载，不影响首屏性能。

**Q26：`React.memo` 在这里起什么作用？**

A：`MessageItem` 用 `memo` 包裹，并传入了自定义比较函数 `areEqual`，只比较 `message.content` 和 `message.role`。流式输出时，每收到一个 chunk，`useConversations` 里的 `conversations` state 会更新，导致父组件重渲染，进而触发所有 `MessageItem` 重渲染。有了 `memo`，只有最后一条正在更新的 AI 消息会重渲染，历史消息全部跳过，在消息很多时能明显减少不必要的计算。


---

## 十一、数据查询设计与性能优化

**Q27：加载对话列表时，后端查询是怎么设计的？**

A：分三步走，核心思路是"先查对话，再并发查消息，最后用 Map 组装"。

**第一步：查对话列表**

```ts
const { data: conversations } = await supabase
  .from('conversations')
  .select('*')
  .order('updated_at', { ascending: false })
  .limit(50)  // 只取最近 50 个对话
```

按 `updated_at` 倒序，最近活跃的对话排在前面。加了 `limit(50)` 避免用户对话很多时一次性拉取全部数据。

**第二步：并发查每个对话的消息**

Supabase 不支持"按分组各取 N 条"的 SQL 语法（即 `PARTITION BY` + `ROW_NUMBER()`），所以只能对每个对话单独查询。关键是用 `Promise.all` 让这些查询并发执行：

```ts
const messagesPromises = conversationIds.map(async (convId) => {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: false })
    .limit(10)  // 每个对话只取最新 10 条
  return (data || []).reverse()  // 反转为正序显示
})

const messagesArrays = await Promise.all(messagesPromises)
```

假设有 10 个对话，每次查询 100ms，串行需要 1000ms，并发只需要约 100ms。

**第三步：用 Map 组装数据**

所有消息查回来后是一个扁平数组，需要按 `conversation_id` 分组再挂到对应对话上。用 `Map` 而不是嵌套 `filter`：

```ts
// 不好的写法：O(n*m)
conversations.map(conv => ({
  ...conv,
  messages: messages.filter(msg => msg.conversation_id === conv.id)
  // 每个对话都要遍历全部消息
}))

// 好的写法：O(n+m)
const messagesByConvId = new Map()
messages.forEach(msg => {
  if (!messagesByConvId.has(msg.conversation_id)) {
    messagesByConvId.set(msg.conversation_id, [])
  }
  messagesByConvId.get(msg.conversation_id).push(msg)
})

conversations.map(conv => ({
  ...conv,
  messages: messagesByConvId.get(conv.id) || []  // O(1) 查找
}))
```

先遍历一次消息建立索引，之后每次查找都是 O(1)，总复杂度从 O(n×m) 降到 O(n+m)。

---

**Q28：无限滚动的分页查询是怎么做的？**

A：用 `offset + limit` 实现，`fetchMessages` 函数签名是：

```ts
fetchMessages(conversationId, offset = 0, limit = 10)
```

对应的 Supabase 查询：

```ts
supabase
  .from('messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: false })  // 倒序，最新的先取
  .range(offset, offset + limit - 1)          // 分页范围
```

调用方式：
- 初始加载：`fetchMessages(convId, 0, 10)` → 取第 0-9 条（最新 10 条）
- 向上滚动：`fetchMessages(convId, 10, 10)` → 取第 10-19 条
- 再往上：`fetchMessages(convId, 20, 10)` → 取第 20-29 条

查询结果是倒序的（最新在前），返回前 `.reverse()` 一下变成正序，符合聊天界面从上到下的显示顺序。

`offset` 的值就是当前已加载的消息数量 `targetConv.messages.length`，不需要额外维护分页状态。

---

**Q29：怎么判断是否还有更多消息可以加载？**

A：两个地方都用了同一个约定：**如果返回的消息数量等于 limit（10），说明可能还有更多；如果小于 10，说明已经到头了**。

初始加载时：
```ts
hasMoreMessages: convMessages.length === 10
```

无限滚动加载时：
```ts
if (olderMessages.length === 0) {
  // 返回空数组，确定没有更多了
  setConversations(prev => prev.map(conv =>
    conv.id === convId ? { ...conv, hasMoreMessages: false } : conv
  ))
  return
}
// 返回了数据，根据数量判断
hasMoreMessages: olderMessages.length === 10
```

这个判断有一个边界情况：如果消息总数恰好是 10 的倍数，最后一次加载会返回 10 条，`hasMoreMessages` 仍为 `true`，用户再往上滚一次才会触发查询，发现返回空数组，才标记为没有更多。多一次空查询，但逻辑简单，是个合理的取舍。


---

## 十二、已知不足与可优化点

**Q30：这个项目你觉得还有哪些可以改进的地方？**

A：有几个我知道但还没做的点：

**1. 测试用的 1 秒人为延迟没有移除**

`useConversations` 里有一行：
```ts
await new Promise(resolve => setTimeout(resolve, 1000))
```
这是开发骨架屏时加的调试代码，生产环境应该删掉，或者改成只在 `NODE_ENV === 'development'` 时生效。

**2. Promise.all 没有并发限制**

50 个对话会同时发出 50 个数据库请求，数量大时可能触发 Supabase 的连接数限制。可以改成分批并发，每批最多 10 个请求。

**3. offset 分页在数据量大时性能退化**

`fetchMessages` 用的是 `offset + limit`，数据库需要扫描并跳过前 offset 条记录。消息很多时（比如 offset=500）性能会明显变差。更好的方案是游标分页，用最后一条消息的 `created_at` 作为游标：
```ts
// 当前：offset 分页
.range(offset, offset + limit - 1)

// 更好：游标分页
.lt('created_at', lastMessageCreatedAt)
.limit(10)
```
游标分页可以直接走 `created_at` 索引，性能稳定不随数据量增长。

**4. 没有 API 限流保护**

`/api/chat` 没有频率限制，任何人拿到域名都可以无限调用，消耗 API 额度。可以接入 `@upstash/ratelimit`，按用户 ID 或 IP 限制每分钟请求次数。

**5. 流式中断没有错误恢复**

网络抖动导致流中断时，用户只能重新发消息。可以在前端捕获中断错误，提示"生成中断，点击重试"，并保留已接收的部分内容。

---

## 十三、性能优化总结

**Q31：你在这个项目里做了哪些性能优化？**

A：分三个层面：

**渲染层**

- `React.memo` + 自定义 `areEqual`：流式输出时只有最后一条消息重渲染，历史消息全部跳过
- 骨架屏：首屏加载期间用占位 UI 代替空白，降低用户感知等待时间
- `dynamic` 懒加载 `SyntaxHighlighter`：代码高亮库体积大，只在需要渲染代码块时才加载，不影响首屏 bundle 大小

**数据层**

- 分页加载：对话列表限制 50 个，每个对话只预加载最新 10 条消息，不一次性拉取全量数据
- 无限滚动：历史消息按需加载，用户不滚动就不查询
- `Promise.all` 并发：多个对话的消息查询同时发出，总耗时约等于最慢那一个请求
- `Map` 分组：消息组装时间复杂度从 O(n×m) 降到 O(n+m)

**写入层**

- 流式输出期间只更新本地 state，流结束后才一次性写数据库，避免频繁写库
- `useCallback` 缓存函数引用，减少子组件因函数引用变化导致的不必要重渲染

**Q32：`dynamic` 懒加载具体能带来多大收益？**

A：`react-syntax-highlighter` 完整包含几百种语言的语法规则，压缩后也有几百 KB。如果直接 import，这部分代码会被打包进首屏 JS，用户打开页面就要下载这些代码，即使当前对话里根本没有代码块。

用 `dynamic` + `ssr: false` 之后，这个组件从首屏 bundle 里剥离出去，只有当页面上真正出现代码块时才异步加载。对于大多数普通对话，用户完全感知不到这个库的存在。

**Q33：`useCallback` 的依赖数组你是怎么管理的？**

A：根据函数内部实际用到的外部变量来决定。比如 `updateLocalLastMessage` 只用了函数式 `setConversations`，不依赖任何外部变量，所以依赖数组是空的 `[]`，函数引用永远不变。而 `saveMessage` 内部读取了 `conversations` 的值（判断是否需要更新标题），所以依赖了 `conversations`，每次对话列表变化时函数会重新创建。

依赖数组填错有两种问题：填少了会产生闭包陈旧值 bug，填多了会导致函数频繁重建失去缓存意义。


---

## 十四、未来扩展方向

**Q34：项目现在有"记忆"功能吗？**

A：有短期记忆，没有长期记忆。

看 `route.ts` 里的实现：

```ts
const { messages } = await request.json()
// ...
input: { messages: messages }  // 把完整对话历史都发给模型
```

每次发消息都把当前对话的完整历史传给通义千问，所以 AI 能记住同一个对话里说过的话，这是上下文记忆。

但有两个限制：
- 模型有 context window 上限，对话太长会超出 token 限制
- token 越多，每次调用越慢、越贵

跨对话的长期记忆（比如对话 A 说了"我是前端开发"，对话 B 里 AI 也能知道）目前没有实现。

**Q35：怎么给这个应用加长期记忆？**

A：两种方案：

方案一：摘要压缩。对话结束后，让 AI 把这次对话总结成几句话存到数据库，下次对话时把摘要注入到 system prompt 里。实现简单，但摘要会丢失细节。

方案二：向量检索。把历史对话内容向量化存储，每次新对话时把用户问题也向量化，检索最相关的历史片段注入上下文。精度更高，但实现复杂，这也是 RAG 的核心思路。

**Q36：什么是 RAG？怎么加到这个项目里？**

A：RAG（Retrieval-Augmented Generation，检索增强生成）的核心思路是：不把所有知识塞进 prompt，而是先检索再生成。

```
用户问题 → 向量化 → 检索知识库中相似内容 → 检索结果 + 问题 → AI 生成回答
```

加到这个项目里最典型的场景是知识库问答：用户上传 PDF 或文档，AI 只基于这份文档回答问题。

实现步骤：
1. 文档切片 + 调用 Embedding API 向量化，存入向量数据库
2. 用户提问时，把问题向量化，做相似度检索（余弦相似度）
3. 把检索到的文档片段拼进 system prompt，让 AI 基于这些内容回答

Supabase 自带 `pgvector` 扩展，支持直接在 PostgreSQL 里存向量和做相似度查询，不需要引入 Pinecone 等额外的向量数据库服务，在现有数据库里加一张 `embeddings` 表就能实现。

**Q37：除了 RAG，还有哪些功能可以扩展？**

A：
- 多模态输入：通义千问支持图片理解，可以让用户上传图片提问
- 对话分享：生成公开链接，让其他人可以查看某个对话
- Prompt 模板：预设常用的 system prompt，比如"代码审查助手"、"翻译助手"，用户一键切换角色
- 流式中断恢复：流式输出中断时保留已接收内容，支持点击重试
- API 限流：按用户 ID 限制每分钟请求次数，防止 API 额度被滥用



---

## 十五、开发中遇到的问题

**Q38：开发过程中有没有遇到什么工程上的问题？**

A：有一个变量命名混乱的问题。项目里有 4 个 loading 相关的状态，分散在不同的 Hook 和组件里，开发到后期经常搞混：

| 变量名 | 位置 | 含义 |
|--------|------|------|
| `loading` | useAuth | 检查用户登录状态中 |
| `isLoading`（重命名为 `isLoadingSkeleton`）| useConversations | 对话列表从数据库加载中 |
| `isLoadingMessage` | page.tsx | AI 流式回复进行中 |
| `isLoading` | MessageList 内部 | 无限滚动加载历史消息中 |

问题在于 `loading`、`isLoading`、`isLoadingMessage` 这几个名字太相似，在 `page.tsx` 里同时用到多个时很容易看错。

解决思路是让命名能自解释，一眼看出它在等什么：

```ts
// 改前
loading          → isAuthChecking
isLoading        → isConversationsLoading  
isLoadingMessage → isAIResponding
isLoading        → isLoadingMoreMessages  （MessageList 内部）
```

更通用的命名规范是：`is + 动作/状态 + ing/ed`，比如 `isFetching`、`isSubmitting`、`isStreaming`，让变量名本身就能说明它在等什么操作完成，不需要看上下文才能理解。
