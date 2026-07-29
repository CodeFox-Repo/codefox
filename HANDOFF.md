# Handoff — 2026-07-28

State of the product as of this session. Facts and open questions only; no
proposed fixes.

## Read this first — where the product stands (2026-07-29 03:00)

Two overnight sessions. Everything below is deployed (Railway + Vercel) and
covered by the E2E suite (`npm run e2e`, host mode, 33 nodes).

**A project is a page you can send someone.** html is the default kind:
single-file scaffold, srcdoc preview, no servers, no sandbox wait. A public
page gets a real link — `/share/<uniqueProjectId>`, anonymous, served with a
sandbox header because the HTML was written by a model following a
stranger's prompt, and multi-page sites resolve their own relative links.
Covers are screenshots of the page itself and follow the latest version; the
gallery only shows projects that have one.

**A turn is a version.** Every agent turn commits, the Changes panel reads
git, and a wrong turn can be restored — the restore is itself a version, so
undo is undoable. The composer stays live mid-turn: messages typed while the
agent works queue and steer the next turn.

**The planner asks first.** A vague prompt gets a question card (checkbox
options, hidden composer) instead of a guessed build, and the answer picks a
design system the agent then builds against.

**Look.** Painted hero (canvas sky, light beam, paper foxes), glass capsule
topbar, brand favicon, flat agent replies, sections that flow rather than
stack. Dark theme is the designed one.

### Still waiting on Jackson

- **Vercel sandbox quota 402** — blocks prod Next-mode agent turns. Raise the
  cap in the Vercel console, then re-run the suite in vercel mode. html
  projects are unaffected (they live on the host by design).
- `frontend/src/components/sidebar.tsx` is dead (no importers) — delete when
  convenient; deletion needs your say-so.
- Visual QA in a real browser: question card, changes panel, version history,
  mobile switcher. The agent-browser daemon wedged both nights, so every
  screenshot here is puppeteer against a production build on :3001.
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

## 07:50 (7-29) — 问题卡片:模型漏了 id,回答一题就等于回答了全部

planner 的问题卡片是产品的第一印象,但从没验证过。先实测三种 prompt
(中/英/中),**agent 三次都产出了合法、本地化正确的卡片**(各 4 题),
这条链路本身是好的。

问题在解析器:它不要求 `id` 字段,但组件里**所有答案都存在 `choices[q.id]`
下面**,`key={q.id}` 也用它。模型漏写 id 时两题的 id 都是 `undefined` ——
**选了第一题的选项,第二题也跟着被填上**,React key 还会撞。这份 JSON 是
模型写的,id 是建议而不是契约。

解析时改成:模型给的 id 只在"是字符串、非空、且没重复过"时才采用,否则用
位置 `q${index}` —— 位置才是真正唯一的东西。实测五种形状(无 id / 重复 id
/ 空字符串 id / 数字 id / 正常 id)现在都是唯一且互相隔离的。

`scripts/check-question-card.mjs`:9 种模型可能写出的形状的自检(含半截
流式块、malformed JSON、选项为空)。**验证过它会失败** —— 把 fix 还原后
脚本报错退出 1,恢复后通过。前端没有测试框架,为一个纯函数立一套 runner
比这个函数本身还重,所以用可直接运行的脚本。

## 07:20 (7-29) — 页面可以导出成 PDF 了

并发那条线挖干净了,这轮换新需求。open-design 主打 "real files, HTML/PDF
export",CodeFox 只有 zip —— 而一份 HTML 的 zip 不是任何人会拿去交付的东西。

**这不是新增机器,是复用**:拍封面的 puppeteer 已经在跑,连"这个项目唯一
合法的渲染地址"的推导、浏览器复用、target closed 后重启浏览器的恢复逻辑
全都现成。抽出 `renderTarget()` 和 `withPage()` 两个私有方法后,PDF 就是
同一条管线换最后一步 `page.pdf()`。

