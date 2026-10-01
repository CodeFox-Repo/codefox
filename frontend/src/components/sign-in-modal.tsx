'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BackgroundGradient } from '@/components/ui/background-gradient';
import {
  TextureCardHeader,
  TextureCardTitle,
  TextureCardContent,
  TextureSeparator,
} from '@/components/ui/texture-card';
import { useMutation, useQuery } from '@apollo/client';
import {
  GOOGLE_AUTH_AVAILABLE,
  LOGIN_USER,
  PASSWORD_RESET_EMAIL_AVAILABLE,
  REQUEST_PASSWORD_RESET,
} from '@/graphql/mutations/auth';
import { toast } from 'sonner';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useAuthContext } from '@/providers/AuthProvider';
import { AlertCircle } from 'lucide-react';
import { logger } from '@/app/log/logger';
import { getSignInErrorMessage } from '@/lib/auth-copy';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Forgetting a password had no path at all: the backend could send the mail
  // and the template existed, but nothing ever called it and there was no
  // link to start from. Inline rather than its own route — the address is
  // already typed in the box above.
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const {
    data: resetCapability,
    loading: checkingResetEmail,
    error: resetCapabilityError,
  } = useQuery(PASSWORD_RESET_EMAIL_AVAILABLE, {
    skip: !isOpen || !forgot,
    fetchPolicy: 'network-only',
  });
  const resetEmailAvailable =
    !checkingResetEmail &&
    !resetCapabilityError &&
    resetCapability?.passwordResetEmailAvailable === true;
  // Destructure login from our AuthContext
  const { login } = useAuthContext();

  const [requestReset, { loading: sending }] = useMutation(
    REQUEST_PASSWORD_RESET,
    {
      // The server answers the same way whether or not the address is
      // registered, so there is no failure branch to show — echoing its
      // message is the whole result.
      onCompleted: (data) => setSent(data.requestPasswordReset.message),
      onError: () =>
        setErrorMessage('We couldn’t request a reset link. Try again.'),
    }
  );

  // Destructure `loading` so we can disable the button while logging in
  // Hidden entirely when the backend has no Google credentials — a button
  // whose only outcome is an error toast is not a feature.
  const { data: googleData } = useQuery(GOOGLE_AUTH_AVAILABLE);
  const googleAvailable = googleData?.googleAuthAvailable ?? false;
  const [loginUser, { loading }] = useMutation(LOGIN_USER, {
    onCompleted: (data) => {
      if (data?.login) {
        // Store tokens where desired (session storage for access, local for refresh)
        login(data.login.accessToken, data.login.refreshToken);
        toast.success('Signed in');
        setErrorMessage(null);
        onClose(); // Close the modal

        // If you want to redirect somewhere on success, uncomment:
        // router.push("/main");
      }
    },
    onError: (error) => {
      setErrorMessage(getSignInErrorMessage(error));
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null); // Clear error when attempting login again
    try {
      await loginUser({
        variables: {
          input: {
            email,
            password,
          },
        },
      });
    } catch (error) {
      logger.error('Login failed:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] fixed top-[50%] left-[50%] transform -translate-x-[50%] -translate-y-[50%] p-0">
        {/* Invisible but accessible DialogTitle and Description */}
        <VisuallyHidden>
          <DialogTitle>
            {forgot ? 'Reset your password' : 'Sign in'}
          </DialogTitle>
          <DialogDescription>
            {forgot
              ? 'Recover access to your CodeFox account.'
              : 'Enter your email and password.'}
          </DialogDescription>
        </VisuallyHidden>

        <BackgroundGradient className="rounded-[22px] p-4 bg-background">
          <div className="w-full">
            <TextureCardHeader className="flex flex-col gap-1 items-center justify-center p-4">
              {/* The header follows the form. "Welcome back / Sign in to your
                  account" over a reset form describes the wrong screen. */}
              <TextureCardTitle>
                {forgot ? 'Reset your password' : 'Welcome back'}
              </TextureCardTitle>
              <p className="text-center text-muted-foreground">
                {forgot
                  ? 'Recover access to your account'
                  : 'Sign in to your account'}
              </p>
            </TextureCardHeader>
            <TextureSeparator />
            <TextureCardContent>
              {forgot ? (
                <div className="space-y-4">
                  {sent ? (
                    <>
                      <p className="text-sm text-muted-foreground">{sent}</p>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setForgot(false);
                          setSent(null);
                        }}
                      >
                        Back to sign in
                      </Button>
                    </>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!resetEmailAvailable) return;
                        setErrorMessage(null);
                        requestReset({ variables: { email } });
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">Email</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setErrorMessage(null);
                          }}
                          required
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          {checkingResetEmail
                            ? 'Checking password reset availability…'
                            : resetCapabilityError
                              ? 'We couldn’t check whether password reset email is available. Close this form and try again.'
                              : resetEmailAvailable
                                ? 'Enter your account email to request a reset link. If you use Google to sign in, continue with Google instead.'
                                : 'Password reset email isn’t available on this site right now.'}
                        </p>
                      </div>

                      {errorMessage && (
                        <div className="flex items-center gap-2 text-primary-700 dark:text-primary-400 text-sm p-2 rounded-md bg-primary-50 dark:bg-secondary border border-primary-200 dark:border-primary-800">
                          <AlertCircle className="h-4 w-4" />
                          <span>{errorMessage}</span>
                        </div>
                      )}

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={sending || !email || !resetEmailAvailable}
                      >
                        {sending ? 'Sending…' : 'Send reset link'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          setForgot(false);
                          setErrorMessage(null);
                        }}
                      >
                        Back to sign in
                      </Button>
                    </form>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrorMessage(null); // Clear error when user types
                      }}
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMessage(null); // Clear error when user types
                      }}
                      required
                      className="w-full"
                    />
                  </div>

                  {/* Show error message if login fails */}
                  {errorMessage && (
                    <div className="flex items-center gap-2 text-primary-700 dark:text-primary-400 text-sm p-2 rounded-md bg-primary-50 dark:bg-secondary border border-primary-200 dark:border-primary-800">
                      <AlertCircle className="h-4 w-4" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgot(true);
                      setErrorMessage(null);
                    }}
                    className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Forgot your password?
                  </button>
                </form>
              )}

              {/* "Or continue with" belongs to signing in; under a reset
                  form it offers an alternative to a thing you are not doing.
                  And with no OAuth provider configured, a divider above
                  nothing is just a stray line. */}
              {googleAvailable && (
                <div className={forgot ? 'hidden' : 'mt-6'}>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-4">
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 w-full"
                      onClick={() => {
                        window.location.href =
                          process.env.NEXT_PUBLIC_BACKEND_GOOGLE_OAUTH ||
                          'http://localhost:8080/auth/google';
                      }}
                    >
                      <img
                        src="/images/google.svg"
                        alt="Google"
                        className="w-5 h-5"
                      />
                      <span>Continue with Google</span>
                    </Button>
                  </div>
                </div>
              )}
            </TextureCardContent>
          </div>
        </BackgroundGradient>
      </DialogContent>
    </Dialog>
  );
}
