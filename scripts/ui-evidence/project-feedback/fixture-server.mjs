// Local-only QA fixtures for the actual CodeFox frontend. No real accounts or writes.
import http from 'node:http';
import fs from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const base = process.env.CODEFOX_FIXTURE_DIR || dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.CODEFOX_FIXTURE_PORT || 3116);
const project = { __typename: 'Project', id: 'fixture-project', projectName: 'LOCAL FIXTURE: project feedback', projectPath: 'fixture-project', template: 'html', isPublic: false, uniqueProjectId: 'fixture-share', userId: 'fixture-user', photoUrl: null, forkedFromId: null, isDeleted: false, subNumber: 0, createdAt: '2026-10-01T08:00:00Z' };
const chat = { __typename: 'Chat', id: 'fixture-chat', title: 'LOCAL FIXTURE: project feedback', createdAt: project.createdAt, model: 'fixture-model', userId: 'fixture-user', project };
const messages = [
  { __typename: 'Message', id: 'fixture-user-message', content: 'Show the project-action feedback fixture.', role: 'User', createdAt: project.createdAt, steps: [] },
  { __typename: 'Message', id: 'fixture-assistant-message', content: 'This is a local UI fixture. No model call, real account, publication or deployment is involved.', role: 'Assistant', createdAt: project.createdAt, steps: [] },
];
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:3102');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization,apollo-require-preflight');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const state = JSON.parse(fs.readFileSync(`${base}/fixture-state.json`, 'utf8'));
  const respond = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.url.startsWith('/graphql')) {
    let body = ''; for await (const chunk of req) body += chunk;
    if (!req.headers['content-type']?.includes('application/json')) return respond({ data: { updateProjectPhoto: { __typename: 'Project', id: project.id, photoUrl: null } } });
    const { operationName: op, query, variables = {} } = JSON.parse(body || '{}');
    fs.appendFileSync(`${base}/fixture-requests.jsonl`, JSON.stringify({ time: new Date().toISOString(), op, variables, scenario: state.scenario }) + '\n');
    if (state.scenario === 'list-error' && ['GetUserChats', 'FetchPublicProjects'].includes(op)) return respond({ errors: [{ message: 'Fixture network failure' }] });
    if (op === 'DuplicateProject') {
      if (state.scenario === 'duplicate-error') return respond({ errors: [{ message: 'Fixture backend transport failure' }] });
      return respond({ data: { duplicateProject: state.scenario === 'duplicate-no-id' ? null : { __typename: 'Chat', id: 'fixture-copy-chat' } } });
    }
    if (op === 'ClearChatHistory') {
      if (state.scenario === 'clear-error') return respond({ errors: [{ message: 'Fixture clear failure' }] });
      fs.writeFileSync(`${base}/fixture-state.json`, JSON.stringify({ ...state, messagesCleared: true }));
      return respond({ data: { clearChatHistory: true } });
    }
    const map = {
      CheckToken: { checkToken: true },
      RegistrationOpen: { registrationOpen: false },
      me: { me: { __typename: 'User', id: 'fixture-user', username: 'Local fixture', email: 'fixture@example.test', avatarUrl: null, githubInstallationId: null } },
      MyRoles: { myRoles: [] },
      GetUserChats: { getUserChats: state.scenario === 'empty' ? [] : [chat] },
      GetUserProjects: { getUserProjects: [project] },
      FetchPublicProjects: { fetchPublicProjects: state.scenario === 'empty' ? [] : [{ ...project, isPublic: true, user: { __typename: 'User', username: 'Fixture creator' } }] },
      GetAvailableModelTags: { getAvailableModelTags: ['fixture-model'] },
      GetChatDetails: { getChatDetails: { ...chat, id: variables.chatId || chat.id, messages } },
      GetChatHistory: { getChatHistory: state.messagesCleared ? [] : messages },
      GetProject: { getProject: { ...project, isPublic: state.isPublic || false } },
      UpdateProjectPublicStatus: { updateProjectPublicStatus: { ...project, isPublic: variables.isPublic } },
    };
    if (query?.includes('login(')) return respond({ data: { login: { __typename: 'AuthResponse', accessToken: 'local-fixture-only-not-a-credential', refreshToken: 'local-fixture-only-not-a-credential' } } });
    if (query?.includes('scenarios')) return respond({ data: { scenarios: [] } });
    if (query?.includes('designSystems')) return respond({ data: { designSystems: [] } });
    if (query?.includes('authConfig')) return respond({ data: { authConfig: { allowSignup: false, mailEnabled: false } } });
    if (query?.includes('myQuota')) return respond({ data: { myQuota: { maxProjects: 10, projectCount: 1, maxMessagesPerDay: 10, messagesToday: 0 } } });
    if (op === 'UpdateProjectPublicStatus') fs.writeFileSync(`${base}/fixture-state.json`, JSON.stringify({ ...state, isPublic: variables.isPublic }));
    if (!map[op]) console.log('UNHANDLED GRAPHQL', op, query?.slice(0, 150));
    return respond({ data: map[op] || {} });
  }
  if (req.url.startsWith('/api/screenshot')) return respond({ message: 'Fixture does not persist screenshot uploads' }, 503);
  if (req.url.startsWith('/api/file')) return respond({ content: '<!doctype html><html><body style="background:#151717;color:#d0d9d4;font-family:system-ui;padding:48px"><h1>LOCAL FIXTURE</h1><p>Project-action feedback QA</p><p>No generated output or production data.</p></body></html>' });
  if (req.url.startsWith('/api/project')) return respond({ res: { 'index.html': { name: 'index.html', type: 'file' } } });
  if (req.url.startsWith('/api/preview')) return respond({ domain: `localhost:${port}/fixture-preview`, containerId: 'fixture-preview' });
  if (req.url.startsWith('/fixture-preview')) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><html><body style="background:#151717;color:#d0d9d4;font-family:system-ui;padding:48px"><h1>LOCAL FIXTURE</h1><p>Project-action feedback QA</p><p>No generated output or production data.</p></body></html>'); return; }
  return respond({ ok: true, commits: [], files: [] });
}).listen(port, '127.0.0.1', () => console.log(`Local project-feedback fixtures on ${port}`));
