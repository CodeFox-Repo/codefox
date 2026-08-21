---
name: codefox-remote
description: Talk to a project's agent on a remote CodeFox instance from this terminal — send a message, watch the turn, read the reply, and get the links to fetch what was built. Use when the user mentions a codefox project, asks to "let codefox build X", wants the status of a codefox project, or wants to look at a codefox preview / share link.
---

# codefox-remote

CodeFox 项目跑在远端,这个 skill 让本地 agent 用 curl 跟它对话、查进度、拿链接。
端点设计见仓库里的 `docs/remote-agent-api.md`。

## 安装

复制到 Claude Code 的 skills 目录:

```bash
mkdir -p ~/.claude/skills/codefox-remote
cp docs/skills/codefox-remote/SKILL.md ~/.claude/skills/codefox-remote/SKILL.md
```

配置两个环境变量(写进 `~/.zshrc` 或每次 export):

```bash
export CODEFOX_API=https://api.codefox.dev     # 后端地址,本地开发是 http://localhost:8080
export CODEFOX_TOKEN=<access token>            # 见下面「拿 token」
```

Codex / Cursor 用同一套 curl,把这一页贴进 `AGENTS.md` 即可。

## 拿 token

access token 走 GraphQL `login`,有效期 30 分钟;`refreshToken` 续期。

```bash
codefox_login() {
  curl -s "$CODEFOX_API/graphql" -H 'content-type: application/json' \
    -d "{\"query\":\"mutation(\$i:LoginUserInput!){login(input:\$i){accessToken refreshToken}}\",
         \"variables\":{\"i\":{\"email\":\"$1\",\"password\":\"$2\"}}}" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]["login"]; print(d["accessToken"]); print(d["refreshToken"],file=sys.stderr)'
}
export CODEFOX_TOKEN=$(codefox_login you@example.com 'your-password')
```

401 就是 token 过期了,重新登录或:

```bash
curl -s "$CODEFOX_API/graphql" -H 'content-type: application/json' \
  -d "{\"query\":\"mutation{refreshToken(refreshToken:\\\"$CODEFOX_REFRESH\\\"){accessToken}}\"}"
```

**不要把 token 写进仓库里的文件,也不要 echo 到会被保存的日志里。**

## 五个动作

所有请求都带 `Authorization: Bearer $CODEFOX_TOKEN`。只能操作自己的项目。

```bash
cfx() { curl -sS -H "Authorization: Bearer $CODEFOX_TOKEN" "$@"; }
```

### 1. 列项目

```bash
cfx "$CODEFOX_API/api/agent/projects"
```

返回 `projects[]`:`id`(下面所有调用都用它)、`projectName`、`template`
(`html` = 单页,`next` = app)、`isPublic`、`scaffolded`、`running`。

### 2. 查状态

```bash
cfx "$CODEFOX_API/api/agent/projects/$ID"
```

- `scaffolded: false` —— 还在建工作目录(或建失败了),这时候发消息会被拒。
- `running: true` —— 有一轮 turn 正在跑(或排队中)。
- `lastTurn` —— 上一轮的结果:`errored` / `errorText` / `durationMs` /
  `toolCalls` / `sha`。**turn 失败时对话里不会多出一条 assistant 消息,失败原因
  只在这里。**

### 3. 发消息

```bash
cfx -X POST "$CODEFOX_API/api/agent/projects/$ID/messages" \
    -H 'content-type: application/json' \
    -d '{"message":"把首屏标题改成中文,副标题跟着改"}'
```

立刻返回 `{"status":"started"|"queued", ...}`,turn 在后台跑。可选
`"model":"..."` 覆盖这一轮的模型。

一轮常跑 1–10 分钟。轮询到 `running` 变 false 再读回复:

```bash
until [ "$(cfx "$CODEFOX_API/api/agent/projects/$ID" | python3 -c 'import json,sys; print(json.load(sys.stdin)["running"])')" = "False" ]; do
  sleep 15
done
```

### 4. 读对话

```bash
cfx "$CODEFOX_API/api/agent/projects/$ID/messages?limit=4"
```

最后一条 `role: assistant` 就是这轮的回复。

### 5. 拿链接 / 抓页面

```bash
cfx "$CODEFOX_API/api/agent/projects/$ID/links"
```

| 字段 | 是什么 | 怎么抓 |
| --- | --- | --- |
| `share` | 公开 page 项目的分享页 | 匿名 GET,直接 curl |
| `live` | 公开 app 项目,访问会唤醒沙盒 | 匿名 GET,冷启动可能要一分钟 |
| `entry` | page 项目的 `index.html` 内容 | 带 token GET,返回 `{filePath, content}` |
| `files` | 文件树 | 带 token GET |
| `preview` | dev server 地址,要 `?start=1` 才启动 | `requiresPreviewCookie: true` 时这条 URL 远程抓不到,改用 `entry`/`share` |

私有项目没有 `share`/`live`(是 `null`),想看内容就走 `entry`:

```bash
cfx "$CODEFOX_API/api/agent/projects/$ID/links" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["entry"])' \
  | xargs -I{} curl -sS -H "Authorization: Bearer $CODEFOX_TOKEN" {}
```

## 用法约定

- **一次一轮。** 同一个项目上一轮没跑完就发下一条,新的会排队;账号同时最多 3 轮。
- **发消息前先看 `running` 和 `lastTurn.errored`**,不然会把上一轮的失败当成"没反应"。
- **改动是真的写进项目的**,每轮会自动提交一个版本;要回退用产品里的 Changes 面板。
- 建项目、删项目、改公开状态不在这套端点里,去网页上做。