- `GET /api/pdf?projectPath=…`,**读权限**(截图是写权限——截图会覆盖封面,
  打印什么都不改,所以公开项目谁都能打印)。
- `printBackground: true` 是关键:不加的话打印样式表会丢掉所有背景,一个
  深色设计打出来就是白纸。实测渲染出来的 PDF 保留了 luxury 的黑金和 Didot
  衬线。
- 只对 html 项目开放:Next 应用打印的是它 dev server 当时恰好在服务的东西,
  那不是任何人要的交付物。
- **preview proxy 的 `OURS` 正则加了 `pdf`** —— 它跑在 Nest 之前,不加就会
  在带 preview cookie 时被吞掉(这个坑这轮是第二次踩到了,share 那次一样)。

验证:owner 200 拿到 12.5KB 真 PDF(`%PDF-` 魔数、2 页、有 content stream)、
陌生人 403、匿名 401、项目转公开后陌生人 200;把 PDF 渲染成图确认不是白纸。
新节点 35 守卫这条路。

## 06:50 (7-29) — 同时到达的消息会互相覆盖(丢的是用户的对话本身)

沿着上一轮的线索继续查"两个人同时做同一件事":一个 chat 的 messages 是
**一个 JSON 列**,追加一条消息 = 读出整个数组、push、写回整个数组。

实测:**并发保存 6 条消息,存下 2 条**,另外 4 条消失 —— 而且每一次调用都
返回了 `true`。丢的不是计数器,是用户真实的对话内容。

JSON 列没有原子追加,所以写必须排队。`ChatService.serialise(chatId, …)`
把这些全部串起来:
- `saveMessage` —— 读改写,是主犯。
- `dropLastAssistantReply` —— 同一列的读改写。
- `clearChatHistory` —— 它自己不读旧数组,但一个**先开始**的追加会在它之后
  把旧数组写回去,把"清空"撤销掉。
- `updateChatModel` / `updateChatTitle` —— 这两个看起来无关,但它们
  `findOne` 拿的是整行(**包含 messages**)再整行 save,所以 turn 进行中改
  模型或改标题,会把这次读之后到达的所有消息写没。

存进 map 的 promise 永不 reject(一个失败的写不会卡死这个 chat),队列排空
后条目删除。

验证:同一个探针 —— 修复前 6 发 2 存,修复后 **6 发 6 存、无重复 id**。

## 06:20 (7-29) — 同时 fork 的人越多,fork 数记得越少

`forkProject` 用 `sourceProject.subNumber += 1` 然后 save —— 这是对内存里
那行的读改写。**四个人同时 fork 同一个项目:四次都成功,计数记录为 1。**
丢了三个。

这不只是个数字不好看:上一轮刚把 gallery 的 trending 改成按 `subNumber`
排序,所以一个被少算的项目正是那面墙永远不会展示的项目 —— 越受欢迎、
同时 fork 的人越多、少算得越厉害。

改成 `repository.increment()`,让数据库做原子自增。实测:修复前 4 次
fork → 计数 1;修复后 4 → 4。

顺手 grep 了仓库里别的 `+= 1` / `-= 1`,只剩 admin 里一个本地循环计数器,
不是数据库字段,不受影响。

节点 20 现在顺带断言"一次 fork 记一次"。

## 05:50 (7-29) — 首页那九个"最近"项目其实是最旧的九个

`getUserChats` 没有 `ORDER BY`,而首页把返回的前九个当作 "recent" 展示
(第十个之后收进 "Show all N")。实测确认返回顺序是**最旧在前** —— 也就是
说一旦你有第十个项目,**新建的那个反而看不见了**,而每张卡片还写着
"2h ago"。改成 `createdAt DESC`。

同一个查询还把**已删除的 chat 从数据库捞出来再用 JS 过滤掉**。删过一百个
项目的用户,此后每次打开首页都要把这一百行重新加载一遍。改成在 where 里
过滤。

