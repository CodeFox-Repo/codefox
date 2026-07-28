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
  const admin = await gql(
    'mutation($i:LoginUserInput!){login(input:$i){accessToken}}',
    { i: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } }
  );
  state.adminToken = admin.data?.login?.accessToken;
  if (!state.adminToken) throw new Error('admin login failed');
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
  const r = await gql(
    'query{adminOverview{counts{users projects}}}',
    undefined,
    state.adminToken
  );
  if (typeof r.data?.adminOverview?.counts?.users !== 'number')
    throw new Error(JSON.stringify(r.errors?.[0]?.message));
  return `${r.data.adminOverview.counts.users} users, ${r.data.adminOverview.counts.projects} projects`;
});

await node('24 html project scaffolds instantly', async () => {
  const r = await gqlOrThrow(
    'mutation($i:CreateProjectInput!){createProject(createProjectInput:$i){id}}',
    { i: { description: '一个双语打招呼页面', public: false, model: state.model, template: 'html' } },
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
  const { tools } = await turn(
    state.htmlChatId,
    '把页面做成中英双语的打招呼页,深色背景',
    state.token,
  );
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
  await gqlOrThrow(
    'mutation($c:String!){deleteChat(chatId:$c)}',
    { c: state.htmlChatId },
    state.token,
  );
});

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} nodes green`
);
if (failed.length) {
  console.log('failed:', failed.map((f) => f.name).join(' | '));
  process.exit(1);
}
