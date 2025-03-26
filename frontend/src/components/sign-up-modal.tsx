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
import { useMutation } from '@apollo/client';
import {
  REGISTER_USER,
  RESEND_CONFIRMATION_EMAIL_MUTATION,
} from '@/graphql/mutations/auth';
import { useRouter } from 'next/navigation';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { AlertCircle, CheckCircle, Mail, Clock, Github } from 'lucide-react';
import { useEffect } from 'react';
import { logger } from '@/app/log/logger';

export function SignUpModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<
    'weak' | 'medium' | 'strong' | null
  >(null);

  const validatePassword = (value: string) => {
    // Reset errors
    setPasswordError(null);

    // Check minimum length
    if (value.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      setPasswordStrength('weak');
      return false;
    }

    // Check for complexity
    const hasUppercase = /[A-Z]/.test(value);
    const hasLowercase = /[a-z]/.test(value);
    const hasNumbers = /\d/.test(value);
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value);

    const strengthScore = [
      hasUppercase,
      hasLowercase,
      hasNumbers,
      hasSpecialChar,
    ].filter(Boolean).length;

    if (strengthScore < 2) {
      setPasswordStrength('weak');
      setPasswordError('Password is too weak');
      return false;
    } else if (strengthScore < 4) {
      setPasswordStrength('medium');
      return true;
    } else {
      setPasswordStrength('strong');
      return true;
    }
  };

  const [registerUser, { loading }] = useMutation(REGISTER_USER, {
    onError: (error) => {
      if (error.message.includes('already exists')) {
        setErrorMessage('This email is already in use. Please try another.');
      } else {
        setErrorMessage(error.message);
      }
    },
    onCompleted: () => {
      setRegistrationSuccess(true);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name || !email || !password || !passwordConfirm) {
      setErrorMessage('All fields are required.');
      return;
    }

    if (!validatePassword(password)) {
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    try {
      await registerUser({
        variables: {
          input: {
            username: name,
            email,
            password,
            confirmPassword: passwordConfirm,
          },
        },
      });
    } catch (error) {
      logger.error('Registration failed:', error);
    }
  };

  const [resendConfirmationEmail, { loading: resendLoading }] = useMutation(
    RESEND_CONFIRMATION_EMAIL_MUTATION,
    {
      onCompleted: (data) => {
        if (data.resendConfirmationEmail.success) {
          setResendMessage(
            'Verification email has been resent. Please check your inbox.'
          );
          setResendCooldown(60); // Start 60 second cooldown
        } else {
          setResendMessage(
            data.resendConfirmationEmail.message ||
              'Failed to resend. Please try again later.'
          );
        }
      },
      onError: (error) => {
        setResendMessage(`Error: ${error.message}`);
      },
    }
  );

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
    } else if (resendCooldown === 0) {
      // Clear the resend message once cooldown is complete
      if (resendMessage && resendMessage.includes('has been resent')) {
        setResendMessage(null);
      }
    }
    return () => clearTimeout(timer);
  }, [resendCooldown, resendMessage]);

  const handleResendConfirmation = () => {
    if (resendCooldown > 0) return;

    setResendMessage(null);
    resendConfirmationEmail({
      variables: {
        input: {
          email,
        },
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] fixed top-[50%] left-[50%] transform -translate-x-[50%] -translate-y-[50%] p-0 max-h-[90vh] overflow-y-auto">
        <VisuallyHidden>
          <DialogTitle>Sign Up</DialogTitle>
          <DialogDescription>
            Create an account by entering your information below
          </DialogDescription>
        </VisuallyHidden>

        <BackgroundGradient className="rounded-[22px] p-4 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="w-full">
            {registrationSuccess ? (
              <>
                <TextureCardHeader className="flex flex-col gap-1 items-center justify-center p-4">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-2" />
                  <TextureCardTitle>Verification Email Sent</TextureCardTitle>
                  <p className="text-center text-neutral-600 dark:text-neutral-400">
                    Please check your email to complete registration. We have
                    sent a verification link to{' '}
                    <span className="font-medium">{email}</span>.
                  </p>
                </TextureCardHeader>
                <TextureSeparator />
                <TextureCardContent className="space-y-4">
                  <div className="flex flex-col gap-2 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-blue-500" />
                      <span className="font-medium text-blue-700 dark:text-blue-300">
                        Email Verification Required
                      </span>
                    </div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      To complete your registration, please click the
                      verification link sent to your email address.
                    </p>
                  </div>

                  {resendMessage && (
                    <div
                      className={`flex items-center gap-2 text-sm p-2 rounded-md ${
                        resendMessage.includes('has been resent')
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 text-green-700 dark:text-green-400'
                          : 'bg-primary-50 dark:bg-zinc-800 border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-400'
                      }`}
                    >
                      {resendMessage.includes('has been resent') ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span>{resendMessage}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Button onClick={onClose} className="w-full">
                      Got it
                    </Button>
                    <Button
                      onClick={handleResendConfirmation}
                      variant="outline"
                      className="w-full"
                      disabled={resendCooldown > 0 || resendLoading}
                    >
                      {resendLoading ? (
                        'Sending...'
                      ) : resendCooldown > 0 ? (
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Resend available in {resendCooldown}s
                        </span>
                      ) : (
                        'Resend verification email'
                      )}
                    </Button>
                  </div>
                </TextureCardContent>
              </>
            ) : (
              <>
                <TextureCardHeader className="flex flex-col gap-1 items-center justify-center p-4">
                  <TextureCardTitle>Create account</TextureCardTitle>
                  <p className="text-center text-neutral-600 dark:text-neutral-400">
                    Enter your information to create your account
                  </p>
                </TextureCardHeader>
                <TextureSeparator />
                <TextureCardContent>
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-2 w-full"
                    type="button"
                    onClick={() => {
                      // Redirect to your NestJS backend's Google OAuth endpoint
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

                  {/* GitHub Sign Up Button - added below Google */}
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      className="flex items-center justify-center gap-2 w-full"
                      type="button"
                    >
                      <Github className="w-5 h-5 text-black dark:text-white" />
                      <span>Continue with GitHub</span>
                    </Button>
                  </div>

                  {/* Divider with "or" text */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white dark:bg-zinc-900 text-gray-500">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="Name"
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setErrorMessage(null);
                        }}
                        required
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        placeholder="Email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setErrorMessage(null);
                        }}
                        required
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        placeholder="Password"
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          validatePassword(e.target.value);
                          setErrorMessage(null);
                        }}
                        required
                        className={`w-full ${passwordError ? 'border-red-500' : ''}`}
                      />
                      {password && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="text-sm">Password strength:</div>
                            <div className="flex h-2 w-full max-w-[100px] overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                              <div
                                className={`h-full ${
                                  passwordStrength === 'weak'
                                    ? 'w-1/3 bg-red-500'
                                    : passwordStrength === 'medium'
                                      ? 'w-2/3 bg-yellow-500'
                                      : 'w-full bg-green-500'
                                }`}
                              />
                            </div>
                            <div className="text-sm">
                              {passwordStrength === 'weak'
                                ? 'Weak'
                                : passwordStrength === 'medium'
                                  ? 'Medium'
                                  : 'Strong'}
                            </div>
                          </div>

                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Password must:
                            <ul className="list-disc pl-5 mt-1 space-y-1">
                              <li
                                className={
                                  password.length >= 6 ? 'text-green-500' : ''
                                }
                              >
                                Be at least 6 characters long
                              </li>
                              <li
                                className={
                                  /[A-Z]/.test(password) ? 'text-green-500' : ''
                                }
                              >
                                Include at least one uppercase letter
                              </li>
                              <li
                                className={
                                  /\d/.test(password) ? 'text-green-500' : ''
                                }
                              >
                                Include at least one number
                              </li>
                              <li
                                className={
                                  /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(
                                    password
                                  )
                                    ? 'text-green-500'
                                    : ''
                                }
                              >
                                Include at least one special character
                              </li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {passwordError && (
                        <div className="text-red-500 text-xs mt-1">
                          {passwordError}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="passwordConfirm">Confirm Password</Label>
                      <Input
                        id="passwordConfirm"
                        placeholder="Confirm Password"
                        type="password"
                        value={passwordConfirm}
                        onChange={(e) => {
                          setPasswordConfirm(e.target.value);
                          setErrorMessage(null);
                        }}
                        required
                        className="w-full"
                      />
                    </div>

                    {errorMessage && (
                      <div className="flex items-center gap-2 text-primary-700 dark:text-primary-400 text-sm p-2 rounded-md bg-primary-50 dark:bg-zinc-800 border border-primary-200 dark:border-primary-800">
                        <AlertCircle className="h-4 w-4" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <div className="h-2"></div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Signing up...' : 'Sign up'}
                    </Button>
                  </form>
                </TextureCardContent>
              </>
            )}
          </div>
        </BackgroundGradient>
      </DialogContent>
    </Dialog>
  );
}
