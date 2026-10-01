import React from 'react';
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { CodeEngine } from '../code-engine';
import { ProjectContext } from '../project-context';
import { authenticatedFetch } from '@/lib/authenticatedFetch';
import { toast } from 'sonner';

jest.mock('../project-context', () => ({
  ProjectContext: jest.requireActual('react').createContext({}),
}));
jest.mock('@/lib/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));
jest.mock('@/app/log/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));
jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => children,
  motion: {
    div: ({ children, initial, animate, exit, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
  },
}));
jest.mock('../responsive-toolbar', () => ({
  __esModule: true,
  default: ({ setActiveTab }: any) => (
    <button onClick={() => setActiveTab('code')}>Code</button>
  ),
}));
jest.mock('../tabs/preview-tab', () => ({
  __esModule: true,
  default: () => <div>Preview fixture</div>,
}));
jest.mock('../tabs/console-tab', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../tabs/code-tab', () => ({
  __esModule: true,
  default: ({ newCode, updateSavingStatus, setFilePath, fileReady }: any) => (
    <>
      <textarea
        aria-label="File editor"
        readOnly={!fileReady}
        value={newCode}
        onChange={(e) => updateSavingStatus(e.target.value)}
      />
      <button onClick={() => setFilePath('other.html')}>Open other file</button>
    </>
  ),
}));

const project = { id: 'project-a', projectPath: 'project-a' };
const fetchMock = authenticatedFetch as jest.Mock;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function wrapper(
  pollChatProject: jest.Mock,
  chatId = 'chat-a',
  isProjectReady = true,
  turnsDone = 0
) {
  return (
    <ProjectContext.Provider
      value={
        {
          curProject: null,
          projectLoading: false,
          pollChatProject,
          editorRef: { current: null },
          turnsDone,
        } as any
      }
    >
      <CodeEngine chatId={chatId} isProjectReady={isProjectReady} />
    </ProjectContext.Provider>
  );
}
beforeEach(() => {
  localStorage.clear();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => ({
    ok: init?.method !== 'POST',
    status: 500,
    json: async () =>
      url.startsWith('/api/project?')
        ? {
            res: {
              'root/index.html': { isFolder: false },
              'root/other.html': { isFolder: false },
            },
          }
        : { content: '<h1>Saved file</h1>' },
  }));
});
afterEach(() => jest.useRealTimers());

it('stays indeterminate beyond the old six-minute timer and ignores cached completion', async () => {
  jest.useFakeTimers();
  localStorage.setItem('project-completed-chat-a', 'true');
  const pending = deferred<any>();
  render(wrapper(jest.fn(() => pending.promise)));
  expect(screen.getByRole('status')).toHaveTextContent(
    'Preparing your project…'
  );
  await act(async () => {
    jest.advanceTimersByTime(7 * 60 * 1000);
  });
  expect(screen.getByRole('status')).toHaveTextContent(
    'Preparing your project…'
  );
  expect(screen.queryByText(/\d+%|Project ready/)).not.toBeInTheDocument();
  await act(async () => {
    pending.resolve(project);
  });
  expect(screen.queryByText('Preparing your project…')).not.toBeInTheDocument();
});

it('keeps preparing until the readiness signal and resolved path agree', async () => {
  const poll = jest.fn().mockResolvedValue(project);
  const { rerender } = render(wrapper(poll, 'chat-a', false));
  await act(async () => {});
  expect(screen.getByRole('status')).toHaveTextContent(
    'Preparing your project…'
  );
  await act(async () => rerender(wrapper(poll)));
  expect(screen.queryByText('Preparing your project…')).not.toBeInTheDocument();
});

it('does not carry a previous chat’s ready state into a newer navigation', async () => {
  const pending = deferred<any>();
  const poll = jest.fn((chat) =>
    chat === 'chat-a' ? Promise.resolve(project) : pending.promise
  );
  const { rerender } = render(wrapper(poll));
  await waitFor(() =>
    expect(
      screen.queryByText('Preparing your project…')
    ).not.toBeInTheDocument()
  );
  rerender(wrapper(poll, 'chat-b'));
  expect(screen.getByRole('status')).toHaveTextContent(
    'Preparing your project…'
  );
  await act(async () => {
    pending.resolve({ id: 'project-b', projectPath: 'project-b' });
  });
  expect(screen.queryByText('Preparing your project…')).not.toBeInTheDocument();
});

it('ends preparation when the chat has no project', async () => {
  render(wrapper(jest.fn().mockResolvedValue(null)));
  expect(await screen.findByText('NO PROJECT')).toBeInTheDocument();
  expect(screen.queryByText('Preparing your project…')).not.toBeInTheDocument();
});