这个改动有个陷阱值得记:一旦对关联加了过滤条件,一个所有 chat 都被删掉的
用户就**不匹配任何行**,`findOne` 会返回 null —— 而它以前返回的是"用户 +
空列表"。所以补了一条不带关联过滤的回查。实测三种情况:新用户 `[]`、
有一个 chat 时返回它、删掉之后仍然是 `[]`(而不是 null)。

本轮另外两条线是死胡同,记下来免得后面重复走:
- 下载 zip 里"少了 notes.md" —— 是我解析 `unzip -l` 时把最后一行切掉了,
  实际文件都在。archiver 的 glob 和 ignore 列表都正确。
- `archive()` 里 `finalize()` 在挂 close 监听器之前 await —— 看着像竞态,
  实测 close 总在 finalize 之后才触发,监听器接得住。

## 05:20 (7-29) — 同一个项目上并发两个 turn,会静默吞掉一整轮工作

同一个 chat 上同时发两条消息,**两个 agent 会同时在同一个工作目录里跑**。
没有任何东西串行化它们。

实测(两条"把整个页面重写成…"同时发出):两个 turn 都回 201、都向用户报告
成功,但**版本历史里只有一个** —— 后完成的那个提交的是一棵已经被覆盖过的
树,另一整轮的工作凭空消失,没有任何错误、任何日志、任何提示。用户被告知
两次都成功了。

- `pipeAgent` 现在按 projectPath 排队:新 turn 挂在该项目队列的尾部。存进
  map 的那个 promise 永不 reject,所以一个失败的 turn 不会把整个项目的队列
  卡死;队列排空后条目会被删掉,不会每个项目永远留一个已 settle 的 promise。
- 排队时会先给客户端写一行"正在等这个项目当前的 turn 结束",而不是让用户
  盯着一个安静的流。`runTurn` 里的 setHeader 因此加了 `headersSent` 判断。
- 排队期间客户端挂断的话不再启动 agent。

验证:同一个探针,修复前 = 2 个 turn / 1 个版本(丢了一轮);修复后 =
第二个 turn 报告 `queued: true`,**3 个版本全在**(baseline + 两轮)。

## 04:50 (7-29) — 聊天附件走的是另一条路,而那条路没有任何检查

头像上传会限制 5MB 并**嗅探magic bytes**(客户端唯一无法撒谎的东西)。
聊天里贴的图片走的是完全不同的一条路——base64 data URL 而不是 multipart
——那条路**两样都没有**:扩展名直接取自客户端声称的 mime,字节从来没人看过。

实测:发 6MB 的 `AAAA…` 并声称 `image/png`,HTTP 201,**文件以 .png 落盘,
6144KB**,然后 agent 被告知"读这张图片"。数量上限是 4 张,单张没有上限,
25MB 的 body 上限装得下四张 6MB。

- `sniff` 从 file_check 导出(聊天附件走另一条路,但需要同一个答案),
  补上 GIF ——聊天允许 gif,嗅探器得能叫出它的名字。
- `decodeImage` 现在:**先按 base64 长度估算大小再解码**(超限的附件不必
  先在内存里materialise出来),然后嗅探,文件名按**实际类型**取扩展名。
- 顺带把导出 sniff 带来的口子堵上:头像路径原本只要"能认出来"就放行,
  加了 GIF 之后一个改名成 .png 的 gif 就会通过——现在改成对照白名单校验。

验证:4 个 sniff 单测(含 6MB 单字节 blob、`<script>`、PDF 头、太短的
buffer、RIFF/WAVE 不能冒充 WebP);真实 API 四发四态——6MB blob 和伪装成
png 的脚本都没有落盘,真 png 落盘,声称是 png 的 gif 以 **.gif** 落盘。

## 04:20 (7-29) — 停用账号此前只是一句建议

admin 控制台有个 "set user active" 开关。登录会检查 `isActive`,**但别的
地方都不检查** —— 实测确认(直接改数据库然后走真实 API):

