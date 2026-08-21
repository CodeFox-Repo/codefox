#!/usr/bin/env node
/**
 * End-to-end for /api/agent — the surface a local coding agent talks to.
 *
 *   node scripts/e2e-agent-api.mjs
 *
 * Env: BASE (default http://localhost:8080). Registration must be open on the
 * target; the script creates its own throwaway accounts.
 *
 * It plays the part of Claude Code in someone's terminal: register, log in,
 * create a project through the web API (creation is deliberately not part of
 * the agent surface), then do everything else over REST — status, send a
 * message, poll the turn, read the reply, collect the links and actually
 * fetch the page. Runs one real agent turn, so it spends model tokens and
 * takes a minute or two. Exit code 0 = the loop closed.
 */

const BASE = process.env.BASE ?? 'http://localhost:8080';
const password = 'Sup3rSecret!e2e';
const stamp = Date.now();

const gql = async (query, variables, token) => {
  const res = await fetch(`${BASE}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
};

const register = async (email, username) => {
  await gql(
    `mutation($i:RegisterUserInput!){registerUser(input:$i){id}}`,
    { i: { email, password, confirmPassword: password, username } },
  );
  const { login } = await gql(
    `mutation($i:LoginUserInput!){login(input:$i){accessToken}}`,
    { i: { email, password } },
  );
  return login.accessToken;
};

let TOKEN = '';
const api = async (path, init = {}) => {
  const res = await fetch(path.startsWith('http') ? path : `${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (label, detail = '') => console.log(`ok — ${label}${detail && ` (${detail})`}`);
const must = (cond, why) => {
  if (!cond) {
    console.error(`FAIL — ${why}`);
    process.exit(1);
  }
};

TOKEN = await register(`agent-e2e-${stamp}@example.com`, 'e2e-agent');
ok('registered and signed in');

const anon = await fetch(`${BASE}/api/agent/projects`);
must(anon.status === 401, `an unauthenticated call was answered ${anon.status}`);
ok('refuses a caller with no token');

const { createProject } = await gql(
  `mutation($i:CreateProjectInput!){createProject(createProjectInput:$i){id}}`,
  {
    i: {
      description: 'A one-page site for a tiny coffee stand called Fox Roast.',
      projectName: 'Fox Roast',
      template: 'html',
      public: true,
    },
  },
  TOKEN,
);
must(createProject?.id, 'the project was not created');

// --- list, and wait for the workspace to exist ----------------------------
let project;
for (let i = 0; i < 60; i++) {
  const list = await api('/api/agent/projects');
  must(Array.isArray(list.body.projects), `projects list came back ${list.status}`);
  project = list.body.projects[0];
  if (project?.scaffolded) break;
  await sleep(1000);
}
must(project?.scaffolded, 'the project never got a workspace');
ok('lists the project and reports it scaffolded', project.projectName);

const id = project.id;

// --- send a message -------------------------------------------------------
const sent = await api(`/api/agent/projects/${id}/messages`, {
  method: 'POST',
  body: JSON.stringify({
    message:
      'Change the page title and the hero heading to "Fox Roast — 狐狸烘焙". Keep everything else.',
  }),
});
must(sent.status < 400, `send answered ${sent.status}: ${JSON.stringify(sent.body)}`);
ok('accepted the message', sent.body.status);

// The window this exists to cover: `busy()` only goes true once the turn
// reaches the project queue, which is after this response was written.
const immediately = await api(`/api/agent/projects/${id}`);
must(immediately.body.running, 'the turn reported idle the instant it started');
ok('reports the turn as running straight away');

// --- poll to the end ------------------------------------------------------
let status;
for (let i = 0; i < 120; i++) {
  await sleep(5000);
  status = await api(`/api/agent/projects/${id}`);
  if (!status.body.running) break;
}
must(status && !status.body.running, 'the turn never finished');
must(!status.body.lastTurn?.errored, `the turn errored: ${status.body.lastTurn?.errorText}`);
ok(
  'the turn finished and was recorded',
  `${Math.round(status.body.lastTurn.durationMs / 1000)}s, ${status.body.lastTurn.toolCalls} tool calls, sha ${String(status.body.lastTurn.sha).slice(0, 8)}`,
);

// --- the reply is in the chat, not only in the turn record ----------------
const messages = await api(`/api/agent/projects/${id}/messages?limit=4`);
const last = messages.body.messages.at(-1);
must(last?.role === 'assistant', 'the reply was not saved to the chat');
ok('the reply is in the conversation', `${last.content.length} chars`);

// --- links, and actually fetching what they point at ----------------------
const links = await api(`/api/agent/projects/${id}/links`);
must(links.body.share, 'a public page project has no share link');
const shared = await fetch(links.body.share);
must(shared.ok, `the share link answered ${shared.status}`);
ok('the share link is fetchable anonymously', `${(await shared.text()).length} bytes`);

const entry = await api(links.body.entry);
must(entry.body.content?.includes('狐狸烘焙'), 'the page does not show the change');
ok('the page itself is readable with the token, and carries the edit');

// --- and nobody else's ----------------------------------------------------
const intruder = await register(`intruder-${stamp}@example.com`, 'intruder');
const stolen = await fetch(`${BASE}/api/agent/projects/${id}`, {
  headers: { authorization: `Bearer ${intruder}` },
});
must(stolen.status === 403, `another user read it: ${stolen.status}`);
const forged = await fetch(`${BASE}/api/agent/projects/${id}`, {
  headers: { authorization: 'Bearer not-a-real-token' },
});
must(forged.status === 401, `a forged token was answered ${forged.status}`);
ok('refuses another account and a forged token');

console.log('\nagent API e2e: green');
