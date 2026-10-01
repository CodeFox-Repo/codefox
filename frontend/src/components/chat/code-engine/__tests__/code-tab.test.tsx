import React from 'react';
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import CodeTab from '../tabs/code-tab';
import { ProjectContext } from '../project-context';
import { authenticatedFetch } from '@/lib/authenticatedFetch';
import { toast } from 'sonner';

jest.mock('../project-context', () => ({
  ProjectContext: jest.requireActual('react').createContext({}),
}));
jest.mock('@/lib/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));
jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));
jest.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: () => <div>Editor fixture</div>,
}));
jest.mock('../file-explorer-button', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../file-structure', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, animate, transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
  },
}));

const fetchMock = authenticatedFetch as jest.Mock;
const version = {
  id: 'v1',
  label: 'Earlier version',
  current: false,
  at: '2026-10-01T00:00:00Z',
};
const ok = (data: unknown) => ({ ok: true, json: async () => data });
const select = jest.fn();
const finished = jest.fn();
function tree(projectPath = 'project-a') {
  return (
    <ProjectContext.Provider
      value={{ turnsDone: 0, turnFinished: finished } as any}
    >
      <CodeTab
        editorRef={{ current: null }}
        projectPath={projectPath}
        fileStructureData={{}}
        newCode=""
        isFileStructureLoading={false}
        updateSavingStatus={jest.fn()}
        filePath="index.html"
        setFilePath={select}
      />
    </ProjectContext.Provider>
  );
}
beforeEach(() => {
  fetchMock.mockImplementation(async (url: string) =>
    ok(url.includes('versions') ? { versions: [version] } : { changes: [] })
  );
});

it('distinguishes history failure from an empty history and really retries', async () => {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes('versions')) throw new Error('offline');
    return ok({ changes: [] });
  });
  render(tree());
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Couldn't load version history"
  );
  expect(screen.queryByText(/No history yet/)).not.toBeInTheDocument();
  fetchMock.mockResolvedValue(ok({ versions: [] }));
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(/No history yet/)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('treats a malformed history response as an error, not empty history', async () => {
  fetchMock.mockImplementation(async (url: string) =>
    ok(url.includes('versions') ? {} : { changes: [] })
  );
  render(tree());
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.queryByText(/No history yet/)).not.toBeInTheDocument();
});

it.each(['network', 'response', 'server'])(
  'refreshes stale files/history after an uncertain %s restore failure',
  async (failure) => {
    let restored = false;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/restore')) {
        restored = true;
        if (failure === 'network')
          throw new Error('connection dropped after write');
        if (failure === 'response')
          return {
            ok: true,
            json: async () => {
              throw new Error('lost response body');
            },
          };
        return { ok: false, status: 500 };
      }
      if (url.includes('versions'))
        return ok({ versions: [{ ...version, current: restored }] });
      return ok({ changes: [] });
    });
    render(tree());
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    await waitFor(() =>
      expect(screen.getByText('Current')).toBeInTheDocument()
    );
    expect(finished).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(
      "We couldn't confirm the restore. Check your files and version history before trying again."
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(select).toHaveBeenCalledWith(null);
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Restore' })
    ).not.toBeInTheDocument();
  }
);

it('identifies an explicitly rejected restore request', async () => {
  fetchMock.mockImplementation(async (url: string) =>
    url.includes('/restore')
      ? { ok: false, status: 403 }
      : ok(url.includes('versions') ? { versions: [version] } : { changes: [] })
  );
  render(tree());
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      'The restore request was rejected. Check your access and version history before trying again.'
    )
  );
  expect(select).not.toHaveBeenCalled();
  expect(finished).not.toHaveBeenCalled();
});

it('confirms a successful restore and refreshes the file tree', async () => {
  render(tree());
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('Files restored to that version')
  );
  expect(finished).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenCalledWith(null);
});

it('ignores an older history response after navigating to another project', async () => {
  let resolveOld!: (data: unknown) => void;
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes('versions?path=project-a'))
      return new Promise((resolve) => {
        resolveOld = resolve;
      });
    return ok(
      url.includes('versions')
        ? { versions: [{ ...version, label: 'New project version' }] }
        : { changes: [] }
    );
  });
  const { rerender } = render(tree());
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  rerender(tree('project-b'));
  expect(await screen.findByText('New project version')).toBeInTheDocument();
  await act(async () => resolveOld(ok({ versions: [version] })));
  expect(screen.queryByText('Earlier version')).not.toBeInTheDocument();
});