1. 新登录 → `Invalid credentials` ✓
2. **停用前签发的 token → 照常工作**
3. **refresh → 高高兴兴发一个新 access token**

也就是说封禁一个已登录的用户在最长 7 天(refresh token 的寿命)内**完全
没有效果**。这不是理论问题:admin 面板上那个按钮看起来生效了,实际什么
都没做。

- JWTAuthGuard 现在除了验签名和查 token 没被登出之外,还按主键读一次 User
  行,账号关闭就拒。这是在这个 guard 已有的一次 DB 读旁边再加一次主键
  查询——值得:不加的话"停用"是建议而不是控制。
- refresh 路径同样检查,并且**删掉那个 refresh token** ——它才是那个会继续
  working 的东西。
- guard 的依赖放进 `JwtCacheModule`(它本来就被每个挂这个 guard 的模块
  import)。在每个模块各自注册 User repo 太脆:新模块能编译通过然后在启动
  时炸——这个坑我在这轮就踩到了(PromptToolModule)。

验证:同一个探针脚本,修复后三项全部变成 "This account is no longer
active";E2E 全绿说明正常用户不受影响。

## 03:50 (7-29) — trending 一直只返回一个;删除项目会永久漏一张封面

**gallery 的 trending 策略在生产上是坏的。** 它取
`ceil(总数 * 0.01)` 再和调用方要求的 size 取小 —— 生产上 48 个公开项目,
`ceil(0.48)` = 1,所以**要 6 个只回 1 个**。实测生产:latest 回 5、
trending 回 1。这个公式要到 600 个项目以上才不再退化,也就是说它在产品
存在过的每一个规模上都是坏的。前端因此从来没用过 trending(grep 无结果)
——一个从来不返回有用结果的策略,自然没人接。改成按 fork 数、再按时间
排序,size 就是唯一上限。

**删除项目永久泄漏它的封面。** 删除会回收文件(~1GB 的依赖树)和聊天,
但从不 unlink 那张截图 PNG,于是每次删除都在卷上留下一个再也没人指向的
文件。复用换封面时那条规则(`staleMediaPath`):fork 会继承 photoUrl,
所以只在没有别的行指着它时才删。注意这里的算术 —— 项目行此时已经被标记
删除,所以 count 数的是**其他**行,而 `staleMediaPath` 把调用者也算进去,
因此传 `others + 1`。

验证:新节点 34 守卫 trending(和 latest 返回同样数量、按 fork 数降序、
不超过 size);删除路径的算术直接实测(无人共享 → 删,一个 fork 共享 →
留,两个 → 留,没有封面 → 不动,traversal → 拒绝)。

## 03:20 (7-29) — Console 标签页对默认项目类型不再说谎

Console 标签页显示的是 **dev server** 的输出,但 html 项目没有 dev server
也永远不会有。于是对**产品的默认类型**,这个标签页只会说"打开 Preview 标签
页来启动 dev server"——一个不存在的服务器。实测:`/api/preview/logs` 对
html 项目回 200 但永远是空的。

与此同时 agent 会写内联 `<script>`,那些脚本抛错时用户完全看不到。

- 新 `lib/page-console.ts`:预览 iframe 是 same-origin,所以页面自己的
  console 可以从父窗口读到。包裹 frame 的 console 方法而不是只听 error
  事件——未捕获错误有 `onerror`,但 `console.log` 没有任何事件,而"页面
  打印了什么"正是打开这个标签页的主要理由。同时接 `error` 和
  `unhandledrejection`。原始 console 照常收到输出:devtools 仍是更全的视图,
  在这里吞掉会让这个标签页变成降级。
- 存在模块级 store 而不是 React state:写入方(预览面板)和读取方
  (Console 标签页)从来不在同一棵子树里,而且值得看的错误通常发生在有人
  打开那个标签页**之前**。上限 300 行——渲染死循环的页面不能把它撑爆。
