/** Only classify outcomes the server already distinguishes. Never infer account status. */
export interface AuthError {
  networkError?: unknown;
  graphQLErrors?: ReadonlyArray<{ message: string }>;
}

export type SignInFailure =
  | 'credentials'
  | 'verification'
  | 'network'
  | 'unknown';

export function classifySignInError(error: AuthError): SignInFailure {
  if (error.networkError) return 'network';
  const messages = error.graphQLErrors?.map((item) => item.message) ?? [];
  if (messages.includes('Invalid credentials')) return 'credentials';
  if (messages.includes('Email not confirmed. Please check your inbox.')) {
    return 'verification';
  }
  return 'unknown';
}

export function getSignInErrorMessage(error: AuthError): string {
  switch (classifySignInError(error)) {
    case 'credentials':
      return 'Email or password is incorrect. Check your details and try again.';
    case 'verification':
      return 'Check your email to verify your account, then sign in.';
    case 'network':
      return 'CodeFox couldn’t complete sign-in. Try again in a moment.';
    default:
      return 'We couldn’t sign you in. Try again.';
  }
}

export function getDisplayNameErrorMessage(message?: string): string {
  switch (message) {
    case 'A username is between 3 and 32 characters.':
      return 'Use between 3 and 32 characters for your display name.';
    case 'A username cannot contain < > / \\ @ or quotes.':
      return 'Your display name can’t include < > / \\ @ or quotes.';
    case 'That username is taken.':
      return 'That display name is already in use. Try another.';
    default:
      return 'We couldn’t update your display name. Try again.';
  }
}

export const SIGNUP_PASSWORD_HELP =
  'Use at least 6 characters and at least two of these: lowercase letters, uppercase letters, numbers, or symbols.';

/** Mirrors the existing signup rules; this does not set a new password policy. */
export function getSignupPasswordState(value: string): {
  error: string | null;
  strength: 'weak' | 'medium' | 'strong';
} {
  if (value.length < 6) {
    return { error: 'Use at least 6 characters.', strength: 'weak' };
  }
  const characterTypes = [
    /[A-Z]/.test(value),
    /[a-z]/.test(value),
    /\d/.test(value),
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value),
  ].filter(Boolean).length;
  if (characterTypes < 2) {
    return {
      error:
        'Add another character type: lowercase, uppercase, number, or symbol.',
      strength: 'weak',
    };
  }
  return { error: null, strength: characterTypes < 4 ? 'medium' : 'strong' };
}

export function getVerificationFailureMessage(message?: string): string {
  if (
    message === 'Invalid token format' ||
    message === 'Invalid or expired token'
  ) {
    return 'This verification link is invalid or has expired. Open the latest verification email and try again.';
  }
  if (message === 'Email already confirmed or user not found.') {
    return 'We couldn’t verify this email. If you’ve already verified it, try signing in. Otherwise, open the latest verification email and try again.';
  }
  return 'We couldn’t verify your email. Try opening the link again.';
}
