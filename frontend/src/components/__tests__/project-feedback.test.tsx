import React from 'react';
import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { Workbench } from '@/components/root/workbench';
import { PublicProjects } from '@/components/root/public-projects';
import ChatTopbar from '@/components/chat/chat-topbar';
import { SideBarItem } from '@/components/sidebar-item';
import { ClearHistoryDialog } from '@/components/chat/clear-history-dialog';
import { useChatList } from '@/hooks/useChatList';
import { copyText } from '@/lib/copy-text';
import ResponsiveToolbar from '@/components/chat/code-engine/responsive-toolbar';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRefetch = jest.fn();
const mockSetVisibility = jest.fn();
let mockToolbarWidth = 900;
const mockMutations = new Map<string, jest.Mock>();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/image', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/useChatList', () => ({ useChatList: jest.fn() }));
jest.mock('@/providers/AuthProvider', () => ({
  useAuthContext: () => ({ isAuthorized: true, user: { id: 'owner' } }),
}));
jest.mock('@/components/chat/code-engine/project-context', () => ({
  ProjectContext: require('react').createContext({
    forkProject: jest.fn(),
    setProjectPublicStatus: (...args: unknown[]) => mockSetVisibility(...args),
  }),
}));
jest.mock('@/components/root/prompt-form', () => ({
  PromptForm: require('react').forwardRef(() => null),
}));
jest.mock('@/components/chat/code-engine/deploy-dialog', () => ({
  DeployDialog: () => null,
}));
jest.mock('@/components/chat/code-engine/key-dialog', () => ({
  KeyDialog: () => null,
}));
jest.mock('@/components/chat/code-engine/notes-dialog', () => ({
  NotesDialog: () => null,
}));
jest.mock('@/lib/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));
jest.mock('@/app/log/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useMutation: jest.fn(),
  useQuery: jest.fn(),
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const chat = {
  id: 'chat-1',
  title: 'My chat',
  createdAt: new Date().toISOString(),
  project: { id: 'project-1' },
};
const list = () => ({
  chats: [chat],
  loading: false,
  error: undefined,
  refetchChats: mockRefetch,
});
const renderWorkbench = () =>
  render(
    <Workbench
      promptFormRef={{ current: null }}
      onSubmit={() => {}}
      isLoading={false}
    />
  );
const openMenu = async (label: string) => {
  fireEvent.keyDown(screen.getByRole('button', { name: label }), {
    key: 'Enter',
    code: 'Enter',
  });
  await screen.findByRole('menu');
};

beforeEach(() => {
  jest.clearAllMocks();
  mockMutations.clear();
  mockToolbarWidth = 900;
  mockSetVisibility.mockResolvedValue(undefined);
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      constructor(private callback: (entries: unknown[]) => void) {}
      observe() {
        this.callback([{ contentRect: { width: mockToolbarWidth } }]);
      }
      disconnect() {}
    },
  });
  mockRefetch.mockResolvedValue({});
  (useChatList as jest.Mock).mockReturnValue(list());
  (useQuery as jest.Mock).mockReturnValue({
    data: { fetchPublicProjects: [] },
    loading: false,
    refetch: mockRefetch,
  });
  (useMutation as jest.Mock).mockImplementation((document, callbacks = {}) => {
    const name = document.definitions[0].name.value;
    if (!mockMutations.has(name))
      mockMutations.set(name, jest.fn().mockResolvedValue({ data: {} }));
    const mutate = async (args: unknown) => {
      try {
        const result = await mockMutations.get(name)!(args);
        callbacks.onCompleted?.(result.data);
        return result;
      } catch (error) {
        callbacks.onError?.(error);
        throw error;
      }
    };
    return [mutate, { loading: false }];
  });
  Element.prototype.scrollIntoView = jest.fn();
});
afterEach(cleanup);

describe('duplicate and rename', () => {
  test('success reports duplication once and opens the returned chat', async () => {
    const result = deferred<{ data: { duplicateProject: { id: string } } }>();
    mockMutations.set(
      'DuplicateProject',
      jest.fn().mockReturnValue(result.promise)
    );
    renderWorkbench();
    await openMenu('Project options');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(toast.success).not.toHaveBeenCalled();
    await act(async () =>
      result.resolve({ data: { duplicateProject: { id: 'copy-chat' } } })
    );
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Project duplicated');
    expect(mockPush).toHaveBeenCalledWith('/chat?id=copy-chat');
    expect(mockRefetch).toHaveBeenCalled();
  });

  test.each([
    [
      'network rejection',
      () => Promise.reject(new Error('Network offline')),
      'Could not duplicate this project. Try again.',
    ],
    [
      'ownership rejection',
      () => Promise.reject(new Error('That project is not yours')),
      'You can only duplicate your own projects.',
    ],
    [
      'quota rejection',
      () =>
        Promise.reject(
          new Error('You have 5 projects, which is the limit of your plan')
        ),
      'You have 5 projects, which is the limit of your plan',
    ],
    [
      'missing returned id',
      () => Promise.resolve({ data: { duplicateProject: null } }),
      'Could not duplicate this project. Try again.',
    ],
  ])(
    '%s never reports deletion or duplication success',
    async (_name, response, message) => {
      mockMutations.set(
        'DuplicateProject',
        jest.fn().mockImplementation(response)
      );
      renderWorkbench();
      await openMenu('Project options');
      fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.success).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    }
  );

  test('rename describes the chat title, not the project name', async () => {
    renderWorkbench();
    await openMenu('Project options');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename chat' }));
    expect(
      await screen.findByRole('dialog', { name: 'Rename chat' })
    ).toBeVisible();
    expect(screen.getByLabelText('Chat title')).toHaveValue('My chat');
    expect(screen.getByText(/project name stays the same/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockMutations.get('UpdateChatTitle')).not.toHaveBeenCalled();
  });
});