- Console 标签页按项目类型分支:html 显示 "Page console" 并带 Clear;
  空态文案说的是实话("这个页面打印的东西和它的脚本抛的错会出现在这里")。

验证:puppeteer 实测同构场景(父窗口 + same-origin srcdoc iframe),
`console.log` / `console.error` / setTimeout 里抛出的未捕获 TypeError
三者全部捕获到。这类行为 curl 看不见——HANDOFF 记过这个教训。

## 02:50 (7-29) — 多页站点:agent 被要求建的链接,产品终于能打开了

agent 的 instructions 明确写着"页面需要更多结构就加一个 .html 文件并链
过去",但**分享路由和预览面板都写死只读 index.html** —— 于是 agent 照做
写出的每一个 `<a href="about.html">` 都是死链。三个面(share / 预览 /
封面截图)全都只认 index.html。实测确认:写一个 about.html,
`/share/<id>/about.html` 回 404。

- 分享路由改成 `@Get([':id', ':id/*'])`(Nest 10 + Express 4 下 `*path`
  形式静默匹配不到任何东西,所以是两条路由而不是可选段)。
- 新 `shared-page-path.ts` 把公开 url 解析成要读的文件。这是把**匿名的、
  攻击者可控的 url 变成一次磁盘读取**,所以刻意收窄:
  **只服务 `.html`** —— 这条路由以 text/html 回应且不需要会话,项目里
  别的文件(agent 写的 .env、owner 留的笔记)不因为项目公开就一起公开;
  最多一层目录;normalize 后越界直接拒绝而不是钳制;反斜杠、NUL、
  双斜杠、`.`/`..`、畸形百分号编码全拒。8 个单测。
- 预览面板现在跟随站内链接:iframe 是 sandbox 且没有 allow-top-navigation,
  所以点相对链接**什么都不会发生**——以前看起来就是个死链。现在拦截点击
  换页,顶栏显示当前页名并给出返回首页的箭头。绝对 url 和锚点不拦。
  封面只在首页时拍(一张 "About" 的封面是错的)。

验证:节点 33 扩展(写 about.html + notes.md → 链接页 200 且内容正确 →
notes.md / `../../etc/passwd` / `..%2f..%2f` 全 404);另测嵌套页
`pages/deep.html` 200、同项目里的 secret.md 404。

## 02:20 (7-29) — 用户名可以改了(设置页自己承认的半成品)

设置页上写着 "Username — Not editable yet",代码注释也直说 API 还没有这个
mutation。这是产品里唯一一个自己承认没做完的地方,也是 HANDOFF 早前记过的
待办方向。

- 新 `updateUsername`(guarded)。用户名会出现在 gallery 的公开卡片上,所以
  校验是认真做的:折叠空白后 3–32 字符、拒绝 `< > / \ @ ' " \``
  和控制字符、拒绝已被别人占用的名字。
- **列上没有 unique 约束,而且从来没有过**,所以这里不假装能保证唯一性
  ——加约束的 migration 会在现存重复数据上直接失败。它保证的是:一次改名
  绝不会**新造**一个与他人重名的冲突,这才是真会撞到的情况。
- 改自己已有的名字不走占用检查(否则"保存我现在的名字"会报"已被占用")。
- UI:设置页那个 read-only chip 换成可编辑输入框,失焦或回车即存,Esc 还原
  ——一个字段配一个 Save 按钮比这次改动本身还重。错误直接显示服务端说的话,
  不在前端复制一份规则(那注定会漂移)。

验证:9 个单测 + 真实 API 全流程(改名生效并持久化、另一用户抢同名被拒、
改回自己的名字通过、过短/markup/纯空白被拒、首尾空白被折叠、匿名 401)。

