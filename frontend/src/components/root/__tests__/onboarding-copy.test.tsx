import React, { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PromptForm } from '../prompt-form';
import ChatBottombar from '../../chat/chat-bottombar';

let mockMutationOptions: {
  onCompleted: (data: unknown) => void;
  onError: (error: Error) => void;
};
const mockRegenerate = jest.fn();
jest.mock('@apollo/client', () => ({
  gql: () => 'query',
  useQuery: () => ({ data: undefined }),
  useMutation: (_query: unknown, options: typeof mockMutationOptions) => {
    mockMutationOptions = options;
    return [mockRegenerate];
  },
}));
jest.mock('@/hooks/useModels', () => ({
  useModels: () => ({
    models: [],
    loading: false,
    setSelectedModel: jest.fn(),
  }),
}));
jest.mock('@/app/log/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('typewriter-effect', () => () => null);
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} />
  ),
}));
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial, animate, exit, transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

beforeEach(() => jest.clearAllMocks());

function prompt(authorized = true) {
  const onSubmit = jest.fn();
  const onAuthRequired = jest.fn();
  render(
    <PromptForm
      isAuthorized={authorized}
      onSubmit={onSubmit}
      onAuthRequired={onAuthRequired}
    />
  );
  const input = screen.getByRole('textbox', { name: 'Describe your project' });
  return { input, onSubmit, onAuthRequired };
}

test('empty creation explains what is needed without opening sign-in', () => {
  const { input, onSubmit, onAuthRequired } = prompt(false);
  fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Describe your project first.'
  );
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(onSubmit).not.toHaveBeenCalled();
  expect(onAuthRequired).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'A portfolio' } });
  expect(screen.queryByRole('alert')).toBeNull();
});

test('empty improvement explains the prerequisite and makes no request', () => {
  prompt();
  fireEvent.click(screen.getByRole('button', { name: 'Improve prompt' }));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Describe your project first.'
  );
  expect(mockRegenerate).not.toHaveBeenCalled();
});

test('sign-in interruption keeps the entered prompt without starting generation', () => {
  const { input, onAuthRequired, onSubmit } = prompt(false);
  fireEvent.change(input, {
    target: { value: 'A portfolio for an architect' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
  expect(onAuthRequired).toHaveBeenCalledTimes(1);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(input).toHaveValue('A portfolio for an architect');
});

test('improvement reports pending until the mutation succeeds and blocks repeated clicks', () => {
  const { input } = prompt();
  fireEvent.change(input, { target: { value: 'A portfolio' } });
  fireEvent.click(screen.getByRole('button', { name: 'Improve prompt' }));
  const pending = screen.getByRole('button', { name: 'Improving prompt…' });
  expect(pending).toBeDisabled();
  expect(input).toBeDisabled();
  fireEvent.click(pending);
  expect(mockRegenerate).toHaveBeenCalledTimes(1);
  act(() =>
    mockMutationOptions.onCompleted({
      regenerateDescription: 'A portfolio with selected projects',
    })
  );
  expect(input).toHaveValue('A portfolio with selected projects');
  expect(screen.getByRole('button', { name: 'Prompt improved' })).toBeEnabled();
  fireEvent.change(input, { target: { value: 'A changed brief' } });
  expect(screen.getByRole('button', { name: 'Improve prompt' })).toBeEnabled();
});

test('failed improvement preserves text and exposes a retryable error', () => {
  const { input } = prompt();
  fireEvent.change(input, { target: { value: 'A portfolio' } });
  fireEvent.click(screen.getByRole('button', { name: 'Improve prompt' }));
  act(() => mockMutationOptions.onError(new Error('Network unavailable')));
  expect(input).toHaveValue('A portfolio');
  expect(input).toBeEnabled();
  expect(screen.getByRole('alert')).toHaveTextContent(
    "Couldn't improve your prompt. Your text is still here. Try again."
  );
  fireEvent.click(screen.getByRole('button', { name: 'Improve prompt' }));
  expect(mockRegenerate).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
});

test('an empty mutation result never replaces the draft or reports success', () => {
  const { input } = prompt();
  fireEvent.change(input, { target: { value: 'A portfolio' } });
  fireEvent.click(screen.getByRole('button', { name: 'Improve prompt' }));
  act(() => mockMutationOptions.onCompleted({ regenerateDescription: '' }));
  expect(input).toHaveValue('A portfolio');
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Prompt improved' })).toBeNull();
});

function chat() {
  const onQueue = jest.fn();
  const setInput = jest.fn();
  const submit = jest.fn();
  render(
    <ChatBottombar
      messages={[]}
      input="Make it green"
      handleInputChange={jest.fn()}
      handleSubmit={submit}
      stop={jest.fn()}
      formRef={createRef<HTMLFormElement>()}
      setInput={setInput}
      setMessages={jest.fn()}
      isStreaming
      onQueue={onQueue}
    />
  );
  return {
    onQueue,
    setInput,
    submit,
    input: screen.getByRole('textbox', { name: 'Message CodeFox' }),
  };
}

test('writing alone does not queue; Enter queues and clears the input', () => {
  const { onQueue, setInput, submit, input } = chat();
  expect(input).toHaveAttribute(
    'placeholder',
    'Write your next message. Press Enter or select Send to queue it.'
  );
  expect(onQueue).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  expect(onQueue).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onQueue).toHaveBeenCalledWith('Make it green');
  expect(setInput).toHaveBeenCalledWith('');
  expect(submit).not.toHaveBeenCalled();
});

test('the Send control explicitly queues the next message', () => {
  const { onQueue } = chat();
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Send: queue message for the next turn',
    })
  );
  expect(onQueue).toHaveBeenCalledTimes(1);
});