describe('project-list query feedback', () => {
  test('workbench distinguishes error from empty and retries', () => {
    (useChatList as jest.Mock).mockReturnValue({
      ...list(),
      chats: [],
      error: new Error('offline'),
    });
    renderWorkbench();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load your projects'
    );
    expect(screen.queryByText(/Nothing yet/)).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('alert')).getByRole('button', {
        name: 'Try again',
      })
    );
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  test('cached workbench projects remain visible with an out-of-date warning', () => {
    (useChatList as jest.Mock).mockReturnValue({
      ...list(),
      error: new Error('offline'),
    });
    renderWorkbench();
    expect(screen.getByText('My chat')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('may be out of date');
  });

  test('public gallery distinguishes error from empty and retries without unhandled rejection', async () => {
    mockRefetch.mockRejectedValue(new Error('still offline'));
    (useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error('offline'),
      refetch: mockRefetch,
    });
    render(<PublicProjects />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load public projects'
    );
    expect(screen.queryByText('Nothing published yet')).not.toBeInTheDocument();
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    );
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  test('genuinely empty lists retain their empty states', () => {
    (useChatList as jest.Mock).mockReturnValue({ ...list(), chats: [] });
    renderWorkbench();
    expect(screen.getByText(/Nothing yet/)).toBeVisible();
    expect(screen.getByText('Nothing published yet')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('clear-history confirmation', () => {
  test.each(['topbar', 'sidebar'])(
    '%s opens a confirmation, and Cancel leaves messages alone',
    async (surface) => {
      if (surface === 'topbar') render(<ChatTopbar chatId="chat-1" />);
      else
        render(
          <SideBarItem
            id="chat-1"
            currentChatId="chat-1"
            title="My chat"
            onSelect={() => {}}
            refetchChats={mockRefetch}
          />
        );
      await openMenu('Chat options');
      fireEvent.click(screen.getByRole('menuitem', { name: 'Clear history' }));
      const dialog = await screen.findByRole('dialog', {
        name: 'Clear chat history?',
      });
      expect(dialog).toHaveTextContent('project files stay');
      expect(mockMutations.get('ClearChatHistory')).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockMutations.get('ClearChatHistory')).not.toHaveBeenCalled();
    }
  );

  test('Escape dismisses the confirmation without clearing history', async () => {
    render(<ChatTopbar chatId="chat-1" />);
    await openMenu('Chat options');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear history' }));
    await screen.findByRole('dialog', { name: 'Clear chat history?' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockMutations.get('ClearChatHistory')).not.toHaveBeenCalled();
  });

  test('confirmation locks repeated clicks and reports only server-confirmed success', async () => {
    const result = deferred<{ data: { clearChatHistory: boolean } }>();
    const mutate = jest.fn().mockReturnValue(result.promise);
    mockMutations.set('ClearChatHistory', mutate);
    const onCleared = jest.fn();
    const onOpenChange = jest.fn();
    render(
      <ClearHistoryDialog
        chatId="chat-1"
        title="My chat"
        open
        onOpenChange={onOpenChange}
        onCleared={onCleared}
      />
    );
    const button = screen.getByRole('button', { name: 'Clear history' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(onCleared).not.toHaveBeenCalled();
    await act(async () => result.resolve({ data: { clearChatHistory: true } }));
    expect(onCleared).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalledWith('Chat history cleared');
  });

  test.each([false, 'reject'])(
    'failed clear (%s) stays open and allows retry',
    async (response) => {
      mockMutations.set(
        'ClearChatHistory',
        jest
          .fn()
          .mockImplementation(() =>
            response === false
              ? Promise.resolve({ data: { clearChatHistory: false } })
              : Promise.reject(new Error('offline'))
          )
      );
      const onCleared = jest.fn();
      const onOpenChange = jest.fn();
      render(
        <ClearHistoryDialog
          chatId="chat-1"
          title="My chat"
          open
          onOpenChange={onOpenChange}
          onCleared={onCleared}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'Could not clear chat history. Try again.'
        )
      );
      expect(
        screen.getByRole('button', { name: 'Clear history' })
      ).toBeEnabled();
      expect(onCleared).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    }
  );

  test('an old clear response cannot empty a newly selected chat', async () => {
    const result = deferred<{ data: { clearChatHistory: boolean } }>();
    mockMutations.set(
      'ClearChatHistory',
      jest.fn().mockReturnValue(result.promise)
    );
    const onCleared = jest.fn();
    const onOpenChange = jest.fn();
    const view = render(
      <ClearHistoryDialog
        chatId="chat-1"
        title="First"
        open
        onOpenChange={onOpenChange}
        onCleared={onCleared}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    view.rerender(
      <ClearHistoryDialog
        chatId="chat-2"
        title="Second"
        open={false}
        onOpenChange={onOpenChange}
        onCleared={onCleared}
      />
    );
    await act(async () => result.resolve({ data: { clearChatHistory: true } }));
    expect(onCleared).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('chat-list retry boundary', () => {
  const actualUseChatList = jest.requireActual(
    '@/hooks/useChatList'
  ).useChatList;

  test('query failure retains the last successful projects and retry rejection is handled', async () => {
    mockRefetch.mockRejectedValue(new Error('still offline'));
    (useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      previousData: { getUserChats: [chat] },
      loading: false,
      error: new Error('offline'),
      refetch: mockRefetch,
    });
    const { result } = renderHook(() => actualUseChatList());
    expect(result.current.chats).toEqual([chat]);
    expect(result.current.error.message).toBe('offline');
    await expect(result.current.refetchChats()).resolves.toBeUndefined();
    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ notifyOnNetworkStatusChange: true })
    );
  });
});

describe('clipboard feedback', () => {
  test('success waits for the clipboard write', async () => {
    const write = deferred<void>();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockReturnValue(write.promise) },
    });
    const operation = copyText(
      'https://example.test/share',
      'Share link copied'
    );
    expect(toast.success).not.toHaveBeenCalled();
    write.resolve();
    await expect(operation).resolves.toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Share link copied');
  });

  test.each(['rejected', 'unavailable'])(
    '%s clipboard never reports copied',
    async (scenario) => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value:
          scenario === 'unavailable'
            ? undefined
            : { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
      });
      await expect(copyText('project-1', 'Project id copied')).resolves.toBe(
        false
      );
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        'Could not copy to clipboard. Try again.'
      );
    }
  );
});

describe('visibility action labels and pending state', () => {
  const renderToolbar = (isPublic: boolean | undefined) => {
    (useQuery as jest.Mock).mockReturnValue({
      data:
        isPublic === undefined
          ? undefined
          : {
              getProject: {
                id: 'project-1',
                isPublic,
                template: 'html',
                uniqueProjectId: 'share-1',
              },
            },
      refetch: mockRefetch,
    });
    return render(
      <ResponsiveToolbar
        isLoading={false}
        activeTab="preview"
        setActiveTab={() => {}}
        projectId="project-1"
      />
    );
  };

  test.each([true, false])(
    'desktop action describes changing current public=%s state',
    async (isPublic) => {
      renderToolbar(isPublic);
      const action = screen.getByRole('button', {
        name: isPublic ? 'Make private' : 'Make public',
      });
      expect(action).toHaveAttribute(
        'title',
        expect.stringContaining(
          isPublic ? 'Currently public' : 'Currently private'
        )
      );
      await act(async () => fireEvent.click(action));
      expect(mockSetVisibility).toHaveBeenCalledWith('project-1', !isPublic);
    }
  );

  test('unknown visibility never offers publishing', () => {
    renderToolbar(undefined);
    expect(
      screen.getByRole('button', { name: 'Loading visibility…' })
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Make public' })
    ).not.toBeInTheDocument();
  });

  test('mobile uses the same action and prevents repeat visibility changes', async () => {
    mockToolbarWidth = 420;
    const result = deferred<void>();
    mockSetVisibility.mockReturnValue(result.promise);
    renderToolbar(false);
    await openMenu('More actions');
    const action = screen.getByRole('menuitem', { name: /Make public/ });
    expect(action).toHaveTextContent('Currently private');
    fireEvent.click(action);
    await openMenu('More actions');
    expect(
      screen.getByRole('menuitem', { name: /Updating visibility/ })
    ).toHaveAttribute('data-disabled');
    fireEvent.click(
      screen.getByRole('menuitem', { name: /Updating visibility/ })
    );
    expect(mockSetVisibility).toHaveBeenCalledTimes(1);
    await act(async () => result.resolve());
  });

  test('refresh rejection releases the visibility lock', async () => {
    mockRefetch.mockRejectedValue(new Error('offline'));
    renderToolbar(true);
    fireEvent.click(screen.getByRole('button', { name: 'Make private' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Could not refresh project visibility. Try again.'
      )
    );
    expect(screen.getByRole('button', { name: 'Make private' })).toBeEnabled();
  });
});