**顺手把长期红着的 3 个单测修好了,后端套件首次全绿 67/67**(此前只有跑
`jest src/project/` 才是绿的,跑全量一直是 3 红):
- `user.service.spec.ts` 的测试模块缺 `UploadService`——头像上传搬进
  upload service 时服务多了这个依赖,测试模块没跟着改,于是它编译失败、
  这个套件一直红。
- `register-user.input.spec.ts` 的四个用例都写在 `confirmPassword` 加进
  DTO 之前:不设这个字段,它永远第一个报错,所以"合法输入"用例从来就不
  合法,而 email 用例断言的 `errors[0]` 实际是 confirmPassword 的错误。
  顺便把 `errors[0]` 改成按 property 查找——字段校验顺序不是 DTO 的契约。

## 01:50 (7-29) — 分享链接在生产验证 + 有了链接预览

**先确认上一轮的分享功能在生产上是活的**:Jackson 的真实页面
`codefox.sma1lboy.me/share/2fc8ed27-…` 匿名 200、3296 字节真页面,CSP
sandbox 穿过 Vercel rewrite 完好,一个 Next 项目的 id 正确回 404。

然后补上它缺的一半:**链接贴进 Slack / iMessage / 推特是一条光秃秃的 url**
——生成的页面只有 agent 写的 `<title>`,没有名字、没有描述、没有图。而封面
截图**本来就存在、本来就公开可取**(`/api/media/...` 实测 200),纯粹是没接。

`social-card.ts`:服务时往 `<head>` 顶部注入 og / twitter 标签。
- **不覆盖页面已经声明的**:agent 可能自己写了 og:tag,那是作者的意图。
- og: 和 twitter: 视为同一件事的两种拼写——写这个测试时抓到一个真 bug:
  页面只声明了 `og:title` 时,我们仍然注入了 `twitter:title`,于是**同一个
  链接在 Slack 显示作者的标题、在推特显示项目行名**。现在互为孪生的标签
  任一被声明,两个都跳过。
- 图片地址用 `x-forwarded-host`(访客真正访问的域名),不是后端自己的
  hostname——后者在 rewrite 之后是 Railway 子域。这个 header 会决定一个进
  公开页面的 url,所以只接受 host 形状的值。
- 项目名是用户输入且进 HTML 属性,转义(`"><script>` 有专门的测试)。
- 没有 `<head>` 的页面原样返回,不围绕假设去重建它。

验证:11 个单测 + 真实路由实测(标签只注入一次、页面 body 和 luxury token
完好);节点 33 扩展为同时守卫预览卡片和"卡片图片必须指向产品域名"。

## 01:25 (7-29) — 生成的页面终于可以给别人看了

之前一个 public 项目只能被 **fork**,不能被**看**:gallery 上是一张截图,
预览是 srcdoc iframe,连"在新标签打开"都是 blob url——关掉就没了。**没有
任何一个链接能发给别人。** 而"把做出来的东西发出去"基本上就是人做它的理由。

- 新的 `GET /share/:id`(`share.controller.ts`),`@Public()`,匿名可读。
- **id 用 `uniqueProjectId` 而不是 `projectPath`**:目录名是所有需要鉴权的
  文件路由的 key,把它印在公开 url 里等于邀请别人去试那些路由。这个 uuid
  本来就在行上,而且对文件 API 毫无意义。顺手把 gallery 查询里的
  `projectPath` 换掉——它一直被取出来发给匿名访客,却没有任何地方用它。
- **页面是这个 origin 上的不可信 HTML**(模型按陌生人的 prompt 写的),响应
  带 `Content-Security-Policy: sandbox allow-scripts allow-forms`——脚本能跑
  (那是产品本身),但拿不到打开它的人的 cookie 和 storage。
- 只服务 html 项目:Next 应用没有单个可服务的文件,给它一个 share 链接只能
  404。不存在 / 非 public / 非 html 全部回同一句"This page is not shared."
  ——能区分它们的错误页就是一个探测私有项目是否存在的接口。
