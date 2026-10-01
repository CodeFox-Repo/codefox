import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WebPreview from '../web-view';
import { ProjectContext } from '../project-context';

jest.mock('../project-context', () => ({
  ProjectContext: jest.requireActual('react').createContext({}),
}));
jest.mock('@/app/log/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
jest.mock('@/lib/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));
jest.mock('@/lib/page-console', () => ({ capturePageConsole: jest.fn() }));
jest.mock('@/hooks/useVisibleInterval', () => ({
  useVisibleInterval: jest.fn(),
}));

it('gives every Next preview icon and its path a persistent accessible name', async () => {
  render(
    <ProjectContext.Provider
      value={
        {
          getWebUrl: jest.fn().mockResolvedValue({ domain: 'localhost:9000' }),
        } as any
      }
    >
      <WebPreview
        project={{ id: 'fixture', projectPath: 'fixture', template: 'next' }}
      />
    </ProjectContext.Provider>
  );
  for (const name of [
    'Go back',
    'Go forward',
    'Refresh preview',
    'Zoom out',
    'Zoom in',
    'Open preview in new tab',
    'Enter full screen',
  ]) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  }
  const path = screen.getByRole('textbox', { name: 'Preview path' });
  await waitFor(() => expect(path).not.toBeDisabled());
  fireEvent.change(path, { target: { value: '/about' } });
  expect(screen.getByRole('textbox', { name: 'Preview path' })).toHaveValue(
    '/about'
  );
  expect(screen.getByTitle('Project preview')).toBeInTheDocument();
});
