# Handoff — 2026-07-28

State of the product as of this session. Facts and open questions only; no
proposed fixes.

## Read this first — overnight loop summary (03:00–10:00)

Everything below deployed to prod (Railway + Vercel) and verified by the
27-node E2E suite (`npm run e2e`, host mode, **27/27 green**).

Shipped tonight, in rough order of weight:
- **HTML light mode** is the default project kind: single-file scaffold, srcdoc
  preview (no servers), agent on host, covers via puppeteer file:// fallback.
- **Robustness**: harness reconnect notices no longer kill a recovering turn;
  bad /chat?id= links say so instead of an empty composer; mid-turn failures
  toast a readable sentence; the home grid refreshes itself (its invalidation
  flag had died with the sidebar).
- **UI truth & polish**: fox favicon; per-project tab titles; real user
  avatars in chat; project-kind badges on home cards; "Show all N" past nine
  projects; anonymous Fork explains sign-in; landing copy caught up with the
  two-starter reality; one-model pickers hidden everywhere.

Still waiting on Jackson:
- **Vercel sandbox quota 402** — blocks prod Next-mode agent turns; raise the
  cap in the Vercel console, then re-run the suite in vercel mode.
- `frontend/src/components/sidebar.tsx` is dead (no importers) — delete when
  convenient (deletion needs your say-so).
- Browser-based visual QA queue (agent-browser daemon wedged all night):
  question card, changes panel, stacked messages, mobile switcher.
- Before opening registration: html projects run the agent on the host
  (documented tradeoff) — seed-a-sandbox is the prerequisite.

## Where things run

| Piece | Where | Notes |
|---|---|---|
| Frontend | Vercel, `codefox.sma1lboy.me` | custom domain live, HTTPS issued |
| Backend | Railway, `backend-production-88a19.up.railway.app` | Nest, single container |
| Database | Railway Postgres | 1 real account + 1 demo |
| Model | Azure OpenAI `gpt-5.4-mini` | eastus2, DataZoneStandard, 1000K TPM |
| Project sandbox | **Vercel microVM** | switched this session; see "In flight" |

The OpenRouter account it previously used is exhausted ($0.07 left). Its key is
still valid and still configured nowhere — worth revoking.

The Azure credit is the Microsoft for Startups $1,000, expiring 2026-10-25.

## What changed this session

Roughly 40 commits. Three themes.

**Security.** Seven separate holes, all closed and verified in production:
forged tokens were accepted as valid; the file APIs had no authentication at
all (anonymous read *and write* of any project); preview and screenshot were
equally open; the screenshot endpoint was a working SSRF proxy; plaintext
passwords and live bearer tokens were being written to logs; logging out did
not end a session; an unauthenticated endpoint could delete any account by
email. Uploads were also accepted on the strength of a claimed MIME type.

**Features that were dead.** Project covers (broken in three independent
places, so no project ever had one), the public gallery (empty by
construction), conversation memory (the agent saw only the current message —
every follow-up had no referent), stop/abort (leaked an agent process per
click), and reply persistence (a turn the user walked away from lost its
answer while keeping its file changes).

**Resource leaks.** Deleting a project left its files, its chats and its dev
server behind. Previews were never reclaimed. Every agent turn leaked a
symlink; every avatar change leaked a file.

## In flight

**The sandbox switch is half-verified.** Production is on
`SANDBOX_PROVIDER=vercel`. File tree, file read and file write are confirmed
working against real migrated projects. **Starting a preview returns 500 after
about two minutes and has not been diagnosed.** Everything else — agent turns,
screenshots, download, delete — is verified locally in this mode but *not* in
production.

The four pre-existing projects were copied into sandboxes before the switch;
their real generated code is intact (verified by file contents, not just file
counts). Their old copies are still on the Railway volume, untouched.

Rolling back is one variable: `SANDBOX_PROVIDER=host`. The host path is
unchanged and was regression-tested end to end.

**Two other sessions are editing this same checkout** — one on UI polish and
streaming output, one on an admin dashboard. Expect churn in
`frontend/src/components`, `roles.guard.ts`, `user.resolver.ts` and the build
script.

## Known open

- Preview under the remote sandbox (above) — the one thing blocking a clean
  claim that the switch is done.
- **Registration is closed.** It was closed because the agent ran with the
  backend's own privileges; the sandbox switch is what makes opening it
  defensible, so this decision should be revisited once the preview works.
- The site has no favicon. The existing logo is a thin-line mark on
  transparency and is hard to read at tab size; a fork session is on it.
- A project directory was once observed emptying itself with no clear cause.
  Never reproduced, never explained. A watcher is still armed.
- `.agent-runs` accumulates session state that nothing reads back.
- `getHello` and `isValidateProject` have no callers.
- An unreachable "new project" modal exists in the frontend and would fail if
  reached — it still sends a field the API removed.

## Things worth knowing before touching this

- **The Vercel sandbox SDK does not read `VERCEL_TOKEN` from the
  environment.** Credentials are passed explicitly or come from OIDC.
- **The preview proxy has to be mounted before Nest's router**, because Nest
  answers unmatched paths itself rather than passing them on. It therefore has
  to decline this server's own routes by hand.
- **Verifying with curl alone missed a whole class of bug this session.** The
  preview cookie only exists in a browser, and its absence hid a failure that
  made the product unusable. Nothing in this session was checked in a real
  browser.
- The shell on this machine exports a malformed `NODE_ENV`, which the backend
  rejects at boot. Local runs need it set explicitly.