- `next.config` 把 `/share` 也 rewrite 到后端,所以链接穿产品自己的域名,
  而不是 Railway 的子域。preview proxy 的 `OURS` 正则也补上了 share
  ——它跑在 Nest 之前,不加就会在带 preview cookie 时被吞掉(HANDOFF 记过
  的老坑)。
- UI:gallery 的封面变成指向真实页面的链接(Next 项目保持普通 tile,不给
  死链);工具栏在项目 public 且是 html 时出现 Share 按钮,复制完整 url。

验证(节点 33 + 手工全覆盖):私有 404 → 发布后匿名 200 且是真页面 →
neon token 还在 → CSP sandbox 就位 → 拿 projectPath 当 id 404 → 乱码 404 →
未知 uuid 404 → public 的 Next 项目 404。

## 01:05 (7-29) — E2E 补到 32 节点,并因此抓到一个竞态

给套件补上新功能的守卫节点(28 设计系统、29 版本、30 回滚、31 回滚拒绝
非法输入),**第一次跑就抓到一个真 bug**:

- **snapshot 发生在 `res.end()` 之后**,所以客户端在流关闭那一刻去查历史
  ——而这正是 UI 刷新的时机——会看不到刚结束的那一轮。节点 29 读到 1 个
  版本,而我事后手动探测同一个项目是 2 个,时间戳证实 commit 写在节点
  29/30 查询之后。现在 snapshot 排在 `endSession` 之后、`res.end()` 之前。
- 节点 28 的价值:它验证的是**风格能活过 agent 的重写**——节点 25 的真实
  turn 把页面整个改掉之后,neon 的 `#070711` 仍在页面里。
- **第二次跑又抓到一个我自己引入的回归**:每轮 turn 提交之后,Changes 面板
  空了——"改了什么"一直是拿工作区和 HEAD 比,而现在 HEAD 跟着 agent 走,
  于是刚填满面板的那一轮把它自己清空了。改成跟**第一个 commit**(starter)
  比:`git diff --name-status <root> HEAD` 得到已提交的偏离,再并上
  porcelain 的未提交部分(`parseNameStatus` + `mergeChanges`,9 个单测)。
  一个文件如果是 agent 新建的、后来又改过,相对 starter 仍然算 added。
- 节点 30 也顺势加强了:原本断言存在 "Before restore" 这个 label——这是实现
  细节,而且 turn 会提交之后它通常是 no-op。现在改成**验证往返**:回滚后
  再滚回去,文件内容必须逐字回到回滚前。
- 顺手修掉套件自己的环境依赖:节点 19 原本借用部署的 admin 账号来当"另一
  个用户",于是任何没有 seed 该账号的数据库上,19/20/23 三个节点全挂。
  19 现在自己注册第二个账号;23 是唯一真正需要 admin 的,它先验证非
  admin 被拒(这本来就是它该测的一半),admin 那一半在没有该账号时明确
  跳过而不是让整轮失败。

**媒体文件删除统一到一处**(`cover.ts` → `media-file.ts`):头像换新时的
unlink 既没有共享检查(两个用户指向同一 url 时会删掉对方的),也没有目录
约束——url 反推成路径,而"删掉这一列里的路径"离"删掉磁盘上任何东西"只差
一个坏掉的列。`staleMediaPath` 现在同时负责两件事:别的行还指着就不删,
解析结果必须落在 media 目录内(5 个单测覆盖 `../` 穿越)。

## 00:45 (7-29) — 版本历史与回滚

agent 走错一步之前没有任何退路:每个项目只有一个 commit(它的 baseline),
之后所有轮次的改动全堆在同一个未提交的 diff 里。而项目本来就是 git 仓库
(`changedFiles()` 一直在用 porcelain)——回滚是这套机器的自然延伸,不需要
新的存储。

- workspace 接口加三个方法:`snapshot(label)` / `versions()` / `restore(id)`,
  host 和 vercel 两种实现都有(sandbox 侧用一次 shell round trip)。
