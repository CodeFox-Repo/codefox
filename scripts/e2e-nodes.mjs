#!/usr/bin/env node
/**
 * Segmented end-to-end test: the whole product as ~20 checkable nodes.
 *
 *   node scripts/e2e-nodes.mjs
 *
 * Env: BASE (default http://localhost:8080), ADMIN_EMAIL / ADMIN_PASSWORD
 * (an existing account with the Admin role, defaults to the dev demo user).
 * Registration must be open on the target for the throwaway-user nodes.
 *
 * Two nodes run real agent turns, so a full pass takes several minutes and
 * spends model tokens. Exit code 0 = every node green.
 */

const BASE = process.env.BASE ?? 'http://localhost:8080';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'demo@codefox.test';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'demo-password-123';

const results = [];
const state = {};

async function gqlOrThrow(query, variables, token) {
  const r = await gql(query, variables, token);
  if (r.errors?.length) throw new Error(r.errors[0].message);
  return r;
}

async function gql(query, variables, token) {
  const res = await fetch(`${BASE}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  return body;
}

async function rest(path, opts = {}, token) {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
}

/** Stream one agent turn; collect text and tool events. */
async function turn(chatId, message, token) {
  const res = await rest(
    '/api/chat',
    { method: 'POST', body: JSON.stringify({ chatId, message }) },
    token
  );
  if (!res.ok) throw new Error(`turn http ${res.status}`);
  let text = '';
  let tools = 0;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.t === 'text') text += event.v ?? '';
        if (event.t === 'tool') tools += 1;
        if (event.t === 'error') throw new Error(`turn error: ${event.v}`);
      } catch (e) {
        if (String(e).includes('turn error')) throw e;
      }
    }
  }
  return { text, tools };
}

async function node(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, ms: Date.now() - started, detail });
    console.log(
      `  ✓ ${name} (${Date.now() - started}ms)${detail ? ` — ${detail}` : ''}`
    );
  } catch (error) {
    results.push({
      name,
      ok: false,
      ms: Date.now() - started,
      detail: String(error).slice(0, 160),
    });
    console.log(`  ✗ ${name} — ${String(error).slice(0, 160)}`);
  }
}

const ts = Math.floor(Date.now() / 1000);
const EMAIL = `e2e-${ts}@codefox.test`;
const PASSWORD = `E2ePass!${ts}`;

console.log(`e2e-nodes against ${BASE} as ${EMAIL}`);

await node('01 graphql alive', async () => {
  const r = await gql('{__typename}');
  if (!r.data) throw new Error('no data');
});

await node('02 registration open', async () => {
  const r = await gql('query{registrationOpen}');
  if (r.data?.registrationOpen !== true)
    throw new Error('registration closed — remaining nodes need it');
});

await node('03 register throwaway', async () => {
  const r = await gql(
    'mutation($i:RegisterUserInput!){registerUser(input:$i){id}}',
    {
      i: {
        username: `e2e${ts}`,
        email: EMAIL,
        password: PASSWORD,
        confirmPassword: PASSWORD,
      },
    }
  );
  if (!r.data?.registerUser?.id)
    throw new Error(JSON.stringify(r.errors?.[0]?.message));
});

await node('04 login throwaway', async () => {
  const r = await gql(
    'mutation($i:LoginUserInput!){login(input:$i){accessToken}}',
    { i: { email: EMAIL, password: PASSWORD } }
  );
  state.token = r.data?.login?.accessToken;
  if (!state.token) throw new Error(JSON.stringify(r.errors?.[0]?.message));
});

await node('05 me resolves', async () => {
  const r = await gql('query{me{username email}}', undefined, state.token);
  if (r.data?.me?.email !== EMAIL) throw new Error('wrong identity');
});

await node('06 models listed', async () => {
  const r = await gql('query{getAvailableModelTags}');
  state.model = r.data?.getAvailableModelTags?.[0];
  if (!state.model) throw new Error('no models');
  return state.model;
});

await node('07 create project', async () => {
  const r = await gql(
    'mutation($i:CreateProjectInput!){createProject(createProjectInput:$i){id}}',
    { i: { description: '帮我做一个网站', public: false, model: state.model, template: 'next' } },
    state.token
  );
  state.chatId = r.data?.createProject?.id;
  if (!state.chatId) throw new Error(JSON.stringify(r.errors?.[0]?.message));
  return state.chatId;
});

await node('08 project binds (≤120s)', async () => {
  for (let i = 0; i < 24; i++) {
    const r = await gql(
      'query($c:String!){getChatDetails(chatId:$c){model project{id projectPath}}}',
      { c: state.chatId },
      state.token
    );
    const project = r.data?.getChatDetails?.project;
    if (project?.projectPath) {
      state.projectId = project.id;
      state.projectPath = project.projectPath;
      state.storedModel = r.data.getChatDetails.model;
      return state.projectPath;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error('project never bound');
});

await node('09 chat remembers its model', async () => {
  if (state.storedModel !== state.model)
    throw new Error(`stored ${state.storedModel}`);
  // The home cards label each card by project kind — the chat list has to
  // carry the project along, not just titles.
  const r = await gqlOrThrow(
    '{ getUserChats { id project { template } } }',
    undefined,
    state.token
  );
  const mine = r.data.getUserChats.find((c) => c.id === state.chatId);
  if (mine?.project?.template !== 'next')
    throw new Error(`chat list project: ${JSON.stringify(mine?.project)}`);
});

await node('10 first turn asks, does not build', async () => {
  const { text, tools } = await turn(
    state.chatId,
    '帮我做一个网站',
    state.token
  );
  if (!text.includes('codefox-questions')) throw new Error('no question block');
  if (tools > 0) throw new Error(`built anyway (${tools} tools)`);
  // store like the client does so the next turn sees the exchange
  await gqlOrThrow(
    'mutation($i:ChatInputType!){saveMessage(input:$i)}',
    {
      i: {
        chatId: state.chatId,
        message: text,
        model: state.model,
        role: 'Assistant',
      },
    },
    state.token
  );
});

await node('11 answered turn builds without re-asking', async () => {
  const answer =
    'My choices:\n- 网站主要做什么: 个人主页\n- 风格: 简洁专业\nNote: 单页即可,内容极简';
  await gqlOrThrow(
    'mutation($i:ChatInputType!){saveMessage(input:$i)}',
    {
      i: {
        chatId: state.chatId,
        message: answer,
        model: state.model,
        role: 'User',
      },
    },
    state.token
  );
  const { text, tools } = await turn(state.chatId, answer, state.token);
  if (text.includes('codefox-questions')) throw new Error('asked again');
  if (tools < 1) throw new Error('no tools ran');
  await gqlOrThrow(
    'mutation($i:ChatInputType!){saveMessage(input:$i)}',
    {
      i: {
        chatId: state.chatId,
        message: text || 'built',
        model: state.model,
        role: 'Assistant',
      },
    },
    state.token
  );
  return `${tools} tool calls`;
});

await node('12 changed files listed', async () => {
  const r = await rest(
    `/api/project/changes?path=${state.projectPath}`,
    {},
    state.token
  );
  const { changes } = await r.json();
  if (!Array.isArray(changes) || changes.length === 0)
    throw new Error('no changes');
  return changes
    .map((c) => `${c.status[0].toUpperCase()} ${c.path}`)
    .join(', ')
    .slice(0, 80);
});

await node('13 file reads', async () => {
  const r = await rest(
    `/api/file?path=${encodeURIComponent(`${state.projectPath}/src/app/page.tsx`)}`,
    {},
    state.token
  );
  const { content } = await r.json();
  if (!content || content.length < 100) throw new Error('empty page');
});

await node('14 file writes and shows as change', async () => {
  const marker = `e2e-marker-${ts}`;
  const w = await rest(
    '/api/file',
    {
      method: 'POST',
      body: JSON.stringify({
        filePath: `${state.projectPath}/E2E.md`,
        newContent: marker,
      }),
    },
    state.token
  );
  if (!w.ok) throw new Error(`write ${w.status}`);
  const r = await rest(
    `/api/file?path=${encodeURIComponent(`${state.projectPath}/E2E.md`)}`,
    {},
    state.token
  );
  const { content } = await r.json();
  if (content !== marker) throw new Error('readback mismatch');
  const c = await rest(
    `/api/project/changes?path=${state.projectPath}`,
    {},
    state.token
  );
  const { changes } = await c.json();
  if (!changes?.some((x) => x.path === 'E2E.md' && x.status === 'added'))
    throw new Error('marker not in changes');
});

await node('15 preview comes up (≤180s)', async () => {
  const r = await rest(
    `/api/preview?projectPath=${state.projectPath}`,
    {},
    state.token
  );
  if (!r.ok) throw new Error(`preview ${r.status}`);
  const { domain } = await r.json();
  if (!domain) throw new Error('no domain');
  return domain;
});

await node('16 download is a real zip', async () => {
  const r = await rest(`/download/project/${state.projectId}`, {}, state.token);
  if (!r.ok) throw new Error(`download ${r.status}`);
  const bytes = (await r.arrayBuffer()).byteLength;
  if (bytes < 50_000) throw new Error(`only ${bytes} bytes`);
  return `${Math.round(bytes / 1024)} KB`;
});

await node('17 rename sticks', async () => {
  await gql(
    'mutation($i:UpdateChatTitleInput!){updateChatTitle(updateChatTitleInput:$i){id}}',
    { i: { chatId: state.chatId, title: 'E2E renamed' } },
    state.token
  );
  const r = await gql(
    'query($c:String!){getChatDetails(chatId:$c){title}}',
    { c: state.chatId },
    state.token
  );
  if (r.data?.getChatDetails?.title !== 'E2E renamed')
    throw new Error('title unchanged');
});

await node('18 trailing reply can be dropped', async () => {
  const r = await gql(
    'mutation($c:String!){dropLastAssistantReply(chatId:$c)}',
    { c: state.chatId },
    state.token
  );
  if (r.data?.dropLastAssistantReply !== true)
    throw new Error('nothing dropped');
});

await node('19 ownership guard denies strangers', async () => {
  // Its own second account rather than the deployment's admin: the point is
  // "another signed-in user", and borrowing the admin made this node — and
  // the two after it, which reuse the token — fail on any database that does
  // not happen to have that seeded account.
  const strangerEmail = `e2e-stranger-${ts}@codefox.test`;
  await gqlOrThrow(
    'mutation($i:RegisterUserInput!){registerUser(input:$i){id}}',
    {
      i: {
        username: `stranger${ts}`,
        email: strangerEmail,
        password: PASSWORD,
        confirmPassword: PASSWORD,
      },
    }
  );
  const stranger = await gql(
    'mutation($i:LoginUserInput!){login(input:$i){accessToken}}',
    { i: { email: strangerEmail, password: PASSWORD } }
  );
  state.adminToken = stranger.data?.login?.accessToken;
  if (!state.adminToken) throw new Error('stranger login failed');
  const r = await gql(
    'query($c:String!){getChatHistory(chatId:$c){content}}',
    { c: state.chatId },
    state.adminToken
  );
  if (!r.errors?.[0]?.message?.match(/authoriz/i))
    throw new Error('stranger read the chat');
});

await node('20 fork carries the real files', async () => {
  await gql(
    'mutation($p:ID!,$v:Boolean!){updateProjectPublicStatus(projectId:$p,isPublic:$v){id}}',
    { p: state.projectId, v: true },
    state.token
  );
  const fork = await gql(
    'mutation($p:ID!){forkProject(projectId:$p){id project{projectPath}}}',
    { p: state.projectId },
    state.adminToken
  );
  const forkPath = fork.data?.forkProject?.project?.projectPath;
  if (!forkPath) throw new Error(JSON.stringify(fork.errors?.[0]?.message));
  state.forkChatId = fork.data.forkProject.id;
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const r = await rest(
    `/api/file?path=${encodeURIComponent(`${forkPath}/E2E.md`)}`,
    {},
    state.adminToken
  );
  const { content } = await r.json();
  if (!content?.includes(`e2e-marker-${ts}`))
    throw new Error('fork missing the marker file');

  // The fork counter is what the gallery's trending strategy ranks by. It
  // used to be a read-modify-write on the in-memory row, so simultaneous
  // forks overwrote each other's count — four at once recorded one.
  const counted = await gql(
    'query($id:String!){getProject(projectId:$id){subNumber}}',
    { id: state.projectId },
    state.token,
  );
  if (counted.data?.getProject?.subNumber !== 1)
    throw new Error(
      `one fork counted as ${counted.data?.getProject?.subNumber}`,
    );
});

await node('21 history clears', async () => {
  const r = await gql(
    'mutation($c:String!){clearChatHistory(chatId:$c)}',
    { c: state.chatId },
    state.token
  );
  if (r.data?.clearChatHistory !== true) throw new Error('clear failed');
  const h = await gql(
    'query($c:String!){getChatHistory(chatId:$c){id}}',
    { c: state.chatId },
    state.token
  );
  if ((h.data?.getChatHistory ?? []).length !== 0)
    throw new Error('history survived');
});

await node('22 chat deletes', async () => {
  const r = await gql(
    'mutation($c:String!){deleteChat(chatId:$c)}',
    { c: state.chatId },
    state.token
  );
  if (r.data?.deleteChat !== true) throw new Error('delete failed');
});

await node('23 admin overview answers', async () => {
  // The one node that genuinely needs the deployment's admin account. A
  // stranger's token must be refused first — that is half of what this
  // checks — and the admin half is skipped, loudly, where no such account
  // exists rather than failing a suite run on a fresh database.
  const denied = await gql(
    'query{adminOverview{counts{users}}}',
    undefined,
    state.adminToken
  );
  if (typeof denied.data?.adminOverview?.counts?.users === 'number')
    throw new Error('a non-admin read the admin overview');

  const admin = await gql(
    'mutation($i:LoginUserInput!){login(input:$i){accessToken}}',
    { i: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } }
  );
  const adminToken = admin.data?.login?.accessToken;
  if (!adminToken) return `non-admin denied; no ${ADMIN_EMAIL} here to check`;

  const r = await gql(
    'query{adminOverview{counts{users projects}}}',
    undefined,
    adminToken
  );
  if (typeof r.data?.adminOverview?.counts?.users !== 'number')
    throw new Error(JSON.stringify(r.errors?.[0]?.message));
  return `${r.data.adminOverview.counts.users} users, ${r.data.adminOverview.counts.projects} projects`;
});

await node('24 html project scaffolds instantly', async () => {
  const r = await gqlOrThrow(
    'mutation($i:CreateProjectInput!){createProject(createProjectInput:$i){id}}',
    {
      i: {
        description: '一个双语打招呼页面',
        public: false,
        model: state.model,
        template: 'html',
        // Not the default one, so node 28 can tell a real choice from a
        // fallback.
        style: 'neon',
      },
    },
    state.token,
  );
  state.htmlChatId = r.data.createProject.id;
  for (let i = 0; i < 12; i++) {
    const d = await gql(
      'query($c:String!){getChatDetails(chatId:$c){project{projectPath template}}}',
      { c: state.htmlChatId },
      state.token,
    );
    const project = d.data?.getChatDetails?.project;
    if (project?.projectPath) {
      if (project.template !== 'html') throw new Error(`kind ${project.template}`);
      state.htmlPath = project.projectPath;
      const f = await rest(
        `/api/file?path=${encodeURIComponent(`${state.htmlPath}/index.html`)}`,
        {},
        state.token,
      );
      const { content } = await f.json();
      if (!content?.includes('tailwind')) throw new Error('no starter html');
      return state.htmlPath;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('html project never bound');
});

await node('25 html turn edits the page, nothing else', async () => {
  // Kept: node 29 expects this prompt to be a version's label, and node 30
  // restores back to it.
  state.htmlPrompt = '把页面做成中英双语的打招呼页,深色背景';
  const { tools } = await turn(state.htmlChatId, state.htmlPrompt, state.token);
  if (tools < 1) throw new Error('no tools ran');
  const f = await rest(
    `/api/file?path=${encodeURIComponent(`${state.htmlPath}/index.html`)}`,
    {},
    state.token,
  );
  const { content } = await f.json();
  if (!content || content.length < 600) throw new Error('page unchanged');
  if (content.includes('package.json')) throw new Error('toolchain leaked in');
  return `${content.length} bytes`;
});

await node('26 html changes are exactly the page', async () => {
  const r = await rest(`/api/project/changes?path=${state.htmlPath}`, {}, state.token);
  const { changes } = await r.json();
  if (!changes?.some((c) => c.path === 'index.html')) throw new Error('index.html not listed');
});

await node('28 the chosen design system is in the page', async () => {
  const r = await gqlOrThrow('query{designSystems{id name bg accent}}');
  const neon = r.data.designSystems.find((s) => s.id === 'neon');
  if (!neon) throw new Error('neon not offered');
  if (!/^#/.test(neon.bg)) throw new Error(`swatch unparsed: ${neon.bg}`);

  const f = await rest(
    `/api/file?path=${encodeURIComponent(`${state.htmlPath}/index.html`)}`,
    {},
    state.token,
  );
  const { content } = await f.json();
  // The tokens are baked into the page at scaffold time, and node 25's turn
  // has already rewritten it — the style has to survive the agent.
  if (!content.includes(neon.bg))
    throw new Error(`page lost its ${neon.name} canvas (${neon.bg})`);
  if (!content.includes('--accent'))
    throw new Error('page has no token contract');
  return `${neon.name} ${neon.bg}`;
});

await node('29 each turn left a version', async () => {
  const r = await rest(`/api/project/versions?path=${state.htmlPath}`, {}, state.token);
  if (!r.ok) throw new Error(`versions ${r.status}`);
  const { versions } = await r.json();
  if (!versions?.length) throw new Error('no history at all');
  if (!versions.some((v) => v.label === 'starter baseline'))
    throw new Error('baseline missing');
  // Node 25 ran a real turn against this project, so its prompt is a version.
  if (versions.length < 2)
    throw new Error(`turn was not snapshotted (${versions.length} versions)`);
  if (versions.filter((v) => v.current).length !== 1)
    throw new Error('exactly one version must be current');
  state.baselineId = versions[versions.length - 1].id;
  return versions.map((v) => v.label).join(' | ');
});

await node('30 restore puts the files back, and is itself undoable', async () => {
  const before = await rest(
    `/api/file?path=${encodeURIComponent(`${state.htmlPath}/index.html`)}`,
    {},
    state.token,
  ).then((r) => r.json());

  const r = await rest(
    '/api/project/restore',
    {
      method: 'POST',
      body: JSON.stringify({ path: state.htmlPath, versionId: state.baselineId }),
    },
    state.token,
  );
  if (!r.ok) throw new Error(`restore ${r.status}`);

  const after = await rest(
    `/api/file?path=${encodeURIComponent(`${state.htmlPath}/index.html`)}`,
    {},
    state.token,
  ).then((r) => r.json());
  if (after.content === before.content) throw new Error('files did not move');
  if (after.content.length > 3000)
    throw new Error('did not go back to the starter');

  // The state that was replaced has to still be reachable, or restore is a
  // way to lose work rather than to undo it. It is normally already a
  // version — turns commit — so what matters is that some version still
  // holds the replaced content, not which label it wears.
  const { versions } = await rest(
    `/api/project/versions?path=${state.htmlPath}`,
    {},
    state.token,
  ).then((r) => r.json());
  if (!versions.some((v) => v.label.includes('Restored to')))
    throw new Error('the restore itself was not recorded');

  const undo = versions.find(
    (v) => v.label === 'Before restore' || v.label === state.htmlPrompt,
  );
  if (!undo) throw new Error('nothing to undo the restore with');
  const back = await rest(
    '/api/project/restore',
    { method: 'POST', body: JSON.stringify({ path: state.htmlPath, versionId: undo.id }) },
    state.token,
  );
  if (!back.ok) throw new Error(`undo ${back.status}`);
  const restored = await rest(
    `/api/file?path=${encodeURIComponent(`${state.htmlPath}/index.html`)}`,
    {},
    state.token,
  ).then((r) => r.json());
  if (restored.content !== before.content)
    throw new Error('the replaced state was not recoverable');
  return `${before.content.length}B -> ${after.content.length}B -> back`;
});

await node('31 restore refuses what is not a version', async () => {
  const bad = async (versionId) =>
    (
      await rest(
        '/api/project/restore',
        { method: 'POST', body: JSON.stringify({ path: state.htmlPath, versionId }) },
        state.token,
      )
    ).status;

  // This string reaches a command line.
  if ((await bad('; rm -rf /')) !== 400) throw new Error('injection not refused');
  if ((await bad('')) !== 400) throw new Error('empty id not refused');
  // Well-formed but not in this project.
  const absent = await bad('0123456789abcdef0123456789abcdef01234567');
  if (absent !== 404 && absent !== 400) throw new Error(`absent sha -> ${absent}`);

  const anon = await fetch(
    `${BASE}/api/project/versions?path=${state.htmlPath}`,
  );
  if (anon.status !== 401) throw new Error(`anonymous -> ${anon.status}`);
});

await node('33 a published page is a link anyone can open', async () => {
  const share = async (id) => {
    // No token on purpose: a share link that needs a login is not one.
    const r = await fetch(`${BASE}/share/${id}`);
    return { status: r.status, body: await r.text(), headers: r.headers };
  };

  const detail = await gqlOrThrow(
    'query($c:String!){getChatDetails(chatId:$c){project{id uniqueProjectId}}}',
    { c: state.htmlChatId },
    state.token,
  );
  const project = detail.data.getChatDetails.project;
  const shareId = project.uniqueProjectId;
  if (!shareId) throw new Error('project has no share id');

  // Private first: publishing is what creates the link.
  if ((await share(shareId)).status !== 404)
    throw new Error('a private project was served to a stranger');

  await gqlOrThrow(
    'mutation($p:ID!,$v:Boolean!){updateProjectPublicStatus(projectId:$p,isPublic:$v){id}}',
    { p: project.id, v: true },
    state.token,
  );

  const live = await share(shareId);
  if (live.status !== 200) throw new Error(`published page -> ${live.status}`);
  if (!live.body.toLowerCase().includes('<!doctype html'))
    throw new Error('did not serve the page itself');
  // Untrusted HTML on this origin: without the sandbox a shared page could
  // read the session of whoever opens it.
  const csp = live.headers.get('content-security-policy') ?? '';
  if (!csp.includes('sandbox')) throw new Error(`unsandboxed: "${csp}"`);

  // The directory name is what the authenticated file routes key on; it must
  // not double as a public identifier.
  if ((await share(state.htmlPath)).status !== 404)
    throw new Error('projectPath worked as a share id');
  if ((await share('not-a-uuid')).status !== 404)
    throw new Error('garbage id not refused');

  // Pasted into a chat app the link has to preview as something. The tags are
  // injected server-side, addressed at the host the visitor actually used.
  const crawled = await fetch(`${BASE}/share/${shareId}`, {
    headers: { 'x-forwarded-host': 'codefox.example', 'x-forwarded-proto': 'https' },
  });
  const card = await crawled.text();
  if (!/<meta property="og:title"/.test(card))
    throw new Error('no link preview title');
  if (!/<meta name="twitter:card"/.test(card))
    throw new Error('no twitter card');
  // Addressed at the product's domain, not the API host behind the rewrite.
  const image = card.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  if (image && !image.startsWith('https://codefox.example/'))
    throw new Error(`card image points at ${image}`);
  // The page itself must survive the injection untouched.
  if (!card.includes('</body>')) throw new Error('page mangled by injection');

  // A site may be several linked pages — the agent is instructed to add
  // them — so a shared link has to follow those links, and must not become
  // a way to read the project's other files.
  await rest(
    '/api/file',
    {
      method: 'POST',
      body: JSON.stringify({
        filePath: `${state.htmlPath}/about.html`,
        newContent: '<!doctype html><html><body>about page</body></html>',
      }),
    },
    state.token,
  );
  await rest(
    '/api/file',
    {
      method: 'POST',
      body: JSON.stringify({
        filePath: `${state.htmlPath}/notes.md`,
        newContent: 'not for the public',
      }),
    },
    state.token,
  );

  const about = await share(`${shareId}/about.html`);
  if (about.status !== 200) throw new Error(`linked page -> ${about.status}`);
  if (!about.body.includes('about page'))
    throw new Error('linked page served the wrong file');
  for (const path of ['notes.md', '../../etc/passwd', '..%2f..%2fx.html']) {
    if ((await share(`${shareId}/${path}`)).status !== 404)
      throw new Error(`${path} was served`);
  }

  return `${live.body.length}B served anonymously`;
});

await node('34 both gallery strategies answer with the same wall', async () => {
  const wall = async (strategy, size = 6) => {
    const r = await gqlOrThrow(
      'query($i:FetchPublicProjectsInputs!){fetchPublicProjects(input:$i){projectName subNumber}}',
      { i: { size, strategy } },
    );
    return r.data.fetchPublicProjects;
  };

  const latest = await wall('latest');
  const trending = await wall('trending');
  // `trending` used to take ceil(total * 0.01) of the public projects, so it
  // returned exactly one at every catalogue size the product has ever had —
  // it only stopped being degenerate past 600 projects.
  if (trending.length !== latest.length)
    throw new Error(
      `trending returned ${trending.length} where latest returned ${latest.length}`,
    );
  // Ranked by forks, most first.
  const forks = trending.map((p) => p.subNumber ?? 0);
  if (forks.some((n, i) => i > 0 && n > forks[i - 1]))
    throw new Error(`trending is not ordered by forks: ${forks.join(',')}`);
  // The size the caller asked for is the only limit.
  if (trending.length > 6) throw new Error('trending ignored size');

  return `${latest.length} latest, ${trending.length} trending`;
});

await node('36 a hand edit is the user’s own version, not the agent’s', async () => {
  const versions = async () =>
    (
      await rest(
        `/api/project/versions?path=${state.htmlPath}`,
        {},
        state.token,
      ).then((r) => r.json())
    ).versions;

  const mine = '<p>typed by hand, not by the agent</p>';
  await rest(
    '/api/file',
    {
      method: 'POST',
      body: JSON.stringify({
        filePath: `${state.htmlPath}/by-hand.html`,
        newContent: mine,
      }),
    },
    state.token,
  );
  // Editing does not commit — only turns do — so nothing is a version yet.
  const before = await versions();
  if (before.some((v) => v.label === 'Your edits'))
    throw new Error('an edit committed itself');

  await turn(state.htmlChatId, '把首页标题改成 Hand Edit Check', state.token);

  const after = await versions();
  // The turn used to fold the hand edit into its own commit, under the
  // agent's prompt: restoring to before that turn threw away work the user
  // did themselves, and the history credited it to the agent.
  const own = after.find((v) => v.label === 'Your edits');
  if (!own) throw new Error('the hand edit was swept into the agent’s commit');
  if (after.indexOf(own) === 0)
    throw new Error('the agent’s turn left no version of its own');

  await rest(
    '/api/project/restore',
    {
      method: 'POST',
      body: JSON.stringify({ path: state.htmlPath, versionId: own.id }),
    },
    state.token,
  );
  const back = await rest(
    `/api/file?path=${encodeURIComponent(`${state.htmlPath}/by-hand.html`)}`,
    {},
    state.token,
  ).then((r) => r.json());
  if (back.content !== mine)
    throw new Error('the user’s own work did not come back');

  return after.map((v) => v.label.slice(0, 14)).join(' | ');
});

await node('37 the agent hears about a hand edit, the chat does not', async () => {
  // Its own project and its own chat. Sharing node 36's would poison this:
  // that project holds a file called by-hand.html and that chat's history
  // talks about editing it, so "which file did I edit by hand" has a
  // convincing wrong answer sitting in plain sight.
  const made = await gqlOrThrow(
    'mutation($i:CreateProjectInput!){createProject(createProjectInput:$i){id}}',
    {
      i: {
        description: 'context wire check',
        public: false,
        model: state.model,
        template: 'html',
      },
    },
    state.token,
  );
  const chatId = made.data.createProject.id;
  let projectPath = null;
  for (let i = 0; i < 12 && !projectPath; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const d = await gql(
      'query($c:String!){getChatDetails(chatId:$c){project{projectPath}}}',
      { c: chatId },
      state.token,
    );
    projectPath = d.data?.getChatDetails?.project?.projectPath;
  }
  if (!projectPath) throw new Error('project never bound');

  // A name that answers nothing on its own — the only way to know it is to
  // have been told.
  const marker = `zq7-${ts}.html`;
  const written = await rest(
    '/api/file',
    {
      method: 'POST',
      body: JSON.stringify({
        filePath: `${projectPath}/${marker}`,
        newContent: '<!doctype html><title>hand</title><p>by hand</p>',
      }),
    },
    state.token,
  );
  if (!written.ok) throw new Error(`could not write the hand edit: ${written.status}`);

  const { text } = await turn(
    chatId,
    'Do not read, list or change any file. From what you were told at the ' +
      'start of this message, answer in one line with the exact filename I ' +
      'edited by hand just now.',
    state.token,
  );
  if (!text.includes(marker))
    throw new Error(`the agent was not told: ${text.slice(0, 120)}`);

  // The note is prompt-only. It must never become part of the conversation
  // the user reads back.
  const history = await gqlOrThrow(
    'query($c:String!){getChatHistory(chatId:$c){content}}',
    { c: chatId },
    state.token,
  );
  const said = history.data.getChatHistory.map((m) => m.content).join('\n');
  if (said.includes('edited these files themselves'))
    throw new Error('bookkeeping leaked into the chat');

  await gqlOrThrow(
    'mutation($c:String!){deleteChat(chatId:$c)}',
    { c: chatId },
    state.token,
  );
  return marker;
});

await node('35 a page prints to a real PDF', async () => {
  const r = await rest(
    `/api/pdf?projectPath=${encodeURIComponent(state.htmlPath)}`,
    {},
    state.token,
  );
  if (!r.ok) throw new Error(`pdf ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== '%PDF-')
    throw new Error(`not a pdf (${buf.length} bytes)`);
  // A blank A4 is about 1KB; the page's own design has to survive printing,
  // which is what printBackground buys.
  if (buf.length < 3000) throw new Error(`suspiciously small: ${buf.length}B`);
  if (!/filename=".*\.pdf"/.test(r.headers.get('content-disposition') ?? ''))
    throw new Error('no download filename');

  // Printing reads; it must still refuse someone with no claim on the
  // project, and anyone at all before signing in.
  const anon = await fetch(
    `${BASE}/api/pdf?projectPath=${encodeURIComponent(state.htmlPath)}`,
  );
  if (anon.status !== 401) throw new Error(`anonymous pdf -> ${anon.status}`);

  return `${Math.round(buf.length / 1024)} KB pdf`;
});

await node('32 html cover shoots the file', async () => {
  // No dev server exists for an html project — the controller must fall
  // back to shooting the file itself.
  const r = await rest(
    `/api/screenshot?projectPath=${encodeURIComponent(state.htmlPath)}`,
    {},
    state.token,
  );
  if (!r.ok) throw new Error(`screenshot ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.slice(1, 4).toString() !== 'PNG')
    throw new Error(`not a png (${buf.length} bytes)`);
  await gqlOrThrow(
    'mutation($c:String!){deleteChat(chatId:$c)}',
    { c: state.htmlChatId },
    state.token,
  );
  return `${Math.round(buf.length / 1024)} KB png`;
});

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} nodes green`
);
if (failed.length) {
  console.log('failed:', failed.map((f) => f.name).join(' | '));
  process.exit(1);
}