- Railway builds fail intermittently on a workspace binary that is not on
  PATH; a retry usually succeeds.

## Credentials in play

`VERCEL_TOKEN` in Railway is **the developer's personal CLI token**, taken from
the local Vercel CLI login. It carries full account access and is not scoped to
this project. It works, but a scoped token generated in the dashboard would be
the right thing to replace it with.

## Overnight session — 2026-07-28 (feature-death audit)

Every user-facing feature was walked in a real browser against the local stack
(vercel-sandbox mode, Azure gpt-5.4-mini). Working and verified: console tab,
copy-project-id, public/private toggle, download (zip verified), code edit +
save (persists to the sandbox), preview + all its controls, cover screenshots
(end-to-end into the gallery card), gallery, chat rename, clear history,
settings, theme toggle, Enhance, sidebar nav, new chat/new project.

Fixed this session:
- **First turn from the home page never ran** — the prompt was saved
  server-side and nothing triggered the agent. The chat page now shows a
  thinking indicator immediately, starts the turn once the project binds, and
  silently retries (10×6s) while the sandbox is still provisioning — creation
  races the sandbox and the first attempt is often rejected.
- **Preview pane** said "Error initializing preview" / toasted "failed" while
  the dev server was still booting; now says not-ready and retries every 5s.
- **Delete chat did nothing** — the confirm dialog was closed by the closing
  dropdown in the same tick (Radix race). Opens via setTimeout(0) now; delete
  verified end-to-end.
- **Dead message buttons** (copy/delete/regenerate/thumbs had no onClick, edit
  only rewrote the local array): copy is real now, the rest were removed.
- **The model picked at creation now sticks**: stored on the chat
  (Chat.model, new nullable column), returned by getChatDetails, and used for
  the auto-started first turn and later sends. Before, every chat silently ran
  models[0]. There is still no in-chat model picker (setSelectedModel plumbing
  exists, no UI).
- Empty file listings are now errors: a workspace that cannot list (missing
  host dir, failed sandbox `find`) throws instead of answering "no files" with
  a 200. This was the likely mechanism behind "project directory emptied
  itself": the tree replaced itself with nothing whenever the backend was in
  the wrong sandbox mode. The sandboxes themselves were intact all along.
- Download temp zip now unlinks on stream close (covers mid-download
  disconnects); the orphan duplicate download.controller.ts stays deleted.
- Removed dead code: getHello (AppResolver), isValidateProject (+ DTO, guard
  branch), the unreachable new-project modal (+ createNewProject in the
  context). schema.gql / type.tsx regenerated.
