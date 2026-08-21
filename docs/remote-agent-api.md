# 让本地 coding agent 操作远端 CodeFox 项目

一页设计摘要 + 端点清单。实现在 `backend/src/chat/agent-api.controller.ts`,
配套 skill 在 `docs/skills/codefox-remote/SKILL.md`。

## 要解决的事

本地终端里的 agent(Claude Code / Codex / Cursor)想做三件事:

1. 跟某个 codefox 项目的 agent 对话——发一条消息,拿到回复;
2. 知道现在到哪一步了——项目还在生成吗、有没有 turn 在跑、上一轮结果如何;
3. 拿到能抓的链接——share / live / 文件内容 / preview,自己去读页面。

## 选型:REST + skill,不是 MCP server

首选方案本来是挂一个 streamable-HTTP 的 MCP server。放弃它的理由:

- **传输层不是这件事的难点。** 难点是"无浏览器地跑完一轮 turn 并把回复落库",
  这段逻辑两种形态完全一样。MCP 只多出协议依赖(`@modelcontextprotocol/sdk`,
  backend 目前一个 MCP 依赖都没有)、session/transport 装配、以及一层
  auth 桥接。
- **通用性差距没有想象中大。** 每个 coding agent 都能跑 shell,curl 一个带
  Bearer 的 REST 端点是所有 runtime 的最小公倍数;Codex/Cursor 不需要 MCP 才
  能用。
- **这些端点是 MCP-wrappable 的。** 五个端点一一对应 list_projects /
  get_project_status / send_message / get_messages / get_preview_links,真要
  MCP 的时候写一个薄壳(stdio 或 http)转发即可,不用回头改这一层。

代价写在这里:MCP 客户端里没有 tool 形态的自动发现,得靠 skill / AGENTS.md 告诉
agent 这些端点存在。

## 复用而不是重造

新增的只有一个 controller 和一个"无浏览器的 Response"适配器,业务逻辑全部走既
有 service:

| 需要的能力 | 复用的东西 |
| --- | --- |
| 跑一轮 agent turn | `ChatController.chat()` —— 队列、快照、turn 记录、看门狗、错误解释全在里面 |
| 存消息 / 读历史 | `ChatService.saveMessage` / `getChatHistory` |
| 项目列表、归属 | `ProjectService.getProjectsByUser` / `getProjectById` |
| 是否有人在写这个项目 | `project-queue.busy()` / `atTurnLimit()` |
| 上一轮 turn 的结果 | `AgentTurn` 表(kind='turn') |
| preview 地址 | `WorkspaceService.for(path).startPreview()` |
| share / live 地址 | `ShareController` / `LiveController` 的既有 URL 形状 |

唯一新写的机制是 `headless-turn.ts`:`ChatController.runTurn` 把 NDJSON 事件写进
一个 express `Response`,浏览器负责把最终回复存进 chat。没有浏览器的时候需要有人
接住这两件事——`HeadlessResponse` 就是那个假的 `Response`:吃掉事件流、还原出
`reply` 和 `steps`,turn 结束后由 controller 调 `saveMessage` 落库,和浏览器做的
事一模一样。它只实现了 `runTurn` 真正碰到的那几个成员(setHeader / write / end /
on / status().json() / headersSent / writableEnded / destroyed)。

## 认证

沿用现有 JWT:`@UseGuards(JWTAuthGuard)`,`Authorization: Bearer <accessToken>`。
没有新增无鉴权端点,也没有新增 API key 表——access token 由 GraphQL `login`
mutation 签发(30 分钟),`refreshToken` mutation 续期,`jwt-cache` 里的注销依然
生效。所有端点都是**只对项目 owner 开放**:按 project id 查行再比 `userId`,
public 项目的匿名读走既有的 `/share`,不从这里开口子。

## 端点

前缀 `/api/agent`。全部要 Bearer token。

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/agent/projects` | 我的项目列表(id、名字、template、是否公开、chatId、是否在跑) |
| GET | `/api/agent/projects/:id` | 状态:是否还在建目录、是否有 turn 在跑、消息数、最近一轮 turn 的结果 |
| POST | `/api/agent/projects/:id/messages` | 发一条消息;立刻返回,turn 在后台跑 |
| GET | `/api/agent/projects/:id/messages` | 对话历史(默认最近 20 条) |
| GET | `/api/agent/projects/:id/links` | share / live / 文件读取 / preview 链接 |

### 为什么发消息是异步的

一轮 turn 常常跑 5–10 分钟。同步阻塞会撞上 MCP/工具调用超时,也撞上 Bash 工具的
超时。所以 `POST .../messages` 立刻返回 `{ chatId, status: 'started' }`,本地
agent 轮询 `GET /api/agent/projects/:id` 直到 `running: false`,再读
`GET .../messages` 拿回复。turn 失败时回复可能是空的,失败原因在状态里的
`lastTurn.errored / errorText`——不伪造一条 assistant 消息塞进对话。

`running` 同时看 `project-queue.busy()` 和本层自己的在途集合:POST 返回到 turn
真正进队列之间有一个 await 的缝,只看 busy() 会在那一瞬报"空闲",本地 agent 会
以为跑完了。

### preview 链接的诚实说明

`links?start=1` 才会去启动 dev server(冷启动最长 90s,不该被一个只想看链接的
调用触发)。host 模式下 preview 是走 cookie 的反代,返回体里
`preview.requiresPreviewCookie: true` 明说这条 URL 远程 curl 不到;能直接抓的是
`share`(公开的 page 项目)、`live`(公开的 app 项目)和 `entry`/`files`(带
token 读文件)。"部署链接"目前没有可返回的东西:`deployProject` 用的是用户自己的
Vercel token,结果 URL 没有落库。

## 怎么验

```bash
BASE=http://localhost:8080 node scripts/e2e-agent-api.mjs
```

注册 → 建项目 → 列项目 → 发消息 → 轮询 → 读回复 → 拿链接 → 真的把页面抓下来,
外加"别人的项目 403 / 伪造 token 401"。会跑一轮真的 agent turn,花模型 token。

## 没做的事

- MCP server(理由见上;要的话在这五个端点外面套一层)。
- 流式返回 turn 过程。轮询状态够用,少一条协议。
- 建项目 / 删项目 / 改公开状态。GraphQL 已经有,本地 agent 需要时再开。
