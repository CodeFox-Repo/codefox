# Deploying CodeFox

Frontend on Vercel, backend on Railway. The backend cannot be serverless: an
agent turn streams for minutes and a function's execution limit cuts it off.

Everything below is already created. What is left is the variables marked
**SET THIS** — they are credentials or account-specific, so they are not in
the repo.

## Backend — Railway

Project `codefox`, service `backend`, deploying `CodeFox-Repo/codefox@main`.

Already set:

| Variable | Value | Why |
| --- | --- | --- |
| `NODE_ENV` | `production` | Closes sign-up, quiets logging |
| `PORT` | `8080` | |
| `JWT_SECRET`, `JWT_REFRESH` | generated | |
| `SALT_ROUNDS` | `10` | Must match what existing hashes used |
| `DB_SYNCHRONIZE` | `true` | **Remove after the first boot.** There are no migrations, so the first deploy needs this to create the schema. Left on, TypeORM will drop a column to match an entity. |
| `MAIL_ENABLED` | `false` | Accounts are confirmed on creation |
| `SANDBOX_PROVIDER` | `host` | See "Before opening sign-up" |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | |

Also worth setting:

| Variable | Default if unset | Why |
| --- | --- | --- |
| `FRONTEND_URL` | `http://localhost:3000` | **Every password-reset and email-confirmation link is built from this.** Unset on a real deploy, the link points at localhost — a dead link whose only symptom is a user who cannot get back in. |
| `MAX_PROJECTS_PER_USER` | `20` | Per-account project cap; create and fork share it. |
| `MAX_TURNS_PER_USER` | `3` | Concurrent agent turns per account. The per-project queue does not bound this on its own. |

**SET THIS — the agent will not run without it:**

```
ANTHROPIC_API_KEY=sk-ant-...
```

The agent is the real Claude Code CLI driven through the AI SDK harness, so it
needs an *Anthropic-compatible* endpoint. Two other options:

- **OpenRouter.** It does serve an Anthropic-style `/v1/messages` (verified: a
  bogus path there returns 404, that one returns a JSON 401), so
  `ANTHROPIC_BASE_URL=https://openrouter.ai/api/v1` plus your OpenRouter key
  in `ANTHROPIC_API_KEY` is worth trying. Untested against the CLI's full
  protocol use — streaming, tool calls, system prompts — so try it before
  relying on it.
- **Your own proxy**, if it is reachable from Railway. The local
  `127.0.0.1` one in `.env` is not.

`LLM_API_KEY` (any OpenAI-compatible endpoint, OpenRouter by default) is
optional and separate: it powers the Enhance button, project auto-naming, and
chats with no project. Without it those three degrade; the agent is unaffected.

**SET THIS if you want projects to survive a deploy:**

```
CODEFOX_DATA_DIR=/data
```

...and mount a Railway volume at `/data`. Generated projects, uploaded media
and the SQLite file all live there. Without it a redeploy replaces the
container filesystem and every project is gone.

## Frontend — Vercel

Project `codefox`, connected to the same GitHub repo. Set these to the
backend's public Railway domain:

```
NEXT_PUBLIC_BACKEND_URL=https://<backend>.up.railway.app
NEXT_PUBLIC_GRAPHQL_URL=https://<backend>.up.railway.app/graphql
NEXT_PUBLIC_GRAPHQL_WS_URL=wss://<backend>.up.railway.app/graphql
```

Optional: `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true` — without it both auth
modals hide the Google button rather than bounce you to a Google error page.

## Accounts

Sign-up is closed in production, so create accounts directly:

```
node scripts/create-user.mjs <email> <password> [username]
```

It goes through the same bcrypt hashing the login path verifies against — a
hand-written SQL row has to reproduce that hash format exactly or the account
simply cannot log in.

## Before opening sign-up

`SANDBOX_PROVIDER=host` runs the agent in a scoped working directory with the
backend process's privileges. That is fine while every account is one you
created, and hands the server to anyone who registers if sign-up is open.

Opening it up needs `SANDBOX_PROVIDER=vercel`, which puts each session in a
real microVM. The provider works — one persistent named sandbox per project,
files verified to survive between sessions — but the file tree, editor,
download and fork still read the backend's own disk, so a remote session shows
an empty project. That plumbing is the remaining piece.