- Dev-only auth toggle moved out of the bottom-right corner (it sat exactly on
  the SaveChangesBar's Save button) and its aria-label no longer collides with
  the Preview tab.

Known open, discovered tonight:
- The local cli-proxy (port 8317) fails every codex-harness turn: its
  /v1/responses streaming disconnects ~5s in, both models, while
  /v1/chat/completions works. The proxy is not part of this repo; the local
  backend was switched back to the Azure env (values recoverable via
  `railway variables --json`; see the session memory).
- bindProjectAndChat calls connection.synchronize() on every bind — a
  schema-sync per project creation, on SQLite a full table-recreate dance.
  Untouched tonight; worth removing deliberately.
- The models dropdown caches in sessionStorage for an hour, so backend model
  changes don't show until it expires or storage is cleared.
- .agent-runs still accumulates unread state (unchanged).

## Overnight rounds 2–3 — 2026-07-28 早

**Security: the GraphQL chat API had no ownership checks.** Any signed-in
user could read, rename, clear, delete or inject messages into anyone's chat
by id (`getChatHistory`, `getChatDetails`, `deleteChat`, `clearChatHistory`,
`updateChatTitle`, `saveMessage` all ran on `@JWTAuth()` alone). The existing
ChatGuard was GraphQL-aware the whole time — it was just never attached.
All six now run `@UseGuards(JWTAuthGuard, ChatGuard)`; verified cross-user
denial + own-chat access by hand. ChatGuard also no longer 500s on anonymous
operations (`info.operation.name?.value`).

Admin console (user-requested):
- `/admin` no longer renders the personal chat sidebar (root-layout path check).
- New role-gated `adminSetProjectPublic` + make public/private buttons per
  project row — the owner-gated updateProjectPublicStatus was why admins
  "had no permission" to edit visibility. Verified against another user's
  project, DB confirmed both directions.
- `onDisk` no longer brands every sandbox-mode project "no files".

Features added and verified:
- **In-chat model picker** (bottombar, next to attach; hidden when only one
  model is configured). Switching persists via new `updateChatModel`
  (guarded, validated against AVAILABLE_MODELS) — reload keeps the choice,
  the next turn uses it.
- **Regenerate** on the trailing assistant reply: new guarded
  `dropLastAssistantReply` soft-deletes the stored answer, the turn re-runs
  via the same path as the auto first turn. Verified: old answer soft-deleted
  in the chat JSON, replacement saved, UI swaps live.
- Image attachments verified working end-to-end (agent read a staged image's
  color correctly); removed the stale "agent cannot read them yet" banner.
- "Have feedback?" was a dead span; now links to the GitHub issues page.
- Harness model fallback: a chat carrying a model the endpoint no longer
  serves falls back to the default instead of 404ing every turn forever
  (hit this live: only `gpt-5.4-mini` is actually deployed on the Azure
  resource — `gpt-5.4` appears in /v1/models but 404s as a deployment).

Still open: `.agent-runs` is written by @ai-sdk/harness itself (924KB/22 dirs,
already excluded from listings/zips) — clearing it is a delete-policy call.
Prod deploy note: Chat.model column needs one DB_SYNCHRONIZE=true boot or a
manual ALTER; picker stays hidden in prod until LLM_MODELS lists >1 real
deployment.

## Deployed — 2026-07-28 00:31 PT

All of tonight's work (9 commits, d552df8..46e647d) is live in production.

- Backend: Railway auto-deployed from the push; `chat.model` column created
  via a one-boot DB_SYNCHRONIZE=true (verified in Postgres:
  information_schema shows `model | YES`), then the flag was set back to
  false and the service redeployed clean.
- Frontend: the **`codefox` Vercel project is git-connected** and deployed
  both pushes automatically (aliased to codefox.sma1lboy.me). The separate
  `frontend` Vercel project is a stale manual one — its deploys fail on
  `npm install` (the repo is a pnpm workspace) and nothing is aliased to it;
  candidates for deletion. `frontend/vercel.json` now pins
  `npx pnpm@10 install` for anyone deploying that directory standalone.
- Prod smoke: landing 200, graphql alive, public gallery returns data,
  anonymous getUserChats denied ("Authorization header is missing" — the
  default-deny guard is live), models query public, /admin route serves.

GraphQL 与 REST 的取舍:按 Jackson 的判断保留 GraphQL,but the surface is
now default-deny (`@Public()` allowlist: login/register/refresh/checkToken/
confirmEmail/resendConfirmation/fetchPublicProjects/getAvailableModelTags).
A forgotten guard now fails closed. Full REST migration remains an option;
estimated as a dedicated multi-day effort across ~35 operations + Apollo
removal.

## Incident + hotfix — 2026-07-28 ~01:10

The default-deny deploy broke the **anonymous** landing page: an infinite
reload loop (black screen). Signed-in users were unaffected, which is why the
smoke test missed it — the smoke curled APIs but never rendered the page as a
tokenless browser.

Chain: anonymous load → `registrationOpen` query (not marked @Public — it is
not an async method and the annotation sweep only matched `async` resolvers)
→ UNAUTHENTICATED → Apollo's tokenRefreshLink treats every auth error as "a
session to refresh" → refresh fails (no session ever existed) → clears
storage and `window.location.href = '/'` → reload → repeat.

Fix (e17467b): `registrationOpen` is @Public; the refresh link only engages
when a refreshToken actually exists, and never redirects when already on `/`.
A missed @Public now degrades to a console error on one query instead of
taking down the landing. Full resolver audit table checked — everything else
is either @Public deliberately or guarded (admin ops are class-level guarded).

Lesson recorded: prod smoke must include "anonymous browser renders the
landing" — curl cannot see a client-side reload loop.

Resolution verified 01:20: the anonymous landing renders on
codefox.sma1lboy.me (fresh browser profile, hero + Sign In + gallery). The
lingering "still black" readings after the fix were an agent-browser
artifact — a freshly launched headless session's first navigation can land
on about:blank; the second navigation renders. The real loop was confirmed
gone from the network log (single document load, graphql 200s) before that.

## Round 5 — 2026-07-28 ~01:40

- **Forks were silently empty in sandbox mode** (b198775, deployed): the copy
  step read the host disk, found nothing, and the scaffold fallback handed
  every fork a fresh template. Forks now zip the source workspace (the
  download machinery) and unpack it into the fork's sandbox. Verified via
  API: a fork of the fox-emoji project contains the fox-emoji edit.
- Sign-up flow works end to end locally; with MAIL_ENABLED=false the backend
  sensibly lets unverified accounts log in, but the UI still claims
  "Verification Email Sent" — cosmetic lie, unfixed.
- Open: after a successful in-browser fork the UI stayed on the workbench
  with an empty RECENT instead of navigating to the forked chat — mutation,
  refetch and rows all succeed server-side; needs a fresh browser session to
  chase (both agent-browser and the Chrome extension degraded tonight,
  agent-browser first-nav-after-launch lands on about:blank).
- Throwaway local account auditor@codefox.test / AuditPass!2026 (owns two
  test forks) — safe to delete.

## Round 6 — 2026-07-28 ~01:50

- fb7c5ca (deployed): the sign-up success screen now asks the backend
  (`emailVerificationRequired`, public) whether a verification mail actually
  goes out. Mail-disabled deploys say "Account created — you can sign in
  now" instead of pointing the user at an inbox that will stay empty; the
  resend button and the blue verification box hide too.
- Browser tooling died for the night (agent-browser daemon wedges +
  about:blank first-nav; Chrome extension "different extension" errors), so
  the remaining UI verifications are queued for a fresh session: post-fork
  navigation, avatar upload, stop button mid-turn, Google OAuth button
  audit (backend GoogleStrategy exists, frontend shows a Continue-with-Google
  button — untested end to end).

## Round 7 — 2026-07-28 ~02:00

- 76f562d (deployed): "Continue with Google" hides in both auth modals unless
  the backend actually holds GOOGLE_CLIENT_ID + GOOGLE_SECRET (new public
  `googleAuthAvailable`). Neither local nor prod has them, so the button was a
  guaranteed dead end (the strategy boots on placeholder credentials). The
  OAuth plumbing itself is kept — configure the env and the button returns.
- UI verification for rounds 6–7 is by type-check + pattern parity only: both
  browser tools were still broken for interaction (agent-browser CDP
  timeouts; the Chrome extension throws "Cannot access a chrome-extension://
  URL of different extension" on click/js — possibly a conflicting extension
  like Jam injecting frames). Re-verify visually in a fresh session:
  sign-up copy branch, hidden Google buttons, fork navigation, avatar
  upload, stop button.

## Round 8 — 2026-07-28 ~02:15

- 0bf2b2b (deployed): removed the SETTING / NEW_PROJECT window-event plumbing.
  NEW_PROJECT had no dispatcher; SETTING's only listener set chatId to the
  literal string 'setting' (polling a bogus id) on a page that was being
  navigated away from anyway.
- The post-fork "RECENT: Nothing yet" screenshot is explained and benign:
  the workbench lists CHATS via cache-first, and the login-time cache was
  empty — fork itself succeeded. The only remaining question is why
  router.push('/chat?id=…') didn't land; needs a live browser.
- agent-browser stayed dead even after killing 18 orphaned headless Chrome
  processes (daemon CDP timeouts persist). Machine likely wants an
  `agent-browser upgrade` or a reboot of the tool in daylight.

## Round 9 — sandbox cost leak — 2026-07-28 ~02:20

Jackson flagged the Vercel sandbox bill. Findings and actions:

- Four sandboxes had been RUNNING for hours (2x CPU · 4 GiB each) with
  future expiry times measured in HOURS despite timeout: 10 min. Root cause:
  **`extendTimeout(ms)` is cumulative** — "extends BY", not "extends TO" —
  and `sandboxHandle()` called it on every touch. A busy session (agent
  turns, file reads, polls) banked +10 min per call; tonight's testing bought
  one sandbox 4.6 extra hours of paid runtime.
- Immediate: all four running sandboxes stopped via the SDK (persistent
  snapshots keep their files; next use resumes them).
- Fix (5467f56, deployed): the deadline is only topped back up to IDLE_MS
  when remaining life drops below half — extension is now at most one call
  per 5 minutes per sandbox, and the ceiling is always ~10 minutes of
  remaining life. Sandboxes now die ~10 min after the last real touch, which
  the stopped rows in the dashboard show Vercel honors.
- Storage note: ~20 stopped sandboxes/snapshots accumulate (mostly tonight's
  test projects). Deleting them = deleting those projects' files — needs an
  explicit decision; the admin "delete project" path already reclaims the
  sandbox when used.

## Loop round 1 (cron c24f105f, every 30m until 10:00) — ~02:30

- Branded the auth-gate LoadingPage (pulsing FoxMark + wordmark, dead theme
  ternaries removed) — it used to be a generic spinner that read as a broken
  page whenever auth validation lingered.
- Chat empty-state copy now describes the product ("edits this project's real
  files, preview updates beside you") instead of generic chatbot talk.
- Browser tooling still dead (probe timed out); username editing on settings
  queued as a next-round direction.

## Planner / ask-user-question flow — 2026-07-28 ~03:05 (a81fa2b, deployed)

Jackson's ask: the agent should plan first — confirm what the user wants via
structured choices (checkboxes etc.) before actually building, and the
composer should step aside while the question is open.

Design: no new API. The system prompt tells the agent that on a project's
first message, when real product choices are open, it replies with ONLY a
fenced ```codefox-questions``` JSON block (intro + 2-4 questions, each 2-5
options, multi flags, user's language). The frontend:
- extractQuestions() parses the block out of assistant messages
  (question-card.tsx); prose renders as markdown, the block as a QuestionCard
  (single = pick one, multi = toggles, optional free-text note, and a
  "Skip — let the agent decide" escape so a broken card can't dead-end).
- The card is interactive only as the trailing message; in history it renders
  read-only. TurnTrail text steps get the block stripped.
- While an unanswered card is trailing, the ChatBottombar hides behind
  "Answer the questions above to start building" (inputHidden).
- Submitting composes "My choices: - label: options…" and sends it through
  useChatStream.sendMessage → normal turn.

Verified at the API level end to end: "帮我做个网站" → pure question block
(4 Chinese questions, one multi); posting "My choices: …" → zero re-asks,
28 tool calls, a matching 高端质感 portfolio built, agent ran npm run build
itself. Frontend rendering is tsc/lint-clean but needs a visual pass when a
browser is available again (both tools still wedged).

## Sidebar removal + planner deploy note — 2026-07-28 ~03:30

Jackson's direction: no sidebar concept at all. Home = project list; a
project = chat (left) + preview (right); back arrow top-left. Done in
1d99c05:
- root-layout renders children bare (SidebarWrapper unmounted everywhere).
- The floating nav wordmark is always shown and links home; the account
  menu (UserSettingsBar: settings/logout) moved into the nav's right side.
- ChatTopbar: back arrow replaces the redundant "+" (both went home).
- CodeEngine defaults to the Preview tab — the product's promise is the
  running app, not a file tree.
Displaced by the removal, still to re-home: chat rename/clear/delete (lived
in sidebar-item; the mutations all work — likely as a ⋯ menu on workbench
cards or the chat topbar); sidebar*.tsx files left in place meanwhile.

Deploy gotcha found: the two prior Vercel builds (359ff99 polish, a81fa2b
planner UI) FAILED on a react/no-unescaped-entities lint error in the new
empty-state copy — prod frontend had silently stayed on 5467f56-era build.
Fixed in 1d99c05; lesson: `next build` locally before push, tsc alone does
not gate Next's lint errors.

Next for the right panel (per Jackson, see github.com/nexu-io/open-design):
drop the heavy file explorer for a lightweight "changed files" view — the
sandbox template is a git clone, so `git status --porcelain` in the
workspace is the cheap honest source; needs a small backend endpoint plus a
compact list UI, full tree behind a toggle.

## 打通夜 (rounds A–C) — 2026-07-28 ~04:00

Jackson: 全部今晚打通。Status:
- A (bdcb53a, deployed): Code panel leads with a git-backed "Changes" list
  (new `/api/project/changes`, `changedFiles()` on both workspaces,
  porcelain parser shared in workspace.ts). Full tree behind an "All files"
  toggle; auto-falls back when a project has no git baseline. Verified: the
  fox-badge project reports exactly `M src/app/page.tsx`.
- B (bdcb53a): chat rename / clear history / delete moved into the chat
  topbar's ⋯ menu (the sidebar's mutations, re-homed; same Radix
  setTimeout(0) dialog fix). Pane layout per Jackson: chat rail 18% default
  (15–45), bubbles got real padding and prose rhythm (70dac9e).
- C: scripts/e2e-nodes.mjs — the "Dify-style" segmented test: 23 nodes
  covering register→login→create→planner asks→choices build→changes→file
  r/w→preview→download→rename→drop-reply→ownership-denied→publish→fork
  carries files→clear→delete→admin. Zero deps, node 18+, exit 0 = all green.
  Two nodes run real agent turns (token cost). First full run in progress.

## 打通 — 23/23 — 2026-07-28 ~05:05

The segmented E2E (scripts/e2e-nodes.mjs) is fully green in host mode:
register → login → models → create → bind → model-persist → planner asks →
choices build (42 tool calls) → changed-files → file r/w → preview →
download → rename → drop-reply → ownership-denied → publish+fork carries
files → clear → delete → admin. Run it any time:
  ADMIN_PASSWORD=<demo pw> node scripts/e2e-nodes.mjs

Fixes the suite forced along the way: turns without a model now land on
LLM_DEFAULT_MODEL instead of the CLI's baked-in default (was 404ing);
host scaffolds seed a git baseline commit so "changes" answers in both
modes; the suite itself had two silent-failure bugs (Role enum case,
ChatInputType name) now loud.

**OPEN / needs Jackson:** Vercel sandbox quota is exhausted — every sandbox
API call returns 402, which kills agent turns / preview / files in
SANDBOX_PROVIDER=vercel, INCLUDING PRODUCTION. Local dev is switched to
host mode meanwhile. Raise the cap or wait for the cycle, then re-run the
suite against vercel mode. The extendTimeout cost fix (5467f56) is what
stops this recurring at the old rate.

## Round: visual QA attempt — 2026-07-28 ~05:20

Both browser tools remain unusable on this machine tonight: agent-browser's
daemon answers `session list` but hangs every page operation; the Chrome
extension can render old tab 142 but every interaction throws "Cannot access
a chrome-extension:// URL of different extension", and NEW tabs snap back to
chrome://newtab after a claimed navigation — something else in that Chrome
(Jam?) is reverting automated navigations. Visual QA of tonight's UI
(question card, changes panel, sidebar-less layout, 18% rail, prose rhythm,
signup copy, hidden Google) is queued for daylight: disable the conflicting
extension or `agent-browser upgrade`, then walk home → create → planner card
→ build → changes list → preview with screenshots. `npm run e2e` covers the
behavior side already (23/23 in host mode).

## Loop round (03:14–03:25)

- Killed a duplicate cron: the recurring "今晚上你继续补充需要的功能…" message
  was itself a scheduled job (1fbbbc6e) overlapping the UI-iteration loop
  (c24f105f, kept). One loop remains, until 10:00.
- 5876520: project cards on the workbench get a hover ⋯ menu — rename and
  delete with confirm, the last piece of chat management re-homed from the
  removed sidebar. Full next-build gated.
- Observed: `vercel ls` from repo root now shows a `codefox-repo/codefox`
  project building on push — the GitHub org repo appears to have its own
  Vercel integration besides sma1lboys-projects/codefox (which holds the
  domain). Worth consolidating in daylight; two builds per push is waste.
- Browser tools: unchanged (wedged); no visual pass this round.

## Message layout restack — 2026-07-28 ~03:35 (Jackson's screenshot feedback)

The 18% rail made the side-by-side avatar column expensive: ~40px of every
line went to the avatar gutter. Messages now stack — a small avatar + sender
row (You / CodeFox) on top, full-width content underneath; the waiting dots
match. List gap widened to compensate for the lost horizontal rhythm.

## Loop round (~03:30)

- 0633412: phones get a stacked chat/App layout with a slim pane switcher
  (both panes stay mounted so the preview iframe survives switching); the
  planner's half-streamed ```codefox-questions``` JSON no longer flashes as a
  raw code block — the partial fence is hidden until it closes, in both the
  plain and TurnTrail renderers.
- Earlier this hour on Jackson's live feedback: message layout restacked
  (sender row above full-width content, 3b39d28), workbench card ⋯
  rename/delete (5876520), duplicate cron killed.

## The light kind — html projects (d18ba1e) — 2026-07-28 ~04:30

Jackson's direction via open-design: most generated sites are a page, not a
toolchain — the artifact IS the deliverable. Implemented as a per-project
kind, template-as-plugin:

- `Project.template`: 'html' (NEW DEFAULT for new projects) | 'next' (the
  old starter, still selectable). Composer got a Kind select
  ("Page — self-contained HTML, instant preview" / "Next.js app").
- html scaffold: one index.html (Tailwind CDN) + git baseline. No npm, no
  node_modules, no dev server. Scaffolds host-side in every mode.
- Workspace routing: html projects resolve to HostWorkspace even under
  SANDBOX_PROVIDER=vercel (their files live on the backend's disk).
- Agent: html projects run with dedicated instructions (self-contained
  HTML/Tailwind-CDN, no build tools; planner section shared) and
  forceHost sandbox. ⚠ that trades microVM isolation away for html
  projects — fine while registration is closed; seed-a-sandbox is the
  follow-up before opening it.
- Preview: srcdoc iframe rendering index.html straight from /api/file —
  zero servers, instant, quota-immune. 5s light poll + refresh + open-in-tab
  (blob url). Next projects keep the old dev-server path.
- Fork inherits the kind. Download zip / changes list / editor all work
  unchanged (host paths).

Verified end-to-end on host: create(template html) → scaffold 527B starter →
concrete prompt built directly (no questions, 10 tools) → index.html 10.8KB
with a working 2027 countdown, zero framework references → changes = exactly
"M index.html". The srcdoc preview renders that file as-is.

Deploy note: `project.template` is a new column — DB_SYNCHRONIZE=true was
set before the push (same dance as chat.model); flip it back to false after
the deploy verifies.

## 04:10 — E2E 收口:26/26 全绿

The suite gained three html nodes (24 scaffold instantly / 25 turn edits the
page and nothing else / 26 changes are exactly index.html). First 26-node run
failed 13/15/16 — not a regression: node 07 created its project without a
template, and html is now the default, so the "Next-path" assertions (read
src/app/page.tsx, dev-server preview, big zip) ran against an html scaffold.
Fixed by pinning node 07 to template:'next'; both paths now covered.
Full host-mode run: **26/26 green** (b47631e pushed).

## 04:20 — 首页卡片标注项目类型

Home cards now read "2h ago · Page" / "· Next.js" — getUserChats carries
project { id template } (user.service loads chats.project alongside; verified
live with a throwaway user holding one of each kind). Legacy null templates
read as Next.js, matching the preview branch. Also left a ceiling note on the
srcdoc preview: relative style.css/script.js would 404; the agent is
instructed and E2E-checked to keep pages self-contained, raw-file route is
the upgrade path.

## 04:25 — 第 N 轮:守护 + 文案还账

- E2E node 09 now also asserts getUserChats carries project.template (guards
  the relations list in user.service). Suite re-running in background.
- Mid-turn failure toast was `'Failed to get chat response' + err` — raw
  error concatenated, no space. Now a readable sentence, aborts excluded
  (the user's own stop is not an error), details to the console log.
- Landing page copy caught up with reality: "nothing selects between
  templates yet" was stale — the Kind picker exists. Facts row and limits
  card now describe both starters truthfully.

## 05:05 — 第 N+1 轮:落地页 fork 反馈、favicon、tab 标题

- Anonymous fork click was a silent no-op (router.push('/') while already
  there) — now a toast says signing in is what unlocks forking.
- The fox favicon (app/icon.png + apple-icon.png) had been generated but
  never committed — it ships now, app-router serves it automatically.
- Browser tabs now read "<project> — CodeFox" (topbar effect, restores on
  unmount); several open projects were previously identical tabs.
- Question cards checked: old cards already render non-interactive, no fix
  needed. agent-browser daemon still wedges on cold start (2min timeout) —
  same root cause as all night, not retried further.

## 05:35 — 第 N+2 轮:头像、prod 冒烟

- Chat messages showed initials even for users with an uploaded avatar —
  AvatarImage pointed at src="/" (guaranteed 404). Now mediaUrl(avatarUrl)
  like the settings bar, fallback kept for the avatar-less.
- Prod smoke: fox favicon serving (200, 9.2KB), Railway latest deploy
  SUCCESS 04:59 (one FAILED at 04:15 superseded), prod GraphQL alive with
  registration closed + introspection disabled — both intended.

## 06:10 — 第 N+3 轮:表单一致性、html zip 实测

- Home composer hid nothing when only one model exists — the chat composer
  already hides a one-option picker; the home form now follows the same rule.
- html project download verified live: real zip (PK magic), named after the
  project, contains just the page. Kind picker copy reviewed — already
  explains both starters, left alone.

## 06:35 — 第 N+4 轮:死链接的呈现

- /chat?id=<deleted-or-foreign> used to render an empty composer polling a
  denied query — now a clear "could not be opened" state with the way home
  (guarded by !isReady && no messages so a live chat can never trip it).
- app/not-found.tsx added — unknown routes got Next's unstyled default 404.
- Settings page confirmed present (settings/page.tsx → UserSetting).

## 07:00 — 第 N+5 轮:第十个项目的入口

- The home grid capped at 9 recent projects with no way to reach the rest —
  the "N total" counter becomes "Show all N" once there are more than nine,
  toggling the full grid. Admin public/private toggle and the settings page
  were both reviewed this round and came up clean (wired and honest
  respectively), left alone.

## 07:40 — 第 N+6 轮:html 项目的封面

- Covers only came from the dev-server preview path, which html projects
  (the default kind) never touch — the gallery would have filled with gray
  "No preview yet" tiles. Backend: when internalPreviewUrl() is null and the
  project is html, puppeteer shoots file://<project>/index.html directly
  (html projects live on the host in every mode). Frontend: HtmlPreview
  fires the capture once per mount after the page first loads.
- Verified live end-to-end: fresh html project → /api/screenshot → 200,
  PNG, 13KB of the starter page.

## 08:00 — 第 N+7 轮:全面体检轮

- Magic enhance verified live (regenerateDescription returns a fleshed-out
  brief for a one-line prompt). Fork chain reviewed — returns the new chat
  id and lands the user in their copy; the old "fork-navigation mystery" is
  resolved as working. Railway deploys lag pushes by ~25 minutes; the html-
  cover deploy should land ~08:05, confirm next round.
- Root-level QA PNGs are now gitignored (files untouched); git status is
  down to HANDOFF.md.

## 08:35 — 第 N+8 轮:首页列表的时效性

- Creating a project then coming back home showed a stale grid: the list's
  network-only invalidation flag was only ever set by the (removed) sidebar,
  leaving cache-first with no invalidator. Now cache-and-network — cache
  paints instantly, network refreshes behind it — and the skeleton only
  shows when there is nothing cached, so no flash on revisits.
- Railway deploy of the html-cover fix confirmed live (07:55 SUCCESS).
- sidebar.tsx is confirmed dead (no importers) — deletion left for Jackson
  per the no-unconsented-deletion rule.

## 09:15 — 第 N+9 轮:瞬态重连不再杀 turn,套件到 27 节点

- A 25/27 run exposed a real robustness hole: Azure dropped the stream
  mid-build, the codex harness said "Reconnecting... 1/5" — and the chat
  controller forwarded that as a fatal error frame, killing a turn that was
  about to recover (node 18 then had no trailing reply to drop). Reconnect
  notices are now logged and swallowed; a reconnect that truly fails still
  ends the stream and hits the existing catch.
- Node 27 guards the html cover path (screenshot returns a real PNG); the
  html chat cleanup moved into it. Full rerun after the fix: **27/27**.
- Composer placeholder now says what the box does ("Describe a change — the
  agent edits the real files").

## 09:30 — 第 N+10 轮(收尾轮)

- HANDOFF gained the "Read this first" overnight summary at the top —
  shipped list, still-waiting-on-Jackson list.
- Final health check: Railway 09:14 SUCCESS, codefox.sma1lboy.me 200, prod
  GraphQL alive. The 09:15 transient-fix deploy lands on the usual ~25min
  lag; it is tsc- and suite-verified locally.

## 10:25 — loop 结束

Cron deleted per instruction. One loose thread: the 09:15 push (6d3a6ec,
reconnect fix + node 27) had not shown a Railway deployment by 10:24 —
earlier pushes deployed on a 25-40min lag, this one is 70min late. The
change is additive, tsc-clean, and 27/27 locally; if Railway simply missed
the webhook, an empty push or dashboard redeploy will pick it up.

## 10:45 — steering:agent 工作时输入不再锁死

Jackson 起床第一条反馈:streaming 时 composer 被 disabled,用户只能干等。
The harness has no mid-turn injection API, so this is queue-based steering:
the textarea stays live while the agent works ("Keep typing — sends when
the agent finishes this turn"), Enter/send queues the message, the status
row shows "N queued for the next turn" with a drop button, and the moment
loadingSubmit falls the queue goes out through sendMessage as the next
turn (multiple queued messages join into one). Stop keeps its button; a
queue-send button appears beside it when there is text. Image attach stays
disabled mid-turn — queued turns are text-only for now.

## 10:55 — agent 回复去掉气泡

Feedback: the tinted assistant bubble double-framed the question card and
read as clutter. Assistant messages now render flat like user ones — the
avatar + sender row is the frame. The question card keeps its border and
moves to bg-card so it is the one framed element in a reply.

## 13:20 — 落地页背景画

Reference: coforce.sma1lboy.me's painted hero (oil clouds on linen, paper
planes in a light beam). CodeFox gets the same visual language in its own
tokens: warm charcoal canvas sky, a soft beam from the upper right, cumulus
with ember-lit crowns bottom-right, and a skulk of paper-fox darts climbing
the light. Composed as SVG (turbulence-displaced circle clusters, linen
weave pattern, grain) and rendered to hero-canvas.jpg (288KB) via the
backend's puppeteer — no image model involved, fully reproducible from
tmp/hero-canvas.html. Dark theme only by design; masked to fade before the
facts row. Local view: production build serving on :3001 (the :3000 dev
server wedged overnight and was left untouched per the port rule).

## 13:40 — 玻璃胶囊导航 + section 过渡

- Topbar is now a floating liquid-glass capsule: sticky, centered at
  max-w-1040, rounded-2xl, bg-background/55 + backdrop-blur-xl + hairline
  border — the painted sky reads through it.
- Section seams smoothed per feedback: the hero painting's tail now extends
  under the facts row (mask fades over 1200px), the 3px rule above the
  numbers is gone, and the "one real turn" band eases in/out via a
  transparent→secondary→transparent gradient instead of starting as a slab.

## 13:55 — favicon 换成真 logo

The tab icon was a different cute fox than the brand's FoxMark — replaced
with the real mark (angular head, chevron ears, terracotta eyes) on a warm
dark rounded tile so it reads on both light and dark tab bars. Rendered
from the same SVG geometry as the topbar mark via puppeteer
(tmp/favicon.html); apple-icon gets the opaque 180px variant.

## 14:20 — 玻璃胶囊二轮

The first pass looked like a black slab because the painting started below
the nav — the glass had nothing to refract and the seam where paint met
body background read as a cut. Fixed by raising the sky 128px above the
hero (h-1330, -top-32) so it runs behind the capsule.

The capsule itself: max-w-880, rounded-full, bg-background/30 with
backdrop-blur-2xl + saturate-150, and inset shadows for glass thickness
(bright refraction line on the top edge, dark one beneath). Inner controls
lost their borders — a bordered button inside a bordered capsule was the
same double-frame problem as the chat bubble; they are now text/icons with
a hover wash, and the single solid fill marks Sign Up as the one primary.

## 00:15 (7-29) — 页面有了设计系统(借 open-design 的 token 契约)

生成的页面此前全部落在同一套默认深色 Tailwind 上——agent 没有任何风格锚点,
于是每个项目自己发明一套外观,没有一套显得是有意为之的。

nexu-io/open-design (Apache-2.0, 82k stars) 有 153 套 design system,全部绑定
**同一组 CSS 变量**——这个 token 契约就是可以直接借来不用白做的东西。取其中
风格跨度最大的 8 套(Editorial / Product / Minimal / Brutalist / Luxury /
Neon / Glass / Retro),值是它们的。

- `backend/src/project/design-systems.ts`(新):一张表 = 一套系统。加一套就是
  加一行。
- scaffold 把 tokens 直接烤进 index.html 的 `:root`。**风格活在生成的文件里,
  不存 DB** —— 所以没有新列、没有 migration、不用再跳一次 DB_SYNCHRONIZE 的
  上线舞蹈。
- agent instructions:html 项目被告知 `:root` 是页面的风格契约,要用
  `var(--accent)` / `var(--text-3xl)` 而不是自己挑颜色;新加的页面沿用同一个
  `:root` 块;换风格要改 `:root` 的值(一处重设全站),绝不在标签里写死 hex。
- 新 public query `designSystems` 只回 id/name/blurb + 三个色板值——tokens 留在
  服务端,加系统不会给浏览器多塞一份。composer 的 Style 选择器用色点展示,
  只在 Page 类型下出现(Next starter 自带风格)。

验证:8 套 × 12 个契约 token 的单测 + 未知 id 回落(`design-systems.spec.ts`,
4 绿);真实 scaffold 四种风格并 puppeteer 截图,neon 深紫、brutalist 米底黑
Arial Black、luxury 黑金,bogus-id 回落 Editorial——确实各不相同。backend tsc
干净,frontend tsc 干净,schema.gql + type.tsx 已重新生成。

## 00:15 (7-29) — 同轮的 bug 修复

**上一条提交 (793e812) 让 prod 前端从 23:05 起一直构建失败。** gallery 空态
文案带了个 prettier/prettier 错误,`next build` 直接 Failed to compile ——
正是 HANDOFF 里记过的那个事故模式(tsc 干净 ≠ build 干净,Vercel 静默停在旧
版本)。已修,build 恢复绿。

**PreviewService 三处泄漏**(`preview.service.ts` + 新 `preview.service.spec.ts`,
3 绿):
- 并发 start 各自 boot 一个 dev server——map 在 spawn 返回前是空的,两个同时
  到达的请求都漏过了已存在检查,第二个覆盖第一个,孤儿 Next 进程再没人能停
  (idle sweep / delete / module destroy 都找不到它)。现在 in-flight 的 start
  记在 `starting` map 里,后来者复用同一个 promise。
- `exit` handler 无条件 delete:重启会在旧进程咽气前就换掉 entry,于是新起的
  dev server 被从 map 里删掉,同样变成没人管的进程。现在只在 map 仍指向**这个**
  child 时才删。
- boot 失败的 preview 留在 map 里,`ready` 永久 rejected,之后每次 start 都
  短路在它上面——预览一直坏到进程重启为止,哪怕 dev server 其实几秒后就起来了。
  现在失败即清理 + SIGTERM,下次请求重新起一个。

**html 项目的 fork 在 vercel 模式下是空的**(`project.service.ts`):fork 只按
sandbox mode 分支,但 html 的文件在**两种模式下都只住在 host** —— 这正是
WorkspaceService 的判断。于是 html fork 被解包进一个没人会读的 microVM,而它
自己的 host 目录压根没建,打开就是没有文件。现在 fork 的分支条件跟
WorkspaceService 对齐。

## 14:40 — 灰带删除 + gallery 的封面门槛

- The "one real turn" band is gone entirely. `--secondary` in dark is a
  near-neutral grey (45 4.9% 16.1%); under a warm painted page it reads as
  dirt. Third attempt at that seam and the winner is no band at all — the
  terracotta label, the display heading and the bordered cards separate it.
- Gallery now requires a cover (`photoUrl: Not(IsNull())`). The filter was
  dropped earlier this session for a good reason — capture was broken
  everywhere and requiring it emptied the wall — but capture works now, so a
  wall of "no preview yet" tiles is just an honest way to show nothing.
  Prod check: 48 public projects, exactly 1 has a cover (the rest are E2E
  leftovers nobody opened). Covers fill in as projects get opened.
- Covers follow the latest version: HtmlPreview re-shoots whenever the page
  content changes (1.5s debounce so mid-turn rewrites do not each get a
  screenshot), instead of once per mount.
