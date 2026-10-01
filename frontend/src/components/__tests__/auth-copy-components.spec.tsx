import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useMutation, useQuery } from '@apollo/client';
import { SignInModal } from '../sign-in-modal';
import { SignUpModal } from '../sign-up-modal';

jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useMutation: jest.fn(),
  useQuery: jest.fn(),
}));
jest.mock('@/providers/AuthProvider', () => ({
  useAuthContext: () => ({ login: jest.fn() }),
}));
jest.mock('@/app/log/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));

const mutationOptions: Record<string, any> = {};
const mutations: Record<string, jest.Mock> = {};
let resetQuery: any;

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mutations)) delete mutations[key];
  resetQuery = { data: { passwordResetEmailAvailable: true }, loading: false };
  (useQuery as jest.Mock).mockImplementation((document) => {
    const name = document.definitions[0].name.value;
    if (name === 'PasswordResetEmailAvailable') return resetQuery;
    if (name === 'EmailVerificationRequired')
      return { data: { emailVerificationRequired: true } };
    return { data: { googleAuthAvailable: false } };
  });
  (useMutation as jest.Mock).mockImplementation((document, options) => {
    const name = document.definitions[0].name.value;
    mutationOptions[name] = options;
    mutations[name] ??= jest.fn().mockResolvedValue({});
    return [mutations[name], { loading: false }];
  });
});

afterEach(() => jest.useRealTimers());

describe('sign-in and recovery copy in the actual dialog', () => {
  it('updates the accessible title when opening and leaving password recovery', () => {
    render(<SignInModal isOpen onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Forgot your password?' })
    );
    expect(
      screen.getByRole('dialog', { name: 'Reset your password' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeInTheDocument();
  });

  it.each([
    { data: { passwordResetEmailAvailable: false }, loading: false },
    { loading: true },
    { data: { passwordResetEmailAvailable: true }, loading: true },
    {
      data: { passwordResetEmailAvailable: true },
      error: new Error('offline'),
    },
  ])(
    'does not submit reset email when unavailable, unknown, or stale: %p',
    (query) => {
      resetQuery = query;
      render(<SignInModal isOpen onClose={() => {}} />);
      fireEvent.click(
        screen.getByRole('button', { name: 'Forgot your password?' })
      );
      fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'person@example.com' },
      });
      const submit = screen.getByRole('button', { name: 'Send reset link' });
      expect(submit).toBeDisabled();
      // Even a submit event bypassing the disabled button must be guarded.
      fireEvent.submit(submit.closest('form')!);
      expect(mutations.RequestPasswordReset).not.toHaveBeenCalled();
    }
  );

  it('requests a reset only when the global capability is confirmed', () => {
    render(<SignInModal isOpen onClose={() => {}} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Forgot your password?' })
    );
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'person@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(mutations.RequestPasswordReset).toHaveBeenCalledWith({
      variables: { email: 'person@example.com' },
    });
  });

  it('renders actionable verification and network errors without raw diagnostics', () => {
    render(<SignInModal isOpen onClose={() => {}} />);
    act(() =>
      mutationOptions.Login.onError({
        graphQLErrors: [
          { message: 'Email not confirmed. Please check your inbox.' },
        ],
      })
    );
    expect(
      screen.getByText('Check your email to verify your account, then sign in.')
    ).toBeInTheDocument();
    act(() =>
      mutationOptions.Login.onError({
        networkError: new Error('internal diagnostic'),
      })
    );
    expect(
      screen.getByText(
        'CodeFox couldn’t complete sign-in. Try again in a moment.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/internal diagnostic|Incorrect email or password/)
    ).not.toBeInTheDocument();
  });
});

describe('signup copy and resend state', () => {
  it('shows truthful requirements before typing and retains the old acceptance rules', () => {
    render(<SignUpModal isOpen onClose={() => {}} />);
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      /at least 6 characters and at least two/
    );
    expect(screen.getByLabelText('Display name')).toHaveAccessibleDescription(
      /public projects/
    );
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Example' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'person@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'abcde1' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'abcde1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(mutations.RegisterUser).toHaveBeenCalledWith({
      variables: {
        input: {
          username: 'Example',
          email: 'person@example.com',
          password: 'abcde1',
          confirmPassword: 'abcde1',
        },
      },
    });
  });

  it('keeps resend success styling and expiry independent of the rewritten words', () => {
    jest.useFakeTimers();
    render(<SignUpModal isOpen onClose={() => {}} />);
    act(() => mutationOptions.RegisterUser.onCompleted());
    fireEvent.click(
      screen.getByRole('button', { name: 'Resend verification email' })
    );
    act(() =>
      mutationOptions.ResendConfirmationEmail.onCompleted({
        resendConfirmationEmail: { success: true },
      })
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Verification email sent again. Check your inbox.'
    );
    expect(screen.getByRole('status').className).toContain('bg-green-50');
    expect(
      screen.getByRole('button', { name: 'Resend available in 60s' })
    ).toBeDisabled();
    for (let second = 0; second < 60; second++)
      act(() => jest.advanceTimersByTime(1000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Resend verification email' })
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Resend verification email' })
    );
    act(() =>
      mutationOptions.ResendConfirmationEmail.onCompleted({
        resendConfirmationEmail: {
          success: false,
          message: 'Try again later.',
        },
      })
    );
    expect(screen.getByRole('status')).toHaveTextContent('Try again later.');
    expect(screen.getByRole('status').className).not.toContain('bg-green-50');
  });
});
