import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DeployDialog } from '../deploy-dialog';
import { useMutation } from '@apollo/client';

jest.mock('@apollo/client', () => ({ useMutation: jest.fn() }));
jest.mock('@/components/design-systems', () => ({ DEPLOY_PROJECT: {} }));
jest.mock('@/app/log/logger', () => ({ logger: { error: jest.fn() } }));
const deploy = jest.fn();
const clipboard = jest.fn();
const url = 'https://test-fixture.vercel.app/a-long-deployment-url';
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  localStorage.clear();
  (useMutation as jest.Mock).mockReturnValue([deploy, { loading: false }]);
  deploy.mockResolvedValue({
    data: { deployProject: { ok: true, url, message: '' } },
  });
  clipboard.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboard },
  });
});
afterEach(() => jest.useRealTimers());
async function showResult() {
  const result = render(
    <DeployDialog projectId="fixture-project" open onOpenChange={jest.fn()} />
  );
  fireEvent.change(screen.getByLabelText('Vercel token'), {
    target: { value: 'fixture-token-not-a-credential' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Deploy' }));
  await screen.findByRole('link', { name: url });
  return result;
}

it('does not announce success before the clipboard confirms the write', async () => {
  const pending = deferred();
  clipboard.mockReturnValue(pending.promise);
  await showResult();
  fireEvent.click(screen.getByRole('button', { name: 'Copy deployment URL' }));
  expect(
    screen.queryByRole('button', { name: 'Deployment URL copied' })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Copy deployment URL' })
  ).toBeDisabled();
  await act(async () => pending.resolve());
  expect(
    screen.getByRole('button', { name: 'Deployment URL copied' })
  ).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Deployment URL copied');
});

it('provides a fully selectable fallback after clipboard rejection and allows retry', async () => {
  clipboard.mockRejectedValueOnce(new Error('denied'));
  await showResult();
  fireEvent.click(screen.getByRole('button', { name: 'Copy deployment URL' }));
  const fallback = await screen.findByRole('textbox', {
    name: 'Deployment URL',
  });
  expect(fallback).toHaveValue(url);
  expect(fallback).toHaveAttribute('readonly');
  expect(screen.getByRole('status')).toHaveTextContent(
    "Couldn't copy the link. Select and copy it manually."
  );
  expect(
    screen.queryByRole('button', { name: 'Deployment URL copied' })
  ).not.toBeInTheDocument();
  fireEvent.focus(fallback);
  expect((fallback as HTMLInputElement).selectionEnd).toBe(url.length);
  fireEvent.click(screen.getByRole('button', { name: 'Copy deployment URL' }));
  await screen.findByRole('button', { name: 'Deployment URL copied' });
  expect(
    screen.queryByRole('textbox', { name: 'Deployment URL' })
  ).not.toBeInTheDocument();
});

it('provides the same fallback when clipboard support is unavailable', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  });
  await showResult();
  fireEvent.click(screen.getByRole('button', { name: 'Copy deployment URL' }));
  expect(
    await screen.findByRole('textbox', { name: 'Deployment URL' })
  ).toHaveValue(url);
});

it('ignores a clipboard write that finishes after closing and reopening the dialog', async () => {
  const pending = deferred();
  clipboard.mockReturnValue(pending.promise);
  const { rerender } = await showResult();
  fireEvent.click(screen.getByRole('button', { name: 'Copy deployment URL' }));
  rerender(
    <DeployDialog
      projectId="fixture-project"
      open={false}
      onOpenChange={jest.fn()}
    />
  );
  rerender(
    <DeployDialog projectId="fixture-project" open onOpenChange={jest.fn()} />
  );
  await act(async () => pending.resolve());
  expect(
    screen.queryByRole('button', { name: 'Deployment URL copied' })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Copy deployment URL' })
  ).not.toBeDisabled();
});

it('clears success after its display interval and copies again on the next click', async () => {
  await showResult();
  jest.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Copy deployment URL' }));
  await act(async () => {});
  expect(
    screen.getByRole('button', { name: 'Deployment URL copied' })
  ).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1500));
  fireEvent.click(screen.getByRole('button', { name: 'Copy deployment URL' }));
  await act(async () => {});
  expect(clipboard).toHaveBeenCalledTimes(2);
});