it('keeps the actual edit and save action after a failed save, then discards only the edit', async () => {
  render(wrapper(jest.fn().mockResolvedValue(project)));
  fireEvent.click(screen.getByRole('button', { name: 'Code' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveValue(
      '<h1>Saved file</h1>'
    )
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'File editor' }), {
    target: { value: 'My unsaved edit' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save file' }));
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't save this file. Your edits are still here. Try again."
    )
  );
  expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveValue(
    'My unsaved edit'
  );
  expect(screen.getByRole('button', { name: 'Save file' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
  expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveValue(
    '<h1>Saved file</h1>'
  );
  expect(
    screen.queryByRole('button', { name: 'Save file' })
  ).not.toBeInTheDocument();
});

it('does not claim an older draft is still visible after file navigation during a save', async () => {
  const pending = deferred<any>();
  const normalFetch = fetchMock.getMockImplementation();
  fetchMock.mockImplementation((url, init) =>
    init?.method === 'POST' ? pending.promise : normalFetch!(url, init)
  );
  render(wrapper(jest.fn().mockResolvedValue(project)));
  fireEvent.click(screen.getByRole('button', { name: 'Code' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveValue(
      '<h1>Saved file</h1>'
    )
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'File editor' }), {
    target: { value: 'Older draft' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save file' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open other file' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveValue(
      '<h1>Saved file</h1>'
    )
  );
  await act(async () => pending.resolve({ ok: false, status: 500 }));
  expect(toast.error).toHaveBeenCalledWith(
    "Couldn't save index.html. The editor has changed since this save started."
  );
  expect(toast.error).not.toHaveBeenCalledWith(
    expect.stringContaining('Your edits are still here')
  );
});

it('keeps newer edits unsaved when an earlier save succeeds', async () => {
  const pending = deferred<any>();
  const normalFetch = fetchMock.getMockImplementation();
  fetchMock.mockImplementation((url, init) =>
    init?.method === 'POST' ? pending.promise : normalFetch!(url, init)
  );
  render(wrapper(jest.fn().mockResolvedValue(project)));
  fireEvent.click(screen.getByRole('button', { name: 'Code' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveValue(
      '<h1>Saved file</h1>'
    )
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'File editor' }), {
    target: { value: 'Saved draft' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save file' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'File editor' }), {
    target: { value: 'Newer edit' },
  });
  await act(async () => pending.resolve({ ok: true, json: async () => ({}) }));
  expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveValue(
    'Newer edit'
  );
  expect(screen.getByRole('button', { name: 'Save file' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
  expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveValue(
    'Saved draft'
  );
});

it('preserves a dirty file when a background tree refresh arrives', async () => {
  const poll = jest.fn().mockResolvedValue(project);
  const { rerender } = render(wrapper(poll));
  fireEvent.click(screen.getByRole('button', { name: 'Code' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveValue(
      '<h1>Saved file</h1>'
    )
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'File editor' }), {
    target: { value: 'Keep this unsaved draft' },
  });
  await act(async () => rerender(wrapper(poll, 'chat-a', true, 1)));
  expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveValue(
    'Keep this unsaved draft'
  );
  expect(screen.getByRole('button', { name: 'Save file' })).toBeInTheDocument();
});

it('drops a delayed save message after navigating to another chat', async () => {
  const pending = deferred<any>();
  const normalFetch = fetchMock.getMockImplementation();
  fetchMock.mockImplementation((url, init) =>
    init?.method === 'POST' ? pending.promise : normalFetch!(url, init)
  );
  const poll = jest.fn().mockResolvedValue(project);
  const { rerender } = render(wrapper(poll));
  fireEvent.click(screen.getByRole('button', { name: 'Code' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveValue(
      '<h1>Saved file</h1>'
    )
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'File editor' }), {
    target: { value: 'Previous chat edit' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save file' }));
  await act(async () => rerender(wrapper(poll, 'chat-b')));
  await act(async () => pending.resolve({ ok: false, status: 500 }));
  expect(toast.error).not.toHaveBeenCalled();
});

it('cannot edit or save the previous file contents while the next file is loading', async () => {
  const pending = deferred<any>();
  const normalFetch = fetchMock.getMockImplementation();
  fetchMock.mockImplementation((url, init) =>
    String(url).includes('other.html')
      ? pending.promise
      : normalFetch!(url, init)
  );
  render(wrapper(jest.fn().mockResolvedValue(project)));
  fireEvent.click(screen.getByRole('button', { name: 'Code' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveValue(
      '<h1>Saved file</h1>'
    )
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'File editor' }), {
    target: { value: 'File A draft' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Open other file' }));
  expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveAttribute(
    'readonly'
  );
  // Even an already queued editor event cannot mark A's text as a B draft.
  fireEvent.change(screen.getByRole('textbox', { name: 'File editor' }), {
    target: { value: 'Wrong contents for file B' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save file' }));
  expect(toast.error).toHaveBeenCalledWith(
    'Wait for this file to load before saving.'
  );
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
    false
  );
  await act(async () =>
    pending.resolve({
      ok: true,
      json: async () => ({ content: 'Actual file B' }),
    })
  );
  expect(screen.getByRole('textbox', { name: 'File editor' })).toHaveValue(
    'Actual file B'
  );
  expect(
    screen.getByRole('textbox', { name: 'File editor' })
  ).not.toHaveAttribute('readonly');
  expect(
    screen.queryByRole('button', { name: 'Save file' })
  ).not.toBeInTheDocument();
});