- **每轮 agent turn 结束后自动 snapshot**,label 就是用户自己的 prompt
  (截断 72 字)。放在 session 结束之后,所以 agent 最后的写入已经落盘;
  失败的 turn 也 snapshot——那些改动是真的,而且正是最想撤销的东西。
  没有改动就不提交(返回 null)。
- **restore 自身可撤销**:回滚前先把当前状态存成一个版本("Before restore"),
  然后 `checkout <sha> -- .` —— 移动文件但不动 HEAD,历史保持线性,
  detached HEAD 会让之后所有 snapshot 变成孤儿。
- 新接口 `GET /api/project/versions` 和 `POST /api/project/restore`
  (写权限:公开项目的只读访问者不能改别人的文件)。versionId 只接受 sha
  正则——这个字符串会进命令行。
- Code 面板第三个视图 History:每个版本一行(prompt + 相对时间),
  hover 出 Restore。回滚后清空编辑器选中(文件内容已经不是它了)、刷新
  changes 和历史,成功/失败都有 toast。

验证:`versions.spec.ts` 6 个单测(含 label 里含分隔符、HEAD 带换行、
畸形行不会凭空造版本);直接对 HostWorkspace 跑完整流程(两次 snapshot →
restore → 文件确实回到第一版 → 历史多出 Restored 条目);**再通过真实 API 走
一遍**(建 neon 项目 → 写文件 → restore 到 baseline → 文件回到 starter 且
neon token 还在 → 历史 = Restored/Before restore/starter baseline);
注入 `; rm -rf /` 得 400,缺 versionId 得 400,匿名得 401。
backend tsc 干净、DI 启动干净、frontend build 干净、16 个测试全绿。

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

**fork 一个空的 html 项目会拿到 Next 脚手架**(`scaffold.ts`):`copyProject`
在源目录没有可拷贝内容时回落到 `scaffoldProject`——那是 **Next** 的脚手架,
而 fork 继承了源的 `template: 'html'`。于是 srcdoc 预览去找一个 Next 脚手架里
根本没有的 index.html,永远白屏。实测确认(修前 fork 得到 21 个 Next 文件、
无 index.html;修后就是一个 index.html)。`copyProject` 现在收 template 参数,
回落到对应的脚手架。

**fork 和源项目共享一张封面文件,谁先重拍谁就删掉对方的**
(`project.service.ts` + 新 `cover.ts`):fork 直接继承 `photoUrl`,而换封面时
会 unlink 被替换的那个文件。于是重拍其中一个,另一个的卡片 404——而 gallery
要求有封面,那个项目就从墙上掉下去了。现在只在没有别的项目指向该文件时才删
(`staleCoverPath`,3 个单测)。

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

## 03:00 (7/29) — 部署与分享链路复核

- Vercel Ready, Railway SUCCESS (285f07b3) — everything through 6098f38 is
  live. `/share/<bogus>` on prod returns the branded "not shared" 404, so the
  route is deployed rather than just built.
- Share pipeline walked end to end locally: public html project → anonymous
  `/share/<uniqueProjectId>` → 200 with the real page, `Content-Security-
  Policy: sandbox allow-scripts allow-forms` and `X-Content-Type-Options:
  nosniff`. og:title/description present; og:image only when a cover exists
  (correct — no cover, no image tag).
- Screenshot endpoint refuses a stranger's project (403), so covers cannot be
  farmed for projects you do not own.
- Leftover test data on the local DB: one public page project
  (d92ca790, "Warm Roast Landing Page") with no cover, invisible in the
  gallery by the cover rule. Harmless; delete whenever.

Full suite re-run against HEAD (6098f38 + this doc commit): **32/32 green**,
including the newest nodes — versions/restore/undo-the-undo, restore refusing
a non-version, the anonymous share link (7603B served with no token), and the
html cover shooting a 137KB png.
